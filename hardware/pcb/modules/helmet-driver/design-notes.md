# Helmet Driver: design notes

Working notes behind spec.md: what was tried, what the benches showed, why parts were chosen. Bench results are
from `bun run sim` (ngspice 47, TI's OPAx197 macro-model in models/). All 12 benches in `sim/` pass (2026-11-14, rev B;
rev A's stage1.cir is replaced by setpoint.cir).

## Where the design lives (2026-11-13)

It started in another project of yours (a separate repository with the same toolchain) and was moved here on your
instruction the next day. The toolchain was copied into `hardware/pcb/` and stripped of everything that belonged to
that project.

## Parts: stock KiCad symbols drive the choice (2026-11-12/13)

The schematic generator uses stock KiCad 10.0.6 symbols only (docs/schematic-as-code.md), so each part needs a
symbol in KiCad's libraries with the right pin numbers. That changed several choices made in the research pass:

| Research pick | Board | Why |
|---|---|---|
| DAC80508MC (8 ch, CLR pin) | 2 × DAC8565 (4 ch) | No DAC80508 symbol. DAC8565 has a symbol, LDAC, RST and RSTSEL pins (hardware zero), stock 2,178 |
| OPA192 | OPA197 (stage 2), OPA4197 (stage 1, tES) | Symbols exist for OPA197 and OPA4197, not OPA192 |
| TL074H for stage 1 | OPA4197 | stage1.cir with the TL07xH model: up to 8 mV offset (64 µA of DC through a coil at "zero", also in sham). OPA4197: 250 µV max |
| TLA2528 | ADS7828 | No TLA2528 symbol |
| INA149 → AD8276 | INA821 | No INA149 symbol; the AD8276's 40 kΩ inputs would load the electrode line by about 4 % |
| DAC80502 | DAC80504 | A DAC80502 reference alarm forces both outputs to 0 V; with one output per channel that is full negative current. Two outputs per channel as a difference make 0 V mean 0 mA |
| AQY212EH | CPC1017N | No AQY212 symbol |
| B0515S-2WR3 | A0515S-2WR3 | B05xxS converters are single-output; ±15 V needs the A type. EVISUN's pinout equals Murata NMA's; the footprint needs 1.0 mm holes (derived footprint) |
| BSS126 limiter | none | Device:Q_NMOS_Depletion has letter pins (D, G, S), which fail the pin-to-pad check; no 5–6 mA current-regulating diode is in stock |
| LM339 | LM339B | The plain LM339 is recommended to 30 V supply; ±14.5 V is 29 V (29.9 V at 3 %). LM339B: 36 V |
| BAT54S clamps | BAS40-04 | Across ±15 V rails a BAT54S diode sees its full 30 V rating |

## Coil stage compensation (2026-11-12/13)

Topology: TI's V-to-I for inductive loads (Tim Green 2019): coil in the feedback loop, sense resistor to GND, a
second feedback path from the output to −IN.

- **Loop gain** (series voltage injection at −IN): |1 + T| ≥ 1.04 for every load from 1 Ω/1 µH to 500 Ω/50 mH with
  RF/CF from 1 kΩ/10 nF to 10 kΩ/100 nF; crossover about 400 kHz with 64–67° phase. The loop itself is stable.
- **But the current response peaks.** With CF straight to −IN and an ideal op-amp,
  I/Vset = (1 + sτ) / (Rs + sτ(Rs + RL) + s²τL), τ = RF·CF. The zero gave up to +48 % overshoot (RF 1 kΩ, CF 10 nF,
  4.1 mH coil). A setpoint filter equal to τ cancels it, but then τ has to be about 150 µs for ζ ≥ 0.7 on every load,
  and high-resistance coils become slow: the slow pole sits near Rs/((Rs + RL)·τ) (5 mA into 2 kΩ: 4.2 mA after 4.9 ms).
- **RD in series with CF** (as in Green's example): the voltage feedback at high frequency becomes a fraction of the
  output, which balances the current feedback across coil resistances. Sweep over seven loads (steps and reversals):

  | RF / CF / RD / setpoint filter | Worst overshoot (≤ 500 Ω) | 90 % point, 4.1 mH coil | 500 Ω/50 mH | 2 kΩ/50 mH at 5 mA |
  |---|---|---|---|---|
  | 10k / 15n / – / 10k·15n | 1.4 % | 311 µs | 1,644 µs | 4.2 mA after 4.9 ms |
  | 10k / 4.7n / 47k / 10k·10n | 0.2 % | 229 µs | 689 µs | 2,155 µs |
  | 10k / 2.2n / 47k / 10k·10n | 0.1 % | 225 µs | 383 µs | 1,059 µs |
  | **10k / 2.2n / 47k / 10k·4.7n** (chosen) | **3.2 %** (reversal, 100 Ω/20 mH) | **106 µs** | **279 µs** | **996 µs** |
  | 10k / 1n / 47k / 10k·4.7n | 6.9 % | 102 µs | 174 µs | 469 µs |

  Chosen: fast for typical coils and still below the 22 mA trip on full reversals.
- **Results with the chosen values:** coil-step (rise 95 µs, ≤ 3.2 %), coil-ac (1 kHz at 97 %), coil-compliance
  (500 Ω at 20 mA met, 700 Ω limited to 16.7 mA), coil-open (28 mA spike on reconnection: trips), coil-ripple
  (< 1 nA), coil-trip (6.9 mA peak in the 5 mA position), stage1 (±2.5 mV at zero).

## Ceiling switch (2026-11-12)

- First idea: scale the DAC reference with the switch, so the 5 mA position has a true 5 mA full scale. Rejected:
  the DAC8565's internal reference is on at power-up, and the datasheet says not to drive VREFH while it is on.
- **Board:** the switch sets the comparators' threshold (5.5 mA or 22 mA, one divider for all 16). The firmware keeps
  its commands below the ceiling; coil-trip.cir shows what happens when it does not.

## tES current source (2026-11-13)

- **Topology:** a bridge (E+ follower, E− inverter) driven by an error integrator, the current measured across a
  resistor in the E− line by an instrumentation amplifier. One OPA4197 per channel holds the difference stage, the
  integrator and both drivers.
- **Integrator** 10 kΩ, 330 pF: 640 Hz (top of the tRNS band) arrives at 97 % into 1 kΩ + 4.7 kΩ‖100 nF; with 1 nF it
  was 92 %.
- **Anti-windup:** without it, the simulation stalled when the source ran out of voltage (the op-amps sat at their
  rails), and real hardware would overshoot when the load returns. Back-to-back 11 V Zeners across the integrator
  capacitor hold the drive at about ±11.6 V: inside the INA821's input range ((V−)+2 V to (V+)−2 V, ±12.5 V on
  ±14.5 V), and the loop recovers in about 50 µs when an electrode makes contact again (tes-contact.cir: 4.23 mA peak
  on a 2 mA setting, below the trip).
- **Ceiling from the DAC's range:** 549 Ω makes the largest setpoint (2.5 V) 4.55 mA, so no code can ask for more.
  The trip at 4.64 mA catches faults only. With a driver stuck at its rail the current reaches about 10 mA until the
  relays open (CPC1017N: up to 10 ms).
- **Electrode-skin model** in tes-ac.cir (1 kΩ in series with 4.7 kΩ‖100 nF) is illustrative: no source we read
  gives one.

## Schematic and BOM (2026-11-13)

- `bun run sch`: ERC 0 errors / 0 warnings, netlist round-trip equal, one A0 sheet (475 symbols, 240 nets). The
  builder learned stacked pins on the way (one stub per point; stacked pins on different nets are refused).
- Island isolation, checked on the netlist: only the isolated converter and the two isolators touch both GND and
  GND1.
- Two ERC findings fixed in the island: the DAC80504's SDO and the MCP3208's DOUT shared I_MISO (two outputs;
  SDO is now unused, the ADC measures each setpoint instead), and the MCP3208's reference now comes from the DAC's
  reference through 10 Ω with 1 µF.
- **BOM:** 462 placed parts plus 4 mounting holes and 9 test points (no parts); 78 different LCSC numbers, 24 Basic
  and 54 Extended, all sourcing verified. Parts about USD 122 per board at JLCPCB's 1-piece prices (read
  2026-11-13). Economic PCBA one-time fees per order: setup USD 8.18, stencil USD 1.53, Extended part types
  54 × USD 3.07 = USD 166 (help page of October 2026). So two assembled boards are about USD 420 plus the 4-layer
  PCB, the through-hole soldering and shipping: more than the USD 300 of the plan. JLCPCB's quote decides.
