import { describe, expect, test } from "bun:test";
import { courtyardAt, courtyardOnBoard, courtyardRectsOnBoard, padPos, placeParts, type FootprintGeom } from "./place.ts";

// Pad positions KiCad 10.0.6 reported for a flipped SOIC-14 at (0, 0) (tools/pcb/kicad_pcb.py
// build, checked in flow.ts on every run): pad 1 (-2.475, -3.81) in the footprint.
const pad1 = { x: -2.475, y: -3.81 };

describe("padPos: where KiCad puts a pad", () => {
  test("top side: counter-clockwise rotation with y down", () => {
    expect(padPos(pad1, { x: 0, y: 0, rot: 0, side: "top" })).toEqual({ x: -2.475, y: -3.81 });
    expect(padPos(pad1, { x: 0, y: 0, rot: 90, side: "top" })).toEqual({ x: -3.81, y: 2.475 });
  });

  test("bottom side: flipped left-right, then the orientation set (KiCad: 180° − rot, mirrored)", () => {
    // Measured in KiCad: rot 90 → pad 1 at (+3.81, +2.475); rot 0 → (−2.475, +3.81).
    expect(padPos(pad1, { x: 0, y: 0, rot: 90, side: "bottom" })).toEqual({ x: 3.81, y: 2.475 });
    expect(padPos(pad1, { x: 0, y: 0, rot: 0, side: "bottom" })).toEqual({ x: -2.475, y: 3.81 });
    // SOT-23 pad 1 (−0.938, −0.95) at rot 180 on the bottom: (+0.938, −0.95).
    expect(padPos({ x: -0.938, y: -0.95 }, { x: 0, y: 0, rot: 180, side: "bottom" })).toEqual({ x: 0.938, y: -0.95 });
  });
});

