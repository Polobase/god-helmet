// Emit a sheet IR as a native KiCad 10 schematic (.kicad_sch, format 20260306).
//
// Element layout follows what eeschema 10.0.6 writes (checked by re-saving with
// `kicad-cli sch upgrade --force`): header, title block, embedded lib_symbols, texts, junctions,
// no-connects, wires, labels, global labels, symbols, sheet symbols, sheet_instances (eeschema sorts items by type,
// then UUID: SCH_IO_KICAD_SEXPR::Format). Every UUID is derived from a stable name, so output is byte-identical for
// identical input. A hierarchical design is several files (the root sheet and one per page), emitted together so
// that no UUID repeats across them.
import { atom, child, l, num, print, str, type Item, type List } from "../sexpr/sexpr.ts";
import { iuToMm, ptKey, type Pt } from "./geometry.ts";
import type { FieldPlacement, Label, PlacedUnit, SheetIR, SheetSymbol } from "../sch/ir.ts";
import { TOOLCHAIN, uuidv5 } from "./uuid.ts";

/** Native schematic format of KiCad 10.0.x (eeschema/sch_file_versions.h). */
export const SCH_FILE_VERSION = 20260306;

const mm = (iu: number) => num(iuToMm(iu));
const yes = (b: boolean) => (b ? "yes" : "no");
/** Every UUID name used in the files emitted together; KiCad silently renumbers duplicates, so refuse them. */
let seenUuids: Set<string> | null = null;
const uuid = (name: string) => {
  if (seenUuids) {
    if (seenUuids.has(name)) throw new Error(`duplicate UUID seed "${name}" in generated schematic`);
    seenUuids.add(name);
  }
  return l("uuid", str(uuidv5(name)));
};
const font = (sizeIu = 12_700) => l("font", l("size", mm(sizeIu), mm(sizeIu)));

function property(name: string, value: string, f: FieldPlacement, extra: Item[] = []): List {
  return l("property", str(name), str(value), l("at", mm(f.at.x), mm(f.at.y), f.angle),
    f.hidden && l("hide", "yes"), l("show_name", "no"), l("do_not_autoplace", "no"),
    l("effects", font(), ...extra));
}

function hiddenAt(at: Pt): FieldPlacement {
  return { at, angle: 0, hidden: true };
}

/** Embedded library symbol: the vendored definition with its name replaced by the lib id.
 *  Unit sub-symbols keep their unprefixed names (e.g. "R_0_1"), exactly as eeschema writes. */
function embedded(u: PlacedUnit): List {
  const n = u.info.node;
  return { type: "list", items: [n.items[0]!, str(u.libId), ...n.items.slice(2)] };
}

/** Symbol attribute flags copied from the library symbol (e.g. power symbols keep theirs). A board feature
 *  that is no part is out of the BOM and the position files whatever its library symbol says: the stock
 *  footprints of solder jumpers, test pads and mounting holes carry both exclusions, and DRC's schematic
 *  parity compares the two. */
function flagsOf(u: PlacedUnit) {
  const flag = (h: string, dflt: boolean) => {
    const v = atom(child(u.info.node, h), 1);
    return v === undefined ? dflt : v === "yes";
  };
  const part = !u.feature;
  return { sim: flag("exclude_from_sim", false), bom: part && flag("in_bom", true), board: flag("on_board", true), pos: part && flag("in_pos_files", true) };
}

function symbolInstance(u: PlacedUnit, ir: SheetIR): List {
  const f = flagsOf(u);
  const pins = u.info.pins; // every placed unit lists all pins of the symbol, as eeschema does
  const seen = new Set<string>();
  return l("symbol",
    l("lib_id", str(u.libId)),
    l("at", mm(u.at.x), mm(u.at.y), u.rot),
    u.mirror && l("mirror", u.mirror),
    l("unit", u.unit),
    l("body_style", 1),
    l("exclude_from_sim", yes(f.sim)),
    l("in_bom", yes(f.bom)),
    l("on_board", yes(f.board)),
    l("in_pos_files", yes(f.pos)),
    l("dnp", yes(u.dnp)),
    uuid(u.uuidName),
    property("Reference", u.ref, u.refField),
    property("Value", u.value, u.valueField),
    property("Footprint", u.footprint, hiddenAt(u.at)),
    property("Datasheet", u.datasheet, hiddenAt(u.at)),
    property("Description", u.description, hiddenAt(u.at)),
    ...u.extraFields.map(([k, v]) => property(k, v, hiddenAt(u.at))),
    ...pins.filter((p) => !seen.has(p.number) && seen.add(p.number)).map((p) => l("pin", str(p.number), uuid(`${u.uuidName}/pin/${p.number}`))),
    l("instances", l("project", str(ir.project), l("path", str(ir.instancePath), l("reference", str(u.ref)), l("unit", u.unit)))),
  );
}

/** A global label (a net on more than one page). Its Intersheetrefs field is written hidden at the label's
 *  position, so KiCad keeps it as written instead of placing it (it shows only when the project turns on
 *  intersheet references anyway). */
function globalLabel(lb: Label, seed: string): List {
  const justify = lb.angle === 0 || lb.angle === 90 ? "left" : "right";
  return l("global_label", str(lb.text),
    l("shape", "passive"),
    l("at", mm(lb.at.x), mm(lb.at.y), lb.angle),
    l("effects", font(), l("justify", justify)),
    uuid(`${seed}/global/${lb.text}/${ptKey(lb.at)}`),
    property("Intersheetrefs", "${INTERSHEET_REFS}", hiddenAt(lb.at), [l("justify", justify)]));
}

