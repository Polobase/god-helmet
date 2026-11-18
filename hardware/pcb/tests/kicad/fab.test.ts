// Fab export against the installed kicad-cli. Everything is written to temp dirs.
// - pipeline-proof fixture (draft: its parts have no verified LCSC numbers, and the unrouted
//   board has no nets to match the schematic),
// - fab-mini fixture (all pins no-connect, so DRC passes with schematic parity): the order path
//   and every refusal, with a temp module.yaml and a temp parts database.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { FabError, runFab, type FabOptions } from "../../tools/fab/fab.ts";
import { KICAD_DEFAULT_IGNORED } from "../../tools/kicad/drc.ts";
import { parseCsv } from "../../tools/fab/csv.ts";
import { parsePos } from "../../tools/fab/cpl.ts";
import { placementPoint, readBoard } from "../../tools/fab/placement.ts";
import { findKicadCli, kicadCli, KiCadExit } from "../../tools/kicad/cli.ts";
import { emitBoard, type BoardFootprint } from "../../tools/kicad/emit-pcb.ts";
import { emitFpLibTable } from "../../tools/kicad/libtables.ts";
import { vendoredTables } from "../../tools/kicad/vendor.ts";
import { sha256File as sha256 } from "../../tools/lib/hash.ts";
import { paths } from "../../tools/lib/paths.ts";
import { toolAvailable } from "../../tools/lib/testing.ts";
import { atomNum, head, isList, type List } from "../../tools/sexpr/sexpr.ts";
import { loadVendored, TOOL_VERSION } from "../../tools/sch/build.ts";
import { MINI_ID, writeFabFixture, writeMiniFixture } from "../fixtures/fab-fixture.ts";
import { loadAllParts } from "../../tools/module/load.ts";
import proof from "../fixtures/pipeline-proof/schematic.ts";

const hasKicad = toolAvailable(findKicadCli() !== null, "kicad-cli");

const temps: string[] = [];
const tmp = (name: string) => {
  const d = mkdtempSync(join(tmpdir(), `ghp-${name}-`));
  temps.push(d);
  return d;
};
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

let configHome = "";
beforeAll(() => {
  configHome = tmp("kicad-config");
});

interface MiniOptions {
  /** Sourcing records in the temp parts DB (default true). */
  verified?: boolean;
  /** How the header is sourced: LCSC number (default) or MPN only. */
  headerBy?: "lcsc" | "mpn";
  tht?: "self" | "jlcpcb" | "consign";
  assembly?: "none" | "economic";
  /** Approval record: the schematic's sha256 (default), another sha, or none. */
  approval?: "match" | "other" | "none";
  rev?: string;
  /** Copper layers in module.yaml, and in the board file when `boardLayers` is not given (default 2). */
  layers?: 2 | 4;
  boardLayers?: 2 | 4;
}

