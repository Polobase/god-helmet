# Testing it honestly: blinded sessions and psi trials

The published God-Helmet effects largely disappear under double-blind conditions (Granqvist 2005), and expectation alone produces "presences". The only way to learn anything from this device is to remove your own knowledge of what it is doing.

## 1. Blinded real/sham sessions

1. Pick a preset and tick **Blind**. The ESP32's hardware RNG decides real or sham (50/50).
2. Everything you can observe is identical in both conditions:
   - the arming switch closes, the timers run and the LED is solid;
   - the live coil display is hidden;
   - the coils are silent at these currents.
3. After the session, rate it 0–10 and write notes **before** looking at anything. The condition is revealed only after rating.
4. Over 20+ sessions, compare the ratings of real and sham sessions. Export the log (Log tab → Export JSON).

Tips:
- **Same time of day, same room, same expectations.** Decide the number of sessions in advance.
- **Don't peek with a compass or magnetometer** during blind sessions.
- **A friend can run the UI** so you don't even see the preset name (double-blind).

## 2. Remote-viewing trials

**Before you start:**
- Ask someone else to build the **target pool**: several sets of 4–5 clearly different pictures (landscapes, buildings, objects; different colours, shapes, textures). Upload in the Targets tab. Ideally you have never seen them.
- **Decide the number of trials in advance** (e.g. 30) and write it down. Analyse only when done.

**A trial:**
1. **Experiment → New trial.** Mode "Remote viewing", stimulation e.g. `remote-viewing`, **Blind** ticked.
2. The device:
   - picks a set, a target in it, and real/sham, all with its hardware RNG;
   - shows a **SHA-256 commitment** of those choices plus a secret nonce. Screenshot it if you like.
3. During or after the 30-min stimulation, write and sketch your impressions:
   - shapes, colours, textures, temperatures, feelings;
   - first impressions, no naming (McMoneagle's "analytic overlay");
   - Murphy: the very first impression is the one that counts.
4. **Lock** the response. It can no longer change; the clock, Kp/ap and local sidereal time are recorded.
5. **Judge.** All pictures of the set appear in random order. Rank every picture by similarity to your response (1 = best). Better: export the trial and let someone else rank.
6. **Reveal.**
   - The device shows the target, the condition, the nonce and the target's rank.
   - The page re-computes SHA-256 of the revealed data and checks it against the commitment, proving nothing was swapped.

Nothing gets deleted. Aborted trials stay in the list as *aborted* so you can't drop bad runs without noticing.

## 3. Telepathy trials

- Mode **Telepathy**, with the stimulation running for the **sender** (e.g. `telepathy-sender`). This matches Persinger, Koren & Tsang 2003, who stimulated the sender. To test Murphy's variant, stimulate the receiver instead.
- The sender uses a second phone in another room: same pool file imported (Targets → Import), the app connected to the helmet as a second app (the helmet accepts two), Experiment → Sender → trial number. It shows the target only while the trial is open.
- The receiver writes and sketches impressions in the main UI, then locks, judges and reveals as above.
- Honest-use caveat: any connected app can ask for the sender view while the trial is open, so the receiver must not use it. For stricter tests, let a third person run the sender phone.

## 4. Statistics

The Experiment tab (and `tools/trial_stats.py`) report:

| Measure | Meaning | Chance level |
|---|---|---|
| First-place hits | Target ranked 1st | 1/N per trial (N = set size). Exact Poisson-binomial p-value |
| Mean rank | Average target rank | (N+1)/2 |
| Sum-of-ranks z | Standardised rank score | 0; positive = better than chance |
| Active − sham | Difference between real and sham trials | 0 |

How to read them:
- With 30 trials at N = 5, chance gives about 6 hits. You need about 11+ hits for p < 0.05.
- A real effect of the *field* would show up as **active better than sham**, not just "better than chance".
- Kp and local-sidereal-time splits are **exploratory**. Persinger and Spottiswoode reported such effects, but the LST effect did not replicate. Don't choose session times based on them, and don't hunt for the "best" split after the fact.

## 5. Optional context logging

- **Kp / ap.** The app fetches them from NOAA SWPC when it connects and passes them to the helmet; offline, enter Kp by hand in Setup. Persinger reported better dream-telepathy hits on quiet nights (aa ≈ 10 nT).
- **Local sidereal time.** Computed from the clock and the longitude in Setup.
