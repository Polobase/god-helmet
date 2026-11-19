// Questionnaire instruments: item texts, response scales, scoring and safety alerts (docs/QUESTIONNAIRES.md).
// Published item texts are copied verbatim from the official forms; app-authored ones are marked.
//
// Conventions:
// - answers are { [itemId]: number } (an array in item order also works). Numeric strings are accepted;
//   blanks count as unanswered; booleans, fractions on a rating scale and off-step numbers are invalid;
// - scale.labels has one label per point (labels[i] belongs to scale.min + i) or only the two end labels;
// - item kinds: none = a row of numbers; 'choice' = categorical, every label must be shown;
//   'number' = a free number (min, max, step, unit). Number items have scale: false, so a UI that
//   resolves item.scale ?? inst.scale shows no buttons instead of the instrument's rating row.
//   itemInput() returns the control a UI should render;
// - item.askIf limits an item to blinded runs ({ blinded: 'audio' | 'helmet' }) or to some answers of
//   another item ({ item, in: [...] }). The run context is { blinded: { audio, helmet } };
// - score(answers, context) returns null for a scale with an unanswered or invalid item;
//   alerts(answers) lists answers that should lead to the safety notes. None of it is diagnostic.

export const SAFETY_HREF = '#docs/safety'

const zeroTen = (lo, hi) => ({ min: 0, max: 10, labels: [lo, hi] })
const number = (min, max, step, unit) => ({ kind: 'number', scale: false, min, max, step, unit })

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}

export function itemScale(inst, item) {
  return item.kind === 'number' ? null : (item.scale ?? inst.scale)
}

// Labelled points of a scale: [{ value, label }].
export function scaleAnchors(scale) {
  if (!scale) return []
  const labels = scale.labels ?? []
  if (labels.length === scale.max - scale.min + 1) {
    return labels.map((label, i) => ({ value: scale.min + i, label })).filter((a) => a.label)
  }
  if (labels.length === 2) return [{ value: scale.min, label: labels[0] }, { value: scale.max, label: labels[1] }]
  return []
}

// The control for one item:
//   { kind: 'number', min, max, step, unit } -> <input type="number">
//   { kind: 'choice', options: [{ value, label }] } -> one labelled radio per option
//   { kind: 'scale', min, max, anchors: [{ value, label }] } -> numbered buttons, anchors as labels
export function itemInput(inst, item) {
  if (item.kind === 'number') return { kind: 'number', min: item.min, max: item.max, step: item.step ?? 1, unit: item.unit ?? '' }
  const s = itemScale(inst, item)
  if (item.kind === 'choice') return { kind: 'choice', options: scaleAnchors(s) }
  return { kind: 'scale', min: s.min, max: s.max, anchors: scaleAnchors(s) }
}

const DECIMAL = /^[+-]?\d+(\.\d+)?$/
const present = (raw) => raw !== null && raw !== undefined && !(typeof raw === 'string' && raw.trim() === '')
const rawAt = (answers, item, i) => (Array.isArray(answers) ? answers[i] : answers?.[item.id])

function toNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && DECIMAL.test(raw.trim())) return Number(raw.trim())
  return null
}

// Keyed value of one item (reverse-scored if needed), or null when missing or invalid.
function itemValue(inst, item, raw) {
  if (!present(raw)) return null
  const v = toNumber(raw)
  if (v === null) return null
  if (item.kind === 'number') {
    const k = (v - item.min) / (item.step ?? 1)
    return v >= item.min && v <= item.max && Math.abs(k - Math.round(k)) < 1e-9 ? v : null
  }
  const s = itemScale(inst, item)
  if (!Number.isInteger(v) || v < s.min || v > s.max) return null
  return item.reverse ? s.min + s.max - v : v
}

function values(inst, answers) {
  const vals = {}
  inst.items.forEach((item, i) => { vals[item.id] = itemValue(inst, item, rawAt(answers, item, i)) })
  return vals
}

// true = ask and require, false = skip, null = unknown (show it, but do not require it).
export function isAsked(inst, item, answers, context) {
  const cond = item.askIf
  if (!cond) return true
  if (cond.blinded) {
    const b = context?.blinded
    return b && typeof b === 'object' ? !!b[cond.blinded] : null
  }
  const i = inst.items.findIndex((x) => x.id === cond.item)
  if (i < 0) return true
  const v = itemValue(inst, inst.items[i], rawAt(answers, inst.items[i], i))
  return v !== null && cond.in.includes(v)
}

