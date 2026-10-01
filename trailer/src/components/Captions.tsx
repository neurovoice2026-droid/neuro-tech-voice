/**
 * Live captions, driven by the real voice (src/voice.generated.ts).
 *
 * Shared by the CALL and the KNOWLEDGE scenes. Everything is a pure
 * function of `t` (the same frame space as `lineAt`).
 *
 * Timing
 *   caption c starts at  s_c = lineAt + vWord(voice, c.word)
 *   its word j appears at     lineAt + vWord(voice, c.map?.[j] ?? c.word + j) − lead
 *   (word times are length-proportional estimates, so words lead the voice)
 *
 * Layout — each caption is laid out once (text-wrap: balance); row A is
 * centred on `y`, wrapped rows grow downward. Unrevealed words sit in place
 * at opacity 0: nothing ever reflows.
 *
 * Words — the site's WORD_FROM → WORD_TO, compressed: opacity 0 → 1,
 * translateY .16em → 0, blur 3 → 0 px over 6 f (power3.out). The word being
 * spoken is at 100 % with a soft glow; words already spoken ease to 86 %.
 *
 * Replacement — at s_{c+1} the outgoing caption leaves (−30 % y, 4 px blur,
 * fade, 4 f, power2.in) while the incoming one starts. If that would take it
 * off screen less than a beat (15 f) after its last word, it moves up to
 * `echoY` instead (scale .86, opacity .42, the site spring; it starts lifting
 * 3 f before the incoming caption appears, so they never overlap) and leaves a beat
 * after its last word (−20 px, blur 4, fade, 5 f). One echo at a time. With
 * `echoY = null` it simply holds until s_{c+1}. A line's last caption holds
 * until `holdUntil` (never less than a beat after its last word).
 */
import React from 'react';
import { EASE, mixHex, SPRING, springAt, tween } from '../lib/motion';
import { BEAT, FPS, vWord, type Caption } from '../timing';
import { VOICE, type VoiceId } from '../voice.generated';

export type CaptionFont = {
  family: string;
  weight: number;
  size: number;
  italic?: boolean;
  lineHeight: number;
  /** letter-spacing: a CSS length, or a number in em */
  tracking: string | number;
};

export type CaptionsProps = {
  t: number;
  /** frame the spoken line starts (same frame space as `t`) */
  lineAt: number;
  voice: VoiceId;
  captions: readonly Caption[];
  /** anchor x (centre for align 'center', left / right edge otherwise) */
  x: number;
  /** centre of row A */
  y: number;
  maxWidth: number;
  font: CaptionFont;
  /** hex */
  color: string;
  /** rgba() — the glow around the word being spoken */
  glow: string;
  /** the line's last caption stays until here (never less than its last word + 1 beat) */
  holdUntil: number;
  /** where a caption that must stay a beat longer moves to (null = it holds in place) */
  echoY: number | null;
  /** frames [from, to] the echo slot is taken by something else (an echo may not overlap them) */
  echoBlock?: readonly [number, number];
  /** frames words lead the voice */
  lead?: number;
  align?: 'center' | 'left' | 'right';
  /* ── optional extras ── */
  /** per-word colour accent (e.g. a flash linking a word to something on screen) */
  tint?: (caption: number, word: number) => { color: string; k: number } | null | undefined;
  /** an underline drawn under words [from, to] of one caption (it stays with the caption) */
  underline?: {
    caption: number;
    words: readonly [number, number];
    /** 0..1 draw progress (left → right) */
    p: number;
    color: string;
    thickness: number;
    /** CSS box-shadow for the line (its glow), or undefined */
    shadow?: string;
    /** top of the line, in em from the top of the row (default: .16em under an Inter baseline) */
    topEm?: number;
  };
};

const ENTER = 6; // frames a word takes to enter
const SETTLE = 6; // frames a spoken word takes to ease to 86 %
const SPOKEN = 0.86;
const OUT = 4; // replacement exit
const ECHO_OUT = 5;
const ECHO_LEAD = 3; // frames an echo starts lifting before the incoming caption appears
const HOLD = BEAT; // a caption stays ≥ 1 beat after its last word

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
  /** spoken frame of each word (absolute, same space as t) */
  spoken: number[];
  /** frame each word stops being "the word being spoken" */
  speakEnd: number[];
  appear: number[];
  start: number;
  lastSpoken: number;
  /** frame it starts leaving / moving to echo */
  out: number;
  mode: 'replace' | 'echo';
  /** echo: frame it leaves the echo slot */
  echoOut: number;
};

