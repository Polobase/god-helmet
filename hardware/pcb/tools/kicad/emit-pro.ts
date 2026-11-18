// Minimal KiCad 10 project file (.kicad_pro, JSON).
//
// kicad-cli only loads project settings (ERC severities, text variables, project library tables)
// when <name>.kicad_pro sits next to the schematic. Structure follows the KiCad 10.0.6 demo
// demos/pic_programmer/pic_programmer.kicad_pro; KiCad fills every omitted key with defaults and
// may normalise the file on the first GUI open — commit the normalised version then (KiCad owns it).

export interface ProjectOptions {
  /** Project basename (= module id); files are <name>.kicad_pro / .kicad_sch. */
  name: string;
  /** UUID of the root schematic sheet (must equal the (uuid …) in <name>.kicad_sch). */
  rootUuid: string;
  /** Project text variables; every ${VAR} on a sheet needs a default here, or ERC reports
   *  unresolved_variable (an error). */
  textVariables?: Record<string, string>;
  /** Sheet symbols of a hierarchical design (UUID and sheet name), listed after the root in `sheets` as KiCad does. */
  pages?: { uuid: string; name: string }[];
}

export function emitProject(o: ProjectOptions): string {
  const pro = {
    board: {},
    boards: [],
    cvpcb: { equivalence_files: [] },
    erc: {
      erc_exclusions: [],
      meta: { version: 0 },
      // Empty = KiCad defaults. Any override needs a reason in the module's design-notes.md.
      rule_severities: {},
    },
    libraries: { pinned_footprint_libs: [], pinned_symbol_libs: [] },
    meta: { filename: `${o.name}.kicad_pro`, version: 3 },
    schematic: {
      connection_grid_size: 50.0, // mil = 1.27 mm, the grid every generated coordinate sits on
      meta: { version: 1 },
      top_level_sheets: [{ filename: `${o.name}.kicad_sch`, name: o.name, uuid: o.rootUuid }],
    },
    sheets: [[o.rootUuid, o.name], ...(o.pages ?? []).map((p) => [p.uuid, p.name])],
    text_variables: { GIT_SHA: "dev", ...o.textVariables },
  };
  return JSON.stringify(pro, null, 2) + "\n";
}
