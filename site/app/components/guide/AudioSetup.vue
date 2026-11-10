<script setup lang="ts">
// Sound set-up before a run: mode, the calibration level T0 (hard-capped), blind audio.
import { MODES, type AudioChoice, type AudioMode } from '~/lib/guides'

const props = withDefaults(defineProps<{
  modelValue: AudioChoice
  maxLevelDb?: number
  minLevelDb?: number
  testing?: boolean
  headphones?: boolean
}>(), { maxLevelDb: -6, minLevelDb: -50 })
const emit = defineEmits<{ 'update:modelValue': [value: AudioChoice], 'test': [] }>()
const id = useId()

const MODE_INFO: Record<AudioMode, string> = {
  binaural: 'Binaural: one tone per ear, the beat forms in the brain. Needs stereo headphones.',
  monaural: 'Monaural: both tones mixed in both ears. Works on speakers.',
  isochronic: 'Isochronic: the tone pulses at the beat rate. Works on speakers.',
}
const modeItems = MODES.map((m) => ({ value: m, label: m[0]!.toUpperCase() + m.slice(1) }))
const set = (patch: Partial<AudioChoice>) => emit('update:modelValue', { ...props.modelValue, ...patch })
const mode = computed({ get: () => props.modelValue.mode, set: (m: AudioMode) => set({ mode: m }) })
// Only binaural beats are inaudible as such, so only they can be blinded.
const blindable = computed(() => props.modelValue.mode === 'binaural')
const level = computed({ get: () => props.modelValue.levelDb, set: (v: number) => set({ levelDb: Math.min(props.maxLevelDb, Number(v)) }) })
const blind = computed({ get: () => props.modelValue.blind && blindable.value, set: (v: boolean) => set({ blind: v }) })
</script>

<template>
  <section class="grid gap-4" :aria-labelledby="`${id}-h`">
    <h2 :id="`${id}-h`" class="text-xl">Sound</h2>

    <div class="grid gap-2">
      <UTabs v-model="mode" :items="modeItems" :content="false" size="sm" class="w-full sm:w-fit" aria-label="Mode" />
      <p class="text-sm text-muted">{{ MODE_INFO[modelValue.mode] }}</p>
      <p v-if="modelValue.mode === 'binaural' && !headphones" class="text-sm text-warning">Binaural beats only work through headphones. On speakers choose isochronic or monaural.</p>
    </div>

    <ol class="measure grid list-decimal gap-1 pl-5 text-sm">
      <li>Set the phone or computer volume to about half (60 % at most).</li>
      <li>Press Test sound: a 200 Hz tone in both ears over soft noise.</li>
      <li>Move the slider until the tone is clearly audible and comfortable, never loud. This level is T0; the guide plays everything relative to it.</li>
    </ol>
    <div class="grid max-w-xl gap-2">
      <label :for="`${id}-level`" class="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span>Level T0 (max {{ maxLevelDb }} dB)</span>
        <b class="num font-display text-xl font-[620] text-highlighted">{{ level }} dB</b>
      </label>
      <USlider :id="`${id}-level`" v-model="level" :min="minLevelDb" :max="maxLevelDb" :step="1" aria-label="Level T0 in dB" />
    </div>
    <div>
      <UButton icon="i-lucide-volume-2" :disabled="testing" @click="emit('test')">{{ testing ? 'Playing…' : 'Test sound' }}</UButton>
    </div>

    <UCheckbox v-model="blind" :disabled="!blindable" label="Blind audio" description="The app secretly picks real or sham beats (sham = same tones, no beat)." />
    <p v-if="!blindable" class="measure text-sm text-muted">Blind audio needs binaural mode: in {{ modelValue.mode }} mode a sham is a steady tone against audible {{ modelValue.mode === 'isochronic' ? 'pulsing' : 'beating' }}, so you would hear which one plays.</p>
    <p v-else-if="modelValue.blind" class="text-sm text-muted">The choice is revealed in the summary, after your ratings.</p>
    <p class="measure text-sm text-muted">Stop at once on dizziness, headache, ringing in the ears or unease. No flashing light is used.</p>
  </section>
</template>
