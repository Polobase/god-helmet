# Driver board

**Status: designed and simulated, not built or tested (revision B).** This page is not on the website until a board has passed the bring-up below.

The driver board replaces the AD5328 module, the eight 2.2 kΩ resistors and the perfboard of the first build. It is one board with:

- **8 coil channels.** Each one is a current source: the coil gets the set current whatever its resistance and turn count, up to ±20 mA. No series resistors.
- **A ceiling switch.** One switch on the board sets the most any coil may carry: 5 mA (switch open) or 20 mA (switch on). A hardware latch trips at the ceiling + 10 %, then cuts the coil supply and resets the converters.
- **2 isolated tES channels.** tDCS, tACS or tRNS, at most 4 mA per channel.
- **An ESP32-S3 with Bluetooth LE.** It runs the same firmware and app as the first build.

Revision B (2026-11-14) does the same with fewer, newer chips: one 8-channel DAC81408 for the coil setpoints, ADS8688 converters that read the coil and tES voltages without divider networks, dual coil drivers and dual logic gates. 35 chips instead of 44, 347 placed parts instead of 461. Revision A (routed, never ordered) is kept in `hardware/pcb/build/helmet-driver/archive-rev-A/`; `design-notes.md` has the research behind the change.

The design files are in [hardware/pcb](../hardware/pcb/README.md):

| What | Where |
|---|---|
| Requirements, decisions and sources | `hardware/pcb/modules/helmet-driver/spec.md` |
| Simulations and part substitutions | `hardware/pcb/modules/helmet-driver/design-notes.md`, `sim/` |
| Schematic (12 pages, PDF) | `bun run sch -- helmet-driver` writes `hardware/pcb/build/helmet-driver/helmet-driver-schematic.pdf` |
| KiCad project | `hardware/pcb/modules/helmet-driver/kicad/` |
| Order files for JLCPCB | `bun run order -- helmet-driver` writes `hardware/pcb/build/helmet-driver/order/`, with `ORDER.md` as the checklist |

## For your own use only

Brain stimulation equipment without a medical purpose is regulated in the EU (MDR Annex XVI point 6; class III under Regulation 2022/2347, with the common specifications of 2022/2346) and in Switzerland (MedDO Annex 1, group 6). A device you build for your own use is not placed on the market. Selling assembled boards, or handing them on, is. The board has no IEC 60601 testing; its isolation is functional, not medical grade.

## The board

| | |
|---|---|
| Size | 160 × 100 mm (Eurocard), 4 layers, 1.6 mm, M3 holes 4 mm from the corners |
| Power | USB-C, 5 V. A power bank or supply that offers at least 1.5 A; all eight coils at 20 mA DC take about 1 A |
| Coil outputs | ±20.16 mA full scale, one 16-bit DAC (the firmware uses 12 bits: 10 µA steps), about ±13 V of drive |
| tES outputs | ±4.55 mA at the DAC's full range; the firmware allows 4 mA per channel and 4 mA for both together |

### Connectors and controls

| Part | Where | What it does |
|---|---|---|
| USB-C (J1) | left edge | Power, and USB control of the coils. tES refuses to start while a computer is on it |
| STOP jack (J2), 3.5 mm | left edge | A normally-open button between tip and sleeve. It stops at once, also with the firmware hung |
| RESET, BOOT, STOP buttons | top edge | The on-board STOP does the same as the jack. BOOT held for 40 ms also stops |
| Status LED | top edge | Blue: idle; amber: a session runs |
| Ceiling switch (SW4) | bottom left | Open = 5 mA, ON = 20 mA. The firmware reads it before every start; if it reads neither, nothing starts |
| Coil connector (J4), Molex Micro-Fit 3.0, 2 × 8 | bottom edge | Coil *k* between pin *k* (output) and pin *k* + 8 (its return). Every coil needs its own return wire |
| tES electrodes (J5, J6), JST-XH 2-pin | right edge | Pin 1: electrode A, pin 2: electrode B. Positive current flows out of A |
| I²C header (J3) | bottom edge | 1: 3.3 V, 2: SDA, 3: SCL, 4: GND (a magnetometer) |
| Test points TP1–TP9 | | ±15 V, the DAC reference, the trip threshold, UART TX, the island's rails and reference |

**Check the Micro-Fit pin numbers before you crimp.** The footprint follows KiCad's library; Molex's drawing could not be checked. Compare the cavity numbers moulded into the housing with the table above.

**The two right-hand mounting holes are on the isolated tES island.** Use nylon screws and spacers there, or leave them empty. Copper stays 4.5 mm away from both holes.

## Firmware

The board has its own build, `helmet_pcb`. The first build's boards keep theirs.

```sh
cd firmware
pio run -e helmet_pcb -t upload
```

What is different on this board:

- **Coil current.** The firmware sets current, not voltage. `hello` reports `pcb.ceilingMA` and `pcb.fullScaleMA`, and the reachable field follows from them and the calibration (µT per mA).
- **Before every start** the firmware reads the ceiling switch and clears the trip and STOP latches. A latch whose cause is still there stays set, and the start is refused.
- **During a session** a trip ends it at once ("coil current trip").
- **The coil DAC** is held in reset while the board is not armed (every output at 0 mA). At the start of each session the firmware sets it up once the rails are up (about 25 ms) and reads its settings back; a DAC that does not read back ends the session ("coil DAC does not answer").
- **Monitor.** Two ADCs read every coil's current and drive voltage about 100 times a second, from −10.24 to +10.24 V: a drive voltage beyond that reads as the limit. The status carries them (`pcb.coilMA`, RMS in `pcb.coilRmsMA`), except in blind sessions. A coil start is refused while they do not answer.

New operations (docs/BLE_PROTOCOL.md covers the rest):

