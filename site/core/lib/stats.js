// Trial statistics (same as tools/trial_stats.py).

// Upper tail of N(0, 1) (Abramowitz & Stegun 26.2.17).
export function normalSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z >= 0 ? p : 1 - p
}

// Exact P(hits >= k) for independent trials with chance 1/N_i (Poisson-binomial).
export function poissonBinomialTail(ps, k) {
  let dist = [1]
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0)
    dist.forEach((v, i) => {
      next[i] += v * (1 - p)
      next[i + 1] += v * p
    })
    dist = next
  }
  return dist.slice(k).reduce((a, b) => a + b, 0)
}

export function summarise(trials) {
  if (!trials.length) return null
  const ps = trials.map((t) => 1 / t.setSize)
  const hits = trials.filter((t) => t.targetRank === 1).length
  const num = trials.reduce((a, t) => a + (t.setSize + 1) / 2 - t.targetRank, 0)
  const den = Math.sqrt(trials.reduce((a, t) => a + (t.setSize * t.setSize - 1) / 12, 0))
  const z = den > 0 ? num / den : 0
  return {
    n: trials.length,
    hits,
    expected: ps.reduce((a, b) => a + b, 0),
    pHits: poissonBinomialTail(ps, hits),
    meanRank: trials.reduce((a, t) => a + t.targetRank, 0) / trials.length,
    z,
    pZ: normalSf(z),
  }
}
