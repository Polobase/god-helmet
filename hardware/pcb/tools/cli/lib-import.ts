// bun run lib:import [--source bundle|gitlab]
// Vendors the KiCad stock symbols/footprints used by parts/*.yaml into lib/kicad.
import { existsSync } from "node:fs";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { requireKicadCli } from "../kicad/cli.ts";
import { KICAD_LIB_TAG, KICAD_SHARED_SUPPORT } from "../kicad/install.ts";
import { bundleSource, gitlabSource, vendorLibraries } from "../kicad/vendor.ts";
import { loadAllParts } from "../module/load.ts";

const USAGE = "usage: bun run lib:import [-- --source bundle|gitlab]   (default: the installed KiCad's bundle)";
const { values, positionals } = parseCli(USAGE, { source: { type: "string" } });
if (positionals.length) usageError(USAGE);
const want = values.source ?? (existsSync(KICAD_SHARED_SUPPORT) ? "bundle" : "gitlab");
if (want !== "bundle" && want !== "gitlab") usageError(USAGE, `--source must be bundle or gitlab, got ${want}`);

try {
  let source;
  if (want === "bundle") {
    const { version } = await requireKicadCli();
    if (version !== KICAD_LIB_TAG) {
      console.warn(`warning: installed KiCad is ${version}, vendoring tag is ${KICAD_LIB_TAG}; SOURCES.json hashes will show any difference`);
    }
    source = bundleSource();
  } else source = gitlabSource();

  const parts = loadAllParts(paths.parts);
  const r = await vendorLibraries(parts, source);
  console.log(`lib:import from ${source.label}`);
  console.log(`  ${r.symbols.length} symbols: ${r.symbols.join(", ")}`);
  console.log(`  ${r.footprints.length} footprints: ${r.footprints.join(", ")}`);
  console.log(`  -> ${r.outDir}`);
  if (r.changed.length) console.warn(`  changed since the last import (review the diff before committing): ${r.changed.join(", ")}`);
} catch (e) {
  fail("lib:import", e);
}
