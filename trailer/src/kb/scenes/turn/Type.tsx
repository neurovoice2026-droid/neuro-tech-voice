/**
 * b07's TYPE — the house system only (src/theme.ts TYPE, Instrument Sans), blur-free: every word rises out of
 * its own mask on its spoken onset and leaves up through it.
 *
 *   <LeadOut>      b06's last words ("And the customer / in front of them?", "Waiting.") exactly as b06 sets
 *                  them (scenes/recording/Type.tsx SaidLines / Waiting at rest — the same DOM, so frame 0 is
 *                  b06's last frame), leaving up through their masks as the seam draws
 *   <TwoKinds>     the diptych's two statements in the headline role: "Some work repeats." — its last word in
 *                  the kit's split-flap window (kit/paper.tsx FlipWord), in the callers' slate, flipping on every
 *                  beat and only ever to the same word — and "Some work matters.", still, in full ink. 16:9 they
 *                  share a baseline, set left on each half's margin; 9:16 each is centred on its own line above /
 *                  below the seam (laid out by measurement, set left: a line that fills from its first word
 *                  never wanders)
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { SPRING } from '../../../lib/motion';
import { baselineEm, maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { measureText, useKitFaces } from '../../kit';
import { HOME } from '../../palettes';
import { KB_INK } from '../../theme';
import { TURN_FLIPS, TURN_LOCAL as T } from '../../timing';
import { Flap } from './Flap';
import type { TurnStage } from './stage';

/** slate: the work said by rote (the callers' ink — b06's strips) */
export const ROTE_INK = KB_INK.caller.paper.text;
/** the flap lands ON the beat: it starts this many frames before (FlipWord's 6-frame turn, its lower flap down by ~4.5) */
export const FLAP_LEAD = 4.5;
const FLAP_STARTS = TURN_FLIPS.map((f) => f - FLAP_LEAD);
/** the flip window's side padding (turn/Flap.tsx: .13em); its mask leaves room round it for the window's shadow */
const FLIP_PAD = 0.13;
const FLIP_MASK = FLIP_PAD + 0.07;

/* ── b06's last words, leading out ──────────────────────────────── */

export const LeadOut: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const v = S.vertical;
  if (t > T.sort + 16) return null;
  const lines = [
    ['And', 'the', 'customer'],
    ['in', 'front', 'of', 'them?'],
  ];
  let n = 0;
  // "Waiting." — b06's display word on its baseline
  const st = typeStyle('display', v, { tone: 'paper' });
  const size = st.fontSize as number;
  const lh = 1.04;
  const base = ((lh - 1.22) / 2 + 0.97) * size;
  const wr = reveal(t, -1e6, { exit: { at: T.sort + 3, dur: 8 } });
  const wMoving = Math.abs(wr.y) > 0.03;
  return (
    <>
      <div style={{ position: 'absolute', left: S.question.x, top: S.question.y, ...typeStyle('caption', v, { tone: 'paper' }), color: HOME.ink, whiteSpace: 'nowrap' }}>
        {lines.map((ws, li) => (
          <div key={li}>
            {ws.map((w, k) => {
              const i = n++;
              const r = reveal(t, -1e6, { config: SPRING.caption, rise: 100, fade: 0.5, exit: { at: T.sort + i * 0.6, dur: 8 } });
              return (
                <span key={k} style={maskBox(k === ws.length - 1 ? 0 : 0.24)}>
                  <span style={revealStyle(r)}>{w}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: S.waiting.x, top: S.waiting.baseline - base, ...st, lineHeight: lh, color: HOME.ink, whiteSpace: 'nowrap' }}>
        <span style={maskBox(0)}>
          <span style={{ display: 'inline-block', ...subpixel(wMoving ? `translateY(${wr.y.toFixed(3)}%)` : undefined, wMoving), opacity: wr.opacity >= 0.999 ? undefined : Math.max(0, wr.opacity) }}>Waiting.</span>
        </span>
      </div>
    </>
  );
};

/* ── the two statements ──────────────────────────────────────────── */

type Word = { text: string; at: number; color: string; flip?: boolean };

/** em → px tracking number for measureText (TYPE.headline.tracking is a CSS em string) */
const trackEm = (s: string | number) => (typeof s === 'number' ? s : parseFloat(s));

const Statement: React.FC<{
  t: number;
  words: readonly Word[];
  x: number;
  baseline: number;
  size: number;
  center: boolean;
  exitAt: number;
  vertical: boolean;
}> = ({ t, words, x, baseline, size, center, exitAt, vertical }) => {
  useKitFaces();
  if (t < words[0].at - 1) return null;
  if (t > exitAt + words.length + 10) return null;
  const st = typeStyle('headline', vertical, { tone: 'paper', size });
  const lh = TYPE.headline.lineHeight;
  const spec = { size, weight: TYPE.headline.weight, tracking: trackEm(TYPE.headline.tracking) };
  // the line's width as laid out (the flip window adds its padding), for the 9:16 centring
  const space = measureText('n n', spec) - measureText('nn', spec);
  const width = words.reduce((a, w, i) => a + measureText(w.text, spec) + (w.flip ? 2 * FLIP_PAD * size : 0) + (i ? space : 0), 0);
  const left = center ? Math.round(x - width / 2) : x;
  return (
    <div style={{ position: 'absolute', left, top: baseline - baselineEm(lh) * size, ...st, color: HOME.ink, whiteSpace: 'nowrap' }}>
      {words.map((w, i) => {
        const r = reveal(t, w.at, { config: SPRING.text, rise: 100, fade: 0.55, exit: { at: exitAt + i, dur: 9 } });
        const gap = i === words.length - 1 ? 0 : 0.24;
        if (w.flip) {
          // a wider mask than a word's: the window's tile is inside it, side padding and all
          const m = maskBox(gap);
          const pad = FLIP_MASK;
          return (
            <span key={i} style={{ ...m, padding: `0.16em ${pad}em 0.26em ${pad}em`, margin: `-0.16em ${(gap - pad).toFixed(3)}em -0.26em -${pad}em` }}>
              <span style={revealStyle(r, undefined, true)}>
                <Flap t={t} word={w.text} flips={FLAP_STARTS} color={w.color} lh={lh} />
              </span>
            </span>
          );
        }
        return (
          <span key={i} style={{ ...maskBox(gap) }}>
            <span style={{ ...revealStyle(r), color: w.color }}>{w.text}</span>
          </span>
        );
      })}
    </div>
  );
};

export const TwoKinds: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const L = useLayout();
  const v = L.vertical;
  const [a0, a1, a2] = T.left;
  const [b0, b1, b2] = T.right;
  return (
    <>
      <Statement
        t={t}
        vertical={v}
        x={S.titleL.x}
        baseline={S.titleL.baseline}
        size={S.titleL.size}
        center={S.titleL.align === 'center'}
        exitAt={T.firstKind}
        words={[
          { text: 'Some', at: a0, color: HOME.ink },
          { text: 'work', at: a1, color: HOME.ink },
          { text: 'repeats.', at: a2, color: ROTE_INK, flip: true },
        ]}
      />
      <Statement
        t={t}
        vertical={v}
        x={S.titleR.x}
        baseline={S.titleR.baseline}
        size={S.titleR.size}
        center={S.titleR.align === 'center'}
        exitAt={T.yieldAt}
        words={[
          { text: 'Some', at: b0, color: HOME.ink },
          { text: 'work', at: b1, color: HOME.ink },
          { text: 'matters.', at: b2, color: HOME.ink },
        ]}
      />
    </>
  );
};
