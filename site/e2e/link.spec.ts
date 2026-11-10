// When the connection to the helmet fails in mid-session: the app keeps
// showing the session, reconnects by itself and picks everything up again.
// In Demo mode, with the demo helmet's hooks (webapp/src/ble/demo.js):
// window.__helmetDemo.drop(ms), comeBack(), dropAfter(op), dropBefore(op, ms), restart(), pressStop().
import { expect, test, type Page } from '@playwright/test'

const PROGRAM = '/app/programs/god-helmet-classic'
const NAME = 'God Helmet classic'

interface DemoHooks {
  drop: (ms?: number) => void
  comeBack: () => void
  dropAfter: (op: string) => void
  dropBefore: (op: string, ms?: number) => void
  restart: (options?: { keepLink?: boolean }) => void
  pressStop: () => void
  mute: (ms: number) => void
  legacy: (on?: boolean) => void
  state: () => { running: boolean, bootId: number, log: { id: number, reason: string, rating: number }[] }
}
declare global {
  interface Window { __helmetDemo?: DemoHooks }
}

/** Calls one of the demo helmet's hooks in the page. */
const demo = <K extends keyof DemoHooks>(page: Page, hook: K, ...args: Parameters<DemoHooks[K]>) =>
  page.evaluate(([name, a]) => (window.__helmetDemo![name as keyof DemoHooks] as (...x: unknown[]) => unknown)(...(a as unknown[])), [hook, args] as const) as Promise<ReturnType<DemoHooks[K]>>

/** Connects the demo helmet and accepts the safety page, as a first-time user would. */
async function demoWithSafety(page: Page) {
  await page.goto('/app/safety')
  await page.getByRole('main').getByRole('button', { name: 'Demo' }).click()
  await page.getByRole('checkbox', { name: /I have read this/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL('/app/programs')
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(`^${name}`) }).click()

/** Opens the program (without reloading: the demo's connection lives in the page) and starts it. */
async function startSession(page: Page) {
  const main = page.getByRole('main')
  await main.getByPlaceholder('Search programs, sites, brain regions…').fill('god helmet classic')
  await main.locator(`a[href="${PROGRAM}"]`).first().click()
  // (On a phone the Start button is the bar at the bottom.)
  await main.getByRole('button', { name: /^Start.*…$/ }).filter({ visible: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.locator('[data-test=live-panel]')).toContainText('Session running')
}

const note = (page: Page) => page.locator('[data-test=link-note]')
const pill = (page: Page) => page.getByRole('banner').locator('[data-test=session-pill]').first()
const panel = (page: Page) => page.locator('[data-test=live-panel]')

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('close', () => expect(errors, 'uncaught errors in the page').toEqual([]))
})

test('a drop in mid-session: the session stays, the app reconnects by itself, and Stop works again', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await expect(pill(page)).toContainText(NAME)

  await demo(page, 'drop', 2500)
  // One calm line says what is known; the session stays, with the time left estimated.
  await expect(note(page)).toContainText('Connection to the demo helmet lost. Reconnecting…')
  await expect(note(page)).toContainText('keeps running on the helmet; until the connection is back, only the helmet’s STOP button stops it.')
  await expect(note(page).getByRole('button', { name: 'Reconnect' })).toBeVisible()
  await expect(pill(page)).toHaveAttribute('data-lost', 'true')
  await expect(pill(page)).toContainText(/about \d\d:\d\d/)
  await expect(pill(page).getByRole('button', { name: 'Stop' })).toBeDisabled()
  await expect(panel(page)).toContainText('Connection lost, reconnecting…')
  await expect(panel(page)).toContainText('left, estimated from the clock')
  await expect(panel(page).getByRole('button', { name: 'Stop session' })).toBeDisabled()
  await expect(panel(page).locator('[data-test=stop-reason]')).toHaveText('No connection: only the STOP button on the helmet works now.')
  await expect(page.getByRole('dialog')).toHaveCount(0) // no modal

  // By itself: nobody presses anything.
  await expect(note(page)).toHaveText(/Reconnected\. “God Helmet classic.*” is still running\./, { timeout: 15_000 })
  await expect(pill(page)).not.toHaveAttribute('data-lost', 'true')
  await expect(panel(page)).toContainText('Session running')
  await pill(page).getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('[data-test=rating-prompt]')).toBeVisible({ timeout: 10_000 })
  expect((await demo(page, 'state')).running).toBe(false)
})

