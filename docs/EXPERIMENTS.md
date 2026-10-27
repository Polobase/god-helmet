# Testing it honestly: blinded sessions and psi trials

The reported God-Helmet effects come from Persinger's laboratory. The only claimed partial positive from an unconnected group is weak ([Tinoco & Ortiz 2014](https://www.jcer.com/index.php/jcj/article/viewFile/361/386)). The best independent double-blind test found no effect of the field. Personality traits, not the field, predicted who reported a presence ([Granqvist et al. 2005](https://doi.org/10.1016/j.neulet.2004.10.057)). A helmet with no field at all produces "extraordinary experiences" in people who expect them ([Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/)). So you learn nothing from this device unless you remove your own knowledge of what it is doing, and decide in advance how you will judge the result.

This page shows how to do that with the app. It covers:
- blinded real/sham sessions, and how to check that the blind held;
- copying the published independent tests;
- remote-viewing, ARV and telepathy trials, and ganzfeld-like settings;
- judging, statistics and the number of trials you need;
- the classic pitfalls, pre-registration and the traits worth recording.

The science is in [RESEARCH.md](RESEARCH.md) and the history in [HISTORY.md](HISTORY.md). Read [SAFETY.md](SAFETY.md) before any session.

## Two questions, kept apart

| Question | Comparison | A positive answer needs |
|---|---|---|
| Does the field do anything? | Real vs sham, everything else identical | Real differs from sham, and the blind is shown to hold |
| Is there anomalous information transfer (psi)? | Hits vs chance | More hits than chance in a pre-registered series, with leakage ruled out |

A psi score above chance says nothing about the helmet. A field effect on psi shows only as **real better than sham** on the same task.

The evidence words are the project's scale ([PRESET_FORMAT.md](PRESET_FORMAT.md)): **established** (independent replication), **single-lab**, **claim** (author or vendor statement), **anecdote**, **unverified**.

## Blinded real/sham sessions

### What the helmet keeps identical

When you tick **Blind**, the helmet's hardware random generator picks real or sham (50/50) at the start of the session. The firmware then treats both arms the same way:

| Item | Real | Sham |
|---|---|---|
| Arming switch | Closes at the start | Closes at the start |
| Engine | Computes the waveform at 2 kHz | Computes the same waveform |
| Coil drive | The waveform | Held at 0 V (DAC mid-scale) |
| Status LED, timers, fades, phase names | Normal | The same |
| Live coil levels in the app | Withheld | Withheld |
| Log entry | Condition "hidden" until you rate | The same |

The helmet cannot hide everything:
- sound, vibration or warmth from the coils, if there is any (see *Checking the blind* below);
- a phone magnetometer or compass held near a coil;
- a power bank that displays its output current. Cover the display.

The firmware does not measure coil current. Check the field with a magnetometer before and after a series ([CALIBRATION.md](CALIBRATION.md)), never during a blind session. Granqvist's group checked their equipment before and after their study in the same way ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)).

### Running a blinded series

1. **Plan first.** Write down the number of sessions, the program and the outcome (see *Pre-registration* below).
2. **Traits on an earlier day.** Run **Guides → Enrollment battery (one time)** at least a day before the first session ([QUESTIONNAIRES.md](QUESTIONNAIRES.md)).
3. **Start the session** in one of two ways:
   - **Programs** tab: choose a program, tick **Blind**, press **Start**.
   - **Guides → Blinded helmet session with questionnaires**. It asks about expectations, rests 4 min, runs `presence-right` blinded for 30 min, then collects a free report, the `state-post` checklist and a real/sham guess before the reveal ([GUIDES.md](GUIDES.md)).
4. **Rate before you look at anything.** Write the free report first, then the ratings, then your guess. In the **Log** tab a blind session stays "hidden" until you save a 0–10 rating and notes.
5. **Export.** Log tab → **Export JSON**; Guides tab → **Export JSON** under your runs.

Tips:
- Same time of day, same room, same expectations in every session.
- Decide the number of sessions in advance and count every one.
- A friend can choose and start the program, so you don't know which pattern runs. The app shows the program name during the session and in the Log, so don't look at the screen, and write your ratings on paper before you open the Log.

### Who knows what

Granqvist's group split the roles. One experimenter met the participants and did not know the condition. A second assigned the conditions and never met anyone ([Granqvist 2004, letter of 27 Nov](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+1.htm)). With the Blind option the helmet takes the second role. Nobody in the room needs to know the condition.

Persinger's lab defined its own studies as blind to the hypothesis: subjects were recruited for a "relaxation study", and the lab said its experimenters did not know which pattern was applied ([Persinger & Koren 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm)). Granqvist objected that this is not blinding to the condition ([Granqvist 2004, letter of 27 Nov](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+1.htm)). The Blind option gives condition blinding. A helper who chooses the program adds hypothesis blinding.

### The right control

Compare **real vs sham, both with the helmet on**. Never compare a session with the helmet against a session without it. In Maij & van Elk's study, people had more extraordinary experiences while wearing the inert helmet than after it was taken off, though they were sensory-deprived in both conditions ([Maij, van Elk & Schjoedt 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf)).

### Randomisation and the number of sessions

- Blind flips a fresh coin for every session, so the split is not balanced. About 1 in 9 series of 20 sessions splits 6/14 or worse (computed). Analyse what you got. Don't add or drop sessions to balance it.
- To compare ratings between the arms, fix the test in advance, for example a Mann–Whitney or permutation test on the 0–10 ratings. The app does not compute it; use the Log export.
- Sessions needed per arm (two-sided α = .05, power .80, two-sample t-test, computed):

