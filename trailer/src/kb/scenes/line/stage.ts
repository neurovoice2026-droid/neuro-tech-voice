/**
 * b12 · YOUR LINE — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b11's LAST PICTURE (scenes/call/stage.ts callEnd): the white record row (TRANSCRIPT · the greeting ·
 * "Answered from your documents" + Opening hours · the sunday check), the Opening hours page dim beside it (9:16 below),
 * Ava's orb at rest in her answer place, her KB_MESH ground keyed on the orb (the call's clock running on).
 *
 * THE SHOT (SCRIPT.md b12 + CLIENT DIRECTION v2): the call's record leaves up and the agent page rises in — the same app
 * the owner filled in b08, now on its Conversation tab: the real tab bar (General · Conversation · Voice · Knowledge ·
 * Skills, line variant, Knowledge's badge at 4), and TabConversation.tsx's card "When your agent can't help" — its title,
 * its description, the field "When the answer isn't in your documents" with the product's default line as grey
 * placeholder — over the SaveBar (Discard · Save changes, disabled until there is something to save). The orb glides to
 * her corner, small, and dims to rest: these are not her words.
 *
 *   16:9   the orb top-left; the page centred, its field a sentence per row (the owner's line in two rows)
 *   9:16   the orb centred over the page; the page full width (labels only in the tab bar, as the app on a phone), the
 *          line in four rows, the SaveBar's two buttons side by side (the app's flex-1 on a phone)
 *
 * THE NEIGHBOURS: b11 → here, frame 0 is callEnd()'s picture (scenes/line/Handoff.tsx draws the record row and the page
 * as b11 left them); then ONE SCROLL (LINE_LOCAL.scroll, scrollAmount below): the record slides up and out of the frame as
 * the agent page comes up from below the bottom edge, one sheet. Here → b13: lineEnd() (bottom).
 */
import type React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, springUnit } from '../../../lib/motion';
import { LINE_LOCAL as N, SCENES } from '../../timing';
import { callEnd, callKey, callStage, type Box, type OrbAt } from '../call/stage';

export type { Box, OrbAt };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92 — the acts' GLIDE) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;

export type LineStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** b11's last picture (callEnd) */
  from: ReturnType<typeof callEnd>;
  /** the orb's b11 place → its b12 corner */
  orb: { from: OrbAt; to: OrbAt };
  /** the agent page (frame px at rest) and its corner radius */
  panel: Box & { radius: number };
  /** the tab bar: label size, icons, the strip's side padding (× r) */
  tabs: { size: number; icons: boolean; padR: number };
  /** the content's inner padding */
  pad: number;
  /** UI type sizes: the card title, the description, the field label, the field text, the buttons' label */
  type: { title: number; small: number; label: number; field: number; button: number };
  /** the field's text box: inner padding and line height (× field size) */
  fieldPad: { x: number; y: number };
  lineH: number;
  /** 16:9: a sentence per row (the owner's line breaks after "guess.") */
  sentenceRows: boolean;
  /** the SaveBar: buttons right-aligned at their own widths (16:9) or side by side, each half (9:16) */
  saveBar: 'right' | 'split';
  /** where the I-beam clicks in the field (fractions of the field's box): on the placeholder's first row, to the right —
   *  the hand's crossing from the tab is ≈ 710 px (16:9) / 580 px (9:16), it enters the field's box late in its
   *  deceleration (the I-beam swaps there), and the hop back off the keys to Save changes stays short */
  click: { fx: number; fy: number };
  /** the narrator's caption: centre x, row A's centre, max width */
  caption: { x: number; y: number; maxWidth: number };
};

