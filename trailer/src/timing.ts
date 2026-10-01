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


export const LANDSCAPE = { width: 1920, height: 1080 } as const;
export const VERTICAL = { width: 1080, height: 1920 } as const;

/* ── voices ─────────────────────────────────────────────────────── */
/** Frames a spoken line lasts. */
export const vFrames = (id: VoiceId) => VOICE.lines[id].frames;
/** Frame offset (from the line's start) at which spoken word `k` begins. */
export const vWord = (id: VoiceId, k: number) => Math.round(VOICE.lines[id].words[k].t * FPS);
/** A caption: shown from spoken word `word` of its line. Caption word j is
 *  revealed on spoken word `map[j]` (when the caption's words differ from the
 *  spoken ones, e.g. "15:00" on "three"), else on spoken word `word + j`. */
export type Caption = { text: string; word: number; map?: readonly number[] };
/** Snap a frame count UP to the next half-beat / whole beat / bar (so turns land on the grid). */
const upHalf = (f: number) => Math.round(Math.ceil(f / (BEAT / 2) - 1e-9) * (BEAT / 2));
const upBeat = (f: number) => Math.round(Math.ceil(f / BEAT - 1e-9) * BEAT);
const upQuarter = (f: number) => Math.round(Math.ceil(f / (BEAT / 4) - 1e-9) * (BEAT / 4));
/** Minimum silence between two speakers (frames): a real phone turn is ~0.2–0.3 s. */
const TURN_GAP = 6;

/* ── the voiced timeline, derived from the real voice lengths ──────
 * Swap the voices (npm run voice) and every turn, scene window and the
 * total length re-time themselves; the logo still lands on a strong beat. */
const CALL_AT: number[] = [];
{
  const ids: VoiceId[] = ['call-1', 'call-2', 'call-3', 'call-4', 'call-5'];
  let t = b(2.5); // Ava answers ~1.25 s after the pickup ("Picked up on the first ring." reads first)
  for (const id of ids) {
    CALL_AT.push(t);
    t = upQuarter(t + vFrames(id) + TURN_GAP); // turns land on the 16th-note grid
  }
}
/** The call cuts a beat after "…at 3 PM" lights the booked mark; Ava's sign-off
 *  ("See you then!") rides over the cut into the result (an L-cut). */
const CALL_LEN = Math.min(
  upBeat(CALL_AT[4] + vFrames('call-5') + 10),
  upBeat(CALL_AT[4] + vWord('call-5', 6) + b(2)),
);
const RESULT_LEN = b(8);
/** Knowledge: the question, a scan, the honest answer, then the closing title. */
const KB_ASK = b(1.5); // the heading has been up ~0.6 s; the caption itself waits for "Do you…"
const KB_SCAN0 = upHalf(KB_ASK + Math.round(vFrames('kb-1') * 0.6));
const KB_MISS = KB_SCAN0 + b(1.5);
/* (a longer regenerated kb-1 must still leave its caption ≥ 15 f on screen after the last word) */
const KB_ANSWER = Math.max(KB_MISS + 7, KB_ASK + vFrames('kb-1') + 19);
const KB_CLOSE = upHalf(KB_ANSWER + vFrames('kb-2') + 10); // the last caption gets a beat before the closing takes the frame
const SCALE_LEN = b(10);
/** The knowledge closing title holds 3 beats before its 1-beat whip. */
const KB_BASE = upBeat(KB_CLOSE + b(4));
/** CTA: Ava's line; the four orbs converge right after her last word ("…seven")
 *  and the logo lands on a strong beat (1 or 3 of the bar). */
const CTA_LINE = b(1);
const CTA_LAST_WORD = CTA_LINE + vWord('cta-1', VOICE.lines['cta-1'].words.length - 1);
/** Put the impact on a strong beat: start the converge one beat earlier if that
 *  still starts on/after the last word, else give the knowledge hold one beat. */
const [CTA_CONVERGE0, KNOWLEDGE_LEN] = (() => {
  const c = Math.max(b(8), upBeat(CTA_LAST_WORD + 12));
  const ctaFrom = b(8) + b(8) + CALL_LEN + RESULT_LEN + KB_BASE + SCALE_LEN;
  const half = 2 * BEAT;
  const off = (ctaFrom + c + b(2)) % half; // 0 or 1 beat: everything sits on the beat grid
  if (!off) return [c, KB_BASE];
  if (c - off >= Math.max(b(8), CTA_LAST_WORD)) return [c - off, KB_BASE];
  return [c, KB_BASE + (half - off)];
})();
const CTA_IMPACT = CTA_CONVERGE0 + b(2);
/** The still end card starts when Ava's "Neuro Tech Voice." ends (≥ 3 beats after the impact). */
const CTA_HOLD = CTA_IMPACT + Math.max(b(3), upHalf(4 + vFrames('cta-2')));
const CTA_LEN = CTA_HOLD + b(3); // 1.5 s final hold

