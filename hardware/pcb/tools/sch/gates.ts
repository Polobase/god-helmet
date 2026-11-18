// The `bun run sch -- <id>` gate chain. A schematic is only ready for review when every gate
// passes: build checks → emit → self-parse → ERC (0 errors, 0 warnings) → netlist round-trip
// (nets, symbol UUIDs and sheet paths equal the design) → PDF export (one page per sheet) → review.md.
// A design with pages is checked through its root file: kicad-cli loads the whole hierarchy from it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { sha256File } from "../lib/hash.ts";
import { pdfPageCount } from "../lib/pdf.ts";
import { buildDir, paths } from "../lib/paths.ts";
import { run } from "../lib/proc.ts";
import { kicadCli, KiCadExit, requireKicadCli } from "../kicad/cli.ts";
import { ErcReport, summarizeErc } from "../kicad/erc-report.ts";
import { parseNetlistXml } from "../kicad/netlist-xml.ts";
import { sheetUuid, uuidv5 } from "../kicad/uuid.ts";
import { parse } from "../sexpr/sexpr.ts";
import { sheetsOf } from "./build.ts";
import { schematicSha256, strayPageFiles } from "./files.ts";
import { generate, loadDesign, type Generated } from "./generate.ts";
import type { DesignInput } from "./dsl.ts";
import type { SheetIR } from "./ir.ts";

export class GateError extends Error {
  constructor(readonly gate: string, readonly details: string[]) {
    super(`gate "${gate}" failed:\n  - ${details.join("\n  - ")}`);
    this.name = "GateError";
  }
}

export async function gitSha(): Promise<string> {
  const head = await run(["git", "rev-parse", "--short=12", "HEAD"], { cwd: paths.root });
  if (head.code !== 0) return "no-git";
  const dirty = await run(["git", "status", "--porcelain"], { cwd: paths.root });
  return head.stdout.trim() + (dirty.stdout.trim() ? "-dirty" : "");
}

/** Write generator-owned files (and the project file when missing), and delete page files of pages the design no
 *  longer has. Returns changed paths. */
export function writeGenerated(g: Generated): string[] {
  mkdirSync(g.kicadDir, { recursive: true });
  const changed: string[] = [];
  for (const file of strayPageFiles(g.kicadDir, g.id, g.schPaths)) {
    rmSync(file);
    changed.push(file);
  }
  for (const [file, content] of g.files) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) {
      writeFileSync(file, content);
      changed.push(file);
    }
  }
  for (const [file, content] of g.createIfMissing) {
    if (!existsSync(file)) {
      writeFileSync(file, content);
      changed.push(file);
    }
  }
  return changed;
}

export interface ErcOutcome {
  errors: number;
  warnings: number;
  /** Violations hidden by erc_exclusions in the .kicad_pro (they fail the gate too). */
  excluded: number;
  types: string[];
  /** All ignored rules, and those beyond KiCad's defaults (switched off in the .kicad_pro). */
  ignored: string[];
  extraIgnored: string[];
  kicadVersion: string;
  jsonPath: string;
  rptPath: string;
}

export async function runErc(schPath: string, outDir: string, configHome?: string): Promise<ErcOutcome> {
  mkdirSync(outDir, { recursive: true });
  const base = join(outDir, "erc");
  const common = ["--units", "mm", "--severity-error", "--severity-warning"];
  const opts = { okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS], ...(configHome && { configHome }) };
  await kicadCli(["sch", "erc", "--format", "json", ...common, "--severity-exclusions", "--exit-code-violations", "-o", `${base}.json`, schPath], opts);
  await kicadCli(["sch", "erc", "--format", "report", ...common, "-o", `${base}.rpt`, schPath], opts);
  const report = ErcReport.parse(JSON.parse(readFileSync(`${base}.json`, "utf8")));
  const s = summarizeErc(report);
  return {
    errors: s.errors, warnings: s.warnings, excluded: s.excluded, types: s.types, ignored: s.ignored, extraIgnored: s.extraIgnored,
    kicadVersion: report.kicad_version, jsonPath: `${base}.json`, rptPath: `${base}.rpt`,
  };
}

