/**
 * IgEnd — THE SHARED END CARD (docs/ig/SCRIPT.md §0.3 "The shared end card", built once, the same choreography in all
 * four reels; every moment from the reel's END_CARD, i.e. from her real word onsets):
 *
 *   1  CTA (75–83 % of the runtime). The last product shot steps back (× .92, shade .08: `step`, applied by the reel's
 *      backdrop to its own cards). The CTA line rises as captions CENTRED at y 700–860 (caption 68, ≤ 780 px), its
 *      keyword AGENT taking her teal on its onset. A white COMMENT FIELD (radius 60, the mesh-tinted elevation) rises at
 *      x 174–906, y 940–1060 BEFORE she says "Comment AGENT", so a muted viewer has the instruction: a lucide
 *      message-circle at x 214, a caret (blinking on the beat while idle), a teal send disc Ø 72 at x 812–884.
 *      AGENT TYPES one letter per 16th from her word "AGENT" (kit typed.ts: in place, a one-frame appearance, the caret
 *      jumping with it — never a rise); the send disc PRESSES (.97, the site's release spring) as her last word ends.
 *      Nothing imitates Instagram's own UI: no placeholder text, no logo, no username.
 *   2  IMPACT on the bar line (END − 60). The field and the caption leave up through their masks (4 f). ONE TEAL EMITTER
 *      (her light: a white-hot core in a tight teal bloom) gathers on the beat and bursts at the wordmark's centre, and
 *      the filled BACKLIGHT opens out of it (film 1's merged light on film 2's BLOOM spring; IgLightGL, the fork of
 *      film 2's LightGL: on a pearl ground it is laid over as a white-teal light, on ig2's night it is added as light);
 *      its rim keeps her teal at the diagonals. The NEUROVOICE wordmark (film 1 cta/EndCard Wordmark: Inter Tight 500,
 *      −0.07em, the plum ink, letters surfacing from the centre out as the light reaches them) sits at y 760–900,
 *      ≤ 800 px wide. "Neuro Tech Voice." is said 4 f after the impact, into its ring; neurotechvoice.com (Geist Mono 44,
 *      y ≈ 1000) TYPES in three chunks on "Neuro" | "Tech" | "Voice", a hairline drawing out from it to the field's
 *      margins. No "Start free" button: it is unspoken, and it would split the CTA.
 *   3  SEAM (the last 14 f). Just before it (4 f) the wordmark and the URL leave up through their masks and the light
 *      starts going out with the mix's fade curve; then the reel's FRAME-0 COMPOSITION re-forms (the reel's `seam` slot, rendered at hook time t − END ∈
 *      [−14, 0): its parts are pure functions of t, so they arrive exactly at frame 0's still); the ground crosses to
 *      frame 0's ground (the `ground` slot at mesh time t − END) over the seam, so the replay continues the picture.
 *
 * The reel's end act mounts it with its own slots (all optional but `ground`):
 *   <IgEnd T={T} t={f} tone="pearl" ground={(tm, s) => <PearlGround t={tm} … />} backdrop={(s) => <Grid step={s.step} …/>}
 *          orb={(s) => <AvaOrb … />} seam={(th) => <Ig1Frame0 t={th} />} />
 *
 * Every value is a pure function of the absolute timeline frame `t` (fractional at 120 fps).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import '../../scenes/cta/font/wordmark.css';
import { CornerDot } from '../../components/Type';
import { Wordmark, WORDMARK_FONT, WORDMARK_INK, WORDMARK_TEXT } from '../../scenes/cta/EndCard';
import { useFaceReady } from '../../lib/fonts';
import { subpixel } from '../../lib/glide';
import { hexToRgb, mixColor } from '../../lib/lights';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { TRACK } from '../../theme';
import { measureText, meshElevation, meshShadowInk, typedCount, typedOpacity, useKitFaces } from '../../kb/kit';
import { GRAPHITE } from '../../kb/theme';
import { INK_MESH, MOMENT_LIGHTS, MUTED_MESH } from '../../kb/palettes';
import { AGENT_STEP, BRAND as BRAND_ID } from '../common/series';
import type { ReelTimeline } from '../types';
import { VOICE } from '../voices';
import { useActFrame } from '../scene';
import { CAP_OUT, Captions, type CapPlace } from './Captions';

/** the CTA (caption + field) leaves up through its masks over CAP_OUT frames from here, so the stage is clear a frame
 *  before the bar and her light gathers in an empty frame (impact − CTA_EXIT) */
