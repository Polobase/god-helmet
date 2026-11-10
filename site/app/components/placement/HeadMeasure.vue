<script setup lang="ts">
// Three tape measurements that turn the 10-10 rules into cm for one head.
// The core keeps them on this device (localStorage).
import { head, headInUse, HEAD_DEFAULTS, HEAD_LIMITS, HEAD_LABELS, type HeadKey } from '~/lib/placement'

const FIELDS: { key: HeadKey, n: number, label: string, how: string, typical: string }[] = [
  { key: 'nasionInion', n: 1, label: 'Nasion to inion', how: 'From the dent at the top of the nose, over the top of the head, to the bump at the back of the skull.', typical: '33–39 cm' },
  { key: 'earEar', n: 2, label: 'Ear to ear', how: 'From the front root of one tragus (the flap in front of the ear canal), over the crown, to the other. It crosses the first line at Cz, halfway along both.', typical: '32–38 cm' },
  { key: 'circumference', n: 3, label: 'Band line, all the way round', how: 'Round the head through Fpz (10 % of line 1 above the nasion), just above the ear tops and through Oz (10 % above the inion). The band follows this line.', typical: '52–60 cm' },
]
const set = (k: HeadKey) => head[k] !== '' && head[k] != null
const invalid = (k: HeadKey) => set(k) && !(Number(head[k]) >= HEAD_LIMITS[k][0] && Number(head[k]) <= HEAD_LIMITS[k][1])
const filled = computed(() => FIELDS.filter((f) => set(f.key) && !invalid(f.key)).length)
const missing = computed(() => headInUse().defaulted.map((k) => `${HEAD_LABELS[k]} ${HEAD_DEFAULTS[k]} cm`).join(', '))

const confirm = useConfirm()
async function clear() {
  if (!await confirm({ title: 'Clear your head measurements?', description: 'You would have to measure again.', confirmLabel: 'Clear', danger: true })) return
  for (const f of FIELDS) head[f.key] = ''
}
</script>

<template>
  <div class="grid items-center gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
    <div class="grid min-w-0 gap-3.5">
      <div v-for="f in FIELDS" :key="f.key" class="field-row">
        <span class="n" :class="`m${f.n}`" aria-hidden="true">{{ f.n }}</span>
        <label :for="`head-${f.key}`" class="lbl grid gap-0.5">
          <b class="text-highlighted">{{ f.label }}</b>
          <span class="text-sm text-muted">{{ f.how }}</span>
        </label>
        <div class="unit flex items-center gap-1.5">
          <UInput :id="`head-${f.key}`" :model-value="String(head[f.key] ?? '')" type="number" inputmode="decimal" step="0.5" size="xl" class="w-full"
            :min="HEAD_LIMITS[f.key][0]" :max="HEAD_LIMITS[f.key][1]" :placeholder="`e.g. ${HEAD_DEFAULTS[f.key]}`"
            :color="invalid(f.key) ? 'warning' : undefined" :highlight="invalid(f.key)" :aria-invalid="invalid(f.key)" :aria-describedby="`head-${f.key}-hint`"
            :ui="{ base: 'num text-right font-display text-lg' }" @update:model-value="(v: string | number) => (head[f.key] = v)" />
          <span class="text-muted">cm</span>
        </div>
        <span :id="`head-${f.key}-hint`" class="hint text-sm" :class="invalid(f.key) ? 'text-warning' : 'text-muted'">
          {{ invalid(f.key) ? `Expected ${HEAD_LIMITS[f.key][0]}–${HEAD_LIMITS[f.key][1]} cm; using ${HEAD_DEFAULTS[f.key]} cm.` : `Typical ${f.typical}` }}
        </span>
      </div>
      <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
        <span v-if="filled === 3" class="text-success">All three set. The coil list uses your head.</span>
        <span v-else class="text-muted">{{ filled }} of 3 set. Until you measure, the coil list uses typical values: {{ missing }}.</span>
        <UButton v-if="filled" variant="link" color="primary" size="sm" class="px-0 py-0" @click="clear">Clear</UButton>
      </div>
      <p class="text-sm text-muted">Saved on this device only.</p>
    </div>
    <SiteMap class="w-full max-w-[26rem] justify-self-center max-md:order-first max-md:max-w-[21rem]" view="left" :sites="[]" measure :caption="false" />
  </div>
</template>

<style scoped>
/* The numbers carry the colours of the three tape lines in the figure. */
.field-row { display: grid; grid-template-columns: 1.875rem minmax(0, 1fr) 8rem; grid-template-areas: 'n lbl unit' 'n hint hint'; column-gap: 0.75rem; row-gap: 0.125rem; align-items: center; }
.n { grid-area: n; align-self: start; width: 1.625rem; height: 1.625rem; border-radius: 50%; display: grid; place-items: center; font: 700 0.8125rem var(--font-body); border: 2px solid; margin-top: 2px; color: var(--text); }
.n.m1 { border-color: var(--accent); }
.n.m2 { border-color: var(--ok); }
.n.m3 { border-color: var(--blue); }
.lbl { grid-area: lbl; }
.unit { grid-area: unit; }
.hint { grid-area: hint; }
@media (max-width: 460px) {
  .field-row { grid-template-columns: 1.875rem minmax(0, 1fr); grid-template-areas: 'n lbl' 'n unit' 'n hint'; row-gap: 0.375rem; }
  .unit { max-width: 10rem; }
}
</style>
