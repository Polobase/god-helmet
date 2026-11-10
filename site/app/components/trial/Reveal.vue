<script setup lang="ts">
// After the reveal: hit or rank, the condition, and the three checks that
// nothing was changed since the helmet committed to its choice.
import type { Trial, TrialChecks } from '~/lib/trials'

const props = defineProps<{ trial: Trial, checks: TrialChecks | null }>()

const hit = computed(() => props.trial.targetRank === 1)
const rows = computed(() => (props.checks
  ? [
      { key: 'commitment', ok: props.checks.commitment, text: 'Commitment matches the revealed choice' },
      { key: 'pool', ok: props.checks.pool, text: 'Picture pool unchanged since the trial started' },
      { key: 'response', ok: props.checks.response, text: 'Your response unchanged since locking' },
    ]
  : []))
</script>

<template>
  <div class="grid grid-cols-1 gap-3 border-t border-default pt-5">
    <p class="num font-display text-5xl font-[620] leading-none" :class="hit ? 'text-success' : 'text-highlighted'" data-test="verdict">{{ hit ? 'Hit' : `Rank ${trial.targetRank} of ${trial.setSize}` }}</p>
    <p class="measure text-sm">The target is marked “Target”. Condition: <b class="text-highlighted" data-test="condition">{{ trial.condition }}</b>. Chance of a first-place hit: {{ Math.round(100 / (trial.setSize ?? 1)) }} %.</p>
    <ul v-if="checks" class="grid grid-cols-1 gap-1 text-sm" aria-label="Checks">
      <li v-for="r in rows" :key="r.key" class="flex items-start gap-2" :class="r.ok ? 'text-success' : 'text-error'" :data-test="`check-${r.key}`" :data-ok="r.ok">
        <UIcon :name="r.ok ? 'i-lucide-check' : 'i-lucide-x'" class="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
        <span><span class="sr-only">{{ r.ok ? 'Passed:' : 'Failed:' }}</span> {{ r.text }}</span>
      </li>
    </ul>
    <p class="text-sm text-muted">Kp at lock: <span class="num">{{ trial.kpValid ? trial.kp.toFixed(2) : '–' }}</span>, LST: <span class="num">{{ trial.lst >= 0 ? trial.lst.toFixed(2) + ' h' : '–' }}</span></p>
    <p class="break-all font-mono text-[0.8rem] leading-relaxed text-muted" data-test="preimage">{{ trial.preimage }}</p>
  </div>
</template>
