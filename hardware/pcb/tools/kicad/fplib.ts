// KiCad footprints (.kicad_mod): pad data for the pin-to-pad check and the PCB emitter.
import { atomNum, atomStr, child, children, head, type List } from "../sexpr/sexpr.ts";

/** KiCad's library convention for mechanical (mounting) pads, e.g. pot lugs in the RK09L footprint. */
export const MECHANICAL_PAD = "MP";

export interface Pad {
  /** Pad number; "" for unnumbered mechanical pads (mounting lugs, NPTH holes). */
  number: string;
  /** smd, thru_hole, np_thru_hole, connect. */
  kind: string;
  x: number;
  y: number;
}

export interface FootprintInfo {
  name: string;
  node: List;
  pads: Pad[];
  /** Numbered pads (the ones a symbol pin must map to); "MP" pads are mechanical and not listed. */
  numbers: Set<string>;
  attr: string | undefined;
}

export function analyzeFootprint(node: List): FootprintInfo {
  if (head(node) !== "footprint") throw new Error(`not a footprint (head: ${head(node)})`);
  const pads = children(node, "pad").map((p) => ({
    number: atomStr(p, 1) ?? "",
    kind: (p.items[2] as { value: string } | undefined)?.value ?? "",
    x: atomNum(child(p, "at"), 1) ?? 0,
    y: atomNum(child(p, "at"), 2) ?? 0,
  }));
  return {
    name: atomStr(node, 1)!,
    node,
    pads,
    // Unnumbered pads and KiCad's "MP" (mounting pad) convention are mechanical, not pins.
    numbers: new Set(pads.map((p) => p.number).filter((n) => n !== "" && n !== MECHANICAL_PAD)),
    attr: (child(node, "attr")?.items[1] as { value: string } | undefined)?.value,
  };
}
