/**
 * THE CALL STRIP (SCRIPT.md b09–b11) — Part I's caller turn, now on a live call that Ava answers: the house type
 * only (TYPE.caption for the lines, TYPE.label for the tags, TYPE.meta — Geist Mono — for the timer), every piece
 * rising out of its own mask and leaving up through it (never blur).
 *
 *   <Tag>       ● CALLER (slate) / ● AVA (sunday) — a dot and the label role — with the call's mono timer after it;
 *               the timer runs on CALL time (call/stage.ts: frozen through the stop-time), and each tick rolls only
 *               the figures that change (old up out of the mask, new up into it)
 *   <Lines>     a turn's caption lines at fixed breaks (16:9 left-aligned, 9:16 centred), the whole turn rising AS A
 *               UNIT on its first spoken word (words ½ f apart — Captions' rule), so a line never hangs half-filled;
 *               optional per-word ink (a key phrase easing in) and an underline (SVG hairline bars) under words
 *   <CallWave>  the caller's line: a fork of scenes/repeat/LineWave (itself the fork of film 1's Waveform) with a
 *               FROZEN clock option — on the freeze the bars keep their last shape
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { labelWidth, layoutWords, measureText, useKitFaces } from '../../kit';
import { HOME } from '../../palettes';
import { CALL_LOCAL as C } from '../../timing';
import { env } from '../repeat/LineWave';
import { noise2D } from '@remotion/noise';
import type { VoiceId } from '../../voice.generated';

/* ── call time and the timer ─────────────────────────────────────── */

