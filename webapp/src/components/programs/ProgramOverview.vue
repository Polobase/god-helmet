<script setup>
// Program overview: what it is, its phases with signal and waveform, the coils
// on a head map (with a slowed-down preview), setting, schedule, aims and notes.
import { computed } from 'vue'
import { presetById } from '../../lib/presets.js'
import { sessionSites } from '../../lib/brain.js'
import { describePattern, describeSpatial, fmtMinutes } from '../../lib/format.js'
import { coilsUsed } from '../../engine/spatial.js'
import { PATTERN_INFO } from '../../engine/patterns.js'
import { program, preview, setPhase, startPreview, stopPreview, subHref } from '../../lib/programState.js'
import SiteMap from '../SiteMap.vue'
import WaveformPreview from '../WaveformPreview.vue'
import PhaseTimeline from '../PhaseTimeline.vue'
import ClampText from '../ClampText.vue'

const preset = computed(() => presetById(program.id))
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session)
// While the preview runs, the phase follows it.
const shown = computed(() => Math.min(preview.value ? preview.value.phase : program.phase, session.value.phases.length - 1))
const phase = computed(() => session.value.phases[shown.value])
const used = computed(() => coilsUsed(phase.value.spatial, session.value.geometry))
const direction = computed(() => (phase.value.spatial.mode === 'rotate' ? (phase.value.spatial.ccw ? 'ccw' : 'cw') : null))
const levels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : null))
const coilCount = computed(() => sessionSites(session.value).filter(Boolean).length)

// "left-tpj" -> "left TPJ" (the Brain tab has the full region names)
const targetName = (id) => id.replace(/-/g, ' ').replace(/\b(tpj|dlpfc|vmpfc|stg|mtg)\b/g, (m) => m.toUpperCase())
</script>

<template>
  <div class="overview">
    <section class="card">
      <div class="ov-grid">
        <div class="stack text-col">
          <p class="summary">{{ doc.summary }}</p>
          <p v-if="doc.origin" class="muted small">{{ doc.origin }}</p>

          <div class="stack phases">
            <h3>Phases <span class="muted small count">{{ session.phases.length }} · {{ fmtMinutes(session.totalMs) }}</span></h3>
            <PhaseTimeline v-if="session.phases.length > 1" :phases="session.phases" :selected="shown" :position-ms="preview ? preview.programMs : -1" @select="setPhase" />
            <div class="stack phase">
              <div class="row between">
                <b>{{ shown + 1 }}. {{ phase.name }}</b>
                <span class="muted small">{{ fmtMinutes(phase.durationMs) }}{{ shown > 0 ? (phase.crossfade ? ' · crossfade' : ' · abrupt switch') : '' }}</span>
              </div>
              <div class="small"><span class="muted">Signal:</span> {{ describePattern(phase.pattern) }}</div>
              <div class="small muted">{{ PATTERN_INFO[phase.pattern.type] }}</div>
              <WaveformPreview :pattern="phase.pattern" />
              <div class="small"><span class="muted">Coils:</span> {{ describeSpatial(phase.spatial) }}</div>
              <div v-if="phase.track2" class="small"><span class="muted">Second track:</span> {{ describePattern(phase.track2.pattern) }} · {{ describeSpatial(phase.track2.spatial) }}</div>
            </div>
          </div>
        </div>

        <div class="stack map-col">
          <h3>Coils <span class="muted small count">{{ coilCount }} of 8</span></h3>
          <SiteMap :sites="sessionSites(session)" :used="levels ? null : used" :levels="levels" :direction="direction" />
          <div class="row">
            <button v-if="!preview" type="button" class="btn sm" @click="startPreview()">▶ Preview coil activity ({{ program.speed }}× slower)</button>
            <button v-else type="button" class="btn sm" @click="stopPreview">■ Stop preview</button>
            <a class="btn ghost sm" :href="subHref('placement')">Place the coils →</a>
          </div>
        </div>
      </div>
    </section>

    <section v-if="doc.setting || doc.schedule || doc.targets?.length || doc.notes" class="card">
      <dl v-if="doc.setting || doc.schedule" class="facts small">
        <template v-for="k in ['setting', 'schedule']" :key="k">
          <template v-if="doc[k]">
            <dt>{{ k === 'setting' ? 'Setting' : 'Schedule' }}</dt>
            <dd><ClampText :text="doc[k]" /></dd>
          </template>
        </template>
      </dl>
      <div v-if="doc.targets?.length" class="row small aims">
        <span class="muted">Aims at:</span>
        <a v-for="t in doc.targets" :key="t" class="chip link" :href="subHref('brain')" :title="`Field at ${targetName(t)}, on the brain`" @click="program.region = t">{{ targetName(t) }}</a>
      </div>
      <details v-if="doc.notes" :key="doc.id" class="notes small">
        <summary>Notes, caveats and how this program was derived</summary>
        <p>{{ doc.notes }}</p>
      </details>
    </section>
  </div>
</template>

<style scoped>
.overview { display: grid; gap: 18px; }
.ov-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 24px; align-items: start; }
.text-col, .map-col { align-content: start; min-width: 0; }
.summary { max-width: 75ch; }
.between { justify-content: space-between; }
.count { font: 400 13px var(--font-body); letter-spacing: 0; margin-left: 4px; }
.phases { border-top: 1px solid var(--line); padding-top: 12px; }
.phase { border-top: 1px dashed var(--line); padding-top: 10px; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; max-width: 80ch; }
.aims { gap: 6px; }
.chip.link { text-decoration: none; color: var(--text); }
.chip.link:hover { border-color: var(--accent); }
.notes summary { cursor: pointer; color: var(--muted); padding: 6px 0; min-height: 32px; }
.notes summary:hover { color: var(--text); }
.notes p { max-width: 80ch; margin: 6px 0 0; }
@media (max-width: 820px) {
  .ov-grid { grid-template-columns: 1fr; }
  .map-col { max-width: 460px; }
}
@media (max-width: 520px) {
  .facts { grid-template-columns: 1fr; gap: 2px; }
  .facts dd { margin-bottom: 8px; }
}
</style>
