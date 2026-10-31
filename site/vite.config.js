import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

// The mixer imports the generator's Lua straight from ../lua, so the site
// always runs the same code as the package. Each page is its own HTML
// entry, so only the mixer and the ornaments load the generator.
export default defineConfig({
  plugins: [svelte()],
  server: { fs: { allow: [".."] } },
  worker: { format: "es" },
  build: {
    outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: Object.fromEntries(["index", "mixer/index", "ornaments/index", "guide/index"]
        .map((p) => [p.replace("/index", ""), resolve(import.meta.dirname, `${p}.html`)])),
    },
  },
});
