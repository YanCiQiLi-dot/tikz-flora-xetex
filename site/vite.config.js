import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The mixer imports the generator's Lua straight from ../lua, so the site
// always runs the same code as the package.
export default defineConfig({
  plugins: [svelte()],
  server: { fs: { allow: [".."] } },
  worker: { format: "es" },
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
