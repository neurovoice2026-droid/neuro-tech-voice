/**
 * b01–b05 · THE MESSAGE PAD and its PILE. A white slip (`● FRONT DESK`, the desk's answer in the title
 * role, a ruled line under each row) on a small pad of blank sheets. The desk's answer rises on it word by
 * word on Leo's real word onsets; on "two." it drops onto the pile (desk.ts slipPose: held a hand's breadth
 * up while written, a 3-frame fall, the landing squash, its shadow tightening; the paper beneath takes the
 * weight). The second and third answers come on fresh slips placed over the pile, already printed — the SAME
 * words, arriving whole (never a blank card over the last answer); each drops on its "two.", the third alone
 * lands crooked. Through the rest of the day a slip drops on every 8th,
 * already written, and the pile grows into a neat column: its height is the count (no number is shown).
 *
 * Every slip is positioned by its transform on its own small layer (sub-pixel glide, no blur).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { SPRING } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { APP, meshElevation } from '../../kit';
import { GRAPHITE } from '../../theme';
import { REPEAT_LOCAL as R } from '../../timing';
import { ANSWER_LINES, answerWordAt, pileJolt, SLIP_COUNT, slipPose, slipZ, type DeskLayout } from './desk';

/** a hairline in the paper (the pad's ruling) */
const RULE = 'rgba(20, 10, 36, 0.075)';

/** One slip's face: the tag, the two ruled rows, the words (each rising out of its mask at `wordAt(i)`). */
const SlipFace: React.FC<{ g: DeskLayout; tagAt: number; wordAt: (i: number) => number; t: number }> = ({ g, tagAt, wordAt, t }) => {
  const L = useLayout();
  const s = g.slip;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const title = typeStyle('title', L.vertical, { tone: 'paper', size: s.size });
  const rowH = s.size * 1.18;
  const rowsTop = s.padTop + labelSize * 1.2 + L.pick(22, 20);
  const dot = Math.round(labelSize * 0.3);
  const tag = reveal(t, tagAt, { config: SPRING.caption, rise: 80 });
  let n = 0;
  return (
    <>
      <div style={{ position: 'absolute', left: s.padX, top: s.padTop, ...label, color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
        <span style={maskBox(0)}>
          <span style={{ ...revealStyle(tag, undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
            <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
            FRONT DESK
          </span>
        </span>
      </div>
      {/* the pad's ruling: one hairline under each row (the words sit on them) */}
      {[0, 1].map((r) => (
        <div key={r} style={{ position: 'absolute', left: s.padX, right: s.padX, top: rowsTop + (r + 1) * rowH - s.size * 0.12, height: 1.25, background: RULE }} />
      ))}
      <div style={{ position: 'absolute', left: s.padX, top: rowsTop, ...title, lineHeight: `${rowH}px`, color: APP.foreground }}>
        {ANSWER_LINES.map((ws, li) => (
          <div key={li} style={{ whiteSpace: 'nowrap', height: rowH }}>
            {ws.map((w, j) => {
              const i = n++;
              // "two." arrives as the slip drops: a shorter, quicker rise, so it is in by the slap
              const last = i === 4;
              const r = reveal(t, wordAt(i), last ? { config: SPRING.pop, rise: 46 } : { config: SPRING.caption, rise: 80 });
              return (
                <span key={j} style={maskBox(j === ws.length - 1 ? 0 : 0.24)}>
                  <span style={revealStyle(r, undefined, true)}>{w}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};

export const Slips: React.FC<{ t: number; g: DeskLayout; ink: string }> = ({ t, g, ink }) => {
  const L = useLayout();
  const v = L.vertical;
  const s = g.slip;
  const radius = L.pick(12, 11);
  const slip = (k: number) => {
    const p = slipPose(k, t, v);
    if (!p.on) return null;
    const jolt = pileJolt(t, k);
    // the first answer is written on the pad's own top sheet, on the desk's real word onsets (a frame ahead of
    // the voice, as captions lead). Answers 2 and 3 are the same answer again: their fresh slips arrive already
    // printed (tag and words), so no blank card ever hangs over the last "nine till two." — like the rolls' slips
    const answer = k === 0;
    const desk = answer ? R.desk[k] : -1e6;
    const tf = `translate(${(s.x + p.dx).toFixed(3)}px, ${(s.y + p.dy + jolt).toFixed(3)}px) rotate(${p.rot.toFixed(4)}deg) scaleY(${p.squash.toFixed(5)})`;
    return (
      <div
        key={k}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: s.w,
          height: s.h,
          borderRadius: radius,
          background: '#ffffff',
          boxShadow: meshElevation(p.lift, ink, 0.95),
          zIndex: slipZ(k),
          transformOrigin: '50% 100%',
          ...subpixel(tf, true),
        }}
      >
        <SlipFace g={g} t={t} tagAt={answer ? desk - 4 : -1e6} wordAt={(i) => desk + answerWordAt(i) - 1} />
      </div>
    );
  };
  // the pad under the first sheet: two blank sheets, their edges showing (resting on the desk)
  const sheet = (i: number) => (
    <div
      key={`pad${i}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: s.w,
        height: s.h,
        borderRadius: radius,
        background: i === 1 ? '#f4f3f7' : '#fafafc',
        boxShadow: meshElevation(i === 1 ? 0.3 : 0.12, ink, 0.9),
        zIndex: 15 - i,
        ...subpixel(`translate(${(s.x + (i === 1 ? -1.5 : 1)).toFixed(3)}px, ${(s.y + (i + 1) * L.pick(5, 5) + pileJolt(t, -1) * 0.6).toFixed(3)}px) rotate(${(i === 1 ? 0.35 : -0.2).toFixed(3)}deg)`, true),
      }}
    />
  );
  return (
    <>
      {sheet(1)}
      {sheet(0)}
      {Array.from({ length: SLIP_COUNT }, (_, k) => slip(k))}
    </>
  );
};
