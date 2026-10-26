#!/usr/bin/env python3
"""Generate the wiring schematic and the coil-lead drawing as SVG.

    python3 hardware/make_schematic.py            # writes docs/schematic.svg, docs/coil-leads.svg
    python3 hardware/make_schematic.py --inline   # prints both <svg> fragments (class-styled) for HTML pages

Standalone files carry their own light-theme <style>; the inline fragments are
styled by the page that embeds them (classes s-*, w-*).
"""
import argparse
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")

# Physical order of the module's output terminal, top to bottom: GND, AO8..AO1, GND.
CHANNELS = [8, 7, 6, 5, 4, 3, 2, 1]
Y0, DY = 110, 36  # y of AO8, spacing


def ch_y(i):
    return Y0 + DY * i


STANDALONE_STYLE = """
  .bg { fill: #f3f4f1 }
  .s-box { fill: #fbfbf9; stroke: #1c232b; stroke-width: 1.5 }
  .s-term { fill: #e4e6e1; stroke: #1c232b; stroke-width: 1 }
  .s-title { fill: #1c232b; font: 600 15px 'Barlow Condensed', 'Arial Narrow', sans-serif; letter-spacing: .04em }
  .s-txt { fill: #1c232b; font: 12px 'IBM Plex Mono', Menlo, monospace }
  .s-sub { fill: #5d6670; font: 11px 'IBM Plex Sans', Helvetica, sans-serif }
  .s-region { fill: #5d6670; font: 600 11px 'IBM Plex Sans', Helvetica, sans-serif; letter-spacing: .12em }
  .s-bracket { stroke: #c9cdc6; stroke-width: 1.5; fill: none }
  .s-sheath { fill: none; stroke: #8f979f; stroke-width: 1.2; stroke-dasharray: 4 3 }
  .w { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round }
  .w-pwr { stroke: #c23b2a } .w-gnd { stroke: #1c232b } .w-logic { stroke: #23806e }
  .w-sig { stroke: #b05a22 } .w-ret { stroke: #2f63a3 }
  .t-sig { fill: #b05a22 } .t-ret { fill: #2f63a3 } .t-pwr { fill: #c23b2a } .t-logic { fill: #23806e }
  .dot-ret { fill: #2f63a3 } .dot-logic { fill: #23806e }
  .res { fill: #fbfbf9; stroke-width: 1.6 }
  .coil-body { fill: #d9a77e; stroke: #8a4517; stroke-width: 1.2 }
  .coil-top { fill: #e8c09d; stroke: #8a4517; stroke-width: 1.2 }
  .coil-wind { fill: none; stroke: #8a4517; stroke-width: .8; opacity: .55 }
  .core { fill: #b9bdc2; stroke: #6d737a; stroke-width: 1 }
  .core-hole { fill: #4b5158 }
  .arrow { fill: #1c232b }
"""


class Svg:
    def __init__(self, w, h, label, ident):
        self.w, self.h, self.label, self.id = w, h, label, ident
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def render(self, standalone):
        head = (f'<svg id="{self.id}" viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{self.label}"'
                + (' xmlns="http://www.w3.org/2000/svg"' if standalone else '') + '>')
        body = "\n".join(self.parts)
        if standalone:
            return (head + f"\n<style>{STANDALONE_STYLE}</style>\n"
                    + f'<rect class="bg" x="0" y="0" width="{self.w}" height="{self.h}"/>\n' + body + "\n</svg>\n")
        return head + "\n" + body + "\n</svg>"


def text(x, y, s, cls="s-txt", anchor="start"):
    return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{s}</text>'


def gnd(x, y, cls="w-gnd"):
    """Ground symbol hanging below (x, y)."""
    return (f'<path class="w {cls}" d="M{x} {y} V{y + 12} M{x - 10} {y + 12} H{x + 10} '
            f'M{x - 6} {y + 16} H{x + 6} M{x - 2.5} {y + 20} H{x + 2.5}"/>')


def resistor_h(x, y, cls, label=None, w=60):
    out = f'<rect class="res {cls}" x="{x}" y="{y - 5}" width="{w}" height="10" rx="1.5" style="stroke-width:1.6"/>'
    if label:
        out += text(x + w / 2, y - 9, label, "s-sub", "middle")
    return out


def coil_symbol(x, y, cls="w-sig"):
    d = f"M{x} {y}" + " a8 8 0 0 1 16 0" * 4
    return f'<path class="w {cls}" d="{d}"/>'


