// Placement points for the CPL, read from the .kicad_pcb.
//
// JLCPCB's Mid X/Mid Y is "the X/Y coordinate of the component centroid"
// (https://jlcpcb.com/help/article/pick-place-file-for-pcb-assembly), while KiCad's position file
// holds the footprint anchor, which THT footprints put on pin 1 or pad S. This follows the
// Fabrication Toolkit (plugins/process.py @642b069, _get_footprint_position and
// _get_origin_from_footprint): footprints with the SMD attribute keep their anchor; every other
// footprint is placed at the centre of the bounding box of all its pads, taken with the footprint
// turned back to 0° and then rotated with it.
import { atom, atomNum, atomStr, child, children, head, parse, type List } from "../sexpr/sexpr.ts";

export interface Pad {
  number: string;
  shape: string;
  /** Footprint-relative position (mm, y down), as stored in the .kicad_pcb. */
  x: number;
  y: number;
  /** Pad angle relative to the footprint (the file stores board angles). */
  angle: number;
  w: number;
  h: number;
  rratio: number;
  /** Shape offset from the hole, in the pad's own frame. */
  offset: [number, number];
  /** Set when the bounding box of this pad cannot be computed exactly here. */
  unsupported?: string;
}

export interface BoardPart {
  ref: string;
  /** Library nickname and footprint name of the footprint's library id. */
  lib: string;
  name: string;
  side: "top" | "bottom";
  /** Anchor, board coordinates (mm, y down, page origin). */
  x: number;
  y: number;
  /** Degrees counter-clockwise, as stored (KiCad writes −180…180). */
  rot: number;
  /** "smd", "through_hole" or "" (unspecified). */
  type: string;
  pads: Pad[];
}

const degToRad = (d: number) => (d * Math.PI) / 180;

/** |cos|, |sin| of an angle, exact at multiples of 90°. */
function absCosSin(deg: number): [number, number] {
  const q = ((deg % 360) + 360) % 360;
  if (q % 90 === 0) return q % 180 === 0 ? [1, 0] : [0, 1];
  return [Math.abs(Math.cos(degToRad(deg))), Math.abs(Math.sin(degToRad(deg)))];
}

/** KiCad's RotatePoint (y down; positive angles turn counter-clockwise on screen). */
export function rotatePoint(x: number, y: number, deg: number): [number, number] {
  const q = ((deg % 360) + 360) % 360;
  if (q === 0) return [x, y];
  if (q === 90) return [y, -x];
  if (q === 180) return [-x, -y];
  if (q === 270) return [-y, x];
  const c = Math.cos(degToRad(deg));
  const s = Math.sin(degToRad(deg));
  return [x * c + y * s, -x * s + y * c];
}

function readPad(p: List, fpRot: number): Pad {
  const at = child(p, "at");
  const size = child(p, "size");
  const drill = child(p, "drill");
  const off = drill && child(drill, "offset");
  const shape = String(atom(p, 3) ?? "");
  const pad: Pad = {
    number: atomStr(p, 1) ?? "",
    shape,
    x: atomNum(at, 1) ?? 0,
    y: atomNum(at, 2) ?? 0,
    angle: (atomNum(at, 3) ?? 0) - fpRot,
    w: atomNum(size, 1) ?? 0,
    h: atomNum(size, 2) ?? 0,
    rratio: atomNum(child(p, "roundrect_rratio"), 1) ?? 0,
    offset: [atomNum(off, 1) ?? 0, atomNum(off, 2) ?? 0],
  };
  if (child(p, "padstack")) pad.unsupported = "per-layer padstack";
  else if (!["circle", "rect", "oval", "roundrect"].includes(shape)) pad.unsupported = `${shape} pad`;
  else if (child(p, "chamfer_ratio") && (((pad.angle % 90) + 90) % 90) !== 0) pad.unsupported = "chamfered pad at an angle";
  return pad;
}

/** Every footprint of a .kicad_pcb with what the CPL needs. */
export function readBoard(text: string, file = "<board>"): BoardPart[] {
  const root = parse(text, file);
  if (head(root) !== "kicad_pcb") throw new Error(`${file}: not a KiCad board`);
  return children(root, "footprint").map((fp) => {
    const libId = atomStr(fp, 1) ?? "";
    const colon = libId.indexOf(":");
    const at = child(fp, "at");
    const rot = atomNum(at, 3) ?? 0;
    const refProp = children(fp, "property").find((p) => atomStr(p, 1) === "Reference");
    const layer = atomStr(child(fp, "layer"), 1);
    if (layer !== "F.Cu" && layer !== "B.Cu") throw new Error(`${file}: footprint ${libId} on layer ${layer}`);
    const attr = String(atom(child(fp, "attr"), 1) ?? "");
    return {
      ref: atomStr(refProp, 2) ?? "",
      lib: colon < 0 ? "" : libId.slice(0, colon),
      name: libId.slice(colon + 1),
      side: layer === "F.Cu" ? "top" : "bottom",
      x: atomNum(at, 1) ?? 0,
      y: atomNum(at, 2) ?? 0,
      rot,
      type: attr === "smd" || attr === "through_hole" ? attr : "",
      pads: children(fp, "pad").map((p) => readPad(p, rot)),
    };
  });
}

/** Half extents of a pad's copper shape at angle `deg` (KiCad builds roundrects from an inner
 *  rectangle plus edge segments of width 2r, and ovals from one segment of width min(w, h)). */
function halfExtents(p: Pad): [number, number] {
  const [c, s] = absCosSin(p.angle);
  const box = (w: number, h: number): [number, number] => [c * w + s * h, s * w + c * h];
  switch (p.shape) {
    case "circle":
      return [p.w / 2, p.w / 2];
    case "rect":
      return box(p.w / 2, p.h / 2);
    case "roundrect": {
      const r = p.rratio * Math.min(p.w, p.h);
      const [hx, hy] = box(p.w / 2 - r, p.h / 2 - r);
      return [hx + r, hy + r];
    }
    case "oval": {
      const rad = Math.min(p.w, p.h) / 2;
      const a = Math.abs(p.w - p.h) / 2;
      return p.w >= p.h ? [c * a + rad, s * a + rad] : [s * a + rad, c * a + rad];
    }
    default:
      throw new Error(`no bounding box for ${p.shape} pads`);
  }
}

export interface PlacementPoint {
  /** Board coordinates (mm, y down). */
  x: number;
  y: number;
  origin: "anchor" | "pads";
}

/** Where JLCPCB should place the part, the Fabrication Toolkit's way (see the file header). */
export function placementPoint(part: BoardPart): PlacementPoint {
  if (part.type === "smd" || part.pads.length === 0) return { x: part.x, y: part.y, origin: "anchor" };
  const bad = part.pads.find((p) => p.unsupported);
  if (bad) throw new Error(`${part.ref} (${part.name}): pad ${bad.number || "(unnumbered)"} is a ${bad.unsupported}; its centroid is not computed`);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of part.pads) {
    const [ox, oy] = rotatePoint(p.offset[0], p.offset[1], p.angle);
    const [hx, hy] = halfExtents(p);
    x0 = Math.min(x0, p.x + ox - hx);
    x1 = Math.max(x1, p.x + ox + hx);
    y0 = Math.min(y0, p.y + oy - hy);
    y1 = Math.max(y1, p.y + oy + hy);
  }
  const [dx, dy] = rotatePoint((x0 + x1) / 2, (y0 + y1) / 2, part.rot);
  return { x: part.x + dx, y: part.y + dy, origin: "pads" };
}
