// Schematic source of truth for helmet-driver. Generate + check with `bun run sch -- helmet-driver`
// (ERC must report 0 errors and 0 warnings; review the PDF in build/helmet-driver/ before layout).
//
// The controller board of god-helmet (spec.md): ESP32-S3 with Bluetooth LE, eight current-output coil channels,
// two isolated tES channels. Values and connections are explained in spec.md and design-notes.md; the analog
// values are the ones the benches in sim/ check (helmet-driver.lib).
//
// Drawn as A3 pages (your request 2026-11-13: readable, with wires): signal chains are wired left to right; nets
// that run between pages carry global labels; rails are power symbols. draw.ts holds the drawing kit.
// Part keys seed the UUIDs that link symbols to footprints: never rename a key once layout has started.
import { defineSchematic } from "../../tools/sch/dsl.ts";
import { flagAt, hPart, multi, nc, nets, noConnect, on, parts, pin, place, setPage, text, unit, vPart, wire, type P } from "./draw.ts";

// ---- helpers ---------------------------------------------------------------------------------------------------

const R = (s: string, k: string, v: string, at: P, dir: "h" | "v" = "h") => (dir === "h" ? hPart : vPart)(s, k, "R", "res-0603", v, at);
const RP = (s: string, k: string, v: string, at: P, dir: "h" | "v" = "h") => (dir === "h" ? hPart : vPart)(s, k, "R", "res-0603-precision", v, at);
const C = (s: string, k: string, v: string, at: P, dir: "h" | "v" = "v") => (dir === "h" ? hPart : vPart)(s, k, "C", "cap-0603", v, at);
const C1206 = (s: string, k: string, at: P) => vPart(s, k, "C", "cap-1206", "10u 50V", at);
const C1210 = (s: string, k: string, at: P) => vPart(s, k, "C", "cap-1210", "10u 25V", at);
const BEAD = (s: string, k: string, left: P) => hPart(s, k, "FB", "ferrite-0805", "600R", left, 2);
/** A vertical capacitor between two rails with power symbols on both ends (decoupling). */
let decN = 0;
function dec(s: string, top: P, upper: string, lower: string, value = "100n") {
  const k = `cDec${++decN}`;
  C(s, k, value, top);
  on(upper, `${k}.1`);
  on(lower, `${k}.2`);
}
/** A vertical resistor between a rail (top) and a labelled net (bottom), or the other way round. */
function vRes(s: string, k: string, v: string, top: P, upper: string, lower: string) {
  R(s, k, v, top, "v");
  on(upper, `${k}.1`);
  on(lower, `${k}.2`);
}
const title = (s: string, at: P, t: string, size = 2) => text.push({ at, text: t, size, sheet: s });
const rel = (ox: number, oy: number) => (dx: number, dy: number): P => [ox + dx, oy + dy];

const SHEETS = [
  { id: "power", title: "Power: USB-C input, 3.3 V, ±15 V for the coil drivers" },
  { id: "mcu", title: "ESP32-S3 with Bluetooth LE, buttons, STOP, status LED, sensing" },
  { id: "safety", title: "Safety logic: TRIP and STOP latches, ENABLE, coil trip thresholds" },
  { id: "converters", title: "DAC81408 and the monitor ADCs (ADS8688)" },
  { id: "coil-a", title: "Coil channels 1-4" },
  { id: "coil-b", title: "Coil channels 5-8" },
  { id: "coil-supply", title: "Coil connector, supplies of the coil drivers and comparators" },
  { id: "island", title: "tES island: isolated power, isolators, DAC, ADC" },
  { id: "island-safety", title: "tES island: trip thresholds, latch, heartbeat, relay drive" },
  { id: "tes-1", title: "tES channel 1" },
  { id: "tes-2", title: "tES channel 2" },
];

// Multi-unit parts whose units sit on several pages
for (const d of ["drv12", "drv34", "drv56", "drv78"]) multi(d, "U", "opa2197-soic8", "OPA2197"); // coil drivers, 2 channels each
multi("inv", "U", "74lvc2g14", "74LVC2G14"); // the ARM delay's two Schmitt stages
multi("and2", "U", "74lvc2g08", "74LVC2G08"); // DAC_RST_N and TES_ENG
for (const q of ["cmp1", "cmp2", "cmp3", "cmp4"]) multi(q, "U", "lm339-soic14", "LM339B"); // coil trips, 2 per channel
multi("cmpI", "U", "lm339-soic14", "LM339B"); // island trips
multi("ff", "U", "74hc74-soic14", "74HC74"); // TRIP and STOP latches
multi("ffI", "U", "74hc74-soic14", "74HC74"); // island latch
multi("opaT1", "U", "opa4197-soic14", "OPA4197"); // tES channel 1
multi("opaT2", "U", "opa4197-soic14", "OPA4197"); // tES channel 2

