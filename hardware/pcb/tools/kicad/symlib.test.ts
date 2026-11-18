import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomStr, child, children, parse, print } from "../sexpr/sexpr.ts";
import { analyzeSymbol, flatten, pinsOfUnit, readFlatSymbol, symbolsOf } from "./symlib.ts";

const FIX = join(import.meta.dir, "../../tests/fixtures/kicad-symbols-10.0.6");
const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const load = async (f: string, name: string) => symbolsOf(parse(await Bun.file(join(FIX, f)).text(), f)).get(name)!;

describe("flatten TL072 (extends LM2904)", async () => {
  const tl072 = flatten(await load("TL072.kicad_sym", "TL072"), await load("LM2904.kicad_sym", "LM2904"));

  test("no extends, renamed units", () => {
    expect(child(tl072, "extends")).toBeUndefined();
    expect(atomStr(tl072, 1)).toBe("TL072");
    expect(children(tl072, "symbol").map((s) => atomStr(s, 1))).toEqual(["TL072_1_1", "TL072_2_1", "TL072_3_1"]);
    expect(print(tl072)).not.toContain("LM2904_");
  });

  test("derived properties win", () => {
    const info = analyzeSymbol(tl072);
    expect(info.properties.get("Value")).toBe("TL072");
    expect(info.properties.get("Datasheet")).toBe("http://www.ti.com/lit/ds/symlink/tl071.pdf");
    expect(info.properties.get("Description")).toContain("JFET");
  });

  test("units and pins: 1 = 1,2,3; 2 = 5,6,7; 3 = 4,8 power_in", () => {
    const info = analyzeSymbol(tl072);
    expect(info.unitCount).toBe(3);
    const nums = (u: number) => pinsOfUnit(info, u).map((p) => p.number).sort();
    expect(nums(1)).toEqual(["1", "2", "3"]);
    expect(nums(2)).toEqual(["5", "6", "7"]);
    expect(nums(3)).toEqual(["4", "8"]);
    expect(pinsOfUnit(info, 3).every((p) => p.type === "power_in")).toBe(true);
    const out = info.pins.find((p) => p.number === "1")!;
    expect(out.type).toBe("output");
  });
});

test("readFlatSymbol resolves extends from a .kicad_symdir", () => {
  const stock = mkdtempSync(join(tmpdir(), "ghp-sym-"));
  temps.push(stock);
  const dir = join(stock, "Amplifier_Operational.kicad_symdir");
  mkdirSync(dir);
  copyFileSync(join(FIX, "TL072.kicad_sym"), join(dir, "TL072.kicad_sym"));
  copyFileSync(join(FIX, "LM2904.kicad_sym"), join(dir, "LM2904.kicad_sym"));
  const { node, files } = readFlatSymbol(stock, "Amplifier_Operational", "TL072");
  expect(files.map((f) => f.split("/").pop())).toEqual(["TL072.kicad_sym", "LM2904.kicad_sym"]);
  expect(analyzeSymbol(node).unitCount).toBe(3);
});
