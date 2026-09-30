/**
 * Real font metrics for the mark → card morph, so the two type settings
 * (the call's mark: Inter 500; the card row: Instrument Sans 520) can be
 * registered word by word before they cross-fade.
 *
 * Measured with a 2D canvas (same shaper + font files as the DOM). The
 * numbers are only trusted once the faces are loaded: `useFontsReady`
 * holds the frame (delayRender) until they are, then re-renders.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export type FontSpec = {
  family: string;
  weight: number;
  size: number;
  /** letter-spacing in em */
  track: number;
  /** CSS line-height (unitless) */
  lh: number;
};

export const cssFont = (f: FontSpec) => `${f.weight} ${f.size}px ${f.family}`;

let ctx: (CanvasRenderingContext2D & { letterSpacing?: string }) | null = null;

export type Metrics = {
  /** advance width (letter-spacing included, as CSS lays it out) */
  w: number;
  /** offset of the cap-height centre from the line box's centre (px, + = down) */
  capOff: number;
};

export function measure(text: string, f: FontSpec): Metrics {
  if (typeof document === 'undefined') return { w: text.length * f.size * 0.55, capOff: 0 };
  if (!ctx) ctx = document.createElement('canvas').getContext('2d') as typeof ctx;
  const c = ctx!;
  c.font = cssFont(f);
  c.letterSpacing = `${(f.track * f.size).toFixed(3)}px`;
  const m = c.measureText(text);
  const cap = c.measureText('H').actualBoundingBoxAscent;
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  const box = f.lh * f.size;
  const baseline = (box - (asc + desc)) / 2 + asc; // from the box top
  return { w: m.width, capOff: baseline - cap / 2 - box / 2 };
}

/** true once every face is loaded; holds the render until then. */
export function useFontsReady(fonts: string[]): boolean {
  const [ready, setReady] = useState(
    () => typeof document !== 'undefined' && fonts.every((f) => document.fonts.check(f)),
  );
  const [handle] = useState(() => (ready ? null : delayRender('result: font metrics')));
  useEffect(() => {
    if (ready) return;
    let live = true;
    const done = () => live && setReady(true);
    Promise.all(fonts.map((f) => document.fonts.load(f))).then(done, done);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready && handle !== null) continueRender(handle);
  }, [ready, handle]);
  return ready;
}
