# Stem-flow statistics for any page image: ink mask -> Zhang-Suen skeleton ->
# longest-path splines -> curvature. Usage:
#   stemflow.py IMAGE PT_PER_PX LMAX CMAX X0 Y0 X1 Y1 [TEXT_X0 FOOT_Y]
# (X0..Y1) bounds the analysed region; above FOOT_Y only x < TEXT_X0 is kept,
# so text glyphs are excluded but the foot band is included.
import sys, json
import numpy as np
from PIL import Image
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gamut import oklab
import skeleton_lib as SL

img, ppx, lmax, cmax = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
x0, y0, x1, y1 = map(int, sys.argv[5:9])
im = np.asarray(Image.open(img).convert("RGB"), dtype=np.float64)[y0:y1, x0:x1] / 255.0
h, w, _ = im.shape
flat = im.reshape(-1, 3)
lum = flat.mean(1); sat = flat.max(1) - flat.min(1)
bright = (lum >= np.percentile(lum, 85)) & (sat <= np.percentile(sat, 50))
paper = np.median(flat[bright], axis=0)
lab = oklab(np.clip(flat / paper, 0, 1)).reshape(h, w, 3)
L, C = lab[..., 0], np.hypot(lab[..., 1], lab[..., 2])
ink = (L < lmax) & (C < cmax)
if len(sys.argv) > 10:
    tx, fy = int(sys.argv[9]) - x0, int(sys.argv[10]) - y0
    ink[:fy, tx:] = False
curves = SL.curves(SL.thin(SL.despeckle(ink)))
med, p90, turn, total = SL.stats(curves, ppx)
print(f"{img.split('/')[-1]}: {len(curves)} curves, {total:.0f} pt, {turn:.1f} deg/pt, "
      f"median radius {1/med:.0f} pt, p90 radius {1/p90:.1f} pt")
