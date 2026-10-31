// Serves the built site from static assets. Workers static assets ignore
// Range requests, which iOS Safari needs to play video, so /media/* answers
// byte ranges itself.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/media/")) return env.ASSETS.fetch(request);
    const res = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
    const range = request.headers.get("Range");
    if (!res.ok || !range) {
      const headers = new Headers(res.headers);
      headers.set("Accept-Ranges", "bytes");
      return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers });
    }
    const body = await res.arrayBuffer();
    const size = body.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start, end;
    if (m && m[1] !== "") {
      start = Number(m[1]);
      end = m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else if (m && m[2] !== "") {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    if (start === undefined || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const headers = new Headers(res.headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : body.slice(start, end + 1), { status: 206, headers });
  },
};
