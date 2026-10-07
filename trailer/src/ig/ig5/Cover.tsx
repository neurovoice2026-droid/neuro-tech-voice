/**
 * REEL 5's cover (docs/ig/ig5/HOOKS.md §1.8, SCRIPT.md §7; IG5-Cover-9x16, pearl) — PROVISIONAL: the kicker
 * AI RECEPTIONIST · 05 (the search keyword) and the hook as the title on three rows, "Three rings." / "Gloves on." /
 * "You can't." with "Three" in rose (the ringing phone's colour), over a marked placeholder where the b4 payoff
 * thumbnail goes (the pile with its three anchors and hedges, ours with "$49", y 890–1380; its "$49" above y 1300). The
 * ring trio right of row 1 and the attribution rows "Agency AI receptionist:" / "commonly $300 a month." / "Ours: from
 * $49 a month." (44 px, y 720–876; SCRIPT §7: the $300 keeps T1's hedge) come with the art. Every word is spoken in the
 * reel; everything inside x 86–900, y 260–1380.
 * An image: its words need no voice.
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
      title: 'Three rings. Gloves on. You can’t.',
      accent: { word: 'Three', ink: MOMENT_LIGHTS.rush.ink },
      // three rows (HOOKS §1.8): "Three rings." / "Gloves on." / "You can't." at ≈ 112 px, y 330–700
      rows: [2, 4],
      size: 112,
      maxW: 814,
      titleY: 330,
      art: { rect: [86, 890, 814, 490], what: 'b4 payoff thumbnail (placeholder; the attribution rows sit above it, y 720–876)' },
    }}
  />
);
