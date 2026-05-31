/**
 * GlobeScene.js — Imperative Three.js scene for Phase 2.
 *
 * The scene renders:
 *   • Named dots (Points geometry with a canvas-generated glow sprite)
 *   • Connection lines between dots (LineSegments with additive blending)
 *   • A burst cloud of many extra tiny dots for the final burst
 *
 * All positioning is done in world space; the globeSequence.js GSAP
 * timeline calls the public API here.
 *
 * Public API:
 *   scene.mount(canvas)             — attach renderer to canvas element
 *   scene.dispose()                 — clean up WebGL resources
 *   scene.spawnDotAtScreenCenter()  — place a dot at world origin (0,0,0), opacity 0
 *   scene.flyDotTo(index, pos)      — GSAP-animate dot[index] to world pos
 *   scene.showLabel(index, title)   — (DOM, delegated to Phase2Globe.jsx)
 *   scene.connect(a, b)             — add a line between two dot indices
 *   scene.setDotOpacity(i, v)       — for GSAP tween targets
 *   scene.setLineOpacity(i, v)      — for line fade-in tweens
 *   scene.getDotPosition(i)         — returns THREE.Vector3
 *   scene.projectToScreen(v3)       — world → screen {x, y} in pixels
 *   scene.spawnBurstDot(pos)        — add an extra burst dot
 *   scene.rotateGroup(angle)        — set Y-rotation of the whole globe group
 */

import * as THREE from 'three'

// ── Glow sprite texture ────────────────────────────────────────────────────

function createGlowTexture(color = '#C8A96E', size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const cx = size / 2
  const r  = size / 2
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, r)
  grad.addColorStop(0,    color)
  grad.addColorStop(0.3,  color)
  grad.addColorStop(0.7,  color.replace(')', ', 0.4)').replace('rgb', 'rgba'))
  grad.addColorStop(1,    'transparent')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

// ── Scene class ────────────────────────────────────────────────────────────

