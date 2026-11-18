# JLCPCB order-file reference

What JLCPCB expects from a KiCad 10 project for PCB fabrication and PCB assembly (PCBA), and how this toolchain's
`fab` step (`bun run fab`, `tools/fab/`) produces it.

> **This toolchain never uploads files and never places orders.** `bun run fab -- <id>` writes files into
> `build/<id>/fab/rev-<R>/` (or `build/<id>/fab/DRAFT/` with `--draft`) and stops. The user checks them in JLCPCB's
> viewer, uploads them and places every order by hand on jlcpcb.com. No tool in this toolchain talks to a JLCPCB
> account or API.

Status legend: **verified** = read in a JLCPCB page, a JLCPCB sample
file, KiCad source or a tool's own repository; **likely** = secondary source or inference; **unverified** = not
confirmed. **re-read** = read again on 2026-09-23 while writing this page; **re-read 2026-09-24** = read while review
findings were fixed; **dossier** = from the 2026-09-23 research pass, not re-read here. Every English JLCPCB help
article read on 2026-09-23 carried the same stamp, "Last updated on Sep 09, 2026", so the stamp says little about when
a page's content last changed.

JLCPCB's prices and limits change often, and its own pages already disagree with each other (§13). **Never hard-code
a price.** Cite the page, and let the quote tool give the number at order time.

## 1. File set

`<prefix>` is `<id>-rev<R>` for an order package and `DRAFT-<id>` for a draft.

| File | Produced by | Upload slot |
|---|---|---|
| `<prefix>-gerbers.zip`: copper, mask, silkscreen, paste, outline, drill files, drill map | `kicad-cli pcb export gerbers` and `pcb export drill`, zipped (`tools/fab/fab.ts`) | PCB order |
| `<prefix>-bom.csv` | `kicad-cli sch export netlist --format kicadxml` plus `parts/*.yaml` (`tools/fab/bom.ts`) | PCBA order, BOM |
| `<prefix>-cpl.csv` | footprints read from the `.kicad_pcb` (`tools/fab/placement.ts`), cross-checked against `kicad-cli pcb export pos`, rotation table applied (`tools/fab/cpl.ts`) | PCBA order, CPL |
| `README.md` | checklist: approval, DRC summary, ignored checks, sourcing, lines to check by hand | – |
| `gerbers/`, `drc.json`, `netlist.xml`, `kicad-positions.csv` | the unzipped set and the intermediate reports | – |

With `jlcpcb.assembly: none` in module.yaml there is no BOM, no CPL and no sourcing check: Gerbers and drill only,
and the README says so.

Every `kicad-cli` call runs through `tools/kicad/cli.ts` (isolated `KICAD_CONFIG_HOME`, explicit `-o`).

**What `bun run fab` checks before it writes an order file** (all of them; a refusal lists every problem):

1. module.yaml validates against the schema of `bun run validate` (`revision.rev` names the output folder).
2. Unless `--draft`: the schematic's sha256 equals `revision.approval.schSha256`.
3. DRC is 0 errors and 0 warnings, with `--schematic-parity`, zones refilled in memory, no excluded violations and
   no checks set to "ignore" beyond KiCad 10.0.6's defaults (`KICAD_DEFAULT_IGNORED` in `tools/kicad/drc.ts`:
   `footprint_filters_mismatch`, `footprint_type_mismatch`, `missing_courtyard`, `track_not_centered_on_via`,
   `tuning_profile_track_geometries`, read from `ignored_checks` of a fresh `drc.json`). `--no-parity` is only
   accepted together with `--draft`, and the README then says that parity was not checked.
4. Every BOM line has a parts-DB entry and, unless `--draft`, verified sourcing (§4).
5. Every BOM designator is on the board exactly once, and the board file agrees with kicad-cli's position file on
   anchor, rotation and side (§5).

Everything is written into a staging folder that replaces `rev-<R>/` only when all checks passed. A refusal after
module.yaml was read deletes the staging folder and the old `rev-<R>/` (its files no longer match the board) and
keeps the DRC report as `build/<id>/fab/rev-<R>-refused-drc.json`. An invalid module.yaml or a usage error
(`--no-parity` without `--draft`) is refused before anything is touched.

```
kicad-cli pcb drc --format json --units mm --severity-error --severity-warning --severity-exclusions \
  --refill-zones --exit-code-violations --schematic-parity -o <stage>/drc.json <pcb>
```

`--refill-zones` without `--save-board` leaves the board file unchanged (checked on 10.0.6: same sha256 before and
after; `tests/kicad/fab.test.ts` asserts it). An excluded violation appears in drc.json with `"excluded": true` and
its original severity (checked on 10.0.6).

## 2. Gerbers

| Topic | JLCPCB guidance | Source | Status | Checked |
|---|---|---|---|---|
| Layers, 2-layer board | F.Cu, B.Cu, F.Paste, B.Paste, F.Silkscreen, B.Silkscreen, F.Mask, B.Mask, Edge.Cuts (add In1.Cu … only for 4+ layers) | https://jlcpcb.com/help/article/how-to-generate-gerber-and-drill-files-in-kicad-9 | verified | re-read |
| Plot options, KiCad 9 article | "Use Protel filename extensions" (recommended, "JLCPCB prefers" them), "Use extended X2 format", "Include netlist attributes" | same | verified | re-read |
| Plot options, KiCad 7/8 articles | plot reference designators and footprint text, check zone fills, tent vias, Protel extensions, subtract soldermask from silkscreen | https://jlcpcb.com/help/article/how-to-generate-gerber-and-drill-files-in-kicad-8 | verified | dossier |
| File names | "Our site understands KiCAD's gerber naming patterns. We suggest checking the Use Protel Filenames option, but it's not required." | https://jlcpcb.com/help/article/suggested-naming-patterns | verified | re-read |
| Non-English KiCad | turn on Protel filenames and rename `Edge_Cuts.gbr` to `.GKO` | same | verified | re-read |
| Outline | exactly one outline layer (GKO or GM1); delete other outline layers | https://jlcpcb.com/help/article/gerber-files-preparation | verified | dossier |
| Upload | zip the whole output folder (Gerbers, drill files, drill map) | KiCad 9 article | verified | re-read |

