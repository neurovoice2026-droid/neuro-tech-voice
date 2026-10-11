/**
 * REEL 6's cover (docs/ig/ig6/SCRIPT.md §9; IG6-Cover-9x16, PNG 1080 × 1920, flat white) — PROVISIONAL: the type is final
 * (the kicker AI RECEPTIONIST · 06, the title "One ring," / teal italic "six seconds.", the stakes line "Your receptionist
 * can’t answer." at SCRIPT §9's sizes and baselines, in the reel's real faces); the picture — frame 0's composition drawn
 * bolder for the tile (rim 12 px, ticks × 1.33, shadow 9 %, node 1 under the needle, its stretch half inked, graphite
 * hub) — is the scene build's: a marked placeholder shows where it goes. Every word inside x 86–900, y 260–1380 (both
 * apps' 3:4 grid tile is y 240–1680), checked by ig6's own cover rule (./zones.ts) in zone mode.
 */
import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';
import { measureText, typo } from '../../kb/kit';
import { waitForFonts } from '../../lib/fonts';
import { ZoneOverlay, ZoneProvider, ZoneRect } from '../components/ZoneGuard';
import { measureSans, measureSerif, useIg6Faces } from './stage/fonts';
import { FACE, INK, TIER } from './stage/style';
import { registerIg6Zones } from './stage/Zones';

registerIg6Zones();

/** SCRIPT §9: the cover's type */
const COVER = {
  kicker: { text: 'AI RECEPTIONIST · 06', size: 28, weight: 600, tracking: 0.08, x: 345, base: 1080 },
  lead: { text: 'One ring,', size: 84, x: 345, base: 1168 },
  accent: { text: 'six seconds.', size: 126, x: 330, base: 1256 },
  stakes: { text: typo("Your receptionist can't answer."), size: 40, weight: 450, x: 580, base: 1322 },
  art: { x: 86, y: 300, w: 814, h: 660 },
} as const;

export const Cover6: React.FC<{ zones?: boolean }> = ({ zones = false }) => {
  useState(() => waitForFonts());
  const ready = useIg6Faces();
  const C = COVER;
  const kickW = ready ? measureSans(C.kicker.text, C.kicker.size, C.kicker.weight, C.kicker.tracking) : 0;
  const leadW = ready ? measureSans(C.lead.text, C.lead.size, TIER.lead.weight, TIER.lead.tracking) : 0;
  const accW = ready ? measureSerif(C.accent.text, C.accent.size) : 0;
  const stakesW = ready ? measureSans(C.stakes.text, C.stakes.size, C.stakes.weight) : 0;
  const artLabel = 'art: frame 0’s dial + hand, bolder (scene build)';
  const sans = (size: number, weight: number, tracking: number): React.CSSProperties => ({ fontFamily: FACE.sans, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, fontSynthesis: 'none', whiteSpace: 'pre' });
  return (
    <ZoneProvider value={{ on: zones, reel: 'ig6', frame: 0, cover: true }}>
      <AbsoluteFill style={{ background: INK.ground }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
          <rect x={C.art.x} y={C.art.y} width={C.art.w} height={C.art.h} fill="none" stroke={INK.tickMinor} strokeWidth={2} strokeDasharray="10 10" />
          {ready ? (
            <>
              <text x={C.art.x + 24} y={C.art.y + 48} style={{ fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontSize: 24, fill: INK.tickSec }}>
                {artLabel}
              </text>
              <text x={C.kicker.x} y={C.kicker.base} fill={INK.tier} style={sans(C.kicker.size, C.kicker.weight, C.kicker.tracking)}>
                {C.kicker.text}
              </text>
              <text x={C.lead.x} y={C.lead.base} fill={INK.ink} style={sans(C.lead.size, TIER.lead.weight, TIER.lead.tracking)}>
                {C.lead.text}
              </text>
              <text x={C.accent.x} y={C.accent.base} fill={INK.teal} style={{ fontFamily: FACE.serif, fontStyle: 'italic', fontSize: C.accent.size, fontWeight: TIER.accent.weight, letterSpacing: `${TIER.accent.tracking}em`, fontSynthesis: 'none', whiteSpace: 'pre' }}>
                {C.accent.text}
              </text>
              <text x={C.stakes.x} y={C.stakes.base} textAnchor="middle" fill={INK.tier} style={sans(C.stakes.size, C.stakes.weight, 0)}>
                {C.stakes.text}
              </text>
            </>
          ) : null}
        </svg>
        {ready ? (
          <>
            <ZoneRect what="text cover art label (placeholder)" rect={{ x: C.art.x + 24, y: C.art.y + 26, w: measureText(artLabel, { size: 24, mono: true }), h: 30 }} />
            <ZoneRect what="text cover kicker" rect={{ x: C.kicker.x, y: C.kicker.base - C.kicker.size * 0.76, w: kickW, h: C.kicker.size }} />
            <ZoneRect what="text cover title lead" rect={{ x: C.lead.x, y: C.lead.base - C.lead.size * 0.76, w: leadW, h: C.lead.size }} />
            <ZoneRect what="text cover title accent" rect={{ x: C.accent.x, y: C.accent.base - C.accent.size * 0.72, w: accW, h: C.accent.size * 0.98 }} />
            <ZoneRect what="text cover stakes" rect={{ x: C.stakes.x - stakesW / 2, y: C.stakes.base - C.stakes.size * 0.78, w: stakesW, h: C.stakes.size }} />
          </>
        ) : null}
        {zones ? <ZoneOverlay cover /> : null}
      </AbsoluteFill>
    </ZoneProvider>
  );
};
