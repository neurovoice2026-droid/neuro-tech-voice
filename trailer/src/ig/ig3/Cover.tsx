/**
 * REEL 3's cover (docs/ig/SCRIPT.md ig3 §5): pearl, the kicker AI RECEPTIONIST · 03 · SALONS, the colour timer at 12:00
 * with its rose ring (Ø 400, y 330–730), the phone's rose light to its upper left with a ring travelling from it, and the title
 * "Twelve minutes / on the colour." on two rows at 128 px (y 820–1120) — all inside x 86–930.
 */
import React from 'react';
import { CoverCard } from '../components/CoverCard';
import { LineLight, RING_INK, Rings } from '../components/Orb';
import { Ground3, PHONE } from './Stage';
import { FACE, TimerFace } from './TimerCard';

const ART = { cx: 540, cy: 530, d: 400 } as const;
/** the phone's light on the cover: top-left of the timer, clear of the kicker (y 270–304), a ring travelling from it
 *  that dies short of the timer */
const DOT = { x: 168, y: 430 } as const;

export const Cover3: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    ground={<Ground3 t={0} />}
    art={
      <>
        <Rings t={10} at={[0]} x={DOT.x} y={DOT.y} d0={PHONE.d} d1={300} color={RING_INK.rush} strength={0.5} />
        <LineLight t={0} x={DOT.x} y={DOT.y} d={PHONE.d} rings={[0]} />
        <TimerFace t={0} pose={{ cx: ART.cx, cy: ART.cy, s: ART.d / FACE.d, rot: 0, moving: false, opacity: 1, shade: 0 }} look={{ teal: 0, over: 0, close: 0, lift: 0 }} what="cover timer" />
      </>
    }
    spec={{
      reel: 'ig3',
      night: false,
      kicker: 'AI receptionist · 03 · salons',
      title: 'Twelve minutes on the colour.',
      // two rows (SCRIPT ig3 §5): fitted to 844 px by the framework
      rows: [2],
      size: 128,
      titleY: 820,
    }}
  />
);
