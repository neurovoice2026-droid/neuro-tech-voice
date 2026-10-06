/**
 * REEL 1's cover (docs/ig/SCRIPT.md ig1 §5): built on the reel's own two-colour week — the kicker AI RECEPTIONIST · 01, the
 * title "Don't fire your receptionist." (128 px, "fire" in rose), and the week grid as it stands in the desk beat (the
 * front desk's 45 hours graphite, lifted off the week; the agent's 123 teal) at y 760–1460, all inside x 86–930.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';
import { GRID_C, GRID_H, GRID_W } from './grid';
import * as T from './timing';
import { WeekGrid } from './WeekGrid';

/** the grid's state on the cover: the desk beat (both colours, the people's block lifted) */
const AT = T.M.only + 20;
/** the thumbnail's box (SCRIPT: y 760–1460, inside x 86–930) */
const BOX = { x0: 86, x1: 930, y0: 772, y1: 1452 } as const;
const K = Math.min((BOX.x1 - BOX.x0) / GRID_W, (BOX.y1 - BOX.y0) / GRID_H);

const Art: React.FC = () => {
  const cx = (BOX.x0 + BOX.x1) / 2;
  const cy = (BOX.y0 + BOX.y1) / 2;
  return (
    <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${(cx - GRID_C.x * K).toFixed(3)}px, ${(cy - GRID_C.y * K).toFixed(3)}px) scale(${K.toFixed(5)})` }}>
      <WeekGrid t={AT} fx={{ chrome: false }} />
    </AbsoluteFill>
  );
};

export const Cover1: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    art={<Art />}
    spec={{
      reel: 'ig1',
      night: false,
      kicker: 'AI receptionist · 01',
      title: "Don't fire your receptionist.",
      accent: { word: 'fire', ink: MOMENT_LIGHTS.rush.ink },
      size: 128,
      titleY: 330,
      art: { rect: [86, 760, 844, 700], what: 'week grid thumbnail (graphite + teal)' },
    }}
  />
);
