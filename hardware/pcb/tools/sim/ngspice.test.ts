import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { run } from "../lib/proc.ts";
import { toolAvailable } from "../lib/testing.ts";
import {
  benchOutDir,
  checkAnalyses,
  checkControlBlocks,
  compatModeProblem,
  evaluateAssertions,
  findNgspice,
  parseAssertions,
  parseLog,
  parseMeasurements,
  parseSpiceNumber,
  parseWrdata,
  readWrdata,
  runBench,
  SimError,
  SPICEINIT,
  type Measurement,
} from "./ngspice.ts";

const FIXTURES = join(paths.fixtures, "sim");
const CAPTURED = join(FIXTURES, "ngspice-47");
const captured = (name: string) => readFileSync(join(CAPTURED, name), "utf8");

const tmpDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ghp-sim-"));
  tmpDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const meas = (name: string, value: number): Measurement => ({ name, value, extra: {}, line: 1 });

/** A temporary copy of tools/ and the sim fixtures. The default outDir hangs off the repo root
 *  (paths.ts resolves it from its own location), so runs without outDir go through the CLI in
 *  this copy and never touch the real build/sim/. */
function repoCopy(): string {
  const root = realpathSync(tempDir()); // macOS: /var → /private/var, as the child's cwd reports it
  cpSync(join(paths.root, "tools"), join(root, "tools"), { recursive: true, filter: (src) => !src.endsWith(".test.ts") });
  cpSync(FIXTURES, join(root, "tests/fixtures/sim"), { recursive: true });
  return root;
}
const simCli = (root: string, ...args: string[]) => run([process.execPath, join(root, "tools/cli/sim.ts"), ...args], { cwd: root });
const repoSimFiles = () => {
  const dir = join(paths.build, "sim");
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).sort() : [];
};

describe("parseSpiceNumber", () => {
  test.each([
    ["1591.55", 1591.55],
    ["-3", -3],
    [".5", 0.5],
    ["1e3", 1000],
    ["2.5E-3", 0.0025],
    ["1.6k", 1600],
    ["1.1k", 1100],
    ["1.55K", 1550],
    ["10n", 1e-8],
    ["2.2u", 2.2e-6],
    ["5m", 0.005],
    ["1meg", 1e6],
    ["1MEG", 1e6],
    ["3g", 3e9],
    ["1t", 1e12],
    ["10p", 1e-11],
    ["1f", 1e-15],
    ["1a", 1e-18],
    ["1.5e-3m", 1.5e-6],
  ])("%p -> %p", (text, value) => expect(parseSpiceNumber(text)).toBe(value));

  test("mil", () => expect(parseSpiceNumber("1mil")).toBeCloseTo(25.4e-6, 12));

  test.each(["", "abc", "10Hz", "1.6kHz", "1e", "1..2", "k"])("rejects %p", (text) => {
    expect(() => parseSpiceNumber(text)).toThrow(SimError);
  });

  test('rejects a lone "M" (SPICE milli, easily meant as mega)', () => {
    expect(() => parseSpiceNumber("1M")).toThrow(/milli/);
  });
});

describe("parseMeasurements", () => {
  test("captured ngspice 47 log: .meas, meas and print results with their extras", () => {
    const ms = parseMeasurements(captured("capture.log"));
    expect(ms.map((m) => m.name)).toEqual(["vmax", "tvmax", "vpp", "vfind", "tcross", "yadd", "cmax", "gain"]);
    const by = Object.fromEntries(ms.map((m) => [m.name, m]));
    expect(by.vmax).toMatchObject({ value: 0.861751, extra: { at: 3.34521e-4 } });
    expect(by.tvmax).toMatchObject({ value: 3.34521e-4, extra: { with: 0.861751 } });
    expect(by.vpp).toMatchObject({ value: 1.70767, extra: { from: 0, to: 1e-3 } });
    expect(by.vfind!.value).toBe(0.453049);
    expect(by.tcross!.value).toBe(5.00005e-4);
    expect(by.yadd!.value).toBe(12);
    expect(by.gain!.value).toBe(2.5);
    expect(by.vmax!.line).toBe(42);
  });

  test("names are lowercased; nan and inf parse", () => {
    const ms = parseMeasurements("F3DB = 1.5e+03\nbad = nan\nbig = -inf\n");
    expect(ms.map((m) => [m.name, m.value])).toEqual([
      ["f3db", 1500],
      ["bad", Number.NaN],
      ["big", -Infinity],
    ]);
  });

  test("ignores prose, complex prints, the netlist echo and non-numeric values", () => {
    const log = [
      "Doing analysis at TEMP = 27.000000 and TNOM = 27.000000",
      "Total analysis time (seconds) = 0.002015",
      "Maximum ngspice program size =    9.812 MB.",
      "No. of Data Rows : 501",
      "v(out) = 7.169568e-01,  -4.504772e-01",
      " .meas tran never when v(out)=5 rise=1 failed!",
      "x = 1.0 at= abc",
      "Note: Compatibility modes selected: ps lt a",
    ].join("\n");
    expect(parseMeasurements(log)).toEqual([]);
  });
});

