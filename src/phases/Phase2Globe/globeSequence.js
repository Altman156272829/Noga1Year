/**
 * globeSequence.js — GSAP master timeline for Phase 2.
 *
 * Orchestrates the full "memory globe" sequence:
 *   1. Events 1–6: text box types out → morphs into dot → dot flies to sphere position → lines connect
 *   2. Events 7–11: dot appears with label at sphere position → lines connect
 *   3. Final burst: dozens of tiny dots explode outward with exponential acceleration
 *   4. Globe rotates slowly for ~2s
 *   5. onComplete fires → Phase 3
 *
 * Dependencies:
 *   scene    — GlobeScene instance (Three.js)
 *   overlayEl — DOM element for text box / labels
 *   onTypeChar — called per typed character (AudioEngine.tick)
 *   onComplete — fires when the full sequence is done
 */

import { gsap } from 'gsap'
import EVENTS from '../../core/events.js'

// ── Fibonacci sphere for the burst dots ────────────────────────────────────

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

// ── Text box DOM helpers ────────────────────────────────────────────────────

function createTextBox(overlayEl) {
  const box = document.createElement('div')
  Object.assign(box.style, {
    position:      'absolute',
    top:           '50%',
    left:          '50%',
    transform:     'translate(-50%, -50%)',
    maxWidth:      'min(520px, 88vw)',
    padding:       '2rem 2.5rem',
    border:        '1px solid rgba(200,169,110,0.25)',
    background:    'rgba(0,0,0,0.6)',
    backdropFilter:'blur(4px)',
    borderRadius:  '2px',
    opacity:       '0',
    pointerEvents: 'none',
  })

  const title = document.createElement('p')
  Object.assign(title.style, {
    fontFamily:    'var(--font-serif)',
    fontWeight:    '500',
    fontSize:      'clamp(0.7rem, 2.5vw, 0.9rem)',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color:         'var(--gold-dim)',
    marginBottom:  '0.9rem',
  })

  const body = document.createElement('p')
  Object.assign(body.style, {
    fontFamily:    'var(--font-serif)',
    fontWeight:    '300',
    fontStyle:     'italic',
    fontSize:      'clamp(1.05rem, 3.5vw, 1.4rem)',
    lineHeight:    '1.65',
    letterSpacing: '0.02em',
    color:         'var(--gold)',
    textShadow:    '0 0 20px rgba(200,169,110,0.3)',
  })

  box.appendChild(title)
  box.appendChild(body)
  overlayEl.appendChild(box)
  return { box, title, body }
}

function removeTextBox(box) {
  box.parentNode?.removeChild(box)
}

/**
 * Type text into `el` letter-by-letter, calling onChar per character.
 * Returns a GSAP timeline that you can add to a parent tl at a label.
 */
function typeText(el, text, onChar, charsPerSec = 28) {
  const tl = gsap.timeline()
  tl.call(() => { el.textContent = '' })
  const chars = text.split('')
  chars.forEach((ch, i) => {
    const delay = i / charsPerSec
    tl.call(() => {
      el.textContent += ch
      if (ch !== ' ') onChar()
    }, null, delay)
  })
  return tl
}

// ── Label (events 7–11) ─────────────────────────────────────────────────────

