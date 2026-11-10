<script setup lang="ts">
// Session log: what the helmet has stored, newest first. A session is rated
// here (for a blind one, that reveals real or sham); older pages load on
// request; Export saves everything as JSON.
import { fmtDate, downloadBlob } from '#core/lib/format.js'
import { fmtSetting, unitLabel } from '#core/lib/units.js'
import { device, call, errorMessage } from '~/lib/device'
import { LOG_PAGE, useHelmetActions, type LogEntry, type LogPage } from '~/lib/helmet'
import { ratingDone } from '~/lib/rating'

useHead({ title: 'Session log' })
const { flash } = useHelmetActions()

const items = ref<LogEntry[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
/** Open rating forms, by log id. */
const rating = reactive(new Map<number, { value: number, notes: string, err: string }>())

const { online, lost } = useHelmetLink()
async function load(more = false) {
  if (!online.value) return
  loading.value = true
  error.value = ''
  try {
    const page = await call<LogPage>('log.list', { offset: more ? items.value.length : 0, limit: LOG_PAGE })
    items.value = more ? [...items.value, ...page.items] : page.items
    total.value = page.total
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
// The helmet is (back) on: read its log anew. What happened meanwhile is in it
// (a session that ended, or was cut off by a restart). A lost link keeps the list on screen.
watch(online, (on) => on && load())

// When a session ends, refresh the newest page and merge it in by id, so its
// row shows the result while older pages, an open rating form and an export
// in progress stay as they are.
const exporting = ref(false)
async function refreshTop() {
  if (!online.value || exporting.value) return
  try {
    const page = await call<LogPage>('log.list', { offset: 0, limit: LOG_PAGE })
    const fresh = new Set(page.items.map((x) => x.id))
    items.value = [...page.items, ...items.value.filter((x) => !fresh.has(x.id))].sort((a, b) => b.id - a.id)
    total.value = page.total
  } catch (e) {
    error.value = errorMessage(e)
  }
}
watch(() => device.status?.state, (st, prev) => {
  if (st === 'idle' && prev && prev !== 'idle') refreshTop()
})

// Rating reveals real or sham, so the running session cannot be rated yet. An
// unfinished entry while the helmet is idle was cut off (e.g. power loss) and can.
const live = (e: LogEntry) => !e.finished && device.status?.state !== 'idle'
// The lock of a blind session is an icon, which screen readers skip: the word "blind" goes next to it, hidden from sight.
const minutes = (e: LogEntry) => Math.round(e.elapsedMs / 60000)
const kp = (e: LogEntry) => (e.kpValid ? e.kp.toFixed(1) : '–')
const openRating = (e: LogEntry) => rating.set(e.id, { value: 5, notes: '', err: '' })
const closeRating = (e: LogEntry) => rating.delete(e.id)

async function rate(e: LogEntry) {
  const r = rating.get(e.id)
  if (!r) return
  r.err = ''
  try {
    const updated = await call<LogEntry>('log.rate', { id: e.id, rating: Number(r.value), notes: r.notes })
    items.value = items.value.map((x) => (x.id === e.id ? updated : x))
    rating.delete(e.id)
    ratingDone(e.id) // the prompt on the Programs tab has nothing left to ask
    // One message at a time: a reveal must not sit under the "saved" of the session before.
    if (updated.blind) flash(`This blind session was ${updated.condition}.`, false, { long: true, icon: 'i-lucide-lock-open' })
    else flash('Rating saved.')
  } catch (err) {
    r.err = errorMessage(err)
  }
}

async function exportAll() {
  exporting.value = true
  try {
    while (items.value.length < total.value) {
      const had = items.value.length
      await load(true)
      // A page that fails or brings nothing (e.g. the helmet was disconnected):
      // stop, rather than ask for ever or save half a log as if it were all of it.
      if (error.value || items.value.length === had) {
        error.value = `Only ${items.value.length} of ${total.value} sessions are loaded and the rest could not be fetched${error.value ? ` (${error.value})` : ''}, so nothing was exported.`
        return
      }
    }
  } finally {
    exporting.value = false
  }
  downloadBlob(new Blob([JSON.stringify(items.value, null, 2)], { type: 'application/json' }), 'godhelmet-sessions.json')
}
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <header class="grid grid-cols-1 gap-3">
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 class="text-4xl">Session log</h1>
        <UButton icon="i-lucide-download" :disabled="!items.length" :loading="exporting" @click="exportAll">Export JSON</UButton>
      </div>
      <p class="measure text-sm text-muted">Stored on the helmet. Blind sessions show "hidden" until you rate them.</p>
      <div v-if="!device.kind" class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-warning">Connect the helmet (or the demo) to see its log.</span>
        <AppConnect />
      </div>
      <p v-else-if="lost && items.length" class="text-sm text-warning">Connection lost: this is the log as it was last read.</p>
      <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    </header>

    <section v-if="items.length" class="panel grid grid-cols-1 gap-4 p-3 sm:p-5" aria-label="Sessions">
      <!-- A table from 640 px up. -->
      <table class="w-full border-collapse text-sm max-sm:hidden">
        <thead>
          <tr class="text-left text-muted">
            <th scope="col">When</th>
            <th scope="col">Program</th>
            <th scope="col">Condition</th>
            <th scope="col" class="text-right" title="Field at 20 mm">{{ unitLabel() }}</th>
            <th scope="col" class="text-right" title="Minutes">Min</th>
            <th scope="col" class="text-right" title="Geomagnetic Kp index">Kp</th>
            <th scope="col">Rating</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="e in items" :key="e.id">
            <tr class="entry">
              <td class="num whitespace-nowrap text-muted">{{ fmtDate(e.start) }}</td>
              <td>
                <span class="font-semibold text-highlighted">{{ e.presetName }}</span><span v-if="!e.completed" class="text-muted"> ({{ e.reason || 'running' }})</span>
                <div v-if="e.notes" class="mt-0.5 max-w-[48ch] whitespace-pre-line [overflow-wrap:anywhere] text-muted">{{ e.notes }}</div>
              </td>
              <td class="whitespace-nowrap"><template v-if="e.blind"><UIcon name="i-lucide-lock" class="mr-1 size-3.5 align-[-0.125em] text-muted" /><span class="sr-only">Blind, </span></template>{{ e.condition }}</td>
              <td class="num text-right">{{ fmtSetting(e.fieldUT, false) }}</td>
              <td class="num text-right">{{ minutes(e) }}</td>
              <td class="num text-right">{{ kp(e) }}</td>
              <td><LogRateCell :entry="e" :live="live(e)" :open="rating.has(e.id)" @rate="openRating(e)" /></td>
            </tr>
            <tr v-if="rating.has(e.id)">
              <td colspan="7" class="rate-row">
                <RatingForm v-model:rating="rating.get(e.id)!.value" v-model:notes="rating.get(e.id)!.notes" :error="rating.get(e.id)!.err" class="max-w-xl" @save="rate(e)" @cancel="closeRating(e)" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Phone: one block per session; field, minutes and Kp sit under the program name. -->
      <ul class="grid grid-cols-1 sm:hidden">
        <li v-for="e in items" :key="e.id" class="grid grid-cols-1 gap-2 border-b border-default px-2 py-3.5 last:border-b-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p><span class="font-semibold text-highlighted">{{ e.presetName }}</span><span v-if="!e.completed" class="text-sm text-muted"> ({{ e.reason || 'running' }})</span></p>
              <p class="num text-sm text-muted">{{ fmtDate(e.start) }}</p>
            </div>
            <LogRateCell :entry="e" :live="live(e)" :open="rating.has(e.id)" :trial-note="false" class="shrink-0 justify-items-end text-right" @rate="openRating(e)" />
          </div>
          <p class="num text-sm text-muted">
            <span class="text-default"><UIcon v-if="e.blind" name="i-lucide-lock" class="mr-1 size-3.5 align-[-0.125em] text-muted" /><span class="sr-only">Condition: <template v-if="e.blind">blind, </template></span>{{ e.condition }}</span>, {{ fmtSetting(e.fieldUT) }}, {{ minutes(e) }} min, Kp {{ kp(e) }}
          </p>
          <p v-if="e.trialId && e.rating < 0 && e.blind" class="text-sm text-muted">Trial #{{ e.trialId }}: rate it after the trial is revealed.</p>
          <p v-if="e.notes" class="whitespace-pre-line [overflow-wrap:anywhere] text-sm text-muted">{{ e.notes }}</p>
          <RatingForm v-if="rating.has(e.id)" v-model:rating="rating.get(e.id)!.value" v-model:notes="rating.get(e.id)!.notes" :error="rating.get(e.id)!.err" class="mt-1 rounded-md border border-default p-3" @save="rate(e)" @cancel="closeRating(e)" />
        </li>
      </ul>

      <div v-if="items.length < total" class="flex px-2 pb-1 sm:px-0 sm:pb-0">
        <UButton :disabled="loading" :loading="loading && !exporting" @click="load(true)">Load more ({{ items.length }} of {{ total }})</UButton>
      </div>
    </section>
    <p v-else-if="device.kind && !loading" class="panel p-5 text-sm text-muted sm:p-7">No sessions yet. <NuxtLink to="/app/programs" class="text-primary underline underline-offset-4">Pick a program</NuxtLink> to start one.</p>
  </div>
</template>

<style scoped>
th, td { padding: 0.6rem 0.75rem; vertical-align: top; }
th { font-weight: 600; font-size: 0.8125rem; border-bottom: 1px solid var(--ui-border); white-space: nowrap; }
.entry td { border-top: 1px solid var(--ui-border); }
tbody tr:first-child td { border-top: 0; }
.rate-row { padding-top: 0.25rem; padding-bottom: 1.25rem; }
</style>
