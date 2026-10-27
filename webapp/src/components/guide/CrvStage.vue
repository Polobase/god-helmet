<script setup>
// One CRV stage worksheet (structure after the 1986 CRV manual and Open Source
// CRV 2005; wording ours). Field kinds: 'text' (one line), 'words' (short
// time-stamped entries), 'sketch'. Stage 1 repeats its fields per ideogram
// iteration. Stored as { stage, tag, fields | iterations, breaks }.
import { computed, inject, reactive, ref, watch } from 'vue'
import { randomBelow } from '../../lib/crypto.js'
import SketchPad from '../SketchPad.vue'
import EntryList from './EntryList.vue'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const run = inject('guideRun', null)

const stage = Number(props.input.stage) || 1
const repeat = stage === 1

const MATRIX = [['s2', 'S-2: sensory'], ['d', 'D: dimensionals'], ['ai', 'AI: aesthetic impact'], ['ei', 'EI: emotional impact'], ['t', 'T: tangibles'], ['i', 'I: intangibles'], ['aol', 'AOL'], ['aols', 'AOL/S: AOL with signal']]
  .map(([key, label]) => ({ key, label, kind: 'words' }))
const DEFAULTS = {
  1: [{ key: 'ideogram', label: 'Ideogram', kind: 'sketch' }, { key: 'a', label: 'A: motion of the line, then its feel', kind: 'text' }, { key: 'b', label: 'B: overall sense in one word, or "no B"', kind: 'text' }],
  2: [{ key: 'sensory', label: 'Sensory impressions', kind: 'words' }, { key: 'dimensionals', label: 'Dimensionals', kind: 'words' }, { key: 'ai', label: 'Aesthetic impact', kind: 'text' }],
  3: [{ key: 'dimensionals', label: 'Dimensionals', kind: 'words' }, { key: 'sketch', label: 'Stage III sketch', kind: 'sketch' }],
  4: MATRIX,
  5: [{ key: 'item', label: 'Item probed (from your Stage IV data)', kind: 'text' }, { key: 'emanations', label: 'What comes from it', kind: 'words' }],
  6: [{ key: 'model', label: 'What you modelled', kind: 'text' }, ...MATRIX],
}
const HINTS = {
  1: 'Write the tag, then let your hand draw the ideogram at once, without thinking. A: the motion of the line, then how it feels (hard, soft, fluid, airy, warm). B: one word for the overall sense, or "no B". Do 3 to 6 iterations.',
  2: 'Basic sensory words only, one or two per entry: sounds, textures, temperatures, colours, light, smells, tastes, energy. Then dimensionals. If a feeling about the site rises, declare an AI break and wait until it fades.',
  3: 'Sketch fast: long horizontals first, then verticals, then diagonals, then details. Add dimensionals as they come.',
  4: 'Single words, left to right and down. T = things you could touch, I = qualities and purpose, EI = emotional impact, AI = aesthetic impact. Keep every column fed.',
  5: 'Pick one item from your Stage IV data and list what comes from it: objects, attributes, subjects, topics. End the list when nothing comes for a few seconds.',
  6: 'Shape the main tangibles in clay (or draw them in 3-D) while the matrix stays open. Keep your attention on the data, not the model.',
}

const kindOf = (k) => {
  const s = String(k || 'text').toLowerCase()
  if (['words', 'list', 'entries'].includes(s)) return 'words'
  if (['sketch', 'drawing', 'ideogram'].includes(s)) return 'sketch'
  return 'text'
}
const fields = (props.input.fields?.length ? props.input.fields : DEFAULTS[stage] ?? [{ key: 'notes', label: 'Notes', kind: 'text' }])
  .map((f) => ({ key: f.key, label: f.label || f.key, kind: kindOf(f.kind) }))
const wordFields = fields.filter((f) => f.kind === 'words')
// A guide may give breaks their own column (key "breaks"); declared breaks are listed there too.
const breaksField = wordFields.find((f) => f.key === 'breaks')
const grid = wordFields.length >= 3 // matrix layout
const emptyValues = () => Object.fromEntries(fields.map((f) => [f.key, f.kind === 'words' ? [] : '']))
const fill = (saved) => ({ ...emptyValues(), ...(saved ?? {}) })

const saved = props.modelValue
const state = reactive({
  stage,
  tag: saved?.tag ?? '',
  ...(repeat ? { iterations: saved?.iterations?.length ? saved.iterations.map(fill) : [{ ...emptyValues(), at: Date.now() }] } : { fields: fill(saved?.fields) }),
  breaks: saved?.breaks ?? [],
})
const current = computed(() => (repeat ? state.iterations[state.iterations.length - 1] : state.fields))
const previous = computed(() => (repeat ? state.iterations.slice(0, -1) : []))

// Tag: two 4-digit numbers from the trial commitment (reveals nothing), else random.
if (!state.tag) {
  const c = run?.ctx?.trial?.commitment ?? ''
  const n = c ? [parseInt(c.slice(0, 8), 16) % 10000, parseInt(c.slice(8, 16), 16) % 10000] : [randomBelow(10000), randomBelow(10000)]
  state.tag = n.map((x) => String(x).padStart(4, '0')).join(' ')
}

watch(state, () => emit('update:modelValue', JSON.parse(JSON.stringify(state))), { deep: true, immediate: true })

