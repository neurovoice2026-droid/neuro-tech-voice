/**
 * b17 · "Your answers. / Written once, there for every call." — Ava's closing line as the house two-tone heading
 * (TYPE.headline on the night: weightOnDark 440, −0.03em, line-height 1.06), CENTRED on the close's axis, the
 * paper ink with the key phrase in her teal on dark (inkFor('sunday', 'dark')).
 *
 *   rise   each ROW rises as a unit out of its word masks (½-frame ripple: film 1's Headline idiom, the v9 rule —
 *          a centred row never hangs half-filled off-centre) a few frames ahead of its phrase's first spoken word:
 *          16:9 "Your answers." on "Your", "Written once, there for every call." on "Written"; 9:16 a row per
 *          phrase ("Your answers." · "Written once," · "there for every call.")
 *   key    "there for every call." takes the teal WORD BY WORD as each word is said: a glint of her lightest teal
 *          runs into the word on its onset and settles to the key ink — colour moving through the type, no glow
 *   exit   on the converge the words leave up through their masks one by one, accelerating (film 1's converge)
 *
 * Words ride sub-pixel layers while they move (components/Type revealStyle), pixel-crisp at rest.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { mixColor } from '../../../lib/lights';
import { EASE, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle, UNIT_STAGGER } from '../../../lib/type';

export type HeadingRow = { words: readonly string[]; /** the words' indices in the spoken line */ idx: readonly number[]; at: number };

export const Heading: React.FC<{
  t: number;
  rows: readonly HeadingRow[];
  cy: number;
  size: number;
  vertical: boolean;
  color: string;
  /** spoken-word index → its onset (cta-local), for the key words */
  keyOn: ReadonlyMap<number, number>;
  keyColor: string;
  glint: string;
  exit: { from: number; step: number; dur: number };
}> = ({ t, rows, cy, size, vertical, color, keyOn, keyColor, glint, exit }) => {
  const n = rows.reduce((a, r) => a + r.words.length, 0);
  if (t < rows[0].at - 1) return null;
  if (t > exit.from + (n - 1) * exit.step + exit.dur + 1) return null;
  let k = 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: cy,
        transform: 'translateY(-50%)',
        ...typeStyle('headline', vertical, { tone: 'night', size }),
        color,
        textAlign: 'center',
      }}
    >
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: 'nowrap' }}>
          {row.words.map((w, j) => {
            const order = k++;
            const r = reveal(t, row.at + j * UNIT_STAGGER, {
              config: SPRING.text,
              exit: { at: exit.from + order * exit.step, dur: exit.dur, to: 'up' },
            });
            let col: string | undefined;
            const on = keyOn.get(row.idx[j]);
            if (on !== undefined && t >= on - 1) {
              // into the glint over 2 frames on its onset, then settling to the key ink
              const up = tween(t, [on - 1, on + 1], [0, 1], EASE.out3);
              const settle = tween(t, [on + 1, on + 14], [0, 1], EASE.inOut);
              col = settle <= 0 ? mixColor(color, glint, up) : mixColor(glint, keyColor, settle);
            }
            return (
              <span key={j} style={maskBox(j < row.words.length - 1 ? 0.24 : 0)}>
                <span style={{ ...revealStyle(r), color: col }}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
