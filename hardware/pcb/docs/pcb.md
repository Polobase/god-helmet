# Board layout: placement, routing and the order package

`bun run pcb -- <id>` turns an approved schematic into a routed board. `bun run fab -- <id>` then
exports the JLCPCB files, and `bun run order -- <id>` collects everything for one cart. The tools
never upload or order anything.

```
schematic (approved) ──► bun run pcb ──► modules/<id>/kicad/<id>.kicad_pcb  (DRC 0/0, schematic parity)
                                     └─► build/<id>/pcb/  (job, DSN/SES, Freerouting logs, DRC report)
                    ──► bun run fab ──► build/<id>/fab/rev-<R>/  (Gerber zip, BOM, CPL, README)
                    ──► bun run order ► build/<id>/order/        (the three upload files + ORDER.md)
```

## Steps of `bun run pcb`

1. **Inputs.** The netlist from `bun run sch` (`build/<id>/<id>.net.xml`) and the board's spec
   `modules/<id>/pcb.ts`. The spec gives the board outline, the SMD side, parts fixed by hand
   (connectors, through-hole parts, anything that must sit at a given spot), a placement order, "near"
   hints for decoupling capacitors, and the net classes. The board must be at status
   `schematic-approved` or later.
2. **Footprint geometry.** KiCad's API reports pads and courtyards. The courtyards are grown to
   cover silkscreen that reaches past them, such as pin‑1 marks.
3. **Placement** (`tools/pcb/place.ts`).
   - Parts in `fixed` go exactly where the spec puts their footprint anchor, with its rotation and side.
     Every through-hole part needs a place there: the placer only places SMD parts.
   - The SMD parts are placed greedily on the SMD side: first the parts in `order`, then the parts larger than
     `largeFirst` mm² (largest first, while the room is still in one piece), then the most-connected part first.
     Each goes to the free spot with the shortest distance to the pads it connects to that are already placed.
     Nets that have a plane (`planes`) cost nothing: each of their pads gets its own via to the plane.
   - `regions` keep listed parts inside an area (a functional block, an isolated section); a part is listed in
     one area at most.
   - Courtyards keep `spacing` mm apart (default 0.2; more leaves room for tracks and plane vias), and 0.4 mm
     more from fixed parts.
   - A fixed part that hangs over the edge blocks only the board under its courtyard. An axis-aligned courtyard
     counts as the rectangles it is made of: a radio module's T (antenna band and body) leaves the room beside
     the body free.
   - Pads keep 0.35 mm from through-hole pads, and courtyards stay 0.25 mm inside the board edge.
   - Every run checks the placer's pad positions against the ones KiCad reports. On the back side
     KiCad rotates by 180° − rot after the flip.
4. **Board** (`tools/pcb/kicad_pcb.py`, run with KiCad's bundled Python). It adds the footprints,
   the nets and the outline, and links each footprint to its schematic symbol by UUID and sheet file,
   so schematic parity holds. A part on a page of a schematic with pages gets the path
   `/<sheetUuid>/<symbolUuid>`, its page's sheet name and file, as Update PCB from Schematic sets them. All symbol fields are copied, and references go on the Fab layer
   rather than the silkscreen, since the CPL does the placement.
5. **Routing.**
   - KiCad exports Specctra DSN, Freerouting routes, and KiCad imports the SES session. It then adds
     GND pours on both layers: thermal reliefs on through-hole pads, solid on SMD pads, islands
     removed.
   - Freerouting's results differ between runs. A run that fails DRC (which counts open connections after the
     zones are filled) is repeated from the placed board, up to `attempts` times (default 4). Freerouting's own
     count of open connections is logged but does not decide: it does not see the planes' fill.
   - One run may take `routeMinutes` (default 15).
6. **Rules and DRC.**
   - The JLCPCB 2-layer rules (`PCB_RULES`, from docs/jlcpcb.md §9 with margin) and the net
     classes are merged into `<id>.kicad_pro`:

     | Net class | Track | Clearance | Via |
     |---|---|---|---|
     | Default | 0.2 mm | 0.2 mm | 0.6/0.3 mm |
     | Power (the rails, their raw and protected halves, GND) | 0.4 mm | 0.2 mm | 0.6/0.3 mm |

   - `drcRules` (KiCad `.kicad_dru` text) is written beside the board as `<id>.kicad_dru`; DRC checks it, for
     example 3 mm between the net classes of an isolated section and everything else.
   - The gate is then the fab tool's DRC, with schematic parity: 0 errors, 0 warnings, no
     exclusions.
   - **Net names.** The XML netlist writes a "/" in a pin name plainly ("unconnected-(U39-SDO/~{ALARM}-Pad15)"),
     the schematic as `{slash}`. The board takes the schematic's form (`boardNetName`), or parity reports a net
     conflict.

