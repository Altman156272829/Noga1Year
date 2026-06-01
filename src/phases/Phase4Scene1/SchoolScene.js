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
    this._renderer.setClearColor(0x0a0a0f, 1)

    this._scene = new THREE.Scene()
    this._scene.fog = new THREE.Fog(0x14110c, 22, 70)

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
      floor:    std(0xCFC7B6, { roughness: 0.7 }),
      wall:     std(0xE6E0D4),
      metal:    std(0x9AA0A6, { roughness: 0.35, metalness: 0.8 }),
      glass:    new THREE.MeshStandardMaterial({
        color: 0xBFD8E8,
        emissive: 0xFFE6B0,
        emissiveIntensity: 0.9,
        roughness: 0.4,
        metalness: 0.1,
      }),
      bench:    std(0x8A6B45),
      desk:     std(0xC8B89A),
      door:     std(0x6B5238),
      skin:     std(0xE8B98C, { roughness: 0.9 }),
      hairNoam: std(0x6B4A2B),   // light brown
      hairNoga: std(0x33220F),   // darker brown
      hairAlt:  std(0x4A3A2A),
      scrunchie: std(0xF5F5F0, { roughness: 0.6 }),
      phone:    std(0x111118, { emissive: 0x335577, emissiveIntensity: 0.6 }),
      cloth1:   std(0x44556B),   // Noam
      cloth2:   std(0x6B4044),   // friend
      cloth3:   std(0x4E6147),   // Noga
      cloth4:   std(0x7A6A52),
      cloth5:   std(0x556070),
      student:  std(0x5A5A66),
    }
    this._glassMat = this._mats.glass
    Object.values(this._mats).forEach((m) => this._disposables.push(m))
  }

  _track(geo) { this._disposables.push(geo); return geo }

  // ── Lights ─────────────────────────────────────────────────────────────────

  _buildLights() {
    const ambient = new THREE.AmbientLight(0xFFE8CC, 0.55)
    this._scene.add(ambient)

    // Warm key spotlight angled in from the glass wall — casts the light beam
    const key = new THREE.SpotLight(0xFFE6B0, 1.4, 60, Math.PI / 5, 0.5, 1.2)
    key.position.set(-6, 9, 6)
    key.target.position.set(1, 0.5, -1)
    this._scene.add(key)
    this._scene.add(key.target)
    this._keyLight = key

    // Soft cool fill from the lobby front so silhouettes read
    const fill = new THREE.DirectionalLight(0xCFE0FF, 0.35)
    fill.position.set(4, 6, 10)
    this._scene.add(fill)

    // Classroom fill (far set)
    const classLight = new THREE.PointLight(0xFFEAC0, 0.9, 40)
    classLight.position.set(CLASS.x, 5, CLASS.z + 3)
    this._scene.add(classLight)
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

    // Glowing glass-brick wall — instanced grid of emissive bricks on the left
    const brickGeo = this._track(new THREE.BoxGeometry(0.95, 0.6, 0.3))
    const cols = 6, rows = 12
    const bricks = new THREE.InstancedMesh(brickGeo, M.glass, cols * rows)
    const m4 = new THREE.Matrix4()
    let bi = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -8 + 0.02 // wall plane at x=-8
        const y = 0.5 + r * 0.65
        const z = -6.5 + c * 1.05
        m4.makeRotationY(Math.PI / 2)
        m4.setPosition(x, y, z)
        bricks.setMatrixAt(bi++, m4)
      }
    }
    bricks.instanceMatrix.needsUpdate = true
    this._scene.add(bricks)

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

  /** Golden-glow boost (Act 6): lift key light + glass emissive together. */
  setGlow(boost) {
    if (this._keyLight) this._keyLight.intensity = 1.4 + boost
    if (this._glassMat) this._glassMat.emissiveIntensity = 0.9 + boost * 0.8
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
