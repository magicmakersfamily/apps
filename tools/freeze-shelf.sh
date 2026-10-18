#!/bin/sh
# Freeze a version of the App Shelf itself (the root index.html) as a playable copy at versions/shelf/<version>/.
#
#   tools/freeze-shelf.sh <version> [git-ref]
#   tools/freeze-shelf.sh 1.0 HEAD          # freeze the page as it is committed now
#
# Like tools/freeze-version.sh for games: the copy is taken from git (so it is exactly what shipped), is never edited
# afterwards, points its relative links three levels up so every app still opens, hides itself from search engines, and
# gets a thin "old version" strip. To roll the shelf back, copy the frozen index.html over the root one (undo the
# "../../../" prefixes and the strip) and release it as a new shelf version. Afterwards, add a row to versions/index.html.
set -eu

ver=${1:?shelf version, e.g. 1.0}
ref=${2:-HEAD}
root=$(git rev-parse --show-toplevel)
dest="$root/versions/shelf/$ver"

[ -e "$dest" ] && { echo "already frozen: versions/shelf/$ver (frozen copies are never overwritten)" >&2; exit 1; }
git -C "$root" cat-file -e "$ref:index.html" 2>/dev/null || { echo "no index.html at $ref" >&2; exit 1; }

mkdir -p "$dest"
git -C "$root" show "$ref:index.html" > "$dest/index.html"

strip="<div style=\"font:13px/1.4 system-ui,sans-serif;background:#2b2140;color:#f3eefc;padding:6px 12px;text-align:center\">Old version $ver of The App Shelf, kept so we can compare. <a style=\"color:#d9c8ff\" href=\"../../../\">Go to the current shelf</a> · <a style=\"color:#d9c8ff\" href=\"../../\">All versions</a></div>"

STRIP="$strip" perl -0pi -e '
  s{((?:href|src)=")(?!https?:|mailto:|data:|#|\.\./)}{$1../../../}g;
  s{(<meta charset="[^"]*">)}{$1\n<meta name="robots" content="noindex">};
  s{(<body[^>]*>)}{$1\n$ENV{STRIP}};
' "$dest/index.html"

grep -q 'name="robots" content="noindex"' "$dest/index.html" || { rm -rf "$dest"; echo "could not inject into index.html (no <meta charset>?)" >&2; exit 1; }
echo "frozen: versions/shelf/$ver  (from $ref)"
echo "next: add it to versions/index.html"
