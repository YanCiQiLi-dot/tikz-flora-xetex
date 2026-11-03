// Grows one segment of a web page's margin garden (margins.js) with flora's
// engine, draws it finished, and works out when each part of it is born.
//
// A segment is a plant hung from the top of its tile: the engine grows it
// as a printed page's plant, from its root at the foot up to the hero, and
// the tile shows it turned over, so the root sits at the tile's top by the
// content column and the stems run out to the outer corner and down. The
// right margin's tile is mirrored too.
//
// Message { kind: "segment", id, fw, h, m, seed, mirror, dpr, colourway,
// paper, avoid } -> { id, bitmap, birth, rows, reach, cell, ms }:
//   fw, h     the tile, CSS px (taken as pt)
//   m         where the content column starts, from the tile's outer edge
//   mirror    true for the right margin
//   colourway tikz-flora's colourway name (inks.ts COLOURWAYS)
//   paper     the page's paper (sRGB 0-1)
//   avoid     [[x0, y0, x1, y1], ...] tile px (y down) nothing grows in
//   birth     Float32Array, the growth time of each `cell`-px cell of the
//             tile, row by row (tile px, y down)
//   rows      Float32Array, per cell row: the growth by which the front has
//             reached that row, never falling from row to row
//   reach     when the last stem has grown
import { compose, clock, inks, tune, Painter } from "flora/engine";
import { toDisplayList, WebGLRenderer, drawCanvas2D } from "flora";

// The strip kept clear at a segment's head and foot (lua/flora/garden.lua).
const END = 24;
// The birth grid's cell, px.
const CELL = 3;

let gl = null, glCanvas = null, glFailed = false;

function draw(list, w, h, dpr) {
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (!glFailed) {
    try {
      glCanvas ??= new OffscreenCanvas(pw, ph);
      gl ??= new WebGLRenderer(glCanvas);
      glCanvas.width = pw;
      glCanvas.height = ph;
      gl.draw(list, { scale: dpr });
      return glCanvas.transferToImageBitmap();
    } catch (e) {
      if (!/WebGL2 is not available|no stencil/.test(String(e?.message))) throw e;
      glFailed = true;
    }
  }
  const c = new OffscreenCanvas(pw, ph);
  drawCanvas2D(c.getContext("2d"), list, { scale: dpr });
  return c.transferToImageBitmap();
}

function segment(o) {
  const t0 = performance.now();
  const { fw, h, m, mirror } = o;
  // Tile px (y down) are the engine's own coordinates turned over: the
  // engine's y is up from the foot, which the tile shows at its top.
  const ex = (px) => (mirror ? fw - px : px);
  const closed = (o.avoid ?? []).map(([x0, y0, x1, y1]) => (mirror ? [fw - x1, y0, fw - x0, y1] : [x0, y0, x1, y1]));
  const text = { x0: m, x1: fw, y0: END, y1: h - END };
  const spec = { width: fw, height: h, seed: o.seed, text, lines: [{ ...text }], closed, ornaments: o.ornaments };
  const way = inks.COLOURWAYS[inks.COLOURWAY_ALIAS[o.colourway] ?? o.colourway];
  const palette = way ? { ...tune.PALETTE, ...way } : tune.PALETTE;
  const pt = new Painter({ width: fw, height: h, palette, paper: o.paper });
  pt.frame(mirror ? (x, y) => [fw - x, h - y] : (x, y) => [x, h - y]);
  const planted = compose.plant(spec, pt);
  pt.frame(undefined);
  const bitmap = draw(toDisplayList(pt.scene()), fw, h, o.dpr);
  const k = new clock.GrowthClock(planted.space, planted.stems, 1);
  const nx = Math.ceil(fw / CELL), ny = Math.ceil(h / CELL);
  const birth = new Float32Array(nx * ny), rows = new Float32Array(ny);
  let running = 0;
  for (let j = 0; j < ny; j++) {
    let low = Infinity;
    for (let i = 0; i < nx; i++) {
      const b = k.birth(ex((i + 0.5) * CELL), (j + 0.5) * CELL);
      birth[j * nx + i] = b;
      if (b < low) low = b;
    }
    running = Math.max(running, low);
    rows[j] = running;
  }
  return { bitmap, birth, rows, nx, ny, reach: k.reach, cell: CELL, ms: performance.now() - t0 };
}

self.onmessage = (e) => {
  const { id, kind } = e.data;
  try {
    if (kind !== "segment") throw new Error(`margins worker: unknown kind ${kind}`);
    const out = segment(e.data);
    self.postMessage({ id, ...out }, [out.bitmap, out.birth.buffer, out.rows.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack ?? err) });
  }
};
