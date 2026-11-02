# Standalone display board

The 2.8" ESP32-32E display board runs the helmet **without the web app**:
- the 198 programs live on the board's microSD card;
- you pick, start, stop and rate them on the touchscreen;
- the board shows where each coil goes, with tape-measure directions computed for your head.

Bluetooth stays available as a setting if you also want the web app.

Wiring, the power-on rule and the safety notes for this board are in [WIRING.md](WIRING.md#esp32-32e-28-display-board). The rest of this page is setup and use.

## What you need

- The 2.8" ESP32-32E board ("2.8inch ESP32-32E Display", LCDwiki E32R28T / E32N28T), wired to the AD5328 module as in [WIRING.md](WIRING.md#esp32-32e-28-display-board).
- A microSD card, FAT32 (any size; the programs need about 1 MB).
- A computer with [PlatformIO](https://platformio.org/) and Node.js, once, to flash the firmware and build the program pack.
- A power bank for the sessions.

## 1. Flash the firmware

With the **helmet off** (until the firmware runs, the coil outputs can sit at full drive):

```sh
cd firmware
pio run -e esp32e_lcd28 -t upload
pio device monitor            # optional: boot log (SD card, clock, free memory)
```

The first build downloads the display library (LovyanGFX 1.1.16).

## 2. Put the programs on the SD card

```sh
cd webapp
npm install
npm run sd-pack -- ~/Desktop/sdpack
```

Copy the folder `~/Desktop/sdpack/godhelmet` to the **root** of the card, then put the card in the board. Rebuild and copy it again when the programs change. The board says so if the pack is too old for its firmware.

| On the card | Contents |
|---|---|
| `godhelmet/index.tsv` | One line per program: category, duration, coil sites, name |
| `godhelmet/categories.tsv` | The program categories |
| `godhelmet/p/NNN.json` | The program itself (compact form of the preset JSON) |
| `godhelmet/t/NNN.txt` | Text for the Details page: evidence, summary, setting, schedule, notes |
| `godhelmet/sites.tsv`, `tape.json` | Coil map and the template head for the tape-measure directions |
| `godhelmet/wifi.example.txt` | Template for the clock (next step) |

The card is read only between sessions. It shares its bus with the coil driver, so the board loads a program fully before the session starts.

## 3. The clock

The board has no clock battery. It needs the date and time for two things: the times in the log, and the 72-hour check between sessions. Choose one way to set it:
- **WiFi, automatic.** Rename `wifi.example.txt` on the card to `wifi.txt` and enter your network:
  ```
  ssid=YourNetwork
  password=YourPassword
  tz=CET-1CEST,M3.5.0,M10.5.0/3
  ```
  At power-on the board fetches the time and switches WiFi off again before anything else happens. `tz` is a [POSIX time zone](https://www.gnu.org/software/libc/manual/html_node/TZ-Variable.html); the default is Central Europe.
- **On the screen.** Use **Settings → Clock** after each power-on. Without a clock, sessions still run. Their log entries have no time, and the start screen warns before it starts one.

## 4. First start

1. Power the board (helmet off) and wait for the screen.
2. **Touch calibration:** touch the tip of each arrow as it appears.
3. **Safety page:** read it to the end and accept it. It is the same as [SAFETY.md](SAFETY.md) in short.
4. **Before the first session**, do the bench test and the wiring checks from [CALIBRATION.md](CALIBRATION.md), using **Settings → Module check** and **Settings → Coil test**.

### The module question

The AD5328 has no data-out pin, so the board cannot tell whether the module is connected: without it, a program would run into nothing. So the first program or coil test after each power-on asks you to confirm the module (LED on, GND and the three SPI wires, LDAC to 3.3V, reference jumper, coils). **Connected** confirms it until the next power-on; **Check it** opens the Module check. Home shows whether it is confirmed.

## Screens

| Screen | What it does |
|---|---|
| **Home** | Program count, clock, last session (with the 72-hour warning), Bluetooth. Buttons: Programs, Log, Settings |
| **Programs** | Categories, then the programs in each: name, minutes, coils, evidence |
| **Program** | Summary and evidence; **Coils**, **Details**, **Start** |
| **Coils** | Seen from above, nose up, your left on the left. Step through the coils with the arrows or tap one on the map. For each coil: where it goes, in cm for your head, and how to measure it accurately |
| **Details** | The program's full text: evidence, summary, setting, schedule, placement basis, notes |
| **Start** | Field strength (µT at 20 mm, up to your ceiling) and **Blind**: real or sham drawn at random and revealed after you rate. Missing clock or a session less than 72 h ago: a warning, and you tap Start twice |
| **Session** | Time left, phase, field ±, **Skip phase**, **STOP**. The BOOT button is STOP too. The screen stays on, or follows **Settings → Screen in session**: dimmed, or dark after 10 s (touch it higher up to see it again; **in the dark, the bottom quarter of the screen is STOP**) |
| **Rate** | 0 (nothing) to 10 (profound), before you look anything up. Blind sessions show real or sham once rated. **Later** leaves it in the log |
| **Log** | Past sessions, newest first; tap an unrated one to rate it |
| **Settings** | Head size, Clock, Brightness, Screen in session, Field limits, Module check, LED test, Coil test, Bluetooth, Touch calibration, Display, Safety page, About |

Settings in detail:
- **Head size:** three tape measurements in cm. Each one goes over the crown, or round the band line: nasion to inion, ear to ear (tragus to tragus), and the band line round the head. Until you enter them, the coil directions use a typical head ([PLACEMENT.md](PLACEMENT.md)).
- **Screen in session:** tap to switch between **on** (the default), **dimmed**, and **dark after 10 s** for sessions in a dark room.
- **Field limits:** the highest field any program may use, and the field for programs that set none.
- **Module check:** three steps with a multimeter.
  1. The module's test pads (5 V, ±12 V, VREF 2.50 V) and the wires.
  2. Every output at 0 V while idle. All of them near ±10 V means the module has power but gets no data: check CLK, DIN, SYNC and GND.
  3. Each output in turn at +5 V or −5 V for 60 s.

  **Module OK** confirms the module until the next power-on.
- **LED test:** checks the outputs without coils or a multimeter.
  - **Wiring:** in place of a coil, two LEDs side by side and opposite ways round, from the coil's 2.2 kΩ resistor to GND. A two-leg red/green LED works too.
  - **What it does:** each LED flashes at the rate you pick: +4 mA, pause, −4 mA, pause, a quarter of a blink each, so one LED flashes, then the other. The resistor keeps the LEDs at about 3 mA.
  - **Rate:** 0.5, 1, 2, 5 or 10 Hz, or **0.5 to 10 Hz**: 8 s at each rate on one output (40 s), or one round of AO1 to AO8 at each rate (80 s). The session screen shows the current rate. If the flashing follows the rate you picked, the board is driving that output.
  - **Modes:** **This output** tests the selected AO. **All in turn** steps AO1 to AO8, 2 s each.
  - **What you see:**
    - Neither LED lights → run the Module check.
    - Only one lights → the other is missing or the wrong way round.
    - An LED lights all the time, also when no test runs → the module gets no data. It still holds its power-up output of about −10 V. Check CLK (IO18), DIN (IO23), SYNC (IO27) and the GND wire, then the Module check.

  Use two LEDs rather than one: on its own, a single LED gets up to 9 V in reverse on the − half, more than LEDs are rated for.
- **Coil test:** a steady current through one coil (**DC test**, for the bench test and the µT/mA calibration in [CALIBRATION.md](CALIBRATION.md)), or each coil in turn (**Rotate**, to check the wiring). Measure the field 20 mm from the coil face, divide by the mA, enter it as **µT per mA** for that coil, and **Save**.
- **Bluetooth:** on lets the web app connect as before. Changing it restarts the board (helmet off).
- **Display:** the panel driver is detected at boot (ILI9341 or ST7789). If the colours or the picture look wrong, try the next driver. The board restarts.
- **Touch calibration:** redo it here, or hold the **BOOT** button for 3 s while no session runs, if taps land in the wrong place.

## Only in the web app

These need a phone or a computer and stay in the web app (Bluetooth on):
- guided sessions with beat audio;
- remote-viewing and telepathy trials;
- questionnaires;
- the NOAA space-weather values.

## Screens without a board

`firmware/test/uisim/run.sh` draws every screen on the computer (macOS or Linux with SDL2, e.g. `brew install sdl2`), using the same UI code and a freshly built program pack. It taps through all of them and saves PNGs in `firmware/.pio/uisim/shots`. Run `pio pkg install -e esp32e_lcd28` once first.
