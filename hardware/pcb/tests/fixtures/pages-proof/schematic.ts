// Pages proof (test fixture): a hierarchical schematic, a root sheet with one sheet symbol per page. Not a product.
// It exercises what pages add: power nets with power symbols on every page (one PWR_FLAG each), signals that cross
// pages (VREF: a wired divider on the power page into an op-amp on the signal page; BUF: a wired follower on the
// signal page into an op-amp on the output page) and so get global labels, nets that stay on one page (OUT with
// local labels, U2B and U2D wired), a quad op-amp whose units sit on all three pages (A and B on the signal page,
// C and D on the output page, the power unit E on the power page), overview text on the root, and the same
// coordinates used on two pages. Values are placeholders.
import { defineSchematic } from "../../../tools/sch/dsl.ts";

export default defineSchematic({
  project: "pages-proof",
  sheet: { paper: "A4", title: "Pages proof: a reference and two followers", rev: "A", date: "2026-11-13", company: "test fixture" },
  sheets: [
    { id: "power", title: "Power", paper: "A4" },
    { id: "signal", title: "Signal" },
    { id: "output", title: "Output", paper: "A4" },
  ],
  parts: {
    // Power page: +-12 V entry, bypass caps, the op-amp's power unit, the reference divider.
    pwrIn: { ref: "J1", part: "terminal-5.00-1x04", at: [30, 40], sheet: "power" },
    cPos: { ref: "C1", part: "cap-0603", value: "100n", at: [60, 40], sheet: "power" },
    cNeg: { ref: "C2", part: "cap-0603", value: "100n", at: [72, 40], sheet: "power" },
    rTop: { ref: "R1", part: "res-0603", value: "10k", at: [110, 34], sheet: "power" },
    rBot: { ref: "R2", part: "res-0603", value: "10k", at: [110, 46], sheet: "power" },
    // One quad, three pages: the unit's own `sheet` overrides the part's.
    amp: {
      ref: "U2",
      part: "opa4197-soic14",
      sheet: "signal",
      units: {
        1: { at: [60, 40] },
        2: { at: [60, 70] },
        3: { at: [40, 40], sheet: "output" },
        4: { at: [60, 70], sheet: "output" },
        5: { at: [90, 40], sheet: "power" },
      },
    },
    // Output page: series resistor to a header.
    rOut: { ref: "R3", part: "res-0603", value: "1k", at: [70, 50], sheet: "output" },
    outConn: { ref: "J2", part: "header-1x04-2.54", at: [100, 40], sheet: "output" },
  },
  nets: {
    "+12V": { power: true, pins: ["pwrIn.1", "cPos.1", "amp.4", "rTop.1"], flagAt: "cPos.1" },
    "-12V": { power: true, pins: ["pwrIn.3", "cNeg.2", "amp.11"], flagAt: "cNeg.2" },
    GND: { power: true, pins: ["pwrIn.2", "cPos.2", "cNeg.1", "rBot.2", "amp.5", "amp.12", "outConn.2"], flagAt: "cPos.2" },
    // Cross-page: wired on the power page, a stub at the op-amp on the signal page.
    VREF: { pins: ["rTop.2", "rBot.1", "amp.3"], wires: [["rTop.2", "rBot.1"]] },
    // Cross-page: the follower's loop on the signal page, a stub at unit C on the output page.
    BUF: { pins: ["amp.1", "amp.2", "amp.10"], wires: [["amp.1", [68, 40], [68, 48], [54, 48], "amp.2"]] },
    // One page each, wired: units B and D as idle followers, at the same coordinates on their two pages.
    U2B: { pins: ["amp.7", "amp.6"], wires: [["amp.7", [68, 70], [68, 78], [54, 78], "amp.6"]] },
    // One page, two islands: local labels.
    OUT: { pins: ["amp.8", "amp.9", "rOut.1"], wires: [["amp.8", [48, 40], [48, 48], [34, 48], "amp.9"]] },
    OUT_R: { pins: ["rOut.2", "outConn.1"] },
    U2D: { pins: ["amp.14", "amp.13"], wires: [["amp.14", [68, 70], [68, 78], [54, 78], "amp.13"]] },
  },
  noConnect: ["pwrIn.4", "outConn.3", "outConn.4"],
  text: [
    { at: [20, 70], text: "Root sheet: one sheet symbol per page. Nets cross pages by name (global labels, power symbols)." },
    { at: [20, 20], text: "Power entry, bypass and the reference divider", sheet: "power" },
    { at: [20, 20], text: "Follower of VREF; unit B idle", sheet: "signal" },
  ],
});
