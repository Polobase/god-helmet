// Top view of the head used by the coil maps (web SiteMap and the device):
// azimuthal around the vertex like an EEG topoplot, nose up, the band line
// (Fpz - T7 - Oz - T8) on the unit circle; sites below the band fall outside.
const BAND = ['Fpz', 'Fp1', 'AF7', 'F7', 'FT7', 'T7', 'TP7', 'P7', 'PO7', 'O1', 'Oz', 'O2', 'PO8', 'P8', 'TP8', 'T8', 'FT8', 'F8', 'AF8', 'Fp2']
const sub = (a, b) => a.map((v, i) => v - b[i])
const unit = (a) => {
  const l = Math.hypot(...a)
  return a.map((v) => v / l)
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// `sites`: name -> MNI position (assets/brain/sites.json); `centre`: head centre.
// Returns p -> [x, y] with x to the right (your left on the left), y down.
export function makeTopView(sites, centre) {
  const up = unit(sub(sites.Cz, centre))
  const front = unit(sub(sub(sites.Fpz, centre), up.map((v) => v * dot(sub(sites.Fpz, centre), up))))
  const right = cross(front, up)
  const polar = (p) => Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(p, centre)), up))))
  const bandPolar = BAND.reduce((s, n) => s + polar(sites[n]), 0) / BAND.length
  return (p) => {
    const d = unit(sub(p, centre))
    const r = polar(p) / bandPolar
    const phi = Math.atan2(dot(d, right), dot(d, front))
    return [r * Math.sin(phi), -r * Math.cos(phi)]
  }
}
