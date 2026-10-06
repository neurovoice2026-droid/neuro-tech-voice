/**
 * REEL 3 · THE TIMER CARD (docs/ig/SCRIPT.md ig3 b1–b9; §5 "TimerCard (tabular countdown, SVG arc, tug, corner chip,
 * time-lapse to HANGUP)") — the colour timer on the stylist's station, the object "Twelve minutes" names:
 *
 *   · A WHITE DISC (Ø 440, the mesh-tinted elevation) holding a 6 px progress ring and the time in Instrument Sans 600,
 *     tabular, each figure in its own fixed cell (film 1 hook/Clock's windows: a figure never changes width); a faint
 *     tick for every minute of its dial inside the ring.
 *   · THE RING is the time left on a 15-minute dial: at 12:00 it runs from 2:24 o'clock clockwise round to 12 o'clock
 *     (288°) and its free end retreats clockwise toward 12 o'clock as the time runs down. The gap past 12 o'clock is the
 *     OVER-TIME zone: a pale track that darkens to deep rose on "over-processes" (colour only, no move).
 *   · THE TIME is a pure mapping of the timeline (remainingAt): real seconds from frame 0 (12:00, 11:59 at f30 …), then
 *     from the pickup a TIME-LAPSE eased out of real time, flying through the minutes, and settling so its last four
 *     seconds tick on the last four 16ths before the hang-up — 00:00 lands exactly on HANGUP.
 *   · A FIGURE THAT CHANGES ROLLS one cell DOWN (a countdown: the smaller figure drops in from above, the old one leaves
 *     through the cell's foot) — a crisp, quick roll (power3.out) as long as the time allows: in the time-lapse's
 *     fast middle the figures swap in place, one per render frame, never smeared.
 *   · THE PAYOFF: on the hang-up the ring CLOSES (a full teal ring drawing round from 12 o'clock), the figures lift and
 *     a teal check draws under them.
 *
 * The card's pose (centre, scale, roll, shade, opacity) comes from the stage (Stage.tsx timerPose): one transform on
 * one small layer, so the type inside it glides at sub-pixel precision while it moves and is pixel-crisp at rest.
 * Every value is a pure function of the absolute timeline frame `t`.
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { mixColor } from '../../lib/lights';
import { EASE } from '../../lib/motion';
import { FONT } from '../../theme';
import { CheckMark, meshElevation, meshShadowInk } from '../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../kb/palettes';
import { GRAPHITE } from '../../kb/theme';
import { ZoneRect } from '../components/ZoneGuard';
import * as T from './timing';

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* ── the face (at full size, card px) ── */
export const FACE = {
  /** the disc */
  d: 440,
  /** the ring's radius and stroke */
  r: 198,
  stroke: 6,
  /** the figures: size, cell and colon cell (em) */
  size: 122,
  cell: 0.575,
  colon: 0.27,
  /** the dial: one full turn = 15 minutes (12:00 = 288°) */
  dialS: 15 * 60,
  /** the dial's minute ticks: from r1 out to r2, inside the ring */
  tick: { r1: 172, r2: 181 },
  /** the over-time zone: 12 o'clock → this angle (deg, clockwise) */
  over: 64,
  /** the figures' lift and the check under them in the payoff */
  lift: 30,
  check: { y: 92, size: 62 },
} as const;
const SHADOW_INK = meshShadowInk(MUTED_MESH);

