import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import SchoolScene from './SchoolScene.js'
import { buildScene1Sequence } from './scene1Sequence.js'
import PlaybackController from '../../core/PlaybackController.js'
import AudioEngine from '../../audio/AudioEngine.js'

/**
 * Phase4Scene1 — Scene 1: "The First Meeting".
 *
 * Same mount shape as Phase2Globe: a full-screen Three.js canvas plus a
 * pointer-events:none DOM overlay (used here for the fade-to-black div the
 * sequence tweens). Builds the SchoolScene, the GSAP master timeline, and
 * registers a PlaybackController so tap / click / spacebar pause-resumes.
 *
 * Reached via the ?scene=1 dev-jump flag (see App.jsx). On completion it stops
 * ambient audio and calls onComplete() → Phase 3 placeholder.
 */
export default function Phase4Scene1({ onComplete, setController }) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const sceneRef = useRef(null)
  const ctrlRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return

    AudioEngine.ambient(true)

    const scene = new SchoolScene()
    scene.mount(canvas)
    sceneRef.current = scene

    const tl = buildScene1Sequence({
      scene,
      overlayEl: overlay,
      onBell: () => AudioEngine.bell(),
      onComplete: () => {
        AudioEngine.ambient(false)
        onComplete()
      },
    })

    // Fade the canvas in from black, then start the timeline
    const proxy = { opacity: 0 }
    gsap.to(proxy, {
      opacity: 1,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => { if (canvas) canvas.style.opacity = proxy.opacity },
      onComplete: () => tl.play(),
    })

    const ctrl = new PlaybackController(tl)
    ctrlRef.current = ctrl
    setController(ctrl)

    return () => {
      AudioEngine.ambient(false)
      ctrl.dispose()
      scene.dispose()
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild)
    }
  }, []) // eslint-disable-line

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}
      />
      <div
        ref={overlayRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
    </div>
  )
}
