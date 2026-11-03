// The margin garden (src/lib/margins.js) on the built site in headless
// Chrome: plants grow either side of each page's content and never behind
// it, a reader who jumps down a long page finds the margins grown where
// they look within seconds, tools and phones get none, and reduced motion
// shows each segment whole. Also the layout helpers, without a browser.
//
//   just test-site      (builds first; needs Google Chrome)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { segmentHeight, rowGrowth, targetRow, MIN_MARGIN } from "../src/lib/margins.js";

// Segments tile the page exactly: whole segments, none past the foot.
for (const [m, docH] of [[116, 15567], [282, 4068], [110, 600], [400, 100000]]) {
  const h = segmentHeight(m, docH), n = Math.ceil(docH / h);
  assert.ok(n * h >= docH && (n - 1) * h < docH, `m ${m}, page ${docH}: ${n} segments of ${h}`);
  assert.ok(docH < 900 || (h >= 600 && h <= 2250), `m ${m}, page ${docH}: segment ${h} px`);
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
    const top = await inked(p, 0, 400);
    check(top.left > 0.08 && top.right > 0.08, `home: the top corners are bare after 4 s (${JSON.stringify(top)})`);
    await p.close();
  }

  // On the guide the plants stay out of the sticky plate and the contents
  // column, which sit outside the running head; and a reader who jumps
  // halfway down finds the margins grown in view within seconds (the
  // segment above the viewport is not regrown out of sight first).
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
    await sleep(1000);
    const y = await p.evaluate(() => {
      const y = Math.round((document.documentElement.scrollHeight - innerHeight) * 0.5);
      window.scrollTo(0, y);
      return y;
    });
    // About a quarter of the samples are inked once grown; regrowing the
    // segment above first leaves under a tenth at 2 s.
    await sleep(2000);
    const view = await inked(p, y, y + 480);
    check(view.left > 0.15 && view.right > 0.15, `guide: the margins in view are bare 2 s after a jump (${JSON.stringify(view)})`);
    await p.close();
  }

  // Under reduced motion each segment in view appears whole.
  {
    const p = await open("", { reducedMotion: "reduce" });
    await p.waitForFunction(() => {
      const s = window.__floraMargins?.state;
      return s && s.tiles.filter((t) => t.y < innerHeight).every((t) => t.state === "done");
    }, null, { timeout: 15000 }).catch(() => check(false, "reduced motion: the segments in view never finish"));
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
