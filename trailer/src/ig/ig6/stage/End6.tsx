/**
 * REEL 6 · END6, THE WHITE END CARD (docs/ig/ig6/SCRIPT.md §8, b8–b10; STYLE.md §4.4, §9.10). The series' beats in the
 * reference's style, on flat white, no GL bloom, one accent:
 *
 *   the dome   THE THROUGH-LINE: the agent's teal dome leaves the hub as the clock recedes (f640–654), rising first and
 *              then gliding right above the lockup box to the send disc's place, Ø 54 → 72, its gradient flattening to
 *              the plain teal; a white arrow draws into it (6 f); it presses (.97) as "link." ends; on the bar it flies
 *              (6 f expo) to the end of the wordmark and STAMPS as its full stop on the impact (0.85 → 1.10 → 1, its
 *              own shadow); in the seam it glides back to the hub (left first, then down: never over the re-forming
 *              lockup), Ø 54, and drains teal → graphite: your phone again
 *   the field  a white pill x 200–880 (left of TikTok's rail), y 940–1060, r 60, a 1.5 px #E6E6E6 border and the long
 *              shadow; it opens out of the disc leftward (12 f expo) — lucide message-circle, a caret blinking on the
 *              beat while idle, AGENT typed one letter per 16th from her word (Instrument Sans 600, 50 px, ink)
 *   the CTA    "Comment / AGENT" + the tier "Comment AGENT for the link." (the stage's Lockup, layout `cta`)
 *   impact     11 f before the bar the CTA leaves up through its masks and the field leaves in place (fade + 0.96);
 *              the dome flies the last 6 f and stamps as the full stop ON the bar line, as NEUROVOICE (film 1's
 *              Wordmark: Inter Tight 500, −0.07em, ink #0A0A0A, 720 px wide) lands centre-out from the impact − 5
 *              (its middle at full ink on the bar; crit-r1 B2 / N2); neurotechvoice.com
 *              (Instrument Sans 450, 34 px, grey) types in three chunks on "Neuro | Tech | Voice"
 *   the seam   the wordmark and the URL leave up (f826–830) while the dome goes home and frame 0 re-forms (Stage.tsx)
 *
 * Built from the shared exports only (End.tsx agentKeys; EndCard.tsx Wordmark, WORDMARK_FONT, WORDMARK_TEXT; kb/kit
 * typed glyphs): no shared file is edited. Every value is a pure function of the absolute frame.
 */
import React from 'react';
import { typedCount, typedOpacity } from '../../../kb/kit';
import { EASE, mix, smooth, springUnit } from '../../../lib/motion';
import { subpixel } from '../../../lib/glide';
import { TRACK } from '../../../theme';
import { Wordmark, WORDMARK_FONT, WORDMARK_TEXT } from '../../../scenes/cta/EndCard';
import { agentKeys } from '../../components/End';
import { IgIcon } from '../../components/icons';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { bump } from './clock';
import { Dome, DomeDefs } from './Dial';
import { measureSans, useWordmarkFace } from './fonts';
import type { Pt } from './geom';
import { END6, FACE, INK, SHADOW } from './style';

const E = T.END_CARD;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** the field leaves with the S7 lockup (Lockup.tsx e7), in place, 11 f before the bar: the stage is clear by the impact
 *  − 6, when the dome flies and NEUROVOICE starts to surface (crit-r1 B2 / N2) */
export const CTA_OUT = T.IMPACT - 11;
/** NEUROVOICE starts surfacing here (centre-out), so its middle letters are at full ink on the impact and the last ones
 *  2 f later — the bar line lands on a word, not on a white frame with a dot (crit-r1 N2) */
const WM_AT = T.IMPACT - 5;
/** the dome's moments */
export const DOME_T = {
  leave: T.M.exit[0],
  send: T.M.exit[1],
  arrow: [T.M.exit[1], T.M.exit[1] + 6] as const,
  fly: [T.IMPACT - 6, T.IMPACT] as const,
  home: [E.seam, E.seam + 10] as const,
  drain: [E.seam + 6, E.seam + 10] as const,
} as const;

