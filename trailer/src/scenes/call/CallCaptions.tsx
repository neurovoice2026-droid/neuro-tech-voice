/**
 * The call's live captions — the shared <Captions> (components/Captions.tsx),
 * with what the call needs on top. Same timing model, same entrance, same
 * echo slot; everything is a pure function of `t` (the frame space of
 * `lineAt`).
 *
 *   heard = read   a caption word may carry its own spoken frame (`at`, from
 *                  the line's start): the voice says words the aligner has no
 *                  word for ("Oh,", "Um…", "Thank you!") — they are captioned
 *                  on the real voice (call/voice.ts `onsets`) instead of being
 *                  heard and never read.
 *   the cut        `notBefore`: no word of the line rises before its shot (the
 *                  speaker tag swaps on the cut, the first word rises after it).
 *   the exit       a DESIGNED exit, word by word (≤ 3 f of stagger in all):
 *                  2 f anticipation (lift 4 px, scale 1.01), then a 5 f drop of
 *                  18 px on power3.in, fading early; the fastest 2 frames are
 *                  smeared vertically (an SVG gaussian ∝ the word's speed).
 *                  A caption is (all but) gone before the next one rises —
 *                  never a blink, never two on top of each other. (Only when
 *                  the next voice leaves it under ≈ 8 f does it move up to
 *                  the echo slot; the same exit takes it out of there.)
 *
 * Exports `wordExit` so the booked mark's period leaves with its row.
 */
import React from 'react';
import { Easing } from 'remotion';
import { EASE, mixHex, SPRING, springAt } from '../../lib/motion';
import { BEAT, FPS, vWord, type Caption } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';

export type CallCaption = Caption & {
  /** per caption word: its spoken frame (from the line's start) when the aligner has no word for it */
  at?: readonly (number | null)[];
};

export type CaptionFont = {
  family: string;
  weight: number;
  size: number;
  italic?: boolean;
  lineHeight: number;
  /** letter-spacing: a CSS length, or a number in em */
  tracking: string | number;
};

export type CallCaptionsProps = {
  t: number;
  lineAt: number;
  voice: VoiceId;
  captions: readonly CallCaption[];
  x: number;
  y: number;
  maxWidth: number;
  font: CaptionFont;
  color: string;
  glow: string;
  /** the line's last caption is (all but) gone by here (never less than a beat after its last word) */
  holdUntil: number;
  echoY: number | null;
  echoBlock?: readonly [number, number];
  /** no word rises before this frame (the shot's cut) */
  notBefore?: number;
  lead?: number;
  /** unique per instance (the exit's smear filters) */
  id: string;
  tint?: (caption: number, word: number) => { color: string; k: number } | null | undefined;
  underline?: {
    caption: number;
    words: readonly [number, number];
    p: number;
    color: string;
    thickness: number;
    shadow?: string;
    topEm?: number;
  };
};

const ENTER = 6;
const SETTLE = 6;
const SPOKEN = 0.86;
const ECHO_LEAD = 3;
const HOLD = BEAT;

/* ── the exit ─────────────────────────────────────────────────────── */
export const EXIT_PRE = 2;
export const EXIT_DROP = 5;
const EXIT_LIFT = 4;
const EXIT_FALL = 18;
/** the whole caption's stagger (frames from its first word's exit to its last's) */
const STAGGER_MAX = 3;
const stagger = (n: number) => (n > 1 ? Math.min(1, STAGGER_MAX / (n - 1)) : 0);
/** frames a caption of n words takes to leave */
export const exitLength = (n: number) => EXIT_PRE + EXIT_DROP + stagger(n) * (n - 1);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** power3.in (GSAP) — the drop, the dive */
export const in3 = Easing.bezier(0.55, 0.055, 0.675, 0.19);
const dropY = (u: number) => -EXIT_LIFT + (EXIT_LIFT + EXIT_FALL) * in3(u);

