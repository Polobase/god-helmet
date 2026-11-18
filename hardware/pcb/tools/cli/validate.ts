// bun run validate [id...]
//
// Checks, without kicad-cli:
//   - modules/*/module.yaml (all, or only the given ids), against the board schema (tools/module/schema.ts)
//   - every parts/*.yaml
//   - cross-references: each part's symbol and footprint exist in the vendored lib/kicad (only once
//     lib/kicad exists)
// Prints every issue as file:line:col and a summary; exit 1 on any error.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseCli } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { displayPath, loadProject, readParts, formatIssue, ValidationError, type Issue, type Loaded } from "../module/load.ts";
import { vendoredLib } from "../module/parts.ts";
import { boardWarnings, type BoardYaml } from "../module/schema.ts";
import { atomStr, children, parse, SExprParseError } from "../sexpr/sexpr.ts";

export interface ValidateRoots {
  modules: string;
  parts: string;
  libKicad: string;
}

export const DEFAULT_ROOTS: ValidateRoots = {
  modules: paths.modules,
  parts: paths.parts,
  libKicad: paths.libKicad,
};

export interface Report {
  errors: Issue[];
  warnings: Issue[];
  /** module.yaml files checked. */
  modules: string[];
  parts: number;
  libKicad: boolean;
}

const at = (file: string, message: string): Issue => ({ file, line: 1, col: 1, path: [], message });

function splitLibId(id: string): [string, string] {
  const i = id.indexOf(":");
  return [id.slice(0, i), id.slice(i + 1)];
}

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();
const subdirs = (base: string) => (isDir(base) ? readdirSync(base).filter((d) => isDir(join(base, d))).sort() : []);

/** module.yaml files to check. Every modules/<id> needs one. */
function moduleTargets(ids: string[], roots: ValidateRoots, errors: Issue[]): string[] {
  const out: string[] = [];
  for (const id of ids.length ? ids : subdirs(roots.modules)) {
    const dir = join(roots.modules, id);
    if (!isDir(dir)) {
      errors.push(at(dir, `no board named "${id}" (looked in modules/)`));
      continue;
    }
    const file = join(dir, "module.yaml");
    if (existsSync(file)) out.push(file);
    else errors.push(at(file, "missing module.yaml (every modules/<id> needs one; see README.md)"));
  }
  return out;
}

export function validate(ids: string[] = [], roots: ValidateRoots = DEFAULT_ROOTS): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const collect = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof ValidationError) errors.push(...e.issues);
      else throw e;
      return undefined;
    }
  };
  const warnAll = (loaded: Loaded<BoardYaml>) => {
    for (const w of boardWarnings(loaded.value)) warnings.push({ file: loaded.file, ...loaded.locate(w.path), path: w.path, message: w.message });
  };

  // Parts DB.
  const { parts, issues: partIssues } = readParts(roots.parts);
  errors.push(...partIssues);

  // Vendored libraries: lib/kicad/symbols/GHP_<Lib>.kicad_sym, footprints/GHP_<Lib>.pretty/<Name>.kicad_mod.
  const libKicad = isDir(roots.libKicad);
  if (libKicad) {
    const symbolCache = new Map<string, Set<string> | null>();
    const symbolsIn = (file: string): Set<string> | null => {
      if (!symbolCache.has(file)) {
        let names: Set<string> | null = null;
        if (existsSync(file)) {
          try {
            names = new Set(children(parse(readFileSync(file, "utf8"), file), "symbol").map((s) => atomStr(s, 1) ?? ""));
          } catch (e) {
            if (!(e instanceof SExprParseError)) throw e;
            errors.push({ file, line: e.line, col: e.col, path: [], message: e.message.slice(`${e.file}:${e.line}:${e.col}: `.length) });
            names = new Set();
          }
        }
        symbolCache.set(file, names);
      }
      return symbolCache.get(file) ?? null;
    };
    const hint = "run bun run lib:import";
    for (const { value: part, file, locate } of parts.values()) {
      const [symLib, symName] = splitLibId(part.symbol);
      const symFile = join(roots.libKicad, "symbols", `${vendoredLib(symLib)}.kicad_sym`);
      const names = symbolsIn(symFile);
      if (names === null) {
        errors.push({ file, ...locate(["symbol"]), path: ["symbol"], message: `${displayPath(symFile)} does not exist; ${hint}` });
      } else if (!names.has(symName)) {
        errors.push({ file, ...locate(["symbol"]), path: ["symbol"], message: `symbol "${symName}" is not in ${displayPath(symFile)}; ${hint}` });
      }
      const [fpLib, fpName] = splitLibId(part.footprint);
      const fpFile = join(roots.libKicad, "footprints", `${vendoredLib(fpLib)}.pretty`, `${fpName}.kicad_mod`);
      if (!existsSync(fpFile)) {
        errors.push({ file, ...locate(["footprint"]), path: ["footprint"], message: `${displayPath(fpFile)} does not exist; ${hint}` });
      }
    }
  }

  // Boards.
  const modules = moduleTargets(ids, roots, errors);
  for (const file of modules) {
    const loaded = collect(() => loadProject(file));
    if (!loaded) continue;
    const dirName = basename(join(file, ".."));
    if (loaded.value.id !== dirName) {
      errors.push({ file, ...loaded.locate(["id"]), path: ["id"], message: `id "${loaded.value.id}" must equal its directory name "${dirName}"` });
    }
    warnAll(loaded);
  }

  return { errors, warnings, modules, parts: parts.size, libKicad };
}

function main(): number {
  const { positionals: ids } = parseCli("usage: bun run validate [-- <module-id>…]   (default: every board and the parts)", {});
  const r = validate(ids);
  for (const e of r.errors) console.error(formatIssue(e));
  for (const w of r.warnings) console.error(formatIssue(w, "⚠"));
  const libs = r.libKicad ? "symbols/footprints checked against lib/kicad" : "lib/kicad absent, symbol/footprint checks skipped";
  console.log(
    `validate: ${r.modules.length} module.yaml, ${r.parts} part(s); ${libs}\n` +
      `${r.errors.length} error(s), ${r.warnings.length} warning(s)`,
  );
  return r.errors.length ? 1 : 0;
}

if (import.meta.main) process.exit(main());
