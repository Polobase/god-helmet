// Schematics with pages (DSL `sheets`): the rules of the DSL, the builder's per-page checks, and what the emitter
// writes (root sheet with sheet symbols, one file per page, global labels for cross-page nets only, page numbers,
// instance paths). KiCad's side is tests/kicad/pages.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { emitProject } from "../kicad/emit-pro.ts";
import { rootUuid, sheetUuid, UUID_V5_RE, uuidv5 } from "../kicad/uuid.ts";
import { sha256File } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";
import { loadAllParts } from "../module/load.ts";
import { atomNum, atomStr, child, children, parse, type List } from "../sexpr/sexpr.ts";
import pagesProof from "../../tests/fixtures/pages-proof/schematic.ts";
import proof from "../../tests/fixtures/pipeline-proof/schematic.ts";
import { approvalProblems } from "./approve.ts";
import { buildSchematic, BuildError, loadVendored, sheetsOf } from "./build.ts";
import { computeConnectivity } from "./connectivity.ts";
import type { DesignInput } from "./dsl.ts";
import { schematicFiles, schematicSha256, strayPageFiles } from "./files.ts";
import { reviewMarkdown, sheetPathOf, writeGenerated, type ErcOutcome, type GateRecord } from "./gates.ts";
import { generate } from "./generate.ts";

