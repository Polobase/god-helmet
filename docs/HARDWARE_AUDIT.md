# Hardware audit: can this rig host the experiments in the library?

**Short answer.** The first build can deliver what the Persinger laboratory's papers describe, as far as those papers describe it: eight small cored coils, one waveform routed from coil to coil, points of 1 or 3 ms, microtesla fields near the scalp. It cannot deliver the clinical low-field methods, the room-size uniform fields or anything in the nanotesla range. Three things stand between the rig and a claim of replication, and none of them is the coil:

1. **The dose is not defined by the sources.** The lab's own figures for one helmet run from 0.1 to 9 µT depending on paper and place, and its meter reading changed with the point duration of the file. This rig can match the lab's scalp figure or its mid-head figure, not both.
2. **Timing is unmeasured.** Updates are latched by a task that follows the timer, so how late a single update can be is unknown. The lab's main objection to the one independent replication is about timing.
3. **Nothing verifies delivery or enforces the safety rules.** An open coil goes unnoticed, and "battery only" is a sentence in a document. STOP and the arming switch open one wire that all eight coils share: that stops the current only if the firmware also sets the outputs to zero. With the firmware hung, a coil keeps 87 to 100 % of its current (H3).

This page is the evidence. [HARDWARE_REQUIREMENTS.md](HARDWARE_REQUIREMENTS.md) turns each gap into a requirement, and [PRESET_AUDIT.md](PRESET_AUDIT.md) checks every program against its source.

## Scope and method

