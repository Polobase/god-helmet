// bun run sch:approve -- <id> --yes [--date YYYY-MM-DD]
// Record the user's approval of the reviewed schematic PDF in modules/<id>/module.yaml
// (revision.approval = sha256 of the .kicad_sch, or of it and its page files, + date; status -> schematic-approved).
// Only run after the user explicitly approved the PDF. Refuses unless the last `bun run sch`
// passed every gate for exactly this file: build/<id>/gates.json must match the schematic on disk,
// the PDF the user reviewed, and what schematic.ts generates now.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { fail, parseCli, usageError } from "../lib/cli.ts";
import { paths, projectDir } from "../lib/paths.ts";
import { gateRecordPath, type GateRecord } from "../sch/gates.ts";
import { approvalProblems } from "../sch/approve.ts";
import { schematicSha256 } from "../sch/files.ts";
import { generate, loadDesign } from "../sch/generate.ts";

const USAGE = "usage: bun run sch:approve -- <board-id> --yes [--date YYYY-MM-DD]   (only after the user approved the PDF)";
const { values, positionals } = parseCli(USAGE, { yes: { type: "boolean" }, date: { type: "string" } });
const id = positionals[0];
if (!id || positionals.length > 1 || !values.yes) usageError(USAGE);

const refuse = (msg: string): never => fail(id, msg);

let dir: string;
try {
  dir = projectDir(id);
} catch (e) {
  fail(id, e);
}
const yamlPath = join(dir, "module.yaml");
const schPath = join(dir, "kicad", `${id}.kicad_sch`);
if (!existsSync(yamlPath)) refuse(`${yamlPath} not found`);
if (!existsSync(schPath)) refuse(`${schPath} not found; run bun run sch -- ${id} first`);
const g = generate(id, await loadDesign(id));
const pages = new Map(g.schPaths.slice(1).map((f) => [f, g.files.get(f) ?? ""]));
const problems = approvalProblems({ schPath, recordPath: gateRecordPath(id), root: paths.root, generated: g.files.get(g.schPath) ?? "", pages });
if (problems.length) refuse(problems.join("; "));
const record = JSON.parse(readFileSync(gateRecordPath(id), "utf8")) as GateRecord;
const sha = schematicSha256(schPath);

const local = new Date();
const today = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
const date = values.date ?? today;
const doc = parseDocument(readFileSync(yamlPath, "utf8"));
doc.setIn(["revision", "approval"], doc.createNode({ schSha256: sha, date }));
doc.setIn(["revision", "status"], "schematic-approved");
// lineWidth 0: keep one-line flow maps (drawMa, sizeMm) as written; the default 80 would re-wrap them.
writeFileSync(yamlPath, doc.toString({ lineWidth: 0 }));
console.log(`✔ ${id}: approved schematic sha256 ${sha.slice(0, 12)}… (PDF ${record.pdf}, KiCad ${record.kicadVersion}) on ${date}`);
