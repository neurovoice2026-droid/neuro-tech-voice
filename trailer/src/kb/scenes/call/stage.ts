/**
 * b09–b11 · THE CALL — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b08's LAST PICTURE (scenes/written/stage.ts writtenEnd): Ava's orb at rest, the app panel on Knowledge
 * (its badge at 4, the four rows Ready), the eyebrow ● KNOWLEDGE BASE, her KB_MESH ground keyed on the orb.
 *
 * THREE FRAMINGS, one continuous set of moves (each element glides from pose to pose — nothing cuts):
 *
 *   A  the live call (b09)   the panel steps back a depth and slides away (16:9 right, 9:16 down: it stays, receded,
 *                            under the call); the orb comes forward to her call place; the call strip beside it
 *                            (16:9) / under it (9:16): ● CALLER + the mono timer, the caller's line (slate) over the
 *                            line's waveform; Ava's filler as her own turn (● AVA) under it, the transcript scrolling
 *   B  the stop-time (b10)   the camera glides to the knowledge: the frozen question takes the left column (9:16 the
 *                            top), the orb shrinks into the dot of BETWEEN QUESTION AND ANSWER, the Opening hours row
 *                            comes back and unfolds into the full page; the day's three earlier phrasings stack over the
 *                            question (9:16 one at a time in one slot) and every phrasing sends a hairline to the same
 *                            two swept lines
 *   C  the answer (b11)      in the question's place: her turn (● AVA) and the word re-set — the swept lines lifted out
 *                            of the page re-set into what she says; the page stays, dim, beside it (9:16 behind it);
 *                            then the strip folds into the white record row
 *
 * THE NEIGHBOURS: b08 → here is the same picture at frame 0 (writtenEnd). Here → b12: callEnd() (bottom).
 */
import { EASE, springUnit } from '../../../lib/motion';
import { CALL_LOCAL as C, WRITTEN_LOCAL } from '../../timing';
import { orbPose as writtenOrbPose, writtenEnd, writtenStage } from '../written/stage';

export type XY = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type OrbAt = { x: number; y: number; d: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92 — written/stage.ts GLIDE) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** the camera's glide (no overshoot) */
export const PAN = { stiffness: 120, damping: 22, mass: 1 } as const;

/** a turn of the call strip: its tag row's top, its caption lines' tops, its waveform's centre (frame px) */
export type TurnAt = { x: number; tag: number; lines: readonly number[]; wave?: number };

export type CallStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** the hand-over from b08 (writtenEnd) */
  from: ReturnType<typeof writtenEnd> & { orb: OrbAt };
  orb: { a: OrbAt; dot: OrbAt; c: OrbAt };
  /** the panel's recede: its scale, shade and offset at the end of the move */
  recede: { scale: number; shade: number; dx: number; dy: number };
  /** the call strip: text alignment (16:9 left edge at x, 9:16 centred on x), sizes, the turns' poses */
  strip: {
    align: 'left' | 'center';
    caption: number;
    lh: number;
    maxWidth: number;
    callerLines: readonly string[];
    fillerLines: readonly string[];
    /** the waveform's half width / bar pitch / max bar height */
    wave: { half: number; pitch: number; bar: number; maxH: number };
    a1: TurnAt;
    a2: TurnAt;
    filler: TurnAt;
    b: TurnAt;
    /** her answer turn (b11): the tag; the re-set sentence's centre y and max width */
    c: TurnAt & { y: number; maxWidth: number };
  };
  /** BETWEEN QUESTION AND ANSWER: its text's left edge (16:9) / the lockup's centre (9:16), its centre line */
  label: { x: number; y: number; align: 'left' | 'center'; gap: number };
  /** the day's three earlier phrasings: 16:9 stacked (one top each), 9:16 one slot */
  questions: { x: number; tops: readonly number[]; size: number; align: 'left' | 'center' };
  /** the page (the Opening hours document): its box, its line size, the paper's minimum height */
  page: { x: number; y: number; w: number; size: number; minH: number };
  /** where the row comes back from (16:9: off the right edge, where the panel went; null: its place in the receded
   *  panel) and where it waits for the freeze — top-left corners */
  rowFrom: XY | null;
  rowHold: XY;
  /** the page in b11: dims to `fade`, recedes by scale / offset */
  pageC: { scale: number; dx: number; dy: number; fade: number };
  /** the two swept lines lifted out as their own layer: the lift's offset */
  lift: { dx: number; dy: number };
  /** the narrator's caption (vo-5, no tag) */
  caption: { x: number; y: number; maxWidth: number };
  /** the record row (CallDetailSheet's record) */
  record: { x: number; y: number; w: number; size: number };
};

