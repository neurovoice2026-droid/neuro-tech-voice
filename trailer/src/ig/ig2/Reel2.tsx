/**
 * REEL 2 — the acts on the reel's timeline (src/ig/ig2/timing.ts). Every act is still a placeholder title card
 * (components/TitleCard.tsx); each is replaced by its built act (src/ig/ig2/acts/*.tsx) in build step 6.
 */
import React from 'react';
import { titleCard } from '../components/TitleCard';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import * as T from './timing';

export const ACTS2: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, titleCard(T, k)]));

export const Reel2: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS2} {...p} />;