// =================================================================================================================
// 1. Power: USB-C, ESD, 3.3 V, TPS65131 (TI SLVS493E Figure 8-1, Table 8-2)
// =================================================================================================================
{
  const s = "power";
  setPage(s);
  title(s, [14, 12], "USB-C input (power bank), ESD protection, 3.3 V");
  place(s, "usbc", "J", "usb-c-type-c-31-m-12", "TYPE-C-31-M-12", [30, 40]);
  on("+5V", "usbc.A4", "usbc.A9", "usbc.B4", "usbc.B9");
  on("GND", "usbc.A1", "usbc.A12", "usbc.B1", "usbc.B12", "usbc.SH");
  on("USB_DN", "usbc.A7", "usbc.B7");
  on("USB_DP", "usbc.A6", "usbc.B6");
  nc("usbc", "A8", "B8");
  // CC1, CC2: 5.1 kΩ to GND (a sink); their voltage tells the ESP32 the current the source offers (through 1 kΩ)
  wire("CC1", "usbc.A5", [62, 32]);
  R(s, "rCc1", "5.1k", [62, 32], "v");
  on("GND", "rCc1.2");
  wire("CC1", [62, 32], [66, 32]);
  R(s, "rCc1Adc", "1k", [66, 32]);
  on("CC1_ADC", "rCc1Adc.2");
  wire("CC2", "usbc.B5", [56, 34]);
  wire("CC2", [56, 34], [56, 48]);
  R(s, "rCc2", "5.1k", [56, 48], "v");
  on("GND", "rCc2.2");
  wire("CC2", [56, 48], [66, 48]);
  R(s, "rCc2Adc", "1k", [66, 48]);
  on("CC2_ADC", "rCc2Adc.2");
  place(s, "esd", "U", "usblc6-2sc6", "USBLC6-2SC6", [96, 40]);
  on("USB_DP", "esd.1", "esd.6");
  on("USB_DN", "esd.3", "esd.4");
  on("+5V", "esd.5");
  on("GND", "esd.2");
  place(s, "tvs5v", "D", "tvs-smb", "SMBJ6.0A", [20, 80], { rot: 270 });
  on("+5V", "tvs5v.1");
  on("GND", "tvs5v.2");
  for (const [k, x] of [["cIn1", 30], ["cIn2", 38]] as const) {
    C1206(s, k, [x, 77]);
    on("+5V", `${k}.1`);
    on("GND", `${k}.2`);
  }
  place(s, "ldo3v3", "U", "ap2112k-3.3", "AP2112K-3.3", [76, 92]);
  on("+5V", "ldo3v3.1", "ldo3v3.3");
  on("GND", "ldo3v3.2");
  on("+3V3", "ldo3v3.5");
  nc("ldo3v3", 4);
  dec(s, [52, 88], "+5V", "GND", "1u 25V");
  C1206(s, "cLdoOut", [94, 88]);
  on("+3V3", "cLdoOut.1");
  on("GND", "cLdoOut.2");

  title(s, [130, 12], "+/-15 V for the coil drivers (TPS65131): on only while ENABLE is high; the PMOS disconnects the boost side");
  place(s, "tps", "U", "tps65131-vqfn24", "TPS65131", [200, 80]);
  // boost: PMOS load switch on BSW, inductor, Schottky, output 14.56 V
  place(s, "qBsw", "Q", "ao3401a-sot23", "AO3401A", [160, 60]);
  on("+5V", "qBsw.2");
  wire("BSW", "qBsw.1", [152, 60]);
  wire("BSW", [152, 60], [152, 70]);
  wire("BSW", [152, 70], "tps.7");
  wire("BOOST_IN", "qBsw.3", [162, 50]);
  wire("BOOST_IN", [162, 50], [166, 50]);
  hPart(s, "l1", "L", "ind-power-6045", "4.7u", [166, 50]);
  wire("SWP", "l1.2", [180, 50]);
  wire("SWP", [180, 50], [180, 68]);
  wire("SWP", [180, 68], "tps.1");
  on("SWP", "tps.24"); // stacked with pin 1 (INP)
  place(s, "d1", "D", "schottky-sma", "SS14", [184, 44], { rot: 180 });
  wire("SWP", [180, 50], [180, 44]);
  wire("SWP", [180, 44], "d1.2");
  wire("VPOS", "d1.1", [214, 44]);
  wire("VPOS", [214, 44], [214, 68]);
  wire("VPOS", [214, 68], "tps.23");
  // positive divider: 1.213 V x (1 + 1.1M / 100k) = 14.56 V, 6.8 pF feed-forward (TI)
  wire("VPOS", [214, 44], [222, 44]);
  R(s, "rFbp1", "1.1M", [222, 44], "v");
  R(s, "rFbp2", "100k", [222, 52], "v");
  wire("FBP", "rFbp1.2", "rFbp2.1");
  on("GND", "rFbp2.2");
  wire("FBP", [222, 51], [218, 51]);
  wire("FBP", [218, 51], [218, 70]);
  wire("FBP", [218, 70], "tps.22");
  wire("VPOS", [222, 44], [230, 44]);
  C(s, "cFbp", "6.8p C0G", [230, 44]);
  wire("FBP", "cFbp.2", [230, 51]);
  wire("FBP", [230, 51], [222, 51]);
  wire("VPOS", [230, 44], [240, 44]);
  C1210(s, "cVpos1", [240, 44]);
  wire("VPOS", [240, 44], [250, 44]);
  C1210(s, "cVpos2", [250, 44]);
  on("GND", "cVpos1.2", "cVpos2.2");
  wire("VPOS", [250, 44], [258, 44]);
  BEAD(s, "fbP15", [258, 44]);
  on("+15V", "fbP15.2");
  C1210(s, "cP15", [274, 50]);
  on("+15V", "cP15.1");
  on("GND", "cP15.2");
  // inverting: OUTN, inductor to GND, Schottky to VNEG; output -14.56 V
  wire("SWN", "tps.13", [216, 84]);
  on("SWN", "tps.14"); // stacked with pin 13 (OUTN)
  vPart(s, "l2", "L", "ind-power-6045", "4.7u", [216, 88]);
  wire("SWN", [216, 84], "l2.1");
  on("GND", "l2.2");
  place(s, "d2", "D", "schottky-sma", "SS14", [222, 84]);
  wire("SWN", [216, 84], "d2.1");
  wire("VNEG", "d2.2", [228, 84]);
  wire("VNEG", [228, 84], [228, 80]);
  wire("VNEG", [228, 80], "tps.15");
  // negative divider: -1.213 V x 1.2M / 100k = -14.56 V; the low resistor goes to VREF (TI); 7.5 pF feed-forward
  wire("VNEG", [228, 84], [234, 84]);
  R(s, "rFbn1", "1.2M", [234, 84], "v");
  wire("FBN", "rFbn1.2", [234, 92]);
  R(s, "rFbn2", "100k", [234, 94], "v");
  wire("FBN", [234, 92], "rFbn2.1");
  on("TPS_REF", "rFbn2.2");
  wire("VNEG", [234, 84], [242, 84]);
  C(s, "cFbn", "7.5p C0G", [242, 84]);
  wire("FBN", "cFbn.2", [242, 92]);
  wire("FBN", [242, 92], [234, 92]);
  on("FBN", "tps.16");
  wire("VNEG", [242, 84], [252, 84]);
  C1210(s, "cVneg1", [252, 84]);
  wire("VNEG", [252, 84], [262, 84]);
  C1210(s, "cVneg2", [262, 84]);
  on("GND", "cVneg1.2", "cVneg2.2");
  wire("VNEG", [262, 84], [270, 84]);
  BEAD(s, "fbN15", [270, 84]);
  on("-15V", "fbN15.2");
  C1210(s, "cN15", [286, 90]);
  on("GND", "cN15.1");
  on("-15V", "cN15.2");
  // control: ENABLE on both enables; PWM always (PSP, PSN low); VIN through 100 Ω with 100 nF
  on("ENABLE", "tps.8", "tps.10");
  on("GND", "tps.9", "tps.11", "tps.2", "tps.3", "tps.19", "tps.25");
  on("+5V", "tps.5", "tps.6");
  on("TPS_REF", "tps.17");
  on("TPS_CP", "tps.21");
  on("TPS_CN", "tps.18");
  nc("tps", 12, 20);
  R(s, "rTpsVin", "100R", [158, 78]);
  on("+5V", "rTpsVin.1");
  wire("TPS_VIN", "rTpsVin.2", "tps.4");
  C(s, "cTpsVin", "100n", [172, 98]);
  on("TPS_VIN", "cTpsVin.1");
  flagAt("TPS_VIN", "cTpsVin.1");
  on("GND", "cTpsVin.2");
  for (const [k, x] of [["cTpsIn1", 136], ["cTpsIn2", 144]] as const) {
    C1206(s, k, [x, 56]);
    on("+5V", `${k}.1`);
    on("GND", `${k}.2`);
  }
  C(s, "cTpsRef", "220n", [190, 112]);
  on("TPS_REF", "cTpsRef.1");
  on("GND", "cTpsRef.2");
  C(s, "cTpsCp", "10n C0G", [202, 112]);
  on("TPS_CP", "cTpsCp.1");
  on("GND", "cTpsCp.2");
  C(s, "cTpsCn", "4.7n C0G", [214, 112]);
  on("TPS_CN", "cTpsCn.1");
  on("GND", "cTpsCn.2");
  vRes(s, "rEnPd", "100k", [160, 100], "ENABLE", "GND");
  place(s, "tpP15", "TP", "testpoint-2pad", "TP", [290, 64]);
  on("+15V", "tpP15.1");
  on("GND", "tpP15.2");
  place(s, "tpN15", "TP", "testpoint-2pad", "TP", [290, 106]);
  on("-15V", "tpN15.1");
  on("GND", "tpN15.2");
}

