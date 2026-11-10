<script setup lang="ts">
// "Are you sure?" for things that cannot be undone: opened by useConfirm().
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** The confirm button is the destructive one (delete, abort). */
  danger?: boolean
}>(), { description: '', confirmLabel: 'OK', cancelLabel: 'Cancel', danger: false })
const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal :title="title" :description="description || undefined" :close="false" :dismissible="true" :ui="{ content: 'sm:max-w-md', footer: 'justify-end' }" @update:open="(o: boolean) => !o && emit('close', false)">
    <template #footer>
      <UButton variant="ghost" @click="emit('close', false)">{{ cancelLabel }}</UButton>
      <UButton :color="danger ? 'error' : 'primary'" variant="solid" autofocus @click="emit('close', true)">{{ confirmLabel }}</UButton>
    </template>
  </UModal>
</template>
