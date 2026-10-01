/**
 * THE LANGUAGES — Ava greets in six languages, one card in focus at a time.
 *
 *   focus     the ACTIVE language: a large white card under the band title.
 *             Top-left, a small orb in the card's light that breathes with
 *             her REAL envelope (VOICE.lines[id].env) and the language's name;
 *             below, the greeting in the cinema face, revealed word by word
 *             ON her words (Japanese per character; its Latin "AI" / "Ava" in
 *             Cormorant, the CJK in Noto Serif JP), the AI disclosure
 *             underlined as she says it. The card's light lives in its orb,
 *             a 2 px ring and a small glow under the card.
 *   cascade   English is heard whole (the wall's keeper turns into it). Then
 *             Romanian / Spanish / French / German slide in from the right,
 *             each landing a frame before its voice cuts in (≈ 0.75 s each):
 *             the big line is what she says before the cut ("Sunt Ava,") —
 *             at most four words in focus. Japanese is heard whole.
 *   gallery   as the next card arrives, the last one recedes into the gallery
 *             (16:9 a row of five under the focus · 9:16 3 + 2), its light
 *             going out — so from Japanese on all six are visible together,
 *             never more than one line big in focus.
 *   flow      the gallery drops away and Japanese flies to the first station:
 *             it becomes THE CALL (Flow.tsx).
 */
import React from 'react';
import { C, FONT, LIGHTS, TRACK, type LightId } from '../../theme';
import { bloom, mixColor } from '../../lib/lights';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { MeshOrb } from '../../components/MeshOrb';
import { SCALE, SCALE_LOCAL, vWord } from '../../timing';
import { VOICE } from '../../voice.generated';
import { Box, flashAt, HitBurst, IndustryFace, popFill } from './Cards';
import { dspring, slide } from './curves';
import { INDUSTRIES, LANGS, scriptRuns, underlined, wordsOf } from './data';
import { StationFace, type FlowTiming } from './Flow';
import { centre, mixRect, type Geo, type Rect } from './geometry';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { bodyOf, cardLight, discRest, FLOW_LIGHT, HERO_LIGHT, langLight, rgba } from './lights';

const K = SCALE_LOCAL;
const LA = SCALE.langAt;
const N = LANGS.length;
const CARRIER = N - 1;

/* ── timing per card ─────────────────────────────────────────────── */
/** her voice: the line's start, and where the next voice cuts it (the quick four) */
const voiceAt = (k: number) => LA[k];
const cutAt = (k: number) => (k >= 1 && k <= 4 ? LA[k + 1] : undefined);
/** the card has landed in the focus */
const arriveAt = (k: number) => (k === 0 ? K.enFlip + 6 : LA[k] - 1);
/** frame spoken word j is up (a frame early: it is there as she says it) */
const wordAt = (k: number, j: number) => voiceAt(k) + vWord(LANGS[k].id, j) - 1;

/** her loudness at t for card k (0..1), smoothed with a short release; silent before her line and after the cut */
export function envAt(k: number, t: number): number {
  const env = VOICE.lines[LANGS[k].id].env;
  const cut = cutAt(k);
  let e = 0;
  for (let j = 0; j < 4; j++) {
    const f = t - voiceAt(k) - j;
    const i = Math.floor(f);
    if (i < 0 || i >= env.length - 1) continue;
    if (cut !== undefined && voiceAt(k) + i >= cut) continue;
    const v = env[i] + (env[i + 1] - env[i]) * (f - i);
    e = Math.max(e, v * Math.pow(0.7, j));
  }
  return e;
}

/** the card's light: up as it lands, out as it recedes */
function litOf(k: number, t: number) {
  const a = arriveAt(k);
  const up = tween(t, [a - 3, a + 2], [0, 1], EASE.out3);
  const out =
    k === CARRIER
      ? tween(t, [K.carrierFly + 2, K.carrierFly + 10], [0, 1], EASE.inOut)
      : tween(t, [K.switchOut[k] + 1, K.switchOut[k] + 9], [0, 1], EASE.inOut);
  return up * (1 - out);
}

