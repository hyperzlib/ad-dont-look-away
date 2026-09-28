import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { DetectionTimer, type DetectionFailure } from './DetectionTimer'
import { EyeClosure, EYE_CLOSED_THRESHOLD, EYE_OPEN_THRESHOLD } from './EyeClosure'

export type AttentionFailure = DetectionFailure

interface MonitorEvents {
  onCameraReady: () => void
  onWasmProgress: (loaded: number, total: number | null) => void
  onModelProgress: (loaded: number, total: number | null) => void
  onModelInitializing: () => void
  onModelReady: () => void
  onReady: () => void
  onFailure: (reason: AttentionFailure) => void
  onError: (message: string) => void
}

const READY_MS = 350
const SAMPLE_INTERVAL_MS = 80
const BLEND_LOG_INTERVAL_MS = 1000

function score(result: FaceLandmarkerResult, name: string): number {
  return result.faceBlendshapes[0]?.categories.find(category => category.categoryName === name)?.score ?? 0
}

function isLookingAway(result: FaceLandmarkerResult): boolean {
  if (!result.faceLandmarks.length) return true

  const matrix = result.facialTransformationMatrixes[0]?.data
  const yaw = matrix && matrix.length >= 16
    ? Math.atan2(Math.max(Math.abs(matrix[2]), Math.abs(matrix[8])), Math.abs(matrix[0])) * 180 / Math.PI
    : 0
  const pitch = matrix && matrix.length >= 16
    ? Math.atan2(Math.max(Math.abs(matrix[6]), Math.abs(matrix[9])), Math.abs(matrix[5])) * 180 / Math.PI
    : 0

  const leftHorizontal = Math.max(score(result, 'eyeLookInLeft'), score(result, 'eyeLookOutLeft'))
  const rightHorizontal = Math.max(score(result, 'eyeLookInRight'), score(result, 'eyeLookOutRight'))
  const leftVertical = Math.max(score(result, 'eyeLookUpLeft'), score(result, 'eyeLookDownLeft'))
  const rightVertical = Math.max(score(result, 'eyeLookUpRight'), score(result, 'eyeLookDownRight'))

  return yaw > 25 || pitch > 20 ||
    (leftHorizontal > 0.55 && rightHorizontal > 0.55) ||
    (leftVertical > 0.55 && rightVertical > 0.55)
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return '请允许浏览器使用摄像头，然后点击重试。'
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return '未找到摄像头，请连接摄像头后点击重试。'
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return '摄像头无法启动，请关闭其他占用摄像头的程序后重试。'
  }
  return '摄像头或人脸检测模型启动失败，请检查设备与网络后重试。'
}

async function downloadBinary(url: string, signal: AbortSignal, onProgress: (loaded: number, total: number | null) => void): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Asset download failed: HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('Content-Length'))
  const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  const chunks: Uint8Array[] = []
  let loaded = 0
  onProgress(0, total)
  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      onProgress(loaded, total)
    }
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer())
    chunks.push(buffer)
    loaded = buffer.byteLength
    onProgress(loaded, total)
  }
  const binary = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    binary.set(chunk, offset)
    offset += chunk.byteLength
  }
  return binary
}

export class AttentionMonitor {
  private readonly camera = document.createElement('video')
  private landmarker: FaceLandmarker | null = null
  private stream: MediaStream | null = null
  private modelController: AbortController | null = null
  private pending: Promise<void> | null = null
  private pendingGeneration = 0
  private frame = 0
  private generation = 0
  private lastSampleAt = 0
  private lastBlendLogAt: number | null = null
  private readonly eyeClosure = new EyeClosure()
  private readonly detectionTimer = new DetectionTimer()
  private attentiveSince: number | null = null
  private waitingForAttention = false
  private monitoring = false
  private playbackActive = false

  constructor(private readonly events: MonitorEvents) {
    this.camera.muted = true
    this.camera.playsInline = true
  }

  start(): Promise<void> {
    if (this.pending && this.pendingGeneration === this.generation) return this.pending
    if (this.landmarker && this.stream?.active) {
      this.retry()
      return Promise.resolve()
    }

    const generation = ++this.generation
    this.pendingGeneration = generation
    const pending = this.initialize(generation).finally(() => {
      if (this.pending === pending) this.pending = null
    })
    this.pending = pending
    return pending
  }

  retry(): void {
    if (!this.landmarker || !this.stream?.active) {
      void this.start()
      return
    }
    this.detectionTimer.reset()
    this.lastSampleAt = 0
    this.lastBlendLogAt = null
    this.eyeClosure.reset()
    this.attentiveSince = null
    this.waitingForAttention = true
    this.monitoring = false
  }

  setPlaybackActive(active: boolean): void {
    this.playbackActive = active
    if (!active) {
      this.detectionTimer.reset()
      this.lastSampleAt = 0
      this.lastBlendLogAt = null
      this.eyeClosure.reset()
      this.attentiveSince = null
    }
  }

