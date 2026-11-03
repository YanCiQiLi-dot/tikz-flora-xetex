// The site's margin garden: a plant hangs from the top of each side margin
// and grows down the page as the reader scrolls, painted in by a soft wet
// front. margins.worker.js grows and draws each segment; this module lays
// the segments out, asks for them a little ahead of the reader and reveals
// each one by its birth times.
//
//   const garden = startMargins();   // later: garden.stop()
//
// Each side's margin is what the page's content leaves between itself and
// that edge; a side narrower than MIN_MARGIN grows nothing. Elements marked
// data-flora-avoid (a strip that scrolls across the margins) keep the
// plants out. Segments the reader has scrolled past are shown grown. Under
// prefers-reduced-motion each segment appears whole once grown.
import { gardenAt } from "./garden.js";

// The narrowest margin a plant grows in, px.
export const MIN_MARGIN = 110;
// How far a tile reaches into the column, px: the column's edge band, which
// the engine keeps clear.
const INTO = 30;
// The width of the wet front, in px of growth.
const SOFT = 70;
// The front leads the reader: it heads for this fraction of the viewport.
const LEAD = 0.82;
// Growth speed, px of growth per second: at least SLOW, and CATCH times
// the growth still to go, so the front eases in behind a quick scroll.
const SLOW = 110, CATCH = 0.9;
// Segments are asked for this many viewports ahead of the front.
const AHEAD = 1.5;
// Space kept clear above and below a band, px, and the shortest run of
// margin between bands that grows a plant.
const BAND_GAP = 10, MIN_RUN = 320;
// How far above the viewport's top the front may still be growing, px.
const UNSEEN = 40;

// Segment height for margin m: about a book page's proportion.
export function segmentHeight(m, docH) {
  const target = Math.max(900, Math.min(1500, m * 4.6));
  const n = Math.max(1, Math.round(docH / target));
  return Math.ceil(docH / n);
}

