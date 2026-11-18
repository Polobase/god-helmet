// Integer geometry for schematics.
//
// Coordinates are KiCad schematic internal units (IU): 1 IU = 100 nm, so 1.27 mm = 12700 IU.
// Integers avoid float drift, so "on grid" and "same point" are exact comparisons.
// Library symbols use Y-up coordinates; the sheet uses Y-down.

export const IU_PER_MM = 10_000;
/** Connection grid: 50 mil = 1.27 mm. Every generated connection point is a multiple of this. */
export const GRID = 12_700;

export interface Pt {
  x: number;
  y: number;
}

export type Rot = 0 | 90 | 180 | 270;
export type Mirror = "x" | "y";

export const mmToIu = (mm: number) => Math.round(mm * IU_PER_MM);
export const iuToMm = (iu: number) => iu / IU_PER_MM;
export const gridToIu = (g: number) => g * GRID;
export const onGrid = (p: Pt) => p.x % GRID === 0 && p.y % GRID === 0;
export const ptKey = (p: Pt) => `${p.x},${p.y}`;
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const eq = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });

/**
 * Map a library-space vector (Y-up) to a sheet-space delta (Y-down) for a placed symbol.
 * Mirrors eeschema exactly: the library parser inverts Y (parseXY(true)), `(at x y angle)`
 * selects TRANSFORM(0|90|180|270) and `(mirror x|y)` is then applied on top
 * (sch_io_kicad_sexpr_parser.cpp and SCH_SYMBOL::SetOrientation, KiCad 10.0.6).
 */
export function libToSheet(v: Pt, rot: Rot, mirror?: Mirror): Pt {
  const a = v.x;
  const b = -v.y; // library Y-up -> internal Y-down
  let x: number;
  let y: number;
  switch (rot) {
    case 0:
      [x, y] = [a, b];
      break;
    case 90: // TRANSFORM(0, 1, -1, 0)
      [x, y] = [b, -a];
      break;
    case 180: // TRANSFORM(-1, 0, 0, -1)
      [x, y] = [-a, -b];
      break;
    case 270: // TRANSFORM(0, -1, 1, 0)
      [x, y] = [-b, a];
      break;
  }
  if (mirror === "x") y = -y;
  else if (mirror === "y") x = -x;
  return { x: x + 0, y: y + 0 }; // "+ 0" normalises -0
}

/** Unit vector (library space, Y-up) of a pin's `(at x y angle)`: the direction from the
 *  connection point towards the symbol body. */
export function pinDirection(angle: number): Pt {
  switch (((angle % 360) + 360) % 360) {
    case 0:
      return { x: 1, y: 0 };
    case 90:
      return { x: 0, y: 1 };
    case 180:
      return { x: -1, y: 0 };
    case 270:
      return { x: 0, y: -1 };
    default:
      throw new Error(`pin angle ${angle} is not a multiple of 90°`);
  }
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boxOf(points: Pt[]): Box {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export const boxesOverlap = (a: Box, b: Box) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** Is p strictly inside segment a–b (axis-aligned segments only)? */
export function onSegmentInterior(p: Pt, a: Pt, b: Pt): boolean {
  if (a.x === b.x && p.x === a.x) return p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
  if (a.y === b.y && p.y === a.y) return p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
  return false;
}
