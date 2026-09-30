/**
 * EVERY timing constant in the trailer lives in this file.
 *
 * The film is cut on a 120 BPM grid: one beat = 0.5 s = 15 frames at 30 fps.
 * All values are written in beats with `b()` and converted to frames, so
 * retiming a moment is a one-number change here; the pictures AND the sound
 * effects (see CUES at the bottom) read the same constants, so they stay
 * locked together.
 *
 * Scene values are LOCAL to the scene (0 = the scene's own start), except
 * SCENES itself and CUES, which are absolute timeline frames.
 */

export const FPS = 30;
export const BPM = 120;
/** Frames per beat (15 at 120 BPM / 30 fps). */
export const BEAT = (60 / BPM) * FPS;
/** Beats → frames (rounded to the nearest frame). */
export const b = (beats: number) => Math.round(beats * BEAT);

export const TOTAL_BEATS = 60;
export const DURATION = b(TOTAL_BEATS); // 900 frames = 30 s

export const LANDSCAPE = { width: 1920, height: 1080 } as const;
export const VERTICAL = { width: 1080, height: 1920 } as const;

/**
 * Scene windows on the absolute timeline. `pre`/`post` are the frames a
 * scene stays mounted before/after its window, for the match cuts where two
 * scenes share a shape.
 */
export const SCENES = {
  hook: { from: b(0), to: b(8), pre: 0, post: 6 }, //   0–4 s
  twist: { from: b(8), to: b(16), pre: 8, post: 12 }, //   4–8 s
  call: { from: b(16), to: b(30), pre: 12, post: 20 }, //  8–15 s
  result: { from: b(30), to: b(38), pre: 14, post: 10 }, // 15–19 s
  scale: { from: b(38), to: b(48), pre: 6, post: 12 }, // 19–24 s
  cta: { from: b(48), to: b(60), pre: 12, post: 0 }, // 24–30 s
} as const;
export type SceneKey = keyof typeof SCENES;

/* ---------------------------------------------------------------- *
 * 0–4 s · HOOK — black, clock jumps to 03:12, the phone starts ringing,
 * "Your business is closed."
 * ---------------------------------------------------------------- */
export const HOOK = {
  clockIn: b(1), // digit strips start to roll
  clockLand: b(2), // 03:12 lands (click + thump)
  ring: b(3), // first burst of the first ring
  ringBurst: 12, // frames the burst lasts (0.4 s, UK cadence)
  freeze: b(3) + 14, // time "freezes" mid-ring: rings hang in the air
  textIn: b(4), // "Your business is closed." starts rising
  wordStagger: 3,
  anticipation: b(7.5) - 1, // = 112: the twist mounts and the text gathers itself before it breaks
  cameraPush: [0, b(8)] as const,
};

/* ---------------------------------------------------------------- *
 * 4–8 s · TWIST — the type shatters and recomposes into the tagline;
 * the door shuts, the phone lights up.
 * ---------------------------------------------------------------- */
export const TWIST = {
  shatter: 0, // letters blow apart (on the downbeat)
  shatterOut: 8, // frames flying outwards
  reassemble: [8, b(1.5)] as const, // shards fly back as "Closed is for the door,"
  doorSlam: b(2), // the door shuts as "door," lands
  closedSign: b(2.5), // CLOSED sign swings in (elastic)
  line2: b(3), // "not the phone." rises
  keyColor: b(3) + 6, // key phrase eases paper → lilac (site's 0.15 s delay)
  phoneOn: b(3.5), // the phone screen lights up as "phone." lands
  ring2: b(6.5), // second burst of the SAME first ring
  pushToPhone: [b(6), b(8)] as const, // camera dives into the phone screen
};

/* ---------------------------------------------------------------- *
 * 8–15 s · CALL — picked up on the first ring; live transcript.
 * ---------------------------------------------------------------- */
