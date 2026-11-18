// Deterministic RFC 4122 version-5 UUIDs.
//
// Every UUID in a generated schematic is derived from a stable name (e.g.
// "pipeline-proof/part/amp/unit/3"), so regenerating unchanged input is byte-identical and
// KiCad's symbol↔footprint links (which are UUID based) survive schematic iterations.
import { createHash } from "node:crypto";

/** The toolchain's name: the generator in every KiCad file it writes, and the seed of its UUID namespace. */
export const TOOLCHAIN = "god-helmet-pcb";

/** Namespace for all UUIDs this toolchain writes = uuidv5(TOOLCHAIN, RFC 4122 URL namespace). */
export const TOOLCHAIN_NAMESPACE = "8ad4b0da-2f45-5e8e-8310-ac161d0ce1a1";

const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function toBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`invalid UUID: ${uuid}`);
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
}

function fromBytes(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function uuidv5(name: string, namespace: string = TOOLCHAIN_NAMESPACE): string {
  const hash = createHash("sha1").update(toBytes(namespace)).update(name, "utf8").digest();
  const b = new Uint8Array(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50; // version 5
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  return fromBytes(b);
}

export const UUID_V5_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** How TOOLCHAIN_NAMESPACE was derived; checked by the unit test. */
export const deriveNamespace = () => uuidv5(TOOLCHAIN, URL_NAMESPACE);

/** UUID of a project's root sheet: shared by the .kicad_sch (uuid …), the symbol instance paths
 *  and .kicad_pro top_level_sheets, so every writer of either must use this. */
export const rootUuid = (project: string) => uuidv5(`${project}/root`);

/** UUID of the sheet symbol of a page (hierarchical designs): the second element of the instance paths of the
 *  page's symbols ("/<rootUuid>/<sheetUuid>") and the first of the board footprints' paths. */
export const sheetUuid = (project: string, page: string) => uuidv5(`${project}/sheet/${page}`);

/** Seed of a page file's own (uuid …); the sheet symbol, not the file, carries the hierarchy. */
export const pageFileUuidName = (project: string, page: string) => `${project}/page/${page}`;
