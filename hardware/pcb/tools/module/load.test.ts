import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { formatIssue, loadAllParts, loadProject, loadProjectYaml, loadYaml, parseProject, parseYaml, ValidationError, type Issue } from "./load.ts";
import { Part } from "./parts.ts";
import { BoardYaml, PART_KEY_RE } from "./schema.ts";

const FIXTURES = join(paths.fixtures, "module-yaml");

function issuesOf(fn: () => unknown): Issue[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.issues;
    throw e;
  }
  throw new Error("expected a ValidationError");
}

/** "line:col path" per issue. */
const where = (issues: Issue[]) => issues.map((i) => `${i.line}:${i.col} ${i.path.join(".")}`);

describe("loadProjectYaml", () => {
  test("returns typed data for a valid file", () => {
    const m = loadProjectYaml(join(FIXTURES, "valid.yaml"));
    expect(m.id).toBe("fixture-board");
    expect(m.kind).toBe("board");
    expect(m.power.drawMa).toEqual({ "usb-c-5v": 250, "+12V": 5 });
    expect(m.pcb).toMatchObject({ sizeMm: { w: 300, h: 40 }, copperOz: 1 });
  });

  test("kind is optional: a board is the only kind", () => {
    const text = readFileSync(join(FIXTURES, "valid.yaml"), "utf8").replace("kind: board\n", "");
    expect(parseProject(text, "no-kind.yaml").value.kind).toBe("board");
    const other = readFileSync(join(FIXTURES, "valid.yaml"), "utf8").replace("kind: board\n", "kind: module\n");
    expect(issuesOf(() => parseProject(other, "x.yaml")).map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual(['kind: Invalid input: expected "board"']);
  });

  test("schema issues carry the line and column of the offending node", () => {
    const issues = issuesOf(() => loadProjectYaml(join(FIXTURES, "invalid-types.yaml")));
    expect(where(issues)).toEqual([
      "2:5 id", // value
      "4:1 revision.date", // missing key → the enclosing block's key
      "8:23 power.drawMa.usb-c-5v", // inside a flow map
      "8:37 power.drawMa.bad rail", // a rail name the schema refuses
      "10:3 power", // unknown key → the key itself
      "14:16 pcb.thicknessMm",
    ]);
  });

  test("cross-field issues are located too", () => {
    const issues = issuesOf(() => loadProjectYaml(join(FIXTURES, "invalid-rules.yaml")));
    const byPath = new Map(issues.map((i) => [i.path.join("."), `${i.line}:${i.col}`]));
    expect(byPath.get("revision.approval")).toBe("6:1");
    expect(byPath.get("power.drawBasis")).toBe("12:14");
    expect(byPath.get("pcb.thicknessMm")).toBe("16:16");
    expect(byPath.get("jlcpcb.qty")).toBe("22:8");
    // sorted by position
    const lines = issues.map((i) => i.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });

  test("YAML syntax errors are issues with positions", () => {
    const issues = issuesOf(() => loadProjectYaml(join(FIXTURES, "invalid-syntax.yaml")));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ line: 3, col: 1, path: [] });
    expect(issues[0]!.message).toContain("DUPLICATE_KEY");
  });

  test("empty document", () => {
    const issues = issuesOf(() => parseYaml(BoardYaml, "", "empty.yaml"));
    expect(issues[0]).toMatchObject({ file: "empty.yaml", line: 1, col: 1 });
  });

  test("error text combines file:line:col with the prettifyError style", () => {
    const text = formatIssue({ file: join(paths.root, "modules/x/module.yaml"), line: 4, col: 5, path: ["power", "drawMa", "vin"], message: "boom" });
    expect(text).toBe("modules/x/module.yaml:4:5 ✘ boom\n  → at power.drawMa.vin");
    const err = new ValidationError([{ file: "a.yaml", line: 1, col: 1, path: [], message: "bad" }]);
    expect(err.message).toBe("a.yaml:1:1 ✘ bad");
  });

  test("locate() maps follow-up paths", () => {
    const loaded = loadYaml(BoardYaml, join(FIXTURES, "valid.yaml"));
    expect(loaded.locate(["power", "drawMa"])).toEqual({ line: 11, col: 11 }); // the "{" of the flow map
    expect(loaded.locate(["pcb", "sizeMm"])).toEqual({ line: 17, col: 11 });
    expect(loaded.locate(["jlcpcb"])).toEqual({ line: 18, col: 1 });
    expect(loadProject(join(FIXTURES, "valid.yaml")).locate(["jlcpcb", "qty"])).toEqual({ line: 22, col: 8 });
  });

  test("unknown keys point at the key; a missing outline at its block", () => {
    const text = readFileSync(join(FIXTURES, "valid.yaml"), "utf8").replace("  sizeMm: { w: 300, h: 40 }\n", "").replace("kind: board\n", "kind: board\nhp: 8\n");
    const issues = issuesOf(() => parseProject(text, "board.yaml"));
    expect(where(issues)).toEqual(["6:1 ", "14:1 pcb.sizeMm"]);
    expect(issues[0]!.message).toBe('Unrecognized key: "hp"');
  });
});

