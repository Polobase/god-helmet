// helmet-driver's board: 160 x 100 mm (the Eurocard size, so it fits off-the-shelf card guides and boxes), 4 layers
// (JLC04161H-7628), every SMD part on top. `bun run pcb -- helmet-driver`.
//
//   y 0 ┌H1 ─── [antenna, no copper] ─── SW RESET BOOT STOP LED ──────────────────┬gap┬ A0515S TP×4 ──── H2 ┐
//       │ decoupling [ESP32-S3]   ADS8688 (X)   DAC81408   ADS8688 (OUT)          │   │ ISO6741F ×2 DAC80504 │
//       │ USB-C  TPS65131, L1, L2 ┌──────────────────────┬──────────────────────┐ │   │ ADS8688, trip, beat  │
//       │ power                   │ coils 8 ... 5         │ coils 4 ... 1         │ │   ├──────────────────────┤
//       │ STOP jack               │ setpoint filters,     │ setpoint filters,     │ │   │ tES channel 1    J5 ◄│
//       │ safety logic            │ comparators, drivers  │ comparators, drivers  │ │   ├──────────────────────┤
//       │ SW4 (ceiling)  J3 (I²C) └──── TP1 TP2 ── [Micro-Fit J4] ──────────────┘ │   │ tES channel 2    J6 ◄│
//  y100 └H3 ───────────────────────────────────────────────────────────────────────┴───┴─────────────────── H4 ┘
//       x 0                                                                    110.4  113.6                  160
//
// - The tES island (everything on GND1) lies right of a 3.2 mm gap. The gap is a routing keep-out on all four
//   layers, the planes and pours of the two sides stop at its edges, and a custom DRC rule checks 3 mm between
//   island copper and any other copper. Only the A0515S converter and the two ISO6741F isolators straddle it:
//   A0515S pins 1-2 (input) and the isolators' pins 1-8 on the main side, the rest on the island.
// - The ESP32-S3's antenna lies at the top edge, with no copper in a band 24 mm either side of the module's centre
//   (Espressif's placement for an antenna on the board; hanging it over the edge would put the module's
//   silkscreen off the board, which DRC reports).
// - Every part of a schematic page is placed in its page's area; the island's parts by their net domain.
// - Decoupling capacitors are pulled to the IC pin they sit next to on the schematic.
// - In1.Cu: GND (main) and GND1 (island) planes. In2.Cu is a routing layer, filled with the grounds after routing.
//   The rails are routed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNetlistXml } from "../../tools/kicad/netlist-xml.ts";
import { buildDir } from "../../tools/lib/paths.ts";
import { boardNetName, type KeepoutSpec, type PcbSpec, type PlaneSpec, type Pt } from "../../tools/pcb/flow.ts";
import type { Placement, Rect } from "../../tools/pcb/place.ts";
import { parts, pin, pinNumbers, pinSheet } from "./draw.ts";
import "./schematic.ts";

const W = 160;
const H = 100;
/** The ESP32-S3 module's centre: its silkscreen's far end (y -12.9, a 0.12 mm line) 0.24 mm inside the top edge. */
const ESP = { x: 32, y: 13.2 };
/** The isolation gap between the main side and the tES island (x). */
const GAP = { x0: 110.4, x1: 113.6 };
/** Board edge clearance of planes and pours. */
const EDGE = 0.5;

// ---- the netlist: domains and net names ------------------------------------------------------------------------

const net = parseNetlistXml(readFileSync(join(buildDir("helmet-driver"), "helmet-driver.net.xml"), "utf8"));
// The names the board uses (a "/" in a pin name is "{slash}" there).
for (const n of net.nets) n.name = boardNetName(n.name);
const refOf = (key: string) => {
  const p = parts[key] as { ref?: string } | undefined;
  if (!p?.ref) throw new Error(`pcb.ts: no part ${key}`);
  return p.ref;
};
const keyOf = new Map(Object.entries(parts).map(([k, p]) => [(p as { ref: string }).ref, k]));
const padNet: Record<string, Record<string, string>> = {};
for (const n of net.nets) for (const node of n.nodes) (padNet[node.ref] ??= {})[node.pin] = n.name;

