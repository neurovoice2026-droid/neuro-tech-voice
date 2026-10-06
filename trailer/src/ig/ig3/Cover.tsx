/** REEL 3's cover (SCRIPT.md ig3 §5) — placeholder art until the TimerCard exists; the title on its two rows. */
import React from 'react';
import { CoverCard } from '../components/CoverCard';

export const Cover3: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    spec={{
      reel: 'ig3',
      night: false,
      kicker: 'AI receptionist · 03 · salons',
      title: 'Twelve minutes on the colour.',
      // two rows (SCRIPT ig3 §5): fitted to 844 px by the framework
      rows: [2],
      size: 128,
      titleY: 820,
      art: { rect: [340, 330, 400, 400], what: 'timer 12:00' },
    }}
  />
);
