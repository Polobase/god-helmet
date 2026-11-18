import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { paths } from "../lib/paths.ts";
import { BoardYaml, boardWarnings, statusAtLeast } from "./schema.ts";

const FIXTURES = join(paths.fixtures, "module-yaml");
const read = (name: string): Record<string, any> => parse(readFileSync(join(FIXTURES, name), "utf8"));
const board = () => read("valid.yaml");

/** Issues as "path: message" strings. */
function issues(input: unknown): string[] {
  const r = BoardYaml.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

function expectIssue(input: unknown, path: string, message: RegExp) {
  const found = issues(input);
  const hit = found.find((s) => s.startsWith(`${path}: `) && message.test(s));
  if (!hit) throw new Error(`expected an issue at ${path} matching ${message}, got:\n${found.join("\n")}`);
}

const warnings = (input: unknown) => boardWarnings(BoardYaml.parse(input)).map((w) => `${w.path.join(".")}: ${w.message}`);

describe("valid board", () => {
  test("fixture parses; defaults: kind board, green mask, 1 oz copper, not panelized; no warnings", () => {
    const r = BoardYaml.safeParse(board());
    expect(r.error).toBeUndefined();
    expect(r.data).toMatchObject({ kind: "board", pcb: { mask: "green", copperOz: 1, sizeMm: { w: 300, h: 40 } }, jlcpcb: { qty: 5, assembleQty: 2, panelized: false } });
    expect(boardWarnings(r.data!)).toEqual([]);
  });

  test("kind may be left out; any other kind is refused", () => {
    const m = board();
    delete m.kind;
    expect(BoardYaml.parse(m).kind).toBe("board");
    m.kind = "module";
    expect(issues(m)).toEqual(['kind: Invalid input: expected "board"']);
  });

  test("statusAtLeast follows the lifecycle order", () => {
    expect(statusAtLeast("built", "schematic-approved")).toBe(true);
    expect(statusAtLeast("schematic", "schematic-approved")).toBe(false);
  });
});

describe("shape errors", () => {
  test("types, formats, unknown keys and missing keys", () => {
    const m = read("invalid-types.yaml");
    expectIssue(m, "id", /lowercase letters/);
    expectIssue(m, "revision.date", /expected string, received undefined/);
    expectIssue(m, "power.drawMa.usb-c-5v", />=0/);
    expectIssue(m, "power", /Unrecognized key: "voltage"/);
    expectIssue(m, "pcb.thicknessMm", /0\.8\|1\|1\.2\|1\.6\|2/);
  });

  test("power.drawMa: mA by rail name, at least one rail", () => {
    const m = board();
    m.power.drawMa = { "usb-c-5v": 1100, "+3V3": 0, VIN: 2.5, "-15V": 40, "rail_2.a": 1 };
    expect(issues(m)).toEqual([]);
    m.power.drawMa = {};
    expect(issues(m)).toEqual(["power.drawMa: name at least one supply rail, e.g. { usb-c-5v: 250 }"]);
    m.power.drawMa = { "usb c": 5 };
    expect(issues(m)).toEqual([expect.stringMatching(/^power\.drawMa\.usb c: rail "usb c": expected 1-24 letters/)]);
    m.power.drawMa = { vin: -1 };
    expectIssue(m, "power.drawMa.vin", />=0/);
    // Rail names are free; no fixed set of rails is asked for.
    m.power.drawMa = { plus12: 5 };
    expect(issues(m)).toEqual([]);
  });

  test("a board records its outline; unknown keys are refused", () => {
    const noSize = board();
    delete noSize.pcb.sizeMm;
    expect(issues(noSize)).toEqual(["pcb.sizeMm: Invalid input: expected object, received undefined"]);
    const extra = board();
    extra.color = "blue";
    extra.firmware = {};
    expect(issues(extra)).toEqual([': Unrecognized keys: "color", "firmware"']);
    const keys = board();
    keys.pcb.heightMm = 20;
    keys.power.voltage = 5;
    expect(issues(keys).sort()).toEqual(['pcb: Unrecognized key: "heightMm"', 'power: Unrecognized key: "voltage"']);
  });

  test("the mask is green unless module.yaml says black; other colours are not offered", () => {
    expect(BoardYaml.parse(board()).pcb.mask).toBe("green");
    const m = board();
    m.pcb.mask = "black";
    expect(BoardYaml.parse(m).pcb.mask).toBe("black");
    m.pcb.mask = "purple";
    expect(issues(m)).toEqual([expect.stringMatching(/^pcb\.mask: /)]);
  });
});

describe("cross-field rules", () => {
  const rules = () => read("invalid-rules.yaml");

  test("JLCPCB Economic PCBA limits", () => {
    const m = rules();
    expectIssue(m, "pcb.thicknessMm", /Economic PCBA takes 0\.8–1\.6 mm.*pcb-assembly-capabilities/);
    expectIssue(m, "jlcpcb.qty", /Economic PCBA takes 2–50 pcs/);
    // THT by JLCPCB on top plus SMT on the bottom is unverified, so it is only a warning.
    expect(issues(m).filter((s) => s.startsWith("jlcpcb.smtSide"))).toEqual([]);
  });

  test("tht by JLCPCB needs assembly", () => {
    const m = board();
    delete m.jlcpcb.assembleQty;
    m.jlcpcb.assembly = "none";
    m.jlcpcb.tht = "consign";
    expect(issues(m)).toEqual(['jlcpcb.tht: tht "consign" needs JLCPCB assembly (assembly is "none")']);
  });

  test("standoffs need the spacer the order remark names", () => {
    const m = board();
    m.jlcpcb.standoffs = { D1: 6 };
    expectIssue(m, "jlcpcb.spacer", /standoffs need the spacer part/);
    m.jlcpcb.spacer = { lcsc: "C94094", name: "LED spacer 6 mm", diameterMm: 4 };
    expect(issues(m)).toEqual([]);
  });

  test("lifecycle: estimates and approval", () => {
    const m = rules();
    expectIssue(m, "power.drawBasis", /status "built" needs measured/);
    expectIssue(m, "revision.approval", /sch:approve/);
    const ok = board();
    ok.revision.status = "layout";
    ok.revision.approval = { schSha256: "a".repeat(64), date: "2026-09-24" };
    expect(issues(ok)).toEqual([]);
    const built = board();
    built.revision.status = "built";
    expect(issues(built).map((s) => s.split(":")[0])).toEqual(["power.drawBasis", "revision.approval"]);
  });

  test("2 or 4 copper layers; a 4-layer board is 1.6 mm with 1 oz outer copper (JLCPCB's JLC04161H-7628)", () => {
    const m = board();
    m.pcb.layers = 4;
    expect(issues(m)).toEqual([]);
    expect(BoardYaml.parse(m).pcb.layers).toBe(4);
    m.pcb.layers = 3;
    expect(issues(m)).toEqual([expect.stringMatching(/^pcb\.layers: /)]);
    const thin = board();
    thin.pcb.layers = 4;
    thin.pcb.thicknessMm = 1.2;
    expect(issues(thin)).toEqual([expect.stringMatching(/^pcb\.thicknessMm: a 4-layer board uses JLCPCB's JLC04161H-7628 stackup, which is 1\.6 mm/)]);
    const heavy = board();
    heavy.pcb.layers = 4;
    heavy.pcb.copperOz = 2;
    expect(issues(heavy)).toEqual([expect.stringMatching(/^pcb\.copperOz: JLCPCB's JLC04161H-7628 stackup has 1 oz outer copper/)]);
  });

  test("the outline against the assembly tier's single-board sizes", () => {
    const m = board();
    m.pcb.sizeMm = { w: 480, h: 40 }; // Economic: up to 470 × 500 mm, either way round
    expect(issues(m)).toEqual([]);
    m.pcb.sizeMm = { w: 40, h: 510 };
    expect(issues(m)).toEqual([expect.stringMatching(/^pcb\.sizeMm: Economic PCBA takes single boards of 10 × 10 to 470 × 500 mm.*this board is 40 × 510 mm$/)]);
    m.pcb.sizeMm = { w: 300, h: 8 };
    expect(issues(m)).toHaveLength(1);

    const s = board();
    s.jlcpcb.assembly = "standard";
    expect(issues(s)).toEqual([expect.stringMatching(/^jlcpcb\.panelized: Standard PCBA needs single boards of at least 70×70 mm.*this board is 300 × 40 mm/)]);
    s.jlcpcb.panelized = true;
    expect(issues(s)).toEqual([]);
    s.pcb.sizeMm = { w: 505, h: 100 };
    expect(issues(s)).toEqual([expect.stringMatching(/^pcb\.sizeMm: Standard PCBA takes single boards up to 460 × 500 mm/)]);
  });

  test("assembleQty: at most qty, needs assembly, and the tier limits count assembled boards", () => {
    const m = board();
    m.jlcpcb.assembleQty = 6;
    expect(issues(m)).toEqual(["jlcpcb.assembleQty: assembleQty 6 is more than the 5 PCBs ordered (qty)"]);
    m.jlcpcb.assembleQty = 1;
    expect(issues(m)).toEqual([expect.stringMatching(/^jlcpcb\.assembleQty: Economic PCBA takes 2–50 pcs/)]);
    const bare = board();
    bare.jlcpcb = { ...bare.jlcpcb, assembly: "none", tht: "self" };
    expect(issues(bare)).toEqual(['jlcpcb.assembleQty: assembleQty needs JLCPCB assembly (assembly is "none")']);
    // 60 PCBs, 5 of them assembled, is within Economic's 2–50.
    const many = board();
    delete many.jlcpcb.assembleQty;
    many.jlcpcb.qty = 60;
    expectIssue(many, "jlcpcb.qty", /Economic PCBA takes 2–50 pcs/);
    many.jlcpcb.assembleQty = 5;
    expect(issues(many)).toEqual([]);
  });
});

describe("boardWarnings", () => {
  test("Economic PCBA with SMT on the bottom and THT by JLCPCB is unverified", () => {
    const where = (m: Record<string, any>) => warnings(m).map((s) => s.split(":")[0]);
    for (const tht of ["jlcpcb", "consign"]) {
      const m = board();
      m.jlcpcb.smtSide = "bottom";
      m.jlcpcb.tht = tht;
      expect(issues(m)).toEqual([]);
      const w = warnings(m);
      expect(w).toHaveLength(1);
      expect(w[0]).toMatch(/^jlcpcb\.smtSide: Economic PCBA is "Single sided placement \(SMT\/Thru-hole\)".*pcb-assembly-capabilities.*unverified \(docs\/jlcpcb\.md §7, §14\)/);
      expect(w[0]).toContain(`(tht: ${tht})`);
      m.jlcpcb.smtSide = "top";
      expect(where(m)).toEqual([]);
    }
    const self = board();
    self.jlcpcb = { ...self.jlcpcb, smtSide: "bottom", tht: "self" };
    expect(where(self)).toEqual([]);
  });

  test("Economic PCBA above 30 assembled boards", () => {
    const m = board();
    m.jlcpcb.qty = 40;
    m.jlcpcb.assembleQty = 31;
    expect(warnings(m)).toEqual([expect.stringMatching(/^jlcpcb\.assembleQty: Economic PCBA above 30 pcs/)]);
    m.jlcpcb.assembleQty = 30;
    expect(warnings(m)).toEqual([]);
  });

  test("2 oz with Economic PCBA, and the large-size fee threshold", () => {
    const m = board();
    m.pcb.copperOz = 2;
    expect(warnings(m)).toEqual([expect.stringMatching(/^pcb\.copperOz: 2 oz copper with Economic PCBA is unverified \(docs\/jlcpcb\.md §7\)/)]);
    m.pcb.copperOz = 4;
    expect(issues(m)).toHaveLength(1);

    // The fee counts one board's area: 164 cm² per board stays under 650 cm² however many are assembled
    // (two quotes for ten such boards showed no fee).
    const long = board();
    long.pcb.sizeMm = { w: 390, h: 42 };
    expect(warnings(long)).toEqual([]);
    delete long.jlcpcb.assembleQty;
    long.jlcpcb.qty = 10;
    expect(warnings(long)).toEqual([]);
    const big = board();
    big.pcb.sizeMm = { w: 300, h: 250 };
    expect(warnings(big)).toEqual([expect.stringMatching(/^pcb\.sizeMm: the board is 750 cm²: JLCPCB charges a large-size assembly fee/)]);
    const noAssembly = board();
    noAssembly.jlcpcb = { assembly: "none", smtSide: "top", tht: "self", qty: 5, removeOrderNumber: true };
    noAssembly.pcb.sizeMm = { w: 300, h: 250 };
    expect(warnings(noAssembly)).toEqual([]);
  });
});
