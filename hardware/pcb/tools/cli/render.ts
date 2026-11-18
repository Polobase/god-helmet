// bun run render -- <id>
//   3D renders of the assembled board, every part included: footprints KiCad has no 3D model for get
//   simple stand-ins (tools/pcb/render3d.ts STAND_INS), spacer-mounted parts are lifted (module.yaml
//   jlcpcb.standoffs). Writes build/<id>/render/<id>-{top,bottom,iso}.png; the board itself is not changed.
import { join, relative } from "node:path";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths, projectDir } from "../lib/paths.ts";
import { loadProjectYaml } from "../module/load.ts";
import { renderBoard } from "../pcb/render3d.ts";

const USAGE = "usage: bun run render -- <board-id>";
const { positionals } = parseCli(USAGE, {});
const id = positionals[0];
if (!id || positionals.length > 1) usageError(USAGE);
try {
  const m = loadProjectYaml(join(projectDir(id), "module.yaml"));
  const files = await renderBoard(id, m.jlcpcb.standoffs);
  console.log(`✔ ${id}: 3D renders`);
  for (const f of files) console.log(`  ${relative(paths.root, f)}`);
} catch (e) {
  fail(id, e);
}
