/**
 * REEL 5's cover (docs/ig/ig5/SCRIPT.md §7; IG5-Cover-9x16, pearl) — PROVISIONAL: the kicker AI RECEPTIONIST · 05 and
 * the hook as the title, "Don't pay / $300 a month." with "$300" in rose, over a marked placeholder where the b4 payoff
 * thumbnail goes (the pile with its three anchors and hedges, ours with "$49", at × .6). The attribution rows "Agency
 * retainer." / "Ours: from $49 a month." come with the art. Everything inside x 86–930, y 260–1500 (the profile grid's
 * 3:4 crop). An image: its words need no voice.
 */
import React from 'react';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';

export const Cover5: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    spec={{
      reel: 'ig5',
      night: false,
      kicker: 'AI receptionist · 05',
      title: 'Don’t pay $300 a month.',
      accent: { word: '$300', ink: MOMENT_LIGHTS.rush.ink },
      rows: [2],
      size: 128,
      titleY: 330,
      art: { rect: [86, 790, 814, 550], what: 'b4 payoff thumbnail (placeholder)' },
    }}
  />
);
