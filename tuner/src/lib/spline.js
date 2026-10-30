// The size-curve spline, as in lua/flora/dist.lua: a monotone cubic
// (Fritsch-Carlson) through control points [x, w], x in 0-1 increasing.
// It never overshoots its points, so it stays non-negative and peaks only
// where a point is placed.

function slopes(xs, ys) {
  const n = xs.length;
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

export function spline(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => Math.max(0, p[1]));
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const m = slopes(xs, ys);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < x) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Control points for a curve in either form: its points, or its evenly
// spaced weights.
export function pointsOf(curve) {
  if (curve.points) return curve.points;
  const n = curve.weights.length;
  return curve.weights.map((w, i) => [n > 1 ? i / (n - 1) : 0, w]);
}
