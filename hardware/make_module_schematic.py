#!/usr/bin/env python3
"""Draw the AD5328 module ("AD5328模块 V1.2") as a schematic, reconstructed from photos of the board.

    python3 hardware/make_module_schematic.py     # writes docs/ad5328-module.svg

What it shows comes from three sources: the board itself (silkscreen, connectors, test pads, the codes printed on
every resistor and the IC markings), the data sheets of the parts identified (pin numbers and functions), and where
the parts sit next to each other. The last is not proof of a connection: those wires are drawn dashed.

Data sheets read for the pin numbers:
- AD5308/AD5318/AD5328, Analog Devices, Rev. F, Table 5 "Pin Function Descriptions" (docs/ad5308_5318_5328.pdf).
- SGM8271/SGM8272/SGM8274, SGMICRO, "Pin Configurations": OUTA 1, -INA 2, +INA 3, -VS 4, +INB 5, -INB 6,
  OUTB 7, +VS 8.
- TPS61040/TPS61041, TI SLVS413L, Table 4-1 (DBV package: SW 1, GND 2, FB 3, EN 4, VIN 5; feedback 1.233 V) and the
  ordering table (DBV marking "PHOI"); Figure 7-7 is the positive and negative supply this module appears to copy.
"""
import os

from make_schematic import STANDALONE_STYLE, Svg, gnd, text

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "docs", "ad5328-module.svg"))

EXTRA_STYLE = """
  .dash { stroke-dasharray: 6 4 }
  .s-head { fill: #1c232b; font: 600 20px 'Barlow Condensed', 'Arial Narrow', sans-serif; letter-spacing: .03em }
  .s-dashbox { fill: none; stroke: #8f979f; stroke-width: 1.2; stroke-dasharray: 5 4 }
  .s-panel { fill: #e9ebe6; stroke: none }
  .s-tp { fill: #fbfbf9; stroke: #1c232b; stroke-width: 1.4 }
  .s-tri { fill: #fbfbf9; stroke: #1c232b; stroke-width: 1.6 }
  .s-sign { fill: #1c232b; font: 600 14px 'IBM Plex Mono', Menlo, monospace }
  .s-jumper { fill: #1c232b; fill-opacity: .12; stroke: #1c232b; stroke-width: 1.4 }
  .plate { fill: none; stroke-width: 2.6; stroke-linecap: butt }
  .fill-pwr { fill: #c23b2a } .fill-sig { fill: #b05a22 } .fill-gnd { fill: #1c232b } .fill-ret { fill: #2f63a3 }
  .t-gnd { fill: #1c232b }
"""


class Sheet(Svg):
    def render(self, standalone=True):
        head = (f'<svg id="{self.id}" viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{self.label}" '
                'xmlns="http://www.w3.org/2000/svg">')
        return (head + f"\n<style>{STANDALONE_STYLE}{EXTRA_STYLE}</style>\n"
                + f'<rect class="bg" x="0" y="0" width="{self.w}" height="{self.h}"/>\n'
                + "\n".join(self.parts) + "\n</svg>\n")


FILL = {"w-pwr": "fill-pwr", "w-sig": "fill-sig", "w-gnd": "fill-gnd", "w-ret": "fill-ret", "w-logic": "dot-logic"}


def wire(pts, cls, dash=False):
    d = "M" + " L".join(f"{x} {y}" for x, y in pts)
    return f'<path class="w {cls}{" dash" if dash else ""}" d="{d}"/>'


def dot(x, y, cls):
    return f'<circle class="{FILL[cls]}" cx="{x}" cy="{y}" r="3.2"/>'


def res_h(x, y, cls, label, w=50, dash=False, below=False):
    """Resistor from (x, y) to (x + w, y), label above (or below)."""
    out = f'<rect class="res {cls}{" dash" if dash else ""}" x="{x}" y="{y - 6}" width="{w}" height="12" rx="1.5"/>'
    return out + text(x + w / 2, y + 22 if below else y - 11, label, "s-sub", "middle")


