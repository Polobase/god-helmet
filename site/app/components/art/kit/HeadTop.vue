<script setup lang="ts">
// A head seen from above, nose up, with the eight coils around it.
import { ringPoint } from '~/lib/art'

const props = withDefaults(defineProps<{ x?: number, y?: number, r?: number, coils?: boolean }>(), { x: 0, y: 0, r: 16, coils: true })
const nose = computed(() => `M ${-0.2 * props.r} ${-0.98 * props.r} Q 0 ${-1.38 * props.r} ${0.2 * props.r} ${-0.98 * props.r}`)
const dots = computed(() => Array.from({ length: 8 }, (_, i) => ringPoint(i, props.r)).map(([px, py]) => `M ${px} ${py} h 0.01`).join(' '))
</script>

<template>
  <g :transform="`translate(${x} ${y})`">
    <circle :r="r" />
    <path :d="nose" />
    <path v-if="coils" class="art-pt" :d="dots" />
  </g>
</template>
