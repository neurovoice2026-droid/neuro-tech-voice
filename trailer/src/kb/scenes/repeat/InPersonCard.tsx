/**
 * b01–b05 · THE IN-PERSON CARD: the person at the desk, as type on a white card (no faces are drawn).
 * `● IN PERSON` (label role, a graphite dot) and her sentence rising word by word (caption role, ink,
 * about .2 s a word) until it stops on a hanging em dash — drawn like a pen stroke, left to right, with the
 * pen click. Then the phone takes the desk's attention: the card steps back a depth on every ring
 * (desk.ts cardDepth: scale and a shade), never quite coming back.
 *
 * The card is positioned and scaled by its TRANSFORM on its own small layer (lib/glide): it glides
 * sub-pixel under the act's slow push and its steps back, and its words ride layers of their own.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { C } from '../../../theme';
import { APP, meshElevation } from '../../kit';
import { GRAPHITE } from '../../theme';
import { REPEAT_LOCAL as R } from '../../timing';
import type { DeskLayout } from './desk';

/** frames between the sentence's words (≈ .15 s a word): the nine words from .25 s, the last ("bit") in its place
 *  before the em dash starts drawing (4 frames before 1.75 s, where it lands with the pen click) */
const WORD_STEP = (R.dash - 8 - R.sentence) / 8;

export const InPersonCard: React.FC<{ t: number; g: DeskLayout; scale: number; shade: number; ink: string }> = ({ t, g, scale, shade, ink }) => {
  const L = useLayout();
  const c = g.card;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const cap = typeStyle('caption', L.vertical, { tone: 'paper', size: c.size });
  const dot = Math.round(labelSize * 0.3);
  const sentenceTop = c.padTop + labelSize * 1.2 + L.pick(30, 28);
  let n = 0;
  // the em dash: a pen stroke drawn left → right over 4 frames, landing ON 1.75 s (the pen click)
  const dash = tween(t, [R.dash - 4, R.dash], [0, 1], EASE.out3);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: c.w,
        height: c.h,
        borderRadius: L.pick(36, 32),
        background: APP.card,
        boxShadow: meshElevation(2 * scale, ink, 1),
        transformOrigin: '50% 50%',
        ...subpixel(`translate(${c.x}px, ${c.y}px) scale(${scale.toFixed(5)})`, true),
      }}
    >
      <div style={{ position: 'absolute', left: c.padX, top: c.padTop, display: 'flex', alignItems: 'center', gap: '0.5em', ...label, color: C.muted, whiteSpace: 'nowrap' }}>
        <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
        IN PERSON
      </div>
      <div style={{ position: 'absolute', left: c.padX, top: sentenceTop, ...cap, color: APP.foreground }}>
        {c.lines.map((ws, li) => (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {ws.map((w, j) => {
              const i = n++;
              const r = reveal(t, R.sentence + i * WORD_STEP, { config: SPRING.caption, rise: 80 });
              const last = li === c.lines.length - 1 && j === ws.length - 1;
              return (
                <span key={j} style={maskBox(last ? 0 : 0.24)}>
                  <span style={revealStyle(r, undefined, true)}>{w}</span>
                </span>
              );
            })}
            {li === c.lines.length - 1 ? (
              // the hanging em dash, drawn as a stroke (a clip, so it is crisp at every frame)
              <span style={{ display: 'inline-block', clipPath: `inset(-20% ${((1 - dash) * 100).toFixed(3)}% -20% -2%)`, opacity: t < R.dash - 4 ? 0 : 1 }}>—</span>
            ) : null}
          </div>
        ))}
      </div>
      {shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: `rgba(20, 10, 36, ${shade.toFixed(4)})` }} /> : null}
    </div>
  );
};
