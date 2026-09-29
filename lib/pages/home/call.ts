import { CALLS, OUTCOMES, PLATFORM } from "@/lib/pages/ai-agents";
import { GOOGLE_PLAN } from "./gates";
import { must } from "./source";

/* ─── #demo: closed is for the door, not the phone ───────────────── *
 * Imported by the demo, a client island: nothing here reaches past the
 * product page's own copy and the plan table. The four calls
 * themselves are built on the server (home.server.ts buildHomeCalls).
 */

/** The four moments, in the order the untouched stage tours them: busy, just gone, day off, asleep. */
export type HomeMomentId = "rush" | "closing" | "sunday" | "night";

// NEW. The product page's line opens "Every call is answered", which
// this page contradicts itself (the trial's minutes run out); the
// promise stays, the absolute goes.
const SUB = "Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush.";

/**
 * The sub's four phrases, one per moment. The demo sets each in its
 * moment's ink and lights the one that is playing, so each must appear
 * in the sub exactly once, spelled as it is there.
 */
const PHRASES = {
  night: "at 3 a.m.",
  sunday: "on a Sunday",
  closing: "just after closing",
  rush: "in the middle of a rush",
} as const satisfies Record<HomeMomentId, string>;

for (const phrase of Object.values(PHRASES)) {
  if (SUB.split(phrase).length !== 2)
    throw new Error(`lib/pages/home/call.ts: "${phrase}" is not in the sub exactly once`);
}

export const HOME_CALL = {
  eyebrow: `${CALLS.kicker}s`, // "Sample calls"
  // NEW. The stage's door sign says Closed on three of the four calls; the phone answers all four.
  // A no-break space holds "the door" together, so no phone ends a line on "the".
  title: "Closed is for the door, not the phone.",
  key: "not the phone.",
  sub: SUB,
  phrases: PHRASES,
  cta: { label: CALLS.cta.label, href: "#pricing" },
  stageLabel: `${PLATFORM.design.company} · a made-up business`, // NEW
  caption: "Written for this page · no audio", // NEW
  speakers: { agent: PLATFORM.design.agent, caller: CALLS.labels.client },
  // after-call.tsx and voice.tsx read these too.
  controls: {
    play: CALLS.labels.play,
    pause: CALLS.labels.pause,
    replay: CALLS.labels.replay,
  },
  outcome: "Booked · Wednesday 15:00", // NEW, composed from ai-agents.ts:78
  // NEW, composed from the reel's "Answered from your documents · rescheduled" (ai-agents.ts:108).
  moved: "Rescheduled · Tuesday 10:00",
  picker: {
    legend: "Pick a time · sample calls", // NEW
    // "Mid-rush" and "After closing" are NEW; the other two are the sub's own words.
    keys: {
      rush: "Mid-rush",
      closing: "After closing",
      sunday: "Sunday",
      night: "3 a.m.",
    } satisfies Record<HomeMomentId, string>,
    name: (label: string, day: string, time: string) => `${label}, ${day} ${time}, sample call`, // NEW
  },
  status: {
    ringing: must(OUTCOMES.items, "capture").labels.from, // "Ringing"
    picked: "Picked up on the first ring", // NEW, the sub's promise
    ended: "Call ended", // NEW
  },
  sign: { open: "Open", closed: "Closed" }, // NEW
  owner: {
    label: "The owner", // NEW
    log: "In the owner's call log", // NEW
    // NEW. Where the owner is while the call is taken: before, and once it has ended.
    moments: {
      rush: {
        before: "With a client.",
        after: "Still with the client.",
        clause: "The billing problem is flagged for later.",
      },
      closing: {
        before: "Locking up.",
        after: "On the way home.",
        clause: "The session is moved in the calendar.",
      },
      sunday: {
        before: "Off for the day.",
        after: "Still off.",
        clause: "Answered from the opening hours.",
      },
      night: {
        before: "Asleep.",
        after: "Still asleep.",
        clause: "The booking is in the calendar.",
      },
    } satisfies Record<HomeMomentId, { before: string; after: string; clause: string }>,
  },
  // NEW. Booking by phone needs a plan the trial and the entry plan
  // don't have; the plan is read off the entitlements (gates.ts).
  foot: `Bookings go to Google Calendar — in beta, on ${GOOGLE_PLAN} and above`,
  transcriptTitle: "Transcripts of the four sample calls", // NEW
  announce: (day: string, time: string, outcome: string) => `Sample call, ${day} ${time}: ${outcome}.`, // NEW
} as const;
