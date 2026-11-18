// Silkscreen drawings for scripted layouts: the moves (a shift, a quarter turn, the mirror for the back).
import { describe, expect, test } from "bun:test";
import { onBack, quarterTurn, translate } from "./art.ts";
import type { SilkArt } from "./flow.ts";

describe("moves", () => {
  const art: SilkArt[] = [
    { kind: "line", a: { x: 10, y: 5 }, b: { x: 14, y: 5 }, width: 0.2 },
    { kind: "ring", c: { x: 12, y: 3 }, r: 1, width: 0.15 },
    { kind: "poly", pts: [{ x: 10, y: 5 }, { x: 11, y: 4 }, { x: 12, y: 5 }] },
  ];

  test("a quarter turn: left to right becomes bottom to top, the tops of the letters point left", () => {
    const c = { x: 12, y: 5 };
    const [line, ring, poly] = quarterTurn(art, c);
    // The baseline's left end is 2 mm left of the centre: it ends up 2 mm below it.
    expect(line).toEqual({ kind: "line", a: { x: 12, y: 7 }, b: { x: 12, y: 3 }, width: 0.2 });
    // What stood 2 mm above the centre stands 2 mm left of it.
    expect(ring).toEqual({ kind: "ring", c: { x: 10, y: 5 }, r: 1, width: 0.15 });
    expect(poly).toMatchObject({ pts: [{ x: 12, y: 7 }, { x: 11, y: 6 }, { x: 12, y: 5 }] });
  });

  test("translate moves every point and keeps sizes and layers", () => {
    const moved = translate([...art, { kind: "dot", c: { x: 1, y: 1 }, r: 0.2, layer: "B.SilkS" }], { x: -10, y: 2 });
    expect(moved[0]).toEqual({ kind: "line", a: { x: 0, y: 7 }, b: { x: 4, y: 7 }, width: 0.2 });
    expect(moved[1]).toEqual({ kind: "ring", c: { x: 2, y: 5 }, r: 1, width: 0.15 });
    expect(moved[2]).toMatchObject({ pts: [{ x: 0, y: 7 }, { x: 1, y: 6 }, { x: 2, y: 7 }] });
    expect(moved[3]).toEqual({ kind: "dot", c: { x: -9, y: 3 }, r: 0.2, layer: "B.SilkS" });
  });

  test("onBack mirrors about a vertical line and moves everything to the back", () => {
    const back = onBack(art, 12);
    expect(back.every((a) => a.layer === "B.SilkS")).toBe(true);
    expect(back[0]).toMatchObject({ a: { x: 14, y: 5 }, b: { x: 10, y: 5 } });
    expect(back[1]).toMatchObject({ c: { x: 12, y: 3 }, r: 1 });
    expect(back[2]).toMatchObject({ pts: [{ x: 14, y: 5 }, { x: 13, y: 4 }, { x: 12, y: 5 }] });
  });
});
