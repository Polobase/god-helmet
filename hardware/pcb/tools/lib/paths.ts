// Folder layout of the toolchain (hardware/pcb). Every tool resolves paths from here, never from process.cwd().
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dir, "../..");

export const paths = {
  root: REPO_ROOT,
  build: join(REPO_ROOT, "build"),
  /** Isolated KICAD_CONFIG_HOME for every kicad-cli call, so the user's KiCad settings never
   *  change results (KiCad's own CLI QA does the same). Gitignored. */
  kicadConfig: join(REPO_ROOT, ".kicad-config"),
  libKicad: join(REPO_ROOT, "lib/kicad"),
  parts: join(REPO_ROOT, "parts"),
  modules: join(REPO_ROOT, "modules"),
  fixtures: join(REPO_ROOT, "tests/fixtures"),
} as const;

/** Directory of a board: modules/<id>. */
export function projectDir(id: string): string {
  const dir = join(paths.modules, id);
  if (existsSync(dir)) return dir;
  throw new Error(`no board named "${id}" (looked in modules/)`);
}

/** KiCad project folder of a board: modules/<id>/kicad. */
export const kicadDir = (id: string) => join(projectDir(id), "kicad");

/** Per-board build output folder (gitignored). */
export const buildDir = (id: string) => join(paths.build, id);
