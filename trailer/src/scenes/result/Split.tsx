/**
 * The diptych's pieces:
 *   · DisplayWord — "Asleep." / "Booked." in TYPE.display (Instrument Sans,
 *     440 on the dark, −0.03em: the knowledge heading's setting), the whole
 *     word rising out of its own mask on SPRING.display — kerning intact, no
 *     blur, no glow — locking (first reaching its rest line) ON the beat. The
 *     two-tone: "Asleep." in paper, "Booked." in the scene's one accent ink
 *     (ember, lit for the dark); after it locks a band of lighter ink runs
 *     once through "Booked." (an ink sweep — crisp, not a glow)
 *   · Seam — the split: a 1.5 px paper hairline drawn edge to edge on EASE.house
 *   · Moon — the night half's light: a crisp crescent (a soft terminator, the
 *     earthshine disc just visible, a faint atmospheric halo), rising into
 *     place on a soft spring and locking on its 16th
 *   · Stars — a very sparse, sharp starfield: four points, each lit on its own
 *     16th, a slow smooth twinkle (no glints, no crosses, no glow)
 */
import React from 'react';
import { reveal, subpixel } from '../../components/Type';
import { EASE, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { FPS } from '../../timing';

/** Frames from release to an underdamped spring's first crossing of 1 (its "lock"). */
export function lockFrames(cfg: { stiffness: number; damping: number; mass: number }, fps = FPS): number {
  const w0 = Math.sqrt(cfg.stiffness / cfg.mass);
  const z = cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass));
  const wd = w0 * Math.sqrt(1 - z * z);
  const a = Math.PI - Math.atan(Math.sqrt(1 - z * z) / z);
  return (a / wd) * fps;
}
const WORD_LOCK = lockFrames(SPRING.display);
/** the moon's rise: soft, one small overshoot (ζ ≈ .78) */
const MOON = { stiffness: 120, damping: 17, mass: 1 };
const MOON_LOCK = lockFrames(MOON);

/** The word's state at t: its reveal (y %, opacity) — the spring locks ON `land`. */
export const wordReveal = (t: number, land: number) =>
  reveal(t, land - WORD_LOCK, { config: SPRING.display, rise: 100, fade: 0.5 });

/**
 * A display word, anchored at its horizontal centre + baseline (0, 0) of its box — the caller places
 * and scales it (`transform`, origin 0 0). `moving`: put it on a sub-pixel layer (slow translations only).
 */