/** A board in a temp dir: parts DB, KiCad project and module.yaml. */
function mini(o: MiniOptions = {}): Required<Pick<FabOptions, "id" | "kicadDir" | "moduleYaml" | "partsDir" | "buildRoot" | "configHome">> {
  const root = tmp("fab-mini");
  const partsDir = join(root, "parts");
  const kicadDir = join(root, "kicad");
  mkdirSync(partsDir);
  mkdirSync(kicadDir);
  let n = 900001; // test-only numbers, never real JLCPCB parts
  for (const key of ["res-0603", "mmbt3904-sot23", "header-1x04-2.54"]) {
    // Start from the real part files with all sourcing cleared, so the fixture does not depend
    // on what the repo's parts DB has verified.
    let t = readFileSync(join(paths.parts, `${key}.yaml`), "utf8")
      .replace(/^( {4}(?:mpn|manufacturer|lcsc|jlcpcbTier|verified)):.*$/gm, "$1: null");
    if (key === "header-1x04-2.54" && o.headerBy === "mpn") t = t.replace(/mpn: null/g, "mpn: TEST-MPN-1");
    else t = t.replace(/lcsc: null/g, () => `lcsc: C${n++}`);
    if (o.verified !== false) t = t.replace(/verified: null/g, 'verified: { source: "https://example.com/test-only", date: "2026-09-24" }');
    writeFileSync(join(partsDir, `${key}.yaml`), t);
  }
  writeMiniFixture(kicadDir, partsDir, o.boardLayers ?? o.layers ?? 2);
  const sha = sha256(join(kicadDir, `${MINI_ID}.kicad_sch`));
  const approval = o.approval ?? "match";
  const moduleYaml = join(root, "module.yaml");
  writeFileSync(moduleYaml, [
    "schema: 1", `id: ${MINI_ID}`, "name: Fab mini", "kind: board",
    "revision:", `  rev: ${o.rev ?? "A"}`, '  date: "2026-09-24"',
    `  status: ${approval === "none" ? "schematic" : "schematic-approved"}`,
    ...(approval === "none" ? [] : [`  approval: { schSha256: "${approval === "match" ? sha : "0".repeat(64)}", date: "2026-09-24" }`]),
    "power:", "  drawMa: { vin: 0 }", "  drawBasis: estimate",
    `pcb: { boards: 1, layers: ${o.layers ?? 2}, thicknessMm: 1.6, sizeMm: { w: 80, h: 45 } }`,
    `jlcpcb: { assembly: ${o.assembly ?? "economic"}, smtSide: top, tht: ${o.tht ?? "jlcpcb"}, qty: 5, removeOrderNumber: true }`,
    "",
  ].join("\n"));
  return { id: MINI_ID, kicadDir, moduleYaml, partsDir, buildRoot: join(root, "build"), configHome };
}

const fabDir = (o: { buildRoot: string; id: string }) => join(o.buildRoot, o.id, "fab");

/** How far a footprint reaches from its origin in any direction, mm: the farthest point of its pads, drawings,
 *  texts and zones. */
function reach(fp: List): number {
  let r = 0;
  const walk = (n: List) => {
    if (["start", "end", "xy", "at", "center", "mid"].includes(head(n) ?? "")) {
      const [x, y] = [atomNum(n, 1), atomNum(n, 2)];
      if (x !== undefined && y !== undefined) r = Math.max(r, Math.hypot(x, y));
    }
    for (const c of n.items) if (isList(c)) walk(c);
  };
  walk(fp);
  return r;
}


