// Placement for a board. Some parts are fixed by the board's pcb spec (connectors, through-hole parts,
// anything placed by hand); every SMD part is then placed greedily on the SMD side: most-connected first,
// at the free spot (courtyards never overlap, pads keep clear of through-hole pads and the board edge)
// with the shortest distance to the pads it connects to that are already placed. Coordinates are the
// spec's mm (y down); the board file adds spec.offset.

export type Side = "top" | "bottom";
export type Rot = 0 | 90 | 180 | 270;

export interface PadInfo {
  number: string;
  x: number;
  y: number;
  w: number;
  h: number;
  drill: number;
  smd: boolean;
}
export interface FootprintGeom {
  pads: PadInfo[];
  /** Bounding box of the courtyard and the silkscreen. */
  courtyard: Rect;
  /** The courtyard's outlines (footprint coordinates), when KiCad reports them. */
  outlines?: { x: number; y: number }[][];
}
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Placement {
  x: number;
  y: number;
  rot: Rot;
  side: Side;
}

/**
 * Where a pad of a footprint lands. Top: rotate counter-clockwise by `rot`. Bottom (kicad_pcb.py
 * flips left-right, then sets the orientation to `rot`): KiCad's flip turns the orientation into
 * 180°, so the pad is rotated by 180° − rot and then mirrored in x (checked against KiCad's own
 * pad positions on every run, flow.ts).
 */
export function padPos(p: { x: number; y: number }, at: Placement): { x: number; y: number } {
  const deg = at.side === "bottom" ? 180 - at.rot : at.rot;
  const a = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(a));
  const s = Math.round(Math.sin(a));
  let x = p.x * c + p.y * s;
  const y = -p.x * s + p.y * c;
  if (at.side === "bottom") x = -x;
  return { x: at.x + x, y: at.y + y };
}

export function courtyardAt(g: FootprintGeom, at: Placement): Rect {
  const cs = [
    padPos({ x: g.courtyard.x0, y: g.courtyard.y0 }, at),
    padPos({ x: g.courtyard.x1, y: g.courtyard.y0 }, at),
    padPos({ x: g.courtyard.x0, y: g.courtyard.y1 }, at),
    padPos({ x: g.courtyard.x1, y: g.courtyard.y1 }, at),
  ];
  return { x0: Math.min(...cs.map((p) => p.x)), y0: Math.min(...cs.map((p) => p.y)), x1: Math.max(...cs.map((p) => p.x)), y1: Math.max(...cs.map((p) => p.y)) };
}

const inside = (a: Rect, b: Rect) => a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;

/** Sutherland–Hodgman: the part of a polygon inside a rectangle. */
function clipToRect(poly: { x: number; y: number }[], r: Rect): { x: number; y: number }[] {
  type Pt = { x: number; y: number };
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p.x >= r.x0, (a, b) => ({ x: r.x0, y: a.y + ((b.y - a.y) * (r.x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= r.x1, (a, b) => ({ x: r.x1, y: a.y + ((b.y - a.y) * (r.x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= r.y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y0 - a.y)) / (b.y - a.y), y: r.y0 })],
    [(p) => p.y <= r.y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y1 - a.y)) / (b.y - a.y), y: r.y1 })],
  ];
  let out = poly;
  for (const [keep, cut] of edges) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length]!;
      const b = inp[i]!;
      if (keep(b)) {
        if (!keep(a)) out.push(cut(a, b));
        out.push(b);
      } else if (keep(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

/** Rectangles that make up an axis-aligned polygon (slabs between its corner heights); undefined when an edge is
 *  slanted. */
function orthoRects(poly: { x: number; y: number }[]): Rect[] | undefined {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    if (Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6) return undefined;
  }
  const ys = [...new Set(poly.map((p) => Math.round(p.y * 1e6) / 1e6))].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    const y0 = ys[j]!;
    const y1 = ys[j + 1]!;
    const ym = (y0 + y1) / 2;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      if (Math.abs(a.x - b.x) <= 1e-6 && Math.min(a.y, b.y) < ym && ym < Math.max(a.y, b.y)) xs.push(a.x);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1]! - xs[k]! > 1e-6) out.push({ x0: xs[k]!, y0, x1: xs[k + 1]!, y1 });
  }
  return out;
}

/** What a placed part's courtyard covers of the board, as rectangles: an axis-aligned courtyard (a radio module's
 *  T: the antenna's clearance band and the body) as the rectangles it is made of, clipped to the board (a part
 *  hanging over the edge blocks only the board under it); any other shape as its bounding box. A part wholly on
 *  the board keeps its whole bounding box, silkscreen included. */
