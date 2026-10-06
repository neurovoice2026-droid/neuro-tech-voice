/**
 * THE REELS' EXTRAS (docs/ig/PIPELINE.md §6.2 step 4): the sounds the four reels need that neither film's library has.
 *
 *   extras(T) → Map<'ig/sfx/<family>.wav', stereo>, one entry per IG extra family a reel's cue sheet plays (a family
 *   whose SFX def has dir 'ig/sfx': src/ig/common/series.ts IG_EXTRAS). scripts/ig/generate-sfx.mjs normalises each to
 *   −12 dBFS peak and applies its 0.3 / 12 ms edge fades. Deterministic; reads nothing of T but its REEL.
 *
 *   fx-impact-end   THE END CARD's logo impact (series.ts impactHits): film 1's `impact` (scripts/audio/sounds.mjs,
 *                   4.8 s) CHOKED for a reel's end. The reels end one bar after the impact with a 14-frame seam, and film
 *                   1's impact still rings at −24 dBFS RMS 1.2–1.5 s after its hit — the effects bus outlasted the seam's
 *                   fade (check-mix: last 100 ms −51 dBFS, ≤ −55 required). Kept whole through its body (0.85 s: the
 *                   hit, the bloom and the first of its ring, under the name), then an exponential choke (τ 0.22 s) — a
 *                   hand on the cymbal, no audible cut — so it is ~40 dB down by the seam.
 *                   Source: the reels' own library copy (public/ig/sfx/lib/impact.wav, recorded in lib.json) when there,
 *                   else film 1's public/sfx/impact.wav (read-only); never written.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, readWav } from '../audio/dsp.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** the impact's choke: whole until `hold` s, then e^(−(t − hold)/tau), cut at `len` s */
const CHOKE = { hold: 0.85, tau: 0.22, len: 2.4 };

function impactEnd() {
  const src = [path.join(ROOT, 'public', 'ig', 'sfx', 'lib', 'impact.wav'), path.join(ROOT, 'public', 'sfx', 'impact.wav')].find((f) => existsSync(f));
  if (!src) throw new Error('[sounds:ig] fx-impact-end: impact.wav is in neither public/ig/sfx/lib/ nor public/sfx/ — build film 1\'s library first (npm run sfx)');
  const w = readWav(src);
  if (w.sr !== SR) throw new Error(`[sounds:ig] ${src} is at ${w.sr} Hz`);
  const n = Math.min(w.ch[0].length, Math.round(CHOKE.len * SR));
  const h = Math.round(CHOKE.hold * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = w.ch[1] ?? w.ch[0];
  for (let i = 0; i < n; i++) {
    const g = i < h ? 1 : Math.exp(-(i - h) / (CHOKE.tau * SR));
    L[i] = w.ch[0][i] * g;
    R[i] = r[i] * g;
  }
  return [L, R];
}

const MAKE = { 'fx-impact-end': impactEnd };

export function extras(T) {
  const out = new Map();
  for (const [name, def] of Object.entries(T.SFX)) {
    if (def.dir !== 'ig/sfx') continue;
    const make = MAKE[name];
    if (!make) throw new Error(`[sounds:ig] no generator for the IG extra "${name}" (scripts/ig/sounds.mjs MAKE)`);
    out.set(`ig/sfx/${name}.wav`, make());
  }
  return out;
}

/** The family names this file can make (for QA). */
export const FAMILIES = Object.keys(MAKE);
