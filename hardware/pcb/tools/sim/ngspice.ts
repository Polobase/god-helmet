// ngspice batch runner: run a SPICE testbench, collect its measurements, check `* @assert` lines.
//
// Bench style: `.meas` lines in the netlist, plus a .control block that ends in `quit`.
//
//   .ac dec 100 10 1Meg
//   .meas ac f3db WHEN vdb(out)=-3.0103 FALL=1
//   .control
//   run
//   wrdata rc.dat vdb(out)
//   quit
//   .endc
//
// The ngspice-47 manual (§12.4.3, p. 365) says a file with a .control section "should not" be run
// with -b: "The outcome may be unpredictable!" This is what ngspice 47 actually did on 2026-09-24,
// and why the runner works the way it does:
// - In plain batch mode, with no .control block, `.meas … vdb(out)` aborts with "no data saved …
//   analysis not run". It only works once the bench adds `.save v(out)`. KiCad's `sch export
//   netlist --format spice` writes no .save/.probe lines (kicad-cli passes only
//   OPTION_SIM_COMMAND, per eeschema/eeschema_jobs_handler.cpp on the 10.0 branch).
// - With .control, every vector is kept and wrdata works.
// - `run` evaluates the .meas lines once, after the last dot-analysis it runs, and only those of
//   that analysis type. The others are dropped without a message. "Last" is ngspice's order, not
//   the file's: .ac ran before .op and .dc, and those before .tran. With two .ac lines both ran,
//   and the .meas measured the second one. Plain batch mode does the same. checkAnalyses()
//   therefore refuses a bench with .meas lines and more than one dot-analysis. To run several
//   analyses, write them as commands in .control (`ac …`, `tran …`), without dots: each command
//   evaluates the .meas lines of its own type. (Tested with .ac, .dc, .op and .tran; the other
//   analysis cards are assumed to behave the same.)
// - A .meas whose analysis type never runs is skipped silently too. Its assertion then fails as
//   "not measured".
// - Without `quit`, ngspice runs every analysis a second time after .endc. runBench() therefore
//   refuses any .control block that has no quit/exit.
// - A failed .meas prints "Error: measure …", but the exit code stays 0, so the log is scanned.
//
// .spiceinit sets `ngbehavior=ltpsa`, KiCad 10's default compatibility mode (LT_PSPICE in
// eeschema/sim/spice_settings.cpp, sent as "set ngbehavior=ltpsa" by eeschema/sim/ngspice.cpp,
// both on gitlab.com/kicad/code/kicad, 10.0 branch). ngspice reads only the first .spiceinit or
// spice.rc it finds. The search order is: netlist directory, $SPICE_USERINIT_DIR, cwd, $HOME
// (manual §12.6, confirmed on 47; §12.7.1 wrongly says SPICE_USERINIT_DIR comes first). The runner
// writes the file into outDir and points SPICE_USERINIT_DIR there. It refuses benches that have
// their own .spiceinit next to them, and fails a run whose log doesn't show the mode (see
// compatModeProblem). Relative .include paths resolve against the bench's directory. wrdata/write
// paths resolve against cwd, which is outDir, so no output lands in the repo.
//
// TI op-amp models (TL072 etc.) will be fetched into the gitignored models/ folder in Phase 3. TI's
// licence terms forbid committing them. The research rates this "likely"; re-check it against the
// licence text that ships with the model download.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { paths } from "../lib/paths.ts";
import { run } from "../lib/proc.ts";

export const SPICEINIT = "* written by tools/sim/ngspice.ts (KiCad 10 default compatibility mode)\nset ngbehavior=ltpsa\n";

export class SimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimError";
  }
}

/** $NGSPICE, then PATH (Homebrew links /opt/homebrew/bin/ngspice). */
export function findNgspice(): string | null {
  const env = process.env.NGSPICE;
  if (env && existsSync(env)) return env;
  return Bun.which("ngspice");
}

/** Release number from the banner ("** ngspice-47 : Circuit level simulation program"). */
export async function ngspiceVersion(bin: string): Promise<string> {
  const r = await run([bin, "--version"], { timeoutMs: 30_000 });
  const m = /ngspice-(\S+)/.exec(r.stdout);
  if (r.code !== 0 || !m) throw new SimError(`ngspice --version failed: ${(r.stderr || r.stdout).trim()}`);
  return m[1]!;
}

