// Run external programs with an argument array (never a shell string).

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The signal that ended the process (for example SIGTERM from `timeoutMs`), when one did. */
  signal?: string;
}

/** "exit 3", or "killed by SIGTERM" when a signal (such as the timeout) ended the process. */
export const exitText = (r: RunResult) => (r.signal ? `killed by ${r.signal}` : `exit ${r.code}`);

export interface RunOptions {
  cwd?: string;
  /** Added to the inherited environment; a key set to undefined is removed from it. */
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

/** The inherited environment with `extra` applied: undefined values delete the variable. */
export function childEnv(extra: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string | undefined> = { ...process.env, ...extra };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  return env as Record<string, string>;
}

export class CommandNotFoundError extends Error {
  constructor(readonly command: string) {
    super(`command not found: ${command}`);
    this.name = "CommandNotFoundError";
  }
}

export async function run(cmd: string[], opts: RunOptions = {}): Promise<RunResult> {
  const [bin] = cmd;
  if (!bin) throw new Error("run(): empty command");
  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn({
      cmd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: childEnv(opts.env),
      ...(opts.cwd !== undefined && { cwd: opts.cwd }),
      ...(opts.timeoutMs !== undefined && { timeout: opts.timeoutMs }),
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new CommandNotFoundError(bin);
    throw e;
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr, ...(proc.signalCode && { signal: proc.signalCode }) };
}
