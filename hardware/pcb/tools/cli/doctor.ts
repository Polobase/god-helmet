// bun run doctor: report the tools and paths this toolchain needs, with install hints. Read-only:
// never installs or changes anything. Exit 1 when a required tool (git, bun, kicad-cli, ngspice)
// is missing or the wrong version.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findKicadCli, kicadVersion } from "../kicad/cli.ts";
import { findKicadPython, KICAD_DEMOS, KICAD_SHARED_SUPPORT, SUPPORTED_KICAD } from "../kicad/install.ts";
import { parseCli, usageError } from "../lib/cli.ts";
import { sha256File } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";
import { run } from "../lib/proc.ts";
import { vendoredTables } from "../kicad/vendor.ts";
import { findJava, FREEROUTING } from "../pcb/tools.ts";
import { MODELS, MODELS_DIR } from "../sim/models.ts";
import { findNgspice } from "../sim/ngspice.ts";
/** The simulation tooling is researched against ngspice-47 (Homebrew formula 47, ngspice-47 manual). */
export const MIN_NGSPICE_MAJOR = 47;

const issueUrl = (n: number) => `https://gitlab.com/kicad/code/kicad/-/issues/${n}`;

// ---------------------------------------------------------------------------------------------
// Pure parsing (unit-tested)

/** First dotted version number ("1.4.2", "2.50.1", "10.0") in a string. */
export function parseVersion(text: string): string | null {
  return /\d+(?:\.\d+)+/.exec(text)?.[0] ?? null;
}

/** Numeric dotted-version comparison; missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** Minimum from an engines range of the form ">=x.y.z"; null for anything else. */
export function minVersionFromRange(range: string): string | null {
  return /^\s*>=\s*(\d+(?:\.\d+)*)\s*$/.exec(range)?.[1] ?? null;
}

/** "git version 2.50.1 (Apple Git-155)" → "2.50.1". */
export const parseGitVersion = (out: string) => /git version (\d+(?:\.\d+)+)/.exec(out)?.[1] ?? null;

/** `ngspice --version` prints a "******" banner first; the version is on the first line that
 *  names ngspice, e.g. "** ngspice-47 : Circuit level simulation program". */
export function parseNgspiceVersion(out: string): { version: string; line: string } | null {
  for (const raw of out.split("\n")) {
    const m = /ngspice-(\d+(?:\.\d+)*)/.exec(raw);
    if (m?.[1]) return { version: m[1], line: raw.replace(/^[*\s]+/, "").trim() };
  }
  return null;
}

export interface KicadAbout {
  version?: string;
  platform?: string;
  buildDate?: string;
  compiler?: string;
  ngspice?: string;
}

/** Fields of `kicad-cli version --format about` (GetVersionInfoData, common/build_version.cpp,
 *  KiCad 10.0.6): "Version: …", "Platform: …", and tab-indented "Date:", "ngspice:", "Compiler:"
 *  under "Build Info:". */
export function parseKicadAbout(text: string): KicadAbout {
  const out: KicadAbout = {};
  const keys: Record<string, keyof KicadAbout> = { Version: "version", Platform: "platform", Date: "buildDate", Compiler: "compiler", ngspice: "ngspice" };
  for (const line of text.split("\n")) {
    const m = /^\s*(Version|Platform|Date|Compiler|ngspice):\s*(.+?)\s*$/.exec(line);
    const key = m?.[1] && keys[m[1]];
    if (key && m[2] && out[key] === undefined) out[key] = m[2];
  }
  return out;
}

/** Known kicad-cli problems for a 10.0.x version (from the research dossier, issue tracker). */
export function kicadKnownIssues(version: string): string[] {
  const notes: string[] = [];
  const v = parseVersion(version);
  if (!v || !SUPPORTED_KICAD.test(v)) return notes;
  if (compareVersions(v, "10.0.7") < 0) {
    notes.push(`#25582: ERC JSON coordinates are 100x too small before 10.0.7; keep the .rpt report (${issueUrl(25582)})`);
  }
  if (compareVersions(v, "10.0.4") >= 0 && compareVersions(v, "10.0.7") < 0) {
    notes.push(`#25413: headless DRC can crash on macOS in 10.0.4-10.0.6; run DRC from a logged-in Terminal (${issueUrl(25413)})`);
  }
  return notes;
}

