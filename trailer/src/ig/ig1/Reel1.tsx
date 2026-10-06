/**
 * REEL 1 — the acts on the reel's timeline (src/ig/ig1/timing.ts). Every act is still a placeholder title card
 * (components/TitleCard.tsx); each is replaced by its built act (src/ig/ig1/acts/*.tsx) in build step 6.
 */
import React from 'react';
import { titleCard } from '../components/TitleCard';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import * as T from './timing';

export const ACTS1: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, titleCard(T, k)]));

export const Reel1: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS1} {...p} />;
