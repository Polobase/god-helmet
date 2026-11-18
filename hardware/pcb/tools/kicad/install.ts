// Which KiCad the repo supports and where KiCad lives on this Mac: the one place for the install facts
// the tools, the tests and doctor need. $KICAD_CLI (tools/kicad/cli.ts) and $KICAD_PYTHON override the
// app-bundle paths.
import { existsSync } from "node:fs";

/** The only KiCad line this repo supports (files are written in KiCad 10's native format). */
export const SUPPORTED_KICAD = /^10\.0\./;
/** The KiCad release the vendored libraries (lib/kicad) and the recorded default rule sets come from. */
export const KICAD_LIB_TAG = "10.0.6";

export const KICAD_APP = "/Applications/KiCad/KiCad.app";
export const APP_BUNDLE_CLI = `${KICAD_APP}/Contents/MacOS/kicad-cli`;
/** Stock symbol and footprint libraries of the installed KiCad. */
export const KICAD_SHARED_SUPPORT = `${KICAD_APP}/Contents/SharedSupport`;
/** KiCad's bundled Python with the pcbnew module (tools/pcb/kicad_pcb.py). */
export const KICAD_PYTHON_CANDIDATES = [
  `${KICAD_APP}/Contents/Frameworks/Python.framework/Versions/Current/bin/python3`,
  `${KICAD_APP}/Contents/Frameworks/Python.framework/Versions/3.9/bin/python3`,
];
/** KiCad's demo projects, installed by the Homebrew cask's pkg (needs sudo). */
export const KICAD_DEMOS = "/Library/Application Support/kicad/demos";

/** KiCad's Python: $KICAD_PYTHON when set (null if it doesn't exist), else the app bundle's. */
export function findKicadPython(): string | null {
  const env = process.env.KICAD_PYTHON;
  if (env) return existsSync(env) ? env : null;
  return KICAD_PYTHON_CANDIDATES.find((c) => existsSync(c)) ?? null;
}