/** The parts across the isolation barrier. */
const BARRIER = ["dcIso", "iso1", "iso2"].map(refOf);

// Nets joined through any part but the barrier parts; the island is GND1's group.
const parent = new Map<string, string>();
const find = (a: string): string => {
  const p = parent.get(a) ?? a;
  if (p === a) return a;
  const r = find(p);
  parent.set(a, r);
  return r;
};
for (const c of net.components) {
  if (BARRIER.includes(c.ref)) continue;
  const ns = Object.values(padNet[c.ref] ?? {});
  for (const n of ns.slice(1)) parent.set(find(n), find(ns[0]!));
}
const islandRoot = find("GND1");
if (find("GND") === islandRoot) throw new Error("pcb.ts: GND and GND1 are joined by a part that is not a barrier part");
const ISLAND_NETS = net.nets.map((n) => n.name).filter((n) => find(n) === islandRoot);
const isIslandNet = new Set(ISLAND_NETS);
const isIsland = (ref: string) => Object.values(padNet[ref] ?? {}).some((n) => isIslandNet.has(n));

// ---- fixed parts ------------------------------------------------------------------------------------------------

const at = (x: number, y: number, rot: Placement["rot"] = 0): Placement => ({ x, y, rot, side: "top" });
const fixedByKey: Record<string, Placement> = {
  // Mounting holes, M3, 4 mm from the corners. H2 and H4 are on the island: nylon screws there, or none.
  hole1: at(4, 4),
  hole2: at(W - 4, 4),
  hole3: at(4, H - 4),
  hole4: at(W - 4, H - 4),
  // ESP32-S3-WROOM-1 with its antenna at the top edge (ESP: the end of its silkscreen just inside the edge).
  // The antenna's clearance band (Espressif: no copper within 15 mm either side) is a keep-out (ANTENNA). Its 3V3
  // pin (pin 2, top left) is decoupled from the free space left of it.
  esp: at(ESP.x, ESP.y),
  // I²C header for the magnetometer at the bottom edge (pin 1 left), so the module's decoupling has the room
  // left of it.
  i2c: at(33, 97, 90),
  // RESET, BOOT and STOP in a row at the top edge right of the antenna band, the status LED beside them.
  swReset: at(61, 3.5),
  swBoot: at(70, 3.5),
  swStop: at(79, 3.5),
  led: at(86, 3),
  tpTx: at(2.5, 22.5),
  // USB-C on the left edge, the opening flush with it (rot 270: the receptacle's front, y +3.65, faces -x); its
  // ESD protection between it and the module's USB pins.
  usbc: at(4, 32, 270),
  esd: at(12.5, 30),
  ldo3v3: at(21, 30),
  tps: at(24, 44),
  // Its inductor right of it a millimetre further off than the placer put it (2026-11-14): with the diode above and the
  // inductor beside it, the CP and FBP pins (21, 22, top row right of the diode's pins) had no way out.
  l2: at(32.5, 44.5),
  // Its two diodes right above and below it and its inductor left of it, where rev A had them: the switching nodes
  // stay a few millimetres long. Its small parts go first after these.
  d1: at(24, 38),
  l1: at(16, 42.5),
  d2: at(26, 50.5),
  // The STOP jack on the left edge (its barrel at -x, its silkscreen just inside the edge).
  jStop: at(8.6, 70),
  // The coil ceiling switch (open = 5 mA) and the safety test point.
  swCeil: at(24, 95),
  tpVth: at(36, 66),
  // Rail test points at the bottom edge, left of the coil connector. The reference test point at the top edge right
  // of the switches: under the DAC81408 (rev A's spot) its through-hole pads blocked the DAC's bottom pins.
  tpP15: at(46, 97.5),
  tpN15: at(52.5, 97.5),
  tpVref: at(93, 4),
  // The coil connector on the bottom edge, its mating face 0.2 mm inside it (rot 180: the housing faces +y; the
  // silkscreen of the face, 0.11 mm beyond it, stays on the board). Pin 1 (coil 1) is the right end; pins 1-8 are
  // the coil outputs, 9-16 their returns.
  jCoil: at(82.5, H - 9.03 - 0.1, 180),
  // Across the gap: A0515S pins 1-2 (x 106.92, 109.46) on the main side, pins 4-6 (114.54...119.62) on the island.
  dcIso: at(GAP.x0 + (GAP.x1 - GAP.x0) / 2 - 5.08, 5, 90),
  iso1: at(112, 21),
  iso2: at(112, 36),
  // The island.
  tpIp15: at(128, 3),
  tpIn15: at(134, 3),
  tpI5: at(140, 3),
  tpIref: at(146, 3),
  dacT: at(126, 24),
  jEl1: at(155, 60, 90),
  jEl2: at(155, 86, 90),
};

