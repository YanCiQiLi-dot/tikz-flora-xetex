// Grows the plants of a web page's margin garden (margins.js) with flora's
// engine and draws them a window at a time, with when each part is born.
//
// A plant hangs from the top of its run of margin: the engine grows it as
// a printed page's plant, from its root at the foot up to the hero, and the
// run shows it turned over, so the root sits at the run's top by the
// content column, the stems run out to the outer corner and down, and the
// hero hangs at the foot. The right margin's plant is mirrored too. Each
// plant is grown once and kept for the windows that follow.
//
// Message { kind: "tile", id, run, fw, h, m, seed, mirror, colourway, inks,
// paper, avoid, dpr, y0, th, rows } -> { id, bitmap, birth, nx, ny, cell,
// rows?, full, ms }:
//   run       a key for the plant: windows with the same key share it
//   fw, h     the run, CSS px (taken as pt)
//   m         where the content column starts, from the run's outer edge
//   mirror    true for the right margin
//   colourway tikz-flora's colourway name (inks.ts COLOURWAYS)
//   inks      { part: ink name } over the colourway's
//   paper     the page's paper (sRGB 0-1)
//   avoid     [[x0, y0, x1, y1], ...] run px (y down) nothing grows in
//   y0, th    the window: its top in the run and its height, px; y0 a
//             whole number of cells
//   rows      (asked) true to be sent the plant's rows profile
//   birth     Float32Array, the growth time of each `cell`-px cell of the
//             window, row by row
//   rows      (sent) Float32Array, per cell row of the run: the growth by
//             which the front has reached that row, never falling
//   full      the growth by which the whole plant has grown
//
// Message { kind: "ornament", id, slot, name, seed, w, h, dpr, colourway,
// inks, paper } -> { id, bitmap, name }: one of the package's ornaments
// drawn alone, a page ornament for the site's own pages (Ornament.svelte):
// kind `name`, or one picked by weight for `slot` from `seed`, in a box
// w x h CSS px.
import { compose, clock, inks, tune, ornaments, Painter, Rng } from "flora/engine";
import { toDisplayList, WebGLRenderer, drawCanvas2D } from "flora";

// The strip kept clear at a run's head and foot (lua/flora/garden.lua).
const END = 24;
// The birth grid's cell, px.
const CELL = 3;
// A plant gets a page's caps on growth for each this many px of its run
// (flora's spec budget), so a long margin is as full as a short one.
const PER_BUDGET = 3000;
// Plants kept for windows still to come.
const KEEP = 4;

let gl = null, glCanvas = null, glFailed = false;

function draw(list, w, h, dpr, y0) {
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (!glFailed) {
    try {
      glCanvas ??= new OffscreenCanvas(pw, ph);
      gl ??= new WebGLRenderer(glCanvas);
      glCanvas.width = pw;
      glCanvas.height = ph;
      gl.draw(list, { scale: dpr, y0 });
      return glCanvas.transferToImageBitmap();
    } catch (e) {
      if (!/WebGL2 is not available|no stencil/.test(String(e?.message))) throw e;
      glFailed = true;
    }
  }
  const c = new OffscreenCanvas(pw, ph);
  drawCanvas2D(c.getContext("2d"), list, { scale: dpr, y0 });
  return c.transferToImageBitmap();
}

const plants = new Map();

// The plant for run key o.run, grown on first asking.
function plantFor(o) {
  const had = plants.get(o.run);
  if (had) {
    plants.delete(o.run);
    plants.set(o.run, had);
    return had;
  }
  const { fw, h, m, mirror } = o;
  // Run px (y down) are the engine's own coordinates turned over: the
  // engine's y is up from the foot, which the run shows at its top.
  const ex = (px) => (mirror ? fw - px : px);
  const closed = (o.avoid ?? []).map(([x0, y0, x1, y1]) => (mirror ? [fw - x1, y0, fw - x0, y1] : [x0, y0, x1, y1]));
  const text = { x0: m, x1: fw, y0: END, y1: h - END };
  const spec = { width: fw, height: h, seed: o.seed, text, lines: [{ ...text }], closed, ornaments: o.ornaments, budget: Math.max(1, h / PER_BUDGET) };
  const pt = new Painter({ width: fw, height: h, palette: paletteOf(o), paper: o.paper });
  pt.frame(mirror ? (x, y) => [fw - x, h - y] : (x, y) => [x, h - y]);
  const planted = compose.plant(spec, pt);
  pt.frame(undefined);
  const list = toDisplayList(pt.scene());
  const k = new clock.GrowthClock(planted.space, planted.stems, 1);
  const nx = Math.ceil(fw / CELL), ny = Math.ceil(h / CELL);
  const birth = new Float32Array(nx * ny), rows = new Float32Array(ny);
  let running = 0, full = 0;
  for (let j = 0; j < ny; j++) {
    let low = Infinity;
    for (let i = 0; i < nx; i++) {
      const b = k.birth(ex((i + 0.5) * CELL), (j + 0.5) * CELL);
      birth[j * nx + i] = b;
      if (b < low) low = b;
      if (b > full) full = b;
    }
    running = Math.max(running, low);
    rows[j] = running;
  }
  const p = { list, birth, rows, nx, ny, full };
  plants.set(o.run, p);
  if (plants.size > KEEP) plants.delete(plants.keys().next().value);
  return p;
}

function paletteOf(o) {
  const way = inks.COLOURWAYS[inks.COLOURWAY_ALIAS[o.colourway] ?? o.colourway];
  return { ...tune.PALETTE, ...(way ?? {}), ...(o.inks ?? {}) };
}

function ornament(o) {
  const rng = new Rng(`ornament ${o.slot} ${o.seed}`);
  const k = o.name ? ornaments.kind(o.name) : ornaments.pick(rng, o.slot);
  if (!k) throw new Error(`margins worker: no ${o.slot} ornament ${o.name ?? ""}`);
  const { w, h } = o;
  // The box keeps clear what the kind may paint past it.
  const pad = k.reach * Math.max(w, h) + 2;
  const pt = new Painter({ width: w, height: h, palette: paletteOf(o), paper: o.paper });
  pt.frame((x, y) => [x, h - y]);
  ornaments.draw(k, pt, rng.fork("draw"), [pad, pad, w - pad, h - pad], {});
  pt.frame(undefined);
  return { bitmap: draw(toDisplayList(pt.scene()), w, h, o.dpr, 0), name: k.name };
}

function tile(o) {
  const t0 = performance.now();
  const p = plantFor(o);
  const bitmap = draw(p.list, o.fw, o.th, o.dpr, o.y0);
  const j0 = Math.round(o.y0 / CELL), j1 = Math.min(p.ny, Math.ceil((o.y0 + o.th) / CELL));
  const birth = p.birth.slice(j0 * p.nx, j1 * p.nx);
  const out = { bitmap, birth, nx: p.nx, ny: j1 - j0, cell: CELL, full: p.full, ms: performance.now() - t0 };
  if (o.rows) out.rows = p.rows.slice();
  return out;
}

self.onmessage = (e) => {
  const { id, kind } = e.data;
  try {
    if (kind === "ornament") {
      const out = ornament(e.data);
      self.postMessage({ id, ...out }, [out.bitmap]);
      return;
    }
    if (kind !== "tile") throw new Error(`margins worker: unknown kind ${kind}`);
    const out = tile(e.data);
    const moved = [out.bitmap, out.birth.buffer];
    if (out.rows) moved.push(out.rows.buffer);
    self.postMessage({ id, ...out }, moved);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack ?? err) });
  }
};
