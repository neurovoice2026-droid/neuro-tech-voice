/**
 * b13–b14 · CHANGE IT / THE NEXT CALL — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b12's LAST PICTURE (scenes/line/stage.ts lineEnd): the agent page at rest on its Conversation tab (the
 * owner's line saved, the sunday focus ring settled), Ava's orb small in her corner, her KB_MESH ground (the call's
 * mesh clock running on), the pointer hidden where it stood (on Save changes).
 *
 * THREE FRAMINGS, one continuous set of moves (each element glides from pose to pose — nothing cuts until the L-cut):
 *
 *   A  the owner's file (b13, "Hours change?")   the app sinks back; opening-hours.txt comes forward on plain paper (no
 *      app chrome: the edit happens outside the app) — 16:9 right of her orb, 9:16 under it. The I-beam drags over
 *      "14:00" (the sunday wash) and "16:00" is typed over it, a key per 16th.
 *   B  back in the app (b13, "Change the document. The next call gets the new answer.")   the file steps up into the
 *      corner over the agent page, which rises on its KNOWLEDGE tab (the badge at 4; "Your documents", newest first:
 *      FAQ page · Cancellation policy · Opening hours · Price list). The cursor opens the Opening hours row's … menu
 *      (Read again · Replace with new file · Remove) and clicks "Replace with new file": the edited file drops into the
 *      list's top slot as the NEW version — Reading… while the old row stays Ready (the badge counts both: 5); on "the
 *      new answer" it rolls to Ready and the old row leaves up through its mask (the badge back to 4).
 *   C  the next call (b14)   a beat before the ring the app steps back and slides away; the new row lifts out of it and
 *      unfolds into its page (TXT · Opening hours, "Saturday · 9:00–16:00"); the ring leaves her orb as she glides to her
 *      call place; ● CALLER — Dana's identical recording — with SAME QUESTION beside it; ● AVA "You can! / We're open
 *      Saturday / from nine till four." — 16:9 her "We're open Saturday" row level with the page's Saturday line; on
 *      "four." the sweep. Then the L-CUT: the frame crosses to b15's desk (scenes/Matters.tsx MattersDesk at its first
 *      picture) in one push against the reading direction (a camera crossing back).
 *
 * THE NEIGHBOURS: b12 → here is the same picture at frame 0 (change/Handoff.tsx draws line/Panel.tsx's LinePanel at
 * LINE_LOCAL.end). Here → b15: the push lands on MattersDesk's own first picture (its ground, desk and teal dot), so the
 * cut at the act's end is invisible by construction (the push lands at rest on it); changeEnd() documents it.
 */
import { Easing } from 'remotion';
import { EASE, springUnit } from '../../../lib/motion';
import { CHANGE_LOCAL as K, LINE_LOCAL } from '../../timing';
import { lineEnd } from '../line/stage';

