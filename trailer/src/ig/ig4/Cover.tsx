/** REEL 4's cover (SCRIPT.md ig4 §5) — placeholder art until the price list and its hairlines exist; "trip" in teal. */
import React from 'react';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';

export const Cover4: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    spec={{
      reel: 'ig4',
      night: false,
      kicker: 'AI receptionist · 04',
      title: 'Can you trip\u00a0it\u00a0up?',
      accent: { word: 'trip', ink: MOMENT_LIGHTS.sunday.ink },
      size: 140,
      titleY: 1000,
      art: { rect: [140, 330, 760, 570], what: 'price list, three hairlines on $85' },
    }}
  />
);
