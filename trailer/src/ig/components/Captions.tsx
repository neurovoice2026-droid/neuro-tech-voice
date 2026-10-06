/**
 * THE REELS' CAPTIONS — FORK of src/kb/components/Captions.tsx @ 743247a (itself the fork of film 1's
 * src/components/Captions.tsx), bound to the REELS' voice data (src/ig/voice.generated.ts, the reel's own timeline
 * passed in as `T`) and to docs/ig/SCRIPT.md §0.3's caption rules. The house motion is the original's, line for line:
 * every word sits in its own clipping box (lib/type maskBox) and the screen RISES AS A UNIT out of the masks on
 * SPRING.caption (from 80 % of its height, opacity over the first half, words ½ f apart — a line never hangs
 * half-filled); it LEAVES up through the same masks in OUT (4) frames (power3.in, a ≤ 1.4 f left-to-right ripple).
 * No blur, no glow, no ghost copies; moving words ride their own sub-pixel layers (components/Type revealStyle).
 *
 * WHAT THE FORK CHANGES (SCRIPT.md §0.3 "Captions"):
 *   · SCREENS ARE EXPLICIT: a line's word-index spans of its `say` (timing.ts SCREENS, ≤ 7 words), not auto-chunks.
 *     On-screen words = the line's `say`, typographic apostrophes (kit typo, 1:1 so word indices hold).
 *   · THE DISPLAY MAP: numerals over spoken word spans (timing.ts DISPLAY: "forty-five" → "45", "Nine forty-seven" →
 *     "9:47 pm."): one token for the span, on the span's first onset, never broken across rows.
 *   · TIMING per screen (captionScreens): it rises 2 f ahead of its first word; a screen inside a line stays until the
 *     next one replaces it (gone as the next rises: no blank gap, never two in one place); a line's last screen holds a
 *     beat after her voice ends (or until `exitAt`).
 *   · FRAME-0 SET MODE: a line marked `set0` (each reel's first) has its first screen ALREADY SET at frame 0 at 72 %
 *     ink, so the cover and the muted first impression read; each word lifts to 100 % on Tessa's onset with a 1-frame
 *     accent glint. For t < 0 the set screen rises into place (from SEAM_RISE): the end card's seam renders the reel's
 *     frame-0 composition at t ∈ [−14, 0) and the caption re-forms, mid-motion, exactly into frame 0's still.
 *   · LAYOUT IS MEASURED, NOT FLOWED: tokens are measured with the kit's canvas measureText (the DOM's face, weight and
 *     tracking) and set at absolute positions — explicit row breaks, or a balanced wrap that prefers breaks after
 *     punctuation and never leaves a lone short word — so nothing reflows and the zone guard gets the exact rect.
 *   · KEY WORDS: a word set in an accent ink from the start ("fire" in rose), or taking a glint on its onset that
 *     settles into the key ink (film 2's cta/Heading idiom: "book", "AGENT", "says so" in teal).
 *   · ZONES: every visible screen reports its measured rect (components/ZoneGuard), so check-zones fails a caption
 *     that crosses the header, the caption/username band or the right rail.
 *
 *   <Captions T={T} id="ig1-02" t={f} place={CAPTION_BAND} />
 *   <Captions T={T} id="ig1-01" t={f} place={(k) => (k === 0 ? HOOK_S1 : HOOK_S2)} keys={[{ words: [1], ink: ROSE }]} glint={ROSE_LIGHT} />
 *
 * `t` is the ABSOLUTE timeline frame (fractional at 120 fps): the reels' VOICES are absolute.
 */
import React from 'react';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { maskBox, UNIT_STAGGER } from '../../lib/type';
import { BEAT } from '../../timing';
import { C, TYPE } from '../../theme';
import { GRAPHITE } from '../../kb/theme';
import { measureText, spaceWidth, typo, useKitFaces } from '../../kb/kit';
import type { LineScreens } from '../common/series';
import type { ReelTimeline } from '../types';
import { VOICE } from '../voice.generated';
import { ZoneRect } from './ZoneGuard';

