/**
 * <Cursor> — a crisp vector pointer (and the I-beam over text), drawn as SVG so it is DPR-sharp at
 * 4K, with a soft contact shadow; driven entirely by kit/cursor.ts (keys → position, arc, press,
 * visibility, arrow ↔ I-beam). Draw it LAST, above the UI it works on.
 *
 *   const keys = [{ at: 0, x: 2100, y: 900, action: 'show' }, ...click(40, tab.cx, tab.cy)];
 *   <Cursor keys={keys} t={t} />
 *   const hover = hoverAt(keys, t, tabRect); const press = pressAt(keys, t, tabRect);
 *
 * The pointer is the familiar black arrow with a white keyline (it reads on white UI, on the pearl and
 * on the deep mesh alike). `size` is the arrow's height in px — at the trailer's UI scale (the app
 * ×≈2.5) a real pointer is ≈ 52 px.
 */
import React from 'react';
import { useLayout } from '../../lib/layout';
import { subpixel } from '../../lib/glide';
import { cursorAt, type CursorKey } from './cursor';

/** the arrow, tip at (0, 0), in units (≈ 19.6 tall) */
const ARROW = 'M0 0 L0 17.2 L4.1 13.4 L6.75 19.6 L9.55 18.42 L6.95 12.3 L12.4 12.3 Z';
const ARROW_H = 19.6;
/** the I-beam, centred on (0, 0) */
const IBEAM = 'M-3.3 -9.4 C-1.4 -9.4 -0.3 -8.9 0 -7.9 C0.3 -8.9 1.4 -9.4 3.3 -9.4 M0 -7.9 L0 7.9 M-3.3 9.4 C-1.4 9.4 -0.3 8.9 0 7.9 C0.3 8.9 1.4 9.4 3.3 9.4 M-1.9 0 L1.9 0';

export const Cursor: React.FC<{
  keys: readonly CursorKey[];
  /** 30 fps timeline frames */
  t: number;
  /** the arrow's height, px (default 52 / 46) */
  size?: number;
  /** the pointer's fill (default near-black) and keyline */
  fill?: string;
  line?: string;
}> = ({ keys, t, size, fill = '#0d0a14', line = '#ffffff' }) => {
  const L = useLayout();
  const s = cursorAt(keys, t);
  if (s.opacity <= 0.002) return null;
  const h = size ?? L.pick(52, 46);
  const u = h / ARROW_H;
  const box = 26 * u;
  // the pointer moves every frame it travels: on its own sub-pixel layer (lib/glide), exact at 120 fps
  const tf = `translate(${s.x.toFixed(3)}px, ${s.y.toFixed(3)}px) scale(${s.scale.toFixed(5)})`;
  const shadow = `drop-shadow(0 ${(0.07 * h).toFixed(2)}px ${(0.09 * h).toFixed(2)}px rgba(12, 6, 24, 0.30)) drop-shadow(0 ${(0.015 * h).toFixed(2)}px ${(0.02 * h).toFixed(2)}px rgba(12, 6, 24, 0.22))`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        opacity: s.opacity >= 0.999 ? undefined : s.opacity,
        transformOrigin: '0 0',
        ...subpixel(tf, true),
      }}
    >
      {s.text < 0.999 ? (
        <svg
          width={box}
          height={box}
          viewBox={`-2 -2 26 26`}
          style={{ position: 'absolute', left: -2 * u, top: -2 * u, overflow: 'visible', filter: shadow, opacity: 1 - s.text }}
          aria-hidden
        >
          {/* the keyline first (behind), then the body: a clean white rim of ≈ 1.1 units */}
          <path d={ARROW} fill={line} stroke={line} strokeWidth={2.4} strokeLinejoin="round" />
          <path d={ARROW} fill={fill} stroke={fill} strokeWidth={0.35} strokeLinejoin="round" />
        </svg>
      ) : null}
      {s.text > 0.001 ? (
        <svg
          width={box}
          height={box}
          viewBox={`-13 -13 26 26`}
          style={{ position: 'absolute', left: -13 * u, top: -13 * u, overflow: 'visible', filter: shadow, opacity: s.text }}
          aria-hidden
        >
          <path d={IBEAM} fill="none" stroke={line} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d={IBEAM} fill="none" stroke={fill} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
};
