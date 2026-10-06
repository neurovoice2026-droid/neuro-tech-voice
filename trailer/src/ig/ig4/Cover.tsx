/**
 * REEL 4's cover (docs/ig/SCRIPT.md ig4 §5; IG4-Cover-9x16, pearl): the kicker AI RECEPTIONIST · 04; the sample studio's
 * price list (PriceList.tsx) with THREE HAIRLINES CONVERGING on its $85 line — the reel's own picture (Links.tsx's shape,
 * fully drawn; the line swept in her teal, $85 in the sunday ink); the title "Can you trip it up?" on two rows at 140 px,
 * "trip" in her teal. Everything inside x 86–930, y 260–1500 (the profile grid's 3:4 crop). An image: its words need no
 * voice.
 */
import React from 'react';
import { useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';
import { curvePath, HAIR } from './Links';
import { pageAt, rowMid, TARGET_ROW, type PagePose } from './layout';
import { PriceList } from './PriceList';
import { Ground4 } from './Stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the page: × .9, its right edge on x 906 (the left margin holds the hairlines' arcs), y 340–763 */
const POSE: PagePose = { x: 906 - 760 * 0.9, y: 340, s: 0.9 };
/** the hairlines' feet: three points under the page, over the title */
const FEET = [{ x: 700, y: 950 }, { x: 520, y: 950 }, { x: 350, y: 950 }];
type P = { x: number; y: number };
/** the cover's hairlines: the reel's shape, run left under the page first (the feet are close below it) */
const coverCurve = (a: P, e: P, k: number): P[] => [a, { x: a.x - 0.5 * (a.x - e.x), y: a.y }, { x: e.x - 200 + 12 * k, y: e.y + 160 + 14 * k }, e];

const Art: React.FC = () => {
  const ready = useKitFaces();
  if (!ready) return null;
  const e = pageAt(POSE, 0, rowMid(TARGET_ROW));
  return (
    <>
      <PriceList t={0} pose={POSE} lands={[-60, -50, -40]} priceAt={-40} zone />
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        {FEET.map((a, k) => {
          const c = coverCurve(a, e, k);
          return (
            <g key={k} opacity={HAIR.alpha[k]}>
              <path d={curvePath(c)} fill="none" stroke={SUNDAY.ink} strokeWidth={HAIR.width[k] * 1.15} strokeLinecap="round" />
              <circle cx={a.x} cy={a.y} r={HAIR.width[k] * 2.2} fill={SUNDAY.ink} />
            </g>
          );
        })}
        <circle cx={e.x} cy={e.y} r={HAIR.width[0] * 2.6} fill={SUNDAY.ink} />
      </svg>
    </>
  );
};

export const Cover4: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    ground={<Ground4 t={0} />}
    art={<Art />}
    spec={{
      reel: 'ig4',
      night: false,
      kicker: 'AI receptionist · 04',
      title: 'Can you trip it up?',
      accent: { word: 'trip', ink: SUNDAY.ink },
      rows: [2],
      size: 140,
      titleY: 1010,
    }}
  />
);
