// module.yaml schema: modules/<id>/module.yaml describes one standalone PCB (BoardYaml). The folder and file
// keep the name "module" for the unit of work: one board with its schematic, benches, layout and order files.
//
// Cross-field rules run in superRefine (zod runs them only once the shape is valid); every rule that encodes
// an external constraint names its source in the message. boardWarnings() adds non-fatal hints for limits
// that are unverified or whose terms are not settled.
import * as z from "zod";

/** JLCPCB options that module.yaml rules depend on. Prices and lead times are deliberately absent; they
 *  change too often to hard-code. */
export const JLCPCB = {
  /** "Thickness for FR4 are: 0.4/0.6/0.8/1.0/1.2/1.6/2.0 mm"; "Soldermask Green, Purple, Red,
   *  Yellow, Blue, White, and Black" (re-read 2026-09-24). */
  fr4: {
    source: "https://jlcpcb.com/capabilities/pcb-capabilities",
    thicknessMm: [0.4, 0.6, 0.8, 1.0, 1.2, 1.6, 2.0],
    colors: ["green", "purple", "red", "yellow", "blue", "white", "black"],
  },
  /** Economic PCBA: "Single sided placement (SMT/Thru-hole)", thickness 0.8–1.6 mm, order
   *  volume 2–50 pcs. Standard PCBA: single PCB 70×70 mm minimum, 2–80000 pcs. Its per-thickness
   *  table limits several thickness/colour rows to 2–30 pcs (see boardWarnings).
   *  Single board size: 10 × 10 to 470 × 500 mm (Economic), 70 × 70 to 460 × 500 mm (Standard);
   *  same page, docs/jlcpcb.md §7, re-read 2026-10-03. */
  assembly: {
    source: "https://jlcpcb.com/capabilities/pcb-assembly-capabilities",
    economic: { thicknessMm: [0.8, 1.6], qty: [2, 50], minBoardMm: 10, maxBoardMm: [470, 500] },
    standard: { minBoardMm: 70, qty: [2, 80000], maxBoardMm: [460, 500] },
  },
  /** "Outer Layer Copper Weight 1 oz, 2 oz" for 2-layer FR-4, among heavier ones (capabilities
   *  page, read 2026-10-03). Whether Economic PCBA takes 2 oz is unverified (docs/jlcpcb.md §7, §14). */
  copperOz: { source: "https://jlcpcb.com/capabilities/pcb-capabilities", values: [1, 2] },
  /** Copper layers this toolchain builds. JLCPCB assembles "2,4,6-layers" boards with Economic PCBA and "1 - 32 layers"
   *  with Standard PCBA (assembly capabilities page, read 2026-11-12). */
  layers: { source: "https://jlcpcb.com/capabilities/pcb-assembly-capabilities", values: [2, 4] },
  /** JLCPCB's 4-layer stackup JLC04161H-7628, top to bottom (https://jlcpcb.com/impedance, read 2026-11-12):
   *  1 oz outer copper 0.035 mm, 7628×1 prepreg 0.2104 mm, inner copper 0.0152 mm, core 1.065 mm (the page calls
   *  it "1.1mm H/HOZ with copper"), inner copper 0.0152 mm, prepreg 0.2104 mm, outer copper 0.035 mm. The page names
   *  no board thickness; the layers add up to 1.586 mm, which is the 1.6 mm option (my reading). Dielectric
   *  constant of 7628 prepreg: 4.4 (capabilities page, read 2026-11-12; the core's is not given there). It is the
   *  only 4-layer stackup described in this toolchain. */
  stackup4: {
    source: "https://jlcpcb.com/impedance",
    name: "JLC04161H-7628",
    thicknessMm: 1.6,
    outerOz: 1,
    copperMm: { outer: 0.035, inner: 0.0152 },
    prepreg: { name: "7628", mm: 0.2104, epsilonR: 4.4 },
    coreMm: 1.065,
  },
  /** "Large Size (Charged when PCB area > 650 cm²)", for Economic and Standard PCBA (read
   *  2026-10-03). The amount is a price and stays out of the code. The area is one board's: two quotes for
   *  ten boards of 164 cm² each (2026-10-04 and 2026-10-05) show "Large Size: $0.00". */
  largeSizeFee: { source: "https://jlcpcb.com/help/article/pcb-assembly-price", aboveCm2: 650 },
} as const;

export const MODULE_ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
export const ModuleId = z.string().regex(MODULE_ID_RE, "expected 2-32 chars: lowercase letters, digits and '-', starting with a letter");

