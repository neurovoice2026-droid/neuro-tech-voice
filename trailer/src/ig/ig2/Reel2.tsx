/**
 * REEL 2 · "Booked after hours" — the acts on the reel's timeline (src/ig/ig2/timing.ts; docs/ig/SCRIPT.md ig2):
 * acts/Acts.tsx (hook · call · booked · end), drawn from the stage parts in Stage.tsx, Clock.tsx, SlotStrip.tsx, Cards.tsx.
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { Booked2, Call2, End2, Hook2 } from './acts/Acts';
import * as T from './timing';

export const ACTS2: { readonly [key: string]: React.FC } = { hook: Hook2, call: Call2, booked: Booked2, end: End2 };

export const Reel2: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS2} {...p} />;
