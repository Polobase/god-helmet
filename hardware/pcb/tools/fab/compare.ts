// Compare two folders of order outputs by content, ignoring what legitimately changes from run to run:
// the plot date in Gerber, drill and job files, the date and source path in DRC reports, and whole file
// types that carry a clock or depend on the renderer (PDF, PNG, SVG previews, netlists). Zips are
// compared entry by entry. Used by `bun run verify:outputs` to prove that a refactor changed no output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { unzipSync } from "fflate";

/** Gerber, drill and job file text without the lines that carry the plot date. */
export const stripPlotDates = (s: string) =>
  s.split("\n").filter((ln) => !/CreationDate|^G04 Created by|^; DRILL file .* date|^; #@! TF\.CreationDate/.test(ln)).join("\n");

/** Extensions compared after stripping plot dates (Gerber X2 with the inner copper of a 4-layer board, Excellon,
 *  Gerber job). */
const PLOT = new Set([".gtl", ".gbl", ".g1", ".g2", ".gto", ".gbo", ".gts", ".gbs", ".gtp", ".gbp", ".gm1", ".gbr", ".drl", ".gbrjob"]);
/** Extensions that are not compared. */
export const SKIPPED = new Set([".pdf", ".png", ".svg", ".xml", ".kicad_prl"]);
/** Files that are not compared: inputs.json records what an export was made from (bookkeeping, with the
 *  paths of wherever it ran), not an order file. */
const SKIPPED_NAMES = new Set(["inputs.json"]);

/** File content as compared: text with volatile lines removed, or the bytes as latin1 text. */
export function normalized(name: string, bytes: Uint8Array): string {
  const ext = extname(name).toLowerCase();
  const text = new TextDecoder("latin1").decode(bytes);
  if (PLOT.has(ext)) return stripPlotDates(text);
  if (name.endsWith("drc.json")) return text.split("\n").filter((l) => !/^\s*"(date|source)":/.test(l)).join("\n");
  return text;
}

/** Relative paths of the files under `dir`, including the entries of zips as `<zip>!/<entry>`. */
function entries(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const rel of (readdirSync(dir, { recursive: true }) as string[]).sort()) {
    const file = join(dir, rel);
    if (!statSync(file).isFile() || SKIPPED.has(extname(rel).toLowerCase()) || SKIPPED_NAMES.has(basename(rel))) continue;
    const bytes = new Uint8Array(readFileSync(file));
    if (rel.endsWith(".zip")) {
      const zip = unzipSync(bytes);
      for (const name of Object.keys(zip).sort()) {
        if (!SKIPPED.has(extname(name).toLowerCase())) out.set(`${rel}!/${name}`, normalized(name, zip[name]!));
      }
    } else {
      out.set(rel, normalized(rel, bytes));
    }
  }
  return out;
}

export interface CompareOptions {
  /** Files that may exist only in `expected` (for example the user's own files). */
  ignoreOnlyInExpected?: (rel: string) => boolean;
  /** Applied to both sides before comparing (for example to undo a temp path). */
  rewrite?: (rel: string, text: string) => string;
}

/** Differences between two folders ("only in …", "differs: …"); empty when they match. */
export function compareFolders(expected: string, actual: string, opts: CompareOptions = {}): string[] {
  const a = entries(expected);
  const b = entries(actual);
  const rw = opts.rewrite ?? ((_: string, t: string) => t);
  const diffs: string[] = [];
  for (const [rel, text] of a) {
    const other = b.get(rel);
    if (other === undefined) {
      if (!opts.ignoreOnlyInExpected?.(rel)) diffs.push(`only in ${expected}: ${rel}`);
    } else if (rw(rel, other) !== rw(rel, text)) diffs.push(`differs: ${rel}`);
  }
  for (const rel of b.keys()) if (!a.has(rel)) diffs.push(`only in ${actual}: ${rel}`);
  return diffs;
}
