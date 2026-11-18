// Generate a module's KiCad project files from its schematic.ts (pure: returns file contents).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { paths, projectDir } from "../lib/paths.ts";
import { emitProject } from "../kicad/emit-pro.ts";
import { emitSheets } from "../kicad/emit-sch.ts";
import { emitFpLibTable, emitSymLibTable } from "../kicad/libtables.ts";
import { rootUuid, sheetUuid } from "../kicad/uuid.ts";
import { vendoredTables } from "../kicad/vendor.ts";
import { loadAllParts } from "../module/load.ts";
import { buildSchematic, loadVendored, sheetsOf, TOOL_VERSION, type BuildResult } from "./build.ts";
import type { DesignInput } from "./dsl.ts";

export interface Generated {
  id: string;
  kicadDir: string;
  /** The root schematic: the whole schematic, or the sheet symbols of a design with pages. */
  schPath: string;
  /** Every schematic file: the root, then the pages in page order. */
  schPaths: string[];
  /** Files owned by the generator (always rewritten). */
  files: Map<string, string>;
  /** Written only when missing: KiCad owns and normalises the project file. */
  createIfMissing: Map<string, string>;
  build: BuildResult;
}

export async function loadDesign(id: string): Promise<DesignInput> {
  const file = join(projectDir(id), "schematic.ts");
  if (!existsSync(file)) throw new Error(`${file} not found`);
  const mod = (await import(file)) as { default?: DesignInput };
  if (!mod.default) throw new Error(`${file} must \`export default defineSchematic({...})\``);
  return mod.default;
}

export function generate(id: string, design: DesignInput, opts: { dir?: string } = {}): Generated {
  if (design.project !== id) throw new Error(`schematic.ts project "${design.project}" does not match folder "${id}"`);
  const build = buildSchematic(design, { parts: loadAllParts(paths.parts), lib: loadVendored() });
  const kicadDir = opts.dir ?? join(projectDir(id), "kicad");
  const schPath = join(kicadDir, `${id}.kicad_sch`);
  const schPaths = [schPath, ...build.pages.map((p) => join(kicadDir, p.page!.file))];
  const texts = emitSheets(sheetsOf(build), TOOL_VERSION);
  const tables = vendoredTables();
  const files = new Map<string, string>([
    ...schPaths.map((f, i): [string, string] => [f, texts[i]!]),
    [join(kicadDir, "sym-lib-table"), emitSymLibTable(kicadDir, tables.symbols)],
    [join(kicadDir, "fp-lib-table"), emitFpLibTable(kicadDir, tables.footprints)],
  ]);
  const pages = build.pages.map((p) => ({ uuid: sheetUuid(id, p.page!.id), name: p.page!.title }));
  const createIfMissing = new Map([[join(kicadDir, `${id}.kicad_pro`), emitProject({ name: id, rootUuid: rootUuid(id), ...(pages.length && { pages }) })]]);
  return { id, kicadDir, schPath, schPaths, files, createIfMissing, build };
}
