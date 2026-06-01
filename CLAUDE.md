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
| Burst dots | 1000 dots, growing-rectangle starfield, single BufferGeometry + ShaderMaterial | Fills the whole screen (corners included); one draw call keeps 60fps |
| Burst lines | Nearest-neighbour (3–4 per dot), single batched BufferGeometry | Neural-net look without O(n²); one draw call for up to 4000 lines |
| Scene 1 reach | Dev-jump via `?scene=1` URL flag; `PHASE4` not in normal flow yet | Build/test the 80s scene in isolation without replaying Phases 0–2 |
| Scene 1 characters | Stylized primitives (Box/Cylinder/Sphere) grouped per character | No external models; clear silhouettes + correct hair colors are enough |
| Scene 1 crowd/desks | `InstancedMesh` + shared `MeshStandardMaterial` palette | Classroom students/desks are identical → one draw call each; keeps 60fps |
| Scene 1 dust | Reuse Phase 2 glow-texture + per-vertex `aOpacity` ShaderMaterial | Light-beam motes in one draw call; same proven technique as the burst |
| School bell | `AudioEngine.bell()` — detuned partials, exponential decay | No audio files; matches the Web-Audio-only constraint |

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
    │   └── AudioEngine.js             — Web Audio singleton: unlock(), tick(), ambient(), bell()
    │
    └── phases/
        ├── EntryScreen.jsx            — Pure black + pulsing "touch to begin"; unlocks audio
        ├── Phase1Opening.jsx          — Two title cards with gold glow + particle shimmer
        ├── Phase3Transition.jsx       — Skeleton only: "— to be continued —"
        │
        ├── Phase2Globe/
        │   ├── Phase2Globe.jsx        — Mounts canvas + DOM overlay; wires scene to sequence
        │   ├── GlobeScene.js          — Imperative Three.js: dots, lines, burst, rotation
        │   └── globeSequence.js       — GSAP master timeline: all 11 events + burst + handoff
        │
        └── Phase4Scene1/              — Scene 1 "The First Meeting" (dev-jump: ?scene=1)
            ├── Phase4Scene1.jsx       — Mounts canvas + overlay; wires SchoolScene to sequence
            ├── SchoolScene.js         — Imperative Three.js: lobby + classroom sets, primitive
            │                            characters, warm lights, instanced desks/students,
            │                            light-beam dust (reused burst-shader technique)
            └── scene1Sequence.js      — GSAP master timeline: 7 acts + bell + glow + fade-out
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
- **1000 burst dots: use one BufferGeometry, not 1000 meshes.** 1000 individual `THREE.Points` meshes = 1000 draw calls = frame drops. Solution: pre-allocate a single `BufferGeometry` with `DynamicDrawUsage`, per-vertex `aOpacity` float attribute, and a `ShaderMaterial` (BURST_VERT / BURST_FRAG). The render loop marks the buffers `needsUpdate = true` once per frame while the burst is active. This keeps the burst at ONE draw call regardless of dot count.
- **ShaderMaterial point size formula:** `gl_PointSize = uSize * (300.0 / -mvPosition.z)`. At camera z=6 the constant 300 gives a natural size equivalent to PointsMaterial with sizeAttenuation. As camera pulls back to z=16, burst dots automatically appear smaller via perspective — no explicit size tween needed.
- **Burst meshes need `frustumCulled = false`:** A BufferGeometry's bounding sphere is computed once from its initial vertex positions. Burst dots/lines start at the origin and fly outward, so the bounds stay tiny at origin. Three.js would frustum-cull the whole cloud whenever the origin leaves the view. It only *appeared* to work because the camera always looks at origin — set `frustumCulled = false` to be correct.
- **Burst spread must be a rectangle, not a sphere:** Filling a sphere leaves the screen *corners* empty (the silhouette is a disc). For a true edge-to-edge starfield, distribute burst targets in a growing rectangle (X scaled by viewport aspect) with edge-biased sampling, in the z≈0 plane with slight depth jitter.
- **Don't tie direction to the dot index when radius grows with index:** The first burst attempt grew a Fibonacci-sphere radius with `i` while also deriving latitude from `i` (`y = 1 - i/n*2`). Result: every large-radius dot landed near one pole. Decouple direction (randomised) from the growth factor.
- **Burst lines must be batched:** 4000 individual `LineSegments` meshes = 4000 draw calls = crash. Use ONE pre-allocated `BufferGeometry` (`LineSegments`) with a per-vertex `aOpacity` attribute + `ShaderMaterial`, `setDrawRange(0, count*2)` as lines are added, uploaded on a dirty flag. Nearest-neighbour search is bounded to a recent window (120) + distance cutoff (2.6 wu) to stay O(n·window) and cap the line count.
- **Scene 1 — proxy continuity for cuts:** In `scene1Sequence.js` the camera and each character share ONE persistent proxy (`cam`, `cp[name]`) so consecutive GSAP tweens continue from the current value. An instantaneous "cut" (`camCut` / `charCut`) MUST also write the new values into that proxy, not just call the scene setter — otherwise the next tween eases from the stale pre-cut origin and the camera/character visibly snaps back before moving.
- **Scene 1 — rotating instanced sphere heads is invisible:** The Act 7 class reaction first rotated each instanced student head with `makeRotationY`. A sphere centered on its own origin shows no change under rotation, so nothing read on screen. Fix: make `setStudentsLook(theta)` a positional *lean* (offset x/y/z of each head instance toward Noam) instead of a rotation.
- **Scene 1 — separate sets, not one connected building:** The lobby and the classroom are built far apart in world space (classroom at x≈80) and the camera *cuts* between them. Because every camera move is scripted on the master timeline, there is no need to model a physically connected staircase→corridor→classroom; cutting is cheaper and reads as film.
- **Scene 1 — stylized seating via leg rotation:** Seated characters (`seated:true`) just rotate their hip-pivoted single-segment legs forward (~−1.4 rad) and drop the root to bench height. There are no knee joints; this is intentionally stylized. `setStanding(name)` resets leg rotation to 0 and root.y to 0 when a character needs to stand (Noga in Act 6).
- **Scene 1 — fade-to-black via overlay div:** The end-of-scene fade is a plain black `<div>` appended to the DOM overlay and tweened on the master timeline (not a renderer clear-alpha change), so pause/seek scrubs it like every other beat. It is removed in the React cleanup along with all overlay children.
- **Scene 1 is bright daylight, NOT the dark cinematic style:** The dark/moody look belongs to Phases 1–2 (opening titles, globe). Scene 1 is a warm, sunny spring-morning memory and must be bright and airy — high warm ambient + hemisphere + sunlight through the glass wall, no silhouettes. (An earlier pass over-applied film-noir lighting here and made it far too dark; the corrected baseline is bright.) Keep this contrast in mind for the remaining scenes — match each scene's lighting to its real setting, not to the wrapper.
- **Scene 1 — `setGlow(boost)` must reference the CURRENT light baselines:** `setGlow` lifts the sun key + Noga wash + glass emissive together for the Act 6 golden moment, and `boost = 0` (called at Act 7 start) must *restore* the baselines. Whenever the lights are rebalanced, update these constants in `setGlow` to match (currently sun 1.35, Noga wash 0.9, glass emissive 1.45) — a stale baseline silently dims/over-brightens at `boost = 0`.
- **Scene 1 — glass "glow from within" = backing emissive plane + translucent bricks:** A single emissive brick grid looks flat. Put an unlit emissive `MeshBasicMaterial` plane *behind* slightly-`transparent` (opacity ~0.82) emissive bricks so the mortar gaps reveal inner light; frame it with metal bars and add a spill `PointLight`. That's what reads as architectural illuminated glazing.
- **Scene 1 — idle animations must sync the shared proxy:** The bench `idle()` drives `setCharHeadTurn` / `setCharRot` directly via sines. If it doesn't also write the values back into `cp[name]`, the next scripted `head()` / `turn()` tween eases from the proxy's stale value and the character visibly snaps. Fix: `idle` updates `cp[name].head`/`.ry` every frame.
- **Vite dev-server `/` returns 404 to `Invoke-WebRequest`:** When probing the dev server from PowerShell, `GET /` 404s but `GET /index.html` returns 200 — a quirk of IWR vs Vite's middleware, NOT an app fault. Browsers load `/` (and `/?scene=1`) fine. Also: Vite hops to the next free port (5173→5174→…); the printed port has ANSI color codes between `127.0.0.1:` and the number, so strip `\x1b\[[0-9;]*m` before regex-matching the port.

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
4. On landing: title label appears at dot's projected screen position — **stays permanently**; connection lines to all prior dots fade in (additive blending, 0.8s stagger)