- **Before layout:** the A0515S-2WR3 needs a derived footprint (1.0 mm holes, 7 mm body; parts/a0515s-2wr3.yaml);
  the island parts' placement rotation against JLCPCB's footprints is not compared yet.

## Redrawn as pages with wires (2026-11-13, your review of the first PDF)

- "Not readable without wires": the schematic is now 12 A3 pages under an index page (the toolchain learned
  hierarchical pages for it: docs/schematic-as-code.md §3a). Every signal chain is wired in signal-flow order;
  only nets between pages carry (global) labels; rails are power symbols. `draw.ts` places parts and draws the
  wires; a pin that a wire reaches is joined to the wire's net automatically.
- Coil connector: one latching Molex Micro-Fit 3.0, 2 × 8 (your choice), instead of two RJ45 jacks; coil k on
  pins k and k + 8.
- The redraw was checked against the reviewed single-sheet netlist net by net: identical except the connector
  (the two RJ45 shield pins are gone). The check caught two stacked pins (TPS65131 INP 24, OUTN 14) and the
  reference's 100 nF, which the first wired draft had dropped.

## Layout (2026-11-13)

- **Size.** 474 parts need about 6,800 mm² of courtyard with 0.8 mm between parts. 160 × 100 mm (Eurocard) leaves
  the room the autorouter needs; the first build's ~120 × 80 mm box does not take it.
