// Draws a page's flora on a canvas from the package's own PDF content
// stream (lua/flora/pdfout.lua M.scene): the same operators LuaLaTeX puts
// in the PDF, replayed with the 2D canvas API instead of a PDF reader. It
// knows exactly the operators paint.lua writes (OPERATORS, which
// tests/test_scene_ops.lua holds paint.lua to) and throws on any other, so
// a new operator in paint.lua fails loudly rather than drawing wrong.
import OPERATORS from "./scene-ops.json";

const KNOWN = new Set(OPERATORS);
const BLEND = { Normal: "source-over", Multiply: "multiply", Screen: "screen" };

// Draw `scene` onto 2D context `ctx`, `scale` device pixels per bp, over
// whatever the context already holds.
export function paint(ctx, scene, scale) {
  const { content, gs, patterns } = scene;
  ctx.save();
  // PDF space: bp, y up from the page's lower-left corner.
  ctx.setTransform(scale, 0, 0, -scale, 0, scene.height * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let st = { ca: 1, CA: 1, blend: "source-over", fill: "#000", stroke: "#000", width: 1 };
  const stack = [];
  let path = new Path2D();
  let nums = [];
  let name = null;
  const rgb = (n) => `rgb(${n.map((v) => Math.round(v * 255)).join(",")})`;
  const use = (alpha) => {
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = st.blend;
  };
  const gradient = (p) => {
    const [x0, y0, x1, y1] = p.coords;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [t, r, gg, b] of p.stops) g.addColorStop(Math.min(1, Math.max(0, t)), rgb([r, gg, b]));
    return g;
  };
  const end = () => { path = new Path2D(); };
  let clipping = false;

  let i = 0;
  const n = content.length;
  while (i < n) {
    let c = content.charCodeAt(i);
    if (c <= 32) { i++; continue; }
    let j = i + 1;
    while (j < n && content.charCodeAt(j) > 32) j++;
    const tok = content.slice(i, j);
    i = j;
    c = tok.charCodeAt(0);
    if ((c >= 48 && c <= 57) || c === 45 || c === 46) { nums.push(+tok); continue; }
    if (c === 47) { name = tok.slice(1); continue; }
    if (!KNOWN.has(tok)) throw new Error(`scene: unknown operator ${tok}`);
    switch (tok) {
      case "q": stack.push(st); st = { ...st }; ctx.save(); break;
      case "Q": st = stack.pop(); ctx.restore(); break;
      case "gs": {
        const g = gs[name];
        if (!g) throw new Error(`scene: no state ${name}`);
        st.ca = g[0]; st.CA = g[1]; st.blend = BLEND[g[2]] ?? "source-over";
        break;
      }
      case "rg": st.fill = rgb(nums); break;
      case "RG": st.stroke = rgb(nums); break;
      case "w": st.width = nums[0]; break;
      case "J": case "j": break;  // always round (1), set once above
      case "cs": break;           // only /Pattern; scn names the pattern
      case "scn": {
        const p = patterns[name];
        if (!p) throw new Error(`scene: no pattern ${name}`);
        st.fill = gradient(p);
        break;
      }
      case "m": path.moveTo(nums[0], nums[1]); break;
      case "l": path.lineTo(nums[0], nums[1]); break;
      case "c": path.bezierCurveTo(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
      case "h": path.closePath(); break;
      case "W": clipping = true; break;
      case "n":
        if (clipping) ctx.clip(path);
        clipping = false;
        end();
        break;
      case "f": case "f*":
        use(st.ca);
        ctx.fillStyle = st.fill;
        ctx.fill(path, tok === "f*" ? "evenodd" : "nonzero");
        end();
        break;
      case "S":
        use(st.CA);
        ctx.strokeStyle = st.stroke;
        // As in PDF readers, no stroke is thinner than one device pixel.
        ctx.lineWidth = Math.max(st.width, 1 / scale);
        ctx.stroke(path);
        end();
        break;
    }
    nums = [];
  }
  if (stack.length) throw new Error(`scene: ${stack.length} unclosed q`);
  ctx.restore();
}
