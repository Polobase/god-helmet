# The ring ("Octopus"): a field that steps around the head, and what was claimed for it

The "Octopus" is the second device from Michael Persinger and Stanley Koren's laboratory at Laurentian University, after the temporal-lobe helmet. Eight small solenoids sit in a ring around the head, and a weak patterned field steps from one to the next. The lab called this circumcerebral stimulation. It reported that the ring stretched subjective time and changed the EEG, and it used the ring in its psi studies. Todd Murphy sells a consumer version, the Shiva. The helmet in this project has eight coils and can be worn as such a ring.

This article sets out what the ring is, the reasoning behind it, the published studies, the consumer devices, and how to test a ring program blind. The short version: every ring result comes from one laboratory, with samples from one person to fifteen pairs, and none has been repeated elsewhere. The reasoning rests on a 1990s hypothesis about 40 Hz brain rhythms that neuroscience still treats as open. Standard physics predicts no neural effect at these field strengths. The one claim anyone can check at home is the time-estimation result.

Related documents:
- [RESEARCH.md](RESEARCH.md): the laboratory record, the independent tests and the physics
- [SIGNALS.md](SIGNALS.md), [PRESET_FORMAT.md](PRESET_FORMAT.md) and [PLACEMENT.md](PLACEMENT.md): rotation schedules, program files and ring layouts
- [EXPERIMENTS.md](EXPERIMENTS.md) and [SAFETY.md](SAFETY.md): blinded sessions; who should not use the helmet
- [Linked brains](EFFECT_LINKED_BRAINS.md): the claim that two people in the same rotating field become correlated
- The other effect articles: [Remote viewing](EFFECT_REMOTE_VIEWING.md), [Telepathy](EFFECT_TELEPATHY.md), [Remote influence](EFFECT_REMOTE_INFLUENCE.md), [Geomagnetic activity](EFFECT_GEOMAGNETIC.md), [Micro-PK](EFFECT_MICRO_PK.md), [Sensed presence](EFFECT_SENSED_PRESENCE.md), [Out-of-body experiences](EFFECT_OUT_OF_BODY.md)

## How to read this article

The evidence words are the ones used across the project:

| Word | Meaning |
|---|---|
| **established** | Independently replicated |
| **single-lab** | Reported by one laboratory or research group only |
| **claim** | Stated by an author, agency or vendor without independent support |
| **anecdote** | A personal account |
| **unverified** | Could not be checked against a primary source |

Nothing reported for the ring is **established**; the laboratory results are **single-lab** at best. Values marked *computed* are this project's own arithmetic.

## What the ring is

- **Patent.** A computer plays a stored waveform through a one-of-eight channel selector. Each channel drives a pair of solenoids on a headband, each a reed relay "with the reed switch removed and replaced by a steel nail core" ([US patent 6,312,376](https://patents.google.com/patent/US6312376B1/en), filed 1998).
- **Ring.** The papers describe eight solenoids "arranged circumcerebrally (every 45 deg)" ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)), "along a horizontal plane above the ears" ([Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/)). Solenoid 1 sat over the left frontal region; the field stepped counter-clockwise seen from above and ended over the right prefrontal region ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)).
- **Two coils per position.** Each position held a pair of reed switches in a film canister ([Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html); [Murphy's lecture at 3:40](https://youtu.be/tmC1174POpA?t=220)). This helmet has one coil per position.
- **Field strength.** About 10 µT ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)), 5–10 µT ([Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/)), 2–5 µT for Ingo Swann ([RESEARCH.md](RESEARCH.md)), about 1 µT in the middle of the array ([Dotta & Persinger 2012](https://file.scirp.org/Html/17181.html)), 1–5 µT inside each solenoid ([Lehman 2016](https://laurentian.scholaris.ca/server/api/core/bitstreams/e7b03302-1b7f-4f4f-acf5-bdf41ee5370f/content)). Hardly any paper says where it was measured. This helmet's programs default to 1 µT at 20 mm in front of the coil and may ask for 5 µT at most.

### Rotation schedules

A configuration is a waveform, a time on the first coil, and a change in that time at each next coil. The lab wrote this as base ± change. The sign is a trap, because the papers disagree. In the patent, in Cook 1999 (p.3 [63]) and in Richards 2002, "+" means more time on each next coil. From Tsang 2004 on (p.5 [1187]), "+" means *less* time, so the rotation speeds up ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99); [SIGNALS.md](SIGNALS.md), sections 2.8–2.9). The first three rows below use the later reading. Each program's phase names give the times it plays.

