// Build a sheet (IR) from a schematic design, and run every check that must pass before a file
// is written: parts resolve, all units placed, every pin connected or no-connect, driver rules
// (the ERC pin map), geometry on grid, and a connectivity model that must equal the declared nets.
// A design with `sheets` becomes a root sheet with one sheet symbol per page plus one sheet per page; the
// geometric checks then run per page, on that page's paper, and nets cross pages by name only (global labels
// and power symbols).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../sexpr/sexpr.ts";
import { sha256 } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";
import { analyzeFootprint, type FootprintInfo } from "../kicad/fplib.ts";
import { add, boxOf, boxesOverlap, eq, GRID, gridToIu, libToSheet, mmToIu, onGrid, onSegmentInterior, ptKey, scale, type Box, type Mirror, type Pt, type Rot } from "../kicad/geometry.ts";
import { analyzeSymbol, pinsOfUnit, symbolsOf, type LibPin, type SymbolInfo } from "../kicad/symlib.ts";
import { pageFileUuidName, rootUuid, sheetUuid } from "../kicad/uuid.ts";
import { vendoredId, vendoredLib, type Part } from "../module/parts.ts";
import { computeConnectivity, sheetPins } from "./connectivity.ts";
import { Design, PAPER_MM, type DesignInput, type GridPt, type Paper } from "./dsl.ts";
import type { FieldPlacement, Label, PlacedUnit, SheetIR, SheetPin, SheetSymbol, SheetText, Wire } from "./ir.ts";

export const TOOL_VERSION = "0.1.0";
const STUB = 2 * GRID;
const TEXT = mmToIu(1.27);
/** Rough stroke-font advance per character at 1.27 mm (for placement and overlap lint only). */
const CHAR_W = mmToIu(1.1);

export class BuildError extends Error {
  constructor(readonly problems: string[]) {
    super(`schematic build failed:\n  - ${problems.join("\n  - ")}`);
    this.name = "BuildError";
  }
}

export interface Vendored {
  symbols: Map<string, SymbolInfo>;
  footprints: Map<string, FootprintInfo>;
}

/** Load the vendored libraries (lib/kicad) keyed by library id, e.g. "GHP_Device:R". */
export function loadVendored(libDir = paths.libKicad): Vendored {
  const symbols = new Map<string, SymbolInfo>();
  const footprints = new Map<string, FootprintInfo>();
  const symDir = join(libDir, "symbols");
  const fpDir = join(libDir, "footprints");
  if (existsSync(symDir)) {
    for (const f of readdirSync(symDir).filter((n) => n.endsWith(".kicad_sym"))) {
      const lib = f.replace(/\.kicad_sym$/, "");
      const file = join(symDir, f);
      for (const [name, node] of symbolsOf(parse(readFileSync(file, "utf8"), file))) symbols.set(`${lib}:${name}`, analyzeSymbol(node));
    }
  }
  if (existsSync(fpDir)) {
    for (const d of readdirSync(fpDir).filter((n) => n.endsWith(".pretty"))) {
      const lib = d.replace(/\.pretty$/, "");
      for (const f of readdirSync(join(fpDir, d)).filter((n) => n.endsWith(".kicad_mod"))) {
        const file = join(fpDir, d, f);
        footprints.set(`${lib}:${f.replace(/\.kicad_mod$/, "")}`, analyzeFootprint(parse(readFileSync(file, "utf8"), file)));
      }
    }
  }
  return { symbols, footprints };
}

export interface ExpectedNet {
  name: string;
  power: boolean;
  /** "REF.PIN", sorted. */
  pins: string[];
  /** Pages the net has pins on, in page order (empty for a one-sheet design). */
  pages: string[];
}

export interface BuildResult {
  /** The root sheet: the whole schematic of a one-sheet design, the sheet symbols of a design with pages. */
  ir: SheetIR;
  /** The pages of a design with `sheets`, in page order; empty for a one-sheet design. */
  pages: SheetIR[];
  nets: ExpectedNet[];
  noConnect: string[];
  /** sha256 of the normalised design (recorded in the title block). */
  inputSha: string;
  /** Parts used, for the review BOM. */
  bom: {
    ref: string; value: string; partKey: string; footprint: string; lcsc: string | null; verified: boolean; dnp: boolean;
    /** A board feature without a part (parts DB assembly "none"). */ feature: boolean;
    /** Pages its units are on, in page order (empty for a one-sheet design). */ pages: string[];
  }[];
}

/** Every sheet of a build: the root sheet, then the pages. */
export const sheetsOf = (b: Pick<BuildResult, "ir" | "pages">): SheetIR[] => [b.ir, ...b.pages];

/** File name of a page of a hierarchical design, next to the root `<project>.kicad_sch`. */
export const pageFile = (project: string, page: string) => `${project}-${page}.kicad_sch`;

/** Sheet symbols on the root sheet: boxes 20 grid units high and at least 40 wide (wider when a title or file name
 *  would not fit above or below the box), 10 apart, in rows, left to right, top to bottom, skipping slots that would
 *  leave the drawing area or reach into the title block. Null when the paper holds too few. */
const SHEET_BOX = { w: 40, h: 20, gapX: 10, stepY: 32, x0: 20, y0: 20 } as const;
function layoutSheets(project: string, pages: { id: string; title: string }[], paper: Paper): SheetSymbol[] | null {
  const [pw, ph] = PAPER_MM[paper];
  const fits = (text: string) => Math.ceil(textW(text) / GRID) + 2;
  const w = Math.max(SHEET_BOX.w, ...pages.map((p) => Math.max(fits(p.title), fits(`File: ${pageFile(project, p.id)}`))));
  const slots: Pt[] = [];
  for (let gy = SHEET_BOX.y0; ; gy += SHEET_BOX.stepY) {
    const y = gridToIu(gy);
    if (y + gridToIu(SHEET_BOX.h) + gridToIu(2) > mmToIu(ph - 10)) break;
    for (let gx = SHEET_BOX.x0; ; gx += w + SHEET_BOX.gapX) {
      const x = gridToIu(gx);
      const right = x + gridToIu(w);
      if (right > mmToIu(pw - 10)) break;
      const bottom = y + gridToIu(SHEET_BOX.h) + gridToIu(2);
      if (right > mmToIu(pw - 10 - 110) && bottom > mmToIu(ph - 10 - 35)) continue; // the title block
      slots.push({ x, y });
    }
  }
  if (slots.length < pages.length) return null;
  const font = mmToIu(0.635);
  return pages.map((p, i) => {
    const at = slots[i]!;
    const size = { x: gridToIu(w), y: gridToIu(SHEET_BOX.h) };
    return {
      id: p.id, name: p.title, file: pageFile(project, p.id), uuidName: `${project}/sheet/${p.id}`, page: String(i + 2), at, size,
      nameField: { at: { x: at.x, y: at.y - font }, angle: 0, hidden: false },
      fileField: { at: { x: at.x, y: at.y + size.y + font }, angle: 0, hidden: false },
    };
  });
}

