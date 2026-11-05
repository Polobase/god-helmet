// Word search for the program library and the program switcher. Every word
// must match somewhere: a whole word (OBE, T7) ranks above a word start (amyg),
// a word start above a substring (4+ letters only); an exact id wins.
export const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
export const tokens = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean)
export const queryWords = (q) => norm(q).trim().split(/\s+/).filter((w) => /[a-z0-9]/.test(w))

// 3 whole word, 2 word start, 1 substring (4+ letters), 0 no match.
export function wordScore(word, text) {
  const tk = tokens(text)
  if (tk.includes(word)) return 3
  if (tk.some((t) => t.startsWith(word))) return 2
  if (word.length >= 4 && norm(text).includes(word)) return 1
  return 0
}

// fields: [[text, weight], ...]. 0 when a word matches no field.
export function score(words, fields, id = '') {
  if (!words.length) return 0
  if (id && words.length === 1 && norm(id) === words[0]) return 1000
  let total = 0
  for (const w of words) {
    let best = 0
    for (const [text, weight = 1] of fields) best = Math.max(best, wordScore(w, text) * weight)
    if (!best) return 0
    total += best
  }
  return total
}
