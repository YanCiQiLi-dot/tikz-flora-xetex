# Stem curvature of our plant against the reference trace. Both sets of
# centrelines (tex/reference/curves.json, in rectified pixels; ours from
# analysis/stem_geometry.lua, in pt) are resampled every STEP pt and lightly
# smoothed, so tracing noise and vertex spacing do not bias either side,
# then measured the same way:
#   median / p90 radius   length-weighted curvature, as 1/k in pt
#   turning               total heading change per pt of stem
#   inflections           S-bends (curvature sign changes) per 100 pt,
#                         counted on curvature smoothed over about 15 pt
# Run from the repository root: python3.14 -I analysis/stemcompare.py [SEEDS]
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_BIN = os.path.expanduser("~/Library/TinyTeX/bin/universal-darwin")
STEP = 3.0
MIN_LEN = 20.0  # pt; shorter pieces are tracing fragments, not stems


def resample(pts, step=STEP):
    p = np.asarray(pts, float)
    seg = np.hypot(*np.diff(p, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < MIN_LEN:
        return None
    t = np.arange(0, s[-1], step)
    q = np.column_stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])])
    # A 3-tap moving average keeps the ends in place.
    q[1:-1] = (q[:-2] + q[1:-1] + q[2:]) / 3
    return q


def signed_curvature(q):
    d = np.diff(q, axis=0)
    ang = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    return np.diff(ang) / STEP


def measure(curves):
    ks, total, turn, flips = [], 0.0, 0.0, 0
    for c in curves:
        q = resample(c)
        if q is None or len(q) < 4:
            continue
        k = signed_curvature(q)
        ks.append(np.abs(k))
        total += STEP * (len(q) - 1)
        turn += np.abs(k).sum() * STEP
        w = max(1, int(round(15 / STEP)))
        ksm = np.convolve(k, np.ones(w) / w, mode="valid")
        sig = np.sign(ksm[np.abs(ksm) > 1 / 400])
        flips += int((sig[1:] != sig[:-1]).sum())
    k = np.sort(np.concatenate(ks))
    radius = lambda q: 1 / q if q > 0 else np.inf  # noqa: E731 - a straight stem has no finite radius
    return {
        "length": total,
        "median_radius": radius(k[len(k) // 2]),
        "p90_radius": radius(k[int(len(k) * 0.9)]),
        "turning": np.degrees(turn) / total,
        "inflections": 100 * flips / total,
    }


def reference():
    d = json.load(open(os.path.join(ROOT, "tex", "reference", "curves.json")))
    return [np.asarray(c) * d["pt_per_px"] for c in d["curves"]]


def ours(seeds):
    out = subprocess.run([os.path.join(TEX_BIN, "texlua"), "analysis/stem_geometry.lua", str(seeds)],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    rows = [("reference", measure(reference()))]
    pages = ours(seeds)
    rows.append(("ours, all seeds", measure([s["pts"] for page in pages for s in page])))
    for kind in ("main", "long", "foot"):
        rows.append((f"  {kind}", measure([s["pts"] for page in pages for s in page if s["kind"] == kind])))
    print(f"{'':18}{'length pt':>10}{'median r':>10}{'p90 r':>8}{'deg/pt':>8}{'S/100pt':>9}")
    for name, m in rows:
        print(f"{name:18}{m['length']:10.0f}{m['median_radius']:10.0f}{m['p90_radius']:8.0f}"
              f"{m['turning']:8.2f}{m['inflections']:9.2f}")


if __name__ == "__main__":
    main()
