/**
 * The electric selection ring, as a list of steps (the site's selected-row
 * pill, at film tempo):
 *
 *   slide  along a row — a fixed-overshoot glide, drawn with a directional
 *          shutter blur (top/bottom edges streak, the edges across the move
 *          smear out) instead of stacked outline copies
 *   pop    onto a new row / a new grid — the old ring lets go (fades, 97 %),
 *          the new one re-pops on the card (1.08 → 1, anticipation +
 *          overshoot), exactly as the site's pill does on a new row; no
 *          diagonal sweeps across the grid
 *   out    the ring releases (expands 5 % and fades) and stays hidden until
 *          the next pop
 */
import { aos, EASE, tween } from '../../lib/motion';
import { slide, type SlideOpts } from './curves';
import { centre, mixRect, type Rect } from './geometry';
import { sigmaFor } from './MotionBlur';

export type RingStep =
  | { kind: 'slide'; at: number; to: (tt: number) => Rect; opts: SlideOpts }
  | { kind: 'pop'; at: number; to: (tt: number) => Rect }
  | { kind: 'out'; at: number; dur: number; follow?: boolean };

export type RingDraw = { key: string; r: Rect; o: number; sc: number; sx: number; sy: number };

const RING_POP = { stiffness: 520, damping: 24, mass: 0.7 };
/** a 180° shutter */
const SHUTTER = 0.5;

const start = (s: RingStep) => (s.kind === 'slide' ? s.at - (s.opts.anticip ?? 0) : s.at);

function current(steps: RingStep[], tt: number): number {
  let j = -1;
  for (let i = 0; i < steps.length; i++) if (start(steps[i]) <= tt) j = i;
  return j;
}

/** Where the ring is after step j, at time tt. */
export function ringPos(steps: RingStep[], j: number, tt: number): Rect {
  const s = steps[Math.max(0, j)];
  if (j < 0 || s.kind === 'pop') return (s as Extract<RingStep, { kind: 'pop' }>).to(tt);
  if (s.kind === 'out') return ringPos(steps, j - 1, s.follow ? tt : s.at);
  const from = ringPos(steps, j - 1, s.at);
  const to = s.to(tt);
  const a = centre(from);
  const b = centre(to);
  return mixRect(from, to, slide(tt - s.at, Math.hypot(b.x - a.x, b.y - a.y), s.opts));
}

/** The ring's centre (the montage camera follows it). */
export function ringCentre(steps: RingStep[], tt: number) {
  return centre(ringPos(steps, current(steps, tt), tt));
}

function popDraw(s: Extract<RingStep, { kind: 'pop' }>, tt: number, key: string): RingDraw {
  const q = aos(tt, s.at, { anticip: 1.5, depth: 0.15, config: RING_POP });
  return {
    key,
    r: s.to(tt),
    o: tween(tt, [s.at - 1, s.at + 1.5], [0, 1], EASE.out3),
    sc: 1 + 0.08 * (1 - q),
    sx: 0,
    sy: 0,
  };
}

/** Every ring copy to draw at tt (usually one; two across a pop). */
export function ringDraws(steps: RingStep[], tt: number): RingDraw[] {
  const draws: RingDraw[] = [];
  const j = current(steps, tt);
  const next = steps[j + 1];
  const letGo = next && next.kind === 'pop' && tt >= next.at - 1 ? tween(tt, [next.at - 1, next.at + 1], [0, 1], EASE.in2) : 0;

  if (j >= 0) {
    const s = steps[j];
    if (s.kind === 'out') {
      if (s.follow) {
        // rides its card out (with the card's shutter blur) while it fades
        const q = tween(tt, [s.at, s.at + s.dur], [0, 1], EASE.inOut);
        const a = ringPos(steps, j, tt - SHUTTER);
        const bb = ringPos(steps, j, tt);
        if (q < 1)
          draws.push({
            key: `o${j}`,
            r: mixRect(a, bb, 0.5),
            o: 1 - q,
            sc: 1,
            sx: Math.min(30, sigmaFor(bb.x - a.x)),
            sy: Math.min(30, sigmaFor(bb.y - a.y)),
          });
      } else {
        const q = tween(tt, [s.at, s.at + s.dur], [0, 1], EASE.in2);
        if (q < 1) draws.push({ key: `o${j}`, r: ringPos(steps, j, tt), o: 1 - q, sc: 1 + 0.05 * q, sx: 0, sy: 0 });
      }
    } else if (s.kind === 'pop') {
      const d = popDraw(s, tt, `p${j}`);
      draws.push({ ...d, o: d.o * (1 - letGo), sc: d.sc * (1 - 0.03 * letGo) });
      // the previous ring lets go over the pop's first frame
      const prev = steps[j - 1];
      if (prev && prev.kind !== 'out' && tt < s.at + 1) {
        const q = tween(tt, [s.at - 1, s.at + 1], [0, 1], EASE.in2);
        draws.push({ key: `g${j}`, r: ringPos(steps, j - 1, s.at), o: 1 - q, sc: 1 - 0.03 * q, sx: 0, sy: 0 });
      }
    } else {
      // mid-shutter position, smeared along the move
      const a = ringPos(steps, j, Math.max(start(s), tt - SHUTTER));
      const b = ringPos(steps, j, tt);
      draws.push({
        key: `s${j}`,
        r: mixRect(a, b, 0.5),
        o: 1 - letGo,
        sc: 1 - 0.03 * letGo,
        sx: sigmaFor(b.x - a.x),
        sy: sigmaFor(b.y - a.y),
      });
    }
  }
  if (next && next.kind === 'pop' && tt >= next.at - 1) draws.push(popDraw(next, tt, `p${j + 1}`));
  return draws.filter((d) => d.o > 0.01);
}