const CTA_EXIT = CAP_OUT + 1;
/** the brand (wordmark + URL) leaves up through its masks over the CAP_OUT frames before the seam — on the tail of her
 *  "…Voice." — and the light starts going out with it: the stage is clear when the reel's frame-0 composition starts
 *  re-forming (its caption rises from END − 13) */
const BRAND_OUT = (E: { seam: number }) => E.seam - CAP_OUT;
import { IgLightGL, type Core, type Glow, type IgLightUniforms } from './end/LightGL';
import { IgIcon } from './icons';
import { ZoneRect } from './ZoneGuard';

const SUNDAY = MOMENT_LIGHTS.sunday;
const rgb01 = (hex: string) => hexToRgb(hex) as [number, number, number];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothUnit = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/* ── the card's geometry (SCRIPT.md §0.3; all four reels) ── */
export const END = {
  /** the CTA caption: centred on y 780 (the band 700–860), ≤ 780 px */
  cta: { x: 540, y: 780, maxWidth: 780 } as const,
  /** the comment field */
  field: { x: 174, y: 940, w: 732, h: 120, r: 60, icon: { x: 214, size: 46 }, textX: 290, textSize: 50, send: { cx: 848, d: 72 } } as const,
  /** the backlight's centre = the wordmark's cap-line centre (y 760–900) */
  P: { x: 540, y: 830 } as const,
  /** the wordmark's widest (SCRIPT: ≤ 800) */
  wordmarkW: 760,
  /** the colophon */
  url: { y: 1000, size: 44, dot: 18, x0: 174, x1: 906 } as const,
} as const;

/** film 2's BLOOM: the backlight opening behind the word, ≈ 4 % over, settled in ≈ 16 f */
const BLOOM = { stiffness: 130, damping: 16.5, mass: 1 };
/** the scale the backlight opens from */
const BLOOM_FROM = 0.2;
/** the send disc back from its press: one soft overshoot (film 1 EndCard BACK) */
const BACK = { stiffness: 230, damping: 21, mass: 1 };

/** the backlight's colours: film 1/2's lilac (added as light on the night), the reels' sunday teal laid over the pearl */
export const BACKLIGHT = {
  lilac: ['#f4efff', '#dccfff', '#b298f6', '#36176f'],
  /** the pearl's: the sunday room's own ground stops (palettes.ts MOMENT_LIGHTS.sunday.ground: #cdf1f6 → #f6fdfe),
   *  strongest at the core — on a light ground the light is its colour */
  pearl: ['#b3e8f0', '#c2edf3', '#daf4f8', '#ecf9fb'],
} as const;

/* ── the card's clock ── */
export type EndState = {
  /** absolute frame */
  t: number;
  /** 0 → 1: the last product shot stepping back (× (1 − .08·step), shade .08·step) */
  step: number;
  /** 0 → 1(+): the backlight opening (BLOOM) */
  bloom: number;
  /** 0 → 1 over the seam */
  seam: number;
  /** the hook's time during the seam (t − END: −14 … 0) */
  tHook: number;
  /** the reel's frame-0 ground over the card's (0 → 1 over the seam) */
  toFrame0: number;
};

