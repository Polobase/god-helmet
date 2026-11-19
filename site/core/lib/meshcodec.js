// Decoder for tools/brain_assets.mjs meshes: base64 zigzag varints of
// successive differences; positions in 0.1 mm.
export function unvarint(b64, count) {
  const bin = atob(b64)
  const out = new Int32Array(count)
  let prev = 0
  let i = 0
  for (let n = 0; n < count; n++) {
    let shift = 1
    let v = 0
    let byte
    do {
      byte = bin.charCodeAt(i++)
      v += (byte & 0x7f) * shift
      shift *= 128
    } while (byte & 0x80)
    prev += v % 2 ? -(v + 1) / 2 : v / 2
    out[n] = prev
  }
  return out
}

export function decodeMesh(e) {
  const x = unvarint(e.x, e.vertices)
  const y = unvarint(e.y, e.vertices)
  const z = unvarint(e.z, e.vertices)
  const position = new Float32Array(e.vertices * 3)
  for (let v = 0; v < e.vertices; v++) {
    position[3 * v] = x[v] / 10
    position[3 * v + 1] = y[v] / 10
    position[3 * v + 2] = z[v] / 10
  }
  const idx = unvarint(e.index, e.triangles * 3)
  const index = e.vertices < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx)
  return { position, index }
}