/**
 * One word's exit from `at` (its own start, stagger included): the anticipation lifts it 4 px and
 * swells it 1 %, then it drops 18 px on power3.in, fading early. `speed` is px / frame (for the smear).
 */
export function wordExit(t: number, at: number): { dy: number; scale: number; op: number; speed: number } | null {
  if (t < at) return null;
  const yAt = (tt: number) => {
    const u = clamp01((tt - at - EXIT_PRE) / EXIT_DROP);
    return u > 0 ? dropY(u) : -EXIT_LIFT * EASE.inOut(clamp01((tt - at) / EXIT_PRE));
  };
  const pre = clamp01((t - at) / EXIT_PRE);
  const u = clamp01((t - at - EXIT_PRE) / EXIT_DROP);
  return {
    dy: yAt(t),
    scale: 1 + 0.01 * EASE.inOut(pre) - 0.03 * EASE.in2(u),
    op: Math.pow(1 - u, 2),
    speed: Math.abs(yAt(t + 0.5) - yAt(t - 0.5)),
  };
}

/** Frame (from the line's start) at which spoken word k ends: the next word, or the end of its phrase. */
function wordEnd(voice: VoiceId, k: number): number {
  const line = VOICE.lines[voice];
  const w = line.words;
  const t = w[k].t;
  const next = k + 1 < w.length ? w[k + 1].t : line.duration;
  const phrase = line.phrases.find((p) => t >= p.start - 0.02 && t < p.end);
  const end = Math.min(next, phrase ? phrase.end : next);
  return Math.round(end * FPS);
}

type Plan = {
  words: string[];
  spoken: number[];
  speakEnd: number[];
  appear: number[];
  start: number;
  lastSpoken: number;
  /** frame its exit (or its move to the echo slot) starts */
  out: number;
  mode: 'replace' | 'echo';
  echoOut: number;
  /** 0..1 the share of the word-by-word stagger the exit has room for (1 = all of it) */
  squeeze: number;
};

function plan(p: CallCaptionsProps): Plan[] {
  const { lineAt, voice, captions, holdUntil, echoY, echoBlock, notBefore = -Infinity } = p;
  const lead = p.lead ?? 2;
  const idx = (c: Caption, j: number) => c.map?.[j] ?? c.word + j;
  const plans: Plan[] = captions.map((c) => {
    const words = c.text.split(' ');
    const own = (j: number) => c.at?.[j] ?? null;
    const spoken = words.map((_, j) => lineAt + (own(j) ?? vWord(voice, idx(c, j))));
    const speakEnd = words.map((_, j) => {
      if (own(j) === null) return lineAt + wordEnd(voice, idx(c, j));
      // a word of its own lasts until the next word is heard (or ~ a third of a second)
      return j + 1 < words.length ? spoken[j + 1] : spoken[j] + 10;
    });
    const appear = spoken.map((s) => Math.max(s - lead, notBefore));
    return {
      words,
      spoken,
      speakEnd,
      appear,
      start: Math.min(...appear),
      lastSpoken: Math.max(...spoken),
      out: Infinity,
      mode: 'replace' as const,
      echoOut: Infinity,
      squeeze: 1,
    };
  });
  plans.forEach((pl, c) => {
    const isLast = c === plans.length - 1;
    const len = exitLength(pl.words.length);
    // the anticipation still reads (the words only lift 4 px): it may sit inside the beat-after
    const minEnd = pl.lastSpoken + HOLD - EXIT_PRE;
    if (isLast) {
      // gone by holdUntil (the next voice's first word): as late as that allows — but when the next
      // voice cuts in less than a beat after the last word, it may leave early, never before its last
      // word has been heard and read for ≈ 8 f (the exit's own anticipation still reads)
      pl.out = Math.max(pl.lastSpoken + 6, holdUntil - len);
      pl.squeeze = Math.max(0, Math.min(1, (holdUntil - pl.out - EXIT_PRE - EXIT_DROP) / Math.max(1e-6, len - EXIT_PRE - EXIT_DROP)));
      return;
    }
    const next = plans[c + 1].start;
    // gone (to its faint last two frames) as the next caption's first word rises — when the voice moves
    // on quickly, that may be less than a beat after its last word, never less than ≈ 8 f (the cascade
    // takes the last word out last); only when even that is not there does it move up to the echo slot
    const want = next - len + 2;
    if (want >= pl.lastSpoken + 6) {
      pl.out = want;
    } else if (echoY !== null && !(echoBlock && next <= echoBlock[1] && minEnd + len >= echoBlock[0])) {
      pl.mode = 'echo';
      pl.out = Math.min(next, Math.max(pl.lastSpoken + ECHO_LEAD, next - ECHO_LEAD));
      pl.echoOut = minEnd;
    } else {
      // no echo slot: it leaves as late as the beat-after rule needs (the next rises under its fade)
      pl.out = Math.min(minEnd, next);
    }
  });
  let prevEcho: Plan | null = null;
  for (const pl of plans) {
    if (pl.mode !== 'echo') continue;
    if (prevEcho && prevEcho.echoOut > pl.out - EXIT_DROP) prevEcho.echoOut = Math.max(prevEcho.out + 2, pl.out - EXIT_DROP);
    prevEcho = pl;
  }
  return plans;
}

