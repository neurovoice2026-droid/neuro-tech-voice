/**
 * EVERY timing constant in the trailer lives in this file.
 *
 * The film is cut on a 120 BPM grid: one beat = 0.5 s = 15 frames at 30 fps.
 * All values are written in beats with `b()` and converted to frames, so
 * retiming a moment is a one-number change here; the pictures, the sound
 * effects, the voices and the music bed (see CUES / VOICES / BED at the
 * bottom, and scripts/generate-sfx.mjs) all read these same constants.
 *
 * Spoken lines come from src/voice.generated.ts (scripts/generate-voice.mjs):
 * the call is timed by the real voice — each line starts on the grid and
 * lasts exactly as long as it is spoken; captions start on spoken words.
 *
 * Scene values are LOCAL to the scene (0 = the scene's own start), except
 * SCENES itself and CUES, which are absolute timeline frames.
 */
import { VOICE, type VoiceId } from './voice.generated.ts';

export const FPS = 30;
export const BPM = 120;
/** Frames per beat (15 at 120 BPM / 30 fps). */
export const BEAT = (60 / BPM) * FPS;
/** Beats → frames (rounded to the nearest frame). */
export const b = (beats: number) => Math.round(beats * BEAT);

export const TOTAL_BEATS = 106;
export const DURATION = b(TOTAL_BEATS); // 1590 frames = 53 s

export const LANDSCAPE = { width: 1920, height: 1080 } as const;
export const VERTICAL = { width: 1080, height: 1920 } as const;

/* ── voices ─────────────────────────────────────────────────────── */
/** Frames a spoken line lasts. */
export const vFrames = (id: VoiceId) => VOICE.lines[id].frames;
/** Frame offset (from the line's start) at which spoken word `k` begins. */
export const vWord = (id: VoiceId, k: number) => Math.round(VOICE.lines[id].words[k].t * FPS);
/** A caption: shown from spoken word `word` of its line. */
export type Caption = { text: string; word: number };

/**
 * Scene windows on the absolute timeline. `pre`/`post` are the frames a
 * scene stays mounted before/after its window, for the match cuts where two
 * scenes share a shape.
 */
