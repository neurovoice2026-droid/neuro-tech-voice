/**
 * REEL 4 · THE HAIRLINES (docs/ig/SCRIPT.md ig4 b2–b5): on each phrasing's last word a hairline draws UP from the slot
 * to the line "Sports massage · 60 min · $85" — the kit's MeaningLink idiom (a hairline drawn on EASE.draw, a dot at
 * each end, its tag in the label role on a white chip), drawn as a cubic so it can rise straight out of the slot, swing
 * through the free left margin and come in to the page's edge level with the line (a quadratic from the slot would cut
 * across the page's last line). The first carries LANDS ON (the site's MEANING.landsOn), shown on the first landing
 * only. They stay: by the third, three converge on one line. On the answer they contract into it (un-drawing from the
 * slot into the page, MeaningLink's exit).
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { APP, labelWidth, useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { ZoneRect } from '../components/ZoneGuard';
import { PAGE_1, pageAt, rowMid, TARGET_ROW } from './layout';
import { linkFoot } from './SingleSlot';
import * as T from './timing';

const SUNDAY = MOMENT_LIGHTS.sunday;
const M = T.M;
const TAG = 'Lands on';

type P = { x: number; y: number };
/** where every hairline lands: the page's left edge, level with the target line (at the page's b2–b5 pose) */
export const linkEnd = (): P => pageAt(PAGE_1, 0, rowMid(TARGET_ROW));
/** the cubic of hairline k: straight up out of the slot, through the left margin, in to the page's edge */
export function linkCurve(k: number): [P, P, P, P] {
  return hairCurve(linkFoot(k), linkEnd(), k);
}
/** the hairlines' shape (also the cover's): from a foot below, up and through the left margin, in to an edge point */
export function hairCurve(a: P, e: P, k: number): [P, P, P, P] {
  const rise = a.y - e.y;
  return [a, { x: a.x - 10 * k, y: a.y - rise * 0.3 }, { x: e.x - 200 + 12 * k, y: e.y + 170 + 14 * k }, e];
}
export const curvePath = (c: readonly P[]) =>
  `M${c[0].x.toFixed(2)} ${c[0].y.toFixed(2)} C${c[1].x.toFixed(2)} ${c[1].y.toFixed(2)} ${c[2].x.toFixed(2)} ${c[2].y.toFixed(2)} ${c[3].x.toFixed(2)} ${c[3].y.toFixed(2)}`;
export const HAIR = { width: [2.2, 1.8, 1.8], alpha: [0.9, 0.62, 0.62] } as const;
const bez = (c: [P, P, P, P], u: number): P => {
  const v = 1 - u;
  const w = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];
  return { x: w[0] * c[0].x + w[1] * c[1].x + w[2] * c[2].x + w[3] * c[3].x, y: w[0] * c[0].y + w[1] * c[1].y + w[2] * c[2].y + w[3] * c[3].y };
};

const WIDTH = HAIR.width;
const ALPHA = HAIR.alpha;

export const Links: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.links[0] - 0.5 || t > M.retract[1] + 1) return null;
  const q = tween(t, M.retract, [0, 1], EASE.in3);
  const tagSize = 28;
  const c0 = linkCurve(0);
  // the tag: on the first hairline's straight run up out of the slot, rising as the pen passes it
  const tagU = 0.3;
  const tagP = bez(c0, tagU);
  const tagIn = springUnit(t - (M.links[0] + M.linkDur * 0.38), SPRING.caption);
  const tagW = labelWidth(TAG, tagSize) + 1.4 * tagSize;
  const tagX = Math.max(76 + tagW / 2, tagP.x);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        {M.links.map((at, k) => {
          if (t < at) return null;
          const c = linkCurve(k);
          const p = tween(t, [at, at + M.linkDur], [0, 1], EASE.draw);
          const d = curvePath(c);
          const w = WIDTH[k];
          const land = M.lands[k];
          const pop = t >= land - 0.5 ? springUnit(t - (land - 0.5), SPRING.pop) : 0;
          return (
            <g key={k} opacity={ALPHA[k]}>
              <path d={d} fill="none" stroke={SUNDAY.ink} strokeWidth={w} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0, p - q).toFixed(4)} 2`} strokeDashoffset={(-q).toFixed(4)} />
              <circle cx={c[0].x} cy={c[0].y} r={w * 2 * smooth(0, 0.15, p) * (1 - smooth(0, 0.3, q))} fill={SUNDAY.ink} />
              <circle cx={c[3].x} cy={c[3].y} r={w * 2.4 * Math.max(0, pop) * (1 - smooth(0.85, 1, q))} fill={SUNDAY.ink} />
            </g>
          );
        })}
      </svg>
      {tagIn > 0.001 ? (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(`translate(${tagX.toFixed(2)}px, ${tagP.y.toFixed(2)}px) translate(-50%, -50%)`, true) }}>
            <div
              style={{
                ...typeStyle('label', true, { size: tagSize }),
                color: SUNDAY.ink,
                background: '#ffffff',
                padding: '0.38em 0.7em 0.34em',
                borderRadius: 999,
                boxShadow: `0 0 0 1.25px ${APP.border}, 0 6px 16px -8px rgba(30, 20, 66, 0.35)`,
                whiteSpace: 'nowrap',
                opacity: smooth(0, 0.5, tagIn) * (1 - smooth(0, 0.6, q)),
                transform: `translateY(${((1 - Math.min(1, tagIn)) * 40).toFixed(2)}%)`,
              }}
            >
              {TAG}
            </div>
          </div>
          {q < 0.5 ? <ZoneRect what="hairline tag LANDS ON" rect={{ x: tagX - tagW / 2, y: tagP.y - tagSize * 0.95, w: tagW, h: tagSize * 1.9 }} /> : null}
        </>
      ) : null}
    </>
  );
};

