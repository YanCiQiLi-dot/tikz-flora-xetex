<script>
  import { onMount } from "svelte";
  import { meta as loadMeta, render, draw } from "./render.js";
  import { setupLine } from "./setup.js";

  const GROUPS = [
    { title: "Blooms", keys: ["bloom", "soft", "lily", "ghost", "umbel"] },
    { title: "Sprays and foliage", keys: ["cyme", "gyps", "sprays", "curls", "leaves", "leaflets"] },
    { title: "Visitors", keys: ["bee", "butterfly", "bird", "snail"] },
  ];

  let meta = $state(null);
  let pages = $state([]);
  let layout = $state(0);
  let seed = $state(3);
  let mix = $state({});
  let palette = $state({});
  let spin = $state(0);
  let status = $state("Loading the generator…");
  let busy = $state(false);
  let copied = $state(false);
  let canvas, frame;
  const specs = new Map();
  let timer, again = false;

  const label = (k) => meta?.kinds.find((x) => x[0] === k)?.[1] ?? k;
  const hint = (k) => meta?.kinds.find((x) => x[0] === k)?.[2] ?? "";
  let line = $derived(meta && pages.length ? setupLine({ layout: pages[layout].layout, seed, mix, palette, spin }, meta) : "");

  onMount(async () => {
    try {
      const [m, man] = await Promise.all([loadMeta(), fetch("/bake/manifest.json").then((r) => r.json())]);
      meta = m;
      pages = man;
      mix = Object.fromEntries(m.kinds.map(([k, , , d]) => [k, d]));
      palette = Object.fromEntries(m.parts);
      // Visitors start on here, so the mixer shows them.
      for (const k of ["bee", "butterfly", "bird", "snail"]) mix[k] = 1;
      grow();
    } catch (e) {
      status = `The mixer could not start: ${e.message}`;
    }
  });

  async function spec(p) {
    if (!specs.has(p)) specs.set(p, await fetch(`/bake/spec-${p}.lua`).then((r) => r.text()));
    return specs.get(p);
  }

  async function grow() {
    if (!meta) return;
    if (busy) { again = true; return; }
    busy = true;
    const pg = pages[layout];
    status = "Growing…";
    try {
      const job = { spec: await spec(pg.page), seed, page: pg.page, mix: $state.snapshot(mix), palette: $state.snapshot(palette), spin };
      const out = await render(job);
      await draw(out.pdf, canvas, frame.clientWidth);
      status = `Grown in ${(out.ms / 1000).toFixed(1)} s`;
    } catch (e) {
      status = `Something went wrong: ${e.message}`;
    }
    busy = false;
    if (again) { again = false; grow(); }
  }

  function changed() {
    clearTimeout(timer);
    timer = setTimeout(grow, 500);
  }

  // New inks for every part set to random; the shapes stay as they are.
  function spinColours() {
    for (const [part] of meta.parts) palette[part] = "random";
    spin += 1;
    changed();
  }

  function reroll() {
    seed = Math.floor(Math.random() * 9999) + 1;
    changed();
  }

  async function copy() {
    await navigator.clipboard.writeText(line);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }
</script>

