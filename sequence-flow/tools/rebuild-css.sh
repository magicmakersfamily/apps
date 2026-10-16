#!/bin/sh
# Rebuild the Tailwind CSS that is inlined in sequence-flow/index.html.
# The page has no CDN: its utility classes are compiled and pasted between the .no-scrollbar rule and the
# .fa-solid icon rules. Run this after adding or changing any Tailwind class in index.html (HTML or the JS
# template strings). Needs node/npx and network access for tailwindcss@3.4.17 (a dev-time download only).
#   sequence-flow/tools/rebuild-css.sh
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp "$here/index.html" "$tmp/cur.html"
printf '@tailwind base;@tailwind components;@tailwind utilities;' > "$tmp/in.css"
echo "module.exports={content:['$tmp/cur.html']}" > "$tmp/tailwind.config.js"
(cd "$tmp" && npm init -y >/dev/null && npm i tailwindcss@3.4.17 >/dev/null 2>&1 \
  && npx tailwindcss -c tailwind.config.js -i in.css -o out.css --minify >/dev/null 2>&1)
python3 - "$here/index.html" "$tmp/out.css" <<'PY'
import sys
page, css = sys.argv[1], sys.argv[2]
s = open(page).read()
m = '.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }\n'
a = s.index(m) + len(m)
b = s.index('.fa-solid,.fa-regular')
open(page, 'w').write(s[:a] + open(css).read() + '\n' + s[b:])
print('rebuilt CSS in', page)
PY
