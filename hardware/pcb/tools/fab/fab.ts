// JLCPCB fab export (never uploads, never orders). Every check runs before an order file is
// written: module.yaml → approval → DRC (zones refilled; exclusions and extra ignored checks
// refused) → netlist, BOM and sourcing → placements. Only then Gerbers + Excellon drill, BOM,
// CPL, zip and README go into a staging folder, which replaces build/<id>/fab/<DRAFT|rev-R>/
// once everything passed. A refused run leaves no order files behind. See docs/jlcpcb.md.
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { zipSync } from "fflate";
import { paths, projectDir } from "../lib/paths.ts";
import { kicadCli } from "../kicad/cli.ts";
import { runDrc, type DrcSummary } from "../kicad/drc.ts";
import { parseNetlistXml } from "../kicad/netlist-xml.ts";
import { displayPath, formatIssue, loadAllParts, loadProject, partFiles, ValidationError } from "../module/load.ts";
import { MODULE_ID_RE, type BoardYaml } from "../module/schema.ts";
import { assemblyLines, bomCsv, type AssemblyLine } from "./bom.ts";
import { cplCsv, cplLines, describeDispute, loadCorrections, norm, parsePos, type CplLine, type Placement } from "./cpl.ts";
import { schematicFiles, schematicSha256 } from "../sch/files.ts";
import { writeInputs } from "./inputs.ts";
import { placementPoint, readBoard, type BoardPart } from "./placement.ts";

export const GERBER_LAYERS = ["F.Cu", "B.Cu", "F.Paste", "B.Paste", "F.SilkS", "B.SilkS", "F.Mask", "B.Mask", "Edge.Cuts"];

/** The Gerber layers of a board with this many copper layers: a 4-layer board adds In1.Cu and In2.Cu. */
export function gerberLayers(copperLayers: 2 | 4): string[] {
  return copperLayers === 4 ? ["F.Cu", "In1.Cu", "In2.Cu", ...GERBER_LAYERS.slice(1)] : GERBER_LAYERS;
}

