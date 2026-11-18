// Drawing kit for helmet-driver's schematic.ts: places symbols on pages, knows where their pins land, and draws
// wires between pins and grid points, so the circuits read as wired drawings rather than label lists.
//
// Coordinates are grid units (1 = 1.27 mm), per page. Pins are "<partKey>.<pin number>". Power nets (POWER) are
// never wired: every power pin gets its own power symbol, as on any schematic. Nets that leave a page are joined
// by name (global labels, written by the generator).
import { GRID, libToSheet, type Mirror, type Rot } from "../../tools/kicad/geometry.ts";
import { loadAllParts } from "../../tools/module/load.ts";
import { vendoredId } from "../../tools/module/parts.ts";
import { loadVendored } from "../../tools/sch/build.ts";
import type { DesignInput } from "../../tools/sch/dsl.ts";

export type P = [number, number];
type Parts = DesignInput["parts"];
type Point = string | P;

export const POWER = new Set(["+5V", "+3V3", "+5VA", "+15V", "-15V", "GND", "GND1"]);

const lib = loadVendored();
const partDb = loadAllParts();

export const parts: Parts = {};
export const noConnect: string[] = [];
export const text: { at: P; text: string; size?: number; sheet?: string }[] = [];
const netPins = new Map<string, string[]>();
const netWires = new Map<string, Point[][]>();
const refCount: Record<string, number> = {};
const flags = new Map<string, string>();
/** The pin of a net that carries its PWR_FLAG (it must be an unwired pin). */
export const flagAt = (net: string, pin: string) => void flags.set(net, pin);
const placed = new Map<string, { part: string; units: Map<number, { at: P; rot: Rot; mirror?: Mirror; sheet: string }> }>();
const wireSheet = new Map<Point[], string>();
let curSheet = "";
/** The page that following wires are drawn on. */
export const setPage = (sheet: string) => void (curSheet = sheet);

const nextRef = (prefix: string) => `${prefix}${(refCount[prefix] = (refCount[prefix] ?? 0) + 1)}`;

function symbolOf(part: string) {
  const def = partDb.get(part);
  if (!def) throw new Error(`no part ${part}`);
  const info = lib.symbols.get(vendoredId(def.symbol));
  if (!info) throw new Error(`symbol ${def.symbol} of ${part} is not vendored`);
  return info;
}

export interface PlaceOpts {
  rot?: Rot;
  mirror?: Mirror;
  ref?: string;
}

/** Place a single-unit part on a page. */
export function place(sheet: string, key: string, prefix: string, part: string, value: string, at: P, o: PlaceOpts = {}) {
  if (parts[key]) throw new Error(`part key ${key} used twice`);
  parts[key] = { ref: o.ref ?? nextRef(prefix), part, value, at, ...(o.rot && { rot: o.rot }), ...(o.mirror && { mirror: o.mirror }), sheet } as Parts[string];
  placed.set(key, { part, units: new Map([[1, { at, rot: o.rot ?? 0, ...(o.mirror && { mirror: o.mirror }), sheet }]]) });
}

/** Declare a multi-unit part; units are added with `unit()` on any page. */
export function multi(key: string, prefix: string, part: string, value: string) {
  parts[key] = { ref: nextRef(prefix), part, value, units: {} } as Parts[string];
  placed.set(key, { part, units: new Map() });
}
export function unit(sheet: string, key: string, n: number, at: P, o: { rot?: Rot; mirror?: Mirror } = {}) {
  const p = parts[key] as { units: Record<string, unknown>; sheet?: string };
  p.units[String(n)] = { at, ...(o.rot && { rot: o.rot }), ...(o.mirror && { mirror: o.mirror }), sheet };
  p.sheet ??= sheet;
  placed.get(key)!.units.set(n, { at, rot: o.rot ?? 0, ...(o.mirror && { mirror: o.mirror }), sheet });
}

/** Where a pin lands on its page, in grid units. */
export function pin(ref: string): P {
  const [key, num] = ref.split(".") as [string, string];
  const pl = placed.get(key);
  if (!pl) throw new Error(`pin ${ref}: no part ${key}`);
  const info = symbolOf(pl.part);
  const lp = info.pins.find((p) => p.number === num);
  if (!lp) throw new Error(`pin ${ref}: ${pl.part} has no pin ${num}`);
  const u = pl.units.get(lp.unit === 0 ? 1 : lp.unit) ?? pl.units.get(1);
  if (!u) throw new Error(`pin ${ref}: unit ${lp.unit} of ${key} is not placed yet`);
  const d = libToSheet(lp.at, u.rot, u.mirror);
  return [u.at[0] + d.x / GRID, u.at[1] + d.y / GRID];
}

