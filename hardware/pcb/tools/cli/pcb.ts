// bun run pcb -- <id> [--no-route]
//   Place and route the board from its approved schematic (tools/pcb/flow.ts) with the board's
//   spec (modules/<id>/pcb.ts), then DRC with schematic parity. Writes
//   modules/<id>/kicad/<id>.kicad_pcb and build/<id>/pcb/ (job, DSN/SES, Freerouting log, DRC).
//   A spec with `route: "scripted"` is not autorouted: it places every part and draws its own copper.
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths, projectDir } from "../lib/paths.ts";
import { runPcb, type PcbSpec } from "../pcb/flow.ts";

const USAGE = "usage: bun run pcb -- <board-id> [--no-route]";
const { values, positionals } = parseCli(USAGE, { "no-route": { type: "boolean" } });
const id = positionals[0];
if (!id || positionals.length > 1) usageError(USAGE);
try {
  const specFile = join(projectDir(id), "pcb.ts");
  if (!existsSync(specFile)) throw new Error(`no PCB spec (${relative(paths.root, specFile)})`);
  const { spec } = (await import(specFile)) as { spec: PcbSpec };
  const r = await runPcb(id, spec, { route: !values["no-route"] });
  const ok = r.problems.length === 0 && r.unrouted <= 0;
  const how = spec.route === "scripted"
    ? `scripted layout; ${r.unrouted < 0 ? "copper not drawn" : `${r.unrouted} unconnected`}`
    : `${r.placed} SMD parts placed in ${r.placeSeconds.toFixed(1)} s; ${r.unrouted < 0 ? "not routed" : `${r.unrouted} unconnected (routing run ${r.attempts}; Freerouting left ${r.routerOpen})`}`;
  console.log(`${ok ? "✔" : "✘"} ${id}: ${how}; DRC ${r.drc.errors} errors / ${r.drc.warnings} warnings (parity)`);
  console.log(`  ${relative(paths.root, r.board)}`);
  for (const p of r.problems) console.log(`  ${p}`);
  if (r.drc.types.length) console.log(`  violation types: ${r.drc.types.join(", ")}`);
  process.exit(ok ? 0 : 1);
} catch (e) {
  fail(id, e);
}
