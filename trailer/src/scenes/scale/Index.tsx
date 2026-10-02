/**
 * THE INDEX — the sixteen industries, typeset. No cards, no icons, no
 * shadows: names in Instrument Sans 460 (−0.02em, the title tracking), set on
 * a fixed row pitch in columns (16:9 4 × 4 at 54 px · 9:16 2 × 8 at 52 px),
 * ragged where a long name wraps, ≥ 150 px from every side (geometry.ts).
 *
 *   landing   each name rises out of its own mask, line by line, in full
 *             ink on its pop; a beat later it takes the scene's ONE accent
 *             (the closing light's emerald) — the current name, the one the
 *             light is on — and when the next name lands it settles back to
 *             the index's resting ink (30 %). On the 16ths the light runs
 *             through the bottom half like a passing light.
 *   spine     the rows are set in two halves around a SPINE, the band where
 *             "16 industries." lands: no name ever sits behind the hero.
 *   the hero  over the last 16ths into the slam the whole index steps back to
 *             ≤ 5.5 % ink (done a frame before the title's first word shows),
 *             so the title lands on clean paper framed by a whisper of the
 *             sixteen names.
 *   clearing  late in the hold the names leave up through their masks in
 *             reading order (a 6 f ripple) — gone before the title lifts to
 *             the band and the English card rises in (Langs.tsx).
 *
 * Colour and opacity are continuous functions of the fractional time; no
 * blur, no glow, no ghosts.
 */
import React from 'react';
import { C } from '../../theme';
import { EASE, mixHex, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { reveal, revealStyle, subpixel } from '../../components/Type';
import { SCALE, SCALE_LOCAL } from '../../timing';
import type { Geo } from './geometry';
import { ACCENT, rgba } from './lights';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;

/** the index's resting ink (share of ink on paper), and where it steps back to under the hero */
const REST_INK = 0.3;
const HERO_INK = 0.055;

/** name i starts to rise 2 f before its pop (it is mid-rise ON the hit, settled ≈ 5 f after); name 01 is
 *  already up on the scene's first frame (−preroll) — the cut never shows an empty white frame */
export const popStart = (i: number) => (i === 0 ? K.pops[0] - K.preroll - 1.5 : K.pops[i] - 2);

/** the index leaves (up through its masks, reading order: a 6 f ripple), gone before the title lifts */
const exitAt = (G: Geo, i: number, v: boolean) => {
  const e = G.entries[i];
  const order = v ? e.r * 2 + e.c : e.r * 4 + e.c;
  return K.flyOut + order * 0.38;
};

/** the hero's first word shows from HERO − 2.5 (Heading.tsx): by then the index is all at HERO_INK */
const CLEAR = HERO - 2.5;

/** the light on name i (0..1): up with its landing, off as the next lands — one name at a time (on the
 *  16ths a short trail) — and every light out before the title shows */
function lightOn(t: number, i: number): number {
  const on = tween(t, [popStart(i), popStart(i) + 3], [0, 1], EASE.out3);
  const off = i < 15 ? tween(t, [K.pops[i + 1] - 0.5, K.pops[i + 1] + 4.5], [0, 1], EASE.inOut) : 0;
  const slam = tween(t, [CLEAR - 3.5, CLEAR], [0, 1], EASE.inOut);
  return on * (1 - off) * (1 - slam);
}

/** its accent (0..1): a beat after it lands in ink, the light takes it (name 01: on the cut's first beat) */
const accentOn = (t: number, i: number) => tween(t, [K.pops[i] + 0.5, K.pops[i] + 5], [0, 1], EASE.house);

/** the index's resting ink at t: 30 %, stepping back to ≤ 5.5 % over the last 16ths, before the title shows */
const restInk = (t: number) => REST_INK + (HERO_INK - REST_INK) * tween(t, [CLEAR - 4.5, CLEAR], [0, 1], EASE.inOut);

export const Index: React.FC<{ t: number; G: Geo; vertical: boolean }> = ({ t, G, vertical: v }) => {
  if (t > K.flyOut + 16 * 0.38 + 6) return null;
  const face: React.CSSProperties = {
    ...typeStyle('title', v, { tone: 'paper', size: G.size, weight: 460 }),
    lineHeight: `${G.lineH}px`,
    whiteSpace: 'nowrap',
  };
  const base = restInk(t);
  return (
    <>
      {G.entries.map((e, i) => {
        const s = popStart(i);
        if (t < s - 0.5) return null;
        const hl = lightOn(t, i);
        const alpha = base + (1 - base) * hl;
        const col = rgba(mixHex(C.ink, ACCENT, accentOn(t, i) * hl), alpha);
        // name 01 carries the knowledge whip's momentum (16:9 from the right, 9:16 from below)
        const mom = i === 0 ? 64 * (1 - springUnit(t - s, SPRING.pop)) : 0;
        const moving = mom > 0.01;
        const tf = moving ? (v ? `translate(0px, ${mom.toFixed(3)}px)` : `translate(${mom.toFixed(3)}px, 0px)`) : undefined;
        // (name 01 is read from the cut: it is up before the whip lets go of it)
        const at = i === 0 ? s - 12 : s;
        const out = exitAt(G, i, v);
        return (
          <div key={i} style={{ position: 'absolute', left: e.box.x, top: e.box.y, ...face, color: col, ...subpixel(tf, moving) }}>
            {e.lines.map((ln, j) => {
              const r = reveal(t, at + 0.6 + 1.1 * j, { config: SPRING.caption, rise: 100, fade: 0.5, exit: { at: out + 0.5 * j, dur: 5 } });
              if (r.opacity <= 0.001) return <div key={j} style={{ height: G.lineH }} />;
              return (
                <div key={j}>
                  <span style={maskBox(0)}>
                    <span style={revealStyle(r)}>{ln}</span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};
