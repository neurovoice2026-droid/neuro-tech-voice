/**
 * REEL 3 · THE STAGE — every part of "Twelve minutes" as a pure function of the ABSOLUTE timeline frame `t`, so every act
 * (each in its own <Sequence>, Reel3.tsx) and the end card's seam draw exactly the same picture at the same frame:
 *
 *   Ground3       the pearl (MUTED_MESH) lit by the light in frame: the phone's rose pool top-left (b1–b2, dimming with
 *                 the caller giving up), her teal at the orb from the pickup, a teal pool behind the timer at the payoff
 *   timerPose     the card: centred (b1), the TUG toward the phone on "up" (one move, back over .5 s); it STAYS THE HERO
 *                 through the greeting (centred, full size, time-lapsing over her rows — viewers wait for zero), STEPS
 *                 ASIDE to the top right (Ø 280) in the caller's turn to clear the stage for the page, reads 00:00 there
 *                 on the hang-up and SPRINGS BACK to centre at full size once the call has left; the end card's step
 *                 back (up, × .6, shaded), gone before the hit
 *   Ig3Frame0     FRAME 0's composition (also re-formed by the end card's seam at t − END ∈ [−14, 0)): the phone's rose
 *                 line light ringing (PhoneRings: a pair of rose hairlines already in flight, reaching across the room
 *                 toward the timer and dying short of it), the timer at 12:00 with its rose ring (its first figure rolls
 *                 on f15), S1 "Twelve minutes / on the colour." set at 72 %
 *   CallStrip     the call (b3–b5, a fork-free use of the shared LiveTranscript): ● AVA rows word-synced (they ARE the
 *                 captions), in the lower stage where the narrator's captions were; the caller's turn a level meter
 *                 (five slate bars at the type's size) — scrolling by rows
 *   ServicesPage  the salon's own list (b5), in the middle stage once the timer has stepped aside: kind token PDF,
 *                 "Services", three lines as 44 px objects, the dashboard's "Looked it up in your documents" beside the
 *                 heading (riding in with the page), a teal sweep under the Trim line; on the end card it rises again,
 *                 × .88, under the comment field on "price list." (END_PAGE)
 *   RecordCard    the call filed (b6): TRANSCRIPT over her answer's line (28 px, the dashboard's transcript), the
 *                 Answered pill
 *   Orb3          her orb: the dimmed phone light springs open into it on the pickup (film 2's birth), at rest on
 *                 "looked up", closing back into the phone's light in the seam
 */
