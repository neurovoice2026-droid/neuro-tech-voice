/**
 * The act's titles, set exactly like the knowledge heading (Instrument Sans
 * 460, −0.03em, sentence case, the figure / key phrase in the scene's ONE
 * accent ink), in one centred slot that travels — never two titles in it at
 * once:
 *
 *   hero     "16 industries." lands in the index's spine (the band between
 *            its two halves, no name behind it; the index has stepped back to
 *            ≤ 5.5 % before its first word shows) on the downbeat: each word
 *            rises out of its own mask on a firm spring
 *            (one soft overshoot), "16" first. A beat later "16" turns from
 *            ink to the accent as a band of light runs through it (the
 *            knowledge heading's key-phrase idiom); a second, slower glint
 *            crosses it mid-hold. It HOLDS, still.
 *   swap     as the cards leave, the slot lifts to the band (a soft spring
 *            with a 2 f anticipation) while the words leave up through their
 *            masks (power3.in, staggered) …
 *   in       … and "14 languages." rises into the band as they go, its "14"
 *            turning to the accent as it settles;
 *   out      "14 languages." leaves the same way; "After the call." rises on
 *            the flow beat, "the call." in the accent.
 *
 * No blur, no ghosts, no glows: every move is a continuous function of the
 * fractional time (the master samples it at 120 fps), and moving type is
 * composited at its exact sub-pixel offset (components/Type.tsx subpixel).
 */
import React from 'react';
import { C } from '../../theme';
import { aos, EASE, mixHex, tween } from '../../lib/motion';
import { baselineEm, maskBox, typeStyle } from '../../lib/type';
import { reveal, revealStyle, subpixel, useGlide } from '../../components/Type';
import { mixColor } from '../../lib/lights';
import { ACCENT, ACCENT_LIT } from './lights';

export type TitleTiming = { hero: number; glint: number; swap: number; exit: number; in: number; out: number; after: number };
type Pose = { x: number; y: number; size: number };

/** the hero's words: ζ ≈ .66 — up in ≈ 5 f, one soft 6 % overshoot inside the mask */
const SLAM = { stiffness: 300, damping: 23, mass: 1 };
/** the band titles' words: ζ ≈ .74, up in ≈ 5 f */
const RISE = { stiffness: 260, damping: 24, mass: 1 };
/** the slot's travel to the band */
const MOVE = { stiffness: 200, damping: 24, mass: 1 };
const LH = 1.04;
/** cap centre below the top of the line box (em): baseline − half the cap height (.72) */
const CAP_MID = baselineEm(LH) - 0.36;

type TitleWord = { w: string; key?: boolean };
const HERO: TitleWord[] = [{ w: '16', key: true }, { w: 'industries.' }];
const BAND: TitleWord[] = [{ w: '14', key: true }, { w: 'languages.' }];
const AFTER: TitleWord[] = [{ w: 'After' }, { w: 'the', key: true }, { w: 'call.', key: true }];

/**
 * The key word's ink at t: ink, then the accent from `at` (EASE.house over 14 f) with a band of the
 * accent's lighter step running through it once (`glint` 0 → 1). Returns a style (background-clip: text
 * while the band is on, a plain colour otherwise).
 */
