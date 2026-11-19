# Program file format

Every program is one JSON file in [`presets/`](../presets). The web app lists them, the [brain view](BRAIN_VIEW.md) draws them, and the app sends the same JSON to the helmet over Bluetooth, where the firmware's own parser runs it. The JavaScript engine (`site/core/engine`) and the C++ engine (`firmware/lib/engine`) are tested against each other sample by sample (`site/test/engine.test.js`).

Check a file before committing it:

```sh
cd site
node scripts/check-preset.mjs ../presets/my-program.json   # one file
npm run check-presets                                       # every program, with warnings
```

The same rules (`site/core/lib/presetCheck.js`) run in `npm test`, and the firmware's host tests parse and render every file (`firmware/test/run_host_tests.sh`).

## Example

```json
{
  "id": "obe-shiva-right-tpj",
  "name": "OBE: right angular gyrus (Shiva sites)",
  "category": "obe",
  "evidence": "anecdote",
  "fidelity": "approximation",
  "dose": { "value": [0.1, 1], "unit": "uT", "plane": "unstated", "cite": "Gendle & McGrath 2012 p.4" },
  "origin": "Todd Murphy, 8 Coil Shakti OBE session",
  "uT": 1.0,
  "summary": "One or two sentences: what it is meant to do and where it comes from.",
  "notes": "Setting, timing, cautions; what is approximated and why.",
  "targets": ["right-angular-gyrus", "right-tpj"],
  "source": "Murphy, Shakti OBE page https://www.god-helmet.com/... ; Gendle & McGrath 2012 https://pubmed.ncbi.nlm.nih.gov/22582690/ ; Blanke et al. 2002, Nature 419:269",
  "layout": "custom",
  "placement": { "sites": ["FT7", "C5", "TP7", "T9", "FT8", "C6", "TP8", "T10"] },
  "fadeInS": 10,
  "fadeOutS": 15,
  "phases": [
    { "name": "Both sides, theta", "minutes": 10,
      "pattern": { "type": "sine", "f0": 7, "pointMs": 1 },
      "spatial": { "mode": "bilateral" } },
    { "name": "Right side stepping", "minutes": 20,
      "pattern": { "type": "pm", "f0": 40, "f1": 0.5, "depth": 3 },
      "spatial": { "mode": "cycle", "side": "right", "dir": "ccw", "dwellMs": 20, "weights": [0, 0, 0, 0, 0.6, 0.8, 1, 1] } }
  ]
}
```

