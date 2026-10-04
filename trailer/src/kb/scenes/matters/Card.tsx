/**
 * b15–b16 · THE IN-PERSON CARD, at full depth (the person at the desk: type on a white card, no face drawn).
 * `● IN PERSON` and her sentence from b01 — "First session since my / injury, and I'm a bit—" — and on the act's
 * first frame it finally completes: the em dash that has hung since b01 is lifted off (the pen stroke un-drawn,
 * right to left, 3 frames) and `nervous.` rises out of its mask in its place (caption role, ink, SPRING.caption).
 *
 * Then the line rings, and the card DOES NOT MOVE (in Part I it stepped back on every ring): the missing motion is
 * the payoff. In b16 it steps back with the desk as the thesis lands (Matters.tsx; a .06 shade), and in the last beats
 * it falls into silhouette under the closing key, pixel by pixel with the ground around it (matters/Night.tsx): its
 * sentence goes first, by its opacity, then the card itself goes into the night.
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
import { fadeMask, localClosing, NightShade } from './Night';
import { CARD_LINES, deskToScreen, litAt, NERVOUS, type Closing, type MattersLayout } from './stage';

export const MattersCard: React.FC<{ t: number; g: MattersLayout; ink: string; flat: number; cl: Closing | null }> = ({ t, g, ink, flat, cl }) => {
  const L = useLayout();
  const c = g.card;
  // the closing key in the card's own px (it sits on the desk at (c.x, c.y), under the step back and the camera)
  const o = deskToScreen(t, g.vertical, c.x, c.y);
  const lc = cl ? localClosing(cl, o, o.z) : null;
  const centre = deskToScreen(t, g.vertical, c.x + c.w / 2, c.y + c.h / 2);
  // its shadow goes with the light where it stands; once the light has left all of it, the silhouette goes too
  const shadowK = litAt(cl, centre.x, centre.y);
  const near = cl ? nearestLit(cl, o, o.z, c.w, c.h) : 1;
  const gone = cl ? Math.min(1, near / 0.12) : 1;
  if (gone <= 0.001) return null;
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
        boxShadow: meshElevation(2, ink, shadowK),
        opacity: gone < 0.999 ? gone : undefined,
        ...subpixel(`translate(${c.x}px, ${c.y}px)`, true),
      }}
    >
      <div style={{ position: 'absolute', inset: 0, ...fadeMask(lc) }}>
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
      </div>
      {/* the step back's shade, and the room's light going: the card sinks into the night with it */}
      <NightShade lc={lc} flat={flat} />
    </div>
  );
};

/** how lit an element's nearest point to her dot is (its local box w × h at screen origin `o`, scale `z`) */
export const nearestLit = (cl: Closing, o: { x: number; y: number }, z: number, w: number, h: number) => {
  const nx = Math.min(Math.max(cl.x, o.x), o.x + w * z);
  const ny = Math.min(Math.max(cl.y, o.y), o.y + h * z);
  return litAt(cl, nx, ny);
};
