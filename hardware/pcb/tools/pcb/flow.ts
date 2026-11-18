// `bun run pcb -- <id>`: the board from the approved schematic, placed and routed:
//   1. netlist (build/<id>/<id>.net.xml from `bun run sch`), footprint geometry (KiCad),
//   2. placement: fixed parts (connectors, through-hole parts, anything placed by hand) from the board's pcb
//      spec (modules/<id>/pcb.ts), SMD parts by the greedy placer (place.ts),
//   3. board built with KiCad's API (nets, outline, symbol links for schematic parity; a part on a page of a
//      hierarchical schematic is linked by its sheet path, "/<sheet>/<symbol>", as Update PCB links it),
//   4. Freerouting (headless, offline) through Specctra DSN/SES, GND pours on both outer layers
//      (a 4-layer board: inner planes go in before routing, and each SMD pad on a plane's net gets a via),
//   5. JLCPCB design rules and net classes written into the project, DRC with schematic parity.
// The routed board is written to modules/<id>/kicad/<id>.kicad_pcb (KiCad owns it from then on).
//
// A board that is all buses (power distribution) is not autorouted: with `route: "scripted"` its pcb spec
// gives every part a position and draws the copper itself (zones on any net and layer, tracks, vias,
// zone keep-outs, silkscreen text), and step 4 becomes kicad_pcb.py's `copper` command. DRC with parity
// stays the gate: a pad the script did not reach is an unconnected item.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDrc, type DrcSummary } from "../kicad/drc.ts";
import { footprintPath, parseNetlistXml } from "../kicad/netlist-xml.ts";
import { buildDir, kicadDir, paths } from "../lib/paths.ts";
import { loadProjectYaml } from "../module/load.ts";
import { JLCPCB, statusAtLeast } from "../module/schema.ts";
import { padPos, placeParts, type FootprintGeom, type Placement, type Rect } from "./place.ts";
import { freeroute, kicadPy } from "./tools.ts";

/** JLCPCB 2-layer limits with margin (docs/jlcpcb.md §9), written into the project's rules. */
export const PCB_RULES = {
  min_clearance: 0.15,
  min_track_width: 0.15,
  min_via_diameter: 0.5,
  min_via_annular_width: 0.1,
  min_through_hole_diameter: 0.3,
  min_hole_clearance: 0.25,
  min_hole_to_hole: 0.5,
  min_copper_edge_clearance: 0.3,
  min_text_height: 0.8,
  min_text_thickness: 0.1,
} as const;

/** JLCPCB's multilayer limits with margin (docs/jlcpcb.md §9, "Four-layer boards"). Outer tracks, vias and
 *  annular rings may be finer on 4 layers than on 2, so the 2-layer values stay. The one limit that is tighter is
 *  hole to copper on the inner layers: 0.3 mm from a plated through-hole, 0.2 mm from a via hole. */
export const PCB_RULES_4 = { ...PCB_RULES, min_hole_clearance: 0.35 } as const;

/** The design rules of a board with this many copper layers. */
export const pcbRules = (copperLayers: 2 | 4) => (copperLayers === 4 ? PCB_RULES_4 : PCB_RULES);

export interface NetClass {
  name: string;
  track: number;
  clearance: number;
  via: number;
  drill: number;
  nets: string[];
}

export type OuterLayer = "F.Cu" | "B.Cu";
/** The inner copper of a 4-layer board. */
export type InnerLayer = "In1.Cu" | "In2.Cu";
export type CuLayer = OuterLayer | InnerLayer;
export const INNER_LAYERS: readonly InnerLayer[] = ["In1.Cu", "In2.Cu"];
const isInner = (layer: string) => (INNER_LAYERS as readonly string[]).includes(layer);
export interface Pt {
  x: number;
  y: number;
}
/** A rectangle or a polygon, in the spec's coordinates (the same as `outline` and `fixed`). */
export type Shape = Rect | Pt[];

/** A copper zone on one net and one layer. */
export interface ZoneSpec {
  net: string;
  layer: CuLayer;
  shape: Shape;
  /** Where zones overlap on a layer, the higher priority fills first (default 0). */
  priority?: number;
  /** How pads of the zone's net join it: "tht-thermal" (thermal reliefs on through-hole pads, solid on
   *  SMD pads; the default), "solid" (no reliefs: least resistance, harder to solder by hand) or "thermal". */
  pads?: "tht-thermal" | "solid" | "thermal";
  /** Clearance to other nets and minimum width of the fill, mm (default: `pour`). */
  clearance?: number;
  minWidth?: number;
}
export interface TrackSpec {
  net: string;
  layer: CuLayer;
  width: number;
  /** At least two points; consecutive points are joined by straight segments. */
  points: Pt[];
}
export interface ViaSpec {
  net: string;
  at: Pt;
  diameter: number;
  drill: number;
}
/** A zone of the autorouted flow: a plane (before routing, an inner layer of a 4-layer board) or a pour (after
 *  routing, an outer layer). Without a shape it covers the board, `pour.edgeClearance` inside the edge. */
export interface PlaneSpec {
  net: string;
  layer: CuLayer;
  shape?: Shape;
  priority?: number;
  pads?: ZoneSpec["pads"];
  clearance?: number;
  minWidth?: number;
}
/** The via and track that join an SMD pad to its plane on a 4-layer board (one per pad, placed beside it). */
export interface PlaneViaSpec {
  diameter: number;
  drill: number;
  /** Width of the track from the pad to its via. */
  track: number;
  /** Space kept to other pads, vias and the board edge, mm. */
  clearance: number;
}
export const PLANE_VIA: PlaneViaSpec = { diameter: 0.6, drill: 0.3, track: 0.3, clearance: 0.2 };

