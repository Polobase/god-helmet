import { describe, expect, test } from "bun:test";
import type { NetlistComponent } from "../kicad/netlist-xml.ts";
import type { Part } from "../module/parts.ts";
import { assemblyLines, bomCsv, BOM_HEADER } from "./bom.ts";
import { correctionFor, cplCsv, cplLines, describeDispute, disagreeing, loadCorrections, parsePos, type Correction, type Placement } from "./cpl.ts";
import { csv, parseCsv } from "./csv.ts";
import { boardCopperLayers, fabReadme, GERBER_LAYERS, gerberLayers, type ReadmeInput } from "./fab.ts";
import { placementPoint, readBoard } from "./placement.ts";

const src = (lcsc: string | null, verified = false, mpn: string | null = null) => ({
  mpn, manufacturer: null, lcsc, jlcpcbTier: null,
  verified: verified ? { source: "https://jlcpcb.com/parts", date: "2026-09-24" } : null,
});
const part = (assembly: Part["assembly"], values: Part["values"]): Part => ({
  schema: 1, description: "x", symbol: "Device:R", footprint: "Resistor_SMD:R_0603_1608Metric", assembly, datasheet: null, values,
});
const comp = (ref: string, value: string, partKey: string, fp: string, lcsc = "", props: Record<string, string> = {}, mpn = ""): NetlistComponent => ({
  ref, value, footprint: fp, fields: { PartKey: partKey, LCSC: lcsc, MPN: mpn }, properties: props, tstamps: [], sheetpath: { names: "/", tstamps: "/" },
});

describe("copper layers", () => {
  test("a 4-layer board's Gerbers add the inner copper; a 2-layer board's stay as they were", () => {
    expect(gerberLayers(2)).toBe(GERBER_LAYERS);
    expect(gerberLayers(4)).toEqual(["F.Cu", "In1.Cu", "In2.Cu", "B.Cu", "F.Paste", "B.Paste", "F.SilkS", "B.SilkS", "F.Mask", "B.Mask", "Edge.Cuts"]);
  });

  test("the board file's layer table tells how many copper layers it has", () => {
    const table = (rows: string[]) => `(kicad_pcb\n\t(layers\n${rows.map((r) => `\t\t${r}`).join("\n")}\n\t)\n\t(setup\n\t)\n)\n`;
    expect(boardCopperLayers(table(['(0 "F.Cu" signal "top_layer")', '(2 "B.Cu" signal "bottom_layer")', '(5 "F.SilkS" user "F.Silkscreen")']))).toBe(2);
    expect(boardCopperLayers(table(['(0 "F.Cu" signal)', '(4 "In1.Cu" power)', '(6 "In2.Cu" power)', '(2 "B.Cu" signal)', '(25 "Edge.Cuts" user)']))).toBe(4);
    expect(() => boardCopperLayers("(kicad_pcb)")).toThrow("no (layers …) table");
  });

  test("the README names the inner layers of a 4-layer board only", () => {
    const r: ReadmeInput = {
      prefix: "x-revA", draft: false, schSha: "a".repeat(64), gerberCount: 14, kicadVersion: "10.0.6", assembly: false, lines: [], unverified: [], consigned: [], disputed: [], hasModule: true,
      drc: { errors: 0, warnings: 0, excluded: 0, types: [], ignored: [], parity: true, unconnected: 0 },
    };
    expect(fabReadme(r)).toContain("(14 files: Gerbers, separate PTH/NPTH");
    expect(fabReadme({ ...r, copperLayers: 4 })).toContain("(14 files: Gerbers, 4 copper layers: F.Cu, In1.Cu, In2.Cu, B.Cu, separate PTH/NPTH");
  });
});

describe("csv", () => {
  test("quotes and round-trips", () => {
    const rows = [["a,b", 'q"x', "plain"], ["1", "", "3"]];
    expect(parseCsv(csv(rows))).toEqual(rows);
  });
});