/** Stock symbol library layout: packed <Lib>.kicad_sym files vs <Lib>.kicad_symdir folders. */
export function symbolLibLayout(entries: string[]): { packed: number; symdir: number } {
  return {
    packed: entries.filter((e) => e.endsWith(".kicad_sym")).length,
    symdir: entries.filter((e) => e.endsWith(".kicad_symdir")).length,
  };
}

// ---------------------------------------------------------------------------------------------
// Checks

type Level = "ok" | "warn" | "FAIL" | "info";

interface Check {
  name: string;
  level: Level;
  detail: string;
  hint?: string;
}

async function output(cmd: string[], env?: Record<string, string>): Promise<string | null> {
  try {
    const r = await run(cmd, { timeoutMs: 30_000, ...(env && { env }) });
    return r.code === 0 ? r.stdout + r.stderr : null;
  } catch {
    return null;
  }
}

async function checkGit(): Promise<Check> {
  const bin = Bun.which("git");
  const v = bin ? parseGitVersion((await output([bin, "--version"])) ?? "") : null;
  if (!v) return { name: "git", level: "FAIL", detail: "not found", hint: "xcode-select --install   (or: brew install git)" };
  return { name: "git", level: "ok", detail: v };
}

async function checkBun(): Promise<Check> {
  const pkg = (await Bun.file(join(paths.root, "package.json")).json()) as { engines?: { bun?: string } };
  const min = minVersionFromRange(pkg.engines?.bun ?? "");
  if (!min) return { name: "bun", level: "warn", detail: `${Bun.version} (package.json engines.bun is not ">=x.y.z")` };
  if (compareVersions(Bun.version, min) < 0) return { name: "bun", level: "FAIL", detail: `${Bun.version}, need >= ${min}`, hint: "bun upgrade" };
  return { name: "bun", level: "ok", detail: `${Bun.version} (>= ${min})` };
}

interface KicadResult {
  checks: Check[];
  about: string[];
  notes: string[];
}

async function checkKicad(): Promise<KicadResult> {
  const checks: Check[] = [];
  const about: string[] = [];
  const notes: string[] = [];
  const install = "brew install --cask kicad   (asks for your password to install the demos: run it in a Terminal)";
  const bin = findKicadCli();
  if (!bin) {
    checks.push({ name: "kicad-cli", level: "FAIL", detail: "not found ($KICAD_CLI, PATH, app bundle)", hint: install });
  } else {
    let version: string | null = null;
    try {
      version = await kicadVersion(bin);
    } catch (e) {
      checks.push({ name: "kicad-cli", level: "FAIL", detail: `${bin}: ${e instanceof Error ? e.message : String(e)}` });
    }
    if (version !== null) {
      const ok = SUPPORTED_KICAD.test(version);
      checks.push({
        name: "kicad-cli",
        level: ok ? "ok" : "FAIL",
        detail: `${version} at ${bin}${ok ? "" : ` (this toolchain needs ${SUPPORTED_KICAD.source.replace(/[\\^]/g, "")}x)`}`,
        ...(!ok && { hint: install }),
      });
      // kicad-cli writes settings on start-up: keep it in the toolchain's isolated config folder.
      const a = parseKicadAbout((await output([bin, "version", "--format", "about"], { KICAD_CONFIG_HOME: paths.kicadConfig })) ?? "");
      if (a.buildDate) about.push(`build date: ${a.buildDate}`);
      about.push(`compiler:   ${a.compiler ?? "(not reported)"}`);
      if (a.platform) about.push(`platform:   ${a.platform}`);
      if (a.ngspice) about.push(`ngspice:    ${a.ngspice} (bundled with KiCad)`);
      notes.push(...kicadKnownIssues(version));
      if (ok) {
        notes.push(
          `#25583 (open): builds made with libc++ 22 / Xcode 26 can merge nets whose points have equal x²+y²; compare the compiler line above, and the pipeline-proof canary tests it (${issueUrl(25583)})`,
        );
      }
    }
  }

  const symDir = join(KICAD_SHARED_SUPPORT, "symbols");
  const fpDir = join(KICAD_SHARED_SUPPORT, "footprints");
  if (existsSync(symDir)) {
    const { packed, symdir } = symbolLibLayout(readdirSync(symDir));
    const fps = existsSync(fpDir) ? readdirSync(fpDir).filter((e) => e.endsWith(".pretty")).length : 0;
    checks.push({ name: "KiCad libraries", level: "ok", detail: `${packed} packed .kicad_sym, ${symdir} .kicad_symdir, ${fps} .pretty in ${KICAD_SHARED_SUPPORT}` });
  } else {
    checks.push({ name: "KiCad libraries", level: "warn", detail: `${symDir} not found`, hint: install });
  }
  checks.push(
    existsSync(KICAD_DEMOS)
      ? { name: "KiCad demos", level: "ok", detail: KICAD_DEMOS }
      : { name: "KiCad demos", level: "warn", detail: `${KICAD_DEMOS} not found`, hint: install },
  );
  return { checks, about, notes };
}