const ctx = { parts: loadAllParts(paths.parts), lib: loadVendored() };
const clone = (d: DesignInput): DesignInput => structuredClone(d);
const P = "pages-proof";
const tmp = mkdtempSync(join(tmpdir(), "ghp-pages-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function problemsOf(d: DesignInput): string[] {
  try {
    buildSchematic(d, ctx);
    return [];
  } catch (e) {
    if (e instanceof BuildError) return e.problems;
    throw e;
  }
}

/** A small two-page design: R1 on page a, R2 on page b, joined by net X; GND on both pages. */
const twoPages = (): DesignInput => ({
  project: "two-pages",
  sheet: { paper: "A4", title: "t", rev: "A", date: "2026-11-13" },
  sheets: [{ id: "a", title: "Page A", paper: "A4" }, { id: "b", title: "Page B", paper: "A4" }],
  parts: {
    r1: { ref: "R1", part: "res-0603", value: "10k", at: [40, 40], sheet: "a" },
    r2: { ref: "R2", part: "res-0603", value: "10k", at: [40, 40], sheet: "b" },
  },
  nets: { X: { pins: ["r1.1", "r2.1"] }, GND: { power: true, pins: ["r1.2", "r2.2"] } },
});

describe("DSL rules for pages", () => {
  test("the two-page design builds; equal coordinates on two pages do not overlap", () => {
    expect(problemsOf(twoPages())).toEqual([]);
  });

  test("with `sheets`, every part names a page that exists", () => {
    const d = twoPages();
    delete d.parts.r2!.sheet;
    d.parts.r1!.sheet = "c";
    const p = problemsOf(d).join("\n");
    expect(p).toContain("part r2 needs `sheet`: the design has pages");
    expect(p).toContain('part r1 names page "c", which is not in `sheets`');
  });

  test("without `sheets`, no part, unit or text may name a page", () => {
    const d = clone(proof);
    d.parts.rOut!.sheet = "x";
    d.parts.amp!.units!["3"]!.sheet = "x";
    d.text = [{ at: [10, 10], text: "t", sheet: "x" }];
    const p = problemsOf(d).join("\n");
    expect(p).toContain('part rOut names page "x", but the design has no `sheets`');
    expect(p).toContain('part amp unit 3 names page "x"');
    expect(p).toContain('text names page "x"');
  });

  test("units of one part on several pages: each unit resolves to a page (its own `sheet`, else the part's)", () => {
    const d = clone(pagesProof);
    delete d.parts.amp!.sheet;
    const p = problemsOf(d).join("\n");
    // units 3, 4 and 5 name their own page; 1 and 2 relied on the part's
    expect(p).toContain("part amp unit 1 needs a page");
    expect(p).toContain("part amp unit 2 needs a page");
    expect(p).not.toContain("unit 3 needs a page");
    for (const u of ["1", "2"]) d.parts.amp!.units![u]!.sheet = "signal";
    expect(problemsOf(d)).toEqual([]);
  });

  test("page ids are slugs, unique; titles unique and usable as KiCad sheet names", () => {
    const d = twoPages();
    d.sheets = [{ id: "a", title: "Same" }, { id: "a", title: "same" }, { id: "B_c", title: "x/y" }];
    const p = problemsOf(d).join("\n");
    expect(p).toContain("page id a is used twice");
    expect(p).toContain("pages a and a have the same title");
    expect(p).toContain("page ids are slugs");
    expect(p).toContain('page titles are KiCad sheet names: no "/"');
  });

  test("a page's paper defaults to A3", () => {
    const d = twoPages();
    d.sheets = [{ id: "a", title: "Page A" }, { id: "b", title: "Page B", paper: "A2" }];
    const r = buildSchematic(d, ctx);
    expect(r.pages.map((p) => p.paper)).toEqual(["A3", "A2"]);
    expect(r.ir.paper).toBe("A4"); // the root keeps sheet.paper
  });
});

describe("builder checks per page", () => {
  test("a wire may only join pins on one page", () => {
    const d = twoPages();
    d.nets.X!.wires = [["r1.1", [40, 30], "r2.1"]];
    expect(problemsOf(d).join("\n")).toContain("net X: a wire joins pins on different pages (a, b)");
  });

  test("a wire path without a pin takes the page of the wire it touches, or is refused", () => {
    const d = twoPages();
    d.parts.r3 = { ref: "R3", part: "res-0603", value: "10k", at: [60, 40], sheet: "a" };
    d.nets.X!.pins.push("r3.1");
    d.nets.GND!.pins.push("r3.2");
    // r1.1 is at (40, 37), r3.1 at (60, 37): a wire from r1.1 along y = 34, and a branch of grid points only down
    // to r3.1, which lies on page a because it touches that wire (X also has a pin on page b)
    d.nets.X!.wires = [["r1.1", [40, 34], [60, 34]], [[60, 34], [60, 37]]];
    const r = buildSchematic(d, ctx);
    expect(r.pages[0]!.wires.some((w) => w.a.x === w.b.x && w.a.x === 60 * 12_700)).toBe(true);
    expect(r.pages[1]!.wires.some((w) => w.a.x === 60 * 12_700)).toBe(false);
    d.nets.X!.wires = [["r1.1", [40, 34]], [[70, 20], [80, 20]]];
    expect(problemsOf(d).join("\n")).toContain("net X: wire 2 (889000,254000 -> 1016000,254000) has no pin, and the wires it touches do not tell its page");
  });

  test("two pages drawn alike: a path split in parts keeps the page of the parts it continues; a tie is refused", () => {
    const d = twoPages();
    d.parts.r3 = { ref: "R3", part: "res-0603", value: "10k", at: [60, 40], sheet: "a" };
    d.parts.r4 = { ref: "R4", part: "res-0603", value: "10k", at: [60, 40], sheet: "b" };
    d.nets.X!.pins.push("r3.1", "r4.1");
    d.nets.GND!.pins.push("r3.2", "r4.2");
    // The same three parts on both pages; the middle part has no pin and touches both pages' wires.
    d.nets.X!.wires = [
      ["r1.1", [40, 34]], [[40, 34], [60, 34]], [[60, 34], "r3.1"],
      ["r2.1", [40, 34]], [[40, 34], [60, 34]], [[60, 34], "r4.1"],
    ];
    const r = buildSchematic(d, ctx);
    for (const p of r.pages) expect(p.wires.some((w) => w.a.y === 34 * 12_700 && w.b.y === 34 * 12_700)).toBe(true);
    expect(computeConnectivity(r.pages).problems).toEqual([]);
    // Listed between a part of page a and a part of page b, at the same distance: no page can be told.
    d.nets.X!.wires = [["r1.1", [40, 34]], [[40, 34], [60, 34]], ["r2.1", [40, 34]], [[60, 34], "r3.1"], [[60, 34], "r4.1"]];
    expect(problemsOf(d).join("\n")).toContain("net X: wire 2 (");
  });

  test("overlap, drawing area and title block are checked on each page with its own paper", () => {
    const d = twoPages();
    d.parts.r3 = { ref: "R3", part: "res-0603", value: "10k", at: [40, 40], sheet: "a" };
    d.nets.X!.pins.push("r3.1");
    d.nets.GND!.pins.push("r3.2");
    expect(problemsOf(d).join("\n")).toContain("page a: symbols R1/1 and R3/1 overlap");
    // (300, 100) grid units = (381, 127) mm: outside A4, inside A3
    const far = twoPages();
    far.parts.r2!.at = [300, 100];
    expect(problemsOf(far).join("\n")).toContain("page b: item at");
    far.sheets![1]!.paper = "A3";
    expect(problemsOf(far)).toEqual([]);
  });

  test("two nets meeting on a page are named with the spot, not only as merged nets", () => {
    const d = twoPages();
    // R3 right under R1 on page a: R1.2's GND stub (with GND's PWR_FLAG) reaches R3.1 (net X), whose label stub
    // reaches back up to R1.2.
    d.parts.r3 = { ref: "R3", part: "res-0603", value: "10k", at: [40, 48], sheet: "a" };
    d.nets.X!.pins.push("r3.1");
    d.nets.GND!.pins.push("r3.2");
    const p = problemsOf(d);
    expect(p).toContain("page a: pin R3.1 (net X) and PWR_FLAG of GND (net GND) meet at (50.8, 57.15) mm");
    expect(p).toContain("page a: pin R1.2 (net GND) and label X (net X) meet at (50.8, 54.61) mm");
    expect(p).toContain("page a: a wire of net GND ((50.8, 54.61) mm to (50.8, 57.15) mm) runs into pin R3.1 (net X) at (50.8, 57.15) mm");
    expect(p.join("\n")).not.toContain("connectivity of net");
    // The same parts on page b alone are fine: the check is per page.
    d.parts.r3!.sheet = "b";
    d.parts.r3!.at = [60, 48];
    expect(problemsOf(d)).toEqual([]);
  });

  test("text goes on its page; text without a page goes on the root and must not sit on a sheet symbol", () => {
    const d = twoPages();
    d.text = [{ at: [20, 20], text: "on a", sheet: "a" }, { at: [20, 20], text: "on b", sheet: "b" }, { at: [20, 60], text: "overview" }];
    const r = buildSchematic(d, ctx);
    expect(r.pages.map((p) => p.texts.map((t) => t.text))).toEqual([["on a"], ["on b"]]);
    expect(r.ir.texts.map((t) => t.text)).toEqual(["overview"]);
    d.text = [{ at: [25, 25], text: "on the box" }];
    expect(problemsOf(d).join("\n")).toContain('root sheet: text "on the box" sits on the sheet symbol of page a');
  });

  test("a root sheet too small for its sheet symbols is refused", () => {
    const d = twoPages();
    d.sheets = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, title: `P${i}` }));
    d.parts.r1!.sheet = "p0";
    d.parts.r2!.sheet = "p1";
    expect(problemsOf(d).join("\n")).toContain("the root sheet (A4) has no room for 15 sheet symbols");
    d.sheet.paper = "A3";
    expect(problemsOf(d)).toEqual([]);
  });
});