export const CALL = {
  pickup: 0,
  pickedUpText: [0, b(2)] as const, // big kinetic line, then it shrinks into the phase label
  typeRate: 1.6, // characters per frame for the typewriter
  lines: [
    { at: b(1.5), who: 'agent', text: 'This is Ava, an AI assistant.' },
    { at: b(4.5), who: 'caller', text: 'Could I come in on Wednesday afternoon?' },
    { at: b(7.5), who: 'agent', text: 'Of course. I have 15:00 or 16:30.' },
    { at: b(9.5), who: 'caller', text: "Three o'clock is perfect." },
    { at: b(11.5), who: 'agent', text: "You're booked for Wednesday at 15:00." },
  ] as const,
  /** Slot chips pop as their times are typed in line 3 (frames after line 3 starts). */
  slotPops: [12, 18] as const,
  /** The caller's pick selects the 15:00 chip. */
  slotPick: b(9.5) + 10,
  /** "Wednesday at 15:00" eases to ember when the booking is made (0.42 s). */
  bookedMark: b(11.5) + 24,
};

/* ---------------------------------------------------------------- *
 * 15–19 s · RESULT — the booking flies into the calendar.
 * Split: owner "Asleep." / calendar "Booked."
 * ---------------------------------------------------------------- */
export const RESULT = {
  lift: 0, // "Wednesday at 15:00" lifts off the transcript and becomes the card
  calendarIn: b(0.5),
  fly: b(1), // card leaves on its arc…
  land: b(2), // …and lands in the slot (ding)
  split: b(3), // split divider draws; "Asleep." lands
  bookedWord: b(4), // "Booked." lands
  toWhite: [b(7), b(8)] as const, // the booked event opens up into the white act
};

/* ---------------------------------------------------------------- *
 * 19–24 s · SCALE — 16 industries on 16th notes, Ava in six languages,
 * then a flash of the after-call flow.
 * ---------------------------------------------------------------- */
export const SCALE = {
  industryStep: BEAT / 4, // one industry per 16th note (3.75 f)
  industriesIn: 0,
  gridSettle: b(3.5),
  industriesTitle: b(3.5),
  langMorph: b(4.5), // grid collapses into six language cells
  langStep: BEAT / 2, // one language per 8th note
  flow: b(8), // call → Slack → CRM
  flowStep: BEAT / 2,
  irisToDark: [b(9.5), b(10) + 8] as const,
};

/* ---------------------------------------------------------------- *
 * 24–30 s · CTA — everything converges into the logo.
 * ---------------------------------------------------------------- */
export const CTA = {
  robotIn: [0, b(2)] as const,
  line: b(1), // "AI voice agents that book your customers 24/7."
  wordStagger: 3,
  converge: [b(3), b(5)] as const,
  logoImpact: b(5),
  button: b(6),
  note: b(6.5),
  url: b(7),
  press: b(7.5), // the button takes the site's hover (plum) as if clicked
  finalHold: b(9), // from here to the end (1.5 s) nothing moves but grain
};

/* ================================================================ *
 * FINE CUTS — every scene's internal timing, derived from the beat
 * constants above (b() = beats). Values are LOCAL to their scene.
 * ================================================================ */

/* ── HOOK — fine cuts (hook-local frames) ──────────────────────── */
/** The twist mounts (and starts drawing the line) at 112 = SCENES.twist.from − pre.
 *  HOOK.anticipation = b(7.5) rounds to 113; it should be b(7.5) − 1 = 112 = this. */
const HOOK_HANDOFF = SCENES.twist.from - SCENES.twist.pre; // 112 (global = hook-local: the hook starts at 0)
export const HOOK_LOCAL = {
  dustIn: [0, 12] as const, // the faint motes come up out of the black
  fieldIn: 3, // the cover field starts to bloom
  orbIn: b(0.25), // 4  — the colon orb lights, alone in the black
  figuresIn: b(0.6), // 9  — "00 ◉ 00" unfolds dimly out of the orb
  digitStagger: 2, // frames between the four strips leaving
  /** Every ring attack leaves this many frames before its beat, so the beat frame is the peak. */
  ringLead: 1,
  ringB: b(3) + 7, // 52 — second ring of the burst
  waveIn: b(2.5), // 38 — the dotted wave row draws out from the centre
  freezeEase: 3, // frames for world time to stop
  frozenRate: 0.04, // world speed once frozen (the rings creep, never quite stop)
  anticipation: HOOK_HANDOFF, // 112 — the inhale; the hanging rings/wave finish decaying
  /** 112 → 120: the world defocuses and is gone ON the shatter downbeat (1.5 % left at 119). */
  out: [HOOK_HANDOFF, SCENES.hook.to] as const,
  /** Last frame the hook draws the line is textHandoff − 1. */
  textHandoff: HOOK_HANDOFF, // 112 (global)
};

