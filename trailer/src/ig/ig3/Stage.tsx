/**
 * REEL 3 · THE STAGE — every part of "Twelve minutes" as a pure function of the ABSOLUTE timeline frame `t`, so every act
 * (each in its own <Sequence>, Reel3.tsx) and the end card's seam draw exactly the same picture at the same frame:
 *
 *   Ground3       the pearl (MUTED_MESH) lit by the light in frame: the phone's rose pool top-left (b1–b2, dimming with
 *                 the caller giving up), her teal at the orb from the pickup, a teal pool behind the timer at the payoff
 *   timerPose     the card: centred (b1), the TUG toward the phone on "up" (one move, back over .5 s), the CORNER CHIP
 *                 from the pickup (shrinking and gliding, clear of the strip before her first word), the SPRING BACK to
 *                 centre at full size on the hang-up, the end card's step back (up, × .62, shaded), gone before the hit
 *   Ig3Frame0     FRAME 0's composition (also re-formed by the end card's seam at t − END ∈ [−14, 0)): the phone's rose
 *                 line light ringing (a RingPulse already in flight), the timer at 12:00 with its rose ring, S1 "Twelve
 *                 minutes / on the colour." set at 72 %
 *   CallStrip     the call (b3–b5, a fork-free use of the shared LiveTranscript): ● AVA rows word-synced (they ARE the
 *                 captions), the caller's turn a level meter — one turn at a time over the stage, scrolling by rows
 *   ServicesPage  the salon's own list (b5): kind token PDF, "Services", three lines as 44 px objects, the dashboard's
 *                 "Looked it up in your documents" beside the heading, a teal sweep under the Trim line
 *   RecordCard    the call filed (b6): TRANSCRIPT over two ink bars, the Answered pill
 *   Orb3          her orb: the dimmed phone light springs open into it on the pickup (film 2's birth), at rest on
 *                 "looked up", closing back into the phone's light in the seam
 */