/**
 * Scene windows on the absolute timeline. `pre`/`post` are the frames a
 * scene stays mounted before/after its window, for the match cuts where two
 * scenes share a shape.
 */
export const SCENES = (() => {
  const w = (from: number, len: number, pre: number, post: number) => ({ from, to: from + len, pre, post });
  const hook = w(0, b(8), 0, 6); //                       0–4 s
  const twist = w(hook.to, b(8), 8, 12); //               4–8 s
  const call = w(twist.to, CALL_LEN, 12, 20); //          8 s → (voice)
  const result = w(call.to, RESULT_LEN, 14, 10);
  const knowledge = w(result.to, KNOWLEDGE_LEN, 6, 8);
  const scale = w(knowledge.to, SCALE_LEN, 6, 12);
  const cta = w(scale.to, CTA_LEN, 12, 0);
  return { hook, twist, call, result, knowledge, scale, cta } as const;
})();
/** Total length in frames (≈ 53–56 s, set by the voices) and in beats. */
export const DURATION = SCENES.cta.to;
export const TOTAL_BEATS = DURATION / BEAT;
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
 * CALL (from 8 s, ≈ 18 s) — picked up on the first ring; the booking, spoken.
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
    at: CALL_AT[0],
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
    at: CALL_AT[1],
    who: 'caller',
    voice: 'call-2',
    text: 'Hi! Could I come in on Wednesday afternoon?',
    captions: [
      { text: 'Hi!', word: 0 },
      { text: 'Could I come in on Wednesday afternoon?', word: 1 },
    ],
  },
  {
    at: CALL_AT[2],
    who: 'agent',
    voice: 'call-3',
    text: 'Of course! I have 15:00 or 16:30. Which one suits you better?',
    captions: [
      { text: 'Of course!', word: 0 },
      // "15:00" is revealed on spoken "3 PM", "16:30" on "4:30"
      { text: 'I have 15:00 or 16:30.', word: 2, map: [2, 3, 4, 6, 7] },
      { text: 'Which one suits you better?', word: 8 },
    ],
  },
  {
    at: CALL_AT[3],
    who: 'caller',
    voice: 'call-4',
    text: "Three o'clock is perfect.",
    captions: [{ text: "Three o'clock is perfect.", word: 0 }],
  },
  {
    at: CALL_AT[4],
    who: 'agent',
    voice: 'call-5',
    text: "Lovely! You're booked for Wednesday at 15:00.",
    captions: [
      { text: 'Lovely!', word: 0 },
      { text: "You're booked for Wednesday at 15:00.", word: 1 },
    ],
  },
];
export const CALL = {
  pickup: 0,
  /** "Picked up on the first ring." — the big kinetic line, until the orb swallows it and Ava speaks */
  pickedUpText: [0, CALL_AT[0]] as const,
  lines: CALL_LINES,
  /** Slot chips pop as Ava says "3 PM" / "4:30" (frames after line 3 starts). */
  slotPops: [vWord('call-3', 4), vWord('call-3', 7)] as const,
  /** The caller's pick ("Three o'clock…") selects the 15:00 chip. */
  slotPick: CALL_AT[3] + vWord('call-4', 1),
  /** "Wednesday at 15:00" ignites ember as Ava says "3 PM" (0.42 s ease). */
  bookedMark: CALL_AT[4] + vWord('call-5', 6),
  /** the call's own length (= the result's start) */
  length: CALL_LEN,
};

/* ---------------------------------------------------------------- *
 * RESULT (5 s) — the booking flies into the calendar.
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
 * KNOWLEDGE (≈ 9 s) — a second caller asks what isn't written down;
 * Ava searches the owner's documents and, honestly, doesn't guess.
 * (The site's #knowledge stage, on the white stock.)
 * ---------------------------------------------------------------- */
export const KNOWLEDGE = {
  heading: b(0.25), // "Answers from your own documents."
  docsIn: b(0.75), // five document tiles pop…
  docStep: BEAT / 4, // …one per 16th note
  ask: KB_ASK, // caller 2: "Do you do home visits?"
  askVoice: 'kb-1' as VoiceId,
  scan: [KB_SCAN0, KB_MISS] as const, // beams + match bars; nothing reaches the 60 % threshold
  miss: KB_MISS, // "Not in the documents" — the orb greys
  answer: KB_ANSWER, // Ava's honest fallback
  answerVoice: 'kb-2' as VoiceId,
  answerCaptions: [
    { text: "I don't have an answer for that,", word: 0 },
    { text: "and I don't want to guess.", word: 7 },
    { text: "I'll ask the team", word: 13 },
    { text: 'to call you back today.', word: 17 },
  ] as readonly Caption[],
  /** "Where your documents stop, it says so." — the closing title */
  closing: KB_CLOSE,
  out: [KNOWLEDGE_LEN - b(1), KNOWLEDGE_LEN] as const, // a whip to clean white; the industry wall takes over
};

