// Geometric connectivity of a generated sheet, computed the way eeschema connects items:
// wire endpoints, pins and labels at the same point connect; wires that merely cross do not;
// local labels with the same text and power symbols with the same value join their points. Across the pages of a
// hierarchical design, global labels and power symbols join by name; local labels stay on their page.
//
// The builder splits every wire at each connection point lying on it, so connections only ever
// happen at endpoints; a point touching a wire's interior is reported as an error here instead
// of relying on how KiCad treats it.
import { add, libToSheet, onSegmentInterior, ptKey, type Pt } from "../kicad/geometry.ts";
import { pinsOfUnit } from "../kicad/symlib.ts";
import type { SheetIR, SheetPin } from "./ir.ts";

class UnionFind {
  private parent = new Map<string, string>();
  find(a: string): string {
    let p = this.parent.get(a) ?? a;
    if (p !== a) {
      p = this.find(p);
      this.parent.set(a, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
}

export function sheetPins(ir: SheetIR): SheetPin[] {
  const out: SheetPin[] = [];
  for (const unit of ir.units) {
    for (const pin of pinsOfUnit(unit.info, unit.unit)) {
      const inv = { x: -pin.inward.x, y: -pin.inward.y };
      out.push({ unit, pin, at: add(unit.at, libToSheet(pin.at, unit.rot, unit.mirror)), out: libToSheet(inv, unit.rot, unit.mirror) });
    }
  }
  return out;
}

export interface ComputedNet {
  /** Label texts and power names on this net (sorted). */
  names: string[];
  /** Real part pins as "REF.PIN" (sorted); power symbols and flags excluded. */
  pins: string[];
  /** Item count by kind, for diagnostics. */
  hasFlag: boolean;
}

export interface Connectivity {
  nets: ComputedNet[];
  /** Problems the geometry itself shows (interior touches, dangling wire ends). */
  problems: string[];
}

/** Connectivity of one sheet, or of all sheets of a hierarchical design together: within a sheet points connect
 *  geometrically and local labels by name; across sheets only global labels and power symbols connect, by name. */
export function computeConnectivity(sheets: SheetIR | SheetIR[]): Connectivity {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  const uf = new UnionFind();
  const problems: string[] = [];
  const members: { key: string; sp: SheetPin }[] = [];
  const named: { key: string; text: string }[] = [];

  list.forEach((ir, i) => {
    const where = ir.page ? `page ${ir.page.id}: ` : "";
    const pins = sheetPins(ir);
    const node = (p: Pt) => `p:${i}:${ptKey(p)}`;
    for (const w of ir.wires) uf.union(node(w.a), node(w.b));
    for (const l of ir.labels) uf.union(node(l.at), `label:${i}:${l.text}`);
    for (const l of ir.globalLabels) uf.union(node(l.at), `global:${l.text}`);
    for (const sp of pins) {
      if (sp.unit.kind === "power") uf.union(node(sp.at), `power:${sp.unit.value}`);
    }

    // Connection points that touch another wire's interior are ambiguous: forbid them.
    const points: { at: Pt; what: string }[] = [
      ...pins.map((sp) => ({ at: sp.at, what: `pin ${sp.unit.ref}.${sp.pin.number}` })),
      ...ir.labels.map((l) => ({ at: l.at, what: `label ${l.text}` })),
      ...ir.globalLabels.map((l) => ({ at: l.at, what: `global label ${l.text}` })),
      ...ir.wires.flatMap((w) => [{ at: w.a, what: "wire end" }, { at: w.b, what: "wire end" }]),
      ...ir.noConnects.map((at) => ({ at, what: "no-connect" })),
    ];
    for (const w of ir.wires) {
      for (const p of points) {
        if (onSegmentInterior(p.at, w.a, w.b)) problems.push(`${where}${p.what} at ${ptKey(p.at)} touches the middle of wire ${ptKey(w.a)}–${ptKey(w.b)}`);
      }
    }

    // Dangling wire ends: an endpoint shared with nothing else.
    const count = new Map<string, number>();
    const bump = (p: Pt) => count.set(ptKey(p), (count.get(ptKey(p)) ?? 0) + 1);
    for (const w of ir.wires) {
      bump(w.a);
      bump(w.b);
    }
    for (const sp of pins) bump(sp.at);
    for (const l of [...ir.labels, ...ir.globalLabels]) bump(l.at);
    for (const w of ir.wires) for (const p of [w.a, w.b]) if (count.get(ptKey(p)) === 1) problems.push(`${where}dangling wire end at ${ptKey(p)}`);

    for (const sp of pins) members.push({ key: node(sp.at), sp });
    for (const l of [...ir.labels, ...ir.globalLabels]) named.push({ key: node(l.at), text: l.text });
  });

  const groups = new Map<string, ComputedNet>();
  const get = (root: string) => {
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { names: [], pins: [], hasFlag: false }));
    return g;
  };
  for (const { key, sp } of members) {
    const g = get(uf.find(key));
    if (sp.unit.kind === "part") g.pins.push(`${sp.unit.ref}.${sp.pin.number}`);
    else if (sp.unit.kind === "flag") g.hasFlag = true;
    else if (!g.names.includes(sp.unit.value)) g.names.push(sp.unit.value);
  }
  for (const { key, text } of named) {
    const g = get(uf.find(key));
    if (!g.names.includes(text)) g.names.push(text);
  }
  const nets = [...groups.values()].map((g) => ({ ...g, names: g.names.sort(), pins: g.pins.sort() }));
  return { nets, problems };
}
