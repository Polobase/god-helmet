// The program the Programs tab shows, shared by its sub-tabs (Overview,
// Placement, Brain, Sources) and the Start panel: one selection, one phase,
// one intensity and one preview of the coil activity.
import { reactive, shallowRef } from 'vue'
import { presetById, presets } from './presets.js'
import { SessionRunner, render } from '../engine/session.js'
import { lastProgramId, rememberProgram, DEFAULT_PROGRAM } from './lastProgram.js'
import { placementGroups } from './placements.js'
import { sessionSites } from './brain.js'
import { placementState } from './placementState.js'
import { routeHash } from './routes.js'

export { DEFAULT_PROGRAM }
const runnable = (id) => (presetById(id)?.session ? id : null)
const firstId = runnable(lastProgramId()) ?? runnable(DEFAULT_PROGRAM) ?? presets.find((p) => p.session)?.doc.id

export const program = reactive({
  id: firstId,
  phase: 0, // selected phase: Overview timeline and Brain phase chips
  uT: presetById(firstId)?.doc.uT ?? 1, // intensity at 20 mm: Brain estimate and Start
  speed: 10, // preview: times slower than real time, so millisecond steps show
  startOpen: false, // Start panel (stays open across the safety detour)
  focus: '', // what a sub-tab should show first: 'measure' or 'place' (from the Start panel)
  region: '', // a target region for the Brain sub-tab to open (from Overview's "Aims at")
})

// The library's filters and browse mode, kept while you look at a program.
export const library = reactive({ mode: 'category', query: '', evidence: '', category: '', more: {}, lobe: null, allGroups: false, group: null, site: 'T8', y: 0 })

// Programs that share their coil sites (lib/placements.js), most used first.
export const groups = placementGroups(presets, sessionSites)
export const groupOf = (id) => groups.find((g) => g.programs.some((p) => p.doc.id === id)) ?? null
// Coils of a placement ticked as placed (kept until the page reloads).
export const ticksOf = (g) => (g ? placementState.placed[g.key] ?? [] : [])
export const usedCoils = (g) => (g ? g.sites.map((s, i) => (s ? i : null)).filter((i) => i !== null) : [])
export const placedCount = (g) => usedCoils(g).filter((i) => ticksOf(g)[i]).length

// Link to one of a program's sub-tabs ('' = Overview).
export const subHref = (sub, id = program.id) => routeHash('programs', id, sub)

// While the preview runs: { drives (8, signed), phase, phaseMs, programMs }.
export const preview = shallowRef(null)

export function selectProgram(id) {
  const p = presetById(id)
  if (!p || id === program.id) return
  stopPreview()
  program.id = id
  program.phase = 0
  program.uT = p.doc.uT ?? 1
  if (p.session) rememberProgram(id)
}

export function setPhase(i) {
  program.phase = i
  if (preview.value) startPreview(i)
}

// Runs the session in the browser from the start of `fromPhase`, past the fade-in.
let raf = 0
export function startPreview(fromPhase = program.phase) {
  stopPreview()
  const s = presetById(program.id)?.session
  if (!s) return
  const runner = new SessionRunner()
  runner.start(s)
  runner.advance(runner.phaseStart(Math.min(fromPhase, s.phases.length - 1)) + s.fadeInMs + 2000)
  preview.value = { drives: new Array(8).fill(0), phase: fromPhase, phaseMs: 0, programMs: runner.programMs }
  let last = performance.now()
  const step = (t) => {
    const f = runner.advance((t - last) / program.speed)
    last = t
    if (!f.running) return stopPreview()
    preview.value = { drives: render(s, f), phase: f.phase, phaseMs: f.phaseMs, programMs: f.programMs }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

export function stopPreview() {
  cancelAnimationFrame(raf)
  raf = 0
  preview.value = null
}
