# Signals: what the coils play and where it comes from

This page covers what the eight coils emit and where each waveform comes from. It has five parts:

1. the physics of these particular coils;
2. the Persinger/Koren laboratory signals, rebuilt from primary sources;
3. Todd Murphy's Shakti and Shiva signal families;
4. the clinical low-field protocols whose timing the generators copy;
5. a table that maps every engine pattern and generator to its origin.

How to write these signals into a program file is in [PRESET_FORMAT.md](PRESET_FORMAT.md). Other topics have their own pages:
- lab and device history: [HISTORY.md](HISTORY.md);
- the wider evidence: [RESEARCH.md](RESEARCH.md);
- limits and contraindications: [SAFETY.md](SAFETY.md);
- measuring your own coils: [CALIBRATION.md](CALIBRATION.md).

**Evidence words**, as everywhere in these docs:
- **established**: independent replication;
- **single-lab**;
- **claim**: an author or vendor statement;
- **anecdote**;
- **unverified**: a construct or calculation that nobody has tested or measured.

Nearly every signal on this page is single-lab or claim. Numbers about this helmet that come from the coil model are calculations, not measurements, until you calibrate.

**At a glance**
- Where a source gives the timing, the helmet reproduces it to 0.5 ms. Many signals here have no published timing (the chirp, the Shiva rotation tables), so those are approximations. The helmet does not reproduce the field strength of the clinical devices.
- Only one Persinger-lineage waveform has public point values: the 849-point Thomas/Cnp table in US 6,234,953. The project plays it exactly. Burst-firing, the lab's LTP file, the "chirp" and all of Murphy's signals are approximations of written descriptions.
- The coil model gives about 1.8 µT/mA at 20 mm, so 1–8 µT at the cortex under a coil. That is the same decade as the Persinger lab's 1–10 µT. Most clinical low-field devices are about 40 to over 1000 times stronger. The Lawson Cnp headset is the exception: similar near the scalp at full current, about 30 times stronger deep in the head (section 4).
- Induced electric field: microvolts per metre for smooth signals, plus brief millivolt-per-metre spikes at the DAC steps. Every signal type stays at least about 400× below the ICNIRP 2010 brain limit at full current (calculated).

---

## 1. Physics of these coils

### 1.1 Field versus distance

Each coil is a commodity 19 × 12 mm magnetic-levitation coil: 495 turns, 4.2 Ω, 4.1 mH ±10 %. One seller lists a ferrite core, another a solid iron core; the ferrite listing's title also says "Full Copper Core". No manufacturer datasheet was found ([AliExpress listing 1005009753954000](https://www.aliexpress.com/item/1005009753954000.html); [AliExpress listing 1005012712588156](https://www.aliexpress.com/item/1005012712588156.html)). These are claims.