// Item ids that are asked but unanswered, and ids whose answer is present but invalid.
export function checkAnswers(inst, answers, context) {
  const missing = []
  const invalid = []
  inst.items.forEach((item, i) => {
    const raw = rawAt(answers, item, i)
    if (present(raw)) {
      if (itemValue(inst, item, raw) === null) invalid.push(item.id)
    } else if (!item.optional && isAsked(inst, item, answers, context) === true) missing.push(item.id)
  })
  return { missing, invalid }
}

export function isComplete(inst, answers, context) {
  const { missing, invalid } = checkAnswers(inst, answers, context)
  return missing.length === 0 && invalid.length === 0
}

function sum(vals, ids) {
  const xs = ids.map((id) => vals[id])
  return xs.some((x) => x === null || x === undefined) ? null : xs.reduce((a, b) => a + b, 0)
}

function mean(vals, ids) {
  const s = sum(vals, ids)
  return s === null ? null : s / ids.length
}

const atLeast = (x, t) => x !== null && x !== undefined && x >= t
const atMost = (x, t) => x !== null && x !== undefined && x <= t
const alert = (id, item, message) => ({ id, item, message, href: SAFETY_HREF })

// Items carry subscale names; derive { name: [itemIds] } unless given explicitly.
function define(inst) {
  const subscales = { ...inst.subscales }
  if (!inst.subscales) {
    for (const item of inst.items) {
      if (item.subscale) (subscales[item.subscale] ??= []).push(item.id)
    }
  }
  const out = { appAuthored: false, ...inst, subscales: Object.keys(subscales).length ? subscales : undefined }
  // bound, so both are safe to pass around as bare functions
  out.score = inst.score.bind(out)
  out.alerts = (inst.alerts ?? (() => [])).bind(out)
  return deepFreeze(out)
}

// Single-item scales report the item value, multi-item ones the mean.
function scoreSubscales(inst, answers) {
  const vals = values(inst, answers)
  const out = {}
  for (const [name, ids] of Object.entries(inst.subscales ?? {})) {
    out[name] = ids.length === 1 ? vals[ids[0]] : mean(vals, ids)
  }
  return out
}

// ---------------------------------------------------------------------------
// TIPI (Gosling, Rentfrow & Swann 2003)

const tipi = define({
  id: 'tipi',
  name: 'Ten-Item Personality Inventory (TIPI)',
  short: 'TIPI',
  when: 'enrollment',
  measures: 'Big Five personality domains, two items each',
  citation: 'Gosling, S. D., Rentfrow, P. J., & Swann, W. B., Jr. (2003). A very brief measure of the Big-Five personality domains. Journal of Research in Personality, 37, 504–528.',
  url: 'https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/',
  license: 'Free for any purpose. The author\'s page: "Anyone can use it for any purpose. No need to ask me for permission."',
  licenseUrl: 'https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/',
  // the form's stem "I see myself as:" closes the instructions
  instructions: 'Here are a number of personality traits that may or may not apply to you. Please choose a number for each statement to indicate the extent to which you agree or disagree with that statement. You should rate the extent to which the pair of traits applies to you, even if one characteristic applies more strongly than the other.\n\nI see myself as:',
  scale: {
    min: 1,
    max: 7,
    labels: ['Disagree strongly', 'Disagree moderately', 'Disagree a little', 'Neither agree nor disagree', 'Agree a little', 'Agree moderately', 'Agree strongly'],
  },
  scoring: 'Reverse items 2, 4, 6, 8, 10 (8 − x); each domain is the mean of its two items (1–7).',
  items: [
    { id: 'q1', text: 'Extraverted, enthusiastic.', subscale: 'Extraversion' },
    { id: 'q2', text: 'Critical, quarrelsome.', reverse: true, subscale: 'Agreeableness' },
    { id: 'q3', text: 'Dependable, self-disciplined.', subscale: 'Conscientiousness' },
    { id: 'q4', text: 'Anxious, easily upset.', reverse: true, subscale: 'Emotional Stability' },
    { id: 'q5', text: 'Open to new experiences, complex.', subscale: 'Openness to Experiences' },
    { id: 'q6', text: 'Reserved, quiet.', reverse: true, subscale: 'Extraversion' },
    { id: 'q7', text: 'Sympathetic, warm.', subscale: 'Agreeableness' },
    { id: 'q8', text: 'Disorganized, careless.', reverse: true, subscale: 'Conscientiousness' },
    { id: 'q9', text: 'Calm, emotionally stable.', subscale: 'Emotional Stability' },
    { id: 'q10', text: 'Conventional, uncreative.', reverse: true, subscale: 'Openness to Experiences' },
  ],
  score(answers) {
    return scoreSubscales(this, answers)
  },
})

