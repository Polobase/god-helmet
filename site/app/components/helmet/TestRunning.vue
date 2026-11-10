<script setup lang="ts">
// A test that runs now: its name, the time left and Stop. The slot says what
// to do meanwhile.
import { fmtDuration } from '#core/lib/format.js'
import { runningTest, useHelmetActions } from '~/lib/helmet'

/** The test's session id: 'test-dc', 'test-rotate' or 'test-dc-all'. */
const props = defineProps<{ sessionId: string }>()
const test = computed(() => {
  const t = runningTest()
  return t?.sessionId === props.sessionId ? t : null
})
const { stopTest } = useHelmetActions()
</script>

<template>
  <p v-if="test" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-primary/45 bg-primary/8 px-3.5 py-2.5 text-sm">
    <span class="min-w-0"><b class="text-highlighted">{{ test.sessionName }}</b>, <span class="num">{{ fmtDuration(test.totalMs - test.programMs) }}</span> left. <slot /></span>
    <UButton color="error" variant="solid" size="sm" :disabled="test.state === 'stopping'" @click="stopTest">Stop test</UButton>
  </p>
</template>