export function courtyardRectsOnBoard(g: FootprintGeom, at: Placement, board: Rect): Rect[] {
  const all = courtyardAt(g, at);
  if (!g.outlines?.length || inside(all, board)) return [all];
  // A hair inside the edge, so courtyard lines that lie on the edge itself do not count as on the board.
  const e = 1e-6;
  const inner = { x0: board.x0 + e, y0: board.y0 + e, x1: board.x1 - e, y1: board.y1 - e };
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const out: Rect[] = [];
  for (const o of g.outlines) {
    const clipped = clipToRect(o.map((p) => padPos(p, at)), inner);
    if (!clipped.length) continue;
    const rects = orthoRects(clipped);
    if (rects) out.push(...rects);
    else {
      out.push({ x0: Math.min(...clipped.map((p) => p.x)), y0: Math.min(...clipped.map((p) => p.y)), x1: Math.max(...clipped.map((p) => p.x)), y1: Math.max(...clipped.map((p) => p.y)) });
    }
  }
  return out.map((r) => ({ x0: r3(r.x0), y0: r3(r.y0), x1: r3(r.x1), y1: r3(r.y1) }));
}

/** The bounding box of what a placed part's courtyard covers of the board (courtyardRectsOnBoard); undefined when
 *  nothing of it lies on the board. */
export function courtyardOnBoard(g: FootprintGeom, at: Placement, board: Rect): Rect | undefined {
  const rs = courtyardRectsOnBoard(g, at, board);
  if (!rs.length) return undefined;
  return { x0: Math.min(...rs.map((r) => r.x0)), y0: Math.min(...rs.map((r) => r.y0)), x1: Math.max(...rs.map((r) => r.x1)), y1: Math.max(...rs.map((r) => r.y1)) };
}

const overlap = (a: Rect, b: Rect, gap = 0) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

export interface PlaceInput {
  outline: Rect;
  /** Footprint geometry per component ref. */
  geom: Record<string, FootprintGeom>;
  /** Net of each pad: pads[ref][padNumber]. */
  pads: Record<string, Record<string, string>>;
  fixed: Record<string, Placement>;
  /** Refs to place, all on `side`. */
  place: string[];
  side: Side;
  /** Placed first, in this order. */
  order?: string[];
  /** Parts whose courtyard covers more than this many mm² go next, the largest first (they need the room that
   *  is still in one piece); then the rest, the most connected first. */
  largeFirst?: number;
  /** Part centre pulled next to a pad ("U1.4"). */
  near?: Record<string, string>;
  keepouts?: Rect[];
  /** Areas that hold given parts: a listed part's courtyard lies inside its area (an isolated section, a
   *  functional block). A part may be listed in one area only; unlisted parts may go anywhere. */
  regions?: { rect: Rect; refs: string[] }[];
  /** Nets that weigh less in the wire-length cost (GND is poured; rails are wide). */
  lightNets?: string[];
  /** Nets that add nothing to the wire-length cost: a plane carries them, each pad reaches it by its own via. */
  freeNets?: string[];
  /** Space between the courtyards of placed parts, mm (default 0.2): more leaves room for tracks and vias. */
  spacing?: number;
  /** Board edge keep-in for courtyards, and clearance from through-hole pads. */
  edge?: number;
  thtClear?: number;
  grid?: number;
}

export interface PlaceResult {
  placements: Record<string, Placement>;
  /** Refs that found no free spot. */
  failed: string[];
}

