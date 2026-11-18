import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ROOTS, validate, type ValidateRoots } from "./validate.ts";
import { paths } from "../lib/paths.ts";

const FIXTURES = join(paths.fixtures, "module-yaml");
let tmp: string;
let roots: ValidateRoots;

/** Fake toolchain folder: fixture parts, three boards, and no lib/kicad. */
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "ghp-validate-"));
  roots = { modules: join(tmp, "modules"), parts: join(tmp, "parts"), libKicad: join(tmp, "lib/kicad") };
  cpSync(join(FIXTURES, "parts"), roots.parts, { recursive: true });
  const valid = readFileSync(join(FIXTURES, "valid.yaml"), "utf8");
  const put = (rel: string, text: string) => {
    mkdirSync(join(tmp, rel, ".."), { recursive: true });
    writeFileSync(join(tmp, rel), text);
  };
  put("modules/fixture-board/module.yaml", valid);
  put("modules/renamed/module.yaml", valid);
  put("modules/fixture-rules/module.yaml", readFileSync(join(FIXTURES, "invalid-rules.yaml"), "utf8"));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const messages = (r: ReturnType<typeof validate>) => r.errors.map((e) => `${e.file.slice(tmp.length + 1)}:${e.line} ${e.message}`);

describe("validate", () => {
  test("every board, id/directory match, schema errors with positions", () => {
    const r = validate([], roots);
    expect(r.modules.map((f) => f.slice(tmp.length + 1))).toEqual([
      "modules/fixture-board/module.yaml",
      "modules/fixture-rules/module.yaml",
      "modules/renamed/module.yaml",
    ]);
    expect(r.parts).toBe(4); // including the dotted key cap-fixture-5x5.4
    expect(r.libKicad).toBe(false);
    expect(messages(r)).toEqual([
      'modules/fixture-rules/module.yaml:6 status "built" needs revision.approval (written by bun run sch:approve)',
      'modules/fixture-rules/module.yaml:12 status "built" needs measured current draw (drawBasis: measured)',
      "modules/fixture-rules/module.yaml:16 Economic PCBA takes 0.8–1.6 mm boards (https://jlcpcb.com/capabilities/pcb-assembly-capabilities)",
      "modules/fixture-rules/module.yaml:22 Economic PCBA takes 2–50 pcs (https://jlcpcb.com/capabilities/pcb-assembly-capabilities)",
      'modules/renamed/module.yaml:3 id "fixture-board" must equal its directory name "renamed"',
    ]);
  });

  test("errors and warnings of one board", () => {
    const ok = validate(["fixture-board"], roots);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    const file = join(roots.modules, "fixture-board", "module.yaml");
    const text = readFileSync(file, "utf8");
    try {
      writeFileSync(file, text.replace("sizeMm: { w: 300, h: 40 }", "sizeMm: { w: 300, h: 40 }\n  copperOz: 2").replace("\nkind: board\n", "\nkind: board\nhp: 8\n"));
      const r = validate(["fixture-board"], roots);
      expect(messages(r)).toEqual(['modules/fixture-board/module.yaml:6 Unrecognized key: "hp"']);
      writeFileSync(file, text.replace("sizeMm: { w: 300, h: 40 }", "sizeMm: { w: 300, h: 40 }\n  copperOz: 2"));
      const w = validate(["fixture-board"], roots);
      expect(w.errors).toEqual([]);
      expect(w.warnings.map((x) => `${x.line} ${x.path.join(".")}`)).toEqual(["18 pcb.copperOz"]);
    } finally {
      writeFileSync(file, text);
    }
  });

  test("selected ids only; unknown ids and missing module.yaml are errors", () => {
    expect(validate(["fixture-board"], roots).errors).toEqual([]);
    expect(messages(validate(["nope"], roots))).toEqual(['modules/nope:1 no board named "nope" (looked in modules/)']);
    mkdirSync(join(roots.modules, "half-done"));
    try {
      expect(messages(validate([], roots))).toContain("modules/half-done/module.yaml:1 missing module.yaml (every modules/<id> needs one; see README.md)");
      expect(messages(validate(["half-done"], roots))).toEqual(["modules/half-done/module.yaml:1 missing module.yaml (every modules/<id> needs one; see README.md)"]);
    } finally {
      rmSync(join(roots.modules, "half-done"), { recursive: true });
    }
  });

  test("symbols and footprints are checked against lib/kicad once it exists", () => {
    const lib = roots.libKicad;
    mkdirSync(join(lib, "symbols"), { recursive: true });
    mkdirSync(join(lib, "footprints/GHP_Connector_JST.pretty"), { recursive: true });
    writeFileSync(join(lib, "symbols/GHP_Connector_Generic.kicad_sym"), '(kicad_symbol_lib\n\t(version 20251024)\n\t(symbol "Conn_01x02")\n)\n');
    writeFileSync(join(lib, "footprints/GHP_Connector_JST.pretty/JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical.kicad_mod"), "(footprint)\n");
    writeFileSync(join(lib, "symbols/GHP_Device.kicad_sym"), '(kicad_symbol_lib\n\t(symbol "R")\n)\n');
    try {
      const r = validate(["fixture-board"], roots);
      expect(r.libKicad).toBe(true);
      const lines = messages(r);
      expect(lines.filter((l) => l.startsWith("parts/conn-fixture.yaml"))).toEqual([]);
      expect(lines).toContain(`parts/led-fixture.yaml:4 symbol "LED" is not in ${lib}/symbols/GHP_Device.kicad_sym; run bun run lib:import`);
      expect(lines.some((l) => l.startsWith("parts/led-fixture.yaml:5 ") && l.includes("GHP_LED_SMD.pretty/LED_0805_2012Metric.kicad_mod does not exist"))).toBe(true);
      expect(lines.some((l) => l.startsWith("parts/switch-fixture.yaml:4 ") && l.includes("GHP_Switch.kicad_sym does not exist; run bun run lib:import"))).toBe(true);
    } finally {
      rmSync(lib, { recursive: true });
    }
  });

  test("broken vendored symbol files are reported with their position", () => {
    mkdirSync(join(roots.libKicad, "symbols"), { recursive: true });
    writeFileSync(join(roots.libKicad, "symbols/GHP_Connector_Generic.kicad_sym"), '(kicad_symbol_lib\n\t(symbol "Conn_01x02"\n');
    try {
      const lines = messages(validate(["fixture-board"], roots));
      expect(lines).toContain("lib/kicad/symbols/GHP_Connector_Generic.kicad_sym:2 unbalanced '(' (missing ')')");
    } finally {
      rmSync(roots.libKicad, { recursive: true });
    }
  });

  test("the toolchain folder itself validates", () => {
    const r = validate([], DEFAULT_ROOTS);
    expect(r.errors).toEqual([]);
    expect(r.modules.length).toBeGreaterThan(0);
  });
});
