/**
 * b15–b16 · THE IN-PERSON CARD, at full depth (the person at the desk: type on a white card, no face drawn).
 * `● IN PERSON` and her sentence from b01 — "First session since my / injury, and I'm a bit—" — and on the act's
 * first frame it finally completes: the em dash that has hung since b01 is lifted off (the pen stroke un-drawn,
 * right to left, 3 frames) and `nervous.` rises out of its mask in its place (caption role, ink, SPRING.caption).
 *
 * Then the line rings, and the card DOES NOT MOVE (in Part I it stepped back on every ring): the missing motion is
 * the payoff. It moves only with the camera's slow push in b16, and dims with the room in the last beats.
 *
 * Positioned by its transform on its own small layer (lib/glide): it glides sub-pixel under the push.
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
import { MATTERS_LOCAL as M } from '../../timing';
import { CARD_LINES, NERVOUS, type MattersLayout } from './stage';

/** the night the room sinks into (MOMENT_LIGHTS.night ground's last stop, #08061c) */
export const NIGHT_RGB = '8, 6, 28';

export const MattersCard: React.FC<{ t: number; g: MattersLayout; ink: string; shade: number }> = ({ t, g, ink, shade }) => {
  const L = useLayout();
  const c = g.card;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const cap = typeStyle('caption', L.vertical, { tone: 'paper', size: c.size });
  const dot = Math.round(labelSize * 0.3);
  const sentenceTop = c.padTop + labelSize * 1.2 + L.pick(30, 28);
  // the em dash, lifted off: un-drawn right → left over the act's first 2 frames; "nervous." rises a frame behind
  // it (its first frame is still under the mask), so the two never cross
  const dash = 1 - tween(t, [M.dash[0], M.dash[1]], [0, 1], EASE.in2);
  const nervous = reveal(t, M.nervous + 1, { config: SPRING.caption, rise: 80 });
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
        boxShadow: meshElevation(2, ink, 1 - shade),
        ...subpixel(`translate(${c.x}px, ${c.y}px)`, true),
      }}
    >
      <div style={{ position: 'absolute', left: c.padX, top: c.padTop, display: 'flex', alignItems: 'center', gap: '0.5em', ...label, color: C.muted, whiteSpace: 'nowrap' }}>
        <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
        IN PERSON
      </div>
      <div style={{ position: 'absolute', left: c.padX, top: sentenceTop, ...cap, color: APP.foreground }}>
        <div style={{ whiteSpace: 'nowrap' }}>{CARD_LINES[0].join(' ')}</div>
        <div style={{ whiteSpace: 'nowrap' }}>
          {CARD_LINES[1].join(' ')}
          {/* the hanging em dash: a zero-width box on the line's baseline, the dash overflowing it (so it overlays the
              space "nervous." rises into and never pushes the word) */}
          {dash > 0.001 ? (
            <span style={{ display: 'inline-block', width: 0, overflow: 'visible', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-block', clipPath: `inset(-20% ${((1 - dash) * 100).toFixed(3)}% -20% -2%)` }}>—</span>
            </span>
          ) : null}{' '}
          <span style={maskBox(0)}>
            <span style={revealStyle(nervous, undefined, true)}>{NERVOUS}</span>
          </span>
        </div>
      </div>
      {/* the room's light going: the card sinks into the night with it */}
      {shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: `rgba(${NIGHT_RGB}, ${shade.toFixed(4)})` }} /> : null}
    </div>
  );
};
