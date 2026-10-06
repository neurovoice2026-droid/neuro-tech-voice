/**
 * REEL 1 · "Not even ours" — the acts on the reel's timeline (src/ig/ig1/timing.ts, docs/ig/SCRIPT.md ig1): b1–b5 are
 * one continuous stage (acts/Stage.tsx: frame 0's composition, the week grid, the call records, her orb, the captions),
 * mounted by each act's <Sequence> at its own frames; b6–b8 are the shared end card over the week (acts/End.tsx).
 */
import React from 'react';
import { IgReel } from '../Reel';
import type { ReelProps } from '../types';
import { Ig1End } from './acts/End';
import { stageAct } from './acts/Stage';
import * as T from './timing';

export const ACTS1: { readonly [key: string]: React.FC } = {
  hook: stageAct('hook'),
  hours: stageAct('hours'),
  shift: stageAct('shift'),
  does: stageAct('does'),
  desk: stageAct('desk'),
  end: Ig1End,
};

export const Reel1: React.FC<ReelProps> = (p) => <IgReel T={T} acts={ACTS1} {...p} />;
