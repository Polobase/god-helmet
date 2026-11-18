// bun run verify:outputs -- <id> [--against <folder>] [--keep]
//   Regenerates a board's order outputs into a temp folder (fab, order) and compares them with a reference
//   folder laid out like build/<id>/ (default: build/<id>). Zips are compared entry by entry. Plot dates, DRC
//   dates and paths, PDFs, PNGs, SVGs and netlists are ignored (tools/fab/compare.ts).
//   It never writes into build/<id>/ or modules/. It proves that a tool change left the outputs alone.
//   Headless DRC can crash on macOS with KiCad 10.0.4–10.0.6 (#25413): run it from a logged-in Terminal.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { compareFolders, SKIPPED } from "../fab/compare.ts";
import { runFab } from "../fab/fab.ts";
import { orderContext, orderFiles, ORDER_ENTRIES, writeOrderPackage } from "../fab/order.ts";
import { failure, parseCli, usageError } from "../lib/cli.ts";
import { buildDir, paths, projectDir } from "../lib/paths.ts";
import { loadProjectYaml } from "../module/load.ts";

const USAGE = "usage: bun run verify:outputs -- <board-id> [--against <folder like build/<id>>] [--keep]";
const { values, positionals } = parseCli(USAGE, { against: { type: "string" }, keep: { type: "boolean" } });
const id = positionals[0];
if (!id || positionals.length > 1) usageError(USAGE);
const rel = (f: string) => relative(paths.root, f) || ".";
const against = values.against ?? buildDir(id);
const tmp = mkdtempSync(join(tmpdir(), `verify-${id}-`));
const diffs: string[] = [];
try {
  const m = loadProjectYaml(join(projectDir(id), "module.yaml"));
  const rev = m.revision.rev;
  await runFab({ id, buildRoot: tmp });
  const files = orderFiles(id, rev, tmp);
  const { ctx, problems } = orderContext(id, m, files);
  if (!ctx) throw new Error(problems.join("; "));
  writeOrderPackage(id, m, files, ctx, join(tmp, id, "order"));

  // The order outputs: against the reference folder.
  const pairs: [string, string][] = [
    [join(against, "fab", `rev-${rev}`), join(tmp, id, "fab", `rev-${rev}`)],
    [join(against, "order"), join(tmp, id, "order")],
  ];
  for (const [expected, actual] of pairs) {
    if (!existsSync(expected)) {
      diffs.push(`reference folder missing: ${rel(expected)}`);
      continue;
    }
    // Files the user put into order/ are not outputs (writeOrderPackage keeps them).
    const own = (r: string) => ORDER_ENTRIES.some((e) => r === e || r.startsWith(`${e}/`));
    const ignore = expected.endsWith("order") ? (r: string) => !own(r) : () => false;
    diffs.push(...compareFolders(expected, actual, { ignoreOnlyInExpected: ignore }));
  }
} catch (e) {
  console.error(failure(id, e));
  process.exitCode = 1;
} finally {
  if (values.keep) console.log(`  regenerated outputs kept in ${tmp}`);
  else rmSync(tmp, { recursive: true, force: true });
}
if (process.exitCode !== 1) {
  if (diffs.length) {
    console.error(`✘ ${id}: outputs differ from ${rel(against)}:\n  - ${diffs.join("\n  - ")}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ${id}: fab and order outputs equal ${rel(against)} (plot dates, ${[...SKIPPED].join(", ")} ignored)`);
  }
}
