<script setup>
// Rating of a finished session (0-10) with notes; saving it reveals real or
// sham for a blind session. Used after a session and in the Log.
defineProps({
  cancelLabel: { type: String, default: 'Cancel' },
  error: { type: String, default: '' },
})
const rating = defineModel('rating', { type: Number, default: 5 })
const notes = defineModel('notes', { type: String, default: '' })
defineEmits(['save', 'cancel'])
</script>

<template>
  <div class="rating-form">
    <label class="field">0 = nothing … 10 = profound: <b class="num">{{ rating }}</b>
      <input v-model.number="rating" type="range" min="0" max="10" step="1" />
    </label>
    <label class="field">What you noticed, and when<textarea v-model="notes"></textarea></label>
    <p v-if="error" class="small bad" role="alert">{{ error }}</p>
    <div class="row">
      <button type="button" class="btn primary sm" @click="$emit('save')">Save rating</button>
      <button type="button" class="btn ghost sm" @click="$emit('cancel')">{{ cancelLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.rating-form { display: grid; gap: 10px; }
</style>