function keyInk(t: number, at: number, glint: number, wordIdx: number, nKey: number): React.CSSProperties {
  const k = tween(t, [at, at + 14], [0, 1], EASE.house);
  const col = mixHex(C.ink, ACCENT, k);
  if (glint <= 0 || glint >= 1) return { color: col };
  // the band travels across the key words left → right (in word units), soft-edged
  const pos = -0.6 + (nKey + 1.2) * glint - wordIdx;
  const lit = mixColor(col, ACCENT_LIT, 0.75);
  const p = (x: number) => `${(x * 100).toFixed(2)}%`;
  return {
    backgroundImage: `linear-gradient(100deg, ${col} ${p(pos - 0.45)}, ${lit} ${p(pos)}, ${col} ${p(pos + 0.45)})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
}

/** a row of masked words; `state(i)` gives word i's reveal */
function Row({
  words,
  state,
  ink,
}: {
  words: TitleWord[];
  state: (i: number) => ReturnType<typeof reveal>;
  ink: (i: number, keyIdx: number) => React.CSSProperties | undefined;
}) {
  let kk = 0;
  return (
    <div style={{ whiteSpace: 'nowrap' }}>
      {words.map((wd, i) => {
        const r = state(i);
        const keyIdx = wd.key ? kk++ : -1;
        if (r.opacity <= 0.001) {
          return (
            <span key={i} style={maskBox(i < words.length - 1 ? 0.24 : 0)}>
              <span style={{ display: 'inline-block', visibility: 'hidden' }}>{wd.w}</span>
            </span>
          );
        }
        return (
          <span key={i} style={maskBox(i < words.length - 1 ? 0.24 : 0)}>
            <span style={{ ...revealStyle(r, '50% 90%'), ...(wd.key ? ink(i, keyIdx) : null) }}>{wd.w}</span>
          </span>
        );
      })}
    </div>
  );
}

export const Titles: React.FC<{ t: number; T: TitleTiming; hero: Pose; band: Pose; after: Pose; vertical: boolean }> = ({
  t,
  T,
  hero,
  band,
  after,
  vertical: v,
}) => {
  // carried by a moving camera (the hero push, the language push, the flow nudges): each title block
  // rides its own small sub-pixel layer, so a slow push never ticks it a pixel at a time
  const glide = useGlide();
  if (t < T.hero - 4) return null;
  const face = (size: number): React.CSSProperties => ({ ...typeStyle('display', v, { tone: 'paper', size }), lineHeight: LH, color: C.ink });

  /* ── the slot: hero → band (the hero title travels with it as it leaves) ── */
  const m = aos(t, T.swap, { anticip: 2, depth: 0.03, config: MOVE });
  const sx = hero.x + (band.x - hero.x) * m;
  const sy = hero.y + (band.y - hero.y) * m;
  const ss = 1 + (band.size / hero.size - 1) * m;
  const slotMoving = t > T.swap - 2 && Math.abs(1 - m) > 1e-4;

  /* ── A: "16 industries." ── */
  const nA = HERO.length;
  // (it flicks out fast — gone before "14 languages." starts to rise at the band, so the two never meet)
  const stA = (i: number) =>
    reveal(t, T.hero - 3 + 1.6 * i, { config: SLAM, rise: 100, fade: 0.45, exit: { at: T.exit - 1 + 0.6 * i, dur: 4.5 } });
  const goneA = t > T.exit - 1 + 0.6 * (nA - 1) + 4.6;
  // the figure turns to the accent a beat after it lands, a band of light through it; again mid-hold, slower
  const g1 = tween(t, [T.hero + 3, T.hero + 15], [0, 1], EASE.inOut);
  const g2 = tween(t, [T.glint, T.glint + 16], [0, 1], EASE.inOut);
  const glintA = g1 > 0 && g1 < 1 ? g1 : g2;
  const inkA = (_i: number, ki: number) => keyInk(t, T.hero + 3, glintA, ki, 1);

  /* ── B: "14 languages." (in the band) ── */
  // (it rises once the hero title has gone, landing ON langTitle; it leaves before "After the call." rises — in 9:16
  // the two share one place)
  const stB = (i: number) => reveal(t, T.in + 1 + 1.5 * i, { config: RISE, rise: 100, fade: 0.45, exit: { at: T.out - 4 + 1.2 * i, dur: 6 } });
  const showB = t > T.in && t < T.out - 4 + 1.2 * (BAND.length - 1) + 6.1;
  const gB = tween(t, [T.in + 6, T.in + 18], [0, 1], EASE.inOut);
  const inkB = (_i: number, ki: number) => keyInk(t, T.in + 6, gB, ki, 1);

  /* ── C: "After the call." ── */
  const stC = (i: number) => reveal(t, T.after + 1.4 * i, { config: RISE, rise: 100, fade: 0.45 });
  const showC = t > T.after - 1;
  const gC = tween(t, [T.after + 8, T.after + 22], [0, 1], EASE.inOut);
  const inkC = (_i: number, ki: number) => keyInk(t, T.after + 8, gC, ki, 2);

  /** a title block centred on (x, cap-centre y) at `size` px (scaled by `s` about its cap centre) */
  const block = (key: string, x: number, y: number, size: number, s: number, moving: boolean, children: React.ReactNode) => {
    const tf = `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${s.toFixed(5)}) translate(-50%, ${(-CAP_MID * size).toFixed(3)}px)`;
    return (
      <div key={key} style={{ position: 'absolute', left: 0, top: 0, ...face(size), ...subpixel(tf, moving || glide), transformOrigin: '0 0' }}>
        {children}
      </div>
    );
  };

  return (
    <>
      {!goneA
        ? block('a', sx, sy, hero.size, ss, slotMoving, <Row words={HERO} state={stA} ink={inkA} />)
        : null}
      {showB ? block('b', band.x, band.y, band.size, 1, false, <Row words={BAND} state={stB} ink={inkB} />) : null}
      {showC ? block('c', after.x, after.y, after.size, 1, false, <Row words={AFTER} state={stC} ink={inkC} />) : null}
    </>
  );
};