/** Reference designator, e.g. J1, SW2, D10. */
export const Ref = z.string().regex(/^[A-Z]{1,3}\d{1,3}$/, "expected a reference like J1, SW2 or D10");

/** Key of a parts/<key>.yaml file, e.g. res-0603 or ap2112k-3.3 (dots for decimal sizes;
 *  a '.' must be followed by a letter or digit, so no '..' and no trailing '.'). */
export const PART_KEY_RE = /^[a-z0-9](?:[a-z0-9-]|\.(?=[a-z0-9]))*$/;
export const PART_KEY_HINT = "lowercase letters, digits, '-' and '.', starting with a letter or digit; '.' only before a letter or digit";
export const PartKey = z.string().regex(PART_KEY_RE, `expected a parts/<key>.yaml key: ${PART_KEY_HINT}`);

/** Lifecycle, in order. */
export const STATUSES = ["spec", "schematic", "schematic-approved", "layout", "fab-ready", "built", "verified"] as const;
export type ModuleStatus = (typeof STATUSES)[number];
export const statusAtLeast = (s: ModuleStatus, min: ModuleStatus) => STATUSES.indexOf(s) >= STATUSES.indexOf(min);

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "expected a lowercase hex sha256");

/** Display name, one line (it also lands in spec.md headings and schematic.ts strings). */
const Name = z.string().min(1).max(40).regex(/^\P{Cc}*$/u, "expected one line of text without control characters");

const Revision = z.strictObject({
  rev: z.string().regex(/^[A-Z]$/, "expected a single capital letter"),
  date: z.iso.date(),
  status: z.enum(STATUSES),
  /** Written by `bun run sch:approve` after the user's explicit OK. */
  approval: z.strictObject({ schSha256: Sha256, date: z.iso.date() }).optional(),
});

/** Name of a supply the board is fed from, e.g. usb-c-5v, +5V, VIN or +12V. */
export const RAIL_RE = /^[A-Za-z0-9+_.-]{1,24}$/;

/** Current the board draws from each supply that feeds it, in mA, by rail name: its own consumption, not what it
 *  passes on to other boards. At least one rail. */
const DrawMa = z.record(z.string(), z.number().min(0)).superRefine((r, ctx) => {
  if (Object.keys(r).length === 0) ctx.addIssue({ code: "custom", message: "name at least one supply rail, e.g. { usb-c-5v: 250 }" });
  for (const rail of Object.keys(r)) {
    if (!RAIL_RE.test(rail)) {
      ctx.addIssue({ code: "custom", path: [rail], message: `rail "${rail}": expected 1-24 letters, digits, '+', '-', '_' or '.', e.g. usb-c-5v or +12V` });
    }
  }
});
const DrawBasis = z.enum(["estimate", "measured"]);

const Jlcpcb = z.strictObject({
  assembly: z.enum(["none", "economic", "standard"]),
  smtSide: z.enum(["top", "bottom"]),
  /** Who solders the through-hole parts (connectors, modules). */
  tht: z.enum(["self", "jlcpcb", "consign"]),
  /** THT refs you solder yourself although `tht` has JLCPCB place the others (e.g. a part JLCPCB cannot
   *  source): left out of the BOM and the CPL. */
  handSolder: z.array(Ref).default([]),
  /** PCBs ordered. */
  qty: z.int().min(1),
  /** PCBs JLCPCB assembles, when fewer than `qty` (the rest arrive bare). Default: all of them. */
  assembleQty: z.int().min(1).optional(),
  removeOrderNumber: z.boolean(),
  /** Boards are delivered panelized (several copies on one JLCPCB delivery panel; needed for Standard PCBA
   *  below 70×70 mm). */
  panelized: z.boolean().default(false),
  /** Parts JLCPCB seats on spacers (its "Assembly Standoffs" service, asked for in the order remark):
   *  height of the part above the board in mm, by reference. `bun run render` lifts them too. */
  standoffs: z.record(Ref, z.number().positive()).default({}),
  /** The spacer the order remark asks for. */
  spacer: z.strictObject({ lcsc: z.string().regex(/^C\d+$/), name: z.string().min(1), diameterMm: z.number().positive() }).optional(),
});

/** Advice for ORDER.md "Before you pay" (fitting notes, rules for the boards). */
const OrderNotes = z.strictObject({ notes: z.array(z.string().min(1)).default([]) });

/** PCBs JLCPCB assembles: `assembleQty`, or every PCB ordered. */
export const assembledQty = (j: { qty: number; assembleQty?: number | undefined }) => j.assembleQty ?? j.qty;

