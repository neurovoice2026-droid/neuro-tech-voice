/**
 * The call's live captions — set in TYPE.caption (Instrument Sans, like the
 * knowledge heading) for BOTH speakers, and moved like every other piece of
 * type in the film (components/Type.tsx): each word sits in its own clipping
 * box, and a caption RISES AS A UNIT when its first word is spoken — all its
 * words out of their masks on SPRING.caption, UNIT_STAGGER (½ f) apart, so a
 * centred line never hangs half-filled off-centre under the speaker label —
 * its opacity coming up over the first half of the travel; it LEAVES the same way, up
 * out of its mask (power3.in, fading in the second half), word by word with
 * a small left-to-right stagger. No blur, no glow, no smear, no ghosts — the
 * 120 fps render and the curves carry the motion. Everything is a pure
 * function of `t` (the frame space of `lineAt`, fractional at 120 fps).
 *
 *   heard = read   a caption word may carry its own spoken frame (`at`, from
 *                  the line's start): the voice says words the aligner has no
 *                  word for ("Oh,", "Um…", "Thank you!") — they are captioned
 *                  on the real voice (call/voice.ts `onsets`).
 *   the turn       `notBefore`: no word of the line rises before its turn.
 *   key words      `keys(c, j)` → the accent ink for caption c's word j (the
 *                  knowledge heading's two-tone: the key phrase in the scene's
 *                  accent, the rest in the speaker's ink), set from the start.
 *   the exit       a caption is (all but) gone as the next one rises — never
 *                  less than ≈ 6 f after its last word is heard. A line's last
 *                  caption holds until `holdUntil` (the next speaker's turn).
 *
 * (`echoY` / `glow` are accepted and ignored: there is no echo slot in the
 * centred layout and captions never glow.)
 */
import React from 'react';
import { reveal, revealStyle } from '../../components/Type';
import { mixHex, smooth, SPRING } from '../../lib/motion';
import { baselineEm, maskBox, UNIT_STAGGER, type CaptionFont as LibCaptionFont } from '../../lib/type';
import { vWord, type Caption } from '../../timing';
import { type VoiceId } from '../../voice.generated';

export type CallCaption = Caption & {
  /** per caption word: its spoken frame (from the line's start) when the aligner has no word for it */
  at?: readonly (number | null)[];
};

export type CaptionFont = LibCaptionFont;

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
  /** @deprecated ignored — captions never glow */
  glow?: string;
  /** the line's last caption is (all but) gone by here */
  holdUntil: number;
  /** @deprecated ignored — the centred layout has no echo slot */
  echoY?: number | null;
  /** @deprecated ignored */
  echoBlock?: readonly [number, number];
  /** no word rises before this frame (the turn) */
  notBefore?: number;
  /** frames words lead the voice (default 2) */
  lead?: number;
  /** unique per instance */
  id: string;
  /** the accent ink for word j of caption c (null: the speaker's ink) */
  keys?: (caption: number, word: number) => string | null | undefined;
  /** a per-word colour mix */
  tint?: (caption: number, word: number) => { color: string; k: number } | null | undefined;
  /** keep each word on its sub-pixel layer from entrance to exit (Type.tsx revealStyle `hold`): a
   *  landed word never re-rasterises (no late "tick"). Only where no camera zoom acts on the captions. */
  hold?: boolean;
  /** a hairline drawn under words [from, to] of one caption as they are said (it leaves with them) */
  underline?: {
    caption: number;
    words: readonly [number, number];
    /** 0..1 draw progress (left → right) */
    p: number;
    color: string;
    thickness: number;
    /** top of the line, in em from the top of the row (default: .13em under the baseline) */
    topEm?: number;
  };
};

/** a word rises from 80 % of its height out of its mask */
const RISE = 80;
/** a word's exit (frames), and the whole caption's stagger across its words */
export const EXIT_DUR = 5;
const STAGGER_MAX = 1.6;
const stagger = (n: number) => (n > 1 ? Math.min(0.45, STAGGER_MAX / (n - 1)) : 0);
/** frames a caption of n words takes to leave */
export const exitLength = (n: number) => EXIT_DUR + stagger(n) * (n - 1);
/** a caption stays at least this long after its last word is heard */
const MIN_READ = 6;

