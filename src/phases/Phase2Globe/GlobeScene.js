/**
 * GlobeScene.js — Imperative Three.js scene for Phase 2.
 *
 * Renders:
 *   • Named dots (11 individual Points meshes, PointsMaterial, sizeAttenuation)
 *   • Connection lines (LineSegments, additive blending)
 *   • Burst dots — a single Points mesh backed by a pre-allocated BufferGeometry
 *     with a per-vertex aOpacity attribute and a ShaderMaterial. One draw call
 *     for all 1000 burst dots regardless of how many are active.
 *
 * Public API:
 *   mount(canvas)              attach renderer; starts RAF loop
 *   dispose()                  clean up all WebGL resources
 *   spawnDotAtScreenCenter()   place a named dot at origin, opacity 0; returns index
 *   setDotWorldPos(i,x,y,z)    move named dot i to world position
 *   setDotOpacity(i,v)         set named dot i's opacity
 *   getDotPosition(i)          returns THREE.Vector3
 *   projectToScreen(v3)        world → screen {x,y} pixels
 *   connect(a,b)               add a glowing line between two named dot indices
 *   setLineOpacity(i,v)        set line i opacity
 *   initBurstSystem(count)     pre-allocate the burst buffer for 'count' dots
 *   setBurstDotPos(i,x,y,z)    write burst dot i's position into the buffer
 *   setBurstDotOpacity(i,v)    write burst dot i's opacity into the buffer
 *   initBurstLines(maxLines)   pre-allocate the burst nearest-neighbour line buffer
 *   addBurstLine(...,opacity)  add one neighbour line between two world points
 *   setCameraZ(z)              animate camera pullback (zoom-out)
 *   setNamedDotSize(s)         shrink all named dot materials' size uniform
 *   rotateGroup(angle)         set Y-rotation of the whole globe group
 */

import * as THREE from 'three'

// ── Glow sprite texture ────────────────────────────────────────────────────

function createGlowTexture(size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx  = size / 2
  const r   = size / 2
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, r)
  grad.addColorStop(0,   '#E8C97E')
  grad.addColorStop(0.3, '#E8C97E')
  grad.addColorStop(0.7, 'rgba(200,169,110,0.4)')
  grad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

// ── Burst shader (handles per-vertex opacity for 1000 dots in one draw call) ──

const BURST_VERT = /* glsl */`
  attribute float aOpacity;
  varying   float vOpacity;
  uniform   float uSize;

  void main() {
    vOpacity = aOpacity;
    vec4 mv  = modelViewMatrix * vec4(position, 1.0);
    // Perspective-correct sizing — matches the feel of PointsMaterial sizeAttenuation
    gl_PointSize = uSize * (300.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`

const BURST_FRAG = /* glsl */`
  uniform sampler2D uTexture;
  varying float     vOpacity;

  void main() {
    vec4 c = texture2D(uTexture, gl_PointCoord);
    float a = c.a * vOpacity;
    if (a < 0.005) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`

// ── Burst-line shader (per-vertex opacity → all neighbour lines in one call) ──

const BURST_LINE_VERT = /* glsl */`
  attribute float aOpacity;
  varying   float vOpacity;
  void main() {
    vOpacity = aOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BURST_LINE_FRAG = /* glsl */`
  uniform vec3  uColor;
  varying float vOpacity;
  void main() {
    if (vOpacity < 0.002) discard;
    gl_FragColor = vec4(uColor, vOpacity);
  }