const STAGES: Record<'land' | 'vert', LineStage> = (() => {
  const make = (vertical: boolean): LineStage => {
    const from = callEnd(vertical);
    if (!vertical) {
      return {
        W: 1920,
        H: 1080,
        vertical,
        from,
        orb: { from: from.orb, to: { x: 178, y: 262, d: 140 } },
        panel: { x: 316, y: 214, w: 1360, h: 0, radius: 30 },
        tabs: { size: 28, icons: true, padR: 14 },
        pad: 48,
        type: { title: 36, small: 24, label: 28, field: 48, button: 27 },
        fieldPad: { x: 26, y: 20 },
        lineH: 1.24,
        sentenceRows: true,
        saveBar: 'right',
        click: { fx: 0.8, fy: 0.33 },
        caption: { x: 960, y: 962, maxWidth: 1560 },
      };
    }
    return {
      W: 1080,
      H: 1920,
      vertical,
      from,
      orb: { from: from.orb, to: { x: 540, y: 322, d: 150 } },
      panel: { x: 64, y: 476, w: 952, h: 0, radius: 30 },
      tabs: { size: 30, icons: false, padR: 8 },
      pad: 38,
      type: { title: 34, small: 24, label: 28, field: 56, button: 28 },
      fieldPad: { x: 26, y: 20 },
      lineH: 1.24,
      sentenceRows: false,
      saveBar: 'split',
      click: { fx: 0.8, fy: 0.33 },
      caption: { x: 540, y: 1336, maxWidth: 940 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const lineStage = (vertical: boolean): LineStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the moves ──────────────────────────────────────────────────── */

/**
 * THE CUT FROM b11 — ONE SCROLL (SCRIPT.md b12: "the record row slides away and a white settings Card comes in"; motion
 * critic: no cross-dissolve, never a frame with nothing new in it). One sheet moves up on power2.inOut over
 * LINE_LOCAL.scroll: the call's record row (and its page, where b11 left one) slides up and OUT through the top edge (gone
 * by ≈ 9), the agent page comes up from just below the BOTTOM edge and lands (11) — both fully opaque, never overlapping
 * (the page's top edge trails the record's bottom), a soft start on b11's held last picture and a long soft landing. The
 * pointer is on the page: it enters through the bottom edge with it and settles onto Conversation as it lands.
 *   travel   the record: its bottom edge + its shadow past the top (record.y + ≈ 9 lines of its type + 60);
 *            the page: from 40 px below the frame (its shadow clear) to its place — 16:9 ≈ 840 / 906 px, 9:16 ≈ 1190 / 1484
 *   speed    peak ≈ 3.5 % of the frame height per 120 fps frame (16:9 37 px, 9:16 61 px): a real app's page push
 */
export function scrollAmount(t: number) {
  return ease(t, N.scroll[0], N.scroll[1], EASE.draw);
}

/** the call's record row and page sliding up and out of the frame (frame px offset) */
export function leavePose(t: number, S: LineStage) {
  const q = scrollAmount(t);
  const r = S.from.record;
  const travel = r.y + 9 * r.size + 60;
  return { dy: -travel * q, on: q < 1, moving: q > 0 && q < 1 };
}

/** the agent page coming up from below the frame and landing in place */
export function panelPose(t: number, S: LineStage) {
  const s = scrollAmount(t);
  const dy = (S.H + 40 - S.panel.y) * (1 - s);
  return { dy, opacity: 1, lift: 2.4 + 1.6 * (1 - s), on: s > 0 || t >= N.scroll[1], moving: s > 0 && s < 1 };
}

/** Ava's orb: b11's place → her corner (the glide, no bounce) */
export function orbPose(t: number, S: LineStage) {
  const g = t < N.orb[0] ? 0 : springUnit(t - N.orb[0], GLIDE);
  const a = S.orb.from;
  const b = S.orb.to;
  return { x: lerp(a.x, b.x, g), y: lerp(a.y, b.y, g), d: lerp(a.d, b.d, g), moving: g > 1e-4 && Math.abs(1 - g) > 1e-4 };
}

/**
 * The orb's light, 0 (rest, dimmed: the owner is typing) … 1 (lit): lit as b11 left her, dimming over the page's arrival,
 * relit on her first word.
 */
export function orbLit(t: number) {
  const dim = ease(t, 2, 22, EASE.inOut);
  const relight = ease(t, N.relight - 2, N.relight + 8, EASE.out3);
  return 1 - dim * (1 - relight);
}

/** the stage the call act used (for its hand-over parts) */
export const callStageOf = (S: LineStage) => callStage(S.vertical);

/* ── the push (the full order only) ─────────────────────────────── */

/**
 * THE PUSH-IN WHILE THE OWNER TYPES (orchestrator, kb-notes.md: "use the spare time for the slow push-in while typing
 * — typed line at ad size"). Only in v2's full order (LINE_LOCAL.full: b12's extra bar); the no-room order has no frame
 * to spare for it.
 *
 *   in    from the field's release (the caret) to just after the last word lands: one slow, continuous push (power2
 *         in-out, ≈ 2.8 s). 16:9: the page comes forward until it fills the frame, centred (×1.30: the field's type
 *         48 → 62 px, the tab bar with its amber dot still in at the top, Save changes in at the bottom right); Ava's
 *         orb, on the same plane, is carried out past the left edge — the owner's moment, not hers. 9:16: a gentle
 *         push about the field (×1.08: 56 → 60 px), which already sits in the middle of the usable height; the typed
 *         line stays inside the platform-safe width (≥ 95 px from each edge).
 *   hold  the finished line holds at ad size while the pointer hops to Save changes and clicks it (the dot closes).
 *   out   on Save's release the camera pulls back to the page's rest place (EASE.inOut) — 16:9 brings Ava back into
 *         the frame in time to relight on her first word; at rest well before the act ends, so lineEnd() is unchanged.
 *
 * The ground rides a far plane (PUSH.ground: a quarter of the move, a gentle parallax); the panel, its pointer and the
 * orb ride the focal plane (planeStyle below: laid out at the push's FULL zoom inside one compositor layer and scaled
 * DOWN to the camera's zoom — a downsampled raster, sharp and sub-pixel smooth on both axes; never an upscaled one).
 */
export const PUSH = (() => {
  const last = N.keys[N.keys.length - 1];
  return {
    on: N.full,
    in: [N.field.up, last + 8] as const,
    out: [N.saveClick.up, N.saveClick.up + 30] as const,
    zoom: { land: 1.3, vert: 1.08 },
    ground: 0.25,
  };
})();

/** the push's amount 0 (rest) … 1 (pushed in) at act-local t */
export function pushAmount(t: number): number {
  if (!PUSH.on) return 0;
  if (t < PUSH.out[0]) return ease(t, PUSH.in[0], PUSH.in[1], EASE.draw);
  return 1 - ease(t, PUSH.out[0], PUSH.out[1], EASE.inOut);
}

export type LineCam = { x: number; y: number; zoom: number };

/**
 * The camera (components/Camera semantics: a depth-d plane is drawn translate(−x·d, −y·d) scale(1 + (zoom − 1)·d)
 * about the frame centre). Focus F goes to target T in a straight line as the push runs: 16:9 F = the page's centre,
 * T = the frame's centre; 9:16 F = T = the field's centre (a pure zoom about it).
 */
export function lineCam(t: number, S: LineStage, page: Box, field: Box): LineCam {
  const e = pushAmount(t);
  if (e <= 0) return { x: 0, y: 0, zoom: 1 };
  const Z = S.vertical ? PUSH.zoom.vert : PUSH.zoom.land;
  const cx = S.W / 2;
  const cy = S.H / 2;
  const F = S.vertical ? { x: field.x + field.w / 2, y: field.y + field.h / 2 } : { x: page.x + page.w / 2, y: page.y + page.h / 2 };
  const T = S.vertical ? F : { x: cx, y: cy };
  return { x: e * (cx + Z * (F.x - cx) - T.x), y: e * (cy + Z * (F.y - cy) - T.y), zoom: 1 + (Z - 1) * e };
}

/** a focal-plane point (stage px) → the screen, under the camera */
export function camToScreen(c: LineCam, S: LineStage, p: { x: number; y: number }) {
  return { x: S.W / 2 - c.x + c.zoom * (p.x - S.W / 2), y: S.H / 2 - c.y + c.zoom * (p.y - S.H / 2) };
}

/**
 * The focal plane under the camera — TWO nested boxes (motion critic, 4K: a plain transform re-rasters the type every
 * frame and Chrome snaps its baselines to whole device pixels, so the panel title stepped ≈ 0.9 device px every 6–8 frames
 * inside a box gliding ½ px a frame — type swimming ≤ 1 px in its box):
 *   inner   the plane laid out at the push's FULL zoom (Z: 16:9 ×1.30, 9:16 ×1.08) — a constant, plain scale(Z), painted
 *           once into the outer layer at that size
 *   outer   ONE compositor layer (will-change + the house tilt, lib/glide) carrying translate + scale(zoom / Z) ≤ 1: the
 *           compositor resamples that raster at the exact sub-pixel offset and scale every frame — no re-raster, no pixel
 *           snapping, a monotonic glide on both axes — and because zoom ≤ Z it only ever DOWNsamples (an upscaled raster is
 *           blur; the old single-layer attempt kept its creation scale and went ≈ 35 % soft by the end of the push)
 * Only while the push is running (pushAmount > 0, LINE_LOCAL field.up → Save's release + 30): at rest (zoom 1, home) no
 * transform and no layer, so the act's first and last pictures (and b13's handover, change/Handoff.tsx) are untouched.
 */
export function planeStyle(c: LineCam, S: LineStage): { outer?: React.CSSProperties; inner?: React.CSSProperties } {
  if (c.zoom === 1 && c.x === 0 && c.y === 0) return {};
  const Z = S.vertical ? PUSH.zoom.vert : PUSH.zoom.land;
  return {
    outer: { ...subpixel(`translate(${(-c.x).toFixed(4)}px, ${(-c.y).toFixed(4)}px) scale(${(c.zoom / Z).toFixed(6)})`, true), transformOrigin: '50% 50%' },
    inner: { transform: `scale(${Z})`, transformOrigin: '50% 50%' },
  };
}

/** the ground plane's transform under the camera (depth PUSH.ground) and a screen point → that plane's own px */
export function groundCam(c: LineCam, S: LineStage) {
  const d = PUSH.ground;
  const z = 1 + (c.zoom - 1) * d;
  return {
    css: c.zoom === 1 && c.x === 0 && c.y === 0 ? undefined : `translate(${(-c.x * d).toFixed(4)}px, ${(-c.y * d).toFixed(4)}px) scale(${z.toFixed(6)})`,
    zoom: z,
    fromScreen: (p: { x: number; y: number }) => ({ x: S.W / 2 + (p.x - S.W / 2 + c.x * d) / z, y: S.H / 2 + (p.y - S.H / 2 + c.y * d) / z }),
  };
}

/* ── the act's last picture, for b13 ─────────────────────────────── */

/**
 * lineEnd(vertical): what the cut into b13 hands over (frame px). The agent page at rest on its Conversation tab (the
 * owner's line in the field, saved: no amber dot, Discard and Save changes disabled), the sunday focus ring settled
 * round the field; the orb small in her corner, lit (she has just spoken); her KB_MESH ground (line/Ground.tsx: its
 * clock = ground.meshClock below, the key = ground.key); the caption and the pointer have left.
 *   panel  its box (h measured by the act — line/Panel.tsx usePageGeometry; here the layout's top-left and width)
 *   orb    centre + diameter (the FluidOrb drawn at b07's canvas size, scaled)
 */
export function lineEnd(vertical: boolean) {
  const S = lineStage(vertical);
  // the mesh's clock at this act's last frame (it still trails the timeline by b10's stop-time)
  const meshClock = S.from.ground.meshClock + N.end;
  const key = callKey(callStage(vertical), S.orb.to.d);
  return {
    orb: S.orb.to,
    panel: { x: S.panel.x, y: S.panel.y, w: S.panel.w, radius: S.panel.radius },
    tabs: S.tabs,
    ground: { meshClock, meshLag: SCENES.line.to - meshClock, key: { x: S.orb.to.x, y: S.orb.to.y, ...key } },
    at: N.end,
  };
}
export const LINE_END = lineEnd;
