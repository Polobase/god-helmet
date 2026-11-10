<script setup lang="ts">
// Past guide runs on this phone: open, reveal later, delete, export as JSON.
import { downloadBlob, fmtDuration } from '#core/lib/format.js'
import { errorMessage } from '~/lib/device'
import { guideById, deleteRun, exportBlob, pendingArv, EXPORT_FILENAME, type RunRecord } from '~/lib/guides'

const props = withDefaults(defineProps<{ runs?: RunRecord[], title?: string }>(), { runs: () => [], title: 'Past runs' })
const emit = defineEmits<{ changed: [] }>()

const open = ref('')
const error = ref('')

const guideOf = (run: RunRecord) => guideById(run.guideId)?.doc ?? null
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '–')
const length = (r: RunRecord) => (r.endedAt ? fmtDuration(new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) : '–')
const hidden = (r: RunRecord) => (r.audio?.blind && !r.reveal?.audio) || (r.helmet?.blind && r.helmet?.logId && !r.reveal?.helmet)

const confirm = useConfirm()
async function remove(r: RunRecord) {
  error.value = ''
  const ok = await confirm({
    title: 'Delete this run from this phone?',
    description: `${r.guideName || r.guideId}, ${when(r.startedAt)}. It is stored on this phone only: export it first to keep a copy.`,
    confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true,
  })
  if (!ok) return
  try {
    await deleteRun(r.id)
    if (open.value === r.id) open.value = ''
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e)
  }
}
// Blind runs not revealed yet are exported without their sham flag (lib/runs.js).
const exportAll = () => downloadBlob(exportBlob(props.runs), EXPORT_FILENAME)
</script>

<template>
  <section class="panel grid gap-4 p-5 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-2xl">{{ title }}</h2>
      <UButton v-if="runs.length" size="sm" icon="i-lucide-download" @click="exportAll">Export JSON</UButton>
    </div>
    <p v-if="!runs.length" class="text-sm text-muted">No runs yet. Every run is stored on this phone only; export it to keep a copy.</p>
    <ul v-else class="grid gap-1.5">
      <li v-for="r in runs" :key="r.id" class="rounded-lg border border-default" :class="{ 'border-accented': open === r.id }">
        <button type="button" class="run" :aria-expanded="open === r.id" @click="open = open === r.id ? '' : r.id">
          <span class="min-w-0 font-semibold text-highlighted">{{ r.guideName || r.guideId }}</span>
          <span class="num col-start-1 text-sm text-muted">{{ when(r.startedAt) }}, {{ length(r) }}</span>
          <span class="col-start-2 row-span-2 row-start-1 flex flex-wrap items-center justify-end gap-1">
            <UBadge :color="r.completed ? 'primary' : 'neutral'" :variant="r.completed ? 'subtle' : 'outline'">{{ r.completed ? 'done' : r.stopped ? 'stopped' : 'unfinished' }}</UBadge>
            <UBadge v-if="hidden(r)" color="info" variant="subtle">reveal pending</UBadge>
            <UBadge v-if="pendingArv(r, guideOf(r)).length" color="info" variant="subtle">outcome pending</UBadge>
            <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform" :class="{ 'rotate-180': open === r.id }" aria-hidden="true" />
          </span>
        </button>
        <div v-if="open === r.id" class="grid gap-4 border-t border-default p-4">
          <GuideRunSummary :record="r" :guide="guideOf(r)" @saved="emit('changed')" />
          <div><UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(r)">Delete run</UButton></div>
        </div>
      </li>
    </ul>
    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.run { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.1rem 0.75rem; text-align: left; padding: 0.65rem 0.85rem; cursor: pointer; border-radius: inherit; }
.run:hover { background: color-mix(in oklab, var(--surface-2) 50%, transparent); }
</style>
