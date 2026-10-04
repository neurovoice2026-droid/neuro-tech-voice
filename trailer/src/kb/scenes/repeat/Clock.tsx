/**
 * b01–b05 · THE DESK CLOCK with its LINE LIGHT: `TUE` over four figure windows (the #demo clock's
 * flip windows — a fork of src/scenes/hook/Clock.tsx's Window, which is not exported, driven by its own
 * exported flick curve), the colon a small rush-rose dot — the line light, the room's only light source,
 * breathing slowly — and `LINE 1` under it.
 *
 * On every ring (and every roll of b05) the figures that change ROLL forward through the real digits in
 * between, all landing ON the hit (the hour strips start earlier: they run longer), the dot pulses and
 * sends ONE hairline ring (an SVG circle: it opens by sub-pixels, no glow, no smear).
 */
import React from 'react';
import { MeshOrb } from '../../../components/MeshOrb';
import { chainPos, type Flick } from '../../../scenes/hook/Clock';
import { glideStyle, subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, tween } from '../../../lib/motion';
import { typeStyle } from '../../../lib/type';
import { C, FONT } from '../../../theme';
import { MOMENT_LIGHTS } from '../../palettes';
import { APP } from '../../kit';
import { REPEAT_LOCAL as R } from '../../timing';
import { CLOCK_TIMES, type DeskLayout } from './desk';

const RUSH = MOMENT_LIGHTS.rush;
/** the rose ring: the rush light's wave (theme LIGHTS.rush.wave rgb(219 39 119 / .45)) */
const WAVE_RGB = '219 39 119';

/** each change of the clock: on the three rings, then on the six rolls */
const EVENTS: readonly number[] = [...R.rings, ...R.rolls];
/** a window's modulus: hour tens, hour ones, minute tens, minute ones */
const MOD = [3, 10, 6, 10] as const;
const digitsOf = (s: string) => [Number(s[0]), Number(s[1]), Number(s[3]), Number(s[4])];

type WindowStrip = { cells: number[]; flicks: Flick[] };

/** Per window: the digits it passes through (each a cell) and the flicks that move it, landing on the events. */
const STRIPS: readonly WindowStrip[] = [0, 1, 2, 3].map((c) => {
  const cells = [digitsOf(CLOCK_TIMES[0])[c]];
  const flicks: Flick[] = [];
  EVENTS.forEach((at, i) => {
    const a = digitsOf(CLOCK_TIMES[i])[c];
    const b = digitsOf(CLOCK_TIMES[i + 1])[c];
    const delta = (b - a + MOD[c]) % MOD[c];
    if (!delta) return;
    for (let d = 1; d <= delta; d++) cells.push((a + d) % MOD[c]);
    // the rings: the hour strips start earlier (they run longer); the rolls of b05 spin fast on their 8th
    const ring = i < 3;
    const travel = ring ? R.flickLead.ring - [0, 0.5, 1.5, 2][c] : R.flickLead.roll;
    flicks.push({ start: at - travel, land: at, delta, wind: ring ? 0.07 : 0 });
  });
  return { cells, flicks };
});

/** The window's edges: the figures pass under a short feather, never a hard cut line. */
const WINDOW_MASK = 'linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)';

const FlipWindow: React.FC<{ strip: WindowStrip; t: number; x: number; y: number; w: number; h: number; size: number; ink: string }> = ({ strip, t, x, y, w, h, size, ink }) => {
  const pos = chainPos(t, 0, strip.flicks);
  const base = Math.floor(pos);
  const shown = [base - 1, base, base + 1, base + 2].filter((k) => k >= 0 && k < strip.cells.length);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', WebkitMaskImage: WINDOW_MASK, maskImage: WINDOW_MASK }}>
      {shown.map((k) => {
        const yy = (k - pos) * h;
        return (
          <span
            key={k}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: w,
              height: h,
              lineHeight: `${h}px`,
              fontFamily: FONT.ui,
              fontWeight: 440,
              fontSize: size,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0,
              textAlign: 'center',
              color: ink,
              // always on its own small layer: the camera pushes all act long (a plain figure would tick a
              // device pixel at a time), and a landed figure never re-rasters
              ...subpixel(`translateY(${yy.toFixed(3)}px)`, true),
            }}
          >
            {strip.cells[k]}
          </span>
        );
      })}
    </div>
  );
};