// =================================================================================================================
// 2. ESP32-S3-WROOM-1 (Bluetooth LE and Wi-Fi on the module, PCB antenna); pins as the firmware's esp32s3 env
// =================================================================================================================
{
  const s = "mcu";
  setPage(s);
  title(s, [14, 12], "ESP32-S3-WROOM-1-N16R8: Bluetooth LE to the app (module antenna), native USB on GPIO19/20");
  place(s, "esp", "U", "esp32-s3-wroom-1", "N16R8", [160, 100]);
  on("GND", "esp.1", "esp.40", "esp.41");
  on("+3V3", "esp.2");
  const io: Record<number, string> = {
    39: "CEIL_ADC", 38: "P15_ADC", 4: "ARM", 5: "STOP_F", 6: "N15_ADC", 7: "CC1_ADC", 12: "CC2_ADC", 17: "LDAC",
    18: "CS_DAC", 19: "MOSI0", 20: "SCLK0", 21: "CS_ADC", 15: "MISO", 22: "TRIP_Q", 8: "STOP_Q", 9: "CLR_N", 10: "SDA", 11: "SCL",
    13: "USB_DN", 14: "USB_DP", 23: "TES_EN", 31: "T_SCK", 32: "T_MOSI", 33: "T_MISO", 34: "T_CSD", 35: "T_CSA",
    37: "TXD0", 36: "T_FAULT", 24: "T_HB", 25: "LED_IO", 27: "BOOT",
  };
  // MISO on module pin 15 (GPIO3), the last free pin besides 45 and 46. GPIO3 is a strapping pin, but only for the JTAG
  // source, and its level is ignored while EFUSE_DIS_PAD_JTAG, EFUSE_DIS_USB_JTAG and EFUSE_STRAP_JTAG_SEL are 0, their
  // default (ESP32-S3 Series Datasheet v2.2, section 3 and Table 3-5, p. 35). Nothing here burns them.
  for (const [p, n] of Object.entries(io)) on(n, `esp.${p}`);
  nc("esp", 16, 26, 28, 29, 30);
  // EN: 10 kΩ / 1 µF delay (Espressif), RESET button
  wire("EN", "esp.3", [124, 82]);
  R(s, "rEn", "10k", [124, 74], "v");
  on("+3V3", "rEn.1");
  wire("EN", "rEn.2", [124, 82]);
  C(s, "cEn", "1u 25V", [124, 84]);
  wire("EN", [124, 82], "cEn.1");
  on("GND", "cEn.2");
  place(s, "swReset", "SW", "sw-tactile-smd", "TS-1187A-B-A-B", [114, 82]);
  wire("EN", "swReset.2", [124, 82]);
  on("GND", "swReset.1");
  title(s, [96, 70], "RESET", 1.5);
  // BOOT (GPIO0): pull-up and button
  place(s, "swBoot", "SW", "sw-tactile-smd", "TS-1187A-B-A-B", [104, 110]);
  on("BOOT", "swBoot.2");
  on("GND", "swBoot.1");
  vRes(s, "rBoot", "10k", [116, 100], "+3V3", "BOOT");
  title(s, [80, 118], "BOOT (also a STOP when held 40 ms)", 1.5);
  // supply decoupling at the module
  C1206(s, "cEsp1", [196, 70]);
  on("+3V3", "cEsp1.1");
  on("GND", "cEsp1.2");
  dec(s, [204, 70], "+3V3", "GND");
  dec(s, [212, 70], "+3V3", "GND");
  // status LED: WS2812B-2020-V6 runs from 3.3 V (no level shifter)
  title(s, [232, 40], "Status LED", 1.5);
  R(s, "rLed", "33R", [226, 50]);
  on("LED_IO", "rLed.1");
  place(s, "led", "D", "ws2812b-2020", "WS2812B-2020-V6", [244, 50]);
  wire("LED_DIN", "rLed.2", "led.3");
  on("+3V3", "led.4");
  on("GND", "led.2");
  nc("led", 1);
  dec(s, [260, 46], "+3V3", "GND");
  // STOP: on-board button and a 3.5 mm jack for the hand-held button, both to GND; 10 kΩ up, 1 kΩ / 100 nF into STOP_F
  title(s, [20, 140], "STOP: on-board button and jack for the hand-held button (both close to GND)", 1.5);
  place(s, "jStop", "J", "jack-3.5mm-stop", "PJ-320D-4A", [30, 160]);
  on("GND", "jStop.S", "jStop.R1", "jStop.R2");
  wire("STOP_N", "jStop.T", [50, 164]);
  place(s, "swStop", "SW", "sw-tactile-smd", "TS-1187A-B-A-B", [50, 172], { rot: 90 });
  wire("STOP_N", [50, 164], "swStop.2");
  on("GND", "swStop.1");
  wire("STOP_N", [50, 164], [60, 164]);
  R(s, "rStopPu", "10k", [60, 156], "v");
  on("+3V3", "rStopPu.1");
  wire("STOP_N", "rStopPu.2", [60, 164]);
  wire("STOP_N", [60, 164], [64, 164]);
  R(s, "rStop", "1k", [64, 164]);
  wire("STOP_F", "rStop.2", [74, 164]);
  C(s, "cStop", "100n", [74, 166]);
  wire("STOP_F", [74, 164], "cStop.1");
  on("GND", "cStop.2");
  // pull-ups and pull-downs: ARM and TES_EN low while the ESP32 starts, chip selects high, I²C
  title(s, [100, 140], "Pull-ups and pull-downs", 1.5);
  const pulls: [string, string, string, string][] = [
    ["rArm", "10k", "ARM", "GND"], ["rTesEn", "10k", "TES_EN", "GND"], ["rClr", "10k", "+3V3", "CLR_N"],
    ["rCsd", "10k", "+3V3", "T_CSD"], ["rCsa", "10k", "+3V3", "T_CSA"], ["rSda", "4.7k", "+3V3", "SDA"], ["rScl", "4.7k", "+3V3", "SCL"],
  ];
  pulls.forEach(([k, v, a, b], i) => vRes(s, k, v, [104 + i * 14, 150], a, b));
  // rev B: the DAC's and the ADCs' chip selects and the DAC's LDAC (active low) high while the ESP32 starts
  const pullsB: [string, string, string, string][] = [["rCsDac", "10k", "+3V3", "CS_DAC"], ["rCsAdc", "10k", "+3V3", "CS_ADC"], ["rLdac", "10k", "+3V3", "LDAC"]];
  pullsB.forEach(([k, v, a, b], i) => vRes(s, k, v, [104 + i * 14, 176], a, b));
  // SPI series resistors
  title(s, [210, 140], "SPI to the DAC and the ADCs (33 Ω series)", 1.5);
  R(s, "rSclk", "33R", [214, 152]);
  on("SCLK0", "rSclk.1");
  on("SCLK", "rSclk.2");
  R(s, "rMosi", "33R", [214, 160]);
  on("MOSI0", "rMosi.1");
  on("MOSI", "rMosi.2");
  place(s, "tpTx", "TP", "testpoint-2pad", "TP", [218, 172]);
  on("TXD0", "tpTx.1");
  on("GND", "tpTx.2");
  // rail sensing for the ESP32's ADC: +15 V / 11, -15 V offset against 3.3 V
  title(s, [258, 120], "Rail sensing", 1.5);
  R(s, "rP15a", "100k", [262, 128], "v");
  on("+15V", "rP15a.1");
  wire("P15_ADC", "rP15a.2", [262, 136]);
  R(s, "rP15b", "10k", [262, 136], "v");
  on("GND", "rP15b.2");
  wire("P15_ADC", [262, 136], [272, 136]);
  C(s, "cP15Adc", "100n", [272, 136]);
  on("GND", "cP15Adc.2");
  R(s, "rN15a", "150k", [286, 128], "v");
  on("-15V", "rN15a.1");
  wire("N15_ADC", "rN15a.2", [286, 136]);
  R(s, "rN15b", "22k", [286, 136], "v");
  on("+3V3", "rN15b.2");
  wire("N15_ADC", [286, 136], [296, 136]);
  C(s, "cN15Adc", "100n", [296, 136]);
  on("GND", "cN15Adc.2");
  // I²C header for a magnetometer
  title(s, [258, 70], "I2C header (magnetometer)", 1.5);
  place(s, "i2c", "J", "header-1x04-2.54", "1x04 2.54", [280, 84]);
  on("+3V3", "i2c.1");
  on("SDA", "i2c.2");
  on("SCL", "i2c.3");
  on("GND", "i2c.4");
}

