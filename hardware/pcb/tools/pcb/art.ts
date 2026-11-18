// Silkscreen drawings for a scripted layout (PcbSpec.art): the moves that put a drawing where a board has
// room (turned on its side, or mirrored for the back so it reads from there). The drawings themselves are
// lines, rings, dots and polygons (SilkArt in flow.ts), at least JLCPCB's printable sizes (SILK_MIN).
import type { Pt, SilkArt } from "./flow.ts";

const move = (art: SilkArt[], f: (p: Pt) => Pt): SilkArt[] =>
  art.map((a) => (a.kind === "line" ? { ...a, a: f(a.a), b: f(a.b) } : a.kind === "poly" ? { ...a, pts: a.pts.map(f) } : { ...a, c: f(a.c) }));

/** Moved by `d` (mm). */
export const translate = (art: SilkArt[], d: Pt): SilkArt[] => move(art, (p) => ({ x: p.x + d.x, y: p.y + d.y }));

/** Turned by a quarter about `c`, like a text with `rot: 90`: what read from left to right reads from
 *  bottom to top. */
export const quarterTurn = (art: SilkArt[], c: Pt): SilkArt[] => move(art, (p) => ({ x: c.x + (p.y - c.y), y: c.y - (p.x - c.x) }));

/** Mirrored left to right about the vertical line at `x` and put on the back, so it reads from there. */
export const onBack = (art: SilkArt[], x: number): SilkArt[] =>
  move(art, (p) => ({ x: 2 * x - p.x, y: p.y })).map((a) => ({ ...a, layer: "B.SilkS" as const }));
