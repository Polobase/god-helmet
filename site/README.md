# God Helmet: the site

The landing page, the articles and docs, and the control app, as one Nuxt site. It replaces `webapp/` once it has been checked on a real helmet; until then both exist, and this site uses the old app's engine, protocol and library code directly (`#core` = `../webapp/src`), so the two cannot drift apart.

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
npm test           # unit tests: link rewriting, the list of documents
npm run test:e2e   # the built site in a headless browser, in Demo mode (run `npm run build` first)
(cd ../webapp && npm test)   # the shared core: engine parity with the firmware, protocol, guides
```

`npm run test:e2e` needs Playwright's Chromium (`npx playwright install chromium`), or `PW_CHROMIUM=/path/to/chromium` to use one that is already there.

To see what the app does when the connection fails, connect the demo and use its hooks in the browser console: `__helmetDemo.drop(5000)`, `__helmetDemo.restart()`, `__helmetDemo.dropAfter('session.start')` and the others described at the top of `../webapp/src/ble/demo.js`. `e2e/link.spec.ts` does the same.

## Where things are

| | |
|---|---|
| `app/pages/index.vue`, `app/components/home/` | landing page |
| `app/pages/articles/`, `app/pages/docs/` | articles and docs, rendered from `../docs/*.md`, `../README.md`, `../hardware/BOM.md` |
| `shared/content-meta.ts` | which Markdown file is which page (section, address, description); a new file must be listed here |
| `shared/links.ts`, `modules/repo-docs.ts` | links written for GitHub and for the old app, rewritten for the site |
| `app/pages/app/`, `app/components/{app,program,placement,brain,guide,trial,helmet,log}/` | the control app (client-only) |
| `app/lib/` | typed front doors to the shared JavaScript core, and the state that outlives a page change |
| `app/assets/css/main.css`, `app/app.config.ts` | the design: colours, type, the four themes |
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
| `NUXT_PUBLIC_FIRMWARE_BASE` | where the installer finds the firmware images. Cloudflare's builder cannot build firmware, so this points at the copies the old app's Pages workflow publishes (`…github.io/god-helmet/firmware`) |

`.github/workflows/site.yml` runs the tests on every push; it does not publish.

The public address of the site, once it has one, goes in `NUXT_PUBLIC_SITE_URL` (canonical links, share image, sitemap).