/* ── the wordmark's size and the full stop's place ── */
let emCache: number | null = null;
function wordmarkEm(ready: boolean): number {
  if (emCache !== null) return emCache;
  if (!ready || typeof document === 'undefined') return 5.6;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 5.6;
  ctx.font = `500 1000px ${WORDMARK_FONT}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${parseFloat(TRACK.wordmark) * 1000}px`;
  ctx.fontKerning = 'normal';
  const em = ctx.measureText(WORDMARK_TEXT).width / 1000 - parseFloat(TRACK.wordmark);
  if (document.fonts.check(ctx.font, WORDMARK_TEXT)) emCache = em;
  return em;
}
/** Inter Tight: cap .7275 em, x-height .546 em */
const IT = { cap: 0.7275, x: 0.546 } as const;
export type BrandGeom = { size: number; wmW: number; cx: number; baseline: number; stop: Pt; stopD: number; x0: number; x1: number };
export function brandGeom(ready: boolean): BrandGeom {
  const W = END6.wordmark;
  const em = wordmarkEm(ready);
  const size = W.w / em;
  const stopD = IT.x * size * 0.55;
  const group = W.w + W.gap + stopD;
  const x0 = 540 - group / 2;
  const cx = x0 + W.w / 2;
  const baseline = W.capMid + (IT.cap * size) / 2;
  return { size, wmW: W.w, cx, baseline, stop: { x: x0 + W.w + W.gap + stopD / 2, y: baseline - stopD / 2 }, stopD, x0, x1: x0 + group };
}

/* ── the dome's path through the end ── */
const HOME_LANE = 930;
export type DomeState = { p: Pt; d: number; flat: number; arrow: number; press: number; drain: number; shadow: number } | null;
/** the dome at t (null outside f640 … the seam's home), from the hub's screen spot at the leave (`hub0`) and frame 0's
 *  hub spot (`hubEnd`, with its screen diameter) */
export function domeAt(t: number, hub0: { p: Pt; d: number }, hubEnd: { p: Pt; d: number }, ready: boolean): DomeState {
  const D = DOME_T;
  const S = END6.send;
  if (t < D.leave || t >= D.home[1]) return null;
  const B = brandGeom(ready);
  if (t < D.send) {
    // rise first, then right along y ≈ 1000 (above the lockup box, clear of the exiting S6)
    const u = clamp01((t - D.leave) / (D.send - D.leave));
    const x = mix(hub0.p.x, S.cx, EASE.inOut(u));
    const y = mix(hub0.p.y, S.cy, EASE.out3(Math.min(1, u / 0.5)));
    return { p: { x, y }, d: mix(hub0.d, S.d, EASE.inOut(u)), flat: EASE.inOut(u), arrow: 0, press: 1, drain: 0, shadow: 1 };
  }
  if (t < D.fly[0]) {
    const a = EASE.out3(clamp01((t - D.arrow[0]) / (D.arrow[1] - D.arrow[0])));
    const u = t - E.send;
    const press = u < 0 ? 1 : u < 2 ? mix(1, 0.97, EASE.out3(u / 2)) : mix(0.97, 1, springUnit(u - 2, { stiffness: 230, damping: 21, mass: 1 }));
    return { p: { x: S.cx, y: S.cy }, d: S.d, flat: 1, arrow: a, press, drain: 0, shadow: 1 };
  }
  if (t < E.seam) {
    const u = EASE.expo(clamp01((t - D.fly[0]) / (D.fly[1] - D.fly[0])));
    const p = { x: mix(S.cx, B.stop.x, u), y: mix(S.cy, B.stop.y, u) };
    const d = mix(S.d, B.stopD, u);
    // the stamp ON the impact: 0.85 → ≈ 1.10 → 1
    const k = t < D.fly[1] ? 1 : 1 + 0.12 * bump(t - D.fly[1], 2) - 0.15 * Math.exp(-(t - D.fly[1]) / 1.2);
    const arrow = 1 - clamp01((t - D.fly[0]) / 2);
    return { p, d: d * (t < D.fly[1] ? mix(1, 0.85, clamp01((t - D.fly[1] + 2) / 2)) : k), flat: 1 - u, arrow, press: 1, drain: 0, shadow: 1 };
  }
  // home: off the full stop leftward at once (out of TikTok's rail) along a lane between the leaving wordmark and the
  // leaving URL (y 930: both rise away from it, the URL clear by the time the dome passes over its line), then down
  // onto the hub left of the lockup box — never across a word; the drain over its last 4 f
  const u = clamp01((t - D.home[0]) / (D.home[1] - D.home[0]));
  const lane = HOME_LANE;
  const x = mix(B.stop.x, hubEnd.p.x, EASE.out3(clamp01(u / 0.8)));
  const y = u < 0.6 ? mix(B.stop.y, lane, EASE.out3(clamp01(u / 0.3))) : mix(lane, hubEnd.p.y, EASE.inOut(clamp01((u - 0.6) / 0.4)));
  const drain = clamp01((t - D.drain[0]) / (D.drain[1] - D.drain[0]));
  return { p: { x, y }, d: mix(B.stopD, hubEnd.d, EASE.inOut(u)), flat: 0, arrow: 0, press: 1, drain, shadow: 1 - u };
}

