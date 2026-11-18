// Pipeline proof (test fixture): a buffered 2:1 level stage with a protected ±12 V power entry.
// Not a product. It exercises every risky part of the schematic generator: all four rotations and both
// mirrors, a flattened multi-unit op-amp including its power unit, a connector with unused contacts
// (no-connects), a footprint with unnumbered mechanical pads (the jack's locating pegs), a derived footprint
// (the terminal block), wired and label-only nets, junctions, labels, and power symbols with exactly one
// PWR_FLAG per rail. Values are placeholders.
//
// Adapted from the toolchain's earlier proof: the parts are this toolchain's own (parts/*.yaml).
import { defineSchematic } from "../../../tools/sch/dsl.ts";

export default defineSchematic({
  project: "pipeline-proof",
  sheet: { paper: "A4", title: "Pipeline proof: buffered level stage", rev: "A", date: "2026-09-24", company: "test fixture" },
  parts: {
    // Power entry (bottom band): screw terminal 1 = +12 V, 2 = GND, 3 = -12 V, 4 unused; series Schottky per rail.
    pwrIn: { ref: "J1", part: "terminal-5.00-1x04", at: [30, 108], mirror: "y" },
    dPos: { ref: "D1", part: "schottky-sma", at: [60, 106], rot: 180 },
    dNeg: { ref: "D2", part: "schottky-sma", at: [60, 110] },
    cBulkP: { ref: "C1", part: "cap-1206", value: "10u 50V", at: [80, 114] },
    cBulkN: { ref: "C2", part: "cap-1206", value: "10u 50V", at: [94, 106], rot: 180 },
    cDecP: { ref: "C3", part: "cap-0603", value: "100n", at: [108, 114] },
    cDecN: { ref: "C4", part: "cap-0603", value: "100n", at: [120, 106], rot: 180 },
    // Signal path (top): IN -> 2:1 divider -> follower -> x2 non-inverting stage -> 1k -> OUT.
    inJack: { ref: "J2", part: "jack-3.5mm-stop", at: [16, 36] },
    rTop: { ref: "R4", part: "res-0603", value: "10k", at: [26, 40], rot: 90 },
    rBot: { ref: "R5", part: "res-0603", value: "10k", at: [34, 46] },
    amp: {
      ref: "U1",
      part: "tl072-soic8",
      units: { 1: { at: [60, 40] }, 2: { at: [90, 40], mirror: "x" }, 3: { at: [134, 110] } },
    },
    rGnd: { ref: "R2", part: "res-0603", value: "10k", at: [76, 30], rot: 90 },
    rFb: { ref: "R3", part: "res-0603", value: "10k", at: [90, 30], rot: 270 },
    rOut: { ref: "R1", part: "res-0603", value: "1k", at: [104, 40], rot: 90 },
    outConn: { ref: "J3", part: "header-1x04-2.54", at: [124, 42] },
  },
  nets: {
    "+12V_RAW": { label: true, pins: ["pwrIn.1", "dPos.A"], wires: [["pwrIn.1", "dPos.A"]] },
    "-12V_RAW": { label: true, pins: ["pwrIn.3", "dNeg.K"], wires: [["pwrIn.3", "dNeg.K"]] },
    "+12V": { power: true, pins: ["dPos.K", "cBulkP.1", "cDecP.1", "amp.8"], flagAt: "dPos.K" },
    "-12V": { power: true, pins: ["dNeg.A", "cBulkN.2", "cDecN.2", "amp.4"], flagAt: "dNeg.A" },
    GND: {
      power: true,
      pins: ["pwrIn.2", "cBulkP.2", "cBulkN.1", "cDecP.2", "cDecN.1", "inJack.S", "rBot.2", "rGnd.1", "outConn.2"],
      flagAt: "cBulkP.2",
    },
    IN: { pins: ["inJack.T", "rTop.1"], wires: [["inJack.T", "rTop.1"]] },
    // Wired between the divider resistors, a label stub at the op-amp.
    ATT: { pins: ["rTop.2", "rBot.1", "amp.3"], wires: [["rTop.2", [34, 40], "rBot.1"]] },
    BUF: {
      pins: ["amp.1", "amp.2", "amp.5"],
      wires: [
        ["amp.1", [68, 40], [68, 46], [52, 46], [52, 42], "amp.2"],
        [[68, 40], [78, 40], [78, 42], "amp.5"],
      ],
    },
    FB: {
      pins: ["amp.6", "rGnd.2", "rFb.2"],
      wires: [["amp.6", [82, 38], [82, 30], "rFb.2"], ["rGnd.2", [82, 30]]],
    },
    AMP: {
      pins: ["amp.7", "rFb.1", "rOut.1"],
      wires: [["amp.7", [98, 40], [98, 30], "rFb.1"], [[98, 40], "rOut.1"]],
    },
    OUT: { pins: ["rOut.2", "outConn.1"], wires: [["rOut.2", "outConn.1"]] },
  },
  noConnect: ["outConn.3", "outConn.4", "inJack.R1", "inJack.R2", "pwrIn.4"],
  text: [
    { at: [14, 22], text: "Signal path: IN -> 2:1 divider -> buffer -> x2 -> 1k -> OUT", size: 1.5 },
    { at: [14, 96], text: "Power entry: +/-12 V terminal block, series Schottky reverse protection", size: 1.5 },
  ],
});
