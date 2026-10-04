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
 *   B  back in the app (b13, "Change the document. The next call gets the new answer.")   16:9: the file steps up into
 *      the corner over the agent page (9:16: the app at ad size comes in over the file from the right as a card stack, the file steps
 *      back under it — no parked thumbnail — and the menu flips above its trigger), which rises on its KNOWLEDGE tab (the badge at 4; "Your documents", newest first:
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
import { rowHeight, writtenStage } from '../written/stage';

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
/** 9:16: the app's sheet coming in over the file, from the right (frames: from three before the file starts to step
 *  away, landing a beat before the pointer reaches the …) */
export const APP_UP = [K.park[0] - 3, K.park[0] + 9] as const;
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
   *  top and scale (16:9). 9:16 has no parked thumbnail (null): the file steps back and leaves left as the app takes the
   *  frame, and the new version lands in the list by itself (the global 9:16 pass: a 17 px thumbnail read as clutter) */
  file: { x: number; y: number; w: number; size: number; rise: number; park: { right: number; y: number; k: number } | null };
  /** the agent page on Knowledge: box (16:9: b12's panel geometry set lower, its height fitting five rows; 9:16: the app at
   *  ad size, b08's card — `h` fixed, the list cut by its bottom edge like a phone's), corner radius, how far below it
   *  starts rising */
  panel: { x: number; y: number; w: number; radius: number; rise: number; h?: number };
  /** the tab bar: label size, icons, the strip's side padding (× r) — b12's */
  tabs: { size: number; icons: boolean; padR: number };
  /** the content's inner padding, the heading's size ("Your documents"), the gap from the tab bar to it */
  pad: number;
  heading: number;
  headTop: number;
  /** the rows (written/Row.tsx): name size, gap, layout (16:9 single-line; 9:16 b08's ad-size two-line row and its pill
   *  size); the … menu's item size and the side it opens on (9:16: above its trigger — no room under it in the card, as
   *  the app's dropdown flips on a phone) */
  row: { size: number; gap: number; layout: 'stack' | 'inline'; pill?: number };
  menu: { size: number; side: 'bottom' | 'top' };
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
        // parked: ≥ 80 px under the frame's top, ≈ 23 px clear of the panel's top edge (284)
        file: { x: 676, y: 180, w: 1040, size: 64, rise: 48, park: { right: E.panel.x + E.panel.w, y: 80, k: 0.3 } },
        panel: { x: E.panel.x, y: 284, w: E.panel.w, radius: E.panel.radius, rise: 90 },
        tabs: E.tabs,
        pad: 48,
        heading: 36,
        headTop: 42,
        row: { size: 28, gap: 10, layout: 'inline' },
        menu: { size: 27, side: 'bottom' },
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
        cross: { axis: 'x', feather: 110 },
      };
    }
    const size = 68;
    const lh = Math.round(size * 1.18);
    // THE APP AT AD SIZE (the global 9:16 pass; b08's card, written/stage.ts): the panel full width under her orb, its
    // type at the app's proportions ≈ 1.56× (row names 50, pills 42), the app's two-line row; the list cut by the card's
    // bottom edge like a phone's (the row and its menu are the shot)
    const W8 = writtenStage(true);
    return {
      W: 1080,
      H: 1920,
      vertical,
      orb: { a: E.orb, b: E.orb, c: { x: 540, y: 300, d: 140 } },
      file: { x: 64, y: 480, w: 952, size: 56, rise: 56, park: null },
      panel: { x: W8.panel.x, y: W8.panel.y, w: W8.panel.w, radius: W8.panel.radius, rise: 110, h: W8.panel.h },
      tabs: W8.tabs,
      pad: W8.pad,
      heading: W8.type.title,
      headTop: 28,
      row: { size: W8.row.size, gap: W8.row.gap, layout: W8.row.layout, pill: W8.row.pill },
      menu: { size: 46, side: 'top' },
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
      // the page at the 9:16 title floor (call/stage.ts's page: 56) — legible on a phone
      page: { x: 56, y: 1000, w: 968, size: 56 },
      cross: { axis: 'y', feather: 110 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const changeStage = (vertical: boolean): ChangeStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the panel's list (pure numbers: written/Row.tsx's single-line row) ── */

/** a row's height for its name size and layout (written/stage.ts rowHeight) */
export const rowH = (S: ChangeStage) => rowHeight(S.row.layout, S.row.size, S.row.pill);
/** the tab bar's height (kit/TabBar: 44r, r = size / 14) */
export const barH = (S: ChangeStage) => (44 * S.tabs.size) / 14;
/** the list's top (frame px, the panel at rest) and the row pitch */
export function listGeo(S: ChangeStage) {
  const top = S.panel.y + barH(S) + S.headTop;
  const listY = top + S.heading * 1.5;
  const h = rowH(S);
  const pitch = h + S.row.gap;
  const x = S.panel.x + S.pad;
  const w = S.panel.w - 2 * S.pad;
  // the panel holds five rows (the two versions side by side, for a moment) and its padding
  const panelH = S.panel.h ?? listY + 5 * h + 4 * S.row.gap + (S.vertical ? 30 : 28) - S.panel.y;
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

/**
 * b12's agent page LEAVING (critic fix, build B; polish pass): it recedes a depth (scale .9 about its centre, a soft start
 * from b12's rest), takes a shade and eases out to the left (accelerating away, then sliding on out at that speed). The
 * owner's file comes in OVER it — its paper opaque within 2.5 frames (FILE_IN), so text never fades over text for more
 * than a frame — and the page fades out beneath it (PAGE_OUT): one card or the other is on screen in every frame (the
 * old hand-off left ≈ 3 frames with neither).
 */
/** an exit from rest: no velocity on its first frame, accelerating away; LEAVE_EXIT is its slope at the end (the speed
 *  it leaves with, in units of the move per window), so the move can run on past its window instead of stopping */
const LEAVE = Easing.bezier(0.5, 0, 0.75, 0);
const LEAVE_EXIT = 4;
/** the hand-off's fades (polish pass: ONE continuous move, no empty frame): the owner's file comes in OVER the leaving
 *  page — its paper from half a frame after it starts rising (its first words are already rising inside), opaque 2.5
 *  frames later; the page fades out beneath it over 3.5 frames from a frame after the file starts */
const FILE_IN = [K.page[0] + 0.5, K.page[0] + 3] as const;
const PAGE_OUT = [K.page[0] + 1, K.page[0] + 4.5] as const;

export function handoffPose(t: number, S: ChangeStage) {
  const x = (t - K.handoff[0]) / (K.handoff[1] - K.handoff[0]);
  // past its window it slides on out at the speed it reached (it is still visible, under the file, until PAGE_OUT[1])
  const u = x <= 1 ? ease(t, K.handoff[0], K.handoff[1], LEAVE) : 1 + LEAVE_EXIT * (x - 1);
  // (the recede — scale and shade — runs until the page has gone: it never stops stepping back while it can be seen)
  const d = ease(t, K.handoff[0], PAGE_OUT[1], EASE.inOut);
  const far = S.vertical ? 320 : 560;
  return {
    q: u,
    dx: -far * u,
    scale: lerp(1, 0.9, d),
    shade: 0.06 * d,
    opacity: 1 - ease(t, PAGE_OUT[0], PAGE_OUT[1], EASE.inOut),
    on: t < PAGE_OUT[1],
    moving: t > K.handoff[0] && t < PAGE_OUT[1],
  };
}

/** the park's scale + rise (they lead: the file is small and above the panel's top edge before it has finished
 *  travelling right) and its sideways glide */
const PARK_LEAD = Easing.bezier(0.215, 0.61, 0.355, 1);

/**
 * 9:16 (no park): the file steps back UNDER the app's sheet as it comes in (× .92 about its centre, drifting up 36 px,
 * gone by the time the sheet lands) — drawn below the app (Change.tsx).
 *
 * The owner's file: easing in (A) — opacity over 2.5 frames (FILE_IN, over the leaving page) as it rises a little on a
 * landing spring, its words rising inside it (FilePage.tsx) — then stepping up into its parked corner (B): the scale and the rise on a quick ease-out
 * (8.5 f), the sideways travel after them (an in-out from 2.5 f in), so the paper shrinks up off the panel first and
 * then runs in to its corner above the panel's top edge — never sliding across the tab bar.
 * A transform about its top-left.
 */
export function filePose(t: number, S: ChangeStage, h: number) {
  const r = t < K.page[0] ? 0 : springUnit(t - K.page[0], RISE);
  if (!S.file.park) {
    // 9:16 (no parked thumbnail): on "Change the document" the file is put away the way b12's page went — it steps
    // back a depth (× .92 about its centre, a shade of lift lost) and eases out to the left, accelerating, gone before
    // the pointer reaches the row's …; the app it covered is the shot
    const F = S.file;
    const d = ease(t, APP_UP[0], APP_UP[1] - 1, EASE.draw);
    const k = lerp(1, 0.92, d);
    const x = F.x + (F.w * (1 - k)) / 2;
    const y = F.y + F.rise * (1 - r) + (h * (1 - k)) / 2 - 36 * d;
    const opacity = ease(t, FILE_IN[0], FILE_IN[1], EASE.draw) * (1 - ease(t, APP_UP[0] + 1.5, APP_UP[1] - 1.5, EASE.inOut));
    const moving = (r > 0 && Math.abs(1 - r) > 1e-4) || (d > 0 && d < 1);
    return { x, y, k, w: F.w * k, h: h * k, lift: lerp(3 + 1.5 * (1 - r), 2.4, d), opacity, on: t >= K.page[0] - 0.01 && t < APP_UP[1], moving, p: d };
  }
  const ps = t < K.park[0] ? 0 : PARK_LEAD(Math.min(1, (t - K.park[0]) / 8.5));
  // 16:9: up first (the rise with the scale), across after — clear of the panel's tab bar for its whole run-in.
  // 9:16: across first (the glide), up after — the file passes right of Ava's orb as she moves into the corner it
  // leaves, never over her
  const px = S.vertical ? (t < K.park[0] ? 0 : springUnit(t - K.park[0], GLIDE)) : ease(t, K.park[0] + 2.5, K.park[0] + 13, EASE.inOut);
  const py = S.vertical ? ease(t, K.park[0] + 3, K.park[0] + 14, EASE.inOut) : ps;
  const F = S.file;
  const park = S.file.park;
  const k = lerp(1, park.k, ps);
  const parkX = park.right - F.w * park.k;
  const x = lerp(F.x, parkX, px);
  const y = lerp(F.y + F.rise * (1 - r), park.y, py);
  const opacity = ease(t, FILE_IN[0], FILE_IN[1], EASE.draw);
  const p = Math.min(ps, px);
  const moving = (r > 0 && Math.abs(1 - r) > 1e-4) || (t >= K.park[0] && (ps < 1 - 1e-4 || Math.abs(1 - px) > 1e-4 || py < 1 - 1e-4));
  return { x, y, k, w: F.w * k, h: h * k, lift: lerp(3 + 1.5 * (1 - r), 2.2, ps), opacity, on: t >= K.page[0] - 0.01, moving, p };
}

/** the agent page: rising on Knowledge BEHIND the file while the owner types (B, at rest before the pointer leaves for
 *  its …), then stepping back a depth and sliding away down (C) */
export function appPose(t: number, S: ChangeStage) {
  const u = ease(t, K.recede[0], K.recede[1], RECEDE);
  if (!S.file.park) {
    // 9:16: the app comes in from the right OVER the owner's file on "Change the document" (b12's card stack: an app's
    // next sheet, opaque from its first frame; b12's page left to the left), at rest before the pointer reaches the
    // row's … — along its own band (426 → 1264): a climb from under the frame crossed the caption "Change the
    // document." (polish pass). S.W + 200 puts its left edge and its entry shadow (≈ 190 px at lift 4) past the edge
    const a = ease(t, APP_UP[0], APP_UP[1], EASE.draw);
    const dx = (S.W + 200 - S.panel.x) * (1 - a);
    const dy = 1100 * u;
    const opacity = 1 - ease(t, K.recede[0] + 4, K.recede[0] + 18, EASE.inOut);
    return { dx, dy, scale: lerp(1, 0.9, u), shade: 0.06 * u, lift: 2.4 + 1.6 * (1 - a), opacity, u, on: t >= APP_UP[0] - 0.01 && u < 0.999, moving: (a > 0 && a < 1) || (u > 0 && u < 1) };
  }
  const r = t < K.app[0] ? 0 : springUnit(t - K.app[0], RISE);
  const dy = S.panel.rise * (1 - r) + (S.vertical ? 1100 : 760) * u;
  const opacity = ease(t, K.app[0], K.app[0] + 4, EASE.inOut) * (1 - ease(t, K.recede[0] + 4, K.recede[0] + 18, EASE.inOut));
  return { dx: 0, dy, scale: lerp(1, 0.9, u), shade: 0.06 * u, lift: 2.4 + 1.6 * (1 - r), opacity, u, on: t >= K.app[0] - 0.01 && u < 0.999, moving: (r > 0 && Math.abs(1 - r) > 1e-4) || (u > 0 && u < 1) };
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

/** the L-cut's travel: both pictures move this share of the frame (the soft edge does the rest of the hand-over) */
export const CROSS_TRAVEL = 0.4;

/**
 * The L-cut's push (critic fix, build B): ONE curve p (0 → 1 over CHANGE_LOCAL.cross, 24 frames, a sine in-out — the
 * gentlest peak for the distance) drives everything: this act's picture slides out against the reading direction (16:9
 * left, 9:16 up) by 40 % of the frame while b15's desk slides in by the same 40 % behind a soft edge of CONSTANT width
 * (`feather`) that crosses the frame on the same p — the two grounds hand over under it. `edge` is where (screen px along
 * the axis) the desk is fully opaque from; the ramp runs over [edge − feather, edge]. At p = 0 the ramp is past the far
 * side (nothing of the desk shows); at p = 1 it is past the near side and the desk sits at rest: the cut is the same
 * picture. Peak: 16:9 content ≈ 12.6 px, the edge ≈ 34 px per 120 fps frame.
 */
export function crossPush(t: number, S: ChangeStage) {
  const far = S.cross.axis === 'x' ? S.W : S.H;
  const u = Math.min(1, Math.max(0, (t - K.cross[0]) / (K.cross[1] - K.cross[0])));
  const p = (1 - Math.cos(Math.PI * u)) / 2;
  const travel = far * CROSS_TRAVEL;
  const f = S.cross.feather;
  return { p, out: -travel * p, in: travel * (1 - p), edge: (far + f) * (1 - p), feather: f, far, on: t >= K.cross[0] - 1e-6, moving: p > 0 && p < 1 };
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
