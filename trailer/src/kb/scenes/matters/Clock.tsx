/**
 * b15–b16 · THE DESK CLOCK, another morning: `WED` over `09:14` (b01's lockup — the same figure cells, size and
 * place, a rhyme with ring one), `LINE 1` under the colon, and — when the line rings and Ava takes it —
 * `AVA · ON A CALL` rolling in under it in her ink. The colon itself is NOT drawn here: it is Ava's teal dot
 * (matters/Dot.tsx), drawn over everything, because it outlives the clock (it becomes the key light).
 *
 * Near plane. b16, both orientations: the figures and the day leave up through their masks before her first word,
 * the labels on it (staggered) — the thesis gets the frame, and her dot stays behind as the room's light (9:16: it
 * rises above the title). Static text rides its own small layer while the camera pushes (lib/glide).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { useGlide } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { SPRING } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { C, FONT } from '../../../theme';
import { APP } from '../../kit';
import { ACCENT } from '../../theme';
import { MATTERS_LOCAL as M } from '../../timing';
import { typeFade, type MattersLayout } from './stage';

/** the morning's figures (SCRIPT.md b15: WED 09:14) */
const DIGITS = ['0', '9', '1', '4'] as const;

export const MattersClock: React.FC<{ t: number; g: MattersLayout }> = ({ t, g }) => {
  const L = useLayout();
  const glide = useGlide();
  const c = g.clock;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const fade = typeFade(t);
  // b16: each element leaves up through its mask — the figures and the day first (gone by her first word), then the
  // labels on it; then there is nothing left to draw
  if (fade <= 0.001 || t > M.labelsOut + 1 + 7 + 1) return null;
  const figDur = M.clockOut[1] - M.clockOut[0];
  const out = (at: number, dur: number) => ({ exit: { at, dur } });
  const still = (at: number, dur: number) => reveal(t, -1e6, { rise: 100, fade: 0, ...out(at, dur) });
  const figure = still(M.clockOut[0], figDur);
  const day = still(M.clockOut[0], figDur);
  const line = still(M.labelsOut, 7);
  // AVA · ON A CALL: rolls up into its window an 8th after the ring (the house caption spring)
  const ava = reveal(t, M.label, { config: SPRING.caption, rise: 100, fade: 0.4, ...out(M.labelsOut + 1, 7) });
  const word = (r: ReturnType<typeof reveal>, text: React.ReactNode, style: React.CSSProperties, center: boolean) => (
    <div style={{ position: 'absolute', ...style, whiteSpace: 'nowrap', transform: center ? 'translateX(-50%)' : undefined }}>
      <span style={maskBox(0)}>
        <span style={revealStyle(r, undefined, glide || r.y !== 0)}>{text}</span>
      </span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade < 0.999 ? fade : undefined }}>
      {word(day, 'WED', { left: c.x + c.cellW * 0.06, top: c.dayY, ...label, color: C.muted }, false)}
      {DIGITS.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.x + i * c.cellW + (i >= 2 ? 2 * c.gap + c.dot : 0),
            top: c.y,
            width: c.cellW,
            height: c.cellH,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              ...revealStyle(figure, undefined, glide || figure.y !== 0),
              width: c.cellW,
              height: c.cellH,
              lineHeight: `${c.cellH}px`,
              fontFamily: FONT.ui,
              fontWeight: 440,
              fontSize: c.size,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0,
              textAlign: 'center',
              color: APP.foreground,
            }}
          >
            {d}
          </span>
        </div>
      ))}
      {word(line, 'LINE 1', { left: c.dotX, top: c.lineY, ...label, color: C.muted, paddingLeft: '0.14em' }, true)}
      {t >= M.label - 1
        ? word(ava, 'AVA · ON A CALL', { left: c.dotX, top: c.avaY, ...label, color: ACCENT.sunday, paddingLeft: '0.14em' }, true)
        : null}
    </div>
  );
};