The routed board belongs to KiCad from then on. You may refine it in the GUI; the fab tool re-checks
DRC and parity. Running `bun run pcb` again replaces it.

## Scripted layout (`route: "scripted"`)

A board that is all buses, such as a power-distribution board, is not autorouted. Its `pcb.ts` sets
`route: "scripted"` and draws the copper itself. Steps 1, 2, 4 and 6 stay; placement and routing change:

- **Placement.** Every part has a position in `fixed`. A part without one stops the run; nothing is left
  to the placer.
- **Copper** (`copper`), in the spec's coordinates like `fixed`:
  - `zones`: one net, one layer, a rectangle or polygon. `priority` decides which zone fills first where
    two overlap. `pads` is `tht-thermal` (the default: thermal reliefs on through-hole pads, solid on SMD
    pads), `solid` or `thermal`.
  - `tracks` and `vias`, each on a named net.
  - `keepouts`: areas no zone fills, for example around an unplated mounting hole.
- **`solidPads`**: parts whose pads join their zones without thermal reliefs (terminals and inductors that
  carry a whole rail). An entry `REF.PAD` names one pad: for a pad that tracks beside it would leave with a
  single thermal spoke, which DRC reports as a starved thermal. The autorouted flow takes `solidPads` too and
  applies them before its pours are filled (thermal vias in an exposed pad, a through-hole pin whose reliefs the
  routing starved).
- **`silk`**: silkscreen text, for rail names and pin names.
- **`art`**: silkscreen drawings on either side: lines, rings, dots and filled polygons. `tools/pcb/art.ts`
  has the moves a drawing needs: a shift, a quarter turn, and the mirror for the back.
- Print below JLCPCB's minimums stops the run: text under 1 mm, lines and dots under 0.15 mm
  (docs/jlcpcb.md §9).
- **`rules`**: overrides of `PCB_RULES` for this board, for example wider clearances so it suits 2 oz copper.
- **Net names.** A labelled net is named `/NAME` in KiCad (`/+12V_IN`); power nets keep their plain name
  (`+12V`). A net or part that is not in the netlist stops the run.
- **Sheet.** The board file gets the smallest drawing sheet that holds the outline (A4 to A0).

KiCad's Python adds the zones, tracks, vias, text and drawings and fills the zones (`kicad_pcb.py copper`). The
result is the same on every run. DRC with schematic parity is the check that the script connected
everything: a pad it did not reach is an unconnected item, and the run reports their count.
`tests/kicad/pcb-python.test.ts` proves both directions on a small board: a complete script passes, and a
missing via is reported.

## Mask colour

`pcb.mask` in module.yaml is `green` (the default) or `black`; the print is white on both. A black board
gets a physical stackup in its board file that names the colours, so KiCad's 3D view, the renders and the
Gerber job file show the board as ordered. KiCad's Python cannot set a stackup: `withStackup`
(`tools/pcb/flow.ts`) writes it into the file as text after the board is built, and the Python steps that
follow load and save it unchanged (tested in `tests/kicad/pcb-python.test.ts`). A green board gets none
and stays as KiCad writes a new board. ORDER.md names the colour in the order settings.

## 4-layer boards

`pcb.layers: 4` in module.yaml makes a board with copper on F.Cu, In1.Cu, In2.Cu and
B.Cu. The 2-layer path is unchanged: its job files, boards and order files are as before
(`bun run verify:outputs`).

- **Stackup.** JLCPCB's JLC04161H-7628, the only 4-layer stackup this toolchain describes (`JLCPCB.stackup4` in
  `tools/module/schema.ts`, from https://jlcpcb.com/impedance, read 2026-11-12). It has 1 oz outer copper, 7628
  prepreg 0.2104 mm, 0.5 oz inner copper (0.0152 mm) and a 1.065 mm core. validate therefore refuses a 4-layer
  board that is not 1.6 mm, or that asks for 2 oz copper. Every 4-layer board gets this stackup in its board
  file, green or black (`withStackup`), so the Gerber job file and the 3D view show four layers. A load and
  save by pcbnew leaves it byte-identical (checked 2026-11-12).
