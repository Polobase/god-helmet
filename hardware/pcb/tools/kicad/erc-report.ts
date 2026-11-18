// kicad-cli ERC JSON report (schema https://schemas.kicad.org/erc.v1.json, KiCad 10.0.6).
// Positions are 100x too small up to 10.0.6 (KiCad #25582, fixed in 10.0.7): the gate only uses
// counts, types and severities; the .rpt text report carries correct positions.
import * as z from "zod";

const Item = z.looseObject({ uuid: z.string(), description: z.string(), pos: z.looseObject({ x: z.number(), y: z.number() }) });
const Violation = z.looseObject({
  type: z.string(),
  description: z.string(),
  severity: z.enum(["error", "warning", "exclusion"]),
  items: z.array(Item),
  excluded: z.boolean().optional(),
});
export const ErcReport = z.looseObject({
  kicad_version: z.string(),
  coordinate_units: z.string(),
  included_severities: z.array(z.string()),
  sheets: z.array(z.looseObject({ path: z.string(), uuid_path: z.string().optional(), violations: z.array(Violation) })),
  source: z.string(),
  ignored_checks: z.array(z.looseObject({ key: z.string() })).default([]),
});
export type ErcReport = z.infer<typeof ErcReport>;
export type ErcViolation = z.infer<typeof Violation>;

export function ercViolations(report: ErcReport): ErcViolation[] {
  return report.sheets.flatMap((s) => s.violations);
}

/** Rules KiCad 10.0.6 ignores by default (erc_settings.cpp; the ignored_checks of an ERC run on a
 *  default project, 2026-09-24). Anything else ignored was switched off in the .kicad_pro. */
export const DEFAULT_ERC_IGNORED = ["footprint_filter", "four_way_junction", "simulation_model_issue", "single_global_label"];

export function summarizeErc(report: ErcReport) {
  const v = ercViolations(report);
  const excluded = v.filter((x) => x.excluded === true || x.severity === "exclusion");
  const active = v.filter((x) => !excluded.includes(x));
  const ignored = report.ignored_checks.map((c) => c.key).sort();
  return {
    errors: active.filter((x) => x.severity === "error").length,
    warnings: active.filter((x) => x.severity === "warning").length,
    excluded: excluded.length,
    types: [...new Set(v.map((x) => x.type))].sort(),
    ignored,
    extraIgnored: ignored.filter((k) => !DEFAULT_ERC_IGNORED.includes(k)),
    violations: v,
  };
}
