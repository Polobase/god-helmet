// bun run order -- <id>
//   Collect the upload files for one JLCPCB cart into build/<id>/order/ (tools/fab/order.ts): the board
//   with its PCB Assembly files (from `bun run fab`) and ORDER.md with the order-form settings. Refuses when
//   an output is missing or its sources changed since it was made (inputs.json), or when the fab BOM doesn't
//   match the schematic. Files it didn't write are kept. Never uploads or orders anything.
import { join, relative } from "node:path";
import { orderContext, orderFiles, orderProblems, writeOrderPackage } from "../fab/order.ts";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { loadProjectYaml } from "../module/load.ts";
import { buildDir, paths, projectDir } from "../lib/paths.ts";

const USAGE = "usage: bun run order -- <board-id>";
const { positionals } = parseCli(USAGE, {});
const id = positionals[0];
if (!id || positionals.length > 1) usageError(USAGE);
try {
  const m = loadProjectYaml(join(projectDir(id), "module.yaml"));
  const files = orderFiles(id, m.revision.rev);
  const problems = orderProblems(id, files);
  const { ctx, problems: ctxProblems } = problems.length ? { ctx: undefined, problems: [] } : orderContext(id, m, files);
  problems.push(...ctxProblems);
  if (problems.length || !ctx) throw new Error(`order files not ready:\n  - ${problems.join("\n  - ")}`);
  const out = join(buildDir(id), "order");
  const { written, kept } = writeOrderPackage(id, m, files, ctx, out);
  const rel = (f: string) => relative(paths.root, f);
  console.log(`✔ ${id}: order files in ${rel(out)}`);
  for (const f of written) console.log(`  ${rel(f)}`);
  if (kept.length) console.log(`  kept (not written by this tool): ${kept.join(", ")}`);
} catch (e) {
  fail(id, e);
}
