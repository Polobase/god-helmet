// JLCPCB assembly BOM from the schematic's KiCad XML netlist.
// Header per https://jlcpcb.com/help/article/how-to-generate-the-bom-and-centroid-file-from-kicad
// (KiCad 10 guide): Comment, Designator, Footprint, JLCPCB Part #. One line per
// (value, footprint, part number), every designator listed individually (no R1-R4 ranges).
import type { NetlistComponent } from "../kicad/netlist-xml.ts";
import type { Part } from "../module/parts.ts";
import { csv } from "./csv.ts";

export const BOM_HEADER = ["Comment", "Designator", "Footprint", "JLCPCB Part #"];

export interface AssemblyLine {
  ref: string;
  value: string;
  footprint: string;
  lcsc: string;
  mpn: string;
  partKey: string;
  /** THT part the user ships to JLCPCB (module.yaml jlcpcb.tht: consign). */
  consigned: boolean;
  verified: boolean;
  /** The part's own CPL rotation correction (parts/*.yaml `cplRotation`), when it has one. */
  cplRotation?: number;
}

export interface AssemblyPolicy {
  /** Who solders the THT parts (module.yaml jlcpcb.tht): "self" leaves them out of BOM and CPL;
   *  "jlcpcb" and "consign" have JLCPCB place them, from its stock or from parts the user
   *  consigned. */
  tht: "self" | "jlcpcb" | "consign";
  /** Refs the user solders (module.yaml jlcpcb.handSolder): never in the BOM or CPL. */
  handSolder?: string[];
}

const naturalRef = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Components JLCPCB places: real parts (PartKey field), not DNP / excluded from BOM, whose
 * parts-DB assembly is smt (or tht unless the user solders THT). Hand-soldered parts and board
 * features that are no parts (assembly "none": solder jumpers, test pads, mounting holes) are left out.
 *
 * Verified means the parts DB records where and when the number was checked and the schematic
 * carries that number. JLCPCB lines need the LCSC number. Consigned lines need the LCSC number
 * or, failing that, the MPN: JLCPCB matches own parts "with MFR. Part number or JLCPCB Part
 * number" (https://jlcpcb.com/help/article/how-to-use-my-own-parts-for-pcb-assembly-order).
 */
export function assemblyLines(components: NetlistComponent[], parts: Map<string, Part>, policy: AssemblyPolicy): { lines: AssemblyLine[]; problems: string[] } {
  const lines: AssemblyLine[] = [];
  const problems: string[] = [];
  for (const c of components) {
    const key = c.fields.PartKey;
    if (!key) continue; // not a generated part (e.g. mounting hole)
    if ("dnp" in c.properties || "exclude_from_bom" in c.properties) continue;
    const part = parts.get(key);
    if (!part) {
      problems.push(`${c.ref}: parts/${key}.yaml not found`);
      continue;
    }
    if (part.assembly === "none" || part.assembly === "hand" || (part.assembly === "tht" && policy.tht === "self")) continue;
    if (policy.handSolder?.includes(c.ref)) continue;
    const src = part.values[c.value];
    if (!src) problems.push(`${c.ref}: value ${c.value} not in parts/${key}.yaml`);
    const consigned = part.assembly === "tht" && policy.tht === "consign";
    const lcsc = c.fields.LCSC ?? "";
    const mpn = c.fields.MPN ?? "";
    const lcscOk = Boolean(src?.lcsc && src.lcsc === lcsc);
    const mpnOk = Boolean(src?.mpn && src.mpn === mpn);
    lines.push({
      ref: c.ref,
      value: c.value,
      footprint: c.footprint.slice(c.footprint.indexOf(":") + 1),
      lcsc,
      mpn,
      partKey: key,
      consigned,
      verified: Boolean(src?.verified) && (consigned && !src?.lcsc ? mpnOk : lcscOk),
      ...(src?.cplRotation !== undefined && { cplRotation: src.cplRotation }),
    });
  }
  return { lines: lines.sort((a, b) => naturalRef(a.ref, b.ref)), problems };
}

/**
 * The `JLCPCB Part #` cell: the LCSC number or, when the part has none, its MPN, as the Fabrication
 * Toolkit fills its part-number column (plugins/process.py @642b069, _get_mpn_from_footprint).
 * Which column JLCPCB matches consigned parts by is not documented (docs/jlcpcb.md §4).
 */
export const partNumber = (ln: AssemblyLine): string => ln.lcsc || ln.mpn;

export function bomCsv(lines: AssemblyLine[]): string {
  const groups = new Map<string, AssemblyLine[]>();
  for (const ln of lines) {
    const k = [ln.value, ln.footprint, partNumber(ln)].join("\u0000");
    groups.set(k, [...(groups.get(k) ?? []), ln]);
  }
  const rows = [...groups.values()]
    .map((g) => [g[0]!.value, g.map((x) => x.ref).sort(naturalRef).join(","), g[0]!.footprint, partNumber(g[0]!)])
    .sort((a, b) => naturalRef(a[1]!, b[1]!));
  return csv([BOM_HEADER, ...rows]);
}