import React from 'react';
import { mixColor } from '../../lib/lights';
import { EASE, mix, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { subpixel } from '../../lib/glide';
import { TYPE } from '../../theme';
import { APP, InkSweep, measureText, meshElevation, meshShadowInk, typo, ui, useKitFaces, W } from '../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../kb/palettes';
import { LiveTranscript, ToolRow, type Turn } from '../components/Call';
import { CAP_OUT, Captions, captionScreens, SEAM_RISE, type CapPlace, type CapTiming } from '../components/Captions';
import { endGroundKey } from '../components/End';
import { AvaOrb, LineLight, orbTrack, RING_INK, Rings } from '../components/Orb';
import { PearlGround } from '../components/Ground';
import { OutcomePill, outcomePillSize } from '../components/OutcomePill';
import { ZoneRect } from '../components/ZoneGuard';
import { FACE, TimerFace, type TimerLook, type TimerPose } from './TimerCard';
import * as T from './timing';

const M = T.M;
const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
const SHADOW_INK = meshShadowInk(MUTED_MESH);

/* ── the places (frame px; SCRIPT.md ig3 §4–5) ── */
/** the phone across the room: the rose line light */
export const PHONE = { x: 150, y: 300, d: 22 } as const;
/** her orb, born out of it (SCRIPT: Ø 200 at (220, 340); set 30 px left so her edge stands on the strip's x 86 column,
 *  her top on the label band's edge) */
export const ORB = { x: 190, y: 340, d: 200 } as const;
/** the timer: centred in b1 and through the greeting (Ø 440, x 320–760, y 420–860); stepped aside for the page (Ø 280,
 *  x 604–884, y 256–536: above y 900, so clear of the rail); the payoff */
export const TIMER = { cx: 540, cy: 640 } as const;
export const ASIDE = { cx: 744, cy: 396, s: 280 / FACE.d } as const;
export const PAYOFF = { cx: 540, cy: 630 } as const;
/** the end card: the done timer stepped up and back above the CTA */
export const BACK = { cx: 540, cy: 446, s: 0.6, shade: 0.06 } as const;
/** the narrator's captions (b1, b2, b6): headline 92, left at x 86, from y 1080, ≤ 820 */
export const NARRATOR: CapPlace = { x: 86, y: 1080, maxWidth: 820, align: 'left', role: 'headline', size: 92, lineHeight: 1.06 };

/* ── the ground's light ── */
const HOOK_KEY = { x: PHONE.x, y: PHONE.y, strength: 0.34, color: '#ffd3e8', radius: 860 } as const;
const CALL_KEY = { x: ORB.x, y: ORB.y, strength: 0.3, color: '#c6eef5', radius: 820 } as const;
const PAY_KEY = { x: PAYOFF.cx, y: PAYOFF.cy, strength: 0.3, color: '#c2edf4', radius: 1000 } as const;
type Key = { x: number; y: number; strength: number; color: string; radius: number };
const mixKey = (a: Key, b: Key, k: number): Key => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), strength: mix(a.strength, b.strength, k), color: mixHex(a.color, b.color, k), radius: mix(a.radius, b.radius, k) });
export function groundKey(t: number): Key {
  // the caller giving up: the phone's pool fades with its light
  const give = tween(t, [M.giveUp, M.giveUp + 12], [0, 1], EASE.inOut);
  let k: Key = { ...HOOK_KEY, strength: HOOK_KEY.strength * (1 - 0.45 * give) };
  k = mixKey(k, CALL_KEY, tween(t, [M.birth, M.birth + 12], [0, 1], EASE.inOut));
  k = mixKey(k, PAY_KEY, tween(t, [T.HANGUP, T.HANGUP + 24], [0, 1], EASE.inOut));
  return k;
}
export const Ground3: React.FC<{ t: number; keyLight?: Key }> = ({ t, keyLight }) => <PearlGround t={t} keyLight={keyLight ?? groundKey(t)} />;
/** the impact's flash on the ground (its mesh key): her teal pool thrown wide on the bar, settling into the card's light
 *  (ig1's card, the same numbers: the hit lands as light on the pearl, not as a fade) */
const FLASH = { strength: 0.42, tau: 7, color: '#8fdfec', radius: 760 } as const;
/** the end card's ground: the payoff's teal handing over to the backlight's light, the bar's flash; frame 0's (tm < 0) is
 *  the hook's */
export function endGround(tm: number) {
  if (tm < 0) return <Ground3 t={tm} />;
  const a = groundKey(tm);
  const key = endGroundKey(T, tm, false);
  const I = T.END_CARD.impact;
  const fl = tm < I - 1 ? 0 : FLASH.strength * Math.min(1, tm - (I - 1)) * Math.exp(-Math.max(0, tm - I) / FLASH.tau);
  const k = Math.min(1, key.strength / 0.3 + fl / FLASH.strength);
  const kc = key.strength > 0.001 ? key.color : FLASH.color;
  const f = fl / FLASH.strength;
  return (
    <Ground3
      t={tm}
      keyLight={
        k > 0.001
          ? { x: mix(a.x, key.x, k), y: mix(a.y, key.y, k), strength: mix(a.strength, key.strength + 0.12 * f, k) + fl, color: mixColor(a.color, mixColor(kc, FLASH.color, f), k), radius: mix(a.radius, mix(900, FLASH.radius, f), k) }
          : a
      }
    />
  );
}

