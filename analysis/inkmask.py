# Separates navy line work from blue washes in the rectified reference.
# Ink is dark and low in chroma; washes are high in chroma. Writes a binary
# mask of likely ink for skeletonising.
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from gamut import oklab
im = np.asarray(Image.open("rectified.png").convert("RGB"), dtype=np.float64) / 255.0
h, w, _ = im.shape
flat = im.reshape(-1, 3)
lum = flat.mean(1); sat = flat.max(1) - flat.min(1)
bright = (lum >= np.percentile(lum, 85)) & (sat <= np.percentile(sat, 50))
paper = np.median(flat[bright], axis=0)
lab = oklab(np.clip(flat / paper, 0, 1)).reshape(h, w, 3)
L, C = lab[..., 0], np.hypot(lab[..., 1], lab[..., 2])
ink = (L < 0.62) & (C < 0.075)
ink[:, 345:] = False          # margin column and foot only; text is ink too
foot = np.zeros_like(ink); foot[1480:, :] = True
ink |= ((L < 0.62) & (C < 0.075) & foot)
ink[:1480, 345:] = False
# The page edges and whatever lies past them (monitor bezel, the post title
# in the top corner) are dark and grey too. Keep ink only between each
# column's first and last paper pixel, inset by a few pixels of edge blur.
paperish = L > 0.66
rows = np.arange(h)[:, None]
has = paperish.any(0)
top = np.where(has, paperish.argmax(0), h)
bot = np.where(has, h - 1 - paperish[::-1].argmax(0), -1)
ink &= (rows > top + 10) & (rows < bot - 10)
ink[:, :6] = False; ink[:, -10:] = False
Image.fromarray((~ink * 255).astype(np.uint8)).save("ink_mask.png")
print("ink fraction", ink.mean().round(4))