describe("BOM", () => {
  const parts = new Map<string, Part>([
    ["res", part("smt", { "10k": src("C25804", true), "1k": src(null) })],
    ["conn", part("tht", { "XH-2P": src(null, true, "B2B-XH-A") })],
    ["dcdc", part("tht", { A0515S: src("C12345", true) })],
    ["heatsink", part("hand", { HS: src(null) })],
    ["hole", part("none", { M3: src(null) })],
  ]);
  const comps = [
    comp("R10", "10k", "res", "GHP_Resistor_SMD:R_0603_1608Metric", "C25804"),
    comp("R2", "10k", "res", "GHP_Resistor_SMD:R_0603_1608Metric", "C25804"),
    comp("R1", "1k", "res", "GHP_Resistor_SMD:R_0603_1608Metric"),
    comp("R3", "10k", "res", "GHP_Resistor_SMD:R_0603_1608Metric", "C25804", { dnp: "" }),
    comp("J1", "XH-2P", "conn", "GHP_Connector_JST:XH", "", {}, "B2B-XH-A"),
    comp("J2", "XH-2P", "conn", "GHP_Connector_JST:XH", "", {}, "OTHER"),
    comp("U9", "A0515S", "dcdc", "GHP_Converter_DCDC:NMA", "C12345"),
    comp("HS1", "HS", "heatsink", "GHP_X:Y"),
    comp("H1", "M3", "hole", "GHP_MountingHole:MountingHole_3.2mm_M3"),
  ];
  const refs = (tht: "self" | "jlcpcb" | "consign") => assemblyLines(comps, parts, { tht }).lines.map((l) => l.ref);

  test("selects placed parts: no DNP, no hand parts, no board features, THT unless the user solders it", () => {
    expect(refs("self")).toEqual(["R1", "R2", "R10"]);
    expect(refs("jlcpcb")).toEqual(["J1", "J2", "R1", "R2", "R10", "U9"]);
    expect(refs("consign")).toEqual(["J1", "J2", "R1", "R2", "R10", "U9"]);
  });

  test("verified: JLCPCB lines need the LCSC number, consigned lines the LCSC number or else the MPN", () => {
    const verified = (tht: "self" | "jlcpcb" | "consign") => assemblyLines(comps, parts, { tht }).lines.filter((l) => l.verified).map((l) => l.ref);
    expect(verified("self")).toEqual(["R2", "R10"]);
    expect(verified("jlcpcb")).toEqual(["R2", "R10", "U9"]); // the connectors have no LCSC number
    expect(verified("consign")).toEqual(["J1", "R2", "R10", "U9"]); // J2's MPN differs from the parts DB
    const consigned = assemblyLines(comps, parts, { tht: "consign" }).lines.filter((l) => l.consigned).map((l) => l.ref);
    expect(consigned).toEqual(["J1", "J2", "U9"]);
  });

  test("a part's own CPL rotation travels with its lines", () => {
    const own = new Map<string, Part>([...parts, ["hdr", part("tht", { "1x04 2.54": { ...src("C2691448", true), cplRotation: 270 } })]]);
    const { lines } = assemblyLines([...comps, comp("J9", "1x04 2.54", "hdr", "GHP_Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical", "C2691448")], own, { tht: "jlcpcb" });
    expect(lines.find((l) => l.ref === "J9")?.cplRotation).toBe(270);
    expect(lines.filter((l) => l.ref !== "J9").every((l) => l.cplRotation === undefined)).toBe(true);
  });

  test("groups by value/footprint/part number and lists every designator", () => {
    expect(parseCsv(bomCsv(assemblyLines(comps, parts, { tht: "self" }).lines))).toEqual([
      BOM_HEADER,
      ["1k", "R1", "R_0603_1608Metric", ""],
      ["10k", "R2,R10", "R_0603_1608Metric", "C25804"],
    ]);
  });

  test("the part-number cell falls back to the MPN when there is no LCSC number, like the Fabrication Toolkit", () => {
    const conns = parseCsv(bomCsv(assemblyLines(comps, parts, { tht: "consign" }).lines)).filter((r) => r[0] === "XH-2P");
    expect(conns.map((r) => [r[1], r[3]])).toEqual([["J1", "B2B-XH-A"], ["J2", "OTHER"]]);
    // The cell is what JLCPCB sees, so lines that differ only in the MPN behind an LCSC number share a row.
    const same = [comp("R1", "10k", "res", "L:R", "C25804", {}, "A"), comp("R2", "10k", "res", "L:R", "C25804", {}, "B")];
    expect(parseCsv(bomCsv(assemblyLines(same, parts, { tht: "self" }).lines)).slice(1)).toEqual([["10k", "R1,R2", "R", "C25804"]]);
  });
});

