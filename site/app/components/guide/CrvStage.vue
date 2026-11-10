<script setup lang="ts">
// One CRV stage worksheet (structure after the 1986 CRV manual and Open Source
// CRV 2005; wording ours). Field kinds: 'text' (one line), 'words' (short
// time-stamped entries), 'sketch'. Stage 1 repeats its fields per ideogram
// iteration. Stored as { stage, tag, fields | iterations, breaks }.
import { randomBelow } from '#core/lib/crypto.js'
import { GUIDE_RUN } from '~/lib/guideRun'
import type { CrvInputSpec } from '~/lib/guides'
import type { Entry } from './EntryList.vue'

type Kind = 'text' | 'words' | 'sketch'
interface Field { key: string, label: string, kind: Kind }
/** One set of field values: a string (text, sketch) or entries (words); `at` on an iteration. */
type Values = Record<string, string | Entry[] | number>
interface Break { kind: string, text: string, at: number, iteration?: number }
interface Stored { stage: number, tag: string, fields?: Values, iterations?: Values[], breaks: Break[] }

const props = defineProps<{ input: CrvInputSpec, modelValue?: Stored | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Stored] }>()
const run = inject(GUIDE_RUN, null)

const stage = Number(props.input.stage) || 1
const repeat = stage === 1

const MATRIX: Field[] = [['s2', 'S-2: sensory'], ['d', 'D: dimensionals'], ['ai', 'AI: aesthetic impact'], ['ei', 'EI: emotional impact'], ['t', 'T: tangibles'], ['i', 'I: intangibles'], ['aol', 'AOL'], ['aols', 'AOL/S: AOL with signal']]
  .map(([key, label]) => ({ key: key!, label: label!, kind: 'words' }))
const DEFAULTS: Record<number, Field[]> = {
  1: [{ key: 'ideogram', label: 'Ideogram', kind: 'sketch' }, { key: 'a', label: 'A: motion of the line, then its feel', kind: 'text' }, { key: 'b', label: 'B: overall sense in one word, or "no B"', kind: 'text' }],
  2: [{ key: 'sensory', label: 'Sensory impressions', kind: 'words' }, { key: 'dimensionals', label: 'Dimensionals', kind: 'words' }, { key: 'ai', label: 'Aesthetic impact', kind: 'text' }],
  3: [{ key: 'dimensionals', label: 'Dimensionals', kind: 'words' }, { key: 'sketch', label: 'Stage III sketch', kind: 'sketch' }],
  4: MATRIX,
  5: [{ key: 'item', label: 'Item probed (from your Stage IV data)', kind: 'text' }, { key: 'emanations', label: 'What comes from it', kind: 'words' }],
  6: [{ key: 'model', label: 'What you modelled', kind: 'text' }, ...MATRIX],
}
const HINTS: Record<number, string> = {
  1: 'Write the tag, then let your hand draw the ideogram at once, without thinking. A: the motion of the line, then how it feels (hard, soft, fluid, airy, warm). B: one word for the overall sense, or "no B". Do 3 to 6 iterations.',
  2: 'Basic sensory words only, one or two per entry: sounds, textures, temperatures, colours, light, smells, tastes, energy. Then dimensionals. If a feeling about the site rises, declare an AI break and wait until it fades.',
  3: 'Sketch fast: long horizontals first, then verticals, then diagonals, then details. Add dimensionals as they come.',
  4: 'Single words, left to right and down. T = things you could touch, I = qualities and purpose, EI = emotional impact, AI = aesthetic impact. Keep every column fed.',
  5: 'Pick one item from your Stage IV data and list what comes from it: objects, attributes, subjects, topics. End the list when nothing comes for a few seconds.',
  6: 'Shape the main tangibles in clay (or draw them in 3-D) while the matrix stays open. Keep your attention on the data, not the model.',
}

