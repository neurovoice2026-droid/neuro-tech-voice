/**
 * REEL 5's cover (docs/ig/ig5/HOOKS.md §1.8, SCRIPT.md §7; IG5-Cover-9x16, pearl), everything inside ig5's cover box
 * (x 86–900, y 260–1380, src/ig/ig5/zones.ts; checked by the zone guard in cover mode):
 *
 *   kicker       AI RECEPTIONIST · 05 (label role, y 270): the search keyword and the series number
 *   title        the hook, "Three rings." / "Gloves on." / "You can't." on three rows at 112 px from y 330, "Three" in
 *                rose (the ringing phone's colour), the ring trio (three rose hairlines round the light) right of row 1
 *   attribution  three rows at 52 px, graphite, y 750–936: "Agency AI receptionist:" / "commonly $300 a month." ("$300"
 *                in rose: the $300 keeps T1's hedge, RESEARCH-prices §6 #6) / "Ours: from $49 a month" ("$49" in her
 *                teal, her orb as the full stop) — so the grid tile can't read as "AI receptionists cost $300"
 *
 * A title and ONE graphic, as ig1–ig4 (crit-r1 P6 / T4): the × .42 payoff thumbnail is gone — its labels rendered at
 * ≈ 11 px (its "$99" without a legible "for 50 minutes" at grid size) and it repeated the attribution's $300 and $49.
 * Every word on it is spoken in the reel (with T1 placed). An image: its words need no voice.
 */
import React from 'react';
import { FONT } from '../../theme';
import { measureText, spaceWidth, useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { GRAPHITE } from '../../kb/theme';
import { CoverCard } from '../components/CoverCard';
import { PearlGround } from '../components/Ground';
import { LineLight } from '../components/Orb';
import { ZoneRect } from '../components/ZoneGuard';
import { registerIg5Zones } from './stage/Zones';

registerIg5Zones();

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;

/** the attribution rows (52 px: ≈ 19 px on a 390 px grid tile) */
const ATT = { x: 86, y: 750, size: 52, pitch: 62, weight: 480, tracking: -0.02 } as const;
/** the ring trio right of title row 1 (cover scale) */
const TRIO = { x: 832, y: 392, d: [40, 86, 132], w: [2.4, 1.8, 1.2], a: [0.85, 0.6, 0.35], dot: 13 } as const;

type Run = { text: string; color?: string };
const ROWS: readonly (readonly Run[])[] = [
  [{ text: 'Agency AI receptionist:' }],
  [{ text: 'commonly ' }, { text: '$300', color: RUSH.ink }, { text: ' a month.' }],
  [{ text: 'Ours: from ' }, { text: '$49', color: SUNDAY.ink }, { text: ' a month' }],
];

const Attribution: React.FC = () => {
  const spec = { size: ATT.size, weight: ATT.weight, tracking: ATT.tracking };
  const rowW = (r: readonly Run[]) => measureText(r.map((x) => x.text).join(''), spec);
  const last = ROWS[2];
  const lastW = rowW(last);
  const orbD = 30;
  const orbX = ATT.x + lastW + spaceWidth(spec) * 0.35 + orbD / 2;
  const orbY = ATT.y + 2 * ATT.pitch + ATT.size * 0.96 - orbD / 2 - 1;
  const p49 = measureText('Ours: from ', spec);
  return (
    <>
      {ROWS.map((r, i) => (
        <div key={i} style={{ position: 'absolute', left: ATT.x, top: ATT.y + i * ATT.pitch, fontFamily: FONT.ui, fontSize: ATT.size, fontWeight: ATT.weight, letterSpacing: `${ATT.tracking}em`, lineHeight: 1.2, color: GRAPHITE.text, whiteSpace: 'pre' }}>
          {r.map((x, k) => (
            <span key={k} style={{ color: x.color }}>
              {x.text}
            </span>
          ))}
        </div>
      ))}
      <LineLight t={40} x={orbX} y={orbY} d={orbD} palette={SUNDAY.orb} />
      {ROWS.map((r, i) => (
        <ZoneRect key={i} what={`cover attribution row ${i + 1}`} rect={{ x: ATT.x, y: ATT.y + i * ATT.pitch, w: rowW(r) + (i === 2 ? orbD + 12 : 0), h: ATT.size * 1.2 }} />
      ))}
      <ZoneRect what="price $49 (cover attribution)" rect={{ x: ATT.x + p49, y: ATT.y + 2 * ATT.pitch, w: measureText('$49', spec), h: ATT.size * 1.2 }} />
    </>
  );
};

const Trio: React.FC = () => (
  <>
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      {TRIO.d.map((d, i) => (
        <circle key={i} cx={TRIO.x} cy={TRIO.y} r={d / 2 - TRIO.w[i] / 2} fill="none" stroke={RUSH.orb[2]} strokeOpacity={TRIO.a[i]} strokeWidth={TRIO.w[i]} />
      ))}
    </svg>
    <LineLight t={0} x={TRIO.x} y={TRIO.y} d={TRIO.dot} />
  </>
);

const Art: React.FC = () => {
  const ready = useKitFaces();
  if (!ready) return null;
  return (
    <>
      <Trio />
      <Attribution />
    </>
  );
};

export const Cover5: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    ground={<PearlGround t={0} keyLight={{ x: 540, y: 1180, strength: 0.28, color: '#bfeef5', radius: 900 }} />}
    art={<Art />}
    spec={{
      reel: 'ig5',
      night: false,
      kicker: 'AI receptionist · 05',
      title: 'Three rings. Gloves on. You can’t.',
      accent: { word: 'Three', ink: RUSH.ink },
      // three rows (HOOKS §1.8): "Three rings." / "Gloves on." / "You can't." at ≈ 112 px, y 330–700
      rows: [2, 4],
      size: 112,
      maxW: 814,
      titleY: 330,
    }}
  />
);
