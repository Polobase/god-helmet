<script setup lang="ts">
// 3D head: template brain (MNI152) coloured by estimated field, deep
// structures, coils at their 10-05 sites, optional scalp shell and site grid.
// MNI axes are used directly (x right, y front, z up).
//
// The only file that imports three.js: load it on demand (<LazyBrainScene>).
// It stands on <BrainStage>, which gives it the dark backdrop and the --s-*
// colours of its labels. The colours inside the canvas are fixed: the stage
// looks the same in every theme.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, MeshStandardMaterial,
  CylinderGeometry, SphereGeometry, Group, Vector3, Color, DoubleSide, HemisphereLight, DirectionalLight,
  Points, PointsMaterial, Raycaster, Vector2, RingGeometry, MeshBasicMaterial,
} from 'three'
import type { IUniform } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { errorMessage } from '~/lib/device'
import { fieldColor, scalePos, SITES, HEAD_CENTRE } from '~/lib/brain'
import type { Brain, BrainMesh, FieldValues, SceneCoil, ScenePick, Vec3, ViewKey } from '~/lib/brain'

const props = withDefaults(defineProps<{
  brain: Brain
  /** µT per vertex, by mesh key. */
  values?: FieldValues | null
  /** One per channel; null = no coil there. */
  coils?: (SceneCoil | null)[]
  /** Live |drive| 0..1 per channel. */
  levels?: number[] | null
  glass?: boolean
  showDeep?: boolean
  showHead?: boolean
  showSites?: boolean
  /** A point to mark, MNI mm. */
  highlight?: Vec3 | null
  view?: ViewKey
}>(), { values: null, coils: () => [], levels: null, glass: true, showDeep: true, showHead: false, showSites: false, highlight: null, view: 'iso' })
const emit = defineEmits<{
  /** A tap on a surface, or null for a tap beside the brain. */
  pick: [hit: ScenePick | null]
  ready: []
  /** The scene could not start (no WebGL). */
  error: [message: string]
}>()

const host = useTemplateRef<HTMLDivElement>('host')

const TARGET = new Vector3(0, -18, 12)
const VIEWS: Record<ViewKey, Vec3> = {
  left: [-1, 0, 0.05], right: [1, 0, 0.05], front: [0, 1, 0.08], back: [0, -1, 0.08], top: [0, -0.02, 1], iso: [-0.88, 0.42, 0.26],
}
// Left/Right sit outside the T7/T8 coil labels so they do not overlap in the Top view
const AXES: [string, Vec3][] = [['Left', [-140, -18, 12]], ['Right', [140, -18, 12]], ['Front', [0, 112, 12]], ['Back', [0, -145, 12]]]
const LABEL_PX = 24
const CORTEX_BASE: Vec3 = [0.66, 0.64, 0.61]
const DEEP_BASE: Vec3 = [0.5, 0.56, 0.68]
const SHELL_BASE: Vec3 = [0.75, 0.72, 0.68]
const COIL_COPPER = 0xc27a43
const COIL_GLOW = 0xff8a3a
const SITE_GREY = 0x9aa3ad
// blue: the one hue the field scale (purple to yellow) does not use
const MARKER_BLUE = 0x79a6e2

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

// a type, not an interface: three wants uniforms with an index signature
type FieldUniforms = { uGlass: IUniform<number>, uAlpha: IUniform<number>, uBase: IUniform<Color>, uIso: IUniform<Vector2> }

function fieldMaterial(base: Vec3, glass: boolean, alpha = 1) {
  const uniforms: FieldUniforms = {
    uGlass: { value: glass ? 1 : 0 }, uAlpha: { value: alpha }, uBase: { value: new Color(...base) }, uIso: { value: new Vector2(scalePos(0.1), scalePos(1)) },
  }
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: glass || alpha < 1,
    depthWrite: !glass && alpha >= 1,
    side: DoubleSide,
  })
  return { material, uniforms }
}

/** Geometry for the field shader: heat (r, g, b), level (0..1 on the scale) and curvature per vertex. */
function fieldGeometry(position: Float32Array, index: BufferAttribute | number[], curv?: (normal: ArrayLike<number>) => Float32Array) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const n = position.length / 3
  const heat = new BufferAttribute(new Float32Array(n * 3), 3)
  const level = new BufferAttribute(new Float32Array(n), 1)
  geometry.setAttribute('heat', heat)
  geometry.setAttribute('level', level)
  geometry.setAttribute('curv', new BufferAttribute(curv ? curv(geometry.getAttribute('normal').array) : new Float32Array(n), 1))
  return { geometry, heat, level }
}