/** Runs fab expecting a refusal; returns the problems. Nothing order-like may remain. */
async function refused(o: FabOptions & { buildRoot: string }): Promise<string> {
  let err: unknown;
  try {
    await runFab(o);
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(FabError);
  const fab = fabDir(o);
  const left = existsSync(fab) ? readdirSync(fab) : [];
  expect(left.filter((f) => !f.endsWith("-refused-drc.json"))).toEqual([]);
  return (err as FabError).message;
}

function editPro(kicadDir: string, board: Record<string, unknown>) {
  const file = join(kicadDir, `${MINI_ID}.kicad_pro`);
  const pro = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  pro.board = board;
  writeFileSync(file, JSON.stringify(pro, null, 2) + "\n");
}

/** Shrink the board's silkscreen text below JLCPCB's/KiCad's minimum: one text_height warning. */
function shrinkText(kicadDir: string) {
  const file = join(kicadDir, `${MINI_ID}.kicad_pcb`);
  const t = readFileSync(file, "utf8");
  const i = t.indexOf('(gr_text "fab mini"');
  writeFileSync(file, t.slice(0, i) + t.slice(i).replace("(size 1.5 1.5)", "(size 0.4 0.4)"));
}

describe.skipIf(!hasKicad)("fab export, draft, on the pipeline-proof fixture", () => {
  test("DRC clean with rotated footprints; Gerbers, drill, BOM, CPL, zip and README", async () => {
    const dir = tmp("fab");
    writeFabFixture(dir);
    const buildRoot = join(dir, "build");
    const boardSha = sha256(join(dir, "pipeline-proof.kicad_pcb"));
    const r = await runFab({ id: "pipeline-proof", kicadDir: dir, buildRoot, draft: true, parity: false, configHome });
    expect(r.drc).toEqual({ errors: 0, warnings: 0, excluded: 0, types: [], ignored: KICAD_DEFAULT_IGNORED, parity: false, unconnected: 0 });
    expect(sha256(join(dir, "pipeline-proof.kicad_pcb"))).toBe(boardSha); // zones refilled in memory only
    const out = join(buildRoot, "pipeline-proof", "fab", "DRAFT");
    expect(r.outDir).toBe(out);

    const gerbers = readdirSync(join(out, "gerbers"));
    for (const ext of [".gtl", ".gbl", ".gts", ".gbs", ".gto", ".gbo", ".gtp", ".gbp", ".gm1"]) {
      expect(gerbers.some((f) => f.toLowerCase().endsWith(ext))).toBe(true);
    }
    expect(gerbers.filter((f) => f.endsWith(".drl")).length).toBe(2); // PTH + NPTH

    const zip = unzipSync(new Uint8Array(readFileSync(join(out, "DRAFT-pipeline-proof-gerbers.zip"))));
    expect(Object.keys(zip).sort()).toEqual(gerbers.sort());

    const bom = parseCsv(readFileSync(join(out, "DRAFT-pipeline-proof-bom.csv"), "utf8"));
    expect(bom[0]).toEqual(["Comment", "Designator", "Footprint", "JLCPCB Part #"]);
    const bomRefs = bom.slice(1).flatMap((row) => row[1]!.split(",")).sort();
    expect(bomRefs).toEqual(["C1", "C2", "C3", "C4", "D1", "D2", "J2", "R1", "R2", "R3", "R4", "R5", "U1"]); // SMD only; THT hand-soldered

    const cpl = parseCsv(readFileSync(join(out, "DRAFT-pipeline-proof-cpl.csv"), "utf8"));
    expect(cpl.slice(1).map((row) => row[0]).sort()).toEqual(bomRefs);
    const row = (ref: string) => cpl.find((c) => c[0] === ref)!;
    expect(row("R1")).toEqual(["R1", "120.0000mm", "-75.0000mm", "T", "90"]); // placed at 90°
    expect(row("U1")).toEqual(["U1", "25.0000mm", "-75.0000mm", "T", "270"]); // ^SOIC-8_ correction
    expect(row("J2")).toEqual(["J2", "70.0000mm", "-25.0000mm", "T", "90"]); // the jack's own cplRotation (parts/jack-3.5mm-stop.yaml)
    // Unverified = every placed SMD line whose parts/*.yaml value has no verified sourcing.
    const partsDb = loadAllParts(paths.parts);
    const expected = bomRefs.filter((ref) => {
      const inst = Object.values(proof.parts).find((p) => p.ref === ref)!;
      const part = partsDb.get(inst.part)!;
      const v = inst.value ?? Object.keys(part.values)[0]!;
      return !part.values[v]?.verified;
    });
    expect(r.unverified.sort()).toEqual(expected.sort());

    // Placement points: anchors as kicad-cli reports them (page origin, Y up); THT parts at the pad
    // centre the Fabrication Toolkit computes (its _get_footprint_position in pcbnew 10.0.6).
    const pos = parsePos(readFileSync(join(out, "kicad-positions.csv"), "utf8"));
    const parts = new Map(readBoard(readFileSync(join(dir, "pipeline-proof.kicad_pcb"), "utf8")).map((p) => [p.ref, p]));
    expect([...parts.keys()].sort()).toEqual(pos.map((p) => p.ref).sort());
    for (const row of pos) {
      const p = parts.get(row.ref)!;
      expect([p.x, -p.y, p.side]).toEqual([row.x, row.y, row.side]);
      expect(((p.rot - row.rot) % 360 + 360) % 360).toBe(0);
    }
    const pt = (ref: string) => {
      const q = placementPoint(parts.get(ref)!);
      return [q.x, -q.y].map((v) => Math.round(v * 1e6) / 1e6);
    };
    expect(pt("J1")).toEqual([32.5, -25]); // terminal block, anchor on pin 1, pads 5 mm apart along x
    expect(pt("J3")).toEqual([96.19, -25]); // 1x4 header turned 270°, anchor on pin 1, pads 2.54 mm apart towards -x
    expect(pt("J2")).toEqual([70, -25]); // SMD: anchor
    expect(pt("U1")).toEqual([25, -75]); // SMD: anchor

    const readme = readFileSync(join(out, "README.md"), "utf8");
    expect(readme).toContain("**DRAFT — not for ordering**");
    expect(readme).toContain("schematic parity **NOT checked**");
    expect(readme).toContain(`Checks KiCad ignores in this project (its defaults): ${KICAD_DEFAULT_IGNORED.join(", ")}.`);
  }, 180_000);

  test("an unfilled copper zone is refilled for DRC (the netless pour is isolated copper)", async () => {
    const dir = tmp("fab-zone");
    writeFabFixture(dir);
    const file = join(dir, "pipeline-proof.kicad_pcb");
    const zone = '\t(zone (net "") (layer "B.Cu") (uuid "0d6a1b50-7c1e-4f55-9a3e-2b8f4c1d9e01") (hatch edge 0.5)\n' +
      "\t\t(connect_pads (clearance 0.5)) (min_thickness 0.25) (filled_areas_thickness no)\n" +
      "\t\t(fill (thermal_gap 0.5) (thermal_bridge_width 0.5))\n" +
      "\t\t(polygon (pts (xy 12 12) (xy 153 12) (xy 153 88) (xy 12 88))))\n";
    writeFileSync(file, readFileSync(file, "utf8").replace(/\t\(embedded_fonts no\)\n\)\n$/, `${zone}\t(embedded_fonts no)\n)\n`));
    const buildRoot = join(dir, "build");
    const msg = await refused({ id: "pipeline-proof", kicadDir: dir, buildRoot, draft: true, parity: false, configHome });
    expect(msg).toMatch(/DRC: 0 errors, 1 warnings \(isolated_copper\)/);
  }, 180_000);
});

