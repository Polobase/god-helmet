<script setup lang="ts">
// A number that counts up to its value the first time it is seen. The page
// is delivered with the final value in it; the counting is only a flourish.
const props = defineProps<{ value: number }>()
const el = ref<HTMLElement>()
const shown = ref(props.value)
onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !el.value) return
  if (el.value.getBoundingClientRect().top < innerHeight) return
  shown.value = 0
  const io = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return
    io.disconnect()
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400)
      shown.value = Math.round(props.value * (1 - (1 - p) ** 4))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, { threshold: 0.6 })
  io.observe(el.value)
  onBeforeUnmount(() => io.disconnect())
})
</script>

<template>
  <span ref="el" class="num"><span aria-hidden="true">{{ shown }}</span><span class="sr-only">{{ value }}</span></span>
</template>
