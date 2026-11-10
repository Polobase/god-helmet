<script setup lang="ts">
// A panel that folds: its title, and a line that says what is inside.
defineProps<{ title: string, hint?: string, count?: number }>()
const open = defineModel<boolean>('open', { default: false })

const root = ref<HTMLElement>()
/** Open the fold and bring it to the top of the window. */
async function show() {
  if (!open.value) {
    open.value = true
    // It grows open over 200 ms, and the page cannot scroll this far before it has.
    await Promise.race([
      new Promise((done) => root.value?.addEventListener('animationend', done, { once: true })),
      new Promise((done) => setTimeout(done, 400)),
    ])
  }
  root.value?.scrollIntoView({ behavior: smooth(), block: 'start' })
}
defineExpose({ show })
</script>

<template>
  <div ref="root" class="panel scroll-mt-14">
    <UCollapsible v-model:open="open">
      <button type="button" class="group flex w-full cursor-pointer items-start gap-3 rounded-[inherit] px-5 py-4 text-left sm:px-7">
        <UIcon name="i-lucide-chevron-right" class="mt-1 size-5 shrink-0 text-muted transition-transform group-hover:text-highlighted group-data-[state=open]:rotate-90" aria-hidden="true" />
        <span class="grid min-w-0 gap-0.5">
          <span class="font-display text-xl font-[620] text-highlighted">{{ title }} <span v-if="count != null" class="num font-sans text-sm font-normal tracking-normal text-muted">{{ count }}</span></span>
          <span v-if="hint" class="text-sm text-muted">{{ hint }}</span>
        </span>
      </button>
      <template #content>
        <div class="grid gap-3 px-5 pb-5 sm:px-7 sm:pb-6">
          <slot />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