function plan(p: CaptionsProps): Plan[] {
  const { lineAt, voice, captions, holdUntil, echoY, echoBlock } = p;
  const lead = p.lead ?? 2;
  const idx = (c: Caption, j: number) => c.map?.[j] ?? c.word + j;
  const plans: Plan[] = captions.map((c) => {
    const words = c.text.split(' ');
    const spoken = words.map((_, j) => lineAt + vWord(voice, idx(c, j)));
    const speakEnd = words.map((_, j) => lineAt + wordEnd(voice, idx(c, j)));
    const appear = spoken.map((s) => s - lead);
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
    };
  });
  plans.forEach((pl, c) => {
    const isLast = c === plans.length - 1;
    const next = isLast ? holdUntil - lead : plans[c + 1].start;
    const minEnd = pl.lastSpoken + HOLD;
    if (next >= minEnd) {
      // leave a touch before the incoming caption's first word (when the beat-after rule allows),
      // so the two never sit on top of each other at full strength
      pl.out = Math.max(minEnd, next - OUT);
    } else if (echoY !== null && !(echoBlock && next <= echoBlock[1] && minEnd + ECHO_OUT >= echoBlock[0])) {
      pl.mode = 'echo';
      // it starts lifting a few frames before the incoming caption's first word appears, so
      // the two never sit on top of each other (never before its own last word has started)
      pl.out = Math.min(next, Math.max(pl.lastSpoken + ECHO_LEAD, next - ECHO_LEAD));
      pl.echoOut = minEnd;
    } else {
      // no echo slot: a caption inside the line holds until the next one starts;
      // the line's last caption never leaves less than a beat after its last word
      pl.out = isLast ? minEnd : next;
    }
  });
  // at most one echo at a time: an echo leaves early when the next one arrives
  let prevEcho: Plan | null = null;
  for (const pl of plans) {
    if (pl.mode !== 'echo') continue;
    if (prevEcho && prevEcho.echoOut > pl.out - ECHO_OUT) prevEcho.echoOut = Math.max(prevEcho.out + 2, pl.out - ECHO_OUT);
    prevEcho = pl;
  }
  return plans;
}

export const Captions: React.FC<CaptionsProps> = (props) => {
  const { t, x, y, maxWidth, font, color, glow, echoY, align = 'center', tint, underline } = props;
  const plans = plan(props);
  const rowH = font.size * font.lineHeight;
  const tracking = typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking;
  const left = align === 'center' ? x - maxWidth / 2 : align === 'left' ? x : x - maxWidth;

  return (
    <>
      {plans.map((pl, c) => {
        if (t < pl.start - 1) return null;
        const end = pl.mode === 'echo' ? pl.echoOut + ECHO_OUT : pl.out + OUT;
        if (t > end) return null;

        /* where the caption is: in place, leaving, or in the echo slot */
        let dy = 0;
        let dyPct = 0;
        let scale = 1;
        let opacity = 1;
        let blur = 0;
        if (pl.mode === 'replace') {
          const u = tween(t, [pl.out, pl.out + OUT], [0, 1], EASE.in2);
          dyPct = -30 * u;
          blur = 4 * u;
          opacity = 1 - u;
        } else if (t >= pl.out && echoY !== null) {
          const s = springAt(t, pl.out, SPRING.site);
          // the echo's LAST row lands on echoY (a wrapped caption grows upward from it, so it
          // never covers what sits under the echo slot): row A goes to echoY − (H − rowH)·.86,
          // written with the caption's own height H as a % (no measuring needed)
          const sE = 0.86;
          dy = (echoY - y + (rowH / 2) * sE + (rowH / 2) * sE) * s;
          dyPct = -100 * sE * s;
          scale = 1 - (1 - sE) * s;
          opacity = 1 - 0.58 * Math.min(1, s);
          const u = tween(t, [pl.echoOut, pl.echoOut + ECHO_OUT], [0, 1], EASE.in2);
          dy -= 20 * u;
          blur = 4 * u;
          opacity *= 1 - u;
        }
        if (opacity <= 0.002) return null;
        const echoing = pl.mode === 'echo' && t >= pl.out;

        const words = pl.words.map((w, j) => {
          const a = pl.appear[j];
          const u = Math.min(1, Math.max(0, (t - a + 1) / ENTER));
          const e = EASE.out3(u);
          // the word being spoken: from its appearance until the voice moves on
          const speaking = t >= a && t < pl.speakEnd[j] && !echoing;
          const after = Math.max(0, t - Math.max(pl.speakEnd[j], a + ENTER));
          const dim = speaking ? 1 : 1 - (1 - SPOKEN) * EASE.inOut(Math.min(1, after / SETTLE));
          const tn = tint?.(c, j);
          const col = tn && tn.k > 0.001 ? mixHex(color, tn.color, tn.k) : color;
          // the glow eases off with the dim (no pop)
          const g = speaking ? 1 : 1 - Math.min(1, after / SETTLE);
          const st: React.CSSProperties = {
            display: 'inline-block',
            opacity: u <= 0 ? 0 : e * dim,
            color: col,
            transform: u < 1 ? `translateY(${(0.16 * (1 - e)).toFixed(4)}em)` : undefined,
            filter: u > 0 && u < 1 ? `blur(${(3 * (1 - e)).toFixed(2)}px)` : undefined,
            textShadow: u > 0 && g > 0.02 ? `0 0 0.35em ${scaleAlpha(glow, g)}` : undefined,
          };
          return { w, st };
        });

        /* the words, with the optional underlined phrase grouped (it never breaks) */
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
            // Inter: ascender .96875 em; the row's half-leading on top
            const topEm = ul.topEm ?? (font.lineHeight - 1.2109) / 2 + 0.96875 + 0.16;
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
              filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
              textAlign: align,
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
      })}
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

/** Timing helper: the frame caption c's word j appears (for scenes that sync to caption words). */
export function captionWordAt(lineAt: number, voice: VoiceId, c: Caption, j: number, lead = 2): number {
  return lineAt + vWord(voice, c.map?.[j] ?? c.word + j) - lead;
}
