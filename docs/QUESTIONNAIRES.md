# Questionnaires

Guides can show a questionnaire step (`"input": { "type": "questionnaire", "instrument": "<id>" }`, see [GUIDES.md](GUIDES.md)). The instruments live in `webapp/src/lib/instruments.js`. Answers and scores are stored with the guide run, only on this device unless you export the runs (Guides tab, JSON).

**None of this is diagnostic.** These are research covariates and session self-reports. Scores are never a verdict on you, your health or your abilities. Several scales here overlap with measures of unusual experiences in general (e.g. SenPQ correlates r = .64 with O-LIFE Unusual Experiences; Barnby & Bell 2017). A high score means nothing clinical. If a session leaves you frightened or low, stop and see [SAFETY.md](SAFETY.md).

## How to use them

- **Traits at enrollment, on a separate day.** Fill in TIPI, IPIP, SSS and SenPQ once, at least a day before the first session, framed as "personality and experience". Belief and religiousness questions given right before a session can act as a prime (Granqvist & Larsson 2006). Trait scales filled in right after a session can be coloured by it (Lifshitz, van Elk & Luhrmann 2019).
- **Before a session:** `expectancy` only. It asks about belief in ESP *in this app* and in your own ability, because the sheep-goat effect concerns the task at hand. General belief in ESP is a trait question and is not in `expectancy`. Ask it at enrollment with a guide `rating` input, for example:
  `{ "type": "rating", "items": [{ "key": "belief-general", "label": "How much do you believe that ESP (getting information without the known senses) exists at all?", "min": 0, "max": 10, "minLabel": "Not at all", "maxLabel": "Completely" }] }`
- **After a session, in this order:**
  1. a free description (guide `text` input), before any checklist, because checklist wording shapes what people report (Lifshitz 2019);
  2. `state-post` or `gateway-report`;
  3. `blinding`, before the condition is revealed.
- **Trait effects show up under sham too.** Absorption, belief and spirituality predict "experiences" with an inert helmet (Granqvist et al. 2005; Maij & van Elk 2018). A trait main effect is not evidence of a field effect. The informative test is real vs sham, and trait × condition.
- **Decide your covariates in advance.** Correlations of r ≈ .1–.2 need roughly 200–780 participants. With one person, use the scales to describe yourself, not to test hypotheses.

## Overview

| id | Instrument | Items | Scale | When | Licence |
|---|---|---|---|---|---|
| `tipi` | Ten-Item Personality Inventory | 10 | 1–7 | enrollment | free for any purpose |
| `ipip-imagination` | IPIP Imagination (counterpart of MPQ Absorption) | 10 | 1–5 | enrollment | public domain |
| `sss` | Short Suggestibility Scale (MISS) | 21 | 1–5 | enrollment | free, keep copyright, no changes |
| `senpq` | Sensed Presence Questionnaire | 16 | 1–5 | enrollment | CC BY 4.0 |
| `expectancy` | Pre-session expectancy, belief, state | 10 | 0–10 (+ hours, yes/no) | before | app-authored |
| `blinding` | Real/sham guess + confidence, per blinded condition | 4 | guess, 0–10 | after | app-authored |
| `state-post` | Post-session experience ratings | 9 | 0–10 | after | app-authored |
| `gateway-report` | Gateway-style session report | 19 | minutes, 0–10, 0–2, 0–3 | after | app-authored |

## Data format

- **Answers** are `{ itemId: number }` (an array in item order also works).
  - Numeric strings such as `"7.5"` are accepted.
  - A blank (`""`, `" "`, `null`) counts as unanswered.
  - Invalid: booleans, other types, a fraction on a rating or choice item, a value outside the range, and a number item value that is off its `step`.
  - `checkAnswers(instrument, answers, context)` returns `{ missing, invalid }` item ids. `isComplete()` is true when both are empty.
