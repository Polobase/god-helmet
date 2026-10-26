#!/usr/bin/env python3
"""Fit uT-per-mA calibration values from DC measurements.

Input CSV (one row per measurement, header required):

    channel,mA,uT_on,uT_off
    1,2.0,49.10,47.62
    1,-2.0,46.15,47.62
    2,2.0,...

channel is 1..8; uT_on/uT_off are the magnetometer readings (same axis,
20 mm in front of the coil face) with the DC test running / stopped. The
slope through the origin is fitted per channel (reversing polarity cancels
drift). Type the printed values into the app (Setup -> Calibration):

    python3 tools/calibrate.py measurements.csv
"""
import argparse
import csv
import json
import sys


def fit(rows):
    by_ch = {}
    for r in rows:
        ch = int(r["channel"])
        if not 1 <= ch <= 8:
            sys.exit(f"channel {ch} out of range 1..8")
        ma = float(r["mA"])
        delta = float(r["uT_on"]) - float(r["uT_off"])
        by_ch.setdefault(ch, []).append((ma, delta))
    result = {}
    for ch, pts in sorted(by_ch.items()):
        sxx = sum(m * m for m, _ in pts)
        sxy = sum(m * d for m, d in pts)
        slope = abs(sxy / sxx) if sxx else 0.0
        resid = [d - (sxy / sxx) * m for m, d in pts] if sxx else []
        rms = (sum(e * e for e in resid) / len(resid)) ** 0.5 if resid else 0.0
        result[ch] = (slope, rms, len(pts))
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--default", type=float, default=0.73, help="value for channels without data")
    args = ap.parse_args()

    with open(args.csv, newline="") as f:
        rows = list(csv.DictReader(f))
    result = fit(rows)
    values = []
    print("channel  uT/mA   rms-residual  n")
    for ch in range(1, 9):
        if ch in result:
            slope, rms, n = result[ch]
            print(f"  CH{ch}   {slope:6.3f}   {rms:8.3f} uT   {n}")
            values.append(round(slope, 4))
        else:
            print(f"  CH{ch}   (no data, using {args.default})")
            values.append(args.default)
    print("\n" + json.dumps({"uTperMA": values, "calibrated": len(result) == 8}))


if __name__ == "__main__":
    main()