const STAGES: Record<'land' | 'vert', CallStage> = (() => {
  const make = (vertical: boolean): CallStage => {
    // b08's last picture — the orb exactly where written/stage.ts's orbPose leaves it on the act's last frame
    const end = writtenEnd(vertical);
    const o = writtenOrbPose(WRITTEN_LOCAL.end, writtenStage(vertical));
    const from = { ...end, orb: { x: o.x, y: o.y, d: o.d } };
    if (!vertical) {
      const caption = 76;
      const lh = Math.round(caption * 1.18);
      return {
        W: 1920,
        H: 1080,
        vertical,
        from,
        orb: { a: { x: 432, y: 528, d: 250 }, dot: { x: 181, y: 112, d: 40 }, c: { x: 262, y: 262, d: 204 } },
        recede: { scale: 0.9, shade: 0.06, dx: 1330, dy: 26 },
        strip: {
          align: 'left',
          caption,
          lh,
          maxWidth: 1000,
          callerLines: ['Are you guys around', 'this weekend?'],
          fillerLines: ['One moment, let me check.'],
          wave: { half: 230, pitch: 10, bar: 4, maxH: 22 },
          a1: { x: 700, tag: 398, lines: [440, 440 + lh], wave: 652 },
          a2: { x: 700, tag: 300, lines: [342, 342 + lh], wave: 554 },
          filler: { x: 700, tag: 632, lines: [674] },
          b: { x: 160, tag: 206, lines: [248, 248 + lh], wave: 474 },
          c: { x: 160, tag: 440, lines: [], y: 482 + (3 * lh) / 2, maxWidth: 760 },
        },
        label: { x: 214, y: 112, align: 'left', gap: 0 },
        questions: { x: 160, tops: [582, 652, 722], size: 46, align: 'left' },
        page: { x: 1000, y: 150, w: 760, size: 48, minH: 640 },
        rowFrom: { x: 1960, y: 150 },
        rowHold: { x: 1240, y: 150 },
        pageC: { scale: 0.95, dx: 24, dy: 0, fade: 0.25 },
        lift: { dx: -100, dy: 8 },
        caption: { x: 960, y: 966, maxWidth: 1600 },
        record: { x: 160, y: 440, w: 800, size: 40 },
      };
    }
    const caption = 68;
    const lh = Math.round(caption * 1.18);
    return {
      W: 1080,
      H: 1920,
      vertical,
      from,
      orb: { a: { x: 540, y: 330, d: 206 }, dot: { x: 0, y: 236, d: 38 }, c: { x: 540, y: 330, d: 206 } },
      recede: { scale: 0.9, shade: 0.06, dx: 0, dy: 760 },
      strip: {
        align: 'center',
        caption,
        lh,
        maxWidth: 940,
        callerLines: ['Are you guys around', 'this weekend?'],
        fillerLines: ['One moment, let me check.'],
        wave: { half: 210, pitch: 10, bar: 4, maxH: 20 },
        a1: { x: 540, tag: 500, lines: [540, 540 + lh], wave: 742 },
        a2: { x: 540, tag: 500, lines: [540, 540 + lh], wave: 742 },
        filler: { x: 540, tag: 812, lines: [852] },
        b: { x: 540, tag: 296, lines: [336, 336 + lh], wave: 532 },
        c: { x: 540, tag: 500, lines: [], y: 540 + (3 * lh) / 2, maxWidth: 900 },
      },
      label: { x: 540, y: 236, align: 'center', gap: 16 },
      questions: { x: 540, tops: [1206], size: 44, align: 'center' },
      page: { x: 64, y: 668, w: 816, size: 42, minH: 500 },
      rowFrom: null,
      rowHold: { x: 64, y: 1010 },
      pageC: { scale: 0.86, dx: 0, dy: 300, fade: 0.25 },
      lift: { dx: 0, dy: -64 },
      caption: { x: 540, y: 1382, maxWidth: 940 },
      record: { x: 104, y: 492, w: 872, size: 38 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const callStage = (vertical: boolean): CallStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the moves ──────────────────────────────────────────────────── */

/** the panel: steps back a depth (scale, shade) and slides away (house ease, ≈ 1.1 s from the ring) */
export function panelPose(t: number, S: CallStage) {
  const u = ease(t, C.recede[0], C.recede[1], EASE.inOut);
  const R = S.recede;
  // 9:16: once the Opening hours row has lifted out of it, the receded panel sinks away under the frame
  const sink = S.vertical ? ease(t, C.rowIn[0] + 6, C.rowIn[0] + 28, EASE.in2) : 0;
  const dy = R.dy * u + 760 * sink;
  const on = S.vertical ? sink < 1 : u < 1;
  return { scale: lerp(1, R.scale, u), shade: R.shade * u + 0.04 * sink, dx: R.dx * u, dy, u, on, moving: (u > 0 && u < 1) || (sink > 0 && sink < 1) };
}

/** the camera glide to the knowledge (b10): 0 = the call's framing … 1 = the stop-time's */
export const panAt = (t: number) => ease(t, C.pan[0], C.pan[1], EASE.inOut);
/** into the dot (b10) and out of it (b11): springs that settle without a bounce */
export const dockAt = (t: number) => (t < C.dock[0] ? 0 : springUnit(t - C.dock[0], GLIDE));
export const undockAt = (t: number) => (t < C.undock[0] ? 0 : springUnit(t - C.undock[0], GLIDE));

/** Ava's orb: b08's place → her call place (A) → the label's dot (B) → her answer place (C) */
export function orbPose(t: number, S: CallStage, dot: OrbAt) {
  const f = S.from.orb;
  const g = t < C.glide[0] ? 0 : springUnit(t - C.glide[0], GLIDE);
  let x = lerp(f.x, S.orb.a.x, g);
  let y = lerp(f.y, S.orb.a.y, g);
  let d = lerp(f.d, S.orb.a.d, g);
  const k = dockAt(t);
  x = lerp(x, dot.x, k);
  y = lerp(y, dot.y, k);
  d = lerp(d, dot.d, k);
  const u = undockAt(t);
  x = lerp(x, S.orb.c.x, u);
  y = lerp(y, S.orb.c.y, u);
  d = lerp(d, S.orb.c.d, u);
  const settled = (v: number) => v < 1e-4 || v > 1 - 1e-4;
  return { x, y, d, moving: !(settled(g) && settled(k) && settled(u)) };
}

/** the caller's turn (turn 1): A1 → A2 (the scroll as Ava's turn arrives) → B (the camera glide) */
export function callerTurnPose(t: number, S: CallStage): TurnAt & { moving: boolean } {
  const s = ease(t, C.scroll[0], C.scroll[1], EASE.inOut);
  const p = panAt(t);
  const A1 = S.strip.a1;
  const A2 = S.strip.a2;
  const B = S.strip.b;
  const mixT = (a: TurnAt, b: TurnAt, u: number): TurnAt => ({
    x: lerp(a.x, b.x, u),
    tag: lerp(a.tag, b.tag, u),
    lines: a.lines.map((y, i) => lerp(y, b.lines[i], u)),
    wave: lerp(a.wave ?? 0, b.wave ?? 0, u),
  });
  const r = mixT(mixT(A1, A2, s), B, p);
  return { ...r, moving: (s > 0 && s < 1) || (p > 0 && p < 1) };
}

/** the page's dim and recede in b11 */
export const pageDimAt = (t: number) => ease(t, C.resume, C.resume + 20, EASE.inOut);

/* ── the act's last picture, for b12 ─────────────────────────────── */

/**
 * callEnd(vertical): what the cut into b12 hands over (frame px). The record row (TRANSCRIPT, the greeting,
 * "Answered from your documents" + the Opening hours chip, the sunday check) holds where the strip was; the orb at
 * rest in her answer place; the page (dim, 25 %) beside it (9:16 behind/below); the app panel is off frame (16:9
 * right, 9:16 receded at the bottom); the ground is KB_MESH keyed on the orb (call/Ground.tsx), its clock running.
 */
export function callEnd(vertical: boolean) {
  const S = callStage(vertical);
  return { orb: S.orb.c, record: S.record, page: S.page, pageC: S.pageC, panel: { ...S.from.panel, recede: S.recede }, at: C.end };
}
export const CALL_END = callEnd;