## Description fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Lower-case, hyphenated; must equal the file name without `.json`. |
| `name` | yes | Shown in the program list. |
| `category` | yes | `spiritual`, `presence`, `obe`, `psi`, `meditation`, `mood`, `dreams`, `body`, `signals`, `courses`, `lowfield`, `persinger`, `replication`, `research`, `control`. |
| `evidence` | recommended | `established` (independent replication), `single-lab`, `claim` (author or vendor statement), `anecdote`, `unverified` (a construct nobody has tested). It rates the source protocol; see [Evidence and fidelity](#evidence-and-fidelity). |
| `fidelity` | yes | `exact`, `approximation`, `timing` or `construct`: how closely this helmet reproduces the exposure the source describes. Not needed in the `control` category. |
| `dose` | no | What the source states about field strength and where it was measured: `{ "value": 1, "unit": "uT", "plane": "scalp", "cite": "Author Year p.N" }`. `value` is a number or `[low, high]`; `unit` is `nT`, `mG`, `uT` or `mT`; `plane` is `scalp`, `coil`, `intracranial`, `centre` (of a coil array) or `unstated`. Leave it out when the source gives no field strength. |
| `origin` | recommended | Who designed the protocol (lab, vendor, device). |
| `uT` | no | Default intensity: peak field 20 mm in front of each coil, µT (above 0, at most 5; default 1). This is the helmet's own setting, always at 20 mm, whatever plane the source used. |
| `summary` | yes | Purpose and origin in one or two sentences. |
| `notes` | no | Setting, timing, cautions, and every approximation (e.g. "the Shiva amygdala template is proprietary; approximated by an accelerating burst"). |
| `setting`, `schedule` | no | Free text: room, posture, time of day; how often and how many sessions. |
| `targets` | no | Region ids from `site/core/assets/brain/regions.json` the protocol aims at; the brain view highlights them. |
| `source` | yes | Citations separated by ` ; `, each with a URL where one exists. |

The firmware reads `id`, `name`, `layout`, `placement`, `fadeInS`, `fadeOutS`, `phases`, `tableData`, `uT`, `category`, `summary` and `source`, and ignores every other field. The app sends the helmet only what it plays.

### Evidence and fidelity

Two fields answer two different questions.

- **`evidence`** rates the source: has anyone independently repeated what the source reports?
- **`fidelity`** rates this helmet against the source: does it deliver what the source delivered?

| `fidelity` | Meaning | Example |
|---|---|---|
| `exact` | The source publishes the values (a point table or explicit timing) and the helmet plays them. The strength lies between the readings the source's own figures allow; for the Persinger lab those readings are more than a decade apart (see below), so `exact` is a statement about waveform and timing. | The 849-point Thomas table at 3 ms points. |
| `approximation` | The waveform or the coil layout is rebuilt from a description: the original file was never published, or it is a vendor's own signal. | Burst-firing, built as a rising sweep with the published point duration and repeat interval. |
| `timing` | The timing is the source's, but its field strength or kind of field is not: ten times or more away, or a uniform, static or TMS field. | Theta-burst timing from TMS (about 1 T) played at microtesla. |
| `construct` | This project's own design. No source describes this protocol. | A frontal session assembled from two vendor signals. |

With `timing` or `construct`, nobody has tested what the helmet delivers, so `evidence` must be `unverified`; the checker enforces this. The app shows both as badges, and the program library can be filtered by either.

A helmet's intensity setting and a source's field strength are rarely the same quantity. The Persinger lab's "1 µT" was read at the scalp or inside the helmet, where the papers say at all; this helmet's `uT` is 20 mm in front of the coil, which the coil model puts at about 24 times less than at the scalp ([HARDWARE_AUDIT.md](HARDWARE_AUDIT.md)). `dose` records what the source says, with the page, so the two can be compared.

## Placement

`layout` is one of:

- `"temporal"` (default): CH1–4 left FT7, T7, CP5, TP7; CH5–8 right FT8, T8, CP6, TP8.
- `"ring"`: CH1–8 Fpz, F7, T7, P7, Oz, P8, T8, F8 (counter-clockwise seen from above).
- `"custom"`: any 10-10 or 10-5 sites, given in `placement`:

```json
"placement": { "sites": ["Fp1", "FT7", "TP7", "O1", "O2", "TP8", "FT8", "Fp2"], "order": [0, 1, 2, 3, 4, 5, 6, 7] }
```

- `sites`: 8 entries, one per channel; `""` leaves a channel unused (it stays silent). Names follow the 10-5 system exactly (`FT7`, `Cz`, `TP8`, `T10`, `FTT7h`, ...), at most 7 characters. The checker accepts the 336 site names in `site/core/assets/brain/sites.json` ([PLACEMENT.md](PLACEMENT.md#the-aligned-set-used-by-the-app)); the four landmarks in that file (`NAS`, `INI`, `LPA`, `RPA`) are not coil sites. The firmware itself only needs a name that ends in a number or `z`, to tell the side.
- Side comes from the name: odd number = left, even = right, `z` = midline. Midline coils take part in `rotate` and `bilateral`, not in `left`, `right`, `cycle` or `alternate`.
- `order`: the counter-clockwise rotation order (seen from above) for `rotate` and `cycle`; default is channel order. List only used channels.

## Phases

Up to 12 phases, 60 minutes in total.

| Field | Meaning |
|---|---|
| `name` | Shown in the app. |
| `minutes` or `seconds` | Duration, above 0. If both are given, `minutes` counts. |
| `crossfade` | `true`: 2-s ramp into this phase; default is an abrupt switch. |
| `level` | 0–1 multiplier of the session intensity (default 1). |
| `pattern`, `spatial` | One track: the waveform and how it moves over the coils. |
| `tracks` | Instead of `pattern`/`spatial`/`level`: 1–2 tracks played together, each `{pattern, spatial, level}` (e.g. one signal on the left, another on the right, as in the stereo Shakti sessions). Per coil the two add and are clipped to full scale. |

`fadeInS` and `fadeOutS` (default 10 s) ramp the whole session.

## Signals (`pattern`)

All signals are s(t) in −1…1, multiplied by the coil gain, the phase level and the session intensity. `pointMs` holds each value for that long (sample-and-hold, like the Persinger/Koren point files); 0 = a new value at every tick. The sequencer ticks at 2 kHz, so 0.5 ms is the finest step. Each type has its own default `pointMs`, used when a file leaves it out: write `"pointMs": 0` for the smoothest signal.

| `type` | Parameters (defaults) | Default `pointMs` | Use |
|---|---|---|---|
| `off` | – | – | Silence. |
| `dc` | – | – | Constant (tests only). |
| `sine` | `f0` (7) Hz | 1 | Theta, alpha, 40 Hz. |
| `chirp` | `f0` 4 → `f1` 40 Hz over `sweepMs` 2000, then `gapMs` 0 | 1 | Function-generator sweep (Persinger phase 1, Murphy's psi chirp). |
| `burst` | `f0` 6 → `f1` 30 Hz, `sweepMs` 1500, `gapMs` 4000 | 3 | Accelerating "burst-firing" (amygdala "burstx" approximation). |
| `thomas` | `f0` 25 → `f1` 6 Hz, `sweepMs` 2500, `gapMs` 1000 | 3 | Decelerating FM ("Thomas pulse" approximation). |
| `pulse` | `pulseMs` 100, `gapMs` 100, `alternate` true | 0 | Rectangular pulses, optional polarity flip. |
| `semirandom` | `seed` 1 | 3 | Random value per point. |
| `pm` | `f0` 40 Hz carrier, `f1` 0.5 Hz modulation, `depth` 3 rad | 1 | Phase-modulated sine ("modulated 40 Hz"). |
| `noise` | `f0` 4 – `f1` 8 Hz (`f1` must be above `f0`), `seed` | 1 | Band-limited noise ("theta-band random noise"): 12 sines with random phases. |
| `table` | `data` [0–255], `gapMs` | 3 | Exact point tables; 128 = zero, 255 = full positive, 1 and 0 = full negative. Up to 8192 points per table and 16384 per program. A table with no `data` uses the program's shared `tableData`. The same table can be written packed as `dataB64` / `tableDataB64` (base64, one byte per point); the app sends programs to the helmet that way. |

Frequencies are 0–500 Hz, `pointMs` 0–1000, `depth` 0–20 rad. `sweepMs`, `gapMs`, `pulseMs` and `alternateMs` are not range-checked.

**Sham.** A program is recorded as a sham session in the helmet's log in two cases only: it was started blind and the helmet's random generator chose sham, or its `id` is exactly `sham`. Any other program made only of `off` phases plays nothing but is logged as an active session, and started blind it has two identical arms.

### Exact pulse tables

`site/core/engine/generators.js` builds published pulse protocols as tables; print one ready to paste:

```sh
cd site
npm run table -- list
npm run table -- itbs          # theta-burst, Huang 2005 timing
npm run table -- bhfs '{"hz": 6.55}'
npm run table -- cnp --meta    # US 6,234,953 Table 1 (Thomas/Prato/Persinger)
```

| Generator | Protocol |
|---|---|
| `itbs`, `ctbs` | Theta-burst stimulation (Huang 2005): 50 Hz triplets at 5 Hz; iTBS 2 s on / 8 s off, cTBS 40 s continuous. |
| `thomas` | The patent Thomas table as replayed in Persinger's lab: 849 points at 3 ms (one 2.55-s decelerating burst; Buckner 2015). |
| `primed` | Primed burst (Rose & Dunwiddie 1988), the Persinger-lab "LTP" file as described: primer, then 4 pulses at 100 Hz 150 ms later; 5 trains per second, optional `isiMs`. |
| `lfms` | Low-field magnetic stimulation (Rohan 2014): 500 Hz alternating, 0.5-s trains every 2 s. |
| `tpemf` | Re5 T-PEMF (Larsen 2020): +3 ms / −3 ms / 12 ms pause; `variant: "tang"` 2.5/2.5/15 ms. |
| `cnp` | Lawson Cnp pulse, patent Table 1: 18 pulses per burst, 4 bursts with 110/220/330/1200 ms refractory periods. |
| `bhfs` | Biomimetic high-frequency stimulation (Grehl 2016): 20 pulses in 62.6 ms at 6.55, 9.75 or 6.15 Hz. |
| `ltp` | Hippocampal theta burst (Larson & Lynch 1986): 4 pulses at 100 Hz, 5 Hz bursts. |
| `fibonacci` | Theta bursts with Fibonacci amplitudes (project construct after Murphy's signal list). |
| `square40` | 40 Hz square wave (GENUS timing). |
| `erp` | Textbook ERP shape (P50–P300) every 1.5 s (project construct). |

These copy the *timing* of clinical and laboratory protocols. Their field strengths were 100–100,000× higher than this helmet's; the docs say so wherever they are used.

## Coil movement (`spatial`)

| `mode` | Parameters | Meaning |
|---|---|---|
| `bilateral` | – | All coils together (default). |
| `left`, `right` | – | Only one side's coils. |
| `rotate` | `dir` `ccw`/`cw`, dwell | One coil at a time around the whole rotation order. |
| `cycle` | `side` `left`/`right`/`both` (default `right`), `dir`, `dirLeft`, `dirRight`, dwell | Step around one side's coils; `both` steps both sides at once (each with its own direction). |
| `alternate` | `alternateMs` (2000) | Left side, then right side, each for `alternateMs`. |
| `single` | `channel` 0–7 | One coil. |

`dir` is `ccw` (default) or `cw`, seen from above. Dwell (time per coil, at least 0.5 ms, default 20): `"dwellMs": 20`, or a ramp `"dwell": [start, step, end]` in ms, e.g. `[10, 2, 20]` (Persinger's 10 → 20 ms in 2-ms steps) or `[25, -2, 11]` (Tsang 2004). `crossfade: true` blends neighbouring coils instead of switching. `weights`: 8 per-channel multipliers −1…1 for any mode; a negative weight drives that coil with reversed polarity (the 8 Coil Shakti wires each pair as one + and one − coil).

**Persinger-lab notation.** The lab wrote rotation schedules as base and change per solenoid, and the sources disagree on the sign. Persinger & Lavallee 2010 (and Lehman 2016) define "20+2" as 20, 18, …, 6 ms and "20−2" as 20, 22, …, 34 ms, and Tsang 2004 is 25 → 11 ms (`[25, -2, 11]`). The Koren software patent (US 6,312,376) and the configuration table of the 1999–2008 papers (e.g. Swann 2002 Table 1: 20/+2, 100/+20, 200/−2) read more naturally with the plain sign: the +20 row only works as an increase, and Cook 1999 gives rotation times of about 200–2000 ms. This project uses the authors' explicit definition where a paper gives one (2010 photon and yoked studies, Tsang 2004, Lehman 2016) and the plain sign for the configuration table (`[20, 2, 34]`, `[100, 20, 240]`, `[200, -2, 186]`); each program's notes say which reading it uses. Cook 1999 and Richards 2002 describe 20-ms *changes* per solenoid, not a fixed 20-ms dwell.

**Lab helmet pairs.** The lab's temporal helmet had four solenoids per side and switched on one left-right pair at a time for 0.5 s (Richards 1993 p.3 [73]; Persinger 2000 p.3 [661]). Programs that model it use the four sites per side of the ellipse (FFT7, C5, TP7, T9h and their mirrors, [PLACEMENT.md](PLACEMENT.md)) with `{"mode": "cycle", "side": "both", "dwellMs": 500, "weights": [l, l, l, l, -r, -r, -r, -r]}`. The right side is negative because all coils are mounted the same way round: with equal signs the two fields of a pair cancel at the midline, with opposite signs the pair's field points through the head. `l` and `r` set the two sides' levels where a paper gives a ratio, for example `0.2` and `1` for 5 to 1 in favour of the right.

**Persinger-lab signals as published.** Burst-firing ("burstx"): 230 points at 3 ms in most papers, 0.69 s; 289 points, 0.867 s, in the Shiva studies (Collins 2014 p.40 [31]; Saroka 2010 p.5 [470]). "Once every 3 s" or "4 s" is the pause between two bursts, not the period (Persinger 1999 p.3 [165]: 4000 ms between patterns, 380 presentations in 30 min): `{"type": "burst", "sweepMs": 690, "gapMs": 4000, "pointMs": 3}`. Its shape is printed as a graph (Persinger 2000 Fig. 2, p.5 [663]); its point values were never published as numbers, so `burst` is this project's rising sweep with the published length. Thomas pulse: the exact 849-point table (`npm run table -- thomas`, in `site/`). LTP: a primed burst (`primed`). 7 Hz sine with 1 or 10 ms points. The lab's 8-bit values map 0…255 to −5…+5 V (patent: ±6 V).

## What the format cannot express

Things a source did that no field of the format can say. Each row gives the reason and what closing the gap would cost. None of them is closed by this version.

| What the source did | Where | Why there is no field | Cost of adding it |
|---|---|---|---|
| A field strength at the scalp or inside the head | Most lab papers: "1 µT at the level of the scalp" | `uT` is always the peak 20 mm in front of the coil. `dose` records what the source says, but the engine does not use it | A switch in the app that divides by the model's 23.8 costs little. Playing the result with enough levels needs the low range of [HARDWARE_REQUIREMENTS.md](HARDWARE_REQUIREMENTS.md) M6 |
| A different time on every coil | Booth 2008: 100, 80, 60, 40, 20, 1, 1, 1 ms | `dwell` is one ramp of start, step and end, which starts again when it reaches its end | A list of eight times: parser and `spatial.cpp`, the JavaScript engine, the SD pack and the parity fixtures. Older firmware would reject such a program |
| More than 12 phases | Persinger, Richards & Koren 1997: 23 blocks | Fixed table sizes in the firmware | Memory on the helmet, and the 96 KB request limit |
| Random pauses or a random order | Bell 1991: 5 to 11 s at random between epochs. Richards 2002: half of the subjects in reverse order | Every time in a program is fixed, so that a session can be repeated and compared with the reference engine | A seeded random pause per phase, in both engines. A second program with the other order costs nothing and is what the library does |
| Fields locked to an outside event | Ross 2008: 1 s of field at the end of each statement | A program runs on its own clock from start to end | A trigger input (hardware) and a "wait" phase |
| Real and sham epochs mixed within a blind session | Bell: field epochs against silent ones | A phase of type `off` gives silent epochs, but they are the same in every run. The blind choice is per session | Blind epochs need a per-epoch log on the helmet |
| Points shorter than 0.5 ms, or anything above 500 Hz | LFMS ramps of 256 µs; sound-card signals; TMS pulses | The outputs change 2000 times a second | A faster output path. The coil could still not deliver these methods' fields ([HARDWARE_AUDIT.md](HARDWARE_AUDIT.md) I2) |
| A point duration that is not a multiple of 0.5 ms | The lab's "1 ms" points lasted 1.05 to 1.19 ms with the computer's latency | Values are held for whole update periods | A finer timer; no source says the exact figure mattered |
| Sessions over 60 min | Ghione: 90 min. Schumann devices: all night | Excluded on purpose ([SAFETY.md](SAFETY.md)) | A safety decision, not a format change |
| Three waveforms at once | No source needs it; the Shakti played two | Two tracks per phase | Computing time per update on the helmet |
| Two helmets from one program | Persinger 2010 | One set of eight outputs | Hardware: a second helmet in series needs no format change ([HARDWARE_REQUIREMENTS.md](HARDWARE_REQUIREMENTS.md) N1) |

## Limits

- 12 phases, 60 min, at most 2 tracks per phase.
- Tables: 8192 points each, 16384 per program; the JSON must stay under 96 KB (Bluetooth request limit).
- Keys: a key at the top level or in `placement` that this page does not name is an error. The helmet would ignore it silently, so a misspelt key would otherwise look like a change that was made.
- Names: `id` at most 63 characters; `name` 95 and a phase's `name` 63 (longer ones are cut short on the helmet; the checker warns).
- Intensity: `uT` at most 5. The app caps the program intensity at the calibrated maximum (hardware cap 4.54 mA per coil, about 8 µT at 20 mm with the default calibration).
- Weak settings lose levels: one step of the 12-bit DAC is 2.2 µA, about 4 nT at 20 mm. A program below about 0.26 µT swings fewer than 64 steps each way, and the checker warns that a point table then loses levels ([HARDWARE_AUDIT.md](HARDWARE_AUDIT.md)).

## Archived programs

`presets/archive/` holds programs that were taken out of the library: duplicates, programs whose source does not describe them, and programs this helmet cannot deliver in any useful sense ([PRESET_AUDIT.md](PRESET_AUDIT.md) gives the reason for each). The checker still parses them. The app, the SD-card pack and the firmware tests read only `presets/*.json`, so nothing loads them. An archived id must not be used again for another program.