describe("parseLog", () => {
  test("captured log: failed .meas statements are errors and are named", () => {
    const s = parseLog(captured("capture.log"));
    expect(s.failedMeasurements).toEqual(["tdiff", "never"]);
    expect(s.errors).toEqual([
      "Error: measure  tdiff  trig(TARG) : out of interval",
      "Error: measure  never  when(WHEN) : out of interval",
    ]);
    expect(s.warnings).toEqual([]);
  });

  test("fatal errors and warnings as ngspice 47 prints them", () => {
    const s = parseLog(
      [
        "Warning: can't parse 'vd': ignored",
        "Error: no data saved for A.C. Small signal analysis; analysis not run",
        "doAnalyses: not found",
        "run simulation(s) aborted",
        "warning, can't find model 'b' from line",
        "Error on line 4 or its substitute:",
        "Error: Could not find include file nothere.lib",
        "ERROR: fatal error in ngspice, exit(1)",
        "    Simulation interrupted due to error!",
      ].join("\n"),
    );
    expect(s.errors).toHaveLength(6);
    expect(s.warnings).toEqual(["Warning: can't parse 'vd': ignored", "warning, can't find model 'b' from line"]);
  });

  test("a mistyped .control command is an error (ngspice 47 exits 0 and prints no Error prefix)", () => {
    expect(parseLog("wrdat: no such command available in ngspice\n").errors).toEqual(["wrdat: no such command available in ngspice"]);
  });

  test("measurements named error or warning are results, not errors or warnings", () => {
    const s = parseLog("error               =  -1.71449e-04\nwarning             =  -1.71115e-02\n");
    expect(s.errors).toEqual([]);
    expect(s.warnings).toEqual([]);
    expect(s.measurements.map((m) => m.name)).toEqual(["error", "warning"]);
  });
});

describe("compatModeProblem", () => {
  // The wordings ngspice 47 printed on 2026-09-24 for ngbehavior=ltpsa, none, ps and kicad.
  test("accepts only ltpsa", () => {
    expect(compatModeProblem("Circuit: * t\nNote: Compatibility modes selected: ps lt a\n")).toBeNull();
    expect(compatModeProblem("Note: No compatibility mode selected!\n")).toMatch(/used compatibility mode "none", not "ps lt a"/);
    expect(compatModeProblem("Note: Compatibility modes selected: ps\n")).toMatch(/used compatibility mode "ps", not "ps lt a"/);
    expect(compatModeProblem("Note: Compatibility modes selected: ki a\n")).toMatch(/"ki a"/);
    expect(compatModeProblem("")).toMatch(/does not say which compatibility mode/);
  });
});