// ---------------------------------------------------------------------------
// IPIP "Imagination": the preliminary IPIP scale for the construct of MPQ Absorption

const ipipImagination = define({
  id: 'ipip-imagination',
  name: 'IPIP Imagination (counterpart of MPQ Absorption, 10 items)',
  short: 'IPIP Imagination',
  when: 'enrollment',
  measures: 'Imaginative absorption: fantasy, daydreaming, getting lost in thought, aesthetic and reflective involvement (public-domain proxy for MPQ Absorption)',
  citation: 'Goldberg, L. R., Johnson, J. A., Eber, H. W., Hogan, R., Ashton, M. C., Cloninger, C. R., & Gough, H. G. (2006). The International Personality Item Pool and the future of public-domain personality measures. Journal of Research in Personality, 40, 84–96. Items and key: IPIP preliminary scales for MPQ constructs, "Imagination" (MPQ Absorption), 6 + 4 items, alpha .78; r = .62 (.74 corrected) with MPQ Absorption, N = 448 (ipip.ori.org).',
  url: 'https://ipip.ori.org/newMPQKey.htm',
  license: 'Public domain. IPIP: "The items and scales are in the public domain, which means that one can copy, edit, translate, or use them for any purpose without asking permission and without paying a fee."',
  licenseUrl: 'https://ipip.ori.org/newPermission.htm',
  instructions: 'Describe yourself as you generally are now, not as you wish to be in the future. Describe yourself as you honestly see yourself, in relation to other people you know of the same sex as you are, and roughly your same age. Your answers are stored only on this device unless you export them. Indicate for each statement whether it is 1. Very Inaccurate, 2. Moderately Inaccurate, 3. Neither Accurate Nor Inaccurate, 4. Moderately Accurate, or 5. Very Accurate as a description of you.',
  scale: {
    min: 1,
    max: 5,
    labels: ['Very Inaccurate', 'Moderately Inaccurate', 'Neither Accurate Nor Inaccurate', 'Moderately Accurate', 'Very Accurate'],
  },
  scoring: '6 + keyed items score 1–5, 4 − keyed items 5–1 (6 − x); total = sum (10–50).',
  // The IPIP key lists + then − items; this mixed order is ours.
  items: [
    { id: 'q1', text: 'Have a vivid imagination.' },
    { id: 'q2', text: 'Do not like poetry.', reverse: true },
    { id: 'q3', text: 'Love to daydream.' },
    { id: 'q4', text: 'See beauty in things that others might not notice.' },
    { id: 'q5', text: 'Seldom get lost in thought.', reverse: true },
    { id: 'q6', text: 'Enjoy wild flights of fantasy.' },
    { id: 'q7', text: 'Do not like art.', reverse: true },
    { id: 'q8', text: 'Love to reflect on things.' },
    { id: 'q9', text: 'Rarely look for a deeper meaning in things.', reverse: true },
    { id: 'q10', text: 'Like to get lost in thought.' },
  ],
  score(answers) {
    const vals = values(this, answers)
    return { total: sum(vals, this.items.map((i) => i.id)) }
  },
})

// ---------------------------------------------------------------------------
// Short Suggestibility Scale (MISS; Kotov, Bellman & Watson 2004). Must not be modified.

const SSS_COPYRIGHT = 'MISS. Copyright © 2004 by R. I. Kotov, S. B. Bellman & D. B. Watson'

