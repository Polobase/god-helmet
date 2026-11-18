// S-expression model, parser and KiCad-style printer.
//
// KiCad files (.kicad_sch, .kicad_sym, .kicad_mod, .kicad_pcb, *-lib-table) are S-expressions.
// Three atom kinds matter for faithful output: bare symbols (`yes`, `passive`), quoted strings
// (`"R1"`), and numbers. Parsed numbers keep their raw text so vendored library content
// round-trips byte-for-byte; numbers we create are formatted by `formatNumber`.

export type Node = List | Sym | Str | Num;

export interface List {
  readonly type: "list";
  readonly items: Node[];
}
export interface Sym {
  readonly type: "sym";
  readonly value: string;
}
export interface Str {
  readonly type: "str";
  readonly value: string;
}
export interface Num {
  readonly type: "num";
  readonly value: number;
  /** Original text when parsed from a file; printed verbatim. */
  readonly raw?: string;
}

export type Atom = Sym | Str | Num;
/** Loose input accepted by `l()`: plain numbers become Num, plain strings become Sym. */
export type Item = Node | number | string | null | undefined | false;

export const sym = (value: string): Sym => ({ type: "sym", value });
export const str = (value: string): Str => ({ type: "str", value });
export const num = (value: number): Num => ({ type: "num", value });

/** Build a list. Plain strings become bare symbols (use `str()` for quoted), numbers become Num,
 *  and null/undefined/false entries are dropped, which keeps optional children tidy. */
export function l(...items: Item[]): List {
  const out: Node[] = [];
  for (const it of items) {
    if (it === null || it === undefined || it === false) continue;
    if (typeof it === "number") out.push(num(it));
    else if (typeof it === "string") out.push(sym(it));
    else out.push(it);
  }
  return { type: "list", items: out };
}

export const isList = (n: Node | undefined): n is List => n?.type === "list";

/** Head symbol of a list, e.g. "symbol" for `(symbol "R" ...)`. */
export function head(n: Node | undefined): string | undefined {
  if (!isList(n)) return undefined;
  const h = n.items[0];
  return h?.type === "sym" ? h.value : undefined;
}

/** Direct child lists with the given head. */
export function children(n: List, name: string): List[] {
  return n.items.filter((c): c is List => head(c) === name);
}

/** First direct child list with the given head. */
export function child(n: List, name: string): List | undefined {
  return n.items.find((c): c is List => head(c) === name);
}

/** Atom value at position `i` (1 = first after the head) as a string or number. */
export function atom(n: List | undefined, i: number): string | number | undefined {
  const a = n?.items[i];
  if (!a || a.type === "list") return undefined;
  return a.value;
}

export function atomStr(n: List | undefined, i: number): string | undefined {
  const v = atom(n, i);
  return typeof v === "string" ? v : undefined;
}

export function atomNum(n: List | undefined, i: number): number | undefined {
  const v = atom(n, i);
  return typeof v === "number" ? v : undefined;
}

// ---------------------------------------------------------------------------------------------
// Parser

export class SExprParseError extends Error {
  constructor(
    message: string,
    readonly file: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(`${file}:${line}:${col}: ${message}`);
    this.name = "SExprParseError";
  }
}

const NUMBER_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

