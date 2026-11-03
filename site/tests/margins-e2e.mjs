// The margin garden (src/lib/margins.js) on the built site in headless
// Chrome: plants grow either side of each page's content and never behind
// it, a reader who jumps down a long page finds the margins grown where
// they look within seconds, tools and phones get none, and reduced motion
// shows each plant whole. Also the layout helpers, without a browser.
//
//   just test-site      (builds first; needs Google Chrome)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { rowGrowth, targetRow, layoutSide, tilesOf, MIN_MARGIN, MIN_RUN, TILE, FIRST_TILE } from "../src/lib/margins-layout.js";

// One plant runs the length of a margin: a page with no bands is one run.
assert.deepEqual(layoutSide([], 15567), [{ y: 0, h: 15567 }]);
// A full-width band breaks the margin: a plant runs up to it and another
// starts just below it; none overlaps a band or another; bands that
// overlap count as one; a sliver too short to grow in is left bare.
{
  const docH = 6000, bands = [[1800, 2400], [2300, 2500], [3900, 4000]];
  const runs = layoutSide(bands, docH);
  assert.equal(runs.length, 3, JSON.stringify(runs));
  for (const r of runs) for (const [a, b] of bands) assert.ok(r.y + r.h <= a || r.y >= b, `run ${JSON.stringify(r)} overlaps band ${a}-${b}`);
  assert.equal(runs[0].y, 0);
  assert.ok(runs[0].h >= 1780 && runs[0].h < 1800, "the run above the first band does not reach it");
  assert.ok(runs[1].y > 2500 && runs[1].y <= 2520, "no run starts just below the merged band");
  assert.ok(runs[2].y > 4000 && runs[2].y + runs[2].h === docH, "the last run does not reach the foot");
  assert.ok(layoutSide([[100, 300]], 3000)[0].y >= 300, "a sliver above a band grows a plant");
  assert.ok(layoutSide([], MIN_RUN - 1).length === 0, "a page shorter than a run grows a plant");
}
// A run is drawn in windows that cover it exactly, each a whole number of
// birth cells from its top.
for (const h of [320, 1200, 1201, 15567]) {
  const ws = tilesOf(h);
  assert.equal(ws[0].y, 0);
  for (let i = 1; i < ws.length; i++) assert.equal(ws[i].y, ws[i - 1].y + ws[i - 1].h);
  assert.equal(ws[ws.length - 1].y + ws[ws.length - 1].h, h);
  for (const w of ws) assert.ok(w.y % 3 === 0 && w.h <= TILE && w.h > 0, `window ${JSON.stringify(w)} of ${h}`);
  assert.ok(ws[0].h <= FIRST_TILE, `the first window of ${h} is ${ws[0].h} tall`);
}
// The front's growth by row never falls, and carries on past the foot
// without a jump.
{
  const rows = Float32Array.from([0, 5, 5, 12, 30]);
  let prev = -1;
  for (let r = -3; r < 40; r += 0.5) {
    const g = rowGrowth(rows, 3, r);
    assert.ok(g >= prev, `rowGrowth falls at row ${r}`);
    prev = g;
  }
  assert.equal(rowGrowth(rows, 3, 15), 30);
  assert.equal(rowGrowth(rows, 3, 25), 40);
}
// The front leads the reader, and takes in the whole page at its foot or
// on a page that does not scroll.
assert.ok(targetRow(0, 800, 5000) > 600 && targetRow(0, 800, 5000) < 800);
assert.equal(targetRow(4200, 800, 5000), 5000);
assert.equal(targetRow(0, 800, 700), 700);
for (let y = 0; y <= 4200; y += 300) assert.ok(targetRow(y, 800, 5000) >= y + 600, `the front trails the reader at ${y}`);

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.SITE_TEST_PORT_MARGINS || "4318";
const URL = `http://127.0.0.1:${PORT}/`;
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL: " + msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn("npx", ["vite", "preview", "--port", PORT, "--strictPort", "--host", "127.0.0.1"], { cwd: SITE, stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* not up yet */ }
    await sleep(150);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const errors = [];
  const open = async (path, o = {}) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, ...o });
    p.on("pageerror", (e) => errors.push(`${path}: ${e}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`${path}: ${m.text()}`); });
    await p.goto(URL + path);
    return p;
  };
  const state = (p) => p.evaluate(() => window.__floraMargins?.state ?? null);
  // The share of inked samples in the margins' canvases over page rows
  // y0..y1, per side.
  const inked = (p, y0, y1) => p.evaluate(([y0, y1]) => {
    const out = { left: [0, 0], right: [0, 0] };
    for (const c of document.querySelectorAll(".flora-margins canvas")) {
      const top = parseFloat(c.style.top), h = parseFloat(c.style.height), k = c.height / h;
      const a = Math.max(y0, top), b = Math.min(y1, top + h);
      if (b <= a) continue;
      const d = c.getContext("2d").getImageData(0, Math.floor((a - top) * k), c.width, Math.ceil((b - a) * k)).data;
      const side = parseFloat(c.style.left) === 0 ? out.left : out.right;
      for (let i = 3; i < d.length; i += 4 * 5) { side[1]++; if (d[i] > 40) side[0]++; }
    }
    return { left: out.left[0] / Math.max(1, out.left[1]), right: out.right[0] / Math.max(1, out.right[1]) };
  }, [y0, y1]);

  // Both margins grow on the home page, from the top corners.
  {
    const p = await open("");
    await sleep(4000);
    const s = await state(p);
    check(s && s.sides.length === 2, `home: margins ${JSON.stringify(s?.sides)}`);
    // One plant above the strip of pages and one below, on each side.
    for (const mirror of [false, true]) {
      const n = s?.runs.filter((r) => r.mirror === mirror).length;
      check(n === 2, `home: the ${mirror ? "right" : "left"} margin grows ${n} plants, not 2`);
    }
    const overlap = await p.evaluate(() => {
      const band = document.querySelector("[data-flora-avoid]").getBoundingClientRect();
      return [...document.querySelectorAll(".flora-margins canvas")].map((c) => c.getBoundingClientRect())
        .filter((r) => r.bottom > band.top && r.top < band.bottom).length;
    });
    check(overlap === 0, `home: ${overlap} margin tiles grow behind the strip of pages`);
    const top = await inked(p, 0, 400);
    check(top.left > 0.08 && top.right > 0.08, `home: the top corners are bare after 4 s (${JSON.stringify(top)})`);
    await p.close();
  }

  // On the guide the plants stay out of the sticky plate and the contents
  // column, which sit outside the running head; and a reader who jumps
  // halfway down finds the margins grown in view within seconds (the
  // plant above the viewport is not regrown out of sight first).
  {
    const p = await open("guide/");
    await p.locator(".flora-margins canvas").first().waitFor({ state: "attached" });
    const edges = await p.evaluate(() => {
      const cs = [...document.querySelectorAll(".flora-margins canvas")];
      const reach = (left) => cs.filter((c) => (parseFloat(c.style.left) === 0) === left).map((c) => c.getBoundingClientRect());
      const content = [...document.querySelectorAll("main *, header *, aside *, nav *")].filter((e) => !e.closest("[data-flora-avoid]"))
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.width < document.documentElement.clientWidth - 1);
      return {
        leftEnd: Math.max(...reach(true).map((r) => r.right)), rightStart: Math.min(...reach(false).map((r) => r.left)),
        contentL: Math.min(...content.map((r) => r.left)), contentR: Math.max(...content.map((r) => r.right)),
      };
    });
    // A tile reaches INTO (30 px) into the column's clear edge band, no more.
    check(edges.leftEnd <= edges.contentL + 31, `guide: the left garden reaches ${edges.leftEnd}, content starts at ${edges.contentL}`);
    check(edges.rightStart >= edges.contentR - 31, `guide: the right garden starts at ${edges.rightStart}, content ends at ${edges.contentR}`);
    // The guide's 15,000 px margin is one plant a side, not a stack.
    const runs = (await state(p))?.runs ?? [];
    check(runs.length === 2 && runs.every((r) => r.y === 0), `guide: plants ${JSON.stringify(runs.map((r) => [r.mirror, r.y, r.h]))}`);
    await sleep(1000);
    // A slow catch-up, so only the rule under test (what lies above the
    // viewport is shown grown) can fill the view in time.
    await p.evaluate(() => window.__floraMargins.tune({ catch: 0.3 }));
    const y = await p.evaluate(() => {
      const y = Math.round((document.documentElement.scrollHeight - innerHeight) * 0.5);
      window.scrollTo(0, y);
      return y;
    });
    // Once the tiles in view are drawn (how long that takes is the
    // machine's business), 2 s takes the view most of the way to grown;
    // regrowing the part above the viewport first leaves it nearly bare
    // that long.
    await p.waitForFunction(() => window.__floraMargins.state.tiles
      .filter((t) => t.y < scrollY + innerHeight && t.y + t.h > scrollY)
      .every((t) => t.state === "ready" || t.state === "done"), null, { timeout: 60000 });
    await sleep(2000);
    const soon = await inked(p, y, y + 480);
    await sleep(4000);
    const grown = await inked(p, y, y + 480);
    for (const k of ["left", "right"]) {
      check(grown[k] > 0.04, `guide: the ${k} margin in view is bare once grown (${grown[k]})`);
      check(soon[k] >= grown[k] * 0.6, `guide: the ${k} margin in view is ${soon[k]} inked 2 s after a jump, ${grown[k]} grown`);
    }
    await p.close();
  }

  // Under reduced motion each plant in view appears whole.
  {
    const p = await open("", { reducedMotion: "reduce" });
    await p.waitForFunction(() => {
      const s = window.__floraMargins?.state;
      return s && s.tiles.filter((t) => t.y < innerHeight).every((t) => t.state === "done");
    }, null, { timeout: 15000 }).catch(() => check(false, "reduced motion: the plants in view never finish"));
    await p.close();
  }

  // Tools keep their margins to themselves, and a phone has none to give.
  {
    const p = await open("mixer/");
    await sleep(1500);
    check(await p.locator(".flora-margins").count() === 0, "mixer: a margin garden grows on a tool page");
    await p.close();
    const phone = await open("", { viewport: { width: 390, height: 844 } });
    await sleep(1500);
    const s = await state(phone);
    check(s && s.sides.length === 0 && (await phone.locator(".flora-margins").count()) === 0,
      `phone: margins under ${MIN_MARGIN} px grow ${JSON.stringify(s?.sides)}`);
    await phone.close();
  }

  // The gear opens the dials without the panel or the gear counting as
  // content (both margins still grow); the dials' tuning moves the front,
  // and new inks grow the garden afresh.
  {
    const p = await open("");
    await p.locator("button.gear").click();
    await p.locator(".dialkit-root").waitFor({ state: "attached", timeout: 10000 });
    await sleep(1500);
    const s = await state(p);
    check(s?.sides.length === 2, `dials: the margins with the panel open are ${JSON.stringify(s?.sides)}`);
    const moved = await p.evaluate(() => {
      const g = window.__floraMargins, a = g.state.target;
      g.tune({ lead: 0.4 });
      return [a, g.state.target];
    });
    check(moved[1] < moved[0] - 100, `dials: a shorter lead leaves the front at ${moved[1]} (was ${moved[0]})`);
    const regrown = await p.evaluate(async () => {
      const g = window.__floraMargins;
      g.tune({ inks: { leaves: "ku-jaku" } });
      return g.state.tiles.every((t) => t.state === "idle" || t.state === "pending") && g.tuning.inks.leaves === "ku-jaku";
    });
    check(regrown, "dials: new inks do not grow the garden afresh");
    await p.close();
  }

  // The package's ornaments set between the plates draw, each a kind of
  // its slot, and gild in once seen.
  {
    const p = await open("");
    const n = await p.locator(".ornament").count();
    check(n >= 5, `home: ${n} ornaments`);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForFunction(() => document.querySelector("footer .ornament.gilt"), null, { timeout: 15000 })
      .catch(() => check(false, "the colophon's tailpiece never gilds in"));
    const kinds = await p.evaluate(() => [...document.querySelectorAll(".ornament")].map((o) => [o.dataset.slot, o.dataset.kind]));
    const drawn = kinds.filter(([, k]) => k);
    check(drawn.length >= 2, `ornaments drawn: ${JSON.stringify(kinds)}`);
    await p.close();
  }

  // A tile once drawn is kept: in the same browser the page's second visit
  // reads its first tiles from the cache, without growing the plant, and
  // they look as they did when drawn.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const firstTile = (p) => p.evaluate(() => {
      const c = document.querySelector(".flora-margins canvas");
      return [...c.getContext("2d").getImageData(0, 0, c.width, c.height).data];
    });
    const visit = async () => {
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(`cache: ${e}`));
      await p.goto(URL);
      await p.waitForFunction(() => window.__floraMargins?.state.tiles[0]?.state === "done", null, { timeout: 60000 });
      const t = await p.evaluate(() => window.__floraMargins.state.tiles[0].timing);
      const px = await firstTile(p);
      await sleep(1500); // the cache is written after the reply
      await p.close();
      return { t, px };
    };
    const a = await visit(), b = await visit();
    check(!a.t?.cached && a.t?.compose > 0, `cache: the first visit did not grow its plant (${JSON.stringify(a.t)})`);
    check(b.t?.cached === 1, `cache: the second visit grew its plant again (${JSON.stringify(b.t)})`);
    let worst = 0;
    for (let i = 0; i < Math.min(a.px.length, b.px.length); i++) worst = Math.max(worst, Math.abs(a.px[i] - b.px[i]));
    check(a.px.length === b.px.length && worst <= 2, `cache: the cached tile differs from the drawn one by ${worst}/255`);
    await ctx.close();
  }

  // Stopping removes the garden and its hook.
  {
    const p = await open("");
    await sleep(800);
    const gone = await p.evaluate(() => {
      window.__floraMargins.stop();
      return !document.querySelector(".flora-margins") && !window.__floraMargins;
    });
    check(gone, "stop() leaves the garden behind");
    await p.close();
  }
  check(errors.length === 0, "page errors: " + errors.join("; "));
} finally {
  if (browser) await browser.close();
  server.kill();
}
if (failures) {
  console.error(`margins: ${failures} failure(s)`);
  process.exit(1);
}
console.log("margins: ok");