def schematic():
    s = Svg(1130, 690, "Wiring schematic: ESP32 drives the AD5328 module over SPI; each of the 8 outputs feeds a "
                       "coil through a 2.2 kilo-ohm resistor; all coil returns join at the control box and reach "
                       "ground through the PhotoMOS arming switch.", "schematic")
    a = s.add

    # Region labels
    for x0, x1, label in ((230, 880, "CONTROL BOX"), (893, 975, "2 × CAT5E"), (990, 1110, "HEADBAND")):
        a(f'<path class="s-bracket" d="M{x0} 36 V30 H{x1} V36"/>')
        a(text((x0 + x1) / 2, 22, label, "s-region", "middle"))

    # Power bank
    a('<rect class="s-box" x="30" y="66" width="140" height="48" rx="6"/>')
    a(text(100, 87, "Power bank", "s-title", "middle"))
    a(text(100, 104, "5 V USB, ≥ 2 A", "s-sub", "middle"))
    a('<path class="w w-pwr" d="M170 90 H230"/>')
    a(text(200, 82, "USB", "s-sub", "middle"))

    # ESP32
    a('<rect class="s-box" x="230" y="44" width="200" height="390" rx="6"/>')
    a(text(330, 66, "ESP32-S3 DevKitC-1", "s-title", "middle"))
    a(text(240, 94, "USB", "s-txt"))
    pins_r = [(90, "5V"), (120, "GND"), (170, "GPIO12 SCK"), (200, "GPIO11 MOSI"), (230, "GPIO10 CS"),
              (260, "GPIO9"), (360, "GPIO4")]
    for y, lab in pins_r:
        a(text(420, y + 4, lab, "s-txt", "end"))
    a(text(240, 404, "GPIO5", "s-txt"))
    a(text(330, 310, "Bluetooth LE → web app", "s-sub", "middle"))
    a(text(330, 326, "2 kHz output engine", "s-sub", "middle"))

    # AD5328 module
    a('<rect class="s-box" x="560" y="44" width="200" height="390" rx="6"/>')
    a(text(640, 66, "AD5328 module", "s-title", "middle"))
    for y, lab in ((90, "5V"), (120, "GND"), (170, "CLK"), (200, "DIN"), (230, "SYNC"), (260, "LDAC")):
        a(text(570, y + 4, lab, "s-txt"))
    a(text(632, 306, "8 × 12-bit DAC", "s-sub", "middle"))
    a(text(632, 322, "op-amps ±10 V", "s-sub", "middle"))
    a(text(632, 338, "REF jumper 1-2", "s-sub", "middle"))
    a('<rect class="s-term" x="744" y="58" width="16" height="356" rx="2"/>')
    a(text(738, 78, "GND", "s-txt", "end"))
    a(text(738, 402, "GND", "s-txt", "end"))
    for i, ch in enumerate(CHANNELS):
        a(text(738, ch_y(i) + 4, f"AO{ch}", "s-txt", "end"))
    for y in [74] + [ch_y(i) for i in range(8)] + [398]:
        a(f'<circle class="s-term" cx="752" cy="{y}" r="4.5"/>')

    # ESP32 <-> module
    a('<path class="w w-pwr" d="M430 90 H560"/>')
    a('<path class="w w-gnd" d="M430 120 H560"/>')
    for y in (170, 200, 230, 260):
        a(f'<path class="w w-logic" d="M430 {y} H560"/>')
    a(text(495, 156, "SPI 20 MHz, mode 1", "s-sub t-logic", "middle"))
    a(text(495, 280, "LDAC pulse:", "s-sub", "middle"))
    a(text(495, 294, "all 8 update", "s-sub", "middle"))
    a(text(495, 84, "5 V", "s-sub t-pwr", "middle"))

    # Module output GND (return reference)
    a('<path class="w w-gnd" d="M760 398 H782"/>')
    a(gnd(782, 398))

    # Channels: AO -> 2.2k -> cable -> coil (S ... E) -> back in the same pair -> return bus
    bus_x = 870
    for i, ch in enumerate(CHANNELS):
        y = ch_y(i)
        yr = y + 10
        a(f'<path class="w w-sig" d="M760 {y} H790 M850 {y} H1000"/>')
        a(resistor_h(790, y, "w-sig", "2.2 kΩ"))
        a(coil_symbol(1000, y))
        a(f'<path class="w w-ret" d="M1064 {y} H1080 V{yr} H{bus_x}"/>')
        a(f'<circle class="dot-ret" cx="{bus_x}" cy="{yr}" r="3.2"/>')
        a(text(1092, y + 4, f"CH{ch}", "s-txt"))
    a(text(1003, Y0 - 12, "S", "s-sub t-sig", "middle"))
    a(text(1061, Y0 - 12, "E", "s-sub t-ret", "middle"))

    # Return bus with line jumps where it crosses the signal wires
    d = f"M{bus_x} {Y0 + 10}"
    for i in range(1, 8):
        y = ch_y(i)
        d += f" V{y - 5} A5 5 0 0 1 {bus_x} {y + 5}"
    d += " V540"
    a(f'<path class="w w-ret" d="{d}"/>')

    # Cable sheaths
    a(f'<rect class="s-sheath" x="893" y="98" width="82" height="140" rx="10"/>')
    a(f'<rect class="s-sheath" x="893" y="244" width="82" height="140" rx="10"/>')
    a(text(934, 92, "Cat5e #2", "s-sub", "middle"))
    a(text(934, 398, "Cat5e #1", "s-sub", "middle"))

    # PhotoMOS arming switch
    a('<rect class="s-box" x="845" y="540" width="140" height="70" rx="6"/>')
    a(text(915, 568, "AQY212EH", "s-title", "middle"))
    a(text(915, 584, "PhotoMOS · arming", "s-sub", "middle"))
    a(text(878, 553, "4", "s-sub"))
    a(text(976, 579, "3", "s-sub", "end"))
    a(text(878, 605, "1", "s-sub"))
    a(text(958, 605, "2", "s-sub"))
    a('<path class="w w-gnd" d="M985 575 H1010"/>')
    a(gnd(1010, 575))
    a(text(1024, 594, "module GND", "s-sub"))
    a('<path class="w w-gnd" d="M950 610 V626"/>')
    a(gnd(950, 626))

    # GPIO26 -> 330R -> LED anode, 10k pull-down
    a('<path class="w w-logic" d="M430 360 H470 V650 H640 M700 650 H870 V610"/>')
    a(resistor_h(640, 650, "w-logic", "330 Ω"))
    a('<circle class="dot-logic" cx="470" cy="600" r="3.2"/>')
    a('<path class="w w-logic" d="M470 600 H420 M360 600 H330"/>')
    a(resistor_h(360, 600, "w-logic", "10 kΩ pull-down"))
    a(gnd(330, 600))

    # STOP button on GPIO27
    a('<path class="w w-logic" d="M230 400 H190 M140 400 H110"/>')
    a('<circle cx="190" cy="400" r="3" class="s-box"/><circle cx="140" cy="400" r="3" class="s-box"/>')
    a('<path class="w w-gnd" d="M136 388 H194 M165 388 V376"/>')
    a(text(165, 368, "STOP", "s-title", "middle"))
    a(gnd(110, 400))

    return s


