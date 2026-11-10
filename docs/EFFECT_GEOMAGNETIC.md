# Geomagnetic activity: quiet days, stormy days, sidereal time, and how to test the claims

Michael Persinger argued for three decades that the Earth's magnetic weather shapes unusual experiences. Telepathic impressions and good scores in psi experiments were said to come on geomagnetically quiet days; apparitions of the dead, sensed presences and out-of-body feelings on disturbed ones. Todd Murphy, who sells the Shakti and Shiva devices, repeats this in his lectures and adds a "launch window" a few hours after a storm. A separate claim, by the physicist James Spottiswoode, is that psi scores peak near 13.5 h local sidereal time.

The helmet logs the indices Kp and ap and the local sidereal time with every session and trial, so you can test these claims on your own blind data. This article sets out what was claimed, what the indices measure, what mainstream science knows, and why such correlations are easy to find and hard to confirm. The short version: the claims rest on post-hoc correlations from one laboratory and one analyst; in the largest databases the overall correlation is close to zero; the one study that fixed its hypotheses in advance did not support them; and a storm changes the field at your head by less than moving around a building does.

Related documents:
- [RESEARCH.md](RESEARCH.md): the evidence review; its section "Geomagnetic and sidereal-time claims" is the starting point here
- [EXPERIMENTS.md](EXPERIMENTS.md): blinded sessions, trials, pre-registration, "Optional context logging"
- [BLE_PROTOCOL.md](BLE_PROTOCOL.md) and [GUIDES.md](GUIDES.md): `env.set`, the log fields `kp`, `ap`, `lst`, and what a guide run stores
- [SAFETY.md](SAFETY.md): exposure limits and who should not use the helmet
- Other effect articles: [Remote viewing](EFFECT_REMOTE_VIEWING.md), [Sensed presence](EFFECT_SENSED_PRESENCE.md), [Out-of-body experiences](EFFECT_OUT_OF_BODY.md), [Mind over random numbers](EFFECT_MICRO_PK.md), [Telepathy](EFFECT_TELEPATHY.md), [Remote influence](EFFECT_REMOTE_INFLUENCE.md), [The ring](EFFECT_RING.md), [Linked brains](EFFECT_LINKED_BRAINS.md)

## How to read this article

| Word | Meaning |
|---|---|
| **established** | Independently replicated |
| **single-lab** | Reported by one laboratory or research group only |
| **claim** | Stated by an author, agency or vendor without independent support |
| **anecdote** | A personal account |
| **unverified** | Could not be checked against a primary source |

No geomagnetic or sidereal effect on psi or on unusual experiences is **established**. The word applies here only to background facts, such as the magnetic sense of migratory animals. Values marked *computed* are this project's own calculations from the cited data.

## What the claim is

| Claim | Typical evidence | Main source |
|---|---|---|
| Quiet days favour telepathic impressions and psi scores | The day of an experience is quieter than the days around it; scores correlate negatively with an index | Persinger; Spottiswoode |
| Disturbed days favour apparitions, sensed presences and out-of-body feelings | The day of the experience is more active than the days around it | Persinger |
| Psi scores peak near 13.5 h local sidereal time (LST) | Effect size binned by the sidereal time of each trial | Spottiswoode |

Local sidereal time is star time: the same strip of sky is overhead at the same LST. It drifts against clock time by about four minutes a day, so 13.5 h LST falls at about 01:40 local mean time on 20 March, 19:30 on 21 June, 13:24 on 22 September and 07:30 on 21 December (*computed*).

### What the indices measure

