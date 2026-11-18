// kicad-cli wrapper: locate the binary, enforce KiCad 10.0.x, isolate the config, map exit codes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { run, type RunResult } from "../lib/proc.ts";
import { APP_BUNDLE_CLI, SUPPORTED_KICAD } from "./install.ts";

/** kicad-cli exit codes (include/cli/exit_codes.h, KiCad 10.0.6). */
export const KiCadExit = {
  OK: 0,
  BAD_ARGS: 1,
  UNKNOWN: 2,
  INVALID_INPUT: 3,
  OUTPUT_ERROR: 4,
  VIOLATIONS: 5,
  JOBSET_FAILED: 6,
} as const;

const EXIT_NAMES: Record<number, string> = Object.fromEntries(Object.entries(KiCadExit).map(([k, v]) => [v, k]));

export class KiCadCliError extends Error {
  constructor(
    readonly args: string[],
    readonly result: RunResult,
  ) {
    const name = EXIT_NAMES[result.code] ?? "UNEXPECTED";
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(-5).join("\n");
    super(`kicad-cli ${args.slice(0, 3).join(" ")} failed: exit ${result.code} (${name})\n${detail}`);
    this.name = "KiCadCliError";
  }
}

/** $KICAD_CLI, then PATH (Homebrew links it), then the app bundle. */
export function findKicadCli(): string | null {
  const env = process.env.KICAD_CLI;
  if (env && existsSync(env)) return env;
  const onPath = Bun.which("kicad-cli");
  if (onPath) return onPath;
  return existsSync(APP_BUNDLE_CLI) ? APP_BUNDLE_CLI : null;
}

/** `kicad-cli version` also creates settings files, so it too runs in the isolated config. */
export async function kicadVersion(bin: string, configHome: string = paths.kicadConfig): Promise<string> {
  mkdirSync(configHome, { recursive: true });
  const r = await run([bin, "version", "--format", "plain"], { timeoutMs: 30_000, env: { KICAD_CONFIG_HOME: configHome } });
  if (r.code !== 0) throw new Error(`kicad-cli version failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

export interface KiCadRunOptions {
  /** Directory used as KICAD_CONFIG_HOME (default: <repo>/.kicad-config). */
  configHome?: string;
  cwd?: string;
  timeoutMs?: number;
  /** Exit codes that are not errors (default: [0]). */
  okCodes?: number[];
  env?: Record<string, string>;
}

let checked: { bin: string; version: string } | null = null;

/** Resolve kicad-cli once per process and assert the supported version. */
export async function requireKicadCli(): Promise<{ bin: string; version: string }> {
  if (checked) return checked;
  const bin = findKicadCli();
  if (!bin) throw new Error("kicad-cli not found. Install KiCad 10: brew install --cask kicad (see docs/environment.md)");
  const version = await kicadVersion(bin);
  if (!SUPPORTED_KICAD.test(version)) {
    throw new Error(`kicad-cli ${version} found at ${bin}, but this repo requires KiCad 10.0.x`);
  }
  checked = { bin, version };
  return checked;
}

/** Seed the isolated config so reports are in English regardless of the OS language
 *  (KiCad falls back to the system language when system.language is "Default"). */
function seedConfig(configHome: string, version: string) {
  const dir = join(configHome, version.split(".").slice(0, 2).join("."));
  const file = join(dir, "kicad_common.json");
  mkdirSync(dir, { recursive: true });
  const cfg = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { system?: Record<string, unknown> }) : {};
  if (cfg.system?.language === "English") return;
  cfg.system = { ...cfg.system, language: "English" };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
}

/** Run a kicad-cli subcommand. Throws KiCadCliError unless the exit code is in okCodes. */
export async function kicadCli(args: string[], opts: KiCadRunOptions = {}): Promise<RunResult> {
  const { bin, version } = await requireKicadCli();
  const configHome = opts.configHome ?? paths.kicadConfig;
  seedConfig(configHome, version);
  const result = await run([bin, ...args], {
    env: { KICAD_CONFIG_HOME: configHome, ...opts.env },
    timeoutMs: opts.timeoutMs ?? 300_000,
    ...(opts.cwd !== undefined && { cwd: opts.cwd }),
  });
  if (!(opts.okCodes ?? [KiCadExit.OK]).includes(result.code)) throw new KiCadCliError(args, result);
  return result;
}