export function placeParts(inp: PlaceInput): PlaceResult {
  const grid = inp.grid ?? 0.5;
  const edge = inp.edge ?? 0.25;
  const thtClear = inp.thtClear ?? 0.35;
  const spacing = inp.spacing ?? 0.2;
  const keepIn: Rect = { x0: inp.outline.x0 + edge, y0: inp.outline.y0 + edge, x1: inp.outline.x1 - edge, y1: inp.outline.y1 - edge };
  const placements: Record<string, Placement> = { ...inp.fixed };
  const failed: string[] = [];
  // Obstacles: through-hole pads of every fixed part (they go through the board) and the
  // courtyards of fixed parts on the SMD side.
  const blocked: Rect[] = [...(inp.keepouts ?? [])];
  const netPads = new Map<string, { x: number; y: number }[]>();
  const addPads = (ref: string) => {
    const at = placements[ref]!;
    for (const p of inp.geom[ref]!.pads) {
      const q = padPos(p, at);
      const net = inp.pads[ref]?.[p.number];
      if (net) netPads.set(net, [...(netPads.get(net) ?? []), q]);
    }
  };
  for (const [ref, at] of Object.entries(inp.fixed)) {
    const g = inp.geom[ref]!;
    for (const p of g.pads) {
      if (p.smd) continue;
      const q = padPos(p, at);
      const r = Math.max(p.w, p.h) / 2 + thtClear;
      blocked.push({ x0: q.x - r, y0: q.y - r, x1: q.x + r, y1: q.y + r });
    }
    // Fixed parts' silkscreen outlines can sit on their courtyard edge (a box header): keep 0.4 mm more.
    if (at.side === inp.side) {
      for (const c of courtyardRectsOnBoard(g, at, inp.outline)) blocked.push({ x0: c.x0 - 0.4, y0: c.y0 - 0.4, x1: c.x1 + 0.4, y1: c.y1 + 0.4 });
    }
    addPads(ref);
  }
  const light = new Set(inp.lightNets ?? []);
  const free = new Set(inp.freeNets ?? []);
  const regionOf = new Map<string, Rect>();
  for (const r of inp.regions ?? []) {
    for (const ref of r.refs) {
      if (regionOf.has(ref)) throw new Error(`placement: ${ref} is listed in two regions`);
      regionOf.set(ref, r.rect);
    }
  }
  const nearPad = (spec: string) => {
    const [ref, pad] = spec.split(".");
    const at = placements[ref!];
    const p = inp.geom[ref!]?.pads.find((x) => x.number === pad);
    return at && p ? padPos(p, at) : undefined;
  };
  const connectedPlaced = (ref: string) => Object.values(inp.pads[ref] ?? {}).filter((n) => netPads.has(n) && !light.has(n) && !free.has(n)).length;

  const todo = new Set(inp.place.filter((r) => !(r in placements)));
  const areaOf = (r: string) => {
    const c = inp.geom[r]!.courtyard;
    return (c.x1 - c.x0) * (c.y1 - c.y0);
  };
  const large =
    inp.largeFirst === undefined ? [] : [...todo].filter((r) => areaOf(r) > inp.largeFirst!).sort((a, b) => areaOf(b) - areaOf(a) || a.localeCompare(b));
  const next = (): string | undefined => {
    for (const r of inp.order ?? []) if (todo.has(r)) return r;
    for (const r of large) if (todo.has(r)) return r;
    let best: string | undefined;
    let score = -1;
    for (const r of [...todo].sort()) {
      const s = connectedPlaced(r) * 100 + Object.keys(inp.pads[r] ?? {}).length;
      if (s > score) {
        score = s;
        best = r;
      }
    }
    return best;
  };

  for (let ref = next(); ref; ref = next()) {
    todo.delete(ref);
    const g = inp.geom[ref]!;
    const multiPin = g.pads.length > 2;
    const rots: Rot[] = multiPin ? [0, 90, 180, 270] : [0, 90];
    const target = inp.near?.[ref] ? nearPad(inp.near[ref]!) : undefined;
    let best: { at: Placement; cost: number } | undefined;
    // The courtyard stays inside the board's keep-in and the part's region; only obstacles that reach into
    // that area can be in the way.
    const reg = regionOf.get(ref);
    const area: Rect = reg ? { x0: Math.max(keepIn.x0, reg.x0), y0: Math.max(keepIn.y0, reg.y0), x1: Math.min(keepIn.x1, reg.x1), y1: Math.min(keepIn.y1, reg.y1) } : keepIn;
    const obstacles = blocked.filter((b) => overlap(area, b, spacing));
    // The same anchor grid as without a region; anchors too far from the region are skipped at once.
    const reach = Math.max(-g.courtyard.x0, g.courtyard.x1, -g.courtyard.y0, g.courtyard.y1);
    for (let y = keepIn.y0; y <= keepIn.y1; y += grid) {
      if (y < area.y0 - reach || y > area.y1 + reach) continue;
      for (let x = keepIn.x0; x <= keepIn.x1; x += grid) {
        if (x < area.x0 - reach || x > area.x1 + reach) continue;
        for (const rot of rots) {
          const at: Placement = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, rot, side: inp.side };
          const cy = courtyardAt(g, at);
          if (!inside(cy, area) || obstacles.some((b) => overlap(cy, b, spacing))) continue;
          let cost = 0;
          for (const p of g.pads) {
            const net = inp.pads[ref]?.[p.number];
            if (net && free.has(net)) continue;
            const others = net ? netPads.get(net) : undefined;
            if (!others?.length) continue;
            const q = padPos(p, at);
            const d = Math.min(...others.map((o) => Math.hypot(o.x - q.x, o.y - q.y)));
            cost += d * (light.has(net!) ? 0.15 : 1);
          }
          if (target) cost += 6 * Math.hypot(at.x - target.x, at.y - target.y);
          if (!best || cost < best.cost - 1e-9) best = { at, cost };
        }
      }
    }
    if (!best) {
      failed.push(ref);
      continue;
    }
    placements[ref] = best.at;
    blocked.push(courtyardAt(g, best.at));
    addPads(ref);
  }
  return { placements, failed };
}
