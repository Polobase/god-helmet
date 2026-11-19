// Mirror of firmware/lib/bleframe: [seq:u8][flags:u8][payload...]
// flags bit0 = FIRST, bit1 = LAST; one message per seq.
export const FIRST = 1
export const LAST = 2
export const HEADER = 2

export function split(bytes, seq, packetSize) {
  const chunk = Math.max(1, packetSize - HEADER)
  const packets = []
  let pos = 0
  do {
    const n = Math.min(chunk, bytes.length - pos)
    const p = new Uint8Array(HEADER + n)
    p[0] = seq & 0xff
    p[1] = (pos === 0 ? FIRST : 0) | (pos + n >= bytes.length ? LAST : 0)
    p.set(bytes.subarray(pos, pos + n), HEADER)
    packets.push(p)
    pos += n
  } while (pos < bytes.length)
  return packets
}

export class Reassembler {
  constructor(maxBytes = 64 * 1024) {
    this.max = maxBytes
    this.parts = []
    this.size = 0
    this.seq = -1
    this.active = false
  }

  // Returns the complete message (Uint8Array) or null.
  push(packet) {
    if (packet.length < HEADER) return null
    const seq = packet[0]
    const flags = packet[1]
    if (flags & FIRST) {
      this.parts = []
      this.size = 0
      this.seq = seq
      this.active = true
    } else if (!this.active || seq !== this.seq) {
      return null
    }
    const payload = packet.subarray(HEADER)
    if (this.size + payload.length > this.max) {
      this.active = false
      this.parts = []
      return null
    }
    this.parts.push(payload.slice())
    this.size += payload.length
    if (!(flags & LAST)) return null
    this.active = false
    const out = new Uint8Array(this.size)
    let o = 0
    for (const p of this.parts) {
      out.set(p, o)
      o += p.length
    }
    this.parts = []
    return out
  }
}
