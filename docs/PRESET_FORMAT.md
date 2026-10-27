# Program file format

Every program is one JSON file in [`presets/`](../presets). The web app lists them, the [brain view](BRAIN_VIEW.md) draws them, and the app sends the same JSON to the helmet over Bluetooth, where the firmware's own parser runs it. The JavaScript engine (`webapp/src/engine`) and the C++ engine (`firmware/lib/engine`) are tested against each other sample by sample.

Check a file before committing it:

```sh
cd webapp
node scripts/check-preset.mjs ../presets/my-program.json   # one file
node scripts/check-preset.mjs --all                         # every preset
```

## Example

```json
{
  "id": "obe-shiva-right-tpj",
  "name": "OBE: right angular gyrus (Shiva sites)",
  "category": "obe",
  "evidence": "anecdote",
  "origin": "Todd Murphy, 8 Coil Shakti OBE session",
  "uT": 1.0,
  "summary": "One or two sentences: what it is meant to do and where it comes from.",
  "notes": "Setting, timing, cautions; what is approximated and why.",
  "targets": ["right-angular-gyrus", "right-tpj"],
  "source": "Murphy, Shakti OBE page https://www.god-helmet.com/... ; Blanke et al. 2002, Nature 419:269",
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
| `evidence` | recommended | `established` (independent replication), `single-lab`, `claim` (author or vendor statement), `anecdote`, `unverified` (a construct nobody has tested). It rates the *original* protocol's evidence, not this helmet's. |
| `origin` | recommended | Who designed the protocol (lab, vendor, device). |
| `uT` | no | Default intensity: peak field 20 mm in front of each coil, µT (0–5; default 1). |
| `summary` | yes | Purpose and origin in one or two sentences. |
| `notes` | no | Setting, timing, cautions, and every approximation (e.g. "the Shiva amygdala template is proprietary; approximated by an accelerating burst"). |
| `setting`, `schedule` | no | Free text: room, posture, time of day; how often and how many sessions. |
| `targets` | no | Region ids from `webapp/src/assets/brain/regions.json` the protocol aims at; the brain view highlights them. |
| `source` | yes | Citations separated by ` ; `, each with a URL where one exists. |

## Placement

`layout` is one of:

- `"temporal"` (default): CH1–4 left FT7, T7, CP5, TP7; CH5–8 right FT8, T8, CP6, TP8.
- `"ring"`: CH1–8 Fpz, F7, T7, P7, Oz, P8, T8, F8 (counter-clockwise seen from above).
- `"custom"`: any 10-10 or 10-5 sites, given in `placement`:

```json
"placement": { "sites": ["Fp1", "FT7", "TP7", "O1", "O2", "TP8", "FT8", "Fp2"], "order": [0, 1, 2, 3, 4, 5, 6, 7] }
```

- `sites`: 8 entries, one per channel; `""` leaves a channel unused (it stays silent). Names follow the 10-5 system exactly (`FT7`, `Cz`, `TP8`, `T10`, `FTT7h`, ...); the checker rejects names that are not in the 10-05 set.
- Side comes from the name: odd number = left, even = right, `z` = midline. Midline coils take part in `rotate` and `bilateral`, not in `left`, `right`, `cycle` or `alternate`.
- `order`: the counter-clockwise rotation order (seen from above) for `rotate` and `cycle`; default is channel order. List only used channels.

## Phases

Up to 12 phases, 60 minutes in total.

| Field | Meaning |
|---|---|
| `name` | Shown in the app. |
| `minutes` or `seconds` | Duration. |
| `crossfade` | `true`: 2-s ramp into this phase; default is an abrupt switch. |
| `level` | 0–1 multiplier of the session intensity (default 1). |
| `pattern`, `spatial` | One track: the waveform and how it moves over the coils. |
| `tracks` | Instead of `pattern`/`spatial`/`level`: 1–2 tracks played together, each `{pattern, spatial, level}` (e.g. one signal on the left, another on the right, as in the stereo Shakti sessions). Per coil the two add and are clipped to full scale. |

`fadeInS` and `fadeOutS` (default 10 s) ramp the whole session.

## Signals (`pattern`)

All signals are s(t) in −1…1, multiplied by the coil gain, the phase level and the session intensity. `pointMs` holds each value for that long (sample-and-hold, like the Persinger/Koren point files); 0 = smooth. The sequencer ticks at 2 kHz, so 0.5 ms is the finest step.

| `type` | Parameters (defaults) | Use |
|---|---|---|
| `off` | – | Sham / silence. |
| `dc` | – | Constant (tests only). |
| `sine` | `f0` (7) Hz | Theta, alpha, 40 Hz. |
| `chirp` | `f0` 4 → `f1` 40 Hz over `sweepMs` 2000, then `gapMs` 0 | Function-generator sweep (Persinger phase 1, Murphy's psi chirp). |
| `burst` | `f0` 6 → `f1` 30 Hz, `sweepMs` 1500, `gapMs` 4000, `pointMs` 3 | Accelerating "burst-firing" (amygdala "burstx" approximation). |
| `thomas` | `f0` 25 → `f1` 6 Hz, `sweepMs` 2500, `gapMs` 1000, `pointMs` 3 | Decelerating FM ("Thomas pulse" approximation). |
| `pulse` | `pulseMs` 100, `gapMs` 100, `alternate` true | Rectangular pulses, optional polarity flip. |
| `semirandom` | `pointMs` 3, `seed` 1 | Random value per point. |
| `pm` | `f0` 40 Hz carrier, `f1` 0.5 Hz modulation, `depth` 3 rad | Phase-modulated sine ("modulated 40 Hz"). |
| `noise` | `f0` 4 – `f1` 8 Hz, `seed` | Band-limited noise ("theta-band random noise"). |
| `table` | `data` [0–255], `pointMs`, `gapMs` | Exact point tables; 128 = zero. Up to 8192 points per table and 16384 per program. A table with no `data` uses the program's shared `tableData`. |

Frequencies are 0–500 Hz, `pointMs` 0–1000, `depth` 0–20 rad.

### Exact pulse tables

`webapp/src/engine/generators.js` builds published pulse protocols as tables; print one ready to paste:

```sh
cd webapp
node scripts/table.mjs list
node scripts/table.mjs itbs          # theta-burst, Huang 2005 timing
node scripts/table.mjs bhfs '{"hz": 6.55}'
node scripts/table.mjs cnp --meta    # US 6,234,953 Table 1 (Thomas/Prato/Persinger)
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
| `cycle` | `side` `left`/`right`/`both`, `dir`, `dirLeft`, `dirRight`, dwell | Step around one side's coils; `both` steps both sides at once (each with its own direction). |
| `alternate` | `alternateMs` (2000) | Left side, then right side, each for `alternateMs`. |
| `single` | `channel` 0–7 | One coil. |