/** Why an ERC outcome fails the 0/0 gate (empty = passes). */
export function ercGateProblems(erc: ErcOutcome): string[] {
  const out: string[] = [];
  if (erc.errors + erc.warnings > 0) out.push(`${erc.errors} errors, ${erc.warnings} warnings (${erc.types.join(", ")})`);
  if (erc.excluded > 0) out.push(`${erc.excluded} violation(s) hidden by ERC exclusions in the .kicad_pro; exclusions are not allowed`);
  if (erc.extraIgnored.length) out.push(`ERC rules switched to "ignore" in the .kicad_pro: ${erc.extraIgnored.join(", ")}; the gate needs KiCad's default severities`);
  return out;
}

/** The sheet path KiCad gives the symbols of a sheet: names ("/", "/<title>/") and UUIDs ("/", "/<sheet>/"). */
export function sheetPathOf(sheet: SheetIR): { names: string; tstamps: string } {
  return sheet.page ? { names: `/${sheet.page.title}/`, tstamps: `/${sheetUuid(sheet.project, sheet.page.id)}/` } : { names: "/", tstamps: "/" };
}

/** Compare KiCad's netlist with the design: same components, footprints, symbol UUIDs, sheet paths, nets. */
export function compareNetlist(g: Generated, xml: string): string[] {
  const problems: string[] = [];
  const { components, nets } = parseNetlistXml(xml);
  const byRef = new Map(components.map((c) => [c.ref, c]));
  const sheets = sheetsOf(g.build);
  for (const b of g.build.bom) {
    const c = byRef.get(b.ref);
    if (!c) {
      problems.push(`component ${b.ref} missing from KiCad netlist`);
      continue;
    }
    if (c.value !== b.value) problems.push(`${b.ref}: value ${c.value} != ${b.value}`);
    if (c.footprint !== b.footprint) problems.push(`${b.ref}: footprint ${c.footprint} != ${b.footprint}`);
    // KiCad lists a part once, from the first sheet (root, then pages in page order) that holds one of its units,
    // with the UUIDs of the units on that sheet (NETLIST_EXPORTER_XML::makeSymbols).
    const home = sheets.find((s) => s.units.some((u) => u.kind === "part" && u.ref === b.ref));
    const want = (home?.units ?? []).filter((u) => u.kind === "part" && u.ref === b.ref).map((u) => uuidv5(u.uuidName)).sort();
    if (c.tstamps.slice().sort().join() !== want.join()) problems.push(`${b.ref}: symbol UUIDs ${c.tstamps.join(" ")} != expected ${want.join(" ")}`);
    const path = home ? sheetPathOf(home) : undefined;
    if (path && (c.sheetpath.names !== path.names || c.sheetpath.tstamps !== path.tstamps)) {
      problems.push(`${b.ref}: sheet path ${c.sheetpath.names} (${c.sheetpath.tstamps}) != expected ${path.names} (${path.tstamps})`);
    }
  }
  for (const c of components) if (!g.build.bom.some((b) => b.ref === c.ref)) problems.push(`unexpected component ${c.ref} in KiCad netlist`);

  const key = (n: { ref: string; pin: string }) => `${n.ref}.${n.pin}`;
  for (const e of g.build.nets) {
    const hits = nets.filter((n) => n.nodes.some((x) => e.pins.includes(key(x))));
    if (hits.length !== 1) {
      problems.push(`net ${e.name}: its pins are spread over ${hits.length} KiCad nets (${hits.map((h) => h.name).join(", ")})`);
      continue;
    }
    const got = hits[0]!.nodes.map(key).sort();
    if (got.join() !== e.pins.join()) problems.push(`net ${e.name}: KiCad has [${got.join(", ")}], design has [${e.pins.join(", ")}]`);
    const name = hits[0]!.name;
    if (!g.build.pages.length) {
      const labelled = e.power || g.build.ir.labels.some((lb) => lb.text === e.name);
      if (labelled && name !== e.name && name !== `/${e.name}`) problems.push(`net ${e.name}: KiCad names it ${name}`);
      continue;
    }
    // Power and global-label nets keep their name; a local label is scoped to its page ("/<title>/<name>").
    const local = sheets.find((s) => s.labels.some((lb) => lb.text === e.name));
    const global = e.power || sheets.some((s) => s.globalLabels.some((lb) => lb.text === e.name));
    const want = global ? e.name : local ? `${sheetPathOf(local).names}${e.name}` : undefined;
    if (want !== undefined && name !== want) problems.push(`net ${e.name}: KiCad names it ${name}, expected ${want}`);
  }
  for (const nc of g.build.noConnect) {
    const hit = nets.find((n) => n.nodes.some((x) => key(x) === nc));
    if (hit && hit.nodes.length > 1) problems.push(`no-connect pin ${nc} is on net ${hit.name} with other pins`);
  }
  return problems;
}

