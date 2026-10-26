# Research notes: weak complex magnetic fields, the "God Helmet", and what this build can test

Compiled 26 Oct 2026 from:
- the primary literature (abstracts via PubMed and publishers);
- Todd Murphy's six-lecture series *Spirituality and the Brain* plus two interviews (transcripts, cited with timestamps);
- Murphy's vendor pages at god-helmet.com;
- Persinger's 2007 lecture *No More Secrets* (transcript);
- neurology texts in a local document archive.

Every claim is labelled with its source. **Claims by Persinger's lab or by Murphy (who sells the Shakti/Shiva devices) are reported as claims, not as established facts.**

---

## 1. Short version

- **What the device does.** Eight small coils carry milliamp currents shaped into "complex" patterns.
  - The field at the cortex is about **1–5 µT**, comparable to a hair dryer or desk lamp, about 1/10 of Earth's static field.
  - That is **about a million times weaker than TMS**.
- **What is claimed.** Persinger and Koren (Laurentian University) reported the following from such fields over the temporal lobes:
  - "sensed presences" in up to ~80 % of subjects;
  - visions, bliss, fear, out-of-body feelings;
  - in later circumcerebral ("Octopus") work, enhanced remote viewing and telepathy-like EEG coupling.
- **What independent tests found.**
  - The strongest test (Granqvist et al. 2005, double-blind, N = 89) found **no effect of the field**. Suggestibility predicted who had experiences.
  - A placebo-controlled test of Murphy's 8-coil Shakti (Gendle & McGrath 2012) also found nothing.
  - Sham helmets with no field produce "presences" too.
- **Physics.**
  - A 5 µT field changing at theta rates induces about 10⁻⁵ V/m in tissue. TMS needs about 100 V/m; the brain's own fields are about 0.1–1 V/m.
  - Deep targets (amygdala, hippocampus, 4–6 cm deep) get about 0.1–0.6 µT.
  - No accepted mechanism exists for such fields to drive neurons.
- **So what is this build good for?** Recreating the published protocols as faithfully as the sources allow, and testing them honestly. The firmware therefore has:
  - **blinded real/sham sessions**;
  - **blinded, hash-committed remote-viewing and telepathy trials** with proper statistics.

---

## 2. History and theory (claims)

| Who / what | Key points |
|---|---|
| **Persinger & Koren**, Laurentian University, 1980s–2010s | Modified snowmobile helmet ("Koren helmet") with solenoids over the temporal lobes, in a dark, acoustically shielded chamber (also a Faraday cage). Fields about 1 µT ("weak but complex"). |
| **Theory: vectorial hemisphericity** | The sense of self lives in the left temporal lobe. When the hemispheres fall out of phase, the left perceives its right-hemisphere counterpart as **another being**: a presence, angel, ghost, god or alien depending on the person's culture. Persinger also proposed "temporal lobe transients" (microseizure-like bursts) behind mystical, out-of-body and "abduction" experiences. |
| **Signals** | Not plain frequencies. Patterns derived from physiological recordings: an **amygdala "burst-firing"** pattern taken from an epileptic patient's EEG, a hippocampal theta pattern, a frequency-modulated **"Thomas pulse"**, a **"chirp"** from a function generator. |
| **Octopus / circumcerebral** (≈2002–2010) | **8 solenoids** in a horizontal ring above the ears. The field **steps around the head**, usually **counter-clockwise**, with a few to 100 ms per step. Murphy's Octopus used 8 canisters × 2 coils. |
| **Todd Murphy** | Member of Persinger's group from 1998. Built the consumer **Shakti** (2-, 4- and 8-coil, driven from a PC's stereo sound output), the 8-coil Shakti and the **Shiva** (16 coils on 8 channels, a PC version of the Octopus). |

---

## 3. Signal parameters reported in the literature

