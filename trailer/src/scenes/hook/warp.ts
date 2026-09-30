/**
 * World time for the hook. Everything that belongs to the ringing world
 * (rings, the wave, the dot, the motes) reads `warpTime`, so at the freeze
 * it decelerates over a few frames to a crawl and HANGS; the camera and the
 * type stay on real time. Pure function of the frame.
 */
import { EASE } from '../../lib/motion';

export function warpTime(f: number, at: number, easeFrames: number, rate: number): number {
  if (f <= at) return f;
  const rateAt = (g: number) => {
    const u = Math.min(1, Math.max(0, (g - at) / easeFrames));
    return rate + (1 - rate) * (1 - EASE.out3(u));
  };
  let x = at;
  const step = 0.25;
  for (let g = at; g < f; g += step) {
    const d = Math.min(step, f - g);
    x += rateAt(g + d / 2) * d;
  }
  return x;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
