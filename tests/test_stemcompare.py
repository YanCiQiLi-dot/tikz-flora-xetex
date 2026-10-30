# Curvature measures in analysis/stemcompare.py on shapes with known answers:
# an arc's radius, a straight line's lack of turning, a sine's S-bends.
# Run from the repository root: python3 -I tests/test_stemcompare.py
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "analysis"))
import stemcompare as C  # noqa: E402

failures = 0


def check(cond, msg):
    global failures
    if not cond:
        failures += 1
        sys.stderr.write("FAIL: " + msg + "\n")


# Vertices spaced unevenly, so resampling (not vertex spacing) sets the scale.
t = np.sort(np.random.default_rng(1).uniform(0, 1.5 * np.pi, 400))
arc = np.column_stack([50 * np.cos(t), 50 * np.sin(t)])
m = C.measure([arc])
check(abs(m["median_radius"] - 50) < 2.5, f"arc of radius 50 measured {m['median_radius']:.1f}")
check(abs(m["turning"] - np.degrees(1 / 50)) < 0.06, f"arc turning {m['turning']:.3f} deg/pt")
check(m["inflections"] == 0, f"arc has {m['inflections']} S-bends")
check(abs(m["length"] - 50 * 1.5 * np.pi) < 2 * C.STEP, f"arc length {m['length']:.1f}")

x = np.linspace(0, 400, 50)
m = C.measure([np.column_stack([x, 0.5 * x])])
check(m["turning"] < 1e-6, f"straight line turns {m['turning']}")

# A sine with wavelength 100 pt changes bend direction every 50 pt along x.
x = np.linspace(0, 400, 2000)
m = C.measure([np.column_stack([x, 12 * np.sin(2 * np.pi * x / 100)])])
bends = m["inflections"] * m["length"] / 100
check(abs(bends - 7) <= 1, f"sine over 4 wavelengths has {bends:.1f} S-bends, want 7")

check(C.resample([[0, 0], [10, 0]]) is None, "fragment shorter than MIN_LEN kept")

if failures:
    sys.stderr.write(f"stemcompare: {failures} failure(s)\n")
    sys.exit(1)
print("stemcompare: ok")