- **Scale labels:** `scale.labels` has one label per point (`labels[i]` belongs to `scale.min + i`) or only the two end labels (0–10 rating rows). There are no empty labels. `scaleAnchors(scale)` returns the labelled points as `[{ value, label }]`.
- **Item kinds:**
  - no `kind`: a row of numbers. It uses the item's own `item.scale` or the instrument scale, and shows the labelled points as anchors;
  - `kind: "choice"`: categorical (yes/no, the blinding guess, clearly/partly/not at all, side-effect severity). Every option has a label and the UI must show all of them;
  - `kind: "number"`: a free number with `min`, `max`, `step` and `unit` (hours slept, estimated minutes). These items have `scale: false`. A UI that resolves `item.scale ?? instrument.scale` therefore shows no buttons, instead of a 0–10 row whose answers would be stored as hours or minutes.
  - `itemScale(instrument, item)` returns the scale (null for number items).
- **Conditional items:** `item.askIf` limits an item:
  - `{ blinded: "audio" | "helmet" }` asks it only when that condition was blinded in this run;
  - `{ item, in: [...] }` asks it only after some answers to another item.
  - The run context is `{ blinded: { audio, helmet } }`. `isAsked(instrument, item, answers, context)` returns true (ask and require), false (skip) or null (context unknown: show it but do not require it).
- **Scores:** `score(answers, context)` returns `{ name: number }`. Published totals are called `total`; subscales and single items use readable names (e.g. `Extraversion`, `Benign`, `Sensed presence`).
- **Missing answers:** a scale with a missing or invalid item scores `null`. Nothing is prorated.
- **Safety alerts:** `alerts(answers)` returns `[{ id, item, message, href }]` for answers that should lead to [SAFETY.md](SAFETY.md) (`href` is `#docs/safety`). It is empty for instruments without rules. The rules are listed under each instrument.
- **Frozen:** `INSTRUMENTS` and everything in it are frozen (`Object.freeze`).

### For the questionnaire UI

- Render each item from `itemInput(instrument, item)`:
  - `{ kind: "number", min, max, step, unit }` → `<input type="number">` with these attributes and the unit;
  - `{ kind: "choice", options: [{ value, label }] }` → one radio per option with its label visible (not only in `aria-label`);
  - `{ kind: "scale", min, max, anchors }` → numbered buttons with the anchor labels.
- Build a legend line from `scaleAnchors(instrument.scale)`, so unlabelled points never print as `n = `.
- Pass the run context to `checkAnswers`/`isComplete`/`isAsked`, from the run record: `{ blinded: { audio: !!run.audio?.blind, helmet: !!run.helmet?.blind } }`. Hide items whose `isAsked()` is false.
- `gateway-report` time error: call `score(answers, { actualMinutes: sessionMinutes(guide, run.steps) })`. If the run is still in progress, use the steps recorded so far, or recompute the time error after the run. `sessionMinutes` sums the `activeMs` of the steps that played audio or ran the helmet arm, and returns null if there are none.
- After scoring, show `alerts(answers)` with a link to `href`.

## TIPI: Ten-Item Personality Inventory