const HOMEBREW_NGSPICE = "/opt/homebrew/bin/ngspice";

async function checkNgspice(): Promise<Check> {
  const hint = "brew install ngspice";
  const bin = findNgspice();
  if (!bin && existsSync(HOMEBREW_NGSPICE)) {
    return { name: "ngspice", level: "FAIL", detail: `not on PATH, but ${HOMEBREW_NGSPICE} exists`, hint: "put /opt/homebrew/bin on PATH or set NGSPICE (docs/environment.md)" };
  }
  if (!bin) return { name: "ngspice", level: "FAIL", detail: "not found ($NGSPICE, PATH)", hint };
  const v = parseNgspiceVersion((await output([bin, "--version"])) ?? "");
  if (!v) return { name: "ngspice", level: "FAIL", detail: `${bin}: could not read the version`, hint };
  const major = Number(v.version.split(".")[0]);
  if (major < MIN_NGSPICE_MAJOR) return { name: "ngspice", level: "FAIL", detail: `${v.line}; need ngspice-${MIN_NGSPICE_MAJOR} or newer`, hint: "brew upgrade ngspice" };
  return { name: "ngspice", level: "ok", detail: v.line };
}

// The PCB flow (bun run pcb): Java for Freerouting, KiCad's Python with pcbnew, the pinned jar.

async function checkJava(): Promise<Check> {
  const name = "java (pcb)";
  const hint = "brew install openjdk   (keg-only: put /opt/homebrew/opt/openjdk/bin on PATH or set JAVA_HOME)";
  const ok = await findJava();
  if (ok) return { name, level: "ok", detail: `${ok.version} at ${ok.bin} (Freerouting ${FREEROUTING.version} needs >= ${FREEROUTING.minJava})` };
  const any = await findJava(0);
  if (any) return { name, level: "warn", detail: `${any.version} at ${any.bin}; Freerouting ${FREEROUTING.version} needs Java >= ${FREEROUTING.minJava}`, hint };
  return { name, level: "warn", detail: "not found ($JAVA_HOME, Homebrew's openjdk, PATH; /usr/bin/java is only a stub)", hint };
}

async function checkKicadPython(): Promise<Check> {
  const name = "KiCad Python (pcb)";
  const bin = findKicadPython();
  if (!bin) return { name, level: "warn", detail: "not found ($KICAD_PYTHON, KiCad.app)", hint: "comes with KiCad: brew install --cask kicad" };
  // Importing pcbnew writes KiCad settings: keep them in the toolchain's isolated config folder.
  const out = await output([bin, "-c", "import sys, pcbnew; print(sys.version.split()[0], pcbnew.Version())"], { KICAD_CONFIG_HOME: paths.kicadConfig });
  const [py, kicad] = (out ?? "").trim().split("\n").pop()?.split(/\s+/) ?? [];
  if (!py || !kicad) return { name, level: "warn", detail: `${bin}: import pcbnew failed` };
  const ok = SUPPORTED_KICAD.test(kicad);
  return { name, level: ok ? "ok" : "warn", detail: `Python ${py}, pcbnew ${kicad} at ${bin}${ok ? "" : " (not KiCad 10.0.x)"}` };
}

