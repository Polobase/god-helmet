# Parity list: old app → new site

Every element of the app in `webapp/` and where it lives in `site/`. Nothing is dropped; things may be folded or moved.
The old app stays in the repository until this list has been checked on a real helmet (see "Not checked").

Status: **done** = built and exercised in a browser in Demo mode · **built** = written, but the situation it handles could not be produced in the demo.

Last updated: 2026-11-10.

## Routes

| Old (hash) | New | Status |
|---|---|---|
| `#programs` | `/app/programs` (Category, Placement, Site, Experience) | done |
| `#programs/<id>` | `/app/programs/<id>` | done |
| `#programs/<id>/placement`, `/brain`, `/sources` | `/app/programs/<id>/placement`, `/brain`, `/sources` | done |
| `#guides`, `#guides/<id>` | `/app/guides`, `/app/guides/<id>` | done |
| `#trials`, `#trials/pictures` | `/app/trials`, `/app/trials/pictures` | done |
| `#log` | `/app/log` | done |
| `#helmet` | `/app/helmet` | done |
| `#safety/<return-route>` | `/app/safety?back=<path>` | done |
| `#docs/<slug>` | `/articles/<slug>` or `/docs/<slug>` | done |
| `#docs/programs` (generated reference) | `/docs/programs` | done |
| Old links, including `#placement`, `#brain`, `#experiment`, `#targets`, `#setup` | forwarded when they arrive at `/` (`middleware/legacy-hash.global.ts`) | done (unit and browser tests) |
| An unknown route (old: Programs; an unknown sub-page: the program's overview) | same, by redirect; outside the app a designed "no page at this address" | done |
| Tab memory: a tab returns to its last place; pressed again, to its start | `composables/useAppNav.ts` | done |
| Library scroll position restored on return (programs and guides) | the library pages | done |
| Moving between a program's sub-pages keeps the scroll position; switching program keeps the open sub-page and its state | `pages/app/programs/[id].vue` | done |

## Header and shell

| Element | New location | Status |
|---|---|---|
| Brand mark and name | `BrandWordmark` | done |
| Tab bar (scrolls on phones, keeps the open tab in view) | `AppHeader` | done |
| Guides tab: running / paused dot | `AppHeader`, from `guideState` | done |
| Docs tab | link to `/docs` (public pages, same site; the connection and a running session survive the change) | done |
| Session pill: name, time left, Stop | `AppSessionPill`, also in the site header; it stays while the connection is down (see "When the connection fails") | done |
| Live panel as a drop-down on every tab but Programs | `AppHeader` + `AppLivePanel` | done |
| Connect: Bluetooth / USB (if Web Serial) / Demo; device chip; Disconnect hidden while running | `AppConnect`; while the connection is down the chip turns amber and gets Reconnect | done (Demo; Bluetooth and USB need a helmet) |
| µT / mG unit toggle | `UnitToggle` | done |
| Theme: Auto, Dark, Light, Night | `ThemeMenu`, `useTheme` | done |
| Phone menu: connection, unit, theme in one menu | `AppHeader` popover | done |
| Notices: device error; no Web Bluetooth and no Web Serial; USB safety (laptop on battery only); accept the safety page | `AppNotices`, with one line about the connection on top (lost, reconnecting, what was found) | done (accept safety, the connection line); built (the other three need a browser or helmet state the demo does not produce) |
| Toasts at the bottom centre | `UApp` toaster | done |

## Programs

| Element | Status |
|---|---|
| Library: live panel and rating prompt at the top, counts, four browse modes | done |
| Category: word search, evidence select with counts, category chips with counts, 3 cards per group with "Show all N", ranked list on search, Clear filters, empty state, "No program called …" | done |
| Placement: lobe chips, gallery with thumbnails, expand to basis and programs, 12 most used / Show all | done |
| Site: explorer (Top / Left / Right, search, zone chips, site card), table of charted sites | done |
| Experience: experience → region → program table with filter | done |
| Program header: All programs, Switch program (search over all programs, keeps the sub-page), category, evidence, title, readouts, Start…, coil mark live with the preview or session, sub-pages with badges, slim sticky bar, phone Start bar | done |
| Overview: summary, origin, phase timeline, phase detail with waveform, head map with preview, Setting and Schedule, "Aims at" → Brain, Notes | done |
| Placement: kind, name, chips, view switch, clickable coils, checklist with ticks / Reset / details / tape directions, site card in a side sheet, folds (Measure your head, Programs with this placement, Preparing and mounting the coils) | done |
| Brain: six views, Peak / RMS, phase chips, what-if intensity, Live with speed, four toggles, pick a point, legend, targets, Regions by field, Coils table, How this is computed | done (software WebGL; not seen on a real GPU or phone) |
| Sources: evidence, source list with extra links, Persinger / Murphy caveat | done |
| Start panel: readiness rows with their actions, intensity capped by the helmet, Blind, too-soon confirmation, Start, safety detour and back with the panel still open | done ("Start anyway" built: the demo's clock makes it hard to trigger) |
| Live panel: name, phase, time left, head map (hidden when blind), progress, intensity during a session, Skip, Stop; then the rating that reveals real or sham | done |

## Safety

| Element | Status |
|---|---|
| Text: contraindications and rules, word for word, field range in the chosen unit | done |
| "Continue takes you back to …", accept, Continue (`settings.set`), return to where you were | done |
| Connect when disconnected (now Bluetooth, USB and Demo) | done |

## Guides

| Element | Status |
|---|---|
| Library: search, category chips, "Needs headphones" / "Uses the helmet", cards with minutes, evidence and requirement icons, past runs | done |
| A run in progress: notice in the library with the way back; the run is not in the run lists until it is closed | done |
| Detail: setting, cautions, when to try, "Before you start" checklist, headphones, connect, helmet-arm note, Start, steps outline, sources, this guide's runs | done |
| Set-up: audio mode, level (capped at −6 dB), Test sound, blind audio, helmet section, Begin / Back | done (sound not heard: headless) |
| Running: title, instructions, timer and progress, Pause / Resume, Next / Skip step / Finish with the double-tap guard, "Leave step?", Stop, sound level, "Tap to resume audio", wake lock | done (wake lock with a stand-in; not on a real phone) |
| Inputs: text, sketch, rating, questionnaire (wording from the core, unchanged), forced-choice trainer, CRV worksheet, helmet trial step, ARV outcome, micro-PK task | done |
| Summary, run list, rate then reveal, late ARV outcome, feedback picture, delete, Export JSON | done |
| All 30 guides run from Start to their summary at phone width | done |

## Trials and picture pool

| Element | Status |
|---|---|
| New trial: mode, stimulation by category (psi first), Blind, safety and pool warnings, Create | done |
| Open trial: steps, commitment, impressions (autosaved), sketch, Lock, Abort, rank the pictures, Reveal, Hit or Rank, condition, the three checks, Kp / LST, preimage | done |
| Results: summary sentence, statistics table, ARV note, trial list, Export trials | done |
| Sender (second phone): trial number, Show / Hide target | done (one browser; not with two phones) |
| Picture pool: fingerprint, sets, thumbnails, add, delete, export, import | done |

## Log

| Element | Status |
|---|---|
| Table with blind lock, notes, rating; inline rating that reveals; Load more; Export JSON; refresh when a session ends; phone layout | done |

## Helmet

| Element | Status |
|---|---|
| Status rows: connection, safety acceptance | done |
| Calibration: DC test, reversed polarity, running indicator, measured field, "Use for CHn", eight µT/mA values, "measured" flag, Save | done |
| Wiring check: rotation test; full load, all eight positive or negative | done |
| Settings: every field, "Use my location", DAC gain, buffered reference, Save, computed maximum current | done |
| Environment: board, firmware, clock, sidereal time, Kp / ap; Update from NOAA; set by hand | done (NOAA with a stand-in answer) |
| Firmware installer: board choice with versions, "off my head" gate, blocked while running / over USB / without files, Web Serial warning | done up to the installer's own dialog; flashing needs a board |

## Docs tab → public pages

| Element | New location | Status |
|---|---|---|
| Every `docs/*.md`, `README.md` | `/articles/*` (5) and `/docs/*` (14) | done |
| `hardware/BOM.md` (was a GitHub link) | `/docs/parts` | done (new) |
| Generated program reference | `/docs/programs`, one fold per program | done |
| Links between docs, to headings, into the app, to GitHub | rewritten at build (`shared/links.ts`) | done (a test follows every link) |
| Figures | bundled, light sheet in every theme | done |
| Table of contents (with sub-headings; the program reference lists every program), "Source" link | page layout | done |
| Full-text search across all docs and the program reference | site search (documents by section, programs by name and summary) | done |
| Field strengths in the chosen unit on the program reference | `/docs/programs`, with its own µT / mG switch | done |
| A running session while reading (pill, Stop, live panel) | site header, on phones as its own row | done |
| New: landing page, evidence words as badges, reading time, previous / next, reading progress | | done |

## Storage, files and browser APIs

| Item | Status |
|---|---|
| `localStorage`: `field-unit`, `program`, `placement-program`, `head-measurements`, `guide-audio`, `guide-longitude`, `godhelmet-demo-v1` | same keys, same modules |
| New in `localStorage`: `godhelmet-link` (the last connected helmet and its running session, for a reload), `godhelmet-rating` (the session that still waits for its rating, per helmet); `godhelmet-demo-v1` now also holds the demo's running session | new |
| Theme choice | new key `gh-theme` (the old `theme` key held other values) |
| IndexedDB `god-helmet` v2: `sets`, `responses`, `kv`, `runs` | same module (`lib/idb.js`); the site keys `responses` by helmet and trial id (`lib/responses.ts`), and still finds entries the old app saved under the trial id alone |
| Downloads: `godhelmet-sessions.json`, `godhelmet-trials.json`, `godhelmet-pool-<date>.json`, `godhelmet-guide-runs.json` | done |
| Web Bluetooth, Web Serial, demo transport, NOAA Kp | same modules |
| Web Audio, wake lock, three.js, geolocation, ESP Web Tools | done as far as a headless browser goes (see "Not checked") |
| Install as an app, offline use | service worker built per release; after the app is first opened, every app screen opens offline; visited pages too; `/firmware/` is never cached |

Stored data does not move from `polobase.github.io` to a new address by itself (browsers keep it per site). The picture pool can be exported and imported; runs, trials and sessions can be exported.

## When the connection fails

New in the site and in the shared core (`webapp/src/ble`); the old app only got what it needs to keep working (a line saying so, Reconnect, Stop switched off). The helmet runs a session by itself, so a lost connection never stops one: the app keeps what it knew, reconnects, and says what happened meanwhile. Checked in Demo mode with the demo helmet's hooks (`window.__helmetDemo`, described at the top of `webapp/src/ble/demo.js`) and against stand-in Bluetooth and USB objects in the core's tests. On a real board (classic ESP32, firmware 0.4.0) the core's own USB code was run through a stand-in for the browser's serial port: connect, requests with an entry's `id`, a pulled cable with a session running, a start whose answer got lost, the reset button and a crash in mid-session all behaved as described here. The firmware's Bluetooth side was checked with a test client (`firmware/test/hw`), **not** with a browser.

| What | Where | Status |
|---|---|---|
| The link has a state (`device.link`: none, connecting, connected, lost, reconnecting). A drop keeps the helmet, its settings and the last status; only Disconnect clears them | `ble/device.js` | done (Demo) |
| Reconnecting by itself, with growing pauses (1, 2, 4, 8, then every 15 s), at once when the page is looked at again or the browser reports the USB board; after 5 minutes the app stops trying and Reconnect remains | `ble/device.js` | done (Demo); built (page-visible and USB plug-in events) |
| No browser chooser to reconnect: the same Bluetooth device object, the same USB port. After a page reload: `navigator.serial.getPorts()`; over Bluetooth `navigator.bluetooth.getDevices()` where the browser has it. Where the browser cannot hand the helmet back (no `getDevices()`; a USB board without a serial number, which it forgets when unplugged), Reconnect opens the chooser | `ble/bluetooth.js`, `ble/serial.js`, `ble/device.js` | built (stand-ins) |
| A dropped Bluetooth link fails every waiting request at once (it was 20 s each); a USB board that stops answering three status polls in a row counts as lost; no status for 4 s (running) or 8 s (idle) makes the app ask, and no answer either means lost | `ble/bluetooth.js`, `ble/serial.js`, `ble/device.js` | built (stand-ins); done (Demo, `mute`) in the core's tests |
| While lost: session pill, live panel and the public pages' header keep the session, with the time left estimated from the clock; Stop, Skip and the intensity are off, with the reason (only the helmet's STOP button works); one line in the notices with Reconnect and Disconnect | `AppSessionPill`, `AppLivePanel`, `AppNotices`, `AppLinkLine`, `AppConnect` | done |
| The line says what is true: with "Stop if no app for" set, that the helmet stops the session after that many seconds, and later that it has by now; otherwise that it runs on | `linkNote()` in `ble/device.js` | done |
| When the link is back: still running / ended at … and why / the helmet restarted (reset reason, the log entry it closed) / another helmet. Compared by `helmetId` and `bootId`, the session by its token; for firmware without them by the log entry, and a restart by the start-up line over USB | `assess()` in `ble/device.js` | done (Demo, also as old firmware) |
| After every connect: clock, hello, settings, the status at once (Start waits for it), then Kp. Kp is fetched again when older than three hours and never sent old; after the start-up line over USB the clock and Kp are sent again | `ble/device.js` | done (Demo); built (USB) |
| Starts (session, test, trial) carry a token. A start whose answer got lost is looked for on the helmet by that token when the link is back, and sent again only within two minutes of pressing Start: nothing starts twice, nothing runs unknown | `start()` in `ble/device.js`; Start panel, Trials, guides | done |
| A page reload: the last helmet and its session are shown again as "reconnecting", and the app reconnects (the demo's session survives the reload as a real helmet's does). On the docs and articles pages only when a session is on the helmet | `restore()` in `ble/device.js` | done (Demo) |
| Stop, Skip, intensity, rating: a failure is shown (a toast). Stop is given 8 s for its answer and can always be pressed again | `AppSessionPill`, `AppLivePanel` | done |
| Rating prompt: remembered per helmet and log entry, so it appears after a reconnect, a reload or on another page; never for another helmet's entry with the same number; gone once rated (also from the Log or a guide's summary) | `lib/rating.ts` | done |
| Guide runner: the status line says that the helmet link is lost and that the program runs on; drops and returns are in the run record with their times; the helmet program is found again by its token (also when the start's answer was lost); a stop that could not be sent is sent when the helmet is back; the helmet is known by `helmetId`; the browser asks before the page is left during a run; a cut-off run's program that still runs can be stopped from the Guides page | `lib/guideRun.ts`, `GuideRunner`, `GuideRunSummary`, Guides page | done |
| Trials: after a reconnect the open trial is read again from the helmet (a lock whose answer was lost shows as locked) | Trials page, guide trial step | done |
| Helmet tab: unsaved edits survive a drop; Save is off with a hint while not connected | `lib/helmet.ts`, Helmet page | done |
| Requests with an id of their own (`log.rate`, `trial.*`) get their answer over Bluetooth and USB: the protocol has one `id` member for the request and the entry, and the helmet answers with it | `ble/link.js` | built (stand-ins; in the demo they always worked) |

## Fixed on the way

| Problem in the old app | Status |
|---|---|
| Safety, Log, Trials and Guides offered Bluetooth only (no USB) | fixed |
| Service worker served firmware files from its cache | fixed |
| Manifest colour did not match the page colour | fixed |
| Log export could loop for ever with the helmet disconnected | fixed |
| The Start panel's "last session" advice was stale until the next connect | fixed (the helmet is asked again when a session ends) |
| Object URLs of pool and trial pictures were never released | fixed |
| A trial step did not look for the helmet's open trials after connecting from inside it | fixed |
| "Measure" / "Place the coils" did nothing when pressed on the Placement page itself | fixed |

## Not checked (needs hardware or a person)

- Bluetooth and USB from a real browser with a real helmet, and flashing a board with the installer.
- "When the connection fails" in a browser: walking out of Bluetooth range and back, a phone that sleeps, a page reload with Bluetooth (with and without `getDevices()`), unplugging a USB board the browser may forget. (The helmet's side of all this, and the core's USB code, were checked on a real board; see that section.)
- Sound as heard, and the wake lock on a real phone.
- The 3D brain on a real GPU and on a phone (pinch zoom).
- Two phones for a telepathy trial's sender.