const DRIVERS = new Set(["output", "bidirectional", "tri_state", "passive", "power_out", "open_collector", "open_emitter"]);

/** KiCad 10.0.6 default ERC pin map (ERC_SETTINGS::m_defaultPinMap, eeschema/erc/erc_settings.cpp):
 *  0 = OK, 1 = warning, 2 = error. The gate requires 0 errors and 0 warnings, so any pair that is
 *  not OK is rejected before a file is written. */
const PIN_TYPES = ["input", "output", "bidirectional", "tri_state", "passive", "free", "unspecified", "power_in", "power_out", "open_collector", "open_emitter", "no_connect"];
const PIN_MAP = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
  [0, 2, 0, 1, 0, 0, 1, 0, 2, 2, 2, 2],
  [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 2],
  [0, 1, 0, 0, 0, 0, 1, 1, 2, 1, 1, 2],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 2],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 2],
  [0, 2, 1, 2, 0, 0, 1, 0, 2, 2, 2, 2],
  [0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 0, 2],
  [0, 2, 1, 1, 0, 0, 1, 0, 2, 0, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];
export function pinConflict(a: string, b: string): number {
  const i = PIN_TYPES.indexOf(a);
  const j = PIN_TYPES.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`unknown pin type ${i < 0 ? a : b}`);
  return PIN_MAP[i]![j]!;
}

/** eeschema saves (180,x), (180,y), (90,y) and (270,y) as the equivalent pairs below, so emit
 *  those forms directly and a KiCad re-save changes nothing. */
function canonical(rot: Rot, mirror: Mirror | undefined): { rot: Rot; mirror?: Mirror } {
  if (rot === 180 && mirror === "x") return { rot: 0, mirror: "y" };
  if (rot === 180 && mirror === "y") return { rot: 0, mirror: "x" };
  if (rot === 90 && mirror === "y") return { rot: 270, mirror: "x" };
  if (rot === 270 && mirror === "y") return { rot: 90, mirror: "x" };
  return mirror ? { rot, mirror } : { rot };
}

const pt = (g: GridPt): Pt => ({ x: gridToIu(g[0]), y: gridToIu(g[1]) });

function transformedBox(info: SymbolInfo, unit: number, at: Pt, rot: Rot, mirror?: Mirror): Box {
  const b = info.unitBox.get(unit)!;
  const corners = [
    { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY },
  ].map((c) => add(at, libToSheet(c, rot, mirror)));
  return boxOf(corners);
}

const fieldAngle = (rot: Rot): 0 | 90 => (rot === 90 || rot === 270 ? 90 : 0);
const textW = (s: string) => s.length * CHAR_W;

