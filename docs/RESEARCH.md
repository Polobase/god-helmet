# Research review: weak magnetic fields, the God Helmet and what this build can test

This is the project's main evidence review. It covers:
- what the Persinger/Koren laboratory and Todd Murphy claimed;
- what independent groups found;
- what mainstream low-field science and psi research show;
- what this helmet can and cannot reproduce.

Updated 27 October 2026.

Related documents:
- [HISTORY.md](HISTORY.md): people, institutions, and the military and intelligence background.
- [SIGNALS.md](SIGNALS.md): the published signal definitions and how the app approximates them.
- [PLACEMENT.md](PLACEMENT.md): coil layouts and 10-20 sites.
- [BRAIN_VIEW.md](BRAIN_VIEW.md): how the field map in the **Brain** tab is computed.
- [EXPERIMENTS.md](EXPERIMENTS.md): blinded real/sham sessions and psi trials.
- [SAFETY.md](SAFETY.md): exposure limits, contraindications and built-in safeguards.

---

## Bottom line

- **This helmet.** Eight small cored coils, at most 4.54 mA each.
  - Programs default to 1 µT, measured 20 mm in front of each coil (roughly the cortex under it).
  - That leaves less than 0.1 µT at the depth of the amygdala and hippocampus.
  - Full current gives about 8 µT at 20 mm.
- **The claims.** Persinger's lab reported sensed presences, fear, bliss, out-of-body feelings, mood changes, longer subjective time, EEG changes and psi effects from fields of about 0.1–10 µT.
  - Almost all of it is single-lab, with small samples.
  - Much of the later psi and "entanglement" work (shared fields between distant people, photon emission, chemical reactions) appeared in low-tier journals, some of it with no formal statistics.
- **Independent tests.**
  - The one rigorous independent replication found no effect of the field ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/), double-blind, N = 89). Absorption, temporal-lobe signs and New Age orientation predicted the reports.
  - Two more independent tests also found no field effect ([French 2009](https://research.gold.ac.uk/id/eprint/4209/2/French_et_al_Haunt_accepted.pdf), N = 79; [Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/), N = 37).
  - Inert sham helmets produce the same kinds of experiences when people expect them ([Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/); [Maij 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf)).
  - We found no independent, preregistered, double-blind test of the field itself published after 2014.
- **The dispute.** Persinger and Koren said Granqvist's timing was distorted and the exposure too short. Granqvist said Persinger had specified both. No third party has settled it. The experiment that would settle it has not been run.
- **Mainstream low-field science.** The methods tested in clinical trials (LFMS, T-PEMF, Cnp, static magnets) and in rodents (low-intensity rTMS) use fields tens to tens of thousands of times stronger than this helmet's. Their own evidence is mixed or of low certainty.
- **Physics.** Smooth signals from these coils induce about a microvolt per metre in the brain. Switching edges add millivolt-per-metre spikes that last microseconds. Neural networks start to respond at about 0.1–1 V/m. Standard biophysics predicts no direct neural effect.
- **Psi.** Ganzfeld meta-analyses still report small positive effects. These shrink under preregistration and bias corrections. The consensus-designed replication of Bem's precognition experiments and a preregistered remote-viewing test were both null. Persinger's psi studies are single-lab and mostly single subjects or a few pairs.
- **What the build is for.** Reproducing the published protocols as closely as the sources allow, and testing them blind:
  - real/sham sessions;
  - hash-committed remote-viewing and telepathy trials ([EXPERIMENTS.md](EXPERIMENTS.md)).

  A real effect of the field would show up as *real better than sham*, not as a striking experience.

---

## How to read this review

| Word | Meaning |
|---|---|
| **established** | Replicated by independent groups. |
| **single-lab** | Reported by one laboratory or one group and its close collaborators, with no independent replication. |
| **claim** | Stated by an author, vendor or programme, without published supporting data. |
| **anecdote** | Personal reports, testimonials and single cases. |
| **unverified** | Nobody has tested it, or we could not check the source. |

- Claims by Persinger's lab, and by Murphy (who sells the Shakti and Shiva devices), are reported as claims or single-lab results, not as facts.
- "Reported" means the authors said so. "Shown" is kept for results that survived independent tests.
- Values marked *computed* are the project's own calculations, from the code (`webapp/src/engine/field.js`) or from the cited data.
- **Where the material comes from.** This review rests on research compiled in October 2026:
  - PubMed and Europe PMC records;
  - the archived Laurentian University correspondence about the Granqvist study;
  - Laurentian theses and patents;
  - the open full texts of the independent tests;
  - Murphy's vendor pages and lectures;
  - declassified US documents and the psi meta-analyses.

  An adversarial fact-checker re-opened the sources. Refuted items were dropped and corrections applied.
- **Not read in full** (closed access or unreachable): Granqvist et al. 2005 and the two reply letters, Gendle & McGrath 2012, and Persinger et al. 2008 (NeuroQuantology). Their details come from abstracts, archived correspondence and secondary sources, as stated where used.

---

## What this helmet delivers

### Field of one coil

Each coil is a commodity 19 × 12 mm, 495-turn coil with a ferrite or iron core.
- The seller does not document the core material, so calibrate every coil ([CALIBRATION.md](CALIBRATION.md)).
- The project models the core as a magnetised cylinder. The model gives about 1.8 µT/mA on the axis 20 mm in front of the face and 105 µT/mA at the face.
- The inductance the model implies (4.1–4.6 mH) matches the seller's 4.1 mH ([BRAIN_VIEW.md](BRAIN_VIEW.md)).
- The 2.2 kΩ series resistors cap the current at 4.54 mA per coil.

A program's intensity is the peak on the coil axis 20 mm in front of the face. Computed on-axis values:

| Distance from coil face | What is there | µT per mA | Per 1 µT program setting | At the 4.54 mA cap |
|---|---|---|---|---|
| 0 mm | coil face | 105 | 56 µT | about 0.48 mT |
| 3 mm | scalp | 44 | 24 µT | about 0.2 mT |
| 10 mm | | 8.2 | 4.4 µT | 37 µT |
| 20 mm | cortex under the coil (calibration point) | 1.8 | 1 µT | about 8 µT |
| 30 mm | | 0.69 | 0.37 µT | 3.2 µT |
| 45 mm | | 0.24 | 0.13 µT | 1.1 µT |
| 55–60 mm | amygdala and hippocampus (about 5–6 cm below the scalp) | 0.11–0.14 | 0.06–0.08 µT | 0.5–0.6 µT |

- **Limits.** Programs default to 1 µT and may ask for up to 5 µT. The user ceiling defaults to 5 µT. The firmware never accepts more than 10 µT ([PRESET_FORMAT.md](PRESET_FORMAT.md), [CALIBRATION.md](CALIBRATION.md)).
- **Off the axis** the field is weaker. Coils that are on together add as vectors. The **Brain** tab shows the full 3-D map.
- **Earth's field.** The static field where Wang et al. worked was about 35 µT ([Wang 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494972/)), about 4× the helmet's full-current peak at the cortex.

### Induced electric field

Neurons respond to the electric field (E) that a *changing* magnetic field induces in tissue, not to the magnetic field itself ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf); [Grehl 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5093126/)).

Computed for this coil (spherical head, coil axis through the centre):

| Signal | Induced E | Duration |
|---|---|---|
| 7 Hz smooth sine at full current (8 µT) | about 1.7 µV/m at 20 mm | continuous |
| Steps of a 1-ms staircase (the 2 kHz engine) | about 0.6 mV/m | microsecond spikes |
| Full-swing edge (+10 V to −10 V) | about 11 mV/m at 20 mm, 2.8 mV/m at 45 mm, 95 mV/m at the scalp | 2–7 µs |

Reference values:

