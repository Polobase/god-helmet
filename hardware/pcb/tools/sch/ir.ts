// Intermediate representation of one generated sheet (one .kicad_sch file): everything the emitter writes and the
// connectivity model checks. All coordinates are sheet IU (y down). A one-sheet design is one SheetIR; a design
// with pages is a root SheetIR (sheet symbols only) plus one SheetIR per page.
import type { Mirror, Pt, Rot } from "../kicad/geometry.ts";
import type { LibPin, SymbolInfo } from "../kicad/symlib.ts";
import type { Paper } from "./dsl.ts";

export interface FieldPlacement {
  at: Pt;
  /** Text angle as written to the file (90 on 90°/270° symbols renders horizontal). */
  angle: 0 | 90;
  hidden: boolean;
}

export interface PlacedUnit {
  kind: "part" | "power" | "flag";
  /** Seed for the symbol UUID (and, with /pin/<n>, the pin UUIDs). */
  uuidName: string;
  libId: string;
  info: SymbolInfo;
  unit: number;
  at: Pt;
  rot: Rot;
  mirror?: Mirror;
  ref: string;
  value: string;
  footprint: string;
  datasheet: string;
  description: string;
  /** Extra hidden fields, in output order (LCSC, MPN, …). */
  extraFields: [string, string][];
  dnp: boolean;
  refField: FieldPlacement;
  valueField: FieldPlacement;
  /** parts/<key> for real parts. */
  partKey?: string;
  /** A board feature that is no part (parts DB assembly "none": a solder jumper, a test pad, a mounting
   *  hole): its symbol is kept out of the BOM and the position files, like its footprint. */
  feature?: boolean;
}

export interface Wire {
  a: Pt;
  b: Pt;
}

export interface Label {
  text: string;
  at: Pt;
  angle: 0 | 90 | 180 | 270;
}

export interface SheetText {
  text: string;
  at: Pt;
  size: number;
}

/** A sheet symbol on the root sheet: one page of a hierarchical design. */
export interface SheetSymbol {
  /** The page's id (DSL `sheets[].id`). */
  id: string;
  /** Sheet name (the page's title). */
  name: string;
  /** File name of the page, next to the root file. */
  file: string;
  /** Seed of the sheet symbol's UUID: "<project>/sheet/<id>". */
  uuidName: string;
  /** Page number, "2" for the first page. */
  page: string;
  /** Top-left corner and size of the box. */
  at: Pt;
  size: Pt;
  nameField: FieldPlacement;
  fileField: FieldPlacement;
}

export interface SheetIR {
  project: string;
  rootUuid: string;
  /** Seed of this file's own (uuid …): "<project>/root" for the root sheet, "<project>/page/<id>" for a page. */
  fileUuidName: string;
  /** Prefix of the UUID seeds of the sheet's texts, junctions, no-connects, wires and labels: "<project>" on the
   *  root sheet (as before pages existed), "<project>/page/<id>" on a page, so equal geometry on two pages never
   *  gives two items one UUID. */
  seed: string;
  /** Instance path of every symbol on the sheet: "/<rootUuid>" on the root, "/<rootUuid>/<sheetUuid>" on a page. */
  instancePath: string;
  /** Set on a page of a hierarchical design; absent on the root sheet. */
  page?: { id: string; title: string; number: string; file: string };
  paper: Paper;
  titleBlock: { title: string; date: string; rev: string; company?: string; comments: string[] };
  units: PlacedUnit[];
  wires: Wire[];
  labels: Label[];
  /** Global labels (KiCad `global_label`): the names of nets whose pins are on more than one page. */
  globalLabels: Label[];
  junctions: Pt[];
  noConnects: Pt[];
  texts: SheetText[];
  /** Root sheet of a hierarchical design: one sheet symbol per page, in page order. */
  sheets: SheetSymbol[];
}

/** A pin of a placed unit in sheet space. */
export interface SheetPin {
  unit: PlacedUnit;
  pin: LibPin;
  at: Pt;
  /** Unit vector pointing away from the symbol body. */
  out: Pt;
}
