/**
 * SchoolScene.js — Imperative Three.js scene for Phase 4 / Scene 1
 * ("The First Meeting").
 *
 * Mirrors the lifecycle of GlobeScene.js (mount / RAF loop / resize / dispose),
 * capped at pixelRatio 2 for mobile.
 *
 * Builds, once and statically (only transforms / light intensities animate):
 *   • The Eshkol Hapayis lobby — floor, glowing glass-brick wall, metal facade
 *     columns, benches, auditorium opening, staircase
 *   • A separate classroom set placed far down +X (camera cuts there) — door,
 *     instanced desks + instanced background students, Noam's front desk
 *   • Named characters built from primitives: Noam, Noga (white scrunchie),
 *     Noam's friend, two of Noga's friends
 *   • Warm SpotLight key + AmbientLight, plus a classroom fill light
 *   • Light-beam dust — one Points BufferGeometry + glow texture + per-vertex
 *     aOpacity ShaderMaterial (same technique as the Phase 2 burst; one draw call)
 *
 * Public API (driven by scene1Sequence.js via GSAP proxies):
 *   mount(canvas) / dispose()
 *   setCamPos(x,y,z) / setCamLook(x,y,z)
 *   setCharPos(name,x,y,z) / setCharRot(name,yRad)
 *   setCharHeadTurn(name,yRad) / setCharArm(name,side,xRad) / setCharWalk(name,phase)
 *   setPropVisible(name,bool)            — toggle Noga's phone
 *   setStudentsLook(theta)               — rotate instanced student heads (Act 7 reaction)
 *   setKeyLight(intensity) / setGlow(boost)
 */

import * as THREE from 'three'

// ── Shared glow texture + dust shader (same technique as the Phase 2 burst) ──

