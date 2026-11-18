# Helmet Driver: specification

Board `helmet-driver`, revision B (2026-11-14), started 2026-11-12. Rev A (routed and fab-ready, never ordered) is kept
in `build/helmet-driver/archive-rev-A/`; rev B does the same with fewer, newer chips (design-notes.md, "Rev B"). It is the controller board of this repository (god-helmet).
It replaces the AD5328 module, the eight 2.2 kΩ resistors and the perfboard of the first build
(`docs/WIRING.md`). The toolchain around it is `hardware/pcb/` (README.md there).

Every number has a source in the verification table at the end, or is marked **target**, **derived** (my
arithmetic from verified inputs) or **sim** (an ngspice bench in `sim/`). Status words: **verified** (read in the
primary source), **likely** (secondary source or derived), **unverified** (still to check; the source is named).

## Purpose

- Drive up to eight coils **directly**, without series resistors. Each output is a **current source** of up to
  ±20 mA, so the field depends on the current and the coil's turns, not on the coil's resistance. It works with
  different coils and turn counts.
- Keep a **hardware ceiling** that no firmware or app setting can exceed, as the first build's resistors did.
- **Measure** every coil's current and voltage, to log the real current of each session (also as proof of the
  real-or-sham condition) and to find open, shorted or wrong coils.
- Offer **two isolated outputs for transcranial electrical stimulation** (tDCS, tACS, tRNS), with the safety
  features that published devices and guidelines use.
- Be **assembled by JLCPCB** (Economic PCBA) and run the god-helmet firmware (ESP32-S3, Bluetooth LE app).

## Your decisions (2026-11-12)

| Topic | Decision |
|---|---|
| tES outputs | Two channels on one isolated section |
| tES ceiling | 4 mA per channel in hardware (you chose 4 over the 2 mA I recommended). Firmware at most 4.0 mA per channel; both channels together at most 4 mA by default, a firmware setting |
| Coil ceiling | One board-wide switch: 5 mA or 20 mA. An open or undefined switch reads as 5 mA; the firmware reads the position |
| Where it is designed | Here, in god-helmet `hardware/pcb/` (2026-11-13: your instruction; it had started in another project of yours and was moved). Untested until the bring-up below has passed, and kept off the site until then |
| Layers | 4 (inner GND and power planes) on JLCPCB's JLC04161H-7628 stackup |

## Rules (own use)

- **EU.** MDR 2017/745 Annex XVI point 6 covers "equipment intended for brain stimulation that apply electrical
  currents or magnetic or electromagnetic fields that penetrate the cranium to modify neuronal activity in the
  brain". That includes the coil helmet as well as tES. Such equipment is class III
  (Implementing Regulation (EU) 2022/2347 Art. 1(c)). The common specifications of (EU) 2022/2346 apply since 22 June 2023.
- **Switzerland.** MedDO Annex 1, group 6 ("Geräte zur transkraniellen Stimulation des Gehirns …"), regulated
  since 26 May 2021; the EU common specifications have applied since 1 November 2023 (Swissmedic).
- **Own use.** A product made for one's own use is not placed on the market (EU Blue Guide 2022 §2.3).
  Selling assembled boards, or handing them on, is "making available" (MDR Art. 2(27)).
- **Design files.** I found no text on whether publishing them counts. The boards are for your own use; the
  docs say so.

## Blocks

```
USB-C 5 V ─┬─ AP2112K 3.3 V ─ ESP32-S3-WROOM-1-N16R8 ─ BLE / native USB (no USB-serial chip)
           │                     │ SPI (DAC81408, 2 × ADS8688), ARM, STOP, latch, tES SPI; I²C header only
           ├─ TPS65131 ±15 V (enabled by ARM·¬TRIP·¬STOP) ─ DAC81408 ─ 8 × [filter ─ OPA2197 half ─ coil] ─ Micro-Fit 2×8
           │                     sense nodes ─ 16 comparators ─ TRIP latch          └─ ADS8688 × 2 (X and OUT)
           └─ A0515S-2WR3 isolated ±15 V ══ 2 × ISO6741F ══ tES island:
                  DAC80504 (2 outputs per channel) ─ 2 × bridge current source (OPA4197) ─ sense (INA821)
                  ─ trip latch ─ CPC1017N relays ─ 2 electrode pairs;  ADS8688 measures current and voltages
```