  stop(): void {
    ++this.generation
    this.modelController?.abort()
    this.modelController = null
    this.pending = null
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.monitoring = false
    this.playbackActive = false
    this.waitingForAttention = false
    this.detectionTimer.reset()
    this.lastSampleAt = 0
    this.lastBlendLogAt = null
    this.eyeClosure.reset()
    this.camera.pause()
    this.camera.srcObject = null
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.landmarker?.close()
    this.landmarker = null
  }

  private async initialize(generation: number): Promise<void> {
    let assetController: AbortController | null = null
    let wasmUrl: string | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      this.stream = stream
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', this.handleCameraEnded, { once: true }))
      this.camera.srcObject = stream
      await this.camera.play()
      if (generation !== this.generation) return
      this.events.onCameraReady()

      const base = import.meta.env.BASE_URL
      assetController = new AbortController()
      this.modelController = assetController
      const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`)
      if (generation !== this.generation) return
      const wasmBuffer = await downloadBinary(vision.wasmBinaryPath, assetController.signal, (loaded, total) => {
        if (generation === this.generation) this.events.onWasmProgress(loaded, total)
      })
      if (generation !== this.generation) return
      wasmUrl = URL.createObjectURL(new Blob([wasmBuffer], { type: 'application/wasm' }))
      vision.wasmBinaryPath = wasmUrl
      const modelBuffer = await downloadBinary(`${base}models/face_landmarker.task`, assetController.signal, (loaded, total) => {
        if (generation === this.generation) this.events.onModelProgress(loaded, total)
      })
      if (generation !== this.generation) return
      this.events.onModelInitializing()
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: modelBuffer, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })
      if (generation !== this.generation) {
        landmarker.close()
        return
      }
      this.landmarker = landmarker
      this.events.onModelReady()
      this.retry()
      this.frame = requestAnimationFrame(this.detectFrame)
    } catch (error) {
      if (generation !== this.generation) return
      this.stop()
      this.events.onError(cameraErrorMessage(error))
    } finally {
      if (wasmUrl) URL.revokeObjectURL(wasmUrl)
      if (this.modelController === assetController) this.modelController = null
    }
  }

  private detectFrame = (now: number): void => {
    if (!this.landmarker || !this.stream) return
    if (!this.stream.active) {
      this.handleCameraEnded()
      return
    }
    this.frame = requestAnimationFrame(this.detectFrame)
    if (!this.waitingForAttention && (!this.monitoring || !this.playbackActive)) return
    if (this.camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || now - this.lastSampleAt < SAMPLE_INTERVAL_MS) return
    this.lastSampleAt = now

    try {
      const result = this.landmarker.detectForVideo(this.camera, now)
      const hasFace = result.faceLandmarks.length > 0
      const blinkLeft = score(result, 'eyeBlinkLeft')
      const blinkRight = score(result, 'eyeBlinkRight')
      const closed = this.eyeClosure.update(hasFace, blinkLeft, blinkRight)
      const away = !closed && isLookingAway(result)
      const failure = this.waitingForAttention ? null : this.detectionTimer.observe(now, closed, away)
      if (this.lastBlendLogAt === null || now - this.lastBlendLogAt >= BLEND_LOG_INTERVAL_MS) {
        const categories = result.faceBlendshapes[0]?.categories ?? []
        const eyeBlendshapes = Object.fromEntries(categories
          .filter(category => category.categoryName.startsWith('eye'))
          .map(category => [category.categoryName, category.score]))
        // console.log('[闭眼检测 blend]', JSON.stringify({
        //   hasFace,
        //   blendshapeCount: categories.length,
        //   eyeBlendshapes,
        //   blinkLeft,
        //   blinkRight,
        //   closedThreshold: EYE_CLOSED_THRESHOLD,
        //   openThreshold: EYE_OPEN_THRESHOLD,
        //   closed,
        //   waitingForAttention: this.waitingForAttention,
        //   playbackActive: this.playbackActive,
        //   ...this.detectionTimer.getFrameStatus(),
        // }))
        this.lastBlendLogAt = now
      }

      if (this.waitingForAttention) {
        if (closed || away) this.attentiveSince = null
        else {
          this.attentiveSince ??= now
          if (now - this.attentiveSince >= READY_MS) {
            this.waitingForAttention = false
            this.monitoring = true
            this.detectionTimer.reset()
            this.events.onReady()
          }
        }
        return
      }
      if (failure) this.fail(failure)
    } catch (error) {
      this.stop()
      this.events.onError(cameraErrorMessage(error))
    }
  }

  private fail(reason: AttentionFailure): void {
    this.monitoring = false
    this.detectionTimer.reset()
    this.events.onFailure(reason)
  }

  private handleCameraEnded = (): void => {
    if (!this.stream) return
    this.stop()
    this.events.onError('摄像头连接已中断，请重新连接后点击重试。')
  }
}
