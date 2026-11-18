import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { children, head, isList, parse, type List, type Node } from "../sexpr/sexpr.ts";
import { GRID } from "../kicad/geometry.ts";
import { UUID_V5_RE } from "../kicad/uuid.ts";
import { paths } from "../lib/paths.ts";
import { loadAllParts } from "../module/load.ts";
import proof from "../../tests/fixtures/pipeline-proof/schematic.ts";
import { buildSchematic, BuildError, loadVendored } from "./build.ts";
import { computeConnectivity } from "./connectivity.ts";
import type { DesignInput } from "./dsl.ts";
import { generate } from "./generate.ts";

const ctx = { parts: loadAllParts(paths.parts), lib: loadVendored() };
const clone = (d: DesignInput): DesignInput => structuredClone(d);

function problemsOf(d: DesignInput): string[] {
  try {
    buildSchematic(d, ctx);
    return [];
  } catch (e) {
    if (e instanceof BuildError) return e.problems;
    throw e;
  }
}

describe("pipeline-proof builds", () => {
  const r = buildSchematic(proof, ctx);

  test("geometry connectivity equals the declared nets", () => {
    const conn = computeConnectivity(r.ir);
    expect(conn.problems).toEqual([]);
    for (const n of r.nets) expect(conn.nets.some((c) => c.pins.join() === n.pins.join())).toBe(true);
  });

  test("one PWR_FLAG per rail, power symbols per power pin", () => {
    expect(r.ir.units.filter((u) => u.kind === "flag").map((u) => u.uuidName.split("/").pop()).sort()).toEqual(["+12V", "-12V", "GND"]);
    expect(r.ir.units.filter((u) => u.kind === "power" && u.value === "GND")).toHaveLength(9);
  });

  test("all three TL072 units placed, junctions where 3+ items meet", () => {
    expect(r.ir.units.filter((u) => u.ref === "U1").map((u) => u.unit).sort()).toEqual([1, 2, 3]);
    expect(r.ir.junctions.length).toBe(6); // BUF, FB, AMP, three PWR_FLAG taps
  });
});

