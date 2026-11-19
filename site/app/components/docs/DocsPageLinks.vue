<script setup lang="ts">
// "Copy page" and what goes with it, as in Nuxt UI's Docs template: the page
// as Markdown, to paste into notes or to hand to an assistant.
const props = defineProps<{ slug: string }>()

const toast = useToast()
const config = useRuntimeConfig()
const raw = computed(() => `/raw/docs/${props.slug}.md`)
// The site's own address where the build knows it, else the address in the bar.
const absolute = () => `${String(config.public.siteUrl || location.origin).replace(/\/$/, '')}${raw.value}`
const copied = ref(false)

async function put(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    toast.add({ title: 'The browser did not allow copying', icon: 'i-lucide-circle-alert' })
    return false
  }
}
async function copyPage() {
  if (await put(await $fetch<string>(raw.value, { responseType: 'text' }))) {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }
}
const ask = (base: string) => window.open(`${base}${encodeURIComponent(`Read ${absolute()} so I can ask questions about it.`)}`, '_blank', 'noopener')

const items = [
  { label: 'Copy Markdown link', icon: 'i-lucide-link', onSelect: async () => { if (await put(absolute())) toast.add({ title: 'Copied to clipboard', icon: 'i-lucide-circle-check' }) } },
  { label: 'View as Markdown', icon: 'i-lucide-file-text', onSelect: () => window.open(raw.value, '_blank', 'noopener') },
  { label: 'Open in ChatGPT', icon: 'i-lucide-message-circle', onSelect: () => ask('https://chatgpt.com/?hints=search&q=') },
  { label: 'Open in Claude', icon: 'i-lucide-sparkles', onSelect: () => ask('https://claude.ai/new?q=') },
]
</script>

<template>
  <UFieldGroup data-test="page-links">
    <UButton label="Copy page" :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'" color="neutral" variant="outline" size="sm" :ui="{ leadingIcon: [copied && 'text-primary', 'size-3.5'] }" @click="copyPage" />
    <UDropdownMenu :items="items" :content="{ align: 'end', side: 'bottom', sideOffset: 8 }" :ui="{ content: 'w-52' }">
      <UButton icon="i-lucide-chevron-down" size="sm" color="neutral" variant="outline" aria-label="More ways to take this page with you" />
    </UDropdownMenu>
  </UFieldGroup>
</template>
