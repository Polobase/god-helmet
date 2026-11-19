# God Helmet: the site

The landing page, the articles and docs, and the control app, as one Nuxt site. It replaced the Vue app that lived in `webapp/` (removed in November 2026; `PARITY.md` lists where each of its parts went). That app's engine, protocol and library code is now `core/` (plain JavaScript, imported as `#core`): the code the firmware's C++ engine is tested against.

```sh
npm install
npm run dev        # http://localhost:3000 (Web Bluetooth and Web Serial work on localhost)
npm run build      # static site in .output/public
npm run preview    # serves the build the way the host will: http://localhost:43117
```

Everything in the app can be tried without hardware: press **Demo**.

## Checks

```sh
npm run lint
npm run typecheck
npm test           # unit tests: the shared core (engine parity with the firmware, protocol, guides), every program file, link rewriting
npm run test:e2e   # the built site in a headless browser, in Demo mode (run `npm run build` first)
npm run check-presets        # every program file, with warnings (docs/PRESET_FORMAT.md)
```

`npm run test:e2e` needs Playwright's Chromium (`npx playwright install chromium`), or `PW_CHROMIUM=/path/to/chromium` to use one that is already there.

To see what the app does when the connection fails, connect the demo and use its hooks in the browser console: `__helmetDemo.drop(5000)`, `__helmetDemo.restart()`, `__helmetDemo.dropAfter('session.start')` and the others described at the top of `core/ble/demo.js`. `e2e/link.spec.ts` does the same.

## Where things are

| | |
|---|---|
| `app/pages/index.vue`, `app/components/home/` | landing page |
| `app/pages/articles/`, `app/pages/docs/` | articles and docs, rendered from `../docs/*.md`, `../README.md`, `../hardware/BOM.md` |
| `shared/content-meta.ts` | which Markdown file is which page (section, address, description); a new file must be listed here |
| `shared/links.ts`, `modules/repo-docs.ts` | links written for GitHub and for the old app, rewritten for the site |
| `app/pages/app/`, `app/components/{app,program,placement,brain,guide,trial,helmet,log}/` | the control app (client-only) |
| `app/lib/` | typed front doors to the shared JavaScript core, and the state that outlives a page change |
| `core/` | the shared JavaScript core: signal engine, field model, Bluetooth and USB protocol, guides, placement. `test/*.test.js` checks it, `test/engine.test.js` against the firmware's C++ engine |
| `scripts/` | command-line tools: `check-preset.mjs` (program files), `table.mjs` (pulse tables), `sd-pack.mjs` (SD card for the display board), `serve.mjs` (preview server) |
| `app/assets/css/main.css`, `app/app.config.ts` | the design: colours, type, the four themes |
| `app/components/art/`, `app/lib/art.ts` | the illustrations: large scenes (`<ArtScene name="obe" />`) and small marks (`<ArtMark name="sleep" />`) drawn from one kit of parts, and which one stands for which page, category or guide |
| `public/_redirects`, `public/_headers` | Cloudflare Pages: `/app/*` is one client-only shell |
| `server/routes/` | files written at build time: search index, library counts, service worker, sitemap |
| `PARITY.md` | every element of the old app and where it is now |

Firmware images for the installer (`public/firmware/`) are not in git: `../firmware/scripts/web_bundle.sh site/public/firmware` builds them for a local copy.

## Publishing

Cloudflare Pages is connected to the repository and builds this folder on every push: root directory `site`, build command `npm run build`, output `.output/public`. `main` is production; other branches get a preview address. Set in the Pages project:

| Variable | Value |
|---|---|
| `NODE_VERSION` | `24` |
| `NUXT_PUBLIC_SITE_URL` | the public address (canonical links, sitemap) |
| `NUXT_PUBLIC_FIRMWARE_BASE` | where the installer finds the firmware images. Cloudflare's builder cannot build firmware, so this points at the copies the Pages workflow publishes (`…github.io/god-helmet/firmware`) |

`.github/workflows/site.yml` runs the tests on every push; it does not publish.

The public address of the site, once it has one, goes in `NUXT_PUBLIC_SITE_URL` (canonical links, share image, sitemap).