const addIteration = () => state.iterations.push({ ...emptyValues(), at: Date.now() })
// Comparisons ("like", "looks", "?") usually mean the mind is guessing.
const looksLikeAol = (text) => /\b(like|looks|resembles|maybe)\b|\?/i.test(text || '')
const aolCandidate = computed(() => {
  for (const f of fields) {
    const v = current.value[f.key]
    const text = f.kind === 'words' ? v?.at?.(-1)?.text : f.kind === 'text' ? v : ''
    if (looksLikeAol(text) && !state.breaks.some((b) => b.kind === 'AOL' && b.text === text.trim())) return text.trim()
  }
  return ''
})

// ---- breaks
const BREAKS = [
  { kind: 'AOL', label: 'AOL break', ask: 'Name the overlay (one or two words)' },
  { kind: 'AI', label: 'AI break', ask: 'What is the aesthetic impact?' },
  { kind: 'Confusion', label: 'Confusion' },
  { kind: 'TM', label: 'Too much' },
  { kind: 'Miss', label: 'Missed it' },
]
const asking = ref(null)
const breakText = ref('')
const breakMsg = ref('')
function openBreak(b, text = '') {
  if (!b.ask) return declare(b, '')
  asking.value = b
  breakText.value = text
}
function declare(b, text) {
  const t = text.trim()
  state.breaks.push({ kind: b.kind, text: t, at: Date.now(), iteration: repeat ? state.iterations.length : undefined })
  if (breaksField) current.value[breaksField.key].push({ text: `${b.kind}${t ? `: ${t}` : ''}`, at: Date.now() })
  asking.value = null
  breakText.value = ''
  breakMsg.value = b.kind === 'AOL' ? `AOL break${t ? `: “${t}”` : ''}. Set it aside and go back to raw impressions.` : `${b.label} noted. Pause, then pick up the data again.`
}
</script>

<template>
  <div class="stack">
    <div class="row between">
      <span class="eyebrow">CRV stage {{ stage }}</span>
      <span class="tag num">Tag {{ state.tag }}</span>
    </div>
    <p class="small muted">{{ HINTS[stage] }}</p>

    <ol v-if="previous.length" class="previous">
      <li v-for="(it, i) in previous" :key="it.at ?? i">
        <img v-for="f in fields.filter((x) => x.kind === 'sketch' && it[x.key])" :key="f.key" :src="it[f.key]" class="thumb" :alt="`${f.label}, iteration ${i + 1}`" />
        <span class="small">
          <template v-for="f in fields.filter((x) => x.kind !== 'sketch')" :key="f.key">
            <b>{{ f.label.split(':')[0] }}</b> {{ f.kind === 'words' ? it[f.key].map((e) => e.text).join(', ') || '–' : it[f.key] || '–' }} ·
          </template>
        </span>
      </li>
    </ol>
    <div v-if="repeat" class="small muted">Iteration {{ state.iterations.length }}</div>

    <div class="fields" :class="{ grid }">
      <template v-for="f in fields" :key="`${repeat ? state.iterations.length : 0}-${f.key}`">
        <div v-if="f.kind === 'sketch'" class="wide stack">
          <span class="lbl">{{ f.label }}</span>
          <SketchPad :initial="current[f.key]" @change="(d) => (current[f.key] = d)" />
        </div>
        <EntryList v-else-if="f.kind === 'words'" v-model="current[f.key]" :label="f.label" :basic-words="true" />
        <label v-else class="field wide"><span class="lbl">{{ f.label }}</span>
          <input v-model="current[f.key]" type="text" autocomplete="off" />
        </label>
      </template>
    </div>

    <p v-if="aolCandidate" class="small warn">“{{ aolCandidate }}” sounds like a comparison or a guess. <button type="button" class="btn ghost sm" @click="openBreak(BREAKS[0], aolCandidate)">Declare it as AOL</button></p>
    <div v-if="repeat" class="row"><button type="button" class="btn sm" @click="addIteration">New iteration</button></div>

    <section class="breaks" aria-label="Breaks">
      <div class="row">
        <button v-for="b in BREAKS" :key="b.kind" type="button" class="btn sm" :class="{ primary: b.kind === 'AOL' }" @click="openBreak(b)">{{ b.label }}</button>
      </div>
      <form v-if="asking" class="row" @submit.prevent="declare(asking, breakText)">
        <input v-model="breakText" type="text" :aria-label="asking.ask" :placeholder="asking.ask" autocomplete="off" class="grow" />
        <button type="submit" class="btn primary sm">Declare</button>
        <button type="button" class="btn ghost sm" @click="asking = null">Cancel</button>
      </form>
      <p class="small" aria-live="polite">{{ breakMsg }}</p>
      <ul v-if="state.breaks.length && !breaksField" class="list">
        <li v-for="(b, i) in state.breaks" :key="i" class="chip">{{ b.kind }}{{ b.text ? `: ${b.text}` : '' }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.between { justify-content: space-between; }
.tag { font-size: 18px; letter-spacing: .08em; }
.fields { display: grid; gap: 12px; }
.fields.grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.fields.grid .wide { grid-column: 1 / -1; }
.lbl { color: var(--text); font-weight: 600; font-size: 14px; }
.previous { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
.previous li { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
.thumb { width: 80px; border-radius: 6px; }
.breaks { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 10px; }
.grow { flex: 1; min-width: 160px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
</style>