| Operation | What it does |
|---|---|
| `coils.check` | 1 mA DC in each coil in turn for 1 s. The result in `status.pcb.coilsCheck`: current, drive voltage, resistance (coil and cable, up to about 10 kΩ), open |
| `tes.check` | Electrode contact: 0.1 mA at 10 Hz for 3 s. The impedance in `status.pcb.tes.impedance`: good, too low (sponges or saline touching), too high |
| `tes.start` | `mode` (`dc`, `ac`, `rns`), `mA` (two values; DC signed), `hz`, `lowHz`, `minutes`, `rampUpS`, `rampDownS`, `sham`, `blind`, and `safety: "tes-v1"` (the app showed the tES safety text) |
| `tes.stop` | Ramps down, as `session.stop` |
| `tes.reveal` | After a blind tES session: real or sham |
| `tes.log` | Every tES session, oldest first: waveform, currents, time, charge and why it ended (`/log/tes.jsonl` on the helmet). A blind session's condition shows once it has been revealed |

## App

The Helmet tab shows two more panels when the connected helmet is this board: **Driver board** (ceiling, rails, USB source, latches, live currents, the coil check) and **tES**. Neither appears for the first build or the demo.

## tES

### Before any stimulation

Do not use it with any of these. EU 2022/2346, Annex VII, Section 4.1, lists them for brain stimulation equipment ([EUR-Lex](https://eur-lex.europa.eu/eli/reg_impl/2022/2346/oj), read 2026-11-13 through [LawPlayer's copy](https://lawplayer.com/eu/act/32022R2346); the official text prevails):

- a history of epilepsy;
- pharmaceutical treatment for conditions related to the central nervous system;
- therapeutic treatment that changes the excitability of the central nervous system;
- illicit substances, or other substances that modify perception;
- a tumour in the central nervous system;
- vascular, traumatic, infectious or metabolic lesions or diseases of the brain;
- sleep disorders, drug dependency or alcoholism;
- under 18 years old;
- pregnancy.

Not on skin with open wounds or rashes, or that is swollen, red, irritated, infected or inflamed (Annex VII, Section 7.3).

The screening questionnaire of [Antal et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5985830/), Table 9, asks about:

1. metal (except titanium) or electronic implants in the brain or skull;
2. metal or electronic devices elsewhere in the body, such as a pacemaker;
3. surgery on the head or spinal cord;
4. head injury with impaired consciousness;
5. skin problems such as dermatitis, psoriasis or eczema;
6. epilepsy, or any convulsion or seizure;
7. fainting spells or syncope;
8. pregnancy;
9. medication;
10. earlier transcranial electric or magnetic stimulation, and any adverse events.

There a yes is not an absolute contraindication, but a physician weighs it. The app cannot do that: with a yes, ask one first.

### Electrodes

- Use sponges soaked in saline, never tap water. Do not abrade the skin (Antal 2017, 5.1).
- Look at the skin before and after.
- Stop at any pain or heat under an electrode. Skin burns come from poor or drying contact (Antal 2017, 7.4.1 and 9).
- Run `tes.check` (the app's **Check electrodes**) before each session.

### What the board and the firmware enforce

| Limit | How |
|---|---|
| 4.55 mA | The DAC's largest difference; no command can ask for more |
| 4.64 mA | A comparator trips a latch on the island and opens both relays of the channel |
| 4.0 mA per channel, 4.0 mA together | Firmware (`lib/pcb/src/tes.h`) |
| 40 min with the ramps; 7.2 C | Firmware: a plan beyond either is refused; the charge is counted while it runs |
| Ramps 2–60 s (default 30 s) | Firmware |
| AC up to 250 Hz; noise within 0.1–640 Hz | Firmware |
| Current not delivered, or the voltage limit reached | The firmware compares the measured current with the setpoint and the voltage across the electrodes with 19 V, and stops |
| The island's monitor does not answer | Firmware: the island's ADC echoes its settings at every scan (100 times a second). Without that echo tES does not start, and a running session stops |
| Relays open when idle | Hardware: closed only with TES_EN, the heartbeat (the firmware's 1 kHz square wave) and no trip. STOP, a hung firmware and power loss open them |
| No computer on USB | Firmware: refused at the start, stopped if one appears |
| Coils or tES | One at a time |

## Bring-up (never on a person)

1. **Rails and references.** USB-C from a current-limited supply at 5 V. Check 3.3 V, then run `coils.check` with no coils plugged in (it arms the rails for 8 s; every coil reads open): ±14.5 V on TP1 and TP2, 2.5 V on the DAC reference (TP5; the DAC turns its reference on when the firmware sets it up), and the threshold on TP4 for both switch positions (0.68 V and 2.72 V). `hello` must report the switch's ceiling.
2. **Latches.** Press STOP and the jack's button: the rails must go down. Clear by starting a test; with STOP held the start must be refused.
3. **Coils into resistors.** Each channel into 100 Ω: `coils.check` against a meter. Then into the 4.2 Ω / 4.1 mH coil, then DC tests at 5 and 20 mA.
4. **Trip.** A test-only build that asks for 6 mA in the 5 mA position: the latch must trip and the session end.
5. **STOP latency.** Time from the button to 0 mA with a scope on a sense resistor.
6. **tES into resistors only.** 1 kΩ, 4.7 kΩ and 10 kΩ between the electrode pins: `tes.check`, then DC 1 and 4 mA, AC and noise, against a meter and a scope. The trip at 4.64 mA with a test-only build. Pull the heartbeat (halt the firmware): the relays must open within 0.1 s.
7. **Isolation.** With a meter: no connection between the island's ground (TP6–TP9 reference) and USB ground.

Only after all seven, on a person, and then as in [SAFETY.md](SAFETY.md) and the tES section above.
