<script>
  // Picks what paints one part: look, random, an ink group or one ink. Each
  // choice shows its colour, so the inks need not be known by name.
  import { face, strip, describe } from "./ink.js";

  let { part, value = $bindable(), meta, onchange } = $props();
  let open = $state(false);
  let root;

  const ramps = $derived(meta.ramps);
  const members = (g) => meta.groupInks[g] ?? [];

  function choose(v) {
    value = v;
    open = false;
    onchange?.();
  }

  function outside(e) {
    if (open && root && !root.contains(e.target)) open = false;
  }

  function key(e) {
    if (e.key === "Escape" && open) {
      open = false;
      root.querySelector(".current")?.focus();
    }
  }

  const title = (v) => v === "look" ? "As designed" : v === "random" ? "Random ink" : ramps[v] ? v : `${v} inks`;
</script>

<svelte:window onclick={outside} onkeydown={key} />

<div class="picker" bind:this={root}>
  <button type="button" class="current" aria-haspopup="listbox" aria-expanded={open}
    aria-label={`${part}: ${title(value)}`} onclick={() => (open = !open)}>
    {#if ramps[value]}
      <span class="chip" style:background={strip(ramps[value])}></span>
    {:else if meta.groupInks[value]}
      <span class="chip chips">{#each members(value) as n}<i style:background={face(ramps[n])}></i>{/each}</span>
    {:else}
      <span class="chip {value}"></span>
    {/if}
    <span class="name">{title(value)}</span>
    {#if ramps[value]}<span class="gloss">{describe(ramps[value])}</span>{/if}
  </button>

  {#if open}
    <div class="panel" role="listbox" aria-label={`Ink for ${part}`}>
      <div class="plain">
        <button type="button" role="option" aria-selected={value === "look"} onclick={() => choose("look")}>
          <span class="chip look"></span>As designed
        </button>
        <button type="button" role="option" aria-selected={value === "random"} onclick={() => choose("random")}>
          <span class="chip random"></span>Random ink
        </button>
      </div>
      <p class="head">Groups</p>
      <div class="groups">
        {#each meta.groups as g}
          <button type="button" role="option" aria-selected={value === g} onclick={() => choose(g)}>
            <span class="chips">{#each members(g) as n}<i style:background={face(ramps[n])}></i>{/each}</span>
            <span>{g}</span>
          </button>
        {/each}
      </div>
      <p class="head">Inks</p>
      <div class="inks">
        {#each meta.inks as n}
          <button type="button" role="option" aria-selected={value === n} title={`${n}: ${describe(ramps[n])}`} onclick={() => choose(n)}>
            <span class="ramp" style:background={strip(ramps[n])}></span>
            <span class="label"><span>{describe(ramps[n])}</span><code>{n}</code></span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .picker { grid-column: 2 / 4; position: relative; min-width: 0; }
  button { font: inherit; color: inherit; cursor: pointer; text-align: left; }
  .current {
    display: flex; align-items: center; gap: .5rem; width: 100%; min-width: 0;
    padding: .25rem .4rem; border: 1px solid var(--rule); background: var(--paper);
  }
  .current:hover { border-color: var(--ink); }
  .name { white-space: nowrap; }
  .gloss { color: var(--muted); font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip { flex: none; width: 2.2rem; height: .9rem; border-radius: 2px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .12); }
  .chips { display: inline-flex; flex: none; width: 2.2rem; height: .9rem; border-radius: 2px; overflow: hidden; }
  .chips i { flex: 1; }
  .chip.look { background: linear-gradient(90deg, oklab(0.45 -0.02 -0.19), oklab(0.93 -0.02 -0.04) 60%, oklab(0.6 -0.09 0.1)); }
  .chip.random { background: conic-gradient(from 90deg, oklab(0.6 0.2 0.05), oklab(0.8 0.05 0.16), oklab(0.6 -0.12 0.05), oklab(0.55 -0.03 -0.19), oklab(0.55 0.13 -0.12), oklab(0.6 0.2 0.05)); }
  .panel {
    position: absolute; z-index: 5; top: calc(100% + 4px); right: 0; width: min(330px, calc(100vw - 32px));
    max-height: 60dvh; overflow-y: auto; overscroll-behavior: contain;
    background: var(--paper); border: 1px solid var(--ink); padding: .6rem; box-shadow: 0 6px 24px rgb(0 0 0 / .18);
  }
  .head { margin: .7rem 0 .3rem; font-size: .78rem; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
  .plain, .groups { display: grid; grid-template-columns: 1fr 1fr; gap: .3rem; }
  .plain button, .groups button {
    display: flex; align-items: center; gap: .45rem; padding: .3rem .4rem; border: 1px solid var(--rule);
    background: transparent; font-size: .88rem;
  }
  .inks { display: grid; grid-template-columns: 1fr 1fr; gap: .3rem; }
  .inks button { display: flex; flex-direction: column; gap: .25rem; padding: .3rem; border: 1px solid var(--rule); background: transparent; }
  .ramp { display: block; height: 1.1rem; border-radius: 2px; }
  .label { display: flex; flex-direction: column; line-height: 1.2; font-size: .82rem; }
  .label code { background: none; padding: 0; color: var(--muted); font-size: .72rem; }
  [role="option"]:hover { border-color: var(--ink); }
  [aria-selected="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
</style>