/** An area no zone fills, on the given layers (around an unplated mounting hole, under a screw head). */
export interface KeepoutSpec {
  shape: Shape;
  layers: CuLayer[];
}
export type SilkLayer = "F.SilkS" | "B.SilkS";
export interface SilkText {
  text: string;
  /** Centre of the text. */
  at: Pt;
  /** Text height, mm. */
  size: number;
  rot?: 0 | 90 | 180 | 270;
  layer?: SilkLayer;
}
/** A silkscreen drawing of a scripted layout: a logo, a rule, a pattern. Drawn where the spec says, on
 *  either side: what goes on the back is mirrored by the spec, so it reads from there. */
export type SilkArt =
  | { kind: "line"; a: Pt; b: Pt; width: number; layer?: SilkLayer }
  /** A circle line of the given stroke width. */
  | { kind: "ring"; c: Pt; r: number; width: number; layer?: SilkLayer }
  /** A filled disc. */
  | { kind: "dot"; c: Pt; r: number; layer?: SilkLayer }
  /** A filled polygon. */
  | { kind: "poly"; pts: Pt[]; layer?: SilkLayer };
/** JLCPCB's silkscreen minimums, mm: line width and text height (docs/jlcpcb.md §9). */
export const SILK_MIN = { line: 0.15, text: 1 } as const;
/** The copper of a scripted layout. */
export interface CopperSpec {
  zones: ZoneSpec[];
  tracks?: TrackSpec[];
  vias?: ViaSpec[];
  keepouts?: KeepoutSpec[];
}

export interface PcbSpec {
  /** Board outline in the spec's coordinates (mm, y down). */
  outline: Rect;
  /** Spec → board coordinates (keeps the board on the drawing sheet). */
  offset: { x: number; y: number };
  smdSide: "top" | "bottom";
  /** Parts placed by hand (spec coordinates of the footprint anchor). */
  fixed: Record<string, Placement>;
  order?: string[];
  /** Parts with a courtyard larger than this (mm²) are placed after `order`, the largest first. */
  largeFirst?: number;
  near?: Record<string, string>;
  keepouts?: Rect[];
  /** Areas the placer keeps given parts in (an isolated section, a functional block): each listed part's
   *  courtyard lies inside its area. A part is listed in one area at most; unlisted parts go anywhere. */
  regions?: { rect: Rect; refs: string[] }[];
  netClasses: NetClass[];
  /** Courtyards of placed parts stay this far inside the board edge, mm (default 0.25). */
  edge?: number;
  /** Space the placer keeps between courtyards, mm (default 0.2): more leaves room for tracks and plane vias. */
  spacing?: number;
  pour: { clearance: number; minWidth: number; edgeClearance: number };
  /** Freerouting passes per run, and runs before giving up (results differ between runs). */
  passes?: number;
  attempts?: number;
  /** Minutes one Freerouting run may take (default 15): a large board needs more. */
  routeMinutes?: number;
  /** Planes of a 4-layer board (autorouted flow): zones on In1.Cu or In2.Cu, one net each, put in before
   *  routing. Freerouting routes on the outer layers only and reaches a plane through the via that each SMD pad on
   *  the plane's net gets (`planeVia`); through-hole pads join the plane directly. */
  planes?: PlaneSpec[];
  /** Zones added after routing (autorouted flow) instead of the default GND pours on F.Cu and B.Cu over the
   *  whole board: for a board with more than one ground, such as one with an isolated section. */
  pours?: PlaneSpec[];
  /** Size of the vias that join SMD pads to their planes (default PLANE_VIA). */
  planeVia?: Partial<PlaneViaSpec>;
  /** Where the plane vias of a part (by reference) are tried first, instead of straight out from its centre:
   *  "inward", under its own body (a 0.5 mm pitch row whose plane pins alternate with signal pins, where vias
   *  outside the row would box the signal pins in); "diagonal", out at 45° (a corner pin between two pins of
   *  another net, where a via straight out would squeeze its neighbour's track). Needs planes. */
  planeViaFirst?: Record<string, "inward" | "diagonal">;
  /** Inner layers of a 4-layer board that Freerouting routes on (typed "signal" instead of "power"): no plane
   *  there, but a pour may fill it after routing. */
  signalInner?: InnerLayer[];
  /** Areas no track, via or zone enters, on the given layers (autorouted flow): an isolation gap between two
   *  domains. Freerouting gets them as keep-outs; pads and footprints stay allowed, so a part may straddle one. */
  routeKeepouts?: KeepoutSpec[];
  /** Custom DRC rules (KiCad .kicad_dru text), written beside the board as <id>.kicad_dru: the DRC gate checks
   *  them, for example a clearance between the net classes of an isolated section and the rest. */
  drcRules?: string;
  /** How the copper is made. "freerouting" (the default): the autorouter, then GND pours on both layers.
   *  "scripted": no autorouter; every part has a position in `fixed` and `copper` draws every zone, track
   *  and via (a board that is all buses). */
  route?: "freerouting" | "scripted";
  /** The copper of a scripted layout (`route: "scripted"`). */
  copper?: CopperSpec;
  /** Silkscreen text of a scripted layout: rail names, pin-1 legends. */
  silk?: SilkText[];
  /** Silkscreen drawings of a scripted layout: a logo, a pattern. */
  art?: SilkArt[];
  /** Parts whose pads join their zones without thermal reliefs (terminals and inductors that carry a whole
   *  rail), by reference; or one pad of a part as "REF.PAD" (a pad that tracks beside it would leave with a
   *  single thermal spoke, thermal vias). Both flows: the autorouted one applies them before its pours fill. */
  solidPads?: string[];
  /** Overrides of PCB_RULES for this board, for example wider clearances so it suits 2 oz copper. */
  rules?: Partial<Record<keyof typeof PCB_RULES, number>>;
}

