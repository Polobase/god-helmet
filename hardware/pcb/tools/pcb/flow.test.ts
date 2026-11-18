// The scripted-layout half of the PCB flow that needs no KiCad: the copper job handed to kicad_pcb.py,
// the sheet size, and the per-board rule overrides. KiCad's side is tests/kicad/pcb-python.test.ts.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JLCPCB } from "../module/schema.ts";
import { ATTEMPT_VIA_COSTS, boardNetName, copperJob, paperFor, PCB_RULES, PCB_RULES_4, PLANE_VIA, planesJob, routerArgs, withStackup, writeProjectRules, type PcbSpec } from "./flow.ts";

const base: PcbSpec = {
  outline: { x0: 0, y0: 0, x1: 100, y1: 40 },
  offset: { x: 50, y: 60 },
  smdSide: "top",
  fixed: {},
  netClasses: [{ name: "Default", track: 0.25, clearance: 0.2, via: 0.6, drill: 0.3, nets: [] }],
  pour: { clearance: 0.3, minWidth: 0.25, edgeClearance: 0.5 },
};
const NETS = ["GND", "+12V", "/+12V_IN"];
const REFS = ["J1", "L1"];

describe("copperJob", () => {
  const spec: PcbSpec = {
    ...base,
    route: "scripted",
    solidPads: ["L1"],
    copper: {
      zones: [
        { net: "GND", layer: "B.Cu", shape: { x0: 1, y0: 1, x1: 99, y1: 20 } },
        { net: "+12V", layer: "B.Cu", shape: [{ x: 1, y: 21 }, { x: 99, y: 21 }, { x: 50, y: 39 }], priority: 2, pads: "solid", clearance: 0.4, minWidth: 0.3 },
      ],
      tracks: [{ net: "/+12V_IN", layer: "F.Cu", width: 2, points: [{ x: 10, y: 5 }, { x: 20, y: 5 }, { x: 20, y: 9 }] }],
      vias: [{ net: "GND", at: { x: 30, y: 10 }, diameter: 0.8, drill: 0.4 }],
      keepouts: [{ shape: { x0: 40, y0: 0, x1: 46, y1: 6 }, layers: ["F.Cu", "B.Cu"] }],
    },
    silk: [{ text: "-12V", at: { x: 5, y: 35 }, size: 1.2, rot: 90 }, { text: "GND", at: { x: 9, y: 35 }, size: 1.2, layer: "B.SilkS" }],
    art: [
      { kind: "line", a: { x: 1, y: 2 }, b: { x: 3, y: 2 }, width: 0.2 },
      { kind: "ring", c: { x: 10, y: 10 }, r: 2, width: 0.15, layer: "B.SilkS" },
      { kind: "dot", c: { x: 10, y: 10 }, r: 0.2 },
      { kind: "poly", pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }], layer: "B.SilkS" },
    ],
  };

  test("shapes become corner points in board coordinates; options pass through only when set", () => {
    const j = copperJob(spec, NETS, REFS);
    expect(j.solidPads).toEqual(["L1"]);
    expect(j.copper.zones).toEqual([
      { net: "GND", layer: "B.Cu", points: [[51, 61], [149, 61], [149, 80], [51, 80]] },
      { net: "+12V", layer: "B.Cu", points: [[51, 81], [149, 81], [100, 99]], priority: 2, pads: "solid", clearance: 0.4, minWidth: 0.3 },
    ]);
    expect(j.copper.tracks).toEqual([{ net: "/+12V_IN", layer: "F.Cu", width: 2, points: [[60, 65], [70, 65], [70, 69]] }]);
    expect(j.copper.vias).toEqual([{ net: "GND", x: 80, y: 70, diameter: 0.8, drill: 0.4 }]);
    expect(j.copper.keepouts).toEqual([{ layers: ["F.Cu", "B.Cu"], points: [[90, 60], [96, 60], [96, 66], [90, 66]] }]);
    expect(j.silk).toEqual([{ text: "-12V", x: 55, y: 95, size: 1.2, rot: 90 }, { text: "GND", x: 59, y: 95, size: 1.2, layer: "B.SilkS" }]);
    expect(j.art).toEqual([
      { kind: "line", a: [51, 62], b: [53, 62], width: 0.2 },
      { kind: "ring", layer: "B.SilkS", c: [60, 70], r: 2, width: 0.15 },
      { kind: "dot", c: [60, 70], r: 0.2 },
      { kind: "poly", layer: "B.SilkS", points: [[50, 60], [52, 60], [51, 61]] },
    ]);
  });

  test("refuses print that JLCPCB cannot make: text under 1 mm, lines and dots under 0.15 mm", () => {
    const withSilk = (size: number): PcbSpec => ({ ...spec, silk: [{ text: "CV", at: { x: 5, y: 5 }, size }] });
    expect(() => copperJob(withSilk(0.8), NETS, REFS)).toThrow('silkscreen text "CV" is 0.8 mm high; JLCPCB prints from 1 mm');
    expect(copperJob(withSilk(1), NETS, REFS).silk).toHaveLength(1);
    const withArt = (a: NonNullable<PcbSpec["art"]>[number]): PcbSpec => ({ ...spec, art: [a] });
    expect(() => copperJob(withArt({ kind: "line", a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, width: 0.1 }), NETS, REFS)).toThrow("a silkscreen line is 0.1 mm wide; JLCPCB prints from 0.15 mm");
    expect(() => copperJob(withArt({ kind: "ring", c: { x: 0, y: 0 }, r: 2, width: 0.12 }), NETS, REFS)).toThrow("a silkscreen ring is 0.12 mm wide");
    expect(() => copperJob(withArt({ kind: "dot", c: { x: 0, y: 0 }, r: 0.05 }), NETS, REFS)).toThrow("a silkscreen dot is 0.1 mm wide");
    expect(() => copperJob(withArt({ kind: "poly", pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }), NETS, REFS)).toThrow("a silkscreen polygon needs at least 3 points");
  });

  test("refuses nets and parts that are not in the netlist, and degenerate shapes", () => {
    const zone = (net: string): PcbSpec => ({ ...spec, copper: { zones: [{ net, layer: "F.Cu", shape: base.outline }] } });
    // A labelled net carries KiCad's "/" prefix: the bare name is the usual mistake.
    expect(() => copperJob(zone("+12V_IN"), NETS, REFS)).toThrow('a zone on net "+12V_IN", which is not in the netlist (a labelled net is named "/NAME")');
    expect(() => copperJob({ ...spec, solidPads: ["L9"] }, NETS, REFS)).toThrow("solidPads names L9, which is not in the netlist");
    // One pad of a part is "REF.PAD": the part is checked here, the pad by kicad_pcb.py on the board.
    expect(copperJob({ ...spec, solidPads: ["L1", "J1.9"] }, NETS, REFS).solidPads).toEqual(["L1", "J1.9"]);
    expect(() => copperJob({ ...spec, solidPads: ["J9.1"] }, NETS, REFS)).toThrow("solidPads names J9, which is not in the netlist");
    expect(() => copperJob({ ...spec, copper: { zones: [], tracks: [{ net: "GND", layer: "F.Cu", width: 1, points: [{ x: 1, y: 1 }] }] } }, NETS, REFS)).toThrow("needs at least 2 points");
    expect(() => copperJob({ ...spec, copper: { zones: [{ net: "GND", layer: "F.Cu", shape: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] } }, NETS, REFS)).toThrow("at least 3 points");
    const { copper: _copper, ...noCopper } = spec;
    expect(() => copperJob(noCopper, NETS, REFS)).toThrow('route "scripted" needs `copper`');
  });
});

