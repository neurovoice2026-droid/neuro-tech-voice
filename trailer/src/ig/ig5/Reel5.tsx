/**
 * REEL 5 · "Three rings" (slug `dont-pay-300`) — the acts on the reel's timeline (src/ig/ig5/timing.ts;
 * docs/ig/ig5/SCRIPT.md, HOOKS.md §1): acts/Acts.tsx (hook · agency · answering · ours · setup · does: one continuous
 * stage, stage/Stage.tsx; end: the shared end card over the sample call, its seam re-forming frame 0).
 * ig5's own safe zone (TikTok + Instagram, src/ig/ig5/zones.ts) is registered with the zone guard here.
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { ACTS5 } from './acts/Acts';
import { registerIg5Zones } from './stage/Zones';
import * as T from './timing';

registerIg5Zones();

export { ACTS5 };

export const Reel5: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS5} {...p} />;
