// Test helpers for suites that need external programs (kicad-cli, ngspice).
//
// `bun test` skips such suites when the program is missing; `bun run test:full` sets
// REQUIRE_EXTERNAL_TOOLS=1, which turns a missing program into a failure so a gate can't pass
// silently on a machine without KiCad. `bun run test:unit` sets SKIP_EXTERNAL_TOOLS=1, which skips
// them even when the program is installed (the fast suite for the pre-commit hook and CI).

export const requireExternalTools = process.env.REQUIRE_EXTERNAL_TOOLS === "1";
export const skipExternalTools = process.env.SKIP_EXTERNAL_TOOLS === "1";
if (requireExternalTools && skipExternalTools) {
  throw new Error("REQUIRE_EXTERNAL_TOOLS=1 and SKIP_EXTERNAL_TOOLS=1 contradict each other");
}

/** Returns whether the tool is present; throws when it is required but missing. */
export function toolAvailable(present: boolean, name: string): boolean {
  if (skipExternalTools) return false;
  if (!present && requireExternalTools) {
    throw new Error(`${name} is required (REQUIRE_EXTERNAL_TOOLS=1) but was not found; run \`bun run doctor\``);
  }
  return present;
}
