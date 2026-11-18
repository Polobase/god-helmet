// The ERC gate is the user's rule "0 errors, 0 warnings, no exclusions, no rules switched to ignore"
// (docs/schematic-as-code.md §4). These tests pin it without KiCad; tests/kicad/pipeline.test.ts runs it on real ERC output.
import { describe, expect, test } from "bun:test";
import { ercGateProblems, type ErcOutcome } from "./gates.ts";

const clean: ErcOutcome = {
  errors: 0, warnings: 0, excluded: 0, types: [], ignored: ["footprint_filter"], extraIgnored: [],
  kicadVersion: "10.0.6", jsonPath: "erc.json", rptPath: "erc.rpt",
};

describe("ercGateProblems", () => {
  test("0/0 with KiCad's default ignores passes", () => {
    expect(ercGateProblems(clean)).toEqual([]);
  });

  test("any error or warning fails, naming the types", () => {
    expect(ercGateProblems({ ...clean, warnings: 1, types: ["pin_not_connected"] })).toEqual(["0 errors, 1 warnings (pin_not_connected)"]);
    expect(ercGateProblems({ ...clean, errors: 2, types: ["power_pin_not_driven"] })).toEqual(["2 errors, 0 warnings (power_pin_not_driven)"]);
  });

  test("an exclusion fails even when nothing else is reported", () => {
    expect(ercGateProblems({ ...clean, excluded: 1 })[0]).toContain("exclusions are not allowed");
  });

  test("a rule switched to ignore beyond KiCad's defaults fails", () => {
    expect(ercGateProblems({ ...clean, extraIgnored: ["pin_not_connected"] })[0]).toContain('switched to "ignore"');
  });

  test("every reason is reported at once", () => {
    expect(ercGateProblems({ ...clean, errors: 1, types: ["x"], excluded: 1, extraIgnored: ["y"] })).toHaveLength(3);
  });
});
