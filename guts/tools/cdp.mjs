// Launches the game in a throwaway browser for the GUTS bots. Now a thin wrapper over the shared Playwright
// harness (tools/play/harness.mjs): BROWSER=chromium|firefox|webkit picks the browser (Chrome by default),
// SEED fixes Math.random, and with no GUTS_URL the repo is served by the harness itself (no separate server).
import { launch as harnessLaunch, baseUrl } from '../../tools/play/harness.mjs';
export const READY = 'typeof GUTS !== "undefined" && !!GUTS.Game && !!window.__guts';
export async function gutsUrl(query = '') {
  const u = process.env.GUTS_URL || (await baseUrl()) + 'guts/index.html';
  return u + query;
}
export async function launch({ w = 1280, h = 800, url, browser, seed, pad } = {}) {
  if (url && !process.env.GUTS_URL) url = url.replace('http://localhost:8765/', await baseUrl());
  const s = seed ?? (process.env.SEED ? Number(process.env.SEED) : undefined);
  return harnessLaunch({ browser, w, h, url, seed: s, pad, readyExpr: READY });
}
