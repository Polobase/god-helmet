// Symbols the KiCad stock library does not have, generated from a datasheet's pin table (`bun run lib:import`
// writes them into lib/kicad/symbols/GHP_Generated.kicad_sym, provenance in lib/kicad/SOURCES.json).
//
// A generated symbol is a plain box: every pin of the table, with the datasheet's number, name and direction, on the
// side the table names. Nothing about the pinout is guessed: the table is typed from the datasheet, `source` names
// the page, and lib:import refuses a table whose pin numbers do not match the footprint's pads one to one.
import { parse, type List } from "../sexpr/sexpr.ts";

export type PinType = "input" | "output" | "bidirectional" | "power_in" | "power_out" | "passive" | "no_connect" | "open_collector";
export type Side = "left" | "right" | "top" | "bottom";

export interface GeneratedPin {
  number: string;
  name: string;
  type: PinType;
  side: Side;
}

export interface GeneratedSymbol {
  /** Where the pin table comes from (document, revision, page). */
  source: string;
  description: string;
  keywords: string;
  footprint: string;
  footprintFilter: string;
  datasheet: string;
  /** Pins in the order they appear along each side (left and right: top to bottom; top and bottom: left to right).
   *  A pin with an empty name is a gap: no pin, one grid step of space. */
  pins: GeneratedPin[];
}

const G = 2.54;
const r = (v: number) => Math.round(v * 1000) / 1000;
const q = (s: string) => JSON.stringify(s);

/** The symbol in KiCad 10's form (as the stock libraries are written), as a parsed s-expression. */
export function generateSymbol(name: string, def: GeneratedSymbol): List {
  const sides: Record<Side, GeneratedPin[]> = { left: [], right: [], top: [], bottom: [] };
  for (const p of def.pins) sides[p.side].push(p);
  const numbers = def.pins.filter((p) => p.name !== "").map((p) => p.number);
  const dup = numbers.find((n, i) => numbers.indexOf(n) !== i);
  if (dup) throw new Error(`generated symbol ${name}: pin ${dup} twice`);
  // Body: room for the longest side, at least 6 grid steps, plus a step at each end.
  const rows = Math.max(sides.left.length, sides.right.length, 6) + 1;
  const cols = Math.max(sides.top.length, sides.bottom.length, 6) + 1;
  const halfH = (rows * G) / 2;
  const halfW = Math.max((cols * G) / 2, 10.16);
  const W = Math.ceil(halfW / G) * G;
  const Hh = Math.ceil(halfH / G) * G;
  const pinText = (p: GeneratedPin, x: number, y: number, rot: number) =>
    `(pin ${p.type} line (at ${r(x)} ${r(y)} ${rot}) (length 2.54) (name ${q(p.name)} (effects (font (size 1.27 1.27)))) (number ${q(p.number)} (effects (font (size 1.27 1.27)))))`;
  const pins: string[] = [];
  const along = (list: GeneratedPin[], place: (i: number) => [number, number], rot: number) =>
    list.forEach((p, i) => {
      if (p.name === "") return;
      const [x, y] = place(i);
      pins.push(pinText(p, x, y, rot));
    });
  // y up in symbol coordinates: the first pin of a side at the top (left, right) or at the left (top, bottom).
  const startY = Hh - G;
  const startX = -W + G;
  along(sides.left, (i) => [-W - G, startY - i * G], 0);
  along(sides.right, (i) => [W + G, startY - i * G], 180);
  along(sides.top, (i) => [startX + i * G, Hh + G], 270);
  along(sides.bottom, (i) => [startX + i * G, -Hh - G], 90);
  const prop = (key: string, value: string, x: number, y: number, hide: boolean) =>
    `(property ${q(key)} ${q(value)} (at ${r(x)} ${r(y)} 0) (show_name no) (do_not_autoplace no)${hide ? " (hide yes)" : ""} (effects (font (size 1.27 1.27))))`;
  const text = `(symbol ${q(name)} (exclude_from_sim no) (in_bom yes) (on_board yes) (in_pos_files yes) (duplicate_pin_numbers_are_jumpers no)
    ${prop("Reference", "U", -W, Hh + 3.81, false)}
    ${prop("Value", name, W - 2 * G, Hh + 3.81, false)}
    ${prop("Footprint", def.footprint, 0, -Hh - 6.35, true)}
    ${prop("Datasheet", def.datasheet, 0, -Hh - 8.89, true)}
    ${prop("Description", def.description, 0, 0, true)}
    ${prop("ki_keywords", def.keywords, 0, 0, true)}
    ${prop("ki_fp_filters", def.footprintFilter, 0, 0, true)}
    (symbol ${q(`${name}_0_1`)} (rectangle (start ${r(-W)} ${r(Hh)}) (end ${r(W)} ${r(-Hh)}) (stroke (width 0.254) (type default)) (fill (type background))))
    (symbol ${q(`${name}_1_1`)} ${pins.join(" ")})
    (embedded_fonts no))`;
  const lib = parse(`(kicad_symbol_lib ${text})`, `generated:${name}`);
  return lib.items[1] as List;
}