- **Inner layers are planes,** unless `signalInner` names one. `kicad_pcb.py build` types In1.Cu and In2.Cu as "power". KiCad's Specctra
  export then writes them as `(type power)` with each zone as a `(plane NET (polygon …))`, and Freerouting
  routes on F.Cu and B.Cu only. `ses` refuses a session that puts a track on an inner layer.
- **Rules.** `PCB_RULES_4` is the 2-layer set except `min_hole_clearance` 0.35 mm, for JLCPCB's inner-layer
  limits (docs/jlcpcb.md §9).

What `modules/<id>/pcb.ts` declares for the autorouted flow:

| Field | What it does |
|---|---|
| `planes` | Zones on In1.Cu or In2.Cu: `{ net, layer, shape?, priority?, pads?, clearance?, minWidth? }`. Without a shape a plane covers the board, `pour.edgeClearance` inside the edge. One layer can carry several planes on separate polygons, for example GND under the main circuit and an isolated ground under an isolated section. They go in at `build`, before routing, and are filled after it. Outer layers are refused here: a plane there would be copper the router routes through |
| `pours` | Zones added after routing, on any copper layer the board has. They replace the default GND pours on F.Cu and B.Cu over the whole board. Use them on a board with more than one ground, so no GND pour fills an isolation gap |
| `planeVia` | The via and track that join each SMD pad on a plane's net to its plane. Default `PLANE_VIA`: 0.6 mm via, 0.3 mm drill, 0.3 mm track, 0.2 mm clearance |
| `signalInner` | Inner layers Freerouting routes on (typed "signal" instead of "power"), e.g. `["In2.Cu"]` for a signal, GND, signal, signal stack: no plane there, but a `pours` entry may fill it after routing |
| `routeKeepouts` | Areas no track, via or zone enters, on the given layers: an isolation gap, an antenna's clearance. They are rule areas on the board, and the Specctra export hands them to Freerouting as keep-outs. Pads and footprints stay allowed, so a part may straddle one |

**Plane vias.** Freerouting 2.4.1 does not reach a plane from an SMD pad by itself. In a test on
2026-11-12 it left those connections unrouted ("conductionarea -> R2-2"), also with its fanout stage on. So
`kicad_pcb.py fanout` runs after `build`:
- It places one via beside every SMD pad whose net has a plane. It tries the four directions away from the
  pad, the one that points away from the part's centre first, from just clear of the pad out to 1.8 mm further.
- The via keeps `clearance` from every other pad on either side (it is a through via), from other plane vias
  and from the board edge. The short track to it clears every other pad and via.
- Vias and tracks are locked. The DSN carries them as `(type fix)`, Freerouting routes around them, and they
  come back unchanged through the SES import.
- Through-hole pads need none: their plated holes join the inner zones directly.
- Only pads with copper count; a footprint's paste-only apertures are no obstacle.
- An exposed pad with thermal vias (plated holes numbered as the pad) reaches the plane through them and gets no
  via. A pin beside it on the same net joins it with a short track straight in along the pin, instead of a via.
- No via or track of the fan-out enters a `routeKeepouts` area.
- Where no spot is free, the pad shares a via its net already has within 1.5 mm (a neighbour on the same net).
- A pad with no free spot and no via to share stops the run and names the pad, e.g.
  `plane vias: no free spot beside R3.1 (GND)`. Give that part more room or a smaller `planeVia`; on fine-pitch
  supply pins between two ground pins (0.5 mm pitch), route that supply instead of giving it a plane.

A scripted layout (`route: "scripted"`) does not use `planes`, `pours` or `planeVia`. Its `copper.zones`,
`tracks` and `keepouts` accept In1.Cu and In2.Cu directly on a 4-layer board; on a 2-layer board those layers
are refused.

**Fab.** `bun run fab` exports In1.Cu and In2.Cu as Gerbers (`*-In1_Cu.g1`, `*-In2_Cu.g2`) and the README
lists the four copper layers. It refuses when module.yaml's `pcb.layers` and the board file's copper layers
differ. ORDER.md's settings line reads "4 layers, stackup JLC04161H-7628 (…)".