/** an alpha-function thump peaking ~2 frames after `at` (≈ 1), with a 2-frame anticipation dip */
const thump = (t: number, at: number) => {
  const x = t - at;
  if (x < -2) return 0;
  if (x <= 0) return -0.08 * Math.sin(((x + 2) / 2) * (Math.PI / 2));
  const k = x / 2;
  return k * Math.exp(1 - k);
};

/** How far a ring has travelled (power2.out over .95 s, the site's wave) */
const LIFE = 28.5;

export const DeskClock: React.FC<{ t: number; g: DeskLayout; ink?: string }> = ({ t, g, ink = APP.foreground }) => {
  const L = useLayout();
  const c = g.clock;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  // the line light: breathing slowly (a 3 s breath), a thump on every ring / roll
  const breath = 0.5 + 0.5 * Math.sin((t / 90) * Math.PI * 2 - 1.2);
  const hit = EVENTS.reduce((s, f) => s + thump(t, f), 0);
  const dotScale = 1 + 0.05 * breath + 0.55 * Math.max(-0.1, hit);
  const bloom = 0.16 + 0.05 * breath + 0.22 * Math.max(0, Math.min(1, hit));
  const halo = c.dot * 4.2;
  const rings = EVENTS.filter((f) => t >= f && t < f + LIFE);
  return (
    <>
      {/* the rings: one hairline per ring / roll, leaving the dot (behind the figures) */}
      {rings.length ? (
        <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          {rings.map((f) => {
            const age = t - f;
            const u = Math.min(1, age / LIFE);
            const e = 1 - (1 - u) * (1 - u);
            const born = tween(t, [f, f + 1.5], [0, 1], EASE.out3);
            const op = born * (1 - e);
            const d = c.dot + (L.pick(250, 240) - c.dot) * e;
            const young = Math.max(0, 1 - age / 10);
            const w = 1.5 + 1.0 * young;
            return (
              <circle
                key={f}
                cx={c.dotX}
                cy={c.dotY}
                r={Math.max(0, d / 2 - w / 2)}
                fill="none"
                stroke={`rgb(${WAVE_RGB})`}
                strokeOpacity={(Math.min(1, 0.5 + 0.25 * young) * op).toFixed(4)}
                strokeWidth={w}
              />
            );
          })}
        </svg>
      ) : null}
      {/* TUE */}
      <div style={{ position: 'absolute', left: c.x + c.cellW * 0.06, top: c.dayY, ...label, color: C.muted, whiteSpace: 'nowrap', ...glideStyle(undefined, true) }}>TUE</div>
      {/* the figures */}
      {[0, 1, 2, 3].map((i) => (
        <FlipWindow
          key={i}
          strip={STRIPS[i]}
          t={t}
          x={c.x + i * c.cellW + (i >= 2 ? 2 * c.gap + c.dot : 0)}
          y={c.y}
          w={c.cellW}
          h={c.cellH}
          size={c.size}
          ink={ink}
        />
      ))}
      {/* the colon: the rose line light — its own small bloom (a gradient, not a filter), the orb on top */}
      <div
        style={{
          position: 'absolute',
          left: c.dotX - halo / 2,
          top: c.dotY - halo / 2,
          width: halo,
          height: halo,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgb(236 72 153 / ${bloom.toFixed(4)}) 0%, rgb(236 72 153 / ${(bloom * 0.34).toFixed(4)}) 40%, rgb(236 72 153 / ${(bloom * 0.08).toFixed(4)}) 72%, rgb(236 72 153 / 0) 100%)`,
          transform: `scale(${(0.9 + 0.25 * Math.max(0, hit)).toFixed(4)})`,
        }}
      />
      <div style={{ position: 'absolute', left: c.dotX - c.dot / 2, top: c.dotY - c.dot / 2, width: c.dot, height: c.dot, transform: `scale(${dotScale.toFixed(4)})` }}>
        <MeshOrb size={c.dot} palette={RUSH.orb} time={11.4 + t / 30} />
      </div>
      {/* LINE 1, under the light it names */}
      <div style={{ position: 'absolute', left: c.dotX, top: c.lineY, ...label, color: C.muted, whiteSpace: 'nowrap', paddingLeft: '0.14em', ...glideStyle('translateX(-50%)', true) }}>
        LINE 1
      </div>
    </>
  );
};

/** The figures at time t, as text (for checks). */
export const clockText = (t: number) => {
  const i = EVENTS.filter((f) => t >= f).length;
  return CLOCK_TIMES[i];
};