export function buildSchematic(input: DesignInput, ctx: { parts: Map<string, Part>; lib: Vendored }): BuildResult {
  const parsed = Design.safeParse(input);
  if (!parsed.success) throw new BuildError(parsed.error.issues.map((i) => `design ${i.path.join(".")}: ${i.message}`));
  const d = parsed.data;
  const P = d.project;
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(msg);
  const inputSha = sha256(JSON.stringify(d));
  // Pages: "" is the one sheet of a design without `sheets`.
  const paged = d.sheets !== undefined;
  const pageIds = paged ? d.sheets!.map((s) => s.id) : [""];
  const pageOrder = (ids: Iterable<string>) => pageIds.filter((id) => [...ids].includes(id));
  /** "page <id>: " before a geometric problem on a page ("" for a one-sheet design, whose messages stay as they were). */
  const on = (page: string) => (page === "" ? "" : `page ${page}: `);
  const unitPage = new Map<PlacedUnit, string>();
  const pageOf = (sp: SheetPin) => unitPage.get(sp.unit)!;

  // ---- Parts and units ------------------------------------------------------------------------
  const units: PlacedUnit[] = [];
  const partUnits = new Map<string, PlacedUnit[]>();
  const bom: BuildResult["bom"] = [];
  const refs = new Set<string>();

  for (const [key, inst] of Object.entries(d.parts)) {
    const part = ctx.parts.get(inst.part);
    if (!part) {
      fail(`part ${key}: parts/${inst.part}.yaml not found`);
      continue;
    }
    if (refs.has(inst.ref)) fail(`duplicate reference ${inst.ref}`);
    refs.add(inst.ref);
    const valueKeys = Object.keys(part.values);
    const value = inst.value ?? (valueKeys.length === 1 ? valueKeys[0]! : undefined);
    if (value === undefined || !part.values[value]) {
      fail(`part ${key}: value ${inst.value ?? "(none)"} not in parts/${inst.part}.yaml values [${valueKeys.join(", ")}]`);
      continue;
    }
    const libId = vendoredId(part.symbol);
    const fpId = vendoredId(part.footprint);
    const info = ctx.lib.symbols.get(libId);
    const fp = ctx.lib.footprints.get(fpId);
    if (!info) fail(`part ${key}: symbol ${libId} is not vendored (run bun run lib:import)`);
    if (!fp) fail(`part ${key}: footprint ${fpId} is not vendored (run bun run lib:import)`);
    if (!info || !fp) continue;

    // Pin-to-pad: every symbol pin needs a pad, every numbered pad needs a pin.
    const pinNums = new Set(info.pins.map((p) => p.number));
    for (const n of pinNums) if (!fp.numbers.has(n)) fail(`part ${key} (${inst.ref}): symbol pin ${n} has no pad in ${fpId}`);
    for (const n of fp.numbers) if (!pinNums.has(n)) fail(`part ${key} (${inst.ref}): pad ${n} of ${fpId} has no symbol pin`);
    if (info.unitCount > 1 && info.pins.some((p) => p.unit === 0)) fail(`part ${key}: multi-unit symbol with common (unit 0) pins is not supported`);

    const placements: { unit: number; at: GridPt; rot: Rot; mirror?: Mirror; page: string }[] = [];
    if (inst.at) {
      if (info.unitCount !== 1) fail(`part ${key}: ${libId} has ${info.unitCount} units; place them with \`units\``);
      placements.push({ unit: 1, at: inst.at, ...canonical(inst.rot ?? 0, inst.mirror), page: inst.sheet ?? "" });
    } else {
      for (let u = 1; u <= info.unitCount; u++) {
        const pl = inst.units?.[String(u)];
        if (!pl) fail(`part ${key}: unit ${u} of ${info.unitCount} is not placed (all units, including power units, must be placed)`);
        else placements.push({ unit: u, at: pl.at, ...canonical(pl.rot ?? 0, pl.mirror), page: pl.sheet ?? inst.sheet ?? "" });
      }
      for (const u of Object.keys(inst.units ?? {})) if (Number(u) > info.unitCount) fail(`part ${key}: unit ${u} does not exist`);
    }

    const src = part.values[value]!;
    const list: PlacedUnit[] = [];
    for (const pl of placements) {
      const at = pt(pl.at);
      const unit: PlacedUnit = {
        kind: "part",
        uuidName: `${P}/part/${key}/unit/${pl.unit}`,
        libId,
        info,
        unit: pl.unit,
        at,
        rot: pl.rot,
        ...(pl.mirror && { mirror: pl.mirror }),
        ref: inst.ref,
        value,
        footprint: fpId,
        datasheet: part.datasheet ?? info.properties.get("Datasheet") ?? "",
        description: info.properties.get("Description") ?? "",
        extraFields: [
          ["LCSC", src.lcsc ?? ""],
          ["MPN", src.mpn ?? ""],
          ["Manufacturer", src.manufacturer ?? ""],
          ["PartKey", inst.part],
        ],
        dnp: inst.dnp ?? false,
        refField: { at, angle: 0, hidden: false },
        valueField: { at, angle: 0, hidden: false },
        partKey: inst.part,
        ...(part.assembly === "none" && { feature: true }),
      };
      list.push(unit);
      units.push(unit);
      unitPage.set(unit, pl.page);
    }
    partUnits.set(key, list);
    bom.push({
      ref: inst.ref, value, partKey: inst.part, footprint: fpId, lcsc: src.lcsc, verified: src.verified !== null, dnp: inst.dnp ?? false,
      feature: part.assembly === "none", pages: paged ? pageOrder(placements.map((pl) => pl.page)) : [],
    });
  }
  if (problems.length) throw new BuildError(problems);

  // ---- Pins -----------------------------------------------------------------------------------
  const allPins = sheetPins({ units } as SheetIR);
  const resolve = (ref: string): SheetPin | undefined => {
    const [key, id] = [ref.slice(0, ref.indexOf(".")), ref.slice(ref.indexOf(".") + 1)];
    const list = partUnits.get(key);
    if (!list) {
      fail(`${ref}: unknown part key ${key}`);
      return undefined;
    }
    const info = list[0]!.info;
    let pin: LibPin | undefined = info.pins.find((p) => p.number === id);
    if (!pin) {
      const byName = info.pins.filter((p) => p.name === id);
      if (byName.length === 1) pin = byName[0];
      else if (byName.length > 1) fail(`${ref}: pin name ${id} is ambiguous; use the pin number`);
    }
    if (!pin) {
      fail(`${ref}: ${list[0]!.libId} has no pin ${id}`);
      return undefined;
    }
    const sp = allPins.find((s) => s.unit.uuidName.startsWith(`${P}/part/${key}/`) && s.pin === pin);
    if (!sp) fail(`${ref}: pin ${pin.number} belongs to unit ${pin.unit}, which is not placed`);
    return sp;
  };

  const netOf = new Map<SheetPin, string>();
  const netPins = new Map<string, SheetPin[]>();
  for (const [name, net] of Object.entries(d.nets)) {
    const list: SheetPin[] = [];
    for (const ref of net.pins) {
      const sp = resolve(ref);
      if (!sp) continue;
      if (netOf.has(sp)) fail(`${ref} is in nets ${netOf.get(sp)} and ${name}`);
      netOf.set(sp, name);
      list.push(sp);
    }
    netPins.set(name, list);
  }
  const ncPins: SheetPin[] = [];
  for (const ref of d.noConnect) {
    const sp = resolve(ref);
    if (!sp) continue;
    if (netOf.has(sp)) fail(`${ref} is marked no-connect but is in net ${netOf.get(sp)}`);
    if (ncPins.includes(sp)) fail(`${ref} is listed twice in noConnect`);
    else ncPins.push(sp);
  }
  for (const sp of allPins) {
    if (!netOf.has(sp) && !ncPins.includes(sp)) fail(`${sp.unit.ref}.${sp.pin.number} (${sp.pin.name || sp.pin.type}) is not connected: add it to a net or to noConnect`);
    if (sp.pin.hidden && sp.pin.type === "power_in") fail(`${sp.unit.ref}.${sp.pin.number}: hidden power pins are not supported`);
    if (sp.pin.type === "unspecified") fail(`${sp.unit.ref}.${sp.pin.number}: pin type unspecified would raise an ERC warning`);
  }

  // Net names must be unique ignoring case (KiCad's similar_labels / similar_power checks).
  const lower = new Map<string, string>();
  for (const name of Object.keys(d.nets)) {
    const k = name.toLowerCase();
    if (lower.has(k)) fail(`net names ${lower.get(k)} and ${name} differ only in case`);
    lower.set(k, name);
  }
  if (problems.length) throw new BuildError(problems);

  // ---- Wires ----------------------------------------------------------------------------------
  // Everything drawn is kept per page; "" is the one sheet of a design without pages.
  const wires = new Map<string, Wire[]>(pageIds.map((id) => [id, []]));
  /** The net each drawn wire belongs to (before wires are split at connection points), for the collision check. */
  const wireNet = new Map<Wire, string>();
  const wiredPins = new Set<SheetPin>();
  const islandsOf = new Map<string, { page: string; pins: SheetPin[]; points: Set<string> }[]>();
  const netSegs = new Map<string, { page: string; w: Wire }[]>();
  const touches = (p: Wire, q: Wire) =>
    [p.a, p.b].some((x) => eq(x, q.a) || eq(x, q.b) || onSegmentInterior(x, q.a, q.b)) || [q.a, q.b].some((x) => onSegmentInterior(x, p.a, p.b));
  for (const [name, net] of Object.entries(d.nets)) {
    const members = netPins.get(name)!;
    if (net.power && net.wires?.length) fail(`net ${name}: wires on power nets are not supported (each pin gets a power symbol)`);
    const segs: { page: string; w: Wire }[] = [];
    // A path without a pin lies on the net's only page, or on the page of the wires it touches; when wires on several
    // pages touch it (pages drawn alike, a path split in parts), on the page of the touching path nearest to it in the
    // list: the one it continues. A tie is refused. A wrong guess cannot pass: it leaves a dangling wire end.
    const memberPages = new Set(members.map(pageOf));
    const paths: { idx: number; segs: Wire[]; page?: string }[] = [];
    for (const [idx, path] of (net.wires ?? []).entries()) {
      const ptsList: Pt[] = [];
      const pages = new Set<string>();
      for (const p of path) {
        if (typeof p === "string") {
          const sp = resolve(p);
          if (!sp) continue;
          if (netOf.get(sp) !== name) fail(`net ${name}: wire goes to ${p}, which is not in this net`);
          ptsList.push(sp.at);
          pages.add(pageOf(sp));
        } else ptsList.push(pt(p));
      }
      const pathSegs: Wire[] = [];
      for (let i = 0; i + 1 < ptsList.length; i++) {
        const a = ptsList[i]!;
        const b = ptsList[i + 1]!;
        if (eq(a, b)) continue;
        if (a.x !== b.x && a.y !== b.y) fail(`net ${name}: wire ${ptKey(a)} -> ${ptKey(b)} is not horizontal or vertical (add a via point)`);
        pathSegs.push({ a, b });
      }
      if (pages.size > 1) {
        fail(`net ${name}: a wire joins pins on different pages (${pageOrder(pages).join(", ")}); wires only join pins on one page, and the net crosses pages by name`);
        continue;
      }
      const page = pages.size === 1 ? [...pages][0]! : !paged ? "" : memberPages.size === 1 ? [...memberPages][0]! : undefined;
      paths.push({ idx, segs: pathSegs, ...(page !== undefined && { page }) });
    }
    for (let progress = true; progress; ) {
      progress = false;
      for (const p of paths.filter((x) => x.page === undefined)) {
        const near = paths.filter((q) => q.page !== undefined && q.segs.some((s) => p.segs.some((t) => touches(t, s))));
        if (!near.length) continue;
        const gap = Math.min(...near.map((q) => Math.abs(q.idx - p.idx)));
        const pages = new Set((new Set(near.map((q) => q.page)).size === 1 ? near : near.filter((q) => Math.abs(q.idx - p.idx) === gap)).map((q) => q.page!));
        if (pages.size !== 1) continue;
        p.page = [...pages][0]!;
        progress = true;
      }
    }
    for (const p of paths) {
      if (p.page !== undefined) segs.push(...p.segs.map((w) => ({ page: p.page!, w })));
      else if (p.segs.length) {
        fail(`net ${name}: wire ${p.idx + 1} (${p.segs.map((w) => `${ptKey(w.a)} -> ${ptKey(w.b)}`).join(", ")}) has no pin, and the wires it touches do not tell its page; start it at a pin of the net, or list it next to the wire it continues`);
      }
    }
    // Union pins through segments to find islands, page by page.
    const islands: { page: string; pins: SheetPin[]; points: Set<string> }[] = [];
    for (const page of pageIds) {
      const onPage = members.filter((m) => pageOf(m) === page);
      if (!onPage.length) continue;
      const pageSegs = segs.filter((s) => s.page === page).map((s) => s.w);
      const adj = new Map<string, Set<string>>();
      const link = (a: string, b: string) => {
        adj.set(a, (adj.get(a) ?? new Set()).add(b));
        adj.set(b, (adj.get(b) ?? new Set()).add(a));
      };
      for (const s of pageSegs) {
        link(ptKey(s.a), ptKey(s.b));
        for (const sp of onPage) if (onSegmentInterior(sp.at, s.a, s.b)) link(ptKey(s.a), ptKey(sp.at));
        // A wire ending on another wire's middle is a T-junction (the split below makes it real).
        for (const o of pageSegs) for (const p of [o.a, o.b]) if (onSegmentInterior(p, s.a, s.b)) link(ptKey(s.a), ptKey(p));
      }
      const seen = new Set<string>();
      for (const sp of onPage) {
        const k = ptKey(sp.at);
        if (seen.has(k)) continue;
        const stack = [k];
        const comp = new Set<string>();
        while (stack.length) {
          const c = stack.pop()!;
          if (comp.has(c)) continue;
          comp.add(c);
          for (const n of adj.get(c) ?? []) stack.push(n);
        }
        comp.forEach((c) => seen.add(c));
        const island = onPage.filter((m) => comp.has(ptKey(m.at)));
        if (comp.size > 1) island.forEach((m) => wiredPins.add(m));
        islands.push({ page, pins: island, points: comp });
      }
    }
    islandsOf.set(name, islands);
    netSegs.set(name, segs);
    for (const s of segs) {
      wires.get(s.page)!.push(s.w);
      wireNet.set(s.w, name);
    }
    if (members.length < 2 && !net.power) fail(`net ${name} has only ${members.length} pin; use noConnect for unused pins`);
  }

  // ---- Driver rules (default ERC pin map) and PWR_FLAG decisions ----------------------------------
  const needsFlag = new Set<string>();
  for (const [name, net] of Object.entries(d.nets)) {
    const members = netPins.get(name)!;
    const types = members.map((sp) => sp.pin.type);
    const powerIn = types.filter((t) => t === "power_in").length + (net.power ? 1 : 0); // power symbols are power_in
    const powerOut = types.filter((t) => t === "power_out").length;
    if (types.includes("input") && !types.some((t) => DRIVERS.has(t)) && !net.power) fail(`net ${name}: input pins without a driver (ERC pin_not_driven)`);
    if (powerIn > 0 && powerOut === 0) needsFlag.add(name);
    // Every pin pair, plus the power symbol (power_in) and the PWR_FLAG (power_out) the builder adds.
    const pins: [string, string][] = members.map((sp) => [`${sp.unit.ref}.${sp.pin.number}`, sp.pin.type]);
    if (net.power) pins.push([`power symbol ${name}`, "power_in"]);
    if (needsFlag.has(name)) pins.push(["PWR_FLAG", "power_out"]);
    const reported = new Set<string>();
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const [an, at] = pins[i]!;
        const [bn, bt] = pins[j]!;
        const level = pinConflict(at, bt);
        const key = [at, bt].sort().join("/");
        if (level === 0 || reported.has(key)) continue;
        reported.add(key);
        const hint = bn === "PWR_FLAG" ? " (the net has power_in pins but no power_out driver, so it needs a PWR_FLAG, which conflicts; drive power_in pins from a power_out pin or a regulator, not from this pin)" : "";
        fail(`net ${name}: ${an} (${at}) and ${bn} (${bt}) are an ERC pin_to_pin ${level === 2 ? "error" : "warning"} in KiCad's default pin map${hint}`);
      }
    }
  }
  if (problems.length) throw new BuildError(problems);

  // ---- Stubs, labels, power symbols, flags --------------------------------------------------------
  // A net whose pins are on more than one page is named by global labels; any other net by local labels.
  const labels = new Map<string, Label[]>(pageIds.map((id) => [id, []]));
  const globalLabels = new Map<string, Label[]>(pageIds.map((id) => [id, []]));
  const crossPage = (name: string) => paged && new Set(netPins.get(name)!.map(pageOf)).size > 1;
  const powerSyms: { net: string; attach: string; at: Pt; dir: Pt; page: string }[] = [];
  const flags: { net: string; at: Pt; dir: Pt; page: string }[] = [];
  const labelAngle = (dir: Pt): Label["angle"] => (dir.x > 0 ? 0 : dir.x < 0 ? 180 : dir.y < 0 ? 90 : 270);

  const stub = (sp: SheetPin, len: number): Pt => {
    const end = add(sp.at, scale(sp.out, len));
    const w = { a: sp.at, b: end };
    wires.get(pageOf(sp))!.push(w);
    wireNet.set(w, netOf.get(sp)!);
    return end;
  };

  // Power symbols on neighbouring parallel pins (2.54 or 5.08 mm apart, as on most IC symbols) would print their names
  // on top of each other. Such a stub grows by 5.08 mm (one symbol height) at a time until its symbol is clear of the
  // power symbols already on that page; at most three steps. Pins pointing left or right are 2.54 mm apart in height,
  // more than the 1.27 mm text, so only up and down stubs are checked.
  const POWER_STEP = 4 * GRID;
  // Power symbols' names print wider than CHAR_W (measured on the PDF: "+5VA" about 5 mm).
  const powerW = (t: string) => t.length * mmToIu(1.3);
  const powerClash = (page: string, end: Pt, dir: Pt, net: string) =>
    dir.x === 0 && powerSyms.some((q) => q.page === page && q.dir.x === 0 && q.dir.y === dir.y &&
      Math.abs(q.at.y - end.y) < POWER_STEP && Math.abs(q.at.x - end.x) < (powerW(q.net) + powerW(net)) / 2 + mmToIu(0.8));
  const powerStub = (sp: SheetPin, net: string): Pt => {
    let len = STUB;
    while (len < STUB + 3 * POWER_STEP && powerClash(pageOf(sp), add(sp.at, scale(sp.out, len)), sp.out, net)) len += POWER_STEP;
    return stub(sp, len);
  };

  // Stacked pins: KiCad symbols put pins of one function at one point (several GND or VBUS pins of a connector,
  // the two INP pins of a converter, a hidden ground under a visible one). They are one connection point on the
  // sheet: they must be on the same net, and they get one stub, label or power symbol between them.
  const netAtPoint = new Map<string, { net: string; pin: string }>();
  for (const [name] of Object.entries(d.nets)) {
    for (const sp of netPins.get(name)!) {
      const k = `${pageOf(sp)}|${ptKey(sp.at)}`;
      const here = `${sp.unit.ref}.${sp.pin.number}`;
      const prev = netAtPoint.get(k);
      if (prev && prev.net !== name) fail(`${on(pageOf(sp))}pins ${prev.pin} (net ${prev.net}) and ${here} (net ${name}) are stacked at one point but on different nets`);
      else if (!prev) netAtPoint.set(k, { net: name, pin: here });
    }
  }

  for (const [name, net] of Object.entries(d.nets)) {
    const islands = islandsOf.get(name)!;
    const flagRef = net.flagAt ?? net.pins[0]!;
    const flagPin = needsFlag.has(name) ? resolve(flagRef) : undefined;
    if (flagPin && netOf.get(flagPin) !== name) fail(`net ${name}: flagAt ${flagRef} is not in this net`);
    // The flag pin first, so a stacked partner never takes its point; then one member per point.
    const drawn = new Set<string>();
    const members = [...netPins.get(name)!].sort((p, q) => Number(q === flagPin) - Number(p === flagPin)).filter((sp) => {
      const k = `${pageOf(sp)}|${ptKey(sp.at)}`;
      if (drawn.has(k)) return false;
      drawn.add(k);
      return true;
    });
    const named = (page: string) => (crossPage(name) ? globalLabels : labels).get(page)!;
    for (const sp of members) {
      const attachName = `${sp.unit.ref}.${sp.pin.number}`;
      const wired = wiredPins.has(sp);
      const page = pageOf(sp);
      if (net.power || (!wired && islands.length > 1) || (flagPin === sp && !wired)) {
        const withFlag = flagPin === sp;
        if (withFlag) {
          const mid = add(sp.at, scale(sp.out, STUB));
          const end = add(mid, scale(sp.out, STUB));
          for (const w of [{ a: sp.at, b: mid }, { a: mid, b: end }]) {
            wires.get(page)!.push(w);
            wireNet.set(w, name);
          }
          flags.push({ net: name, at: mid, dir: sp.out, page });
          if (net.power) powerSyms.push({ net: name, attach: attachName, at: end, dir: sp.out, page });
          else named(page).push({ text: name, at: end, angle: labelAngle(sp.out) });
        } else {
          const end = net.power ? powerStub(sp, name) : stub(sp, STUB);
          if (net.power) powerSyms.push({ net: name, attach: attachName, at: end, dir: sp.out, page });
          else named(page).push({ text: name, at: end, angle: labelAngle(sp.out) });
        }
      }
    }
    if (flagPin && wiredPins.has(flagPin)) fail(`net ${name}: the PWR_FLAG pin ${flagRef} is wired; choose an unwired pin with flagAt`);
    // Wired islands of a multi-island net carry a label on their longest segment (single-island
    // nets only when `label: true` asks for the name to be shown).
    if (!net.power && (islands.length > 1 || net.label)) {
      for (const { page, pins: island, points } of islands.filter((i) => i.pins.some((m) => wiredPins.has(m)))) {
        const segs = netSegs.get(name)!.filter((s) => s.page === page).map((s) => s.w).filter((w) => points.has(ptKey(w.a)) || points.has(ptKey(w.b)));
        const best = [...segs].sort((p, q) => Math.abs(q.b.x - q.a.x) + Math.abs(q.b.y - q.a.y) - (Math.abs(p.b.x - p.a.x) + Math.abs(p.b.y - p.a.y)))[0];
        const len = best ? Math.abs(best.b.x - best.a.x) + Math.abs(best.b.y - best.a.y) : 0;
        if (!best || len < 2 * GRID) {
          fail(`net ${name}: wired group ${island.map((m) => `${m.unit.ref}.${m.pin.number}`).join(",")} needs a label but has no wire of at least 2 grid units`);
          continue;
        }
        // Anchor one grid in from the end the text grows away from (text runs +x at 0°, -y at
        // 90°), so the label reads along the wire instead of running into the pin at its far end.
        const horizontal = best.a.y === best.b.y;
        const at = horizontal
          ? { x: Math.min(best.a.x, best.b.x) + GRID, y: best.a.y }
          : { x: best.a.x, y: Math.max(best.a.y, best.b.y) - GRID };
        named(page).push({ text: name, at, angle: horizontal ? 0 : 90 });
      }
    }
  }

  // Split wires at every connection point on them (of their own page), so connections only happen at endpoints.
  const connPoints = (page: string): Pt[] => [
    ...allPins.filter((s) => pageOf(s) === page).map((s) => s.at),
    ...labels.get(page)!.map((l) => l.at),
    ...globalLabels.get(page)!.map((l) => l.at),
    ...powerSyms.filter((p) => p.page === page).map((p) => p.at),
    ...flags.filter((f) => f.page === page).map((f) => f.at),
    ...wires.get(page)!.flatMap((w) => [w.a, w.b]),
  ];
  const split = (page: string, list: Wire[]): Wire[] => {
    const cps = connPoints(page);
    const out: Wire[] = [];
    for (const w of list) {
      const inner = cps.filter((p) => onSegmentInterior(p, w.a, w.b));
      if (!inner.length) {
        out.push(w);
        continue;
      }
      const uniq = [...new Map(inner.map((p) => [ptKey(p), p])).values()].sort((p, q) =>
        Math.abs(p.x - w.a.x) + Math.abs(p.y - w.a.y) - (Math.abs(q.x - w.a.x) + Math.abs(q.y - w.a.y)));
      let a = w.a;
      for (const p of uniq) {
        out.push({ a, b: p });
        a = p;
      }
      out.push({ a, b: w.b });
    }
    // Drop exact duplicates.
    return [...new Map(out.map((w) => [[ptKey(w.a), ptKey(w.b)].sort().join("|"), w])).values()];
  };
  // Two nets must never meet on a page: a power symbol, label or flag on another net's pin, a wire running into another
  // net's pin, label or wire end. Splitting the wires below would join them silently; name the spot instead.
  const collisions = new Set<string>();
  const mm = (p: Pt) => `(${p.x / 10000}, ${p.y / 10000}) mm`;
  for (const page of pageIds) {
    const points: { at: Pt; net: string; what: string; pin: boolean }[] = [
      ...allPins.filter((sp) => pageOf(sp) === page).map((sp) => {
        const net = netOf.get(sp);
        return { at: sp.at, net: net ?? `(no-connect ${sp.unit.ref}.${sp.pin.number})`, what: `pin ${sp.unit.ref}.${sp.pin.number}`, pin: true };
      }),
      ...[...labels.get(page)!, ...globalLabels.get(page)!].map((l) => ({ at: l.at, net: l.text, what: `label ${l.text}`, pin: false })),
      ...powerSyms.filter((x) => x.page === page).map((x) => ({ at: x.at, net: x.net, what: `power symbol ${x.net} (at ${x.attach})`, pin: false })),
      ...flags.filter((x) => x.page === page).map((x) => ({ at: x.at, net: x.net, what: `PWR_FLAG of ${x.net}`, pin: false })),
    ];
    const at = new Map<string, typeof points>();
    for (const q of points) at.set(ptKey(q.at), [...(at.get(ptKey(q.at)) ?? []), q]);
    for (const list of at.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [a, b] = [list[i]!, list[j]!];
          if (a.net === b.net || (a.pin && b.pin)) continue; // stacked pins are reported above
          collisions.add(`${on(page)}${a.what} (net ${a.net}) and ${b.what} (net ${b.net}) meet at ${mm(a.at)}`);
        }
      }
    }
    for (const w of wires.get(page)!) {
      const net = wireNet.get(w);
      if (net === undefined) continue;
      for (const q of points) {
        if (q.net === net || !(eq(q.at, w.a) || eq(q.at, w.b) || onSegmentInterior(q.at, w.a, w.b))) continue;
        collisions.add(`${on(page)}a wire of net ${net} (${mm(w.a)} to ${mm(w.b)}) runs into ${q.what} (net ${q.net}) at ${mm(q.at)}`);
      }
    }
  }
  problems.push(...collisions);

  const finalWires = new Map(pageIds.map((id) => [id, split(id, wires.get(id)!)]));

  // ---- Power symbols and flags --------------------------------------------------------------------
  const orient = (info: SymbolInfo, dir: Pt): Rot => {
    const b = info.unitBox.get(1)!;
    const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    const nat = Math.abs(c.x) > Math.abs(c.y) ? { x: Math.sign(c.x), y: 0 } : { x: 0, y: Math.sign(c.y) };
    for (const r of [0, 90, 180, 270] as Rot[]) if (eq(libToSheet(nat, r), dir)) return r;
    throw new Error(`cannot orient ${info.name}`);
  };
  const extentAlong = (info: SymbolInfo, rot: Rot, dir: Pt) => {
    const b = info.unitBox.get(1)!;
    const corners = [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.minY }];
    return Math.max(...corners.map((c) => {
      const s = libToSheet(c, rot);
      return s.x * dir.x + s.y * dir.y;
    }));
  };
  const valueBeyond = (info: SymbolInfo, at: Pt, rot: Rot, dir: Pt, text: string): FieldPlacement => {
    const ext = extentAlong(info, rot, dir);
    const half = dir.x !== 0 ? textW(text) / 2 : TEXT / 2;
    const gap = mmToIu(0.635);
    return { at: add(at, scale(dir, ext + gap + half)), angle: fieldAngle(rot), hidden: false };
  };

  powerSyms.sort((p, q) => (p.net === q.net ? p.attach.localeCompare(q.attach) : p.net.localeCompare(q.net)));
  powerSyms.forEach((ps, i) => {
    const libId = `${vendoredLib("power")}:${ps.net}`;
    const info = ctx.lib.symbols.get(libId);
    if (!info) {
      fail(`net ${ps.net}: no power symbol ${libId} (power nets must be named like a KiCad power symbol, e.g. +12V, -12V, GND)`);
      return;
    }
    const rot = orient(info, ps.dir);
    const unit: PlacedUnit = {
      kind: "power",
      uuidName: `${P}/power/${ps.net}/${ps.attach}`,
      libId, info, unit: 1, at: ps.at, rot,
      ref: `#PWR${String(i + 1).padStart(2, "0")}`,
      value: ps.net,
      footprint: "",
      datasheet: info.properties.get("Datasheet") ?? "",
      description: info.properties.get("Description") ?? "",
      extraFields: [],
      dnp: false,
      refField: { at: ps.at, angle: 0, hidden: true },
      valueField: valueBeyond(info, ps.at, rot, ps.dir, ps.net),
    };
    units.push(unit);
    unitPage.set(unit, ps.page);
  });
  const flagInfo = ctx.lib.symbols.get(`${vendoredLib("power")}:PWR_FLAG`);
  flags.sort((p, q) => p.net.localeCompare(q.net));
  flags.forEach((f, i) => {
    if (!flagInfo) {
      fail("PWR_FLAG is not vendored (run bun run lib:import)");
      return;
    }
    const perp = f.dir.x !== 0 ? { x: 0, y: -1 } : { x: 1, y: 0 };
    const rot = orient(flagInfo, perp);
    const unit: PlacedUnit = {
      kind: "flag",
      uuidName: `${P}/flag/${f.net}`,
      libId: `${vendoredLib("power")}:PWR_FLAG`, info: flagInfo, unit: 1, at: f.at, rot,
      ref: `#FLG${String(i + 1).padStart(2, "0")}`,
      value: "PWR_FLAG",
      footprint: "",
      datasheet: flagInfo.properties.get("Datasheet") ?? "",
      description: flagInfo.properties.get("Description") ?? "",
      extraFields: [],
      dnp: false,
      refField: { at: f.at, angle: 0, hidden: true },
      valueField: valueBeyond(flagInfo, f.at, rot, perp, "PWR_FLAG"),
    };
    units.push(unit);
    unitPage.set(unit, f.page);
  });

  // ---- Reference/Value placement for parts (centred text on a side without pins) ----------------
  for (const u of units.filter((x) => x.kind === "part")) {
    const raw = transformedBox(u.info, u.unit, u.at, u.rot, u.mirror);
    // Pin names/numbers are drawn beside the pins; keep text at least 1.27 mm off thin bodies.
    const pad = raw.maxX - raw.minX < 2 * GRID ? GRID : 0;
    const box = { minX: raw.minX - pad, maxX: raw.maxX + pad, minY: raw.minY, maxY: raw.maxY };
    const outs = pinsOfUnit(u.info, u.unit).map((p) => libToSheet({ x: -p.inward.x, y: -p.inward.y }, u.rot, u.mirror));
    const used = { left: outs.some((o) => o.x < 0), right: outs.some((o) => o.x > 0), up: outs.some((o) => o.y < 0), down: outs.some((o) => o.y > 0) };
    const refText = u.info.unitCount > 1 ? `${u.ref}${String.fromCharCode(64 + u.unit)}` : u.ref;
    const angle = fieldAngle(u.rot);
    const gap = mmToIu(0.635);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const above = (k: number) => ({ x: cx, y: box.minY - gap - TEXT / 2 - k * (TEXT + gap) });
    const below = (k: number) => ({ x: cx, y: box.maxY + gap + TEXT / 2 + k * (TEXT + gap) });
    const side = (dir: 1 | -1, text: string, dy: number) => ({
      x: dir > 0 ? box.maxX + gap + textW(text) / 2 : box.minX - gap - textW(text) / 2,
      y: cy + dy,
    });
    let refAt: Pt;
    let valAt: Pt;
    if (!used.up && !used.down) [refAt, valAt] = [above(0), below(0)];
    else if (!used.right) [refAt, valAt] = [side(1, refText, -TEXT / 2 - gap / 2), side(1, u.value, TEXT / 2 + gap / 2)];
    else if (!used.left) [refAt, valAt] = [side(-1, refText, -TEXT / 2 - gap / 2), side(-1, u.value, TEXT / 2 + gap / 2)];
    else if (!used.down) [refAt, valAt] = [below(0), below(1)];
    else if (!used.up) [refAt, valAt] = [above(1), above(0)];
    else [refAt, valAt] = [above(0), below(0)];
    u.refField = { at: refAt, angle, hidden: false };
    u.valueField = { at: valAt, angle, hidden: false };
  }

  // ---- Sheets: the one sheet, or the root sheet and one sheet per page ----------------------------------
  const root = rootUuid(P);
  const titleBlock = (): SheetIR["titleBlock"] => ({
    title: d.sheet.title,
    date: d.sheet.date,
    rev: d.sheet.rev,
    ...(d.sheet.company !== undefined && { company: d.sheet.company }),
    comments: [`GENERATED from ${P}/schematic.ts - do not edit in KiCad`, `input sha256 ${inputSha.slice(0, 12)}`, "${GIT_SHA}"],
  });
  const textsOn = (page: string | undefined): SheetText[] =>
    d.text.filter((t) => t.sheet === page).map((t) => ({ text: t.text, at: pt(t.at), size: mmToIu(t.size ?? 1.27) }));
  const pageSheet = (page: string): SheetIR => {
    const def = paged ? d.sheets!.find((s) => s.id === page)! : undefined;
    return {
      project: P,
      rootUuid: root,
      fileUuidName: def ? pageFileUuidName(P, page) : `${P}/root`,
      seed: def ? pageFileUuidName(P, page) : P,
      instancePath: def ? `/${root}/${sheetUuid(P, page)}` : `/${root}`,
      ...(def && { page: { id: def.id, title: def.title, number: String(pageIds.indexOf(page) + 2), file: pageFile(P, page) } }),
      paper: def ? def.paper : d.sheet.paper,
      titleBlock: titleBlock(),
      units: units.filter((u) => unitPage.get(u) === page),
      wires: finalWires.get(page)!,
      labels: labels.get(page)!,
      globalLabels: globalLabels.get(page)!,
      junctions: [],
      noConnects: ncPins.filter((sp) => pageOf(sp) === page).map((sp) => sp.at),
      texts: textsOn(def ? page : undefined),
      sheets: [],
    };
  };
  let ir: SheetIR;
  let pages: SheetIR[] = [];
  if (paged) {
    pages = pageIds.map(pageSheet);
    const sheets = layoutSheets(P, d.sheets!, d.sheet.paper);
    if (!sheets) fail(`the root sheet (${d.sheet.paper}) has no room for ${pageIds.length} sheet symbols; give \`sheet.paper\` a larger size`);
    ir = {
      project: P, rootUuid: root, fileUuidName: `${P}/root`, seed: P, instancePath: `/${root}`, paper: d.sheet.paper, titleBlock: titleBlock(),
      units: [], wires: [], labels: [], globalLabels: [], junctions: [], noConnects: [], texts: textsOn(undefined), sheets: sheets ?? [],
    };
    for (const t of ir.texts) {
      const box = ir.sheets.find((s) => t.at.x >= s.at.x && t.at.x <= s.at.x + s.size.x && t.at.y >= s.at.y - GRID && t.at.y <= s.at.y + s.size.y + GRID);
      if (box) fail(`root sheet: text "${t.text}" sits on the sheet symbol of page ${box.id}`);
    }
  } else ir = pageSheet("");

  // ---- Junctions and geometry checks, sheet by sheet -----------------------------------------------------
  for (const sheet of paged ? pages : [ir]) checkSheet(sheet, on(sheet.page?.id ?? ""), fail);
  if (paged) checkSheet(ir, "root sheet: ", fail);

  // ---- Connectivity must equal the declared nets -------------------------------------------------------
  const conn = computeConnectivity(paged ? pages : ir);
  problems.push(...conn.problems);
  const expected: ExpectedNet[] = Object.entries(d.nets).map(([name, net]) => ({
    name,
    power: net.power ?? false,
    pins: netPins.get(name)!.map((sp) => `${sp.unit.ref}.${sp.pin.number}`).sort(),
    pages: paged ? pageOrder(netPins.get(name)!.map(pageOf)) : [],
  }));
  // (After a reported collision the merged nets would only repeat it at length.)
  for (const e of collisions.size ? [] : expected) {
    const got = conn.nets.filter((n) => n.pins.some((p) => e.pins.includes(p)));
    if (got.length !== 1 || got[0]!.pins.join() !== e.pins.join()) {
      fail(`connectivity of net ${e.name} differs from the design: expected [${e.pins.join(", ")}], geometry gives ${got.map((g) => `[${g.pins.join(", ")}]`).join(" + ") || "nothing"}`);
    }
  }
  if (problems.length) throw new BuildError(problems);
  return {
    ir,
    pages,
    nets: expected,
    noConnect: ncPins.map((sp) => `${sp.unit.ref}.${sp.pin.number}`).sort(),
    inputSha,
    bom: bom.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })),
  };
}