const sss = define({
  id: 'sss',
  name: 'Short Suggestibility Scale (SSS, from the MISS)',
  short: 'SSS',
  when: 'enrollment',
  measures: 'Self-reported trait suggestibility (consumer, persuadability, sensation contagion, physiological reactivity, peer conformity)',
  copyright: SSS_COPYRIGHT,
  citation: `Kotov, R. I., Bellman, S. B., & Watson, D. B. (2004). Multidimensional Iowa Suggestibility Scale (MISS): Brief manual. Stony Brook University. ${SSS_COPYRIGHT}.`,
  url: 'https://renaissance.stonybrookmedicine.edu/sites/default/files/SSS_BLANK.pdf',
  license: `${SSS_COPYRIGHT}. Manual: "It is available for use without charge. No author permission is required. However, please include copyright information on all reproductions of the scale. [...] Do not modify the instrument without authors' permission."`,
  licenseUrl: 'https://renaissance.stonybrookmedicine.edu/sites/default/files/MISSBriefManual.pdf',
  instructions: `${SSS_COPYRIGHT}\n\nPlease indicate to what extent the following statements apply to you. Use the following scale to record your answers:`,
  scale: { min: 1, max: 5, labels: ['not at all or very slightly', 'a little', 'somewhat', 'quite a bit', 'a lot'] },
  scoring: 'Sum of the 21 items (21–105); no reverse-keyed items. Norms: undergraduates 53.80 (SD 10.90), community 44.29 (SD 11.63).',
  items: [
    'I am easily influenced by other people’s opinions',
    'I get a lot of good practical advice from magazines or TV',
    'When someone coughs or sneezes, I usually feel the urge to do the same',
    'Imagining a refreshing drink can make me thirsty',
    'A good salesperson can really make me want their product',
    'I have picked-up many habits from my friends',
    'It is important for me to fit in',
    'When I see someone shiver, I often feel a chill myself',
    'I get my style from certain celebrities',
    'When people tell me how they feel, I often notice that I feel the same way',
    'When making a decision, I often follow other people’s advice',
    'Reading descriptions of tasty dishes can make my mouth water',
    'I get many good ideas from others',
    'I can be influenced by a good commercial',
    'After I see a commercial for lotion, sometimes my skin feels dry',
    'I discovered many of my favorite things through my friends',
    'If a product is nicely displayed, I usually want to buy it',
    'Thinking about something scary can make my heart pound',
    'I frequently change my opinion after talking with others',
    'If I am told I don’t look well, I start feeling ill',
    'I follow current fashion trends',
  ].map((text, i) => ({ id: `q${i + 1}`, text })),
  score(answers) {
    const vals = values(this, answers)
    return { total: sum(vals, this.items.map((i) => i.id)) }
  },
})

// ---------------------------------------------------------------------------
// Sensed Presence Questionnaire (Barnby & Bell 2017), form version 1.0

const senpq = define({
  id: 'senpq',
  name: 'Sensed Presence Questionnaire (SenPQ)',
  short: 'SenPQ',
  when: 'enrollment',
  measures: 'Frequency of sensed-presence experiences in the last month (benign and malign factors)',
  citation: 'Barnby, J. M., & Bell, V. (2017). The Sensed Presence Questionnaire (SenPQ): initial psychometric validation of a measure of the "Sensed Presence" experience. PeerJ, 5, e3149. doi:10.7717/peerj.3149. Form: Barnby and Bell (2016), version 1.0, osf.io/fecgz.',
  url: 'https://osf.io/fecgz/',
  license: 'Creative Commons Attribution 4.0 (CC BY 4.0) on the OSF project; the article is CC BY. Attribution: Barnby & Bell 2017, PeerJ, doi:10.7717/peerj.3149. Changes: typo fixed in the first sentence; answer options shown from Never to Almost Always; apostrophes set in one style.',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  instructions: 'This questionnaire asks about the experience of perceiving or sensing another presence. Please answer each question as honestly and as accurately as you can, but please do not include any experience that you may have had while under the influence of recreational drugs.\n\nWhen the questionnaire asks about feeling or perceiving another presence, please answer in terms of you genuinely having a sense or perception that the presence was there, not just that you believed it was there.\n\nPlease only consider experiences you have had during the last month.',
  scale: { min: 1, max: 5, labels: ['Never', 'Occasionally', 'Sometimes', 'Very Often', 'Almost Always'] },
  scoring: 'Items coded 1 (Never) to 5 (Almost Always). Total = sum of 16 (16–80); Benign = items 3, 5, 6, 7, 8, 11, 12, 13, 15 (9–45); Malign = items 1, 2, 4, 7, 9, 10, 14, 16 (8–40). Item 7 loads on both factors. Keys checked against the authors\' published data (OSF).',
  items: [
    'I have felt another being or beings near me when I couldn’t see anyone around me that could explain it',
    'When half asleep I have thought someone else was with me, only to find out when I woke up that they couldn’t have been',
    'When I was under a lot of pressure, I felt someone or something was accompanying me',
    'I have had the feeling that a negative or hurtful presence was around me that I couldn’t see',
    'During times of stress I have had the feeling that I was being accompanied by an unseen presence',
    'I have felt I was being watched over by caring being that I couldn’t see',
    'When I have visited specific locations, I felt I was in the presence of an unseen being or beings',
    'I have felt when an unseen presence has arrived',
    'I have woken up during the night with the feeling that an unseen presence was in the room with me',
    'I have felt as if someone or something is near me, even though I know it is not really the case',
    'I have visited certain places where I can feel the presence of distinct but unseen beings',
    'I can feel the presence of people that I know are physically distant from me',
    'I have felt the presence of a protective being around me that I couldn’t see',
    'I have felt a sinister or threatening presence around me, despite not being able to see any evidence for it',
    'Even though I knew the person had died, I felt them accompanying me',
    'Even though I knew it was my imagination, I still felt as if someone or something was with me',
  ].map((text, i) => ({ id: `q${i + 1}`, text })),
  subscales: {
    Benign: ['q3', 'q5', 'q6', 'q7', 'q8', 'q11', 'q12', 'q13', 'q15'],
    Malign: ['q1', 'q2', 'q4', 'q7', 'q9', 'q10', 'q14', 'q16'],
  },
  score(answers) {
    const vals = values(this, answers)
    return {
      total: sum(vals, this.items.map((i) => i.id)),
      Benign: sum(vals, this.subscales.Benign),
      Malign: sum(vals, this.subscales.Malign),
    }
  },
})

