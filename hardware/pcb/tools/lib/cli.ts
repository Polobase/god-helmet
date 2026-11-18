// Shared command-line handling for tools/cli/*:
//  - flags are strict: an unknown or misspelt flag is a usage error, never silently ignored;
//  - --help / -h prints the usage (exit 0);
//  - a leading "--" (from `bun run <script> -- …`) is dropped;
//  - usage errors exit 2; failures print one "✘ <what>: <message>" line and exit 1 (no stack trace).
import { parseArgs, type ParseArgsConfig } from "node:util";

type Options = NonNullable<ParseArgsConfig["options"]>;

/** Parses `argv` (default: the process arguments) or exits with the usage. */
export function parseCli<const O extends Options>(usage: string, options: O, argv: string[] = process.argv.slice(2)) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    process.exit(0);
  }
  try {
    return parseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (e) {
    return usageError(usage, (e as Error).message);
  }
}

/** Prints the usage (after `message`, if any) to stderr and exits 2. */
export function usageError(usage: string, message?: string): never {
  console.error(message ? `✘ ${message}\n${usage}` : usage);
  process.exit(2);
}

/** The one failure line every tool prints: "✘ <what>: <message>". */
export const failure = (what: string, e: unknown) => `✘ ${what}: ${e instanceof Error ? e.message : String(e)}`;

/** Prints the failure line for `what` and exits 1. */
export function fail(what: string, e: unknown): never {
  console.error(failure(what, e));
  process.exit(1);
}