Dwell (time per coil): `"dwellMs": 20`, or a ramp `"dwell": [start, step, end]` in ms, e.g. `[10, 2, 20]` (Persinger's 10 → 20 ms in 2-ms steps) or `[25, -2, 11]` (Tsang 2004). `crossfade: true` blends neighbouring coils instead of switching. `weights`: 8 per-channel multipliers −1…1 for any mode; a negative weight drives that coil with reversed polarity (the 8 Coil Shakti wires each pair as one + and one − coil).

**Persinger-lab notation.** The lab wrote rotation schedules as base and change per solenoid, and the sources disagree on the sign. Persinger & Lavallee 2010 (and Lehman 2016) define "20+2" as 20, 18, …, 6 ms and "20−2" as 20, 22, …, 34 ms, and Tsang 2004 is 25 → 11 ms (`[25, -2, 11]`). The Koren software patent (US 6,312,376) and the configuration table of the 1999–2008 papers (e.g. Swann 2002 Table 1: 20/+2, 100/+20, 200/−2) read more naturally with the plain sign: the +20 row only works as an increase, and Cook 1999 gives rotation times of about 200–2000 ms. This project uses the authors' explicit definition where a paper gives one (2010 photon and yoked studies, Tsang 2004, Lehman 2016) and the plain sign for the configuration table (`[20, 2, 34]`, `[100, 20, 240]`, `[200, -2, 186]`); each program's notes say which reading it uses. Cook 1999 and Richards 2002 describe 20-ms *changes* per solenoid, not a fixed 20-ms dwell.

**Persinger-lab signals as published.** Burst-firing ("burstx"): about 230 points at 3 ms (0.69 s; 248 and 289 points in other theses) once every 3–4 s, point values unpublished: `{"type": "burst", "sweepMs": 690, "gapMs": 3310, "pointMs": 3}`. Thomas pulse: the exact table at 3 ms (`node scripts/table.mjs thomas`). LTP: a primed burst (`primed`). 7 Hz sine with 1 or 10 ms points. The lab's 8-bit values map 0…255 to −5…+5 V (patent: ±6 V).

## Limits

- 12 phases, 60 min, at most 2 tracks per phase.
- Tables: 8192 points each, 16384 per program; the JSON must stay under 96 KB (Bluetooth request limit).
- Intensity: the app caps the program intensity at the calibrated maximum (hardware cap 4.54 mA per coil).