export interface PcbReport {
  board: string;
  placed: number;
  placeSeconds: number;
  /** Connections still open after routing, as KiCad's DRC counts them (planes filled); -1 when not routed. */
  unrouted: number;
  /** Freerouting's own count at its last pass (autorouted flow; it does not see the planes' fill). */
  routerOpen?: number;
  /** Routing runs until the board was clean (or the limit). */
  attempts: number;
  drc: DrcSummary;
  problems: string[];
}

const split = (fp: string) => {
  const i = fp.indexOf(":");
  return { lib: fp.slice(0, i), name: fp.slice(i + 1) };
};

const isRect = (s: Shape): s is Rect => !Array.isArray(s);

/** A shape's corner points in board coordinates (the spec's plus `off`), as [x, y] pairs. */
function boardPoints(shape: Shape, off: { x: number; y: number }): [number, number][] {
  const pts: Pt[] = isRect(shape)
    ? [{ x: shape.x0, y: shape.y0 }, { x: shape.x1, y: shape.y0 }, { x: shape.x1, y: shape.y1 }, { x: shape.x0, y: shape.y1 }]
    : shape;
  if (pts.length < 3) throw new Error("pcb spec: a zone or keep-out polygon needs at least 3 points");
  return pts.map((p) => [p.x + off.x, p.y + off.y]);
}

/** A layer checked against the board: In1.Cu and In2.Cu exist on a 4-layer board only. */
function onBoard<L extends CuLayer>(layer: L, copperLayers: 2 | 4, what: string): L {
  if (!["F.Cu", "B.Cu", ...INNER_LAYERS].includes(layer)) throw new Error(`pcb spec: ${what} on "${layer}", which is no copper layer`);
  if (copperLayers === 2 && isInner(layer)) {
    throw new Error(`pcb spec: ${what} on ${layer}, but the board has 2 copper layers (module.yaml pcb.layers: 4 for inner layers)`);
  }
  return layer;
}

/** A net name checked against the netlist (KiCad names a labelled net "/NAME"). */
function netChecker(nets: string[]) {
  const known = new Set(nets);
  return (name: string, what: string) => {
    if (!known.has(name)) throw new Error(`pcb spec: ${what} on net "${name}", which is not in the netlist (a labelled net is named "/NAME")`);
    return name;
  };
}

/** A net's name on the board. The XML netlist unescapes a "/" in a pin name ("unconnected-(U39-SDO/~{ALARM}-Pad15)")
 *  that the schematic, and so DRC's parity check, writes as "{slash}" (KiCad's EscapeString for net names; "/" is
 *  the sheet separator). Only the automatic names "Net-(…)" and "unconnected-(…)" carry pin names. */
/** Freerouting 2.4.1 is deterministic: the same DSN routes to the same board on every run (2026-11-14, two runs
 *  identical pass by pass). So each attempt after the first prices a via differently (Freerouting's default is 50),
 *  and the attempts try different boards. */
export const ATTEMPT_VIA_COSTS: readonly (number | undefined)[] = [undefined, 35, 70, 25, 100];
/** The extra Freerouting settings of routing attempt `attempt` (1, 2, ...). */
export function routerArgs(attempt: number): string[] {
  const v = ATTEMPT_VIA_COSTS[(attempt - 1) % ATTEMPT_VIA_COSTS.length];
  return v === undefined ? [] : [`--router.scoring.via_costs=${v}`];
}

export function boardNetName(name: string): string {
  const m = /^(.*?)((?:Net|unconnected)-\()(.*)\)$/.exec(name);
  return m ? `${m[1]}${m[2]}${m[3]!.replaceAll("/", "{slash}")})` : name;
}

/** The whole board, `inset` inside its edge (the spec's coordinates). */
const boardRect = (o: Rect, inset: number): Rect => ({ x0: o.x0 + inset, y0: o.y0 + inset, x1: o.x1 - inset, y1: o.y1 - inset });

/** Planes, pours and plane vias of the autorouted flow as kicad_pcb.py's `build` and `ses` read them (board
 *  coordinates). Planes go on inner layers only: an outer plane before routing would be copper Freerouting routes
 *  through. */
