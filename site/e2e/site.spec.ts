// The public pages: landing page, articles, docs, search, old links, and that
// no link inside the site leads nowhere.
import { readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { DOCS, PROGRAM_REFERENCE, pathFor } from '../shared/content-meta'

const repo = new URL('../../', import.meta.url)
const ids = (dir: string) => new Set(readdirSync(new URL(dir, repo)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')))
const PROGRAMS = ids('presets/')
const GUIDES = ids('guides/')
const PAGES = ['/', '/articles', '/docs', pathFor(PROGRAM_REFERENCE), ...DOCS.map(pathFor)]

test('landing page: headline, live hero, numbers from the files', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A God Helmet')
  await expect(page.locator('section canvas').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try it in the demo' }).first()).toHaveAttribute('href', '/app/programs')
  const lib = await (await page.request.get('/library.json')).json()
  expect(lib.programs).toBe(PROGRAMS.size)
  expect(lib.guides).toBe(GUIDES.size)
  await page.getByRole('heading', { name: 'What you can do with it' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: `${PROGRAMS.size} programs` })).toBeVisible()
  expect(errors).toEqual([])
})

test('landing page on a phone @phone', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Nothing may be wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('articles: index, an article with its contents, links into the app', async ({ page }) => {
  await page.goto('/articles')
  for (const d of DOCS.filter((d) => d.section === 'articles')) await expect(page.getByRole('link', { name: new RegExp(d.label) }).first()).toBeVisible()
  await page.getByRole('link', { name: /Sensed presence/ }).first().click()
  await expect(page).toHaveURL('/articles/sensed-presence')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sensed presence')
  await expect(page.locator('aside').getByText('On this page').last()).toBeVisible()
  expect(await page.locator('.doc-body a[href^="/app/programs/"]').count()).toBeGreaterThan(3)
  // Links between documents were rewritten to site pages.
  await expect(page.locator('.doc-body a[href="/articles/research"]').first()).toBeAttached()
})

test('docs: figures load, the program reference lists every program', async ({ page }) => {
  await page.goto('/docs/wiring')
  const figure = page.locator('.doc-body figure img').first()
  await expect(figure).toBeVisible()
  expect(await figure.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

  await page.goto(`${pathFor(PROGRAM_REFERENCE)}#god-helmet-classic`)
  expect(await page.locator('details').count()).toBe(PROGRAMS.size)
  await expect(page.locator('details#god-helmet-classic')).toHaveAttribute('open', '')
})

test('search finds text inside the articles and docs', async ({ page }) => {
  await page.goto('/docs')
  const box = page.getByPlaceholder('Search articles, docs and programs…')
  // The button works once the page has come alive; until then a click is lost.
  await expect(async () => {
    await page.getByRole('button', { name: /search/i }).first().click()
    await expect(box).toBeVisible({ timeout: 1500 })
  }).toPass()
  // A word that is in no page title and none of the shortcut links.
  await box.fill('pacemaker')
  await expect(page.getByRole('option').filter({ hasText: /pacemaker/i }).first()).toBeVisible()
  await box.fill('Granqvist')
  await expect(page.getByRole('option').filter({ hasText: /Granqvist/ }).first()).toBeVisible()
})

test('a heading link on a page stays on the page', async ({ page }) => {
  // #safety and #programs are headings here, not the old app's tabs.
  await page.goto('/articles/out-of-body#safety')
  await expect(page).toHaveURL('/articles/out-of-body#safety')
  await page.goto('/docs/preset-format')
  await page.locator('aside a[href$="#placement"]').first().click()
  await expect(page).toHaveURL('/docs/preset-format#placement')
})

test('links to the old hash-routed app still arrive', async ({ page }) => {
  await page.goto('/#programs/god-helmet-classic/brain')
  await expect(page).toHaveURL('/app/programs/god-helmet-classic/brain')
  await page.goto('/#docs/wiring')
  await expect(page).toHaveURL('/docs/wiring')
  await page.goto('/#docs/effect_remote_viewing')
  await expect(page).toHaveURL('/articles/remote-viewing')
  // The old safety detour carried its way back as one encoded part.
  await page.goto('/#safety/programs%2Fgod-helmet-classic%2Fbrain')
  await expect(page).toHaveURL(/\/app\/safety\?back=/)
  expect(new URL(page.url()).searchParams.get('back')).toBe('/app/programs/god-helmet-classic/brain')
})

test('an unknown address answers 404, with a way on', async ({ page, request }) => {
  expect((await request.get('/no-such-page')).status()).toBe(404)
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('no page at this address')
  await page.getByRole('button', { name: 'Docs' }).click()
  await expect(page).toHaveURL('/docs')
})

test('pages ask for nothing of the app in advance', async ({ request }) => {
  // The app's program library is 1.9 MB; a reader of an article must not pay for it.
  for (const path of ['/', '/articles/sensed-presence', '/docs/wiring']) expect(await (await request.get(path)).text(), path).not.toContain('rel="prefetch"')
})

test('once visited, the site opens without a network', async ({ page, context, baseURL }) => {
  test.skip(!!process.env.E2E_BASE_URL, 'the service worker is only registered in the built site')
  await page.goto('/app/programs')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // A second visit goes through the service worker; opening the app makes it
  // fetch the rest of the app in the background.
  await page.goto('/docs/wiring')
  await page.goto('/app/programs/god-helmet-classic')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('God Helmet classic')
  await expect.poll(() => page.evaluate(async () => !!(await caches.match('/__app-ready'))), { timeout: 30_000 }).toBe(true)
  await context.setOffline(true)
  // A screen that was never opened while online.
  await page.goto(`${baseURL}/app/log`)
  await expect(page.getByRole('heading', { level: 1, name: 'Session log' })).toBeVisible()
  await page.goto(`${baseURL}/app/guides/gateway-prep`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gateway 1')
  await page.goto(`${baseURL}/docs/wiring`)
  await expect(page.getByRole('heading', { level: 1, name: 'Wiring' })).toBeVisible()
  // Firmware files are never kept: offline, the installer must not find a stale copy.
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat())
  expect(cached.some((p) => p.startsWith('/firmware/'))).toBe(false)
  expect(cached).toContain('/200')
})

test('the theme can be set to night', async ({ page }) => {
  await page.goto('/articles')
  await page.getByRole('button', { name: /Theme/ }).click()
  await page.getByRole('menuitemcheckbox', { name: /Night/ }).click()
  await expect(page.locator('html')).toHaveClass(/night/)
})

test('no link inside the site leads nowhere', async ({ request }) => {
  test.setTimeout(120_000)
  const html = new Map<string, string>()
  for (const p of PAGES) {
    const res = await request.get(p)
    expect(res.status(), p).toBe(200)
    html.set(p, await res.text())
  }
  const idsOf = (doc: string) => new Set([...doc.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
  const problems: string[] = []
  for (const [from, doc] of html) {
    for (const [, href] of doc.matchAll(/<a\s[^>]*?href="([^"]+)"/g)) {
      const link = href!.replace(/&amp;/g, '&')
      if (!link.startsWith('/') && !link.startsWith('#')) continue
      const [path, frag] = link.split('#') as [string, string | undefined]
      const target = (path || from).split('?')[0]!
      if (target.startsWith('/app')) {
        const [, , tab, id] = target.split('/')
        if (tab === 'programs' && id && !PROGRAMS.has(decodeURIComponent(id))) problems.push(`${from}: no program "${id}"`)
        if (tab === 'guides' && id && !GUIDES.has(decodeURIComponent(id))) problems.push(`${from}: no guide "${id}"`)
        continue
      }
      if (!html.has(target)) {
        if (/\.(json|xml|svg|png|txt)$/.test(target)) continue
        problems.push(`${from}: ${link} is not a page`)
        continue
      }
      if (frag && !idsOf(html.get(target)!).has(decodeURIComponent(frag))) problems.push(`${from}: ${link} has no such heading`)
    }
  }
  expect(problems).toEqual([])
})