- **Placement.** Each schematic page has an area (`pcb.ts`, `AREA`); the island's parts go by net domain, not by
  page. The ICs of the repeated blocks are placed by hand in rows: the eight coil drivers in columns 8.5 mm apart,
  channel 8 on the left and 1 on the right as the connector's pins run, stage 1 and the comparators above them,
  the DACs and monitor ADCs above those. The placer puts the rest next to what they connect to, the largest
  first; decoupling capacitors next to the IC pin they are drawn beside on the schematic.
- **The island.** Right of a 3.2 mm gap (x 110.4–113.6). The gap is a routing keep-out on all four layers and no
  plane or pour crosses it; a custom DRC rule checks 3 mm between island copper and any other copper. The A0515S
  (pins 1–2 main, 4–6 island, 3.4 mm apart) and the two ISO6741F (7.3 mm between their pad rows) straddle it.
- **ESP32-S3 antenna.** At the top edge with copper kept out 24 mm either side of the module's centre down to its
  body. Hanging it over the edge was the first plan; KiCad's DRC then reports the module's silkscreen off the
  board, and the gate allows no warnings.
- **Layers.** In1.Cu: the GND and GND1 planes. The first layout also had +3V3 and ISO_P15 planes on In2.Cu; with
  both inner layers planes, Freerouting routed on F.Cu and B.Cu only and stalled at 30–40 open connections after ten
  passes (two runs, 40–180 s per pass). In2.Cu is now a routing layer (`signalInner`), filled with the grounds after
  routing; the rails are routed as 0.4 mm power tracks. Pins beside an exposed pad with thermal vias join that pad
  with a short track instead of a via.
- **Routing.** `pcb.ts` allows 60 minutes per Freerouting run. Freerouting does not see the planes' fill and keeps
  counting some plane connections as open; the flow judges by KiCad's DRC after the fill.
