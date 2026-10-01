/**
 * AVA'S SIGN-OFF — "See you then!" (heard = read).
 *
 * call-5 ends with "See you then!", spoken after its last aligned word and
 * across the call → result cut (an L-cut, global ≈ 877–894). It has no aligned
 * words, so it is captioned on the voice itself: its first vowel is
 * CALL_LOCAL.signOff (read from the line's loudness); "See" rises on its
 * sibilant, "you" / "then!" on the next two dips of the envelope (fixed
 * offsets if the take has none).
 *
 * It sits in the row UNDER the booked mark (row C, set exactly as the call
 * sets Ava's captions: TYPE.caption on the dark, in her paper ink), so the
 * line reads on as "Wednesday at 3 PM. /
 * See you then!" while the orb dives into the mark above it and the mark
 * lifts away into its card — it never crosses either. It leaves with the
 * call's designed caption exit (CallCaptions), before the card is thrown.
 *
 * Drawn by the result (the top layer from its pre-roll), so it carries over
 * the cut untouched; from the cut on it sits UNDER the world plane, so the
 * calendar (9:16: rising from below onto its row) passes in front of it.
 * Result-local frames.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MARK, TRANSCRIPT } from '../../lib/handoff';
import { useLayout } from '../../lib/layout';
import { captionFont } from '../../lib/type';
import { VOICE_INK } from '../../theme';
import { CALL, CALL_LOCAL, RESULT, SCENES } from '../../timing';
import { VOICE } from '../../voice.generated';
import { CallCaptions, type CallCaption } from '../call/CallCaptions';

const LINE = CALL.lines[CALL.lines.length - 1];
/** the line's start, result-local */
const LINE_AT = SCENES.call.from + LINE.at - SCENES.result.from;
/** the sign-off's word onsets, line-local */
const WORDS: readonly number[] = (() => {
  const env = VOICE.lines[LINE.voice].env as readonly number[];
  const s = CALL_LOCAL.signOff - LINE.at; // its first vowel
  // the next two dips (a frame lower than both neighbours) after the vowel's peak: "you", "then!"
  const dips: number[] = [];
  for (let f = s + 2; f < env.length - 1 && dips.length < 2; f++) if (env[f] < env[f - 1] && env[f] <= env[f + 1]) dips.push(f);
  const you = dips[0] ?? s + 4;
  const then = dips[1] !== undefined && dips[1] - you >= 3 ? dips[1] : you + 5;
  return [s - 3, you, then];
})();
const CAPTION: readonly CallCaption[] = [{ text: 'See you then!', word: 0, at: WORDS }];
/** gone before the card is thrown (RESULT.fly) — a beat-and-a-bit after "then!" */
const HOLD_UNTIL = RESULT.fly + 7;
/** mounted only while it can be on screen */
const FIRST = LINE_AT + WORDS[0] - 4;

export const SignOff: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  if (t < FIRST || t > HOLD_UNTIL + 2) return null;
  const T = TRANSCRIPT(L);
  const M = MARK(L);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <CallCaptions
        id="result-signoff"
        t={t}
        lineAt={LINE_AT}
        voice={LINE.voice}
        captions={CAPTION}
        x={L.cx}
        y={M.y + T.fontSize * T.lineHeight}
        maxWidth={T.maxWidth}
        font={captionFont(L.vertical, 'night')}
        color={VOICE_INK.ava.night.text}
        holdUntil={HOLD_UNTIL}
      />
    </AbsoluteFill>
  );
};