/* ── the rules (SCRIPT.md §0.3) ── */
/** a screen rises this many frames ahead of its first word */
export const CAP_LEAD = 2;
/** a screen leaves up through its masks over OUT frames */
export const CAP_OUT = 4;
/** a line's last screen holds ≥ a beat after her voice */
export const CAP_HOLD = BEAT;
/** the frame-0 set screen's ink before each word's onset */
export const SET_INK = 0.72;
/** the frame (relative to frame 0) from which a set screen rises back into place in the seam (t < 0) */
export const SEAM_RISE = -13;
/** a word's reveal: rises from 80 % of its height out of its mask (the original's RISE) */
const RISE = 80;

/* ── the type ── */
export type CapRole = 'caption' | 'headline' | 'display' | 'title';
/** Where and how a screen is set. */
export type CapPlace = {
  /** the anchor: the left edge (align 'left') or the centre (align 'center') */
  x: number;
  /** the block's top (valign 'top', default) or its vertical centre (valign 'center') */
  y: number;
  valign?: 'top' | 'center';
  maxWidth: number;
  align: 'left' | 'center';
  /** the TYPE role (default caption): its weight, tracking and line height */
  role?: CapRole;
  /** px (default the role's 9:16 size: caption 68, headline 92, display 112, title 56) */
  size?: number;
  /** the ground: light type on night takes the role's weightOnDark */
  tone?: 'paper' | 'night';
  /** the ink (default graphite on paper, paper on night) */
  color?: string;
  /** explicit row breaks: the TOKEN index each row after the first starts at (else a balanced wrap) */
  rows?: readonly number[];
  lineHeight?: number;
};
/** the caption band (SCRIPT.md §0.3 "Layout bands"): left at x 86, max 820, from y 1200 */
export const CAPTION_BAND: CapPlace = { x: 86, y: 1200, maxWidth: 820, align: 'left', role: 'caption' };

const TRACKING: Record<CapRole, number> = { caption: -0.02, headline: -0.03, display: -0.03, title: -0.02 };

export type CapFont = { size: number; weight: number; tracking: number; lineHeight: number; family: string };
export function capFont(p: CapPlace): CapFont {
  const role = p.role ?? 'caption';
  const r = TYPE[role];
  return {
    size: p.size ?? r.size[1],
    weight: p.tone === 'night' ? r.weightOnDark : r.weight,
    tracking: TRACKING[role],
    lineHeight: p.lineHeight ?? r.lineHeight,
    family: r.family,
  };
}

/* ── the screens on the timeline ── */
export type CapToken = {
  text: string;
  /** the word indices of `say` it shows (a display token: the whole span) */
  first: number;
  last: number;
  /** the absolute frame of its first spoken word */
  onset: number;
};
export type CapScreen = {
  id: string;
  /** the line's absolute start */
  at: number;
  k: number;
  /** the frame the unit rise starts (−∞ for a set screen: set at frame 0) */
  from: number;
  /** the frame it starts leaving (its exit runs over CAP_OUT) */
  out: number;
  set0: boolean;
  tokens: CapToken[];
  /** the onset of its last spoken word */
  lastOnset: number;
};

export type CapTiming = {
  /** the line's start (default: its VOICES entry) */
  at?: number;
  /** the frame the LAST screen starts leaving (default: a beat after her voice, never over the next caption line) */
  exitAt?: number;
  /** per screen: the frame it starts leaving (overrides the rule) */
  exits?: Readonly<Record<number, number>>;
  /** how many leading screens are set at frame 0 (default 1 for a `set0` line, else 0) */
  setScreens?: number;
  /** optional: frames added to a word's onset (by its index in `say`) where the aligner's stamp is off the take's own
   *  energy (two words sharing one stamp, a late first word) — its screen rises, its glint and its lift follow it */
  nudge?: Readonly<Record<number, number>>;
};

type Line = { say: string; frames: number; phrases: readonly { end: number }[] };
const LINE = (id: string) => (VOICE.lines as Record<string, Line>)[id];
const SAY = (id: string) => LINE(id)?.say ?? '';
/** frames from a line's start to the end of its last spoken phrase (her voice, not the file's silent tail) */
export const speechEnd = (id: string) => {
  const l = LINE(id);
  return l ? Math.round((l.phrases[l.phrases.length - 1]?.end ?? l.frames / VOICE.fps) * VOICE.fps) : 0;
};

