<script setup lang="ts">
// A statement that lights up word by word as it is scrolled through. The
// text is complete and readable without the effect.
const props = defineProps<{ text: string }>()
const words = computed(() => props.text.split(/\s+/))
const el = ref<HTMLElement>()
const lit = ref(Infinity) // words lit; all of them until the effect starts

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !el.value) return
  let queued = false
  const update = () => {
    queued = false
    const r = el.value!.getBoundingClientRect()
    // From entering the lower fifth of the screen to reaching its middle.
    const p = (innerHeight * 0.85 - r.top) / (innerHeight * 0.5 + r.height * 0.6)
    lit.value = Math.round(Math.min(1, Math.max(0, p)) * words.value.length)
  }
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }
  update()
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onScroll, { passive: true })
  onBeforeUnmount(() => {
    removeEventListener('scroll', onScroll)
    removeEventListener('resize', onScroll)
  })
})
</script>

<template>
  <p ref="el" class="scrub">
    <template v-for="(w, i) in words" :key="i"><span :class="{ dim: i >= lit }">{{ w }}</span>{{ ' ' }}</template>
  </p>
</template>

<style scoped>
.scrub span { transition: opacity 0.5s, color 0.5s; }
.scrub .dim { opacity: 0.2; }
</style>