/* ── TWIST — fine cuts (twist-local frames) ────────────────────── */
export const TWIST_LOCAL = {
  /** anticipation before the break: the line gathers itself (t -8 → 0) */
  gather: -8,
  /** "closed" lets go of the hook line and slides into "Closed" (per-letter +0.35) */
  closedSlide: 4,
  /** landing (lock-in) frame of the FIRST letter of "is", "for", "the" */
  wordLand: [16.5, 19.5, 22.5] as const,
  /** gap between the landings of neighbouring letters inside a word */
  letterGap: 0.7,
  /** "door," lands left to right and its comma locks ON the slam */
  doorGap: 0.55,
  /** no shard turns round before this (the blast has to read first) */
  turnMin: 8.5,
  /** the phone emerges from the dark once "closed" has left it */
  phoneReveal: [7, 17] as const,
  /** the on-phone avatar settles from its UI size to CALL_ORB_START/S */
  avatarShrink: [TWIST.pushToPhone[0] + 12, TWIST.pushToPhone[1] - 2] as const,
  /** the door creaks a little wider before it swings (anticipation) */
  doorCreak: 7,
  /** the swing itself: slow start, accelerating into the slam (EASE.in4) */
  doorSwing: [12, TWIST.doorSlam] as const,
  /** screen: line expands, then opens to the full screen */
  screenLine: [TWIST.phoneOn, TWIST.phoneOn + 3] as const,
  screenOpen: [TWIST.phoneOn + 2, TWIST.phoneOn + 14] as const,
  /** phone UI rows */
  uiLabel: TWIST.phoneOn + 6,
  uiNumber: TWIST.phoneOn + 10,
  /** camera: slow push over the hold */
  push: [TWIST.doorSlam - 2, TWIST.pushToPhone[0] + 2] as const,
  /** pull-back anticipation of the dive (peaks at [1]) */
  diveDip: [TWIST.pushToPhone[0] - 5, TWIST.pushToPhone[0] + 3, TWIST.pushToPhone[0] + 10] as const,
  /** camera aims at the avatar (pan) — leads the zoom */
  diveAim: [TWIST.pushToPhone[0], TWIST.pushToPhone[1] - 4] as const,
  /** phone vibration at the second burst */
  buzz: [TWIST.ring2, TWIST.ring2 + 12] as const,
};

/* ── CALL — fine cuts (call-local frames) ──────────────────────── */
const CALL_LIFT = b(1.25) + 2; // 21: the big line starts its dive
const CALL_DIVE = 8; // frames of the dive
const CALL_SWALLOW = CALL_LIFT + CALL_DIVE; // 29: the orb swallows it
export const CALL_LOCAL = {
  /** the night room fades in over the twist's (identical) phone screen */
  roomIn: [-4, 0] as const,
  /** the zoomed room (the phone screen) pulls back to the whole stage */
  roomOpen: [2, b(2.6)] as const,
  /** pickup breath (site): 1 → .965 power2.in 0.16 s, → 1 expo.out 0.9 s */
  inhale: [0, 5] as const,
  exhale: [5, 32] as const,
  /** the orb leaves the centre for the lockup (spring) */
  glide: 4,
  /** the figure pairs slide out from behind the orb (spring), on a 16th */
  unfold: b(0.75), // 11
  /** the status row swings in (sign), day label letters follow */
  statusIn: 0,
  /** the dotted level row draws out from the centre */
  waveIn: b(1),
  /** the big line gathers (4 f) then dives into the orb… */
  lift: CALL_LIFT,
  dive: CALL_DIVE,
  /** …which swallows it (gulp + ping + level blip)… */
  swallow: CALL_SWALLOW,
  /** …and emits the phase dot from its crown; the label unfolds 4 f later */
  emit: CALL_SWALLOW + 1, // 30 = b(2), the end of CALL.pickedUpText
  /** rings: the pickup, then every time Ava starts a line */
  rings: [0, CALL.lines[0].at, CALL.lines[2].at, CALL.lines[4].at] as const,
  /** the AI-disclosure underline draws once "an AI assistant" is typed */
  disclose: CALL.lines[0].at + Math.ceil('This is Ava, an AI assistant'.length / CALL.typeRate),
  /** the stage's floor (owner / call-log row) draws in */
  ownerIn: b(3), // 45
  /** status + phase label dim to .58 so the transcript is the single read */
  dim: [b(3.5), b(4.5)] as const, // 53 → 68
  /** camera drift settles to rest before the mark is handed over */
  camSettle: [b(10), b(13)] as const,
  /** the payoff beat: the mark presses (3 f) and springs back — exactly 1 again by markHide − 1 */
  payoff: CALL.bookedMark + 1, // 198
  /** once the mark starts turning ember, everything but the mark recedes */
  exit: [CALL.bookedMark - 1, b(15.2)] as const, // 196 → 228 (scale, rack focus)
  exitFade: [CALL.bookedMark - 1, b(15.2) - 2] as const, // 196 → 226 (opacity, front-loaded)
  /** the result scene draws the mark from here (global 450) */
  markHide: b(14), // 210
};

