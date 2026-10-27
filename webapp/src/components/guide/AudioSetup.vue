<script setup>
// Pre-run audio set-up: mode, T0 calibration level (hard-capped), blind audio.
import { computed } from 'vue'
import { MODES } from '../../audio/schedule.js'

const props = defineProps({
  modelValue: { type: Object, required: true }, // { mode, levelDb, blind }
  maxLevelDb: { type: Number, default: -6 },
  minLevelDb: { type: Number, default: -50 },
  testing: { type: Boolean, default: false },
  headphones: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'test'])

const MODE_INFO = {
  binaural: 'Binaural: one tone per ear, the beat forms in the brain. Needs stereo headphones.',
  monaural: 'Monaural: both tones mixed in both ears. Works on speakers.',
  isochronic: 'Isochronic: the tone pulses at the beat rate. Works on speakers.',
}
const set = (patch) => emit('update:modelValue', { ...props.modelValue, ...patch })
// Only binaural beats are inaudible as such, so only they can be blinded.
const blindable = computed(() => props.modelValue.mode === 'binaural')
const level = computed({ get: () => props.modelValue.levelDb, set: (v) => set({ levelDb: Math.min(props.maxLevelDb, Number(v)) }) })
</script>

<template>
  <section class="stack" aria-labelledby="audio-setup-h">
    <h3 id="audio-setup-h">Sound</h3>
    <label class="field">Mode
      <select :value="modelValue.mode" @change="set({ mode: $event.target.value })">
        <option v-for="m in MODES" :key="m" :value="m">{{ m[0].toUpperCase() + m.slice(1) }}</option>
      </select>
    </label>
    <p class="small muted">{{ MODE_INFO[modelValue.mode] }}</p>
    <p v-if="modelValue.mode === 'binaural' && !headphones" class="small warn">Binaural beats only work through headphones. On speakers choose isochronic or monaural.</p>

    <ol class="small steps">
      <li>Set the phone or computer volume to about half (60 % at most).</li>
      <li>Press Test sound: a 200 Hz tone in both ears over soft noise.</li>
      <li>Move the slider until the tone is clearly audible and comfortable, never loud. This level is T0; the guide plays everything relative to it.</li>
    </ol>
    <label class="field"><span>Level T0: <b class="num">{{ level }} dB</b> (max {{ maxLevelDb }} dB)</span>
      <input v-model.number="level" type="range" :min="minLevelDb" :max="maxLevelDb" step="1" />
    </label>
    <div class="row">
      <button type="button" class="btn" :disabled="testing" @click="emit('test')">{{ testing ? 'Playing…' : 'Test sound' }}</button>
    </div>

    <label class="check"><input type="checkbox" :checked="modelValue.blind && blindable" :disabled="!blindable" @change="set({ blind: $event.target.checked })" /> Blind audio: the app secretly picks real or sham beats (sham = same tones, no beat)</label>
    <p v-if="!blindable" class="small muted">Blind audio needs binaural mode: in {{ modelValue.mode }} mode a sham is a steady tone against audible {{ modelValue.mode === 'isochronic' ? 'pulsing' : 'beating' }}, so you would hear which one plays.</p>
    <p v-else-if="modelValue.blind" class="small muted">The choice is revealed in the summary, after your ratings.</p>
    <p class="small muted">Stop at once on dizziness, headache, ringing in the ears or unease. No flashing light is used.</p>
  </section>
</template>

<style scoped>
.steps { margin: 0; padding-left: 20px; display: grid; gap: 2px; }
</style>
