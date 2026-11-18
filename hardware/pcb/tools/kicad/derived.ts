// Footprints derived from KiCad stock footprints: parts the stock library does not have, made by
// `bun run lib:import` from a stock base plus the recorded edits below (deterministic, provenance in
// lib/kicad/SOURCES.json). Nothing is drawn by hand; every change names its source.
import { atomNum, atomStr, child, children, head, num, str, type List } from "../sexpr/sexpr.ts";

export interface DerivedFootprint {
  /** Stock footprint the derivation starts from ("Lib:Name"). */
  base: string;
  /** What changes and why, with sources (written into SOURCES.json and the footprint's descr). */
  why: string;
  edit: (fp: List) => void;
}

const setNum = (n: List | undefined, i: number, v: number) => {
  if (!n || n.items[i]?.type !== "num") throw new Error(`derived footprint: expected a number at ${head(n)}[${i}]`);
  n.items[i] = num(v);
};

/** Replace the footprint name (item 1) and the descr text. */
function rename(fp: List, name: string, descr: string) {
  fp.items[1] = str(name);
  const d = child(fp, "descr");
  if (!d) throw new Error("derived footprint: base has no descr");
  d.items[1] = str(descr);
}

/** A screw terminal block on a stock block with the same pitch and pole count (pin 1 at the origin, the wire
 *  entry towards +y):
 *  - every pad gets `pad` mm copper and a `drill` mm hole;
 *  - what lies in front of the pin row (outline, ledge lines, pin-1 mark, texts) moves with the wire-entry face
 *    to `front` mm, what lies behind it moves with the back face to `back` mm; the screws stay on the pin row;
 *  - the courtyard grows by `lug` mm at pin 1's end, for a lug on that side of the housing.
 *  `base` is the stock body (mm behind and in front of the pin row): a changed stock footprint fails here. */
function terminalBlock(
  fp: List,
  name: string,
  descr: string,
  tags: string,
  o: { base: { back: number; front: number }; back: number; front: number; lug: number; pad: number; drill: number },
) {
  rename(fp, name, descr);
  const t = child(fp, "tags");
  if (!t) throw new Error("derived footprint: base has no tags");
  t.items[1] = str(tags);

  const pads = children(fp, "pad");
  if (!pads.length) throw new Error("derived footprint: base has no pads");
  for (const p of pads) {
    setNum(child(p, "size"), 1, o.pad);
    setNum(child(p, "size"), 2, o.pad);
    setNum(child(p, "drill"), 1, o.drill);
  }

  const onLayer = (n: List, ...layers: string[]) => layers.includes(atomStr(child(n, "layer"), 1) ?? "");
  const bodyY = children(fp, "fp_line")
    .filter((line) => onLayer(line, "F.Fab"))
    .flatMap((line) => [atomNum(child(line, "start"), 2), atomNum(child(line, "end"), 2)])
    .filter((y): y is number => y !== undefined);
  if (Math.min(...bodyY) !== -o.base.back || Math.max(...bodyY) !== o.base.front) {
    throw new Error(`derived footprint: expected a body from y ${-o.base.back} to ${o.base.front}, found ${Math.min(...bodyY)} to ${Math.max(...bodyY)}`);
  }

  // The screws and their slots lie within 2 mm of the pin row and stay there.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const shiftY = (p: List | undefined) => {
    const y = atomNum(p, 2);
    if (y === undefined) throw new Error(`derived footprint: expected a point, found ${head(p)}`);
    if (y >= 2) setNum(p, 2, r2(y + o.front - o.base.front));
    else if (y <= -2) setNum(p, 2, r2(y + o.base.back - o.back));
  };
  for (const line of children(fp, "fp_line")) {
    if (!onLayer(line, "F.Fab", "F.SilkS")) continue;
    shiftY(child(line, "start"));
    shiftY(child(line, "end"));
  }
  for (const poly of children(fp, "fp_poly")) {
    if (onLayer(poly, "F.SilkS")) for (const xy of children(child(poly, "pts")!, "xy")) shiftY(xy);
  }
  for (const text of [...children(fp, "property"), ...children(fp, "fp_text")]) {
    if (onLayer(text, "F.Fab", "F.SilkS")) shiftY(child(text, "at"));
  }
  const courtyards = children(fp, "fp_rect").filter((r) => onLayer(r, "F.CrtYd"));
  if (courtyards.length !== 1) throw new Error(`derived footprint: expected one courtyard rectangle, found ${courtyards.length}`);
  const [start, end] = [child(courtyards[0]!, "start"), child(courtyards[0]!, "end")];
  shiftY(start);
  shiftY(end);
  const x0 = atomNum(start, 1);
  if (x0 === undefined || x0 >= 0) throw new Error("derived footprint: expected the courtyard to start left of pin 1");
  setNum(start, 1, r2(x0 - o.lug));
}