describe("rotation table", () => {
  const table = loadCorrections();

  test("loads the Fabrication Toolkit table", () => {
    expect(table.length).toBe(51);
    expect(correctionFor("SOIC-8_3.9x4.9mm_P1.27mm", table)?.rot).toBe(270);
    expect(correctionFor("R_0603_1608Metric", table)).toBeUndefined();
  });

  test("detects the pattern listed with conflicting values (^VSSOP-8_: 180 and 270)", () => {
    const conflicting = table.filter((c) => c.conflicts.length).map((c) => [c.row, c.source, c.rot, c.conflicts]);
    expect(conflicting).toEqual([[49, "^VSSOP-8_", 180, [50]], [50, "^VSSOP-8_", 270, [49]]]);
  });

  test("first matching line wins, as in the plugin; the disagreeing lines are reported", () => {
    const name = "VSSOP-8_3.0x3.0mm_P0.65mm";
    const rule = correctionFor(name, table)!;
    expect([rule.row, rule.rot]).toEqual([49, 180]);
    expect(disagreeing(name, table, rule).map((c) => [c.row, c.rot])).toEqual([[50, 270], [51, 270]]);
    // Specific rows next to general ones with the same value are not disputes.
    expect(disagreeing("SOIC-8_3.9x4.9mm_P1.27mm", table, correctionFor("SOIC-8_3.9x4.9mm_P1.27mm", table)!)).toEqual([]);
  });

  test("the library nickname is tried only when no line matches the footprint name", () => {
    const rule = (row: number, source: string, rot: number): Correction => ({ row, source, pattern: new RegExp(source), rot, dx: 0, dy: 0, conflicts: [] });
    const t = [rule(2, "^Lib_A", 90), rule(3, "^Foo", 180)];
    expect(correctionFor("Foo_1", t, "Lib_A")?.row).toBe(3);
    expect(correctionFor("Bar_1", t, "Lib_A")?.row).toBe(2);
    expect(correctionFor("Bar_1", t, "Lib_B")).toBeUndefined();
  });
});

