<script>
  // Ramps a look's settings can produce: nine draws per look, so the bars
  // show the range rather than particular shapes on the page.
  import { ramp, rng } from "./ramp.js";

  let { color, looks } = $props();

  const bars = $derived(looks.map((look) => {
    const r = rng(look.length * 7919);
    return { look, bars: Array.from({ length: 9 }, () => ramp(r, color, look).stops) };
  }));
  const css = (stops) => `linear-gradient(90deg, ${stops.map(([t, c]) => `${c} ${(t * 100).toFixed(0)}%`).join(", ")})`;
</script>

<div class="swatches">
  {#each bars as b}
    <div class="look">
      <div class="muted small">{b.look}</div>
      {#each b.bars as stops}<div class="bar" style="background: {css(stops)}"></div>{/each}
    </div>
  {/each}
</div>

<style>
  .swatches { display: grid; gap: 12px; }
  .look { display: grid; gap: 3px; }
  .bar { height: 10px; border-radius: 5px; }
  .small { font-size: 12px; }
</style>
