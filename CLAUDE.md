# CLAUDE.md — Project: "One Year Together"

## What This Project Is

A cinematic, interactive anniversary website built as a gift for my girlfriend Noga, marking one year together. This is not a regular website — it's an experience. It should feel like watching a beautiful film, except you can touch it, pause it, and live inside it. Every design decision, every animation timing, every word on screen should feel intentional, emotional, and personal.

She will open this on her phone or computer and experience it alone. It needs to move her.

---

## Workflow Rules

These rules are permanent and apply to every session on this project.

### Rule 1 — Commit and push after every significant change
After any change that touches application code, components, animations, configs, or assets — commit and push to GitHub before ending the turn. "Significant" means anything beyond pure documentation typos. When in doubt, commit. Use descriptive commit messages:
- `feat: add globe intro phase 2`
- `fix: GSAP timing on opening sequence`
- `chore: update dependencies`

### Rule 2 — Update CLAUDE.md after every significant change
CLAUDE.md is the single source of truth for this project. After any significant change:
- Update the relevant section to reflect the new state
- Update the phase status in Build Order if a phase was completed or started
- Add any new files to the File Map section
- Document any new decisions or gotchas discovered
- Include the CLAUDE.md update in the **same commit** as the code change — never a separate commit

---

## The People

- **Him:** the builder (name not shown in the site)
- **Her:** Noga
- **Where they met:** Kalman Middle School, Ramat HaSharon
- **When:** Spring 2025 (February/March)
- **How they met:** Noga came to his school with her entire grade to perform a play in the auditorium. He was in 9th grade. He noticed her sitting with friends on a bench inside the building, went to talk to her briefly, then went up to class. Mid-lesson, he couldn't stop thinking about her — so he left class, went back downstairs, asked for her Instagram, she gave it to him. He walked back to class smiling and raised his fist in victory. The whole class saw.

---

## The Vision

The site plays like a movie — automatically advancing through scenes with cinematic animations. The user can touch/click to pause or advance. It tells the story of their year together through:

1. A cinematic opening title sequence
2. An interactive 3D globe made of memory-dots
3. A cinematic timeline moving through all events
4. Full 3D animated scenes for the 5 most important moments

---

## Aesthetic

- **Dark & cinematic** — deep black backgrounds, dramatic warm lighting, glowing gold/amber accents
- **Feels like:** a prestige film title sequence mixed with an interactive music video
- **Typography:** elegant serif fonts, wide letter-spacing, restrained use of text
- **Animations:** smooth, weighty, emotional — never bouncy or cheap. Every transition should feel like a film cut
- **Sound:** subtle — typewriter sounds, soft ambient audio. No jarring sounds
- **Language:** English only for all on-screen text

---

## Tech Stack

- **Framework:** React 18 + Vite 4 (plain JavaScript/JSX — no TypeScript)
- **Animation:** GSAP 3 (all cinematic animations and transitions)
- **3D:** Three.js (raw, imperative — not react-three-fiber) for 3D globe + all event scenes
- **Styling:** Tailwind CSS v3 via PostCSS + autoprefixer
- **Font:** Cormorant Garamond (Google Fonts `<link>`) with system-serif fallback
- **Audio:** Web Audio API only — no external audio files
- **Deploy:** Netlify
- **Node:** v16.20.2 (constraint — see Gotchas)

---

## Interaction Model

Auto-plays like a movie. Touch or click pauses/advances. Spacebar also works. Mobile must work perfectly — she may open this on her phone.

Entry point: faint "touch to begin" prompt on pure black — one tap unlocks Web Audio and starts the film.

---

## Architecture & Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 3D engine | Raw Three.js + GSAP master timelines | Tightest cinematic control; GSAP scrubs positions, opacities frame-by-frame |
| Framework | React + Vite (JS, not TS) | Less Three.js type friction; faster iteration |
| Styling | Tailwind v3 via PostCSS | Node 16 blocks Tailwind v4 and `@tailwindcss/vite` — v3 is fully compatible |
| Vite version | Vite 4 (not 5) | Vite 5 requires Node ≥ 18; locked to v4 for Node 16 compatibility |
| Font | Cormorant Garamond | Elegant, cinematic serif with great display weights |
| Audio entry | "Touch to begin" screen | Reliably unlocks Web Audio before typewriter sound is needed in Phase 2 |
| Mobile perf | WebGL pixelRatio capped at 2 | Maintains 60fps on mid-range phones |
| Phase state | `ENTRY → PHASE1 → PHASE2 → PHASE3` | Simple string enum in App.jsx; each phase mounts/unmounts independently |
| Particle shimmer | DOM div dots animated by GSAP | Avoids a second canvas; 18 dots per title card, drift outward on fade-in |
| Connection lines | Three.js LineSegments, additive blending | Gives a glowing neural-net look; opacity GSAP-tweened on connect |
| Burst dots | Fibonacci sphere distribution, 60 dots | Even coverage; exponential delay curve makes the burst accelerate visually |

