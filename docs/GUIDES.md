# Guided sessions ("Guides")

A guide is a timed, step-by-step session that the web app runs. Each step can have:
- spoken-style **instructions** (our own wording);
- an **audio** layer: binaural, monaural or isochronic beats over pink noise;
- an optional **helmet** program, real or blinded real/sham;
- an **input**: text, sketch, ratings, a questionnaire, a CRV stage worksheet, or a forced choice.

Guides live in `guides/*.json` (repo root, next to `presets/`). The app runs them in the **Guides** tab and stores every run on the phone (IndexedDB), exportable as JSON.

Guides cover:
- Gateway-style sessions (Monroe Institute structure, our wording and audio design);
- Coordinate / associative remote viewing (CRV / ARV);
- forced-choice ESP training;
- blinded "psi" self-tests;
- questionnaire flows.

None of them reproduce copyrighted scripts (Gateway Experience tapes, TMI affirmation, course material); the structure is cited and the wording is ours.

## Guide file format

```json
{
  "id": "gateway-focus10",
  "name": "Focus-10-style session",
  "category": "gateway",
  "summary": "One paragraph: what it is for, what to expect.",
  "evidence": "claim",
  "minutes": 36,
  "requires": { "headphones": true, "helmet": "optional", "pool": false },
  "setting": "Quiet room, dim light, reclined, closed-back headphones.",
  "cautions": "Stop on dizziness, panic or headache. No driving for 30 min.",
  "unlock": "Recommended after 3 Focus-10-style sessions rated 5 or more (optional text).",
  "sources": [{ "title": "Lane et al. 1998, Physiol Behav 63:249", "url": "https://pubmed.ncbi.nlm.nih.gov/9423966/" }],
  "helmetArm": { "preset": "theta-4hz-bilateral", "blind": true, "steps": ["induction", "hold"] },
  "steps": [
    {
      "id": "induction",
      "title": "Counted relaxation 1 to 10",
      "minutes": 6,
      "instructions": "Markdown, second person, short sentences.",
      "audio": {
        "layers": [
          { "carrier": 100, "beat": 1.5 },
          { "carrier": 200, "beat": 4 },
          { "carrier": 250, "beat": 4 },
          { "carrier": 300, "beat": 0 },
          { "carrier": 300, "beat": { "from": 0, "to": 16 }, "gainDb": -10, "startS": 0, "rampS": 60 }
        ],
        "noise": { "levelDb": -15, "swellS": 6 },
        "crossfadeS": 30,
        "fadeOutS": 0
      },
      "input": { "type": "none" },
      "advance": "timer"
    }
  ]
}
```

### Fields

| Field | Values |
|---|---|
| `category` | `gateway` · `remote-viewing` · `esp-training` · `self-test` · `questionnaire` · `sleep` |
| `evidence` | `established` · `single-lab` · `claim` · `anecdote` · `unverified` (same scale as the research docs) |
| `requires.helmet` | `none` · `optional` · `required` |
| `requires.pool` | true if the guide uses the target pool (Targets tab) |
| `helmetArm` | optional blinded helmet program for named steps (see below) |
| step `minutes` / `seconds` | duration; omit for open-ended input steps (then `advance` must be `manual`) |
| step `advance` | `timer` (next step when time is up) or `manual` (user presses Next; timer shows elapsed) |

### Audio

| Field | Meaning |
|---|---|
| `carrier` | Hz of the left-ear tone (or the AM carrier in isochronic mode) |
| `beat` | Hz difference, right = carrier + beat. Can be a glide `{ "from": a, "to": b }` over the step (or over `rampS`). 0 = same tone in both ears |
| `gainDb` | Level relative to T0, the user's calibrated comfortable level (default 0) |
| `startS`, `rampS` | Delay and fade-in of this layer within the step (default 0 / crossfade) |
| `noise.levelDb` | Pink noise level relative to T0 (tones 15 dB above noise, as in Lane 1998) |
| `noise.swellS` | Optional slow left/right swell period |
| `crossfadeS` | Crossfade from the previous step's layers (default 10 s) |
| `fadeOutS` | Fade-out at the end of the step (e.g. last step) |
| `audio: null` | Silence |

**Modes:**

| Mode | What it plays | When to use |
|---|---|---|
| Binaural (default) | carrier in the left ear, carrier + beat in the right ear | Needs headphones |
| Monaural | both tones mixed in both ears | Speakers |
| Isochronic | a raised-cosine amplitude modulation of the carrier at the beat rate, 50 % duty, same in both ears | Speakers; a stronger cortical drive per the literature |

**Sham audio:** every beat is forced to 0 Hz (same carriers, same noise), so a blinded comparison is possible.

In monaural mode each oscillator has its own gain: both at −3 dB while beating, and the right one fades out as a beat glides to 0, so a 0-Hz layer and a sham layer have the same power as a beating one (no loudness cue in blinded runs). Isochronic tones are raised by the pulse's RMS so the three modes sound equally loud.