type Box4 = [number, number, number, number]; // xmin, xmax, ymin, ymax

/** A SIP module on a stock SIP footprint with the same pin grid: every pad gets `pad` mm copper and a `drill` mm
 *  hole, and each layer's drawing is mapped linearly from the stock box to the module's box (body on F.Fab,
 *  silkscreen, courtyard; the pin-1 marks move with their layer). `from` is the stock geometry: a changed stock
 *  footprint fails here. */
function sipModule(fp: List, name: string, descr: string, o: { pad: number; drill: number; boxes: Record<string, { from: Box4; to: Box4 }> }) {
  rename(fp, name, descr);
  const pads = children(fp, "pad");
  if (!pads.length) throw new Error("derived footprint: base has no pads");
  for (const p of pads) {
    setNum(child(p, "size"), 1, o.pad);
    setNum(child(p, "size"), 2, o.pad);
    setNum(child(p, "drill"), 1, o.drill);
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const map = (v: number, a0: number, a1: number, b0: number, b1: number) => r2(b0 + ((v - a0) * (b1 - b0)) / (a1 - a0));
  for (const [layer, { from, to }] of Object.entries(o.boxes)) {
    const lines = children(fp, "fp_line").filter((line) => atomStr(child(line, "layer"), 1) === layer);
    if (!lines.length) throw new Error(`derived footprint: base has no lines on ${layer}`);
    const xs = lines.flatMap((l) => [atomNum(child(l, "start"), 1), atomNum(child(l, "end"), 1)]).filter((v): v is number => v !== undefined);
    const ys = lines.flatMap((l) => [atomNum(child(l, "start"), 2), atomNum(child(l, "end"), 2)]).filter((v): v is number => v !== undefined);
    // the box the outline spans (pin-1 marks may lie outside it, and are mapped along)
    const has = (vs: number[], v: number) => vs.some((x) => Math.abs(x - v) < 1e-9);
    if (!(has(xs, from[0]) && has(xs, from[1]) && has(ys, from[2]) && has(ys, from[3]))) {
      throw new Error(`derived footprint: ${layer} does not span the expected ${from.join(", ")}`);
    }
    for (const l of lines) {
      for (const pt of [child(l, "start"), child(l, "end")]) {
        setNum(pt, 1, map(atomNum(pt, 1)!, from[0], from[1], to[0], to[1]));
        setNum(pt, 2, map(atomNum(pt, 2)!, from[2], from[3], to[2], to[3]));
      }
    }
  }
}

export const DERIVED_FOOTPRINTS: Record<string, DerivedFootprint> = {
  "Converter_DCDC:Converter_DCDC_EVISUN_A0515S-2WR3_THT": {
    base: "Converter_DCDC:Converter_DCDC_Murata_NMAxxxxSC_THT",
    why:
      "EVISUN A0515S-2WR3 isolated DC/DC module (LCSC C7465204; EVISUN datasheet 'A_S-2WR3 & B_S-2WR3 series' V1.0, " +
      "p. 5, read 2026-11-12, parts/a0515s-2wr3.yaml): the same pin grid as Murata's NMA (pins 1, 2, 4, 5, 6 on " +
      "2.54 mm), but pins of 0.50 x 0.30 mm (±0.10; 0.72 mm diagonal at the limit, more than the stock 0.7 mm hole), " +
      "EVISUN's recommended holes 1.00 mm, and a body of 7.00 x 19.65 mm with the pin row 0.90 mm from the printed " +
      "face (6.10 mm from the back) and pin 1 2.21 mm from its end. Edits to Murata's NMAxxxxSC footprint: holes 1.0 mm " +
      "in 1.7 mm pads; body (F.Fab) x -6.10...+0.90, y -2.21...+17.44; silkscreen 0.12 mm outside it; courtyard " +
      "x -6.60...+1.40, y -2.96...+18.19 (0.25 mm plus the drawing's tolerances). The 3D model is still Murata's.",
    edit: (fp) => sipModule(fp, "Converter_DCDC_EVISUN_A0515S-2WR3_THT",
      "EVISUN A0515S-2WR3 isolated DC/DC module, SIP, pins 1 2 4 5 6 at 2.54 mm, holes 1.0 mm, body 7.00 x 19.65 mm; derived from Converter_DCDC_Murata_NMAxxxxSC_THT (see lib/kicad/SOURCES.json)",
      {
        pad: 1.7,
        drill: 1.0,
        boxes: {
          "F.Fab": { from: [-4.77, 1.23, -2.03, 17.47], to: [-6.1, 0.9, -2.21, 17.44] },
          "F.SilkS": { from: [-4.89, 1.35, -2.15, 17.59], to: [-6.22, 1.02, -2.33, 17.56] },
          "F.CrtYd": { from: [-5.02, 1.48, -2.28, 17.72], to: [-6.6, 1.4, -2.96, 18.19] },
        },
      }),
  },
  "TerminalBlock:TerminalBlock_Kangnex_WJ128V-5.0-04P_1x04_P5.00mm_Horizontal": {
    base: "TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-4_1x04_P5.00mm_Horizontal",
    why:
      "Ningbo Kangnex WJ128V-5.0-04P screw terminal block (LCSC C192769; customer drawing WJ128V-5.0-XXP-1Y-00A, " +
      "version A, 2024.03.10, in the LCSC PDF, read 2026-10-04): 4 poles at 5.00 mm, pins 0.90 x 0.80, PCB holes 1.50, " +
      "body 20.00 x 10.28 with the pin row 4.90 from the back face and so 5.38 from the wire-entry face, a 0.60 lug at " +
      "one end. No stock horizontal 4-pole footprint at 5.00 mm has 1.5 mm holes (they have 1.1 to 1.4) or this body. Edits to " +
      "Phoenix's MKDS 1,5 block (holes 1.3 in 2.6 mm pads; body 5.2 behind and 4.6 in front of the pin row): holes " +
      "1.5 mm in 2.8 mm pads (the same 0.65 mm ring); what lies in front of the pin row moves 0.78 mm out with the " +
      "wire-entry face and what lies behind it 0.3 mm in with the back face (body, silkscreen, courtyard, texts); " +
      "0.6 mm more courtyard at pin 1's end for the lug. The 3D model is still Phoenix's block, a stand-in.",
    edit: (fp) => terminalBlock(fp, "TerminalBlock_Kangnex_WJ128V-5.0-04P_1x04_P5.00mm_Horizontal",
      "Screw terminal block Ningbo Kangnex WJ128V-5.0-04P, 4 poles, pitch 5 mm, body 20 x 10.28 mm, holes 1.5 mm, pads 2.8 mm; derived from TerminalBlock_Phoenix_MKDS-1,5-4_1x04_P5.00mm_Horizontal (see lib/kicad/SOURCES.json)",
      "THT Terminal Block Kangnex WJ128V-5.0-04P pitch 5mm size 20x10.28mm drill 1.5mm pad 2.8mm",
      { base: { back: 5.2, front: 4.6 }, back: 4.9, front: 5.38, lug: 0.6, pad: 2.8, drill: 1.5 }),
  },
};