- **Toolchain changes on the way** (tested): placement areas, a part spacing, large parts first, overhanging
  courtyards counted only on the board, routing keep-outs, custom DRC rules, net names with a "/" in a pin name,
  plane-net pads that join an exposed pad or share a neighbour's via.

## Rev B: fewer, newer chips (2026-11-14)

You asked whether the board could be more modern with fewer chips, research first. Rev A stays as the fallback
(`build/helmet-driver/archive-rev-A/`: KiCad project, PDF, order files).

**What the research found** (data sheets and JLCPCB's parts API, 2026-11-14):

| Idea | Verdict |
|---|---|
| A current-output DAC per coil or per four (AD5758, AD5753, DAC8775, AD5755-1) | No: JLCPCB stock 0–3, and they are built for slow 4–20 mA loops into resistors (supply tracking), not fast pulses into coils |
| One octal DAC with bipolar outputs (DAC81408) | Yes: replaces 2 × DAC8565 and the stage-1 op-amps; outputs tied to ground until configured |
| An ADC with bipolar ±10 V inputs (ADS8688) | Yes: reads X and the driver outputs directly; replaces 2 × ADS7828 and their dividers, and the island's MCP3208 and its networks |
| Dual drivers (OPA2197) | Yes: 98 °C worst case at 40 °C ambient |
| Isolated power and data in one chip (ISOW7841, ADuM5401) | No: 5 V out only, the island needs ±15 V; ISOW7841 not stocked |
| One 6-channel isolator (ISO7762) | No: the island needs 5 forward and 2 back |
| Programmable logic for the latches (GreenPAK) | Not now: vendor tool and in-system programming in the safety chain |

**Your decisions:** the full rev B, and duals if the heat allows (it does).

**What changed on the schematic:**

- **Setpoints.** The DAC81408 on its ±2.5 V range drives the setpoint filters directly. Stage 1 (2 × OPA4197 and 16
  precision resistors) is gone: rev A needed it to turn a 0–2.5 V DAC into ±2.5 V. setpoint.cir: 0 mA within ±5 µA
  in reset (10 kΩ to ground), ±40 µA at the worst-case DAC error (the firmware trims it), 20.12 mA full scale.
- **Hardware zero.** RESET of the DAC81408 is DAC_RST_N (rev A drove the DAC8565s' RST with it): low until about 10 ms
  after the rails are up and whenever ENABLE is low. A RESET is a power-on reset: outputs tied to ground, registers at
  their defaults, so the firmware configures the DAC after every arm (device and reference on, ranges, channels on).
  CLR is not used: it would set mid-scale, which on the ±2.5 V range is 0 V too, but RESET already does more.
- **DAC supplies.** VCC and VSS from the switched ±15 V rails (the outputs need 1.5 V of headroom: ±2.5 V is far
  inside), VAA and VDD from +5VA, VIO from 3.3 V. The data sheet sets no supply sequence.
- **Monitor.** Two ADS8688 in a daisy chain on the main SPI bus (one CS; #2's SDO into #1's DAISY, #1's SDO on MISO;
  48 clocks per frame: the command, then #1's result, then #2's; data sheet 8.4.1.3.1).
  They share SDI, so both get the same range settings: ±10.24 V for all 16 inputs. The coil current resolves to
  312.5 µV / 124 Ω = 2.5 µA per count; a driver output above 10.24 V reads full scale (still "at the rail"). The I²C
  bus now serves only the J3 header (a magnetometer).
- **MISO on GPIO3**, the last free pin besides the boot-mode pins 45 and 46. Its strapping (the JTAG source) is ignored
  with the default eFuses (ESP32-S3 datasheet v2.2, Table 3-5); recorded in parts/esp32-s3-wroom-1.yaml.
- **Drivers.** Four OPA2197 instead of eight OPA197; each channel keeps its own compensation. Their supply
  decoupling moved to the coil-supply page (100 nF per rail and package).
- **Safety logic.** The Schmitt inverters and AND gates in 74LVC2G14 and 74LVC2G08 (two gates each); same functions,
  still discrete. The latches (74HC74) and window comparators (LM339B) are unchanged.
- **tES island.** An ADS8688 reads the sense outputs and setpoints on ±2.56 V and the four electrodes on ±10.24 V
  directly. An electrode reads full scale above 10.24 V, so the firmware's voltage limit across a pair moves from
  20 V to 19 V.
- **New toolchain piece.** KiCad has no DAC81408 symbol. `tools/kicad/gensym.ts` builds a box symbol from the data
  sheet's pin table (typed in, with its page), and lib:import refuses it unless its pins match the footprint's pads
  one to one (tests in gensym.test.ts).

- **Readback.** The DAC's SDO goes to MISO through 33 Ω: the firmware reads its configuration back after every arm and
  refuses to start a session when it does not match. Both chips' SDO pins are high-impedance while their CS is high,
  so they share the line; the resistor also keeps two outputs off one net for the ERC.
- **Readability.** The schematic builder now staggers power symbols that would print over each other on neighbouring
  IC pins (docs/schematic-as-code.md); the trip pull-up, the threshold inverter's feedback and two captions were
  moved where text crossed parts.

**Counts** (from the schematic): 35 ICs instead of 44, 347 placed parts instead of 461 (112 resistors instead of 193,
136 capacitors instead of 160), plus 4 mounting holes and 9 test points. ERC 0 errors / 0 warnings, netlist round
trip equal, 12 pages.

**Still open before ordering** (as in rev A): the Micro-Fit pin numbering against Molex's drawing, and the placement
rotations of the relays against JLCPCB's footprints. The DAC81408 has the thinnest stock of the new parts (122 at
JLCPCB on 2026-11-14); the fallback is the 16-channel DAC81416 (C2680104), which needs its own pin table.

## Rev B layout (2026-11-14/15)

You approved the rev B schematic (sha256 0cbcbf2c85dd…, 2026-11-14). The board routed after seven runs to 0
unconnected, DRC 0 errors / 0 warnings with schematic parity; 347 placements, order files in `build/helmet-driver/order/`
(`fab/rev-B/`). The 0.5 mm pitch parts (DAC81408, three ADS8688, the island's DAC80504) were what the router could not
manage at first; what fixed it, in `pcb.ts` and the flow:

- **Rails at the fine-pitch pins 0.25 mm** (+3V3, ±15 V, +5VA). A 0.3 mm track down the middle of a 0.5 mm pitch pin sits
  exactly at the 0.2 mm clearance, and +15 V and −15 V on the DAC's neighbouring corner pins could not both leave.
- **The ADS8688s' ground vias under their bodies** (`planeViaFirst: "inward"`): their AIN_nGND pins alternate with the
  inputs, and vias outside the row boxed the inputs in. **The DACs' corner ground vias at 45°** (`"diagonal"`): straight
  out they walled in the DAC81408's VIO pin and squeezed the island DAC's ISO_5V pin 7 to 0.1 mm.
- **A small keep-out under the island DAC's corner**, between its exposed pad and pins 7–9, so ISO_5V joins outside the
  part; it stays 0.07 mm clear of every pad (reaching a pad's side, it made the router neck that pin's track instead).
- **Small parts next to their pin**: on the power, converter and island pages, a resistor or capacitor whose net reaches
  one IC pin is placed by that pin. The TPS65131's feedback and compensation parts had been 10–15 mm away (in rev A too);
  now 4.5–8 mm, its diodes and inductors pinned where rev A had them so the switching nodes stay short.
- **The VREF test point at the top edge**: under the DAC81408 (rev A's spot) its through-hole pads blocked the DAC's pins.
- **Freerouting 2.4.1 is deterministic**: the same input gives the same board, so the flow now gives every attempt its own
  via cost (default, 35, 70, 25, 100) and keeps the best; the fourth (25) routed this board. A run that ends without a
  session file (it happened twice) no longer stops the flow.

**Still open before ordering** (unchanged): the Micro-Fit pin numbering, the relays' placement rotation (the fab step
flags K1–K4), and the DAC81408's stock.
