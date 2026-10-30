# Searches tune.lua settings for a page whose form statistics (formstats.py)
# match the de-warped reference. Each candidate is drawn with the TeX-free
# preview (tools/preview.lua) for several seeds; the loss averages over them
# so a setting is not rewarded for one lucky layout. The search is a simple
# evolution strategy: each generation samples around the best candidate so
# far, with the step shrinking from generation to generation.
#
# Run from the repository root after `just fit-base`:
#   python3.14 -I analysis/fit_defaults.py [GENERATIONS] [POPULATION]
# with FIT_START=FILE to start from an override file.
# Writes build/fit/best.lua (an override for FLORA_TUNE) and
# build/fit/log.jsonl (every candidate and its loss).
import json
import os
import random
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import formstats as F  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.expanduser("~/Library/TinyTeX/bin/universal-darwin")
BASE = os.path.join(ROOT, "build", "fit", "base")
DPI = 157.9                 # renders at the reference's 0.456 pt per pixel
PPX = 72.27 / DPI
SEEDS = (1, 2, 3)
LIFT = 0.25                 # the photo maps black to about this lightness
BLUR = 1.2                  # the photo's softness, in pixels

# Searched settings: (path, low, high, kind). The bounds also keep the
# search away from pages that match the statistics but not the look: a
# stem buried under close-set leaflets, a small hero, pale leaves. "int" rounds; "range:w" is a
# {min, max} pair centred on the searched value with half-width w.
SPACE = [
    ("compose.hero", 0.40, 0.56, "num"),
    ("compose.features", 0.75, 1.4, "range:0.15"),
    ("compose.leaves", 15, 45, "int"),
    ("compose.leaf_size", 0.8, 1.6, "num"),
    ("compose.sprays", 40, 220, "int"),
    ("compose.small_blooms", 0, 12, "int"),
    ("compose.curls", 0.3, 2.0, "num"),
    ("compose.leaflet_spacing", 25, 70, "range:9"),
    ("compose.leaflet_size", 8, 14, "num"),
    ("gesture.edge", 0.04, 0.30, "num"),
    ("gesture.bow_amp", 0.15, 0.45, "range:0.05"),
    ("gesture.bow_width", 0.36, 0.54, "range:0.04"),
    ("gesture.density_floor", 0.10, 0.85, "num"),
    ("gesture.bow_density", 0.2, 1.0, "num"),
    ("gesture.end_reach", 1.5, 4.5, "num"),
    ("compose.leaf_overlap", 0.0, 0.9, "num"),
    ("compose.leaf_spacing", 18, 60, "range:6"),
    ("compose.hole_min", 4, 14, "num"),
    ("color.looks.vivid.tip_l", 0.25, 0.60, "range:0.11"),
    ("color.looks.vivid.base_l", 0.80, 0.97, "range:0.03"),
    ("color.looks.vivid.curve", 0.6, 1.8, "range:0.6"),
    ("color.looks.leaf.tip_l", 0.28, 0.48, "range:0.12"),
    ("color.looks.leaf.base_l", 0.60, 0.92, "range:0.09"),
    ("color.looks.leaf.curve", 0.5, 1.6, "range:0.5"),
    ("wash.band_opacity", 0.20, 0.60, "range:0.12"),
    ("wash.pale_contrast", 0.30, 0.80, "range:0.27"),
    ("wash.lost_edges", 0.15, 0.45, "num"),
]


def tune_defaults(start=""):
    """tune.lua as a dict, with the overrides in file `start` if given."""
    out = subprocess.run([os.path.join(TEX, "texlua"), "tools/tune_json.lua"], cwd=ROOT,
                         capture_output=True, text=True, check=True, env={**os.environ, "FLORA_TUNE": start})
    d = json.loads(out.stdout)
    d.pop("_doc", None)
    d.pop("_choices", None)
    return d


def get(d, path):
    for k in path.split("."):
        d = d[k]
    return d


def put(d, path, v):
    keys = path.split(".")
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    d[keys[-1]] = v


def encode(settings):
    """Settings -> point in the unit cube."""
    u = []
    for path, lo, hi, kind in SPACE:
        v = get(settings, path)
        if kind.startswith("range"):
            v = (v[0] + v[1]) / 2
        u.append(min(1, max(0, (v - lo) / (hi - lo))))
    return np.array(u)


def decode(u):
    """Point in the unit cube -> override table."""
    over = {}
    for (path, lo, hi, kind), x in zip(SPACE, u):
        v = lo + (hi - lo) * float(np.clip(x, 0, 1))
        if kind == "int":
            v = int(round(v))
        elif kind.startswith("range"):
            w = float(kind.split(":")[1])
            v = [round(v - w, 3), round(v + w, 3)]
        else:
            v = round(v, 3)
        put(over, path, v)
    return over