/* ── RESULT — fine cuts (result-local frames) ──────────────────── */
export const RESULT_LOCAL = {
  /** the night room knocks the call back (out-curve) */
  roomIn: [RESULT.lift, b(4 / 3)] as const, // 0 → 20
  /** the lift spring starts here, after a 2-frame anticipation dip */
  liftGo: RESULT.lift + b(1 / 8), // 2
  /** the booked-pill wash blooms around the mark */
  plateIn: [RESULT.lift + b(1 / 15), RESULT.lift + b(0.3)] as const, // 1 → 5
  /** " at" folds out of the mark */
  markCollapse: [RESULT.lift + b(1 / 8), RESULT.lift + b(0.4)] as const, // 2 → 6
  /** the plate grows pill → card; the mark's words travel onto the card row */
  morph: [RESULT.lift + b(1 / 8), RESULT.lift + b(2 / 3)] as const, // 2 → 10
  /** BOOKED + the ember dot rise in */
  cardReveal: [RESULT.lift + b(0.4), RESULT.lift + b(0.8)] as const, // 6 → 12
  /** the registered words cross-fade: the mark (Inter) → the card row (Instrument Sans) */
  markOut: [RESULT.lift + b(0.6), RESULT.lift + b(5 / 6)] as const, // 9 → 13
  /** the card pulls back before the throw */
  windUp: [RESULT.fly - b(0.2), RESULT.fly] as const, // 12 → 15
  /** the sheet's entry spring (3-frame anticipation before it) */
  sheetIn: RESULT.calendarIn, // 8
  /** hairlines, labels, hours, bookings build (all in by t≈13–15) */
  build: [RESULT.calendarIn + b(1 / 15), RESULT.fly] as const, // 9 → 15
  /** WED highlight */
  wedIn: [RESULT.calendarIn + b(2 / 15), RESULT.calendarIn + b(0.4)] as const, // 10 → 14
  /** the dashed slot */
  slotIn: [RESULT.calendarIn + b(2 / 15), RESULT.calendarIn + b(1 / 3)] as const, // 10 → 13
  /** …which beckons before the throw */
  beckon: [RESULT.calendarIn + b(0.2), RESULT.fly] as const, // 11 → 15
  /** the camera pushes into the close-up with the throw */
  camIn: [RESULT.fly, RESULT.land + b(2 / 15)] as const, // 15 → 32
  /** the landing shockwave through the sheet */
  shock: [RESULT.land, RESULT.land + b(1.4)] as const, // 30 → 51
  /** the pill's ping on the event's dot */
  ping: [RESULT.land + b(0.2), RESULT.land + b(1.2)] as const, // 33 → 48
  /** the calendar recomposes into its half (its anticipation starts 3 f earlier, t 36) */
  recompose: RESULT.land + b(0.6), // 39
  recomposeAnticip: b(0.2), // 3
  /** the split hairline starts drawing */
  divider: RESULT.split - b(0.25), // 41
  /** the split's grade: the owner's half cools and darkens */
  splitGrade: [RESULT.split - b(0.4), RESULT.split + b(14 / 15)] as const, // 39 → 59
  /** the titles plane moves above the sheet (it sits under it while the sheet recomposes) */
  titlesOver: RESULT.split + b(1 / 3), // 50
  /** the owner lockup pops (after "Asleep." lands) */
  ownerIn: RESULT.split + b(0.2), // 48
  /** anticipation pulse on the event (peak) */
  pulse: RESULT.toWhite[0] - b(1 / 3), // 100
  /** the dive into the event */
  dive: [RESULT.toWhite[0] - b(1 / 3), RESULT.toWhite[1] - b(0.2)] as const, // 100 → 117
  /** the event's rect opens past the frame edges (camera does most of it; this is the last few ×) */
  open: [RESULT.toWhite[0], RESULT.toWhite[1] - b(4 / 15)] as const, // 105 → 116
  /** the event's fill blooms from its centre: ember → soft ember → white */
  bloom: [RESULT.toWhite[0] + b(2 / 15), RESULT.toWhite[1] - b(0.2)] as const, // 107 → 117
  /** the frame is entirely white from here */
  whiteFull: RESULT.toWhite[1] - b(0.2), // 117
};