/** module.yaml of a standalone board. It records its outline, because nothing else gives its size. */
export const BoardYaml = z
  .strictObject({
    schema: z.literal(1),
    id: ModuleId,
    name: Name,
    /** The one kind this toolchain builds: a standalone board. Optional. */
    kind: z.literal("board").default("board"),
    revision: Revision,
    /** What the board itself draws from its supplies (`drawMa`, by rail), and whether that is estimated or measured. */
    power: z.strictObject({ drawMa: DrawMa, drawBasis: DrawBasis }),
    pcb: z.strictObject({
      boards: z.int().min(1).max(3),
      /** Copper layers: 2, or 4 with inner planes on JLCPCB's JLC04161H-7628 stackup (docs/pcb.md "4-layer boards"). */
      layers: z.literal(JLCPCB.layers.values),
      thicknessMm: z.literal([0.8, 1, 1.2, 1.6, 2]),
      /** Solder-mask colour, an order option; the silkscreen on both is white. Economic PCBA lists 1.6 mm black
       *  boards with HASL for 2 to 50 pieces (docs/jlcpcb.md §7; the quote confirms). */
      mask: z.enum(["green", "black"]).default("green"),
      /** Board outline, mm. */
      sizeMm: z.strictObject({ w: z.number().positive(), h: z.number().positive() }),
      /** Outer copper weight, an order option (JLCPCB.copperOz). */
      copperOz: z.literal(JLCPCB.copperOz.values).default(1),
    }),
    jlcpcb: Jlcpcb,
    /** Board-specific advice for ORDER.md "Before you pay". */
    order: OrderNotes.optional(),
  })
  .superRefine((m, ctx) => {
    const issue = (path: PropertyKey[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const asm = JLCPCB.assembly;
    const j = m.jlcpcb;

    // 1. JLCPCB assembly options.
    if (j.assembly === "none" && j.tht !== "self") {
      issue(["jlcpcb", "tht"], `tht "${j.tht}" needs JLCPCB assembly (assembly is "none")`);
    }
    if (Object.keys(j.standoffs).length > 0 && !j.spacer) {
      issue(["jlcpcb", "spacer"], "standoffs need the spacer part the order remark asks for (jlcpcb.spacer: lcsc, name, diameterMm)");
    }
    if (j.assembleQty !== undefined) {
      if (j.assembly === "none") issue(["jlcpcb", "assembleQty"], 'assembleQty needs JLCPCB assembly (assembly is "none")');
      if (j.assembleQty > j.qty) issue(["jlcpcb", "assembleQty"], `assembleQty ${j.assembleQty} is more than the ${j.qty} PCBs ordered (qty)`);
    }

    // 2. The assembly tiers' thickness and quantity limits; the quantity limits count assembled boards.
    const n = assembledQty(j);
    const nKey = j.assembleQty === undefined ? "qty" : "assembleQty";
    if (j.assembly === "economic") {
      const [tMin, tMax] = asm.economic.thicknessMm;
      if (m.pcb.thicknessMm < tMin || m.pcb.thicknessMm > tMax) {
        issue(["pcb", "thicknessMm"], `Economic PCBA takes ${tMin}–${tMax} mm boards (${asm.source})`);
      }
      const [qMin, qMax] = asm.economic.qty;
      if (n < qMin || n > qMax) issue(["jlcpcb", nKey], `Economic PCBA takes ${qMin}–${qMax} pcs (${asm.source})`);
    }
    if (j.assembly === "standard") {
      const [qMin, qMax] = asm.standard.qty;
      if (n < qMin || n > qMax) issue(["jlcpcb", nKey], `Standard PCBA takes ${qMin}–${qMax} pcs (${asm.source})`);
    }

    // 3. A 4-layer board is built on the one 4-layer stackup this toolchain describes (JLCPCB.stackup4).
    if (m.pcb.layers === 4) {
      const s = JLCPCB.stackup4;
      if (m.pcb.thicknessMm !== s.thicknessMm) {
        issue(["pcb", "thicknessMm"], `a 4-layer board uses JLCPCB's ${s.name} stackup, which is ${s.thicknessMm} mm (${s.source}); no other 4-layer stackup is described in this toolchain`);
      }
      if (m.pcb.copperOz !== s.outerOz) {
        issue(["pcb", "copperOz"], `JLCPCB's ${s.name} stackup has ${s.outerOz} oz outer copper (${s.source}); heavier copper needs another stackup, not described in this toolchain`);
      }
    }

    // 4. The outline against the single-board sizes of the assembly tier.
    const [short, long] = [Math.min(m.pcb.sizeMm.w, m.pcb.sizeMm.h), Math.max(m.pcb.sizeMm.w, m.pcb.sizeMm.h)];
    const size = `${m.pcb.sizeMm.w} × ${m.pcb.sizeMm.h} mm`;
    if (j.assembly === "economic") {
      const [maxShort, maxLong] = asm.economic.maxBoardMm;
      if (short < asm.economic.minBoardMm || short > maxShort || long > maxLong) {
        issue(["pcb", "sizeMm"], `Economic PCBA takes single boards of ${asm.economic.minBoardMm} × ${asm.economic.minBoardMm} to ${maxShort} × ${maxLong} mm (${asm.source}); this board is ${size}`);
      }
    }
    if (j.assembly === "standard") {
      const [maxShort, maxLong] = asm.standard.maxBoardMm;
      if (short > maxShort || long > maxLong) {
        issue(["pcb", "sizeMm"], `Standard PCBA takes single boards up to ${maxShort} × ${maxLong} mm (${asm.source}); this board is ${size}`);
      }
      if (short < asm.standard.minBoardMm && !j.panelized) {
        issue(
          ["jlcpcb", "panelized"],
          `Standard PCBA needs single boards of at least ${asm.standard.minBoardMm}×${asm.standard.minBoardMm} mm (${asm.source}); this board is ${size}, so panelize (panelized: true) or use Economic PCBA`,
        );
      }
    }

    // 5. Estimated current draw is fine on paper, not on a built board.
    if (m.power.drawBasis === "estimate" && statusAtLeast(m.revision.status, "built")) {
      issue(["power", "drawBasis"], `status "${m.revision.status}" needs measured current draw (drawBasis: measured)`);
    }
    // 6. An approved schematic has an approval record.
    if (statusAtLeast(m.revision.status, "schematic-approved") && !m.revision.approval) {
      issue(["revision", "approval"], `status "${m.revision.status}" needs revision.approval (written by bun run sch:approve)`);
    }
  });
export type BoardYaml = z.infer<typeof BoardYaml>;

export interface Finding {
  path: PropertyKey[];
  message: string;
}

/** Non-fatal hints: "likely" and unverified limits, and order options whose terms are not settled. */
export function boardWarnings(m: BoardYaml): Finding[] {
  const out: Finding[] = [];
  const warn = (path: PropertyKey[], message: string) => out.push({ path, message });

  // Unverified, so never an error (docs/jlcpcb.md §7 and §14).
  if (m.jlcpcb.assembly === "economic" && m.jlcpcb.tht !== "self" && m.jlcpcb.smtSide === "bottom") {
    warn(
      ["jlcpcb", "smtSide"],
      `Economic PCBA is "Single sided placement (SMT/Thru-hole)" (${JLCPCB.assembly.source}); whether SMT on the bottom plus ` +
        `THT soldered by JLCPCB (tht: ${m.jlcpcb.tht}) on top counts as single sided is unverified (docs/jlcpcb.md §7, §14). ` +
        "Check it in the quote tool or with JLCPCB support, or use smtSide top, tht self or Standard PCBA",
    );
  }
  if (m.jlcpcb.assembly === "economic" && assembledQty(m.jlcpcb) > 30) {
    warn(
      ["jlcpcb", m.jlcpcb.assembleQty === undefined ? "qty" : "assembleQty"],
      `Economic PCBA above 30 pcs: the per-thickness table on ${JLCPCB.assembly.source} limits several thickness/colour rows to 2–30 pcs, and JLCPCB's PCBA FAQ reportedly asks for panelized boards above 30 (docs/jlcpcb.md §13); check the order form`,
    );
  }
  if (m.jlcpcb.assembly === "none") return out;
  if (m.pcb.copperOz !== 1 && m.jlcpcb.assembly === "economic") {
    warn(["pcb", "copperOz"], `${m.pcb.copperOz} oz copper with Economic PCBA is unverified (docs/jlcpcb.md §7); check it in the quote tool`);
  }
  const fee = JLCPCB.largeSizeFee;
  const cm2 = (m.pcb.sizeMm.w * m.pcb.sizeMm.h) / 100;
  if (cm2 > fee.aboveCm2) {
    warn(["pcb", "sizeMm"], `the board is ${Math.round(cm2)} cm²: JLCPCB charges a large-size assembly fee when the "PCB area" exceeds ${fee.aboveCm2} cm² (${fee.source})`);
  }
  return out;
}
