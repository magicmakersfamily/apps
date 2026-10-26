# GUTS browser checks (dev only, not shipped in frozen copies)

Serve the repo (`python3 -m http.server 8765` from the repo root, or any static server), then, with Google Chrome installed:

```
node guts/tools/route.mjs     # plays "Morning at Home" start to gate with real physics, jumps only, at the lowest vitality
node guts/tools/ai-taps.mjs   # ?ai=1: one key-only tap, one mouse click, Step mode and the text view
```

`cdp.mjs` launches a throwaway headless Chrome and drives it over the DevTools protocol (`GUTS_URL` overrides the address).
`route.mjs` plans a route with the same walkability rules as `levels.test.js`, then executes every hop with several start positions and
jump timings, so a pass means a human has room to succeed. Deterministic play uses `GUTS.Game.step(dt)` and `GUTS.Input._keys`.
Kill stray test browsers between runs (`pkill -f guts-chrome`) or a new run may attach to an old one.
The model tests run with `node --test guts/belly.test.js guts/levels.test.js`.