// =================================================================================================================
// 3. Safety logic (3.3 V) and the coil trip thresholds
// =================================================================================================================
{
  const s = "safety";
  setPage(s);
  title(s, [14, 12], "Armed delay: ARM, delayed about 10 ms by RC; the diode empties the capacitor at once when ARM falls");
  R(s, "rArmRc", "100k", [28, 40]);
  on("ARM", "rArmRc.1");
  wire("ARM_RC", "rArmRc.2", [42, 40]);
  C(s, "cArmRc", "100n", [42, 44]);
  wire("ARM_RC", [42, 40], "cArmRc.1");
  on("GND", "cArmRc.2");
  place(s, "dArm", "D", "bat54s-sot23", "BAT54S", [42, 26]);
  on("ARM_RC", "dArm.1");
  on("ARM", "dArm.3");
  on("+3V3", "dArm.2");
  unit(s, "inv", 1, [70, 40]);
  wire("ARM_RC", [42, 40], "inv.1");
  unit(s, "inv", 2, [116, 40]);
  wire("ARMD_N", "inv.6", [94, 40]);
  wire("ARMD_N", [94, 40], "inv.3");
  on("ARM_D", "inv.4");
  unit(s, "inv", 3, [140, 26]);
  on("GND", "inv.2");
  on("+3V3", "inv.5");

  title(s, [14, 84], "Coil trip: 16 comparators pull TRIP_OC to -15 V; 10 kΩ and the clamp make it 3.3 V logic", 1.5);
  // the pull-up left of the series resistor, so the TRIP_OC label has a wire of its own
  R(s, "rTripPu", "10k", [50, 58], "v");
  on("+3V3", "rTripPu.1");
  wire("TRIP_OC", "rTripPu.2", [50, 66]);
  wire("TRIP_OC", [50, 66], [60, 66]);
  R(s, "rTripSer", "10k", [60, 66]);
  wire("TRIP_N", "rTripSer.2", [72, 66]);
  place(s, "dTrip", "D", "bat54s-sot23", "BAT54S", [72, 74], { mirror: "x" });
  wire("TRIP_N", [72, 66], "dTrip.3");
  on("GND", "dTrip.1");
  on("+3V3", "dTrip.2");
  wire("TRIP_N", [72, 66], [86, 66]);
  C(s, "cTrip", "100p C0G", [86, 68]);
  wire("TRIP_N", [86, 66], "cTrip.1");
  on("GND", "cTrip.2");
  place(s, "orTrip", "U", "74lvc1g32", "74LVC1G32", [110, 64]);
  wire("TRIP_N", [86, 66], "orTrip.2");
  wire("ARMD_N", [94, 40], [94, 62]);
  wire("ARMD_N", [94, 62], "orTrip.1");
  on("GND", "orTrip.3");
  on("+3V3", "orTrip.5");

  title(s, [130, 92], "Latches: a trip or STOP sets them; only the firmware clears them (CLR_N),", 1.5);
  title(s, [130, 96], "and only once the cause is gone", 1.5);
  unit(s, "ff", 1, [150, 74]);
  unit(s, "ff", 2, [150, 112]);
  unit(s, "ff", 3, [136, 140]);
  wire("TRIP_SET_N", "orTrip.4", [150, 64]);
  wire("TRIP_SET_N", [150, 64], "ff.4");
  on("GND", "ff.2", "ff.3", "ff.12", "ff.11", "ff.7");
  on("+3V3", "ff.14");
  on("CLR_N", "ff.1", "ff.13");
  on("TRIP_Q", "ff.5");
  on("STOP_Q", "ff.9");
  on("STOP_F", "ff.10");
  place(s, "and3", "U", "74lvc1g11", "74LVC1G11", [210, 84]);
  wire("TRIP_QN", "ff.6", [180, 76]);
  wire("TRIP_QN", [180, 76], [180, 80]);
  wire("TRIP_QN", [180, 80], "and3.6");
  on("ARM", "and3.1");
  wire("STOP_QN", "ff.8", [186, 114]);
  wire("STOP_QN", [186, 114], [186, 88]);
  wire("STOP_QN", [186, 88], "and3.3");
  on("GND", "and3.2");
  on("+3V3", "and3.5");
  on("ENABLE", "and3.4");
  title(s, [230, 70], "ENABLE = ARM and not TRIP and not STOP: switches the TPS65131", 1.5);
  unit(s, "and2", 1, [254, 104]);
  on("ENABLE", "and2.1");
  on("ARM_D", "and2.2");
  on("DAC_RST_N", "and2.7");
  title(s, [230, 94], "DAC reset: released 10 ms after the rails come up", 1.5);
  unit(s, "and2", 2, [254, 134]);
  on("TES_EN", "and2.5");
  wire("STOP_QN", [186, 114], [186, 136]);
  wire("STOP_QN", [186, 136], "and2.6");
  on("TES_ENG", "and2.3");
  title(s, [230, 124], "tES enable: TES_EN and not STOP (to the island)", 1.5);
  unit(s, "and2", 3, [290, 120]);
  on("GND", "and2.4");
  on("+3V3", "and2.8");
  // one 100 nF per logic package: 74HC74, 74LVC2G14, 74LVC1G32, 74LVC1G11, 74LVC2G08
  for (let i = 0; i < 5; i++) dec(s, [150 + i * 8, 154], "+3V3", "GND");

  title(s, [14, 136], "Coil trip thresholds: 4.096 V reference; ceiling switch open 0.684 V (5.5 mA),", 1.5);
  title(s, [14, 140], "closed 2.72 V (22 mA); inverted for the low side", 1.5);
  R(s, "rRef41", "4.7k", [30, 156], "v");
  on("+15V", "rRef41.1");
  wire("REF41", "rRef41.2", [30, 164]);
  place(s, "ref41", "D", "lm4040-4.1", "LM4040-4.1", [30, 170], { rot: 90 });
  wire("REF41", [30, 164], "ref41.1");
  on("GND", "ref41.2");
  nc("ref41", 3);
  wire("REF41", [30, 164], [18, 164]);
  C(s, "cRef41", "100n", [18, 164]);
  on("GND", "cRef41.2");
  wire("REF41", [30, 164], [33, 164]);
  wire("REF41", [33, 164], [36, 164]);
  RP(s, "rThTop", "49.9k", [36, 164]);
  wire("VTH_P", "rThTop.2", [48, 164]);
  RP(s, "rThBot", "10k", [48, 168], "v");
  wire("VTH_P", [48, 164], "rThBot.1");
  on("GND", "rThBot.2");
  wire("REF41", [33, 164], [33, 150]);
  place(s, "swCeil", "SW", "sw-dip-x01-smd", "2.54-1P TPGT", [39, 150]);
  wire("REF41", [33, 150], "swCeil.1");
  wire("CEIL_SW", "swCeil.2", [49, 150]);
  R(s, "rCeil", "5.6k", [49, 150]);
  wire("VTH_P", "rCeil.2", [58, 150]);
  wire("VTH_P", [58, 150], [58, 164]);
  wire("VTH_P", [48, 164], [56, 164]);
  C(s, "cVthP", "100n", [56, 168]);
  wire("VTH_P", [56, 164], "cVthP.1");
  on("GND", "cVthP.2");
  wire("VTH_P", [56, 164], [58, 164]);
  wire("VTH_P", [58, 164], [66, 164]);
  RP(s, "rInvIn", "10k", [66, 164]);
  place(s, "opaInv", "U", "opa197-soic8", "OPA197", [88, 166], { mirror: "x" });
  wire("VTHN_INV", "rInvIn.2", [78, 164]);
  wire("VTHN_INV", [78, 164], "opaInv.2");
  // feedback well above the amplifier: its -15 V pin points up (mirrored symbol) and needs room for its power symbol
  wire("VTHN_INV", [78, 164], [78, 148]);
  RP(s, "rInvFb", "10k", [80, 148]);
  wire("VTHN_INV", [78, 148], "rInvFb.1");
  wire("VTH_N", "rInvFb.2", [98, 148]);
  wire("VTH_N", [98, 148], [98, 166]);
  wire("VTH_N", "opaInv.6", [98, 166]);
  C(s, "cVthN", "100n", [98, 170]);
  wire("VTH_N", [98, 166], "cVthN.1");
  on("GND", "cVthN.2");
  on("GND", "opaInv.3");
  on("+15V", "opaInv.7");
  on("-15V", "opaInv.4");
  nc("opaInv", 1, 5, 8);
  dec(s, [112, 170], "+15V", "GND");
  dec(s, [120, 170], "GND", "-15V");
  vRes(s, "rCeilAdc", "10k", [66, 176], "VTH_P", "CEIL_ADC");
  place(s, "tpVth", "TP", "testpoint-2pad", "TP", [84, 192]);
  on("VTH_P", "tpVth.1");
  on("GND", "tpVth.2");
}

// =================================================================================================================
// 4. DAC81408 (the eight coil setpoints, ±2.5 V range) and the two monitor ADCs (ADS8688, daisy chain). Rev B: one
//    DAC instead of two DAC8565 and the stage-1 op-amps; ADCs that read X and OUT directly (no divider networks)
// =================================================================================================================
{
  const s = "converters";
  setPage(s);
  title(s, [14, 12], "+5VA for the DAC and the ADCs (ferrite and 10 µF)");
  BEAD(s, "fb5va", [20, 24]);
  on("+5V", "fb5va.1");
  on("+5VA", "fb5va.2");
  C1206(s, "c5va", [34, 24]);
  on("+5VA", "c5va.1");
  on("GND", "c5va.2");

  title(s, [14, 44], "DAC81408: DAC1-DAC8 (OUT0-OUT7) on the ±2.5 V range, straight into each channel's setpoint filter", 1.5);
  title(s, [14, 48], "RESET from DAC_RST_N: while not armed or before the rails are up, every output is tied to ground (0 mA)", 1.5);
  place(s, "dac", "U", "dac81408-vqfn40", "DAC81408", [70, 110]);
  [5, 6, 7, 8, 23, 24, 25, 26].forEach((p, i) => on(`DAC${i + 1}`, `dac.${p}`));
  on("+15V", "dac.31", "dac.40");
  on("-15V", "dac.32", "dac.39");
  on("+5VA", "dac.37", "dac.38");
  on("+3V3", "dac.9", "dac.20"); // VIO; CLR not used (to VIO, data sheet)
  on("GND", "dac.10", "dac.36", "dac.35", "dac.41", "dac.15", "dac.16", "dac.17"); // grounds, pad, TOGGLE0-2
  on("CS_DAC", "dac.14");
  on("SCLK", "dac.12");
  on("MOSI", "dac.13");
  on("LDAC", "dac.18");
  on("DAC_RST_N", "dac.19");
  // SDO to MISO through 33 Ω, so the firmware can read the configuration back after every arm. The DAC's SDO and the
  // ADCs' SDO are high-impedance while their CS is high (DAC81408 9.5.1, ADS8688 8.4.1.1.4), so they share MISO; the
  // resistor also keeps two outputs off one net for the ERC. NC pins, ALMOUT, TEMPOUT unused.
  const pSdo = pin("dac.11");
  R(s, "rDacSdo", "33R", [pSdo[0] - 16, pSdo[1]]);
  wire("DAC_SDO", "rDacSdo.2", "dac.11");
  on("MISO", "rDacSdo.1");
  nc("dac", 1, 2, 3, 4, 27, 28, 29, 30, 21, 22);
  // reference: at least 150 nF to ground (220 nF); 330 pF from REFCMP to REFGND (data sheet p. 4)
  const pRef = pin("dac.33");
  const pCmp = pin("dac.34");
  wire("VREF", "dac.33", [pRef[0] - 10, pRef[1]]);
  C(s, "cDacRef", "220n", [pRef[0] - 10, pRef[1]]);
  on("GND", "cDacRef.2");
  wire("REFCMP", "dac.34", [pCmp[0] - 4, pCmp[1]]);
  C(s, "cDacCmp", "330p C0G", [pCmp[0] - 4, pCmp[1]]);
  on("GND", "cDacCmp.2");
  place(s, "tpVref", "TP", "testpoint-2pad", "TP", [20, 170]);
  on("VREF", "tpVref.1");
  on("GND", "tpVref.2");
  // 100 nF at every supply pin
  dec(s, [104, 60], "+15V", "GND");
  dec(s, [112, 60], "+15V", "GND");
  dec(s, [120, 60], "GND", "-15V");
  dec(s, [128, 60], "GND", "-15V");
  dec(s, [136, 60], "+5VA", "GND");
  dec(s, [144, 60], "+5VA", "GND");
  dec(s, [152, 60], "+3V3", "GND");

  // ADS8688: AIN_kP/AIN_kGND pins for k = 0..7 (data sheet pp. 4-5)
  const AIN: [number, number][] = [[16, 17], [18, 19], [21, 20], [23, 22], [25, 24], [27, 26], [12, 13], [14, 15]];
  const adc = (key: string, at: P, net: (k: number) => string, sdo: string, daisy: string, t1: string, t2: string) => {
    title(s, [at[0] - 70, at[1] - 50], t1, 1.5);
    title(s, [at[0] - 70, at[1] - 46], t2, 1.5);
    place(s, key, "U", "ads8688-tssop38", "ADS8688", at);
    AIN.forEach(([p, g], k) => {
      on(net(k + 1), `${key}.${p}`);
      on("GND", `${key}.${g}`);
    });
    on("MOSI", `${key}.1`);
    on("SCLK", `${key}.37`);
    on("CS_ADC", `${key}.38`);
    on(sdo, `${key}.36`);
    on(daisy, `${key}.3`);
    on("+3V3", `${key}.2`, `${key}.34`); // RST/PD high (running); DVDD
    on("+5VA", `${key}.9`, `${key}.30`);
    // REFSEL low (internal 4.096 V reference), grounds (28, 29, 31, 32 stacked on 8), AUX unused
    on("GND", `${key}.4`, `${key}.6`, `${key}.8`, `${key}.28`, `${key}.29`, `${key}.31`, `${key}.32`, `${key}.33`, `${key}.10`, `${key}.11`);
    nc(key, 35);
    // REFIO 10 µF; REFCAP 1 µF and 22 µF; AVDD 10 µF and 1 µF; DVDD 10 µF (data sheet, layout guidelines)
    // REFIO and REFCAP are on the symbol's right side: their capacitors sit beside it, joined by labels
    on(`${key.toUpperCase()}_REFIO`, `${key}.5`);
    vPart(s, `c${key}Io`, "C", "cap-1210", "10u 25V", [at[0] + 34, at[1] + 4]);
    on(`${key.toUpperCase()}_REFIO`, `c${key}Io.1`);
    on("GND", `c${key}Io.2`);
    on(`${key.toUpperCase()}_REFCAP`, `${key}.7`);
    C(s, `c${key}Cap1`, "1u 25V", [at[0] + 42, at[1] + 4]);
    on(`${key.toUpperCase()}_REFCAP`, `c${key}Cap1.1`);
    on("GND", `c${key}Cap1.2`);
    vPart(s, `c${key}Cap22`, "C", "cap-1210", "22u 25V", [at[0] + 50, at[1] + 4]);
    on(`${key.toUpperCase()}_REFCAP`, `c${key}Cap22.1`);
    on("GND", `c${key}Cap22.2`);
    dec(s, [at[0] + 20, at[1] - 40], "+5VA", "GND", "1u 25V");
    vPart(s, `c${key}Av`, "C", "cap-1210", "10u 25V", [at[0] + 28, at[1] - 40]);
    on("+5VA", `c${key}Av.1`);
    on("GND", `c${key}Av.2`);
    vPart(s, `c${key}Dv`, "C", "cap-1210", "10u 25V", [at[0] + 36, at[1] - 40]);
    on("+3V3", `c${key}Dv.1`);
    on("GND", `c${key}Dv.2`);
  };
  adc("adcX", [230, 84], (k) => `X${k}`, "MISO", "ADC_DAISY",
    "ADS8688 #1 (first on MISO): the coil currents, X1-X8 (I = X / 124 Ω)",
    "Both on ±10.24 V (shared SDI: the same settings for both); ±20 V protected inputs, 1 MΩ");
  adc("adcO", [230, 176], (k) => `OUT${k}`, "ADC_DAISY", "GND",
    "ADS8688 #2: the drive voltages OUT1-OUT8; its SDO runs into #1's DAISY input",
    "Above 10.24 V it reads full scale: an output at the rail still shows");
}

