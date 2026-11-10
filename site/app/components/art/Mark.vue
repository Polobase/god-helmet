<script lang="ts">
// Every file in marks/ is one drawing, named by its file: marks/sleep.vue is "sleep".
import type { Component } from 'vue'
import type { MarkId } from '~/lib/art'

const files = import.meta.glob<Component>('./marks/*.vue', { eager: true, import: 'default' })
const drawings = Object.fromEntries(Object.entries(files).map(([path, c]) => [path.replace(/^.*\/|\.vue$/g, ''), c])) as Record<MarkId, Component>
</script>

<script setup lang="ts">
// A small drawing that says "this kind of thing": <ArtMark name="sleep" class="w-10" />.
// Square, in the same style as the scenes. It stands still unless `animate` is set.
defineProps<{ name: MarkId, label?: string, animate?: boolean }>()
</script>

<template>
  <ArtFrame view-box="0 0 48 48" :label="label" :still="!animate" :data-mark="name" class="art-mark">
    <component :is="drawings[name]" />
  </ArtFrame>
</template>