/** The timed screens of a line (pure; also what a scene syncs to). */
export function captionScreens(T: ReelTimeline, id: string, o: CapTiming = {}): CapScreen[] {
  const sc: LineScreens | undefined = T.SCREENS[id];
  if (!sc || !sc.spans.length) return [];
  const v = T.VOICES.find((x) => x.id === id);
  const at = o.at ?? v?.at;
  if (at === undefined) throw new Error(`[ig captions] ${id} is not on ${T.REEL}'s timeline`);
  const words = typo(SAY(id)).split(' ').filter(Boolean);
  const onset = (k: number) => at + T.vWord(id, k) + (o.nudge?.[k] ?? 0);
  const nSet = o.setScreens ?? (sc.set0 ? 1 : 0);
  const screens: CapScreen[] = sc.spans.map(([a, e], k) => {
    const tokens: CapToken[] = [];
    for (let i = a; i <= e; i++) {
      const d = T.DISPLAY.find((m) => m.id === id && m.from === i);
      if (d) {
        tokens.push({ text: d.text, first: i, last: d.to, onset: onset(i) });
        i = d.to;
      } else tokens.push({ text: words[i] ?? '', first: i, last: i, onset: onset(i) });
    }
    const set0 = k < nSet;
    return { id, at, k, from: set0 ? -Infinity : onset(a) - CAP_LEAD, out: Infinity, set0, tokens, lastOnset: onset(e) };
  });
  // the line's end: a beat after her voice, never over the next caption line's first screen
  const end = at + speechEnd(id) + CAP_HOLD;
  const later = T.VOICES.filter((x) => x.at > at && T.SCREENS[x.id]?.kind === 'caption' && T.SCREENS[x.id].spans.length);
  const nextLine = later.length ? later[0].at + T.vWord(later[0].id, T.SCREENS[later[0].id].spans[0][0]) - CAP_LEAD : Infinity;
  screens.forEach((s, k) => {
    if (o.exits?.[k] !== undefined) {
      s.out = o.exits[k];
      return;
    }
    const next = screens.slice(k + 1).find((x) => !x.set0);
    if (k < screens.length - 1 && next) {
      // inside the line: stays until the next screen replaces it (gone as it rises), never before its last word has
      // had a few frames
      s.out = Math.max(s.lastOnset + 4, next.from - CAP_OUT);
    } else if (k < screens.length - 1) {
      s.out = o.exitAt ?? end;
    } else {
      s.out = o.exitAt ?? Math.max(s.lastOnset + 6, Math.min(end, nextLine - CAP_OUT));
    }
  });
  return screens;
}

/** the screens with some tokens set differently (Captions `retext`) */
export const retextScreens = (screens: CapScreen[], retext?: Readonly<Record<number, string>>): CapScreen[] =>
  retext ? screens.map((s) => ({ ...s, tokens: s.tokens.map((tk) => (retext[tk.first] !== undefined ? { ...tk, text: retext[tk.first] } : tk)) })) : screens;

/** The frame a word of a line is spoken (absolute) — for scenes that land things on words. */
export const wordAt = (T: ReelTimeline, id: string, k: number, at?: number) => (at ?? T.VOICES.find((v) => v.id === id)?.at ?? 0) + T.vWord(id, k);

/* ── layout ── */
export type CapLayout = {
  rows: { tokens: number[]; x: number; w: number }[];
  /** per token: x (frame px, its row's left + its offset), row */
  pos: { x: number; row: number; w: number }[];
  top: number;
  rowH: number;
  /** the block's rect (the widest row), frame px */
  rect: { x: number; y: number; w: number; h: number };
  font: CapFont;
};

const PUNCT = /[,.:;?!…]$/;

/** a balanced wrap: the fewest rows that fit, then the split with the narrowest widest row (a break after punctuation
 *  is preferred; a lone short last word is not) */
