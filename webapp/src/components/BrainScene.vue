<script setup>
// 3D head: template brain (MNI152) coloured by estimated field, deep
// structures, coils at their 10-05 sites, optional scalp shell and site grid.
// MNI axes are used directly (x right, y front, z up).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, MeshStandardMaterial,
  CylinderGeometry, SphereGeometry, Group, Vector3, Quaternion, Color, DoubleSide, HemisphereLight, DirectionalLight,
  Points, PointsMaterial, Raycaster, Vector2, RingGeometry, MeshBasicMaterial,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { fieldColor, scalePos, SITES } from '../lib/brain.js'
import { HEAD_CENTRE } from '../engine/field.js'

const props = defineProps({
  brain: { type: Object, required: true },
  values: { type: Object, default: null }, // { meshKey: Float32Array µT per vertex }
  coils: { type: Array, default: () => [] }, // [{site, face, axis, ch, weight}] or null
  levels: { type: Array, default: null }, // live |drive| 0..1 per channel
  glass: { type: Boolean, default: true },
  showDeep: { type: Boolean, default: true },
  showHead: { type: Boolean, default: false },
  showSites: { type: Boolean, default: false },
  highlight: { type: Array, default: null }, // MNI point
  view: { type: String, default: 'iso' },
})
const emit = defineEmits(['pick'])

const host = ref(null)
let renderer, labels, scene, camera, controls, raf = 0, dirty = true, resizeObs
const meshes = {}
let coilGroup, headMesh, siteCloud, marker

const TARGET = new Vector3(0, -18, 12)
const VIEWS = {
  left: [-1, 0, 0.05], right: [1, 0, 0.05], front: [0, 1, 0.08], back: [0, -1, 0.08], top: [0, -0.02, 1], iso: [-0.88, 0.42, 0.26],
}
// Camera distance that fits the head and its axis labels (radius ~135 mm) in the narrower field of view.
function fitDistance() {
  const v = (camera.fov * Math.PI) / 360
  const h = Math.atan(Math.tan(v) * camera.aspect)
  return 135 / Math.sin(Math.min(v, h))
}

