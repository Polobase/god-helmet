// tools/pcb/kicad_pcb.py in KiCad's bundled Python (SWIG pcbnew): the steps kicad-cli cannot do. No
// Freerouting. This is also the canary for KiCad 11, which is expected to drop the SWIG bindings: when these
// fail after an upgrade, `bun run pcb` needs the port to the IPC API.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kicadCli, KiCadExit } from "../../tools/kicad/cli.ts";
import { analyzeFootprint } from "../../tools/kicad/fplib.ts";
import { findKicadPython } from "../../tools/kicad/install.ts";
import { paths } from "../../tools/lib/paths.ts";
import { toolAvailable } from "../../tools/lib/testing.ts";
import { boardCopperLayers, gerberLayers } from "../../tools/fab/fab.ts";
import { PLANE_VIA, withStackup } from "../../tools/pcb/flow.ts";
import { padPos, type FootprintGeom, type Placement } from "../../tools/pcb/place.ts";
import { FREEROUTING, freeroute, javaCandidates, kicadPy } from "../../tools/pcb/tools.ts";
import { atomNum, atomStr, child, children, parse } from "../../tools/sexpr/sexpr.ts";

const hasPython = toolAvailable(findKicadPython() !== null, "KiCad's bundled Python (pcbnew)");
const work = mkdtempSync(join(tmpdir(), "pcb-python-"));
const configHome = join(work, "kicad-config");
afterAll(() => rmSync(work, { recursive: true, force: true }));

const libDir = join(paths.libKicad, "footprints");
const FOOTPRINTS = [
  { lib: "GHP_Package_SO", name: "SOIC-14_3.9x8.7mm_P1.27mm" },
  { lib: "GHP_Resistor_SMD", name: "R_0603_1608Metric" },
  { lib: "GHP_Connector_JST", name: "JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical" },
];
const key = (f: { lib: string; name: string }) => `${f.lib}:${f.name}`;

