import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { AttentionMonitor, type AttentionFailure } from './attention/AttentionMonitor'
import { NoticeDialog } from './components/NoticeDialog'
import { MembershipModal } from './components/MembershipModal'
import { VideoPlayer } from './components/VideoPlayer'

type Dialog = {
  kind: 'camera' | 'failure' | 'background' | 'success'
  title: string
  content: string
  confirmText: string
  progress?: number | null
}

const cameraDialog: Dialog = {
  kind: 'camera',
  title: '请打开摄像头',
  content: '为了给你更好的广告观看体验，请在浏览器提示中允许访问。',
  confirmText: '重试授权',
}

const backgroundDialog: Dialog = {
  kind: 'background',
  title: '请确保标签页在前台',
  content: '视频已暂停。返回此标签页后点击重新检测，继续观看广告。',
  confirmText: '重新检测',
}

const resumeDialog: Dialog = {
  kind: 'camera',
  title: '正在重新检测',
  content: '摄像头已在暂停期间关闭，正在重新开启。请看向屏幕。',
  confirmText: '重试',
}

const PAUSE_RELEASE_MS = 5000

type Ad = { id: string; title: string; url: string; file: string; duration: number }

function isAd(value: unknown): value is Ad {
  if (!value || typeof value !== 'object') return false
  const ad = value as Record<string, unknown>
  return typeof ad.id === 'string' && typeof ad.title === 'string'
    && typeof ad.file === 'string' && ad.file.length > 0
    && typeof ad.url === 'string' && /^https?:\/\//.test(ad.url)
    && typeof ad.duration === 'number' && Number.isFinite(ad.duration) && ad.duration >= 0
}

function failureDialog(reason: AttentionFailure): Dialog {
  return reason === 'eyes-closed'
    ? { kind: 'failure', title: '请勿闭眼', content: '检测到闭眼。为了确保广告效果，请睁眼看向屏幕。', confirmText: '重试' }
    : { kind: 'failure', title: '请勿移开视线', content: '检测到你没有看向屏幕。为了确保广告效果，请正视屏幕。', confirmText: '重试' }
}

