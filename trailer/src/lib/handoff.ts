/**
 * MATCH-CUT CONTRACTS — the geometry two neighbouring scenes share at a cut.
 * Both sides of every cut read these, so a shape hands over without a jump.
 * (Timing for the cuts is in timing.ts; this file is only space.)
 *
 *   hook → twist   HOOK_LINE      the settled "Your business is closed." line
 *   twist → call   CALL_ORB_START the phone's avatar = the call's orb
 *   call → result  MARK           "Wednesday at 3 PM" lifts off the transcript
 *                  CARD0          …and is the Booked card at result t=0
 *   scale → cta    FLOW_END       the last (CRM) node; the CTA irises open from it
 */
import type { Layout } from './layout';

/** Hook's line at rest (frames ≥ 100 of the hook). The twist starts from exactly this. */
export const HOOK_LINE = (L: Layout) => ({
  text: 'Your business is closed.',
  fontSize: L.pick(132, 128),
  /** box the line is laid out in (centred text, balanced wrap) */
  left: L.pick(160, 70),
  width: L.pick(1600, 940),
  /** vertical centre of the text block */
  cy: L.pick(L.cy + 210, L.cy + 330),
});

/** Where the call's orb is born: the phone avatar after the dive into the screen. */
export const CALL_ORB_START = (L: Layout) => ({ x: L.cx, y: L.cy, d: L.pick(300, 240) });

/** Transcript geometry in the call (so the result can pick the mark up). */
export const TRANSCRIPT = (L: Layout) => ({
  /** the caption's row A vertical centre (wrapped rows grow downward) */
  y: L.pick(800, 1180),
  fontSize: L.pick(76, 68),
  lineHeight: 1.22,
  maxWidth: L.pick(1640, 960),
});

/**
 * The booked mark. The last line is set as two rows:
 *   row A  "You're all booked for"  centred at TRANSCRIPT.y
 *   row B  "Wednesday at 3 PM."    the mark is its own span, centred on MARK.x
 * The call hides its copy of the mark at result t = 0; the result draws the
 * identical <BookedMark> at MARK and lifts it into the card.
 */
export const MARK = (L: Layout) => {
  const T = TRANSCRIPT(L);
  return { x: L.cx, y: T.y + T.fontSize * T.lineHeight, fontSize: T.fontSize };
};

/**
 * The ember glow under the mark (<MarkGlow k>) at the cut: the call holds it at
 * exactly this strength from CALL.bookedMark + 8 to its last frame; the result
 * draws the same glow at its t 0 and fades it into its plate.
 */
export const MARK_GLOW_HANDOFF = 0.6;

/** The Booked card at the moment it is complete (result t ≈ RESULT.fly). Centre + size. */
export const CARD0 = (L: Layout) => ({
  x: L.cx,
  y: L.pick(L.cy + 40, L.cy + 120),
  w: 560,
  h: 168,
});

/** The final flow node (CRM · 200 OK). The CTA's iris opens from this point. */
export const FLOW_END = (L: Layout) => L.pick({ x: 1520, y: 560 }, { x: 150, y: 1300 });
