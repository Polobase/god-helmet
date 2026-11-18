// Vendor the KiCad 10 stock symbols and footprints that parts/*.yaml uses into lib/kicad.
//
// Symbols are flattened (no `extends`) and renamed into GHP_<Library> libraries, so the embedded
// copies in generated schematics are identical to the library copies (no lib_symbol_mismatch) and
// nothing depends on the user's global KiCad library tables. Footprints are copied verbatim, except
// the few derived from a stock base by recorded edits (derived.ts).
// Source: the installed KiCad bundle, or the matching tag on GitLab when KiCad is not installed.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { atomStr, child, parse, print, type List } from "../sexpr/sexpr.ts";
import { sha256 } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";
import { DERIVED_FOOTPRINTS } from "./derived.ts";
import { analyzeFootprint } from "./fplib.ts";
import { GENERATED_SYMBOLS, generateSymbol } from "./gensym.ts";
import { KICAD_LIB_TAG, KICAD_SHARED_SUPPORT } from "./install.ts";
import { readFlatSymbol, renameSymbol, symbolLibrary, symbolsOf } from "./symlib.ts";
import { vendoredLib, type Part } from "../module/parts.ts";

/** Power symbols the schematic builder may place, vendored even when no part references them. +5VA is the
 *  helmet-driver's filtered DAC supply; GND1 is the ground of its isolated tES island. */
export const POWER_SYMBOLS = ["power:+3V3", "power:+5V", "power:+5VA", "power:+12V", "power:-12V", "power:+15V", "power:-15V", "power:GND", "power:GND1", "power:PWR_FLAG"];

export interface StockSource {
  label: string;
  /** Directory laid out like the stock symbols folder (packed and/or .kicad_symdir). */
  prepareSymbol(lib: string, name: string): Promise<string>;
  footprint(lib: string, name: string): Promise<string>;
  license(): Promise<string>;
}

/** sha256 of LICENSE.md of the KiCad libraries at tag 10.0.6 (CC-BY-SA-4.0 with the library exception):
 *  lib/kicad/LICENSE.md, identical to tests/fixtures/kicad-symbols-10.0.6/LICENSE.md (checked 2026-09-28). */
export const KICAD_LIB_LICENSE_SHA256 = "45d2bce75e5a4208f5afb01b8fb2c406e700371c4fe2b5f5cd5c443d46db4d8f";

/** The licence file, refused unless it is the pinned one. */
function checkedLicense(file: string): string {
  const got = sha256(readFileSync(file));
  if (got !== KICAD_LIB_LICENSE_SHA256) throw new Error(`${file} is not the pinned KiCad library licence (sha256 ${got.slice(0, 12)}…, want ${KICAD_LIB_LICENSE_SHA256.slice(0, 12)}…)`);
  return file;
}

export function bundleSource(shared = KICAD_SHARED_SUPPORT, vendored = paths.libKicad): StockSource {
  return {
    label: `KiCad bundle ${shared}`,
    prepareSymbol: async () => join(shared, "symbols"),
    footprint: async (lib, name) => join(shared, "footprints", `${lib}.pretty`, `${name}.kicad_mod`),
    // The macOS bundle ships no LICENSE.md: use the vendored copy when it is the pinned one (no network),
    // else fetch it from the matching library tag.
    license: async () => {
      for (const f of [join(shared, "symbols", "LICENSE.md"), join(shared, "footprints", "LICENSE.md")]) if (existsSync(f)) return f;
      const copy = join(vendored, "LICENSE.md");
      if (existsSync(copy) && sha256(readFileSync(copy)) === KICAD_LIB_LICENSE_SHA256) return copy;
      return gitlabSource().license();
    },
  };
}

/** Downloads from gitlab.com/kicad/libraries at `tag` into a cache folder under build/. A download is
 *  written to a .part file and renamed when complete, so an interrupted one is never taken from the cache. */
