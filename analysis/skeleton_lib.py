# Shared steps for stem analysis: despeckle, thin, trace curves, measure.
import numpy as np
from collections import deque
OFF = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def despeckle(mask, r=2, k=6):
    p = np.pad(mask.astype(np.int32), r); s = np.zeros(mask.shape, np.int32)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            s += p[r + dy:r + dy + mask.shape[0], r + dx:r + dx + mask.shape[1]]
    return mask & (s >= k)

def thin(mask):
    img = mask.astype(np.uint8); h, w = img.shape
    def nb(a):
        p = np.pad(a, 1); sl = lambda dy, dx: p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        return [sl(-1, 0), sl(-1, 1), sl(0, 1), sl(1, 1), sl(1, 0), sl(1, -1), sl(0, -1), sl(-1, -1)]
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            P = nb(img); B = sum(P)
            A = sum(((P[i] == 0) & (P[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8))
            c = ((P[0] * P[2] * P[4] == 0) & (P[2] * P[4] * P[6] == 0)) if step == 0 else \
                ((P[0] * P[2] * P[6] == 0) & (P[0] * P[4] * P[6] == 0))
            kill = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if kill.any(): img[kill] = 0; changed = True
    return img.astype(bool)

def _bfs(start, alive):
    dist, prev = {start: 0}, {start: None}; q = deque([start]); last = start
    while q:
        u = q.popleft(); last = u
        for dy, dx in OFF:
            v = (u[0] + dy, u[1] + dx)
            if v in alive and v not in dist: dist[v] = dist[u] + 1; prev[v] = u; q.append(v)
    return last, prev, dist

def _rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float); ab = b - a; n = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / n for p in pts]; i = int(np.argmax(d))
    return _rdp(pts[:i + 1], eps)[:-1] + _rdp(pts[i:], eps) if d[i] > eps else [pts[0], pts[-1]]

def _catmull(pts, per=8):
    out = []; P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(pts[-1], float)); return [list(map(float, p)) for p in out]

def curves(sk, min_len=45, eps=2.0):
    alive = set(zip(*np.nonzero(sk))); out = []
    while True:
        best, seen = None, set()
        for p in list(alive):
            if p in seen: continue
            a, _, d = _bfs(p, alive); seen |= set(d)
            b, prev, _ = _bfs(a, alive); path = []
            while b is not None: path.append(b); b = prev[b]
            if not best or len(path) > len(best): best = path
        if not best or len(best) < min_len: break
        alive -= set(best)
        for y, x in best:
            for dy, dx in OFF: alive.discard((y + dy, x + dx))
        out.append(_catmull(_rdp([(x, y) for y, x in best], eps)))
    return out

def stats(cs, ppx):
    ks, ws, total, turn = [], [], 0.0, 0.0
    for c in cs:
        c = np.array(c); seg = np.diff(c, axis=0); L = np.hypot(*seg.T)
        ang = np.unwrap(np.arctan2(seg[:, 1], seg[:, 0])); t = np.abs(np.diff(ang))
        ds = (L[1:] + L[:-1]) / 2 * ppx; ks.append(t / np.maximum(ds, 1e-6)); ws.append(ds)
        total += L.sum() * ppx; turn += t.sum()
    ks, ws = np.concatenate(ks), np.concatenate(ws); o = np.argsort(ks); cw = np.cumsum(ws[o]) / ws.sum()
    return ks[o][np.searchsorted(cw, 0.5)], ks[o][np.searchsorted(cw, 0.9)], np.degrees(turn) / total, total
