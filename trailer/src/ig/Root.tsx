/**
 * The Instagram reels' compositions (docs/ig/PIPELINE.md §1; entry point src/ig/index.ts). Ids match ^[a-zA-Z0-9-]+$:
 *   IG<n>-Reel-9x16      120 fps (RENDER_FPS), DURATION × SUB, 1080×1920 — the master (scripts/ig/films.mjs comp + '9x16')
 *   IG<n>-Preview-9x16   30 fps, DURATION — studio and stills; --frame=N is timeline frame N
 *   IG<n>-Cover-9x16     30 fps, 1 frame — the cover PNG (an image: its words need no voice)
 *   folder IG-Scenes     IG<n>-<Act>-9x16: one act at a time on the real timeline, no audio
 *   folder IG-QA         IG<n>-Zones-9x16: the zone overlay + violation logger (scripts/ig/check-zones.mjs);
 *                        IG-Probe-Night-9x16 / IG-Probe-Pearl-9x16: the bit-budget probe's 2 s strips at 120 fps
 *                        (qa/Probe.tsx, scripts/ig/qa/probe-encode.mjs)
 */
import React from 'react';
import { Composition, Folder } from 'remotion';
import { FPS, RENDER_FPS, SUB, VERTICAL } from '../timing';
import * as T1 from './ig1/timing';
import * as T2 from './ig2/timing';
import * as T3 from './ig3/timing';
import * as T4 from './ig4/timing';
import { Reel1 } from './ig1/Reel1';
import { Reel2 } from './ig2/Reel2';
import { Reel3 } from './ig3/Reel3';
import { Reel4 } from './ig4/Reel4';
import { Cover1 } from './ig1/Cover';
import { Cover2 } from './ig2/Cover';
import { Cover3 } from './ig3/Cover';
import { Cover4 } from './ig4/Cover';
import { NightProbe, PearlProbe, PROBE_FRAMES, type ProbeProps } from './qa/Probe';
import type { ReelProps, ReelTimeline } from './types';

type ReelEntry = { n: number; T: ReelTimeline; Reel: React.FC<ReelProps>; Cover: React.FC<{ zones?: boolean }> };
const REELS: readonly ReelEntry[] = [
  { n: 1, T: T1, Reel: Reel1, Cover: Cover1 },
  { n: 2, T: T2, Reel: Reel2, Cover: Cover2 },
  { n: 3, T: T3, Reel: Reel3, Cover: Cover3 },
  { n: 4, T: T4, Reel: Reel4, Cover: Cover4 },
];
const title = (k: string) => k[0].toUpperCase() + k.slice(1);

export const IgRoot: React.FC = () => (
  <>
    {REELS.map(({ n, T, Reel, Cover }) => (
      <React.Fragment key={n}>
        <Composition id={`IG${n}-Reel-9x16`} component={Reel} durationInFrames={T.DURATION * SUB} fps={RENDER_FPS} {...VERTICAL} />
        <Composition id={`IG${n}-Preview-9x16`} component={Reel} durationInFrames={T.DURATION} fps={FPS} {...VERTICAL} />
        <Composition id={`IG${n}-Cover-9x16`} component={Cover} defaultProps={{ zones: false }} durationInFrames={1} fps={FPS} {...VERTICAL} />
      </React.Fragment>
    ))}
    <Folder name="IG-Scenes">
      {REELS.flatMap(({ n, T, Reel }) =>
        T.ORDER.map((k) => (
          <Composition key={`${n}-${k}`} id={`IG${n}-${title(k)}-9x16`} component={Reel} defaultProps={{ only: k, audio: false }} durationInFrames={T.DURATION} fps={FPS} {...VERTICAL} />
        )),
      )}
    </Folder>
    <Folder name="IG-QA">
      {REELS.map(({ n, T, Reel }) => (
        <Composition key={n} id={`IG${n}-Zones-9x16`} component={Reel} defaultProps={{ zones: true, audio: false }} durationInFrames={T.DURATION} fps={FPS} {...VERTICAL} />
      ))}
      <Composition id="IG-Probe-Night-9x16" component={NightProbe} defaultProps={{ reseed: 'timeline' } as ProbeProps} durationInFrames={PROBE_FRAMES} fps={RENDER_FPS} {...VERTICAL} />
      <Composition id="IG-Probe-Pearl-9x16" component={PearlProbe} defaultProps={{ reseed: 'timeline' } as ProbeProps} durationInFrames={PROBE_FRAMES} fps={RENDER_FPS} {...VERTICAL} />
    </Folder>
  </>
);