/* ---------------------------------------------------------------- *
 * SCALE (5 s) — 16 industries on 16th notes, Ava in six languages,
 * then a flash of the after-call flow.
 * ---------------------------------------------------------------- */
export const SCALE = {
  industryStep: BEAT / 4, // one industry per 16th note (3.75 f)
  industriesIn: 0,
  gridSettle: b(4), // every card snaps to its rect…
  industriesTitle: b(4), // …as "16 industries." slams: the downbeat the 16-pop run resolves on (hit.wav)
  langMorph: b(5), // the six keepers flip to their languages…
  langStep: BEAT / 4, // …one per 16th note (75 / 79 / 83 / 86 / 90 / 94)
  flow: b(8), // call → Slack → CRM
  stationStep: BEAT / 2, // one station per 8th note (120 / 128 / 135)
  irisToDark: [b(9.5), b(10) + 8] as const,
};

/* ---------------------------------------------------------------- *
 * CTA (≈ 9 s) — Ava's voice-over; everything converges into the logo.
 * ---------------------------------------------------------------- */
export const CTA = {
  robotIn: [0, b(2)] as const,
  line: CTA_LINE, // "AI voice agents that book your customers 24/7." — spoken by Ava
  lineVoice: 'cta-1' as VoiceId,
  /** headline word i rises on spoken word lineWords[i] ("24/7." on "Twenty") */
  lineWords: [0, 1, 2, 3, 4, 5, 6, 7] as const,
  wordStagger: 3, // fallback stagger
  converge: [CTA_CONVERGE0, CTA_IMPACT] as const,
  logoImpact: CTA_IMPACT, // always on a strong beat (1 or 3) of the music
  brandVoice: CTA_IMPACT + 4, // Ava: "Neuro Tech Voice."
  brandVoiceId: 'cta-2' as VoiceId,
  button: CTA_IMPACT + b(1),
  note: CTA_IMPACT + b(1.5),
  url: CTA_IMPACT + b(2),
  press: CTA_IMPACT + b(2.5), // the button takes the site's hover (plum) as if clicked
  finalHold: CTA_HOLD, // from here to the end (1.5 s) nothing moves but grain
};

/* Captions are timed by the spoken words, so a regenerated voice whose `say`
 * text drifted from the captions must fail loudly, not silently mis-time. */
{
  const norm = (w: string) => w.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '');
  const check = (id: VoiceId, caps: readonly Caption[]) => {
    const words = VOICE.lines[id].words;
    for (const c of caps) {
      const n = c.text.split(' ').length;
      const idx = c.map ?? Array.from({ length: n }, (_, j) => c.word + j);
      const ok =
        c.word < words.length &&
        idx.length === n &&
        idx.every((k) => k < words.length) &&
        (c.map !== undefined || norm(c.text.split(' ')[0]) === norm(words[c.word].w));
      if (!ok) throw new Error(`caption drift in ${id}`);
    }
  };
  for (const l of CALL.lines) check(l.voice, l.captions);
  check(KNOWLEDGE.answerVoice, KNOWLEDGE.answerCaptions);
}

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
  orbIn: b(0.25), // 4  — the colon orb lights, alone in the black (in the RUSH light)
  figuresIn: b(0.5), // 8  — "17 ◉ 05" unfolds out of the orb in the rush light (= moments[0])
  digitStagger: 2, // (v1 roll) frames between the four strips leaving
  /** THE FOUR LIGHTS: the clock flicks through the site's four moments on 8th notes, each a hard
   *  light change (colon orb, figures, bloom, day drum). Each value is the frame the new figures
   *  LAND (a tick + a light chime; the last is the click + thump on the strong beat).
   *  rush 17:05 · closing 20:10 · sunday 10:12 · night 03:12 (home.server.ts) */
  moments: [b(0.5), HOOK.clockIn, b(1.5), HOOK.clockLand] as const, // 8 15 23 30
  /** frames a flick's strips travel (power3.inOut, a full turn + the difference, as on the site);
   *  each strip winds back for 2 f before it leaves */
  flickTravel: 3,
  /** the four strips leave left → right this many frames apart; they all land together on the hit */
  flickStagger: 0.4,
  /** the orb/bloom light change starts this many frames before the landing (done on the hit) */
  lightLead: 2,
  /** the day drum's first row ("MID-RUSH") lands a 16th after the figures unfold (follow-through) */
  drumIn: b(0.5) + 2, // 10
  /** after the land, a light sweep crosses the four figures left → right (≈ 11 f each) */
  sheen: HOOK.clockLand + 1, // 31
  /** Every ring attack leaves this many frames before its beat, so the beat frame is the peak. */
  ringLead: 1,
  ringB: b(3) + 7, // 52 — second ring of the burst
  waveIn: b(2.5), // 38 — the dotted wave row draws out from the centre
  freezeEase: 3, // frames for world time to stop
  frozenRate: 0.12, // world speed once frozen (the hanging rings and motes creep visibly)
  /** the line has settled: the slow push turns into an accelerating inhale into the break */
  pushTurn: HOOK.textIn + 16, // 76
  /** the frozen world breathes ON these beats: orb +3 %, rings +2 % / brighter, wave ±20 %, the line's glow */
  breathBeats: [b(6), b(7)] as const, // 90 105
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
  /** a glint crosses the CLOSED sign as it settles */
  signGlint: [TWIST.closedSign + 3, TWIST.closedSign + 13] as const,
  /** sound hook: "Closed" seats (its first letter: closedSlide + 0.8 × its 11-frame slide) */
  closedLand: 4 + 0.8 * 11,
  /** the avatar orb pops onto the lit screen (SPRING.pop) */
  avatarPop: TWIST.phoneOn + 3,
  /** the focus beat of the tagline hold: "Closed is for the door," recedes to 45 %,
   *  "not the phone." brightens + swells 1 → 1.03 (on the beat, before the dive at b6) */
  keyFocus: [b(5), b(5) + 8] as const,
  /** …with a glint of light sweeping "not the phone." left → right */
  keyGlint: [b(5), b(5) + 12] as const,
  /** the orb's rim light + outer glow come up as the screen fills the frame */
  orbDress: [TWIST.pushToPhone[0] + 16, TWIST.pushToPhone[0] + 24] as const,
  /** the avatar's size locks to CALL_ORB_START (the call draws the same orb from roomIn) */
  orbLock: [TWIST.pushToPhone[1] - 8, TWIST.pushToPhone[1] - 4] as const,
  /** one breath (±2 %, 2-beat sine) before the pickup squash starts (PICKUP − 6) */
  breath: [b(7), TWIST.pushToPhone[1] - 6] as const,
  /** a faint third ring leaves the avatar (1× → 2.6×) on the beat */
  ring3: [b(7), b(7) + 8] as const,
  /** two bokeh planes over the screen (0.5× / 1.5× the dive's zoom) */
  bokeh: [TWIST.pushToPhone[0] + 10, TWIST.pushToPhone[1] + 12] as const,
};

