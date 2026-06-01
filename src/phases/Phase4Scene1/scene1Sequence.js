/**
 * scene1Sequence.js — GSAP master timeline for Phase 4 / Scene 1
 * ("The First Meeting").
 *
 * One paused timeline drives every camera move and character pose so that the
 * PlaybackController's pause/resume affects the whole film coherently. Uses the
 * same explicit-`cursor` + tiny-`anchor()` pattern as globeSequence.js so that
 * tl.duration() stays reliable across zero-duration tl.call() entries.
 *
 * Seven labelled acts (~80s total), then a fade-to-black → onComplete → Phase 3.
 *
 * Helpers keep persistent proxies (camProxy, cp[name]) so consecutive tweens
 * continue from the current value; instantaneous "cuts" update the proxy too so
 * the next tween doesn't jump from a stale origin.
 */

import { gsap } from 'gsap'

export function buildScene1Sequence({ scene, overlayEl, onBell, onComplete }) {
  const tl = gsap.timeline({ paused: true, onComplete })

  // Fade-to-black overlay (tweened at the very end)
  const fade = document.createElement('div')
  Object.assign(fade.style, {
    position: 'absolute', inset: 0, background: '#000', opacity: '0', pointerEvents: 'none',
  })
  overlayEl.appendChild(fade)

  // ── Anchor so tl.duration() reflects the true end across tl.call() entries ──
  const anchor = (t) => tl.to({}, { duration: 0.001 }, Math.max(0, t - 0.001))

  // ── Camera helpers (shared proxy for continuity) ─────────────────────────
  const cam = { px: 0, py: 1.9, pz: 14, lx: 0, ly: 1.4, lz: 2 }
  const applyCam = () => { scene.setCamPos(cam.px, cam.py, cam.pz); scene.setCamLook(cam.lx, cam.ly, cam.lz) }
  scene.setCamPos(cam.px, cam.py, cam.pz); scene.setCamLook(cam.lx, cam.ly, cam.lz)

  const camTo = (t, dur, p, ease = 'power2.inOut') =>
    tl.to(cam, { ...p, duration: dur, ease, onUpdate: applyCam }, t)

  const camCut = (t, p) => tl.call(() => { Object.assign(cam, p); applyCam() }, null, t)

  // ── Character helpers (one persistent proxy per character) ───────────────
  const cp = {}
  const ensure = (name, x, y, z, ry = 0, head = 0) => {
    if (!cp[name]) cp[name] = { x, y, z, ry, head }
  }
  ensure('noam', -0.6, 0, 11, Math.PI)
  ensure('friend', 0.8, 0, 11.2, Math.PI)
  ensure('noga', 3.2, -0.02, -1.4, 0)
  ensure('nogaFriend1', 2.2, -0.02, -1.4, 0)
  ensure('nogaFriend2', 4.2, -0.02, -1.4, 0)

  const move = (name, t, dur, x, y, z, ease = 'power2.inOut') =>
    tl.to(cp[name], { x, y, z, duration: dur, ease,
      onUpdate: () => scene.setCharPos(name, cp[name].x, cp[name].y, cp[name].z) }, t)

  const turn = (name, t, dur, ry, ease = 'power2.inOut') =>
    tl.to(cp[name], { ry, duration: dur, ease, onUpdate: () => scene.setCharRot(name, cp[name].ry) }, t)

  const head = (name, t, dur, val, ease = 'power2.inOut') =>
    tl.to(cp[name], { head: val, duration: dur, ease, onUpdate: () => scene.setCharHeadTurn(name, cp[name].head) }, t)

  const charCut = (name, t, x, y, z, ry, hd = 0) =>
    tl.call(() => {
      cp[name].x = x; cp[name].y = y; cp[name].z = z; cp[name].ry = ry; cp[name].head = hd
      scene.setCharPos(name, x, y, z); scene.setCharRot(name, ry); scene.setCharHeadTurn(name, hd)
    }, null, t)

  const walk = (name, t, dur, steps = 6) => {
    const w = { p: 0 }
    tl.to(w, { p: steps * Math.PI * 2, duration: dur, ease: 'none',
      onUpdate: () => scene.setCharWalk(name, w.p) }, t)
    tl.call(() => scene.setCharWalk(name, 0), null, t + dur)
  }

  // arm raise to a fixed angle (0 = down, ~ -2.6 = up)
  const arm = (name, side, t, dur, to, ease = 'power2.out') => {
    const a = { v: 0 }
    tl.to(a, { v: to, duration: dur, ease, onUpdate: () => scene.setCharArm(name, side, a.v) }, t)
  }

  // a few back-and-forth glances on a head proxy (laugh / distracted / wave-ish)
  const oscHead = (name, t, dur, amp, cycles = 3) => {
    const o = { p: 0 }
    tl.to(o, { p: cycles * Math.PI * 2, duration: dur, ease: 'sine.inOut',
      onUpdate: () => scene.setCharHeadTurn(name, Math.sin(o.p) * amp) }, t)
    tl.call(() => scene.setCharHeadTurn(name, 0), null, t + dur)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 1 — ENTRANCE (0–8s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act1', 0)
  // Noam + friend walk in from the entrance; camera follows from behind.
  walk('noam', 0, 7, 6)
  walk('friend', 0, 7, 6)
  move('noam', 0, 7, -0.6, 0, 4, 'power1.inOut')
  move('friend', 0, 7, 0.8, 0, 4.4, 'power1.inOut')
  camTo(0, 8, { px: 0, py: 1.9, pz: 8, lx: 0, ly: 1.3, lz: 3 }, 'power1.inOut')
  anchor(8)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 2 — THE FIRST SIGHT (8–18s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act2', 8)
  // Cut to Noam's POV: he sees Noga laughing on the bench. Slow push-in = time slows.
  camCut(8, { px: 0.2, py: 1.7, pz: 4, lx: 3.2, ly: 1.15, lz: -1.4 })
  camTo(8.05, 7, { px: 1.2, py: 1.62, pz: 2.4, lx: 3.2, ly: 1.1, lz: -1.4 }, 'power1.out')
  // Noga + friends laughing (gentle head bobs)
  oscHead('noga', 8.2, 6.5, 0.18, 4)
  oscHead('nogaFriend1', 8.4, 6, 0.16, 3)
  oscHead('nogaFriend2', 8.1, 6.2, 0.16, 4)
  // Noam turns to his friend — cut to a two-shot
  camCut(15.4, { px: 2.6, py: 1.7, pz: 7.5, lx: 0.1, ly: 1.45, lz: 4 })
  head('noam', 15.6, 0.8, 0.7)   // look toward friend (on his right)
  head('noam', 16.8, 0.9, 0.15)
  anchor(18)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 3 — THE APPROACH (18–30s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act3', 18)
  // Side dolly tracking Noam as he walks to the bench and starts talking.
  camCut(18, { px: -3, py: 1.6, pz: 7, lx: 1.5, ly: 1.2, lz: 3 })
  walk('noam', 18.2, 5, 5)
  move('noam', 18.2, 5, 2.7, 0, 0.7, 'power1.inOut')
  turn('noam', 22.0, 1.2, Math.PI)   // face the bench (−z)
  camTo(18.2, 7.5, { px: -2.4, py: 1.55, pz: 0.6, lx: 2.6, ly: 1.15, lz: -0.8 }, 'power1.inOut')
  // Noga looks up at him
  head('noga', 23.5, 1.0, -0.35)
  // small talking gestures from Noam
  arm('noam', 'right', 24.5, 0.5, -0.5)
  arm('noam', 'right', 25.3, 0.6, -0.1)
  arm('noam', 'right', 26.5, 0.5, -0.45)
  arm('noam', 'right', 27.4, 0.7, 0)
  anchor(30)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 4 — UP THE STAIRS (30–40s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act4', 30)
  tl.call(() => onBell?.(), null, 30.0)        // school bell rings
  camCut(30, { px: 0, py: 1.8, pz: 5, lx: -2, ly: 1.4, lz: 0 })
  // Noam waves goodbye
  arm('noam', 'right', 30.4, 0.4, -2.2)
  oscHead('noam', 30.5, 1.4, 0.25, 2)
  arm('noam', 'right', 31.8, 0.5, 0)
  // Walk to the staircase and climb (y rises along the steps).
  turn('noam', 32.0, 0.8, Math.PI * 1.25)
  walk('noam', 32.4, 6.0, 7)
  move('noam', 32.4, 2.6, -5.5, 0, -3.0, 'power1.inOut')   // to stair base
  move('noam', 35.0, 3.4, -5.5, 2.0, -7.4, 'power1.in')    // climb up & back
  camTo(30.1, 8, { px: -1.5, py: 2.2, pz: 2.5, lx: -5.5, ly: 1.6, lz: -5 }, 'power1.inOut')
  // One glance back at Noga before disappearing
  head('noam', 37.4, 0.7, 2.4)
  head('noam', 38.6, 0.6, 0)
  anchor(40)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 5 — THE DECISION (40–52s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act5', 40)
  // Cut to the classroom; Noam at his desk, distracted, glancing at the door.
  charCut('noam', 40, 76.6, 0, 2.0, Math.PI)   // CLASS.x(80)-3.4, facing front (−z)
  camCut(40, { px: 76.6, py: 1.72, pz: 4.0, lx: 76.6, ly: 1.55, lz: 2.0 })   // close-up
  arm('noam', 'right', 40, 0.01, 0)
  arm('noam', 'left', 40, 0.01, 0)
  // distracted glances toward the door (door is at −x of the room)
  oscHead('noam', 40.5, 8.5, 0.55, 4)
  camTo(40.1, 9, { px: 76.6, py: 1.7, pz: 3.4, lx: 76.6, ly: 1.5, lz: 2.0 }, 'sine.inOut')
  // The decision — he stands and steps back from the desk
  camCut(49.5, { px: 75.0, py: 1.8, pz: 5.2, lx: 76.6, ly: 1.4, lz: 2.0 })
  move('noam', 49.6, 1.6, 76.6, 0, 3.0, 'power2.out')
  turn('noam', 50.4, 1.0, Math.PI * 0.5)       // turn toward the door
  anchor(52)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 6 — THE INSTAGRAM (52–68s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act6', 52)
  // Back in the lobby. Noga now stands in the same spot.
  tl.call(() => scene.setStanding('noga'), null, 52)
  charCut('noga', 52, 3.2, 0, -1.0, Math.PI)   // standing, facing the lobby (+? → toward Noam)
  tl.call(() => { cp.noga.y = 0 }, null, 52)
  turn('noga', 52, 0.01, 0)                    // face +z (toward approaching Noam)
  charCut('noam', 52.01, 1.0, 0, 4.5, Math.PI)
  camCut(52, { px: -2.2, py: 1.6, pz: 3.2, lx: 2.4, ly: 1.3, lz: -0.4 })
  // Noam walks up confidently
  walk('noam', 52.4, 3.0, 4)
  move('noam', 52.4, 3.0, 2.6, 0, 0.4, 'power1.inOut')
  camTo(52.2, 6, { px: -1.0, py: 1.55, pz: 1.6, lx: 2.6, ly: 1.25, lz: -0.4 }, 'power1.inOut')
  // He asks; she smiles and shows her phone
  head('noga', 56.0, 0.8, -0.2)
  tl.call(() => scene.setPropVisible('noga', true), null, 56.6)
  arm('noga', 'right', 56.6, 0.7, -1.1)        // raise phone to show
  arm('noam', 'right', 57.6, 0.7, -1.0)        // he reaches to type
  // Close on the moment + golden glow
  camTo(57.0, 4, { px: 1.4, py: 1.45, pz: 1.0, lx: 2.7, ly: 1.2, lz: -0.5 }, 'sine.inOut')
  {
    const g = { v: 0 }
    tl.to(g, { v: 0.9, duration: 1.6, ease: 'power2.inOut', onUpdate: () => scene.setGlow(g.v) }, 58.5)
    tl.to(g, { v: 0.25, duration: 4.0, ease: 'power2.out', onUpdate: () => scene.setGlow(g.v) }, 60.2)
  }
  arm('noam', 'right', 62.5, 0.8, 0)
  arm('noga', 'right', 63.0, 0.8, 0)
  tl.call(() => scene.setPropVisible('noga', false), null, 63.8)
  camTo(64.0, 4, { px: -1.5, py: 1.65, pz: 3.2, lx: 1.8, ly: 1.3, lz: 0 }, 'power1.inOut')
  anchor(68)

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 7 — THE VICTORY (68–80s)
  // ═══════════════════════════════════════════════════════════════════════════
  tl.addLabel('act7', 68)
  tl.call(() => scene.setGlow(0), null, 68)
  // Cut to the classroom; Noam enters through the door.
  charCut('noam', 68, 73.5, 0, 2.0, Math.PI * 0.5)   // by the door (−x side), facing in
  camCut(68, { px: 78.5, py: 1.7, pz: 5.5, lx: 76.5, ly: 1.4, lz: 1.5 })
  walk('noam', 68.3, 2.6, 4)
  move('noam', 68.3, 2.6, 76.2, 0, 2.2, 'power1.out')
  turn('noam', 70.6, 0.8, Math.PI)                   // face the class
  // The whole class turns to look at him
  {
    const s = { v: 0 }
    tl.to(s, { v: 0.5, duration: 1.0, ease: 'power2.out', onUpdate: () => scene.setStudentsLook(s.v) }, 70.8)
  }
  // He raises his fist in victory
  arm('noam', 'right', 71.8, 0.6, -2.7, 'back.out(2)')
  // The class reacts (a quick collective bob)
  {
    const r = { v: 0.5 }
    tl.to(r, { v: 0.65, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut',
      onUpdate: () => scene.setStudentsLook(r.v) }, 72.2)
  }
  // Camera pulls back slowly to reveal the full classroom
  camTo(71.5, 7, { px: 80, py: 3.2, pz: 9.5, lx: 79, ly: 1.6, lz: 0 }, 'power1.inOut')
  // Fade to black
  tl.to(fade, { opacity: 1, duration: 2.2, ease: 'power2.in' }, 77.5)
  anchor(80)

  return tl
}