// =================================================================================================================
// 6-7. Coil channels: the DAC81408's setpoint, setpoint filter, half an OPA2197 with the coil in its feedback loop,
//      RF / CF+RD compensation, snubber, clamps, sense resistor, window comparators (spec.md "Coil channel")
// =================================================================================================================
// Pins of the comparators' units (KiCad LM339): [+, -, out]
const CMP_U: Record<number, [number, number, number]> = { 1: [5, 4, 2], 2: [7, 6, 1], 3: [11, 10, 13], 4: [9, 8, 14] };

function coilChannel(s: string, k: number, ox: number, oy: number) {
  setPage(s);
  const a = rel(ox, oy);
  title(s, a(12, 4), `Coil channel ${k}: ${Math.round(20.16 * 100) / 100} mA at full scale (2.5 V on 124 Ω)`, 1.8);
  // setpoint: the DAC81408's output on its ±2.5 V range, through the filter 10 kΩ / 4.7 nF
  R(s, `rT${k}`, "10k", a(50, 20));
  on(`DAC${k}`, `rT${k}.1`);
  wire(`SP${k}`, `rT${k}.2`, a(60, 20));
  C(s, `cT${k}`, "4.7n C0G", a(60, 24));
  wire(`SP${k}`, a(60, 20), `cT${k}.1`);
  on("GND", `cT${k}.2`);
  // the driver: one half of an OPA2197 (channels 1-2, 3-4, 5-6, 7-8 share a package), coil between OUT and X
  const dk = `drv${k % 2 === 1 ? `${k}${k + 1}` : `${k - 1}${k}`}`;
  const [ip, im, io] = k % 2 === 1 ? [3, 2, 1] : [5, 6, 7];
  unit(s, dk, k % 2 === 1 ? 1 : 2, a(72, 22));
  wire(`SP${k}`, a(60, 20), `${dk}.${ip}`);
  // compensation: RD 47 kΩ + CF 2.2 nF from OUT, RF 10 kΩ from X, both to -IN
  wire(`INN${k}`, `${dk}.${im}`, a(63, 24));
  wire(`INN${k}`, a(63, 24), a(63, 38));
  R(s, `rD${k}`, "47k", a(66, 38));
  wire(`INN${k}`, a(63, 38), `rD${k}.1`);
  C(s, `cF${k}`, "2.2n C0G", a(74, 38), "h");
  wire(`CD${k}`, `rD${k}.2`, `cF${k}.1`);
  wire(`INN${k}`, a(63, 38), a(63, 46));
  R(s, `rF${k}`, "10k", a(66, 46));
  wire(`INN${k}`, a(63, 46), `rF${k}.1`);
  // OUT: snubber, clamps to the rails, TVS; to the coil (connector page) and the monitor
  wire(`OUT${k}`, `${dk}.${io}`, a(84, 22));
  wire(`OUT${k}`, `cF${k}.2`, a(84, 38));
  wire(`OUT${k}`, a(84, 38), a(84, 22));
  wire(`OUT${k}`, a(84, 22), a(88, 22));
  R(s, `rSn${k}`, "10R", a(88, 26), "v");
  wire(`OUT${k}`, a(88, 22), `rSn${k}.1`);
  C(s, `cSn${k}`, "47n", a(88, 36));
  wire(`SN${k}`, `rSn${k}.2`, `cSn${k}.1`);
  on("GND", `cSn${k}.2`);
  wire(`OUT${k}`, a(88, 22), a(96, 22));
  place(s, `clamp${k}`, "D", "bas40-04-sot23", "BAS40-04", a(96, 16));
  wire(`OUT${k}`, a(96, 22), `clamp${k}.3`);
  on("-15V", `clamp${k}.1`);
  on("+15V", `clamp${k}.2`);
  place(s, `tvsO${k}`, "D", "tvs-coil", "SMF15CA", a(106, 25), { rot: 90 });
  wire(`OUT${k}`, a(96, 22), `tvsO${k}.2`);
  on("GND", `tvsO${k}.1`);
  // X: sense resistor 124 Ω 0.1 % to GND, RF back to -IN, TVS, the two trip comparators
  wire(`X${k}`, `rF${k}.2`, a(92, 46));
  RP(s, `rS${k}`, "124R", a(92, 50), "v");
  wire(`X${k}`, a(92, 46), `rS${k}.1`);
  on("GND", `rS${k}.2`);
  place(s, `tvsX${k}`, "D", "tvs-coil", "SMF15CA", a(100, 49), { rot: 90 });
  wire(`X${k}`, a(92, 46), `tvsX${k}.2`);
  on("GND", `tvsX${k}.1`);
  wire(`X${k}`, a(100, 46), a(112, 46));
  const cq = ["cmp1", "cmp2", "cmp3", "cmp4"][Math.floor((k - 1) / 2)]!;
  const [uh, ul] = k % 2 === 1 ? [1, 2] : [3, 4];
  unit(s, cq, uh, a(124, 40));
  unit(s, cq, ul, a(124, 52));
  const H = CMP_U[uh]!;
  const L = CMP_U[ul]!;
  on("VTH_P", `${cq}.${H[0]}`);
  wire(`X${k}`, a(112, 46), a(112, 42));
  wire(`X${k}`, a(112, 42), `${cq}.${H[1]}`);
  wire(`X${k}`, a(112, 46), a(112, 50));
  wire(`X${k}`, a(112, 50), `${cq}.${L[0]}`);
  on("VTH_N", `${cq}.${L[1]}`);
  wire("TRIP_OC", `${cq}.${H[2]}`, a(134, 40));
  wire("TRIP_OC", a(134, 40), a(134, 52));
  wire("TRIP_OC", a(134, 52), `${cq}.${L[2]}`);
}
for (const k of [1, 2, 3, 4]) coilChannel("coil-a", k, 4 + ((k - 1) % 2) * 158, 10 + Math.floor((k - 1) / 2) * 80);
for (const k of [5, 6, 7, 8]) coilChannel("coil-b", k, 4 + ((k - 5) % 2) * 158, 10 + Math.floor((k - 5) / 2) * 80);