/** The copper layers a board file declares in its (layers …) table. */
export function boardCopperLayers(boardText: string): number {
  const table = /\n\t\(layers\n([\s\S]*?)\n\t\)/.exec(boardText);
  if (!table) throw new Error("the board file has no (layers …) table");
  return [...table[1]!.matchAll(/^\t\t\(\d+ "[^"]+\.Cu"/gm)].length;
}

export class FabError extends Error {
  constructor(readonly problems: string[]) {
    super(`fab export refused:\n  - ${problems.join("\n  - ")}`);
    this.name = "FabError";
  }
}

export interface FabOptions {
  id: string;
  /** KiCad project folder (default modules/<id>/kicad). */
  kicadDir?: string;
  /** Default <module folder>/module.yaml. */
  moduleYaml?: string;
  /** Parts database (default parts/). */
  partsDir?: string;
  /** Output goes to <buildRoot>/<id>/fab/ (default build/). */
  buildRoot?: string;
  /** Relax approval and sourcing checks; outputs are prefixed DRAFT- and must not be ordered. */
  draft?: boolean;
  /** Run DRC with --schematic-parity (default true). Only a draft may turn it off. */
  parity?: boolean;
  configHome?: string;
}

export interface FabReport {
  outDir: string;
  files: string[];
  drc: DrcSummary;
  /** False for jlcpcb.assembly: none (Gerbers and drill only). */
  assembly: boolean;
  bomLines: number;
  unverified: string[];
  consigned: string[];
  /** Parts whose rotation correction the table contradicts ("ref: detail"). */
  disputedRotations: string[];
}

interface ModuleFabInfo {
  rev: string;
  approvalSha?: string;
  assembly: BoardYaml["jlcpcb"]["assembly"];
  tht: BoardYaml["jlcpcb"]["tht"];
  handSolder: string[];
  layers: BoardYaml["pcb"]["layers"];
}

function defaultModuleYaml(id: string): string | null {
  try {
    return join(projectDir(id), "module.yaml");
  } catch {
    return null;
  }
}

/** module.yaml through the same schema as `bun run validate` (its rev also names the output folder). */
function readModuleInfo(file: string | null, id: string): ModuleFabInfo | null {
  if (!file || !existsSync(file)) return null;
  let m: BoardYaml;
  try {
    m = loadProject(file).value;
  } catch (e) {
    if (e instanceof ValidationError) throw new FabError(["module.yaml does not validate (bun run validate):", ...e.issues.map((i) => formatIssue(i))]);
    throw e;
  }
  if (m.id !== id) throw new FabError([`${displayPath(file)} has id "${m.id}", not "${id}"`]);
  return {
    rev: m.revision.rev,
    ...(m.revision.approval && { approvalSha: m.revision.approval.schSha256 }),
    assembly: m.jlcpcb.assembly,
    tht: m.jlcpcb.tht,
    handSolder: m.jlcpcb.handSolder,
    layers: m.pcb.layers,
  };
}

export async function runFab(o: FabOptions): Promise<FabReport> {
  if (!MODULE_ID_RE.test(o.id)) throw new FabError([`"${o.id}" is not a board id`]);
  const parity = o.parity !== false;
  if (!parity && !o.draft) {
    throw new FabError(["--no-parity needs --draft: DRC with schematic parity is the only check that the board matches the approved schematic"]);
  }
  const dir = o.kicadDir ?? join(projectDir(o.id), "kicad");
  const pcb = join(dir, `${o.id}.kicad_pcb`);
  const sch = join(dir, `${o.id}.kicad_sch`);
  const problems: string[] = [];
  for (const f of [pcb, sch]) if (!existsSync(f)) problems.push(`${f} not found`);
  if (problems.length) throw new FabError(problems);
  // The schematic: its root file and, for a schematic with pages, every page file.
  let schFiles: string[];
  try {
    schFiles = schematicFiles(sch);
  } catch (e) {
    throw new FabError([(e as Error).message]);
  }

  const mod = readModuleInfo(o.moduleYaml ?? defaultModuleYaml(o.id), o.id);
  const rev = mod?.rev ?? "A";
  const fabRoot = join(o.buildRoot ?? paths.build, o.id, "fab");
  const out = join(fabRoot, o.draft ? "DRAFT" : `rev-${rev}`);
  // The folder is emptied below: it must be a direct child of build/<id>/fab (the schema already
  // limits rev to one capital letter, and the id is checked above).
  if (dirname(out) !== fabRoot) throw new FabError([`output folder ${out} is not a folder of ${fabRoot}`]);
  const refusedDrc = join(fabRoot, `${basename(out)}-refused-drc.json`);
  const prefix = o.draft ? `DRAFT-${o.id}` : `${o.id}-rev${rev}`;
  mkdirSync(fabRoot, { recursive: true });
  rmSync(refusedDrc, { force: true });
  const stage = mkdtempSync(join(fabRoot, ".staging-"));
  chmodSync(stage, 0o755);
  const drcJson = join(stage, "drc.json");

  let report: Omit<FabReport, "outDir" | "files"> & { names: string[] };
  try {
    const schSha = schematicSha256(sch);
    if (!o.draft) {
      if (!mod) problems.push(`module.yaml not found for ${o.id} (only boards with a module.yaml can be exported for ordering)`);
      else if (!mod.approvalSha) problems.push("schematic not approved (bun run sch:approve after the user's OK)");
      else if (mod.approvalSha !== schSha) problems.push("schematic changed since it was approved; review the PDF and approve again");
      if (problems.length) throw new FabError(problems);
    }
    const cli = (args: string[], okCodes?: number[]) =>
      kicadCli(args, { ...(o.configHome && { configHome: o.configHome }), ...(okCodes && { okCodes }) });

    // The copper layers: module.yaml's count must be the board's, which decides the Gerber layers.
    const found = boardCopperLayers(readFileSync(pcb, "utf8"));
    if (found !== 2 && found !== 4) problems.push(`the board has ${found} copper layers; the order files are made for 2 or 4`);
    else if (mod && mod.layers !== found) problems.push(`module.yaml pcb.layers is ${mod.layers}, but the board has ${found} copper layers`);
    const copperLayers: 2 | 4 = found === 4 ? 4 : 2;

    const { summary: drcSummary, kicadVersion, problems: drcProblems } = await runDrc(pcb, drcJson, {
      parity, see: `see ${displayPath(refusedDrc)}`, ...(o.configHome && { configHome: o.configHome }),
    });
    problems.push(...drcProblems);

    // BOM, sourcing and placements (skipped for a bare PCB order).
    const assembly = mod?.assembly !== "none";
    let lines: AssemblyLine[] = [];
    let cpl: CplLine[] = [];
    if (assembly) {
      const netFile = join(stage, "netlist.xml");
      await cli(["sch", "export", "netlist", "--format", "kicadxml", "-o", netFile, sch]);
      const { components } = parseNetlistXml(readFileSync(netFile, "utf8"));
      const bom = assemblyLines(components, loadAllParts(o.partsDir ?? paths.parts), { tht: mod?.tht ?? "self", handSolder: mod?.handSolder ?? [] });
      lines = bom.lines;
      problems.push(...bom.problems);
      const unverified = lines.filter((ln) => !ln.verified);
      if (!o.draft && unverified.length) {
        const jlc = unverified.filter((ln) => !ln.consigned).map((ln) => ln.ref);
        const own = unverified.filter((ln) => ln.consigned).map((ln) => ln.ref);
        if (jlc.length) problems.push(`unverified or missing LCSC numbers: ${jlc.join(", ")} (verify at https://jlcpcb.com/parts, record in parts/*.yaml)`);
        if (own.length) problems.push(`consigned parts without a verified LCSC number or MPN: ${own.join(", ")} (record the part you ship in parts/*.yaml)`);
      }

      const posFile = join(stage, "kicad-positions.csv");
      await cli(["pcb", "export", "pos", "--format", "csv", "--units", "mm", "--side", "both", "--exclude-dnp", "-o", posFile, pcb]);
      const pos = new Map(parsePos(readFileSync(posFile, "utf8")).map((r) => [r.ref, r]));
      const board = new Map<string, BoardPart[]>();
      for (const p of readBoard(readFileSync(pcb, "utf8"), pcb)) board.set(p.ref, [...(board.get(p.ref) ?? []), p]);
      const placements: Placement[] = [];
      for (const ln of lines) {
        const row = pos.get(ln.ref);
        const fps = board.get(ln.ref) ?? [];
        if (!row) {
          problems.push(`${ln.ref} is in the BOM but not on the board (or excluded from position files)`);
          continue;
        }
        if (fps.length !== 1) {
          problems.push(`${ln.ref} appears ${fps.length} times on the board`);
          continue;
        }
        const fp = fps[0]!;
        // kicad-cli's position file is the reference for anchor, rotation and side.
        if (Math.abs(fp.x - row.x) > 5e-4 || Math.abs(-fp.y - row.y) > 5e-4 || norm(fp.rot) !== norm(row.rot) || fp.side !== row.side) {
          problems.push(`${ln.ref}: board file and kicad-cli position file disagree (${fp.x},${-fp.y} ${fp.rot}° ${fp.side} vs ${row.x},${row.y} ${row.rot}° ${row.side})`);
          continue;
        }
        try {
          const pt = placementPoint(fp);
          placements.push({ ref: ln.ref, name: fp.name, lib: fp.lib, side: fp.side, x: pt.x, y: -pt.y, rot: row.rot, ...(ln.cplRotation !== undefined && { partRot: ln.cplRotation }) });
        } catch (e) {
          problems.push((e as Error).message);
        }
      }
      cpl = cplLines(placements, loadCorrections());
    }
    if (problems.length) throw new FabError(problems);

    // Order files.
    const gerbers = join(stage, "gerbers");
    mkdirSync(gerbers);
    await cli(["pcb", "export", "gerbers", "--layers", gerberLayers(copperLayers).join(","), "--subtract-soldermask", "--check-zones", "-o", `${gerbers}/`, pcb]);
    await cli(["pcb", "export", "drill", "--format", "excellon", "--drill-origin", "absolute", "--excellon-units", "mm",
      "--excellon-zeros-format", "decimal", "--excellon-oval-format", "alternate", "--excellon-separate-th",
      "--generate-map", "--map-format", "gerberx2", "-o", `${gerbers}/`, pcb]);
    const gerberFiles = readdirSync(gerbers).sort();
    const zipName = `${prefix}-gerbers.zip`;
    writeFileSync(join(stage, zipName), zipSync(Object.fromEntries(gerberFiles.map((f) => [f, new Uint8Array(readFileSync(join(gerbers, f)))])), { mtime: new Date("2026-01-01T00:00:00Z") }));
    const names = [zipName];
    if (assembly) {
      writeFileSync(join(stage, `${prefix}-bom.csv`), bomCsv(lines));
      writeFileSync(join(stage, `${prefix}-cpl.csv`), cplCsv(cpl));
      names.push(`${prefix}-bom.csv`, `${prefix}-cpl.csv`);
    }
    const unverified = lines.filter((ln) => !ln.verified).map((ln) => ln.ref);
    const consigned = lines.filter((ln) => ln.consigned);
    const disputed = cpl.filter((c) => c.disputed.length).map(describeDispute);
    const ownRot = new Map<number, string[]>();
    for (const c of cpl) if (c.partRot !== undefined) ownRot.set(c.partRot, [...(ownRot.get(c.partRot) ?? []), c.ref]);
    const partRotations = [...ownRot].sort(([a], [b]) => a - b).map(([rot, refs]) => `${refs.join(", ")} +${rot}°`);
    writeFileSync(join(stage, "README.md"), fabReadme({ prefix, draft: o.draft ?? false, schSha, gerberCount: gerberFiles.length, drc: drcSummary,
      kicadVersion, assembly, lines, unverified, consigned, disputed, partRotations, hasModule: mod !== null, copperLayers }));
    names.push("README.md", "drc.json");
    report = { names, drc: drcSummary, assembly, bomLines: lines.length, unverified, consigned: consigned.map((ln) => ln.ref), disputedRotations: disputed };
  } catch (e) {
    // Nothing order-like may survive a refusal, including files of an earlier run that no
    // longer match the board. The DRC report stays next to the folder for diagnosis.
    if (existsSync(drcJson)) copyFileSync(drcJson, refusedDrc);
    rmSync(stage, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
    throw e;
  }
  // What this export was made from, so `bun run order` can tell when it no longer matches.
  const moduleYaml = o.moduleYaml ?? defaultModuleYaml(o.id);
  writeInputs(stage, [pcb, ...schFiles, ...(moduleYaml && existsSync(moduleYaml) ? [moduleYaml] : []), ...partFiles(o.partsDir ?? paths.parts)]);
  rmSync(out, { recursive: true, force: true });
  renameSync(stage, out);
  const { names, ...rest } = report;
  return { outDir: out, files: names.map((n) => join(out, n)), ...rest };
}

export interface ReadmeInput {
  prefix: string;
  draft: boolean;
  schSha: string;
  gerberCount: number;
  drc: DrcSummary;
  kicadVersion: string;
  assembly: boolean;
  lines: AssemblyLine[];
  unverified: string[];
  consigned: AssemblyLine[];
  disputed: string[];
  /** Parts with their own rotation correction (parts/*.yaml `cplRotation`), "refs +deg°" per value. */
  partRotations?: string[];
  hasModule: boolean;
  /** Copper layers of the board (default 2). */
  copperLayers?: 2 | 4;
}

const OWN_PARTS = "https://jlcpcb.com/help/article/how-to-use-my-own-parts-for-pcb-assembly-order";

/** The README.md checklist of an export. */
export function fabReadme(r: ReadmeInput): string {
  const { prefix, drc } = r;
  const md = [`# ${prefix}: JLCPCB order files`, ""];
  md.push(r.draft
    ? "**DRAFT — not for ordering** (approval and part sourcing were not enforced)."
    : `Schematic sha256 ${r.schSha.slice(0, 12)} (approved).`, "");
  const inner = r.copperLayers === 4 ? ", 4 copper layers: F.Cu, In1.Cu, In2.Cu, B.Cu" : "";
  md.push(`- PCB: \`${prefix}-gerbers.zip\` (${r.gerberCount} files: Gerbers${inner}, separate PTH/NPTH Excellon drill, drill map; zones refilled before plotting)`);
  if (r.assembly) {
    md.push(`- Assembly: \`${prefix}-bom.csv\` (${r.lines.length} placements) and \`${prefix}-cpl.csv\`. CPL points: SMD parts at the footprint anchor, ` +
      "all other parts at the centre of their pads; rotations from the Fabrication Toolkit table, bottom side as 180° − rotation plus the correction.");
    if (r.partRotations?.length) {
      md.push(`- Rotation corrections from parts/*.yaml (JLCPCB's footprint for the part is turned against KiCad's): ${r.partRotations.join("; ")}.`);
    }
  } else {
    md.push("- Assembly: none (module.yaml `jlcpcb.assembly: none`): Gerbers and drill only, no BOM or CPL; order the bare PCB.");
  }
  if (!r.hasModule) md.push("- No module.yaml: assumed JLCPCB places the SMD parts and the THT parts are soldered by hand.");
  md.push(`- DRC (KiCad ${r.kicadVersion}): ${drc.errors} errors, ${drc.warnings} warnings, ${drc.excluded} excluded; ` +
    `schematic parity ${drc.parity ? "checked" : "**NOT checked** (--no-parity): the board may not match the schematic"}.`);
  md.push(`- Checks KiCad ignores in this project (its defaults): ${drc.ignored.join(", ") || "none"}.`);
  if (r.assembly) {
    md.push(r.unverified.length ? `- Unverified sourcing: ${r.unverified.join(", ")}.` : `- Sourcing: all ${r.lines.length} placements verified in parts/*.yaml.`);
  }
  const check: string[] = [];
  if (r.consigned.length) {
    check.push("Consigned THT parts (module.yaml `jlcpcb.tht: consign`); you ship these to JLCPCB before ordering:", "");
    for (const ln of r.consigned) {
      check.push(`- ${ln.ref}: ${ln.value}, ${ln.footprint}, ${ln.lcsc ? `LCSC ${ln.lcsc}` : "no LCSC number"}, ${ln.mpn ? `MPN ${ln.mpn}` : "no MPN"}`);
    }
    check.push("", `JLCPCB matches own parts "with MFR. Part number or JLCPCB Part number" at the parts-selection step (${OWN_PARTS}). ` +
      "The BOM's `JLCPCB Part #` cell carries the LCSC number or, when there is none, the MPN. " +
      "Which BOM column JLCPCB reads for consigned parts is not documented (unverified): make sure each line above is matched to your stock in My Parts before ordering.", "");
  }
  if (r.disputed.length) {
    check.push("Rotation corrections that the Fabrication Toolkit table contradicts (the first matching line wins, as in the plugin):", "");
    for (const d of r.disputed) check.push(`- ${d}`);
    check.push("");
  }
  if (check.length) md.push("", "## Check these lines", "", ...check);
  else md.push("");
  md.push("## Before ordering (done by you, never by the tools)", "");
  md.push("1. Upload the zip in JLCPCB's Gerber viewer and check every layer, the outline and the drill hits.");
  if (r.assembly) md.push("2. Upload BOM + CPL and check each part's position, rotation and polarity in the placement preview.");
  md.push(`${r.assembly ? 3 : 2}. Confirm board thickness, colour, surface finish and quantity against module.yaml.`, "");
  return md.join("\n");
}
