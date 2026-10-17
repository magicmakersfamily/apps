"""Regenerates the language data inside big-bang/index.html from content_en.py and content_yue.py.

The text (English and Cantonese), the interface strings, the sticker names and the Jyutping for every Cantonese
string live in this folder; index.html holds a generated copy between `const CHAPTERS_EN = [` and the `const JP = ...;`
line. Change the words HERE (both languages), then run:

    python3 -m venv /tmp/jpenv && /tmp/jpenv/bin/pip install pycantonese
    /tmp/jpenv/bin/python big-bang/tools/i18n/build.py
    big-bang/tools/render-voice.sh        # re-record any clips whose text changed
    big-bang/tools/rebuild-css.sh         # only if you added Tailwind classes

Jyutping comes from the pycantonese package (rime-cantonese dictionary); a Cantonese speaker should check it.
"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import content_en, content_yue

if __name__ == '__main__':
    page = os.path.join(here, '..', '..', 'index.html')
    s = open(page).read()
    a = s.index('const CHAPTERS_EN = [')
    b = s.index('\nconst JP = ', a)
    b = s.index('\n', b + 1)
    data = ("const CHAPTERS_EN = " + content_en.js().split(" = ", 1)[1] + "\n" + content_yue.js())
    s = s[:a] + data + s[b:]
    open(page, 'w').write(s)
    print('regenerated', len(content_yue.JP), 'Jyutping strings in', page)
