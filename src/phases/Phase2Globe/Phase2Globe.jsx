import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import GlobeScene from './GlobeScene.js'
import { buildGlobeSequence } from './globeSequence.js'
import PlaybackController from '../../core/PlaybackController.js'
import AudioEngine from '../../audio/AudioEngine.js'

/**
 * Phase2Globe — mounts the Three.js canvas and drives the globe sequence.
 *
 * Layout:
 *   • A full-screen canvas for Three.js rendering
 *   • A full-screen DOM overlay (position:absolute, pointer-events:none)
 *     used by globeSequence.js for text boxes and dot labels
 */
export default function Phase2Globe({ onComplete, setController }) {
  const canvasRef  = useRef(null)
  const overlayRef = useRef(null)
  const sceneRef   = useRef(null)
  const ctrlRef    = useRef(null)

  useEffect(() => {
    const canvas  = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return

    // Start ambient pad
    AudioEngine.ambient(true)

    // Three.js scene
    const scene = new GlobeScene()
    scene.mount(canvas)
    sceneRef.current = scene

    // Build GSAP master timeline
    const tl = buildGlobeSequence({
      scene,
      overlayEl:  overlay,
      onTypeChar: () => AudioEngine.tick(),
      onComplete: () => {
        AudioEngine.ambient(false)
        onComplete()
      },
    })

    // Fade in — brief black before globe appears
    const wrapperProxy = { opacity: 0 }
    gsap.to(wrapperProxy, {
      opacity: 1,
      duration: 1,
      ease: 'power2.out',
      onUpdate: () => {
        if (canvas) canvas.style.opacity = wrapperProxy.opacity
      },
      onComplete: () => tl.play(),
    })

    // Register with App
    const ctrl = new PlaybackController(tl)
    ctrlRef.current = ctrl
    setController(ctrl)

    return () => {
      AudioEngine.ambient(false)
      ctrl.dispose()
      scene.dispose()
      // Clear any leftover overlay children
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild)
    }
  }, []) // eslint-disable-line

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Three.js canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position:  'absolute',
          inset:     0,
          width:     '100%',
          height:    '100%',
          opacity:   0,
        }}
      />

      {/* DOM overlay for text boxes and labels */}
      <div
        ref={overlayRef}
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          overflow:      'hidden',
        }}
      />
    </div>
  )
}
