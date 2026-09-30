/**
 * Real text widths (2D canvas: same shaper + font files as the DOM), for
 * the status pill's width tween and the captions' line count. Trusted only
 * once the faces are loaded: `useFontsReady` holds the frame until then.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

let ctx: (CanvasRenderingContext2D & { letterSpacing?: string }) | null = null;

/** advance width of `text` in CSS font `font` with letter-spacing `trackEm` (em) */
export function textWidth(text: string, font: string, size: number, trackEm = 0): number {
  if (typeof document === 'undefined') return text.length * size * 0.55;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d') as typeof ctx;
  const c = ctx!;
  c.font = font;
  c.letterSpacing = `${(trackEm * size).toFixed(3)}px`;
  return c.measureText(text).width;
}

/** true once every face is loaded; holds the render until then */
export function useFontsReady(fonts: string[]): boolean {
  const [ready, setReady] = useState(
    () => typeof document !== 'undefined' && fonts.every((f) => document.fonts.check(f)),
  );
  const [handle] = useState(() => (ready ? null : delayRender('knowledge: font metrics')));
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