describe("CPL", () => {
  const table = loadCorrections();
  const at = (ref: string, name: string, side: "top" | "bottom", rot: number, x = 10, y = -20): Placement => ({ ref, name, lib: "GHP_X", side, x, y, rot });

  test("bottom side: mirror first (180 − rot), then add the correction, like FT and kicad-jlcpcb-tools", () => {
    const lines = cplLines([
      at("U1", "SOIC-8_3.9x4.9mm_P1.27mm", "bottom", 0),
      at("U2", "SOIC-8_3.9x4.9mm_P1.27mm", "bottom", 90),
      at("U3", "SOIC-8_3.9x4.9mm_P1.27mm", "top", 0),
      at("U4", "QFN-16-1EP_3x3mm_P0.5mm", "bottom", 0),
      at("U5", "SOIC-8_3.9x4.9mm_P1.27mm", "bottom", -90),
      at("C1", "CP_Elec_5x5.4", "top", 90),
      at("R1", "R_0603_1608Metric", "bottom", 0),
    ], table);
    expect(Object.fromEntries(lines.map((l) => [l.ref, `${l.layer} ${l.rotation}`]))).toEqual({
      U1: "B 90", U2: "B 0", U3: "T 270", U4: "B 270", U5: "B 180", C1: "T 270", R1: "B 180",
    });
  });

  test("a part's own correction replaces the table's rotation, on both sides like a table line", () => {
    const lines = cplLines([
      { ...at("J1", "IDC-Header_2x08_P2.54mm_Vertical", "top", 180), partRot: 270 },
      { ...at("J2", "IDC-Header_2x08_P2.54mm_Vertical", "top", 90), partRot: 270 },
      { ...at("J3", "IDC-Header_2x08_P2.54mm_Vertical", "bottom", 0), partRot: 270 },
      { ...at("U1", "SOIC-8_3.9x4.9mm_P1.27mm", "top", 0), partRot: 0 },
      at("J4", "IDC-Header_2x08_P2.54mm_Vertical", "top", 180),
    ], table);
    expect(Object.fromEntries(lines.map((l) => [l.ref, `${l.layer} ${l.rotation}`]))).toEqual({
      J1: "T 90", J2: "T 0", J3: "B 90", U1: "T 0", J4: "T 180",
    });
    expect(lines.find((l) => l.ref === "U1")).toMatchObject({ partRot: 0, disputed: [] });
    expect(lines.find((l) => l.ref === "J4")?.partRot).toBeUndefined();
  });

  test("CSV: mm units, T/B layers, natural designator order", () => {
    const text = cplCsv(cplLines([at("U10", "SOIC-8_3.9x4.9mm_P1.27mm", "top", 0, 50.5, -30.25), at("U2", "R_0603_1608Metric", "bottom", 0)], table));
    expect(parseCsv(text)).toEqual([
      ["Designator", "Mid X", "Mid Y", "Layer", "Rotation"],
      ["U2", "10.0000mm", "-20.0000mm", "B", "180"],
      ["U10", "50.5000mm", "-30.2500mm", "T", "270"],
    ]);
  });

  test("table offsets turn with the footprint (FT process.py lines 229-242)", () => {
    const t: Correction[] = [{ row: 2, source: "^X", pattern: /^X/, rot: 0, dx: 1, dy: 0, conflicts: [] }];
    const [top] = cplLines([at("A1", "X", "top", 90, 0, 0)], t);
    expect([top!.x, top!.y].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 1]);
    const [bottom] = cplLines([at("A1", "X", "bottom", 90, 0, 0)], t);
    expect([bottom!.x, bottom!.y].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 1]);
    const [bottom0] = cplLines([at("A1", "X", "bottom", 0, 0, 0)], [{ ...t[0]!, dx: 0, dy: 1 }]);
    expect([bottom0!.x, bottom0!.y].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, -1]);
  });

  test("rejects unexpected position headers", () => {
    expect(() => parsePos("Ref,Val\n")).toThrow(/header/);
  });
});