describe("parseAssertions", () => {
  test("all forms, Unicode and ASCII", () => {
    const bench = [
      "* title",
      "* @assert f3db ≈ 1591.55 ±2%",
      "*@assert Offset ~= 0 +-5m",
      "  * @ASSERT gain between -0.1 1.2k",
      "* @assert x ≈ 1.6k ± 0.5 %",
      "R1 a b 1k",
    ].join("\n");
    const as = parseAssertions(bench);
    expect(as.map((a) => [a.name, a.check, a.line])).toEqual([
      ["f3db", { op: "approx", expected: 1591.55, tolerance: 2, relative: true }, 2],
      ["offset", { op: "approx", expected: 0, tolerance: 0.005, relative: false }, 3],
      ["gain", { op: "between", lo: -0.1, hi: 1200 }, 4],
      ["x", { op: "approx", expected: 1600, tolerance: 0.5, relative: true }, 5],
    ]);
    expect(as[0]!.text).toBe("f3db ≈ 1591.55 ±2%");
  });

  test("only full-line `*` comments starting with @assert count", () => {
    expect(parseAssertions("* note: @assert f ≈ 1 ±1%\nR1 a b 1k ; @assert f ≈ 1 ±1%\n")).toEqual([]);
  });

  test.each([
    ["* @assert f3db = 1591 ±2%", /expected/],
    ["* @assert f3db ≈ 1591", /expected/],
    ["* @assert f3db ≈ 1591.55 ±2% extra", /expected/],
    ["* @assert f3db ≈ 1.6kHz ±2%", /not a number/],
    ["* @assert f3db ≈ 1M ±2%", /milli/],
    ["* @assert f3db ≈ 0 ±2%", /relative tolerance around 0/],
    ["* @assert f3db ≈ 1 ±-2%", /tolerance/],
    ["* @assert f3db between 2 1", /lower bound/],
  ])("rejects %p", (line, message) => {
    expect(() => parseAssertions(`* title\n${line}\n`, "bench.cir")).toThrow(message);
    expect(() => parseAssertions(`* title\n${line}\n`, "bench.cir")).toThrow(/^bench\.cir:2: bad @assert/);
  });
});

describe("evaluateAssertions", () => {
  const check = (assert: string, measurements: Measurement[], failedMeasurements: string[] = []) =>
    evaluateAssertions(parseAssertions(`* @assert ${assert}`), { measurements, failedMeasurements })[0]!;

  test("relative tolerance, inclusive at the limit", () => {
    expect(check("f ≈ 100 ±2%", [meas("f", 102)]).pass).toBe(true);
    expect(check("f ≈ 100 ±2%", [meas("f", 97.9)])).toMatchObject({ pass: false, actual: 97.9, detail: "deviation -2.10%, allowed 98 … 102" });
    expect(check("f ≈ -100 ±2%", [meas("f", -101)]).pass).toBe(true);
  });

  test("absolute tolerance", () => {
    expect(check("g ≈ 0 ±0.01", [meas("g", -1.71449e-4)])).toMatchObject({ pass: true, detail: "deviation -0.000171449" });
    expect(check("g ≈ 0 ±10m", [meas("g", 0.011)]).pass).toBe(false);
  });

  test("between is a closed interval", () => {
    expect(check("f between 1.55k 1.65k", [meas("f", 1550)]).pass).toBe(true);
    expect(check("f between 1.55k 1.65k", [meas("f", 1650.1)])).toMatchObject({ pass: false, detail: "outside 1550 … 1650" });
  });

  test("NaN never passes", () => {
    expect(check("f ≈ 1 ±100%", [meas("f", Number.NaN)]).pass).toBe(false);
    expect(check("f between -1meg 1meg", [meas("f", Number.NaN)]).pass).toBe(false);
  });

  test("missing measurement fails, with ngspice's failure named when there is one", () => {
    expect(check("f ≈ 1 ±1%", [meas("other", 1)])).toMatchObject({ pass: false, actual: null, detail: expect.stringMatching(/not measured/) });
    expect(check("f ≈ 1 ±1%", [], ["f"]).detail).toMatch(/ngspice reported this measurement as failed/);
  });

  test("a name measured twice with different values is ambiguous; identical repeats are fine", () => {
    expect(check("f ≈ 1 ±50%", [meas("f", 1), meas("f", 1.1)])).toMatchObject({ pass: false, detail: expect.stringMatching(/ambiguous/) });
    expect(check("f ≈ 1 ±50%", [meas("f", 1), meas("f", 1)]).pass).toBe(true);
  });
});

describe("checkControlBlocks", () => {
  test("accepts benches without .control and blocks ending in quit/exit", () => {
    expect(() => checkControlBlocks("* t\nR1 a 0 1k\n.op\n.end\n")).not.toThrow();
    expect(() => checkControlBlocks("* t\n.control\nrun\nquit\n.endc\n")).not.toThrow();
    expect(() => checkControlBlocks("* t\n.CONTROL\nrun\nexit\n.ENDC\n")).not.toThrow();
    expect(() => checkControlBlocks("* t\n.control\nrun\nquit 3\n.endc\n")).not.toThrow();
  });

  test("rejects a block without quit (ngspice -b would rerun the analyses) and one without .endc", () => {
    expect(() => checkControlBlocks("* t\n.control\nrun\n.endc\n", "b.cir")).toThrow(/^b\.cir:2: .control block has no "quit"/);
    expect(() => checkControlBlocks("* t\n.control\nrun\nquit\n", "b.cir")).toThrow(/without .endc/);
  });
});