def res_v(x, y, cls, label, h=50, dash=False, left=False):
    """Resistor from (x, y) down to (x, y + h), label to the right (or left)."""
    out = f'<rect class="res {cls}{" dash" if dash else ""}" x="{x - 6}" y="{y}" width="12" height="{h}" rx="1.5"/>'
    return out + text(x - 12 if left else x + 12, y + h / 2 + 4, label, "s-sub", "end" if left else "start")


def cap_v(x, y0, y1, cls, label, dash=True, left=False):
    """Capacitor between (x, y0) and (x, y1), plates in the middle."""
    m = (y0 + y1) / 2
    out = wire([(x, y0), (x, m - 4)], cls, dash) + wire([(x, m + 4), (x, y1)], cls, dash)
    out += f'<path class="plate {cls}" d="M{x - 11} {m - 4} H{x + 11} M{x - 11} {m + 4} H{x + 11}"/>'
    return out + text(x - 16 if left else x + 16, m + 4, label, "s-sub", "end" if left else "start")


def cap_h(x0, x1, y, cls, label, dash=True):
    """Capacitor between (x0, y) and (x1, y), plates in the middle, label above."""
    m = (x0 + x1) / 2
    out = wire([(x0, y), (m - 4, y)], cls, dash) + wire([(m + 4, y), (x1, y)], cls, dash)
    out += f'<path class="plate {cls}" d="M{m - 4} {y - 11} V{y + 11} M{m + 4} {y - 11} V{y + 11}"/>'
    return out + text(m, y - 16, label, "s-sub", "middle")


def diode_h(x, y, cls, pointing="right", w=40, dash=False):
    """Diode between (x, y) and (x + w, y); the triangle points the way current flows."""
    a, b = (x + w / 2 - 9, x + w / 2 + 9) if pointing == "right" else (x + w / 2 + 9, x + w / 2 - 9)
    out = wire([(x, y), (min(a, b), y)], cls, dash) + wire([(max(a, b), y), (x + w, y)], cls, dash)
    out += f'<polygon class="{FILL[cls]}" points="{a},{y - 9} {a},{y + 9} {b},{y}"/>'
    return out + f'<path class="w {cls}" d="M{b} {y - 9} V{y + 9}"/>'


def diode_v(x, y, cls, pointing="down", h=40, dash=False):
    a, b = (y + h / 2 - 9, y + h / 2 + 9) if pointing == "down" else (y + h / 2 + 9, y + h / 2 - 9)
    out = wire([(x, y), (x, min(a, b))], cls, dash) + wire([(x, max(a, b)), (x, y + h)], cls, dash)
    out += f'<polygon class="{FILL[cls]}" points="{x - 9},{a} {x + 9},{a} {x},{b}"/>'
    return out + f'<path class="w {cls}" d="M{x - 9} {b} H{x + 9}"/>'


def inductor_h(x, y, cls, n=4):
    return f'<path class="w {cls}" d="M{x} {y}' + " a8 8 0 0 1 16 0" * n + '"/>'


def tp(x, y, label, anchor="start", dx=9):
    return (f'<circle class="s-tp" cx="{x}" cy="{y}" r="5"/>'
            + text(x + (dx if anchor == "start" else -dx), y + 4, label, "s-sub", anchor))


def box(x, y, w, h, cls="s-box"):
    return f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="5"/>'


def bracket(x0, x1, y, label):
    return f'<path class="s-bracket" d="M{x0} {y + 6} V{y} H{x1} V{y + 6}"/>' + text(x0, y - 8, label, "s-region")


def bar(s):
    return f'<tspan text-decoration="overline">{s}</tspan>'


