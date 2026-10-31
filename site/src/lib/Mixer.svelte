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
  let status = $state("Loading the generator…");
  let busy = $state(false);
  let copied = $state(false);
  let canvas, frame;
  const specs = new Map();
  let timer, again = false;

  const label = (k) => meta?.kinds.find((x) => x[0] === k)?.[1] ?? k;
  const hint = (k) => meta?.kinds.find((x) => x[0] === k)?.[2] ?? "";
  let line = $derived(meta && pages.length ? setupLine({ layout: pages[layout].layout, seed, mix, palette }, meta) : "");

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
      const job = { spec: await spec(pg.page), seed, page: pg.page, mix: $state.snapshot(mix), palette: $state.snapshot(palette) };
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

<h2>Mix your own margin</h2>
<p class="col">
  This runs the package's own Lua in your browser, on a page of the example.
  Set the weights, pick inks, then copy the line into your document. A weight
  of 1 is the usual amount, 0 is none, and 2 is about twice as much. Each
  page takes a few seconds to grow.
</p>

<div class="mixer">
  <div class="controls">
    {#if meta}
      <fieldset>
        <legend>Layout and seed</legend>
        <div class="layouts" role="radiogroup" aria-label="Layout">
          {#each pages as p, i}
            <button type="button" role="radio" aria-checked={layout === i} class:on={layout === i}
              onclick={() => { layout = i; changed(); }}>{p.label}</button>
          {/each}
        </div>
        <label class="row">
          <span>Seed</span>
          <input type="number" min="1" max="99999" bind:value={seed} onchange={changed}>
          <button type="button" onclick={reroll}>Another</button>
        </label>
        <label class="row slider" title={hint("density")}>
          <span>{label("density")}</span>
          <input type="range" min="0.2" max="2" step="0.1" bind:value={mix.density} oninput={changed}>
          <output>{mix.density}</output>
        </label>
      </fieldset>
      {#each GROUPS as g}
        <fieldset>
          <legend>{g.title}</legend>
          {#each g.keys as k}
            <label class="row slider" title={hint(k)}>
              <span>{label(k)}</span>
              <input type="range" min="0" max="3" step="0.25" bind:value={mix[k]} oninput={changed}>
              <output>{mix[k]}</output>
            </label>
          {/each}
        </fieldset>
      {/each}
      <fieldset>
        <legend>Inks</legend>
        {#each meta.parts as [part]}
          <label class="row">
            <span class="cap">{part}</span>
            <select bind:value={palette[part]} onchange={changed}>
              <option value="look">look (default gradients)</option>
              <optgroup label="Ink groups">
                {#each meta.groups as gname}<option value={gname}>{gname}</option>{/each}
              </optgroup>
              <optgroup label="Inks">
                {#each meta.inks as ink}<option value={ink}>{ink}</option>{/each}
              </optgroup>
            </select>
          </label>
        {/each}
      </fieldset>
    {/if}
  </div>

  <div class="preview">
    <div class="sheet" bind:this={frame} class:busy>
      <canvas bind:this={canvas} aria-label="The page's flora"></canvas>
      {#if pages.length}
        <img src={`/bake/text-${pages[layout].page}.png`} alt="The example page's text">
      {/if}
    </div>
    <p class="status" aria-live="polite">{status}</p>
    {#if line}
      <div class="out">
        <pre><code>{line}</code></pre>
        <div class="actions">
          <button type="button" onclick={copy}>{copied ? "Copied" : "Copy"}</button>
          <a href="/tikzflora.zip" download>Download tikzflora.zip</a>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .mixer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 2rem; margin-top: 1.4rem; align-items: start; }
  fieldset { border: 1px solid var(--rule); border-radius: 8px; padding: .6rem .9rem .8rem; margin: 0 0 1rem; background: var(--sheet); }
  legend { font-family: var(--mono); font-size: .74rem; letter-spacing: .12em; text-transform: uppercase; color: var(--gold); padding: 0 .3rem; }
  .row { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr) auto; align-items: center; gap: .6rem; padding: .22rem 0; font-size: .95rem; }
  .row > span { color: var(--muted); }
  .cap { text-transform: capitalize; }
  output { font-family: var(--mono); font-size: .82rem; min-width: 2.6rem; text-align: right; }
  input[type="range"] { width: 100%; accent-color: var(--blue); }
  input[type="number"] { width: 100%; padding: .25rem .4rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--paper); }
  select { grid-column: 2 / 4; padding: .3rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--paper); }
  button { border: 1px solid var(--rule); background: var(--paper); border-radius: 5px; padding: .3rem .7rem; cursor: pointer; }
  button:hover { border-color: var(--blue); }
  .layouts { display: flex; flex-wrap: wrap; gap: .4rem; margin: .2rem 0 .5rem; }
  .layouts button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
  .preview { position: sticky; top: 70px; }
  .sheet { position: relative; aspect-ratio: 210 / 297; background: #fff; border-radius: 3px; box-shadow: 0 10px 30px rgb(0 0 0 / .14); overflow: hidden; }
  .sheet canvas, .sheet img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .sheet img { mix-blend-mode: multiply; }
  .sheet.busy canvas { opacity: .45; transition: opacity .3s; }
  .status { color: var(--muted); font-size: .9rem; margin: .5rem 0; }
  .out pre { white-space: pre-wrap; word-break: break-word; margin: .4rem 0; }
  .out .actions { display: flex; gap: 1rem; align-items: center; }
  @media (max-width: 860px) {
    .mixer { grid-template-columns: minmax(0, 1fr); }
    .preview { position: static; order: -1; }
    .row { grid-template-columns: 7.5rem minmax(0, 1fr) auto; }
  }
</style>