---

## File Map

```
c:\ClaudeCodeProjects\Noga1Year\
├── CLAUDE.md                          — this file; single source of truth
├── index.html                         — HTML entry; Google Fonts, mobile viewport, theme-color #000
├── package.json                       — React 18, GSAP 3, Three.js, Tailwind v3, Vite 4
├── vite.config.js                     — @vitejs/plugin-react
├── postcss.config.js                  — tailwindcss + autoprefixer
├── tailwind.config.js                 — content: index.html + src/**; extends: gold colors, serif font
├── .gitignore                         — ignores node_modules/, dist/
│
└── src/
    ├── main.jsx                       — ReactDOM.createRoot entry point
    ├── App.jsx                        — phase state machine (ENTRY→PHASE1→PHASE2→PHASE3)
    ├── index.css                      — Tailwind base + cinematic CSS vars (--gold, --font-serif)
    │
    ├── core/
    │   ├── events.js                  — 11 events array; Fibonacci sphere positions; text content
    │   └── PlaybackController.js      — GSAP timeline wrapper: play/pause/toggle/skip
    │
    ├── audio/
    │   └── AudioEngine.js             — Web Audio singleton: unlock(), tick(), ambient()
    │
    └── phases/
        ├── EntryScreen.jsx            — Pure black + pulsing "touch to begin"; unlocks audio
        ├── Phase1Opening.jsx          — Two title cards with gold glow + particle shimmer
        ├── Phase3Transition.jsx       — Skeleton only: "— to be continued —"
        │
        └── Phase2Globe/
            ├── Phase2Globe.jsx        — Mounts canvas + DOM overlay; wires scene to sequence
            ├── GlobeScene.js          — Imperative Three.js: dots, lines, burst, rotation
            └── globeSequence.js       — GSAP master timeline: all 11 events + burst + handoff
```

---

## Gotchas & Environment Notes

- **Node 16 constraint:** The machine runs Node v16.20.2. This blocks:
  - Vite 5+ (requires Node ≥ 18) → using Vite 4
  - Tailwind CSS v4 / `@tailwindcss/vite` (requires Node ≥ 18) → using Tailwind v3 + PostCSS
  - Latest `create-vite` CLI → project scaffolded manually
- **npm SSL cert:** `npm create vite` failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Fixed with `npm config set strict-ssl false`.
- **GSAP `.call()` timing:** When GSAP `.call()` inserts work into a running timeline (e.g. DOM mutations for particles), the function receives a snapshot of the `tl` at call time. Nested `.to()` calls inside a `.call()` are fired imperatively and are not part of the parent timeline's pause/seek graph. Keep this in mind for Phase 3.
- **Particle positions use `getBoundingClientRect`:** Phase1Opening particle spawning reads the title element's screen rect. The element must be rendered and visible when `getBoundingClientRect` fires — the `tl.call()` at `card1+=0.1` (100ms after fade begins) gives enough time.
- **Three.js Points geometry update:** When moving a dot, `geometry.attributes.position.needsUpdate = true` must be set — Three.js won't re-upload the buffer otherwise.
- **No `.gitignore` on init:** The initial commit did not include `.gitignore`. Added in the retroactive commit from 2026-05-31.
- **`tl.call()` does not advance timeline duration:** A GSAP timeline whose only entries are `tl.call()` + `tl.addLabel()` can report `tl.duration() = 0`, causing subsequent `tl.addLabel()` calls to stack at the same time. Fix: track an explicit `cursor` variable and insert a tiny `tl.to({}, {duration: 0.001}, cursor - 0.001)` anchor after each event to force the timeline to recognise the correct end time.
- **`animateParticlesOut` must use independent `gsap.to()`:** Calling `tl.to()` inside a `tl.call()` callback to modify the SAME timeline inserts tweens at an already-elapsed position, causing unreliable behaviour. Use `gsap.to()` (independent tween) for particle fade-out instead.

---

## Full Site Flow

### Phase 0 — Entry Screen ✅ BUILT

Pure black screen. A single faint serif "touch to begin" pulses slowly (opacity 0.15→0.45, 3s loop). One tap/click/spacebar: unlocks Web Audio, fades out, advances to Phase 1.

---

### Phase 1 — Opening Sequence ✅ BUILT

Total duration: ~7.6 seconds.

1. "One Year Together" fades + rises (1.2s, `power2.out`), gold glow (`text-shadow` triple layer), 18-dot particle shimmer halo drifts outward (1.1s drift). Holds ~1.6s at full opacity.
2. Dissolves (0.7s, `power2.in`). Short black (~0.3s).
3. "Infinite Memories" — same treatment.
4. Dissolves. Short black (~1.0s). → Phase 2.

Controlled by `PlaybackController` — tap or spacebar pauses/resumes at any point.

---