export function gitlabSource(tag = KICAD_LIB_TAG, cache = join(paths.build, ".cache", "kicad-libs", tag)): StockSource {
  const fetchTo = async (url: string, file: string) => {
    if (existsSync(file)) return file;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.part`, await res.text());
    renameSync(`${file}.part`, file);
    return file;
  };
  const raw = (repo: string, path: string) =>
    `https://gitlab.com/kicad/libraries/${repo}/-/raw/${tag}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const symDir = join(cache, "symbols");
  return {
    label: `gitlab.com/kicad/libraries @ ${tag}`,
    async prepareSymbol(lib, name) {
      // Fetch the symbol and, recursively, the parent it extends.
      let current: string | undefined = name;
      while (current) {
        const rel: string = `${lib}.kicad_symdir/${current}.kicad_sym`;
        const file = await fetchTo(raw("kicad-symbols", rel), join(symDir, rel));
        const node = symbolsOf(parse(readFileSync(file, "utf8"), file)).get(current);
        current = node ? atomStr(child(node, "extends"), 1) : undefined;
      }
      return symDir;
    },
    footprint: (lib, name) => fetchTo(raw("kicad-footprints", `${lib}.pretty/${name}.kicad_mod`), join(cache, "footprints", `${lib}.pretty`, `${name}.kicad_mod`)),
    license: async () => checkedLicense(await fetchTo(raw("kicad-symbols", "LICENSE.md"), join(cache, "LICENSE.md"))),
  };
}

type Sources = {
  symbols: Record<string, { from: string[]; sha256: string[] }>;
  footprints: Record<string, { from: string; sha256: string; derived?: string }>;
};

/** Vendored ids that are new, gone, or whose stock files changed since the previous SOURCES.json. */
export function provenanceChanges(prev: Sources | null, next: Sources): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const kind of ["symbols", "footprints"] as const) {
    const a = prev[kind] as Record<string, { sha256: unknown }>;
    const b = next[kind] as Record<string, { sha256: unknown }>;
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[id]?.sha256) !== JSON.stringify(b[id]?.sha256)) out.push(`${id}${!a[id] ? " (new)" : !b[id] ? " (removed)" : ""}`);
    }
  }
  return out.sort();
}

export interface ImportResult {
  symbols: string[];
  footprints: string[];
  outDir: string;
  /** Ids whose stock files differ from the previous SOURCES.json (new, removed or changed upstream). */
  changed: string[];
}

const split = (id: string) => {
  const i = id.indexOf(":");
  return { lib: id.slice(0, i), name: id.slice(i + 1) };
};

/** Vendor every symbol and footprint referenced by `parts` (plus POWER_SYMBOLS) into `outDir`,
 *  replacing whatever was vendored before. Output is deterministic (no timestamps). */
