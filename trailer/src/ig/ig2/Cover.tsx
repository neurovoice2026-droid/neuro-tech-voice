/** REEL 2's cover (SCRIPT.md ig2 §5) — placeholder art until the clock lockup and the Booked + PRO chips exist. */
import React from 'react';
import { CoverCard } from '../components/CoverCard';

export const Cover2: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    spec={{
      reel: 'ig2',
      night: true,
      kicker: 'AI receptionist · 02',
      title: 'Booked at 9:47\u00a0pm.',
      size: 128,
      titleY: 640,
      art: { rect: [86, 330, 844, 230], what: '“9:47 pm” lockup, teal orb colon' },
    }}
  />
);
