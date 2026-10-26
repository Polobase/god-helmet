// SHA-256 via WebCrypto (GitHub Pages and localhost are secure contexts).
const encoder = new TextEncoder()

export const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return toHex(await crypto.subtle.digest('SHA-256', bytes))
}

// Uniform integer in [0, n) without modulo bias.
export function randomBelow(n) {
  if (n <= 1) return 0
  const limit = 2 ** 32 - (2 ** 32 % n)
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % n
}

export function randomHex(bytes) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}
