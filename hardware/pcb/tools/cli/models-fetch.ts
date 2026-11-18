// bun run models:fetch
// Download the vendor SPICE models into the gitignored models/ folder (never committed).
import { relative } from "node:path";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { fetchModels, MODELS } from "../sim/models.ts";

const USAGE = "usage: bun run models:fetch";
if (parseCli(USAGE, {}).positionals.length) usageError(USAGE);
try {
  const files = await fetchModels();
  for (const m of MODELS) console.log(`${m.id}: ${m.note}`);
  for (const f of files) console.log(`  ${relative(paths.root, f)}`);
} catch (e) {
  fail("models:fetch", e);
}