import React from 'react';
import { mixColor } from '../../lib/lights';
import { EASE, mix, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { subpixel } from '../../lib/glide';
import { TYPE } from '../../theme';
import { APP, InkSweep, measureText, meshElevation, meshShadowInk, ui, useKitFaces, W } from '../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../kb/palettes';
import { GRAPHITE } from '../../kb/theme';
import { LiveTranscript, ToolRow, type Turn } from '../components/Call';
import { Captions, SEAM_RISE, type CapPlace } from '../components/Captions';
import { endGroundKey } from '../components/End';
import { PearlGround } from '../components/Ground';
import { AvaOrb, LineLight, orbTrack, RING_INK, Rings } from '../components/Orb';
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
/** the timer: centred in b1 (Ø 440, x 320–760, y 420–860), its corner chip (Ø 136, x 744–880, y 254–390), the payoff */
export const TIMER = { cx: 540, cy: 640 } as const;
export const CHIP = { cx: 831, cy: 324, s: 150 / FACE.d } as const;
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
/** the end card's ground: the payoff's teal handing over to the backlight's light; frame 0's (tm < 0) is the hook's */
export function endGround(tm: number) {
  if (tm < 0) return <Ground3 t={tm} />;
  const a = groundKey(tm);
  const key = endGroundKey(T, tm, false);
  const k = Math.min(1, key.strength / 0.3);
  return <Ground3 t={tm} keyLight={k > 0.001 ? { x: mix(a.x, key.x, k), y: mix(a.y, key.y, k), strength: mix(a.strength, key.strength, k), color: mixColor(a.color, key.color, k), radius: mix(a.radius, 900, k) } : a} />;
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
  // b3 the pickup: it shrinks and glides to its corner chip
  const g = tween(t, M.chip, [0, 1], EASE.inOut);
  if (g > 0) {
    cx = mix(cx, CHIP.cx, g);
    cy = mix(cy, CHIP.cy, g);
    s = mix(s, CHIP.s, g);
    moving = moving || g < 1;
  }
  // b6 the hang-up: 00:00 — it springs back to centre at full size
  if (t >= T.HANGUP) {
    const u = springUnit(t - T.HANGUP, SPRING.site);
    cx = mix(CHIP.cx, PAYOFF.cx, u);
    cy = mix(CHIP.cy, PAYOFF.cy, u);
    s = mix(CHIP.s, 1, u);
    air = Math.max(0, 1 - (t - T.HANGUP) / 14);
    moving = t < T.HANGUP + 34;
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
export function timerLook(t: number): TimerLook {
  return {
    teal: tween(t, [T.PICKUP, T.PICKUP + 8], [0, 1], EASE.inOut),
    over: tween(t, [M.over - 1, M.over + 5], [0, 1], EASE.inOut),
    close: tween(t, [T.HANGUP + 2, T.HANGUP + 13], [0, 1], EASE.out3),
    lift: tween(t, [T.HANGUP + 2, T.HANGUP + 12], [0, 1], EASE.inOut),
    checkAt: t >= T.HANGUP ? M.check : undefined,
    air: timerPose(t).air,
  };
}
/** as the ring closes, one teal hairline leaves the disc's rim (her ring of the birth, answered) */
const DONE_RING = T.HANGUP + 11;
export const Timer3: React.FC<{ t: number }> = ({ t }) => (
  <>
    {t >= DONE_RING && t < DONE_RING + 30 ? <Rings t={t} at={[DONE_RING]} x={PAYOFF.cx} y={PAYOFF.cy} d0={FACE.d} d1={FACE.d * 1.5} color={SUNDAY.orb[2]} strength={0.4} /> : null}
    <TimerFace t={t} pose={timerPose(t)} look={timerLook(t)} />
  </>
);

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
    <Rings t={t} at={T.VIS_RINGS} x={PHONE.x} y={PHONE.y} d0={PHONE.d} d1={560} color={RING_INK.rush} strength={0.5} />
    {dot && t < M.birth + 0.5 ? <LineLight t={t} x={PHONE.x} y={PHONE.y} d={PHONE.d} dim={dimAt(t)} rings={T.VIS_RINGS} /> : null}
    <Timer3 t={t} />
    <Captions T={T} id="ig3-01" t={t} place={HOOK_PLACE} keys={HOOK_KEYS} glint={RUSH.orb[2]} what="hook" />
  </>
);
/** the dilemma's captions (b2): they leave on the pickup (the click answers the ring) */
export const PullCaptions: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig3-02" t={t} place={PULL_PLACE} keys={PULL_KEYS} timing={{ exitAt: T.PICKUP }} what="dilemma" />;

/* ── her orb ── */
const track = () => orbTrack(T, { listen: T.CALLERS.map(([a, b]) => [a, b] as const) });
/** where she is: born at the phone's light, opening out to her place; back to the phone's light in the seam */
export function orbPose(t: number): { x: number; y: number; d: number; moving: boolean } {
  const g = tween(t, [M.birth, M.birth + 16], [0, 1], EASE.inOut);
  const back = tween(t, [T.END_CARD.seam, T.DURATION - 2], [0, 1], EASE.inOut);
  const x = mix(mix(PHONE.x, ORB.x, g), PHONE.x, back);
  const y = mix(mix(PHONE.y, ORB.y, g), PHONE.y, back);
  return { x, y, d: ORB.d, moving: (g > 0 && g < 1) || (back > 0 && back < 1) };
}
export const Orb3: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.birth) return null;
  // "You never looked up.": she rests — and wakes again as she starts the CTA
  const rest = tween(t, [M.looked, M.looked + 14], [0, 1], EASE.inOut) * (1 - tween(t, [T.END_CARD.cta - 4, T.END_CARD.cta + 10], [0, 1], EASE.inOut));
  const E = T.END_CARD;
  return (
    <AvaOrb
      t={t}
      pose={orbPose(t)}
      canvas={ORB.d}
      track={track()}
      born={{ at: M.birth, dot: PHONE.d }}
      opacity={1 - 0.4 * rest}
      shadow={0.25}
      close={{ at: E.seam + 2, dur: T.DURATION - 4 - E.seam, dot: PHONE.d, t0: T.DURATION, rings: T.VIS_RINGS }}
    />
  );
};

