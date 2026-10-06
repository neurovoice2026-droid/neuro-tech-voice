/**
 * THE REELS' CALL PARTS (docs/ig/SCRIPT.md §5 "LiveTranscript + TurnLabel + CallerMeter + ToolRow"; ig2 b3–b9, ig3 b3–b5,
 * ig4 b5): a FORK of film 2's src/kb/scenes/call/Strip.tsx @ 743247a (its Tag, unbound from CALL_LOCAL: no call timer —
 * the reels claim no real-time continuity) plus the rows the reels add. House type only: TYPE.label for the tags,
 * TYPE.title for her words, the kit's ui() for app chrome; every piece rises out of its own mask and leaves up through
 * it (never blur); moving rows ride sub-pixel layers.
 *
 *   <TurnLabel>       ● AVA (sunday teal) / ● CALLER (slate): a dot and the label role, rising out of its mask
 *   <LiveTranscript>  the call as it happens: rows APPEND as turns — a TurnLabel over her words (word-synced: each word
 *                     rises out of its mask on her onset, 2 f ahead; laid out once, so nothing reflows; the display map
 *                     applies) or, for a caller, the CallerMeter (no words, no voice). When a row would overflow the box
 *                     the stack scrolls up one row on SPRING.site; a row passing the top edge fades out under it (per-row
 *                     opacity + the box's clip — no mask-image, which re-rasters type differently per render tab), and
 *                     earlier rows step down to 45 % ink so the live turn leads. Each visible row reports its rect.
 *   <CallerMeter>     the caller's line: five slate bars (8 × 28 px) bouncing on a seeded envelope, gated by the turn
 *   <ToolRow>         an inline tool step, the dashboard's own words (call-display.tsx TOOL_LABELS): lucide `loader`
 *                     turning (the app's animate-spin, 1 turn / s) until `done`, where a drawn check (kit CheckMark)
 *                     takes its place
 *
 * Every value is a pure function of the absolute timeline frame `t`.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { subpixel } from '../../lib/glide';
import { EASE, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { TYPE } from '../../theme';
import { APP, CheckMark, labelWidth, measureText, spaceWidth, typo, ui, useKitFaces, W } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { KB_INK } from '../../kb/theme';
import type { ReelTimeline } from '../types';
import { VOICE } from '../voice.generated';
import { CAP_LEAD, type CapKey } from './Captions';
import { IgIcon } from './icons';
import { ZoneRect } from './ZoneGuard';

/** the speakers' inks on a white panel / pearl (film 2: Ava's tag in sunday teal, callers in slate) */
export const TURN_INK = {
  ava: { tag: MOMENT_LIGHTS.sunday.ink, text: '#140a24' },
  caller: { tag: KB_INK.caller.paper.tag, text: KB_INK.caller.paper.text },
} as const;
export type Who = keyof typeof TURN_INK;

const LABEL = (size: number) => ({ size, weight: TYPE.label.weight, tracking: 0.14 });

/** the tag's width (dot + gap + label) at a label size */
export const turnLabelWidth = (who: Who, size = 28) => size * 0.3 + size * 0.5 + labelWidth(who === 'ava' ? 'AVA' : 'CALLER', size);

/* ── TurnLabel ──────────────────────────────────────────────────── */

export const TurnLabel: React.FC<{
  t: number;
  who: Who;
  /** the tag's left edge and top (frame px) */
  x: number;
  y: number;
  at: number;
  exitAt?: number;
  size?: number;
  ink?: string;
  /** a carrying container is moving (hold the sub-pixel layer) */
  moving?: boolean;
  /** report the rect to the zone guard (default true) */
  zone?: boolean;
}> = ({ t, who, x, y, at, exitAt, size = 28, ink, moving = false, zone = true }) => {
  const glide = useGlide();
  if (t < at - 1) return null;
  if (exitAt !== undefined && t > exitAt + 9) return null;
  const c = ink ?? TURN_INK[who].tag;
  const dot = Math.round(size * 0.3);
  const r = reveal(t, at, { config: SPRING.caption, rise: 90, exit: exitAt !== undefined ? { at: exitAt, dur: 6 } : undefined });
  const hold = moving || glide || Math.abs(r.y) > 0.03 || t - at < 14;
  const label = typeStyle('label', true, { tone: 'paper', size });
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, whiteSpace: 'nowrap' }}>
        <span style={{ ...maskBox(0), display: 'block' }}>
          <span style={{ ...revealStyle(r, undefined, hold), display: 'inline-flex', alignItems: 'center', gap: '0.5em', ...label, color: c }}>
            <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: c, transform: 'translateY(-0.04em)' }} />
            {who === 'ava' ? 'AVA' : 'CALLER'}
          </span>
        </span>
      </div>
      {zone ? <ZoneRect what={`turn label ${who}`} rect={{ x, y, w: turnLabelWidth(who, size), h: size * 1.2 }} /> : null}
    </>
  );
};

