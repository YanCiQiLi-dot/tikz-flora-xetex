#!/bin/sh
# One frame of tools/grow.sh: frame I of N for the page laid out in
# DIR/spec-PAGE.lua, multiplied over DIR/text.png into DIR/fIIII.png.
#
#   tools/grow-frame.sh DIR PAGE I N DPI
set -eu
dir=$1 page=$2 i=$3 n=$4 dpi=$5
f=$(printf '%s/f%04d' "$dir" "$i")
t=$(awk -v i="$i" -v n="$n" 'BEGIN { t = i / (n - 1); if (t > 1) t = 1; printf "%.5f", t }')
texlua tools/preview.lua "$dir/spec-$page.lua" doc "$page" "$f.pdf" "$t"
pdftocairo -png -singlefile -r "$dpi" "$f.pdf" "$f-flora"
magick "$f-flora.png" "$dir/text.png" -compose multiply -composite "$f.png"
rm -f "$f.pdf" "$f-flora.png"
