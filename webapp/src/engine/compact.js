// Compact program form for the device's SD card (webapp/scripts/sd-pack.mjs):
// only the fields the engine reads, with every point table as base64 of its
// bytes ("dataB64", "tableDataB64"). A 16,000-point table is then one JSON
// string instead of 16,000 parsed numbers, which the ESP32 could not hold.
const RUNTIME_KEYS = ['id', 'name', 'uT', 'layout', 'placement', 'fadeInS', 'fadeOutS', 'phases']

function toB64(values) {
  let bin = ''
  for (const v of values) bin += String.fromCharCode(v)
  return btoa(bin)
}

function compactPattern(p) {
  if (!p || !Array.isArray(p.data)) return p
  const { data, ...rest } = p
  return { ...rest, dataB64: toB64(data) }
}

function compactTrack(t) {
  return t && t.pattern ? { ...t, pattern: compactPattern(t.pattern) } : t
}

export function compactProgram(doc) {
  const out = {}
  for (const k of RUNTIME_KEYS) if (doc[k] !== undefined) out[k] = doc[k]
  out.phases = (doc.phases ?? []).map((ph) => {
    const c = compactTrack(ph)
    if (Array.isArray(ph.tracks)) c.tracks = ph.tracks.map(compactTrack)
    return c
  })
  if (Array.isArray(doc.tableData)) out.tableDataB64 = toB64(doc.tableData)
  return out
}
