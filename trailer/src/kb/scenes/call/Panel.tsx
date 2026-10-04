/**
 * b08's APP PANEL, handed over and set aside (SCRIPT.md b09: "the panel steps back one depth (scale .9, shade .06)
 * and slides right"). Frame 0 draws b08's own panel at its last frame — written/Panel.tsx AppPanel with
 * written/Row.tsx rows at written/stage.ts rowTop(W.end), the tab bar on Knowledge with its badge at 4, every pill
 * Ready — so the cut is the same picture. Then the whole panel rides ONE transform (scale about its centre +
 * offset, a sub-pixel layer while it moves) with a flat shade laid over it: 16:9 it slides away to the right (the
 * call takes the stage); 9:16 it settles, receded, under the call, and the Opening hours row is lifted out of it in
 * the stop-time (call/Page.tsx) before it sinks away under the frame.
 *
 * Also b08's eyebrow ● KNOWLEDGE BASE (Written.tsx's Eyebrow at rest), leaving up through its mask on the ring.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { maskBox, typeStyle } from '../../../lib/type';
import { useTabBar, type PillState } from '../../kit';
import { HOME, MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C, WRITTEN_LOCAL as W } from '../../timing';
import { AppPanel } from '../written/Panel';
import { Row } from '../written/Row';
import { BADGE, ROWS, rowTop, writtenStage, type WrittenStage } from '../written/stage';
import { panelPose, type CallStage } from './stage';

const SUNDAY_INK = MOMENT_LIGHTS.sunday.ink;
/** every row Ready at the hand-over (written/Written.tsx PILLS at their last state) */
const READY: readonly (readonly PillState[])[] = ROWS.map((r) => [{ at: -1e6, kind: 'ready', n: r.n }]);
/** the Opening hours row's index in ROWS */
export const HOURS = ROWS.findIndex((r) => r.name === 'Opening hours');

/** the b08 tab bar exactly as Written.tsx builds it */
export function useWrittenBar(S: WrittenStage) {
  return useTabBar({ x: S.panel.x, y: S.panel.y, width: S.panel.w, size: S.tabs.size, icons: S.tabs.icons, badge: BADGE, pad: (S.tabs.padR * S.tabs.size) / 14 });
}

/** the panel transform at t: a frame point → where it is drawn (to aim the lifted row from its place in the panel) */
export function panelTransform(t: number, S: CallStage) {
  const pp = panelPose(t, S);
  const P = S.from.panel;
  const cx = P.x + P.w / 2;
  const cy = P.y + P.h / 2;
  return { ...pp, cx, cy, map: (x: number, y: number) => ({ x: cx + (x - cx) * pp.scale + pp.dx, y: cy + (y - cy) * pp.scale + pp.dy }) };
}

export const HandoffPanel: React.FC<{ t: number; S: CallStage; ink: string; hideHours: boolean }> = ({ t, S, ink, hideHours }) => {
  const WS = writtenStage(S.vertical);
  const bar = useWrittenBar(WS);
  const tr = panelTransform(t, S);
  if (!tr.on) return null;
  const P = S.from.panel;
  const tf = `translate(${tr.dx.toFixed(3)}px, ${tr.dy.toFixed(3)}px) scale(${tr.scale.toFixed(5)})`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, transformOrigin: `${tr.cx}px ${tr.cy}px`, ...subpixel(tr.u > 0 ? tf : undefined, tr.moving) }}>
      <AppPanel t={W.end} S={WS} bar={bar} keys={[]} ink={ink}>
        {ROWS.map((r, i) =>
          hideHours && i === HOURS ? null : (
            <Row key={r.name} t={W.end} x={WS.list.x} y={rowTop(i, W.end, WS).y} w={WS.list.w} h={WS.row.h} layout={WS.row.layout} size={WS.row.size} kind={r.kind} name={r.name} pill={READY[i]} />
          ),
        )}
      </AppPanel>
      {tr.shade > 0.001 ? (
        <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, borderRadius: P.radius, background: `rgba(20, 10, 36, ${tr.shade.toFixed(4)})` }} />
      ) : null}
    </div>
  );
};

/** b08's eyebrow at rest, leaving up through its mask on the ring */
export const HandoffEyebrow: React.FC<{ t: number; S: CallStage }> = ({ t, S }) => {
  const L = useLayout();
  if (t > C.ring + 14) return null;
  const WS = writtenStage(S.vertical);
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const size = label.fontSize as number;
  const dot = Math.round(size * 0.34);
  const r = reveal(t, -1e6, { rise: 100, fade: 0.5, exit: { at: C.ring + 1, dur: 9 } });
  const e = WS.eyebrow as { x: number; y: number; align?: 'center' | 'left' };
  return (
    <div style={{ position: 'absolute', left: e.x, top: e.y, transform: e.align === 'center' ? 'translateX(-50%)' : undefined }}>
      <span style={{ ...maskBox(0), display: 'block' }}>
        <span style={{ ...revealStyle(r, undefined, t > C.ring), display: 'flex', alignItems: 'center', gap: '0.55em', ...label, color: HOME.ink, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: SUNDAY_INK, transform: 'translateY(-0.04em)' }} />
          KNOWLEDGE BASE
        </span>
      </span>
    </div>
  );
};