<div class="mixer">
  <div class="controls">
    <h2>Mixer</h2>
    <p class="note">The package's own Lua, running in your browser on a page
      of the example. 1 is the usual amount, 0 none, 2 about twice as
      much.</p>
    {#if meta}
      <h3>Layout</h3>
      <div class="layouts" role="radiogroup" aria-label="Layout">
        {#each pages as p, i}
          <button type="button" role="radio" aria-checked={layout === i} class:on={layout === i}
            onclick={() => { layout = i; changed(); }}>{p.label}</button>
        {/each}
      </div>
      <label class="row">
        <span>Seed</span>
        <input type="number" min="1" max="99999" bind:value={seed} onchange={changed}>
        <button type="button" onclick={reroll}>New</button>
      </label>
      <label class="row" title={hint("density")}>
        <span>{label("density")}</span>
        <input type="range" min="0.2" max="2" step="0.1" bind:value={mix.density} oninput={changed}>
        <output>{mix.density}</output>
      </label>
      {#each GROUPS as g}
        <h3>{g.title}</h3>
        {#each g.keys as k}
          <label class="row" title={hint(k)}>
            <span>{label(k)}</span>
            <input type="range" min="0" max="3" step="0.25" bind:value={mix[k]} oninput={changed}>
            <output>{mix[k]}</output>
          </label>
        {/each}
      {/each}
      <h3>Inks</h3>
      {#each meta.parts as [part]}
        <label class="row">
          <span class="cap">{part}</span>
          <select bind:value={palette[part]} onchange={changed}>
            <option value="look">look</option>
            <option value="random">random</option>
            <optgroup label="Ink groups">
              {#each meta.groups as gname}<option value={gname}>{gname}</option>{/each}
            </optgroup>
            <optgroup label="Inks">
              {#each meta.inks as ink}<option value={ink}>{ink}</option>{/each}
            </optgroup>
          </select>
        </label>
      {/each}
      <p class="spin"><button type="button" onclick={spinColours}>Spin colours</button>
        <span>Random inks for every part. The shapes stay put.</span></p>
    {/if}
    {#if line}
      <h3>Your setting</h3>
      <pre><code>{line}</code></pre>
      <p class="links"><button type="button" onclick={copy}>{copied ? "Copied" : "Copy"}</button>
        <a href="/tikzflora.zip" download>Download tikzflora.zip</a></p>
    {/if}
  </div>

  <div class="viewer">
    <div class="sheet paper" bind:this={frame} class:busy>
      <canvas bind:this={canvas} aria-label="The page's flora"></canvas>
      {#if pages.length}
        <img src={`/bake/text-${pages[layout].page}.png`} alt="The example page's text">
      {/if}
    </div>
    <p class="status" aria-live="polite">{status}</p>
  </div>
</div>

<style>
  /* The controls scroll on their own; the page stays in view. */
  .mixer {
    display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    height: calc(100dvh - var(--bar)); border-top: 1px solid var(--rule);
  }
  .controls { overflow-y: auto; overscroll-behavior: contain; padding: 1.4rem 1.4rem 3rem; border-right: 1px solid var(--rule); }
  .note { color: var(--muted); font-size: .92rem; margin-top: 0; }
  h3 { font-size: 1.05rem; margin: 1.3rem 0 .3rem; }
  .row { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr) 2.4rem; align-items: center; gap: .6rem; padding: .12rem 0; font-size: .93rem; }
  .row > span { color: var(--muted); }
  .cap { text-transform: capitalize; }
  output { font-family: var(--mono); font-size: .8rem; text-align: right; }
  input[type="range"] { width: 100%; accent-color: var(--blue); }
  input[type="number"] { width: 100%; padding: .2rem .4rem; border: 1px solid var(--rule); background: transparent; }
  select { grid-column: 2 / 4; padding: .25rem; border: 1px solid var(--rule); background: var(--paper); }
  button { border: 1px solid var(--rule); background: transparent; padding: .2rem .65rem; cursor: pointer; }
  button:hover { border-color: var(--ink); }
  .layouts { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .4rem; }
  .layouts button.on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .spin { display: flex; gap: .7rem; align-items: center; font-size: .88rem; color: var(--muted); }
  .spin button { flex: none; }
  pre { white-space: pre-wrap; word-break: break-word; margin: .3rem 0; }
  .links { display: flex; gap: 1rem; align-items: center; }
  .viewer { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.2rem; min-height: 0; overflow: hidden; }
  .sheet { position: relative; height: min(100%, calc(100dvh - var(--bar) - 4.5rem)); aspect-ratio: 210 / 297; max-width: 100%; }
  .sheet canvas, .sheet img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .sheet img { mix-blend-mode: multiply; }
  .sheet.busy canvas { opacity: .45; transition: opacity .3s; }
  .status { color: var(--muted); font-size: .85rem; margin: .5rem 0 0; }
  @media (max-width: 860px) {
    .mixer { grid-template-columns: minmax(0, 1fr); grid-template-rows: 52dvh minmax(0, 1fr); height: calc(100dvh - var(--bar)); }
    .viewer { order: -1; padding: .6rem; border-bottom: 1px solid var(--rule); }
    .sheet { height: calc(52dvh - 3rem); }
    .controls { border-right: 0; }
    .row { grid-template-columns: 7rem minmax(0, 1fr) 2.4rem; }
  }
</style>
