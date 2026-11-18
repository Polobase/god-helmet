// bun run sch:check [-- <id>...]
// Regenerate every schematic in memory and compare with the committed files (drift check): the root
// schematic, every page file of a design with pages, the library tables; and no page file of a removed page may
// be left over. Needs no KiCad, so it runs in `bun run check` and CI.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { failure, parseCli } from "../lib/cli.ts";
import { paths } from "../lib/paths.ts";
import { strayPageFiles } from "../sch/files.ts";
import { generate, loadDesign } from "../sch/generate.ts";

function allIds(): string[] {
  if (!existsSync(paths.modules)) return [];
  return readdirSync(paths.modules).filter((d) => existsSync(join(paths.modules, d, "schematic.ts"))).sort();
}

const { positionals } = parseCli("usage: bun run sch:check [-- <board-id>…]   (default: every schematic)", {});
const ids = positionals.length ? positionals : allIds();
let drift = 0;
for (const id of ids) {
  const before = drift;
  try {
    const g = generate(id, await loadDesign(id));
    for (const [file, content] of g.files) {
      const rel = relative(paths.root, file);
      if (!existsSync(file)) {
        console.error(`✘ ${rel} is missing (run bun run sch -- ${id})`);
        drift++;
      } else if (readFileSync(file, "utf8") !== content) {
        console.error(`✘ ${rel} differs from its source (run bun run sch -- ${id}; never edit generated files)`);
        drift++;
      }
    }
    for (const file of strayPageFiles(g.kicadDir, id, g.schPaths)) {
      console.error(`✘ ${relative(paths.root, file)} is the file of a page the design no longer has (run bun run sch -- ${id}, which removes it)`);
      drift++;
    }
    if (drift === before) console.log(`✔ ${id}: generated files are up to date`);
  } catch (e) {
    console.error(failure(id, e));
    drift++;
  }
}
if (!ids.length) console.log("no schematics yet");
process.exit(drift ? 1 : 0);