/** the travelling dome (with its own small shadow; a white arrow while it is the send disc) */
export const DomeFlyer: React.FC<{ s: DomeState }> = ({ s }) => {
  if (!s) return null;
  const r = (s.d / 2) * s.press;
  const id = 'ig6-flyer';
  const D = SHADOW.dome;
  const k = s.d / 54;
  const sh = 0.18 * s.shadow;
  const ar = s.d * 0.18;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter: sh > 0.002 ? `drop-shadow(${(D.dx * k).toFixed(2)}px ${(D.dy * k).toFixed(2)}px ${(D.blur * k).toFixed(2)}px rgba(10,10,10,${sh.toFixed(3)}))` : undefined }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0 }} shapeRendering="geometricPrecision" aria-hidden>
        <DomeDefs id={id} />
        {s.drain > 0 ? (
          <>
            <Dome id={id} cx={s.p.x} cy={s.p.y} r={r} kind="graphite" />
            <clipPath id={`${id}-drain`}>
              <circle cx={s.p.x} cy={s.p.y} r={Math.max(0, r * (1 - s.drain))} />
            </clipPath>
            <g clipPath={`url(#${id}-drain)`}>
              <Dome id={id} cx={s.p.x} cy={s.p.y} r={r} kind="teal" />
            </g>
          </>
        ) : (
          <Dome id={id} cx={s.p.x} cy={s.p.y} r={r} kind="teal" flat={s.flat} />
        )}
        {s.arrow > 0.001 ? (
          <path
            d={`M ${s.p.x} ${s.p.y + ar} L ${s.p.x} ${s.p.y - ar} M ${s.p.x - ar * 0.72} ${s.p.y - ar * 0.28} L ${s.p.x} ${s.p.y - ar} L ${s.p.x + ar * 0.72} ${s.p.y - ar * 0.28}`}
            pathLength={1}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3.6 * s.press}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={1 - s.arrow}
          />
        ) : null}
      </svg>
    </div>
  );
};

/* ── the comment field ── */
const FIELD_FONT = { size: END6.field.textSize, weight: 600, tracking: 0 } as const;
export const CommentField6: React.FC<{ t: number }> = ({ t }) => {
  const F = END6.field;
  const S = END6.send;
  if (t < E.field - 1 || t > CTA_OUT + 6) return null;
  // it opens out of the disc, leftward (12 f expo), the height easing up from the disc's
  const o = EASE.expo(clamp01((t - E.field) / 12));
  const x0 = mix(S.cx - S.d / 2 - 6, F.x0, o);
  const h = mix(S.d + 12, F.y1 - F.y0, EASE.out3(clamp01((t - E.field) / 8)));
  const cy = (F.y0 + F.y1) / 2;
  const a = clamp01((t - E.field + 0.5) / 2);
  // the exit: IN PLACE (opacity 1 → 0, scale 1 → 0.96 about its centre; 4 f in3) — it never travels into the CTA
  // tier's band above it (crit-r1 B2: moving up 230 px it drew "AGENT" through "Comment AGENT for the link.")
  const q = EASE.in3(clamp01((t - CTA_OUT) / 4));
  const sc = 1 - 0.04 * q;
  const keys = agentKeys(T);
  const typed = typedCount(t, keys);
  const word = 'AGENT';
  const spec = { size: FIELD_FONT.size, weight: FIELD_FONT.weight, tracking: 0 };
  const caretX = F.textX + (typed > 0 ? measureSans(word.slice(0, typed), spec.size, spec.weight) + 5 : 0);
  const typing = t >= keys[0] - 0.5 && t < keys[keys.length - 1] + 8;
  const idleFrom = t < keys[0] ? E.field + 10 : keys[keys.length - 1] + 8;
  const ph = (((t - idleFrom) % 30) + 30) % 30;
  const blink = typing ? 1 : t < E.field + 10 ? 0 : ph < 15 ? smooth(0, 1.5, ph) : 1 - smooth(15, 16.5, ph);
  const iconOn = clamp01((F.icon.x + F.icon.size - x0) / 40);
  const L = SHADOW.long;
  const w = F.x1 - x0;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${F.y0 - 40}px 0px 0px 0px)`, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: a * (1 - q) < 0.999 ? a * (1 - q) : undefined, filter: `drop-shadow(${L.dx}px ${L.dy}px ${L.blur}px rgba(10,10,10,0.07))`, transformOrigin: `${((x0 + F.x1) / 2).toFixed(2)}px ${cy}px`, ...subpixel(q > 0 ? `scale(${sc.toFixed(5)})` : undefined, q > 0) }}>
          <div style={{ position: 'absolute', left: x0, top: cy - h / 2, width: w, height: h, borderRadius: Math.min(F.r, h / 2), background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${INK.fieldBorder}` }} />
          {iconOn > 0.001 ? (
            <div style={{ position: 'absolute', left: F.icon.x, top: cy - F.icon.size / 2, opacity: iconOn < 0.999 ? iconOn : undefined }}>
              <IgIcon name="messageCircle" size={F.icon.size} color={INK.ink} stroke={1.9} />
            </div>
          ) : null}
          {word.split('').map((ch, i) => {
            const op = typedOpacity(t, keys[i]);
            if (op <= 0.001) return null;
            const x = F.textX + measureSans(word.slice(0, i), spec.size, spec.weight);
            return (
              <span key={i} style={{ position: 'absolute', left: x, top: cy - spec.size * 0.62, fontFamily: FACE.sans, fontWeight: spec.weight, fontSize: spec.size, lineHeight: 1.24, color: INK.ink, opacity: op < 0.999 ? op : undefined, whiteSpace: 'pre', fontSynthesis: 'none' }}>
                {ch}
              </span>
            );
          })}
          {blink > 0.002 && o > 0.6 ? <div style={{ position: 'absolute', left: caretX, top: cy - 29, width: 3, height: 58, borderRadius: 1.5, background: INK.ink, opacity: blink }} /> : null}
        </div>
      </div>
      {q < 0.5 && o > 0.05 ? <ZoneRect what="object comment field" rect={{ x: x0, y: cy - h / 2, w, h }} /> : null}
      {typed > 0 && q < 0.5 ? <ZoneRect what="text comment field AGENT" rect={{ x: F.textX, y: cy - spec.size * 0.62, w: measureSans(word, spec.size, spec.weight), h: spec.size * 1.24 }} /> : null}
    </>
  );
};

