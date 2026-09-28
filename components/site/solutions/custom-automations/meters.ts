import type { BlockKind } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * "What makes it hard", worked out from a flow's blocks: the meters
 * under the workbench's caption and beside each #work sample.
 *
 * The page says it automates any work, however hard, and shows it: the
 * workbench's four lenses run simplest first, and #work's three levels
 * go from a copy-paste to a pipeline. How hard one is has to be seen to
 * grow, so each flow carries the same six meters: how many blocks it
 * takes, and whether it needs a rule to decide, AI to read or write, a
 * person told or asked, a schedule to start it, and a guard so it never
 * does the same thing twice. Each is one of those things or it isn't.
 *
 * COMPUTED, NEVER TYPED. A meter is read off the blocks the flow is
 * drawn with, so it can't claim a rule the drawing doesn't have, and a
 * block added to a lens moves its meters with it. The caller hands over
 * the kinds that make the flow: a lens's blocks without its end cards (a
 * branch that stops is not a block that runs), a sample's blocks in move
 * order. lib/pages/custom-automations.test.ts imports this module and
 * holds each lens's meters to the build spec's table, and `hardCount` to
 * rising along the lenses.
 *
 * WHAT COUNTS. A person is a block that tells one (`person`) or waits
 * for one's yes (`approve`): either way the flow needs somebody. A
 * schedule is a `time` block, a clock that starts the run, where a
 * `when` block waits for something to happen. The block count is every
 * block, repeats and all: a flow that writes to two systems has two
 * write blocks to build.
 *
 * PURE: types only from the data module, which is server-only, so the
 * client islands can import it.
 * ------------------------------------------------------------------ */

export type Meters = {
  /** Every block the flow is made of. */
  blocks: number;
  /** A rule decides what runs next. */
  rules: boolean;
  /** AI reads, sorts or writes something. */
  ai: boolean;
  /** A person is told, or asked for their yes. */
  person: boolean;
  /** A clock starts it, not an event. */
  schedule: boolean;
  /** A guard keeps it from doing the same thing twice. */
  once: boolean;
};

/** The five yes-or-no meters, in the order they are printed (METER_COPY's). */
export const METER_FLAGS = ["rules", "ai", "person", "schedule", "once"] as const satisfies readonly (keyof Meters)[];

/** A flow's meters, read off the kinds of the blocks it is made of. */
export function metersOf(kinds: readonly BlockKind[]): Meters {
  const has = (...k: BlockKind[]) => kinds.some((kind) => k.includes(kind));
  return {
    blocks: kinds.length,
    rules: has("rule"),
    ai: has("ai"),
    person: has("person", "approve"),
    schedule: has("time"),
    once: has("once"),
  };
}

/** How many of the five yes-or-no meters a flow meets: how hard it is, as the lenses and levels climb. */
export function hardCount(m: Meters): number {
  return METER_FLAGS.filter((f) => m[f]).length;
}
