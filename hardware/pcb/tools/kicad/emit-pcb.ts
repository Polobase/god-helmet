// Minimal KiCad 10 board writer (.kicad_pcb, format 20260206): 2-layer stackup defaults, a board
// outline, placed footprints (copied from the vendored libraries, rotated in 90° steps, top side
// only, optional pad nets) and silkscreen text. It writes the fab-tool test fixtures. Real boards are
// built by tools/pcb/kicad_pcb.py with KiCad's own API (both sides, placer, Specctra); see docs/pcb.md.
import { atomNum, atomStr, child, formatNumber, head, l, num, print, str, type List, type Node, type Num } from "../sexpr/sexpr.ts";
import type { FootprintInfo } from "./fplib.ts";
import { TOOLCHAIN, uuidv5 } from "./uuid.ts";

/** Native board format of KiCad 10.0.x (pcbnew/pcb_io/kicad_sexpr/pcb_io_kicad_sexpr.h). */
export const PCB_FILE_VERSION = 20260206;

export interface BoardFootprint {
  libId: string;
  info: FootprintInfo;
  ref: string;
  value: string;
  /** mm, board coordinates (y down). */
  at: { x: number; y: number };
  /** Degrees counter-clockwise, as in KiCad. */
  rot?: 0 | 90 | 180 | 270;
  /** UUID of the linked schematic symbol (unit A); omitted for board-only items. */
  symbolUuid?: string;
  sheetfile?: string;
  /** Symbol fields: a name the library footprint already has (Datasheet, Description) sets its
   *  value, any other adds a hidden property. */
  fields?: [string, string][];
  /** Net name per pad number (pads not listed stay without a net). */
  nets?: Record<string, string>;
}

export interface BoardSpec {
  /** Seeds every UUID in the board. */
  name: string;
  outline: { x: number; y: number; w: number; h: number };
  footprints: BoardFootprint[];
  texts?: { text: string; x: number; y: number; size?: number; layer?: string }[];
  thicknessMm?: number;
  /** 2 (the default) or 4 copper layers. */
  copperLayers?: 2 | 4;
}

/** Layer table of a 2-layer KiCad 10 board, as pcbnew 10.0.6 writes it. */
export const LAYERS: [number, string, string, string?][] = [
  [0, "F.Cu", "signal", "top_layer"], [2, "B.Cu", "signal", "bottom_layer"],
  [9, "F.Adhes", "user", "F.Adhesive"], [11, "B.Adhes", "user", "B.Adhesive"],
  [13, "F.Paste", "user"], [15, "B.Paste", "user"],
  [5, "F.SilkS", "user", "F.Silkscreen"], [7, "B.SilkS", "user", "B.Silkscreen"],
  [1, "F.Mask", "user"], [3, "B.Mask", "user"],
  [17, "Dwgs.User", "user", "User.Drawings"], [19, "Cmts.User", "user", "User.Comments"],
  [21, "Eco1.User", "user", "User.Eco1"], [23, "Eco2.User", "user", "User.Eco2"],
  [25, "Edge.Cuts", "user"], [27, "Margin", "user"],
  [31, "F.CrtYd", "user", "F.Courtyard"], [29, "B.CrtYd", "user", "B.Courtyard"],
  [35, "F.Fab", "user"], [33, "B.Fab", "user"],
];

/** The layer table of a 4-layer board: the inner copper after F.Cu, numbered as pcbnew 10.0.6 numbers it
 *  (In1.Cu 4, In2.Cu 6), typed "power" as `bun run pcb` types them (tools/pcb/kicad_pcb.py). */
export const LAYERS_4: [number, string, string, string?][] = [LAYERS[0]!, [4, "In1.Cu", "power"], [6, "In2.Cu", "power"], ...LAYERS.slice(1)];

const DROP = new Set(["version", "generator", "generator_version"]);

/** Board coordinates are 1 nm internal units: keep 6 decimals (4 would move points by up to
 *  50 nm, which KiCad's library-parity check reports as lib_footprint_mismatch). */
const nm = (v: number): Num => ({ type: "num", value: v, raw: formatNumber(v, 6) });