/* ── CALL — fine cuts (call-local frames) ──────────────────────── */
/** the orb swallows the big line 1 f before Ava's first word… */
const CALL_SWALLOW = CALL_AT[0] - 1;
/** …after a 6-frame dive (the line gathers 3 f before it) */
const CALL_DIVE = 6;
const CALL_LIFT = CALL_SWALLOW - CALL_DIVE;
/** "This is Ava" — the establishing shot pushes into Ava's close-up */
const CALL_S2 = CALL.lines[0].at + vWord('call-1', 6);
export const CALL_LOCAL = {
  /** the night room fades in over the twist's (identical) phone screen */
  roomIn: [-4, 0] as const,
  /** the zoomed room (the phone screen) pulls back to the whole stage */
  roomOpen: [2, b(2.6)] as const,
  /** the orb leaves the centre for the lockup (spring) */
  glide: 4,
  /** the figure pairs spring OUT of the orb right after the gulp (never while the hero line lands) */
  unfold: CALL_SWALLOW + 1,
  /** the phone's indigo grades down into the MIDNIGHT room (the orb becomes the key light) as the camera pulls back */
  roomGrade: [2, b(2)] as const,
  /** the CLOSED sign (the door callback) hangs, lifts (anticipation) and swings down to seat ON this 8th
   *  after the pickup: its glint + outline ring leave from here */
  statusIn: b(0.5),
  /** a light sweep crosses "Picked up on the first ring." on the beat, once it has risen */
  lineGlint: b(1),
  /** the big line gathers (3 f) then dives into the orb… */
  lift: CALL_LIFT,
  dive: CALL_DIVE,
  /** …which swallows it (gulp + ping + level blip + light flash + pop) */
  swallow: CALL_SWALLOW,
  /** the figure pairs cross their rest position (the unfold spring's first crossing; it peaks 2 f later) */
  digitsLand: CALL_SWALLOW + 1 + 5,
  /** rings: the pickup (attack 1 f before the beat), then every time Ava starts a line */
  rings: [-1, CALL.lines[0].at, CALL.lines[2].at, CALL.lines[4].at] as const,
  /** the speaker tag (AVA / CALLER) pops ON Ava's first word and on every cut (dot ring + letters) */
  tagPops: CALL.lines.map((l) => l.at),
  /** the caller's phone line opens on its cut: a flare runs along the line, the bars spring up from it */
  lineOpen: CALL.lines.filter((l) => l.who === 'caller').map((l) => l.at),
  /** the AI-disclosure underline draws (a hot tip) as Ava says "an AI assistant"… */
  disclose: [CALL.lines[0].at + vWord('call-1', 9) - 2, CALL.lines[0].at + vWord('call-1', 12) - 4] as const,
  /** …and locks with a flash as it completes */
  discloseLock: CALL.lines[0].at + vWord('call-1', 12) - 4,
  /** establishing → Ava's close-up, as she says "This is Ava" */
  pushIn: [CALL_S2 - 6, CALL_S2 + 14] as const,
  /** CLOSED, then the digits, peel off sideways (each after a 3-f inward counter-move) */
  peel: [CALL_S2 - 8, CALL_S2 - 6] as const,
  /** the slot chips: a seed 3 f before, the pop's overshoot PEAKS on the spoken "3 PM" / "4:30" (+ ring, glint, sparks) */
  chipPops: [CALL.lines[2].at + CALL.slotPops[0], CALL.lines[2].at + CALL.slotPops[1]] as const,
  /** the caller picks 15:00 (squash 2 f → pop → flood, ring, sparks, camera kick)… */
  pick: CALL.slotPick,
  /** …and 16:30 lifts 2 f and drops away */
  chipDrop: CALL.slotPick + 1,
  /** the 15:00 chip squashes (2 f) and leaves up into the light as Ava starts the last line… */
  chipsOut: CALL.lines[4].at,
  /** …and the orb takes it in (a flare + a small gulp) */
  chipAbsorb: CALL.lines[4].at + 8,
  /** camera kicks (1–3 px) on the big hits: the pickup, the gulp, the pick, the booked mark */
  kicks: [0, CALL_SWALLOW, CALL.slotPick, CALL.bookedMark] as const,
  /** camera drift settles to rest before the mark is handed over */
  camSettle: [CALL_LEN - b(4), CALL_LEN - b(1)] as const,
  /** "15:00" ignites ember ON the spoken "three": a burst of ember sparks + the glow's flash */
  ember: CALL.bookedMark,
  /** the payoff beat: the mark presses (3 f) and springs back — exactly 1 again by markHide − 1 */
  payoff: CALL.bookedMark + 1,
  /** the room inhales (everything but the mark eases back 1.5 %) before the blow-away */
  blowInhale: [CALL_LEN - 9, CALL_LEN - 6] as const,
  /** everything but the mark (and its glow) blows away towards the lens; the room stays */
  blowAway: [CALL_LEN - 6, CALL_LEN - 1] as const,
  /** the result scene draws the mark from here (= the call's end) */
  markHide: CALL_LEN,
};

