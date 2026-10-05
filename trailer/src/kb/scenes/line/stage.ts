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
 *   9:16   the orb centred over the page; the page is b08's FULL-TAB panel (fix:line — written/stage.ts's 9:16 FULL-TAB
 *          SPEC: the same box, tab bar and type as the written act's), the WHOLE current tab inside it at every moment —
 *          Knowledge exactly as b08 left it, then Conversation laid out for the portrait panel: the line in four rows,
 *          a phrase per row, the SaveBar pinned to the panel's foot with its two buttons side by side (the app's flex-1
 *          on a phone). No push-in (PUSH below): the panel is 1024 of the frame's 1080, any push would crop it
 *
 * 9:16 PORTRAIT PAGE (fix:line; layout px of the 1080 × 1920 frame, × 2 in the master):
 *   FRAME   250–384 the header row: Ava's orb centred, (540, 317) Ø 124 (b08's header orb size and line) · 396–1347
 *           the panel · the caption's row A centred on 1412 (PORTRAIT_SPEC.caption) · nothing under 1536
 *   PANEL   portraitPanel(396, 4): x 28, y 396, w 1024, h 951, radius 34 (b08's at writtenEnd, b09's hand-over); the
 *           tab bar labels only, 32 (100.57 tall), Knowledge's badge at 4; content x 68, w 944
 *   KNOWLEDGE (the page comes back on it) b08's whole tab at rest: Add knowledge · the drop zone · or add a web page ·
 *           the field (placeholder) + Add page (disabled) · Your documents · the four rows Ready at b08's slots
 *           (936.6 · 1033.6 · 1130.6 · 1227.6, one-line rows, name 36, pill 28) — line/Panel.tsx KnowledgePortrait
 *   CONVERSATION  title 42 at 520.6 (Add knowledge's line) · the description 28 (two lines) · the label 30 · the
 *           field from ≈ 731: the owner's line at 64 (the old push's peak was 60), a phrase per row ("I don't have an
 *           answer for that," / "and I don't want to guess." / "I'll ask the team to" / "call you back today."), the
 *           placeholder the same way in three, the box filling down to 40 px over the SaveBar's hairline (a phone's
 *           flex-1 textarea) · the SaveBar pinned to the panel's foot: Discard | Save changes at 32 (73 tall), 34 px
 *           over the panel's bottom edge (the Knowledge list's last row ends at the same line)
 *   POINTER the I-beam clicks on the placeholder's first row (.8 across); the hop back off the keys to Save changes
 *
 * THE NEIGHBOURS: b11 → here, frame 0 is callEnd()'s picture (scenes/line/Handoff.tsx draws the record row and the page
 * as b11 left them); then ONE MOVE (LINE_LOCAL.scroll, scrollAmount below): the record steps back under the agent page as
 * it comes up from below the bottom edge, a card stack. Here → b13: lineEnd() (bottom).
 */