describe("withStackup", () => {
  const board = "(kicad_pcb\n\t(general\n\t\t(thickness 1.6)\n\t)\n\t(setup\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n";

  test("a green board stays as KiCad wrote it", () => {
    expect(withStackup(board, { mask: "green", thicknessMm: 1.6 })).toBe(board);
  });

  test("a black board gets a stackup at the top of its setup block: black mask, white print, the board's thickness", () => {
    const out = withStackup(board, { mask: "black", thicknessMm: 1.6 });
    expect(out.startsWith('(kicad_pcb\n\t(general\n\t\t(thickness 1.6)\n\t)\n\t(setup\n\t\t(stackup\n\t\t\t(layer "F.SilkS"\n\t\t\t\t(type "Top Silk Screen")\n\t\t\t\t(color "White")\n\t\t\t)\n')).toBe(true);
    expect(out.endsWith('\t\t\t(copper_finish "HAL lead-free")\n\t\t\t(dielectric_constraints no)\n\t\t)\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n')).toBe(true);
    expect(out.match(/\(color "Black"\)/g)).toHaveLength(2);
    expect(out.match(/\(color "White"\)/g)).toHaveLength(2);
    // 1.6 mm less two copper layers of 35 µm and two masks of 10 µm.
    expect(out).toContain('(layer "dielectric 1"\n\t\t\t\t(type "core")\n\t\t\t\t(thickness 1.51)');
    // 2 oz copper is 70 µm a side.
    const thick = withStackup(board, { mask: "black", thicknessMm: 1.6, copperOz: 2 });
    expect(thick).toContain('(layer "F.Cu"\n\t\t\t\t(type "copper")\n\t\t\t\t(thickness 0.07)');
    expect(thick).toContain("(thickness 1.44)");
  });

  test("refuses a board that has a stackup already, or no setup block", () => {
    const out = withStackup(board, { mask: "black", thicknessMm: 1.6 });
    expect(() => withStackup(out, { mask: "black", thicknessMm: 1.6 })).toThrow("the board already has a stackup");
    expect(() => withStackup("(kicad_pcb)", { mask: "black", thicknessMm: 1.6 })).toThrow("no (setup …) block");
  });
});