/** A page's sheet symbol on the root sheet: a box with its name above and its file below, no sheet pins. */
function sheetSymbol(s: SheetSymbol, ir: SheetIR): List {
  const field = (name: string, value: string, f: FieldPlacement, v: "bottom" | "top") =>
    l("property", str(name), str(value), l("at", mm(f.at.x), mm(f.at.y), f.angle), l("show_name", "no"), l("do_not_autoplace", "no"),
      l("effects", font(), l("justify", "left", v)));
  return l("sheet",
    l("at", mm(s.at.x), mm(s.at.y)),
    l("size", mm(s.size.x), mm(s.size.y)),
    l("exclude_from_sim", "no"),
    l("in_bom", "yes"),
    l("on_board", "yes"),
    l("dnp", "no"),
    l("stroke", l("width", 0), l("type", "solid")),
    l("fill", l("color", 0, 0, 0, 0)),
    uuid(s.uuidName),
    field("Sheetname", s.name, s.nameField, "bottom"),
    field("Sheetfile", s.file, s.fileField, "top"),
    l("instances", l("project", str(ir.project), l("path", str(`/${ir.rootUuid}`), l("page", str(s.page))))),
  );
}

export function emitSchematic(ir: SheetIR, generatorVersion: string): string {
  return emitSheets([ir], generatorVersion)[0]!;
}

/** The files of one schematic (the root sheet, then its pages), with UUIDs unique across all of them. */
export function emitSheets(irs: SheetIR[], generatorVersion: string): string[] {
  seenUuids = new Set(irs.map((ir) => ir.fileUuidName));
  if (seenUuids.size !== irs.length) throw new Error("two sheets of one schematic have the same file UUID seed");
  try {
    return irs.map((ir) => emitDocument(ir, generatorVersion));
  } finally {
    seenUuids = null;
  }
}

function emitDocument(ir: SheetIR, generatorVersion: string): string {
  const P = ir.seed;
  const libSymbols = new Map<string, List>();
  for (const u of ir.units) if (!libSymbols.has(u.libId)) libSymbols.set(u.libId, embedded(u));
  const byUuid = <T>(items: T[], name: (t: T) => string) =>
    items.map((t) => ({ t, id: uuidv5(name(t)) })).sort((a, b) => a.id.localeCompare(b.id)).map((x) => x.t);

  const tb = ir.titleBlock;
  const doc = l("kicad_sch",
    l("version", SCH_FILE_VERSION),
    l("generator", str(TOOLCHAIN)),
    l("generator_version", str(generatorVersion)),
    l("uuid", str(uuidv5(ir.fileUuidName))),
    l("paper", str(ir.paper)),
    l("title_block", l("title", str(tb.title)), l("date", str(tb.date)), l("rev", str(tb.rev)),
      tb.company !== undefined && l("company", str(tb.company)),
      ...tb.comments.map((c, i) => l("comment", i + 1, str(c)))),
    l("lib_symbols", ...[...libSymbols.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, s]) => s)), // byte order, as eeschema
    ...byUuid(ir.texts, (t) => `${P}/text/${ptKey(t.at)}`).map((t) =>
      l("text", str(t.text), l("exclude_from_sim", "no"), l("at", mm(t.at.x), mm(t.at.y), 0),
        l("effects", font(t.size), l("justify", "left", "bottom")), uuid(`${P}/text/${ptKey(t.at)}`))),
    ...byUuid(ir.junctions, (p) => `${P}/junction/${ptKey(p)}`).map((p) =>
      l("junction", l("at", mm(p.x), mm(p.y)), l("diameter", 0), l("color", 0, 0, 0, 0), uuid(`${P}/junction/${ptKey(p)}`))),
    ...byUuid(ir.noConnects, (p) => `${P}/nc/${ptKey(p)}`).map((p) => l("no_connect", l("at", mm(p.x), mm(p.y)), uuid(`${P}/nc/${ptKey(p)}`))),
    ...byUuid(ir.wires, (w) => `${P}/wire/${ptKey(w.a)}/${ptKey(w.b)}`).map((w) =>
      l("wire", l("pts", l("xy", mm(w.a.x), mm(w.a.y)), l("xy", mm(w.b.x), mm(w.b.y))),
        l("stroke", l("width", 0), l("type", "default")), uuid(`${P}/wire/${ptKey(w.a)}/${ptKey(w.b)}`))),
    ...byUuid(ir.labels, (lb) => `${P}/label/${lb.text}/${ptKey(lb.at)}`).map((lb) =>
      l("label", str(lb.text), l("at", mm(lb.at.x), mm(lb.at.y), lb.angle),
        l("effects", font(), l("justify", lb.angle === 0 || lb.angle === 90 ? "left" : "right", "bottom")),
        uuid(`${P}/label/${lb.text}/${ptKey(lb.at)}`))),
    ...byUuid(ir.globalLabels, (lb) => `${P}/global/${lb.text}/${ptKey(lb.at)}`).map((lb) => globalLabel(lb, P)),
    ...byUuid(ir.units, (u) => u.uuidName).map((u) => symbolInstance(u, ir)),
    ...byUuid(ir.sheets, (s) => s.uuidName).map((s) => sheetSymbol(s, ir)),
    // Only the root sheet lists its own page; a page's number lives in its sheet symbol's instances.
    !ir.page && l("sheet_instances", l("path", str("/"), l("page", str("1")))),
  );
  return print(doc);
}