/* ── the brand: NEUROVOICE + the dome as its full stop, and the URL ── */
const URL_TEXT = 'neurotechvoice.com';
const URL_CHUNKS = [0, 5, 9] as const;
export const Brand6: React.FC<{ t: number }> = ({ t }) => {
  const ready = useWordmarkFace();
  if (t < WM_AT - 1 || t >= E.seam + 5) return null;
  const B = brandGeom(ready);
  const q = EASE.in3(clamp01((t - E.seam) / 4));
  const lift = -q * B.size * 1.1;
  const fade = 1 - smooth(0.35, 1, q);
  const top = B.baseline - IT.cap * B.size - 30;
  // centre-out, the middle letters from WM_AT, the ends ≈ 1 f later (all at full ink by the impact + 2)
  const arrive = (xEm: number) => 0.35 * xEm;
  // the URL, typed chunk by chunk (a ½ f ripple per glyph), centred
  const U = END6.url;
  const uw = measureSans(URL_TEXT, U.size, U.weight);
  const ux = 540 - uw / 2;
  const keyOf = (i: number) => {
    let k = 0;
    for (let c = 0; c < URL_CHUNKS.length; c++) if (i >= URL_CHUNKS[c]) k = c;
    return E.url[k] + (i - URL_CHUNKS[k]) * 0.5;
  };
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${top.toFixed(1)}px 0px 0px 0px)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: fade < 0.999 ? fade : undefined, ...subpixel(q > 0 ? `translateY(${lift.toFixed(3)}px)` : undefined, q > 0) }}>
          <Wordmark t={t} at={WM_AT} ready={ready} rest={(_t, v) => v} spec={{ x: B.cx, y: END6.wordmark.capMid, size: B.size, arrive, color: INK.ink }} />
          {/* its own layer: greyscale AA for the small grey URL (crit-r1 N3) */}
          <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }} aria-hidden>
            <text y={U.base} style={{ fontFamily: FACE.sans, fontSize: U.size, fontWeight: U.weight, fontSynthesis: 'none', whiteSpace: 'pre' }} fill={INK.tier}>
              {URL_TEXT.split('').map((ch, i) => {
                const op = typedOpacity(t, keyOf(i));
                return (
                  <tspan key={i} x={ux + measureSans(URL_TEXT.slice(0, i), U.size, U.weight)} fillOpacity={op}>
                    {ch}
                  </tspan>
                );
              })}
            </text>
          </svg>
        </div>
      </div>
      {t >= WM_AT && q < 0.5 ? <ZoneRect what="wordmark NEUROVOICE + full stop" rect={{ x: B.x0, y: B.baseline - IT.cap * B.size, w: B.x1 - B.x0, h: IT.cap * B.size }} /> : null}
      {t >= E.url[0] && q < 0.5 ? <ZoneRect what="text url" rect={{ x: ux, y: U.base - U.size * 0.76, w: uw, h: U.size }} /> : null}
    </>
  );
};

