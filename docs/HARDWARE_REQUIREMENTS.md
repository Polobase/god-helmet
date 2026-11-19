# Hardware requirements: what the audit forces

[HARDWARE_AUDIT.md](HARDWARE_AUDIT.md) lists what the sources' apparatus did and what the first build does. This page turns each gap into a numbered requirement. Every requirement names the ledger row it comes from (A1 … I4), the old value, the new value, the number that forces the change, and what it costs. Where the evidence forces nothing, nothing changes, and the page says so.

**The coil is fixed**: 19 × 12 mm, 495 turns, 4.2 Ω, cored. Every field value below is **calculated** from the coil model (`site/core/engine/field.js`), not measured. Prices marked *listed* were read from a seller's page in November 2026; all others are estimates and were not looked up. Firmware changes are specified here and not implemented. The driver board in `hardware/pcb` is outside this page: the requirements apply to whatever drives the coil.

## What stays, and the number that says so

| Item | Value | Why no change | Ledger |
|---|---|---|---|
| Coil | 19 × 12 mm, 495 turns, 4.2 Ω | Fixed. It is a small cored dipole like the lab's relay coil, and falls off like the lab's single solenoid (28 times from surface to 2 cm there, 24 times from 3 to 20 mm here) | A3, A5 |
| Channels | 8 | The lab drove 8 positions or 4 pairs from one waveform. Two waveforms on 8 weighted outputs already exceed that. No source needs a ninth | A1, D1 |
| Current ceiling | 4.54 mA (4.34 mA with M8) | The lab's highest scalp figure, 10 µT, needs 0.23 mA. To read Uppsala's "3–10 µT at intracranial distance" as 10 µT at 40 mm would need 30 mA, which is 1.3 mT at the scalp. Even 10 µT at 20 mm needs 5.4 mA, which is 238 µT at the scalp, above the 200 µT reference level (ICNIRP 2010 p.11 [827], Table 4). The present ceiling already gives 201 µT there | B1, H5 |
| Update rate | 2 kHz | The lab held each value for 1 to 20 ms. The sources that need more (LFMS ramps of 256 µs, sound-card files) are out of reach for other reasons | C1, I2 |
| Session length | 60 min | The lab ran 20 to 60 min | C6 |
| Mounting | Band and tape, any 10-05 site | No paper gives a coordinate for a coil; the lab's geometry (a 7.5 × 5 cm ellipse, a ring every 45°) fits the band | A4 |
| Shielding | None | See [Not justified](#not-justified) | F1 |

## Must

A requirement is a **must** when, without it, a session cannot be called a replication attempt or a safety claim in the docs is false.

| # | Requirement | Old | New | The number that forces it | Ledger | Cost |
|---|---|---|---|---|---|---|
| **M1** | **The limit resistor is a fixed part of the design, and the firmware treats it as a constant.** | 2.2 kΩ on a perfboard; the firmware accepts a series resistance of 470 Ω to 100 kΩ as a setting and does not check the full-scale voltage or the coil resistance | 2.2 kΩ, 1 %, soldered. The firmware holds the resistance as a build constant, one value per range (M6). The ceiling is stated and clamped in mA first, in µT second | A setting of 100 kΩ makes the firmware scale every code up by 45; the field ceiling in µT then means nothing, and only the resistor still limits (201 µT at the scalp) | H1, H5 | No parts. Firmware: `settings.cpp:127–146` |
| **M2** | **STOP and arming open every coil's own circuit, without the firmware.** One switch per coil, held closed by a current that flows only through a closed STOP contact (M2) and a live activity gate (M3). | One PhotoMOS between the shared return bus and ground. STOP is an interrupt that opens it; the field stops only when the task then writes zero | Eight PhotoMOS, one in each coil's return, before the returns join. Their LEDs (four strings of two, about 6 mA each from 5 V through 430 Ω) are fed through a latching, normally closed STOP button. A second, hand-held STOP in series | With the shared return open, one coil driven alone keeps 87.5 % of its current, and two coils driven in opposite directions keep 100 %. 83 of the 176 programs drive coils in opposite directions in some phase. With the firmware hung, STOP does nothing | H3, D2 | 7 more AQY212EH, about CHF 18; latching STOP button, about CHF 5 |
| **M3** | **The coil circuits close only while the DAC is being written, on every board.** | DevKit boards: a pin closes the one PhotoMOS. Display board: no switch, 4.5 mA in each coil from power-on until the first write. A hang holds the last values for up to 5 s and through the reset | An activity gate in the LED feed of M2: it conducts only after about 50 ms of continuous pulses on the DAC's SYNC line and stops within 10 ms of the last pulse. It needs no pin and no code, so the display board gets it too. On DevKit boards the arming pin stays in series | 4.5 mA per coil at power-on on the display board. 5 s of held output in a hang | H4, H8 | A capacitor, two diodes, a transistor: about CHF 1 |
| **M4** | **No conductor leads from the coil circuit to anything outside the box while a helmet is plugged in.** | A rule: "use a power bank". The box shares its ground with the USB socket | A battery inside the box and a three-pole RUN / CHARGE switch. CHARGE connects the charging socket to the battery, removes power from the electronics and opens the LED feed of M2. RUN disconnects both poles of the charging socket. The controller's USB socket is inside the box, or goes through a USB isolator. Control during a session is by Bluetooth | A fault of 4.5 mA is nine times the 0.5 mA contact-current reference level (ICNIRP 2010 p.12 [828], Table 5), and that is with the resistor in the path. A mains fault through a charger has no such resistor | H2, H1 | Switch about CHF 4; cell with charger and 5 V converter about CHF 8, or the power bank already in the parts list. Isolator chip ADuM3160 USD 7.5–15 *listed*, only if USB is wanted during sessions |
| **M5** | **Every update is latched by a hardware timer.** | A task wakes on the timer, sends eight words and then pulses LDAC. The delay from timer to latch is unbounded and unmeasured. Display board: LDAC tied high, the outputs change one after another | A timer peripheral drives LDAC itself: one low pulse every 500 µs. The same event wakes the task, which sends the eight words for the next pulse. If fewer than 150 µs remain it sends nothing, the outputs repeat, and the period is counted as an overrun. The display board needs a pin for LDAC | The lab reports 50 to 190 µs of latency per point and rests its objection to the Uppsala replication on timing. A replication must show that its own error is below the lab's best figure, 50 µs | C3 | No parts. Firmware: `sequencer.cpp:382–442`, `:470–472`. Every output is one period (0.5 ms) late, all eight alike |
| **M6** | **At least 127 steps each way at the lowest strength the papers can mean.** | 12 bits over ±4.54 mA: one step is 2.2 µA. A program at 1 µT at the scalp uses 10 steps, at 5 µT 51 | A second range: 33 kΩ in series with each 2.2 kΩ, in a plug between box and helmet cable. One step is 0.139 µA, so 1 µT at the scalp uses 163 steps. The range tops out at 12.6 µT at the scalp (0.53 µT at 20 mm). A link in the plug tells the firmware which range is fitted. Per-channel zero trim in both ranges | The lab's DAC kept 256 levels at any strength, because its gain came after the DAC. Its scalp figures are 1 to 10 µT. The worst-case idle offset in the present range, 109 µA, is 4.8 µT at the scalp: five times a 1 µT signal. In the low range it is 0.30 µT, and typically 0.025 µT | B1, B3, B4 | 8 resistors, 2 RJ45 jacks, a small box: about CHF 5. Firmware: a range constant (M1), a trim per channel, a check of the link before every session. A wrong range would be an error of 16 times, so the session must not start if link and setting disagree |
| **M7** | **A field value with a stated uncertainty of ±10 % at 20 mm, traceable to a magnetometer.** | The default 1.8 µT/mA is the model. A phone gives about ±35 % | A three-axis magnetometer on a printed jig that holds the coil's axis on the sensor at 20.0 and 40.0 mm, ±0.5 mm. Each coil measured at both distances with the current reversed. The log of every session records whether its µT/mA is the model's or measured, with the date | The field falls 11.7 % per mm at 20 mm and 6.6 % per mm at 40 mm. ±3 mm of sensor position is ±35 %; ±0.5 mm is ±6 % | G1, H5 | SparkFun MMC5983MA breakout USD 18.50 *listed*; jig about CHF 2 of filament. Check the sensor's range, noise and the place of its sensing element in its data sheet before buying: this page did not |
| **M8** | **Every session records the current that flowed in each coil.** | Nothing. The DAC cannot be read back. A real session with a dead coil is logged as real | A 100 Ω sense resistor in each coil's return, an 8-to-1 multiplexer, one amplifier and a converter. One channel is sampled per update, so each coil every 4 ms. The log gets, per coil, the ratio of measured to commanded current. Before every session, real and sham alike, each coil is checked with about 2.2 µA (one step in the high range, 16 in the low one; about 0.1 µT at the scalp) for 20 ms. A session is never stopped because of this check, since only real sessions could fail it | Uppsala could show the field only before and after the study; the lab's reply questions whether it was present. In the 83 programs that drive coils in opposite directions the currents cancel in a shared return, wholly or in part, so a single sense resistor there would read little or nothing in the sessions that matter most | E3, D2 | Parts about CHF 12. The ceiling falls to 4.34 mA (192 µT at the scalp, 8.1 µT at 20 mm), 4.3 % less |
| **M9** | **No bare metal and no single layer of enamel between a winding and the scalp.** | Kapton tape, heat-shrink or glue "to protect the windings". The core is bright threaded metal | Each coil in a closed plastic cap or potted, the core's end covered, nylon screws only. Checked with a meter: no continuity from either lead to anything that can touch skin | The coil sits on the scalp. With M4 in place one insulation fault is harmless. Two faults on coils of opposite sign put up to 4.5 mA through the scalp between them | H1, H2 | About CHF 3 |
| **M10** | **Before any blind series, the helmet is shown to give no cue.** | Sound, vibration and warmth of the coils have never been measured | Bench line 7 of the audit: 20 starts at the highest setting, real or sham at random, an observer guesses. Pass: 14 or fewer right. If it fails, pot the coils and repeat | Sham effects are established in four independent groups. A blind that leaks makes every later comparison worthless | E1 | No parts |

## Should

| # | Requirement | Old | New | The number that forces it | Ledger | Cost |
|---|---|---|---|---|---|---|
| **S1** | **Edges of about 0.1 ms.** | Steps settle in 2 to 7 µs | A capacitor across each feedback resistor of the module's output amplifiers: 3.9 nF across the 12 kΩ and 390 pF across the 120 kΩ of every channel. Both give 46.8 µs, a rise of 103 µs from 10 to 90 % | The ring paper gives "0.1 ms". The present edges are 15 to 50 times faster, so the induced spike at each step is 7 to 23 times higher than with a 47 µs time constant (2–7 µs against 46.8 µs) | C2 | 16 capacitors, about CHF 1, and fine soldering on the module. Not a must: the lab states a rise time for the ring only, and the field after 0.1 ms is the same. Do not shape the edge with a capacitor after the limit resistor: charged to 10 V while the coil circuit is open, a 470 nF capacitor would drive 49 mA through the coil when the circuit closes, decaying in about 0.1 ms (10 V into 100 Ω + 100 Ω + 4.2 Ω; 204 Ω × 470 nF = 96 µs). That would bypass the limit resistor |
| **S2** | **Two coils per channel for ring and Shiva programs.** | One coil per position | Two coils in series at each position, 16 in all, mounted side by side and wound the same way | The ring had two solenoids in each of its 8 containers, the Shiva 16 coils on 8 channels. In series the current changes by 0.19 %. 47 programs use a ring placement | A2 | 8 coils: CHF 14.56 *listed* (4 packs of 2 at CHF 3.64). The field per mA of a pair is not twice a single coil's close to the head: calibrate the pair (M7) |
| **S3** | **The room's field is logged with each session.** | Kp and ap from the web | The magnetometer of M7, 10 s before each session: the steady field and the amplitude at mains frequency | The lab's chamber was below 0.01 µT from 1 Hz to 1 kHz. Homes average about 0.07 µT, the size of the lab's mid-head figure | F1, F2, I4 | No parts beyond M7. A sensor read 1000 times a second is needed to see 50 Hz |
| **S4** | **The core is characterised.** | Material unknown. Remanence and step response unmeasured | Bench lines 5 and 6 of the audit. If the remanence exceeds 1 µT at the coil face, every session ends with a decaying alternating current | The seller says ferrite; the photo shows bright threaded metal. A magnetised core is a steady field in the sham arm too | A3 | A pickup coil of 50 turns. Firmware for the decaying current, if needed |

## Nice

| # | Requirement | Why only nice | Ledger | Cost |
|---|---|---|---|---|
| **N1** | A second helmet in series with the first, coil for coil, for two people at once | It gives both rings the same current by construction (0.19 % less with one coil per position, 0.57 % with two; 20 m of 0.14 mm² wire adds 2.5 Ω, another 0.11 %). But the only source is one lab, the outcome is an EEG measure, and the rig has no EEG. With two people on one circuit, M4 and M9 carry more weight | D3 | 8 or 16 coils, a second band, 10 m of cable: about CHF 35 to 50 |
| **N2** | A trigger output for an external EEG, through an optocoupler | The lab's EEG findings cannot be checked without one, but no EEG is part of this rig | C5 | About CHF 1 |
| **N3** | Printed coil holders with site marks | Placement by tape is good to ±5–10 mm, and no source gives a coordinate that is tighter | A4 | Filament |
| **N4** | The 72-hour rule enforced, not only warned | It is this project's own rule; one person testing themselves decides | H7 | Firmware only |

## Not justified

- **More channels or 64 coils.** One lab hat had 64 solenoids in 8 columns; it was still driven on 8 channels (A2). Eight coils per channel on a band are not practical, and no result depends on them.
- **A higher current.** See the first table. The present ceiling already reaches the reference level at the scalp.
- **A 16-bit DAC in place of the range plug.** It gives the same 163 steps at 1 µT at the scalp (0.138 µA per step over ±4.54 mA) and costs about USD 24 for an AD5676R *listed*, plus a new output stage. The range plug costs CHF 5 and lowers the ceiling of the range it is used in, which is a gain for safety. A new driver would be the place for a finer DAC; this build is not.
- **Shielding the room.** The lab's chamber was an acoustic room and a Faraday cage. A cage of copper mesh does nothing against the mains magnetic field: the skin depth of copper at 50 Hz is 9.2 mm (calculated from its resistivity, 1.68 × 10⁻⁸ Ω m). Magnetic shielding of a room costs thousands, and no source shows that an effect depends on it. Log the field instead (S3).
- **A chamber.** The lab holds that the setting is necessary (F1). That is a matter of the room, darkness and quiet, not of the helmet. The parts list keeps its blindfold.

## The architecture

One signal path per coil, eight alike. Parts in brackets are new.

```
                    ┌─────────────── control box, on its own battery [M4] ───────────────┐
 timer ──► LDAC [M5]│                                                                     │
 ESP32 ──SPI──► AD5328 module ──► 2.2 kΩ ──► [range plug: link or 33 kΩ, M6] ────────────►│══ cable ══► coil (or two
        │        ±10 V, [3.9 nF / 390 pF      fixed limit [M1]                            │            in series, S2)
        │         in the feedback, S1]                                                    │               │
        │                                                                                 │◄══ cable ═════┘
        │        [100 Ω sense, M8] ◄── [PhotoMOS k, M2] ◄── this coil's own return ◄──────│
        │              │                    ▲ LED
        │              ▼                    │
        │     [mux ► amplifier ► ADC]   5 V ► [STOP, latching, normally closed] ► [hand STOP] ► [activity gate
        │              │                         on SYNC, M3] ► arming pin (DevKit) ► LEDs of the 8 PhotoMOS
        └──────────────┘ log: current per coil
 [RUN / CHARGE switch]: CHARGE feeds the battery and opens the LED chain; RUN disconnects the charging socket.
 Outside the box: the [magnetometer on its jig, M7, S3], used with the helmet off the head.
```

What each block guarantees:

- **The resistor** limits the current whatever the firmware does. With M8 in the path it is 10 V / 2304 Ω = 4.34 mA.
- **The LED chain** is the only way to close a coil circuit. Any one of four things opens all eight: a STOP button, a stopped stream of DAC writes, the arming pin, the CHARGE position. None of them needs code to run.
- **The timer** fixes when the field changes. The task only decides what the next value is.
- **The sense path** tells real from intended, coil by coil, and the log keeps it.
- **The range plug** sets the ceiling in copper: 4.34 mA without it, 0.283 mA with it.

### Parts and cost

| Requirement | Parts | Cost |
|---|---|---|
| M2 | 7 × AQY212EH, 4 × 430 Ω, latching STOP button, hand-held STOP | about CHF 25 |
| M3 | Capacitor, two diodes, transistor, resistors | about CHF 1 |
| M4 | Three-pole switch, cell with charger and 5 V converter | about CHF 12 |
| M6 | 8 × 33 kΩ 1 %, 2 RJ45 jacks, small box | about CHF 5 |
| M7 | Magnetometer breakout, printed jig | USD 18.50 *listed* + about CHF 2 |
| M8 | 8 × 100 Ω 0.1 %, multiplexer, amplifier, converter | about CHF 12 |
| M9 | Caps or potting compound | about CHF 3 |
| **Musts** | | **about CHF 80** |
| S1 | 8 × 3.9 nF, 8 × 390 pF | about CHF 1 |
| S2 | 8 coils | CHF 14.56 *listed* |
| Bench | 24 MHz logic analyser (already optional in the parts list) | about CHF 10 |
| **With the shoulds and the analyser** | | **about CHF 105** |

M1, M5 and M10 need no parts. The estimates are for single pieces from a hobby supplier and can be off by a factor of two.

### Firmware changes this page specifies

Not implemented. File and line as in the audit.

| For | Change | Where |
|---|---|---|
| M1 | Series resistance as a build constant per range; reject settings whose full-scale voltage or coil resistance contradict it; clamp in mA before µT | `settings.cpp:127–146`, `config.h:141` |
| M3 | Keep writing the DAC in sham and during fades, so that the activity gate behaves the same in both arms; stop writing at session end | `sequencer.cpp:351`, `:220` |
| M5 | LDAC from a timer peripheral; the task writes ahead by one period and skips a period it cannot finish | `sequencer.cpp:382–442`, `:470–472`, `dac.cpp:122–126` |
| M6 | Range from the plug's link, checked before every session; zero trim per channel and range | `settings.cpp`, `dac.cpp` |
| M7 | Calibration record: µT/mA per coil, distance, instrument, date; the session log says "model" or "measured" | `settings.h`, session log |
| M8 | Sample one sense channel per update; per-coil ratio in the log; the one-step check before every session | `sequencer.cpp`, session log |
| H8 | Set the watchdog times in the firmware instead of inheriting them | build configuration |

## How each requirement is checked

| Requirement | Check | Pass |
|---|---|---|
| M1 | Audit bench line 4 | 2.2 kΩ ± 1 % on every channel |
| M2 | A pair program running; hold the controller in reset; measure the voltage across every limit resistor. Then the same with each STOP button | Under 2 mV (1 µA) on all eight within 20 ms. On the present build this test fails |
| M3 | Power on with the helmet plugged in and a meter across one limit resistor; then stop the firmware in a debugger in mid-session | No current before the first session; none 10 ms after the writes stop |
| M4 | Audit bench line 10; a meter between the coil return and the charging socket in RUN | Open circuit |
| M5 | Audit bench line 1 | Every latch within ±50 µs of the grid; overruns counted and zero |
| M6 | Audit bench line 3 in the low range, with a 1 µT scalp program | The table's levels are distinct; idle current under one step after trimming |
| M7 | Audit bench line 2 | Eight coils within ±10 % of each other; the ratio of the two distances 5.7 ± 15 % |
| M8 | Unplug one coil and run a real session | The log names the coil and marks the session |
| M9 | Meter from each lead to the outside of each coil | No continuity |
| M10 | Audit bench line 7 | 14 or fewer right out of 20 |

## What these requirements do not fix

- **The dose.** With M6 and M7 the rig can deliver either reading of the papers with a known uncertainty. Which reading is right is not a hardware question (B1, A5).
- **The burst-firing file.** It exists as a small printed figure. Every burst program stays an approximation (C5).
- **The lab's field map.** No small coil gives 1 µT at the edge of the skull and 0.1 µT in the middle of the head (A5).
- **The setting.** No chamber (F1).
- **The clinical methods, uniform fields and nanotesla work.** Out of reach for this coil at any current this page allows (I1 to I4).
