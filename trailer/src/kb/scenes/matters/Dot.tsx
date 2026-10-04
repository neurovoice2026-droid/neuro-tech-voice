/**
 * b15–b16 · AVA'S TEAL DOT — the clock's colon is now her small light (SCRIPT.md b15: "Its colon is now Ava's small
 * teal dot (MeshOrb) instead of the rose line light"): the site's mesh orb in her sunday palette with its own small
 * bloom (a gradient, never a filter), breathing slowly (b01's 3 s breath).
 *
 *   ring     the line rings once: one hairline teal ring leaves the dot (an SVG circle — it opens by sub-pixels,
 *            no glow, no smear), a small thump
 *   pickup   a 16th later she takes the call: a second, softer thump (her soft pickup tone)
 *   b16      9:16: it rises off the clock above the title (stage.ts dotAt)
 *   dark     the room goes dark around it and it becomes the key light: its bloom opens a little — the light
 *            on the ground is the mesh's own key pool (Matters.tsx), not a halo
 *
 * Drawn over everything (screen px), so it outlives the clock and the darkness.
 */
import React from 'react';
import { MeshOrb } from '../../../components/MeshOrb';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, tween } from '../../../lib/motion';
import { MOMENT_LIGHTS } from '../../palettes';
import { MATTERS_LOCAL as M } from '../../timing';
import { darkness, dotAt, type MattersLayout } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** her light (the sunday orb's body, #22b8cf) and the ring's ink (theme LIGHTS.sunday.wave rgb(10 138 168 / .45)) */
const BODY = '34 184 207';
const WAVE = '10 138 168';
/** how long a ring travels (b01's: power2.out over .95 s) */
const LIFE = 28.5;

/** an alpha-function thump peaking ~2 frames after `at`, with a 2-frame anticipation dip (b01's) */
const thump = (t: number, at: number) => {
  const x = t - at;
  if (x < -2) return 0;
  if (x <= 0) return -0.08 * Math.sin(((x + 2) / 2) * (Math.PI / 2));
  const k = x / 2;
  return k * Math.exp(1 - k);
};

/** The ring: one hairline leaving the dot on the line's ring — drawn BEHIND the clock's figures (b01's rings). */
export const TealRing: React.FC<{ t: number; g: MattersLayout }> = ({ t, g }) => {
  const L = useLayout();
  const p = dotAt(t, g.vertical);
  const d = g.clock.dot * p.z;
  const age = t - M.ring;
  const ring = age >= 0 && age < LIFE;
  let ringEl: React.ReactNode = null;
  if (ring) {
    const u = Math.min(1, age / LIFE);
    const e = 1 - (1 - u) * (1 - u);
    const born = tween(t, [M.ring, M.ring + 1.5], [0, 1], EASE.out3);
    const op = born * (1 - e);
    const dia = d + (L.pick(250, 240) - d) * e;
    const young = Math.max(0, 1 - age / 10);
    const w = 1.5 + 1.0 * young;
    ringEl = (
      <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <circle cx={p.x} cy={p.y} r={Math.max(0, dia / 2 - w / 2)} fill="none" stroke={`rgb(${WAVE})`} strokeOpacity={(Math.min(1, 0.55 + 0.25 * young) * op).toFixed(4)} strokeWidth={w} />
      </svg>
    );
  }
  return <>{ringEl}</>;
};

export const TealDot: React.FC<{ t: number; g: MattersLayout }> = ({ t, g }) => {
  const p = dotAt(t, g.vertical);
  const d = g.clock.dot * p.z;
  const dark = darkness(t);
  const breath = 0.5 + 0.5 * Math.sin((t / 90) * Math.PI * 2 - 1.2);
  const hit = thump(t, M.ring) + 0.45 * thump(t, M.pickup);
  const dotScale = 1 + 0.05 * breath + 0.42 * Math.max(-0.1, hit) + 0.12 * dark;
  const bloom = 0.17 + 0.05 * breath + 0.22 * Math.max(0, Math.min(1, hit)) + 0.12 * dark;
  const halo = d * (4.2 + 1.4 * dark);
  return (
    <>
      {/* positioned by transform on its own small layer: it glides sub-pixel under the push and the rise */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: halo,
          height: halo,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgb(${BODY} / ${bloom.toFixed(4)}) 0%, rgb(${BODY} / ${(bloom * 0.34).toFixed(4)}) 40%, rgb(${BODY} / ${(bloom * 0.08).toFixed(4)}) 72%, rgb(${BODY} / 0) 100%)`,
          ...subpixel(`translate(${(p.x - halo / 2).toFixed(3)}px, ${(p.y - halo / 2).toFixed(3)}px) scale(${(0.9 + 0.25 * Math.max(0, hit)).toFixed(4)})`, true),
        }}
      />
      <div style={{ position: 'absolute', left: 0, top: 0, width: d, height: d, ...subpixel(`translate(${(p.x - d / 2).toFixed(3)}px, ${(p.y - d / 2).toFixed(3)}px) scale(${dotScale.toFixed(4)})`, true) }}>
        <MeshOrb size={d} palette={SUNDAY.orb} time={7.2 + t / 30} />
      </div>
    </>
  );
};