// The ICs of the repeated blocks, found by their nets.
const partOf = (ref: string) => (parts[keyOf.get(ref)!] as { part: string }).part;
const onNet = (part: string, n: string) => {
  // A net local to one page is named "/<page>/NAME" by KiCad.
  const named = (m: string) => m === n || m.endsWith(`/${n}`);
  const hits = net.components.filter((c) => partOf(c.ref) === part && Object.values(padNet[c.ref] ?? {}).some(named)).map((c) => c.ref);
  if (hits.length !== 1) throw new Error(`pcb.ts: ${hits.length} parts ${part} on net ${n}`);
  return hits[0]!;
};
const fixedByRef: Record<string, Placement> = {};
// Coil channels in columns, 8.5 mm apart, channel 8 at the left and channel 1 at the right (the connector's pins
// 8...1 run left to right). Per pair of columns, top to bottom: the setpoint filters (placed by area), the window
// comparators (one LM339 per two channels), the dual driver (one OPA2197 per two channels) between its columns.
// The driver at rot 180: amplifier A (the odd channel, pins 1-3) on the right, its output (pin 1) at the bottom
// right towards the connector; amplifier B (the even channel, pins 5-7) on the left.
const colX = (k: number) => 46.5 + 8.5 * (8 - k);
for (const k of [1, 3, 5, 7]) {
  const mid = (colX(k) + colX(k + 1)) / 2;
  const drv = onNet("opa2197-soic8", `OUT${k}`);
  if (onNet("opa2197-soic8", `OUT${k + 1}`) !== drv) throw new Error(`pcb.ts: channels ${k} and ${k + 1} are not one OPA2197`);
  fixedByRef[drv] = at(mid, 66, 180);
  fixedByRef[onNet("lm339-soic14", `X${k}`)] = at(mid, 50, 90);
}
// The converters' row under the switches: the X-node monitor ADC, the DAC81408 above the middle of the coil
// columns (rot 180: DAC1-DAC4, pins 5-8, face channels 1-4 on the right), the driver-output monitor ADC.
fixedByRef[refOf("adcX")] = at(56, 17, 90);
fixedByRef[refOf("dac")] = at((colX(1) + colX(8)) / 2, 17, 180);
fixedByRef[refOf("adcO")] = at(96, 17, 90);
// The island: ADC and logic beside the DAC, each tES channel's op-amp and instrumentation amplifier in a row
// that ends at its electrode connector.
fixedByRef[refOf("adcT")] = at(128, 40, 90);
fixedByRef[refOf("cmpI")] = at(148, 22);
fixedByRef[refOf("ffI")] = at(148, 40);
fixedByRef[refOf("opaT1")] = at(124, 58, 90);
fixedByRef[onNet("ina821-soic8", "EB1")] = at(137, 58, 90);
fixedByRef[refOf("opaT2")] = at(124, 85, 90);
fixedByRef[onNet("ina821-soic8", "EB2")] = at(137, 85, 90);

const fixed: Record<string, Placement> = { ...Object.fromEntries(Object.entries(fixedByKey).map(([k, p]) => [refOf(k), p])), ...fixedByRef };

// ---- placement areas --------------------------------------------------------------------------------------------