### Phase 2 — Globe Intro ✅ BUILT (Three.js)

A 3D globe built from glowing dots connected by thin lines.

**Events 1–6 (typewriter text box):**
1. Text box fades in at center with event title + italic body text
2. Body types letter-by-letter at 28 chars/sec, Web Audio tick per character
3. Text box shrinks/fades; dot fades in at origin and flies to sphere position (1.1s, `power3.inOut`)
4. On landing: title label appears at dot's projected screen position, fades out after 1.8s; connection lines to all prior dots fade in (additive blending, 0.8s stagger)

**Events 7–11 (dot + label, sequential with decreasing gaps):**
Dot flies to position (0.9s, `power2.inOut`). Title label appears on landing, fades after 1.8s. Lines connect. Gaps between events: 4s → 3s → 2s → 1s → 0.5s (exponential acceleration).

**Final burst:**
100 tiny dots on a Fibonacci sphere. Each dot is scheduled via an individual `tl.call()` at time `burstStart + 7 * (i/99)^0.42`. This power curve (exponent < 1) produces slow start (~1 dot/sec) accelerating to ~30 dots/sec at the end — total ~7s. Dot size 0.10 world units.

**Timing:** cursor is tracked as an explicit absolute-second variable. A tiny anchor tween (`duration: 0.001`) is inserted after each event to keep `tl.duration()` reliable.

**Idle rotation:** Globe rotates 0.6 rad over 2.5s (`power1.inOut`) → `onComplete` → Phase 3.

---

### Phase 3 — Timeline (not built yet)

A cinematic timeline that moves through all 11 events chronologically. Skeleton transition placeholder in place. Full build awaits further instructions.

---

### Phase 4–8 — The 5 Full Scenes (not built yet)

Full Three.js animated 3D scenes for:
1. The First Meeting
2. First Date
3. Karting + becoming official
4. First Kiss
5. The Sea (Nahsholim)

Detailed scene specs will be provided when we reach each phase.

---

## Build Order

1. ✅ Update CLAUDE.md with full project document
2. ✅ Phase 0 — Entry screen (touch to begin)
3. ✅ Phase 1 — Opening sequence (title cards + particles)
4. ✅ Phase 2 — Globe intro (Three.js memory globe)
5. ✅ Phase 3 skeleton transition (placeholder)
6. Phase 3 — Full timeline (awaiting spec)
7. Phase 4–8 — The 5 full 3D scenes (awaiting specs)

---

## Important Rules

- Always update CLAUDE.md when new decisions are made during the build (see Workflow Rules above)
- Never rush animations — timing is everything in this project
- Mobile-first — test every phase on mobile viewport
- Performance matters — smooth 60fps on mobile is required
- No external audio files — use Web Audio API only for all sounds
- When in doubt about any design decision, always choose the more cinematic option

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Project initialized. Git repo created. CLAUDE.md established as context file. |
| 2026-05-31 | CLAUDE.md rewritten with full project document (people, vision, flow, all 11 events, build order, rules). |
| 2026-05-31 | Project scaffolded: Vite 4 + React 18 + GSAP 3 + Three.js + Tailwind v3. Vite 4 / Tailwind v3 chosen for Node 16 compatibility. |
| 2026-05-31 | Core modules built: events.js (11 events, Fibonacci positions), AudioEngine.js (Web Audio ticks + ambient), PlaybackController.js (GSAP timeline wrapper). |
| 2026-05-31 | App shell built: main.jsx, App.jsx (ENTRY→PHASE1→PHASE2→PHASE3 state machine, global tap/spacebar routing). |
| 2026-05-31 | Phase 0 built: EntryScreen.jsx — pure black, pulsing serif prompt, audio unlock gate. |
| 2026-05-31 | Phase 1 built: Phase1Opening.jsx — two title cards with gold glow, 18-particle shimmer halo, GSAP master timeline (~13.5s). |
| 2026-05-31 | Phase 2 built: GlobeScene.js (Three.js), globeSequence.js (GSAP master timeline, all 11 events + 60-dot burst), Phase2Globe.jsx (canvas + DOM overlay mount). |
| 2026-05-31 | Phase 3 skeleton built: Phase3Transition.jsx placeholder. |
| 2026-05-31 | Workflow Rules added to CLAUDE.md. .gitignore created. Retroactive commit of all session work. |
| 2026-05-31 | Fix 1: Phase 1 tightened from ~13.5s to ~7.6s (rise 1.2s, hold 1.6s, dissolve 0.7s). |
| 2026-05-31 | Fix 2: All 11 dots now show title labels after landing (was only events 7–11). |
| 2026-05-31 | Fix 3: Events 7–11 now appear one at a time with explicit decreasing gaps (4s/3s/2s/1s/0.5s) using manual cursor tracking. |
| 2026-05-31 | Fix 4: Burst upgraded to 100 dots, one tl.call() per dot, power-curve timing (slow start → ~30/s at end). |
