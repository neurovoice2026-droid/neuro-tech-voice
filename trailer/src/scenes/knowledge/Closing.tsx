/**
 * The heading ("Answers from your own documents.") and the closing title
 * ("Where your documents stop, it says so." — the site's own line under
 * the stage). Both are the section's display type with the word-mask rise;
 * the closing holds, alive (a slow 1.00 → 1.03 push and a breath), until
 * the whip takes it away with the stage.
 */
import React from 'react';
import { breathe, EASE, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { CLOSING_KEY, HEADING, HEADING_KEY, type Geo } from './geometry';
import { Title } from './Title';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

export const Heading: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  if (t < K.heading - 4 || t > KL.headingOut[1] + 2) return null;
  const H = G.heading;
  return (
    <Title
      t={t}
      lines={H.lines}
      text={HEADING}
      size={H.size}
      width={H.width}
      cx={cx}
      cy={H.cy}
      start={K.heading}
      stagger={2}
      keyPhrase={{ text: HEADING_KEY, at: K.heading + 10 }}
      exit={{ at: KL.headingOut[0], stagger: 0.4, dur: KL.headingOut[1] - KL.headingOut[0] - 1.6 }}
    />
  );
};

export const Closing: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  if (t < K.closing - 4) return null;
  const Cl = G.closing;
  const push = 1 + 0.03 * tween(t, KL.closingPush, [0, 1], EASE.inOut);
  const drift = breathe(t - K.closing, 70, 2.2);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${cx}px ${Cl.cy}px`,
        transform: `translateY(${drift.toFixed(2)}px) scale(${push.toFixed(5)})`,
      }}
    >
      <Title
        t={t}
        lines={Cl.lines}
        text={Cl.lines.join(' ')}
        size={Cl.size}
        width={G.v ? 1000 : 1700}
        cx={cx}
        cy={Cl.cy}
        start={K.closing}
        stagger={2.5}
        keyPhrase={{ text: CLOSING_KEY, at: KL.closingKey }}
      />
    </div>
  );
};