describe("4-layer boards", () => {
  const board4 = '(kicad_pcb\n\t(layers\n\t\t(0 "F.Cu" signal)\n\t\t(4 "In1.Cu" power)\n\t\t(6 "In2.Cu" power)\n\t\t(2 "B.Cu" signal)\n\t)\n\t(setup\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n';
  const layersOf = (text: string) =>
    [...text.matchAll(/\(layer "([^"]+)"\n\t\t\t\t\(type "([^"]+)"\)(?:\n\t\t\t\t\(color "[^"]+"\))?(?:\n\t\t\t\t\(thickness ([\d.]+)\))?/g)].map((m) => `${m[1]} ${m[2]}${m[3] ? ` ${m[3]}` : ""}`);

  test("the stackup is JLCPCB's JLC04161H-7628, on a green board too", () => {
    const out = withStackup(board4, { mask: "green", thicknessMm: 1.6, layers: 4 });
    expect(layersOf(out)).toEqual([
      "F.SilkS Top Silk Screen", "F.Paste Top Solder Paste", "F.Mask Top Solder Mask 0.01",
      "F.Cu copper 0.035", "dielectric 1 prepreg 0.2104", "In1.Cu copper 0.0152", "dielectric 2 core 1.065",
      "In2.Cu copper 0.0152", "dielectric 3 prepreg 0.2104", "B.Cu copper 0.035",
      "B.Mask Bottom Solder Mask 0.01", "B.Paste Bottom Solder Paste", "B.SilkS Bottom Silk Screen",
    ]);
    expect(out.match(/\(color "Green"\)/g)).toHaveLength(2);
    expect(withStackup(board4, { mask: "black", thicknessMm: 1.6, layers: 4 }).match(/\(color "Black"\)/g)).toHaveLength(2);
    // The copper and dielectrics add up to the 1.6 mm option within JLCPCB's ±10 % thickness tolerance.
    const s = JLCPCB.stackup4;
    const sum = 2 * s.copperMm.outer + 2 * s.prepreg.mm + 2 * s.copperMm.inner + s.coreMm;
    expect(Math.abs(sum - s.thicknessMm) / s.thicknessMm).toBeLessThan(0.1);
  });

  test("refuses a thickness or copper the stackup does not have, a board without inner layers, a second stackup", () => {
    expect(() => withStackup(board4, { mask: "green", thicknessMm: 1.2, layers: 4 })).toThrow(/JLC04161H-7628: 1.6 mm and 1 oz/);
    expect(() => withStackup(board4, { mask: "green", thicknessMm: 1.6, copperOz: 2, layers: 4 })).toThrow(/1 oz outer copper/);
    const twoLayer = "(kicad_pcb\n\t(setup\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n";
    expect(() => withStackup(twoLayer, { mask: "green", thicknessMm: 1.6, layers: 4 })).toThrow("no inner copper layers");
    const once = withStackup(board4, { mask: "green", thicknessMm: 1.6, layers: 4 });
    expect(() => withStackup(once, { mask: "green", thicknessMm: 1.6, layers: 4 })).toThrow("already has a stackup");
  });

  test("rules: the inner layers' hole clearance; everything else as on 2 layers", () => {
    expect(PCB_RULES_4).toEqual({ ...PCB_RULES, min_hole_clearance: 0.35 });
    const dir = mkdtempSync(join(tmpdir(), "pcb-rules4-"));
    try {
      const pro = join(dir, "x.kicad_pro");
      writeFileSync(pro, JSON.stringify({}));
      writeProjectRules(pro, base, 4);
      expect(JSON.parse(readFileSync(pro, "utf8")).board.design_settings.rules.min_hole_clearance).toBe(0.35);
      writeProjectRules(pro, base);
      expect(JSON.parse(readFileSync(pro, "utf8")).board.design_settings.rules.min_hole_clearance).toBe(PCB_RULES.min_hole_clearance);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("planesJob: inner planes over the whole board by default, plane vias only when there are planes", () => {
    const spec: PcbSpec = {
      ...base,
      planes: [{ net: "GND", layer: "In1.Cu" }, { net: "+12V", layer: "In2.Cu", shape: { x0: 10, y0: 10, x1: 20, y1: 20 }, priority: 1 }],
      planeVia: { diameter: 0.5 },
    };
    const job = planesJob(spec, NETS, 4);
    expect(job.planes).toEqual([
      { net: "GND", layer: "In1.Cu", points: [[50.5, 60.5], [149.5, 60.5], [149.5, 99.5], [50.5, 99.5]] },
      { net: "+12V", layer: "In2.Cu", points: [[60, 70], [70, 70], [70, 80], [60, 80]], priority: 1 },
    ]);
    expect(job.planeVia).toEqual({ ...PLANE_VIA, diameter: 0.5 });
    expect("pours" in job).toBe(false);
    expect(planesJob(base, NETS, 2)).toEqual({ planes: [] });
    // Pours replace the default GND pours, on any layer the board has.
    const pours = planesJob({ ...base, pours: [{ net: "GND", layer: "F.Cu", shape: { x0: 0, y0: 0, x1: 50, y1: 40 } }] }, NETS, 2);
    expect(pours.pours).toEqual([{ net: "GND", layer: "F.Cu", points: [[50, 60], [100, 60], [100, 100], [50, 100]] }]);
  });

  test("planesJob refuses planes on a 2-layer board, on an outer layer, on an unknown net, and a broken via", () => {
    expect(() => planesJob({ ...base, planes: [{ net: "GND", layer: "In1.Cu" }] }, NETS, 2)).toThrow(/a plane on In1.Cu, but the board has 2 copper layers/);
    expect(() => planesJob({ ...base, planes: [{ net: "GND", layer: "B.Cu" }] }, NETS, 4)).toThrow(/planes go on In1.Cu or In2.Cu/);
    expect(() => planesJob({ ...base, planes: [{ net: "NOPE", layer: "In1.Cu" }] }, NETS, 4)).toThrow(/a plane on net "NOPE"/);
    expect(() => planesJob({ ...base, pours: [{ net: "GND", layer: "In2.Cu" }] }, NETS, 2)).toThrow(/a pour on In2.Cu, but the board has 2 copper layers/);
    expect(() => planesJob({ ...base, planes: [{ net: "GND", layer: "In1.Cu" }], planeVia: { drill: 0.6 } }, NETS, 4)).toThrow(/diameter > drill/);
    expect(() => planesJob({ ...base, planeViaFirst: { U1: "inward" } }, NETS, 4)).toThrow(/planeViaFirst needs planes/);
    expect(() => planesJob({ ...base, planes: [{ net: "GND", layer: "In1.Cu" }], planeViaFirst: { U1: "up" as "inward" } }, NETS, 4)).toThrow(/use "inward" or "diagonal"/);
  });

  test("routerArgs: the first attempt routes with Freerouting's defaults, the next ones price a via differently", () => {
    expect(routerArgs(1)).toEqual([]);
    expect(routerArgs(2)).toEqual(["--router.scoring.via_costs=35"]);
    expect(routerArgs(3)).toEqual(["--router.scoring.via_costs=70"]);
    expect(routerArgs(ATTEMPT_VIA_COSTS.length + 1)).toEqual([]);
  });

  test("planesJob: parts whose plane vias are tried under their body or at 45° first", () => {
    const job = planesJob({ ...base, planes: [{ net: "GND", layer: "In1.Cu" }], planeViaFirst: { U1: "inward", U2: "diagonal" } }, NETS, 4);
    expect(job.planeViaFirst).toEqual({ U1: "inward", U2: "diagonal" });
    expect("planeViaFirst" in planesJob({ ...base, planes: [{ net: "GND", layer: "In1.Cu" }] }, NETS, 4)).toBe(false);
  });

  test("planesJob: route keep-outs and inner layers given to the router", () => {
    const job = planesJob({
      ...base,
      planes: [{ net: "GND", layer: "In1.Cu" }],
      signalInner: ["In2.Cu"],
      routeKeepouts: [{ shape: { x0: 40, y0: 0, x1: 43, y1: 40 }, layers: ["F.Cu", "In2.Cu"] }],
    }, NETS, 4);
    expect(job.signalInner).toEqual(["In2.Cu"]);
    expect("solidPads" in job).toBe(false);
    expect(planesJob({ ...base, solidPads: ["U1.25", "J1"] }, NETS, 4).solidPads).toEqual(["U1.25", "J1"]);
    expect(job.routeKeepouts).toEqual([{ layers: ["F.Cu", "In2.Cu"], points: [[90, 60], [93, 60], [93, 100], [90, 100]] }]);
    // No plane on a layer the router has, and no inner routing on 2 layers.
    expect(() => planesJob({ ...base, planes: [{ net: "GND", layer: "In2.Cu" }], signalInner: ["In2.Cu"] }, NETS, 4)).toThrow(/signalInner gives to the router/);
    expect(() => planesJob({ ...base, signalInner: ["In2.Cu"] }, NETS, 2)).toThrow(/signalInner needs a 4-layer board/);
    expect(() => planesJob({ ...base, routeKeepouts: [{ shape: { x0: 0, y0: 0, x1: 1, y1: 1 }, layers: ["In1.Cu"] }] }, NETS, 2)).toThrow(/a route keep-out on In1.Cu/);
  });

  test("copperJob: inner layers on a 4-layer board only", () => {
    const spec: PcbSpec = {
      ...base, route: "scripted",
      copper: {
        zones: [{ net: "GND", layer: "In1.Cu", shape: { x0: 1, y0: 1, x1: 99, y1: 39 } }],
        tracks: [{ net: "+12V", layer: "In2.Cu", width: 0.3, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
        keepouts: [{ shape: { x0: 40, y0: 0, x1: 46, y1: 6 }, layers: ["In1.Cu"] }],
      },
    };
    expect(copperJob(spec, NETS, REFS, 4).copper.zones[0]!.layer).toBe("In1.Cu");
    expect(() => copperJob(spec, NETS, REFS)).toThrow(/a zone on net "GND" on In1.Cu, but the board has 2 copper layers/);
  });
});

describe("paperFor", () => {
  test("the smallest sheet that holds the board where the spec puts it", () => {
    expect(paperFor(base)).toBe("A4"); // 150 × 100 mm from the sheet corner
    expect(paperFor({ ...base, outline: { x0: 0, y0: 0, x1: 391.16, y1: 41.91 }, offset: { x: 100, y: 180 } })).toBe("A2");
    expect(paperFor({ ...base, outline: { x0: 0, y0: 0, x1: 391.16, y1: 41.91 }, offset: { x: 10, y: 100 } })).toBe("A3");
  });
});

describe("writeProjectRules", () => {
  test("a board's rule overrides win over the defaults; the rest stays", () => {
    const dir = mkdtempSync(join(tmpdir(), "pcb-rules-"));
    try {
      const pro = join(dir, "x.kicad_pro");
      writeFileSync(pro, JSON.stringify({ board: { design_settings: { rules: { min_text_height: 0.9, solder_mask_to_copper_clearance: 0.005 } } }, net_settings: { classes: [{ name: "Default", clearance: 0.2 }] } }));
      writeProjectRules(pro, { ...base, rules: { min_clearance: 0.2, min_track_width: 0.2 } });
      const rules = JSON.parse(readFileSync(pro, "utf8")).board.design_settings.rules;
      expect(rules).toMatchObject({ ...PCB_RULES, min_clearance: 0.2, min_track_width: 0.2, solder_mask_to_copper_clearance: 0.005 });
      writeProjectRules(pro, base);
      expect(JSON.parse(readFileSync(pro, "utf8")).board.design_settings.rules.min_clearance).toBe(PCB_RULES.min_clearance);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("boardNetName", () => {
  test("a slash in a pin name becomes {slash}, as the schematic writes it; sheet paths and labels stay", () => {
    expect(boardNetName("unconnected-(U39-SDO/~{ALARM}-Pad15)")).toBe("unconnected-(U39-SDO{slash}~{ALARM}-Pad15)");
    expect(boardNetName("Net-(U1-A/B)")).toBe("Net-(U1-A{slash}B)");
    expect(boardNetName("/tES channel 1/EB1")).toBe("/tES channel 1/EB1");
    expect(boardNetName("Net-(D2-K)")).toBe("Net-(D2-K)");
  });
});