export type XY = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type OrbAt = { x: number; y: number; d: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92 — the acts' GLIDE) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** a landing with no bounce (ζ ≈ 1): a page rising in, a paper box settling */
export const RISE = { stiffness: 300, damping: 34.6, mass: 1 } as const;
/** critically damped: a slot opening / closing in a list (rows never overlap) */
export const SLOT = { stiffness: 300, damping: 34.6, mass: 1 } as const;
/** the app's exit: a soft start (it is pushed, not kicked), decisive, a long settle (call/stage.ts RECEDE) */
const RECEDE = Easing.bezier(0.42, 0, 0.12, 1);

/** a call turn: its tag row's top, its caption lines' tops, its waveform's centre (frame px) */
export type TurnAt = { tag: number; lines: readonly number[]; wave?: number };

export type ChangeStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** Ava's orb: b12's corner (A), the corner she gives up for the parked file in 9:16 (B), her call place (C) */
  orb: { a: OrbAt; b: OrbAt; c: OrbAt };
  /** the owner's file: its box (h measured), its line size, how far below it starts rising; parked: its right edge,
   *  top and scale */
  file: { x: number; y: number; w: number; size: number; rise: number; park: { right: number; y: number; k: number } };
  /** the agent page on Knowledge (b12's panel geometry, set lower): box (its height fits five rows), corner radius,
   *  how far below it starts rising */
  panel: { x: number; y: number; w: number; radius: number; rise: number };
  /** the tab bar: label size, icons, the strip's side padding (× r) — b12's */
  tabs: { size: number; icons: boolean; padR: number };
  /** the content's inner padding, the heading's size ("Your documents"), the gap from the tab bar to it */
  pad: number;
  heading: number;
  headTop: number;
  /** the rows (written/Row.tsx, single-line): name size, gap; and the … menu's item size */
  row: { size: number; gap: number };
  menu: { size: number };
  /** the narrator's caption (vo-7, no tag): centre x, row A's centre, max width */
  caption: { x: number; y: number; maxWidth: number };
  /** b14's call transcript: alignment and anchor x, caption size, the two turns' fixed lines and rows */
  call: {
    align: 'left' | 'center';
    x: number;
    size: number;
    callerLines: readonly string[];
    avaLines: readonly string[];
    caller: TurnAt;
    ava: TurnAt;
    wave: { half: number; pitch: number; bar: number; maxH: number };
    /** SAME QUESTION: beside ● CALLER (16:9) or centred over it (9:16) at this row's top */
    chip: { mode: 'beside' | 'above'; y: number };
  };
  /** b14's page (the new row unfolded): box, line size */
  page: { x: number; y: number; w: number; size: number };
  /** the L-cut's push: its axis, and the soft leading edge of the incoming desk (px) */
  cross: { axis: 'x' | 'y'; feather: number };
};

