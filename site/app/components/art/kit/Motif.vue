<script setup lang="ts">
// What a picture shows. `rough` is the same thing as someone sketched it.
type Kind = 'mountain' | 'star' | 'triangle' | 'circle' | 'waves'
withDefaults(defineProps<{ kind?: Kind, x?: number, y?: number, s?: number, rough?: boolean }>(), { kind: 'mountain', x: 0, y: 0, s: 1 })

const SHAPES: Record<Kind, string> = {
  mountain: 'M -8 5 L -3 -1.6 L -0.4 1.6 L 3.6 -4.6 L 8 5 M -3.9 -4.9 a 1.7 1.7 0 1 0 -3.4 0 a 1.7 1.7 0 1 0 3.4 0',
  star: 'M 0 -6.4 L 1.75 -2.4 L 6.1 -2 L 2.8 0.9 L 3.8 5.2 L 0 2.9 L -3.8 5.2 L -2.8 0.9 L -6.1 -2 L -1.75 -2.4 Z',
  triangle: 'M 0 -6 L 6.4 5 H -6.4 Z',
  circle: 'M 5.6 0 a 5.6 5.6 0 1 0 -11.2 0 a 5.6 5.6 0 1 0 11.2 0',
  waves: 'M -6 -4.5 q 2 -2.6 4 0 t 4 0 t 4 0 M -6 0 q 2 -2.6 4 0 t 4 0 t 4 0 M -6 4.5 q 2 -2.6 4 0 t 4 0 t 4 0',
}
const ROUGH: Partial<Record<Kind, string>> = {
  mountain: 'M -8.4 4.6 Q -5.6 0.4 -3.4 -1.2 Q -1.4 1.4 0.2 1 Q 2.2 -2.8 4.2 -4 Q 6.6 0.2 8.2 5.2 M -4.2 -5.4 a 1.8 1.6 0 1 0 -3.2 1.2',
  star: 'M 0.3 -6.2 L 1.9 -2.2 L 6.2 -2.3 L 2.6 1.1 L 3.5 5.4 L -0.2 2.7 L -4 5 L -2.7 0.6 L -6.2 -1.8 L -1.6 -2.6 Z',
}
</script>

<template>
  <path :transform="`translate(${x} ${y}) scale(${s})`" :d="(rough && ROUGH[kind]) || SHAPES[kind]" />
</template>
