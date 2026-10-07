/**
 * REEL 5 · "Don't pay $300" — the acts on the reel's timeline (src/ig/ig5/timing.ts; docs/ig/ig5/SCRIPT.md):
 * acts/Acts.tsx (PROVISIONAL: title cards, then the shared end card).
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { ACTS5 } from './acts/Acts';
import * as T from './timing';

export { ACTS5 };

export const Reel5: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS5} {...p} />;
