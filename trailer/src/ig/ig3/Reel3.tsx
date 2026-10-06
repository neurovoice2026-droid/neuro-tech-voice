/**
 * REEL 3 — the acts on the reel's timeline (src/ig/ig3/timing.ts). Every act is still a placeholder title card
 * (components/TitleCard.tsx); each is replaced by its built act (src/ig/ig3/acts/*.tsx) in build step 6.
 */
import React from 'react';
import { titleCard } from '../components/TitleCard';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import * as T from './timing';

export const ACTS3: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, titleCard(T, k)]));

export const Reel3: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS3} {...p} />;