/* ── CallerMeter ────────────────────────────────────────────────── */

export const CallerMeter: React.FC<{
  t: number;
  /** the caller's turn [from, to] (absolute frames): the bars bounce inside it, rest outside */
  from: number;
  to: number;
  /** left edge, vertical centre */
  x: number;
  cy: number;
  bars?: number;
  barW?: number;
  maxH?: number;
  gap?: number;
  color?: string;
  seed?: string;
  /** optional: × the envelope (default 1), clamped to the bars' full height — a livelier read of the same line */
  gain?: number;
}> = ({ t, from, to, x, cy, bars = 5, barW = 8, maxH = 28, gap = 7, color = TURN_INK.caller.tag, seed = 'ig-caller', gain = 1 }) => {
  // the turn's gate: up over 3 f, down over 5 f
  const gate = tween(t, [from, from + 3], [0, 1], EASE.out3) * (1 - tween(t, [to - 2, to + 3], [0, 1], EASE.inOut));
  const W_ = bars * barW + (bars - 1) * gap;
  return (
    <svg width={W_} height={maxH} style={{ position: 'absolute', left: x, top: cy - maxH / 2, overflow: 'visible' }} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        // a seeded syllable envelope (a slow phrase × a quicker syllable), each bar its own phase, the middle ones taller
        const phrase = 0.55 + 0.45 * noise2D(seed, i * 0.13, t * 0.045);
        const syl = 0.5 + 0.5 * noise2D(`${seed}-s`, i * 0.71, t * 0.21);
        const shape = 1 - 0.32 * Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const e = Math.max(0, Math.min(1, gain * phrase * (0.35 + 0.75 * syl))) * shape;
        const h = Math.max(barW, barW + (maxH - barW) * e * gate);
        const op = 0.45 + 0.55 * gate;
        return <rect key={i} x={i * (barW + gap)} y={(maxH - h) / 2} width={barW} height={h} rx={barW / 2} fill={color} opacity={op.toFixed(4)} />;
      })}
    </svg>
  );
};

/* ── ToolRow ────────────────────────────────────────────────────── */

export const ToolRow: React.FC<{
  t: number;
  /** the dashboard's label (call-display.tsx TOOL_LABELS: "Checked your availability", "Booked an appointment", …) */
  label: string;
  x: number;
  y: number;
  at: number;
  /** the spinner turns until here; the check draws from here */
  done: number;
  exitAt?: number;
  size?: number;
  ink?: string;
  /** the check's colour (the act's accent) */
  accent?: string;
}> = ({ t, label, x, y, at, done, exitAt, size = 30, ink = APP.mutedFg, accent = MOMENT_LIGHTS.sunday.ink }) => {
  const glide = useGlide();
  if (t < at - 1) return null;
  if (exitAt !== undefined && t > exitAt + 9) return null;
  const r = reveal(t, at, { config: SPRING.caption, rise: 80, exit: exitAt !== undefined ? { at: exitAt, dur: 6 } : undefined });
  const hold = glide || Math.abs(r.y) > 0.03 || t - at < 14;
  const icon = Math.round(size * 1.05);
  // the app's animate-spin: one turn a second
  const spin = ((t - at) / 30) * 360;
  const swap = tween(t, [done - 1, done + 2], [0, 1], EASE.inOut);
  const txt = typo(label);
  const w = icon + size * 0.45 + measureText(txt, { size, weight: W.medium });
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, whiteSpace: 'nowrap' }}>
        <span style={{ ...maskBox(0), display: 'block' }}>
          <span style={{ ...revealStyle(r, undefined, hold), display: 'inline-flex', alignItems: 'center', gap: size * 0.45, ...ui(size, W.medium), color: ink }}>
            <span style={{ position: 'relative', display: 'inline-block', width: icon, height: icon }}>
              {swap < 1 ? (
                <span style={{ position: 'absolute', inset: 0, opacity: 1 - swap }}>
                  <IgIcon name="loader" size={icon} color={ink} rotate={spin} stroke={2.2} />
                </span>
              ) : null}
              {t >= done - 0.5 ? (
                <span style={{ position: 'absolute', inset: 0, opacity: swap }}>
                  <CheckMark size={icon} t={t} at={done} color={accent} stroke={2.6} />
                </span>
              ) : null}
            </span>
            <span>{txt}</span>
          </span>
        </span>
      </div>
      <ZoneRect what={`tool row “${label}”`} rect={{ x, y, w, h: size * 1.2 }} />
    </>
  );
};

