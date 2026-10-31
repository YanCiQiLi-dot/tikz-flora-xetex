<script>
  // Code samples live here: braces in markup would be read as Svelte.
  const minimal = String.raw`\documentclass{article}
% The flora fills the margins the page has: give it about 5 cm.
\usepackage[left=5.5cm,right=2cm,top=4cm,bottom=3.5cm]{geometry}
\usepackage{tikzflora}
\florasetup{seed=7}

\begin{document}
\section{A first garden}
Some text.
\end{document}`;

  const settings = String.raw`% For the rest of the document, from this page on:
\florasetup{layout=split, seed=3, visitors=0.5,
  mix={lily=2, umbel=0, gyps=1.5},
  palette={leaves=green, hero=kon-peki}}

% For one page only (the page this lands on):
\florathispage{layout=surround}`;

  const title = String.raw`\newgeometry{left=3.2cm,right=3.2cm,top=5cm,bottom=4cm}
\thispagestyle{empty}
\florathispage{layout=title}
\begin{floratitle}
\centering {\Huge\scshape My Title\par}
\end{floratitle}
\clearpage
\restoregeometry`;

  const texmf = String.raw`kpsewhich -var-value TEXMFHOME
# then copy tikzflora.sty, tikzflora-boot.lua and lua/ into
#   <TEXMFHOME>/tex/lualatex/tikzflora/`;

  const keys = [
    ["layout", "left, right, centered, split, title, surround", "Where the flora grows."],
    ["seed", "a number, or random", "Which garden. Each page varies it, so pages differ."],
    ["mix", "{kind=weight, …}", "How much of each kind: 1 the usual amount, 0 none, 2 about twice as much."],
    ["density", "0 to 10", "Fuller above 1, airier below."],
    ["visitors", "0 to 10", "The weight of every visitor at once: bees, butterflies, birds and snails."],
    ["palette", "{part=ink, …}", "What paints the hero, blooms, leaves, leaflets and stems."],
  ];
  const kinds = "bloom, soft, lily, ghost, umbel, cyme (forget-me-nots), gyps (baby's breath), leaves, leaflets, sprays, curls, density, bee, butterfly, bird, snail";
  const layouts = [
    ["left", "The left margin. The default."],
    ["right", "The right margin."],
    ["centered", "Both side margins, with a different plant on each side."],
    ["split", "The outer margin of a two-sided document: on the right of odd pages and the left of even ones."],
    ["title", "A crown over a title. Wrap the title in the floratitle environment; without it the first block of lines on the page is crowned."],
    ["surround", "A wreath round the text block, for title pages and contents."],
  ];
</script>

<h2>Guide</h2>
<div class="col">
  <h3>1. Get LuaLaTeX</h3>
  <p>
    tikz-flora needs LuaLaTeX, which comes with every full TeX
    distribution: <a href="https://tug.org/texlive/">TeX Live</a> 2023 or
    later, <a href="https://miktex.org/">MiKTeX</a>, or
    <a href="https://yihui.org/tinytex/">TinyTeX</a>. Check that
    <code>lualatex --version</code> answers. The example also needs the
    <code>lipsum</code> package (<code>tlmgr install lipsum</code> on
    TinyTeX).
  </p>

  <h3>2. Get the package</h3>
  <p>
    <a href="/tikzflora.zip" download>Download tikzflora.zip</a> and unzip
    it. It holds <code>tikzflora.sty</code>, <code>tikzflora-boot.lua</code>,
    the generator in <code>lua/flora/</code>, a worked example
    <code>example.tex</code>, and a <code>latexmkrc</code> that selects
    LuaLaTeX.
  </p>
  <p>
    Put your document next to <code>tikzflora.sty</code>, or copy the
    <code>.sty</code>, the boot file and <code>lua/</code> next to your
    document. To use it in every document, copy them into your TeX tree:
  </p>
  <pre><code>{texmf}</code></pre>

  <h3>3. A first page</h3>
  <pre><code>{minimal}</code></pre>
  <p>
    Compile with <code>lualatex</code>, or with <code>latexmk</code>, which
    the included <code>latexmkrc</code> points at LuaLaTeX. pdfLaTeX and
    XeLaTeX stop with "tikzflora needs LuaLaTeX". Each page takes a second
    or two to grow.
  </p>

  <h3>On Overleaf</h3>
  <ol>
    <li>Choose New Project, then Upload Project, and pick <code>tikzflora.zip</code>.</li>
    <li>The <code>latexmkrc</code> in the zip selects LuaLaTeX. If your project lacks it, open Menu and set Compiler to LuaLaTeX.</li>
    <li>Recompile. <code>example.tex</code> shows every setting with a comment at each.</li>
  </ol>

  <h3>4. Settings</h3>
  <p>
    <code>\florasetup</code> sets keys for the rest of the document,
    starting with the page it is on. <code>\florathispage</code> sets them
    for one page. A wrong key or value stops the compile with a message
    naming it.
  </p>
  <pre><code>{settings}</code></pre>
  <div class="table">
    <table>
      <thead><tr><th>Key</th><th>Values</th><th>Effect</th></tr></thead>
      <tbody>
        {#each keys as [k, v, e]}<tr><td><code>{k}</code></td><td>{v}</td><td>{e}</td></tr>{/each}
      </tbody>
    </table>
  </div>
  <p>Mix kinds: {kinds}. Visitors are off unless you give them weight.</p>
  <p>
    Palette values are <code>look</code> (the default gradients), an ink
    group (blue, blue-grey, teal, green, violet, warm, earth, gold) or one
    Pilot iroshizuku ink by name, such as <code>kon-peki</code>. The
    <a href="#mixer">mixer</a> lists every ink.
  </p>

  <h3>5. Layouts</h3>
  <dl>
    {#each layouts as [k, e]}<dt><code>{k}</code></dt><dd>{e}</dd>{/each}
  </dl>
  <p>A title page:</p>
  <pre><code>{title}</code></pre>

  <h3>Watch it grow</h3>
  <p>
    The repository's <code>just grow NAME SEED PAGE</code> renders a page
    of any document in <code>tex/</code> as it grows and writes an MP4 and
    a GIF. It needs ffmpeg, poppler and ImageMagick. The animation at the
    top of this page is <code>just grow lorem 3 3</code>.
  </p>

  <h3>Troubleshooting</h3>
  <dl>
    <dt>"tikzflora needs LuaLaTeX"</dt>
    <dd>Compile with <code>lualatex</code>. On Overleaf, set Menu, Compiler to LuaLaTeX.</dd>
    <dt>"module 'flora.init' not found"</dt>
    <dd>TeX found <code>tikzflora.sty</code> but not the <code>lua/</code> folder. Keep <code>lua/</code> beside the <code>.sty</code>, or set <code>FLORA_LUA</code> to its path.</dd>
    <dt>The contents page is empty</dt>
    <dd>Compile twice, or use <code>latexmk</code>.</dd>
    <dt>The flora is cramped</dt>
    <dd>It fills the margins it is given. Widen them with <code>geometry</code> (about 5 cm for a side margin, or 3 cm all round for <code>surround</code>), or lower <code>density</code>.</dd>
  </dl>
</div>

<style>
  .table { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .95rem; margin: .6rem 0; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
  th { font-family: var(--mono); font-size: .74rem; letter-spacing: .1em; text-transform: uppercase; color: var(--gold); font-weight: 400; }
  dt { margin-top: .6rem; }
  dd { margin: .1rem 0 0 1.2rem; color: var(--muted); }
  ol { padding-left: 1.3rem; }
</style>
