/**
 * REEL 6 · "One ring" — THE ACTS (docs/ig/ig6/SCRIPT.md §4: hook · wait · missed · pickup · day · words · ring · end),
 * PROVISIONAL: every act but the end is ig6's placeholder title card on white (./Placeholder.tsx: the act, its window,
 * the hook rung, the lines placed in it, and the lockup of the moment in the reel's real faces at its STYLE §9.8 place);
 * the end is the End6 stub (stage/End6.tsx: the shared card on white, SCRIPT §8's fallback).
 *
 * The scene build replaces the entries of ACTS6 one by one (each a React.FC mounted in its act's <Sequence>) — STYLE §9.1:
 * the eight acts on one continuous stage (stage/Camera, Dial, Hand, Lockup, Transitions) and the white End6.
 */
import React from 'react';
import { End6 } from '../stage/End6';
import * as T from '../timing';
import { placeholderAct } from './Placeholder';

const BUILT: { readonly [key: string]: React.FC } = { end: End6 };

export const ACTS6: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, BUILT[k] ?? placeholderAct(k)]));
