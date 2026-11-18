import { describe, expect, test } from "bun:test";
import { findJava, javaCandidates, parseJavaVersion } from "./tools.ts";

describe("parseJavaVersion", () => {
  test.each([
    ['openjdk version "27" 2026-09-15\nOpenJDK Runtime Environment Homebrew (build 27)', "27", 27],
    ['openjdk version "25.0.4" 2026-07-15 LTS', "25.0.4", 25],
    ['java version "21.0.2" 2024-01-16 LTS', "21.0.2", 21],
    ['java version "1.8.0_402"', "1.8.0_402", 8],
  ])("%s", (out, version, major) => {
    expect(parseJavaVersion(out)).toEqual({ version, major });
  });

  test("the macOS stub's message has no version", () => {
    expect(parseJavaVersion("The operation couldn’t be completed. Unable to locate a Java Runtime.")).toBeNull();
  });
});

describe("findJava", () => {
  test("only existing candidates, $JAVA_HOME first", () => {
    const saved = process.env.JAVA_HOME;
    try {
      process.env.JAVA_HOME = "/no/such/jdk";
      expect(javaCandidates()).not.toContain("/no/such/jdk/bin/java");
    } finally {
      if (saved === undefined) delete process.env.JAVA_HOME;
      else process.env.JAVA_HOME = saved;
    }
  });

  test("an impossible minimum finds nothing", async () => {
    expect(await findJava(10_000)).toBeNull();
  });
});
