/* ------------------------------------------------------------------ *
 * The content schema for the sixteen industry pages.
 *
 * The point of this file is that a page cannot claim something the agent
 * cannot do. Every outcome a page shows has to name the tool that
 * produced it, and the tool names are the union the voice runtime itself
 * uses — so `from: 'assign_adjuster'` is a build error, not a review
 * catch. The menu currently promises "Claim opened · adjuster assigned"
 * and "Replacement authorised"; neither tool exists, and this is how
 * that stops happening at scale.
 *
 * The plan gate shown beside a field is derived the same way: a field
 * names a tool, the tool needs a capability, the capability needs a
 * plan. Nobody types "Pro" anywhere in a trade's data.
 * ------------------------------------------------------------------ */

import type { VoiceToolName } from "@/lib/voice/contracts";
import type { ToolCapabilities } from "@/lib/voice/tools/definitions";
import type { Plan } from "@/types";

export type Capability = keyof ToolCapabilities;

/* ------------------------------------------------------------------ *
 * WHAT THE TOOLS ACTUALLY RETURN.
 *
 * The type system can only check that a tool NAME is real. It cannot
 * check that the sentence beside it describes something the tool can do,
 * and an audit of the first sixteen pages found that this is exactly
 * where the lies collect. Read this before writing a single `then:`,
 * `asks:` or receipt line:
 *
 *   check_availability   Free start times. It does not say why somebody
 *                        is busy — never "out on a survey", never a
 *                        class capacity, never a room count.
 *   book_appointment     A booking id and the confirmed time. It does
 *                        not report how many places are left.
 *   find_booking         UPCOMING appointments booked under THE CALLER'S
 *                        OWN NUMBER. Not past ones, so it cannot answer
 *                        "is my car ready". Not somebody else's, so an
 *                        engineer ringing about a tenant's flat finds
 *                        nothing.
 *   cancel_appointment   Whether the cancellation worked. It notifies
 *                        nobody, knows no cut-off, charges no fee, and
 *                        must follow find_booking.
 *   add_to_waitlist      Whether they were added. There is no position
 *                        on the list and no queue to read back.
 *   search_knowledge     Passages from the BUSINESS'S OWN DOCUMENTS.
 *                        There is no customer record, no policy file, no
 *                        order history and no stock level anywhere in
 *                        the product. And it is never mentioned to the
 *                        caller.
 *   send_sms             A text to the caller's number.
 *   take_message         Stores a message.
 *   notify_team          Tells the team during the call.
 *   transfer_call        Puts the caller through.
 *   save_lead_details    Stores the fields the owner asked for.
 *   end_call             ONLY exists in the self-hosted pipeline, so it
 *                        must never be described as working on any plan.
 *
 * There is no tracking feed, no courier integration, no reminder system,
 * no email, no payment and no CRM. If a sentence needs one of those, the
 * sentence does not go on the page.
 * ------------------------------------------------------------------ */

/**
 * Which capability each tool needs before it can run on a live call.
 *
 * Read off `computeCapabilities` in lib/voice/session-loader.ts. `null`
 * means the tool runs on every call on every plan — the universal floor,
 * and the reason the law-firm page can demonstrate its whole spine
 * without ever showing an upgrade badge.
 */
export const TOOL_NEEDS: Record<VoiceToolName, Capability | null> = {
  get_call_context: null,
  search_knowledge: "knowledge",
  check_availability: "calendar",
  book_appointment: "calendar",
  find_booking: "calendar",
  reschedule_appointment: "calendar",
  cancel_appointment: "calendar",
  add_to_waitlist: "waitlist",
  send_sms: "sms",
  take_message: null,
  notify_team: null,
  transfer_call: "transfer",
  save_lead_details: "lead_fields",
  end_call: null,
};

/**
 * The plan each capability needs, from `entitlementsFor`.
 *
 * `knowledge`, `transfer`, `take_message` and `lead_fields` are not plan
 * features — they are switched on by connecting something or by saving a
 * contact, which every plan may do. They gate on setup, not on money,
 * and the page says so rather than implying an upsell.
 */
export const CAPABILITY_PLAN: Record<Capability, Plan | null> = {
  calendar: "pro",
  waitlist: "pro",
  sms: "starter",
  knowledge: null,
  transfer: null,
  take_message: null,
  lead_fields: null,
};

/** What a capability needs switched on, in the owner's words. Null = nothing. */
export const CAPABILITY_SETUP: Record<Capability, string | null> = {
  calendar: "Google Calendar connected",
  waitlist: "Google Calendar connected",
  sms: "a text-capable number",
  knowledge: "your documents added",
  transfer: "a team contact saved",
  take_message: null,
  lead_fields: null,
};

