#!/bin/sh
# Re-records the spoken lines into voice/<key>.mp3 (English) and voice/yue/<key>.mp3 (Cantonese) from the text in index.html.
# Two characters (macOS `say` + ffmpeg pitch shifting; chosen by the family, see PLAN.md):
#   Cosmo (cosmo)  English: Samantha pitched up 1.28.   Cantonese: Sinji pitched up 1.30.
#   Professor Know-A-Lot (prof)  English: Daniel (British), natural.   Cantonese: Sinji pitched down 0.80.
# Needs a Mac with ffmpeg. Only re-renders lines whose text or voice settings changed (hash cache in tools/.cache, not committed).
# Keys: c<chapter> (chapter intro), bang, p<chapter> (payoff), h<chapter><n> (hotspot answer; ha<chapter><n> is Cosmo's question in cast
# chapters; hm<chapter><n> is the Professor's longer "Ask the Professor" answer), m<chapter> (centre picture answer; ma<chapter> is Cosmo's question), q<chapter> (big question; qa<chapter> is the Professor's answer in cast chapters),
# ga/gb<chapter> (glossary word: Cosmo asks, Professor answers), t<chapter> (talk together), cal, final, orderok, help.
#   big-bang/tools/render-voice.sh
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
render() {  # lang outdir; voice, rate and pitch per role come from the table below
  mkdir -p "$2" "$here/tools/.cache"
  node "$here/tools/lines.js" "$here/index.html" "$1" | while IFS="$(printf '\t')" read -r key who text; do
    case "$1-$who" in
      en-cosmo)  voice=Samantha; rate=175; pitch=1.28 ;;
      en-prof)   voice=Daniel;   rate=150; pitch=1.00 ;;
      yue-cosmo) voice=Sinji;    rate=165; pitch=1.30 ;;
      yue-prof)  voice=Sinji;    rate=150; pitch=0.80 ;;
    esac
    h=$(printf '%s|%s|%s|%s' "$voice" "$rate" "$pitch" "$text" | shasum | cut -c1-12)
    [ -f "$2/$key.mp3" ] && [ "$(cat "$here/tools/.cache/$1-$key" 2>/dev/null)" = "$h" ] && continue
    say -v "$voice" -r "$rate" -o "$here/tools/.cache/$1-$key.aiff" "$text"
    if [ "$pitch" = "1.00" ]; then af="aresample=22050"
    else af="aresample=44100,asetrate=44100*$pitch,aresample=22050,atempo=$(python3 -c "print(1/$pitch)")"; fi
    ffmpeg -y -loglevel error -i "$here/tools/.cache/$1-$key.aiff" -af "$af" -ac 1 -ar 22050 -b:a 48k "$2/$key.mp3"
    rm "$here/tools/.cache/$1-$key.aiff"; printf '%s' "$h" > "$here/tools/.cache/$1-$key"
    echo "recorded $1 $key ($who)"
  done
}
render en "$here/voice"
render yue "$here/voice/yue"