describe("placeParts", () => {
  const res: FootprintGeom = {
    pads: [
      { number: "1", x: -0.8, y: 0, w: 0.8, h: 0.95, drill: 0, smd: true },
      { number: "2", x: 0.8, y: 0, w: 0.8, h: 0.95, drill: 0, smd: true },
    ],
    courtyard: { x0: -1.5, y0: -0.75, x1: 1.5, y1: 0.75 },
  };
  const tht: FootprintGeom = { pads: [{ number: "1", x: 0, y: 0, w: 1.8, h: 1.8, drill: 1, smd: false }], courtyard: { x0: -1, y0: -1, x1: 1, y1: 1 } };

  test("parts land next to what they connect to, never on each other or on through-hole pads", () => {
    const r = placeParts({
      outline: { x0: 0, y0: 0, x1: 20, y1: 20 },
      geom: { P1: tht, P2: tht, R1: res, R2: res },
      pads: { P1: { "1": "A" }, P2: { "1": "B" }, R1: { "1": "A", "2": "B" }, R2: { "1": "A", "2": "B" } },
      fixed: { P1: { x: 5, y: 10, rot: 0, side: "top" }, P2: { x: 15, y: 10, rot: 0, side: "top" } },
      place: ["R1", "R2"],
      side: "bottom",
    });
    expect(r.failed).toEqual([]);
    const a = courtyardAt(res, r.placements.R1!);
    const b = courtyardAt(res, r.placements.R2!);
    expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0).toBe(true);
    for (const at of [r.placements.R1!, r.placements.R2!]) {
      // Between the two pins it connects, clear of the pads (0.9 radius + 0.35).
      expect(at.x).toBeGreaterThan(5 + 1.25);
      expect(at.x).toBeLessThan(15 - 1.25);
    }
  });

  test("a part with no room is reported, not dropped silently", () => {
    const r = placeParts({ outline: { x0: 0, y0: 0, x1: 2, y1: 1 }, geom: { R1: res }, pads: {}, fixed: {}, place: ["R1"], side: "bottom" });
    expect(r.failed).toEqual(["R1"]);
  });

  test("a part in a region stays inside it, and a part on a plane's net is not pulled by that net", () => {
    const r = placeParts({
      outline: { x0: 0, y0: 0, x1: 30, y1: 20 },
      geom: { P1: tht, P2: tht, R1: res, R2: res },
      pads: { P1: { "1": "A" }, P2: { "1": "GND" }, R1: { "1": "A", "2": "B" }, R2: { "1": "GND", "2": "C" } },
      fixed: { P1: { x: 5, y: 10, rot: 0, side: "top" }, P2: { x: 25, y: 10, rot: 0, side: "top" } },
      place: ["R1", "R2"],
      side: "top",
      // R1 connects to P1 (x 5) but must stay in the right half.
      regions: [{ rect: { x0: 18, y0: 0, x1: 30, y1: 20 }, refs: ["R1"] }],
      freeNets: ["GND"],
    });
    expect(r.failed).toEqual([]);
    const a = courtyardAt(res, r.placements.R1!);
    expect(a.x0).toBeGreaterThanOrEqual(18);
    // As close to P1 as the region lets it be.
    expect(a.x0).toBeLessThan(18.5);
    // R2's only other net is free, so nothing pulls it towards P2: it takes the first free spot in scan order.
    expect(r.placements.R2!.x).toBeLessThan(10);
  });

  test("a part listed in two regions is refused", () => {
    expect(() =>
      placeParts({
        outline: { x0: 0, y0: 0, x1: 10, y1: 10 }, geom: { R1: res }, pads: {}, fixed: {}, place: ["R1"], side: "top",
        regions: [{ rect: { x0: 0, y0: 0, x1: 5, y1: 10 }, refs: ["R1"] }, { rect: { x0: 5, y0: 0, x1: 10, y1: 10 }, refs: ["R1"] }],
      }),
    ).toThrow(/two regions/);
  });

  test("a fixed part that hangs over the edge blocks only the board under its courtyard", () => {
    // A T-shaped courtyard like a radio module's: a wide antenna band (y -10...-4) and a narrow body (y -4...6).
    const t = [
      { x: -12, y: -10 }, { x: 12, y: -10 }, { x: 12, y: -4 }, { x: 4, y: -4 },
      { x: 4, y: 6 }, { x: -4, y: 6 }, { x: -4, y: -4 }, { x: -12, y: -4 },
    ];
    const mod: FootprintGeom = { pads: [], courtyard: { x0: -12, y0: -10, x1: 12, y1: 6 }, outlines: [t] };
    const board = { x0: 0, y0: 0, x1: 40, y1: 30 };
    // The board edge at the band's lower side: only the body is on the board.
    expect(courtyardOnBoard(mod, { x: 20, y: 4, rot: 0, side: "top" }, board)).toEqual({ x0: 16, y0: 0, x1: 24, y1: 10 });
    // The band partly on the board: the band and the body, not their bounding box.
    expect(courtyardRectsOnBoard(mod, { x: 20, y: 8, rot: 0, side: "top" }, board)).toEqual([
      { x0: 8, y0: 0, x1: 32, y1: 4 },
      { x0: 16, y0: 4, x1: 24, y1: 14 },
    ]);
    // Wholly on the board: the whole courtyard.
    expect(courtyardOnBoard(mod, { x: 20, y: 12, rot: 0, side: "top" }, board)).toEqual({ x0: 8, y0: 2, x1: 32, y1: 18 });
    // A part beside the body, under the band that hangs off the board, finds room there.
    const r = placeParts({
      outline: board, geom: { U1: mod, R1: res }, pads: { U1: {}, R1: {} },
      fixed: { U1: { x: 20, y: 4, rot: 0, side: "top" } }, place: ["R1"], side: "top",
      regions: [{ rect: { x0: 25, y0: 0, x1: 30, y1: 4 }, refs: ["R1"] }],
    });
    expect(r.failed).toEqual([]);
  });
});
