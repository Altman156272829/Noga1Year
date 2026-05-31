/**
 * PlaybackController.js
 *
 * Wraps a GSAP timeline to provide play / pause / toggle / skip.
 * Each phase creates one controller and registers it with the App
 * via a ref-callback. The App wires global tap / spacebar input to
 * the active controller.
 *
 * Usage:
 *   const ctrl = new PlaybackController(tl)
 *   ctrl.play()
 *   ctrl.toggle()   // called by App on tap / spacebar
 *   ctrl.skip()     // jump to end of current labelled section (optional)
 *   ctrl.dispose()  // call in useEffect cleanup
 */
export default class PlaybackController {
  constructor(timeline) {
    this.tl = timeline
    this._paused = false
  }

  play() {
    this._paused = false
    this.tl.play()
  }

  pause() {
    this._paused = true
    this.tl.pause()
  }

  toggle() {
    if (this._paused) {
      this.play()
    } else {
      this.pause()
    }
  }

  get isPaused() {
    return this._paused
  }

  /**
   * Skip to the next GSAP label in the timeline, or to the end
   * if no label is ahead of the current position.
   */
  skip() {
    const labels = this.tl.getLabelsArray?.() ?? []
    const current = this.tl.time()
    const next = labels.find((l) => l.time > current + 0.1)
    if (next) {
      this.tl.seek(next.time)
    } else {
      this.tl.seek(this.tl.duration())
    }
    this._paused = false
    this.tl.play()
  }

  dispose() {
    this.tl.kill()
  }
}
