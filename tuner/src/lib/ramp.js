// A port of lua/flora/color.lua for instant swatches in the tuner. It mirrors
// the Lua ramp generator's maths; the random draws differ, so swatches show
// the range a setting produces, not particular shapes on the page.

const rad = (d) => (d * Math.PI) / 180;

function linear(L, C, h) {
  const a = C * Math.cos(rad(h)), b = C * Math.sin(rad(h));
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (L, C, h) => linear(L, C, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

export function maxChroma(L, h) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, h)) lo = mid; else hi = mid;
  }
  return lo;
}

const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function oklch(L, C, h) {
  const rgb = linear(L, Math.min(C, maxChroma(L, h)), h);
  const [r, g, b] = rgb.map((v) => Math.round(255 * Math.min(1, Math.max(0, encode(Math.max(0, v))))));
  return `rgb(${r} ${g} ${b})`;
}

// mulberry32, as in lua/flora/rng.lua.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    jit: (x) => (next() * 2 - 1) * x,
    chance: (p) => next() < p,
  };
}

// Stops for one shape of `look`, as in color.ramp: {t, css} pairs.
export function ramp(r, color, look) {
  const lk = color.looks[look] || color.looks.vivid;
  const pick = (range) => r.range(range[0], range[1]);
  const h = color.hue + r.jit(color.hue_jitter);
  const baseL = pick(lk.base_l), tipL = pick(lk.tip_l);
  let share = pick(lk.chroma);
  const curve = pick(lk.curve);
  if (look === "leaf" && r.chance(color.grey_chance)) share *= color.grey_share;
  const stops = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const L = baseL + (tipL - baseL) * t ** curve;
    const hh = h + color.hue_drift * (1 - t);
    const s = share * (0.55 + 0.45 * t);
    stops.push([t, oklch(L, s * maxChroma(L, hh), hh)]);
  }
  return { stops, h, tipL, share };
}