- **K and Kp.** The K index "quantifies disturbances in the horizontal component of earth's magnetic field" from 0 to 9, from the largest swing in three hours. Kp is the standardised mean from 13 observatories; 5 or more counts as a storm ([NOAA](https://www.spaceweather.gov/products/planetary-k-index)). The series goes back to 1932 ([GFZ](https://kp.gfz.de/en/)).
- **ap and Ap.** The same on a linear scale; Ap is the daily mean. Multiplied by 2 nT they give "the average geomagnetic disturbance at 50 degree geomagnetic latitude" ([GFZ data file](https://kp.gfz.de/app/files/Kp_ap_Ap_SN_F107_since_1932.txt)).
- **aa.** The "average antipodal" index in nanotesla, which Persinger mostly used.

| What | Size | Source |
|---|---|---|
| Quiet interval, Kp 0 to 1 | up to about 8 nT | [GFZ data](https://kp.gfz.de/app/files/Kp_ap_Ap_SN_F107_since_1932.txt), ap × 2 nT |
| Minor storm, Kp 5 | about 100 nT | same |
| Extreme storm, Kp 9 | about 800 nT | same |
| This helmet, default setting | 1,000 nT (1 µT) at the cortex; under 100 nT at the hippocampus | [RESEARCH.md](RESEARCH.md) |
| Earth's steady field | 25,000 to 65,000 nT | [NOAA NCEI](https://www.ncei.noaa.gov/products/geomagnetism-frequently-asked-questions) |
| A strong fridge magnet, at its surface | 100 gauss, that is 10,000,000 nT | [MagLab](https://nationalmaglab.org/about-the-maglab/around-the-lab/maglab-dictionary/tesla/) |

Storm disturbances unfold over minutes to hours; the helmet's patterns change within milliseconds.

**How often.** From 1932 to November 2026, Kp was below 2 in 46 % of all three-hour intervals and at storm level (5− or more) in 7 %. About one day in five had a storm-level interval (*computed*), close to NOAA's 900 days with a minor storm per 11-year solar cycle; extreme storms come about four times a cycle ([NOAA scales](https://www.spaceweather.gov/noaa-scales-explanation)). The share of quiet days (Ap of 7 or less) ranged from 14 % in 1951 to 90 % in 2009 (*computed*), so "quiet" depends on the year you test in.

## The God Helmet record

### Persinger's laboratory

| Study | Data | Reported | Evidence |
|---|---|---|---|
| Bereavement apparitions ([Persinger 1988](https://pubmed.ncbi.nlm.nih.gov/3386872/)) | First-hand "postmortem apparition" reports from a published collection | The days of the experiences were more active, by 10 nT on average, than the days around them. Proposed route: storms lower melatonin and trigger temporal-lobe "microseizures" | **single-lab** |
| Maimonides dream sessions ([Persinger & Krippner](https://archive.org/download/STARGATEDataset/StargateDataset.zip/STARGATE%20dataset%2FCIA-RDP96-00792R000400030001-0.pdf)) | The first night of each of 62 subjects, in four groups by the judges' ranks | No overall difference in activity between the groups. A group-by-day interaction (p = .003): the 18 "high hit" nights were quieter than the two days before and than the monthly mean | **single-lab**; many follow-up t-tests |
| Death and crisis cases ([Persinger 1993](https://pubmed.ncbi.nlm.nih.gov/8483667/)) | 621 reports over about 70 years | The 232 telepathic cases fell on quieter days than the days around them; the 186 precognitive and 203 postmortem cases did not. "Equivalent to a correlation of about 0.35" | **single-lab** |
| Out-of-body-like feelings ([Persinger 1995](https://pubmed.ncbi.nlm.nih.gov/7675591/)) | 128 people, one laboratory session each | Strongest in people with many temporal-lobe signs, "primarily" when the day's activity was between about 15 and 45 nT (eta = .38) | **single-lab**; a band of values, not a trend |
| Sensed presence under the helmet ([Booth, Koren & Persinger 2005](https://pubmed.ncbi.nlm.nih.gov/16051550/)) | 39 subjects, two experiments | More presence reports when activity rose during the three hours of the session | **single-lab** |
| Shared-memory pairs, 2002 | 7 pairs and 15 pairs | One abstract reports congruence ratings "negatively correlated (rho = -.72)" with the day's activity ([Persinger, Cook & Tiller](https://pubmed.ncbi.nlm.nih.gov/12434847/)). The companion reports that "increased" activity went with more accurate ranking and calls the results similar ([Booth, Charette & Persinger](https://pubmed.ncbi.nlm.nih.gov/12434850/)) | **single-lab**; the abstracts read as opposite in sign |
| Simulated storm fields ([Mulligan & Persinger 2012](https://pubmed.ncbi.nlm.nih.gov/22484013/)) | 20 nT or 70 nT, 7 Hz, for 30 min | Right parietal theta power up at 20 nT and down at 70 nT, gone by the end | **single-lab** |

An earlier paper on 25 telepathy cases is known to us only from a secondary source ([Psi Encyclopedia](https://psi-encyclopedia.spr.ac.uk/articles/michael-persinger); **unverified**). In a public lecture Persinger says such experiences come "when the geomagnetic activity is less intense" ([3pdDtH4CvTY at 5:41](https://youtu.be/3pdDtH4CvTY?t=341)).

For scale: the median daily Ap since 1932 is 9, about 18 nT (*computed*). Persinger's cut-offs of 15 to 20 nT therefore mark ordinary days, not storms (aa and ap are different indices, so the comparison is rough).

**What is missing.** All of it comes from one laboratory. The case collections are retrospective, dated to the day at best, and analysed with cut-offs and windows chosen after the data were seen. Nothing was pre-registered. A later reviewer wrote that many of the spontaneous-case papers "used inappropriate statistical methods", citing Wilkinson and Gauld's 1993 re-examination ([Ryan 2008](https://journalofscientificexploration.org/index.php/jse/article/view/130); we could not open the 1993 paper).

### What Todd Murphy says

All of this is Murphy's account (**claim**), from his lecture on psychic skills:
- Psychic work is "more effective when the earth's magnetic field is quiet" ([28:12](https://youtu.be/tmC1174POpA?t=1692)); out-of-body experiences and sensed presences are more likely when it is active ([29:17](https://youtu.be/tmC1174POpA?t=1757)).
- A quiet period just after a storm is "a launch window for more effective psychic work" ([30:43](https://youtu.be/tmC1174POpA?t=1843)).
- The brain responds because it is "filled with magnetite": five million crystals per gram, a hundred million in the meninges ([31:43](https://youtu.be/tmC1174POpA?t=1903)). The crystal chains need "several hours" to adjust after a storm.
- The structure "most implicated" is the right hippocampus ([39:05](https://youtu.be/tmC1174POpA?t=2345)).

The crystal counts match the source: "a minimum of 5 million single-domain crystals per gram for most tissues in the brain and greater than 100 million crystals per gram for pia and dura" ([Kirschvink et al. 1992](https://pubmed.ncbi.nlm.nih.gov/1502184/)). The rest does not follow from it. A map of seven brains found the most magnetite in the cerebellum and brain stem ([Gilder et al. 2018](https://pubmed.ncbi.nlm.nih.gov/30054530/)), and many brain magnetite particles are pollution particles from outside ([Maher et al. 2016](https://pubmed.ncbi.nlm.nih.gov/27601646/)). We found no source for the launch window or the hours-long adjustment.

Murphy adds a candid detail. After one vivid session on a flat-field day, "ever since then I have expected it and ever since then it hasn't been as powerful" ([28:34](https://youtu.be/tmC1174POpA?t=1714); **anecdote**).

## Laboratory psi data

| Analysis | Data | Result | Evidence |
|---|---|---|---|
| [Adams & Puthoff 1984](https://documents2.theblackvault.com/documents/cia/stargate/STARGATE%20%234%20176/Part0003/CIA-RDP96-00788R001800270001-4.pdf), for the US Army | Single viewers' scores against sunspot numbers at many time lags; geomagnetic and ELF data also surveyed | 779 correlations run; 56 significant where "up to 38" were expected by chance; "both positive and negative"; the strongest came two to three days *after* the sessions. The authors call it a pilot that "provides evidence" of a link | **single-lab** |
| [Spottiswoode 1997, geomagnetic](http://www.jsasoc.com/docs/JP-GMF.pdf) | 2,879 free-response trials from 51 studies | Overall correlation with ap: −0.029 (p = .06). Inside 11.2–14.8 h LST: −0.192 (256 trials); elsewhere −0.01 | **single-lab**; the window was found in the data |
| [Spottiswoode 1997, sidereal](http://www.jsasoc.com/docs/JSE-LST.pdf) | 1,468 trials, then 1,015 more requested from laboratories | Within 1 h of 13.47 h LST the effect size was 3.4 times the overall value (83 trials, p = .001); in the second set 4.5 times (43 trials, p = .05) | **single-lab**; the second set was existing data, not new trials |
| [Ryan 2008](https://journalofscientificexploration.org/index.php/jse/article/view/130) | 343 UK trials from study conditions with effect size above 0.15 | Correlation with ap: −0.04, not significant. Scoring went with fast pulsations (0.2–0.5 Hz; corrected p = .025, not significant after removing a time trend) | **single-lab**, post hoc |
| [Roney-Dougal, Ryan & Luke 2014](https://gala.gre.ac.uk/17051/7/17051%20LUKE_Local_Geomagnetic_Activity_2014.pdf) | 26 long-term meditators over 4 years; hypotheses taken from Ryan 2008 | The "formal hypotheses were not significantly supported"; scoring was at or below chance | Prospective test, null |
| Ryan & Spottiswoode 2015 | 3,678 fresh trials; about 6,000 for the correlation | No peak at 13.5 h, a small one near 7.5 h; overall correlation not significant ([Psi Encyclopedia: Spottiswoode](https://psi-encyclopedia.spr.ac.uk/articles/james-spottiswoode/); [Ryan](https://psi-encyclopedia.spr.ac.uk/articles/adrian-ryan/)) | **unverified**: book chapter not opened |

Two other large series, 334 remote-viewing sessions at Princeton and 139 ganzfeld sessions by Honorton, showed no link, as summarised by [Ryan 2008](https://journalofscientificexploration.org/index.php/jse/article/view/130). We found no pre-registered confirmatory test of either claim (a search-limited finding).

Two points come from the proponents themselves:
- **Size.** Spottiswoode notes that typical disturbances are 50–200 nT in a field of about 50,000 nT, while city subjects pass through gradients "many times larger" near buildings. He calls it "improbable that the geomagnetic fluctuations are themselves responsible" ([Spottiswoode 1997](http://www.jsasoc.com/docs/JP-GMF.pdf)).
- **Season.** Most trials ran in office hours, so a seasonal swing in scores turns into a sidereal pattern. Ryan reports that Spottiswoode's data show such a swing and that this "will, at least partly, explain the shape of the LST graph" ([Ryan 2008](https://journalofscientificexploration.org/index.php/jse/article/view/130)).

## What mainstream science knows

| Topic | Findings | How solid |
|---|---|---|
| Melatonin | Lower overnight excretion of a melatonin metabolite on days with aa above 30 nT in 132 utility workers ([Burch 1999](https://pubmed.ncbi.nlm.nih.gov/10465710/)); repeated in 153 workers ([Burch 2008](https://pubmed.ncbi.nlm.nih.gov/18472329/)) | **single-lab**: one group, two samples |
| Heart-rate variability | Associations in 16 people ([Alabdulgader 2018](https://pubmed.ncbi.nlm.nih.gov/29422633/)) and in 809 older men ([Zilli Vieira 2022](https://pubmed.ncbi.nlm.nih.gov/35644403/)). A replication found that most correlations vanished "after correction for autocorrelation" ([Mattoni 2020](https://pubmed.ncbi.nlm.nih.gov/32306151/)). A review of 29 studies "does not confirm a consistent effect" ([Fadlou Allah 2026](https://pubmed.ncbi.nlm.nih.gov/42730093/)) | Not established |
| Stroke and heart deaths | Storms went with 19 % more strokes in 11,453 patients ([Feigin 2014](https://pubmed.ncbi.nlm.nih.gov/24757102/)). In 263 US cities deaths rose by fractions of a percent with Kp, with no association for stroke ([Zilli Vieira 2019](https://pubmed.ncbi.nlm.nih.gov/31511079/)). A review found six usable studies with differing methods ([Gaisenok 2025](https://pubmed.ncbi.nlm.nih.gov/40256184/)) | Suggestive, inconsistent |
| Epilepsy | Persinger linked sudden death in epilepsy to days above 50 nT ([Persinger 1995](https://pubmed.ncbi.nlm.nih.gov/7601551/)). A post-mortem study of 154 patients found no relation ([Schnabel 2000](https://pubmed.ncbi.nlm.nih.gov/10690984/)) | **single-lab**; the independent test was null |
| Suicide | More suicides during storms among women in autumn only, in Australia ([Berk 2006](https://pubmed.ncbi.nlm.nih.gov/16304696/)); among men only, in Japan ([Tada 2014](https://pubmed.ncbi.nlm.nih.gov/24005993/)); "weak" in 27,469 Finnish cases ([Partonen 2004](https://pubmed.ncbi.nlm.nih.gov/15306138/)) | Inconsistent subgroups |
| Magnetic sense in animals | The behavioural evidence in migratory animals is compelling; the receptor is unknown ([Mouritsen 2018](https://pubmed.ncbi.nlm.nih.gov/29875486/); [Nordmann 2017](https://pubmed.ncbi.nlm.nih.gov/29059181/)) | **established** as behaviour |
| Magnetic sense in humans | Early homing claims were not replicated. In 36 adults, rotating an Earth-strength field (about 35 µT) lowered EEG alpha power in some; nobody noticed the rotations ([Wang et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494972/)) | **single-lab**; no independent replication found |

Wang's stimulus turned the whole 35 µT field. A minor storm moves it by about 0.1 µT. A human compass, if real, would not by itself make storms matter.

## Why these correlations mislead

- **Many forks.** Three indices, the day itself or the days around it, several cut-offs, both sexes, several kinds of experience, and only the analyses that worked get written up. Adams and Puthoff's 779 correlations show how many "significant" ones chance supplies.
- **Either sign counts.** Quiet days support the telepathy claim, active days the apparition claim.
- **Autocorrelation.** Daily Ap correlates .50 with the next day's and .20 with the value 27 days later, one solar rotation (*computed*). Mood, sleep and routines drift with weeks and seasons too. Two slow series correlate by accident far more often than the usual p-value assumes ([Mattoni 2020](https://pubmed.ncbi.nlm.nih.gov/32306151/)).
- **Clock and season.** A person who works at 21:00 is within an hour of 13.5 h LST only from mid-May to mid-June (*computed*). For one person, "sidereal time" is a season.

A clean test fixes one index, one window, one cut-off, one direction and the number of trials in advance; scores the outcome blind; spreads sessions over the year; and handles autocorrelation, for example by comparing with shuffled dates.

## Reading list and primary sources

**Persinger laboratory**
- Persinger MA, Krippner S. Experimental dream telepathy-clairvoyance and geomagnetic activity. Proceedings paper in the CIA's STAR GATE files, CIA-RDP96-00792R000400030001-0 ([PDF](https://archive.org/download/STARGATEDataset/StargateDataset.zip/STARGATE%20dataset%2FCIA-RDP96-00792R000400030001-0.pdf)). The journal version (*Journal of the American Society for Psychical Research* 83:101–116, 1989) was not opened.
- Persinger MA (1988), *Neuroscience Letters* 88:271–274 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/3386872/)); (1993), *Perceptual and Motor Skills* 76:555–562 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/8483667/)); (1995), *Perceptual and Motor Skills* 80:563–569 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/7675591/)).

**Psi databases**
- Spottiswoode SJP (1997). The sidereal-time paper, *Journal of Scientific Exploration* 11(2) ([author's copy](http://www.jsasoc.com/docs/JSE-LST.pdf)), and the geomagnetic paper ([author's copy](http://www.jsasoc.com/docs/JP-GMF.pdf)). Both are reprinted in McMoneagle J, *Remote Viewing Secrets* (2000), Appendices B and C, pp. 223–254.
- Ryan A (2008). New insights into the links between ESP and geomagnetic activity. *Journal of Scientific Exploration* 22:335–358 ([JSE](https://journalofscientificexploration.org/index.php/jse/article/view/130)).
- Roney-Dougal SM, Ryan A, Luke D (2014). The relationship between local geomagnetic activity and psychic awareness. *Journal of Parapsychology* 78 ([repository copy](https://gala.gre.ac.uk/17051/7/17051%20LUKE_Local_Geomagnetic_Activity_2014.pdf)).
- Adams M, Puthoff HE (1984). *Geophysical Effects Study*. SRI International ([PDF](https://documents2.theblackvault.com/documents/cia/stargate/STARGATE%20%234%20176/Part0003/CIA-RDP96-00788R001800270001-4.pdf)).

**Critical and mainstream**
- Mattoni M et al. (2020). *European Journal of Applied Physiology* 120:1371–1381 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/32306151/)): the autocorrelation problem, shown on heart-rate data.
- GFZ Potsdam: the [Kp index](https://kp.gfz.de/en/) and its [data since 1932](https://kp.gfz.de/app/files/Kp_ap_Ap_SN_F107_since_1932.txt).

## Trying it with this helmet

### What the app records

- **Kp and ap.** The app fetches the latest NOAA value when it connects and sends it to the helmet (`env.set`). Offline, enter Kp by hand in **Helmet → Environment**. Every log entry carries `kp`, `ap`, `kpSource` and `lst`; a trial records them when you lock your response ([BLE_PROTOCOL.md](BLE_PROTOCOL.md)). Guide runs store them too ([GUIDES.md](GUIDES.md)).
- **Local sidereal time.** Computed from the helmet's clock and the longitude you set.

The NOAA value is a nowcast. For analysis, look up the definitive Kp for each timestamp in the [GFZ file](https://kp.gfz.de/app/files/Kp_ap_Ap_SN_F107_since_1932.txt).

### Programs and guides

No program is known to make a session depend on geomagnetic activity. These give you outcomes to correlate.

| Program or guide | What it gives you | Evidence |
|---|---|---|
| [Geomagnetic-rotation probe (Wang 2019 trial structure)](#programs/lowfield-geomagnetic-rotation-probe) ([brain view](#programs/lowfield-geomagnetic-rotation-probe/brain)) | The timing of Wang's rotation trials on the ring. The helmet cannot rotate the Earth's field, and testing the EEG claim needs EEG | **single-lab** |
| [Remote viewing (Octopus ring, CCW chirp 10→20 ms)](#programs/remote-viewing) ([brain view](#programs/remote-viewing/brain)) | Murphy's psi configuration, for blinded trials | **claim** |
| [Photo-target trial (free response)](#guides/photo-target-trial), [Psi trial with covariates (ganzfeld-style)](#guides/psi-trial-flow) | A blind rank per trial | **single-lab**, **claim** |
| [Blinded helmet session with questionnaires](#guides/helmet-session-flow) | Presence and state ratings under real or sham | **claim** |
| [Micro-PK with the hardware random generator](#guides/rng-pk) | A z score per session | **single-lab** |

Read [SAFETY.md](SAFETY.md) first. These programs are not for anyone with epilepsy or a seizure history; stop on headache, nausea or distress.

### How many sessions

For 80 % power (*computed*; one-sided α = .05, two-sided in brackets):

| What you test | Assumed true size | Needed |
|---|---|---|
| A rating against Kp, at Persinger's strongest figures | r = .33 | 56 sessions (70) |
| The same, a modest link | r = .20 | 153 (194) |
| Psi score on quiet against other days, the whole effect on quiet days | effect size 0.4 against 0 | 77 trials in each group |
| The 13.5 h window, trials spread evenly over sidereal time | 0.47 inside, 0.10 outside | about 600 trials |

At one session per 72 hours ([SAFETY.md](SAFETY.md)), 56 sessions take almost six months, in which the season changes too. A handful of sessions on "quiet" and "stormy" days shows nothing.

### Fix the analysis before you look

`tools/trial_stats.py` prints two splits, Kp below 2 against the rest and 12.5–14.5 h LST against the rest, and labels them exploratory. To turn one into a test, write down before the first session ([EXPERIMENTS.md](EXPERIMENTS.md)):
1. the index and the time window (for example, the definitive Kp of the three-hour interval that contains the lock time);
2. the cut-off or the correlation, and its direction;
3. the one outcome, scored blind;
4. the number of sessions, and that every one counts.

Do not look at Kp before a session: knowing that it is a "good day" is an expectation effect, as Murphy's own story shows. Do not choose session times by Kp or sidereal time to improve your results ([RESEARCH.md](RESEARCH.md)).

### Honest expectations

- **Expect nothing.** The best data show an overall correlation near zero.
- **A correlation is not a cause.** Kp travels with season, sleep, weather and mood.
- **Real against sham stays the main question.** Kp can only be a secondary analysis of a series that is already blind.
- **Report everything**, including the splits that showed nothing.
