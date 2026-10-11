/**
 * REEL 6 · "One ring" (slug `one-ring`) — ig6's OWN SHELL (docs/ig/ig6/STYLE.md §9.12, PIPELINE.md §0.5): a copy-adapt of
 * src/ig/Reel.tsx IgReel (which renders ig1–ig5 and is never edited) with the two changes the minimal look needs — a flat
 * #FFFFFF base (not the pearl #f3f2f6) and no paper grain (IgFinish with stage/style.ts FINISH6: every strength 0; the
 * banding probe may ask for a static dither, STYLE §9.4). Everything else is IgReel's: the brand fonts (waitForFonts),
 * each act in its own <Sequence> on the reel's timeline (./timing.ts), the zone overlay in the IG-QA compositions, the
 * reel's mix (public/ig/sfx/ig6/mix.wav, `npm run sfx:ig6`).
 * ig6's own safe zone (TikTok + Instagram, ./zones.ts) is registered with the zone guard here (stage/Zones.tsx).
 */
import React, { useState } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { waitForFonts } from '../../lib/fonts';
import { FINISH, IgFinish } from '../components/Finish';
import { ZoneOverlay, ZoneProvider, ZoneRect } from '../components/ZoneGuard';
import { useSub, useTimelineFrame } from '../scene';
import { Soundtrack } from '../Soundtrack';
import type { ReelProps } from '../types';
import { ACTS6 } from './acts/Acts';
import { FINISH6, INK } from './stage/style';
import { registerIg6Zones } from './stage/Zones';
import * as T from './timing';

registerIg6Zones();

export { ACTS6 };

export const Reel6: React.FC<ReelProps> = ({ only, audio = true, zones = false, zoneProbe = false }) => {
  useState(() => waitForFonts());
  const sub = useSub();
  const frame = useTimelineFrame();
  return (
    <ZoneProvider value={{ on: zones, reel: T.REEL, frame, cover: false }}>
      <AbsoluteFill style={{ background: INK.ground, overflow: 'hidden' }}>
        {T.ORDER.filter((k) => !only || k === only).map((key) => {
          const s = T.SCENES[key];
          const Act = ACTS6[key];
          return (
            <Sequence key={key} name={key} from={(s.from - s.pre) * sub} durationInFrames={(s.to + s.post - (s.from - s.pre)) * sub}>
              <Act />
            </Sequence>
          );
        })}
        <IgFinish white={1} spec={{ ...FINISH, ...FINISH6 }} />
        {zones ? <ZoneOverlay /> : null}
        {zones && zoneProbe ? <ZoneRect what="selftest probe (deliberately on the rail)" rect={{ x: 930, y: 1000, w: 120, h: 60 }} /> : null}
        {audio && !only && !zones ? <Soundtrack file={T.MIX.file} /> : null}
      </AbsoluteFill>
    </ZoneProvider>
  );
};