/* ── type ────────────────────────────────────────────────────────── */
/** the site's voice reveal: a unit rises .16 em → 0 and un-blurs 4 px → 0 as it is said */
function reveal(t: number, s0: number, size: number): React.CSSProperties {
  if (t < s0) return { display: 'inline-block', whiteSpace: 'pre', visibility: 'hidden' };
  const p = dspring(t - s0 + 0.5, { stiffness: 460, damping: 22, mass: 0.7 });
  const op = tween(t, [s0, s0 + 3], [0.15, 1], EASE.out3);
  const bl = tween(t, [s0, s0 + 5], [4, 0], EASE.out3);
  return {
    display: 'inline-block',
    whiteSpace: 'pre',
    opacity: op < 0.999 ? op : undefined,
    transform: p < 0.999 || p > 1.001 ? `translateY(${((1 - p) * size * 0.16).toFixed(2)}px)` : undefined,
    filter: bl > 0.1 ? `blur(${bl.toFixed(2)}px)` : undefined,
  };
}

const CJK_FONT = '"Noto Serif JP", serif';
const LATIN_FONT = '"Cormorant Garamond", Georgia, serif';
/** Cormorant beside Noto Serif JP: the Latin runs set 1.2× so their caps stand with the CJK */
const LATIN_IN_CJK = 1.2;

type LineOpts = {
  k: number;
  t: number;
  size: number;
  color: string;
  /** 0..1 the AI underline */
  underline: number;
  /** reveal frame of word j (undefined: shown) */
  at: (j: number) => number | undefined;
  light: LightId;
  thin?: boolean;
};

