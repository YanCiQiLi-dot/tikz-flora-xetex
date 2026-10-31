<script>
  import Mixer from "./lib/Mixer.svelte";
  import Guide from "./lib/Guide.svelte";
  import Gallery from "./lib/Gallery.svelte";
  import COLOURWAYS from "./lib/colourways.json";

  // The example document's pages, with what each shows.
  const pages = [
    [1, "Title crown", "layout=title"],
    [2, "Contents wreath", "layout=surround"],
    [3, "Outer margin, into a gap", "layout=split"],
    [4, "A new mix: lilies, umbels, birds", "mix={…}, palette={leaves=green}"],
    [5, "Outer margin, filler text", "layout=split"],
    [6, "Both margins, random inks", "layout=centered, palette={…=random}"],
    [7, "A short last page", "density=0.6"],
  ];

  // Load a colourway into the mixer and go to it.
  function useColourway(i) {
    window.dispatchEvent(new CustomEvent("flora:colourway", { detail: i }));
    document.getElementById("mixer").scrollIntoView();
  }
</script>

<header class="top">
  <div class="wrap bar">
    <a class="brand" href="#top">tikz-flora</a>
    <nav>
      <a href="#mixer">Mixer</a>
      <a href="#gallery">Gallery</a>
      <a href="#guide">Guide</a>
      <a href="/tikzflora.zip" download>Download</a>
      <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>
    </nav>
  </div>
</header>

<main id="top">
  <section class="wrap opening">
    <h1>Watercolour margins for LuaLaTeX</h1>
    <p class="lede">Each page grows its own plant around its text, painted in
      fountain-pen inks. Choose the plants and inks, then copy the settings
      into your document.</p>
    <p class="actions">
      <a class="button primary" href="#mixer">Mix a border</a>
      <a class="button" href="/tikzflora.zip" download>Download the package</a>
      <a class="button" href="#guide">Set it up</a>
    </p>
  </section>

  <section class="wrap ways" aria-label="One page in three colourways">
    {#each COLOURWAYS as c, i}
      <figure>
        <img class="paper" src={`/img/colourway-${i}.jpg`} alt={`The same page of text with its margin grown in ${c.name.toLowerCase()} inks`}>
        <figcaption>
          <span>{c.name} <span class="muted">· seed {c.seed}</span></span>
          <button type="button" onclick={() => useColourway(i)}>Use these inks</button>
        </figcaption>
      </figure>
    {/each}
  </section>

  <section class="wrap grow">
    <div class="say">
      <h2>Watch it grow</h2>
      <p>The plant grows from its root along the stems, then the leaves
        unfurl, the blooms open and the gilt arrives. <code>just grow</code>
        renders any page this way.</p>
    </div>
    <video class="paper" src="/media/grow.mp4" poster="/img/page-3.jpg" controls muted playsinline preload="none"
      aria-label="Page 3 of the example as its margin flora grows from the root">
      <a href="/media/grow.gif">The animation as a GIF</a>
    </video>
  </section>

  <section class="example" aria-label="The example document, page by page">
    <h2 class="wrap">The example document</h2>
    <div class="pages">
      {#each pages as [p, what, how]}
        <figure>
          <a href={`/img/page-${p}.jpg`}><img class="paper" src={`/img/page-${p}.jpg`} alt={`Page ${p} of the example document: ${what.toLowerCase()}`} loading="lazy"></a>
          <figcaption>{p} · {what}<br><code>{how}</code></figcaption>
        </figure>
      {/each}
    </div>
  </section>

  <section id="mixer">
    <Mixer />
  </section>

  <section class="wrap ornaments" id="gallery">
    <div class="say">
      <h2>Ornaments</h2>
      <p>The gilt comes from a registry of ornament kinds: cartouches, header
        marks, pendants, title crests, flourishes, tailpieces, corners and the
        small gilt in the gaps. Each place on a page picks one kind by weight;
        set them with <code>{"ornaments={moon=2, night=0}"}</code> or in the mixer.
        A new kind is one Lua file that registers itself, and this gallery
        draws it with the rest.</p>
    </div>
    <Gallery />
  </section>

  <section class="guide" id="guide">
    <div class="wrap layout">
      <figure class="inset" aria-hidden="true"><img src="/img/flora-margin.png" alt=""></figure>
      <div>
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
          <p>Written with Claude Code. MIT licence. Source on
            <a href="https://github.com/wn-mitch/tikz-flora">GitHub</a>.</p>
        </div>
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
  .opening { padding-block: 2.6rem 1.4rem; }
  h1 { font-size: clamp(2.2rem, 4.6vw, 3.6rem); line-height: 1.05; margin: 0 0 .8rem; max-width: 18ch; }
  .lede { font-size: 1.15rem; max-width: 52ch; margin: 0 0 1.2rem; }
  .actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; }
  .button, figcaption button {
    display: inline-flex; align-items: center; min-height: 40px; padding: .35rem .9rem;
    border: 1px solid var(--control); color: var(--ink); background: transparent; text-decoration: none; font: inherit; cursor: pointer;
  }
  .button:hover, figcaption button:hover { border-color: var(--ink); }
  .button.primary { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .ways { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.4rem; padding-block: 1rem 3rem; }
  figure { margin: 0; }
  .ways img { width: 100%; height: auto; display: block; aspect-ratio: 210 / 297; }
  .ways figcaption { display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; margin-top: .6rem; }
  .ways figcaption button { min-height: 36px; font-size: .9rem; }
  .muted { color: var(--muted); }
  .grow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3rem; align-items: center; padding-block: 2rem 3rem; border-top: 1px solid var(--rule); }
  .grow video { width: 100%; max-height: 80vh; height: auto; display: block; aspect-ratio: 210 / 297; object-fit: contain; }
  .example { border-top: 1px solid var(--rule); padding-top: 2rem; }
  .pages { display: flex; gap: 1.2rem; overflow-x: auto; padding: .4rem max(16px, calc((100vw - 1180px) / 2)) 2.5rem; scroll-snap-type: x proximity; }
  .pages figure { flex: none; scroll-snap-align: start; }
  .pages img { height: clamp(320px, 56vh, 560px); width: auto; display: block; }
  .pages figcaption { font-size: .88rem; color: var(--muted); margin-top: .45rem; max-width: 26ch; }
  .pages figcaption code { font-size: .75rem; }
  .ornaments { padding-block: 2.5rem 3rem; border-top: 1px solid var(--rule); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 720px); gap: 3rem; align-items: start; }
  .ornaments .say { position: sticky; top: calc(var(--bar) + 1.5rem); }
  /* The guide opens beside one painted margin, on paper in both themes. */
  .guide { padding-block: 3rem 4rem; border-top: 1px solid var(--rule); }
  .layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 3rem; align-items: start; }
  .inset { position: sticky; top: calc(var(--bar) + 1.5rem); background: #fff; padding: .6rem; border: 1px solid var(--rule); }
  .inset img { width: 100%; height: auto; display: block; }
  @media (max-width: 860px) {
    .ways { grid-template-columns: minmax(0, 1fr); gap: 2rem; }
    .ways img { max-height: 80svh; object-fit: contain; }
    .grow { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    .ornaments { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    nav { gap: .7rem; font-size: .9rem; }
    .ornaments .say { position: static; }
    .pages img { height: min(48svh, 420px); }
    .layout { grid-template-columns: minmax(0, 1fr); }
    .inset { display: none; }
  }
</style>
