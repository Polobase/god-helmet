import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { KICAD_DEMOS } from "../kicad/install.ts";
import { skipExternalTools } from "../lib/testing.ts";
import { atomNum, atomStr, child, children, formatNumber, head, l, num, parse, print, SExprParseError, str } from "./sexpr.ts";

const FIXTURES = join(import.meta.dir, "../../tests/fixtures/kicad-symbols-10.0.6");

describe("formatNumber", () => {
  test.each([
    [0, "0"],
    [-0, "0"],
    [1.27, "1.27"],
    [2.54, "2.54"],
    [-3.81, "-3.81"],
    [1.2700000001, "1.27"],
    [0.00004, "0"],
    [-0.00004, "0"],
    [10, "10"],
    [0.1 + 0.2, "0.3"],
    [123.45678, "123.4568"],
  ])("%p -> %p", (v, s) => expect(formatNumber(v)).toBe(s));

  test("rejects non-finite", () => expect(() => formatNumber(Number.NaN)).toThrow());
});

describe("parse", () => {
  test("atoms keep their kinds", () => {
    const n = parse('(pin passive line (at 0 -3.81 90) (name "~" (effects)) (number "1"))');
    expect(head(n)).toBe("pin");
    expect(n.items[1]).toEqual({ type: "sym", value: "passive" });
    const at = child(n, "at")!;
    expect(atomNum(at, 2)).toBe(-3.81);
    expect(atomStr(child(n, "number"), 1)).toBe("1");
    expect(n.items[3]).toMatchObject({ type: "list" });
  });

  test("string escapes", () => {
    const n = parse('(text "a \\"q\\" b\\\\c\\nd")');
    expect(atomStr(n, 1)).toBe('a "q" b\\c\nd');
  });

  test("errors carry line and column", () => {
    try {
      parse("(a\n  (b 1)\n  (c \"x)\n", "f.kicad_sch");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SExprParseError);
      const err = e as SExprParseError;
      expect(err.line).toBe(3);
      expect(err.col).toBe(6);
      expect(err.message).toContain("f.kicad_sch:3:6");
    }
  });

  test("unbalanced and trailing content", () => {
    expect(() => parse("(a (b)")).toThrow(/unbalanced/);
    expect(() => parse("(a) (b)")).toThrow(/after top-level/);
    expect(() => parse("  x")).toThrow(/expected '\('/);
  });

  test("children helper", () => {
    const n = parse("(r (p 1) (q 2) (p 3))");
    expect(children(n, "p").map((c) => atomNum(c, 1))).toEqual([1, 3]);
  });
});

describe("print", () => {
  test("KiCad style layout", () => {
    const tree = l("kicad_sch", l("version", 20260306), l("generator", str("god-helmet-pcb")),
      l("property", str("Reference"), str("R1"), l("at", 1.27, 2.54, 0), l("effects", l("font", l("size", 1.27, 1.27)))));
    expect(print(tree)).toBe(
      [
        "(kicad_sch",
        "\t(version 20260306)",
        '\t(generator "god-helmet-pcb")',
        '\t(property "Reference" "R1"',
        "\t\t(at 1.27 2.54 0)",
        "\t\t(effects",
        "\t\t\t(font",
        "\t\t\t\t(size 1.27 1.27)",
        "\t\t\t)",
        "\t\t)",
        "\t)",
        ")",
        "",
      ].join("\n"),
    );
  });

  test("created numbers are formatted, parsed numbers keep raw text", () => {
    expect(print(l("at", num(-0), 1.2700000001))).toBe("(at 0 1.27)\n");
    expect(print(parse("(at 1.270 -0)"))).toBe("(at 1.270 -0)\n");
  });

  test("l() drops null/undefined/false", () => {
    expect(print(l("a", null, undefined, false, l("b")))).toBe("(a\n\t(b)\n)\n");
  });

  test("xy runs pack up to column 99", () => {
    const pts = l("pts", ...Array.from({ length: 12 }, (_, i) => l("xy", i * 1.27, -i * 2.54)));
    const lines = print(l("polyline", pts)).split("\n");
    expect(lines[2]!.startsWith("\t\t(xy 0 0) (xy 1.27 -2.54)")).toBe(true);
    expect(lines.filter((s) => s.includes("(xy")).length).toBeGreaterThan(1);
  });
});

describe("byte-identical round-trip of KiCad 10.0.6 files", () => {
  for (const f of readdirSync(FIXTURES).filter((n) => n.endsWith(".kicad_sym"))) {
    test(f, async () => {
      const text = await Bun.file(join(FIXTURES, f)).text();
      expect(print(parse(text, f))).toBe(text);
    });
  }

  // KiCad installs its demo projects here (Homebrew cask); round-trip every schematic it ships.
  const demos = existsSync(KICAD_DEMOS) && !skipExternalTools
    ? (Array.from(new Bun.Glob("**/*.kicad_sch").scanSync({ cwd: KICAD_DEMOS })) as string[])
    : [];
  test.skipIf(demos.length === 0)(`installed KiCad demo schematics (${demos.length})`, async () => {
    for (const rel of demos) {
      const text = await Bun.file(join(KICAD_DEMOS, rel)).text();
      if (!text.includes("(generator_version \"10.0\")")) continue; // older-format demos are not re-saved
      expect({ file: rel, same: print(parse(text, rel)) === text }).toEqual({ file: rel, same: true });
    }
  });
});