/* ── the time: a pure mapping of the timeline ── */
const TM = T.TIMER;
/** the time-lapse's middle: from the pickup to the tail (cubic Hermite: real time's slope in, the tail's slope out) */
const A = TM.lapseFrom;
const B = TM.zeroAt - TM.tail * TM.tailStep;
const P0 = TM.lapseStart;
const P1 = TM.tail;
const M0 = -1 / T.FPS;
const M1 = -1 / TM.tailStep;
/** the seconds left on the timer at t (continuous, decreasing) */
export function remainingAt(t: number): number {
  if (t <= 0) return TM.start;
  if (t <= A) return TM.start - t / T.FPS;
  if (t >= TM.zeroAt) return 0;
  if (t >= B) return (TM.zeroAt - t) / TM.tailStep;
  const h = B - A;
  const s = (t - A) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * P0 + (s3 - 2 * s2 + s) * h * M0 + (-2 * s3 + 3 * s2) * P1 + (s3 - s2) * h * M1;
}
/** the whole seconds the timer SHOWS (a countdown shows the second it is in: 00:01 until it is over) */
export const shownAt = (t: number) => Math.max(0, Math.ceil(remainingAt(t) - 1e-6));
/** the frame the shown time becomes n (remainingAt = n): exact on the closed-form pieces, bisected in the middle */
export function frameOf(n: number): number {
  if (n >= TM.start) return 0;
  if (n <= 0) return TM.zeroAt;
  if (n >= P0) return (TM.start - n) * T.FPS;
  if (n <= P1) return TM.zeroAt - n * TM.tailStep;
  let lo = A;
  let hi = B;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (remainingAt(mid) > n) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const digitsOf = (n: number) => {
  const m = Math.floor(n / 60);
  const s = n % 60;
  return [Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10];
};
/** one figure cell at t: its digit, the digit it rolled from and the roll's progress (1 = at rest) */
function cellAt(t: number, k: number): { d: number; prev: number; p: number } {
  const n = shownAt(t);
  const d = digitsOf(n)[k];
  if (n >= TM.start) return { d, prev: d, p: 1 };
  // the last change of this cell: the shown time went m → m − 1 where m is the first larger time with another figure
  let m = n + 1;
  while (m < TM.start && digitsOf(m)[k] === d) m++;
  if (digitsOf(m)[k] === d) return { d, prev: d, p: 1 };
  const at = frameOf(m - 1);
  // the roll takes ≤ 5 f, and no more than 70 % of the time this figure stays (a fast lapse swaps it in place): the
  // figure's next change is when the shown time first reaches one with another figure in this cell
  let m2 = m - 2;
  while (m2 > 0 && digitsOf(m2)[k] === d) m2--;
  const next = m2 >= 0 && digitsOf(m2)[k] !== d ? frameOf(m2) : at + 30;
  const dur = Math.min(5, 0.7 * (next - at));
  if (dur < 0.75) return { d, prev: digitsOf(m)[k], p: 1 };
  const p = EASE.out3(clamp01((t - at) / dur));
  return { d, prev: digitsOf(m)[k], p };
}

/* ── the ring ── */
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: FACE.d / 2 + r * Math.cos(a), y: FACE.d / 2 + r * Math.sin(a) };
};
/** an SVG arc path, clockwise from a0 to a1 (deg from 12 o'clock) */
function arc(r: number, a0: number, a1: number): string {
  const span = Math.max(0, Math.min(359.999, a1 - a0));
  if (span <= 0.01) return '';
  const p0 = polar(r, a0);
  const p1 = polar(r, a0 + span);
  return `M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`;
}

export type TimerPose = {
  /** the card's centre on screen */
  cx: number;
  cy: number;
  /** × the full size (the corner chip ≈ .31) */
  s: number;
  /** roll (deg) — the tug */
  rot: number;
  moving: boolean;
  opacity: number;
  /** a shade over the card (stepping back) 0..1 */
  shade: number;
};

export type TimerLook = {
  /** 0 = rose (the hook) … 1 = her teal (answered) */
  teal: number;
  /** 0..1 the over-time zone darkened to deep rose */
  over: number;
  /** 0..1 the ring closing round (the payoff) */
  close: number;
  /** 0..1 the figures lifted for the check */
  lift: number;
  /** the check draws from here (absolute frame), or none */
  checkAt?: number;
  /** the time shown (default: the timeline's) */
  time?: number;
  /** a lifted shadow (the tug, the spring back) 0..1 */
  air?: number;
};

const FIG_INK = GRAPHITE.text;