describe.skipIf(!hasKicad)("emit-pcb: rotated footprints", () => {
  test("every vendored footprint at 0/90/180/270° matches its library copy (lib_footprint_mismatch)", async () => {
    const dir = tmp("rot");
    const lib = loadVendored();
    const ROTS = [0, 90, 180, 270] as const;
    const footprints: BoardFootprint[] = [];
    const names: string[] = [];
    // One row per footprint, its pitch twice the footprint's reach plus 5 mm, so no copy touches another.
    let y = 10;
    let width = 0;
    [...lib.footprints.entries()].forEach(([libId, info], i) => {
      const pitch = Math.ceil(2 * reach(info.node) + 5);
      y += pitch / 2;
      ROTS.forEach((rot, j) => footprints.push({ libId, info, ref: `X${i * 4 + j + 1}`, value: "x", at: { x: 10 + pitch / 2 + j * pitch, y }, rot }));
      y += pitch / 2;
      width = Math.max(width, 10 + 4 * pitch);
      names.push(libId);
    });
    const pcb = join(dir, "rot.kicad_pcb");
    writeFileSync(pcb, emitBoard({ name: "rot", outline: { x: 5, y: 5, w: width, h: y }, footprints }, TOOL_VERSION));
    writeFileSync(join(dir, "fp-lib-table"), emitFpLibTable(dir, vendoredTables().footprints));
    const report = join(dir, "drc.json");
    type Violation = { type: string; items: { description: string }[] };
    const drc = async () => {
      await kicadCli(["pcb", "drc", "--format", "json", "--severity-all", "-o", report, pcb], { configHome, okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS] });
      return (JSON.parse(readFileSync(report, "utf8")) as { violations: Violation[] }).violations;
    };
    const refOf = (d: string) => /\b(?:of|Footprint) (X\d+)\b/.exec(d)?.[1];
    // This emitter keeps references on the silkscreen, where a rotated stock footprint can put its own
    // reference over its own outline (LED_0805 at 270°). Real boards carry references on the Fab layer
    // (tools/pcb/kicad_pcb.py), so that one combination is let through.
    const ownReference = (v: Violation) => {
      const refs = v.items.map((i) => refOf(i.description));
      return v.type === "silk_overlap" && v.items.length === 2 && refs[0] !== undefined && refs[0] === refs[1]
        && v.items.some((i) => i.description.startsWith("Reference field of "));
    };
    // Stock footprints bring their own findings on this netless, unrouted board (thermal-via drills below KiCad's
    // default minimum, mask bridges between fine-pitch pads), the same at every angle. A rotated copy may add
    // nothing to what its 0° copy shows; a library mismatch is never allowed.
    const added = (violations: Violation[]) => {
      const copyOf = (v: Violation) => {
        const refs = [...new Set(v.items.map((i) => refOf(i.description)))];
        return refs.length === 1 && refs[0] ? Number(refs[0].slice(1)) - 1 : undefined;
      };
      const atZero = new Map<number, Set<string>>();
      for (const v of violations) {
        const n = copyOf(v);
        if (n !== undefined && n % 4 === 0) atZero.set(n / 4, (atZero.get(n / 4) ?? new Set()).add(v.type));
      }
      return violations.filter((v) => !ownReference(v)).flatMap((v) => {
        const n = copyOf(v);
        if (n === undefined) return [`${v.type} (${v.items.map((i) => i.description).join(" / ")})`];
        const fp = Math.floor(n / 4);
        if (v.type !== "lib_footprint_mismatch" && (n % 4 === 0 || atZero.get(fp)?.has(v.type))) return [];
        return [`${v.type} (${names[fp]} at ${ROTS[n % 4]}°)`];
      });
    };
    expect(added(await drc())).toEqual([]);

    // The check is live: a pad left at its library angle on a rotated footprint is reported.
    const t = readFileSync(pcb, "utf8");
    const k = t.indexOf('(property "Reference" "X2"');
    writeFileSync(pcb, t.slice(0, k) + t.slice(k).replace(/\(pad "1" (\S+) (\S+)\n(\t+)\(at (\S+) (\S+) \d+\)/, '(pad "1" $1 $2\n$3(at $4 $5)'));
    expect(added(await drc())).toEqual([expect.stringMatching(/^lib_footprint_mismatch \(GHP_\S+ at 90°\)$/)]);
  }, 180_000);
});