import type React from 'react';
import { EASE, springUnit } from '../../../lib/motion';
import { LINE_LOCAL as N, SCENES } from '../../timing';
import { callEnd, callKey, callStage, type Box, type OrbAt } from '../call/stage';
import { PORTRAIT_SPEC, portraitPanel } from '../written/stage';

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
  /** the agent page (frame px at rest) and its corner radius. h 0: the page's height is its content's (16:9, measured
   *  by line/Panel.tsx usePageGeometry); h > 0: a fixed panel (9:16, b08's full-tab panel) — the SaveBar pinned to its
   *  foot, the field filling down to it */
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
  /** 9:16: a phrase per row (line/Panel.tsx phraseRows: clauses packed into rows, a clause too long for one row split
   *  into the fewest, most even rows) — the owner's line and the placeholder */
  phraseRows: boolean;
  /** the SaveBar: buttons right-aligned at their own widths (16:9) or side by side, each half (9:16) */
  saveBar: 'right' | 'split';
  /** where the I-beam clicks in the field (fractions of the field's box): on the placeholder's first row, to the right —
   *  the hand's crossing from the tab is ≈ 710 px (16:9) / 580 px (9:16), it enters the field's box late in its
   *  deceleration (the I-beam swaps there), and the hop back off the keys to Save changes stays short */
  click: { fx: number; fy: number; row?: number };
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
        phraseRows: false,
        saveBar: 'right',
        click: { fx: 0.8, fy: 0.33 },
        caption: { x: 960, y: 962, maxWidth: 1560 },
      };
    }
    // 9:16 (fix:line): b08's full-tab panel (written/stage.ts PORTRAIT_SPEC / portraitPanel — the box, tab bar, padding
    // and UI type of the written act's last picture and the call act's hand-over), the orb centred in the header row
    // over it at b08's header size, the caption in the spec's band under it
    const PP = portraitPanel(PORTRAIT_SPEC.panelTop, 4);
    const H = PORTRAIT_SPEC.header.orb;
    return {
      W: 1080,
      H: 1920,
      vertical,
      from,
      orb: { from: from.orb, to: { x: 540, y: H.y, d: H.d } },
      panel: { x: PP.panel.x, y: PP.panel.y, w: PP.panel.w, h: PP.panel.h, radius: PP.panel.radius },
      tabs: { ...PP.tabs },
      pad: PP.pad,
      type: { title: PP.type.title, small: PP.type.small, label: PP.type.label, field: 64, button: PP.type.body },
      fieldPad: { x: 26, y: 22 },
      lineH: 1.24,
      sentenceRows: false,
      phraseRows: true,
      saveBar: 'split',
      // (on the placeholder's first row, to the right: the field box is tall — it fills down to the SaveBar)
      click: { fx: 0.8, fy: 0, row: 0 },
      caption: { ...PORTRAIT_SPEC.caption },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const lineStage = (vertical: boolean): LineStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the moves ──────────────────────────────────────────────────── */

/**
 * THE CUT FROM b11 (SCRIPT.md b12: "the record row slides away and a white settings Card comes in"; motion critic: no
 * cross-dissolve, never a frame with nothing new in it) — a CARD STACK, as an app presents its next sheet: over
 * LINE_LOCAL.scroll the agent page comes up from just below the frame's BOTTOM edge (opaque from its first frame, power2
 * inOut, landing at 11 with a long soft tail) and slides OVER the call's record row, which steps back under it — it
 * recedes (× .92 about its centre, drifting up 36 px) and goes (gone by 9.5, the page covering most of it by then). The
 * record never crosses Ava's orb (a slide-out through the top edge would pass behind her), the page is in frame from
 * ≈ 1.75, and the pointer is on the page: it enters through the bottom edge with it and settles onto Conversation as it
 * lands.
 *   travel   the page: from 40 px below the frame (its shadow clear) to its place — 16:9 906 px, 9:16 1484 px
 *   speed    peak ≈ 3.5 % of the frame height per 120 fps frame (16:9 37 px, 9:16 61 px): a real app's sheet
 */
export function scrollAmount(t: number) {
  return ease(t, N.scroll[0], N.scroll[1], EASE.draw);
}

/** the call's record row (and its page, where b11 left one) stepping back under the incoming page */
export function leavePose(t: number, S: LineStage) {
  const q = ease(t, N.scroll[0], N.scroll[1] - 1, EASE.draw);
  const r = S.from.record;
  const opacity = 1 - ease(t, N.scroll[0] + 1.5, N.scroll[1] - 1.5, EASE.inOut);
  return {
    scale: 1 - 0.08 * q,
    dy: -36 * q,
    origin: { x: r.x + r.w / 2, y: r.y + 4 * r.size },
    opacity,
    on: opacity > 0.001,
    moving: q > 0 && q < 1,
  };
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
 *         line stays inside the platform-safe width (≥ 95 px from each edge). fix:line: NO PUSH IN 9:16 (zoom.vert 1,
 *         lineCam the identity) — the page is now b08's full-tab panel, 1024 px of the frame's 1080: any push about the
 *         field would carry the panel's edges (and the whole tab with them) out of the frame. The typed line is set at
 *         its ad size at rest instead (64 px, the old push's peak was 60.5).
 *   hold  the finished line holds at ad size while the pointer hops to Save changes and clicks it (the dot closes).
 *   out   on Save's release the camera pulls back to the page's rest place (EASE.inOut) — 16:9 brings Ava back into
 *         the frame in time to relight on her first word; at rest well before the act ends, so lineEnd() is unchanged.
 *
 * The ground rides a far plane (PUSH.ground: a quarter of the move, a gentle parallax); the panel, its pointer and the
 * orb ride the focal plane (planeStyle below: plain while zooming — the type re-rasters at the exact scale every frame, no
 * upscaled layer, no blur).
 */
export const PUSH = (() => {
  const last = N.keys[N.keys.length - 1];
  return {
    on: N.full,
    in: [N.field.up, last + 8] as const,
    out: [N.saveClick.up, N.saveClick.up + 30] as const,
    zoom: { land: 1.3, vert: 1 },
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
  const Z = S.vertical ? PUSH.zoom.vert : PUSH.zoom.land;
  if (e <= 0 || Z === 1) return { x: 0, y: 0, zoom: 1 };
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
 * The focal plane's style under the camera: a PLAIN transform (no will-change, no tilt). Measured at 4K / 120 fps over the
 * whole push (out/kb/plusbar, render sequences at concurrency 2):
 *   · a compositor layer keeps the raster scale it was made at: by the end of a ×1.3 push its type was ≈ 35 % softer than a
 *     fresh still (gradient energy 96–100 vs 126–160) — upscaled raster, i.e. blur. Never for a push this deep.
 *   · the house tilt on a plain transform (lib/glide SUBPIXEL_TILT, no layer) softened the glyphs ≈ 25 % and still stepped.
 *   · plain: re-rastered at the exact scale every frame (as sharp as a still); horizontal glide sub-pixel smooth; vertically
 *     the baselines move in whole 4K device pixels (½ px at 1080) — a step every 1–3 frames mid-push, sparser near the
 *     push's still line and in its ease tails. The sharp choice; no blur at any frame.
 *   · line fix pass (motion critic: "lay the plane out at ×1.30 in a will-change layer and scale it DOWN, zoom / 1.3"),
 *     built and measured (out/kb/fix-line, 4K, 7480–7520, concurrency 1, the panel title's ink centroid against the panel's
 *     edges): this renderer re-rasters the layer at its on-screen scale every frame while the push-in grows it, so the
 *     downsampled raster never exists — the title stepped exactly as before (−0.1 / −1.4 px alternating; title-vs-box dy
 *     std 0.38 vs 0.43 plain, worst 0.78 vs 1.11) while the layer's resampling cost 15 % of the type's gradient energy at
 *     4K (rms 37.1 vs 43.7, p99.5 182 vs 228) and 30 % at 1080 (23.4 vs 33.6) — blur, against the film's hard rule. The
 *     same with no tilt (37.4) and with a paused CSS animation carrying the scale (cc's max-scale raster hint: 37.1, same
 *     steps). Rejected; the plain transform stays.
 * At rest (zoom 1, home) no transform at all, so the act's first and last pictures are untouched.
 */
export function planeStyle(c: LineCam): React.CSSProperties | undefined {
  if (c.zoom === 1 && c.x === 0 && c.y === 0) return undefined;
  return { transform: `translate(${(-c.x).toFixed(4)}px, ${(-c.y).toFixed(4)}px) scale(${c.zoom.toFixed(6)})`, transformOrigin: '50% 50%' };
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
