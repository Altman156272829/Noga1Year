/**
 * globeSequence.js — GSAP master timeline for Phase 2.
 *
 * Sequence:
 *   Events 1–6   typewriter text box → dot flies to sphere → permanent label → lines connect
 *   Events 7–11  dot flies directly → permanent label → lines connect
 *                Decreasing gaps between events: 4s / 3s / 2s / 1s / 0.5s
 *   Burst        1000 tiny dots explode onto the globe, one tl.call() each
 *                Timing: burstStart + 7 * (i/999)^0.3  (slow start ~1/s → fast end ~500/s)
 *                Simultaneous with the burst:
 *                  • camera pulls back (z 6→16) — "zoom out to the universe"
 *                  • named dot materials shrink (0.22→0.055)
 *                  • label DOM elements scale down (1→0.25)
 *                  • globe rotates slowly (0→0.3 rad)
 *   Hold         2s at full expanded view
 *   onComplete   → Phase 3
 *
 * LABELS: once visible, labels stay permanently. They are tracked in `labelEls`
 * so they can be shrunk during the burst zoom-out.
 *
 * TIMING: `cursor` is an explicit absolute-second variable. A tiny anchor tween
 * (duration 0.001 s) is inserted after each event to keep tl.duration() reliable
 * when events consist only of tl.call() (zero-duration) entries.
 */

import { gsap } from 'gsap'
import EVENTS from '../../core/events.js'

// ── Fibonacci sphere ────────────────────────────────────────────────────────

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

// ── Text box DOM (events 1–6) ──────────────────────────────────────────────

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

function removeEl(el) { el?.parentNode?.removeChild(el) }

function typeText(el, text, onChar, charsPerSec = 28) {
  el.textContent = ''
  text.split('').forEach((ch, i) => {
    gsap.delayedCall(i / charsPerSec, () => {
      el.textContent += ch
      if (ch !== ' ') onChar()
    })
  })
}

// ── Dot label ──────────────────────────────────────────────────────────────

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
    // transform-origin must stay at center so CSS scale() shrinks toward center
    transform:     'translate(-50%, -50%)',
  })
  el.textContent = title
  overlayEl.appendChild(el)
  return el
}

function positionLabel(el, sp) {
  el.style.left = `${sp.x}px`
  el.style.top  = `${sp.y - 24}px`
}

/**
 * Show a label at the dot's projected screen position.
 * Labels NEVER fade out — they stay permanently.
 * The element is pushed to `labelEls` so it can be shrunk during burst.
 */
function showDotLabel(overlayEl, scene, dotIndex, title, labelEls) {
  const sp      = scene.projectToScreen(scene.getDotPosition(dotIndex))
  const labelEl = createLabel(overlayEl, title)
  positionLabel(labelEl, sp)
  gsap.to(labelEl, { opacity: 0.75, duration: 0.4, ease: 'power2.out' })
  labelEls.push(labelEl)
}

