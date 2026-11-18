// Approval preconditions for `bun run sch:approve`: the schematic on disk must be exactly the one
// the last passing gate run checked and exported to the reviewed PDF, and schematic.ts must still
// generate it. Returns the problems (empty = may be approved). A schematic with pages is the root file and
// every page file: all of them count.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { sha256File } from "../lib/hash.ts";
import { schematicSha256 } from "./files.ts";
import type { GateRecord } from "./gates.ts";

export interface ApprovalInputs {
  schPath: string;
  /** build/<id>/gates.json */
  recordPath: string;
  /** Root the record's relative paths resolve against (the repo). */
  root: string;
  /** What schematic.ts generates now. */
  generated: string;
  /** What it generates now for the pages (path → content), for a schematic with pages. */
  pages?: Map<string, string>;
}

export function approvalProblems(p: ApprovalInputs): string[] {
  if (!existsSync(p.schPath)) return [`${p.schPath} not found; run bun run sch first`];
  if (!existsSync(p.recordPath)) return ["no passing gate run recorded; run bun run sch and review its PDF first"];
  const record = JSON.parse(readFileSync(p.recordPath, "utf8")) as GateRecord;
  const problems: string[] = [];
  let sha: string;
  try {
    sha = schematicSha256(p.schPath);
  } catch (e) {
    return [`${(e as Error).message}; run bun run sch first`];
  }
  if (record.schSha256 !== sha) problems.push("the schematic changed after the last passing gate run; run bun run sch again and review the new PDF");
  const pdf = join(p.root, record.pdf);
  if (!existsSync(pdf) || sha256File(pdf) !== record.pdfSha256) problems.push(`${record.pdf} is missing or not the PDF of the passing run`);
  const stale = [...(p.pages ?? [])].filter(([f, text]) => !existsSync(f) || readFileSync(f, "utf8") !== text).map(([f]) => basename(f));
  if (p.generated !== readFileSync(p.schPath, "utf8") || stale.length) {
    problems.push(`schematic.ts no longer generates this schematic${stale.length ? ` (${stale.join(", ")})` : ""}; run bun run sch again`);
  }
  return problems;
}