export async function vendorLibraries(parts: Map<string, Part>, source: StockSource, outDir = paths.libKicad, toolVersion = "0.1.0"): Promise<ImportResult> {
  const symbolIds = [...new Set([...POWER_SYMBOLS, ...[...parts.values()].map((p) => p.symbol)])].sort();
  const footprintIds = [...new Set([...parts.values()].map((p) => p.footprint))].sort();

  const provenance: Record<string, { from: string[]; sha256: string[] }> = {};
  const byLib = new Map<string, List[]>();
  for (const id of symbolIds) {
    const { lib, name } = split(id);
    const generated = GENERATED_SYMBOLS[id];
    if (lib === "Generated") {
      // Not in the stock library: built from the datasheet's pin table (gensym.ts).
      if (!generated) throw new Error(`symbol ${id}: no pin table in tools/kicad/gensym.ts`);
      byLib.set(lib, [...(byLib.get(lib) ?? []), generateSymbol(name, generated)]);
      provenance[id] = { from: [`generated: ${generated.source}`], sha256: [sha256(JSON.stringify(generated.pins))] };
      continue;
    }
    const dir = await source.prepareSymbol(lib, name);
    const { node, files } = readFlatSymbol(dir, lib, name);
    byLib.set(lib, [...(byLib.get(lib) ?? []), renameSymbol(node, name)]);
    provenance[id] = {
      from: files.map((f) => f.slice(dir.length + 1)),
      sha256: files.map((f) => sha256(readFileSync(f, "utf8"))),
    };
  }

  const symOut = join(outDir, "symbols");
  const fpOut = join(outDir, "footprints");
  rmSync(symOut, { recursive: true, force: true });
  rmSync(fpOut, { recursive: true, force: true });
  mkdirSync(symOut, { recursive: true });
  mkdirSync(fpOut, { recursive: true });

  for (const [lib, syms] of byLib) {
    writeFileSync(join(symOut, `${vendoredLib(lib)}.kicad_sym`), print(symbolLibrary(syms, toolVersion)));
  }

  const fpProvenance: Record<string, { from: string; sha256: string; derived?: string }> = {};
  for (const id of footprintIds) {
    const { lib, name } = split(id);
    const derived = DERIVED_FOOTPRINTS[id];
    const base = derived ? split(derived.base) : { lib, name };
    const file = await source.footprint(base.lib, base.name);
    const stock = readFileSync(file, "utf8");
    let text = stock;
    if (derived) {
      const node = parse(stock, file);
      derived.edit(node);
      text = print(node);
    }
    analyzeFootprint(parse(text, file)); // fail early on anything that is not a footprint
    const dir = join(fpOut, `${vendoredLib(lib)}.pretty`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.kicad_mod`), text);
    fpProvenance[id] = derived
      ? { from: `${base.lib}.pretty/${base.name}.kicad_mod`, sha256: sha256(stock), derived: derived.why }
      : { from: `${lib}.pretty/${name}.kicad_mod`, sha256: sha256(text) };
  }

  // A generated symbol's pins and its parts' footprint pads must match one to one.
  for (const part of parts.values()) {
    const def = GENERATED_SYMBOLS[part.symbol];
    if (!def) continue;
    const { lib, name } = split(part.footprint);
    const fp = analyzeFootprint(parse(readFileSync(join(fpOut, `${vendoredLib(lib)}.pretty`, `${name}.kicad_mod`), "utf8"), name));
    const pins = new Set(def.pins.filter((p) => p.name !== "").map((p) => p.number));
    const missing = [...fp.numbers].filter((n) => !pins.has(n));
    const extra = [...pins].filter((n) => !fp.numbers.has(n));
    if (missing.length || extra.length) {
      throw new Error(`${part.symbol} with ${part.footprint}: pads without a pin ${missing.join(" ") || "-"}, pins without a pad ${extra.join(" ") || "-"}`);
    }
  }

  writeFileSync(join(outDir, "LICENSE.md"), readFileSync(await source.license(), "utf8"));
  const sources = {
    note: "Generated by `bun run lib:import`. Flattened copies of KiCad stock symbols and verbatim footprints; see LICENSE.md (CC-BY-SA-4.0 with the KiCad library exception). Symbols in GHP_Generated are not KiCad's: they are built from the datasheet pin tables named in their `from` (tools/kicad/gensym.ts).",
    kicadLibraryTag: KICAD_LIB_TAG,
    symbols: provenance,
    footprints: fpProvenance,
  };
  const sourcesFile = join(outDir, "SOURCES.json");
  const previous = existsSync(sourcesFile) ? (JSON.parse(readFileSync(sourcesFile, "utf8")) as Sources) : null;
  writeFileSync(sourcesFile, JSON.stringify(sources, null, 2) + "\n");
  return { symbols: symbolIds, footprints: footprintIds, outDir, changed: provenanceChanges(previous, sources) };
}

/** Vendored library nicknames + paths (relative to lib/kicad) for the project library tables. */
export function vendoredTables(libDir = paths.libKicad) {
  const symDir = join(libDir, "symbols");
  const fpDir = join(libDir, "footprints");
  const syms = existsSync(symDir) ? readdirSync(symDir).filter((f) => f.endsWith(".kicad_sym")).sort() : [];
  const fps = existsSync(fpDir) ? readdirSync(fpDir).filter((f) => f.endsWith(".pretty")).sort() : [];
  return {
    symbols: syms.map((f) => ({ name: f.replace(/\.kicad_sym$/, ""), path: `symbols/${f}` })),
    footprints: fps.map((f) => ({ name: f.replace(/\.pretty$/, ""), path: `footprints/${f}` })),
  };
}