/* ── the timer's pose and look ── */
export function timerPose(t: number): TimerPose & { air: number } {
  let cx: number = TIMER.cx;
  let cy: number = TIMER.cy;
  let s = 1;
  let rot = 0;
  let air = 0;
  let shade = 0;
  let opacity = 1;
  let moving = false;
  // the seam: frame 0's card rises back into place (the caption spring from SEAM_RISE, as the set caption does)
  if (t < 0) {
    const r = springUnit(t - SEAM_RISE, SPRING.caption);
    cy += (1 - r) * 64;
    s = mix(0.95, 1, Math.min(1, r));
    opacity = smooth(0, 0.5, r);
    return { cx, cy, s, rot, air, shade, opacity, moving: true };
  }
  // b2 "Pick it up,": the tug — one move toward the phone (−40, −28, −1.5°) on the site's spring, back over .5 s
  if (t > M.tug) {
    const k = springUnit(t - M.tug, SPRING.site) * (1 - tween(t, [M.tug + 5, M.tug + 20], [0, 1], EASE.inOut));
    cx += -40 * k;
    cy += -28 * k;
    rot += -1.5 * k;
    air = Math.max(air, k);
    moving = moving || t < M.tug + 22;
  }
  // b4 the caller's turn: it steps up and aside to the top right (the page will take the middle stage)
  const g = tween(t, M.aside, [0, 1], EASE.inOut);
  if (g > 0) {
    cx = mix(cx, ASIDE.cx, g);
    cy = mix(cy, ASIDE.cy, g);
    s = mix(s, ASIDE.s, g);
    moving = moving || g < 1;
  }
  // b6 00:00 on the hang-up where it stands; it springs back to centre at full size once the call has left
  if (t >= M.back) {
    const u = springUnit(t - M.back, SPRING.site);
    cx = mix(ASIDE.cx, PAYOFF.cx, u);
    cy = mix(ASIDE.cy, PAYOFF.cy, u);
    s = mix(ASIDE.s, 1, u);
    air = Math.max(0, 1 - (t - M.back) / 14);
    moving = t < M.back + 34;
  }
  // the end card: up and back above the CTA, shaded; gone before the hit
  const e = tween(t, [T.END_CARD.cta - 10, T.END_CARD.cta + 10], [0, 1], EASE.inOut);
  if (e > 0) {
    cx = mix(cx, BACK.cx, e);
    cy = mix(cy, BACK.cy, e);
    s = mix(s, BACK.s, e);
    shade = BACK.shade * e;
    moving = moving || e < 1;
  }
  opacity *= 1 - tween(t, [T.IMPACT - 6, T.IMPACT + 1], [0, 1], EASE.in3);
  return { cx, cy, s, rot, air, shade, opacity, moving };
}
/** the ticks of the time-lapse (8ths, then 16ths): the fast-forward mark pulses on them */
const LAPSE_TICKS = [...M.eighths, ...M.sixteenths];
export function timerLook(t: number): TimerLook {
  let last = -Infinity;
  for (const f of LAPSE_TICKS) if (f <= t) last = f;
  return {
    teal: tween(t, [T.PICKUP, T.PICKUP + 8], [0, 1], EASE.inOut),
    over: tween(t, [M.over - 1, M.over + 5], [0, 1], EASE.inOut),
    close: tween(t, [T.HANGUP + 1, T.HANGUP + 13], [0, 1], EASE.out3),
    lift: tween(t, [M.back, M.back + 10], [0, 1], EASE.inOut),
    checkAt: t >= T.HANGUP ? M.check : undefined,
    air: timerPose(t).air,
    ff: tween(t, [T.PICKUP + 2, T.PICKUP + 10], [0, 1], EASE.inOut) * (1 - tween(t, [T.HANGUP - 1, T.HANGUP + 3], [0, 1], EASE.inOut)),
    ffPulse: Number.isFinite(last) ? Math.exp(-(t - last) / 2.5) : 0,
  };
}
/** as the ring closes and the timer settles, one teal hairline leaves the disc's rim (her ring of the birth, answered) */
const DONE_RING = M.back + 12;
export const Timer3: React.FC<{ t: number }> = ({ t }) => (
  <>
    {t >= DONE_RING && t < DONE_RING + 30 ? <Rings t={t} at={[DONE_RING]} x={PAYOFF.cx} y={PAYOFF.cy} d0={FACE.d} d1={FACE.d * 1.5} color={SUNDAY.orb[2]} strength={0.4} /> : null}
    <TimerFace t={t} pose={timerPose(t)} look={timerLook(t)} />
  </>
);

/* ── the captions: screens inside a line hand over without a blank frame ── */
/** a line's caption timing with each screen leaving as the next rises: its exit (power3.in over CAP_OUT) starts 1.75 f
 *  before the next one's rise, so its last visible 120 fps frames meet the newcomer's first (measured: the old words are
 *  gone ≈ 3.75 f into their exit, the new ones show ≈ 1.75 f into their rise) — no empty frame between them (SCRIPT.md
 *  §0.3); `nudge` moves a word's onset where the aligner's stamp is off her energy */
