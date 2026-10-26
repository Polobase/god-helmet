#!/usr/bin/env python3
"""Generate Koren-style point tables (0..255, 128 = zero field) for the firmware.

The Persinger/Koren lab drove its coils from lists of numbers held for a fixed
point duration. Their files were never published; these generators follow the
published descriptions and the firmware's built-in patterns (lib/engine), so a
table can be edited by hand and uploaded (Targets tab -> Point tables).

    python3 tools/make_table.py burst > burst.csv
    python3 tools/make_table.py thomas --point-ms 3 -o thomas.csv
    python3 tools/make_table.py chirp --f0 4 --f1 40 --sweep-ms 2000 --plot
"""
import argparse
import math
import random
import sys

DEFAULTS = {
    #           f0    f1   sweep_ms gap_ms point_ms
    "burst":   (6.0, 30.0, 1500.0, 4000.0, 3.0),
    "thomas":  (25.0, 6.0, 2500.0, 1000.0, 3.0),
    "chirp":   (4.0, 40.0, 2000.0, 0.0, 1.0),
    "sine":    (7.0, 7.0, 1000.0, 0.0, 1.0),
    "semirandom": (0.0, 0.0, 2000.0, 0.0, 3.0),
}
MAX_POINTS = 8192


def sweep(f0, f1, window_s, t_s):
    """Linear FM sweep, same formula as engine::patternValue."""
    cycles = f0 * t_s + (f1 - f0) * t_s * t_s / (2 * window_s)
    return math.sin(2 * math.pi * (cycles - math.floor(cycles)))


def generate(kind, f0, f1, sweep_ms, gap_ms, point_ms, seed=1):
    n_active = int(round(sweep_ms / point_ms))
    n_gap = int(round(gap_ms / point_ms))
    rng = random.Random(seed)
    values = []
    for i in range(n_active):
        t = i * point_ms / 1000.0
        if kind == "sine":
            v = math.sin(2 * math.pi * f0 * t)
        elif kind == "semirandom":
            v = rng.uniform(-1, 1)
        else:
            v = sweep(f0, f1, sweep_ms / 1000.0, t)
        values.append(v)
    values += [0.0] * n_gap
    return values


def to_bytes(values):
    return [max(0, min(255, int(round(128 + 127 * v)))) for v in values]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=sorted(DEFAULTS))
    ap.add_argument("--f0", type=float)
    ap.add_argument("--f1", type=float)
    ap.add_argument("--sweep-ms", type=float, help="active window length")
    ap.add_argument("--gap-ms", type=float, help="silence after the window")
    ap.add_argument("--point-ms", type=float, help="point duration (use the same value in the preset)")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("-o", "--output", help="output file (default stdout)")
    ap.add_argument("--plot", action="store_true", help="print a coarse text plot to stderr")
    args = ap.parse_args()

    f0, f1, sweep_ms, gap_ms, point_ms = DEFAULTS[args.kind]
    f0 = args.f0 if args.f0 is not None else f0
    f1 = args.f1 if args.f1 is not None else f1
    sweep_ms = args.sweep_ms if args.sweep_ms is not None else sweep_ms
    gap_ms = args.gap_ms if args.gap_ms is not None else gap_ms
    point_ms = args.point_ms if args.point_ms is not None else point_ms

    data = to_bytes(generate(args.kind, f0, f1, sweep_ms, gap_ms, point_ms, args.seed))
    if len(data) > MAX_POINTS:
        sys.exit(f"{len(data)} points > {MAX_POINTS}: shorten the window/gap or raise --point-ms")

    header = (f"# {args.kind}: f0={f0} Hz f1={f1} Hz window={sweep_ms} ms gap={gap_ms} ms "
              f"point={point_ms} ms ({len(data)} points)\n"
              f"# preset: \"table\": \"<name>.csv\", pattern {{\"type\": \"table\", \"pointMs\": {point_ms}}}\n")
    text = header + "\n".join(str(v) for v in data) + "\n"
    if args.output:
        with open(args.output, "w") as f:
            f.write(text)
    else:
        sys.stdout.write(text)

    if args.plot:
        step = max(1, len(data) // 100)
        for i in range(0, len(data), step):
            col = int((data[i] / 255) * 60)
            sys.stderr.write(f"{i * point_ms:8.0f} ms |" + " " * col + "*\n")


if __name__ == "__main__":
    main()
