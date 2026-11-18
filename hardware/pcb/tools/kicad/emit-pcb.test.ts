import { expect, test } from "bun:test";
import { loadVendored, TOOL_VERSION } from "../sch/build.ts";
import { emitBoard } from "./emit-pcb.ts";
import { UUID_V5_RE } from "./uuid.ts";

const lib = loadVendored();
const jack = lib.footprints.get("GHP_Connector_Audio:Jack_3.5mm_KoreanHropartsElec_PJ-320D-4A_Horizontal")!;

test("two copies of a footprint with library item UUIDs get distinct, deterministic UUIDs", () => {
  const spec = {
    name: "uuid-test",
    outline: { x: 0, y: 0, w: 60, h: 40 },
    footprints: [
      { libId: "GHP_Connector_Audio:Jack", info: jack, ref: "J1", value: "PJ-320D-4A", at: { x: 15, y: 10 } },
      { libId: "GHP_Connector_Audio:Jack", info: jack, ref: "J2", value: "PJ-320D-4A", at: { x: 40, y: 10 } },
    ],
  };
  const board = emitBoard(spec, TOOL_VERSION);
  const ids = [...board.matchAll(/\(uuid "([^"]+)"\)/g)].map((m) => m[1]!);
  expect(ids.length).toBeGreaterThan(4);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(UUID_V5_RE);
  expect(emitBoard(spec, TOOL_VERSION)).toBe(board);
});
