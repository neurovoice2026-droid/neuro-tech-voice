/**
 * b09–b11 · THE CALL — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b08's LAST PICTURE (scenes/written/stage.ts writtenEnd): Ava's orb at rest, the app panel on Knowledge
 * (its badge at 4, the four rows Ready), the eyebrow ● KNOWLEDGE BASE, her KB_MESH ground keyed on the orb.
 *
 * THREE FRAMINGS, one continuous set of moves (each element glides from pose to pose — nothing cuts):
 *
 *   A  the live call (b09)   the panel steps back a depth and slides away (16:9 off the right edge, 9:16 off the bottom
 *                            edge — clear of the platform UI zone before the caller speaks); the orb comes forward to
 *                            her call place; the call strip beside it
 *                            (16:9) / under it (9:16): ● CALLER + the mono timer, the caller's line (slate) over the
 *                            line's waveform; Ava's filler as her own turn (● AVA) under it, the transcript scrolling
 *   B  the stop-time (b10)   the camera glides to the knowledge: the frozen question takes the left column (9:16 the
 *                            top), stepping back a touch (16:9 × .86 — the page needs the width), the orb shrinks into
 *                            the dot of BETWEEN QUESTION AND ANSWER, the Opening hours row comes back and unfolds into
 *                            the full page (cropped to its content, its lines at the title role 64 / 56); the day's three
 *                            earlier phrasings roll through ONE masked slot under it, one at a time, each sending a
 *                            hairline to the same two swept lines
 *   C  the answer (b11)      in the question's place: her turn (● AVA) and the word re-set — ONE move: the tokens she
 *                            doesn't say leave the page up through their masks, the kept words fly from the page into
 *                            their slots in her sentence together, her own words rise in on her onsets; the page dims
 *                            beside it (9:16 below it); then the strip folds into the white record row and the page
 *                            recedes out
 *
 * THE NEIGHBOURS: b08 → here is the same picture at frame 0 (writtenEnd). Here → b12: callEnd() (bottom).
 */
import { Easing } from 'remotion';
import { EASE, springUnit } from '../../../lib/motion';
import { CALL_LOCAL as C, SCENES, WRITTEN_LOCAL } from '../../timing';
import { orbPose as writtenOrbPose, writtenEnd, writtenStage } from '../written/stage';

