#!/bin/sh
# Rebuild robot-journey/tw.css from the Tailwind classes used in index.html (dev only; the page itself loads no CDN).
# Run from the repo root after changing classes: sh robot-journey/tools/build-css.sh
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
cat > "$TMP/tailwind.config.js" <<CFG
module.exports = {
  content: ['$(pwd)/index.html'],
  darkMode: 'class',
  theme: { extend: { fontFamily: { sans: ['Inter', 'sans-serif'], arcade: ['Orbitron', 'sans-serif'] } } }
};
CFG
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$TMP/in.css"
npx -y tailwindcss@3 -c "$TMP/tailwind.config.js" -i "$TMP/in.css" -o tw.css --minify
rm -rf "$TMP"