| Parameter | Value | Source |
|---|---|---|
| Point table → voltage | Numbers 0–255 → −5…+5 V, each held for a "point duration" | Persinger-lab papers (via cancer-research PDF summary) |
| Point duration | 3 ms "optimal"; 1 ms and 10 ms gave most sensed presences / occipital spikes | Booth, Koren & Persinger 2003 (PMS 97:951) |
| Burst-firing | Accelerating FM burst pattern, 3 ms points, 4000 ms interstimulus interval | Re-analysis of Persinger protocols; Richards et al. 1992 |
| Thomas pulse | **De**celerating FM, ~25 → 6 Hz, ~2.5 s, 3 ms points | Thomas/Persinger patents (US6234953), Buckner et al. 2015 |
| Chirp | Function-generator sweep "built from common peak EEG frequencies" (range unpublished) | Murphy–Balbin interview t=2049 |
| Circumcerebral step | 20 ms per solenoid, about +30 % theta power | Richards, Koren & Persinger 2002 (PMS 95:671) |
| Circumcerebral ramp | 25 ms, then 2 ms shorter per coil down to 11 ms, more gamma | Tsang, Koren & Persinger 2004 |
| Rotation direction | CW raises left-hemisphere power, CCW raises right | Booth et al. 2008 |
| Murphy's psi timing | Dwell 10, 12, 14, 16, 18, 20 ms; each phase slower than the last; CCW; chirp signal | *Psychic Skills* lecture [19:47](https://youtu.be/tmC1174POpA?t=1187), [45:32](https://youtu.be/tmC1174POpA?t=2732), [45:49](https://youtu.be/tmC1174POpA?t=2749) |
| Telepathy study timing | 6 configurations × 5 min; 100 ms pulses, 20 ms rate changes; ~1 µT | Persinger, Koren & Tsang 2003 (PMS 97:877) |
| Field strength | Helmet ~1 µT (0.1–1 µT); Octopus 5–10 µT; Shakti 10–90 mG = 1–9 µT; Granqvist used 3–7 µT | Wikipedia; Richards 2002; god-helmet.com safety page; Nature news 2004 |

The firmware implements all of these as editable, synthesised patterns (`firmware/lib/engine/src/patterns.cpp`). The original Koren point files were never published, so these are approximations of the descriptions, not copies.

---

## 4. Field strength of *this* build (calculated)

These figures come from numeric on-axis integration for the 19×12 mm, 495-turn coil, air core (`tools/coil_field.py`):

| Distance from coil face | µT per mA | At the 4.54 mA hardware cap (2.2 kΩ, ±10 V) |
|---|---|---|
| 0 mm | 22.9 | 104 µT |
| 5 mm (scalp through cap/hair) | 7.7 | 35 µT |
| 15–20 mm (cortex) | 1.37–0.73 | 6.2–3.3 µT |
| 40–50 mm (hippocampus/amygdala) | 0.14–0.075 | 0.6–0.3 µT |

- The ferrite core may raise these values by ×1.5–3, so calibrate (docs/CALIBRATION.md).
- The default preset intensity is **1 µT at 20 mm**, matching Persinger's helmet. The ceiling is user-set, at most 10 µT.

**Safety reference.** The ICNIRP 2010 public reference level is 200 µT for 25–400 Hz, and higher below 25 Hz. At full current the coil face stays under it, and the field falls about 30× within 2 cm.

**Induced electric field.** Taking E ≈ (r/2)·dB/dt with r ≈ 5 cm:
- a 5 µT, 7 Hz sine induces about **5 µV/m**;
- a sharp full-scale DAC step peaks around 0.02 V/m for a few microseconds.

Both are orders of magnitude below anything known to fire neurons.

---

## 5. States → brain regions → how to do it with this helmet

Legend: **claim** = Persinger, Murphy or vendor; **mainstream** = independent neuroscience. Channel numbers refer to `docs/PLACEMENT.md`.