const CAP_HANDOVER = 1.75;
function handover(id: string, base: CapTiming = {}): CapTiming {
  const sc = captionScreens(T, id, base);
  const exits: Record<number, number> = { ...(base.exits ?? {}) };
  sc.forEach((x, k) => {
    const nx = sc[k + 1];
    if (nx && !nx.set0 && Number.isFinite(nx.from) && exits[k] === undefined) exits[k] = Math.max(x.lastOnset + 4, nx.from - CAP_HANDOVER);
  });
  return { ...base, exits };
}
const HOOK_TIMING = handover('ig3-01');
const PULL_TIMING = handover('ig3-02', { exitAt: T.PICKUP });
/** "You never looked up.": her "You" starts 2 f before its stamp (the take's energy rises at its f66, stamped 68.2) */
const PAY_TIMING = handover('ig3-05', { nudge: { 4: -2 } });

/* ── the phone ringing across the room: a pair of rose hairlines per ring, reaching toward the timer ── */
/** each ring: a 3 px rose hairline thinning to 1 px as it travels out (ease-out) to just short of the timer's rim, its
 *  echo 5 f behind it fainter; ≈ 1.1 s of life, so a ring is in flight through most of each second it rings in */
const PHONE_RING = { life: 34, r1: 286, echo: 5, a: [0.82, 0.5] } as const;
export const PhoneRings: React.FC<{ t: number; at: readonly number[]; x?: number; y?: number; r1?: number }> = ({ t, at, x = PHONE.x, y = PHONE.y, r1 = PHONE_RING.r1 }) => {
  const live = at.flatMap((s0) => [0, 1].map((k) => ({ s: s0 + k * PHONE_RING.echo, k }))).filter(({ s: s1 }) => t >= s1 && t < s1 + PHONE_RING.life);
  if (!live.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {live.map(({ s: s1, k }) => {
        const u = Math.min(1, Math.max(0, (t - s1) / PHONE_RING.life));
        const e = 1 - Math.pow(1 - u, 2.4);
        const born = Math.min(1, (t - s1) / 1.5);
        const w = (k ? 2 : 3) - (k ? 1 : 1.8) * u;
        const a = PHONE_RING.a[k] * born * Math.pow(1 - u, 1.25);
        const r = PHONE.d / 2 + (r1 - PHONE.d / 2) * e;
        return <circle key={`${s1}-${k}`} cx={x} cy={y} r={r} fill="none" stroke={RING_INK.rush} strokeOpacity={a.toFixed(4)} strokeWidth={w.toFixed(3)} />;
      })}
    </svg>
  );
};

/* ── frame 0 ── */
/** S1 "Twelve minutes / on the colour.", S2 "You can't touch / the phone." ("phone" taking the phone's rose) */
const HOOK_PLACE = (k: number): CapPlace => ({ ...NARRATOR, rows: k === 0 ? [2] : [3] });
const HOOK_KEYS = [{ words: [9], ink: RUSH.ink, glint: RUSH.orb[2] }] as const;
/** S3 "Pick it up, / the colour / over-processes." ("over-processes." darkening with the arc), S4 balanced */
const PULL_PLACE = (k: number): CapPlace => ({ ...NARRATOR, rows: k === 0 ? [3, 5] : undefined });
const PULL_KEYS = [{ words: [5], ink: RUSH.ink, glint: RUSH.orb[1] }] as const;
/** the phone's light: dimming to rest on "elsewhere." (the caller giving up) */
const dimAt = (t: number) => tween(t, [M.giveUp, M.giveUp + 12], [0, 1], EASE.inOut);

/** Frame 0's composition at hook time t (frame 0 = t 0; the seam draws it at t ∈ [−14, 0) with `dot` off: her
 *  closing orb is the dot then). */
