<script>
  import Mixer from "./lib/Mixer.svelte";
  import Guide from "./lib/Guide.svelte";

  const pages = [1, 2, 3, 4, 5, 6, 7];
</script>

<header class="top">
  <div class="wrap bar">
    <a class="brand" href="#top">tikz-flora</a>
    <nav>
      <a href="#mixer">Mixer</a>
      <a href="#guide">Guide</a>
      <a href="/tikzflora.zip" download>Download</a>
      <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>
    </nav>
  </div>
</header>

<main id="top">
  <section class="wrap opening">
    <figure class="grow">
      <video class="paper" src="/media/grow.mp4" poster="/img/page-3.jpg" autoplay muted loop playsinline
        aria-label="A page of text while its margin flora grows from the root">
        <img src="/media/grow.gif" alt="A page of text while its margin flora grows from the root">
      </video>
    </figure>
    <div class="say">
      <h1>tikz-flora</h1>
      <p>Watercolour margins for LuaLaTeX. Each page grows its own plant
        around its text, in Lua, drawn through PGF.</p>
      <p class="muted">After the r/LaTeX thread
        <a href="https://old.reddit.com/r/LaTeX/comments/1xixznw/how_do_you_make_these_flowers_in_latex/">How do you make these flowers in LaTeX?</a>
        and Kevin Raymond's
        <a href="https://github.com/kevinraymond/florilegium">florilegium</a>.</p>
    </div>
  </section>

  <section class="pages" aria-label="The example document, page by page">
    {#each pages as p}
      <a href={`/img/page-${p}.jpg`}><img class="paper" src={`/img/page-${p}.jpg`} alt={`Page ${p} of the example document`} loading="lazy"></a>
    {/each}
  </section>

  <section id="mixer">
    <Mixer />
  </section>

  <section class="margin" id="guide">
    <div class="wrap">
      <Guide />
      <h2 id="credits">Credits</h2>
      <div class="col">
        <p>tikz-flora would not exist without the r/LaTeX thread
          <a href="https://old.reddit.com/r/LaTeX/comments/1xixznw/how_do_you_make_these_flowers_in_latex/">How do you make these flowers in LaTeX?</a>,
          whose photographed page is the reference it is measured against,
          and Kevin Raymond's
          <a href="https://github.com/kevinraymond/florilegium">florilegium</a>
          (MIT), whose grown margins, animation and visitors it follows.</p>
        <p>Ink colours: Pilot iroshizuku ramps measured by
          <a href="https://madoromi.moonwit.ch/#palettes/colours">madoromi</a>.
          Growth after Wong, Zongker and Salesin,
          <a href="https://grail.cs.washington.edu/projects/ornament/ornament.pdf">Computer-Generated Floral Ornament</a>
          (SIGGRAPH 1998). Example text from Vitruvius (tr. Morgan, 1914)
          and Asa Gray (1887), via Project Gutenberg. The mixer runs the
          package's Lua with <a href="https://github.com/ceifa/wasmoon">wasmoon</a>
          and draws it with <a href="https://mozilla.github.io/pdf.js/">pdf.js</a>.</p>
        <p>MIT licence. Source on <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>.</p>
      </div>
    </div>
  </section>
</main>

<style>
  .top { position: sticky; top: 0; z-index: 5; height: var(--bar); background: var(--paper); border-bottom: 1px solid var(--rule); }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; height: 100%; }
  .brand { font-family: var(--display); font-size: 1.25rem; color: var(--ink); text-decoration: none; }
  nav { display: flex; gap: 1.1rem; font-size: .95rem; }
  nav a { color: var(--muted); text-decoration: none; }
  nav a:hover { color: var(--ink); }
  .opening { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 3rem; align-items: center; padding-block: 2.5rem; }
  .grow { margin: 0; }
  .grow video { width: 100%; height: auto; display: block; aspect-ratio: 210 / 297; }
  h1 { font-size: 2.6rem; margin: 0 0 .6rem; }
  .muted { color: var(--muted); font-size: .95rem; }
  .pages { display: flex; gap: 1.2rem; overflow-x: auto; padding: 1rem max(16px, calc((100vw - 1180px) / 2)) 2.5rem; scroll-snap-type: x proximity; }
  .pages a { flex: none; scroll-snap-align: start; }
  .pages img { height: min(78vh, 760px); width: auto; display: block; }
  /* The guide sits beside a faded margin of flora, as text on a page does. */
  .margin { position: relative; padding-block: 3rem 4rem; border-top: 1px solid var(--rule); }
  .margin::before {
    content: ""; position: absolute; inset: 0 auto 0 0; width: min(34vw, 420px);
    background: url("/img/flora-margin.png") left top / auto 100vh repeat-y;
    opacity: .16; pointer-events: none;
  }
  .margin .wrap { position: relative; padding-left: max(16px, min(30vw, 360px)); }
  @media (max-width: 860px) {
    .opening { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
    .margin::before { width: 100vw; opacity: .08; }
    .margin .wrap { padding-left: 16px; }
    .pages img { height: 62vh; }
  }
  @media (prefers-color-scheme: dark) { .margin::before { opacity: .1; filter: invert(1) hue-rotate(180deg); } }
</style>