export const TimerFace: React.FC<{ t: number; pose: TimerPose; look: TimerLook; zone?: boolean; what?: string }> = ({ t, pose, look, zone = true, what = 'timer card' }) => {
  if (pose.opacity <= 0.002) return null;
  const D = FACE.d;
  const F = FACE.size;
  const cw = FACE.cell * F;
  const colonW = FACE.colon * F;
  const figW = 4 * cw + colonW;
  // the ring: the time left on the dial, from its free end clockwise to 12 o'clock
  const left = look.time ?? remainingAt(t);
  const a0 = 360 * (1 - left / FACE.dialS);
  const arcInk = mixColor(RUSH.orb[2], SUNDAY.orb[2], clamp01(look.teal));
  const track = 'rgba(43, 42, 46, 0.075)';
  const overInk = mixColor('#e9e7ec', RUSH.orb[1], clamp01(look.over) * (1 - clamp01(look.teal)));
  const stroke = FACE.stroke / Math.max(0.55, Math.min(1, pose.s * 1.6));
  // the figures
  const cells = [0, 1, 2, 3].map((k) => (look.time !== undefined ? { d: digitsOf(Math.ceil(look.time))[k], prev: 0, p: 1 } : cellAt(t, k)));
  const x0 = (D - figW) / 2;
  const lift = FACE.lift * clamp01(look.lift);
  const top = D / 2 - 0.51 * F - lift;
  const cellX = (k: number) => x0 + (k < 2 ? k * cw : 2 * cw + colonW + (k - 2) * cw);
  const air = clamp01(look.air ?? 0);
  const tf = `translate(${(pose.cx - D / 2).toFixed(3)}px, ${(pose.cy - D / 2).toFixed(3)}px) rotate(${pose.rot.toFixed(4)}deg) scale(${pose.s.toFixed(5)})`;
  const figStyle: React.CSSProperties = {
    fontFamily: FONT.ui,
    fontWeight: 600,
    fontSize: F,
    lineHeight: 1,
    letterSpacing: 0,
    fontVariantNumeric: 'tabular-nums',
    fontKerning: 'normal',
    color: FIG_INK,
  };
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: D,
          height: D,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: meshElevation(3 + 2.5 * air, SHADOW_INK, 1),
          transformOrigin: '50% 50%',
          opacity: pose.opacity >= 0.999 ? undefined : pose.opacity,
          ...subpixel(tf, pose.moving),
        }}
      >
        <svg width={D} height={D} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          {/* the dial: a faint tick every minute inside the ring, 12 o'clock (zero) a touch longer */}
          {Array.from({ length: FACE.dialS / 60 }, (_, k) => {
            const a = (k * 360) / (FACE.dialS / 60);
            const zero = k === 0;
            const p0 = polar(FACE.tick.r1 - (zero ? 6 : 0), a);
            const p1 = polar(FACE.tick.r2, a);
            return <line key={k} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={GRAPHITE.text} strokeOpacity={zero ? 0.26 : 0.13} strokeWidth={zero ? 2.4 : 2} strokeLinecap="round" />;
          })}
          {/* the track, and the over-time zone past 12 o'clock */}
          <circle cx={D / 2} cy={D / 2} r={FACE.r} fill="none" stroke={track} strokeWidth={stroke} />
          {look.over > 0.002 && look.teal < 0.999 ? <path d={arc(FACE.r, 0, FACE.over)} fill="none" stroke={overInk} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {/* the time left */}
          {left > 0.01 ? <path d={arc(FACE.r, a0, 360)} fill="none" stroke={arcInk} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {/* the payoff: the ring closes round from 12 o'clock */}
          {look.close > 0.002 ? (
            look.close >= 0.999 ? (
              <circle cx={D / 2} cy={D / 2} r={FACE.r} fill="none" stroke={SUNDAY.orb[2]} strokeWidth={stroke} />
            ) : (
              <path d={arc(FACE.r, 0, 360 * look.close)} fill="none" stroke={SUNDAY.orb[2]} strokeWidth={stroke} strokeLinecap="round" />
            )
          ) : null}
        </svg>
        {/* the figures, each in its own window */}
        {cells.map((c, k) => {
          const rolling = c.p < 1;
          const H = F * 1.0;
          return (
            <div key={k} style={{ position: 'absolute', left: cellX(k), top, width: cw, height: H, overflow: 'hidden' }}>
              {rolling ? (
                <>
                  <div style={{ ...figStyle, position: 'absolute', left: 0, top: 0, width: cw, textAlign: 'center', transform: `translateY(${(c.p * H).toFixed(3)}px)`, opacity: 1 - c.p }}>{c.prev}</div>
                  <div style={{ ...figStyle, position: 'absolute', left: 0, top: 0, width: cw, textAlign: 'center', transform: `translateY(${((c.p - 1) * H).toFixed(3)}px)` }}>{c.d}</div>
                </>
              ) : (
                <div style={{ ...figStyle, position: 'absolute', left: 0, top: 0, width: cw, textAlign: 'center' }}>{c.d}</div>
              )}
            </div>
          );
        })}
        <div style={{ ...figStyle, position: 'absolute', left: x0 + 2 * cw, top: top - 0.04 * F, width: colonW, textAlign: 'center' }}>:</div>
        {/* the check under the figures (the payoff) */}
        {look.checkAt !== undefined && t >= look.checkAt - 0.5 ? (
          <div style={{ position: 'absolute', left: D / 2 - FACE.check.size / 2, top: D / 2 + FACE.check.y - FACE.check.size / 2 }}>
            <CheckMark size={FACE.check.size} t={t} at={look.checkAt} color={SUNDAY.orb[2]} stroke={2.4} />
          </div>
        ) : null}
        {pose.shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `rgba(20, 10, 36, ${pose.shade.toFixed(4)})` }} /> : null}
      </div>
      {zone && pose.opacity > 0.5 ? (
        <ZoneRect
          what={`${what} figures`}
          rect={{ x: pose.cx + (x0 - D / 2) * pose.s, y: pose.cy + (top - D / 2) * pose.s, w: figW * pose.s, h: F * pose.s }}
        />
      ) : null}
    </>
  );
};

/** the card's shown time as text ("11:52") — for labels and checks */
export const timeText = (n: number) => {
  const [a, b, c, d] = digitsOf(n);
  return `${a}${b}:${c}${d}`;
};