export const DisplayWord: React.FC<{
  text: string;
  t: number;
  land: number;
  color: string;
  vertical: boolean;
  /** CSS transform placing the anchor on screen (applied with origin 0 0) */
  transform: string;
  moving: boolean;
  /** an ink sweep (hex of the lighter ink): once, left → right, starting a frame after the lock */
  sheen?: string;
}> = ({ text, t, land, color, vertical, transform, moving, sheen }) => {
  const st = typeStyle('display', vertical, { tone: 'night' });
  const size = st.fontSize as number;
  const lh = 1.04;
  // baseline below the line box's top (Instrument Sans: ascender .97, descender .25 → content 1.22 em)
  const base = ((lh - 1.22) / 2 + 0.97) * size;
  const r = wordReveal(t, land);
  if (r.opacity <= 0.001 && t < land) return null;
  const wordMoving = Math.abs(r.y) > 0.03;
  // the sweep: a lighter band from −30 % to 130 % of the word, over 14 frames after the lock
  const sw = sheen ? tween(t, [land + 1, land + 15], [0, 1], EASE.inOut) : 0;
  const ink: React.CSSProperties =
    sheen && sw > 0 && sw < 1
      ? {
          backgroundImage: `linear-gradient(100deg, ${color} ${(-30 + 160 * sw - 22).toFixed(2)}%, ${sheen} ${(-30 + 160 * sw).toFixed(2)}%, ${color} ${(-30 + 160 * sw + 22).toFixed(2)}%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }
      : { color };
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        ...subpixel(transform, moving),
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -base,
          transform: 'translateX(-50%)',
          ...st,
          lineHeight: lh,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={maskBox(0)}>
          <span
            style={{
              display: 'inline-block',
              ...subpixel(wordMoving ? `translateY(${r.y.toFixed(3)}%)` : undefined, wordMoving),
              opacity: r.opacity >= 0.999 ? undefined : Math.max(0, r.opacity),
              ...ink,
            }}
          >
            {text}
          </span>
        </span>
      </div>
    </div>
  );
};

/** The seam: a 1.5 px paper hairline, drawn from one edge of the frame to the other. */
export const Seam: React.FC<{
  t: number;
  start: number;
  dur: number;
  vertical: boolean;
  /** the seam's cross position and extent (px of its layer) */
  at: number;
  from: number;
  to: number;
}> = ({ t, start, dur, vertical, at, from, to }) => {
  const e = tween(t, [start, start + dur], [0, 1], EASE.house);
  if (e <= 0) return null;
  const span = to - from;
  const w = 1.5;
  // the line is a touch brighter while it draws (its head carries the light), then rests quiet
  const a = 0.2 + 0.14 * (1 - tween(t, [start + dur - 2, start + dur + 10], [0, 1], EASE.inOut));
  const grad = vertical
    ? `linear-gradient(180deg, rgba(237,236,241,0) 0%, rgba(237,236,241,${a.toFixed(3)}) 9%, rgba(237,236,241,${a.toFixed(3)}) 91%, rgba(237,236,241,0) 100%)`
    : `linear-gradient(90deg, rgba(237,236,241,0) 0%, rgba(237,236,241,${a.toFixed(3)}) 9%, rgba(237,236,241,${a.toFixed(3)}) 91%, rgba(237,236,241,0) 100%)`;
  return (
    <div
      style={{
        position: 'absolute',
        ...(vertical
          ? { left: at - w / 2, top: from, width: w, height: span }
          : { left: from, top: at - w / 2, width: span, height: w }),
        background: grad,
        transform: vertical ? `scaleY(${e.toFixed(5)})` : `scaleX(${e.toFixed(5)})`,
        transformOrigin: vertical ? '50% 0' : '0 50%',
      }}
    />
  );
};

/** The crescent: the lit limb (a soft terminator), the earthshine disc, a faint halo. */
export const Moon: React.FC<{
  t: number;
  x: number;
  y: number;
  d: number;
  /** lock frame (the moon rises into place and first reaches it here) */
  lock: number;
}> = ({ t, x, y, d, lock }) => {
  const start = lock - MOON_LOCK;
  if (t < start) return null;
  const p = springUnit(t - start, MOON);
  const op = smooth(0, 0.7, p);
  const dy = (1 - p) * 36;
  const H = d * 3.2;
  // the halo: the moon's light in the air round it — a gaussian, faint, no edge
  const halo: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const g = Math.exp(-5.2 * u * u) - Math.exp(-5.2);
    halo.push(`rgba(214,204,236,${(0.11 * g).toFixed(4)}) ${(u * 100).toFixed(1)}%`);
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translateY(${dy.toFixed(3)}px)`,
        opacity: op < 0.999 ? op : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: x - H / 2,
          top: y - H / 2,
          width: H,
          height: H,
          background: `radial-gradient(closest-side, ${halo.join(', ')})`,
        }}
      />
      <svg
        viewBox="0 0 200 200"
        width={d}
        height={d}
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          overflow: 'visible',
        }}
        aria-hidden
      >
        <defs>
          <radialGradient id="result-moon-lit" cx="28%" cy="72%" r="90%">
            <stop offset="0%" stopColor="#f4f0fb" />
            <stop offset="42%" stopColor="#e2dbef" />
            <stop offset="100%" stopColor="#a99fc2" />
          </radialGradient>
          <radialGradient id="result-moon-earth" cx="34%" cy="66%" r="80%">
            <stop offset="0%" stopColor="#2a2633" />
            <stop offset="100%" stopColor="#1a1820" />
          </radialGradient>
          {/* the terminator: the shadow disc's edge softened over a few px (the real moon's is never a cut) */}
          <radialGradient id="result-moon-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="93%" stopColor="#000" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>
          <mask id="result-moon-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
            <rect x="0" y="0" width="200" height="200" fill="#fff" />
            <circle cx="134" cy="76" r="84" fill="url(#result-moon-shadow)" />
          </mask>
        </defs>
        {/* the dark of the moon: a solid body (it hides the halo behind it), just lit by earthshine */}
        <circle cx="100" cy="100" r="92" fill="url(#result-moon-earth)" />
        <circle cx="100" cy="100" r="92" fill="url(#result-moon-lit)" mask="url(#result-moon-cut)" />
      </svg>
    </div>
  );
};

/** Four sharp points, each lit on its own 16th; a slow, smooth twinkle. */
export const Stars: React.FC<{
  t: number;
  stars: ReadonlyArray<{ x: number; y: number; d: number }>;
  locks: readonly number[];
}> = ({ t, stars, locks }) => (
  <>
    {stars.map((s, i) => {
      const lock = locks[i];
      if (t < lock - 3) return null;
      // it lights over 3 frames up to its 16th, then twinkles gently (each on its own slow period)
      const on = smooth(lock - 3, lock + 1, t);
      const tw = 0.82 + 0.18 * Math.cos((2 * Math.PI * (t - lock)) / (36 + 11 * i));
      const a = (0.55 + 0.35 * ((s.d - 1.6) / 1)) * on * tw;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x - s.d / 2,
            top: s.y - s.d / 2,
            width: s.d,
            height: s.d,
            borderRadius: '50%',
            background: `rgba(240,238,248,${Math.min(1, a).toFixed(3)})`,
          }}
        />
      );
    })}
  </>
);