// ---------------------------------------------------------------------------------------------
// Numbers

/** Powers of ten for the SPICE scale factors (ngspice-47 manual §2.1.3.2, Table 2.1). */
const SCALE: Record<string, number> = { t: 12, g: 9, meg: 6, k: 3, m: -3, u: -6, n: -9, p: -12, f: -15, a: -18 };
const SPICE_NUMBER = /^([-+]?(?:\d+\.?\d*|\.\d+))(?:e([-+]?\d+))?(meg|mil|[tgkmunpfa])?$/i;

/** Parse a number as written in a netlist: "1591.55", "1.6e3", "1.6k", "10n", "1meg".
 *  Stricter than ngspice: trailing units ("10Hz") and a lone "M" are rejected, because ngspice
 *  reads "1MHz" as 1e-3 (M = milli). */
export function parseSpiceNumber(text: string): number {
  const m = SPICE_NUMBER.exec(text.trim());
  if (!m) throw new SimError(`not a number: "${text}"`);
  const [, mantissa, exp, suffix] = m;
  if (suffix === "M") throw new SimError(`ambiguous number "${text}": SPICE reads M as milli; write m (1e-3) or meg (1e6)`);
  const s = suffix?.toLowerCase();
  if (s === "mil") return Number(`${mantissa}e${exp ?? 0}`) * 25.4e-6;
  // Shift the decimal exponent instead of multiplying, so "1.1k" is exactly 1100.
  return Number(`${mantissa}e${Number(exp ?? 0) + (s ? SCALE[s]! : 0)}`);
}

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[-+]?(?:nan|inf(?:inity)?)`;
const NUM_RE = new RegExp(`^(?:${NUM})$`, "i");

/** A number as ngspice prints it (%e, possibly nan/inf). */
function logNumber(text: string): number {
  const t = text.toLowerCase();
  if (t.endsWith("nan")) return Number.NaN;
  if (t.includes("inf")) return t.startsWith("-") ? -Infinity : Infinity;
  return Number(text);
}

// ---------------------------------------------------------------------------------------------
// Log parsing

export interface Measurement {
  /** Lowercase, as ngspice prints it (it lowercases the netlist). */
  name: string;
  value: number;
  /** `key= value` pairs printed after the result: at, with, targ, trig, from, to. */
  extra: Record<string, number>;
  /** 1-based line in the log. */
  line: number;
}

// "f3db                =   1.59155e+03", "vmax =  8.61751e-01 at=  3.34521e-04", "gain = 2.500000e+00".
// The last form is `print` of a scalar, so a `let` result can be asserted too. Complex values
// ("v(out) = 7.1e-01,  -4.5e-01") and prose ("Total analysis time (seconds) = 0.002") don't match.
const RESULT_LINE = new RegExp(String.raw`^\s*([^\s=]+)\s*=\s*(${NUM})((?:\s+[a-z]+=\s*(?:${NUM}))*)\s*$`, "i");
const EXTRA_PAIR = new RegExp(String.raw`([a-z]+)=\s*(${NUM})`, "gi");
const MEAS_FAILED = /^\s*Error: measure\s+(\S+)/i;
// `(?!\s*=)` keeps the result line of a measurement named "error" or "warning" out. A mistyped
// .control command prints "wrdat: no such command available in ngspice", with no Error prefix and
// exit code 0.
const ERROR_LINE = /^\s*error\b(?!\s*=)|simulation\(s\) aborted|simulation interrupted|no such command available/i;
const WARNING_LINE = /^\s*warning\b(?!\s*=)/i;
// While reading the netlist, ngspice 47 prints "Note: Compatibility modes selected: ps lt a" for
// ngbehavior=ltpsa ("ps", "lt", "ki a" for other modes) and "Note: No compatibility mode selected!"
// for none.
const COMPAT_MODE = /Compatibility modes selected:([^\n]*)|No compatibility mode selected/;
const LTPSA_MODES = "ps lt a";

/** Every `name = number` result line (.meas, meas, print of a scalar), in log order. */
export function parseMeasurements(log: string): Measurement[] {
  const out: Measurement[] = [];
  log.split(/\r?\n/).forEach((text, i) => {
    const m = RESULT_LINE.exec(text);
    if (!m) return;
    const extra: Record<string, number> = {};
    for (const [, key, value] of (m[3] ?? "").matchAll(EXTRA_PAIR)) extra[key!.toLowerCase()] = logNumber(value!);
    out.push({ name: m[1]!.toLowerCase(), value: logNumber(m[2]!), extra, line: i + 1 });
  });
  return out;
}

export interface LogSummary {
  measurements: Measurement[];
  /** Names of .meas/meas statements that ngspice reported as failed ("out of interval" etc.). */
  failedMeasurements: string[];
  /** Error lines. Any of them fails the bench. */
  errors: string[];
  warnings: string[];
}

export function parseLog(log: string): LogSummary {
  const lines = log.split(/\r?\n/);
  return {
    measurements: parseMeasurements(log),
    failedMeasurements: lines.flatMap((l) => MEAS_FAILED.exec(l)?.[1]?.toLowerCase() ?? []),
    errors: lines.filter((l) => ERROR_LINE.test(l)).map((l) => l.trim()),
    warnings: lines.filter((l) => WARNING_LINE.test(l)).map((l) => l.trim()),
  };
}

/** Null when the log shows ngbehavior=ltpsa (the runner's .spiceinit took effect), otherwise the
 *  reason. Only meaningful for a run that got as far as reading the netlist. */
export function compatModeProblem(log: string): string | null {
  const m = COMPAT_MODE.exec(log);
  if (!m) return `the log does not say which compatibility mode ngspice used (expected "${LTPSA_MODES}" from ngbehavior=ltpsa)`;
  const modes = m[1]?.trim() || "none";
  if (modes === LTPSA_MODES) return null;
  return `ngspice used compatibility mode "${modes}", not "${LTPSA_MODES}": the runner's .spiceinit (ngbehavior=ltpsa) was not applied`;
}

