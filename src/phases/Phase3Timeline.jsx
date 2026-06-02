import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import PlaybackController from '../core/PlaybackController.js'

/**
 * Phase3Timeline — "The Timeline".
 *
 * A cinematic PASSAGE OF TIME, not a menu. A single thin golden line runs across
 * the screen at vertical center; a thin golden playhead sweeps left→right while a
 * large serif date (year above the line, month below) counts through the months.
 * The playhead accelerates through empty stretches and decelerates to a FULL STOP
 * on the date of each of the 5 full scenes — where it pulses, fades to black, and
 * hands the scene off to App (which mounts the real Three.js scene on top). When
 * the scene ends App resumes this timeline and the sweep continues to today.
 *
 * Architecture: ONE GSAP master timeline wrapped in a PlaybackController (tap /
 * click / spacebar pause-resume). At each scene date a `tl.call` pauses the master
 * timeline and calls `onEnterScene(id)`; App later calls controller.play() to
 * resume (the very next beat is the fade-from-black). Built with the explicit
 * `cursor` + `anchor()` discipline from globeSequence.js so tl.duration() stays
 * reliable across zero-duration tl.call() entries.
 *
 * Props:
 *   onComplete     — timeline reached today → closing phase
 *   onEnterScene   — (sceneId) => void; App mounts the scene overlay
 *   setController  — registers the PlaybackController with App
 */

// ── Calendar config ──────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// Story starts Feb 2025 (month index 1, 0-based).
const START_Y = 2025
const START_M = 1

// End = today's month (computed live so the line always reaches "now").
function endMonthIndex() {
  const now = new Date()
  return (now.getFullYear() - START_Y) * 12 + (now.getMonth() - START_M)
}

// The 5 full scenes — the dates where the playhead STOPS. monthIndex is relative
// to Feb 2025 (=0). Scene 1 sits at the very start → it triggers on arrival.
const SCENES = [
  { id: 1, monthIndex: 0, title: 'The First Meeting' },          // Feb 2025
  { id: 2, monthIndex: 1, title: 'First Date' },                 // Mar 2025
  { id: 3, monthIndex: 3, title: 'Karting + We Became Official' },// May 2025
  { id: 4, monthIndex: 4, title: 'First Kiss' },                 // Jun 2025
  { id: 5, monthIndex: 5, title: 'The Sea' },                    // Jul 2025
]

function yearOf(i)  { return START_Y + Math.floor((START_M + i) / 12) }
function monthOf(i) { return MONTHS[(START_M + i) % 12] }