**Tests.**
- `tests/kicad/pcb-python.test.ts` builds a 4-layer board with a GND and a +5V plane, then checks:
  - the fan-out (four locked vias, none for the through-hole part) and the DSN;
  - a scripted version with DRC 0/0, where the plane pads reach each other only through the planes;
  - the four copper Gerbers;
  - a cramped pad that is refused;
  - a Freerouting run that routes everything on F.Cu and B.Cu, DRC with no unconnected items.
- `tests/kicad/fab.test.ts` exports a 4-layer board and refuses a layer mismatch.

**Limits.**
- Vias are through vias only: there are no blind or buried ones.
- Freerouting sees the plane outlines, not their fill, and knows nothing about the thermal reliefs KiCad
  draws later. DRC after the fill is the check.
- The fan-out looks at pads, vias and the board edge. It does not look at keep-out areas inside footprints, so
  DRC also catches a via placed in one.

## Two board writers

| Writer | Boards | Why this one |
|---|---|---|
| `tools/pcb/kicad_pcb.py` (KiCad's Python, SWIG `pcbnew`) | real boards (`bun run pcb`) | kicad-cli can't build a board or export and import Specctra; this needs KiCad's own API. Its smoke test is `tests/kicad/pcb-python.test.ts`, which is also the canary for KiCad 11 dropping the SWIG bindings |
| `tools/kicad/emit-pcb.ts` | test fixtures of the fab tool | minimal, top side only, byte-exact in TypeScript |

## 3D renders

`bun run render -- <id>` renders the assembled board from the top, the bottom and at an angle
(`build/<id>/render/<id>-{top,bottom,iso}.png`, kicad-cli `pcb render`, high quality):
- A footprint whose KiCad 3D model does not exist can get a stand-in: an entry in `STAND_INS` in
  `tools/pcb/render3d.ts`, built from boxes and cylinders (the footprint body outline and the datasheet
  heights). Stand-ins are for looks and height checks, not mechanical data. The table is empty so far;
  docs/environment.md lists the vendored footprints whose model the KiCad bundle lacks.
- Parts on spacers are lifted by `jlcpcb.standoffs` in `modules/<id>/module.yaml`, with the spacer drawn.
- Hand-soldered parts are included: this is how the finished board looks, unlike JLCPCB's placement preview,
  which only shows the parts in its BOM.
- It renders a copy in `build/<id>/render/`; the board in `modules/<id>/kicad/` is not changed.
- A board with a stackup is rendered in its mask colour (kicad-cli `--use-board-stackup-colors`).

## Freerouting

- **Version:** 2.4.1, fetched on first use into the gitignored `.tools/freerouting/`. The sha256
  is pinned in `tools/pcb/tools.ts`.
- **Needs:** Java 25 or newer. The 2.4.1 jar's classes are version 69, and its manifest says `Created-By:
  25.0.4.1` (checked 2026-09-28). OpenJDK 27 from Homebrew is installed, keg-only at
  `/opt/homebrew/opt/openjdk/bin/java`. `findJava()` looks in `$JAVA_HOME`, then Homebrew's keg, then PATH. It
  skips macOS's `/usr/bin/java` stub, which fails without a JDK, and any Java older than 25. `bun run doctor`
  shows which one it uses.
- **Headless and offline:** it runs without a GUI. Telemetry and analytics are switched off in a
  settings file in `build/<id>/pcb/freerouting/` and again on the command line. Java's HTTP(S)
  goes to an unreachable proxy, so it cannot reach the network. Its settings and log stay in the
  build folder, so your own Freerouting settings are untouched.
- **History:** the first two runs, on a throwaway two-part test board on 2026-09-24, used
  Freerouting's defaults (anonymous usage statistics on). No transmission shows in their logs. Every
  run since has the switches above.

## PCB Assembly split

- `jlcpcb.smtSide` in module.yaml is the side of the SMD parts.
- `jlcpcb.tht` says who solders the through-hole parts.
- `jlcpcb.handSolder` lists the refs you solder yourself (for example a part JLCPCB cannot source).
  They are left out of the BOM and the CPL.
- validate warns when Economic PCBA has SMD on the bottom and JLCPCB-soldered THT on top. Whether
  that stays single-sided is settled by your quote (docs/jlcpcb.md §7, §14).
