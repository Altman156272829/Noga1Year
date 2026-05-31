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
    const delay = i * 0.06
    const driftR = p.startR + 20 + Math.random() * 30
    const driftX = p.cx + Math.cos(p.angle) * driftR
    const driftY = p.cy + Math.sin(p.angle) * driftR * 0.5

    tl.to(
      p.el,
      {
        opacity: 0.5 + Math.random() * 0.4,
        left:    `${driftX}px`,
        top:     `${driftY}px`,
        duration: 1.6,
        ease:    'power2.out',
      },
      `${labelName}+=${0.3 + delay}`
    )
  })
}

function animateParticlesOut(particles, tl, labelName) {
  particles.forEach((p) => {
    tl.to(
      p.el,
      { opacity: 0, duration: 0.8, ease: 'power2.in' },
      labelName
    )
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

    tl.to(t1, {
      opacity: 1,
      y: 0,
      duration: 2,
      ease: 'power2.out',
    }, 'card1')

    // Particles for card 1 — created after a tiny delay so getBoundingClientRect is valid
    let p1 = []
    tl.call(() => {
      p1 = createParticles(container, t1)
      animateParticlesIn(p1, tl, 'card1')
    }, null, 'card1+=0.1')

    // Hold ~3 seconds at full opacity
    tl.addLabel('card1-hold', 'card1+=2.0')

    // Dissolve out at card1+=5.0 (2s rise + 3s hold)
    tl.addLabel('card1-out', 'card1+=5.0')
    tl.to(t1, { opacity: 0, duration: 1.2, ease: 'power2.in' }, 'card1-out')
    tl.call(() => animateParticlesOut(p1, tl, 'card1-out'), null, 'card1-out')
    tl.call(() => removeParticles(p1), null, 'card1-out+=1.3')

    // ── Card 2: "Infinite Memories" ────────────────────────────────
    tl.addLabel('card2', 'card1-out+=1.4')

    tl.to(t2, {
      opacity: 1,
      y: 0,
      duration: 2,
      ease: 'power2.out',
    }, 'card2')

    let p2 = []
    tl.call(() => {
      p2 = createParticles(container, t2)
      animateParticlesIn(p2, tl, 'card2')
    }, null, 'card2+=0.1')

    tl.addLabel('card2-hold', 'card2+=2.0')

    // Dissolve out
    tl.addLabel('card2-out', 'card2+=5.0')
    tl.to(t2, { opacity: 0, duration: 1.2, ease: 'power2.in' }, 'card2-out')
    tl.call(() => animateParticlesOut(p2, tl, 'card2-out'), null, 'card2-out')
    tl.call(() => removeParticles(p2), null, 'card2-out+=1.3')

    // Short black pause before Phase 2
    tl.addLabel('end', 'card2-out+=1.5')

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
