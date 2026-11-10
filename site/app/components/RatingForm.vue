<script setup lang="ts">
// Rating of a finished session (0-10) with notes; saving it reveals real or
// sham for a blind session. Used after a session and in the Log.
withDefaults(defineProps<{ cancelLabel?: string, error?: string }>(), { cancelLabel: 'Cancel', error: '' })
const rating = defineModel<number>('rating', { default: 5 })
const notes = defineModel<string>('notes', { default: '' })
defineEmits<{ save: [], cancel: [] }>()
const id = useId()
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <label :for="`${id}-r`" class="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span>0 = nothing … 10 = profound</span>
        <b class="num font-display text-xl font-[620] text-highlighted">{{ rating }}</b>
      </label>
      <USlider :id="`${id}-r`" v-model="rating" :min="0" :max="10" :step="1" aria-label="Rating, 0 to 10" />
    </div>
    <UFormField label="What you noticed, and when">
      <UTextarea v-model="notes" :rows="4" class="w-full" />
    </UFormField>
    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    <div class="flex flex-wrap gap-2">
      <UButton color="primary" variant="solid" size="sm" @click="$emit('save')">Save rating</UButton>
      <UButton variant="ghost" size="sm" @click="$emit('cancel')">{{ cancelLabel }}</UButton>
    </div>
  </div>
</template>
