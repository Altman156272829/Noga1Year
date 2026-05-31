import React from 'react'

/**
 * Phase3Transition — skeleton only.
 * Receives the handoff from Phase 2 (the globe is fading out).
 * The full cinematic timeline will be built in a future session.
 */
export default function Phase3Transition() {
  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#000',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          fontFamily:    'var(--font-serif)',
          fontWeight:    300,
          fontSize:      'clamp(0.75rem, 2vw, 0.9rem)',
          letterSpacing: '0.3em',
          color:         'rgba(200,169,110,0.25)',
          textTransform: 'lowercase',
        }}
      >
        — to be continued —
      </p>
    </div>
  )
}
