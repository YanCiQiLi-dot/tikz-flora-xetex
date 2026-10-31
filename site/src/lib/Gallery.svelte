<script>
  // Every ornament kind the package registers (lua/flora/gallery.lua),
  // drawn by the package's own Lua for three seeds, labelled with the name
  // that ornaments={...} weighs it by.
  import { onMount } from "svelte";
  import { gallery, draw } from "./render.js";
  import COLOURWAYS from "./colourways.json";

  let canvas, frame;
  let sheet = $state(null);
  let way = $state(-1);
  let base = $state(0);
  let status = $state("");
  let busy = $state(false);
  let started = false;

  async function show() {
    if (busy) return;
    busy = true;
    status = "Drawing…";
    try {
      const palette = way < 0 ? {} : COLOURWAYS[way].palette;
      const out = await gallery({ palette, spin: 0, base });
      await draw(out.pdf, canvas, frame.clientWidth);
      sheet = { w: out.w, h: out.h, cells: out.cells };
      status = `${out.cells.length} kinds`;
    } catch (e) {
      status = `Something went wrong: ${e.message}`;
    }
    busy = false;
  }

  // Draw once the section comes near the screen; the sheet is large.
  onMount(() => {
    const seen = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting) && !started) {
        started = true;
        seen.disconnect();
        show();
      }
    }, { rootMargin: "600px" });
    seen.observe(frame);
    return () => seen.disconnect();
  });
</script>

<div class="bar">
  <label>
    <span>Inks</span>
    <select bind:value={way} onchange={show}>
      <option value={-1}>Original blue</option>
      {#each COLOURWAYS as c, i}<option value={i}>{c.name}</option>{/each}
    </select>
  </label>
  <button type="button" onclick={() => { base += 3; show(); }} disabled={busy}>New seeds</button>
  <span class="count" aria-live="polite">{status}</span>
</div>
<div class="plate paper" bind:this={frame} class:busy style:aspect-ratio={sheet ? `${sheet.w} / ${sheet.h}` : "600 / 2600"}>
  <canvas bind:this={canvas} aria-label="Every ornament kind, three seeds each"></canvas>
  {#if sheet}
    {#each sheet.cells as c}
      <span class="tag" style:left={`${(c.x / sheet.w) * 100}%`} style:top={`${(c.y / sheet.h) * 100}%`}>
        <span class="name">{c.label}</span> <code>{c.name}</code>
      </span>
    {/each}
  {/if}
</div>

<style>
  .bar { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin: 0 0 .8rem; }
  .bar label { display: flex; gap: .45rem; align-items: center; }
  .bar span { color: var(--muted); font-size: .9rem; }
  select, button { border: 1px solid var(--control); background: transparent; padding: .35rem .6rem; min-height: 36px; }
  button { cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  .plate { position: relative; width: 100%; max-width: 720px; overflow: clip; background: var(--paper); }
  .plate canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .plate.busy canvas { opacity: .45; transition: opacity .3s; }
  .tag { position: absolute; transform: translateY(-100%); color: #2b2b2b; font-size: clamp(.62rem, 1.6vw, .8rem); white-space: nowrap; padding-bottom: 2px; }
  .tag code { color: #767676; font-size: .9em; }
  @media (max-width: 860px) {
    .bar { padding-inline: 0; }
    button, select { min-height: 44px; }
    /* Narrow sheets keep only the name to weigh each kind by. */
    .tag .name { display: none; }
  }
</style>
