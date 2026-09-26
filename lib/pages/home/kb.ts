import { KB_FAQ, KB_HERO, KB_META, LIMITS, ROOM, type KbQuestion } from "@/lib/pages/knowledge-base";
import { must } from "./source";

/* ─── #knowledge: answers from your documents ────────────────────── *
 * Read by the section's server shell, which hands its stage the strings
 * it shows; the knowledge-base page's copy never reaches a client chunk.
 */

/** How far a match must reach to be answered from (= knowledge-base/hero.tsx THRESHOLD). */
export const KB_THRESHOLD = 0.6;

export const HOME_KB = {
  eyebrow: KB_META.title,
  title: KB_HERO.title,
  key: "your own documents",
  sub: KB_HERO.sub,
  link: { label: KB_FAQ.title, href: "/product/knowledge-base" },
  room: {
    sample: ROOM.sample,
    caller: ROOM.caller,
    agent: ROOM.agent,
    pick: ROOM.pick,
    status: ROOM.status,
    foundIn: ROOM.foundIn,
    fallback: ROOM.fallback,
    missingOutcome: ROOM.missingOutcome,
    replay: ROOM.replay,
    pause: ROOM.pause,
    play: ROOM.play,
    docs: ROOM.docs,
  },
  // "cancel" is left out: the policy on screen does not support its answer.
  questions: ["access", "price", "gym", "home"].map((id) => must<KbQuestion>(ROOM.questions, id)),
  /** First view: a hit, then the honest miss, then it holds. */
  sequence: ["access", "home"],
  limits: { title: LIMITS.title, honest: LIMITS.honest },
} as const;
