// The \florasetup line for a mixer state: only what differs from the
// defaults, so it reads like something a person would write.
export function setupLine({ layout, seed, mix, palette }, meta) {
  const parts = [`layout=${layout}`, `seed=${seed}`];
  const defaults = Object.fromEntries(meta.kinds.map(([k, , , d]) => [k, d]));
  const changed = Object.entries(mix).filter(([k, v]) => k !== "density" && v !== defaults[k]);
  if (mix.density !== undefined && mix.density !== defaults.density) parts.push(`density=${mix.density}`);
  if (changed.length) parts.push(`mix={${changed.map(([k, v]) => `${k}=${v}`).join(", ")}}`);
  const partDefaults = Object.fromEntries(meta.parts);
  const pal = Object.entries(palette).filter(([k, v]) => v !== partDefaults[k]);
  if (pal.length) parts.push(`palette={${pal.map(([k, v]) => `${k}=${v}`).join(", ")}}`);
  return `\\florasetup{${parts.join(", ")}}`;
}
