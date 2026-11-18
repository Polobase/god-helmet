// KiCad symbol libraries: read packed .kicad_sym files and .kicad_symdir folders, flatten
// derived symbols (`extends`), and extract the pin and outline data the schematic builder needs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomNum, atomStr, child, children, head, isList, l, parse, str, type List, type Node } from "../sexpr/sexpr.ts";
import { boxOf, mmToIu, pinDirection, type Box, type Pt } from "./geometry.ts";
import { TOOLCHAIN } from "./uuid.ts";

/** Top-level symbols of a `(kicad_symbol_lib …)` document, by name. */
export function symbolsOf(lib: List): Map<string, List> {
  if (head(lib) !== "kicad_symbol_lib") throw new Error(`not a symbol library (head: ${head(lib)})`);
  const out = new Map<string, List>();
  for (const s of children(lib, "symbol")) out.set(atomStr(s, 1)!, s);
  return out;
}

/** Load one raw (possibly derived) symbol from a stock library directory. KiCad 10 ships
 *  libraries either packed (<Lib>.kicad_sym) or split (<Lib>.kicad_symdir/<Name>.kicad_sym). */
export function readRawSymbol(stockDir: string, libName: string, symName: string): { node: List; file: string } {
  const split = join(stockDir, `${libName}.kicad_symdir`, `${symName}.kicad_sym`);
  if (existsSync(split)) {
    const node = symbolsOf(parse(readFileSync(split, "utf8"), split)).get(symName);
    if (node) return { node, file: split };
  }
  const packed = join(stockDir, `${libName}.kicad_sym`);
  if (existsSync(packed)) {
    const node = symbolsOf(parse(readFileSync(packed, "utf8"), packed)).get(symName);
    if (node) return { node, file: packed };
  }
  throw new Error(`symbol ${libName}:${symName} not found in ${stockDir}`);
}

/** Load a symbol and flatten its `extends` chain; returns the files read (for provenance). */
export function readFlatSymbol(stockDir: string, libName: string, symName: string): { node: List; files: string[] } {
  const { node, file } = readRawSymbol(stockDir, libName, symName);
  const parentName = atomStr(child(node, "extends"), 1);
  if (!parentName) return { node, files: [file] };
  const parent = readFlatSymbol(stockDir, libName, parentName);
  return { node: flatten(node, parent.node), files: [file, ...parent.files] };
}

const FLAG_HEADS = new Set([
  "power", "pin_numbers", "pin_names", "exclude_from_sim", "in_bom", "on_board", "in_pos_files",
  "duplicate_pin_numbers_are_jumpers", "embedded_fonts",
]);

/** Rename a symbol and its unit sub-symbols (`<name>_<unit>_<style>`), which must carry the
 *  parent's name as prefix (sch_io_kicad_sexpr_parser.cpp rejects others). */
export function renameSymbol(node: List, newName: string): List {
  const oldName = atomStr(node, 1)!;
  return {
    type: "list",
    items: node.items.map((it, i) => {
      if (i === 1) return str(newName);
      if (head(it) === "symbol" && isList(it)) {
        const sub = atomStr(it, 1)!;
        if (!sub.startsWith(`${oldName}_`)) throw new Error(`unit ${sub} does not match symbol ${oldName}`);
        return { type: "list", items: [it.items[0]!, str(newName + sub.slice(oldName.length)), ...it.items.slice(2)] };
      }
      return it;
    }),
  };
}

/**
 * Flatten a derived symbol onto its (already flat) parent, following LIB_SYMBOL::Flatten:
 * graphics, pins and units come from the parent (renamed); the derived symbol's properties
 * replace same-named parent properties, and its flags override the parent's.
 */
export function flatten(derived: List, parent: List): List {
  const name = atomStr(derived, 1)!;
  const base = renameSymbol(parent, name);
  const props = new Map(children(derived, "property").map((p) => [atomStr(p, 1)!, p]));
  const flags = new Map(derived.items.filter((c): c is List => FLAG_HEADS.has(head(c) ?? "")).map((c) => [head(c)!, c]));
  const used = new Set<string>();
  const out: Node[] = [];
  let lastProp = -1;
  for (const it of base.items) {
    const h = head(it);
    if (h === "property") {
      const pn = atomStr(it as List, 1)!;
      out.push(props.get(pn) ?? it);
      used.add(pn);
      lastProp = out.length;
    } else if (h && flags.has(h)) {
      out.push(flags.get(h)!);
      flags.delete(h);
    } else out.push(it);
  }
  const extra = [...props.entries()].filter(([pn]) => !used.has(pn)).map(([, p]) => p);
  out.splice(lastProp < 0 ? out.length : lastProp, 0, ...extra);
  return { type: "list", items: out };
}

// ---------------------------------------------------------------------------------------------
// Analysis

