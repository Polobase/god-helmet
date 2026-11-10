import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appPathFromHash, resolveDocHref, REPO } from '../shared/links'
import { DOCS, pathFor, pathForOldSlug } from '../shared/content-meta'

describe('old hash routes', () => {
  it('maps the app tabs', () => {
    expect(appPathFromHash('#programs')).toBe('/app/programs')
    expect(appPathFromHash('#programs/god-helmet-classic')).toBe('/app/programs/god-helmet-classic')
    expect(appPathFromHash('#programs/obe/brain')).toBe('/app/programs/obe/brain')
    expect(appPathFromHash('#guides/enrollment')).toBe('/app/guides/enrollment')
    expect(appPathFromHash('#trials')).toBe('/app/trials')
    expect(appPathFromHash('#trials/pictures')).toBe('/app/trials/pictures')
    expect(appPathFromHash('#log')).toBe('/app/log')
    expect(appPathFromHash('#helmet')).toBe('/app/helmet')
  })

  it('maps the routes older than the six tabs', () => {
    expect(appPathFromHash('#brain/obe')).toBe('/app/programs/obe/brain')
    expect(appPathFromHash('#placement', { lastProgram: () => 'shiva' })).toBe('/app/programs/shiva/placement')
    expect(appPathFromHash('#placement')).toBe('/app/programs/god-helmet-classic/placement')
    expect(appPathFromHash('#experiment')).toBe('/app/trials')
    expect(appPathFromHash('#targets')).toBe('/app/trials/pictures')
    expect(appPathFromHash('#setup')).toBe('/app/helmet')
  })

  it('maps the Docs tab to articles and docs', () => {
    expect(appPathFromHash('#docs')).toBe('/docs')
    expect(appPathFromHash('#docs/readme')).toBe('/docs/overview')
    expect(appPathFromHash('#docs/effect_sensed_presence')).toBe('/articles/sensed-presence')
    expect(appPathFromHash('#docs/programs')).toBe('/docs/programs')
    expect(appPathFromHash('#docs/nothing')).toBe('/docs')
  })

  it('keeps the way back from the safety page', () => {
    expect(appPathFromHash('#safety')).toBe('/app/safety')
    expect(appPathFromHash('#safety/trials')).toBe('/app/safety?back=%2Fapp%2Ftrials')
    expect(appPathFromHash(`#safety/${encodeURIComponent('programs/obe/placement')}`)).toBe('/app/safety?back=%2Fapp%2Fprograms%2Fobe%2Fplacement')
  })

  it('leaves in-page anchors alone', () => {
    expect(appPathFromHash('#requests-and-responses')).toBeNull()
    expect(appPathFromHash('#safety-rules')).toBeNull()
    expect(appPathFromHash('')).toBeNull()
  })
})

describe('links in the Markdown', () => {
  const from = 'docs/EFFECT_SENSED_PRESENCE.md'

  it('other documents become site pages', () => {
    expect(resolveDocHref('RESEARCH.md', from)).toEqual({ href: '/articles/research', external: false })
    expect(resolveDocHref('SAFETY.md', from)).toEqual({ href: '/docs/safety', external: false })
    expect(resolveDocHref('docs/WIRING.md', 'README.md').href).toBe('/docs/wiring')
    expect(resolveDocHref('../README.md', from).href).toBe('/docs/overview')
    expect(resolveDocHref('../hardware/BOM.md', from).href).toBe('/docs/parts')
  })

  it('also when the parser has already dropped ".md"', () => {
    expect(resolveDocHref('RESEARCH', from).href).toBe('/articles/research')
    expect(resolveDocHref('docs/SAFETY', 'README.md').href).toBe('/docs/safety')
    expect(resolveDocHref('WIRING#esp32-32e-28-display-board', 'docs/STANDALONE.md').href).toBe('/docs/wiring#esp32-32e-28-display-board')
  })

  it('keeps the heading', () => {
    expect(resolveDocHref('WIRING.md#esp32-32e-28-display-board', 'docs/STANDALONE.md').href).toBe('/docs/wiring#esp32-32e-28-display-board')
    expect(resolveDocHref('#requests-and-responses', 'docs/BLE_PROTOCOL.md')).toEqual({ href: '#requests-and-responses', external: false })
  })

  it('app links written as hashes open the app', () => {
    expect(resolveDocHref('#programs/god-helmet-classic/brain', from).href).toBe('/app/programs/god-helmet-classic/brain')
    expect(resolveDocHref('#guides/enrollment', from).href).toBe('/app/guides/enrollment')
    expect(resolveDocHref('#trials/pictures', from).href).toBe('/app/trials/pictures')
  })

  it('other repository files go to GitHub', () => {
    expect(resolveDocHref('../presets/koren.json', 'docs/HISTORY.md')).toEqual({ href: `${REPO}/blob/main/presets/koren.json`, external: true })
    expect(resolveDocHref('presets', 'README.md')).toEqual({ href: `${REPO}/tree/main/presets`, external: true })
  })

  it('leaves web and mail links alone', () => {
    expect(resolveDocHref('https://doi.org/10.1016/S0304-3940(01)02331-0', from)).toEqual({ href: 'https://doi.org/10.1016/S0304-3940(01)02331-0', external: true })
    expect(resolveDocHref('mailto:someone@example.org', from).external).toBe(false)
  })
})

describe('the list of documents', () => {
  it('gives every Markdown document of the repository a place on the site', () => {
    const repo = new URL('../../', import.meta.url)
    const found = [
      'README.md',
      ...readdirSync(new URL('docs/', repo)).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`),
      ...readdirSync(new URL('hardware/', repo)).filter((f) => f.endsWith('.md')).map((f) => `hardware/${f}`),
    ]
    expect(DOCS.map((d) => d.file).sort()).toEqual(found.sort())
  })

  it('has unique slugs per section and unique files', () => {
    const paths = DOCS.map(pathFor)
    expect(new Set(paths).size).toBe(paths.length)
    expect(new Set(DOCS.map((d) => d.file)).size).toBe(DOCS.length)
    expect(paths).not.toContain('/docs/programs') // taken by the generated program reference
  })

  it('still answers every slug of the old Docs tab', () => {
    const old = ['readme', 'research', 'history', 'effect_sensed_presence', 'effect_out_of_body', 'effect_remote_viewing', 'signals', 'programs',
      'preset_format', 'brain_view', 'placement', 'guides', 'questionnaires', 'experiments', 'wiring', 'standalone', 'calibration', 'safety', 'ble_protocol', 'bom']
    for (const slug of old) expect(pathForOldSlug(slug), slug).toBeTruthy()
  })
})
