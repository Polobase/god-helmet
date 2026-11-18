import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { loadProjectYaml } from "../module/load.ts";
import type { Part } from "../module/parts.ts";
import type { AssemblyLine } from "./bom.ts";
import { writeInputs } from "./inputs.ts";
import { orderFiles, orderMarkdown, orderProblems, ownPartsCsv, writeOrderPackage, type OrderContext } from "./order.ts";

const board = () => loadProjectYaml(join(paths.fixtures, "module-yaml", "valid.yaml"));
const temp = () => mkdtempSync(join(tmpdir(), "order-"));
const GOLDEN = join(paths.fixtures, "order", "fixture-board-ORDER.md");

/** Test parts (not the parts DB): what ORDER.md reads from them is sourcing, `preorder` and `order.previewCheck`. */
const part = (description: string, assembly: Part["assembly"], value: string, manufacturer: string, o: { preorder?: boolean; previewCheck?: string } = {}): Part => ({
  schema: 1, description, symbol: "Device:R", footprint: "Resistor_SMD:R_0603_1608Metric", assembly, datasheet: null,
  values: { [value]: { mpn: "m", manufacturer, lcsc: null, jlcpcbTier: null, verified: null, ...(o.preorder && { preorder: true }) } },
  ...(o.previewCheck && { order: { previewCheck: o.previewCheck } }),
});
const PARTS = new Map<string, Part>([
  ["cap", part("Capacitor 100 nF, 0603", "smt", "100n", "Samsung")],
  ["opamp", part("Quad op-amp, SOIC-14", "smt", "TL074H", "Texas Instruments", { previewCheck: "pin 1" })],
  ["switch", part("Tactile switch, SMD", "smt", "TS-1187A", "XKB", { preorder: true })],
  ["conn", part("JST XH 2-pin header, vertical", "tht", "B2B-XH-A", "JST", { previewCheck: "pin 1 and the side of the header's opening" })],
  ["rj45", part("RJ45 jack, shielded, through-hole", "tht", "DS1128", "Connfly")],
]);
const line = (ref: string, value: string, lcsc: string, partKey: string): AssemblyLine =>
  ({ ref, value, footprint: "x", lcsc, mpn: "m", partKey, consigned: false, verified: true });
const ctx = (): OrderContext => ({
  lines: [
    line("C1", "100n", "C14663", "cap"), line("C2", "100n", "C14663", "cap"), line("U1", "TL074H", "C2878713", "opamp"),
    line("SW1", "TS-1187A", "C318884", "switch"), line("SW2", "TS-1187A", "C318884", "switch"), line("J1", "B2B-XH-A", "C158012", "conn"),
  ],
  parts: PARTS,
});
/** ORDER.md with the list items unwrapped, so a phrase can be matched across a line break. */
const flat = (md: string) => md.replace(/\n +/g, " ");