export function endState(T: ReelTimeline, t: number): EndState {
  const E = T.END_CARD;
  const s0 = Math.min(E.cta, E.field);
  return {
    t,
    step: tween(t, [s0, s0 + 18], [0, 1], EASE.inOut),
    bloom: t < E.impact ? 0 : springUnit(t - E.impact, BLOOM),
    seam: tween(t, [E.seam, T.DURATION], [0, 1], (u) => u),
    tHook: t - T.DURATION,
    toFrame0: EASE.inOut(clamp01((t - E.seam) / Math.max(1, T.DURATION - 1 - E.seam))),
  };
}

/** the CTA line: the voice that starts the end card */
export const ctaLine = (T: ReelTimeline) => T.VOICES.find((v) => v.at === T.END_CARD.cta)?.id ?? T.VOICES.filter((v) => v.at < T.END_CARD.impact).slice(-1)[0].id;
/** the index of the word AGENT in a line's say */
export const agentWord = (id: string) => ((VOICE.lines as Record<string, { say: string }>)[id]?.say ?? '').split(' ').findIndex((w) => w.replace(/[^A-Za-z]/g, '') === 'AGENT');

/** the frames AGENT types on (one letter per 16th from her word) — for the cue sheet too (common/series.ts endHits) */
export const agentKeys = (T: ReelTimeline) => Array.from({ length: 5 }, (_, i) => T.END_CARD.agent + i * AGENT_STEP);

/* ── the comment field ──────────────────────────────────────────── */

const FIELD_FONT = { size: END.field.textSize, weight: 500, tracking: 0.02 };

