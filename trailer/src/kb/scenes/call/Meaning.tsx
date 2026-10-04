/**
 * b10's STOP-TIME TYPE and the MEANING LINKS (SCRIPT.md b10):
 *
 *   <StopLabel>   BETWEEN QUESTION AND ANSWER (label role, ink), rising on the freeze, leaving on the resume. Ava's orb
 *                 shrinks into its DOT (Call.tsx: the orb's dock pose is this lockup's dot) — the house ● tag idiom,
 *                 with her living light as the dot: the stop-time is hers
 *   <Phrasings>   the day's three earlier questions return as slate lines (the title role 64 / 56, slate at 70 %), one
 *                 at a time through ONE hard-masked slot under the page: each rolls up into it as the link before it
 *                 lands, sends its hairline, and rolls up out of it as the next one rolls in — the two move in lockstep
 *                 a full mask's height apart, so they never share a pixel; the last stays until the resume
 *   <Links>       one hairline per phrasing to the SAME two swept lines (the kit's MeaningLink: a gentle arc drawn on
 *                 EASE.draw, a dot at each end): the hero link from "weekend" carries the midpoint tag MATCHED ON
 *                 MEANING; the three echoes are finer and quieter. Four phrasings, one written answer. An echo retracts
 *                 into the page (its end) as its phrasing rolls away; on the resume every link has retracted BEFORE
 *                 any text leaves (CALL_LOCAL.retract) — no hairline ever points at nothing
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, SPRING } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { labelWidth, measureText, MeaningLink, useKitFaces } from '../../kit';
import { HOME, MOMENT_LIGHTS } from '../../palettes';
import { KB_INK } from '../../theme';
import { CALL_LOCAL as C } from '../../timing';
import { ease, type CallStage, type XY } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const SLATE = KB_INK.caller.paper.text;
export const STOP_LABEL = 'BETWEEN QUESTION AND ANSWER';
export const PHRASINGS = ['Are you open on Saturdays?', 'Can I pop in on Saturday?', 'What are your weekend hours?'] as const;

/** the lockup: the dot (the orb's dock place) and the label's text left edge */
export function stopLockup(S: CallStage, vertical: boolean) {
  const size = typeStyle('label', vertical).fontSize as number;
  const d = S.orb.dot.d;
  const gap = size * 0.55;
  if (S.label.align === 'left') return { dot: { x: S.label.x - gap - d / 2, y: S.label.y, d }, textX: S.label.x, size };
  const w = d + gap + labelWidth(STOP_LABEL, size);
  const left = S.label.x - w / 2;
  return { dot: { x: left + d / 2, y: S.label.y, d }, textX: left + d + gap, size };
}

export const StopLabel: React.FC<{ t: number; S: CallStage }> = ({ t, S }) => {
  const L = useLayout();
  useKitFaces();
  if (t < C.freeze - 1 || t > C.resume + 14) return null;
  const lk = stopLockup(S, L.vertical);
  const st = typeStyle('label', L.vertical, { tone: 'paper' });
  const r = reveal(t, C.freeze + 4, { config: SPRING.caption, rise: 100, fade: 0.5, exit: { at: C.resume, dur: 8 } });
  return (
    <div style={{ position: 'absolute', left: lk.textX, top: S.label.y - lk.size * 0.6, ...st, lineHeight: 1.2, color: HOME.ink, whiteSpace: 'nowrap' }}>
      <span style={maskBox(0)}>
        <span style={revealStyle(r, undefined, t - C.freeze < 24 || t > C.resume - 1)}>{STOP_LABEL}</span>
      </span>
    </div>
  );
};

/** a phrasing's text spec (title role, smaller) */
const qSpec = (size: number) => ({ size, weight: TYPE.title.weight, tracking: -0.02 });

/** each phrasing's box (frame px) — all in the one slot */
export function phrasingBoxes(S: CallStage) {
  const Q = S.questions;
  return PHRASINGS.map((q) => {
    const w = measureText(q, qSpec(Q.size));
    const x = Q.align === 'center' ? Q.x - w / 2 : Q.x;
    return { x, y: Q.y, w, h: Q.size * 1.18, cy: Q.y + Q.size * 0.62 };
  });
}

/** frames a swap through the slot takes (the outgoing phrasing up out, the incoming up in, in lockstep) */
const ROLL = 6;
/** when phrasing i rolls out of the slot: as the next one rolls in; the last at the resume (after the links retract) */
export const phrasingOut = (i: number) => (i < PHRASINGS.length - 1 ? C.questions[i + 1] : C.resume);