// ---------------------------------------------------------------------------
// App-authored instruments (our wording, no third-party item text, not validated)

const APP_LICENSE = 'App-authored: our own wording, no third-party item text; same terms as this repository. Not a validated instrument.'
const NO_YES = { min: 0, max: 1, labels: ['No', 'Yes'] }

const expectancy = define({
  id: 'expectancy',
  name: 'Pre-session expectancy, belief and state (app-authored)',
  short: 'Expectancy',
  when: 'pre',
  appAuthored: true,
  measures: 'Expectancy, psi belief (this app, own ability), confidence, and pre-session state',
  citation: 'App-authored adaptation. Belief criteria after the sheep-goat literature (Palmer, via Psi Encyclopedia "Sheep-Goat Effect"); single belief and confidence items as in Mossbridge & Radin 2021, J. Anomalous Experience and Cognition (belief in own psi ability); state items after Maij & van Elk 2018 and the anxiety claim in McDonnell\'s 1983 Gateway assessment (CIA-RDP96-00788R001700210016-5).',
  url: 'https://psi-encyclopedia.spr.ac.uk/articles/sheep-goat-effect/',
  license: APP_LICENSE,
  instructions: 'Answer before the session starts. There are no right answers. Rate what you expect and how you feel right now.',
  scale: zeroTen('Not at all', 'Completely'),
  scoring: 'Each item is reported on its own (not summed).',
  // General belief in ESP is a trait question; ask it at enrollment (docs/QUESTIONNAIRES.md).
  items: [
    { id: 'expect-unusual', text: 'How likely is it that you will notice something unusual during this session?', scale: zeroTen('Not at all likely', 'Certain'), subscale: 'Expect unusual' },
    { id: 'expect-effect', text: 'How strongly do you expect the session (sound or helmet) to change how you feel?', scale: zeroTen('Not at all', 'Very strongly'), subscale: 'Expect effect' },
    { id: 'belief-here', text: 'How much do you believe that ESP (getting information without the known senses) can show up in the tasks of this app?', subscale: 'Belief: ESP in this app' },
    { id: 'belief-self', text: 'How much do you believe that you yourself have ESP abilities?', subscale: 'Belief: own ability' },
    { id: 'confidence', text: 'How confident are you that you will do well today (a clear experience, or a score above chance)?', subscale: 'Confidence' },
    { id: 'relaxed', text: 'How relaxed are you right now?', scale: zeroTen('Not at all', 'Extremely'), subscale: 'Relaxed' },
    { id: 'tense', text: 'How anxious or tense are you right now?', scale: zeroTen('Not at all', 'Extremely'), subscale: 'Tense' },
    { id: 'sleepy', text: 'How sleepy are you right now?', scale: zeroTen('Not at all', 'Extremely'), subscale: 'Sleepy' },
    { id: 'sleep-hours', text: 'How many hours did you sleep last night?', ...number(0, 24, 0.5, 'h'), subscale: 'Sleep (h)' },
    { id: 'substances', text: 'In the last 12 hours, did you take alcohol, cannabis or another drug that changes how you feel? (Coffee and tea do not count.)', kind: 'choice', scale: NO_YES, subscale: 'Substances' },
  ],
  score(answers) {
    return scoreSubscales(this, answers)
  },
  alerts(answers) {
    const v = values(this, answers)
    return v.substances === 1
      ? [alert('substances', 'substances', 'Alcohol, cannabis or another drug in the last 12 hours: the safety notes advise against a session today.')]
      : []
  },
})

// One guess per blinded condition. Audio: the run's audio.sham flag (revealed as 'real'/'sham');
// helmet: the helmet log's sham flag (revealed as 'active'/'sham').
const GUESS = { min: -1, max: 1, labels: ['Sham (inactive)', 'Don\'t know', 'Real (active)'] }