const R = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });
const MAIN_X1 = GAP.x0 - 0.5;
const ISLAND_X0 = GAP.x1 + 0.5;
const AREA: Record<string, Rect> = {
  mcu: R(0, 0, 46, 30),  // 46: room for the module's decoupling when the power area's parts are pinned (2026-11-15)
  conv: R(42, 0, MAIN_X1, 30),
  power: R(0, 30, 42, 64),
  safety: R(0, 64, 42, H),
  coilB: R(42, 28, 76.25, H),
  coilA: R(76.25, 28, MAIN_X1, H),
  // A few capacitors of the coil supply page, and the main side's parts on the island's pages: across areas.
  supply: R(42, 28, MAIN_X1, H),
  isoMain: R(96, 0, MAIN_X1, 50),
  islandCore: R(ISLAND_X0, 0, W, 50),
  tes1: R(ISLAND_X0, 46, W, 76),
  tes2: R(ISLAND_X0, 72, W, H),
};
const PAGE_AREA: Record<string, string> = {
  power: "power",
  mcu: "mcu",
  safety: "safety",
  converters: "conv",
  monitor: "conv",
  "coil-a": "coilA",
  "coil-b": "coilB",
  "coil-supply": "supply",
};
const ISLAND_PAGE_AREA: Record<string, string> = { island: "islandCore", "island-safety": "islandCore", "tes-1": "tes1", "tes-2": "tes2" };
const sheetOfKey = (key: string) => {
  const p = parts[key] as { sheet?: string };
  if (!p.sheet) throw new Error(`pcb.ts: part ${key} has no page`);
  return p.sheet;
};

// ---- decoupling: next to the IC pin the capacitor is drawn beside ----------------------------------------------

const GROUNDS = new Set(["GND", "GND1"]);
const near: Record<string, string> = {};
for (const c of net.components) {
  if (!c.ref.startsWith("C") || c.ref in fixed) continue;
  const pads = padNet[c.ref] ?? {};
  const nets = Object.values(pads);
  if (nets.length !== 2 || !nets.some((n) => GROUNDS.has(n))) continue;
  const rail = nets.find((n) => !GROUNDS.has(n));
  if (!rail) continue;
  const key = keyOf.get(c.ref)!;
  const railPin = Object.entries(pads).find(([, n]) => n === rail)![0];
  const from = pin(`${key}.${railPin}`);
  const sheet = pinSheet(`${key}.${railPin}`);
  let best: { ref: string; d: number } | undefined;
  for (const ic of net.components) {
    if (ic.ref === c.ref || Object.keys(padNet[ic.ref] ?? {}).length < 5) continue;
    const icKey = keyOf.get(ic.ref)!;
    for (const [num, n] of Object.entries(padNet[ic.ref] ?? {})) {
      if (n !== rail || !pinNumbers(icKey).includes(num) || pinSheet(`${icKey}.${num}`) !== sheet) continue;
      const p = pin(`${icKey}.${num}`);
      const d = Math.hypot(p[0] - from[0], p[1] - from[1]);
      if (!best || d < best.d) best = { ref: `${ic.ref}.${num}`, d };
    }
  }
  if (best) near[c.ref] = best.ref;
}

// Small parts on a local net (a net that reaches one IC pin and is no rail), on the pages with fine-pitch ICs: next to
// that pin. Without this the placer left the TPS65131's feedback dividers and compensation, and the ADCs' reference
// capacitors, 10-15 mm from their pins (2026-11-15), and their long tracks took the room the router needed there.
// The TPS65131's own go first, before the inductors and diodes that otherwise fill the space around it.
const LOCAL_SHEETS = new Set(["power", "converters", "island", "island-safety"]);
const RAILS = new Set([...GROUNDS, "+3V3", "+5V", "+15V", "-15V", "+5VA", "ISO_5V", "ISO_P15", "ISO_N15"]);
const icPins = new Map<string, string[]>();
for (const c of net.components) {
  if (Object.keys(padNet[c.ref] ?? {}).length < 5) continue;
  for (const [num, n] of Object.entries(padNet[c.ref] ?? {})) {
    if (!icPins.has(n)) icPins.set(n, []);
    icPins.get(n)!.push(`${c.ref}.${num}`);
  }
}
const firstPlaced: string[] = [];
for (const c of net.components) {
  if (!/^[RC]\d/.test(c.ref) || c.ref in fixed || near[c.ref]) continue;
  const key = keyOf.get(c.ref);
  const pads = padNet[c.ref] ?? {};
  if (!key || Object.keys(pads).length !== 2 || !LOCAL_SHEETS.has(sheetOfKey(key))) continue;
  for (const n of Object.values(pads)) {
    const pins = icPins.get(n) ?? [];
    if (RAILS.has(n) || pins.length !== 1) continue;
    const [icRef, num] = pins[0]!.split(".") as [string, string];
    if (pinSheet(`${keyOf.get(icRef)}.${num}`) !== sheetOfKey(key)) continue;
    near[c.ref] = pins[0]!;
    if (icRef === refOf("tps")) firstPlaced.push(c.ref);
    break;
  }
}