/** The page a pin is drawn on. */
export function pinSheet(ref: string): string {
  const [key, num] = ref.split(".") as [string, string];
  const pl = placed.get(key);
  if (!pl) throw new Error(`pin ${ref}: no part ${key}`);
  const lp = symbolOf(pl.part).pins.find((p) => p.number === num);
  if (!lp) throw new Error(`pin ${ref}: ${pl.part} has no pin ${num}`);
  const u = pl.units.get(lp.unit === 0 ? 1 : lp.unit) ?? pl.units.get(1);
  if (!u) throw new Error(`pin ${ref}: unit ${lp.unit} of ${key} is not placed`);
  return u.sheet;
}

/** Pin numbers of a placed part's symbol. */
export const pinNumbers = (key: string): string[] => {
  const pl = placed.get(key);
  if (!pl) throw new Error(`no part ${key}`);
  return symbolOf(pl.part).pins.map((p) => p.number);
};

/** Connect pins to a net by name (stub and label or power symbol). */
export function on(net: string, ...pins: string[]) {
  const list = netPins.get(net) ?? [];
  for (const p of pins) if (!list.includes(p)) list.push(p);
  netPins.set(net, list);
}

/** Draw a wire path on net `net`: pins ("key.n") and grid points; pins on the path join the net. Consecutive
 *  points must line up horizontally or vertically. */
export function wire(net: string, ...path: Point[]) {
  if (POWER.has(net)) throw new Error(`power net ${net} is never wired (power symbols instead)`);
  for (const p of path) if (typeof p === "string") on(net, p);
  if (!curSheet) throw new Error("wire before setPage()");
  const list = netWires.get(net) ?? [];
  list.push(path);
  wireSheet.set(path, curSheet);
  netWires.set(net, list);
}

/** An L-shaped wire from pin/point a to pin/point b: horizontal first ("h") or vertical first ("v"). */
export function link(net: string, a: Point, b: Point, first: "h" | "v" = "h") {
  const pa = typeof a === "string" ? pin(a) : a;
  const pb = typeof b === "string" ? pin(b) : b;
  if (pa[0] === pb[0] || pa[1] === pb[1]) return wire(net, a, b);
  const corner: P = first === "h" ? [pb[0], pa[1]] : [pa[0], pb[1]];
  wire(net, a, corner, b);
}

export const nc = (key: string, ...pins: (string | number)[]) => pins.forEach((p) => noConnect.push(`${key}.${p}`));

/** Every placed pin by page and grid point, for pins that a wire reaches by a grid point. */
function pinIndex(): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const [key, pl] of placed) {
    const info = symbolOf(pl.part);
    for (const lp of info.pins) {
      const u = pl.units.get(lp.unit === 0 ? 1 : lp.unit);
      if (!u) continue;
      const d = libToSheet(lp.at, u.rot, u.mirror);
      const k = `${u.sheet}@${u.at[0] + d.x / GRID},${u.at[1] + d.y / GRID}`;
      idx.set(k, [...(idx.get(k) ?? []), `${key}.${lp.number}`]);
    }
  }
  return idx;
}

export function nets(): DesignInput["nets"] {
  // pins a wire reaches through a grid point join its net
  const idx = pinIndex();
  for (const [net, paths] of netWires) {
    for (const path of paths) {
      const sheet = wireSheet.get(path)!;
      for (const p of path) if (typeof p !== "string") for (const ref of idx.get(`${sheet}@${p[0]},${p[1]}`) ?? []) on(net, ref);
    }
  }
  const out: DesignInput["nets"] = {};
  for (const [name, pins] of netPins) {
    const wires = netWires.get(name);
    out[name] = { pins, ...(POWER.has(name) && { power: true }), ...(wires && { wires: wires as never }), ...(flags.has(name) && { flagAt: flags.get(name)! }) };
  }
  return out;
}

// ---- two-pin helpers -------------------------------------------------------------------------------------------

/** A horizontal two-pin part (R, C, L, bead) whose pin 1 lands at `left`. */
export function hPart(sheet: string, key: string, prefix: string, part: string, value: string, left: P, half = 3) {
  place(sheet, key, prefix, part, value, [left[0] + half, left[1]], { rot: 90 });
}
/** A vertical two-pin part (R, C, L, bead) whose pin 1 lands at `top`. */
export function vPart(sheet: string, key: string, prefix: string, part: string, value: string, top: P, half = 3) {
  place(sheet, key, prefix, part, value, [top[0], top[1] + half]);
}
