<script setup>
// Evidence level of a guide, on the same scale as the programs (lib/evidence.js).
import { computed } from 'vue'
import { evidenceLabel, evidenceInfo, evidenceClass } from '../../lib/evidence.js'

const props = defineProps({ level: { type: String, default: '' } })
const label = computed(() => (props.level ? evidenceLabel(props.level) : 'unknown'))
</script>

<template>
  <span class="chip" :class="evidenceClass(level)" :title="evidenceInfo(level)">Evidence: {{ label }}</span>
</template>