export const Ig3Frame0: React.FC<{ t: number; dot?: boolean }> = ({ t, dot = true }) => (
  <>
    <PhoneRings t={t} at={T.VIS_RINGS} />
    {dot && t < M.birth + 0.5 ? <LineLight t={t} x={PHONE.x} y={PHONE.y} d={PHONE.d} dim={dimAt(t)} rings={T.VIS_RINGS} /> : null}
    <Timer3 t={t} />
    <Captions T={T} id="ig3-01" t={t} place={HOOK_PLACE} keys={HOOK_KEYS} glint={RUSH.orb[2]} timing={HOOK_TIMING} what="hook" />
  </>
);
/** the dilemma's captions (b2): they leave on the pickup (the click answers the ring) */
export const PullCaptions: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig3-02" t={t} place={PULL_PLACE} keys={PULL_KEYS} timing={PULL_TIMING} what="dilemma" />;

/* ── her orb ── */
const track = () => orbTrack(T, { listen: T.CALLERS.map(([a, b]) => [a, b] as const) });
/** where she is: born at the phone's light, opening out to her place; back to the phone's light in the seam */
/** her size as AvaOrb draws it (the birth's SPRING.pop out of the dot, the close back into it in the seam) */
const CLOSE = { at: T.END_CARD.seam + 2, dur: T.DURATION - 4 - T.END_CARD.seam } as const;
function orbSize(t: number): number {
  if (t < M.birth) return PHONE.d;
  const d0 = PHONE.d * 1.08;
  let d = d0 + (ORB.d - d0) * springUnit(t - M.birth, SPRING.pop);
  if (t > CLOSE.at) d += (PHONE.d - d) * EASE.inOut(Math.min(1, (t - CLOSE.at) / CLOSE.dur));
  return d;
}
/** where she is: born at the phone's light, opening out to her place; back to the phone's light in the seam — her top
 *  never above the label band (y 240) while she opens out of the dot (the birth's overshoot pushes her down, not up) */
export function orbPose(t: number): { x: number; y: number; d: number; moving: boolean } {
  const g = tween(t, [M.birth, M.birth + 16], [0, 1], EASE.inOut);
  const back = tween(t, [T.END_CARD.seam, T.DURATION - 2], [0, 1], EASE.inOut);
  const x = mix(mix(PHONE.x, ORB.x, g), PHONE.x, back);
  const y = Math.max(mix(mix(PHONE.y, ORB.y, g), PHONE.y, back), 240 + orbSize(t) / 2);
  return { x, y, d: ORB.d, moving: (g > 0 && g < 1) || (back > 0 && back < 1) || (t >= M.birth && t < M.birth + 20) };
}
export const Orb3: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.birth) return null;
  // "You never looked up.": she rests — and wakes again as she starts the CTA
  const rest = tween(t, [M.looked, M.looked + 14], [0, 1], EASE.inOut) * (1 - tween(t, [T.END_CARD.cta - 4, T.END_CARD.cta + 10], [0, 1], EASE.inOut));
  return (
    <AvaOrb
      t={t}
      pose={orbPose(t)}
      canvas={ORB.d}
      track={track()}
      born={{ at: M.birth, dot: PHONE.d }}
      opacity={1 - 0.4 * rest}
      shadow={0.25}
      close={{ at: CLOSE.at, dur: CLOSE.dur, dot: PHONE.d, t0: T.DURATION, rings: T.VIS_RINGS }}
    />
  );
};

/* ── the call strip ── */
/** the call strip in the lower stage, where the narrator's captions were (rows of title 64 under their ● tags, 30 px of
 *  air between tag and words; the answer on its three phrases); the caller's meter at the type's size (five slate bars
 *  16 × ≤ 64 px, its envelope × 1.9), so the turn reads as a turn */
