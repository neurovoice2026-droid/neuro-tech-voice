/**
 * b14 · THE NEXT CALL — the call transcript, in the call strip's own parts (scenes/call/Strip.tsx: <Tag>, <Lines>,
 * <CallWave>; the house type only, every piece rising out of its own mask and leaving up through it):
 *
 *   ● CALLER   Dana's IDENTICAL recording from the desk (b03's kb2-c2): "Quick one. / Can I pop in on Saturday?" (slate),
 *              her line's waveform under it — and on her last word the tag SAME QUESTION pops beside the label (16:9) /
 *              over it (9:16): label role on a white chip, sunday ink, the pair of b10's MATCHED ON MEANING
 *   ● AVA      her answer: "You can! / We're open Saturday / from nine till four." (9:16: two lines) — "nine till four."
 *              easing into sunday on "nine"
 *   Both turns rise LINE BY LINE, each line as a unit on its own first spoken word (Lines `wordAt`; whole-film pass:
 *   a multi-sentence turn never shows words before the voice reaches them — "four." no longer reads 2.5 s early)
 *
 * The L-cut: nothing leaves on its own — the whole picture is carried out by the crossing's push (change/stage.ts
 * crossPush), the transcript with it.
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, mixHex, SPRING, springUnit, tween } from '../../../lib/motion';
import { typeStyle } from '../../../lib/type';
import { APP, labelWidth, useKitFaces } from '../../kit';
import { HOME, MOMENT_LIGHTS } from '../../palettes';
import { KB_INK } from '../../theme';
import { CHANGE_LOCAL as K } from '../../timing';
import { CallWave, Tag, tagWidth } from '../call/Strip';
import { Lines } from '../call/Strip';
import type { ChangeStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const CALLER = KB_INK.caller.paper;
/** the answer's key phrase: spoken words 6–8 ("nine till four.") */
const KEY_WORDS = [6, 7, 8];

/** SAME QUESTION — a label-role tag on a white chip (the kit's MeaningLink tag look), rising into place */
const Chip: React.FC<{ t: number; x: number; y: number; align: 'left' | 'center'; at: number; exitAt?: number }> = ({ t, x, y, align, at, exitAt = Infinity }) => {
  const L = useLayout();
  if (t < at - 0.5) return null;
  const p = springUnit(t - at, SPRING.caption);
  const q = Number.isFinite(exitAt) ? tween(t, [exitAt, exitAt + 7], [0, 1], EASE.in3) : 0;
  if (q >= 0.999) return null;
  const o = Math.min(1, p * 2) * (1 - q);
  const dy = (1 - Math.min(1, p)) * 14 - q * 18;
  const moving = Math.abs(1 - p) > 1e-3 || q > 0;
  const tf = `translate(${x.toFixed(3)}px, ${(y + dy).toFixed(3)}px)${align === 'center' ? ' translateX(-50%)' : ''}`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: o >= 0.999 ? undefined : o, ...subpixel(tf, moving) }}>
      <div
        style={{
          ...typeStyle('label', L.vertical),
          color: SUNDAY,
          background: '#ffffff',
          padding: '0.38em 0.7em 0.34em',
          borderRadius: 999,
          boxShadow: `0 0 0 1.25px ${APP.border}, 0 6px 16px -8px rgba(30, 20, 66, 0.35)`,
          whiteSpace: 'nowrap',
        }}
      >
        SAME QUESTION
      </div>
    </div>
  );
};

export const CallTurns: React.FC<{ t: number; S: ChangeStage }> = ({ t, S }) => {
  const L = useLayout();
  useKitFaces();
  if (t < K.callerTag - 1) return null;
  const C = S.call;
  const size = C.size;
  const label = typeStyle('label', L.vertical);
  const ls = label.fontSize as number;
  // SAME QUESTION: beside ● CALLER (its row's centre) or centred over it
  const chipX = C.chip.mode === 'beside' ? C.x + tagWidth('CALLER', ls) + ls * 1.1 : C.x;
  const chipY = C.chip.mode === 'beside' ? C.chip.y - ls * 0.38 : C.chip.y;
  const wave = C.wave;
  const waveCx = C.align === 'center' ? C.x : C.x + wave.half - wave.pitch * 0.5;
  const waveOpen = springUnit(t - (K.c2 - 2), SPRING.site);
  const waveClose = tween(t, [K.waveClose, K.waveClose + 9], [0, 1], EASE.in3);
  const keyK = tween(t, [K.nine, K.nine + 18], [0, 1], EASE.house);
  return (
    <>
      <Tag t={t} x={C.x} y={C.caller.tag} align={C.align} name="CALLER" ink={CALLER.tag} at={K.callerTag} />
      <Chip t={t} x={chipX} y={chipY} align={C.align} at={K.chip} />
      <Lines t={t} lines={C.callerLines} size={size} x={C.x} tops={C.caller.lines} align={C.align} color={CALLER.text} at={K.c2Words[0] - 1} wordAt={K.c2Words} />
      <CallWave
        t={t}
        at={K.c2}
        voice="kb2-c2"
        cx={waveCx}
        cy={C.caller.wave ?? 0}
        half={wave.half}
        barW={wave.bar}
        pitch={wave.pitch}
        maxH={wave.maxH}
        color={CALLER.tag}
        open={waveOpen}
        close={waveClose}
        seed="kb-change-line"
      />
      <Tag t={t} x={C.x} y={C.ava.tag} align={C.align} name="AVA" ink={SUNDAY} at={K.avaTag} />
      <Lines
        t={t}
        lines={C.avaLines}
        size={size}
        x={C.x}
        tops={C.ava.lines}
        align={C.align}
        color={HOME.ink}
        at={K.call3Words[0] - 1}
        wordAt={K.call3Words}
        ink={(i) => (KEY_WORDS.includes(i) && keyK > 0 ? mixHex(HOME.ink, SUNDAY, keyK) : null)}
      />
    </>
  );
};

/** the chip's width (label role, tracked) for layouts outside React */
export const chipWidth = (ls: number) => labelWidth('SAME QUESTION', ls) + 1.4 * ls;
