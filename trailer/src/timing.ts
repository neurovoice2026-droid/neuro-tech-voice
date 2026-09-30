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
  anticipation: b(7.5), // text gathers itself before it breaks
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
    { at: b(10), who: 'caller', text: "Three o'clock is perfect." },
    { at: b(11.5), who: 'agent', text: "You're booked for Wednesday at 15:00." },
  ] as const,
  /** Slot chips pop as their times are typed in line 3 (frames after line 3 starts). */
  slotPops: [12, 18] as const,
  /** The caller's pick selects the 15:00 chip. */
  slotPick: b(10) + 10,
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
