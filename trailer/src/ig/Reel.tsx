/**
 * The reel shell (docs/ig/PIPELINE.md §1), the mirror of src/kb/Film.tsx for one reel: the brand fonts, each act in its
 * own <Sequence> on the reel's timeline (overlapping by its pre/post frames; later acts on top), the zone overlay in the
 * IG-QA compositions, and the reel's mix. The finishing pass (components/Finish.tsx, IgFinish: the grain + dark dither
 * the bit-budget probe settled, PIPELINE.md §8.1) lies over every act, on the reel's ground (pearl / night).
 */
import React, { useState } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { waitForFonts } from '../lib/fonts';
import { C } from '../theme';
import { IgFinish } from './components/Finish';
import { ZoneOverlay, ZoneProvider, ZoneRect } from './components/ZoneGuard';
import { useSub, useTimelineFrame } from './scene';
import { Soundtrack } from './Soundtrack';
import type { ReelProps, ReelTimeline } from './types';

export const IgReel: React.FC<ReelProps & { T: ReelTimeline; acts: { readonly [key: string]: React.FC } }> = ({ T, acts, only, audio = true, zones = false, zoneProbe = false }) => {
  useState(() => waitForFonts());
  const sub = useSub();
  const frame = useTimelineFrame();
  return (
    <ZoneProvider value={{ on: zones, reel: T.REEL, frame, cover: false }}>
      <AbsoluteFill style={{ background: T.GRAIN.ground === 'night' ? C.night : '#f3f2f6', overflow: 'hidden' }}>
        {T.ORDER.filter((k) => !only || k === only).map((key) => {
          const s = T.SCENES[key];
          const Act = acts[key];
          return (
            <Sequence key={key} name={key} from={(s.from - s.pre) * sub} durationInFrames={(s.to + s.post - (s.from - s.pre)) * sub}>
              <Act />
            </Sequence>
          );
        })}
        <IgFinish white={T.GRAIN.ground === 'night' ? 0 : 1} />
        {zones ? <ZoneOverlay /> : null}
        {zones && zoneProbe ? <ZoneRect what="selftest probe (deliberately on the rail)" rect={{ x: 930, y: 1000, w: 120, h: 60 }} /> : null}
        {audio && !only && !zones ? <Soundtrack file={T.MIX.file} /> : null}
      </AbsoluteFill>
    </ZoneProvider>
  );
};
