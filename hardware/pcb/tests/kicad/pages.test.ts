// A schematic with pages (tests/fixtures/pages-proof) on the installed KiCad: ERC 0/0 over the whole hierarchy,
// netlist round-trip with sheet paths, every file re-saved by eeschema unchanged, one PDF page per sheet, and a
// board built by tools/pcb from it with DRC 0/0 under schematic parity. Skipped without kicad-cli (`bun run test:full`
// makes that a failure); the board needs KiCad's Python, Freerouting and Java as well.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { findKicadCli, kicadCli } from "../../tools/kicad/cli.ts";
import { emitSheets } from "../../tools/kicad/emit-sch.ts";
import { ErcReport } from "../../tools/kicad/erc-report.ts";
import { findKicadPython } from "../../tools/kicad/install.ts";
import { parseNetlistXml } from "../../tools/kicad/netlist-xml.ts";
import { sheetUuid, uuidv5 } from "../../tools/kicad/uuid.ts";
import { sha256File } from "../../tools/lib/hash.ts";
import { pdfPageCount } from "../../tools/lib/pdf.ts";
import { run } from "../../tools/lib/proc.ts";
import { toolAvailable } from "../../tools/lib/testing.ts";
import { runPcb, type PcbSpec } from "../../tools/pcb/flow.ts";
import { FREEROUTING, javaCandidates } from "../../tools/pcb/tools.ts";
import { atomStr, child, children, parse } from "../../tools/sexpr/sexpr.ts";
import { sheetsOf, TOOL_VERSION } from "../../tools/sch/build.ts";
import { schematicSha256 } from "../../tools/sch/files.ts";
import { compareNetlist, ercGateProblems, exportSchematicPdf, pdfPageProblems, runErc, runSchGates, writeGenerated, type GateRecord } from "../../tools/sch/gates.ts";
import { generate, type Generated } from "../../tools/sch/generate.ts";
import pagesProof from "../fixtures/pages-proof/schematic.ts";

const hasKicad = toolAvailable(findKicadCli() !== null, "kicad-cli");
const TIMEOUT = 120_000;
const ID = "pages-proof";

