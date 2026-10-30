# Fits a page homography from four straight page features read off the
# photo, then reports how level independent text baselines come out.
import json, numpy as np
def line(p, q): return np.cross([*p, 1.0], [*q, 1.0])
def meet(l, m):
    x = np.cross(l, m); return x[:2] / x[2]
L1 = line((365, 100), (415, 1010))    # page left edge
L2 = line((555, 267), (565, 897))     # text left edge
H1 = line((550, 165), (970, 187))     # header rule
H2 = line((415, 1010), (970, 942))    # page bottom edge
src = [meet(L1, H1), meet(L2, H1), meet(L1, H2), meet(L2, H2)]
# Real proportions: margin width vs header-to-foot height, measured along
# the left side where foreshortening is smallest.
w = np.linalg.norm(src[1] - src[0]); h = np.linalg.norm(src[2] - src[0])
H_out = 1600.0; W_out = H_out * w / h
dst = [(0, 0), (W_out, 0), (0, H_out), (W_out, H_out)]
A = []
for (x, y), (u, v) in zip(src, dst):
    A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
    A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
Hm = np.linalg.svd(np.array(A))[2][-1].reshape(3, 3); Hm /= Hm[2, 2]
def warp(p):
    q = Hm @ [p[0], p[1], 1.0]; return q[:2] / q[2]
# Independent checks: text baselines that should come out level.
checks = {"Dans cette section": ((555, 272), (970, 280)),
          "Soit G un groupe": ((560, 720), (955, 697))}
for name, (a, b) in checks.items():
    pa, pb = warp(a), warp(b)
    print(f"{name}: rectified slope {(pb[1]-pa[1])/(pb[0]-pa[0]):+.4f} (photo {(b[1]-a[1])/(b[0]-a[0]):+.4f})")
print("corners", [tuple(np.round(s, 1)) for s in src], "out", round(W_out), H_out)
json.dump({"H": Hm.tolist(), "src": [list(map(float, s)) for s in src], "dst": dst}, open("homography.json", "w"))
