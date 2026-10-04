/**
 * 16:9 · THE DAY'S COLUMN on the repeat side — b06's teleprompter of the same answer (scenes/recording/
 * Stack.tsx: the strips of "Yes, Saturdays, nine till two." in slate, each tucked over the top of the next,
 * casting its shadow on it), carried here at the half's width (× k, a static scale: the strips raster at
 * their final size) inside a window with many-stop paper fades top and bottom (a mask, the mesh shows through).
 *
 *   column      the strips flow up into the window from below, under "Some work repeats." — the work that
 *               repeats, still being repeated — then scroll at b06's reading pace
 *   firstKind   "the first kind": the scroll brakes to rest and the whole column glides up toward her orb
 *               into her light (the left title has left: the strips take its place); their shadows have
 *               taken her ground's ink as it spread under them
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { mixHex } from '../../../lib/motion';
import { typeStyle } from '../../../lib/type';
import { meshElevation, meshShadowInk } from '../../kit';
import { KB_MESH, MUTED_MESH } from '../../palettes';
import { STRIP_INK } from '../recording/Stack';
import { deskLayout } from '../repeat/desk';
import { columnAt, groundAt, type TurnStage } from './stage';

/** the pad's ruling (scenes/repeat/Slips.tsx) */
const RULE = 'rgba(20, 10, 36, 0.075)';
const LINE = 'Yes, Saturdays, nine till two.';
/** b06's strip, in its own px (recording/stage.ts column: w 940, h 130, pitch 114, pad 27; repeat/desk slip) */
const STRIP = { w: 940, h: 130, pitch: 114, pad: 27, padX: 50, size: 64, radius: 12 } as const;
const N = 12;
const INK_A = meshShadowInk(MUTED_MESH);
const INK_B = meshShadowInk(KB_MESH);

/** a many-stop smoothstep mask along y (px of the window's box): clear → opaque over [a, b], opaque → clear over [c, d] */
function fadeMask(a: number, b: number, c: number, d: number) {
  const stops: string[] = [];
  const N2 = 12;
  for (let j = 0; j <= N2; j++) {
    const u = j / N2;
    stops.push(`rgba(0,0,0,${(u * u * (3 - 2 * u)).toFixed(4)}) ${(a + (b - a) * u).toFixed(2)}px`);
  }
  for (let j = 0; j <= N2; j++) {
    const u = j / N2;
    stops.push(`rgba(0,0,0,${(1 - u * u * (3 - 2 * u)).toFixed(4)}) ${(c + (d - c) * u).toFixed(2)}px`);
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

export const Column: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const L = useLayout();
  const C = S.column;
  if (!C) return null;
  const col = columnAt(t, S, STRIP.pitch);
  if (!col.shown) return null;
  const g = deskLayout(L.vertical);
  const k = C.k;
  // the window (screen px), riding up with the column; its fades: 64 px in at the top, 70 px at the bottom
  const liftPx = Math.round(col.lift);
  const top = C.window[0] - liftPx;
  // the lift's fraction rides on the strips' own layers (the window's mask moves by whole px only)
  const frac = (col.lift - liftPx) / k;
  const H = C.window[1] - C.window[0] + 70;
  const mask = fadeMask(0, 64, H - 70, H);
  const ink = mixHex(INK_A, INK_B, groundAt(t));
  const rowH = STRIP.size * 1.18;
  const title = typeStyle('title', L.vertical, { tone: 'paper', size: g.slip.size });
  const moving = true;
  // the strips' own frame: origin at the window's top-left, scaled by k; row r's top at r·pitch − scroll + (C.top − window top)/k
  const y0 = (C.top - C.window[0]) / k;
  return (
    <div style={{ position: 'absolute', left: C.x - 40, top, width: STRIP.w * k + 80, height: H, WebkitMaskImage: mask, maskImage: mask }}>
      <div style={{ position: 'absolute', left: 40, top: 0, transformOrigin: '0 0', transform: `scale(${k.toFixed(6)})` }}>
        {Array.from({ length: N }, (_, r) => {
          const y = y0 + r * STRIP.pitch - col.scroll - frac;
          // cull outside the window
          if ((y + STRIP.h) * k < -4 || y * k > H + 4) return null;
          return (
            <div
              key={r}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: STRIP.w,
                height: STRIP.h,
                zIndex: N - r,
                borderRadius: STRIP.radius,
                background: '#ffffff',
                boxShadow: meshElevation(0.6, ink, 0.95),
                ...subpixel(`translateY(${y.toFixed(3)}px)`, moving),
              }}
            >
              <div style={{ position: 'absolute', left: STRIP.padX, right: STRIP.padX, top: STRIP.pad + rowH - STRIP.size * 0.12, height: 1.25, background: RULE }} />
              <div style={{ position: 'absolute', left: STRIP.padX, top: STRIP.pad, ...title, lineHeight: `${rowH}px`, color: STRIP_INK, whiteSpace: 'nowrap' }}>{LINE}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