export const CommentField: React.FC<{
  t: number;
  /** rises at */
  at: number;
  /** the five keystrokes of AGENT */
  keys: readonly number[];
  /** the send disc presses */
  send: number;
  /** leaves up through its mask */
  exitAt: number;
  night?: boolean;
}> = ({ t, at, keys, send, exitAt, night = false }) => {
  const F = END.field;
  if (t < at - 1 || t > exitAt + 5) return null;
  // the rise: an object, on the site's spring from 72 px below, opaque within the first 35 % of its travel — on the
  // night opaque on its first render frame (a white field fading in on the dark passes through a grey, frosted state;
  // ig2 fix round 2)
  const e = springUnit(t - at, SPRING.site);
  let dy = (1 - e) * 72;
  let o = night ? tween(t, [at - 0.25, at], [0, 1], (x) => x) : smooth(0, 0.35, e);
  // the exit: up through its mask (4 f, power3.in)
  const q = tween(t, [exitAt, exitAt + 4], [0, 1], EASE.in3);
  dy -= q * (F.h + 24);
  o *= 1 - smooth(0.4, 1, q);
  const moving = Math.abs(dy) > 0.02;
  const typed = typedCount(t, keys);
  const word = 'AGENT';
  // the caret: after the last half-visible letter; solid while typing, blinking on the beat when idle
  const caretX = F.textX + (typed > 0 ? measureText(word.slice(0, typed), FIELD_FONT) + 4 : 0);
  const typing = t >= keys[0] - 0.5 && t < keys[keys.length - 1] + 8;
  const idleFrom = t < keys[0] ? at + 6 : keys[keys.length - 1] + 8;
  const ph = (((t - idleFrom) % 30) + 30) % 30;
  const blink = typing ? 1 : t < at + 6 ? 0 : ph < 15 ? smooth(0, 1.5, ph) : 1 - smooth(15, 16.5, ph);
  // the send disc: pale until the first letter, her teal once there is something to send; the press .97 on `send`
  const live = tween(t, [keys[0] - 0.5, keys[0] + 2], [0, 1], EASE.out3);
  const u = t - send;
  const press = u < 0 ? 1 : u < 2 ? mix(1, 0.97, EASE.out3(u / 2)) : mix(0.97, 1, springUnit(u - 2, BACK));
  const discC = mixColor('#c9eef4', SUNDAY.orb[2], live);
  const ringQ = tween(t, [send, send + 20], [0, 1], EASE.out3);
  const ink = meshShadowInk(night ? INK_MESH : MUTED_MESH);
  const cy = F.h / 2;
  const textW = measureText(word, FIELD_FONT);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${F.y - 2}px 0px 0px 0px)`, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: F.w,
            height: F.h,
            borderRadius: F.r,
            background: '#ffffff',
            boxShadow: meshElevation(night ? 3 : 2.4, ink, night ? 1.4 : 1),
            opacity: o >= 0.999 ? undefined : o,
            ...subpixel(`translate(${F.x}px, ${(F.y + dy).toFixed(3)}px)`, moving),
          }}
        >
          <div style={{ position: 'absolute', left: F.icon.x - F.x, top: cy - F.icon.size / 2 }}>
            <IgIcon name="messageCircle" size={F.icon.size} color="#7d7a86" stroke={1.9} />
          </div>
          {word.split('').map((ch, i) => {
            const a = typedOpacity(t, keys[i]);
            if (a <= 0.001) return null;
            const x = F.textX - F.x + measureText(word.slice(0, i), FIELD_FONT);
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: cy - FIELD_FONT.size * 0.62,
                  fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
                  fontWeight: FIELD_FONT.weight,
                  fontSize: FIELD_FONT.size,
                  letterSpacing: `${FIELD_FONT.tracking}em`,
                  lineHeight: 1.24,
                  color: GRAPHITE.text,
                  opacity: a >= 0.999 ? undefined : a,
                  whiteSpace: 'nowrap',
                }}
              >
                {ch}
              </span>
            );
          })}
          {blink > 0.002 ? <div style={{ position: 'absolute', left: caretX - F.x, top: cy - 30, width: 3, height: 60, borderRadius: 1.5, background: GRAPHITE.text, opacity: blink }} /> : null}
          {/* the send disc */}
          <div style={{ position: 'absolute', left: F.send.cx - F.x - F.send.d / 2, top: cy - F.send.d / 2, width: F.send.d, height: F.send.d, borderRadius: '50%', background: discC, transform: press !== 1 ? `scale(${press.toFixed(5)})` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IgIcon name="send" size={32} color="#ffffff" stroke={2.2} style={{ transform: 'translate(-1px, 1px)' }} />
          </div>
          {ringQ > 0 && ringQ < 1 ? (
            <svg width={F.w} height={F.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
              <circle cx={F.send.cx - F.x} cy={cy} r={(F.send.d / 2) * (1 + 0.55 * ringQ)} fill="none" stroke={SUNDAY.orb[2]} strokeOpacity={(0.5 * (1 - ringQ)).toFixed(4)} strokeWidth={1.5 + Math.max(0, 1 - ringQ * 2)} />
            </svg>
          ) : null}
        </div>
      </div>
      {typed > 0 && q < 0.5 ? <ZoneRect what="comment field AGENT" rect={{ x: F.textX, y: F.y + cy - FIELD_FONT.size * 0.62, w: textW, h: FIELD_FONT.size * 1.24 }} /> : null}
    </>
  );
};

/* ── the colophon: neurotechvoice.com ───────────────────────────── */

const URL_TEXT = 'neurotechvoice.com';
/** the three chunks: "neuro" | "tech" | "voice.com" on "Neuro" | "Tech" | "Voice" */
const URL_CHUNKS = [0, 5, 9] as const;
const URL_FONT = { size: END.url.size, weight: 460, mono: true } as const;

export const Colophon: React.FC<{ t: number; at: readonly number[]; exitAt: number; night?: boolean }> = ({ t, at, exitAt, night = false }) => {
  const U = END.url;
  if (t < at[0] - 2 || t > exitAt + 6) return null;
  // it sits IN the card's light on both grounds (on the night, the backlight's lower half): the wordmark's dark ink
  const ink = night ? WORDMARK_INK : GRAPHITE.text;
  const rule = night ? 'rgba(30,11,56,0.24)' : 'rgba(43,42,46,0.16)';
  const w = measureText(URL_TEXT, URL_FONT);
  const gap = 22;
  const dot = U.dot;
  const blockW = dot + 18 + w;
  const left = 540 - blockW / 2;
  const textX = left + dot + 18;
  // each chunk's letters type in place in a quick ripple (½ f apart) from its word
  const keyOf = (i: number) => {
    let k = 0;
    for (let c = 0; c < URL_CHUNKS.length; c++) if (i >= URL_CHUNKS[c]) k = c;
    return at[k] + (i - URL_CHUNKS[k]) * 0.5;
  };
  const draw = tween(t, [at[0] + 1, at[0] + 24], [0, 1], EASE.house);
  const dotS = springUnit(t - (at[0] - 1), SPRING.pop);
  const q = tween(t, [exitAt, exitAt + 5], [0, 1], EASE.in3);
  const fade = 1 - smooth(0.3, 1, q);
  const lift = -q * 40;
  const charW = w / URL_TEXT.length;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${U.y - 40}px 0px 0px 0px)`, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: fade >= 0.999 ? undefined : fade, ...subpixel(q > 0 ? `translateY(${lift.toFixed(3)}px)` : undefined, q > 0) }}>
          {/* the hairlines, drawing out from the URL to the field's margins */}
          <div style={{ position: 'absolute', left: U.x0, top: U.y, width: left - gap - U.x0, height: 1.25, background: rule, transform: `scaleX(${draw.toFixed(4)})`, transformOrigin: 'right' }} />
          <div style={{ position: 'absolute', left: left + blockW + gap, top: U.y, width: U.x1 - (left + blockW + gap), height: 1.25, background: rule, transform: `scaleX(${draw.toFixed(4)})`, transformOrigin: 'left' }} />
          <div style={{ position: 'absolute', left, top: U.y - dot / 2, transform: `scale(${Math.max(0, dotS).toFixed(4)})` }}>
            <CornerDot size={dot} color={SUNDAY.orb[2]} />
          </div>
          {URL_TEXT.split('').map((ch, i) => {
            const a = typedOpacity(t, keyOf(i));
            if (a <= 0.001) return null;
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: textX + i * charW,
                  top: U.y - U.size * 0.62,
                  fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
                  fontWeight: URL_FONT.weight,
                  fontSize: U.size,
                  lineHeight: 1.24,
                  color: ink,
                  opacity: a >= 0.999 ? undefined : a,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
      {q < 0.5 ? <ZoneRect what="url" rect={{ x: left, y: U.y - U.size * 0.62, w: blockW, h: U.size * 1.24 }} /> : null}
    </>
  );
};

/* ── the wordmark's size (≤ END.wordmarkW wide), measured as film 1 measures it ── */
function wordmarkEm(ready: boolean): number {
  if (!ready || typeof document === 'undefined') return 5.6;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 5.6;
  ctx.font = `500 1000px ${WORDMARK_FONT}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${parseFloat(TRACK.wordmark) * 1000}px`;
  ctx.fontKerning = 'normal';
  return ctx.measureText(WORDMARK_TEXT).width / 1000 - parseFloat(TRACK.wordmark);
}

/* ── the card ───────────────────────────────────────────────────── */

export type IgEndProps = {
  T: ReelTimeline;
  /** ABSOLUTE timeline frame */
  t: number;
  tone: 'pearl' | 'night';
  /** the reel's ground at a mesh time (the card's own, then frame 0's crossing in over the seam) */
  ground: (tMesh: number, s: EndState) => React.ReactNode;
  /** the last product shot (it applies s.step to its own cards: × (1 − .08 step), shade .08 step) */
  backdrop?: (s: EndState) => React.ReactNode;
  /** her orb (the reel poses it; it closes into the frame-0 light in the seam) */
  orb?: (s: EndState) => React.ReactNode;
  /** the reel's frame-0 composition at hook time (−14 … 0), drawn over the card in the seam */
  seam?: (tHook: number) => React.ReactNode;
  /** the CTA caption's place (default centred on y 780, ≤ 780 px) */
  ctaPlace?: Partial<CapPlace>;
  /** the backlight's look on the pearl: the reels' teal (default) or the films' lilac */
  pearlLight?: 'teal' | 'lilac';
  /** optional: the light's last stretch, u 0 → 1 over [the brand's exit, the last frame] → × gain (default: none, the
   *  mix's exponential curve alone). The default curve meets 0 on the last frame with an infinite slope (≈ 9 % left a
   *  quarter-frame before it), which a night ground shows as a blink at the loop; a reel may ease the tail to 0. */
  lightTail?: (u: number) => number;
  /** optional, the pearl's teal light only (default: none — BACKLIGHT.pearl, a .18 core, the emitter's own burst): a
   *  reel's fuller light — `stops` its colours (core, high, mid, edge), `core` its heart's whitening (uMerge.w), `burst`
   *  × the emitter's bloom ON the bar (so the impact's own frame lands as light, not as a speck, on a light ground) */
  pearlLook?: { stops?: readonly [string, string, string, string]; core?: number; burst?: number };
};

export const IgEnd: React.FC<IgEndProps> = ({ T, t, tone, ground, backdrop, orb, seam, ctaPlace, pearlLight = 'teal', lightTail, pearlLook }) => {
  const kit = useKitFaces();
  const wmReady = useFaceReady(`500 100px ${WORDMARK_FONT}`, WORDMARK_TEXT);
  const E = T.END_CARD;
  const s = endState(T, t);
  const night = tone === 'night';
  const I = E.impact;
  const P = END.P;
  const cta = ctaLine(T);
  const ag = agentWord(cta);
  const keys = agentKeys(T);

  /* the wordmark: ≤ 760 px wide, its cap line centred on P */
  const em = wordmarkEm(wmReady);
  const wmSize = Math.min(140, Math.floor(END.wordmarkW / em));
  // film 2's backlight proportions on the night; on the pearl a wider, softer pool (its gaussian has no edge)
  const halo: [number, number, number] = night ? [wmSize * 3.45, wmSize * 1.66, wmSize * 1.55] : [wmSize * 3.3, wmSize * 2.0, wmSize * 1.85];
  const R = (sigma: number) => sigma * Math.SQRT2;

  /* the light's moments: a pin of her light gathers over the 3 f before the bar, bursts on it, the backlight opens */
  // (the gather runs over the last 2 f before the bar, once the CTA has left: CTA_EXIT; after the bar the hot core is
  // gone within a frame — a white point lingering on the surfacing "O" reads as a speck, not a light)
  const g = t < I - 2 ? 0 : t < I ? Math.sin(((t - (I - 2)) / 2) * (Math.PI / 2)) : Math.max(0, 1 - (t - I) / 1.2);
  const burst = tween(t, [I, I + 7], [0, 1], EASE.out3);
  const haloScale = mix(BLOOM_FROM, 1, s.bloom);
  const flare = t < I ? 0 : Math.exp(-(t - I) / 6);
  // her voice breathes in the light ("Neuro Tech Voice.")
  const brandEnv = (() => {
    const e = (VOICE.lines as Record<string, { env: readonly number[] }>)[BRAND_ID]?.env ?? [];
    const k = t - E.brand;
    if (k < 0 || k > e.length - 1) return 0;
    const i = Math.floor(k);
    return e[i] + ((e[i + 1] ?? 0) - e[i]) * (k - i);
  })();
  // the light goes out over the seam (with the mix's exponential fade, as light: film 2's endLight)
  const out = (() => {
    if (t <= BRAND_OUT(E)) return 1;
    const u = Math.min(1, (t - BRAND_OUT(E)) / Math.max(1, T.DURATION - 1 - BRAND_OUT(E)));
    const z = Math.exp(-2);
    return Math.pow(Math.max(0, (Math.exp(-2 * u) - z) / (1 - z)), 1 / 2.2) * (lightTail ? lightTail(u) : 1);
  })();
  const teal = SUNDAY.orb[2];
  const hot = mixColor('#f4fdff', SUNDAY.orb[3], 0.35);
  const glows: Glow[] = [];
  const cores: Core[] = [];
  if (t >= I - 2 && t < I) {
    glows.push({ x: P.x, y: P.y, r: R(13 * (0.45 + 0.25 * g)), s: 0.42 * g, color: rgb01(teal) });
    cores.push({ x: P.x, y: P.y, r: 1.4 + 3 * g, s: 0.9 * g, color: rgb01(teal) });
  } else if (t >= I) {
    // the burst: her light gives itself away — white-teal, hot for 2–3 frames, handing over to the backlight
    const kB = !night && pearlLook?.burst ? pearlLook.burst : 1;
    glows.push({ x: P.x, y: P.y, r: mix(R(13 * 1.6) * kB, halo[0] * 0.5, burst), s: (night ? 0.85 : 0.7) * Math.exp(-(t - I) / 2.2), color: rgb01(night ? hot : teal) });
    if (g > 0) cores.push({ x: P.x, y: P.y, r: 4.5 + 6 * (1 - g), s: g, color: rgb01(teal) });
  }
  const pearlStops = !night && pearlLight !== 'lilac' && pearlLook?.stops ? pearlLook.stops : BACKLIGHT.pearl;
  const stops = (night || pearlLight === 'lilac' ? (night ? BACKLIGHT.lilac : ['#ffffff', '#f7f3ff', '#e9e0ff', '#c4a8ff']) : pearlStops).map(rgb01) as IgLightUniforms['stops'];
  const u: IgLightUniforms = {
    haloC: [P.x, P.y],
    haloR: [halo[0] * haloScale, halo[1] * haloScale, halo[2] * haloScale],
    haloGain: t < I ? 0 : smoothUnit(s.bloom / 0.5) * (1 + 0.22 * flare) * (1 + 0.04 * brandEnv) * out,
    merge: night ? [1, 0.72, 0.42, 0.05] : [1, 0, 0, pearlLook?.core ?? 0.18],
    floor: [P.y + wmSize * 1.3, wmSize * 1.4, (night ? 0.4 : 0.32) * tween(t, [I + 4, I + 30], [0, 1], EASE.inOut), wmSize * 0.5],
    glows,
    cores,
    // the night's rim (film 2: the lights' colours at the diagonals): her teal at the top right, where her light came
    // from, the night's own light round the rest — never a ring of one hue
    rim: [night ? 0.6 * tween(t, [I + 4, I + 22], [0, 1], EASE.inOut) : 0, 0, 0, 0.45],
    rimColors: [rgb01(BACKLIGHT.lilac[2]), rgb01(mixColor(teal, BACKLIGHT.lilac[2], 0.3)), rgb01(BACKLIGHT.lilac[2]), rgb01(mixColor(teal, BACKLIGHT.lilac[2], 0.7))],
    wide: [5.5, night ? 0.07 : 0.05],
    seed: 0,
    stops,
    tint: night ? 0 : 1,
  };
  const glOn = t >= I - 4 && t < T.DURATION;

  /* the wordmark: from the centre out as the light reaches each letter; it leaves up through its mask in the seam */
  const arrive = (xEm: number) => {
    const target = Math.min(0.98, (xEm * wmSize + 0.3 * wmSize) / halo[0]);
    if (target <= BLOOM_FROM) return -1;
    for (let dt = 0; dt < 30; dt += 0.1) if (mix(BLOOM_FROM, 1, springUnit(dt, BLOOM)) >= target) return dt + 1;
    return 10;
  };
  const wmQ = tween(t, [BRAND_OUT(E), E.seam], [0, 1], EASE.in3);
  const wmW = em * wmSize;
  // (film 1's Wordmark: a line-height-1 box whose cap line is centred on y — its top half an em above)
  const wmTop = P.y - wmSize * 0.5;
  const restAt = (_t: number, v: number) => v;

  /* the CTA caption */
  const place: CapPlace = { x: END.cta.x, y: END.cta.y, valign: 'center', maxWidth: END.cta.maxWidth, align: 'center', role: 'caption', tone: night ? 'night' : 'paper', ...ctaPlace };
  const keyInk = night ? '#a5eaf5' : SUNDAY.ink;

  return (
    <AbsoluteFill>
      {ground(t, s)}
      {s.toFrame0 > 0.001 ? <AbsoluteFill style={{ opacity: s.toFrame0 >= 0.999 ? undefined : s.toFrame0 }}>{ground(s.tHook, s)}</AbsoluteFill> : null}
      {backdrop ? backdrop(s) : null}
      {orb ? orb(s) : null}
      {glOn && kit ? <IgLightGL width={1080} height={1920} u={u} quality={t < I + 8 ? 1 : 0.5} /> : null}
      {/* the CTA */}
      <Captions T={T} id={cta} t={t} place={place} keys={ag >= 0 ? [{ words: [ag], ink: keyInk, glint: night ? '#f0fdff' : SUNDAY.orb[2] }] : []} timing={{ exitAt: I - CTA_EXIT }} what="cta caption" />
      {kit ? <CommentField t={t} at={E.field} keys={keys} send={E.send} exitAt={I - CTA_EXIT} night={night} /> : null}
      {/* the brand */}
      {t >= I - 1 && t < E.seam + 2 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${(wmTop - 24).toFixed(1)}px 0px 0px 0px)` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: wmQ > 0 ? 1 - smooth(0.35, 1, wmQ) : undefined, ...subpixel(wmQ > 0 ? `translateY(${(-wmQ * wmSize * 1.1).toFixed(3)}px)` : undefined, wmQ > 0) }}>
            <Wordmark t={t} at={I} ready={wmReady} rest={restAt} spec={{ x: P.x, y: P.y, size: wmSize, arrive, color: WORDMARK_INK }} />
          </div>
        </div>
      ) : null}
      {t >= I && t < E.seam ? <ZoneRect what="wordmark" rect={{ x: P.x - wmW / 2, y: wmTop, w: wmW, h: wmSize * 1.0 }} /> : null}
      {kit ? <Colophon t={t} at={E.url} exitAt={BRAND_OUT(E)} night={night} /> : null}
      {/* the seam: the reel's frame-0 composition re-forms over the card */}
      {seam && t >= E.seam ? seam(s.tHook) : null}
    </AbsoluteFill>
  );
};

/** a light key for the reel's ground under the card (the backlight's own light on the mesh), 0 before the impact */
export const endGroundKey = (T: ReelTimeline, t: number, night: boolean) => {
  const s = endState(T, t);
  const k = clamp01(s.bloom) * (1 - s.toFrame0);
  return { x: END.P.x, y: END.P.y, strength: (night ? 0.5 : 0.3) * k, color: night ? '#b298f6' : SUNDAY.orb[3] };
};



/**
 * A reel's `end` act as the shared card alone (the reel's own act can mount <IgEnd> directly to add its backdrop, orb
 * and seam): the act's absolute frame from the reel's act clock.
 */
export function endAct(T: ReelTimeline, props: Omit<IgEndProps, 'T' | 't'>): React.FC {
  const Act: React.FC = () => {
    const t = useActFrame(T.SCENES, 'end');
    return <IgEnd T={T} t={T.SCENES.end.from + t} {...props} />;
  };
  Act.displayName = `${T.REEL}-end`;
  return Act;
}