export default class GlobeScene {
  constructor() {
    this._renderer   = null
    this._scene      = null
    this._camera     = null
    this._group      = null        // all globe content lives here
    this._rafId      = null

    this._dotMeshes  = []          // { mesh, position: THREE.Vector3, opacity: proxy }
    this._lines      = []          // { mesh, opacity: proxy }
    this._glowTex    = null

    this._width  = 0
    this._height = 0
    this._resizeObserver = null
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  mount(canvas) {
    this._glowTex = createGlowTexture('#E8C97E', 64)

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor(0x000000, 0)

    // Scene
    this._scene = new THREE.Scene()

    // Camera — slight downward tilt so the globe reads like a "world"
    this._camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
    this._camera.position.set(0, 0.5, 6)
    this._camera.lookAt(0, 0, 0)

    // Group that rotates
    this._group = new THREE.Group()
    this._scene.add(this._group)

    // Size
    this._resize(canvas)
    this._resizeObserver = new ResizeObserver(() => this._resize(canvas))
    this._resizeObserver.observe(canvas)

    // Render loop
    const tick = () => {
      this._rafId = requestAnimationFrame(tick)
      this._renderer.render(this._scene, this._camera)
    }
    tick()
  }

  _resize(canvas) {
    this._width  = canvas.clientWidth
    this._height = canvas.clientHeight
    this._renderer.setSize(this._width, this._height, false)
    this._camera.aspect = this._width / this._height
    this._camera.updateProjectionMatrix()
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._resizeObserver?.disconnect()
    this._glowTex?.dispose()
    this._dotMeshes.forEach(({ mesh }) => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      this._group.remove(mesh)
    })
    this._lines.forEach(({ mesh }) => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      this._group.remove(mesh)
    })
    this._renderer?.dispose()
  }

  // ── Dot API ──────────────────────────────────────────────────────────────

  /**
   * Create a dot at world origin (0,0,0), initially invisible.
   * Returns the dot index.
   */
  spawnDotAtScreenCenter() {
    const geo  = new THREE.BufferGeometry()
    const pos  = new Float32Array([0, 0, 0])
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const mat = new THREE.PointsMaterial({
      size:            0.22,
      map:             this._glowTex,
      transparent:     true,
      opacity:         0,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const mesh = new THREE.Points(geo, mat)
    this._group.add(mesh)

    const dotObj = {
      mesh,
      pos3: new THREE.Vector3(0, 0, 0),
    }
    this._dotMeshes.push(dotObj)
    return this._dotMeshes.length - 1
  }

  /** Move dot[i] to world position [x,y,z] */
  setDotWorldPos(i, x, y, z) {
    const d = this._dotMeshes[i]
    if (!d) return
    d.pos3.set(x, y, z)
    const arr = d.mesh.geometry.attributes.position.array
    arr[0] = x; arr[1] = y; arr[2] = z
    d.mesh.geometry.attributes.position.needsUpdate = true
  }

  /** Get a dot's current opacity (for GSAP getter) */
  getDotOpacity(i) {
    return this._dotMeshes[i]?.mesh.material.opacity ?? 0
  }

  /** Set a dot's opacity (called by GSAP) */
  setDotOpacity(i, v) {
    if (this._dotMeshes[i]) this._dotMeshes[i].mesh.material.opacity = v
  }

  getDotPosition(i) {
    return this._dotMeshes[i]?.pos3 ?? new THREE.Vector3()
  }

  /** Project a Three.js Vector3 to screen pixel coords */
  projectToScreen(v3) {
    if (!this._camera || !this._width) return { x: 0, y: 0 }
    const p = v3.clone().applyMatrix4(this._group.matrixWorld)
    p.project(this._camera)
    return {
      x: (p.x * 0.5 + 0.5) * this._width,
      y: (-p.y * 0.5 + 0.5) * this._height,
    }
  }

  // ── Connection lines ─────────────────────────────────────────────────────

  /**
   * Draw a connection line between dot[a] and dot[b].
   * Returns the line index.
   */
  connect(a, b) {
    const pA = this._dotMeshes[a]?.pos3 ?? new THREE.Vector3()
    const pB = this._dotMeshes[b]?.pos3 ?? new THREE.Vector3()

    const pts = [pA.x, pA.y, pA.z, pB.x, pB.y, pB.z]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))

    const mat = new THREE.LineBasicMaterial({
      color:       0xC8A96E,
      transparent: true,
      opacity:     0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })

    const mesh = new THREE.LineSegments(geo, mat)
    this._group.add(mesh)

    const lineObj = { mesh, a, b }
    this._lines.push(lineObj)
    return this._lines.length - 1
  }

  getLineOpacity(i) {
    return this._lines[i]?.mesh.material.opacity ?? 0
  }

  setLineOpacity(i, v) {
    if (this._lines[i]) this._lines[i].mesh.material.opacity = v
  }

  // ── Burst ────────────────────────────────────────────────────────────────

  /**
   * Spawn a tiny burst dot at a given world position (initially at origin).
   * Returns its index so GSAP can tween it.
   */
  spawnBurstDot() {
    const geo  = new THREE.BufferGeometry()
    const pos  = new Float32Array([0, 0, 0])
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const mat = new THREE.PointsMaterial({
      size:            0.10,
      map:             this._glowTex,
      transparent:     true,
      opacity:         0,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const mesh = new THREE.Points(geo, mat)
    this._group.add(mesh)

    const dotObj = { mesh, pos3: new THREE.Vector3() }
    this._dotMeshes.push(dotObj)
    return this._dotMeshes.length - 1
  }

  // ── Globe rotation ───────────────────────────────────────────────────────

  rotateGroup(angle) {
    if (this._group) this._group.rotation.y = angle
  }

  getRotation() {
    return this._group?.rotation.y ?? 0
  }
}
