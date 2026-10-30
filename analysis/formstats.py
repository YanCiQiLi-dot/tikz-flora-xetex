# Form statistics for a page of flora, comparable between the de-warped
# reference photo and a render, independent of where individual elements
# land. All positions are in pt relative to the running-head rule (y down)
# and the page's left edge, so pages with different layouts line up.
#
#   coverage_v   share of flora pixels in 8 bands from above the rule to
#                the foot, over the margin column
#   coverage_h   share in 5 bands across the margin, from the page edge to
#                the text
#   foot         share in the foot band under the text
#   sizes        share of the flora that survives a morphological opening
#                of 1.5, 4 and 8 pt: big blooms and leaves survive large
#                openings, fine sprays do not
#   L            OKLab lightness percentiles (10, 50, 90) of flora pixels
#   deep         share of flora pixels darker than L 0.55
#   chroma       median OKLab chroma of flora pixels
#
# Usage as a script: formstats.py IMAGE PT_PER_PX RULE_Y_PX [BLUR_PX]
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gamut import oklab  # noqa: E402

# Regions in pt: the margin column spans the page edge to the text; the
# vertical span runs from the top of the hero bloom to the foot.
MARGIN_X = (4.0, 152.0)
SPAN_Y = (-50.0, 712.0)
FOOT = (152.0, 560.0, 640.0, 712.0)   # x0, x1, y0, y1


def _run(a, k, op, axis):
    """Running min or max over a window of k cells along `axis` (edge-padded)."""
    r = k // 2
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    p = np.pad(a, pad, mode="edge")
    out = np.take(p, range(0, a.shape[axis]), axis=axis)
    for s in range(1, 2 * r + 1):
        out = op(out, np.take(p, range(s, s + a.shape[axis]), axis=axis))
    return out


def square(a, k, op):
    """Separable square min or max filter of side k."""
    return _run(_run(a, k, op, 0), k, op, 1)


def flat_field(rgb, px):
    """Divide out uneven illumination: the paper level at each pixel is
    estimated as the brightest luminance within ~`px` pixels, smoothed. A
    clean render is unaffected; a photo loses its vignetting. Computed at
    1/8 resolution, where the window is small."""
    lum = rgb.mean(2)
    h, w = lum.shape
    small = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).resize((max(1, w // 8), max(1, h // 8)),
                                                                             Image.BOX), dtype=np.float64)
    small = square(small, max(3, int(px / 8) | 1), np.maximum)
    level = Image.fromarray(small.astype(np.uint8)).filter(ImageFilter.GaussianBlur(px / 16)).resize((w, h), Image.BILINEAR)
    level = np.asarray(level, dtype=np.float64) / 255.0
    return np.clip(rgb / np.maximum(level, 0.05)[..., None] * np.percentile(level, 90), 0, 1)


def flora_mask(rgb):
    """Lightness, chroma and a mask of flora pixels, white-balanced to paper."""
    flat = rgb.reshape(-1, 3)
    lum = flat.mean(1)
    sat = flat.max(1) - flat.min(1)
    bright = (lum >= np.percentile(lum, 85)) & (sat <= np.percentile(sat, 50))
    paper = np.median(flat[bright], axis=0)
    lab = oklab(np.clip(flat / paper, 0, 1))
    L = lab[:, 0]
    C = np.hypot(lab[:, 1], lab[:, 2])
    hue = np.degrees(np.arctan2(lab[:, 2], lab[:, 1]))
    m = (L < 0.93) | (C > 0.035)
    m &= ((hue < -60) & (hue > -150)) | (C < 0.05)
    m &= L < 0.97
    shape = rgb.shape[:2]
    return L.reshape(shape), C.reshape(shape), m.reshape(shape)


def opening(mask, px):
    """Binary opening with a square of side ~2*px+1."""
    k = max(3, int(round(px)) * 2 + 1)
    return square(square(mask, k, np.minimum), k, np.maximum)


def stats(path, ppx, rule_px, blur_px=0.0, lift=0.0):
    """Form statistics for image `path` at `ppx` pt per pixel whose header
    rule is at row `rule_px`. `blur_px` softens a crisp render toward the
    photo; `lift` maps lightness L to lift + (1 - lift) * L, as the photo's
    raised blacks do."""
    im = Image.open(path).convert("RGB")
    if blur_px > 0:
        im = im.filter(ImageFilter.GaussianBlur(blur_px))
    rgb = flat_field(np.asarray(im, dtype=np.float64) / 255.0, 45 / ppx)
    L, C, m = flora_mask(rgb)
    L = lift + (1 - lift) * L

    def px(x, y):
        return int(round(x / ppx)), int(round(rule_px + y / ppx))

    (x0, y0), (x1, y1) = px(MARGIN_X[0], SPAN_Y[0]), px(MARGIN_X[1], SPAN_Y[1])
    col = m[y0:y1, x0:x1]
    out = {"coverage": float(col.mean())}
    out["coverage_v"] = [float(b.mean()) for b in np.array_split(col, 8, axis=0)]
    out["coverage_h"] = [float(b.mean()) for b in np.array_split(col, 5, axis=1)]
    (fx0, fy0), (fx1, fy1) = px(FOOT[0], FOOT[2]), px(FOOT[1], FOOT[3])
    out["foot"] = float(m[fy0:fy1, fx0:fx1].mean())
    total = max(1, col.sum())
    out["sizes"] = [float(opening(col, r / ppx).sum() / total) for r in (1.5, 4.0, 8.0)]
    Lc, Cc = L[y0:y1, x0:x1][col], C[y0:y1, x0:x1][col]
    out["L"] = [float(np.percentile(Lc, p)) for p in (10, 50, 90)] if Lc.size else [1, 1, 1]
    out["deep"] = float((Lc < 0.55).mean()) if Lc.size else 0.0
    out["chroma"] = float(np.median(Cc)) if Cc.size else 0.0
    return out


def text_black(path, ppx, rule_px):
    """Darkest body-text lightness (1st percentile) in a text-only region,
    used to estimate how far a photo lifts its blacks."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0
    y0, y1 = int(rule_px + 60 / ppx), int(rule_px + 300 / ppx)
    x0, x1 = int(175 / ppx), int(420 / ppx)
    L, _, _ = flora_mask(rgb[y0:y1, x0:x1])
    return float(np.percentile(L, 1))


if __name__ == "__main__":
    path, ppx, rule = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    blur = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    print(json.dumps(stats(path, ppx, rule, blur), indent=1))
