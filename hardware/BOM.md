# Bill of materials

## On hand

| Qty | Part | Notes |
|---|---|---|
| 1 | ESP32-S3-DevKitC-1 (N8R8 or N16R8) | Controller, Bluetooth LE to the web app. A classic ESP32 DevKitC also works (env `esp32dev`) |
| 1 | AD5328 module V1.2 | 8 × 12-bit DAC, ±10 V outputs, 5 V supply (≤ 5.5 V), 3.3 V logic; reference jumper on 1-2 |
| 8 | Levitation coil 19 × 12 mm | 495 turns, 4.2 Ω, 4.1 mH, ferrite core with M3 thread |

## To buy

| Qty | Part | Example / spec | Why |
|---|---|---|---|
| 8 (+4 spare) | Resistor 2.2 kΩ, 1 %, ¼ W metal film | – | **Mandatory** current limit per coil (4.54 mA max) |
| a few | Resistors 4.7 kΩ and 1 kΩ | – | Lower/higher ceiling if your calibration calls for it |
| 1 | PhotoMOS relay AQY212EH (or AQY212GH, G3VM-61A1) | 60 V, 500 mA, bidirectional | Arming switch in the common coil return (silent) |
| 1 | Resistors 330 Ω + 10 kΩ | – | PhotoMOS LED series resistor + pull-down |
| | *alt.* 1-channel 5 V relay module, active-high, with input pull-down | – | Instead of the PhotoMOS |
| 1 | Momentary push button, normally open | Panel or hand-held | Hardware STOP |
| 1 | Perfboard + pin headers + Dupont wires | – | Resistor/arming board |
| 2 | RJ45 PCB jacks (box) + 2 RJ45 breakouts (headband) | – | Detachable headband |
| 2 | Cat5e patch cable, 1–2 m | Unshielded is fine | 8 twisted pairs for 8 coils |
| 1 | Neoprene / elastic headband, 6–8 cm wide, with Velcro | Sports or EEG headband | Movable coil mounting |
| 1 | Velcro (hook) dots | – | Coil clips |
| 8 | Nylon M3 screws, 8–10 mm | Non-magnetic | Coil mounting into the ferrite core |
| 1 | Kapton tape, heat-shrink, epoxy/hot glue | – | Protect the windings and leads |
| 1 | USB power bank, 5 V ≥ 2 A | With "low-current/always-on" mode if possible | Battery-only operation |
| 1 | Enclosure ~120 × 80 × 40 mm | – | Control box |
| 1 | Sleep mask / blindfold | – | Session setting (darkness) |

## Optional

| Part | Use |
|---|---|
| MMC5983MA or LIS3MDL I2C breakout | Magnetometer for precise calibration |
| 8-channel USB logic analyser (24 MHz) | Verify SPI/LDAC timing |
| Multimeter | Bench test, resistor voltages |
| Second ESP32 + AD5328 + 8 coils | Yoked two-person telepathy (Persinger 2010 style) |
| OpenBCI / ADS1299 EEG | Check the claimed theta/gamma changes yourself |
