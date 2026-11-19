#!/usr/bin/env bash
# Frozen copy of the first version of the site (frontend/, Angular, live until the makeover)
# for elstner.ch/v1/:
#   bash web/tools/v1/build.sh   (Node from .nvmrc, frontend/node_modules installed)  ->  web/public/v1/
# Built from frontend/ with base /v1/. What the build leaves at the root is moved under /v1/:
# the fonts and the site origin (canonical, OG, JSON-LD). Its own _headers, robots.txt and
# sitemap.xml are dropped; the new site's apply (web/public/_headers: CSP hashes of its inline
# scripts, noindex for /v1/).
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
out="$repo/web/public/v1"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$repo/frontend"
npx ng build content-model
npx ng build site --base-href /v1/ --output-path "$tmp/build"
b="$tmp/build/browser"
rm -f "$b/_headers" "$b/robots.txt" "$b/sitemap.xml" "$b/index.csr.html"
find "$b" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \) -print0 | xargs -0 sed -i \
  -e "s#\([(\"' ]\)/fonts/#\1/v1/fonts/#g" \
  -e 's#https://elstner\.ch/#https://elstner.ch/v1/#g' \
  -e 's#"https://elstner\.ch"#"https://elstner.ch/v1"#g'
rm -rf "$out"
cp -r "$b" "$out"
echo "v1 from $(git -C "$repo" log -1 --format=%h -- frontend content): $(du -sh "$out" | cut -f1)"