**Level safety:**
- T0 is a relative calibration level set by the user in the audio setup and capped by the app. The calibration tone is 200 Hz at T0 + 6 dB (the power of a typical four-tone mix) over pink noise at −15 dB re T0, the noise level the guides use.
- The master runs 12 dB below T0. Before each step the engine computes a peak bound from the layer gains (×√2 in monaural, ×1/RMS isochronic, plus a 4× RMS allowance for noise) and lowers the master if a step would peak above −2 dBFS; `planHeadroom` sets one level for a whole guide up front. A limiter at −1 dBFS is only a safety ceiling and does not act in normal use, so it never treats real and sham differently.
- Pink noise is band-limited to 40–320 Hz, as in Lane et al. 1998.
- Following WHO safe-listening guidance: keep the average at or below 80 dB(A), device volume ≤ 60 %.
- No visual flicker is ever used (photosensitive epilepsy).

### Helmet arm

`helmetArm` names a preset (`presets/*.json`) and the steps during which it runs:
- The app starts the program at the first listed step and stops it after the last.
- With `"blind": true` the helmet's hardware RNG picks real or sham, and the result is revealed after the post-session ratings, exactly as for normal blind sessions.
- The arm is skipped when no helmet is connected or `requires.helmet` is `none`.

### Inputs

| `input.type` | Fields | Stored as |
|---|---|---|
| `none` | – | – |
| `text` | `key`, `prompt`, `placeholder` | string |
| `sketch` | `key`, `prompt` | PNG data URL |
| `rating` | `items: [{key, label, min, max, minLabel, maxLabel}]` | numbers |
| `questionnaire` | `instrument` (id in `webapp/src/lib/instruments.js`) | item answers + scale scores |
| `choice` | `key`, `prompt`, `options: [..]`, `trials`, `feedback` (forced-choice training; target from a hardware/crypto RNG with commitment) | per-trial records |
| `crv` | `stage` 1–6, `fields: [{key, label, kind}]` | structured stage data |
| `trial` | `action`: `create` · `lock` · `judge` · `reveal` (drives the Experiment trial flow from inside a guide); `create` may set `mode` (`rv` or `telepathy`) and `arv: true` (only 2-picture sets are offered) | trial id |
| `outcome` | `key`, `prompt`, `options: ["A","B"]` (ARV: the real-world outcome, entered when it is known) | chosen option |
| `rng` | `key`, `prompt`, `trials`, `bits`, `aim` (`high`/`low`/`alternate`, or `none` for a control block with no aim and no feedback) (micro-PK intention task; bits come from the helmet's hardware RNG via `rng.bytes`, or WebCrypto in demo mode) | per-trial bit counts + z score |

### ARV with the existing trial commitment

Associative remote viewing reuses the blinded trial:
1. `trial.new` with a 2-picture set. The helmet's random `target` is the picture assigned to outcome **A**; the other picture belongs to **B**. The assignment is committed before the response exists.
2. The viewer describes the picture they will be shown after the event, then locks.
3. The judge ranks both pictures. The rank-1 picture gives the prediction: A if it is the target, otherwise B.
4. The guide ends after judging. When the real outcome is known, open the run in the Guides tab: the run summary checks the commitment with the helmet, takes the outcome, reveals, and stores the hit (`record.arvReveals`). An `outcome` step inside a guide is still allowed when the outcome is known at once.
5. The reveal shows the mapping. A hit means the prediction matched the outcome; the viewer is then shown only the picture for the actual outcome as feedback.
6. Equal ratings of the two pictures (or a margin under 2 points on a 0–7 rating) count as a pass: no prediction, not scored.

ARV trials are marked on the device (IndexedDB `kv` / `arv-trials`) and left out of the Experiment tab's hit statistics, because their rank means "predicted A", not a hit.

### Validation rules

`webapp/src/lib/guides.js` checks every guide when the library loads (`npm test` runs it on all of them):
- A non-zero beat needs `requires.headphones: true`.
- A glide on an open-ended (manual) step needs `rampS`; `fadeOutS` on an open-ended step is flagged.
- RNG trials use 8–2048 bits.
- At most one outcome step and one ARV trial per guide; an outcome step must be followed by its reveal, and a guide with an outcome runs only one trial.
- A trial may stop right after `create` (another guide continues it through the trial picker, as `obe-target-check` → `obe-target-record`), or an ARV trial after `judge` (finished from the run summary); otherwise every trial runs create → lock → judge → reveal.
- Ids are unique, and each file name equals its id.
- A guide whose helmet arm uses a non-temporal preset must name the layout in `setting`; a helmet arm over a beat carries the Shakti caution.
- Helmet presets used by guides (`presets/guide-*.json`) run at least 5 min longer than their steps, so a short pause does not end the program early.

## Running guides

- A run records:
  - the guide id and version (hash of the guide JSON);
  - start/end time;
  - each step's actual duration;
  - inputs;
  - audio mode;
  - sham flags (hidden until the end);
  - helmet log id;
  - Kp and local sidereal time.
- Runs are exported from the Guides tab as JSON (`godhelmet-guide-runs.json`).
- Pausing pauses the audio and timer; the helmet program keeps running (stop it with Stop).
- Stop ends the audio and the helmet program immediately.
