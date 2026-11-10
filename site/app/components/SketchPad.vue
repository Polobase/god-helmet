<script setup lang="ts">
// Finger/mouse sketch pad for remote-viewing impressions.
// `label`: text above the pad ('' hides it; the Clear button stays).
const props = withDefaults(defineProps<{ initial?: string, disabled?: boolean, label?: string }>(), { initial: '', disabled: false, label: 'Sketch' })
const emit = defineEmits<{ change: [dataUrl: string] }>()
const canvas = ref<HTMLCanvasElement>()
const blank = ref(true)
let drawing = false

const ctx = () => canvas.value!.getContext('2d')!

function clear(silent = false) {
  const c = ctx()
  c.fillStyle = '#f4f1ea'
  c.fillRect(0, 0, canvas.value!.width, canvas.value!.height)
  blank.value = true
  if (!silent) emit('change', '')
}

function point(e: PointerEvent): [number, number] {
  const r = canvas.value!.getBoundingClientRect()
  return [((e.clientX - r.left) * canvas.value!.width) / r.width, ((e.clientY - r.top) * canvas.value!.height) / r.height]
}

function down(e: PointerEvent) {
  if (props.disabled) return
  drawing = true
  canvas.value!.setPointerCapture(e.pointerId)
  const c = ctx()
  c.beginPath()
  c.moveTo(...point(e))
}
function move(e: PointerEvent) {
  if (!drawing) return
  const c = ctx()
  c.lineTo(...point(e))
  c.strokeStyle = '#1b1b1f'
  c.lineWidth = 3
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.stroke()
}
function up() {
  if (!drawing) return
  drawing = false
  blank.value = false
  emit('change', canvas.value!.toDataURL('image/png'))
}

onMounted(() => {
  clear(true)
  if (props.initial) {
    blank.value = false
    const img = new Image()
    img.onload = () => ctx().drawImage(img, 0, 0)
    img.src = props.initial
  }
})
defineExpose({ clear })
</script>

<template>
  <div class="grid max-w-[30rem] gap-1.5">
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm text-muted">{{ label }}</span>
      <!-- clear() with parentheses: the click event must not become the `silent` flag -->
      <UButton size="xs" variant="ghost" :disabled="disabled || blank" @click="clear()">Clear sketch</UButton>
    </div>
    <div class="overflow-hidden rounded-lg border border-default">
      <canvas ref="canvas" width="480" height="360" class="pad" :class="{ 'opacity-80': disabled }" role="img" aria-label="Sketch pad"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" />
    </div>
  </div>
</template>

<style scoped>
/* The stored sketch stays light; dark themes only show it inverted so it does not glare. */
.pad { width: 100%; aspect-ratio: 4 / 3; touch-action: none; display: block; }
:root.dark .pad { filter: invert(.9); }
:root.night .pad { filter: invert(1) sepia(1) saturate(6) hue-rotate(-55deg) brightness(.6); }
</style>
