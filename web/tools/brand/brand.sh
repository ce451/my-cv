#!/usr/bin/env bash
# Link preview and icons for web/public from og.html and favicon.svg, rendered in headless Chrome:
#   bash web/tools/brand/brand.sh
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
pub="$here/../../public"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
shot() { # url width height out
  google-chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$tmp/profile" \
    --default-background-color=00000000 --allow-file-access-from-files --virtual-time-budget=3000 \
    --window-size="$2,$3" --screenshot="$4" "$1" 2>/dev/null
}
shot "file://$here/og.html" 1200 630 "$tmp/og.png"
magick "$tmp/og.png" -strip -define png:compression-level=9 "$pub/og-image.png"
cp "$here/favicon.svg" "$pub/favicon.svg"
shot "file://$here/icon.html" 192 192 "$tmp/icon.png"
magick "$tmp/icon.png" -resize 96x96 -strip "$pub/icon-96.png"
shot "file://$here/icon.html?square" 180 180 "$tmp/touch.png"
magick "$tmp/touch.png" -background '#1b1815' -flatten -strip "$pub/apple-touch-icon.png"
magick "$tmp/icon.png" -define icon:auto-resize=48,32,16 "$pub/favicon.ico"
ls -l "$pub"/og-image.png "$pub"/favicon.* "$pub"/icon-96.png "$pub"/apple-touch-icon.png