describe("emitted file", () => {
  // generate() is pure: the folder only names the files.
  const dir = join(paths.fixtures, "pipeline-proof", "kicad");
  const g = generate("pipeline-proof", proof, { dir });
  const text = g.files.get(g.schPath)!;
  const doc = parse(text);

  test("regeneration is byte-identical", () => {
    expect(generate("pipeline-proof", proof, { dir }).files.get(g.schPath)).toBe(text);
  });

  test("header is native KiCad 10", () => {
    expect(text.startsWith("(kicad_sch\n\t(version 20260306)\n\t(generator \"god-helmet-pcb\")")).toBe(true);
  });

  test("UUIDs are unique RFC 4122 v5", () => {
    const ids = [...text.matchAll(/\(uuid "([^"]+)"\)/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(UUID_V5_RE);
  });

  test("every wire, junction, label and symbol origin is on the 1.27 mm grid", () => {
    const offGrid: string[] = [];
    const check = (n: List, what: string) => {
      const xs = (n.items.slice(1).filter((a) => a.type === "num") as { value: number }[]).slice(0, 2);
      for (const v of xs) if (Math.round(v.value * 10000) % GRID !== 0) offGrid.push(`${what} ${v.value}`);
    };
    for (const top of doc.items) {
      if (!isList(top)) continue;
      const h = head(top);
      if (h === "wire") for (const xy of children(children(top, "pts")[0]!, "xy")) check(xy, "wire");
      if (h === "junction" || h === "label" || h === "no_connect" || h === "symbol") {
        const at = top.items.find((c: Node): c is List => head(c) === "at");
        if (at) check(at, h);
      }
    }
    expect(offGrid).toEqual([]);
  });
});

describe("builder rejects designs that would fail ERC", () => {
  test("missing power unit", () => {
    const d = clone(proof);
    delete (d.parts.amp!.units as Record<string, unknown>)["3"];
    expect(problemsOf(d).join("\n")).toContain("unit 3 of 3 is not placed");
  });

  test("unconnected pin", () => {
    const d = clone(proof);
    d.noConnect = [];
    expect(problemsOf(d).join("\n")).toContain("J3.3");
  });

  test("two outputs driving one net", () => {
    const d = clone(proof);
    d.nets.BUF!.pins.push("amp.7");
    d.nets.AMP!.pins = d.nets.AMP!.pins.filter((p) => p !== "amp.7");
    d.nets.AMP!.wires = [[[98, 40], "rOut.1"], [[98, 40], [98, 30], "rFb.1"]];
    expect(problemsOf(d).join("\n")).toMatch(/U1\.1 \(output\) and U1\.7 \(output\) are an ERC pin_to_pin error/);
  });

  test("pin in two nets, unknown pin, diagonal wire", () => {
    const d = clone(proof);
    d.nets.ATT!.pins.push("rTop.1");
    d.nets.OUT!.pins.push("rOut.9");
    d.nets.IN!.wires = [["inJack.T", [22, 42], "rTop.1"]];
    const p = problemsOf(d).join("\n");
    expect(p).toContain("rTop.1 is in nets IN and ATT");
    expect(p).toContain("has no pin 9");
  });

  test("diagonal wire", () => {
    const d = clone(proof);
    d.nets.IN!.wires = [["inJack.T", [22, 42], "rTop.1"]];
    expect(problemsOf(d).join("\n")).toContain("not horizontal or vertical");
  });

  test("net names differing only in case", () => {
    const d = clone(proof);
    d.nets.att = d.nets.ATT!;
    delete d.nets.ATT;
    d.nets.Att = { pins: ["amp.3"] };
    expect(problemsOf(d).join("\n")).toMatch(/differ only in case|in nets/);
  });

  test("overlapping symbols", () => {
    const d = clone(proof);
    d.parts.rOut!.at = [90, 40];
    expect(problemsOf(d).join("\n")).toContain("overlap");
  });

  test("an output driving power_in would need a PWR_FLAG, which conflicts", () => {
    const d = clone(proof);
    d.nets["+12V"]!.pins = d.nets["+12V"]!.pins.filter((p) => p !== "amp.8");
    d.nets.AMP!.pins.push("amp.8");
    expect(problemsOf(d).join("\n")).toMatch(/U1\.7 \(output\) and PWR_FLAG \(power_out\) are an ERC pin_to_pin error/);
  });

  test("duplicate no-connects", () => {
    const d = clone(proof);
    d.noConnect = ["outConn.3", "outConn.3"];
    expect(problemsOf(d).join("\n")).toContain("outConn.3 is listed twice in noConnect");
  });

  test("texts at the same position", () => {
    const d = clone(proof);
    d.text = [{ at: [14, 22], text: "a" }, { at: [14, 22], text: "b" }];
    expect(problemsOf(d).join("\n")).toContain("two text items at the same position");
  });

  test("pin-only units stacked on top of each other", () => {
    const d = clone(proof);
    d.parts.amp2 = { ref: "U2", part: "tl072-soic8", units: { 1: { at: [60, 70] }, 2: { at: [90, 70] }, 3: { at: [134, 110] } } };
    d.noConnect = [...(d.noConnect ?? []), ...["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => `amp2.${n}`)];
    expect(problemsOf(d).join("\n")).toContain("symbols U1/3 and U2/3 overlap");
  });
});

// Stacked pins: the USB-C receptacle's four GND pins (A1, A12, B1, B12) and four VBUS pins (A4, A9, B4, B9) sit at
// one point each in KiCad's symbol. They are one connection point: one power symbol each, and never two nets.
const stackedDesign = (vbusNet = "+5V"): DesignInput => ({
  project: "stacked-pins",
  sheet: { paper: "A4", title: "t", rev: "A", date: "2026-11-13" },
  parts: {
    j1: { ref: "J1", part: "usb-c-type-c-31-m-12", value: "TYPE-C-31-M-12", at: [60, 60] },
    r1: { ref: "R1", part: "res-0603", value: "5.1k", at: [120, 40], rot: 90 },
    r2: { ref: "R2", part: "res-0603", value: "5.1k", at: [120, 50], rot: 90 },
    r3: { ref: "R3", part: "res-0603", value: "10k", at: [120, 60], rot: 90 },
    r4: { ref: "R4", part: "res-0603", value: "10k", at: [120, 70], rot: 90 },
  },
  nets: {
    [vbusNet]: { pins: ["j1.A4", "j1.A9", "j1.B4", "j1.B9", ...(vbusNet === "+5V" ? [] : ["j1.A1"])], power: true },
    GND: { pins: [...(vbusNet === "+5V" ? ["j1.A1"] : []), "j1.A12", "j1.B1", "j1.B12", "j1.SH", "r1.2", "r2.2", "r3.2", "r4.2"], power: true },
    CC1: { pins: ["j1.A5", "r1.1"] },
    CC2: { pins: ["j1.B5", "r2.1"] },
    DP: { pins: ["j1.A6", "j1.B6", "r3.1"] },
    DN: { pins: ["j1.A7", "j1.B7", "r4.1"] },
  },
  noConnect: ["j1.A8", "j1.B8"],
});

test("stacked pins get one power symbol per point", () => {
  const r = buildSchematic(stackedDesign(), ctx);
  const gndAt = r.ir.units.filter((u) => u.kind === "power" && u.value === "GND").map((u) => `${u.at.x},${u.at.y}`);
  expect(new Set(gndAt).size).toBe(gndAt.length); // never two symbols on one spot
  expect(r.ir.units.filter((u) => u.kind === "power" && u.value === "+5V")).toHaveLength(1); // VBUS: one stacked point
  expect(computeConnectivity(r.ir).problems).toEqual([]);
});

test("stacked pins on different nets are refused", () => {
  // A1 (stacked with the GND pins A12, B1, B12) put on the VBUS net instead
  expect(problemsOf(stackedDesign("+12V")).join("\n")).toContain("are stacked at one point but on different nets");
});

// A wired island whose only long wire touches no pin still gets its label (review finding #4).
const islandDesign = (r3: { rot?: 0 | 90 | 180 | 270; mirror?: "x" | "y" } = {}): DesignInput => ({
  project: "island-label",
  sheet: { paper: "A4", title: "t", rev: "A", date: "2026-09-24" },
  parts: {
    r1: { ref: "R1", part: "res-0603", value: "10k", at: [30, 32], rot: 180 },
    r2: { ref: "R2", part: "res-0603", value: "10k", at: [60, 32], rot: 180 },
    r3: { ref: "R3", part: "res-0603", value: "10k", at: [90, 32], rot: 180, ...r3 },
  },
  nets: { X: { pins: ["r1.1", "r2.1", "r3.1"], wires: [["r1.1", [30, 36], [60, 36], "r2.1"]] } },
  noConnect: ["r1.2", "r2.2", "r3.2"],
});

test("label goes on the longest wire of the island, even one that touches no pin", () => {
  const r = buildSchematic(islandDesign(), ctx);
  expect(r.ir.labels.filter((l) => l.text === "X").length).toBe(2);
  expect(r.ir.labels.some((l) => l.at.y === 36 * GRID && l.at.x > 30 * GRID && l.at.x < 60 * GRID)).toBe(true);
});

// Sheet sizes: a part beyond A4 needs the larger sheet, and each sheet's title block stays clear.
test("the drawing area follows the paper: A4 to A0", () => {
  const at = (paper: "A4" | "A3" | "A2" | "A1" | "A0", x: number, y: number): DesignInput => ({
    ...islandDesign(), sheet: { paper, title: "t", rev: "A", date: "2026-09-24" },
    parts: { ...islandDesign().parts, r3: { ref: "R3", part: "res-0603", value: "10k", at: [x, y], rot: 180 } },
  });
  // (400, 240) grid units = (508, 305) mm: inside A2 (594 × 420 mm), outside A3 (420 × 297 mm).
  expect(buildSchematic(at("A2", 400, 240), ctx).ir.paper).toBe("A2");
  expect(() => buildSchematic(at("A3", 400, 240), ctx)).toThrow(/outside the drawing area or inside the title block/);
  expect(buildSchematic(at("A3", 300, 100), ctx).ir.paper).toBe("A3");
  expect(() => buildSchematic(at("A4", 300, 100), ctx)).toThrow(/outside the drawing area/);
  // A2's title block: the bottom-right 110 × 35 mm.
  expect(() => buildSchematic(at("A2", 440, 310), ctx)).toThrow(/inside the title block/);
  // (800, 560) grid units = (1016, 711) mm: inside A0 (1189 × 841 mm), outside A1 (841 × 594 mm).
  expect(buildSchematic(at("A0", 800, 560), ctx).ir.paper).toBe("A0");
  expect(() => buildSchematic(at("A1", 800, 560), ctx)).toThrow(/outside the drawing area/);
  expect(buildSchematic(at("A1", 600, 400), ctx).ir.paper).toBe("A1");
});

// eeschema's canonical form for rotation + mirror pairs (review finding #5).
test("rotation/mirror pairs are emitted in eeschema's canonical form", () => {
  const u = buildSchematic(islandDesign({ rot: 180, mirror: "x" }), ctx).ir.units.find((x) => x.ref === "R3")!;
  expect([u.rot, u.mirror]).toEqual([0, "y"]);
});

// Power symbols on neighbouring parallel pins would print their names over each other: the later one's stub grows.
test("power symbols on neighbouring pins are staggered, not printed over each other", () => {
  const d: DesignInput = {
    project: "power-stagger",
    sheet: { paper: "A4", title: "t", rev: "A", date: "2026-11-14" },
    parts: {
      r1: { ref: "R1", part: "res-0603", value: "10k", at: [30, 32] },
      r2: { ref: "R2", part: "res-0603", value: "10k", at: [34, 32] },
      r3: { ref: "R3", part: "res-0603", value: "10k", at: [60, 32] },
    },
    nets: {
      // the PWR_FLAGs (a longer stub of their own) on the far resistor
      "+12V": { pins: ["r1.1", "r2.1", "r3.1"], power: true, flagAt: "r3.1" },
      GND: { pins: ["r1.2", "r2.2", "r3.2"], power: true, flagAt: "r3.2" },
    },
  };
  const r = buildSchematic(d, ctx);
  const y = (net: string, pin: string) => r.ir.units.find((u) => u.kind === "power" && u.value === net && u.uuidName.endsWith(`/${pin}`))!.at.y;
  // R1 and R2 are 5.08 mm apart and "+12V" is wider than that: R2's symbol sits one step (5.08 mm) higher
  expect(y("+12V", "R1.1") - y("+12V", "R2.1")).toBe(4 * GRID);
  // "GND" (3 characters) fits in 5.08 mm: their ground symbols stay in one row
  expect(y("GND", "R1.2")).toBe(y("GND", "R2.2"));
  expect(computeConnectivity(r.ir).problems).toEqual([]);
});
