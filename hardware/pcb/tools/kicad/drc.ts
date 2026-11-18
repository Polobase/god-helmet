// The DRC gate shared by `bun run fab` and `bun run pcb` (kicad-cli pcb drc, JSON report).
import { readFileSync } from "node:fs";
import * as z from "zod";
import { kicadCli, KiCadExit } from "./cli.ts";

/** Checks KiCad 10.0.6 ignores by default: `ignored_checks` of drc.json for a board whose
 *  .kicad_pro sets no rule_severities (tests/kicad/fab.test.ts checks this on the fixture). Any
 *  other ignored check was switched off in the project and refuses the export. */
export const KICAD_DEFAULT_IGNORED = [
  "footprint_filters_mismatch", "footprint_type_mismatch", "missing_courtyard", "track_not_centered_on_via", "tuning_profile_track_geometries",
];

const DrcItem = z.looseObject({ type: z.string(), severity: z.string(), excluded: z.boolean().default(false) });
const DrcReport = z.looseObject({
  kicad_version: z.string(),
  violations: z.array(DrcItem),
  unconnected_items: z.array(DrcItem).default([]),
  schematic_parity: z.array(DrcItem).default([]),
  ignored_checks: z.array(z.looseObject({ key: z.string() })).default([]),
});

export interface DrcOptions {
  /** Run with --schematic-parity. */
  parity: boolean;
  /** Where the report is kept after a refusal, for the messages ("see …"). */
  see: string;
  configHome?: string;
  /** Extra environment for kicad-cli (e.g. FONTCONFIG_FILE). */
  env?: Record<string, string>;
}

export interface DrcSummary {
  errors: number;
  warnings: number;
  excluded: number;
  types: string[];
  /** Checks the project ignores (KiCad's defaults unless the export was refused). */
  ignored: string[];
  parity: boolean;
  /** Connections the copper does not make (they also count as errors above). */
  unconnected: number;
}

/**
 * Errors, warnings and exclusions are reported (--severity-exclusions), zones are refilled in memory
 * (the board file is not saved) so DRC sees the copper the Gerber export plots with --check-zones.
 * Refused: any error or warning, any excluded violation, and any check set to "ignore" beyond
 * KiCad's defaults.
 */
export async function runDrc(pcb: string, jsonOut: string, o: DrcOptions): Promise<{ summary: DrcSummary; kicadVersion: string; problems: string[] }> {
  await kicadCli(["pcb", "drc", "--format", "json", "--units", "mm", "--severity-error", "--severity-warning", "--severity-exclusions",
    "--refill-zones", "--exit-code-violations", ...(o.parity ? ["--schematic-parity"] : []), "-o", jsonOut, pcb],
  { okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS], ...(o.configHome && { configHome: o.configHome }), ...(o.env && { env: o.env }) });
  const drc = DrcReport.parse(JSON.parse(readFileSync(jsonOut, "utf8")));
  const all = [...drc.violations, ...drc.unconnected_items, ...drc.schematic_parity];
  const active = all.filter((v) => !v.excluded);
  const excluded = all.filter((v) => v.excluded);
  const summary: DrcSummary = {
    errors: active.filter((v) => v.severity === "error").length,
    warnings: active.filter((v) => v.severity === "warning").length,
    excluded: excluded.length,
    types: [...new Set(all.map((v) => v.type))].sort(),
    ignored: drc.ignored_checks.map((c) => c.key).sort(),
    parity: o.parity,
    unconnected: drc.unconnected_items.filter((v) => !v.excluded).length,
  };
  const problems: string[] = [];
  if (summary.errors + summary.warnings > 0) {
    const types = [...new Set(active.map((v) => v.type))].sort();
    problems.push(`DRC: ${summary.errors} errors, ${summary.warnings} warnings (${types.join(", ")}); ${o.see}`);
  }
  if (excluded.length) {
    const types = [...new Set(excluded.map((v) => v.type))].sort();
    problems.push(`DRC: ${excluded.length} violations are excluded in the .kicad_pro (${types.join(", ")}); fix them instead of excluding them; ${o.see}`);
  }
  const extraIgnored = summary.ignored.filter((k) => !KICAD_DEFAULT_IGNORED.includes(k));
  if (extraIgnored.length) {
    problems.push(`DRC: checks set to "ignore" in the .kicad_pro beyond KiCad's defaults: ${extraIgnored.join(", ")}; set them back to error or warning`);
  }
  return { summary, kicadVersion: drc.kicad_version, problems };
}