### Coil channel (×8)

| Part | Function | Values (target unless marked) |
|---|---|---|
| DAC81408 (one chip, 8 channels) | 16-bit, internal 2.5 V reference, every channel on its ±2.5 V range (straight binary, 8000h = 0 V). Powered from the switched ±15 V rails (VCC, VSS) and +5VA. After power-up and while its RESET pin is low, every output is tied to ground through 10 kΩ (power-down) until the firmware configures it; the firmware does that after every arm. LDAC (low) updates all channels at once | ±2.5 V straight into the setpoint filter: no stage 1 (rev A: 2 × DAC8565 and 2 × OPA4197) |
| Setpoint filter | RC between the DAC and the driver: smooths steps | 10 kΩ, 4.7 nF C0G (τ = 47 µs) |
| Driver (one half of an OPA2197, two channels per package) | Coil in the feedback loop: output → coil → sense node X → Rs → GND. RF from X to −IN; CF in series with RD from the output to −IN (TI, Green 2019, p.40–41). The load must float (p.27) | Rs = 124 Ω 0.1 % (20.16 mA at 2.5 V); RF 10 kΩ; CF 2.2 nF C0G; RD 47 kΩ |
| Output parts | Snubber from the output to GND; Schottky diodes (BAS40-04, 40 V) from the output to both rails (Green p.115); a TVS (SMF15CA) at the connector | 10 Ω + 47 nF |
| Supply | ±15 V from TPS65131 (maximum 15 V, 3 % accuracy: set to about ±14.5 V), ferrite-bead π filter per rail, two 10 µF 1210 per rail after it (TI wants about 12 µF that remains at 15 V; SLVS493E Table 8-2). Converter ripple of 25 mV at 1.25 MHz reaches the coil current as less than 1 nA (coil-ripple.cir) | – |

- **Step response (sim, coil-step.cir).** Full-scale steps and full reversals (+20 → −20 mA) overshoot by at most 3.2 %
  into any of 1 Ω/1 µH, 4.2 Ω/4.1 mH (your levitation coils), 10 Ω/1 mH, 30 Ω/10 mH, 100 Ω/20 mH and 500 Ω/50 mH, so a
  full-scale command stays below the 22 mA trip. The rise (10–90 %) is 95 µs for your coils; every load is within
  0.5 % after 2.9 ms. A 1 kHz sine arrives with 97 % of its amplitude (coil-ac.cir).
- **Compliance (sim, coil-compliance.cir).** 20 mA into 500 Ω and 5 mA into 2 kΩ are met; 20 mA into 700 Ω is not
  (16.7 mA). At AC the coil's reactance counts too (50 mH at 1 kHz: 314 Ω).
- **An open coil** (a plug out) drives the output to its rail; when the coil comes back the current spikes to about
  28 mA (coil-open.cir), which trips the latch in either switch position: the session stops.
- **Heat (derived).** Worst case is a low-resistance coil at 20 mA DC: (14.5 − 2.6) V × 20 mA ≈ 0.24 W per
  amplifier. Two in one OPA2197 plus its quiescent power: 0.54 W, +58 °C at 107.9 °C/W (SOIC-8), 98 °C at 40 °C
  ambient. Within the limit you set for duals (about 100 °C); rev A had one OPA197 per channel.
- **At zero (sim, setpoint.cir).** The DAC's 10 kΩ to ground in reset gives 0 mA within ±5 µA. Configured, the
  DAC's worst-case error (±0.1 % of the 5 V range, ±5 mV) is about ±40 µA at the mid-scale code, which the firmware
  trims with the monitor; full scale (2.495 V) gives 20.12 mA.
