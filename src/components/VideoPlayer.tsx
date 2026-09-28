import { createEffect, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { PlayerControls } from './PlayerControls'
import { PlayerHeader } from './PlayerHeader'

export interface VideoPlayerProps {
  src: string
  adUrl: string
  adTitle: string
  fallbackDuration: number
  adNumber: number
  adCount: number
  disableSeeking?: boolean
  qualityLabel?: string
  noticeOpen?: boolean
  playbackEnabled?: boolean
  onShowNotice?: () => void
  onSkip?: () => void
  onEnded?: () => void
  onPlaybackChange?: (active: boolean) => void
  onPlayRequest?: () => void
  children?: JSX.Element
}

export function VideoPlayer(props: VideoPlayerProps) {
  let video!: HTMLVideoElement
  let player!: HTMLDivElement
  const [playing, setPlaying] = createSignal(false)
  const [muted, setMuted] = createSignal(true)
  const [volume, setVolume] = createSignal(1)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [duration, setDuration] = createSignal(props.fallbackDuration)
  const [videoBounds, setVideoBounds] = createSignal<{ left: number; top: number; width: number; height: number } | null>(null)
  const [fullscreen, setFullscreen] = createSignal(false)
  let reportedPlaying = false

  const updateVideoBounds = () => {
    if (!video.videoWidth || !video.videoHeight) {
      setVideoBounds(null)
      return
    }
    const width = player.clientWidth
    const height = player.clientHeight
    const scale = Math.min(width / video.videoWidth, height / video.videoHeight)
    const fittedWidth = video.videoWidth * scale
    const fittedHeight = video.videoHeight * scale
    setVideoBounds({ left: (width - fittedWidth) / 2, top: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight })
  }
  const syncDuration = () => {
    setDuration(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : props.fallbackDuration)
  }

  const syncPlayback = () => {
    const active = !video.paused
    setPlaying(active)
    if (active === reportedPlaying) return
    reportedPlaying = active
    props.onPlaybackChange?.(active)
  }

  const togglePlay = () => {
    if (!props.playbackEnabled) {
      props.onPlayRequest?.()
      return
    }
    if (video.paused) video.play().catch(syncPlayback)
    else { video.pause(); syncPlayback() }
  }
  const toggleMute = () => { video.muted = !video.muted; setMuted(video.muted) }
  const changeVolume = (value: number) => {
    video.volume = value
    video.muted = value === 0
    setVolume(value)
    setMuted(video.muted)
  }
  const seek = (value: number) => {
    if (props.disableSeeking || !Number.isFinite(video.duration)) return
    video.currentTime = Math.max(0, Math.min(video.duration, value))
    setCurrentTime(video.currentTime)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement === player) void document.exitFullscreen()
    else void player.requestFullscreen()
  }
  const skip = () => {
    props.onSkip?.()
    video.pause()
    syncPlayback()
  }
  const syncFullscreen = () => setFullscreen(document.fullscreenElement === player)
  const handleKeyDown = (event: KeyboardEvent) => {
    if (props.noticeOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
    if (event.code === 'Space' || event.code === 'KeyK') { event.preventDefault(); togglePlay() }
    else if (event.code === 'KeyM') toggleMute()
    else if (event.code === 'KeyF') toggleFullscreen()
    else if (!props.disableSeeking && event.code === 'ArrowLeft') seek(video.currentTime - 5)
    else if (!props.disableSeeking && event.code === 'ArrowRight') seek(video.currentTime + 5)
  }
  onMount(() => {
    video.muted = true
    video.volume = 1
    document.addEventListener('fullscreenchange', syncFullscreen)
    player.addEventListener('keydown', handleKeyDown)
    const observer = new ResizeObserver(updateVideoBounds)
    observer.observe(player)
    onCleanup(() => observer.disconnect())
  })
  createEffect(() => {
    if (props.playbackEnabled) video.play().catch(syncPlayback)
    else { video.pause(); syncPlayback() }
  })
  onCleanup(() => {
    document.removeEventListener('fullscreenchange', syncFullscreen)
    player.removeEventListener('keydown', handleKeyDown)
  })

  return <div class="player" ref={player} tabIndex={0}>
    <video ref={video} class="video" src={props.src} preload="metadata" playsinline
      onTimeUpdate={() => setCurrentTime(video.currentTime)}
      onLoadedMetadata={() => { syncDuration(); updateVideoBounds() }}
      onDurationChange={syncDuration}
      onPlay={syncPlayback}
      onPause={syncPlayback}
      onVolumeChange={() => { setMuted(video.muted); setVolume(video.volume) }}
      onEnded={() => props.onEnded?.()} />
    {videoBounds() && <a class="video-link" href={props.adUrl} title={props.adTitle}
      aria-label={props.adTitle}
      style={{ left: `${videoBounds()!.left}px`, top: `${videoBounds()!.top}px`, width: `${videoBounds()!.width}px`, height: `${videoBounds()!.height}px` }} />}
    <div class="video-shade" />
    <PlayerHeader onShowNotice={() => props.onShowNotice?.()} />
    <PlayerControls currentTime={currentTime()} duration={duration()} adNumber={props.adNumber} adCount={props.adCount} playing={playing()} muted={muted()} volume={volume()} fullscreen={fullscreen()} disableSeeking={props.disableSeeking} qualityLabel={props.qualityLabel} onPlayPause={togglePlay} onMute={toggleMute} onVolume={changeVolume} onSeek={seek} onFullscreen={toggleFullscreen} onSkip={skip} />
    {props.children}
  </div>
}
