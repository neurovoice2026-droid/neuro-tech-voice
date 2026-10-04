/**
 * b11 · THE ANSWER (SCRIPT.md b11) — her turn on the call, in the question's place:
 *
 *   ● AVA + the timer (running again) rise as time resumes
 *   THE WORD RE-SET (call/Reset.tsx), ONE move: the tokens she doesn't say (· 9:00–14:00 ·) have left the page up
 *   through their masks; on "We" the kept words (Saturday · Sunday · closed) fly from the page TOGETHER to their slots
 *   in her sentence and dive into the slots' masks (nothing waits on screen); on her onsets (− 2 f) every word rises
 *   into its slot, a kept word whole ("Sundays," / "closed."). The result IS her caption: "We are! Saturday from nine
 *   till two. Sundays, we're closed." with "nine till two" keyed in sunday on "nine" — complete ≥ a beat before the
 *   record.
 *   THE RECORD: on the 8th after her answer the strip folds into the white record row (the kit's RecordRow:
 *   TRANSCRIPT, the greeting with its disclosure, "Answered from your documents" + the Opening hours chip, a white
 *   check drawn in the sunday disc), unfolding down from its top edge over the sentence as it leaves up (they overlap:
 *   the frame is never empty).
 */
import React from 'react';
import { EASE, tween } from '../../../lib/motion';
import { measureText, RecordRow, typo, useKitFaces } from '../../kit';
import { Reset } from './Reset';
import { TYPE } from '../../../theme';
import { HOME, MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C } from '../../timing';
import { VOICE } from '../../voice.generated';
import { sweptTokens, type PageGeo } from './Page';
import { Tag } from './Strip';
import type { CallStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
export const ANSWER = typo(VOICE.lines['kb2-call-2'].say);

export const AnswerTurn: React.FC<{ t: number; S: CallStage; g: PageGeo; ink: string }> = ({ t, S, g, ink }) => {
  useKitFaces();
  if (t < C.resume) return null;
  const T = S.strip.c;
  const tokens = sweptTokens(g);
  // the sentence leaves up through its block's mask AS the record unfolds down over it (a block exit: the words are at
  // rest by then; ≥ 2 f of overlap — never a frame with neither)
  const out = tween(t, [C.sentenceOut[0], C.sentenceOut[1]], [0, 1], EASE.in3);
  const lh = S.strip.caption * 1.18;
  // the fold: a clip opening from the record's top edge down past its foot (frame-relative inset)
  const foldU = tween(t, [C.record, C.record + 10], [0, 1], EASE.out3);
  const foldTop = S.record.y - 20;
  const foldBottom = S.record.y + 420;
  const fold = (foldTop + (foldBottom - foldTop) * foldU) / S.H;
  // the block's own box (three lines) and its mask pads: the words leave through the block's top edge, never into the tag
  const blockTop = T.y - 1.5 * lh - 0.16 * S.strip.caption;
  const clip = { top: blockTop, h: 3 * lh + 0.4 * S.strip.caption, left: S.strip.align === 'center' ? T.x - T.maxWidth / 2 - 60 : T.x - 30, w: T.maxWidth + 120 };
  // the measure that sets her sentence in three lines with the key phrase whole: "We are! Saturday from" /
  // "nine till two. Sundays," / "we're closed." (the re-set wraps greedily at maxWidth)
  const spec = { size: S.strip.caption, weight: TYPE.caption.weight, tracking: -0.02 };
  const measure = Math.max(measureText('We are! Saturday from', spec), measureText('nine till two. Sundays,', spec)) + 2;
  const target = { text: ANSWER, x: T.x, y: T.y, size: S.strip.caption, maxWidth: measure, align: S.strip.align, color: HOME.ink, keys: [{ text: 'nine till two.', color: SUNDAY, at: C.key }] };
  return (
    <>
      {/* (9:16: the kept words drop out of the page through the tag's row — it rises once they have landed) */}
      <Tag t={t} x={T.x} y={T.tag} align={S.strip.align} name="AVA" ink={SUNDAY} at={S.vertical ? C.fly[1] : C.call2 - 1} exitAt={C.record - 9} timer />
      {out < 1 && t >= C.fly[0] - 2 ? (
        out > 0 ? (
          <div style={{ position: 'absolute', left: clip.left, top: clip.top, width: clip.w, height: clip.h, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: -clip.left, top: -clip.top, width: S.W, height: S.H, opacity: 1 - EASE.in2(out), transform: `translateY(${(-out * clip.h).toFixed(3)}px)` }}>
              <Reset t={t} tokens={tokens} sourceSize={g.spec.size} target={target} words={C.reset} fly={C.fly} flights={S.flights} />
            </div>
          </div>
        ) : (
          <Reset t={t} tokens={tokens} sourceSize={g.spec.size} target={target} words={C.reset} fly={C.fly} flights={S.flights} />
        )
      ) : null}
      {/* the record unfolds from its top edge as it lands (a fold, not a fade) */}
      {t >= C.record - 0.5 ? (
        <div style={{ position: 'absolute', inset: 0, clipPath: fold < 1 ? `inset(0 0 ${((1 - fold) * 100).toFixed(3)}% 0)` : undefined }}>
          <RecordRow t={t} x={S.record.x} y={S.record.y} w={S.record.w} at={C.record} checkAt={C.check} accent={SUNDAY} size={S.record.size} ink={ink} />
        </div>
      ) : null}
    </>
  );
};
