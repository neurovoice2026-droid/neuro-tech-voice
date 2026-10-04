/**
 * b15–b16 · THE PAPER ON THE DESK.
 *
 *   <Pad>        the message pad, EMPTY: b01's pad (a blank, ruled top sheet on two blank sheets) — no slip is
 *                written this morning
 *   <OldStack>   the old slip stack at the desk's edge: yesterday's slips, squared into a pile, every one still
 *                reading "Yes, Saturdays, / nine till two." (now out of date). On "do." it lifts and the slips
 *                glide off one after another toward the teal dot (16:9: up past the colon and out; 9:16: out to
 *                the right) — EASE.inOut, a sub-pixel layer each (stage.ts stackSlip)
 *
 * Desk plane. The slips are b01's slips (white, the pad's ruling, ● FRONT DESK, the answer in the title role).
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { typeStyle } from '../../../lib/type';
import { APP, meshElevation } from '../../kit';
import { GRAPHITE } from '../../theme';
import { MATTERS_LOCAL as M } from '../../timing';
import { NIGHT_RGB } from './Card';
import { OLD_ANSWER, stackSlip, type MattersLayout } from './stage';

/** a hairline in the paper (the pad's ruling) */
const RULE = 'rgba(20, 10, 36, 0.075)';

/** One slip's face: the tag and the two ruled rows (written, or blank for the pad). */
const Face: React.FC<{ g: MattersLayout; written: boolean }> = ({ g, written }) => {
  const L = useLayout();
  const s = g.stack;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const title = typeStyle('title', L.vertical, { tone: 'paper', size: s.size });
  const rowH = s.size * 1.18;
  const rowsTop = s.padTop + labelSize * 1.2 + L.pick(22, 20);
  const dot = Math.round(labelSize * 0.3);
  return (
    <>
      {written ? (
        <div style={{ position: 'absolute', left: s.padX, top: s.padTop, display: 'flex', alignItems: 'center', gap: '0.5em', ...label, color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
          FRONT DESK
        </div>
      ) : null}
      {[0, 1].map((r) => (
        <div key={r} style={{ position: 'absolute', left: s.padX, right: s.padX, top: rowsTop + (r + 1) * rowH - s.size * 0.12, height: 1.25, background: RULE }} />
      ))}
      {written ? (
        <div style={{ position: 'absolute', left: s.padX, top: rowsTop, ...title, lineHeight: `${rowH}px`, color: APP.foreground }}>
          {OLD_ANSWER.map((ws, li) => (
            <div key={li} style={{ whiteSpace: 'nowrap', height: rowH }}>
              {ws.join(' ')}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};

const Shade: React.FC<{ shade: number }> = ({ shade }) =>
  shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: `rgba(${NIGHT_RGB}, ${shade.toFixed(4)})` }} /> : null;

export const Pad: React.FC<{ g: MattersLayout; ink: string; shade: number }> = ({ g, ink, shade }) => {
  const L = useLayout();
  const p = g.pad;
  const radius = L.pick(12, 11);
  const sheet = (i: number) => (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: p.w,
        height: p.h,
        borderRadius: radius,
        background: i === 0 ? '#ffffff' : i === 1 ? '#fafafc' : '#f4f3f7',
        boxShadow: meshElevation(i === 0 ? 0.35 : i === 1 ? 0.12 : 0.3, ink, 0.95 * (1 - shade)),
        ...subpixel(`translate(${(p.x + [0, 1, -1.5][i]).toFixed(3)}px, ${(p.y + [0, 5, 10][i]).toFixed(3)}px) rotate(${[-0.3, -0.2, 0.35][i]}deg)`, true),
      }}
    >
      {i === 0 ? <Face g={{ ...g, stack: { ...g.stack, w: p.w, h: p.h } }} written={false} /> : null}
      <Shade shade={shade} />
    </div>
  );
  return (
    <>
      {sheet(2)}
      {sheet(1)}
      {sheet(0)}
    </>
  );
};

export const OldStack: React.FC<{ t: number; g: MattersLayout; ink: string; shade: number }> = ({ t, g, ink, shade }) => {
  const L = useLayout();
  const s = g.stack;
  const radius = L.pick(12, 11);
  const n = M.stack.n;
  // back to front: the bottom slip first, the top slip (0) last
  return (
    <>
      {Array.from({ length: n }, (_, j) => n - 1 - j).map((i) => {
        const p = stackSlip(i, t, g.vertical);
        // gone off the frame: nothing to draw
        if (Math.abs(p.dx) > g.W + 200 || p.dy < -(s.y + s.h + 120)) return null;
        const tf = `translate(${(s.x + p.dx).toFixed(3)}px, ${(s.y + p.dy).toFixed(3)}px) rotate(${p.rot.toFixed(4)}deg) scale(${p.scale.toFixed(5)})`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: s.w,
              height: s.h,
              borderRadius: radius,
              background: i === 0 ? '#ffffff' : '#fcfcfd',
              boxShadow: meshElevation(p.lift, ink, 0.95 * (1 - shade)),
              transformOrigin: '50% 50%',
              ...subpixel(tf, true),
            }}
          >
            <Face g={g} written />
            <Shade shade={shade} />
          </div>
        );
      })}
    </>
  );
};
