// Parts database: parts/<key>.yaml, one file per physical part family.
//
// A part fixes symbol + footprint + assembly method. Sourcing (MPN, LCSC number) depends on the
// value, so it lives per value under `values`. Nothing is guessed: unknown data stays null, and
// `verified` records where and when LCSC/MPN were checked (e.g. https://jlcpcb.com/parts).
// fab refuses non-draft exports while any used value is unverified. Board features that are no
// parts (solder jumpers, test pads, mounting holes) are `assembly: none` and have no sourcing.
import * as z from "zod";

/** KiCad library id "<Library>:<Name>" as in the stock KiCad 10 libraries. */
export const LibId = z.string().regex(/^[A-Za-z0-9_.+-]+:[^:\s]+$/, "expected <Library>:<Name>");

export const Verified = z.strictObject({
  /** Page where the data was checked (distributor/manufacturer URL). */
  source: z.url(),
  date: z.iso.date(),
});

export const Sourcing = z.strictObject({
  mpn: z.string().min(1).nullable(),
  manufacturer: z.string().min(1).nullable(),
  lcsc: z.string().regex(/^C\d+$/, "LCSC numbers look like C12345").nullable(),
  jlcpcbTier: z.enum(["basic", "extended"]).nullable(),
  verified: Verified.nullable(),
  /** JLCPCB sells it as pre-order only (stock 0) as of `verified.date`: the user pre-orders it into their
   *  JLCPCB parts stock before the PCBA order (ORDER.md). */
  preorder: z.boolean().optional(),
  /** JLCPCB's footprint for this LCSC part is turned against KiCad's: the degrees to add to KiCad's rotation in
   *  the CPL, counter-clockwise. It replaces the rotation of the Fabrication Toolkit table (docs/jlcpcb.md §6).
   *  Read both footprints' pad positions before setting it, and record them in the part file's header. */
  cplRotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
});
export type Sourcing = z.infer<typeof Sourcing>;

export const Part = z.strictObject({
  schema: z.literal(1),
  description: z.string().min(1),
  /** Stock KiCad symbol, vendored by `bun run lib:import` as GHP_<Library>:<Name>. */
  symbol: LibId,
  /** Stock KiCad footprint, vendored as GHP_<Library>:<Name>. */
  footprint: LibId,
  /** Who fits it: JLCPCB's SMT line, JLCPCB's through-hole station (or the user, module.yaml jlcpcb.tht),
   *  or always the user by hand. "none" is a board feature that is no part at all (a solder jumper, a
   *  test pad, a mounting hole, wire-link holes): nothing is sourced, placed or soldered. */
  assembly: z.enum(["smt", "tht", "hand", "none"]),
  datasheet: z.url().nullable(),
  /** Value string (KiCad "Value" field) → sourcing. Fixed parts have exactly one entry. */
  values: z.record(z.string().min(1), Sourcing).refine((v) => Object.keys(v).length > 0, "at least one value"),
  /** What ORDER.md tells the user about this part. */
  order: z.strictObject({
    /** What to check in JLCPCB's placement preview, e.g. "pin 1" or "the cathode band". */
    previewCheck: z.string().min(1).optional(),
  }).optional(),
  notes: z.string().optional(),
}).superRefine((p, ctx) => {
  // A board feature has nothing to buy: sourcing data on it would be a mistake in the file.
  if (p.assembly !== "none") return;
  for (const [value, s] of Object.entries(p.values)) {
    if (s.mpn !== null || s.manufacturer !== null || s.lcsc !== null || s.jlcpcbTier !== null || s.verified !== null || s.preorder !== undefined) {
      ctx.addIssue({ code: "custom", path: ["values", value], message: 'assembly "none" is a board feature without a part: its sourcing fields stay null' });
    }
  }
});
export type Part = z.infer<typeof Part>;

/** Prefix of the vendored libraries' nicknames: they never collide with the user's global KiCad libraries. */
export const VENDORED_PREFIX = "GHP_";

/** Vendored library nickname for a stock library: "Device" → "GHP_Device". */
export const vendoredLib = (stockLib: string) => `${VENDORED_PREFIX}${stockLib}`;

/** "Device:R" → "GHP_Device:R". */
export function vendoredId(stockId: string): string {
  const i = stockId.indexOf(":");
  return `${vendoredLib(stockId.slice(0, i))}${stockId.slice(i)}`;
}

