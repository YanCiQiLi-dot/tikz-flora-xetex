<script>
  // A component's specimen, redrawn shortly after its settings change.
  let { component, values, seed, scale = 1.6 } = $props();

  let src = $state("");
  let error = $state("");
  let busy = $state(false);
  let seconds = $state(null);
  let token = 0;

  $effect(() => {
    const body = JSON.stringify({ values: JSON.parse(values), id: component.id, seed });
    const timer = setTimeout(() => load(body), 250);
    return () => clearTimeout(timer);
  });

  async function load(body) {
    const t = ++token;
    busy = true;
    try {
      const res = await fetch("/api/component", { method: "POST", body });
      const out = await res.json();
      if (t !== token) return;
      if (!res.ok) throw new Error(out.error);
      src = out.png;
      seconds = out.seconds;
      error = "";
    } catch (e) {
      if (t === token) error = String(e.message || e);
    } finally {
      if (t === token) busy = false;
    }
  }
</script>

<figure class="specimen" class:busy>
  <div class="canvas" style="width: {component.w * scale}px; height: {component.h * scale}px">
    {#if src}<img {src} alt="{component.label} specimen" style="width: {component.w * scale}px">{/if}
  </div>
  <figcaption class="muted">
    {#if error}<span class="err">{error}</span>{:else}{component.label}, seed {seed}{seconds !== null ? ` (${seconds} s)` : ""}{/if}
  </figcaption>
</figure>

<style>
  .canvas { background: #fff; border-radius: 6px; overflow: hidden; max-width: 100%; }
  img { display: block; }
  .busy img { opacity: 0.55; transition: opacity 0.2s; }
  figure { margin: 0; }
  figcaption { font-size: 12px; margin-top: 4px; }
  .err { color: var(--err); white-space: pre-wrap; font-family: ui-monospace, monospace; }
</style>