const pin = (number: string, name: string, type: PinType, side: Side): GeneratedPin => ({ number, name, type, side });
const gap = (side: Side): GeneratedPin => ({ number: "", name: "", type: "passive", side });

export const GENERATED_SYMBOLS: Record<string, GeneratedSymbol> = {
  "Generated:DAC81408": {
    source:
      "TI DAC81408 data sheet SLASER3A (July 2018, revised November 2018), section 6 Pin Configuration and Functions: " +
      "RHA package figure and Pin Functions table (pp. 3-4), read 2026-11-14. Pin 41 is the package's thermal pad (p. 4: " +
      "'connected to any internal PCB ground plane'), pad 41 of KiCad's Texas_RHA_VQFN-40 footprints.",
    description: "8-channel 16-bit high-voltage output DAC, ±2.5 V to ±20 V or 0 to 40 V per channel, 2.5 V internal reference, SPI",
    keywords: "DAC 16-bit octal bipolar high-voltage",
    footprint: "Package_DFN_QFN:Texas_RHA_VQFN-40-1EP_6x6mm_P0.5mm_EP4.6x4.6mm_ThermalVias",
    footprintFilter: "*VQFN*40*6x6mm*P0.5mm*",
    datasheet: "https://www.ti.com/lit/ds/symlink/dac81408.pdf",
    pins: [
      // left: serial interface and control, then the reference
      pin("14", "~{CS}", "input", "left"),
      pin("12", "SCLK", "input", "left"),
      pin("13", "SDI", "input", "left"),
      pin("11", "SDO", "output", "left"),
      gap("left"),
      pin("18", "~{LDAC}", "input", "left"),
      pin("19", "~{RESET}", "input", "left"),
      pin("20", "~{CLR}", "input", "left"),
      gap("left"),
      pin("15", "TOGGLE0", "input", "left"),
      pin("16", "TOGGLE1", "input", "left"),
      pin("17", "TOGGLE2", "input", "left"),
      gap("left"),
      pin("33", "REF", "bidirectional", "left"),
      pin("34", "REFCMP", "passive", "left"),
      // right: the eight outputs, alarm and temperature
      pin("5", "OUT0", "output", "right"),
      pin("6", "OUT1", "output", "right"),
      pin("7", "OUT2", "output", "right"),
      pin("8", "OUT3", "output", "right"),
      pin("23", "OUT4", "output", "right"),
      pin("24", "OUT5", "output", "right"),
      pin("25", "OUT6", "output", "right"),
      pin("26", "OUT7", "output", "right"),
      gap("right"),
      pin("21", "~{ALMOUT}", "open_collector", "right"),
      pin("22", "TEMPOUT", "output", "right"),
      gap("right"),
      pin("1", "NC", "no_connect", "right"),
      pin("2", "NC", "no_connect", "right"),
      pin("3", "NC", "no_connect", "right"),
      pin("4", "NC", "no_connect", "right"),
      pin("27", "NC", "no_connect", "right"),
      pin("28", "NC", "no_connect", "right"),
      pin("29", "NC", "no_connect", "right"),
      pin("30", "NC", "no_connect", "right"),
      // top: supplies, a step apart so their power symbols do not overlap
      pin("31", "VCC", "power_in", "top"),
      gap("top"),
      pin("40", "VCC", "power_in", "top"),
      gap("top"),
      pin("37", "VAA", "power_in", "top"),
      gap("top"),
      pin("38", "VDD", "power_in", "top"),
      gap("top"),
      pin("9", "VIO", "power_in", "top"),
      // bottom: negative supply and grounds. The data sheet's VSS is the negative supply (-21.5 to 0 V); named V- here,
      // because KiCad's ERC takes a pin called VSS for a ground pin (ground_pin_not_ground)
      pin("32", "V-", "power_in", "bottom"),
      gap("bottom"),
      pin("39", "V-", "power_in", "bottom"),
      gap("bottom"),
      pin("10", "GND", "power_in", "bottom"),
      gap("bottom"),
      pin("36", "GND", "power_in", "bottom"),
      gap("bottom"),
      pin("35", "REFGND", "power_in", "bottom"),
      gap("bottom"),
      pin("41", "PAD", "power_in", "bottom"),
    ],
  },
};
