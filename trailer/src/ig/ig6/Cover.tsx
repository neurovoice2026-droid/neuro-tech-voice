/**
 * REEL 6's cover (docs/ig/ig6/SCRIPT.md §9; IG6-Cover-9x16, PNG 1080 × 1920, flat white): frame 0's composition with node
 * 1 at the needle (a second in: just behind it) and its ring stretch half inked, drawn bolder for the grid tile (rim 12 px, ticks × 1.33, the
 * shadow at 9 %), the graphite hub (no teal on the hub: your phone); the kicker AI RECEPTIONIST · 06, the title
 * "One ring," / teal italic "six seconds." and the stakes line "Your receptionist can’t answer." in the reel's faces.
 * The teal accents are the rim and the italic. Every word inside x 86–900, y 260–1380 (both apps' 3:4 grid tile is
 * y 240–1680), checked by ig6's own cover rule (./zones.ts) in zone mode; TikTok autoplays from frame 0, which is this
 * composition, so the grid and the feed agree.
 */
import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';
import { typo } from '../../kb/kit';
import { waitForFonts } from '../../lib/fonts';
import { ZoneOverlay, ZoneProvider, ZoneRect } from '../components/ZoneGuard';
import { DialSvg, worldPrims } from './stage/Dial';
import { measureSans, measureSerif, useIg6Faces } from './stage/fonts';
import { HUB, IDENT_PLANE, needlePhi } from './stage/geom';
import { WorldHand } from './stage/Hand';
import { FACE, GREY_AA, HAND, INK, TIER } from './stage/style';
import { registerIg6Zones } from './stage/Zones';

registerIg6Zones();

/** SCRIPT §9: the cover's type */
const COVER = {
  kicker: { text: 'AI RECEPTIONIST · 06', size: 28, weight: 600, tracking: 0.08, x: 345, base: 1080 },
  lead: { text: 'One ring,', size: 84, x: 345, base: 1168 },
  accent: { text: 'six seconds.', size: 126, x: 330, base: 1256 },
  stakes: { text: typo("Your receptionist can't answer."), size: 40, weight: 450, x: 580, base: 1322 },
} as const;
/** ring 1 a second in (ρ −12°): node 1 just behind the needle, its 2 s stretch half inked — rung up to the needle,
 *  pending grey ahead of it (the reel's own f30–60 state) */
const PRIM_STATE = { mode: 'phone' as const, rho: -12, inkTo: needlePhi(-12), bold: { rim: 12, tick: 1.33 } };

export const Cover6: React.FC<{ zones?: boolean }> = ({ zones = false }) => {
  useState(() => waitForFonts());
  const ready = useIg6Faces();
  const C = COVER;
  const kickW = ready ? measureSans(C.kicker.text, C.kicker.size, C.kicker.weight, C.kicker.tracking) : 0;
  const leadW = ready ? measureSans(C.lead.text, C.lead.size, TIER.lead.weight, TIER.lead.tracking) : 0;
  const accW = ready ? measureSerif(C.accent.text, C.accent.size) : 0;
  const stakesW = ready ? measureSans(C.stakes.text, C.stakes.size, C.stakes.weight) : 0;
  const sans = (size: number, weight: number, tracking: number): React.CSSProperties => ({ fontFamily: FACE.sans, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, fontSynthesis: 'none', whiteSpace: 'pre' });
  const prim = worldPrims(IDENT_PLANE, PRIM_STATE);
  return (
    <ZoneProvider value={{ on: zones, reel: 'ig6', frame: 0, cover: true }}>
      <AbsoluteFill style={{ background: INK.ground }}>
        <DialSvg prim={prim} id="ig6-cover-dial" />
        <WorldHand id="ig6-cover-hand" plane={IDENT_PLANE} pivot={HUB} look={{ angle: HAND.angle, dome: { kind: 'graphite' }, shadow: 9 / 7 }} />
        {ready ? (
          // greyscale AA for the small grey kicker and stakes line (crit-r1 N3: LCD fringes) through a transparency group,
          // not a composited layer (crit-r2 D1)
          <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: GREY_AA }} aria-hidden>
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
          </svg>
        ) : null}
        {ready ? (
          <>
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
