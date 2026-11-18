import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { withStackup } from "./flow.ts";
import { box, colourArgs, COLOURS, cylinder, outlineSize, STAND_INS, VIEWS, viewsFor, vrml } from "./render3d.ts";

describe("3D stand-in models", () => {
  test("VRML in KiCad's 0.1-inch units, footprint y flipped to model y", () => {
    // A body over footprint y 1.98 … 12.48, 9 mm tall, with a bushing on top.
    const text = vrml([box(-4.5, 1.98, 4.5, 12.48, 0, 9, COLOURS.dark), cylinder(0, 6.48, 3, 9, 14.5, COLOURS.metal)]);
    expect(text.startsWith("#VRML V2.0 utf8")).toBe(true);
    // 9 mm tall: 9 / 2.54 = 3.54331 units; body from footprint y 1.98 … 12.48 → model −12.48 … −1.98.
    expect(text).toContain("3.54331");
    expect(text).toContain(String(Number((-12.48 / 2.54).toFixed(5))));
    expect(text.match(/Shape \{/g)).toHaveLength(2);
  });

  test("a box has 8 corners and 6 faces; a cylinder two rings, two centres and 3 faces per segment", () => {
    const b = box(0, 0, 1, 2, 0, 3, COLOURS.plastic);
    expect([b.pts.length, b.faces.length]).toEqual([8, 6]);
    const c = cylinder(0, 0, 1, 0, 2, COLOURS.nylon, 12);
    expect([c.pts.length, c.faces.length]).toEqual([26, 36]);
  });

  test("every stand-in replaces a vendored footprint", () => {
    const names = readdirSync(join(paths.libKicad, "footprints")).flatMap((lib) => readdirSync(join(paths.libKicad, "footprints", lib)).map((f) => f.replace(/\.kicad_mod$/, "")));
    for (const name of Object.keys(STAND_INS)) expect(names).toContain(name);
  });
});

describe("render views follow the board outline", () => {
  test("the outline is read from Edge.Cuts; a tall board keeps the portrait views", () => {
    const board = '(kicad_pcb (version 20260206)\n\t(gr_rect (start 10 10) (end 34.3 109.75) (layer "Edge.Cuts"))\n\t(gr_rect (start 0 0) (end 500 500) (layer "F.SilkS"))\n)\n';
    const size = outlineSize(board)!;
    expect(size.w).toBeCloseTo(24.3, 3);
    expect(size.h).toBeCloseTo(99.75, 3);
    expect(viewsFor(size)).toBe(VIEWS);
    expect(viewsFor(null)).toBe(VIEWS);
    expect(outlineSize("(kicad_pcb (version 1))")).toBeNull();
  });

  test("a wide board gets landscape views", () => {
    const views = viewsFor({ w: 391.16, h: 41.91 });
    expect(views.map((v) => v.name)).toEqual(["top", "bottom", "iso"]);
    // 343 px of board, 20 px steps, + 300; the zoom fills the width (0.94 × 3200 / 660).
    expect(views[0]!.args).toEqual(["--side", "top", "-w", "3200", "-h", "660", "--zoom", "4.56"]);
    expect(views[1]!.args.slice(0, 2)).toEqual(["--side", "bottom"]);
    expect(viewsFor({ w: 200, h: 10 })[0]!.args.slice(4, 6)).toEqual(["-h", "600"]);
  });
});

describe("render colours", () => {
  test("a board with a stackup is rendered in its mask colour; one without keeps the default", () => {
    const board = "(kicad_pcb\n\t(setup\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n";
    expect(colourArgs(board)).toEqual([]);
    expect(colourArgs(withStackup(board, { mask: "black", thicknessMm: 1.6 }))).toEqual(["--use-board-stackup-colors"]);
  });
});