export interface LibPin {
  number: string;
  name: string;
  /** Electrical type: input, output, bidirectional, tri_state, passive, free, unspecified,
   *  power_in, power_out, open_collector, open_emitter, no_connect. */
  type: string;
  /** 0 = common to all units. */
  unit: number;
  bodyStyle: number;
  /** Connection point, library space (Y-up), IU. */
  at: Pt;
  /** Direction from the connection point into the body, library space. */
  inward: Pt;
  length: number;
  hidden: boolean;
}

export interface SymbolInfo {
  name: string;
  node: List;
  pins: LibPin[];
  /** Number of units (≥1). */
  unitCount: number;
  /** `(power …)` flag: a power symbol whose power_in pin names a global net. */
  isPower: boolean;
  /** Library-space outline (graphics + pins) per unit, including unit-0 items. */
  unitBox: Map<number, Box>;
  properties: Map<string, string>;
}

const xy = (n: List | undefined): Pt => ({ x: mmToIu(atomNum(n, 1) ?? 0), y: mmToIu(atomNum(n, 2) ?? 0) });

function graphicPoints(g: List): Pt[] {
  switch (head(g)) {
    case "rectangle":
      return [xy(child(g, "start")), xy(child(g, "end"))];
    case "polyline":
    case "bezier":
      return children(child(g, "pts") ?? l("pts"), "xy").map(xy);
    case "circle": {
      const c = xy(child(g, "center"));
      const r = mmToIu(atomNum(child(g, "radius"), 1) ?? 0);
      return [{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }];
    }
    case "arc":
      return [xy(child(g, "start")), xy(child(g, "mid")), xy(child(g, "end"))];
    default:
      return [];
  }
}

export function analyzeSymbol(node: List): SymbolInfo {
  const name = atomStr(node, 1)!;
  if (child(node, "extends")) throw new Error(`symbol ${name} must be flattened before analysis`);
  const pins: LibPin[] = [];
  const pointsByUnit = new Map<number, Pt[]>();
  let unitCount = 1;
  for (const sub of children(node, "symbol")) {
    const subName = atomStr(sub, 1)!;
    const m = /_(\d+)_(\d+)$/.exec(subName);
    if (!m) throw new Error(`unexpected unit name ${subName}`);
    const unit = Number(m[1]);
    const bodyStyle = Number(m[2]);
    if (bodyStyle > 1) continue; // alternate (De Morgan) body styles are not used
    unitCount = Math.max(unitCount, unit);
    const pts = pointsByUnit.get(unit) ?? [];
    pointsByUnit.set(unit, pts);
    for (const g of sub.items) {
      if (!isList(g)) continue;
      if (head(g) === "pin") {
        const at = child(g, "at");
        const angle = atomNum(at, 3) ?? 0;
        const length = mmToIu(atomNum(child(g, "length"), 1) ?? 0);
        const dir = pinDirection(angle);
        const p = xy(at);
        const hide = child(g, "hide");
        pins.push({
          number: atomStr(child(g, "number"), 1) ?? "",
          name: atomStr(child(g, "name"), 1) ?? "",
          type: (g.items[1] as { value: string }).value,
          unit,
          bodyStyle,
          at: p,
          inward: dir,
          length,
          hidden: g.items.some((c) => c.type === "sym" && c.value === "hide") || (hide !== undefined && atomStr(hide, 1) !== "no"),
        });
        pts.push(p, { x: p.x + dir.x * length, y: p.y + dir.y * length });
      } else pts.push(...graphicPoints(g));
    }
  }
  const common = pointsByUnit.get(0) ?? [];
  const unitBox = new Map<number, Box>();
  for (let u = 1; u <= unitCount; u++) unitBox.set(u, boxOf([...common, ...(pointsByUnit.get(u) ?? [])]));
  const properties = new Map(children(node, "property").map((p) => [atomStr(p, 1)!, atomStr(p, 2) ?? ""]));
  return { name, node, pins, unitCount, isPower: child(node, "power") !== undefined, unitBox, properties };
}

/** Pins that belong to a placed unit (its own pins plus unit-0 pins). */
export const pinsOfUnit = (info: SymbolInfo, unit: number) => info.pins.filter((p) => p.unit === unit || p.unit === 0);

/** Serialise symbols as a library file (sorted by name for stable diffs). */
export function symbolLibrary(symbols: List[], generatorVersion: string): List {
  const sorted = [...symbols].sort((a, b) => atomStr(a, 1)!.localeCompare(atomStr(b, 1)!));
  return l("kicad_symbol_lib", l("version", 20251024), l("generator", str(TOOLCHAIN)),
    l("generator_version", str(generatorVersion)), ...sorted);
}

/** All symbol names in a library directory listing, for diagnostics. */
export function listLibraries(stockDir: string): string[] {
  return readdirSync(stockDir).filter((f) => f.endsWith(".kicad_sym") || f.endsWith(".kicad_symdir"));
}

