import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import PlaybackController from '../core/PlaybackController.js'

/**
 * ScenePlaceholder — generic stand-in for the not-yet-built full scenes (2–5).
 *
 * Phase 3's timeline stops on each scene date and hands off to App, which mounts
 * the real Three.js scene for id=1 (Phase4Scene1) and this placeholder for the
 * rest. It starts on black (continuous with the timeline's fade-to-black), fades
 * in an elegant title card, holds, fades back to black, then calls onComplete so
 * App resumes the timeline. A tiny GSAP timeline wrapped in a PlaybackController
 * keeps tap / click / spacebar pause-resume consistent with every other phase.
 *
 * Props: { sceneId, title, onComplete, setController }
 */
export default function ScenePlaceholder({ sceneId, title, onComplete, setController }) {
  const contentRef = useRef(null)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    gsap.set(content, { opacity: 0 })

    const tl = gsap.timeline({ paused: true, onComplete })
    tl.to(content, { opacity: 1, duration: 1.2, ease: 'power2.out' })
    tl.to(content, { opacity: 1, duration: 2.6 })            // hold
    tl.to(content, { opacity: 0, duration: 1.0, ease: 'power2.in' })

    const ctrl = new PlaybackController(tl)
    setController(ctrl)
    tl.play()

    return () => ctrl.dispose()
  }, []) // eslint-disable-line

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#000',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div ref={contentRef} style={{ textAlign: 'center', padding: '0 2rem' }}>
        <p
          style={{
            fontFamily:    'var(--font-serif)',
            fontWeight:    500,
            fontSize:      'clamp(0.7rem, 2.5vw, 0.9rem)',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color:         'var(--gold-dim)',
            marginBottom:  '1.1rem',
          }}
        >
          {`Scene ${sceneId}`}
        </p>
        <p
          style={{
            fontFamily:    'var(--font-serif)',
            fontWeight:    300,
            fontSize:      'clamp(1.8rem, 7vw, 3.6rem)',
            letterSpacing: '0.12em',
            color:         'var(--gold)',
            textShadow:    '0 0 24px rgba(200,169,110,0.5), 0 0 56px rgba(200,169,110,0.22)',
            marginBottom:  '1.6rem',
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily:    'var(--font-serif)',
            fontWeight:    300,
            fontStyle:     'italic',
            fontSize:      'clamp(0.8rem, 2.5vw, 1rem)',
            letterSpacing: '0.3em',
            color:         'rgba(200,169,110,0.4)',
            textTransform: 'lowercase',
          }}
        >
          — coming soon —
        </p>
      </div>
    </div>
  )
}