// Areas: by page, the island's parts by domain; a capacitor of the coil supply page goes where its IC is.
const members: Record<string, string[]> = {};
for (const c of net.components) {
  if (c.ref in fixed) continue;
  const key = keyOf.get(c.ref);
  if (!key) throw new Error(`pcb.ts: ${c.ref} is not a part of schematic.ts`);
  const sheet = sheetOfKey(key);
  let area: string | undefined;
  if (isIsland(c.ref)) {
    area = ISLAND_PAGE_AREA[sheet];
    if (!area) throw new Error(`pcb.ts: ${c.ref} is on the island's nets but on page ${sheet}`);
  } else if (sheet in ISLAND_PAGE_AREA) {
    area = "isoMain";
  } else if (sheet === "coil-supply" && near[c.ref]) {
    const icKey = keyOf.get(near[c.ref]!.split(".")[0]!)!;
    area = PAGE_AREA[sheetOfKey(icKey)] ?? "supply";
  } else {
    area = PAGE_AREA[sheet];
  }
  if (!area) throw new Error(`pcb.ts: no area for ${c.ref} (page ${sheet})`);
  (members[area] ??= []).push(c.ref);
}

// ---- copper -----------------------------------------------------------------------------------------------------

const poly = (...xy: [number, number][]): Pt[] => xy.map(([x, y]) => ({ x, y }));
/** Copper stays this far from the island's mounting holes (a nylon screw head with a washer, 7 mm, clears it). */
const HOLE_KEEP = 4.5;
const MAIN = poly([EDGE, EDGE], [GAP.x0, EDGE], [GAP.x0, H - EDGE], [EDGE, H - EDGE]);
const ISLAND = poly(
  [GAP.x1, EDGE], [W - 4 - HOLE_KEEP, EDGE], [W - 4 - HOLE_KEEP, 4 + HOLE_KEEP], [W - EDGE, 4 + HOLE_KEEP],
  [W - EDGE, H - 4 - HOLE_KEEP], [W - 4 - HOLE_KEEP, H - 4 - HOLE_KEEP], [W - 4 - HOLE_KEEP, H - EDGE], [GAP.x1, H - EDGE],
);

// In1.Cu: the two grounds as planes. In2.Cu is the router's third layer (2026-11-13: with power planes on both
// inner layers, Freerouting left 30-40 connections open after ten passes and stalled there); after routing it is
// filled with the grounds like the outer layers. The rails are routed as power tracks.
const planes: PlaneSpec[] = [
  { net: "GND", layer: "In1.Cu", shape: MAIN },
  { net: "GND1", layer: "In1.Cu", shape: ISLAND },
];
// Inside, every pad joins the pour directly: thermal reliefs only help soldering, and there tracks can starve them.
const pours: PlaneSpec[] = (["F.Cu", "In2.Cu", "B.Cu"] as const).flatMap((layer) => [
  { net: "GND", layer, shape: MAIN, ...(layer === "In2.Cu" && { pads: "solid" as const }) },
  { net: "GND1", layer, shape: ISLAND, ...(layer === "In2.Cu" && { pads: "solid" as const }) },
]);
const ALL: KeepoutSpec["layers"] = ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"];
const holeSquare = (y0: number, y1: number): Rect => R(W - 4 - HOLE_KEEP, y0, W, y1);
/** The antenna's clearance band: 24 mm either side of the module's centre, from the top edge to where its body
 *  starts (module y -6.75). */