def sheet():
    s = Sheet(1440, 1150, "AD5328 module V1.2, reconstructed from photos: a 6-pin logic header and a 100 ohm array "
                          "feed an AD5328 DAC; each of its 8 outputs drives one half of an SGM8272 op-amp wired as "
                          "a difference amplifier with a gain of 4 against the 2.5 V reference, giving plus or minus "
                          "10 V on terminals AO1 to AO8; a TPS61040 boost converter, a charge pump and 78L12/79L12 "
                          "regulators make plus and minus 12 V for the op-amps.", "ad5328-module")
    a = s.add

    a(text(30, 38, "AD5328 module V1.2 (AD5328模块 V1.2) · schematic reconstructed from photos", "s-head"))
    a(text(30, 60, "Solid: read from the board (silkscreen, part codes, IC markings) or from the parts' data sheets, "
                   "or the only way those parts can work together.", "s-sub"))
    a(text(30, 76, "Dashed: inferred from where the parts sit; the traces are not visible. Check with a meter "
                   "before relying on it.", "s-sub"))
    a('<path class="w w-sig" d="M1130 40 H1180"/>')
    a(text(1190, 44, "seen or from a data sheet", "s-sub"))
    a('<path class="w w-sig dash" d="M1130 62 H1180"/>')
    a(text(1190, 66, "inferred", "s-sub"))

    # ---------------- Logic input and DAC ----------------
    a(bracket(30, 690, 108, "LOGIC INPUT AND DAC"))
    a(box(40, 130, 120, 190))
    a(text(100, 151, "H1 · logic header", "s-title", "middle"))
    for y, num, name in ((170, 6, "5V"), (195, 5, "GND"), (220, 4, "CLK"), (245, 3, "DIN"), (270, 2, "SYNC"),
                         (295, 1, "LDAC")):
        a(text(50, y + 4, str(num), "s-sub"))
        a(text(152, y + 4, name, "s-txt", "end"))
    a(text(100, 314, "pin 1 = square pad", "s-sub", "middle"))
    a(wire([(160, 170), (190, 170)], "w-pwr") + text(196, 174, "+5V", "s-sub t-pwr"))
    a(wire([(160, 195), (190, 195)], "w-gnd") + text(196, 199, "GND", "s-sub t-gnd"))

    a(box(40, 340, 120, 72))
    a(text(100, 360, "Screw terminal", "s-title", "middle"))
    a(text(152, 381, "5V", "s-txt", "end") + text(152, 403, "GND", "s-txt", "end"))
    a(wire([(160, 377), (190, 377)], "w-pwr") + text(196, 381, "+5V", "s-sub t-pwr"))
    a(wire([(160, 399), (190, 399)], "w-gnd") + text(196, 403, "GND", "s-sub t-gnd"))
    a(text(40, 432, "Same 5 V as H1 pin 6: feed one of the two.", "s-sub"))

    # RN1 on the four logic lines, into U6
    for y in (220, 245, 270, 295):
        a(wire([(160, y), (230, y)], "w-logic") + wire([(280, y), (360, y)], "w-logic"))
        a(f'<rect class="res w-logic" x="230" y="{y - 6}" width="50" height="12" rx="1.5"/>')
    a(text(255, 320, "RN1 · 4 × 100 Ω (101)", "s-sub", "middle"))

    ux, uy, uw, uh = 400, 130, 210, 360
    a(box(ux, uy, uw, uh))
    a(text(ux + uw / 2, 152, "U6 · AD5328BRU", "s-title", "middle"))
    a(text(ux + uw / 2, 168, "8 × 12-bit DAC · TSSOP-16", "s-sub", "middle"))
    left = ((190, 3, "VDD"), (220, 16, "SCLK"), (245, 15, "DIN"), (270, 2, bar("SYNC")), (295, 1, bar("LDAC")),
            (400, 8, "VREFABCD"), (425, 9, "VREFEFGH"), (460, 14, "GND"))
    for y, num, name in left:
        cls = "w-pwr" if num == 3 else "w-gnd" if num == 14 else "w-ret" if num in (8, 9) else "w-logic"
        a(wire([(360, y), (ux, y)], cls) + text(380, y - 5, str(num), "s-sub", "middle"))
        a(text(ux + 8, y + 4, name, "s-txt"))
    a(wire([(330, 190), (360, 190)], "w-pwr") + text(326, 194, "+5V", "s-sub t-pwr", "end"))
    a(gnd(360, 460))
    right = ((190, 4, "VOUTA", 1), (215, 5, "VOUTB", 2), (240, 6, "VOUTC", 3), (265, 7, "VOUTD", 4),
             (330, 10, "VOUTE", 5), (355, 11, "VOUTF", 6), (380, 12, "VOUTG", 7), (405, 13, "VOUTH", 8))
    for y, num, name, ch in right:
        a(wire([(ux + uw, y), (ux + uw + 40, y)], "w-sig") + text(ux + uw + 20, y - 5, str(num), "s-sub", "middle"))
        a(text(ux + uw - 8, y + 4, name, "s-txt", "end"))
        a(text(ux + uw + 46, y + 4, f"→ AO{ch}", "s-sub t-sig"))
    a(text(ux, 512, "Each output drives one stage (right): A → AO1 … H → AO8.", "s-sub"))
    a(text(ux, 527, "The order is presumed, not traced.", "s-sub"))

    # VREF: pins 8 and 9 together, R51 (0 Ω) to the VREF pad and the jumper
    a(wire([(360, 400), (360, 425)], "w-ret") + dot(360, 412, "w-ret"))
    a(wire([(340, 412), (360, 412)], "w-ret", dash=True) + wire([(260, 412), (290, 412)], "w-ret", dash=True))
    a(res_h(290, 412, "w-ret", "R51 · 0 Ω", dash=True))
    a(dot(260, 412, "w-ret") + wire([(260, 412), (260, 640)], "w-ret"))
    a(dot(260, 440, "w-ret") + wire([(260, 440), (285, 440)], "w-ret") + tp(290, 440, "VREF pad"))
    a(text(268, 480, "VREF", "s-sub t-ret") + text(268, 495, "→ 3 kΩ of", "s-sub t-ret")
      + text(268, 510, "every stage", "s-sub t-ret"))

    # ---------------- Reference ----------------
    a('<path class="s-bracket" d="M30 566 V560 H248 M272 560 H690 V566"/>' + text(30, 552, "REFERENCE", "s-region"))
    a(box(40, 595, 100, 84))
    a(text(90, 615, "U9", "s-title", "middle") + text(90, 632, "2.5 V ref.", "s-sub", "middle")
      + text(90, 647, "SOT-23,", "s-sub", "middle") + text(90, 662, "unmarked", "s-sub", "middle"))
    a(wire([(90, 595), (90, 580)], "w-pwr", dash=True) + text(90, 574, "+5V (via R49?)", "s-sub t-pwr", "middle"))
    a(wire([(90, 679), (90, 690)], "w-gnd", dash=True) + gnd(90, 690))
    jx = 205
    a(wire([(140, 610), (jx - 6, 610)], "w-ret"))
    a(f'<rect class="s-jumper" x="{jx - 12}" y="598" width="24" height="54" rx="9"/>')
    for y in (610, 640, 670):
        a(f'<circle class="s-tp" cx="{jx}" cy="{y}" r="5"/>')
    a(text(jx - 40, 604, "2V5", "s-sub t-ret", "middle"))
    a(text(jx + 18, 606, "1", "s-sub") + text(jx + 18, 636, "2 EX", "s-sub") + text(jx + 18, 666, "3", "s-sub"))
    a(wire([(jx + 5, 640), (260, 640)], "w-ret") + dot(260, 640, "w-ret"))
    a(wire([(jx + 5, 670), (240, 670), (240, 680)], "w-gnd") + gnd(240, 680))
    a(text(jx, 718, "Reference jumper (基准源)", "s-sub", "middle"))
    notes_ref = [
        "Jumper on 1-2 (as drawn): the onboard 2.5 V is VREF, the normal",
        "setting. Jumper off: an external reference goes into pin 2 (EX),",
        "and the output range scales with it (±4 · VREF at DAC gain ×2).",
        "Never bridge 2-3: it shorts VREF to ground (with 1-2 also fitted,",
        "U9's output too). U9's part number is not visible; R49 100 Ω (01A),",
        "R50 0 Ω and C36-C38 sit beside it, their wiring is not visible.",
    ]
    for i, line in enumerate(notes_ref):
        a(text(300, 604 + 17 * i, line, "s-sub"))

    # ---------------- Output stage ----------------
    a(bracket(720, 1410, 108, "OUTPUT STAGE · ONE OF EIGHT"))
    a(text(730, 128, "Eight copies, two per dual op-amp (U4, U5, U7, U8). Resistor codes as printed on every "
                     "stage.", "s-sub"))
    yv, yd, yo = 250, 300, 275  # VREF input, DAC input, op-amp output
    ox = 960
    a(text(735, yv - 8, "VREF", "s-sub t-ret"))
    a(wire([(735, yv), (800, yv)], "w-ret", dash=True) + res_h(800, yv, "w-ret", "3 kΩ · 302"))
    a(wire([(850, yv), (ox, yv)], "w-sig") + dot(890, yv, "w-sig"))
    a(text(735, yd - 8, "VOUTx (U6)", "s-sub t-sig"))
    a(wire([(735, yd), (800, yd)], "w-sig", dash=True) + res_h(800, yd, "w-sig", "30 kΩ · 303", below=True))
    a(wire([(850, yd), (ox, yd)], "w-sig") + dot(890, yd, "w-sig") + dot(925, yd, "w-sig"))
    a(wire([(890, yd), (890, 340)], "w-sig") + res_v(890, 340, "w-sig", "120 kΩ · 124", left=True))
    a(wire([(890, 390), (890, 405)], "w-gnd") + gnd(890, 405))
    a(cap_v(925, yd, 405, "w-sig", "C") + gnd(925, 405))
    # op-amp
    a(f'<polygon class="s-tri" points="{ox},{yo - 60} {ox},{yo + 60} {ox + 100},{yo}"/>')
    a(text(ox + 8, yv + 5, "−", "s-sign") + text(ox + 8, yd + 5, "+", "s-sign"))
    a(wire([(1000, yo - 36), (1000, 224)], "w-pwr") + text(1006, 228, "+12 V (pin 8)", "s-sub t-pwr"))
    a(wire([(1000, yo + 36), (1000, 326)], "w-pwr") + text(1006, 334, "−12 V (pin 4)", "s-sub t-pwr"))
    a(text(1010, 378, "½ SGM8272", "s-title", "middle"))
    a(text(1010, 394, "A: + 3, − 2, out 1", "s-sub", "middle") + text(1010, 409, "B: + 5, − 6, out 7", "s-sub",
                                                                         "middle"))
    # feedback: 12 kΩ, with a capacitor across it
    a(wire([(890, yv), (890, 175), (970, 175)], "w-sig") + res_h(970, 175, "w-sig", "12 kΩ · 123", below=True))
    a(wire([(1020, 175), (1100, 175), (1100, yo)], "w-sig") + dot(1100, yo, "w-sig"))
    a(wire([(920, 175), (920, 160)], "w-sig", dash=True) + wire([(1070, 160), (1070, 175)], "w-sig", dash=True))
    a(cap_h(920, 1070, 160, "w-sig", "C"))
    a(dot(920, 175, "w-sig") + dot(1070, 175, "w-sig"))
    # output: 0 Ω to the terminal, an unfitted capacitor to ground
    a(wire([(ox + 100, yo), (1130, yo)], "w-sig") + res_h(1130, yo, "w-sig", "0 Ω"))
    a(wire([(1180, yo), (1290, yo)], "w-sig") + dot(1220, yo, "w-sig"))
    a(cap_v(1220, yo, 345, "w-sig", "C, not fitted", left=True) + gnd(1220, 345))
    a('<rect class="s-term" x="1290" y="255" width="40" height="40" rx="3"/>')
    a(f'<circle class="s-term" cx="1310" cy="{yo}" r="6"/>')
    a(text(1340, yo + 4, "AOx", "s-title"))
    a(text(1290, 316, "CN1, 10 screws:", "s-sub"))
    a(text(1290, 331, "GND, AO1 … AO8, GND", "s-sub"))

    panel_y = 430
    a(f'<rect class="s-panel" x="730" y="{panel_y}" width="670" height="118" rx="6"/>')
    a(text(744, panel_y + 24, "AOx = 4 · (VOUTx − VREF) = 4 · VOUTx − 10 V", "s-title"))
    a(text(744, panel_y + 42, "Both pairs are 1 : 4 (3 k : 12 k and 30 k : 120 k): a difference amplifier with a "
                              "gain of 4.", "s-sub"))
    rows = (("code 0x000", "0 V", "−10 V", "the DAC's power-on state"), ("code 0x800", "2.5 V", "0 V", ""),
            ("code 0xFFF", "4.999 V", "+9.995 V", "(DAC gain ×2, VREF 2.5 V)"))
    for i, (c, v, o, note) in enumerate(rows):
        y = panel_y + 62 + 16 * i
        a(text(744, y, c, "s-txt") + text(850, y, f"→ VOUTx {v}", "s-txt") + text(1000, y, f"→ AOx {o}", "s-txt"))
        a(text(1110, y, note, "s-sub"))
    a(text(744, panel_y + 110, "If the DAC drives the 3 kΩ side instead, the sign flips: AOx = 10 V − 4 · VOUTx "
                               "(see the meter check below).", "s-sub"))

    # ---------------- Notes ----------------
    a(bracket(720, 1410, 590, "WHAT IS READ, WHAT IS INFERRED"))
    notes = [
        ("Read:", "connectors, silkscreen, test pads, IC markings and every resistor code: 302 = 3 kΩ,"),
        ("", "123 = 12 kΩ, 303 = 30 kΩ, 124 = 120 kΩ, 101 = 100 Ω, 563 = 56 kΩ, 125 = 1.2 MΩ; EIA-96:"),
        ("", "01A = 100 Ω, 01D = 100 kΩ, 30B = 2 kΩ. U2's marking PHOI = TI TPS61040 (SOT-23-5)."),
        ("Pin numbers:", "from the data sheets: AD5328 (ADI Rev. F), SGM8272 (SGMICRO), TPS61040 (TI SLVS413L)."),
        ("Not visible:", "the part numbers of U9, Q1 and D2, all capacitor values, the traces under the parts."),
        ("Meter check:", "power off, continuity from U6 pin 4 (VOUTA) to AO1's resistors: a 30 kΩ (303) means"),
        ("", "the drawing is right, a 3 kΩ (302) that the sign is flipped. The power-on reading agrees:"),
        ("", "about −10 V on every AO as drawn, +10 V if flipped (CALIBRATION.md §1, step 3)."),
    ]
    for i, (head, body) in enumerate(notes):
        y = 618 + 19 * i
        if head:
            a(text(730, y, head, "s-txt"))
        a(text(838, y, body, "s-sub"))

    # ---------------- Supply ----------------
    a(bracket(30, 1410, 790, "SUPPLY · 5 V IN, ±12 V FOR THE OP-AMPS"))
    ry = 830
    a(text(40, ry - 10, "5 V in (screw terminal, H1 pin 6)", "s-sub t-pwr"))
    a(wire([(40, ry), (760, ry)], "w-pwr"))
    a(tp(240, ry - 18, "5V pad") + wire([(240, ry - 13), (240, ry)], "w-pwr") + dot(240, ry, "w-pwr"))
    a('<rect class="s-dashbox" x="40" y="850" width="170" height="74" rx="5"/>')
    for i, line in enumerate(("Q1 (SOT-23, unmarked),", "R1 2 kΩ (30B), R2 56 kΩ", "(563): at the 5 V input,",
                              "function not visible")):
        a(text(50, 868 + 15 * i, line, "s-sub"))
    # power LED and bulk capacitors
    a(dot(290, ry, "w-pwr") + wire([(290, ry), (290, 850)], "w-pwr", dash=True))
    a(res_v(290, 850, "w-pwr", "R3 · 2 kΩ (30B)", dash=True))
    a(wire([(290, 900), (290, 910)], "w-pwr", dash=True) + diode_v(290, 910, "w-pwr", dash=True))
    a(text(302, 934, "LED1", "s-sub") + wire([(290, 950), (290, 958)], "w-gnd", dash=True) + gnd(290, 958))
    a(dot(420, ry, "w-pwr") + cap_v(420, ry, 900, "w-pwr", "C1, C2 (bulk)") + gnd(420, 900))
    a('<rect class="s-dashbox" x="40" y="1000" width="440" height="58" rx="5"/>')
    a(text(50, 1018, "L1, R6 (0 Ω), C14 and C15 sit by the 5V pad and U4: probably a filter on the", "s-sub"))
    a(text(50, 1033, "5 V of the DAC or the op-amps. Not traced. The AD5328 takes 2.5 V to 5.5 V,", "s-sub"))
    a(text(50, 1048, "so the module's 5 V must stay at or below 5.5 V.", "s-sub"))

    # TPS61040 boost to about 16 V
    bx, by, bw, bh = 660, 860, 160, 110
    a(box(bx, by, bw, bh))
    a(text(bx + bw / 2, 912, "U2 · TPS61040", "s-title", "middle"))
    a(text(bx + bw / 2, 928, "marking PHOI · SOT-23-5", "s-sub", "middle"))
    a(dot(640, ry, "w-pwr") + wire([(640, ry), (640, 880), (bx, 880)], "w-pwr") + text(bx + 6, 884, "VIN 5", "s-sub"))
    a(dot(640, 880, "w-pwr") + wire([(640, 880), (640, 950), (bx, 950)], "w-pwr", dash=True))
    a(text(bx + 6, 954, "EN 4", "s-sub") + text(634, 966, "EN tied to VIN?", "s-sub", "end"))
    a(dot(600, ry, "w-pwr") + cap_v(600, ry, 900, "w-pwr", "C9", left=True) + gnd(600, 900))
    a(wire([(bx + bw / 2, by + bh), (bx + bw / 2, 980)], "w-gnd") + gnd(bx + bw / 2, 980))
    a(text(bx + bw / 2 + 6, 964, "GND 2", "s-sub"))
    a(inductor_h(760, ry, "w-pwr") + text(792, ry - 14, "L2", "s-sub", "middle"))
    sw = 840
    a(wire([(824, ry), (sw, ry)], "w-pwr") + dot(sw, ry, "w-pwr"))
    a(wire([(bx + bw, 880), (sw, 880), (sw, ry)], "w-pwr") + text(bx + bw - 6, 884, "SW 1", "s-sub", "end"))
    a(dot(sw, 880, "w-pwr") + diode_h(sw, ry, "w-pwr") + text(sw + 20, ry - 14, "D1", "s-sub", "middle"))
    vb = 970
    a(wire([(sw + 40, ry), (1150, ry)], "w-pwr") + dot(vb, ry, "w-pwr") + text(vb + 4, ry - 14, "≈ 16 V", "s-sub t-pwr"))
    a(wire([(vb, ry), (vb, 850)], "w-pwr") + res_v(vb, 850, "w-pwr", "R5 · 1.2 MΩ (125)", left=True))
    a(wire([(vb, 900), (vb, 960)], "w-pwr") + dot(vb, 950, "w-pwr"))
    a(wire([(bx + bw, 950), (vb, 950)], "w-pwr") + text(bx + bw - 6, 954, "FB 3", "s-sub", "end"))
    a(res_v(vb, 960, "w-pwr", "R4 · 100 kΩ (01D)", left=True) + wire([(vb, 1010), (vb, 1020)], "w-gnd")
      + gnd(vb, 1020))
    a(text(990, 1012, "1.233 V · (1 + 1.2 MΩ / 100 kΩ) = 16.0 V", "s-sub t-pwr"))
    a(dot(1005, ry, "w-pwr") + cap_v(1005, ry, 950, "w-pwr", "C3") + wire([(vb, 950), (1005, 950)], "w-pwr", dash=True))
    a(dot(1060, ry, "w-pwr") + cap_v(1060, ry, 900, "w-pwr", "C4, C6-C8") + gnd(1060, 900))
    # +12 V
    a(box(1150, 806, 100, 48))
    a(text(1200, 826, "78L12", "s-title", "middle") + text(1200, 842, "SOT-89", "s-sub", "middle"))
    a(wire([(1200, 854), (1200, 864)], "w-gnd") + gnd(1200, 864))
    a(wire([(1250, ry), (1330, ry)], "w-pwr") + dot(1275, ry, "w-pwr") + dot(1300, ry, "w-pwr"))
    a(tp(1275, ry - 18, "12V pad") + wire([(1275, ry - 13), (1275, ry)], "w-pwr"))
    a(cap_v(1300, ry, 900, "w-pwr", "C11, C12") + gnd(1300, 900))
    a(text(1336, ry + 5, "+12 V", "s-title t-pwr"))
    # charge pump to the negative side (as in TI's Figure 7-7), then -12 V
    py = 1070
    a(wire([(sw, 880), (sw, py), (850, py)], "w-pwr", dash=True))
    a(cap_h(850, 900, py, "w-pwr", "C (pump)"))
    xp = 920
    a(wire([(900, py), (xp, py)], "w-pwr", dash=True) + dot(xp, py, "w-pwr"))
    a(diode_v(xp, py, "w-pwr", "down", 40, dash=True) + gnd(xp, py + 40))
    a(text(908, py + 30, "D2: SOT-23, two", "s-sub", "end") + text(908, py + 45, "diodes, unmarked", "s-sub", "end"))
    a(diode_h(xp, py, "w-pwr", "left", 60, dash=True))
    a(wire([(xp + 60, py), (1150, py)], "w-pwr", dash=True) + text(xp + 84, py - 14, "≈ −15 V", "s-sub t-pwr"))
    a(dot(1060, py, "w-pwr") + cap_v(1060, py, py + 50, "w-pwr", "C17, C18") + gnd(1060, py + 50))
    a(box(1150, py - 24, 100, 48))
    a(text(1200, py - 4, "U3 · 79L12", "s-title", "middle") + text(1200, py + 12, "SOT-89", "s-sub", "middle"))
    a(wire([(1200, py + 24), (1200, py + 34)], "w-gnd") + gnd(1200, py + 34))
    a(wire([(1250, py), (1330, py)], "w-pwr") + dot(1275, py, "w-pwr") + dot(1300, py, "w-pwr"))
    a(tp(1275, py - 18, "−12V pad") + wire([(1275, py - 13), (1275, py)], "w-pwr"))
    a(cap_v(1300, py, py + 50, "w-pwr", "C13, C16") + gnd(1300, py + 50))
    a(text(1336, py + 5, "−12 V", "s-title t-pwr"))
    return s


def main():
    with open(OUT, "w") as fh:
        fh.write(sheet().render())
    print("wrote", OUT)


if __name__ == "__main__":
    main()