- **One return per coil, one plug.** Each coil is wired between its output and its own sense node. All eight leave on one
  latching Molex Micro-Fit 3.0 header, 2 × 8 (your choice 2026-11-13, instead of two RJ45 jacks): coil k on pin k
  (signal, OUTk) and pin k + 8 (return, Xk), which face each other across the two rows, so each pair leaves the plug side
  by side and stays twisted to the headband. The first build's Cat6A harness needs a new plug (Molex 43025-1600 housing,
  43030 crimp terminals, or a ready-made Micro-Fit cable). The returns are no longer joined, and the PhotoMOS arming
  switch goes.

### Ceiling and fault chain (coils)

| Layer | Behaviour |
|---|---|
| 1. DAC power-on | Every output tied to ground through 10 kΩ = 0 mA, until the firmware configures the DAC81408 |
| 2. Driver rails | TPS65131 enabled by ENABLE = ARM · ¬TRIP · ¬STOP (3-input AND). ARM is GPIO4 with a 10 kΩ pull-down, as in the first build. The boost side's external P-MOSFET (BSW pin) disconnects the positive rail fully. Off at power-on, reset, STOP and trip |
| 3. DAC reset | The DAC81408's RESET pin is held low until the rails have been up for about 10 ms (ARM delayed by an RC and a Schmitt gate, 74LVC2G14) and whenever ENABLE is low (74LVC2G08): the outputs return to ground and the firmware has to configure the DAC again |
| 4. Window comparators (4 × LM339B: recommended to 36 V, the plain LM339 only to 30 V) | Two per channel on the sense node X. They trip at the ceiling + 10 %: 22 mA (2.73 V) or 5.5 mA (0.68 V), one threshold divider for all 16. A trip sets the TRIP latch (74HC74). It is masked while the rails come up (layer 3's delay) |
| 5. STOP button | Sets the STOP latch directly (works with the firmware hung) and interrupts the firmware on GPIO5, as in the first build. The on-board button and a jack for the hand-held button are in parallel |
| 6. Clearing | Only the firmware clears the latches (CLEAR, GPIO16), and only once the fault is gone: a latch whose set input is still active stays set |

- **Ceiling switch.** It changes the threshold divider. Open (or a failed contact) gives the 5 mA thresholds.
  The firmware reads the threshold voltage on an ESP32 ADC pin, keeps its own limit below the ceiling, and
  refuses to start when its setting and the switch disagree.
- **What the ceiling means.** A current above the threshold cannot persist: it trips within microseconds (LM339)
  and the DACs reset to 0 mA. Before that the current can briefly exceed the threshold: a wrong command of 20 mA in
  the 5 mA position peaks at 6.9 mA for tens of microseconds (coil-trip.cir). A failed driver amplifier stuck at its
  rail is cut by the rails going down after the trip: a few milliseconds while the rail capacitors discharge.
- **The comparators' outputs** pull to −15 V. Each wired-OR line reaches the 3.3 V logic through a series resistor
  with a Schottky clamp to GND and a pull-up.

### tES island (2 channels, isolated)

| Part | Function |
|---|---|
| A0515S-2WR3 (EVISUN) | 5 V → isolated ±15 V, 2 W, 1500 V DC isolation (datasheet). Same pinout as Murata's NMA series: 1 Vin, 2 GND, 4 −Vo, 5 0 V, 6 +Vo |
| 5 V LDO on the island | Logic and converters on the island |
| 2 × ISO6741F | 3 forward + 1 reverse channel each; **F: outputs default low** when the other side has no power. #1: SCLK, MOSI, CS_DAC → ; ← MISO. #2: CS_ADC, TES_EN, HEARTBEAT → ; ← FAULT |
| DAC80504 (4 × 16-bit; GAIN and REFDIV tied low: 0–2.5 V from its 2.5 V reference; RSTSEL high: mid-scale at power-up) | Two outputs per channel, used as a difference: setpoint = a − b. So the two states a DAC can fall into by itself, "all outputs 0 V" (a reference alarm) and "all at mid-scale" (power-on), both mean 0 mA (tes-zero.cir). With one output per channel, 0 V would have meant full negative current |
| Bridge current source per channel (one OPA4197: difference stage, integrator, E+ follower, E− inverter) | One electrode driven up and the other down. The integrator's drive is limited to about ±11.6 V by back-to-back 11 V Zeners across its capacitor (anti-windup, and inside the INA821's input range), so up to about 22 V across a pair: 4 mA into 1 kΩ and 4.7 kΩ is met, 10 kΩ gets 2.1 mA (tes-dc.cir). Hahn 2013 needed 18.5 V at 2.5 mA |
| Sense (INA821, gain 1, across 549 Ω 0.1 %) | The DAC's largest difference (2.5 V) is 4.55 mA: **no code can command more** (tes-trip.cir). An instrumentation amplifier, because a resistor difference amplifier (AD8276, 40 kΩ inputs) would load the electrode line by about 4 % |
| Trip latch (LM339B + 74HC74 on the island) | Window comparator on the sense output at 4.64 mA (2.55 V): above the DAC's own ceiling, so it trips only on a fault, such as a failed amplifier. It opens the relays and is cleared only by the firmware once the fault is gone. A driver stuck at its rail gives up to about 10 mA until the relays are open (tes-trip.cir), at most 10 ms (CPC1017N datasheet) |
| CPC1017N relays (2 per channel, both electrode lines) | Normally open: closed only while TES_EN · heartbeat · ¬trip; open when idle, on fault, on power loss |
| ADS8688 (8-channel, 16-bit, 1 MΩ inputs) | Current (sense output) and setpoint of each channel on ±2.56 V, both electrode voltages on ±10.24 V (impedance before and during), read directly. Each electrode is limited to about ±11.6 V and reads full scale above 10.24 V, so the firmware's voltage limit across a pair is 19 V (rev A, MCP3208 with dividers: 20 V) |
| Heartbeat detector | A diode charge pump keeps the relays enabled only while the firmware toggles HEARTBEAT; a stuck line, high or low, opens them |

