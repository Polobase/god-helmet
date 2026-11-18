import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staleInputs, writeInputs } from "./inputs.ts";

describe("inputs.json", () => {
  const src = mkdtempSync(join(tmpdir(), "inputs-src-"));
  const out = mkdtempSync(join(tmpdir(), "inputs-out-"));
  const a = join(src, "board.kicad_pcb");
  const b = join(src, "module.yaml");

  test("fresh after writing; a touch changes nothing; an edit or a deletion is reported", () => {
    writeFileSync(a, "board");
    writeFileSync(b, "yaml");
    writeInputs(out, [b, a, a]);
    expect(Object.keys(JSON.parse(readFileSync(join(out, "inputs.json"), "utf8")))).toEqual([a, b].sort());
    expect(staleInputs(out)).toEqual([]);
    const later = new Date(Date.now() + 60_000);
    utimesSync(a, later, later);
    expect(staleInputs(out)).toEqual([]);
    writeFileSync(b, "yaml, edited");
    expect(staleInputs(out)).toEqual([b]);
    rmSync(a);
    expect(staleInputs(out)).toEqual([a, b].sort());
  });

  test("no inputs.json: null (an export made before this check)", () => {
    expect(staleInputs(mkdtempSync(join(tmpdir(), "inputs-none-")))).toBeNull();
  });
});
