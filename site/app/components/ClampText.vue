<script setup>
// Text cut to a few lines, with "more" only when something is cut off.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  lines: { type: Number, default: 2 },
})
const el = ref(null)
const open = ref(false)
const cut = ref(false)
function measure() {
  if (el.value && !open.value) cut.value = el.value.scrollHeight > el.value.clientHeight + 1
}
let ro = null
onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(el.value)
  measure()
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => props.text, () => {
  open.value = false
  nextTick(measure)
})
</script>

<template>
  <span class="clamp-text">
    <span ref="el" :class="{ clamped: !open }" :style="{ '-webkit-line-clamp': lines, 'line-clamp': lines }">{{ text }}</span>
    <button v-if="cut || open" type="button" class="text-primary underline underline-offset-2 cursor-pointer" :aria-expanded="open" @click="open = !open">{{ open ? 'less' : 'more' }}</button>
  </span>
</template>

<style scoped>
.clamped { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
</style>
