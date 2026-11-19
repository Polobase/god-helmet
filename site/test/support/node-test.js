// The core's tests were written for `node --test`. This gives them the same
// `test`, `beforeEach` and `after` on top of vitest, including the fake timers
// of `t.mock.timers` (a new `t` for every test).
import { test as vtest, beforeEach, afterAll, afterEach, vi } from 'vitest'

const timers = {
  enable: ({ apis = ['setTimeout', 'setInterval'] } = {}) => vi.useFakeTimers({ toFake: apis.flatMap((a) => [a, a.replace('set', 'clear')]) }),
  tick: (ms) => vi.advanceTimersByTime(ms),
  reset: () => vi.useRealTimers(),
}
afterEach(() => vi.useRealTimers())

export function test(name, a, b) {
  const [options, fn] = typeof a === 'function' ? [{}, a] : [a ?? {}, b]
  return vtest(name, options, fn && (() => fn({ mock: { timers } })))
}
test.skip = (name, a, b) => vtest.skip(name, typeof a === 'function' ? a : b)
export { beforeEach, afterAll as after }