**Events 7–11 (dot + label, sequential with decreasing gaps):**
Dot flies to position (0.9s, `power2.inOut`). Title label appears on landing — **stays permanently**. Lines connect. Gaps between events: 4s → 3s → 2s → 1s → 0.5s.

**Final burst — "infinite scale" zoom-out:**
1000 tiny dots scheduled via individual `tl.call()` at `burstStart + 7 * (i/999)^0.3`. Power curve 0.3 gives ~1 dot/s at start, ~476 dots/s at peak — total ~7s. Single BufferGeometry + ShaderMaterial = one draw call.

**Screen-filling starfield distribution** (`burstStarfieldPositions`): dots target a growing **rectangle** in the z≈0 plane (NOT a sphere — a sphere leaves screen corners empty), with slight ±z depth jitter. Half-extent grows with a `^1.8` power curve from ~globe radius (2.2) to `maxY = 11.5` vertical / `11.5·aspect` horizontal. Direction is randomised independently of `i` and edge-biased (`pow 0.7`) so dots pile toward the frontier/corners. At camera z=16 the screen half-height ≈ 8.3 wu, so 11.5 overflows every edge → final frame is a full starfield covering 100% of the viewport, corners included.
> Earlier bug fixed: the old growing-sphere tied latitude to `i`, so all far dots clustered at one pole and the spread looked confined.

