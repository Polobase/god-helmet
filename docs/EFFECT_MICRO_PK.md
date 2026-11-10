# Mind over random numbers (micro-PK): the record, the helmet's random generator, and how to test it

Micro-psychokinesis, or micro-PK, is the claim that intention alone can shift the output of a random number generator: a few more ones than zeros when you wish for ones. It has been tested in hundreds of experiments since the 1960s, because the experiment is simple and a machine keeps the score. Its link to the God Helmet is thin but real: Michael Persinger's laboratory reported that weak fields over the temporal lobes strengthened the effect, and this helmet carries a hardware random generator that a guide turns into a micro-PK test.

This article sets out the record, what the Laurentian studies did, how a hardware random generator works, and what an honest test with this app looks like. The short version: across hundreds of experiments the average shift is a few hits in 100,000 bits and shrinks as studies grow; the three-laboratory replication of the best-known programme failed; recent pre-registered tests found nothing; and at the size the literature claims, one person cannot collect enough bits to see the effect.

Related documents:
- [RESEARCH.md](RESEARCH.md): the evidence review, with the psi research summary
- [EXPERIMENTS.md](EXPERIMENTS.md): blinding, statistics, stopping rules and pre-registration
- [GUIDES.md](GUIDES.md): the guided sessions and the `rng` input
- [BLE_PROTOCOL.md](BLE_PROTOCOL.md): `rng.bytes`
- [SAFETY.md](SAFETY.md): exposure limits and who should not use the helmet
- Other effect articles: [Geomagnetic activity](EFFECT_GEOMAGNETIC.md), [Telepathy](EFFECT_TELEPATHY.md), [Remote influence](EFFECT_REMOTE_INFLUENCE.md), [The ring](EFFECT_RING.md), [Linked brains](EFFECT_LINKED_BRAINS.md), [Remote viewing](EFFECT_REMOTE_VIEWING.md)

## How to read this article

| Word | Meaning |
|---|---|
| **established** | Independently replicated |
| **single-lab** | Reported by one laboratory or research group only |
| **claim** | Stated by an author, agency or vendor without independent support |
| **anecdote** | A personal account |
| **unverified** | Could not be checked against a primary source |

Nothing about micro-PK itself is **established**. What comes closest to that word is negative: the effect gets smaller as studies get larger, and it has not survived replications planned in advance. Values marked *computed* are this project's own calculations from the cited figures.

## What the claim is

A generator produces a stream of bits, each 0 or 1 with equal chance. A person tries to push the stream one way ("aim high") or the other ("aim low"), usually while watching a display driven by the bits. The score is the hit rate: the share of bits that went the aimed way. Chance is 50 %.

Three terms recur:
- **z score.** How far the hit count lies from chance, in units of its chance scatter. With N bits the scatter is half the square root of N: about ±16 hits in 1,000 bits, ±100 in 40,000.
- **Decline effect.** A result that starts strong and fades as the experiment is repeated, within a session or across studies. Proponents treat it as a property of psi. The ordinary reading is that first results are selected for being striking, and luck does not repeat.
- **Small-study effect.** Small studies report larger effects than big ones. That is the pattern expected when small studies are published only if they succeed.

## The record

