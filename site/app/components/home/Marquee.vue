<script setup lang="ts">
// Program names drifting past, in two rows. Decoration: the names are also
// in the library, so this is hidden from screen readers.
const props = defineProps<{ names: string[] }>()
const rows = computed(() => {
  const half = Math.ceil(props.names.length / 2)
  // A row is long; forty names each is plenty to fill any screen twice.
  return [props.names.slice(0, half).slice(0, 40), props.names.slice(half).slice(0, 40)]
})
</script>

<template>
  <div class="marquee" aria-hidden="true">
    <div v-for="(row, r) in rows" :key="r" class="row" :class="{ back: r === 1 }">
      <div v-for="copy in 2" :key="copy" class="lane">
        <span v-for="n in row" :key="n" class="name">{{ n }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marquee { display: grid; gap: 0.75rem; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.row { display: flex; width: max-content; }
.lane { display: flex; gap: 0.75rem; padding-right: 0.75rem; flex: none; }
.name { white-space: nowrap; padding: 0.45rem 1rem; border-radius: 99px; border: 1px solid var(--hairline); color: var(--ui-text-toned); font-size: 0.9rem; background: color-mix(in oklab, var(--panel-top) 60%, transparent); }
@media (prefers-reduced-motion: no-preference) {
  .lane { animation: drift 150s linear infinite; }
  .back .lane { animation-direction: reverse; animation-duration: 170s; }
  .marquee:hover .lane { animation-play-state: paused; }
}
@keyframes drift { to { transform: translateX(-100%); } }
</style>
