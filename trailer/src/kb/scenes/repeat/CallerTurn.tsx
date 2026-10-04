/**
 * b02–b04 · THE CALLER'S TURN (near plane): `● CALLER` (label role, slate) rises on the pickup, the
 * caller's line rises phrase by phrase on the real voice (the Captions fork, caption role, slate), and under it
 * the line's WAVEFORM (slate, the take's real envelope) draws out from the centre as the caller starts.
 * The tag, the caption and the waveform are ONE unit: on the desk voice's first word the caption leaves up
 * and the tag and the line leave up with it through the same reveal exit (captionsOut; the tag leads by 2 f) —
 * nothing of the caller is left on screen during the desk's answer; the next call's tag rises on its pickup.
 * b04's dead line (`dead`, the third call only): after the answer to a question she didn't ask, the caller's
 * line re-opens alone — flat dots, no tag, no caption, the only time the waveform shows without speech — for
 * the half beat of dead air, and draws back in on the first roll of b05.
 * Each caller's turn sits a little further in over the in-person card (desk.ts callers).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { captionFont, maskBox, typeStyle } from '../../../lib/type';
import { Captions, captionsOut } from '../../components/Captions';
import { KB_INK } from '../../theme';
import { REPEAT_LOCAL as R, type VoiceId } from '../../timing';
import { VOICE } from '../../voice.generated';
import type { CallerSlot } from './desk';
import { LineWave } from './LineWave';

export const CALLER_INK = KB_INK.caller.paper;

/** the caller's line as one caption per spoken phrase ("Hi!" · "Are you open on Saturdays?"): each rises on its own
 *  first word and the first gives way to the next — a two-sentence line never shows the second before it is said
 *  (whole-film pass; the house unit, as film 1's "Hi!" · "Could I come in on Wednesday afternoon?") */
function phraseCaptions(voice: VoiceId) {
  let word = 0;
  return VOICE.lines[voice].phrases.map((p) => {
    const c = { text: p.text, word };
    word += p.text.split(' ').length;
    return c;
  });
}

/** the tag's / the line's travel out of their masks (% of their own height; the caption words travel 80) */
const RISE = 90;
/** the unit leaves top-down: the tag leads its caption out by this many frames — a caption word's mask reaches
 *  into the tag's line, so a word rising out of it would otherwise cross the tag (16:9 "Are", 9:16 "on") */
const TAG_LEAD = 2;

export const CallerTurn: React.FC<{
  t: number;
  k: number;
  slot: CallerSlot;
  /** b04's dead line [from, to]: the line re-opens flat, alone, and draws back in (the third call) */
  dead?: readonly [number, number];
}> = ({ t, k, slot, dead }) => {
  const L = useLayout();
  const voice = R.callerIds[k] as VoiceId;
  const at = R.callers[k];
  const pickup = R.pickups[k];
  const desk = R.desk[k];
  const captions = phraseCaptions(voice);
  // the caption's exit (it holds until the desk's first word): the tag and the line leave with it
  const out = captionsOut({ lineAt: at, voice, captions, holdUntil: desk, echoY: null });
  const unitOn = t >= pickup - 2 && t <= out.at + out.dur + 1;
  const deadOn = !!dead && t >= dead[0] - 3 && t <= dead[1] + 10;
  if (!unitOn && !deadOn) return null;
  const center = slot.align === 'center';
  const wave = {
    t,
    at,
    voice,
    cx: slot.waveX,
    cy: slot.waveY,
    half: slot.waveHalf,
    barW: L.pick(4, 4),
    pitch: L.pick(10, 10),
    maxH: L.pick(22, 22),
    color: CALLER_INK.tag,
    seed: `kb-caller-${k}`,
  };
  if (!unitOn) {
    // the dead line, alone (no tag: the half beat is the line's): the take is over (its envelope reads 0), so
    // it lies flat — drawn out from the centre with the hiss, drawn back in (the line goes dead) on the first roll.
    // A little shorter than the speaking line: by now the push has brought the card's edge under its left end
    // (16:9), and a flat rule alone must not touch it.
    const open = springUnit(t - (dead![0] - 2), SPRING.site);
    const close = tween(t, [dead![1], dead![1] + 9], [0, 1], EASE.in3);
    return <LineWave {...wave} half={Math.round(slot.waveHalf * 0.8)} open={open} close={close} />;
  }
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const fs = label.fontSize as number;
  const dot = Math.round(fs * 0.3);
  /** ● CALLER in its mask, at a reveal state */
  const tag = (r: ReturnType<typeof reveal>) => (
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
        <span style={{ ...revealStyle(r, undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
          <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: CALLER_INK.tag, transform: 'translateY(-0.04em)' }} />
          CALLER
        </span>
      </span>
    </div>
  );
  /** the line leaving up out of its mask: reveal()'s own exit (EASE.in3 up, fading over its second part) */
  const lift = (o: { at: number; dur: number }) => {
    const q = tween(t, [o.at, o.at + o.dur], [0, 1], EASE.in3);
    return { y: -q * RISE, opacity: 1 - smooth(0.35, 1, q) };
  };
  const open = springUnit(t - (at - 2), SPRING.site);
  return (
    <>
      {tag(reveal(t, pickup - 1, { config: SPRING.caption, rise: RISE, exit: { at: out.at - TAG_LEAD, dur: out.dur } }))}
      <Captions
        t={t}
        lineAt={at}
        voice={voice}
        captions={captions}
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
      <LineWave {...wave} open={open} close={0} lift={lift(out)} />
    </>
  );
};
