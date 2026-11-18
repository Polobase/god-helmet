// External tools of the PCB flow: KiCad's bundled Python (pcbnew, for the steps kicad-cli cannot
// do) and the Freerouting autorouter (a Java jar, fetched into the gitignored .tools/ with a pinned
// sha256). Freerouting runs headless with its telemetry and analytics switched off, its settings
// and log kept in the build folder, and Java's HTTP(S) sent to an unreachable proxy, so it cannot
// reach the network.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { findKicadPython, KICAD_PYTHON_CANDIDATES } from "../kicad/install.ts";
import { sha256File } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";
import { exitText, run } from "../lib/proc.ts";

/** Time limits that only stop a hung process: a whole `bun run pcb` of a small 2-layer board took about 15 s. */
export const KICAD_PY_TIMEOUT_MS = 10 * 60_000;
export const FREEROUTING_TIMEOUT_MS = 15 * 60_000;

export function kicadPython(): string {
  const p = findKicadPython();
  if (!p) throw new Error(`KiCad's bundled Python not found ($KICAD_PYTHON, ${KICAD_PYTHON_CANDIDATES.join(", ")})`);
  return p;
}

const HELPER = join(import.meta.dir, "kicad_pcb.py");

/** Run tools/pcb/kicad_pcb.py with KiCad's Python and the repo's isolated KiCad config. */
export async function kicadPy(args: string[], o: { configHome?: string; timeoutMs?: number } = {}): Promise<string> {
  const r = await run([kicadPython(), HELPER, ...args], {
    env: { KICAD_CONFIG_HOME: o.configHome ?? paths.kicadConfig },
    timeoutMs: o.timeoutMs ?? KICAD_PY_TIMEOUT_MS,
  });
  if (r.code !== 0 || r.signal) throw new Error(`kicad_pcb.py ${args[0]} failed (${exitText(r)}):\n${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

export const FREEROUTING = {
  version: "2.4.1",
  /** sha256 of freerouting-2.4.1.jar from the GitHub release (published 2026-09-03). */
  sha256: "251101c3eeac22d7e7dfcf6796603279e5d1000283eb82d8f093780f7afc6aa9",
  url: "https://github.com/freerouting/freerouting/releases/download/v2.4.1/freerouting-2.4.1.jar",
  jar: join(paths.root, ".tools", "freerouting", "freerouting-2.4.1.jar"),
  /** The jar's classes are version 69 and its manifest says "Created-By: 25.0.4.1" (read 2026-09-28). */
  minJava: 25,
} as const;

/** Java's version from `java -version`: 'openjdk version "27" 2026-09-15' → 27; '"1.8.0_402"' → 8. */
export function parseJavaVersion(out: string): { version: string; major: number } | null {
  const m = /version "((\d+)(?:\.(\d+))?[^"]*)"/.exec(out);
  if (!m?.[1] || !m[2]) return null;
  return { version: m[1], major: m[2] === "1" && m[3] ? Number(m[3]) : Number(m[2]) };
}

/** Places to look for Java, in order: $JAVA_HOME, Homebrew's keg-only OpenJDK, PATH. */
export function javaCandidates(): string[] {
  const c: string[] = [];
  if (process.env.JAVA_HOME) c.push(join(process.env.JAVA_HOME, "bin", "java"));
  c.push("/opt/homebrew/opt/openjdk/bin/java", "/usr/local/opt/openjdk/bin/java");
  const onPath = Bun.which("java");
  if (onPath) c.push(onPath);
  return [...new Set(c)].filter((p) => existsSync(p));
}

/** The first Java that runs and is at least `minMajor`. macOS's /usr/bin/java is only a stub: without a
 *  JDK its `-version` fails, so it is skipped. */
export async function findJava(minMajor: number = FREEROUTING.minJava): Promise<{ bin: string; version: string; major: number } | null> {
  for (const bin of javaCandidates()) {
    try {
      const r = await run([bin, "-version"], { timeoutMs: 30_000 });
      const v = r.code === 0 ? parseJavaVersion(`${r.stderr}\n${r.stdout}`) : null;
      if (v && v.major >= minMajor) return { bin, ...v };
    } catch {
      // not runnable: try the next one
    }
  }
  return null;
}

/** Download the pinned Freerouting jar (once) and check its hash. */
export async function fetchFreerouting(): Promise<string> {
  if (existsSync(FREEROUTING.jar) && sha256File(FREEROUTING.jar) === FREEROUTING.sha256) return FREEROUTING.jar;
  mkdirSync(dirname(FREEROUTING.jar), { recursive: true });
  const res = await fetch(FREEROUTING.url, { redirect: "follow", headers: { Accept: "application/octet-stream" } });
  if (!res.ok) throw new Error(`Freerouting download failed: HTTP ${res.status} (${FREEROUTING.url})`);
  writeFileSync(FREEROUTING.jar, new Uint8Array(await res.arrayBuffer()));
  const got = sha256File(FREEROUTING.jar);
  if (got !== FREEROUTING.sha256) throw new Error(`Freerouting jar has sha256 ${got}, expected ${FREEROUTING.sha256}`);
  return FREEROUTING.jar;
}

export interface RouteResult {
  unrouted: number;
  violations: number;
  log: string;
}

/**
 * Autoroute a Specctra DSN into a session file. Settings (telemetry off, no GUI) live in `work`,
 * which also receives Freerouting's log. `extraArgs` are more Freerouting settings (`--router.scoring.via_costs=35`).
 */
export async function freeroute(dsn: string, ses: string, work: string, passes = 40, timeoutMs = FREEROUTING_TIMEOUT_MS, extraArgs: string[] = []): Promise<RouteResult> {
  const jar = await fetchFreerouting();
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "freerouting.json"), JSON.stringify({
    // A fixed anonymous profile id (Freerouting needs one); no telemetry, no contact.
    profile: { id: "00000000-0000-4000-8000-000000000000", email: "", allow_telemetry: false, allow_contact: false },
    usage_and_diagnostic_data: { disable_analytics: true, track_window_changed: false, track_button_clicked: false },
    gui: { enabled: false },
    api_server: { enabled: false },
    version: FREEROUTING.version,
  }, null, 2));
  const java = await findJava();
  if (!java) throw new Error(`Java ${FREEROUTING.minJava} or newer not found ($JAVA_HOME, Homebrew's openjdk, PATH); see bun run doctor`);
  const r = await run([
    java.bin, "-Duser.language=en",
    "-Dhttp.proxyHost=127.0.0.1", "-Dhttp.proxyPort=9", "-Dhttps.proxyHost=127.0.0.1", "-Dhttps.proxyPort=9",
    "-jar", jar, "-de", dsn, "-do", ses, "-mp", String(passes),
    "--gui.enabled=false", "--profile.allow_telemetry=false", "--usage_and_diagnostic_data.disable_analytics=true",
    ...extraArgs,
    `--user_data_path=${work}`,
  ], { cwd: work, timeoutMs });
  const log = `${r.stdout}\n${r.stderr}`;
  if (r.code !== 0 || r.signal || !existsSync(ses)) {
    throw new Error(`Freerouting failed (${exitText(r)}):\n${log.trim().split("\n").slice(-15).join("\n")}`);
  }
  const final = [...log.matchAll(/\((\d+) unrouted and (\d+) violations\)/g)].pop();
  return { unrouted: Number(final?.[1] ?? -1), violations: Number(final?.[2] ?? -1), log };
}