const blinding = define({
  id: 'blinding',
  name: 'Blinding check: real or sham? (app-authored)',
  short: 'Blinding',
  when: 'post',
  appAuthored: true,
  measures: 'Guess of each blinded condition (audio, helmet) and confidence, for the Bang Blinding Index',
  citation: 'App-authored adaptation of the guess format of Bang, Ni & Davis (2004), Assessment of blinding in clinical trials, Controlled Clinical Trials 25:143–156.',
  url: 'https://europepmc.org/abstract/MED/15020033',
  license: APP_LICENSE,
  instructions: 'Answer this before the condition is revealed. For each part of the session that was blinded, guess whether it was real (active) or sham (inactive). If you have no idea, choose "Don\'t know" and skip the question about how sure you are. Skip the questions about a part your session did not use.',
  scale: zeroTen('Pure guess', 'Completely sure'),
  scoring: 'Guess coded −1 sham, 0 don\'t know, +1 real, per condition. Confidence is asked only after a real or sham guess (null after "don\'t know"). Over many sessions, bangIndex() gives the Bang Blinding Index per arm.',
  items: [
    { id: 'guess-audio', text: 'Sound: do you think the audio in this session was real or sham?', kind: 'choice', scale: GUESS, askIf: { blinded: 'audio' }, subscale: 'Guess: audio' },
    { id: 'confidence-audio', text: 'How sure are you of your guess about the sound?', askIf: { item: 'guess-audio', in: [-1, 1] }, subscale: 'Confidence: audio' },
    { id: 'guess-helmet', text: 'Helmet: do you think the helmet field in this session was real or sham?', kind: 'choice', scale: GUESS, askIf: { blinded: 'helmet' }, subscale: 'Guess: helmet' },
    { id: 'confidence-helmet', text: 'How sure are you of your guess about the helmet?', askIf: { item: 'guess-helmet', in: [-1, 1] }, subscale: 'Confidence: helmet' },
  ],
  score(answers) {
    return scoreSubscales(this, answers)
  },
})

const STATE_ANOMALOUS = ['presence', 'obe', 'body', 'imagery', 'time']

const statePost = define({
  id: 'state-post',
  name: 'Post-session experience ratings (app-authored)',
  short: 'Post-session',
  when: 'post',
  appAuthored: true,
  measures: 'Intensity, sensed presence, out-of-body/vestibular and body sensations, imagery, valence, anxiety, time distortion, sleepiness',
  citation: 'App-authored adaptation. Content areas after the sham-helmet and God-helmet literature: Granqvist et al. 2005, Neurosci Lett 379:1–6; Maij & van Elk 2018; Persinger lab post-exposure reports (EXIT items not published).',
  url: 'https://europepmc.org/abstract/MED/15849873',
  license: APP_LICENSE,
  instructions: 'Rate the session you just finished: 0 = not at all, 10 = the strongest you can imagine. One exception: the question on how the session felt runs from 0 = very unpleasant through 5 = neutral to 10 = very pleasant. Rate what you actually felt, not what you expected. If the guide asked for a free description, write it first.',
  scale: zeroTen('Not at all', 'Extremely'),
  scoring: 'Each item on its own; "Anomalous experience" = mean of presence, out-of-body, body sensations, imagery and time distortion (app-defined, unvalidated).',
  items: [
    { id: 'intensity', text: 'Overall, how strong or unusual was the experience?', subscale: 'Intensity' },
    { id: 'presence', text: 'Did you sense that someone or something was with you, though nobody was there?', subscale: 'Sensed presence' },
    { id: 'obe', text: 'Did you feel floating, spinning, tilting, or as if you were partly outside your body?', subscale: 'Out-of-body / vestibular' },
    { id: 'body', text: 'Did you feel tingling, vibration, warmth, pressure or other body sensations?', subscale: 'Body sensations' },
    { id: 'imagery', text: 'How vivid were images, colours or light with your eyes closed?', subscale: 'Visual imagery' },
    { id: 'valence', text: 'How did the session feel emotionally? (5 = neutral)', scale: zeroTen('Very unpleasant', 'Very pleasant'), subscale: 'Emotional valence' },
    { id: 'anxiety', text: 'How anxious or afraid did you feel during the session?', subscale: 'Anxiety' },
    { id: 'time', text: 'How much did your sense of time change (time stretched, shrank or seemed to vanish)?', scale: zeroTen('No change', 'Completely changed'), subscale: 'Time distortion' },
    { id: 'sleepy', text: 'How sleepy or drowsy were you during the session?', subscale: 'Sleepiness' },
  ],
  score(answers) {
    const out = scoreSubscales(this, answers)
    out['Anomalous experience'] = mean(values(this, answers), STATE_ANOMALOUS)
    return out
  },
  alerts(answers) {
    const v = values(this, answers)
    const out = []
    if (atLeast(v.anxiety, 8)) out.push(alert('anxiety', 'anxiety', 'You felt strong fear or anxiety during the session.'))
    else if (atLeast(v.presence, 5) && atLeast(v.anxiety, 5)) out.push(alert('presence-fear', 'presence', 'You sensed a presence and felt afraid.'))
    if (atMost(v.valence, 1)) out.push(alert('unpleasant', 'valence', 'The session felt very unpleasant.'))
    return out
  },
})

