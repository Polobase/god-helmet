// SD-card program pack for the standalone display board (docs/STANDALONE.md).
// Pure functions: scripts/sd-pack.mjs writes the files, test/sdpack.test.js
// checks them. Everything the device reads is ASCII (its fonts are 7-bit),
// short (numbered file names) and pre-parsed where it helps the small RAM.
import { parseSession } from '../engine/session.js'
import { compactProgram } from '../engine/compact.js'
import { HEAD_CENTRE } from '../engine/field.js'
import { CATEGORY_LABELS, CATEGORY_ORDER } from './categories.js'
import { placementGroups, placementKind } from './placements.js'
import { makeTape, describeSite, cleanHead, HEAD_DEFAULTS } from './tape.js'
import { LAYOUTS } from './layouts.js'
import { makeTopView } from './topview.js'

export const PACK_VERSION = 1
export const MAX_PROGRAM_BYTES = 32 * 1024
const TEN_TEN = /^(Fp|AF|F|FT|FC|T|C|TP|CP|P|PO|O|I)(z|\d+)$/

const FOLD = {
  '‘': "'", '’': "'", '‚': "'", '“': '"', '”': '"', '„': '"', '–': '-', '—': '-',
  '−': '-', '…': '...', 'µ': 'u', 'μ': 'u', '×': 'x', '→': '->', '←': '<-', '↔': '<->',
  '≈': '~', '≥': '>=', '≤': '<=', '±': '+/-', '°': ' deg', '·': '-', '•': '-',
  'ß': 'ss', 'æ': 'ae', 'ø': 'o', '′': "'", '″': '"', ' ': ' ', ' ': ' ', ' ': ' ',
  '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', 'θ': 'theta', 'α': 'alpha', 'β': 'beta',
  'γ': 'gamma', 'δ': 'delta', 'Δ': 'delta', 'Ω': 'Ohm', 'Ω': 'Ohm', '₂': '2', '²': '2',
}

// Plain 7-bit text: typographic marks and Greek letters spelled out, accents dropped.
export function ascii(text) {
  return String(text ?? '')
    .replace(/[^\x00-\x7f]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x09\x0a\x20-\x7e]/g, '?')
}
const field = (t) => ascii(t).replace(/[\t\r\n]+/g, ' ').trim()

const sitesOf = (session) => (session.layout === 'custom' ? session.sites.map((s) => s || null) : LAYOUTS[session.layout].channels.map((c) => c.site))
const pad = (n) => String(n).padStart(3, '0')

