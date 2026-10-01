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
/* Ava searches AFTER she has heard the question: the scan starts on the 8th after the caller's last word */
const KB_SCAN0 = upHalf(KB_ASK + vWord('kb-1', VOICE.lines['kb-1'].words.length - 1) + 4);
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
/** Ava says the name an 8th after the impact, so its transient has cleared before "Neuro". */
const CTA_BRAND = CTA_IMPACT + b(0.5);
/** The button is clicked 2 f after her last word ends; the still end card follows an 8th later
 *  (≥ 3 beats after the impact; on the half-beat grid). */
const CTA_PRESS = CTA_BRAND + vFrames('cta-2') + 2;
const CTA_HOLD = CTA_IMPACT + Math.max(b(3), upHalf(CTA_PRESS + b(0.5) - CTA_IMPACT));
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
  /** the whole line as the caption shows it — as SPOKEN ("3 PM", "4:30"; the viewer reads what they hear) */
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
    text: 'Of course! I have 3 PM or 4:30. Which one suits you better?',
    captions: [
      { text: 'Of course!', word: 0 },
      // captioned as spoken (the viewer hears "3 PM" and reads "3 PM")
      { text: 'I have 3 PM or 4:30.', word: 2 },
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
    text: "Lovely! You're all booked for Wednesday at 3 PM.",
    captions: [
      { text: 'Lovely!', word: 0 },
      // "all" is spoken but not (yet) in the voice's `say`: it rides "You're" until a regenerated take aligns it
      (() => {
        const ws = VOICE.lines['call-5'].words.map((w) => w.w.toLowerCase().replace(/[^a-z']/g, ''));
        const a = ws.indexOf('all');
        const map = a > 0 ? [1, a, a + 1, a + 2, a + 3, a + 4, a + 5, a + 6] : [1, 1, 2, 3, 4, 5, 6, 7];
        return { text: "You're all booked for Wednesday at 3 PM.", word: 1, map };
      })(),
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
  brandVoice: CTA_BRAND, // Ava: "Neuro Tech Voice."
  brandVoiceId: 'cta-2' as VoiceId,
  /** "Start free →" lands with the logo, a 16th after the impact (the impact carries its sound) */
  button: CTA_IMPACT + 4,
  /** the URL types ON her words: "neuro" | "tech" | "voice.com" (cta-2 words 0 / 1 / 2) */
  url: CTA_BRAND + vWord('cta-2', 0),
  /** the note once the URL is typed (on the 8th grid, clear of "Voice." onset) */
  note: CTA_IMPACT + Math.max(b(2), upHalf(b(0.5) + vWord('cta-2', 2) + 7)),
  press: CTA_PRESS, // the button takes the site's hover (plum) as if clicked — after "…Voice."
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
/** the orb swallows the big line 4 f before Ava's first word (≈ 130 ms of air, so the gulp never masks "Th-ank")… */
const CALL_SWALLOW = CALL_AT[0] - 4;
/** …after a 6-frame dive (the line gathers 3 f before it) */
const CALL_DIVE = 6;
const CALL_LIFT = CALL_SWALLOW - CALL_DIVE;
/** "This is Ava" — the establishing shot pushes into Ava's close-up */
const CALL_S2 = CALL.lines[0].at + vWord('call-1', 6);
/** shot ↔ reverse shot: a designed swing on every turn (lines 1…4), [at − 2, at + 8] */
const CALL_SWING = CALL.lines.slice(1).map((l) => [l.at - 2, l.at + 8] as const);
export const CALL_LOCAL = {
  /** the swings: from at − 2 the orb anticipates (squash .95 + a 12 px counter-move away from where it is
   *  going, the outgoing caption lifts 4 px); from at it travels A ↔ C on SPRING.pop (fastest at + 1…3,
   *  ghosted / smeared), overshoots ≈ 4 % in size (peak at + 5) and is settled by at + 8 */
  swing: CALL_SWING,
  /** the swing's fastest frame (the whoosh's peak) */
  swingFast: CALL_SWING.map(([a]) => a + 3),
  /** the orb lands: its overshoot peaks (Ava's landings leave a ring) */
  swingLand: CALL_SWING.map(([a]) => a + 7),
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
  /** rings: the pickup (attack 1 f before the beat), Ava's first word, then each time her orb LANDS from a swing */
  rings: [-1, CALL.lines[0].at, CALL.lines[2].at + 5, CALL.lines[4].at + 5] as const,
  /** the speaker tag (AVA / CALLER) pops ON Ava's first word and on every cut (dot ring + letters) */
  tagPops: CALL.lines.map((l) => l.at),
  /** the caller's phone line draws OUT of the orb's trailing edge as it arrives (a flare runs along it, the bars spring up) */
  lineOpen: CALL.lines.filter((l) => l.who === 'caller').map((l) => l.at + 3),
  /** …and retracts into the orb as it swings back to Ava (from the next swing's anticipation) */
  lineClose: CALL.lines.flatMap((l, i) => (l.who === 'caller' && i + 1 < CALL.lines.length ? [CALL.lines[i + 1].at - 2] : [])),
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
  /** the picked chip squashes (2 f, with the swing's anticipation) and flies into the orb with the swing… */
  chipsOut: CALL.lines[4].at - 2,
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
  /** the room opens as the call's midnight and warms to the night room only while the
   *  calendar's close-up fills the frame (landing → before the recompose reveals it) */
  roomWarm: [RESULT.land - b(0.4), RESULT.land + b(0.5)] as const, // 24 → 38
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
  /** six languages on THREE big cells, two pages: each cell flips on a 16th (EN RO ES 75 79 83),
   *  then flips again exactly one beat later (FR DE JA 90 94 98) — never more than 3 greetings on screen */
  const langs = Array.from({ length: 6 }, (_, i) => Math.round(SCALE.langMorph + (i % 3) * SCALE.langStep + (i >= 3 ? BEAT : 0)));
  /** the lights of the wall: ONE leads each quarter note (the hour turns on the beat) — rush → closing → sunday → night */
  const wallLights = ['rush', 'closing', 'sunday', 'night'] as const;
  /** station cues (= the flow cues): each node is solid ON its cue — 120 128 135 */
  const stations = [0, 1, 2].map((i) => Math.round(SCALE.flow + i * SCALE.stationStep));
  /** the two other cells collapse into the deck; page 2 (FR DE JA) has held ≥ 15 f */
  const collapse = b(7.5); // 113
  return {
    /** one industry pop per 16th note */
    pops: Array.from({ length: 16 }, (_, i) => Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
    /** card 01 pops this many frames before the cut: t 0 (pop-2 + tick-0) lands mid-pop.
     *  3 = its attack frame is the knowledge whip's last frame, so the whip cut has no blank white frame */
    preroll: 3,
    /** the stepped camera (EASE.peel): card 01 → 2×2 → 3×3 → the full grid */
    camSteps: [
      [1, 4],
      [12, 15],
      [27, 30],
    ] as const,
    /** quarter-note camera kicks (+1.8 %, alternating 3 px jolt) */
    kicks: [0, b(1), b(2), b(3)] as const, // 0 15 30 45
    /** pop i's light = the quarter it pops in (colour follows the hour, never the industry) */
    wallLight: Array.from({ length: 16 }, (_, i) => wallLights[Math.min(3, Math.floor(i / 4))]),
    wallLights,
    /** "16 industries." locks the wall in the last hour's light (3 a.m.) … */
    heroLight: 'night' as const,
    /** … then the languages and the after-call flow are in the closing light (one light, to the end) */
    langLight: 'closing' as const,
    /** "16 industries." lifts to the top band WITH the fly-out / glide: out of the cell band before any flip */
    titleSwap: b(4.4), // 66
    /** "16 industries." exits up out of its mask: 2 f anticipation, 4 f exit (gone at titleIn − 1) … */
    titleExit: Math.round(b(5.5)) - 7, // 76
    /** … and "14 languages." rises 1 f after it is gone, on the 16th of the third flip */
    titleIn: Math.round(b(5.5)), // 83
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
    /** quarter notes of the wall: the hour turns — every card already up pulses in the NEW quarter's light, the room bloom swells */
    beats: [b(1), b(2), b(3)] as const, // 15 30 45
    /** the camera's slow push during the languages, released for the flow */
    push: [b(4), b(7.3), b(7.95)] as const, // 60, 110, 119
    /** "14 languages." exits up (2 f anticipation, 4 f exit) → "After the call." rises 1 f after, on a 16th */
    titleOut: Math.round(b(7.75)) - 7, // 109
    titleAfter: Math.round(b(7.75)), // 116
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
  /** radial reveal from the eyes: it blooms from 4 f before the iris is fully open and
   *  decelerates into the figure (its lit AREA grows evenly: no dead hold, no slam) (4 → 24) */
  reveal: [CTA_IRIS_END - 4, CTA.robotIn[1] - 6] as const,
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
  settle: [Math.max(CTA.press + 3, CTA.finalHold - 8), CTA.finalHold] as const,
  /** headline word i starts its mask rise this many frames before its spoken word
   *  (CTA.line + vWord(lineVoice, lineWords[i])), so it is ~85 % up ON the word */
  riseLead: 4,
  /** the eyes out of the black: a slow push-in (1 → 1.06) from the first frame they show,
   *  a first catch-light as the iris completes, a second ON her first word */
  eyePush: [0, CTA.line + 10] as const,
  glint0: [CTA_IRIS_END + 2, CTA_IRIS_END + 6] as const,
  glint: [CTA.line, CTA.line + 4] as const,
  /** THE FOUR LIGHTS — rush, closing, sunday, night pop in on 8ths (each pop is the
   *  brightest frame of its light: flash bloom, ring, sparks, camera kick) */
  orbPops: [b(2), b(2.5), b(3), b(3.5)] as const,
  /** as the lights arrive the room's silver backlight dims (to 45 %) so they are the
   *  brightest things in frame; it comes back ON the impact as the merged light */
  backDim: [b(2), b(3)] as const,
  /** … and tighten their orbit ON "Twenty" "four" "seven" */
  tighten: [0, 1, 2].map((k) =>
    CTA.line + vWord(CTA.lineVoice, Math.min(CTA.lineWords[7] + k, VOICE.lines[CTA.lineVoice].words.length - 1)),
  ) as readonly number[],
  /** the converge: the orbit swells (anticipation) … */
  orbSwell: [CTA.converge[0], CTA.converge[0] + 4] as const,
  /** … then spirals into P, accelerating (motion-blurred) */
  orbIn: [CTA.converge[0] + 4, CTA.logoImpact - 9] as const,
  /** the orbs behind her show only where she has torn away (the shader's erase
   *  mask); this closes the last of it as the erase completes */
  unhide: [CTA.logoImpact - 9, CTA.logoImpact - 6] as const,
  /** the four overlap and become one: each keeps its own light until contact, then the
   *  other three pour into the survivor (night), which takes all four hues … */
  merge: [CTA.logoImpact - 12, CTA.logoImpact - 6] as const,
  /** … and holds alone, 1.5×, its mesh swirling the four lights, before it bursts */
  survivor: [CTA.logoImpact - 6, CTA.logoImpact] as const,
  /** the merged orb blows out into the light as the logo lands */
  burst: [CTA.logoImpact, CTA.logoImpact + 8] as const,
  /** the four lights' rim comes up round the halo */
  rimIn: [CTA.logoImpact + 2, CTA.logoImpact + b(1.5)] as const,
  /** the URL types ON her words: "neuro" | "tech" | "voice.com" start on cta-2 words 0 / 1 / 2
   *  (first character index of each chunk, and its frame), one character per urlStep frames */
  urlChunks: [0, 5, 9] as const,
  urlAt: [0, 1, 2].map((k) => CTA.brandVoice + vWord(CTA.brandVoiceId, k)) as readonly number[],
  urlStep: 0.6,
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
  const ask = VOICE.lines[K.askVoice];
  const askWord = K.ask + vWord(K.askVoice, 0); // the caller's first aligned word ("Do…")
  const ansWord = K.answer + vWord(K.answerVoice, 0); // Ava's "I…"
  const aw = (k: number) => K.answer + vWord(K.answerVoice, k); // Ava's spoken word k (kb-2)
  /* kb-1 opens with "Quick question," — heard, but not in its word alignment (the caption
   * starts on "Do"). When ≥ 12 f are heard before the first aligned word, those two words
   * are captioned from the envelope: "Quick" on the onset, "question," on the first rise
   * after the first dip. (A regenerated kb-1 without them simply has no lead-in.) */
  const lead = (() => {
    const e = ask.env;
    const o = onset(K.askVoice);
    const first = vWord(K.askVoice, 0);
    if (first - o < 12) return null;
    let i = o;
    while (i < first && e[i] > 0.1) i++;
    while (i < first && e[i] < 0.2) i++;
    const w2 = i < first - 4 ? i : o + Math.round((first - o) * 0.3);
    // it has left (a 4 f exit) by the time "Do…" starts to write in (2 f before it is heard)
    return { text: 'Quick question,', words: [K.ask + o, K.ask + w2] as const, out: askWord - 6 };
  })();
  const headingOut = lead ? ([lead.words[1] + 4, lead.words[1] + 10] as const) : ([askWord - 10, askWord - 4] as const);
  const beams = [K.scan[0], K.scan[0] + 21] as const;
  const beamStagger = 2;
  const beamDraw = beams[1] - beams[0] - 4 * beamStagger;
  const fills = [K.scan[0] + 3, 2.4, 18] as const;
  /* her light floods back on her first WORD: through the hum the orb stays grey (it
   * breathes with the hum) — the miss reads for a second before she answers */
  const relight0 = ansWord - 2;
  /* the team card: it pops on "I'll", its lines write in on "ask" / "team", the callback
   * chip pops on "call" and its check draws on "today." */
  const ticketPop = aw(13);
  return {
    /** the white bloom from the result settles into the stage (t 0 is pure white: the hit) */
    stageIn: [0, b(0.75)] as const,
    /** the eyebrow's CornerDot spins in (its letters follow 0.8 f apart) */
    eyebrowDot: K.heading - 1,
    /** heading word i rises from K.heading + i · headingStagger (5 words) */
    headingStagger: 2,
    /** the five documents pop on 16ths (= the docTicks): inhale, overshoot, a glint + ring */
    docPops: Array.from({ length: 5 }, (_, i) => Math.round(K.docsIn + i * K.docStep)) as readonly number[],
    /** the heading steps down (to the answer row / the slot; a 2 f lift before), making way for the
     *  orb — on the 3rd doc pop, so it has passed the dialogue row before the caller's first sound */
    headingStep: [b(1.25), b(1.25) + 10] as const,
    /** the orb rises into the centre ON the beat after the doc run: bloom flash, ring, kick */
    orbIn: b(2),
    /** the status pill pops "Listening" a 16th later… */
    statusIn: b(2.25),
    /** …and the moment tag "SUNDAY · 10:24" an 8th later (the sun spins in, a glint crosses it) */
    momentTag: b(2.5),
    /** "Quick question," (kb-1's unaligned lead-in): its two words' frames, and when it gives way to "Do…" (null = none) */
    lead,
    /** the heading flicks out of its masks once the caller is talking */
    headingOut,
    /** CALLER pops on the caller's first sound */
    callerIn: lead ? lead.words[0] - 1 : headingOut[1] - 1,
    /** the question holds while Ava hums it over; gone before her first word */
    questionOut: [ansWord - 8, ansWord - 4] as const,
    /** the slot opens (the dashed page the reader is reading) — a scan line of Sunday light runs down its reveal edge */
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
    /** the slot's reading lines fold away (bottom up, 1.5 f apart)… */
    peekCollapse: [K.miss, K.miss + 8] as const,
    /** …and "0 matches" pops into it a 16th after the miss, then shakes "no" after the pill */
    zeroPop: K.miss + b(0.25),
    zeroShake: [K.miss + 8, K.miss + 20] as const,
    /** Ava's "answer" (in "I don't have an answer…"): a soft grey ring leaves "0 matches" */
    zeroEcho: aw(4),
    /** Ava answers: her Sunday light floods back on her first word (bloom swell + rings + kick) */
    relight: [relight0, relight0 + b(1)] as const,
    /** the documents step back (.25, 2 px out of focus) so the answer leads */
    dimDocs: [K.answer, K.answer + 10] as const,
    /** "guess." turns sunday ink as it is spoken */
    guessKey: aw(12),
    /** "I'll": the slot inhales (2 f at .95) and pops into the team card (1.08 → 1): glint, ring, kick */
    ticketPop,
    /** the card's lines write in, word-synced: "Home visits?" on "ask", the caller's number on "team" */
    ticketType: [aw(14), aw(16)] as const,
    /** "call": the callback chip pops (closing green) */
    callback: aw(18),
    /** "today.": its check draws, a green flash, a glint across the chip; the word turns sunday ink */
    check: aw(21),
    /** the orb pushes in 1 → 1.05 through her answer */
    orbPush: [K.answer, K.closing - 4] as const,
    /** the stage recedes (.12, blur, .97) under the closing title */
    recede: [K.closing - 4, K.closing + 6] as const,
    closingStagger: 2.5,
    closingKey: K.closing + b(1.5), // an 8th after its last word ("so.") is up: "it says so." turns Sunday teal (glint, pool of light, kick)
    closingPush: [K.closing, K.out[0]] as const,
    /** the whip: a 3 f counter-move, then the stage leaves; clean white from `white`.
     *  Its smeared tail is still in frame until the scale's card 01 whips in on top
     *  (scale.from − SCALE_LOCAL.preroll), so the cut never shows an empty white frame. */
    whipAnticip: [K.out[0] - 3, K.out[0]] as const,
    whip: [K.out[0], K.out[1] - 2] as const,
    white: K.out[1] - 2,
  };
})();

/* ================================================================ *
 * SOUND — the cue sheet, the voices and the master mix.
 *
 * HITS lists every visual hit of the picture (absolute frames, computed from the
 * scene constants above, so picture and sound can't drift). buildCues() turns
 * them into CUES:
 *   · the designed sound for the hit (SFX), round-robin variants so repeats never
 *     sound identical, tuned to the hit's light (THE FOUR LIGHTS are a key:
 *     rush E · closing G# · sunday B · night E′ — an E-major arpeggio)
 *   · pre-rolled sounds (whooshes, risers, swells, the flip) land their PEAK on the hit
 *   · gain by weight (key 0 dB · normal −4 · subtle −9, on the −12 dBFS file peak);
 *     non-key hits play 5 dB lower while someone is speaking
 *   · pan by screen x (0..1 → −0.6..0.6), or a pan move
 *   · same-family hits within 2 frames merge (the heavier one plays)
 *   · each cue is sent to the room of its act (the dark night room / the bright white act)
 * scripts/generate-sfx.mjs synthesises every sound, the music bed, and the master
 * (voices + bed + cues, dialogue bus, ducking, rooms, loudness, true-peak limiter)
 * into public/sfx/mix.wav, which src/Soundtrack.tsx plays.
 * ================================================================ */

/** Designed peak of each pre-rolled sound, in frames after it starts (generate-sfx builds them to these). */
export const PK = {
  whoosh: 10, whooshSoft: 7, whooshRev: 16, riserShort: 10, riser: b(2), swish: 4, swell: 6, flip: 2, shock: 3, ring: 1, chordRev: 6,
} as const;
const at = (scene: SceneKey, local: number) => SCENES[scene].from + local;
const sfx = (name: string) => `sfx/${name}`;

/** THE FOUR LIGHTS as notes (MIDI): rush E5 · closing G#5 · sunday B5 · night E6 — the bed is in E major. */
export const LIGHT_NOTES = { rush: 76, closing: 80, sunday: 83, night: 88 } as const;
export type Light = keyof typeof LIGHT_NOTES | 'none';
/** Tuned families are synthesised on B; a hit in a light plays its light's note. */
export const LIGHT_SEMI: Record<Light, number> = { rush: -7, closing: -3, sunday: 0, night: 5, none: 0 };

export type Group = 'tr' | 'pop' | 'flip' | 'air' | 'spark' | 'low' | 'bell' | 'sig';
type SfxDef = {
  /** round-robin variants (files name-0 … name-(n-1); one file when 1) */
  n: number;
  /** frames from the sound's start to its peak (lands on the hit) */
  pk: number;
  group: Group;
  /** loudness trim (dB) so families sit together at the same weight */
  trim: number;
  /** room send (dB) and tempo-delay send (dB) */
  send: number;
  delay?: number;
  /** synthesised on B and retuned by the hit's light */
  tune?: boolean;
  /** inside a merge, the bigger sound wins a tie */
  rank?: number;
};
const S = (n: number, group: Group, trim: number, send: number, o: Partial<SfxDef> = {}): SfxDef => ({ n, pk: 0, group, trim, send, ...o });
export const SFX = {
  // transients
  click: S(4, 'tr', 0, -18),
  tick: S(4, 'tr', -1, -18, { tune: true }),
  tap: S(4, 'tr', 0, -20),
  key: S(4, 'tr', -2, -22),
  flick: S(2, 'flip', -2, -20),
  // bodies
  pop: S(4, 'pop', 0, -16, { tune: true }),
  gulp: S(2, 'pop', 0, -16),
  flip: S(3, 'flip', -1, -16, { pk: PK.flip }),
  // air
  swish: S(4, 'air', -5, -16, { pk: PK.swish, rank: 2 }),
  'whoosh-soft': S(2, 'air', -5, -14, { pk: PK.whooshSoft, rank: 3 }),
  whoosh: S(3, 'air', -3, -14, { pk: PK.whoosh, rank: 4 }),
  'whoosh-rev': S(1, 'air', -3, -16, { pk: PK.whooshRev, rank: 4 }),
  air: S(1, 'air', -5, -14, { rank: 3 }),
  swell: S(2, 'air', -5, -14, { pk: PK.swell, rank: 1 }),
  sheen: S(2, 'air', -7, -14, { rank: 1 }),
  draw: S(1, 'air', -8, -16, { rank: 1 }),
  'riser-short': S(1, 'air', -3, -12, { pk: PK.riserShort, rank: 5 }),
  riser: S(1, 'air', -2, -12, { pk: PK.riser, rank: 6 }),
  // sparkle
  shimmer: S(2, 'spark', -5, -12, { delay: -20 }),
  glint: S(3, 'spark', -5, -14),
  ping: S(2, 'spark', -4, -12, { tune: true, delay: -20 }),
  ember: S(1, 'spark', -1, -12, { delay: -20 }),
  // weight
  thump: S(3, 'low', 0, -20),
  land: S(2, 'low', 0, -16),
  breath: S(1, 'low', 0, -22),
  sub: S(1, 'low', 0, -16),
  buzz: S(1, 'low', -4, -20),
  // bells — the four light chimes and their family
  'chime-rush': S(2, 'bell', -3, -10, { delay: -17 }),
  'chime-closing': S(2, 'bell', -3, -10, { delay: -17 }),
  'chime-sunday': S(2, 'bell', -3, -10, { delay: -17 }),
  'chime-night': S(2, 'bell', -3, -10, { delay: -17 }),
  'chime-rush-soft': S(1, 'bell', -3, -10, { delay: -18 }),
  'chime-closing-soft': S(1, 'bell', -3, -10, { delay: -18 }),
  'chime-sunday-soft': S(1, 'bell', -3, -10, { delay: -18 }),
  'chime-night-soft': S(1, 'bell', -3, -10, { delay: -18 }),
  chord: S(1, 'bell', -4, -10, { delay: -18 }),
  'chord-rev': S(1, 'bell', -3, -14, { pk: PK.chordRev }),
  strum: S(1, 'bell', -3, -10, { delay: -18 }),
  ding: S(1, 'bell', -2, -10, { delay: -18 }),
  'ding-s': S(2, 'bell', -3, -10, { tune: true, delay: -18 }),
  confirm: S(1, 'bell', -2, -10, { delay: -18, rank: 2 }),
  // signatures (never merged)
  drain: S(1, 'sig', -2, -12),
  freeze: S(1, 'sig', -2, -12, { delay: -20 }),
  'ring-hook': S(1, 'sig', -2, -12, { pk: PK.ring }),
  'ring-twist': S(1, 'sig', -2, -12, { pk: PK.ring }),
  shatter: S(1, 'sig', 0, -12),
  door: S(1, 'sig', 0, -12),
  creak: S(1, 'sig', -4, -14),
  'power-on': S(1, 'sig', -2, -12),
  pickup: S(1, 'sig', -1, -14),
  line: S(1, 'sig', -2, -16),
  shock: S(1, 'sig', -3, -14, { pk: PK.shock }),
  impact: S(1, 'sig', 0, -14),
  'hit-white': S(1, 'sig', 0, -12),
  slam: S(1, 'sig', 0, -14),
} as const satisfies Record<string, SfxDef>;
export type Snd = keyof typeof SFX;

type Weight = 1 | 2 | 3;
type Pan = number | readonly [number, number];
/** A visual hit: the frame the picture hits, the sound, its light, screen x (or a pan move), weight. */
export type Hit = {
  at: number;
  snd: Snd;
  light: Light;
  x: Pan;
  w: Weight;
  label: string;
  /** extra semitones; extra dB; a run (n hits `step` frames apart, rising `semi`); a stereo split; skip merging */
  semi?: number;
  db?: number;
  run?: { n: number; step?: number; semi?: number; semis?: readonly number[]; offs?: readonly number[]; xs?: readonly number[] };
  split?: boolean;
  layer?: boolean;
};
const H = (scene: SceneKey, local: number, snd: Snd, light: Light, x: Pan, w: Weight, label: string, o: Partial<Hit> = {}): Hit => ({
  at: at(scene, local),
  snd,
  light,
  x,
  w,
  label,
  ...o,
});
const chime = (l: Exclude<Light, 'none'>, soft = false) => `chime-${l}${soft ? '-soft' : ''}` as Snd;
/** The industry wall's lights, card by card (scale.tsx). */
const WALL: Exclude<Light, 'none'>[] = ['rush', 'rush', 'rush', 'rush', 'closing', 'closing', 'sunday', 'sunday', 'night', 'closing', 'closing', 'night', 'sunday', 'sunday', 'night', 'night'];
const WALL_X = [0.5, 0.74, 0.26, 0.74, 0.81, 0.82, 0.18, 0.5, 0.62, 0.87, 0.87, 0.87, 0.12, 0.37, 0.62, 0.87];
const LANGS: Exclude<Light, 'none'>[] = ['rush', 'closing', 'sunday', 'night', 'rush', 'closing'];
const LANG_X = [0.17, 0.5, 0.83, 0.16, 0.5, 0.84];
const LANG_ORB_X = [0.3, 0.63, 0.96, 0.3, 0.63, 0.96];
/** the five documents' notes: an E-major pentatonic run (E F# G# B C#) */
const DOC_SEMI = [-7, -5, -3, 0, 2];
const DOC_X = [0.14, 0.32, 0.5, 0.68, 0.86];
const KL = KNOWLEDGE_LOCAL;
/** rush · closing · sunday · night (the CTA orbs' order) */
const LIGHT_ORDER4 = ['rush', 'closing', 'sunday', 'night'] as const;

/**
 * EVERY VISUAL HIT (the scene builders' hit lists). Where two hits sit within ~2 frames
 * they merge in buildCues (or are folded into one designed sound — noted inline).
 */
export const HITS: Hit[] = [
  /* ── HOOK ── */
  H('hook', HOOK_LOCAL.orbIn, 'shimmer', 'rush', 0.5, 2, 'colon orb born in the rush light'),
  H('hook', HOOK_LOCAL.moments[0], 'pop', 'rush', 0.5, 2, '17:05 springs out of the orb'),
  H('hook', HOOK_LOCAL.moments[0], chime('rush'), 'rush', 0.5, 2, 'LIGHT: rush'),
  H('hook', HOOK_LOCAL.drumIn, 'tick', 'rush', 0.5, 3, 'MID-RUSH drum row rolls up'),
  H('hook', HOOK_LOCAL.moments[1] - HOOK_LOCAL.flickTravel, 'flick', 'closing', 0.5, 3, 'strips flick'),
  H('hook', HOOK_LOCAL.moments[1], 'tick', 'closing', 0.5, 2, '20:10 AFTER CLOSING lands'),
  H('hook', HOOK_LOCAL.moments[1], chime('closing'), 'closing', 0.5, 2, 'LIGHT: closing'),
  H('hook', HOOK_LOCAL.moments[2] - HOOK_LOCAL.flickTravel, 'flick', 'sunday', 0.5, 3, 'strips flick'),
  H('hook', HOOK_LOCAL.moments[2], 'tick', 'sunday', 0.5, 2, '10:12 SUNDAY lands'),
  H('hook', HOOK_LOCAL.moments[2], chime('sunday'), 'sunday', 0.5, 2, 'LIGHT: sunday'),
  H('hook', HOOK.clockLand - HOOK_LOCAL.flickTravel, 'flick', 'night', 0.5, 3, 'strips spin into the night'),
  H('hook', HOOK.clockLand, 'click', 'night', 0.5, 1, '03:12 TUESDAY NIGHT lands'),
  H('hook', HOOK.clockLand, 'thump', 'night', 0.5, 1, 'the land’s body (camera kick)'),
  H('hook', HOOK.clockLand, chime('night'), 'night', 0.5, 2, 'LIGHT: night'),
  H('hook', HOOK_LOCAL.sheen, 'sheen', 'night', [0.3, 0.7], 3, 'light sweep across the figures'),
  H('hook', HOOK_LOCAL.waveIn, 'swish', 'night', 0.5, 3, 'dotted wave draws out both ways', { split: true }),
  // the ring's two pulses (HOOK.ring, HOOK_LOCAL.ringB) are built into ring-hook
  H('hook', HOOK.ring, 'ring-hook', 'night', 0.5, 1, 'FIRST RING (both pulses)'),
  H('hook', HOOK.ring, 'buzz', 'night', 0.5, 3, 'handset buzz'),
  H('hook', HOOK.freeze, 'freeze', 'night', 0.5, 2, 'time freezes mid-ring'),
  H('hook', HOOK.textIn + 4, 'whoosh-soft', 'none', 0.5, 2, '“Your business is closed.” rises'),
  H('hook', HOOK_LOCAL.breathBeats[0], 'breath', 'night', 0.5, 3, 'the frozen world breathes'),
  H('hook', HOOK_LOCAL.breathBeats[1], 'breath', 'night', 0.5, 3, 'second breath'),
  // the push into the break + the world's inhale (out[0]) + the twist's gather: one inhale, peak ON the shatter
  H('hook', SCENES.hook.to - SCENES.hook.from, 'riser-short', 'night', 0.5, 2, 'inhale → peak ON the shatter'),

  /* ── TWIST ── */
  H('twist', TWIST.shatter, 'shatter', 'none', 0.5, 1, 'SHATTER (downbeat)'),
  H('twist', TWIST.shatter + 2, 'glint', 'none', 0.175, 3, 'doorway light floods on'),
  H('twist', TWIST_LOCAL.closedSlide + 2, 'swish', 'none', [0.6, 0.43], 2, '“closed” slides left'),
  H('twist', TWIST_LOCAL.doorCreak, 'creak', 'none', 0.175, 3, 'the door creaks wider'),
  H('twist', TWIST.reassemble[1], 'whoosh-rev', 'none', 0.5, 2, 'shards fly back into the tagline'),
  H('twist', TWIST_LOCAL.closedLand, 'tap', 'none', 0.43, 2, '“Closed” seats'),
  H('twist', TWIST_LOCAL.wordLand[0], 'tick', 'none', 0.55, 2, '“is” locks', { semi: -5 }),
  H('twist', TWIST_LOCAL.wordLand[1], 'tick', 'none', 0.63, 2, '“for” locks', { semi: -3 }),
  H('twist', TWIST_LOCAL.wordLand[2], 'tick', 'none', 0.42, 2, '“the” locks', { semi: 0 }),
  H('twist', TWIST.doorSlam - 2, 'whoosh-soft', 'none', 0.175, 2, 'door swings shut, accelerating'),
  H('twist', TWIST.doorSlam, 'door', 'none', 0.175, 1, 'DOOR SLAM'),
  H('twist', TWIST.closedSign, 'click', 'none', 0.175, 2, 'CLOSED sign swings in'),
  H('twist', TWIST_LOCAL.signGlint[0], 'glint', 'none', 0.175, 3, 'glint crosses the CLOSED pill'),
  H('twist', TWIST.line2 + 3, 'whoosh-soft', 'none', 0.5, 2, '“not the phone.” rises'),
  H('twist', TWIST.keyColor, 'sheen', 'night', [0.4, 0.6], 3, 'paper → lilac'),
  // screenOpen[0]'s 2-frame white flash is inside power-on
  H('twist', TWIST.phoneOn, 'power-on', 'night', 0.83, 1, 'PHONE POWERS ON'),
  H('twist', TWIST.phoneOn, chime('night'), 'night', 0.83, 2, 'LIGHT: night (the screen)'),
  H('twist', TWIST_LOCAL.avatarPop, 'pop', 'night', 0.83, 2, 'Ava’s orb pops onto the screen'),
  // INCOMING / CALL and the number type in together: one chatter of keys
  H('twist', TWIST_LOCAL.uiLabel, 'key', 'night', 0.83, 3, 'INCOMING CALL · +1 555 0129 type in', { run: { n: 16, step: 0.75 } }),
  H('twist', TWIST_LOCAL.keyFocus[0], 'tick', 'night', 0.5, 2, 'FOCUS BEAT'),
  H('twist', TWIST_LOCAL.keyGlint[0], 'sheen', 'night', [0.35, 0.65], 2, 'glint sweeps “not the phone.”'),
  H('twist', TWIST_LOCAL.diveDip[1], 'swell', 'night', 0.83, 2, 'pull-back before the dive'),
  H('twist', TWIST.pushToPhone[0] + 14, 'whoosh', 'night', [0.75, 0.5], 1, 'DIVE into the phone'),
  // the ring's second wave (ring2 + 9) and the faint third ring (ring3) are inside ring-twist
  H('twist', TWIST.ring2, 'ring-twist', 'night', 0.8, 1, 'RING (+ second wave)'),
  H('twist', TWIST_LOCAL.buzz[0], 'buzz', 'night', 0.8, 2, 'the phone vibrates'),
  H('twist', Math.round((TWIST_LOCAL.breath[0] + TWIST_LOCAL.breath[1]) / 2), 'swell', 'night', 0.5, 3, 'the orb breathes'),
  H('call', 0, 'riser-short', 'night', 0.5, 1, 'pickup anticipation → peak ON the pickup'),

  /* ── CALL ── */
  H('call', CALL.pickup, 'pickup', 'night', 0.5, 1, 'PICKUP on the downbeat'),
  H('call', CALL.pickup, 'thump', 'night', 0.5, 1, 'pickup body (kick)'),
  H('call', CALL.pickedUpText[0] + 1, 'swish', 'night', 0.5, 3, '“Picked up on the first ring.” rises'),
  H('call', CALL_LOCAL.roomOpen[0], 'air', 'night', 0.5, 3, 'camera pulls back into the room', { layer: true }),
  H('call', CALL_LOCAL.statusIn, 'flip', 'night', 0.5, 2, 'CLOSED sign seats'),
  H('call', CALL_LOCAL.lineGlint, 'sheen', 'night', [0.3, 0.7], 3, 'glow sweeps the line'),
  // the line gathers (lift) and dives (CALL_LOCAL.dive) accelerating INTO the gulp; the digits' split is folded in
  H('call', CALL_LOCAL.swallow - 1, 'swish', 'night', 0.5, 2, 'the line dives into the orb'),
  H('call', CALL_LOCAL.swallow, 'gulp', 'night', 0.5, 1, 'the orb GULPS the line'),
  H('call', CALL_LOCAL.unfold, 'swish', 'night', 0.5, 2, '03 / 12 spring out (stereo split)', { split: true }),
  H('call', CALL_LOCAL.tagPops[0], 'tick', 'night', 0.5, 3, 'AVA tag pops'),
  H('call', CALL_LOCAL.digitsLand, 'tick', 'night', 0.5, 2, '03 | 12 cross their rest', { split: true }),
  H('call', CALL_LOCAL.unfold + 6, 'glint', 'night', [0.38, 0.62], 3, 'light sweeps the figure pairs'),
  H('call', CALL_LOCAL.peel[0], 'whoosh-soft', 'night', [0.55, 0.75], 2, 'CLOSED peels right; push into Ava'),
  H('call', CALL_LOCAL.peel[1], 'swish', 'night', 0.5, 2, 'digits peel off ±700 px', { split: true }),
  H('call', CALL_LOCAL.disclose[0], 'draw', 'night', [0.3, 0.8], 3, 'AI-disclosure underline draws'),
  H('call', CALL_LOCAL.discloseLock, 'tick', 'night', 0.62, 2, 'underline locks'),
  // shot ↔ reverse shot: every turn is a SWING (anticipation → whip → land); a soft whoosh peaks on its
  // fastest frame, panned along the orb's travel (16:9: centre ↔ left)
  ...CALL_LOCAL.swingFast.map((f, i) =>
    H('call', f, 'whoosh-soft', 'night', CALL.lines[i + 1].who === 'caller' ? [0.5, 0.2] : [0.2, 0.5], 2, `SWING ${CALL.lines[i + 1].who === 'caller' ? 'to the caller' : 'back to Ava'}`),
  ),
  H('call', CALL_LOCAL.lineOpen[0], 'line', 'night', 0.64, 2, 'caller line draws out of the orb'),
  H('call', CALL_LOCAL.tagPops[2], 'tick', 'night', 0.5, 3, 'AVA tag pops (swing back)'),
  // the chips pop ON the spoken times: an octave down, under the speech band
  H('call', CALL_LOCAL.chipPops[0], 'pop', 'night', 0.41, 1, 'chip 3:00 PM on “3 PM”', { semi: -12 }),
  H('call', CALL_LOCAL.chipPops[1], 'pop', 'night', 0.59, 1, 'chip 4:30 PM on “4:30”', { semi: -10 }),
  H('call', CALL_LOCAL.lineOpen[1], 'line', 'night', 0.64, 2, 'caller line draws out of the orb'),
  H('call', CALL_LOCAL.pick - 2, 'tap', 'night', 0.41, 3, '3:00 PM squashes (wind-up)'),
  H('call', CALL_LOCAL.pick, 'click', 'night', 0.41, 1, '3:00 PM PICKED'),
  H('call', CALL_LOCAL.chipDrop + 2, 'swish', 'night', [0.59, 0.64], 3, '4:30 PM drops away'),
  H('call', CALL_LOCAL.chipsOut, 'tick', 'night', 0.41, 3, 'the picked chip squashes (the swing’s anticipation)'),
  H('call', CALL_LOCAL.chipAbsorb - 1, 'swish', 'night', [0.41, 0.5], 2, '3:00 PM flies into the orb with the swing'),
  H('call', CALL_LOCAL.chipAbsorb, 'gulp', 'night', 0.5, 2, 'the orb takes the slot in', { semi: -2 }),
  H('call', CALL_LOCAL.ember, 'ember', 'none', 0.64, 1, 'BOOKED: 15:00 ignites ember (ON “3 PM”)', { db: -3 }),
  H('call', CALL_LOCAL.payoff, 'thump', 'none', 0.5, 2, 'the mark presses'),
  H('call', CALL_LOCAL.blowInhale[1], 'swell', 'night', 0.5, 3, 'the room inhales'),
  H('call', CALL_LOCAL.markHide - 2, 'whoosh', 'night', 0.5, 1, 'everything blows to the lens'),

  /* ── RESULT ── */
  H('result', RESULT_LOCAL.liftGo + 3, 'swish', 'none', 0.5, 2, 'the mark lifts into the card'),
  H('result', RESULT_LOCAL.cardReveal[0], 'tick', 'none', 0.42, 3, 'BOOKED row rises'),
  H('result', RESULT_LOCAL.sheetIn + 3, 'whoosh-soft', 'night', [0.85, 0.65], 2, 'the calendar slides in'),
  H('result', RESULT_LOCAL.slotIn[0], 'tick', 'night', 0.86, 3, 'WED 15:00 slot pops'),
  H('result', RESULT.fly + 6, 'whoosh', 'none', [0.75, 0.57], 1, 'the card is thrown'),
  H('result', RESULT.land, 'ding', 'none', 0.57, 1, 'LANDS in the slot'),
  H('result', RESULT.land, 'land', 'none', 0.57, 1, 'squash + 9 px jolt'),
  H('result', RESULT_LOCAL.ping[0], 'ping', 'none', 0.57, 3, 'event dot ping', { semi: -7 }),
  // the divider (1 f before) is folded into the recompose whoosh
  H('result', RESULT_LOCAL.recompose + 3, 'whoosh-soft', 'none', 0.72, 2, 'close-up crops into the card'),
  H('result', RESULT_LOCAL.divider, 'sheen', 'night', 0.5, 2, 'the divider draws'),
  H('result', RESULT.split, 'land', 'night', 0.25, 1, '“Asleep.” locks', { db: -4.4 }),
  H('result', RESULT_LOCAL.moon, chime('night'), 'night', 0.25, 2, 'the moon locks (LIGHT: night)'),
  H('result', RESULT_LOCAL.stars[0], 'tick', 'night', 0.09, 3, 'star 1', { semi: 7 }),
  H('result', RESULT_LOCAL.stars[1], 'tick', 'night', 0.39, 3, 'star 2', { semi: 12 }),
  H('result', RESULT.bookedWord, 'pop', 'none', 0.75, 1, '“Booked.” locks'),
  H('result', RESULT.bookedWord + 1, 'sheen', 'none', [0.6, 0.9], 3, 'sheen across “Booked.”'),
  H('result', RESULT_LOCAL.check, 'ding-s', 'closing', 0.84, 2, 'the green check pops'),
  H('result', RESULT_LOCAL.stars[2], 'tick', 'night', 0.44, 3, 'star 3', { semi: 9 }),
  H('result', RESULT_LOCAL.stars[3], 'tick', 'night', 0.14, 3, 'star 4', { semi: 14 }),
  H('result', RESULT_LOCAL.sweep[0], 'sheen', 'none', [0.65, 0.9], 2, 'light sweep across 15:00'),
  H('result', RESULT_LOCAL.pulse, 'swell', 'none', 0.75, 3, 'the event swells (anticipation)'),
  H('result', RESULT_LOCAL.bloom[0], 'shimmer', 'none', 0.5, 3, 'the event blooms to white'),
  H('result', RESULT_LOCAL.whiteFull, 'riser-short', 'none', 0.75, 1, 'the event opens past the frame'),
  H('result', RESULT_LOCAL.whiteFull - 2, 'whoosh', 'none', 0.6, 2, 'the dive into the event', { layer: true, db: -3 }),

  /* ── KNOWLEDGE ── */
  H('knowledge', KL.stageIn[0], 'hit-white', 'sunday', 0.5, 1, 'WHITE: the stage materialises'),
  H('knowledge', KL.stageIn[0], chime('sunday'), 'sunday', 0.5, 2, 'LIGHT: sunday blooms'),
  H('knowledge', KL.eyebrowDot, 'tick', 'sunday', 0.06, 3, 'eyebrow dot spins in'),
  H('knowledge', KNOWLEDGE.heading + 2, 'swish', 'none', 0.5, 2, '“Answers from your own documents.”'),
  ...KL.docPops.map((f, i) => H('knowledge', f, 'pop', 'sunday', DOC_X[i], 2, `doc ${i + 1} pops`, { semi: DOC_SEMI[i] })),
  H('knowledge', KL.headingStep[0], 'swish', 'none', 0.5, 3, 'the heading steps down'),
  H('knowledge', KL.orbIn, 'land', 'sunday', 0.5, 1, 'the orb springs out (beat 2)'),
  H('knowledge', KL.orbIn, 'glint', 'sunday', 0.5, 3, 'bloom flash off the rim'),
  H('knowledge', KL.statusIn, 'pop', 'sunday', 0.89, 2, '“Listening” pill', { semi: 5 }),
  H('knowledge', KL.momentTag, chime('sunday'), 'sunday', 0.73, 2, '“SUNDAY · 10:24” (LIGHT: sunday)'),
  H('knowledge', KL.headingOut[0] + 3, 'swish', 'none', 0.5, 3, 'the heading flicks out'),
  H('knowledge', KL.callerIn, 'tick', 'none', 0.33, 3, 'CALLER label + “Quick question,” (the caller’s first sound)'),
  H('knowledge', KL.peekOpen, 'sheen', 'sunday', 0.79, 3, 'the slot’s page scans open'),
  H('knowledge', KL.scanFlip, 'flip', 'sunday', 0.85, 2, 'pill: “Looking through 5 documents”'),
  H('knowledge', KL.beams[0], 'shimmer', 'sunday', [0.2, 0.5], 2, 'five beams draw to the orb'),
  H('knowledge', KL.dotPulse[0], 'tap', 'sunday', 0.84, 3, 'status dot reads', { run: { n: KL.dotPulse[2], step: KL.dotPulse[1] } }),
  H('knowledge', KL.reads[0], 'tick', 'sunday', DOC_X[0], 3, 'the documents are read', {
    run: { n: 5, offs: KL.reads.map((f) => f - KL.reads[0]), semis: DOC_SEMI, xs: DOC_X },
  }),
  H('knowledge', KL.beamLand[0], 'glint', 'sunday', 0.48, 3, 'beam heads land on the orb', { run: { n: 5, step: KL.beamStagger, semi: 2 } }),
  H('knowledge', KL.tickBlink[0], 'tap', 'none', 0.5, 3, 'the 60 % ticks blink (doubt)', { layer: true, semi: -6 }),
  H('knowledge', KL.missFlip, 'drain', 'none', 0.5, 1, 'THE MISS: the light drains to grey'),
  H('knowledge', KL.missFlip, 'thump', 'none', 0.5, 1, 'the miss: kick'),
  H('knowledge', KL.missFlip, 'flip', 'none', 0.85, 2, 'pill: “Not in the documents”'),
  H('knowledge', KL.shake[0], 'tap', 'none', 0.85, 3, 'the pill shakes “no”', { run: { n: 2, step: 4 } }),
  H('knowledge', KL.peekCollapse[0] + 2, 'swish', 'none', [0.86, 0.76], 3, 'the slot’s reading lines fold away'),
  H('knowledge', KL.zeroPop, 'pop', 'none', 0.8, 2, '“0 matches” pops into the slot', { semi: -7 }),
  H('knowledge', KL.zeroShake[0], 'tap', 'none', 0.8, 3, 'the slot shakes “no”', { run: { n: 2, step: 4 } }),
  H('knowledge', KL.relight[0], chime('sunday', true), 'sunday', 0.5, 2, 'LIGHT: sunday floods back (Ava’s first word)'),
  H('knowledge', KL.relight[0] + 2, 'thump', 'sunday', 0.5, 3, 'relight kick'),
  H('knowledge', KL.zeroEcho, 'ping', 'none', 0.8, 3, '“answer”: a grey ring leaves “0 matches”', { semi: -5, db: -4 }),
  H('knowledge', KL.guessKey, 'glint', 'sunday', 0.62, 3, '“guess.” turns sunday ink'),
  H('knowledge', KL.ticketPop - 2, 'swell', 'sunday', 0.8, 3, 'the slot inhales'),
  H('knowledge', KL.ticketPop, 'pop', 'sunday', 0.8, 2, 'TEAM CARD pops on “I’ll” (kick)', { semi: 5 }),
  H('knowledge', KL.ticketPop + 1, 'sheen', 'sunday', [0.7, 0.9], 3, 'glint sweeps the card'),
  H('knowledge', KL.ticketType[0], 'key', 'none', 0.78, 3, '“Home visits?” writes in', { run: { n: 12, step: 0.7 }, db: -4 }),
  H('knowledge', KL.ticketType[1], 'key', 'none', 0.78, 3, 'the caller’s number writes in', { run: { n: 10, step: 0.6 }, db: -6 }),
  H('knowledge', KL.callback, 'pop', 'closing', 0.74, 2, 'callback chip pops on “call”'),
  H('knowledge', KL.check, 'ding-s', 'closing', 0.68, 2, 'the check draws on “today.”'),
  H('knowledge', KL.recede[0], 'swell', 'sunday', 0.5, 2, 'the stage recedes into the title'),
  H('knowledge', KNOWLEDGE.closing + 3, 'swish', 'none', 0.5, 2, '“Where your documents stop, it says so.”'),
  H('knowledge', KL.closingKey, chime('sunday'), 'sunday', 0.5, 1, '“it says so.” turns Sunday teal'),
  H('knowledge', KL.closingKey + 1, 'glint', 'sunday', [0.4, 0.7], 3, 'a glint runs through it'),
  H('knowledge', KL.whipAnticip[1], 'swell', 'none', 0.5, 3, 'suck-in before the whip'),
  H('knowledge', KL.whip[1] - 1, 'whoosh', 'none', [0.7, 0.1], 1, 'THE WHIP (pans right → left)'),

  /* ── SCALE ── */
  // card 01's pre-roll breath (scale.from − preroll) is the whip's tail
  H('scale', SCALE_LOCAL.pops[0], 'pop', 'rush', 0.5, 1, 'card 01 pops (rush)'),
  H('scale', SCALE_LOCAL.camSteps[0][1] - 1, 'swish', 'none', 0.5, 3, 'the camera peels back'),
  ...SCALE_LOCAL.pops.slice(1).map((f, i) => H('scale', f, 'tick', WALL[i + 1], WALL_X[i + 1], 2, `industry ${i + 2} pops (${WALL[i + 1]})`)),
  H('scale', SCALE_LOCAL.camSteps[1][1], 'whoosh-soft', 'none', 0.5, 2, 'snap-zoom 2×2 → 3×3'),
  H('scale', SCALE_LOCAL.beats[0], 'thump', 'none', 0.5, 1, 'quarter: the wall pulses'),
  H('scale', SCALE_LOCAL.camSteps[2][1], 'whoosh-soft', 'none', 0.5, 2, 'snap-zoom → the full wall'),
  H('scale', SCALE_LOCAL.beats[1], 'thump', 'none', 0.5, 1, 'quarter: the wall pulses'),
  H('scale', SCALE_LOCAL.beats[2], 'thump', 'none', 0.5, 1, 'quarter: punch-in kick'),
  H('scale', SCALE.industriesTitle, 'slam', 'none', 0.5, 1, '“16 industries.” SLAMS'),
  H('scale', SCALE.industriesTitle, 'strum', 'none', 0.5, 2, 'all 16 discs light in the four lights'),
  H('scale', SCALE.industriesTitle, 'key', 'none', 0.5, 3, '13 letters stamp in', { run: { n: 13, step: 0.6 } }),
  H('scale', SCALE_LOCAL.flyOut + 4, 'whoosh-soft', 'none', 0.5, 2, 'ten cards peel off outwards', { split: true }),
  H('scale', SCALE_LOCAL.glide, 'swish', 'none', 0.5, 3, 'keepers glide into the grid'),
  // each language: the flip, its orb's chime (its greeting lands), then its AI underline —
  // which falls on the NEXT flip (a 16th later), so all but the last ride inside that flip
  ...SCALE_LOCAL.langs.map((f, i) => H('scale', f, 'flip', LANGS[i], LANG_X[i], 2, `flips to language ${i + 1}`, i === 0 ? { db: -3 } : {})),
  ...SCALE_LOCAL.orbPulse.map((f, i) => H('scale', f, chime(LANGS[i], true), LANGS[i], LANG_ORB_X[i], 3, `greeting ${i + 1} lands (LIGHT: ${LANGS[i]})`)),
  H('scale', SCALE_LOCAL.disclose[5][0], 'swish', 'none', 0.8, 3, 'underline under AIアシスタント'),
  H('scale', SCALE_LOCAL.titleSwap + 2, 'whoosh-soft', 'none', [0.5, 0.3], 2, '“16 industries.” → “14 languages.”'),
  H('scale', SCALE_LOCAL.collapse + 3, 'whoosh-soft', 'none', [0.6, 0.3], 2, 'the cells collapse into the deck'),
  H('scale', SCALE_LOCAL.titleAfter, 'key', 'none', 0.2, 3, '“After the call.” rises', { run: { n: 8, step: 0.7 } }),
  H('scale', SCALE_LOCAL.trackIn, 'tick', 'closing', 0.5, 3, 'rail track + three nodes', { run: { n: 3, step: 2, semi: 2 } }),
  H('scale', SCALE_LOCAL.carrierFly + 3, 'whoosh', 'closing', [0.84, 0.21], 2, 'the call flies onto the deck'),
  H('scale', SCALE_LOCAL.stations[0], 'land', 'closing', 0.21, 1, 'THE CALL lands'),
  H('scale', SCALE_LOCAL.stations[0], 'click', 'closing', 0.21, 2, 'node 1 fills'),
  H('scale', SCALE_LOCAL.rails[0][0], 'sheen', 'closing', [0.21, 0.5], 3, 'bead runs call → Slack'),
  H('scale', SCALE_LOCAL.pill, 'pop', 'none', 0.27, 2, 'ember “Booked” pill', { semi: -7 }),
  H('scale', SCALE_LOCAL.cardsIn[1], 'land', 'closing', 0.5, 2, 'Slack card slams in'),
  H('scale', SCALE_LOCAL.stations[1], 'click', 'closing', 0.5, 1, 'Slack node'),
  H('scale', SCALE_LOCAL.rails[1][0], 'sheen', 'closing', [0.5, 0.79], 3, 'bead runs Slack → CRM'),
  H('scale', SCALE_LOCAL.cardsIn[2], 'land', 'closing', 0.79, 2, 'CRM card slams in'),
  H('scale', SCALE_LOCAL.ok, 'ding-s', 'closing', 0.79, 2, '“Contact saved ✓”'),
  H('scale', SCALE_LOCAL.stations[2], 'confirm', 'closing', 0.79, 1, 'CRM node settles green'),
  H('scale', SCALE_LOCAL.stream[0], 'sheen', 'closing', [0.21, 0.79], 3, 'a light mote streams to the CRM'),
  H('scale', SCALE_LOCAL.ping[0] + 4, 'ping', 'closing', 0.79, 3, 'wider ping ring'),
  H('scale', SCALE_LOCAL.stream[1], 'ding-s', 'closing', 0.79, 2, 'the handoff spark', { semi: 5 }),

  /* ── CTA ── */
  H('cta', CTA_LOCAL.iris[0] + 6, 'whoosh-rev', 'none', [0.79, 0.5], 2, 'the dark iris opens'),
  H('cta', CTA_LOCAL.eyes[0], 'sub', 'night', 0.5, 2, 'her eyes out of the black'),
  H('cta', CTA_LOCAL.reveal[0], 'shimmer', 'none', 0.5, 3, 'radial reveal'),
  H('cta', CTA_LOCAL.glint0[0], 'glint', 'night', [0.45, 0.55], 3, 'first catch-light as the iris completes'),
  H('cta', CTA_LOCAL.glint[0], 'glint', 'night', [0.4, 0.6], 3, 'catch-light on her first word'),
  ...CTA.lineWords
    .filter((w, i) => i !== 6 && i !== 7) // "customers" rises with "your"; "24/7." below
    .map((w, i) =>
      H('cta', CTA.line + vWord(CTA.lineVoice, w) - CTA_LOCAL.riseLead, 'tap', 'none', [0.31, 0.37, 0.45, 0.55, 0.66, 0.4][i], 3, `headline word ${i + 1} rises`, { db: -4 }),
    ),
  H('cta', CTA.line + vWord(CTA.lineVoice, CTA.lineWords[7]) - CTA_LOCAL.riseLead, 'tap', 'none', 0.63, 2, '“24/7.” rises ON “Twenty”', { db: -3 }),
  // the four lights pop UNDER Ava's line: a short pitched pop per light (its note), no bell
  // ring and no delay tail across "agents that book" — the picture carries the accent
  ...CTA_LOCAL.orbPops.map((f, i) => H('cta', f, 'pop', LIGHT_ORDER4[i], [0.66, 0.71, 0.27, 0.36][i], 3, `${LIGHT_ORDER4[i].toUpperCase()} orb pops (LIGHT)`)),
  // ON “Twenty” “four” “seven”: weight, not clicks — sub kicks under the words
  ...CTA_LOCAL.tighten.map((f, i) => H('cta', f, 'thump', 'none', 0.5, 2, `the orbit tightens (“${['Twenty', 'four', 'seven'][i]}”)`, { db: -1 })),
  H('cta', CTA_LOCAL.marks, 'tick', 'none', 0.5, 3, 'four corner marks pop', { run: { n: 4, step: 2, semi: 0 } }),
  H('cta', CTA.logoImpact, 'riser', 'none', 0.5, 1, 'CONVERGE → peak ON the impact'),
  H('cta', CTA_LOCAL.tearKick[0], 'swish', 'none', 0.5, 2, 'the filament burst tears the portrait'),
  H('cta', CTA_LOCAL.collapse.from + 3, 'swish', 'none', 0.5, 3, 'headline words sucked into the core'),
  H('cta', CTA_LOCAL.orbIn[1] - 6, 'whoosh', 'none', [0.3, 0.7], 2, 'the four orbs whirl at top speed'),
  H('cta', CTA_LOCAL.eyeGlow[1], 'glint', 'night', 0.5, 3, 'the eyes’ last light slides into the core'),
  H('cta', CTA_LOCAL.survivor[0], 'gulp', 'night', 0.5, 2, 'the four lights are one: the survivor holds alone'),
  // the four lights fuse (merge[0]) and the suck-in (impact − 4): the chord's reverse swell, peak ON the impact
  H('cta', CTA.logoImpact, 'chord-rev', 'none', 0.5, 2, 'the four lights fuse', { layer: true }),
  H('cta', CTA.logoImpact, 'impact', 'night', 0.5, 1, 'LOGO IMPACT'),
  H('cta', CTA.logoImpact, 'chord', 'night', 0.5, 1, 'THE FOUR LIGHTS ring together'),
  H('cta', CTA_LOCAL.ring[0], 'shock', 'none', 0.5, 2, 'the shockwave ring sweeps past', { layer: true }),
  H('cta', CTA.button, 'pop', 'night', 0.5, 3, '“Start free →” pops with the logo (folded into the impact)'),
  H('cta', CTA.note, 'tap', 'none', 0.5, 3, '“5 free minutes, no card”', { db: -4 }),
  // (the URL types ON her words — "neuro" | "tech" | "voice.com" at CTA_LOCAL.urlAt — and makes
  // no sound of its own: her voice is its sound, so nothing sits on the name; likewise the
  // four-light rim (rimIn) and the plate's glint ride the impact's chord, unvoiced)
  H('cta', CTA.press, 'click', 'night', 0.5, 1, 'the button is clicked'),
  H('cta', CTA.press + CTA_LOCAL.pressDown, 'tap', 'night', 0.5, 3, 'the plate springs back'),
];
/* ── voices ── */
export type Cue = {
  /** start frame (fractional = sample-accurate in the mix) */
  at: number;
  file: string;
  /** linear gain on the file (files peak at −12 dBFS) */
  vol: number;
  /** pan −0.6 … 0.6, or a move [from, to] over `move` frames */
  pan: Pan;
  move?: number;
  /** playback rate: the light's tuning + a round-robin micro-detune */
  rate: number;
  room: 'night' | 'white';
  /** the family's group: bells and sparkles ride their own bus, which steps back under the voice */
  group: Group;
  /** room send / tempo-delay send (dB) */
  send: number;
  delay?: number;
  key: boolean;
  /** the hit lands while someone is speaking */
  speech: boolean;
  /** the picture's hit this cue answers, and what it is */
  hit: number;
  label: string;
};

/** Every spoken line on the absolute timeline. */
export const VOICES: { at: number; id: VoiceId }[] = [
  ...CALL.lines.map((l) => ({ at: at('call', l.at), id: l.voice })),
  { at: at('knowledge', KNOWLEDGE.ask), id: KNOWLEDGE.askVoice },
  { at: at('knowledge', KNOWLEDGE.answer), id: KNOWLEDGE.answerVoice },
  { at: at('cta', CTA.line), id: CTA.lineVoice },
  { at: at('cta', CTA.brandVoice), id: CTA.brandVoiceId },
];
/** Speech windows (absolute frames, whole lines) — the bed ducks under these. */
export const SPEECH = VOICES.map((v) => [v.at, v.at + vFrames(v.id)] as const);
/** Spoken phrases (absolute frames) — where someone is actually talking. */
export const PHRASES = VOICES.flatMap((v) =>
  VOICE.lines[v.id].phrases.map((p) => [v.at + p.start * FPS, v.at + p.end * FPS] as const),
);
/** Is someone speaking at frame f (± a little air around each phrase)? */
export const speaking = (f: number, before = 3, after = 5) => PHRASES.some(([a, e]) => f >= a - before && f <= e + after);
/**
 * Ducking under the voices. The bed drops `bedDb` across each line (ramped `ramp`
 * frames ahead, released over `release`); wherever the voice is actually sounding
 * (followed with a `lookahead`-second look-ahead, so first consonants are already clear)
 * the bed loses `eqDb` and the effects `sfxEqDb` in the speech band (≈1–5 kHz), the
 * effects' room + delay returns (their tails) drop `tailsDb`, and the sustained tonal
 * effects (bells, sparkles — they ring across words) drop `tonalDb` broadband
 * (`keyTonalDb` for key hits that land ON speech, e.g. the four CTA light chimes under
 * Ava's line; a key bell struck before a line — the logo chord — steps back the full `tonalDb`).
 */
export const DUCK = { bedDb: -5, eqDb: -6, sfxEqDb: -8, tailsDb: -6, tonalDb: -10, keyTonalDb: -5, lookahead: 0.04, ramp: 6, release: 12 } as const;

/* ── the cue builder ── */
const W_DB: Record<Weight, number> = { 1: 0, 2: -4, 3: -9 };
/** non-key hits under speech */
const SPEECH_DB = -5;
const DETUNE_CENTS = [0, 7, -6, 4, -8, 5, -3, 8];
const panOf = (x: number) => Math.max(-0.6, Math.min(0.6, (x - 0.5) * 1.2));
/** The white act (knowledge → the CTA iris) plays in a short bright room; everything else in the dark room. */
export const WHITE_ACT = [SCENES.knowledge.from - 1, SCENES.scale.from + SCALE.irisToDark[1] - 4] as const;
const fileOf = (s: Snd, k: number) => sfx(SFX[s].n > 1 ? `${s}-${k}.wav` : `${s}.wav`);

function buildCues(hits: Hit[]): Cue[] {
  // 1. merge: within a group, hits ≤ 2 frames apart keep only the heavier (then the bigger, then the first)
  const sorted = [...hits].sort((a, b) => a.at - b.at);
  const kept: Hit[] = [];
  for (const h of sorted) {
    const g = SFX[h.snd].group;
    if (g === 'sig' || h.layer) {
      kept.push(h);
      continue;
    }
    const rival = kept.find((k) => !k.layer && SFX[k.snd].group === g && Math.abs(k.at - h.at) <= 2);
    if (!rival) {
      kept.push(h);
      continue;
    }
    const score = (x: Hit) => -x.w * 10 + (SFX[x.snd].rank ?? 0);
    if (score(h) > score(rival)) kept.splice(kept.indexOf(rival), 1, h);
  }
  // 2. expand runs and splits, choose variants, tune, gain, pan, room
  const rr = new Map<Snd, number>();
  const cues: Cue[] = [];
  for (const h of kept.sort((a, b) => a.at - b.at)) {
    // a light chime under speech strikes soft (darker, no mallet): the word stays in front
    const snd = (/^chime-(rush|closing|sunday|night)$/.test(h.snd) && speaking(h.at) ? `${h.snd}-soft` : h.snd) as Snd;
    const def: SfxDef = SFX[snd];
    const run = h.run ?? { n: 1 };
    for (let j = 0; j < run.n; j++) {
      const hit = h.at + (run.offs ? run.offs[j] : j * (run.step ?? 0));
      const x = run.xs ? run.xs[j] : h.x;
      const parts: Pan[] = h.split ? [[-0.1, -0.55], [0.1, 0.55]] : [typeof x === 'number' ? panOf(x) : [panOf(x[0]), panOf(x[1])]];
      for (const pan of parts) {
        const c = rr.get(snd) ?? 0;
        rr.set(snd, c + 1);
        const semi = (def.tune ? LIGHT_SEMI[h.light] : 0) + (h.semi ?? 0) + (run.semis ? run.semis[j] : (run.semi ?? 0) * j);
        const cents = def.n > 1 || def.tune ? DETUNE_CENTS[c % DETUNE_CENTS.length] : 0;
        const rate = Math.pow(2, (semi + cents / 100) / 12);
        const key = h.w === 1;
        const talk = speaking(hit);
        // under speech: non-key hits −5 dB; sustained tonal sounds (bells, sparkles) a little more, keys included
        const tonal = def.group === 'bell' || def.group === 'spark';
        const dB =
          W_DB[h.w] + def.trim + (h.db ?? 0) + (talk && !key ? SPEECH_DB : 0) + (talk && tonal ? -3 : 0) + (h.split ? -3 : 0) -
          (run.xs ? 0 : j * (run.n > 3 ? 0.25 : 0.8));
        const start = hit - def.pk / rate;
        const room = hit >= WHITE_ACT[0] && hit < WHITE_ACT[1] ? 'white' : 'night';
        cues.push({
          at: start,
          file: fileOf(snd, c % def.n),
          vol: Math.pow(10, dB / 20),
          pan: run.n > 3 && !run.xs && typeof pan === 'number' ? Math.max(-0.6, Math.min(0.6, pan + ((j % 3) - 1) * 0.08)) : pan,
          move: Array.isArray(pan) ? def.pk + 10 : undefined,
          rate,
          room,
          group: def.group,
          send: def.send,
          delay: def.delay,
          key,
          speech: talk,
          hit,
          label: h.label + (run.n > 1 ? ` [${j + 1}/${run.n}]` : ''),
        });
      }
    }
  }
  return cues.sort((a, b) => a.at - b.at);
}

export const CUES: Cue[] = buildCues(HITS);

/** The music bed (synthesised to the film by generate-sfx.mjs; −20 dBFS peak, ducked in the mix). */
export const BED = { file: sfx('bed.wav'), vol: 1 };
/** The master: everything above, mixed to `lufs` integrated with a true-peak ceiling (dBTP). */
export const MIX = { file: sfx('mix.wav'), lufs: -15, ceiling: -1.5 } as const;
