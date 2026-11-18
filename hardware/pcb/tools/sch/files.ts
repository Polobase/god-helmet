// The files of a generated schematic on disk: the root .kicad_sch and, for a design with pages, the page files its
// sheet symbols name. Approval, the gate record and fab hash all of them, so a change on any page is a change of
// the schematic.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { sha256, sha256File } from "../lib/hash.ts";
import { atomStr, child, children, parse, type List } from "../sexpr/sexpr.ts";

/** The first child named `names[0]`, then its first child named `names[1]`, … (undefined when one is missing). */
const walk = (n: List | undefined, ...names: string[]): List | undefined => names.reduce<List | undefined>((c, name) => (c ? child(c, name) : undefined), n);

/** The root file, then every sheet file it names (depth first, by page number). Throws when a sheet file is missing. */
export function schematicFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (file: string) => {
    if (out.includes(file)) return;
    if (!existsSync(file)) throw new Error(`${file} not found${out.length ? ` (a sheet of ${basename(out[0]!)})` : ""}`);
    out.push(file);
    const sheets = children(parse(readFileSync(file, "utf8"), file), "sheet").map((sheet) => {
      const name = atomStr(children(sheet, "property").find((p) => atomStr(p, 1) === "Sheetfile"), 2);
      const page = Number(atomStr(walk(sheet, "instances", "project", "path", "page"), 1));
      return { name, page: Number.isFinite(page) ? page : Infinity };
    });
    // eeschema writes sheet symbols in UUID order; their page numbers give the reading order.
    for (const s of sheets.sort((a, b) => a.page - b.page)) if (s.name) visit(join(dirname(file), s.name));
  };
  visit(root);
  return out;
}

/** sha256 of a schematic: of the file itself for a one-sheet schematic (as before pages existed), else of the list
 *  "<file name> <sha256>" of the root and every page, one per line. */
export function schematicSha256(root: string): string {
  const files = schematicFiles(root);
  if (files.length === 1) return sha256File(root);
  return sha256(files.map((f) => `${basename(f)} ${sha256File(f)}\n`).join(""));
}

/** Page files of project `id` in `dir` (`<id>-<page>.kicad_sch`) that are not in `keep`: left behind by a page that
 *  was removed or renamed. */
export function strayPageFiles(dir: string, id: string, keep: Iterable<string>): string[] {
  if (!existsSync(dir)) return [];
  const kept = new Set([...keep].map((f) => basename(f)));
  const re = new RegExp(`^${id.replace(/[-]/g, "\\-")}-[a-z0-9][a-z0-9-]*\\.kicad_sch$`);
  return readdirSync(dir).filter((f) => re.test(f) && !kept.has(f)).sort().map((f) => join(dir, f));
}