/* ── SCALE — fine cuts (scale-local frames) ────────────────────── */
export const SCALE_LOCAL = {
  /** one industry pop per 16th note */
  pops: Array.from({ length: 16 }, (_, i) => Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
  /** card 01 (and its ring) pop this many frames before the cut, the tray one
   *  more: t 0 (hit.wav) shows them mid-move instead of an empty white frame */
  preroll: 2,
  /** the camera pulls back from the montage close-up to rest */
  camPull: [b(0.25), b(4)] as const, // 4 → 60
  /** eyebrows in: "Same agent, your vocabulary" → "What the caller hears" */
  eyebrow: [b(0.15), b(4.8)] as const, // 2, 72
  /** …and out (fast; the next rises into a clear slot) */
  eyebrowOut: [b(4.4), b(7.3)] as const, // 66, 110
  /** "16 industries." → "14 languages." (a J-cut: the words follow the picture) */
  titleSwap: b(4.9), // 74
  /** the ring lets go of card 16 as the grid breaks */
  ringRelease: b(4.3), // 65
  /** the ten leaving cards peel off: pull-in from flyOut − flyAnticip, then accelerate out */
  flyOut: b(4.3), // 65
  flyAnticip: 3,
  flyStagger: 0.8,
  flyDur: 10,
  /** the six keepers glide + resize into the language grid */
  glide: b(4.3), // 65
  glideStagger: 1,
  /** one language per 8th note */
  langs: Array.from({ length: 6 }, (_, i) => Math.round(SCALE.langMorph + i * SCALE.langStep)),
  /** the AI-disclosure underline inks in under "an AI assistant", while English is live */
  disclose: [SCALE.langMorph + 6, SCALE.langMorph + 11] as const, // 74 → 79
  /** English dims only after its underline is drawn, and only to 84 % */
  englishDim: [SCALE.langMorph + 13, SCALE.langMorph + 23] as const, // 81 → 91
  /** the camera's slow push during the languages, released for the flow */
  push: [b(4), b(7.3), b(7.95)] as const, // 60, 110, 119
  /** "14 languages." leaves → "After the call." rolls in; five cells collapse into the deck; tray → after-call stage */
  titleOut: b(7.3), // 110
  titleAfter: b(7.4), // 111
  collapse: b(7.4), // 111
  collapseStagger: 0.5,
  /** the Japanese cell (complete) flies onto the deck and becomes the call;
   *  the ring lets go of it a frame before */
  carrierFly: b(7.65), // 115
  ringOut: b(7.6), // 114
  /** the dotted track + hollow nodes appear */
  trackIn: b(7.6), // 114
  /** the call card's number types in; its Booked pill pops */
  callIn: b(7.8), // 117
  pill: b(8.2), // 123
  /** station cues (= the flow cues in timing.ts): each node is solid ON its cue */
  stations: [0, 1, 2].map((i) => Math.round(SCALE.flow + i * SCALE.flowStep * 1.5)), // 120, 131, 143
  /** node fills start (the fill spring takes ~2–3 f) */
  fills: [b(7.85), b(8.6), b(9.35)] as const, // 118, 129, 140
  /** station labels / cards rise a beat-fraction before their node fills */
  cardsIn: [b(7.75), b(8.45), b(9.05)] as const, // 116, 127, 136
  /** the CRM's "200 OK" lands (green by 142) */
  ok: b(9.25), // 139
  /** plum fill segments (the bead reaches each node as it fills) */
  rails: [
    [b(8.05), b(8.6)],
    [b(8.75), b(9.35)],
  ] as const, // 121→129, 131→140
  /** the final node's ping ring (2.8×) */
  ping: [b(9.45), b(9.45) + b(1.6)] as const, // 142 → 166
  /** slow push-in of the stage about FLOW_END (zoom 1 → 1.04; the heading stays put) */
  flowPush: [b(8.55), b(10.8)] as const, // 128 → 162
} as const;

/* ── CTA — fine cuts (cta-local frames) ────────────────────────── */
/** the white act ends (Trailer's grain switch) exactly as the iris is fully open */
const CTA_IRIS_END = SCENES.scale.from + SCALE.irisToDark[1] - SCENES.cta.from; // 8
/**
 * the iris waits 3 f after the scale's last cue (irisToDark[0], confirm + whoosh-rev,
 * node solid green) so the green node and the first beat of its ping read before
 * the iris swallows them (integration pass: it used to start 1 f BEFORE the cue)
 */
const CTA_IRIS_START = SCENES.scale.from + SCALE.irisToDark[0] + 3 - SCENES.cta.from; // −4
export const CTA_LOCAL = {
  /** the dark iris opens from FLOW_END over 12 frames, ending with the white act (−4 → 8) */
  iris: [CTA_IRIS_START, CTA_IRIS_END] as const,
  /** the eyes come out of black first (frames) */
  eyes: [0, 7] as const,
  /** radial reveal from the eyes, inside the hero window (4 → 30) */
  reveal: [CTA.robotIn[0] + 4, CTA.robotIn[1]] as const,
  /** the site's liquid entry tear settles onto the figure (frames 0 → 24; liquid 0 → 18) */
  entryTear: [0, 24] as const,
  liquid: [0, 18] as const,
  /** corner marks bracket the line right after its last word (41) */
  marks: b(2.75),
  /** ON the converge downbeat: a first filament burst (45 → 49) … */
  tearKick: [CTA.converge[0], CTA.converge[0] + 4] as const,
  /** … then the tear builds while the figure is erased to the halo (45 → 69) */
  tear: [CTA.converge[0] + 4, CTA.logoImpact - 6] as const,
  erase: [CTA.converge[0], CTA.logoImpact - 6] as const,
  /** words hold until 61, swell for 3 f, leave at 64 + 0.35 f each, 8 f flights (all in by 74.5) */
  collapse: { from: b(4.25), step: 0.35, dur: 8, anticip: 3 },
  /** the corner marks travel in behind the words (66 → 74) */
  marksIn: { from: b(4.25) + 2, dur: 8 },
  /** streaks + motes pour in from the frame edges (45 → 75) */
  streaks: [CTA.converge[0], CTA.logoImpact] as const,
  /** the hook's ring waves, reversed: three rings contract into P (start radius × reach) */
  rings: [1.25, 1.1, 0.95] as const,
  /** the eyes' last light (frames): glows up as they tear (62 → 66), then slides into the core (66 → 71) */
  eyeGlow: [62, 66, 71] as const,
  /** the core gathers (60 → 75) */
  core: [b(4), CTA.logoImpact] as const,
  /** anticipation: everything pulls back (68 → 75) */
  pullBack: [b(4.5), CTA.logoImpact] as const,
  /** impact accents (frames) */
  shake: 6,
  ring: [CTA.logoImpact, CTA.logoImpact + 20] as const,
  /** halo breath starts under the end card */
  breath: CTA.button + 10,
  /** dust clears before the hold */
  dustOut: [b(8), CTA.finalHold] as const,
};

/* ---------------------------------------------------------------- *
 * SOUND — every cue is an absolute frame on the timeline, computed from
 * the scene constants above so picture and sound can't drift apart.
 * `vol` is linear gain on top of the file (each SFX file is normalised to
 * a -12 dBFS peak by the generator; the bed to -20 dBFS).
 * ---------------------------------------------------------------- */
const at = (scene: SceneKey, local: number) => SCENES[scene].from + local;

export type Cue = { at: number; file: string; vol?: number };

const transcriptTicks: Cue[] = CALL.lines.flatMap((line, i) => {
  const chars = line.text.length;
  const frames = Math.ceil(chars / CALL.typeRate);
  // one soft key tick every 2 frames while a line types
  return Array.from({ length: Math.ceil(frames / 2) }, (_, k) => ({
    at: at('call', line.at + k * 2),
    file: `tick-${(i + k) % 4}.wav`,
    vol: 0.55,
  }));
});

const industryTicks: Cue[] = Array.from({ length: 16 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
  file: `tick-${i % 4}.wav`,
  vol: 0.8,
}));