`kicad-cli` facts (KiCad 10.0.6; https://docs.kicad.org/10.0/en/cli/cli.html and source, dossier):

- Without `--layers`, every enabled layer is plotted, including Fab, Courtyard and User layers. An invalid layer
  name only prints a message; the export continues.
- With `--board-plot-params`, `--layers` and `--common-layers` are ignored.
- Protel extensions and X2 are on by default (`--no-protel-ext`, `--no-x2` turn them off). A `<board>-job.gbrjob`
  file is always written.

- `--check-zones` is "Check and refill zones if required" (`kicad-cli pcb export gerbers --help`, 10.0.6).
  Without it, a zone saved unfilled or stale is plotted as saved; with it the pour is plotted (checked on 10.0.6
  with an unfilled B.Cu zone: no G36 region without the flag, the pour with it).

Command (`tools/fab/fab.ts`):

```
kicad-cli pcb export gerbers --layers "F.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts" \
  --subtract-soldermask --check-zones -o <stage>/gerbers/ <pcb>
```

## 3. Drill files

| Setting | Value | Source | Status | Checked |
|---|---|---|---|---|
| Format | Excellon | KiCad 9 article | verified | re-read |
| Oval holes | "Use alternate drill mode" | KiCad 9 article | verified | re-read |
| Origin | Absolute | KiCad 9 article | verified | re-read |
| Units | Millimeters | KiCad 9 article | verified | re-read |
| Zeros | Decimal format | KiCad 9 article | verified | re-read |
| Drill map | recommended ("highly recommend providing this layer") | naming-patterns article | verified | re-read |

**PTH and NPTH, one file or two (sources conflict):**

- The step list of the KiCad 9 article says nothing about merging. Its closing summary says "merging PTH and NPTH
  holes into one file" and "Plot board edge on all layers", neither of which appears in the steps (re-read).
- `kicad-cli pcb export drill` merges by default; `--excellon-separate-th` writes `<board>-PTH.drl` and
  `<board>-NPTH.drl` (KiCad source, dossier).
- The Bouni and Fabrication Toolkit plugins both write two files (source, dossier).
- For uploads with several drill files JLCPCB may warn "Drill files have been merged", which "can generally be
  ignored" (naming-patterns article, about Altium; re-read).

**Toolchain handling:** separate files, matching the proven plugins. Always pass every drill option explicitly: the CLI
default for units is mm, but the underlying job object defaults to inch (dossier). Check the result in JLCPCB's
Gerber viewer before the first order.

```
kicad-cli pcb export drill --format excellon --drill-origin absolute --excellon-units mm \
  --excellon-zeros-format decimal --excellon-oval-format alternate --excellon-separate-th \
  --generate-map --map-format gerberx2 -o <stage>/gerbers/ <pcb>
```

## 4. BOM

**Official sample file** (re-read 2026-09-23;
https://s3.amazonaws.com/helpscout.net/docs/assets/59f1de7804286313cffbb22c/attachments/60ee4acd9e87cb3d0124d284/Sample-BOM_JLCSMT.xlsx,
linked from https://jlcpcb.com/help/article/bill-of-materials-for-pcb-assembly). Header row, exactly:

```
Comment | Designator | Footprint | JLCPCB Part #（optional）
```

The parentheses are full-width characters, U+FF08 and U+FF09. Example rows: `100uF | C1 | CAP-SMD_L3.5-W2.8 | C16133`
and `15K | R5,R6 | R0603 | C22809`. Several designators share one cell, separated by commas.

| Rule | Source | Status | Checked |
|---|---|---|---|
| Required columns: Comment (value, e.g. "100nF"), Designator, Footprint (package) | BOM help page | verified | re-read |
| File types .csv, .xls, .xlsx | BOM help page | verified | re-read |
| Designators are converted to upper case; do not use case to tell parts apart | BOM help page | verified | re-read |
| KiCad 10 guide: the BOM needs Comment, Designator, Footprint "and the JLCPCB / LCSC Part #"; rename KiCad's columns to `Comment, Designator, Footprint, JLCPCB Part #` (Reference → Designator, Value → Comment) | https://jlcpcb.com/help/article/how-to-generate-the-bom-and-centroid-file-from-kicad (written on KiCad 10.0.3) | verified | re-read |
| KiCad 10 guide: add a schematic field named `LCSC Part #` | same | verified | re-read |
| At most 200 designators per BOM line | https://jlcpcb.com/help/article/advice-for-bom-and-cpl-files-preparation | verified | re-read |
| Every designator must appear in both BOM and CPL, with the same letter case | advice article | verified | re-read |
| No designator may appear twice in the BOM | advice article | verified | re-read |
| Use standard prefixes (C for capacitors, R for resistors) | advice article | verified | re-read |

Headers other tools emit, all reported to work:

| Tool | BOM header | Source | Status |
|---|---|---|---|
| Fabrication Toolkit | `Designator, Footprint, Quantity, Value, LCSC Part #` | JLCPCB KiCad 10 guide (re-read); plugin source (dossier) | verified |
| Bouni kicad-jlcpcb-tools | `Comment,Designator,Footprint,LCSC,Quantity` | https://github.com/Bouni/kicad-jlcpcb-tools/blob/main/fabrication.py | verified (dossier) |

That JLCPCB matches header names loosely is an inference from these tools (likely).

**Toolchain handling** (`tools/fab/bom.ts`): the BOM is built from the schematic's XML netlist
(`kicad-cli sch export netlist --format kicadxml`), not with `kicad-cli sch export bom`. A line is every component
with a `PartKey` field that is neither DNP nor excluded from the BOM and whose parts-DB `assembly` is `smt`, or
`tht` unless module.yaml has `jlcpcb.tht: self`; `hand` parts never appear, and neither do board features that are
no parts (`assembly: none`: solder jumpers, test pads, mounting holes). Lines are grouped by value, footprint
and part number, and every designator is listed individually (no ranges). The header is
`Comment,Designator,Footprint,JLCPCB Part #`, the rename the KiCad 10 guide asks for. The part number is the
schematic's `LCSC` field or, when that is empty, its `MPN` field, as the Fabrication Toolkit fills its `LCSC Part #`
column (`plugins/process.py` @642b069, `_get_mpn_from_footprint`, lines 461-472: LCSC/JLCPCB fields first, then
`MPN`; verified, source read). The generator copies both fields from `parts/*.yaml` (schema in
`tools/module/parts.ts`). The symbol field names are internal to the toolchain; only the CSV header reaches JLCPCB.

A line is verified when the parts DB has a `verified: {source, date}` record for its value and the schematic
carries the recorded number; `fab` refuses a non-draft export while any line is unverified:

- JLCPCB-sourced lines (SMT parts, and THT parts with `jlcpcb.tht: jlcpcb`) need the LCSC number.
- Consigned lines (THT parts with `jlcpcb.tht: consign`) need the LCSC number or, when the part has none, the MPN
  (schematic field `MPN`). JLCPCB matches own parts "with MFR. Part number or JLCPCB Part number" at the
  parts-selection step (https://jlcpcb.com/help/article/how-to-use-my-own-parts-for-pcb-assembly-order, "Last
  updated on Sep 09, 2026"; verified, read 2026-09-24), and a consignment is created by entering "the component's
  MFR.Part # or JLCPCB Part # (C-code)"
  (https://jlcpcb.com/help/article/how-to-consign-parts-to-jlcpcb-from-mainland-china; verified, read 2026-09-24).
  Which BOM column JLCPCB reads for a consigned part is not documented (**unverified**; the BOM help page, "Last
  updated on Sep 09, 2026", re-read 2026-09-24, names only Comment, Designator and Footprint): the BOM keeps the four
  sample columns, an MPN-only line carries its MPN in the `JLCPCB Part #` cell as the Fabrication Toolkit does, and
  the README lists every consigned line with its LCSC number and MPN and asks the user to check that each one is
  matched to the consigned stock before ordering.

`kicad-cli sch export bom` is not used. Notes on it (KiCad 10.0.6), in case it is needed later:

- Default fields `Reference,Value,Footprint,QUANTITY,DNP` with ranges like `R1-R4`; `--ref-range-delimiter`
  defaults to `-`, and its help says "Leave blank for no ranges" (dossier; the empty value is not tested).
- `--sort-asc` exists: "Sort ascending (true) or descending (false). [nargs=0..1] [default: true]". Passed bare it
  works; passed with a value (`--sort-asc false`, `--sort-asc=true`) 10.0.6 exits 255 with "Unhandled exception
  class: St12bad_any_cast" (checked 2026-09-24). Leave it out: the default is ascending.
- `--string-delimiter` defaults to `"` (the docs say none). `--include-excluded-from-bom` is deprecated and has no
  effect (dossier).

## 5. CPL (pick and place)

**Official sample file** (re-read 2026-09-23;
https://s3.amazonaws.com/helpscout.net/docs/assets/59f1de7804286313cffbb22c/attachments/5d83250e04286364bc8f4c5e/Sample-CPL_JLCSMT.xlsx).
Header row, exactly:

```
Designator | Mid X | Mid Y | Layer | Rotation
```

Example rows: `C1 | 95.0518mm | 22.6822mm | T | 270` and `R2 | 109.5996mm | 16.6443mm | B | 0`.

| Rule | Source | Status | Checked |
|---|---|---|---|
| Mid X / Mid Y are the component **centroid**, in mm | https://jlcpcb.com/help/article/pick-place-file-for-pcb-assembly | verified | re-read |
| Layer is Top or Bottom; "T"/"B" also accepted; both sides in one file | CPL help page; advice article | verified | re-read |
| Rotation in degrees; "Positive values are counter clockwise" | CPL help page | verified | re-read |
| Placement data is needed for "surface mount and through-hole parts" | CPL help page | verified | re-read |
| All coordinates in one unit; different designators at least 0.2 mm apart | advice article | verified | re-read |
| KiCad 10 guide lists the columns as `Designator, Mid X, Mid Y, Rotation, Layer` (another order than the sample) | KiCad 10 guide | verified | re-read |

KiCad's own placement CSV (KiCad source `place_file_exporter.cpp`, dossier):

- Header `Ref,Val,Package,PosX,PosY,Rot,Side`; Side is `top`/`bottom`; Y is negated so it points up.
- X/Y is the **footprint anchor**, not the centroid. A pin header, for example, has its anchor on pin 1, and a
  1×4 header's centre is 3.81 mm away.
- `kicad-cli pcb export pos` defaults to inches and ASCII. Use `--format csv --units mm --side both --exclude-dnp`.
  Do not pass `--smd-only` or `--exclude-fp-th` when JLCPCB is to place THT parts.
- Gerbers and CPL must use the same origin (both absolute, or both the aux origin).

```
kicad-cli pcb export pos --format csv --units mm --side both --exclude-dnp -o <stage>/kicad-positions.csv <pcb>
```

**Toolchain handling** (`tools/fab/placement.ts`, `tools/fab/cpl.ts`): the CPL has the sample's header and column order,
`T`/`B` layers and one line per BOM designator. Mid X/Mid Y follow the Fabrication Toolkit (`plugins/process.py`
@642b069, `_get_footprint_position` and `_get_origin_from_footprint`; verified, read 2026-09-24):

- Footprints with the SMD attribute are placed at their anchor.
- Every other footprint (through-hole or unspecified) is placed at the centre of the bounding box of all its pads,
  taken with the footprint turned back to 0° and then rotated with it; flipped (bottom) footprints use the mirrored
  pad positions the board file stores. Bouni's kicad-jlcpcb-tools uses the pad centre for every footprint, SMD
  included (`fabrication.py` @9e8aba8, `get_position`; verified, read 2026-09-24); the toolchain follows the
  Fabrication Toolkit.
- The pads come from the `.kicad_pcb` (parsed with `tools/sexpr`): footprint-relative positions, board angles,
  shape offsets. Bounding boxes are computed for circle, rect, roundrect and oval pads (KiCad builds roundrects from
  an inner rectangle plus edge segments of width 2r, ovals from one segment); a non-SMD footprint with a trapezoid,
  custom or per-layer padstack pad, or a chamfered pad at an angle, is refused rather than placed approximately.
- Coordinates use the page origin with Y negated, like kicad-cli's position file, the Gerbers and the drill files
  (all absolute; the Fabrication Toolkit uses the aux origin for all three instead). fab refuses when the board
  file and kicad-cli's position file disagree on a designator's anchor, rotation or side.
- Checked against the plugin: its `_get_footprint_position` run in pcbnew 10.0.6 on the fixture board, with
  footprints turned to 30°, 45°, 60°, 90°, −90°, 180° and 200°, flipped to the bottom, with an oval pad at an angle
  and a pad with a shape offset, gives the same points to within 0.5 nm (the unit tests keep three of these cases).
  On the test fixtures, a 1×4 pin header (anchor on pin 1) moves 3.81 mm to its pad centre, and a 4-pole terminal
  block at 5 mm pitch (anchor on pin 1) moves 7.5 mm.

The pad centre is where the part is placed, not necessarily its body centre; check THT parts in the placement
preview.

## 6. Rotation and offset correction

JLCPCB (https://jlcpcb.com/help/article/pcb-assembly-faqs-part-2, verified, re-read): "The 0 degree that you defined
for your design may be different with the one that we defined … our engineers will review and fix the rotation and
polarity of the components based on the silkscreen markings before assembly." Polarity is judged from the
silkscreen; without polarity marks they ask by email. The price page lists a paid "Confirm Parts Placement" option
(https://jlcpcb.com/help/article/pcb-assembly-price; re-read; amount not copied here).

Causes (likely): KiCad and JLCPCB/EasyEDA footprints use different zero orientations; many THT footprints are
anchored on pin 1; for bottom-side parts both major plugins write `180 − rot` ("as viewed from above component"), a
tool convention, not a published JLCPCB rule.

Both plugins mirror first and add the table correction afterwards: Fabrication Toolkit `plugins/process.py`
@642b069 lines 244-251 (`rotation = (180.0 - rotation)`, then `rotation += rotation_offset_db`; verified, read
2026-09-24), kicad-jlcpcb-tools `fabrication.py` @9e8aba8 lines 579-590 (`rotation = (180 - rotation) % 360`,
then `(rotation + correction % 360) % 360`; verified, read 2026-09-24). The toolchain does the same:
Rotation = (top ? rot : 180 − rot) + correction, mod 360, with rot as KiCad reports it. A SOIC-8 on the bottom at 0°
therefore gets 90 (unit test in `tools/fab/fab.test.ts`). The table's Delta X/Y offsets are turned with the
footprint as in the plugin (lines 229-242); every offset in the current table is 0.

**Seed table:** the Fabrication Toolkit's `plugins/transformations.csv`
(https://github.com/bennymeg/Fabrication-Toolkit/blob/master/plugins/transformations.csv).

| Property | Value | Status | Checked |
|---|---|---|---|
| Licence | Apache-2.0 (repository licence) | verified (`gh api`) | re-read |
| Header | `"Regex To Match","Rotation","Delta X","Delta Y"` | verified | re-read |
| Size | about 50 regex rows keyed on the footprint name, e.g. `^SOT-23` 180, `^SOIC-` 270, `^QFN-` 90, `^CP_Elec_` 180 | verified | re-read |
| Last change | commit 038cd1d, 2024-02-27 | verified (`gh api`) | re-read |
| Defect | duplicate patterns with different rotations: `^VSSOP-8_` with 180 (line 49) and 270 (line 50) | verified | re-read 2026-09-24 |
| Matching | first line in file order whose regex matches the footprint name (`re.search`); only when none does, the first that matches the library nickname (`_get_rotation_from_db`, process.py @642b069) | verified | read 2026-09-24 |
| Plugin extras | per-footprint fields `FT Rotation Offset`, `FT Position Offset`, `FT Layer Override`, `FT Origin`; places non-SMD parts at the pad bounding-box centre | verified | read 2026-09-24 |

Toolchain handling:

- `tools/fab/transformations.csv` is the upstream file, unmodified (byte-identical at 038cd1d and at 642b069), with
  the copyright notice in `tools/fab/NOTICE.md` and the licence text in `tools/fab/LICENSE-Apache-2.0.txt`.
- `tools/fab/cpl.ts` matches exactly like the plugin, so `^VSSOP-8_` → 180 wins for every VSSOP-8 footprint.
  `loadCorrections` records patterns listed with conflicting values, and the fab README lists every part whose
  correction another matching line contradicts (the conflicting duplicate, or a more specific line shadowed by an
  earlier general one), to be checked in the placement preview. Which VSSOP-8 value is right is unverified.
- The plugin's per-footprint override fields are not read. A part can carry its own correction instead:
  `cplRotation` (0, 90, 180 or 270) on a value in `parts/*.yaml`. It replaces the table's rotation for that part and
  is added the same way on both sides; the fab README lists the parts corrected this way.
- **Why per part:** JLCPCB places from its own footprint for the LCSC part, and through-hole connector footprints
  rarely match a table line. Seen in JLCPCB's placement preview on 2026-10-04 (the user's quote check of an earlier
  board): all 21 box headers lay turned by 90°; a screw terminal, quick-connect tabs and electrolytics stood right.
- **How to check a part:** read JLCPCB's footprint at
  `https://easyeda.com/api/products/<LCSC>/components?version=6.4.19.5` (JSON; `packageDetail.dataStr.shape` holds
  `PAD~…` entries in units of 10 mil around `head.x`/`head.y`, y pointing down; the symbol's pins name anode and
  cathode) and compare pad 1 with KiCad's footprint. Only facts about JLCPCB's footprints are read; no code or
  table of easyeda2kicad is used. The service refuses bursts: one request every few seconds.

  | Part | LCSC | JLCPCB's footprint against KiCad's (read 2026-10-04) | `cplRotation` |
  |---|---|---|---|
  | Box header 2×8 | C3406 | along x, pad 1 bottom left; KiCad: along y, pad 1 top left | 270 |
  | Box header 2×5 | C2977596 | the same | 270 |
  | Jack WQP518MA | C53058333 | the two pins 3.1 mm apart are below the centre; KiCad: above it | 180 |
  | Terminal WJ128V-5.0-04P | C192769 | equal: pad 1 left, wire entry towards +y (its holes are 1.7 mm, ours 1.5 mm after the maker's drawing) | – |
  | Electrolytic 1000 µF | C88720 | equal: pad 1 is the positive one, on the left | – |
  | Tab EST026 | C52878 | equal: both legs along x | – |
  | TVS SMBJ13A, SMBJ6.0A; SS14 | C19077567, C19077560; C2480 | equal: cathode on the left | – |
  | LEDs 0805 green, red, yellow; LED 3 mm | C2297, C84256, C2296; C5383216 | equal: cathode (0805) or pad 1 (3 mm) on the left; the 0805 pad numbers differ, the sides do not | – |
  | TL074H SOIC-14 | C2878713 | pad 1 bottom left, as the table's `^SOIC-` 270 assumes | table |

  With these, every pad of every placement of that board lands on its KiCad pad (computed from both footprints,
  2026-10-04: likely until the preview shows it). The parts of this toolchain record their own check in their
  part files (`cplRotation`, with the pad positions read, 2026-11-12/13).
- **Bottom side (likely):** computed the same way for two TL074H and two SS14 on the back of an earlier board, the
  Fabrication Toolkit convention is right if JLCPCB mirrors its footprint left to right and turns it clockwise as
  seen from the top, which is counter-clockwise as seen from the part's side. The preview has to confirm it.
- Do **not** seed from matthewlai/JLCKicadTools `cpl_rotations_db.csv` (GPL-3.0, verified via `gh api`; its README
  points to the Fabrication Toolkit, dossier) or from easyeda2kicad (AGPL-3.0, dossier).
- Bouni's MIT-licensed rules (https://github.com/Bouni/kicad-jlcpcb-tools/blob/main/CORRECTIONS.md; CSV
  `Pattern,Rotation,Offset X,Offset Y`; regex on reference, value, footprint, plus exact per-LCSC rules) are a
  secondary reference (dossier).
- Check every part in JLCPCB's placement preview before ordering. The bottom-side `180 − rot` convention needs one
  test board to confirm (open).

## 7. Assembly tiers

From https://jlcpcb.com/capabilities/pcb-assembly-capabilities (verified, re-read):

| Feature | Economic PCBA | Standard PCBA |
|---|---|---|
| Assembly types | "Single sided placement (SMT/Thru-hole)" | "Single & double sided placement (SMT/Thru-hole)" |
| Layers | 2, 4, 6 | 1–32 |
| Board thickness | 0.8–1.6 mm | no limit |
| Single board size | 10 × 10 to 470 × 500 mm | 70 × 70 to 460 × 500 mm |
| Panel size | 10 × 10 to 250 × 250 mm | 70 × 70 to 250 × 250 mm |
| Quantity | 2–50 pcs (colour-dependent, below) | 2–80,000 pcs |
| Delivery | single PCB or mouse-bite panel | single, mouse-bite or V-cut panel |
| Edge rails, fiducials | not necessary | necessary |
| Smallest package | 0402 | 0201 |
| Minimum IC pin pitch | 0.4 mm | 0.35 mm |
| Build time | 1–3 days | ≥ 4 days |

Economic PCBA board options (same page, "PCB Specs for Economic PCB Assembly"). The page's static HTML leaves the
Layer column empty. The first group of rows is most likely the 2-layer set (unverified):

| Thickness | Colour | Finish | Quantity |
|---|---|---|---|
| 0.8 mm | green | HASL (leaded or lead-free) | 2–30 |
| 1.0 / 1.2 mm | green or black | HASL | 2–30 |
| 1.6 mm | green | HASL or ENIG | 2–50 |
| 1.6 mm | black | HASL | 2–50 |
| 1.6 mm | blue or purple | HASL | 5–30 |
| 1.6 mm | red or white | leaded HASL | 5–30 |

What this means for a board:

- Standard PCBA needs at least 70 × 70 mm, so a smaller board must be panelized (derived; `jlcpcb.panelized`).
- A board with SMD parts on one side and through-hole parts on the other: whether Economic treats that as "single
  sided" is **unverified**. Check it in the quote tool (no order) or ask JLCPCB support. validate warns.
- The dossier cites FAQ Q10 as saying orders over 30 pcs need panelized delivery or Standard PCBA, against the
  50 pcs above (conflict, not re-read).
- A long board (390 × 42 mm, 164 cm²) is inside Economic PCBA's single-board size (verified, the table above).
  The price page lists a fee for large boards above 650 cm² (read 2026-10-03, amount not copied here). Two quotes
  for ten such boards (2026-10-04 and 2026-10-05) showed "Large Size" USD 0.00, so the fee counts one board's area
  (§14). Whether Economic PCBA takes 2 oz copper is unverified: the option table above names no copper weight.
  The quote settles it.
- Read part prices, do not assume them, Basic parts included: on 2026-10-04 the Basic 10 µF 50 V 1206 capacitor
  (C13585) cost USD 0.20–0.27 a piece, more than an Extended 10 µF 25 V X7R 1210 (C39232) at USD 0.10–0.12
  (JLCPCB parts API). With 60 capacitors on a board that outweighs the Extended fee.

## 8. Basic and extended parts

From https://jlcpcb.com/help/article/pcb-assembly-faqs (verified, re-read):

- **Basic** parts stay loaded on the pick-and-place machines, so there is no feeder labour cost.
- **Extended** parts need feeders mounted by hand, which costs a per-part fee.
- **Preferred Extended** parts are former basic parts; they "are exempt from the Feeders Loading fee for Economic PCB
  assembly".
- The FAQ quotes "698 kinds of basic components"; the count may be out of date.

Fees are not copied here. The FAQ and the price page (https://jlcpcb.com/help/article/pcb-assembly-price) state
different amounts for the same items (setup, stencil, per-joint, hand-soldering labour, extended-part fee); both were
re-read on 2026-09-23 and still differ. The price page also says the extended-components fee applies to Economic
orders, while Standard orders pay feeder loading for basic and extended parts alike.

**Toolchain handling:** each part value in `parts/*.yaml` records `jlcpcbTier: basic | extended` together with a
`verified: {source, date}` entry (`tools/module/parts.ts`). Look parts up at https://jlcpcb.com/parts or
https://yaqwsx.github.io/jlcparts/; never guess an LCSC number or tier.

## 9. Two-layer FR-4 capabilities we design against

From https://jlcpcb.com/capabilities/pcb-capabilities (verified, re-read). These seed the KiCad board design rules.

| Feature | Value |
|---|---|
| Track width / spacing, 1 oz | 0.10 / 0.10 mm (2 oz: 0.16 / 0.16 mm) |
| Track width tolerance | ±20 % |
| Drill range, 2-layer | 0.15–6.3 mm (0.15 mm costs more); ≥ 6.3 mm is CNC-routed |
| Hole tolerance, through-holes | +0.13 / −0.08 mm; PTH ≥ 0.5 mm recommended |
| Via, minimum | 0.15 mm hole / 0.25 mm diameter; preferred minimum hole 0.2 mm; diameter = hole + 0.1 (0.15 preferred) |
| PTH annular ring, 2-layer 1 oz | 0.25 mm recommended, 0.18 mm absolute minimum |
| NPTH, minimum | 0.50 mm; NPTH pad ring ≥ 0.45 mm recommended |
| Plated slot | ≥ 0.5 mm wide, length ≥ 2 × width |
| Non-plated slot | ≥ 1.0 mm, drawn in the outline layer; tolerance ±0.2 mm |
| Rectangular holes or slots | not supported without rounded corners |
| Pad to track | 0.1 mm |
| PTH to track | 0.28 mm minimum, 0.35 mm recommended |
| Via hole to track; NPTH to track | 0.2 mm; 0.2 mm |
| SMD pad to pad, different nets | 0.15 mm |
| Via / pad hole-to-hole | 0.2 mm / 0.45 mm |
| Soldermask bridge, 1 oz | 0.10 mm; 0.13 mm on black or white |
| Soldermask expansion | 1:1 possible since the LDI upgrade of June 2025 |
| Silkscreen | line ≥ 0.15 mm, text height ≥ 1.0 mm, pad to silkscreen 0.15 mm |
| Copper to routed edge | ≥ 0.2 mm |
| Outline tolerance, routed | ±0.2 mm regular; ±0.1 mm high precision, only for boards of at least 50 × 50 mm with at least three tooling holes of Ø1.5 mm or more on different corners (re-read 2026-09-24) |
| FR-4 thickness | 0.4 / 0.6 / 0.8 / 1.0 / 1.2 / 1.6 / 2.0 mm; ±10 % at ≥ 1.0 mm |
| Soldermask colours | green, purple, red, yellow, blue, white, black |
| Finishes | HASL (leaded or lead-free), ENIG, OSP |

The labtroll `JLCPCB.kicad_dru` rules were last pushed in 2024-11 and may predate the June 2025 soldermask change
(dossier); do not copy them without checking.

### Four-layer boards

Read 2026-11-12, verified: the multilayer columns of https://jlcpcb.com/capabilities/pcb-capabilities, the
stackup on https://jlcpcb.com/impedance and the layer counts on
https://jlcpcb.com/capabilities/pcb-assembly-capabilities.

| Feature | Value |
|---|---|
| Track width / spacing, outer 1 oz | 0.09 / 0.09 mm (3 mil "acceptable in BGA fan-outs"); 2 oz 0.15 / 0.15 mm |
| Track width / spacing, inner 0.5 oz | no separate value given |
| Via, minimum | 0.15 mm hole / 0.25 mm diameter, as on 2 layers (0.1 / 0.2 mm only on boards of 1 mm or less with ENIG or OSP) |
| PTH annular ring, multilayer 1 oz | 0.20 mm recommended, 0.15 mm absolute minimum (2 oz: 0.254 mm) |
| Drill range | 0.15–6.3 mm, as on 2 layers |
| Inner layer: via hole to copper | 0.2 mm |
| Inner layer: PTH pad hole to copper | 0.3 mm |
| Copper to routed edge | ≥ 0.2 mm, no separate inner-layer value |
| Copper weights | outer 1 or 2 oz; inner 0.5 (default), 1 or 2 oz |
| Thickness, 4 layers | 0.4–2.0 mm options; 2.5 mm and more only from 12 layers |
| Dielectric constants | 7628 prepreg 4.4, 3313 4.1, 2116 4.16; 2-layer FR-4 4.5 |
| PCBA layer counts | Economic: "2,4,6-layers"; Standard: "1 - 32 layers" |

**Stackup JLC04161H-7628**, top to bottom (impedance page):
- 1 oz outer copper 0.035 mm;
- 7628×1 prepreg 0.2104 mm;
- inner copper 0.0152 mm;
- core 1.065 mm (labelled "1.1mm H/HOZ with copper");
- inner copper 0.0152 mm;
- 7628×1 prepreg 0.2104 mm;
- 1 oz outer copper 0.035 mm.

The page names no board thickness. The layers add up to 1.586 mm, which is the 1.6 mm option (my reading,
**likely**). It is the stackup `bun run pcb` writes into every 4-layer board file (docs/pcb.md "4-layer
boards").

The rules `bun run pcb` writes for a 4-layer board (`PCB_RULES_4`, `tools/pcb/flow.ts`):
- the 2-layer set above, whose tracks, vias and annular rings are already coarser than the multilayer minimums;
- except hole to copper, `min_hole_clearance` 0.35 mm: 0.05 mm margin on the inner layers' 0.3 mm from a PTH
  hole. KiCad applies one hole clearance to every layer, so the outer layers get it too.

No other 4-layer stackup (other thicknesses, 2 oz copper) is described in this toolchain.

## 10. Through-hole assembly

- JLCPCB supports THT and mixed SMD + THT assembly in one PCBA order, under both Economic and Standard PCBA; "THT
  components are assembled using wave soldering". Unused through-holes are kept free of solder so parts can be added
  by hand later (assembly capabilities FAQ; verified, re-read).
- Parts marked "wave soldering" in the parts library "will be assembled manually"; cost is a hand-soldering labour
  fee plus a per-joint fee; build time is one day longer; ordering works like SMT (assembly FAQ Q2; verified,
  re-read).
- **Pre-order parts** (API fields `isBuyComponent` 1, `preMinPurchaseNum`, stock 0) go into your JLCPCB parts
  stock first; JLCPCB confirms a pre-order's price within 48 h, and no lead time is stated. Order 3 more than
  needed, because JLCPCB refunds a shortfall of fewer than 3 instead of buying it (read 2026-09-24/25). A part file
  marks such a value with `preorder: true`; ORDER.md then asks for the pre-order with the quantity.
- **Part height:** JLCPCB's "Assembly Standoffs" service fits a spacer under a THT part. The fee is "cost of the
  standoff device + $0.032 per standoff" (personalized services page, verified). Nylon LED spacers are in the
  library, for example HIWA LED4*6, C94094 (Ø4 mm, 6 mm, 31,680 in stock). Request it by order note
  (module.yaml `jlcpcb.standoffs` and `jlcpcb.spacer`; ORDER.md writes the remark).
- **Loose parts:** unassembled parts cannot ship with a PCBA order (assembly FAQ part 2, verified). With
  `jlcpcb.tht: self`, ORDER.md and `parts-you-solder.csv` list the parts to buy elsewhere.
- **Board sides:** Economic PCBA places parts on one side only ("Single sided placement (SMT/Thru-hole)",
  capabilities page, verified). A Sep 2025 forum report says THT on the side opposite the SMD parts moved an order
  to Standard (likely). Put all SMD on the THT body side (`jlcpcb.smtSide: top`) unless the quote says otherwise.
- Consignment (https://jlcpcb.com/help/article/how-to-consign-parts-to-jlcpcb, "Last updated on Sep 09, 2026";
  verified, re-read 2026-09-24): parts shipped from outside mainland China are registered as a sale to JLCPCB.
  Import duty and import VAT are paid up front as a "refundable deposit", refunded once the parts are used in a
  JLCPCB PCBA order. The import handling service fee is "Non-refundable". Storage is free for up to three years; parts
  not used by then count as abandoned, and their deposits are not refunded. Retrieving parts costs a fee. Rates and
  minimums are on the page and are not copied here.
- **Toolchain handling:** module.yaml `jlcpcb.tht` says who solders the THT parts. `self` leaves them out of BOM and
  CPL; `jlcpcb` and `consign` put them in both, placed at their pad centre (§5). Consigned lines are verified by
  LCSC number or MPN and listed in the fab README (§4).

## 11. Shipping to Switzerland

The user orders from Switzerland. Read in the user's quotes and on the carriers' and customs pages in 2026-09
(verified unless marked):

- **Global Standard Direct Line (GSDL):** about USD 8 for a light cart, 10–14 business days, limited to 1.5 kg,
  USD 65 of order value and 55 × 40 cm. Its freight rises with weight: USD 11.81 up to 0.4 kg, USD 13.93 up to
  0.5 kg, USD 22.91 up to 1 kg.
- **Swiss import VAT** (8.1 %) is charged on the goods plus all costs to the destination, freight included. Tax of
  CHF 5 or less is not collected (BAZG: about CHF 62 of value); Swiss Post charges nothing then. Above it, Swiss Post
  adds a clearance fee of CHF 16 + 3 % of the value for goods from outside the EU. JLCPCB offers no duties-paid
  option for Switzerland and is not registered for Swiss VAT, so the CHF 5 rule applies.
- **What this means (derived):** keep merchandise plus freight at or below about USD 72, which is about USD 60 of
  merchandise for a 0.4–0.5 kg cart, and ship by GSDL. Above USD 65 GSDL disappears and the parcel crosses the tax
  threshold at the same moment, so it costs twice: it goes by an express carrier and pays VAT plus the carrier's fee.
  Customs uses its own exchange rate, so keep about USD 3 of margin (unverified).
- Do not split one board's order to stay under the threshold: that likely counts as circumvention (secondary
  source; the BAZG page says nothing on splitting).
- Unverified: which company delivers and clears GSDL parcels in Switzerland (assumed Swiss Post), and whether the
  USD 65 cap counts goods only or goods plus freight (it does not matter at USD 60 of merchandise).

ORDER.md repeats the rule in "Before you pay". A large assembled order (such as two assembled helmet driver boards)
is likely above it; the quote shows the merchandise total.

## 12. Order number

From the French help page https://jlcpcb.com/fr/help/article/how-to-remove-order-number-from-your-pcb ("Dernière
mise à jour le Jan 21, 2026"; verified, re-read). The English page
(https://jlcpcb.com/help/article/how-to-remove-order-number-from-your-pcb) rendered with an empty body and an empty
"Last updated on" stamp on 2026-09-23.

- JLCPCB prints an order number on every board by default, on the rails if there are any, otherwise at a random or
  specified position.
- In the quote form read on 2026-09-24, "no order number" was the default selection (verified); check the option at
  every order.
- To choose the position: put exactly `JLCJLCJLCJLC` on the silkscreen, at least 0.8 mm high and 0.15 mm wide, and
  select "Order Number (Specify Position)" when ordering.
- **"Remove Mark"** removes all marking (order number and 2D barcode). It has no service fee for 1–6 layer PCBs and
  a fee for 8 layers and more.
- Choosing the 2D barcode (serial number) option removes the order number.

The user chooses this option in the order form (module.yaml `jlcpcb.removeOrderNumber`, which ORDER.md repeats). The
tools write no `JLCJLCJLCJLC` text; put it on the silkscreen by hand to choose the position.

## 13. Conflicts

| Item | Source A | Source B | How the toolchain handles it |
|---|---|---|---|
| PTH/NPTH drill files | KiCad 9 article summary: merge into one file | kicad-cli default merges; plugins write two files; the article's steps are silent | Separate files (`--excellon-separate-th`); check in the Gerber viewer. |
| BOM part-number header | sample: `JLCPCB Part #（optional）` (full-width parentheses) | KiCad 10 guide: `JLCPCB Part #`; plugins: `LCSC Part #`, `LCSC` | Emit `JLCPCB Part #` as the guide says. |
| CPL column order | sample: Designator, Mid X, Mid Y, Layer, Rotation | KiCad 10 guide: Designator, Mid X, Mid Y, Rotation, Layer | Use the sample's order; names match either way. |
| Assembly fees | assembly FAQ | price page | Never hard-code; cite both, use the quote. |
| Economic quantity | capabilities page: 2–50 (colour-dependent) | FAQ Q10 per dossier: > 30 needs panelized delivery | Keep quantities ≤ 30 until checked in the quote tool (validate warns). |
| Order-number page | English page empty | French page complete (Jan 21, 2026) | Follow the French page. |
| Rotation table | Fabrication Toolkit `^VSSOP-8_` → 180 (line 49) | same file `^VSSOP-8_` → 270 (line 50) | First match wins, as in the plugin; the fab README flags the part; verify in the placement preview. |

## 14. Open items to check before the first order

- [ ] Economic PCBA with SMD on one side and THT on the other: quote tool or JLCPCB support.
- [ ] LCSC numbers and basic/extended tier for every BOM line, each with a source and date in `parts/*.yaml`.
- [ ] Bottom-side rotation convention (`180 − rot`, then the correction) confirmed on one test board in the
      placement preview.
- [ ] THT placement points (pad centre) of the connectors in the placement preview. Preview of 2026-10-04 (an
      earlier board): box headers, a terminal, tabs and electrolytics sat on their footprints; the headers' rotation
      was wrong and is corrected (§6).
- [ ] Consigned parts: which BOM column JLCPCB reads for them, and that an MPN-only line is matched to the
      consigned stock.
- [ ] VSSOP-8 rotation (table lines 49/50 disagree), if a VSSOP-8 part is ever used.
- [ ] First Gerber/drill set checked in JLCPCB's Gerber viewer (separate PTH/NPTH files, one outline layer).
- [ ] 2 oz copper with Economic PCBA and the bare PCB price at 2 oz: the quote. Read in the quotes of 2026-10-04 and
      2026-10-05 (ten boards of 390 × 42 mm, 1 oz): "Large Size" USD 0.00, so the fee for large boards counts one
      board's area; PCB USD 19.80. The second quote has a line "Nitrogen reflow soldering" (USD 0.99) that the
      first did not have; whether it can be switched off is not read.
- [ ] A black board with Economic PCBA (the table in §7 lists 1.6 mm black with HASL; its layer column was
      unreadable), and whether black changes the price or the build time: the quote.
- [x] The Extended fee on through-hole parts: not charged (the two quotes of 2026-10-04 and 2026-10-05). It is
      charged per SMD Extended type that is not "preferred".