| Target | Brain region | Helmet protocol (firmware preset) | Notes |
|---|---|---|---|
| **God Helmet classic** (presence → bliss) | Claim: right hemisphere first, then both amygdalae | `god-helmet-classic`, layout B. P1 = 25 min **chirp cycling through the right-side coils** (CH5–8, 3 ms per coil). **Abrupt switch** to P2 = 25 min **amygdala burst-firing on both sides**. | P1 often causes fear; Murphy says jump to P2 within ~10 s if it does (Skip button). Dark, quiet room, blindfold, eyes closed. Murphy V1 [24:41](https://youtu.be/zqrpKUTMXgY?t=1481), V2 [62:17](https://youtu.be/KJIAHHB8Btk?t=3737), Balbin interview t=1290 |
| **Sensed presence** | Claim: right or bilateral temporoparietal (Persinger & Healey 2002, n=48, double-blind; right/bilateral > left/sham). Mainstream: **left** TPJ electrical stimulation gave a "shadow person" (Arzy 2006); sensorimotor conflict gives presence in healthy people (Blanke 2014) | `presence-right` (CH7 CP6 + CH8 TP8 weighted, burst-firing, then bilateral) and the mirrored `presence-left` | Compare the two in blinded sessions. Murphy: the presence "doesn't really come up" at home without real silence (Balbin t=1222) |
| **Out-of-body (OBE)** | Mainstream: **right angular gyrus / TPJ**. Electrode stimulation reproduced OBEs in one patient (Blanke 2002, Nature 419:269); seen as a failure to integrate body and vestibular signals. Claim: right temporal/parietal with hippocampal, 40 Hz or chirp signals | `obe`, layout B. 10 min bilateral 7 Hz theta, then 20 min theta stepping around the right coils, weighted to **CH7 (CP6) / CH8 (TP8)** over the right angular gyrus / TPJ | Lie down. Murphy: many OBEs happen **in sleep about 1 h after** a session; best 00:00–04:00. OBE-like detachment was linked to geomagnetic activity of 15–45 nT in temporal-lobe-sign people (Persinger 1995, correlational) |
| **Remote viewing** | Claim: right hemisphere / right hippocampal theta. Ingo Swann's accuracy correlated with **occipital 7 Hz** power (Persinger et al. 2002, rho = .50; PMS 94:927) | `remote-viewing`, layout A ring, **CCW rotation, chirp, dwell 10→20 ms in 2 ms steps across six 5-min phases** (30 min, like Swann's single 30-min exposure), then a blinded trial (Experiment tab) | Claims of better results on geomagnetically quiet nights (aa ~10 nT good, >25 nT poor) and at ~13.5 h LST (did not replicate) are only logged, never used to gate sessions |
| **Telepathy** | Claim: "shared field" gave 5–6 Hz power increases in the unstimulated receiver (Persinger, Koren & Tsang 2003; 4 sibling pairs). 2010: yoked fields, light flashes in one person showed up as right-parietal EEG in the other | `telepathy-sender`, layout A. 6 × 5 min: CCW 20 ms, 20→40 ms ramp, 100 ms pulses, …. **The sender wears the helmet** and looks at the target (app → Experiment → Sender, second phone); the receiver writes impressions in another room | Yoked two-helmet mode needs a 2nd ESP32 + AD5328 (future). Murphy's pairs study stimulated the receiver instead; switch roles to test both |
| **Meditation prep** | Claim: temporal lobes | `meditation-prep`: 25 min bilateral burst-firing | Murphy: don't meditate *during* stimulation; meditate ~90 min afterwards (V2 [64:21](https://youtu.be/KJIAHHB8Btk?t=3861)) |
| **Mood lift** | Claim: temporal, then frontal | `meditation-prep` (temporal), then move the coils to the ring and run `frontal` (CH1/2/8 only). Course of about 6 sessions | Murphy V2 [66:24](https://youtu.be/KJIAHHB8Btk?t=3984) |
| **Lucid dreaming** | Claim: frontal lobes | 4–6 temporal sessions (`meditation-prep`), then **one `frontal` session on the target night** | Murphy V2 [69:31](https://youtu.be/KJIAHHB8Btk?t=4171) |
| **Love / agape** | Claim: left amygdala and left caudate (positive affect); right amygdala = fear | `love-agape`: left-side burst-firing | Anecdotal (Murphy V1 [11:54](https://youtu.be/zqrpKUTMXgY?t=714), V3 [35:12](https://youtu.be/R8GIKT8TY1k?t=2112)). Murphy reports bliss when he moved the amygdala signal to the left only |
| **Circumcerebral EEG studies** | Claim: theta / gamma power changes | `circumcerebral-theta` (CCW 20 ms), `circumcerebral-gamma` (CCW 25→11 ms) | Replicating these needs EEG (future option) |
| **Shakti style** | Claim | `shakti-alternate`: left↔right alternation every 2 s | Skip with any seizure history (see §7) |
| **Déjà vu, kundalini/chakras, chi, past lives** | Claim only (Murphy): déjà vu = hippocampus over-coupled to surrounding cortex; chakras ↔ limbic pairs; chi = right hippocampus + right occipito-temporo-parietal | **No protocol in any source**; anatomy only. Use the custom session builder if you want to explore | Mainstream: déjà vu has been evoked by electrical stimulation of rhinal/entorhinal cortex, again with implanted electrodes |
| **Sham** | — | `sham`, or tick **Blind** on any preset (50/50 hardware RNG) | The only way to know whether *your* experiences depend on the field |

### Where mainstream neuroscience differs
- **Presence.** Mainstream work points to the temporoparietal junction and sensorimotor conflict (Blanke 2014: a robot tapping the back with a delay produced presences in blindfolded healthy people), not to "out-of-phase amygdalae".
- **Left good, right bad.** "Left amygdala = positive, right = negative" is a strong oversimplification; both amygdalae respond to both valences.
- **Theta.** Hippocampal theta is bilateral; meditation theta is frontal-midline.
- **OBE / déjà vu evidence.** Every OBE and déjà-vu induction that worked used **milliamp currents through electrodes on the brain**, not µT fields from outside the skull.

---

## 6. Remote viewing and telepathy: the evidence

**Persinger's claims** (2007 lecture *No More Secrets*, transcript in the local archive):
- Swann's accuracy tracked **7 Hz activity over the right hemisphere**, "the same frequency the Earth generates" (Schumann resonance ~7.8 Hz).
- Accuracy dropped during geomagnetic storms and thunderstorms.
- Two people sharing the same Octopus field in separate rooms became "effectively one brain". A light flashed to one showed up in the other's brain activity.
- He framed this as a step toward "access to every bit of information in every brain".

**Persinger-lab papers (abstracts):**
- **Persinger, Roll, Tiller, Koren & Cook 2002** (PMS 94:927): Swann; one 30-min circumcerebral exposure; occipital 7 Hz correlated with accuracy (rho = .50).
- **Koren & Persinger 2002** (PMS 95:989): fields applied at the *target*, below 20 nT; a "Windows-generated" pattern reduced accuracy.
- **Persinger, Koren & Tsang 2003** (PMS 97:877): 4 sibling pairs, sender stimulated with 6 × 5 min fields; receiver showed 5–6 Hz increases.
- **Persinger & Saroka 2012** (PMC3410194): psychic Sean Harribance; right parahippocampal 20–30 Hz during readings.

**Environment:**
- **Geomagnetic.** Persinger & Krippner 1989 re-analysed the Maimonides dream-telepathy data and found more hits on geomagnetically calm nights.
- **Sidereal time.** Spottiswoode 1997 found, in 1,468 free-response trials, effect sizes up 340 % within 1 h of **13.5 h local sidereal time**. An independent set of 1,015 trials was reported as consistent. However, the correlation between AC effect and the ap index across 2,879 trials was only −0.029, and a later set of 3,678 trials **did not replicate** the LST peak (Psi Encyclopedia).

**Mainstream assessment:**
- The 1995 AIR review of the US Stargate programme had two reviewers. Utts concluded a statistical effect was established. Hyman called that premature and unreplicated.
- Both agreed remote viewing never produced actionable intelligence, and the programme was closed.
- Ganzfeld meta-analyses by proponents show shrinking effects (ES ~0.13 → 0.08 in a 2024 registered report).
- Persinger's psi studies are small, from one lab, and were criticised for weak blinding.

**Practice tips from the sources** (no evidence base, but harmless):
- First impressions only; avoid naming things (McMoneagle's "analytic overlay").
- Emotions interfere (Murphy).
- Several dozen targets in a pool, built by someone who doesn't do the viewing (McMoneagle, *Remote Viewing Secrets*).

**How the firmware tests it properly** (docs/EXPERIMENTS.md):
- The hardware RNG picks the target set, the target and real/sham.
- A SHA-256 commitment is published before the response.
- Pictures are served only after the response is locked.
- Blind ranking of all N pictures, then the reveal.
- Exact statistics; aborted trials stay counted.

---

## 7. Safety-relevant findings

- **Murphy's own adverse event.** The bilateral amygdala signal gave him **8–10 days of severe distress**, which he attributes to childhood right-temporal epilepsy (McTaggart interview, about 36 min). Moving the signal to the left side only gave him bliss.
- **Right-side-only stimulation** caused terror in some lab subjects; some asked to stop (Murphy V1 [25:22](https://youtu.be/zqrpKUTMXgY?t=1522)).
- **Seizure-prone people.** Murphy describes a seizure in a seizure-prone person, triggered just by shifting attention left and right between body parts (V1 [73:37](https://youtu.be/zqrpKUTMXgY?t=4417)). He stresses that temporal-lobe epilepsy is common and often missed (V2 [25:43](https://youtu.be/KJIAHHB8Btk?t=1543)).
- **Contraindications he names:** epilepsy, depression, schizophrenia, PTSD (Balbin t=2782).
- **Frequency:** at most once a week, because people habituate (Balbin t=3278). Vendor: every 72 h at most.
- **Don't combine** with other "mind machines" (light/sound, CES, TENS) during a session (Shakti safety page).

These are built into `docs/SAFETY.md`, the UI safety gate and the preset notes.

---

## 8. Lecture notes: Todd Murphy, *Spirituality and the Brain* (playlist PL6E2B4B0A4C8ACAEF)

V1–V6 and I1–I2 are labels used in this document and in the preset sources, not the playlist order.

| # | Lecture | Takeaways for this build |
|---|---|---|
| V1 | [Enlightenment, the Self and the Brain](https://youtu.be/zqrpKUTMXgY) | Left amygdala = positive and right = fear ([7:21](https://youtu.be/zqrpKUTMXgY?t=441)). God Helmet two phases: right first, then the amygdala signal both sides gives bliss "in less than five seconds" ([26:58](https://youtu.be/zqrpKUTMXgY?t=1618)). Right hippocampus = wordless "void" and theta ([39:48](https://youtu.be/zqrpKUTMXgY?t=2388)). Experiences easier in early-morning hours as melatonin falls ([86:38](https://youtu.be/zqrpKUTMXgY?t=5198)) |
| V2 | [Déjà vu and other ways to use neuroscience for prayer and meditation](https://youtu.be/KJIAHHB8Btk) | Déjà vu / jamais vu = hippocampal coupling ([13:18](https://youtu.be/KJIAHHB8Btk?t=798)). Session length 20–30 min ([64:21](https://youtu.be/KJIAHHB8Btk?t=3861)). Shakti is ordinary stereo audio, one signal to both channels ([64:37](https://youtu.be/KJIAHHB8Btk?t=3877)). Mood-lift course ([66:24](https://youtu.be/KJIAHHB8Btk?t=3984)). Lucid-dream course ([69:31](https://youtu.be/KJIAHHB8Btk?t=4171)). Altered states = bilateral then right ([71:11](https://youtu.be/KJIAHHB8Btk?t=4271)) |
| V3 | [The Sacred Body: kundalini, subtle bodies, chi](https://youtu.be/R8GIKT8TY1k) | Chakra ↔ limbic pairs, e.g. third eye = right hippocampus + right caudate ([32:05](https://youtu.be/R8GIKT8TY1k?t=1925), [43:34](https://youtu.be/R8GIKT8TY1k?t=2614)). Chi / motion sense = right hippocampus + right occipito-temporo-parietal ([54:09](https://youtu.be/R8GIKT8TY1k?t=3249)). No stimulation protocols |
| V4 | [Reincarnation in human evolution](https://youtu.be/y2uZkPzJrZc) | Nearly every NDE feature has been triggered by temporal-lobe stimulation ([37:25](https://youtu.be/y2uZkPzJrZc?t=2245)). OBE-like experiences correlate with high geomagnetic activity in people with many temporal-lobe signs ([72:50](https://youtu.be/y2uZkPzJrZc?t=4370)). Reincarnation claims are, in his words, "in theory" |
| V5 | [God and the Brain: the Persinger God Helmet](https://youtu.be/Eid6fiAj8WY) | First lecture of the series. The transcript could not be fetched (YouTube rate limit); its content is covered by the God-Helmet interviews below |
| V6 | [Psychic Skills & Miracles: technology for telepathy and remote viewing](https://youtu.be/tmC1174POpA) | Octopus = 8 canisters × 2 coils, fields rising/falling in 1–3 ms ([4:42](https://youtu.be/tmC1174POpA?t=282)). Signals "Chirp" and "Burst-X" ([4:09](https://youtu.be/tmC1174POpA?t=249)); chirp chosen for psi ([45:49](https://youtu.be/tmC1174POpA?t=2749)). CCW rotation against the front-to-back 40 Hz "binding" sweep ([25:19](https://youtu.be/tmC1174POpA?t=1519)). Psi is right-hemisphere ([29:41](https://youtu.be/tmC1174POpA?t=1781)), centred on right hippocampal theta ([39:08](https://youtu.be/tmC1174POpA?t=2348)). Swann's targets were photos in manila envelopes in the next room, judged by 44 raters ([7:58](https://youtu.be/tmC1174POpA?t=478)). Intimate pairs at "2.85 times chance" ([13:53](https://youtu.be/tmC1174POpA?t=833)). Geomagnetic "launch window" after storms calm ([27:47](https://youtu.be/tmC1174POpA?t=1667)). First instant impression = the psychic one ([1:27:56](https://youtu.be/tmC1174POpA?t=5276)) |
| I1 | [Murphy & Tony Balbin interview](https://youtu.be/1uVjHmi51HM) | Coils "over the temporal lobes, above the ears" (t=3359). Chirp over the whole right hemisphere (t=1290). Burst-firing first seen in an epileptic's EEG, also present in normal people (t=2018). "Effective signals are not frequencies, they're complex patterns." Weekly maximum because of habituation (t=3278). Two sessions 90 min apart gave ~3× EEG response (t=3521) |
| I2 | [Lynne McTaggart interview, 2006](https://youtu.be/K-0PHkfvEhg) | Persinger's procedure: right chirp for ~30 min, then an abrupt switch to bilateral amygdala signal (t=104). Murphy's 8–10 days of distress. Midnight–4 am best |

---

## 9. Sources

**Primary and secondary literature**
- Granqvist P. et al. (2005). Sensed presence and mystical experiences are predicted by suggestibility, not by the application of transcranial weak complex magnetic fields. *Neurosci Lett* 379:1–6. [Nature news](https://www.nature.com/news/2004/041206/full/news041206-10.html)
- Persinger M.A. & Healey F. (2002). Experimental facilitation of the sensed presence. *J Nerv Ment Dis* 190:533–541.
- Richards P.M., Koren S.A., Persinger M.A. (2002). Circumcerebral application of weak complex magnetic fields… *Percept Mot Skills* 95:671–686. [PubMed 12434867](https://pubmed.ncbi.nlm.nih.gov/12434867/)
- Persinger M.A., Koren S.A., Tsang E.W. (2003). Enhanced power within a specific band of theta activity in one person while another receives circumcerebral pulsed magnetic fields. *Percept Mot Skills* 97:877–894. PMID 14738355
- Persinger M.A. et al. (2002). Remote viewing with the artist Ingo Swann. *Percept Mot Skills* 94:927–949. PMID 12081299
- Booth J.N., Koren S.A., Persinger M.A. (2003). Increased proportions of sensed presences and occipital spikes with 1- and 10-msec point duration. *Percept Mot Skills* 97:951–952. [doi](https://doi.org/10.2466/pms.97.7.951-952)
- Persinger M.A. & Saroka K.S. (2012). Harribance. [PMC3410194](https://pmc.ncbi.nlm.nih.gov/articles/PMC3410194/)
- Persinger M.A. & Krippner S. (1989). Dream ESP experiments and geomagnetic activity. *J Am Soc Psych Res* 83:101–106.
- Spottiswoode S.J.P. (1997). Apparent association between effect size in free response anomalous cognition experiments and local sidereal time. *J Sci Exploration* 11(2). [Psi Encyclopedia](https://psi-encyclopedia.spr.ac.uk/articles/james-spottiswoode/)
- Gendle M.H. & McGrath M.G. (2012). Can the 8-coil Shakti alter subjective emotional experience? *Percept Mot Skills*. [Elon news](https://www.elon.edu/u/news/2012/02/17/mat-gendle-megan-mcgrath-11-publish-research-on-shakti-device/)
- Blanke O. et al. (2002). Stimulating illusory own-body perceptions. *Nature* 419:269–270.
- Arzy S. et al. (2006). Induction of an illusory shadow person. *Nature* 443:287. [PubMed 16988702](https://pubmed.ncbi.nlm.nih.gov/16988702/)
- Blanke O. et al. (2014). Neurological and robot-controlled induction of an apparition. *Curr Biol* 24:2681–2686.
- ICNIRP (2010). Guidelines for limiting exposure to time-varying electric and magnetic fields (1 Hz–100 kHz). *Health Physics* 99:818–836.
- AIR (1995). An evaluation of remote viewing: research and applications. [CIA reading room](https://www.cia.gov/readingroom/print/304501)
- [God helmet (Wikipedia)](https://en.wikipedia.org/wiki/God_helmet) · [SkepDic](https://www.skepdic.com/godhelmet.html) · [Psi Encyclopedia: Persinger](https://psi-encyclopedia.spr.ac.uk/articles/michael-persinger/)

**Vendor pages** (claims): [god-helmet.com](https://www.god-helmet.com/wp/) · [8-coil Shakti](https://www.god-helmet.com/wp/winshakti/rotating/index.htm) · [Shakti safety](https://www.god-helmet.com/wp/winshakti/safety.htm) · [Shiva](https://www.god-helmet.com/wp/shiva/index.htm) · [Shiva evidence](https://www.god-helmet.com/wp/shiva/shiva_evidence.htm) · [OBE page](https://www.god-helmet.com/wp/winshakti/rotating/shakti_obe.htm)

**Local archive (ark-db)**
- Persinger, *No More Secrets* lecture transcript (2007).
- McMoneagle, *Remote Viewing Secrets* (2000; reprints Spottiswoode's LST and geomagnetic abstracts).
- Ramachandran, *The Tell-Tale Brain*; Gazzaniga, *Human*; Damasio, *Looking for Spinoza* (Blanke OBE case).
- Newberg, *Principles of Neurotheology*.
- Winkelman, *Shamanism* (temporal lobe epilepsy, déjà vu).
- Note: much of that archive is fringe or conspiracy material; only primary-source excerpts were used.

**Datasheet:** Analog Devices AD5308/AD5318/AD5328 Rev. F ([analog.com](https://www.analog.com/media/en/technical-documentation/data-sheets/AD5308_5318_5328.pdf)).