/** The gate to print beside a field, or null when it runs on any plan with no setup. */
export function gateFor(tool: VoiceToolName): { plan: Plan | null; setup: string | null } | null {
  const capability = TOOL_NEEDS[tool];
  if (!capability) return null;
  const plan = CAPABILITY_PLAN[capability];
  const setup = CAPABILITY_SETUP[capability];
  if (!plan && !setup) return null;
  return { plan, setup };
}

/* ------------------------------------------------------------------ *
 * §1 The first question — the fork
 * ------------------------------------------------------------------ */

/**
 * One prong of the opening fork: one of the three kinds of work this
 * trade's phone brings in.
 *
 * These are ordinary business calls — someone who needs a plumber for
 * their flat, a table on Friday, a viewing on Saturday. The page is
 * about the work, not about disasters. Exactly one prong per trade is
 * marked `urgent`, meaning it has to happen today, and the page takes
 * that one on its own because it is the call that is most expensive to
 * miss. Ember ink is allowed only there, and only on the trades whose
 * work genuinely has a same-day clock on it.
 *
 * The rare call that is not business at all — a gas smell, a sounding
 * alarm, someone hurt — is not a prong. It is a handover, and it lives
 * in the relay, where it belongs.
 */
export type Prong = {
  id: string;
  /** The kind of work, two or three words. */
  label: string;
  /** Completes "It ___" in the H1 — what the agent does with this call. ≤ 42 chars. */
  does: string;
  /** The caller's own opening line. ≤ 95 characters; it wraps to two lines. */
  caller: string;
  /** What the agent does about it, in one or two sentences. */
  asks: string;
  urgent?: true;
};

/* ------------------------------------------------------------------ *
 * §2 The bench — intents and the tool they reach for
 * ------------------------------------------------------------------ */

export type Intent = {
  /** The caller's words, as badly as they really say it. Chip label, ≤ 34 chars. */
  chip: string;
  /** The tool the agent reaches for first. */
  reaches: VoiceToolName;
  /** The agent's next line — what the tool let it ask or answer. ≤ 110 chars. */
  then: string;
};

/* ------------------------------------------------------------------ *
 * §3 Run it — the call and the trade's own artefact
 * ------------------------------------------------------------------ */

export type Turn = {
  /** Seconds from the start of the call. */
  at: number;
  side: "caller" | "agent";
  text: string;
};

export type ToolRun = {
  at: number;
  tool: VoiceToolName;
  /** Round-trip in ms, as the tool log prints it. Real order of magnitude, not decoration. */
  ms: number;
};

/**
 * One field of the artefact the call produces.
 *
 * `from` is the tool whose return filled it, or `'caller'` when the
 * caller simply said it. That is the whole reversibility argument: drag
 * the playhead back past `at` and this field is not merely hidden, it is
 * un-caused.
 */
export type RigField = {
  id: string;
  label: string;
  value: string;
  at: number;
  from: VoiceToolName | "caller";
  /** Dropped first on a 390px screen. Four fields survive; the rest are `false`. */
  onPhone: boolean;
};

export type Rig = {
  /** What this object is called in the trade. "Job card", "Booking slip", "Collection". */
  title: string;
  /**
   * The shape it is drawn as.
   *
   * Sixteen values for sixteen trades, and no two may share one. If a
   * trade could borrow another trade's artefact then its page is the
   * other trade's page with the nouns swapped, which is the exact
   * failure this whole schema exists to prevent.
   */
  form:
    | "job-card"
    | "viewing"
    | "slip"
    | "matter"
    | "bay"
    | "consignment"
    | "chair"
    | "triage"
    | "policy"
    | "unit"
    | "room"
    | "consult"
    | "order"
    | "enrolment"
    | "class"
    | "appointment";
  fields: RigField[];
  /** The line that inks under it when the call ends. No tool name, the owner's words. */
  receipt: string;
};

/* ------------------------------------------------------------------ *
 * §4 The wall — and the retraction
 * ------------------------------------------------------------------ */

/**
 * The refusal, under escalating pressure.
 *
 * `detents` are what a pushy caller actually escalates to, in this
 * trade's words. The wording of the refusal changes at each one; its
 * shape never does.
 */
export type Wall = {
  /** What it will not do, completing "It will not ___". */
  never: string;
  /** The clause in the system prompt that stops it, quoted. */
  clause: string;
  /** Where that clause lives, so a sceptic can be shown it is server-side. */
  clauseSource: string;
  /**
   * `agent` is omitted at the detent the retraction owns: there, the
   * answer IS the retraction, and repeating it as a plain line in the
   * data would be the same sentence written twice.
   */
  detents: { caller: string; agent?: string }[];
  /**
   * The retraction: the agent beginning to say the forbidden thing and
   * stopping itself mid-word.
   *
   * Every vendor in this category asserts its safety with a badge or a
   * pair of tidy chat bubbles. None of them has ever shown its own
   * product start to fail and catch itself, which is the only form of
   * the claim an owner actually believes — because what frightens them
   * is not that it will be stupid, it is that it will be confident.
   *
   * `begins` is cut mid-word on purpose. The last characters are not a
   * typo and no dash belongs at the end of it.
   */
  retraction: { atDetent: number; begins: string; instead: string };
  /** The one line that does cross the wall: escalation to a person. */
  crosses: string;
};

