// Planetary Kp / ap from NOAA SWPC (CORS-enabled, 3-hourly values).
const URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'

export async function fetchKp() {
  const res = await fetch(URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`NOAA: HTTP ${res.status}`)
  const rows = await res.json()
  const last = rows[rows.length - 1]
  // Current format: array of {time_tag, Kp, a_running, station_count}; older: arrays with a header row.
  if (Array.isArray(last)) return { kp: Number(last[1]), ap: Number(last[2]), time: last[0] }
  return { kp: Number(last.Kp), ap: Number(last.a_running), time: last.time_tag }
}