const ANTENNA = R(ESP.x - 24, 0, ESP.x + 24, ESP.y - 6.75);
/** Under the island DAC (DAC80504, WQFN-16, rot 0), between its corner pin 8 and the exposed pad: its ISO_5V pins 7
 *  and 9 sit either side of pin 8, and Freerouting joined them through that gap at 0.1 mm, under the 0.15 mm
 *  minimum (2026-11-14, every run). With the corner closed they join outside the part. Only the pocket between the
 *  exposed pad (±0.38 mm) and the pins' inner ends (±1.0 mm), 0.07 mm clear of every pad: a keep-out that reached
 *  pin 7's side made the router neck its track down to 0.12 mm instead (2026-11-15). */
const DACT = fixedByKey.dacT!;
const DACT_CORNER = R(DACT.x + 0.45, DACT.y + 0.45, DACT.x + 0.93, DACT.y + 0.93);
const routeKeepouts: KeepoutSpec[] = [
  { shape: ANTENNA, layers: ALL },
  { shape: DACT_CORNER, layers: ["F.Cu"] },
  { shape: R(GAP.x0, 0, GAP.x1, H), layers: ALL },
  { shape: holeSquare(0, 4 + HOLE_KEEP), layers: ALL },
  { shape: holeSquare(H - 4 - HOLE_KEEP, H), layers: ALL },
];

const MAIN_POWER = ["GND", "+5V", "Net-(D2-A)", "Net-(D3-K)", "Net-(Q1-D)"];
// Rails that reach the 0.5 mm pitch pins of the DAC81408 (VQFN-40) and the ADS8688s (TSSOP-38): 0.25 mm. A 0.3 mm
// track down the middle of such a pin sits exactly at the 0.2 mm clearance to its neighbour (and two rails on
// neighbouring pins, +15V and -15V at the DAC's corners, cannot both leave); Freerouting left all of them open
// (2026-11-14). 0.25 mm keeps 0.225 mm and carries these rails' current (+3V3 under 0.5 A, ±15 V about 0.2 A).
const MAIN_MID = ["+3V3", "+15V", "-15V", "+5VA"];
// Rails that leave 0.5 mm pitch QFN pins (TPS65131 VPOS pin 23 and VNEG pin 15, about 175 mA; the DAC80504's
// ISO_5V): 0.2 mm, which leaves those pins where 0.3 mm did not (Freerouting left them open in every run).
const MAIN_FINE = ["Net-(D2-K)", "Net-(D3-A)"];
const ISLAND_POWER = ["GND1", "ISO_P15", "ISO_N15"];
const ISLAND_FINE = ["ISO_5V"];
for (const n of [...MAIN_POWER, ...MAIN_MID, ...MAIN_FINE, ...ISLAND_POWER, ...ISLAND_FINE]) if (!net.nets.some((m) => m.name === n)) throw new Error(`pcb.ts: no net ${n}`);
const ISLAND_CLASSES = ["Island", "IslandPower", "IslandFine"];

