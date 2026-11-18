# hardware/pcb: the helmet driver board as code

This folder holds the god-helmet's controller board, **helmet-driver** (`modules/helmet-driver/`: an ESP32-S3,
eight current-output coil drivers and two isolated tES outputs, fed from USB-C), and the toolchain that turns it
into order files for JLCPCB:

```
spec.md + module.yaml ─► schematic.ts ─► bun run sch ─► PDF review ─► sch:approve ─► bun run pcb ─► bun run fab ─► bun run order
                         (KiCad 10, ERC 0/0,           (you)         (sha256 in     (placed,        (Gerbers, BOM,   (ORDER.md and
                          netlist round-trip)                          module.yaml)   routed, DRC)    CPL, README)     upload files)
            ngspice benches (bun run sim) check the critical circuits along the way
```

The schematic is written as TypeScript (`modules/<id>/schematic.ts`) and generated into a native KiCad 10
schematic, one sheet or a root sheet with pages (`sheets`, [docs/schematic-as-code.md](docs/schematic-as-code.md)
§3a); parts come from `parts/*.yaml`, with their KiCad symbols and footprints vendored in `lib/kicad/`. The
toolchain builds standalone PCBs of this kind: one board per `modules/<id>/`, 2 or 4 copper layers, assembled by
JLCPCB.

## Prerequisites

- **Bun ≥ 1.4.2** (`bun install` once, for zod, yaml and fflate)
- **KiCad 10.0.x** (tested with 10.0.6): `kicad-cli` and KiCad's bundled Python with `pcbnew`
- **ngspice** (47 or newer) for `bun run sim`
- **Java ≥ 25** for the Freerouting autorouter (Homebrew's keg-only OpenJDK is found without PATH). Freerouting
  2.4.1 itself is fetched into `.tools/` on first use, sha256-pinned.
- TI SPICE models: `bun run models:fetch` downloads them into the gitignored `models/` (TI's terms: never committed).

`bun run doctor` checks all of these and prints install hints; it never installs anything. Details and known
KiCad issues: [docs/environment.md](docs/environment.md).

## Commands

Run from `hardware/pcb/`. `<id>` is a folder name in `modules/` (`helmet-driver`).

| Command | What it does |
|---|---|
| `bun run doctor` | report tools, versions and paths |
| `bun run validate [-- <id>]` | check `module.yaml` and every `parts/*.yaml` (and their symbols and footprints in `lib/kicad`) |
| `bun run lib:import` | vendor the KiCad stock symbols and footprints that `parts/*.yaml` uses into `lib/kicad/` (reads the local KiCad install) |
| `bun run sim -- modules/<id>/sim/<bench>.cir` | run an ngspice bench and check its `* @assert` lines |
| `bun run models:fetch` | download the vendor SPICE models |
| `bun run sch -- <id>` | generate the schematic, ERC 0/0, netlist round-trip, PDF (one page per sheet) and `build/<id>/review.md` |
| `bun run sch:check` | regenerate every schematic in memory and fail on any difference to the committed files (every page file of a schematic with pages, and no leftover page file) |
| `bun run sch:approve -- <id> --yes` | record your approval of the reviewed PDF in `module.yaml` (only after your OK) |
| `bun run pcb -- <id>` | place and route the board from its approved schematic and `modules/<id>/pcb.ts`, DRC with parity |
| `bun run render -- <id>` | 3D renders of the assembled board |
| `bun run fab -- <id> [--draft]` | JLCPCB files in `build/<id>/fab/`: Gerbers, drill, BOM, CPL, README checklist |
| `bun run order -- <id>` | collect one cart's upload files and `ORDER.md` in `build/<id>/order/` |
| `bun run verify:outputs -- <id>` | regenerate fab and order in a temp folder and compare them with `build/<id>/` |
| `bun run typecheck` | TypeScript, no emit |
| `bun run test` / `test:unit` / `test:full` | all tests (KiCad and ngspice suites skip when the tool is missing) / unit tests only / missing tools fail |
| `bun run check:fast` | typecheck, unit tests, validate and sch:check |
| `bun run check` | the same with the KiCad and ngspice tests |

Generated output goes to `build/` (gitignored). KiCad owns `modules/<id>/kicad/<id>.kicad_pcb` once it exists; the
`.kicad_sch` files (the root and, for a schematic with pages, `<id>-<page>.kicad_sch`) are generated and never saved
from KiCad.

## The gated workflow

1. **Specify:** `spec.md` (requirements, sources), `module.yaml` (board options, current draw per supply rail,
   JLCPCB options), `design-notes.md`; ngspice benches in `sim/` for the risky circuits.
2. **Schematic:** `schematic.ts` → `bun run sch`. Every gate must pass: ERC with 0 errors and 0 warnings and no
   exclusions, and KiCad's netlist equal to the design.
3. **Review:** you read the schematic PDF (`build/<id>/<id>-schematic.pdf`) and `review.md`. Changes go back into
   `schematic.ts`.
4. **Approve:** only after your explicit OK, `bun run sch:approve -- <id> --yes` stores the schematic's sha256.
   Layout and fab refuse an unapproved or changed schematic.
5. **Layout:** `bun run pcb`, or by hand in KiCad; DRC with schematic parity must report 0/0.
6. **Fab and order files:** `bun run fab`, then `bun run order`. fab refuses unverified part sourcing, DRC
   findings and stale inputs.
7. **Order:** you upload the files on jlcpcb.com, check JLCPCB's Gerber viewer and placement preview, and order.
   **The tools never upload anything and never place an order.**

Step by step: [docs/workflow.md](docs/workflow.md). Layout: [docs/pcb.md](docs/pcb.md). JLCPCB's file formats,
rules and open questions: [docs/jlcpcb.md](docs/jlcpcb.md). Why schematics are code:
[docs/schematic-as-code.md](docs/schematic-as-code.md).

## Folder layout

| Path | Contents |
|---|---|
| `modules/helmet-driver/` | the board: `module.yaml`, `spec.md`, `design-notes.md`, `schematic.ts`, `sim/`, later `kicad/` and `pcb.ts` |
| `parts/` | one YAML file per part family: KiCad symbol and footprint, assembly method, sourcing per value (MPN, LCSC number, verified source and date) |
| `lib/kicad/` | vendored KiCad 10.0.6 stock symbols and footprints (`GHP_*` libraries), `SOURCES.json` provenance, `LICENSE.md` |
| `tools/` | the toolchain (TypeScript on Bun; `tools/pcb/kicad_pcb.py` runs in KiCad's Python) |
| `tests/` | integration tests and fixtures, including the generic pipeline-proof schematic and the pages-proof schematic (three pages) |
| `docs/` | reference and decision records |

## Licences and notices

- `lib/kicad/` holds copies of the KiCad libraries, licensed CC-BY-SA-4.0 with the KiCad library exception
  (`lib/kicad/LICENSE.md`).
- `tools/fab/transformations.csv` is the Fabrication Toolkit's rotation table, Apache-2.0
  (`tools/fab/LICENSE-Apache-2.0.txt`, `tools/fab/NOTICE.md`).

## Origin

The toolchain comes from the author's own earlier hardware project, a separate private repository, and was trimmed
to standalone boards for god-helmet on 2026-11-13.