function checkFreerouting(): Check {
  const name = "Freerouting (pcb)";
  if (!existsSync(FREEROUTING.jar)) return { name, level: "info", detail: `${FREEROUTING.version} not downloaded yet; bun run pcb fetches it (sha256-pinned)` };
  if (sha256File(FREEROUTING.jar) !== FREEROUTING.sha256) {
    return { name, level: "warn", detail: `${FREEROUTING.jar} has the wrong sha256`, hint: "delete it; bun run pcb downloads the pinned jar again" };
  }
  return { name, level: "ok", detail: `${FREEROUTING.version}, sha256 as pinned` };
}

function checkModels(): Check {
  const name = "SPICE models";
  const files = MODELS.flatMap((m) => Object.values(m.extract));
  const missing = files.filter((f) => !existsSync(join(MODELS_DIR, f)));
  if (missing.length) return { name, level: "warn", detail: `missing in models/: ${missing.join(", ")}`, hint: "bun run models:fetch" };
  return { name, level: "ok", detail: `${files.join(", ")} in models/` };
}

async function checkNode(): Promise<Check> {
  const bin = Bun.which("node");
  const v = bin ? parseVersion((await output([bin, "--version"])) ?? "") : null;
  return { name: "node", level: "info", detail: `${v ?? "not found"} (informational; the toolchain runs on Bun and does not need Node)` };
}

function checkVendored(): Check {
  const { symbols, footprints } = vendoredTables(paths.libKicad);
  if (!existsSync(paths.libKicad)) {
    return { name: "lib/kicad", level: "warn", detail: "not vendored yet", hint: "bun run lib:import   (after KiCad is installed)" };
  }
  return { name: "lib/kicad", level: "ok", detail: `${symbols.length} symbol lib(s), ${footprints.length} footprint lib(s)` };
}

const REQUIRED = new Set(["git", "bun", "kicad-cli", "ngspice"]);

async function main(): Promise<number> {
  const kicad = await checkKicad();
  const checks: Check[] = [
    await checkGit(), await checkBun(), ...kicad.checks, await checkNgspice(), checkModels(),
    await checkJava(), await checkKicadPython(), checkFreerouting(), await checkNode(), checkVendored(),
  ];

  const w = Math.max(...checks.map((c) => c.name.length));
  console.log(`${"check".padEnd(w)}  status  detail`);
  for (const c of checks) console.log(`${c.name.padEnd(w)}  ${c.level.padEnd(6)}  ${c.detail}`);
  if (kicad.about.length) console.log(`\nkicad-cli version --format about:\n${kicad.about.map((l) => `  ${l}`).join("\n")}`);
  if (kicad.notes.length) console.log(`\nKiCad notes:\n${kicad.notes.map((l) => `  - ${l}`).join("\n")}`);
  const hints = new Map<string, string[]>();
  for (const c of checks) if (c.hint && c.level !== "ok") hints.set(c.hint, [...(hints.get(c.hint) ?? []), c.name]);
  if (hints.size) {
    console.log("\nhints (doctor never installs anything):");
    for (const [hint, names] of hints) console.log(`  ${names.join(", ")}: ${hint}`);
  }

  const failed = checks.filter((c) => c.level === "FAIL" && REQUIRED.has(c.name));
  console.log(failed.length ? `\ndoctor: ${failed.length} required check(s) failed: ${failed.map((c) => c.name).join(", ")}` : "\ndoctor: all required tools OK");
  return failed.length ? 1 : 0;
}

if (import.meta.main) {
  const USAGE = "usage: bun run doctor   (read-only: reports the tools, versions and paths; installs nothing)";
  if (parseCli(USAGE, {}).positionals.length) usageError(USAGE);
  process.exit(await main());
}
