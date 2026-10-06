/**
 * REEL 4 · THE THRESHOLD (docs/ig/SCRIPT.md ig4 b6–b8, §5 "ThresholdRule + short-falling hairlines, new — around kit
 * MeaningLink"): the site's own "where the documents stop" figure (components/site/product/knowledge-base/limits.tsx)
 * set between the documents and the question:
 *
 *   the rule     a dotted hairline across the stage (x 86–906), drawn left to right as the documents land, with the
 *                site's label CLOSE ENOUGH TO ANSWER (LIMITS.figure.threshold; label role 28, slate) over its right end
 *   the hairlines on "visits", five rise from the slot's top edge on 32nds — the kit link's hairline (2 px, a dot at
 *                its foot) — each as far as the site's figure lets that document match "Do you do home visits?"
 *                (knowledge-base.ts ROOM.questions "home": .22 .14 .10 .30 .26 against the threshold's .6) — and STOPS
 *                SHORT, ending in a small open circle: nothing in the documents is close enough
 *
 * Still through the stop-time (pure functions of t; nothing here moves then), dimmed under the fallback, gone before
 * the thesis. Hairlines are not text (the zone guard sees only the label).
 */
import React from 'react';
import { EASE, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { reveal, revealStyle } from '../../components/Type';
import { labelWidth, useKitFaces } from '../../kb/kit';
import { ZoneRect } from '../components/ZoneGuard';
import { SLOT, stubTop, THRESH } from './layout';
import { SLATE } from './SingleSlot';
import * as T from './timing';

const M = T.M;
const LABEL = 'Close enough to answer';
const DRAW = 14;
const RISE = 9;
const EXIT = 5;
/** the rule's dots: 3.4 px at an 8 px pitch, near full slate — it must read as a LINE at phone size (the reason the
 *  hairlines stop short), not as a faint texture on the mesh */
const DOT = { w: 3.4, pitch: 8, alpha: 0.92 } as const;

export const Threshold: React.FC<{ t: number; dim?: number; exitAt: number }> = ({ t, dim = 1, exitAt }) => {
  const ready = useKitFaces();
  if (!ready || t < M.threshold - 0.5 || t > exitAt + EXIT + 1) return null;
  const draw = tween(t, [M.threshold, M.threshold + DRAW], [0, 1], EASE.draw);
  // it leaves with the question (the slot's own exit length): one unit
  const q = tween(t, [exitAt, exitAt + EXIT], [0, 1], EASE.inOut);
  const a = (1 - smooth(0.2, 1, q)) * dim;
  const size = 28;
  const lw = labelWidth(LABEL, size);
  const lx = THRESH.x1 - lw;
  const ly = THRESH.y - size * 1.2 - 12;
  const r = reveal(t, M.threshold + DRAW * 0.6, { config: SPRING.caption, rise: 90, fade: 0.5, exit: { at: exitAt, dur: EXIT } });
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity: a < 0.999 ? a : undefined }} aria-hidden>
        {/* the rule: a dotted hairline (the site's dotted "close enough" line), drawn left to right */}
        <line x1={THRESH.x0} y1={THRESH.y} x2={THRESH.x0 + (THRESH.x1 - THRESH.x0) * draw} y2={THRESH.y} stroke={SLATE.tag} strokeOpacity={DOT.alpha} strokeWidth={DOT.w} strokeLinecap="round" strokeDasharray={`0.01 ${DOT.pitch}`} />
        {/* the five hairlines */}
        {M.stubs.map((at, k) => {
          if (t < at - 0.5) return null;
          const top = stubTop(THRESH.match[k]);
          const u = EASE.out3(Math.min(1, Math.max(0, (t - at) / RISE)));
          const y = SLOT.y - (SLOT.y - top) * u;
          const x = THRESH.xs[k];
          const ring = t >= at + RISE - 1 ? springUnit(t - (at + RISE - 1), SPRING.pop) : 0;
          return (
            <g key={k}>
              <line x1={x} y1={SLOT.y} x2={x} y2={y + (ring > 0 ? 6 : 0)} stroke={SLATE.tag} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" />
              <circle cx={x} cy={SLOT.y} r={3.6 * smooth(0, 0.3, u)} fill={SLATE.tag} fillOpacity={0.85} />
              {ring > 0.01 ? <circle cx={x} cy={y} r={6 * Math.max(0, ring)} fill="none" stroke={SLATE.tag} strokeOpacity={0.9} strokeWidth={2} /> : null}
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: lx, top: ly, whiteSpace: 'nowrap', opacity: dim < 0.999 ? dim : undefined }}>
        <span style={{ ...maskBox(0), display: 'block' }}>
          <span style={{ ...revealStyle(r, undefined, t - M.threshold < 24 || t > exitAt - 1), ...typeStyle('label', true, { tone: 'paper', size }), lineHeight: 1.2, color: SLATE.tag }}>{LABEL}</span>
        </span>
      </div>
      {r.opacity > 0.5 ? <ZoneRect what="threshold label" rect={{ x: lx, y: ly, w: lw, h: size * 1.2 }} /> : null}
    </>
  );
};