export function planesJob(spec: PcbSpec, nets: string[], copperLayers: 2 | 4) {
  const net = netChecker(nets);
  const zone = (z: PlaneSpec, what: string) => ({
    net: net(z.net, what), layer: onBoard(z.layer, copperLayers, what),
    points: boardPoints(z.shape ?? boardRect(spec.outline, spec.pour.edgeClearance), spec.offset),
    ...(z.priority !== undefined && { priority: z.priority }), ...(z.pads && { pads: z.pads }),
    ...(z.clearance !== undefined && { clearance: z.clearance }), ...(z.minWidth !== undefined && { minWidth: z.minWidth }),
  });
  const signalInner = spec.signalInner ?? [];
  if (signalInner.length && copperLayers !== 4) throw new Error("pcb spec: signalInner needs a 4-layer board");
  const planes = (spec.planes ?? []).map((z) => {
    if (!isInner(z.layer)) throw new Error(`pcb spec: a plane on ${z.layer}; planes go on In1.Cu or In2.Cu, where Freerouting does not route (outer zones are pours)`);
    if ((signalInner as string[]).includes(z.layer)) throw new Error(`pcb spec: a plane on ${z.layer}, which signalInner gives to the router (a pour fills it after routing)`);
    return zone(z, "a plane");
  });
  const viaFirst = spec.planeViaFirst ?? {};
  if (Object.keys(viaFirst).length && planes.length === 0) throw new Error("pcb spec: planeViaFirst needs planes (it places plane vias)");
  for (const [ref, mode] of Object.entries(viaFirst)) {
    if (mode !== "inward" && mode !== "diagonal") throw new Error(`pcb spec: planeViaFirst.${ref} is "${mode}"; use "inward" or "diagonal"`);
  }
  const via = { ...PLANE_VIA, ...spec.planeVia };
  if (!(via.drill > 0 && via.diameter > via.drill && via.track > 0 && via.clearance > 0)) {
    throw new Error("pcb spec: planeVia needs drill > 0, diameter > drill, track > 0 and clearance > 0");
  }
  const routeKeepouts = (spec.routeKeepouts ?? []).map((k) => {
    for (const layer of k.layers) onBoard(layer, copperLayers, "a route keep-out");
    return { layers: k.layers, points: boardPoints(k.shape, spec.offset) };
  });
  return {
    planes,
    ...(spec.pours && { pours: spec.pours.map((z) => zone(z, "a pour")) }),
    ...(planes.length > 0 && { planeVia: via }),
    ...(Object.keys(viaFirst).length && { planeViaFirst: viaFirst }),
    ...(routeKeepouts.length > 0 && { routeKeepouts }),
    ...(signalInner.length > 0 && { signalInner }),
    ...(spec.solidPads?.length && { solidPads: spec.solidPads }),
  };
}

/** The scripted copper as kicad_pcb.py's `copper` command reads it: board coordinates, every net checked
 *  against the netlist (KiCad names a labelled net "/NAME"), every part reference against `refs`, every layer
 *  against the board's copper layers. */
export function copperJob(spec: PcbSpec, nets: string[], refs: string[], copperLayers: 2 | 4 = 2) {
  const copper = spec.copper;
  if (!copper) throw new Error('pcb spec: route "scripted" needs `copper` (zones, tracks, vias)');
  const off = spec.offset;
  const net = netChecker(nets);
  for (const z of copper.zones) onBoard(z.layer, copperLayers, `a zone on net "${z.net}"`);
  for (const t of copper.tracks ?? []) onBoard(t.layer, copperLayers, `a track on net "${t.net}"`);
  for (const k of copper.keepouts ?? []) for (const layer of k.layers) onBoard(layer, copperLayers, "a keep-out");
  for (const entry of spec.solidPads ?? []) {
    const ref = entry.split(".")[0]!;
    if (!refs.includes(ref)) throw new Error(`pcb spec: solidPads names ${ref}, which is not in the netlist`);
  }
  for (const t of copper.tracks ?? []) if (t.points.length < 2) throw new Error(`pcb spec: a track on net "${t.net}" needs at least 2 points`);
  // What JLCPCB prints (docs/jlcpcb.md §9): finer lines and smaller letters come out broken or not at all.
  for (const t of spec.silk ?? []) {
    if (t.size < SILK_MIN.text) throw new Error(`pcb spec: silkscreen text "${t.text}" is ${t.size} mm high; JLCPCB prints from ${SILK_MIN.text} mm`);
  }
  for (const a of spec.art ?? []) {
    const fine = a.kind === "dot" ? 2 * a.r : a.kind === "poly" ? SILK_MIN.line : a.width;
    if (fine < SILK_MIN.line) throw new Error(`pcb spec: a silkscreen ${a.kind} is ${fine} mm wide; JLCPCB prints from ${SILK_MIN.line} mm`);
    if (a.kind === "poly" && a.pts.length < 3) throw new Error("pcb spec: a silkscreen polygon needs at least 3 points");
  }
  const at = (p: Pt): [number, number] => [p.x + off.x, p.y + off.y];
  return {
    solidPads: spec.solidPads ?? [],
    copper: {
      zones: copper.zones.map((z) => ({
        net: net(z.net, "a zone"), layer: z.layer, points: boardPoints(z.shape, off),
        ...(z.priority !== undefined && { priority: z.priority }), ...(z.pads && { pads: z.pads }),
        ...(z.clearance !== undefined && { clearance: z.clearance }), ...(z.minWidth !== undefined && { minWidth: z.minWidth }),
      })),
      tracks: (copper.tracks ?? []).map((t) => ({ net: net(t.net, "a track"), layer: t.layer, width: t.width, points: t.points.map((p) => [p.x + off.x, p.y + off.y]) })),
      vias: (copper.vias ?? []).map((v) => ({ net: net(v.net, "a via"), x: v.at.x + off.x, y: v.at.y + off.y, diameter: v.diameter, drill: v.drill })),
      keepouts: (copper.keepouts ?? []).map((k) => ({ layers: k.layers, points: boardPoints(k.shape, off) })),
    },
    silk: (spec.silk ?? []).map((t) => ({ text: t.text, x: t.at.x + off.x, y: t.at.y + off.y, size: t.size, ...(t.rot && { rot: t.rot }), ...(t.layer && { layer: t.layer }) })),
    art: (spec.art ?? []).map((a) => ({
      kind: a.kind,
      ...(a.layer && { layer: a.layer }),
      ...(a.kind === "line" && { a: at(a.a), b: at(a.b), width: a.width }),
      ...(a.kind === "ring" && { c: at(a.c), r: a.r, width: a.width }),
      ...(a.kind === "dot" && { c: at(a.c), r: a.r }),
      ...(a.kind === "poly" && { points: a.pts.map(at) }),
    })),
  };
}