| True difference (Cohen's d) | Sessions per arm |
|---|---|
| 1.0 (very large) | about 17 |
| 0.8 (large) | about 26 |
| 0.5 (medium) | about 64 |

Persinger & Koren's own figures imply a large difference. They state that effective fields give sensed-presence scores of 0.8 or more against 0.3 (SD 0.5) for sham ([Persinger & Koren 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm); claim). If the field groups have the same SD, that is about d = 1 (computed). One person at no more than one session per 72 hours ([SAFETY.md](SAFETY.md)) needs months for 30+ sessions. A group with one session per person, as in Granqvist's design, is faster.

## Checking the blind

A blinded result means little until you have shown that people cannot tell the arms apart. This project's research found no published measurement of sound, vibration or heat from God-Helmet-type coils (unverified: a search that finds nothing is not proof that nothing exists). For this hardware the question is open, so measure it.

### Before the first blinded session: a cue test

Do this with the helmet on a foam head, a cushion or a bowl, not on a person.

1. Use the program and intensity you plan to test.
2. Put a phone next to a coil. Record the audio spectrum and the acceleration with phyphox, the free phone app that [CALIBRATION.md](CALIBRATION.md) uses for the field. Record about a minute of the program and a minute of the `sham` program. Look for any peak present only in the real run, for example at the 2 kHz update rate or at the pattern's pulse rate.
3. Heat is not expected to be a cue: coil dissipation is about 0.1 mW at full current ([SAFETY.md](SAFETY.md)).
4. **Listening test.** A helper prepares a random list of 20 real and sham runs (coin flips). For each run the helper starts the program or the `sham` program and stops it about 30 s after the 10-s fade-in. A listener who doesn't see the screen sits with an ear close to the coils and guesses each run. Chance is 10 correct. 15 or more correct is p = .021 (exact binomial, computed); 14 is p = .058. The app's 72-hour warning will appear; that rule is for wearing the helmet, and nobody wears it here.
5. If the listener can tell, find the cause, or mask it with the same steady noise in both arms. Then repeat the test.

### After every session: the guess

- The `blinding` questionnaire asks "real, sham or don't know?" and how sure you are, before the reveal ([QUESTIONNAIRES.md](QUESTIONNAIRES.md)). It is built into the guides **Blinded helmet session with questionnaires**, **Helmet real vs sham with a psi task**, **Psi trial with covariates (ganzfeld-style)** and **Extended remote viewing (ERV) with blinded arms**.
- For sessions started from the Programs tab, write your guess into the Log notes before you save the rating.
- If someone else ran the session, record their guess too.
- Ask what side effects people noticed. Maij and colleagues used this as their suspicion check ([Maij, van Elk & Schjoedt 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf)).

### Reading the Bang blinding index

The app's code has a function, `bangIndex()`, that computes the Bang Blinding Index per arm, with its standard error: (correct − incorrect guesses) / all answers, with "don't know" in the denominator ([Bang, Ni & Davis 2004](https://europepmc.org/abstract/MED/15020033)). No tab shows it yet; apply it, or the same formula, to the exported guesses and conditions.
- 0 is consistent with intact blinding.
- 1 means everyone guessed right; −1 means everyone guessed the opposite.
- With few sessions the standard error is large. Look at the interval, not just the estimate.
- A correct guess can also come from a real effect, so unblinding and efficacy are confounded. If the real arm's index is clearly above 0, repeat the cue test before you believe anything.

## Replicating the independent tests

Three kinds of independent test exist:
- **Granqvist et al. 2005:** equipment lent by Persinger's lab, field vs sham, double-blind.
- **Gendle & McGrath 2012:** a commercial 8-coil Shakti, field vs sham.
- **Sham-helmet studies:** no field at all; they measure expectancy.

This project's research found no independent, pre-registered, double-blind test of the field itself published between 2015 and 2026 (a search-limited finding). The pre-registered studies of that period applied no field ([Maij, van Elk & Schjoedt 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf)). A careful replication with this app would fill that gap.

### Granqvist et al. 2005 (Uppsala)

The Uppsala group borrowed a driver box from Persinger's lab. The paper itself is closed access, so most details below come from the published correspondence.

| | Uppsala 2005 | In this app |
|---|---|---|
| Design | Double-blind, between groups: 43 field, 46 sham ([Khamsi 2004](https://web.archive.org/web/20061205053735/http://www.nature.com/news/2004/041206/pf/041206-10_pf.html)) | Blind option; one session per person, or a blinded self-series |
| Exposure | 15 min of the "Thomas" pattern over the right hemisphere, then 15 min of burst-firing over both ([Persinger 2004, letter of 22 Dec](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+G.htm)) | Preset `persinger-granqvist-2005-replication`, 15 + 15 min |
| Software | Koren's Complex v1.15, cycles set to 9000, stopped by hand at 15 min ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)) | Every point timed on the firmware's fixed 0.5 ms clock |
| Field and sites | 3–7 µT, coils "just above and in front of the ears" ([Khamsi 2004](https://web.archive.org/web/20061205053735/http://www.nature.com/news/2004/041206/pf/041206-10_pf.html)) | 5 µT (the default field ceiling) at FT7, T7, FT8 and T8 of layout B ([PLACEMENT.md](PLACEMENT.md)); the sites are an inference |
| Setting | About 2 m² isolation chamber, blindfold ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)); earplugs, according to the Laurentian side only ([Persinger & Koren 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm)) | Small, quiet, dim room, blindfold |
| Instructions | Told that the study concerned the effect of complex weak magnetic fields on experiences and feelings ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)) | Use the same neutral wording; don't drop it to "improve" the effect |
| Outcome | Persinger's EXIT checklist in Swedish, scored 0/1/2 ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)), plus a mysticism scale | Not in the app. The `state-post` presence item (0–10) is the nearest; its scores are not comparable |
| Predictors | Absorption, temporal-lobe signs, New Age orientation ([Granqvist et al. 2005](https://doi.org/10.1016/j.neulet.2004.10.057)) | Enrollment battery: IPIP Imagination stands in for absorption. It has no temporal-lobe-signs or New Age scale; SSS and SenPQ measure other traits |

**What they found.** The field had no effect, overall or in highly suggestible people. The traits predicted sensed-presence and mystical reports ([Granqvist et al. 2005](https://doi.org/10.1016/j.neulet.2004.10.057); single-lab, independent of Persinger). In the same data, religiousness predicted mystical experiences with a religious quality. The authors read the pre-session religiousness questionnaires and the sensory deprivation as a prime ([Granqvist & Larsson 2006](https://pubmed.ncbi.nlm.nih.gov/16967739/)).

**The dispute.** Persinger and Koren made these objections (claims):
- the software's point timing was distorted on a fast Windows computer;
- 15 min was too short; they use "at least 20 min and usually 30 to 40 min per pattern" ([Persinger 2004, letter of 22 Nov](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm));
- the room and the earplugs interfered;
- both Swedish groups scored M = 0.3 (SD 0.5) on sensed presence, the level of Laurentian sham groups, so the field group "never received an effective field configuration" ([Persinger & Koren 2004](https://web.archive.org/web/20050223022113/http://laurentian.ca/neurosci/News/Dec_news.htm), the lab's posted text of its letter [Persinger & Koren 2005](https://doi.org/10.1016/j.neulet.2005.03.060); the printed wording is closed access and was not checked).

Granqvist replied that Persinger had recommended both the 15-min exposure and the cycle setting, that blindfolds were used, and that the equipment was checked before and after the study ([Granqvist 2005, letter of 5 Jan](https://web.archive.org/web/20101112203814/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+A.htm)). Persinger's lab later re-analysed 19 of its own experiments (407 people) and concluded that the field pattern, not suggestibility, predicted presence ([St-Pierre & Persinger 2006](https://pubmed.ncbi.nlm.nih.gov/16861170/); single-lab claim). Neither side's account of the timing or the duration has been checked independently.

**What the app can test.**
1. **Copy arm.** `persinger-granqvist-2005-replication` vs sham. The firmware's fixed timing removes the "distorted timing" objection for the signal this preset plays. If this copy is also null, that objection loses force, although the preset's point tables are not Koren's (see below).
2. **Duration arm.** A longer two-phase program, for example `persinger-saroka-2015-sensed-presence` or `god-helmet-classic` (30 + 30 min each), vs the same sham. This tests Persinger's duration objection.
3. **Primary outcome:** sensed presence, real vs sham. Persinger and Koren's sham-level prediction is the sharpest testable claim in the dispute.

**What it cannot copy.**
- The Complex v1.15 point tables were never published. The preset plays the Thomas table from Persinger's patent and a stand-in burst (see the preset notes in the **Programs** tab).
- Koren's 2003 instructions describe a sequencer cycling between the solenoids ([Koren 2003](https://web.archive.org/web/20101112203802/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+5.htm)). The preset drives fixed coil pairs, and the coil count per side is not published.

### Gendle & McGrath 2012

**What they did.** 37 people received 30 min of field or sham from the 8-Coil Shakti "amygdala signal" over both temporal lobes and rated 54 colour photographs. The field had no effect on the ratings and did not interact with the pictures' emotional valence ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/); single-lab null). The vendor's reply supplies the details: bilateral temporal placement, a default of up to about 1 µT, an onboard sound card, daytime sessions, one session each ([Murphy 2012](http://www.innerworlds.50megs.com/Gendle_Shakti/8-Coil-Shakti-Gendle-&-McGrath.htm)).

This was a test of emotional responses to pictures, not of sensed presence. A review in the same year summarised it as "no significant difference in emotional state" ([Aaen-Stockdale 2012](https://www.bps.org.uk/psychologist/neuroscience-soul)), which is not what was measured. Word your own results as precisely as the measure.

**The vendor's objection (claim).** Murphy says the study used the weakest configuration. For mood he recommends the "feelgood" session: two signals with 4-s pauses over the frontal lobes, once a week for six weeks ([Murphy 2012](http://www.innerworlds.50megs.com/Gendle_Shakti/8-Coil-Shakti-Gendle-&-McGrath.htm)).

**In the app.**
- **Published arm:** `shakti-alternate` (amygdala signal on both temporal crosses, 30 min, 1 µT) with Blind. The sources do not say which channel-alternation mode the study used.
- **Vendor arm:** `murphy-shakti8-feelgood-1phase-frontal` (its 30-min version) with Blind, weekly for six weeks. Use a mood measure such as the `state-post` valence item as the primary outcome.
- The app has no picture-rating task. To copy the published outcome, prepare your own fixed photo set and rating sheet before the first session.

### Sham-helmet studies (Maij, van Elk and others)

| Study | Design | Result |
|---|---|---|
| [Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/) | Placebo stimulation; expectancy manipulated within subjects | Expectancy changed extraordinary experiences; absorption predicted how often and how strongly they came |
| [Maij, van Elk & Schjoedt 2019](https://pure.uva.nl/ws/files/34902680/The_role_of_alcohol_in_expectancy_driven_mystical_experiences.pdf) | Pre-registered, 193 festival-goers. A skate helmet wired to a dummy box with a flickering light, no generator; 15 min with eyeshade and in-ear white noise | Alcohol did not raise responsiveness; self-identified spirituality did |
| [Simmonds-Moore et al. 2017](https://doi.org/10.1177/0276236617749185) | Inert helmet; 32 sceptics, 35 believers; a baseline session (without the helmet, by the [Psi Encyclopedia's](https://psi-encyclopedia.spr.ac.uk/articles/christine-simmonds-moore/) account), then morning and afternoon sham sessions, 30 min each in a Faraday chamber | No effect of condition on the state inventory (PCI); believers reported more exceptional experiences |

Together these establish that expectancy and traits produce helmet experiences with no field. Maij and colleagues made the sham credible with screening questions, a short literature summary, a video, sham heart-rate and skin-conductance leads and a vomit bowl on the table. Simmonds-Moore's sessions ran in the morning and afternoon, so they cannot test the vendors' evening advice.

A cautionary case: van Elk reported that the data of an unpublished student thesis with a sham helmet had been fabricated. Almost all logfiles had been generated on the same date, although a single session took about 1.5 hours ([van Elk 2019](https://doi.org/10.1080/10508619.2019.1687189)). Keep raw exports with their timestamps.

**In the app.** Run three conditions in the same setting:

| Condition | How | What it tests |
|---|---|---|
| Helmet off | Separate sessions with the same eyeshade, noise and length, no helmet | Baseline |
| Helmet on, sham | Blind sessions in which the helmet picked sham | Expectancy (sham vs off, Maij's comparison) |
| Helmet on, real | Blind sessions in which the helmet picked real | The field (real vs sham) |

- For the 15-min version, press **Stop** in the app at 15 min in every session, so both arms stop the same way. (The hardware STOP button is for emergencies; it cuts the coils without a fade.)
- Keep the instructions and any props identical across conditions.
- If you deceive other people about the sham, debrief them afterwards.

### Other independent work

- **Tinoco & Ortiz 2014.** A home-built 8-coil helmet from a group unconnected to Persinger, and the only claimed partial positive from such a group: 10 field vs 10 sham, 100 Hz pulses stepping every 250 ms, 20 min. Participants were told it was a God Helmet. Nothing differed during the sessions; differences appeared only in post-session word statistics, partly at p < .10. The paper's field strengths contradict each other ([Tinoco & Ortiz 2014](https://www.jcer.com/index.php/jcj/article/viewFile/361/386); single-lab). Preset: `persinger-tinoco-ortiz-2014-replication`.
- **French et al. 2009.** A room, not a helmet: 79 people, field × infrasound. Only temporal-lobe-signs scores predicted reported sensations. The authors state that the study was not double-blind ([French et al. 2009](https://research.gold.ac.uk/id/eprint/4209/2/French_et_al_Haunt_accepted.pdf)).

## Remote-viewing trials

### The trial flow in the app

**Before you start:**
- Ask someone else to build the **target pool** (see below). The builder exports it, and you import the file on your phone (Targets → Import pool file). The Targets tab hides the pictures until someone presses **Show pictures**; never press it yourself.
- **Decide the number of trials in advance** (see *How many trials you need* below) and write it down. Analyse only when done.

**A trial:**
1. **Experiment → New trial.** Mode "Remote viewing", stimulation e.g. `remote-viewing`, **Blind** ticked, then **Create trial**. Or choose "None" for a psi-only series.
2. The helmet:
   - picks a set, a target in it and real/sham, all with its hardware random generator;
   - shows a **SHA-256 commitment** of those choices plus a secret nonce. Screenshot it if you like.
3. During or after the stimulation, write and sketch your impressions:
   - shapes, colours, textures, temperatures, feelings;
   - raw impressions, not names. CRV calls such named guesses "analytic overlay" ([CRV working paper 1985](https://documents3.theblackvault.com/documents/stargate/pdfs/CIA-RDP96-00788R001000400001-7.pdf)).
4. **Lock** the response. Its hash goes to the helmet, which also records the time, Kp/ap and local sidereal time.
5. **Judge.** The helmet shuffles the pictures of the set into a new order. Give every picture a different rank (1 = best match). Better: hand the phone to an independent judge (see *Judging* below).
6. **Reveal.** The helmet shows the target, the condition, the nonce and the target's rank. The page checks three things:
   - the commitment matches the revealed choice;
   - the picture pool is unchanged since the trial started;
   - your response is unchanged since you locked it.

Nothing gets deleted. Aborted trials stay in the list as *aborted*, so you can't drop bad runs without noticing.

### Building the target pool

| Rule | Why |
|---|---|
| Sets of 4 or 5 pictures, **all the same size** | The helmet draws from every usable set (2–8 pictures). Mixed sizes mix chance rates |
| Pictures within a set as different as possible | Ganzfeld standards ask for 4 "orthogonal" targets ([KPU 1024](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_Registry_1024.pdf)) |
| Sets matched in topic range, size and emotional tone | SAIC's first video-clip pool scored ES 0.000 against .248 for photos. After the video pool was rebuilt to match the photo pool in topic, size and affect, a 1993 follow-up scored ES .55 with both target types ([Lantz, Luke & May 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100002-4.TXT); single-lab) |
| Many sets, drawn with replacement | In the PRL autoganzfeld, hit rates were higher for targets used three or more times (.36 vs .27) ([Hyman 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%237%20179/Part0001/CIA-RDP96-00789R003200100001-5.TXT)). Early SRI series chose sites without replacement, a documented flaw ([Utts 1995](https://www.ics.uci.edu/~jutts/air)) |
| Built by someone else | Then you cannot recognise or prefer your own picks |
| Pictures you have the rights to use | The pool file is shared between phones |

SAIC also reported that response quality tracked the "Shannon entropy gradient" of the target pictures ([May, Spottiswoode & James 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100004-2.TXT)). Many of its analyses were post hoc, and the static-picture correlation fell to non-significance after the pictures were re-digitised (single-lab). Don't build a pool around it.

Note the **pool fingerprint** shown in the Targets tab in your plan. The reveal checks it.

### SRI/SAIC free-response design

**What it is.** A viewer describes a target picture that they will see later as feedback (for 15 min in one SAIC experiment). A judge who doesn't know the target ranks it against decoys from the same pack ([Utts 1995](https://www.ics.uci.edu/~jutts/air)). In SAIC's Experiment 1, five viewers each did 40 trials ([Lantz, Luke & May 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100002-4.TXT)).

**In the app.** Use the Experiment tab with sets of 5, or **Guides → Photo-target trial (free response)**. That guide has a "plan the series" step, a cool-down, 20 min to describe, a sketch, lock, blind ranking and the reveal. **Outbound beacon (live target, two people)** adapts SRI's real-time protocol, in which a beacon person visits a randomly drawn local site.

**The evidence.**
- Utts gives effect sizes of .209 for 770 SRI sessions and .230 for 455 SAIC sessions ([Utts 1995](https://www.ics.uci.edu/~jutts/air); single-lab).
- Hyman accepted that SAIC's effect sizes were unlikely to be chance. He pointed out that Ed May was the sole judge of all SAIC's free-response experiments, with the same viewers and targets throughout. He called for new viewers, new pools and several independent judges ([Hyman 1995](https://www.ics.uci.edu/~jutts/hyman.html)).
- The 1995 AIR evaluation found a statistically significant laboratory effect, but one that could not be separated from the judge, the targets or the method. In operations, "in no case had the information provided ever been used to guide intelligence operations" ([AIR 1995](https://nsarchive2.gwu.edu/NSAEBB/NSAEBB438/docs/doc_57.pdf)).
- In a pre-registered study of 44 experienced viewers, judges picked the correct target 10 times (23 %, chance 25 %) ([Lyke, KPU 1055](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1055_Results.pdf)).

### CRV as a response format

Coordinate Remote Viewing (CRV) was developed for a US Army intelligence unit. It is described here as documentary history and used in the app only as a way to structure a response to a picture target.

The declassified 1985 working paper sets out the session ([CRV working paper 1985](https://documents3.theblackvault.com/documents/stargate/pdfs/CIA-RDP96-00788R001000400001-7.pdf)):

| Stage | Content |
|---|---|
| I | A quick pen mark (ideogram), then its feel or motion (A) and a first one-word guess (B) |
| II | Sensory words: textures, colours, temperatures, sounds, smells |
| III | Dimensions, the "aesthetic impact", sketches |
| IV | A matrix with one column per kind of data, including a column for analytic overlay |
| V | Queries on single words from the matrix |
| VI | Three-dimensional modelling |

Analytic overlay, aesthetic impact and confusion are declared as "breaks" and written down. The paper defines three session classes. In Class C (training) the monitor knows the target and gives feedback during the session, so it is not evidence. In Class B the monitor is blind and feedback comes after the session; the paper treats these as the sessions to which statistics apply. Class A is operational.

**In the app:** **Guides → CRV guided session (Stages I-VI)**. The helmet commits to a target first, and you work through stage worksheets; an optional blinded helmet arm runs during the cool-down. The self-marking step at the end is for training only. The blind rank you give before the reveal is the result.

**The evidence (claim).** A 1983 programme report says one viewer's rated "intelligence value" (0–3 scale) rose from a mean of 1.21 to 2.75 with Stage IV. The ratings were uncontrolled ([Swann 1983 report](https://documents3.theblackvault.com/documents/stargate/pdfs/CIA-RDP96-00788R001800100001-2.pdf)). No controlled data show that the CRV structure improves accuracy.

### Associative remote viewing (ARV)

**What it is.** Two very different pictures are mapped to the two outcomes of a future event. The viewer describes the picture they will be shown after the outcome. A judge rates the description against both pictures; the better match is the prediction. Without a clear winner the trial is a "pass" and is not scored ([Katz et al. 2021](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1034_Published_Results.pdf)).

**The evidence.**
- 7 of 7 stock-market predictions, but the tasker who knew both pictures was among the judges ([Smith, Laham & Moddel 2010](https://www.colorado.edu/faculty/moddel/sites/default/files/attached-files/smith_sse10_abstract.pdf); single-lab).
- 38 of 48, but the monitors knew both photos during the sessions and judged them by "prima facie" matching ([Müller, Müller & Wittmann 2019](https://www.anomalistik.de/images/pdf/zfa/zfa2019_3_326_mueller-mueller-wittmann.pdf); single-lab).
- When 9 judges re-judged 86 completed ARV trials, all of them agreed on only 6.9 % of trials. New judges averaged 51.5 % hits against 65 % for the original judges. One applied currency-trading project lost $52,186 ([Katz et al. 2021](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1034_Published_Results.pdf)).

**In the app:** **Guides → ARV binary prediction**.
- It needs a set of exactly two pictures. The helmet commits to the picture-to-outcome mapping before you start.
- Equal ratings, or a margin under 2 points on the 0–7 scale, count as a pass.
- You enter the real outcome later in the run summary, which then reveals and scores the trial.
- ARV trials are left out of the Experiment tab's statistics, because their rank means "predicted A", not a hit ([GUIDES.md](GUIDES.md)).
- Score with the exact binomial test against 50 % on the non-pass predictions. Never use ARV for money or for decisions about people.

## Telepathy trials

**The evidence.**
- Persinger, Koren & Tsang stimulated one partner of four sibling pairs. They reported EEG changes in the unstimulated partner during one of six field configurations ([Persinger, Koren & Tsang 2003](https://pubmed.ncbi.nlm.nih.gov/14738355/); single-lab).
- In a "shared memory" design with rotating fields, 5 of 7 pairs matched above chance, and the effect correlated with geomagnetic activity (rho = −.72) ([Persinger, Cook & Tiller 2002](https://doi.org/10.2466/pms.2002.95.2.531); single-lab). A study from the same lab found the opposite sign for the geomagnetic K index ([Booth, Charette & Persinger 2002](https://doi.org/10.2466/pms.2002.95.2.555)).
- Whether a sender matters at all is unclear. SAIC found no difference with or without a sender ([Lantz, Luke & May 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100002-4.TXT)). Edinburgh scored 34 % both with a known sender and with no sender ([Utts 1995](https://www.ics.uci.edu/~jutts/air)).

**In the app:**
- Mode **Telepathy**. The `telepathy-sender` program plays the rotating-field configurations of the paired-person studies for the partner who wears the helmet. Putting the helmet on the sender is this project's trial design; putting it on the receiver is another choice. Neither is a published sender/receiver protocol.
- The sender uses a second phone in another room, with the same pool imported (Targets → Import pool file). That phone connects to the helmet as a second app (the helmet accepts two), then **Experiment → Sender** → trial number. It shows the target only while the trial is open, that is, until the receiver locks the response.
- The receiver writes and sketches in the main UI, then locks, judges and reveals as above.
- **Guides → Shapes and colours telepathy test (two people)** runs a simpler blinded version.

**Leakage rules:**
- Put the sender in a room that is not next to the receiver's. Acoustic tiles absorb sound; they do not isolate it. That was the suspected weak point of the PRL sender room, where leakage was possible but not demonstrated ([Wiseman, Smith & Kornbrot 1996](https://metabunk.org/attachments/auditory-leakage-autoganzfeld-pdf.60688)).
- The sender must not come back, call or message until after the reveal. Turn messaging off on both phones.
- Any connected app can ask for the sender view while a telepathy trial is open, so the receiver must not open it. For stricter tests, a third person runs the sender phone. The helmet refuses the sender view for remote-viewing trials.
- Both partners must know about and agree to the experiment.

## Ganzfeld-like settings

The ganzfeld is a mild sensory-deprivation setting for free-response trials. The pre-registered ganzfeld meta-analysis defines it as ([KPU 1024](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_Registry_1024.pdf)):
- seated or reclined in a quiet room;
- an even red visual field (translucent eye shields, red light or a VR headset);
- white noise or similar;
- a 20–40 min impression period;
- 4 orthogonal candidates, a target room that is not next door, and target-blind judging with no ties;
- the target revealed only after the judgement is recorded, and duplicate tamper-evident records.

The Princeton autoganzfeld used 14 min of relaxation and 30 min of ganzfeld. It scored 106 hits in 329 sessions (32 %, chance 25 %) ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf); single-lab, with the critiques below).

The setting alone changes experience. In 19 people, 25 min of eye shields and white noise at about 80 dB produced a mild altered state with imagery and lowered thalamus–visual cortex coupling ([Schmidt et al. 2020](https://doi.org/10.1038/s41598-020-75019-3)). A 10 Hz red flicker ("Ganzflicker") produced more simple hallucinations ([Shenyan et al. 2024](https://doi.org/10.1038/s41598-024-52372-1)), but flicker is a seizure risk. The app never uses visual flicker ([GUIDES.md](GUIDES.md)); never combine it with the helmet. Because the setting produces imagery and presences on its own, only **real vs sham inside the same setting** can show a field effect.

**In the app:** **Guides → Psi trial with covariates (ganzfeld-style)**.
- Belief and state ratings first, then 10 min of progressive relaxation.
- 30 min of mentation with the eyes covered (halved ping-pong balls under a red light, or a red-tinted mask) in steady pink noise.
- Then a written report, lock, blind ranking, a confidence rating, the real/sham guess and the reveal.
- An optional blinded helmet arm (`remote-viewing`, ring layout) runs during the mentation.

**Fit:**
- Layout B is a 2 × 2 grid centred about 2 cm above each ear top, so its lower coils sit where over-ear headphone cups press. Use in-ear phones, or the ring layout.
- The ring layout has a coil on the forehead (Fpz). Keep it clear of the eye covers ([PLACEMENT.md](PLACEMENT.md)).
- Keep the noise at a comfortable level, at or below the WHO-based limits in [GUIDES.md](GUIDES.md).

## Judging

- **Who judges.** In the PRL autoganzfeld the receiver judged ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)). An independent judge is stronger. With this app, lock the response, then hand the phone to a judge who doesn't know the target, the condition or (ideally) the viewer ([Hyman 1995](https://www.ics.uci.edu/~jutts/hyman.html)). The helmet keeps the target until the ranks are in.
- **No prompting.** In the PRL autoganzfeld the experimenter helped the receiver judge in 165 of 354 trials ([Wiseman, Smith & Kornbrot 1996](https://metabunk.org/attachments/auditory-leakage-autoganzfeld-pdf.60688)). Prompting interacted with the hit rate ([Hyman 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%237%20179/Part0001/CIA-RDP96-00789R003200100001-5.TXT)). Nobody who has seen the target may talk to the judge before the ranks are in.
- **Clean transcripts.** Marks and Kammann argued that SRI's first transcripts contained cues, such as dates and references to earlier sessions, that let judges match them ([Marks & Kammann 1978](https://www.nature.com/articles/274680a0), as summarised by [Utts 1995](https://www.ics.uci.edu/~jutts/air)). Remove dates and references to other trials before an outside judge reads a response.
- **Several judges.** The app stores one set of ranks per trial. Decide in advance whose ranks count. Collect the other judges' ranks on paper before the reveal and report how often they agree. ARV judges agree far less than people assume ([Katz et al. 2021](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1034_Published_Results.pdf)).
- **Structured scoring (optional).** SRI's 1983 form splits a response into concepts, scores each against a pre-defined list of target elements, and converts the result to a 0–5 match score. It was not validated: its demonstration matched 3 of 4 targets ([SRI 1983](https://documents3.theblackvault.com/documents/stargate/pdfs/CIA-RDP96-00788R001800080001-5.pdf)).
- **No ties.** The app requires a different rank for every picture, as ganzfeld standards do ([KPU 1024](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_Registry_1024.pdf)).

## Statistics

### What the app reports

The Experiment tab (and `tools/trial_stats.py`) report, for all revealed trials and separately for active, sham and no stimulation:

| Measure | Meaning | Chance level |
|---|---|---|
| First-place hits | Target ranked 1st | Sum of 1/N over trials (N = set size). Exact Poisson-binomial p-value, one-sided |
| Mean rank | Average target rank | (N+1)/2 |
| Rank z | Σ((N+1)/2 − rank) / √Σ((N²−1)/12), normal p-value, one-sided | 0; positive = better than chance |

`tools/trial_stats.py` also prints the active − sham difference in standardised rank score, with a two-sided z. Its Kp and sidereal-time splits are labelled exploratory. The phone that ran the ARV guide marks its ARV trials in the export (`"arv": true`), and the script leaves them out; trials exported from another phone are not marked, so remove those by hand.

Examples (exact binomial, computed):
- 30 trials with 5 pictures: chance gives 6 hits. You need 11 for p < .05 (p = .026); 10 hits gives p = .061.
- 30 trials with 4 pictures: chance gives 7.5 hits. You need 13 (p = .022).

**Effect size.** With equal set sizes, the rank z divided by √(number of trials) is the per-trial effect size. For 5-picture sets this equals Utts's (3 − mean rank)/√2; ES 0.2 corresponds to a mean rank of 2.72 ([Utts 1995](https://www.ics.uci.edu/~jutts/air)).

### Effect sizes in the literature

| Database | Result | Status |
|---|---|---|
| PRL autoganzfeld 1983–89 | 106/329 hits, 32 % vs 25 % ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)) | Single-lab; leakage and target-reuse critiques |
| 30 later ganzfeld studies | ES 0.013, not significant ([Milton & Wiseman 1999](https://pubmed.ncbi.nlm.nih.gov/10414223/)) | Failed replication |
| 29 ganzfeld studies 1997–2008 | ES 0.142 ([Storm, Tressoldi & Di Risio 2010](https://doi.org/10.1037/a0019457)) | Claim; disputed ([Hyman 2010](https://doi.org/10.1037/a0019676)) |
| 78 ganzfeld studies 1974–2020 | ES .074, about 6.8 points above chance; median power .088 ([Tressoldi & Storm 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11134153/)) | Claim; proponent meta-analysis |
| 78 post-1985 ganzfeld experiments, bias model | Questionable research practices could explain about 60 % of the effect; the best-fitting model still left a small significant effect ([Bierman, Spottiswoode & Bijl 2016](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0153049)) | Simulation |
| Pre-registered ganzfeld precognition, 240 selected participants | 72/240, 30 %, p = .043 ([Watt, KPU 1074](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1074_ResultsSummary.pdf)); the follow-up with the best scorers gave 15/58 ([KPU 1088](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1088_ResultsSummary.pdf)) | Single-lab, pre-registered |
| SRI and SAIC remote viewing | ES .209 (770 sessions) and .230 (455) ([Utts 1995](https://www.ics.uci.edu/~jutts/air)) | Single-lab; one judge for all SAIC free-response work |
| Experienced remote viewers, pre-registered | 10/44, 23 % vs 25 % ([Lyke, KPU 1055](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1055_Results.pdf)) | Single-lab null |
| ARV re-judged | 51.5 % vs 50 % chance with new judges ([Katz et al. 2021](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1034_Published_Results.pdf)) | Single-lab |
| Bem's precognition, multi-lab replication | 49.89 % vs 50 %, 37,836 trials ([Kekecs et al. 2023](https://doi.org/10.1098/rsos.191375)) | Multi-lab, pre-registered null |

### How many trials you need

Trials for 80 % power at one-sided α = .05 (exact binomial, computed; the rank-order rows use the normal approximation). Exact power rises in a sawtooth, so each number is the size from which power stays at or above .80; it first touches .80 a little earlier (for example 494 instead of 522):

| Design | Chance | Assumed true rate | Trials |
|---|---|---|---|
| 4 pictures, first-place hits | 25 % | 30 % | 522 |
| 4 pictures, first-place hits | 25 % | 32 % (PRL level) | 279 |
| 4 pictures, first-place hits | 25 % | 37 % | 102 |
| 5 pictures, first-place hits | 20 % | 30 % | 127 |
| 5 pictures, rank z | ES 0 | ES 0.2 | about 155 |
| 5 pictures, rank z | ES 0 | ES 0.385 | about 42 |
| ARV, non-pass predictions | 50 % | 60 % | 169 |
| ARV, non-pass predictions | 50 % | 65 % | 76 |

A 30-trial series at a true 32 % hit rate with 4 pictures reaches p < .05 only about 13 % of the time (computed). Bem and Honorton gave a similar estimate: about 1 in 6 for 30 trials at 34 % ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)). One person's series is a pilot. A confirmatory test needs hundreds of trials pooled across people.

### Bayes factors and stopping rules

- The Experiment tab reports one-sided p-values only (`tools/trial_stats.py` adds the two-sided active − sham test). Choose one-sided or two-sided before you start.
- If you pre-register a Bayes factor, compute it yourself and state the prior. Different defaults turned Bem's "significant" results into weak evidence ([Wagenmakers et al. 2011](https://doi.org/10.1037/a0022790); [Rouder & Morey 2011](https://doi.org/10.3758/s13423-011-0088-7)).
- Stopping early is valid only under a pre-registered sequential rule. The Transparent Psi Project stopped when the Bayes factor passed 25 in either direction under three priors ([Kekecs et al. 2023](https://doi.org/10.1098/rsos.191375)).

## Known pitfalls

| Pitfall | What happened | What to do with this app |
|---|---|---|
| Sensory leakage | The PRL sender room relied on sound-absorbing tiles, so acoustic leakage was possible (not shown), and the experimenter in contact with the receiver helped with judging ([Wiseman, Smith & Kornbrot 1996](https://metabunk.org/attachments/auditory-leakage-autoganzfeld-pdf.60688)) | In remote-viewing mode only the helmet knows the target until the reveal. In telepathy mode follow the leakage rules above |
| Judge bias | One judge for all SAIC free-response work ([Hyman 1995](https://www.ics.uci.edu/~jutts/hyman.html)); a tasker who knew both ARV pictures judged ([Smith, Laham & Moddel 2010](https://www.colorado.edu/faculty/moddel/sites/default/files/attached-files/smith_sse10_abstract.pdf)) | Independent judges who are blind to the target, the condition and the viewer; decide in advance whose ranks count |
| Optional stopping and selective reporting | Modelled questionable practices could explain about 60 % of the ganzfeld effect ([Bierman, Spottiswoode & Bijl 2016](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0153049)) | Fix N in advance. Look at the Results table only at your planned analysis point. Aborted trials stay counted |
| Target-pool design | Target reuse and position biases ([Hyman 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%237%20179/Part0001/CIA-RDP96-00789R003200100001-5.TXT)); pool "bandwidth" ([Lantz, Luke & May 1994](https://documents.theblackvault.com/documents/remoteviewing/stargate/STARGATE%20%231%20173/Part0003/CIA-RDP96-00791R000200100002-4.TXT)) | Large pool, equal set sizes, built by someone else. The helmet shuffles the display order |
| Manual randomisation | Manually randomised ganzfeld studies showed larger effects. Without them, and with omitted studies added, the Bayes factor fell from about 6 billion to at most 330 ([Rouder, Morey & Province 2013](https://doi.org/10.1037/a0029008)) | Let the helmet's random generator and commitment do it |
| Multiple testing | Hyman and Honorton's joint standards require correction for multiple analyses and a pilot/confirmatory label declared in advance ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)). Only pre-registered analyses count as confirmatory ([Wagenmakers et al. 2012](https://doi.org/10.1177/1745691612463078)) | One primary outcome. Hits vs rank z, real vs sham, Kp and sidereal-time splits, per-program or per-viewer results: pick one in advance; the rest is exploratory |
| Demand characteristics | Trait "phenomenological control" predicted reports in body-illusion tasks ([Lush et al. 2020](https://doi.org/10.1038/s41467-020-18591-6)) | Neutral instructions, a credible sham, suggestibility measured |
| Experimenter effects | A proponent found effects and a sceptic did not; in a joint study with separated roles neither did ([Schlitz et al. 2006](https://europepmc.org/abstract/MED/16848945)) | Record who ran each session and who judged it |
| Questionnaire priming | Religiousness questions before the session acted as a prime ([Granqvist & Larsson 2006](https://pubmed.ncbi.nlm.nih.gov/16967739/)) | Trait questionnaires on an earlier day |
| Data provenance | Fabricated sham-helmet data were found through logfile dates ([van Elk 2019](https://doi.org/10.1080/10508619.2019.1687189)) | Keep the raw exports; the helmet log is timestamped on the device |

## Pre-registration

**Why.** In the Koestler Parapsychology Unit's registry, 16 % of pre-registered confirmatory hypotheses were supported, against 46.6 % in non-registered papers of the same period ([Wiseman & Watt 2026](https://doi.org/10.7717/peerj.21360)). The European Journal of Parapsychology's 1976–1992 registered-report policy showed 8.4 % significant hypotheses in registered reports against 28.4 % in the others ([Wiseman, Watt & Kornbrot 2019](https://doi.org/10.7717/peerj.6232)). Both comparisons are observational, so they suggest, rather than prove, that flexible analysis inflates results.

**What to write down before the first trial or session:**
- the hypothesis and the **one** primary outcome (for example, first-place hits vs chance, or the presence rating real vs sham);
- the design: mode, program, Blind or not, set size, the pool fingerprint, who judges;
- the number of trials or sessions, and what happens to aborted ones;
- the test, one- or two-sided, and α; any Bayes factor with its prior;
- covariates (two or three at most) and the list of exploratory analyses;
- exclusion rules and the stopping rule.

The registry's first two years showed gaps in almost every initial submission, such as an unstated test direction or missing Bayesian priors ([Watt & Kennedy 2015](https://doi.org/10.3389/fpsyg.2015.00173)). Fill in those fields explicitly.

**Where.** A public, time-stamped registry such as an OSF registration or the [KPU Study Registry](https://koestlerunit.wordpress.com/research-overview/study-registry/registered-studies/). The "plan the series" step of the photo-target guide stores your plan with the run on the phone. That copy is a convenience, not a registration. For a stronger design, agree the plan with a sceptic and a proponent first, as the Transparent Psi Project did ([Kekecs et al. 2023](https://doi.org/10.1098/rsos.191375)).

## Personality predictors worth recording

Traits predict reported experiences under sham too. A trait effect is therefore not evidence for the field. The informative tests are **real vs sham** and **trait × condition** ([QUESTIONNAIRES.md](QUESTIONNAIRES.md)).

| Trait | What is known | In the app |
|---|---|---|
| Absorption | A consistent predictor of sham-helmet and spiritual experiences, with mostly modest correlations (r ≈ .2–.6) ([Granqvist et al. 2005](https://doi.org/10.1016/j.neulet.2004.10.057); [Maij & van Elk 2018](https://pubmed.ncbi.nlm.nih.gov/30355534/); review: [Lifshitz, van Elk & Luhrmann 2019](https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf)); established | `ipip-imagination`, a public-domain proxy for Tellegen Absorption (that scale needs permission) |
| Transliminality | Transliminality, Persinger's temporal-lobe lability, unusual experiences and thin boundaries form one factor (rs .56–.75, N = 1,368), so collect one of them ([Thalbourne & Maltby 2008](https://ernesthartmann.com/files/transliminality_thin-boundaries_unusual-experience.pdf)). It did not predict accuracy in experienced remote viewers ([Lyke, KPU 1055](https://www.koestler-parapsychology.psy.ed.ac.uk/Documents/KPU_1055_Results.pdf)) | Not included (licence unclear). `senpq` and the enrollment question on earlier presences cover presence-proneness |
| Prior belief (sheep–goat) | Believers outscore disbelievers in forced-choice ESP by a tiny but consistent margin: 73 studies, ES about .03 ([Psi Encyclopedia: Sheep-Goat Effect](https://psi-encyclopedia.spr.ac.uk/articles/sheep-goat-effect/)); claim | `expectancy` asks about belief in ESP in this app and in your own ability |
| Suggestibility | Hypnotisability correlated with sensed presence in Persinger's lab ([Tiller & Persinger 1994](https://doi.org/10.2466/pms.1994.79.3f.1527); single-lab) | `sss` (Short Suggestibility Scale) |
| Selection and practice | Selected participants did better only in the ganzfeld ([Storm, Tressoldi & Di Risio 2010](https://doi.org/10.1037/a0019457)). Prior psi experiences and meditation predicted novices' autoganzfeld success, extraversion correlated r = .18, and 20 arts students scored 50 % ([Bem & Honorton 1994](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/BemHonorton1994.pdf)); claim | Enrollment `background` items (meditation, arts training, psi experiences); `tipi` for extraversion |

Rules:
- Fill in traits at enrollment, at least a day before the first session, framed as "personality and experience". Trait scales filled in right after a session can be coloured by it ([Lifshitz, van Elk & Luhrmann 2019](https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf)).
- When sensed presence is the outcome, drop predictor items that themselves describe a presence, or score the scale with and without them. The Tellegen Absorption Scale has such an item ([Lifshitz, van Elk & Luhrmann 2019](https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf)). An erratum (Houran, Thalbourne & Lange 2003) says the transliminality scale's presence item was scored by mistake and should be replaced by another item ([Irving et al. 2024](https://strathprints.strath.ac.uk/87921/1/Irving-etal-AP-2024-The-relationship-between-transliminality-hypnotic-and-imaginative-suggestibility.pdf)).
- Correlations need large samples: about 194 people for r = .2 and about 783 for r = .1 (two-sided α = .05, power .80, computed). With one person, use the scales to describe yourself, not to test hypotheses.

## Optional context logging

- **Kp / ap.** The app fetches them from NOAA SWPC when it connects and passes them to the helmet. Offline, enter Kp by hand in **Setup**. The helmet records them with every session and with every trial at lock.
- **Local sidereal time.** Computed from the clock and the longitude in Setup.

Both are **exploratory**. Persinger and Krippner reported the best Maimonides dream sessions on geomagnetically quiet nights ([Psi Encyclopedia: Michael Persinger](https://psi-encyclopedia.spr.ac.uk/articles/michael-persinger/); single-lab). Spottiswoode reported a larger effect near 13 h local sidereal time, but a later sample of 3,678 trials did not reproduce the 13.5 h peak ([Psi Encyclopedia: James Spottiswoode](https://psi-encyclopedia.spr.ac.uk/articles/james-spottiswoode/)). Don't choose session times based on them, and don't hunt for the "best" split after the fact. If you want to test them, pre-register the split as a secondary hypothesis.