- **Measures:** the Big Five (Extraversion, Agreeableness, Conscientiousness, Emotional Stability, Openness to Experiences), two items each.
- **Items:** 10 trait-word pairs after the stem "I see myself as:".
- **Scale:** 1 = Disagree strongly … 7 = Agree strongly.
- **Scoring (author's page):**
  - Recode items 2, 4, 6, 8 and 10 (7 ↔ 1, 6 ↔ 2, 5 ↔ 3).
  - Each domain is the mean of its two items.
  - Pairs: Extraversion 1, 6R; Agreeableness 2R, 7; Conscientiousness 3, 8R; Emotional Stability 4R, 9; Openness 5, 10R.
  - Published example: item 1 = 5 and item 6 = 2 (recoded 6) give Extraversion (5 + 6) / 2 = 5.5. The unit test checks this.
- **Licence:** "WANT TO USE THE TIPI? GO AHEAD. ANYONE CAN USE IT FOR ANY PURPOSE. NO NEED TO ASK ME FOR PERMISSION." (https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/). Item texts and anchors are verbatim. The instruction says "choose a number for each statement" instead of "write a number next to each statement".
- **Citation:** Gosling, S. D., Rentfrow, P. J., & Swann, W. B., Jr. (2003). A very brief measure of the Big-Five personality domains. *Journal of Research in Personality*, 37, 504–528.
- **Why it is here:**
  - Openness and extraversion are reported correlates of psi scores (Bem & Honorton 1994: extraversion r ≈ .18–.20). These correlates are disputed, like psi itself.
  - Mossbridge & Radin (2021) used the same 10 items in a smartphone psi app, also to flag inattentive responders (inconsistent pairs).
  - It takes about one minute.
- **Caveats:** two items per domain give low internal consistency. Use it to describe people, not as a precise measure.

## IPIP Imagination (counterpart of MPQ Absorption)

- **Measures:** imaginative absorption, i.e. fantasy, daydreaming, getting lost in thought, and aesthetic and reflective involvement. IPIP built this preliminary scale as the public-domain counterpart of Absorption in Tellegen's Multidimensional Personality Questionnaire (MPQ). The Tellegen Absorption Scale (TAS) is that MPQ scale.
- **Items:** 10, verbatim from the IPIP key: 6 positively keyed, 4 negatively keyed. The key lists the + items first, then the − items. The app shows them in a fixed mixed order of its own.
- **Scale:** 1 = Very Inaccurate … 5 = Very Accurate.
- **Scoring (IPIP instructions):** + keyed items score 1–5. The − keyed items ("Do not like poetry", "Do not like art", "Seldom get lost in thought", "Rarely look for a deeper meaning in things") score 5–1. Total = sum, 10–50.
- **Psychometrics (IPIP comparison table, Eugene-Springfield community sample, N = 448):**
  - alpha .78 (MPQ Absorption .90);
  - mean inter-item correlation .27;
  - r = .62 with MPQ Absorption (.74 corrected for unreliability).
- **Licence:** "The items and scales are in the public domain, which means that one can copy, edit, translate, or use them for any purpose without asking permission and without paying a fee." (https://ipip.ori.org/). Permission page: "permission has already been automatically granted for any person to use IPIP items, scales, and inventories for any purpose, commercial or non-commercial" (https://ipip.ori.org/newPermission.htm).
  - Items are verbatim.
  - The instructions are those of the IPIP sample questionnaire. Its confidentiality sentence is replaced by "Your answers are stored only on this device unless you export them."
- **Citation:** Goldberg, L. R., Johnson, J. A., Eber, H. W., Hogan, R., Ashton, M. C., Cloninger, C. R., & Gough, H. G. (2006). The International Personality Item Pool and the future of public-domain personality measures. *Journal of Research in Personality*, 40, 84–96. Key: https://ipip.ori.org/newMPQKey.htm; comparison table: https://ipip.ori.org/newMPQTable.htm.
- **Why it is here:**
  - Absorption is the best-replicated predictor of sham-helmet and spiritual experiences (Granqvist et al. 2005; Maij & van Elk 2018; Lifshitz, van Elk & Luhrmann 2019).
  - The TAS needs a licence from University of Minnesota Press, and MODTAS needs the author's permission. This scale is the free fallback.
  - It has no sensed-presence item, so it does not overlap with the presence outcome.
- **Caveats:**
  - It is a proxy. It shares about 40 % of its variance with MPQ Absorption (r = .62), and it has not been validated as a predictor of sham-helmet responses. Do not compare its scores with published TAS scores.
  - IPIP calls it preliminary. Only the alpha and the MPQ correlation above are reported for it; there are no norms.
  - It is not the Big-Five Factor V "Intellect/Imagination" marker scale (Goldberg 1992), which shares one item ("Have a vivid imagination") but measures intellect, not absorption.

## SSS: Short Suggestibility Scale

- **Measures:** self-reported trait suggestibility, the general tendency to accept messages from others, the media or one's own body. The 21 items come from the five MISS suggestibility subscales: consumer suggestibility 5, sensation contagion 5, persuadability 4, peer conformity 4, physiological reactivity 3.
- **Items:** 21, verbatim and in the order of the official form, with the copyright line shown above them.
- **Scale:** 1 = not at all or very slightly, 2 = a little, 3 = somewhat, 4 = quite a bit, 5 = a lot.
- **Scoring:**
  - Sum of the 21 items (21–105). There are no reverse-keyed items. The manual scores the SSS as one total.
  - Norms (manual): undergraduates M = 53.80 (SD 10.90, N = 1957); community M = 44.29 (SD 11.63, N = 275).
  - Reliability .86–.89; test-retest .76 over about 2 months.
- **Licence:** "MISS. Copyright © 2004 by R. I. Kotov, S. B. Bellman & D. B. Watson". The manual says: "The MISS is a property of Kotov, Bellman, and Watson. It is available for use without charge. No author permission is required. However, please include copyright information on all reproductions of the scale. […] Do not modify the instrument without authors' permission." Manual: https://renaissance.stonybrookmedicine.edu/sites/default/files/MISSBriefManual.pdf. Form: https://renaissance.stonybrookmedicine.edu/sites/default/files/SSS_BLANK.pdf. **Do not edit the item texts or the instruction.** A unit test pins a SHA-256 of the instruction, labels and items; it fails on any change.
- **Citation:** Kotov, R. I., Bellman, S. B., & Watson, D. B. (2004). *Multidimensional Iowa Suggestibility Scale (MISS) brief manual*. Stony Brook University.
- **Why it is here:**
  - The best-known blinded God-helmet study, Granqvist et al. (2005; N = 89, double-blind, sham control), found that "suggestibility" predicted sensed-presence, mystical and somatosensory reports, while the field did not.
  - Their suggestibility measures were absorption (TAS), a temporal-lobe-signs inventory and a New Age orientation scale. They did **not** use the SSS.
  - The SSS is a free, open self-report of a related trait. It lets you check whether people who accept suggestions easily report more in both arms.
- **Caveats:**
  - The SSS measures interpersonal and sensory-contagion suggestibility, not hypnotic or imaginative suggestibility.
  - It correlates only .07 with the Tellegen Absorption Scale (manual, N = 254). The MISS total correlates .29 with the Stanford hypnotic scale.
  - It complements an absorption measure; it does not replace one.

## SenPQ: Sensed Presence Questionnaire

- **Measures:** how often you sensed an unseen presence **during the last month**, excluding drug-induced experiences. Two exploratory factors: benign (protective, accompanying) and malign (threatening, at night).
- **Items:** 16, verbatim from the official form (version 1.0).
- **Scale:** Never, Occasionally, Sometimes, Very Often, Almost Always, coded 1–5. The paper's text says "Always"; the official form says "Almost Always", and we use the form.
- **Scoring:**
  - Total = sum of the 16 items (16–80).
  - Benign = items 3, 5, 6, 7, 8, 11, 12, 13, 15 (9–45).
  - Malign = items 1, 2, 4, 7, 9, 10, 14, 16 (8–40).
  - Item 7 loads on both factors (Table 4) and counts in both.
  - We checked these keys against the authors' cleaned data on OSF: the sums reproduce their total, benign and malign columns for all 191 participants.
  - Alpha .951. Norms (Table 2): non-religious M = 21.34 (SD 8.14), religious M = 26.55 (SD 11.86), all M = 23.28 (SD 9.98).
- **Licence:** the paper says "The questionnaire is freely available online and has been released under a Creative Commons license at the following link: https://osf.io/fecgz/". The OSF project licence is CC-BY Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/). The article itself is "distributed under the terms of the Creative Commons Attribution License, which permits unrestricted use, distribution, reproduction and adaptation in any medium and for any purpose provided that it is properly attributed."
  - Changes: the typo in the first sentence ("This is questionnaire asks") is fixed, and the answer options run from Never to Almost Always rather than the reverse.
- **Citation:** Barnby, J. M., & Bell, V. (2017). The Sensed Presence Questionnaire (SenPQ): initial psychometric validation of a measure of the "Sensed Presence" experience. *PeerJ*, 5, e3149. https://doi.org/10.7717/peerj.3149
- **Why it is here:** sensed presence is the God helmet's signature claim. The SenPQ is the best open measure of how prone someone is to it at baseline. Persinger's group reported that prior sensed-presence history correlated with exotic beliefs and temporal-lobe sensitivity (St-Pierre & Persinger 2006).
- **Caveats:**
  - It is a trait/baseline measure with a one-month window. Do not use it as the session outcome; it has not been validated for that.
  - The two factors are exploratory and still need confirmation.
  - The malign items overlap with sleep paralysis and anxiety.

## Expectancy (app-authored)

- **Measures:** what you expect and believe just before a session, and your state. Items:
  - expect something unusual; expect the session to change how you feel;
  - belief that ESP can show up in this app's tasks, and that you yourself have it;
  - confidence of doing well;
  - relaxed, tense, sleepy;
  - hours slept;
  - alcohol/cannabis/drugs in the last 12 h.
- **Items:** 10. Scale 0–10, plus hours (number, steps of 0.5 h, 0–24) and yes/no.
- **Scoring:** each item on its own, not summed (single-item measures).
- **Licence:** our own wording, no third-party item text; same terms as this repository.
- **Sources:**
  - The belief items follow the sheep-goat literature, where belief in success *in this experiment* matters most (Palmer's criteria, Psi Encyclopedia "Sheep-Goat Effect").
  - Mossbridge & Radin (2021, pp. 82–83) asked about belief in one's **own** psi ability with single 1–5 items and found belief related to performance on all three tasks.
  - Expectancy manipulations change sham-helmet experiences (Maij & van Elk 2018).
  - The tension item tests a claim in McDonnell's 1983 Army assessment of the Gateway process (CIA-RDP96-00788R001700210016-5): progress depends on releasing anxieties, so baseline tension may moderate responses. This is a claim without data.
- **Safety alert:** alcohol, cannabis or another drug in the last 12 h (SAFETY.md advises against a session).
- **Caveats:**
  - Belief questions just before a session can act as a prime (Granqvist & Larsson 2006). That is why the general-belief question moved to enrollment (see "How to use them"). The two remaining belief items are about this session's task, which is what the sheep-goat effect is about. Expect them to carry some of the same priming.
  - Unvalidated wording.

## Blinding check (app-authored)

- **Measures:** whether the blind held, separately for each blinded condition. For each one you guess real, sham or don't know, and say how sure you are.
- **Items:** 4.
  - `guess-audio`: was the audio real or sham? Asked when the run's audio was blinded (`askIf: { blinded: "audio" }`). Its truth is the run's audio sham flag (`audio.sham`, revealed as `real`/`sham`).
  - `confidence-audio`: 0 (pure guess) to 10 (completely sure). Asked only after a real or sham guess.
  - `guess-helmet`: was the helmet field real or sham? Asked when the helmet arm was blinded (`askIf: { blinded: "helmet" }`). Its truth is the helmet log's condition (`active`/`sham`, revealed by `log.rate`).
  - `confidence-helmet`: as above, for the helmet guess.
  - Guesses are coded −1 sham, 0 don't know, +1 real.
  - After "don't know" the confidence item is not asked, and its score is `null`. Do not fill it in as 0.
- **Scoring:** per session, the guesses and confidences (`Guess: audio`, `Confidence: audio`, `Guess: helmet`, `Confidence: helmet`). Across sessions, `bangIndex(records)` gives the **Bang Blinding Index** per arm: BI = (correct − incorrect) / all answers in that arm, with "don't know" in the denominator (Bang, Ni & Davis 2004; same as the CRAN package `BI`).
  - Build one set of records per condition, e.g. `{ arm: run.reveal.audio, guess: run.reveal.guess.audio }`.
  - `arm` may be `real`, `active` or `sham`. `guess` may be `real`, `active`, `sham`, `dontknow`, `unsure`, or the item codes +1/0/−1 (numbers or strings).
  - Any other record (a missing, empty, boolean or unknown guess, or an unknown arm) is skipped and counted in `excluded`. It is never counted as "don't know".
  - BI = 0 is consistent with intact blinding. BI = 1 means everyone guessed right (blinding broken). BI = −1 means everyone guessed the opposite.
  - The function also returns a standard error. A unit test checks it against the 95 % intervals published by Petroff et al. 2024 (Table 4).
- **Licence:** our own wording, after the published guess format; same terms as this repository.
- **Citation:** Bang, H., Ni, L., & Davis, C. E. (2004). Assessment of blinding in clinical trials. *Controlled Clinical Trials*, 25, 143–156. https://europepmc.org/abstract/MED/15020033
- **Why it is here:** every blinded helmet or sham-audio session ends with it, before the reveal. The guess is also an expectancy covariate.
- **Caveats:**
  - A correct guess can come from a real effect, so unblinding and efficacy are confounded.
  - With few sessions the standard error is large. Look at the interval, not only the estimate.
  - The audio sham (beats forced to 0 Hz) is our own design: Padmanabhan and Wahbeh removed the tones altogether, and Lane 1998 did not analyse its no-beat tape as a control.

## Post-session ratings (app-authored)

- **Measures:** nine 0–10 ratings of the session just finished. The instructions say 0 = not at all and 10 = the strongest you can imagine, and name valence as the one exception:
  - overall intensity;
  - sensed presence;
  - out-of-body or vestibular feelings (floating, spinning, tilting);
  - body sensations (tingling, vibration, warmth);
  - visual imagery;
  - emotional valence (0 very unpleasant, 5 neutral, 10 very pleasant);
  - anxiety;
  - time distortion;
  - sleepiness.
- **Scoring:**
  - Each item is reported on its own.
  - `Anomalous experience` is the mean of presence, out-of-body, body sensations, imagery and time distortion. It is app-defined and unvalidated, so pre-register it if you use it.
- **Licence:** our own wording; same terms as this repository.
- **Sources:**
  - The content areas follow the God-helmet and sham-helmet literature: presence, mystical and somatosensory reports in Granqvist et al. 2005; extraordinary experiences under an inert helmet in Maij & van Elk 2018.
  - Persinger's EXIT post-exposure scale was never published as an item set, so we did not try to reproduce it.
- **Why it is here:** these are the outcomes compared between real and sham sessions.
- **Caveats:**
  - Single items, unvalidated, no norms. Valence is bipolar, so do not average it with the others.
  - Collect a free report first.
- **Safety alerts:** anxiety or fear ≥ 8; sensed presence ≥ 5 together with anxiety ≥ 5; valence ≤ 1 (very unpleasant). The UI then links to [SAFETY.md](SAFETY.md).

## Gateway-style session report (app-authored)

- **Measures:**
  - **Time estimate:** "how many minutes do you think the session lasted?", asked first and without a clock.
  - **Depth** (0–10).
  - **"Mind awake":** how awake the mind was while the body rested (0–10).
  - **Hand-location marker:** could you feel where your hands were? Clearly / partly / not at all (choice).
  - **Fell asleep:** no / unsure / yes (choice).
  - **Perception channels** (0–10 each): kinesthetic, intuitive knowing, auditory, visual.
  - **State now** (0–10): calm, alert, drowsy.
  - **Seven side effects** (choice: 0 none, 1 mild, 2 moderate, 3 severe): headache, dizziness, nausea, anxiety or panic, disorientation or confusion, low mood, ringing ears or a hearing change.
- **Items:** 19, counted from the list above.
- **Scoring:**
  - Each item on its own.
  - `Side effects (sum)` is 0–21.
  - With `score(answers, { actualMinutes })` you also get `Time error (min)` = estimate − actual, and its absolute value. `actualMinutes` may be a number or a numeric string. If it is invalid, both values are `null`. Use `sessionMinutes(guide, run.steps)` for the actual length (see "For the questionnaire UI").
  - The time estimate is a number item: whole minutes, 0–300.
  - Compare beats vs sham within person.
- **Licence:** our own wording; no Monroe Institute text, tape script or affirmation is reproduced. Same terms as this repository.
- **Sources:**
  - The hand-location marker (no longer aware of where the body parts are, without losing consciousness) is in Atwater 1997, *Journal of Scientific Exploration* 11(3), p. 272, and in an anonymous evaluation (probably by Atwater, post-1986) in the Army MIAS file, CIA-RDP96-00788R001700210004-8. That evaluation is not a Monroe Institute paper.
  - The four perception channels (body feeling or movement, sudden knowing, sounds, images) are our own grouping. Practitioner write-ups attribute similar categories to the Gateway course manual, but we found no public copy to cite.
  - The time probe tests the "state of no time" described for Focus 15 in Monroe's *Ultimate Journey* (1994).
  - Side effects come from three sources: events tracked in the Xiong 2025 meta-analysis (nausea, dizziness, hearing; https://pubmed.ncbi.nlm.nih.gov/41176178/); low mood after 7 Hz beats in Wahbeh 2007 (https://pubmed.ncbi.nlm.nih.gov/17388762/); and disorientation and "intolerable nervousness" in the MIAS research history (CIA-RDP96-00788R001700210025-5).
- **Safety alerts:** any side effect rated severe; anxiety or panic, or low mood, rated moderate or severe.
- **Why it is here:** it turns Gateway's claims (a "mind awake, body asleep" state, perception through several channels, "no time") into items that can be compared between real beats and the Δ = 0 sham.
- **Caveats:**
  - The time estimate only means something if the session length is unknown. In blinded mode, guides should randomise the length (e.g. ±2 min) and hide all clocks.
  - Theta/delta beats did worse than beta on vigilance in Lane 1998, but that study had no no-beat control. Garcia-Argibay 2019 found reduced recall against a noise control.
  - No driving for 30 min after deep sessions.

## Considered but not included

These are good instruments, but their item text is copyrighted or its licence is unclear. The app does not reproduce them. Get permission first, then add them.

| Instrument | Why it would help | Licence status |
|---|---|---|
| Tellegen Absorption Scale (34 items) | Best-replicated predictor of sham-helmet and spiritual experiences; used by Granqvist 2005 | University of Minnesota Press copyright; permission needed |
| Modified TAS (Jamieson 2005) | Likert version with an ESP subscale | Unclear; ask the author and UMN Press |
| Revised Transliminality Scale (17 of 29 items scored) | One scale for the transliminality / temporal-lobe-lability factor; use the erratum key without the presence item | No open licence found |
| Persinger's Personal Philosophy Inventory (CPES) | Tests Persinger's own responder hypothesis | No published manual or licence |
| Australian Sheep-Goat Scale (18 items) | Standard psi-belief measure | No open licence found |
| MEQ30 | Best-validated state mystical-experience outcome | Ask the authors |
| Hood Mysticism Scale | Lifetime mystical experience; outcome in sham-helmet studies | Permission needed |
| PCI (Pekala) | Session state profile with a reliability index | Permission needed |
| Creative Experiences Questionnaire | Fantasy proneness | Personal or research use only |
| O-LIFE short form | Safety covariate only; never shown to users | Research use with acknowledgement |
| STAI, POMS | Outcomes in the binaural-beat trials | Commercial; do not embed |

## Sources

- TIPI: https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/
- IPIP: https://ipip.ori.org/, https://ipip.ori.org/newMPQKey.htm, https://ipip.ori.org/newMPQTable.htm, https://ipip.ori.org/newScoringInstructions.htm, https://ipip.ori.org/newPermission.htm
- Goldberg et al. 2006, *Journal of Research in Personality* 40:84–96 (the IPIP)
- MISS/SSS: https://renaissance.stonybrookmedicine.edu/sites/default/files/MISSBriefManual.pdf, https://renaissance.stonybrookmedicine.edu/sites/default/files/SSS_BLANK.pdf
- SenPQ: https://pmc.ncbi.nlm.nih.gov/articles/PMC5372834/, https://osf.io/fecgz/
- Granqvist et al. 2005, *Neuroscience Letters* 379:1–6: https://europepmc.org/abstract/MED/15849873
- Granqvist & Larsson 2006 (pre-session questionnaires as primes): https://europepmc.org/abstract/MED/16967739
- Maij & van Elk 2018 (placebo helmet, expectancy, absorption): https://europepmc.org/abstract/MED/30355534
- Lifshitz, van Elk & Luhrmann 2019, *Consciousness and Cognition* (absorption review, report wording): https://thefpr.org/wp-content/uploads/Lifshitz-van-Elk-Luhrmann-Consciousness-and-Cognition.pdf
- Mossbridge & Radin 2021, *Journal of Anomalous Experience and Cognition*: https://journals.lub.lu.se/jaex/article/download/23419/20896
- Bem & Honorton 1994, *Psychological Bulletin* 115:4–18
- Bang, Ni & Davis 2004: https://europepmc.org/abstract/MED/15020033
- Petroff, Bacak, Dagres, Dilk & Wachter 2024, A simple blinding index for randomized controlled trials, *Contemporary Clinical Trials Communications* 42:101393: https://pmc.ncbi.nlm.nih.gov/articles/PMC11647154/
- CRAN package `BI` (Bang index and its standard error): https://cran.r-project.org/package=BI
- Atwater 1997: https://soundhealingresearchfoundation.org/wp-content/uploads/2021/12/I.-Accessing-Anomalous-States-of-Consciousness-with-a-Binaural-Beat-Technology.pdf
- Monroe, R. A. (1994). *Ultimate Journey*. Doubleday.
