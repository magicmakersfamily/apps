#!/bin/sh
# Re-creates the voice audition page for Cosmo (kid-like) and Professor Know-A-Lot (deep owl) in big-bang/audition/
# (the page itself is tools/audition-page.html: copy it to audition/index.html; that folder is git-ignored via .git/info/exclude; it is only for listening). Needs macOS `say` and ffmpeg.
#   big-bang/tools/audition.sh && cd /Users/ab/apps && python3 -m http.server 8765
#   then open http://localhost:8765/big-bang/audition/
# Pitch shifting keeps the speed: asetrate=44100*f, then atempo=1/f.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd); mkdir -p "$here/audition"; cd "$here/audition"
CQ="Wait a minute! If space is stretching, where is the middle of the universe?"
PA="Excellent question, Cosmo! There is no middle. Space itself is stretching, everywhere at once, like the surface of a balloon as it is blown up."
CQY="咦，如果空間脹大，咁宇宙嘅中心喺邊度呀？"
PAY="問得好，宇宙貓！其實冇中心。空間本身喺每個地方同時脹大，就好似氣球嘅表面咁。"
mk() { say -v "$2" -r "$3" -o "$1.aiff" "$5"
  ffmpeg -y -loglevel error -i "$1.aiff" -af "aresample=44100,asetrate=44100*$4,aresample=44100,atempo=$(python3 -c "print(1/$4)")" -ac 1 -b:a 64k "$1.mp3"; rm "$1.aiff"; }
mk c1 Junior 175 1.00 "$CQ"; mk c2 Samantha 185 1.28 "$CQ"; mk c3 "Flo (English (US))" 180 1.15 "$CQ"; mk c4 Kathy 185 1.22 "$CQ"; mk c5 Tessa 185 1.20 "$CQ"
mk p1 Daniel 150 1.00 "$PA"; mk p2 Daniel 145 0.88 "$PA"; mk p3 "Grandpa (English (UK))" 150 0.95 "$PA"; mk p4 "Reed (English (UK))" 150 0.92 "$PA"; mk p5 "Rocko (English (UK))" 150 0.90 "$PA"; mk p6 Ralph 150 0.85 "$PA"
mk yc1 Sinji 175 1.30 "$CQY"; mk yc2 Sinji 175 1.45 "$CQY"; mk yp1 Sinji 150 0.80 "$PAY"; mk yp2 Sinji 150 0.70 "$PAY"
echo "samples written to $here/audition (the listening page index.html is NOT regenerated; see PLAN.md for its layout)"