/** KiCad's name of the copper finish and of each solder-mask colour (Board Setup → Physical Stackup). */
const MASK_NAME = { green: "Green", black: "Black" } as const;

/** The board file with a physical stackup that names the mask colour, so KiCad's 3D view and the renders
 *  show the board as ordered (white print on a black mask). A green board gets none: it stays as KiCad
 *  writes a new board. KiCad's Python cannot set a stackup, so it goes into the file as text, in the form
 *  pcbnew 10.0.6 saves it; the Python steps that follow load and save it unchanged. */
export function withStackup(boardText: string, o: { mask: keyof typeof MASK_NAME; thicknessMm: number; copperOz?: number; layers?: 2 | 4 }): string {
  if (o.layers === 4) return withStackup4(boardText, o);
  if (o.mask === "green") return boardText;
  if (boardText.includes("\t\t(stackup\n")) throw new Error("the board already has a stackup");
  const anchor = "\t(setup\n";
  if (boardText.split(anchor).length !== 2) throw new Error("the board has no (setup …) block to put the stackup into");
  const cu = 0.035 * (o.copperOz ?? 1);
  const maskT = 0.01;
  const core = Math.round((o.thicknessMm - 2 * cu - 2 * maskT) * 1e4) / 1e4;
  const layer = (name: string, type: string, ...more: string[]) =>
    [`\t\t\t(layer "${name}"`, `\t\t\t\t(type "${type}")`, ...more.map((m) => `\t\t\t\t${m}`), "\t\t\t)"].join("\n");
  const colour = `(color "${MASK_NAME[o.mask]}")`;
  const stackup = [
    "\t\t(stackup",
    layer("F.SilkS", "Top Silk Screen", '(color "White")'),
    layer("F.Paste", "Top Solder Paste"),
    layer("F.Mask", "Top Solder Mask", colour, `(thickness ${maskT})`),
    layer("F.Cu", "copper", `(thickness ${cu})`),
    layer("dielectric 1", "core", `(thickness ${core})`, '(material "FR4")', "(epsilon_r 4.5)", "(loss_tangent 0.02)"),
    layer("B.Cu", "copper", `(thickness ${cu})`),
    layer("B.Mask", "Bottom Solder Mask", colour, `(thickness ${maskT})`),
    layer("B.Paste", "Bottom Solder Paste"),
    layer("B.SilkS", "Bottom Silk Screen", '(color "White")'),
    '\t\t\t(copper_finish "HAL lead-free")',
    "\t\t\t(dielectric_constraints no)",
    "\t\t)",
  ].join("\n");
  return boardText.replace(anchor, `${anchor}${stackup}\n`);
}

/** A 4-layer board always gets its stackup, green or black: JLCPCB's JLC04161H-7628 (JLCPCB.stackup4), so the
 *  board file, the Gerber job file and the 3D view show the layers as ordered. Written in the form pcbnew 10.0.6
 *  saves it (a load and save leaves it byte-identical, checked 2026-11-12). Epsilon of the core: the
 *  capabilities page gives 4.5 for FR-4 (2-layer) and 4.4 for 7628 prepreg; the core's own value is not stated. */
function withStackup4(boardText: string, o: { mask: keyof typeof MASK_NAME; thicknessMm: number; copperOz?: number }): string {
  const s = JLCPCB.stackup4;
  if (o.thicknessMm !== s.thicknessMm || (o.copperOz ?? s.outerOz) !== s.outerOz) {
    throw new Error(`a 4-layer board is built on ${s.name}: ${s.thicknessMm} mm and ${s.outerOz} oz outer copper (${s.source}); this one is ${o.thicknessMm} mm, ${o.copperOz ?? s.outerOz} oz`);
  }
  if (boardText.includes("\t\t(stackup\n")) throw new Error("the board already has a stackup");
  const anchor = "\t(setup\n";
  if (boardText.split(anchor).length !== 2) throw new Error("the board has no (setup …) block to put the stackup into");
  if (!boardText.includes('(4 "In1.Cu"') || !boardText.includes('(6 "In2.Cu"')) throw new Error("the board has no inner copper layers for a 4-layer stackup");
  const layer = (name: string, type: string, ...more: string[]) =>
    [`\t\t\t(layer "${name}"`, `\t\t\t\t(type "${type}")`, ...more.map((m) => `\t\t\t\t${m}`), "\t\t\t)"].join("\n");
  const colour = `(color "${MASK_NAME[o.mask]}")`;
  const maskT = "(thickness 0.01)";
  const prepreg = (n: number) =>
    layer(`dielectric ${n}`, "prepreg", `(thickness ${s.prepreg.mm})`, `(material "${s.prepreg.name}")`, `(epsilon_r ${s.prepreg.epsilonR})`, "(loss_tangent 0.02)");
  const stackup = [
    "\t\t(stackup",
    layer("F.SilkS", "Top Silk Screen", '(color "White")'),
    layer("F.Paste", "Top Solder Paste"),
    layer("F.Mask", "Top Solder Mask", colour, maskT),
    layer("F.Cu", "copper", `(thickness ${s.copperMm.outer})`),
    prepreg(1),
    layer("In1.Cu", "copper", `(thickness ${s.copperMm.inner})`),
    layer("dielectric 2", "core", `(thickness ${s.coreMm})`, '(material "FR4")', "(epsilon_r 4.5)", "(loss_tangent 0.02)"),
    layer("In2.Cu", "copper", `(thickness ${s.copperMm.inner})`),
    prepreg(3),
    layer("B.Cu", "copper", `(thickness ${s.copperMm.outer})`),
    layer("B.Mask", "Bottom Solder Mask", colour, maskT),
    layer("B.Paste", "Bottom Solder Paste"),
    layer("B.SilkS", "Bottom Silk Screen", '(color "White")'),
    '\t\t\t(copper_finish "HAL lead-free")',
    "\t\t\t(dielectric_constraints no)",
    "\t\t)",
  ].join("\n");
  return boardText.replace(anchor, `${anchor}${stackup}\n`);
}

