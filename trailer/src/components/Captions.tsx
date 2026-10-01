/**
 * Live captions, driven by the real voice (src/voice.generated.ts).
 *
 * Shared by the CALL and the KNOWLEDGE scenes. Everything is a pure
 * function of `t` (the same frame space as `lineAt`, fractional at 120 fps).
 *
 * Set in TYPE.caption (Instrument Sans, like the knowledge heading) for BOTH
 * speakers: the speaker is told by colour (theme.ts VOICE_INK) and an
 * optional ● AVA / ● CALLER label above row A — never by a serif italic.
 *
 * Timing
 *   caption c starts at  s_c = lineAt + vWord(voice, c.word)
 *   its word j appears at     lineAt + vWord(voice, c.map?.[j] ?? c.word + j) − lead
 *   (word times are length-proportional estimates, so words lead the voice)
 *
 * Layout — each caption is laid out once (text-wrap: balance); row A is
 * centred on `y`, wrapped rows grow downward. Unrevealed words sit in place
 * (inside their masks, at opacity 0): nothing ever reflows.
 *
 * Words — each word rises out of its own clipping box on SPRING.caption
 * (from 80 % of its height, opacity up over the first half of the travel),
 * released a frame before it appears. NO blur, no glow, no ghost copies.
 * Optionally (spokenOpacity < 1) words already spoken ease down to that
 * opacity once the voice moves on.
 *
 * Replacement — at s_{c+1} the outgoing caption leaves in OUT (4) frames:
 * its words rise up out of their masks (power3.in, fading in the second
 * half, a ≤ 1.4 f left-to-right stagger inside the 4 f). If that would take
 * it off screen less than a beat (15 f) after its last word, it moves up to
 * `echoY` instead (scale .86, opacity .42, the site spring; it starts lifting
 * 3 f before the incoming caption appears, so they never overlap) and leaves
 * a beat after its last word the same way (ECHO_OUT, 5 f). One echo at a time.
 * With `echoY = null` it simply holds until s_{c+1}. A line's last caption
 * holds until `holdUntil` (never less than a beat after its last word).
 */
import React from 'react';
import { EASE, mixHex, SPRING, springAt, tween } from '../lib/motion';
import { useLayout } from '../lib/layout';
import { baselineEm, captionFont, maskBox, type CaptionFont } from '../lib/type';
import { BEAT, FPS, vWord, type Caption } from '../timing';
import { VOICE_INK, type Speaker, type Tone } from '../theme';
import { VOICE, type VoiceId } from '../voice.generated';
import { reveal, revealStyle, SpeakerLabel } from './Type';

export type { CaptionFont } from '../lib/type';

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
  /** TYPE.caption: captionFont(L.vertical, tone) (lib/type.ts). Optional on <Captions> itself (CaptionsInput). */
  font: CaptionFont;
  /** hex. Default: the speaker's caption ink on `tone` (VOICE_INK) */
  color?: string;
  /** @deprecated ignored — captions no longer glow */
  glow?: string;
  /** the ground: 'night' (default) or 'paper' — picks the default ink / weight */
  tone?: Tone;
  /** who speaks: draws ● AVA / ● CALLER above row A while the line is on screen ({label, color} for a custom tag) */
  speaker?: Speaker | { who: Speaker; text?: string; color?: string };
  /** px between the speaker label and the top of row A (default .36 × the caption size) */
  speakerGap?: number;
  /** words already spoken ease to this opacity (default 1 = they stay at full ink) */
  spokenOpacity?: number;
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
    /** CSS box-shadow for the line, or undefined */
    shadow?: string;
    /** top of the line, in em from the top of the row (default: .14em under the Instrument Sans baseline) */
    topEm?: number;
  };
};

const SETTLE = 6; // frames a spoken word takes to ease to `spokenOpacity`
const OUT = 4; // replacement exit
const ECHO_OUT = 5;
const ECHO_LEAD = 3; // frames an echo starts lifting before the incoming caption appears
const HOLD = BEAT; // a caption stays ≥ 1 beat after its last word
/** a word's reveal: rises from 80 % of its height out of its mask, on the caption spring */
const RISE = 80;

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

/** <Captions>' own props: `font` may be left out (TYPE.caption for the orientation and tone). */
export type CaptionsInput = Omit<CaptionsProps, 'font'> & { font?: CaptionFont };