test('a page reload in mid-session brings the session back', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await page.waitForTimeout(1500)
  await page.reload()
  // The helmet ran on; the app shows the session again and reconnects without being asked.
  await expect(pill(page)).toContainText(NAME)
  await expect(note(page)).toHaveText(/Reconnected\. “God Helmet classic.*” is still running\./)
  await expect(panel(page)).toContainText('Session running')
  // The same session, further on: not started anew.
  const state = await demo(page, 'state')
  expect(state.log.length).toBe(1)
  await expect(panel(page).getByRole('button', { name: 'Stop session' })).toBeEnabled()
  await panel(page).getByRole('button', { name: 'Stop session' }).click()
  await expect(page.locator('[data-test=rating-prompt]')).toBeVisible({ timeout: 10_000 })
  // On the public pages too: the session, after a reload there.
  await demo(page, 'pressStop')
})

test('a reload on a docs page, and a drop there: the session does not vanish without a word', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await page.goto('/docs/safety')
  const sitePill = page.getByRole('banner').locator('[data-test=session-pill]').first()
  await expect(sitePill).toContainText(NAME, { timeout: 15_000 })
  await expect(sitePill.getByRole('button', { name: 'Stop' })).toBeEnabled()
  await demo(page, 'drop', Infinity)
  const line = page.locator('[data-test=link-line]')
  await expect(line).toContainText('Connection to the demo helmet lost.')
  await expect(sitePill).toHaveAttribute('data-lost', 'true')
  await expect(sitePill.getByRole('button', { name: 'Stop' })).toBeDisabled()
  await demo(page, 'comeBack')
  await line.getByRole('button', { name: 'Reconnect' }).click()
  await expect(line).toHaveText(/Reconnected\. .* is still running\./)
  await sitePill.getByRole('button', { name: 'Stop' }).click()
  await expect(sitePill).toHaveCount(0, { timeout: 10_000 })
})

