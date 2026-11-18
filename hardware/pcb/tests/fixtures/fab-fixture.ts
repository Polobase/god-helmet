// Fab-tool fixtures.
//
// writeFabFixture: the pipeline-proof schematic plus a generated board carrying all its
// footprints (placed apart, some rotated, unrouted, no nets). DRC therefore runs without
// schematic parity (draft only).
//
// writeMiniFixture: a three-part board whose pins are all no-connect, so every net holds one
// pad and the unrouted board passes DRC *with* schematic parity: the non-draft path end to end.
// Its schematic is built from a caller-supplied parts database (test sourcing records).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitProject } from "../../tools/kicad/emit-pro.ts";
import { emitBoard, type BoardFootprint } from "../../tools/kicad/emit-pcb.ts";
import { emitSchematic } from "../../tools/kicad/emit-sch.ts";
import { emitFpLibTable, emitSymLibTable } from "../../tools/kicad/libtables.ts";
import { rootUuid, uuidv5 } from "../../tools/kicad/uuid.ts";
import { vendoredTables } from "../../tools/kicad/vendor.ts";
import { loadAllParts } from "../../tools/module/load.ts";
import { buildSchematic, loadVendored, TOOL_VERSION, type BuildResult } from "../../tools/sch/build.ts";
import type { DesignInput } from "../../tools/sch/dsl.ts";
import { writeGenerated } from "../../tools/sch/gates.ts";
import { generate } from "../../tools/sch/generate.ts";
import proof from "./pipeline-proof/schematic.ts";

type Place = { at: [number, number]; rot?: 0 | 90 | 180 | 270 };

/** Board positions (mm) per part key: connectors in the top row, the other SMD parts below. */
const PLACE: Record<string, Place> = {
  pwrIn: { at: [25, 25] }, inJack: { at: [70, 25] }, outConn: { at: [100, 25], rot: 270 },
  rTop: { at: [125, 25] }, rBot: { at: [140, 25], rot: 180 },
  amp: { at: [25, 75] }, dPos: { at: [42, 75] }, dNeg: { at: [57, 75] }, cBulkP: { at: [72, 75] }, cBulkN: { at: [87, 75] },
  cDecP: { at: [100, 75] }, cDecN: { at: [110, 75] }, rOut: { at: [120, 75], rot: 90 }, rGnd: { at: [130, 75] }, rFb: { at: [140, 75] },
};

function footprintsOf(build: BuildResult, design: DesignInput, place: Record<string, Place>, withNets: boolean): BoardFootprint[] {
  const lib = loadVendored();
  return Object.entries(design.parts).map(([key, inst]) => {
    const unit = build.ir.units.find((u) => u.kind === "part" && u.ref === inst.ref && u.unit === 1)!;
    const info = lib.footprints.get(unit.footprint);
    if (!info) throw new Error(`footprint ${unit.footprint} not vendored`);
    const { at: [x, y], rot } = place[key]!;
    return {
      libId: unit.footprint, info, ref: inst.ref, value: unit.value, at: { x, y }, ...(rot && { rot }),
      symbolUuid: uuidv5(unit.uuidName), sheetfile: `${design.project}.kicad_sch`,
      // Every symbol field, so schematic parity finds no footprint_symbol_field_mismatch.
      fields: [["Datasheet", unit.datasheet], ["Description", unit.description], ...unit.extraFields],
      // KiCad names the net of a no-connect pin "unconnected-(<ref>-<pin name>-Pad<n>)", without the name part
      // when the pin has none (checked against kicad-cli 10.0.6's netlist).
      ...(withNets && { nets: Object.fromEntries([...info.numbers].map((n) => {
        const name = unit.info.pins.find((p) => p.number === n)?.name;
        return [n, `unconnected-(${inst.ref}-${name && name !== "~" ? `${name}-` : ""}Pad${n})`];
      })) }),
    };
  });
}

export function writeFabFixture(dir: string): void {
  const g = generate("pipeline-proof", proof, { dir });
  writeGenerated(g);
  const board = emitBoard({ name: "fab-fixture", outline: { x: 10, y: 10, w: 145, h: 80 }, footprints: footprintsOf(g.build, proof, PLACE, false),
    texts: [{ text: "fab fixture", x: 20, y: 85 }] }, TOOL_VERSION);
  writeFileSync(join(dir, "pipeline-proof.kicad_pcb"), board);
}

export const MINI_ID = "fab-mini";

const MINI: DesignInput = {
  project: MINI_ID,
  sheet: { paper: "A4", title: "fab test board", rev: "A", date: "2026-09-24" },
  parts: {
    r: { ref: "R1", part: "res-0603", value: "1k", at: [40, 40] },
    q: { ref: "Q1", part: "mmbt3904-sot23", at: [60, 40] },
    hdr: { ref: "J1", part: "header-1x04-2.54", at: [80, 40] },
  },
  nets: {},
  noConnect: ["r.1", "r.2", "q.1", "q.2", "q.3", "hdr.1", "hdr.2", "hdr.3", "hdr.4"],
};

/** R1 turned 90°; the header's anchor (pin 1) is 3.81 mm from its pad centre. */
const MINI_PLACE: Record<string, Place> = { r: { at: [25, 30], rot: 90 }, q: { at: [40, 30] }, hdr: { at: [65, 22] } };

/** Writes fab-mini.kicad_sch/.kicad_pro/.kicad_pcb and the library tables into `dir` (a board of 2 or 4 copper layers). */
export function writeMiniFixture(dir: string, partsDir: string, copperLayers: 2 | 4 = 2): void {
  const build = buildSchematic(MINI, { parts: loadAllParts(partsDir), lib: loadVendored() });
  const tables = vendoredTables();
  writeFileSync(join(dir, `${MINI_ID}.kicad_sch`), emitSchematic(build.ir, TOOL_VERSION));
  writeFileSync(join(dir, `${MINI_ID}.kicad_pro`), emitProject({ name: MINI_ID, rootUuid: rootUuid(MINI_ID) }));
  writeFileSync(join(dir, "sym-lib-table"), emitSymLibTable(dir, tables.symbols));
  writeFileSync(join(dir, "fp-lib-table"), emitFpLibTable(dir, tables.footprints));
  writeFileSync(join(dir, `${MINI_ID}.kicad_pcb`), emitBoard({ name: MINI_ID, outline: { x: 10, y: 10, w: 80, h: 45 },
    footprints: footprintsOf(build, MINI, MINI_PLACE, true), texts: [{ text: "fab mini", x: 20, y: 50 }], ...(copperLayers === 4 && { copperLayers }) }, TOOL_VERSION));
}
