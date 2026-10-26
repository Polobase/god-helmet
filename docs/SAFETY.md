# Safety

This is an experimental, non-medical device. It is not intended to diagnose, treat or prevent anything.

## Physical exposure

- **Field.** About 1–5 µT at the cortex and at most about 100 µT at the coil face (hardware-limited by the 2.2 kΩ resistors). That is below the ICNIRP 2010 public reference level (200 µT, 25–400 Hz) and about a million times weaker than TMS. See docs/RESEARCH.md §4.
- **Electrical.** ±10 V maximum, at most 4.5 mA per coil, battery-powered.
  - Always use a **USB power bank** while the helmet is worn. Never use a mains charger or a laptop on mains during a session.
  - **Never** remove the series resistors or connect coils directly to the module.
- **Heat.** None to speak of: coil dissipation at full current is about 0.1 mW.

## Who should not use it

- **Epilepsy or seizure history**, or a first-degree relative with epilepsy.
  - The burst-firing patterns were derived from seizure EEG.
  - Murphy reports a seizure triggered in a seizure-prone person just by left/right attention shifting.
  - Murphy also reports his own 8–10 days of distress after the bilateral amygdala signal, which he attributes to childhood temporal-lobe epilepsy.
- **Psychiatric conditions.** Psychosis/schizophrenia, bipolar disorder, severe depression, PTSD (Murphy's own list), or medication that lowers the seizure threshold.
- **Implanted electronics.** Pacemaker, ICD, cochlear implant, deep-brain or vagus stimulator.
- **Pregnancy** or a recent head injury.
- **Alcohol, cannabis or other drugs** before or during a session.

## How to use it

- Sit or lie down in a quiet, dark room. Keep the **STOP** button in your hand.
- Stop immediately on fear, anxiety, panic, headache, nausea, dizziness or anything unusual.
  - In the classic preset, phase 1 (right side only) can cause fear. **Skip** jumps to phase 2.
- At most **one session per 72 hours**; Murphy recommends at most once a week because of habituation. The UI warns if it has been less than 72 h.
- No driving or machinery for at least one hour afterwards.
- Don't combine with other stimulation devices (light/sound machines, CES, TENS, magnets) during a session.
- Sessions are capped at 60 minutes by the firmware.

## Built-in safeguards

| Safeguard | What it does |
|---|---|
| Series resistors | Hardware current limit of 4.54 mA per coil |
| Arming switch (PhotoMOS) | Coil return stays open at power-up until the DAC is at 0 V. Opens on STOP, at session end and on any reset |
| STOP button | Hardware interrupt that cuts the coil return instantly, independent of Bluetooth and the app |
| Field ceiling | User ceiling ≤ 10 µT at 20 mm; DC tests limited to 4.6 mA and 120 s |
| Fades | 10 s fade-in/out; UI stop fades over 2 s |
| Watchdog | The real-time task is supervised; a hang resets the ESP32, which opens the arming switch |
| Session cap | 60 min per session |
| Optional app keepalive | Stops the session if no app has been connected for a set time (Setup → Helmet) |
| Safety gate | The helmet refuses to start sessions until the safety page has been accepted in the app |
