import { describe, expect, test } from "bun:test";
import { DEFAULT_ERC_IGNORED, ErcReport, summarizeErc } from "./erc-report.ts";

const violation = (type: string, severity: "error" | "warning" | "exclusion", excluded?: boolean) => ({
  type, description: type, severity, items: [{ uuid: "u", description: "d", pos: { x: 0.001, y: 0.002 } }],
  ...(excluded !== undefined && { excluded }),
});

const report = (violations: ReturnType<typeof violation>[], ignored: string[]) => ErcReport.parse({
  kicad_version: "10.0.6", coordinate_units: "mm", included_severities: ["error", "warning", "exclusion"],
  sheets: [{ path: "/", violations }], source: "x.kicad_sch", ignored_checks: ignored.map((key) => ({ key })),
});

describe("summarizeErc", () => {
  test("counts active errors and warnings; excluded ones (either flag) count only as excluded", () => {
    const s = summarizeErc(report([
      violation("pin_not_connected", "error"),
      violation("label_dangling", "warning"),
      violation("pin_not_driven", "error", true),
      violation("lib_symbol_mismatch", "exclusion"),
    ], DEFAULT_ERC_IGNORED));
    expect(s).toMatchObject({ errors: 1, warnings: 1, excluded: 2, extraIgnored: [] });
    expect(s.types).toEqual(["label_dangling", "lib_symbol_mismatch", "pin_not_connected", "pin_not_driven"]);
  });

  test("KiCad's default ignores are fine; any other ignored rule is reported", () => {
    const s = summarizeErc(report([], [...DEFAULT_ERC_IGNORED, "pin_not_connected"]));
    expect(s.extraIgnored).toEqual(["pin_not_connected"]);
    expect(s.ignored).toContain("footprint_filter");
  });

  test("an empty report is clean", () => {
    expect(summarizeErc(report([], []))).toMatchObject({ errors: 0, warnings: 0, excluded: 0, types: [], extraIgnored: [] });
  });
});
