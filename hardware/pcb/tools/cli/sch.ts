// bun run sch -- <id>
// Generate the KiCad project of modules/<id> from its schematic.ts and run the full gate chain; see
// tools/sch/gates.ts.
import { relative } from "node:path";
import { failure, parseCli, usageError } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { runSchGates } from "../sch/gates.ts";

const USAGE = "usage: bun run sch -- <board-id> [...]";
const { positionals: ids } = parseCli(USAGE, {});
if (ids.length === 0) usageError(USAGE);
let failed = false;
for (const id of ids) {
  try {
    const r = await runSchGates(id);
    const rel = (p: string) => relative(paths.root, p);
    console.log(`✔ ${id}: ERC ${r.erc.errors} errors / ${r.erc.warnings} warnings (KiCad ${r.erc.kicadVersion}), netlist round-trip ok`);
    const pages = r.schPaths.length - 1;
    console.log(`  schematic ${rel(r.schPath)}${pages ? ` + ${pages} page files` : ""}${r.changed.length ? " (updated)" : " (unchanged)"}`);
    console.log(`  PDF       ${rel(r.pdfPath)}${pages ? ` (${r.schPaths.length} pages)` : ""}`);
    console.log(`  review    ${rel(r.reviewPath)}`);
  } catch (e) {
    failed = true;
    console.error(failure(id, e));
  }
}
process.exit(failed ? 1 : 0);