/* ── LiveTranscript ─────────────────────────────────────────────── */

export type Turn =
  /** her line (absolute start = its VOICES entry unless `at` is given); keys: glints on words (e.g. "an AI assistant");
   *  breaks (optional): word indices of `say` that start a new line (the phrase's own breaks, instead of a greedy wrap —
   *  a line that would still overflow the box wraps as before); nudge (optional): frames added to a word's onset (by its
   *  index in `say`) where the aligner's stamp is off the take's energy (two words sharing one stamp) */
  | { who: 'ava'; id: string; at?: number; keys?: readonly CapKey[]; breaks?: readonly number[]; nudge?: Readonly<Record<number, number>> }
  /** a caller's turn: the meter, no words */
  | { who: 'caller'; from: number; to: number };

export type TranscriptSpec = {
  /** the visible box (frame px): rows stack from its top; the stack scrolls when a row would pass its bottom */
  x: number;
  y: number;
  w: number;
  h: number;
  /** her words' size (title role: ig2 52, ig3 56) */
  size?: number;
  /** the tags' size (label role, 28) */
  labelSize?: number;
  /** px between a tag and its words; between rows */
  tagGap?: number;
  rowGap?: number;
  /** optional: the caller's level meter (CallerMeter's bars / barW / maxH / gap / gain; default its own 5 × 8 × 28 px).
   *  `rise`: the meter rises out of its mask WITH its ● CALLER tag (default: off — the bars rest in place from the row's
   *  start) */
  meter?: { bars?: number; barW?: number; maxH?: number; gap?: number; gain?: number; rise?: boolean };
  /** optional: frames BEFORE a row's start that the stack's scroll for it begins (default 0: with the row) — the room is
   *  made, then the row rises into it */
  scrollLead?: number;
};

type Row = {
  turn: Turn;
  start: number;
  /** relative to the stack's top */
  y: number;
  h: number;
  /** words (ava): tokens with x / line / onset */
  words: { text: string; x: number; line: number; w: number; onset: number; first: number; last: number }[];
  lines: number;
};

const SAY = (id: string) => (VOICE.lines as Record<string, { say: string }>)[id]?.say ?? '';

/** the rows of a transcript, laid out (needs the kit's faces) */
export function transcriptRows(T: ReelTimeline, turns: readonly Turn[], s: TranscriptSpec): Row[] {
  const size = s.size ?? 52;
  const lab = s.labelSize ?? 28;
  const tagGap = s.tagGap ?? Math.round(size * 0.42);
  const rowGap = s.rowGap ?? Math.round(size * 0.62);
  const lh = size * 1.18;
  const spec = { size, weight: TYPE.title.weight, tracking: -0.02 };
  const space = spaceWidth(spec);
  let y = 0;
  return turns.map((turn) => {
    let words: Row['words'] = [];
    let lines = 1;
    let start: number;
    if (turn.who === 'ava') {
      const at = turn.at ?? T.VOICES.find((v) => v.id === turn.id)?.at ?? 0;
      const raw = typo(SAY(turn.id)).split(' ').filter(Boolean);
      const toks: { text: string; first: number; last: number; onset: number }[] = [];
      for (let i = 0; i < raw.length; i++) {
        const d = T.DISPLAY.find((m) => m.id === turn.id && m.from === i);
        const onsetOf = (k: number) => at + T.vWord(turn.id, k) + (turn.nudge?.[k] ?? 0);
        if (d) {
          toks.push({ text: d.text, first: i, last: d.to, onset: onsetOf(i) });
          i = d.to;
        } else toks.push({ text: raw[i], first: i, last: i, onset: onsetOf(i) });
      }
      let x = 0;
      let line = 0;
      words = toks.map((tk) => {
        const w = measureText(tk.text, spec);
        if (x > 0 && (x + w > s.w + 0.01 || (turn.breaks?.includes(tk.first) ?? false))) {
          line++;
          x = 0;
        }
        const out = { ...tk, x, line, w };
        x += w + space;
        return out;
      });
      lines = line + 1;
      start = toks[0]?.onset - CAP_LEAD;
    } else start = turn.from;
    const h = lab * 1.2 + tagGap + lines * lh;
    const row: Row = { turn, start, y, h, words, lines };
    y += h + rowGap;
    return row;
  });
}

