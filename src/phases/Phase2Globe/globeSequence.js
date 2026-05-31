/**
 * globeSequence.js — GSAP master timeline for Phase 2.
 *
 * Sequence:
 *   Events 1–6  — typewriter text box → dot flies to sphere → label appears → lines connect
 *   Events 7–11 — dot flies directly, label appears, lines connect; one at a time with
 *                 decreasing gaps: 4s / 3s / 2s / 1s / 0.5s
 *   Final burst — 100 tiny dots, one per tl.call(), power-curve timing (slow → fast)
 *   Rotation    — globe rotates 0.6 rad over 2.5s → onComplete
 *
 * All events (1–11) show a title label after the dot lands.
 *
 * TIMING NOTE: cursor is tracked manually as an absolute second value so that
 * tl.call() (zero-duration) callbacks don't cause label pile-up.
 */

import { gsap } from 'gsap'
import EVENTS from '../../core/events.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function fibonacciSphere(n, radius) {
  const phi = Math.PI * (3 - Math.sqrt(5))
  const pts = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = phi * i
    pts.push([Math.cos(t) * r * radius, y * radius, Math.sin(t) * r * radius])
  }
  return pts
}

// ── Text box (events 1–6) ──────────────────────────────────────────────────

function createTextBox(overlayEl) {
  const box = document.createElement('div')
  Object.assign(box.style, {
    position:       'absolute',
    top:            '50%',
    left:           '50%',
    transform:      'translate(-50%, -50%)',
    maxWidth:       'min(520px, 88vw)',
    padding:        '2rem 2.5rem',
    border:         '1px solid rgba(200,169,110,0.25)',
    background:     'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    borderRadius:   '2px',
    opacity:        '0',
    pointerEvents:  'none',
  })

  const titleEl = document.createElement('p')
  Object.assign(titleEl.style, {
    fontFamily:    'var(--font-serif)',
    fontWeight:    '500',
    fontSize:      'clamp(0.7rem, 2.5vw, 0.9rem)',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color:         'var(--gold-dim)',
    marginBottom:  '0.9rem',
  })

  const bodyEl = document.createElement('p')
  Object.assign(bodyEl.style, {
    fontFamily:    'var(--font-serif)',
    fontWeight:    '300',
    fontStyle:     'italic',
    fontSize:      'clamp(1.05rem, 3.5vw, 1.4rem)',
    lineHeight:    '1.65',
    letterSpacing: '0.02em',
    color:         'var(--gold)',
    textShadow:    '0 0 20px rgba(200,169,110,0.3)',
  })

  box.appendChild(titleEl)
  box.appendChild(bodyEl)
  overlayEl.appendChild(box)
  return { box, titleEl, bodyEl }
}

function removeEl(el) {
  el?.parentNode?.removeChild(el)
}

/** Type text letter-by-letter, firing onChar per visible character. */
function typeText(el, text, onChar, charsPerSec = 28) {
  el.textContent = ''
  text.split('').forEach((ch, i) => {
    const delay = i / charsPerSec
    // Independent gsap.delayedCall so typing is not part of master tl
    gsap.delayedCall(delay, () => {
      el.textContent += ch
      if (ch !== ' ') onChar()
    })
  })
}

// ── Dot label ─────────────────────────────────────────────────────────────

function createLabel(overlayEl, title) {
  const el = document.createElement('p')
  Object.assign(el.style, {
    position:      'absolute',
    fontFamily:    'var(--font-serif)',
    fontWeight:    '400',
    fontSize:      'clamp(0.6rem, 1.8vw, 0.75rem)',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color:         'var(--gold)',
    opacity:       '0',
    pointerEvents: 'none',
    whiteSpace:    'nowrap',
    transform:     'translate(-50%, -50%)',
  })
  el.textContent = title
  overlayEl.appendChild(el)
  return el
}

function positionLabel(el, screenPos) {
  el.style.left = `${screenPos.x}px`
  el.style.top  = `${screenPos.y - 24}px`
}

/** Show a label at the dot's projected screen position, then fade it out. */
function showDotLabel(overlayEl, scene, dotIndex, title) {
  const sp     = scene.projectToScreen(scene.getDotPosition(dotIndex))
  const labelEl = createLabel(overlayEl, title)
  positionLabel(labelEl, sp)
  gsap.to(labelEl, { opacity: 0.75, duration: 0.4, ease: 'power2.out' })
  gsap.to(labelEl, {
    opacity:  0,
    duration: 0.4,
    delay:    1.8,
    ease:     'power2.in',
    onComplete: () => removeEl(labelEl),
  })
}

/** Draw connection lines from the newest dot to all earlier dots. */
function connectToPrevious(scene, dotIndices) {
  const newest = dotIndices.length - 1
  for (let prev = 0; prev < newest; prev++) {
    const li = scene.connect(prev, newest)
    gsap.to({ v: 0 }, {
      v:        0.18,
      duration: 0.8,
      delay:    prev * 0.07,
      ease:     'power2.out',
      onUpdate: function () { scene.setLineOpacity(li, this.targets()[0].v) },
    })
  }
}

// ── Main sequence ──────────────────────────────────────────────────────────

