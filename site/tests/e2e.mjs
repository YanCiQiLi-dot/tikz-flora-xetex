// End-to-end check of the built site in headless Chrome: every page is
// served with its own link preview and links only to pages and assets that
// exist; the mixer starts the Lua generator, grows a page onto the canvas,
// grows it again when a weight changes and offers a \florasetup line that
// matches the controls; a colourway on the home page opens in the mixer;
// the ornaments page draws every kind.
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
const PAGES = { home: "", mixer: "mixer/", ornaments: "ornaments/", guide: "guide/" };
const MIXER = URL + PAGES.mixer;
const ORNAMENTS = URL + PAGES.ornaments;

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
  for (const path of ["tikzflora.zip", "media/grow.mp4", "media/grow.gif", "img/og.jpg", "img/page-1.jpg", "bake/manifest.json",
    "img/colourway-0.jpg", "img/colourway-1.jpg", "img/colourway-2.jpg", "img/flora-margin.png"]) {
    const r = await fetch(URL + path);
    check(r.ok, `${path} is not served (${r.status})`);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Each page has its own title and link preview, marks itself in the nav,
  // and links only to things that are served.
  const titles = new Set();
  const links = new Set();
  for (const [name, path] of Object.entries(PAGES)) {
    await page.goto(URL + path);
    const og = (k) => page.locator(`meta[property="og:${k}"]`).getAttribute("content");
    check(await og("image") === "https://flora.alpacasoft.dev/img/og.jpg", `${name}: og:image is not the absolute preview URL`);
    check(await og("url") === `https://flora.alpacasoft.dev/${path}`, `${name}: og:url is ${await og("url")}`);
    check(await page.locator('link[rel="canonical"]').getAttribute("href") === await og("url"), `${name}: canonical differs from og:url`);
    check(!!(await og("description")), `${name}: no og:description`);
    titles.add(await page.title());
    const current = await page.locator('[aria-current="page"]').first().getAttribute("href");
    check(current === `/${path}`, `${name}: the nav marks ${current} as current`);
    for (const href of await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")))) links.add(href.split("#")[0]);
  }
  check(titles.size === Object.keys(PAGES).length, `pages share titles: ${[...titles].join(" | ")}`);
  for (const href of links) {
    const r = await fetch(new globalThis.URL(href, URL));
    check(r.ok, `the link ${href} is not served (${r.status})`);
  }
  await page.goto(MIXER);
  const code = () => page.locator(".controls pre code").textContent();
  const grown = async () => {
    await page.locator(".status", { hasText: "Growing" }).waitFor({ timeout: 10000 });
    await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  };
  // Inked samples of the canvas, and how many of them are blue.
  const inked = () => page.evaluate(() => {
    const c = document.querySelector(".sheet canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0, blue = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] < 600) {
        n++;
        if (d[i + 2] > d[i] + 40 && d[i + 2] > d[i + 1] + 15) blue++;
      }
    }
    return { n, blue: blue / Math.max(1, n) };
  });

  // The mixer starts on the first colourway: a full page with little blue.
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const first = await inked();
  check(first.n > 2000, `the first page shows too little flora (${first.n} inked samples)`);
  check(first.blue < 0.1, `the first colourway is ${(first.blue * 100).toFixed(0)}% blue`);
  check(/seed=11,/.test(await code()) && /colourway=ember\}$/.test(await code()), `the mixer does not start on the first colourway: ${await code()}`);

  // The canvas renderer (scene.js) draws what pdf.js draws from the same
  // page's PDF, up to antialiasing: few sampled pixels differ visibly.
  const pixels = (p, at = ".sheet canvas") => p.evaluate((at) => {
    const c = document.querySelector(at);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    // Each sample averages a 3 x 3 block over white paper, so a hairline
    // antialiased half a pixel differently does not count as a difference.
    const out = [];
    for (let y = 0; y + 3 <= c.height; y += 3) {
      for (let x = 0; x + 3 <= c.width; x += 3) {
        const sum = [0, 0, 0];
        for (let v = 0; v < 3; v++) {
          for (let u = 0; u < 3; u++) {
            const i = ((y + v) * c.width + x + u) * 4, a = d[i + 3] / 255;
            for (let k = 0; k < 3; k++) sum[k] += d[i + k] * a + 255 * (1 - a);
          }
        }
        out.push(...sum.map((v) => Math.round(v / 9)));
      }
    }
    return { w: Math.floor(c.width / 3), h: Math.floor(c.height / 3), px: out };
  }, at);
  // Samples that differ visibly between two pictures, of those inked.
  const compare = (a, b) => {
    const w = Math.min(a.w, b.w), h = Math.min(a.h, b.h);
    let differ = 0, ink = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * a.w + x) * 3, j = (y * b.w + x) * 3;
        const d = Math.max(Math.abs(a.px[i] - b.px[j]), Math.abs(a.px[i + 1] - b.px[j + 1]), Math.abs(a.px[i + 2] - b.px[j + 2]));
        if (b.px[j] + b.px[j + 1] + b.px[j + 2] < 720) ink++;
        if (d > 48) differ++;
      }
    }
    return { differ, ink };
  };
  {
    const viaPdf = await context.newPage();
    await viaPdf.goto(MIXER + "?renderer=pdf");
    await viaPdf.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
    check(/pdf\.js/.test(await viaPdf.locator(".status").textContent()), "?renderer=pdf did not draw with pdf.js");
    const [a, b] = [await pixels(page), await pixels(viaPdf)];
    await viaPdf.close();
    const { differ, ink } = compare(a, b);
    console.log(`renderers: ${differ} of ${ink} inked samples differ (${((differ / Math.max(1, ink)) * 100).toFixed(2)}%), sizes ${a.w}x${a.h} / ${b.w}x${b.h}`);
    check(Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1, `the renderers draw different sizes (${a.w}x${a.h}, ${b.w}x${b.h})`);
    check(ink > 2000 && differ < ink * 0.03, `canvas and pdf.js differ at ${differ} of ${ink} inked samples`);

    // Gold is raster by default (the page above). The vector relief
    // (?gilt=vector) and the mirror look (?giltenv=mirror) also draw on the
    // canvas as pdf.js draws them. This page holds little gold, so the
    // gallery below checks that each one changes it.
    for (const [q, label] of [["?gilt=vector", "vector gilt"], ["?giltenv=mirror", "mirror gilt"]]) {
      const [alt, altPdf] = [await context.newPage(), await context.newPage()];
      await alt.goto(MIXER + q);
      await altPdf.goto(MIXER + q + "&renderer=pdf");
      for (const p of [alt, altPdf]) await p.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 240000 });
      console.log(`${label}: ${await alt.locator(".status").textContent()} / pdf.js: ${await altPdf.locator(".status").textContent()}`);
      const [c, d] = [await pixels(alt), await pixels(altPdf)];
      await alt.close();
      await altPdf.close();
      const r = compare(c, d);
      console.log(`${label} renderers: ${r.differ} of ${r.ink} inked samples differ`);
      check(r.ink > 2000 && r.differ < r.ink * 0.03, `with ${label}, canvas and pdf.js differ at ${r.differ} of ${r.ink} inked samples`);
    }
  }

  // The mixer fills the screen, and scrolling the controls leaves the page
  // viewer where it is.
  const sheetTop = () => page.evaluate(() => document.querySelector(".sheet").getBoundingClientRect().top);
  check(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), "the mixer page scrolls as a whole");
  const top0 = await sheetTop();
  const scrollY0 = await page.evaluate(() => window.scrollY);
  await page.locator(".controls").hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => document.querySelector(".controls").scrollTop);
  check(scrolled > 100, `the controls did not scroll (${scrolled})`);
  check(Math.abs((await sheetTop()) - top0) < 1 && (await page.evaluate(() => window.scrollY)) === scrollY0,
    `scrolling the controls moved the page viewer (top ${top0} -> ${await sheetTop()}, scrollY ${scrollY0} -> ${await page.evaluate(() => window.scrollY)})`);

  // The original look is blue, and spinning has nothing to spin in it.
  await page.getByRole("button", { name: "Original blue" }).click();
  await grown();
  const original = await inked();
  check(original.blue > 0.3, `the original look is only ${(original.blue * 100).toFixed(0)}% blue; the measure is broken`);
  check(await page.getByRole("button", { name: "Spin random inks" }).isDisabled(), "Spin random inks is enabled with no random part");

  // Zero weights (behind their disclosures) grow a sparser page, and the
  // line follows the controls.
  for (const summary of await page.locator(".controls summary").all()) await summary.click();
  for (const name of ["Leaves", "Baby's breath", "Forget-me-nots", "Sprays"]) {
    await page.locator(".controls details .row", { hasText: name }).locator('input[type="range"]').fill("0");
  }
  await grown();
  const second = await inked();
  check(second.n < original.n * 0.85, `zero weights did not thin the page (${original.n} -> ${second.n})`);
  const line = await code();
  check(/leaves=0/.test(line) && /gyps=0/.test(line), `setup line does not follow the controls: ${line}`);
  check(line.startsWith("\\florasetup{layout=left, seed="), `setup line has the wrong head: ${line}`);

  // An ornament weight reaches the setup line, and the page regrows.
  await page.locator(".controls details.ornaments .row", { hasText: "Crescent moon" }).locator('input[type="range"]').fill("5");
  await grown();
  check(/ornaments=\{[^}]*moon=5/.test(await code()), `the ornament weight is not in the setup line: ${await code()}`);

  // Randomise sets every part random; a hand-picked ink then survives a spin.
  await page.getByRole("button", { name: "Randomise all inks" }).click();
  await grown();
  check(/hero=random/.test(await code()) && /spin=1/.test(await code()), `randomise is not in the setup line: ${await code()}`);

  // The ink picker shows every ink as a swatch with a plain colour name; it
  // answers the keyboard, and a pick reaches the setup line.
  const leavesRow = page.locator(".controls .row", { has: page.locator(".cap", { hasText: /^Leaves$/ }) });
  const trigger = leavesRow.locator("button.current");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("role") + ":" + document.activeElement?.textContent.trim().slice(0, 30));
  check(/^option:/.test(await focused()), `opening the picker did not focus an option (${await focused()})`);
  const at0 = await focused();
  await page.keyboard.press("ArrowDown");
  check(/^option:/.test(await focused()) && (await focused()) !== at0, "ArrowDown did not move to the next option");
  await page.keyboard.press("Escape");
  check(await leavesRow.locator("[role=listbox]").count() === 0, "Escape did not close the picker");
  check(await trigger.evaluate((el) => el === document.activeElement), "Escape did not return focus to the picker");
  await trigger.click();
  const inks = await leavesRow.locator(".inks [role=option]").evaluateAll((els) => els.map((el) => ({
    swatch: getComputedStyle(el.querySelector(".ramp")).backgroundImage,
    plain: el.querySelector(".text span").textContent,
  })));
  check(inks.length === 40, `the picker lists ${inks.length} inks, not 40`);
  const bad = inks.find((i) => !/gradient/.test(i.swatch) || !/^(deep |pale )?[a-z -]+$/.test(i.plain));
  check(!bad, `an ink lacks a swatch or a plain name: ${JSON.stringify(bad)}`);
  await leavesRow.locator(".inks [role=option]", { hasText: "momiji" }).click();
  await grown();
  check(/leaves=momiji/.test(await code()), `the picked ink is not in the setup line: ${await code()}`);
  check(/red/.test(await trigger.textContent()), "the picker does not name momiji's colour");
  await page.getByRole("button", { name: "Spin random inks" }).click();
  await grown();
  check(/leaves=momiji/.test(await code()) && /spin=2/.test(await code()), `spinning lost the hand-picked ink: ${await code()}`);

  // The complete document carries the settings and compiles as written.
  await page.getByRole("button", { name: "Copy complete document" }).click();
  const doc = await page.evaluate(() => navigator.clipboard.readText());
  check(doc.includes("\\documentclass") && doc.includes("\\usepackage{tikzflora}") && doc.includes(await code()),
    `the copied document lacks the package or the settings:\n${doc}`);

  // The home page shows the four seasons; one opens in the mixer, which
  // names it in the setup line, and one changed ink follows it there.
  await page.goto(URL);
  check(await page.locator(".ways figure").count() === 4, "the home plate does not show four seasons");
  await page.locator(".ways figure").nth(1).getByRole("link", { name: "Use these inks" }).click();
  await page.waitForURL(/\/mixer\/\?way=summer$/);
  await page.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  check(/seed=83,/.test(await code()) && /colourway=summer\}$/.test(await code()), `summer did not load: ${await code()}`);
  check(await page.getByRole("button", { name: "Summer" }).getAttribute("aria-pressed") === "true", "the Summer button is not marked");
  const heroPick = page.locator(".controls .row", { has: page.locator(".cap", { hasText: /^Main flower$/ }) });
  await heroPick.locator("button.current").click();
  await heroPick.locator(".inks [role=option]", { hasText: "momiji" }).click();
  await grown();
  check(/colourway=summer, palette=\{hero=momiji\}/.test(await code()), `a changed ink is not written after the colourway: ${await code()}`);

  // The gallery opens on the flourishes, labelled, once it scrolls near;
  // the All tab draws every ornament kind.
  const sample = () => page.evaluate(() => {
    const c = document.querySelector(".plate canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 11) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] < 600) n++;
    const box = document.querySelector(".plate").getBoundingClientRect();
    const tags = [...document.querySelectorAll(".plate .tag")];
    const out = tags.filter((t) => { const r = t.getBoundingClientRect(); return r.left < box.left - 1 || r.top < box.top - 1; });
    return { n, tags: tags.length, out: out.map((t) => t.textContent.trim()), names: tags.map((t) => t.querySelector("code").textContent) };
  });
  await page.goto(ORNAMENTS);
  await page.locator("#gallery .count", { hasText: /\d+ kinds/ }).waitFor({ timeout: 120000 });
  const flourishes = await sample();
  check(flourishes.names.includes("copperplate") && flourishes.names.includes("rinceau") && !flourishes.names.includes("night"),
    `the flourish tab labels: ${flourishes.names.join(", ")}`);
  check(await page.locator("#gallery .about").textContent() !== "", "the flourish tab does not say what a flourish is");
  await page.locator("#gallery .tabs").getByRole("tab", { name: "All" }).click();
  await page.locator("#gallery .count", { hasText: new RegExp(`^(?!${flourishes.tags} kinds)\\d+ kinds`) }).waitFor({ timeout: 120000 });
  const plate = await sample();
  check(plate.n > 3000, `the gallery shows too little (${plate.n} inked samples)`);
  check(plate.tags >= 36 && plate.names.includes("cul_de_lampe") && plate.names.includes("night"), `the gallery labels ${plate.tags} kinds: ${plate.names.join(", ")}`);
  check(plate.out.length === 0, `gallery labels fall outside the sheet: ${plate.out.join("; ")}`);

  // The vector relief, the mirror look and a changed key of the look
  // (?giltlook=, as \florasetup's giltlook) each change the gallery's gold.
  const allKinds = async (p) => {
    await p.locator("#gallery").scrollIntoViewIfNeeded();
    await p.locator("#gallery .count", { hasText: /\d+ kinds/ }).waitFor({ timeout: 120000 });
    await p.locator("#gallery .tabs").getByRole("tab", { name: "All" }).click();
    await p.locator("#gallery .count", { hasText: `${plate.tags} kinds` }).waitFor({ timeout: 120000 });
    return pixels(p, ".plate canvas");
  };
  const gallery = await pixels(page, ".plate canvas");
  for (const [q, label] of [["?gilt=vector", "vector gilt"], ["?giltenv=mirror", "mirror gilt"], ["?giltlook=ground=0,sky=0.3", "darker gilt"]]) {
    const alt = await context.newPage();
    await alt.goto(ORNAMENTS + q);
    const { differ, ink } = compare(gallery, await allKinds(alt));
    await alt.close();
    console.log(`${label} gallery: ${differ} of ${ink} inked samples differ from the default`);
    check(differ > ink * 0.02, `${label} drew the same gallery as the default (${differ} of ${ink} samples differ)`);
  }

  // In dark mode the gallery's sheet stays paper, as its ornaments and
  // labels are drawn for it.
  await page.emulateMedia({ colorScheme: "dark" });
  const sheetBg = await page.evaluate(() => getComputedStyle(document.querySelector(".plate")).backgroundColor);
  check(sheetBg === "rgb(255, 255, 255)", `the gallery sheet is ${sheetBg} in dark mode`);
  await page.emulateMedia({ colorScheme: "light" });

  // Phones: no page scrolls sideways, and the mixer's page stays in view
  // while the inks are chosen.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on("pageerror", (e) => errors.push(String(e)));
  for (const [name, path] of Object.entries(PAGES)) {
    await phone.goto(URL + path);
    const wide = await phone.evaluate(() => document.documentElement.scrollWidth);
    check(wide <= 390, `the ${name} page scrolls sideways on a phone (${wide}px)`);
  }
  await phone.goto(MIXER);
  await phone.locator(".status", { hasText: "Grown in" }).waitFor({ timeout: 120000 });
  const heroRow = phone.locator(".controls .row", { has: phone.locator(".cap", { hasText: /^Main flower$/ }) });
  await heroRow.scrollIntoViewIfNeeded();
  await heroRow.locator("button.current").click();
  const sheet = await phone.evaluate(() => document.querySelector(".sheet").getBoundingClientRect().toJSON());
  check(sheet.top >= 0 && sheet.bottom <= 844 * 0.5, `the phone page is not kept in view (${JSON.stringify(sheet)})`);
  const panelBox = await heroRow.locator("[role=listbox]").boundingBox();
  check(panelBox && panelBox.width >= 300, "the phone picker does not open across the controls");
  await phone.close();
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