/** Written to build/<id>/gates.json only after every gate passed; sch:approve checks it. */
export interface GateRecord {
  schematic: string;
  /** sha256 of the schematic: of the root file, or of the root and every page (tools/sch/files.ts). */
  schSha256: string;
  inputSha256: string;
  pdf: string;
  pdfSha256: string;
  kicadVersion: string;
  git: string;
  erc: { errors: 0; warnings: 0; ignored: string[] };
}

export const gateRecordPath = (id: string) => join(buildDir(id), "gates.json");

/** Review PDF: KiCad's default colours on a white page (--no-background-color, user preference),
 *  with the git SHA filled into the title block. */
export async function exportSchematicPdf(schPath: string, pdfPath: string, gitSha: string, configHome?: string) {
  await kicadCli(["sch", "export", "pdf", "--no-background-color", "-D", `GIT_SHA=${gitSha}`, "-o", pdfPath, schPath], configHome ? { configHome } : {});
}

/** The review PDF must hold every sheet: the root and each page (kicad-cli has dropped sheets before: #25198). */
export function pdfPageProblems(pdfPath: string, sheets: number): string[] {
  let pages: number;
  try {
    pages = pdfPageCount(readFileSync(pdfPath));
  } catch (e) {
    return [`${pdfPath}: ${(e as Error).message}`];
  }
  return pages === sheets ? [] : [`the PDF has ${pages} page(s), the schematic ${sheets} sheet(s)`];
}

export interface GateReport {
  id: string;
  schPath: string;
  /** Every schematic file: the root, then the pages. */
  schPaths: string[];
  erc: ErcOutcome;
  netlistPath: string;
  pdfPath: string;
  reviewPath: string;
  changed: string[];
}

export interface SchGateOptions {
  configHome?: string;
  /** The design instead of modules/<id>/schematic.ts, written to `kicadDir` with its outputs in `buildDir` (tests). */
  design?: DesignInput;
  kicadDir?: string;
  buildDir?: string;
}

export async function runSchGates(id: string, opts: SchGateOptions = {}): Promise<GateReport> {
  const { version } = await requireKicadCli();
  const out = opts.buildDir ?? buildDir(id);
  const pdfPath = join(out, `${id}-schematic.pdf`);
  const reviewPath = join(out, "review.md");
  const recordPath = join(out, "gates.json");
  // Outputs of an earlier passing run must not survive a failing one.
  for (const f of [pdfPath, reviewPath, recordPath]) rmSync(f, { force: true });

  // throws BuildError with every design problem
  const g = generate(id, opts.design ?? (await loadDesign(id)), opts.kicadDir ? { dir: opts.kicadDir } : {});
  const changed = writeGenerated(g);
  for (const f of g.schPaths) parse(readFileSync(f, "utf8"), f); // self-parse: fail with line:col, not "exit 3"

  const erc = await runErc(g.schPath, out, opts.configHome);
  if (erc.kicadVersion !== version) throw new GateError("erc", [`report from KiCad ${erc.kicadVersion}, expected ${version}`]);
  const ercProblems = ercGateProblems(erc);
  if (ercProblems.length) throw new GateError("erc", [...ercProblems, `details: ${relative(paths.root, erc.rptPath)}`]);

  const netlistPath = join(out, `${id}.net.xml`);
  await kicadCli(["sch", "export", "netlist", "--format", "kicadxml", "-o", netlistPath, g.schPath], opts.configHome ? { configHome: opts.configHome } : {});
  const netProblems = compareNetlist(g, readFileSync(netlistPath, "utf8"));
  if (netProblems.length) throw new GateError("netlist round-trip", netProblems);

  const sha = await gitSha();
  await exportSchematicPdf(g.schPath, pdfPath, sha, opts.configHome);
  const pdfProblems = pdfPageProblems(pdfPath, g.schPaths.length);
  if (pdfProblems.length) {
    rmSync(pdfPath, { force: true });
    throw new GateError("pdf", pdfProblems);
  }

  writeFileSync(reviewPath, reviewMarkdown(g, erc, sha, version, pdfPath));
  const record: GateRecord = {
    schematic: relative(paths.root, g.schPath),
    schSha256: schematicSha256(g.schPath),
    inputSha256: g.build.inputSha,
    pdf: relative(paths.root, pdfPath),
    pdfSha256: sha256File(pdfPath),
    kicadVersion: version,
    git: sha,
    erc: { errors: 0, warnings: 0, ignored: erc.ignored },
  };
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  return { id, schPath: g.schPath, schPaths: g.schPaths, erc, netlistPath, pdfPath, reviewPath, changed };
}