/* ── the call strip ── */
export const STRIP = { x: 86, y: 500, w: 820, h: 338, size: 56, tagGap: 20, rowGap: 28 } as const;
const TURNS: Turn[] = [
  { who: 'ava', id: 'ig3-03', breaks: [3], keys: [{ words: [6, 7, 8], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
  { who: 'caller', from: T.CALLERS[0][0], to: T.CALLERS[0][1] },
  { who: 'ava', id: 'ig3-04', breaks: [3], keys: [{ words: [5, 6, 7], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
];
export const CallStrip: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.PICKUP || t > M.callOut + 12) return null;
  return <LiveTranscript T={T} t={t} turns={TURNS} spec={STRIP} exitAt={M.callOut} />;
};

/* ── the service list (b5) ── */
export const PAGE = { x: 86, y: 866, w: 820, pad: 36, line: 44, lineH: 58 } as const;
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

export const ServicesPage: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.page - 1 || t > M.callOut + 9) return null;
  const S = pageState(t);
  if (S.o <= 0.002) return null;
  const tf = `translate(${PAGE.x}px, ${(PAGE.y + S.dy).toFixed(3)}px)${S.sc !== 1 ? ` scale(${S.sc.toFixed(5)})` : ''}`;
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
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: S.o >= 0.999 ? undefined : S.o, ...subpixel(S.dy !== 0 ? `translateY(${S.dy.toFixed(3)}px)` : undefined, S.moving) }}>
        <ToolRow t={t} label={toolLabel} x={toolX} y={PAGE.y + P.headY + 2} at={M.tool} done={M.toolDone} size={28} accent={SUNDAY.ink} />
      </div>
      {settled ? (
        <>
          <ZoneRect what="services page kind + heading" rect={{ x: PAGE.x + lineX, y: PAGE.y + P.kindY, w: measureText('Services', { size: HEAD.size, weight: HEAD.weight }), h: P.headY - P.kindY + HEAD.size * 1.25 }} />
          {PAGE_LINES.map((ln, i) => (
            <ZoneRect key={i} what={`services line “${ln}”`} rect={{ x: PAGE.x + lineX, y: PAGE.y + P.firstY + i * PAGE.lineH, w: lineW(ln), h: PAGE.line * 1.18 }} />
          ))}
        </>
      ) : null}
    </>
  );
};

/* ── the record (b6) ── */
export const RECORD = { x: 160, y: 892, w: 760, h: 124, r: 32, pad: 36, pill: 28 } as const;
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
        <div style={{ position: 'absolute', left: R.pad, top: 72, width: 300, height: 14, borderRadius: 7, background: GRAPHITE.text, opacity: 0.2 }} />
        <div style={{ position: 'absolute', left: R.pad, top: 96, width: 196, height: 11, borderRadius: 5.5, background: GRAPHITE.text, opacity: 0.1 }} />
        <div style={{ position: 'absolute', right: R.pad, top: (R.h - pill.h) / 2 }}>
          <OutcomePill kind="answered" size={R.pill} />
        </div>
      </div>
      {S.o > 0.5 ? (
        <>
          <ZoneRect what="record TRANSCRIPT" rect={{ x: R.x + R.pad, y: R.y + S.dy + 26, w: measureText('TRANSCRIPT', label), h: 34 }} />
          <ZoneRect what="record pill Answered" rect={{ x: R.x + R.w - R.pad - pill.w, y: R.y + S.dy + (R.h - pill.h) / 2, w: pill.w, h: pill.h }} />
        </>
      ) : null}
    </>
  );
};

/* ── the payoff's captions (b6): "Timer's done. / Caller's sorted." · "You never / looked up." ── */
const PAY_PLACE = (k: number): CapPlace => ({ ...NARRATOR, rows: k === 0 ? [2] : undefined });
const PAY_KEYS = [{ words: [3], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] as const;
export const PayoffCaptions: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig3-05" t={t} place={PAY_PLACE} keys={PAY_KEYS} what="payoff" />;

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