/** Junctions, and the checks of one sheet's geometry on its own paper: grid, overlaps, text positions, drawing area
 *  and title block. `where` prefixes the problems ("" on a one-sheet design). Sets `ir.junctions`. */
function checkSheet(ir: SheetIR, where: string, fail: (msg: string) => void) {
  const pinsNow = sheetPins(ir);
  const count = new Map<string, { n: number; wire: boolean; at: Pt }>();
  const bump = (p: Pt, wire: boolean) => {
    const c = count.get(ptKey(p)) ?? { n: 0, wire: false, at: p };
    c.n++;
    c.wire ||= wire;
    count.set(ptKey(p), c);
  };
  for (const w of ir.wires) {
    bump(w.a, true);
    bump(w.b, true);
  }
  for (const sp of pinsNow) bump(sp.at, false);
  ir.junctions = [...count.values()].filter((c) => c.n >= 3 && c.wire).map((c) => c.at);

  for (const sp of pinsNow) if (!onGrid(sp.at)) fail(`${where}${sp.unit.ref}.${sp.pin.number} at ${ptKey(sp.at)} IU is off the 1.27 mm grid`);
  for (const w of ir.wires) for (const p of [w.a, w.b]) if (!onGrid(p)) fail(`${where}wire end ${ptKey(p)} is off grid`);
  for (const l of [...ir.labels, ...ir.globalLabels]) if (!onGrid(l.at)) fail(`${where}label ${l.text} is off grid`);
  // Pin-only units (e.g. an op-amp power unit) have zero width; give them half a grid each side.
  const padded = (b: Box): Box => ({
    minX: b.minX === b.maxX ? b.minX - GRID / 2 : b.minX, maxX: b.minX === b.maxX ? b.maxX + GRID / 2 : b.maxX,
    minY: b.minY === b.maxY ? b.minY - GRID / 2 : b.minY, maxY: b.minY === b.maxY ? b.maxY + GRID / 2 : b.maxY,
  });
  const boxes = ir.units.filter((u) => u.kind === "part").map((u) => ({ u, box: padded(transformedBox(u.info, u.unit, u.at, u.rot, u.mirror)) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i]!, boxes[j]!];
      if (boxesOverlap(a.box, b.box) || eq(a.u.at, b.u.at)) fail(`${where}symbols ${a.u.ref}/${a.u.unit} and ${b.u.ref}/${b.u.unit} overlap`);
    }
  }
  const textAt = new Set<string>();
  for (const t of ir.texts) {
    if (textAt.has(ptKey(t.at))) fail(`${where}two text items at the same position (${t.at.x / 10000}, ${t.at.y / 10000}) mm`);
    textAt.add(ptKey(t.at));
  }
  const [pw, ph] = PAPER_MM[ir.paper];
  const inside = (p: Pt) => p.x > mmToIu(10) && p.y > mmToIu(10) && p.x < mmToIu(pw - 10) && p.y < mmToIu(ph - 10);
  const inTitle = (p: Pt) => p.x > mmToIu(pw - 10 - 110) && p.y > mmToIu(ph - 10 - 35);
  const corners = ir.sheets.flatMap((s) => [s.at, add(s.at, s.size)]);
  for (const p of [...pinsNow.map((s) => s.at), ...ir.wires.flatMap((w) => [w.a, w.b]), ...corners]) {
    if (!inside(p) || inTitle(p)) {
      fail(`${where}item at (${p.x / 10000}, ${p.y / 10000}) mm is outside the drawing area or inside the title block`);
      break;
    }
  }
}
