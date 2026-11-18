// Project library tables (sym-lib-table, fp-lib-table) pointing at the vendored libraries in
// lib/kicad. URIs are relative to ${KIPRJMOD} so the repo works from any checkout location.
import { relative } from "node:path";
import { l, print, str } from "../sexpr/sexpr.ts";
import { paths } from "../lib/paths.ts";

export interface LibEntry {
  /** Nickname used in lib_ids, e.g. "GHP_Device". */
  name: string;
  /** Path relative to lib/kicad, e.g. "symbols/GHP_Device.kicad_sym". */
  path: string;
  descr?: string;
}

function table(kind: "sym_lib_table" | "fp_lib_table", projectDir: string, libs: LibEntry[]): string {
  const base = relative(projectDir, paths.libKicad).split("\\").join("/");
  const rows = [...libs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) =>
      l("lib", l("name", str(e.name)), l("type", str("KiCad")), l("uri", str(`\${KIPRJMOD}/${base}/${e.path}`)),
        l("options", str("")), l("descr", str(e.descr ?? ""))),
    );
  return print(l(kind, l("version", 7), ...rows));
}

export const emitSymLibTable = (projectDir: string, libs: LibEntry[]) => table("sym_lib_table", projectDir, libs);
export const emitFpLibTable = (projectDir: string, libs: LibEntry[]) => table("fp_lib_table", projectDir, libs);