describe("pages-proof builds", () => {
  const r = buildSchematic(pagesProof, ctx);
  const page = (id: string) => r.pages.find((p) => p.page!.id === id)!;

  test("the root holds one sheet symbol per page and no symbols; each page its own parts and units", () => {
    expect(r.ir.units).toEqual([]);
    expect(r.ir.sheets.map((s) => [s.name, s.file, s.page])).toEqual([
      ["Power", "pages-proof-power.kicad_sch", "2"], ["Signal", "pages-proof-signal.kicad_sch", "3"], ["Output", "pages-proof-output.kicad_sch", "4"],
    ]);
    const unitsOf = (id: string) => page(id).units.filter((u) => u.kind === "part" && u.ref === "U2").map((u) => u.unit).sort();
    expect([unitsOf("power"), unitsOf("signal"), unitsOf("output")]).toEqual([[5], [1, 2], [3, 4]]);
    expect(r.bom.find((b) => b.ref === "U2")!.pages).toEqual(["power", "signal", "output"]);
  });

  test("global labels only for nets on more than one page, local labels for the rest", () => {
    const global = (id: string) => page(id).globalLabels.map((l) => l.text).sort();
    const local = (id: string) => page(id).labels.map((l) => l.text).sort();
    expect([global("power"), global("signal"), global("output")]).toEqual([["VREF"], ["BUF", "VREF"], ["BUF"]]);
    expect([local("power"), local("signal"), local("output")]).toEqual([[], [], ["OUT", "OUT", "OUT_R", "OUT_R"]]);
    // +12V and -12V stay on the power page; GND is on all three
    expect(r.nets.filter((n) => n.pages.length > 1).map((n) => n.name).sort()).toEqual(["BUF", "GND", "VREF"]);
  });

  test("power symbols on every page a power net is on, one PWR_FLAG per net, references unique across pages", () => {
    const gndPages = r.pages.filter((p) => p.units.some((u) => u.kind === "power" && u.value === "GND")).map((p) => p.page!.id);
    expect(gndPages).toEqual(["power", "signal", "output"]);
    const flags = sheetsOf(r).flatMap((s) => s.units.filter((u) => u.kind === "flag").map((u) => u.uuidName.split("/").pop()));
    expect(flags.sort()).toEqual(["+12V", "-12V", "GND"]);
    const refs = sheetsOf(r).flatMap((s) => s.units.filter((u) => u.kind !== "part").map((u) => u.ref));
    expect(new Set(refs).size).toBe(refs.length);
  });

  test("connectivity across pages equals the declared nets; each page alone splits the cross-page nets", () => {
    const all = computeConnectivity(r.pages);
    expect(all.problems).toEqual([]);
    for (const n of r.nets) expect(all.nets.some((c) => c.pins.join() === n.pins.join())).toBe(true);
    const signal = computeConnectivity(page("signal"));
    expect(signal.nets.find((c) => c.names.includes("VREF"))!.pins).toEqual(["U2.3"]);
  });
});