function createGlowTexture(size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const r = size / 2
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, r)
  grad.addColorStop(0, 'rgba(255,240,200,1)')
  grad.addColorStop(0.3, 'rgba(255,230,176,0.7)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const DUST_VERT = /* glsl */`
  attribute float aOpacity;
  attribute float aSize;
  varying   float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`

const DUST_FRAG = /* glsl */`
  uniform sampler2D uTexture;
  varying float vOpacity;
  void main() {
    vec4 c = texture2D(uTexture, gl_PointCoord);
    float a = c.a * vOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`

// ── Layout constants ─────────────────────────────────────────────────────────

const BENCH = { x: 3.2, z: -1.5, seatY: 0.7 } // where Noga & friends sit
const STAIR = { x: -5.5, z: -3.0 }            // staircase base
const CLASS = { x: 80, z: 0 }                 // classroom set origin (far cut)

export default class SchoolScene {
  constructor() {
    this._renderer = null
    this._scene = null
    this._camera = null
    this._rafId = null
    this._clock = new THREE.Clock()

    this._chars = new Map()       // name → { root, headPivot, shoulderL, shoulderR, legL, legR, phone }
    this._disposables = []        // geometries / materials to free
    this._mats = {}               // shared material palette

    this._keyLight = null
    this._glassMat = null

    // Dust
    this._dustGeo = null
    this._dustMat = null
    this._dustMesh = null
    this._dustPos = null          // Float32Array
    this._dustVel = null          // Float32Array (drift)
    this._dustBase = null         // base opacities for twinkle
    this._dustCount = 0

    // Instanced student heads (for the Act 7 reaction)
    this._studentHeads = null
    this._studentHeadBase = []    // { x,y,z } base positions

    this._width = 0
    this._height = 0
    this._resizeObserver = null

    this._camLook = new THREE.Vector3(0, 1.4, 0)
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  mount(canvas) {
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor(0x000000, 1)   // pure black, matches site aesthetic

    this._scene = new THREE.Scene()
    // Dark warm fog so the set falls off into black — film-noir depth
    this._scene.fog = new THREE.Fog(0x000000, 14, 58)

    this._camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500)
    this._camera.position.set(0, 1.6, 12)
    this._camera.lookAt(this._camLook)

    this._buildMaterials()
    this._buildLights()
    this._buildLobby()
    this._buildStaircase()
    this._buildClassroom()
    this._buildCharacters()
    this._buildDust()

    this._resize(canvas)
    this._resizeObserver = new ResizeObserver(() => this._resize(canvas))
    this._resizeObserver.observe(canvas)

    const tick = () => {
      this._rafId = requestAnimationFrame(tick)
      this._updateDust(this._clock.getDelta())
      this._renderer.render(this._scene, this._camera)
    }
    tick()
  }

  _resize(canvas) {
    this._width = canvas.clientWidth
    this._height = canvas.clientHeight
    this._renderer.setSize(this._width, this._height, false)
    this._camera.aspect = this._width / this._height || 1
    this._camera.updateProjectionMatrix()
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._resizeObserver?.disconnect()
    this._disposables.forEach((d) => d?.dispose?.())
    this._dustGeo?.dispose()
    this._dustMat?.dispose()
    this._dustMat?.uniforms?.uTexture?.value?.dispose()
    this._renderer?.dispose()
  }

  // ── Materials (shared palette) ─────────────────────────────────────────────

  _buildMaterials() {
    const std = (color, opts = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts })

    this._mats = {
      // Dark, warm surfaces so the set reads as a dim cinematic interior that
      // only comes alive where the warm spotlights hit it.
      floor:    std(0x2C2820, { roughness: 0.55, metalness: 0.1 }),
      wall:     std(0x3E3934, { roughness: 0.9 }),
      metal:    std(0x6E747A, { roughness: 0.3, metalness: 0.85 }),
      glass:    new THREE.MeshStandardMaterial({
        color: 0x9CC2DE,
        emissive: 0xFFDFA0,
        emissiveIntensity: 1.7,   // glows from within
        roughness: 0.35,
        metalness: 0.1,
      }),
      bench:    std(0x4A3522),
      desk:     std(0x6E5F47),
      door:     std(0x3C2E1E),
      // Skin/hair carry a little emissive so identities & hair colours read even
      // in the darker, dramatically-lit scene (Fix 3).
      skin:     std(0xE8B98C, { roughness: 0.85, emissive: 0x3A1E0E, emissiveIntensity: 0.16 }),
      hairNoam: std(0xA06E3A, { emissive: 0x5A3C1C, emissiveIntensity: 0.35 }), // light brown
      hairNoga: std(0x2A1A0E, { emissive: 0x160C05, emissiveIntensity: 0.28 }), // dark brown
      hairAlt:  std(0x5A4632, { emissive: 0x251B10, emissiveIntensity: 0.3 }),
      scrunchie: std(0xFFFFFF, { roughness: 0.5, emissive: 0xBBBBBB, emissiveIntensity: 0.45 }),
      phone:    std(0x111118, { emissive: 0x335577, emissiveIntensity: 0.6 }),
      cloth1:   std(0x3C5070),   // Noam
      cloth2:   std(0x6B3A40),   // friend
      cloth3:   std(0x3F6B52),   // Noga
      cloth4:   std(0x6E5E46),
      cloth5:   std(0x495568),
      student:  std(0x3A3A44),
    }
    this._glassMat = this._mats.glass
    Object.values(this._mats).forEach((m) => this._disposables.push(m))
  }

  _track(geo) { this._disposables.push(geo); return geo }

  // ── Lights ─────────────────────────────────────────────────────────────────

  _buildLights() {
    // Very low warm ambient — just enough that shadows aren't pure black.
    // The scene is otherwise sculpted entirely by warm spotlights (film noir
    // with gold accents).
    const ambient = new THREE.AmbientLight(0xFFE2C0, 0.12)
    this._scene.add(ambient)

    const addSpot = (color, intensity, dist, angle, penumbra, px, py, pz, tx, ty, tz) => {
      const s = new THREE.SpotLight(color, intensity, dist, angle, penumbra, 1.4)
      s.position.set(px, py, pz)
      s.target.position.set(tx, ty, tz)
      this._scene.add(s)
      this._scene.add(s.target)
      return s
    }

    // Soft, dim warm key from the glass wall — the broad fill that defines the
    // beam volume (this is the light the GSAP "golden glow" tween lifts).
    this._keyLight = addSpot(0xFFE0A8, 0.5, 60, Math.PI / 4.5, 0.7,
      -6, 9, 6, 1, 0.5, -1)

    // Dramatic warm spot on the bench area
    addSpot(0xFFD9A0, 2.4, 30, Math.PI / 7, 0.45,
      BENCH.x - 0.5, 6.5, BENCH.z + 4.5, BENCH.x, 1.0, BENCH.z)

    // Brighter, warmer key on NOGA specifically — draws the eye to her (Fix 4)
    this._nogaLight = addSpot(0xFFE8B8, 3.0, 22, Math.PI / 11, 0.4,
      BENCH.x + 0.2, 5.2, BENCH.z + 2.8, BENCH.x, 1.25, BENCH.z + 0.1)

    // Warm spot on the staircase
    addSpot(0xFFCF8C, 2.2, 34, Math.PI / 7, 0.5,
      STAIR.x + 2.5, 7.5, STAIR.z + 3.5, STAIR.x, 1.2, STAIR.z - 2.5)

    // Cool, very faint rim from the lobby front so silhouettes separate from black
    const rim = new THREE.DirectionalLight(0x6E86B0, 0.14)
    rim.position.set(3, 5, 12)
    this._scene.add(rim)

    // Classroom warm key (far set)
    const classSpot = addSpot(0xFFE0A0, 2.0, 40, Math.PI / 5, 0.5,
      CLASS.x + 1, 6.5, CLASS.z + 5, CLASS.x - 2, 1.3, CLASS.z + 1)
    classSpot.target.updateMatrixWorld()
  }

  // ── Lobby set ────────────────────────────────────────────────────────────

  _buildLobby() {
    const M = this._mats

    const floor = new THREE.Mesh(this._track(new THREE.PlaneGeometry(40, 40)), M.floor)
    floor.rotation.x = -Math.PI / 2
    this._scene.add(floor)

    // Back wall
    const back = new THREE.Mesh(this._track(new THREE.BoxGeometry(40, 9, 0.4)), M.wall)
    back.position.set(0, 4.5, -8)
    this._scene.add(back)

    // Side wall (behind the bench)
    const side = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.4, 9, 24)), M.wall)
    side.position.set(8, 4.5, -2)
    this._scene.add(side)

    // ── Illuminated glass-brick wall (left) ─────────────────────────────────
    // Architecture: a warm backing glow plane lights a dense grid of translucent
    // glass bricks from BEHIND (mortar gaps reveal the inner light), framed by
    // thin metal mullions. A soft point light spills the glow onto the floor.
    const cols = 8, rows = 13
    const wallZ0 = -6.8, wallStepZ = 1.05
    const wallY0 = 0.5,  wallStepY = 0.62
    const wallZc = wallZ0 + (cols - 1) * wallStepZ / 2
    const wallYc = wallY0 + (rows - 1) * wallStepY / 2
    const wallW = (cols - 1) * wallStepZ + 1.0
    const wallH = (rows - 1) * wallStepY + 0.9

    // Backing glow plane (pure emissive, unlit) just behind the bricks
    this._glassGlowMat = new THREE.MeshBasicMaterial({ color: 0xFFE0A0, side: THREE.DoubleSide })
    this._disposables.push(this._glassGlowMat)
    const glowPlane = new THREE.Mesh(this._track(new THREE.PlaneGeometry(wallW, wallH)), this._glassGlowMat)
    glowPlane.rotation.y = Math.PI / 2
    glowPlane.position.set(-8.22, wallYc, wallZc)
    this._scene.add(glowPlane)

    // Translucent glass bricks in front of the glow
    const brickGeo = this._track(new THREE.BoxGeometry(0.92, 0.52, 0.22))
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0xBFD8E8, emissive: 0xFFDFA0, emissiveIntensity: 1.7,
      roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.82,
    })
    this._disposables.push(brickMat)
    this._glassMat = brickMat   // the golden-glow tween lifts this emissive
    const bricks = new THREE.InstancedMesh(brickGeo, brickMat, cols * rows)
    const m4 = new THREE.Matrix4()
    let bi = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        m4.makeRotationY(Math.PI / 2)
        m4.setPosition(-8.0, wallY0 + r * wallStepY, wallZ0 + c * wallStepZ)
        bricks.setMatrixAt(bi++, m4)
      }
    }
    bricks.instanceMatrix.needsUpdate = true
    this._scene.add(bricks)

    // Thin metal frame around the glass-brick panel
    const frameBars = [
      [0.12, wallH + 0.3, 0.25, -8.0, wallYc, wallZc - wallW / 2], // left edge
      [0.12, wallH + 0.3, 0.25, -8.0, wallYc, wallZc + wallW / 2], // right edge
      [0.12, 0.25, wallW + 0.3, -8.0, wallYc - wallH / 2, wallZc], // bottom
      [0.12, 0.25, wallW + 0.3, -8.0, wallYc + wallH / 2, wallZc], // top
    ]
    frameBars.forEach(([w, h, d, x, y, z]) => {
      const bar = new THREE.Mesh(this._track(new THREE.BoxGeometry(w, h, d)), M.metal)
      bar.position.set(x, y, z)
      this._scene.add(bar)
    })

    // Warm spill from the wall into the lobby
    const wallSpill = new THREE.PointLight(0xFFDDA0, 0.7, 18, 2)
    wallSpill.position.set(-6.5, wallYc, wallZc)
    this._scene.add(wallSpill)

    // Metal facade columns
    const colGeo = this._track(new THREE.CylinderGeometry(0.18, 0.18, 9, 12))
    const colXs = [-3, 0.5, 4]
    const columns = new THREE.InstancedMesh(colGeo, M.metal, colXs.length)
    colXs.forEach((cx, i) => {
      m4.makeTranslation(cx, 4.5, -7.6)
      columns.setMatrixAt(i, m4)
    })
    columns.instanceMatrix.needsUpdate = true
    this._scene.add(columns)

    // Auditorium opening (a dark recessed doorway in the back wall)
    const aud = new THREE.Mesh(this._track(new THREE.BoxGeometry(3.2, 5, 0.2)),
      new THREE.MeshStandardMaterial({ color: 0x14110c, roughness: 1 }))
    this._disposables.push(aud.material)
    aud.position.set(-2, 2.5, -7.75)
    this._scene.add(aud)

    // Bench where Noga sits (seat + backrest + legs)
    this._buildBench(BENCH.x, BENCH.z)
  }

  _buildBench(x, z) {
    const M = this._mats
    const seat = new THREE.Mesh(this._track(new THREE.BoxGeometry(3.0, 0.18, 0.9)), M.bench)
    seat.position.set(x, BENCH.seatY, z)
    this._scene.add(seat)

    const backrest = new THREE.Mesh(this._track(new THREE.BoxGeometry(3.0, 0.7, 0.15)), M.bench)
    backrest.position.set(x, BENCH.seatY + 0.45, z - 0.38)
    this._scene.add(backrest)

    const legGeo = this._track(new THREE.BoxGeometry(0.15, BENCH.seatY, 0.15))
    ;[-1.3, 1.3].forEach((dx) => {
      const leg = new THREE.Mesh(legGeo, M.bench)
      leg.position.set(x + dx, BENCH.seatY / 2, z)
      this._scene.add(leg)
    })
  }

  _buildStaircase() {
    const M = this._mats
    const steps = 8
    const stepGeo = this._track(new THREE.BoxGeometry(3, 0.25, 0.6))
    const stair = new THREE.InstancedMesh(stepGeo, M.wall, steps)
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < steps; i++) {
      m4.makeTranslation(STAIR.x, 0.125 + i * 0.25, STAIR.z - i * 0.6)
      stair.setMatrixAt(i, m4)
    }
    stair.instanceMatrix.needsUpdate = true
    this._scene.add(stair)

    // Railing
    const rail = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.1, 0.1, 5.5)), M.metal)
    rail.position.set(STAIR.x + 1.4, 1.4, STAIR.z - 2.4)
    rail.rotation.x = -Math.atan2(steps * 0.25, steps * 0.6)
    this._scene.add(rail)
  }

  // ── Classroom set (far down +X) ───────────────────────────────────────────

  _buildClassroom() {
    const M = this._mats
    const ox = CLASS.x, oz = CLASS.z

    const floor = new THREE.Mesh(this._track(new THREE.PlaneGeometry(20, 20)), M.floor)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(ox, 0, oz)
    this._scene.add(floor)

    const back = new THREE.Mesh(this._track(new THREE.BoxGeometry(16, 7, 0.4)), M.wall)
    back.position.set(ox, 3.5, oz - 5)
    this._scene.add(back)

    const sideWall = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.4, 7, 14)), M.wall)
    sideWall.position.set(ox - 7, 3.5, oz)
    this._scene.add(sideWall)

    // Door (where Noam enters / glances at)
    const door = new THREE.Mesh(this._track(new THREE.BoxGeometry(1.4, 3, 0.15)), M.door)
    door.position.set(ox - 6.78, 1.5, oz + 2)
    this._scene.add(door)

    // Whiteboard at front
    const wb = new THREE.Mesh(this._track(new THREE.BoxGeometry(6, 2.2, 0.1)),
      new THREE.MeshStandardMaterial({ color: 0xF2F2EA, roughness: 0.7 }))
    this._disposables.push(wb.material)
    wb.position.set(ox, 2.4, oz - 4.7)
    this._scene.add(wb)

    // Instanced desks + instanced seated students (3 cols × 4 rows = 12)
    const cols = 3, rows = 4
    const count = cols * rows
    const deskGeo = this._track(new THREE.BoxGeometry(1.0, 0.1, 0.6))
    const desks = new THREE.InstancedMesh(deskGeo, M.desk, count)

    const torsoGeo = this._track(new THREE.BoxGeometry(0.5, 0.7, 0.32))
    const torsos = new THREE.InstancedMesh(torsoGeo, M.student, count)

    const headGeo = this._track(new THREE.SphereGeometry(0.2, 16, 16))
    const heads = new THREE.InstancedMesh(headGeo, M.skin, count)

    const m4 = new THREE.Matrix4()
    this._studentHeadBase = []
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox - 2.4 + c * 2.4
        const z = oz + 1.5 - r * 1.6
        // desk
        m4.makeTranslation(x, 0.85, z)
        desks.setMatrixAt(i, m4)
        // student torso (behind desk)
        m4.makeTranslation(x, 1.05, z - 0.55)
        torsos.setMatrixAt(i, m4)
        // student head
        const hx = x, hy = 1.6, hz = z - 0.55
        m4.makeTranslation(hx, hy, hz)
        heads.setMatrixAt(i, m4)
        this._studentHeadBase.push({ x: hx, y: hy, z: hz })
        i++
      }
    }
    desks.instanceMatrix.needsUpdate = true
    torsos.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    this._scene.add(desks)
    this._scene.add(torsos)
    this._scene.add(heads)
    this._studentHeads = heads

    // Noam's own desk at the front-left (he is a full character, placed here)
    const myDesk = new THREE.Mesh(deskGeo, M.desk)
    myDesk.position.set(ox - 3.4, 0.85, oz + 2.4)
    this._scene.add(myDesk)
  }

  /**
   * Act 7 reaction: lean every instanced student head toward Noam (front-left).
   * A positional lean reads on screen where a sphere's rotation would not.
   * theta ≈ 0..0.65.
   */
  setStudentsLook(theta) {
    if (!this._studentHeads) return
    const m4 = new THREE.Matrix4()
    this._studentHeadBase.forEach((b, i) => {
      m4.makeTranslation(b.x - theta * 0.5, b.y + theta * 0.08, b.z + theta * 0.35)
      this._studentHeads.setMatrixAt(i, m4)
    })
    this._studentHeads.instanceMatrix.needsUpdate = true
  }

  // ── Characters ─────────────────────────────────────────────────────────────

  /**
   * Build a stylized character from primitives.
   * Returns a refs object; the root group is added to the scene.
   *
   * Hierarchy (so the sequence can pose it):
   *   root → hips(at legLength) → torso, headPivot, shoulderL/R
   *        → legPivotL/R (at hip) → leg meshes
   */
  _buildCharacter({ height, hair, scrunchie = false, cloth, seated = false, phone = false }) {
    const M = this._mats
    const legLen = 0.46 * height
    const torsoH = 0.34 * height
    const headR = 0.11 * height
    const armLen = 0.40 * height
    const shoulderY = legLen + torsoH

    const root = new THREE.Group()
    const hips = new THREE.Group()
    hips.position.y = legLen
    root.add(hips)

    // Torso
    const torso = new THREE.Mesh(
      this._track(new THREE.BoxGeometry(0.42 * height / 1.8, torsoH, 0.24 * height / 1.8)), cloth)
    torso.position.y = torsoH / 2
    hips.add(torso)

    // Head pivot (turns left/right)
    const headPivot = new THREE.Group()
    headPivot.position.y = torsoH
    hips.add(headPivot)

    const neck = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8)), M.skin)
    neck.position.y = 0.04
    headPivot.add(neck)

    const head = new THREE.Mesh(this._track(new THREE.SphereGeometry(headR, 18, 18)), M.skin)
    head.position.y = headR + 0.06
    headPivot.add(head)

    // Hair — a slightly larger cap pushed to the back/top
    const hairMesh = new THREE.Mesh(
      this._track(new THREE.SphereGeometry(headR * 1.08, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hair)
    hairMesh.position.y = headR + 0.09
    headPivot.add(hairMesh)

    if (scrunchie) {
      // White scrunchie — a small torus at the back of the head (ponytail tie)
      const sc = new THREE.Mesh(this._track(new THREE.TorusGeometry(headR * 0.5, headR * 0.22, 8, 16)), M.scrunchie)
      sc.position.set(0, headR + 0.12, -headR * 0.95)
      sc.rotation.x = Math.PI / 2
      headPivot.add(sc)
      // a little ponytail bulb behind it
      const tail = new THREE.Mesh(this._track(new THREE.SphereGeometry(headR * 0.55, 12, 12)), hair)
      tail.position.set(0, headR - 0.02, -headR * 1.3)
      headPivot.add(tail)
    }

    // Shoulders / arms
    const makeArm = (side) => {
      const shoulder = new THREE.Group()
      shoulder.position.set(side * (0.16 * height / 1.8), torsoH - 0.02, 0)
      const arm = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.05, 0.045, armLen, 8)), cloth)
      arm.position.y = -armLen / 2
      shoulder.add(arm)
      const hand = new THREE.Mesh(this._track(new THREE.SphereGeometry(0.055, 10, 10)), M.skin)
      hand.position.y = -armLen
      shoulder.add(hand)
      hips.add(shoulder)
      return { shoulder, hand }
    }
    const armL = makeArm(-1)
    const armR = makeArm(1)

    // Legs (pivot at hip)
    const makeLeg = (side) => {
      const pivot = new THREE.Group()
      pivot.position.set(side * 0.1, 0, 0)
      const leg = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.07, 0.06, legLen, 8)), M.metal)
      leg.material = cloth
      leg.position.y = -legLen / 2
      pivot.add(leg)
      const foot = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.12, 0.07, 0.24)), M.door)
      foot.position.set(0, -legLen, 0.06)
      pivot.add(foot)
      hips.add(pivot)
      return pivot
    }
    const legL = makeLeg(-1)
    const legR = makeLeg(1)

    // Optional phone prop in the right hand
    let phoneMesh = null
    if (phone) {
      phoneMesh = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.09, 0.16, 0.02)), M.phone)
      phoneMesh.position.y = -armLen - 0.02
      phoneMesh.visible = false
      armR.shoulder.add(phoneMesh)
    }

    // Standing rest pose: arms hang slightly out
    armL.shoulder.rotation.z = 0.12
    armR.shoulder.rotation.z = -0.12

    if (seated) {
      // Thighs forward → reads as sitting on the bench
      legL.rotation.x = -1.4
      legR.rotation.x = -1.4
      root.position.y = BENCH.seatY - legLen + 0.04
    }

    this._scene.add(root)
    return {
      root, headPivot, shoulderL: armL.shoulder, shoulderR: armR.shoulder,
      legL, legR, phone: phoneMesh, armLen, shoulderY,
    }
  }

  _buildCharacters() {
    const M = this._mats

    // Noam — tall, light-brown hair. Starts just outside the entrance.
    const noam = this._buildCharacter({ height: 1.9, hair: M.hairNoam, cloth: M.cloth1 })
    noam.root.position.set(-0.6, 0, 11)
    noam.root.rotation.y = Math.PI // facing into the lobby (−z)
    this._chars.set('noam', noam)

    // Noam's friend — beside him
    const friend = this._buildCharacter({ height: 1.78, hair: M.hairAlt, cloth: M.cloth2 })
    friend.root.position.set(0.8, 0, 11.2)
    friend.root.rotation.y = Math.PI
    this._chars.set('friend', friend)

    // Noga — seated on the bench, white scrunchie, holds a phone (Act 6)
    const noga = this._buildCharacter({
      height: 1.66, hair: M.hairNoga, scrunchie: true, cloth: M.cloth3,
      seated: true, phone: true,
    })
    noga.root.position.set(BENCH.x, noga.root.position.y, BENCH.z + 0.1)
    noga.root.rotation.y = 0 // facing +z (toward the lobby / camera)
    this._chars.set('noga', noga)

    // Noga's two friends on the bench
    const nf1 = this._buildCharacter({ height: 1.6, hair: M.hairAlt, cloth: M.cloth4, seated: true })
    nf1.root.position.set(BENCH.x - 1.0, nf1.root.position.y, BENCH.z + 0.1)
    this._chars.set('nogaFriend1', nf1)

    const nf2 = this._buildCharacter({ height: 1.62, hair: M.hairNoga, cloth: M.cloth5, seated: true })
    nf2.root.position.set(BENCH.x + 1.0, nf2.root.position.y, BENCH.z + 0.1)
    this._chars.set('nogaFriend2', nf2)
  }

  // ── Character pose API ─────────────────────────────────────────────────────

  setCharPos(name, x, y, z) {
    const c = this._chars.get(name); if (!c) return
    c.root.position.set(x, y, z)
  }

  setCharRot(name, yRad) {
    const c = this._chars.get(name); if (!c) return
    c.root.rotation.y = yRad
  }

  setCharHeadTurn(name, yRad) {
    const c = this._chars.get(name); if (!c) return
    c.headPivot.rotation.y = yRad
  }

  /** Raise/lower an arm at the shoulder. xRad: 0 = down, −PI ≈ straight up. */
  setCharArm(name, side, xRad) {
    const c = this._chars.get(name); if (!c) return
    const sh = side === 'left' ? c.shoulderL : c.shoulderR
    if (sh) sh.rotation.x = xRad
  }

  /** Walk cycle: swing legs (and arms counter-phase) from a phase in radians. */
  setCharWalk(name, phase) {
    const c = this._chars.get(name); if (!c) return
    const s = Math.sin(phase) * 0.5
    c.legL.rotation.x = s
    c.legR.rotation.x = -s
    if (c.shoulderL) c.shoulderL.rotation.x = -s * 0.6
    if (c.shoulderR) c.shoulderR.rotation.x = s * 0.6
  }

  setPropVisible(name, visible) {
    const c = this._chars.get(name); if (!c || !c.phone) return
    c.phone.visible = visible
  }

  /** Convert a seated character to a standing pose (legs down, feet on floor). */
  setStanding(name) {
    const c = this._chars.get(name); if (!c) return
    c.legL.rotation.x = 0
    c.legR.rotation.x = 0
    c.root.position.y = 0
  }

  getCharWorldPos(name) {
    const c = this._chars.get(name)
    return c ? c.root.position.clone() : new THREE.Vector3()
  }

  // ── Camera API ───────────────────────────────────────────────────────────

  setCamPos(x, y, z) {
    if (!this._camera) return
    this._camera.position.set(x, y, z)
    this._camera.lookAt(this._camLook)
  }

  setCamLook(x, y, z) {
    if (!this._camera) return
    this._camLook.set(x, y, z)
    this._camera.lookAt(this._camLook)
  }

  // ── Light API ──────────────────────────────────────────────────────────────

  setKeyLight(intensity) {
    if (this._keyLight) this._keyLight.intensity = intensity
  }

  /**
   * Golden-glow boost (Act 6). boost 0 restores the cinematic baseline; a
   * positive boost lifts the key light, the wall glow and Noga's highlight
   * together so the warm light visibly intensifies for the Instagram moment.
   */
  setGlow(boost) {
    if (this._keyLight) this._keyLight.intensity = 0.5 + boost * 1.3
    if (this._nogaLight) this._nogaLight.intensity = 3.0 + boost * 1.6
    if (this._glassMat) this._glassMat.emissiveIntensity = 1.7 + boost * 1.1
    if (this._glassGlowMat) {
      const v = Math.min(1, 0.88 + boost * 0.12)
      this._glassGlowMat.color.setRGB(v, v * 0.86, v * 0.6)
    }
  }

  // ── Dust (light-beam motes, one draw call) ──────────────────────────────────

  _buildDust() {
    const COUNT = 160
    this._dustCount = COUNT
    const pos = new Float32Array(COUNT * 3)
    const op = new Float32Array(COUNT)
    const sz = new Float32Array(COUNT)
    this._dustVel = new Float32Array(COUNT * 3)
    this._dustBase = new Float32Array(COUNT)

    // Confine motes to the lobby light-beam volume
    for (let i = 0; i < COUNT; i++) {
      const x = -2 + Math.random() * 6     // beam roughly over lobby centre
      const y = 0.5 + Math.random() * 6
      const z = -5 + Math.random() * 8
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      const base = 0.12 + Math.random() * 0.3
      op[i] = base
      this._dustBase[i] = base
      sz[i] = 0.04 + Math.random() * 0.06
      this._dustVel[i * 3] = (Math.random() - 0.5) * 0.05
      this._dustVel[i * 3 + 1] = 0.02 + Math.random() * 0.05   // slow rise
      this._dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.05
    }

    const geo = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage)
    const opAttr = new THREE.BufferAttribute(op, 1); opAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', posAttr)
    geo.setAttribute('aOpacity', opAttr)
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTexture: { value: createGlowTexture(64) } },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const mesh = new THREE.Points(geo, mat)
    mesh.frustumCulled = false   // motes drift; stale bounds would cull them
    this._scene.add(mesh)

    this._dustGeo = geo
    this._dustMat = mat
    this._dustMesh = mesh
    this._dustPos = pos
    this._dustElapsed = 0
  }

  _updateDust(dt) {
    if (!this._dustGeo) return
    const d = Math.min(dt, 0.05)
    this._dustElapsed += d
    const pos = this._dustPos
    const op = this._dustGeo.attributes.aOpacity.array
    for (let i = 0; i < this._dustCount; i++) {
      const o = i * 3
      pos[o] += this._dustVel[o] * d
      pos[o + 1] += this._dustVel[o + 1] * d
      pos[o + 2] += this._dustVel[o + 2] * d
      // wrap upward drift back to the floor of the beam
      if (pos[o + 1] > 6.5) {
        pos[o + 1] = 0.5
        pos[o] = -2 + Math.random() * 6
        pos[o + 2] = -5 + Math.random() * 8
      }
      // gentle twinkle
      op[i] = this._dustBase[i] * (0.6 + 0.4 * Math.sin(this._dustElapsed * 1.5 + i))
    }
    this._dustGeo.attributes.position.needsUpdate = true
    this._dustGeo.attributes.aOpacity.needsUpdate = true
  }
}
