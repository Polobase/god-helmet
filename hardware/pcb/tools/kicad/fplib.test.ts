import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { parse } from "../sexpr/sexpr.ts";
import { analyzeFootprint } from "./fplib.ts";

const vendored = (lib: string, name: string) => {
  const file = join(paths.libKicad, "footprints", `GHP_${lib}.pretty`, `${name}.kicad_mod`);
  return analyzeFootprint(parse(readFileSync(file, "utf8"), file));
};

describe("analyzeFootprint on vendored footprints", () => {
  test("SOIC-14: fourteen numbered SMD pads", () => {
    const f = vendored("Package_SO", "SOIC-14_3.9x8.7mm_P1.27mm");
    expect(f.name).toBe("SOIC-14_3.9x8.7mm_P1.27mm");
    expect([...f.numbers].sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 14 }, (_, i) => String(i + 1)));
    expect(f.pads.every((p) => p.kind === "smd")).toBe(true);
    expect(f.attr).toBe("smd");
  });

  test("the 3.5 mm jack: four contacts as pins, its two locating pegs (unnumbered NPTH) are pads but not pins", () => {
    const f = vendored("Connector_Audio", "Jack_3.5mm_KoreanHropartsElec_PJ-320D-4A_Horizontal");
    expect([...f.numbers].sort()).toEqual(["R1", "R2", "S", "T"]);
    expect(f.pads.filter((p) => p.number === "").map((p) => p.kind)).toEqual(["np_thru_hole", "np_thru_hole"]);
  });

  test("mounting lugs (MP) are pads but not pins", () => {
    const fp = '(footprint "Lugs" (attr through_hole) (pad "1" thru_hole circle (at 0 0) (size 1.8 1.8) (drill 1)) ' +
      '(pad "2" thru_hole circle (at 2.5 0) (size 1.8 1.8) (drill 1)) (pad "MP" thru_hole oval (at -3.5 4) (size 2.2 2.9) (drill oval 1.3 2.4)) ' +
      '(pad "MP" thru_hole oval (at 6 4) (size 2.2 2.9) (drill oval 1.3 2.4)))';
    const f = analyzeFootprint(parse(fp, "lugs"));
    expect([...f.numbers].sort()).toEqual(["1", "2"]);
    expect(f.pads.filter((p) => p.number === "MP").length).toBe(2);
    expect(f.attr).toBe("through_hole");
  });

  test("anything but a footprint is refused", () => {
    expect(() => analyzeFootprint(parse("(kicad_symbol_lib (version 1))", "x"))).toThrow(/not a footprint/);
  });
});
