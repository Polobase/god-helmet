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

// Splits "a ; b ; c" source strings into readable entries with links.
export function sourceEntries(source = '') {
  return source
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const m = text.match(/https?:\/\/\S+/)
      return { text: m ? text.replace(m[0], '').trim() || m[0] : text, url: m ? m[0] : null }
    })
}
