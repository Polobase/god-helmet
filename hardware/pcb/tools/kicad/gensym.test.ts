import { describe, expect, test } from "bun:test";
import { GENERATED_SYMBOLS, generateSymbol } from "./gensym.ts";
import { IU_PER_MM } from "./geometry.ts";
import { analyzeSymbol } from "./symlib.ts";

describe("generated symbols", () => {
  test("DAC81408: every pin of the data sheet's table once, on the 2.54 mm grid, none on another", () => {
    const def = GENERATED_SYMBOLS["Generated:DAC81408"]!;
    const info = analyzeSymbol(generateSymbol("DAC81408", def));
    expect(info.unitCount).toBe(1);
    // 40 pins and the thermal pad (41)
    expect(info.pins.map((p) => p.number).sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 41 }, (_, i) => String(i + 1)));
    const byNumber = new Map(info.pins.map((p) => [p.number, p]));
    expect(byNumber.get("5")!.name).toBe("OUT0");
    expect(byNumber.get("26")!.name).toBe("OUT7");
    expect(byNumber.get("19")!.name).toBe("~{RESET}");
    expect(byNumber.get("31")!.type).toBe("power_in");
    expect(byNumber.get("1")!.type).toBe("no_connect");
    // Schematic internal units (IU_PER_MM): every pin end on the 2.54 mm grid, and no two at one point.
    const grid = 2.54 * IU_PER_MM;
    for (const p of info.pins) {
      expect(Math.abs(p.at.x % grid)).toBe(0);
      expect(Math.abs(p.at.y % grid)).toBe(0);
    }
    const points = info.pins.map((p) => `${p.at.x},${p.at.y}`);
    expect(new Set(points).size).toBe(points.length);
    expect(info.properties.get("Footprint")).toBe(def.footprint);
  });

  test("a pin number twice is refused", () => {
    const def = GENERATED_SYMBOLS["Generated:DAC81408"]!;
    const bad = { ...def, pins: [...def.pins, { ...def.pins[0]! }] };
    expect(() => generateSymbol("X", bad)).toThrow(/pin 14 twice/);
  });
});
