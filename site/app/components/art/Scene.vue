<script lang="ts">
// Every file in scenes/ is one drawing, named by its file: scenes/obe.vue is "obe".
import type { Component } from 'vue'
import type { SceneId } from '~/lib/art'

const files = import.meta.glob<Component>('./scenes/*.vue', { eager: true, import: 'default' })
const drawings = Object.fromEntries(Object.entries(files).map(([path, c]) => [path.replace(/^.*\/|\.vue$/g, ''), c])) as Record<SceneId, Component>
</script>

<script setup lang="ts">
// A large drawing that explains one effect: <ArtScene name="obe" />.
// It fills the width of its box (3:2); size it with a class. Give it a `label`
// where it carries meaning; without one it is decoration.
defineProps<{ name: SceneId, label?: string, still?: boolean }>()
</script>

<template>
  <ArtFrame view-box="0 0 240 160" :label="label" :still="still" :data-scene="name">
    <component :is="drawings[name]" />
  </ArtFrame>
</template>