export const STRIP = { x: 86, y: 960, w: 820, h: 460, size: 64, tagGap: 30, rowGap: 28, meter: { bars: 5, barW: 16, maxH: 64, gap: 11, gain: 1.9 } } as const;
const TURNS: Turn[] = [
  // "for" and "calling." share one stamp (264): the take puts "for" at its f8 and "calling." at its f12
  { who: 'ava', id: 'ig3-03', breaks: [3], nudge: { 1: -3, 2: 1 }, keys: [{ words: [6, 7, 8], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
  { who: 'caller', from: T.CALLERS[0][0], to: T.CALLERS[0][1] },
  // "to" and "Saturday." share one stamp (471): the take puts "to" 5 f earlier
  { who: 'ava', id: 'ig3-04', breaks: [3, 5], nudge: { 6: -5 }, keys: [{ words: [5, 6, 7], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
];
export const CallStrip: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.PICKUP || t > M.callOut + 12) return null;
  return <LiveTranscript T={T} t={t} turns={TURNS} spec={STRIP} exitAt={M.callOut} />;
};

/* ── the service list (b5) ── */
/** the service list in the middle stage, between the stepped-aside timer (bottom y 536) and the strip (top y 960) */
export const PAGE = { x: 86, y: 574, w: 820, pad: 36, line: 44, lineH: 58 } as const;
const PAGE_LINES = ['Cut & finish', 'Trim · walk-in · Tue–Sat', 'Colour · patch test first'] as const;
const HEAD = { size: 32, weight: 560 } as const;
const LINE_SPEC = { size: PAGE.line, weight: TYPE.title.weight, tracking: -0.02 };
const KIND_SPEC = { size: 28, weight: TYPE.label.weight, tracking: 0.14 };
/** the separators' extra air either side (em): the middots set with room, as the dashboard sets its metadata */
const SEP_PAD = 0.1;
/** a page line's set width (its measured text + the separators' air) */
const lineW = (ln: string) => measureText(ln, LINE_SPEC) + (ln.split(' · ').length - 1) * 2 * SEP_PAD * PAGE.line;
/** the page's inner geometry (card px from its top-left) */
const P = (() => {
  const kindY = PAGE.pad;
  const headY = kindY + 28 * 1.2 + 10;
  const ruleY = headY + HEAD.size * 1.25 + 18;
  const firstY = ruleY + 22;
  const h = firstY + PAGE_LINES.length * PAGE.lineH - (PAGE.lineH - PAGE.line * 1.18) + PAGE.pad - 8;
  return { kindY, headY, ruleY, firstY, h };
})();
export const pageHeight = P.h;

function pageState(t: number) {
  const s = springUnit(t - M.page, SPRING.site);
  let dy = (1 - s) * 90;
  let o = smooth(0, 0.35, s);
  let sc = 1;
  // it sinks back and goes as her answer ends, gone before the timer springs back across it
  const q = tween(t, [M.callOut - 2, M.callOut + 5], [0, 1], EASE.inOut);
  dy += q * 46;
  sc -= 0.03 * q;
  o *= 1 - smooth(0.05, 0.9, q);
  return { dy, o, sc, moving: (t > M.page && t < M.page + 26) || (q > 0 && q < 1), lift: 2.2 + 1.2 * Math.max(0, 1 - s) };
}

/** THE END CARD's page: the same list rises again under the comment field on "price list." (× .88, centred: x 135–857,
 *  y 1112–1425 — the lower stage the card leaves empty), a muted viewer's picture of "your price list"; it leaves with
 *  the field before the bar */
export const END_PAGE = { y: 1112, sc: 0.88, at: T.END_CARD.cta + T.vWord('ig3-06', 5), out: T.END_CARD.impact - (CAP_OUT + 1) } as const;
function endPageState(t: number) {
  const s = springUnit(t - END_PAGE.at, SPRING.site);
  let dy = (1 - s) * 90;
  let o = smooth(0, 0.35, s);
  const q = tween(t, [END_PAGE.out, END_PAGE.out + 5], [0, 1], EASE.in3);
  dy += q * 40;
  o *= 1 - smooth(0.05, 0.9, q);
  return { dy, o, sc: END_PAGE.sc, moving: (t > END_PAGE.at && t < END_PAGE.at + 26) || (q > 0 && q < 1), lift: 1.8 + 1.2 * Math.max(0, 1 - s) };
}

export const ServicesPage: React.FC<{ t: number; end?: boolean }> = ({ t, end = false }) => {
  const ready = useKitFaces();
  if (!ready) return null;
  if (end ? t < END_PAGE.at - 1 || t > END_PAGE.out + 6 : t < M.page - 1 || t > M.callOut + 9) return null;
  const S = end ? endPageState(t) : pageState(t);
  if (S.o <= 0.002) return null;
  const baseY = end ? END_PAGE.y : PAGE.y;
  const tf = `translate(${PAGE.x}px, ${(baseY + S.dy).toFixed(3)}px)${S.sc !== 1 ? ` scale(${S.sc.toFixed(5)})` : ''}`;
  /** a point inside the page → frame px (its scale is about its top centre) */
  const at = (px: number, py: number) => ({ x: PAGE.x + (PAGE.w * (1 - S.sc)) / 2 + px * S.sc, y: baseY + S.dy + py * S.sc });
  const lineX = PAGE.pad;
  const sweepLine = 1;
  const sweepW = lineW(PAGE_LINES[sweepLine]);
  const mid = (s: string) =>
    s.split(' · ').map((part, i) => (
      <React.Fragment key={i}>
        {i ? <span style={{ color: APP.mutedFg, margin: `0 ${SEP_PAD}em` }}>{'\u00a0·\u00a0'}</span> : null}
        {part}
      </React.Fragment>
    ));
  const toolLabel = 'Looked it up in your documents';
  const toolW = 28 * 1.05 + 28 * 0.45 + measureText(toolLabel, { size: 28, weight: W.medium });
  const toolX = PAGE.x + PAGE.w - PAGE.pad - toolW;
  const settled = !S.moving;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PAGE.w,
          height: P.h,
          borderRadius: 34,
          background: APP.card,
          boxShadow: meshElevation(S.lift, SHADOW_INK, 1),
          transformOrigin: '50% 0%',
          opacity: S.o >= 0.999 ? undefined : S.o,
          ...subpixel(tf, S.moving),
        }}
      >
        <div style={{ position: 'absolute', left: lineX, top: P.kindY, ...ui(28, KIND_SPEC.weight, { tracking: 0.14 }), textTransform: 'uppercase', color: APP.mutedFg }}>PDF</div>
        <div style={{ position: 'absolute', left: lineX, top: P.headY, ...ui(HEAD.size, HEAD.weight, { tracking: -0.012 }), color: APP.foreground, whiteSpace: 'nowrap' }}>Services</div>
        <div style={{ position: 'absolute', left: lineX, right: PAGE.pad, top: P.ruleY, height: 1.25, background: APP.border }} />
        <InkSweep t={t} at={M.tuesday} x={lineX - 8} y={P.firstY + sweepLine * PAGE.lineH - PAGE.line * 0.04} w={sweepW + 16} h={PAGE.line * 1.24} color={SUNDAY.orb[2]} alpha={0.15} dur={14} />
        {PAGE_LINES.map((ln, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: lineX,
              top: P.firstY + i * PAGE.lineH,
              fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
              fontWeight: LINE_SPEC.weight,
              fontSize: PAGE.line,
              letterSpacing: '-0.02em',
              lineHeight: 1.18,
              fontVariantNumeric: 'tabular-nums',
              color: APP.foreground,
              whiteSpace: 'nowrap',
            }}
          >
            {mid(ln)}
          </div>
        ))}
      </div>
      {/* the dashboard's tool step, beside the heading (it rides the page's rise: drawn in frame px on its own layer) */}
      {end ? null : (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: S.o >= 0.999 ? undefined : S.o, ...subpixel(S.dy !== 0 ? `translateY(${S.dy.toFixed(3)}px)` : undefined, S.moving) }}>
          <ToolRow t={t} label={toolLabel} x={toolX} y={PAGE.y + P.headY + 2} at={M.tool} done={M.toolDone} size={28} accent={SUNDAY.ink} />
        </div>
      )}
      {settled ? (
        <>
          <ZoneRect what={`${end ? 'end ' : ''}services page kind + heading`} rect={{ ...at(lineX, P.kindY), w: measureText('Services', { size: HEAD.size, weight: HEAD.weight }) * S.sc, h: (P.headY - P.kindY + HEAD.size * 1.25) * S.sc }} />
          {PAGE_LINES.map((ln, i) => (
            <ZoneRect key={i} what={`${end ? 'end ' : ''}services line “${ln}”`} rect={{ ...at(lineX, P.firstY + i * PAGE.lineH), w: lineW(ln) * S.sc, h: PAGE.line * 1.18 * S.sc }} />
          ))}
        </>
      ) : null}
    </>
  );
};

