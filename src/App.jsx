import React, { useState, useCallback, useRef, useEffect } from 'react'
import EntryScreen from './phases/EntryScreen.jsx'
import Phase1Opening from './phases/Phase1Opening.jsx'
import Phase2Globe from './phases/Phase2Globe/Phase2Globe.jsx'
import Phase4Scene1 from './phases/Phase4Scene1/Phase4Scene1.jsx'
import Phase3Transition from './phases/Phase3Transition.jsx'

/**
 * Phase state machine: ENTRY → PHASE1 → PHASE2 → PHASE3
 *
 * PHASE4 (Scene 1 — "The First Meeting") is built but not yet part of the
 * normal flow; it is reachable only via the ?scene=1 dev-jump flag so it can
 * be built/tested in isolation. When it finishes it hands off to PHASE3.
 *
 * The active phase registers its PlaybackController via setController().
 * Global tap and spacebar events route to controller.toggle().
 */
const PHASES = {
  ENTRY:   'ENTRY',
  PHASE1:  'PHASE1',
  PHASE2:  'PHASE2',
  PHASE3:  'PHASE3',
  PHASE4:  'PHASE4',
}

// Dev-jump: ?scene=1 boots straight into Scene 1
function initialPhase() {
  try {
    if (new URLSearchParams(window.location.search).get('scene') === '1') {
      return PHASES.PHASE4
    }
  } catch (_) { /* ignore */ }
  return PHASES.ENTRY
}

export default function App() {
  const [phase, setPhase] = useState(initialPhase)
  const controllerRef = useRef(null)

  // Phases register their PlaybackController here
  const setController = useCallback((ctrl) => {
    controllerRef.current = ctrl
  }, [])

  // Global tap / spacebar → toggle active controller
  useEffect(() => {
    const handleInput = (e) => {
      // Only forward to the controller during PHASE1 / PHASE2 / PHASE3
      if (phase === PHASES.ENTRY) return
      if (e.type === 'keydown' && e.code !== 'Space') return
      if (e.type === 'keydown') e.preventDefault()
      controllerRef.current?.toggle()
    }

    window.addEventListener('pointerdown', handleInput, { passive: false })
    window.addEventListener('keydown', handleInput)
    return () => {
      window.removeEventListener('pointerdown', handleInput)
      window.removeEventListener('keydown', handleInput)
    }
  }, [phase])

  const advance = useCallback((from) => {
    if (from === PHASES.ENTRY)  setPhase(PHASES.PHASE1)
    if (from === PHASES.PHASE1) setPhase(PHASES.PHASE2)
    if (from === PHASES.PHASE2) setPhase(PHASES.PHASE3)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {phase === PHASES.ENTRY  && <EntryScreen    onComplete={() => advance(PHASES.ENTRY)}  />}
      {phase === PHASES.PHASE1 && <Phase1Opening  onComplete={() => advance(PHASES.PHASE1)} setController={setController} />}
      {phase === PHASES.PHASE2 && <Phase2Globe    onComplete={() => advance(PHASES.PHASE2)} setController={setController} />}
      {phase === PHASES.PHASE4 && <Phase4Scene1   onComplete={() => setPhase(PHASES.PHASE3)} setController={setController} />}
      {phase === PHASES.PHASE3 && <Phase3Transition />}
    </div>
  )
}