/* ------------------------------------------------------------------ *
 * §5 The relay
 * ------------------------------------------------------------------ */

export type Relay = {
  /** Why this call cannot be finished by the agent, in the trade's terms. */
  because: string;
  /** Who is paged. A role, never a name we invented. */
  who: string;
  /**
   * How the person in `who` is reached.
   *
   * `send_sms` is deliberately not in this union. It texts the caller's
   * own number and cannot text anyone else, so it can never be the way a
   * colleague is reached — the texting people reach for here is the one
   * `notify_team` already does.
   */
  by: Extract<VoiceToolName, "notify_team" | "transfer_call" | "take_message">[];
  /** What is in the message when it lands. */
  carries: string[];
  /** Seconds from the caller saying it to the human knowing. Derived from the turn timings. */
  seconds: number;
};

/* ------------------------------------------------------------------ *
 * §6 Your rules
 * ------------------------------------------------------------------ */

export type Rule = {
  /** The rule in the trade's own voice, as an owner would write it. */
  label: string;
  /** How the §2 answer reads when this rule is on. */
  changes: string;
  on: boolean;
};

/* ------------------------------------------------------------------ *
 * The trade
 * ------------------------------------------------------------------ */

/**
 * A figure we worked out ourselves rather than one we found published.
 *
 * Printed with the reasoning beside it, every time, because three of the
 * sixteen researchers independently concluded that the vendor statistics
 * in this category do not survive contact with an owner who checks. No
 * annual loss totals: the reader multiplies by their own call count or
 * the number does not appear.
 */
export type OwnEstimate = {
  value: string;
  /** "our estimate, from the shape of the working week" — always in our own voice. */
  reasoning: string;
};

/** A published figure we are willing to stand behind: publisher, date and sample, inline. */
export type Citation = {
  claim: string;
  publisher: string;
  /**
   * Publication date, in exactly the precision the source states:
   * "2026-01-27", "2026-01" or "2026". Never invent a day to satisfy a
   * format — a page whose argument is that vendor statistics dissolve on
   * contact with their source cannot itself assert eight publication
   * dates it does not have.
   */
  date: string;
  /** What was actually measured, including the sample. */
  sample: string;
  /** Named when the publisher sells something in this category. */
  interest?: string;
};

/**
 * Everything a page needs about one trade.
 *
 * Plain data on purpose: every section of these pages is a client
 * component, so the whole object crosses the server boundary and must
 * stay serialisable. That is why the trade's icon is not here — it lives
 * once, in NAV_INDUSTRIES, and a Lucide component cannot be sent to the
 * client anyway.
 */
export type Trade = {
  slug: string;
  /** Matches NAV_INDUSTRIES so the menu and the page cannot drift. */
  label: string;

  /**
   * The line above the H1 — what is happening at the business while the
   * phone rings, in this trade's own terms. One sentence, ≤ 74 chars.
   */
  kicker: string;
  /** One line under the H1: what the agent does across all three kinds of call. */
  standfirst: string;

  prongs: [Prong, Prong, Prong];
  intents: Intent[];

  turns: Turn[];
  toolRuns: ToolRun[];
  rig: Rig;
  /** Length of the sample call in seconds. The rail's axis. */
  duration: number;

  wall: Wall;
  relay: Relay;
  rules: [Rule, Rule, Rule];

  /**
   * Which semantic inks this trade may use.
   *
   * `ember` only where the work genuinely has a same-day clock on it —
   * a leak, a breakdown, a pet that is unwell. `settled` only where
   * something on the call is genuinely confirmed. The advisory trades
   * get neither: nothing on a legal or an insurance call is confirmed by
   * the end of it, and the absence of the colour is the argument.
   */
  ink: { ember: boolean; settled: boolean };

  /** Questions this trade's owners actually ask, beyond the first objection. */
  faq: { q: string; a: string }[];

  /** Vocabulary an insider uses. Used for the chips and the field names. */
  jargon: string[];

  missRate: OwnEstimate;
  valuePerCall: OwnEstimate;
  citations: Citation[];

  /** The first objection an owner raises, and the honest answer. Feeds the FAQ. */
  objection: { asks: string; answer: string };
};
