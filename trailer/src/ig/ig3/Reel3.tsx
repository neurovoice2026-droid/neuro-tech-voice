/**
 * REEL 3 · "Twelve minutes" (salons) — the acts on the reel's timeline (src/ig/ig3/timing.ts; docs/ig/SCRIPT.md ig3):
 * acts/Acts.tsx (hook · call · payoff · end), drawn from the stage parts in Stage.tsx and TimerCard.tsx.
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { Call3, End3, Hook3, Payoff3 } from './acts/Acts';
import * as T from './timing';

export const ACTS3: { readonly [key: string]: React.FC } = { hook: Hook3, call: Call3, payoff: Payoff3, end: End3 };

export const Reel3: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS3} {...p} />;
