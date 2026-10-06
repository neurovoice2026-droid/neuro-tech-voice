/**
 * REEL 1 — the acts on the reel's timeline (src/ig/ig1/timing.ts). The hook (frame 0's composition) and the end card are
 * built on the shared parts (acts/Hook.tsx, acts/End.tsx); the other acts are still placeholder title cards
 * (components/TitleCard.tsx), each replaced by its built act (src/ig/ig1/acts/*.tsx) in build step 6.
 */
import React from 'react';
import { titleCard } from '../components/TitleCard';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { Ig1End } from './acts/End';
import { Ig1Hook } from './acts/Hook';
import * as T from './timing';

const BUILT: { readonly [key: string]: React.FC } = { hook: Ig1Hook, end: Ig1End };

export const ACTS1: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, BUILT[k] ?? titleCard(T, k)]));

export const Reel1: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS1} {...p} />;