const STAGES: Record<'land' | 'vert', ChangeStage> = (() => {
  const make = (vertical: boolean): ChangeStage => {
    const E = lineEnd(vertical);
    if (!vertical) {
      const size = 76;
      const lh = Math.round(size * 1.18);
      return {
        W: 1920,
        H: 1080,
        vertical,
        orb: { a: E.orb, b: E.orb, c: { x: 210, y: 158, d: 130 } },
        file: { x: 676, y: 180, w: 1040, size: 64, rise: 90, park: { right: E.panel.x + E.panel.w, y: 26, k: 0.4 } },
        panel: { x: E.panel.x, y: 284, w: E.panel.w, radius: E.panel.radius, rise: 240 },
        tabs: E.tabs,
        pad: 48,
        heading: 36,
        headTop: 42,
        row: { size: 28, gap: 10 },
        menu: { size: 27 },
        caption: { x: 960, y: 962, maxWidth: 1560 },
        call: {
          align: 'left',
          x: 160,
          size,
          callerLines: ['Quick one.', 'Can I pop in on Saturday?'],
          avaLines: ['You can!', 'We’re open Saturday', 'from nine till four.'],
          caller: { tag: 262, lines: [304, 304 + lh], wave: 512 },
          ava: { tag: 560, lines: [602, 602 + lh, 602 + 2 * lh] },
          wave: { half: 230, pitch: 10, bar: 4, maxH: 22 },
          chip: { mode: 'beside', y: 262 },
        },
        // the Saturday line level with her "We're open Saturday" row (centre 602 + 1.5 lh = 737)
        page: { x: 1090, y: 450, w: 720, size: 46 },
        cross: { axis: 'x', feather: 180 },
      };
    }
    const size = 68;
    const lh = Math.round(size * 1.18);
    return {
      W: 1080,
      H: 1920,
      vertical,
      orb: { a: E.orb, b: { x: 282, y: 352, d: 140 }, c: { x: 540, y: 300, d: 140 } },
      file: { x: 64, y: 480, w: 952, size: 56, rise: 110, park: { right: E.panel.x + E.panel.w, y: 220, k: 0.5 } },
      panel: { x: E.panel.x, y: 524, w: E.panel.w, radius: E.panel.radius, rise: 300 },
      tabs: E.tabs,
      pad: 38,
      heading: 34,
      headTop: 40,
      row: { size: 32, gap: 10 },
      menu: { size: 28 },
      caption: { x: 540, y: 1336, maxWidth: 940 },
      call: {
        align: 'center',
        x: 540,
        size,
        callerLines: ['Quick one.', 'Can I pop in on Saturday?'],
        avaLines: ['You can! We’re open Saturday', 'from nine till four.'],
        caller: { tag: 470, lines: [510, 510 + lh], wave: 710 },
        ava: { tag: 760, lines: [800, 800 + lh] },
        wave: { half: 210, pitch: 10, bar: 4, maxH: 20 },
        chip: { mode: 'above', y: 402 },
      },
      page: { x: 120, y: 1020, w: 840, size: 46 },
      cross: { axis: 'y', feather: 180 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const changeStage = (vertical: boolean): ChangeStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the panel's list (pure numbers: written/Row.tsx's single-line row) ── */

/** a single-line row's height for its name size (written/stage.ts rowHeight('inline')) */
export const rowH = (size: number) => Math.round(size * 2.35);
/** the tab bar's height (kit/TabBar: 44r, r = size / 14) */
export const barH = (S: ChangeStage) => (44 * S.tabs.size) / 14;
/** the list's top (frame px, the panel at rest) and the row pitch */
export function listGeo(S: ChangeStage) {
  const top = S.panel.y + barH(S) + S.headTop;
  const listY = top + S.heading * 1.5;
  const h = rowH(S.row.size);
  const pitch = h + S.row.gap;
  const x = S.panel.x + S.pad;
  const w = S.panel.w - 2 * S.pad;
  // the panel holds five rows (the two versions side by side, for a moment) and its padding
  const panelH = listY + 5 * h + 4 * S.row.gap + (S.vertical ? 30 : 28) - S.panel.y;
  return { headY: top, listY, h, pitch, x, w, panelH };
}

/** b08's rows newest first (written/stage.ts ROWS order 3, 2, 1, 0): FAQ page · Cancellation policy · Opening hours ·
 *  Price list; the Opening hours row (index 2 in this list) is the one replaced */
export const OLD = 2;

/** the new version's slot opening at the top of the list (0 → 1): the rows below make room as the file drops in */
export const slotOpen = (t: number) => (t < K.fly[0] + 2 ? 0 : springUnit(t - (K.fly[0] + 2), SLOT));
/** the old row's slot closing after it leaves (0 → 1): Price list slides up into it */
export const slotClose = (t: number) => (t < K.oldOut + 4 ? 0 : springUnit(t - (K.oldOut + 4), SLOT));

/** row k (0..3 of the original newest-first list) at t: its y (panel-local offset from the list top, in pitches) */
export function rowSlot(k: number, t: number) {
  const open = slotOpen(t);
  const close = k > OLD ? slotClose(t) : 0;
  return k + open - close;
}

/* ── the moves ──────────────────────────────────────────────────── */

/** b12's agent page sinking back (0 → 1): scale .94 about its centre, down a little, gone by handoff[1] */
export function handoffPose(t: number) {
  const q = ease(t, K.handoff[0], K.handoff[1], EASE.in2);
  return { q, scale: lerp(1, 0.94, q), dy: 36 * q, opacity: 1 - ease(t, K.handoff[0] + 1, K.handoff[1] - 1, EASE.inOut), on: q < 1, moving: q > 0 && q < 1 };
}

/** the owner's file: rising in (A), then stepping up into its parked corner (B) — a transform about its top-left */
export function filePose(t: number, S: ChangeStage, h: number) {
  const r = t < K.page[0] ? 0 : springUnit(t - K.page[0], RISE);
  const p = t < K.park[0] ? 0 : springUnit(t - K.park[0], GLIDE);
  const F = S.file;
  const k = lerp(1, F.park.k, p);
  const px = F.park.right - F.w * F.park.k;
  const x = lerp(F.x, px, p);
  const y = lerp(F.y + F.rise * (1 - r), F.park.y, p);
  // the paper is opaque almost at once (its words rise in after it: FilePage.tsx) — never a page fading over the app
  // (whole-film pass: an ease-out over 1.5 frames; the inOut over 2.5 showed b12's text through the paper for 2 frames)
  const opacity = ease(t, K.page[0], K.page[0] + 1.5, EASE.out3);
  return { x, y, k, w: F.w * k, h: h * k, lift: lerp(3 + 1.5 * (1 - r), 2.2, p), opacity, on: t >= K.page[0] - 0.01, moving: (r > 0 && Math.abs(1 - r) > 1e-4) || (p > 0 && Math.abs(1 - p) > 1e-4), p };
}

/** the agent page: rising on Knowledge (B), then stepping back a depth and sliding away down (C) */
export function appPose(t: number, S: ChangeStage) {
  const r = t < K.app[0] ? 0 : springUnit(t - K.app[0], RISE);
  const u = ease(t, K.recede[0], K.recede[1], RECEDE);
  const dy = S.panel.rise * (1 - r) + (S.vertical ? 1100 : 760) * u;
  const opacity = ease(t, K.app[0], K.app[0] + 3, EASE.inOut) * (1 - ease(t, K.recede[0] + 4, K.recede[0] + 18, EASE.inOut));
  return { dy, scale: lerp(1, 0.9, u), shade: 0.06 * u, lift: 2.4 + 1.6 * (1 - r), opacity, u, on: t >= K.app[0] - 0.01 && u < 0.999, moving: (r > 0 && Math.abs(1 - r) > 1e-4) || (u > 0 && u < 1) };
}

/** Ava's orb: b12's corner (A) → 9:16: the corner beside the parked file (B) → her call place (C) */
export function orbPose(t: number, S: ChangeStage) {
  const b = t < K.park[0] ? 0 : springUnit(t - K.park[0], GLIDE);
  const c = t < K.orbCall[0] ? 0 : springUnit(t - K.orbCall[0], GLIDE);
  const O = S.orb;
  const at = (key: 'x' | 'y' | 'd') => lerp(lerp(O.a[key], O.b[key], b), O.c[key], c);
  const settled = (v: number) => v < 1e-4 || v > 1 - 1e-4;
  return { x: at('x'), y: at('y'), d: at('d'), moving: !(settled(b) && settled(c)) };
}

/**
 * The L-cut's push (0 → 1 over CHANGE_LOCAL.cross, EASE.inOut: a slow start — the sweep on "four." reads — then decisive,
 * landing at rest on the act's last frame): this act's whole picture slides out against the reading direction (16:9
 * left, 9:16 up) as b15's desk slides in behind its leading edge — a camera crossing back to the desk, one pan.
 */
export function crossPush(t: number, S: ChangeStage) {
  const far = S.cross.axis === 'x' ? S.W : S.H;
  const p = ease(t, K.cross[0], K.cross[1], EASE.inOut);
  return { p, out: -far * p, in: far * (1 - p), on: t >= K.cross[0] - 1e-6, moving: p > 0 && p < 1 };
}

/** b12's mesh clock at this act's frame t (absolute frames): line/Ground.tsx's clock run on past its act */
export const lineClockT = (t: number) => LINE_LOCAL.end + t;

/* ── the act's last picture, for b15 ─────────────────────────────── */

/**
 * changeEnd(vertical): what the cut into b15 hands over — nothing of this act: by the last frame the push has landed and
 * the picture IS scenes/Matters.tsx's MattersDesk at its first picture (t = 0, the camera at rest:
 * its MUTED_MESH ground on the timeline's clock keyed teal at the colon, the desk, the clock with Ava's teal dot). The
 * orb's last pose is given for reference (it leaves with the call; the desk's teal dot carries her light on).
 */
export function changeEnd(vertical: boolean) {
  const S = changeStage(vertical);
  return { at: K.end, picture: 'MattersDesk(t = 0)' as const, orb: S.orb.c };
}
export const CHANGE_END = changeEnd;
