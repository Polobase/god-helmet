// JLCPCB CPL (pick-and-place).
// KiCad: `pcb export pos --format csv --units mm` → Ref,Val,Package,PosX,PosY,Rot,Side
// (footprint anchor, page origin, Y negated so it points up, side top|bottom;
// place_file_exporter.cpp). fab reads it to cross-check the placements it takes from the
// .kicad_pcb (placement.ts), which also give the centroid of THT parts.
// JLCPCB sample CPL (Sample-CPL_JLCSMT.xlsx): Designator,Mid X,Mid Y,Layer,Rotation with values
// like "95.0518mm", layer T/B, rotation in degrees counter-clockwise.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csv, parseCsv } from "./csv.ts";

export const CPL_HEADER = ["Designator", "Mid X", "Mid Y", "Layer", "Rotation"];

export interface PosRow {
  ref: string;
  value: string;
  pkg: string;
  x: number;
  y: number;
  rot: number;
  side: "top" | "bottom";
}

export function parsePos(text: string): PosRow[] {
  const [header, ...rows] = parseCsv(text);
  const want = ["Ref", "Val", "Package", "PosX", "PosY", "Rot", "Side"];
  if (!header || want.some((h, i) => header[i] !== h)) throw new Error(`unexpected position file header: ${header?.join(",")}`);
  return rows.map((r) => {
    const side = r[6];
    if (side !== "top" && side !== "bottom") throw new Error(`bad side "${side}" for ${r[0]}`);
    return { ref: r[0]!, value: r[1]!, pkg: r[2]!, x: Number(r[3]), y: Number(r[4]), rot: Number(r[5]), side };
  });
}

export interface Correction {
  /** Line in transformations.csv (the header is line 1). */
  row: number;
  source: string;
  pattern: RegExp;
  rot: number;
  dx: number;
  dy: number;
  /** Other lines that list the same pattern with a different correction. */
  conflicts: number[];
}

export const norm = (deg: number) => ((Math.round(deg * 1000) / 1000) % 360 + 360) % 360;
const sameCorrection = (a: Correction, b: Correction) => norm(a.rot) === norm(b.rot) && a.dx === b.dx && a.dy === b.dy;

/** Load the rotation/offset table (Fabrication Toolkit, Apache-2.0; see NOTICE.md). Patterns
 *  listed more than once with different values are recorded in `conflicts`: upstream lists
 *  `^VSSOP-8_` with 180 on line 49 and with 270 on line 50. */
export function loadCorrections(file = join(import.meta.dir, "transformations.csv")): Correction[] {
  const [, ...rows] = parseCsv(readFileSync(file, "utf8"));
  const table = rows.map((r, i): Correction => {
    const source = r[0]!.trim();
    return { row: i + 2, source, pattern: new RegExp(source), rot: Number(r[1]), dx: Number(r[2]), dy: Number(r[3]), conflicts: [] };
  });
  for (const a of table) {
    a.conflicts = table.filter((b) => b !== a && b.source === a.source && !sameCorrection(a, b)).map((b) => b.row);
  }
  return table;
}

/**
 * The Fabrication Toolkit's lookup (plugins/process.py @642b069, _get_rotation_from_db): the
 * first line in file order whose regex matches the footprint name (Python re.search), and only
 * when none does, the first line that matches the library nickname. Later matches are ignored,
 * even when they give another value.
 */
export function correctionFor(name: string, table: Correction[], lib = ""): Correction | undefined {
  return table.find((c) => c.pattern.test(name)) ?? (lib ? table.find((c) => c.pattern.test(lib)) : undefined);
}

/** Lines that also match `name` but give a different correction than the chosen one: a
 *  conflicting duplicate, or a more specific line shadowed by an earlier general one. */
export function disagreeing(name: string, table: Correction[], chosen: Correction): Correction[] {
  return table.filter((c) => c !== chosen && c.pattern.test(name) && !sameCorrection(c, chosen));
}

export interface Placement {
  ref: string;
  /** Footprint name and library nickname (the rotation table is matched against them). */
  name: string;
  lib: string;
  side: "top" | "bottom";
  /** Placement point in position-file coordinates (mm, Y up). */
  x: number;
  y: number;
  /** Footprint orientation, degrees counter-clockwise, as KiCad reports it. */
  rot: number;
  /** The part's own correction (parts/*.yaml `cplRotation`): it replaces the table's rotation. */
  partRot?: number;
}

export interface CplLine {
  ref: string;
  x: number;
  y: number;
  layer: "T" | "B";
  rotation: number;
  rule?: Correction;
  /** The part's own correction, when it replaced the table's rotation. */
  partRot?: number;
  /** Other table lines that match this footprint with another value (check these parts). */
  disputed: Correction[];
}

const mm = (v: number) => `${(Math.round(v * 10000) / 10000).toFixed(4)}mm`;

/**
 * CPL lines, computed as the Fabrication Toolkit and kicad-jlcpcb-tools do: bottom-side parts are
 * mirrored first (180 − rot, "as viewed from above", a tool convention that JLCPCB does not
 * publish) and the table correction is added after that. The table offset is turned with the
 * footprint (FT process.py @642b069 lines 229-251). A part's own correction (`partRot`, read from
 * JLCPCB's footprint for that LCSC part) replaces the table's rotation and is added the same way.
 * JLCPCB engineers review rotation and polarity from the silkscreen before assembly, so check
 * their placement preview.
 */
export function cplLines(parts: Placement[], table: Correction[]): CplLine[] {
  return parts
    .map((p): CplLine => {
      const rule = correctionFor(p.name, table, p.lib);
      const [s, c] = [Math.sin((p.rot * Math.PI) / 180), Math.cos((p.rot * Math.PI) / 180)];
      const [dx, dy] = [rule?.dx ?? 0, rule?.dy ?? 0];
      const [ox, oy] = p.side === "top" ? [dx * c - dy * s, dx * s + dy * c] : [dx * c + dy * s, dx * s - dy * c];
      const base = p.side === "top" ? p.rot : 180 - p.rot;
      return {
        ref: p.ref,
        x: p.x + ox,
        y: p.y + oy,
        layer: p.side === "top" ? "T" : "B",
        rotation: norm(base + (p.partRot ?? rule?.rot ?? 0)),
        ...(rule && { rule }),
        ...(p.partRot !== undefined && { partRot: p.partRot }),
        // A part's own correction was read for that part: the table has no say, so nothing is disputed.
        disputed: rule && p.partRot === undefined ? disagreeing(p.name, table, rule) : [],
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

/** One line for the README: the correction used and the table lines that contradict it. */
export function describeDispute(l: CplLine): string {
  const used = l.rule ? `transformations.csv line ${l.rule.row} (\`${l.rule.source}\` ${l.rule.rot})` : "no table line";
  return `${l.ref}: ${l.rotation}° uses ${used}; ` + l.disputed.map((d) => `line ${d.row} (\`${d.source}\`) says ${d.rot}`).join(", ");
}

export function cplCsv(lines: CplLine[]): string {
  return csv([CPL_HEADER, ...lines.map((l) => [l.ref, mm(l.x), mm(l.y), l.layer, String(l.rotation)])]);
}
