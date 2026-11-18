# Decision record: schematics as code

| | |
|---|---|
| Status | **accepted.** The proof project passes every gate on KiCad 10.0.6 (2026-09-24, §5a). Still open (§4): the user's GUI open and PDF readability review (criterion 5) and the F8 handoff to a board (criterion 6). |
| Date | 2026-09-23 |
| Basis | Research pass of 2026-09-23: research tracks on tscircuit, direct `.kicad_sch` generation, other schematic-as-code tools and kicad-cli; two independent judges (correctness lens, workflow lens); a synthesis. Issue and PR states below were re-checked on 2026-09-23 through the GitLab and GitHub APIs. |

Status words used below: **verified** = read in KiCad source, official docs or the tool's own repository;
**likely** = secondary source or inference; **unverified** = not confirmed.

## 1. Context

Claude writes the schematics; the user reviews them as PDFs; layout happens in KiCad (by hand, or scripted with
`bun run pcb`, [pcb.md](pcb.md)); boards are made by JLCPCB ([jlcpcb.md](jlcpcb.md)). The schematic pipeline has to meet these requirements:

1. **ERC clean:** `kicad-cli sch erc` reports 0 errors and 0 warnings, with no exclusions.
2. **PDF review:** every schematic is exported as a PDF the user can read and comment on.
3. **KiCad 10 native:** files are in KiCad 10's own format, so opening them shows no "older version, will be
   converted" notice and a GUI save does not rewrite them.
4. **TypeScript on Bun:** no Python, no new languages, no system installs without the user's OK. (Later
   exception for layout, not for schematics: `tools/pcb/kicad_pcb.py` runs in KiCad's bundled Python, because
   kicad-cli can neither build a board nor export Specctra; see pcb.md. KiCad 11 removes those SWIG bindings.)
5. **Stable UUIDs:** regenerating a schematic keeps every symbol's UUID, so Update PCB from Schematic (F8) keeps the
   footprints linked.
6. **Part data flows to fab:** Footprint, LCSC and MPN fields reach the PCB footprints and the JLCPCB BOM.
7. **Analog parts:** power symbols (±12 V, ±15 V, +5 V, +3V3) with PWR_FLAG, multi-unit op-amps including the power
   unit (TL072, TL074), connectors with unused or switched contacts.

Facts that constrain the choice (all verified):