**Nearest-neighbour burst lines** (Fix): when each burst dot lands, it connects to its **3–4 nearest already-placed dots** (`nearestBurstNeighbors`: searches only the last 120 spawned, within 2.6 wu, keeps 4 closest). This extends the neural-net look into the burst without O(n²) blow-up. All burst lines live in **one** pre-allocated `BufferGeometry` + `ShaderMaterial` (per-vertex `aOpacity`, additive gold) = **one draw call** for up to 4000 lines. Lines use static target positions (no per-frame position update); buffer uploads only on a dirty flag when new lines are added.

Simultaneously with the burst, four GSAP tweens on the master timeline:
- **Camera pullback**: z 6→16 (`power2.in`) — the globe appears to expand infinitely
- **Named dot shrink**: `material.size` 0.22→0.055 (`power2.in`) — combined with perspective = ~8× shrink
- **Label scale**: CSS scale 1→0.25 (`power2.in`) — labels become tiny and hard to read
- **Globe rotation**: 0→0.35 rad (`none`) — slow turn during expansion

After burst: **2s hold** on the full expanded starfield view. Then `onComplete` → Phase 3.

**Performance:** `initBurstSystem(1000)` + `initBurstLines(4000)` each pre-allocate one `BufferGeometry` with `DynamicDrawUsage`. Dot buffers upload every frame while active (~16 KB); line buffers upload only when lines are added (dirty flag). Both meshes set `frustumCulled = false` (positions start at origin then fly out — stale bounds would otherwise cull them). Two draw calls total for 1000 dots + up to 4000 lines.

**Timing:** cursor is tracked as an explicit absolute-second variable. Anchor tweens (`duration: 0.001`) keep `tl.duration()` reliable after zero-duration `tl.call()` entries.

---

### Phase 3 — Timeline (not built yet)

A cinematic timeline that moves through all 11 events chronologically. Skeleton transition placeholder in place. Full build awaits further instructions.

---

### Phase 4 — Scene 1: "The First Meeting" ✅ BUILT (Three.js)

The first of the 5 full cinematic 3D scenes. A ~80-second, 7-act film dramatizing how Noam
met Noga at Kalman Middle School (the Eshkol Hapayis building). Same engine architecture as
Phase 2: raw Three.js scene class + a single GSAP master timeline driven by
`PlaybackController`; tap / click / spacebar pauses and resumes.

**Flow placement — dev-jump.** The normal film flow is unchanged
(`ENTRY→PHASE1→PHASE2→PHASE3`). A new `PHASE4` state exists but is reached **only via a URL
flag** (`?scene=1`), so the scene can be built and tested in isolation. When Scene 1 finishes
it fades to black and calls the phase transition callback → Phase 3 placeholder. (When Phase 3
and the remaining scenes are built, Scene 1 will be re-wired into the real chronological flow.)

**The setting:** Eshkol Hapayis building — modern bright architecture, large glass-brick
illuminated wall, metal facade columns, wide lobby outside the auditorium, benches along the
walls, a staircase, and a classroom. Warm golden spring morning light through the glass.

