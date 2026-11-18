// bun run fab -- <id> [--draft [--no-parity]]
// JLCPCB order files for the board modules/<id>. Never uploads or orders anything. --no-parity (DRC without
// the schematic-parity check) is only accepted together with --draft.
import { relative } from "node:path";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { runFab } from "../fab/fab.ts";

const USAGE = "usage: bun run fab -- <board-id> [--draft [--no-parity]]";
const { values, positionals } = parseCli(USAGE, { draft: { type: "boolean" }, "no-parity": { type: "boolean" } });
const id = positionals[0];
if (!id || positionals.length > 1) usageError(USAGE);
try {
  const r = await runFab({ id, draft: values.draft ?? false, parity: !values["no-parity"] });
  const parity = r.drc.parity ? "" : ", schematic parity NOT checked";
  console.log(`✔ ${id}: DRC 0 errors / 0 warnings${parity}, ${r.assembly ? `${r.bomLines} placements` : "PCB only (assembly: none)"}`);
  for (const f of r.files) console.log(`  ${relative(paths.root, f)}`);
  if (r.unverified.length) console.log(`  unverified sourcing: ${r.unverified.join(", ")}`);
  if (r.consigned.length) console.log(`  consigned (match them to your stock when ordering): ${r.consigned.join(", ")}`);
  for (const d of r.disputedRotations) console.log(`  check rotation: ${d}`);
} catch (e) {
  fail(id, e);
}
