<script setup lang="ts">
// **claim**, **established** … in the Markdown: the evidence scale as a badge.
// The meanings are the documents' own (docs/RESEARCH.md, "How to read this
// review"), which are a little wider than the app's for programs.
defineProps<{ level: string }>()
const MEANING: Record<string, string> = {
  'established': 'Replicated by independent groups.',
  'single-lab': 'Reported by one laboratory or one group and its close collaborators, with no independent replication.',
  'claim': 'Stated by an author, vendor or programme, without published supporting data.',
  'anecdote': 'Personal reports, testimonials and single cases.',
  'unverified': 'Nobody has tested it, or we could not check the source.',
}
</script>

<template>
  <EvidenceBadge :level="level" :info="MEANING[level]" />
</template>
