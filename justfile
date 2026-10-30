set export

PATH := env("HOME") / "Library/TinyTeX/bin/universal-darwin" + ":" + env("PATH")
TEXINPUTS := "./tex//:"
# Values saved from the tuner override lua/flora/tune.lua when present.
# An interpreter with numpy and Pillow for analysis/ and tuner/; Homebrew's
# newest python3 may not have them yet.
PYTHON := env("FLORA_PYTHON", "python3.14")
FLORA_TUNE := if path_exists(justfile_directory() / "tune-local.lua") == "true" { justfile_directory() / "tune-local.lua" } else { "" }

# Compile a document in tex/ to build/<name>.pdf and a PNG preview.
build name="demo" seed="1" dpi="200":
    mkdir -p build
    lualatex -interaction=nonstopmode -halt-on-error -output-directory=build \
        -jobname={{name}} "\def\florseed{ {{seed}} }\input{tex/{{name}}.tex}" > build/{{name}}.out || (tail -30 build/{{name}}.log; exit 1)
    pdftocairo -png -singlefile -r {{dpi}} build/{{name}}.pdf build/{{name}}
    grep -h 'flora:' build/{{name}}.log || true

# The specimen sheet: one of each element.
specimens seed="1": (build "specimens" seed "300")

# Run the Lua unit tests under texlua, and the tune.lua writer's test.
test:
    for f in tests/test_*.lua; do texlua "$f" || exit 1; done
    {{PYTHON}} -I tests/test_bake.py
    {{PYTHON}} -I tests/test_stemcompare.py

# Integration test for the shipout measurer (needs lualatex).
test-tex:
    mkdir -p build
    lualatex -interaction=nonstopmode -halt-on-error -output-directory=build tests/measure.tex > build/measure.out || (grep -A3 '^!' build/measure.log; exit 1)
    grep -q 'measure: ok' build/measure.log && echo "measure: ok"

# De-warp the reference photo and trace its stems into tex/reference/.
trace:
    mkdir -p build/trace
    cd build/trace && {{PYTHON}} -I ../../analysis/homography.py && {{PYTHON}} -I ../../analysis/rectify.py ../../analysis/source/reference-photo.png \
        && {{PYTHON}} -I ../../analysis/inkmask.py && {{PYTHON}} -I ../../analysis/skeleton.py && {{PYTHON}} -I ../../analysis/curves.py
    cp build/trace/rectified.png build/trace/curves.json build/trace/homography.json build/trace/viewport.json tex/reference/

# Stem curvature of our plant (seeds 1..N) against the reference trace.
stem-stats seeds="6":
    {{PYTHON}} -I analysis/stemcompare.py {{seeds}}

# The component tuner for lua/flora/tune.lua at http://127.0.0.1:8766/:
# builds the Svelte app in tuner/ and serves it with the render API.
tuner:
    cd tuner && npm ci --no-audit --no-fund --silent && npm run build --silent
    {{PYTHON}} -I tuner/server.py

# The tuner app with hot reload at http://127.0.0.1:5173/tuner/dist/; it
# forwards renders to a running `just tuner`.
tuner-dev:
    cd tuner && npm run dev

# Drives the built tuner in headless Chrome (tuner/tests/e2e.mjs).
test-tuner:
    cd tuner && npm ci --no-audit --no-fund --silent && npm run build --silent
    FLORA_PYTHON={{PYTHON}} node tuner/tests/e2e.mjs

# The TeX-free preview (tools/preview.lua) must match a real compile pixel
# for pixel once laid under the same page's text.
test-preview seed="3" page="2":
    mkdir -p build/test-preview
    FLORA_SPEC_DIR=build/test-preview lualatex -interaction=nonstopmode -halt-on-error -output-directory=build/test-preview -jobname=base "\def\florapages{0}\input{tex/demo.tex}" > /dev/null
    lualatex -interaction=nonstopmode -halt-on-error -output-directory=build/test-preview -jobname=real "\def\florseed{ {{seed}} }\def\florapages{ {{page}} }\input{tex/demo.tex}" > /dev/null
    texlua tools/preview.lua build/test-preview/spec-{{page}}.lua {{seed}} {{page}} build/test-preview/flora.pdf
    cd build/test-preview && pdftocairo -png -singlefile -r 110 flora.pdf flora && pdftocairo -png -singlefile -r 110 -f {{page}} -l {{page}} base.pdf text && pdftocairo -png -singlefile -r 110 -f {{page}} -l {{page}} real.pdf real
    cd build/test-preview && magick flora.png text.png -compose multiply -composite combo.png && magick compare -metric AE -fuzz 1% combo.png real.png null: 2>diff.txt; d=$(cut -d' ' -f1 diff.txt); echo "preview: $d pixels differ"; test "$d" = "0"

# Text-only compile of the demo's first page at the reference's scale, for
# the default fit.
fit-base:
    mkdir -p build/fit/base
    FLORA_SPEC_DIR=build/fit/base lualatex -interaction=nonstopmode -halt-on-error -output-directory=build/fit/base -jobname=base "\def\florapages{0}\input{tex/demo.tex}" > /dev/null
    pdftocairo -png -r 157.9 -f 1 -l 1 -singlefile build/fit/base/base.pdf build/fit/base/text-1

# Search tune.lua settings whose page matches the reference's form
# statistics; writes build/fit/best.lua.
fit generations="8" population="24": fit-base
    {{PYTHON}} -I analysis/fit_defaults.py {{generations}} {{population}}

# Images for the write-up in web/img/ (page renders, details, specimens,
# the reference comparison and the link-preview image).
web-images: (build "demo" "7")
    cp build/demo.pdf build/demo-seed7.pdf
    just build demo 1 >/dev/null && cp build/demo.pdf build/demo-seed1.pdf
    just build reference 1 150 >/dev/null
    just specimens >/dev/null
    pdftocairo -png -r 130 build/demo-seed1.pdf build/w1
    pdftocairo -png -f 1 -l 1 -r 130 -singlefile build/demo-seed7.pdf build/w7
    magick build/w1-1.png -quality 84 web/img/page1.jpg
    magick build/w1-2.png -quality 84 web/img/page2.jpg
    magick build/w7.png -quality 84 web/img/page1-seed7.jpg
    pdftocairo -png -f 1 -l 1 -r 300 -singlefile build/demo-seed1.pdf build/hi1
    magick build/hi1.png -crop 1000x1000+40+80 -resize 800x -quality 86 web/img/detail-hero.jpg
    magick build/hi1.png -crop 900x900+80+1500 -resize 800x -quality 86 web/img/detail-leaves.jpg
    magick build/hi1.png -crop 1500x560+900+2900 -resize 1200x -quality 86 web/img/detail-foot.jpg
    magick build/specimens.png -resize 1600x -quality 84 web/img/specimens.jpg
    pdftocairo -jpeg -jpegopt quality=85 -scale-to-x 1600 -scale-to-y -1 -f 3 -l 3 -singlefile build/reference.pdf web/img/dewarp-compare
    magick web/img/dewarp-compare.jpg -resize 1200x -gravity north -crop 1200x630+0+0 +repage -quality 84 web/img/og.jpg
