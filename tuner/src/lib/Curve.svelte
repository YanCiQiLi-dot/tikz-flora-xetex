<script>
  // A size curve: a smooth spline through draggable control points. Drag a
  // point to move it (the end points stay at the ends of the range); click
  // empty space to add a point there; double-click a point to remove it.
  // The range ends are typed in.
  import { untrack } from "svelte";
  import { spline, pointsOf } from "./spline.js";

  let { curve, label, text, onchange } = $props();

  // The editor owns its points once mounted; the parent re-keys it to load
  // another curve (a reset, or another component).
  const initial = untrack(() => curve);
  const W = 300, H = 110, P = 10;
  let points = $state(pointsOf(initial).map((p) => [p[0], p[1]]));
  let lo = $state(initial.range[0]);
  let hi = $state(initial.range[1]);
  let drag = $state(null);
  let svg;

  const px = (x) => P + x * (W - 2 * P);
  const py = (w) => H - P - w * (H - 2 * P);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = (v) => Math.round(v * 1000) / 1000;

  const line = $derived.by(() => {
    const f = spline(points);
    let d = "";
    for (let i = 0; i <= 120; i++) d += `${i ? "L" : "M"}${px(i / 120).toFixed(1)},${py(clamp(f(i / 120), 0, 1)).toFixed(1)}`;
    return d;
  });
  const area = $derived(`${line}L${px(1)},${py(0)}L${px(0)},${py(0)}Z`);
  const peak = $derived.by(() => {
    const f = spline(points);
    let best = 0, bx = 0;
    for (let i = 0; i <= 100; i++) if (f(i / 100) > best) { best = f(i / 100); bx = i / 100; }
    return lo + (hi - lo) * bx;
  });

  function at(e) {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) * W / r.width - P) / (W - 2 * P);
    const w = (H - P - (e.clientY - r.top) * H / r.height) / (H - 2 * P);
    return [clamp(x, 0, 1), clamp(w, 0, 1)];
  }
  function commit() {
    onchange({ range: [lo, hi], points: points.map((p) => [round(p[0]), round(p[1])]) });
  }
  function grab(e, i) {
    e.stopPropagation();
    drag = i;
    svg.setPointerCapture(e.pointerId);
  }
  function add(e) {
    const [x, w] = at(e);
    let i = points.findIndex((p) => p[0] > x);
    if (i <= 0) return;
    if (x - points[i - 1][0] < 0.03 || points[i][0] - x < 0.03) return;
    points.splice(i, 0, [x, w]);
    drag = i;
    svg.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (drag === null) return;
    const [x, w] = at(e);
    const n = points.length;
    const nx = drag === 0 ? 0 : drag === n - 1 ? 1 : clamp(x, points[drag - 1][0] + 0.02, points[drag + 1][0] - 0.02);
    points[drag] = [nx, w];
  }
  function release() {
    if (drag === null) return;
    drag = null;
    commit();
  }
  function remove(e, i) {
    e.stopPropagation();
    if (i > 0 && i < points.length - 1) {
      points.splice(i, 1);
      commit();
    }
  }
  function setRange() {
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo < hi) commit();
  }
</script>

<div class="curve" title={text}>
  <div class="head"><span>{label}</span><span class="muted">most common {peak.toFixed(2)}</span></div>
  <svg bind:this={svg} viewBox="0 0 {W} {H}" role="application" aria-label="{label} size curve"
       onpointerdown={add} onpointermove={move} onpointerup={release} onpointercancel={release}>
    <line x1={P} x2={W - P} y1={py(0)} y2={py(0)} class="axis" />
    <path d={area} class="area" />
    <path d={line} class="line" />
    {#each points as p, i}
      <circle cx={px(p[0])} cy={py(p[1])} r="5.5" class:end={i === 0 || i === points.length - 1}
              role="button" tabindex="-1" aria-label="control point {i + 1}"
              onpointerdown={(e) => grab(e, i)} ondblclick={(e) => remove(e, i)} />
    {/each}
  </svg>
  <div class="range">
    from <input type="number" step="0.05" bind:value={lo} onchange={setRange}>
    to <input type="number" step="0.05" bind:value={hi} onchange={setRange}>
  </div>
  {#if text}<p class="muted small">{text}</p>{/if}
</div>

<style>
  .curve { display: grid; gap: 4px; }
  .head { display: flex; justify-content: space-between; font-weight: 600; font-size: 12.5px; }
  svg { width: 100%; height: auto; background: var(--card); border-radius: 6px; touch-action: none; cursor: crosshair; }
  .axis { stroke: var(--rule); }
  .area { fill: var(--accent); fill-opacity: 0.16; }
  .line { fill: none; stroke: var(--accent); stroke-width: 1.6; }
  circle { fill: var(--accent); cursor: grab; }
  circle.end { fill: var(--card); stroke: var(--accent); stroke-width: 2; }
  .range { font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center; }
  input { width: 64px; font: inherit; color: var(--ink); background: transparent; border: 1px solid var(--rule); border-radius: 4px; padding: 1px 4px; }
  .small { font-size: 12px; margin: 0; }
</style>
