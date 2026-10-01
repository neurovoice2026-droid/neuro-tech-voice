/**
 * The heading ("Answers from your own documents." — TYPE.headline, THE look)
 * and the closing title ("Where your documents stop, it says so." — the
 * site's own line under the stage, TYPE.display). Both rise word by word out
 * of their masks; their key phrases turn sunday ink with a glint of light
 * running through them.
 *
 * The heading rises where the orb will be, then (16:9) steps down into the
 * answer row (scale .72, on a spring that settles) to make way for the orb,
 * and holds there, readable, until the caller has said "question,"; then its
 * words leave up through their masks. The step is pure motion — at 120 fps a
 * 300 px move reads crisply; nothing is smeared.
 *
 * The closing arrives on the stage's recede and HOLDS, still but for a slow
 * 1.00 → 1.025 push and a breath, for ≥ 1.5 s, until the whip takes it away
 * with the stage. ON its key hit "it says so." turns sunday ink — no pool of
 * light behind it: the colour is in the words.
 */
import React from 'react';
import { subpixel } from '../../components/Type';
import { breathe, EASE, mix, springUnit, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { CLOSING_KEY, HEADING, HEADING_KEY, INK, SUN, type Geo } from './geometry';
import { Title } from './Title';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** ζ ≈ .82: the step settles with a ~1 % overshoot */
const STEP = { stiffness: 170, damping: 21.5, mass: 1 };

/** the heading's step down: 0 → 1 (spring) */
const stepAt = (f: number) => springUnit(f - KL.headingStep[0], STEP);

export const Heading: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  const H = G.heading;
  const out = H.step ? KL.headingOut : KL.headingOutOrb;
  if (t < KL.headingAt - 4 || t > out[1] + 2) return null;
  const step = H.step;
  const q = step ? stepAt(t) : 0;
  const dy = step ? (step.cy - H.cy) * q : 0;
  const sc = step ? mix(1, step.scale, q) : 1;
  const moving = step ? Math.abs(1 - q) > 2e-4 && q > 0 : false;
  const tf = q > 0 ? `translateY(${dy.toFixed(3)}px) scale(${sc.toFixed(5)})` : undefined;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${cx}px ${H.cy}px`,
        ...subpixel(tf, moving),
      }}
    >
      <Title
        t={t}
        lines={H.lines}
        text={HEADING}
        role="headline"
        vertical={G.v}
        size={H.size}
        width={H.width}
        cx={cx}
        cy={H.cy}
        start={KL.headingAt}
        stagger={KL.headingStagger}
        keyPhrase={{ text: HEADING_KEY, at: KL.headingAt + 10, color: INK, glint: SUN.orb[2] }}
        exit={{ at: out[0], stagger: 0.5, dur: 5 }}
      />
    </div>
  );
};

export const Closing: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  if (t < K.closing - 4) return null;
  const Cl = G.closing;
  const push = 1 + 0.025 * tween(t, KL.closingPush, [0, 1], EASE.inOut);
  const drift = breathe(t - K.closing, 80, 1.6);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${cx}px ${Cl.cy}px`,
        // the slow push never stops (it is a compositor move: sub-pixel smooth, no glyph stepping)
        ...subpixel(`translateY(${drift.toFixed(3)}px) scale(${push.toFixed(5)})`, true),
      }}
    >
      <Title
        t={t}
        lines={Cl.lines}
        text={Cl.lines.join(' ')}
        role="display"
        vertical={G.v}
        size={Cl.size}
        width={G.v ? 1000 : 1800}
        cx={cx}
        cy={Cl.cy}
        start={K.closing}
        stagger={KL.closingStagger}
        keyPhrase={{ text: CLOSING_KEY, at: KL.closingKey, color: INK, glint: SUN.orb[2] }}
      />
    </div>
  );
};
