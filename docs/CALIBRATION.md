# Bench test and calibration

## 1. Bench test of the AD5328 module (no coils connected)

The module's output stage is undocumented. The firmware assumes:
- 2.5 V onboard reference (jumper 1-2);
- AD5328 GAIN = 1, giving 0–5 V from the DAC;
- module output = 4·V_DAC − 10 V, so code 0x000 → −10 V, 0x800 → 0 V, 0xFFF → +10 V.

Verify this before connecting coils:

1. Module jumper on **1-2**, 5 V from a USB supply, ESP32 wired as in docs/WIRING.md, **no coils, arming switch not connected**.
2. Flash the firmware (`cd firmware && pio run -t upload`) and connect the app (Connect → GodHelmet-XXXX).
3. **Power-on state.** Before the ESP32 boots (hold its EN button), measure AO1…AO8 against GND. Expect ≈ −10 V (DAC code 0). This is why the arming switch exists.
4. **After boot.** All outputs should read **0 V ± 20 mV** (mid-scale).
5. **Full scale.** In the app, Setup → Calibration → DC test on CH1 at +4.5 mA. With nothing connected, the output is the DAC voltage: expect about +9.9 V. At −4.5 mA expect about −9.9 V. Check every channel. CH1 must be AO1 (DAC A), and so on.
6. **If full scale is only 0 to −10 V or −10 to 0 V**, the module expects the other gain setting: toggle "DAC gain ×2" in Setup → Helmet and repeat. If the swing is ±5 V, set "Module full scale" to 5.

## 2. Wiring and polarity check (coils connected, helmet off)

- **Setup → Wiring check → rotation test**, 1000 ms dwell, 2 mA. Measure the voltage across each 2.2 kΩ resistor: about 4.4 V on the active channel and 0 V elsewhere, moving in CCW order (docs/PLACEMENT.md).
- **DC test per coil with a compass** in front of the coil face. Mark the face the compass's south end points to as N (it is the coil's north pole). Mount all coils N-face inward.

## 3. Field calibration (µT per mA at 20 mm)

The firmware converts the µT you choose into current using a per-channel factor: µT at 20 mm, on axis, per mA. The default 1.8 is the model of this coil with its core; the same winding without a core gives 0.73 (`tools/coil_field.py`). Measure every coil: the core material of these commodity coils is not documented (sellers list ferrite or iron), and the field falls about 12 % per mm at 20 mm, so the spacer must be accurate to ±0.3 mm for ±4 %.

**You need:**
- a phone with a magnetometer and **phyphox** (free; "Magnetometer" experiment, absolute values), or the optional I2C magnetometer;
- a 20 mm spacer (a stack of coins, a piece of wood).

**Per coil:**
1. Lay the phone flat and find where its magnetometer sits (move a small magnet over it; usually near the top edge). Find the axis that changes most when the coil is held against the phone.
2. Put the coil face 20 mm from the sensor, on axis, with nothing metallic nearby.
3. Note the reading with the coil **off** (Earth's field and phone offsets).
4. Start a DC test at **+2 mA** (Setup → Calibration) and note the reading **on**.
5. Repeat at **−2 mA**; the change should be the same size with the opposite sign.
6. Enter |on − off| and the current; "Use for this channel" computes µT/mA. Save.

Or collect all readings in a CSV and fit them:

```
channel,mA,uT_on,uT_off
1,2,49.10,47.62
1,-2,46.15,47.62
...
```
```
python3 tools/calibrate.py measurements.csv
```

Type the printed values into Setup → Calibration and save.

Expected values: about 1.8 µT/mA with the core (model range 1.4–2.2), 0.73 without. With 1.8, the 4.54 mA cap gives about 8 µT at 20 mm, about 1 µT at 45 mm and about 0.47 mT at the core face. An uncalibrated helmet with the old default (0.73) delivered about 2.4× the requested field; with the current default the error is small if the coil has a core and the field comes out lower (about 0.4×) if it has none.

To check the model itself, also measure on axis at 0, 2, 5, 10 and 40 mm and at 90° in the coil's mid-plane (reverse the current to cancel Earth's field). Model values per mA: 105 µT at the face, 60 at 2 mm, 25 at 5 mm, 8.1 at 10 mm, 0.33 at 40 mm; −0.6 µT at 90°, 20 mm from the coil's side. A fluxgate (FLC100) or MMC5983MA works from about 5 mm outwards; use a Hall sensor (DRV5055) only at 0–5 mm.

## 4. What the numbers mean

| Setting | Meaning |
|---|---|
| Intensity (µT) | Peak field 20 mm in front of each coil, i.e. roughly at the cortex under it |
| Max field (Setup) | Your ceiling (default 5 µT, absolute limit 10 µT) |
| Max reachable | Hardware cap × weakest channel's µT/mA |

Literature values: Persinger helmet ≈ 1 µT; Octopus 5–10 µT; Shakti 1–9 µT. Presets default to 1 µT (2 µT for the circumcerebral research presets).
