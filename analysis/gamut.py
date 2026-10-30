# Measures the colour range of flora pixels in an image.
#
# Each image is white-balanced against its own paper (the median of its
# brightest, least saturated pixels), so a phone photo of a monitor and a
# clean render can be compared. Flora pixels are those that differ from the
# paper by more than a small threshold. Lightness and chroma are in OKLab.
# Writes a lightness-vs-chroma density chart and prints percentiles.
import sys, json
import numpy as np
from PIL import Image

def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def oklab(rgb):
    lin = srgb_to_linear(rgb)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(lin @ M1.T)
    return lms @ M2.T

def analyse(path, crop=None):
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    a = np.asarray(im, dtype=np.float64).reshape(-1, 3) / 255.0
    lum = a.mean(1)
    sat = a.max(1) - a.min(1)
    bright = (lum >= np.percentile(lum, 85)) & (sat <= np.percentile(sat, 50))
    paper = np.median(a[bright], axis=0)
    wb = np.clip(a / paper, 0, 1)
    lab = oklab(wb)
    L, C = lab[:, 0], np.hypot(lab[:, 1], lab[:, 2])
    hue = np.degrees(np.arctan2(lab[:, 2], lab[:, 1]))
    flora = (L < 0.93) | (C > 0.035)
    flora &= (hue < -60) & (hue > -150) | (C < 0.05)   # blues and neutrals (ink)
    flora &= L < 0.97
    return L[flora], C[flora], paper

def chart(L, C, out, title):
    W, H = 300, 300
    img = np.full((H, W, 3), 250, np.uint8)
    xs = np.clip((C / 0.30 * (W - 1)).astype(int), 0, W - 1)
    ys = np.clip(((1 - L) * (H - 1)).astype(int), 0, H - 1)
    dens = np.zeros((H, W))
    np.add.at(dens, (ys, xs), 1)
    dens = np.log1p(dens) / max(np.log1p(dens).max(), 1e-9)
    shade = (250 - dens * 230).astype(np.uint8)
    for k in range(3): img[:, :, k] = np.where(dens > 0, shade, 250)
    img[:, :, 2] = np.where(dens > 0, np.maximum(img[:, :, 2], 120), 250)
    Image.fromarray(img).resize((600, 600), Image.NEAREST).save(out)

if __name__ == "__main__":
    specs = json.loads(sys.argv[1])
    for s in specs:
        L, C, paper = analyse(s["path"], s.get("crop"))
        chart(L, C, s["out"], s["name"])
        q = lambda v, p: float(np.percentile(v, p))
        deep = L < 0.55
        print(f'{s["name"]:>14}: n={len(L):6d}  L p5/p50/p95 = {q(L,5):.2f}/{q(L,50):.2f}/{q(L,95):.2f}'
              f'  C p50/p95/max = {q(C,50):.3f}/{q(C,95):.3f}/{C.max():.3f}'
              f'  L span(p2..p98) = {q(L,98)-q(L,2):.2f}  deep share {deep.mean():.2f}')
