<script setup>
// Guide detail: what it is, evidence, setting, cautions, sources, outline and
// a requirements check before Start.
import { computed, onMounted, ref } from 'vue'
import { device, connect } from '../../ble/device.js'
import { presetById } from '../../lib/presets.js'
import { listSets, usableSets } from '../../lib/pool.js'
import { stepDurationMs, plannedMs, armRange } from '../../lib/runs.js'
import { fmtMinutes } from '../../lib/format.js'
import { CATEGORY_LABELS } from '../../lib/guides.js'
import EvidenceChip, { EVIDENCE } from './EvidenceChip.vue'
import ReqIcons from './ReqIcons.vue'

const props = defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['start', 'back'])

const doc = computed(() => props.entry.doc)
const errors = computed(() => props.entry.errors ?? [])
const req = computed(() => doc.value.requires ?? {})
const steps = computed(() => doc.value.steps ?? [])
const arm = computed(() => (doc.value.helmetArm && req.value.helmet !== 'none' ? armRange(doc.value) : null))
const armPreset = computed(() => (doc.value.helmetArm ? presetById(doc.value.helmetArm.preset) : null))
const usesTrials = computed(() => steps.value.some((s) => s.input?.type === 'trial'))
const arvGuide = computed(() => steps.value.some((s) => s.input?.type === 'trial' && s.input.action === 'create' && s.input.arv))

const headphones = ref(false)
const sets = ref(null)
onMounted(async () => {
  if (req.value.pool || usesTrials.value) {
    try {
      sets.value = await listSets()
    } catch {
      sets.value = []
    }
  }
})
const poolCount = computed(() => (sets.value ? usableSets(sets.value).filter((s) => !arvGuide.value || s.images.length === 2).length : null))
const hoursSinceSession = computed(() => {
  const i = device.info
  return i?.lastSessionEpoch && i.env?.timeValid ? (Date.now() / 1000 - i.lastSessionEpoch) / 3600 : null
})

// After accepting, the safety page returns to this guide.
const safetyLink = computed(() => `#safety/${encodeURIComponent(`guides/${doc.value.id}`)}`)

const checks = computed(() => {
  const out = []
  if (req.value.headphones) out.push({ key: 'headphones', status: headphones.value ? 'ok' : 'warn', text: headphones.value ? 'Headphones on' : 'Binaural audio needs stereo headphones (on speakers, pick isochronic in the next step)' })
  const helmet = req.value.helmet ?? 'none'
  if (helmet !== 'none' || usesTrials.value) {
    const needed = helmet === 'required' || usesTrials.value
    if (!device.kind) out.push({ key: 'helmet', status: needed ? 'bad' : 'warn', text: needed ? (usesTrials.value ? 'Trial steps need the helmet (or the demo)' : 'This guide needs the helmet') : 'Helmet not connected: the guide runs without the field' })
    else if (device.info && !device.info.safetyAccepted && helmet !== 'none') out.push({ key: 'helmet', status: helmet === 'required' ? 'bad' : 'warn', text: 'Accept the safety page before using the field', link: safetyLink.value, linkText: 'Open Safety' })
    else out.push({ key: 'helmet', status: 'ok', text: `${device.kind === 'demo' ? 'Demo helmet' : device.name || 'Helmet'} connected` })
    if (device.kind && helmet !== 'none' && hoursSinceSession.value !== null && hoursSinceSession.value < 72) out.push({ key: 'interval', status: 'warn', text: `Last helmet session ${hoursSinceSession.value.toFixed(0)} h ago; 72 h between sessions is recommended` })
  }
  if (req.value.pool || usesTrials.value) {
    const n = poolCount.value
    out.push({ key: 'pool', status: n === null ? 'warn' : n > 0 ? 'ok' : 'bad', text: n === null ? 'Checking the target pool…' : n > 0 ? `${n} usable picture set(s)${arvGuide.value ? ' of 2 pictures' : ''}` : arvGuide.value ? 'ARV needs sets of exactly 2 pictures' : 'No usable picture set (2–8 pictures)', link: n ? '' : '#targets', linkText: 'Open Targets' })
  }
  return out
})
const blocked = computed(() => errors.value.length > 0 || checks.value.some((c) => c.status === 'bad'))

