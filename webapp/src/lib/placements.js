// Placements: programs grouped by their eight coil sites, with names and the
// basis of the known families (docs/PLACEMENT.md). Other sets get a name from
// their sides and lobes.
import { parseSite } from './tape.js'

export const placementKey = (sites) => sites.map((s) => s ?? '').join(',')

// Known families, keyed by CH1..CH8 ('' = unused). `layout` marks the two
// standard layouts; `basis` says where the geometry comes from.
const FAMILIES = {
  'Fpz,F7,T7,P7,Oz,P8,T8,F8': { name: 'Circumcerebral ring', layout: 'A', basis: 'Persinger-lab ring "along a horizontal plane above the ears" (single-lab); the site names are the project\'s.' },
  'FT7,T7,CP5,TP7,FT8,T8,CP6,TP8': { name: 'Temporal 4 + 4', layout: 'B', basis: 'Persinger-lab temporoparietal fields (single-lab); the site names are the project\'s.' },
  'FT7,C5,TP7,T9,FT8,C6,TP8,T10': { name: 'God Helmet / 8 Coil Shakti cross', basis: 'Vendor chart: a cross of four coils on each temporal lobe, centred on T7/T8 (claim). Site names are an inference.' },
  'Fp1,FT7,TP7,O1,O2,TP8,FT8,Fp2': { name: 'Shiva ring', basis: 'Vendor rules: evenly round the head, none above the nose, the ears or the bony ridge (claim). Site names are an inference.' },
  'T7,TP7,,,T8,TP8,,': { name: 'Koren-box pairs', basis: '"4 solenoids (Koren boxes)" through the temporal lobes (Tsang 2004, single-lab); two coils per side is an inference.' },
  'C5,TP7,T9h,FFT7,C6,TP8,T10h,FFT8': { name: 'Shiva 4 + 4 diamond (Collins 2014)', basis: 'Coils 5 cm apart vertically and 8 cm horizontally, as tested in the Persinger lab (single-lab). Site names are an inference.' },
  'Fp1,FFT7,TP7,POO7,POO8,TP8,FFT8,Fp2': { name: 'Lab ring at 45°', basis: 'Solenoid 1 over the left frontal and 8 over the right prefrontal region (Persinger & Lavallee 2010, single-lab). Site names are an inference.' },
  'FT7,FC5h,CPP5h,TPP7,FT8,FC6h,CPP6h,TPP8': { name: 'Square temporal helmet (Corradini 2014)', basis: 'The Collins 2014 hardware (single-lab); the sites are a fitted inference with the lower edge just above the ear.' },
  'T7,C5,CP5,TP7,T8,C6,CP6,TP8': { name: 'Koren helmet, four pairs (Harribance studies)', basis: 'Four left-right solenoid pairs over the temporoparietal region (Persinger & Murphy 2016). Site names are an inference.' },
  'TP7h,T7h,TP9h,T9h,TP8h,T8h,TP10h,T10h': { name: '2 × 2 temporal grid (Tinoco & Ortiz 2014)', basis: 'Independent build: four coils per temporal lobe in a 2 × 2 grid (their Figure 2; the text calls it "cross-shaped"). Site names are an inference.' },
  'FT10,T10,TP8,CP6,P6,P8,,': { name: 'Right temporoparietal six (out-of-body)', basis: 'Vendor: one coil in front of and below the right ear, one over the right angular gyrus (claim); six coils cover both spots (inference).' },
  ',,,,FT10,P6,,': { name: 'Right out-of-body pair', basis: 'Vendor: one coil in front of and below the right ear, one over the right angular gyrus (claim). Site names are an inference.' },
  ',,,,T8,TP8,P8,': { name: 'Right parietotemporal three', basis: 'The lab\'s right parietotemporal region (Sculthorpe & Persinger 2003, single-lab); three coils is an inference.' },
  'T7,TP7,T8,TP8,P3,P4,Oz,': { name: 'Re5 T-PEMF seven coils', basis: 'Two pairs over the temporal lobes, one parietal pair, one occipital coil (Martiny 2010; Tang 2026). The papers give lobes only.' },
  'Fpz,Fz,Cz,,,,,': { name: 'NeoSync midline three', basis: 'Frontopolar, frontocentral and central magnets (NCT03288714 protocol).' },
  'CP1,CP3,CP5,P3,CP2,CP4,CP6,P4': { name: 'Parietal strip', basis: 'Vendor: a strip from about an inch behind the top of the head down to the ears (claim). Site names are an inference.' },
  'CP1,,,,CP2,,,': { name: 'Septal, side by side', basis: 'Vendor: over the tops of both parietal lobes (claim, anecdote). Site names are an inference.' },
  'Cz,CPz,,,,,,': { name: 'Septal, front to back', basis: 'Vendor: from an inch to two inches behind the top of the head (claim, anecdote). Cz/CPz is an approximation: Cz sits about an inch in front of that strip.' },
  'Fp1,AF3,,,Fp2,AF4,,': { name: 'Frontal four', basis: 'Vendor: "one or two coils over each eye" (claim). Site names are an inference.' },
  ',,,,Fp1,AF3,Fp2,AF4': { name: 'Frontal four on CH5–8', basis: 'The frontal four on CH5–8, so CH1–4 can stay on the temporal sites.' },
  'O1,PO3,,,O2,PO4,,': { name: 'Occipital four', basis: 'Vendor: above the bony ridge at the back of the head (claim; the program is rated unverified).' },
  'Iz,,,,,,,': { name: 'Inion (cerebellum)', basis: 'Vendor: one coil at the bony ridge, closest to the cerebellar vermis (claim).' },
  'F3,,,,,,,': { name: 'Left DLPFC (F3)', basis: 'The common TMS site for the left dorsolateral prefrontal cortex; timing only.' },
  ',,,,F4,,,': { name: 'Right DLPFC (F4)', basis: 'The common TMS site for the right dorsolateral prefrontal cortex; timing only.' },
  'C3,,,,,,,': { name: 'Left motor cortex (C3)', basis: 'The hand area of the left motor cortex, a TMS reference site; timing only.' },
  'T7,,,,T8,,,': { name: 'T7 and T8 only', basis: 'One coil above each ear (vendor test sessions; Makarec 1987).' },
  'Fpz,F8,T8,P8,Oz,P7,T7,F7': { name: 'Circumcerebral ring, clockwise numbering', basis: 'The Layout A sites numbered the other way round.' },
  'FT7,C5,TP7,T9,,,,': { name: 'Shakti cross, left only', basis: 'The left half of the vendor cross (claim). Site names are an inference.' },
  ',,,,FT8,C6,TP8,T10': { name: 'Shakti cross, right only', basis: 'The right half of the vendor cross (claim). Site names are an inference.' },
  'FT7,TP7,,,FT8,C6,TP8,T10': { name: 'Shakti cross, six coils', basis: 'The vendor cross without the left top and bottom coils (claim). Site names are an inference.' },
  'FT7,C5,TP7,T9,FTT7h,TTP9h,FTT8h,TTP10h': { name: 'Shakti two-phase set, left cross', basis: '8 Coil Shakti two-phase family: the left cross plus inner coil pairs; the program notes give the reading of the vendor chart (inference).' },
  'FTT7h,TTP9h,FTT8h,TTP10h,FT8,C6,TP8,T10': { name: 'Shakti two-phase set, right cross', basis: '8 Coil Shakti two-phase family: the right cross plus inner coil pairs; the program notes give the reading of the vendor chart (inference).' },
  'FT7,TP7,,,FT8,TP8,,': { name: '4-coil Shakti, in front of and behind the ears', basis: 'Vendor 4-coil sessions (claim). Site names are an inference.' },
  'Fp1,AF3,FT7,TP7,Fp2,AF4,FT8,TP8': { name: 'Frontal + temporal pairs', basis: 'Vendor "Altered States": frontal, then temporal (claim). Site names are an inference.' },
  'FT7,TP7,FT8,TP8,Fp1,AF3,Fp2,AF4': { name: 'Temporal + frontal pairs', basis: 'Vendor Feelgood: temporal, then frontal (claim). Site names are an inference.' },
  'Fp1,AF3,AF7,F3,Fp2,AF4,AF8,F4': { name: 'Frontal eight', basis: 'Vendor Limbic Workout, frontal version (claim). Site names are an inference.' },
  'Fp1,F3,PO3,O1,O2,PO4,F4,Fp2': { name: 'Frontal four + occipital four', basis: 'Vendor psychic design, marked untested by the vendor. Site names are an inference.' },
  'CP1,CP3,CP5,P3,,,,': { name: 'Parietal strip, left', basis: 'Vendor parietal strip, left side only (claim). Site names are an inference.' },
  ',,,,CP2,CP4,CP6,P4': { name: 'Parietal strip, right', basis: 'Vendor parietal strip, right side only (claim). Site names are an inference.' },
  'T7,FT7,FT9,T9,T8,FT8,FT10,T10': { name: 'Anterior temporal squares', basis: 'A square per side from the band (T7, FT7) down to the ear-point line (T9, FT9). The only report says the coils were "aimed just above and in front of the ears" (Nature news 2004). Site names are an inference.' },
  'Fz,F7,C3,P7,Pz,P8,C4,F8': { name: 'Shiva 64-coil OBE case, 8 coils', basis: 'An 8-coil reduction of a vendor 64-coil case (claim). Site names are an inference.' },
}