// Signed mean-curvature proxy per vertex (umbrella Laplacian along the outward
// normal, mm): > 0 in sulci, < 0 on gyral crowns.
function curvature(pos: Float32Array, index: ArrayLike<number>, normal: ArrayLike<number>) {
  const n = pos.length / 3
  const sum = new Float32Array(n * 3)
  const deg = new Float32Array(n)
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = index[t + k]!, b = index[t + ((k + 1) % 3)]!, c = index[t + ((k + 2) % 3)]!
      for (const o of [b, c]) {
        sum[3 * a]! += pos[3 * o]!
        sum[3 * a + 1]! += pos[3 * o + 1]!
        sum[3 * a + 2]! += pos[3 * o + 2]!
      }
      deg[a]! += 2
    }
  }
  // orient normals outward: positive mean projection from the centroid
  let cx = 0, cy = 0, cz = 0
  for (let v = 0; v < n; v++) {
    cx += pos[3 * v]!
    cy += pos[3 * v + 1]!
    cz += pos[3 * v + 2]!
  }
  cx /= n
  cy /= n
  cz /= n
  let out = 0
  for (let v = 0; v < n; v++) out += normal[3 * v]! * (pos[3 * v]! - cx) + normal[3 * v + 1]! * (pos[3 * v + 1]! - cy) + normal[3 * v + 2]! * (pos[3 * v + 2]! - cz)
  const sign = out >= 0 ? 1 : -1
  const curv = new Float32Array(n)
  for (let v = 0; v < n; v++) {
    if (!deg[v]) continue
    let d = 0
    for (let k = 0; k < 3; k++) d += (sum[3 * v + k]! / deg[v]! - pos[3 * v + k]!) * normal[3 * v + k]!
    curv[v] = sign * d
  }
  return curv
}

// Outer surfaces (cerebrum, cerebellum, brainstem) can turn to glass; deep nuclei stay solid.
const isSurface = (key: string) => key.startsWith('cortex') || key.startsWith('cerebellum') || key === 'brainstem'

// Smooth radial surface through the 10-05 sites (kernel-weighted radius): the scalp.
function scalpShell() {
  const c = HEAD_CENTRE
  const pts = Object.values(SITES).map((p) => {
    const d: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    const r = Math.hypot(...d)
    return { u: [d[0] / r, d[1] / r, d[2] / r] as Vec3, r }
  })
  const NU = 72, NV = 48
  const pos: number[] = []
  const keep: boolean[] = []
  for (let j = 0; j <= NV; j++) {
    const th = (j / NV) * Math.PI
    for (let i = 0; i <= NU; i++) {
      const ph = (i / NU) * 2 * Math.PI
      const u: Vec3 = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]
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
  const idx: number[] = []
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, d = a + NU + 1, e = d + 1
      if (keep[a] && keep[b] && keep[d] && keep[e]) idx.push(a, d, b, b, d, e)
    }
  }
  const head = new Mesh(fieldGeometry(new Float32Array(pos), idx).geometry, fieldMaterial(SHELL_BASE, true, 0.5).material)
  head.renderOrder = 3
  return head
}

function siteCloud() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(Object.values(SITES).flat()), 3))
  return new Points(geometry, new PointsMaterial({ color: SITE_GREY, size: 2.4, sizeAttenuation: true }))
}

// ---------------------------------------------------------------- scene
interface Surface {
  key: string
  mesh: Mesh<BufferGeometry, ShaderMaterial>
  uniforms: FieldUniforms
  heat: BufferAttribute
  level: BufferAttribute
  /** A deep nucleus: stays solid, can be hidden. */
  deep: boolean
}
/** A text label in the scene, with its size in pixels for the overlap test. */
interface Label { object: CSS2DObject, size: [number, number] }
interface Coil { ch: number, mesh: Mesh<CylinderGeometry, MeshStandardMaterial>, label: Label }
type Box = [left: number, top: number, right: number, bottom: number]

