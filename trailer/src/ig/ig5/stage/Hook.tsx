/**
 * REEL 5 · b1 HOOK — FRAME 0 (docs/ig/ig5/HOOKS.md §1.2–1.3, SCRIPT.md b1): it must read as a scene before a word is
 * spoken. Every part is a pure function of the hook clock `t` (frame 0 = 0), so the end card's seam draws the same
 * parts at t ∈ [−14, 0) and the loop re-forms into exactly frame 0's still:
 *
 *   DeskLine   a 1.5 px graphite hairline at y 1130 drawing x 86 → 758 (EASE.draw from f −6: still moving at f0); on the
 *              pickup it is drawn INTO the light from both ends (0.4 s): its left end clears x 120 within 2 f, so no stub
 *              of it is ever left beside ours rising over it (crit-r1 P1)
 *   Phone      the rose line light Ø 18 at (740, 1130) (components/Orb LineLight), its bloom swelling as each ring leaves
 *   TrioRings  THE FRAME-0 IMAGE: three concentric rose hairlines already in flight at f0 — Ø 72 / 156 / 240, strokes
 *              3 / 2.25 / 1.5 px, ink 85 / 60 / 35 % inner to outer (the newest the brightest) — launched f −40 / −20 / 0,
 *              each born out of the light, travelling out and thinning on a LINEAR fade (the kit's quadratic one leaves
 *              an older ring at ≈ 6 % ink) and gone at age 60: the outer by f20, the middle by f40, the inner by f60;
 *              in the seam (t < 0) the rings already in flight fade in over t −10 … −2, as her orb lands on the light
 *              (crit-r1 SEAM-1 / P10: never two rings popping in round an empty point); t ≥ 0 is untouched
 *   PhoneRings the phone's later single rings (the desk law, RingPulse Ø 18 → 240) at T.M.rings, each on a beat no onset
 *              falls near: R1 in the hook (f30), one in a gap of the agency line, one before the pickup
 *   HookCard   S1 "Three rings." / "Gloves on." / "You can't." — headline 104 at x 86, rows y 400 · 528 · 656, SET at
 *              frame 0 at 72 % ink, "Three" in rose (the ringing phone's colour), each word lifting to full ink on her
 *              onset with a 1-frame rose glint; it leaves up through its masks LINE BY LINE (2 f apart, 4 f each,
 *              power3.in) from her last word + 6; in the seam it rises back into place (the Captions fork's set screen)
 */
import React from 'react';
import { reveal, revealStyle, useGlide } from '../../../components/Type';
import { EASE, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, UNIT_STAGGER } from '../../../lib/type';
import { MOMENT_LIGHTS } from '../../../kb/palettes';
import { GRAPHITE } from '../../../kb/theme';
import { useKitFaces } from '../../../kb/kit';
import { captionScreens, layoutScreen, SEAM_RISE, SET_INK, type CapPlace } from '../../components/Captions';
import { LineLight, Rings } from '../../components/Orb';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { DESK, PHONE, RING, S1, TRIO } from './layout';

const RUSH = MOMENT_LIGHTS.rush;
const M = T.M;

/* ── the desk ── */
const UNDRAW = 12;
export const DeskLine: React.FC<{ t: number }> = ({ t }) => {
  const draw = tween(t, M.deskDraw, [0, 1], EASE.draw);
  const und = t > 0 ? tween(t, [M.pickup, M.pickup + UNDRAW], [0, 1], EASE.inOut) : 0;
  // drawn: x0 → x0 + len; on the pickup both ends close on the light (x 740)
  const a = DESK.x0 + (PHONE.x - DESK.x0) * und;
  const e = DESK.x0 + (DESK.x1 - DESK.x0) * draw;
  const b = e + (PHONE.x - e) * und;
  if (b - a < 0.5) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      <line x1={a} y1={DESK.y} x2={b} y2={DESK.y} stroke={GRAPHITE.tag} strokeOpacity={0.62} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
};

/* ── the phone and its rings ── */
/** the moments a ring left the light (the trio's births, then the single rings): the light's bloom swells on each */
const TRIO_BIRTH = (TRIO.d0 - PHONE.d) / TRIO.grow;
export const RING_FLASHES = [...M.trio.map((l) => l - TRIO_BIRTH), ...M.rings] as const;

export const Phone: React.FC<{ t: number; opacity?: number }> = ({ t, opacity = 1 }) => <LineLight t={t} x={PHONE.x} y={PHONE.y} d={PHONE.d} rings={RING_FLASHES} opacity={opacity} />;