// ---------------------------------------------------------------------------------------------
// Assertions: comment lines in the bench
//
//   * @assert f3db ≈ 1591.55 ±2%        relative tolerance
//   * @assert offset ≈ 0 ±5m             absolute tolerance (SPICE number)
//   * @assert f3db between 1.5k 1.7k     closed interval
//
// ASCII spellings "~=" and "+-" work as well. A missing measurement fails.

export type Check =
  | { op: "approx"; expected: number; tolerance: number; relative: boolean }
  | { op: "between"; lo: number; hi: number };

export interface Assertion {
  /** Measurement name, lowercase. */
  name: string;
  check: Check;
  /** The assertion as written (after "@assert"). */
  text: string;
  /** 1-based line in the bench. */
  line: number;
}

const ASSERT_LINE = /^\s*\*\s*@assert\b(.*)$/i;
const APPROX = /^(\S+)\s+(?:≈|~=)\s*(\S+)\s+(?:±|\+-)\s*([^\s%]+)\s*(%?)$/;
const BETWEEN = /^(\S+)\s+between\s+(\S+)\s+(\S+)$/i;

export function parseAssertions(netlist: string, file = "<bench>"): Assertion[] {
  const out: Assertion[] = [];
  netlist.split(/\r?\n/).forEach((raw, i) => {
    const m = ASSERT_LINE.exec(raw);
    if (!m) return;
    const text = m[1]!.trim();
    const where = `${file}:${i + 1}`;
    try {
      out.push({ ...parseAssertion(text), text, line: i + 1 });
    } catch (e) {
      throw new SimError(`${where}: bad @assert "${text}": ${(e as Error).message}`);
    }
  });
  return out;
}

function parseAssertion(text: string): { name: string; check: Check } {
  const approx = APPROX.exec(text);
  if (approx) {
    const [, name, expected, tolerance, pct] = approx;
    const check: Check = {
      op: "approx",
      expected: parseSpiceNumber(expected!),
      tolerance: pct ? Number(tolerance) : parseSpiceNumber(tolerance!),
      relative: pct === "%",
    };
    if (!(check.tolerance >= 0)) throw new Error(`tolerance must be a number >= 0`);
    if (check.relative && check.expected === 0) throw new Error("a relative tolerance around 0 is empty; use an absolute one");
    return { name: name!.toLowerCase(), check };
  }
  const between = BETWEEN.exec(text);
  if (between) {
    const [, name, lo, hi] = between;
    const check: Check = { op: "between", lo: parseSpiceNumber(lo!), hi: parseSpiceNumber(hi!) };
    if (check.lo > check.hi) throw new Error("lower bound is above upper bound");
    return { name: name!.toLowerCase(), check };
  }
  throw new Error('expected "<meas> ≈ <value> ±<tol>[%]" or "<meas> between <lo> <hi>"');
}

