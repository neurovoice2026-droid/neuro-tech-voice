/**
 * b02–b04 · THE CALLER'S TURN (near plane): `● CALLER` (label role, slate) rises on the pickup, the
 * caller's line rises word by word on the real voice (the Captions fork, caption role, slate), and under it
 * the line's WAVEFORM (slate, the take's real envelope) draws out from the centre as the caller starts.
 * On the desk voice's first word the caption leaves up; the label and the line stay open (flat dots: the
 * caller listening) until the call is over — the slip lands — and draw back in. On the third call the line
 * stays open, flat, for the half beat of dead air after the answer to a question she didn't ask (b04).
 * Each caller's turn sits a little further in over the in-person card (desk.ts callers).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { useLayout } from '../../../lib/layout';
import { EASE, SPRING, springUnit, tween } from '../../../lib/motion';
import { captionFont, maskBox, typeStyle } from '../../../lib/type';
import { Captions } from '../../components/Captions';
import { KB_INK } from '../../theme';
import { REPEAT_LOCAL as R, type VoiceId } from '../../timing';
import { VOICE } from '../../voice.generated';
import type { CallerSlot } from './desk';
import { LineWave } from './LineWave';

export const CALLER_INK = KB_INK.caller.paper;

export const CallerTurn: React.FC<{
  t: number;
  k: number;
  slot: CallerSlot;
  /** the call ends (the label and the line draw back in) */
  hangup: number;
}> = ({ t, k, slot, hangup }) => {
  const L = useLayout();
  const voice = R.callerIds[k] as VoiceId;
  const at = R.callers[k];
  const pickup = R.pickups[k];
  const desk = R.desk[k];
  if (t < pickup - 2 || t > hangup + 12) return null;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const fs = label.fontSize as number;
  const dot = Math.round(fs * 0.3);
  const lab = reveal(t, pickup - 1, { config: SPRING.caption, rise: 90, exit: { at: hangup, dur: 6 } });
  const open = springUnit(t - (at - 2), SPRING.site);
  const close = tween(t, [hangup, hangup + 9], [0, 1], EASE.in3);
  const center = slot.align === 'center';
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: slot.x,
          top: slot.labelY,
          ...label,
          color: CALLER_INK.tag,
          whiteSpace: 'nowrap',
          transform: center ? 'translateX(-50%)' : undefined,
          paddingLeft: center ? '0.14em' : undefined,
        }}
      >
        <span style={maskBox(0)}>
          <span style={{ ...revealStyle(lab, undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
            <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: CALLER_INK.tag, transform: 'translateY(-0.04em)' }} />
            CALLER
          </span>
        </span>
      </div>
      <Captions
        t={t}
        lineAt={at}
        voice={voice}
        captions={[{ text: VOICE.lines[voice].say, word: 0 }]}
        x={slot.x}
        y={slot.rowY}
        maxWidth={slot.maxWidth}
        font={captionFont(L.vertical, 'paper')}
        color={CALLER_INK.text}
        tone="paper"
        holdUntil={desk}
        echoY={null}
        align={slot.align}
      />
      <LineWave
        t={t}
        at={at}
        voice={voice}
        cx={slot.waveX}
        cy={slot.waveY}
        half={slot.waveHalf}
        barW={L.pick(4, 4)}
        pitch={L.pick(10, 10)}
        maxH={L.pick(22, 22)}
        color={CALLER_INK.tag}
        open={open}
        close={close}
        seed={`kb-caller-${k}`}
      />
    </>
  );
};
