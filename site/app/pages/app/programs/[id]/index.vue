<script setup lang="ts">
// Program overview: what it is, its phases with signal and waveform, the coils
// on a head map (with a slowed-down preview), setting, schedule, aims and notes.
import { describePattern, describeSpatial, fmtMinutes } from '#core/lib/format.js'
import { coilsUsed } from '#core/engine/spatial.js'
import { PATTERN_INFO } from '#core/engine/patterns.js'
import { presetById, sessionSites, program, preview, setPhase, startPreview, stopPreview } from '~/lib/programs'

const preset = computed(() => presetById(program.id)!)
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session!)
// While the preview runs, the phase follows it.
const shown = computed(() => Math.min(preview.value ? preview.value.phase : program.phase, session.value.phases.length - 1))
const phase = computed(() => session.value.phases[shown.value]!)
const used = computed(() => coilsUsed(phase.value.spatial, session.value.geometry))
const direction = computed(() => (phase.value.spatial.mode === 'rotate' ? (phase.value.spatial.ccw ? 'ccw' : 'cw') : null))
const levels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : null))
const coilCount = computed(() => sessionSites(session.value).filter(Boolean).length)
const facts = computed(() => [['Setting', doc.value.setting], ['Schedule', doc.value.schedule]].filter(([, v]) => v) as [string, string][])

// "left-tpj" -> "left TPJ" (the Brain page has the full region names)
const targetName = (id: string) => id.replace(/-/g, ' ').replace(/\b(tpj|dlpfc|vmpfc|stg|mtg)\b/g, (m) => m.toUpperCase())
</script>

<template>
  <div v-if="session" class="grid gap-5">
    <section class="panel grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div class="grid min-w-0 content-start gap-5">
        <div class="grid gap-2">
          <p class="measure text-[1.05rem] text-highlighted">{{ doc.summary }}</p>
          <p v-if="doc.origin" class="text-sm text-muted">{{ doc.origin }}</p>
        </div>

        <div class="grid gap-3 border-t border-default pt-5">
          <h2 class="text-xl">Phases <span class="num font-sans text-sm font-normal text-muted">{{ session.phases.length }}, {{ fmtMinutes(session.totalMs) }}</span></h2>
          <PhaseTimeline v-if="session.phases.length > 1" :phases="session.phases" :selected="shown" :position-ms="preview ? preview.programMs : -1" @select="setPhase" />
          <div class="grid gap-2.5">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4">
              <b class="text-highlighted">{{ shown + 1 }}. {{ phase.name }}</b>
              <span class="text-sm text-muted">{{ fmtMinutes(phase.durationMs) }}<template v-if="shown > 0">, {{ phase.crossfade ? 'crossfade' : 'abrupt switch' }}</template></span>
            </div>
            <p class="text-sm"><span class="text-muted">Signal:</span> {{ describePattern(phase.pattern) }}</p>
            <p class="text-sm text-muted">{{ (PATTERN_INFO as Record<string, string>)[phase.pattern.type] }}</p>
            <WaveformPreview :pattern="phase.pattern" />
            <p class="text-sm"><span class="text-muted">Coils:</span> {{ describeSpatial(phase.spatial) }}</p>
            <p v-if="phase.track2" class="text-sm"><span class="text-muted">Second track:</span> {{ describePattern(phase.track2.pattern) }}, {{ describeSpatial(phase.track2.spatial) }}</p>
          </div>
        </div>
      </div>

      <div class="grid min-w-0 content-start gap-3 max-lg:max-w-md">
        <h2 class="text-xl">Coils <span class="num font-sans text-sm font-normal text-muted">{{ coilCount }} of 8</span></h2>
        <SiteMap :sites="sessionSites(session)" :used="levels ? undefined : used" :levels="levels ?? undefined" :direction="direction ?? undefined" />
        <div class="flex flex-wrap gap-2">
          <UButton v-if="!preview" size="sm" icon="i-lucide-play" @click="startPreview()">Preview coil activity ({{ program.speed === 1 ? 'real time' : `${program.speed}× slower` }})</UButton>
          <UButton v-else size="sm" icon="i-lucide-square" @click="stopPreview">Stop preview</UButton>
          <UButton size="sm" variant="ghost" :to="programPath(program.id, 'placement')">Place the coils</UButton>
        </div>
      </div>
    </section>

    <section v-if="facts.length || doc.targets?.length || doc.notes" class="panel grid gap-4 p-5 sm:p-7">
      <dl v-if="facts.length" class="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <template v-for="[k, v] in facts" :key="k">
          <dt class="text-muted">{{ k }}</dt>
          <dd class="m-0 max-w-[80ch]"><ClampText :text="v" /></dd>
        </template>
      </dl>
      <div v-if="doc.targets?.length" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted">Aims at:</span>
        <UButton v-for="t in doc.targets" :key="t" size="xs" class="rounded-full" :to="programPath(program.id, 'brain')" :title="`Field at ${targetName(t)}, on the brain`" @click="program.region = t">{{ targetName(t) }}</UButton>
      </div>
      <details v-if="doc.notes" :key="doc.id" class="text-sm">
        <summary class="cursor-pointer py-1.5 text-muted hover:text-highlighted">Notes, caveats and how this program was derived</summary>
        <p class="mt-1.5 max-w-[80ch]">{{ doc.notes }}</p>
      </details>
    </section>
  </div>
</template>