describe.skipIf(!hasPython)("kicad_pcb.py (KiCad's Python, no Freerouting)", () => {
  let info: Record<string, FootprintGeom>;

  test("info: the pads KiCad reports are the footprint file's pads", async () => {
    writeFileSync(join(work, "info-in.json"), JSON.stringify({ libDir, footprints: FOOTPRINTS }));
    await kicadPy(["info", join(work, "info-in.json"), join(work, "info.json")], { configHome });
    info = JSON.parse(readFileSync(join(work, "info.json"), "utf8"));
    for (const f of FOOTPRINTS) {
      const file = join(libDir, `${f.lib}.pretty`, `${f.name}.kicad_mod`);
      const want = analyzeFootprint(parse(readFileSync(file, "utf8"), file)).pads.map((p) => p.number).sort();
      expect(info[key(f)]!.pads.map((p) => p.number).sort()).toEqual(want);
      const c = info[key(f)]!.courtyard;
      expect(c.x1 > c.x0 && c.y1 > c.y0).toBe(true);
    }
  }, 120_000);

  test("build: KiCad puts every pad where the placer computes it, on both sides and rotated", async () => {
    const at: Record<string, Placement & { lib: string; name: string }> = {
      U1: { ...FOOTPRINTS[0]!, x: 15, y: 15, rot: 90, side: "bottom" },
      R1: { ...FOOTPRINTS[1]!, x: 5, y: 5, rot: 0, side: "top" },
      R2: { ...FOOTPRINTS[1]!, x: 25, y: 5, rot: 270, side: "bottom" },
      J1: { ...FOOTPRINTS[2]!, x: 10, y: 25, rot: 0, side: "top" },
    };
    const board = join(work, "smoke.kicad_pcb");
    const job = {
      board, libDir, sheetfile: "smoke.kicad_sch", nets: ["GND", "N1"],
      outline: { x0: 0, y0: 0, x1: 30, y1: 40 },
      footprints: Object.entries(at).map(([ref, a]) => ({
        lib: a.lib, name: a.name, ref, value: ref, x: a.x, y: a.y, rot: a.rot, side: a.side,
        pads: ref === "U1" ? { "7": "GND", "1": "N1" } : ref === "R1" ? { "1": "N1", "2": "GND" } : {},
      })),
    };
    writeFileSync(join(work, "job.json"), JSON.stringify(job));
    await kicadPy(["build", join(work, "job.json")], { configHome });
    expect(existsSync(board)).toBe(true);
    const placed: Record<string, { number: string; x: number; y: number }[]> = JSON.parse(readFileSync(`${board}.pads.json`, "utf8"));
    for (const [ref, a] of Object.entries(at)) {
      for (const p of info[key(a)]!.pads) {
        const want = padPos(p, a);
        const got = placed[ref]!.find((q) => q.number === p.number && Math.hypot(q.x - want.x, q.y - want.y) < 0.002);
        expect({ ref, pad: p.number, found: got !== undefined }).toEqual({ ref, pad: p.number, found: true });
      }
    }
    // KiCad 10 names the net on each pad; there is no numbered net table any more.
    const text = readFileSync(board, "utf8");
    expect(text.includes('(net "GND")') && text.includes('(net "N1")')).toBe(true);
  }, 120_000);

  test("dsn: Specctra export for Freerouting carries the nets", async () => {
    const dsn = join(work, "smoke.dsn");
    await kicadPy(["dsn", join(work, "smoke.kicad_pcb"), dsn], { configHome });
    const text = readFileSync(dsn, "utf8");
    expect(text).toContain("(pcb ");
    expect(text).toContain("GND");
    expect(text).toContain("N1");
  }, 120_000);

  // Scripted copper (a board that is all buses is laid out by its pcb.ts, not by the autorouter): zones on
  // any net and layer, tracks, vias, a zone keep-out, silkscreen text and drawings. DRC is the check that the script
  // connected everything, so it must see both a complete board and a missing via.
  describe("copper: zones per net, tracks, vias, keep-outs, silkscreen text and drawings", () => {
    const [r0603, conn] = [FOOTPRINTS[1]!, FOOTPRINTS[2]!];
    const board = join(work, "copper.kicad_pcb");
    const jobFile = join(work, "copper-job.json");
    const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const job = (vias: { net: string; x: number; y: number; diameter: number; drill: number }[]) => ({
      board, libDir, sheetfile: "copper.kicad_sch", nets: ["GND", "N1"],
      outline: { x0: 0, y0: 0, x1: 40, y1: 30 },
      pour: { clearance: 0.3, minWidth: 0.25, edgeClearance: 0.5 },
      footprints: [
        { ...r0603, ref: "R1", value: "R1", x: 10, y: 10, rot: 0, side: "top", pads: { "1": "N1", "2": "GND" } },
        { ...r0603, ref: "R2", value: "R2", x: 30, y: 10, rot: 0, side: "top", pads: { "1": "N1", "2": "GND" } },
        { ...conn, ref: "J1", value: "J1", x: 20, y: 10, rot: 0, side: "top", pads: { "1": "N1", "2": "GND" } },
      ],
      // Every pad of J1, and one pad of R2.
      solidPads: ["J1", "R2.2"],
      copper: {
        zones: [
          { net: "GND", layer: "B.Cu", points: rect(0.5, 0.5, 39.5, 29.5) },
          { net: "N1", layer: "F.Cu", points: rect(0.5, 0.5, 39.5, 29.5), pads: "solid", priority: 1 },
        ],
        keepouts: [{ layers: ["F.Cu"], points: rect(17, 2, 23, 6) }],
        // The resistors' GND pads are SMD on the top: a short track and a via take them to the GND zone below.
        tracks: [
          { net: "GND", layer: "F.Cu", width: 0.4, points: [[10.825, 10], [13, 10]] },
          { net: "GND", layer: "F.Cu", width: 0.4, points: [[30.825, 10], [32, 10], [33, 10]] },
        ],
        vias,
      },
      silk: [{ text: "+12V", x: 20, y: 27, size: 1 }, { text: "-12V", x: 30, y: 27, size: 1, rot: 90, layer: "B.SilkS" }],
      // Clear of every pad on its side: a rule, a ring with a dot in it on the back, a triangle.
      art: [
        { kind: "line", a: [4, 24], b: [12, 24], width: 0.2 },
        { kind: "ring", layer: "B.SilkS", c: [8, 22], r: 2, width: 0.15 },
        { kind: "dot", layer: "B.SilkS", c: [8, 22], r: 0.3 },
        { kind: "poly", points: [[4, 26], [8, 26], [6, 28]] },
      ],
    });
    const VIAS = [{ net: "GND", x: 13, y: 10, diameter: 0.6, drill: 0.3 }, { net: "GND", x: 33, y: 10, diameter: 0.6, drill: 0.3 }];
    const make = async (vias: typeof VIAS) => {
      writeFileSync(jobFile, JSON.stringify(job(vias)));
      await kicadPy(["build", jobFile], { configHome });
      // A black board: the stackup goes into the file as text (KiCad's Python cannot set one) and has to
      // come back out of the next step's load and save.
      writeFileSync(board, withStackup(readFileSync(board, "utf8"), { mask: "black", thicknessMm: 1.6 }));
      await kicadPy(["copper", board, jobFile], { configHome });
      const report = join(work, "copper-drc.json");
      await kicadCli(["pcb", "drc", "--format", "json", "--units", "mm", "--severity-error", "--severity-warning", "--refill-zones", "--exit-code-violations", "-o", report, board],
        { okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS], configHome });
      return JSON.parse(readFileSync(report, "utf8")) as { violations: { type: string }[]; unconnected_items: { type: string }[] };
    };

    test("a complete script leaves no pad unconnected and shorts nothing", async () => {
      const drc = await make(VIAS);
      expect(drc.unconnected_items).toEqual([]);
      expect(drc.violations.map((v) => v.type).filter((t) => ["clearance", "shorting_items", "tracks_crossing", "hole_clearance", "copper_edge_clearance"].includes(t))).toEqual([]);
      // Nothing printed over a pad or over other print.
      expect(drc.violations.map((v) => v.type).filter((t) => t.startsWith("silk"))).toEqual([]);

      const root = parse(readFileSync(board, "utf8"), board);
      const zones = children(root, "zone");
      const nets = zones.map((z) => atomStr(child(z, "net")!, 1)).filter((n) => n).sort();
      expect(nets).toEqual(["GND", "N1"]);
      // Both zones are filled, the N1 zone connects pads solidly and has priority 1; the third zone is the keep-out.
      const n1 = zones.find((z) => atomStr(child(z, "net")!, 1) === "N1")!;
      expect(children(n1, "filled_polygon").length).toBeGreaterThan(0);
      expect(atomNum(child(n1, "priority")!, 1)).toBe(1);
      expect(atomStr(child(n1, "connect_pads"), 1)).toBe("yes");
      expect(zones.filter((z) => child(z, "keepout")).length).toBe(1);
      expect(children(root, "segment")).toHaveLength(3); // 1 + 2 track segments
      expect(children(root, "via")).toHaveLength(2);
      const texts = children(root, "gr_text").map((t) => `${atomStr(t, 1)}@${atomStr(child(t, "layer")!, 1)}`).sort();
      expect(texts).toEqual(["+12V@F.SilkS", "-12V@B.SilkS"]);
      // The drawings: a line, a ring and a filled dot on the back, a filled triangle.
      const layerOf = (n: ReturnType<typeof children>[number]) => atomStr(child(n, "layer")!, 1);
      const silkOnly = (name: string) => children(root, name).filter((n) => layerOf(n)?.endsWith(".SilkS"));
      expect(silkOnly("gr_line").map(layerOf)).toEqual(["F.SilkS"]);
      expect(atomNum(child(child(silkOnly("gr_line")[0]!, "stroke")!, "width")!, 1)).toBe(0.2);
      const circles = silkOnly("gr_circle").map((c) => `${layerOf(c)} fill ${atomStr(child(c, "fill")!, 1)} width ${atomNum(child(child(c, "stroke")!, "width")!, 1)}`).sort();
      expect(circles).toEqual(["B.SilkS fill no width 0.15", "B.SilkS fill yes width 0"]);
      expect(silkOnly("gr_poly").map((p) => `${layerOf(p)} fill ${atomStr(child(p, "fill")!, 1)} points ${children(child(p, "pts")!, "xy").length}`)).toEqual(["F.SilkS fill yes points 3"]);
      // The stackup survived KiCad's load and save, in KiCad's own writing.
      const stackup = child(child(root, "setup")!, "stackup")!;
      const colours = children(stackup, "layer").map((l) => `${atomStr(l, 1)} ${atomStr(child(l, "color"), 1) ?? "-"}`);
      expect(colours).toEqual(["F.SilkS White", "F.Paste -", "F.Mask Black", "F.Cu -", "dielectric 1 -", "B.Cu -", "B.Mask Black", "B.Paste -", "B.SilkS White"]);
      // solidPads: the named pads carry their own "solid" zone connection (2), the others none.
      const zoneConnect = (ref: string, pad: string) => {
        const fp = children(root, "footprint").find((f) => children(f, "property").some((q) => atomStr(q, 1) === "Reference" && atomStr(q, 2) === ref))!;
        return atomNum(child(children(fp, "pad").find((q) => atomStr(q, 1) === pad)!, "zone_connect"), 1);
      };
      expect([zoneConnect("J1", "1"), zoneConnect("R2", "2"), zoneConnect("R2", "1"), zoneConnect("R1", "2")]).toEqual([2, 2, undefined, undefined]);
    }, 180_000);

    test("a missing via shows up as unconnected items: DRC catches a scripted mistake", async () => {
      const drc = await make(VIAS.slice(0, 1));
      expect(drc.unconnected_items.length).toBeGreaterThan(0);
      expect(drc.unconnected_items.every((u) => u.type === "unconnected_items")).toBe(true);
    }, 180_000);

    test("a solid pad that is not on the board is refused", async () => {
      const bad = { ...job(VIAS), solidPads: ["J1", "R2.9"] };
      writeFileSync(jobFile, JSON.stringify(bad));
      await kicadPy(["build", jobFile], { configHome });
      expect(kicadPy(["copper", board, jobFile], { configHome })).rejects.toThrow(/solidPads: not on the board: R2.9/);
    }, 120_000);

    test("an unknown net is refused", async () => {
      const bad = job(VIAS);
      bad.copper.zones[0]!.net = "NOPE";
      writeFileSync(jobFile, JSON.stringify(bad));
      await kicadPy(["build", jobFile], { configHome });
      expect(kicadPy(["copper", board, jobFile], { configHome })).rejects.toThrow(/net NOPE is not on the board/);
    }, 120_000);
  });

  // A 4-layer board (docs/pcb.md "4-layer boards"): inner planes typed "power" go in at build time, every SMD
  // pad on a plane's net gets a locked via beside it, the Specctra export hands the planes and the fixed vias to
  // Freerouting, and the Gerbers carry four copper layers. A, B are signal nets; GND and +5V are planes only.
  describe("4 copper layers: inner planes, plane vias, Specctra, Gerbers", () => {
    const [soic, r0603] = [FOOTPRINTS[0]!, FOOTPRINTS[1]!];
    const tp = { lib: "GHP_TestPoint", name: "TestPoint_2Pads_Pitch2.54mm_Drill0.8mm" };
    const board = join(work, "four.kicad_pcb");
    const jobFile = join(work, "four-job.json");
    const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const job = {
      board, libDir, sheetfile: "four.kicad_sch", nets: ["GND", "+5V", "A", "B"],
      outline: { x0: 0, y0: 0, x1: 50, y1: 30 },
      pour: { clearance: 0.3, minWidth: 0.25, edgeClearance: 0.5 },
      copperLayers: 4,
      planes: [{ net: "GND", layer: "In1.Cu", points: rect(0.5, 0.5, 49.5, 29.5) }, { net: "+5V", layer: "In2.Cu", points: rect(0.5, 0.5, 49.5, 29.5) }],
      planeVia: PLANE_VIA,
      footprints: [
        { ...soic, ref: "U1", value: "U1", x: 25, y: 15, rot: 0, side: "top", pads: { "1": "A", "7": "GND", "8": "B", "14": "+5V" } },
        { ...r0603, ref: "R1", value: "R1", x: 8, y: 8, rot: 0, side: "top", pads: { "1": "A", "2": "GND" } },
        { ...r0603, ref: "R2", value: "R2", x: 42, y: 8, rot: 0, side: "top", pads: { "1": "B", "2": "+5V" } },
        // Through-hole: joins both planes without a via.
        { ...tp, ref: "TP1", value: "TP1", x: 8, y: 24, rot: 0, side: "top", pads: { "1": "GND", "2": "+5V" } },
      ],
      // The signal nets, drawn as a scripted layout would (the Freerouting test below routes them instead).
      copper: {
        zones: [],
        tracks: [
          { net: "A", layer: "F.Cu", width: 0.25, points: [[22.525, 11.19], [7.175, 11.19], [7.175, 8]] },
          { net: "B", layer: "F.Cu", width: 0.25, points: [[27.475, 18.81], [41.175, 18.81], [41.175, 8]] },
        ],
      },
    };
    const vias = (text: string) => children(parse(text, board), "via");
    const drc = async (file: string) => {
      const report = join(work, "four-drc.json");
      await kicadCli(["pcb", "drc", "--format", "json", "--units", "mm", "--severity-error", "--severity-warning", "--refill-zones", "--exit-code-violations", "-o", report, file],
        { okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS], configHome });
      return JSON.parse(readFileSync(report, "utf8")) as { violations: { type: string }[]; unconnected_items: { type: string }[] };
    };
    const COPPER_FAULTS = ["clearance", "shorting_items", "tracks_crossing", "hole_clearance", "copper_edge_clearance", "via_dangling", "track_dangling"];

    test("build and fanout: 4 copper layers, inner planes, one locked via beside each SMD plane pad, the stackup kept", async () => {
      writeFileSync(jobFile, JSON.stringify(job));
      await kicadPy(["build", jobFile], { configHome });
      writeFileSync(board, withStackup(readFileSync(board, "utf8"), { mask: "green", thicknessMm: 1.6, layers: 4 }));
      await kicadPy(["fanout", board, jobFile], { configHome });
      const text = readFileSync(board, "utf8");
      expect(boardCopperLayers(text)).toBe(4);
      expect(text).toContain('(4 "In1.Cu" power)');
      expect(text).toContain('(6 "In2.Cu" power)');
      // U1.7, U1.14, R1.2, R2.2: the SMD pads on GND and +5V. TP1's plated holes need none.
      const v = vias(text);
      expect(v).toHaveLength(4);
      expect(v.every((x) => child(x, "locked") !== undefined)).toBe(true);
      expect(v.map((x) => atomStr(child(x, "net")!, 1)).sort()).toEqual(["+5V", "+5V", "GND", "GND"]);
      expect(JSON.parse(readFileSync(`${board}.fanout.json`, "utf8"))).toEqual({ vias: 4, joined: 0 });
      const stackup = child(child(parse(text, board), "setup")!, "stackup")!;
      expect(children(stackup, "layer").map((l) => atomStr(l, 1)).filter((n) => n?.endsWith(".Cu"))).toEqual(["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"]);
    }, 120_000);

    test("dsn: the inner layers are power planes, the plane vias are fixed", async () => {
      const dsn = join(work, "four.dsn");
      await kicadPy(["dsn", board, dsn], { configHome });
      const text = readFileSync(dsn, "utf8");
      expect(text).toMatch(/\(layer In1\.Cu\s+\(type power\)/);
      expect(text).toMatch(/\(layer In2\.Cu\s+\(type power\)/);
      expect(text).toMatch(/\(layer F\.Cu\s+\(type signal\)/);
      expect(text).toContain("(plane GND (polygon In1.Cu");
      expect(text).toContain("(plane +5V (polygon In2.Cu");
      expect(text.match(/\(via "[^"]+"\s+[-\d]+ [-\d]+ \(net (GND|\+5V)\)\(type fix\)\)/g)).toHaveLength(4);
    }, 120_000);

    test("scripted signal tracks: DRC 0/0 with every plane pad connected through the planes; Gerbers with 4 copper layers", async () => {
      const scripted = join(work, "four-scripted.kicad_pcb");
      writeFileSync(scripted, readFileSync(board, "utf8"));
      await kicadPy(["copper", scripted, jobFile], { configHome });
      const r = await drc(scripted);
      expect(r.unconnected_items).toEqual([]);
      expect(r.violations.map((v) => v.type).filter((t) => COPPER_FAULTS.includes(t))).toEqual([]);
      const zones = children(parse(readFileSync(scripted, "utf8"), scripted), "zone");
      expect(zones.map((z) => `${atomStr(child(z, "net")!, 1)}@${atomStr(child(z, "layer")!, 1)}`).sort()).toEqual(["+5V@In2.Cu", "GND@In1.Cu"]);
      expect(zones.every((z) => children(z, "filled_polygon").length > 0)).toBe(true);

      const out = join(work, "four-gerbers");
      await kicadCli(["pcb", "export", "gerbers", "--layers", gerberLayers(4).join(","), "--subtract-soldermask", "--check-zones", "-o", `${out}/`, scripted], { configHome });
      const files = readdirSync(out);
      for (const layer of ["F_Cu", "In1_Cu", "In2_Cu", "B_Cu"]) expect(files.some((f) => f.includes(layer))).toBe(true);
      const inner = files.find((f) => f.includes("In1_Cu"))!;
      expect(readFileSync(join(out, inner), "utf8")).toContain("%TF.FileFunction,Copper,L2,Inr");
    }, 180_000);

    test("a routing layer inside, keep-outs as rule areas, and plane vias that stay out of them", async () => {
      // In2.Cu given to the router: no plane there. A keep-out over R1's right-hand side, where its GND pad (pad 2,
      // x 8.8) would put its via first (away from the part's centre): the via goes elsewhere.
      const keepout = rect(9.2, 0, 14, 30);
      const routed = {
        ...job, board: join(work, "four-signal.kicad_pcb"),
        planes: [job.planes[0]!],
        signalInner: ["In2.Cu"],
        routeKeepouts: [{ layers: ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"], points: keepout }],
      };
      const file = join(work, "four-signal-job.json");
      writeFileSync(file, JSON.stringify(routed));
      await kicadPy(["build", file], { configHome });
      await kicadPy(["fanout", routed.board, file], { configHome });
      const text = readFileSync(routed.board, "utf8");
      expect(text).toContain('(4 "In1.Cu" power)');
      expect(text).toContain('(6 "In2.Cu" signal)');
      const root = parse(text, routed.board);
      const areas = children(root, "zone").filter((z) => child(z, "keepout") !== undefined);
      expect(areas).toHaveLength(4);
      // GND only now: U1.7 and R1.2.
      const v = vias(text);
      expect(v.map((x) => atomStr(child(x, "net")!, 1))).toEqual(["GND", "GND"]);
      for (const x of v) {
        const at = child(x, "at")!;
        const vx = atomNum(at, 1)!, vy = atomNum(at, 2)!;
        expect(vx + 0.3 <= 9.2 || vx - 0.3 >= 14 || vy < 0).toBe(true);
      }
    }, 120_000);

    test("a pad with no room for its via stops the run", async () => {
      // R3 right against the board edge and R4 1.3 mm below it: no direction is free, the diagonals included (at
      // 1.6 mm a via fits diagonally between the four pads).
      const cramped = {
        ...job, board: join(work, "cramped.kicad_pcb"),
        footprints: [
          { ...r0603, ref: "R3", value: "R3", x: 1.3, y: 1.0, rot: 0, side: "top", pads: { "1": "GND", "2": "A" } },
          { ...r0603, ref: "R4", value: "R4", x: 1.3, y: 2.3, rot: 0, side: "top", pads: { "1": "B", "2": "A" } },
        ],
      };
      const file = join(work, "cramped-job.json");
      writeFileSync(file, JSON.stringify(cramped));
      await kicadPy(["build", file], { configHome });
      expect(kicadPy(["fanout", cramped.board, file], { configHome })).rejects.toThrow(/plane vias: no free spot beside R3\.1 \(GND\)/);
    }, 120_000);
  });
});

// Freerouting on a 4-layer board: it routes the signal nets on the outer layers only and takes the fixed plane
// vias as the plane nets' connections, so nothing is left unrouted.
const hasRouter = hasPython && toolAvailable(existsSync(FREEROUTING.jar) && javaCandidates().length > 0, "Freerouting jar and Java");
describe.skipIf(!hasRouter)("Freerouting on a 4-layer board (KiCad's Python and Freerouting)", () => {
  test("routes on F.Cu and B.Cu only; DRC finds every pad connected", async () => {
    const board = join(work, "four.kicad_pcb");
    const routed = join(work, "four-routed.kicad_pcb");
    writeFileSync(routed, readFileSync(board, "utf8"));
    const dsn = join(work, "four-routed.dsn");
    const ses = join(work, "four-routed.ses");
    await kicadPy(["dsn", routed, dsn], { configHome });
    const r = await freeroute(dsn, ses, join(work, "freerouting"), 20);
    expect(r.unrouted).toBe(0);
    await kicadPy(["ses", routed, ses, join(work, "four-job.json")], { configHome });
    const root = parse(readFileSync(routed, "utf8"), routed);
    const layers = children(root, "segment").map((s) => atomStr(child(s, "layer")!, 1));
    expect(layers.length).toBeGreaterThan(2); // the two plane-via stubs and at least the routed signals
    expect(layers.every((l) => l === "F.Cu" || l === "B.Cu")).toBe(true);
    // The plane vias came back from the session unchanged.
    expect(children(root, "via").filter((v) => child(v, "locked") !== undefined)).toHaveLength(4);
    const report = join(work, "four-routed-drc.json");
    await kicadCli(["pcb", "drc", "--format", "json", "--units", "mm", "--severity-error", "--severity-warning", "--refill-zones", "--exit-code-violations", "-o", report, routed],
      { okCodes: [KiCadExit.OK, KiCadExit.VIOLATIONS], configHome });
    const drc = JSON.parse(readFileSync(report, "utf8")) as { violations: { type: string }[]; unconnected_items: unknown[] };
    expect(drc.unconnected_items).toEqual([]);
    expect(drc.violations.map((v) => v.type).filter((t) => ["clearance", "shorting_items", "tracks_crossing", "hole_clearance"].includes(t))).toEqual([]);
  }, 600_000);
});
