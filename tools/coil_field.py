#!/usr/bin/env python3
"""On-axis magnetic field of a multilayer coil (air-core estimate).

Default geometry: the 19 x 12 mm levitation coil (495 turns, winding from
r = 3.0 mm to 9.5 mm, 12 mm long). A ferrite core raises the field near the
coil, typically x1.5-3, so measure the real value (docs/CALIBRATION.md).

    python3 tools/coil_field.py                      # table for 1 mA and 4.54 mA
    python3 tools/coil_field.py --ma 2 --depth 20    # one value
"""
import argparse
import math

MU0 = 4e-7 * math.pi


def field_tesla(distance_m, current_a, turns=495, r_in=0.003, r_out=0.0095, length=0.012, steps=80):
    """B on the coil axis at `distance_m` in front of the coil face."""
    total = 0.0
    for a in range(steps):
        r = r_in + (a + 0.5) * (r_out - r_in) / steps
        for b in range(steps):
            d = distance_m + (b + 0.5) * length / steps
            total += MU0 * r * r / (2 * (r * r + d * d) ** 1.5)
    return total * turns * current_a / (steps * steps)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ma", type=float, help="coil current in mA (default: table for 1 mA and the 2.2 kOhm cap)")
    ap.add_argument("--depth", type=float, help="distance from the coil face in mm")
    ap.add_argument("--turns", type=int, default=495)
    ap.add_argument("--r-in", type=float, default=3.0, help="inner winding radius, mm")
    ap.add_argument("--r-out", type=float, default=9.5, help="outer winding radius, mm")
    ap.add_argument("--length", type=float, default=12.0, help="winding length, mm")
    ap.add_argument("--series-ohm", type=float, default=2200.0)
    ap.add_argument("--vfs", type=float, default=10.0, help="module full-scale voltage")
    args = ap.parse_args()

    geo = dict(turns=args.turns, r_in=args.r_in / 1000, r_out=args.r_out / 1000, length=args.length / 1000)
    i_max_ma = args.vfs / (args.series_ohm + 4.2) * 1000

    if args.depth is not None:
        ma = args.ma if args.ma is not None else 1.0
        print(f"{field_tesla(args.depth / 1000, ma / 1000, **geo) * 1e6:.3f} uT at {args.depth} mm, {ma} mA")
        return

    print(f"Hardware current cap: {args.vfs} V / ({args.series_ohm:.0f} + 4.2) Ohm = {i_max_ma:.2f} mA\n")
    print(" depth   uT per mA   uT at cap   note")
    notes = {0: "coil face", 5: "scalp (through hair/cap)", 20: "cortex (calibration depth)",
             40: "hippocampus depth", 50: "amygdala depth"}
    for mm in (0, 2, 5, 10, 15, 20, 25, 30, 40, 50):
        per_ma = field_tesla(mm / 1000, 1e-3, **geo) * 1e6
        print(f"{mm:4d} mm  {per_ma:9.3f}  {per_ma * i_max_ma:10.2f}   {notes.get(mm, '')}")
    print("\nEarth's field ~48 uT; ICNIRP 2010 public reference level 200 uT (25-400 Hz).")


if __name__ == "__main__":
    main()
