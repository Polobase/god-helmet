import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paths } from "../lib/paths.ts";
import { bundleSource, gitlabSource, KICAD_LIB_LICENSE_SHA256, provenanceChanges } from "./vendor.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
/** A fetch that serves `body` and counts calls; nothing leaves the machine. */
function stubFetch(body: string) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  return calls;
}
const LICENSE = readFileSync(join(paths.fixtures, "kicad-symbols-10.0.6", "LICENSE.md"), "utf8");

describe("the library licence is pinned", () => {
  test("the vendored copy is the pinned one", () => {
    expect(new Bun.CryptoHasher("sha256").update(readFileSync(join(paths.libKicad, "LICENSE.md"))).digest("hex")).toBe(KICAD_LIB_LICENSE_SHA256);
  });

  test("gitlab: the real licence is accepted and cached; a second call does not fetch", async () => {
    const calls = stubFetch(LICENSE);
    const src = gitlabSource("10.0.6", mkdtempSync(join(tmpdir(), "vendor-cache-")));
    const file = await src.license();
    expect(readFileSync(file, "utf8")).toBe(LICENSE);
    expect(existsSync(`${file}.part`)).toBe(false);
    await src.license();
    expect(calls).toHaveLength(1);
  });

  test("gitlab: anything else is refused", async () => {
    stubFetch("not the licence");
    await expect(gitlabSource("10.0.6", mkdtempSync(join(tmpdir(), "vendor-cache-"))).license()).rejects.toThrow(/not the pinned KiCad library licence/);
  });

  test("bundle without LICENSE.md: the vendored copy, no network", async () => {
    const calls = stubFetch("must not be fetched");
    const file = await bundleSource(mkdtempSync(join(tmpdir(), "no-bundle-"))).license();
    expect(file).toBe(join(paths.libKicad, "LICENSE.md"));
    expect(calls).toEqual([]);
  });
});

describe("provenanceChanges", () => {
  const sources = (symSha: string, fpSha: string) => ({
    symbols: { "Device:R": { from: ["Device.kicad_sym"], sha256: [symSha] } },
    footprints: { "Resistor_SMD:R_0603_1608Metric": { from: "Resistor_SMD.pretty/R_0603_1608Metric.kicad_mod", sha256: fpSha } },
  });

  test("nothing to compare on a first import; identical imports report nothing", () => {
    expect(provenanceChanges(null, sources("a", "b"))).toEqual([]);
    expect(provenanceChanges(sources("a", "b"), sources("a", "b"))).toEqual([]);
  });

  test("changed, new and removed ids", () => {
    expect(provenanceChanges(sources("a", "b"), sources("a2", "b"))).toEqual(["Device:R"]);
    const next = sources("a", "b");
    (next.footprints as Record<string, unknown>)["LED_THT:LED_D3.0mm"] = { from: "x", sha256: "c" };
    delete (next.symbols as Record<string, unknown>)["Device:R"];
    expect(provenanceChanges(sources("a", "b"), next)).toEqual(["Device:R (removed)", "LED_THT:LED_D3.0mm (new)"]);
  });
});
