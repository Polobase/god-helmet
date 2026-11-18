// 3D renders of an assembled board (kicad-cli pcb render), including the parts KiCad's 3D library has
// no model for: a footprint listed in STAND_INS gets a simple stand-in model (boxes and cylinders from
// the footprint's body outline and the datasheet's heights), and parts on spacers are lifted by their
// standoff height. The board in modules/<id>/kicad is never changed: a copy with the extra models goes
// to build/<id>/render/.
//
// Stand-ins are for looks and height checks only, not mechanical data.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { kicadCli } from "../kicad/cli.ts";
import { buildDir, kicadDir } from "../lib/paths.ts";
import { atomNum, atomStr, child, children, head, l, num, parse, print, str, sym } from "../sexpr/sexpr.ts";

type V3 = [number, number, number];
export type Rgb = [number, number, number];
export interface Solid {
  color: Rgb;
  pts: V3[];
  faces: number[][];
}

/** Colours for stand-in models. */
export const COLOURS: Record<"metal" | "dark" | "plastic" | "nylon" | "hole", Rgb> = {
  metal: [0.78, 0.78, 0.8],
  dark: [0.13, 0.13, 0.14],
  plastic: [0.22, 0.24, 0.28],
  nylon: [0.92, 0.91, 0.86],
  hole: [0.02, 0.02, 0.02],
};

/** Axis-aligned box in footprint coordinates (mm, y down), z up from the board surface. */
export function box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: Rgb): Solid {
  // Model space has y up: flip, then order so the faces below wind counter-clockwise from outside.
  const [ya, yb] = [Math.min(-y0, -y1), Math.max(-y0, -y1)];
  const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)];
  const pts: V3[] = [[xa, ya, z0], [xb, ya, z0], [xb, yb, z0], [xa, yb, z0], [xa, ya, z1], [xb, ya, z1], [xb, yb, z1], [xa, yb, z1]];
  return { color, pts, faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [3, 0, 4, 7], [1, 2, 6, 5]] };
}

/** Vertical cylinder at footprint (cx, cy), radius r, from z0 to z1. */
export function cylinder(cx: number, cy: number, r: number, z0: number, z1: number, color: Rgb, n = 40): Solid {
  const pts: V3[] = [];
  for (const z of [z0, z1]) for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos((2 * Math.PI * i) / n), -cy + r * Math.sin((2 * Math.PI * i) / n), z]);
  pts.push([cx, -cy, z0], [cx, -cy, z1]);
  const faces: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i], [2 * n + 1, n + i, n + j], [2 * n, j, i]);
  }
  return { color, pts, faces };
}

/** VRML 2.0 text. KiCad reads VRML in units of 0.1 inch (2.54 mm). */
export function vrml(solids: Solid[]): string {
  const f = (v: number) => Number((v / 2.54).toFixed(5)).toString();
  const shapes = solids.map((s) => `Shape {
  appearance Appearance { material Material { diffuseColor ${s.color.join(" ")} specularColor 0.25 0.25 0.25 ambientIntensity 0.3 shininess 0.3 } }
  geometry IndexedFaceSet {
    solid FALSE
    coord Coordinate { point [ ${s.pts.map((p) => p.map(f).join(" ")).join(", ")} ] }
    coordIndex [ ${s.faces.map((fc) => `${fc.join(", ")}, -1`).join(", ")} ]
  }
}`);
  return `#VRML V2.0 utf8\n# god-helmet-pcb stand-in model (tools/pcb/render3d.ts); approximate, for renders only\n${shapes.join("\n")}\n`;
}

/** Footprint name → stand-in model, for footprints whose KiCad 3D model does not exist. An entry names the file
 *  written to build/<id>/render/models/ and the solids, built with box() and cylinder() from the footprint's
 *  body outline and the datasheet's heights (see docs/pcb.md "Renders"). None is needed yet. */
export const STAND_INS: Record<string, { file: string; solids: () => Solid[] }> = {};

const modelNode = (path: string, z = 0) =>
  l(sym("model"), str(path), l(sym("offset"), l(sym("xyz"), num(0), num(0), num(z))), l(sym("scale"), l(sym("xyz"), num(1), num(1), num(1))), l(sym("rotate"), l(sym("xyz"), num(0), num(0), num(0))));

