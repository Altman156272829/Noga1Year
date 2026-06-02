import React, { useState, useCallback, useRef, useEffect } from 'react'
import EntryScreen from './phases/EntryScreen.jsx'
import Phase1Opening from './phases/Phase1Opening.jsx'
import Phase2Globe from './phases/Phase2Globe/Phase2Globe.jsx'
import Phase3Timeline from './phases/Phase3Timeline.jsx'
import Phase4Scene1 from './phases/Phase4Scene1/Phase4Scene1.jsx'
import ScenePlaceholder from './phases/ScenePlaceholder.jsx'
import Phase3Transition from './phases/Phase3Transition.jsx'

/**
 * Phase state machine: ENTRY → PHASE1 → PHASE2 → PHASE3 → CLOSING
 *
 * PHASE3 is "The Timeline": a cinematic passage of time that STOPS on each of the
 * 5 scene dates and hands the scene off to App via an overlay. The timeline stays
 * mounted (its GSAP timeline paused) while the scene plays on top; when the scene
 * finishes App resumes the timeline and the sweep continues. id=1 → the real
 * Phase4Scene1; ids 2–5 → the generic ScenePlaceholder.
 *
 * PHASE4 remains the isolated ?scene=1 dev-jump (build/test Scene 1 alone).
 * CLOSING is the prepare-the-callback closing placeholder (Phase3Transition).
 *
 * The active/front-most component registers its PlaybackController via
 * setController(); global tap and spacebar route to controller.toggle().
 */
const PHASES = {
  ENTRY:   'ENTRY',
  PHASE1:  'PHASE1',
  PHASE2:  'PHASE2',
  PHASE3:  'PHASE3',
  PHASE4:  'PHASE4',
  CLOSING: 'CLOSING',
}

// Titles for the not-yet-built scenes (ids 2–5) shown by ScenePlaceholder.
const SCENE_TITLES = {
  2: 'First Date',
  3: 'Karting + We Became Official',
  4: 'First Kiss',
  5: 'The Sea',
}

// Dev-jumps: ?scene=1 boots straight into Scene 1; ?phase=3 into the timeline.
function initialPhase() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('scene') === '1') return PHASES.PHASE4
    if (q.get('phase') === '3') return PHASES.PHASE3
  } catch (_) { /* ignore */ }
  return PHASES.ENTRY
}

export default function App() {
  const [phase, setPhase] = useState(initialPhase)
  const [activeScene, setActiveScene] = useState(null) // null | 1..5 (PHASE3 overlay)
  const controllerRef = useRef(null)   // front-most controller (receives input)
  const timelineCtrlRef = useRef(null) // the Phase 3 timeline controller (to resume)

  // Front-most phase registers its PlaybackController here
  const setController = useCallback((ctrl) => {
    controllerRef.current = ctrl
  }, [])

  // Global tap / spacebar → toggle the front-most controller
  useEffect(() => {
    const handleInput = (e) => {
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

  // Timeline reached a scene date → mount the scene overlay on top.
  // Stash the timeline controller FIRST: the scene's setController will overwrite
  // controllerRef, and we need a separate handle to resume the timeline later.
  const enterScene = useCallback((id) => {
    timelineCtrlRef.current = controllerRef.current
    setActiveScene(id)
  }, [])

  // Scene/placeholder finished → unmount it, restore input to the timeline, resume.
  const exitScene = useCallback(() => {
    setActiveScene(null)
    controllerRef.current = timelineCtrlRef.current
    timelineCtrlRef.current?.play()
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {phase === PHASES.ENTRY  && <EntryScreen   onComplete={() => advance(PHASES.ENTRY)}  />}
      {phase === PHASES.PHASE1 && <Phase1Opening onComplete={() => advance(PHASES.PHASE1)} setController={setController} />}
      {phase === PHASES.PHASE2 && <Phase2Globe   onComplete={() => advance(PHASES.PHASE2)} setController={setController} />}

      {phase === PHASES.PHASE3 && (
        <>
          <Phase3Timeline
            onComplete={() => setPhase(PHASES.CLOSING)}
            onEnterScene={enterScene}
            setController={setController}
          />
          {activeScene === 1 && (
            <Phase4Scene1 onComplete={exitScene} setController={setController} />
          )}
          {activeScene > 1 && (
            <ScenePlaceholder
              sceneId={activeScene}
              title={SCENE_TITLES[activeScene]}
              onComplete={exitScene}
              setController={setController}
            />
          )}
        </>
      )}

      {/* Isolated dev-jump (?scene=1): test Scene 1 alone, then into the timeline */}
      {phase === PHASES.PHASE4 && <Phase4Scene1 onComplete={() => setPhase(PHASES.PHASE3)} setController={setController} />}

      {phase === PHASES.CLOSING && <Phase3Transition />}
    </div>
  )
}