/** A single element's exit up through its mask, from `at` (for the pieces that leave with a caption). */
export function exitAt(t: number, at: number, dur = EXIT_DUR) {
  return reveal(t, -1e6, { rise: RISE, exit: { at, dur } });
}

/** Frame (from the line's start) at which spoken word k ends: the next word, or the end of its phrase. */
type Plan = {
  words: string[];
  spoken: number[];
  appear: number[];
  start: number;
  lastSpoken: number;
  /** frame its exit starts */
  out: number;
};

function plan(p: CallCaptionsProps): Plan[] {
  const { lineAt, voice, captions, holdUntil, notBefore = -Infinity } = p;
  const lead = p.lead ?? 2;
  const idx = (c: Caption, j: number) => c.map?.[j] ?? c.word + j;
  const plans: Plan[] = captions.map((c) => {
    const words = c.text.split(' ');
    const own = (j: number) => c.at?.[j] ?? null;
    const spoken = words.map((_, j) => lineAt + (own(j) ?? vWord(voice, idx(c, j))));
    const appear = spoken.map((s) => Math.max(s - lead, notBefore));
    return { words, spoken, appear, start: Math.min(...appear), lastSpoken: Math.max(...spoken), out: Infinity };
  });
  plans.forEach((pl, c) => {
    const len = exitLength(pl.words.length);
    // gone (to its last faint frame) as the next caption's first word starts to rise — or, for the
    // line's last caption, by the next speaker's turn; never before it has been read
    const goneBy = c === plans.length - 1 ? holdUntil : plans[c + 1].start;
    pl.out = Math.max(pl.lastSpoken + MIN_READ, goneBy - len);
  });
  return plans;
}

export const CallCaptions: React.FC<CallCaptionsProps> = (props) => {
  const { t, x, y, maxWidth, font, color, keys, tint, underline, hold = false } = props;
  const plans = plan(props);
  const rowH = font.size * font.lineHeight;
  const tracking = typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking;
  const left = x - maxWidth / 2;

  const blocks = plans.map((pl, c) => {
    if (t < pl.start - 1.5) return null;
    const n = pl.words.length;
    const stg = stagger(n);
    if (t > pl.out + exitLength(n) + 0.5) return null;

    const words = pl.words.map((w, j) => {
      // the caption rises as a unit on its first spoken word (a ½ f ripple across its words)
      const r = reveal(t, pl.start - 1 + j * UNIT_STAGGER, { config: SPRING.caption, rise: RISE, fade: 0.5, exit: { at: pl.out + j * stg, dur: EXIT_DUR } });
      const key = keys?.(c, j);
      let col = key ?? color;
      const tn = tint?.(c, j);
      if (tn && tn.k > 0.001) col = mixHex(col, tn.color, tn.k);
      return { w, st: { ...revealStyle(r, undefined, hold), color: col } as React.CSSProperties, op: r.opacity };
    });
    if (words.every((wd) => wd.op <= 0.002)) return null;
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
        const topEm = ul.topEm ?? baselineEm(font.lineHeight) + 0.13;
        // the line leaves with its words (it is as present as the faintest of them)
        const op = Math.min(...words.slice(ul.words[0], ul.words[1] + 1).map((wd) => wd.op));
        nodes.push(
          <span key={`ul${j}`} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'nowrap' }}>
            {inner}
            {p > 0.001 && op > 0.002 ? (
              <span
                style={{
                  position: 'absolute',
                  left: '0.02em',
                  top: `calc(${topEm.toFixed(4)}em - ${(ul.thickness / 2).toFixed(2)}px)`,
                  width: `calc(${(p * 100).toFixed(3)}% - 0.04em)`,
                  height: ul.thickness,
                  borderRadius: ul.thickness / 2,
                  background: ul.color,
                  opacity: op * smooth(0, 0.04, p),
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
          textAlign: 'center',
          textWrap: 'balance',
          fontFamily: font.family,
          fontWeight: font.weight,
          fontStyle: 'normal',
          fontSize: font.size,
          lineHeight: font.lineHeight,
          letterSpacing: tracking,
          fontKerning: 'normal',
          color,
          whiteSpace: 'normal',
        }}
      >
        {nodes}
      </div>
    );
  });

  return <>{blocks}</>;
};