// docs: preset JSON objects; sites: name -> MNI position (assets/brain/sites.json).
// Returns { files: Map(path -> text), report }. Throws on an invalid preset.
export function buildPack(docs, sites, { date = '' } = {}) {
  const programs = docs
    .map((doc) => ({ doc, session: parseSession(doc) }))
    .sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.doc.category)
      const cb = CATEGORY_ORDER.indexOf(b.doc.category)
      return ca - cb || a.doc.name.localeCompare(b.doc.name)
    })
  const groups = placementGroups(programs, sitesOf)
  const groupOf = new Map(groups.flatMap((g) => g.programs.map((p) => [p, g])))
  const files = new Map()
  const index = [`#godhelmet-pack\t${PACK_VERSION}\t${programs.length}\t${date}`]
  const usedSites = new Set()
  let largest = { bytes: 0, id: '' }

  programs.forEach((p, num) => {
    const { doc, session } = p
    const g = groupOf.get(p)
    const coilSites = sitesOf(session)
    coilSites.filter(Boolean).forEach((s) => usedSites.add(s))
    // Names shown on the device (session screen, log) in its 7-bit fonts.
    const compact = compactProgram(doc)
    compact.name = field(compact.name)
    for (const ph of compact.phases) if (ph.name) ph.name = field(ph.name)
    const json = JSON.stringify(compact)
    if (json.length > MAX_PROGRAM_BYTES) throw new Error(`${doc.id}: ${json.length} bytes, over ${MAX_PROGRAM_BYTES}`)
    if (json.length > largest.bytes) largest = { bytes: json.length, id: doc.id }
    files.set(`p/${pad(num)}.json`, json)
    index.push([pad(num), doc.id, doc.category, doc.evidence ?? '', Math.round(session.totalMs / 1000), coilSites.filter(Boolean).length,
      coilSites.map((s) => s ?? '').join(','), field(doc.name), field(g.name)].join('\t'))
    const text = [
      field(doc.name),
      `Evidence: ${field(doc.evidence ?? 'unknown')}${doc.origin ? ` - ${field(doc.origin)}` : ''}`,
      '',
      ascii(doc.summary ?? ''),
      doc.setting ? `\nSetting: ${ascii(doc.setting)}` : '',
      doc.schedule ? `\nSchedule: ${ascii(doc.schedule)}` : '',
      `\nPlacement: ${field(g.name)} (${field(placementKind(g))})`,
      ascii(g.basis),
      doc.notes ? `\nNotes: ${ascii(doc.notes)}` : '',
    ].filter((l) => l !== '').join('\n')
    files.set(`t/${pad(num)}.txt`, `${text}\n`)
  })

  const counts = new Map()
  for (const p of programs) counts.set(p.doc.category, (counts.get(p.doc.category) ?? 0) + 1)
  files.set('categories.tsv', CATEGORY_ORDER.filter((k) => counts.has(k)).map((k) => `${k}\t${field(CATEGORY_LABELS[k])}\t${counts.get(k)}`).join('\n') + '\n')
  files.set('index.tsv', `${index.join('\n')}\n`)

  // Coil map: every 10-10 site as a dot, plus the 10-5 sites programs use;
  // x, y on the unit band circle (seen from above: your left on the left, y down = back).
  const top = makeTopView(sites, HEAD_CENTRE)
  const siteLines = Object.keys(sites)
    .filter((n) => TEN_TEN.test(n) || usedSites.has(n))
    .map((n) => {
      const [x, y] = top(sites[n])
      return `${n}\t${x.toFixed(3)}\t${y.toFixed(3)}\t${TEN_TEN.test(n) ? 1 : 0}`
    })
  files.set('sites.tsv', `${siteLines.join('\n')}\n`)

  // Template head arcs for the device's own tape-measure directions (lib/engine tape.cpp).
  files.set('tape.json', JSON.stringify(makeTape(sites).template))
  files.set('wifi.example.txt', [
    '# Rename to wifi.txt to set the clock from the internet at power-on.',
    '# WiFi is switched off again before any session starts.',
    'ssid=YourNetwork',
    'password=YourPassword',
    '# Time zone as a POSIX TZ string (default: Central Europe).',
    'tz=CET-1CEST,M3.5.0,M10.5.0/3',
    '',
  ].join('\n'))

  return { files, report: { programs: programs.length, placements: groups.length, largest } }
}

// Reference data for firmware/test/host (C++ tape port): every site at a
// typical and a measured head.
export function tapeFixture(sites) {
  const tape = makeTape(sites)
  const heads = [null, { nasionInion: 38, earEar: 37.5, circumference: 59 }]
  const cases = []
  for (const name of Object.keys(sites)) {
    for (const head of heads) {
      const r = tape.recipe(name, head ?? {})
      if (!r) continue
      cases.push({ site: name, head: head ? [head.nasionInion, head.earEar, head.circumference] : null, kind: r.kind, band: r.band,
        bandCm: r.bandCm, text: r.text, detail: r.detail, estimate: r.estimate, describe: describeSite(name) })
    }
  }
  const typical = cleanHead({})
  return { template: tape.template, typical: [typical.nasionInion, typical.earEar, typical.circumference], defaults: HEAD_DEFAULTS, cases }
}