/** the smear's three strengths (vertical σ, px): a word picks the nearest */
const SMEAR = [1.5, 3, 5] as const;

export const CallCaptions: React.FC<CallCaptionsProps> = (props) => {
  const { t, x, y, maxWidth, font, color, glow, echoY, tint, underline, id } = props;
  const plans = plan(props);
  const rowH = font.size * font.lineHeight;
  const tracking = typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking;
  const left = x - maxWidth / 2;
  let smearUsed = false;

  const blocks = plans.map((pl, c) => {
    if (t < pl.start - 1) return null;
    const exitFrom = pl.mode === 'echo' ? pl.echoOut : pl.out;
    const stg = stagger(pl.words.length) * pl.squeeze;
    if (t > exitFrom + exitLength(pl.words.length)) return null;

    /* the echo: the site spring up into the echo slot (scale .86, opacity .42) */
    let dy = 0;
    let dyPct = 0;
    let scale = 1;
    let opacity = 1;
    const echoing = pl.mode === 'echo' && t >= pl.out;
    if (echoing && echoY !== null) {
      const s = springAt(t, pl.out, SPRING.site);
      const sE = 0.86;
      dy = (echoY - y + (rowH / 2) * sE + (rowH / 2) * sE) * s;
      dyPct = -100 * sE * s;
      scale = 1 - (1 - sE) * s;
      opacity = 1 - 0.58 * Math.min(1, s);
    }

    const words = pl.words.map((w, j) => {
      const a = pl.appear[j];
      const u = Math.min(1, Math.max(0, (t - a + 1) / ENTER));
      const e = EASE.out3(u);
      const ex = wordExit(t, exitFrom + j * stg);
      const speaking = t >= a && t < pl.speakEnd[j] && !echoing && !ex;
      const after = Math.max(0, t - Math.max(pl.speakEnd[j], a + ENTER));
      const dim = speaking ? 1 : 1 - (1 - SPOKEN) * EASE.inOut(Math.min(1, after / SETTLE));
      const tn = tint?.(c, j);
      const col = tn && tn.k > 0.001 ? mixHex(color, tn.color, tn.k) : color;
      const g = speaking ? 1 : 1 - Math.min(1, after / SETTLE);
      const sm = ex && ex.speed > 4 ? SMEAR.reduce((m, s, k) => (Math.abs(s - ex.speed * 0.35) < Math.abs(SMEAR[m] - ex.speed * 0.35) ? k : m), 0) : -1;
      if (sm >= 0) smearUsed = true;
      const enterY = u < 1 ? `${(0.16 * (1 - e)).toFixed(4)}em` : '0px';
      const st: React.CSSProperties = {
        display: 'inline-block',
        opacity: (u <= 0 ? 0 : e * dim) * (ex ? ex.op : 1),
        color: col,
        transform:
          u < 1 || ex
            ? `translateY(calc(${enterY} + ${(ex ? ex.dy : 0).toFixed(2)}px))${ex ? ` scale(${ex.scale.toFixed(4)})` : ''}`
            : undefined,
        filter: sm >= 0 ? `url(#${id}-sm${sm})` : u > 0 && u < 1 ? `blur(${(3 * (1 - e)).toFixed(2)}px)` : undefined,
        textShadow: u > 0 && g > 0.02 ? `0 0 0.35em ${scaleAlpha(glow, g)}` : undefined,
      };
      return { w, st, ex };
    });
    if (words.every((wd) => wd.ex && wd.ex.op <= 0.002)) return null;

    const nodes: React.ReactNode[] = [];
    const ul = underline && underline.caption === c ? underline : null;
    for (let j = 0; j < words.length; j++) {
      if (j > 0) nodes.push(' ');
      if (ul && j === ul.words[0]) {
        const inner: React.ReactNode[] = [];
        for (let k = ul.words[0]; k <= ul.words[1]; k++) {
          if (k > ul.words[0]) inner.push(' ');
          inner.push(
            <span key={k} style={words[k].st}>
              {words[k].w}
            </span>,
          );
        }
        const p = Math.min(1, Math.max(0, ul.p));
        const topEm = ul.topEm ?? (font.lineHeight - 1.2109) / 2 + 0.96875 + 0.16;
        // the underline leaves with the first word it sits under
        const uex = words[ul.words[0]].ex;
        nodes.push(
          <span key={`ul${j}`} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'nowrap' }}>
            {inner}
            {p > 0.001 ? (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `calc(${topEm.toFixed(4)}em - ${(ul.thickness / 2).toFixed(2)}px)`,
                  width: `${(p * 100).toFixed(3)}%`,
                  minWidth: ul.thickness,
                  height: ul.thickness,
                  borderRadius: ul.thickness / 2,
                  background: ul.color,
                  boxShadow: ul.shadow,
                  opacity: uex ? uex.op : 1,
                  transform: uex ? `translateY(${uex.dy.toFixed(2)}px)` : undefined,
                }}
              />
            ) : null}
          </span>,
        );
        j = ul.words[1];
        continue;
      }
      nodes.push(
        <span key={j} style={words[j].st}>
          {words[j].w}
        </span>,
      );
    }

    return (
      <div
        key={c}
        style={{
          position: 'absolute',
          left,
          top: y - rowH / 2,
          width: maxWidth,
          transform: `translateY(calc(${dy.toFixed(2)}px + ${dyPct.toFixed(2)}%)) scale(${scale.toFixed(4)})`,
          transformOrigin: `${(x - left).toFixed(1)}px ${(rowH / 2).toFixed(1)}px`,
          opacity,
          textAlign: 'center',
          textWrap: 'balance',
          fontFamily: font.family,
          fontWeight: font.weight,
          fontStyle: font.italic ? 'italic' : 'normal',
          fontSize: font.size,
          lineHeight: font.lineHeight,
          letterSpacing: tracking,
          color,
          whiteSpace: 'normal',
        }}
      >
        {nodes}
      </div>
    );
  });

  return (
    <>
      {smearUsed ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            {SMEAR.map((s, k) => (
              <filter key={k} id={`${id}-sm${k}`} x="-5%" y="-60%" width="110%" height="220%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation={`0 ${s}`} />
              </filter>
            ))}
          </defs>
        </svg>
      ) : null}
      {blocks}
    </>
  );
};

/** Multiply the alpha of an rgba() / rgb() colour string by k. */
function scaleAlpha(rgba: string, k: number): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const parts = m[1].split(',').map((s) => s.trim());
  const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${(a * k).toFixed(3)})`;
}