export const spec: PcbSpec = {
  outline: R(0, 0, W, H),
  offset: { x: 50, y: 50 },
  smdSide: "top",
  edge: 0.5,
  // Room around every part for its plane vias and the tracks that leave it.
  spacing: 0.8,
  // ICs, inductors, diodes in SMA/SMB and the large capacitors first, while the room is in one piece.
  largeFirst: 8,
  fixed,
  near,
  order: firstPlaced,
  regions: Object.entries(members).map(([a, refs]) => ({ rect: AREA[a]!, refs })),
  // No part in the antenna's band or under the island's screw heads, and none within 3.5 mm of the island DAC's
  // centre: a SOT-23-5 placed 1.5 mm from its pins walled in its ISO_5V pins 7, 9 and 11 (2026-11-14).
  keepouts: [ANTENNA, holeSquare(0, 4 + HOLE_KEEP), holeSquare(H - 4 - HOLE_KEEP, H), R(DACT.x - 3.5, DACT.y - 3.5, DACT.x + 3.5, DACT.y + 3.5)],
  // Power tracks 0.3 mm: wide enough for the 1.1 A input over its short run, narrow enough to leave the 0.5 mm
  // pitch pins of the TPS65131, the DAC80504 and the USB-C receptacle (at 0.4 mm Freerouting left them open).
  netClasses: [
    { name: "Default", track: 0.2, clearance: 0.2, via: 0.6, drill: 0.3, nets: [] },
    { name: "Power", track: 0.3, clearance: 0.2, via: 0.6, drill: 0.3, nets: MAIN_POWER },
    { name: "PowerMid", track: 0.25, clearance: 0.2, via: 0.6, drill: 0.3, nets: MAIN_MID },
    { name: "PowerFine", track: 0.2, clearance: 0.2, via: 0.6, drill: 0.3, nets: MAIN_FINE },
    { name: "IslandPower", track: 0.3, clearance: 0.2, via: 0.6, drill: 0.3, nets: ISLAND_POWER },
    { name: "IslandFine", track: 0.2, clearance: 0.2, via: 0.6, drill: 0.3, nets: ISLAND_FINE },
    { name: "Island", track: 0.2, clearance: 0.2, via: 0.6, drill: 0.3, nets: ISLAND_NETS.filter((n) => !ISLAND_POWER.includes(n) && !ISLAND_FINE.includes(n)) },
  ],
  pour: { clearance: 0.3, minWidth: 0.25, edgeClearance: EDGE },
  planes,
  pours,
  signalInner: ["In2.Cu"],
  // Solid to the zones: the exposed pads' thermal vias (a relief inside a copper pad only starves), the converter's
  // island ground pin and the USB-C shield, whose reliefs the routing left with one spoke (2026-11-13).
  // The ADS8688s (TSSOP-38, 0.5 mm pitch): their AIN_nGND pins alternate with the inputs, so their ground vias go
  // under the body, which leaves the inputs free to leave outwards. The vias' tracks 0.25 mm: at 0.3 mm a track down
  // the middle of a 0.3 mm pad at 0.5 mm pitch sits exactly at the 0.2 mm clearance to its neighbours.
  planeVia: { track: 0.25 },
  // The DACs' corner ground pins at 45°: the island DAC's pin 8 (GND1) sits between its ISO_5V pins 7 and 9, and a via
  // straight below it left pin 7's track 0.1 mm wide (2026-11-14, every run); the DAC81408's pin 10 (GND) is next to
  // VIO (pin 9), and its via straight out walled VIO in (2026-11-15).
  planeViaFirst: {
    [refOf("adcX")]: "inward", [refOf("adcO")]: "inward", [refOf("adcT")]: "inward",
    [refOf("dacT")]: "diagonal", [refOf("dac")]: "diagonal",
  },
  solidPads: [`${refOf("tps")}.25`, `${refOf("dac")}.41`, `${refOf("dacT")}.17`, `${refOf("esp")}.41`, `${refOf("dcIso")}.5`, `${refOf("usbc")}.SH`],
  routeKeepouts,
  drcRules: [
    "(version 1)",
    "",
    "# The tES island floats (spec.md, tES island): 3 mm between its copper and any other copper, on every layer.",
    "# pcb.ts keeps the gap free of tracks, vias and zones; this rule checks it.",
    '(rule "tES island isolation"',
    "  (constraint clearance (min 3mm))",
    `  (condition "(${ISLAND_CLASSES.map((c) => `A.NetClass == '${c}'`).join(" || ")}) && ${ISLAND_CLASSES.map((c) => `B.NetClass != '${c}'`).join(" && ")}"))`,
  ].join("\n"),
  // Thermal vias of 0.2 mm in the exposed pads of the TPS65131, the DAC81408, the DAC80504 and the ESP32-S3 module (KiCad's
  // footprints); JLCPCB drills from 0.15 mm (docs/jlcpcb.md, Four-layer boards).
  rules: { min_through_hole_diameter: 0.2 },
  // Rev A, 474 parts: one pass took 40-150 s (2026-11-13: 199 connections open after pass 1, 30 after pass 10).
  // Rev B has about 360.
  passes: 60,
  // Five runs, each with its own via cost (flow.ts ATTEMPT_VIA_COSTS): Freerouting gives the same board for the same
  // settings, so more runs only help with different ones.
  attempts: 5,
  routeMinutes: 60,
};