describe("emitted files", () => {
  const dir = join(tmp, "emit");
  const g = generate(P, pagesProof, { dir });
  const text = (f: string) => g.files.get(join(dir, f))!;
  const doc = (f: string) => parse(text(f));
  const root = rootUuid(P);

  test("the root file and one file per page, in page order; regeneration is byte-identical", () => {
    expect(g.schPaths.map((f) => basename(f))).toEqual(["pages-proof.kicad_sch", "pages-proof-power.kicad_sch", "pages-proof-signal.kicad_sch", "pages-proof-output.kicad_sch"]);
    const again = generate(P, pagesProof, { dir });
    for (const f of g.schPaths) expect(again.files.get(f)).toBe(g.files.get(f)!);
  });

  test("UUIDs are unique RFC 4122 v5 across all files, although two pages reuse coordinates", () => {
    const ids = g.schPaths.flatMap((f) => [...g.files.get(f)!.matchAll(/\(uuid "([^"]+)"\)/g)].map((m) => m[1]!));
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(UUID_V5_RE);
  });

  test("page numbers: the root is page 1 (sheet_instances), the pages 2.. in `sheets` order (sheet symbol instances)", () => {
    const rootDoc = doc("pages-proof.kicad_sch");
    expect(atomStr(child(rootDoc, "uuid"), 1)).toBe(root);
    const inst = child(rootDoc, "sheet_instances")!;
    expect(children(inst, "path").map((p) => [atomStr(p, 1), atomStr(child(p, "page"), 1)])).toEqual([["/", "1"]]);
    const sheets = children(rootDoc, "sheet").map((s) => {
      const prop = (n: string) => atomStr(children(s, "property").find((p) => atomStr(p, 1) === n), 2);
      const path = child(child(child(s, "instances")!, "project")!, "path")!;
      return { name: prop("Sheetname"), file: prop("Sheetfile"), uuid: atomStr(child(s, "uuid"), 1), path: atomStr(path, 1), page: atomStr(child(path, "page"), 1) };
    }).sort((a, b) => Number(a.page) - Number(b.page));
    expect(sheets).toEqual(["power", "signal", "output"].map((id, i) => ({
      name: pagesProof.sheets![i]!.title, file: `pages-proof-${id}.kicad_sch`, uuid: sheetUuid(P, id), path: `/${root}`, page: String(i + 2),
    })));
    // A page lists no sheet_instances of its own.
    for (const f of g.schPaths.slice(1)) expect(child(parse(g.files.get(f)!), "sheet_instances")).toBeUndefined();
  });

  test("every symbol on a page is instanced at /<root>/<sheet> with its reference and unit", () => {
    for (const id of ["power", "signal", "output"]) {
      for (const sym of children(doc(`pages-proof-${id}.kicad_sch`), "symbol")) {
        const path = child(child(child(sym, "instances")!, "project")!, "path")!;
        expect(atomStr(path, 1)).toBe(`/${root}/${sheetUuid(P, id)}`);
        expect(atomStr(child(path, "reference"), 1)).toMatch(/^#?[A-Z]+[0-9]+$/);
      }
    }
    const u2c = children(doc("pages-proof-output.kicad_sch"), "symbol").find((s) => atomStr(child(s, "uuid"), 1) === uuidv5(`${P}/part/amp/unit/3`))!;
    const path = child(child(child(u2c, "instances")!, "project")!, "path")!;
    expect([atomStr(child(path, "reference"), 1), atomNum(child(path, "unit"), 1)]).toEqual(["U2", 3]);
  });

  test("global labels are written as KiCad global_label with a passive shape; one-page nets keep local labels", () => {
    const labels = (f: string, kind: string) => children(doc(f), kind).map((n: List) => atomStr(n, 1)).sort();
    expect(labels("pages-proof-signal.kicad_sch", "global_label")).toEqual(["BUF", "VREF"]);
    expect(labels("pages-proof-signal.kicad_sch", "label")).toEqual([]);
    expect(labels("pages-proof-output.kicad_sch", "label")).toEqual(["OUT", "OUT", "OUT_R", "OUT_R"]);
    const gl = children(doc("pages-proof-power.kicad_sch"), "global_label")[0]!;
    expect(atomStr(child(gl, "shape"), 1)).toBe("passive");
    expect(atomStr(children(gl, "property")[0], 1)).toBe("Intersheetrefs");
  });

  test("a one-sheet design has no pages and keeps its single file", () => {
    const one = generate("pipeline-proof", proof, { dir: join(tmp, "one") });
    expect(one.schPaths).toEqual([one.schPath]);
    expect(one.build.pages).toEqual([]);
    expect(one.files.get(one.schPath)).not.toContain("(sheet\n");
  });

  test("the new project file lists the pages' sheets after the root, as KiCad does", () => {
    const pro = JSON.parse([...g.createIfMissing.values()][0]!) as { sheets: string[][] };
    expect(pro.sheets).toEqual([[root, P], [sheetUuid(P, "power"), "Power"], [sheetUuid(P, "signal"), "Signal"], [sheetUuid(P, "output"), "Output"]]);
    expect(JSON.parse(emitProject({ name: "x", rootUuid: "r" })).sheets).toEqual([["r", "x"]]);
  });

  test("sheet paths as KiCad's netlist names them", () => {
    expect(sheetPathOf(g.build.ir)).toEqual({ names: "/", tstamps: "/" });
    expect(sheetPathOf(g.build.pages[0]!)).toEqual({ names: "/Power/", tstamps: `/${sheetUuid(P, "power")}/` });
  });
});

describe("files on disk: hash, stray pages, approval", () => {
  test("the schematic's files and sha256 cover every page; a one-sheet schematic hashes as before", () => {
    const dir = join(tmp, "disk");
    const g = generate(P, pagesProof, { dir });
    writeGenerated(g);
    expect(schematicFiles(g.schPath)).toEqual(g.schPaths);
    const before = schematicSha256(g.schPath);
    writeFileSync(g.schPaths[2]!, g.files.get(g.schPaths[2]!)!.replace("Follower of VREF", "Follower of vref"));
    expect(schematicSha256(g.schPath)).not.toBe(before);
    rmSync(g.schPaths[3]!);
    expect(() => schematicSha256(g.schPath)).toThrow(/pages-proof-output\.kicad_sch not found/);

    const one = generate("pipeline-proof", proof, { dir: join(tmp, "disk-one") });
    writeGenerated(one);
    expect(schematicSha256(one.schPath)).toBe(sha256File(one.schPath));
  });

  test("a page file of a removed page is stray; writing the design removes it", () => {
    const dir = join(tmp, "stray");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pages-proof-old.kicad_sch"), "(kicad_sch)\n");
    writeFileSync(join(dir, "pages-proof-backup.txt"), "not a page\n");
    const g = generate(P, pagesProof, { dir });
    expect(strayPageFiles(dir, P, g.schPaths)).toEqual([join(dir, "pages-proof-old.kicad_sch")]);
    expect(writeGenerated(g)).toContain(join(dir, "pages-proof-old.kicad_sch"));
    expect(strayPageFiles(dir, P, g.schPaths)).toEqual([]);
  });

  test("approval refuses a changed or regenerated page, not just a changed root", () => {
    const dir = join(tmp, "approve");
    const g = generate(P, pagesProof, { dir });
    writeGenerated(g);
    const pdf = join(dir, "p.pdf");
    writeFileSync(pdf, "%PDF-1.5 test\n");
    const record: GateRecord = {
      schematic: g.schPath, schSha256: schematicSha256(g.schPath), inputSha256: "x", pdf, pdfSha256: sha256File(pdf),
      kicadVersion: "10.0.6", git: "test", erc: { errors: 0, warnings: 0, ignored: [] },
    };
    const recordPath = join(dir, "gates.json");
    writeFileSync(recordPath, JSON.stringify(record));
    const pages = new Map(g.schPaths.slice(1).map((f) => [f, g.files.get(f)!]));
    const inputs = { schPath: g.schPath, recordPath, root: "/", generated: g.files.get(g.schPath)!, pages };
    expect(approvalProblems(inputs)).toEqual([]);
    expect(approvalProblems({ ...inputs, pages: new Map([...pages].map(([f, t]) => [f, `${t} `])) }).join()).toContain("no longer generates this schematic (pages-proof-power.kicad_sch");
    writeFileSync(g.schPaths[1]!, `${g.files.get(g.schPaths[1]!)!}\n`);
    expect(approvalProblems(inputs).join()).toContain("changed after the last passing gate run");
  });
});

test("review.md lists the pages, and each net and part with the pages it is on", () => {
  const g = generate(P, pagesProof, { dir: join(tmp, "review") });
  const erc: ErcOutcome = { errors: 0, warnings: 0, excluded: 0, types: [], ignored: [], extraIgnored: [], kicadVersion: "10.0.6", jsonPath: "", rptPath: "" };
  const md = reviewMarkdown(g, erc, "abc", "10.0.6", join(tmp, "review", "p.pdf"));
  expect(md).toContain("| 2 | Power | pages-proof-power.kicad_sch | A4 | 6 |");
  expect(md).toContain("| 3 | Signal | pages-proof-signal.kicad_sch | A3 | 1 |");
  expect(md).toContain("| VREF | 2, 3 | R1.2, R2.1, U2.3 |");
  expect(md).toContain("| GND (power) | 2, 3, 4 |");
  expect(md).toMatch(/\| U2 \| OPA4197 \| opa4197-soic14 \| [^|]+ \| C2058532 \| verified \| 2, 3, 4 \|/);
  // A one-sheet design's review keeps its columns.
  const one = generate("pipeline-proof", proof, { dir: join(tmp, "review-one") });
  expect(reviewMarkdown(one, erc, "abc", "10.0.6", join(tmp, "p.pdf"))).toContain("| Net | Pins |");
});
