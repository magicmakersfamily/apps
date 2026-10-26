# GUTS browser checks (dev only, not shipped in frozen copies)

Serve the repo (`python3 -m http.server 8765` from the repo root), then, with Google Chrome installed:

```
node guts/tools/hops.mjs      # every required hop in "Morning at Home" at low and normal vitality, no blasting needed
node guts/tools/ai-taps.mjs   # ?ai=1: one key-only tap, one mouse click, Step mode and the text view
```

`cdp.mjs` launches a throwaway headless Chrome and drives it over the DevTools protocol (`GUTS_URL` overrides the address).
Deterministic play uses `GUTS.Game.step(dt)` and `GUTS.Input._keys`; a stubbed `navigator.getGamepads` stands in for a PS4 pad.
The model tests run with `node --test guts/belly.test.js guts/levels.test.js`.
