// The \florasetup line for a mixer state: only what differs from the
// defaults, so it reads like something a person would write.
export function setupLine({ layout, seed, mix, palette, spin }, meta) {
  const parts = [`layout=${layout}`, `seed=${seed}`];
  const defaults = Object.fromEntries(meta.kinds.map(([k, , , d]) => [k, d]));
  const changed = Object.entries(mix).filter(([k, v]) => k !== "density" && v !== defaults[k]);
  if (mix.density !== undefined && mix.density !== defaults.density) parts.push(`density=${mix.density}`);
  if (changed.length) parts.push(`mix={${changed.map(([k, v]) => `${k}=${v}`).join(", ")}}`);
  const partDefaults = Object.fromEntries(meta.parts);
  const pal = Object.entries(palette).filter(([k, v]) => v !== partDefaults[k]);
  if (pal.length) parts.push(`palette={${pal.map(([k, v]) => `${k}=${v}`).join(", ")}}`);
  if (spin && Object.values(palette).includes("random")) parts.push(`spin=${spin}`);
  return `\\florasetup{${parts.join(", ")}}`;
}

// Page margins that leave the flora room, by layout.
const GEOMETRY = {
  left: "a4paper,left=5.5cm,right=2cm,top=3.5cm,bottom=3.5cm",
  right: "a4paper,left=2cm,right=5.5cm,top=3.5cm,bottom=3.5cm",
  split: "a4paper,twoside,inner=2cm,outer=5.5cm,top=3.5cm,bottom=3.5cm",
  centered: "a4paper,left=4.6cm,right=4.6cm,top=3.5cm,bottom=3.5cm",
  title: "a4paper,margin=3.2cm,top=5cm",
  surround: "a4paper,margin=3.2cm",
};

// A whole document that compiles with LuaLaTeX beside the unzipped
// package and shows the mixer's settings on its first page.
export function documentFor(line, layout) {
  const body = layout === "title"
    ? "\\begin{floratitle}\n\\centering\n{\\Huge\\scshape Florilegium\\par}\n\\end{floratitle}\n"
    : "\\section{A first garden}\n";
  return [
    "% Save as main.tex beside tikzflora.sty and lua/, then run: lualatex main",
    "\\documentclass[11pt]{article}",
    `\\usepackage[${GEOMETRY[layout] ?? GEOMETRY.left}]{geometry}`,
    "\\usepackage{tikzflora}",
    line,
    "",
    "\\begin{document}",
    body.trimEnd(),
    "The framework of the leaf consists of wood, a fibrous and tough",
    "material which runs from the stem through the leaf-stalk into the",
    "blade, where it spreads out to form the ribs and veins.",
    "\\end{document}",
    "",
  ].join("\n");
}
