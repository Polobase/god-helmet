// Preset library: the JSON files in /presets (shared with the firmware tests).
import { parseSession } from '../engine/session.js'

const files = import.meta.glob('../../../presets/*.json', { eager: true, import: 'default' })

export const CATEGORY_LABELS = {
  spiritual: 'God Helmet',
  presence: 'Sensed presence',
  obe: 'Out-of-body',
  psi: 'Remote viewing & telepathy',
  meditation: 'Meditation',
  mood: 'Mood',
  dreams: 'Dreams & sleep',
  body: 'Body & pleasure',
  signals: 'Single signals (Shiva / Shakti)',
  courses: 'Courses',
  lowfield: 'Clinical low-field timing',
  persinger: 'Persinger lab protocols',
  replication: 'Independent replications',
  research: 'Research protocols',
  control: 'Control',
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

export const presets = Object.values(files)
  .map((doc) => {
    try {
      return { doc, session: parseSession(doc), error: null }
    } catch (e) {
      return { doc, session: null, error: e.message }
    }
  })
  .sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.doc.category)
    const cb = CATEGORY_ORDER.indexOf(b.doc.category)
    return ca - cb || a.doc.name.localeCompare(b.doc.name)
  })

export const presetById = (id) => presets.find((p) => p.doc.id === id)

export function groupedPresets() {
  const groups = []
  for (const p of presets) {
    const key = p.doc.category || 'other'
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, label: CATEGORY_LABELS[key] ?? key, items: [] }))
    g.items.push(p)
  }
  return groups
}

// Splits "a ; b ; c" source strings into readable entries with links. Entries
// are separated by ";" outside parentheses (a ";" inside "( )" belongs to the
// entry). The first URL is the entry's link, further URLs go to `extra`.
function splitEntries(source) {
  const out = []
  let depth = 0
  let cur = ''
  for (const tok of source.split(/(https?:\/\/[^\s)]+)/)) {
    if (/^https?:\/\//.test(tok)) {
      cur += tok // a ";" inside a URL does not split
      continue
    }
    for (const ch of tok) {
      if (ch === '(') depth++
      else if (ch === ')') depth = Math.max(0, depth - 1)
      if (ch === ';' && depth === 0) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
  }
  out.push(cur)
  return out
}
export function sourceEntries(source = '') {
  return splitEntries(source)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const urls = text.match(/https?:\/\/[^\s)]+/g) || []
      const label = urls
        .reduce((t, u) => t.replace(u, ''), text)
        .replace(/\s+([,)])/g, '$1')
        .replace(/[\s,]+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      return { text: label || urls[0] || text, url: urls[0] || null, extra: urls.slice(1) }
    })
}