export interface AssertionResult {
  assertion: Assertion;
  pass: boolean;
  /** Measured value, or null when missing/ambiguous. */
  actual: number | null;
  /** Deviation when it passed, the reason when it failed. */
  detail: string;
}

/** Short number format for reports (6 significant digits, like ngspice's .meas output). */
export const fmt = (n: number) => (Number.isFinite(n) ? String(Number(n.toPrecision(6))) : String(n));
const signed = (s: string) => (s.startsWith("-") ? s : `+${s}`);

export function evaluateAssertions(assertions: Assertion[], log: Pick<LogSummary, "measurements" | "failedMeasurements">): AssertionResult[] {
  return assertions.map((assertion) => {
    const { name, check } = assertion;
    const values = [...new Set(log.measurements.filter((m) => m.name === name).map((m) => m.value))];
    if (values.length === 0) {
      const detail = log.failedMeasurements.includes(name)
        ? "ngspice reported this measurement as failed (see log)"
        : `not measured: no "${name} = …" line in the log (ngspice skips a .meas silently when no analysis of its type ran)`;
      return { assertion, pass: false, actual: null, detail };
    }
    if (values.length > 1) {
      return { assertion, pass: false, actual: null, detail: `ambiguous: measured more than once (${values.map(fmt).join(", ")})` };
    }
    const actual = values[0]!;
    if (check.op === "between") {
      const pass = actual >= check.lo && actual <= check.hi;
      return { assertion, pass, actual, detail: pass ? "in range" : `outside ${fmt(check.lo)} … ${fmt(check.hi)}` };
    }
    const limit = check.relative ? (Math.abs(check.expected) * check.tolerance) / 100 : check.tolerance;
    const dev = actual - check.expected;
    const pass = Math.abs(dev) <= limit;
    const deviation = check.relative
      ? `deviation ${signed(((dev / Math.abs(check.expected)) * 100).toFixed(2))}%`
      : `deviation ${signed(fmt(dev))}`;
    const allowed = `allowed ${fmt(check.expected - limit)} … ${fmt(check.expected + limit)}`;
    return { assertion, pass, actual, detail: pass ? deviation : `${deviation}, ${allowed}` };
  });
}

// ---------------------------------------------------------------------------------------------
// Bench checks

/** Throws for a .control block without quit/exit (ngspice -b would rerun every analysis after
 *  .endc) or without .endc. Only the bench file itself is checked, not files it .include's. */
export function checkControlBlocks(netlist: string, file = "<bench>"): void {
  let open: number | null = null;
  let quits = false;
  netlist.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim().toLowerCase();
    if (/^\.control\b/.test(line)) {
      open = i + 1;
      quits = false;
    } else if (/^\.endc\b/.test(line)) {
      if (open !== null && !quits) {
        throw new SimError(`${file}:${open}: .control block has no "quit"; in batch mode ngspice would rerun every analysis after .endc`);
      }
      open = null;
    } else if (open !== null && /^(quit|exit)\b/.test(line)) {
      quits = true;
    }
  });
  if (open !== null) throw new SimError(`${file}:${open}: .control without .endc`);
}

const DOT_ANALYSIS = /^\.(ac|dc|tran|op|noise|tf|pz|disto|sens|sp|pss)\b/;

/** Throws for a bench that has .meas lines and more than one dot-analysis. ngspice evaluates the
 *  .meas lines only after the last analysis it runs and drops the rest without a message (see the
 *  header). Analysis commands inside .control are fine. Only the bench file itself is checked. */