export const SCENES = {
  hook: { from: b(0), to: b(8), pre: 0, post: 6 }, //         0–4 s
  twist: { from: b(8), to: b(16), pre: 8, post: 12 }, //        4–8 s
  call: { from: b(16), to: b(53), pre: 12, post: 20 }, //      8–26.5 s
  result: { from: b(53), to: b(63), pre: 14, post: 10 }, //  26.5–31.5 s
  knowledge: { from: b(63), to: b(78), pre: 6, post: 8 }, //  31.5–39 s
  scale: { from: b(78), to: b(88), pre: 6, post: 12 }, //      39–44 s
  cta: { from: b(88), to: b(106), pre: 12, post: 0 }, //       44–53 s
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
 * 8–26.5 s · CALL — picked up on the first ring; the booking, spoken.
 * Each line starts on a half-beat and lasts exactly as long as its voice.
 * ---------------------------------------------------------------- */
type CallLine = {
  at: number;
  who: 'agent' | 'caller';
  voice: VoiceId;
  /** the whole line as the caption shows it (24 h times, as on the site) */
  text: string;
  /** caption chunks (≤ 7 words), each starting on a spoken word */
  captions: readonly Caption[];
};
const CALL_LINES: readonly CallLine[] = [
  {
    at: b(1.5),
    who: 'agent',
    voice: 'call-1',
    text: 'Thank you for calling Northside Studio. This is Ava, an AI assistant. How can I help you today?',
    captions: [
      { text: 'Thank you for calling Northside Studio.', word: 0 },
      { text: 'This is Ava, an AI assistant.', word: 6 },
      { text: 'How can I help you today?', word: 12 },
    ],
  },
  {
    at: b(12.5),
    who: 'caller',
    voice: 'call-2',
    text: 'Hi! Could I come in on Wednesday afternoon?',
    captions: [
      { text: 'Hi!', word: 0 },
      { text: 'Could I come in on Wednesday afternoon?', word: 1 },
    ],
  },
  {
    at: b(18.5),
    who: 'agent',
    voice: 'call-3',
    text: 'Of course. I have 15:00 or 16:30. Which suits you better?',
    captions: [
      { text: 'Of course.', word: 0 },
      { text: 'I have 15:00 or 16:30.', word: 2 },
      { text: 'Which suits you better?', word: 9 },
    ],
  },
  {
    at: b(27),
    who: 'caller',
    voice: 'call-4',
    text: "Three o'clock is perfect.",
    captions: [{ text: "Three o'clock is perfect.", word: 0 }],
  },
  {
    at: b(30.5),
    who: 'agent',
    voice: 'call-5',
    text: "Lovely. You're booked for Wednesday at 15:00.",
    captions: [
      { text: 'Lovely.', word: 0 },
      { text: "You're booked for Wednesday at 15:00.", word: 1 },
    ],
  },
];
export const CALL = {
  pickup: 0,
  pickedUpText: [0, b(2)] as const, // big kinetic line, then it shrinks into the phase label
  /** captions reveal word by word with the voice; this is the fallback typing speed */
  typeRate: 1.6,
  lines: CALL_LINES,
  /** Slot chips pop as Ava says "three p.m." / "four thirty" (frames after line 3 starts). */
  slotPops: [vWord('call-3', 4), vWord('call-3', 7)] as const,
  /** The caller's pick ("Three o'clock…") selects the 15:00 chip. */
  slotPick: b(27) + vWord('call-4', 1),
  /** "Wednesday at 15:00" ignites ember as Ava says "three p.m." (0.42 s ease). */
  bookedMark: b(30.5) + vWord('call-5', 6),
};

/* ---------------------------------------------------------------- *
 * 26.5–31.5 s · RESULT — the booking flies into the calendar.
 * Split: owner "Asleep." / calendar "Booked."
 * ---------------------------------------------------------------- */
export const RESULT = {
  lift: 0, // "Wednesday at 15:00" lifts off the transcript and becomes the card
  calendarIn: b(0.5),
  fly: b(1), // card leaves on its arc…
  land: b(2), // …and lands in the slot (ding)
  split: b(3), // split divider draws; "Asleep." lands
  bookedWord: b(4), // "Booked." lands
  toWhite: [b(9), b(10)] as const, // the booked event opens up into the white act
};

/* ---------------------------------------------------------------- *
 * 31.5–39 s · KNOWLEDGE — a second caller asks what isn't written down;
 * Ava searches the owner's documents and, honestly, doesn't guess.
 * (The site's #knowledge stage, on the white stock.)
 * ---------------------------------------------------------------- */
export const KNOWLEDGE = {
  heading: b(0.25), // "Answers from your documents."
  docsIn: b(0.75), // five document tiles pop…
  docStep: BEAT / 4, // …one per 16th note
  ask: b(2), // caller 2: "Do you do home visits?"
  askVoice: 'kb-1' as VoiceId,
  scan: [b(3.25), b(5)] as const, // beams + match bars; nothing reaches the 60 % threshold
  miss: b(5), // "Not in the documents" — the orb greys
  answer: b(5.5), // Ava's honest fallback
  answerVoice: 'kb-2' as VoiceId,
  answerCaptions: [
    { text: "I don't have an answer for that,", word: 0 },
    { text: "and I don't want to guess.", word: 7 },
    { text: "I'll ask the team", word: 13 },
    { text: 'to call you back today.', word: 17 },
  ] as readonly Caption[],
  out: [b(14), b(15)] as const, // the tiles hand over to the industry wall
};

/* ---------------------------------------------------------------- *
 * 39–44 s · SCALE — 16 industries on 16th notes, Ava in six languages,
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
 * 44–53 s · CTA — Ava's voice-over; everything converges into the logo.
 * ---------------------------------------------------------------- */
export const CTA = {
  robotIn: [0, b(2)] as const,
  line: b(1), // "AI voice agents that book your customers 24/7." — spoken by Ava
  lineVoice: 'cta-1' as VoiceId,
  /** headline word i rises on spoken word lineWords[i] ("24/7." on "Twenty") */
  lineWords: [0, 1, 2, 3, 4, 5, 6, 7] as const,
  wordStagger: 3, // fallback stagger
  converge: [b(10), b(12)] as const,
  logoImpact: b(12), // on a bar downbeat (global beat 100)
  brandVoice: b(12) + 4, // Ava: "Neuro Tech Voice."
  brandVoiceId: 'cta-2' as VoiceId,
  button: b(13),
  note: b(13.5),
  url: b(14),
  press: b(14.5), // the button takes the site's hover (plum) as if clicked
  finalHold: b(15), // from here to the end (1.5 s) nothing moves but grain
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
  /** the AI-disclosure underline draws as Ava finishes saying "an AI assistant" */
  disclose: CALL.lines[0].at + vWord('call-1', 12) - 4,
  /** the stage's floor (owner / call-log row) draws in */
  ownerIn: b(3), // 45
  /** status + phase label dim to .58 so the transcript is the single read */
  dim: [b(3.5), b(4.5)] as const, // 53 → 68
  /** camera drift settles to rest before the mark is handed over */
  camSettle: [b(33), b(36)] as const,
  /** the payoff beat: the mark presses (3 f) and springs back — exactly 1 again by markHide − 1 */
  payoff: CALL.bookedMark + 1,
  /** once Ava has finished speaking, everything but the mark recedes */
  exit: [b(36.1), b(38.2)] as const, // scale, rack focus (into the result's pre-roll)
  exitFade: [b(36.1), b(38.2) - 2] as const, // opacity, front-loaded
  /** the result scene draws the mark from here (= the call's end) */
  markHide: b(37),
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
  /** corner marks bracket the line right after its last spoken word ("seven") */
  marks: CTA.line + vWord('cta-1', 9) + 6,
  /** ON the converge downbeat: a first filament burst (45 → 49) … */
  tearKick: [CTA.converge[0], CTA.converge[0] + 4] as const,
  /** … then the tear builds while the figure is erased to the halo (45 → 69) */
  tear: [CTA.converge[0] + 4, CTA.logoImpact - 6] as const,
  erase: [CTA.converge[0], CTA.logoImpact - 6] as const,
  /** words hold, swell for 3 f, leave 19 f into the converge at 0.35 f each, 8 f flights */
  collapse: { from: CTA.converge[0] + 19, step: 0.35, dur: 8, anticip: 3 },
  /** the corner marks travel in behind the words */
  marksIn: { from: CTA.converge[0] + 21, dur: 8 },
  /** streaks + motes pour in from the frame edges (45 → 75) */
  streaks: [CTA.converge[0], CTA.logoImpact] as const,
  /** the hook's ring waves, reversed: three rings contract into P (start radius × reach) */
  rings: [1.25, 1.1, 0.95] as const,
  /** the eyes' last light: glows up as they tear, then slides into the core */
  eyeGlow: [CTA.converge[0] + 17, CTA.converge[0] + 21, CTA.converge[0] + 26] as const,
  /** the core gathers */
  core: [CTA.converge[0] + 15, CTA.logoImpact] as const,
  /** anticipation: everything pulls back */
  pullBack: [CTA.converge[0] + 23, CTA.logoImpact] as const,
  /** impact accents (frames) */
  shake: 6,
  ring: [CTA.logoImpact, CTA.logoImpact + 20] as const,
  /** halo breath starts under the end card */
  breath: CTA.button + 10,
  /** dust clears before the hold */
  dustOut: [CTA.finalHold - 15, CTA.finalHold] as const,
};

/* ── KNOWLEDGE — fine cuts (knowledge-local frames) ────────────── */
export const KNOWLEDGE_LOCAL = {
  /** the white bloom from the result settles into the stage */
  stageIn: [0, b(0.75)] as const,
};

/* ---------------------------------------------------------------- *
 * SOUND — every cue is an absolute frame on the timeline, computed from
 * the scene constants above so picture and sound can't drift apart.
 * `file` is relative to public/. `vol` is linear gain on top of the file:
 * SFX files are normalised to a -12 dBFS peak, the bed to -20 dBFS, the
 * voices to -5 dBFS (dialogue leads the mix; the bed ducks under it).
 * ---------------------------------------------------------------- */
const at = (scene: SceneKey, local: number) => SCENES[scene].from + local;
const sfx = (name: string) => `sfx/${name}`;

export type Cue = { at: number; file: string; vol?: number };

/** Every spoken line on the absolute timeline. */
export const VOICES: { at: number; id: VoiceId }[] = [
  ...CALL.lines.map((l) => ({ at: at('call', l.at), id: l.voice })),
  { at: at('knowledge', KNOWLEDGE.ask), id: KNOWLEDGE.askVoice },
  { at: at('knowledge', KNOWLEDGE.answer), id: KNOWLEDGE.answerVoice },
  { at: at('cta', CTA.line), id: CTA.lineVoice },
  { at: at('cta', CTA.brandVoice), id: CTA.brandVoiceId },
];

/** Speech windows (absolute frames) — the bed ducks under these. */
export const SPEECH = VOICES.map((v) => [v.at, v.at + vFrames(v.id)] as const);
/** Bed ducking: gain while speech plays (-7 dB), and the ramp in frames. */
export const DUCK = { gain: 0.45, ramp: 6 };

const industryTicks: Cue[] = Array.from({ length: 16 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
  file: sfx(`tick-${i % 4}.wav`),
  vol: 0.8,
}));