describe.skipIf(!hasKicad)("fab export of a module (fab-mini fixture)", () => {
  test("approved module: order files with parity, centroids and verified sourcing", async () => {
    const o = mini();
    const r = await runFab(o);
    const out = join(fabDir(o), "rev-A");
    expect(r.outDir).toBe(out);
    expect(r.drc).toMatchObject({ errors: 0, warnings: 0, excluded: 0, parity: true, ignored: KICAD_DEFAULT_IGNORED });
    expect(r.unverified).toEqual([]);
    expect(readdirSync(fabDir(o))).toEqual(["rev-A"]);
    const files = readdirSync(out).sort();
    expect(files).toEqual(["README.md", "drc.json", `${MINI_ID}-revA-bom.csv`, `${MINI_ID}-revA-cpl.csv`, `${MINI_ID}-revA-gerbers.zip`, "gerbers", "inputs.json", "kicad-positions.csv", "netlist.xml"]);

    const bom = parseCsv(readFileSync(join(out, `${MINI_ID}-revA-bom.csv`), "utf8"));
    // Test-only LCSC numbers (C9000xx) from the fixture parts DB, one per line.
    expect(bom.slice(1).map((row) => row[1])).toEqual(["J1", "Q1", "R1"]);
    for (const row of bom.slice(1)) expect(row[3]).toMatch(/^C9000\d\d$/);

    // Anchors from kicad-cli's position file; J1 (THT) moves to its pad centre, 3.81 mm below
    // pin 1 (FT's pad bounding box: four pads at a 2.54 mm pitch).
    const pos = new Map(parsePos(readFileSync(join(out, "kicad-positions.csv"), "utf8")).map((p) => [p.ref, p]));
    expect([pos.get("J1")!.x, pos.get("J1")!.y]).toEqual([65, -22]);
    const cpl = parseCsv(readFileSync(join(out, `${MINI_ID}-revA-cpl.csv`), "utf8"));
    expect(cpl.slice(1)).toEqual([
      ["J1", "65.0000mm", "-25.8100mm", "T", "270"], // the header's own cplRotation (parts/header-1x04-2.54.yaml)
      ["Q1", "40.0000mm", "-30.0000mm", "T", "180"], // ^SOT-23 correction
      ["R1", "25.0000mm", "-30.0000mm", "T", "90"],
    ]);

    const readme = readFileSync(join(out, "README.md"), "utf8");
    expect(readme).toContain(`Schematic sha256 ${sha256(join(o.kicadDir, `${MINI_ID}.kicad_sch`)).slice(0, 12)} (approved).`);
    expect(readme).toContain("schematic parity checked");
    expect(readme).toContain("Rotation corrections from parts/*.yaml (JLCPCB's footprint for the part is turned against KiCad's): J1 +270°.");
    expect(readme).toContain("Sourcing: all 3 placements verified");
    expect(readme).not.toContain("## Check these lines");
  }, 180_000);

  test("a 4-layer module: Gerbers with the inner copper, and the README says so", async () => {
    const o = mini({ layers: 4 });
    const r = await runFab(o);
    expect(r.drc).toMatchObject({ errors: 0, warnings: 0, parity: true });
    const gerbers = readdirSync(join(r.outDir, "gerbers"));
    // Outer copper is .gtl/.gbl (named after the fixture's layer names, top_layer/bottom_layer); inner copper .g1/.g2.
    for (const end of [".gtl", "-In1_Cu.g1", "-In2_Cu.g2", ".gbl"]) expect(gerbers.some((f) => f.endsWith(end))).toBe(true);
    const zip = unzipSync(new Uint8Array(readFileSync(join(r.outDir, `${MINI_ID}-revA-gerbers.zip`))));
    expect(Object.keys(zip).filter((f) => f.includes("In1_Cu") || f.includes("In2_Cu"))).toHaveLength(2);
    expect(readFileSync(join(r.outDir, "README.md"), "utf8")).toContain("Gerbers, 4 copper layers: F.Cu, In1.Cu, In2.Cu, B.Cu,");
  }, 180_000);

  test("module.yaml and the board must agree on the copper layers", async () => {
    expect(await refused(mini({ layers: 4, boardLayers: 2 }))).toMatch(/module\.yaml pcb\.layers is 4, but the board has 2 copper layers/);
    expect(await refused(mini({ layers: 2, boardLayers: 4 }))).toMatch(/module\.yaml pcb\.layers is 2, but the board has 4 copper layers/);
  }, 180_000);

  test("consigned THT parts are in BOM and CPL, verified by MPN, and listed in the README", async () => {
    const o = mini({ tht: "consign", headerBy: "mpn" });
    const r = await runFab(o);
    expect(r.consigned).toEqual(["J1"]);
    const out = join(fabDir(o), "rev-A");
    const bom = parseCsv(readFileSync(join(out, `${MINI_ID}-revA-bom.csv`), "utf8"));
    expect(bom.find((row) => row[1] === "J1")).toEqual(["1x04 2.54", "J1", "PinHeader_1x04_P2.54mm_Vertical", "TEST-MPN-1"]);
    const cpl = parseCsv(readFileSync(join(out, `${MINI_ID}-revA-cpl.csv`), "utf8"));
    expect(cpl.map((row) => row[0])).toContain("J1");
    const readme = readFileSync(join(out, "README.md"), "utf8");
    expect(readme).toContain("- J1: 1x04 2.54, PinHeader_1x04_P2.54mm_Vertical, no LCSC number, MPN TEST-MPN-1");
    expect(readme).toContain("cell carries the LCSC number or, when there is none, the MPN");
    expect(readme).toContain("not documented (unverified)");
  }, 180_000);

  test("assembly none: Gerbers and drill only, no BOM/CPL and no sourcing gate", async () => {
    const o = mini({ assembly: "none", tht: "self", verified: false });
    const r = await runFab(o);
    expect(r.assembly).toBe(false);
    const files = readdirSync(r.outDir);
    expect(files.some((f) => f.endsWith("-bom.csv") || f.endsWith("-cpl.csv"))).toBe(false);
    expect(files).toContain(`${MINI_ID}-revA-gerbers.zip`);
    expect(readFileSync(join(r.outDir, "README.md"), "utf8")).toContain("Gerbers and drill only, no BOM or CPL");
  }, 180_000);

  test("refuses an unapproved or changed schematic, and removes the files of an earlier export", async () => {
    const o = mini();
    await runFab(o);
    expect(existsSync(join(fabDir(o), "rev-A"))).toBe(true);
    writeFileSync(o.moduleYaml, readFileSync(o.moduleYaml, "utf8").replace(/schSha256: "[0-9a-f]{64}"/, `schSha256: "${"0".repeat(64)}"`));
    expect(await refused(o)).toMatch(/schematic changed since it was approved/);
    expect(await refused({ ...mini({ approval: "none" }) })).toMatch(/schematic not approved/);
  }, 180_000);

  test("refuses --no-parity without --draft", async () => {
    const o = mini();
    expect(await refused({ ...o, parity: false })).toMatch(/--no-parity needs --draft/);
  });

  test("refuses unverified sourcing", async () => {
    expect(await refused(mini({ verified: false }))).toMatch(/unverified or missing LCSC numbers: J1, Q1, R1/);
    expect(await refused(mini({ verified: false, tht: "consign", headerBy: "mpn" }))).toMatch(/consigned parts without a verified LCSC number or MPN: J1/);
  }, 180_000);

  test("refuses DRC violations, excluded violations and extra ignored checks", async () => {
    const o = mini();
    shrinkText(o.kicadDir);
    const msg = await refused(o);
    expect(msg).toMatch(/DRC: 0 errors, 1 warnings \(text_height\)/);
    const report = join(fabDir(o), "rev-A-refused-drc.json");
    const drc = JSON.parse(readFileSync(report, "utf8")) as { violations: { type: string; items: { pos: { x: number; y: number }; uuid: string }[] }[] };
    const v = drc.violations[0]!;
    // Exclusion key as pcbnew writes it: type|x nm|y nm|item uuid|second item uuid.
    const key = [v.type, Math.round(v.items[0]!.pos.x * 1e6), Math.round(v.items[0]!.pos.y * 1e6), v.items[0]!.uuid, "00000000-0000-0000-0000-000000000000"].join("|");
    editPro(o.kicadDir, { design_settings: { drc_exclusions: [[key, "hidden"]] } });
    expect(await refused(o)).toMatch(/DRC: 1 violations are excluded in the \.kicad_pro \(text_height\)/);
    editPro(o.kicadDir, { design_settings: { rule_severities: { text_height: "ignore" } } });
    expect(await refused(o)).toMatch(/checks set to "ignore" in the \.kicad_pro beyond KiCad's defaults: text_height/);
  }, 180_000);

  test("refuses a module.yaml that does not validate (the rev names the output folder)", async () => {
    const o = mini({ rev: '"A/../../x"' });
    expect(await refused(o)).toMatch(/module\.yaml does not validate[\s\S]*expected a single capital letter/);
  });
});

describe.skipIf(!hasKicad)("fab export with a copper pour (fab-mini fixture)", () => {
  test("Gerbers carry the refilled pour of a zone saved unfilled", async () => {
    const o = mini();
    const file = join(o.kicadDir, `${MINI_ID}.kicad_pcb`);
    const zone = '\t(zone (net "unconnected-(J1-Pin_1-Pad1)") (layer "B.Cu") (uuid "0d6a1b50-7c1e-4f55-9a3e-2b8f4c1d9e02") (hatch edge 0.5)\n' +
      "\t\t(connect_pads (clearance 0.5)) (min_thickness 0.25) (filled_areas_thickness no)\n" +
      "\t\t(fill (thermal_gap 0.5) (thermal_bridge_width 0.5))\n" +
      "\t\t(polygon (pts (xy 55 12) (xy 88 12) (xy 88 45) (xy 55 45))))\n";
    writeFileSync(file, readFileSync(file, "utf8").replace(/\t\(embedded_fonts no\)\n\)\n$/, `${zone}\t(embedded_fonts no)\n)\n`));
    const copy = tmp("zone-board");
    cpSync(o.kicadDir, copy, { recursive: true });
    const r = await runFab(o);
    const bottom = readdirSync(join(r.outDir, "gerbers")).find((f) => f.endsWith(".gbl"))!;
    expect(readFileSync(join(r.outDir, "gerbers", bottom), "utf8")).toContain("G36*"); // region fill
    expect(sha256(file)).toBe(sha256(join(copy, `${MINI_ID}.kicad_pcb`))); // board file untouched
  }, 180_000);
});