/* ── RESULT — fine cuts (result-local frames) ──────────────────── */
export const RESULT_LOCAL = {
  /** the night room knocks the call back (out-curve) */
  roomIn: [RESULT.lift, b(4 / 3)] as const, // 0 → 20
  /** the lift spring starts here, after a 2-frame anticipation dip */
  liftGo: RESULT.lift + b(1 / 8), // 2
  /** the booked-pill wash blooms around the mark; the call's <MarkGlow> (MARK_GLOW_HANDOFF) cross-fades into it */
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
  /** the close-up crops into the calendar card: the camera leans in for recomposeAnticip frames,
   *  then a recomposeDur-frame EASE.peel zoom-out (fastest ≈ recompose + 3), a 2.5 % overshoot
   *  that settles over recomposeSettle frames */
  recompose: RESULT.land + b(0.6), // 39
  recomposeAnticip: b(0.2), // 3  (36 → 39)
  recomposeDur: 6, // 39 → 45
  recomposeSettle: 6, // 45 → 51
  /** the split: the divider draws top → bottom (16:9) / left → right (9:16) over dividerDraw
   *  frames (EASE.house) and the night falls in behind its bead */
  divider: RESULT.split - b(0.25), // 41
  dividerDraw: 8, // 41 → 49
  /** the call's violet room light cools out as the halves grade in */
  splitGrade: [RESULT.split - b(0.4), RESULT.split + b(14 / 15)] as const, // 39 → 59
  /** the titles plane moves above the sheet (it sits under it while the sheet recomposes) */
  titlesOver: RESULT.split + b(1 / 3), // 50
  /** per-letter stagger of "Asleep." / "Booked." (SPRING.land; the LAST letter locks ON
   *  RESULT.split / RESULT.bookedWord); each landing kicks its own half 1.2 % */
  letterStagger: 0.6,
  /** the moon locks a 16th after "Asleep." (glow flash + one slow ring) */
  moon: RESULT.split + b(0.25), // 49
  /** the stars twinkle in (lock frames) on 16ths / 8ths */
  stars: [b(3.5), b(3.75), b(4.5), b(4.75)] as const, // 53 56 68 71
  /** the confirmation check (the closing light's green) pops on the event, a 16th after "Booked." */
  check: RESULT.bookedWord + b(0.25), // 64
  /** the parallax discs come up with the split, and clear for the dive */
  discsIn: [RESULT.split - b(0.25), RESULT.bookedWord] as const, // 41 → 60
  discsOut: [RESULT.toWhite[0] - b(1 / 3), RESULT.toWhite[0] + b(0.2)] as const, // 100 → 108
  /** the halves drift apart ±10 px (from the split) … */
  drift: [RESULT.split, RESULT.toWhite[0] - b(1)] as const, // 45 → 90
  /** … while the Booked half pushes in 1 → 1.035 and the night dims 10 % */
  hold: [RESULT.bookedWord, RESULT.toWhite[0] - b(1)] as const, // 60 → 90
  /** ONE accent in the hold: a light sweep across the event, one beat after "Booked." (on the grid) */
  sweep: [RESULT.bookedWord + b(1), RESULT.bookedWord + b(1) + 8] as const, // 75 → 83
  /** anticipation pulse on the event (peak) */
  pulse: RESULT.toWhite[0] - b(1 / 3), // 100
  /** its anticipation: everything has settled; the camera leans back, the event swells (EASE.inOut) */
  pulseIn: [RESULT.toWhite[0] - b(1 / 3) - 10, RESULT.toWhite[0] - b(1 / 3)] as const, // 90 → 100
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
export const SCALE_LOCAL = (() => {
  /** one language flip per 16th note: 75 79 83 86 90 94 */
  const langs = Array.from({ length: 6 }, (_, i) => Math.round(SCALE.langMorph + i * SCALE.langStep));
  /** station cues (= the flow cues): each node is solid ON its cue — 120 128 135 */
  const stations = [0, 1, 2].map((i) => Math.round(SCALE.flow + i * SCALE.stationStep));
  /** five cells collapse into the deck; the complete language grid has held ≥ 13 f */
  const collapse = b(7.5); // 113
  return {
    /** one industry pop per 16th note */
    pops: Array.from({ length: 16 }, (_, i) => Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
    /** card 01 pops this many frames before the cut: t 0 (pop-2 + tick-0) lands mid-pop */
    preroll: 2,
    /** the stepped camera (EASE.peel): card 01 → 2×2 → 3×3 → the full grid */
    camSteps: [
      [1, 4],
      [12, 15],
      [27, 30],
    ] as const,
    /** quarter-note camera kicks (+1.8 %, alternating 3 px jolt) */
    kicks: [0, b(1), b(2), b(3)] as const, // 0 15 30 45
    /** "16 industries." → "14 languages.": 8 f mask wipe, the title moves to the top band */
    titleSwap: b(5.3), // 80 — "16 industries." has held 20 f
    /** the ten leaving cards peel off: pull-in from flyOut − flyAnticip, then accelerate out */
    flyOut: b(4.4), // 66
    flyAnticip: 3,
    flyStagger: 0.8,
    flyDur: 10,
    /** the six keepers glide + resize into the language grid */
    glide: b(4.4), // 66
    glideStagger: 1,
    langs,
    /** the AI-disclosure underline draws under each language's AI phrase */
    disclose: langs.map((l) => [l + 4, l + 10] as const),
    /** quarter notes of the wall: every card already up pulses in its light (and the four room lights swell) */
    beats: [b(1), b(2), b(3)] as const, // 15 30 45
    /** the camera's slow push during the languages, released for the flow */
    push: [b(4), b(7.3), b(7.95)] as const, // 60, 110, 119
    /** "14 languages." wipes out → "After the call." rises */
    titleOut: collapse - 1, // 112
    titleAfter: collapse, // 113
    collapse,
    collapseStagger: 0.5,
    /** the Japanese cell (complete) flies onto the deck and becomes the call */
    carrierFly: b(7.7), // 116
    /** the rail's track + hollow nodes appear */
    trackIn: b(7.7), // 116
    stations,
    /** the call card's content is in (under the carrier's blur); its Booked pill pops */
    callIn: stations[0] - 3, // 117
    pill: stations[0] + 3, // 123
    /** station card + content slam in together */
    cardsIn: stations.map((s) => s - 3), // 117 125 132
    /** node fills start: solid (1.35) ON the station frame */
    fills: stations.map((s) => s - 2), // 118 126 133
    /** electric rail segments (the bead reaches each node a frame before its cue) */
    rails: [
      [stations[0] + 1, stations[1] - 1],
      [stations[1] + 1, stations[2] - 1],
    ] as const, // 121→127, 129→134
    /** "Contact saved ✓" confirms a frame before the CRM node */
    ok: stations[2] - 1, // 134
    /** the final node's ping */
    ping: [stations[2], stations[2] + 24] as const, // 135 → 159
    /** slow push-in of the stage about FLOW_END (zoom 1 → 1.04; the heading stays put) */
    flowPush: [b(8.55), b(10.8)] as const, // 128 → 162
    /** the finished rail streams: the first light mote leaves the call node after the confirm and
     *  reaches the CRM exactly as the CTA iris opens from it (then one per 8th note) */
    stream: [stations[2] + 1, SCALE.irisToDark[0] + 3] as const, // 136 → 146
    /** each language orb's pulse (its greeting "said"): 2 f after the flip lands */
    orbPulse: langs.map((l) => l + 3), // 78 82 86 89 93 97
  };
})();

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
  /** halo breath starts under the end card … */
  breath: CTA.button + 10,
  /** … and its amplitude eases to 0 into the hold, where it freezes */
  breathOut: [CTA.finalHold - 10, CTA.finalHold] as const,
  /** dust clears before the hold */
  dustOut: [CTA.finalHold - 15, CTA.finalHold] as const,
  /** every residual (camera, springs, glows) eases to exact rest over these frames */
  settle: [CTA.finalHold - 8, CTA.finalHold] as const,
  /** headline word i starts its mask rise this many frames before its spoken word
   *  (CTA.line + vWord(lineVoice, lineWords[i])), so it is ~85 % up ON the word */
  riseLead: 4,
  /** the eyes after the iris: a slow push-in (1 → 1.04) and a catch-light glint ON her first word */
  eyePush: [CTA_IRIS_END, CTA.line + 10] as const,
  glint: [CTA.line, CTA.line + 4] as const,
  /** THE FOUR LIGHTS — rush, closing, sunday, night pop in on 8ths (light-chime hits) */
  orbPops: [b(2), b(2.5), b(3), b(3.5)] as const,
  /** … and tighten their orbit ON "Twenty" "four" "seven" */
  tighten: [0, 1, 2].map((k) =>
    CTA.line + vWord(CTA.lineVoice, Math.min(CTA.lineWords[7] + k, VOICE.lines[CTA.lineVoice].words.length - 1)),
  ) as readonly number[],
  /** the converge: the orbit swells (anticipation) … */
  orbSwell: [CTA.converge[0], CTA.converge[0] + 4] as const,
  /** … then spirals into P, accelerating (motion-blurred) */
  orbIn: [CTA.converge[0] + 4, CTA.logoImpact - 2] as const,
  /** the orbs behind her show only where she has torn away (the shader's erase
   *  mask); this closes the last of it as the erase completes */
  unhide: [CTA.logoImpact - 9, CTA.logoImpact - 6] as const,
  /** the four overlap and become one (the back three go as they are covered) */
  merge: [CTA.logoImpact - 6, CTA.logoImpact - 1] as const,
  /** the merged orb blows out into the light as the logo lands */
  burst: [CTA.logoImpact, CTA.logoImpact + 8] as const,
  /** the four lights' rim comes up round the halo */
  rimIn: [CTA.logoImpact + 2, CTA.logoImpact + b(1.5)] as const,
  /** the URL types one character per this many frames, from CTA.url */
  urlStep: 0.7,
  /** the press: down to .94 over this many frames, then back on SPRING.pop */
  pressDown: 2,
};

/* ── KNOWLEDGE — fine cuts (knowledge-local frames) ──────────────
 * Every frame the picture HITS on is here (the sound design imports them).
 * The scene wears the SUNDAY light; voiced moments come from the voices. */
export const KNOWLEDGE_LOCAL = (() => {
  const K = KNOWLEDGE;
  /** first frame a line is heard (env > .15: a breath or a hum counts, it is heard) */
  const onset = (id: VoiceId) => Math.max(0, VOICE.lines[id].env.findIndex((e) => e > 0.15));
  const askWord = K.ask + vWord(K.askVoice, 0); // the caller's "Do…"
  const ansWord = K.answer + vWord(K.answerVoice, 0); // Ava's "I…"
  const headingOut = [askWord - 10, askWord - 4] as const;
  const beams = [K.scan[0], K.scan[0] + 21] as const;
  const beamStagger = 2;
  const beamDraw = beams[1] - beams[0] - 4 * beamStagger;
  const fills = [K.scan[0] + 3, 2.4, 18] as const;
  const relight0 = K.answer + onset(K.answerVoice) - 2;
  return {
    /** the white bloom from the result settles into the stage (t 0 is pure white: the hit) */
    stageIn: [0, b(0.75)] as const,
    /** the eyebrow's CornerDot spins in (its letters follow 0.8 f apart) */
    eyebrowDot: K.heading - 1,
    /** heading word i rises from K.heading + i · headingStagger (5 words) */
    headingStagger: 2,
    /** the five documents pop on 16ths (= the docTicks): inhale, overshoot, a glint + ring */
    docPops: Array.from({ length: 5 }, (_, i) => Math.round(K.docsIn + i * K.docStep)) as readonly number[],
    /** the heading steps down into the answer slot (a 2 f lift before), making way for the orb */
    headingStep: [K.ask + 3, K.ask + 13] as const, // starts on the 16th after the ask (26)
    /** the orb rises into the centre ON the beat after the doc run: bloom flash, ring, kick */
    orbIn: b(2),
    /** the status pill pops "Listening" a 16th later… */
    statusIn: b(2.25),
    /** …and the moment tag "SUNDAY · 10:24" an 8th later (the sun spins in, a glint crosses it) */
    momentTag: b(2.5),
    /** the heading flicks out of its masks just before the caller's first word */
    headingOut,
    /** CALLER pops as the heading clears */
    callerIn: headingOut[1] - 1,
    /** the question holds while Ava hums it over; gone before her first word */
    questionOut: [ansWord - 8, ansWord - 4] as const,
    /** the peek page opens (16:9) — a scan line of Sunday light runs down its reveal edge */
    peekOpen: K.scan[0] - b(0.25),
    /** the pill flips to "Looking through 5 documents" (the box tweens, the words swap, a bump) */
    scanFlip: K.scan[0],
    /** dotted beams draw tile → orb: the window, and the stagger between beams */
    beams,
    beamStagger,
    /** beam i's head reaches the orb: a spark on its rim */
    beamLand: Array.from({ length: 5 }, (_, i) => beams[0] + i * beamStagger + beamDraw) as readonly number[],
    /** match bars: tile i starts at fills[0] + i · fillStep, lasting fillDur */
    fills,
    /** tile i is being read: its ring and sheen (= its bar starting) */
    reads: Array.from({ length: 5 }, (_, i) => Math.round(fills[0] + i * fills[1])) as readonly number[],
    /** the status dot pulses 1.6× three times, 8 f apart, from scan[0] */
    dotPulse: [K.scan[0], 8, 3] as const,
    /** the five 60 % ticks blink 1 → .3 → 1 as the scan comes up short */
    tickBlink: [K.miss - 10, K.miss] as const,
    /** "Not in the documents": the pill flips, then shakes "no"; the orb greys under a closing ring; a kick */
    missFlip: K.miss,
    shake: [K.miss + 3, K.miss + 15] as const,
    toGrey: [K.miss, K.miss + 12] as const,
    peekCollapse: [K.miss, K.miss + 8] as const,
    /** Ava answers: her Sunday light floods back into the orb from her first sound (bloom swell + ring) */
    relight: [relight0, relight0 + b(1)] as const,
    /** the tiles step back (.55) so the answer leads */
    dimDocs: [K.answer, K.answer + 10] as const,
    /** "Your fallback message" */
    meta: ansWord + 8,
    /** the stage recedes (.12, blur, .97) under the closing title */
    recede: [K.closing - 4, K.closing + 6] as const,
    closingStagger: 2.5,
    closingKey: K.closing + b(1.5), // an 8th after its last word ("so.") is up: "it says so." turns Sunday teal (glint, pool of light, kick)
    closingPush: [K.closing, K.out[0]] as const,
    /** the whip: a 3 f counter-move, then the stage leaves; clean white from `white` */
    whipAnticip: [K.out[0] - 3, K.out[0]] as const,
    whip: [K.out[0], K.out[1] - 3] as const,
    white: K.out[1] - 2,
  };
})();

/* ---------------------------------------------------------------- *
 * SOUND — every cue is an absolute frame on the timeline, computed from
 * the scene constants above so picture and sound can't drift apart.
 * `file` is relative to public/. `vol` is linear gain on top of the file:
 * SFX files are normalised to a -12 dBFS peak, the bed to -20 dBFS, the
 * voices to -5 dBFS (dialogue leads the mix; the bed ducks under it).
 * ---------------------------------------------------------------- */
export const PK = { whoosh: 10, whooshSoft: 7, whooshRev: 16, riserShort: 10, riser: 28 } as const;
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

const flowPops: Cue[] = SCALE_LOCAL.stations.map((s, i) => ({
  at: at('scale', s),
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
  { at: at('call', CALL_LOCAL.swallow), file: sfx('pop-2.wav'), vol: 0.7 }, // the gulp
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
  // (no extra tick at statusIn: it coincides with the fifth doc tick)
  // the whip: the whoosh peaks on its fastest frame
  { at: at('knowledge', KNOWLEDGE_LOCAL.whip[1] - 1) - PK.whoosh, file: sfx('whoosh.wav'), vol: 0.7 },
  // SCALE
  { at: at('scale', 0), file: sfx('pop-2.wav') },
  ...industryTicks,
  { at: at('scale', SCALE.industriesTitle), file: sfx('hit.wav'), vol: 0.9 }, // "16 industries." slams
  // the peel-off: the soft whoosh peaks as the ten cards leave fastest
  { at: at('scale', SCALE_LOCAL.flyOut + 4) - PK.whooshSoft, file: sfx('whoosh-soft.wav'), vol: 0.8 },
  ...langPops,
  // the Japanese carrier's flight onto the deck
  { at: at('scale', SCALE_LOCAL.carrierFly + 3) - PK.whoosh, file: sfx('whoosh.wav'), vol: 0.8 },
  ...flowPops,
  // peaks on the CTA iris's fastest frames
  { at: at('scale', SCALE.irisToDark[0] + 9) - PK.whooshRev, file: sfx('whoosh-rev.wav') },
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
