# Workflow: from idea to order-ready files

Every board goes through the same gated flow. A gate that fails stops the flow; nothing is ordered by the
tools — the user places every order manually.

```
spec.md + module.yaml ──► schematic.ts ──► bun run sch ──► PDF review ──► sch:approve
   (what & why)          (Claude writes)   (ERC 0/0,       (user)        (sha256 in
                                            netlist,                      module.yaml)
                                            PDF)                              │
                                                                              ▼
 order (user) ◄── bun run order ◄── bun run fab ◄── DRC 0/0 ◄── bun run pcb (or KiCad, F8)
                 (ORDER.md, the     (Gerbers, drill,
                  upload files)      BOM, CPL, zip)
```

## 1. Specify

- A board lives in `modules/<id>/` (`<id>`: lowercase letters, digits and `-`). Write by hand:
  - `module.yaml`: name, revision and status, current draw per supply rail, PCB options (outline, layers,
    thickness, mask, copper) and JLCPCB options. The schema is `BoardYaml` in `tools/module/schema.ts`;
    `bun run validate -- <id>` checks it with file:line:col messages. `modules/helmet-driver/module.yaml` is
    the example to start from.
  - `spec.md` (behaviour, interfaces, power budget, test plan, sources) and `design-notes.md` (decisions,
    simulation results).
- `power.drawMa` lists what the board draws from each supply that feeds it, in mA, by rail name, e.g.
  `drawMa: { usb-c-5v: 1100 }`; `power.drawBasis` is `estimate` until it is measured (it must be `measured`
  from status `built`).
- `jlcpcb.assembleQty` has JLCPCB assemble fewer boards than PCBs ordered; `pcb.copperOz` sets the outer copper.
- Uncertain values are marked in the spec's verification table with the source to check. Never guess.

## 2. Simulate critical parts

- Write ngspice benches for the risky parts (current sources, filters, protection, gain stages) and assert the
  results with `* @assert` lines: `bun run sim -- modules/<id>/sim/<bench>.cir`.
- Record results and the model sources in `design-notes.md`. Vendor SPICE models (e.g. TI) are downloaded into
  the gitignored `models/` folder by `bun run models:fetch`, never committed.

## 3. Schematic as code

- Claude writes `modules/<id>/schematic.ts` (see `tests/fixtures/pipeline-proof/schematic.ts` and
  [schematic-as-code.md](schematic-as-code.md)). Parts come from `parts/*.yaml`; their symbols and footprints
  are vendored with `bun run lib:import`.
- A large board is drawn on pages: `sheets` lists them, every part (or unit) names its page with `sheet`, and nets
  cross pages by name (global labels, power symbols). The root sheet holds a sheet symbol per page; see
  `tests/fixtures/pages-proof/schematic.ts` and [schematic-as-code.md](schematic-as-code.md) §3a.
- `bun run sch -- <id>` creates `modules/<id>/kicad/` (project file and library tables) on the first run and
  runs the gate chain:
  1. design checks (parts resolve, all units placed incl. power units, every pin connected or
     no-connect, ERC pin-map driver rules, grid, overlaps, geometric connectivity = declared nets),
  2. emit `kicad/<id>.kicad_sch` and, with pages, `kicad/<id>-<page>.kicad_sch` (native KiCad 10, deterministic
     UUIDs),
  3. ERC with errors **and** warnings: must be 0/0, no exclusions,
  4. netlist round-trip: KiCad's nets, values, footprints and symbol UUIDs equal the design,
  5. PDF export (`build/<id>/<id>-schematic.pdf`, git SHA in the title block, one page per sheet),
  6. `build/<id>/review.md`: ERC summary, nets, BOM with sourcing status (with pages: the pages of each).
- The `.kicad_sch` is generated: never edit or save it in KiCad; close eeschema before regenerating.
  `bun run sch:check` fails when a committed schematic differs from its source.

## 4. Review and approve

- The user reviews the PDF and `review.md`. Changes go into `schematic.ts`, then back to step 3.
- Only after the user's explicit OK: `bun run sch:approve -- <id> --yes` records the schematic's
  sha256 in `module.yaml` (`revision.approval`, status `schematic-approved`).

## 5. Layout

- **Automated:** `bun run pcb -- <id>` places and routes the board from the approved schematic
  with the board's spec `modules/<id>/pcb.ts`:
  - connectors and through-hole parts where the spec fixes them;
  - SMD parts by the placer;
  - on a 4-layer board, inner planes and a via from every SMD pad on a plane's net;
  - Freerouting, offline;
  - GND pours (or the spec's own pours);
  - JLCPCB rules;
  - DRC 0/0 with schematic parity.

  See [pcb.md](pcb.md).
- **By hand, or to refine:** open `modules/<id>/kicad/<id>.kicad_pro` in KiCad. For a new board,
  use **Update PCB from Schematic (F8)** with "re-link footprints by reference" unchecked (links
  are by UUID).
- KiCad owns `.kicad_pcb` and the normalised `.kicad_pro`; commit them.
- `bun run render -- <id>` writes 3D renders of the assembled board to `build/<id>/render/`.

## 6. Fab export

- `bun run fab -- <id>` refuses unless module.yaml validates, the schematic is approved and
  unchanged, DRC (with schematic parity, zones refilled) reports 0 errors and 0 warnings with no
  excluded violations and no checks ignored beyond KiCad's defaults, and every placed part has
  verified sourcing (an LCSC number; for consigned THT parts the LCSC number or MPN). It runs every
  check before it writes anything, and a refusal leaves no order files behind.
- Output in `build/<id>/fab/rev-<R>/`: Gerber zip (separate PTH/NPTH drill + map, zones refilled; the inner
  copper of a 4-layer board), BOM, CPL (THT parts at their pad centre) and a README checklist that lists the
  lines to check by hand (consigned parts, disputed rotations). With `jlcpcb.assembly: none`: Gerbers and
  drill only.
- `--draft` relaxes approval and sourcing and writes `build/<id>/fab/DRAFT/` with `DRAFT-` files;
  only a draft accepts `--no-parity` (DRC without schematic parity), and its README says so.
- See `docs/jlcpcb.md` for commands, formats and open questions.

## 7. Order

- `bun run order -- <id>` collects the upload files of one JLCPCB cart into `build/<id>/order/`
  (`pcb-with-assembly/` and `ORDER.md` with the order-form settings, pre-orders, preview checks and, with
  `jlcpcb.tht: self`, the list of parts you buy and solder). It refuses when an output is missing, its sources
  changed since `bun run fab` (inputs.json), or the fab BOM no longer matches the schematic.
- The user uploads the files, checks JLCPCB's Gerber viewer and placement preview, and orders.
- `bun run verify:outputs -- <id>` regenerates fab and order into a temp folder and compares them with
  `build/<id>/`: it proves that a tool change left the outputs alone.