/** call time at act frame t: real until the freeze, held through the stop-time, real again after the resume */
export const callTime = (t: number) => (t < C.freeze ? t : t < C.resume ? C.freeze : t - (C.resume - C.freeze));
const secondsAt = (t: number) => C.timer.base + Math.floor((callTime(t) - C.timer.zero) / 30);
/** the act frame of the last tick at or before t (to roll the figures) */
function lastTick(t: number): number {
  const ct = callTime(t);
  const k = Math.floor((ct - C.timer.zero) / 30);
  const tickCt = C.timer.zero + k * 30;
  // back to act time
  return tickCt < C.freeze ? tickCt : tickCt + (C.resume - C.freeze);
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** a caption-role spec for measuring */
export const captionSpec = (size: number) => ({ size, weight: TYPE.caption.weight, tracking: -0.02 });

/** the tag's width (dot + gap + label) for a label-role size */
export const tagWidth = (name: string, size: number) => size * 0.3 + size * 0.5 + labelWidth(name, size);

export const Tag: React.FC<{
  t: number;
  /** the tag's left edge (align left) or centre (align center), its row's top */
  x: number;
  y: number;
  align: 'left' | 'center';
  name: 'CALLER' | 'AVA';
  ink: string;
  /** rises at / leaves at */
  at: number;
  exitAt?: number;
  /** show the call timer after it */
  timer?: boolean;
  timerInk?: string;
  /** the timer's reading holds from here (a turn that is leaving keeps its last time) */
  timerHold?: number;
  /** a colour veil over it (the stop-time's desaturation): 0..1 toward `veilInk` */
  veil?: number;
  veilInk?: string;
  moving?: boolean;
}> = ({ t: tNow, x, y, align, name, ink, at, exitAt, timer = false, timerInk = HOME.muted, timerHold, veil = 0, veilInk = '#8a8798', moving = false }) => {
  const t = tNow;
  const tt = timerHold !== undefined ? Math.min(tNow, timerHold) : tNow;
  const L = useLayout();
  useKitFaces();
  if (t < at - 1) return null;
  if (exitAt !== undefined && t > exitAt + 12) return null;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const size = label.fontSize as number;
  const meta = typeStyle('meta', L.vertical, { tone: 'paper' });
  const msize = meta.fontSize as number;
  const dot = Math.round(size * 0.3);
  const tw = tagWidth(name, size);
  const gap = size * 1.1;
  const timerW = timer ? measureText('00:00', { size: msize, weight: 460, mono: true }) : 0;
  const total = tw + (timer ? gap + timerW : 0);
  const left = align === 'center' ? x - total / 2 : x;
  const r = reveal(t, at, { config: SPRING.caption, rise: 90, exit: exitAt !== undefined ? { at: exitAt, dur: 7 } : undefined });
  const hold = moving || Math.abs(r.y) > 0.03 || t - at < 14;
  const c = veil > 0.001 ? mixHex(ink, veilInk, veil) : ink;
  const tc = veil > 0.001 ? mixHex(timerInk, veilInk, veil) : timerInk;
  // the timer's figures: the previous reading rolls up out, the new one in (only the figures that change)
  let timerNode: React.ReactNode = null;
  if (timer) {
    const now = fmt(Math.max(0, secondsAt(tt)));
    const tick = lastTick(tt);
    const prev = fmt(Math.max(0, secondsAt(tick - 0.01)));
    const u = tween(tt, [tick, tick + 6], [0, 1], EASE.out3);
    const rolling = u < 1 && t >= at + 2;
    timerNode = (
      <span style={{ display: 'inline-flex', marginLeft: gap, ...meta, color: tc, fontVariantNumeric: 'tabular-nums' }}>
        {now.split('').map((ch, i) => {
          const changed = prev[i] !== ch;
          if (!rolling || !changed) return <span key={i}>{ch}</span>;
          return (
            <span key={i} style={{ ...maskBox(0), position: 'relative' }}>
              <span style={{ display: 'inline-block', visibility: 'hidden' }}>{ch}</span>
              <span style={{ position: 'absolute', left: `${0.0}em`, top: '0.16em', display: 'inline-block', transform: `translateY(${(-u * 110).toFixed(2)}%)`, opacity: 1 - u }}>{prev[i]}</span>
              <span style={{ position: 'absolute', left: `${0.0}em`, top: '0.16em', display: 'inline-block', transform: `translateY(${((1 - u) * 110).toFixed(2)}%)` }}>{ch}</span>
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', ...subpixel(`translate(${left.toFixed(3)}px, ${y.toFixed(3)}px)`, moving) }}>
      <span style={{ ...maskBox(0), display: 'block' }}>
        <span style={{ ...revealStyle(r, undefined, hold), display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', ...label, color: c }}>
            <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: c, transform: 'translateY(-0.04em)' }} />
            {name}
          </span>
          {timerNode}
        </span>
      </span>
    </div>
  );
};

/* ── the lines ──────────────────────────────────────────────────── */

export type LineWord = { text: string; x: number; w: number };
/** the words of a turn's fixed lines, laid out (left edges relative to the line's own left) */
export function layLines(lines: readonly string[], size: number) {
  const spec = captionSpec(size);
  return lines.map((ln) => layoutWords(ln, spec));
}

export const Lines: React.FC<{
  t: number;
  lines: readonly string[];
  size: number;
  /** left edge (align left) or centre (align center) of every line; each line's top */
  x: number;
  tops: readonly number[];
  align: 'left' | 'center';
  color: string;
  /** the turn rises at (its first spoken word) */
  at: number;
  exitAt?: number;
  /** per word (index across all lines) ink: a key colour easing in */
  ink?: (i: number) => string | null;
  veil?: number;
  veilInk?: string;
  moving?: boolean;
  /** an underline under words (global indices, inclusive), drawn left → right over [at, at + dur], with a part of a
   *  word excluded at its end (e.g. the "?" of "weekend?") */
  underline?: { from: number; to: number; at: number; dur: number; color: string; trimEnd?: string };
}> = ({ t, lines, size, x, tops, align, color, at, exitAt, ink, veil = 0, veilInk = '#8a8798', moving = false, underline }) => {
  const L = useLayout();
  useKitFaces();
  if (t < at - 1) return null;
  if (exitAt !== undefined && t > exitAt + 14) return null;
  const st = typeStyle('caption', L.vertical, { tone: 'paper', size });
  const laid = layLines(lines, size);
  let gi = 0;
  const bars: React.ReactNode[] = [];
  const spans: ({ x0: number; x1: number; top: number; r: ReturnType<typeof reveal> } | undefined)[] = [];
  const nodes = laid.map((lay, li) => {
    const left = align === 'center' ? x - lay.width / 2 : x;
    const top = tops[li];
    const words = lay.words.map((w, k) => {
      const i = gi++;
      const r = reveal(t, at + i * 0.5, { config: SPRING.caption, rise: 80, exit: exitAt !== undefined ? { at: exitAt + Math.min(1.4, i * 0.2), dur: 5 } : undefined });
      let c = ink?.(i) ?? color;
      if (veil > 0.001) c = mixHex(c, veilInk, veil);
      // the underline: one span per line, from its first underlined word to its last (a trailing "?" left out)
      if (underline && i >= underline.from && i <= underline.to) {
        const trim = i === underline.to && underline.trimEnd && w.text.endsWith(underline.trimEnd) ? measureText(underline.trimEnd, captionSpec(size)) : 0;
        const x0 = left + w.x;
        const x1 = left + w.x + w.w - trim;
        const sp = spans[li];
        if (sp) sp.x1 = x1;
        else spans[li] = { x0, x1, top, r };
      }
      const hold = moving || t - at < 16 || (exitAt !== undefined && t > exitAt - 1);
      return (
        <span key={k} style={{ ...maskBox(k === lay.words.length - 1 ? 0 : 0), position: 'absolute', left: w.x, top: 0 }}>
          <span style={{ ...revealStyle(r, undefined, hold), color: c }}>{w.text}</span>
        </span>
      );
    });
    return (
      <div key={li} style={{ position: 'absolute', left, top, height: size * 1.18, ...st, lineHeight: 1.18, whiteSpace: 'nowrap' }}>
        {words}
      </div>
    );
  });
  // the underline draws left → right across its spans as one stroke (EASE.draw over `dur`)
  if (underline) {
    const live = spans.filter((v): v is NonNullable<typeof v> => !!v);
    const total = live.reduce((a, v) => a + (v.x1 - v.x0), 0);
    let done = tween(t, [underline.at, underline.at + underline.dur], [0, 1], EASE.draw) * total;
    live.forEach((v, k) => {
      const len = v.x1 - v.x0;
      const wv = Math.max(0, Math.min(len, done));
      done -= len;
      if (wv <= 0) return;
      const th = Math.max(2, size * 0.04);
      bars.push(
        <rect
          key={`u${k}`}
          x={v.x0}
          y={v.top + size * 1.08 - (v.r.y / 100) * size * 1.18}
          width={wv}
          height={th}
          rx={th / 2}
          fill={underline.color}
          opacity={(veil > 0.001 ? 1 - 0.3 * veil : 1) * Math.max(0, v.r.opacity)}
        />,
      );
    });
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(moving ? 'translate(0px, 0px)' : undefined, moving) }}>
      {nodes}
      {bars.length ? (
        <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          {bars}
        </svg>
      ) : null}
    </div>
  );
};

/** the frame box of a word (global index) in a turn's fixed lines — to start a link at it */
export function wordBox(lines: readonly string[], size: number, x: number, tops: readonly number[], align: 'left' | 'center', index: number, trimEnd = '') {
  const laid = layLines(lines, size);
  let gi = 0;
  for (let li = 0; li < laid.length; li++) {
    const lay = laid[li];
    const left = align === 'center' ? x - lay.width / 2 : x;
    for (const w of lay.words) {
      if (gi === index) {
        const trim = trimEnd && w.text.endsWith(trimEnd) ? measureText(trimEnd, captionSpec(size)) : 0;
        return { x: left + w.x, y: tops[li], w: w.w - trim, h: size * 1.18 };
      }
      gi++;
    }
  }
  return { x, y: tops[0], w: 0, h: size * 1.18 };
}

/* ── the caller's line ──────────────────────────────────────────── */

export const CallWave: React.FC<{
  t: number;
  at: number;
  voice: VoiceId;
  cx: number;
  cy: number;
  half: number;
  barW: number;
  pitch: number;
  maxH: number;
  color: string;
  open: number;
  close: number;
  /** the line's own clock stops here (the bars keep their shape) */
  freezeAt?: number;
  resumeAt?: number;
  seed?: string;
}> = ({ t, at, voice, cx, cy, half, barW, pitch, maxH, color, open, close, freezeAt, resumeAt, seed = 'kb-call-line' }) => {
  const reach = Math.max(0, Math.min(1.02, open)) * (1 - Math.max(0, Math.min(1, close)));
  if (reach <= 0.002) return null;
  // the line's clock: held from the freeze to the resume
  const tl = freezeAt !== undefined && t > freezeAt ? (resumeAt !== undefined && t > resumeAt ? t - (resumeAt - freezeAt) : freezeAt) : t;
  const n = Math.floor(half / pitch);
  const rects: React.ReactNode[] = [];
  const H = 2 * maxH + 8;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = side < 0 ? 1 : 0; i <= n; i++) {
      const u = (i * pitch) / half;
      const gate = Math.min(1, Math.max(0, (reach * 1.06 - u) / 0.06));
      if (gate <= 0) continue;
      const e = env(voice, tl - at - u * 5);
      const tex = 0.55 + 0.45 * (0.5 + 0.5 * noise2D(seed, i * 0.31 * side, tl * 0.06));
      const shape = 1 - 0.45 * u * u;
      const h = Math.max(barW, 2 * maxH * Math.pow(Math.max(0, e), 0.8) * tex * shape * gate);
      const fade = 1 - Math.pow(u, 3);
      const op = (0.38 + 0.62 * Math.min(1, e * 1.6)) * fade * Math.min(1, gate * 1.4);
      const x = cx + side * i * pitch;
      rects.push(<rect key={`${side}-${i}`} x={(x - cx + half - barW / 2).toFixed(3)} y={(H / 2 - h / 2).toFixed(3)} width={barW} height={h.toFixed(3)} rx={barW / 2} fill={color} opacity={op.toFixed(4)} />);
    }
  }
  return (
    <svg width={2 * half} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', ...subpixel(`translate(${(cx - half).toFixed(3)}px, ${(cy - H / 2).toFixed(3)}px)`, true) }}>
      {rects}
    </svg>
  );
};