test('a helmet restart is reported, and the log shows the reason', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await page.waitForTimeout(1200)
  await demo(page, 'restart')
  await expect(note(page)).toHaveText(/^The helmet restarted \(software restart\) while the connection was down\. “God Helmet classic.*” ended at \d.*; it is in the Log\.$/, { timeout: 15_000 })
  await expect(pill(page)).toHaveCount(0)
  await tab(page, 'Log')
  const first = page.getByRole('main').locator('table tbody tr.entry').first()
  await expect(first).toContainText(NAME)
  await expect(first).toContainText('(restart: software restart)')
  // A restart with the link still up (a USB bridge): the same report, at once.
  await tab(page, 'Programs')
  await page.getByRole('main').getByRole('button', { name: 'Start…' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /^Start/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start anyway' }).click()
  await expect(panel(page)).toContainText('Session running')
  await demo(page, 'restart', { keepLink: true })
  await expect(note(page)).toHaveText(/^The helmet restarted \(software restart\)\. “God Helmet classic.*” ended/, { timeout: 15_000 })
  expect((await demo(page, 'state')).log.filter((e) => e.reason === 'restart: software restart').length).toBe(2)
})

test('the session ended while the link was down: said so, and the rating prompt appears after the reconnect, a reload, and only for this helmet', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await demo(page, 'drop', Infinity)
  await expect(pill(page)).toHaveAttribute('data-lost', 'true')
  await demo(page, 'pressStop') // on the helmet, while the app cannot see it
  await demo(page, 'comeBack')
  await note(page).getByRole('button', { name: 'Reconnect' }).click()
  await expect(note(page)).toHaveText(/^Reconnected\. “God Helmet classic.*” ended at \d.* while the connection was down: it was stopped with the helmet’s STOP button\.$/)
  await expect(pill(page)).toHaveCount(0)
  const prompt = page.locator('[data-test=rating-prompt]')
  await expect(prompt).toContainText('How was it?')
  await expect(prompt).toContainText(NAME)

  // It is remembered: on another page of the app and back, and after a reload.
  await tab(page, 'Helmet')
  await tab(page, 'Programs')
  await expect(prompt).toBeVisible()
  await page.reload()
  await expect(prompt).toBeVisible()

  // Another helmet whose log has an entry with the same number: not asked there.
  await demo(page, 'legacy', true) // without a helmet id it counts as another helmet
  await page.getByRole('banner').getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Demo' }).click()
  await expect(page.getByRole('banner').getByTitle('Demo: no helmet, nothing is switched on.')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(prompt).toHaveCount(0)
  await demo(page, 'legacy', false)
  await page.getByRole('banner').getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Demo' }).click()
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Save rating' }).click()
  await expect(prompt).toContainText('Saved.')
  expect((await demo(page, 'state')).log[0]!.rating).toBe(5)
  // Rated: it does not come back.
  await page.reload()
  await expect(page.getByRole('banner').getByTitle('Demo: no helmet, nothing is switched on.')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(prompt).toHaveCount(0)
})

test('Stop that does not reach the helmet says so', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await demo(page, 'dropAfter', 'session.stop') // the request arrives, the answer does not
  await pill(page).getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText(/Stop did not reach the helmet/).first()).toBeVisible()
  await expect(note(page)).toContainText(/Reconnected\./, { timeout: 15_000 })
})

test('Start waits for the first status after connecting, and a lost answer to Start does not start twice', async ({ page }) => {
  await demoWithSafety(page)
  const main = page.getByRole('main')
  await main.getByPlaceholder('Search programs, sites, brain regions…').fill('god helmet classic')
  await main.locator(`a[href="${PROGRAM}"]`).first().click()
  await main.getByRole('button', { name: 'Start…' }).first().click()
  const dialog = page.getByRole('dialog')
  // The link is down: no Start, and the reason.
  await demo(page, 'drop', Infinity)
  await expect(dialog.getByRole('button', { name: 'Connection lost' })).toBeDisabled()
  await expect(dialog.getByText('Connection to the demo helmet lost')).toBeVisible()
  await demo(page, 'comeBack')
  await dialog.getByRole('button', { name: 'Reconnect' }).click()
  await expect(dialog.getByRole('button', { name: 'Start', exact: true })).toBeEnabled()
  // The helmet starts the session, but its answer is lost with the link.
  await demo(page, 'dropAfter', 'session.start')
  await dialog.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(panel(page)).toContainText('Session running', { timeout: 15_000 })
  await expect(dialog).toHaveCount(0)
  const state = await demo(page, 'state')
  expect(state.log.length).toBe(1) // once, not twice
  await demo(page, 'pressStop')
})

/** Presses on through the open guide's steps until the step called `title` is on screen. */
async function advanceTo(page: Page, title: string) {
  const main = page.getByRole('main')
  for (let i = 0; i < 40; i++) {
    if (await main.getByRole('heading', { level: 1, name: title, exact: true }).isVisible()) return
    const leave = main.getByRole('button', { name: 'Leave step' })
    if (await leave.isVisible()) await leave.click()
    else await main.getByRole('button', { name: /^(Next|Skip step)$/ }).first().click()
    await page.waitForTimeout(800) // the runner ignores a second tap within 700 ms
  }
  throw new Error(`the guide did not reach “${title}”`)
}

