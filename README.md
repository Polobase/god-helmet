# God Helmet: 8-coil weak-field headset (ESP32-S3 + AD5328 + Web Bluetooth app)

A DIY recreation of the Persinger/Koren "God Helmet", the 8-coil Shakti and the circumcerebral "Octopus":
- 8 small coils on a Velcro headband;
- an AD5328 8-channel ±10 V DAC;
- an ESP32-S3 that runs the signals in real time;
- a **Vue web app on GitHub Pages** that connects over **Bluetooth LE**.

It reproduces the published protocols (two-phase God Helmet, sensed presence, OBE, remote viewing, telepathy, rotating circumcerebral fields) as closely as the sources allow. It also builds in the means to **test them honestly**:
- blinded real/sham sessions;
- hash-committed, blind-judged remote-viewing and telepathy trials with exact statistics.

> **Read [docs/SAFETY.md](docs/SAFETY.md) first.** Not for people with epilepsy or seizure history, psychiatric conditions, or implanted electronics. Battery power only. Experimental, non-medical.
>
> **Honest expectations.** The fields are about 1–5 µT at the cortex, about a million times weaker than TMS. The best double-blind test (Granqvist 2005, N = 89) found no effect of the field; suggestibility predicted the experiences. See [docs/RESEARCH.md](docs/RESEARCH.md).

![Wiring schematic](docs/schematic.svg)

## How it fits together

```
 phone / laptop browser                     control box                                  headband
 ┌──────────────────────┐  Bluetooth LE  ┌──────────────┐  SPI + LDAC  ┌──────────┐ 2.2 kΩ ×8  ┌─────────┐
 │ web app (GitHub      │◄──────────────►│  ESP32-S3    │─────────────►│ AD5328   │──────────► │ 8 coils │
 │ Pages): programs,    │  JSON-RPC +    │  2 kHz engine│              │ ±10 V ×8 │◄─ returns ─│         │
 │ placement, trials    │  live status   │  log, trials │  PhotoMOS ◄──┤          │  PhotoMOS  └─────────┘
 └──────────────────────┘                └──────────────┘  STOP button └──────────┘
```

- **The app** holds:
  - the program library, with placement diagrams, waveforms, an in-browser preview of the coil activity, and sources;
  - the remote-viewing target pool;
  - calibration and settings.

  It has a **demo mode** that runs the same engine in the browser, so everything can be explored without hardware.
- **The helmet** holds:
  - the real-time engine, with all 8 coils updated together at 2 kHz;
  - the hidden blind choices (real/sham, RV target, with SHA-256 commitments);
  - the session and trial log;
  - the safety interlocks: STOP button, arming switch, field ceiling, 60-min cap.

  A running session continues if the phone disconnects.

## What's here

| Path | Contents |
|---|---|
| [docs/RESEARCH.md](docs/RESEARCH.md) | Science, history, signal parameters, field calculations, **states → brain regions → helmet protocols**, psi evidence, lecture notes with timestamps, sources |
| [docs/WIRING.md](docs/WIRING.md) | Schematic, coil leads (inner = signal, outer = return), pin table (S3 and classic ESP32), arming switch, Cat5 pair mapping |
| [docs/PLACEMENT.md](docs/PLACEMENT.md) | Layout A (ring) and B (temporal 4+4) with 10-20 positions |
| [docs/CALIBRATION.md](docs/CALIBRATION.md) | Bench test of the module, wiring checks, µT/mA calibration with a phone |
| [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md) | Blinded sessions, remote-viewing and telepathy protocols, statistics |
| [docs/BLE_PROTOCOL.md](docs/BLE_PROTOCOL.md) | GATT service, framing, operations, session JSON, trial commitment |
| [docs/SAFETY.md](docs/SAFETY.md) | Contraindications, rules, built-in safeguards |
| [presets/](presets) | The 14 programs (JSON), shared by the app and the firmware tests |
| [firmware/](firmware) | PlatformIO project: engine, BLE transport, experiments, log |
| [webapp/](webapp) | Vue 3 + Vite app, deployed to GitHub Pages by `.github/workflows/pages.yml` |
| [hardware/](hardware) | Bill of materials, coil clip (OpenSCAD), schematic generator |
| [tools/](tools) | Python: coil field estimate, point tables, WAV → table, calibration fit, trial statistics |

## Quick start

**Firmware** ([PlatformIO](https://platformio.org/)):

```sh
cd firmware
./test/run_host_tests.sh      # engine, JSON, BLE framing, every preset rendered at 2 kHz
pio run -e esp32s3 -t upload  # ESP32-S3-DevKitC-1 (use -e esp32dev for a classic ESP32)
pio device monitor            # prints the Bluetooth name, e.g. GodHelmet-3F2A
```

**App:**

```sh
cd webapp
npm install
npm test                      # JS engine matches the C++ engine; protocol and trial logic
npm run dev                   # http://localhost:5173 (Web Bluetooth works on localhost)
```

**Deploy:** push to GitHub, then Settings → Pages → Source: **GitHub Actions**. The app appears at `https://<user>.github.io/<repo>/`.

**First use:**
1. Open the app in Chrome/Edge (iPhone: Bluefy) and press **Connect**.
2. Read and accept **Safety**.
3. Do the bench test and calibration (docs/CALIBRATION.md) before wearing the helmet.

## Status

- **Verified here:**
  - both firmware targets build;
  - host unit tests pass;
  - the JavaScript engine reproduces the C++ engine's output for every preset (whole sessions plus a 3.5 ms-resolution window);
  - protocol, blind reveal and trial commitment logic are tested against the demo helmet;
  - the app builds and runs in a headless browser in demo mode.
- **Not yet verified on hardware:**
  - BLE with a real phone;
  - the module's transfer function;
  - SPI/LDAC timing;
  - the coils' real µT/mA.

  docs/CALIBRATION.md walks through them.
