/**
 * Deterministic letter geometry for the shatter.
 *
 * <Words> lays a line out as inline-block words (a 0.24em gap, no spaces),
 * TYPE.display on the night — Instrument Sans 440, tracking −0.03em,
 * line-height 1.04 — centred, `text-wrap: balance`. This file replays that
 * layout with canvas measureText on cumulative substrings (same face, weight
 * and tracking, so the kerning matches) and returns the pen position of
 * every letter.
 */
import { useEffect, useMemo, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { TYPE } from '../../theme';

/** the face as canvas names it (the first family of TYPE.display) */
export const DISPLAY_FAMILY = '"Instrument Sans Variable"';
/** TYPE.display on the night */
export const DISPLAY_WEIGHT = TYPE.display.weightOnDark;
export const TRACKING_EM = parseFloat(TYPE.display.tracking);
export const LINE_H = TYPE.display.lineHeight;
/** <Words>' default gap */
export const WORD_PAD_EM = 0.24;

export type Glyph = {
  ch: string;
  /** pen x of the glyph (left of its advance box), frame px */
  x: number;
  /** advance incl. tracking */
  adv: number;
  /** centre of the glyph box, frame px */
  cx: number;
  cy: number;
  /** top of its line box */
  top: number;
  line: number;
  word: number;
};

export type TextLayout = {
  fontSize: number;
  lineH: number;
  glyphs: Glyph[];
  /** word index → [first glyph, last glyph] */
  words: { text: string; line: number; left: number; width: number }[];
  lines: { left: number; width: number; top: number; words: number[] }[];
  top: number;
  height: number;
};

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

function measure(text: string, fontSize: number, weight = DISPLAY_WEIGHT): number {
  const key = `${weight}|${fontSize}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return text.length * fontSize * 0.5;
  if (!canvas) canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${weight} ${fontSize}px ${DISPLAY_FAMILY}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${TRACKING_EM * fontSize}px`;
  ctx.fontKerning = 'normal';
  const w = ctx.measureText(text).width;
  cache.set(key, w);
  return w;
}

/** Greedy fill (Chrome's first pass). Returns word indices per line. */
function greedy(boxW: number[], avail: number): number[][] {
  const lines: number[][] = [];
  let cur: number[] = [];
  let w = 0;
  boxW.forEach((bw, i) => {
    if (cur.length && w + bw > avail + 0.01) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(i);
    w += bw;
  });
  if (cur.length) lines.push(cur);
  return lines;
}

/** `text-wrap: balance`: the narrowest width that keeps the greedy line count. */
function balance(boxW: number[], avail: number): number[][] {
  const base = greedy(boxW, avail);
  if (base.length < 2) return base;
  let lo = Math.max(...boxW);
  let hi = avail;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (greedy(boxW, mid).length > base.length) lo = mid;
    else hi = mid;
  }
  return greedy(boxW, hi);
}

/**
 * Lay `text` out like <Words>. `rows` forces explicit line breaks (word
 * indices per row); otherwise the balanced wrap in `boxWidth` is used.
 * `cy` is the vertical centre of the block.
 */
export function layoutText({
  text,
  fontSize,
  left,
  boxWidth,
  cy,
  rows,
  align = 'center',
  trimRowEnd = false,
}: {
  text: string;
  fontSize: number;
  left: number;
  boxWidth: number;
  cy: number;
  rows?: number[][];
  align?: 'center' | 'left';
  /** centre rows on their ink (drop the last word's padding) — for our own
   *  layout; <Words> itself keeps the padding */
  trimRowEnd?: boolean;
}): TextLayout {
  const words = text.split(' ');
  const pad = WORD_PAD_EM * fontSize;
  const wordW = words.map((w) => measure(w, fontSize));
  const boxW = wordW.map((w, i) => w + (i < words.length - 1 ? pad : 0));
  const lineIdx = rows ?? balance(boxW, boxWidth);
  const lineH = LINE_H * fontSize;
  const height = lineIdx.length * lineH;
  const top = cy - height / 2;

  const glyphs: Glyph[] = [];
  const outWords: TextLayout['words'] = [];
  const lines: TextLayout['lines'] = [];
  lineIdx.forEach((ws, li) => {
    const last = ws[ws.length - 1];
    const width = ws.reduce((s, i) => s + boxW[i], 0) - (trimRowEnd ? boxW[last] - wordW[last] : 0);
    const lineLeft = left + (align === 'center' ? (boxWidth - width) / 2 : 0);
    const lineTop = top + li * lineH;
    lines.push({ left: lineLeft, width, top: lineTop, words: ws });
    let x = lineLeft;
    for (const wi of ws) {
      const w = words[wi];
      outWords[wi] = { text: w, line: li, left: x, width: wordW[wi] };
      for (let j = 0; j < w.length; j++) {
        const adv = measure(w[j], fontSize);
        // pen x = width of the prefix incl. this glyph (so the kerning pair with
        // the previous glyph is counted) minus this glyph's own advance
        const pen = x + measure(w.slice(0, j + 1), fontSize) - adv;
        glyphs.push({
          ch: w[j],
          x: pen,
          adv,
          cx: pen + adv / 2,
          cy: lineTop + lineH / 2,
          top: lineTop,
          line: li,
          word: wi,
        });
      }
      x += boxW[wi];
    }
  });
  return { fontSize, lineH, glyphs, words: outWords, lines, top, height };
}

/**
 * Canvas metrics are only right once the face has loaded. Hold the render
 * until it has, then re-render so every frame measures the real face.
 */
export function useDisplayFontReady(): boolean {
  const probe = `${DISPLAY_WEIGHT} 100px ${DISPLAY_FAMILY}`;
  const [ready, setReady] = useState(() => typeof document !== 'undefined' && document.fonts.check(probe, 'Closed'));
  const [handle] = useState(() => (ready ? null : delayRender('twist: display face for measureText')));
  useEffect(() => {
    if (ready) return;
    let alive = true;
    document.fonts
      .load(probe, 'Your business is closed. Closed is for the door, not the phone.')
      .then(() => document.fonts.ready)
      .then(() => {
        cache.clear();
        if (alive) setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready, probe]);
  useEffect(() => {
    if (ready && handle !== null) continueRender(handle);
  }, [ready, handle]);
  return ready;
}

/** Memoised layout that re-measures once the face is in. */
export function useTextLayout(args: Parameters<typeof layoutText>[0], ready: boolean): TextLayout {
  const key = JSON.stringify(args);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => layoutText(args), [key, ready]);
}