const kindOf = (k: unknown): Kind => {
  const s = String(k || 'text').toLowerCase()
  if (['words', 'list', 'entries'].includes(s)) return 'words'
  if (['sketch', 'drawing', 'ideogram'].includes(s)) return 'sketch'
  return 'text'
}
const fields: Field[] = (props.input.fields?.length ? props.input.fields : DEFAULTS[stage] ?? [{ key: 'notes', label: 'Notes', kind: 'text' }])
  .map((f) => ({ key: f.key, label: f.label || f.key, kind: kindOf(f.kind) }))
const wordFields = fields.filter((f) => f.kind === 'words')
// A guide may give breaks their own column (key "breaks"); declared breaks are listed there too.
const breaksField = wordFields.find((f) => f.key === 'breaks')
const matrix = wordFields.length >= 3 // matrix layout
const emptyValues = (): Values => Object.fromEntries(fields.map((f) => [f.key, f.kind === 'words' ? [] : '']))
const fill = (saved?: Values | null): Values => ({ ...emptyValues(), ...(saved ?? {}) })

const saved = props.modelValue
const state = reactive<Stored>({
  stage,
  tag: saved?.tag ?? '',
  ...(repeat ? { iterations: saved?.iterations?.length ? saved.iterations.map(fill) : [{ ...emptyValues(), at: Date.now() }] } : { fields: fill(saved?.fields) }),
  breaks: saved?.breaks ?? [],
})
const current = computed<Values>(() => (repeat ? state.iterations![state.iterations!.length - 1]! : state.fields!))
const previous = computed(() => (repeat ? state.iterations!.slice(0, -1) : []))
// The fields by kind, for the template.
const text = (v: Values, f: Field) => v[f.key] as string
const words = (v: Values, f: Field) => v[f.key] as Entry[]

// Tag: two 4-digit numbers from the trial commitment (reveals nothing), else random.
if (!state.tag) {
  const c = run?.ctx?.trial?.commitment ?? ''
  const n = c ? [parseInt(c.slice(0, 8), 16) % 10000, parseInt(c.slice(8, 16), 16) % 10000] : [randomBelow(10000), randomBelow(10000)]
  state.tag = n.map((x) => String(x).padStart(4, '0')).join(' ')
}

watch(state, () => emit('update:modelValue', JSON.parse(JSON.stringify(state))), { deep: true, immediate: true })

const addIteration = () => state.iterations!.push({ ...emptyValues(), at: Date.now() })
// Comparisons ("like", "looks", "?") usually mean the mind is guessing.
const looksLikeAol = (t: string | undefined) => /\b(like|looks|resembles|maybe)\b|\?/i.test(t || '')
const aolCandidate = computed(() => {
  for (const f of fields) {
    const t = f.kind === 'words' ? words(current.value, f)?.at?.(-1)?.text : f.kind === 'text' ? text(current.value, f) : ''
    if (t && looksLikeAol(t) && !state.breaks.some((b) => b.kind === 'AOL' && b.text === t.trim())) return t.trim()
  }
  return ''
})

