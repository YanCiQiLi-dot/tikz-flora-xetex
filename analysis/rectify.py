# Warps the reference photo onto the fitted page plane (homography.json from
# homography.py). The viewport covers the margin, foot and text block; the
# warped header-to-foot span is 1600 px.
import json, subprocess, sys
import numpy as np
photo = sys.argv[1]
d = json.load(open("homography.json")); Hm = np.array(d["H"])
def warp(p):
    q = Hm @ [p[0], p[1], 1.0]; return q[:2] / q[2]
quad = [(366, 97), (970, 97), (970, 942), (415, 1010)]
pts = np.array([warp(p) for p in quad])
x0, y0 = pts.min(0); x1, y1 = pts.max(0)
pairs = " ".join(f"{s[0]:.2f},{s[1]:.2f} {t[0]:.2f},{t[1]:.2f}" for s, t in zip(d["src"], d["dst"]))
vp = f"{int(x1 - x0)}x{int(y1 - y0)}+{int(x0)}+{int(y0)}"
subprocess.run(["magick", photo, "-virtual-pixel", "white", "-define", f"distort:viewport={vp}",
                "-distort", "Perspective", pairs, "+repage", "rectified.png"], check=True)
json.dump({"offset": [int(x0), int(y0)]}, open("viewport.json", "w"))
print("viewport", vp)
