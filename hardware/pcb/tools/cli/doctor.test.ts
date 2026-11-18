import { describe, expect, test } from "bun:test";
import {
  compareVersions,
  kicadKnownIssues,
  minVersionFromRange,
  parseGitVersion,
  parseKicadAbout,
  parseNgspiceVersion,
  parseVersion,
  symbolLibLayout,
} from "./doctor.ts";

describe("version helpers", () => {
  test("parseVersion finds the first dotted number", () => {
    expect(parseVersion("v26.3.0\n")).toBe("26.3.0");
    expect(parseVersion("10.0.6")).toBe("10.0.6");
    expect(parseVersion("no digits")).toBeNull();
  });

  test("compareVersions is numeric, missing parts are 0", () => {
    expect(compareVersions("1.4.10", "1.4.2")).toBe(1);
    expect(compareVersions("1.4.2", "1.4.2")).toBe(0);
    expect(compareVersions("1.3.9", "1.4.2")).toBe(-1);
    expect(compareVersions("1.4", "1.4.0")).toBe(0);
  });

  test("minVersionFromRange reads >=x.y.z only", () => {
    expect(minVersionFromRange(">=1.4.2")).toBe("1.4.2");
    expect(minVersionFromRange(" >= 1.4 ")).toBe("1.4");
    expect(minVersionFromRange("^1.4.2")).toBeNull();
  });
});

describe("tool output parsers", () => {
  test("git", () => {
    expect(parseGitVersion("git version 2.50.1 (Apple Git-155)\n")).toBe("2.50.1");
    expect(parseGitVersion("")).toBeNull();
  });

  test("ngspice: skips the banner line", () => {
    // Captured from Homebrew ngspice 47 on 2026-09-24.
    const out = [
      "******",
      "** ngspice-47 : Circuit level simulation program",
      "** Compiled with KLU Direct Linear Solver",
      "** The U. C. Berkeley CAD Group",
      "** Copyright 1985-1994, Regents of the University of California.",
      "** Copyright 2001-2026, The ngspice team.",
      "** Please get your ngspice manual from https://ngspice.sourceforge.io/docs.html",
      "** Please file your bug-reports at http://ngspice.sourceforge.net/bugrep.html",
      "******",
      "",
    ].join("\n");
    expect(parseNgspiceVersion(out)).toEqual({ version: "47", line: "ngspice-47 : Circuit level simulation program" });
    expect(parseNgspiceVersion("******\n")).toBeNull();
  });

  test("kicad-cli version --format about", () => {
    // Layout of GetVersionInfoData (common/build_version.cpp, KiCad 10.0.6); the values are
    // illustrative, not captured from a real build (KiCad was not installed when this was written).
    const text = [
      "Application: kicad-cli arm64 on arm64",
      "",
      "Version: 10.0.6, release build",
      "",
      "Libraries:",
      "\twxWidgets 3.2.8",
      "\tFreeType 2.13.3",
      "",
      "Platform: macOS Version 26.0, 64 bit, Little endian, wxMac",
      "",
      "Build Info:",
      "\tDate: Sep  1 2026 10:00:00",
      "\twxWidgets: 3.2.8 (wchar_t,wx containers)",
      "\tBoost: 1.88.0",
      "\tngspice: 45.2",
      "\tCompiler: Clang 17.0.0 with C++ ABI 1002",
      "",
      "Locale: ",
      "\tLang: en_US",
    ].join("\n");
    expect(parseKicadAbout(text)).toEqual({
      version: "10.0.6, release build",
      platform: "macOS Version 26.0, 64 bit, Little endian, wxMac",
      buildDate: "Sep  1 2026 10:00:00",
      ngspice: "45.2",
      compiler: "Clang 17.0.0 with C++ ABI 1002",
    });
    expect(parseKicadAbout("")).toEqual({});
  });
});

describe("KiCad", () => {
  test("known issues by version", () => {
    const at = (v: string) => kicadKnownIssues(v).map((n) => n.slice(0, 6));
    expect(at("10.0.6")).toEqual(["#25582", "#25413"]);
    expect(at("10.0.3")).toEqual(["#25582"]);
    expect(at("10.0.7")).toEqual([]);
    expect(at("9.0.2")).toEqual([]);
  });

  test("symbol library layout", () => {
    expect(symbolLibLayout(["Device.kicad_sym", "Amplifier_Operational.kicad_symdir", "power.kicad_sym", "README.md"])).toEqual({ packed: 2, symdir: 1 });
  });
});
