import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import PlaybackController from '../core/PlaybackController.js'

/**
 * Phase1Opening — The cinematic title card sequence.
 *
 * Timeline:
 *   0.0s  "One Year Together" fades + rises in, gold glow, particle shimmer
 *   1.8s  Title reaches full opacity — hold ~3s
 *   4.8s  Title dissolves out
 *   6.0s  "Infinite Memories" fades + rises in the same way
 *   7.8s  Hold ~3s
 *  10.8s  Dissolves out
 *  12.0s  onComplete fires → Phase 2
 *
 * Particles: 18 small canvas dots positioned around the title text,
 * each drifting outward and fading — gives the shimmer halo effect.
 */

const PARTICLE_COUNT = 18

function createParticles(container, titleEl) {
  if (!titleEl || !container) return []
  const rect = titleEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top  + rect.height / 2

  const particles = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const dot = document.createElement('div')
    const size = 2 + Math.random() * 2.5
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const startR = rect.width * 0.35 + Math.random() * rect.width * 0.2
    const x = cx + Math.cos(angle) * startR
    const y = cy + Math.sin(angle) * startR * 0.5

    Object.assign(dot.style, {
      position:        'fixed',
      width:           `${size}px`,
      height:          `${size}px`,
      borderRadius:    '50%',
      background:      'var(--gold-bright)',
      boxShadow:       `0 0 ${size * 2}px var(--gold-bright)`,
      left:            `${x}px`,
      top:             `${y}px`,
      transform:       'translate(-50%, -50%)',
      opacity:         '0',
      pointerEvents:   'none',
      zIndex:          '10',
    })
    container.appendChild(dot)
    particles.push({ el: dot, angle, startR, cx, cy })
  }
  return particles
}

function animateParticlesIn(particles, tl, labelName) {
  particles.forEach((p, i) => {
    const delay = i * 0.05
    const driftR = p.startR + 18 + Math.random() * 24
    const driftX = p.cx + Math.cos(p.angle) * driftR
    const driftY = p.cy + Math.sin(p.angle) * driftR * 0.5

    tl.to(
      p.el,
      {
        opacity: 0.5 + Math.random() * 0.4,
        left:    `${driftX}px`,
        top:     `${driftY}px`,
        duration: 1.1,
        ease:    'power2.out',
      },
      `${labelName}+=${0.2 + delay}`
    )
  })
}

function animateParticlesOut(particles) {
  particles.forEach((p) => {
    gsap.to(p.el, { opacity: 0, duration: 0.6, ease: 'power2.in' })
  })
}

function removeParticles(particles) {
  particles.forEach((p) => p.el.parentNode?.removeChild(p.el))
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Phase1Opening({ onComplete, setController }) {
  const containerRef = useRef(null)
  const title1Ref    = useRef(null)
  const title2Ref    = useRef(null)
  const ctrlRef      = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const t1 = title1Ref.current
    const t2 = title2Ref.current
    if (!container || !t1 || !t2) return

    // Set initial state
    gsap.set([t1, t2], { opacity: 0, y: 28 })

    const tl = gsap.timeline({ paused: true, onComplete })

    // ── Card 1: "One Year Together" ────────────────────────────────
    tl.addLabel('card1')

    // rise 1.2s — tighter than the original 2s
    tl.to(t1, {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power2.out',
    }, 'card1')

    // Particles — spawn just after rise begins
    let p1 = []
    tl.call(() => {
      p1 = createParticles(container, t1)
      animateParticlesIn(p1, tl, 'card1')
    }, null, 'card1+=0.1')

    // Hold 1.6s after rise (card1+=1.2 is when fully visible)
    tl.addLabel('card1-hold', 'card1+=1.2')

    // Dissolve at card1+=2.8 (1.2 rise + 1.6 hold)
    tl.addLabel('card1-out', 'card1+=2.8')
    tl.to(t1, { opacity: 0, duration: 0.7, ease: 'power2.in' }, 'card1-out')
    tl.call(() => animateParticlesOut(p1), null, 'card1-out')
    tl.call(() => removeParticles(p1), null, 'card1-out+=0.75')

    // ── Card 2: "Infinite Memories" ────────────────────────────────
    // card1-out is t=2.8; dissolve takes 0.7s → done at t=3.5; gap 0.3s → card2 at t=3.8
    tl.addLabel('card2', 'card1-out+=1.0')

    tl.to(t2, {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power2.out',
    }, 'card2')

    let p2 = []
    tl.call(() => {
      p2 = createParticles(container, t2)
      animateParticlesIn(p2, tl, 'card2')
    }, null, 'card2+=0.1')

    tl.addLabel('card2-hold', 'card2+=1.2')

    // Dissolve at card2+=2.8 → total Phase 1 ≈ 3.8 + 2.8 = 6.6s dissolve start, done at 7.3s
    tl.addLabel('card2-out', 'card2+=2.8')
    tl.to(t2, { opacity: 0, duration: 0.7, ease: 'power2.in' }, 'card2-out')
    tl.call(() => animateParticlesOut(p2), null, 'card2-out')
    tl.call(() => removeParticles(p2), null, 'card2-out+=0.75')

    // Short black before Phase 2 — onComplete fires at ~7.6s total
    tl.addLabel('end', 'card2-out+=1.0')

    // ── PlaybackController ──────────────────────────────────────────
    const ctrl = new PlaybackController(tl)
    ctrlRef.current = ctrl
    setController(ctrl)
    tl.play()

    return () => {
      ctrl.dispose()
      removeParticles(p1)
      removeParticles(p2)
    }
  }, []) // eslint-disable-line

  return (
    <div
      ref={containerRef}
      className="layer"
      style={{
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Title 1 */}
      <h1
        ref={title1Ref}
        style={{
          position:   'absolute',
          fontFamily: 'var(--font-serif)',
          fontWeight: 300,
          fontSize:   'clamp(2rem, 7vw, 5rem)',
          letterSpacing: '0.18em',
          color:      'var(--gold)',
          textAlign:  'center',
          lineHeight: 1.2,
          padding:    '0 1.5rem',
          opacity:    0,
          textShadow: `
            0 0 30px rgba(200, 169, 110, 0.9),
            0 0 60px rgba(200, 169, 110, 0.5),
            0 0 120px rgba(200, 169, 110, 0.25)
          `,
        }}
      >
        One Year Together
      </h1>

      {/* Title 2 */}
      <h1
        ref={title2Ref}
        style={{
          position:   'absolute',
          fontFamily: 'var(--font-serif)',
          fontWeight: 300,
          fontSize:   'clamp(2rem, 7vw, 5rem)',
          letterSpacing: '0.18em',
          color:      'var(--gold)',
          textAlign:  'center',
          lineHeight: 1.2,
          padding:    '0 1.5rem',
          opacity:    0,
          textShadow: `
            0 0 30px rgba(200, 169, 110, 0.9),
            0 0 60px rgba(200, 169, 110, 0.5),
            0 0 120px rgba(200, 169, 110, 0.25)
          `,
        }}
      >
        Infinite Memories
      </h1>
    </div>
  )
}
