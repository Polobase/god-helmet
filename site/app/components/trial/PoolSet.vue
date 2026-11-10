<script setup lang="ts">
// One set of the picture pool. Its pictures stay hidden until someone asks for
// them: whoever will be the viewer must not see them.
import type { PictureSet, PoolImage } from '~/lib/trials'

const props = defineProps<{
  set: PictureSet
  /** Pictures are being added somewhere. */
  busy: boolean
  /** What happened when pictures were added from this row. */
  message?: { text: string, ok: boolean } | null
}>()
const emit = defineEmits<{ add: [], remove: [] }>()

const count = computed(() => props.set.images.length)
const shown = ref(false)
const thumbsId = useId()

// One object URL per picture, by its hash; released when the pictures are hidden again.
const urls = new Map<string, string>()
function thumb(img: PoolImage) {
  if (!urls.has(img.hash)) urls.set(img.hash, URL.createObjectURL(img.blob))
  return urls.get(img.hash)!
}
function release() {
  urls.forEach((u) => URL.revokeObjectURL(u))
  urls.clear()
}
watch(shown, (s) => !s && release(), { flush: 'post' })
onBeforeUnmount(release)
</script>

<template>
  <div class="grid grid-cols-1 gap-2.5 border-t border-default pt-4" :data-set="set.id">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <b class="wrap-anywhere text-highlighted">{{ set.id }}</b>
      <span class="num text-sm" :class="count >= 2 ? 'text-muted' : 'text-warning'">{{ count }} picture(s){{ count < 2 ? ', needs at least 2' : '' }}</span>
    </div>
    <div v-if="shown" :id="thumbsId" class="thumbs">
      <img v-for="img in set.images" :key="img.hash" :src="thumb(img)" alt="">
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <UButton variant="ghost" size="sm" :aria-expanded="shown" :aria-controls="shown ? thumbsId : undefined" @click="shown = !shown">{{ shown ? 'Hide pictures' : 'Show pictures' }}</UButton>
      <UButton variant="ghost" size="sm" :disabled="busy || count >= 8" @click="emit('add')">Add pictures</UButton>
      <UButton color="error" variant="ghost" size="sm" class="ml-auto" @click="emit('remove')">Delete set</UButton>
    </div>
    <p v-if="message?.text" class="text-sm" :class="message.ok ? 'text-success' : 'text-error'" role="status">{{ message.text }}</p>
  </div>
</template>

<style scoped>
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.6rem, 1fr)); gap: 0.4rem; }
.thumbs img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--ui-radius); }
</style>