describe("placement point", () => {
  // Pads as pcbnew 10.0.6 saved them after flipping/rotating a three-pad through-hole jack; expected values
  // are the Fabrication Toolkit's _get_footprint_position run on that board in pcbnew 10.0.6.
  const board = `(kicad_pcb (version 20260206)
    (footprint "GHP_Connector_Audio:Jack" (layer "B.Cu") (at 95 25 30) (property "Reference" "J3") (attr through_hole)
      (pad "S" thru_hole rect (at 0 0 210) (size 1.93 1.83) (drill 1.22))
      (pad "T" thru_hole circle (at 0 -11.4 210) (size 2.13 2.13) (drill 1.43))
      (pad "TN" thru_hole circle (at 0 -3.1 210) (size 2.13 2.13) (drill 1.42)))
    (footprint "GHP_Connector_Audio:Jack" (layer "F.Cu") (at 65 25 60) (property "Reference" "J2") (attr through_hole)
      (pad "S" thru_hole rect (at 0 0 240) (size 1.93 1.83) (drill 1.22))
      (pad "T" thru_hole circle (at 0 11.4 240) (size 2.13 2.13) (drill 1.43 (offset 0.7 0.3)))
      (pad "TN" thru_hole oval (at 0 3.1 260) (size 3 2.13) (drill 1.42)))
    (footprint "GHP_Connector_Audio:Jack" (layer "F.Cu") (at 65 25 90) (property "Reference" "J4") (attr through_hole)
      (pad "S" thru_hole rect (at 0 0 270) (size 1.93 1.83) (drill 1.22))
      (pad "T" thru_hole circle (at 0 11.4 270) (size 2.13 2.13) (drill 1.43))
      (pad "TN" thru_hole circle (at 0 3.1 270) (size 2.13 2.13) (drill 1.42)))
    (footprint "GHP_Resistor_SMD:R_0603_1608Metric" (layer "F.Cu") (at 120 75 90) (property "Reference" "R1") (attr smd)
      (pad "1" smd roundrect (at -0.825 0 90) (size 0.8 0.95) (roundrect_rratio 0.25))
      (pad "2" smd roundrect (at 0.825 0 90) (size 0.8 0.95) (roundrect_rratio 0.25)))
    (footprint "X:Odd" (layer "F.Cu") (at 0 0) (property "Reference" "X1") (attr through_hole)
      (pad "1" thru_hole trapezoid (at 0 0) (size 1 1) (drill 0.5))))`;
  const parts = new Map(readBoard(board).map((p) => [p.ref, p]));
  const point = (ref: string) => placementPoint(parts.get(ref)!);

  test("THT parts: centre of the pad bounding box, footprint rotation and flip included", () => {
    expect(parts.get("J3")).toMatchObject({ side: "bottom", rot: 30, lib: "GHP_Connector_Audio", name: "Jack", type: "through_hole" });
    const cases: [string, number, number][] = [["J3", 92.1125, 19.998703], ["J2", 69.798584, 27.938608], ["J4", 70.775, 25]];
    for (const [ref, x, y] of cases) {
      const p = point(ref);
      expect(p.origin).toBe("pads");
      expect(p.x).toBeCloseTo(x, 5);
      expect(p.y).toBeCloseTo(y, 5);
    }
  });

  test("SMD parts keep their anchor", () => {
    expect(point("R1")).toEqual({ x: 120, y: 75, origin: "anchor" });
  });

  test("pad shapes without an exact bounding box are refused", () => {
    expect(() => point("X1")).toThrow(/trapezoid pad/);
  });
});

describe("README", () => {
  const base: ReadmeInput = {
    prefix: "m-revA", draft: false, schSha: "ab".repeat(32), gerberCount: 14, kicadVersion: "10.0.6",
    drc: { errors: 0, warnings: 0, excluded: 0, types: [], ignored: ["missing_courtyard"], parity: true, unconnected: 0 },
    assembly: true, lines: [], unverified: [], consigned: [], disputed: [], hasModule: true,
  };

  test("flags parts whose rotation correction the table contradicts", () => {
    const [line] = cplLines([{ ref: "U3", name: "VSSOP-8_3.0x3.0mm_P0.65mm", lib: "GHP_Package_SO", side: "top", x: 0, y: 0, rot: 0 }], loadCorrections());
    const md = fabReadme({ ...base, disputed: [describeDispute(line!)] });
    expect(md).toContain("## Check these lines");
    expect(md).toContain("- U3: 180° uses transformations.csv line 49 (`^VSSOP-8_` 180); line 50 (`^VSSOP-8_`) says 270, line 51 (`^VSSOP-8_3.0x3.0mm_P0.65mm`) says 270");
  });

  test("states whether schematic parity ran, and what an assembly-none package holds", () => {
    expect(fabReadme(base)).toContain("schematic parity checked");
    expect(fabReadme(base)).not.toContain("Rotation corrections from parts");
    expect(fabReadme({ ...base, partRotations: ["J1, J2 +270°"] })).toContain("- Rotation corrections from parts/*.yaml (JLCPCB's footprint for the part is turned against KiCad's): J1, J2 +270°.");
    expect(fabReadme({ ...base, draft: true, drc: { ...base.drc, parity: false } })).toContain("schematic parity **NOT checked**");
    const bare = fabReadme({ ...base, assembly: false });
    expect(bare).toContain("Gerbers and drill only, no BOM or CPL");
    expect(bare).not.toContain("BOM + CPL");
  });
});
