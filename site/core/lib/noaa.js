// Planetary Kp / ap from NOAA SWPC (CORS-enabled, 3-hourly values).
const URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'

export async function fetchKp() {
  // (Given up after 10 s: connecting to the helmet must not wait on a network that never answers.)
  const res = await fetch(URL, { cache: 'no-store', signal: AbortSignal.timeout?.(10000) })
  if (!res.ok) throw new Error(`NOAA: HTTP ${res.status}`)
  const rows = await res.json()
  const last = rows[rows.length - 1]
  // Current format: array of {time_tag, Kp, a_running, station_count}; older: arrays with a header row.
  if (Array.isArray(last)) return { kp: Number(last[1]), ap: Number(last[2]), time: last[0] }
  return { kp: Number(last.Kp), ap: Number(last.a_running), time: last.time_tag }
}
