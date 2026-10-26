#!/usr/bin/env python3
"""Statistics for remote-viewing / telepathy trials exported from the device.

    # app: Experiment -> Export trials (godhelmet-trials.json)
    python3 tools/trial_stats.py godhelmet-trials.json

Only revealed trials count; aborted/unfinished trials are listed so nothing
disappears silently. Reports, per condition (active / sham / none):
  * first-place hits vs chance with an exact Poisson-binomial tail p-value
  * sum-of-ranks z score (positive = better than chance) and its p-value
and, for exploration only, splits by geomagnetic Kp and local sidereal time
(Spottiswoode's 13.5 h LST effect did not replicate in a larger data set).
"""
import argparse
import json
import math


def poisson_binomial_tail(ps, k):
    dist = [1.0]
    for p in ps:
        nxt = [0.0] * (len(dist) + 1)
        for i, v in enumerate(dist):
            nxt[i] += v * (1 - p)
            nxt[i + 1] += v * p
        dist = nxt
    return sum(dist[k:])


def summarise(trials):
    n = len(trials)
    if n == 0:
        return None
    hits = sum(1 for t in trials if t["targetRank"] == 1)
    ps = [1.0 / t["setSize"] for t in trials]
    num = sum((t["setSize"] + 1) / 2 - t["targetRank"] for t in trials)
    den = math.sqrt(sum((t["setSize"] ** 2 - 1) / 12 for t in trials))
    z = num / den if den else 0.0
    return {
        "n": n,
        "hits": hits,
        "expected": sum(ps),
        "p_hits": poisson_binomial_tail(ps, hits),
        "mean_rank": sum(t["targetRank"] for t in trials) / n,
        "z": z,
        "p_z": 0.5 * math.erfc(z / math.sqrt(2)),
    }


def show(label, s):
    if s is None:
        return
    print(f"{label:<22} n={s['n']:<4} hits={s['hits']} (expected {s['expected']:.1f}, p={s['p_hits']:.3f})  "
          f"mean rank={s['mean_rank']:.2f}  z={s['z']:+.2f} (p={s['p_z']:.3f})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trials_json")
    args = ap.parse_args()
    with open(args.trials_json) as f:
        trials = json.load(f)

    revealed = [t for t in trials if t.get("state") == "revealed"]
    other = [t for t in trials if t.get("state") != "revealed"]
    print(f"{len(trials)} trials: {len(revealed)} revealed, {len(other)} not revealed "
          f"({', '.join(sorted({t.get('state', '?') for t in other})) or '-'})\n")

    show("all revealed", summarise(revealed))
    for cond in ("active", "sham", "none"):
        show(f"condition={cond}", summarise([t for t in revealed if t.get("condition") == cond]))

    act = summarise([t for t in revealed if t.get("condition") == "active"])
    sham = summarise([t for t in revealed if t.get("condition") == "sham"])
    if act and sham:
        # Difference in mean standardised rank score, rough z.
        def scores(c):
            return [((t["setSize"] + 1) / 2 - t["targetRank"]) / math.sqrt((t["setSize"] ** 2 - 1) / 12)
                    for t in revealed if t.get("condition") == c]
        a, b = scores("active"), scores("sham")
        diff = sum(a) / len(a) - sum(b) / len(b)
        se = math.sqrt(1 / len(a) + 1 / len(b))
        print(f"\nactive - sham standardised rank score: {diff:+.2f} (z={diff / se:+.2f}, "
              f"two-sided p={math.erfc(abs(diff / se) / math.sqrt(2)):.3f})")

    print("\nExploratory (do not cherry-pick):")
    with_kp = [t for t in revealed if t.get("kpValid")]
    show("Kp < 2 (quiet)", summarise([t for t in with_kp if t["kp"] < 2]))
    show("Kp >= 2", summarise([t for t in with_kp if t["kp"] >= 2]))
    with_lst = [t for t in revealed if t.get("lst", -1) >= 0]
    show("LST 12.5-14.5 h", summarise([t for t in with_lst if 12.5 <= t["lst"] <= 14.5]))
    show("other LST", summarise([t for t in with_lst if not 12.5 <= t["lst"] <= 14.5]))


if __name__ == "__main__":
    main()
