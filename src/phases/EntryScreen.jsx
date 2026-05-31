import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import AudioEngine from '../audio/AudioEngine.js'

/**
 * EntryScreen — Pure black with a single faint, slowly-pulsing serif prompt.
 * One tap / click / spacebar:
 *   1. Unlocks Web Audio
 *   2. Fades the prompt out
 *   3. Calls onComplete → App advances to PHASE1
 */
export default function EntryScreen({ onComplete }) {
  const promptRef = useRef(null)
  const doneRef   = useRef(false)

  useEffect(() => {
    const el = promptRef.current
    if (!el) return

    // Gentle pulse: opacity cycles 0.15 → 0.45 → 0.15 on a 3s loop
    const pulse = gsap.to(el, {
      opacity: 0.45,
      duration: 1.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 0.8,
    })

    // Start at low opacity
    gsap.set(el, { opacity: 0.15 })

    return () => {
      pulse.kill()
    }
  }, [])

  const handleEnter = () => {
    if (doneRef.current) return
    doneRef.current = true

    AudioEngine.unlock()

    const el = promptRef.current
    gsap.killTweensOf(el)
    gsap.to(el, {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.in',
      onComplete,
    })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleEnter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line

  return (
    <div
      className="layer"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        cursor: 'pointer',
      }}
      onPointerDown={handleEnter}
    >
      <p
        ref={promptRef}
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
          letterSpacing: '0.35em',
          color: 'var(--gold-dim)',
          textTransform: 'lowercase',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      >
        touch to begin
      </p>
    </div>
  )
}
