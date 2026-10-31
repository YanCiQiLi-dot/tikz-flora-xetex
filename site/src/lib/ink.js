// Swatches and plain names for the inks of lua/flora/inks.lua. A ramp is
// eight OKLab [L, a, b] stops from the densest stroke to the palest wash.

// The stop that stands for the ink: strong, but not the densest stroke.
const FACE = 2;

export function css([l, a, b]) {
  return `oklab(${l} ${a} ${b})`;
}

export function face(ramp) {
  return css(ramp[FACE]);
}

// The whole ramp, dense to pale, as a CSS gradient.
export function strip(ramp) {
  return `linear-gradient(90deg, ${ramp.map(css).join(", ")})`;
}

// Hue bands in OKLab degrees (upper bounds), with the word for each.
const HUES = [
  [8, "pink"], [28, "red"], [45, "orange-red"], [75, "orange"], [100, "amber"],
  [125, "yellow"], [165, "green"], [215, "teal"], [245, "sky blue"],
  [280, "blue"], [305, "violet"], [330, "purple"], [350, "plum"], [360, "pink"],
];

// A plain description such as "deep blue" or "grey-green", from the ink's
// face stop. Dark, muted warm inks read as brown.
export function describe(ramp) {
  const [l, a, b] = ramp[FACE];
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  const hue = HUES.find(([top]) => h < top)[1];
  const tone = l < 0.45 ? "deep " : l > 0.75 ? "pale " : "";
  if (c < 0.02) return `${tone}grey`;
  if (h >= 8 && h < 100 && l < 0.5 && c < 0.09) return `${tone}brown`;
  if (c < 0.055) return `${tone}grey-${hue}`;
  return tone + hue;
}
