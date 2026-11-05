<script setup>
// Programs tab: the library (#programs) and one program (#programs/<id>[/<sub>]).
import { computed, nextTick, watch } from 'vue'
import { nav } from '../lib/nav.js'
import { presetById } from '../lib/presets.js'
import { library, selectProgram } from '../lib/programState.js'
import ProgramLibrary from '../components/programs/ProgramLibrary.vue'
import ProgramWorkspace from '../components/programs/ProgramWorkspace.vue'

const opened = computed(() => (nav.arg ? presetById(nav.arg) ?? null : null))
watch(opened, (p) => p && selectProgram(p.doc.id), { immediate: true })

// Open a program at its top, and come back to the same place in the library.
// scrollY is read here (pre-flush), before the library is swapped out.
watch(() => nav.arg, (arg, prev) => {
  if (nav.tab !== 'programs') return
  if (!prev) library.y = window.scrollY
  nextTick(() => window.scrollTo({ top: arg ? 0 : library.y }))
})
</script>

<template>
  <ProgramWorkspace v-if="opened" />
  <ProgramLibrary v-else :missing="nav.arg" />
</template>
