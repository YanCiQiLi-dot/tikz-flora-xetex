# Zhang-Suen thinning of the ink mask over the margin column and foot, then
# an overlay of the skeleton on the rectified photo. numpy only; no scipy.
import numpy as np
from PIL import Image
mask = np.asarray(Image.open("ink_mask.png").convert("L")) < 128
# Drop specks: keep pixels with at least 3 ink neighbours in a 5x5 window.
def box(a, r):
    p = np.pad(a.astype(np.int32), r)
    s = np.zeros_like(a, dtype=np.int32)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            s += p[r + dy:r + dy + a.shape[0], r + dx:r + dx + a.shape[1]]
    return s
mask &= box(mask, 2) >= 6
img = mask.astype(np.uint8)
def neighbours(a):
    p = np.pad(a, 1)
    h, w = a.shape
    sl = lambda dy, dx: p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    return [sl(-1, 0), sl(-1, 1), sl(0, 1), sl(1, 1), sl(1, 0), sl(1, -1), sl(0, -1), sl(-1, -1)]
changed = True
while changed:
    changed = False
    for step in (0, 1):
        P = neighbours(img)
        B = sum(P)
        A = sum(((P[i] == 0) & (P[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8))
        if step == 0:
            c = (P[0] * P[2] * P[4] == 0) & (P[2] * P[4] * P[6] == 0)
        else:
            c = (P[0] * P[2] * P[6] == 0) & (P[0] * P[4] * P[6] == 0)
        kill = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
        if kill.any():
            img[kill] = 0
            changed = True
np.save("skeleton.npy", img)
photo = np.asarray(Image.open("rectified.png").convert("RGB")).copy()
photo[img == 1] = (255, 0, 200)
Image.fromarray(photo).crop((0, 0, 700, 1754)).resize((350, 877)).save("skel_overlay.png")
print("skeleton px", int(img.sum()))