/** KiCad's drawing sheets, smallest first (mm, landscape). */
const PAPERS: [string, number, number][] = [["A4", 297, 210], ["A3", 420, 297], ["A2", 594, 420], ["A1", 841, 594], ["A0", 1189, 841]];

/** The smallest sheet that holds the board where the spec puts it (a new board is on A4). */
export function paperFor(spec: PcbSpec): string {
  const [x, y] = [spec.outline.x1 + spec.offset.x, spec.outline.y1 + spec.offset.y];
  return (PAPERS.find(([, w, h]) => x <= w - 10 && y <= h - 10) ?? PAPERS.at(-1)!)[0];
}

/** Merge the rules and net classes into the project file (other settings stay as KiCad wrote them). */
export function writeProjectRules(pro: string, spec: PcbSpec, copperLayers: 2 | 4 = 2) {
  const d = JSON.parse(readFileSync(pro, "utf8"));
  d.board ??= {};
  d.board.design_settings ??= {};
  d.board.design_settings.rules = { ...(d.board.design_settings.rules ?? {}), ...pcbRules(copperLayers), ...(spec.rules ?? {}) };
  d.net_settings ??= { classes: [], meta: { version: 5 } };
  const base = d.net_settings.classes.find((c: { name: string }) => c.name === "Default") ?? {};
  d.net_settings.classes = [
    ...d.net_settings.classes.filter((c: { name: string }) => !spec.netClasses.some((n) => n.name === c.name)),
    ...spec.netClasses.map((n, i) => ({
      ...base, name: n.name, track_width: n.track, clearance: n.clearance, via_diameter: n.via, via_drill: n.drill, priority: i,
    })),
  ];
  d.net_settings.netclass_patterns = spec.netClasses.filter((n) => n.name !== "Default").flatMap((n) => n.nets.map((net) => ({ netclass: n.name, pattern: net })));
  writeFileSync(pro, `${JSON.stringify(d, null, 2)}\n`);
}

/** Where runPcb reads and writes; the defaults are the board's folders in the repo (tests use temp folders). */
export interface PcbDirs {
  /** module.yaml (default modules/<id>/module.yaml). */
  moduleYaml?: string;
  /** The KiCad project folder with <id>.kicad_pro, where the board is written (default modules/<id>/kicad). */
  kicadDir?: string;
  /** The build folder with <id>.net.xml from `bun run sch`; the work goes to its pcb/ (default build/<id>). */
  buildDir?: string;
  configHome?: string;
}

