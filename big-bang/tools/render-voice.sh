#!/bin/sh
# Re-records Cosmo's spoken lines into voice/<key>.mp3 (English, macOS voice "Samantha") and voice/yue/<key>.mp3
# (Cantonese, macOS voice "Sinji", zh_HK) from the text in index.html. Needs a Mac with ffmpeg. Only re-renders lines whose
# text changed (hash cache in tools/.cache, not committed). Keys: c<chapter> (chapter intro), bang, p<chapter> (payoff after
# the mini-game), h<chapter><n> (hotspots), m<chapter> (centre picture), q<chapter> (big question), final, orderok, help.
#   big-bang/tools/render-voice.sh
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
render() {  # lang voice rate outdir
  mkdir -p "$4" "$here/tools/.cache"
  node "$here/tools/lines.js" "$here/index.html" "$1" | while IFS="$(printf '\t')" read -r key text; do
    h=$(printf '%s' "$text" | shasum | cut -c1-12)
    [ -f "$4/$key.mp3" ] && [ "$(cat "$here/tools/.cache/$1-$key" 2>/dev/null)" = "$h" ] && continue
    say -v "$2" -r "$3" -o "$here/tools/.cache/$1-$key.aiff" "$text"
    ffmpeg -y -loglevel error -i "$here/tools/.cache/$1-$key.aiff" -ac 1 -ar 22050 -b:a 48k "$4/$key.mp3"
    rm "$here/tools/.cache/$1-$key.aiff"; printf '%s' "$h" > "$here/tools/.cache/$1-$key"
    echo "recorded $1 $key"
  done
}
render en Samantha 175 "$here/voice"
render yue Sinji 165 "$here/voice/yue"
