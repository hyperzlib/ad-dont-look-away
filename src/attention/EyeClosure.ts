export const EYE_CLOSED_THRESHOLD = 0.4
export const EYE_OPEN_THRESHOLD = 0.25

export class EyeClosure {
  private closed = false

  reset(): void {
    this.closed = false
  }

  update(hasFace: boolean, blinkLeft: number, blinkRight: number): boolean {
    if (!hasFace || blinkLeft < EYE_OPEN_THRESHOLD || blinkRight < EYE_OPEN_THRESHOLD) this.closed = false
    else if (blinkLeft >= EYE_CLOSED_THRESHOLD && blinkRight >= EYE_CLOSED_THRESHOLD) this.closed = true
    return this.closed
  }
}