function balance(widths: number[], texts: string[], space: number, maxW: number): number[][] {
  const n = widths.length;
  const rowW = (a: number, b: number) => widths.slice(a, b).reduce((s, w) => s + w, 0) + space * Math.max(0, b - a - 1);
  if (rowW(0, n) <= maxW + 0.01 || n === 1) return [Array.from({ length: n }, (_, i) => i)];
  let best: { cuts: number[]; cost: number } | null = null;
  for (let rowsN = 2; rowsN <= Math.min(4, n) && !best; rowsN++) {
    const rec = (start: number, left: number, cuts: number[]) => {
      if (left === 1) {
        const all = [...cuts, n];
        let prev = 0;
        let worst = 0;
        let cost = 0;
        for (const c of all) {
          const w = rowW(prev, c);
          if (w > maxW + 0.01) return;
          worst = Math.max(worst, w);
          if (c < n && !PUNCT.test(texts[c - 1])) cost += 0.06 * maxW;
          prev = c;
        }
        const lastLen = n - all[all.length - 2];
        if (lastLen === 1 && texts[n - 1].length <= 5) cost += 0.2 * maxW;
        cost += worst;
        if (!best || cost < best.cost) best = { cuts: all.slice(0, -1), cost };
        return;
      }
      for (let c = start + 1; c <= n - (left - 1); c++) rec(c, left - 1, [...cuts, c]);
    };
    rec(0, rowsN, []);
  }
  const cuts = best ? (best as { cuts: number[] }).cuts : [];
  const rows: number[][] = [];
  let prev = 0;
  for (const c of [...cuts, n]) {
    rows.push(Array.from({ length: c - prev }, (_, i) => prev + i));
    prev = c;
  }
  return rows;
}

/** Lay a screen's tokens out (measured; needs the kit's faces). */
export function layoutScreen(tokens: readonly { text: string }[], p: CapPlace): CapLayout {
  const font = capFont(p);
  const spec = { size: font.size, weight: font.weight, tracking: font.tracking };
  const widths = tokens.map((tk) => measureText(tk.text, spec));
  const space = spaceWidth(spec);
  let rowsIdx: number[][];
  if (p.rows && p.rows.length) {
    const starts = [0, ...p.rows.filter((r) => r > 0 && r < tokens.length)];
    rowsIdx = starts.map((s, i) => Array.from({ length: (starts[i + 1] ?? tokens.length) - s }, (_, j) => s + j));
  } else rowsIdx = balance(widths, tokens.map((t) => t.text), space, p.maxWidth);
  const rowH = font.size * font.lineHeight;
  const H = rowsIdx.length * rowH;
  const top = p.valign === 'center' ? p.y - H / 2 : p.y;
  const pos: CapLayout['pos'] = tokens.map(() => ({ x: 0, row: 0, w: 0 }));
  const rows = rowsIdx.map((idx, r) => {
    const w = idx.reduce((s, i) => s + widths[i], 0) + space * Math.max(0, idx.length - 1);
    const x0 = p.align === 'center' ? p.x - w / 2 : p.x;
    let x = x0;
    for (const i of idx) {
      pos[i] = { x, row: r, w: widths[i] };
      x += widths[i] + space;
    }
    return { tokens: idx, x: x0, w };
  });
  const maxW = Math.max(0, ...rows.map((r) => r.w));
  const left = p.align === 'center' ? p.x - maxW / 2 : p.x;
  return { rows, pos, top, rowH, rect: { x: left, y: top, w: maxW, h: H }, font };
}

/* ── the component ── */
export type CapKey = {
  /** word indices of the line's `say` (a display token takes the key of any word it spans) */
  words: readonly number[];
  /** the key ink */
  ink: string;
  /** 'set': in the key ink from the start; 'onset' (default when a glint is given): a glint runs into the word on its
   *  onset and settles to the key ink */
  from?: 'set' | 'onset';
  glint?: string;
};

export type CaptionsProps = {
  T: ReelTimeline;
  id: string;
  /** the ABSOLUTE timeline frame */
  t: number;
  /** where each screen is set (one place for all, or per screen index) */
  place?: CapPlace | ((k: number) => CapPlace);
  keys?: readonly CapKey[];
  /** the frame-0 set screen's 1-frame accent glint on each onset (default: none — the lift alone) */
  glint?: string;
  /** screens this component does not draw (a scene sets them its own way: ig2's clock lockup) */
  skip?: readonly number[];
  /** a token set differently (by its first word index): ig1's "ours" whose full stop is her orb */
  retext?: Readonly<Record<number, string>>;
  timing?: CapTiming;
  /** zone guard label prefix */
  what?: string;
};

/** a glint's weight at t for an onset `on`: up over the frame before it, then gone over ≈ 3 frames */
const glintAt = (t: number, on: number) => (t < on - 1 ? 0 : t < on ? EASE.out3(t - (on - 1)) : Math.exp(-(t - on) / 1.2));