describe("checkAnalyses", () => {
  const RC = "V1 in 0 DC 0 AC 1 SIN(0 1 1k)\nR1 in out 10k\nC1 out 0 10n\n";

  test("accepts one dot-analysis with .meas, several without, and analysis commands in .control", () => {
    expect(() => checkAnalyses(`* t\n${RC}.ac dec 10 10 1Meg\n.meas ac f WHEN vdb(out)=-3 FALL=1\n.end\n`)).not.toThrow();
    expect(() => checkAnalyses(`* t\n${RC}.ac dec 10 10 1Meg\n.tran 10u 2m\n.end\n`)).not.toThrow();
    expect(() =>
      checkAnalyses(`* t\n${RC}.ac dec 10 10 1Meg\n.meas tran v RMS v(out)\n.control\nrun\ntran 10u 2m\nquit\n.endc\n.end\n`),
    ).not.toThrow();
    // .options is not .op
    expect(() => checkAnalyses(`* t\n.options reltol=1m\n.ac dec 10 10 1Meg\n.meas ac f MAX vdb(out)\n`)).not.toThrow();
  });

  test.each([
    [".ac + .tran", ".ac dec 10 10 1Meg\n.tran 10u 2m\n", /\.ac on line 5, \.tran on line 6/],
    [".op + .ac", ".OP\n.AC dec 10 10 1Meg\n", /2 dot-analyses/],
    ["two .ac lines", ".ac dec 10 10 1Meg\n.ac dec 100 10 1Meg\n", /2 dot-analyses/],
  ])("rejects .meas with %s (ngspice drops the earlier analyses' .meas)", (_, analyses, message) => {
    const netlist = `* t\n${RC}${analyses}.MEASURE ac f WHEN vdb(out)=-3 FALL=1\n.control\nrun\nquit\n.endc\n.end\n`;
    expect(() => checkAnalyses(netlist, "b.cir")).toThrow(message);
    expect(() => checkAnalyses(netlist, "b.cir")).toThrow(/^b\.cir: .meas lines with/);
  });
});