/** Parse a single top-level S-expression. Throws SExprParseError with line:col. */
export function parse(text: string, file = "<input>"): List {
  let i = 0;
  const n = text.length;
  const fail = (msg: string, at = i): never => {
    let ln = 1;
    let ls = 0;
    for (let k = 0; k < at && k < n; k++) {
      if (text.charCodeAt(k) === 10) {
        ln++;
        ls = k + 1;
      }
    }
    throw new SExprParseError(msg, file, ln, at - ls + 1);
  };

  const skipWs = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };

  const parseString = (): Str => {
    const start = i;
    i++; // opening quote
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return str(out);
      }
      if (c === "\\") {
        const e = text[i + 1];
        if (e === undefined) fail("unterminated escape", i);
        i += 2;
        if (e === "n") out += "\n";
        else if (e === "r") out += "\r";
        else if (e === "t") out += "\t";
        else out += e; // \" \\ and any other char stand for themselves
        continue;
      }
      out += c;
      i++;
    }
    return fail("unterminated string", start);
  };

  const parseBare = (): Sym | Num => {
    const start = i;
    while (i < n) {
      const c = text[i];
      if (c === "(" || c === ")" || c === '"' || c === " " || c === "\t" || c === "\n" || c === "\r") break;
      i++;
    }
    const raw = text.slice(start, i);
    if (NUMBER_RE.test(raw)) return { type: "num", value: Number(raw), raw };
    return sym(raw);
  };

  const parseList = (): List => {
    const open = i;
    i++; // (
    const items: Node[] = [];
    for (;;) {
      skipWs();
      if (i >= n) return fail("unbalanced '(' (missing ')')", open);
      const c = text[i];
      if (c === ")") {
        i++;
        return { type: "list", items };
      }
      if (c === "(") items.push(parseList());
      else if (c === '"') items.push(parseString());
      else items.push(parseBare());
    }
  };

  skipWs();
  if (text[i] !== "(") fail("expected '(' at start of S-expression");
  const root = parseList();
  skipWs();
  if (i < n) fail("unexpected content after top-level S-expression");
  return root;
}

// ---------------------------------------------------------------------------------------------
// Printer

/** Format a number the way KiCad does for mm values: at most `decimals` decimals, trailing
 *  zeros trimmed, never "-0". Integers print without a decimal point. */
export function formatNumber(v: number, decimals = 4): string {
  if (!Number.isFinite(v)) throw new Error(`cannot format non-finite number ${v}`);
  let s = v.toFixed(decimals);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return s;
}

export function quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + '"';
}

function printAtom(a: Atom): string {
  switch (a.type) {
    case "sym":
      return a.value;
    case "str":
      return quote(a.value);
    case "num":
      return a.raw ?? formatNumber(a.value);
  }
}

/** Column limit for packing consecutive `(xy …)` lists: another xy is appended while the line
 *  is shorter than this (tabs count 1), as in KICAD_FORMAT::Prettify (kicad_io_utils.cpp). */
const XY_WRAP_COLUMN = 99;

/**
 * Print in KiCad 8+ style: one list per line, tab indentation, leaf lists (atoms only) on a
 * single line, closing paren of a non-leaf list on its own line, and runs of `(xy …)` packed
 * onto shared lines. Output ends with a newline.
 */
export function print(root: List): string {
  const lines: string[] = [];

  const isLeaf = (n: List) => n.items.every((c) => c.type !== "list");
  const leafText = (n: List) => "(" + n.items.map((c) => printAtom(c as Atom)).join(" ") + ")";

  const emit = (n: List, depth: number) => {
    const indent = "\t".repeat(depth);
    if (isLeaf(n)) {
      lines.push(indent + leafText(n));
      return;
    }
    // Opening line: head atoms up to the first child list.
    let k = 0;
    const headAtoms: string[] = [];
    while (k < n.items.length && n.items[k]!.type !== "list") {
      headAtoms.push(printAtom(n.items[k] as Atom));
      k++;
    }
    lines.push(indent + "(" + headAtoms.join(" "));
    const childIndent = "\t".repeat(depth + 1);
    let xyLine: string | null = null;
    const flushXy = () => {
      if (xyLine !== null) lines.push(xyLine);
      xyLine = null;
    };
    for (; k < n.items.length; k++) {
      const c = n.items[k]!;
      if (c.type !== "list") {
        // Atom after a child list (rare in KiCad files): keep it on its own line.
        flushXy();
        lines.push(childIndent + printAtom(c));
        continue;
      }
      if (head(c) === "xy" && isLeaf(c)) {
        const t = leafText(c);
        if (xyLine === null) xyLine = childIndent + t;
        else if (xyLine.length < XY_WRAP_COLUMN) xyLine += " " + t;
        else {
          lines.push(xyLine);
          xyLine = childIndent + t;
        }
        continue;
      }
      flushXy();
      emit(c, depth + 1);
    }
    flushXy();
    lines.push(indent + ")");
  };

  emit(root, 0);
  return lines.join("\n") + "\n";
}