// Program shown first when a placement is chosen (otherwise the first in library order).
const PREFERRED = ['god-helmet-classic', 'remote-viewing', 'presence-right', 'obe', 'murphy-shiva-amy-hipp-sequence-fast', 'persinger-koren-boxes-tsang-2004', 'meditation-prep', 'love-agape', 'frontal']

const LOBE_ORDER = ['frontal', 'temporal', 'central', 'parietal', 'occipital', 'inion']

// Lobe under a site, coarse: for naming groups and filtering.
export function siteLobe(name) {
  const s = parseSite(name)
  if (!s) return null
  if (s.kind === 'back') return 'inion'
  if (s.kind === 'ring' || s.kind === 'low') {
    if (s.k <= 3 && s.k > 0) return s.kind === 'low' && s.k >= 3 ? 'temporal' : 'frontal'
    if (s.k === 0) return 'frontal'
    if (s.k <= 6.5) return 'temporal'
    if (s.k <= 7.5) return 'parietal'
    return 'occipital'
  }
  if (s.kind === 'row' && s.f >= 0.625 && s.pct >= 35 && s.pct <= 65) return 'temporal'
  if (s.pct >= 80) return 'occipital'
  if (s.pct < 45) return 'frontal'
  if (s.pct <= 55) return 'central'
  return 'parietal'
}

