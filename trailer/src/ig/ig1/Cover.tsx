/** REEL 1's cover (SCRIPT.md ig1 §5) — placeholder art until the WeekGrid exists: the kicker, the title with "fire" in rose. */
import React from 'react';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';

export const Cover1: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
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