/** KiCad's RotatePoint for multiples of 90° (y down, positive = counter-clockwise on screen):
 *  x' = x·cos + y·sin, y' = −x·sin + y·cos, written out so the result stays exact. */
function rotate90(x: number, y: number, rot: number): [number, number] {
  switch (rot) {
    case 90:
      return [y, -x];
    case 180:
      return [-x, -y];
    case 270:
      return [-y, x];
    default:
      return [x, y];
  }
}

/** Footprint-local zone points → board coordinates (rotate about the anchor, then translate). */
function placeXy(n: List, fp: BoardFootprint): List {
  if (head(n) === "xy") {
    const [x, y] = rotate90(atomNum(n, 1)!, atomNum(n, 2)!, fp.rot ?? 0);
    return l("xy", nm(x + fp.at.x), nm(y + fp.at.y));
  }
  return { type: "list", items: n.items.map((c) => (c.type === "list" ? placeXy(c, fp) : c)) };
}

/** Add the footprint rotation to an item's `(at x y [angle])`: in a .kicad_pcb, pad and text
 *  positions stay footprint-relative but their angles are board angles (checked with pcbnew
 *  10.0.6: an R_0603 rotated to 90° is saved with `(at -0.825 0 90)` on its pads and
 *  `(at 0 -1.43 90)` on its Reference; without that DRC reports lib_footprint_mismatch). */
function addAngle(n: List, rot: number): List {
  if (!rot) return n;
  return {
    type: "list",
    items: n.items.map((c) => {
      if (head(c) !== "at") return c;
      const at = c as List;
      const angle = ((((atomNum(at, 3) ?? 0) + rot) % 360) + 360) % 360;
      return l("at", at.items[1]!, at.items[2]!, angle);
    }),
  };
}

/** Footprint items that carry an angle of their own. Other angled items (text boxes,
 *  dimensions, images) are refused on rotated footprints rather than placed wrongly. */
const ANGLED = new Set(["pad", "property", "fp_text"]);
const UNSUPPORTED_ROTATED = new Set(["fp_text_box", "dimension", "image", "group"]);

/** Insert `(net "name")` into a pad, before pinfunction/pintype/uuid as KiCad 10 writes it
 *  (pcbnew 10.0.6 saves pad nets by name only; the board has no separate net table). */
function withNet(pad: List, net: string): List {
  const at = pad.items.findIndex((c) => ["pinfunction", "pintype", "uuid"].includes(head(c) ?? ""));
  const items = [...pad.items];
  items.splice(at < 0 ? items.length : at, 0, l("net", str(net)));
  return { type: "list", items };
}

/** Turn a library footprint into a placed board footprint: footprint `at` with its rotation,
 *  pad/text angles turned with it, zones moved to board coordinates, pad nets set. */