// ── Connection lines ────────────────────────────────────────────────────────

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
  const labelEls   = []   // all permanent label DOM elements
  let   cursor     = 0   // absolute seconds, manually tracked

  // Anchor: insert a tiny tween so tl.duration() reliably reflects `t`
  const anchor = (t) => tl.to({}, { duration: 0.001 }, t - 0.001)

  // ── Events 1–6: typewriter sequence ─────────────────────────────────────

  EVENTS.filter((e) => e.hasTextBox).forEach((event) => {
    const es = cursor   // event start (absolute seconds)
    tl.addLabel(`event${event.id}`, es)

    const typeDur    = event.text.length / 28 + 0.2
    const holdStart  = 0.7 + typeDur + 0.6
    const morphStart = holdStart + 0.1
    const connStart  = morphStart + 1.7

    let boxEls = null

    tl.call(() => {
      boxEls = createTextBox(overlayEl)
      boxEls.titleEl.textContent = event.title
      gsap.to(boxEls.box, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    }, null, es)

    tl.call(() => {
      typeText(boxEls.bodyEl, event.text, onTypeChar, 28)
    }, null, es + 0.7)

    tl.call(() => {
      dotIndices.push(scene.spawnDotAtScreenCenter())
    }, null, es + holdStart)

    tl.call(() => {
      const di           = dotIndices[dotIndices.length - 1]
      const [tx, ty, tz] = event.position

      gsap.to(boxEls.box, {
        opacity: 0, scale: 0.15, duration: 0.7, ease: 'power3.in',
        onComplete: () => removeEl(boxEls.box),
      })

      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity:  1, duration: 0.4, ease: 'power2.out',
        onUpdate() { scene.setDotOpacity(di, proxy.opacity) },
      })
      gsap.to(proxy, {
        x: tx, y: ty, z: tz, duration: 1.1, delay: 0.35, ease: 'power3.inOut',
        onUpdate() { scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z) },
      })
    }, null, es + morphStart)

    tl.call(() => {
      const di = dotIndices[dotIndices.length - 1]
      showDotLabel(overlayEl, scene, di, event.title, labelEls)
      connectToPrevious(scene, dotIndices)
    }, null, es + connStart)

    cursor = es + connStart + 1.5
    anchor(cursor)
  })

  // ── Events 7–11: dot-only, one at a time with decreasing gaps ────────────
  // Gaps (seconds) between each event start and the next:

  const GAPS = [4, 3, 2, 1, 0.5]

  EVENTS.filter((e) => !e.hasTextBox).forEach((event, idx) => {
    const es = cursor
    tl.addLabel(`event${event.id}`, es)

    tl.call(() => {
      dotIndices.push(scene.spawnDotAtScreenCenter())
      const di           = dotIndices[dotIndices.length - 1]
      const [tx, ty, tz] = event.position

      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity: 0.9, x: tx, y: ty, z: tz, duration: 0.9, ease: 'power2.inOut',
        onUpdate() {
          scene.setDotOpacity(di, proxy.opacity)
          scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z)
        },
        onComplete() {
          showDotLabel(overlayEl, scene, di, event.title, labelEls)
          connectToPrevious(scene, dotIndices)
        },
      })
    }, null, es)

    cursor += GAPS[idx]
    anchor(cursor)
  })

  // ── Final burst ────────────────────────────────────────────────────────

  const BURST_COUNT    = 1000
  const BURST_DURATION = 7      // seconds for all 1000 dots to fire
  const burstStart     = cursor

  tl.addLabel('burst', burstStart)

  // Pre-allocate the buffer geometry for all 1000 burst dots
  tl.call(() => scene.initBurstSystem(BURST_COUNT), null, burstStart)

  // Pre-compute all 1000 sphere positions
  const burstPositions = fibonacciSphere(BURST_COUNT, 1.8)

  // Schedule each dot with power-curve timing.
  // delay[i] = BURST_DURATION * (i/999)^0.3
  //   • At i=1:   delay ≈ 0.88 s  → ~1.1 dots/s at the start
  //   • At i=500: delay ≈ 5.68 s
  //   • At i=999: delay = 7.0 s   → interval[999] ≈ 0.0021 s → ~476 dots/s at peak
  for (let i = 0; i < BURST_COUNT; i++) {
    const t_norm = i / (BURST_COUNT - 1)
    const delay  = i === 0 ? 0 : BURST_DURATION * Math.pow(t_norm, 0.3)

    tl.call(((idx) => () => {
      const [tx, ty, tz] = burstPositions[idx]
      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(proxy, {
        opacity:  0.25 + Math.random() * 0.35,
        x: tx, y: ty, z: tz,
        duration: 0.3 + Math.random() * 0.25,
        ease:     'power2.out',
        onUpdate() {
          scene.setBurstDotPos(idx, proxy.x, proxy.y, proxy.z)
          scene.setBurstDotOpacity(idx, proxy.opacity)
        },
      })
    })(i), null, burstStart + delay)
  }

  // ── Zoom-out + shrink animations (run alongside the burst) ─────────────
  // All three tweens are added to the MASTER timeline so pause/play works.

  // 1. Camera pulls back: z 6 → 16 ("zoom out to the universe")
  const camProxy = { z: 6 }
  tl.to(camProxy, {
    z:        16,
    duration: BURST_DURATION,
    ease:     'power2.in',
    onUpdate: () => scene.setCameraZ(camProxy.z),
  }, burstStart)

  // 2. Named dots shrink: material.size 0.22 → 0.055
  const dotSizeProxy = { s: 0.22 }
  tl.to(dotSizeProxy, {
    s:        0.055,
    duration: BURST_DURATION,
    ease:     'power2.in',
    onUpdate: () => scene.setNamedDotSize(dotSizeProxy.s),
  }, burstStart)

  // 3. DOM labels scale down: scale 1 → 0.25 ("labels become hard to read")
  const labelScaleProxy = { v: 1 }
  tl.to(labelScaleProxy, {
    v:        0.25,
    duration: BURST_DURATION,
    ease:     'power2.in',
    onUpdate() {
      const s = labelScaleProxy.v
      labelEls.forEach((el) => {
        if (el?.parentNode) el.style.transform = `translate(-50%, -50%) scale(${s})`
      })
    },
  }, burstStart)

  // 4. Slow globe rotation during burst — adds dynamism to the zoom-out
  const rotProxy = { a: 0 }
  tl.to(rotProxy, {
    a:        0.35,
    duration: BURST_DURATION,
    ease:     'none',
    onUpdate: () => scene.rotateGroup(rotProxy.a),
  }, burstStart)

  // ── Hold 2s after burst, then onComplete → Phase 3 ─────────────────────
  const burstEnd = burstStart + BURST_DURATION + 0.8   // tail for last dots to settle
  const holdEnd  = burstEnd + 2
  anchor(holdEnd)

  return tl
}
