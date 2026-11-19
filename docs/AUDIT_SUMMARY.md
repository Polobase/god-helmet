# Audit summary

19 November 2026. The full record is in [HARDWARE_AUDIT.md](HARDWARE_AUDIT.md) (evidence), [HARDWARE_REQUIREMENTS.md](HARDWARE_REQUIREMENTS.md) (what to change) and [PRESET_AUDIT.md](PRESET_AUDIT.md) (every program). Nothing on a helmet was measured: every figure about this rig is calculated.

## Is the first build suited?

**For the Persinger lab's protocols and the Shakti and Shiva sessions: yes, with caveats.** The papers describe eight small cored coils, one waveform passed from coil to coil, points of 1 or 3 ms and microtesla fields near the scalp. The build plays that. The coil is not the limit.

**For everything else in the library: no.** The clinical methods (LFMS, T-PEMF, theta burst, static magnets) need fields 2 to 500,000 times stronger. The whole-head fields of Bell, Ghione, the Cnp frame and the geomagnetic work need room-size coils. Nanotesla work drowns in the build's own offset. Two people at once needs a second helmet and an EEG.

**For "a God Helmet experience": the evidence does not promise one.** People report presences under helmets that emit nothing, in four independent groups. The one double-blind test with a helmet built by the lab found no effect of the field (Granqvist 2005). What this rig can deliver honestly is a blind comparison of real against sham over many sessions.

Three things stand between the build and a claim of replication:

1. **The dose is not defined by the sources.** The lab's figures for one helmet run from 0.1 to 9 µT depending on paper and place; Uppsala measured 3 to 10 µT at depth. A small coil falls about 370 times from scalp to mid-head, the lab reports 2 to 10 times. The build can match the scalp figure or the depth figure, not both.
2. **Timing is unmeasured.** Each update is latched by a task that follows the timer. The lab's objection to Uppsala is about timing.
3. **Nothing verifies delivery, and two safety claims in the docs were false.** A dead coil goes unnoticed. "Battery only" is a rule. And STOP and the arming switch open one wire that all eight coils share: with the firmware hung, a coil keeps 87 to 100 % of its current. STOP works today because the firmware then zeroes the outputs. [SAFETY.md](SAFETY.md) and [WIRING.md](WIRING.md) now say so.

## What the hardware has to change

| # | Change | Forced by | Cost |
|---|---|---|---|
| M1 | Limit resistor fixed at 2.2 kΩ; the firmware treats it as a constant | A setting can make the µT ceiling meaningless | – |
| M2 | A switch in each coil's own return, fed through a latching STOP button | 87 to 100 % of the current survives the present switch | about CHF 25 |
| M3 | The coil circuits close only while the DAC is being written | 4.5 mA from power-on on the display board; 5 s of held output in a hang | about CHF 1 |
| M4 | Battery inside the box; charging and running exclude each other | A mains fault has no limit resistor in its path | about CHF 12 |
| M5 | Updates latched by a hardware timer | The lab's own latency was 50 to 190 µs; ours is unknown | – |
| M6 | A low range (33 kΩ plug): 163 steps at 1 µT at the scalp instead of 10 | The lab kept 256 levels at any strength | about CHF 5 |
| M7 | Calibration against a magnetometer on a jig, ±10 % | ±35 % with a phone; every µT here is a model | USD 18.50 + CHF 2 |
| M8 | The current in each coil is recorded in every session | A real session with a dead coil is logged as real | about CHF 12 |
| M9 | No bare metal and no single enamel layer at the scalp | Two faults put 4.5 mA through the scalp | about CHF 3 |
| M10 | A sham-cue test before any blind series | A leaking blind voids every comparison | – |

About CHF 80 for the musts, about CHF 105 with edge shaping, eight more coils for the ring programs and a logic analyser. Channel count, current ceiling, update rate and session length stay. A 16-bit DAC, more coils per channel and room shielding are not justified. Prices are estimates except where the requirements page marks them as listed.

## What happened to the programs

198 programs were read against their sources. 176 are active now.

| Decision | Programs |
|---|---|
| Parameters corrected | 115 |
| Description or name corrected | 29 |
| Evidence grade lowered only | 22 |
| Unchanged | 4 |
| Archived (`presets/archive/`) | 28 |
| New | 6 |

- Every program now says how closely the helmet follows its source: 14 play published values, 133 are rebuilt from descriptions, 16 copy only the timing of a method that is out of reach, 13 are this project's own. Only `sham` is still graded `established`.
- The lab helmet is modelled as the papers describe it: four coil pairs on a 7.5 × 5 cm ellipse, one pair at a time, the field through the head. "Once every 3 s" is played as the pause it is. The hippocampal stand-in is the primed burst the lab describes.
- The intensity settings were left alone. The readers proposed 25 changes, from 0.04 to 5 µT, for programs of one lab. That spread is point 1 above.
- No new placement for a brain target: the sourced ones existed already.

## What changed in the repository

- The app's shared core (engine, parser, Bluetooth, audio, brain data) moved from the deleted `webapp/` into `site/core/`, with its tests and scripts. The site builds again.
- The program checker was rebuilt in `site/` (`npm run check-presets`) and is shared with the tests. It now knows `fidelity`, `dose`, the archive, references to missing programs, too few output steps and unknown keys. The last rule caught a correction that had been written under a misspelt key and never took effect.
- The phone coil check runs in `site/` again, local use only.
- Docs, guides and the firmware's comments point at `site/`. Contradictions found on the way are corrected (the 1 kΩ line in the parts list, "hard ceiling", the STOP and arming wording).
- Nothing was committed or pushed.

## Not measured, and what to measure first

1. The time of every LDAC pulse for 60 s (logic analyser). Pass: within ±50 µs.
2. Field per mA of each coil at 20 and 40 mm on a jig. Pass: coils within ±10 %, ratio 5.7 ± 15 %.
3. Current in each coil during a real session. Pass: the table's shape, no silent channel.
4. STOP with the controller held in reset. The calculation says the present build fails this.

The other lines are in the [bench protocol](HARDWARE_AUDIT.md#bench-protocol).

## For the owner to decide

- **The old Pages address.** `.github/workflows/pages.yml` now publishes only the firmware images, plus a forwarding page when the repository variable `SITE_URL` is set. The next push changes what that address serves.
- **Publishing.** The program audit is listed under Reference on the site. The three hardware pages stay unpublished, like the rest of the build.
- **Intensity.** If one reading of the lab's figures is to be preferred, the settings follow from the audit's table; the low range (M6) is needed for the scalp reading.
- **One more program.** van Belkum 2021 is the closest tested exposure to this helmet, with a null result. It needs a choice of 8 of its 19 sites.
- **Until M2 is built**, a session that STOP does not end is ended by pulling the helmet's cables.