export async function runPcb(id: string, spec: PcbSpec, o: { route?: boolean } & PcbDirs = {}): Promise<PcbReport> {
  const m = loadProjectYaml(o.moduleYaml ?? join(paths.modules, id, "module.yaml"));
  if (!statusAtLeast(m.revision.status, "schematic-approved")) {
    throw new Error(`${id}: the schematic is not approved (module.yaml status ${m.revision.status}); layout starts after sch:approve`);
  }
  const build = o.buildDir ?? buildDir(id);
  const kicad = o.kicadDir ?? kicadDir(id);
  const py = (args: string[]) => kicadPy(args, o.configHome ? { configHome: o.configHome } : {});
  const netXml = join(build, `${id}.net.xml`);
  if (!existsSync(netXml)) throw new Error(`${netXml} missing: run bun run sch -- ${id}`);
  const net = parseNetlistXml(readFileSync(netXml, "utf8"));
  for (const n of net.nets) n.name = boardNetName(n.name);
  const work = join(build, "pcb");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  // Footprint geometry.
  const fps = [...new Set(net.components.map((c) => c.footprint))];
  writeFileSync(join(work, "info-in.json"), JSON.stringify({ libDir: join(paths.libKicad, "footprints"), footprints: fps.map(split) }));
  await py(["info", join(work, "info-in.json"), join(work, "info.json")]);
  const info: Record<string, FootprintGeom> = JSON.parse(readFileSync(join(work, "info.json"), "utf8"));
  const geom: Record<string, FootprintGeom> = Object.fromEntries(net.components.map((c) => [c.ref, info[c.footprint]!]));
  const pads: Record<string, Record<string, string>> = {};
  for (const n of net.nets) for (const node of n.nodes) (pads[node.ref] ??= {})[node.pin] = n.name;

  // Fixed parts from the spec, the rest placed.
  const fixed: Record<string, Placement> = { ...spec.fixed };
  const scripted = spec.route === "scripted";
  const copperLayers = m.pcb.layers;
  if (!scripted && (spec.copper || spec.silk || spec.art)) throw new Error('pcb spec: copper, silk and art belong to a scripted layout (route: "scripted")');
  if (scripted && (spec.planes || spec.pours || spec.planeVia || spec.routeKeepouts || spec.signalInner)) throw new Error("pcb spec: planes, pours, planeVia, routeKeepouts and signalInner belong to the autorouted flow; a scripted layout draws its zones in `copper.zones` and its keep-outs in `copper.keepouts`, on any layer");
  const smd = net.components.filter((c) => !(c.ref in fixed) && geom[c.ref]!.pads.every((p) => p.smd)).map((c) => c.ref);
  const unplaceable = net.components.filter((c) => !(c.ref in fixed) && !smd.includes(c.ref)).map((c) => c.ref);
  if (unplaceable.length) throw new Error(`through-hole parts without a position: ${unplaceable.join(", ")} (add them to the pcb spec's fixed placements)`);
  // A scripted layout draws its copper around known positions: nothing is left to the placer.
  if (scripted && smd.length) throw new Error(`scripted layout: parts without a position: ${smd.join(", ")} (every part goes into the pcb spec's fixed placements)`);
  const netNames = net.nets.map((n) => n.name);
  const refs = new Set(net.components.map((c) => c.ref));
  const strays = (spec.regions ?? []).flatMap((r) => r.refs).filter((r) => !refs.has(r));
  if (strays.length) throw new Error(`pcb spec: regions name parts that are not in the netlist: ${strays.join(", ")}`);
  const scriptedJob = scripted ? copperJob(spec, netNames, net.components.map((c) => c.ref), copperLayers) : null;
  const planeJob = scripted ? null : planesJob(spec, netNames, copperLayers);
  const t0 = performance.now();
  const placed = placeParts({
    outline: spec.outline, geom, pads, fixed, place: smd, side: spec.smdSide,
    ...(spec.order && { order: spec.order }), ...(spec.largeFirst !== undefined && { largeFirst: spec.largeFirst }),
    ...(spec.near && { near: spec.near }), ...(spec.keepouts && { keepouts: spec.keepouts }),
    ...(spec.regions && { regions: spec.regions }),
    ...(spec.edge !== undefined && { edge: spec.edge }),
    ...(spec.spacing !== undefined && { spacing: spec.spacing }),
    lightNets: spec.netClasses.filter((c) => c.name !== "Default").flatMap((c) => c.nets),
    // A plane's net costs nothing: each of its SMD pads gets its own via to the plane (fanout).
    ...(spec.planes?.length && { freeNets: [...new Set(spec.planes.map((p) => p.net))] }),
  });
  if (placed.failed.length) throw new Error(`no room on the board for: ${placed.failed.join(", ")}`);
  const placeMs = performance.now() - t0;

  // Board.
  const board = join(work, `${id}.kicad_pcb`);
  copyFileSync(join(kicad, `${id}.kicad_pro`), join(work, `${id}.kicad_pro`));
  writeProjectRules(join(work, `${id}.kicad_pro`), spec, copperLayers);
  const off = spec.offset;
  const job = {
    board,
    libDir: join(paths.libKicad, "footprints"),
    sheetfile: `${id}.kicad_sch`,
    nets: netNames,
    outline: { x0: spec.outline.x0 + off.x, y0: spec.outline.y0 + off.y, x1: spec.outline.x1 + off.x, y1: spec.outline.y1 + off.y },
    pour: spec.pour,
    // A 2-layer job stays as it was (no copperLayers key), so the 2-layer path is unchanged.
    ...(copperLayers === 4 && { copperLayers }),
    ...(scriptedJob ?? {}),
    ...(planeJob && (planeJob.planes.length > 0 || planeJob.pours || planeJob.routeKeepouts || planeJob.signalInner || planeJob.solidPads) ? planeJob : {}),
    footprints: net.components.map((c) => {
      const at = placed.placements[c.ref]!;
      const fields = Object.fromEntries(Object.entries(c.fields).filter(([k]) => k !== "Footprint"));
      // A part on a page of a hierarchical schematic: the sheet path in front of the symbol, the page's sheet name and
      // file (a root-sheet part keeps the job as it was).
      const onPage = c.sheetpath.tstamps !== "" && c.sheetpath.tstamps !== "/";
      const sheet = onPage ? { path: footprintPath(c), sheetname: c.sheetpath.names, sheetfile: c.properties.Sheetfile ?? "" } : {};
      return { ...split(c.footprint), ref: c.ref, value: c.value, uuid: c.tstamps[0], ...sheet, fields, pads: pads[c.ref] ?? {}, x: at.x + off.x, y: at.y + off.y, rot: at.rot, side: at.side };
    }),
  };
  writeFileSync(join(work, "job.json"), JSON.stringify(job, null, 1));
  await py(["build", join(work, "job.json")]);
  // The mask colour of module.yaml, as a stackup in the board file (nothing for a green 2-layer board; a 4-layer
  // board always gets JLCPCB's stackup).
  writeFileSync(board, withStackup(readFileSync(board, "utf8"), {
    mask: m.pcb.mask, thicknessMm: m.pcb.thicknessMm, copperOz: m.pcb.copperOz, ...(copperLayers === 4 && { layers: 4 as const }),
  }));
  // Every SMD pad on a plane's net gets its via to the plane before routing; Freerouting keeps them (they are locked).
  if (planeJob && planeJob.planes.length > 0) await py(["fanout", board, join(work, "job.json")]);
  // The placer's pad positions must be where KiCad put them.
  const actual: Record<string, { number: string; x: number; y: number }[]> = JSON.parse(readFileSync(`${board}.pads.json`, "utf8"));
  for (const c of net.components) {
    const at = placed.placements[c.ref]!;
    for (const p of geom[c.ref]!.pads) {
      const want = padPos(p, { ...at, x: at.x + off.x, y: at.y + off.y });
      const got = actual[c.ref]!.find((q) => q.number === p.number && Math.hypot(q.x - want.x, q.y - want.y) < 0.002);
      if (!got) throw new Error(`${c.ref} pad ${p.number}: KiCad placed it elsewhere than the placer assumed (${want.x.toFixed(3)}, ${want.y.toFixed(3)})`);
    }
  }

  // Routing: Freerouting's result differs between runs, so a run that leaves connections open or
  // fails DRC is repeated from the placed board (up to `attempts`).
  const dest = join(kicad, `${id}.kicad_pcb`);
  writeProjectRules(join(kicad, `${id}.kicad_pro`), spec, copperLayers);
  if (spec.drcRules !== undefined) {
    for (const dir of [kicad, work]) writeFileSync(join(dir, `${id}.kicad_dru`), spec.drcRules.endsWith("\n") ? spec.drcRules : `${spec.drcRules}\n`);
  }
  const placedBoard = join(work, `${id}-placed.kicad_pcb`);
  copyFileSync(board, placedBoard);
  // Freerouting's own count of open connections; it does not see the planes' fill, so a board whose planes join
  // everything can still have some by its count. KiCad's DRC after the fill is what counts (drc.unconnected).
  let routerOpen = -1;
  let drc: Awaited<ReturnType<typeof runDrc>> | undefined;
  if (scripted) {
    // No autorouter: the spec's zones, tracks, vias, silkscreen text and drawings, filled by KiCad. One
    // run, and the same result every time.
    if (o.route !== false) await py(["copper", board, join(work, "job.json")]);
    // A new board is on an A4 sheet; a long board gets the sheet that holds it (the drawing frame only).
    writeFileSync(board, readFileSync(board, "utf8").replace('(paper "A4")', `(paper "${paperFor(spec)}")`));
    copyFileSync(board, dest);
    const r = await runDrc(dest, join(work, "drc.json"), { parity: true, see: `see ${join("build", id, "pcb", "drc.json")}`, ...(o.configHome && { configHome: o.configHome }) });
    return { board: dest, placed: 0, placeSeconds: placeMs / 1000, unrouted: o.route === false ? -1 : r.summary.unconnected, attempts: 1, drc: r.summary, problems: r.problems };
  }
  const attempts = o.route === false ? 1 : (spec.attempts ?? 4);
  let attempt = 0;
  // The run with the fewest DRC problems so far: if none is clean, the board keeps the best one, not the last.
  const bestBoard = join(work, `${id}-best.kicad_pcb`);
  const bestDrc = join(work, "drc-best.json");
  let best: { attempt: number; drc: Awaited<ReturnType<typeof runDrc>>; routerOpen: number } | undefined;
  for (attempt = 1; attempt <= attempts; attempt++) {
    copyFileSync(placedBoard, board);
    if (o.route !== false) {
      const dsn = join(work, `${id}.dsn`);
      const ses = join(work, `${id}.ses`);
      rmSync(ses, { force: true });
      await py(["dsn", board, dsn]);
      let r: Awaited<ReturnType<typeof freeroute>>;
      try {
        r = await freeroute(dsn, ses, join(work, "freerouting"), spec.passes ?? 40, spec.routeMinutes !== undefined ? spec.routeMinutes * 60_000 : undefined, routerArgs(attempt));
      } catch (e) {
        // A run that ends without a session file (2026-11-14: Freerouting 2.4.1 once quit with exit 0 during its
        // fanout stage) costs only that run: the next one starts afresh, and the best board so far is kept.
        writeFileSync(join(work, `freerouting-${attempt}.log`), String(e instanceof Error ? e.message : e));
        if (attempt < attempts || best) continue;
        throw e;
      }
      writeFileSync(join(work, `freerouting-${attempt}.log`), r.log);
      routerOpen = r.unrouted;
      await py(["ses", board, ses, join(work, "job.json")]);
    }
    // Into the board's KiCad project, then DRC with schematic parity.
    copyFileSync(board, dest);
    drc = await runDrc(dest, join(work, "drc.json"), { parity: true, see: `see ${join("build", id, "pcb", "drc.json")}`, ...(o.configHome && { configHome: o.configHome }) });
    if (o.route === false || drc.problems.length === 0) break;
    if (!best || drc.problems.length < best.drc.problems.length) {
      best = { attempt, drc, routerOpen };
      copyFileSync(dest, bestBoard);
      copyFileSync(join(work, "drc.json"), bestDrc);
    }
  }
  if (o.route !== false && drc!.problems.length > 0 && best && best.drc.problems.length < drc!.problems.length) {
    copyFileSync(bestBoard, dest);
    copyFileSync(bestDrc, join(work, "drc.json"));
    drc = best.drc;
    routerOpen = best.routerOpen;
  }
  const unrouted = o.route === false ? -1 : drc!.summary.unconnected;
  return {
    board: dest, placed: smd.length, placeSeconds: placeMs / 1000, unrouted, routerOpen, attempts: Math.min(attempt, attempts), drc: drc!.summary, problems: drc!.problems,
  };
}
