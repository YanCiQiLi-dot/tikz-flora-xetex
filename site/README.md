# flora.alpacasoft.dev

The tikz-flora site: the example pages, the grow animation, a live mixer
and the setup guide. It is a Vite and Svelte app served by a Cloudflare
Worker.

## Recipes

Run these from the repository root. They need Node and the TeX tools
listed in the root README.

- `just site-bake [SEED]`: compile `tex/lorem.tex` and write the
  generated assets to `public/`. Run it once before `site-dev`, and again
  after changing the example or the generator's look.
- `just site-dev`: serve the site with hot reload at
  http://127.0.0.1:5174/.
- `just test-site`: build the site and drive it in headless Chrome
  (`tests/e2e.mjs`). The test checks the assets and the Open Graph image,
  grows a page in the mixer, checks that the controls scroll without
  moving the page, and checks the setup line the mixer writes. Set
  `SITE_URL=https://flora.alpacasoft.dev/` and run
  `node site/tests/e2e.mjs` to check the deployed site instead.
- `just site-deploy`: bake, build and publish with `npx wrangler deploy`.
  It needs a `wrangler login` to the Cloudflare account that holds
  `alpacasoft.dev`. Wrangler creates the DNS record for the custom domain
  set in `wrangler.jsonc`.

## Baked assets

`site-bake` writes these files. They are build output and are not
committed.

| Path | Contents |
|---|---|
| `public/tikzflora.zip` | The drop-in package from `just dist` |
| `public/bake/spec-N.lua` | The measured page specs (text block, lines, header) of example pages 1, 2, 3, 4 and 6 |
| `public/bake/text-N.png` | The text of each of those pages, without flora |
| `public/bake/manifest.json` | Which baked page each mixer layout uses |
| `public/img/page-N.jpg` | Every page of the finished example |
| `public/img/flora-margin.png` | The flora of page 4 alone, behind the guide |
| `public/img/og.jpg` | The 1200 x 630 link preview |
| `public/media/grow.mp4`, `grow.gif` | Page 3 growing |

## The mixer

The mixer runs the package's own Lua in the browser. `vite.config.js`
lets the app import `../lua/flora/*.lua`, so the site always runs the same
generator as the package.

1. `src/lib/render.worker.js` mounts the Lua files into wasmoon (Lua 5.4
   in WebAssembly) in a Web Worker.
2. For each change, `src/lib/Mixer.svelte` sends the worker the baked
   spec of the chosen layout with the seed, mix, palette and spin. The
   worker calls `Compose.page` and returns the PDF bytes from
   `pdfout.lua`.
3. `src/lib/render.js` draws the PDF with pdf.js, and the baked text
   image is multiplied over it.
4. `src/lib/setup.js` writes the `\florasetup{...}` line for the current
   settings.

LuaLaTeX runs Lua 5.3 and wasmoon runs Lua 5.4. `just test-lua54` checks
that both paint identical pages.

## Serving

`worker.js` answers `/media/*` with byte ranges (206 responses), because
iOS Safari plays MP4 only from a server that honours `Range` and Workers
static assets ignore it. Every other path goes to the static assets in
`dist/`.