// ---- breaks
interface BreakKind { kind: string, label: string, ask?: string }
const BREAKS: BreakKind[] = [
  { kind: 'AOL', label: 'AOL break', ask: 'Name the overlay (one or two words)' },
  { kind: 'AI', label: 'AI break', ask: 'What is the aesthetic impact?' },
  { kind: 'Confusion', label: 'Confusion' },
  { kind: 'TM', label: 'Too much' },
  { kind: 'Miss', label: 'Missed it' },
]
const asking = ref<BreakKind | null>(null)
const breakText = ref('')
const breakMsg = ref('')
function openBreak(b: BreakKind, t = '') {
  if (!b.ask) return declare(b, '')
  asking.value = b
  breakText.value = t
}
function declare(b: BreakKind, input: string) {
  const t = input.trim()
  state.breaks.push({ kind: b.kind, text: t, at: Date.now(), iteration: repeat ? state.iterations!.length : undefined })
  if (breaksField) words(current.value, breaksField).push({ text: `${b.kind}${t ? `: ${t}` : ''}`, at: Date.now() })
  asking.value = null
  breakText.value = ''
  breakMsg.value = b.kind === 'AOL' ? `AOL break${t ? `: “${t}”` : ''}. Set it aside and go back to raw impressions.` : `${b.label} noted. Pause, then pick up the data again.`
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 class="text-xl">CRV stage {{ stage }}</h2>
      <span class="num text-lg tracking-widest text-highlighted">Tag {{ state.tag }}</span>
    </div>
    <p class="measure text-sm text-muted">{{ HINTS[stage] }}</p>

    <ol v-if="previous.length" class="grid gap-2">
      <li v-for="(it, i) in previous" :key="(it.at as number | undefined) ?? i" class="flex flex-wrap items-start gap-2">
        <span class="num text-sm text-muted">{{ i + 1 }}.</span>
        <GuideSketchImage v-for="f in fields.filter((x) => x.kind === 'sketch' && it[x.key])" :key="f.key" :src="text(it, f)" class="w-20" :alt="`${f.label}, iteration ${i + 1}`" />
        <span class="min-w-0 flex-1 basis-48 text-sm">
          <template v-for="(f, j) in fields.filter((x) => x.kind !== 'sketch')" :key="f.key">
            <template v-if="j">, </template><b class="text-highlighted">{{ f.label.split(':')[0] }}</b> {{ f.kind === 'words' ? words(it, f).map((e) => e.text).join(', ') || '–' : text(it, f) || '–' }}
          </template>
        </span>
      </li>
    </ol>
    <div v-if="repeat" class="text-sm text-muted">Iteration {{ state.iterations!.length }}</div>

    <div class="grid gap-3" :class="{ matrix }">
      <template v-for="f in fields" :key="`${repeat ? state.iterations!.length : 0}-${f.key}`">
        <div v-if="f.kind === 'sketch'" class="wide grid gap-1.5">
          <span class="text-sm font-semibold text-highlighted">{{ f.label }}</span>
          <SketchPad label="" :initial="text(current, f)" @change="(d) => (current[f.key] = d)" />
        </div>
        <GuideEntryList v-else-if="f.kind === 'words'" :model-value="words(current, f)" :label="f.label" basic-words @update:model-value="(v) => (current[f.key] = v)" />
        <UFormField v-else :label="f.label" class="wide" :ui="{ label: 'font-semibold text-highlighted' }">
          <UInput :model-value="text(current, f)" autocomplete="off" class="w-full max-w-xl" @update:model-value="(v) => (current[f.key] = String(v ?? ''))" />
        </UFormField>
      </template>
    </div>

    <p v-if="aolCandidate" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-warning">
      <span>“{{ aolCandidate }}” sounds like a comparison or a guess.</span>
      <UButton size="xs" variant="ghost" @click="openBreak(BREAKS[0]!, aolCandidate)">Declare it as AOL</UButton>
    </p>
    <div v-if="repeat"><UButton size="sm" icon="i-lucide-plus" @click="addIteration">New iteration</UButton></div>

    <section class="grid gap-2 border-t border-default pt-3" aria-label="Breaks">
      <div class="flex flex-wrap gap-2">
        <UButton v-for="b in BREAKS" :key="b.kind" size="sm" :color="b.kind === 'AOL' ? 'primary' : 'neutral'" :variant="b.kind === 'AOL' ? 'soft' : 'outline'" @click="openBreak(b)">{{ b.label }}</UButton>
      </div>
      <form v-if="asking" class="flex flex-wrap gap-2" @submit.prevent="declare(asking, breakText)">
        <UInput v-model="breakText" :aria-label="asking.ask" :placeholder="asking.ask" autocomplete="off" autofocus class="min-w-40 flex-1" />
        <UButton type="submit" size="sm" color="primary" variant="solid">Declare</UButton>
        <UButton size="sm" variant="ghost" @click="asking = null">Cancel</UButton>
      </form>
      <p class="text-sm" aria-live="polite">{{ breakMsg }}</p>
      <ul v-if="state.breaks.length && !breaksField" class="flex flex-wrap gap-1.5">
        <li v-for="(b, i) in state.breaks" :key="i"><UBadge color="neutral" variant="outline">{{ b.kind }}{{ b.text ? `: ${b.text}` : '' }}</UBadge></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.matrix { grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); }
.matrix .wide { grid-column: 1 / -1; }
</style>