test('a guide\'s helmet arm: found again after a lost start reply, shown as lost on a drop, and stopped with the run', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Guides')
  const main = page.getByRole('main')
  await main.locator('a[href="/app/guides/helmet-session-flow"]').first().click()
  await main.getByRole('button', { name: 'Start', exact: true }).click()
  await main.getByRole('button', { name: 'Begin' }).click()
  await advanceTo(page, 'Rest')
  // While a run is going, leaving the page asks first.
  expect(await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    return e.defaultPrevented
  })).toBe(true)

  // The arm's start reaches the helmet; its answer is lost with the link.
  await demo(page, 'dropAfter', 'session.start')
  await advanceTo(page, 'The program')
  const helmetLine = main.locator('p', { hasText: 'Helmet:' })
  await expect(helmetLine).toContainText('found again on the helmet', { timeout: 20_000 })
  await expect(helmetLine).toContainText('running (blind)')
  expect((await demo(page, 'state')).log.length).toBe(1)

  // A drop during the arm: the line says so, and that the program runs on.
  await demo(page, 'drop', 2500)
  await expect(main.locator('[data-test=arm-lost]')).toBeVisible()
  await expect(helmetLine).toContainText('keeps running on the helmet')
  await expect(helmetLine).not.toContainText('connection lost', { timeout: 15_000 })
  await expect(helmetLine).toContainText('running (blind)')

  // Stopping the run stops the helmet: the session was not left untracked.
  await main.getByRole('button', { name: 'Stop', exact: true }).click()
  await main.getByRole('button', { name: 'Stop session' }).click()
  await expect(main.getByRole('button', { name: 'Done' })).toBeVisible()
  await expect.poll(async () => (await demo(page, 'state')).running).toBe(false)
  // The record has the log entry, and every drop and return with its time.
  await expect(main.getByText(/log #1/)).toBeVisible()
  await expect(main.locator('[data-test=run-links]')).toHaveText(/^lost \d.*, back \d.* \(the program was still running\), lost \d.*, back \d.* \(the program was still running\)$/)
  // Its rating belongs to this summary: no second prompt on the Programs tab.
  await tab(page, 'Programs')
  await page.waitForTimeout(800)
  await expect(page.locator('[data-test=rating-prompt]')).toHaveCount(0)
})

test('a guide\'s helmet arm whose start never reached the helmet is not started after the run has been stopped', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Guides')
  const main = page.getByRole('main')
  await main.locator('a[href="/app/guides/helmet-session-flow"]').first().click()
  await main.getByRole('button', { name: 'Start', exact: true }).click()
  await main.getByRole('button', { name: 'Begin' }).click()
  await advanceTo(page, 'Rest')
  // The link drops as the start is sent, and stays down.
  await demo(page, 'dropBefore', 'session.start', Infinity)
  await advanceTo(page, 'The program')
  await expect(note(page)).toContainText('Connection to the demo helmet lost.')
  await expect(main.locator('p', { hasText: 'Helmet:' })).toContainText('No answer to the start yet.')
  // The run is stopped while the helmet cannot be reached: that must not wait for the helmet.
  await main.getByRole('button', { name: 'Stop', exact: true }).click()
  await main.getByRole('button', { name: 'Stop session' }).click()
  await expect(main.getByRole('button', { name: 'Done' })).toBeVisible()
  // The helmet is back, well within the time a lost start would be sent again: but nobody wants it any more.
  await demo(page, 'comeBack')
  await note(page).getByRole('button', { name: 'Reconnect' }).click()
  await expect(note(page)).toContainText('Reconnected to the demo helmet.')
  await page.waitForTimeout(1500)
  const state = await demo(page, 'state')
  expect([state.running, state.log.length]).toEqual([false, 0])
  await expect(main.getByText(/its program was not started/)).toBeVisible()
})

