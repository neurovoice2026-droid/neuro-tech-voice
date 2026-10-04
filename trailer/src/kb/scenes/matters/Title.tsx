/**
 * b16 · THE THESIS — "That's the work / only people can do." — the film's one statement, in the house system (the
 * display role, Instrument Sans 460, TRACK.section, line-height 1.04; set a step up for this line only: stage.ts
 * title.size), as a clean left block on the stepped-back card's edge. Each word rises out of its mask on its spoken
 * onset (SPRING.text, recording/Type.tsx LeftTitle's motion); on "do." the key phrase eases into her teal ink as a glint
 * runs through it word by word.
 *
 * LIT THROUGH THE DARK: the room's light closes onto her dot (stage.ts closingAt) and the thesis is the last thing
 * standing in it. It is drawn twice, cut by the room's half-light contour (stage.ts Closing.edge): inside it, ink on the lit room;
 * outside it, the night's type (paper, her teal on dark — b17's heading inks). Where the dark has reached a word, the
 * word is light type on the night: it never dims, never greys, never loses contrast. It leaves up through its masks in
 * the dark's last frames (MATTERS_LOCAL.titleOut) — gone on the close's bar, leaving her dot.
 *
 * A screen graphic (it never zooms). Blur-free: masks, colour and transforms only.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { inkFor, mixColor } from '../../../lib/lights';
import { EASE, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { C } from '../../../theme';
import { HOME, MOMENT_LIGHTS } from '../../palettes';
import { ACCENT } from '../../theme';
import { fadeMask } from './Night';
import type { Closing } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the two settings of the same words: ink on the lit room, the night's type where the dark has reached them */
const INKS = {
  lit: { base: HOME.ink, key: ACCENT.sunday, glint: SUNDAY.orb[2] },
  night: { base: C.paper, key: inkFor('sunday', 'dark'), glint: SUNDAY.orb[4] },
} as const;
/** half the width of the ink → light edge (px): a crisp cut through a glyph, never a hard pixel step */
const EDGE = 9;

export type ThesisProps = {
  t: number;
  /** vo-8's seven words, and the rise time of each (its spoken onset, a frame ahead) */
  words: readonly string[];
  at: readonly number[];
  /** the word indices of each line */
  lines: readonly (readonly number[])[];
  x: number;
  /** the first line box's top */
  y: number;
  size: number;
  vertical: boolean;
  /** the key phrase: from word `from` to the end, eased into her ink at `at` */
  keyPhrase: { from: number; at: number };
  exit: { at: number; stagger: number; dur: number };
  cl: Closing | null;
};

const Words: React.FC<ThesisProps & { ink: (typeof INKS)[keyof typeof INKS] }> = ({ t, words, at, lines, x, y, size, vertical, keyPhrase: key, exit, ink }) => {
  const keyMix = tween(t, [key.at, key.at + 18], [0, 1], EASE.house);
  const nKey = words.length - key.from;
  const glintPos = tween(t, [key.at, key.at + 16], [-1, nKey], EASE.inOut);
  const glintOn = t >= key.at && t <= key.at + 16;
  return (
    <div style={{ position: 'absolute', left: x, top: y, ...typeStyle('display', vertical, { tone: 'paper', size }), color: ink.base, whiteSpace: 'nowrap' }}>
      {lines.map((ln, li) => (
        <div key={li}>
          {ln.map((i, k) => {
            const r = reveal(t, at[i], { config: SPRING.text, rise: 100, fade: 0.55, exit: { at: exit.at + i * exit.stagger, dur: exit.dur } });
            const isKey = i >= key.from;
            let col = isKey ? mixHex(ink.base, ink.key, keyMix) : ink.base;
            if (isKey && glintOn) {
              const gl = Math.exp(-(((i - key.from - glintPos) / 0.7) ** 2));
              if (gl > 0.02) col = mixColor(col, ink.glint, 0.6 * gl);
            }
            return (
              <span key={k} style={maskBox(k === ln.length - 1 ? 0 : 0.24)}>
                <span style={{ ...revealStyle(r, undefined, true), color: col }}>{words[i]}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Thesis: React.FC<ThesisProps> = (p) => {
  const { t, at, exit, words, cl } = p;
  if (t < at[0] - 1) return null;
  if (t > exit.at + exit.stagger * words.length + exit.dur + 1) return null;
  if (!cl) return <Words {...p} ink={INKS.lit} />;
  // all of it in the dark: the night's type alone
  if (cl.edge < 0) return <Words {...p} ink={INKS.night} />;
  // the two settings, cut along the room's half-light contour (screen px: these layers fill the frame)
  const lc = { x: cl.x, y: cl.y, ri: cl.ri, ro: cl.ro, mid: cl.mid, a: cl.a };
  const e0 = cl.edge - EDGE;
  const e1 = cl.edge + EDGE;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, ...fadeMask(lc, false, e0, e1) }}>
        <Words {...p} ink={INKS.lit} />
      </div>
      <div style={{ position: 'absolute', inset: 0, ...fadeMask(lc, true, e0, e1) }}>
        <Words {...p} ink={INKS.night} />
      </div>
    </>
  );
};