// =================================================================================================================
// 8. Coil connector and the supplies of the quads
// =================================================================================================================
{
  const s = "coil-supply";
  setPage(s);
  title(s, [14, 12], "Coil connector: Molex Micro-Fit 3.0, 2 x 8, latching. Coil k: pin k = OUTk (signal), pin k + 8 = Xk (return), side by side");
  place(s, "jCoil", "J", "microfit-2x08-ra", "43045-1600", [60, 50]);
  for (let k = 1; k <= 8; k++) {
    on(`OUT${k}`, `jCoil.${k}`);
    on(`X${k}`, `jCoil.${k + 8}`);
  }
  title(s, [14, 90], "Supplies of the coil drivers (OPA2197) and the trip comparators (LM339B), 100 nF per rail and chip");
  const quads: [string, number, number, number][] = [
    ["drv12", 8, 4, 3], ["drv34", 8, 4, 3], ["drv56", 8, 4, 3], ["drv78", 8, 4, 3],
    ["cmp1", 3, 12, 5], ["cmp2", 3, 12, 5], ["cmp3", 3, 12, 5], ["cmp4", 3, 12, 5],
  ];
  quads.forEach(([q, vp, vn, pu], i) => {
    const x = 24 + i * 36;
    unit(s, q, pu, [x, 116]);
    on("+15V", `${q}.${vp}`);
    on("-15V", `${q}.${vn}`);
    dec(s, [x + 8, 108], "+15V", "GND");
    dec(s, [x + 15, 108], "GND", "-15V");
  });
  title(s, [14, 140], "Mounting holes (M3)");
  for (const n of [1, 2, 3, 4]) place(s, `hole${n}`, "H", "mounting-hole-m3", "M3", [24 + n * 14, 152], { ref: `H${n}` });
}

// =================================================================================================================
// 9. tES island: isolated power, isolators, DAC80504, ADS8688 (spec.md "tES island"). Island ground: GND1
// =================================================================================================================
{
  const s = "island";
  setPage(s);
  title(s, [14, 12], "Isolated supply: A0515S-2WR3 (5 V to +/-15 V, 1.5 kV), island 5 V from L78L05. Everything right of the isolators is on GND1");
  place(s, "dcIso", "U", "a0515s-2wr3", "A0515S-2WR3", [50, 40]);
  on("+5V", "dcIso.1");
  on("GND", "dcIso.2");
  wire("ISO_P15", "dcIso.6", [76, 36]);
  wire("ISO_N15", "dcIso.4", [64, 44]);
  wire("ISO_N15", [64, 44], [64, 54]);
  wire("ISO_N15", [64, 54], [84, 54]);
  on("GND1", "dcIso.5");
  C1206(s, "cIsoIn", [18, 40]);
  on("+5V", "cIsoIn.1");
  on("GND", "cIsoIn.2");
  C1210(s, "cIsoP", [76, 36]);
  on("GND1", "cIsoP.2");
  wire("ISO_P15", [76, 36], [100, 36]);
  C1210(s, "cIsoN", [84, 54]);
  on("GND1", "cIsoN.2");
  place(s, "ldoIso", "U", "ldo-5v-sot89", "L78L05AB", [118, 36]);
  wire("ISO_P15", [100, 36], "ldoIso.3");
  C(s, "cLdoIsoIn", "1u 25V", [100, 36]);
  on("GND1", "cLdoIsoIn.2", "ldoIso.2");
  wire("ISO_5V", "ldoIso.1", [134, 36]);
  C(s, "cLdoIsoOut", "1u 25V", [134, 36]);
  on("GND1", "cLdoIsoOut.2");
  for (const [k, n, x] of [["tpIp15", "ISO_P15", 170], ["tpIn15", "ISO_N15", 200], ["tpI5", "ISO_5V", 230], ["tpIref", "I_REF", 260]] as const) {
    place(s, k, "TP", "testpoint-2pad", "TP", [x, 36]);
    on(n, `${k}.1`);
    on("GND1", `${k}.2`);
  }
  title(s, [14, 70], "Isolators ISO6741F (outputs low when the other side is unpowered):", 1.5);
  title(s, [14, 74], "SPI, enable, heartbeat to the island; MISO and FAULT back", 1.5);
  const iso = (key: string, at: P, main: Record<number, string>, island: Record<number, string>) => {
    place(s, key, "U", "iso6741f-soic16w", "ISO6741F", at);
    for (const [p, n] of Object.entries({ ...main, ...island })) on(n, `${key}.${p}`);
    on("+3V3", `${key}.1`, `${key}.7`);
    on("GND", `${key}.2`, `${key}.8`);
    on("ISO_5V", `${key}.16`, `${key}.10`);
    on("GND1", `${key}.9`, `${key}.15`);
    dec(s, [at[0] - 20, at[1] - 10], "+3V3", "GND");
    dec(s, [at[0] + 20, at[1] - 10], "ISO_5V", "GND1");
  };
  iso("iso1", [50, 110], { 3: "T_SCK", 4: "T_MOSI", 5: "T_CSD", 6: "T_MISO" }, { 14: "I_SCK", 13: "I_MOSI", 12: "I_CSD", 11: "I_MISO" });
  iso("iso2", [50, 166], { 3: "T_CSA", 4: "TES_ENG", 5: "T_HB", 6: "T_FAULT" }, { 14: "I_CSA", 13: "I_EN", 12: "I_HB", 11: "I_FAULT" });
  title(s, [140, 70], "DAC80504: two outputs per channel used as a difference (a - b),", 1.5);
  title(s, [140, 74], "so 0 V on all and mid-scale on all both mean 0 mA", 1.5);
  place(s, "dacT", "U", "dac80504-wqfn16", "DAC80504", [170, 110]);
  for (const [p, n] of Object.entries({ 2: "T_A1", 3: "T_B1", 4: "T_A2", 5: "T_B2", 12: "I_CSD", 13: "I_SCK", 14: "I_MOSI" })) on(n, `dacT.${p}`);
  on("GND1", "dacT.6", "dacT.8", "dacT.10", "dacT.17");
  on("ISO_5V", "dacT.7", "dacT.9", "dacT.11", "dacT.16");
  nc("dacT", 15);
  wire("I_REF", "dacT.1", [186, 120]);
  wire("I_REF", [186, 120], [186, 124]);
  C(s, "cIref", "1u 25V", [186, 124]);
  on("GND1", "cIref.2");
  dec(s, [196, 88], "ISO_5V", "GND1");
  title(s, [96, 219], "ADS8688: current (VS) and setpoint (TSP) of both channels on ±2.56 V, the electrodes on ±10.24 V;", 1.5);
  title(s, [96, 223], "read directly (1 MΩ inputs, ±20 V protected): rev A's MCP3208 needed divider networks", 1.5);
  place(s, "adcT", "U", "ads8688-tssop38", "ADS8688", [150, 175]);
  // AIN_kP/AIN_kGND for k = 0..7 (data sheet pp. 4-5): VS1, VS2, EA1, EB1, EA2, EB2, TSP1, TSP2
  const aIn: [number, number, string][] = [[16, 17, "VS1"], [18, 19, "VS2"], [21, 20, "EA1"], [23, 22, "EB1"], [25, 24, "EA2"], [27, 26, "EB2"], [12, 13, "TSP1"], [14, 15, "TSP2"]];
  for (const [p, g, n] of aIn) {
    on(n, `adcT.${p}`);
    on("GND1", `adcT.${g}`);
  }
  on("I_MOSI", "adcT.1");
  on("I_SCK", "adcT.37");
  on("I_CSA", "adcT.38");
  on("I_MISO", "adcT.36");
  on("ISO_5V", "adcT.2", "adcT.34", "adcT.9", "adcT.30"); // RST/PD high; DVDD and AVDD from the island's 5 V
  on("GND1", "adcT.3", "adcT.4", "adcT.6", "adcT.8", "adcT.28", "adcT.29", "adcT.31", "adcT.32", "adcT.33", "adcT.10", "adcT.11");
  nc("adcT", 35);
  on("ADCT_REFIO", "adcT.5");
  vPart(s, "cAdcTIo", "C", "cap-1210", "10u 25V", [184, 180]);
  on("ADCT_REFIO", "cAdcTIo.1");
  on("GND1", "cAdcTIo.2");
  on("ADCT_REFCAP", "adcT.7");
  C(s, "cAdcTCap1", "1u 25V", [192, 180]);
  on("ADCT_REFCAP", "cAdcTCap1.1");
  on("GND1", "cAdcTCap1.2");
  vPart(s, "cAdcTCap22", "C", "cap-1210", "22u 25V", [200, 180]);
  on("ADCT_REFCAP", "cAdcTCap22.1");
  on("GND1", "cAdcTCap22.2");
  dec(s, [170, 140], "ISO_5V", "GND1", "1u 25V");
  vPart(s, "cAdcTAv", "C", "cap-1210", "10u 25V", [178, 140]);
  on("ISO_5V", "cAdcTAv.1");
  on("GND1", "cAdcTAv.2");
}

