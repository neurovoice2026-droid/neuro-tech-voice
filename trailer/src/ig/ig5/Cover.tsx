/**
 * REEL 5's cover (docs/ig/ig5/HOOKS.md §1.8, SCRIPT.md §7; IG5-Cover-9x16, pearl), everything inside ig5's cover box
 * (x 86–900, y 260–1380, src/ig/ig5/zones.ts; checked by the zone guard in cover mode):
 *
 *   kicker       AI RECEPTIONIST · 05 (label role, y 270): the search keyword and the series number
 *   title        the hook, "Three rings." / "Gloves on." / "You can't." on three rows at 112 px from y 330, "Three" in
 *                rose (the ringing phone's colour), the ring trio (three rose hairlines round the light) right of row 1
 *   attribution  three rows at 44 px, graphite, y 720–876: "Agency AI receptionist:" / "commonly $300 a month." ("$300"
 *                in rose: the $300 keeps T1's hedge, RESEARCH-prices §6 #6) / "Ours: from $49 a month" ("$49" in her
 *                teal, her orb as the full stop) — so the grid tile can't read as "AI receptionists cost $300"
 *   thumbnail    the b4 payoff itself (stage/Papers + stage/Ours at the payoff frame: the pile with all three anchors and
 *                their hedges, ours with "$49" and "No setup fee.", the bars to scale), y 890–1300, its "$49" above
 *                y 1300 (TikTok's grid view count)
 *
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
import { ZoneProvider, ZoneRect } from '../components/ZoneGuard';
import { OURS } from './stage/layout';
import { fullStopAt, Ours } from './stage/Ours';
import { Papers } from './stage/Papers';
import { registerIg5Zones } from './stage/Zones';
import { figWidth, money } from './stage/type';
import * as T from './timing';

registerIg5Zones();

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;

/** the payoff frame the thumbnail shows (every word on ours printed, the bars drawn) */
const PAYOFF = T.M.noSetup[2] + 6;
/** the thumbnail: the stage's top-left of the payoff (x 120, y 300: ours' and the pile's left edge, the pile's top) →
 *  cover (86, 890), × .42 — on the text's own axis (x 86), its "$49" ending just above y 1300 */
const THUMB = { s: 0.42, from: { x: 120, y: 300 }, to: { x: 86, y: 890 } } as const;
/** the attribution rows */
const ATT = { x: 86, y: 720, size: 44, pitch: 52, weight: 480, tracking: -0.02 } as const;
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
  const orbD = 26;
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

/** her orb as ours' full stop in the thumbnail (a still: the CSS mesh orb in her teal) */
const StopDot: React.FC<{ at: { x: number; y: number }; d: number }> = ({ at, d }) => <LineLight t={40} x={at.x} y={at.y} d={d} palette={SUNDAY.orb} />;

/** the payoff at the cover's scale; its own rects are not the cover's (they are reported once, scaled, below) */
const Thumbnail: React.FC = () => {
  const ready = useKitFaces();
  const { s, from, to } = THUMB;
  const tf = `translate(${(to.x - from.x * s).toFixed(3)}px, ${(to.y - from.y * s).toFixed(3)}px) scale(${s})`;
  const map = (x: number, y: number) => ({ x: to.x + (x - from.x) * s, y: to.y + (y - from.y) * s });
  // ours' "$49" (stage: x 160, its box top OURS.y4 + fig.y, 200 px) on the cover
  const a = map(OURS.x + OURS.fig.x, OURS.y4 + OURS.fig.y);
  const w49 = ready ? figWidth(money(49), OURS.fig.size) * s : 0;
  const pile = map(120, 300);
  const end = map(OURS.x + OURS.w, OURS.y4 + OURS.h);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: tf }}>
        <ZoneProvider value={{ on: false, reel: 'ig5', frame: 0, cover: true }}>
          <Papers t={PAYOFF} />
          <Ours t={PAYOFF} />
        </ZoneProvider>
      </div>
      {ready ? <StopDot at={map(fullStopAt(PAYOFF).x, fullStopAt(PAYOFF).y)} d={44 * s} /> : null}
      <ZoneRect what="price $49 (cover thumbnail)" rect={{ x: a.x, y: a.y, w: w49, h: OURS.fig.size * s }} />
      <ZoneRect what="cover thumbnail" rect={{ x: pile.x, y: pile.y, w: end.x - pile.x, h: end.y - pile.y }} />
    </>
  );
};

const Art: React.FC = () => {
  const ready = useKitFaces();
  if (!ready) return null;
  return (
    <>
      <Trio />
      <Attribution />
      <Thumbnail />
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