export function checkAnalyses(netlist: string, file = "<bench>"): void {
  const analyses: string[] = [];
  let hasMeas = false;
  let inControl = false;
  netlist.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim().toLowerCase();
    if (/^\.control\b/.test(line)) inControl = true;
    else if (/^\.endc\b/.test(line)) inControl = false;
    else if (inControl) return;
    else if (/^\.meas(ure)?\b/.test(line)) hasMeas = true;
    else {
      const m = DOT_ANALYSIS.exec(line);
      if (m) analyses.push(`.${m[1]} on line ${i + 1}`);
    }
  });
  if (hasMeas && analyses.length > 1) {
    throw new SimError(
      `${file}: .meas lines with ${analyses.length} dot-analyses (${analyses.join(", ")}); ngspice evaluates .meas only after ` +
        "the last analysis it runs and silently drops the others. Keep one dot-analysis, or run the analyses as commands " +
        "in .control (ac …, tran …)",
    );
  }
}

// ---------------------------------------------------------------------------------------------
// wrdata files
//
// ASCII columns, one row per scale point. Each vector writes its own scale column unless
// `set wr_singlescale` is on. Complex vectors (AC node voltages) take two columns (re, im).
// `set wr_vecnames` adds a header row; a complex vector's name appears twice in it.

export interface WrdataVector {
  name: string | null;
  real: number[];
  /** Imaginary part, only for complex vectors. */
  imag?: number[];
}

export interface Wrdata {
  scaleName: string | null;
  scale: number[];
  vectors: WrdataVector[];
}

/** Layout of a file without a wr_vecnames header; a header overrides it. */
export interface WrdataLayout {
  complex?: boolean;
  singleScale?: boolean;
}

type Column = { kind: "scale" } | { kind: "real"; name: string | null } | { kind: "complex"; name: string | null };

function columnsFromHeader(names: string[]): Column[] {
  const cols: Column[] = [{ kind: "scale" }];
  for (let i = 1; i < names.length; ) {
    const name = names[i]!;
    if (name === names[0]) {
      cols.push({ kind: "scale" });
      i += 1;
    } else if (names[i + 1] === name) {
      cols.push({ kind: "complex", name });
      i += 2;
    } else {
      cols.push({ kind: "real", name });
      i += 1;
    }
  }
  return cols;
}

function columnsFromLayout(width: number, layout: WrdataLayout): Column[] {
  const valueWidth = layout.complex ? 2 : 1;
  const vector: Column = { kind: layout.complex ? "complex" : "real", name: null };
  const group = layout.singleScale ? valueWidth : valueWidth + 1;
  const body = layout.singleScale ? width - 1 : width;
  if (width < 2 || body % group !== 0) {
    throw new SimError(`wrdata: ${width} columns don't fit layout ${JSON.stringify(layout)}`);
  }
  const cols: Column[] = layout.singleScale ? [{ kind: "scale" }] : [];
  for (let i = 0; i < body / group; i++) cols.push(...(layout.singleScale ? [vector] : [{ kind: "scale" } as const, vector]));
  return cols;
}

const colWidth = (c: Column) => (c.kind === "complex" ? 2 : 1);

export function parseWrdata(text: string, layout: WrdataLayout = {}): Wrdata {
  const rows = text
    .split(/\r?\n/)
    .map((l, i) => ({ tokens: l.trim().split(/\s+/).filter(Boolean), line: i + 1 }))
    .filter((r) => r.tokens.length > 0);
  const first = rows[0];
  if (!first) throw new SimError("wrdata: empty file");
  const header = first.tokens.some((t) => !NUM_RE.test(t)) ? first.tokens : null;
  const data = header ? rows.slice(1) : rows;
  const nCols = header?.length ?? first.tokens.length;
  const cols = header ? columnsFromHeader(header) : columnsFromLayout(nCols, layout);

  const scale: number[] = [];
  const vectors: WrdataVector[] = cols.flatMap((c) =>
    c.kind === "scale" ? [] : [c.kind === "complex" ? { name: c.name, real: [], imag: [] } : { name: c.name, real: [] }],
  );
  for (const { tokens, line } of data) {
    if (tokens.length !== nCols) throw new SimError(`wrdata line ${line}: ${tokens.length} columns, expected ${nCols}`);
    const bad = tokens.find((t) => !NUM_RE.test(t));
    if (bad !== undefined) throw new SimError(`wrdata line ${line}: not a number: "${bad}"`);
    const values = tokens.map(logNumber);
    let at = 0;
    let v = 0;
    let rowScale: number | undefined;
    for (const c of cols) {
      if (c.kind === "scale") {
        // Repeated scale columns must match the first one, otherwise the layout is wrong.
        if (rowScale === undefined) rowScale = values[at]!;
        else if (values[at] !== rowScale) throw new SimError(`wrdata line ${line}: scale columns differ; wrong layout?`);
      } else {
        const vec = vectors[v++]!;
        vec.real.push(values[at]!);
        if (c.kind === "complex") vec.imag!.push(values[at + 1]!);
      }
      at += colWidth(c);
    }
    scale.push(rowScale!);
  }
  return { scaleName: header?.[0] ?? null, scale, vectors };
}

