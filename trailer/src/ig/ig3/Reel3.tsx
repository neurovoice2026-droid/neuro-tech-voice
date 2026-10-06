/**
 * REEL 3 — the acts on the reel's timeline (src/ig/ig3/timing.ts). Every act but the shared end card is still a placeholder title card
 * (components/TitleCard.tsx); each is replaced by its built act (src/ig/ig3/acts/*.tsx) in build step 6.
 */
import React from 'react';
import { titleCard } from '../components/TitleCard';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { endAct } from '../components/End';
import { PearlGround } from '../components/Ground';
import * as T from './timing';

/** the shared end card (components/End.tsx) on the reel's ground; its backdrop, orb and frame-0 seam come with the reel's acts */
const BUILT: { readonly [key: string]: React.FC } = { end: endAct(T, { tone: 'pearl', ground: (tm) => <PearlGround t={tm} /> }) };

export const ACTS3: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, BUILT[k] ?? titleCard(T, k)]));

export const Reel3: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS3} {...p} />;
