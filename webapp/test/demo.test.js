// Protocol behaviour of the in-browser demo helmet (mirrors the firmware).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openDemo } from '../src/ble/demo.js'
import { sha256Hex } from '../src/lib/crypto.js'
import { summarise, poissonBinomialTail } from '../src/lib/stats.js'

const presetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'presets')
const preset = (id) => JSON.parse(readFileSync(join(presetsDir, `${id}.json`), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('sessions: safety gate, start, live status, blind reveal after rating', async () => {
  const statuses = []
  const dev = openDemo({ onStatus: (s) => statuses.push(s) })
  dev.reset()
  try {
    await assert.rejects(dev.call('session.start', { session: preset('obe') }), /safety/)
    await dev.call('settings.set', { safetyAccepted: true })
    await assert.rejects(dev.call('settings.set', { seriesOhm: 10 }), /series resistor/)

    const { logId } = await dev.call('session.start', { session: preset('remote-viewing'), fieldUT: 50, blind: false })
    assert.ok(logId > 0)
    await assert.rejects(dev.call('session.start', { session: preset('obe') }), /already running/)
    await sleep(700)
    const live = statuses.at(-1)
    assert.equal(live.state, 'running')
    assert.equal(live.fieldUT, 5) // clamped to maxFieldUT
    assert.equal(live.levels.length, 8)
    await dev.call('session.skip')
    await dev.call('session.stop')
    await sleep(2300)
    const log = await dev.call('log.list', { offset: 0, limit: 10 })
    assert.equal(log.items[0].id, logId)
    assert.equal(log.items[0].condition, 'active')

    // Blind: hidden until rated, levels withheld while running.
    const blind = await dev.call('session.start', { session: preset('sham'), blind: true })
    await sleep(600)
    assert.equal(statuses.at(-1).blind, true)
    assert.equal(statuses.at(-1).levels, undefined)
    await dev.call('session.stop')
    await sleep(2300)
    const before = (await dev.call('log.list', {})).items.find((e) => e.id === blind.logId)
    assert.equal(before.condition, 'hidden')
    const rated = await dev.call('log.rate', { id: blind.logId, rating: 3, notes: 'calm' })
    assert.ok(['active', 'sham'].includes(rated.condition))
  } finally {
    dev.close()
  }
})

test('trials: commitment, locking, judging, reveal', async () => {
  const dev = openDemo({})
  dev.reset()
  try {
    await dev.call('settings.set', { safetyAccepted: true })
    const manifestHash = await sha256Hex('pool')
    const sets = [{ id: 'set-a', size: 5 }, { id: 'set-b', size: 4 }]
    await assert.rejects(dev.call('trial.new', { manifestHash: 'xyz', sets }), /manifestHash/)
    const t = await dev.call('trial.new', { mode: 'rv', manifestHash, sets, session: preset('remote-viewing'), blind: true })
    assert.equal(t.state, 'open')
    assert.equal(t.condition, 'hidden')
    assert.equal(t.set, undefined) // set and target stay hidden
    assert.equal(t.target, undefined)
    await assert.rejects(dev.call('trial.judge', { id: t.id }), /lock/)
    const responseHash = await sha256Hex('my impressions')
    const locked = await dev.call('trial.lock', { id: t.id, responseHash })
    assert.equal(locked.responseHash, responseHash)
    const judging = await dev.call('trial.judge', { id: t.id })
    assert.ok(['set-a', 'set-b'].includes(judging.set))
    assert.deepEqual([...judging.order].sort(), [...Array(judging.setSize).keys()])
    await assert.rejects(dev.call('trial.reveal', { id: t.id }), /rank/)
    await assert.rejects(dev.call('trial.ranks', { id: t.id, ranks: [1, 1] }), /permutation/)
    const ranks = [...Array(judging.setSize).keys()].map((i) => i + 1)
    await dev.call('trial.ranks', { id: t.id, ranks })
    const revealed = await dev.call('trial.reveal', { id: t.id })
    assert.equal(await sha256Hex(revealed.preimage), revealed.commitment)
    assert.equal(revealed.targetRank, ranks[revealed.order.indexOf(revealed.target)])
    assert.ok(['active', 'sham'].includes(revealed.condition))
    await assert.rejects(dev.call('trial.abort', { id: t.id }), /revealed/)
    await dev.call('session.stop')

    const tele = await dev.call('trial.new', { mode: 'telepathy', manifestHash, sets })
    const sender = await dev.call('trial.sender', { id: tele.id })
    assert.ok(sender.target >= 0)
    await dev.call('trial.lock', { id: tele.id, responseHash })
    await assert.rejects(dev.call('trial.sender', { id: tele.id }), /sender view/)
  } finally {
    dev.close()
  }
})

test('statistics', () => {
  assert.ok(Math.abs(poissonBinomialTail(new Array(30).fill(0.2), 11) - 0.0256) < 1e-3)
  const s = summarise([{ setSize: 5, targetRank: 1 }, { setSize: 5, targetRank: 3 }, { setSize: 4, targetRank: 1 }, { setSize: 5, targetRank: 5 }, { setSize: 5, targetRank: 2 }])
  assert.equal(s.hits, 2)
  assert.ok(Math.abs(s.pHits - 0.2832) < 1e-4)
  assert.ok(Math.abs(s.z - 0.821995) < 1e-5)
})
