import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { failure, parseCli } from "./cli.ts";

const USAGE = "usage: bun run x -- <id> [--draft] [--source bundle|gitlab]";
const OPTIONS = { draft: { type: "boolean" }, source: { type: "string" } } as const;

/** Runs parseCli in a child script, as `bun tools/cli/<x>.ts …` does (it exits on --help and usage errors). */
function child(args: string[]) {
  const script = join(mkdtempSync(join(tmpdir(), "cli-")), "x.ts");
  writeFileSync(script, `import { parseCli } from ${JSON.stringify(join(import.meta.dir, "cli.ts"))};
const r = parseCli(${JSON.stringify(USAGE)}, ${JSON.stringify(OPTIONS)});
console.log(JSON.stringify(r));`);
  const r = Bun.spawnSync([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

describe("parseCli", () => {
  test("flags and positionals; a leading -- is dropped", () => {
    const r = parseCli(USAGE, OPTIONS, ["--", "helmet-driver", "--draft", "--source", "gitlab"]);
    expect(r.positionals).toEqual(["helmet-driver"]);
    expect(r.values).toEqual({ draft: true, source: "gitlab" });
  });

  test("an unknown flag is a usage error (exit 2), not silently ignored", () => {
    const r = child(["helmet-driver", "--dratf"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--dratf");
    expect(r.err).toContain(USAGE);
  });

  test("--help prints the usage and exits 0", () => {
    const r = child(["--help"]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe(USAGE);
  });
});

test("failure line", () => {
  expect(failure("helmet-driver", new Error("no PCB spec"))).toBe("✘ helmet-driver: no PCB spec");
  expect(failure("models:fetch", "offline")).toBe("✘ models:fetch: offline");
});