/** Word j of n leaves in a window of `dur` frames from `at`: a small left-to-right stagger inside it (the original's). */
function exitOf(at: number, dur: number, j: number, n: number) {
  const st = n > 1 ? Math.min(0.4, (dur * 0.35) / (n - 1)) : 0;
  return { at: at + j * st, dur: dur - (n - 1) * st };
}

export const Captions: React.FC<CaptionsProps> = ({ T, id, t, place = CAPTION_BAND, keys = [], glint, skip = [], retext, timing, what }) => {
  const ready = useKitFaces();
  const hold = useGlide();
  if (!ready) return null;
  const screens = retextScreens(captionScreens(T, id, timing), retext);
  const placeOf = typeof place === 'function' ? place : () => place;
  const keyOf = (tk: CapToken) => keys.find((k) => k.words.some((w) => w >= tk.first && w <= tk.last));
  return (
    <>
      {screens.map((s) => {
        if (skip.includes(s.k)) return null;
        // visible: from its rise (or set at frame 0 / rising back in the seam) until its exit is over
        const start = s.set0 ? SEAM_RISE : s.from - 1;
        if (t < start - 0.5) return null;
        if (t > s.out + CAP_OUT + 0.5) return null;
        const p = placeOf(s.k);
        const lay = layoutScreen(s.tokens, p);
        const { font } = lay;
        const color = p.color ?? (p.tone === 'night' ? C.paper : GRAPHITE.text);
        const n = s.tokens.length;
        const nodes = s.tokens.map((tk, j) => {
          const ex = s.out < Infinity ? exitOf(s.out, CAP_OUT, j, n) : undefined;
          // the unit rise (a set screen: at rest from frame 0 on; rising back into place in the seam)
          const riseAt = s.set0 ? SEAM_RISE + j * UNIT_STAGGER : s.from + j * UNIT_STAGGER;
          let r = reveal(t, riseAt, { config: SPRING.caption, rise: RISE, fade: 0.5, exit: ex });
          if (s.set0 && t >= 0 && (!ex || t < ex.at)) r = { p: 1, y: 0, opacity: 1, scale: 1 };
          // ink: base, a key ink (set, or a glint settling into it on the onset)
          const key = keyOf(tk);
          let col = color;
          if (key) {
            const mode = key.from ?? (key.glint ? 'onset' : 'set');
            if (mode === 'set') col = key.ink;
            else if (t >= tk.onset - 1) {
              const up = tween(t, [tk.onset - 1, tk.onset + 1], [0, 1], EASE.out3);
              const settle = tween(t, [tk.onset + 1, tk.onset + 14], [0, 1], EASE.inOut);
              const g = key.glint ?? key.ink;
              col = settle <= 0 ? mixHex(color, g, up) : mixHex(g, key.ink, settle);
            }
          }
          // the frame-0 set screen: each word lifts from 72 % to full ink on its onset, with a 1-frame accent glint
          let lift = 1;
          if (s.set0) {
            lift = SET_INK + (1 - SET_INK) * tween(t, [tk.onset - 1, tk.onset + 1], [0, 1], EASE.out3);
            if (glint) {
              const g = glintAt(t, tk.onset);
              if (g > 0.004) col = mixHex(col, glint, 0.6 * g);
            }
          }
          const st = revealStyle({ ...r, opacity: r.opacity * lift }, undefined, hold || (s.set0 && t < 0));
          const pos = lay.pos[j];
          return (
            <span key={j} style={{ ...maskBox(0), position: 'absolute', left: pos.x, top: lay.top + pos.row * lay.rowH }}>
              <span style={{ ...st, color: col }}>{tk.text}</span>
            </span>
          );
        });
        return (
          <React.Fragment key={s.k}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                fontFamily: font.family,
                fontWeight: font.weight,
                fontSize: font.size,
                lineHeight: font.lineHeight,
                letterSpacing: `${font.tracking}em`,
                fontKerning: 'normal',
                whiteSpace: 'nowrap',
                color,
              }}
            >
              {nodes}
            </div>
            <ZoneRect what={`${what ?? 'caption'} ${id}#${s.k}`} rect={lay.rect} />
          </React.Fragment>
        );
      })}
    </>
  );
};