export const LiveTranscript: React.FC<{
  T: ReelTimeline;
  t: number;
  turns: readonly Turn[];
  spec: TranscriptSpec;
  /** everything leaves up through its masks from here */
  exitAt?: number;
  /** a carrying panel is moving (rows hold their sub-pixel layers) */
  moving?: boolean;
  /** earlier rows step down to this ink (default .45) */
  pastInk?: number;
}> = ({ T, t, turns, spec, exitAt, moving = false, pastInk = 0.45 }) => {
  const ready = useKitFaces();
  if (!ready) return null;
  const size = spec.size ?? 52;
  const lab = spec.labelSize ?? 28;
  const tagGap = spec.tagGap ?? Math.round(size * 0.42);
  const lh = size * 1.18;
  const rows = transcriptRows(T, turns, spec);
  // the scroll, ONE ROW PER TURN: when a new row would pass the box's bottom, the stack moves up by whole rows (the
  // oldest rows leave until the new one fits), so the box always starts on a row — never on half a row — on the site's
  // spring from the new row's start
  let scroll = 0;
  let prev = 0;
  const lead = spec.scrollLead ?? 0;
  rows.forEach((r, i) => {
    let k = 0;
    while (k < i && r.y + r.h - rows[k].y > spec.h) k++;
    const need = Math.max(prev, rows[k].y);
    if (need > prev) scroll += (need - prev) * springUnit(t - r.start + lead, SPRING.site);
    prev = need;
  });
  const scrolling = rows.some((r) => {
    const k = t - r.start + lead;
    return k > 0 && k < 24 + lead;
  });
  const titleSt = typeStyle('title', true, { tone: 'paper', size });
  return (
    <div style={{ position: 'absolute', left: spec.x, top: spec.y, width: spec.w + 40, height: spec.h, overflow: 'hidden', marginLeft: -20, paddingLeft: 20 }}>
      <div style={{ position: 'absolute', left: 20, top: 0, width: spec.w, ...subpixel(`translateY(${(-scroll).toFixed(3)}px)`, scrolling || moving) }}>
        {rows.map((r, i) => {
          if (t < r.start - 1) return null;
          const top = r.y - scroll;
          // passing the top edge: it fades under it
          const passed = Math.max(0, -top);
          const edge = 1 - smooth(0, r.h * 0.7, passed);
          if (edge <= 0.002) return null;
          // an earlier row steps down once the next turn starts
          const next = rows[i + 1];
          const past = next ? tween(t, [next.start, next.start + 8], [0, 1], EASE.inOut) : 0;
          const o = edge * (1 - (1 - pastInk) * past);
          const turn = r.turn;
          const ink = TURN_INK[turn.who];
          const exitFor = (k: number) => (exitAt !== undefined ? { at: exitAt + Math.min(1.4, k * 0.2), dur: 5 } : undefined);
          let body: React.ReactNode = null;
          let bodyW = 0;
          if (turn.who === 'ava') {
            bodyW = Math.max(...r.words.filter((w) => w.line === 0).map((w) => w.x + w.w), 0);
            if (r.lines > 1) bodyW = spec.w;
            body = r.words.map((w, k) => {
              const rv = reveal(t, w.onset - CAP_LEAD, { config: SPRING.caption, rise: 80, fade: 0.5, exit: exitFor(k) });
              const key = turn.keys?.find((kk) => kk.words.some((x) => x >= w.first && x <= w.last));
              let col: string = ink.text;
              if (key) {
                const mode = key.from ?? (key.glint ? 'onset' : 'set');
                if (mode === 'set') col = key.ink;
                else if (t >= w.onset - 1) {
                  const up = tween(t, [w.onset - 1, w.onset + 1], [0, 1], EASE.out3);
                  const settle = tween(t, [w.onset + 1, w.onset + 14], [0, 1], EASE.inOut);
                  const g = key.glint ?? key.ink;
                  col = settle <= 0 ? mixHex(ink.text, g, up) : mixHex(g, key.ink, settle);
                }
              }
              const hold = moving || scrolling || Math.abs(rv.y) > 0.03 || t - w.onset < 14;
              return (
                <span key={k} style={{ ...maskBox(0), position: 'absolute', left: w.x, top: lab * 1.2 + tagGap + w.line * lh }}>
                  <span style={{ ...revealStyle(rv, undefined, hold), color: col }}>{w.text}</span>
                </span>
              );
            });
          } else {
            const mt = spec.meter ?? {};
            bodyW = (mt.bars ?? 5) * (mt.barW ?? 8) + ((mt.bars ?? 5) - 1) * (mt.gap ?? 7);
            const fade = exitAt !== undefined ? 1 - tween(t, [exitAt, exitAt + 5], [0, 1], EASE.in3) : 1;
            const meter = <CallerMeter t={t} from={turn.from} to={turn.to} x={2} cy={lab * 1.2 + tagGap + lh / 2} bars={mt.bars} barW={mt.barW} maxH={mt.maxH} gap={mt.gap} gain={mt.gain} />;
            if (mt.rise) {
              // the meter rises out of its own mask with its tag (the same spring, a ½-frame behind), never ahead of it
              const mh = mt.maxH ?? 28;
              const top = lab * 1.2 + tagGap + lh / 2 - mh / 2 - 4;
              const rv = reveal(t, r.start + 0.5, { config: SPRING.caption, rise: 100 });
              body = (
                <div style={{ position: 'absolute', left: 0, top, width: bodyW + 8, height: mh + 8, overflow: 'hidden', opacity: fade >= 0.999 ? undefined : fade }}>
                  <div style={{ position: 'absolute', left: 0, top: -top, opacity: rv.opacity >= 0.999 ? undefined : rv.opacity, ...subpixel(Math.abs(rv.y) > 0.03 ? `translateY(${((rv.y / 100) * (mh + 8)).toFixed(3)}px)` : undefined, Math.abs(rv.y) > 0.03 || moving || scrolling) }}>{meter}</div>
                </div>
              );
            } else
              body = (
                <div style={{ position: 'absolute', left: 0, top: 0, opacity: fade }}>
                  {meter}
                </div>
              );
          }
          const screenTop = spec.y + top;
          const visible = screenTop + r.h > spec.y && screenTop < spec.y + spec.h;
          return (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: 0, top: r.y, width: spec.w, height: r.h, opacity: o >= 0.999 ? undefined : o, ...titleSt, lineHeight: 1.18, whiteSpace: 'nowrap' }}>
                <TurnLabel t={t} who={turn.who} x={0} y={0} at={r.start} exitAt={exitAt} size={lab} moving={moving || scrolling} zone={false} />
                {body}
              </div>
              {visible && o > 0.05 ? (
                <ZoneRect what={`transcript row ${turn.who === 'ava' ? turn.id : 'caller'}`} rect={{ x: spec.x, y: Math.max(spec.y, screenTop), w: Math.max(turnLabelWidth(turn.who, lab), bodyW), h: Math.min(r.h, spec.y + spec.h - Math.max(spec.y, screenTop)) }} />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** the frame a transcript's row starts (for scenes landing chips on it) */
export const turnStart = (T: ReelTimeline, turn: Turn) =>
  turn.who === 'caller' ? turn.from : (turn.at ?? T.VOICES.find((v) => v.id === turn.id)?.at ?? 0) + T.vWord(turn.id, 0) - CAP_LEAD;

/** the label role's measured width (re-export for scenes placing chips after a tag) */
export const labelW = (text: string, size = 28) => measureText(text.toUpperCase(), LABEL(size));