The app's coil model is in `webapp/src/engine/field.js` and drives the Brain tab. It works like this:
- **Winding.** The winding is split into 16 current loops, each computed with the exact loop formulas ([Simpson et al. 2013](https://ntrs.nasa.gov/citations/20140002333)).
- **Core.** The core is a uniformly magnetised cylinder. Its demagnetising factor ([Chen et al. 1991](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=905398)) limits its apparent susceptibility to about 5 for any material with χ ≥ 100. So ferrite and iron give nearly the same low-frequency field.
- **Check.** The inductance the model implies (4.1–4.6 mH) matches the seller's 4.1 mH. That supports the model, but it is still a calculation (unverified).

The 2.2 kΩ series resistor caps the current at 10 V / 2204 Ω = 4.54 mA per coil.

| Distance on the coil axis | µT per mA (cored model) | At the 4.54 mA cap | Air-core model `AIR_COIL` (µT per mA) |
|---|---|---|---|
| 0 mm (coil face) | 105 | 0.48 mT | 22.9 |
| 3 mm (scalp in front of the coil) | 44 | 0.20 mT | 11.8 |
| 5 mm | 25 | 114 µT | 7.6 |
| 10 mm | 8.2 | 37 µT | 2.9 |
| 20 mm (cortex; the calibration point) | 1.86 | 8.4 µT | 0.73 |
| 40 mm | 0.33 | 1.5 µT | 0.14 |
| 45 mm | 0.24 | 1.1 µT | 0.10 |
| 60 mm | 0.11 | 0.5 µT | 0.05 |

Values from `field.js` (calculated). How to read them:
- **Model range.** The coil-model research gives 1.76 µT/mA at 20 mm for its sweep of geometries, range 1.6–1.9, or 1.4–2.2 including model error. The app's central case gives 1.86, and the firmware's default calibration is 1.8.
- **Off axis.** The field reverses sign. At 90° in the coil's mid-plane, 20 mm from its side, it is about −0.6 µT/mA.
- **Air core.** `AIR_COIL` is the older air-core estimate (winding 3.0–9.5 mm, 12 mm long, as in `tools/coil_field.py`), not exactly the cored model's winding.
- **Shape.** Normalised to the 20 mm value, the cored and air-core shapes differ by only about 3–5 % at 30–50 mm, but by +47 % at 3 mm and +79 % at the face. So the Brain tab's maps are robust at depth, and absolute values depend on calibration.
- **Spacer accuracy.** The field falls about 12 % per mm at 20 mm. A calibration spacer must be accurate to ±0.3 mm for ±4 % ([CALIBRATION.md](CALIBRATION.md)).
- **Deep targets.** The centres of the amygdala and hippocampus lie about 55–57 mm below the nearest placeable scalp, their closest edges 40–47 mm ([PLACEMENT.md](PLACEMENT.md)); the Placement tab puts them about 5.7–6 cm below the nearest temporal sites. At 45–60 mm the field is about 8–17× weaker than at 20 mm.
- **Intensity.** A program's intensity is the peak on the coil axis at 20 mm. Most presets use 1 µT. The Setup ceiling defaults to 5 µT and the firmware accepts at most 10 µT. The reachable maximum is 4.54 mA × the weakest coil's µT/mA, about 8 µT with the model.

### 1.2 Why tissue does not change B

[ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf) states that "the permeability of tissue is the same as that of air, so the field in tissue is the same as the external field" (established). What follows from this:
- **No shielding or focusing.** Skull, scalp and brain neither shield nor focus a low-frequency magnetic field. The B at any point in the head is the free-space field of the coils. That is why the Brain tab needs no head model to show µT.
- **E is what tissue changes.** The same guideline names Faraday induction of electric fields and currents as "the main interaction of magnetic fields". Under the standard model, neurons respond to that induced electric field E, not to B as such.
- **Conductivity.** In general E depends on tissue conductivity and head shape. In one geometry it does not: when a round coil's axis passes through the centre of a spherically symmetric head, E is purely tangential, no surface charge forms, and E is independent of the conductivity profile ([Heller & van Hulsteyn 1992](https://pmc.ncbi.nlm.nih.gov/articles/PMC1262130/)). The E figures below use that geometry. Tilted coils and real head shapes add a charge term that the project has not computed.

### 1.3 dB/dt and the induced electric field: smooth signals vs the 2 kHz steps

The induced E is proportional to how fast B changes (dB/dt). Two regimes matter here.

**Smooth signals.** For a sine, E grows in proportion to frequency and amplitude. A 7 Hz sine at 8 µT (full current, 20 mm) induces about 1.7 µV/m at 20 mm (calculated).

**Steps.** A hardware timer updates all eight DAC channels together every 0.5 ms (2 kHz, latched with LDAC), and the engine holds each value for `pointMs`. Every change of value is a voltage step. How fast the current follows:
- **DAC.** The AD5328 slews at 0.7 V/µs and settles in 8–10 µs ([AD5328 datasheet Rev. F, project copy](ad5308_5318_5328.pdf)).
- **Module.** With the module's gain of 4, the output can slew at about 2.8 V/µs, unless its unidentified op-amps are slower.
- **Circuit.** The coil and its 2.2 kΩ resistor have a time constant L/R of about 2 µs, so the current follows the voltage almost at once. The coil's own L/R of about 1 ms does not matter.

Worst case, a full ±10 V swing (calculated):

| | 20 mm | 45 mm | Scalp (3 mm) |
|---|---|---|---|
| dB/dt, slew-limited edge | 2.2 T/s | 0.29 T/s | about 55 T/s |
| Peak E during the edge | about 11 mV/m | about 2.8 mV/m | about 95 mV/m |
| Ceiling for an ideal, instant step | about 40 mV/m | about 11 mV/m | about 0.35 V/m |

- **Duration.** These spikes last 2–7 µs. The current slope is at most about 1.27 kA/s when slew-limited, and 4.3–4.9 kA/s (20 V/L) even for an ideal step.
- **Staircase.** A 1 ms staircase lifts the peak E of a 7 Hz sine from microvolts to about 0.6–0.8 mV/m, again only in microsecond spikes.
- **Coils together.** Coils switching together add up. For four coils in a row 25 mm apart, E rises 2.2× at 20 mm and 3.2× at 45 mm, while B rises only 1.18× (flat-plane approximation).
- **Where the peak sits.** Peak E is off axis: about 18 mm from the coil axis in the 20 mm plane, and about 36 mm in the 45 mm plane.
- **Iron core.** If the core is solid iron rather than ferrite, eddy currents would reduce its share during edges. Edge E would then be lower, closer to the air-core value (unverified; a bench check is in [CALIBRATION.md](CALIBRATION.md)).

**For comparison** (established):
- network-level effects in brain slices start around 0.1–1 V/m ([Francis et al. 2003](https://pubmed.ncbi.nlm.nih.gov/12917358/); [Deans et al. 2007](https://pubmed.ncbi.nlm.nih.gov/17599962/); [Reato et al. 2010](https://pubmed.ncbi.nlm.nih.gov/21068312/));
- in vivo, rodent spiking needs at least about 1 V/m ([Vöröslakos et al. 2018](https://pubmed.ncbi.nlm.nih.gov/29396478/));
- 2 mA transcranial electrical stimulation reaches about 0.8 V/m in human cortex ([Huang et al. 2017](https://pubmed.ncbi.nlm.nih.gov/28169833/)).

The helmet's smooth-signal E is about five orders of magnitude lower. Its edge spikes are microseconds long and carry their energy at roughly 50–150 kHz, where the ICNIRP brain limit is far higher (13.5 V/m at 100 kHz, about 1350× the 10–25 Hz value). By mainstream biophysics, no direct neural effect is expected.

### 1.4 ICNIRP 2010 compliance by signal type

**Basic restrictions.** [ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf) limits the induced electric field inside the body. The values are rms and apply to instantaneous values, not time averages. For the general public:
- in central nervous system (CNS) tissue of the head: 0.1/f V/m (1–10 Hz), 0.01 V/m (10–25 Hz), 4 × 10⁻⁴·f V/m (25 Hz–1 kHz) and 0.4 V/m (1–3 kHz);
- in all tissues: 0.4 V/m up to 3 kHz.

**Weighted peak.** For non-sinusoidal signals ICNIRP uses a weighted-peak method: each frequency component is divided by its limit, with a set phase. A weighted peak of 1 means "at the limit".

**Reference levels.** ICNIRP also gives reference levels for B in a uniform field (public): 200 µT at 25–400 Hz, 5 × 10⁻³/f T at 8–25 Hz (500 µT at 10 Hz), 80 µT at 1 kHz and 27 µT above 3 kHz.

**ICNIRP 2003.** The older [ICNIRP 2003](https://www.icnirp.org/cms/upload/publications/ICNIRPPulsed.pdf) statement on pulsed fields weights dB/dt instead, with an RC low-pass filter; its public reference is 0.044 T/s.

The project's dosimetry research computed the weighted peaks below for each signal type at the full 4.54 mA, about 8 µT at 20 mm (calculated, unverified). An independent recomputation agreed within 10–20 %. All values scale linearly with intensity: multiply by (program µT) / 8.

| Signal (engine type or generator) | Basic restriction, CNS, 20 mm | Basic restriction, CNS, 45 mm | B reference level, scalp (3 mm) | B reference level, coil face | ICNIRP 2003 dB/dt, scalp |
|---|---|---|---|---|---|
| 7 Hz sine, 1 ms points (`sine`) | 1.1 × 10⁻⁴ | 2.8 × 10⁻⁵ | 0.30 | 0.71 | 0.98 |
| 40 Hz sine (`sine`) | 5.9 × 10⁻⁴ | 1.5 × 10⁻⁴ | 1.55 | 3.6 | 5.6 |
| Chirp 4 → 40 Hz (`chirp`) | 5.9 × 10⁻⁴ | 1.5 × 10⁻⁴ | 1.55 | 3.6 | 5.5 |
| Burst 6 → 30 Hz, 3 ms points (`burst`) | 8.7 × 10⁻⁴ | 2.2 × 10⁻⁴ | 2.9 | 6.8 | 12 |
| Thomas 25 → 6 Hz sweep (`thomas` type) | 1.3 × 10⁻³ | 3.3 × 10⁻⁴ | 4.8 | 11.3 | 22 |
| 100 ms alternating pulses (`pulse`) | 1.3 × 10⁻³ | 3.2 × 10⁻⁴ | 4.8 | 11.2 | 22 |
| T-PEMF ±3 ms pulses (`tpemf`) | 2.3 × 10⁻³ | 5.8 × 10⁻⁴ | 9.1 | 21.3 | 44 |
| LFMS 500 Hz trains (`lfms`) | 2.1 × 10⁻³ | 5.5 × 10⁻⁴ | 8.9 | 20.9 | 44 |
| iTBS (`itbs`) | 2.1 × 10⁻³ | 5.4 × 10⁻⁴ | 8.8 | 20.7 | 42 |
| Random 3 ms points (`semirandom`) | 2.3 × 10⁻³ | 5.9 × 10⁻⁴ | 8.9 | 20.8 | 43 |
| Full-swing 1 Hz square (worst case) | 2.5 × 10⁻³ | 6.4 × 10⁻⁴ | 9.4 | 22.1 | 44 |

**How to read it**
- **Basic restrictions.** These are met by a wide margin: at least about 400× in the brain. At the scalp, the all-tissue weighted peak is 4.7 × 10⁻⁴ to 2.1 × 10⁻², a margin of at least about 47×. The margin is still about 15× after allowing for several coils in phase and for model uncertainty.
- **Reference levels.** At full current, these are exceeded locally on the scalp and at the coil face by every signal except the 7 Hz sine. ICNIRP 2010 allows this for a localised source if the basic restriction is met: "For a very localized source with a distance of a few centimeters from the body, the only realistic option for the exposure assessment is to determine dosimetrically the induced electric field." At the default 1 µT, the square and table patterns still sit at about 1.1× the reference level on the scalp.
- **Edge speed.** Edge speed hardly changes the weighted peaks. For T-PEMF in the brain, an ideal step, a 2.8 V/µs edge and a 0.5 V/µs edge give 2.30, 2.27 and 1.94 × 10⁻³, although the peak E changes about 18×.
- **The staircase.** The staircase itself matters. A 40 Hz sine with 1 ms steps has nearly twice the reference-level weighted peak of a smooth one (3.0 vs 1.69 at the face, exact calculation). Points of 0.5 ms cut that excess roughly in half. When a source gives no point duration, `pointMs: 0` (update every 0.5 ms tick) is the gentler choice.
- **Exact Thomas/Cnp tables.** The `thomas` row is the synthetic sweep. The exact tables from the `thomas` and `cnp` generators were not computed separately.
- **IEEE.** Under the IEEE brain limit (5.89 mV/m below 20 Hz, rising with f, ICNIRP-style weighting), the weighted peaks at 20 mm are 2.2 × 10⁻⁴ to 1.3 × 10⁻³. Whether [IEEE C95.1-2019](https://standards.ieee.org/standard/C95_1-2019.html) keeps the 5.89 mV/m value could not be confirmed (unverified).

The built-in safeguards (series resistors, arming switch, STOP button, field ceiling, 60-minute cap) are listed in [SAFETY.md](SAFETY.md).

---

## 2. The Persinger/Koren lab signals

The Laurentian University group (Michael Persinger, Stanley Koren and students) built every signal as a list of numbers played through a DAC into small solenoids.

**Evidence.** Almost the whole corpus is single-lab. The one large independent double-blind test, [Granqvist et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/) (N = 89), found "no evidence for any effects of the magnetic fields". Persinger and Koren disputed it ([Persinger & Koren 2005](https://pubmed.ncbi.nlm.nih.gov/15862915/)). What this build can honestly match is the timing and the dose: 1–8 µT at 20 mm is the same decade as the lab's 1–10 µT.

### 2.1 How the lab made a signal: the Koren DAC file

The Koren & Persinger hardware patent, [US 6,312,376](https://patents.google.com/patent/US6312376B1/en) (Canadian filing [CA 2,214,296](https://patents.google.com/patent/CA2214296A1/en)), documents the whole control model.

**The file.** A "DAC file" is a DOS or ASCII text file with a header giving the number of points, then one value per line, 0–255.

**The hardware:**
- an 8-bit DAC0800LCN converter and LM741CN op-amps;
- a one-of-eight opto-coupled channel selector on the PC's parallel port;
- a pair of solenoids on each channel, wired in parallel, diametrically opposed, in phase (north to north) or out of phase (north to south);
- solenoids made from reed relays (Intertan 275-232) "with the reed switch removed and replaced by a steel nail core".

**The seven user parameters** map one-to-one onto this project's program format:

| Patent parameter | Meaning | This project |
|---|---|---|
| (i) DAC file | the point values | `table` data, or a synthesised pattern |
| (ii) delay between points | point duration | `pointMs` |
| (iii) number of repeats | session length | phase `minutes` |
| (iv) delay between repeats | interstimulus interval (ISI) | `gapMs` |
| (v) channel sequence ("sequence limit") | which channels, in what order | `layout`, `placement.order`, `spatial.mode` |
| (vi) "sequence interval" | time on each channel | `dwellMs` |
| (vii) "sequence acceleration" | change of that time per successive channel | `dwell: [start, step, end]` (see 2.9 for the sign) |

**Three voltage conventions exist:**
- the patent: 255 → +6 V, 127 → 0 V, 0 → −6 V;
- the Laurentian theses: 0–256 → −5 … +5 V with 127 = 0 V ([Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a); [Carniello 2020](https://laurentian.scholaris.ca/items/8c92763c-cd19-4a21-b242-3b572a28ce55); [Lehman 2016](https://laurentian.scholaris.ca/items/e809389f-805c-4414-8177-d0bf8d7127bb));
- the Thomas/Cnp table in [US 6,234,953](https://patents.google.com/patent/US6234953B1/en): signed values from −128 to +127.

This project stores 0–255 with 128 = zero and scales to the program's µT. The 20 % difference between ±5 V and ±6 V therefore does not carry over.

**Timing.** The lab ran DOS programs ("Complex 1.15", "complex2"). Persinger wrote that "Complex 1.15 MUST be calibrated for pixel duration in computers above 286s" ([Persinger to Larhammar, 22 Nov 2004, archived Laurentian correspondence](https://web.archive.org/web/2011/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm)). The lab also reported that Windows-generated fields disrupted a remote-viewing result that DOS-generated ones did not ([Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12509207/); single-lab claim). This helmet's timing comes from a hardware timer on the ESP32, so point durations are exact multiples of 0.5 ms and do not depend on a PC.

### 2.2 Burst-firing ("Burst-X", "amygdaloid")

**Origin.** The lab described the signal as "a computer-generated wave form, designed to simulate neuronal burst firing", applied at 1 µT through the temporal planes ([Richards, Persinger & Koren 1993](https://pubmed.ncbi.nlm.nih.gov/8407157/)). Two papers used it earlier: [Richards, Koren & Persinger 1992](https://pubmed.ncbi.nlm.nih.gov/1408634/) and [Gillis & Persinger 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/).
- **Source of the shape.** A thesis says the pattern was extracted from averaged potentials of a human amygdala during complex partial seizures ([Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a)).
- **Frequency.** A later lab paper calls the 230-point file an increasing-frequency pattern ([Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html)).
- **Point values.** These have never been published anywhere.

**Published parameters.** Three theses from the same lab disagree on the point count. They agree on the point duration:

| Source | Points | Point duration | Burst | Repeat / ISI | Context |
|---|---|---|---|---|---|
| [Carniello 2020](https://laurentian.scholaris.ca/items/8c92763c-cd19-4a21-b242-3b572a28ce55) | 230 | 3 ms | 690 ms | ISI 3 ms in cell work | cultured cells |
| [Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a) | 248 | 3 ms | 744 ms | ISI 3000 ms | planaria |
| [Collins 2013](https://laurentian.scholaris.ca/items/16d96136-680c-4afe-8044-f9137bd01afc) | 289 | 3 ms | 867 ms | 4000 ms between cycles | humans, Shiva "amygdaloid signal, normal speed" |
| [Ryczko & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12434855/) | 230 | 4 ms | 920 ms | once every 3 s | rats |
| [Persinger, Hoang & Baker-Price 2009](https://pubmed.ncbi.nlm.nih.gov/20017628/) | – | – | "about 0.7 s" | once every 3 s | one human case |
| [Martin & Persinger 2004](https://pubmed.ncbi.nlm.nih.gov/15276252/); [Martin, Koren & Persinger 2004](https://pubmed.ncbi.nlm.nih.gov/15219761/) | – | – | – | "once every 4s for 30 min" | rat analgesia |
| [Persinger 1999](https://pubmed.ncbi.nlm.nih.gov/10576400/) | – | – | 1 s | every 4 s, 5 µT | humans |

**Which version.** 230 points × 3 ms = 690 ms, which matches the "about 0.7 s" of a separate paper from the same lab (Persinger, Hoang & Baker-Price 2009). That makes 230 points the best-supported length (single-lab). In practice "burst-firing" is a family of point-duration and ISI settings over one unpublished table.

**In this project** the `burst` pattern type is a sine whose frequency rises from `f0` to `f1` over `sweepMs`, held in `pointMs` steps, then `gapMs` of silence. The defaults are 6 → 30 Hz over 1500 ms, a 4000 ms gap and 3 ms points.
- **Matching the sources.** `{"type": "burst", "sweepMs": 690, "gapMs": 3310, "pointMs": 3}` plays 0.69 s once every 4 s.
- **Exact:** point duration, burst length and repeat interval.
- **Approximated:** the waveform inside the burst. The 6 → 30 Hz range is a project choice.

### 2.3 The Thomas pulse

**Name and patent.** The pulse is named after Alex W. Thomas, "a previous student" in a Laurentian thesis ([Lehman 2016](https://laurentian.scholaris.ca/items/e809389f-805c-4414-8177-d0bf8d7127bb)) and "Persinger's colleague" in a magazine article ([Hitt 1999](https://www.wired.com/wired/archive/7.11/persinger.html)). The patent [US 6,234,953](https://patents.google.com/patent/US6234953B1/en) (Thomas, Prato, Kavaliers, Persinger; Lawson Health Research Institute) captions its FIG. 2 "Thomas Pulse (Cnp), Pulse Segment Detail". The 18 pulses in its table span exactly the 849 points that the Laurentian papers give for their Thomas file ([Buckner et al. 2015](https://europepmc.org/article/MED/25875081)). So the Lawson group's "Cnp" and the Laurentian Thomas pulse are very likely one waveform. Nobody has compared a Laurentian file with the patent value by value.

**The patent table.** Table 1 holds 900 signed 8-bit values in 50 rows × 18 columns, read column by column ("The columns are contiguous"). Two independent parses agree with the project's `generators.js` on the 18 pulses and their onsets. As transcribed in `generators.js`, the table holds:
- 18 identical pulses, each a 28-point slot holding 26 points of waveform (16 non-zero points, one zero, then 9 non-zero points) between zeros;
- pulse onsets at points 1, 29, 57, 85, 113, 153, 193, 233, 273, 326, 380, 434, 488, 554, 621, 688, 755 and 822;
- onset spacing that grows from 28 (four times) to 40 (four times), 53–54 (four times) and 66–67 (five times) points;
- the last pulse's slot ends at point 849 (last non-zero value at point 848).

**Design rule.** The patent describes a waveform shaped like the target tissue's own activity. A latency between waveforms is "progressively set to increase, or decrease". A fixed refractory period follows: about 1200 ms for humans, about 400 ms for rodents, and at least 7–10 s for long daily exposures.

The same table was played at two speeds:

| | Lawson group (Thomas, Prato) | Persinger lab (Laurentian) |
|---|---|---|
| Point duration | 1 ms (patent axes in ms; burst ends near 850 ms) | 3 ms ([Buckner et al. 2015](https://europepmc.org/article/MED/25875081); [Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a)) |
| One burst | about 849 ms | 2547 ms ("each cycle lasts 2.55 s") |
| Pulse rate across the burst (arithmetic from the onsets) | about 36 → 15 per second | about 12 → 5 per second |
| Between bursts | refractory period; in [Camera et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4412122/), 4 bursts separated by 110, 220, 330 and 1200 ms | none in Buckner 2015 |
| Field | FIG. 1 axis ±100 µT; the [Thomas et al. 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/) headset gave 400 µT at contact, ±200 µT at the head surface and ±35 µT deep | 1–5 µT in human work; 2–10 µT in Buckner's cell and mouse work |

**The "25 → 6 Hz" labels.** [Buckner et al. 2015](https://europepmc.org/article/MED/25875081) describe "a 3 ms interval for the first 5 repeats (25Hz) to a 120 ms interval (6 Hz) for the last 5 repeats". At 3 ms per point the table roughly fits: the silence between pulses grows from 2 points (6 ms) between the first five pulses to 41 points (123 ms) between the last five, and each pulse has a single zero point (3 ms) between its two lobes (arithmetic from the table in `generators.js`). The pulse-to-pulse rate, however, works out at about 12 → 5 Hz. So "25 → 6 Hz" is the lab's own description, not a literal pulse rate.

**Other versions:**
- 837 points at 1 ms, once every 4 s ([Dixon & Persinger 2001](https://pubmed.ncbi.nlm.nih.gov/11328704/));
- 859 points ([Carniello 2020](https://laurentian.scholaris.ca/items/8c92763c-cd19-4a21-b242-3b572a28ce55));
- in epileptic rats, the most severe (Level 5) seizures were most frequent with 3 ms points and a 3 ms ISI ([Persinger & Belanger-Chellew 1999](https://pubmed.ncbi.nlm.nih.gov/10597585/));
- in people, the time-reversed pattern evoked fewer left-sided sensed presences than the forward one ([Tiller & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/11883572/)).

All single-lab.

**In this project:**
- **`thomas` generator.** Plays the exact 849 table points at 3 ms, with optional silence between bursts (none in Buckner). Exact.
- **`cnp` generator.** Plays the exact points at 1 ms in Camera's 4-burst cycle. With the full 849-ms burst the cycle is 5256 ms; Camera's 838 ms burst gives 5212 ms and truncates the last pulse. The 4-burst cycle comes from Camera 2015, not from the patent's FIG. 1, which shows one burst and one refractory period. Thomas 2007 does not say which Cnp waveform its headset played.
- **`thomas` pattern type.** An older synthetic stand-in: a falling sweep from 25 to 6 Hz over 2.5 s with a 1 s gap. Use the generator instead.

### 2.4 LTP and the primed burst

**The thesis description.** The lab's "LTP" (hippocampal) file is described in one thesis figure caption ([Corradini 2014](https://laurentian.scholaris.ca/items/1455e1f3-2f1d-47b5-93cd-23713d69e651), MA thesis). It says the x-axis is "time in 1 ms intervals", the values lie "between 127 and 256" (positive polarity only), and "The time between the primer pulse and subsequent 4 pulses was 150 ms." The thesis cites Rose, Diamond, Pang & Dunwiddie (1988) on *primed-burst* potentiation, and Collins says the hippocampal field "is based on the algorithm for induction of LTP (Rose et al, 1988)" ([Collins 2013](https://laurentian.scholaris.ca/items/16d96136-680c-4afe-8044-f9137bd01afc)).

**"Theta-burst" in other papers.** The lab also called its LTP fields "theta-burst": [Delparte & Persinger 2007](https://pubmed.ncbi.nlm.nih.gov/17365115/) used a "1 s pulse of 5 trains of an LTP-evoking pattern" at 1 µT for 15 min, continuously or with a 5 s or 10 s ISI.

**Reported effects** (all single-lab):
- In rats, the 2007 LTP fields impaired memory consolidation, and [McKay & Persinger 2000](https://pubmed.ncbi.nlm.nih.gov/10938564/) reported impaired spatial memory.
- In people, right-hemisphere application was rated more pleasant than left (N = 40, double-blind, 20 min, 1 µT; [Persinger, Richards & Koren 1994](https://pubmed.ncbi.nlm.nih.gov/7744561/)).
- Corradini reported better narrative retention after left-temporal application.

The file's point values are unpublished.

**In this project:**
- **`primed` generator.** One positive 1 ms pulse, then four positive 1 ms pulses 10 ms apart, starting 150 ms later. Five such 200 ms trains make Delparte's "1 s pulse of 5 trains", and `isiMs` adds 0, 5 or 10 s of silence.
  - Exact: the 150 ms primer-to-burst gap, positive polarity, 1 ms points, 5 trains per second.
  - Approximated: the 100 Hz spacing inside the burst, which the caption does not give, and the pulse shape.
  - Assumed: that Corradini's file and Delparte's "5 trains" describe the same signal. Each comes from a different source.
- **`ltp` generator.** A different, slice-physiology timing after Larson & Lynch (1986): four biphasic pulses at 100 Hz, bursts at 5 Hz. It is not the Persinger file.

### 2.5 7 Hz sine with 1 or 10 ms points

**The study.** [Booth, Koren & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/14738362/) played a 7 Hz sine with point ("pixel") durations of 1, 3, 5, 7, 10 or 20 ms, 5 min each in counterbalanced order. The field was 1 µT over the right hemisphere, and six people took part. Left-side sensed presences and occipital EEG spikes were most frequent with 1 and 10 ms points. It is a two-page note with n = 6 (single-lab).

**"3 ms is optimal."** This often-repeated rule comes from a different species and endpoint: rat analgesia ([Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a), citing Martin et al. 2004).

**What point duration does to the waveform.** It is sample-and-hold. At 10 ms a 7 Hz sine has about 14 steps per cycle; at 20 ms, about 7.

**In this project:** `sine` with `pointMs` reproduces this exactly. The `persinger-7hz-point-duration-2003` program in the Programs tab runs all six point durations.

### 2.6 40 Hz and "modulated 40 Hz"

**The lab study.** [Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/) gave 24 people one of four conditions for 30 min at 1 µT over the right parietotemporal region:
- sham;
- a 5 Hz sine;
- a 40 Hz sine;
- a 40 Hz sine "phase modulated five times per sec."

The idea that phase modulation explained earlier rises in suggestibility "was not supported". The 40 Hz group rated the experience as more pleasant. The modulation depth was not published (single-lab).

**Murphy's version.** Murphy's "modulated 40 Hz" signal is described as "almost in sync with the brain's own binding factor, but not quite" ([Murphy, Modulated 40 Hz signal for the God Helmet](https://www.god-helmet.com/wp/god-helmet/koren_mod40.htm)). It is also said to have "a constant tone" ([Murphy, Shakti demo: modulated 40 Hz](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/obe45_consent.htm)). Both are claims.

**In this project:** `pm` plays a carrier at `f0` whose phase swings by up to `depth` radians at rate `f1`.
- The defaults (40 Hz, 0.5 Hz, 3 rad) are project choices.
- The Sculthorpe preset uses `f1: 5` to match the paper.
- Exact: carrier frequency and modulation rate (Sculthorpe).
- Approximated: the depth (unpublished) and the whole of Murphy's file.

### 2.7 The "chirp": what the sources do and do not say

**What the lab sources say:**
- No Laurentian paper defines a chirp waveform. The project's research found the word in neither patent, in none of the Carniello, Corradini, Lehman or Saroka theses, and in no PubMed record for Persinger.
- The only lab mention is that the Thomas pulse "was developed by Thomas and Persinger (1997) based upon theoretical and chirp-features of communication systems" ([Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a)).

**What the vendor says.** Murphy's pages disagree with each other (claim):
- The Shiva lab-sessions page says: "This signal does not change in tone, but rather has longer and longer gaps between sections of the signal as they travel around your head." ([Murphy, Shiva demo: Sessions used in Lab Experiments](https://www.god-helmet.com/wp/shiva/shiva_demo/experiment_signals.htm))
- The Shiva chirp page ties the signal to a "chirp sequence" with frequency modulation. It shows a "classical" chirp whose "frequency gets lower as the signal progresses" ([Murphy, Shiva demo: 40 Hz modulated chirp](https://www.god-helmet.com/wp/shiva/shiva_demo/mod40_chirp.htm)).
- The Shakti chirp page builds it from the modulated 40 Hz signal. The frequency modulation acts on gaps that lengthen, and a Fibonacci constant varies the amplitude and the gap lengths ([Murphy, Shakti demo: modulated 40 Hz chirp](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/mod40_chirp_consent.htm)).
- The Shiva software used in one Laurentian thesis names "40 Hz Modulated" and "40 Hz Modulated Chirp" primers ([Collins 2013](https://laurentian.scholaris.ca/items/16d96136-680c-4afe-8044-f9137bd01afc)).

**Where the chirp is used.** Murphy's classic God Helmet session is "Modulated 40 hertz 'chirp' signal over right side followed by amygdala over both sides", 20 + 20 or 30 + 30 min ([Murphy, God Helmet session list](https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm)). The lab's own descriptions of phase 1 of that protocol name the frequency-modulated (Thomas) pattern instead. They disagree on the side:
- bilateral in [Saroka 2016](https://laurentian.scholaris.ca/items/5260328f-a7c5-4d7b-b8a2-00b943eee977) (PhD thesis);
- right hemisphere in [Persinger, Tiller & Koren 2000](https://pubmed.ncbi.nlm.nih.gov/10833767/).

**In this project** the `chirp` type is a linear sine sweep from `f0` to `f1` over `sweepMs`, then `gapMs` of silence. The default is 4 → 40 Hz over 2 s.
- The God Helmet presets use 40 → 6 Hz over 2511 ms with 3 ms points and a 1489 ms gap. That is a falling sweep, close in spirit to the Thomas lineage.
- No source defines a sweep like this, so every `chirp` is an approximation.
- **Two alternatives:**
  - the exact Thomas table (`thomas` generator) for the lab's phase 1;
  - a 40 Hz carrier with a lengthening dwell ramp for the vendor's "longer and longer gaps". The `murphy-shiva-persinger-session` preset does this.

### 2.8 Rotation: a base dwell plus a change per coil

**Geometry.** In the circumcerebral ("Octopus") studies, 8 solenoids sat every 45° in a horizontal ring above the ears. Solenoid 1 was over the left frontal region, the order ran counterclockwise seen from above, and solenoid 8 was over the right prefrontal region ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)).

**What defines a configuration:**
- a base dwell at coil 1;
- a change per successive coil;
- a waveform and its point duration;
- a phase length.

| Study | Field | What the source says | Dwell per coil, as the project's presets read it | Project `dwell` |
|---|---|---|---|---|
| [Cook, Koren & Persinger 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/) | about 10 µT | "Successive additions of 20 ms … at each solenoid"; rotations "between about 200 and 2000 ms"; counterclockwise distended subjective time more than clockwise | base not published. The presets fill Cook's six patterns from the Swann table below, so the 20 ms additions run 100, 120, …, 240 ms (one turn 1360 ms). A 20 ms base would give 20, 40, …, 160 ms (one turn 720 ms) | `[100, 20, 240]` (`persinger-cook-1999-*`, with the other Swann rows); `[20, 20, 160]` is the other reading |
| [Richards, Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/) | 5–10 µT | "20-msec. rates of change in the duration of delivery … to each successive solenoid"; about 30 % more theta power | as Cook 1999 | `[100, 20, 240]` (`circumcerebral-theta`) |
| [Persinger et al. 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/) (Ingo Swann), Table 1 | 2–5 µT | three burst-firing then three Thomas configurations, 5 min each, counterclockwise; point / ISI / commutator rate / change, the same three settings for each pattern: 1 / 1 / 20 / +2, 1 / 1 / 100 / +20 and 3 / 3000 / 200 / −2 ms | signs read literally (+ longer): 20 → 34; 100 → 240; 200 → 186 ms. Under the papers' "+ = shorter" convention (2.9), the first and third would be 20 → 6 and 200 → 214 ms | `[20, 2, 34]`, `[100, 20, 240]`, `[200, -2, 186]` (`persinger-swann-2002-table1`) |
| [Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/) | about 1 µT | "presented for 100 msec. with changes in rate of 20 msec. to each of the eight solenoids" | 100, 120, …, 240 ms | `[100, 20, 240]` |
| [Tsang, Koren & Persinger 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/) | not stated | "the first pulse for 25 ms followed by an acceleration of +2 ms to each of the other 7 solenoids (the last duration = 11 ms)"; more 35–45 Hz power frontally and occipitally | 25, 23, …, 11 ms (one turn 144 ms) | `[25, -2, 11]` |
| [Collins 2013](https://laurentian.scholaris.ca/items/16d96136-680c-4afe-8044-f9137bd01afc) (Shiva, 64 coils) | about 1 µT | left frontal column 100 ms, each successive column counterclockwise 20 ms longer; 289-point burst at 3 ms, 4000 ms between cycles, 20 min | 100, 120, …, 240 ms (one turn 1360 ms) | `[100, 20, 240]` |
| [Lehman 2016](https://laurentian.scholaris.ca/items/e809389f-805c-4414-8177-d0bf8d7127bb) | 1–5 µT inside each solenoid | "20 − 2": 20, 22, …, 34 ms, "sum = 216 ms or 4.6 cycles/s" | 20 → 34 ms | `[20, 2, 34]` |

**Notes on the table:**
- **Change, not dwell.** Cook 1999 and Richards 2002 describe a 20 ms *change* per solenoid, not a fixed 20 ms dwell. A fixed 20 ms dwell gives a 160 ms turn, below Cook's stated minimum of about 200 ms, so reading these papers as "20 ms per solenoid" is a misreading.
- **Direction.** Clockwise rotation raised power over the left hemisphere and counterclockwise over the right ([Booth, Koren & Persinger 2008](https://pubmed.ncbi.nlm.nih.gov/19037792/)). The lab chose counterclockwise "because we presumed the direction of the field would be moving against the rostral-caudal" waves of the cerebrum's own fields ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)).
- **Coils per position.** In the Koren patent each channel drove a pair of solenoids, and Murphy says each Octopus position held two coils (claim). This helmet has one coil per channel.
- **Ring position.** The lab's solenoid 1 sat over the left frontal region and solenoid 8 over the right prefrontal region, so the lab ring straddled the midline. Ring A (Layout A) starts at Fpz on the midline instead; the "lab 45° ring" placement (Fp1 … Fp2) follows the lab ([PLACEMENT.md](PLACEMENT.md)).
- **Replication.** All of these results are single-lab, and the project's research found no independent replication of any circumcerebral result.
- **In this project:**
  - `rotate` steps one coil at a time around the ring, and `cycle` steps around one side or both sides (with `dirLeft` and `dirRight`);
  - a dwell ramp restarts at its first value after its last step, and the shortest dwell is 0.5 ms;
  - `crossfade` blends neighbouring coils instead of switching.

### 2.9 The "20+2" sign trap

**Lab notation.** The papers write a schedule as base ± change: "a 20+2 configuration (the first number is the base duration and the second number is change in duration)" runs 20, 18, …, 6 ms. In "20−2", "with each successive solenoid the duration was 2 ms longer" ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)), which [Lehman 2016](https://laurentian.scholaris.ca/items/e809389f-805c-4414-8177-d0bf8d7127bb) spells out as 20, 22, …, 34 ms. So in the papers, "+" means the rotation speeds up and "−" means it slows down.

**Patent notation.** The hardware patent uses the opposite sign. Its worked example sets the "sequence acceleration" to −2 ms with a 10 ms interval and gets 10, 8, 6, 4 ms ([US 6,312,376](https://patents.google.com/patent/US6312376B1/en)). A re-implementation that takes the patent's sign while reading the papers' labels rotates the wrong way in time.

**Inside the lab.** Tsang 2004's "acceleration of +2 ms" ends at 11 ms, so it follows the papers. The Swann table's "100 … +20" cannot mean shorter: 100 − 7 × 20 is below zero, so it must mean longer, as in Collins 2013 and Persinger, Koren & Tsang 2003. The sign is not used consistently even inside the lab.

**In the presets.** Presets built from the Swann table and the lab's six-configuration table read those tables' signs literally (+ longer, − shorter), because the "+20" rows can only mean longer. Presets built from Persinger & Lavallee's prose (for example `telepathy-sender`, `persinger-lehman-2016-gamer-pairs`) use the papers' convention. Each preset's phase name spells out its dwell values, so check those rather than the labels.

**The project's notation.** `dwell: [start, step, end]` avoids labels: `step` is the plain change in ms.

| Label in a paper | Dwell sequence | Project `dwell` |
|---|---|---|
| 20+2 | 20, 18, …, 6 ms | `[20, -2, 6]` |
| 20−2 | 20, 22, …, 34 ms | `[20, 2, 34]` |
| 25+2 (Tsang 2004) | 25, 23, …, 11 ms | `[25, -2, 11]` |
| 100+10 | 100, 90, …, 30 ms | `[100, -10, 30]` |
| 100−10 | 100, 110, …, 170 ms | `[100, 10, 170]` |

The four labels 20+2, 20−2, 100+10 and 100−10 appear together in [Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99), for their later yoked light-flash experiments. Rule of thumb: write out the eight dwell values from the paper's prose before you type a ramp.

### 2.10 What was never published

- The burst-firing point values, at any length.
- The lab's LTP/hippocampal file.
- Any numeric definition of a "chirp".
- The caudate, septal, ERP and "consciousness" signals. They exist only as Shiva product names, "based on templates licensed by Stan Koren and Dr. Michael A. Persinger". The ERP page says the signal "should be considered as untested" ([Murphy, Shiva demo: Event-Related Potential](https://www.god-helmet.com/wp/shiva/shiva_demo/erp_page.htm)).
- The "Linda Genetic Pulse", which is known only by name from a magazine article (anecdote; [Hitt 1999](https://www.wired.com/wired/archive/7.11/persinger.html)).
- The full list of configurations in most 6 × 5 min rotation studies. The Swann Table 1 set above is the exception. A 2008 paper (Persinger, Tsang, Booth & Koren) is reported to print a second six-configuration table, which some presets use; the project's research could not open that paper, so its table is unverified.
- The geomagnetic-storm file "geomagn5071.dac". It is described in [Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a), but the description contradicts itself: its segment durations imply 3 ms points while the text says 1 ms, and the segments do not add up to 5071 points. It cannot be rebuilt exactly.

The one exception is Table 1 of [US 6,234,953](https://patents.google.com/patent/US6234953B1/en), which the project plays point for point. Every other Persinger-lineage pattern here is an approximation of a description, not a copy of a file.

---

## 3. Murphy's Shakti and Shiva signals

Todd Murphy's consumer devices descend from the Persinger/Koren lab helmets: the 2- and 4-coil Shakti, the stereo "Shakti Helmet", the 8 Coil Shakti, the 16-coil Shiva and the Shiva "God Helmet" configuration. All of them play audio files through sound cards into coils. Statements below come from Murphy's own pages and are **claims** unless marked otherwise.

### 3.1 What is published and what is proprietary

**Licensing and copyright.** The credits page says: "Templates for the Shiva signals licensed by Dr. M.A. Persinger and Stan Koren … Signals copyright by Todd Murphy. (US copyright registration SRU 940-033.)" ([Murphy, About Shiva](https://www.god-helmet.com/wp/shiva/shiva_demo/about_shiva.htm)). The project's research did not check the copyright record.

**Endorsement.** Persinger's 2015 letter calls the Shiva God Helmet "a faithful reproduction of our laboratory apparatuses" and the Shakti "a viable alternative that accurately renders our signals". It gives no technical parameters ([Persinger 2015 endorsement letter](https://www.god-helmet.com/wp/god-helmet/persinger_endorsement_of_shiva_god_helmet.pdf)).

**What is public and what is not:**
- Not published: the waveform files.
- Published: signal names, the timing scheme, session structures and coil layouts.
- This project neither copies nor reconstructs the vendor's files. Every Murphy-derived program uses the built-in approximations and says so in its notes.

**The lab's own comparison.** The lab compared the Shakti sound-card route with its own 4-solenoid "Koren boxes". The two differed only in high alpha (10.5–13 Hz) EEG power ([Tsang, Koren & Persinger 2004](https://pubmed.ncbi.nlm.nih.gov/15527205/); single-lab).

### 3.2 Signal families

| Murphy's name | What the vendor says | Project stand-in |
|---|---|---|
| Amygdala ("bx", burst-firing) | standard version with 3 ms points and about 4 s latency | `burst`, 690 ms bursts with a 4 s gap |
| Hippocampal ("ltp"/"tp"): normal, slow, rapid, high-speed | LTP-derived; FFT peak 5.4 Hz | point tables (`primed`, `ltp`) |
| Amygdala and hippocampus "in sequence" | the two signals one after the other with a four-second latency ([Murphy, mood enhancement](https://www.god-helmet.com/wp/winshakti/rotating/shakti_happiness.htm)) | two phases or tables |
| Modulated 40 Hz ("Consciousness", "binding factor") | see 2.6 | `pm` |
| Modulated 40 Hz chirp | see 2.7 | `chirp`, or a 40 Hz carrier with a dwell ramp |
| Caudate, septum ("pleasure center"), thalamus burst-firing | names only ([Murphy, Shiva demo: simple signals](https://www.god-helmet.com/wp/shiva/shiva_demo/simple_signals.htm); [Murphy, Shakti demo: thalamus burst-firing](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/thalamus_burst_firing_consent.htm)) | `burst` stand-ins |
| Event-related potential (ERP) | "should be considered as untested" | `erp` generator (project construct) |
| Fibonacci, Fibonacci-amplitude hippocampal | no waveform published | `fibonacci` generator (project construct) |
| Theta-band noise ("5jut4ran") | began as an accident with mis-configured DAC hardware; spectral peak 5.4 Hz ([Murphy, Shakti demo: random theta band](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/5jut4ranconsent.htm)) | `noise`, 4–6.8 Hz |

### 3.3 Timing variants and the 9.6 s per minute duty

**Three speeds** ([Murphy, Shakti demo: rapid and high-speed signals](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rapid_&_high_speed_signals.htm)):
- **Standard:** "the standard signals have 3 msec points", with a "latency" of "about four seconds" between bursts.
- **Rapid:** the same signal with no silent intervals.
- **High-speed:** no silent intervals, with "blips" one third as long.

**File names** follow an "ISI_point duration" scheme:
- `amy_4000_3` is the normal-speed amygdala signal; `amy_3_3` is rapid; `amy_1_1` is high-speed.
- `ltp_1_1` has "One millisecond between signals, and one millisecond for each point in the signal" ([archived 2007 Shakti page](https://web.archive.org/web/20071010063717/http://www.shaktitechnology.com/demo/shakti_demo/ltp_1_1_consent.htm)).
- The "slow hippocampal" file `tp_24_16` has numbers that are not explained.
- In Shiva, "fast" speeds a signal up three times ([Murphy, Shiva demo: hippocampus](https://www.god-helmet.com/wp/shiva/shiva_demo/hippocampus_page.htm)).

**Duty cycle.** "A one minute exposure will involve approximately 9.6 (nine point six) seconds exposure", from 16-bit PCM WAV files ([Murphy, Shakti demo: formal discussion](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/mono_proposal.htm)). An older page describes "a brief (less than one second) signal followed by four (4) seconds of silence" ([archived 2007 Shakti page](https://web.archive.org/web/20071010181432/http://www.shaktitechnology.com/demo/shakti_demo/gauss_info.htm)). By arithmetic, 9.6 s per minute fits about 12 bursts of about 0.8 s in cycles of about 5 s.

| Variant | Project setting (burst example) |
|---|---|
| Standard | `pointMs: 3`, `sweepMs: 690`, `gapMs: 4000` |
| Rapid | `pointMs: 3`, `gapMs` near 0 |
| High-speed / Shiva "fast" | `pointMs: 1`, `sweepMs: 230`; the Shiva "fast" presets also cut the gap to a third (project choice) |

### 3.4 Intensity statements

The vendor's figures do not agree:
- 10 mG at a 0.5 V peak ([Murphy, Shakti demo: measurement](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/measurement.htm));
- "10 to 20 milligauss" ([formal discussion](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/mono_proposal.htm));
- a 50 mG "laboratory standard" that equals the 50 % default ([dud sessions](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/duds.htm));
- 90 mG, or 90 %, on the old 2/4-coil page ([volume](https://www.god-helmet.com/wp/winshakti/volume.htm));
- a 92 mG capacity ([FAQ](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/faq.htm)).

10 mG is 1 µT. The volume percentage is a sound-card setting, not a calibrated field, and the project's research found no independent gaussmeter measurement of any Shakti or Shiva unit. For comparison, the lab protocols used about 1 µT for the temporal helmet, 2–5 µT for Swann and 5–10 µT in the rotation studies (section 2.8).

### 3.5 8 Coil Shakti stereo polarity wiring

**Layout.** Each temporal lobe gets a 4-coil cross. The left stereo channel drives the vertical pair (top and bottom) and the right channel the horizontal pair (front and back). Each pair is one + coil and one − coil ([Murphy, Shakti demo: getting started, 8-coil chart](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/getting_started_basic.htm)):

| Position in the cross | Left side of the head | Right side of the head |
|---|---|---|
| Top | left channel − | left channel + |
| Bottom | left channel + | left channel − |
| Front | right channel − | right channel + |
| Back | right channel + | right channel − |

**Alternation.** Signals alternate between the two channels in one of two modes ([Murphy, Shakti demo: understanding the 8 Coil Shakti](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rot_principles.htm)):
- **"fast":** "they switch channels every half-second". The vendor says this mode emerged as "the most effective" in the original developers' lab tests (claim).
- **"slow":** "one switch after one instance of the signal".

For Shiva coil pairs, Murphy says like polarities give deeper fields and opposite polarities stronger, shallower ones ([Murphy, Shiva demo: putting on the coils](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_coil_setup.htm); claim).

**In this project** (e.g. `shakti-alternate` in the Programs tab):
- **Sites.** Custom sites FT7, C5, TP7 and T9 on the left and FT8, C6, TP8 and T10 on the right. The site names are an inference from "top, bottom, front, back".
- **Polarity.** `weights` of −1 on C5, FT7, T10 and TP8 give the reversed coils.
- **Alternation.** Two `tracks` gated in point tables switch the coil pairs every 0.5 s.
- **Exact:** polarity pattern and alternation rate. **Approximated:** the signal and the exact positions.

Layout B (temporal 4 + 4) is not the same. It shares the front and back coils (FT7/FT8, TP7/TP8), but has T7/T8 and CP5/CP6 where the cross has its top and bottom coils (C5/C6, T9/T10) ([PLACEMENT.md](PLACEMENT.md)). Weights only mean what they say if every coil is mounted north face inward ([CALIBRATION.md](CALIBRATION.md); leads in [WIRING.md](WIRING.md)).

### 3.6 Shiva rotation

**Geometry.** Shiva has 8 pairs of coils (16 coils) on 8 channels from 4 USB stereo devices, spaced evenly around the head. Murphy's placement rules are "no coils above the nose", none above the bony ridge at the back of the head and "no coils directly above the ears". The first coil sits over the left frontal area and the rotation runs counterclockwise viewed from above ([Murphy, Shiva demo: coil locations](https://www.god-helmet.com/wp/shiva/shiva_demo/locations.htm); [Murphy, Shiva demo: staying safe](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_safety.htm)).

This project's Ring A (Fpz, F7, T7, P7, Oz, P8, T8, F8) puts coils on the front and back midline and above the ears, which those rules avoid. See [PLACEMENT.md](PLACEMENT.md).

**Speed.** Three vendor statements do not agree:
- 2007: "at around the same speed" as the 25 ms "binding factor" ([archived 2007 Shiva page](https://web.archive.org/web/20070801085539/http://www.shaktitechnology.com/shiva/index.htm));
- a lecture: dwell "10, then the speed of 12 14..16.. 18..20" ms ([Murphy, Psychic Skills lecture](https://youtu.be/tmC1174POpA?t=1184));
- 2008 to today: "usually around 9 times per second" ([Murphy, Understanding Shiva Neural Stimulation](https://www.god-helmet.com/wp/shiva/understanding_shiva_neural.htm)).

By arithmetic these are about 5, about 7.4 and 9 turns per second. The 7.4 assumes the lecture's ramp continues to 24 ms over eight coils. The real Shiva timing tables are unpublished.

**The God Helmet configuration.** In the Shiva God Helmet, four coils per temporal lobe run on 8 channels. The text says "Over the left side, the direction is clockwise, and over the right, it's counter clockwise" ([Murphy, God Helmet session list](https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm)).
- **Direction.** The vendor's coil-numbered animations show each side as seen from that side. So both sides actually run top → back → bottom → front, a mirror-symmetric pattern. One 2021 illustration contradicts this.
- **Speed.** The vendor gives no ms value per coil, only "several times per second".
- **In this project.** The God Helmet presets use `cycle` on both sides (`dirLeft: "cw"`, `dirRight: "ccw"`) with a 125 ms dwell. The 125 ms is a project choice.

### 3.7 Independent tests

- **Gendle & McGrath 2012.** A randomized, sham-controlled study of the 8 Coil Shakti amygdala signal over both temporal lobes (30 min, N = 37) found no effect on emotional responses to pictures ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)). Murphy disputes their choice of session.
- **Tinoco & Ortiz 2014.** A cross-layout helmet with simple 100 Hz pulses and 250 ms coil steps found differences only in post-session verbal reports ([Tinoco & Ortiz 2014](https://jcer.com/index.php/jcj/article/view/361)). It did not use a Persinger waveform.
- **Granqvist et al. 2005.** The temporal-helmet null ([Granqvist et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)) applies to the whole family.

---

## 4. Clinical and laboratory low-field timings the generators copy

The `lowfield-*` programs copy the timing of mainstream weak-field protocols. Timing is exact to 0.5 ms; field strength is not.

The "this helmet" column uses the coil model at the 4.54 mA cap:
- about 8 µT at 20 mm;
- about 1 µT at 45 mm;
- about 0.2 mT on the scalp in front of a coil;
- an induced E in µV/m for smooth signals, plus µs spikes of about 11 mV/m at 20 mm with slew-limited edges (at most about 40 mV/m for an ideal step).

At the usual 1 µT intensity, divide the field by 8.

| Protocol (generator) | Original timing | Original field | This helmet vs the original | Evidence for the original |
|---|---|---|---|---|
| LFMS (`lfms`) | 1 ms trapezoids of alternating polarity, 256 µs ramps, 500 Hz; 0.5 s trains every 2 s; 20 min ([Fava et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/)) | under 50 G (5 mT); estimated peak E about 0.5 V/m | E far below; the original's E comes from dB/dt on the ramps | single-lab, inconsistent across RCTs: multisite RCT null ([Fava et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/)); meta-analysis of 9 RCTs, SMD −0.61, low certainty ([Bharadwaj et al. 2026](https://pubmed.ncbi.nlm.nih.gov/41911470/)) |
| T-PEMF, Re5 (`tpemf`) | +3 ms / −3 ms bipolar square, 12 ms pause (18 ms, 55.6 Hz) ([Larsen et al. 2020](https://vbn.aau.dk/ws/files/330286808/transcranial_pulsed_electromagnetic_fields_for_treatmentresistant_depression_a_multicenter_8week_singlearm_cohort_study.pdf)); about 4.5 ms biphasic at 50 Hz in [Tang et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13103953/); 7 coils in phase; 30 min daily | modelled cortex mean about 0.3 mT and 0.01 V/m ([Tang et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13103953/)) | about 40× weaker in B at the cap | single-lab positive sham RCT ([Martiny et al. 2010](https://pubmed.ncbi.nlm.nih.gov/20385376/)); independent sham RCT null ([van Belkum et al. 2021](https://pubmed.ncbi.nlm.nih.gov/34333176/)) |
| Lawson Cnp (`cnp`) | patent table at 1 ms; 4 bursts with 110 / 220 / 330 / 1200 ms refractory periods ([Camera et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4412122/)); 40 min twice daily for 7 days | 400 µT at headset contact, ±200 µT at the head surface, ±35 µT deep ([Thomas et al. 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/)) | similar near the scalp at full current; deep in the head about 30× weaker (35 µT vs about 1 µT at 45 mm) | single-lab; of Thomas 2007 the authors write "ours essentially was a negative study" |
| BHFS (`bhfs`) | 20 pulses of 300 µs in 62.6 ms; trains at 6.55 Hz for 1 min, 9.75 Hz for 8 min, 6.15 Hz for 1 min ([Grehl et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5093126/)) | about 10 mT, rise under 100 µs; rodent studies span 1–150 mT ([Moretti & Rodger 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9846462/)) | about 1000× weaker | single-lab, rodents and cultures; 4.5 mT was ineffective in [Dufor et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6821463/) |
| iTBS (`itbs`), cTBS (`ctbs`) | 3 pulses at 50 Hz every 200 ms; iTBS 2 s on every 10 s × 20 = 600 pulses (about 190 s); cTBS 40 s continuous = 600 pulses ([Huang et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15664172/); [Suppa et al. 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614023/)) | TMS at 80 % of active motor threshold | timing only; orders of magnitude below motor threshold | established at TMS strength for depression ([Blumberger et al. 2018](https://pubmed.ncbi.nlm.nih.gov/29726344/), n = 414); no evidence at µT |
| 40 Hz GENUS (`square40`; 40 Hz `sine`) | LED 12.5 ms on / 12.5 ms off; 1 ms 10 kHz tones every 25 ms; 1 h a day ([Iaccarino et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5656389/); [Martorell et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6774262/)) | sensory stimulation, no magnetic field | a magnetic 40 Hz field is a project construct | single-lab and contested: no entrainment in mice in [Soula et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10839995/) |
| Alpha, synchronized TMS (`sine` at the individual alpha frequency) | sinusoidal field at the individual alpha frequency from three rotating magnets on the midline, 30 min a day ([Leuchter et al. 2015](https://pubmed.ncbi.nlm.nih.gov/26143022/)) | about 6,400 G (0.64 T) at the magnet surface ([NCT03288714 protocol](https://cdn.clinicaltrials.gov/large-docs/14/NCT03288714/Prot_000.pdf)) | about 1300× weaker at the coil face | single-lab: pivotal RCT negative by intention to treat, positive only per protocol |
| Alpha, tACS (`sine`, 10 Hz) | 10 Hz or individual-alpha current over parieto-occipital cortex ([Zaehle et al. 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2967471/)) | electrical; about 0.8 V/m in cortex at 2 mA ([Huang et al. 2017](https://pubmed.ncbi.nlm.nih.gov/28169833/)) | E about 10⁵ times lower | single-lab EEG effects; the magnetic version is a project construct |
| Schumann (`sine`, 7.83 Hz) | fundamental about 7.8 Hz, varying 7.2–8.2 Hz over the day in the east–west component ([Ouyang 2013](https://html.rhhz.net/Geophy_en/html/20130304.htm)) | natural amplitude about 1 pT ([arXiv 2110.14730](https://arxiv.org/pdf/2110.14730)) | about 10⁶ times *stronger* than the natural field at 1 µT | claim: the one RCT of a "Schumann" sleep device found no between-group sleep difference ([Huang et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35707548/)) |

None of these programs is a replica of a tested treatment. They are pattern replicas or research probes. To test one honestly, run it blind against sham in the Experiment tab ([EXPERIMENTS.md](EXPERIMENTS.md)).

---

## 5. Engine patterns and generators: origin, exact, approximated

The syntax for all of these is in [PRESET_FORMAT.md](PRESET_FORMAT.md). The engine code is `webapp/src/engine/patterns.js` and `generators.js`, mirrored in the firmware. "Evidence" rates the original protocol, never this helmet.

### 5.1 Pattern types (`pattern.type`)

| Type | What the engine plays (defaults) | Origin | Exact | Approximated |
|---|---|---|---|---|
| `off` | nothing | the sham arm of blinded tests ([EXPERIMENTS.md](EXPERIMENTS.md)) | zero output | – |
| `dc` | constant current | bench tests and calibration; `lowfield-tsms-dc` as a negative control | – | not tSMS: tSMS magnets give 110–190 mT at 2–3 cm ([Kirimoto et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5048290/)), while a coil's DC field is below the Earth's (about 35 µT in [Wang et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494972/)) |
| `sine` | `f0` 7 Hz, 1 ms points | Booth 2003 (7 Hz, point durations), Sculthorpe 2003 (5 and 40 Hz), alpha, Schumann, other low-field probes | frequency, point duration | field strength; some originals used uniform whole-head fields |
| `chirp` | linear sweep `f0` → `f1` (4 → 40 Hz) over `sweepMs` (2000), then `gapMs` | Murphy's "chirp"; phase 1 of the God Helmet sessions | phase lengths of the sessions | the waveform: no source defines it (2.7) |
| `burst` | rising sweep 6 → 30 Hz over 1500 ms, 4000 ms gap, 3 ms points | Persinger/Koren burst-firing (Burst-X) | point duration, burst length, ISI when set from the sources (690 / 3310 / 3) | the point values (unpublished); 6 → 30 Hz is a project choice |
| `thomas` | falling sweep 25 → 6 Hz over 2500 ms, 1000 ms gap, 3 ms points | the Thomas pulse | point duration | burst length (2.5 s vs 2.55 s) and everything inside the burst; use the `thomas` *generator* for the real table |
| `pulse` | rectangular pulses, 100 ms on, 100 ms off, alternating polarity | the lab's "pulsed (1 sec. every 4 sec.)" comparison field ([Gillis & Persinger 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/)); Tinoco & Ortiz's 100 Hz pulses; GENUS-timed on/off square | timing | the content of the lab's pulsed field (unpublished) |
| `semirandom` | a random value per 3 ms point (seeded) | the random-sequenced control arm of [Tsang, Koren & Persinger 2009](https://pubmed.ncbi.nlm.nih.gov/20017627/) | point duration | the lab's own random sequence |
| `pm` | 40 Hz carrier, phase-modulated at 0.5 Hz, depth 3 rad | [Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/) ("five times per sec."); Murphy's "modulated 40 Hz" | carrier and rate when set to 40 Hz / 5 Hz | depth (unpublished); the 0.5 Hz default is a project choice; Murphy's file |
| `noise` | 12 sines spread over `f0`–`f1` (4–8 Hz) with random phases | Murphy's theta-band noise (5.4 Hz peak) | band | the vendor's spectrum |
| `table` | point values 0–255 (128 = zero) with `pointMs` and `gapMs` | published point tables; the generators below | the values as given | – |

### 5.2 Generators (`node scripts/table.mjs <name>`, run in `webapp/`)

| Generator | Builds | Origin | Exact | Approximated or note | Evidence (original) |
|---|---|---|---|---|---|
| `thomas` | the 849 Table 1 points at 3 ms, optional gap | [US 6,234,953](https://patents.google.com/patent/US6234953B1/en); [Buckner et al. 2015](https://europepmc.org/article/MED/25875081) | every point value; 3 ms points; 2.55 s burst | – | single-lab |
| `cnp` | Table 1 at 1 ms; 4 bursts with 110 / 220 / 330 / 1200 ms refractory periods | US 6,234,953; [Camera et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4412122/); [Thomas et al. 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/) | every point value; 1 ms points; refractory gaps | burst length 849 ms (cycle 5256 ms) vs Camera's 838 ms (5212 ms); 4-burst cycle from Camera, not the patent figure | single-lab |
| `primed` | primer, then 4 pulses 150 ms later; 5 trains per second; optional ISI | [Corradini 2014](https://laurentian.scholaris.ca/items/1455e1f3-2f1d-47b5-93cd-23713d69e651); [Delparte & Persinger 2007](https://pubmed.ncbi.nlm.nih.gov/17365115/) | 150 ms gap; positive-only 1 ms pulses; 5 trains/s; 0, 5 or 10 s ISI | 100 Hz spacing inside the burst; the lab file's values; pairing Corradini's shape with Delparte's trains is a project assumption | single-lab |
| `ltp` | 4 biphasic pulses at 100 Hz, bursts at 5 Hz | Larson & Lynch 1986 (brain-slice LTP timing) | slice timing | not the Persinger file | slice physiology; nothing at µT |
| `itbs`, `ctbs` | 50 Hz triplets at 5 Hz; iTBS 2 s every 10 s, cTBS continuous | [Huang et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15664172/); [Suppa et al. 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614023/) | timing | each pulse is 2 × 0.5 ms ticks (+A then −A) instead of a TMS pulse of a few hundred µs | established at TMS strength |
| `lfms` | +A, +A, −A, −A at 0.5 ms (500 Hz) in 0.5 s trains every 2 s | [Rohan et al. 2014](https://pubmed.ncbi.nlm.nih.gov/24331545/); [Fava et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/) | timing, polarity alternation | the 256 µs ramps become square half-waves | single-lab, inconsistent |
| `tpemf` | +3 ms / −3 ms / 12 ms pause (Larsen), or 2.5 / 2.5 / 15 ms (`variant: "tang"`) | [Larsen et al. 2020](https://vbn.aau.dk/ws/files/330286808/transcranial_pulsed_electromagnetic_fields_for_treatmentresistant_depression_a_multicenter_8week_singlearm_cohort_study.pdf); [Tang et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13103953/) | Larsen timing | Tang's about 4.5 ms pulse is played as 5 ms | single-lab positive, independent null |
| `bhfs` | 20 pulses in 62.6 ms, trains at 6.55, 9.75 or 6.15 Hz | [Grehl et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5093126/) | train timing to ±0.25 ms | 300 µs pulses become one 0.5 ms tick | single-lab (rodents) |
| `square40` | bipolar ±A square at 40 Hz (12.5 / 12.5 ms) | [Iaccarino et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5656389/) light-flicker timing | timing | GENUS is light and sound; magnetic and bipolar here | single-lab, contested |
| `fibonacci` | Larson & Lynch theta bursts whose amplitudes rise and fall along 1, 1, 2, 3, 5, 8, … | project construct after Murphy's signal list | – | entirely a construct; Murphy's file is proprietary | unverified |
| `erp` | textbook ERP shape (P50, N100, P200, N200, P300) every 1.5 s | project construct after Murphy's "ERP" signal; textbook latencies (Luck 2014) | – | entirely a construct; the vendor calls its own ERP signal "untested" | unverified |

**Two warnings about these tables:**
- **Same name, different things.** The `thomas` pattern type and the `thomas` generator differ: only the generator is the real waveform. Likewise, `ltp` is not the Persinger LTP file; `primed` is the closer description.
- **Exact timing, not exact strength.** "Exact" always means exact timing or point values. No generator reproduces the original field strength, and this helmet cannot reach the clinical devices' strength.
