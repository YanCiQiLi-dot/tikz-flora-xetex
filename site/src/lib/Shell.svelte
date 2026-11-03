<script>
  // Every page's running head and colophon. `page` names the current page
  // for the nav; `tool` gives the page the whole screen below the head.
  // Pages that are not tools grow a plant down each side margin
  // (margins.js), loaded once the page is up.
  import { onMount } from "svelte";
  let { page, tool = false, children } = $props();
  onMount(() => {
    if (tool) return;
    let garden, gone = false;
    import("./margins.js").then(({ startMargins }) => {
      if (!gone) garden = startMargins();
    }, (e) => console.error(e));
    return () => {
      gone = true;
      garden?.stop();
    };
  });
  const NAV = [["mixer", "/mixer/", "Mixer"], ["ornaments", "/ornaments/", "Ornaments"], ["guide", "/guide/", "Guide"]];
</script>

<header class="head" class:tool>
  <a class="title" href="/" aria-current={page === "home" ? "page" : undefined}>tikz-flora</a>
  <nav aria-label="Pages">
    {#each NAV as [k, href, label]}
      <a class="sc" {href} aria-current={page === k ? "page" : undefined}>{label}</a>
    {/each}
    <a class="sc get" href="/tikzflora.zip" download>Download</a>
  </nav>
</header>

<main class:tool>
  {@render children()}
</main>

{#if !tool}
  <footer class="colophon">
    <p class="fleuron" aria-hidden="true">❦</p>
    <p>Set in IM Fell English and EB Garamond. Every flower, ink wash and
      ornament on these pages is drawn by the package's own Lua.</p>
    <p class="sc">
      <a href="/guide/#credits">Credits</a> · MIT licence ·
      <a href="https://github.com/wn-mitch/tikz-flora">Source on GitHub</a>
    </p>
  </footer>
{/if}

<style>
  .head {
    display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
    max-width: calc(var(--measure) + var(--gutter) + var(--margin) + 2 * var(--side));
    margin: 0 auto; padding: 1rem var(--side) 0; min-height: var(--bar);
  }
  .head.tool { max-width: none; padding: 0 1.4rem; align-items: center; border-bottom: 1px solid var(--rule); height: var(--bar); }
  .title { font-family: var(--display); font-size: 1.35rem; text-decoration: none; }
  nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .2rem 1.2rem; font-size: 1.08rem; }
  nav a { text-decoration: none; color: var(--muted); }
  nav a:hover, nav a[aria-current="page"] { color: var(--rubric); }
  nav a[aria-current="page"] { text-decoration: underline; text-decoration-color: var(--rubric); text-underline-offset: .3em; }
  main.tool { height: calc(100dvh - var(--bar)); }
  .colophon { max-width: var(--measure); margin: 0 auto; padding: 4rem var(--side) 3rem; text-align: center; font-size: .98rem; color: var(--muted); }
  .colophon p { margin: 0 0 .5rem; }
  .fleuron { font-size: 1.5rem; color: var(--rubric); }
  @media (max-width: 40rem) {
    .head { flex-direction: column; gap: .3rem; padding-top: .8rem; }
    .head.tool { height: auto; padding: .6rem var(--side) .4rem; align-items: flex-start; }
    main.tool { height: auto; }
    nav { justify-content: flex-start; gap: .2rem 1rem; }
    nav a { min-height: 32px; display: inline-flex; align-items: center; }
  }
</style>