const SEVERITY = { min: 0, max: 3, labels: ['None', 'Mild', 'Moderate', 'Severe'] }
const ADVERSE = [
  ['ae-headache', 'Headache'],
  ['ae-dizziness', 'Dizziness'],
  ['ae-nausea', 'Nausea'],
  ['ae-anxiety', 'Anxiety or panic'],
  ['ae-disorientation', 'Disorientation or confusion'],
  ['ae-low-mood', 'Low mood'],
  ['ae-ears', 'Ringing in the ears or a change in hearing'],
]
// psychological effects alert from "moderate" on, the rest at "severe"
const ADVERSE_MODERATE = new Set(['ae-anxiety', 'ae-low-mood'])

const gatewayReport = define({
  id: 'gateway-report',
  name: 'Gateway-style session report (app-authored)',
  short: 'Gateway report',
  when: 'post',
  appAuthored: true,
  measures: 'Time estimate, depth, the "mind awake, body asleep" marker, sleep onset, perception channels, state now, side effects',
  citation: 'App-authored adaptation (no Monroe Institute text). Marker after Atwater 1997, "Accessing anomalous states of consciousness with a binaural beat technology", J. Scientific Exploration 11(3) p.272, and an anonymous (probably Atwater) evaluation in the Army MIAS file (CIA-RDP96-00788R001700210004-8); the four perception channels are our own grouping; time probe after the "no time" Focus 15 description in Monroe, Ultimate Journey (1994); side effects after Xiong 2025 (meta-analysis), Wahbeh 2007 (low mood) and the MIAS research history (disorientation).',
  url: 'https://soundhealingresearchfoundation.org/wp-content/uploads/2021/12/I.-Accessing-Anomalous-States-of-Consciousness-with-a-Binaural-Beat-Technology.pdf',
  license: APP_LICENSE,
  instructions: 'Answer right after the session, before you look at a clock or talk to anyone. Rate what happened, not what you hoped for.',
  scale: zeroTen('Not at all', 'Very much'),
  scoring: 'Each item on its own. Time error = estimate − actual minutes: score(answers, { actualMinutes }), with actualMinutes from sessionMinutes(guide, run.steps). Side effects = sum of the seven severities (0–21).',
  items: [
    { id: 'time-estimate', text: 'Without looking at a clock: how many minutes do you think the session lasted?', ...number(0, 300, 1, 'min'), subscale: 'Time estimate (min)' },
    { id: 'depth', text: 'How deep did the session go at its deepest point?', scale: zeroTen('Ordinary waking', 'Deepest ever'), subscale: 'Depth' },
    { id: 'awake', text: 'While your body was at rest, how awake and clear was your mind?', subscale: 'Mind awake' },
    { id: 'hands', text: 'At the deepest point, could you feel where your hands were?', kind: 'choice', scale: { min: 0, max: 2, labels: ['Clearly', 'Partly', 'Not at all'] }, subscale: 'Body location faded' },
    { id: 'sleep', text: 'Did you fall asleep at any point?', kind: 'choice', scale: { min: 0, max: 2, labels: ['No', 'Unsure', 'Yes'] }, subscale: 'Fell asleep' },
    { id: 'kinesthetic', text: 'How much came through body feelings or a sense of movement?', subscale: 'Kinesthetic' },
    { id: 'knowing', text: 'How much came as a sudden sense of knowing, without images or words?', subscale: 'Intuitive knowing' },
    { id: 'auditory', text: 'How much came as sounds or voices other than the session audio?', subscale: 'Auditory' },
    { id: 'visual', text: 'How much came as images, light or colour?', subscale: 'Visual' },
    { id: 'calm', text: 'How calm do you feel now?', subscale: 'Calm now' },
    { id: 'alert', text: 'How alert do you feel now?', subscale: 'Alert now' },
    { id: 'drowsy', text: 'How drowsy do you feel now?', subscale: 'Drowsy now' },
    ...ADVERSE.map(([id, what]) => ({ id, text: `Since the session began: ${what.toLowerCase()}`, kind: 'choice', scale: SEVERITY, subscale: `Side effect: ${what.toLowerCase()}` })),
  ],
  // context.actualMinutes (number or numeric string) adds the time error; invalid -> null
  score(answers, context) {
    const vals = values(this, answers)
    const out = scoreSubscales(this, answers)
    out['Side effects (sum)'] = sum(vals, ADVERSE.map(([id]) => id))
    if (context?.actualMinutes !== undefined) {
      const est = vals['time-estimate']
      const actual = toNumber(context.actualMinutes)
      const ok = est !== null && actual !== null && actual >= 0
      out['Time error (min)'] = ok ? est - actual : null
      out['Time error, absolute (min)'] = ok ? Math.abs(est - actual) : null
    }
    return out
  },
  alerts(answers) {
    const v = values(this, answers)
    const out = []
    for (const [id, what] of ADVERSE) {
      if (atLeast(v[id], 3)) out.push(alert(id, id, `Severe ${what.toLowerCase()} since the session began.`))
      else if (ADVERSE_MODERATE.has(id) && atLeast(v[id], 2)) out.push(alert(id, id, `Moderate ${what.toLowerCase()} since the session began.`))
    }
    return out
  },
})