test('a guide run cut off by a reload: its helmet program can be stopped from the Guides page', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Guides')
  const main = page.getByRole('main')
  await main.locator('a[href="/app/guides/helmet-session-flow"]').first().click()
  await main.getByRole('button', { name: 'Start', exact: true }).click()
  await main.getByRole('button', { name: 'Begin' }).click()
  await advanceTo(page, 'The program')
  await expect(main.locator('p', { hasText: 'Helmet:' })).toContainText('running (blind)')
  page.once('dialog', (d) => d.accept()) // "Leave the page?"
  await page.goto('/app/guides')
  const offer = page.locator('[data-test=leftover-arm]')
  await expect(offer).toContainText('is still running on the helmet', { timeout: 15_000 })
  await expect(offer).toContainText('Blinded helmet session with questionnaires')
  await offer.getByRole('button', { name: 'Stop it' }).click()
  await expect(offer).toHaveCount(0, { timeout: 10_000 })
  await expect.poll(async () => (await demo(page, 'state')).running).toBe(false)
  await expect(main.getByText('unfinished').first()).toBeVisible()
})

async function pngs(page: Page, n: number) {
  const urls = await page.evaluate((count) => Array.from({ length: count }, (_, k) => {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 120
    const g = c.getContext('2d')!
    g.fillStyle = `hsl(${(k * 67) % 360} 70% 45%)`
    g.fillRect(0, 0, 160, 120)
    return c.toDataURL('image/png')
  }), n)
  return urls.map((u, k) => ({ name: `picture-${k + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(u.split(',')[1]!, 'base64') }))
}

test('an open trial shows its real state after a drop', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Trials')
  const main = page.getByRole('main')
  await page.getByRole('navigation', { name: 'Trials' }).getByRole('link', { name: 'Picture pool' }).click()
  await main.getByLabel('Set name').fill('Set 01')
  await main.locator('input[type=file][accept="image/*"]').setInputFiles(await pngs(page, 4))
  await main.getByRole('button', { name: 'Add to set' }).click()
  await expect(main.getByText('Set "set-01" now has 4 picture(s).')).toBeVisible()
  await page.getByRole('navigation', { name: 'Trials' }).getByRole('link', { name: 'Trials' }).click()

  // Creating it: the helmet makes the trial, the answer is lost. Found again, not made twice.
  await demo(page, 'dropAfter', 'trial.new')
  await main.getByRole('button', { name: 'Create trial' }).click()
  const card = main.locator('section[aria-label^="Trial "]')
  await expect(card.locator('[data-test=commitment]')).toHaveText(/^[0-9a-f]{64}$/, { timeout: 15_000 })
  await expect(card).toHaveAttribute('aria-label', 'Trial 1')
  await expect(note(page)).toContainText(/Reconnected/)
  await demo(page, 'pressStop') // the stimulation that came with it

  await card.getByLabel('Your impressions').fill('Round, warm, orange.')
  // The lock goes through on the helmet; the answer is lost.
  await demo(page, 'dropAfter', 'trial.lock')
  await card.getByRole('button', { name: 'Lock response' }).click()
  await expect(card.getByText('Connection lost. The trial waits on the helmet and continues when it is back.')).toBeVisible()
  // Back: the card shows what the helmet has, not "open".
  await expect(card.locator('[data-test=trial-state]')).toContainText('locked', { timeout: 15_000 })
  await expect(card.getByRole('button', { name: 'Show the pictures and rank them' })).toBeEnabled()
  await expect(card.getByText('Round, warm, orange.')).toBeVisible()
  // The response is kept per helmet: the same trial number on another helmet is not this one.
  const keys = await page.evaluate(() => new Promise<string[]>((resolve) => {
    const open = indexedDB.open('god-helmet')
    open.onsuccess = () => {
      const all = open.result.transaction('responses').objectStore('responses').getAllKeys()
      all.onsuccess = () => resolve(all.result.map(String))
    }
  }))
  expect(keys).toEqual(['id:DE3000000001#1'])
})

test('Helmet tab: unsaved edits survive a drop', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Helmet')
  const main = page.getByRole('main')
  const ch2 = main.getByLabel('CH2 µT/mA', { exact: true })
  await ch2.fill('2.05')
  const series = main.getByLabel('Series resistor (Ω)')
  await series.fill('3300')
  await demo(page, 'drop', 2500)
  await expect(note(page)).toContainText('Connection to the demo helmet lost. Reconnecting…')
  // The forms stay, with what was typed; saving waits for the helmet.
  await expect(ch2).toHaveValue('2.05')
  await expect(main.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Save calibration' })).toBeDisabled()
  await expect(main.getByText('No connection: your changes are kept, save them when the helmet is back.').first()).toBeVisible()
  await expect(note(page)).toHaveText('Reconnected to the demo helmet.', { timeout: 15_000 })
  await expect(ch2).toHaveValue('2.05')
  await expect(series).toHaveValue('3300')
  await expect(main.getByText('Not saved yet.').first()).toBeVisible()
  await main.getByRole('button', { name: 'Save calibration' }).click()
  await expect(page.getByText('Saved.').first()).toBeVisible()
  await tab(page, 'Log')
  await tab(page, 'Helmet')
  await expect(ch2).toHaveValue('2.05')
  await expect(series).toHaveValue('3300')
})

test('firmware without the new fields: a drop and a reconnect still pick the session up', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('godhelmet-demo-legacy', '1'))
  await demoWithSafety(page)
  await startSession(page)
  await demo(page, 'drop', 2500)
  await expect(pill(page)).toHaveAttribute('data-lost', 'true')
  await expect(note(page)).toHaveText(/Reconnected\. “God Helmet classic.*” is still running\./, { timeout: 15_000 })
  // It ends while the app cannot see it: said so afterwards, from what the helmet's status and log tell.
  await demo(page, 'drop', Infinity)
  await expect(pill(page)).toHaveAttribute('data-lost', 'true')
  await demo(page, 'pressStop')
  await demo(page, 'comeBack')
  await note(page).getByRole('button', { name: 'Reconnect' }).click()
  await expect(note(page)).toHaveText(/Reconnected\. “God Helmet classic.*” ended at \d.* while the connection was down: it was stopped with the helmet’s STOP button\./, { timeout: 20_000 })
  await expect(page.locator('[data-test=rating-prompt]')).toBeVisible()
})

test('with the keepalive on, the lost line says that the helmet stops the session by itself', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Helmet')
  const main = page.getByRole('main')
  await main.getByLabel('Stop if no app for (s, 0 = off)').fill('3')
  await main.getByRole('button', { name: 'Save settings' }).click()
  // The helmet's rule: 0, or 5 to 3600 s.
  await expect(main.getByLabel('Stop if no app for (s, 0 = off)')).toHaveValue('5')
  await tab(page, 'Programs')
  await startSession(page)
  await demo(page, 'drop', Infinity)
  await expect(note(page)).toContainText('The helmet stops “God Helmet classic (Persinger 2-phase)” by itself after 5 s without the app.')
  await expect(note(page)).toContainText('The helmet has stopped “God Helmet classic (Persinger 2-phase)” by now', { timeout: 15_000 })
  await demo(page, 'comeBack')
  await note(page).getByRole('button', { name: 'Reconnect' }).click()
  await expect(note(page)).toHaveText(/ended at \d.* while the connection was down: the helmet stopped it after 5 s without the app\.$/, { timeout: 15_000 })
})

test('the lost connection on a phone: the session, the line and its buttons fit @phone', async ({ page }) => {
  await demoWithSafety(page)
  await startSession(page)
  await demo(page, 'drop', Infinity)
  await expect(note(page)).toContainText('Connection to the demo helmet lost.')
  const row = page.getByRole('banner').locator('[data-test=session-pill]:visible')
  await expect(row).toHaveAttribute('data-lost', 'true')
  await expect(row.getByRole('button', { name: 'Stop' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await demo(page, 'comeBack')
  await note(page).getByRole('button', { name: 'Reconnect' }).click()
  await expect(note(page)).toContainText('is still running')
  await row.getByRole('button', { name: 'Stop' }).click()
})