function plan(p: CaptionsInput): Plan[] {
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

/** Word j of n leaves in a window of `dur` frames from `at`: a small left-to-right stagger inside it. */
function exitOf(at: number, dur: number, j: number, n: number) {
  const st = n > 1 ? Math.min(0.4, (dur * 0.35) / (n - 1)) : 0;
  return { at: at + j * st, dur: dur - (n - 1) * st };
}

export const Captions: React.FC<CaptionsInput> = (props) => {
  const L = useLayout();
  const {
    t,
    x,
    y,
    maxWidth,
    echoY,
    align = 'center',
    tint,
    underline,
    tone = 'night',
    speaker,
    spokenOpacity = 1,
  } = props;
  const who: Speaker = typeof speaker === 'string' ? speaker : speaker?.who ?? 'ava';
  const font = props.font ?? captionFont(L.vertical, tone);
  const color = props.color ?? VOICE_INK[who][tone].text;
  const plans = plan(props);
  const rowH = font.size * font.lineHeight;
  const tracking = typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking;
  const left = align === 'center' ? x - maxWidth / 2 : align === 'left' ? x : x - maxWidth;

  /* the speaker label: in with the first caption, out with the last */
  let tag: React.ReactNode = null;
  if (speaker && plans.length) {
    const first = plans[0];
    const last = plans[plans.length - 1];
    const tagIn = first.start - 2;
    const tagOut = last.mode === 'echo' ? last.echoOut : last.out;
    const tagDur = last.mode === 'echo' ? ECHO_OUT : OUT;
    if (t >= tagIn - 1 && t <= tagOut + tagDur) {
      const gap = props.speakerGap ?? Math.round(font.size * 0.36);
      const sp = typeof speaker === 'string' ? undefined : speaker;
      tag = (
        <div
          style={{
            position: 'absolute',
            left,
            width: maxWidth,
            top: y - rowH / 2 - gap,
            transform: 'translateY(-100%)',
            textAlign: align,
          }}
        >
          <SpeakerLabel
            who={who}
            tone={tone}
            t={t}
            start={tagIn}
            exit={{ at: tagOut, dur: tagDur }}
            text={sp?.text}
            color={sp?.color}
            style={{ display: 'inline-block' }}
          />
        </div>
      );
    }
  }

  return (
    <>
      {tag}
      {plans.map((pl, c) => {
        if (t < pl.start - 1) return null;
        const end = pl.mode === 'echo' ? pl.echoOut + ECHO_OUT : pl.out + OUT;
        if (t > end) return null;

        /* where the caption is: in place, or moving to / sitting in the echo slot */
        let dy = 0;
        let dyPct = 0;
        let scale = 1;
        let opacity = 1;
        let exitAt = Infinity;
        let exitDur = OUT;
        if (pl.mode === 'replace') {
          exitAt = pl.out;
        } else if (echoY !== null) {
          if (t >= pl.out) {
            const s = springAt(t, pl.out, SPRING.site);
            // the echo's LAST row lands on echoY (a wrapped caption grows upward from it, so it
            // never covers what sits under the echo slot): row A goes to echoY − (H − rowH)·.86,
            // written with the caption's own height H as a % (no measuring needed)
            const sE = 0.86;
            dy = (echoY - y + (rowH / 2) * sE + (rowH / 2) * sE) * s;
            dyPct = -100 * sE * s;
            scale = 1 - (1 - sE) * s;
            opacity = 1 - 0.58 * Math.min(1, s);
            // the echo lifts away a touch as its words leave
            dy -= 20 * tween(t, [pl.echoOut, pl.echoOut + ECHO_OUT], [0, 1], EASE.in2);
          }
          exitAt = pl.echoOut;
          exitDur = ECHO_OUT;
        }
        const echoing = pl.mode === 'echo' && t >= pl.out;

        const n = pl.words.length;
        const words = pl.words.map((w, j) => {
          const a = pl.appear[j];
          const ex = exitAt < Infinity ? exitOf(exitAt, exitDur, j, n) : undefined;
          const r = reveal(t, a - 1, { config: SPRING.caption, rise: RISE, fade: 0.5, exit: ex });
          // once spoken (the voice has moved on), a word may ease down to `spokenOpacity`
          let dim = 1;
          if (spokenOpacity < 1) {
            const speaking = t >= a && t < pl.speakEnd[j] && !echoing;
            const after = Math.max(0, t - Math.max(pl.speakEnd[j], a + 6));
            dim = speaking ? 1 : 1 - (1 - spokenOpacity) * EASE.inOut(Math.min(1, after / SETTLE));
          }
          const tn = tint?.(c, j);
          const col = tn && tn.k > 0.001 ? mixHex(color, tn.color, tn.k) : color;
          const st = revealStyle({ ...r, opacity: r.opacity * dim });
          return { w, st: { ...st, color: col } as React.CSSProperties };
        });
        const word = (k: number) => (
          <span key={k} style={maskBox(0)}>
            <span style={words[k].st}>{words[k].w}</span>
          </span>
        );

        /* the words, with the optional underlined phrase grouped (it never breaks) */
        const nodes: React.ReactNode[] = [];
        const ul = underline && underline.caption === c ? underline : null;
        for (let j = 0; j < words.length; j++) {
          if (j > 0) nodes.push(' ');
          if (ul && j === ul.words[0]) {
            const inner: React.ReactNode[] = [];
            for (let k = ul.words[0]; k <= ul.words[1]; k++) {
              if (k > ul.words[0]) inner.push(' ');
              inner.push(word(k));
            }
            const p = Math.min(1, Math.max(0, ul.p));
            const topEm = ul.topEm ?? baselineEm(font.lineHeight) + 0.14;
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
                      // the line leaves with its words
                      opacity: Math.min(...words.slice(ul.words[0], ul.words[1] + 1).map((x) => (x.st.opacity as number | undefined) ?? 1)),
                    }}
                  />
                ) : null}
              </span>,
            );
            j = ul.words[1];
            continue;
          }
          nodes.push(word(j));
        }

        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left,
              top: y - rowH / 2,
              width: maxWidth,
              transform:
                dy !== 0 || dyPct !== 0 || scale !== 1
                  ? `translateY(calc(${dy.toFixed(3)}px + ${dyPct.toFixed(3)}%)) scale(${scale.toFixed(5)})`
                  : undefined,
              transformOrigin: `${(x - left).toFixed(1)}px ${(rowH / 2).toFixed(1)}px`,
              opacity: opacity >= 0.999 ? undefined : opacity,
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

/** Timing helper: the frame caption c's word j appears (for scenes that sync to caption words). */
export function captionWordAt(lineAt: number, voice: VoiceId, c: Caption, j: number, lead = 2): number {
  return lineAt + vWord(voice, c.map?.[j] ?? c.word + j) - lead;
}