export async function readWrdata(path: string, layout: WrdataLayout = {}): Promise<Wrdata> {
  return parseWrdata(await Bun.file(path).text(), layout);
}

// ---------------------------------------------------------------------------------------------
// Runner

export interface BenchOptions {
  /** Output folder. The default is build/sim/<bench name>/, which is emptied first. A folder
   *  passed in by the caller is left as it is. */
  outDir?: string;
  /** ngspice binary (default: findNgspice()). */
  ngspice?: string;
  timeoutMs?: number;
}

export interface BenchResult {
  bench: string;
  outDir: string;
  logPath: string;
  exitCode: number;
  measurements: Measurement[];
  assertions: AssertionResult[];
  /** ngspice errors and bench problems. Any entry fails the bench. */
  errors: string[];
  warnings: string[];
  /** No errors, at least one assertion, and every assertion passed. */
  ok: boolean;
}

const benchName = (bench: string) => basename(bench, extname(bench));

/** Default output folder: build/sim/<bench basename without extension>/. */
export const benchOutDir = (bench: string) => join(paths.build, "sim", benchName(bench));

export async function runBench(benchPath: string, opts: BenchOptions = {}): Promise<BenchResult> {
  const bench = resolve(benchPath);
  if (!existsSync(bench)) throw new SimError(`bench not found: ${bench}`);
  const netlist = await Bun.file(bench).text();
  const assertions = parseAssertions(netlist, bench);
  checkControlBlocks(netlist, bench);
  checkAnalyses(netlist, bench);
  for (const init of [".spiceinit", "spice.rc"]) {
    const p = join(dirname(bench), init);
    if (existsSync(p)) throw new SimError(`${p} would replace the runner's .spiceinit (the netlist directory is searched first); remove it`);
  }
  const outDir = opts.outDir !== undefined ? resolve(opts.outDir) : benchOutDir(bench);
  if (outDir === dirname(bench)) throw new SimError(`outDir must not be the bench's own folder (${outDir})`);
  const bin = opts.ngspice ?? findNgspice();
  if (!bin) throw new SimError("ngspice not found (set $NGSPICE or put it on PATH: brew install ngspice)");

  if (opts.outDir === undefined) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, ".spiceinit"), SPICEINIT);
  const logPath = join(outDir, `${benchName(bench)}.log`);
  rmSync(logPath, { force: true });

  const timeoutMs = opts.timeoutMs ?? 300_000;
  const started = Date.now();
  const r = await run([bin, "-b", "-o", logPath, bench], {
    cwd: outDir,
    env: { LC_ALL: "C", SPICE_USERINIT_DIR: outDir },
    timeoutMs,
  });
  const log = existsSync(logPath) ? await Bun.file(logPath).text() : "";
  const summary = parseLog(log);

  const errors: string[] = [];
  if (r.code !== 0) {
    errors.push(Date.now() - started >= timeoutMs ? `ngspice timed out after ${timeoutMs / 1000} s` : `ngspice exited with code ${r.code}`);
    if (!log.trim()) errors.push(...(r.stderr || r.stdout).trim().split("\n").filter(Boolean).slice(-5));
  }
  errors.push(...summary.errors);
  // A run that fails early (missing include, exit 1) stops before the mode is printed.
  const compat = r.code === 0 ? compatModeProblem(log) : null;
  if (compat) errors.push(compat);
  if (assertions.length === 0) errors.push('no "* @assert" lines: the bench checks nothing');

  const results = evaluateAssertions(assertions, summary);
  return {
    bench,
    outDir,
    logPath,
    exitCode: r.code,
    measurements: summary.measurements,
    assertions: results,
    errors,
    warnings: summary.warnings,
    ok: errors.length === 0 && results.every((a) => a.pass),
  };
}
