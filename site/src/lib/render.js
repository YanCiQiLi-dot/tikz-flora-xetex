// The main thread's side of the render worker, and drawing its PDF.
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

let worker, next = 0;
const waiting = new Map();

function post(msg) {
  worker ||= (() => {
    const w = new Worker(new URL("./render.worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      const p = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (!p) return;
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    return w;
  })();
  const id = ++next;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });
}

export async function meta() {
  return (await post({ kind: "meta" })).meta;
}

// Ornament gold: computed per pixel by default (lua/flora/orn_raster.lua),
// the vector relief with ?gilt=vector; ?giltenv=mirror makes raster gold
// reflect the vector relief's surroundings, and ?giltlook=horizon=0.1,
// grain=0 changes keys of the look as \florasetup{giltlook={...}} does.
const query = new URLSearchParams(globalThis.location?.search ?? "");
const gilt = query.get("gilt") === "vector" ? "vector" : "raster";
const giltenv = query.get("giltenv") === "mirror" ? "mirror" : "studio";
const giltlook = query.get("giltlook") ?? "";

export async function render(job) {
  return post({ kind: "render", gilt, giltenv, giltlook, ...job });
}

export async function gallery(job) {
  return post({ kind: "gallery", gilt, giltenv, giltlook, ...job });
}

// The renderer: "canvas" (default) draws the content stream in the worker
// (scene.js); "pdf" draws a PDF with pdf.js, for comparison (?renderer=pdf).
export const renderer = new URLSearchParams(globalThis.location?.search ?? "").get("renderer") === "pdf" ? "pdf" : "canvas";

// The picture's width in device pixels for `width` CSS pixels, when the
// worker draws it; undefined when pdf.js does.
export function px(width) {
  return renderer === "canvas" ? Math.round(width * (window.devicePixelRatio || 1)) : undefined;
}

// Show a worker's output on `canvas` at `width` CSS pixels: its bitmap, or
// its PDF drawn by pdf.js.
export async function show(out, canvas, width) {
  if (!out.bitmap) return draw(out.pdf, canvas, width);
  canvas.width = out.bitmap.width;
  canvas.height = out.bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(out.bitmap, 0, 0);
  out.bitmap.close();
}

// Draw PDF bytes on `canvas` at `width` CSS pixels.
export async function draw(bytes, canvas, width) {
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const ratio = window.devicePixelRatio || 1;
    const vp = page.getViewport({ scale: (width / base.width) * ratio });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
  } finally {
    await task.destroy();
  }
}
