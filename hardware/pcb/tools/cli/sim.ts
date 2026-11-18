// bun run sim -- <bench.cir> [...]
//
// Runs each testbench through ngspice (tools/sim/ngspice.ts), prints its measurements and
// PASS/FAIL per `* @assert` line. Exit code 1 if any bench fails or ngspice reports an error,
// 2 on usage errors. Output lands in build/sim/<bench name>/.
//
// Relative bench paths resolve against the current directory. `bun run` always starts scripts in
// the repo root and Bun 1.4.2 passes on no INIT_CWD, so with `bun run sim` they are relative to
// the repo root, wherever the shell is.
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { findNgspice, fmt, ngspiceVersion, runBench, type BenchResult } from "../sim/ngspice.ts";

const USAGE = [
  "usage: bun run sim -- <bench.cir> [...]",
  "  Bench paths are relative to the repo root (where `bun run` starts) or absolute,",
  "  e.g. bun run sim -- tests/fixtures/sim/rc-lowpass.cir",
].join("\n");

const rel = (p: string) => relative(process.cwd(), p) || ".";

function report(r: BenchResult): void {
  console.log(`\n${rel(r.bench)}  ->  ${rel(r.outDir)}/`);
  for (const m of r.measurements) {
    const extra = Object.entries(m.extra).map(([k, v]) => `${k}=${fmt(v)}`);
    console.log(`  ${m.name} = ${fmt(m.value)}${extra.length ? `  (${extra.join(" ")})` : ""}`);
  }
  for (const a of r.assertions) {
    const actual = a.actual === null ? "" : `${fmt(a.actual)}, `;
    console.log(`  ${a.pass ? "PASS" : "FAIL"}  ${a.assertion.text}  (${actual}${a.detail})`);
  }
  for (const w of r.warnings) console.log(`  warning: ${w}`);
  for (const e of r.errors) console.log(`  error: ${e}`);
  console.log(r.ok ? "  => PASS" : `  => FAIL (log: ${rel(r.logPath)})`);
}

export async function main(args: string[]): Promise<number> {
  if (args.length === 0 || args.some((a) => a === "-h" || a === "--help")) {
    console.error(USAGE);
    return 2;
  }
  const bin = findNgspice();
  if (!bin) {
    console.error("ngspice not found: set $NGSPICE or install it (brew install ngspice)");
    return 1;
  }
  console.log(`ngspice-${await ngspiceVersion(bin)} (${bin})`);

  let failed = 0;
  for (const bench of args) {
    if (!existsSync(resolve(bench))) {
      const hint = isAbsolute(bench) ? "" : ` (relative to ${process.cwd()}; \`bun run sim\` always runs from the repo root)`;
      console.log(`\n${bench}\n  error: bench not found${hint}\n  => FAIL`);
      failed++;
      continue;
    }
    try {
      const r = await runBench(bench, { ngspice: bin });
      report(r);
      if (!r.ok) failed++;
    } catch (e) {
      console.log(`\n${bench}\n  error: ${(e as Error).message}\n  => FAIL`);
      failed++;
    }
  }
  console.log(`\n${args.length} bench${args.length === 1 ? "" : "es"}: ${args.length - failed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
