import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { compareFolders, normalized } from "./compare.ts";

const enc = (s: string) => new TextEncoder().encode(s);
const tree = (files: Record<string, string | Uint8Array>) => {
  const dir = mkdtempSync(join(tmpdir(), "compare-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
};

describe("normalized", () => {
  test("drops the plot-date lines of Gerber, drill and job files", () => {
    const g1 = "%TF.CreationDate,2026-09-25T13:13:28+02:00*%\nG04 Created by KiCad (PCBNEW 10.0.6) date 2026-09-25 13:13:28*\nX1Y2D03*\n";
    const g2 = "%TF.CreationDate,2026-09-28T20:00:00+02:00*%\nG04 Created by KiCad (PCBNEW 10.0.6) date 2026-09-28 20:00:00*\nX1Y2D03*\n";
    expect(normalized("a-F_Cu.gtl", enc(g1))).toBe(normalized("a-F_Cu.gtl", enc(g2)));
    expect(normalized("a-F_Cu.gtl", enc(g1))).not.toBe(normalized("a-F_Cu.gtl", enc(g2.replace("X1Y2", "X1Y3"))));
    expect(normalized("a-job.gbrjob", enc('  "CreationDate": "2026-09-25",\n  "x": 1\n'))).toBe(normalized("a-job.gbrjob", enc('  "CreationDate": "2026-09-28",\n  "x": 1\n')));
  });

  test("drops date and source of a DRC report, keeps everything else", () => {
    const a = '{\n  "date": "2026-09-25",\n  "source": "/a/b.kicad_pcb",\n  "violations": []\n}';
    const b = '{\n  "date": "2026-09-28",\n  "source": "/tmp/x/b.kicad_pcb",\n  "violations": []\n}';
    expect(normalized("drc.json", enc(a))).toBe(normalized("drc.json", enc(b)));
    expect(normalized("bom.csv", enc("date,1"))).toBe("date,1");
  });
});

describe("compareFolders", () => {
  test("equal content, zips compared by entry, skipped types ignored", () => {
    const zip = (d: string) => zipSync({
      "a-F_Cu.gtl": enc(`%TF.CreationDate,${d}*%\nX1Y2D03*\n`), "a-In1_Cu.g1": enc(`%TF.CreationDate,${d}*%\nX3Y4D03*\n`), "a-map.pdf": enc(d),
    });
    const a = tree({ "order/ORDER.md": "same", "order/x.zip": zip("2026-09-25"), "render/top.png": "1" });
    const b = tree({ "order/ORDER.md": "same", "order/x.zip": zip("2026-09-28"), "render/top.png": "2" });
    expect(compareFolders(a, b)).toEqual([]);
  });

  test("reports differing and missing files", () => {
    const a = tree({ "ORDER.md": "one", "bom.csv": "x", "image.jpg": "user" });
    const b = tree({ "ORDER.md": "two", "cpl.csv": "y" });
    expect(compareFolders(a, b)).toEqual([`differs: ORDER.md`, `only in ${a}: bom.csv`, `only in ${a}: image.jpg`, `only in ${b}: cpl.csv`]);
    expect(compareFolders(a, b, { ignoreOnlyInExpected: (rel) => rel === "image.jpg" })).not.toContain(`only in ${a}: image.jpg`);
  });
});