/** the seam's fade-in of the rings already in flight (1 from t −2 on: frame 0 and the 839 → 0 step are unchanged) */
export const TRIO_SEAM_IN = [-10, -2] as const;
export const TrioRings: React.FC<{ t: number }> = ({ t }) => {
  const seamIn = t < 0 ? tween(t, TRIO_SEAM_IN, [0, 1], EASE.inOut) : 1;
  if (seamIn <= 0) return null;
  const live = M.trio
    .map((l) => ({ l, age: t - l }))
    .filter(({ age }) => age > -TRIO_BIRTH && age < TRIO.life);
  if (!live.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {live.map(({ l, age }) => {
        const d = TRIO.d0 + TRIO.grow * age;
        const w = Math.min(TRIO.stroke0, TRIO.stroke0 - TRIO.strokeK * age);
        // the linear fade, a short tail to nothing over its last frames, and its birth out of the light
        const ink = TRIO.ink0 * Math.max(0, 1 - age / TRIO.inkLife) * (1 - tween(age, [TRIO.life - TRIO.tail, TRIO.life], [0, 1])) * tween(age, [-TRIO_BIRTH, -TRIO_BIRTH + 3], [0, 1], EASE.out3) * seamIn;
        const r = Math.max(0, d / 2 - w / 2);
        return <circle key={l} cx={PHONE.x} cy={PHONE.y} r={r.toFixed(3)} fill="none" stroke={RUSH.orb[2]} strokeOpacity={ink.toFixed(4)} strokeWidth={w.toFixed(3)} />;
      })}
    </svg>
  );
};

export const PhoneRings: React.FC<{ t: number }> = ({ t }) => <Rings t={t} at={M.rings} x={PHONE.x} y={PHONE.y} d0={RING.d0} d1={RING.d1} color={RUSH.orb[2]} strength={0.5} />;

/* ── S1 ── */
const tokensOf = () => captionScreens(T, T.CAST.hook)[0];
/** the card's rows: a row after every sentence's last token ("rings." / "on." / "can't.") */
function rowsOf(texts: readonly string[]): number[] {
  const out: number[] = [];
  texts.forEach((x, i) => {
    if (i < texts.length - 1 && /[.?!]$/.test(x)) out.push(i + 1);
  });
  return out;
}
export function s1Place(): CapPlace {
  const s = tokensOf();
  return { x: S1.x, y: S1.y, maxWidth: S1.maxWidth, align: 'left', role: 'headline', size: S1.size, lineHeight: S1.pitch / S1.size, rows: rowsOf(s.tokens.map((x) => x.text)) };
}
const KEY_WORD = 0; // "Three", in the phone's rose
const ROW_GAP = 2;
const ROW_OUT = 4;
/** S1's last row has left by here (S2 rises only after: one moving text at a time) */
export const s1Gone = (rows: number) => M.s1Out + (rows - 1) * ROW_GAP + ROW_OUT;

export const HookCard: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const glide = useGlide();
  if (!ready) return null;
  const s = tokensOf();
  const place = s1Place();
  const lay = layoutScreen(s.tokens, place);
  const nRows = lay.rows.length;
  if (t > s1Gone(nRows) + 1) return null;
  if (t < SEAM_RISE - 0.5) return null;
  const { font } = lay;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: font.family, fontWeight: font.weight, fontSize: font.size, lineHeight: font.lineHeight, letterSpacing: `${font.tracking}em`, fontKerning: 'normal', whiteSpace: 'nowrap' }}>
        {s.tokens.map((tk, j) => {
          const pos = lay.pos[j];
          const ex = { at: M.s1Out + pos.row * ROW_GAP, dur: ROW_OUT };
          let r = reveal(t, SEAM_RISE + j * UNIT_STAGGER, { config: SPRING.caption, rise: 80, fade: 0.5, exit: ex });
          if (t >= 0 && t < ex.at) r = { p: 1, y: 0, opacity: 1, scale: 1 };
          const base = tk.first === KEY_WORD ? RUSH.ink : GRAPHITE.text;
          const lift = SET_INK + (1 - SET_INK) * tween(t, [tk.onset - 1, tk.onset + 1], [0, 1], EASE.out3);
          // the 1-frame rose glint on her onset (the Captions fork's set screen)
          const g = t < tk.onset - 1 ? 0 : t < tk.onset ? EASE.out3(t - (tk.onset - 1)) : Math.exp(-(t - tk.onset) / 1.2);
          const col = g > 0.004 ? mixHex(base, RUSH.orb[2], 0.6 * g) : base;
          const st = revealStyle({ ...r, opacity: r.opacity * lift }, undefined, glide || t < 0 || t > ex.at - 0.5);
          return (
            <span key={j} style={{ ...maskBox(0), position: 'absolute', left: pos.x, top: lay.top + pos.row * lay.rowH }}>
              <span style={{ ...st, color: col }}>{tk.text}</span>
            </span>
          );
        })}
      </div>
      {t < M.s1Out + 2 ? <ZoneRect what="hook S1" rect={lay.rect} /> : null}
    </>
  );
};

/** frame 0's composition at hook time t (the seam draws it at t ∈ [−14, 0); `phone` false while her orb closes into it) */
export const Frame0: React.FC<{ t: number; phone?: boolean }> = ({ t, phone = true }) => (
  <>
    <DeskLine t={t} />
    <TrioRings t={t} />
    {phone ? <Phone t={t} /> : null}
    <HookCard t={t} />
  </>
);

/** the hook's text rect (for the seam's zone check and the cover) */
export const s1Rect = () => layoutScreen(tokensOf().tokens, s1Place()).rect;
