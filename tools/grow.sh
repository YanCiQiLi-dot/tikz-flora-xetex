#!/bin/sh
# "Watch it grow": renders one page of a document in tex/ as its flora
# grows, then writes build/grow-NAME-PAGE.mp4 and .gif.
#
#   tools/grow.sh NAME SEED PAGE FPS SECS
#
# A text-only compile records the page's layout (FLORA_SPEC_DIR); each frame
# is drawn TeX-free by tools/preview.lua at its time and multiplied over the
# page's text. Frames render in parallel. Needs texlua, lualatex, pdftocairo,
# ImageMagick and ffmpeg. Run from the repository root (just grow).
set -eu
name=$1 seed=$2 page=$3 fps=$4 secs=$5
dpi=${GROW_DPI:-110}
jobs=${GROW_JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc)}
dir=build/grow-$name
rm -rf "$dir"
mkdir -p "$dir"

# Text only; two runs so contents and references settle.
for _ in 1 2; do
  FLORA_SPEC_DIR=$dir lualatex -interaction=nonstopmode -halt-on-error -output-directory="$dir" \
    -jobname=base "\def\florseed{$seed}\def\florapages{0}\input{tex/$name.tex}" > "$dir/base.out" \
    || { tail -20 "$dir/base.log"; exit 1; }
done
test -f "$dir/spec-$page.lua" || { echo "grow: no page $page in $name" >&2; exit 1; }
pdftocairo -png -singlefile -r "$dpi" -f "$page" -l "$page" "$dir/base.pdf" "$dir/text"

# Frames 0..n-1 grow over SECS seconds; the finished page then holds for a
# second and a half. Each frame is one call of tools/grow-frame.sh.
n=$((fps * secs))
hold=$((fps * 3 / 2))
seq 0 $((n - 1)) | xargs -P "$jobs" -I{} tools/grow-frame.sh "$dir" "$page" {} "$n" "$dpi"
last=$(printf '%s/f%04d.png' "$dir" $((n - 1)))
for k in $(seq 0 $((hold - 1))); do cp "$last" "$(printf '%s/f%04d.png' "$dir" $((n + k)))"; done

out=build/grow-$name-$page
ffmpeg -loglevel error -y -framerate "$fps" -i "$dir/f%04d.png" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$out.mp4"
ffmpeg -loglevel error -y -framerate "$fps" -i "$dir/f%04d.png" \
  -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" "$out.gif"
echo "grow: $out.mp4 $out.gif ($n frames)"