**The characters** (stylized primitives — Box/Cylinder/Sphere — with clear silhouettes and
correct hair colors):
- **Noam** — tall, light-brown hair, casual school clothes.
- **Noga** — medium height, darker-brown hair, **white scrunchie** on the hair (visible).
- **Noam's friend** — beside Noam on entry.
- **Two of Noga's friends** — seated with her on the bench.
- **Classroom students** — background figures (instanced) for Acts 5 & 7.

**The 7 acts (single GSAP master timeline, each a labelled section):**
1. **ENTRANCE (0–8s)** — camera follows Noam + friend from behind through the entrance; the
   bright lobby opens ahead. Walk-cycle + dolly-in.
2. **THE FIRST SIGHT (8–18s)** — Noam slows; cut to his POV of Noga laughing on the bench with
   her two friends, warm light on her; time slows slightly; Noam turns to his friend.
3. **THE APPROACH (18–30s)** — side dolly as Noam walks to the bench and starts talking; Noga
   looks up at him.
4. **UP THE STAIRS (30–40s)** — the **school bell** rings (`AudioEngine.bell()`, Web Audio,
   no file); Noam glances up, waves goodbye, walks to the staircase; camera watches him climb;
   one glance back at Noga before he disappears around the corner.
5. **THE DECISION (40–52s)** — classroom; Noam at a desk, distracted, glancing at the door;
   close-up on his face; he makes the decision and stands up mid-lesson.
6. **THE INSTAGRAM (52–68s)** — back in the lobby; Noga standing in the same spot; Noam walks
   up confidently and asks for her Instagram; she smiles and shows her phone; he types it in;
   a brief **golden glow** moment (warm spotlight intensity tweens up then settles).
7. **THE VICTORY (68–80s)** — Noam climbs back up, enters the classroom, the whole class turns
   to look, he raises his fist in victory, the class reacts; camera pulls back to reveal the
   full room as the scene **fades to black** → Phase 3.

**Cinematic camera:** every act has a distinct angle — dolly, POV cut, side tracking,
close-up, pull-back — never static. All camera moves and character poses are GSAP tweens on
the master timeline (via scene proxy setters), so pause/seek affects everything coherently.

**Lighting (bright warm spring morning — the DELIBERATE contrast to the dark wrapper):**
Scene 1 is intentionally NOT dark/cinematic like Phases 1–2. It's a happy morning memory, so it
must read bright, warm and airy — like stepping into a sunlit modern-building lobby. Bright warm
clear colour + light warm haze fog; strong warm `AmbientLight` (0.95) + a `HemisphereLight`
(sky/ground bounce) so everything is clearly visible with **no silhouettes**; the main key is a
warm `DirectionalLight` simulating **morning sunlight streaming through the glass wall** (from
−x) sweeping across the lobby; a soft warm front fill keeps faces shadow-free; a gentle warm
wash on Noga still lets the eye find her; a bright warm classroom daylight key for the far set.
Set surfaces are clean/bright modern tones; character hair/skin/scrunchie keep only a *small*
emissive as insurance, but the daylight does the work (Noam light brown, Noga dark brown + white
scrunchie). Subtle **dust particles** drift in the light beams — built with the **same
single-BufferGeometry + glow-texture + per-vertex `aOpacity` ShaderMaterial technique as the
Phase 2 burst** (one draw call, `frustumCulled=false`).

**Illuminated glass-brick wall = the main light source:** a bright warm yellow-white emissive
backing plane (unlit `MeshBasicMaterial`) glows from BEHIND a dense grid of slightly-translucent
emissive glass bricks (mortar gaps let the daylight through), framed by thin metal mullions,
with a strong warm `PointLight` spilling the glow across the lobby floor and characters — reads
as morning sun pouring through architectural glazing.

**Bench idle life:** seated Noga + her two friends run a continuous `idle` (head-bob + body
sway at offset phases) during Acts 2–3 so they never look frozen; the idle writes back into the
shared character proxy so the scripted look-up / approach tweens that follow continue smoothly.

**Performance:** mobile-first, `pixelRatio` capped at 2. Classroom desks and background
students are `InstancedMesh`; a small shared `MeshStandardMaterial` palette (skin, two hair
tones, clothing, metal, glass-emissive, wood) is reused across all geometry. Sets are static —
only transforms and material intensities animate. Timing uses the explicit `cursor` +
`anchor()` pattern from Phase 2 so `tl.duration()` stays reliable across `tl.call()` entries.

---

### Phase 5–8 — The remaining 4 Full Scenes (not built yet)

