<script setup>
// The running session, on every tab: what runs, the time left and Stop. The
// name opens the live panel (coil activity, intensity, Skip).
import { computed } from 'vue'
import { device, call } from '../ble/device.js'
import { fmtDuration } from '../lib/format.js'

defineProps({ open: { type: Boolean, default: false } })
defineEmits(['toggle'])
const st = computed(() => device.status)
const running = computed(() => !!st.value && st.value.state !== 'idle')
</script>

<template>
  <div v-if="running" class="pill" :class="{ stopping: st.state === 'stopping' }">
    <button type="button" class="pill-main" :aria-expanded="open" :title="open ? 'Hide the live panel' : 'Show the live panel'" @click="$emit('toggle')">
      <span class="dot" aria-hidden="true"></span>
      <span class="name">{{ st.test ? `Test: ${st.sessionName}` : st.sessionName }}</span>
      <span class="left num">{{ st.state === 'stopping' ? 'stopping' : fmtDuration(st.totalMs - st.programMs) }}</span>
    </button>
    <button type="button" class="btn danger sm stop" :disabled="st.state === 'stopping'" @click="call('session.stop')">Stop</button>
  </div>
</template>

<style scoped>
.pill { display: flex; align-items: center; gap: 4px; min-width: 0; padding: 3px 3px 3px 4px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--line)); background: var(--accent-soft); }
.pill-main { display: flex; align-items: center; gap: 8px; min-width: 0; background: none; border: 0; color: var(--text); cursor: pointer; padding: 3px 6px; border-radius: 99px; font: inherit; font-size: 13px; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--glow); animation: beat 1.6s ease-in-out infinite; }
.stopping .dot { animation: none; background: var(--muted); box-shadow: none; }
@keyframes beat { 50% { box-shadow: 0 0 0 6px transparent; } }
.name { min-width: 0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.left { font-size: 15px; color: var(--muted); }
.stop { border-radius: 99px; padding: 4px 12px; }
</style>
