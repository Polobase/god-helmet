// Schematic-as-code DSL: what a module's schematic.ts exports (netlist first, placement hints).
//
// Coordinates are grid units on the sheet (1 = 1.27 mm, origin top-left, y down), so every
// symbol origin and connection point is on KiCad's 50 mil connection grid by construction.
// Pins are "<partKey>.<pin number>" (or ".<pin name>" when the name is unique on the symbol).
//
// A design is one sheet, or with `sheets` a root sheet plus one page per entry (a KiCad hierarchy: the root holds a
// sheet symbol per page). Every part (or each unit of a multi-unit part) then names its page with `sheet`, and its
// coordinates are on that page. Nets still connect by name: across pages through global labels and power symbols.
import * as z from "zod";

export const GridPt = z.tuple([z.number().int(), z.number().int()]);
export type GridPt = z.infer<typeof GridPt>;

export const Rot = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
export const MirrorAxis = z.enum(["x", "y"]);

/** Page id: a slug (it names the page's file, `<project>-<id>.kicad_sch`, and seeds UUIDs; never rename casually). */
export const SheetId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, "page ids are slugs: a-z, 0-9 and -");

const Placement = z.strictObject({
  at: GridPt,
  rot: Rot.optional(),
  mirror: MirrorAxis.optional(),
  /** Page of this unit, when it differs from the part's `sheet` (the power unit of a quad op-amp on the supplies page). */
  sheet: SheetId.optional(),
});

export const PartKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, "part keys are identifiers (they seed UUIDs; never rename casually)");
export const PinRef = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*\.[^\s.]+$/, 'expected "<partKey>.<pin>"');

export const PartInstance = z
  .strictObject({
    /** Reference designator; may be renumbered freely (UUIDs derive from the part key). */
    ref: z.string().regex(/^[A-Z]{1,3}[0-9]{1,3}$/),
    /** Key into parts/<key>.yaml. */
    part: z.string().min(1),
    /** Value (a key of the part's `values`); defaults to the part's only value. */
    value: z.string().optional(),
    dnp: z.boolean().optional(),
    /** Placement for single-unit symbols. */
    at: GridPt.optional(),
    rot: Rot.optional(),
    mirror: MirrorAxis.optional(),
    /** Placement per unit for multi-unit symbols (all units must be placed). */
    units: z.record(z.string().regex(/^[1-9][0-9]*$/), Placement).optional(),
    /** Page (an id of the design's `sheets`); required in a design with pages, unless every unit names its own. */
    sheet: SheetId.optional(),
  })
  .refine((p) => (p.at === undefined) !== (p.units === undefined), "give either `at` (single unit) or `units`")
  .refine((p) => p.units === undefined || (p.rot === undefined && p.mirror === undefined), "rot/mirror go inside `units` for multi-unit parts");

export const Net = z.strictObject({
  pins: z.array(PinRef).min(1),
  /** Net is a KiCad power net: every pin gets a power symbol named like the net (power:<name>). */
  power: z.boolean().optional(),
  /** Explicit orthogonal wires; each path is a list of pins and/or grid points. Pins not on a wire
   *  get a short stub with a local label. */
  wires: z.array(z.array(z.union([PinRef, GridPt])).min(2)).optional(),
  /** Show the net name on a fully wired net too (a label on its longest wire). */
  label: z.boolean().optional(),
  /** Pin whose stub carries the PWR_FLAG when the net needs one (default: first pin). */
  flagAt: PinRef.optional(),
});

/** Drawing sheets a schematic may use, with their size in mm (landscape, KiCad's page sizes). A2 to A0 are for
 *  very many parts on one sheet; a large board reads better as pages (`sheets`), A3 each by default. */
export const PAPER_MM = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] } as const;
export type Paper = keyof typeof PAPER_MM;

/** A page of a hierarchical design. Its title is the sheet name KiCad shows (sheet symbol, title block, netlist
 *  paths such as "/Power supply/"), so it must be unique and pass KiCad 10.0.6's sheet-name validator: no "/" (the
 *  sheet path separator), no line break or tab (common/validators.cpp, FIELD_VALIDATOR). */
export const Sheet = z.strictObject({
  id: SheetId,
  title: z.string().min(1).regex(/^[^/\r\n\t]+$/, 'page titles are KiCad sheet names: no "/" (KiCad\'s sheet path separator), line breaks or tabs'),
  paper: z.enum(["A4", "A3", "A2", "A1", "A0"]).default("A3"),
});
export type Sheet = z.output<typeof Sheet>;

export const Design = z.strictObject({
  /** Project id = module id; file names and UUID namespace. */
  project: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
  sheet: z.strictObject({
    paper: z.enum(["A4", "A3", "A2", "A1", "A0"]).default("A4"),
    title: z.string().min(1),
    rev: z.string().min(1),
    /** Fixed date (never the clock), so regeneration is byte-identical. */
    date: z.iso.date(),
    company: z.string().optional(),
  }),
  parts: z.record(PartKey, PartInstance),
  nets: z.record(z.string().regex(/^[^\s"]+$/), Net),
  noConnect: z.array(PinRef).default([]),
  /** Free text. In a design with pages, `sheet` names the page; text without one goes on the root sheet (an overview). */
  text: z.array(z.strictObject({ at: GridPt, text: z.string().min(1), size: z.number().positive().optional(), sheet: SheetId.optional() })).default([]),
  /** Pages, in order (page numbers 2, 3, … after the root's 1). Without it the design is one sheet. */
  sheets: z.array(Sheet).min(1).optional(),
}).superRefine((d, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const ids = new Set<string>();
  const titles = new Map<string, string>();
  (d.sheets ?? []).forEach((s, i) => {
    if (ids.has(s.id)) issue(["sheets", i, "id"], `page id ${s.id} is used twice`);
    ids.add(s.id);
    // KiCad refuses two sheets of one name in a sheet (and names nets by them).
    const t = s.title.toLowerCase();
    if (titles.has(t)) issue(["sheets", i, "title"], `pages ${titles.get(t)} and ${s.id} have the same title`);
    titles.set(t, s.id);
  });
  const paged = d.sheets !== undefined;
  const known = (id: string | undefined, path: (string | number)[], what: string) => {
    if (id === undefined) return;
    if (!paged) issue(path, `${what} names page "${id}", but the design has no \`sheets\``);
    else if (!ids.has(id)) issue(path, `${what} names page "${id}", which is not in \`sheets\` (${[...ids].join(", ")})`);
  };
  for (const [key, p] of Object.entries(d.parts)) {
    known(p.sheet, ["parts", key, "sheet"], `part ${key}`);
    for (const [u, pl] of Object.entries(p.units ?? {})) known(pl.sheet, ["parts", key, "units", u, "sheet"], `part ${key} unit ${u}`);
    if (!paged) continue;
    if (p.units === undefined && p.sheet === undefined) issue(["parts", key, "sheet"], `part ${key} needs \`sheet\`: the design has pages`);
    for (const [u, pl] of Object.entries(p.units ?? {})) {
      if (pl.sheet === undefined && p.sheet === undefined) issue(["parts", key, "units", u, "sheet"], `part ${key} unit ${u} needs a page: give the part (or the unit) \`sheet\``);
    }
  }
  d.text.forEach((t, i) => known(t.sheet, ["text", i, "sheet"], "text"));
});

export type DesignInput = z.input<typeof Design>;
export type Design = z.output<typeof Design>;

/** Typed identity helper for schematic.ts files; the builder validates the design. */
export const defineSchematic = (d: DesignInput): DesignInput => d;
