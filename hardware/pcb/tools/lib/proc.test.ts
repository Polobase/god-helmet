import { describe, expect, test } from "bun:test";
import { CommandNotFoundError, childEnv, exitText, run } from "./proc.ts";

describe("childEnv", () => {
  test("adds variables and removes the ones set to undefined", async () => {
    process.env.PROC_TEST_DROP = "x";
    try {
      const env = childEnv({ PROC_TEST_ADD: "1", PROC_TEST_DROP: undefined });
      expect(env.PROC_TEST_ADD).toBe("1");
      expect("PROC_TEST_DROP" in env).toBe(false);
      const r = await run(["/bin/sh", "-c", 'echo "${PROC_TEST_DROP-unset}"'], { env: { PROC_TEST_DROP: undefined } });
      expect(r.stdout).toBe("unset\n");
    } finally {
      delete process.env.PROC_TEST_DROP;
    }
  });
});

describe("run", () => {
  test("stdout, stderr and exit code", async () => {
    const r = await run(["/bin/sh", "-c", "echo out; echo err >&2; exit 3"]);
    expect(r).toEqual({ code: 3, stdout: "out\n", stderr: "err\n" });
    expect(exitText(r)).toBe("exit 3");
  });

  test("a timeout kills the process and says so", async () => {
    const t0 = Date.now();
    const r = await run(["/bin/sleep", "10"], { timeoutMs: 200 });
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.signal).toBeDefined();
    expect(exitText(r)).toStartWith("killed by SIG");
  });

  test("output larger than a pipe buffer on both streams does not deadlock", async () => {
    const r = await run(["/bin/sh", "-c", "head -c 300000 /dev/zero | tr '\\0' e >&2; head -c 300000 /dev/zero | tr '\\0' o"], { timeoutMs: 20_000 });
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBe(300000);
    expect(r.stderr.length).toBe(300000);
  });

  test("a missing program", async () => {
    await expect(run(["/no/such/program"])).rejects.toBeInstanceOf(CommandNotFoundError);
  });
});
