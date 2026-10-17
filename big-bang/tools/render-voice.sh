#!/bin/sh
# Re-records Cosmo's spoken lines into voice/<key>.mp3 from the CHAPTERS text in index.html.
# Uses macOS `say` (voice "Samantha") + ffmpeg, so run it on a Mac. Only re-renders lines whose text changed
# (hash cache in tools/.cache, not committed). Keys: c<chapter> (chapter intro), bang, p<chapter> (payoff after the
# mini-game), h<chapter><n> (hotspots), m<chapter> (centre picture), q<chapter> (big question), final, orderok, help.
#   big-bang/tools/render-voice.sh
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$here/voice" "$here/tools/.cache"
node "$here/tools/lines.js" "$here/index.html" | while IFS="$(printf '\t')" read -r key text; do
  h=$(printf '%s' "$text" | shasum | cut -c1-12)
  [ -f "$here/voice/$key.mp3" ] && [ "$(cat "$here/tools/.cache/$key" 2>/dev/null)" = "$h" ] && continue
  say -v Samantha -r 175 -o "$here/tools/.cache/$key.aiff" "$text"
  ffmpeg -y -loglevel error -i "$here/tools/.cache/$key.aiff" -ac 1 -ar 22050 -b:a 48k "$here/voice/$key.mp3"
  rm "$here/tools/.cache/$key.aiff"; printf '%s' "$h" > "$here/tools/.cache/$key"
  echo "recorded $key"
done
