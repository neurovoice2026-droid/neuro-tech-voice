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
 * as b11 left them, then they leave). Here → b13: lineEnd() (bottom).
 */
import { EASE, springUnit } from '../../../lib/motion';
import { LINE_LOCAL as N, SCENES } from '../../timing';
import { callEnd, callKey, callStage, type Box, type OrbAt } from '../call/stage';

export type { Box, OrbAt };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92 — the acts' GLIDE) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** the page rising in: a short landing, no bounce (ζ ≈ 1) */
export const RISE = { stiffness: 300, damping: 34.6, mass: 1 } as const;

export type LineStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** b11's last picture (callEnd) */
  from: ReturnType<typeof callEnd>;
  /** the orb's b11 place → its b12 corner */
  orb: { from: OrbAt; to: OrbAt };
  /** the agent page (frame px at rest), its corner radius, how far below its place it starts rising */
  panel: Box & { radius: number; rise: number };
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
  /** where the I-beam clicks in the field (fractions of the field's box) */
  click: { fx: number; fy: number };
  /** the narrator's caption: centre x, row A's centre, max width */
  caption: { x: number; y: number; maxWidth: number };
  /** the call's record row and page leave up by this much */
  leave: number;
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
        panel: { x: 316, y: 214, w: 1360, h: 0, radius: 30, rise: 96 },
        tabs: { size: 28, icons: true, padR: 14 },
        pad: 48,
        type: { title: 36, small: 24, label: 28, field: 48, button: 27 },
        fieldPad: { x: 26, y: 20 },
        lineH: 1.24,
        sentenceRows: true,
        saveBar: 'right',
        click: { fx: 0.86, fy: 0.72 },
        caption: { x: 960, y: 962, maxWidth: 1560 },
        leave: 120,
      };
    }
    return {
      W: 1080,
      H: 1920,
      vertical,
      from,
      orb: { from: from.orb, to: { x: 540, y: 322, d: 150 } },
      panel: { x: 64, y: 476, w: 952, h: 0, radius: 30, rise: 120 },
      tabs: { size: 30, icons: false, padR: 8 },
      pad: 38,
      type: { title: 34, small: 24, label: 28, field: 56, button: 28 },
      fieldPad: { x: 26, y: 20 },
      lineH: 1.24,
      sentenceRows: false,
      saveBar: 'split',
      click: { fx: 0.8, fy: 0.78 },
      caption: { x: 540, y: 1336, maxWidth: 940 },
      leave: 160,
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const lineStage = (vertical: boolean): LineStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the moves ──────────────────────────────────────────────────── */

/** the call's record row and page leaving up (power3.in, gone by leave[1]): offset and opacity */
export function leavePose(t: number, S: LineStage) {
  const q = ease(t, N.leave[0], N.leave[1], EASE.in3);
  // gone (faded) a frame before it has finished travelling: the page rising in never sits on top of it
  return { dy: -S.leave * q, opacity: 1 - ease(t, N.leave[0] + 0.5, N.leave[1] - 1, EASE.in2), on: q < 1, moving: q > 0 && q < 1 };
}

/** the agent page rising into place (a landing spring from enter[0]; opacity over its first frames) */
export function panelPose(t: number, S: LineStage) {
  const s = t < N.enter[0] ? 0 : springUnit(t - N.enter[0], RISE);
  const dy = S.panel.rise * (1 - s);
  // it rises from enter[0] but only shows as the record goes (its last quarter-frame under 12 %): the two never sit on
  // top of each other, and the stage is never left empty — a fast ease-out (whole-film pass: the old inOut over
  // [5, 9.5] left ~1.8 frames with nothing but the ground between the two)
  const opacity = ease(t, Math.max(N.enter[0], N.leave[1] - 1.25), N.leave[1] + 2, EASE.out3);
  return { dy, opacity, lift: 2.4 + 1.6 * (1 - s), on: t >= N.enter[0] - 0.01, moving: s > 0 && Math.abs(1 - s) > 1e-4 };
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
