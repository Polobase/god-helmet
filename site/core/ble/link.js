// What the transports (Bluetooth, USB, demo) share: the errors they raise and
// the bookkeeping of requests that wait for their reply.

// An error with a `code` that says what went wrong:
//   'helmet'    the helmet answered with an error (message = its words)
//   'timeout'   no answer in time
//   'lost'      the link dropped, or was closed, before the answer came
//   'send'      the request could not be written
//   'no-device' reconnecting without the browser's chooser is not possible
export function linkError(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}

// True when a request may or may not have reached the helmet: nothing came back.
export const noReply = (e) => ['timeout', 'lost', 'send'].includes(e?.code)

// Replies the helmet sends for a request it had to drop without handling it
// ("busy: request dropped", "request damaged: start missing"): sending the
// same request again is safe.
export const droppedByHelmet = (e) => e?.code === 'helmet' && /^(busy|request damaged)/.test(e.message)

// Request ids count from here. An operation's own "id" parameter (a log entry,
// a trial) takes the place of the request id, because the protocol has a
// single "id" member and the helmet answers with it; those ids are small, so
// the two kinds never meet.
const FIRST_ID = 1_000_000_000

export const newTag = () => crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff

// The requests of one connection that wait for their reply.
export class Pending {
  constructor(tag = newTag()) {
    this.tag = tag
    this.nextId = FIRST_ID
    this.waiting = [] // oldest first: { id, op, resolve, reject, timer }
  }

  get size() {
    return this.waiting.length
  }

  // The JSON to send and the promise of its answer. "c" and "id" go first: the
  // helmet reads them from the start of a request, so that it can still say
  // whose request it was when it has to drop one.
  request(op, params = {}, timeoutMs = 20000) {
    const body = { c: this.tag, id: this.nextId++, op, ...params }
    const entry = { id: body.id, op }
    const promise = new Promise((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject
    })
    entry.timer = setTimeout(() => this.fail(entry, linkError('timeout', `${op}: no answer from the helmet`)), timeoutMs)
    this.waiting.push(entry)
    return { json: JSON.stringify(body), entry, promise }
  }

  take(entry) {
    const i = this.waiting.indexOf(entry)
    if (i < 0) return false
    this.waiting.splice(i, 1)
    clearTimeout(entry.timer)
    return true
  }

  fail(entry, error) {
    if (this.take(entry)) entry.reject(error)
  }

  // A reply from the helmet. True when it answered one of our requests.
  reply(json) {
    if (!json || typeof json !== 'object') return false
    // The helmet could not read whose request it dropped (its start was lost).
    // It tells only the app that sent it: our oldest request is the one.
    if (json.ok === false && !json.c && !json.id) {
      const oldest = this.waiting[0]
      if (oldest) this.fail(oldest, linkError('helmet', json.error || 'request dropped'))
      return !!oldest
    }
    if (json.c !== this.tag) return false // another app's (older firmware tells everyone)
    // The helmet handles requests in the order sent, so of two with the same id the older one is answered first.
    const entry = this.waiting.find((e) => e.id === json.id)
    if (!entry) return false
    this.take(entry)
    if (json.ok) entry.resolve(json.data)
    else entry.reject(linkError('helmet', json.error))
    return true
  }

  failAll(error) {
    for (const entry of [...this.waiting]) this.fail(entry, error)
  }
}
