/**
 * REEL 4 · "Can you trip it up?" — the acts on the reel's timeline (src/ig/ig4/timing.ts; docs/ig/SCRIPT.md ig4):
 * acts/Acts.tsx (hook · asked · edge · thesis: one continuous stage, Stage.tsx; end: the shared end card over the five
 * documents, its seam re-forming frame 0).
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { ACTS4 } from './acts/Acts';
import * as T from './timing';

export { ACTS4 };

export const Reel4: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS4} {...p} />;
