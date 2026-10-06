/**
 * REEL 4 · THE SINGLE SLOT (docs/ig/SCRIPT.md ig4 b2–b6, §5 "SingleSlot, new"): one place on the frame where whatever is
 * being asked or answered sits — a slate hairline frame at x 86–906, y 1180–1420 with its chrome eyebrow above it:
 *
 *   ASKED AS     the site's own figure label (lib/pages/knowledge-base.ts MEANING.asked, label role 28, slate), drawn
 *                with the frame on the first ring
 *   phrasings    each in slate (title 60, typographic quotes), a caption of HER line (the Captions fork: the screen
 *                rises as a unit 2 f ahead of her first word); the next ring sends it up and out through its masks
 *   "pricey"     the word the page never says takes a slate underline on its onset
 *   ● AVA        b5: the eyebrow swaps to her tag, the frame turns her teal, and her answer is set word by word as she
 *                says it (each word out of its mask 2 f ahead of its onset, the display map's "$85." taking her teal)
 *   Now: "…"     b6: back to ASKED AS for the curveball; it holds through the stop-time and the fallback (dimmed),
 *                and the slot leaves before the thesis
 *
 * The frame is SVG (exact at fractional edges); every word reports its rect through Captions or here.
 */
import React from 'react';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { EASE, mixHex, smooth, SPRING, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { labelWidth, typo, useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { KB_INK } from '../../kb/theme';
import { TurnLabel, turnLabelWidth } from '../components/Call';
import { CAP_LEAD, Captions, captionScreens, layoutScreen, retextScreens, type CapKey, type CapPlace } from '../components/Captions';
import { ZoneRect } from '../components/ZoneGuard';
import { SLOT } from './layout';
import * as T from './timing';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the caller's slate (film 2: callers in slate) */
export const SLATE = { text: KB_INK.caller.paper.text, tag: KB_INK.caller.paper.tag } as const;
const AVA_TEXT = '#140a24';
const M = T.M;

/** the four slot lines, their quotes (by first word index) and their exits; `stack`: a line of several screens set one
 *  per row (each screen on its own word, the first holding until the line leaves — the curveball's "Now:" then its
 *  question) */
type SlotLine = { id: T.VoiceId; at: number; retext: Readonly<Record<number, string>>; rows?: readonly number[]; out: number; keys?: readonly CapKey[]; stack?: boolean };
export const SLOT_LINES: readonly SlotLine[] = [
  { id: 'ig4-02', at: T.LINE.asked[0], retext: { 0: '“How', 4: 'hour?”' }, out: M.phrasingOut[0] },
  { id: 'ig4-03', at: T.LINE.asked[1], retext: { 0: '“What', 6: 'back?”' }, rows: [4], out: M.phrasingOut[1] },
  { id: 'ig4-04', at: T.LINE.asked[2], retext: { 0: '“Is', 4: 'pricey?”' }, rows: [4], out: M.phrasingOut[2] },
  // "Now:" is the narrator's own word (graphite); the question in the caller's slate
  { id: 'ig4-06', at: T.LINE.curve, retext: { 1: '“Do', 5: 'visits?”' }, rows: [1], out: M.edgeOut, keys: [{ words: [0], ink: '#2b2a2e', from: 'set' }], stack: true },
];
/** where a slot line is set: inside the frame, left at its padding, centred on the frame's middle */
export const slotPlace = (rows?: readonly number[]): CapPlace => ({
  x: SLOT.x + SLOT.pad,
  y: (SLOT.textTop + SLOT.textBottom) / 2,
  valign: 'center',
  maxWidth: SLOT.w - 2 * SLOT.pad,
  align: 'left',
  role: 'title',
  size: SLOT.textSize,
  lineHeight: 1.16,
  color: SLATE.text,
  rows,
});

/** a stacked line's place per screen: the whole line's rows (slotPlace(rows), centred in the frame), screen k on row k */
function stackPlace(line: SlotLine): (k: number) => CapPlace {
  const all = retextScreens(captionScreens(T, line.id, { at: line.at }), line.retext).flatMap((s) => s.tokens);
  const lay = layoutScreen(all, slotPlace(line.rows));
  return (k) => ({ ...slotPlace(), valign: 'top', y: lay.top + k * lay.rowH });
}

/** the laid-out tokens of a slot line (needs the faces) — for the hairlines' feet and the underline */
export function slotLayout(line: SlotLine) {
  const s = retextScreens(captionScreens(T, line.id, { at: line.at }), line.retext)[0];
  return { screen: s, lay: layoutScreen(s.tokens, slotPlace(line.rows)) };
}
/** the foot of a phrasing's hairline: the slot's top edge, over its last word */
export function linkFoot(k: number) {
  const { lay } = slotLayout(SLOT_LINES[k]);
  const p = lay.pos[lay.pos.length - 1];
  return { x: p.x + p.w * 0.5, y: SLOT.y };
}

/* ── the frame ── */
const FRAME_DRAW = 12;
/** the frame's ink: slate for a caller's question, her teal while she answers */
const frameInk = (t: number) => {
  const toTeal = tween(t, [M.swap, M.swap + 6], [0, 1], EASE.inOut);
  const back = tween(t, [M.answerOut, M.answerOut + 6], [0, 1], EASE.inOut);
  return mixHex(mixHex(SLATE.tag, SUNDAY.orb[2], toTeal), SLATE.tag, back);
};
/** the slot's own exit: before the thesis (its question, its frame) */
const SLOT_OUT = M.edgeOut;
/** b8: the question steps back while the owner's field holds the frame */
const dimAt = (t: number) => 1 - 0.45 * tween(t, [M.fieldUp, M.fieldUp + 10], [0, 1], EASE.inOut);

export const SlotFrame: React.FC<{ t: number }> = ({ t }) => {
  if (t < M.slot - 0.5 || t > SLOT_OUT + 6) return null;
  const draw = tween(t, [M.slot, M.slot + FRAME_DRAW], [0, 1], EASE.draw);
  // the frame leaves WITH its question (one unit, over the caption's own exit): never an empty frame on the stage
  const q = tween(t, [SLOT_OUT, SLOT_OUT + 5], [0, 1], EASE.inOut);
  const ink = frameInk(t);
  const fill = 0.42 * smooth(0.3, 1, draw) * (1 - q);
  const a = (0.62 + 0.25 * tween(t, [M.swap, M.swap + 6], [0, 1], EASE.inOut) * (1 - tween(t, [M.answerOut, M.answerOut + 6], [0, 1], EASE.inOut))) * (1 - q) * (t > M.fieldUp ? dimAt(t) : 1);
  const { x, y, w, h, r } = SLOT;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {fill > 0.002 ? <rect x={x} y={y} width={w} height={h} rx={r} fill="#ffffff" fillOpacity={fill.toFixed(4)} /> : null}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke={ink}
        strokeOpacity={a.toFixed(4)}
        strokeWidth={1.6}
        pathLength={1}
        strokeDasharray={draw < 1 ? `${draw.toFixed(4)} 2` : undefined}
      />
    </svg>
  );
};

/* ── the eyebrow: ASKED AS → ● AVA → ASKED AS ── */
type Brow = { at: number; who: 'asked' | 'ava'; out: number };
const BROWS: readonly Brow[] = [
  { at: M.slot + 1, who: 'asked', out: M.swap - 5 },
  { at: M.swap + 1, who: 'ava', out: M.answerOut - 1 },
  { at: M.answerOut + 7, who: 'asked', out: SLOT_OUT },
];
/** an eyebrow's exit (frames): the last one leaves with its frame and question as one unit */
const browOut = (b: Brow) => (b.out === SLOT_OUT ? 4 : 6);
const ASKED = 'Asked as';
export const Eyebrow: React.FC<{ t: number }> = ({ t }) => {
  const glide = useGlide();
  const ready = useKitFaces();
  if (!ready) return null;
  const size = 28;
  const st = typeStyle('label', true, { tone: 'paper', size });
  const x = SLOT.x + SLOT.pad;
  const y = SLOT.eyebrowY;
  return (
    <>
      {BROWS.map((b, i) => {
        if (t < b.at - 1 || t > b.out + 9) return null;
        if (b.who === 'ava') return <TurnLabel key={i} t={t} who="ava" x={x} y={y} at={b.at} exitAt={b.out} size={size} />;
        const r = reveal(t, b.at, { config: SPRING.caption, rise: 90, fade: 0.5, exit: { at: b.out, dur: browOut(b) } });
        const dim = t > M.fieldUp ? dimAt(t) : 1;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x, top: y, whiteSpace: 'nowrap' }}>
              <span style={{ ...maskBox(0), display: 'block' }}>
                <span style={{ ...revealStyle({ ...r, opacity: r.opacity * dim }, undefined, glide || Math.abs(r.y) > 0.03 || t - b.at < 14), ...st, lineHeight: 1.2, color: SLATE.tag }}>{ASKED}</span>
              </span>
            </div>
            {r.opacity > 0.5 ? <ZoneRect what="slot eyebrow ASKED AS" rect={{ x, y, w: labelWidth(ASKED, size), h: size * 1.2 }} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

/* ── the phrasings (and the curveball): her lines as captions in the slot ── */
export const Phrasings: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready) return null;
  return (
    <>
      {SLOT_LINES.map((ln) => {
        if (t < ln.at - 4 || t > ln.out + 6) return null;
        const dim = ln.id === 'ig4-06' && t > M.fieldUp ? dimAt(t) : 1;
        return (
          <div key={ln.id} style={{ position: 'absolute', inset: 0, opacity: dim < 0.999 ? dim : undefined }}>
            <Captions
              T={T}
              id={ln.id}
              t={t}
              place={ln.stack ? stackPlace(ln) : slotPlace(ln.rows)}
              retext={ln.retext}
              keys={ln.keys ?? []}
              timing={{ at: ln.at, exitAt: ln.out, exits: ln.stack ? { 0: ln.out } : undefined }}
              what="slot"
            />
          </div>
        );
      })}
      <PriceyUnderline t={t} />
    </>
  );
};

/** "pricey": a slate underline drawing under the word the page never says (on its onset), leaving with its phrasing */
const PriceyUnderline: React.FC<{ t: number }> = ({ t }) => {
  if (t < M.pricey - 0.5 || t > M.phrasingOut[2] + 6) return null;
  const { lay } = slotLayout(SLOT_LINES[2]);
  const k = lay.pos.length - 1;
  const p = lay.pos[k];
  // under the word itself, not its closing quote
  const w = p.w * 0.84;
  const y = lay.top + p.row * lay.rowH + lay.font.size * 1.1;
  const draw = tween(t, [M.pricey, M.pricey + 9], [0, 1], EASE.draw);
  const q = tween(t, [M.phrasingOut[2], M.phrasingOut[2] + 4], [0, 1], EASE.in3);
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      <line x1={p.x + 4} y1={y - q * 30} x2={p.x + 4 + (w - 4) * draw} y2={y - q * 30} stroke={SLATE.tag} strokeOpacity={(0.9 * (1 - smooth(0.3, 1, q))).toFixed(4)} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
};

/* ── b5: her answer, word by word ── */
const ANSWER_ROWS = [5] as const;
export const AnswerRow: React.FC<{ t: number }> = ({ t }) => {
  const glide = useGlide();
  const ready = useKitFaces();
  if (!ready) return null;
  const at = T.LINE.answer;
  if (t < at - 4 || t > M.answerOut + 8) return null;
  const s = captionScreens(T, 'ig4-05', { at })[0];
  const place: CapPlace = { ...slotPlace(ANSWER_ROWS), color: AVA_TEXT };
  const lay = layoutScreen(s.tokens, place);
  const { font } = lay;
  const exitAt = M.answerOut;
  const n = s.tokens.length;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: font.family, fontWeight: font.weight, fontSize: font.size, lineHeight: font.lineHeight, letterSpacing: `${font.tracking}em`, whiteSpace: 'nowrap', color: AVA_TEXT }}>
        {s.tokens.map((tk, j) => {
          const r = reveal(t, tk.onset - CAP_LEAD, { config: SPRING.caption, rise: 80, fade: 0.5, exit: { at: exitAt + Math.min(1.4, (j * 1.4) / Math.max(1, n - 1)), dur: 4 } });
          // "$85." takes her teal on its onset (a glint that settles into the sunday ink)
          let col = AVA_TEXT;
          if (tk.first === 6 && t >= tk.onset - 1) {
            const up = tween(t, [tk.onset - 1, tk.onset + 1], [0, 1], EASE.out3);
            const settle = tween(t, [tk.onset + 1, tk.onset + 14], [0, 1], EASE.inOut);
            col = settle <= 0 ? mixHex(AVA_TEXT, SUNDAY.orb[2], up) : mixHex(SUNDAY.orb[2], SUNDAY.ink, settle);
          }
          const p = lay.pos[j];
          return (
            <span key={j} style={{ ...maskBox(0), position: 'absolute', left: p.x, top: lay.top + p.row * lay.rowH }}>
              <span style={{ ...revealStyle(r, undefined, glide || Math.abs(r.y) > 0.03 || t - tk.onset < 14), color: col }}>{typo(tk.text)}</span>
            </span>
          );
        })}
      </div>
      {t > s.from + 2 && t < exitAt + 2 ? <ZoneRect what="slot answer ig4-05" rect={lay.rect} /> : null}
    </>
  );
};

/** the eyebrow's width at its widest (ASKED AS / ● AVA) — for layouts that sit beside it */
export const eyebrowW = () => Math.max(labelWidth(ASKED, 28), turnLabelWidth('ava', 28));