export default function Phase3Timeline({ onComplete, onEnterScene, setController }) {
  const rootRef     = useRef(null)
  const particleRef = useRef(null)
  const lineRef     = useRef(null)
  const playheadRef = useRef(null)
  const yearRef     = useRef(null)
  const monthRef    = useRef(null)
  const blackRef    = useRef(null)

  useEffect(() => {
    const lineEl     = lineRef.current
    const playheadEl = playheadRef.current
    const yearEl     = yearRef.current
    const monthEl    = monthRef.current
    const blackEl    = blackRef.current
    const particleC  = particleRef.current
    if (!lineEl || !playheadEl || !particleC) return

    const monthsTotal = Math.max(endMonthIndex(), SCENES[SCENES.length - 1].monthIndex + 1)

    // ── Geometry (read viewport once; matches the no-resize approach of other phases)
    const W       = window.innerWidth
    const leftPad = W * 0.08
    const rightPad = W * 0.08
    const range   = Math.max(W - leftPad - rightPad, 1)
    const monthX  = (m) => leftPad + (m / monthsTotal) * range

    // ── Ambient drifting particles (lightweight DOM dots — Phase-1 shimmer style)
    const particleTweens = []
    const PARTICLE_COUNT = 26
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const dot = document.createElement('div')
      const size = 2 + Math.random() * 2.5
      Object.assign(dot.style, {
        position:     'absolute',
        left:         `${Math.random() * 100}%`,
        top:          `${Math.random() * 100}%`,
        width:        `${size}px`,
        height:       `${size}px`,
        borderRadius: '50%',
        background:   'var(--gold)',
        boxShadow:    '0 0 6px rgba(200,169,110,0.6)',
        opacity:      `${0.08 + Math.random() * 0.28}`,
        pointerEvents: 'none',
      })
      particleC.appendChild(dot)
      // Slow independent drift + opacity flicker
      particleTweens.push(gsap.to(dot, {
        x:        (Math.random() * 2 - 1) * 40,
        y:        (Math.random() * 2 - 1) * 40,
        opacity:  0.08 + Math.random() * 0.3,
        duration: 6 + Math.random() * 6,
        ease:     'sine.inOut',
        repeat:   -1,
        yoyo:     true,
        delay:    Math.random() * 4,
      }))
    }

    // ── Date display helper (year above line / month below) ──────────────────
    let lastMonth = -1
    const setDate = (mi) => {
      if (mi === lastMonth) return
      lastMonth = mi
      yearEl.textContent  = String(yearOf(mi))
      monthEl.textContent = monthOf(mi)
      // Robust crossfade: text is already correct; pulse opacity (kills only the
      // opacity tween so rapid month-crossings during fast sweeps never pile up).
      gsap.killTweensOf([yearEl, monthEl], 'opacity')
      gsap.fromTo([yearEl, monthEl],
        { opacity: 0.35 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' })
    }

    // Playhead follows the eased month-float
    const pp = { m: 0 }
    const updatePlayhead = () => {
      playheadEl.style.transform = `translateX(${monthX(pp.m)}px)`
    }

    // Initial DOM state
    playheadEl.style.transform = `translateX(${monthX(0)}px)`
    yearEl.textContent  = String(yearOf(0))
    monthEl.textContent = monthOf(0)
    lastMonth = 0
    lineEl.style.transform = 'scaleX(0)'
    gsap.set([playheadEl, yearEl, monthEl], { opacity: 0 })
    gsap.set(blackEl, { opacity: 0 })

    // ── Master timeline ──────────────────────────────────────────────────────
    const tl = gsap.timeline({ paused: true, onComplete })
    let cursor = 0
    const anchor = (t) => tl.to({}, { duration: 0.001 }, t - 0.001)

    // Arrival pulse: scale + glow on the date, used at every stop
    const pulseDate = (pos) => {
      const glow = { b: 1 }
      const applyGlow = () => {
        const f = `brightness(${glow.b})`
        yearEl.style.filter = f
        monthEl.style.filter = f
      }
      tl.to([yearEl, monthEl], { scale: 1.14, duration: 0.5, ease: 'power2.out' }, pos)
      tl.to(glow, { b: 1.7, duration: 0.5, ease: 'power2.out', onUpdate: applyGlow }, pos)
      tl.to([yearEl, monthEl], { scale: 1, duration: 0.7, ease: 'power2.inOut' }, pos + 0.5)
      tl.to(glow, { b: 1, duration: 0.7, ease: 'power2.inOut', onUpdate: applyGlow }, pos + 0.5)
    }

    const sweepDur = (dist) => Math.min(2.0 + Math.abs(dist) * 0.7, 5.5)

    // 1. Intro: draw the line, fade in playhead + date
    tl.to(lineEl, { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }, 0)
    tl.to([playheadEl, yearEl, monthEl], { opacity: 1, duration: 1.0, ease: 'power2.out' }, 0.4)
    cursor = 1.7
    anchor(cursor)

    // 2. Scene stops (in chronological order)
    let from = 0
    SCENES.forEach((scene, idx) => {
      const target = scene.monthIndex

      // Sweep the playhead to this scene's month (scene 1 is at the start → none)
      if (idx > 0) {
        const dur = sweepDur(target - from)
        tl.to(pp, {
          m: target,
          duration: dur,
          ease: 'power2.inOut',
          onUpdate: () => { updatePlayhead(); setDate(Math.round(pp.m)) },
        }, cursor)
        cursor += dur
        anchor(cursor)
      }

      // Arrive: lock the exact month, pulse, hold
      tl.call(() => setDate(target), null, cursor)
      pulseDate(cursor)
      cursor += 1.2 + 0.4   // pulse + hold

      // Fade to black, then pause + hand the scene off to App
      tl.to(blackEl, { opacity: 1, duration: 0.8, ease: 'power2.inOut' }, cursor)
      cursor += 0.8
      tl.call(() => { tl.pause(); onEnterScene(scene.id) }, null, cursor)
      anchor(cursor)

      // Fade from black — runs first thing when App resumes the timeline
      cursor += 0.001
      tl.to(blackEl, { opacity: 0, duration: 1.0, ease: 'power2.out' }, cursor)
      cursor += 1.0
      anchor(cursor)

      from = target
    })

    // 3. Final stretch: sweep through to today (past the non-scene months), stop
    {
      const dur = 6.0
      tl.to(pp, {
        m: monthsTotal,
        duration: dur,
        ease: 'power2.inOut',
        onUpdate: () => { updatePlayhead(); setDate(Math.round(pp.m)) },
      }, cursor)
      cursor += dur
      anchor(cursor)

      tl.call(() => setDate(monthsTotal), null, cursor)
      pulseDate(cursor)
      cursor += 1.2 + 1.6   // pulse + a final lingering hold
      anchor(cursor)
    }

    // Fade in from black, then start
    gsap.fromTo(rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.0, ease: 'power2.out', onComplete: () => tl.play() })

    const ctrl = new PlaybackController(tl)
    setController(ctrl)

    return () => {
      ctrl.dispose()
      particleTweens.forEach((t) => t.kill())
      gsap.killTweensOf([yearEl, monthEl])
      while (particleC.firstChild) particleC.removeChild(particleC.firstChild)
    }
  }, []) // eslint-disable-line

  const dateStyle = {
    position:      'absolute',
    left:          0,
    right:         0,
    textAlign:     'center',
    fontFamily:    'var(--font-serif)',
    fontWeight:    300,
    fontSize:      'clamp(2.2rem, 9vw, 5rem)',
    letterSpacing: '0.32em',
    color:         'var(--gold)',
    textShadow:    '0 0 24px rgba(200,169,110,0.55), 0 0 56px rgba(200,169,110,0.25)',
    pointerEvents: 'none',
    willChange:    'transform, opacity, filter',
  }

  return (
    <div
      ref={rootRef}
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
    >
      {/* Ambient drifting particles (behind everything) */}
      <div ref={particleRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* The golden line at vertical center */}
      <div
        ref={lineRef}
        style={{
          position:        'absolute',
          top:             '50%',
          left:            0,
          width:           '100%',
          height:          '1px',
          background:      'var(--gold)',
          boxShadow:       '0 0 12px rgba(200,169,110,0.7)',
          transformOrigin: 'left center',
          opacity:         0.85,
        }}
      />

      {/* The playhead — a thin full-height vertical marker, moved with GSAP x */}
      <div
        ref={playheadRef}
        style={{
          position:   'absolute',
          top:        0,
          left:       0,
          width:      '2px',
          height:     '100%',
          background: 'var(--gold-bright)',
          boxShadow:  '0 0 16px rgba(232,201,126,0.9), 0 0 40px rgba(200,169,110,0.5)',
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      />

      {/* Date — year above the line, month below */}
      <div ref={yearRef}  style={{ ...dateStyle, top: 'calc(50% - 8.5rem)' }} />
      <div ref={monthRef} style={{ ...dateStyle, top: 'calc(50% + 3.5rem)' }} />

      {/* Fade-to-black overlay (tweened on the master timeline) */}
      <div
        ref={blackRef}
        style={{ position: 'absolute', inset: 0, background: '#000', pointerEvents: 'none', opacity: 0 }}
      />
    </div>
  )
}