Full Three.js animated 3D scenes for: First Date · Karting + becoming official · First Kiss ·
The Sea (Nahsholim). Detailed specs will be provided when we reach each one.

---

## Build Order

1. ✅ Update CLAUDE.md with full project document
2. ✅ Phase 0 — Entry screen (touch to begin)
3. ✅ Phase 1 — Opening sequence (title cards + particles)
4. ✅ Phase 2 — Globe intro (Three.js memory globe)
5. ✅ Phase 3 skeleton transition (placeholder)
6. ✅ Phase 4 — Scene 1 "The First Meeting" (built ahead of Phase 3; reachable via ?scene=1)
7. Phase 3 — Full timeline (awaiting spec)
8. Phase 5–8 — The remaining 4 full 3D scenes (awaiting specs)

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
| 2026-05-31 | Fix 1b: All dot labels now permanent (no fade-out); tracked in labelEls array for burst animation. |
| 2026-05-31 | Fix 2b: Burst "infinite scale" zoom-out — camera z 6→16, named dot size 0.22→0.055, label CSS scale 1→0.25, globe rotation 0→0.35 rad — all GSAP tweens on master timeline. |
| 2026-05-31 | Fix 3b: Burst upgraded to 1000 dots. Single BufferGeometry + ShaderMaterial (one draw call). Per-vertex aOpacity attribute. Power curve 0.3 gives ~1/s start → ~476/s peak. 2s hold after burst. |
| 2026-05-31 | Burst spread fix: dots now use fibonacciSphereGrowing(1000, 1.8, 18, 3) — radius grows from globe (1.8) to beyond screen edges (18) with power-3 curve. Late rapid-fire dots fly furthest → synchronized speed+spread explosion → full starfield by burst end. |
| 2026-06-01 | Burst full-screen fix: replaced growing-sphere (clustered far dots at one pole) with burstStarfieldPositions — a growing aspect-aware RECTANGLE with edge-biased sampling. Guarantees edge-to-edge + corner coverage at camera z=16. |
| 2026-06-01 | Burst neighbour lines: each burst dot now connects to its 3–4 nearest already-placed dots (recent-window + distance-cutoff search). All lines batched into one BufferGeometry + ShaderMaterial (one draw call, up to 4000 lines). Both burst meshes set frustumCulled=false. |
| 2026-06-01 | Phase 4 / Scene 1 "The First Meeting" built: SchoolScene.js (Three.js lobby + classroom sets, primitive characters Noam/Noga/+3 friends, warm SpotLight + AmbientLight, instanced glass bricks/desks/students, reused burst-shader light-beam dust), scene1Sequence.js (single GSAP master timeline, 7 acts ~80s: entrance→first sight→approach→stairs+bell→classroom decision→Instagram+golden glow→victory fist + pull-back + fade-to-black), Phase4Scene1.jsx mount. Added AudioEngine.bell() (Web Audio, detuned partials). App.jsx gained PHASE4 + ?scene=1 dev-jump (normal flow unchanged; Scene 1 hands off to Phase 3). `npm run build` passes. |
| 2026-06-01 | Scene 1 visual pass (5 fixes): (1) pure-black clear colour + black fog (was washed-out grey); (2) dramatic film-noir lighting — ambient 0.55→0.12, added warm spots on the bench + staircase + a brighter dedicated Noga spot, dark/warm set surfaces; (3) self-lit (emissive) hair/skin/scrunchie so Noam's light-brown vs Noga's dark-brown hair + white scrunchie always read; (4) bench idle animations (head-bob + body sway, proxy-synced) for Noga + friends in Acts 2–3, Noga warm-highlighted; (5) glass-brick wall now glows from within (emissive backing plane behind translucent bricks + metal frame + spill light). `setGlow` rebaselined to the new lights. `npm run build` passes. |
| 2026-06-01 | Scene 1 lighting corrected — it was made too dark (over-applied film-noir). Rebalanced to a BRIGHT, warm spring-morning interior: clear colour/fog → bright warm; ambient 0.12→0.95 + added a HemisphereLight; main key is now a warm DirectionalLight = morning sunlight through the glass wall; soft warm front fill (no silhouettes); glass wall brightened to act as the main daylight source with a stronger floor spill; set surfaces lightened; character emissive reduced (daylight now does the work); Noga spot softened to a gentle wash; classroom set daylit. `setGlow` rebaselined (sun 1.35 / Noga 0.9 / glass 1.45). Dark cinematic style remains only for Phases 1–2. `npm run build` passes. |