// =================================================================================================================
// 10. tES island safety: thresholds (+/-2.55 V = 4.64 mA on 549 Ω), latch, heartbeat, relay drive
// =================================================================================================================
{
  const s = "island-safety";
  setPage(s);
  title(s, [14, 12], "Trip thresholds +/-2.55 V (4.64 mA on 549 Ω, above the DAC's 4.55 mA):", 1.5);
  title(s, [14, 16], "two LM4040, one upside down from -15 V", 1.5);
  R(s, "rIrefP", "4.7k", [30, 24], "v");
  on("ISO_P15", "rIrefP.1");
  wire("IREF_P", "rIrefP.2", [30, 34]);
  place(s, "irefP", "D", "lm4040-4.1", "LM4040-4.1", [30, 40], { rot: 90 });
  wire("IREF_P", [30, 34], "irefP.1");
  on("GND1", "irefP.2");
  nc("irefP", 3);
  wire("IREF_P", [30, 34], [36, 34]);
  R(s, "rIthP1", "10k", [36, 34]);
  wire("ITH_P", "rIthP1.2", [48, 34]);
  R(s, "rIthP2", "16.5k", [48, 38], "v");
  wire("ITH_P", [48, 34], "rIthP2.1");
  on("GND1", "rIthP2.2");
  wire("ITH_P", [48, 34], [56, 34]);
  C(s, "cIthP", "100n", [56, 38]);
  wire("ITH_P", [56, 34], "cIthP.1");
  on("GND1", "cIthP.2");
  place(s, "irefN", "D", "lm4040-4.1", "LM4040-4.1", [90, 32], { rot: 90 });
  on("GND1", "irefN.1");
  wire("IREF_N", "irefN.2", [90, 40]);
  R(s, "rIrefN", "4.7k", [90, 44], "v");
  wire("IREF_N", [90, 40], "rIrefN.1");
  on("ISO_N15", "rIrefN.2");
  nc("irefN", 3);
  wire("IREF_N", [90, 40], [96, 40]);
  R(s, "rIthN1", "10k", [96, 40]);
  wire("ITH_N", "rIthN1.2", [108, 40]);
  R(s, "rIthN2", "16.5k", [108, 44], "v");
  wire("ITH_N", [108, 40], "rIthN2.1");
  on("GND1", "rIthN2.2");
  wire("ITH_N", [108, 40], [116, 40]);
  C(s, "cIthN", "100n", [116, 44]);
  wire("ITH_N", [116, 40], "cIthN.1");
  on("GND1", "cIthN.2");
  title(s, [150, 20], "Island comparator supply", 1.5);
  unit(s, "cmpI", 5, [170, 36]);
  on("ISO_P15", "cmpI.3");
  on("ISO_N15", "cmpI.12");
  dec(s, [180, 28], "ISO_P15", "GND1");
  dec(s, [188, 28], "GND1", "ISO_N15");

  title(s, [14, 70], "Latch: a trip sets it, TES_EN low resets it (the firmware clears it by toggling TES_EN)");
  R(s, "rItripPu", "10k", [30, 80], "v");
  on("ISO_5V", "rItripPu.1");
  wire("I_TRIP_OC", "rItripPu.2", [30, 88]);
  R(s, "rItripSer", "10k", [30, 88]);
  wire("I_TRIP_N", "rItripSer.2", [44, 88]);
  place(s, "dItrip", "D", "bat54s-sot23", "BAT54S", [44, 96], { mirror: "x" });
  wire("I_TRIP_N", [44, 88], "dItrip.3");
  on("GND1", "dItrip.1");
  on("ISO_5V", "dItrip.2");
  wire("I_TRIP_N", [44, 88], [60, 88]);
  C(s, "cItrip", "100p C0G", [60, 90]);
  wire("I_TRIP_N", [60, 88], "cItrip.1");
  on("GND1", "cItrip.2");
  unit(s, "ffI", 1, [88, 100]);
  wire("I_TRIP_N", [60, 88], [88, 88]);
  wire("I_TRIP_N", [88, 88], "ffI.4");
  on("I_EN", "ffI.1");
  on("GND1", "ffI.2", "ffI.3");
  on("I_FAULT", "ffI.5");
  unit(s, "ffI", 2, [88, 136]);
  on("ISO_5V", "ffI.10", "ffI.13");
  on("GND1", "ffI.12", "ffI.11");
  nc("ffI", 8, 9);
  unit(s, "ffI", 3, [112, 140]);
  on("GND1", "ffI.7");
  on("ISO_5V", "ffI.14");
  dec(s, [120, 136], "ISO_5V", "GND1");

  title(s, [140, 70], "Heartbeat: the firmware's square wave, AC-coupled into a diode pump; a stuck line, high or low, lets HB_OK fall");
  C(s, "cHb", "100n", [146, 88], "h");
  on("I_HB", "cHb.1");
  place(s, "dHb", "D", "bat54s-sot23", "BAT54S", [166, 80]);
  wire("HBP", "cHb.2", [166, 88]);
  wire("HBP", [166, 88], "dHb.3");
  on("GND1", "dHb.1");
  wire("HB_RAW", "dHb.2", [180, 80]);
  wire("HB_RAW", [180, 80], [180, 84]);
  C(s, "cHbStore", "1u 25V", [180, 84]);
  on("GND1", "cHbStore.2");
  wire("HB_RAW", [180, 80], [188, 80]);
  R(s, "rHbBleed", "100k", [188, 84], "v");
  wire("HB_RAW", [188, 80], "rHbBleed.1");
  on("GND1", "rHbBleed.2");
  place(s, "hbBuf", "U", "74lvc1g17", "74LVC1G17", [210, 80]);
  wire("HB_RAW", [188, 80], "hbBuf.2");
  on("HB_OK", "hbBuf.4");
  on("GND1", "hbBuf.3");
  on("ISO_5V", "hbBuf.5");
  nc("hbBuf", 1);
  dec(s, [226, 92], "ISO_5V", "GND1");

  title(s, [140, 120], "Relay drive: I_EN and HB_OK and not latched; the four relay LEDs in series from +15 V (one LED open: all relays open)");
  place(s, "andRly", "U", "74lvc1g11", "74LVC1G11", [170, 150]);
  on("I_EN", "andRly.1");
  on("HB_OK", "andRly.3");
  on("I_OKQ", "andRly.6");
  on("GND1", "andRly.2");
  on("ISO_5V", "andRly.5");
  on("I_OKQ", "ffI.6");
  wire("RELAY_ON", "andRly.4", [190, 150]);
  R(s, "rRlyPd", "100k", [190, 154], "v");
  wire("RELAY_ON", [190, 150], "rRlyPd.1");
  on("GND1", "rRlyPd.2");
  wire("RELAY_ON", [190, 150], [194, 150]);
  R(s, "rRlyB", "4.7k", [194, 150]);
  place(s, "qRly", "Q", "mmbt3904-sot23", "MMBT3904", [210, 150]);
  wire("QB", "rRlyB.2", "qRly.1");
  on("GND1", "qRly.2");
  on("RLED_K", "qRly.3");
  R(s, "rRlyLed", "2.2k", [212, 128], "v");
  on("ISO_P15", "rRlyLed.1");
  on("RLED_1", "rRlyLed.2");
  dec(s, [160, 168], "ISO_5V", "GND1");
}