export function reviewMarkdown(g: Generated, erc: ErcOutcome, sha: string, version: string, pdfPath: string): string {
  const b = g.build;
  // Board features (solder jumpers, test pads, mounting holes) are no parts: nothing to verify.
  const unverified = b.bom.filter((x) => !x.verified && !x.feature);
  const paged = b.pages.length > 0;
  const pageNo = new Map(b.pages.map((p) => [p.page!.id, p.page!.number]));
  const onPages = (ids: string[]) => ids.map((id) => pageNo.get(id)).join(", ");
  const lines = [
    `# Schematic review: ${g.id}`,
    "",
    `- Schematic: \`${relative(paths.root, g.schPath)}\`${paged ? ` and ${b.pages.length} pages` : ""} (input sha256 \`${b.inputSha.slice(0, 12)}\`, git \`${sha}\`)`,
    `- PDF: \`${relative(paths.root, pdfPath)}\`${paged ? ` (${g.schPaths.length} pages: the root sheet, then one per page)` : ""}`,
    `- KiCad: ${version}`,
    `- ERC: **${erc.errors} errors, ${erc.warnings} warnings**, no exclusions; ignored rules are KiCad's defaults only (${erc.ignored.join(", ")})`,
    `- Netlist round-trip: nets, footprints, values and symbol UUIDs${paged ? " and sheet paths" : ""} match the design`,
    ...(paged
      ? [
        "",
        "## Pages",
        "",
        "| Page | Title | File | Paper | Parts |",
        "|---|---|---|---|---|",
        `| 1 | (root: sheet symbols) | ${g.id}.kicad_sch | ${b.ir.paper} | |`,
        ...b.pages.map((p) => `| ${p.page!.number} | ${p.page!.title} | ${p.page!.file} | ${p.paper} | ${new Set(p.units.filter((u) => u.kind === "part").map((u) => u.ref)).size} |`),
      ]
      : []),
    "",
    "## Nets",
    "",
    ...(paged
      ? [
        "Pages are page numbers; a net on more than one page is joined by global labels (power nets by power symbols).",
        "",
        "| Net | Pages | Pins |",
        "|---|---|---|",
        ...b.nets.map((n) => `| ${n.name}${n.power ? " (power)" : ""} | ${onPages(n.pages)} | ${n.pins.join(", ")} |`),
      ]
      : [
        "| Net | Pins |",
        "|---|---|",
        ...b.nets.map((n) => `| ${n.name}${n.power ? " (power)" : ""} | ${n.pins.join(", ")} |`),
      ]),
    ...(b.noConnect.length ? ["", `No-connect: ${b.noConnect.join(", ")}`] : []),
    "",
    "## BOM",
    "",
    ...(paged
      ? [
        "| Ref | Value | Part | Footprint | LCSC | Sourcing | Pages |",
        "|---|---|---|---|---|---|---|",
        ...b.bom.map((x) => `| ${x.ref} | ${x.value} | ${x.partKey} | ${x.footprint.split(":")[1]} | ${x.lcsc ?? "—"} | ${x.feature ? "no part" : x.verified ? "verified" : "**UNVERIFIED**"} | ${onPages(x.pages)} |`),
      ]
      : [
        "| Ref | Value | Part | Footprint | LCSC | Sourcing |",
        "|---|---|---|---|---|---|",
        ...b.bom.map((x) => `| ${x.ref} | ${x.value} | ${x.partKey} | ${x.footprint.split(":")[1]} | ${x.lcsc ?? "—"} | ${x.feature ? "no part" : x.verified ? "verified" : "**UNVERIFIED**"} |`),
      ]),
    "",
    unverified.length
      ? `**${unverified.length} part(s) have unverified sourcing** (${unverified.map((x) => x.ref).join(", ")}). Check them at https://jlcpcb.com/parts before fab.`
      : "All parts have verified sourcing.",
    "",
  ];
  mkdirSync(dirname(pdfPath), { recursive: true });
  return lines.join("\n");
}
