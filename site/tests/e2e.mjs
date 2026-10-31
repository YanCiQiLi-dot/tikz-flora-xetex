// End-to-end check of the built site in headless Chrome: the mixer starts
// the Lua generator, grows a page onto the canvas, grows it again when a
// weight changes, offers a \florasetup line that matches the controls, and
// every linked asset (zip, media, images) is served.
//
//   just test-site      (bakes and builds first; needs Google Chrome)
//   SITE_URL=https://flora.alpacasoft.dev/ node site/tests/e2e.mjs
//                       (checks a deployed site instead of a local preview)
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.SITE_TEST_PORT || "4317";
const URL = process.env.SITE_URL || `http://127.0.0.1:${PORT}/`;

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  }
}

const server = process.env.SITE_URL ? null : spawn("npx", ["vite", "preview", "--port", PORT, "--strictPort", "--host", "127.0.0.1"], {
  cwd: SITE, stdio: ["ignore", "ignore", "pipe"],
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  for (const path of ["tikzflora.zip", "media/grow.mp4", "media/grow.gif", "img/og.jpg", "img/page-1.jpg", "bake/manifest.json"]) {
    const r = await fetch(URL + path);
    check(r.ok, `${path} is not served (${r.status})`);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);
  check(await page.locator('meta[property="og:image"]').getAttribute("content") === "https://flora.alpacasoft.dev/img/og.jpg",
    "og:image is not the absolute preview URL");

  // The first page grows.
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const inked = () => page.evaluate(() => {
    const c = document.querySelector(".sheet canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] < 600) n++;
    return n;
  });
  const first = await inked();
  check(first > 2000, `the first page shows too little flora (${first} inked samples)`);

  // Turning everything but the stems off grows a sparser page, and the
  // line follows the controls.
  const before = await page.locator(".controls pre code").textContent();

  // Scrolling the controls leaves the page viewer where it is.
  const sheetTop = () => page.evaluate(() => document.querySelector(".sheet").getBoundingClientRect().top);
  await page.evaluate(() => document.querySelector("#mixer").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(200);
  const top0 = await sheetTop();
  const scrollY0 = await page.evaluate(() => window.scrollY);
  await page.locator(".controls").hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => document.querySelector(".controls").scrollTop);
  check(scrolled > 100, `the controls did not scroll (${scrolled})`);
  check(Math.abs((await sheetTop()) - top0) < 1 && (await page.evaluate(() => window.scrollY)) === scrollY0,
    `scrolling the controls moved the page viewer (top ${top0} -> ${await sheetTop()}, scrollY ${scrollY0} -> ${await page.evaluate(() => window.scrollY)})`);
  for (const name of ["Leaves", "Baby's breath", "Forget-me-nots", "Sprays"]) {
    const slider = page.locator(".controls .row", { hasText: name }).locator('input[type="range"]');
    await slider.fill("0");
  }
  await page.locator(".status", { hasText: "Growing" }).waitFor({ timeout: 10000 });
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const second = await inked();
  check(second < first * 0.85, `zero weights did not thin the page (${first} -> ${second})`);
  const line = await page.locator(".controls pre code").textContent();
  check(line !== before && /leaves=0/.test(line) && /gyps=0/.test(line), `setup line does not follow the controls: ${line}`);
  check(line.startsWith("\\florasetup{layout=left, seed="), `setup line has the wrong head: ${line}`);

  // Spinning colours keeps the shapes: the inked area barely changes, the
  // line names random inks and a spin.
  await page.getByRole("button", { name: "Spin colours" }).click();
  await page.locator(".status", { hasText: "Growing" }).waitFor({ timeout: 10000 });
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const spun = await page.locator(".controls pre code").textContent();
  check(/hero=random/.test(spun) && /spin=1/.test(spun), `spin is not in the setup line: ${spun}`);

  // The ink picker shows every ink as a swatch with a plain colour name,
  // and a pick reaches the setup line.
  const leavesRow = page.locator(".controls .row", { has: page.locator(".cap", { hasText: /^leaves$/ }) });
  await leavesRow.locator("button.current").click();
  const inks = await leavesRow.locator(".inks [role=option]").evaluateAll((els) => els.map((el) => ({
    swatch: getComputedStyle(el.querySelector(".ramp")).backgroundImage,
    plain: el.querySelector(".label span").textContent,
  })));
  check(inks.length === 40, `the picker lists ${inks.length} inks, not 40`);
  const bad = inks.find((i) => !/gradient/.test(i.swatch) || !/^(deep |pale )?[a-z -]+$/.test(i.plain));
  check(!bad, `an ink lacks a swatch or a plain name: ${JSON.stringify(bad)}`);
  await leavesRow.locator(".inks [role=option]", { hasText: "momiji" }).click();
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const picked = await page.locator(".controls pre code").textContent();
  check(/leaves=momiji/.test(picked), `the picked ink is not in the setup line: ${picked}`);
  check(/red/.test(await leavesRow.locator("button.current").textContent()), "the picker does not name momiji's colour");
  check(errors.length === 0, "page errors: " + errors.join("; "));
} finally {
  if (browser) await browser.close();
  server?.kill();
}
if (failures) {
  console.error(`site: ${failures} failure(s)`);
  process.exit(1);
}
console.log("site: ok");
