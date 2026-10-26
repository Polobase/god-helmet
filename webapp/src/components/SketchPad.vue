<script setup>
// Finger/mouse sketch pad for remote-viewing impressions.
import { onMounted, ref } from 'vue'

const props = defineProps({ initial: { type: String, default: '' }, disabled: { type: Boolean, default: false } })
const emit = defineEmits(['change'])
const canvas = ref(null)
let drawing = false

function clear(silent = false) {
  const ctx = canvas.value.getContext('2d')
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  if (!silent) emit('change', '')
}

function point(e) {
  const r = canvas.value.getBoundingClientRect()
  return [((e.clientX - r.left) * canvas.value.width) / r.width, ((e.clientY - r.top) * canvas.value.height) / r.height]
}

function down(e) {
  if (props.disabled) return
  drawing = true
  canvas.value.setPointerCapture(e.pointerId)
  const ctx = canvas.value.getContext('2d')
  ctx.beginPath()
  ctx.moveTo(...point(e))
}
function move(e) {
  if (!drawing) return
  const ctx = canvas.value.getContext('2d')
  ctx.lineTo(...point(e))
  ctx.strokeStyle = '#1b1b1f'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}
function up() {
  if (!drawing) return
  drawing = false
  emit('change', canvas.value.toDataURL('image/png'))
}

onMounted(() => {
  clear(true)
  if (props.initial) {
    const img = new Image()
    img.onload = () => canvas.value.getContext('2d').drawImage(img, 0, 0)
    img.src = props.initial
  }
})
defineExpose({ clear })
</script>

<template>
  <canvas ref="canvas" width="480" height="360" class="pad" :class="{ disabled }"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"></canvas>
</template>

<style scoped>
.pad { width: 100%; max-width: 480px; aspect-ratio: 4 / 3; border-radius: 8px; touch-action: none; display: block; border: 1px solid var(--line); }
.pad.disabled { opacity: .8; }
</style>