/** Copy of the board with stand-in models and standoffs (mm per reference). Returns its path. */
export function prepareRenderBoard(id: string, standoffs: Record<string, number> = {}): string {
  const out = join(buildDir(id), "render");
  const models = join(out, "models");
  mkdirSync(models, { recursive: true });
  const src = join(kicadDir(id), `${id}.kicad_pcb`);
  const board = parse(readFileSync(src, "utf8"), src);
  const written = new Set<string>();
  for (const fp of children(board, "footprint")) {
    const name = (atomStr(fp, 1) ?? "").split(":").pop()!;
    const ref = children(fp, "property").find((p) => atomStr(p, 1) === "Reference");
    const refName = ref ? atomStr(ref, 2) : undefined;
    const stand = STAND_INS[name];
    if (stand) {
      const file = join(models, stand.file);
      if (!written.has(file)) writeFileSync(file, vrml(stand.solids()));
      written.add(file);
      for (let i = fp.items.length - 1; i >= 0; i--) if (head(fp.items[i]) === "model") fp.items.splice(i, 1);
      fp.items.push(modelNode(file));
    }
    const lift = refName ? standoffs[refName] : undefined;
    if (lift) {
      const model = child(fp, "model");
      const xyz = model && child(child(model, "offset")!, "xyz");
      if (xyz) xyz.items[3] = num(lift);
      // The spacer itself: a Ø4 mm nylon tube under the part, centred between its pads.
      const pads = children(fp, "pad").map((p) => child(p, "at")!).map((a) => [atomNum(a, 1) ?? 0, atomNum(a, 2) ?? 0] as const);
      const cx = pads.reduce((s, p) => s + p[0], 0) / pads.length;
      const cy = pads.reduce((s, p) => s + p[1], 0) / pads.length;
      const file = join(models, `spacer-${lift}mm.wrl`);
      writeFileSync(file, vrml([cylinder(0, 0, 2, 0, lift, COLOURS.nylon)]));
      const spacer = modelNode(file);
      child(child(spacer, "offset")!, "xyz")!.items.splice(1, 2, num(cx), num(-cy));
      fp.items.push(spacer);
    }
  }
  const dest = join(out, `${id}.kicad_pcb`);
  writeFileSync(dest, print(board));
  return dest;
}

export interface RenderView {
  name: string;
  args: string[];
}

/** Portrait views, for a board that is taller than wide. */
export const VIEWS: RenderView[] = [
  { name: "top", args: ["--side", "top", "-w", "900", "-h", "2600"] },
  { name: "bottom", args: ["--side", "bottom", "-w", "900", "-h", "2600"] },
  { name: "iso", args: ["--side", "top", "--perspective", "--rotate", "-55,0,35", "-w", "1800", "-h", "1800", "--zoom", "0.9"] },
];

/** Size of the board's outline rectangle on Edge.Cuts in mm, or null when it has none. */
export function outlineSize(boardText: string, file = "<board>"): { w: number; h: number } | null {
  const rect = children(parse(boardText, file), "gr_rect").find((r) => atomStr(child(r, "layer")!, 1) === "Edge.Cuts");
  const [s, e] = [rect && child(rect, "start"), rect && child(rect, "end")];
  if (!s || !e) return null;
  return { w: Math.abs((atomNum(e, 1) ?? 0) - (atomNum(s, 1) ?? 0)), h: Math.abs((atomNum(e, 2) ?? 0) - (atomNum(s, 2) ?? 0)) };
}

/** The views for an outline: VIEWS for a board that is taller than wide, landscape views for a wide one, so a
 *  long board fills the picture instead of a strip in a tall image. */
export function viewsFor(size: { w: number; h: number } | null): RenderView[] {
  if (!size || size.w <= size.h) return VIEWS;
  const w = 3200;
  // The board's own height in pixels plus a margin, in steps of 20 px and at least 600.
  const h = Math.max(600, Math.ceil((w * size.h) / size.w / 20) * 20 + 300);
  // kicad-cli fits the board's long side to the image's short side (seen on a 391 mm board, 10.0.6), so a
  // wide image needs a zoom of about width / height to fill it.
  const zoom = ((0.94 * w) / h).toFixed(2);
  return [
    { name: "top", args: ["--side", "top", "-w", String(w), "-h", String(h), "--zoom", zoom] },
    { name: "bottom", args: ["--side", "bottom", "-w", String(w), "-h", String(h), "--zoom", zoom] },
    { name: "iso", args: ["--side", "top", "--perspective", "--rotate", "-55,0,35", "-w", "3200", "-h", "1400", "--zoom", "2.2"] },
  ];
}

/** A board with a stackup names its mask colour (tools/pcb/flow.ts withStackup): kicad-cli renders it in
 *  that colour only when told to. A board without one keeps KiCad's default green. */
export const colourArgs = (boardText: string): string[] => (boardText.includes("\t\t(stackup\n") ? ["--use-board-stackup-colors"] : []);

/** Render every view to build/<id>/render/<id>-<view>.png. Without `views`, they follow the outline. */
export async function renderBoard(id: string, standoffs: Record<string, number> = {}, views?: RenderView[]): Promise<string[]> {
  const board = prepareRenderBoard(id, standoffs);
  const text = readFileSync(board, "utf8");
  views ??= viewsFor(outlineSize(text, board));
  const colours = colourArgs(text);
  const files: string[] = [];
  for (const v of views) {
    const png = join(buildDir(id), "render", `${id}-${v.name}.png`);
    await kicadCli(["pcb", "render", "--quality", "high", "--background", "opaque", "--floor", ...colours, ...v.args, "-o", png, board], { timeoutMs: 600_000 });
    files.push(png);
  }
  return files;
}