describe("orderMarkdown", () => {
  test("the fixture board's ORDER.md equals the golden copy", () => {
    const md = orderMarkdown("fixture-board", board(), orderFiles("fixture-board", "A", "/any/build"), ctx());
    if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, md);
    expect(md).toBe(readFileSync(GOLDEN, "utf8"));
  });

  test("one board: its outline and copper, the assembled quantity, pre-orders, checks, THT note", () => {
    const md = flat(orderMarkdown("fixture-board", board(), orderFiles("fixture-board", "A", "/b"), ctx()));
    expect(md).toContain("# fixture-board rev A: one JLCPCB cart");
    expect(md).toContain("## 1. PCB with PCB Assembly — `pcb-with-assembly/`");
    expect(md).toContain("2. Settings: FR-4, 2 layers, 300 × 40 mm, 1.6 mm, 1 oz outer copper, qty 5, green mask, lead-free HASL, Mark on PCB: Remove Mark.");
    expect(md).toContain("assembly side **Top**, qty 2 (Economic allows 2 as the minimum); the other three PCBs arrive bare.");
    // Pre-orders count assembled boards: 2 switches × 2 boards + 3 spare.
    expect(md).toContain("**pre-order the TS-1187A parts** (C318884), at least 7 for 2 boards");
    expect(md).toContain("In the placement preview, check pin 1 of U1 (TL074H) and pin 1 and the side of the header's opening of J1 (B2B-XH-A).");
    expect(md).toContain("Extended-part fee is charged on the through-hole lines (docs/jlcpcb.md §14).");
    expect(md).toContain("## 2. Before you pay");
    for (const absent of ["## 3.", "Left out on purpose", "Assembly Standoffs"]) expect(md).not.toContain(absent);
  });

  test("a 4-layer board: the settings name the layers and the stackup the board file describes", () => {
    const m = board();
    m.pcb.layers = 4;
    const md = flat(orderMarkdown("fixture-board", m, orderFiles("fixture-board", "A", "/b"), ctx()));
    expect(md).toContain("2. Settings: FR-4, 4 layers, stackup JLC04161H-7628 (1.6 mm, inner copper 0.5 oz: the one the board file describes, https://jlcpcb.com/impedance), 300 × 40 mm, 1.6 mm,");
    expect(md).not.toContain("2 layers");
  });

  test("a black board: the settings name the mask colour of module.yaml", () => {
    const m = board();
    m.pcb.mask = "black";
    const md = flat(orderMarkdown("fixture-board", m, orderFiles("fixture-board", "A", "/b"), ctx()));
    expect(md).toContain("1 oz outer copper, qty 5, black mask, lead-free HASL,");
    expect(md).not.toContain("green mask");
  });

  test("SMT on the bottom with JLCPCB's THT: the Economic question joins the quote check", () => {
    const m = board();
    m.jlcpcb.smtSide = "bottom";
    const md = flat(orderMarkdown("fixture-board", m, orderFiles("fixture-board", "A", "/b"), ctx()));
    expect(md).toContain("and whether the order stays **Economic** with SMD on the bottom and THT on the other side (docs/jlcpcb.md §7, §14).");
  });

  test("standoffs, hand-soldered parts and the board's own notes", () => {
    const m = board();
    m.jlcpcb.standoffs = { SW1: 2, SW2: 2 };
    m.jlcpcb.spacer = { lcsc: "C94094", name: "nylon spacer", diameterMm: 4 };
    m.jlcpcb.handSolder = ["J9"];
    m.order = { notes: ["Test boards only."] };
    const md = flat(orderMarkdown("fixture-board", m, orderFiles("fixture-board", "A", "/b"), ctx()));
    expect(md).toContain('Order remark (JLCPCB "Assembly Standoffs" service, docs/pcb.md): "Assembly Standoffs: SW1 and SW2 (TS-1187A, C318884) seated on a 2 mm tall spacer (Ø4 mm), ' +
      'leads through the spacer, part body 2.0 mm above the PCB top. Preferred spacer C94094 (nylon spacer), equivalent allowed."');
    expect(md).toContain("Left out on purpose — you solder these yourself: J9.");
    expect(md).toContain("- Test boards only.");
  });

  test("you solder the through-hole parts (tht: self): ORDER.md lists what to buy, per board and for the assembled boards", () => {
    const self = board();
    self.jlcpcb.tht = "self";
    const c: OrderContext = {
      lines: [line("C1", "100n", "C14663", "cap")],
      parts: PARTS,
      selfSoldered: [line("J1", "B2B-XH-A", "C158012", "conn"), line("J2", "B2B-XH-A", "C158012", "conn"), line("J3", "DS1128", "C5381702", "rj45")],
    };
    const md = flat(orderMarkdown("fixture-board", self, orderFiles("fixture-board", "A", "/b"), c));
    expect(md).toContain("Left out on purpose — you solder the through-hole parts yourself (module.yaml `jlcpcb.tht: self`). " +
      "Per board: 2 × B2B-XH-A (JST m, LCSC C158012) and 1 × DS1128 (Connfly m, LCSC C5381702). For the 2 assembled boards: 4 and 2.");
    expect(md).toContain("JLCPCB ships no loose parts with a PCBA order (docs/jlcpcb.md §10): buy them from another shop. `parts-you-solder.csv` is that list as a file; LCSC sells these part numbers.");
    // The same list as a file: one row per part, the quantity for the assembled boards.
    expect(ownPartsCsv(self, c)!.split("\n").slice(0, 3)).toEqual([
      "LCSC Part Number,Manufacturer Part Number,Manufacturer,Description,Designators,Per board,Quantity",
      'C158012,m,JST,"JST XH 2-pin header, vertical",J1 J2,2,4',
      'C5381702,m,Connfly,"RJ45 jack, shielded, through-hole",J3,1,2',
    ]);
    expect(ownPartsCsv(board(), ctx())).toBeUndefined();
    for (const absent of ["Extended-part fee is charged on the through-hole lines", "pre-order", "placement preview"]) expect(md).not.toContain(absent);
    // Nothing is listed when JLCPCB solders them.
    expect(orderMarkdown("fixture-board", board(), orderFiles("fixture-board", "A", "/b"), ctx())).not.toContain("you solder the through-hole parts");
  });

  test("every PCB assembled: no remark about bare boards; one bare board is singular", () => {
    const all = board();
    delete all.jlcpcb.assembleQty;
    const files = orderFiles("fixture-board", "A", "/b");
    expect(flat(orderMarkdown("fixture-board", all, files, ctx()))).toContain("qty 5 (Economic allows 2 as the minimum).");
    const four = board();
    four.jlcpcb.assembleQty = 4;
    expect(flat(orderMarkdown("fixture-board", four, files, ctx()))).toContain("qty 4 (Economic allows 2 as the minimum); the other one PCB arrives bare.");
  });
});