- **Audited:** [hardware/BOM.md](../hardware/BOM.md), the two schematics ([schematic.svg](schematic.svg), [ad5328-module.svg](ad5328-module.svg)), the firmware in `firmware/` and the docs that describe them. The coil is fixed: 19 × 12 mm, 495 turns, 4.2 Ω, cored. The driver board in `hardware/pcb` is not judged here.
- **Sources:** the downloaded library (`library/`, 943 files on 2026-11-19, 919 index entries). Eleven readers went through the sources cited by the 198 programs the library held at the start, family by family. Every number taken from a PDF was read on the page image, because the text layers confuse µT with mT and drop minus signs. Pages are PDF page numbers with the printed page in brackets, for example `p.3 [661]`.
- **Evidence words** as everywhere in this project: **established** (independent replication), **single-lab**, **claim**, **anecdote**, **unverified**. Here they grade the statement about the apparatus, not the effect.
- **Measured or calculated.** A source value is *measured* when the paper names an instrument or says it was measured, otherwise *stated*. Every value about this rig is **calculated**: nothing on the rig was measured for this audit. The calculations are listed with their inputs [at the end](#calculations). The last section says what to measure.

## Verdict by experiment family

| Family | Verdict | Binding constraint |
|---|---|---|
| Lab helmet over the temporal lobes (burst-firing, Thomas pattern, the two-phase "sensed presence" session) | **Suited, with caveats** | Dose undefined by more than a decade (B1, A5). Timing unmeasured (C3). The burst-firing file was never published (C5). No chamber (F1) |
| Ring of eight positions ("Octopus"), including the Swann sessions | **Suited, with caveats** | One coil per position where the lab had two (A2). The papers disagree on the sign of the dwell change (C4). Same dose and timing caveats |
| Shakti and Shiva sessions (Murphy) | **Suited, with caveats** | No vendor signal is published as numbers, so every program is an approximation (C5). The hardware is not the limit |
| Two people at once (yoked pairs, "excess correlation") | **Not suited as built** | Needs a second ring carrying the same currents (D3), and an EEG on each person |
| Whole-head or whole-body uniform fields (Cnp in the Helmholtz frame, Bell, Ghione, the geomagnetic rotation) | **Not suited** | A small coil cannot make a uniform field, and at 60 mm it is 57 to 400 times too weak (I1) |
| Cnp headset | **Suited at the surface only** | Reaches the headset's 400 µT at the coil and ±200 µT at the scalp; 70 times too weak deep in the head (I1) |
| LFMS, T-PEMF (Re5), theta-burst, 40 Hz, 10 Hz tACS timing | **Not suited** | The induced electric field is 2 to 500,000 times too low and lasts microseconds, not the source's hundreds of microseconds (I2) |
| Static-magnet stimulation (tSMS), rotating magnets (sTMS) | **Not suited** | 0.48 mT at the coil face against 512 mT at the magnet (I3) |
| Nanotesla and picotesla fields (geomagnetic simulations, Schumann at natural strength) | **Not suited** | One DAC step is 4 nT at 20 mm, the idle offset can be 200 nT, and a home's mains field is of that order (I4) |
| Sham-helmet studies | **Suited** | Sham is the one condition the rig delivers exactly (E1) |

### What physics puts out of reach

- **A direct effect on neurons.** Smooth signals induce about 1 µV/m in the brain, and steps a few mV/m for microseconds (calculated, [SIGNALS.md](SIGNALS.md)). Brain slices respond from about 0.1–1 V/m. No setting of this rig, and no small coil at 4.5 mA, closes five orders of magnitude.
- **Depth without surface.** A coil's field only falls with distance: 44 µT/mA at the scalp, 1.86 at 20 mm, 0.33 at 40 mm, 0.06 at 75 mm (calculated). The amygdala and the hippocampus lie 40–60 mm from the nearest site ([PLACEMENT.md](PLACEMENT.md)). A program named after a deep structure names the signal, not the place the field reaches.
- **Uniform fields.** Sources that used Helmholtz or Merritt coils exposed the whole head evenly. Eight local coils cannot.
- **The lab's own field map.** The lab reports a fall of 2 to 10 times from the edge of the skull to the middle of the head (A5). A small coil falls about 370 times over that distance, even with its partner on the other side helping. Either the lab's coils were not small dipoles or its meter did not read the field of the coils. No small-coil hardware can reproduce both ends of that map.

### What this rig can never conclude

- **That the field caused an experience.** Sham helmets produce the same reports in people who expect them, in four independent groups (E1). One unblinded session says nothing about the field. Only real against sham over many sessions does, and the rig is built for that ([EXPERIMENTS.md](EXPERIMENTS.md)).
- **That a null result refutes the lab.** With the dose undefined, a null at one setting leaves the other end of the bracket open. A null means something only if the sessions spanned the bracket (B1).
- **Where in the brain anything happened.** There is no depth selectivity and no EEG.
- **Anything about the clinical methods.** Their timing is copied at one hundredth to one hundred-thousandth of their strength.
- **Anything about psi.** That is decided by the trial design (commitment, blind judging, statistics), not by the coils.

## Ledger

Columns: the claim about the source's apparatus; where it is stated; what hardware would have to do to match it; what this rig does; the gap. Source keys are listed [below](#sources).

### A. Coils and geometry

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| A1 | The lab helmet had four solenoids on each side. Each was wired to its counterpart on the other side, and one left-right pair was on at a time | R93 p.3 [73]; P00 p.3 [661] and Fig. 1 p.4 [662]; PH02 p.2 [534]. R92 p.2 [668] says "four pairs … on each side". Single-lab | Drive 8 coils as 4 left-right pairs, one pair at a time | 8 separate channels (`spatial.h:20`). A pair is two channels with the same signal; `cycle` with `side: both` steps both sides together | None in the hardware. The programs that model the lab helmet now drive four pairs this way; before this audit most used two fixed coils per side ([PRESET_AUDIT.md](PRESET_AUDIT.md)) |
| A2 | The ring had 8 positions with 2 solenoids in each container, 16 in all. Shiva: 16 coils on 8 channels. One lab hat: 64 solenoids in 8 columns | TS04g p.4 [1186]; C99 p.1 [61]; Saroka 2010 pp.4–5 [469–470]. The patent puts the two of a pair on opposite sides of the head (PAT76 p.5 col.3). Single-lab; vendor claim | Two coils per channel; eight per channel for the 64-coil hat | One coil per channel, 8 coils in the parts list. Two coils in series change the current by 0.19 % (calculated) | 8 more coils, wired in series pairs. 64 coils are not practical on a band |
| A3 | Solenoid: the 250 Ω coil of a 5 V reed relay with the reed replaced by a small steel nail | R93 p.3 [73]; PAT76 p.5 col.3 (Intertan 275-232). Single-lab | Be a small cored dipole | A small cored dipole: 495 turns on a core with an M3 thread. The seller says ferrite; the listing photo shows bright threaded metal, which ferrite is not | The core material is unknown. Its low-frequency gain is set by its shape ([SIGNALS.md](SIGNALS.md)), but remanence and the response to steps are unmeasured |
| A4 | Helmet: an ellipse 7.5 × 5 cm per side, long axis at mid-temporal level. Ring: every 45° in the horizontal plane just above the ears, position 1 left prefrontal, none on the midline. No paper gives a 10-20 site for a coil | H96 p.2 [202]; R93 p.3 [73]; R02 p.3 [673]; C99 p.2 [62]. Single-lab | Hold 19 mm coils on a 7.5 × 5 cm ellipse and on a 55–60 cm ring | A Velcro band 6–8 cm wide, any 10-05 site, placed by tape to about ±5–10 mm ([PLACEMENT.md](PLACEMENT.md)) | None in the hardware. The site names are this project's inference, and the docs say so |
| A5 | Fall-off in the lab's helmet: 2–4 µT at the edge of the skull against 0.8–1.1 µT between the two sides; 1 µT inside the helmet against 0.1 µT at the midpoint. One lab solenoid alone: 5 µT at its surface, 0.18 µT at 2 cm | R93 p.7 [77] (measured, Metex M-3800); PH02 p.3 [535] (measured, "a sensor"); K02 p.4 [992] (measured, Metex N380). Single-lab | Nothing a small coil can do | 742 times weaker at 75 mm than at the scalp for one coil, 371 times with the opposite coil aligned (calculated) | The rig matches the lab's scalp figure or its mid-head figure, never both. The single-solenoid data (28 times from its surface to 2 cm) are of the same order as this coil's (24 times from 3 to 20 mm, 56 times from the face); the helmet data are not |

### B. Field strength

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| B1 | Helmet: 1–5 µT "over the activated hemisphere"; a 2 µT peak, and 5 µT right with 1 µT left, "at the level of the scalp"; 7–9 µT over the stimulated side; 1 µT "at distances equivalent to within the cerebrum". Ring: 5–10 µT at the scalp, or 0.5–1.5 µT near it. The copy sent to Uppsala: 3–10 µT at intracranial distance | H96 p.3 [203]; P00 pp.3, 5 [661, 663]; R92 p.2 [668]; SP06 p.6 [1084]; C99 p.2 [62]; R02 p.3 [673]; TS04g p.5 [1187]; GQ05 p.3 (measured, BMM3 meter). Single-lab, except GQ05: an independent measurement of lab-built hardware | Deliver 1–10 µT at the scalp, or 1–10 µT inside the head, whichever the papers mean | Up to 201 µT at the scalp, 8.4 µT at 20 mm, 1.5 µT at 40 mm (calculated). A program's 1 µT is 24 µT at the scalp and 1 µT at 20 mm | The range covers both readings. Which one a program should match is undetermined: 0.04 µT at 20 mm reproduces "1 µT at the scalp", 3–10 µT reproduces Uppsala's reading. Programs record the source's statement in `dose` and keep their setting |
| B1a | The lab's reading depended on the file's timing: 0.8, 0.5 and 0.3 µT for 1, 2 and 3 ms points at the same gain | PB99 p.4 [489]. Single-lab | – | – | The lab's meter did not read peak field. Its microtesla figures are not peak values, and no conversion is published |
| B2 | The weaker side was attenuated, not switched off: 9–10 to 1, 5 to 1, 2–3 to 1 or "about 10 %", depending on the paper | R92 p.2 [668]; T94 pp.2–3; H96 p.3 [203]; P00 p.3 [661]; PH02 p.3 [535]; S13 pp.4–5 [398–399]. Single-lab | Set the two sides' levels separately, from 1:1 to 10:1 | `weights` −1…1 per channel (`preset_json.cpp:156–166`) | None |
| B3 | 8-bit DAC, values 0–255 as −5…+5 V (the patent: ±6 V): 256 levels at any strength, because the gain came after the DAC | P00 Fig. 1 p.4 [662]; SP06 p.6 [1084]; PAT76 p.5 col.3. Single-lab | Keep at least 127 steps each way at the programmed strength | 12 bits over ±4.537 mA: one step is 2.2 µA, 4.1 nT at 20 mm, 98 nT at the scalp. 1 µT at 20 mm uses 243 steps. 1 µT at the scalp uses 10; 5 µT at the scalp uses 51 (calculated). Linearity error ±2 steps typical, ±16 maximum (AD5328 data sheet p.4) | Below about 0.26 µT at 20 mm (6 µT at the scalp) a point table loses levels. The lab's scalp figures cannot be played at the lab's resolution |
| B4 | The lab's sham setting added 20–40 nT of steady field on one side | SP06 p.6 [1084] (measured, MEDA FM-300). Single-lab | Keep the steady offset small against the signal | DAC offset ±5 mV typical, ±60 mV maximum (data sheet p.4), times 4 in the module: ±9 µA typical, ±109 µA maximum. That is 0.02 or 0.2 µT at 20 mm and 0.4 or 4.8 µT at the scalp (calculated). The bench test accepts ±20 mV | At a scalp-referenced 1 µT the worst-case offset is five times the signal. The firmware has no zero trim per channel |

### C. Timing and waveform

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| C1 | Each value was held for 1 or 3 ms (1 to 20 ms in one study) | SP06 p.6 [1084]; C99 Table 1 p.2 [62]; B03 p.1 [951]. Single-lab | Hold values for multiples of 1 ms, all coils changing together | 0.5 ms tick (`config.h:139`); all 8 outputs latched by one LDAC pulse (`dac.cpp:122–126`). The coil with its resistor follows in 1.9 µs (calculated) | None for these signals. Out of reach: LFMS ramps of 256 µs, sound-card files at 11–22 kHz |
| C2 | "The rise time was 0.1 ms" (ring). No source gives one for the helmet | TS04g p.5 [1187]. Single-lab | Nothing strict | Steps settle in 2–7 µs ([SIGNALS.md](SIGNALS.md), from the DAC's 0.7 V/µs slew rate, data sheet p.5) | Steps are 15–50 times faster than the lab's. The field is the same after 0.1 ms; the induced spike at each step is correspondingly higher and shorter |
| C3 | The lab's computers added a latency to every point: 190 µs, 140 µs, about 100 µs or about 50 µs, depending on the PC. So a "1 ms" point lasted up to 1.19 ms. The lab says faster PCs and Windows "distort the timing", and rests its objection to the Uppsala replication on that | R93 p.7 [77]; P99 p.3 [165]; SP06 p.6 [1084]; C99 p.3 [63]; PK05 p.1 [346]. Single-lab; the distortion claim is untested | Keep the point period within a few percent, keep the jitter of each update far below 1 ms, and be able to show it | The timer (1 MHz base, `sequencer.cpp:470–472`) wakes a task, which sends eight words and then latches (`sequencer.cpp:382–442`). The mean rate is crystal-accurate. Late periods are counted and skipped (`overruns`, `:435`). On the C3 and C6 boards the loop shares its one core with Bluetooth | The delay from timer to latch is unbounded and has never been measured. The claim "exact to 0.5 ms" rested on the timer alone |
| C4 | Helmet: 0.5 s per pair, 2 s per turn, not locked to the pattern. Ring: a time on the first position and a change at each next one. Five papers read "+" as longer, six as shorter | R93 pp.3, 8 [73, 78]; C99 p.3 [63] ("100 ms at the first solenoid, 120 ms at the second"); TS04g p.5 [1187] ("less time (+, for acceleration)"). Single-lab | Switch a running waveform between coils on its own clock, with a dwell that changes per step | `dwell: [start, step, end]`, at least 0.5 ms, separate from the pattern's clock (`spatial.cpp`) | None in the hardware. A schedule that runs down to 1 ms and stays there (Booth 2008: 100, 80, 60, 40, 20, 1, 1, 1) cannot be written as one ramp |
| C5 | Only one waveform is published as numbers: the 849-point Thomas table. The burst-firing file has 230, 248, 250, 289 or 290 points depending on the paper; its shape is printed as a small figure. No vendor signal is published | US 6,234,953 Table 1 p.48; P00 p.5 [663] Fig. 2; S13 p.5 [399]. Single-lab; vendor claim | Play 8-bit tables of up to about 1000 points | Tables of up to 8192 points (`preset_json.h:32`) | None in the hardware. The gap is in the sources |
| C6 | 20–40 min per pattern; sessions of 20 + 20 or 30 + 30 min. Ghione: 90 min. Schumann devices: all night | PK05 p.1 [346]; P00 pp.3–6; S13 pp.4–5. Single-lab | Run 60 min | 60 min, enforced by the parser (`preset_json.cpp:286`) | None for the lab protocols. 90 min and overnight are excluded on purpose ([SAFETY.md](SAFETY.md)) |

### D. Channels

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| D1 | One DAC made one waveform; a selector sent it to one channel at a time. The Shakti helmet played two different signals, one per side | C99 Fig. 1 p.2 [62]; PAT76 pp.4–5; TS04e p.5 [1017]. Single-lab | One waveform routed to any coil; two at once for the Shakti | Two waveforms at once, each weighted onto the 8 coils (`session.h:27–31`) | None |
| D2 | Pairs were driven so that the field passed through the head, or in opposition. The Shakti wires each pair as one + and one − coil | P00 Fig. 1 p.4 [662]; PAT76 p.5 col.3; vendor pages (claim) | Bipolar drive, polarity per coil | ±10 V from the module; a negative weight reverses a coil (`preset_json.cpp:163`) | None in the hardware. With all coils mounted the same way round, a left-right pair driven with the same sign cancels at the midline. A through-the-head pair needs one side reversed. The programs that model the lab helmet now do this with negative weights on the right side ([PRESET_AUDIT.md](PRESET_AUDIT.md)). A pair driven this way is also the case in which the arming switch stops nothing (H3) |
| D3 | Yoked pairs: two identical rings, the same configuration given "simultaneously … to both members of a pair", in rooms 5–10 m apart, from one computer | Persinger 2010 p.2 [232]. Single-lab | A second ring carrying the same currents | One ring. The parts list offers a second controller, but two controllers have no common clock | A second ring in series with the first, coil for coil, carries the same current by construction (0.19 % less, calculated) |

### E. Sham and blinding

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| E1 | Sham in the lab: everything on except the last switch, or the program never started. In Uppsala: allocation by an experimenter who never met the participants. Under a helmet that emits nothing, people report presences and more, in Uppsala, Aarhus, Amsterdam (twice) and West Georgia | R93 p.5 [75]; PH02 p.3 [535]; SP06 p.6 [1084]; GQ05 p.3. The sham effect: established | Zero field with everything else the same, chosen out of the operator's sight | Every output held at zero while the arming switch closes as in a real session (`sequencer.cpp:351`, `:220`). Live levels are withheld when blind (`rpc.cpp:480–483`). The offset of B4 is the same in both arms | Sound, vibration and warmth of the coils at up to 4.5 mA have not been measured. Coil heat is 0.09 mW (calculated), so warmth is implausible |
| E2 | Uppsala was double-blind. The 8 Coil Shakti test was not: "the experimenter knew" | GQ05 p.3; Gendle 2012 p.7 [223]. | Choose and record the condition without a person | Hardware random bit (`control.cpp:92, 204`); the log entry is written and read back before the outputs come on (`control.cpp:125–141`); revealed after the rating | None for one person testing themselves. The random source is not characterised |
| E3 | Uppsala checked the field before and after the study and relied on a light on the unit for each session. The lab says it verified "the presence of the field" before each subject | Larsson reply p.1 [348]; PK05 p.1 [346]. | Record, for every session, that current flowed in every coil | Nothing. The AD5328 cannot be read back. An open coil, a broken wire or a wrong resistor is not noticed during a session | A real session with a dead coil is logged as real |

### F. Setting

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| F1 | An acoustic chamber that was also a grounded Faraday cage (2.74 × 2.54 × 1.98 m), dark or with one red lamp of about 1 lux, eyes covered, an armchair. Background field below 0.01 µT from 1 Hz to 1 kHz | SP06 p.5 [1083]; R92 p.2 [668]; R93 p.4 [74] (measured). Single-lab | Not a matter of the helmet | A blindfold in the parts list | No chamber. The lab holds that the setting is necessary; a living room is a different experiment in that respect |
| F2 | The lab tested only on days with a geomagnetic A index of 20 or less, and reports correlations with geomagnetic activity above 20–30 nT | C97 p.5 [687]; SP06 p.6 [1084]. Single-lab | Record the conditions | Kp and ap are stored with every session (`envdata`) | No measurement of the field in the room. Mains fields in homes average about 0.07 µT ([SAFETY.md](SAFETY.md)), the size of the lab's mid-head figure |

### G. Calibration

| # | Claim | Source · grade | The hardware must | This rig | Gap |
|---|---|---|---|---|---|
| G1 | The lab used a multimeter with a magnetic sensor (Metex M-3800, N380), a "power meter" and an AC milligauss meter. Uppsala used a BMM3 meter, the Shakti study a hand-held Gauss Master reading RMS at 9 cm | R92 p.2 [668]; SP06 p.6 [1084]; GQ05 p.3; Gendle 2012 p.11 [227] | State a field with a known uncertainty, at a known place, for the waveform actually played | The default 1.8 µT/mA is a model (`settings.h`). The phone method puts the coil 20 mm from a sensor about 1 cm inside the phone, read 100 times a second. The field falls 11.7 % per mm at 20 mm (calculated) | Every µT in this project is calculated. With the sensor's position known to ±3 mm, a phone calibration is good to about ±35 %. Nothing checks a waveform with 1–3 ms points |

### H. Safety interlocks

| # | Interlock | What the docs claim | What the hardware and firmware do | Gap |
|---|---|---|---|---|
| H1 | 2.2 kΩ current limit | 4.54 mA per coil, which no setting can exceed | True at the resistor: 10 V / 2204 Ω (calculated). 4.8 mA with tolerances, 5.4 mA with an amplifier at its 12 V rail, 7.3 mA with a regulator shorted through as well (16 V). The firmware's own arithmetic accepts a series resistance from 470 Ω to 100 kΩ (`settings.cpp:127–134`) and does not check the full-scale voltage or the coil resistance (`:135–136`) | The resistor is the only limit that does not depend on settings, and nothing checks its value. The parts list offered 1 kΩ for a "higher ceiling" (10 mA); that line is corrected. If the insulation failed, 4.5 mA is nine times the 0.5 mA contact-current reference level (ICNIRP 2010 p.12 [828], Table 5) |
| H2 | Battery only | "Always use a USB power bank"; over USB only a laptop on its battery | Nothing. The control box shares its ground with the USB cable; the firmware does not look at where its power comes from | A rule, not an interlock. One mains charger with a fault, and one flaw in a coil's insulation, connect a head to the mains |
| H3 | STOP | "Cuts the coil return instantly, independent of Bluetooth, USB and the app" | A falling edge on a pin runs an interrupt that opens the PhotoMOS (`main.cpp:49–54`, `sequencer.cpp:555–564`). The BOOT button counts after 40 ms. On the display board STOP is on the screen | The eight returns join on one bus, and the PhotoMOS sits between that bus and ground ([WIRING.md](WIRING.md)). Opening it lets the bus float to the mean of the eight output voltages; it does not open any coil. One coil driven alone keeps 87.5 % of its current and the seven others carry 12.5 % each in reverse. A left-right pair driven in opposite directions keeps 100 % (calculated). The current stops only when the task writes zero to the DAC, which it does within one tick if it is alive. So STOP is not independent of the firmware, and with the firmware hung it does nothing |
| H4 | Arming and power-on | The return stays open until the DAC is at 0 V | The AD5328 powers up at code 0 (data sheet p.16), which the module turns into −10 V. On the DevKit boards the PhotoMOS is open until a session starts (`main.cpp:117–126`). The display board has none (`config.h:106`) | The open return does protect at power-on, because all eight outputs sit at the same −10 V and no current flows between equal outputs. It does not protect after a reset in mid-session, when the DAC still holds unequal values (H3). On the display board each coil carries 4.5 mA from power-on until the firmware writes zero, and holds its last value through a reset. Only a rule ("wait for the screen") protects the wearer |
| H5 | Field ceiling | User ceiling 5 µT, at most 10 µT at 20 mm | A clamp in firmware (`config.h:141`, `settings.cpp:139–146`), in microtesla computed from the stored µT/mA, which may be anything from 0.01 to 1000. With the defaults 8.4 µT is reachable | The ceiling is as good as the calibration, and the calibration is a model. The real ceiling is the resistor's: 201 µT at the scalp, 0.48 mT at the coil face (calculated), locally above the 200 µT reference level for 25–400 Hz (ICNIRP 2010 p.11 [827], Table 4) |
| H6 | 60-minute cap | The firmware rejects longer programs | The parser does (`preset_json.cpp:286`). A session keeps running if the app disconnects, by design | None. Nothing in hardware ends a session |
| H7 | 72 hours between sessions | "The app warns" | A warning and a second tap (`rpc.cpp:108`) | As documented: not enforced |
| H8 | Watchdog | A hang of about 5 s resets the board | The task watchdog's 5 s and the interrupt watchdog's 0.3 s are the build framework's defaults; the firmware sets neither | During a hang the DAC holds its last value for up to 5 s, and through the reset that follows until the firmware starts again. Opening the arming switch does not end this (H3) |

### I. Other apparatus in the library

| # | Source apparatus | Field or induced field there | This rig at its cap | Ratio |
|---|---|---|---|---|
| I1 | Helmholtz or Merritt frames: Bell (130 cm coils, 20–80 µT rms), Ghione (44 cm, 40–80 µT), Cnp whole-body (±200 µT), Wang (2 m, 35 µT, direction rotated) | Uniform over the head. Bell 1994 p.3; Ghione 2005 pp.1–2; Cook 2004 p.2; Wang 2019 pp.3–4 (measured) | 8.4 µT at 20 mm, 0.5 µT at 60 mm, local | 3.4–24 at 20 mm, 57–400 at 60 mm, and never uniform |
| I1 | Cnp headset: coils under the ear cups | 400 µT at the contact point, ±200 µT at the head surface, ±35 µT deep. Thomas 2007 pp.2–3 | 477 µT at the coil face, 201 µT at the scalp, 0.5 µT at 60 mm | 0.8 at the coil, 1.0 at the scalp, 70 at depth |
| I2 | LFMS gradient coil; theta-burst TMS; Re5 T-PEMF; tACS | 0.72 V/m for 256 µs (Rohan 2014 p.3); 90–500 V/m (Rohan 2004 p.3, Larsen 2020 p.3); 0.01–0.22 V/m for milliseconds (Tang 2026, Martiny 2010 p.2); 0.8 V/m | About 1 µV/m for smooth signals; a few mV/m for 2–7 µs at steps (calculated) | 2 to 500,000, and the durations differ by a factor of 40 to 1000 |
| I3 | Static magnets: tSMS, sTMS | 512 mT at the magnet, 110–190 mT at 2–3 cm (Kirimoto 2016 p.3, measured); 0.64 T at the surface | 0.48 mT at the coil face with DC | About 1,000 at the surface, 13,000–23,000 at 20 mm |
| I4 | Nanotesla fields: 20–70 nT at 7 Hz from coils 1 m apart (Mulligan 2012 pp.1–2); the natural Schumann signal, about 1 pT | Whole-head | One step is 4.1 nT at 20 mm; idle offset up to 200 nT; local | 20 nT is 5 steps, below the offset and below a home's mains field |

The closest tested exposure to this rig in the whole library is not from the Persinger line. van Belkum 2021 used 19 small iron-core coils at 10-20 sites with the T-PEMF pulse at 100 µT at 1 cm, 2.7 times this rig's cap at that distance, and found no difference from sham in 55 patients.

## Bench protocol

Nothing below has been done. Each line gives the instrument and the limit that would count as a pass. The first three decide whether the caveats in the verdict table can be dropped.

| # | Measure | With | Pass |
|---|---|---|---|
| 1 | Time of every LDAC pulse for 60 s while a table with 1 ms points plays and the app is connected. Repeat on a C3 or C6 board | 24 MHz logic analyser on LDAC (in the parts list as optional) | Every pulse within ±50 µs of the 0.5 ms grid, the lab's own best latency (C3). No overruns |
| 2 | Field per mA of each coil at 20 mm and at 40 mm, with the current reversed to cancel Earth's field | A magnetometer whose sensor position is known to ±0.5 mm, on a printed jig | The eight coils within ±10 % of each other. Ratio of the two distances 5.7 ± 15 % (the model's 1.86 / 0.33). This replaces the default 1.8 µT/mA |
| 3 | Current in each coil during a real session | Voltage across each 2.2 kΩ resistor, on a scope or an audio interface | The table's shape with all its levels at the programmed strength; no channel silent |
| 4 | Resistor values and idle offset | Multimeter: each resistor, then the voltage across it with the helmet armed and idle | 2.2 kΩ ± 1 %. Under 20 mV (9 µA) |
| 5 | Core remanence: field at the coil face after 10 s of +4.5 mA, then after −4.5 mA | The magnetometer of line 2, coil against the sensor | The two readings differ by less than 1 µT (0.2 % of the 477 µT at the face) |
| 6 | Response to a step and to sines at 1, 10, 100 and 500 Hz | A pickup coil (50 turns round the coil) on a scope | Within ±10 % of the 1 Hz value up to 500 Hz. Step settled within 0.1 ms, overshoot under 10 % |
| 7 | Sham cue: 20 starts at the highest setting, real or sham by coin, an observer with the coil at the ear guesses | The app's blind start; a contact microphone if available | 14 or fewer right out of 20. With 15 or more the blind is not safe ([EXPERIMENTS.md](EXPERIMENTS.md)) |
| 8 | All eight outputs at full scale | Multimeter on one output during the full-load test | At least 9.5 V: the module's supply holds |
| 9 | Module transfer and power-on state | As in [CALIBRATION.md](CALIBRATION.md) §1 | As written there |
| 10 | Leakage: AC voltage between the coil return and mains earth across 2 kΩ, with the box on its normal supply | Multimeter | Under 1 V (0.5 mA). On a power bank it should read zero |
| 11 | STOP without the firmware: with a program running that drives two coils in opposite directions, hold the controller in reset (EN to ground) and read the voltage across those two limit resistors | Multimeter or scope | Under 2 mV (1 µA) within 20 ms. The first build is expected to fail this: the calculation says the full current keeps flowing (H3) |

## Calculations

All use the coil model in `site/core/engine/field.js` (16 current loops plus a uniformly magnetised core) and the firmware's drive constants. The model has not been checked against a measurement.

| Quantity | Value | Inputs |
|---|---|---|
| Field per mA on the coil axis | 105 µT at the face, 44.3 at 3 mm, 8.15 at 10 mm, 1.86 at 20 mm, 0.329 at 40 mm, 0.111 at 60 mm, 0.060 at 75 mm | `onAxisUtPerMa()`: 495 turns, winding 4.1–9.5 mm radius, 11 mm long, core 4 mm radius × 12 mm |
| Scalp to 20 mm | 23.8 | 44.3 / 1.86 |
| Scalp to mid-head, one coil; with the opposite coil aligned | 742; 371 | 44.3 / 0.060; 44.3 / (2 × 0.060) |
| Fall per mm at 20 mm | 11.7 % | Difference of the model at 19.5 and 20.5 mm |
| Current cap | 4.537 mA | 10 V / (2200 Ω + 4.2 Ω) |
| Field at the cap | 477 µT at the face, 201 µT at 3 mm, 8.44 µT at 20 mm, 1.49 µT at 40 mm, 0.50 µT at 60 mm | 4.537 mA × the values above |
| One DAC step | 2.216 µA; 4.1 nT at 20 mm; 98 nT at 3 mm | 4.537 mA / 2047; × 1.86; × 44.3 |
| Steps each way for 1 µT at 20 mm | 243 (251 with the firmware's default 1.8 µT/mA) | 1 / 1.86 / 4.537 × 2047 |
| Steps each way for 1, 2 and 5 µT at the scalp | 10, 20, 51 | 1 / 44.3 = 22.6 µA; / 2.216 µA |
| Offset current, typical and maximum | 9.1 µA, 109 µA | 5 mV and 60 mV × 4 / 2204 Ω |
| Fault currents | 4.76, 5.44, 7.26 mA | 10.5 V, 12 V, 16 V over 2204 Ω |
| Two coils in series | −0.19 % current | 2204.2 Ω / 2208.4 Ω |
| Current with the common return open | One coil at V, seven at 0: 87.5 % in that coil, −12.5 % in each other one. Two coils at +V and −V: 100 %. All eight equal: 0 | The bus floats to the mean of the eight outputs; coil current = (V − mean) / 2204 Ω |
| Coil time constant with its resistor | 1.9 µs | 4.1 mH / 2204 Ω |
| Heat in a coil at the cap | 0.09 mW | (4.537 mA)² × 4.2 Ω |
| Phone calibration uncertainty | about ±35 % | 11.7 % per mm × 3 mm |

## Sources

Paths are under `library/`. Page numbers are PDF pages, printed page in brackets.

| Key | Paper | File |
|---|---|---|
| R92 | Richards, Koren & Persinger 1992 | `papers/1992 - Richards - Experimental stimulation by burst-firing weak magnetic fields over the right temporal lobe m.pdf` |
| R93 | Richards, Persinger & Koren 1993 | `papers/1993 - Richards - Modification of activation and evaluation properties of narratives by weak complex magnetic.pdf` |
| T94 | Tiller & Persinger 1994 | `papers/1994 - Tiller - Enhanced hypnotizability by cerebrally applied magnetic fields depends upon the order of hemis.pdf` |
| H96 | Healey, Persinger & Koren 1996 | `papers/1996 - Healey - Enhanced hypnotic suggestibility following application of burst-firing magnetic fields over th.pdf` |
| C97 | Cook & Persinger 1997 | `papers/1997 - Cook - Experimental induction of the sensed presence in normal subjects and an exceptional subject.pdf` |
| C99 | Cook, Koren & Persinger 1999 | `papers/1999 - Cook - Subjective time estimation by humans is increased by counterclockwise but not clockwise circumce.pdf` |
| P99 | Persinger 1999 | `papers/1999 - Persinger - Increased emergence of alpha activity over the left but not the right temporal lobe within.pdf` |
| PB99 | Persinger & Belanger-Chellew 1999 | `papers/1999 - Persinger - Facilitation of seizures in limbic epileptic rats by complex 1 microTesla magnetic fields.pdf` |
| P00 | Persinger, Tiller & Koren 2000 | `papers/2000 - Persinger - Experimental simulation of a haunt experience and elicitation of paroxysmal electroencephal.pdf` |
| PH02 | Persinger & Healey 2002 | `papers/2002 - Persinger - Experimental facilitation of the sensed presence possible intercalation between the hemisph.pdf` |
| R02 | Richards, Koren & Persinger 2002 | `papers/2002 - Richards - Circumcerebral application of weak complex magnetic fields with derivatives and changes in e.pdf` |
| K02 | Koren & Persinger 2002 | `papers/2002 - Koren - Possible disruption of remote viewing by complex weak magnetic fields around the stimulus site.pdf` |
| B03 | Booth, Koren & Persinger 2003 | `papers/2003 - Booth - Increased proportions of sensed presences and occipital spikes with 1- and 10-msec point durati.pdf` |
| TS04e | Tsang, Koren & Persinger 2004 (Shakti and Koren boxes) | `papers/2004 - Tsang - Electrophysiological and quantitative electroencephalographic measurements after treatment by t.pdf` |
| TS04g | Tsang, Koren & Persinger 2004 (gamma, ring) | `papers/2004 - Tsang - Power increases within the gamma range over the frontal and occipital regions during acute expo.pdf` |
| GQ05 | Granqvist et al. 2005 | `papers/2005 - Granqvist - Sensed presence and mystical experiences are predicted by suggestibility not by the applica.pdf` |
| PK05 | Persinger & Koren 2005 (letter) | `papers/2005 - Persinger - A response to Granqvist et al Sensed presence and mystical experiences are predicted by sug.pdf` |
| Larsson reply | Larsson et al. 2005 (filed under "Marcus") | `papers/2005 - Marcus - Reply to MA Persinger and S A Korens response to Granqvist et al Sensed presence and mystical.pdf` |
| SP06 | St-Pierre & Persinger 2006 | `papers/2006 - St-Pierre - Experimental facilitation of the sensed presence is predicted by the specific patterns of t.pdf` |
| S13 | Saroka & Persinger 2013 | `papers/2013 - Saroka - Potential production of Hughlings Jacksons parasitic consciousness by physiologically-patterne.pdf` |
| PAT76 | US 6,312,376 (Koren & Persinger) | `patents/US6312376B1 - US patent 6312376.pdf` |
| – | Saroka 2010; Persinger 2010; Gendle & McGrath 2012; the clinical papers of table I | `documents/webarchiveorg 347 - Saroka 2010.pdf`; `papers/2010 - Persinger - Correlated cerebral events…`; `papers/2012 - Gendle - …`; see [SIGNALS.md](SIGNALS.md) §4 |
| – | AD5328 data sheet, Rev. F | `docs/ad5308_5318_5328.pdf` (project copy) |
| – | ICNIRP 2010 | `documents/icnirporg ICNIRPLFgdl - ICNIRP 2010.pdf` |
