<script setup lang="ts">
// A committed trial in miniature. The helmet picks a target and publishes
// the SHA-256 of that choice before you respond; at the end it shows the
// text that was hashed, and anyone can check it. The hash shown here is the
// real SHA-256 of the line under it, computed in this browser.
const root = ref<HTMLElement>()
const PICK = 2600
const LOCK = 2400
const SHOW = 4200

const clock = ref(PICK + LOCK + 600) // server and resting picture: revealed
const target = ref(3)
const nonce = ref('9c41e07ab2d85f36')
const hash = ref('')
const preimage = computed(() => `godhelmet-trial|id=17|set=landscapes|target=${target.value}|condition=active|nonce=${nonce.value}`)
const stage = computed(() => (clock.value < PICK ? 'pick' : clock.value < PICK + LOCK ? 'lock' : 'reveal'))
const typed = computed(() => hash.value.slice(0, Math.round(64 * Math.min(1, clock.value / (PICK * 0.75)))))

async function digest() {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(preimage.value)))
  hash.value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function next() {
  target.value = 1 + Math.floor(Math.random() * 4)
  nonce.value = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')
  digest()
}
onMounted(digest)

useFrameLoop(root, (_t, dt) => {
  clock.value += dt
  if (clock.value > PICK + LOCK + SHOW) {
    clock.value = 0
    next()
  }
})
</script>

<template>
  <ol ref="root" class="grid gap-3 text-sm" aria-hidden="true">
    <li class="row on">
      <UIcon name="i-lucide-lock" class="mark" />
      <div class="min-w-0">
        <p class="text-highlighted">The helmet picks a target and commits to it</p>
        <p class="code">{{ (stage === 'pick' ? typed : hash) || '…' }}</p>
      </div>
    </li>
    <li class="row" :class="{ on: stage !== 'pick' }">
      <UIcon name="i-lucide-pencil-line" class="mark" />
      <p class="text-highlighted">You describe what you get, and lock your answer</p>
    </li>
    <li class="row" :class="{ on: stage === 'reveal' }">
      <UIcon name="i-lucide-check-check" class="mark text-success" />
      <div class="min-w-0">
        <p class="text-highlighted">Revealed: picture {{ target }} of 4. The hash matches.</p>
        <p class="code">{{ preimage }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.row { display: grid; grid-template-columns: 1.1rem minmax(0, 1fr); gap: 0.7rem; align-items: start; opacity: 0.28; transition: opacity 0.6s; }
.row.on { opacity: 1; }
.mark { width: 1.05rem; height: 1.05rem; margin-top: 0.15rem; color: var(--ui-primary); }
/* Hashes are compared character by character: fixed-width digits help. */
.code { margin-top: 0.25rem; font-size: 0.72rem; line-height: 1.45; color: var(--ui-text-muted); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; min-height: 2.9em; }
</style>
