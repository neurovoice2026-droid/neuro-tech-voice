/**
 * The heading ("Answers from your own documents.") and the closing title
 * ("Where your documents stop, it says so." — the site's own line under
 * the stage). Both are the section's display type with the word-mask rise;
 * their key phrases turn sunday ink with a glint of light running through.
 *
 * The heading rises where the orb will be, then — lifting 2 f first —
 * steps down into the answer slot (scale .8, on a spring that settles,
 * smeared by its own speed) to make way for the orb, and holds there,
 * readable, until just before the caller's first word; then it dips and
 * flicks up out of its masks.
 *
 * The closing holds, alive (a slow 1.00 → 1.03 push and a breath), until
 * the whip takes it away with the stage; ON its key hit a pool of Sunday
 * light blooms behind "it says so." and stays, low, as a glow.
 */
import React from 'react';
import { spring } from 'remotion';
import { bloom } from '../../lib/lights';
import { breathe, EASE, mix, tween } from '../../lib/motion';
import { FPS, KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { DirBlur, dirBlurRef, flashAt, sigmaFor } from './blur';
import { CLOSING_KEY, HEADING, HEADING_KEY, INK, SUN, SUN_GLOW, type Geo } from './geometry';
import { Title } from './Title';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
const LH = 1.04;

/** ζ ≈ .77: the step settles with a ~2 % overshoot */
const STEP = { stiffness: 170, damping: 20, mass: 1 };

/** the heading's step down: 0 → 1 (spring), with a 2 f lift before it (px, up = negative) */
function stepAt(f: number) {
  const [a] = KL.headingStep;
  const q = f < a ? 0 : spring({ frame: f - a, fps: FPS, config: STEP });
  let lift = 0;
  if (f > a - 2 && f < a) lift = -10 * Math.sin(((f - (a - 2)) / 2) * (Math.PI / 2));
  else if (f >= a && f < a + 3) lift = -10 * Math.cos(((f - a) / 3) * (Math.PI / 2));
  return { q, lift };
}

export const Heading: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  const H = G.heading;
  const out = H.step ? KL.headingOut : KL.headingOutOrb;
  if (t < KL.headingAt - 4 || t > out[1] + 2) return null;
  const step = H.step;
  const D = step ? step.cy - H.cy : 0;
  const y = (f: number) => {
    if (!step) return 0;
    const s = stepAt(f);
    return s.lift + D * s.q;
  };
  const q = step ? stepAt(t).q : 0;
  const sc = step ? mix(1, step.scale, Math.min(1.02, q)) : 1;
  const v = y(t + 0.5) - y(t - 0.5);
  const sy = Math.min(16, sigmaFor(v));
  const f = dirBlurRef('kb-heading-blur', 0, sy);
  return (
    <>
      {f ? <DirBlur id="kb-heading-blur" sx={0} sy={sy} /> : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `${cx}px ${H.cy}px`,
          transform: `translateY(${y(t).toFixed(2)}px) scale(${sc.toFixed(4)})`,
          filter: f,
        }}
      >
        <Title
          t={t}
          lines={H.lines}
          text={HEADING}
          size={H.size}
          width={H.width}
          cx={cx}
          cy={H.cy}
          start={KL.headingAt}
          stagger={KL.headingStagger}
          keyPhrase={{ text: HEADING_KEY, at: KL.headingAt + 10, color: INK, glint: SUN.orb[2] }}
          exit={{ at: out[0], stagger: 0.4, dur: out[1] - out[0] - 1.6 }}
        />
      </div>
    </>
  );
};

export const Closing: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  if (t < K.closing - 4) return null;
  const Cl = G.closing;
  const push = 1 + 0.03 * tween(t, KL.closingPush, [0, 1], EASE.inOut);
  const drift = breathe(t - K.closing, 70, 2.2);
  // the key line's centre (rows are size · LH apart, centred on cy)
  const n = Cl.lines.length;
  const keyY = Cl.cy + ((n - 1) / 2) * Cl.size * LH;
  const hit = flashAt(t, KL.closingKey, 8);
  const rest = tween(t, [KL.closingKey, KL.closingKey + 14], [0, 1], EASE.out3);
  const glow = 0.85 * hit + 0.22 * rest;
  const BD = Cl.size * 3.2;
  const stretch = G.v ? 2.1 : 2.6;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${cx}px ${Cl.cy}px`,
        transform: `translateY(${drift.toFixed(2)}px) scale(${push.toFixed(5)})`,
      }}
    >
      {glow > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: cx - BD / 2,
            top: keyY - BD / 2,
            width: BD,
            height: BD,
            transform: `scaleX(${(stretch * (1 + 0.08 * hit)).toFixed(3)})`,
            background: bloom(SUN_GLOW, glow, { core: 0.55, coreSize: 0.4 }),
          }}
        />
      ) : null}
      <Title
        t={t}
        lines={Cl.lines}
        text={Cl.lines.join(' ')}
        size={Cl.size}
        width={G.v ? 1000 : 1700}
        cx={cx}
        cy={Cl.cy}
        start={K.closing}
        stagger={KL.closingStagger}
        keyPhrase={{ text: CLOSING_KEY, at: KL.closingKey, color: INK, glint: SUN.orb[2] }}
      />
    </div>
  );
};