const INPUT_LABELS = { text: 'notes', sketch: 'sketch', rating: 'ratings', questionnaire: 'questionnaire', choice: 'forced choice', outcome: 'outcome', rng: 'RNG task' }
const inputLabel = (inp) => {
  if (!inp || inp.type === 'none') return ''
  if (inp.type === 'crv') return `CRV stage ${inp.stage}`
  if (inp.type === 'trial') return `trial: ${inp.action}`
  return INPUT_LABELS[inp.type] ?? inp.type
}
const minutesOf = (s) => {
  const ms = stepDurationMs(s)
  return ms === null ? 'open' : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round((ms / 60000) * 10) / 10} min`
}
const ev = computed(() => EVIDENCE[doc.value.evidence] ?? { text: '' })
</script>

<template>
  <div class="page">
    <div><button type="button" class="btn ghost sm" @click="emit('back')">← All guides</button></div>

    <header class="card">
      <span class="eyebrow">{{ CATEGORY_LABELS[doc.category] ?? doc.category }} · {{ doc.minutes ?? Math.round(plannedMs(doc) / 60000) }} min</span>
      <h2>{{ doc.name }}</h2>
      <div class="row">
        <EvidenceChip :level="doc.evidence" />
        <ReqIcons :requires="req" labelled />
      </div>
      <p>{{ doc.summary }}</p>
      <p v-if="ev.text" class="small muted">{{ ev.text }}</p>
    </header>

    <p v-if="errors.length" class="card small bad">This guide file has errors and cannot run: {{ errors.join('; ') }}</p>

    <div class="grid2">
      <section class="card">
        <h3>Setting</h3>
        <p class="small">{{ doc.setting || '–' }}</p>
        <h3 class="caution-h">Cautions</h3>
        <p class="small caution">{{ doc.cautions || 'Stop at once if you feel unwell.' }}</p>
        <template v-if="doc.unlock">
          <h3>When to try it</h3>
          <p class="small">{{ doc.unlock }}</p>
        </template>
      </section>

      <section class="card">
        <h3>Before you start</h3>
        <ul class="checks">
          <li v-for="c in checks" :key="c.key" :class="c.status">
            <span aria-hidden="true">{{ c.status === 'ok' ? '✓' : c.status === 'bad' ? '✗' : '!' }}</span>
            <span>{{ c.text }}<template v-if="c.link"> · <a :href="c.link">{{ c.linkText || 'Open' }}</a></template></span>
          </li>
          <li v-if="!checks.length" class="ok"><span aria-hidden="true">✓</span><span>Nothing to prepare beyond the setting.</span></li>
        </ul>
        <label v-if="req.headphones" class="check"><input v-model="headphones" type="checkbox" /> I'm wearing stereo headphones (closed-back if possible)</label>
        <div v-if="!device.kind && (req.helmet && req.helmet !== 'none' || usesTrials)" class="row">
          <button type="button" class="btn sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">Connect helmet</button>
          <button type="button" class="btn ghost sm" @click="connect('demo')">Demo</button>
        </div>
        <p v-if="arm && armPreset" class="small muted">Helmet arm: “{{ armPreset.doc.name }}” during {{ steps.slice(arm.first, arm.last + 1).map((s) => s.title).join(', ') }}{{ doc.helmetArm.blind ? ' (blind real/sham, revealed after your rating)' : '' }}.</p>
        <p v-else-if="arm && !armPreset" class="small warn">Helmet arm preset “{{ doc.helmetArm.preset }}” is missing; the guide runs without it.</p>
        <div class="row">
          <button type="button" class="btn primary" :disabled="blocked" @click="emit('start', { headphones: headphones })">Start</button>
        </div>
      </section>
    </div>

    <section class="card">
      <h3>Steps</h3>
      <ol class="outline">
        <li v-for="(s, i) in steps" :key="s.id">
          <span class="muted num">{{ i + 1 }}</span>
          <span class="t">{{ s.title }}</span>
          <span class="m small muted num">{{ minutesOf(s) }}</span>
          <span class="tags small muted">
            <span v-if="s.audio">audio</span>
            <span v-if="arm && i >= arm.first && i <= arm.last">helmet</span>
            <span v-if="inputLabel(s.input)">{{ inputLabel(s.input) }}</span>
            <span v-if="(s.advance ?? (stepDurationMs(s) ? 'timer' : 'manual')) === 'manual'">you press Next</span>
          </span>
        </li>
      </ol>
      <p class="small muted">Planned time {{ fmtMinutes(plannedMs(doc)) }}{{ steps.some((s) => stepDurationMs(s) === null) ? ' plus open-ended steps' : '' }}.</p>
    </section>

    <section v-if="doc.sources?.length" class="card">
      <h3>Sources</h3>
      <ul class="sources small">
        <li v-for="(s, i) in doc.sources" :key="i">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.title || s.url }}</a>
          <span v-else>{{ s.title }}</span>
        </li>
      </ul>
      <p class="small muted">Structure cited from the sources; all instructions are our own wording.</p>
    </section>

    <slot />
  </div>
</template>

<style scoped>
.grid2 > .card { align-content: start; }
.caution-h { color: var(--warn); }
.caution { border-left: 3px solid var(--warn); padding-left: 10px; color: var(--text); }
.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; }
.checks li { display: grid; grid-template-columns: 18px 1fr; gap: 6px; }
.checks li.ok > span:first-child { color: var(--ok); }
.checks li.warn > span:first-child { color: var(--warn); }
.checks li.bad { color: var(--bad); }
.outline { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-width: 720px; }
.outline li { display: grid; grid-template-columns: 1.8em 1fr auto; gap: 0 10px; }
.outline .tags { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
.sources { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
</style>
