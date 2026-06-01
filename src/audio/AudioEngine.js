/**
 * AudioEngine.js — Web Audio API singleton.
 * No external files. All sounds synthesised on the fly.
 *
 * API:
 *   AudioEngine.unlock()        — call on the first user gesture; resumes AudioContext
 *   AudioEngine.tick()          — short percussive blip for each typed character
 *   AudioEngine.ambient(on)     — start / stop the very quiet ambient pad
 *   AudioEngine.bell()          — a school-bell tone (detuned partials, long decay)
 */

let ctx = null
let ambientNodes = null

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return ctx
}

const AudioEngine = {
  /** Call once on the entry tap to unlock the AudioContext on mobile. */
  unlock() {
    const c = getCtx()
    if (c.state === 'suspended') {
      c.resume()
    }
  },

  /**
   * Typewriter tick — a very short, quiet percussive click.
   * Tiny random pitch so each key sounds slightly different.
   */
  tick() {
    try {
      const c = getCtx()
      if (c.state !== 'running') return

      const osc = c.createOscillator()
      const gain = c.createGain()

      // Random pitch between 800-1400 Hz gives a typewriter feel
      osc.frequency.value = 800 + Math.random() * 600
      osc.type = 'square'

      gain.gain.setValueAtTime(0.04, c.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04)

      osc.connect(gain)
      gain.connect(c.destination)

      osc.start(c.currentTime)
      osc.stop(c.currentTime + 0.04)

      // Auto cleanup
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    } catch (_) {
      // Never let audio errors break the visual
    }
  },

  /**
   * School bell — a warm metallic ring built from a few detuned partials
   * with a long exponential decay. Synthesised, no external file.
   * Used in Act 4 of Phase 4 / Scene 1.
   */
  bell() {
    try {
      const c = getCtx()
      if (c.state !== 'running') return

      const now  = c.currentTime
      const base = 660 // ~E5, a bright school-bell fundamental

      // A few inharmonic partials give the tone its metallic "bell" character.
      // [frequency multiple, relative gain]
      const partials = [
        [1.0,  0.5],
        [2.01, 0.28],
        [2.99, 0.16],
        [4.13, 0.09],
      ]

      const master = c.createGain()
      master.gain.value = 0.6
      master.connect(c.destination)

      partials.forEach(([mult, g]) => {
        const osc  = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.value = base * mult

        // Fast attack, long exponential decay (~1.4s) — the classic bell envelope
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(g, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)

        osc.connect(gain)
        gain.connect(master)
        osc.start(now)
        osc.stop(now + 1.5)
        osc.onended = () => {
          osc.disconnect()
          gain.disconnect()
        }
      })

      // Tidy the master node once the ring has died away
      setTimeout(() => { try { master.disconnect() } catch (_) {} }, 1700)
    } catch (_) {
      // Never let audio errors break the visual
    }
  },

  /**
   * Ambient pad — a very quiet, de-tuned oscillator pair through a
   * low-pass filter. Creates a subtle atmospheric presence.
   */
  ambient(on) {
    try {
      const c = getCtx()
      if (c.state !== 'running') return

      if (!on) {
        if (ambientNodes) {
          const { osc1, osc2, masterGain } = ambientNodes
          const now = c.currentTime
          masterGain.gain.setValueAtTime(masterGain.gain.value, now)
          masterGain.gain.linearRampToValueAtTime(0, now + 2)
          osc1.stop(now + 2.1)
          osc2.stop(now + 2.1)
          ambientNodes = null
        }
        return
      }

      if (ambientNodes) return // already running

      const osc1 = c.createOscillator()
      const osc2 = c.createOscillator()
      const filter = c.createBiquadFilter()
      const masterGain = c.createGain()

      // Two slightly de-tuned sine waves for a shimmer effect
      osc1.type = 'sine'
      osc1.frequency.value = 55 // A1
      osc2.type = 'sine'
      osc2.frequency.value = 55.4 // slightly sharp A1

      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 1

      masterGain.gain.setValueAtTime(0, c.currentTime)
      masterGain.gain.linearRampToValueAtTime(0.03, c.currentTime + 3)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(masterGain)
      masterGain.connect(c.destination)

      osc1.start()
      osc2.start()

      ambientNodes = { osc1, osc2, filter, masterGain }
    } catch (_) {
      // Never let audio errors break the visual
    }
  },
}

export default AudioEngine
