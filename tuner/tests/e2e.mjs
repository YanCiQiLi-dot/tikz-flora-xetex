// End-to-end check of the built tuner in headless Chrome: dials and curves
// change the values sent to the specimen and page renders, a component's
// reset restores only its own settings, and settings survive a reload.
// Starts its own server; never presses Save or Write, so no file changes.
//
//   just test-tuner      (builds first; needs Google Chrome installed)
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = process.env.TUNER_TEST_PORT || "8799";
const URL = `http://127.0.0.1:${PORT}/`;
const PYTHON = process.env.FLORA_PYTHON || "python3.14";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  }
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("tuner server did not start");
}

const server = spawn(PYTHON, ["-I", "tuner/server.py"], {
  cwd: ROOT, env: { ...process.env, TUNER_PORT: PORT }, stdio: ["ignore", "ignore", "pipe"],
});
let log = "";
server.stderr.on("data", (d) => { log += d; });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  // The values of every render request, newest last, by endpoint.
  const sent = { component: [], render: [] };
  page.on("request", (req) => {
    const m = req.url().match(/\/api\/(component|render)$/);
    if (m && req.method() === "POST") sent[m[1]].push(JSON.parse(req.postData()));
  });
  // Waits until a request to `kind` satisfies `pred`, and returns it.
  async function sentWhere(kind, pred, what) {
    for (let i = 0; i < 100; i++) {
      const hit = sent[kind].findLast(pred);
      if (hit) return hit;
      await page.waitForTimeout(100);
    }
    check(false, `no ${kind} request ${what}`);
    return null;
  }
  const slider = (label) => page.getByRole("slider", { name: label, exact: true });
  async function setSlider(label, frac) {
    const box = await slider(label).boundingBox();
    await page.mouse.click(box.x + box.width * frac, box.y + box.height / 2);
  }

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await slider("Petals").waitFor();
  const defaults = await (await fetch(URL + "api/tune")).json();

  // Hero: a dial reaches both the specimen and the page.
  check(await page.locator(".dialkit-folder-title-root").first().textContent() === "Hero bloom", "hero panel title");
  await setSlider("Petals", 0.97);
  const spec = await sentWhere("component", (b) => b.id === "hero" && b.values.hero.petals > defaults.hero.petals,
    "with more hero petals");
  const petals = spec?.values.hero.petals;
  check(Number.isInteger(petals), `petals stay whole: ${petals}`);
  await sentWhere("render", (b) => b.values.hero.petals === petals, "carrying the new petals to the page");
  await page.waitForFunction(() => {
    const img = document.querySelector(".specimen img");
    return img && img.src.includes("/build/tuner/part-") && img.complete && img.naturalWidth > 0;
  });

  // Leaves: its curve editor adds a point where clicked.
  await page.locator("nav button.part", { hasText: /^Leaves/ }).click();
  await slider("Leaves").waitFor();
  check(!(await slider("Petals").count()), "hero dials gone after switching to leaves");
  const svg = page.getByRole("application", { name: /size curve/ }).first();
  const before = defaults.sizes.leaf.points.length;
  const xs = await svg.locator("circle").evaluateAll((cs) => cs.map((c) => +c.getAttribute("cx")));
  let gap = 0, at = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gap) { gap = xs[i] - xs[i - 1]; at = (xs[i] + xs[i - 1]) / 2; }
  const box = await svg.boundingBox();
  await page.mouse.click(box.x + at * box.width / 300, box.y + box.height * 0.3);
  await sentWhere("component", (b) => b.id === "leaf" && b.values.sizes.leaf.points.length === before + 1,
    "with the added curve point");

  // Resetting leaves restores its curve but keeps the hero's petals.
  await page.getByRole("button", { name: "Reset leaves" }).click();
  const reset = await sentWhere("component",
    (b) => b.id === "leaf" && b.values.sizes.leaf.points.length === before && sent.component.indexOf(b) > 0,
    "after reset");
  check(reset?.values.hero.petals === petals, "reset of leaves kept the hero's petals");

  // Settings survive a reload; Reset all restores the file's defaults.
  await page.reload();
  await page.locator("nav button.part", { hasText: /^Hero bloom/ }).click();
  await slider("Petals").waitFor();
  check(await slider("Petals").getAttribute("aria-valuenow") === String(petals), "petals kept across reload");
  await page.getByRole("button", { name: "Reset all" }).click();
  await page.waitForFunction((n) => {
    const s = document.querySelector('[role=slider][aria-label="Petals"]');
    return s && s.getAttribute("aria-valuenow") === String(n);
  }, defaults.hero.petals);
} catch (e) {
  failures++;
  console.error("FAIL: " + (e.stack || e));
} finally {
  await browser?.close();
  server.kill();
}
if (failures) {
  console.error("server log:\n" + log.split("\n").slice(-20).join("\n"));
  console.error(`tuner: ${failures} failure(s)`);
  process.exit(1);
}
console.log("tuner: ok");