/* ── the record (b6) ── */
/** the record: x 174–906 (the comment field's own column, so its edge stays out of the rail), under the timer */
export const RECORD = { x: 174, y: 892, w: 732, h: 134, r: 32, pad: 36, pill: 28, line: 28 } as const;
/** its transcript line: her answer as the call detail lists it (film 2's RecordRow idiom, "Ava: …"), the first that fits */
const RECORD_LINES = ['Ava: “A walk-in trim? You can, Tuesday to Saturday.”', 'Ava: “… You can, Tuesday to Saturday.”'] as const;
const RECORD_SPEC = { size: RECORD.line, weight: W.regular, tracking: -0.01 };
function recordState(t: number) {
  const p = springUnit(t - M.record, SPRING.land);
  let dy = (1 - p) * 70;
  let o = smooth(0, 0.3, p);
  // the end card: it sinks back and goes before the CTA rises
  const q = tween(t, [T.END_CARD.cta - 10, T.END_CARD.cta + 2], [0, 1], EASE.in3);
  dy += q * 40;
  o *= 1 - smooth(0.1, 1, q);
  return { dy, o, lift: 1.6 + 3.2 * Math.max(0, 1 - p), moving: (t > M.record && t < M.record + 30) || (q > 0 && q < 1) };
}
export const RecordCard: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.record - 0.5) return null;
  const S = recordState(t);
  if (S.o <= 0.002) return null;
  const R = RECORD;
  const pill = outcomePillSize('answered', R.pill);
  const label = { size: 28, weight: TYPE.label.weight, tracking: 0.14 };
  const lineMax = R.w - 2 * R.pad;
  const line = typo(RECORD_LINES.find((l) => measureText(typo(l), RECORD_SPEC) <= lineMax) ?? RECORD_LINES[RECORD_LINES.length - 1]);
  const lineW = Math.min(lineMax, measureText(line, RECORD_SPEC));
  const rowC = 26 + 17;
  const tf = `translate(${R.x}px, ${(R.y + S.dy).toFixed(3)}px)`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: R.w,
          height: R.h,
          borderRadius: R.r,
          background: '#ffffff',
          boxShadow: meshElevation(S.lift, SHADOW_INK, 1),
          opacity: S.o >= 0.999 ? undefined : S.o,
          ...subpixel(tf, S.moving),
        }}
      >
        <div style={{ position: 'absolute', left: R.pad, top: 26, ...ui(28, label.weight, { tracking: 0.14 }), textTransform: 'uppercase', color: APP.mutedFg }}>Transcript</div>
        <div style={{ position: 'absolute', left: R.pad, top: 78, ...ui(RECORD.line, W.regular, { tracking: -0.01 }), color: APP.foreground, opacity: 0.78, whiteSpace: 'nowrap' }}>{line}</div>
        <div style={{ position: 'absolute', right: R.pad, top: rowC - pill.h / 2 }}>
          <OutcomePill kind="answered" size={R.pill} />
        </div>
      </div>
      {S.o > 0.5 ? (
        <>
          <ZoneRect what="record TRANSCRIPT" rect={{ x: R.x + R.pad, y: R.y + S.dy + 26, w: measureText('TRANSCRIPT', label), h: 34 }} />
          <ZoneRect what="record pill Answered" rect={{ x: R.x + R.w - R.pad - pill.w, y: R.y + S.dy + rowC - pill.h / 2, w: pill.w, h: pill.h }} />
          <ZoneRect what="record transcript line" rect={{ x: R.x + R.pad, y: R.y + S.dy + 78, w: lineW, h: RECORD.line * 1.25 }} />
        </>
      ) : null}
    </>
  );
};

/* ── the payoff's captions (b6): "Timer's done. / Caller's sorted." · "You never / looked up." ── */
const PAY_PLACE = (k: number): CapPlace => ({ ...NARRATOR, rows: k === 0 ? [2] : undefined });
const PAY_KEYS = [{ words: [3], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] as const;
export const PayoffCaptions: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig3-05" t={t} place={PAY_PLACE} keys={PAY_KEYS} timing={PAY_TIMING} what="payoff" />;

/* ── the whole stage at t (every act draws it; each part is null outside its window) ── */
export const Stage3: React.FC<{ t: number; ground?: boolean }> = ({ t, ground = true }) => (
  <>
    {ground ? <Ground3 t={t} /> : null}
    {t < T.PICKUP + 12 ? <Ig3Frame0 t={t} /> : <Timer3 t={t} />}
    <PullCaptions t={t} />
    <ServicesPage t={t} />
    <CallStrip t={t} />
    <RecordCard t={t} />
    <Orb3 t={t} />
    <PayoffCaptions t={t} />
  </>
);
