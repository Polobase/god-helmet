<script setup>
// Three tape measurements that turn the 10-10 rules into cm for one head.
import { computed } from 'vue'
import { head, headInUse } from '../../lib/head.js'
import { HEAD_DEFAULTS, HEAD_LIMITS, HEAD_LABELS } from '../../lib/tape.js'
import SiteMap from '../SiteMap.vue'

const FIELDS = [
  { key: 'nasionInion', n: 1, label: 'Nasion to inion', how: 'From the dent at the top of the nose, over the top of the head, to the bump at the back of the skull.', typical: '33–39 cm' },
  { key: 'earEar', n: 2, label: 'Ear to ear', how: 'From the front root of one tragus (the flap in front of the ear canal), over the crown, to the other. It crosses the first line at Cz, halfway along both.', typical: '32–38 cm' },
  { key: 'circumference', n: 3, label: 'Band line, all the way round', how: 'Round the head through Fpz (10 % of line 1 above the nasion), just above the ear tops and through Oz (10 % above the inion). The band follows this line.', typical: '52–60 cm' },
]
const used = computed(() => headInUse())
const invalid = (k) => head[k] !== '' && head[k] != null && !(Number(head[k]) >= HEAD_LIMITS[k][0] && Number(head[k]) <= HEAD_LIMITS[k][1])
const filled = computed(() => FIELDS.filter((f) => head[f.key] !== '' && head[f.key] != null && !invalid(f.key)).length)
const missing = computed(() => used.value.defaulted.map((k) => `${HEAD_LABELS[k]} ${HEAD_DEFAULTS[k]} cm`).join(', '))
function clear() {
  if (!confirm('Clear your head measurements? You would have to measure again.')) return
  for (const f of FIELDS) head[f.key] = ''
}
</script>

<template>
  <div class="measure">
    <div class="fields">
      <div v-for="f in FIELDS" :key="f.key" class="field-row">
        <span class="n" :class="`m${f.n}`" aria-hidden="true">{{ f.n }}</span>
        <label :for="`head-${f.key}`" class="lbl">
          <b>{{ f.label }}</b>
          <span class="small muted">{{ f.how }}</span>
        </label>
        <div class="unit">
          <input :id="`head-${f.key}`" v-model="head[f.key]" type="number" inputmode="decimal" step="0.5" :min="HEAD_LIMITS[f.key][0]" :max="HEAD_LIMITS[f.key][1]"
            :placeholder="`e.g. ${HEAD_DEFAULTS[f.key]}`" :aria-invalid="invalid(f.key)" :aria-describedby="`head-${f.key}-hint`" />
          <span>cm</span>
        </div>
        <span :id="`head-${f.key}-hint`" class="hint small" :class="invalid(f.key) ? 'warn' : 'muted'">
          {{ invalid(f.key) ? `Expected ${HEAD_LIMITS[f.key][0]}–${HEAD_LIMITS[f.key][1]} cm; using ${HEAD_DEFAULTS[f.key]} cm.` : `Typical ${f.typical}` }}
        </span>
      </div>
      <div class="status small">
        <span v-if="filled === 3" class="ok">All three set. The coil list uses your head.</span>
        <span v-else class="muted">{{ filled }} of 3 set. Until you measure, the coil list uses typical values: {{ missing }}.</span>
        <button v-if="filled" type="button" class="linkbtn" @click="clear">Clear</button>
      </div>
      <p class="small muted">Saved on this device only.</p>
    </div>
    <SiteMap class="figure" view="left" :sites="[]" measure :caption="false" />
  </div>
</template>

<style scoped>
.measure { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px; align-items: center; }
.fields { display: grid; gap: 14px; min-width: 0; }
.field-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) 128px; grid-template-areas: 'n lbl unit' 'n hint hint'; column-gap: 12px; row-gap: 2px; align-items: center; }
.n { grid-area: n; align-self: start; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 13px var(--font-body); border: 2px solid; margin-top: 2px; }
.n.m1 { border-color: var(--accent); }
.n.m2 { border-color: var(--ok); }
.n.m3 { border-color: var(--blue); }
.lbl { grid-area: lbl; display: grid; gap: 2px; }
.unit { grid-area: unit; display: flex; align-items: center; gap: 6px; }
.unit input { width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--text); font-size: 17px; font-family: var(--font-display); text-align: right; min-height: 44px; }
.unit input[aria-invalid='true'] { border-color: var(--warn); }
.unit span { color: var(--muted); }
.hint { grid-area: hint; }
.status { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
.figure { max-width: 420px; justify-self: center; width: 100%; }
@media (max-width: 760px) {
  .measure { grid-template-columns: 1fr; }
  .figure { order: -1; max-width: 340px; }
}
@media (max-width: 460px) {
  .field-row { grid-template-columns: 30px minmax(0, 1fr); grid-template-areas: 'n lbl' 'n unit' 'n hint'; row-gap: 6px; }
  .unit { max-width: 160px; }
}
</style>
