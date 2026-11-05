// Evidence levels of programs and guides (the scale of docs/RESEARCH.md):
// label, what it means, and the chip colour.
export const EVIDENCE = {
  established: { label: 'Established', info: 'Independently replicated, or consensus', tone: 'ok' },
  'single-lab': { label: 'Single lab', info: 'Published by one lab or group, not independently replicated', tone: 'blue' },
  claim: { label: 'Claim', info: 'Claimed by the author, lab or vendor; no controlled independent test', tone: 'warn' },
  anecdote: { label: 'Anecdote', info: 'Personal reports only', tone: 'warn' },
  unverified: { label: 'Unverified', info: 'A construct nobody has tested yet', tone: '' },
}

export const EVIDENCE_KEYS = Object.keys(EVIDENCE)
export const evidenceLabel = (level) => EVIDENCE[level]?.label ?? level ?? ''
export const evidenceInfo = (level) => EVIDENCE[level]?.info ?? ''
// CSS class for a .chip: ev-ok, ev-blue, ev-warn (style.css)
export const evidenceClass = (level) => (EVIDENCE[level]?.tone ? `ev-${EVIDENCE[level].tone}` : '')
