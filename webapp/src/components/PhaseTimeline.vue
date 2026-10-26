<script setup>
// Session phases as proportional segments; click to select, live position marker.
import { computed } from 'vue'
import { fmtMinutes } from '../lib/format.js'

const props = defineProps({
  phases: { type: Array, required: true },
  selected: { type: Number, default: -1 },
  positionMs: { type: Number, default: -1 },
})
defineEmits(['select'])

const total = computed(() => props.phases.reduce((a, p) => a + p.durationMs, 0))
const marker = computed(() => (props.positionMs >= 0 ? (100 * props.positionMs) / total.value : -1))
</script>

<template>
  <div class="timeline">
    <div class="track">
      <button v-for="(p, i) in phases" :key="i" class="seg" :class="{ sel: i === selected }"
        :style="{ flexGrow: p.durationMs }" :title="`${p.name} · ${fmtMinutes(p.durationMs)}`" @click="$emit('select', i)">
        <span>{{ i + 1 }}</span>
      </button>
      <i v-if="marker >= 0" class="marker" :style="{ left: marker + '%' }"></i>
    </div>
  </div>
</template>

<style scoped>
.track { position: relative; display: flex; gap: 3px; height: 30px; }
.seg { flex-basis: 0; min-width: 22px; border: 1px solid var(--line); background: var(--surface-2); border-radius: 6px; color: var(--muted); font: 600 12px var(--font-body); cursor: pointer; padding: 0; }
.seg.sel { background: var(--accent-soft); border-color: var(--accent); color: var(--text); }
.marker { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--text); border-radius: 2px; transition: left .5s linear; }
</style>