| Study | Data | Result | Evidence |
|---|---|---|---|
| Schmidt 1970, the first electronic PK test | 15 subjects, 256 runs of 128 binary events from a radioactive-decay generator that moved a light around a circle of nine lamps | 302 fewer hits than chance (p = .001), a hit rate of 49.1 % (*computed*). A low score had been predicted after a pilot series (abstract quoted in Koestler, *The Roots of Coincidence*, 1972, pp. 45–46) | **single-lab** |
| [Honorton & May, about 1976](https://archive.org/download/STARGATEDataset/StargateDataset.zip/STARGATE%20dataset%2FCIA-RDP96-00787R000200130005-3.pdf) | 10 subjects, five high-aim and five low-aim runs of 100 bits each | 51.9 % against 49.2 % (p = .035). First two runs: 54.3 % against 48.2 %; last two: 50.5 % for both | **single-lab**; 10,000 bits in all |
| [PEAR benchmark](https://icrl.org/wp-content/uploads/2020/02/1997-correlations-random-binary-sequences-12-year-review.pdf) (Jahn et al. 1997) | 91 operators, 2.5 million trials of 200 bits over 12 years at Princeton | High minus low: z = 3.81. A shift "of the order of 10⁻⁴ bits deviation per bit processed". 52 % of operators scored in the intended direction, which is not significant | **single-lab** |
| [Radin & Nelson 1989](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%236%20178/Part0007/CIA-RDP96-00789R002200520001-0.TXT) | 597 experimental and 235 control studies by 68 investigators, 1959–1987 | Control studies at chance, experimental studies not; mean effect about 3 × 10⁻⁴; 54,000 unpublished null studies would be needed to cancel it | **claim**: proponent meta-analysis |
| [Bösch, Steinkamp & Boller 2006](https://pubmed.ncbi.nlm.nih.gov/16822162/) | 380 studies | "A significant but very small overall effect size"; effects "strongly and inversely related to sample size"; a simulation showed that all of this "could in principle be a result of publication bias" | Meta-analysis |
| [Jahn et al. 2000](https://icrl.org/wp-content/uploads/2020/02/2000-mmi-consortium-portreg-replication.pdf), three laboratories | Freiburg, Giessen and Princeton; 227 operators, 750 series, PEAR's equipment and protocol | The primary measure "failed by an order of magnitude" to reach the earlier size: Z = 0.596 against 3.809 | Planned multi-lab replication, null |
| [Maier & Dechamps 2018](https://journalofscientificexploration.org/index.php/jse/article/view/1250) | Smokers and a quantum generator that chose smoking or neutral pictures | Study 1, 122 smokers: Bayes factor 66 for an effect. Study 2, pre-registered, 175 smokers: Bayes factor 11 against | **single-lab**; the pre-registered test was null |
| [Maier, Dechamps & Pflitsch 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5872141/) | 12,571 online participants, quantum generator choosing pleasant or unpleasant pictures | 50.02 % pleasant; Bayes factor 10 for no effect: "micro-PK did not exist in the data" | Null |
| [Dechamps et al. 2021](https://journals.lub.lu.se/jaex/article/view/23205) | Four studies, more than 12,000 participants | Study 1 (4,092 people, not pre-registered): Bayes factor 13 for an effect. Three pre-registered follow-ups: about 11 against, each time | **single-lab**; null when pre-registered |
| [Global Consciousness Project](https://global-mind.org/results.html) | A world network of generators; 500 chosen world events, 1998–2015 | Combined Z = 7.31 | **claim**; disputed from inside, see below |

### The meta-analyses and the replies

Bösch and colleagues' two ways of averaging landed on opposite sides of chance: 0.499997 with fixed effects and 0.500035 with random effects, both "significant". The three largest studies went against the participants' aim. [Wilson & Shadish 2006](https://zenodo.org/records/996283/files/article.pdf) concluded that it is "nearly impossible to draw any conclusions from this body of research" and asked researchers to produce larger effects or to say what result would make them accept the null. [Radin, Nelson, Dobyns & Houtkooper 2006](https://pubmed.ncbi.nlm.nih.gov/16822164/) replied that selective reporting is "an implausible explanation" and that Bösch wrongly assumed effect size to be independent of sample size.

### Declines, in the data

- In Honorton and May's ten subjects the whole effect sat in the first runs.
- PEAR saw "a peak of initial success" in an operator's first series, a "sharp reduction" in the second and third, then partial recovery ([Jahn et al. 1997](https://icrl.org/wp-content/uploads/2020/02/1997-correlations-random-binary-sequences-12-year-review.pdf)).
- Maier and Dechamps proposed that the effect rises and falls like a damped oscillation. A physicist who re-analysed their large data set with 1,000 shuffled copies found "no statistical evidence" for it (p = .33) ([Grote 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6085579/)).

An effect that appears in first, small or unregistered runs and fades in later, larger or registered ones is what selection and chance produce. It is also what the proponents' models predict. The two readings differ in one testable way: only a real effect survives a large test whose analysis was fixed beforehand. So far none has.

### Influence or selection?

Schmidt himself noted that his result "could certainly also be ascribed to precognition": the subject decides when to start, and a lucky moment gives a lucky sequence (Koestler 1972, p. 46). May, Utts and Spottiswoode later built this into "decision augmentation theory", in which micro-PK results come from a weak precognitive channel "as opposed to a force-like interaction" (described in [Spottiswoode 1997](http://www.jsasoc.com/docs/JSE-LST.pdf)). The same dispute runs through the Global Consciousness Project. May and Spottiswoode found that the 234 events proposed by the project's director gave Z = 5.91 and the other 66 gave 1.26, and put the result down to his choices ([May & Spottiswoode 2011](https://journalofscientificexploration.org/index.php/jse/article/view/14)). The project's own analyst concluded that the data "do not support the global consciousness proposal" and fit a goal-oriented effect tied to individuals ([Bancel 2017](https://pubmed.ncbi.nlm.nih.gov/28279629/)). All of these are **claims** about how to read a disputed effect.

Critics of the early work pointed to missing safeguards: no controls run alongside, an experimenter who was also the subject, possible optional stopping ([Psi Encyclopedia: Helmut Schmidt](https://psi-encyclopedia.spr.ac.uk/articles/helmut-schmidt), summarising Hansel and Alcock). For PEAR, Alcock argued that one operator accounted for nearly all of the significant results and that operators sat alone with the machine; the laboratory answered that the result stayed significant without that operator (Mishlove, *The Roots of Consciousness*, revised edition, pp. 312–313).

## The God Helmet link

Persinger's laboratory published a small group of micro-PK studies in 2013 and 2014. They are collected in a Laurentian master's thesis ([Caswell 2014](https://laurentian.scholaris.ca/items/6be7fb6b-0c69-45f1-b2f4-2ed6a3cfa563)).

- **Temporal-lobe fields.** Fifteen volunteers sat in a dark acoustic chamber, wearing a cap with four solenoids over each temporal lobe, driven by Todd Murphy's Shiva software at 0.04 to 0.4 µT. A commercial generator (Psyleron REG-1) stood 1 m away. Each person aimed for about 5 min, then received a 40 Hz "chirp" for 20 min and a "target" field for 15 min, then aimed again for 5 min with the field on. Nine received a hippocampal "LTP" pattern over the right hemisphere, six an amygdala "burst-firing" pattern over the left. Results: before the field z = 1.41 (p = .08); with the field z = 2.88 (p = .002); the right-sided LTP group alone z = 3.07; the burst-firing group z = 0.79.
- **Whole-body fields.** In eight people, a field of about 400 nT built from 3-ms points "reversed the effects" of intention.
- **Space weather.** Geomagnetic activity correlated at about r = .55 with the generator's deviation during the second minute of intention ([Caswell et al. 2014](https://journalofscientificexploration.org/index.php/jse/article/view/756)). See [Geomagnetic activity](EFFECT_GEOMAGNETIC.md) for why such correlations need care.

These results are **single-lab**. The thesis's own table shows that the difference between "with field" and "before field" was not significant (z = 1.03, p = .15), and the field condition always came second. There was no sham field, so order, practice and 35 minutes in the chair are mixed up with the field. The mean shift under the field, about 0.15 % per bit, is some fifteen times PEAR's (*computed*), from 15 people. The papers, in journals such as *International Letters of Chemistry, Physics and Astronomy* and *NeuroQuantology*, report many secondary analyses. We found no independent attempt to repeat them.

Murphy's lecture on psychic skills covers telepathy and remote viewing; its transcript does not mention random generators ([tmC1174POpA](https://youtu.be/tmC1174POpA)). His role here is the software.

## How a hardware random generator works, and this helmet's

A hardware generator turns physical noise into bits. PEAR sampled the noise of a reverse-biased semiconductor junction; Schmidt timed radioactive decays; the Munich group used a commercial quantum device. Raw noise is never perfectly balanced, so careful designs cancel bias by construction. PEAR counted its samples against "a regularly alternating +,−,+,−,... template"; Honorton and May alternated the target "on each trial".

The helmet uses the generator built into its ESP32 chip:
- **Source.** Espressif states that the numbers are "generated based on the thermal noise in the system and the asynchronous clock mismatch". They are true random numbers while the radio is on, or while the chip's ADC noise source is enabled; otherwise "the output of the RNG should be considered as pseudo-random only" ([Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/random.html)).
- **Firmware.** `fillRandom` in `firmware/src/control.cpp` reads the generator directly when Bluetooth runs. With Bluetooth off it switches the noise source on for the draw and off again. The same function draws real or sham and the trial targets.
- **Protocol.** `rng.bytes` returns up to 256 bytes with a `source` label ([BLE_PROTOCOL.md](BLE_PROTOCOL.md)).

"Random" here means unpredictable and, ideally, unbiased and without memory. This project has not certified the chip's output with a statistical test suite, and the Espressif page cites none. Ordinary things that could tilt it: a small surplus of ones, patterns tied to bit positions, slow drift with temperature or supply voltage, and software fall-backs. The guide below is built so that none of these can pass for an effect. One more limit: PEAR reported that deterministic pseudo-random sources "yield null overall mean shifts", so on PEAR's own account the app's demo mode, which uses the browser's software generator, does not test the claim.

## Reading list and primary sources

**Primary**
- Jahn RG, Dunne BJ, Nelson RD, Dobyns YH, Bradish GJ (1997). Correlations of random binary sequences with pre-stated operator intention. *Journal of Scientific Exploration* 11:345–367 ([reprint](https://icrl.org/wp-content/uploads/2020/02/1997-correlations-random-binary-sequences-12-year-review.pdf)).
- Jahn R et al. (2000). Mind/Machine Interaction Consortium: PortREG replication experiments. *Journal of Scientific Exploration* 14:499–555 ([PDF](https://icrl.org/wp-content/uploads/2020/02/2000-mmi-consortium-portreg-replication.pdf)).
- May EC, Honorton C; Honorton C, May EC (about 1976). Two Maimonides papers in the CIA's STAR GATE files, CIA-RDP96-00787R000200130005-3 ([PDF](https://archive.org/download/STARGATEDataset/StargateDataset.zip/STARGATE%20dataset%2FCIA-RDP96-00787R000200130005-3.pdf)).
- Maier MA, Dechamps MC, Pflitsch M (2018). Intentional observer effects on quantum randomness. *Frontiers in Psychology* 9:379 ([full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC5872141/)).
- Dechamps MC, Maier MA, Pflitsch M, Duggan M (2021). Observer dependent biases of quantum randomness. *Journal of Anomalous Experience and Cognition* 1:114–155 ([journal](https://journals.lub.lu.se/jaex/article/view/23205)).
- Caswell JM (2014). *The potential role of consciousness in the collapse of random physical systems*. Master's thesis, Laurentian University ([repository](https://laurentian.scholaris.ca/items/6be7fb6b-0c69-45f1-b2f4-2ed6a3cfa563)).

**Meta-analyses and replies**
- Radin DI, Nelson RD (1989). *Foundations of Physics* 19:1499–1514 ([text copy](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%236%20178/Part0007/CIA-RDP96-00789R002200520001-0.TXT)).
- Bösch H, Steinkamp F, Boller E (2006). *Psychological Bulletin* 132:497–523 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/16822162/)); the comments by Wilson & Shadish ([manuscript](https://zenodo.org/records/996283/files/article.pdf)) and Radin et al. ([PubMed](https://pubmed.ncbi.nlm.nih.gov/16822164/)).

**Critical**
- Grote H (2018). Commentary. *Frontiers in Psychology* 9:1350 ([full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC6085579/)).
- Bancel PA (2017). Searching for global consciousness: a 17-year exploration. *Explore* 13:94–101 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/28279629/)).

**Books**
- Koestler A. *The Roots of Coincidence* (1972): Schmidt's first experiments, with his abstracts.
- Mishlove J. *The Roots of Consciousness* (revised edition): PEAR, its critics and the replies.

## Trying it with this helmet

### The guide

| Guide | What it is | Evidence |
|---|---|---|
| [Micro-PK with the hardware random generator](#guides/rng-pk) | A 26-minute session modelled on Honorton and May's task. The coils stay off; the helmet only supplies bits | **single-lab** |

One session runs like this:
1. **Control block.** 10 trials of 1,000 bits with no aim and no feedback, to show the generator on its own.
2. **Two intention blocks** of 20 trials each, with a minute's rest between them. Before every trial the app shows the aim, HIGH or LOW. The aims alternate, and chance decides which comes first. After a 3-second countdown the bits arrive live at 50 per second.
3. **Scoring.** Each bit is compared with an alternating target (1, 0, 1, 0, ...). A gauge shows the running hit rate, and a band lights when the last 10 bits run 70 % or more your way.
4. **Result.** The count of bits that went the aimed way (hits on high trials, misses on low ones), with z and a one-sided p, and the high-minus-low z. A trial you abandon is kept and counted.

How this deals with an imperfect generator:

| Possible fault | What stops it from looking like an effect |
|---|---|
| More ones than zeros | The alternating target: half the bits are scored against 1, half against 0 |
| A pattern tied to bit positions, or any constant tilt in the hit rate | High-aim and low-aim trials are scored against the same target, so the tilt drops out of their difference |
| Slow drift | The aims alternate trial by trial |
| The helmet fails to answer | The browser's generator fills in, and the source of every trial is stored (helmet, browser or mixed) |

The guide has no helmet arm. It does not test the Laurentian claim that a field strengthens the effect, and a coil running beside the chip's noise source would need its own control with nobody intending.

### How many bits

A session gives 40,000 intention bits. Chance alone moves the score by about ±100 bits. The sizes below are per-bit shifts, with the bits needed for 80 % power at one-sided α = .05 (*computed*):

| Assumed effect | Shift from 50 % | Bits needed | Sessions |
|---|---|---|---|
| Honorton & May 1976 | 1.35 points | 8,500 | less than one |
| Schmidt 1970 | 0.9 points | 18,000 | less than one |
| Laurentian field condition | 0.15 points | 680,000 | 17 |
| PEAR benchmark | 0.01 points | 155 million | about 3,900 (1,700 hours) |
| Bösch's random-effects mean | 0.0035 points | 1.3 billion | about 31,500 |

Read it both ways. If effects as large as the early small studies were real and stable, a single session would show them almost every time, and anyone could confirm micro-PK in an evening. If the effect is PEAR's size, it adds 4 bits to a session that chance moves by 100, and no personal series can find it.

### Why the number of sessions must be fixed first

A random walk crosses any line if you wait. If you check after every session and stop at the first p < .05, the chance of a false "success" is 14 % with 5 sessions, 22 % with 20 and 31 % with 100, instead of 5 % (*computed* by simulation). So write down the number of sessions before the first one, as the guide asks, and analyse once at the end ([EXPERIMENTS.md](EXPERIMENTS.md)).

### What the app cannot rule out

- **Selective reporting.** Runs are stored on the phone. Nothing stops you from discarding a dull series; the guide's own caution says so.
- **Timing.** You press the button that starts each trial. A believer in decision augmentation and a sceptic will both point out that the start time is yours.
- **The control block comes first.** It is not interleaved, so it cannot detect a drift that begins later. The high-minus-low difference carries the test.
- **The software path.** Bits pass through the firmware, Bluetooth or USB, and the app before they are scored. The raw bytes of every trial are kept in the export so that someone else can re-score them.

### Honest expectations

- **Expect chance.** A z between −2 and +2 is what 19 sessions in 20 give with no effect at all.
- **One striking session is not evidence.** Count it as one of the planned sessions and go on.
- **Nulls are useful.** Export the runs and keep them with your plan.

No stimulation is involved in this guide. If you add a program, read [SAFETY.md](SAFETY.md) first.