`

// ── Scene class ────────────────────────────────────────────────────────────

export default class GlobeScene {
  constructor() {
    this._renderer  = null
    this._scene     = null
    this._camera    = null
    this._group     = null
    this._rafId     = null

    this._dotMeshes = []   // { mesh: Points, pos3: Vector3 }
    this._lines     = []   // { mesh: LineSegments }
    this._glowTex   = null

    // Burst dot system
    this._burstGeo      = null
    this._burstPositions = null   // Float32Array (count * 3)
    this._burstOpacities = null   // Float32Array (count)
    this._burstMat      = null
    this._burstMesh     = null
    this._burstActive   = false

    // Burst line system (nearest-neighbour lines, single draw call)
    this._burstLineGeo     = null
    this._burstLinePos     = null   // Float32Array (maxLines * 2 * 3)
    this._burstLineOpacity = null   // Float32Array (maxLines * 2)
    this._burstLineMat     = null
    this._burstLineMesh    = null
    this._burstLineCount   = 0      // lines used so far
    this._burstLineMax     = 0
    this._burstLinesDirty  = false

    this._width  = 0
    this._height = 0
    this._resizeObserver = null
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  mount(canvas) {
    this._glowTex = createGlowTexture(64)

    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor(0x000000, 0)

    this._scene = new THREE.Scene()

    this._camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    this._camera.position.set(0, 0.5, 6)
    this._camera.lookAt(0, 0, 0)

    this._group = new THREE.Group()
    this._scene.add(this._group)

    this._resize(canvas)
    this._resizeObserver = new ResizeObserver(() => this._resize(canvas))
    this._resizeObserver.observe(canvas)

    const tick = () => {
      this._rafId = requestAnimationFrame(tick)
      // Re-upload burst dot buffers every frame while burst is active (cheap: ~16 KB)
      if (this._burstActive && this._burstGeo) {
        this._burstGeo.attributes.position.needsUpdate = true
        this._burstGeo.attributes.aOpacity.needsUpdate = true
      }
      // Upload burst line buffers only when new lines were added (dirty flag)
      if (this._burstLinesDirty && this._burstLineGeo) {
        this._burstLineGeo.attributes.position.needsUpdate = true
        this._burstLineGeo.attributes.aOpacity.needsUpdate = true
        this._burstLineGeo.setDrawRange(0, this._burstLineCount * 2)
        this._burstLinesDirty = false
      }
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
    if (this._burstGeo)  { this._burstGeo.dispose() }
    if (this._burstMat)  { this._burstMat.dispose()  }
    if (this._burstMesh) { this._group.remove(this._burstMesh) }
    if (this._burstLineGeo)  { this._burstLineGeo.dispose() }
    if (this._burstLineMat)  { this._burstLineMat.dispose()  }
    if (this._burstLineMesh) { this._group.remove(this._burstLineMesh) }
    this._renderer?.dispose()
  }

  // ── Named dot API ────────────────────────────────────────────────────────

  spawnDotAtScreenCenter() {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3))

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
    this._dotMeshes.push({ mesh, pos3: new THREE.Vector3() })
    return this._dotMeshes.length - 1
  }

  setDotWorldPos(i, x, y, z) {
    const d = this._dotMeshes[i]
    if (!d) return
    d.pos3.set(x, y, z)
    const arr = d.mesh.geometry.attributes.position.array
    arr[0] = x; arr[1] = y; arr[2] = z
    d.mesh.geometry.attributes.position.needsUpdate = true
  }

  setDotOpacity(i, v) {
    if (this._dotMeshes[i]) this._dotMeshes[i].mesh.material.opacity = v
  }

  getDotPosition(i) {
    return this._dotMeshes[i]?.pos3 ?? new THREE.Vector3()
  }

  /** Shrink all named dot materials' size — used during the burst zoom-out. */
  setNamedDotSize(s) {
    this._dotMeshes.forEach(({ mesh }) => { mesh.material.size = s })
  }

  projectToScreen(v3) {
    if (!this._camera || !this._width) return { x: 0, y: 0 }
    const p = v3.clone().applyMatrix4(this._group.matrixWorld)
    p.project(this._camera)
    return {
      x: ( p.x * 0.5 + 0.5) * this._width,
      y: (-p.y * 0.5 + 0.5) * this._height,
    }
  }

  // ── Connection lines ─────────────────────────────────────────────────────

  connect(a, b) {
    const pA = this._dotMeshes[a]?.pos3 ?? new THREE.Vector3()
    const pB = this._dotMeshes[b]?.pos3 ?? new THREE.Vector3()

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([pA.x, pA.y, pA.z, pB.x, pB.y, pB.z]), 3))

    const mat = new THREE.LineBasicMaterial({
      color:       0xC8A96E,
      transparent: true,
      opacity:     0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })

    const mesh = new THREE.LineSegments(geo, mat)
    this._group.add(mesh)
    this._lines.push({ mesh })
    return this._lines.length - 1
  }

  setLineOpacity(i, v) {
    if (this._lines[i]) this._lines[i].mesh.material.opacity = v
  }

  // ── Burst system (single draw call for 1000 dots) ────────────────────────

  /**
   * Pre-allocate a BufferGeometry for `count` burst dots.
   * All start at origin (0,0,0) with opacity 0.
   * Must be called before any setBurstDot* calls.
   */
  initBurstSystem(count) {
    const positions = new Float32Array(count * 3)  // all (0,0,0)
    const opacities = new Float32Array(count)       // all 0

    const geo = new THREE.BufferGeometry()

    const posAttr = new THREE.BufferAttribute(positions, 3)
    const opAttr  = new THREE.BufferAttribute(opacities, 1)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    opAttr.setUsage(THREE.DynamicDrawUsage)

    geo.setAttribute('position', posAttr)
    geo.setAttribute('aOpacity', opAttr)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: this._glowTex },
        uSize:    { value: 0.12 },
      },
      vertexShader:   BURST_VERT,
      fragmentShader: BURST_FRAG,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    })

    const mesh = new THREE.Points(geo, mat)
    mesh.frustumCulled = false   // positions start at origin then fly out; don't cull on stale bounds
    this._group.add(mesh)

    this._burstGeo       = geo
    this._burstPositions = positions
    this._burstOpacities = opacities
    this._burstMat       = mat
    this._burstMesh      = mesh
    this._burstActive    = true
  }

  /** Write burst dot i's world position directly into the shared buffer. */
  setBurstDotPos(i, x, y, z) {
    if (!this._burstPositions) return
    const o = i * 3
    this._burstPositions[o]     = x
    this._burstPositions[o + 1] = y
    this._burstPositions[o + 2] = z
  }

  /** Write burst dot i's opacity into the shared buffer. */
  setBurstDotOpacity(i, v) {
    if (this._burstOpacities) this._burstOpacities[i] = v
  }

  // ── Burst nearest-neighbour lines (single draw call) ─────────────────────

  /**
   * Pre-allocate the burst-line geometry for up to `maxLines` lines.
   * Same thin glowing additive-gold style as the named connection lines.
   */
  initBurstLines(maxLines) {
    const positions = new Float32Array(maxLines * 2 * 3)
    const opacities = new Float32Array(maxLines * 2)

    const geo = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(positions, 3)
    const opAttr  = new THREE.BufferAttribute(opacities, 1)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    opAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', posAttr)
    geo.setAttribute('aOpacity', opAttr)
    geo.setDrawRange(0, 0)

    const mat = new THREE.ShaderMaterial({
      uniforms:       { uColor: { value: new THREE.Color(0xC8A96E) } },
      vertexShader:   BURST_LINE_VERT,
      fragmentShader: BURST_LINE_FRAG,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    })

    const mesh = new THREE.LineSegments(geo, mat)
    mesh.frustumCulled = false   // dots fill the whole frustum; never cull
    this._group.add(mesh)

    this._burstLineGeo     = geo
    this._burstLinePos     = positions
    this._burstLineOpacity = opacities
    this._burstLineMat     = mat
    this._burstLineMesh    = mesh
    this._burstLineCount   = 0
    this._burstLineMax     = maxLines
  }

  /**
   * Add one burst line between two world points at a fixed opacity.
   * Silently ignored once the pre-allocated capacity is reached.
   */
  addBurstLine(ax, ay, az, bx, by, bz, opacity) {
    if (!this._burstLinePos || this._burstLineCount >= this._burstLineMax) return
    const li = this._burstLineCount
    const po = li * 6
    const oo = li * 2
    this._burstLinePos[po]     = ax
    this._burstLinePos[po + 1] = ay
    this._burstLinePos[po + 2] = az
    this._burstLinePos[po + 3] = bx
    this._burstLinePos[po + 4] = by
    this._burstLinePos[po + 5] = bz
    this._burstLineOpacity[oo]     = opacity
    this._burstLineOpacity[oo + 1] = opacity
    this._burstLineCount = li + 1
    this._burstLinesDirty = true
  }

  // ── Camera & group ────────────────────────────────────────────────────────

  /** Pull the camera back along Z — creates the zoom-out / infinite-scale effect. */
  setCameraZ(z) {
    if (this._camera) {
      this._camera.position.z = z
      // Keep looking at origin
      this._camera.lookAt(0, 0, 0)
    }
  }

  rotateGroup(angle) {
    if (this._group) this._group.rotation.y = angle
  }

  getRotation() {
    return this._group?.rotation.y ?? 0
  }
}