const ROOT = mkdtempSync(join(tmpdir(), "ghp-pages-kicad-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
let seq = 0;

function project(): { g: Generated; dir: string; config: string } {
  const dir = join(ROOT, `p${++seq}`, "kicad");
  const config = join(ROOT, `config-${seq}`);
  mkdirSync(dir, { recursive: true });
  const g = generate(ID, pagesProof, { dir });
  writeGenerated(g);
  return { g, dir, config };
}

const netlist = async (g: Generated, out: string, config: string) => {
  await kicadCli(["sch", "export", "netlist", "--format", "kicadxml", "-o", out, g.schPath], { configHome: config });
  return readFileSync(out, "utf8");
};

describe.skipIf(!hasKicad)("pages proof on the installed KiCad", () => {
  test("ERC over the root and every page: 0 errors, 0 warnings", async () => {
    const { g, dir, config } = project();
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    if (erc.errors + erc.warnings) console.error(readFileSync(erc.rptPath, "utf8"));
    expect(ercGateProblems(erc)).toEqual([]);
    const report = ErcReport.parse(JSON.parse(readFileSync(erc.jsonPath, "utf8")));
    expect(report.sheets.map((s) => s.path)).toEqual(["/", "/Power/", "/Signal/", "/Output/"]);
  }, TIMEOUT);

  test("netlist round-trip: nets, values, footprints, symbol UUIDs and sheet paths match", async () => {
    const { g, dir, config } = project();
    const xml = await netlist(g, join(dir, "net.xml"), config);
    expect(compareNetlist(g, xml)).toEqual([]);
    const { components, nets } = parseNetlistXml(xml);
    // The quad is listed once, from its first page (power: unit E), with that page's unit only.
    const u2 = components.find((c) => c.ref === "U2")!;
    expect(u2.sheetpath).toEqual({ names: "/Power/", tstamps: `/${sheetUuid(ID, "power")}/` });
    expect(u2.tstamps).toEqual([uuidv5(`${ID}/part/amp/unit/5`)]);
    expect(components.find((c) => c.ref === "J2")!.sheetpath.names).toBe("/Output/");
    // Global labels keep the net's name; a local label is scoped to its page.
    const names = nets.map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["VREF", "BUF", "GND", "+12V", "-12V", "/Output/OUT", "/Output/OUT_R"]));
  }, TIMEOUT);

  test("eeschema re-saves every file (the root and each page) unchanged but for the generator lines", async () => {
    const { g, config } = project();
    const strip = (t: string) => t.replace(/\(generator "[^"]*"\)\n\t\(generator_version "[^"]*"\)/, "");
    for (const file of g.schPaths) {
      const ours = readFileSync(file, "utf8");
      await kicadCli(["sch", "upgrade", "--force", file], { configHome: config });
      const theirs = readFileSync(file, "utf8");
      expect(theirs).not.toBe(ours); // KiCad did write it: its own generator line
      expect({ file: basename(file), text: strip(theirs) }).toEqual({ file: basename(file), text: strip(ours) });
    }
  }, TIMEOUT);

  test("the PDF has one page per sheet: the root and three pages", async () => {
    const { g, dir, config } = project();
    const pdf = join(dir, "pages.pdf");
    await exportSchematicPdf(g.schPath, pdf, "test", config);
    expect(pdfPageCount(readFileSync(pdf))).toBe(4);
    expect(pdfPageProblems(pdf, g.schPaths.length)).toEqual([]);
    expect(pdfPageProblems(pdf, 5)).toEqual(["the PDF has 4 page(s), the schematic 5 sheet(s)"]);
    // An independent count with macOS PDFKit, where Swift is installed.
    const swift = process.platform === "darwin" ? Bun.which("swift") : null;
    if (swift) {
      const script = join(ROOT, "pagecount.swift");
      writeFileSync(script, 'import Foundation\nimport PDFKit\nprint(PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1]))?.pageCount ?? -1)\n');
      const r = await run([swift, script, pdf], { timeoutMs: 120_000 });
      expect(r.stdout.trim()).toBe("4");
    }
  }, TIMEOUT);

  test("the whole `bun run sch` gate chain passes; its record hashes every page, its review lists them", async () => {
    const dir = join(ROOT, `gates-${++seq}`);
    const kicadDir = join(dir, "kicad");
    const buildDir = join(dir, "build");
    const r = await runSchGates(ID, { design: pagesProof, kicadDir, buildDir, configHome: join(dir, "config") });
    expect(r.erc.errors + r.erc.warnings).toBe(0);
    expect(pdfPageCount(readFileSync(r.pdfPath))).toBe(4);
    const record = JSON.parse(readFileSync(join(buildDir, "gates.json"), "utf8")) as GateRecord;
    expect(record.schSha256).toBe(schematicSha256(r.schPath));
    expect(record.schSha256).not.toBe(sha256File(r.schPath));
    const review = readFileSync(r.reviewPath, "utf8");
    expect(review).toContain("| 4 | Output | pages-proof-output.kicad_sch | A4 |");
    expect(review).toContain("| BUF | 3, 4 |");
  }, TIMEOUT);

  test("a cross-page net drawn with a local label on one page is caught by ERC and the netlist round-trip", async () => {
    const { g, dir, config } = project();
    // BUF's label at U2C on the output page becomes local: a net of its own there, with one pin.
    const pages = g.build.pages.map((p) => ({ ...p, labels: [...p.labels], globalLabels: [...p.globalLabels] }));
    const out = pages.find((p) => p.page!.id === "output")!;
    const buf = out.globalLabels.findIndex((lb) => lb.text === "BUF");
    out.labels.push(out.globalLabels.splice(buf, 1)[0]!);
    const texts = emitSheets([g.build.ir, ...pages], TOOL_VERSION);
    g.schPaths.forEach((f, i) => writeFileSync(f, texts[i]!));
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    expect(erc.types).toContain("isolated_pin_label");
    const problems = compareNetlist(g, await netlist(g, join(dir, "net.xml"), config));
    expect(problems.join("\n")).toContain("net BUF: its pins are spread over 2 KiCad nets");
  }, TIMEOUT);
});

