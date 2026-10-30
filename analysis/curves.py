# Turns the stem skeleton into spline curves.
#
# The skeleton is treated as an 8-connected pixel graph. In each component
# the longest path (found by two breadth-first searches) is a curve; its
# pixels are removed and the search repeats so branches come out as their
# own curves. Paths are simplified (Ramer-Douglas-Peucker), smoothed, and
# written to curves.json in rectified pixels. Curvature statistics are
# printed per curve and in total.
import json
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

sk = np.load("skeleton.npy").astype(bool)
H, W = sk.shape
pix = set(zip(*np.nonzero(sk)))
OFF = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def bfs(start, alive):
    dist, prev = {start: 0}, {start: None}
    q = deque([start]); last = start
    while q:
        u = q.popleft(); last = u
        for dy, dx in OFF:
            v = (u[0] + dy, u[1] + dx)
            if v in alive and v not in dist:
                dist[v] = dist[u] + 1; prev[v] = u; q.append(v)
    return last, prev, dist

def longest(alive, seed):
    a, _, _ = bfs(seed, alive)
    b, prev, _ = bfs(a, alive)
    path = []
    while b is not None:
        path.append(b); b = prev[b]
    return path

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a; n = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / n for p in pts]
    i = int(np.argmax(d))
    if d[i] > eps:
        return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def catmull(pts, per=8):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(pts[-1], float))
    return [list(map(float, p)) for p in out]

curves, alive = [], set(pix)
while True:
    comps, seen = [], set()
    for p in alive:
        if p in seen: continue
        _, _, d = bfs(p, alive); seen |= set(d); comps.append(next(iter(d)))
    best = None
    for c in comps:
        path = longest(alive, c)
        if not best or len(path) > len(best): best = path
    if not best or len(best) < 45: break
    alive -= set(best)
    for y, x in best:                      # also clear the 1-px halo of the path
        for dy, dx in OFF: alive.discard((y + dy, x + dx))
    xy = [(x, y) for y, x in best]
    curves.append(catmull(rdp(xy, 2.0)))

PT_PER_PX = 0.456   # rectified header-to-foot span of 1600 px over about 730 pt
def stats(c):
    c = np.array(c); seg = np.diff(c, axis=0); L = np.hypot(*seg.T)
    ang = np.unwrap(np.arctan2(seg[:, 1], seg[:, 0]))
    turn = np.abs(np.diff(ang)); ds = (L[1:] + L[:-1]) / 2 * PT_PER_PX
    k = turn / np.maximum(ds, 1e-6)
    return L.sum() * PT_PER_PX, np.abs(np.diff(ang)).sum(), k, ds
tot_len = tot_turn = 0; ks = []; wts = []
for c in curves:
    L, T, k, ds = stats(c); tot_len += L; tot_turn += T; ks.append(k); wts.append(ds)
ks = np.concatenate(ks); wts = np.concatenate(wts)
order = np.argsort(ks); cw = np.cumsum(wts[order]) / wts.sum()
med = ks[order][np.searchsorted(cw, 0.5)]; p90 = ks[order][np.searchsorted(cw, 0.9)]
print(f"{len(curves)} curves, {tot_len:.0f} pt of stem, {np.degrees(tot_turn)/tot_len:.1f} deg of turning per pt")
print(f"curvature (length-weighted): median {med:.3f}/pt (radius {1/med:.0f} pt), p90 {p90:.3f}/pt (radius {1/p90:.0f} pt)")
json.dump({"pt_per_px": PT_PER_PX, "size": [W, H], "curves": curves}, open("curves.json", "w"))

im = Image.open("rectified.png").convert("RGB").crop((0, 0, 720, H))
dr = ImageDraw.Draw(im)
cols = [(255, 0, 170), (0, 200, 120), (255, 140, 0), (160, 60, 255), (0, 170, 255)]
for i, c in enumerate(curves):
    dr.line([tuple(p) for p in c], fill=cols[i % len(cols)], width=3, joint="curve")
im.save("splines_overlay.png")
im.resize((360, H // 2)).save("splines_small.png")