function createLabel(overlayEl, title) {
  const el = document.createElement('p')
  Object.assign(el.style, {
    position:      'absolute',
    fontFamily:    'var(--font-serif)',
    fontWeight:    '400',
    fontSize:      'clamp(0.65rem, 2vw, 0.8rem)',
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
  el.style.top  = `${screenPos.y - 22}px`
}

// ── Main sequence builder ───────────────────────────────────────────────────

export function buildGlobeSequence({ scene, overlayEl, onTypeChar, onComplete }) {
  const tl = gsap.timeline({ paused: true, onComplete })

  const dotIndices = []   // scene dot indices for each event, in order

  // ── Events 1–6: full text box sequence ───────────────────────────────────
  EVENTS.filter((e) => e.hasTextBox).forEach((event, idx) => {
    const label = `event${event.id}`
    tl.addLabel(label)

    // 1. Create text box DOM (deferred to the moment the label fires)
    let boxEls = null

    tl.call(() => {
      boxEls = createTextBox(overlayEl)
      boxEls.title.textContent = event.title
    }, null, label)

    // 2. Fade box in
    tl.to({}, { duration: 0 }, label)  // ensure label exists as a time anchor
    tl.call(() => {
      gsap.to(boxEls.box, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    }, null, `${label}+=0.1`)

    // 3. Type text (body is empty, typed in)
    const typeDelay  = 0.7
    const typeDuration = event.text.length / 28 + 0.2

    tl.call(() => {
      const typeTl = typeText(boxEls.body, event.text, onTypeChar, 28)
      // Insert into *running* tl isn't easy, so we just fire it via call
    }, null, `${label}+=${typeDelay}`)

    // 4. Wait for text to finish typing, then hold briefly
    const holdStart = typeDelay + typeDuration + 0.6

    // 5. Spawn dot at center (invisible)
    tl.call(() => {
      const di = scene.spawnDotAtScreenCenter()
      dotIndices.push(di)
    }, null, `${label}+=${holdStart}`)

    // 6. Shrink/fade text box and fly dot to position simultaneously
    const morphStart = holdStart + 0.1

    tl.call(() => {
      const di = dotIndices[idx]
      const [tx, ty, tz] = event.position

      // Fade box out while dot opacity rises
      gsap.to(boxEls.box, { opacity: 0, scale: 0.15, duration: 0.7, ease: 'power3.in' })

      // Dot fades in at origin
      const dotProxy = { opacity: 0, x: 0, y: 0, z: 0 }
      gsap.to(dotProxy, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onUpdate() { scene.setDotOpacity(di, dotProxy.opacity) },
      })

      // After short delay, dot flies to sphere position
      gsap.to(dotProxy, {
        x: tx, y: ty, z: tz,
        duration: 1.1,
        delay: 0.35,
        ease: 'power3.inOut',
        onUpdate() { scene.setDotWorldPos(di, dotProxy.x, dotProxy.y, dotProxy.z) },
      })

    }, null, `${label}+=${morphStart}`)

    // 7. After dot lands, remove box and draw connections to previous dots
    const connectStart = morphStart + 1.7

    tl.call(() => {
      removeTextBox(boxEls.box)

      // Connect to all previously landed dots
      for (let prev = 0; prev < dotIndices.length - 1; prev++) {
        const li = scene.connect(prev, dotIndices.length - 1)
        gsap.to({ v: 0 }, {
          v: 0.18,
          duration: 0.8,
          delay: prev * 0.08,
          ease: 'power2.out',
          onUpdate: function() { scene.setLineOpacity(li, this.targets()[0].v) },
        })
      }
    }, null, `${label}+=${connectStart}`)

    // 8. Pause before next event
    tl.addLabel(`${label}-end`, `${label}+=${connectStart + 1.0}`)
  })

  // ── Events 7–11: dot + label only ──────────────────────────────────────
  EVENTS.filter((e) => !e.hasTextBox).forEach((event, idx) => {
    const label = `event${event.id}`
    tl.addLabel(label)

    let labelEl = null

    tl.call(() => {
      const di = scene.spawnDotAtScreenCenter()
      dotIndices.push(di)
      const allIdx = dotIndices.length - 1

      const [tx, ty, tz] = event.position
      const dotProxy = { opacity: 0, x: 0, y: 0, z: 0 }

      // Dot fades in and immediately flies to position
      gsap.to(dotProxy, {
        opacity: 0.9,
        x: tx, y: ty, z: tz,
        duration: 0.9,
        ease: 'power2.inOut',
        onUpdate() {
          scene.setDotOpacity(allIdx, dotProxy.opacity)
          scene.setDotWorldPos(allIdx, dotProxy.x, dotProxy.y, dotProxy.z)
        },
        onComplete() {
          // Position label near dot
          const sp = scene.projectToScreen(scene.getDotPosition(allIdx))
          labelEl = createLabel(overlayEl, event.title)
          positionLabel(labelEl, sp)
          gsap.to(labelEl, { opacity: 0.7, duration: 0.5, ease: 'power2.out' })

          // Connect to previous dots
          for (let prev = 0; prev < allIdx; prev++) {
            const li = scene.connect(prev, allIdx)
            gsap.to({ v: 0 }, {
              v: 0.15,
              duration: 0.7,
              delay: prev * 0.06,
              ease: 'power2.out',
              onUpdate: function() { scene.setLineOpacity(li, this.targets()[0].v) },
            })
          }

          // Fade label out after a moment
          gsap.to(labelEl, { opacity: 0, duration: 0.4, delay: 1.6, ease: 'power2.in',
            onComplete: () => labelEl?.parentNode?.removeChild(labelEl) })
        },
      })
    }, null, label)

    tl.addLabel(`${label}-end`, `${label}+=2.5`)
  })

  // ── Final burst ────────────────────────────────────────────────────────
  const BURST_COUNT = 60
  const burstLabel  = 'burst'
  const burstPositions = fibonacciSphere(BURST_COUNT, 1.8)

  tl.addLabel(burstLabel)

  tl.call(() => {
    const burstIndices = []

    for (let i = 0; i < BURST_COUNT; i++) {
      const di = scene.spawnBurstDot()
      burstIndices.push(di)
    }

    // Exponential acceleration: each successive dot spawns faster and travels faster
    for (let i = 0; i < BURST_COUNT; i++) {
      const di     = burstIndices[i]
      const [tx, ty, tz] = burstPositions[i]

      // Exponential delay: first dots are slow, last are fast
      // Total window: 7 seconds; delay from 0..6s mapped exponentially
      const t_norm = i / (BURST_COUNT - 1)          // 0..1
      const delay  = (Math.pow(t_norm, 0.3)) * 5.5  // fast start, compress toward end

      const speed = 0.4 + (1 - t_norm) * 1.2        // faster early, slower late
      const dur   = Math.max(0.5, speed)

      const proxy = { opacity: 0, x: 0, y: 0, z: 0 }

      gsap.to(proxy, {
        opacity: 0.55 + Math.random() * 0.35,
        x: tx, y: ty, z: tz,
        duration: dur,
        delay,
        ease: 'power2.out',
        onUpdate() {
          scene.setDotOpacity(di, proxy.opacity)
          scene.setDotWorldPos(di, proxy.x, proxy.y, proxy.z)
        },
      })
    }
  }, null, burstLabel)

  // Wait for burst to complete (about 7s total)
  tl.addLabel('burst-end', `${burstLabel}+=7.5`)

  // ── Slow globe rotation ────────────────────────────────────────────────
  tl.addLabel('rotate', 'burst-end')

  tl.to({ angle: 0 }, {
    angle: 0.6,
    duration: 2.5,
    ease: 'power1.inOut',
    onUpdate: function() { scene.rotateGroup(this.targets()[0].angle) },
  }, 'rotate')

  tl.addLabel('done', 'rotate+=2.8')

  return tl
}
