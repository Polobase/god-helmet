// What an export was made from: the sha256 of its input files, written next to the outputs as inputs.json,
// so `bun run order` can tell whether an output still belongs to the current sources. File times can't:
// a checkout, a copy or a touch changes them without changing anything.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { sha256File } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";

const FILE = "inputs.json";

/** Repo-relative when inside the repo (stable across checkouts), absolute otherwise. */
const key = (file: string) => {
  const rel = relative(paths.root, resolve(file));
  return rel.startsWith("..") || isAbsolute(rel) ? resolve(file) : rel;
};

/** Writes <dir>/inputs.json: path → sha256 of every input file (sorted, deterministic). */
export function writeInputs(dir: string, files: string[]): void {
  const entries = [...new Set(files.map(key))].sort().map((k) => [k, sha256File(resolve(paths.root, k))] as const);
  writeFileSync(join(dir, FILE), `${JSON.stringify(Object.fromEntries(entries), null, 1)}\n`);
}

/** Inputs whose content changed or that are gone since <dir>/inputs.json was written; null when there is
 *  no inputs.json (an export made before this check existed). */
export function staleInputs(dir: string): string[] | null {
  const file = join(dir, FILE);
  if (!existsSync(file)) return null;
  const recorded = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  return Object.entries(recorded)
    .filter(([k, sha]) => {
      const f = resolve(paths.root, k);
      return !existsSync(f) || sha256File(f) !== sha;
    })
    .map(([k]) => k);
}