def coil_leads():
    s = Svg(660, 300, "Coil lead convention: the inner lead that leaves the top face next to the core is the signal "
                      "lead; the outer lead that leaves the outermost winding at the side is the return lead; the "
                      "clean bottom face goes toward the head.", "coil")
    a = s.add
    cx, top, bot, rx, ry = 220, 92, 212, 95, 24
    # body
    a(f'<path class="coil-body" d="M{cx - rx} {top} V{bot} A{rx} {ry} 0 0 0 {cx + rx} {bot} V{top} Z"/>')
    for y in range(top + 8, bot, 7):
        a(f'<path class="coil-wind" d="M{cx - rx} {y} A{rx} {ry} 0 0 0 {cx + rx} {y}"/>')
    a(f'<ellipse class="coil-top" cx="{cx}" cy="{top}" rx="{rx}" ry="{ry}"/>')
    for r in range(34, rx, 8):
        a(f'<ellipse class="coil-wind" cx="{cx}" cy="{top}" rx="{r}" ry="{r * ry / rx:.1f}"/>')
    a(f'<ellipse class="core" cx="{cx}" cy="{top}" rx="26" ry="7.5"/>')
    a(f'<ellipse class="core-hole" cx="{cx}" cy="{top}" rx="8" ry="2.6"/>')

    # inner lead: up from beside the core, then right to its label
    a(f'<path class="w w-sig" d="M{cx + 12} {top - 2} C{cx + 14} {top - 40} {cx + 40} 40 {cx + 90} 40 H380"/>')
    a(f'<circle class="dot-sig t-sig" cx="380" cy="40" r="3.5"/>')
    a(text(392, 36, "Inner lead · centre, beside the core", "s-title"))
    a(text(392, 54, "= SIGNAL: from the 2.2 kΩ resistor", "s-sub t-sig"))
    a(text(392, 70, "Cat5 solid colour (orange, green, blue, brown)", "s-sub"))

    # outer lead: from the outermost winding at the side
    a(f'<path class="w w-ret" d="M{cx + rx - 4} {top + 22} C{cx + rx + 20} {top + 22} 340 136 380 136"/>')
    a(f'<circle class="dot-ret" cx="380" cy="136" r="3.5"/>')
    a(text(392, 132, "Outer lead · outermost winding, side", "s-title"))
    a(text(392, 150, "= RETURN: joined at the box → PhotoMOS → GND", "s-sub t-ret"))
    a(text(392, 166, "Cat5 white-striped wire of the same pair", "s-sub"))

    # head-side arrow
    a(f'<path class="w w-gnd" d="M{cx} {bot + 34} V{bot + 56}"/>')
    a(f'<polygon class="arrow" points="{cx - 6},{bot + 52} {cx + 6},{bot + 52} {cx},{bot + 62}"/>')
    a(text(cx + 16, bot + 50, "Clean bottom face → toward the head", "s-sub"))
    a(text(392, 196, "Both leads: ≈ 4.2 Ω between them.", "s-sub"))
    a(text(392, 212, "Same convention on all 8 coils = same pole", "s-sub"))
    a(text(392, 228, "toward the head. Confirm with a compass.", "s-sub"))
    return s


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inline", action="store_true")
    args = ap.parse_args()
    figs = {"schematic.svg": schematic(), "coil-leads.svg": coil_leads()}
    if args.inline:
        for f in figs.values():
            print(f.render(standalone=False))
        return
    for name, fig in figs.items():
        path = os.path.normpath(os.path.join(DOCS, name))
        with open(path, "w") as fh:
            fh.write(fig.render(standalone=True))
        print("wrote", path)


if __name__ == "__main__":
    main()
