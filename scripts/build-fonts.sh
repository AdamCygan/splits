#!/usr/bin/env bash
# Generuje podzbiory fontu Bricolage Grotesque (OFL) używane przez Timeblame.
# Wymaga: python3 + fonttools + brotli  (pip install fonttools brotli)
#
# Zamiast pełnego fontu zmiennego (3 osie, ~185 KB w woff2) budujemy:
#   brand-text-core.woff2     tekst:     opsz=16, wdth=100, wght 400–700 (oś zmienna)
#   brand-display-core.woff2  nagłówki:  opsz=72, wdth=80,  wght 600–800 (oś zmienna)
#   brand-text-ext.woff2      rzadkie znaki łacińskie, ładowane tylko gdy wystąpią
# Razem ~80 KB, a strona główna pobiera tylko dwa pierwsze (~63 KB).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=src/assets/fonts
TMP=$(mktemp -d)
curl -sSL -o "$TMP/full.ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf"

CORE="U+0020-007E,U+00A0-00FF,U+0104-0107,U+0118-0119,U+0141-0144,U+015A-015B,U+0179-017C,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2122,U+2212"
EXT="U+0100-0103,U+0108-0117,U+011A-0140,U+0145-0159,U+015C-0178,U+017D-024F,U+0259,U+1E00-1EFF,U+2020-2021,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
FEAT="kern,liga,calt,ccmp,locl,mark,mkmk"

python3 -m fontTools.varLib.instancer "$TMP/full.ttf" opsz=16 wdth=100 wght=400:700 -o "$TMP/text.ttf" -q
python3 -m fontTools.varLib.instancer "$TMP/full.ttf" opsz=72 wdth=80 wght=600:800 -o "$TMP/display.ttf" -q

pyftsubset "$TMP/text.ttf"    --unicodes="$CORE" --layout-features="$FEAT" --flavor=woff2 --no-hinting --desubroutinize --output-file="$OUT/brand-text-core.woff2"
pyftsubset "$TMP/display.ttf" --unicodes="$CORE" --layout-features="$FEAT" --flavor=woff2 --no-hinting --desubroutinize --output-file="$OUT/brand-display-core.woff2"
pyftsubset "$TMP/text.ttf"    --unicodes="$EXT"  --layout-features="$FEAT" --flavor=woff2 --no-hinting --output-file="$OUT/brand-text-ext.woff2"

rm -rf "$TMP"
ls -l "$OUT"/*.woff2