const langPops: Cue[] = Array.from({ length: 6 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.langMorph + i * SCALE.langStep)),
  file: `pop-${i % 3}.wav`,
  vol: 0.75,
}));

const flowPops: Cue[] = Array.from({ length: 3 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.flow + i * SCALE.flowStep * 1.5)),
  file: i === 2 ? 'confirm.wav' : 'click.wav',
}));

export const CUES: Cue[] = [
  // HOOK
  { at: at('hook', HOOK.clockIn), file: 'roll.wav' },
  { at: at('hook', HOOK.clockLand), file: 'land.wav' },
  { at: at('hook', HOOK.ring), file: 'ring.wav' },
  { at: at('hook', HOOK.textIn), file: 'whoosh-soft.wav', vol: 0.8 },
  { at: at('hook', HOOK.anticipation) - 6, file: 'riser-short.wav' },
  // TWIST
  { at: at('twist', TWIST.shatter), file: 'shatter.wav' },
  { at: at('twist', TWIST.reassemble[0]), file: 'whoosh-rev.wav', vol: 0.8 },
  { at: at('twist', TWIST.doorSlam), file: 'door.wav' },
  { at: at('twist', TWIST.closedSign), file: 'click.wav', vol: 0.7 },
  { at: at('twist', TWIST.line2), file: 'whoosh-soft.wav', vol: 0.7 },
  { at: at('twist', TWIST.phoneOn), file: 'power-on.wav' },
  { at: at('twist', TWIST.pushToPhone[0]), file: 'whoosh.wav' },
  { at: at('twist', TWIST.ring2), file: 'ring.wav' },
  // CALL
  { at: at('call', CALL.pickup), file: 'pickup.wav' },
  ...transcriptTicks,
  { at: at('call', CALL.lines[2].at + CALL.slotPops[0]), file: 'pop-0.wav', vol: 0.8 },
  { at: at('call', CALL.lines[2].at + CALL.slotPops[1]), file: 'pop-1.wav', vol: 0.8 },
  { at: at('call', CALL.slotPick), file: 'click.wav' },
  { at: at('call', CALL.bookedMark), file: 'shimmer.wav', vol: 0.8 },
  // RESULT
  { at: at('result', RESULT.fly) - 4, file: 'whoosh.wav' },
  { at: at('result', RESULT.land), file: 'ding.wav' },
  { at: at('result', RESULT.land), file: 'pop-2.wav', vol: 0.9 },
  { at: at('result', RESULT.split), file: 'whoosh-soft.wav', vol: 0.7 },
  { at: at('result', RESULT.bookedWord), file: 'pop-0.wav', vol: 0.8 },
  { at: at('result', RESULT.toWhite[0]), file: 'riser-short.wav' },
  // SCALE
  { at: at('scale', 0), file: 'hit.wav' },
  ...industryTicks,
  { at: at('scale', SCALE.langMorph) - 3, file: 'whoosh-soft.wav', vol: 0.8 },
  ...langPops,
  { at: at('scale', SCALE.flow) - 3, file: 'whoosh.wav', vol: 0.8 },
  ...flowPops,
  { at: at('scale', SCALE.irisToDark[0]), file: 'whoosh-rev.wav' },
  // CTA
  { at: at('cta', 0), file: 'sub.wav' },
  { at: at('cta', CTA.line), file: 'whoosh-soft.wav', vol: 0.7 },
  { at: at('cta', CTA.converge[0]), file: 'riser.wav' },
  { at: at('cta', CTA.logoImpact), file: 'impact.wav' },
  { at: at('cta', CTA.button), file: 'pop-1.wav' },
  { at: at('cta', CTA.url), file: 'tick-2.wav' },
  { at: at('cta', CTA.press), file: 'click.wav' },
];

/** The ambient bed (pad + beat), one file covering the whole 30 s. */
export const BED = { file: 'bed.wav', vol: 1 };