// ---------------------------------------------------------------- shader
const VERT = `
attribute vec3 heat;
attribute float level;
attribute float curv;
varying vec3 vHeat; varying float vLevel; varying vec3 vN; varying vec3 vV; varying float vCurv;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vHeat = heat; vLevel = level; vCurv = curv;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = `
uniform float uGlass; uniform float uAlpha; uniform vec3 uBase; uniform vec2 uIso;
varying vec3 vHeat; varying float vLevel; varying vec3 vN; varying vec3 vV; varying float vCurv;
float isoLine(float v, float c) {
  float w = fwidth(v) * 1.3;
  return 1.0 - smoothstep(0.0, w, abs(v - c));
}
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float ndv = clamp(dot(N, normalize(vV)), 0.0, 1.0);
  float diff = 0.32 + 0.68 * clamp(dot(N, normalize(vec3(0.35, 0.55, 0.75))), 0.0, 1.0);
  float hot = smoothstep(0.02, 0.2, vLevel);
  // sulci (concave) darker, gyral crowns lighter
  float sulcus = smoothstep(-0.35, 0.6, vCurv);
  vec3 col = mix(uBase * mix(1.08, 0.62, sulcus), vHeat * mix(1.0, 0.8, sulcus), hot);
  vec3 solid = col * diff + vec3(0.18) * pow(1.0 - ndv, 3.0);
  float fres = pow(1.0 - ndv, 2.0);
  float a = mix(1.0, clamp(0.04 + 0.7 * fres + 0.6 * hot * vLevel, 0.0, 1.0), uGlass) * uAlpha;
  vec3 glass = col * (0.55 + 0.9 * fres) + vec3(0.1) * fres;
  vec3 c = mix(solid, glass, uGlass);
  // contour lines at 0.1 and 1 µT
  float lines = max(isoLine(vLevel, uIso.x), isoLine(vLevel, uIso.y)) * step(0.001, vLevel);
  c = mix(c, vec3(0.95), 0.55 * lines);
  gl_FragColor = vec4(c, max(a, 0.6 * lines * uAlpha));
}`

function material(base, glass, alpha = 1) {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uGlass: { value: glass ? 1 : 0 }, uAlpha: { value: alpha }, uBase: { value: new Color(...base) }, uIso: { value: new Vector2(scalePos(0.1), scalePos(1)) } },
    transparent: glass || alpha < 1,
    depthWrite: !glass && alpha >= 1,
    side: DoubleSide,
  })
}

function makeMesh(m, base, glass) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(m.position, 3))
  g.setIndex(new BufferAttribute(m.index, 1))
  g.computeVertexNormals()
  const n = m.position.length / 3
  g.setAttribute('heat', new BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('level', new BufferAttribute(new Float32Array(n), 1))
  g.setAttribute('curv', new BufferAttribute(curvature(m.position, m.index, g.getAttribute('normal').array), 1))
  const mesh = new Mesh(g, material(base, glass))
  mesh.userData.key = m.key
  return mesh
}

// Signed mean-curvature proxy per vertex (umbrella Laplacian along the outward
// normal, mm): > 0 in sulci, < 0 on gyral crowns.
function curvature(pos, index, normal) {
  const n = pos.length / 3
  const sum = new Float32Array(n * 3)
  const deg = new Float32Array(n)
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = index[t + k], b = index[t + ((k + 1) % 3)], c = index[t + ((k + 2) % 3)]
      for (const o of [b, c]) {
        sum[3 * a] += pos[3 * o]; sum[3 * a + 1] += pos[3 * o + 1]; sum[3 * a + 2] += pos[3 * o + 2]
      }
      deg[a] += 2
    }
  }
  // orient normals outward: positive mean projection from the centroid
  let cx = 0, cy = 0, cz = 0
  for (let v = 0; v < n; v++) { cx += pos[3 * v]; cy += pos[3 * v + 1]; cz += pos[3 * v + 2] }
  cx /= n; cy /= n; cz /= n
  let out = 0
  for (let v = 0; v < n; v++) out += normal[3 * v] * (pos[3 * v] - cx) + normal[3 * v + 1] * (pos[3 * v + 1] - cy) + normal[3 * v + 2] * (pos[3 * v + 2] - cz)
  const sign = out >= 0 ? 1 : -1
  const curv = new Float32Array(n)
  for (let v = 0; v < n; v++) {
    if (!deg[v]) continue
    let d = 0
    for (let k = 0; k < 3; k++) d += (sum[3 * v + k] / deg[v] - pos[3 * v + k]) * normal[3 * v + k]
    curv[v] = sign * d
  }
  return curv
}

const CORTEX_BASE = [0.66, 0.64, 0.61]
const DEEP_BASE = [0.5, 0.56, 0.68]

function paint() {
  for (const [key, mesh] of Object.entries(meshes)) {
    const v = props.values?.[key]
    const heat = mesh.geometry.getAttribute('heat')
    const level = mesh.geometry.getAttribute('level')
    for (let i = 0; i < level.count; i++) {
      const uT = v ? v[i] : 0
      const c = fieldColor(uT)
      heat.array[3 * i] = c[0]
      heat.array[3 * i + 1] = c[1]
      heat.array[3 * i + 2] = c[2]
      level.array[i] = scalePos(uT)
    }
    heat.needsUpdate = true
    level.needsUpdate = true
  }
  dirty = true
}

// Outer surfaces (cerebrum, cerebellum, brainstem) can turn to glass; deep nuclei stay solid.
const isSurface = (key) => key.startsWith('cortex') || key.startsWith('cerebellum') || key === 'brainstem'

function applyGlass() {
  for (const [key, mesh] of Object.entries(meshes)) {
    const deep = !isSurface(key)
    const glass = !deep && props.glass
    mesh.material.uniforms.uGlass.value = glass ? 1 : 0
    mesh.material.transparent = glass
    mesh.material.depthWrite = !glass
    mesh.material.needsUpdate = true
    mesh.renderOrder = deep ? 0 : 2
    mesh.visible = deep ? props.showDeep : true
  }
  dirty = true
}

// ---------------------------------------------------------------- coils
function label(text, cls) {
  const el = document.createElement('div')
  el.className = `scene-label ${cls ?? ''}`
  el.textContent = text
  return new CSS2DObject(el)
}

const coilMat = () => new MeshStandardMaterial({ color: 0xc27a43, metalness: 0.55, roughness: 0.35, emissive: new Color(0xff8a3a), emissiveIntensity: 0 })
function buildCoils() {
  if (coilGroup) {
    coilGroup.traverse((o) => { if (o.isCSS2DObject) o.element.remove() })
    scene.remove(coilGroup)
  }
  coilGroup = new Group()
  const geo = new CylinderGeometry(9.5, 9.5, 12, 32)
  const up = new Vector3(0, 1, 0)
  props.coils.forEach((c, i) => {
    if (!c) return
    const axis = new Vector3(...c.axis)
    const mesh = new Mesh(geo, coilMat())
    mesh.quaternion.copy(new Quaternion().setFromUnitVectors(up, axis))
    mesh.position.set(...c.face).addScaledVector(axis, -6)
    mesh.userData.ch = i
    mesh.material.opacity = c.weight === 0 ? 0.25 : 1
    mesh.material.transparent = c.weight === 0
    const l = label(`CH${i + 1} · ${c.site}`, c.weight === 0 ? 'dim' : '')
    l.position.copy(mesh.position).addScaledVector(axis, -16)
    coilGroup.add(mesh, l)
  })
  scene.add(coilGroup)
  applyLevels()
}

function applyLevels() {
  if (!coilGroup) return
  for (const o of coilGroup.children) {
    if (!o.isMesh) continue
    const lv = props.levels ? Math.min(1, Math.abs(props.levels[o.userData.ch] ?? 0)) : 0
    o.material.emissiveIntensity = props.levels ? 0.15 + 1.6 * lv : 0.08
  }
  dirty = true
}

// ---------------------------------------------------------------- head shell
// Smooth radial surface through the 10-05 sites (kernel-weighted radius).
function buildHead() {
  const c = HEAD_CENTRE
  const pts = Object.values(SITES).map((p) => {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    const r = Math.hypot(...d)
    return { u: d.map((x) => x / r), r }
  })
  const NU = 72, NV = 48
  const pos = []
  const keep = []
  for (let j = 0; j <= NV; j++) {
    const th = (j / NV) * Math.PI
    for (let i = 0; i <= NU; i++) {
      const ph = (i / NU) * 2 * Math.PI
      const u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]
      let ws = 0, rs = 0
      for (const p of pts) {
        const cos = u[0] * p.u[0] + u[1] * p.u[1] + u[2] * p.u[2]
        const w = Math.exp(-((1 - cos) / 0.012))
        ws += w
        rs += w * p.r
      }
      const r = ws > 1e-6 ? rs / ws : 0
      pos.push(c[0] + u[0] * (r + 1), c[1] + u[1] * (r + 1), c[2] + u[2] * (r + 1))
      keep.push(ws > 0.25)
    }
  }
  const idx = []
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, d = a + NU + 1, e = d + 1
    if (keep[a] && keep[b] && keep[d] && keep[e]) idx.push(a, d, b, b, d, e)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const n = pos.length / 3
  g.setAttribute('heat', new BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('level', new BufferAttribute(new Float32Array(n), 1))
  g.setAttribute('curv', new BufferAttribute(new Float32Array(n), 1))
  headMesh = new Mesh(g, material([0.75, 0.72, 0.68], true, 0.5))
  headMesh.renderOrder = 3
  scene.add(headMesh)

  const sp = new Float32Array(Object.values(SITES).flat())
  const sg = new BufferGeometry()
  sg.setAttribute('position', new BufferAttribute(sp, 3))
  siteCloud = new Points(sg, new PointsMaterial({ color: 0x9aa3ad, size: 2.4, sizeAttenuation: true }))
  scene.add(siteCloud)
}

// ---------------------------------------------------------------- scene
function setView(name) {
  const d = new Vector3(...(VIEWS[name] ?? VIEWS.iso)).normalize().multiplyScalar(fitDistance())
  camera.position.copy(TARGET).add(d)
  controls.target.copy(TARGET)
  controls.update()
  dirty = true
}

function resize() {
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  renderer.setSize(w, h)
  labels.setSize(w, h)
  const before = fitDistance()
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  // keep the head framed when the shape of the view changes (rotation, phone)
  if (controls) {
    const off = camera.position.clone().sub(controls.target)
    off.multiplyScalar(fitDistance() / before)
    camera.position.copy(controls.target).add(off)
  }
  dirty = true
}

const raycaster = new Raycaster()
let downAt = null
function onPointerDown(e) {
  downAt = [e.clientX, e.clientY]
}
function onPointerUp(e) {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return
  const r = renderer.domElement.getBoundingClientRect()
  const p = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(p, camera)
  const targets = Object.values(meshes).filter((m) => m.visible)
  const hit = raycaster.intersectObjects(targets, false)[0]
  if (!hit) return emit('pick', null)
  const key = hit.object.userData.key
  const face = hit.face
  // nearest vertex of the hit triangle
  const pos = hit.object.geometry.getAttribute('position')
  let best = face.a, bd = Infinity
  for (const v of [face.a, face.b, face.c]) {
    const d = hit.point.distanceToSquared(new Vector3().fromBufferAttribute(pos, v))
    if (d < bd) { bd = d; best = v }
  }
  emit('pick', { key, vertex: best, point: hit.point.toArray().map((x) => +x.toFixed(1)) })
}

function placeMarker() {
  if (!marker) {
    marker = new Group()
    const dot = new Mesh(new SphereGeometry(3.2, 20, 14), new MeshBasicMaterial({ color: 0x79a6e2, depthTest: false, transparent: true }))
    const ring = new Mesh(new RingGeometry(6, 7.5, 40), new MeshBasicMaterial({ color: 0x79a6e2, side: DoubleSide, depthTest: false, transparent: true, opacity: 0.8 }))
    dot.renderOrder = ring.renderOrder = 10
    marker.add(dot, ring)
    marker.userData.ring = ring
    scene.add(marker)
  }
  marker.visible = !!props.highlight
  if (props.highlight) marker.position.set(...props.highlight)
  dirty = true
}

// Labels of coils on the far side of the head fade so they do not read as front.
const toCam = new Vector3()
const toCoil = new Vector3()
function fadeLabels() {
  if (!coilGroup) return
  toCam.copy(camera.position).sub(TARGET).normalize()
  for (const o of coilGroup.children) {
    if (!o.isCSS2DObject) continue
    toCoil.copy(o.position).sub(TARGET).normalize()
    o.element.classList.toggle('far', toCoil.dot(toCam) < -0.15)
  }
}

function loop() {
  raf = requestAnimationFrame(loop)
  const moved = controls.update()
  if (moved || dirty) fadeLabels()
  if (marker?.visible) {
    marker.userData.ring.quaternion.copy(camera.quaternion)
    const s = 1 + 0.25 * Math.sin(performance.now() / 260)
    marker.userData.ring.scale.set(s, s, s)
    dirty = true
  }
  if (!moved && !dirty) return
  dirty = false
  renderer.render(scene, camera)
  labels.render(scene, camera)
}

onMounted(() => {
  renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  host.value.appendChild(renderer.domElement)
  labels = new CSS2DRenderer()
  labels.domElement.className = 'scene-labels'
  host.value.appendChild(labels.domElement)

  scene = new Scene()
  camera = new PerspectiveCamera(32, 1, 10, 3000)
  camera.up.set(0, 0, 1)
  scene.add(new HemisphereLight(0xffffff, 0x404050, 1.4))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-200, 300, 400)
  scene.add(key)

  for (const m of props.brain.meshes) {
    const deep = !isSurface(m.key)
    meshes[m.key] = makeMesh(m, deep ? DEEP_BASE : CORTEX_BASE, !deep && props.glass)
    scene.add(meshes[m.key])
  }
  for (const [text, p] of [['Left', [-118, -18, 12]], ['Right', [118, -18, 12]], ['Front', [0, 112, 12]], ['Back', [0, -145, 12]]]) {
    const l = label(text, 'axis')
    l.position.set(...p)
    scene.add(l)
  }
  buildHead()
  headMesh.visible = props.showHead
  siteCloud.visible = props.showSites

  controls = new OrbitControls(camera, labels.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 160
  controls.maxDistance = 1400
  controls.enablePan = false
  labels.domElement.addEventListener('pointerdown', onPointerDown)
  labels.domElement.addEventListener('pointerup', onPointerUp)

  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(host.value)
  resize()
  applyGlass()
  paint()
  buildCoils()
  placeMarker()
  setView(props.view)
  loop()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObs?.disconnect()
  controls?.dispose()
  scene?.traverse((o) => {
    o.geometry?.dispose()
    o.material?.dispose?.()
  })
  renderer?.dispose()
  renderer?.forceContextLoss()
})

watch(() => props.values, paint)
watch(() => props.coils, buildCoils)
watch(() => props.levels, applyLevels)
watch(() => [props.glass, props.showDeep], applyGlass)
watch(() => props.showHead, (v) => { headMesh.visible = v; dirty = true })
watch(() => props.showSites, (v) => { siteCloud.visible = v; dirty = true })
watch(() => props.highlight, placeMarker)
watch(() => props.view, setView)

defineExpose({ setView })
</script>

<template>
  <div ref="host" class="scene" role="img" aria-label="3D brain with estimated field exposure; drag to rotate, scroll or pinch to zoom, tap a point for its value"></div>
</template>

<style scoped>
.scene { position: relative; width: 100%; height: 100%; min-height: 320px; touch-action: none; overflow: hidden; border-radius: 8px;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--surface-2) 100%, transparent), var(--bg)); }
.scene :deep(canvas) { display: block; }
.scene :deep(.scene-labels) { position: absolute; inset: 0; }
.scene :deep(.scene-label) { font: 600 11px var(--font-body); color: var(--text); background: color-mix(in srgb, var(--surface) 82%, transparent);
  border: 1px solid var(--line); padding: 1px 6px; border-radius: 99px; white-space: nowrap; pointer-events: none; }
.scene :deep(.scene-label.dim) { opacity: .45; }
.scene :deep(.scene-label.far) { opacity: .28; }
.scene :deep(.scene-label.axis) { background: none; border: 0; color: var(--muted); letter-spacing: .12em; text-transform: uppercase; font-size: 10px; }
</style>