/** one line of a greeting: its words (indices), the AI words grouped under one underline */
function GreetingLine({ js, o }: { js: number[]; o: LineOpts }) {
  const l = LANGS[o.k];
  const words = wordsOf(l);
  const cjk = !!l.cjk;
  const inAi = (j: number) => j >= l.ai[0] && j <= l.ai[1];
  const segs: { ai: boolean; js: number[] }[] = [];
  for (const j of js) {
    const last = segs[segs.length - 1];
    if (last && last.ai === inAi(j)) last.js.push(j);
    else segs.push({ ai: inAi(j), js: [j] });
  }
  const ink = LIGHTS[o.light].ink;
  const body = bodyOf(o.light);
  /** a word's text as units: per character for Japanese (Latin runs in Cormorant), whole otherwise */
  const unit = (j: number, text: string) => {
    const s0 = o.at(j);
    if (!cjk)
      return (
        <span key={`w${j}`} style={s0 === undefined ? { display: 'inline-block', whiteSpace: 'pre' } : reveal(o.t, s0, o.size)}>
          {text}
        </span>
      );
    // Japanese: the characters of word j spread over its spoken span
    const chars = Array.from(text);
    const next = j + 1 < words.length ? o.at(j + 1) : undefined;
    const span = s0 === undefined || next === undefined ? 4 : Math.min(8, Math.max(1, next - s0));
    let ci = 0;
    return (
      <React.Fragment key={`w${j}`}>
        {scriptRuns(text).map((run, ri) =>
          Array.from(run.s).map((ch, i) => {
            const c = ci++;
            const st = s0 === undefined ? undefined : s0 + (span * c) / chars.length;
            return (
              <span
                key={`${ri}-${i}`}
                style={{
                  ...(st === undefined ? { display: 'inline-block', whiteSpace: 'pre' } : reveal(o.t, st, o.size)),
                  fontFamily: run.latin ? LATIN_FONT : CJK_FONT,
                  fontSize: run.latin ? o.size * LATIN_IN_CJK : o.size,
                }}
              >
                {ch}
              </span>
            );
          }),
        )}
      </React.Fragment>
    );
  };
  return (
    <div style={{ whiteSpace: 'nowrap', color: o.color }}>
      {segs.map((seg, si) => {
        const lastJ = seg.js[seg.js.length - 1];
        const tail = seg.ai ? words[lastJ].slice(underlined(words[lastJ]).length) : '';
        const content = seg.js.map((j, n) => (
          <React.Fragment key={j}>
            {n > 0 && !cjk ? ' ' : null}
            {unit(j, seg.ai && j === lastJ ? underlined(words[j]) : words[j])}
          </React.Fragment>
        ));
        const u = Math.min(1, Math.max(0, o.underline));
        return (
          <React.Fragment key={si}>
            {si > 0 && !cjk ? ' ' : null}
            {seg.ai ? (
              <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
                {content}
                {u > 0.001 ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: cjk ? -o.size * 0.06 : o.size * 0.06,
                      height: Math.max(o.thin ? 3 : 4, Math.round(o.size * (o.thin ? 0.05 : 0.055))),
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${body}, ${ink})`,
                      boxShadow: `0 0 ${(o.size * 0.14 * (1 - 0.5 * u)).toFixed(1)}px ${rgba(body, 0.5)}`,
                      transform: `scaleX(${u.toFixed(4)})`,
                      transformOrigin: '0 50%',
                    }}
                  />
                ) : null}
              </span>
            ) : (
              content
            )}
            {tail ? (
              <span style={o.at(lastJ) === undefined ? { display: 'inline-block', whiteSpace: 'pre' } : reveal(o.t, o.at(lastJ)!, o.size)}>{tail}</span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** split word indices [from, to) into lines of the given counts */
const linesOf = (from: number, counts: readonly number[]) => {
  let j = from;
  return counts.map((c) => Array.from({ length: c }, () => j++));
};

/* ── the faces ───────────────────────────────────────────────────── */
/**
 * The focus face, laid out for the focus card (w × h); `lit` is the card's
 * light (0..1), `env` her loudness now.
 */
export const LangFocusFace: React.FC<{ k: number; t: number; w: number; h: number; vertical: boolean; lit: number }> = ({ k, t, w, h, vertical: v, lit }) => {
  const l = LANGS[k];
  const light = langLight(k);
  const o = LIGHTS[light].orb;
  const pad = v ? 50 : 60;
  const D = v ? 104 : 120;
  const nameSize = v ? 32 : 36;
  const size = l.size[v ? 1 : 0];
  // the AI underline as she says it (English, Japanese; the quick four are cut before their AI phrase)
  const ul = k === 0 ? tween(t, K.discloseEn, [0, 1], EASE.draw) : k === CARRIER ? tween(t, K.discloseJa, [0, 1], EASE.draw) : 0;
  const mainLines = linesOf(0, l.main[v ? 1 : 0]);
  // the orb: pops as the card lands, then breathes with her voice
  const a = arriveAt(k);
  const e = envAt(k, t);
  const pop = dspring(t - a + 2, { stiffness: 520, damping: 15, mass: 0.6 });
  const os = (0.55 + 0.45 * pop) * (1 + 0.2 * e * lit);
  const oc = { x: pad + D / 2, y: pad + D / 2 };
  const hit = flashAt(t, a, 10);
  return (
    <>
      {/* the light of her voice: a bloom behind the orb, breathing with the envelope */}
      <div
        style={{
          position: 'absolute',
          left: oc.x - D * 1.7,
          top: oc.y - D * 1.7,
          width: D * 3.4,
          height: D * 3.4,
          background: bloom(light, Math.min(1, (0.22 + 0.6 * e + 0.5 * hit) * lit)),
        }}
      />
      {lit > 0.01 ? <HitBurst t={t} at={a} cx={oc.x} cy={oc.y} r={D / 2} light={light} seed={`lang-${k}`} n={8} /> : null}
      <div
        style={{
          position: 'absolute',
          left: oc.x - D / 2,
          top: oc.y - D / 2,
          width: D,
          height: D,
          transform: `scale(${Math.max(0, os).toFixed(4)})`,
          borderRadius: '50%',
          boxShadow: `0 0 ${(D * (0.25 + 0.35 * e) * lit).toFixed(1)}px ${rgba(o[2], (0.25 + 0.4 * e) * lit)}, 0 ${(D * 0.12).toFixed(1)}px ${(D * 0.3).toFixed(1)}px -${(D * 0.1).toFixed(1)}px ${rgba(o[0], 0.3 * lit)}`,
        }}
      >
        <MeshOrb size={D} palette={o} time={t / 30 + k * 2.3} />
        {lit < 0.999 ? <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', ...discRest(), opacity: 1 - lit }} /> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad + D + 26,
          top: oc.y - nameSize * 0.56,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: nameSize,
          lineHeight: 1,
          letterSpacing: TRACK.label,
          textTransform: 'uppercase',
          color: mixColor(C.muted, LIGHTS[light].ink, 0.35 * lit),
          whiteSpace: 'nowrap',
        }}
      >
        {l.name}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - size * 0.1,
          fontFamily: FONT.cinema,
          fontWeight: 500,
          fontSize: size,
          lineHeight: 1.06,
          letterSpacing: '-0.005em',
        }}
      >
        {mainLines.map((js, i) => (
          <GreetingLine key={i} js={js} o={{ k, t, size, color: C.ink, underline: ul, at: (j) => wordAt(k, j), light }} />
        ))}
      </div>
    </>
  );
};

/** The gallery face: the language's name and the words she said before the next one took over (no light). */
export const LangGalleryFace: React.FC<{ k: number; vertical: boolean }> = ({ k, vertical: v }) => {
  const l = LANGS[k];
  const pad = v ? 20 : 22;
  const dot = v ? 22 : 24;
  const nameSize = v ? 28 : 30;
  const size = v ? 42 : 46;
  const lines = linesOf(0, l.gallery[v ? 1 : 0]);
  return (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: dot, height: dot, borderRadius: '50%', ...discRest() }} />
        <div
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: nameSize,
            lineHeight: 1,
            letterSpacing: TRACK.label,
            textTransform: 'uppercase',
            color: C.muted,
            whiteSpace: 'nowrap',
          }}
        >
          {l.name}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - size * 0.12,
          fontFamily: FONT.cinema,
          fontWeight: 500,
          fontSize: size,
          lineHeight: 1.04,
        }}
      >
        {lines.map((js, i) => (
          <GreetingLine key={i} js={js} o={{ k, t: 0, size, color: C.ink, underline: 0, at: () => undefined, light: langLight(k) }} />
        ))}
      </div>
    </>
  );
};

/* ── the choreography ────────────────────────────────────────────── */
/** the language turn: a 2 f −8° anticipation, then −8 → 180 (≈ 7 f, a 3 % overshoot) */
const FLIP = { stiffness: 234, damping: 19.2, mass: 0.7 };
function halfTurn(L0: number, tt: number) {
  if (tt < L0 - 2) return 0;
  if (tt < L0) return -8 * Math.sin(((tt - (L0 - 2)) / 2) * (Math.PI / 2));
  return -8 + 188 * dspring(tt - L0 + 0.6, FLIP);
}
const SLIDE_IN = { w: 0.5, z: 0.62, over: 16 };
const TO_GALLERY = { w: 0.5, z: 0.66, over: 8, anticip: 2, back: 12 };
const CARRY = { w: 0.55, z: 0.62, over: 12, anticip: 3, back: 18 };

const focusOf = (G: Geo, k: number) => (k === 0 ? G.langEn : G.lang);
const dist = (a: Rect, b: Rect) => Math.hypot(centre(b).x - centre(a).x, centre(b).y - centre(a).y);

type Pose = { r: Rect; rot: number; leave: number; drop: number; carry: number };

/** where card k is at tt (null: not on stage) */
export function poseOf(G: Geo, k: number, tt: number): Pose | null {
  const F = focusOf(G, k);
  let r: Rect;
  let rot = 0;
  if (k === 0) {
    if (tt < K.glide - 4) return null;
    const g = aos(tt, K.glide, { anticip: 4, depth: 0.04, config: SPRING.site });
    r = mixRect(G.cards[G.keeper], F, g);
  } else {
    if (tt < K.switchIn[k]) return null;
    const from: Rect = { ...F, x: G.W + 60, y: F.y + 24 };
    const p = slide(tt - K.switchIn[k], dist(from, F), SLIDE_IN);
    r = mixRect(from, F, p);
    rot = 3.2 * (1 - p);
  }
  // recede into the gallery (Japanese: carried to the first station)
  let leave = 0;
  let carry = 0;
  if (k < CARRIER) {
    leave = slide(tt - K.switchOut[k], dist(F, G.gallery[k]), TO_GALLERY);
    r = mixRect(r, G.gallery[k], leave);
  } else {
    carry = slide(tt - K.carrierFly, dist(F, G.stations[0]), CARRY);
    r = mixRect(r, G.stations[0], carry);
  }
  // the gallery drops away for the flow
  let drop = 0;
  if (k < CARRIER) {
    const s = K.collapse + (G.W < G.H ? (k >= 3 ? 0 : 1 + k) : Math.abs(k - 2)) * K.collapseStagger;
    const A = 3;
    const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
    drop = tween(tt, [s, s + 12], [0, 1], EASE.in2);
    if (drop >= 1) return null;
    r = { ...r, y: r.y - 10 * pre + drop * 520 };
    rot += (k % 2 === 0 ? 1 : -1) * 4 * drop;
  }
  return { r, rot, leave, drop, carry };
}

export const LangCards: React.FC<{
  t: number;
  G: Geo;
  vertical: boolean;
  dim: number;
  flowT: FlowTiming;
  ind: { pad: number; iconSize: number; labelSize: number };
}> = ({ t, G, vertical: v, dim, flowT, ind }) => {
  const order = Array.from({ length: N }, (_, k) => k);
  const cards = order.map((k) => {
    const P = poseOf(G, k, t);
    if (!P) return null;
    const F = focusOf(G, k);
    const { r } = P;
    const id = `scale-lang-${k}`;
    // motion blur along the card's own travel (centre + size)
    const P0 = poseOf(G, k, t - 0.5);
    const P1 = poseOf(G, k, t + 0.5);
    let sx = 0;
    let sy = 0;
    if (P0 && P1) {
      const c0 = centre(P0.r);
      const c1 = centre(P1.r);
      sx = Math.min(26, sigmaFor(c1.x - c0.x) + sigmaFor(P1.r.w - P0.r.w) * 0.5);
      sy = Math.min(26, sigmaFor(c1.y - c0.y) + sigmaFor(P1.r.h - P0.r.h) * 0.5);
    }
    const lit = litOf(k, t);
    const light = langLight(k);
    const body = bodyOf(light);
    let transform: string | undefined = Math.abs(P.rot) > 0.01 ? `rotate(${P.rot.toFixed(3)}deg)` : undefined;
    let face: React.ReactNode;
    let opacity = 1 - tween(P.drop, [0.35, 1], [0, 1], EASE.inOut);
    let filter: string | undefined;
    let z = P.leave > 0.02 ? 2 : 3;
    // English: the keeper's industry face, until it turns
    if (k === 0) {
      const a = halfTurn(K.enFlip, t);
      const axis = v ? 'X' : 'Y';
      // the turn's shutter blur: the card's width collapses / opens fast mid-turn
      const a0 = halfTurn(K.enFlip, t - 0.5);
      const a1 = halfTurn(K.enFlip, t + 0.5);
      const fs = Math.min(16, sigmaFor(Math.abs(Math.cos((a1 * Math.PI) / 180) - Math.cos((a0 * Math.PI) / 180)) * ((v ? r.h : r.w) / 2)));
      if (v) sy = Math.max(sy, fs);
      else sx = Math.max(sx, fs);
      // the hero's dim lifts as it glides out of the wall
      const g = tween(t, [K.glide, K.glide + 10], [0, 1], EASE.inOut);
      opacity *= 1 - 0.58 * dim * (1 - g);
      const blurPx = 7 * dim * (1 - g);
      if (blurPx > 0.2) filter = `blur(${blurPx.toFixed(2)}px)`;
      if (a < 90) {
        const i = G.keeper;
        // the industry face grows with the card (it comes forward), until it turns
        const c0 = G.cards[i];
        const grow = Math.min(r.w / c0.w, r.h / c0.h);
        face = (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: c0.w,
              height: c0.h,
              transform: Math.abs(grow - 1) > 1e-4 ? `scale(${grow.toFixed(5)})` : undefined,
              transformOrigin: '0 0',
            }}
          >
            <IndustryFace
              d={INDUSTRIES[i]}
              t={t}
              at={K.pops[i]}
              tick={K.pops[i]}
              pad={ind.pad}
              iconSize={ind.iconSize}
              labelSize={ind.labelSize}
              light={cardLight(i)}
              lockAt={SCALE.industriesTitle}
              lockLight={HERO_LIGHT}
              still
            />
          </div>
        );
        transform = a !== 0 ? `perspective(2400px) rotate${axis}(${a.toFixed(3)}deg)` : transform;
      } else {
        const ra = a - 180;
        transform = Math.abs(ra) > 0.01 ? `perspective(2400px) rotate${axis}(${ra.toFixed(3)}deg)` : transform;
      }
      if (a >= 90) face = null; // set below
      if (t < K.glide + 6) z = 4;
    }
    const ref = dirBlurRef(id, sx, sy);
    filter = [ref, filter].filter(Boolean).join(' ') || undefined;
    if (!face) {
      // the focus face, scaled with the card as it recedes; the gallery face takes over
      const sc = Math.min(r.w / F.w, r.h / F.h);
      const fo = 1 - tween(P.leave, [0.08, 0.5], [0, 1], EASE.inOut);
      const go = tween(P.leave, [0.42, 0.85], [0, 1], EASE.inOut);
      const jaOut = k === CARRIER ? tween(t, [K.carrierFly - 1, K.carrierFly + 4], [0, 1], EASE.in2) : 0;
      const callIn = k === CARRIER ? tween(t, [K.callIn - 1, K.callIn + 3], [0, 1], EASE.out3) : 0;
      face = (
        <>
          {fo > 0.004 && jaOut < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: F.w,
                height: F.h,
                transform: sc < 0.9999 ? `scale(${sc.toFixed(5)})` : undefined,
                transformOrigin: '0 0',
                opacity: fo * (1 - jaOut),
              }}
            >
              <LangFocusFace k={k} t={t} w={F.w} h={F.h} vertical={v} lit={lit} />
            </div>
          ) : null}
          {go > 0.004 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: go }}>
              <LangGalleryFace k={k} vertical={v} />
            </div>
          ) : null}
          {callIn > 0 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: callIn }}>
              <StationFace i={0} t={t} T={flowT} vertical={v} />
            </div>
          ) : null}
        </>
      );
    }
    // the hit: the card's stock flashes its light as it lands (k ≥ 1; English as it turns)
    const land = flashAt(t, arriveAt(k), 7);
    let bg = land > 0.01 ? mixColor('#ffffff', LIGHTS[light].orb[3], 0.28 * land) : C.white;
    // THE CALL lands on its station: the closing light's flash
    if (k === CARRIER && t >= K.stations[0]) bg = popFill(t, K.stations[0], FLOW_LIGHT);
    const ring = lit > 0.01 ? rgba(body, 0.5 * lit) : undefined;
    const glow =
      lit > 0.01
        ? `0 0 0 1px ${rgba(body, 0.14 * lit)}, 0 30px 80px -34px ${rgba(body, 0.55 * lit)}, 0 0 60px -10px ${rgba(LIGHTS[light].orb[3], 0.5 * lit)}`
        : undefined;
    if (k === CARRIER && t >= K.stations[0] - 3) z = 4;
    return (
      <React.Fragment key={`lang-${k}`}>
        {ref ? <DirBlur id={id} sx={sx} sy={sy} /> : null}
        <Box
          r={r}
          transform={transform}
          opacity={opacity}
          lift={P.leave > 0 && P.leave < 1 ? 0.4 : 0}
          shadowAlpha={P.leave > 0.5 ? 0.75 : 1}
          bg={bg}
          ring={ring}
          glow={glow}
          z={z}
          filter={filter}
        >
          {face}
        </Box>
      </React.Fragment>
    );
  });
  return <>{cards}</>;
};

/** the first frame each card is on stage, and the last (for the scene's culling) */
export const LANG_SPAN = [K.glide - 4, K.stations[0] + 40] as const;