// The segments of one margin, [{ y, h }, ...] down a page `docH` px tall,
// for margin m. `bands` ([[y0, y1], ...], page px) are elements that span
// the whole margin, such as a strip of pictures: a plant ends above each
// band and a fresh one starts below it, and nothing grows behind it. Runs
// between bands are cut into equal segments; the run below the last band
// is cut into segments `openH` tall (segmentHeight of that run when
// omitted), so a page that grows taller only adds segments at its foot.
export function layoutSide(m, bands, docH, openH) {
  const out = [];
  const merged = [];
  for (const [a, b] of [...bands].sort((p, q) => p[0] - q[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + BAND_GAP * 2) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  let start = 0;
  for (const [a, b] of merged) {
    const end = Math.min(docH, a - BAND_GAP), len = end - start;
    if (len >= MIN_RUN) {
      const n = Math.max(1, Math.round(len / segmentHeight(m, len)));
      for (let i = 0; i < n; i++) {
        const y0 = start + Math.round((len * i) / n), y1 = start + Math.round((len * (i + 1)) / n);
        out.push({ y: y0, h: y1 - y0 });
      }
    }
    start = Math.max(start, b + BAND_GAP);
  }
  const rest = docH - start;
  const h = openH ?? (rest >= MIN_RUN ? segmentHeight(m, rest) : 0);
  if (h > 0) for (let y = start; y < docH && docH - y >= Math.min(MIN_RUN, h); y += h) out.push({ y, h });
  return { tiles: out, openH: h };
}

// The growth by which the front has reached local row `r` (px) of a tile
// whose rows profile is `rows` (per cell row) and cell `cell`. Past the
// tile's foot it keeps rising a px of growth per px, so what is born last
// (blooms at the stem ends, gilt) finishes as the front moves on.
export function rowGrowth(rows, cell, r) {
  if (r <= 0) return 0;
  const j = Math.floor(r / cell);
  if (j < rows.length) return rows[j];
  return rows[rows.length - 1] + (r - rows.length * cell);
}

// The page row the front heads for at scroll position `y`: LEAD of the
// way down the viewport, and the whole page once the reader reaches its
// foot (or when it does not scroll).
export function targetRow(y, vh, docH) {
  const max = Math.max(0, docH - vh);
  const end = max <= 0 ? 1 : Math.min(1, y / max) ** 8;
  return Math.min(docH, y + vh * LEAD + end * vh * (1 - LEAD) + (max <= 0 ? docH : 0));
}

// A CSS colour as sRGB 0-1, through a 1 px canvas (oklch and all).
function rgbOf(css) {
  const c = new OffscreenCanvas(1, 1), x = c.getContext("2d");
  x.fillStyle = css;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function client() {
  const worker = new Worker(new URL("./margins.worker.js", import.meta.url), { type: "module" });
  let next = 0;
  const waiting = new Map();
  worker.onmessage = (e) => {
    const p = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    if (!p) return;
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    for (const p of waiting.values()) p.reject(new Error(e.message || "margins worker failed"));
    waiting.clear();
  };
  return {
    post: (msg) => new Promise((resolve, reject) => {
      const id = ++next;
      waiting.set(id, { resolve, reject });
      worker.postMessage({ ...msg, id });
    }),
    stop: () => worker.terminate(),
  };
}

// Fixed per-cell jitter in about [-1, 1], smooth over a few cells, so the
// front's edge is ragged like a wash rather than ruled.
function jitter(nx, ny, seed) {
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
  let b = new Float32Array(a.length);
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

export function startMargins({ doc = document, win = window } = {}) {
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  const at = gardenAt();
  // Two workers, so the two margins grow side by side.
  const workers = [client(), client()];
  const idle = [...workers];
  let layer = null, tiles = [], raf = 0, stopped = false, layoutKey = "";

  // The viewport width, each side's margin (what the page's content leaves
  // between itself and the edge) and the page's height. Content is every
  // element narrower than the viewport, other than what the plants keep
  // out of (data-flora-avoid) and the garden itself.
  function measure() {
    const vw = doc.documentElement.clientWidth;
    let x0 = vw, x1 = 0;
    for (const el of doc.body.querySelectorAll("*")) {
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.closest("[data-flora-avoid], .flora-margins")) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.width >= vw - 1 || r.right <= 0 || r.left >= vw) continue;
      x0 = Math.min(x0, r.left);
      x1 = Math.max(x1, r.right);
    }
    if (x1 <= x0) return null;
    return { vw, ml: Math.floor(x0), mr: Math.floor(vw - x1), docH: Math.ceil(doc.documentElement.scrollHeight) };
  }

  function avoidIn(tile) {
    const out = [];
    for (const el of doc.querySelectorAll("[data-flora-avoid]")) {
      const r = el.getBoundingClientRect();
      const y0 = r.top + win.scrollY - tile.y, y1 = r.bottom + win.scrollY - tile.y;
      const x0 = r.left - tile.x, x1 = r.right - tile.x;
      if (y1 <= 0 || y0 >= tile.h || x1 <= 0 || x0 >= tile.fw) continue;
      out.push([x0 - 6, y0 - 6, x1 + 6, y1 + 6]);
    }
    return out;
  }

  // Side layout: the margin, tile width and segment height of each side
  // wide enough to grow in.
  let sides = [], ground = [1, 1, 1], dpr = 1;

  // The page rows of the full-width bands in a side's margin.
  function bandsOf(side) {
    const out = [];
    for (const el of doc.querySelectorAll("[data-flora-avoid]")) {
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || r.left > side.x + 1 || r.right < side.x + side.fw - 1) continue;
      out.push([Math.floor(r.top + win.scrollY), Math.ceil(r.bottom + win.scrollY)]);
    }
    return out;
  }

  // Add side's segments down to docH that it does not have yet.
  function addTiles(side, docH) {
    const plan = layoutSide(side.m, side.bands, docH, side.openH);
    side.openH = plan.openH;
    const have = tiles.filter((t) => t.mirror === side.mirror).length;
    for (let k = have; k < plan.tiles.length; k++) {
      const { y, h } = plan.tiles[k];
      const canvas = doc.createElement("canvas");
      const tile = {
        k, mirror: side.mirror, fw: side.fw, h, m: side.m, x: side.x, y, canvas,
        state: "idle", u: -1, data: null,
        seed: at.seed * 4 + k * 2 + (side.mirror ? 1 : 0),
      };
      canvas.width = Math.round(side.fw * dpr);
      canvas.height = Math.round(h * dpr);
      Object.assign(canvas.style, { position: "absolute", left: `${tile.x}px`, top: `${y}px`, width: `${side.fw}px`, height: `${h}px` });
      layer.append(canvas);
      tiles.push(tile);
    }
  }

  // What the layout depends on, other than the page's height.
  const keyOf = (g) => (g ? `${g.vw}:${g.ml}:${g.mr}:${JSON.stringify(sidesOf(g).map((sd) => sd.bands))}` : "");

  function sidesOf(g) {
    const out = [];
    for (const [mirror, m] of [[false, g.ml], [true, g.mr]]) {
      if (m < MIN_MARGIN) continue;
      const fw = m + INTO;
      const side = { mirror, m, fw, x: mirror ? g.vw - fw : 0, openH: undefined };
      side.bands = bandsOf(side);
      out.push(side);
    }
    return out;
  }

  function build() {
    const g = measure();
    teardown();
    if (!g) return;
    sides = sidesOf(g);
    layoutKey = keyOf(g);
    if (sides.length === 0) return;
    layer = doc.createElement("div");
    layer.className = "flora-margins";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "absolute", left: "0", top: "0", width: `${g.vw}px`, height: `${g.docH}px`,
      overflow: "hidden", pointerEvents: "none", zIndex: "-1",
    });
    doc.body.append(layer);
    ground = rgbOf(win.getComputedStyle(doc.body).backgroundColor);
    dpr = Math.min(2, Math.max(1, win.devicePixelRatio || 1));
    for (const side of sides) addTiles(side, g.docH);
    kick();
  }

  function teardown() {
    layer?.remove();
    layer = null;
    for (const t of tiles) t.data?.bitmap?.close?.();
    tiles = [];
  }

  const bottom = (t) => t.y + t.h;

  // Ask a free worker for the segment most needed: those in view first,
  // then those ahead of the front, then those the reader has passed.
  function request() {
    if (stopped) return;
    while (idle.length > 0) {
      const top = win.scrollY, vh = win.innerHeight, foot = top + vh;
      const horizon = targetRow(top, vh, parseFloat(layer?.style.height ?? "0")) + vh * AHEAD;
      let best = null, bestScore = Infinity;
      for (const t of tiles) {
        if (t.state !== "idle") continue;
        let score;
        if (bottom(t) > top && t.y < foot) score = t.y - top;
        else if (t.y >= foot) score = t.y < horizon ? 1e5 + t.y : Infinity;
        else score = 1e7 - t.y;
        if (score < bestScore) { bestScore = score; best = t; }
      }
      if (!best) return;
      const w = idle.pop(), t = best;
      t.state = "pending";
      w.post({
        kind: "segment", fw: t.fw, h: t.h, m: t.m, seed: t.seed, mirror: t.mirror, dpr,
        colourway: at.colourway, avoid: avoidIn(t),
        paper: ground,
      }).then((data) => {
        if (!tiles.includes(t)) { data.bitmap.close?.(); return; }
        t.data = { ...data, jitter: jitter(data.nx, data.ny, t.seed) };
        let most = 0;
        for (let i = 0; i < data.birth.length; i++) if (data.birth[i] > most) most = data.birth[i];
        t.data.full = most + SOFT * 1.3;
        t.state = "ready";
      }, (err) => {
        t.state = "failed";
        console.error(err);
      }).finally(() => {
        idle.push(w);
        kick();
      });
    }
  }

  // Paint tile t revealed to growth u.
  function paint(t, u) {
    const d = t.data, ctx = t.canvas.getContext("2d");
    const W = t.canvas.width, H = t.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (u <= 0) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(d.bitmap, 0, 0, W, H);
    if (u >= d.full) return;
    d.mask ??= new OffscreenCanvas(d.nx, d.ny);
    const mc = d.mask.getContext("2d");
    d.pixels ??= mc.createImageData(d.nx, d.ny);
    const px = d.pixels.data, b = d.birth, jit = d.jitter;
    for (let i = 0; i < b.length; i++) {
      let a = (u - b[i] - jit[i] * 16) / SOFT;
      a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
      px[i * 4 + 3] = a * 255;
    }
    mc.putImageData(d.pixels, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(d.mask, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  function finish(t) {
    t.u = t.data.full;
    paint(t, t.u);
    t.state = "done";
    const d = t.data;
    d.birth = d.jitter = d.rows = d.mask = d.pixels = null;
  }

  // Has tile t's side grown far enough for t to start? The segment above
  // must have grown nearly to its foot, or be out of sight above the viewport
  // (where it is finished at once when it arrives).
  function mayStart(t) {
    const above = tiles.find((x) => x.mirror === t.mirror && x.k === t.k - 1);
    if (!above || above.state === "done" || bottom(above) <= win.scrollY) return true;
    return above.state === "ready" && above.u >= above.data.rows[above.data.rows.length - 1] - SOFT * 1.5;
  }

  let last = 0;
  function frame(now) {
    raf = 0;
    if (stopped || !layer) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const target = targetRow(win.scrollY, win.innerHeight, parseFloat(layer.style.height));
    let moving = false;
    for (const t of tiles) {
      if (t.state !== "ready") continue;
      const d = t.data;
      // Nobody watches a segment grow above the viewport.
      if (bottom(t) <= win.scrollY || (reduce.matches && t.y < target)) { finish(t); continue; }
      if (!mayStart(t)) continue;
      const cap = Math.min(d.full, rowGrowth(d.rows, d.cell, target - t.y) + (target > t.y ? SOFT * 0.6 : 0));
      let u = t.u < 0 ? 0 : t.u;
      if (!reduce.matches && u < cap) u = Math.min(cap, u + Math.max(SLOW, (cap - u) * CATCH) * dt);
      // What lies above the viewport is shown grown: nobody saw it grow,
      // and the front should be where the reader is looking.
      if (win.scrollY > t.y) u = Math.max(u, Math.min(cap, rowGrowth(d.rows, d.cell, win.scrollY - t.y - UNSEEN)));
      if (u > t.u + 0.25) {
        t.u = u;
        if (u >= d.full) finish(t);
        else paint(t, u);
      }
      if (u < cap - 0.25) moving = true;
    }
    request();
    if (moving) kick(false);
    else last = 0;
  }

  function kick(reset = true) {
    if (reset) last = 0;
    if (!raf && !stopped) raf = win.requestAnimationFrame(frame);
  }

  // A new width or margin lays the garden out afresh; a taller page (fonts
  // and images arriving) adds segments below, keeping what has grown.
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const g = measure();
      if (keyOf(g) !== layoutKey || !layer) return build();
      const grownH = parseFloat(layer.style.height);
      if (g.docH > grownH + 2) {
        layer.style.height = `${g.docH}px`;
        for (const side of sides) addTiles(side, g.docH);
        kick();
      }
    }, 250);
  }

  const ro = new ResizeObserver(onResize);
  ro.observe(doc.documentElement);
  ro.observe(doc.body);
  const onScroll = () => kick();
  win.addEventListener("scroll", onScroll, { passive: true });
  build();

  const api = {
    stop() {
      stopped = true;
      if (raf) win.cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      ro.disconnect();
      win.removeEventListener("scroll", onScroll);
      teardown();
      for (const w of workers) w.stop();
      if (win.__floraMargins === api) delete win.__floraMargins;
    },
    // For tests: where the front heads, each side's margin, and each tile.
    get state() {
      return {
        target: layer ? targetRow(win.scrollY, win.innerHeight, parseFloat(layer.style.height)) : 0,
        sides: sides.map((s) => ({ mirror: s.mirror, m: s.m, bands: s.bands })),
        tiles: tiles.map((t) => ({ k: t.k, mirror: t.mirror, state: t.state, u: t.u, full: t.data?.full ?? null, y: t.y, h: t.h, ms: t.data?.ms ?? null })),
      };
    },
  };
  // The e2e tests read the garden's state here.
  win.__floraMargins = api;
  return api;
}