| Lab label | Time on coils 1 to 8 | One turn (*computed*) | In a program |
|---|---|---|---|
| "20+2" | 20, 18, … 6 ms: speeds up | 104 ms | `"dwell": [20, -2, 6]` |
| "20−2" | 20, 22, … 34 ms: slows down | 216 ms | `"dwell": [20, 2, 34]` |
| "25+2" ([Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/)) | 25, 23, … 11 ms | 144 ms | `"dwell": [25, -2, 11]` |
| 100 ms with 20-ms changes | 100, 120, … 240 ms | 1,360 ms | `"dwell": [100, 20, 240]` |

The same table of six configurations is printed in Cook 1999 (p.2 [62]), Richards 2002 (p.4 [674]), the Swann paper (p.4 [930]) and Booth 2008 (p.3 [428]). Of the waveforms, only the Thomas pattern is published as numbers, in a patent table. The burst-firing shape is printed only as a graph (Persinger 2000 Fig. 2 p.5 [663]) ([RESEARCH.md](RESEARCH.md), "Open questions").

## The reasoning: a 40 Hz "binding factor"

### What the lab and Murphy say

- **The lab.** The first ring paper ties its result to "the temporal binding for experience, most likely a feature of the rostrocaudal waves recreated every approximately 20 ms over the cerebral cortices" ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)). The direction was chosen "because we presumed the direction of the field would be moving against the rostral-caudal creations of the natural macroscopic magnetic fields generated from the cerebrum" ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)). A lab thesis gives Edelman (1989) and Llinás and Ribary (1993) as the sources for the 20 ms ([Lehman 2016](https://laurentian.scholaris.ca/server/api/core/bitstreams/e7b03302-1b7f-4f4f-acf5-bdf41ee5370f/content)) (**claim**).
- **Murphy.** In his lecture a "binding factor" rises from the thalamus ([21:48](https://youtu.be/tmC1174POpA?t=1308)) and crosses the brain from front to back "twenty five times per second" ([23:35](https://youtu.be/tmC1174POpA?t=1415)). The signals go counter-clockwise, so over the right side they run "against the grain" ([25:19](https://youtu.be/tmC1174POpA?t=1519)). His site says the sweep repeats "every 25 milliseconds" and that Shiva exists "to dampen" it and so release psychic skills ([Murphy: Shiva](https://www.god-helmet.com/wp/shiva/index.htm)) (**claim**).

### What the cited neuroscience says

- **The finding.** Llinás and Ribary recorded magnetic brain activity in five adults. They found coherent 40 Hz activity in waking and in dream sleep, with "a fronto-occipital phase shift over the head" of at most "approximately 12-13 msec". They proposed 40 Hz as "a correlate of cognition" and thalamo-cortical loops as the source of "the temporal binding required for the unity of cognitive experience" ([Llinás & Ribary 1993](https://pubmed.ncbi.nlm.nih.gov/8446632/)).
- **How its authors framed it.** Llinás and Paré called these "preliminary studies" and wrote that the shift "suggests" waves scanning the brain (Llinás & Paré 1991, reprinted in Baars, Banks & Newman, eds, *Essential Sources in the Scientific Study of Consciousness*, 2003, p. 979). Ten years later Llinás still called 40 Hz activity "a candidate" for binding (Llinás, *I of the Vortex*, 2001, p. 124).

So the lab built on a real proposal: one group's recordings in five people, with a hypothesis attached (**single-lab**).

### The later debate

- **Binding by synchrony.** Wolf Singer's group proposed that neurons firing in step, often at gamma frequencies, mark features that belong together. Singer's own summary calls a key requirement, coincidence detection, "still controversial" (Singer, in Wilson & Keil, eds, *The MIT Encyclopedia of the Cognitive Sciences*, 1999, pp. 81–84).
- **Critics.** A long critique appeared the same year ([Shadlen & Movshon 1999](https://pubmed.ncbi.nlm.nih.gov/10677027/)). A later review "finds no compelling reasons to assign functional roles to oscillatory synchrony in the gamma range" ([Merker 2013](https://pubmed.ncbi.nlm.nih.gov/23333264/)). Another concludes that whether gamma is a mechanism for processing or coding "remains an open question" ([Ray & Maunsell 2015](https://pubmed.ncbi.nlm.nih.gov/25555444/)).
- **A measurement problem.** A much-reported gamma response in scalp EEG "reflects properties of miniature saccade dynamics rather than neuronal oscillations" ([Yuval-Greenberg 2008](https://pubmed.ncbi.nlm.nih.gov/18466752/)).

Gamma rhythms are real and follow attention (**established**). That they bind experience into one whole is unsettled.

### Where the argument has gaps

1. **A hypothesis is used as a fact.** Its own authors called 40 Hz binding a candidate.
2. **The times do not fit.** The measured shift is 12–13 ms within a 25 ms cycle; the lab says about 20 ms. One turn of the ring takes 104 to 1,360 ms in the schedules above, about 4 to 54 cycles of a 40 Hz rhythm (*computed*).
3. **No mechanism for "against the grain".** The sweep is a time lag between sensors. None of the sources we opened says how a field stepping the other way would interfere with it.
4. **The field is too weak by standard biophysics.** Smooth signals from coils like these induce about a microvolt per metre in the brain; networks start to respond at about 0.1–1 V/m ([RESEARCH.md](RESEARCH.md), "Induced electric field").

## The record, study by study

| Study | What was done | Reported | What is missing | Evidence |
|---|---|---|---|---|
| [Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/) | 5–10 µT next to the scalp; six patterns of 5 min, with a 10-s time estimate midway through each; clockwise and counter-clockwise groups of 7 people (p.2 [62]) | Counter-clockwise estimates "about 3 s longer", "approximately 50% of the variance" | No sham group; no blinding in the abstract; the best of three rates of change was picked afterwards | **single-lab** |
| [Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/) | 5–10 µT; six configurations; 8 volunteers; EEG in five bands over eight sites | About 30 % more theta power with the 20-ms-change configuration; right hemisphere 20 % higher at 5.0–5.9 Hz | No sham in the abstract; one configuration among many tests; the right-left difference came with all six, so no pattern explains it | **single-lab** |
| [Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/) | Six configurations of 5 min, counter-clockwise; 11 people | Only the 25 → 11 ms rotation raised 35–45 Hz power, frontally and occipitally | One of six; no sham in the abstract; scalp gamma is prone to eye-movement artefact | **single-lab** |
| [Booth 2008](https://pubmed.ncbi.nlm.nih.gov/19037792/) | The same patterns in both directions | More power over the left hemisphere with clockwise, over the right with counter-clockwise rotation | No sample size, intensity or sham in the abstract; a repeat inside the lab | **single-lab** |
| [Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/) (Ingo Swann) | One 30-min exposure; remote-viewing trials on later days | Fields "significantly altered his subjective experiences"; occipital 7 Hz activity correlated with rated accuracy (rho = .50) | One subject, no sham session; the abstract compares no accuracy with and without the field | **single-lab** |
| [Koren & Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12509207/) | Fields under 20 nT around the target photographs, not the head | Patterns generated under Windows lowered Swann's accuracy; the same patterns under DOS did not | A pilot with one subject | **single-lab** |
| [Collins 2013](https://laurentian.scholaris.ca/server/api/core/bitstreams/c03e0259-4b31-410f-9552-d90c9c2b81a4/content) | Murphy's 64-coil Shiva hat; burst-firing, 100 ms plus 20 ms per column, 20 min; 5 field, 4 sham | Field group endorsed 35 % of exit items, sham 9 % | A thesis with nine people, told they "might or might not" get a field; it does not say whether the experimenter knew | **single-lab** (thesis) |
| [Saroka 2010](https://web.archive.org/web/20150331100355id_/http://www.neuroquantology.com/index.php/journal/article/download/302/347) | 64-coil Shiva; 5 min on, 1.5 min off, 5 min on; one man | An out-of-body experience that began "a few seconds after" the first block stopped | One case, no sham | **anecdote** |

The pair studies, in which one or both partners wore the ring, are in [Linked brains](EFFECT_LINKED_BRAINS.md).

What the record lacks as a whole:
- **Replication.** No group outside the lab has repeated any ring result (see the search below).
- **Sham and blinding.** Only Collins 2013 and a mood study with rotated fields ([Tsang 2009](https://pubmed.ncbi.nlm.nih.gov/20017627/)) name a sham group. Cook 1999 compares two directions, not field with no field.
- **One winner among many.** Each study runs about six configurations and tests several EEG bands and sites. A different configuration "wins" each time.
- **Preregistration.** None. The lab's notation and later retellings also disagree ([RESEARCH.md](RESEARCH.md), "Open questions").

## Shiva and the 8 Coil Shakti

- **Shiva.** Eight coil pairs around the head, driven from a PC. Persinger wrote in 2015 that the Basic Shiva System "is a faithful reproduction of our circumcerebral 'Octopus'" ([Persinger 2015 letter](https://www.god-helmet.com/wp/god-helmet/persinger_endorsement_of_shiva_god_helmet.pdf)). That is an endorsement, not a test. Murphy says it "can heighten spiritual growth and psychic skills, especially telepathy and remote viewing" ([Murphy: Shiva](https://www.god-helmet.com/wp/shiva/index.htm)) (**claim**).
- **Evidence for Shiva.** Two lab reports used Shiva hardware (Collins 2013, Saroka 2010). A Swiss report describes "400 test sessions with over 100 people" and gives no data ([DeepFocus report](https://www.god-helmet.com/wp/shiva/deepfocus_report_english.htm)) (**anecdote**). The timing tables are unpublished ([RESEARCH.md](RESEARCH.md)).
- **8 Coil Shakti.** It is not a ring: four coils sit over each temporal lobe, and signals alternate between two coil pairs, which Murphy says "approximates the effects of 'rotation' used in laboratory studies" ([Murphy: 8 Coil Shakti](https://www.god-helmet.com/wp/winshakti/rotating/index.htm)) (**claim**). The one independent test found no effect on emotional ratings ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/); N = 37). The lab's own comparison found one EEG difference, an interaction in high alpha ([Tsang, Koren & Persinger 2004](https://pubmed.ncbi.nlm.nih.gov/15527205/)).

## Has anyone else tried it?

- **PubMed.** "Circumcerebral" returns 11 records: ten from Persinger's group and one unrelated paper on a parasite ([PubMed search](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=circumcerebral&retmode=json)).
- **Europe PMC**, which also searches full texts, returns 13: the lab's papers, the parasite paper and one EEG-at-a-distance study that cites the lab ([Europe PMC search](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=circumcerebral&format=json&pageSize=80&resultType=lite)).
- **Citations and other wording.** In Europe PMC, the papers citing Cook 1999, Richards 2002 and Tsang 2004 are the lab's own, a few reviews and one unrelated 50 Hz study. "Rotating magnetic field" with EEG and "human", without Persinger as author, returned nothing in PubMed.

We found no use of a ring of weak, stepped fields around the head outside this laboratory and its vendor. The search is necessarily incomplete.

Mainstream groups do move a stimulus across the head, with fields or currents known to reach neurons:

| Method | What moves | Strength | Evidence |
|---|---|---|---|
| Rotational-field TMS | Two crossed coils, 90° out of phase, turn the induced electric field | TMS strength | Lower motor thresholds in 8 volunteers; company-linked ([Roth 2020](https://pubmed.ncbi.nlm.nih.gov/32289723/)) (**single-lab**) |
| Travelling-wave tACS | The place of the strongest electric field shifts over the cycle | Currents through scalp electrodes | Field recordings in two monkeys; no behaviour ([Alekseichuk 2019](https://pubmed.ncbi.nlm.nih.gov/31189931/)) |
| Geomagnetic rotation | The direction of an Earth-strength field | About 35 µT ([RESEARCH.md](RESEARCH.md)) | A drop in alpha power; no independent replication found ([Wang 2019](https://pubmed.ncbi.nlm.nih.gov/31028046/)) (**single-lab**) |

None of this supports an effect at 1–10 µT. The clinical low-field methods use fields tens to tens of thousands of times stronger than this helmet's, with mixed results ([RESEARCH.md](RESEARCH.md), "Mainstream low-field science"). The closest independent tests, sham-controlled and without a ring, found no effect of God-Helmet-type fields ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/), double-blind; [Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/), where the experimenter knew the condition, p.7 [223]).

## Reading list and primary sources

**The lab's ring**
- [US patent 6,312,376](https://patents.google.com/patent/US6312376B1/en): the hardware.
- [Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/), [Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/), [Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/), [Booth 2008](https://pubmed.ncbi.nlm.nih.gov/19037792/): time estimation and EEG.
- [Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99): the lab's own review of the ring and its reasoning.
- [Collins 2013](https://laurentian.scholaris.ca/server/api/core/bitstreams/c03e0259-4b31-410f-9552-d90c9c2b81a4/content) and [Saroka 2010](https://web.archive.org/web/20150331100355id_/http://www.neuroquantology.com/index.php/journal/article/download/302/347): the Shiva studies.

**Gamma rhythms and binding**
- [Llinás & Ribary 1993](https://pubmed.ncbi.nlm.nih.gov/8446632/), *PNAS* 90:2078–2081: the source of the front-to-back sweep.
- [Shadlen & Movshon 1999](https://pubmed.ncbi.nlm.nih.gov/10677027/), [Merker 2013](https://pubmed.ncbi.nlm.nih.gov/23333264/), [Ray & Maunsell 2015](https://pubmed.ncbi.nlm.nih.gov/25555444/), [Yuval-Greenberg 2008](https://pubmed.ncbi.nlm.nih.gov/18466752/): the critical side.

**Books**
- Llinás R. *I of the Vortex: From Neurons to Self* (2001), chapter 6: the hypothesis in its author's words.
- Baars, Banks & Newman (eds). *Essential Sources in the Scientific Study of Consciousness* (2003), chapter 59: Llinás and Paré 1991.
- Wilson & Keil (eds). *The MIT Encyclopedia of the Cognitive Sciences* (1999): Singer on binding by synchrony.

**Tests and methods**
- [Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/) and [Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/): the independent null tests.
- [Rattat & Droit-Volet 2012](https://pubmed.ncbi.nlm.nih.gov/21789731/): how to stop people counting in timing tasks.

## Trying it with this helmet

Wear the coils as a ring on the band line, above the ears. [PLACEMENT.md](PLACEMENT.md) gives three rings: Layout A (Fpz, F7, T7, P7, Oz, P8, T8, F8), the Shiva ring, and the lab's 45° ring, the closest to the papers. Each program names its own sites.

### Programs

None of these has been shown to do what is claimed. They let you test the claims, blind and against sham. The pair programs are in [Linked brains](EFFECT_LINKED_BRAINS.md).

| Program | What it is | Evidence |
|---|---|---|
| [Cook 1999: six patterns, counter-clockwise](#programs/persinger-cook-1999-time-ccw) ([brain view](#programs/persinger-cook-1999-time-ccw/brain)) and [clockwise](#programs/persinger-cook-1999-time-cw) | The time-estimation session: six 5-min patterns with 2 min without field between them, 40 min. The paper took the 10-s estimate midway through each pattern (p.2 [62]) | **single-lab** |
| [Octopus ring: +20 ms per coil](#programs/persinger-octopus-plus20-ccw) and [Tsang 2004: 25 → 11 ms rotation](#programs/persinger-tsang-2004-gamma-thomas) | Single 5-min configurations: the 100 to 240 ms rotation of Cook 1999 and Richards 2002 (the theta study), and the rotation that Tsang 2004 reported for gamma | **single-lab** |
| [Tsang 2004: six counter-clockwise rotations of the Thomas pattern](#programs/persinger-tsang-2004-six-configurations) | All six configurations of the gamma study, 5 min each, 30 min | **single-lab** |
| [Booth 2008: six patterns, clockwise](#programs/persinger-booth-2008-cw) and [counter-clockwise](#programs/persinger-booth-2008-ccw) | The six configurations in one direction per program, as each group of six people received them (p.4 [429]); 5 min each with 30 s without field between them, 32.5 min | **single-lab** |
| [Swann 2002: six configurations as printed](#programs/persinger-swann-2002-table1) ([brain view](#programs/persinger-swann-2002-table1/brain)) | The 30-min exposure given to Ingo Swann | **anecdote** (one subject) |
| [Shiva psi session (chirp, 10 → 20 ms per coil)](#programs/remote-viewing) and [Shiva "Persinger Session"](#programs/murphy-shiva-persinger-session) | Murphy's psi configurations for the ring | **claim** |
| [Collins 2013 Shiva amygdaloid](#programs/persinger-collins-2013-shiva-amygdaloid) and [64-coil Shiva OBE case](#programs/murphy-shiva64-obe-lab) | Eight-coil stand-ins for the 64-coil hat: one coil stands for each column of eight | **single-lab** (a thesis) and **anecdote** (one case) |
| [sham](#programs/sham) | No field; or tick **Blind** on any program | – |

The Thomas pattern plays from the published patent table. The burst-firing pattern is a stand-in: the lab printed its shape only as a graph and never published the point values as numbers. Murphy's signals are approximations of unpublished files. Each program's notes say what was inferred.

### A fair test: the 10-second estimate

The time claim needs no EEG, only a helper with a stopwatch. [EXPERIMENTS.md](EXPERIMENTS.md) has the full method.

1. **Write the plan down first.** One program (the counter-clockwise Cook session), the number of sessions, and one outcome: the mean of the six produced intervals, real against sham.
2. **Run the cue test**, so you know the stepping coils make no sound you can hear.
3. **Tick Blind and start.** The helmet picks real or sham and hides it.
4. **Midway through each pattern, produce 10 seconds**, as in the paper (2.5 min into each 5-min pattern, with the field on; p.2 [62]). Say "start" and "stop". The helper times you on a stopwatch you cannot see and never tells you the result.
5. **Do not count.** Counting makes estimates more accurate and less variable; a plain instruction not to count is the simplest remedy that works ([Rattat & Droit-Volet 2012](https://pubmed.ncbi.nlm.nih.gov/21789731/)).
6. **Guess the condition**, then save. Keep 72 hours between sessions ([SAFETY.md](SAFETY.md)) and analyse once, at the planned number.

The lab's figure, half the variance between two groups, corresponds to a difference of about two standard deviations (*computed*). A difference of one standard deviation needs about 17 sessions per arm ([EXPERIMENTS.md](EXPERIMENTS.md)), so an effect of the reported size should show in a few dozen blinded sessions. A second design compares counter-clockwise with clockwise, as the lab did.

### What it cannot show

- **The EEG claims.** Theta and gamma changes need EEG, which this project does not provide.
- **The lab's exact exposure.** This helmet has one coil per position and a rebuilt burst-firing waveform. The field strength is not matched either: Cook gives 5–10 µT next to the scalp (p.2 [62]), while a program's 5 µT is the field 20 mm in front of the coil, about 24 times less than at the scalp ([HARDWARE_AUDIT.md](HARDWARE_AUDIT.md)). A null result here does not refute the paper.
- **Proof.** A positive personal series is a reason for someone else to repeat it. Time estimates shift with arousal and expectation, which is why only real against sham counts.

Read [SAFETY.md](SAFETY.md) first. These programs are not for anyone with epilepsy or a seizure history; stop on headache, nausea or distress. Nothing here treats any condition.
