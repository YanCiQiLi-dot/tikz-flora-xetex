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

export async function render(job) {
  return post({ kind: "render", ...job });
}

export async function gallery(job) {
  return post({ kind: "gallery", ...job });
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