// tools/pcb on the pages proof: footprints linked to their symbols by sheet path, routed by Freerouting, DRC 0/0 with
// schematic parity.
const hasBoardTools = hasKicad && toolAvailable(findKicadPython() !== null, "KiCad's bundled Python (pcbnew)")
  && toolAvailable(existsSync(FREEROUTING.jar) && javaCandidates().length > 0, "Freerouting jar and Java");

describe.skipIf(!hasBoardTools)("a board from the pages proof (tools/pcb)", () => {
  test("placed, routed, DRC with schematic parity 0/0; footprints carry their page's sheet path", async () => {
    const { g, dir, config } = project();
    const buildDir = join(dir, "..", "build");
    mkdirSync(buildDir, { recursive: true });
    await netlist(g, join(buildDir, `${ID}.net.xml`), config);
    const moduleYaml = join(dir, "..", "module.yaml");
    writeFileSync(moduleYaml, [
      "schema: 1", `id: ${ID}`, "name: Pages proof", "kind: board",
      "revision:", "  rev: A", '  date: "2026-11-13"', "  status: schematic-approved",
      `  approval: { schSha256: "${schematicSha256(g.schPath)}", date: "2026-11-13" }`,
      "power:", "  drawMa: { vin: 0 }", "  drawBasis: estimate",
      "pcb: { boards: 1, layers: 2, thicknessMm: 1.6, sizeMm: { w: 60, h: 40 } }",
      "jlcpcb: { assembly: economic, smtSide: top, tht: jlcpcb, qty: 5, removeOrderNumber: true }", "",
    ].join("\n"));
    const spec: PcbSpec = {
      outline: { x0: 0, y0: 0, x1: 60, y1: 40 },
      offset: { x: 20, y: 20 },
      smdSide: "top",
      // The through-hole parts: the terminal block along the bottom edge, the header on the right.
      fixed: { J1: { x: 10, y: 33, rot: 0, side: "top" }, J2: { x: 54, y: 10, rot: 0, side: "top" } },
      // 0.3 mm tracks: with 0.25 mm, Freerouting 2.4.1 necked U2's follower loop (adjacent pins 1 and 2) down to
      // 0.125 mm, under the board's 0.15 mm minimum (track_width, 3 runs of 3); with 0.3 mm it routes it clean (4 of 4).
      netClasses: [{ name: "Default", track: 0.3, clearance: 0.2, via: 0.6, drill: 0.3, nets: [] }],
      pour: { clearance: 0.3, minWidth: 0.25, edgeClearance: 0.5 },
      passes: 20,
    };
    const r = await runPcb(ID, spec, { kicadDir: dir, buildDir, moduleYaml, configHome: config });
    expect({ unrouted: r.unrouted, problems: r.problems, errors: r.drc.errors, warnings: r.drc.warnings, parity: r.drc.parity })
      .toEqual({ unrouted: 0, problems: [], errors: 0, warnings: 0, parity: true });

    // Every footprint is linked as Update PCB links it: "/<sheet>/<symbol>", the page's sheet name and file.
    const board = parse(readFileSync(r.board, "utf8"), r.board);
    const link = Object.fromEntries(children(board, "footprint").map((fp) => {
      const ref = atomStr(children(fp, "property").find((p) => atomStr(p, 1) === "Reference"), 2)!;
      return [ref, { path: atomStr(child(fp, "path"), 1), sheetname: atomStr(child(fp, "sheetname"), 1), sheetfile: atomStr(child(fp, "sheetfile"), 1) }];
    }));
    expect(link.R3).toEqual({ path: `/${sheetUuid(ID, "output")}/${uuidv5(`${ID}/part/rOut/unit/1`)}`, sheetname: "/Output/", sheetfile: "pages-proof-output.kicad_sch" });
    expect(link.U2).toEqual({ path: `/${sheetUuid(ID, "power")}/${uuidv5(`${ID}/part/amp/unit/5`)}`, sheetname: "/Power/", sheetfile: "pages-proof-power.kicad_sch" });
    const expected = sheetsOf(g.build).flatMap((s) => s.units.filter((u) => u.kind === "part").map((u) => u.ref));
    expect(Object.keys(link).sort()).toEqual([...new Set(expected)].sort());
  }, 900_000);
});