const mirror = (name) => name.replace(/\d+/, (d) => String(Number(d) % 2 ? Number(d) + 1 : Number(d) - 1))
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// A readable name for an unnamed site set: "Temporal: FT7, TP7 + mirror",
// "Left frontal: F7, F3", "Frontal + temporal, both sides · 8 coils".
export function describeSites(sites) {
  const used = [...new Set(sites.filter(Boolean))]
  const parsed = used.map((n) => parseSite(n))
  const sides = new Set(parsed.map((p) => p?.side ?? 'mid'))
  const lobes = LOBE_ORDER.filter((l) => used.some((n) => siteLobe(n) === l))
  const lobeText = lobes.join(' + ') || 'custom'
  const left = used.filter((_, i) => parsed[i]?.side === 'left')
  const symmetric = !sides.has('mid') && left.length * 2 === used.length && left.every((n) => used.includes(mirror(n)))
  if (symmetric && left.length <= 3) return `${cap(lobeText)}: ${left.join(', ')} + mirror`
  const side = sides.has('left') && sides.has('right') ? 'both sides' : sides.has('left') ? 'left' : sides.has('right') ? 'right' : 'midline'
  if (used.length <= 3) return `${cap(side)} ${lobeText}: ${used.join(', ')}`
  return `${cap(lobeText)}, ${side} · ${used.length} coils`
}

// Groups of programs sharing a placement, most used first.
// `presets` = [{doc, session}], `sitesOf(session)` -> 8 names/null.
export function placementGroups(presets, sitesOf) {
  const groups = new Map()
  for (const p of presets) {
    if (!p.session) continue
    const sites = sitesOf(p.session).map((s) => s || null)
    const key = placementKey(sites)
    if (!groups.has(key)) {
      const fam = FAMILIES[key]
      const used = sites.filter(Boolean)
      groups.set(key, {
        key,
        sites,
        name: fam?.name ?? describeSites(sites),
        named: Boolean(fam),
        layout: fam?.layout ?? null,
        basis: fam?.basis ?? 'Program-specific sites; the program notes give the source of the geometry.',
        coils: used.length,
        lobes: LOBE_ORDER.filter((l) => used.some((n) => siteLobe(n) === l)),
        programs: [],
      })
    }
    groups.get(key).programs.push(p)
  }
  for (const g of groups.values()) g.featured = PREFERRED.map((id) => g.programs.find((p) => p.doc.id === id)).find(Boolean) ?? g.programs[0]
  return [...groups.values()].sort((a, b) => b.programs.length - a.programs.length || a.name.localeCompare(b.name))
}

// Short label for the kind of placement.
export const placementKind = (g) => (g.layout ? `Layout ${g.layout}` : g.programs.length > 1 ? 'Shared placement' : g.named ? 'Known placement' : 'Program-specific placement')