- KiCad 9 and 10 have no headless schematic API. "The IPC API in KiCad 9 and 10 only supports communication with a
  running instance of the KiCad GUI", and only in the PCB editor; headless mode through `kicad-cli` and schematic
  support come with KiCad 11 (https://dev-docs.kicad.org/en/apis-and-binding/ipc-api/for-addon-developers/). At tag
  10.0.6, `api/proto/schematic/schematic_commands.proto` defines no commands.
- KiCad 10.0.0 to 10.0.6 all write schematic version **20260306** and symbol-library version 20251024
  (https://gitlab.com/kicad/code/kicad/-/raw/10.0.6/eeschema/sch_file_versions.h). A newer version is refused with
  `FUTURE_FORMAT_ERROR`; an older version loads, but the GUI converts it on save
  (https://gitlab.com/kicad/code/kicad/-/blob/10.0/eeschema/files-io.cpp). Boards saved by KiCad 10 are 20260206.
- Footprints link to symbols by UUID; "Update footprint fields from symbols" copies fields such as LCSC to the
  footprints (https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html). KiCad 10 has no CLI command for Update PCB.

## 2. Options evaluated

Judge scores are out of 10. The correctness judge tried to refute each option against KiCad 10.0.6 source; the
workflow judge scored fit with the repo's day-to-day loop.

| Option | Language, licence | Correctness | Workflow | Showstoppers |
|---|---|---|---|---|
| **In-repo TypeScript emitter** (netlist-first DSL, native 20260306, UUIDv5, vendored flattened libraries) | TypeScript, ours | **7.5** | **8.5** | None found in the 10.0.6 source. Unproven end-to-end when judged (KiCad was not installed yet); see §5a. |
| Same emitter on the `kicadts` 0.0.58 token model | TypeScript, MIT (npm package has no licence field) | 6.5 | 7.5 | None. Pre-1.0, 9 stars, puts an upstream dependency on the critical path. |
| Diode `pcb` / Zener 0.4.58 | Rust CLI + Starlark, MIT | 4.5 | 4.5 | Installed with `curl \| bash` (system software) and adds Starlark. Schematic reconciliation is about 4 weeks old; zero-ERC on KiCad 10 unproven. |
| SKiDL 2.3.0 | Python, MIT | 4 | 3.5 | Needs Python. Writes format 20230409. Its power-net regex misses `-12V`. Regeneration loses manual layout (#316). macOS `fp-lib-table` fix (#326) unreleased. |
| copperhead 0.11.0 | TypeScript, Apache-2.0 | 4 | 5 | An LLM agent CLI, not an embeddable library. Emits KiCad 8 format 20231120. Intent format has no custom fields (no LCSC/MPN). Runtime depends on LLM SDKs. |
| tscircuit → `circuit-json-to-kicad` 0.0.219 | TypeScript, MIT | 2 | 2.5 | Every pin exported as `passive`. Net names with `+`/`-` or a leading digit are rejected. Random symbol UUIDs on every export. Empty Footprint field, no LCSC field. No multi-unit symbols, no PWR_FLAG. Open bugs #549, #579, #585, #595; fixes #552, #565, #598 unmerged. |
| circuit-synth 0.12.1 + kicad-sch-api 0.5.6 | Python, MIT | 2 | 2 | Needs Python. KiCad 10 support only in unmerged PRs; stalled since 2025-12 / 2026-03. Transform maths contradicts the KiCad source. |
| schemaseed 1.6.1 / kicad-yaml | Python, MIT | 1.5 | 2 | Needs Python. schemaseed's source repository returns 404. Places parts in a single row. |
| @tobisk/pcbs 2.2.0 | TypeScript, MIT | 1.5 | 2 | No stated KiCad version, no ERC evidence, 0 stars. |
| kisch 1.0.5 | JavaScript, no licence on GitHub | 1 | 1.5 | Symbols are placed by hand, so Claude cannot author the schematic. |
| atopile 0.15.9 | ato + Python 3.14, MIT | 0.5* | 1 | No `.kicad_sch` output (PR #537 closed unmerged, #1472 closed stale). |
| Circuitscript 0.10.5 | TypeScript, MIT | 0.5* | 1 | Outputs SVG/PDF and a KiCad netlist, no `.kicad_sch`. |
| PolymorphicBlocks | Python, BSD-3 | 0.5* | 1 | Netlist only. |
| KiCad 10 IPC API / kicad-python 0.8.0 | protobuf over NNG | 0.5 | 1 | No schematic commands and no headless server before KiCad 11. |
| JITX 4.4.1 | Python, proprietary | 0.5 | 0.5 | Per-seat subscription and closed runtime; current docs never mention KiCad export. |

\* The correctness judge scored atopile, Circuitscript and PolymorphicBlocks as one group.

Reference only, not judged: kiutils (GPL-3.0, KiCad 6/7 era, inactive since 2024), kicad-skip (LGPL-2.1, edits
existing files), kicad-sch-ts (KiCad 7/8, no licence). kicad-sch-api's rotation and mirror conventions contradict
the KiCad 10 source and must not be copied.

The research tracks also scored six criteria (ERC clean on KiCad 10 / PDF readability / fit for the analog parts of
§1 item 7 / TypeScript fit / layout handoff / maturity):

| Option | Scores |
|---|---|
| In-repo emitter | 8 / 6 / 9 / 10 / 9 / 4 |
| Emitter on kicadts | 8 / 6 / 9 / 9 / 9 / 4 |
| copperhead | 7 / 7 / 6 / 6 / 7 / 3 |
| SKiDL | 6 / 5 / 6 / 2 / 7 / 6 |
| Diode pcb | 6 / 6 / 6 / 5 / 7 / 4 |
| tscircuit | 3 / 4 / 2 / 7 / 2 / 3 (tscircuit track); 3 / 5 / 5 / 10 / 5 / 4 (direct-generation track) |

## 3. Decision

Schematics are generated by an **in-repo TypeScript emitter** that writes native KiCad 10 files.

- **Output:** `.kicad_sch` with `(version 20260306)`, defined once as a constant, and `(generator "god-helmet-pcb")`.
  KiCad's dev docs ask third-party tools not to call themselves `eeschema`; KiCad 10.0.6 ignores the generator token
  and gates only on `(version)`. Nothing is ever copied from KiCad master (20260830).
- **Input:** a netlist-first DSL in `modules/<id>/schematic.ts`, validated with zod. Parts are keyed by permanent part
  IDs; nets list pins as `<partId>.<pin>`; placement hints are in grid units, 1 unit = 1.27 mm, KiCad's default
  50 mil connection grid (`tools/kicad/emit-pro.ts` writes `connection_grid_size: 50`).
- **Libraries:** stock KiCad **10.0.6** symbols and footprints, vendored into `lib/kicad` under `GHP_<StockLib>`
  nicknames with KiCad's CC-BY-SA-4.0 licence file.
  - `extends` is flattened following KiCad's `LIB_SYMBOL::Flatten`, and unit sub-symbols are renamed (TL072 extends
    LM2904, so `LM2904_1_1` becomes `TL072_1_1`). `_0_0` sub-symbols are kept: the `-12V` and `PWR_FLAG` pins live
    there.
  - Each board gets project `sym-lib-table` and `fp-lib-table` files with `${KIPRJMOD}` URIs
    (`tools/kicad/libtables.ts`).
  - The embedded `lib_symbols` are written from the same vendored files. Footprint, LCSC and MPN go on the placed
    symbol instance, taken from `parts/*.yaml` (`tools/module/parts.ts`), never onto the embedded library copy:
    `lib_symbol_mismatch` compares the text of every field.
- **UUIDs:** deterministic RFC 4122 version 5 (`tools/kicad/uuid.ts`, one namespace, uuidv5 of the toolchain's
  name). Names: `<project>/root` for the file and root sheet, `<project>/part/<partId>/unit/<n>` for each placed unit, pins scoped per
  unit, wires, labels and junctions from net name plus geometry. UUIDs are keyed on part IDs, not reference
  designators, so renumbering never orphans a footprint. No value comes from the clock.
- **S-expressions:** our own parser and printer (`tools/sexpr/sexpr.ts`). kicadts may be added later only as an
  exactly pinned, read-only second parser.
- **kicad-cli:** always through `tools/kicad/cli.ts`: only 10.0.x is accepted, `KICAD_CONFIG_HOME` points at the
  gitignored `.kicad-config/`, and every call passes `-o`.
- **Ownership:** the generated `.kicad_sch` is committed and **never saved from the KiCad GUI**
  (`.gitattributes` marks it generated). KiCad owns `.kicad_pcb` and, after the first open, the normalised
  `.kicad_pro`. `bun run sch:check` regenerates in memory and fails on any byte difference.
- **Sheet sizes:** A4 to A0 (`sheet.paper`; a page's own `paper`, §3a). A2 and larger are for one sheet with very
  many parts; a board that size is easier to read as pages.
- **Scope:** one root sheet per board, or the root sheet with one level of pages under it (§3a, added 2026-11-13); a
  label-stub layout (short stub plus label between blocks, a power symbol at every rail pin, one PWR_FLAG per rail);
  no buses, no sheet pins or hierarchical labels, no nested or repeated sheets.

## 3a. Pages (hierarchical schematics)

A board with many parts is drawn on pages: `sheets` in the DSL. The root file then holds only a sheet symbol per page,
and each page is a file of its own: a KiCad hierarchy one level deep. It is never a set of flat top-level sheets:
kicad-cli 10.0.6 drops those from exports (#25484, #25198, §5).

**Interface** (`tools/sch/dsl.ts`):

```ts
sheets: [{ id: "power", title: "Power supply", paper: "A3" }, …]   // in page order; paper defaults to A3
parts.u1 = { ref: "U1", part: "…", at: [40, 30], sheet: "power" }    // every part names its page
parts.u2 = { ref: "U2", part: "opa4197-soic14", sheet: "coil-1",     // a unit's own `sheet` overrides the part's:
             units: { 1: { at: [..] }, …, 5: { at: [..], sheet: "power" } } }   // a quad's power unit on another page
text: [{ at: [20, 20], text: "…", sheet: "power" }, { at: [20, 70], text: "overview" }]   // no sheet: on the root
```

- `id` is a slug (`a-z0-9-`, up to 32 characters): it names the page file and seeds UUIDs, so never rename it casually.
  `title` is the KiCad sheet name: unique, without `/` (KiCad's sheet path separator; KiCad 10.0.6's field
  validator refuses it in sheet names, `common/validators.cpp`), line breaks or tabs.
- With `sheets`, every part, or each unit of a multi-unit part, must resolve to a page that exists (zod error
  otherwise); without `sheets`, nothing may name a page. A design without `sheets` generates exactly what it did
  before pages existed, byte for byte (`bun run sch:check` on helmet-driver's 475 symbols, 2026-11-13).
- Coordinates (`at`, units, the grid points of wires, text) are per page. `nets[*].wires` join pins of one page only;
  the builder refuses a wire across pages. A path of grid points alone (the middle of a wire split into parts) lies on
  the net's only page, or on the page of the wires it touches; when it touches wires on several pages (pages drawn
  alike), on the page of the touching path nearest to it in the list, the one it continues. A tie is refused, and a
  wrong page could not pass unnoticed: it leaves a dangling wire end.
- The reference stays per part: a quad's units on two pages are U2A on one and U2E on another, as KiCad allows.

**Labels.** Nets connect by name, as on one sheet:

| Net | On its pages |
|---|---|
| power net (`power: true`) | a power symbol at every pin, on every page; one PWR_FLAG for the whole net (on the page of `flagAt`). Where symbols on neighbouring up or down pins would print their names over each other (IC supply pins 2.54 or 5.08 mm apart), the later stub grows by 5.08 mm, up to three times |
| pins on more than one page | a **global label** (`global_label`, shape `passive`) at the stub end of each unwired pin and on each wired island, on every page |
| pins on one page | local labels, as on one sheet (scoped to the page: KiCad names the net `/<title>/<name>`) |

A global label carries a hidden `Intersheetrefs` field at its own position, so KiCad keeps it as written. Power
symbol and PWR_FLAG references (`#PWR01`, `#FLG01`) are numbered across all pages, so none repeats.

**Files and page numbers.**

- `kicad/<id>.kicad_sch`: the root, page 1 (`sheet_instances` `/` → `"1"`). Its sheet symbols are boxes 25.4 mm high
  and at least 50.8 mm wide (as wide as the longest title or file name needs), in rows from the top left (skipping the
  title block), in page order, each with the page's title as
  `Sheetname` and `<id>-<page id>.kicad_sch` as `Sheetfile`, plus the text that names no page. A root paper too small
  for all the boxes is refused.
- `kicad/<id>-<page id>.kicad_sch`: one per page, pages 2 … n+1 in `sheets` order (each sheet symbol's
  `(instances (project … (path "/<rootUuid>" (page "2"))))`). A page file has no `sheet_instances`; the same title
  block as the root (KiCad adds the sheet path, file name and "Id: 2/4").
- UUIDs: the sheet symbol `<project>/sheet/<id>`, the page file's own `(uuid …)` `<project>/page/<id>`, and the page's
  wires, labels, junctions, no-connects and texts seeded under `<project>/page/<id>/…`, so two pages may reuse
  coordinates. Symbols keep `<project>/part/<key>/unit/<n>`. Every symbol on a page is instanced at
  `/<rootUuid>/<sheetUuid>` with its reference and unit.
- The project file KiCad creates lists the sheets (`sheets: [[root, id], [sheetUuid, title], …]`). Page files of a page
  the design no longer has are deleted by `bun run sch` and reported by `bun run sch:check`.

Checked on KiCad 10.0.6 with `tests/fixtures/pages-proof` (2026-11-13, `tests/kicad/pages.test.ts`): ERC 0/0 over
`/`, `/Power/`, `/Signal/`, `/Output/`; netlist round-trip equal; `kicad-cli sch upgrade --force` on the root and on
each page file alone rewrites nothing but the generator lines (the upgrade job saves only the file it is given,
`EESCHEMA_JOBS_HANDLER::JobUpgrade`, so each file is checked on its own); the PDF has 4 pages; a board built by
`tools/pcb` passes DRC 0/0 with schematic parity.

**How the gates and the board treat pages.**

- Builder checks run per page with that page's paper: grid, overlaps, drawing area and title block, stacked pins,
  wires touching other connection points, junctions. Two nets meeting on a page (a power symbol, label or flag on
  another net's pin, a wire running into another net's pin or label) are reported with the spot, e.g. "page safety:
  pin C28.2 (net GND) and power symbol +3V3 (at D6.2) (net +3V3) meet at (101.6, 93.98) mm". Connectivity is computed
  per page and joined across pages by global labels and power symbols only, and must equal the declared nets.
- ERC, netlist export and PDF run on the root file; kicad-cli loads the whole hierarchy from it.
- Netlist round-trip: each component's `<sheetpath names tstamps>` must be its page's (`/<title>/`,
  `/<sheetUuid>/`). KiCad lists a part once, from the first sheet in page order that holds one of its units, with the
  `tstamps` of the units on that sheet only (`NETLIST_EXPORTER_XML::makeSymbols`): a quad with its power unit on page
  2 and its amplifiers on pages 3 and 4 is listed with page 2's path and the power unit's UUID. The gate expects
  exactly that.
- PDF: its page count must be the number of sheets (root + pages), counted from the PDF's page objects and its page
  tree (`tools/lib/pdf.ts`); the integration test cross-checks with macOS PDFKit.
- `review.md`: a page table, and per net and per part the page numbers it is on.
- Approval and fab: the schematic's sha256 is that of the root file for one sheet (as before), and for a schematic
  with pages that of the list "<file> <sha256>" of the root and every page (`tools/sch/files.ts`), so a change on any
  page voids the approval. fab's `inputs.json` lists every page file.
- Board (`bun run pcb`): a footprint of a part on a page gets the path `/<sheetUuid>/<symbolUuid>`, sheet name
  `/<title>/` and the page's file, as Update PCB from Schematic (F8) sets them (`BOARD_NETLIST_UPDATER`: the sheet
  path plus the first UUID of `tstamps`). DRC's schematic parity matches footprints by reference
  (`DRC_TEST_PROVIDER_SCHEMATIC_PARITY`), so the path is for F8, not for DRC. A root-sheet part is linked as before.

## 4. Gates

`bun run sch -- <id>` runs these in order (`tools/sch/gates.ts`); any failure stops the chain. **ERC alone is never
accepted as proof**: it cannot see a wire on the wrong pin or a connectivity bug inside KiCad.

1. **Validation:** zod checks the DSL and the parts database. `bun run sch` does not read `module.yaml`;
   `bun run validate` checks it.
2. **Design checks before writing** (`tools/sch/build.ts`):
   - pin-to-pad: every symbol pin number exists as a numbered pad of the assigned vendored footprint, and every
     numbered pad has a pin (unnumbered mechanical pads are allowed). This catches the class of bug in tscircuit
     #579, which ERC cannot see;
   - every pin of every placed unit is on a net with at least two connection points, or is marked no-connect;
   - all units of a multi-unit part are placed, including the power unit (`missing_power_pin` is an error);
   - each net with a `power_in` pin has exactly one `power_out` driver; a PWR_FLAG is added only when the net has
     none, because two `power_out` pins on one net are a `pin_to_pin` error;
   - no net joins two outputs, or an output and a `power_out`;
   - net names are unique ignoring case; no labels on single-pin nets;
   - Value and Footprint are identical across the units of a part;
   - every coordinate is a whole multiple of 1.27 mm, a wire has exactly two points, junctions sit wherever three or
     more connection points meet, and no wire crosses a connection point of another net (reported with its position,
     as is a power symbol, label or flag that lands on another net's pin);
   - symbols do not overlap and stay inside the drawing area, and the connectivity computed from the geometry
     equals the declared nets.
3. **Emit and self-parse:** our parser reads the output back. `kicad-cli` swallows parser exceptions and reports only
   "Failed to load schematic" with exit code 3, without a line or column.
4. **ERC:**
   ```
   kicad-cli sch erc --format json --units mm --severity-error --severity-warning --exit-code-violations \
     -o build/<id>/erc.json modules/<id>/kicad/<id>.kicad_sch
   ```
   Exit code 0 is required (5 means violations). The JSON is parsed with zod and its `kicad_version` asserted.
   `--severity-all` is never used, because it also counts excluded items. A `.rpt` report is written as well for
   positions (see #25582).
5. **Netlist round-trip:** `kicad-cli sch export netlist --format kicadxml`; the (reference, pin) → net partition,
   values and footprints must equal the DSL's, each symbol's `tstamps` must equal its expected UUIDv5, and its
   `sheetpath` its sheet's (§3a).
6. **PDF:** `kicad-cli sch export pdf -D GIT_SHA=<sha> -o build/<id>/<id>-schematic.pdf …` for the user's review.
   No `--theme` is passed, so the colours come from the eeschema settings in the isolated `KICAD_CONFIG_HOME`
   (`--help`: "will default to schematic settings"). Checked on 10.0.6 with a fresh config (2026-09-24): the output
   equals `--theme _builtin_default` and `--theme "KiCad Default"`, and `_builtin_classic` differs. An unknown
   theme name gives the default output without an error, so a mistyped `--theme` would go unnoticed.
   The PDF must have one page per sheet (§3a).
7. **Review file:** `build/<id>/review.md` with the ERC summary, the nets and the BOM with its sourcing status (and,
   with pages, the page of each net and part).

**ERC policy:** zero errors, zero warnings, no exclusions (they are serialised with coordinates and UUIDs, so they
break easily). A severity override is allowed only in the board's `.kicad_pro`, with its reason in the board's
`design-notes.md`. Every `${VAR}` on the sheet needs a default in `.kicad_pro`, because `unresolved_variable` is an
error (`tools/kicad/emit-pro.ts` sets `GIT_SHA` to `dev`).

**Acceptance criteria.** The decision was accepted on the condition that the proof project passes on the installed
KiCad 10.0.6. The proof is now the test fixture `tests/fixtures/pipeline-proof/schematic.ts`, rebuilt from this
toolchain's own parts on 2026-11-13; it passes the same gates. State on 2026-09-24 (details in §5a), with the
current proof's parts:

1. **Met.** `kicad-cli version --format about` is recorded and the #25583 canary passes (§5).
2. **Met.** The proof circuit passes gates 1–7 (`tests/kicad/pipeline.test.ts`). It exercises all three TL072
   units, symbols at 0/90/180/270° and mirrored in x and y, a 3.5 mm jack with two unused contacts and unnumbered
   locating pegs, a 1×4 header with two no-connects, a ±12 V screw terminal on a derived footprint, +12V/−12V/GND
   with exactly one PWR_FLAG each, and rails after a series diode that need their own PWR_FLAG.
3. **Met**, in the form the tests check: each of eight broken variants raises its expected ERC key (drop a PWR_FLAG
   → `power_pin_not_driven`; second PWR_FLAG → `pin_to_pin`; omit TL072 unit 3 → `missing_power_pin`; and so on).
   `tests/kicad/pipeline.test.ts` asserts that the key is present, not that it is the only one.
4. **Met.** Regenerating unchanged input is byte-identical (`tools/sch/build.test.ts`; `bun run sch:check`).
5. **Open.** The user opens the project in the GUI and sees neither the "older version" notice nor a "fixed on load"
   dialog, and judges the PDF readable. Neither has happened yet: §5a records only a `kicad-cli sch upgrade --force`
   re-save, which is not the GUI.
6. **Open (optional).** F8 into an empty board adds every footprint with its LCSC and MPN fields; after one value
   change and one renumbered reference, a second F8 shows only updates, no deletions or re-additions. The Update PCB
   handoff with stable UUIDs has not been exercised in the GUI yet; the fab fixture board in §5a is generated by a
   test, not made with F8.

## 5. Known KiCad issues

States checked through the GitLab API on 2026-09-23.

| Issue | State | Effect | Handling |
|---|---|---|---|
| [#25583](https://gitlab.com/kicad/code/kicad/-/issues/25583) | open, `status::need-info`, no milestone | In builds compiled against libc++ 22 (Xcode 26), connection points are ordered by x² + y², so unrelated points at the same distance from the sheet origin, such as (38.1, 50.8) and (50.8, 38.1), end up on one net. ERC stays silent apart from a possible `multiple_net_names` warning. The reporter says the official 10.0.3 macOS package is not affected; which toolchain built the 10.0.6 package is unverified. | Record the build with `kicad-cli version --format about`. Canary: two resistors with pin endpoints at (38.1, 50.8) on net A and (50.8, 38.1) on net B must export as two nets. The netlist round-trip gate stays mandatory. If the installed build is affected, stop and ask the user. |
| [#25582](https://gitlab.com/kicad/code/kicad/-/issues/25582) | closed, fix committed, milestone 10.0.7 | `kicad-cli sch erc` JSON coordinates are 100× too small (9.0.0 through 10.0.6). Counts, types and severities are correct. | Gate on counts. Take positions from the `.rpt` report, or multiply by 100 while `kicad_version` ≤ 10.0.6. |
| [#25413](https://gitlab.com/kicad/code/kicad/-/issues/25413) | closed, fix committed, milestone 10.0.7 | `kicad-cli pcb drc` crashes on macOS when there is no window server and there are DRC violations (10.0.4 and later). | Run DRC from a logged-in Terminal session, not from launchd, SSH or CI, until 10.0.7. |
| [#24684](https://gitlab.com/kicad/code/kicad/-/issues/24684) | open, `not-reproducible` | Reportedly, `kicad-cli sch erc` does not resolve custom footprint library names on macOS; two people could not reproduce it. | Would show up as `footprint_link_issues` with the project-local libraries. Not reproduced on this machine (§5a). |
| [#25484](https://gitlab.com/kicad/code/kicad/-/issues/25484), [#25198](https://gitlab.com/kicad/code/kicad/-/issues/25198) | #25484 open; #25198 closed, milestone 10.0.7 | `sch export` ignores other top-level sheets; PDF export ignores flat top-level sheets. | One root sheet per board; pages are sheets under it (§3a), never further top-level sheets. The PDF gate counts the pages. |

## 5a. Proof on the installed KiCad 10.0.6 (2026-09-24)

Build: `kicad-cli version --format about` reports `Compiler: Clang 16.0.0` (not the libc++ 22 toolchain of #25583).
`bun run test:full` (65 KiCad/ngspice-dependent and unit tests at the time) passed:

| Check | Result |
|---|---|
| Proof project ERC, errors + warnings, no exclusions | **0 errors, 0 warnings** |
| Netlist round-trip (nets, values, footprints, symbol UUIDs vs. the design) | equal |
| Re-save with `kicad-cli sch upgrade --force` | identical except the `generator` lines — KiCad has nothing to normalise or repair |
| Eight deliberately broken variants | each caught: `power_pin_not_driven`, `pin_to_pin`, `missing_power_pin`, `different_unit_footprint`, `pin_not_connected`, `endpoint_off_grid`, `isolated_pin_label`, `unresolved_variable` |
| #25583 canary: pins at (38.1, 50.8) and (50.8, 38.1) | two separate nets |
| #24684 (custom library names on macOS) | not reproduced: no `footprint_link_issues`/`lib_symbol_issues` with project-local GHP_ libraries |
| PDF export | readable after field-placement fixes; the user's readability review is still open (criterion 5) |
| GUI open, F8 to a board | not done yet (criteria 5 and 6) |
| Fab fixture (all proof footprints on a board) | DRC 0/0 after fixing footprint zones (board coordinates, 1 nm precision) |

The whole generator (S-expression layer, symbol library, builder, emitter, gates) came to about 2,300 lines of
TypeScript plus tests.

## 6. Consequences

Positive:

- Regeneration is deterministic, so git diffs show real changes only, and drift from a GUI save is detected.
- PCB links should survive schematic iterations, and part data should reach the footprints and the BOM through F8
  (expected from the UUID scheme; not exercised in the GUI yet, §4 criterion 6).
- Every ERC trap found in the 10.0.6 source can be prevented before the file is written.
- No upstream churn (tscircuit published 510 versions in 30 days), no Python, no new language.
- KiCad loads older file versions, so emitted files keep opening in KiCad 11.

Costs and risks:

- About 2,000–3,500 lines of TypeScript for a first version (dossier estimate, anchored on copperhead's line counts),
  owned and tested in this toolchain.
- Label-stub PDFs may be hard to read. A copperhead-style placer is a large addition (copperhead's layout engine is
  5,274 lines).
- Files open only in KiCad 10 or later. The KiCad 9 parser lacks `in_pos_files`, `body_style` and `(power local)`,
  so no version number makes them KiCad 9 compatible. The user had said "KiCad 8+" and has to accept this.
- An open eeschema window will likely not notice a regenerated file, and a GUI save overwrites it. Rule: close or
  revert eeschema before regenerating.
- Rotation and mirror mistakes can pass ERC and still wire the wrong pins (Diode fixed such a bug on 2026-09-14).
  The transform table is unit-tested against KiCad's matrices, and the netlist round-trip and the pin-to-pad check
  catch the rest.
- KiCad silently increments duplicate UUIDs and replaces malformed ones, so tests assert uniqueness and v5 format.
- Vendored libraries carry CC-BY-SA-4.0 attribution duties.
- A KiCad point release can change ERC output; golden and integration tests are re-run on every upgrade.

## 7. Re-evaluation triggers

- **tscircuit** is reconsidered only when **all three** have landed in a release: deterministic schematic symbol
  UUIDs (today `crypto.randomUUID()` on every export), a filled schematic Footprint field plus custom fields such as
  LCSC on schematic symbols, and real `power:` symbols (PR #598) merged. Merging #552, #565 and #598 alone is not
  enough. Even then, check pin electrical types (all `passive` today), net names with `+`/`-`, multi-unit symbols and
  PWR_FLAG support. State on 2026-09-23 (GitHub API): #549, #579, #585, #595 open; #552, #565, #598 open, unmerged.
- **KiCad 11** ships the schematic IPC API and a headless API server: evaluate driving KiCad directly.
- **Diode `pcb`** shows zero-violation ERC on KiCad 10 for a TL072 / ±12 V test circuit and reaches a stable
  release, and the user accepts its installer: reconsider it, or borrow its model where code owns connectivity and
  the human owns placement.
- **The proof PDF is judged unreadable:** add a placer (copperhead as the design reference) or a `sch:harvest` step
  that copies hand-tidied positions back into the DSL by UUID.
- **KiCad 10.0.7** is released: upgrade, re-run the golden and integration tests, and drop the #25582 workaround.
- **#25583 affects the installed build:** stop and revisit the KiCad installation before any schematic is trusted.

## 8. Sources

- KiCad 10.0.6 source: https://gitlab.com/kicad/code/kicad/-/tree/10.0.6 (`eeschema/sch_file_versions.h`,
  `eeschema/sch_io/kicad_sexpr/sch_io_kicad_sexpr_parser.cpp`, `eeschema/erc/erc.cpp`, `eeschema/erc/erc_settings.cpp`,
  `eeschema/lib_symbol.cpp`, `eeschema/eeschema_jobs_handler.cpp`, `include/cli/exit_codes.h`)
- KiCad 10 CLI manual: https://docs.kicad.org/10.0/en/cli/cli.html
- KiCad libraries 10.0.6: https://gitlab.com/kicad/libraries/kicad-symbols/-/tree/10.0.6 and
  https://gitlab.com/kicad/libraries/kicad-footprints/-/tree/10.0.6
- tscircuit exporter: https://github.com/tscircuit/circuit-json-to-kicad
- kicadts: https://github.com/tscircuit/kicadts
- copperhead: https://github.com/copperheadhq/copperhead
- Diode pcb: https://github.com/diodeinc/pcb (`crates/pcb-kicad-sch/DESIGN.md`, `CHANGELOG.md`)
- SKiDL: https://github.com/devbisme/skidl
- circuit-synth / kicad-sch-api: https://github.com/circuit-synth/circuit-synth, https://github.com/circuit-synth/kicad-sch-api
- atopile: https://github.com/atopile/atopile; Circuitscript: https://github.com/circuitscript/circuitscript-ts;
  PolymorphicBlocks: https://github.com/BerkeleyHCI/PolymorphicBlocks; JITX: https://docs.jitx.com/llms.txt