describe("parseWrdata", () => {
  test("wr_singlescale + wr_vecnames, real vectors", () => {
    const w = parseWrdata(captured("ac-real-names.dat"));
    expect(w.scaleName).toBe("frequency");
    expect(w.scale).toEqual([10, 100, 1000]);
    expect(w.vectors.map((v) => v.name)).toEqual(["vdb(out)", "vp(out)"]);
    expect(w.vectors[0]!.real).toEqual([-1.71449205e-4, -1.71115043e-2, -1.44507012]);
    expect(w.vectors[0]!.imag).toBeUndefined();
  });

  test("complex vector without header needs the layout", () => {
    const w = parseWrdata(captured("ac-complex.dat"), { complex: true, singleScale: true });
    expect(w.scaleName).toBeNull();
    expect(w.scale).toEqual([10, 100, 1000]);
    const v = w.vectors[0]!;
    expect(v.real[2]).toBe(0.7169568);
    expect(v.imag![2]).toBe(-0.450477243);
    // |H(1 kHz)| of the RC low-pass (fc = 1591.55 Hz) = 1/sqrt(1 + (1000/1591.55)^2) = 0.846733
    expect(Math.hypot(v.real[2]!, v.imag![2]!)).toBeCloseTo(1 / Math.sqrt(1 + (1000 * 2 * Math.PI * 1e-4) ** 2), 5);
    // Scale + (re, im) per vector is the same column shape without wr_singlescale.
    expect(parseWrdata(captured("ac-complex.dat"), { complex: true })).toEqual(w);
  });

  test("a wrong layout is detected instead of misread", () => {
    expect(() => parseWrdata(captured("ac-complex.dat"))).toThrow(/don't fit layout/);
    expect(() => parseWrdata(captured("tran-real-2vec.dat"), { complex: true })).toThrow(/don't fit layout/);
  });

  test("two complex vectors, each with its own scale column, header names each twice", () => {
    const w = parseWrdata(captured("ac-complex-2vec-names.dat"));
    expect(w.scaleName).toBe("frequency");
    expect(w.scale).toEqual([10, 100, 1000]);
    expect(w.vectors.map((v) => v.name)).toEqual(["v(out)", "v(in)"]);
    expect(w.vectors[1]).toEqual({ name: "v(in)", real: [1, 1, 1], imag: [0, 0, 0] });
    expect(w.vectors[0]!.imag![0]).toBe(-6.28293727e-3);
  });

  test("two real vectors with repeated scale columns, no header", () => {
    const w = parseWrdata(captured("tran-real-2vec.dat"));
    expect(w.scale).toEqual([0, 1e-7, 1.08405602e-7, 1.25216807e-7, 1.58839216e-7]);
    expect(w.vectors.map((v) => v.name)).toEqual([null, null]);
    expect(w.vectors[0]!.real[1]).toBe(6.28318489e-4);
    expect(w.vectors[1]!.real[1]).toBe(6.27690799e-7);
  });

  test("rejects differing scale columns, ragged rows, junk and empty input", () => {
    expect(() => parseWrdata(" 1 2 1 3\n 2 4 3 5\n")).toThrow(/scale columns differ/);
    expect(() => parseWrdata(" 1 2\n 2\n")).toThrow(/line 2: 1 columns, expected 2/);
    expect(() => parseWrdata("time v(out)\n 1 x\n")).toThrow(/not a number: "x"/);
    expect(() => parseWrdata("\n\n")).toThrow(/empty/);
  });
});

describe("runBench guards (no ngspice needed)", () => {
  const bench = (dir: string, body: string) => {
    const p = join(dir, "b.cir");
    writeFileSync(p, `* guard test\n* @assert x ≈ 1 ±1%\n${body}.end\n`);
    return p;
  };

  test("default output folder is build/sim/<bench name>/", () => {
    expect(benchOutDir("tests/fixtures/sim/rc-lowpass.cir")).toBe(join(paths.build, "sim", "rc-lowpass"));
  });

  test("refuses a .spiceinit or spice.rc next to the bench (ngspice would read it instead)", async () => {
    for (const init of [".spiceinit", "spice.rc"]) {
      const dir = tempDir();
      writeFileSync(join(dir, init), "set ngbehavior=ps\n");
      await expect(runBench(bench(dir, ""), { outDir: join(dir, "out") })).rejects.toThrow(/would replace the runner's .spiceinit/);
      expect(existsSync(join(dir, "out"))).toBe(false);
    }
  });

  test("refuses .control without quit, bad @assert lines and missing files", async () => {
    const dir = tempDir();
    await expect(runBench(bench(dir, ".control\nrun\n.endc\n"))).rejects.toThrow(/no "quit"/);
    writeFileSync(join(dir, "bad.cir"), "* t\n* @assert x = 1\n.end\n");
    await expect(runBench(join(dir, "bad.cir"))).rejects.toThrow(/bad @assert/);
    await expect(runBench(join(dir, "missing.cir"))).rejects.toThrow(/bench not found/);
  });

  test("refuses .meas with several dot-analyses", async () => {
    const dir = tempDir();
    const p = bench(dir, ".ac dec 10 10 1Meg\n.tran 10u 2m\n.meas ac x MAX vdb(out)\n.control\nrun\nquit\n.endc\n");
    await expect(runBench(p, { outDir: join(dir, "out") })).rejects.toThrow(/dot-analyses/);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  test("refuses the bench's own folder as outDir (outputs would land next to it)", async () => {
    const dir = tempDir();
    await expect(runBench(bench(dir, ""), { outDir: dir })).rejects.toThrow(/must not be the bench's own folder/);
    expect(existsSync(join(dir, ".spiceinit"))).toBe(false);
  });
});

// Shell scripts in place of ngspice, called like it: <bin> -b -o <log> <bench>.
describe.skipIf(process.platform === "win32")("runBench with a stand-in ngspice (no ngspice needed)", () => {
  // macOS scans every new executable on its first run: 1.7–3.1 s each on a busy machine (measured
  // 2026-09-28), so a test that runs three stand-ins can pass bun's 5 s default.
  const EXEC_TIMEOUT_MS = 30_000;
  const fake = (script: string) => {
    const p = join(tempDir(), "ngspice");
    writeFileSync(p, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    return p;
  };
  const bench = () => {
    const dir = tempDir();
    writeFileSync(join(dir, "b.cir"), "* t\n* @assert x ≈ 1 ±1%\n.end\n");
    return { path: join(dir, "b.cir"), outDir: join(dir, "out") };
  };

  test("a log without the ltpsa mode fails the bench even when every assertion passes", async () => {
    for (const [note, modes] of [
      ["Note: No compatibility mode selected!", "none"],
      ["Note: Compatibility modes selected: ps", "ps"],
    ] as const) {
      const b = bench();
      const r = await runBench(b.path, { outDir: b.outDir, ngspice: fake(`printf '${note}\\nx = 1.0\\n' > "$3"`) });
      expect(r.exitCode).toBe(0);
      expect(r.assertions[0]!.pass).toBe(true);
      expect(r.errors).toEqual([expect.stringContaining(`used compatibility mode "${modes}"`)]);
      expect(r.ok).toBe(false);
    }
    const b = bench();
    const ok = await runBench(b.path, { outDir: b.outDir, ngspice: fake(`printf 'Note: Compatibility modes selected: ps lt a\\nx = 1.0\\n' > "$3"`) });
    expect(ok.errors).toEqual([]);
    expect(ok.ok).toBe(true);
  }, EXEC_TIMEOUT_MS);

  test("the stand-in gets the runner's arguments, cwd and SPICE_USERINIT_DIR", async () => {
    const b = bench();
    const r = await runBench(b.path, {
      outDir: b.outDir,
      ngspice: fake(`printf 'Note: Compatibility modes selected: ps lt a\\nx = 1\\n' > "$3"; echo "$1 $2 $4" > args.txt; echo "$SPICE_USERINIT_DIR" >> args.txt`),
    });
    expect(r.ok).toBe(true);
    expect(readFileSync(join(b.outDir, "args.txt"), "utf8")).toBe(`-b -o ${b.path}\n${b.outDir}\n`);
  }, EXEC_TIMEOUT_MS);

  test("a timeout fails the bench", async () => {
    const b = bench();
    const r = await runBench(b.path, { outDir: b.outDir, ngspice: fake("exec sleep 10"), timeoutMs: 300 });
    expect(r.errors[0]).toBe("ngspice timed out after 0.3 s");
    expect(r.ok).toBe(false);
  }, EXEC_TIMEOUT_MS);

  test("a non-zero exit without a log reports the exit code and the last output lines", async () => {
    const b = bench();
    const r = await runBench(b.path, { outDir: b.outDir, ngspice: fake("echo 'cannot start' >&2; exit 3") });
    expect(r.exitCode).toBe(3);
    expect(r.errors).toEqual(["ngspice exited with code 3", "cannot start"]);
    expect(r.ok).toBe(false);
  }, EXEC_TIMEOUT_MS);

  test("findNgspice: $NGSPICE when it exists, otherwise PATH", () => {
    const saved = process.env.NGSPICE;
    try {
      const bin = fake("exit 0");
      process.env.NGSPICE = bin;
      expect(findNgspice()).toBe(bin);
      process.env.NGSPICE = join(tempDir(), "missing");
      expect(findNgspice()).toBe(Bun.which("ngspice"));
    } finally {
      if (saved === undefined) delete process.env.NGSPICE;
      else process.env.NGSPICE = saved;
    }
  });
});

const ngspice = findNgspice();

describe.skipIf(!toolAvailable(ngspice !== null, "ngspice"))("ngspice integration", () => {
  const fixtureFiles = () => readdirSync(FIXTURES, { recursive: true }).map(String).sort();

  test("rc-lowpass.cir passes and all output stays in outDir", async () => {
    const before = fixtureFiles();
    const outDir = join(tempDir(), "out");
    const r = await runBench(join(FIXTURES, "rc-lowpass.cir"), { outDir });
    expect(r.errors).toEqual([]);
    expect(r.exitCode).toBe(0);
    expect(r.assertions.map((a) => a.pass)).toEqual([true, true, true]);
    expect(r.ok).toBe(true);

    const fc = 1 / (2 * Math.PI * 10e3 * 10e-9);
    const f3db = r.measurements.find((m) => m.name === "f3db")!.value;
    expect(Math.abs(f3db - fc) / fc).toBeLessThan(0.001);

    // The runner's .spiceinit was used: ngspice echoes the compatibility mode it set.
    const log = readFileSync(r.logPath, "utf8");
    expect(log).toContain("Compatibility modes selected: ps lt a");
    expect(readdirSync(outDir).sort()).toEqual([".spiceinit", "rc-lowpass.dat", "rc-lowpass.log"]);
    expect(fixtureFiles()).toEqual(before);

    // wrdata output (one real vector, own scale column): -3.0103 dB at fc, interpolated between
    // the two sweep points around it (100 points per decade, 2.3 % apart)
    const w = await readWrdata(join(outDir, "rc-lowpass.dat"));
    const vdb = w.vectors[0]!.real;
    const i = w.scale.findIndex((f) => f >= fc);
    expect(i).toBeGreaterThan(0);
    const [f0, f1, y0, y1] = [w.scale[i - 1]!, w.scale[i]!, vdb[i - 1]!, vdb[i]!];
    expect(y0 + ((y1 - y0) * (fc - f0)) / (f1 - f0)).toBeCloseTo(-3.0103, 2);
  });

  test("rc-lowpass-fail.cir fails on the wrong value and the missing measurement only", async () => {
    const r = await runBench(join(FIXTURES, "rc-lowpass-fail.cir"), { outDir: join(tempDir(), "out") });
    expect(r.exitCode).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.assertions.map((a) => [a.assertion.name, a.pass])).toEqual([
      ["f3db", false],
      ["f3db", true],
      ["not_measured", false],
    ]);
    expect(r.ok).toBe(false);
  });

  test("default outDir build/sim/<bench name>/ is emptied first", async () => {
    const before = repoSimFiles();
    const root = repoCopy();
    const outDir = join(root, "build/sim/rc-lowpass");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "stale.dat"), "1 2\n");
    const r = await simCli(root, "tests/fixtures/sim/rc-lowpass.cir");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("tests/fixtures/sim/rc-lowpass.cir  ->  build/sim/rc-lowpass/");
    expect(readdirSync(outDir).sort()).toEqual([".spiceinit", "rc-lowpass.dat", "rc-lowpass.log"]);
    expect(repoSimFiles()).toEqual(before);
  });

  test("ngspice errors fail the bench: missing include (exit 1)", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "inc.cir"), "* t\n* @assert x ≈ 1 ±1%\n.include nothere.lib\nR1 a 0 1k\n.op\n.end\n");
    const r = await runBench(join(dir, "inc.cir"), { outDir: join(dir, "out") });
    expect(r.exitCode).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("ngspice exited with code 1");
    expect(r.errors).toContain("Error: Could not find include file nothere.lib");
  });

  test("ngspice errors fail the bench: failed .meas (exit 0) is named in the assertion", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "meas.cir"),
      "* t\n* @assert never ≈ 1 ±1%\nV1 in 0 DC 0 AC 1\nR1 in out 10k\nC1 out 0 10n\n.ac dec 10 10 1Meg\n" +
        ".meas ac never WHEN vdb(out)=-500 FALL=1\n.control\nrun\nquit\n.endc\n.end\n",
    );
    const r = await runBench(join(dir, "meas.cir"), { outDir: join(dir, "out") });
    expect(r.exitCode).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/^Error: measure\s+never/);
    expect(r.assertions[0]!.detail).toMatch(/ngspice reported this measurement as failed/);
  });

  test("ngspice 47 evaluates .meas only after the last dot-analysis (why checkAnalyses exists)", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, ".spiceinit"), SPICEINIT);
    writeFileSync(
      join(dir, "multi.cir"),
      "* t\nV1 in 0 DC 0 AC 1 SIN(0 1 1k)\nR1 in out 10k\nC1 out 0 10n\n.tran 10u 2m\n.ac dec 10 10 1Meg\n" +
        ".meas ac f3db WHEN vdb(out)=-3.0103 FALL=1\n.meas tran vrms RMS v(out)\n.control\nrun\nquit\n.endc\n.end\n",
    );
    const r = await run([ngspice!, "-b", "-o", "multi.log", "multi.cir"], { cwd: dir, env: { LC_ALL: "C", SPICE_USERINIT_DIR: dir } });
    expect(r.code).toBe(0);
    const log = readFileSync(join(dir, "multi.log"), "utf8");
    expect(log).toContain("Compatibility modes selected: ps lt a");
    // .ac ran first although it comes second in the file; its .meas is gone without an error.
    expect(parseMeasurements(log).map((m) => m.name)).toEqual(["vrms"]);
    expect(parseLog(log).errors).toEqual([]);
  });

  test("analysis commands in .control each evaluate the .meas lines of their type", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "cmds.cir"),
      "* t\n* @assert f3db between 1.5k 1.7k\n* @assert vrms between 0.5 0.7\n" +
        "V1 in 0 DC 0 AC 1 SIN(0 1 1k)\nR1 in out 10k\nC1 out 0 10n\n" +
        ".meas ac f3db WHEN vdb(out)=-3.0103 FALL=1\n.meas tran vrms RMS v(out)\n" +
        ".control\nac dec 100 10 1Meg\ntran 10u 2m\nquit\n.endc\n.end\n",
    );
    const r = await runBench(join(dir, "cmds.cir"), { outDir: join(dir, "out") });
    expect(r.errors).toEqual([]);
    expect(r.measurements.map((m) => m.name)).toEqual(["f3db", "vrms"]);
    expect(r.ok).toBe(true);
  });

  test("measurements named error and warning pass; a mistyped .control command fails the bench", async () => {
    const dir = tempDir();
    const body = (cmd: string) =>
      "* t\n* @assert error ≈ 0 ±0.01\n* @assert warning between -1 0\nV1 in 0 DC 0 AC 1\nR1 in out 10k\nC1 out 0 10n\n" +
      ".ac dec 10 10 1Meg\n.meas ac error FIND vdb(out) AT=10\n.meas ac warning FIND vdb(out) AT=100\n" +
      `.control\nrun\n${cmd}\nquit\n.endc\n.end\n`;
    writeFileSync(join(dir, "ok.cir"), body("wrdata ok.dat vdb(out)"));
    const ok = await runBench(join(dir, "ok.cir"), { outDir: join(dir, "out-ok") });
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    expect(ok.ok).toBe(true);

    writeFileSync(join(dir, "typo.cir"), body("wrdat typo.dat vdb(out)"));
    const typo = await runBench(join(dir, "typo.cir"), { outDir: join(dir, "out-typo") });
    expect(typo.exitCode).toBe(0);
    expect(typo.errors).toEqual(["wrdat: no such command available in ngspice"]);
    expect(typo.assertions.every((a) => a.pass)).toBe(true);
    expect(typo.ok).toBe(false);
    expect(existsSync(join(dir, "out-typo", "typo.dat"))).toBe(false);
  });

  test("a bench without @assert lines fails", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "none.cir"), "* t\nV1 a 0 DC 1\nR1 a 0 1k\n.op\n.control\nrun\nquit\n.endc\n.end\n");
    const r = await runBench(join(dir, "none.cir"), { outDir: join(dir, "out") });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(['no "* @assert" lines: the bench checks nothing']);
  });

  test("CLI: exit 0 when every bench passes, 1 on any failure, 2 without arguments", async () => {
    const before = repoSimFiles();
    const root = repoCopy();
    const cli = (...args: string[]) => simCli(root, ...args);
    const pass = await cli("tests/fixtures/sim/rc-lowpass.cir");
    expect(pass.code).toBe(0);
    expect(pass.stdout).toContain("PASS  f3db ≈ 1591.55 ±2%");
    const fail = await cli("tests/fixtures/sim/rc-lowpass.cir", "tests/fixtures/sim/rc-lowpass-fail.cir");
    expect(fail.code).toBe(1);
    expect(fail.stdout).toContain("FAIL  f3db ≈ 1000 ±2%");
    expect(fail.stdout).toContain("2 benches: 1 passed, 1 failed");
    const usage = await cli();
    expect(usage.code).toBe(2);
    expect(usage.stderr).toContain("relative to the repo root");
    // `bun run sim` starts in the repo root, so a path relative to the shell's folder is not found.
    const wrongDir = await cli("rc-lowpass.cir");
    expect(wrongDir.code).toBe(1);
    expect(wrongDir.stdout).toContain(`error: bench not found (relative to ${root}; \`bun run sim\` always runs from the repo root)`);
    expect(repoSimFiles()).toEqual(before);
  });
});