/** Fake fab outputs under a temp build root. */
function fakeOutputs(root: string) {
  const files = orderFiles("fixture-board", "A", root);
  for (const f of Object.values(files)) {
    mkdirSync(join(f, ".."), { recursive: true });
    writeFileSync(f, `content of ${f.split("/").pop()}`);
  }
  return files;
}

describe("writeOrderPackage", () => {
  test("replaces only its own entries and keeps the user's files", () => {
    const files = fakeOutputs(temp());
    const out = temp();
    writeFileSync(join(out, "image.png"), "a screenshot");
    mkdirSync(join(out, "pcb-with-assembly"));
    writeFileSync(join(out, "pcb-with-assembly", "stale-rev0-bom.csv"), "old");
    const { written, kept } = writeOrderPackage("fixture-board", board(), files, ctx(), out);
    expect(kept).toEqual(["image.png"]);
    expect(readFileSync(join(out, "image.png"), "utf8")).toBe("a screenshot");
    expect(existsSync(join(out, "pcb-with-assembly", "stale-rev0-bom.csv"))).toBe(false);
    expect(written.map((f) => f.slice(out.length + 1))).toEqual([
      "pcb-with-assembly/fixture-board-revA-gerbers.zip",
      "pcb-with-assembly/fixture-board-revA-bom.csv",
      "pcb-with-assembly/fixture-board-revA-cpl.csv",
      "ORDER.md",
    ]);
    expect(readFileSync(join(out, "pcb-with-assembly", "fixture-board-revA-bom.csv"), "utf8")).toBe("content of fixture-board-revA-bom.csv");
  });
});

describe("orderProblems", () => {
  test("missing outputs name the command that makes them", () => {
    const problems = orderProblems("fixture-board", orderFiles("fixture-board", "A", temp()));
    expect(problems).toHaveLength(3);
    expect(problems.every((p) => p.endsWith("(run bun run fab -- fixture-board)"))).toBe(true);
  });

  test("freshness by content: a touch is fine, an edited source is refused, no inputs.json is refused", () => {
    const root = temp();
    const files = fakeOutputs(root);
    const src = join(root, "board.kicad_pcb");
    writeFileSync(src, "routed");
    expect(orderProblems("fixture-board", files)).toEqual([expect.stringContaining("has no inputs.json")]);
    writeInputs(join(files.gerbers, ".."), [src]);
    expect(orderProblems("fixture-board", files)).toEqual([]);
    const later = new Date(Date.now() + 60_000);
    utimesSync(src, later, later);
    expect(orderProblems("fixture-board", files)).toEqual([]);
    writeFileSync(src, "re-routed");
    expect(orderProblems("fixture-board", files)).toEqual([
      expect.stringMatching(/^changed since bun run fab: .*board\.kicad_pcb \(run bun run fab -- fixture-board\)$/),
    ]);
  });
});
