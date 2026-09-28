import { Icon } from './Icon'

export interface PlayerControlsProps {
  currentTime: number
  duration: number
  adNumber: number
  adCount: number
  playing: boolean
  muted: boolean
  volume: number
  fullscreen: boolean
  disableSeeking?: boolean
  qualityLabel?: string
  onPlayPause: () => void
  onMute: () => void
  onVolume: (value: number) => void
  onSeek: (value: number) => void
  onFullscreen: () => void
  onSkip: () => void
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.floor(seconds) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function PlayerControls(props: PlayerControlsProps) {
  const progress = () => props.duration ? Math.min(100, props.currentTime / props.duration * 100) : 0
  const timeRemaining = () => Math.max(0, Math.ceil(props.duration - props.currentTime))
  return <div class="bottom-controls">
    <div class="ad-row">
      <div class="ad-details"><span>广告 · 第 {props.adNumber} 条 / 共 {props.adCount} 条</span><span class="dot">·</span><span aria-label="剩余时间">{formatTime(timeRemaining())}</span><Icon name="info" size={16}/></div>
      <button class="skip-button" onClick={props.onSkip}>跳过广告 <span>›</span></button>
    </div>
    <input class="timeline" classList={{ 'timeline-locked': !!props.disableSeeking }} aria-label="播放进度" aria-disabled={props.disableSeeking ? 'true' : undefined} tabIndex={props.disableSeeking ? -1 : 0} type="range" min="0" max={props.duration || 1} step="0.1" value={props.currentTime} onInput={event => { if (!props.disableSeeking) props.onSeek(Number(event.currentTarget.value)) }} onPointerDown={event => { if (props.disableSeeking) event.preventDefault() }} onKeyDown={event => { if (props.disableSeeking) event.preventDefault() }} style={{ '--progress': `${progress()}%` }} />
    <div class="control-row">
      <button class="icon-button" aria-label={props.playing ? '暂停' : '播放'} onClick={props.onPlayPause}><Icon name={props.playing ? 'pause' : 'play'} size={23}/></button>
      <div class="volume-group">
        <button class="icon-button" aria-label={props.muted ? '取消静音' : '静音'} onClick={props.onMute}><Icon name={props.muted ? 'mute' : 'volume'} size={23}/></button>
        <input class="volume-slider" aria-label="音量" type="range" min="0" max="1" step="0.01" value={props.muted ? 0 : props.volume} onInput={event => props.onVolume(Number(event.currentTarget.value))} />
      </div>
      <div class="control-spacer" />
      <button class="text-button" disabled>倍速</button>
      <span class="quality-label" title="当前视频源画质">{props.qualityLabel ?? '高清'}</span>
      <button class="icon-button full-button" aria-label={props.fullscreen ? '退出全屏' : '全屏'} onClick={props.onFullscreen}><Icon name={props.fullscreen ? 'exit-full' : 'full'} size={21}/></button>
    </div>
  </div>
}