describe("parts", () => {
  test("loadAllParts keys by basename", () => {
    const parts = loadAllParts(join(FIXTURES, "parts"));
    expect([...parts.keys()]).toEqual(["cap-fixture-5x5.4", "conn-fixture", "led-fixture", "switch-fixture"]);
    expect(parts.get("conn-fixture")?.footprint).toBe("Connector_JST:JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical");
  });

  test('assembly "none" is a board feature: it parses without sourcing and refuses any', () => {
    const feature = (sourcing: Record<string, unknown>) => Part.safeParse({
      schema: 1, description: "Mounting hole", symbol: "Mechanical:MountingHole", footprint: "MountingHole:MountingHole_3.2mm_M3",
      assembly: "none", datasheet: null,
      values: { M3: { mpn: null, manufacturer: null, lcsc: null, jlcpcbTier: null, verified: null, ...sourcing } },
    });
    expect(feature({}).success).toBe(true);
    const bad = feature({ lcsc: "C123" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([
      'values.M3: assembly "none" is a board feature without a part: its sourcing fields stay null',
    ]);
  });

  test("loadAllParts reports every file's issues at once", () => {
    const issues = issuesOf(() => loadAllParts(join(FIXTURES, "parts-invalid")));
    expect(issues.map((i) => `${i.file.split("/").pop()}:${i.line}:${i.col} ${i.path.join(".")}`)).toEqual([
      "Bad_Name.yaml:1:1 ",
      "bad-part.yaml:8:1 ",
      "bad-part.yaml:13:11 values.10k.lcsc",
    ]);
  });

  test("part keys may contain dots (ap2112k-3.3), but not '..', a trailing '.' or capitals", () => {
    for (const key of ["ap2112k-3.3", "cap-fixture-5x5.4", "res-0603", "d1n4148", "a"]) expect(PART_KEY_RE.test(key)).toBe(true);
    for (const key of ["cap..x", "cap.", ".cap", "-cap", "Cap", "cap_x", "cap.-x"]) expect(PART_KEY_RE.test(key)).toBe(false);
  });

  test("issues under numeric YAML keys point at the offending line", () => {
    const text = [
      "schema: 1",
      "description: Resistor",
      "symbol: Device:R",
      "footprint: Resistor_SMD:R_0603_1608Metric",
      "assembly: smt",
      "datasheet: null",
      "values:",
      "  100:", // YAML reads this key as the number 100; zod reports the path segment "100"
      "    mpn: null",
      "    manufacturer: null",
      '    lcsc: "123"',
      "    jlcpcbTier: null",
      "    verified: null",
    ].join("\n");
    expect(where(issuesOf(() => parseYaml(Part, text, "r.yaml")))).toEqual(["11:11 values.100.lcsc"]);
  });

  test("missing parts directory is an empty DB", () => {
    expect(loadAllParts(join(FIXTURES, "does-not-exist")).size).toBe(0);
  });

  test("uses the Part schema from parts.ts", () => {
    const issues = issuesOf(() => parseYaml(Part, "schema: 1\n", "p.yaml"));
    expect(issues.map((i) => i.path.join("."))).toContain("footprint");
  });
});
