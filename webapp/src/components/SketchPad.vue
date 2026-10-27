<script setup>
// Finger/mouse sketch pad for remote-viewing impressions.
import { onMounted, ref } from 'vue'

// `label`: text above the pad ('' hides it; the Clear button stays).
const props = defineProps({ initial: { type: String, default: '' }, disabled: { type: Boolean, default: false }, label: { type: String, default: 'Sketch' } })
const emit = defineEmits(['change'])
const canvas = ref(null)
const blank = ref(true)
let drawing = false

function clear(silent = false) {
  const ctx = canvas.value.getContext('2d')
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  blank.value = true
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
  blank.value = false
  emit('change', canvas.value.toDataURL('image/png'))
}

onMounted(() => {
  clear(true)
  if (props.initial) {
    blank.value = false
    const img = new Image()
    img.onload = () => canvas.value.getContext('2d').drawImage(img, 0, 0)
    img.src = props.initial
  }
})
defineExpose({ clear })
</script>

<template>
  <div class="sketch-pad">
    <div class="row head">
      <span class="small muted">{{ label }}</span>
      <!-- clear() with parentheses: the click event must not become the `silent` flag -->
      <button class="btn ghost sm" type="button" :disabled="disabled || blank" @click="clear()">Clear sketch</button>
    </div>
    <div class="frame">
      <canvas ref="canvas" width="480" height="360" class="pad" :class="{ disabled }" role="img" aria-label="Sketch pad"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"></canvas>
    </div>
  </div>
</template>

<style scoped>
.sketch-pad { display: grid; gap: 6px; max-width: 480px; }
.head { justify-content: space-between; }
.frame { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
/* The stored sketch stays light; dark themes only show it inverted so it does not glare. */
.pad { width: 100%; aspect-ratio: 4 / 3; touch-action: none; display: block; filter: invert(.9); }
.pad.disabled { opacity: .8; }
:root[data-theme="night"] .pad { filter: invert(1) sepia(1) saturate(6) hue-rotate(-55deg) brightness(.6); }
:root[data-theme="light"] .pad { filter: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme]) .pad { filter: none; } }
</style>