function place(fp: BoardFootprint, name: string): List {
  const lib = fp.info.node;
  const rot = fp.rot ?? 0;
  const items: Node[] = [lib.items[0]!, str(fp.libId)];
  const uid = (s: string) => l("uuid", str(uuidv5(`${name}/fp/${fp.ref}/${s}`)));
  const nets = new Map(Object.entries(fp.nets ?? {}));
  const fields = new Map(fp.fields ?? []);
  const padNumbers = new Set(fp.info.pads.map((p) => p.number));
  for (const n of nets.keys()) if (!padNumbers.has(n)) throw new Error(`footprint ${fp.libId} (${fp.ref}): no pad "${n}" for its net`);
  let placedAt = false;
  for (const it of lib.items.slice(2)) {
    const h = head(it);
    if (h && DROP.has(h)) continue;
    if (h && rot && UNSUPPORTED_ROTATED.has(h)) throw new Error(`footprint ${fp.libId}: rotating a footprint with ${h} items is not supported`);
    if (h === "property") {
      const p = it as List;
      const pname = atomStr(p, 1);
      const value = pname === "Reference" ? fp.ref : pname === "Value" ? fp.value : fields.get(pname ?? "") ?? atomStr(p, 2) ?? "";
      if (pname) fields.delete(pname);
      items.push(addAngle({ type: "list", items: [p.items[0]!, p.items[1]!, str(value), ...p.items.slice(3)] }, rot));
      continue;
    }
    if (h === "zone") {
      // Unlike other footprint items, zone outlines are stored in board coordinates in a
      // .kicad_pcb (KiCad reports lib_footprint_mismatch otherwise), so place them.
      items.push(placeXy(it as List, fp));
      continue;
    }
    if (h === "pad") {
      const net = nets.get(atomStr(it as List, 1) ?? "");
      const pad = addAngle(it as List, rot);
      items.push(net === undefined ? pad : withNet(pad, net));
      continue;
    }
    items.push(h && ANGLED.has(h) ? addAngle(it as List, rot) : it);
    if (h === "layer" && !placedAt) {
      items.push(uid("self"), l("at", nm(fp.at.x), nm(fp.at.y), fp.rot ? fp.rot : null));
      placedAt = true;
    }
  }
  const extra: Node[] = [];
  for (const [k, v] of fields) {
    extra.push(l("property", str(k), str(v), l("at", 0, 0, rot), l("layer", str("F.Fab")), l("hide", "yes"),
      uid(`field/${k}`), l("effects", l("font", l("size", 1, 1), l("thickness", 0.15)))));
  }
  if (fp.symbolUuid) extra.push(l("path", str(`/${fp.symbolUuid}`)), l("sheetname", str("/")), l("sheetfile", str(fp.sheetfile ?? "")));
  // Custom fields and the symbol link go after the library properties, before `attr`.
  const attrIdx = items.findIndex((n) => head(n) === "attr");
  items.splice(attrIdx < 0 ? items.length : attrIdx, 0, ...extra);
  if (!child({ type: "list", items }, "at")) throw new Error(`footprint ${fp.libId} has no (layer …) to anchor placement`);
  // Library items may carry UUIDs (e.g. a keep-out zone); two copies of one footprint must not
  // share them, so derive each from the footprint's reference and the item's position in it.
  let n = 0;
  const fresh = (node: Node): Node => {
    if (node.type !== "list") return node;
    if (head(node) === "uuid") return uid(`item/${n++}`);
    return { type: "list", items: node.items.map(fresh) };
  };
  const self = items.findIndex((x) => head(x) === "uuid");
  return { type: "list", items: items.map((x, i) => (i === self ? x : fresh(x))) };
}

export function emitBoard(spec: BoardSpec, generatorVersion: string): string {
  const { x, y, w, h } = spec.outline;
  const doc = l("kicad_pcb",
    l("version", PCB_FILE_VERSION),
    l("generator", str(TOOLCHAIN)),
    l("generator_version", str(generatorVersion)),
    l("general", l("thickness", spec.thicknessMm ?? 1.6), l("legacy_teardrops", "no")),
    l("paper", str("A4")),
    l("layers", ...(spec.copperLayers === 4 ? LAYERS_4 : LAYERS).map(([n, name, kind, user]) => l(n, str(name), kind, user !== undefined && str(user)))),
    l("setup", l("pad_to_mask_clearance", 0), l("allow_soldermask_bridges_in_footprints", "no"),
      l("tenting", l("front", "yes"), l("back", "yes"))),
    ...spec.footprints.map((fp) => place(fp, spec.name)),
    l("gr_rect", l("start", num(x), num(y)), l("end", num(x + w), num(y + h)),
      l("stroke", l("width", 0.05), l("type", "default")), l("fill", "no"), l("layer", str("Edge.Cuts")),
      l("uuid", str(uuidv5(`${spec.name}/outline`)))),
    ...(spec.texts ?? []).map((t) =>
      l("gr_text", str(t.text), l("at", num(t.x), num(t.y), 0), l("layer", str(t.layer ?? "F.SilkS")),
        l("uuid", str(uuidv5(`${spec.name}/text/${t.x},${t.y}`))),
        l("effects", l("font", l("size", t.size ?? 1.5, t.size ?? 1.5), l("thickness", 0.15))))),
    l("embedded_fonts", "no"),
  );
  return print(doc);
}