export const INSTRUMENTS = Object.freeze(Object.fromEntries(
  [tipi, ipipImagination, sss, senpq, expectancy, blinding, statePost, gatewayReport].map((inst) => [inst.id, inst]),
))

export const instrumentById = (id) => (Object.hasOwn(INSTRUMENTS, id) ? INSTRUMENTS[id] : null)

// Minutes the session actually ran, for the gateway-report time error: the summed activeMs of the
// run's step records whose guide step played audio or ran the helmet arm; null when there are none.
export function sessionMinutes(guide, stepRecords) {
  const ids = new Set(guide?.helmetArm?.steps ?? [])
  for (const s of guide?.steps ?? []) if ((s?.audio?.layers ?? []).length || s?.audio?.noise) ids.add(s.id)
  const runs = (stepRecords ?? []).filter((r) => ids.has(r?.id) && Number.isFinite(r.activeMs) && r.activeMs >= 0)
  return runs.length ? runs.reduce((a, r) => a + r.activeMs, 0) / 60000 : null
}

// Bang Blinding Index per arm (Bang, Ni & Davis 2004): (correct − incorrect) / all answers,
// "don't know" counted in the denominator. 0 = consistent with blinding, 1 = unblinded, −1 = opposite guessing.
// records: [{ arm, guess }]. arm: 'real' | 'active' | 'sham' (audio reveal: real/sham, helmet log: active/sham).
// guess: the same words, 'dontknow' | 'unsure', or the blinding item code +1 / 0 / −1 (also as a string).
// Records with any other arm or guess (null, '', true, 2, 'maybe') are skipped and counted in `excluded`.
const ARMS = { real: 'real', active: 'real', sham: 'sham' }
const GUESSES = { ...ARMS, dontknow: 'dontknow', unsure: 'dontknow', 1: 'real', 0: 'dontknow', '-1': 'sham' }

function lookup(table, raw) {
  if (typeof raw === 'number') raw = Number.isInteger(raw) ? String(raw) : ''
  if (typeof raw !== 'string') return null
  let s = raw.trim().toLowerCase()
  if (DECIMAL.test(s)) s = String(Number(s) || 0) // '+1' -> '1', '-0' -> '0'
  return Object.hasOwn(table, s) ? table[s] : null
}

export function bangIndex(records) {
  const valid = []
  let excluded = 0
  for (const r of records ?? []) {
    const arm = lookup(ARMS, r?.arm)
    const guess = lookup(GUESSES, r?.guess)
    if (arm && guess) valid.push({ arm, guess })
    else excluded++
  }
  const out = { excluded }
  for (const arm of ['real', 'sham']) {
    const guesses = valid.filter((r) => r.arm === arm).map((r) => r.guess)
    const n = guesses.length
    const correct = guesses.filter((g) => g === arm).length
    const wrong = guesses.filter((g) => g !== arm && g !== 'dontknow').length
    if (!n) {
      out[arm] = { n, correct, wrong, dontKnow: 0, bi: null, se: null }
      continue
    }
    const pA = guesses.filter((g) => g === 'real').length / n
    const pS = guesses.filter((g) => g === 'sham').length / n
    const se = Math.sqrt((pA * (1 - pA) + pS * (1 - pS) + 2 * pA * pS) / n)
    out[arm] = { n, correct, wrong, dontKnow: n - correct - wrong, bi: (correct - wrong) / n, se }
  }
  return out
}