export function App() {
  const [dialog, setDialog] = createSignal<Dialog | null>(cameraDialog)
  const [playbackEnabled, setPlaybackEnabled] = createSignal(false)
  const [showMembership, setShowMembership] = createSignal(false)
  const [ads, setAds] = createSignal<Ad[]>([])
  const [adIndex, setAdIndex] = createSignal(0)
  const [adsError, setAdsError] = createSignal('')
  let monitor: AttentionMonitor | undefined
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let hasPlayed = false

  const clearReleaseTimer = () => {
    if (releaseTimer !== undefined) clearTimeout(releaseTimer)
    releaseTimer = undefined
  }

  const handlePlaybackChange = (active: boolean) => {
    monitor?.setPlaybackActive(active)
    if (active) {
      hasPlayed = true
      clearReleaseTimer()
      return
    }
    if (!hasPlayed || document.hidden || showMembership() || dialog()?.kind === 'success') return
    clearReleaseTimer()
    releaseTimer = setTimeout(() => {
      releaseTimer = undefined
      monitor?.stop()
      if (!dialog()) setPlaybackEnabled(false)
    }, PAUSE_RELEASE_MS)
  }

  const handleVisibilityChange = () => {
    if (!document.hidden || dialog()?.kind === 'success') return
    clearReleaseTimer()
    monitor?.stop()
    setPlaybackEnabled(false)
    setShowMembership(false)
    setDialog(backgroundDialog)
  }

  onMount(() => {
    const controller = new AbortController()
    fetch('/ads.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<unknown>
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0 || !data.every(isAd)) throw new Error('广告列表格式无效')
        setAds(data)
      })
      .catch(error => { if (!controller.signal.aborted) setAdsError(`加载广告失败：${String(error)}`) })
    onCleanup(() => controller.abort())
    monitor = new AttentionMonitor({
      onCameraReady: () => setDialog({ ...cameraDialog, title: '加载中', content: '正在加载所需组件', progress: null }),
      onWasmProgress: (loaded, total) => setDialog({ ...cameraDialog,
        title: '加载中',
        content: total ? '正在加载所需组件' : `正在加载所需组件（${(loaded / 1024 / 1024).toFixed(1)} MB）。`,
        progress: total ? Math.min(50, Math.round(loaded / total * 50)) : null,
      }),
      onModelProgress: (loaded, total) => setDialog({ ...cameraDialog,
        title: '加载中',
        content: total ? '正在加载所需模型' : `正在加载所需模型${(loaded / 1024 / 1024).toFixed(1)} MB）。`,
        progress: total ? Math.min(100, 50 + Math.round(loaded / total * 50)) : null,
      }),
      onModelInitializing: () => setDialog({ ...cameraDialog, title: '加载中', content: '资源加载完成，正在初始化', progress: 100 }),
      onModelReady: () => setDialog({ ...cameraDialog, content: '为了确保广告效果，请睁眼看向屏幕。' }),
      onReady: () => {
        setDialog(null)
        setPlaybackEnabled(true)
      },
      onFailure: reason => {
        setPlaybackEnabled(false)
        setDialog(failureDialog(reason))
      },
      onError: message => {
        setPlaybackEnabled(false)
        setDialog({ ...cameraDialog, content: message })
      },
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (document.hidden) setDialog(backgroundDialog)
    else void monitor.start()
  })
  onCleanup(() => {
    clearReleaseTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    monitor?.stop()
  })

  const retry = () => {
    const current = dialog()
    if (!current || current.kind === 'success') {
      setDialog(null)
      return
    }
    if (document.hidden) return
    clearReleaseTimer()
    setDialog({ ...current, content: current.kind === 'camera' ? '正在等待摄像头，请允许访问并看向屏幕。' : '正在重新检测，请睁眼看向屏幕。' })
    monitor?.retry()
  }

  const complete = () => {
    if (adIndex() + 1 < ads().length) {
      setAdIndex(index => index + 1)
      return
    }
    clearReleaseTimer()
    monitor?.stop()
    setPlaybackEnabled(false)
    setDialog({ kind: 'success', title: '恭喜通过挑战', content: '这种广告还是不要出现在现实中罢', confirmText: '完成' })
  }

  return <Show when={ads()[adIndex()]} keyed fallback={<div class="player loading-ads">{adsError() || '正在加载广告…'}</div>}>{ad => <VideoPlayer
    src={`/${ad.file.replace(/^\/+/, '')}`}
    adUrl={ad.url}
    adTitle={ad.title}
    fallbackDuration={ad.duration}
    adNumber={adIndex() + 1}
    adCount={ads().length}
    disableSeeking
    noticeOpen={!!dialog() || showMembership()}
    playbackEnabled={playbackEnabled()}
    onEnded={complete}
    onPlaybackChange={handlePlaybackChange}
    onPlayRequest={() => {
      if (document.hidden || dialog() || showMembership()) return
      clearReleaseTimer()
      setDialog(resumeDialog)
      monitor?.retry()
    }}
    onShowNotice={() => {
      clearReleaseTimer()
      setPlaybackEnabled(false)
      setDialog(cameraDialog)
      monitor?.retry()
    }}
    onSkip={() => {
      clearReleaseTimer()
      monitor?.stop()
      setPlaybackEnabled(false)
      setDialog(null)
      setShowMembership(true)
    }}
  >
    <Show when={dialog()}>{current =>
      <NoticeDialog
        title={current().title}
        content={current().content}
        progress={current().progress}
        confirmText={current().confirmText}
        showClose={current().kind === 'success'}
        onClose={() => setDialog(null)}
        onConfirm={retry}
      />
    }</Show>
    <Show when={showMembership()}>
      <MembershipModal onClose={() => {
        setShowMembership(false)
        clearReleaseTimer()
        setDialog(cameraDialog)
        monitor?.retry()
      }} />
    </Show>
  </VideoPlayer>}</Show>
}
