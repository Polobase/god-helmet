// Load YAML files through zod with source positions.
//
// Every problem (YAML syntax or schema) becomes an Issue with file:line:col, the path inside the
// document and a message, printed in the style of z.prettifyError. Loaders throw a
// ValidationError that carries all issues of a file (or of a directory for loadAllParts).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import { isCollection, isMap, isNode, isScalar, isSeq, LineCounter, parseDocument, type Document, type Node as YamlNode } from "yaml";
import * as z from "zod";
import { paths } from "../lib/paths.ts";
import { Part } from "./parts.ts";
import { BoardYaml, PART_KEY_HINT, PART_KEY_RE } from "./schema.ts";

export interface Issue {
  file: string;
  line: number;
  col: number;
  path: PropertyKey[];
  message: string;
}

/** Repo-relative path for display (absolute when outside the repo). */
export function displayPath(file: string): string {
  if (!isAbsolute(file)) return file;
  const rel = relative(paths.root, file);
  return rel.startsWith("..") ? file : rel;
}

export function formatIssue(i: Issue, mark = "✘"): string {
  const head = `${displayPath(i.file)}:${i.line}:${i.col} ${mark} ${i.message}`;
  return i.path.length ? `${head}\n  → at ${z.core.toDotPath(i.path)}` : head;
}

export class ValidationError extends Error {
  constructor(readonly issues: Issue[]) {
    super(issues.map((i) => formatIssue(i)).join("\n"));
    this.name = "ValidationError";
  }
}

export interface Loaded<T> {
  value: T;
  file: string;
  /** Source position of a path inside the document (for follow-up checks). */
  locate: (path: readonly PropertyKey[]) => { line: number; col: number };
}

/** Does a YAML map key match a zod path segment? toJS() turns scalar keys into object keys, so a
 *  number or boolean key (e.g. a resistor value `100:`) appears in the path as a string. */
const keyMatches = (key: unknown, seg: PropertyKey) =>
  key === seg || (typeof seg === "string" && (typeof key === "number" || typeof key === "boolean" || typeof key === "bigint") && String(key) === seg);

/** Offset of the node a zod path points at. Scalars and flow collections point at the value,
 *  block collections at their key (the value starts on the next line); a path that runs past the
 *  document (missing key) stops at the deepest existing node. `atKey` points at the last key. */
function offsetOf(doc: Document.Parsed, path: readonly PropertyKey[], atKey = false): number {
  let node: unknown = doc.contents;
  let key: YamlNode | null = null;
  let complete = true;
  for (const seg of path) {
    if (isMap(node)) {
      const pair = node.items.find((p) => keyMatches(isScalar(p.key) ? p.key.value : p.key, seg));
      if (!pair) {
        complete = false;
        break;
      }
      key = isNode(pair.key) ? pair.key : null;
      node = pair.value;
    } else if (isSeq(node) && typeof seg === "number" && seg < node.items.length) {
      key = null;
      node = node.items[seg];
    } else {
      complete = false;
      break;
    }
  }
  const start = (n: YamlNode | null) => n?.range?.[0];
  if (atKey && complete && key) return start(key) ?? 0;
  if (isNode(node)) {
    if (isCollection(node) && !node.flow && key) return start(key) ?? 0;
    return start(node) ?? start(key) ?? 0;
  }
  return start(key) ?? 0;
}

/** Parse YAML text and validate it with `schema`. Throws ValidationError with every issue. */
export function parseYaml<S extends z.ZodType>(schema: S, text: string, file: string): Loaded<z.output<S>> {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: false });
  const at = (offset: number) => lineCounter.linePos(offset);

  const yamlIssues: Issue[] = [...doc.errors, ...doc.warnings].map((e) => ({
    file,
    ...at(e.pos[0]),
    path: [],
    message: `YAML ${e.code}: ${e.message}`,
  }));
  if (yamlIssues.length) throw new ValidationError(yamlIssues);

  const locate = (path: readonly PropertyKey[]) => at(offsetOf(doc, path));
  const result = schema.safeParse(doc.toJS());
  if (!result.success) {
    const issues = result.error.issues.map((i): Issue => {
      // Point unknown keys at the key itself rather than at the enclosing object.
      const pos =
        i.code === "unrecognized_keys" && i.keys[0] !== undefined ? at(offsetOf(doc, [...i.path, i.keys[0]], true)) : locate(i.path);
      return { file, ...pos, path: i.path, message: i.message };
    });
    issues.sort((a, b) => a.line - b.line || a.col - b.col);
    throw new ValidationError(issues);
  }
  return { value: result.data, file, locate };
}

export function loadYaml<S extends z.ZodType>(schema: S, file: string): Loaded<z.output<S>> {
  return parseYaml(schema, readFileSync(file, "utf8"), file);
}

/** Parse a module.yaml (BoardYaml). */
export const parseProject = (text: string, file: string): Loaded<BoardYaml> => parseYaml(BoardYaml, text, file);

export const loadProject = (file: string): Loaded<BoardYaml> => parseProject(readFileSync(file, "utf8"), file);

/** module.yaml of a board, validated. */
export const loadProjectYaml = (file: string): BoardYaml => loadProject(file).value;

export const loadPart = (file: string): Part => loadYaml(Part, file).value;

/** parts/<key>.yaml files in `dir`, sorted (empty when the directory does not exist). */
export function partFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => join(dir, f));
}

export const partKey = (file: string) => basename(file, ".yaml");

/** Every parts/*.yaml that validates (key = file basename), plus the issues of the rest. */
export function readParts(dir: string = paths.parts): { parts: Map<string, Loaded<Part>>; issues: Issue[] } {
  const parts = new Map<string, Loaded<Part>>();
  const issues: Issue[] = [];
  for (const file of partFiles(dir)) {
    const key = partKey(file);
    if (!PART_KEY_RE.test(key)) {
      issues.push({ file, line: 1, col: 1, path: [], message: `file name "${key}" is not a valid part key (${PART_KEY_HINT})` });
      continue;
    }
    try {
      parts.set(key, loadYaml(Part, file));
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      issues.push(...e.issues);
    }
  }
  return { parts, issues };
}

/** Load every parts/*.yaml; key = file basename. Throws one ValidationError for all files. */
export function loadAllParts(dir: string = paths.parts): Map<string, Part> {
  const { parts, issues } = readParts(dir);
  if (issues.length) throw new ValidationError(issues);
  return new Map([...parts].map(([key, loaded]) => [key, loaded.value]));
}
