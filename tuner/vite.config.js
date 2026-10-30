import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Built into tuner/dist, which tuner/server.py serves at /. `npm run dev`
// serves the app with hot reload at /tuner/dist/ and forwards API calls,
// renders and the reference image to a running server.py.
const server = "http://127.0.0.1:8766";

export default defineConfig({
  base: "/tuner/dist/",
  plugins: [svelte()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": server, "/build": server, "/tex": server } },
});
