<script>
  import Mixer from "./lib/Mixer.svelte";
  import Guide from "./lib/Guide.svelte";

  const pages = [1, 2, 3, 4, 5, 6, 7];
  const captions = {
    1: "title", 2: "surround", 3: "split, odd page", 4: "split, even page",
    5: "split, with birds", 6: "centered", 7: "density 0.6",
  };
</script>

<header class="top">
  <div class="wrap bar">
    <a class="brand" href="#top">tikz-flora</a>
    <nav>
      <a href="#mixer">Mixer</a>
      <a href="#guide">Guide</a>
      <a href="#credits">Credits</a>
      <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>
    </nav>
  </div>
</header>

<main id="top">
  <section class="wrap hero">
    <div class="intro">
      <p class="eyebrow">A LuaLaTeX package</p>
      <h1>Margins that <em>grow</em></h1>
      <p class="lede">
        Every page grows its own watercolour plant around the text it holds:
        stems, leaves, blooms, sprays and gilt, and if you like, bees,
        butterflies, birds and snails. Everything is computed in Lua and
        drawn through PGF, with no images.
      </p>
      <p class="origin">
        This project exists because of the r/LaTeX thread
        <a href="https://old.reddit.com/r/LaTeX/comments/1xixznw/how_do_you_make_these_flowers_in_latex/">How do you make these flowers in LaTeX?</a>
        and Kevin Raymond's
        <a href="https://github.com/kevinraymond/florilegium">florilegium</a>,
        whose grown margins, animation and visitors it follows.
      </p>
      <p class="actions">
        <a class="button primary" href="/tikzflora.zip" download>Download tikzflora.zip</a>
        <a class="button" href="#mixer">Mix your own margin</a>
      </p>
    </div>
    <figure class="grow">
      <video src="/media/grow.mp4" poster="/img/page-3.jpg" autoplay muted loop playsinline
        aria-label="A page of text while its margin flora grows from the root">
        <img src="/media/grow.gif" alt="A page of text while its margin flora grows from the root">
      </video>
      <figcaption>A page of the example document as its flora grows (<code>just grow</code>).</figcaption>
    </figure>
  </section>

  <section class="wrap gallery" aria-label="The example document">
    <h2>One document, every layout</h2>
    <p class="col">
      The example in the zip is seven pages of lorem ipsum. It uses every
      layout and changes the mix partway through, with a comment at every
      setting.
    </p>
    <div class="strip">
      {#each pages as p}
        <figure>
          <a href={`/img/page-${p}.jpg`}><img src={`/img/page-${p}.jpg`} alt={`Example page ${p}: ${captions[p]}`} loading="lazy"></a>
          <figcaption>{p} · {captions[p]}</figcaption>
        </figure>
      {/each}
    </div>
  </section>

  <section class="wrap" id="mixer">
    <Mixer />
  </section>

  <section class="wrap" id="guide">
    <Guide />
  </section>

  <section class="wrap credits" id="credits">
    <h2>Credits</h2>
    <div class="col">
      <p>tikz-flora would not exist without two sources:</p>
      <ul>
        <li>The r/LaTeX thread
          <a href="https://old.reddit.com/r/LaTeX/comments/1xixznw/how_do_you_make_these_flowers_in_latex/">How do you make these flowers in LaTeX?</a>.
          Its photographed page is the reference this renderer is measured
          against: its stems, its blues and its gilt.</li>
        <li>Kevin Raymond's <a href="https://github.com/kevinraymond/florilegium">florilegium</a>
          (MIT). It showed how a grown margin, a watch-it-grow animation and a
          few visitors could work in LuaLaTeX.</li>
      </ul>
      <p>
        The ink colours are Pilot iroshizuku ramps, scanned from dense to
        pale and published by
        <a href="https://madoromi.moonwit.ch/#palettes/colours">madoromi</a>.
        The growth follows Wong, Zongker and Salesin,
        <a href="https://grail.cs.washington.edu/projects/ornament/ornament.pdf">Computer-Generated Floral Ornament</a>
        (SIGGRAPH 1998). In the browser, the mixer runs the package's own Lua
        with <a href="https://github.com/ceifa/wasmoon">wasmoon</a> and draws
        it with <a href="https://mozilla.github.io/pdf.js/">pdf.js</a>.
      </p>
      <p>tikz-flora is MIT licensed. The source is on
        <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>.</p>
    </div>
  </section>
</main>

<footer class="wrap foot">
  <p>tikz-flora · MIT · <a href="https://github.com/wn-mitch/tikz-flora">github.com/wn-mitch/tikz-flora</a></p>
</footer>

<style>
  .top { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--paper) 88%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--rule); }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 52px; flex-wrap: wrap; }
  .brand { font-family: var(--display); font-size: 1.4rem; color: var(--ink); text-decoration: none; }
  nav { display: flex; gap: 1.1rem; flex-wrap: wrap; font-size: .95rem; }
  nav a { color: var(--muted); text-decoration: none; }
  nav a:hover { color: var(--blue); }
  section { padding-block: 3rem; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 2.5rem; align-items: center; }
  h1 { font-size: clamp(2.8rem, 7vw, 4.8rem); margin: .3rem 0 1rem; }
  h1 em { color: var(--blue); }
  .lede { font-size: 1.2rem; }
  .origin { color: var(--muted); }
  .actions { display: flex; gap: .8rem; flex-wrap: wrap; margin-top: 1.4rem; }
  .button { display: inline-block; padding: .6rem 1.1rem; border-radius: 6px; border: 1px solid var(--rule); text-decoration: none; color: var(--ink); background: var(--sheet); }
  .button.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
  .grow { margin: 0; }
  .grow video { width: 100%; height: auto; display: block; background: #fff; border-radius: 4px; box-shadow: 0 10px 30px rgb(0 0 0 / .14); aspect-ratio: 210 / 297; }
  figcaption { color: var(--muted); font-size: .88rem; margin-top: .5rem; }
  .strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 1rem; overflow-x: auto; padding-bottom: .8rem; margin-top: 1.2rem; }
  .strip figure { margin: 0; }
  .strip img { width: 100%; height: auto; display: block; background: #fff; border-radius: 3px; box-shadow: 0 4px 14px rgb(0 0 0 / .12); }
  .credits ul { padding-left: 1.2rem; }
  .foot { padding-block: 2rem 3rem; color: var(--muted); font-size: .9rem; border-top: 1px solid var(--rule); }
  @media (max-width: 820px) {
    .hero { grid-template-columns: minmax(0, 1fr); }
    .grow { max-width: 420px; }
  }
</style>
