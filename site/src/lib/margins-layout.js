// Layout and timing for the margin garden (margins.js), without a browser:
// where each margin's plants hang, the windows they are drawn in, how far
// the front has grown at a row, and the row it heads for.

// The narrowest margin a plant grows in, px.
export const MIN_MARGIN = 110;
// The front leads the reader: it heads for this fraction of the viewport.
export const LEAD = 1;
// Space kept clear above and below a band, px, and the shortest run of
// margin that grows a plant.
export const BAND_GAP = 10, MIN_RUN = 320;
// A plant is drawn in windows ("tiles") this tall, px: a whole number of
// birth cells (margins.worker.js CELL), and well inside canvas limits.
export const TILE = 1200;
// The first window is shorter: a plant grows from its top, so the reader
// sees the first window soonest, and a short one is drawn sooner.
export const FIRST_TILE = 600;

// The runs of one margin down a page `docH` px tall, [{ y, h }, ...]: one
// plant each. `bands` ([[y0, y1], ...], page px) are elements that span the
// whole margin, such as a strip of pictures; a plant ends above each band
// and another starts below it, so nothing grows behind one. Bands that
// touch count as one; a run shorter than MIN_RUN is left bare.
export function layoutSide(bands, docH) {
  const merged = [];
  for (const [a, b] of [...bands].sort((p, q) => p[0] - q[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + BAND_GAP * 2) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const out = [];
  let start = 0;
  for (const [a, b] of merged) {
    const end = Math.min(docH, a - BAND_GAP);
    if (end - start >= MIN_RUN) out.push({ y: start, h: end - start });
    start = Math.max(start, b + BAND_GAP);
  }
  if (docH - start >= MIN_RUN) out.push({ y: start, h: docH - start });
  return out;
}

// The windows a run `h` px tall is drawn in, [{ y, h }, ...] from the run's
// top: FIRST_TILE, then TILE tall, the last one what is left.
export function tilesOf(h) {
  const out = [];
  for (let y = 0; y < h; y += y === 0 ? FIRST_TILE : TILE) out.push({ y, h: Math.min(y === 0 ? FIRST_TILE : TILE, h - y) });
  return out;
}

// The growth by which the front has reached local row `r` (px) of a plant
// whose rows profile is `rows` (per cell row) and cell `cell`. Past the
// plant's foot it keeps rising a px of growth per px, so what is born last
// (blooms at the stem ends, gilt) finishes as the front moves on.
export function rowGrowth(rows, cell, r) {
  if (r <= 0) return 0;
  const j = Math.floor(r / cell);
  if (j < rows.length) return rows[j];
  return rows[rows.length - 1] + (r - rows.length * cell);
}

// The page row the front heads for at scroll position `y`: `lead` (LEAD
// by default) of the way down the viewport, and the whole page once the
// reader reaches its foot (or when it does not scroll).
export function targetRow(y, vh, docH, lead = LEAD) {
  const max = Math.max(0, docH - vh);
  const end = max <= 0 ? 1 : Math.min(1, y / max) ** 8;
  return Math.min(docH, y + vh * lead + end * vh * (1 - lead) + (max <= 0 ? docH : 0));
}

// Fixed per-cell jitter in about [-1, 1], smooth over a few cells, so the
// front's edge is ragged like a wash rather than ruled.
export function jitter(nx, ny, seed) {
  let a = new Float32Array(nx * ny);
  let s = (seed * 2654435761) >>> 0;
  for (let i = 0; i < a.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    a[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }
  // Box blurs of radius R along rows, then columns, twice.
  const R = 3;
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let sum = 0, c = 0;
      for (let k = Math.max(0, i - R); k <= Math.min(nx - 1, i + R); k++) { sum += a[j * nx + k]; c++; }
      b[j * nx + i] = sum / c;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let sum = 0, c = 0;
      for (let k = Math.max(0, j - R); k <= Math.min(ny - 1, j + R); k++) { sum += b[k * nx + i]; c++; }
      a[j * nx + i] = sum / c;
    }
  }
  // The blur narrows the spread; widen it back to about [-1, 1].
  let peak = 1e-9;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
  for (let i = 0; i < a.length; i++) a[i] /= peak;
  return a;
}
