// Derived footprints: the vendored files and their provenance in lib/kicad/SOURCES.json must match the
// recorded derivations (the reason text is the provenance a reviewer reads).
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { atomNum, atomStr, child, children, parse, type List } from "../sexpr/sexpr.ts";
import { DERIVED_FOOTPRINTS } from "./derived.ts";

const sources = JSON.parse(readFileSync(join(paths.libKicad, "SOURCES.json"), "utf8")) as {
  footprints: Record<string, { from: string; sha256: string; derived?: string }>;
};

describe("DERIVED_FOOTPRINTS", () => {
  for (const [id, d] of Object.entries(DERIVED_FOOTPRINTS)) {
    test(id, () => {
      const [lib, name] = id.split(":") as [string, string];
      const [baseLib, baseName] = d.base.split(":") as [string, string];
      const src = sources.footprints[id];
      expect(src).toBeDefined();
      expect(src?.derived).toBe(d.why);
      expect(src?.from).toBe(`${baseLib}.pretty/${baseName}.kicad_mod`);
      const file = join(paths.libKicad, "footprints", `GHP_${lib}.pretty`, `${name}.kicad_mod`);
      expect(existsSync(file)).toBe(true);
      const text = readFileSync(file, "utf8");
      expect(text).toContain(`(footprint "${name}"`);
      expect(text).toContain(`derived from ${baseName}`);
    });
  }

  test("every derived entry in SOURCES.json is still in the table", () => {
    const recorded = Object.entries(sources.footprints).filter(([, s]) => s.derived !== undefined).map(([k]) => k).sort();
    expect(recorded).toEqual(Object.keys(DERIVED_FOOTPRINTS).sort());
  });
});

describe("the Kangnex WJ128V-5.0-04P terminal block follows its drawing", () => {
  const file = join(paths.libKicad, "footprints", "GHP_TerminalBlock.pretty", "TerminalBlock_Kangnex_WJ128V-5.0-04P_1x04_P5.00mm_Horizontal.kicad_mod");
  const fp = parse(readFileSync(file, "utf8"), file);
  const layerOf = (n: List) => atomStr(child(n, "layer"), 1);
  const point = (n: List | undefined) => [atomNum(n, 1), atomNum(n, 2)];

  test("four poles at 5.00 mm with 1.5 mm holes in 2.8 mm pads", () => {
    const pads = children(fp, "pad").map((p) => [atomStr(p, 1), ...point(child(p, "at")), atomNum(child(p, "size"), 1), atomNum(child(p, "drill"), 1)]);
    expect(pads).toEqual([["1", 0, 0, 2.8, 1.5], ["2", 5, 0, 2.8, 1.5], ["3", 10, 0, 2.8, 1.5], ["4", 15, 0, 2.8, 1.5]]);
  });

  test("the body is 20 x 10.28 mm: 4.9 mm behind the pin row, 5.38 mm in front of it (the wire entry, +y)", () => {
    const ends = children(fp, "fp_line").filter((l) => layerOf(l) === "F.Fab").flatMap((l) => [point(child(l, "start")), point(child(l, "end"))]);
    const [xs, ys] = [ends.map((p) => p[0]!), ends.map((p) => p[1]!)];
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([-2.5, 17.5]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([-4.9, 5.38]);
  });

  test("the courtyard keeps 0.5 mm from the body and covers the 0.6 mm lug at pin 1's end", () => {
    const courtyard = children(fp, "fp_rect").filter((r) => layerOf(r) === "F.CrtYd");
    expect(courtyard.map((r) => [point(child(r, "start")), point(child(r, "end"))])).toEqual([[[-3.6, -5.41], [18, 5.88]]]);
  });
});
