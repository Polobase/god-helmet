// Integration tests against the installed kicad-cli (skipped when absent; `bun run test:full`
// makes absence a failure). Each test works in its own temp project with its own
// KICAD_CONFIG_HOME, so nothing in the repo or the user's KiCad settings is touched.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findKicadCli, kicadCli } from "../../tools/kicad/cli.ts";
import { emitSchematic } from "../../tools/kicad/emit-sch.ts";
import { mmToIu } from "../../tools/kicad/geometry.ts";
import { toolAvailable } from "../../tools/lib/testing.ts";
import { TOOL_VERSION } from "../../tools/sch/build.ts";
import type { DesignInput } from "../../tools/sch/dsl.ts";
import { compareNetlist, ercGateProblems, exportSchematicPdf, runErc, writeGenerated } from "../../tools/sch/gates.ts";
import { generate, type Generated } from "../../tools/sch/generate.ts";
import type { SheetIR } from "../../tools/sch/ir.ts";
import proof from "../fixtures/pipeline-proof/schematic.ts";

const hasKicad = toolAvailable(findKicadCli() !== null, "kicad-cli");
const TIMEOUT = 120_000;

// One temp root per test file, removed afterwards.
const ROOT = mkdtempSync(join(tmpdir(), "ghp-pipeline-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
let seq = 0;

function tempProject(id: string, design: DesignInput): { g: Generated; dir: string; config: string } {
  const dir = join(ROOT, `${id}-${++seq}`);
  const config = join(ROOT, `config-${seq}`);
  mkdirSync(dir, { recursive: true });
  const g = generate(id, design, { dir });
  writeGenerated(g);
  return { g, dir, config };
}

/** Re-emit the proof after mutating its IR (bypasses the builder's own checks on purpose). */
async function ercOfMutation(mutate: (ir: SheetIR) => void, patchText?: (sch: string) => string) {
  const { g, dir, config } = tempProject("pipeline-proof", proof);
  const ir = structuredClone(g.build.ir);
  // structuredClone drops nothing we need, but symbol info objects are shared read-only data.
  ir.units = g.build.ir.units.map((u) => ({ ...u }));
  mutate(ir);
  let text = emitSchematic(ir, TOOL_VERSION);
  if (patchText) text = patchText(text);
  writeFileSync(g.schPath, text);
  return runErc(g.schPath, join(dir, "out"), config);
}

describe.skipIf(!hasKicad)("pipeline proof on the installed KiCad", () => {
  test("ERC passes with 0 errors and 0 warnings", async () => {
    const { g, dir, config } = tempProject("pipeline-proof", proof);
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    if (erc.errors + erc.warnings) console.error(readFileSync(erc.rptPath, "utf8"));
    expect({ errors: erc.errors, warnings: erc.warnings }).toEqual({ errors: 0, warnings: 0 });
    expect(ercGateProblems(erc)).toEqual([]);
    expect(erc.kicadVersion).toMatch(/^10\.0\./);
  }, TIMEOUT);

  test("an ERC rule switched to ignore in the .kicad_pro fails the gate", async () => {
    const { g, dir, config } = tempProject("pipeline-proof", proof);
    const proPath = join(dir, "pipeline-proof.kicad_pro");
    const pro = JSON.parse(readFileSync(proPath, "utf8"));
    pro.erc.rule_severities = { pin_not_connected: "ignore" };
    writeFileSync(proPath, JSON.stringify(pro, null, 2));
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    expect(erc.extraIgnored).toEqual(["pin_not_connected"]);
    expect(ercGateProblems(erc).join()).toContain("switched to \"ignore\"");
  }, TIMEOUT);

  test("netlist round-trip: nets, values, footprints and symbol UUIDs match", async () => {
    const { g, dir, config } = tempProject("pipeline-proof", proof);
    const out = join(dir, "net.xml");
    await kicadCli(["sch", "export", "netlist", "--format", "kicadxml", "-o", out, g.schPath], { configHome: config });
    expect(compareNetlist(g, readFileSync(out, "utf8"))).toEqual([]);
  }, TIMEOUT);

  test("a KiCad re-save changes nothing but the generator header", async () => {
    const { g, config } = tempProject("pipeline-proof", proof);
    const ours = readFileSync(g.schPath, "utf8");
    await kicadCli(["sch", "upgrade", "--force", g.schPath], { configHome: config });
    const theirs = readFileSync(g.schPath, "utf8");
    const strip = (t: string) => t.replace(/\(generator "[^"]*"\)\n\t\(generator_version "[^"]*"\)/, "");
    expect(strip(theirs)).toBe(strip(ours));
  }, TIMEOUT);

  test("all 12 rotation/mirror pairs: ERC 0/0, netlist equal, KiCad re-save identical", async () => {
    const combos = ([0, 90, 180, 270] as const).flatMap((rot) => ([undefined, "x", "y"] as const).map((mirror) => ({ rot, mirror })));
    const parts: DesignInput["parts"] = {};
    const noConnect: string[] = [];
    combos.forEach((c, i) => {
      const key = `p${i}`;
      parts[key] = { ref: `Q${i + 1}`, part: "mmbt3904-sot23", at: [30 + (i % 4) * 30, 40 + Math.floor(i / 4) * 30], rot: c.rot, ...(c.mirror && { mirror: c.mirror }) };
      noConnect.push(`${key}.1`, `${key}.2`, `${key}.3`);
    });
    const design: DesignInput = { project: "orient", sheet: { paper: "A4", title: "orientations", rev: "A", date: "2026-09-24" }, parts, nets: {}, noConnect };
    const { g, dir, config } = tempProject("orient", design);
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    expect(ercGateProblems(erc)).toEqual([]);
    const net = join(dir, "net.xml");
    await kicadCli(["sch", "export", "netlist", "--format", "kicadxml", "-o", net, g.schPath], { configHome: config });
    expect(compareNetlist(g, readFileSync(net, "utf8"))).toEqual([]);
    const ours = readFileSync(g.schPath, "utf8");
    await kicadCli(["sch", "upgrade", "--force", g.schPath], { configHome: config });
    const strip = (t: string) => t.replace(/\(generator "[^"]*"\)\n\t\(generator_version "[^"]*"\)/, "");
    expect(strip(readFileSync(g.schPath, "utf8"))).toBe(strip(ours));
  }, TIMEOUT);

  test("PDF export", async () => {
    const { g, dir, config } = tempProject("pipeline-proof", proof);
    const out = join(dir, "proof.pdf");
    await exportSchematicPdf(g.schPath, out, "test", config);
    expect(readFileSync(out).subarray(0, 5).toString()).toBe("%PDF-");
  }, TIMEOUT);
});

// Each deliberately broken variant must be caught by ERC with the expected finding, proving
// that a clean ERC result is not vacuous.
describe.skipIf(!hasKicad)("negative variants are caught by ERC", () => {
  const cases: [string, string, (ir: SheetIR) => void, ((s: string) => string)?][] = [
    ["GND without PWR_FLAG", "power_pin_not_driven", (ir) => {
      ir.units = ir.units.filter((u) => u.uuidName !== "pipeline-proof/flag/GND");
    }],
    ["second PWR_FLAG on +12V", "pin_to_pin", (ir) => {
      const f = ir.units.find((u) => u.uuidName === "pipeline-proof/flag/+12V")!;
      ir.units.push({ ...f, uuidName: "pipeline-proof/flag/+12V-dup", ref: "#FLG99" });
    }],
    ["op-amp power unit omitted", "missing_power_pin", (ir) => {
      ir.units = ir.units.filter((u) => !(u.ref === "U1" && u.unit === 3));
    }],
    ["one unit with a different footprint", "different_unit_footprint", (ir) => {
      const u = ir.units.find((x) => x.ref === "U1" && x.unit === 2)!;
      u.footprint = "GHP_Resistor_SMD:R_0603_1608Metric";
    }],
    ["no-connects removed (J2, J3 and J1's unused contacts)", "pin_not_connected", (ir) => {
      ir.noConnects = [];
    }],
    ["wire end moved off grid", "endpoint_off_grid", (ir) => {
      const w = ir.wires[0]!;
      w.b = { x: w.b.x + mmToIu(0.635), y: w.b.y };
    }],
    ["label on a single-pin net", "isolated_pin_label", (ir) => {
      const nc = ir.noConnects[0]!;
      ir.noConnects = [];
      ir.labels.push({ text: "LONELY", at: nc, angle: 180 });
    }],
    ["undefined text variable in the title block", "unresolved_variable", (ir) => {
      ir.titleBlock.comments.push("${UNDEFINED_VARIABLE}");
    }],
  ];
  for (const [name, expected, mutate, patch] of cases) {
    test(`${name} -> ${expected}`, async () => {
      const erc = await ercOfMutation(mutate, patch);
      expect(erc.types).toContain(expected);
    }, TIMEOUT);
  }
});

// KiCad #25583: builds made with libc++ 22 (Xcode 26) merged points with equal x²+y² into one
// net. Two resistors whose pins sit at (38.1, 50.8) and (50.8, 38.1) must stay on separate nets.
describe.skipIf(!hasKicad)("canary for KiCad #25583 (net merge on equal x²+y²)", () => {
  const canary: DesignInput = {
    project: "canary",
    sheet: { paper: "A4", title: "Canary #25583", rev: "A", date: "2026-09-24" },
    parts: {
      rA: { ref: "R1", part: "res-0603", value: "10k", at: [30, 43] }, // pin 1 at (38.1, 50.8) mm
      rB: { ref: "R2", part: "res-0603", value: "10k", at: [40, 33] }, // pin 1 at (50.8, 38.1) mm
    },
    nets: {
      A: { pins: ["rA.1", "rA.2"] },
      B: { pins: ["rB.1", "rB.2"] },
    },
  };

  test("pins at swapped coordinates stay on separate nets", async () => {
    const { g, dir, config } = tempProject("canary", canary);
    const pins = g.build.ir.units.flatMap((u) => u.ref === "R1" || u.ref === "R2" ? [u.at] : []);
    expect(pins.length).toBe(2);
    const erc = await runErc(g.schPath, join(dir, "out"), config);
    expect(erc.types).not.toContain("multiple_net_names");
    const out = join(dir, "net.xml");
    await kicadCli(["sch", "export", "netlist", "--format", "kicadxml", "-o", out, g.schPath], { configHome: config });
    expect(compareNetlist(g, readFileSync(out, "utf8"))).toEqual([]);
  }, TIMEOUT);
});
