import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvalProblems } from "./approve.ts";
import { sha256File } from "../lib/hash.ts";
import type { GateRecord } from "./gates.ts";

const root = mkdtempSync(join(tmpdir(), "ghp-approve-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function setup(name: string) {
  const dir = join(root, name);
  const schPath = join(dir, "m.kicad_sch");
  const pdf = join(dir, "m.pdf");
  const recordPath = join(dir, "gates.json");
  Bun.spawnSync(["mkdir", "-p", dir]);
  writeFileSync(schPath, "(kicad_sch)\n");
  writeFileSync(pdf, "%PDF-1.7 test\n");
  const record: GateRecord = {
    schematic: `${name}/m.kicad_sch`, schSha256: sha256File(schPath), inputSha256: "x", pdf: `${name}/m.pdf`,
    pdfSha256: sha256File(pdf), kicadVersion: "10.0.6", git: "test", erc: { errors: 0, warnings: 0, ignored: [] },
  };
  writeFileSync(recordPath, JSON.stringify(record));
  return { schPath, pdf, recordPath, root, generated: "(kicad_sch)\n" };
}

test("passes when record, schematic, PDF and source agree", () => {
  expect(approvalProblems(setup("ok"))).toEqual([]);
});

test("refuses without a passing gate run", () => {
  const p = setup("norecord");
  rmSync(p.recordPath);
  expect(approvalProblems(p).join()).toContain("no passing gate run");
});

test("refuses a schematic that changed after the gate run (e.g. a failed later run)", () => {
  const p = setup("changed");
  writeFileSync(p.schPath, "(kicad_sch changed)\n");
  expect(approvalProblems({ ...p, generated: "(kicad_sch changed)\n" }).join()).toContain("changed after the last passing gate run");
});

test("refuses when the reviewed PDF is gone or different", () => {
  const p = setup("pdf");
  writeFileSync(p.pdf, "%PDF other\n");
  expect(approvalProblems(p).join()).toContain("not the PDF of the passing run");
});

test("refuses when schematic.ts no longer generates the file", () => {
  const p = setup("drift");
  expect(approvalProblems({ ...p, generated: "(kicad_sch new)\n" }).join()).toContain("no longer generates");
});
