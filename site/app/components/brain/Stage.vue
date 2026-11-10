<script setup lang="ts">
// The stage the 3D brain stands on. The scene's shader is tuned for a dark
// backdrop (white contour lines, bright rims), so the stage keeps the dark
// theme's colours in every theme; night mode keeps its own red on black.
// It is there before the scene is: three.js and the meshes load on demand,
// and `wait` says what is happening meanwhile, or why nothing can be drawn.
defineProps<{
  /** Shown in place of the scene: still loading, or the reason it failed. */
  wait?: string
  failed?: boolean
  /** The technical reason of a failure, for whoever looks closer. */
  reason?: string
}>()
</script>

<template>
  <div class="stage">
    <p v-if="wait" class="wait" :role="failed ? 'alert' : 'status'" :title="failed ? reason : undefined">
      <UIcon :name="failed ? 'i-lucide-triangle-alert' : 'i-lucide-loader-circle'" class="size-5 shrink-0" :class="{ 'animate-spin': !failed }" aria-hidden="true" />
      <span>{{ wait }}</span>
    </p>
    <slot />
  </div>
</template>

<style scoped>
/* --s-*: the scene's own colours, read by <BrainScene> and its labels. */
.stage {
  --s-text: var(--ui-color-neutral-100); --s-muted: var(--ui-color-neutral-400); --s-line: var(--ui-color-neutral-700);
  --s-surface: var(--ui-color-neutral-900); --s-surface-2: var(--ui-color-neutral-800); --s-bg: var(--ui-color-neutral-950);
  position: relative; width: 100%; height: 100%; min-width: 0; overflow: hidden; border-radius: calc(var(--ui-radius) * 2); color-scheme: dark;
  background: radial-gradient(ellipse at 50% 40%, var(--s-surface-2), var(--s-bg));
}
.night .stage { --s-text: var(--text); --s-muted: var(--muted); --s-line: var(--line); --s-surface: var(--surface); --s-surface-2: var(--surface-2); --s-bg: var(--bg); }
.wait { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 1.25rem; margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--s-muted); }
.wait span { max-width: 34ch; }
</style>
