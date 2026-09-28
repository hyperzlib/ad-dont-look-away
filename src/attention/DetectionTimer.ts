export type DetectionFailure = 'eyes-closed' | 'look-away'

const CLOSED_BASELINE_MS = 500
const AWAY_MS = 900
const MAX_COUNTED_INTERVAL_MS = 320
const STREAK_RESET_GAP_MS = 5000
const DEFAULT_FRAME_INTERVAL_MS = 80
const INTERVAL_SAMPLE_COUNT = 9
const MIN_CLOSED_FRAMES = 5

export class DetectionTimer {
  private lastSampleAt: number | null = null
  private readonly frameIntervals: number[] = []
  private closedFrames = 0
  private awayElapsed = 0
  private wasAway = false

  reset(): void {
    this.lastSampleAt = null
    this.frameIntervals.length = 0
    this.closedFrames = 0
    this.awayElapsed = 0
    this.wasAway = false
  }

  getFrameStatus(): { closedFrames: number; requiredClosedFrames: number; frameIntervalMs: number } {
    const intervals = [...this.frameIntervals].sort((a, b) => a - b)
    const frameIntervalMs = intervals.length
      ? intervals[Math.floor(intervals.length / 2)]
      : DEFAULT_FRAME_INTERVAL_MS
    return {
      closedFrames: this.closedFrames,
      requiredClosedFrames: Math.max(MIN_CLOSED_FRAMES, Math.floor(CLOSED_BASELINE_MS / frameIntervalMs) + 1),
      frameIntervalMs,
    }
  }

  observe(now: number, closed: boolean, away: boolean): DetectionFailure | null {
    let elapsed = 0
    if (this.lastSampleAt !== null) {
      const gap = now - this.lastSampleAt
      if (gap < 0 || gap > STREAK_RESET_GAP_MS) this.reset()
      else if (gap > 0) {
        elapsed = Math.min(gap, MAX_COUNTED_INTERVAL_MS)
        this.frameIntervals.push(gap)
        if (this.frameIntervals.length > INTERVAL_SAMPLE_COUNT) this.frameIntervals.shift()
      }
    }
    this.lastSampleAt = now
    this.closedFrames = closed ? this.closedFrames + 1 : 0
    this.awayElapsed = away && this.wasAway ? this.awayElapsed + elapsed : 0
    this.wasAway = away

    if (this.closedFrames >= this.getFrameStatus().requiredClosedFrames) return 'eyes-closed'
    if (this.awayElapsed >= AWAY_MS) return 'look-away'
    return null
  }
}