def lua(v, ind=""):
    if isinstance(v, dict):
        inner = ind + "  "
        return "{\n" + "".join(f"{inner}{k} = {lua(x, inner)},\n" for k, x in sorted(v.items())) + ind + "}"
    if isinstance(v, list):
        return "{ " + ", ".join(lua(x) for x in v) + " }"
    return repr(v)


TARGET = None


def loss(s, t):
    """Weighted squared distance between two sets of form statistics."""
    d = 0.0
    d += 1.0 * sum((a - b) ** 2 for a, b in zip(s["coverage_v"], t["coverage_v"])) / 8
    d += 1.5 * sum((a - b) ** 2 for a, b in zip(s["coverage_h"], t["coverage_h"])) / 5
    d += 2.0 * sum((a - b) ** 2 for a, b in zip(s["sizes"], t["sizes"])) / 3
    d += 2.0 * sum((a - b) ** 2 for a, b in zip(s["L"], t["L"])) / 3
    d += 1.0 * (s["deep"] - t["deep"]) ** 2
    d += 0.5 * (s["foot"] - t["foot"]) ** 2
    return d


def evaluate(u):
    over = decode(u)
    text = np.asarray(Image.open(os.path.join(BASE, "text-1.png")).convert("RGB"), dtype=np.float64)
    rule = 115.3 / PPX
    with tempfile.TemporaryDirectory() as tmp:
        tune = os.path.join(tmp, "tune.lua")
        open(tune, "w").write("return " + lua(over) + "\n")
        losses, all_stats = [], []
        for seed in SEEDS:
            pdf, png = os.path.join(tmp, f"{seed}.pdf"), os.path.join(tmp, f"{seed}")
            subprocess.run([os.path.join(TEX, "texlua"), "tools/preview.lua", os.path.join(BASE, "spec-1.lua"),
                            str(seed), "1", pdf], cwd=ROOT, check=True, capture_output=True,
                           env={**os.environ, "FLORA_TUNE": tune})
            subprocess.run(["pdftocairo", "-png", "-singlefile", "-r", str(DPI), pdf, png], check=True)
            flora = np.asarray(Image.open(png + ".png").convert("RGB"), dtype=np.float64)
            page = (flora * text / 255.0).astype(np.uint8)
            Image.fromarray(page).save(png + "-page.png")
            s = F.stats(png + "-page.png", PPX, rule, blur_px=BLUR, lift=LIFT)
            all_stats.append(s)
            losses.append(loss(s, TARGET))
    return float(np.mean(losses)), over, all_stats


def init_target():
    global TARGET
    TARGET = F.stats(os.path.join(ROOT, "tex/reference/rectified.png"), 0.456, 154)


def main():
    gens = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    pop = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    init_target()
    rng = random.Random(7)
    # FIT_START names an override file (such as an earlier best.lua) to
    # start the search from instead of tune.lua's defaults.
    best_u = encode(tune_defaults(os.path.abspath(os.environ["FIT_START"]) if os.environ.get("FIT_START") else ""))
    os.makedirs(os.path.join(ROOT, "build", "fit"), exist_ok=True)
    log = open(os.path.join(ROOT, "build", "fit", "log.jsonl"), "w")
    with ProcessPoolExecutor(max_workers=10, initializer=init_target) as ex:
        best_loss, best_over, best_stats = ex.submit(evaluate, best_u).result()
        print(f"defaults: loss {best_loss:.4f}", flush=True)
        for g in range(gens):
            sigma = 0.25 * (0.08 / 0.25) ** (g / max(1, gens - 1))
            cands = [np.clip(best_u + np.array([rng.gauss(0, sigma) for _ in SPACE]), 0, 1) for _ in range(pop)]
            for u, (l, over, stats) in zip(cands, ex.map(evaluate, cands)):
                log.write(json.dumps({"gen": g, "loss": l, "over": over}) + "\n")
                if l < best_loss:
                    best_loss, best_u, best_over, best_stats = l, u, over, stats
            log.flush()
            print(f"gen {g}: sigma {sigma:.3f} best loss {best_loss:.4f}", flush=True)
    open(os.path.join(ROOT, "build", "fit", "best.lua"), "w").write("return " + lua(best_over) + "\n")
    json.dump({"loss": best_loss, "target": TARGET, "stats": best_stats, "over": best_over},
              open(os.path.join(ROOT, "build", "fit", "best.json"), "w"), indent=1)
    print("best:", json.dumps(best_over))


if __name__ == "__main__":
    main()