export type XY = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type OrbAt = { x: number; y: number; d: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92 — written/stage.ts GLIDE) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** the panel's exit: a soft start, decisive, a long settle */
const RECEDE = Easing.bezier(0.42, 0, 0.12, 1);

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
    /** the frozen turn's step-back scale in B (about its tag's top-left; 16:9 makes room for the page) */
    bScale: number;
  };
  /** BETWEEN QUESTION AND ANSWER: its text's left edge (16:9) / the lockup's centre (9:16), its centre line */
  label: { x: number; y: number; align: 'left' | 'center'; gap: number };
  /** the day's three earlier phrasings: ONE masked slot (both orientations), one phrasing at a time — x is the slot's
   *  left edge (align left) or centre (align center), y its top */
  questions: { x: number; y: number; size: number; align: 'left' | 'center' };
  /** the page (the Opening hours document), CROPPED TO ITS CONTENT (kind, heading, three lines, `pad` all round): its
   *  anchor (16:9 its right edge, 9:16 its centre), its top, its line size (the title role) and padding */
  page: { anchor: 'right' | 'center'; x: number; y: number; size: number; pad: number };
  /** where the row comes back from (16:9 off the right edge, 9:16 up from the bottom edge — where the panel went) and
   *  where it waits for the freeze — top-left corners */
  rowFrom: XY | null;
  rowHold: XY;
  /** the page in b11: dims to `fade`, recedes by scale / offset */
  pageC: { scale: number; dx: number; dy: number; fade: number };
  /** each kept word's flight (Saturday · Sunday · closed) into her sentence: 'g' straight (both axes on one ease),
   *  'yx' its line's height first, 'xy' across first — chosen so that no two flying words ever share pixels */
  flights: readonly ['g' | 'yx' | 'xy', 'g' | 'yx' | 'xy', 'g' | 'yx' | 'xy'];
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
          // "Are you guys around" (689 px at 76) × .86 ends at x ≈ 753: a clear 56 px before the page's paper (x 809)
          bScale: 0.86,
        },
        label: { x: 214, y: 112, align: 'left', gap: 0 },
        // the slot under the question and the page (whose paper ends at y 708), over the narrator's caption (top ≈ 921)
        questions: { x: 160, y: 760, size: 64, align: 'left' },
        // lines at the title role (64), 48 px padding: "Monday to Friday · 8:00–20:00" sets the width (≈ 951 px)
        page: { anchor: 'right', x: 1760, y: 150, size: 64, pad: 48 },
        rowFrom: { x: 1960, y: 150 },
        rowHold: { x: 1240, y: 150 },
        // the dim page steps back to the right, clear of her sentence's measure (x 160–911)
        pageC: { scale: 0.86, dx: 110, dy: 30, fade: 0.25 },
        // closed (from the right end of the Sunday line, bound for line 3) drops to its line first and passes UNDER
        // Sunday (bound for line 2); Saturday rides its own line's height
        flights: ['g', 'g', 'yx'],
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
      orb: { a: { x: 540, y: 330, d: 206 }, dot: { x: 0, y: 260, d: 38 }, c: { x: 540, y: 330, d: 206 } },
      // 9:16: the panel steps back and slides DOWN OFF the frame (panelPose) — clear of the platform zone (bottom 20 %)
      // before the caller's first word; the Opening hours row comes back up from the bottom edge where it went
      recede: { scale: 0.9, shade: 0.06, dx: 0, dy: 1500 },
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
        // the stop-time's frozen turn sits under the label (whole-film pass: label + turn 24 px lower, inside the 9:16 safe zone)
        b: { x: 540, tag: 320, lines: [360, 360 + lh], wave: 556 },
        // her answer UNDER the page (paper 680–1183; the kept words fly DOWN out of it, crossing only its bottom
        // padding — never its heading), inside the safe zone (bottom ≈ 1487 < 1536)
        c: { x: 540, tag: 1206, lines: [], y: 1246 + (3 * lh) / 2, maxWidth: 900 },
        bScale: 1,
      },
      label: { x: 540, y: 260, align: 'center', gap: 16 },
      // the earlier phrasings, one at a time in the masked slot under the page (the title role's 9:16 size)
      questions: { x: 540, y: 1212, size: 56, align: 'center' },
      // lines at the title role (56), 48 px padding (≈ 844 × 503); its top leaves room under the frozen turn's waveform
      // for the MATCHED ON MEANING tag (y ≈ 604–658)
      page: { anchor: 'center', x: 540, y: 680, size: 56, pad: 48 },
      rowFrom: { x: 64, y: 1960 },
      rowHold: { x: 64, y: 1010 },
      // the page stays over her sentence, dimming, a touch back and up (air over ● AVA)
      pageC: { scale: 0.97, dx: 0, dy: -24, fade: 0.25 },
      // the sentence lies BELOW the page: Saturday and Sunday slide across to their slots first, then drop (Saturday
      // a line over Sunday all the way); closed drops to its line first and slides along under Sunday
      flights: ['xy', 'xy', 'yx'],
      caption: { x: 540, y: 1408, maxWidth: 940 },
      // the record lands where the page was (the page recedes out under it): the document gives way to the record
      // that cites it, centred in the frame under the orb
      record: { x: 104, y: 786, w: 872, size: 38 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const callStage = (vertical: boolean): CallStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the moves ──────────────────────────────────────────────────── */

/** the panel: steps back a depth (scale, shade) and slides away off the frame (16:9 off the right edge, ≈ 1 s from the
 *  ring; 9:16 off the bottom edge, 6 frames sooner — out of the platform UI zone before the caller's first word) */
export function panelPose(t: number, S: CallStage) {
  // a soft start (it is pushed, not kicked), then decisive, with a long settle: clear of the strip before ● CALLER rises
  const u = ease(t, C.recede[0], C.recede[1] - (S.vertical ? 6 : 0), RECEDE);
  const R = S.recede;
  return { scale: lerp(1, R.scale, u), shade: R.shade * u, dx: R.dx * u, dy: R.dy * u, u, on: u < 1, moving: u > 0 && u < 1 };
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

/** the caller's turn (turn 1): A1 → A2 (the scroll as Ava's turn arrives) → B (the camera glide, stepping back to
 *  `bScale` about its tag's top-left as it goes) */
export function callerTurnPose(t: number, S: CallStage): TurnAt & { moving: boolean; scale: number } {
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
  return { ...r, scale: lerp(1, S.strip.bScale, p), moving: (s > 0 && s < 1) || (p > 0 && p < 1) };
}
/** a point of the caller's turn (laid out at full size from its pose) → where it is drawn (its step-back scale about
 *  the tag's top-left) */
export const turnPoint = (turn: { x: number; tag: number; scale: number }, p: XY): XY => ({ x: turn.x + (p.x - turn.x) * turn.scale, y: turn.tag + (p.y - turn.tag) * turn.scale });

/** the page's dim in b11 — once the kept words have flown out of it */
export const pageDimAt = (t: number) => ease(t, C.dim[0], C.dim[1], EASE.inOut);
/** the page's exit as the record lands: it recedes (× .9) and fades out — the transcript owns the frame */
export const pageOutAt = (t: number) => ease(t, C.pageOut[0], C.pageOut[1], EASE.inOut);

/* ── the ground's clock and key (call/Ground.tsx draws with these) ── */

/** frames the mesh's clock takes to stop / to get going again */
const RAMP = 10;
/** ∫₀ᵘ (1 − smoothstep) — the distance covered while slowing down over a unit ramp */
const slowArea = (u: number) => u - (u * u * u - (u * u * u * u) / 2);
/** the mesh's act-local clock: real time until the freeze, held through the stop-time, real time again after (a speed
 *  easing 1 → 0 → 1 on smoothstep ramps, integrated in closed form: no jump in position, ever) */
export function groundClock(t: number): number {
  const a = C.freeze;
  const b = C.resume;
  if (t <= a) return t;
  const stopped = a + RAMP * slowArea(1);
  if (t < a + RAMP) return a + RAMP * slowArea((t - a) / RAMP);
  if (t <= b) return stopped;
  if (t < b + RAMP) {
    const u = (t - b) / RAMP;
    return stopped + RAMP * (u * u * u - (u * u * u * u) / 2);
  }
  return stopped + RAMP * 0.5 + (t - b - RAMP);
}

/** her key light on the ground for an orb of diameter d (written/Ground.tsx KEY .3 at b08's size; smaller in the dot) */
export function callKey(S: CallStage, d: number) {
  const k = Math.min(1, Math.max(0.35, d / S.from.orb.d));
  return { strength: 0.3 * k, radius: (S.vertical ? 620 : 680) * (0.7 + 0.3 * k) };
}

/* ── the act's last picture, for b12 ─────────────────────────────── */

/**
 * callEnd(vertical): what the cut into b12 hands over (frame px). The record row (TRANSCRIPT, the greeting,
 * "Answered from your documents" + the Opening hours chip, the sunday check) holds where the strip was (16:9) / where
 * the page was (9:16); the orb at rest in her answer place; the page has receded out (opacity 0 from
 * CALL_LOCAL.pageOut[1]: call/Page.tsx draws nothing at C.end); the app panel is off frame (16:9 right, 9:16 below
 * the bottom edge); the ground is KB_MESH keyed on the orb (call/Ground.tsx), its clock running —
 * but TRAILING the timeline by the stop-time it was held for (ground.meshLag frames): the next act continues the mesh
 * from ground.meshClock, or its pools jump at the cut.
 */
export function callEnd(vertical: boolean) {
  const S = callStage(vertical);
  // the mesh's clock trails the timeline by the stop-time it was held for: continue it from here (absolute frames:
  // meshClock + the next act's own t), never from the next act's SCENES start
  const meshClock = SCENES.call.from + groundClock(C.end);
  return {
    orb: S.orb.c,
    record: S.record,
    page: S.page,
    pageC: S.pageC,
    panel: { ...S.from.panel, recede: S.recede },
    ground: { meshClock, meshLag: SCENES.call.to - meshClock, key: { x: S.orb.c.x, y: S.orb.c.y, ...callKey(S, S.orb.c.d) } },
    at: C.end,
  };
}
export const CALL_END = callEnd;