export const Phrasings: React.FC<{ t: number; S: CallStage }> = ({ t, S }) => {
  const L = useLayout();
  useKitFaces();
  if (t < C.questions[0] || t > C.resume + ROLL + 1) return null;
  const Q = S.questions;
  const boxes = phrasingBoxes(S);
  const st = typeStyle('title', L.vertical, { tone: 'paper', size: Q.size });
  // the slot's hard mask: one line box with room for ascenders / descenders; the travel is the whole mask
  const pad = Q.size * 0.22;
  const maskH = Q.size * 1.18 + 2 * pad;
  const maxW = Math.max(...boxes.map((b) => b.w));
  const left = (Q.align === 'center' ? Q.x - maxW / 2 : Q.x) - 24;
  return (
    <div style={{ position: 'absolute', left, top: Q.y - pad, width: maxW + 48, height: maskH, overflow: 'hidden' }}>
      {PHRASINGS.map((q, i) => {
        const inU = ease(t, C.questions[i], C.questions[i] + ROLL, EASE.inOut);
        const outU = ease(t, phrasingOut(i), phrasingOut(i) + ROLL, EASE.inOut);
        if (inU <= 0 || outU >= 1) return null;
        const y = (1 - inU) * maskH - outU * maskH;
        const moving = (inU > 0 && inU < 1) || (outU > 0 && outU < 1);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: boxes[i].x - left,
              top: pad,
              ...st,
              letterSpacing: '-0.02em',
              lineHeight: 1.18,
              color: SLATE,
              opacity: 0.72,
              whiteSpace: 'nowrap',
              ...subpixel(`translateY(${y.toFixed(3)}px)`, moving),
            }}
          >
            {q}
          </div>
        );
      })}
    </div>
  );
};

/** the MATCHED ON MEANING chip's width (the kit's MeaningLink tag: label role, .7em padding each side) */
const chipW = (vertical: boolean) => {
  const size = typeStyle('label', vertical).fontSize as number;
  return labelWidth('MATCHED ON MEANING', size) + 1.4 * size;
};

/**
 * The hairlines all land on ONE point: the swept lines' LEFT edge (the page's left padding, where no text is). The hero
 * link (16:9) runs from the end of "weekend" down-right into it, its tag between the frozen question and the page;
 * (9:16) from the start of "this weekend" down the left margin into it (the page fills the width: a link from the right
 * would cross the weekday line), its tag in the gap between the question's waveform and the page's top. Each echo runs
 * from its phrasing in the slot (16:9 its top, 9:16 its left end) to the same point.
 */
export const Links: React.FC<{ t: number; S: CallStage; hero: XY; target: XY; page: { x: number; y: number } }> = ({ t, S, hero, target, page }) => {
  if (t < C.linkStart[0] || t > C.retract[1] + 1) return null;
  const boxes = phrasingBoxes(S);
  const vertical = S.vertical;
  const rd = C.retract[1] - C.retract[0];
  const cw = chipW(vertical);
  // 16:9: the chip's right edge ~58 px short of the page, a phrasing's height under the question's end (it covers the
  // line's middle); 9:16: its left edge at the frame's margin + 24, centred in the gap over the page's top
  const tagAt = vertical ? { x: 88 + cw / 2, y: page.y - 49 } : { x: page.x - 58 - cw / 2, y: hero.y + 95 };
  const echo = 'rgba(14, 116, 144, 0.55)';
  return (
    <>
      <MeaningLink
        t={t}
        from={hero}
        to={target}
        at={C.linkStart[0]}
        dur={C.links[0] - C.linkStart[0]}
        bend={vertical ? 0.38 : 0.14}
        tagPos={vertical ? 0.2 : 0.42}
        tagAt={tagAt}
        side={vertical ? 'above' : 'below'}
        color={SUNDAY}
        width={2.2}
        tag="MATCHED ON MEANING"
        tagColor={SUNDAY}
        exitAt={C.retract[0]}
        exitDur={rd}
      />
      {boxes.map((b, i) => {
        const k = i + 1;
        // from its phrasing in the slot (16:9 its top, 9:16 its left end, up the left margin); it retracts into the
        // page as its phrasing rolls away
        const from = vertical ? { x: b.x - 12, y: b.cy } : { x: b.x + b.w / 2, y: b.y - 10 };
        return (
          <MeaningLink
            key={i}
            t={t}
            from={from}
            to={target}
            at={C.linkStart[k]}
            dur={C.links[k] - C.linkStart[k]}
            bend={vertical ? 0.1 : 0.15}
            side={vertical ? 'above' : 'below'}
            color={echo}
            width={1.5}
            exitAt={i < PHRASINGS.length - 1 ? phrasingOut(i) : C.retract[0]}
            exitDur={rd}
          />
        );
      })}
    </>
  );
};
