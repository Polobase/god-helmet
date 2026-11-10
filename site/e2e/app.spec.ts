// The control app in Demo mode (the helmet's engine in the browser, nothing
// switched on): one pass through every tab's main job.
import { expect, test, type Page } from '@playwright/test'

const PROGRAM = '/app/programs/god-helmet-classic'

/** Connects the demo helmet and accepts the safety page, as a first-time user would. */
async function demoWithSafety(page: Page) {
  await page.goto('/app/safety')
  await page.getByRole('main').getByRole('button', { name: 'Demo' }).click()
  await page.getByRole('checkbox', { name: /I have read this/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL('/app/programs')
}

/** Moves between tabs without reloading: the demo's connection lives in the page. */
// (The Guides tab's name grows by "guide running" while one runs: match the start.)
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(`^${name}`) }).click()

async function pngs(page: Page, n: number) {
  const urls = await page.evaluate((count) => Array.from({ length: count }, (_, k) => {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 120
    const g = c.getContext('2d')!
    g.fillStyle = `hsl(${(k * 67) % 360} 70% 45%)`
    g.fillRect(0, 0, 160, 120)
    g.fillStyle = `hsl(${(k * 67 + 180) % 360} 80% 70%)`
    g.beginPath()
    g.arc(40 + k * 20, 60, 14 + 4 * k, 0, 7)
    g.fill()
    return c.toDataURL('image/png')
  }), n)
  return urls.map((u, k) => ({ name: `picture-${k + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(u.split(',')[1]!, 'base64') }))
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  test.info().annotations.push({ type: 'errors', description: '' })
  page.on('close', () => expect(errors, 'uncaught errors in the page').toEqual([]))
})

test('a blind session: find a program, start it, stop it, rate it, see what it was', async ({ page }) => {
  await page.goto('/app/programs')
  const main = page.getByRole('main')
  await main.getByPlaceholder('Search programs, sites, brain regions…').fill('god helmet classic')
  await main.locator(`a[href="${PROGRAM}"]`).first().click()
  await expect(main.getByRole('heading', { level: 1 })).toContainText('God Helmet classic')

  // The Start panel says what is missing, and leads through it.
  await main.getByRole('button', { name: 'Start…' }).first().click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Demo' }).click()
  await panel.getByRole('button', { name: 'Read the safety page' }).click()
  await expect(page).toHaveURL(/\/app\/safety\?back=/)
  await page.getByRole('checkbox', { name: /I have read this/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(PROGRAM)

  await panel.getByRole('checkbox', { name: /Blind/ }).click()
  await panel.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(main.getByText('Session running, blind')).toBeVisible()
  await expect(main.getByText('Blind session: coil activity is hidden.')).toBeVisible()

  // The session shows on every tab, and can be stopped from the header.
  await tab(page, 'Log')
  await page.getByRole('banner').getByRole('button', { name: 'Stop', exact: true }).first().click()
  const rate = main.getByRole('button', { name: /^Rate / }).first()
  await rate.click({ timeout: 10_000 })
  await main.getByRole('button', { name: 'Save rating' }).click()
  await expect(page.getByText(/This blind session was (sham|active)\./).first()).toBeVisible()
  await expect(main.locator('table tbody tr.entry').first()).toContainText(/sham|active/)

  const [download] = await Promise.all([page.waitForEvent('download'), main.getByRole('button', { name: 'Export JSON' }).click()])
  expect(download.suggestedFilename()).toBe('godhelmet-sessions.json')
})

test('a program\'s pages: placement ticks, the brain, sources, and a reload on a deep link', async ({ page }) => {
  await page.goto(`${PROGRAM}/placement`)
  const main = page.getByRole('main')
  const subnav = main.getByRole('navigation', { name: 'Program sections' }).first()
  await expect(subnav.getByRole('link', { name: /Placement/ })).toContainText('0/8')
  await main.getByRole('checkbox').first().check()
  await expect(subnav.getByRole('link', { name: /Placement/ })).toContainText('1/8')

  await subnav.getByRole('link', { name: 'Brain' }).click()
  await expect(page).toHaveURL(`${PROGRAM}/brain`)
  await expect(main.getByRole('heading', { name: 'What this program aims at' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Peak', exact: true })).toBeVisible()
  // Coming back, the tick is still there (kept until the page reloads).
  await subnav.getByRole('link', { name: /Placement/ }).click()
  await expect(subnav.getByRole('link', { name: /Placement/ })).toContainText('1/8')

  await page.goto(`${PROGRAM}/sources`)
  await expect(main.getByRole('heading', { name: /Sources/ })).toBeVisible()
  expect(await main.locator('section li a').count()).toBeGreaterThan(3)
  await page.reload()
  await expect(page).toHaveURL(`${PROGRAM}/sources`)
  await expect(main.getByRole('heading', { level: 1 })).toContainText('God Helmet classic')
})

test('the library can be browsed by placement, site and experience', async ({ page }) => {
  await page.goto('/app/programs')
  const main = page.getByRole('main')
  const modes = main.getByRole('tablist').first()
  await modes.getByRole('tab', { name: 'Placement' }).click()
  await expect(main.getByText(/\d+ of \d+ placements/)).toBeVisible()
  await modes.getByRole('tab', { name: 'Site' }).click()
  await expect(main.getByText('Tap any site to see how to find it')).toBeVisible()
  await modes.getByRole('tab', { name: 'Experience' }).click()
  await expect(main.getByRole('table').first()).toBeVisible()
  await page.goto('/app/programs/no-such-program')
  await expect(main.getByText('No program called “no-such-program”.')).toBeVisible()
})

test('a remote-viewing trial from the picture pool to the three checks', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Trials')
  const main = page.getByRole('main')
  await page.getByRole('navigation', { name: 'Trials' }).getByRole('link', { name: 'Picture pool' }).click()
  await main.getByLabel('Set name').fill('Set 01')
  await main.locator('input[type=file][accept="image/*"]').setInputFiles(await pngs(page, 4))
  await main.getByRole('button', { name: 'Add to set' }).click()
  await expect(main.getByText('Set "set-01" now has 4 picture(s).')).toBeVisible()

  await page.getByRole('navigation', { name: 'Trials' }).getByRole('link', { name: 'Trials' }).click()
  await main.getByRole('button', { name: 'Create trial' }).click()
  const card = main.locator('section[aria-label^="Trial "]')
  await expect(card.locator('[data-test=commitment]')).toHaveText(/^[0-9a-f]{64}$/)
  await card.getByLabel('Your impressions').fill('Round, warm, orange. A tall thin shape to the left.')
  await card.getByRole('button', { name: 'Lock response' }).click()
  await card.getByRole('button', { name: 'Show the pictures and rank them' }).click()
  for (let i = 0; i < 4; i++) {
    await card.getByRole('combobox', { name: `Rank for picture ${i + 1}` }).click()
    await page.getByRole('option', { name: i === 0 ? '1 (best)' : String(i + 1), exact: true }).click()
  }
  await card.getByRole('button', { name: 'Submit ranks' }).click()
  await card.getByRole('button', { name: 'Reveal' }).click()
  await expect(card.locator('[data-test=verdict]')).toBeVisible()
  for (const check of ['commitment', 'pool', 'response']) await expect(card.locator(`[data-test=check-${check}]`)).toHaveAttribute('data-ok', 'true')

  const [download] = await Promise.all([page.waitForEvent('download'), main.getByRole('button', { name: /Export trials/ }).click()])
  expect(download.suggestedFilename()).toBe('godhelmet-trials.json')
})

test('the Helmet tab: a calibration value is saved on the helmet', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Helmet')
  const main = page.getByRole('main')
  for (const h of ['Calibration', 'Wiring check', 'Settings', 'Environment', 'Install the firmware']) await expect(main.getByRole('heading', { name: h, exact: true })).toBeVisible()
  const ch2 = main.getByLabel('CH2 µT/mA', { exact: true })
  await ch2.fill('2.05')
  await main.getByRole('button', { name: 'Save calibration' }).click()
  // The demo helmet keeps its settings: leave, come back, and it is still there.
  await tab(page, 'Log')
  await tab(page, 'Helmet')
  await expect(ch2).toHaveValue('2.05')
})

/** Starts the open guide and presses on through every step to its summary. */
async function runGuide(page: Page) {
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Start', exact: true }).click()
  await main.getByRole('button', { name: 'Begin' }).click()
  for (let i = 0; i < 80; i++) {
    if (await main.getByRole('button', { name: 'Done' }).isVisible()) return
    const leave = main.getByRole('button', { name: 'Leave step' })
    if (await leave.isVisible()) await leave.click()
    else await main.getByRole('button', { name: /^(Next|Skip step|Finish)$/ }).first().click()
    // The runner ignores a second tap within 700 ms.
    await page.waitForTimeout(800)
  }
  throw new Error('the guide did not reach its summary')
}

test('a guide with sound runs to its summary, is kept, and can be exported', async ({ page }) => {
  await page.goto('/app/guides')
  const main = page.getByRole('main')
  await main.getByPlaceholder('Search by name or description').fill('nap')
  await main.locator('a[href="/app/guides/gateway-nap"]').first().click()
  await expect(main.getByRole('heading', { level: 1 })).toContainText('Nap')
  await main.getByRole('checkbox', { name: /headphones/ }).click()
  await runGuide(page)
  // While it ran, the tab showed a dot; now it is gone and the run is stored.
  await main.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('img')).toHaveCount(0)
  await tab(page, 'Guides')
  await tab(page, 'Guides')
  await expect(page).toHaveURL('/app/guides')
  const [download] = await Promise.all([page.waitForEvent('download'), main.getByRole('button', { name: /Export/ }).first().click()])
  expect(download.suggestedFilename()).toBe('godhelmet-guide-runs.json')
})

test('a guide with a blinded helmet arm starts the helmet and reveals after the rating', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Guides')
  const main = page.getByRole('main')
  await main.locator('a[href="/app/guides/helmet-session-flow"]').first().click()
  await runGuide(page)
  await expect(main.getByRole('button', { name: 'Done' })).toBeVisible()
})

test('unsaved calibration values survive the end of a test', async ({ page }) => {
  await demoWithSafety(page)
  await tab(page, 'Helmet')
  const main = page.getByRole('main')
  const cal = main.getByRole('region', { name: 'Calibration' })
  await cal.getByLabel('Seconds', { exact: true }).fill('5')
  await cal.getByRole('button', { name: 'Start DC test' }).click()
  await expect(cal.getByText(/DC test CH1/)).toBeVisible()
  const ch1 = main.getByLabel('CH1 µT/mA', { exact: true })
  await ch1.fill('0.45')
  // The test ends by itself; what was typed but not saved must still be there.
  await expect(cal.getByText(/DC test CH1/)).toHaveCount(0, { timeout: 15_000 })
  await page.waitForTimeout(1500)
  await expect(ch1).toHaveValue('0.45')
})

test('a blind guide run cannot be opened or revealed from the run list while it runs', async ({ page }) => {
  await page.goto('/app/guides/gateway-prep')
  const main = page.getByRole('main')
  await main.getByRole('checkbox', { name: /headphones/ }).click()
  await main.getByRole('button', { name: 'Start', exact: true }).click()
  await main.getByRole('checkbox', { name: /Blind audio/ }).click()
  await main.getByRole('button', { name: 'Begin' }).click()
  await expect(main.getByText(/Step 1 of/).first()).toBeVisible()
  // The library, with the run still going: it says so, and lists no run to reveal.
  await tab(page, 'Guides')
  await tab(page, 'Guides')
  await expect(page).toHaveURL('/app/guides')
  await expect(main.getByText(/is running/).first()).toBeVisible()
  await expect(main.getByText('No runs yet.')).toBeVisible()
  await expect(main.getByRole('button', { name: /reveal/i })).toHaveCount(0)
})

test('Switch program offers every program, and keeps the open page', async ({ page }) => {
  await page.goto(`${PROGRAM}/sources`)
  await page.getByRole('button', { name: 'Switch program' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder(/Search programs/).fill('shakti')
  expect(await dialog.getByRole('option').count()).toBeGreaterThan(20)
  await dialog.getByPlaceholder(/Search programs/).fill('thomas pulse')
  await dialog.getByRole('option').first().click()
  await expect(page).toHaveURL(/\/app\/programs\/[^/]+\/sources$/)
  await expect(page).not.toHaveURL(`${PROGRAM}/sources`)
})

test('every category in the two libraries has its mark, and the empty pages theirs', async ({ page }) => {
  const main = page.getByRole('main')
  for (const path of ['/app/programs', '/app/guides']) {
    await page.goto(path)
    const groups = main.locator('section[aria-label] h2')
    await expect(groups.first()).toBeVisible()
    const n = await groups.count()
    expect(n, path).toBeGreaterThan(5)
    await expect(main.locator('section[aria-label] h2 svg[data-mark]'), path).toHaveCount(n)
  }
  // Decoration: a mark has no name of its own and is hidden from screen readers.
  await expect(main.locator('h2 svg[data-mark]').first()).toHaveAttribute('aria-hidden', 'true')
  await page.goto('/app/log')
  await expect(main.locator('svg[data-mark="unplugged"]')).toBeVisible()
  await main.getByRole('button', { name: 'Demo' }).click()
  await expect(main.locator('svg[data-mark="notebook"]')).toBeVisible()
  await tab(page, 'Trials')
  await expect(main.locator('svg[data-mark="remote-viewing"]')).toBeVisible()
  await expect(main.locator('svg[data-mark="envelope"]')).toBeVisible()
})

test('a drawing in the app stands still while the helmet runs a session', async ({ page }) => {
  await demoWithSafety(page)
  const main = page.getByRole('main')
  await main.getByPlaceholder('Search programs, sites, brain regions…').fill('obe')
  await main.locator('a[href="/app/programs/obe"]').first().click()
  // The out-of-body programs show the out-of-body scene beside their summary.
  const scene = main.locator('svg[data-scene="obe"]')
  await expect(scene).toHaveAttribute('data-art', 'run')
  await main.getByRole('button', { name: 'Start…' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click()
  await expect(main.getByText(/Session running/).first()).toBeVisible()
  // (The panel of the running session pushes the scene down the page.)
  await scene.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await expect(scene).not.toHaveAttribute('data-art')
  await page.getByRole('banner').getByRole('button', { name: 'Stop', exact: true }).first().click()
  await expect(main.getByText(/Session running/)).toHaveCount(0, { timeout: 15_000 })
  await scene.scrollIntoViewIfNeeded()
  await expect(scene).toHaveAttribute('data-art', 'run')
})

test('units and themes apply everywhere', async ({ page }) => {
  await page.goto(PROGRAM)
  const header = page.getByRole('banner')
  await expect(page.getByRole('main').getByText('µT').first()).toBeVisible()
  await header.getByRole('button', { name: 'mG (gauss)' }).click()
  await expect(page.getByRole('main').locator('dl').first()).toContainText('mG')
  await header.getByRole('button', { name: /Theme/ }).click()
  await page.getByRole('menuitemcheckbox', { name: /Night/ }).click()
  await expect(page.locator('html')).toHaveClass(/night/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/night/)
  await expect(page.getByRole('main').locator('dl').first()).toContainText('mG')
})

test('the app fits a phone @phone', async ({ page }) => {
  for (const path of ['/app/programs', PROGRAM, `${PROGRAM}/placement`, '/app/trials', '/app/log', '/app/helmet', '/app/guides']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} is wider than the screen`).toBe(true)
  }
})