const langPops: Cue[] = Array.from({ length: 6 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.langMorph + i * SCALE.langStep)),
  file: sfx(`pop-${i % 3}.wav`),
  vol: 0.75,
}));

const flowPops: Cue[] = Array.from({ length: 3 }, (_, i) => ({
  at: at('scale', Math.round(SCALE.flow + i * SCALE.flowStep * 1.5)),
  file: sfx(i === 2 ? 'confirm.wav' : 'click.wav'),
}));

const docTicks: Cue[] = Array.from({ length: 5 }, (_, i) => ({
  at: at('knowledge', Math.round(KNOWLEDGE.docsIn + i * KNOWLEDGE.docStep)),
  file: sfx(`tick-${(i + 1) % 4}.wav`),
  vol: 0.7,
}));

export const CUES: Cue[] = [
  // HOOK
  { at: at('hook', HOOK.clockIn), file: sfx('roll.wav') },
  { at: at('hook', HOOK.clockLand), file: sfx('land.wav') },
  { at: at('hook', HOOK.ring), file: sfx('ring.wav') },
  { at: at('hook', HOOK.textIn), file: sfx('whoosh-soft.wav'), vol: 0.8 },
  { at: at('hook', HOOK.anticipation) - 6, file: sfx('riser-short.wav') },
  // TWIST
  { at: at('twist', TWIST.shatter), file: sfx('shatter.wav') },
  { at: at('twist', TWIST.reassemble[0]), file: sfx('whoosh-rev.wav'), vol: 0.8 },
  { at: at('twist', TWIST.doorSlam), file: sfx('door.wav') },
  { at: at('twist', TWIST.closedSign), file: sfx('click.wav'), vol: 0.7 },
  { at: at('twist', TWIST.line2), file: sfx('whoosh-soft.wav'), vol: 0.7 },
  { at: at('twist', TWIST.phoneOn), file: sfx('power-on.wav') },
  { at: at('twist', TWIST.pushToPhone[0]), file: sfx('whoosh.wav') },
  { at: at('twist', TWIST.ring2), file: sfx('ring.wav') },
  // CALL (the voices themselves are in VOICES)
  { at: at('call', CALL.pickup), file: sfx('pickup.wav') },
  { at: at('call', CALL.lines[2].at + CALL.slotPops[0]), file: sfx('pop-0.wav'), vol: 0.6 },
  { at: at('call', CALL.lines[2].at + CALL.slotPops[1]), file: sfx('pop-1.wav'), vol: 0.6 },
  { at: at('call', CALL.slotPick), file: sfx('click.wav'), vol: 0.8 },
  { at: at('call', CALL.bookedMark), file: sfx('shimmer.wav'), vol: 0.7 },
  // RESULT
  { at: at('result', RESULT.fly) - 4, file: sfx('whoosh.wav') },
  { at: at('result', RESULT.land), file: sfx('ding.wav') },
  { at: at('result', RESULT.land), file: sfx('pop-2.wav'), vol: 0.9 },
  { at: at('result', RESULT.split), file: sfx('whoosh-soft.wav'), vol: 0.7 },
  { at: at('result', RESULT.bookedWord), file: sfx('pop-0.wav'), vol: 0.8 },
  { at: at('result', RESULT.toWhite[0]), file: sfx('riser-short.wav') },
  // KNOWLEDGE (the white act begins)
  { at: at('knowledge', 0), file: sfx('hit.wav') },
  { at: at('knowledge', KNOWLEDGE.heading), file: sfx('whoosh-soft.wav'), vol: 0.6 },
  ...docTicks,
  { at: at('knowledge', KNOWLEDGE.scan[0]), file: sfx('whoosh-soft.wav'), vol: 0.55 },
  { at: at('knowledge', KNOWLEDGE.miss), file: sfx('land.wav'), vol: 0.6 },
  { at: at('knowledge', KNOWLEDGE.out[0]), file: sfx('whoosh.wav'), vol: 0.7 },
  // SCALE
  { at: at('scale', 0), file: sfx('pop-2.wav') },
  ...industryTicks,
  { at: at('scale', SCALE.langMorph) - 3, file: sfx('whoosh-soft.wav'), vol: 0.8 },
  ...langPops,
  { at: at('scale', SCALE.flow) - 3, file: sfx('whoosh.wav'), vol: 0.8 },
  ...flowPops,
  { at: at('scale', SCALE.irisToDark[0]), file: sfx('whoosh-rev.wav') },
  // CTA
  { at: at('cta', 0), file: sfx('sub.wav') },
  { at: at('cta', CTA.converge[0]), file: sfx('riser.wav') },
  { at: at('cta', CTA.logoImpact), file: sfx('impact.wav') },
  { at: at('cta', CTA.button), file: sfx('pop-1.wav') },
  { at: at('cta', CTA.url), file: sfx('tick-2.wav') },
  { at: at('cta', CTA.press), file: sfx('click.wav') },
];

/** The ambient bed (pad + beat), synthesised to the full length by generate-sfx.mjs. */
export const BED = { file: sfx('bed.wav'), vol: 1 };