- **STOP reaches the island** through TES_EN: on the main side TES_EN = GPIO21 · ¬STOP latch, so a STOP press opens
  the relays and the island stays off until the firmware clears the STOP latch.
- **Firmware rules** (god-helmet firmware):
  - tES refuses to run while a USB host is connected (control over Bluetooth, board on a power bank);
  - ramps default to 30 s, minimum 2 s;
  - a session is at most 40 min and 7.2 C;
  - an impedance check runs before and during a session;
  - a session stops when the set current cannot be delivered;
  - coil and tES sessions exclude each other in this first version.
- **Electrode connectors.** JST-XH 2-pin, polarized and shrouded, so they cannot take the coil plug or the STOP jack's plug.
  No 2 mm touch-proof (DIN 42802) PCB socket is stocked at JLCPCB/LCSC; electrodes with touch-proof leads need an
  adapter cable. The STOP jack is a 3.5 mm PJ-320D.
- **No passive limiter.** A pair of current-regulating diodes was planned as a last ceiling; none of 5–6 mA is in
  stock (2026-11-12), and KiCad has no depletion-MOSFET symbol with numbered pins. The ceiling is the DAC's range,
  the trip and the relays, as in the published device (NCT03481309).

### Controller and power

- **ESP32-S3-WROOM-1-N16R8**, with Bluetooth LE (and Wi-Fi) and a PCB antenna on the module: its antenna end sits at
  the board edge over a copper keep-out on all four layers, 24 mm either side of the module's centre (pcb.ts; an
  overhang would put the module's silkscreen off the board, which DRC reports). The god-helmet firmware's `esp32s3` pin map is kept where it overlaps: SPI SCLK 12,
  MOSI 11, the DAC's chip select on 10 (SYNC before); LDAC 9; ARM 4; STOP 5; RGB LED 48. Native USB on 19/20: no USB-serial chip, so opening the
  port pulses neither reset nor BOOT.
