// The order package for one JLCPCB cart, build/<id>/order/: the board with its PCB Assembly files (from
// `bun run fab`) and ORDER.md with the order-form settings. ORDER.md is built from data only: module.yaml
// (settings, standoffs, notes), the lines JLCPCB places (the fab BOM, rebuilt from the schematic's netlist
// and checked against the file) and the parts' `preorder` and `order.previewCheck`. Only its own entries in
// the folder are replaced; anything else is kept and reported. It never uploads or orders anything.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { parseNetlistXml } from "../kicad/netlist-xml.ts";
import { paths } from "../lib/paths.ts";
import { loadAllParts } from "../module/load.ts";
import type { Part } from "../module/parts.ts";
import { assembledQty, JLCPCB, type BoardYaml } from "../module/schema.ts";
import { assemblyLines, bomCsv, type AssemblyLine } from "./bom.ts";
import { csv } from "./csv.ts";
import { staleInputs } from "./inputs.ts";

/** The files one cart needs, as `bun run fab` writes them. */
export interface OrderFiles {
  gerbers: string;
  bom: string;
  cpl: string;
}

/** What ORDER.md is built from besides module.yaml. */
export interface OrderContext {
  /** The lines JLCPCB places (the fab BOM). */
  lines: AssemblyLine[];
  parts: Map<string, Part>;
  /** Through-hole parts JLCPCB would place but the user solders (module.yaml `jlcpcb.tht: self`): what to buy. */
  selfSoldered?: AssemblyLine[];
}

const PCB_DIR = "pcb-with-assembly";
const ORDER_MD = "ORDER.md";
/** The shopping list of the through-hole parts the user solders (module.yaml `jlcpcb.tht: self`). */
const OWN_PARTS_CSV = "parts-you-solder.csv";
/** The entries of build/<id>/order/ that this tool owns. */
export const ORDER_ENTRIES = [PCB_DIR, ORDER_MD, OWN_PARTS_CSV] as const;
/** JLCPCB refunds a pre-order shortfall of fewer than 3 instead of buying it (docs/jlcpcb.md §10). */
const PREORDER_SPARE = 3;

export function orderFiles(id: string, rev: string, buildRoot: string = paths.build): OrderFiles {
  const fab = join(buildRoot, id, "fab", `rev-${rev}`);
  return {
    gerbers: join(fab, `${id}-rev${rev}-gerbers.zip`),
    bom: join(fab, `${id}-rev${rev}-bom.csv`),
    cpl: join(fab, `${id}-rev${rev}-cpl.csv`),
  };
}

/** Why the package can't be built yet: missing outputs, or outputs whose inputs changed since (inputs.json
 *  of `bun run fab`; file times are not trusted). */
export function orderProblems(id: string, files: OrderFiles): string[] {
  const rel = (f: string) => relative(paths.root, f);
  const problems: string[] = [];
  for (const f of Object.values(files)) {
    if (!existsSync(f)) problems.push(`${rel(f)} is missing (run bun run fab -- ${id})`);
  }
  if (existsSync(files.gerbers)) {
    const stale = staleInputs(dirname(files.gerbers));
    if (stale === null) problems.push(`${rel(dirname(files.gerbers))} has no inputs.json, so it can't be matched to the sources (run bun run fab -- ${id})`);
    else if (stale.length) problems.push(`changed since bun run fab: ${stale.join(", ")} (run bun run fab -- ${id})`);
  }
  return problems;
}

/** The placed lines, from the schematic's netlist (`bun run sch` writes it) and the parts, checked against
 *  the fab BOM so ORDER.md describes exactly what was uploaded. */