// Everything three.js, built once the host element is there. The functions it
// returns read the props when called; the watchers below call them.
function buildScene(el: HTMLDivElement) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true }) // throws where there is no WebGL
  el.appendChild(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'scene-labels'
  el.appendChild(labels.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 10, 3000)
  camera.up.set(0, 0, 1)
  scene.add(new HemisphereLight(0xffffff, 0x404050, 1.4))
  const keyLight = new DirectionalLight(0xffffff, 1.6)
  keyLight.position.set(-200, 300, 400)
  scene.add(keyLight)

  let raf = 0
  let dirty = true
  let stageW = 1000, stageH = 1000

  // Camera distance that fits the head (radius ~135 mm) top to bottom and the Left/Right labels
  // (140 mm out) side to side, with room for the label text, which matters on narrow phones.
  function fitDistance() {
    const v = (camera.fov * Math.PI) / 360
    const h = Math.atan(Math.tan(v) * camera.aspect * Math.max(0.5, 1 - LABEL_PX / (stageW / 2)))
    return Math.max(135 / Math.sin(v), 140 / Math.sin(h))
  }

  // ---- brain surfaces
  const surfaces: Surface[] = props.brain.meshes.map((m: BrainMesh) => {
    const deep = !isSurface(m.key)
    const { geometry, heat, level } = fieldGeometry(m.position, new BufferAttribute(m.index, 1), (normal) => curvature(m.position, m.index, normal))
    const { material, uniforms } = fieldMaterial(deep ? DEEP_BASE : CORTEX_BASE, !deep && props.glass)
    return { key: m.key, mesh: new Mesh(geometry, material), uniforms, heat, level, deep }
  })
  for (const s of surfaces) scene.add(s.mesh)

  function paint() {
    for (const s of surfaces) {
      const v = props.values?.[s.key]
      const heat = s.heat.array
      const level = s.level.array
      for (let i = 0; i < s.level.count; i++) {
        const uT = v?.[i] ?? 0
        const c = fieldColor(uT)
        heat[3 * i] = c[0]
        heat[3 * i + 1] = c[1]
        heat[3 * i + 2] = c[2]
        level[i] = scalePos(uT)
      }
      s.heat.needsUpdate = true
      s.level.needsUpdate = true
    }
    dirty = true
  }

  function applyGlass() {
    for (const s of surfaces) {
      const glass = !s.deep && props.glass
      s.uniforms.uGlass.value = glass ? 1 : 0
      s.mesh.material.transparent = glass
      s.mesh.material.depthWrite = !glass
      s.mesh.material.needsUpdate = true
      s.mesh.renderOrder = s.deep ? 0 : 2
      s.mesh.visible = s.deep ? props.showDeep : true
    }
    dirty = true
  }

  // ---- labels
  function label(text: string, cls = ''): Label {
    const element = document.createElement('div')
    element.className = `scene-label ${cls}`.trim()
    element.textContent = text
    // in the DOM now (the label renderer keeps it there), so its size can be read once for the overlap test
    labels.domElement.appendChild(element)
    return { object: new CSS2DObject(element), size: [element.offsetWidth, element.offsetHeight] }
  }
  const axisLabels = AXES.map(([text, p]) => {
    const l = label(text, 'axis')
    l.object.position.set(...p)
    scene.add(l.object)
    return l
  })

  // ---- coils
  const coilGroup = new Group()
  scene.add(coilGroup)
  const coilGeometry = new CylinderGeometry(9.5, 9.5, 12, 32)
  const cylinderAxis = new Vector3(0, 1, 0)
  let coils: Coil[] = []
  function clearCoils() {
    for (const c of coils) {
      c.label.object.element.remove()
      c.mesh.material.dispose()
    }
    coilGroup.clear()
    coils = []
  }
  function buildCoils() {
    clearCoils()
    props.coils.forEach((c, ch) => {
      if (!c) return
      const axis = new Vector3(...c.axis)
      const mesh = new Mesh(coilGeometry, new MeshStandardMaterial({ color: COIL_COPPER, metalness: 0.55, roughness: 0.35, emissive: new Color(COIL_GLOW), emissiveIntensity: 0 }))
      mesh.quaternion.setFromUnitVectors(cylinderAxis, axis)
      mesh.position.set(...c.face).addScaledVector(axis, -6)
      mesh.material.opacity = c.weight === 0 ? 0.25 : 1
      mesh.material.transparent = c.weight === 0
      const l = label(`CH${ch + 1} ${c.site}`, c.weight === 0 ? 'dim' : '')
      l.object.position.copy(mesh.position).addScaledVector(axis, -16)
      coilGroup.add(mesh, l.object)
      coils.push({ ch, mesh, label: l })
    })
    applyLevels()
  }
  function applyLevels() {
    for (const c of coils) {
      const lv = props.levels ? Math.min(1, Math.abs(props.levels[c.ch] ?? 0)) : 0
      c.mesh.material.emissiveIntensity = props.levels ? 0.15 + 1.6 * lv : 0.08
    }
    dirty = true
  }

  // ---- scalp and site grid
  const head = scalpShell()
  const sites = siteCloud()
  scene.add(head, sites)
  function applyExtras() {
    head.visible = props.showHead
    sites.visible = props.showSites
    dirty = true
  }

  // ---- camera
  const controls = new OrbitControls(camera, labels.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 160
  controls.maxDistance = 1400
  controls.enablePan = false

  function setView(name: ViewKey) {
    // drop any spin left over from a drag so the view stays put
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = true
    const d = new Vector3(...(VIEWS[name] ?? VIEWS.iso)).normalize().multiplyScalar(fitDistance())
    camera.position.copy(TARGET).add(d)
    controls.target.copy(TARGET)
    controls.update()
    dirty = true
  }

  function resize() {
    const w = el.clientWidth
    const h = el.clientHeight
    if (!w || !h) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // it changes with the zoom, and from screen to screen
    renderer.setSize(w, h)
    labels.setSize(w, h)
    const before = fitDistance()
    camera.aspect = w / h
    stageW = w
    stageH = h
    camera.updateProjectionMatrix()
    // keep the head framed when the shape of the view changes (rotation, phone)
    const off = camera.position.clone().sub(controls.target)
    off.multiplyScalar(fitDistance() / before)
    camera.position.copy(controls.target).add(off)
    dirty = true
  }

  // ---- picking: a tap, not the end of a drag
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const corner = new Vector3()
  let downAt: [number, number] | null = null
  function onPointerDown(e: PointerEvent) {
    downAt = [e.clientX, e.clientY]
  }
  function onPointerUp(e: PointerEvent) {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return
    const r = renderer.domElement.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(surfaces.filter((s) => s.mesh.visible).map((s) => s.mesh), false)[0]
    const surface = hit && surfaces.find((s) => s.mesh === hit.object)
    if (!hit?.face || !surface) return emit('pick', null)
    // nearest vertex of the hit triangle
    const pos = surface.mesh.geometry.getAttribute('position')
    let best = hit.face.a, bd = Infinity
    for (const v of [hit.face.a, hit.face.b, hit.face.c]) {
      const d = hit.point.distanceToSquared(corner.fromBufferAttribute(pos, v))
      if (d < bd) {
        bd = d
        best = v
      }
    }
    emit('pick', { key: surface.key, vertex: best, point: [hit.point.x, hit.point.y, hit.point.z].map((x) => Number(x.toFixed(1))) as Vec3 })
  }
  labels.domElement.addEventListener('pointerdown', onPointerDown)
  labels.domElement.addEventListener('pointerup', onPointerUp)

  // ---- the marked point: a dot, and a ring that faces the camera and pulses
  const markerMaterials = [
    new MeshBasicMaterial({ color: MARKER_BLUE, depthTest: false, transparent: true }),
    new MeshBasicMaterial({ color: MARKER_BLUE, side: DoubleSide, depthTest: false, transparent: true, opacity: 0.8 }),
  ] as const
  const dot = new Mesh(new SphereGeometry(3.2, 20, 14), markerMaterials[0])
  const ring = new Mesh(new RingGeometry(6, 7.5, 40), markerMaterials[1])
  dot.renderOrder = ring.renderOrder = 10
  const marker = new Group().add(dot, ring)
  scene.add(marker)
  const stillRing = window.matchMedia('(prefers-reduced-motion: reduce)')
  function placeMarker() {
    marker.visible = !!props.highlight
    if (props.highlight) marker.position.set(...props.highlight)
    dirty = true
  }

  // ---- labels of coils on the far side of the head fade so they do not read as front
  const toCam = new Vector3()
  const toLabel = new Vector3()
  const onScreen = new Vector3()
  // label box in stage pixels, as the label renderer places it (centred on the point)
  function screenBox(l: Label): Box {
    if (!l.size[0]) l.size = [l.object.element.offsetWidth, l.object.element.offsetHeight]
    const [w, h] = l.size
    onScreen.copy(l.object.position).project(camera)
    const x = ((onScreen.x + 1) / 2) * stageW, y = ((1 - onScreen.y) / 2) * stageH
    return [x - w / 2 - 2, y - h / 2 - 2, x + w / 2 + 2, y + h / 2 + 2]
  }
  function fadeLabels() {
    camera.updateMatrixWorld() // the controls just moved it; project() needs the current view
    toCam.copy(camera.position).sub(TARGET).normalize()
    const coilBoxes: Box[] = []
    for (const c of coils) {
      toLabel.copy(c.label.object.position).sub(TARGET).normalize()
      const far = toLabel.dot(toCam) < -0.15
      c.label.object.element.classList.toggle('far', far)
      if (!far) coilBoxes.push(screenBox(c.label))
    }
    // An axis label pointing at or away from the camera sits mid-brain, and one that would cover a
    // front coil label (small stages, Top and 3D views) gives way to it: hide it in both cases.
    for (const l of axisLabels) {
      toLabel.copy(l.object.position).sub(TARGET).normalize()
      if (Math.abs(toLabel.dot(toCam)) >= 0.9) {
        l.object.visible = false
        continue
      }
      const [left, top, right, bottom] = screenBox(l)
      l.object.visible = !coilBoxes.some(([l2, t2, r2, b2]) => left < r2 && l2 < right && top < b2 && t2 < bottom)
    }
  }

  // ---- drawing: only when something moved or changed
  function loop() {
    raf = requestAnimationFrame(loop)
    const moved = controls.update()
    if (moved || dirty) fadeLabels()
    if (marker.visible) {
      ring.quaternion.copy(camera.quaternion)
      if (!stillRing.matches) {
        ring.scale.setScalar(1 + 0.25 * Math.sin(performance.now() / 260))
        dirty = true
      }
    }
    if (!moved && !dirty) return
    dirty = false
    renderer.render(scene, camera)
    labels.render(scene, camera)
  }
  const redraw = () => (dirty = true)
  renderer.domElement.addEventListener('webglcontextrestored', redraw)

  const observer = new ResizeObserver(resize)
  observer.observe(el)
  resize()
  applyGlass()
  paint()
  buildCoils()
  applyExtras()
  placeMarker()
  setView(props.view)
  loop()

  function dispose() {
    cancelAnimationFrame(raf)
    observer.disconnect()
    labels.domElement.removeEventListener('pointerdown', onPointerDown)
    labels.domElement.removeEventListener('pointerup', onPointerUp)
    renderer.domElement.removeEventListener('webglcontextrestored', redraw)
    controls.dispose()
    clearCoils()
    coilGeometry.dispose()
    for (const s of surfaces) {
      s.mesh.geometry.dispose()
      s.mesh.material.dispose()
    }
    for (const o of [head, sites, dot, ring]) {
      o.geometry.dispose()
      o.material.dispose()
    }
    renderer.dispose()
    renderer.forceContextLoss() // give the GPU memory back now, not when the canvas is collected
    renderer.domElement.remove()
    labels.domElement.remove()
  }

  return { paint, applyGlass, buildCoils, applyLevels, applyExtras, placeMarker, setView, dispose }
}

let stage: ReturnType<typeof buildScene> | null = null

onMounted(() => {
  try {
    stage = buildScene(host.value!)
    emit('ready')
  } catch (e) {
    emit('error', errorMessage(e))
  }
})
onBeforeUnmount(() => {
  stage?.dispose()
  stage = null
})

watch(() => props.values, () => stage?.paint())
watch(() => props.coils, () => stage?.buildCoils())
watch(() => props.levels, () => stage?.applyLevels())
watch(() => [props.glass, props.showDeep], () => stage?.applyGlass())
watch(() => [props.showHead, props.showSites], () => stage?.applyExtras())
watch(() => props.highlight, () => stage?.placeMarker())
watch(() => props.view, (v) => stage?.setView(v))

defineExpose({
  /** Turn the camera to a view; also when it is the current one, to undo a drag. */
  setView: (view: ViewKey) => stage?.setView(view),
})
</script>

<template>
  <div ref="host" class="scene" role="img" aria-label="3D brain with estimated field exposure; drag to rotate, scroll or pinch to zoom, tap a point for its value"></div>
</template>

<style scoped>
.scene { position: absolute; inset: 0; touch-action: none; overflow: hidden; }
/* absolute, so the canvas's pixel size never feeds back into the layout on resize */
.scene :deep(canvas) { display: block; position: absolute; inset: 0; }
.scene :deep(.scene-labels) { position: absolute; inset: 0; }
.scene :deep(.scene-label) { font: 600 11px var(--font-body); color: var(--s-text); background: color-mix(in srgb, var(--s-surface) 82%, transparent);
  border: 1px solid var(--s-line); padding: 1px 6px; border-radius: 99px; white-space: nowrap; pointer-events: none; }
.scene :deep(.scene-label.dim) { opacity: .45; }
.scene :deep(.scene-label.far) { opacity: .28; }
.scene :deep(.scene-label.axis) { background: none; border: 0; letter-spacing: .12em; text-transform: uppercase; font-size: 10px; color: var(--s-muted); }
</style>