- **USB-C.** HRO TYPE-C-31-M-12; ESD protection with USBLC6-2SC6; 5.1 kΩ on CC1 and CC2, whose voltages the ESP32
  reads to learn the current the source offers (0.5, 1.5 or 3 A).
- **3.3 V.** AP2112K-3.3 (600 mA).

| GPIO | Use | GPIO | Use |
|---|---|---|---|
| 0 | BOOT button (firmware STOP, held 40 ms) | 16 | LATCH_CLEAR (out, pull-up; low clears) |
| 1 | ADC: ceiling threshold voltage | 17, 18 | I²C SDA, SCL (the header J3 only) |
| 2 | ADC: +15 V rail (divider) | 19, 20 | USB D−, D+ |
| 4 | ARM (out, 10 kΩ pull-down) | 21 | TES_EN (out, pull-down) |
| 5 | STOP (in; button to GND, pull-up) | 38, 39, 40 | tES SCLK, MOSI, MISO |
| 6 | ADC: −15 V rail (offset divider) | 41, 42 | tES CS_DAC, CS_ADC |
| 7, 8 | ADC: CC1, CC2 | 43 | UART0 TX (test pad) |
| 3 | SPI MISO (the ADS8688 chain; the DAC81408's readback through 33 Ω) | 44 | TES_FAULT (in) |
| 9 | LDAC (DAC81408) | 47 | TES_HEARTBEAT (out) |
| 10, 13 | CS of the DAC81408, CS of both ADS8688 | | |
| 11, 12 | SPI MOSI, SCLK | 48 | WS2812B-2020 status LED |
| 14, 15 | TRIP latch, STOP latch (in) | 45, 46 | strapping pins, not used |

GPIO 26–37 belong to the module's octal flash and PSRAM. GPIO3 is a strapping pin too, but only for the JTAG source,
and its level is ignored while the three JTAG eFuses are at their default 0 (ESP32-S3 datasheet v2.2, Table 3-5).
Nothing here burns them; whoever does would make MISO's level at reset matter.

## Power budget (derived; to be measured)

| Load | At 5 V |
|---|---|
| ESP32-S3 with Bluetooth LE | 60–150 mA (god-helmet WIRING.md) |
| Coil section armed, no current (4 × OPA2197 at 2 mA, the DAC81408, 4 × LM339B on ±15 V, 85 % efficiency) | about 100–120 mA |
| Coil section, all eight at +20 mA DC (one rail 175 mA at 15 V) | about 700 mA |
| tES island (A0515S-2WR3 at about 0.7 W) | about 140 mA |
| **Worst case** | **about 1.0–1.1 A** |

A power bank that offers 1.5 A or more on USB-C is needed for full coil current. The firmware reads CC and limits the
total coil current when only 0.5 A is offered.

## Bring-up (when the boards arrive; never on a person)

1. Power from a current-limited supply (5 V, 300 mA limit): 3.3 V, idle current, no rail while not armed.
2. Arm with the DACs at mid-scale: ±14.5 V rails, threshold voltage of both switch positions read by the ADC.
3. Each channel into a 100 Ω resistor, then into a 4.2 Ω/4.1 mH coil: current from the ADS8688 against a meter,
   DC and a 1 kHz sine.
4. Trip test with a test-only firmware build: command 6 mA in the 5 mA position; the latch must trip and the
   rails go down. STOP latency on a scope.
5. tES into 1 kΩ, 4.7 kΩ and 10 kΩ resistors only: accuracy, voltage limit, trip at 4.5 mA, relays open on
   STOP, on a stopped heartbeat and on power loss; insulation between island and USB ground with a meter.

## Verification

| Item | Value | Source | Status |
|---|---|---|---|
| V-to-I for inductive loads | load floats; RF/CF compensation; Schottky and TVS | Tim Green (TI), "V-to-I Circuit Design for Current Control in Inductive Loads", 2019, p.27, 29, 40–41, 115, 117 | verified (research pass, 2026-11-12) |
| Howland accuracy | 1 % resistors ≈ 9 %, 0.1 % ≈ 0.9 % | Green 2019 p.71; TI AN-1515 | verified (research pass) |
| DAC81408 | pins; ±2.5 V range code; POR and RESET: power-down, outputs to ground through 10 kΩ, communication after 1 ms; no supply sequencing; VCC 9–41.5 V, VSS −21.5–0 V, VAA/VDD 4.5–5.5 V; 24-bit frames and registers | TI SLASER3A pp. 2–4, 9.3.1, 9.3.3, 11, 31–43 (parts/dac81408-vqfn40.yaml) | verified 2026-11-14 |
| ADS8688 | pins; ranges ±2.56/±5.12/±10.24 V; 1 MΩ inputs; ±20 V input protection with AVDD at 5 V; 32-clock frames; daisy chain | TI SBAS582C pp. 4–6, 30–32, 44–47 (parts/ads8688-tssop38.yaml) | verified 2026-11-14 |
| OPA2197 | pins; ±65 mA short-circuit; 1 mA per amplifier; RθJA 107.9 °C/W (SOIC-8) | TI SBOS737C p. 4, 6, 8 | verified 2026-11-14 |
| OPA197 (U22, the threshold inverter) | RθJA 115.8 °C/W (SOIC-8) | TI SBOS737C | verified 2026-11-12 |
| 74LVC2G14, 74LVC2G08 | pins | TI SCES198 and the SN74LVC2G14 data sheet (parts/74lvc2g*.yaml) | verified 2026-11-14 |
| ESP32-S3 GPIO3 | strapping only for the JTAG source, ignored with the default eFuses | ESP32-S3 Series Datasheet v2.2, section 3, Tables 3-1 and 3-5 | verified 2026-11-14 |
| TPS65131 | outputs up to +15 V / −15 V, 3 % accuracy; switch limits 1.8–2.2 A; ENP/ENN; BSW drives an external battery switch, low when ENP high | TI SLVS493E | verified 2026-11-12 |
| TPS65131 output current at ±15 V from 5 V | about 0.4–0.5 A (from the switch limits) | derived; the datasheet gives it as a curve only (Fig. 6-2, 6-4) | likely |
| ISO6741F | default output low | TI ISO6741 datasheet, features | verified 2026-11-12 |
| DAC80504 | GAIN, REFDIV, RSTSEL pins read after power-up; RSTSEL = VIO: mid-scale | TI SBAS871C p. 5 | verified 2026-11-13 |
| INA821 | input range (V−)+2 V to (V+)−2 V | TI SBOS893D p. 6 | verified 2026-11-13 |
| BZT52C11 | VZ 10.4–11.6 V at 5 mA | Diodes DS18004 Rev. 38-2 p. 2 | verified 2026-11-13 |
| CPC1017N | switching up to 10 ms; 16 Ω on; 1 µA off at 60 V | IXYS DS-CPC1017N-R10 | verified 2026-11-12 |
| A0515S-2WR3 (EVISUN, C7465204) | ±15 V, 2 W, 1500 V DC isolation; pins 1 Vin, 2 GND, 4 −Vo, 5 0 V, 6 +Vo; 2.54 mm grid; 19.65 × 7.0 × 10.16 mm | LCSC datasheet 6b7de3fa9fad1ea6947eff77ee51dd4e.pdf | verified 2026-11-12 |
| tES requirements | table in "tES island" | LOTES 2017/2023; Antal 2017 §8; Bikson 2016; Terney 2008; Starstim, neuroConn, Flow; NCT03481309 device | verified (research pass, 2026-11-12) |
| OPA2197 swing at 20 mA | headroom used in "Compliance" | SBOS737C Figure 14 | unverified |
| JLCPCB stock and tiers | per part file | jlcpcb.com parts API, 2026-11-12 | verified per part file |
