// The program the Programs tab shows, shared by its sub-tabs (Overview,
// Placement, Brain, Sources) and the Start panel: one selection, one phase,
// one intensity and one preview of the coil activity.
import { reactive, shallowRef } from 'vue'
import { presetById, presets } from './presets.js'
import { SessionRunner, render } from '../engine/session.js'
import { lastProgramId, rememberProgram } from './lastProgram.js'

export const DEFAULT_PROGRAM = 'god-helmet-classic'
const runnable = (id) => (presetById(id)?.session ? id : null)
const firstId = runnable(lastProgramId()) ?? runnable(DEFAULT_PROGRAM) ?? presets.find((p) => p.session)?.doc.id

export const program = reactive({
  id: firstId,
  phase: 0, // selected phase: Overview timeline and Brain phase chips
  uT: presetById(firstId)?.doc.uT ?? 1, // intensity at 20 mm: Brain estimate and Start
  speed: 10, // preview: times slower than real time, so millisecond steps show
  startOpen: false, // Start panel (stays open across the safety detour)
})

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