| Reference | Electric field | Source |
|---|---|---|
| ICNIRP general-public limit, brain, 10–25 Hz | 0.01 V/m (rms) | [ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf) |
| Retinal phosphene threshold, 20 Hz | about 10–100 mV/m (ICNIRP: 50–100) | [WHO 2007](https://inchem.org/documents/ehc/ehc/ehc238.pdf) |
| Network effects in hippocampal slices | 0.14 V/m rms; spike-phase entrainment at 0.2 V/m; 0.5–1 V/m peak-to-peak at 50 Hz | [Francis 2003](https://pubmed.ncbi.nlm.nih.gov/12917358/), [Reato 2010](https://pubmed.ncbi.nlm.nih.gov/21068312/), [Deans 2007](https://pubmed.ncbi.nlm.nih.gov/17599962/) |
| Spiking changes in living rodents | at least 1 V/m | [Vöröslakos 2018](https://pubmed.ncbi.nlm.nih.gov/29396478/) |
| Transcranial electrical stimulation, 2 mA | about 0.8 V/m in human cortex | [Huang 2017](https://pubmed.ncbi.nlm.nih.gov/28169833/) |
| Direct nerve stimulation | "as low as a few volts per metre" | [WHO 2007](https://inchem.org/documents/ehc/ehc/ehc238.pdf) |

What this means:
- **Smooth signals** sit about five orders of magnitude below the level where network effects begin. Edges are larger but last only microseconds.
- **Safety limits.** ICNIRP limits apply to the frequency-weighted waveform, not to raw peaks. Weighted that way, every signal type stays at least about 400× below the brain limit and about 47× below the scalp limit at full current ([SAFETY.md](SAFETY.md)).
- **Compared with TMS.** Granqvist et al. put Persinger-type fields at "approximately six orders of magnitude weaker than ordinary TMS fields" ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)).
- **WHO view.** WHO concluded that volunteer studies below established thresholds gave "evidence only of subtle and transitory effects at best" ([WHO 2007](https://inchem.org/documents/ehc/ehc/ehc238.pdf)).

Under standard biophysics, no direct neural effect is expected. A real effect would need an unknown mechanism. That is what the blinded modes test.

### What changed since earlier versions of this document

| Earlier statement | Correction |
|---|---|
| Air-core coil: 0.73 µT/mA at 20 mm and 22.9 at the face; "the core may raise these ×1.5–3" | The cored model gives about 1.8 µT/mA at 20 mm (2.4×) and 105 at the face (4.6×). An uncalibrated helmet with the old 0.73 default delivered about 2.4× the requested field ([CALIBRATION.md](CALIBRATION.md)). |
| The coil face stays under the 200 µT ICNIRP reference level | False at full current: about 0.48 mT at the face and 0.1–0.2 mT on the scalp. The reference level is a screening value for uniform fields; the basic restrictions on induced E are met ([SAFETY.md](SAFETY.md)). |
| Circumcerebral step "20 ms per solenoid" | The papers describe a 20-ms *change* in duration at each successive solenoid, not a fixed 20-ms dwell ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/); [Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/)). |
| Thomas pulse "25 → 6 Hz, about 2.5 s" | The exact table (849 points) is in [US patent 6,234,953](https://patents.google.com/patent/US6234953B1/en). Persinger's lab replayed it at 3 ms per point, 2.55 s per cycle ([Buckner 2015](https://europepmc.org/article/MED/25875081)); the Lawson Cnp line used 1 ms per point. |
| Burst-firing "3 ms points, 4000 ms between bursts" | Lab sources give 230, 248 or 289 points at 3 ms, once every 3–4 s ([Carniello 2020](https://laurentian.scholaris.ca/items/8c92763c-cd19-4a21-b242-3b572a28ce55); [Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a); [Collins 2013](https://laurentian.scholaris.ca/server/api/core/bitstreams/c03e0259-4b31-410f-9552-d90c9c2b81a4/content)). The point values were never published. |
| The lab's "LTP" signal is the Larson & Lynch theta burst | A thesis figure shows a primed burst: a primer pulse, then 4 pulses 150 ms later ([Corradini 2014](https://laurentian.scholaris.ca/items/1455e1f3-2f1d-47b5-93cd-23713d69e651)). The Harribance paper gives about 170 ms ([Persinger 2010](http://web.archive.org/web/20150426091303id_/http://www.neuroquantology.com/index.php/journal/article/download/301/346)). The lab itself still called some of its LTP fields "theta-burst" ([Delparte & Persinger 2007](https://pubmed.ncbi.nlm.nih.gov/17365115/)), so both readings have lab support. |
| "Chirp" is a function-generator sweep | No Laurentian paper defines a chirp. Murphy describes his signal as one that "does not change in tone" but has "longer and longer gaps" ([Murphy: Shiva lab sessions](https://www.god-helmet.com/wp/shiva/shiva_demo/experiment_signals.htm)); another of his pages ties it to a frequency-modulated "chirp sequence" and illustrates a classical chirp whose frequency falls ([Murphy: modulated 40 Hz chirp](https://www.god-helmet.com/wp/shiva/shiva_demo/mod40_chirp.htm)). The app's `chirp` sweep is an approximation. |
| Gendle & McGrath "found nothing" | They found no effect on emotional ratings of photographs. They did not measure sensed presence ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)). |

[SIGNALS.md](SIGNALS.md) gives the full signal record.

---

## The Persinger/Koren laboratory record

### Equipment and setting

- **The helmet.** A journalist described "a yellow motorcycle helmet" with solenoids "aimed directly at my temples" ([Hitt 1999](https://www.wired.com/wired/archive/7.11/persinger.html)).
  - Persinger and Murphy describe the standard helmet as four pairs of solenoids, with the field moved to the next pair every 0.5 s ([Persinger & Murphy 2016](https://www.god-helmet.com/wp/god-helmet/god_helmet_debate_publication.htm); [Persinger 2010](http://web.archive.org/web/20150426091303id_/http://www.neuroquantology.com/index.php/journal/article/download/301/346)).
  - The unit lent to the Swedish group was a 4-channel DAC (DAC010-V) with separate right and left solenoid sets ([Persinger, 23 Dec 2004](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+H.htm)).
- **Software.** Timing came from the DOS programs Complex 1.15 / complex2. Persinger wrote that Complex 1.15 must be recalibrated for point duration on computers above a 286 ([Persinger, 22 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm)); Koren sent the calibration procedure ([Koren, 3 Oct 2003](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+5.htm)).
- **Setting.** A blindfolded subject in an armchair inside an acoustic chamber that was also a grounded Faraday cage (2.74 × 2.54 × 1.98 m). Subjects were told to experience whatever happens "without labelling the experiences" ([Persinger & Koren, Response to Granqvist](https://web.archive.org/web/2011/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Persinger+Response.htm)).
- **Dose.** Human exposures were mostly 1 µT. The published range runs from 100 nT ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)) to about 10 µT in the circumcerebral work ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)). Almost no paper states where the "1 µT" was measured.
- **Duration.** Persinger wrote that subjects need "at least 20 min and usually 30 to 40 min per pattern" ([Persinger, 22 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm)).
- **Theory.** The lab read the sensed presence as the left hemisphere's sense of self perceiving right-hemisphere activity as another being: "intercalation between the hemispheres" ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)). This is a claim. [HISTORY.md](HISTORY.md) covers the background.

### Temporal-lobe protocols

| Protocol | Reported outcome | Evidence |
|---|---|---|
| **Burst-firing over both temporal lobes**, about 1 µT, 20–30 min; a burst of about 0.7 s once every 3 s ([Persinger, Hoang & Baker-Price 2009](https://pubmed.ncbi.nlm.nih.gov/20017628/)) | More pleasant, less active narratives ([Richards 1993](https://pubmed.ncbi.nlm.nih.gov/8407157/), n = 71). More aggression and less trust after 3 weekly sessions ([Gillis 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/)). Less depression after head injury ([Baker-Price 1996](https://pubmed.ncbi.nlm.nih.gov/8902023/), n = 4; [2003](https://pubmed.ncbi.nlm.nih.gov/12831278/), n = 14, no difference between temporal and frontal placement). Better mood and vigour than sham ([Tsang 2009](https://pubmed.ncbi.nlm.nih.gov/20017627/)). | single-lab. The same weekly schedule was reported both to raise aggression and to lift mood. |
| **Burst-firing or pulsed fields over the right temporoparietal lobe**, 15–20 min | Apprehension in women, not men ([Richards 1992](https://pubmed.ncbi.nlm.nih.gov/1408634/)). Higher hypnotic suggestibility only with right-sided fields ([Healey 1996](https://pubmed.ncbi.nlm.nih.gov/9003980/)) or when the right side came first ([Tiller & Persinger 1994](https://pubmed.ncbi.nlm.nih.gov/7744557/)). | single-lab |
| **Standard sensed-presence design**: right, left, bilateral or sham, 100 nT–1 µT, 20 min, opaque goggles, 48 subjects | More presences, fears and odd smells with right or bilateral fields than with left or sham ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)). A re-analysis of 19 experiments (407 subjects) concluded that the field pattern, not suggestibility, predicted presences ([St-Pierre & Persinger 2006](https://pubmed.ncbi.nlm.nih.gov/16861170/)). | single-lab |
| **"Thomas" frequency-modulated pattern** over the right parietotemporal region, 3-ms points, 8 configurations × 5 min, n = 12 | 40 % of all left-sided presences came during the forward Thomas pattern; the time-reversed version worked less well ([Tiller & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/11883572/)). | single-lab |
| **Button-press presence studies** | 9 of 15 volunteers pressed for a presence; the abstract counts field and sham exposures together ([Cook & Persinger 1997](https://pubmed.ncbi.nlm.nih.gov/9347559/)). None of 8 low scorers on epileptic-like signs did, against 60–75 % of 8 high scorers ([Cook & Persinger 2001](https://pubmed.ncbi.nlm.nih.gov/11361305/)). | single-lab. French 2009 found that trait scores predicted reports with or without the field. |
| **"Synthetic ghost"**: frequency-modulated pattern over the right hemisphere, then a bilateral pattern | One man reported "rushes of fear" and an apparition; EEG showed 15 Hz spikes ([Persinger, Tiller & Koren 2000](https://pubmed.ncbi.nlm.nih.gov/10833767/)). | anecdote (single case) |
| **"LTP" pattern**, right, left or both, 1 µT, 20 min, n = 40 | Right-sided fields rated more pleasant ([Persinger, Richards & Koren 1994](https://pubmed.ncbi.nlm.nih.gov/7744561/)). | single-lab |
| **7 Hz sine with point durations of 1–20 ms**, 5 min each, n = 6 | Most left-sided presences and occipital spikes at 1 and 10 ms ([Booth 2003](https://pubmed.ncbi.nlm.nih.gov/14738362/)). The lab cites this when it argues that timing fidelity matters. | single-lab |
| **40 Hz phase-modulated field**, 30 min, n = 24 | The phase-modulation hypothesis was *not* supported ([Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/)). | single-lab, negative |
| **1-s pulses over the left prefrontal cortex**, 1–10 µT, n = 50 | The burst-firing and 25 Hz groups accepted about twice as many false statements as true as the 50 Hz and sham groups did ([Ross 2008](https://pubmed.ncbi.nlm.nih.gov/19037785/)). | single-lab |
| **Burst-firing in coloured light**, 30 min | Red light increased dizziness, presence and detachment ([Meli & Persinger 2009](https://pubmed.ncbi.nlm.nih.gov/19116832/)). | single-lab |
| **Rat analgesia** from the same patterns | Analgesia "equivalent to about 4 mg/kg of morphine", blocked by naloxone ([Martin 2004](https://pubmed.ncbi.nlm.nih.gov/15219761/)). | single-lab |

### Circumcerebral ("Octopus") protocols

The Octopus is a ring of 8 solenoids, 45° apart, in the horizontal plane above the ears.
- Coil 1 sits over the left frontal region. The sequence runs counter-clockwise seen from above, ending over the right prefrontal region ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)).
- Each solenoid was a reed relay with its switch replaced by a steel nail core ([US patent 6,312,376](https://patents.google.com/patent/US6312376B1/en)).
- Measured fields: about 1 µT at the centre of the array ([Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html)); 1–5 µT inside each solenoid ([Lehman 2016](https://laurentian.scholaris.ca/server/api/core/bitstreams/e7b03302-1b7f-4f4f-acf5-bdf41ee5370f/content)).

| Study | Protocol | Reported outcome | Evidence |
|---|---|---|---|
| [Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/) | About 10 µT; six patterns × 2.5 min; 20 ms added at each successive solenoid; clockwise vs counter-clockwise groups | The counter-clockwise group judged a 10-s interval about 3 s longer (about 50 % of variance) | single-lab; no sham arm in the abstract |
| [Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/) | 5–10 µT; six configurations; n = 8 | About 30 % more theta power with 20-ms rates of change; right hemisphere 20 % higher at 5.0–5.9 Hz | single-lab |
| [Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/) | Six × 5 min counter-clockwise; n = 11 | Only 25 ms then 2 ms less per solenoid (to 11 ms) raised 35–45 Hz power, frontally and occipitally | single-lab; one of six conditions significant |
| [Booth 2008](https://pubmed.ncbi.nlm.nih.gov/19037792/) | Same patterns, both directions | Clockwise raised left-hemisphere power, counter-clockwise right | single-lab |
| [Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/) (Ingo Swann) | One 30-min session. The abstract gives no schedule or intensity; the project read six configurations at 2–5 µT from Table 1 of a full-text scan (the `persinger-swann-2002-table1` program) | Occipital 7 Hz spike-and-slow-wave activity correlated with remote-viewing accuracy (rho = .50) | single-lab (one subject, no sham) |
| [Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12509207/) | Fields under 20 nT around the sealed target photographs, not the head | Windows-generated (phase-modulated) patterns lowered Swann's accuracy; DOS-generated ones did not | pilot, single-lab |
| [Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/) | 4 sibling pairs; the stimulus person in the ring, about 1 µT, six × 5 min | 5–6 Hz power rose in the distant, unstimulated partner during one configuration ("100 msec. with changes in rate of 20 msec.") | single-lab; the lab's 2010 retelling gives a different configuration ("20+2") and location (right parietal) |
| [Persinger, Cook & Tiller 2002](https://pubmed.ncbi.nlm.nih.gov/12434847/); [Booth, Charette & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12434850/) | One partner exposed; the other, in another room, wrote reminiscences or about one of five postcards | Blind matching succeeded for 5 of 7 pairs; correlations with geomagnetic activity had opposite signs in the two papers | single-lab |
| [Persinger 2010](https://pubmed.ncbi.nlm.nih.gov/20887774/) | Two people in identical rings 15 m apart ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)), driven together, rotation "based on 100 ms" | Right-parietal EEG power in one person at the frequency of light flashes shown to the other | single-lab |
| [Dotta 2011](https://pubmed.ncbi.nlm.nih.gov/21396353/) | Shared rings; photomultiplier beside the response person's head; 3 pairs | More photon emission from the right hemisphere during the distant flashes | single-lab |
| [Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html) | Chemical reactions in two rings: an accelerating "primer" (20+2) then a decelerating "effector" (20−2) | "Excess correlation" only with this order; reversed order, matched rates, constant speed and a plain 7 Hz sine all failed. The authors wrote that the effects were so large that statistical analyses were not needed and were included only "as a formality". | claim |
| [Burke 2013](https://jcer.com/index.php/jcj/article/view/279); [Scott 2015](https://jcer.com/index.php/jcj/article/view/493) | A 225-turn toroid on each head, driven by an Arduino (about 1 µT in Burke 2013, 30 nT in Scott 2015); 2 pairs 300 km apart, then 5 pairs more than 6,000 km apart | Correlated EEG changes between the distant partners | claim; no preregistration |
| [Collins 2013](https://laurentian.scholaris.ca/server/api/core/bitstreams/c03e0259-4b31-410f-9552-d90c9c2b81a4/content) | Murphy's 64-coil Shiva hat, 289-point burst-firing, 100 ms at the first column plus 20 ms per column, 20 min; 5 field, 4 sham | Field group endorsed 35 % of exit items, sham 9 % | claim (thesis, tiny sample) |
| [Saroka, Mulligan, Murphy & Persinger 2010](https://web.archive.org/web/20150331100355/http://www.neuroquantology.com/index.php/journal/article/download/302/347) | 64-coil Shiva; 5 min on, 1.5 min off, 5 min on; one man | An out-of-body experience that began seconds *after* the first block stopped | anecdote (single case) |

### Rotation notation

The lab wrote rotation schedules as *base ± change*, in ms per solenoid ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99); [Lehman 2016](https://laurentian.scholaris.ca/server/api/core/bitstreams/e7b03302-1b7f-4f4f-acf5-bdf41ee5370f/content)):
- **"20+2"** means 20, 18, …, 6 ms: the rotation accelerates.
- **"20−2"** means 20, 22, …, 34 ms: the rotation decelerates, 216 ms per turn.
- The Koren hardware patent uses the opposite sign for its "sequence acceleration" ([US patent 6,312,376](https://patents.google.com/patent/US6312376B1/en)). Copy the papers, not the patent.
- Where the lab printed a configuration with 20-ms changes, it starts at 100 ms ([Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/), Table 1; [Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/)).

In a program this is `"dwell": [20, -2, 6]` or `"dwell": [100, 20, 240]` ([PRESET_FORMAT.md](PRESET_FORMAT.md)).

### Problems in the lab's own record

- **Small samples, one lab, two journals.**
  - The human field studies typically have 6 to 71 subjects, mostly in *Perceptual and Motor Skills* and the *International Journal of Neuroscience*.
  - Persinger has 384 PubMed records. We found no human field experiment by an independent group that replicated one of his experiential effects ([PubMed author search](https://pubmed.ncbi.nlm.nih.gov/?term=Persinger+MA%5Bau%5D)).
- **What "double-blind" meant.**
  - In the lab's usage, the subject was told it was a relaxation study and the experimenter did not know the hypothesis ([Persinger, 22 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm)).
  - Granqvist objected that nobody interacting with subjects was blind to the *condition* ([Granqvist, 27 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+1.htm)).
- **Weaker venues later on.**
  - The psi and "entanglement" work from 2008 on appeared mostly in *NeuroQuantology*, the *Journal of Consciousness Exploration & Research* and SCIRP journals. Exceptions are the yoked-ring paper (*Neuroscience Letters*) and the photon paper (*Brain Research*).
  - Some of it skipped inferential statistics for the key claims ([Karbowski 2017](https://laurentian.scholaris.ca/server/api/core/bitstreams/7903b99a-d7b7-4b93-9cd7-7b5ef113aa57/content)) or added them only "as a formality" ([Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html)).
- **Internal contradictions.**
  - The same weekly burst-firing schedule was reported to raise aggression ([Gillis 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/)) and to lift mood ([Tsang 2009](https://pubmed.ncbi.nlm.nih.gov/20017627/)).
  - The lab's own mechanistic test of phase modulation failed ([Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/)).
- **Is it magnetic at all?** The lab later reported brain-source changes in blindfolded subjects from *light* flashes applied over the skull ([Karbowski 2015](https://pubmed.ncbi.nlm.nih.gov/26276250/)). If timing alone matters, the magnetic carrier may not.
- **Energy argument.** The lab argued that surgical electrical stimulation and its weak fields could affect similar numbers of neurons, and that the two produced comparable classes of experience ([Persinger & Saroka 2013](https://pubmed.ncbi.nlm.nih.gov/23348244/)). This is a retrospective comparison, not an experiment.

---

## The independent tests

### Summary

| Study | Design | Field | Result |
|---|---|---|---|
| [Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/) | Double-blind, sham-controlled, N = 89 (43 field, 46 sham) | Persinger-lab equipment and software, 3–7 µT | No field effect, overall or in highly suggestible people; trait measures predicted reports |
| [French 2009](https://research.gold.ac.uk/id/eprint/4209/2/French_et_al_Haunt_accepted.pdf) | 2 × 2 (field × infrasound), N = 79, *not* double-blind | Room coils replaying the burst pattern, under 50 µT | No effect of field or infrasound; only temporal-lobe-signs scores predicted reports |
| [Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/) | Randomised, sham-controlled, N = 37 | Commercial 8 Coil Shakti, "amygdala signal", 30 min | No effect on emotional ratings of 54 photographs |
| [Tinoco & Ortiz 2014](https://www.jcer.com/index.php/jcj/article/viewFile/361/386) | 10 field, 10 sham; subjects told it was a "God Helmet" | Home-built 8 coils, simple 100 Hz pulses | Nothing during sessions; some post-session word statistics differed, with a p < .10 threshold in part of the analysis |
| Sham-helmet studies (2014–2019) | Inert helmets, expectancy manipulated | none | Experiences follow expectation, absorption and spirituality |

### Granqvist et al. 2005 (Uppsala and Lund)

The paper's Methods section is closed access. Its exposure is pinned down by the archived e-mails between the two labs, which both sides confirm, and by the Nature news report.

| Parameter | Value | Source |
|---|---|---|
| Equipment | A 4-channel DAC prototype box built in 1998 and lent after a November 2000 lab visit (dates given as 2–3 or 3–4 Nov) | [Persinger, 23 Dec 2004](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+H.htm); [Larhammar, 20 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+3.htm) |
| Software | Complex v1.15, calibrated per its manual, total cycles 9000 "as instructed by you", run in a DOS shell under Windows 95 | [Granqvist, 5 Jan 2005](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm); [Murphy: The God Helmet Debate](http://www.innerworlds.50megs.com/The_God_Helmet_Debate.htm) |
| Phases | 15 min of the Thomas pattern over the right hemisphere, then 15 min of burst-firing bilaterally; stopped with ctrl-alt-del, timed by watch | [Granqvist, 5 Jan 2005](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm); [Persinger, 22 Dec 2004](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+G.htm) |
| Field and placement | 3–7 µT, "aimed just above and in front of the ears" | [Khamsi 2004](https://www.nature.com/news/2004/041206/full/news041206-10.html) |
| Setting | Isolation chamber of about 2 m²; blindfolds (left out of the paper); earplugs (attested only by the Laurentian side) | [Granqvist, 5 Jan 2005](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm); [Laurentian, Dec 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm) |
| Blinding | One experimenter met participants and was blind to condition; another made the random assignments and never met participants | [Granqvist, 27 Nov 2004](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+1.htm) |
| Measures | Persinger's EXIT scale translated into Swedish (0 = never, 1 = occasionally, 2 = often) and a mysticism measure; predictors: Tellegen Absorption, temporal-lobe signs, New Age orientation | [Granqvist, 5 Jan 2005](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm); [Paddock, BU review](https://people.bu.edu/wwildman/relexp/reviews/review_granqvist_persinger01.htm) |

**Result.** The authors found "no evidence for any effects of the magnetic fields, neither in the entire group, nor in individuals high in suggestibility" ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)).
- Two of the three people with strong spiritual experiences were controls, as were 11 of the 22 with subtle ones ([Khamsi 2004](https://www.nature.com/news/2004/041206/full/news041206-10.html)).
- A re-analysis found that religiousness predicted mystical experiences with a religious quality. The authors read the pre-session religiousness questionnaires plus sensory deprivation as a prime ([Granqvist & Larsson 2006](https://pubmed.ncbi.nlm.nih.gov/16967739/)).

**Persinger and Koren's objections** ([Laurentian, Dec 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm); [Persinger & Koren 2005](https://pubmed.ncbi.nlm.nih.gov/15862915/)):
1. **Timing.** Complex 1.15 was written for old DOS machines; Windows distorts the point durations.
2. **Duration.** 15 min per pattern was meant for a PET feasibility study; subjective effects need 20–40 min.
3. **Setting.** A small box, earplugs and priming instructions interfere.
4. **Scores.** Both Swedish groups scored M = 0.3, SD = 0.5 on sensed presence, the same as Laurentian sham groups, where effective fields give "0.8 or higher". Temporal-lobe sensitivity was similar in both populations (0.34 vs 0.32). They concluded the subjects "never received an effective field configuration". This is a claim, and the sharpest testable prediction in the dispute.
5. **Verification.** The field and its acoustic signature were not checked before each subject.

**Granqvist's answers** ([Granqvist, 5 Jan 2005](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm); the published reply, [Larsson 2005](https://doi.org/10.1016/j.neulet.2005.03.059), was not read):
- Persinger had recommended both the 15-min exposure and the 9000 cycles.
- The chamber was about 2 m², and blindfolds were used.
- The equipment was checked for field output before and after the study.
- Persinger had never communicated a pre-subject verification protocol.

**Later versions.** Persinger later wrote that the signals ran "at too high a velocity" for "only ten minutes instead of the twenty" ([Persinger 2015](https://sacredneurology.com/2015/06/08/our-results-cant-be-attributed-to-suggestion-a-blog-by-dr-michael-persinger/)). Both labs' records say 15 + 15 min.

Each side's version of the timing and duration dispute is backed only by its own records. It remains open.

### French et al. 2009 ("The Haunt Project")

| Parameter | Value |
|---|---|
| Room | Circular white canvas chamber, about 3 m across and 4 m high, about 18 °C and 1 lux; participants walked for 50 min |
| Field | Two coils hidden behind the wall (100 turns, 1200 mm; 200 turns, 800 mm). Persinger's burst pattern was tabulated from a published graph and played as a 16-bit WAV at 1000 Hz. Peak under 50,000 nT, concentrated in one quadrant. |
| Infrasound | 18.9 Hz + 22.3 Hz sines at 75 dB; nobody in a 15-person pilot heard it below 75 dB |
| Design | 2 × 2, N = 79; participants did not know their condition, but the experimenters did |

- **Results.** Neither field nor infrasound mattered. The test of the field quadrant was null (t(40) = .85). The temporal-lobe-signs score was the only significant predictor of reported experiences ([French 2009](https://research.gold.ac.uk/id/eprint/4209/2/French_et_al_Haunt_accepted.pdf)).
- **Blinding.** The authors state that "practical limitations precluded the use of double-blind methodology".
- **Persinger's objection.** He criticised the point durations and the sound-file approach ([Persinger 2015](https://sacredneurology.com/2015/05/31/the-tectonic-strain-theory-and-the-haunted-room-a-blog-by-dr-michael-persinger/)).

### Gendle & McGrath 2012

- **Design.** 37 participants received 30 min of the 8 Coil Shakti "amygdala signal" or sham, then rated 54 colour photographs. There was no field effect and no interaction with the photographs' emotional valence ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)).
- **Murphy's reply** ([Murphy: reply to Gendle & McGrath](http://www.innerworlds.50megs.com/Gendle_Shakti/8-Coil-Shakti-Gendle-&-McGrath.htm)). He says the study used the wrong session:
  - bilateral amygdala signals have "little, if any, effect" when used once;
  - the mood session he recommends ("Feelgood") goes over the frontal lobes, once a week for six weeks.

  He also reports a field of up to 1 µT, daytime sessions and an onboard sound card. These are vendor arguments; the paper itself was not read.

### Tinoco & Ortiz 2014

This is the only rebuild by a group unconnected to Persinger's lab. It is a partial replication in a non-indexed journal ([Tinoco & Ortiz 2014](https://www.jcer.com/index.php/jcj/article/viewFile/361/386)).
- **Hardware.** 8 coils (500 turns of 26 AWG on ferrite rods), four per side in a cross over the temporal lobes.
- **Signal.** A decade counter switched simple 100 Hz pulses from coil to coil every 250 ms in a figure-eight, with left and right coils yoked. 20 min.
- **Setting.** Blindfold only, with no Faraday cage or acoustic chamber. Subjects were deliberately told it was a "God Helmet".
- **Field strength.** The paper gives three incompatible values: 0.0001 T and 1 µT, both labelled "10 mG", and 0.001 µT from a measured current. It cannot be copied.
- **Results.** Nothing differed during sessions. Affective word statistics of post-session reports differed in part of the analysis, at p < .10.
- **What it tests.** It is not a test of any Persinger waveform.

### Sham-helmet studies

| Study | What was done | Finding |
|---|---|---|
| [Andersen 2014](https://doi.org/10.1163/15700682-12341323) | A placebo helmet with a cover story; no field. Its first author later wrote that the helmet "was in actuality unable to induce any such experience" ([Andersen 2017](https://doi.org/10.1080/2153599X.2017.1387170)). | Reported experiences increased with time worn ([Maij 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf)); the study is often cited as if a real field were used |
| [Simmonds-Moore 2019](https://doi.org/10.1177/0276236617749185) | 32 sceptics and 35 believers; baseline, sham morning and sham afternoon; 30 min in a Faraday chamber | Believers reported more exceptional experiences; conditions did not change consciousness scores. Morning vs afternoon cannot test Murphy's "after dark" advice. |
| [Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/) | Placebo stimulation; expectancy manipulated within subjects | Expectancy changed extraordinary experiences; absorption predicted their frequency and intensity; no rise in agency detection |
| [Maij, van Elk & Schjoedt 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf) | Preregistered, N = 193 festival visitors; a metallic skate helmet wired to a dummy box with a flickering light; eyeshade and white noise; 15 min | Spirituality predicted experiences; alcohol did not raise them |
| [van Elk 2019](https://doi.org/10.1080/10508619.2019.1687189) | Editorial on a student sham-helmet project | The original data had been fabricated; follow-up studies failed because participants did not believe the cover story |

Sham details that build credibility (screening questions, sham physiological leads, an instruction video) are listed in [Maij 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf). They are relevant to blinding.

### What has not been done

- **No new field test.** We found no independent, preregistered, double-blind test of the *field* published between 2015 and 2026. Searches of Europe PMC, Crossref and the citations of Granqvist 2005 turned up sham studies, reviews and theory only ([Europe PMC search](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%28ABSTRACT%3A%22sensed%20presence%22%20OR%20ABSTRACT%3A%22god%20helmet%22%29%20AND%20PUB_YEAR%3A%5B2015%20TO%202026%5D&format=json)). The search is necessarily incomplete.
- **The decisive experiment.** Granqvist's blinding with Persinger's parameters:
  - verified point timing on calibrated hardware;
  - 30–40 min per pattern;
  - a blindfold in a quiet chamber;
  - the field checked before each subject.

  The primary endpoint would be the sensed-presence score, where Persinger predicted at least 0.8 against 0.3 for sham. This build's hardware-timed 2 kHz engine can provide the timing.
- **Sensory cues.** We found no published measurement of sound, vibration or warmth from these coils; the search is necessarily incomplete. The lab insisted on a "completely silent" chamber ([Persinger & Murphy: the God experience](https://www.god-helmet.com/wp/god-helmet/experimental-stimulation-of-the-god-experience.htm)), and Murphy warns that sound-card hiss reaches the coils ([Murphy: distortion](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/distortion.htm)). Check your own helmet for audible cues before trusting a blind (unverified risk; [EXPERIMENTS.md](EXPERIMENTS.md)).

---

## Todd Murphy's Shakti and Shiva

Murphy sells consumer descendants of the lab devices. Almost every session-specific statement below is a vendor claim supported by testimonials.

### Devices and signals

- **Origin.** Murphy received Persinger's DAC hardware in 1998 ([McTaggart interview 2006](https://www.youtube.com/watch?v=K-0PHkfvEhg)).
- **Signal ownership.** The signal templates are "licensed by Dr. M.A. Persinger and Stan Koren", and the signals are copyrighted by Murphy ([Murphy: About Shiva](https://www.god-helmet.com/wp/shiva/shiva_demo/about_shiva.htm)). The waveforms are not published, so every DIY version is an approximation.
- **Endorsement.** In 2015 Persinger wrote that the Shiva God Helmet is a "faithful reproduction of our laboratory apparatuses" and the Shakti "a viable alternative" ([Persinger 2015 letter](https://www.god-helmet.com/wp/god-helmet/persinger_endorsement_of_shiva_god_helmet.pdf)). This is an endorsement, not a validation.
- **Signal families.** "Amygdala" burst-firing, standard and slow hippocampal signals, a "modulated 40 Hz chirp", caudate and Fibonacci signals ([Murphy: Limbic Workout](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/descending_lability_batch_consent.htm)), a "modulated 40 Hz" signal ([Murphy: modulated 40 Hz](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/obe45_consent.htm)) and theta-band noise ([Murphy: theta-band output](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/5jut4ranconsent.htm)).
- **Timing.** Standard signals have 3-ms points and about 4 s of silence between bursts. "Rapid" versions drop the silence; "high-speed" versions also use 1-ms points ([Murphy: rapid and high-speed signals](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rapid_&_high_speed_signals.htm)).
- **Intensity.** The vendor's statements disagree: 10–20 mG ([Murphy: formal discussion](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/mono_proposal.htm)), a 50 mG or 90 mG "laboratory standard", and others ([Murphy: overcoming duds](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/duds.htm); [Murphy: setting the volume](https://www.god-helmet.com/wp/winshakti/volume.htm)). No independent measurement of a Shakti or Shiva unit was found.
- **8 Coil Shakti.** A 4-coil cross on each temporal lobe. One stereo channel drives the top and bottom coils, the other the front and back, each pair with one + and one − coil. "Fast" mode switches channels twice a second ([Murphy: getting started](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/getting_started_basic.htm); [Murphy: 8 Coil Shakti principles](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rot_principles.htm)).
- **Shiva.** Eight coil pairs evenly around the head, with "no coils above the nose", none over the occipital ridge and none directly above the ears ([Murphy: coil locations](https://www.god-helmet.com/wp/shiva/shiva_demo/locations.htm)). The first coil is over the left frontal area and the rotation is counter-clockwise ([Murphy: Shiva safety](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_safety.htm)).
- **Shiva timing.** It is described only loosely, and the statements disagree:
  - in a lecture, 10, 12, 14 … 20 ms per coil ([Murphy lecture](https://www.youtube.com/watch?v=tmC1174POpA));
  - on the site, "usually around 9 times per second" ([Murphy: Shiva basic explanation](https://www.god-helmet.com/wp/shiva/shiva_demo/understanding_shiva_neural.htm)).

  The real Shiva tables are unpublished.

The project's Layout A ring differs from both the lab Octopus and Shiva; see [PLACEMENT.md](PLACEMENT.md).

### Sessions and schedules (claims)

| Session | Structure | Source |
|---|---|---|
| God Helmet, classic | Chirp over the right temporal lobe, then an abrupt switch to the amygdala signal over both sides; 30 + 30 or 20 + 20 min. Phase 1 is "somewhat unpleasant for many people", so a helper can skip it. Seven gentler variants end on the left amygdala or right hippocampus. | [Murphy: God Helmet 2-stage session](https://www.god-helmet.com/wp/god-helmet/god_helm_1_mod40c_r_2_bx_bi.htm); [session list](https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm) |
| Shiva "Persinger Session" | Seven chirp applications with silences, counter-clockwise, about 43 min; weekly | [Murphy: Shiva lab sessions](https://www.god-helmet.com/wp/shiva/shiva_demo/experiment_signals.htm) |
| Shiva "Published Studies" | Six phases: three amygdala, then three chirp, with quiet intervals. Murphy presents it as the configuration set of the Octopus psi papers; it appears to mirror the three burst-firing and three Thomas configurations of the Swann paper, with his chirp in place of the Thomas pattern (our inference). | [Murphy: Shiva lab sessions](https://www.god-helmet.com/wp/shiva/shiva_demo/experiment_signals.htm); [Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/) |
| Feelgood (mood) | Amygdala and hippocampal signals in sequence with 4-s gaps, over the temporal lobes and then the frontal lobes; six sessions, then a 3-week break | [Murphy: mood enhancement](https://www.god-helmet.com/wp/winshakti/rotating/shakti_happiness.htm) |
| Limbic Workout | Seven signals × 5 min with 90-s gaps (13 phases, about 45 min), both sides only | [Murphy: Limbic Workout](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/descending_lability_batch_consent.htm) |
| Lucid dreaming | Five weekly temporal sessions, then one frontal session on the target night | [Murphy: lucid dreaming](https://www.god-helmet.com/wp/winshakti/rotating/lucid_dream.htm) |
| OBE | 30 min over the right hemisphere or right angular gyrus; most OBEs reportedly came while falling asleep about an hour later | [Murphy: OBE](https://www.god-helmet.com/wp/winshakti/rotating/shakti_obe.htm) |
| "Double session" | The same session repeated after 90 min; Murphy says one lab trial gave an EEG response "three times more robust" | [Murphy & Balbin interview 2018](https://www.youtube.com/watch?v=1uVjHmi51HM) |

**Schedule rules** ([Murphy: how often](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/how_often_is_safe.htm); [Murphy: breaks](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/break.htm); [Murphy: God Helmet schedule](https://www.god-helmet.com/wp/god-helmet/koren_schedule.htm)):
- never on consecutive days;
- every 72 h or weekly;
- series of 3 or 6, then a 21-day break;
- a 3-month break after about a year.

**Setting rules** ([Murphy: set and setting](https://www.god-helmet.com/wp/god-helmet/koren_set_setting.htm); [Murphy: during sessions](https://www.god-helmet.com/wp/god-helmet/koren_during_sessions.htm)):
- "silence, not just quiet" and darkness for effects during a session;
- night sessions (the lab's ran mostly between midnight and 4 am);
- no meditation or other devices during a session.

**Geomagnetic advice.** Quiet conditions (K 0–2) for perceptions during a session; K 4 for skill training, with practice a few days later ([Murphy: Shiva and the Earth's field](https://www.god-helmet.com/wp/shiva/shiva_geomagnetic.htm)). The lab correlations behind this point in different directions ([Booth 2005](https://pubmed.ncbi.nlm.nih.gov/16051550/); [Persinger, Cook & Tiller 2002](https://pubmed.ncbi.nlm.nih.gov/12434847/)).

### Evidence for the consumer devices

- **Within the lab.** Persinger's own comparison of the Shakti with the 4-solenoid "Koren boxes" (n = 12, 4 weekly sessions) found no differences in any EEG band except a session × treatment interaction in high alpha ([Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15527205/)). It is often cited as "Shakti changes EEG"; the result is narrower.
- **Independent test.** The one independent test of the 8 Coil Shakti was null ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)).
- **Murphy's own admission.** His site says the sensed presence "is less frequent" with the Shiva system in its God Helmet configuration than in the lab, and credits the lab's "rigorous conditions" ([Murphy: God Helmet](https://www.god-helmet.com/wp/god-helmet/index.htm)). In a 2018 interview he blames the lack of true silence at home ([Murphy & Balbin interview 2018](https://www.youtube.com/watch?v=1uVjHmi51HM)).
- **Swiss report.** It describes 400 Shiva sessions with over 100 people and gives no data, methods or controls ([DeepFocus report](https://www.god-helmet.com/wp/shiva/deepfocus_report_english.htm)). Anecdote.
- **Visions of Christ.** In an e-mail quoted by Murphy, Persinger wrote that "about 20 or so people (out of approximately 2000)" had reported feeling the presence of Christ or seeing him ([Murphy: intro to the God Helmet](https://www.god-helmet.com/wp/god-helmet/intro_to_god_helmet.htm)). Anecdote, second-hand.
- **Left/right rules.** Murphy's rules (hippocampal signal on the right, amygdala signal on the left) go back to two small lab studies ([Persinger, Richards & Koren 1994](https://pubmed.ncbi.nlm.nih.gov/7744561/); [Richards 1992](https://pubmed.ncbi.nlm.nih.gov/1408634/)). The broader lateralisation claims come from user reports.

---

## Mainstream low-field science

Methods outside Persinger's lineage that use weak or moderate magnetic fields, with their evidence.

The last column compares each method's field with this helmet at full current (about 8 µT at 20 mm and 1 µT at 45 mm). It is *derived*; at the default 1 µT setting the ratios are about 8× larger.

| Method | What it is | Field or E at the brain | Evidence | vs this helmet |
|---|---|---|---|---|
| **LFMS** (McLean Hospital) | 500 Hz alternating 1-ms pulses in 0.5-s trains every 2 s, 20 min, head in an open coil | under 5 mT; peak E about 0.5 V/m ([Fava 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/)) | Positive only in combined secondary analyses ([Rohan 2014](https://pubmed.ncbi.nlm.nih.gov/24331545/), n = 63); null multisite trial ([Fava 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/), n = 84); meta-analysis of 9 RCTs, SMD −0.61, low certainty ([Bharadwaj 2026](https://pubmed.ncbi.nlm.nih.gov/41911470/)) | up to ~600× |
| **T-PEMF** (Re5 device, Denmark) | Seven in-phase coils over temporal, parietal and occipital lobes; bipolar pulses at about 50–55 Hz; 30 min daily | about 0.3 mT and 0.01 V/m averaged over cortex ([Tang 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13103953/)) | Positive sham RCT from the originating group ([Martiny 2010](https://pubmed.ncbi.nlm.nih.gov/20385376/), n = 50); independent sham RCT null ([van Belkum 2021](https://pubmed.ncbi.nlm.nih.gov/34333176/), n = 55) | ~40× |
| **Cnp** (Lawson; Thomas and Prato) | The decelerating pulse train of [US patent 6,234,953](https://patents.google.com/patent/US6234953B1/en), which lists Persinger as co-inventor, so it is not independent of his work | 400 µT at the headset, ±200 µT at the head surface, ±35 µT deep ([Thomas 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/)) | Small single-lab studies; the main RCT was "essentially a negative study" ([Thomas 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/)) | ~35× at depth |
| **Low-intensity rTMS** (rodents) | mT-strength rTMS patterns | about 8–13 mT at target in key studies ([Dufor 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6821463/); [Seewoo 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5928106/)); review range 1–150 mT ([Moretti & Rodger 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9846462/)) | Pattern-dependent effects from two allied labs; circuit repair needed cryptochrome, a candidate magnetoreceptor ([Dufor 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6821463/)) | ~1,000× or more |
| **tSMS** (static magnet) | NdFeB magnet over motor cortex, 10–30 min | 110–190 mT at 2–3 cm ([Kirimoto 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5048290/)) | Up to 25 % smaller motor responses ([Oliviero 2011](https://pubmed.ncbi.nlm.nih.gov/21807616/)); three null replications by one group, the latest n = 38 ([Lorenz 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12992518/)) | >10,000× (static) |
| **sTMS** (NeoSync) | Three rotating magnets at the individual alpha frequency | about 0.64 T at the magnet surface ([NCT03288714 protocol](https://cdn.clinicaltrials.gov/large-docs/14/NCT03288714/Prot_000.pdf)) | Pivotal RCT null by intention to treat (n = 202), positive per protocol (n = 120); sponsor-linked ([Leuchter 2015](https://pubmed.ncbi.nlm.nih.gov/26143022/)) | – |
| **ELF fields and resting EEG** | Pulsed or 50–60 Hz fields over the head | 40–200 µT; 1,800 µT | Alpha up after exposure ([Cook 2004](https://pubmed.ncbi.nlm.nih.gov/15042628/)) but down during it ([Cook 2005](https://pubmed.ncbi.nlm.nih.gov/15887255/)); nearly doubled at 80 µT ([Ghione 2005](https://pubmed.ncbi.nlm.nih.gov/15911132/)); no EEG effect at 1,800 µT ([Legros 2012](https://pubmed.ncbi.nlm.nih.gov/21894451/)) | 5–225× |
| **ELF epochs** (Bell and Marino) | 2-s epochs at 1.5 and 10 Hz | 20–40 µT | EEG changes at the stimulus frequency, one lab ([Bell 1994](https://pubmed.ncbi.nlm.nih.gov/8064317/)) | 2.5–5× (the closest match) |
| **Geomagnetic rotation** (Caltech) | An Earth-strength field rotated within 100 ms | about 35 µT | Alpha suppression, only for Northern-Hemisphere field geometry; no independent replication found ([Wang 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494972/)) | ~4× |
| **Picotesla stimulation** | pT fields | pT | A blinded MEG test favoured the null about 2000:1 ([Troebinger 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC5390956/)) | far weaker |
| **"Schumann" devices** | 7.83 Hz fields, after the natural resonance (about 1 pT) | not reported | The one RCT of a sleep device found no between-group difference in sleep recordings ([Huang 2022](https://pubmed.ncbi.nlm.nih.gov/35707548/)) | helmet far stronger |
| **40 Hz GENUS** | Light flicker and tones, 1 h a day: sensory, not magnetic | – | Mouse amyloid effects ([Iaccarino 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5656389/)) were contested ([Soula 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10839995/)); cognitive benefit in humans not established ([Ang 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12700959/)) | not comparable |
| **Theta-burst TMS** | 50 Hz triplets at 5 Hz | TMS strength | established at TMS intensity: iTBS was non-inferior to 10 Hz rTMS for depression (n = 414) ([Blumberger 2018](https://pubmed.ncbi.nlm.nih.gov/29726344/)) | ~10⁵× |
| **Alpha tACS** | Electrical stimulation at the alpha frequency | like tES, about 0.8 V/m at 2 mA ([Huang 2017](https://pubmed.ncbi.nlm.nih.gov/28169833/)) | Raises alpha, with after-effects up to about 70 min ([Kasten 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4879138/)) | E ~10⁵–10⁶× |

What the build can and cannot do here:
- It can play the *timing* of all of these, to the engine's 0.5-ms resolution: the **lowfield** programs and the table generators in [PRESET_FORMAT.md](PRESET_FORMAT.md).
- It cannot reproduce their strength.
- These programs are pattern replicas for blinded self-tests, not replicas of tested treatments.

---

## Psi research

### Ganzfeld

| Analysis | Studies | Result | Caveats |
|---|---|---|---|
| Honorton 1985, in [Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf) | 28 | 23 of 28 positive; Stouffer z = 6.60 | Hyman and Honorton agreed the effect was not explained by selective reporting, then set stricter standards |
| PRL autoganzfeld 1983–89 ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)) | 11 | 106 hits in 329 sessions (32 % vs 25 % chance) | Target-frequency and position biases, and prompting during judging ([Hyman 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%237%20179/Part0001/CIA-RDP96-00789R003200100001-5.TXT)); possible acoustic leakage from the sender's room ([Wiseman, Smith & Kornbrot](https://metabunk.org/attachments/auditory-leakage-autoganzfeld-pdf.60688)) |
| [Milton & Wiseman 1999](https://pubmed.ncbi.nlm.nih.gov/10414223/) | 30 | Not significant (ES 0.013) | A larger database later gave ES 0.138 ([Storm & Ertel 2001](https://drmc.library.adelaide.edu.au/dspace/handle/2440/3400?mode=full)) |
| [Storm, Tressoldi & Di Risio 2010](https://doi.org/10.1037/a0019457) | 29 | ES 0.142, z = 5.48 | The Bayes factor fell from about 6 billion to at most 330 after excluding manually randomised studies ([Rouder 2013](https://doi.org/10.1037/a0029008)) |
| [Bierman, Spottiswoode & Bijl 2016](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0153049) | 78 | Questionable research practices could explain about 60 % of the effect | A smaller effect (p = .003) remained |
| [Tressoldi & Storm 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11134153/) (registered report) | 78 | ES .074–.084, BF₁₀ = 89.5, about 6.8 points above chance | Large heterogeneity; median study power .088 |
| [Watt, KPU 1074](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1074_ResultsSummary.pdf) (preregistered, 240 selected participants) | 1 | 72/240 = 30 %, one-tailed p = .043 | The best-controlled recent study |

Preregistration matters:
- In the Koestler Unit registry, 16 % of preregistered confirmatory hypotheses were supported, against 46.6 % in non-registered papers of the same period ([Wiseman & Watt 2026](https://doi.org/10.7717/peerj.21360)).
- An earlier registered-report policy gave 8.4 % against 28.4 % ([Wiseman, Watt & Kornbrot 2019](https://doi.org/10.7717/peerj.6232)).

### Remote viewing and ARV

- **Laboratory results.** Effect sizes of .209 for SRI (770 trials) and .230 for SAIC (455 trials) were reported ([Utts 1995](https://www.ics.uci.edu/~jutts/air)).
- **Hyman's criticism.** One person was the sole judge of all free-response experiments, and the same viewers and targets were used throughout ([Hyman 1995](https://www.ics.uci.edu/~jutts/hyman.html)).
- **The AIR evaluation** ([AIR 1995](https://nsarchive2.gwu.edu/NSAEBB/NSAEBB438/docs/doc_57.pdf)):
  - the laboratory effect could not be separated from judge, target and method effects;
  - operational remote viewing "failed to produce actionable intelligence";
  - the programme was closed. [HISTORY.md](HISTORY.md) has the programme history.
- **Target pools.**
  - At SAIC, static photographs scored ES .248 and dynamic video clips 0; a sender made no difference ([Lantz, Luke & May 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100002-4.TXT)).
  - Viewing quality correlated with the target's entropy gradient (r = .337). The authors' own checks weakened it: after re-digitising, the 1992 static correlation fell from .452 to .298 (not significant), and the 1993 static-only correlation was negative ([May, Spottiswoode & James 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100004-2.TXT)).
- **Judging cues.** Transcripts of the first SRI series carried cues a judge could use to match them ([Marks & Kammann 1978](https://www.nature.com/articles/274680a0)).
- **Preregistered test.** 44 experienced viewers picked the correct target in 10 of 44 cases (23 %, chance 25 %) ([Lyke, KPU 1055](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1055_Results.pdf)).
- **Associative remote viewing (ARV).**
  - Small positive series were not judged blind; the tasker or monitor who knew the target photos took part in judging: 7 of 7 ([Smith, Laham & Moddel](https://www.colorado.edu/faculty/moddel/sites/default/files/attached-files/smith_sse10_abstract.pdf)); 38 of 48 ([Müller 2019](https://www.anomalistik.de/images/pdf/zfa/zfa2019_3_326_mueller-mueller-wittmann.pdf)).
  - When 86 trials were re-judged by 9 new judges, all agreed on only 6.9 % of trials, and new judges averaged 51.5 % hits against 65 % for the originals ([Katz 2021](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1034_Published_Results.pdf)).

### Dream ESP, presentiment, precognition and the GCP

- **Dream ESP.** 50 studies gave ES .20; the Maimonides studies .33 and the others .14 (difference not significant), declining over time ([Storm 2017](https://journals.ub.uni-heidelberg.de/index.php/IJoDR/article/view/34888)).
- **Presentiment.**
  - 26 studies gave ES .21 ([Mossbridge 2012](https://www.frontiersin.org/articles/10.3389/fpsyg.2012.00390/full)).
  - Critics pointed to expectation, baseline-correction and quality problems ([Schwarzkopf 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4034337/)).
  - A preregistered confirmatory test (N = 328) was null ([Mossbridge, KPU 1018](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/Study_Results_1018.pdf)).
- **Precognition.**
  - [Bem 2011](https://doi.org/10.1037/a0021524) reported ES .22 across 9 experiments.
  - A default Bayesian re-analysis found the evidence "weak to nonexistent" ([Wagenmakers 2011](https://doi.org/10.1037/a0022790)).
  - The consensus-designed Transparent Psi Project (2,115 participants, 37,836 trials) found 49.89 % hits and did not replicate it ([Kekecs 2023](https://doi.org/10.1098/rsos.191375)).
- **Global Consciousness Project.** It claims a cumulative deviation above 7 sigma. Its own analyst concluded the data favour a goal-oriented effect tied to individuals, not "global consciousness" ([Bancel 2017](https://doi.org/10.1016/j.explore.2016.12.003)).
- **The debate.** It is unresolved in mainstream psychology ([Cardeña 2018](https://doi.org/10.1037/amp0000236); [Reber & Alcock 2020](https://doi.org/10.1037/amp0000486)).

### Geomagnetic and sidereal-time claims

- **Geomagnetic activity.** Persinger and Krippner (1989) reported that the Maimonides dream sessions scored best on geomagnetically quiet nights, near 10 nT, and poorly above 25 nT ([Psi Encyclopedia: Persinger](https://psi-encyclopedia.spr.ac.uk/articles/michael-persinger)). We saw this only in secondary sources (unverified).
- **Sidereal time.**
  - Spottiswoode reported that in 1,468 free-response trials the effect size was 340 % higher within 1 h of 13.5 h local sidereal time (LST), p ≈ .001. An independent set of 1,015 trials gave +450 % (p ≈ .05). The window was found post hoc (Spottiswoode 1997, "Apparent association between effect size in free response anomalous cognition experiments and local sidereal time", *Journal of Scientific Exploration* 11(2)).
  - A separate Spottiswoode paper on 2,879 trials found a negative link between effect size and the geomagnetic ap index only inside about 11.9–13.9 h LST ("Geomagnetic fluctuations and free response anomalous cognition: a new understanding").
  - We found no independent replication of either result. Single-lab.
- **In the app.** Kp, ap and LST are logged as exploratory variables only. Do not choose session times by them ([EXPERIMENTS.md](EXPERIMENTS.md)).

### Persinger-lab psi claims

The Swann, sibling, shared-memory, yoked-ring, photon and toroid studies are in the circumcerebral table above. All are single-lab, with one subject or 2 to 15 pairs. None has an independent replication.

The lab also reported that a psychic's EEG showed right parahippocampal 20–30 Hz activity during readings ([Persinger & Saroka 2012](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3410194/fullTextXML)). This is a single subject.

### Who reports experiences, and who scores

Trait measures predict reported experiences under real and sham conditions alike:
- **Absorption.** It predicted reports in Granqvist's study ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)) and under a sham helmet ([Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/)). Across religious, psychedelic and paranormal settings the correlations are modest, about r = .2–.6 ([Lifshitz, van Elk & Luhrmann 2019](https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf)).
- **Transliminality.** Transliminality, Persinger's temporal-lobe lability, unusual-experience schizotypy and thin boundaries load on one factor (74.6 % of variance, N = 1,368), so collect one of them, not all ([Thalbourne & Maltby 2008](https://ernesthartmann.com/files/transliminality_thin-boundaries_unusual-experience.pdf)).
- **Item overlap.** Some trait scales contain a sensed-presence item; drop it when presence is the outcome ([Lifshitz 2019](https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf); [Irving 2024](https://strathprints.strath.ac.uk/87921/1/Irving-etal-AP-2024-The-relationship-between-transliminality-hypnotic-and-imaginative-suggestibility.pdf)).
- **Demand characteristics.** Trait "phenomenological control" (hypnotisability) predicts reports in body-illusion experiments ([Lush 2020](https://doi.org/10.1038/s41467-020-18591-6)).
- **Psi moderators (claims, because psi itself is disputed).**
  - Believers outscore disbelievers by a tiny margin ([Psi Encyclopedia: sheep-goat effect](https://psi-encyclopedia.spr.ac.uk/articles/sheep-goat-effect/)).
  - Selected participants did better in the ganzfeld ([Tressoldi & Storm 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11134153/)).
  - Experimenter effects are reported but inconsistent ([Schlitz 2006](https://europepmc.org/abstract/MED/16848945)).

Design consequences:
- **The informative test is real vs sham, and trait × condition.** A trait main effect is not evidence of a field effect.
- **Measure traits at enrolment, days before the first session.** Questionnaires given just before a session can prime it ([Granqvist & Larsson 2006](https://pubmed.ncbi.nlm.nih.gov/16967739/)).
- **Ask for a guess of the condition** and compute a blinding index ([Bang 2004](https://europepmc.org/abstract/MED/15020033)).

[QUESTIONNAIRES.md](QUESTIONNAIRES.md) lists the instruments the app includes.

### Trials needed

Computed with exact binomial tests, one-tailed α = .05, power .80 ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf); [KPU 1024](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_Registry_1024.pdf)):

| Design | True hit rate vs chance | Trials needed |
|---|---|---|
| 4-choice (ganzfeld style) | 30 % vs 25 % | 522 |
| 4-choice | 33 % vs 25 % | 217 |
| 4-choice | 40 % vs 25 % | 68 |
| Binary (ARV) | 60 % vs 50 % | 169 |
| 5-choice remote viewing | 30 % vs 20 % | 127 |

A personal series of 20–30 trials can only detect very large effects. See [EXPERIMENTS.md](EXPERIMENTS.md) for the app's statistics.

---

## States → brain regions → programs

The programs below are in the **Programs** tab; the **Placement** tab shows where the coils go and the **Brain** tab how much field reaches each target.
- *Claim* = Persinger's lab, Murphy or the vendor; *mainstream* = independent neuroscience.
- The evidence column rates the original protocol, not this helmet.
- The table lists the main programs per state; the **Programs** tab has the full library ([PRESET_FORMAT.md](PRESET_FORMAT.md)).

| Target | Brain region | Programs | Evidence | Notes |
|---|---|---|---|---|
| **God Helmet classic** (presence, then bliss) | Claim: right hemisphere first, then both amygdalae ([McTaggart interview 2006](https://www.youtube.com/watch?v=K-0PHkfvEhg)) | `god-helmet-classic` (Murphy's Shiva version: 30 min chirp on the right temporal cross, then 30 min amygdala burst-firing on both). Lab versions: `persinger-saroka-2015-sensed-presence`, `persinger-granqvist-2005-replication` | single-lab; the independent test was null | Phase 1 can frighten; **Skip** jumps to phase 2. Dark, silent room, blindfold. |
| **Sensed presence** | Claim: right or bilateral temporoparietal ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)). Mainstream: electrical stimulation of the left temporoparietal junction gave a "shadow person" ([Arzy 2006](https://doi.org/10.1038/443287a)); delayed self-touch by a robot evokes a presence in healthy people ([Blanke 2014](https://doi.org/10.1016/j.cub.2014.09.049)) | `presence-right`, `presence-left`, `persinger-tiller-2002-thomas-right` | single-lab | Compare right, left and sham in blinded, counterbalanced order. |
| **Out-of-body** | Mainstream: right angular gyrus / temporoparietal junction, by electrode stimulation in one patient ([Blanke 2002](https://doi.org/10.1038/419269a)); visuo-tactile conflict in healthy people ([Lenggenhager 2007](https://doi.org/10.1126/science.1143439); [Ehrsson 2007](https://doi.org/10.1126/science.1142175)). Claim: right hemisphere ([Murphy: OBE](https://www.god-helmet.com/wp/winshakti/rotating/shakti_obe.htm)) | `obe` (two coils, in front of and below the right ear and over the right angular gyrus; modulated 40 Hz, 30 min); `murphy-shiva64-obe-lab` | anecdote | Murphy: sleep about an hour later. |
| **Remote viewing** | Claim: Swann's accuracy tracked occipital 7 Hz ([Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/)); Murphy: right hemisphere | `remote-viewing` (ring, counter-clockwise chirp, 10 → 20 ms per coil, 30 min), `persinger-swann-2002-table1`, `murphy-shiva-persinger-session`; then a blinded trial in the **Experiment** tab | claim / single-lab (one subject) | Kp and LST are logged, never used to schedule sessions. |
| **Telepathy** | Claim: a shared field raised 5–6 Hz power in the unstimulated partner ([Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/)) | `telepathy-sender` (six 5-min counter-clockwise configurations), `persinger-siblings-2003-stimulus`, `persinger-yoked-2010-microstate` | single-lab | The sender wears the helmet; the receiver writes impressions in another room ([EXPERIMENTS.md](EXPERIMENTS.md)). |
| **Meditation preparation** | Claim: temporal lobes ([Murphy: meditation](https://www.god-helmet.com/wp/winshakti/rotating/shakti_meditation.htm)) | `meditation-prep` (amygdala and hippocampal signals in sequence, both sides, 30 min) | anecdote | Meditate 1–2 h afterwards, not during. |
| **Mood** | Claim: temporal, then frontal ([Murphy: mood enhancement](https://www.god-helmet.com/wp/winshakti/rotating/shakti_happiness.htm)). Lab: weekly burst-firing after head injury ([Baker-Price 2003](https://pubmed.ncbi.nlm.nih.gov/12831278/)) | `frontal`, `murphy-shakti8-feelgood-2phase-40min`, `persinger-tbi-depression-temporal` | claim / single-lab | The independent Shakti test was null ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)). |
| **Lucid dreaming** | Claim: frontal lobes ([Murphy: lucid dreaming](https://www.god-helmet.com/wp/winshakti/rotating/lucid_dream.htm)). Mainstream: no technique is reliably effective ([Stumbrys 2012](https://doi.org/10.1016/j.concog.2012.07.003)); waking after 5 h plus a mnemonic technique raised lucid nights from 5.3 % to 15.8 % ([Aspy 2020](https://www.frontiersin.org/articles/10.3389/fpsyg.2020.01746/full)) | Five weekly `meditation-prep` sessions, then `frontal` on the target night; `murphy-shakti-lucid-dream-series-*` | anecdote | |
| **Love / agape** | Claim: left amygdala ([Murphy lecture V1](https://youtu.be/zqrpKUTMXgY?t=714)) | `love-agape` (amygdala signal on the left cross, 30 min) | anecdote | Murphy reports bliss when he moved the amygdala signal to the left side only. |
| **Circumcerebral EEG studies** | Claim: theta and gamma power changes ([Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/); [Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/)) | `circumcerebral-theta` (100 → 240 ms, +20 ms per coil), `circumcerebral-gamma` (25 → 11 ms), `persinger-cook-1999-time-ccw` / `-cw`, `persinger-booth-2008-cw-ccw` | single-lab | Testing the EEG claims needs EEG. |
| **8 Coil Shakti style** | Claim | `shakti-alternate` (crosses on both temporal lobes, coil pairs alternate every 0.5 s) | claim | |
| **Clinical low-field timing** | Mainstream methods with much stronger fields | `lowfield-*` | see the low-field table | Timing replicas only. |
| **Déjà vu, kundalini, chi, past lives** | Claim only (Murphy). Mainstream: déjà vu is evoked mainly by electrical stimulation of the entorhinal cortex ([Bartolomei 2004](https://pubmed.ncbi.nlm.nih.gov/15365137/)) | No protocol in any source | – | Anatomy only. |
| **Sham** | – | `sham`, or tick **Blind** on any program (50/50 hardware random choice) | – | The only way to know whether *your* experiences depend on the field. |

### What produces these experiences without fields

- The mainstream inductions of OBEs, presences and déjà vu cited here used one of two routes:
  - milliamp currents through electrodes on or in the brain ([Blanke 2002](https://doi.org/10.1038/419269a); [Arzy 2006](https://doi.org/10.1038/443287a); [Bartolomei 2004](https://pubmed.ncbi.nlm.nih.gov/15365137/));
  - sensorimotor conflict ([Blanke 2014](https://doi.org/10.1016/j.cub.2014.09.049); [Lenggenhager 2007](https://doi.org/10.1126/science.1143439)).
- Sensory deprivation alone reliably alters consciousness:
  - 25 min of multimodal ganzfeld lowered thalamus-to-visual-cortex coupling ([Schmidt 2020](https://doi.org/10.1038/s41598-020-75019-3));
  - 10 Hz "Ganzflicker" produced more simple hallucinations than ganzfeld ([Shenyan 2024](https://doi.org/10.1038/s41598-024-52372-1)).
- Binaural beats entrain brain rhythms inconsistently: 5 of 14 EEG studies supported it by the abstract's count, 6 by the results section's ([Ingendoh 2023](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023)). This matters for the audio layer of the **Guides** tab ([GUIDES.md](GUIDES.md)).
- Murphy's "left amygdala positive, right negative" rule comes mainly from user reports. The closest lab result is apprehension in women under right-sided burst-firing ([Richards 1992](https://pubmed.ncbi.nlm.nih.gov/1408634/)); the other study he draws on found right-sided LTP fields *more* pleasant ([Persinger, Richards & Koren 1994](https://pubmed.ncbi.nlm.nih.gov/7744561/)).

---

## Safety-relevant findings

[SAFETY.md](SAFETY.md) holds the rules and the built-in safeguards. The research behind them:

- **Murphy's own adverse event.** In 1998 he ran "too many sessions in too short a period of time" on Persinger's hardware and was a "basket case" for eight or ten days. He links this to childhood right-temporal epilepsy ([McTaggart interview 2006](https://www.youtube.com/watch?v=K-0PHkfvEhg), about 36 min).
- **Right-side-only stimulation** frightened some lab subjects, and some asked to stop, by Murphy's account ([Murphy lecture V1](https://youtu.be/zqrpKUTMXgY?t=1522); anecdote).
- **Seizures in rats.** In limbic-epileptic rats, severe seizures were most frequent with the Thomas pattern at 3-ms points ([Persinger & Belanger-Chellew 1999](https://pubmed.ncbi.nlm.nih.gov/10597585/)).
- **Prenatal exposure.** Exposure of rats to complex fields of 30–180 nT produced hippocampal cell anomalies ([St-Pierre & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002875/)).
- **Behaviour.** Fields were reported to raise aggression ([Gillis 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/)), hypnotic suggestibility ([Healey 1996](https://pubmed.ncbi.nlm.nih.gov/9003980/)) and the acceptance of false statements ([Ross 2008](https://pubmed.ncbi.nlm.nih.gov/19037785/)). All single-lab, but they contradict the vendor's blanket safety statements ([Murphy: Shiva safety](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_safety.htm)).
- **Epilepsy.** People with epilepsy, or on drugs that lower the seizure threshold, are likely more susceptible to induced fields ([WHO 2007](https://inchem.org/documents/ehc/ehc/ehc238.pdf)).
- **Vendor side-effect reports.** Headaches in about 2 % with hippocampal signals, and "snapback" irritability in under 10 % ([Murphy: consumer information](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_infomed_consent.htm); [Murphy: snapback](https://www.god-helmet.com/wp/winshakti/rotating/rot_snapback.htm)). No systematic adverse-event data exist.
- **Contraindications Murphy names.** A psychiatric diagnosis or psychiatric medication, migraine, epilepsy, a "damaged or compromised brain", and use with mind-altering drugs or other mind machines. Pacemakers and pregnancy are not mentioned ([Murphy: God Helmet safety](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm); claim).
- **Frequency.** No more than once a week, and a 21-day break after six sessions (same page). In an interview he gives habituation as the reason (lecture notes, I1).

---

## Military and intelligence context

Documentary history only. [HISTORY.md](HISTORY.md) has the full account.

- **Ingo Swann**, the subject of the 2002 Octopus remote-viewing study, took part in the government-funded SRI remote-viewing programme. A 1984 CIA programme review credits his participation in developing its training ([CIA 1984 review](https://www.cia.gov/readingroom/document/cia-rdp96-00787r000200090018-4)), and a 1978 memo records his visit to the Army's AMSAA ([CIA 1978 memo](https://www.cia.gov/readingroom/document/cia-rdp96-00788r001200240010-3)).
- **The AIR evaluation** concluded that operational remote viewing never produced actionable intelligence ([AIR 1995](https://nsarchive2.gwu.edu/NSAEBB/NSAEBB438/docs/doc_57.pdf)).
- **Persinger's 1995 paper** on "directly accessing every human brain" by electromagnetic induction is theory without data ([Persinger 1995](https://pubmed.ncbi.nlm.nih.gov/7567396/)).
- **Target masking.** Koren and Persinger reported that weak fields around a target photograph disrupted Swann's remote viewing ([Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12509207/)). It is a single-lab pilot.
- **Murphy's devices.** No document was found showing that any of them was used by a military or intelligence body.

---

## Lecture notes: Todd Murphy, *Spirituality and the Brain* (playlist PL6E2B4B0A4C8ACAEF)

V1–V6 and I1–I2 are labels used in this document and in the program sources, not the playlist order. Everything here is Murphy's account (claim or anecdote). The notes and timestamps come from the project's earlier lecture notes; the October 2026 fact-check did not re-watch the videos, so treat the timestamps as approximate (unverified).

| # | Lecture | Takeaways for this build |
|---|---|---|
| V1 | [Enlightenment, the Self and the Brain](https://youtu.be/zqrpKUTMXgY) | Left amygdala = positive and right = fear ([7:21](https://youtu.be/zqrpKUTMXgY?t=441)). God Helmet two phases: right first, then the amygdala signal on both sides gives bliss "in less than five seconds" ([26:58](https://youtu.be/zqrpKUTMXgY?t=1618)). Right hippocampus = wordless "void" and theta ([39:48](https://youtu.be/zqrpKUTMXgY?t=2388)). Experiences are easier in the early-morning hours as melatonin falls ([86:38](https://youtu.be/zqrpKUTMXgY?t=5198)). |
| V2 | [Déjà vu and other ways to use neuroscience for prayer and meditation](https://youtu.be/KJIAHHB8Btk) | Déjà vu / jamais vu = hippocampal coupling ([13:18](https://youtu.be/KJIAHHB8Btk?t=798)). Session length 20–30 min ([64:21](https://youtu.be/KJIAHHB8Btk?t=3861)). Shakti is ordinary stereo audio, one signal to both channels ([64:37](https://youtu.be/KJIAHHB8Btk?t=3877)). Mood-lift course ([66:24](https://youtu.be/KJIAHHB8Btk?t=3984)). Lucid-dream course ([69:31](https://youtu.be/KJIAHHB8Btk?t=4171)). Altered states = bilateral, then right ([71:11](https://youtu.be/KJIAHHB8Btk?t=4271)). |
| V3 | [The Sacred Body: kundalini, subtle bodies, chi](https://youtu.be/R8GIKT8TY1k) | Chakra ↔ limbic pairs, e.g. third eye = right hippocampus + right caudate ([32:05](https://youtu.be/R8GIKT8TY1k?t=1925), [43:34](https://youtu.be/R8GIKT8TY1k?t=2614)). Chi / motion sense = right hippocampus + right occipito-temporo-parietal ([54:09](https://youtu.be/R8GIKT8TY1k?t=3249)). No stimulation protocols. |
| V4 | [Reincarnation in human evolution](https://youtu.be/y2uZkPzJrZc) | Nearly every NDE feature has been triggered by temporal-lobe stimulation ([37:25](https://youtu.be/y2uZkPzJrZc?t=2245)). OBE-like experiences correlate with high geomagnetic activity in people with many temporal-lobe signs ([72:50](https://youtu.be/y2uZkPzJrZc?t=4370)). Reincarnation claims are, in his words, "in theory". |
| V5 | [God and the Brain: the Persinger God Helmet](https://youtu.be/Eid6fiAj8WY) | First lecture of the series. The transcript could not be fetched; its content is covered by the God Helmet interviews below. |
| V6 | [Psychic Skills & Miracles: technology for telepathy and remote viewing](https://youtu.be/tmC1174POpA) | Octopus = 8 canisters × 2 coils, fields rising and falling in 1–3 ms ([4:42](https://youtu.be/tmC1174POpA?t=282)). Signals "Chirp" and "Burst-X" ([4:09](https://youtu.be/tmC1174POpA?t=249)); chirp chosen for psi ([45:49](https://youtu.be/tmC1174POpA?t=2749)). Dwell 10, 12 … 20 ms, each phase slower than the last ([19:47](https://youtu.be/tmC1174POpA?t=1187), [45:32](https://youtu.be/tmC1174POpA?t=2732)). Counter-clockwise rotation against the front-to-back 40 Hz "binding" sweep ([25:19](https://youtu.be/tmC1174POpA?t=1519)). Psi is right-hemisphere ([29:41](https://youtu.be/tmC1174POpA?t=1781)), centred on right hippocampal theta ([39:08](https://youtu.be/tmC1174POpA?t=2348)). Swann's targets were photos in manila envelopes in the next room, judged by 44 raters ([7:58](https://youtu.be/tmC1174POpA?t=478)). Intimate pairs at "2.85 times chance" ([13:53](https://youtu.be/tmC1174POpA?t=833)). Geomagnetic "launch window" after storms calm ([27:47](https://youtu.be/tmC1174POpA?t=1667)). The first instant impression is the psychic one ([1:27:56](https://youtu.be/tmC1174POpA?t=5276)). |
| I1 | [Murphy & Tony Balbin interview](https://youtu.be/1uVjHmi51HM) | Coils "over the temporal lobes, above the ears" (t=3359). Chirp over the whole right hemisphere (t=1290). Burst-firing first seen in an epileptic's EEG, also present in normal people (t=2018). "Effective signals are not frequencies, they're complex patterns." At most weekly, because of habituation (t=3278). Two sessions 90 min apart gave about 3× the EEG response (t=3521). The presence "doesn't really come up" at home without real silence (t=1222). |
| I2 | [Lynne McTaggart interview, 2006](https://youtu.be/K-0PHkfvEhg) | Persinger's procedure: right-side chirp for about 30 min, then an abrupt switch to the bilateral amygdala signal (t=104). Murphy's 8–10 days of distress. Midnight to 4 am is best. |

---

## Open questions

- **The point tables were never published.** Burst-firing, the chirp, the LTP file and Murphy's templates exist only as descriptions. The only exact table is the patent's Thomas/Cnp pulse ([US patent 6,234,953](https://patents.google.com/patent/US6234953B1/en)).
- **Conflicting accounts of the same experiment.**
  - The 2003 sibling study's abstract says "100 msec. with changes in rate of 20 msec." ([Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/)). The 2010 retelling says "20+2" and a different scalp location ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)).
  - Cook 1999 put the ring "at the level of the temporoorbital plane"; later papers put it above the ears ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)).
- **The Windows-jitter claim.** The lab says Windows timing jitter destroys the pattern ([Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12509207/)). This is the load-bearing claim of the Granqvist dispute, and nobody else has tested it. A blinded comparison of exact against jittered timing on this helmet would test it directly.
- **Sensory cues from the coils.** We found no published measurement of sound, vibration or warmth from these coils (see *What has not been done*).
- **The canonical helmet geometry.** How many solenoids per side, and where, is not pinned down in any paper.