// =================================================================================================================
// 11-12. tES channels: difference stage, integrator with anti-windup Zeners, E+ follower, E- inverter, relays,
//        549 Ω sense with an INA821, window comparator, electrode connector, monitor networks
// =================================================================================================================
const LED_CHAIN = ["RLED_1", "RLED_2", "RLED_3", "RLED_4", "RLED_K"];
function tesChannel(k: number) {
  const s = `tes-${k}`;
  setPage(s);
  const q = `opaT${k}`;
  title(s, [14, 12], `tES channel ${k}: I = (a - b) / 549 Ω, at most 4.55 mA; the electrodes are driven in opposite directions`, 2);
  // U1: difference stage TSP = b - a
  unit(s, q, 1, [60, 40]);
  R(s, `rTd1_${k}`, "10k", [36, 38]);
  on(`T_B${k}`, `rTd1_${k}.1`);
  wire(`TP1_${k}`, `rTd1_${k}.2`, [48, 38]);
  wire(`TP1_${k}`, [48, 38], `${q}.3`);
  RP(s, `rTd2_${k}`, "10k", [48, 40], "v");
  wire(`TP1_${k}`, [48, 38], `rTd2_${k}.1`);
  on("GND1", `rTd2_${k}.2`);
  RP(s, `rTd3_${k}`, "10k", [36, 50]);
  on(`T_A${k}`, `rTd3_${k}.1`);
  wire(`TN1_${k}`, `${q}.2`, [52, 42]);
  wire(`TN1_${k}`, [52, 42], [52, 50]);
  wire(`TN1_${k}`, `rTd3_${k}.2`, [52, 50]);
  wire(`TN1_${k}`, [52, 50], [56, 50]);
  RP(s, `rTd4_${k}`, "10k", [56, 50]);
  wire(`TSP${k}`, `${q}.1`, [70, 40]);
  wire(`TSP${k}`, `rTd4_${k}.2`, [70, 50]);
  wire(`TSP${k}`, [70, 50], [70, 40]);
  wire(`TSP${k}`, [70, 40], [74, 40]);
  wire(`TSP${k}`, [74, 40], [74, 44]);
  // U2: integrator, 10 kΩ + 10 kΩ, 330 pF, 11 V Zeners back to back
  RP(s, `rTi1_${k}`, "10k", [76, 44]);
  wire(`TSP${k}`, [74, 44], `rTi1_${k}.1`);
  RP(s, `rTi2_${k}`, "10k", [76, 52]);
  on(`VS${k}`, `rTi2_${k}.1`);
  unit(s, q, 2, [100, 42]);
  on("GND1", `${q}.5`);
  wire(`TN2_${k}`, `rTi1_${k}.2`, [88, 44]);
  wire(`TN2_${k}`, [88, 44], `${q}.6`);
  wire(`TN2_${k}`, `rTi2_${k}.2`, [88, 52]);
  wire(`TN2_${k}`, [88, 52], [88, 44]);
  wire(`TN2_${k}`, [88, 44], [88, 32]);
  C(s, `cTi${k}`, "330p C0G", [91, 32], "h");
  wire(`TN2_${k}`, [88, 32], `cTi${k}.1`);
  wire(`TN2_${k}`, [88, 32], [88, 26]);
  place(s, `dzA${k}`, "D", "zener-sod123", "11V", [94, 26], { rot: 180 });
  wire(`TN2_${k}`, [88, 26], `dzA${k}.2`);
  place(s, `dzB${k}`, "D", "zener-sod123", "11V", [102, 26]);
  wire(`TZ${k}`, `dzA${k}.1`, `dzB${k}.1`);
  wire(`DRV${k}`, `dzB${k}.2`, [110, 26]);
  wire(`DRV${k}`, [110, 26], [110, 32]);
  wire(`DRV${k}`, `cTi${k}.2`, [110, 32]);
  wire(`DRV${k}`, [110, 32], [110, 34]);
  wire(`DRV${k}`, [110, 34], [110, 42]);
  wire(`DRV${k}`, `${q}.7`, [110, 42]);
  // U3: E+ follower
  unit(s, q, 3, [130, 36]);
  wire(`DRV${k}`, [110, 34], `${q}.10`);
  wire(`EA${k}`, `${q}.8`, [140, 36]);
  wire(`EA${k}`, [140, 36], [140, 40]);
  wire(`EA${k}`, [140, 40], [122, 40]);
  wire(`EA${k}`, [122, 40], [122, 38]);
  wire(`EA${k}`, [122, 38], `${q}.9`);
  // U4: E- inverter
  unit(s, q, 4, [130, 56]);
  on("GND1", `${q}.12`);
  wire(`DRV${k}`, [110, 42], [110, 58]);
  R(s, `rTinv1_${k}`, "10k", [112, 58]);
  wire(`DRV${k}`, [110, 58], `rTinv1_${k}.1`);
  wire(`TN4_${k}`, `rTinv1_${k}.2`, [120, 58]);
  wire(`TN4_${k}`, [120, 58], `${q}.13`);
  wire(`TN4_${k}`, [120, 58], [120, 64]);
  wire(`TN4_${k}`, [120, 64], [124, 64]);
  R(s, `rTinv2_${k}`, "10k", [124, 64]);
  wire(`EB${k}`, `rTinv2_${k}.2`, [140, 64]);
  wire(`EB${k}`, `${q}.14`, [140, 56]);
  wire(`EB${k}`, [140, 56], [140, 64]);
  // relays (CPC1017N, normally open) in both lines; sense 549 Ω in the E- line
  place(s, `kA${k}`, "K", "cpc1017n-sop4", "CPC1017N", [156, 38], { mirror: "y" });
  wire(`EA${k}`, [140, 36], `kA${k}.4`);
  on(`EP${k}`, `kA${k}.3`);
  on(LED_CHAIN[(k - 1) * 2]!, `kA${k}.1`);
  on(LED_CHAIN[(k - 1) * 2 + 1]!, `kA${k}.2`);
  RP(s, `rSense${k}`, "549R", [140, 70]);
  wire(`EB${k}`, [140, 64], [140, 70]);
  wire(`EB${k}`, [140, 70], `rSense${k}.1`);
  place(s, `kB${k}`, "K", "cpc1017n-sop4", "CPC1017N", [162, 72], { mirror: "y" });
  wire(`SX${k}`, `rSense${k}.2`, [150, 70]);
  wire(`SX${k}`, [150, 70], `kB${k}.4`);
  on(`EN${k}`, `kB${k}.3`);
  on(LED_CHAIN[(k - 1) * 2 + 1]!, `kB${k}.1`);
  on(LED_CHAIN[(k - 1) * 2 + 2]!, `kB${k}.2`);
  // INA821 across the sense resistor (gain 1: RG open)
  place(s, `ina${k}`, "U", "ina821-soic8", "INA821", [160, 100], { mirror: "x" });
  wire(`EB${k}`, [140, 70], [140, 104]);
  wire(`EB${k}`, [140, 104], `ina${k}.1`);
  wire(`SX${k}`, [150, 70], [150, 96]);
  wire(`SX${k}`, [150, 96], `ina${k}.4`);
  on("ISO_N15", `ina${k}.5`);
  on("ISO_P15", `ina${k}.8`);
  on("GND1", `ina${k}.6`);
  nc(`ina${k}`, 2, 3);
  wire(`VS${k}`, `ina${k}.7`, [178, 100]);
  // window comparator: trips the island latch at +/-4.64 mA
  const [uh, ul] = k === 1 ? [1, 2] : [3, 4];
  unit(s, "cmpI", uh, [196, 94]);
  unit(s, "cmpI", ul, [196, 106]);
  const H = CMP_U[uh]!;
  const L = CMP_U[ul]!;
  on("ITH_P", `cmpI.${H[0]}`);
  wire(`VS${k}`, [178, 100], [178, 96]);
  wire(`VS${k}`, [178, 96], `cmpI.${H[1]}`);
  wire(`VS${k}`, [178, 100], [178, 104]);
  wire(`VS${k}`, [178, 104], `cmpI.${L[0]}`);
  on("ITH_N", `cmpI.${L[1]}`);
  wire("I_TRIP_OC", `cmpI.${H[2]}`, [206, 94]);
  wire("I_TRIP_OC", [206, 94], [206, 106]);
  wire("I_TRIP_OC", [206, 106], `cmpI.${L[2]}`);
  // electrode connector (JST-XH 2-pin), TVS on both electrodes
  place(s, `jEl${k}`, "J", "conn-electrode", "B2B-XH-A", [240, 50]);
  on(`EP${k}`, `jEl${k}.1`);
  on(`EN${k}`, `jEl${k}.2`);
  place(s, `tvsEp${k}`, "D", "tvs-coil", "SMF15CA", [220, 66], { rot: 90 });
  on(`EP${k}`, `tvsEp${k}.2`);
  on("GND1", `tvsEp${k}.1`);
  place(s, `tvsEn${k}`, "D", "tvs-coil", "SMF15CA", [230, 66], { rot: 90 });
  on(`EN${k}`, `tvsEn${k}.2`);
  on("GND1", `tvsEn${k}.1`);
  // supply of this channel's OPA4197 and INA821
  unit(s, q, 5, [40, 120]);
  on("ISO_P15", `${q}.4`);
  on("ISO_N15", `${q}.11`);
  dec(s, [50, 112], "ISO_P15", "GND1");
  dec(s, [58, 112], "GND1", "ISO_N15");
  dec(s, [170, 120], "ISO_P15", "GND1");
  dec(s, [178, 120], "GND1", "ISO_N15");
}
tesChannel(1);
tesChannel(2);

// =================================================================================================================

export default defineSchematic({
  project: "helmet-driver",
  sheet: { paper: "A3", title: "Helmet Driver: 8 coil current sources, 2 isolated tES channels", rev: "B", date: "2026-11-14", company: "god-helmet" },
  sheets: SHEETS.map((x) => ({ ...x, paper: "A3" as const })),
  parts,
  nets: nets(),
  noConnect,
  text,
} as never);