export function buildGlobeSequence({ scene, overlayEl, onTypeChar, onComplete }) {
  const tl         = gsap.timeline({ paused: true, onComplete })
  const dotIndices = []
  let   cursor     = 0   // absolute seconds — manually tracked

  // Helper: anchor the timeline at an absolute time so tl.duration() is reliable
  const anchor = (t) => tl.to({}, { duration: 0.001 }, t - 0.001)

  // ── Events 1–6: typewriter text box ─────────────────────────────────────

  EVENTS.filter((e) => e.hasTextBox).forEach((event) => {
    const eventStart = cursor
    tl.addLabel(`event${event.id}`, eventStart)

    const typeDuration = event.text.length / 28 + 0.2
    const holdStart    = 0.7 + typeDuration + 0.6
    const morphStart   = holdStart + 0.1
    const connectStart = morphStart + 1.7

    let boxEls = null

    // 1. Create + fade in text box
    tl.call(() => {
      boxEls = createTextBox(overlayEl)
      boxEls.titleEl.textContent = event.title
      gsap.to(boxEls.box, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    }, null, eventStart)

    // 2. Type text body
    tl.call(() => {
      typeText(boxEls.bodyEl, event.text, onTypeChar, 28)
    }, null, eventStart + 0.7)

    // 3. Spawn dot at origin (invisible)
    tl.call(() => {
      dotIndices.push(scene.spawnDotAtScreenCenter())
    }, null, eventStart + holdStart)

    // 4. Morph box out, dot flies to sphere position
    tl.call(() => {
      const di = dotIndices[dotIndices.length - 1]
      const [tx, ty, tz] = event.position

      gsap.to(boxEls.box, { opacity: 0, scale: 0.15, duration: 0.7, ease: 'power3.in',
        onComplete: () => removeEl(boxEls.box) })

      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity:  1,
        duration: 0.4,
        ease:     'power2.out',
        onUpdate() { scene.setDotOpacity(di, proxy.opacity) },
      })
      gsap.to(proxy, {
        x: tx, y: ty, z: tz,
        duration: 1.1,
        delay:    0.35,
        ease:     'power3.inOut',
        onUpdate() { scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z) },
      })
    }, null, eventStart + morphStart)

    // 5. After landing: show label + connect lines
    tl.call(() => {
      const di = dotIndices[dotIndices.length - 1]
      showDotLabel(overlayEl, scene, di, event.title)
      connectToPrevious(scene, dotIndices)
    }, null, eventStart + connectStart)

    // Advance cursor to end of this event
    cursor = eventStart + connectStart + 1.5
    anchor(cursor)
  })

  // ── Events 7–11: dot + label only, one at a time ─────────────────────────

  // Gaps in seconds between consecutive events 7→8, 8→9, 9→10, 10→11, and 11→burst
  const GAPS = [4, 3, 2, 1, 0.5]

  EVENTS.filter((e) => !e.hasTextBox).forEach((event, idx) => {
    const eventStart = cursor
    tl.addLabel(`event${event.id}`, eventStart)

    tl.call(() => {
      dotIndices.push(scene.spawnDotAtScreenCenter())
      const di = dotIndices[dotIndices.length - 1]
      const [tx, ty, tz] = event.position

      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity:  0.9,
        x:        tx,
        y:        ty,
        z:        tz,
        duration: 0.9,
        ease:     'power2.inOut',
        onUpdate() {
          scene.setDotOpacity(di, proxy.opacity)
          scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z)
        },
        onComplete() {
          showDotLabel(overlayEl, scene, di, event.title)
          connectToPrevious(scene, dotIndices)
        },
      })
    }, null, eventStart)

    cursor += GAPS[idx]
    anchor(cursor)
  })

  // ── Final burst ────────────────────────────────────────────────────────

  const BURST_COUNT    = 100
  const BURST_DURATION = 7   // seconds for all dots to fire
  const burstStart     = cursor
  tl.addLabel('burst', burstStart)

  const burstPositions = fibonacciSphere(BURST_COUNT, 1.8)

  for (let i = 0; i < BURST_COUNT; i++) {
    // power curve < 1 → slow start, fast end
    // p ≈ 0.42 gives interval[0] ≈ 1s and interval[end] ≈ 0.03s for n=100, total=7
    const t_norm = i / (BURST_COUNT - 1)
    const delay  = i === 0 ? 0 : BURST_DURATION * Math.pow(t_norm, 0.42)

    tl.call(((pos) => () => {
      const di = scene.spawnBurstDot()
      const [tx, ty, tz] = burstPositions[pos]
      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity:  0.35 + Math.random() * 0.35,
        x:        tx,
        y:        ty,
        z:        tz,
        duration: 0.45 + Math.random() * 0.3,
        ease:     'power2.out',
        onUpdate() {
          scene.setDotOpacity(di, proxy.opacity)
          scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z)
        },
      })
    })(i), null, burstStart + delay)
  }

  // Anchor after burst + a small tail for last dots to finish flying
  const burstEnd = burstStart + BURST_DURATION + 0.8
  anchor(burstEnd)

  // ── Slow globe rotation → handoff ────────────────────────────────────────

  tl.addLabel('rotate', burstEnd)
  tl.to({ angle: 0 }, {
    angle:    0.6,
    duration: 2.5,
    ease:     'power1.inOut',
    onUpdate: function () { scene.rotateGroup(this.targets()[0].angle) },
  }, burstEnd)

  return tl
}