export function orderContext(id: string, m: BoardYaml, files: OrderFiles, o: { buildRoot?: string; partsDir?: string } = {}): { ctx?: OrderContext; problems: string[] } {
  const netXml = join(o.buildRoot ?? paths.build, id, `${id}.net.xml`);
  if (!existsSync(netXml)) return { problems: [`${relative(paths.root, netXml)} is missing (run bun run sch -- ${id})`] };
  const parts = loadAllParts(o.partsDir ?? paths.parts);
  const { components } = parseNetlistXml(readFileSync(netXml, "utf8"));
  const { lines, problems } = assemblyLines(components, parts, { tht: m.jlcpcb.tht, handSolder: m.jlcpcb.handSolder });
  if (existsSync(files.bom) && readFileSync(files.bom, "utf8") !== bomCsv(lines)) {
    problems.push(`${relative(paths.root, files.bom)} differs from the schematic's netlist and the parts (run bun run fab -- ${id})`);
  }
  if (problems.length) return { problems };
  // With `tht: self` the through-hole parts are in no file: ORDER.md lists them as what the user buys.
  const placed = new Set(lines.map((l) => l.ref));
  const selfSoldered = m.jlcpcb.tht === "self"
    ? assemblyLines(components, parts, { tht: "jlcpcb", handSolder: m.jlcpcb.handSolder }).lines.filter((l) => !placed.has(l.ref))
    : [];
  return { ctx: { lines, parts, ...(selfSoldered.length && { selfSoldered }) }, problems };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const count = (n: number) => WORDS[n] ?? String(n);

/** "A", "A and B", "A, B and C". */
const listText = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A list item wrapped at `width`, continuation lines indented to the item text. */
function item(marker: string, text: string, width = 118): string {
  const indent = " ".repeat(marker.length + 1);
  const out: string[] = [];
  let line = `${marker} `;
  for (const word of text.split(" ")) {
    if (line.length + word.length > width && line.trim() !== marker) {
      out.push(line.trimEnd());
      line = indent;
    }
    line += `${word} `;
  }
  out.push(line.trimEnd());
  return out.join("\n");
}

interface Group {
  refs: string[];
  line: AssemblyLine;
  part: Part | undefined;
}

/** Lines grouped by part and value, in BOM order (default: the placed lines). */
function groups(ctx: OrderContext, lines: AssemblyLine[] = ctx.lines): Group[] {
  const byKey = new Map<string, Group>();
  for (const ln of lines) {
    const key = `${ln.partKey}|${ln.value}|${ln.lcsc}`;
    const g = byKey.get(key);
    if (g) g.refs.push(ln.ref);
    else byKey.set(key, { refs: [ln.ref], line: ln, part: ctx.parts.get(ln.partKey) });
  }
  return [...byKey.values()];
}

/** ORDER.md for one cart: the board with its PCB Assembly files. */
export function orderMarkdown(id: string, m: BoardYaml, files: OrderFiles, ctx: OrderContext): string {
  const rev = m.revision.rev;
  const qty = m.jlcpcb.qty;
  // Assembled boards; a board may order more PCBs than JLCPCB assembles (jlcpcb.assembleQty).
  const asmQty = assembledQty(m.jlcpcb);
  const side = m.jlcpcb.smtSide === "bottom" ? "Bottom" : "Top";
  const hand = m.jlcpcb.handSolder;
  const g = (f: string) => basename(f);
  const placed = groups(ctx);
  const outline = `${m.pcb.sizeMm.w} × ${m.pcb.sizeMm.h} mm, `;
  const copper = `${m.pcb.copperOz} oz outer copper, `;
  // A 4-layer board names the stackup its board file describes (JLCPCB.stackup4).
  const s4 = JLCPCB.stackup4;
  const layers = m.pcb.layers === 4 ? `4 layers, stackup ${s4.name} (${s4.thicknessMm} mm, inner copper 0.5 oz: the one the board file describes, ${s4.source}), ` : "2 layers, ";
  const bare = qty - asmQty;
  const steps: string[] = [
    `Drop \`${g(files.gerbers)}\` on the quote page.`,
    `Settings: FR-4, ${layers}${outline}${m.pcb.thicknessMm} mm, ${copper}qty ${qty}, ${m.pcb.mask} mask, lead-free HASL, Mark on PCB: ${m.jlcpcb.removeOrderNumber ? "Remove Mark" : "JLCPCB's default"}.`,
    `Switch on **PCB Assembly**: ${m.jlcpcb.assembly === "economic" ? "Economic" : "Standard"}, assembly side **${side}**, qty ${asmQty} (Economic allows 2 as the minimum)` +
      (bare > 0 ? `; the other ${count(bare)} PCB${bare > 1 ? "s" : ""} arrive${bare > 1 ? "" : "s"} bare.` : "."),
    `Upload \`${g(files.bom)}\` (BOM) and \`${g(files.cpl)}\` (CPL).`,
  ];

  // Pre-orders: parts JLCPCB sells as pre-order only.
  const pre = placed.filter((x) => x.part?.values[x.line.value]?.preorder);
  if (pre.length) {
    const noun = (x: Group) => `${x.line.value} parts`;
    const what = pre.map((x, i) => `${i ? " **and the " : "**pre-order the "}${noun(x)}** (${x.line.lcsc})`).join("");
    const counts = pre.map((x) => x.refs.length * asmQty + PREORDER_SPARE);
    const atLeast = counts.every((c) => c === counts[0])
      ? `at least ${counts[0]}${pre.length > 1 ? " of each" : ""}`
      : `at least ${listText(pre.map((x, i) => `${counts[i]} ${noun(x)}`))}`;
    steps.push(`Before this order: ${what}, ${atLeast} for ${asmQty} boards: JLCPCB refunds a shortfall of fewer than ${PREORDER_SPARE} instead of buying it. ` +
      "They go into your JLCPCB parts stock; JLCPCB confirms the price within 48 h, and the PCBA order can use them once they arrived (docs/jlcpcb.md §10).");
  }

  // Through-hole parts JLCPCB solders: the two open questions of the quote check.
  if (placed.some((x) => x.part?.assembly === "tht")) {
    const economicSplit = m.jlcpcb.assembly === "economic" && m.jlcpcb.smtSide === "bottom";
    steps.push("In the parts step, note whether the Extended-part fee is charged on the through-hole lines" +
      (economicSplit ? `, and whether the order stays **Economic** with SMD on the ${side.toLowerCase()} and THT on the other side (docs/jlcpcb.md §7, §14).` : " (docs/jlcpcb.md §14)."));
  }

  // Order remark: parts JLCPCB seats on spacers.
  const remark: string[] = [];
  const standoffRefs = Object.keys(m.jlcpcb.standoffs);
  if (standoffRefs.length && m.jlcpcb.spacer) {
    const sp = m.jlcpcb.spacer;
    for (const x of placed) {
      const refs = x.refs.filter((r) => r in m.jlcpcb.standoffs);
      const heights = [...new Set(refs.map((r) => m.jlcpcb.standoffs[r]!))];
      for (const h of heights) {
        const these = refs.filter((r) => m.jlcpcb.standoffs[r] === h);
        remark.push(`Assembly Standoffs: ${listText(these)} (${x.line.value}, ${x.line.lcsc}) seated on a ${h} mm tall spacer (Ø${sp.diameterMm} mm), ` +
          `leads through the spacer, part body ${h.toFixed(1)} mm above the PCB top.`);
      }
    }
    remark.push(`Preferred spacer ${sp.lcsc} (${sp.name}), equivalent allowed.`);
  }
  if (remark.length) steps.push(`Order remark (JLCPCB "Assembly Standoffs" service, docs/pcb.md): "${remark.join(" ")}"`);

  // What to check in the placement preview.
  const checks = placed.filter((x) => x.part?.order?.previewCheck).map((x) => `${x.part!.order!.previewCheck} of ${listText(x.refs)} (${x.line.value})`);
  if (checks.length) steps.push(`In the placement preview, check ${listText(checks)}.`);

  // Parts the user solders.
  if (hand.length) steps.push(`Left out on purpose — you solder these yourself: ${hand.join(", ")}.`);

  // Through-hole parts the user buys and solders (jlcpcb.tht: self): JLCPCB ships no loose parts.
  const own = groups(ctx, ctx.selfSoldered ?? []);
  if (own.length) {
    const name = (x: Group) => {
      const maker = x.part?.values[x.line.value]?.manufacturer;
      const id = [maker && x.line.mpn ? `${maker} ${x.line.mpn}` : x.line.mpn, x.line.lcsc && `LCSC ${x.line.lcsc}`].filter(Boolean).join(", ");
      return `${x.refs.length} × ${x.line.value}${id ? ` (${id})` : ""}`;
    };
    steps.push(`Left out on purpose — you solder the through-hole parts yourself (module.yaml \`jlcpcb.tht: self\`). Per board: ${listText(own.map(name))}. ` +
      `For the ${asmQty} assembled boards: ${listText(own.map((x) => String(x.refs.length * asmQty)))}. JLCPCB ships no loose parts with a PCBA order (docs/jlcpcb.md §10): ` +
      `buy them from another shop. \`${OWN_PARTS_CSV}\` is that list as a file; LCSC sells these part numbers.`);
  }

  const beforePay = [
    "Merchandise at or below about USD 60 ships by Global Standard Direct Line (it takes carts up to USD 65) and stays under the CHF 5 Swiss import-tax threshold; above that, import VAT and a clearance fee are due (docs/jlcpcb.md §11).",
    ...(m.order?.notes ?? []),
  ];
  const stepList = steps.map((s, i) => item(`${i + 1}.`, s)).join("\n");
  const payList = beforePay.map((b) => item("-", b)).join("\n");

  return `# ${id} rev ${rev}: one JLCPCB cart

Drag and drop these files at https://cart.jlcpcb.com/quote. One board goes into this cart.
**The tools never upload or order anything.**

## 1. PCB with PCB Assembly — \`${PCB_DIR}/\`

${stepList}

## 2. Before you pay

${payList}
`;
}

/** Writes the package into `out`. Replaces only ORDER_ENTRIES; returns the files written and the foreign
 *  entries that were kept (for example a screenshot the user put there). */
export function writeOrderPackage(id: string, m: BoardYaml, files: OrderFiles, ctx: OrderContext, out: string): { written: string[]; kept: string[] } {
  mkdirSync(out, { recursive: true });
  for (const e of ORDER_ENTRIES) rmSync(join(out, e), { recursive: true, force: true });
  const kept = readdirSync(out).sort();
  const pcbDir = join(out, PCB_DIR);
  mkdirSync(pcbDir, { recursive: true });
  const written: string[] = [];
  for (const f of [files.gerbers, files.bom, files.cpl]) {
    copyFileSync(f, join(pcbDir, basename(f)));
    written.push(join(pcbDir, basename(f)));
  }
  writeFileSync(join(out, ORDER_MD), orderMarkdown(id, m, files, ctx));
  written.push(join(out, ORDER_MD));
  const own = ownPartsCsv(m, ctx);
  if (own) {
    writeFileSync(join(out, OWN_PARTS_CSV), own);
    written.push(join(out, OWN_PARTS_CSV));
  }
  return { written, kept };
}

/** The through-hole parts the user buys and solders, as a shopping list: one row per part with the quantity
 *  for the assembled boards. Undefined when JLCPCB solders them. */
export function ownPartsCsv(m: BoardYaml, ctx: OrderContext): string | undefined {
  const own = groups(ctx, ctx.selfSoldered ?? []);
  if (!own.length) return undefined;
  const n = assembledQty(m.jlcpcb);
  return csv([
    ["LCSC Part Number", "Manufacturer Part Number", "Manufacturer", "Description", "Designators", "Per board", "Quantity"],
    ...own.map((x) => [
      x.line.lcsc,
      x.line.mpn,
      x.part?.values[x.line.value]?.manufacturer ?? "",
      x.part?.description ?? x.line.value,
      x.refs.join(" "),
      String(x.refs.length),
      String(x.refs.length * n),
    ]),
  ]);
}
