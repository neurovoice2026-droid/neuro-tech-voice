import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/crm-erp — every word on the page.
 *
 * The page's argument is that we design and build CRMs, ERPs and
 * anything between, for any business, of any size and complexity, in
 * whatever technology suits it, shaped around the client's own process;
 * and that a CRM's hard parts — a record of every call, bookings under a
 * lock with a waiting list, messages and texts, payments and fiscal
 * invoices, usage billed once, reports in each business's own time zone
 * and exports that open safely — already run here, on this platform, our
 * own, for AI phone agents: the proof, never the limit. What it lacks
 * (quotes, orders, stock, purchasing and roles) is marked once, in #core,
 * and built for yours. The customer record is "Partly here": there is no
 * customers table, a customer is the caller's number and history links by
 * call_id, and app/api/contacts is each business's own team, so it is
 * never printed as customers.
 *
 * Read, never retyped, where the source is safe to read: SOLUTION_ITEMS
 * (this item, and the SaaS, Automations, Mobile and agent items for
 * links), COMPANY, PRICING_TRIAL, SOLUTIONS_MENU; the SaaS module's FACTS,
 * ACCREDITATIONS, GRANTS, CHECK_KINDS, listJoin, its FAQ's region
 * sentences, two of its checks rows and three of its scope parts (each by
 * id); CAA_HANDOVER.after; INT_GOOGLE's Beta badge; and the platform's own
 * pure constants: CALL_OUTCOMES, AGENT_LIMITS, SMS_LANGUAGES, INBOX_TABS,
 * ACTION_TYPES and GOOGLE_ACTION_INTEGRATION.
 *
 * Retyped in FACTS_ERP, each held by lib/pages/crm-erp.test.ts to its
 * source: what lives in SQL (the tables and their row-level security, the
 * CHECK lists), in route files, or in modules that pull a server graph.
 * app/api/calls/_lib/query.ts runs lib/zod-setup when imported, so the
 * test imports its export constants and this module never does.
 *
 * Two line marks, which the test reads this file's source for:
 * - `// OWNER`: rests on the owner's word — every promise about the
 *   reader's build, every capability, every tool yours connects to, and
 *   everything "shown on request";
 * - `// SAMPLE`: written for the page — no business name, brand, digit or
 *   "client".
 *
 * This module is server-only. Client islands receive their slice as plain
 * props from the server page and import TYPES only, so nothing here — nor
 * the SaaS module's csp.ts graph it reads through — reaches the browser.
 *
 * No price, date, client, logo, testimonial, time-saved figure or badge
 * appears, and no product is named: "Off the shelf, or built for you?"
 * compares kinds of product, each with what it's good at, and the built
 * route with its own costs. The accreditations are personal and the grants
 * are the company's; neither is a certification, and #team says so once.
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true. The module
 * evaluates top to bottom, so CORE_PARTS (whose kinds the steps and the
 * samples' tags read), STEPS, SAMPLES and the move's stages are declared
 * before the section consts that hold them, and the credits come last.
 * ------------------------------------------------------------------ */
import { COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { sentences } from "@/lib/pages/home/source";
import {
  ACCREDITATIONS, CHECK_KINDS, FACTS, GRANTS, SAAS_CHECKS, SAAS_FAQ, SAAS_SCOPE, listJoin,
  type Check, type CheckKind, type CheckRow, type ChecksData, type CreditsData, type FaqData, type FaqItem,
  type HeroData, type Link, type StartData, type TermsData,
} from "@/lib/pages/custom-saas-platforms";
import type { TeamData } from "@/lib/pages/custom-automations";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { INT_GOOGLE } from "@/lib/pages/integrations";
import { CALL_OUTCOMES } from "@/types";
import { AGENT_LIMITS } from "@/lib/voice/sync/limits"; // pure: "No zod here"
import { SMS_LANGUAGES } from "@/lib/sms/templates"; // pure, client-safe
import { INBOX_TABS } from "@/components/inbox/inbox-tabs"; // pure
import { ACTION_TYPES, GOOGLE_ACTION_INTEGRATION } from "@/lib/workflows/types"; // no server imports

/* ---------- guards ---------- */

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "crm-erp");
if (!ITEM) throw new Error("crm-erp: SOLUTION_ITEMS lost crm-erp");
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms");
if (!SAAS_ITEM) throw new Error("crm-erp: SOLUTION_ITEMS lost custom-saas-platforms");
const AUTO_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations");
if (!AUTO_ITEM) throw new Error("crm-erp: SOLUTION_ITEMS lost custom-automations");
const MOB_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-mobile-applications");
if (!MOB_ITEM) throw new Error("crm-erp: SOLUTION_ITEMS lost custom-mobile-applications");
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
if (!CAA_ITEM) throw new Error("crm-erp: SOLUTION_ITEMS lost custom-ai-agents");
// The FAQ's first question quotes "Voice" from the company's name: a new name must be re-read there.
if (!/\bVoice\b/.test(COMPANY.name)) throw new Error("crm-erp: the company name lost “Voice”; re-read ERP_FAQ’s “breadth” row");
// #core's layer labels are the stack, read. The hero's plates are this
// page's own layers, not the stack's: an "Inventory" plate would say stock
// runs here, and it doesn't.
if (ITEM.stack.join("|") !== "Sales|Inventory|Invoicing|Reporting")
  throw new Error("crm-erp: ITEM.stack changed; re-read #core’s layer labels and the hero’s plates");
// Stages 02 and 03 are the first two deliverables, read; the third is
// voice-centric, so it is printed once, qualified, in "What you get".
if (ITEM.deliverables.length !== 3 || !/agent call/i.test(ITEM.deliverables[2]))
  throw new Error("crm-erp: ITEM.deliverables changed; re-read #move’s stage titles and #terms’ “What you get”, with its qualified third line");
// #shape's title is the promise, read, and its key is copied from it.
if (!/not the other way round/.test(ITEM.promise)) throw new Error("crm-erp: ITEM.promise changed; re-read #shape’s title and key");
// The follow-up step and the messages card name the booking reminders.
if (!FACTS.cronSteps.includes("booking_reminders")) throw new Error("crm-erp: the daily job lost “booking_reminders”; re-read the follow-up step and the messages card");
// Every sentence naming a Google connection says "in beta" (#move's connect list, the FAQ's connect row).
if (INT_GOOGLE.badge !== "Beta") throw new Error("crm-erp: Google left beta: say so, and drop every “in beta”");
// The connect list names webhooks, Slack, texts and four Google workflow steps.
if (!(["send_webhook", "notify_slack", "send_sms"] as const).every((a) => ACTION_TYPES.includes(a)))
  throw new Error("crm-erp: a workflow step the connect list names is gone; re-read ERP_MOVE.stays and the FAQ’s connect row");
const GOOGLE_STEPS = Object.values(GOOGLE_ACTION_INTEGRATION);
if (!(["gmail", "google_sheets", "google_docs", "google_drive"] as const).every((g) => GOOGLE_STEPS.includes(g)))
  throw new Error("crm-erp: a Google workflow step the connect list names is gone; re-read ERP_MOVE.stays and the FAQ’s connect row");
// The messages card: "one inbox … beside every booking and the waiting list".
if (INBOX_TABS.join("|") !== "messages|bookings|waitlist") throw new Error("crm-erp: the inbox’s tabs changed; re-read the messages card");
// "Up to twelve questions", in the fields card.
if (AGENT_LIMITS.leadFields !== 12) throw new Error("crm-erp: the lead questions’ limit changed; re-read the fields card");

/* ---------- facts ---------- */

/**
 * Retyped, because their sources are route files, SQL, or modules that pull a
 * server graph. Each is held by lib/pages/crm-erp.test.ts to its source. All exact.
 */
export const FACTS_ERP = {
  tables: 23, // distinct CREATE TABLE in supabase/migrations/*.sql, each with ENABLE ROW LEVEL SECURITY
  evidenceOutcomes: 5, // EVIDENCE_ONLY_OUTCOMES (lib/openai/analysis.ts, not exported)
  bookingStates: ["booked", "rescheduled", "cancelled", "completed", "no_show"], // 010 bookings CHECK
  waitlistStates: ["waiting", "offered", "booked", "removed"], // 010 waitlist_entries CHECK
  messageStates: ["new", "notified", "read", "done"], // 010 agent_messages CHECK
  textKinds: ["confirmation", "reminder", "custom", "notification", "waitlist_offer", "inbound"], // 010 sms_messages CHECK
  invoiceStates: ["issued", "failed", "reversed"], // 006 invoices CHECK
  exportColumns: 13, // EXPORT_COLUMNS.length (app/api/calls/_lib/query.ts)
  exportRows: 5000, // EXPORT_ROW_LIMIT
  chartDays: [7, 30, 90], // calls-chart/route.ts z.enum(['7', '30', '90'])
} as const;

/* ---------- helpers ---------- */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** The chart's views in words: the honesty test bans a digit before "days". Held to FACTS_ERP.chartDays by the test. */
const DAYS_WORD: Record<(typeof FACTS_ERP.chartDays)[number], string> = { 7: "seven", 30: "thirty", 90: "ninety" };
/** "a, b or c": listJoin's "or", no Oxford comma. */
const listOr = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
/**
 * An identifier held whole: a word joiner (U+2060) after each hyphen, so
 * the browser never breaks "eu-west-1" after one (Mobile's `whole`). It
 * draws nothing and is not read aloud.
 */
const whole = (id: string) => id.replaceAll("-", "-⁠");
const EU_WEST = whole("eu-west-1");
// Every title's coloured phrase (HomeHeading `titleKey`) must be copied
// from the title itself, and never be its first word.
const keyed = <T extends { title: string; key: string }>(s: T): T => {
  if (s.title.lastIndexOf(s.key) <= 0) throw new Error(`crm-erp: "${s.key}" is not in "${s.title}"`);
  return s;
};

/* ---------- shared copy ---------- */

// "20+": the plus only while the count is a floor, as #team's tally draws it (SaaS Tally, `orMore`).
const ACC = `${ACCREDITATIONS.count}${ACCREDITATIONS.orMore ? "+" : ""}`;
const GRANTORS = listJoin(GRANTS.map((g) => g.grantor)); // "Cartesia and ElevenLabs"
// There is no /contact page and no form: a build starts with a phone call.
const CALL: Link = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref }; // "Call us about a build"
const TRIAL_LINK: Link = { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href }; // "Start free" → /register
// While there's no public link, the accreditations and grants are shown on
// the call (the SaaS logic). The kind tag says "On the call".
const accCheck: Check = ACCREDITATIONS.verify
  ? { kind: "site", label: "See the accreditations", href: ACCREDITATIONS.verify.href }
  : { kind: "call", label: "Ask to see the accreditations" }; // OWNER: that we show them on request
// The first grant with a public link turns the grants' check into a site link.
const grantLink = GRANTS.find((g) => g.verify)?.verify;
const grantCheck: Check = grantLink
  ? { kind: "site", label: "See the grants", href: grantLink.href }
  : { kind: "call", label: "Ask to see the grants" }; // OWNER: that we show them on request
// Built from the list so it reads true for one grantor or several.
const grantsClaim = `${GRANTORS} ${GRANTS.length === 1 ? "awarded" : "each awarded"} our company a startup grant.`;
// The region sentences, read from the SaaS FAQ as Automations and Mobile
// read them, so the pages can't disagree about where a copy of a call is.
const SAAS_DATA = SAAS_FAQ.items.find((i) => i.id === "data");
if (!SAAS_DATA) throw new Error("crm-erp: SAAS_FAQ lost its data answer; re-read ERP_FAQ’s data row");
const REGION_SAID = sentences(SAAS_DATA.a, 1, 5); // throws if that answer is reshaped
if (!REGION_SAID.includes("eu-west-1 (Ireland)")) throw new Error("crm-erp: the SaaS FAQ no longer puts the database in eu-west-1 (Ireland); re-read ERP_FAQ’s data row");
// This page's copy only, held whole; the SaaS module is untouched.
const REGION = REGION_SAID.replaceAll("eu-west-1", EU_WEST);
/** A SaaS checks row, by id, never by position: the same object, never retyped. */
const saasRow = (id: string): CheckRow => {
  const row = SAAS_CHECKS.rows.find((r) => r.id === id);
  if (!row) throw new Error(`crm-erp: SAAS_CHECKS lost "${id}"; re-read ERP_CHECKS`);
  return row;
};
/** A SaaS scope part, by id: the usage card reads its words; the caveat card and stage 02 lean on the other two. */
const scopePart = (id: "usage" | "teams" | "import") => {
  const p = SAAS_SCOPE.parts.find((x) => x.id === id);
  if (!p) throw new Error(`crm-erp: SAAS_SCOPE lost "${id}"`);
  return p;
};
if (scopePart("usage").kind !== "does") throw new Error("crm-erp: SAAS_SCOPE’s usage is no longer done on ours; re-read the usage card");
// "Each business account on it has a single owner": the caveat card and the FAQ's users row.
if (scopePart("teams").kind !== "none" || !/single owner/.test(scopePart("teams").ours))
  throw new Error("crm-erp: SAAS_SCOPE’s teams no longer says “single owner”; re-read the caveat card and the FAQ’s users row");
// "This platform started empty, so it had nothing to move": stage 02's "On ours".
if (scopePart("import").kind !== "none" || !/started empty/.test(scopePart("import").ours))
  throw new Error("crm-erp: SAAS_SCOPE’s import no longer says “started empty”; re-read stage 02’s “On ours”");

/** The export check, said once and pointed at from three places. */
const EXPORT_HOW = "Turn on ‘Show test calls’ under Calls, then Export: ‘Calls in the current view’. ‘Every call’ leaves test calls out.";

/* ---------- section ids and shared types ---------- */

export const SECTION_IDS = ["top", "process", "shape", "move", "core", "team", "terms", "checks", "faq", "start"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export type { Check, CheckKind, CheckRow, ChecksData, CreditsData, FaqData, FaqItem, HeroData, Link, StartData, TeamData, TermsData };

/* Shared: a part of this platform, as #process, #shape and #core name it */
export type CoreId = "history" | "fields" | "bookings" | "messages" | "yours" | "invoicing" | "usage" | "reports" | "exports";
/** Runs here | Partly here | Built for yours. */
export type Kind = "does" | "thin" | "none";

/* #process */
export type LaneId = "sales" | "ops" | "accounts" | "auto";
export type StepId = "enquiry" | "quote" | "followup" | "order" | "stock" | "delivery" | "invoice" | "report";
export type PaperFace = "inbox" | "document" | "note" | "sheet" | "grid" | "calendar" | "invoice" | "chart";
export type StepGlyphId = StepId; // one lucide glyph per step (glyphs.tsx)
export type ScreenBlock =
  | { kind: "field"; label: string } // a label over a grey bar
  | { kind: "lines"; heads: readonly [string, string, string]; rows: 2 | 3; total?: string } // column heads, grey cells
  | { kind: "chip"; label: string; tone: "done" | "wait" } // a status chip in words
  | { kind: "stages"; items: readonly string[]; current: number } // a stage strip
  | { kind: "slots"; label: string } // a small calendar grid, one slot marked in words
  | { kind: "panels"; items: readonly [string, string, string] } // three small chart panels, labelled, no numbers
  | { kind: "tick"; label: string }; // a row with a tick glyph and words
export type Screen = { title: string; blocks: readonly ScreenBlock[] }; // title ≤ 16; 2–4 blocks; every label ≤ 28
/** A hotspot's visible label, and its accessible name: the label, then " — opens " and the next screen's title. */
export type Cta = { label: string; aria: string };
export type ProcessStep = {
  id: StepId; n: "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";
  label: string; // ≤ 9: the rail, the card, the live line
  lane: LaneId;
  paper: { title: string; where: string; pain: string; face: PaperFace }; // title ≤ 12, where ≤ 22, pain ≤ 24
  today: string; // 45–62 characters
  system: string; // 45–62 characters; read by holdFor on the tour
  kind: Kind; // this step's part on this platform
  ours: string; // ≤ 110; never opens with a kind's words: the tag just before it prints them
  core: CoreId; // the #core card its link opens
  files: readonly string[]; // empty exactly when kind is "none"; each exists
  history: string; // ≤ 30: the record's line for this step
  status: string; // ≤ 12: the order's status once this step has arrived
  screen: Screen;
  go: Cta;
};
export type HandoffMark = "typed" | "counted";
export type Handoff = { from: StepId; to: StepId; mark: HandoffMark; text: string }; // text ≤ 60
export type ProcessView = "today" | "one";
export type ProcessData = {
  eyebrow: string; title: string; key: string; sub: string;
  tag: string;
  viewLabel: string; views: readonly { id: ProcessView; label: string }[];
  transport: { play: string; pause: string; replay: string };
  restart: string; stepsLabel: string; stepOf: string;
  lanesLabel: string; lanes: readonly { id: LaneId; label: string; today?: string }[];
  steps: readonly ProcessStep[];
  handoffs: readonly Handoff[];
  marks: Record<HandoffMark, string>;
  intro: { mark: string; text: string }; // the caption before a step, in Today
  caption: { who: string; today: string; system: string; ours: string; see: Record<Kind, string> };
  kinds: Record<Kind, string>;
  /** Each #core card's kind, read from CORE_PARTS: a caption's link is worded `see[coreKinds[step.core]]`, by the card it opens. */
  coreKinds: Record<CoreId, Kind>;
  legend: { typed: string };
  tally: Record<ProcessView, string>; // computed from the data
  record: {
    chrome: string; pill: string; customer: string; statusLabel: string; history: string; toCome: string; hint: string;
    todayTitle: string; todayFoot: string;
  };
  live: string; liveView: string;
  indexSummary: string;
  index: { today: string; system: string; who: string; ours: string; code: string; handoffs: string };
  foot: string;
  initial: { view: ProcessView; step: StepId };
};

/* #shape */
export type BizId = "wholesale" | "trades" | "retail" | "making" | "appointments" | "services";
export type ScopeId = "sales" | "ops" | "all";
export type ShapeCore = "history" | "messages" | "bookings" | "invoicing";
export type ShapePart = { label: string; why: string; level: ScopeId; core?: ShapeCore; kind?: "thin" }; // label ≤ 24, why ≤ 60
export type ShapeSample = {
  id: BizId;
  title: string; // ≤ 48
  who: string; // ≤ 64
  parts: readonly ShapePart[]; // 4 sales, 4 ops, 3 all, in that order
  pipeline: { name: string; stages: readonly [string, string, string, string, string, string] }; // name ≤ 44, stage ≤ 14
  reports: readonly [string, string, string]; // ≤ 48 each
  ai: string; // ≤ 80
  hard: string; // ≤ 120
};
export type RouteId = "shelf" | "extended" | "built";
export type RouteRow = "what" | "suits" | "gives" | "watch" | "whose";
export type Route = { id: RouteId; label: string } & Record<RouteRow, string>; // each row ≤ 150
export type LedgerCopy = { title: string; lead: string; rows: Record<RouteRow, string>; routes: readonly Route[]; foot: string };
export type ShapeData = {
  eyebrow: string; title: string; key: string; sub: string;
  bizLabel: string; scopeLabel: string;
  businesses: readonly { id: BizId; label: string }[];
  scopes: readonly { id: ScopeId; label: string; hint: string }[];
  initial: { biz: BizId; scope: ScopeId };
  tag: string; partsTitle: string; levels: Record<ScopeId, string>; inBuild: string; later: string;
  pipelineTitle: string; reportsTitle: string; aiLabel: string; hardLabel: string;
  kinds: Record<"does" | "thin", string>;
  coreKinds: Record<ShapeCore, "does" | "thin">; // read from CORE_PARTS, never typed
  legend: string; full: Link; live: string;
  indexSummary: string; foot: string;
  samples: readonly ShapeSample[];
  ledger: LedgerCopy;
};

/* #move */
export type RowId = "r1" | "r2" | "r3" | "r4" | "r5" | "r6";
export type Outcome = "moved" | "merged" | "asked";
export type RehearsalRow = { id: RowId; outcome: Outcome; with?: RowId };
export type MoveStage = { id: "map" | "build" | "switch"; n: "01" | "02" | "03"; title: string; body: string; hold: string; ours?: string; check: Check };
export type Whose = "yours" | "handed" | "agreed";
export type OwnRow = { id: "data" | "code" | "accounts" | "old"; what: string; whose: Whose; how: string };
export type MoveData = {
  eyebrow: string; title: string; key: string; sub: string;
  rehearsal: {
    title: string; tag: string; sheet: string; columns: readonly [string, string, string, string]; cards: string;
    rows: readonly RehearsalRow[]; outcomes: Record<Outcome, { tag: string; why?: string }>; tally: string;
    loop: { label: string; nodes: readonly [string, string, string, string] };
    foot: string; indexSummary: string; index: Record<RowId, string>;
  };
  labels: { stage: string; hold: string; ours: string };
  checkKinds: Record<CheckKind, string>;
  stages: readonly MoveStage[];
  stays: { title: string; sub: string; here: { head: string; items: readonly string[] }; beta: string; yours: { head: string; items: readonly string[] } };
  own: { title: string; sub: string; head: { what: string; whose: string; how: string }; states: Record<Whose, string>; rows: readonly OwnRow[] };
};

/* #core */
export type CorePart = {
  id: CoreId; layer: 0 | 1 | 2 | 3; kind: Kind;
  title: string; // ≤ 40
  datum: string; // ≤ 16, mono
  ours: string; // ≤ 330; "thin" opens "Partly on ours:", "none" opens "Not on ours:"
  yours: string; // ≤ 140, OWNER
  files: readonly string[]; // empty exactly when kind is "none"
  check: Check;
};
export type UnderCell = { id: "walls" | "kept" | "schema" | "jobs"; title: string; datum: string; text: string }; // text ≤ 130
export type CoreData = {
  eyebrow: string; title: string; key: string; sub: string;
  tag: string; bus: string; layers: readonly string[];
  labels: { ours: string; yours: string; code: string };
  kinds: Record<Kind, string>; checkKinds: Record<CheckKind, string>;
  parts: readonly CorePart[];
  underTitle: string; under: readonly UnderCell[];
  indexSummary: string; foot: string;
};

/* ---------- #core's nine parts: the kinds #process and #shape read ---------- */

// One list, in the menu's stack order (layer: Sales 0, Inventory 1,
// Invoicing 2, Reporting 3). Datums ≤ 16 characters, every figure
// interpolated. `ours` ≤ 330; `yours` ≤ 140, each OWNER. Each `files`
// path exists (the test holds it); they print in #core's index only.
// "yours" is the one part this platform lacks: its `ours` says so, and it
// is the page's one caveat about quotes, orders, stock, purchasing and
// roles. Quote and order link here from #process, so it names both.
export const CORE_PARTS: readonly CorePart[] = [
  // No customers table: a customer is the caller's number. bookings, agent_messages and tool_invocations
  // carry call_id (010) and the call's GET loads them by it. Texts aren't named here: a waitlist offer is
  // logged with no call (waitlist.ts), so the messages card says which texts carry theirs.
  // EVIDENCE_ONLY_OUTCOMES (analysis.ts): the AI's word alone falls back to 'answered'. Opens with the
  // tag's own word: "Partly", as "Partly here" (never the SaaS page's "Thin").
  { id: "history", layer: 0, kind: "thin", title: "Everything against the customer", datum: `${CALL_OUTCOMES.length} call outcomes`,
    ours: `Partly on ours: a customer is their phone number. Each call is kept with its transcript, a summary and one of ${word(CALL_OUTCOMES.length)} outcomes, and the bookings, messages and actions it led to link back to it. ${cap(word(FACTS_ERP.evidenceOutcomes))} of those outcomes, such as booked or transferred, are set only when the platform itself did it, never on the AI’s word alone.`,
    yours: "A full customer file: every quote, order, invoice, email and call on one record.", // OWNER
    files: ["supabase/migrations/010_voice_platform.sql", "app/api/calls/[id]/route.ts", "app/api/calls/_lib/query.ts", "lib/openai/analysis.ts", "components/calls/CallDetailSheet.tsx"],
    // Trial calls are test calls (is_test), hidden until "Show test calls" is on (query.ts buildCallFilterOps).
    check: { kind: "site", label: "Open a test call on the free trial", how: "Turn on ‘Show test calls’ under Calls, then open it.", href: PRICING_TRIAL.href } },
  // AGENT_LIMITS.leadFields (guarded); schemas.ts `required: z.boolean()`; analysis.ts "only values the caller
  // clearly stated … Never guess." — told to the AI that reviews the call, which fills what the agent's own
  // save_lead_details didn't (mergeExtracted), so it's said of that AI, never as a guarantee of every answer;
  // CallDetailSheet's "Details collected"; the agent's Skills → Lead questions.
  { id: "fields", layer: 0, kind: "does", title: "Your own questions, on every record", datum: `up to ${AGENT_LIMITS.leadFields}`,
    ours: `Each business writes up to ${word(AGENT_LIMITS.leadFields)} questions of its own for its agent to ask, each named its way and required or not. The answers land on the call under ‘Details collected’, and the AI that reviews each call afterwards is told to add only what a caller clearly said, never a guess.`,
    yours: "The fields your business needs, named your way, and required where they must be.", // OWNER
    files: ["lib/voice/sync/limits.ts", "lib/voice/sync/schemas.ts", "lib/voice/tools/lead.ts", "components/skills/LeadQuestionsSkill.tsx"],
    check: { kind: "site", label: "Add a question on the free trial", how: "Under Agent → Skills → Lead questions.", href: PRICING_TRIAL.href } },
  // bookings.ts: "a fresh busy check right before writing, under a short per-organisation lock" (withOrgLock,
  // loadBusy: Google busy blocks plus our own bookings); retries "return the first booking". waitlist.ts:
  // "the longest waiting caller whose service fits … (no link, no automatic booking)". No seconds printed.
  { id: "bookings", layer: 0, kind: "does", title: "Bookings, with a waiting list", datum: `${FACTS_ERP.bookingStates.length} booking states`,
    ours: "Each booking is checked again against Google Calendar and the bookings already made, under a short lock, so two callers can’t take the same time, and a retried request never books twice. When one is cancelled or moved, the freed time is offered by text to whoever has waited longest for that service; they call back to take it.",
    yours: "Stock reserved as an order is confirmed, so the last item goes to one order.", // OWNER
    files: ["supabase/migrations/010_voice_platform.sql", "lib/scheduling/bookings.ts", "lib/scheduling/waitlist.ts", "app/api/bookings/route.ts", "app/api/bookings/waitlist/route.ts"],
    check: { kind: "call", label: "Ask to see a freed time offered" } }, // OWNER: that we show one on request
  // messages/route.ts orders by urgency, descending; tools/messages.ts saves "to the inbox first"; sms.ts:
  // "Every attempt, sent or failed at Twilio, is logged in sms_messages", STOP opt-out checked before each
  // (a text the guard stops is never sent, so never logged: "at Twilio" says so). sms_messages carries
  // call_id and booking_id: a booking's texts (confirmations, reminders) fill booking_id, and a call's
  // (the send_sms tool, team alerts, workflow steps) call_id. A waitlist offer fills neither, so the card
  // never says "every text … with its call". reminders.ts claims each booking before its text goes out.
  { id: "messages", layer: 0, kind: "does", title: "Messages and texts", datum: `${SMS_LANGUAGES.length} languages`,
    ours: `Messages taken for the team are saved to one inbox before anyone is alerted, urgent first, and move from new to done. Every text sent or failed at Twilio is logged, a booking’s with its booking and a call’s with its call; nobody who replied STOP is texted again, and booking reminders go out in ${word(SMS_LANGUAGES.length)} languages, each once.`,
    yours: "Every email, text and note on the customer’s record, and follow-ups that send themselves.", // OWNER
    files: ["app/api/messages/route.ts", "components/inbox/inbox-tabs.ts", "lib/voice/tools/messages.ts", "lib/twilio/sms.ts", "lib/scheduling/reminders.ts"],
    check: { kind: "call", label: "Ask to see the inbox and its texts" } }, // OWNER: that we show them on request
  { id: "yours", layer: 1, kind: "none", title: "Quotes, orders, stock and roles", datum: "built for yours",
    // The page's one caveat, said here: the FAQ's "users" row repeats its roles half only because it stands alone as FAQPage data.
    // "A single owner": SAAS_SCOPE's teams part (guarded) and 001's UNIQUE organizations.user_id.
    ours: "Not on ours: this platform sells minutes of calls, so it sends no quotes, takes no orders and keeps no stock, and each business account on it has a single owner.",
    yours: "Quotes, orders, stock and purchasing, counted the way you count, and a role for everyone who uses it, with what each may see and do.", // OWNER
    files: [],
    check: { kind: "handover", label: "Built with your system" } },
  // webhook/route.ts: constructEvent over the raw body. emit.ts's "Idempotency guard" reads invoices by
  // stripe_invoice_id, then issues; a failure is inserted with status 'failed' and the same id, so the copy
  // says what is checked, never "once" or "however often it's retried". The datum is the hero plate's
  // "event types" (types, never seven payments), without "Stripe", which won't fit in 16 and the text names.
  { id: "invoicing", layer: 2, kind: "does", title: "Payments and fiscal invoices", datum: `${FACTS.stripeEvents} event types`,
    ours: `For this platform’s own customers: Stripe Checkout and a customer portal, a signed webhook that keeps plans in step on ${word(FACTS.stripeEvents)} kinds of event, and SmartBill fiscal invoices, each issued only after a check for one on record, with a failure recorded too. Card numbers never reach our servers.`,
    yours: "Invoices and e-invoices issued from the order, and each payment matched back to it.", // OWNER
    files: ["app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts", "app/api/billing/webhook/route.ts", "lib/smartbill/emit.ts", "supabase/migrations/006_smartbill_invoices.sql"],
    check: { kind: "site", label: "Choose a plan on the free trial", how: "The card form opens on Stripe’s own address.", href: PRICING_TRIAL.href } },
  { id: "usage", layer: 2, kind: "does", title: "Usage, billed once", datum: "once per call",
    ours: scopePart("usage").ours, // read, never retyped: "An answered call is billed once, from the carrier’s own record — …"
    yours: "Whatever you bill by — hours, visits, units — counted once, and never lost.", // OWNER
    files: ["supabase/migrations/010_voice_platform.sql", "app/api/cron/daily/route.ts"],
    check: { kind: "call", label: "Ask to open the usage ledger" } }, // OWNER: that we show it on request
  // dashboard_metrics(p_org_id, p_tz): today, this week (today and the six days before), this month, outcomes,
  // sentiment, the peak hour, AND NOT c.is_test, resolve_time_zone(p_tz). calls-chart: z.enum(['7', '30', '90']),
  // gated by entitlements, AND NOT c.is_test too. The screen is "Dashboard" (DashboardShell's nav); a trial's
  // calls are test calls, so its figures read nought there, which is the rule the card states.
  { id: "reports", layer: 3, kind: "does", title: "Reports in your own time zone", datum: "own time zone",
    ours: `Headline figures come from one database query — calls today, in the last seven days and this month, their outcomes, how callers felt and the busiest hour — counted in each business’s own time zone with test calls left out, and a chart of calls per day over the last ${listOr(FACTS_ERP.chartDays.map((d) => DAYS_WORD[d]))} days, the longer views on higher plans.`,
    yours: "Sales, stock, margin and what’s owed, always current, never rebuilt at month-end.", // OWNER
    files: ["supabase/migrations/010_voice_platform.sql", "app/api/dashboard/metrics/route.ts", "app/api/dashboard/calls-chart/route.ts"],
    check: { kind: "site", label: "See the dashboard on the free trial", how: "Under Dashboard. Test calls stay out of its figures, so a test call leaves them at nought: the rule this card states.", href: PRICING_TRIAL.href } },
  // ExportQuerySchema: format csv | json, scope all | filtered | selected; EXPORT_COLUMNS, EXPORT_ROW_LIMIT,
  // X-Export-Truncated and its toast; csv.ts guardFormula.
  { id: "exports", layer: 3, kind: "does", title: "Exports that open safely", datum: `${FACTS_ERP.exportColumns} columns`,
    ours: `Every call, the current view or the ones picked, as CSV or JSON, from ${word(FACTS_ERP.exportColumns)} columns, up to ${FACTS_ERP.exportRows.toLocaleString("en-US")} a file, and it says so when there are more. A cell that would run as a formula in a spreadsheet is kept as text.`,
    yours: "Any list out whenever you want it, in files anyone can open.", // OWNER
    files: ["app/api/calls/export/route.ts", "app/api/calls/_lib/query.ts", "app/api/calls/_lib/csv.ts", "components/calls/ExportDialog.tsx"],
    check: { kind: "site", label: "Export your calls on the free trial", how: EXPORT_HOW, href: PRICING_TRIAL.href } },
];
// "Seven of these nine, and part of one more", in #core's sub: exactly one
// part isn't on ours (the caveat card) and exactly one is thin (the customer).
const CORE_NONE = CORE_PARTS.filter((p) => p.kind === "none");
const CORE_THIN = CORE_PARTS.filter((p) => p.kind === "thin");
const DOES = CORE_PARTS.filter((p) => p.kind === "does").length; // 7
if (CORE_NONE.length !== 1 || CORE_NONE[0].id !== "yours" || CORE_THIN.length !== 1 || CORE_THIN[0].id !== "history" || DOES !== 7)
  throw new Error("crm-erp: #core’s kinds changed; re-read ERP_CORE.sub (“seven of these nine … and part of one more”) and the caveat card");
/** A part's kind on this platform, read from its #core card, so a step or a sample can't disagree with it. */
const coreKind = (id: CoreId): Kind => {
  const p = CORE_PARTS.find((x) => x.id === id);
  if (!p) throw new Error(`crm-erp: CORE_PARTS lost "${id}"`);
  return p.kind;
};
/** Every card's kind, for the client islands, which can't call coreKind. */
const CORE_KINDS: Record<CoreId, Kind> = {
  history: coreKind("history"), fields: coreKind("fields"), bookings: coreKind("bookings"), messages: coreKind("messages"), yours: coreKind("yours"),
  invoicing: coreKind("invoicing"), usage: coreKind("usage"), reports: coreKind("reports"), exports: coreKind("exports"),
};

// What runs under every record: the four cells under the cards.
const UNDER: readonly UnderCell[] = [
  // Every CREATE TABLE in the migrations has its ENABLE ROW LEVEL SECURITY (the test computes both sets).
  { id: "walls", title: "Walled off", datum: `${FACTS_ERP.tables} of ${FACTS_ERP.tables} tables`,
    text: "Row-level security is on for every table in its database, so each business sees only its own rows." },
  // 011's protect_org_columns: plan, Stripe ids, minutes, trial, billing interval, usage period, user_id, onboarding.
  // It reverts a write made with a user's own session and lets the service role through: Checkout and the
  // portal still change a plan, by the webhook, so "by a signed-in session, only by the server", never "can't
  // be changed from a signed-in screen" (the Billing screen is one). "Plans", not "Its": no antecedent here.
  { id: "kept", title: "Kept from the browser", datum: "plan · billing",
    text: "Plans, billing, usage and owners can’t be changed by a signed-in session, only by the server: a database trigger keeps them." },
  { id: "schema", title: "Changed only by migration", datum: `${FACTS.migrations} migrations`,
    text: "Every change to the database’s shape is kept in the repository, so it can be run again, the same way." },
  { id: "jobs", title: "Jobs that run themselves", datum: FACTS.cronAt,
    text: `One job every morning, ${word(FACTS.cronSteps.length)} steps, each on its own, so one failing never stops the rest.` },
];

/* ---------- #process: the sample, the steps, the record ---------- */

// A sample business that quotes, sells from stock, delivers and invoices,
// for no business in particular. No digit, brand or business name anywhere
// in it: the record window draws grey bars where values would be. `kind` is
// the step's own on this platform: "thin" and "does" come with the files it
// runs in; "none" with none. Lines (today, system) are 45–62 characters, the
// longest at most 1.4× the shortest, so every dwell (holdFor) is 2.8–3.4s
// and the tour runs about 36s. A line never opens with its step's label:
// the card and the live line print the label just before it.
export const STEPS: readonly ProcessStep[] = [ // SAMPLE: the sample's words; `ours` and `files` are facts
  { id: "enquiry", n: "01", label: "Enquiry", lane: "sales",
    paper: { title: "Enquiries", where: "An inbox and a phone", pain: "Whoever answered knows", face: "inbox" },
    today: "Rung in or emailed, then copied into a spreadsheet.",
    system: "Filed on the customer’s record, with what they asked.",
    kind: "thin", core: "history", // the call record runs here; a customer is a phone number (#core-history)
    ours: "For calls: each one kept with what it led to, against the caller’s number.",
    files: ["app/api/calls/[id]/route.ts", "lib/openai/analysis.ts"],
    history: "Enquiry, with what they asked", status: "No order yet",
    screen: { title: "New enquiry", blocks: [{ kind: "field", label: "Customer" }, { kind: "field", label: "What they asked for" }, { kind: "field", label: "Came in by" }, { kind: "tick", label: "Filed on their record" }] },
    go: { label: "Send a quote", aria: "Send a quote — opens Quote" } },
  { id: "quote", n: "02", label: "Quote", lane: "sales",
    paper: { title: "Quotes", where: "A template, copied", pain: "Retyped from price lists", face: "document" },
    today: "Typed into last month’s template, then sent as an attachment.",
    system: "Priced from the catalogue and the customer’s own terms.",
    kind: "none", core: "yours",
    ours: "Your price lists, discounts and each customer’s terms, kept in one catalogue.", // OWNER
    files: [],
    history: "Quote sent", status: "Quote sent",
    screen: { title: "Quote", blocks: [{ kind: "lines", heads: ["Item", "Qty", "Price"], rows: 3, total: "Total" }, { kind: "chip", label: "Their own terms", tone: "done" }] },
    go: { label: "Send it", aria: "Send it — opens Follow-up" } },
  { id: "followup", n: "03", label: "Follow-up", lane: "auto",
    paper: { title: "Follow-ups", where: "Someone’s memory", pain: "Forgotten on a busy day", face: "note" },
    today: "Chased when someone remembers, if anyone does.",
    system: "If a quote goes quiet, one reminder goes out, unprompted.",
    // Partly: this platform sends booking reminders, and nothing notices a quote go quiet
    // (#shape's "Follow-ups", the same part of the same sample, says so too).
    kind: "thin", core: "messages",
    ours: "For bookings: each reminder claimed before it’s sent, so none goes out twice.",
    files: ["lib/scheduling/reminders.ts", "app/api/cron/daily/route.ts"],
    history: "Reminder sent", status: "Quote sent",
    screen: { title: "Follow-up", blocks: [{ kind: "field", label: "Their quote" }, { kind: "tick", label: "Quote sent" }, { kind: "chip", label: "No reply yet", tone: "wait" }, { kind: "tick", label: "Reminder sent, once" }] },
    go: { label: "Mark it accepted", aria: "Mark it accepted — opens Order" } },
  { id: "order", n: "04", label: "Order", lane: "sales",
    paper: { title: "Orders", where: "A spreadsheet", pain: "Retyped from the quote", face: "sheet" },
    today: "A yes by email, typed again into the order sheet.",
    system: "The quote becomes the order, with nothing typed twice.",
    kind: "none", core: "yours",
    ours: "Line for line from the quote, with its stock reserved in the same step.", // OWNER
    files: [],
    history: "Order placed", status: "Confirmed",
    screen: { title: "Order", blocks: [{ kind: "stages", items: ["Confirmed", "Reserved", "Delivered", "Invoiced", "Paid"], current: 0 }, { kind: "lines", heads: ["Item", "Qty", "Price"], rows: 2 }] },
    go: { label: "Reserve the stock", aria: "Reserve the stock — opens Stock" } },
  { id: "stock", n: "05", label: "Stock", lane: "ops",
    paper: { title: "Stock", where: "Another spreadsheet", pain: "Wrong after each sale", face: "grid" },
    today: "Someone walks to the shelf to check it’s really there.",
    system: "Reserved with the order, so the last one sells only once.",
    kind: "none", core: "bookings", // built for yours; the rule it needs runs here for bookings (#core-bookings)
    ours: "The rule it needs runs here, for bookings: the last free time is taken once.",
    files: [],
    history: "Items reserved", status: "Reserved",
    screen: { title: "Stock", blocks: [{ kind: "lines", heads: ["Item", "Where", "Reserved"], rows: 3 }, { kind: "chip", label: "At its reorder level", tone: "wait" }] },
    go: { label: "Book the delivery", aria: "Book the delivery — opens Delivery" } },
  { id: "delivery", n: "06", label: "Delivery", lane: "ops",
    paper: { title: "Deliveries", where: "A shared calendar", pain: "Not linked to the order", face: "calendar" },
    today: "Pencilled in when someone’s free, the address copied again.",
    system: "Booked in the calendar, checked against what’s already there.",
    // Partly: appointments are booked here, never a delivery loaded and signed for (#shape's "Deliveries").
    kind: "thin", core: "bookings",
    ours: "For appointments: checked against the calendar under a lock, with a waiting list.",
    files: ["lib/scheduling/bookings.ts", "lib/scheduling/waitlist.ts"],
    history: "Delivery booked", status: "Scheduled",
    screen: { title: "Delivery", blocks: [{ kind: "slots", label: "Booked" }, { kind: "field", label: "Address" }, { kind: "tick", label: "Checked against the calendar" }] },
    go: { label: "Mark it delivered", aria: "Mark it delivered — opens Invoice" } },
  { id: "invoice", n: "07", label: "Invoice", lane: "accounts",
    paper: { title: "Invoices", where: "The invoicing program", pain: "Retyped from the order", face: "invoice" },
    today: "Keyed in again; each payment matched to the bank by eye.",
    system: "Issued from the order, fiscal where the law asks, then paid.",
    kind: "does", core: "invoicing",
    ours: "For this platform’s own customers: a fiscal invoice issued after a check for one on record.",
    files: ["lib/smartbill/emit.ts", "app/api/billing/webhook/route.ts"],
    history: "Invoice issued, then paid", status: "Paid",
    screen: { title: "Invoice", blocks: [{ kind: "lines", heads: ["Item", "Qty", "Price"], rows: 2, total: "Total" }, { kind: "chip", label: "Fiscal invoice", tone: "done" }, { kind: "tick", label: "Payment matched" }] },
    go: { label: "See the figures", aria: "See the figures — opens This month" } },
  { id: "report", n: "08", label: "Report", lane: "auto",
    paper: { title: "Figures", where: "Put together by hand", pain: "Rebuilt every month-end", face: "chart" },
    today: "Copied from every sheet there is, and out of date once read.",
    system: "Each sale counted as it happens, in your own time zone.",
    kind: "does", core: "reports",
    ours: "For calls: figures counted in each business’s own time zone, and exports that open safely.",
    files: ["app/api/dashboard/metrics/route.ts", "app/api/calls/export/route.ts"],
    history: "In the month’s figures", status: "Paid",
    screen: { title: "This month", blocks: [{ kind: "panels", items: ["Sales", "Stock", "Money owed"] }, { kind: "chip", label: "In your own time zone", tone: "done" }] },
    go: { label: "Back to the customer", aria: "Back to the customer — opens New enquiry" } },
];
// Lines 46–61 characters (1.33×). holdFor(system): 2.84, 2.84, 3.36, 2.84, 3.36, 2.84, 3.36, 3.36s = 24.8s.
// Kinds: thin 3 (enquiry, follow-up, delivery), does 2 (invoice, report), none 3 (quote, order, stock).
// Each step's kind is the tag #shape gives the same part of the wholesale sample it opens on.

// Where the same details are typed again, or counted by hand, today. Each names two steps.
export const HANDOFFS: readonly Handoff[] = [ // SAMPLE
  { from: "enquiry", to: "quote", mark: "typed", text: "The customer’s details, from the inbox into the quote" },
  { from: "quote", to: "order", mark: "typed", text: "Every line, from the quote into the order sheet" },
  { from: "order", to: "stock", mark: "counted", text: "What was ordered, checked against the shelf" },
  { from: "order", to: "invoice", mark: "typed", text: "The order again, into the invoicing program" },
];

const LANES = [
  { id: "sales", label: "Sales" }, { id: "ops", label: "Operations" }, { id: "accounts", label: "Accounts" }, { id: "auto", label: "By itself", today: "Someone, by hand" },
] as const satisfies readonly { id: LaneId; label: string; today?: string }[];
const TYPED = HANDOFFS.filter((h) => h.mark === "typed").length; // 3
const COUNTED = HANDOFFS.filter((h) => h.mark === "counted").length; // 1
const TEAMS = LANES.filter((l) => l.id !== "auto").length; // 3
const BY_ITSELF = STEPS.filter((s) => s.lane === "auto").length; // 2
const DOES_STEPS = STEPS.filter((s) => s.kind === "does").length; // 2
const THIN_STEPS = STEPS.filter((s) => s.kind === "thin").length; // 3
const NONE_STEPS = STEPS.filter((s) => s.kind === "none"); // quote, order, stock

// Eight steps in rail order, each in one of the four lanes.
const pad2 = (n: number) => String(n).padStart(2, "0");
if (STEPS.length !== 8 || STEPS.some((s, i) => s.n !== pad2(i + 1)) || STEPS.some((s) => !LANES.some((l) => l.id === s.lane)))
  throw new Error("crm-erp: STEPS aren’t eight steps in rail order, each in a lane; re-read #process");
// A step's tag and link can't disagree with its card: a "does" step's card
// runs, and a "thin" step's card runs or is thin itself (a step can only
// lower its card's tag, as a #shape part can); a "none" step links to "yours", except stock, which links
// to the bookings card its `ours` names. The caption and the index print the
// kind's tag just before `ours`, so `ours` never opens with a kind's words:
// it says what the tag doesn't, and a built step what its "In one system"
// line doesn't.
/** Runs here | Partly here | Built for yours: #process's, #core's and the guard's one set of words. */
const KIND_WORDS: Record<Kind, string> = { does: "Runs here", thin: "Partly here", none: "Built for yours" };
for (const s of STEPS) {
  const agrees = s.kind === "none"
    ? s.core === "yours" || (s.id === "stock" && s.core === "bookings")
    : s.kind === coreKind(s.core) || (s.kind === "thin" && coreKind(s.core) === "does");
  if (!agrees) throw new Error(`crm-erp: step "${s.id}" is ${s.kind} but links to the ${coreKind(s.core)} "${s.core}" card`);
  const opens = Object.values(KIND_WORDS).find((w) => s.ours.toLowerCase().startsWith(w.toLowerCase()));
  if (opens) throw new Error(`crm-erp: step "${s.id}"’s “On ours” opens with “${opens}”, which its tag already prints`);
  if ((s.kind === "none") !== (s.files.length === 0)) throw new Error(`crm-erp: step "${s.id}" names files for a part built for yours, or none for one that runs here`);
}
// The foot prints these counts, and names the built steps in its own words.
if (DOES_STEPS !== 2 || THIN_STEPS !== 3 || NONE_STEPS.map((s) => s.id).join("|") !== "quote|order|stock")
  throw new Error("crm-erp: #process’s kinds changed; re-read ERP_PROCESS.foot (“five of the eight … two in full and three in part … quotes, orders and stock”)");

/* ---------- #shape: six samples, and the ledger ---------- */

const part = (label: string, why: string, level: ScopeId, core?: ShapeCore, kind?: "thin"): ShapePart => ({ label, why, level, ...(core ? { core } : {}), ...(kind ? { kind } : {}) });
/** A scope's place in the build: a group is in it when its level is at most the scope's. */
const LEVEL_OF = { sales: 0, ops: 1, all: 2 } as const satisfies Record<ScopeId, number>;
/**
 * One sample, checked for the fixed shape the card draws: eleven parts, four
 * then four then three, in level order; six stages; three reports. Throws
 * otherwise, so a pick never changes the card's structure. Lengths, and no
 * digit, brand or "client", are the test's.
 */
function sample(s: ShapeSample): ShapeSample {
  const bad = (why: string) => new Error(`crm-erp: sample "${s.id}" ${why}`);
  const perLevel = [0, 0, 0];
  let at = 0;
  for (const p of s.parts) {
    if (LEVEL_OF[p.level] < at) throw bad(`lists "${p.label}" out of level order`);
    at = LEVEL_OF[p.level];
    perLevel[at] += 1;
  }
  if (perLevel.join("/") !== "4/4/3") throw bad("isn’t eleven parts: four sales, four operations, three back office");
  if (new Set(s.parts.map((p) => p.label)).size !== s.parts.length) throw bad("repeats a part");
  if (s.pipeline.stages.length !== 6 || s.reports.length !== 3) throw bad("isn’t six stages and three reports");
  return s;
}
const S = "sales", O = "ops", A = "all";

export const SAMPLES: readonly ShapeSample[] = [ // SAMPLE: written for this page, for no business in particular
  sample({ id: "wholesale",
    title: "Quote, sell from stock, deliver and invoice", who: "Businesses that sell to other businesses from a warehouse",
    parts: [
      part("Customers and contacts", "Every buyer, the people there, and everything said", S, "history"),
      part("Pipeline", "Enquiries and quotes, by stage and by who’s chasing", S),
      part("Quotes", "Priced from your catalogue and each customer’s terms", S),
      part("Follow-ups", "A reminder when a quote goes quiet, sent once", S, "messages", "thin"),
      part("Orders", "A quote accepted becomes an order, nothing retyped", O),
      part("Stock", "Reserved on order, counted in every warehouse", O),
      part("Deliveries", "Booked, loaded and signed for", O, "bookings", "thin"),
      part("Invoices", "Issued from the order, fiscal where the law asks", O, "invoicing"),
      part("Purchasing", "Reorders raised before stock runs out", A),
      part("Link to your accounts", "Invoices and payments in your accounting software", A),
      part("Customer portal", "Buyers reorder and download invoices themselves", A),
    ],
    pipeline: { name: "An order, from enquiry to paid", stages: ["Enquiry", "Quoted", "Accepted", "Picked", "Delivered", "Paid"] },
    reports: ["Quotes won and lost, by who quoted", "Stock below its reorder level, by warehouse", "Money owed, by how late it is"],
    ai: "AI reads an order from an email and drafts it for a person to check",
    hard: "Prices that differ by customer, stock in more than one place, and an order that must never ship twice." }),
  sample({ id: "trades",
    title: "Quote, book the job, do it on site, invoice", who: "Installers, repairers and maintenance crews",
    parts: [
      part("Customers and sites", "Every customer, and every address you work at", S, "history"),
      part("Pipeline", "Enquiries, site visits and quotes, by stage", S),
      part("Quotes", "Parts and labour, priced from your own list", S),
      part("Follow-ups", "A reminder when a quote goes quiet, sent once", S, "messages", "thin"),
      part("Jobs and scheduling", "Each job booked to a crew, never double-booked", O, "bookings", "thin"),
      part("Job sheets", "Photos, notes and a signature, on site", O),
      part("Parts and van stock", "What’s on each van, and what each job used", O),
      part("Invoices", "Issued when the job is signed off", O, "invoicing"),
      part("Service contracts", "Visits that come round by themselves", A),
      part("Link to your accounts", "Invoices and payments in your accounting software", A),
      part("Customer portal", "Customers book and follow their visits", A),
    ],
    pipeline: { name: "A job, from enquiry to paid", stages: ["Enquiry", "Site visit", "Quoted", "Booked", "Done", "Paid"] },
    reports: ["Jobs booked against each crew’s time", "Quotes won and lost, by kind of job", "Contracts due for renewal"],
    ai: "AI drafts the job report from the engineer’s notes and photos",
    hard: "A day of jobs that moves when one runs late, and parts that have to be on the right van." }),
  sample({ id: "retail",
    title: "Every customer and order, online and in store", who: "Shops that sell online, in person, or both",
    parts: [
      part("Customers", "One record, however and wherever they bought", S, "history"),
      part("Segments", "Who to tell about what, and when", S),
      part("Support", "Every question and return, on the customer’s record", S, "messages", "thin"),
      part("Loyalty", "Points and offers for the ones who come back", S),
      part("Orders", "From the website and the till, in one list", O),
      part("Stock", "One count for the shop, the stockroom and online", O),
      part("Returns", "Refunded, restocked or written off", O),
      part("Invoices and receipts", "Issued with every sale, fiscal where the law asks", O, "invoicing"),
      part("Purchasing", "Reorders raised before the shelf is empty", A),
      part("Marketplaces", "Listings kept in step with your stock", A),
      part("Link to your accounts", "Sales and payments in your accounting software", A),
    ],
    pipeline: { name: "An order, from basket to done", stages: ["Placed", "Paid", "Packed", "Shipped", "Delivered", "Reviewed"] },
    reports: ["Best and worst sellers, by channel", "Stock that isn’t moving", "Customers who haven’t come back"],
    ai: "AI answers ‘where is my order?’ from the order itself",
    hard: "Stock that stays right when the shop and the website sell the last one at the same moment." }),
  sample({ id: "making",
    title: "From order to production to dispatch", who: "Businesses that make to order, or to stock",
    parts: [
      part("Customers and contacts", "Every buyer, the people there, and everything said", S, "history"),
      part("Pipeline", "Enquiries and quotes, by stage and by value", S),
      part("Quotes", "Costed from materials and time", S),
      part("Follow-ups", "A reminder when a quote goes quiet, sent once", S, "messages", "thin"),
      part("Orders", "A quote accepted becomes an order, nothing retyped", O),
      part("Production planning", "Each order turned into work for the floor", O),
      part("Materials and stock", "Materials reserved, finished goods counted", O),
      part("Invoices", "Issued on dispatch, fiscal where the law asks", O, "invoicing"),
      part("Purchasing", "Materials ordered before they run out", A),
      part("Quality and batches", "Which batch went to which customer", A),
      part("Link to your accounts", "Invoices, costs and payments in your accounts", A),
    ],
    pipeline: { name: "An order, from quote to dispatch", stages: ["Quoted", "Confirmed", "Planned", "On the floor", "Checked", "Dispatched"] },
    reports: ["Orders against the floor’s capacity", "Material cost per order, against the quote", "Late orders, and why they’re late"],
    ai: "AI drafts a production plan from the week’s confirmed orders",
    hard: "A plan that changes when one machine stops, and a batch you can trace to every customer who got it." }),
  sample({ id: "appointments",
    title: "Bookings, visits and follow-ups, in one place", who: "Clinics, salons, studios, and anyone who works by appointment",
    parts: [
      part("Customers", "Everyone you see, their history and what they prefer", S, "history"),
      part("Bookings", "Online, by phone or at the desk, never double-booked", S, "bookings", "thin"),
      part("Waiting list", "A freed time offered to whoever waited longest", S, "bookings"),
      part("Reminders", "Sent once before every visit, by text or email", S, "messages", "thin"),
      part("Services and packages", "What each visit is, and what it costs", O),
      part("Staff calendars", "Who is free, and in which room", O),
      part("Invoices and payments", "Paid at the desk, online or in advance", O, "invoicing", "thin"),
      part("Products and stock", "What’s sold at the desk, and what’s left", O),
      part("Memberships", "Plans that renew by themselves", A),
      part("Link to your accounts", "Takings and payments in your accounting software", A),
      part("Customer portal", "Customers book, move and pay for visits themselves", A),
    ],
    pipeline: { name: "A visit, from booking to paid", stages: ["Booked", "Reminded", "Arrived", "Done", "Paid", "Rebooked"] },
    reports: ["Empty slots, by day and by person", "Missed visits, and who missed them", "Customers due for their next visit"],
    ai: "AI answers the phone and books the visit, as this platform does",
    hard: "Two people booking the last free time at once, and a reminder that must go out exactly once." }),
  sample({ id: "services",
    title: "Accounts, projects, hours and invoices", who: "Agencies, consultancies, accountants and studios",
    parts: [
      part("Customers and contacts", "Every account, its people and what you’ve done for them", S, "history"),
      part("Pipeline", "New business, by stage and by value", S),
      part("Proposals", "From a template, with your own rates", S),
      part("Follow-ups", "A reminder when a proposal goes quiet, sent once", S, "messages", "thin"),
      part("Projects", "Tasks, deadlines and who’s on them", O),
      part("Time sheets", "Hours logged against each project", O),
      part("Retainers", "Hours used against the hours agreed", O),
      part("Invoices", "Billed from the hours, or on a schedule", O, "invoicing"),
      part("Resource planning", "Who is free next month, and for what", A),
      part("Expenses and approvals", "Claimed, approved and billed on", A),
      part("Link to your accounts", "Invoices and payments in your accounting software", A),
    ],
    pipeline: { name: "A customer, from first contact to invoiced", stages: ["Lead", "Meeting", "Proposal", "Won", "In progress", "Invoiced"] },
    reports: ["Hours billed against hours worked", "Projects running over budget", "Revenue by customer, month by month"],
    ai: "AI drafts a proposal from the notes of the first meeting",
    hard: "Hours that must reach the right invoice, and a project that must stop before it runs over." }),
];

/** The chips, in the samples' order: a pick finds its sample by id. */
const BUSINESSES: ShapeData["businesses"] = [
  { id: "wholesale", label: "Wholesale" }, { id: "trades", label: "Trades and field service" }, { id: "retail", label: "Shops and e-commerce" },
  { id: "making", label: "Manufacturing" }, { id: "appointments", label: "Appointments" }, { id: "services", label: "Agencies and services" },
];
if (BUSINESSES.map((b) => b.id).join("|") !== SAMPLES.map((s) => s.id).join("|"))
  throw new Error("crm-erp: #shape’s chips and samples are out of step");

/** A #shape tag's kind: the card's, read. A part #shape tags is never one built for yours. */
const shapeKind = (id: ShapeCore): "does" | "thin" => {
  const k = coreKind(id);
  if (k === "none") throw new Error(`crm-erp: #shape tags parts with the "${id}" card, now built for yours; re-read ERP_SHAPE.kinds`);
  return k;
};

// "Off the shelf, or built for you?": kinds of product, never a product. Every line OWNER.
// No product is named, priced or scored; each kind gets what it is good at, and "built" its own costs.
export const ROUTES: readonly Route[] = [
  { id: "shelf", label: "Off the shelf", // OWNER
    what: "A product made for many businesses, set up for yours.", // OWNER
    suits: "Your process is close to how most businesses in your field work, and you want to start soon.", // OWNER
    gives: "A proven product you can often start on quickly, updates from its maker, and ready links to common tools.", // OWNER
    watch: "Where your process differs, you adapt to the product or keep a spreadsheet beside it; what it does next is its maker’s call.", // OWNER
    // Hosted or self-hosted: many off-the-shelf products run where the buyer chooses, so the line says both.
    whose: "Your data is yours to take out, on its maker’s terms; a hosted product runs where its maker chooses, one you host runs where you do." }, // OWNER
  { id: "extended", label: "Off the shelf, extended", // OWNER
    what: "A product you keep, with the parts it lacks built around it.", // OWNER
    suits: "It covers most of what you do, and the gaps are at the edges: a link to another tool, a portal, a report.", // OWNER
    gives: "The product’s strengths, plus the few things only your business does, built to fit.", // OWNER
    watch: "What’s built around it can reach only what the product opens up, and has to keep up with its updates.", // OWNER
    whose: "The product stays its maker’s; the parts built for you are yours." }, // OWNER
  { id: "built", label: "Built around your process", // OWNER
    what: "One system, drawn from how you work and built for you.", // OWNER
    suits: "How you quote, make, deliver or bill is part of what sets you apart, or you’ve outgrown several tools at once.", // OWNER
    gives: "Every step as your team does it, one record for each customer and order, and changes when you need them.", // OWNER
    watch: "It takes longer to reach its first day, you pay for the build, and it needs looking after, by your team or ours.", // OWNER
    whose: "The code and the data are yours, and it runs where you choose." }, // OWNER
];

/* ---------- #move: the rehearsal and the stages ---------- */

// Six spreadsheet rows become five records: three moved, one pair merged,
// one asked about. Grey bars stand for every value; only the column names
// and the outcomes are words. The tally is counted from the rows, in words.
const REHEARSAL_ROWS: readonly RehearsalRow[] = [ // SAMPLE
  { id: "r1", outcome: "moved" }, { id: "r2", outcome: "moved" }, { id: "r3", outcome: "merged", with: "r5" },
  { id: "r4", outcome: "asked" }, { id: "r5", outcome: "merged", with: "r3" }, { id: "r6", outcome: "moved" },
];
// A merged row names its twin, and the twin names it back; no other row
// names one. RECORDS, the tally and the figure's cards count on it.
for (const r of REHEARSAL_ROWS) {
  const twin = REHEARSAL_ROWS.find((t) => t.id === r.with);
  const paired = twin !== undefined && twin.id !== r.id && twin.outcome === "merged" && twin.with === r.id;
  if (r.outcome === "merged" ? !paired : r.with !== undefined)
    throw new Error(`crm-erp: rehearsal row "${r.id}" isn’t half of a merged pair, or names a twin it shouldn’t`);
}
const RECORDS = REHEARSAL_ROWS.length - REHEARSAL_ROWS.filter((r) => r.outcome === "merged").length / 2; // 5

// The three stages: the first the page's own words, the second and third
// the menu's deliverables, read rather than retyped.
const STAGES: readonly MoveStage[] = [
  { id: "map", n: "01", title: "Your process, mapped and prototyped",
    body: "We sit with the people who do the work and list every step, every rule and every place the data lives today. Then your own screens become a prototype you click through, before any code.", // OWNER
    hold: "A prototype of your process, and a map of every source your data lives in.", // OWNER
    check: { kind: "site", label: "See one process drawn above", href: "#process" } },
  { id: "build", n: "02", title: ITEM.deliverables[0], // "Pipeline, stock and invoicing in one place"
    body: "The system is built in whatever technology suits it, and your real data is moved into a copy of it — again and again, until every count, total and history matches what you know.", // OWNER
    hold: "The system working on a copy of your own data, and a rehearsal you’ve checked.", // OWNER
    // SAAS_SCOPE's import part (guarded): "Not on ours: it started empty."
    ours: `This platform started empty, so it had nothing to move. What yours is built on runs here: row-level security on every one of its ${FACTS_ERP.tables} tables, and every change to its shape one of ${FACTS.migrations} migrations kept in the repository.`,
    check: { kind: "call", label: "Ask us to open the migrations" } }, // OWNER: that we show them on request
  { id: "switch", n: "03", title: ITEM.deliverables[1], // "Migrated off spreadsheets and legacy tools"
    body: "On a day you choose, the old tools are frozen, the last changes come across, and everyone starts in one system. The old files stay readable, and the code, the database and a guide to running it are handed over.", // OWNER
    hold: "One system in daily use, the old files kept, and the code and the data in your hands.", // OWNER
    // query.ts's ExportQuerySchema and csv.ts's guardFormula; the call's DELETE runs deleteProviderCopies
    // first and deletes nothing when one fails.
    ours: "Any list of calls leaves as CSV or JSON, a cell that would run as a formula kept as text, and a call is deleted with the copies its voice providers kept, or not at all.",
    // A trial's calls are test calls, hidden until "Show test calls" is on.
    check: { kind: "site", label: "Delete a test call on the free trial", how: "Turn on ‘Show test calls’ under Calls, open one, then ‘Delete this call’.", href: PRICING_TRIAL.href } },
];

/* ---------- meta ---------- */

// The layout's template adds " — Neuro Tech Voice", so the title carries no
// dash of its own. The description leads with the owner's claim and both
// credentials, near 155 characters so a search result doesn't cut them.
// Both go to openGraph and twitter too (metadata merges shallowly).
export const ERP_META = {
  title: `${ITEM.label}, for any business`, // OWNER. "Custom CRM & ERP, for any business"
  description: `CRMs and ERPs of any kind, shaped around your process. Our team holds ${ACC} Claude accreditations from Anthropic; ${GRANTORS} gave us ${GRANTS.length === 1 ? "a startup grant" : "startup grants"}.`, // OWNER
} as const;

/* ---------- #top: hero ---------- */

export const ERP_HERO: HeroData = keyed({
  eyebrow: ITEM.label, // "Custom CRM & ERP"
  // "run" is held to "here." (a no-break space), so the violet key never
  // leaves one word alone on a phone.
  title: "Any CRM or ERP, shaped around how you work. The hard parts already run here.", // OWNER
  key: "The hard parts already run here.",
  // The menu's description first (read), then breadth, the move, why the
  // proof is a phone-agent platform (it's ours to open up), and both
  // credentials, all before the plates.
  // It never repeats the h1's halves or lists the plates under it (the CTA clears the fold at 360 and 375);
  // "A CRM's hard parts", never "Those": the list before it names stock and production, which don't run here.
  sub: `${ITEM.description} For any business, of any size and however complex, we design and build yours — sales, stock, production, projects, invoicing and reporting — in whatever technology suits it, and move you off your spreadsheets and old tools without losing a thing. A CRM’s hard parts run every day on this platform, our own product for AI phone agents. Our team holds ${ACC} personal Claude accreditations from Anthropic, and our company holds startup grants from ${GRANTORS}.`, // OWNER
  primary: CALL,
  secondary: { label: "Follow one customer through it", href: "#process" },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  // What we build, said as capability (kinds of system and of business,
  // never a list of past work), between the room and the evidence. A phone
  // agent is one line of twelve; every line ≤ 50 characters (three columns at 768).
  range: {
    label: "What we build",
    lead: "Any system your business runs on, for any size and any process. Not just phone agents.", // OWNER
    groups: [
      { head: "Customers and sales", items: ["CRMs, pipelines, quotes and follow-ups", "Customer portals and self-service", "Bookings, memberships and subscriptions", "Calls from a phone agent, on the customer’s record"] }, // OWNER
      { head: "Operations", items: ["Stock, warehouses and purchasing", "Production, from order to dispatch", "Field service, projects and time sheets", "Staff, rotas, leave and HR"] }, // OWNER
      { head: "Money and reporting", items: ["Invoicing, fiscal invoices and payments", "Links to your accounting software", "Dashboards, reports and forecasts", "Approvals, audit trails and permissions"] }, // OWNER
    ],
    fields: "For wholesalers, manufacturers, shops, trades and field service, clinics, agencies, logistics, property, hospitality, education — or a business this list doesn’t name.", // OWNER
  },
  room: {
    tag: "What a CRM is built on, running here",
    // Four plates (saas.css §4 staggers --i 0–3). These are this page's own
    // layers, not ITEM.stack's (guarded above). Datums ≤ 20 characters, so
    // each sits on its label's line from 360px (the SaaS plate rule), and
    // every figure is read or held.
    plates: [
      { layer: "Customers", name: "Every call, kept as one record", runs: "Its summary and outcome, the details the business asked for, and the booking, message and actions it led to", datum: `${CALL_OUTCOMES.length} call outcomes` }, // "10 call outcomes"
      { layer: "Bookings", name: "Bookings with a waiting list", runs: "Checked again under a lock before each is written, and a freed time offered to whoever waited longest", datum: `${FACTS_ERP.bookingStates.length} booking states` }, // "5 booking states"
      { layer: "Invoicing", name: "Stripe and SmartBill", runs: "Checkout, a customer portal, and fiscal invoices, each issued only after a check for one on record", datum: `${FACTS.stripeEvents} Stripe event types` }, // "7 Stripe event types"
      { layer: "Reporting", name: "Figures counted by the database", runs: "Calls by day, outcome and how callers felt, in each business’s own time zone, and exports that open safely", datum: `${FACTS_ERP.exportColumns} export columns` }, // "13 export columns"
    ],
    foot: "Counted from the repository by the site’s own tests.", // no plus on a plate, so no "A plus means at least"
    link: { label: "See it in full", href: "#core" },
    flow: { pause: "Pause background motion", play: "Play background motion" },
  },
  proofLabel: "The evidence on this page",
  proof: [
    { label: "Running here", term: "A CRM’s hard parts", detail: "Records, bookings, invoices and reports, running today; every figure counted from the code.", href: "#core" },
    { label: "Accreditations", term: `${ACC} Claude accreditations`, detail: "From Anthropic, each earned by someone on our team.", href: "#team" },
    { label: "Startup grants", term: GRANTORS, detail: "Awarded to our company. Their technology runs inside this platform.", href: "#team" },
  ],
});

/* ---------- #process ---------- */

export const ERP_PROCESS: ProcessData = keyed({
  eyebrow: "Your process", // an eyebrow never repeats its own title ("drawn into one system")
  title: "Your inboxes, spreadsheets and tools, drawn into one system",
  key: "drawn into one system",
  sub: "A sample business that quotes, sells from stock, delivers and invoices. Watch today’s tools become one system shaped like the work, then follow one customer from the first call to the month’s figures: who does each step, and whether it already runs on this platform.",
  tag: "Sample business · drawn for this page",
  viewLabel: "View",
  views: [{ id: "today", label: "Today" }, { id: "one", label: "One system" }],
  transport: { play: "Play the journey", pause: "Pause the journey", replay: "Play it again" },
  restart: "Start again",
  stepsLabel: "The journey",
  stepOf: "Step {n} of {total}",
  lanesLabel: "Who does it",
  lanes: LANES,
  steps: STEPS,
  handoffs: HANDOFFS,
  marks: { typed: "Typed again", counted: "Counted by hand" },
  // 88 characters: holdFor 4.66s, the tour's first beat.
  intro: { mark: "Today", text: `Today: the same customer in ${word(STEPS.length)} places, and the details typed again as the work moves.` },
  caption: {
    who: "Who", today: "Today", system: "In one system", ours: "On ours",
    // Worded by the linked card's kind (coreKinds), so stock, built for yours, says "See it running" of the booking rule.
    see: { does: "See it running", thin: "See what runs", none: "What’s built for yours" },
  },
  kinds: KIND_WORDS,
  coreKinds: CORE_KINDS,
  legend: { typed: "Typed again" },
  tally: {
    // "Eight steps in eight places: typed again at three hand-offs, counted by hand at one."
    today: `${cap(word(STEPS.length))} steps in ${word(STEPS.length)} places: typed again at ${word(TYPED)} hand-offs, counted by hand at ${word(COUNTED)}.`,
    // "Eight steps, one record: three teams, and two steps that run by themselves."
    one: `${cap(word(STEPS.length))} steps, one record: ${word(TEAMS)} teams, and ${word(BY_ITSELF)} steps that run by themselves.`,
  },
  record: {
    chrome: "Your system · sample",
    pill: "One customer record",
    customer: "A returning customer",
    statusLabel: "Order",
    history: "Their history",
    toCome: "To come",
    hint: "The ringed button moves the order on.",
    todayTitle: "Today: typed again, and counted by hand",
    todayFoot: "In one system, nothing here is typed or counted twice.",
  },
  live: "Step {n} of {total}: {label}. {who}. {line}",
  liveView: "{view}. {tally}",
  indexSummary: "The journey, in words",
  index: { today: "Today", system: "In one system", who: "Who", ours: "On ours", code: "In the code", handoffs: "Where the details are typed again today" },
  // "Five of the eight … two in full and three in part …": counted from the kinds (guarded above).
  // The sub and the tag already say the business is a sample; the credits say the rest of it, once.
  foot: `${cap(word(DOES_STEPS + THIN_STEPS))} of the ${word(STEPS.length)} steps already run on this platform, ${word(DOES_STEPS)} in full and ${word(THIN_STEPS)} in part; quotes, orders and stock are built for yours.`, // OWNER (the last clause)
  // The finished frame: the server's HTML, and what reduced motion, the
  // still and lite tiers, weak hardware and no JavaScript all get.
  initial: { view: "one", step: "report" },
});

/* ---------- #shape ---------- */

export const ERP_SHAPE: ShapeData = keyed({
  // "Your kind of work" (Automations), "Your kind of app" (Mobile): not the title's "shaped around your process" again.
  eyebrow: "Your kind of business",
  title: ITEM.promise, // "A CRM or ERP shaped around your process, not the other way round."
  key: "not the other way round.",
  // Breadth first, so the chips read as a sample of what we build, not the menu.
  sub: `${cap(word(SAMPLES.length))} of the many kinds of business we build for, to show the pattern. Pick yours and how much of it goes in: each sample shows the parts it would have, the stages its work moves through, and the first reports it would give you.`,
  bizLabel: "Your business",
  scopeLabel: "How much goes in",
  businesses: BUSINESSES,
  // Labels ≤ 10 characters: the three share 288px at 320 (the Automations "How hard" rule).
  // In LEVEL_OF's order: a group is in the build when its level is at most the scope's.
  scopes: [
    { id: "sales", label: "Sales", hint: "A CRM: customers, enquiries, quotes and follow-ups." },
    { id: "ops", label: "Operations", hint: "A CRM and the work itself: orders, stock or jobs, and invoicing." },
    { id: "all", label: "Everything", hint: "An ERP: the back office too, from purchasing to the accounts." },
  ],
  initial: { biz: "wholesale", scope: "ops" }, // the sample #process draws, so the two sections agree
  // A no-break space before each "·": the tag wraps only after one.
  tag: "Sample · {business} · {scope}",
  partsTitle: "What it would have",
  levels: { sales: "Sales", ops: "Operations", all: "Back office" },
  inBuild: "In this build",
  later: "Later",
  pipelineTitle: "Its pipeline",
  reportsTitle: "Its first reports",
  aiLabel: "With AI",
  hardLabel: "What makes it hard",
  kinds: { does: "Runs here", thin: "Partly here" },
  coreKinds: { history: shapeKind("history"), messages: shapeKind("messages"), bookings: shapeKind("bookings"), invoicing: shapeKind("invoicing") },
  legend: "Runs here: this platform already runs the same part, for its own records. Partly here: some of it does.",
  full: { label: "What runs here, traced to the code", href: "#core" },
  live: "{business}, {scope}: {n} of {total} parts in this build.",
  indexSummary: `All ${word(SAMPLES.length)} samples, in words`,
  // Mobile's foot: the tag says "Sample", the credits say the rest, once.
  foot: "Samples written for this page. Yours isn’t here? Bring it to the call.",
  samples: SAMPLES,
  ledger: {
    title: "Off the shelf, or built for you?", // OWNER
    // "off-the-shelf" held whole (a word joiner, U+2060, after each hyphen, as `whole` does), so the lead
    // never ends on "shelf CRM." alone after a break at "off-the-" (390, and 768 up).
    lead: "A comparison of kinds, not of products. Plenty of businesses are well served by an off-⁠the-⁠shelf CRM.", // OWNER
    rows: { what: "What it is", suits: "Suits you when", gives: "What you get", watch: "What to watch for", whose: "Whose it is" }, // OWNER
    routes: ROUTES,
    foot: "Often the answer is a mix: keep the tools that work, and build what they can’t do. On the call we’ll say which we’d do, and why.", // OWNER
  },
});

/* ---------- #move: off your spreadsheets, connected, and yours ---------- */

export const ERP_MOVE: MoveData = keyed({
  eyebrow: "The move",
  title: "Off your spreadsheets and old tools, without losing a thing", // OWNER
  key: "without losing a thing",
  sub: "Every source is listed and mapped before anything moves. The move is rehearsed on a copy of your data, as many times as it takes, and checked by you; then the switch-over happens once, on a day you choose.", // OWNER
  rehearsal: {
    title: "A rehearsal, drawn",
    tag: "Sample rows · no one’s real data",
    sheet: "Customers — a spreadsheet",
    columns: ["Customer", "Email", "Phone", "Last order"],
    cards: "In the new system",
    rows: REHEARSAL_ROWS,
    // The figure prints the tag; the key under it prints the tag and its reason.
    outcomes: { moved: { tag: "Moved" }, merged: { tag: "Merged", why: "the same customer, twice" }, asked: { tag: "Asked", why: "no email on file" } },
    // "Six rows, five customers: …"
    tally: `${cap(word(REHEARSAL_ROWS.length))} rows, ${word(RECORDS)} customers: every row moved, merged with its twin, or asked about.`,
    loop: { label: "Rehearsed as many times as it takes", nodes: ["Copy", "Import", "Check", "Fix"] }, // OWNER
    foot: "Signed off by you before the switch-over.", // OWNER
    indexSummary: "The rehearsal, in words",
    index: { // SAMPLE: each row and what happened to it, for the index under the figure
      r1: "Row one: moved.", r2: "Row two: moved.", r3: "Row three: merged with row five, the same customer.",
      r4: "Row four: asked about, with no email on file.", r5: "Row five: merged into row three.", r6: "Row six: moved.",
    },
  },
  labels: { stage: "Stage", hold: "You hold", ours: "On ours" },
  checkKinds: CHECK_KINDS,
  stages: STAGES,
  stays: {
    title: "What you keep stays connected",
    sub: "Not everything has to move. What you’d rather keep, the system connects to.", // OWNER
    // lib/google/calendar.ts; GOOGLE_ACTION_INTEGRATION; SaaS FACTS' Stripe and SmartBill;
    // ACTION_TYPES' send_webhook (signed: WEBHOOK_HEADERS.signature), notify_slack, send_sms (guarded above).
    here: { head: "Connected here", items: [
      "Google Calendar for bookings, with each business’s own account",
      "Gmail, Google Sheets, Google Docs and Google Drive as workflow steps",
      "Stripe for payments, SmartBill for fiscal invoices",
      "Signed webhooks to any system that listens, Slack messages and texts",
    ] },
    beta: "The Google connections are in beta: they work today, and may still change.", // INT_GOOGLE.badge, guarded
    yours: { head: "Yours connects to", items: [
      "Your accounting software, such as QuickBooks, Xero or SmartBill", // OWNER
      "E-invoicing, where the law asks for it", // OWNER
      "Your online shop, such as Shopify or WooCommerce", // OWNER
      "Payments, email and calendars", // OWNER
      "A phone agent, ours or another: its calls on each customer’s record", // OWNER
      "Anything with a way in; without one, the files it exports", // OWNER
    ] },
  },
  own: {
    title: "Whose it is",
    // The table's three states, in its order; the rows say which is which, each once.
    sub: "What’s yours from the start, what’s handed to you, and what’s agreed first.", // OWNER
    head: { what: "What", whose: "Whose", how: "How" },
    states: { yours: "Yours", handed: "Handed to you", agreed: "Agreed first" },
    rows: [
      { id: "data", what: "Your data", whose: "yours", how: "Exported whenever you ask, in files a spreadsheet opens." }, // OWNER
      { id: "code", what: "The code", whose: "handed", how: "With its tests and a guide to running it, at the end of the build." }, // OWNER
      { id: "accounts", what: "The database and hosting accounts", whose: "agreed", how: "Whose name they’re in is agreed before the build starts." }, // OWNER
      { id: "old", what: "Your old files", whose: "yours", how: "Kept readable after the switch-over; nothing is deleted without your say." }, // OWNER
    ],
  },
});

/* ---------- #core: what a CRM has to get right, already running here ---------- */

export const ERP_CORE: CoreData = keyed({
  // Mobile's "Behind the app": an eyebrow never repeats its own title.
  eyebrow: "Behind the system",
  title: "What a CRM has to get right, already running here",
  key: "already running here",
  // "…runs seven of these nine parts, and part of one more…": counted from CORE_PARTS (guarded above).
  sub: `This platform, our own product for AI phone agents, keeps records for two kinds of customer: the businesses that subscribe to it, and each business’s own callers. It runs ${word(DOES)} of these ${word(CORE_PARTS.length)} parts, and part of ${word(CORE_THIN.length)} more; every figure here is counted from its code. The one it lacks is marked, and built for yours.`, // OWNER (the last sentence)
  tag: "This platform’s own records · drawn from its code",
  bus: "One customer",
  layers: ITEM.stack, // ["Sales", "Inventory", "Invoicing", "Reporting"], guarded
  labels: { ours: "On ours", yours: "In yours", code: "In the code, for your developers" },
  kinds: KIND_WORDS,
  checkKinds: CHECK_KINDS,
  parts: CORE_PARTS,
  underTitle: "Under every record",
  under: UNDER,
  indexSummary: "Where each part lives in the code",
  foot: "Drawn by the team that built it, from its code. It’s a drawing, not a live feed.",
});

/* ---------- #team ---------- */

// The Automations page's compact credentials card, as it is: said once,
// with a link to the SaaS page's #credentials for what each one is.
export const ERP_TEAM: TeamData = keyed({
  eyebrow: "Who builds it",
  title: `The people who build it hold ${ACC} Claude accreditations`,
  key: `${ACC} Claude accreditations`,
  // The card's label and caption say "Personal … from Anthropic", and the
  // grants' line says their technology runs inside: each once, not here too.
  sub: "The team that built this platform’s records, bookings, invoicing and reports, and builds CRMs and ERPs for any business, however it works.", // OWNER
  checkKinds: CHECK_KINDS,
  accreditations: {
    label: "Personal accreditations",
    figure: ACC, // "20+"
    caption: "Claude accreditations, from Anthropic",
    // OWNER (confirmed on the Mobile page): the accreditations cover building with Claude, and we build with it, this platform included.
    body: "Each was earned by one of the people who’d map your process and build your system, for building with Claude, Anthropic’s AI. We build with it too, this platform included: where your system should read an order from an email, draft a follow-up or answer a question from your own records, the people building it already know how.", // OWNER
    isnt: "They’re personal, not a certification of our company.", // the page's only word on it
    check: accCheck,
  },
  grants: {
    label: "Startup grants, awarded to our company",
    names: GRANTS.map((g) => g.grantor),
    line: "Their technology runs inside this platform: if your system should answer the phone or take a message by voice, we already build on it.",
    isnt: "A grant isn’t an endorsement of this page, or of any build we quote.",
    check: grantCheck,
    more: { label: "What each one is, and how to see it", href: `${SAAS_ITEM.href}#credentials` },
  },
});

/* ---------- #terms (still) ---------- */

// Whose name the hosting accounts are in is said once, in #move's own
// table, so the SaaS "agreed before the build starts" line isn't repeated.
export const ERP_TERMS: TermsData = keyed({
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  // Mobile's key, swept 320–1440 at 1px for the reveal's line splits.
  key: "say up front",
  sub: "There’s no price or date on this page: both go in the quote, because both depend on how much of your business goes into the system. Here’s what moves them.",
  columns: [
    { id: "sets", head: "What sets the price and the date", items: [
      "How many steps, teams and kinds of record your process has",
      "Just customers, or orders, stock, production and the accounts too",
      "How many places your data comes from, and how tidy it is",
      "What it must connect to: payments, e-invoicing, accounting, your shop",
      "Who may see and change what, and the approvals between",
      "Where your data must be kept, and the rules that come with that",
    ] },
    { id: "need", head: "What we’ll need from you", items: [
      "Time with the people who do the work: sales, the warehouse, the accounts",
      "Every spreadsheet, export and tool the work lives in today",
      "One person who can say yes or no at each prototype review",
      "Your checks on the rehearsal: the figures you know by heart",
      "A switch-over day that suits the business",
    ] },
    { id: "get", head: "What you get", items: [
      ITEM.deliverables[0], // "Pipeline, stock and invoicing in one place"
      ITEM.deliverables[1], // "Migrated off spreadsheets and legacy tools"
      // The menu's voice-centric deliverable, printed once, as one option among many.
      `If you use a phone agent, ours or another: ${lowerFirst(ITEM.deliverables[2])}`, // "… every agent call logged against the customer"
      "The code and the database, with tests and a guide to running them", // OWNER
    ] },
    { id: "upfront", head: "Said up front", items: [
      "A prototype isn’t the system: you click through it, but it stores nothing.",
      "Sometimes an off-the-shelf product is the better answer; if it is, we’ll say so on the call.",
      "Old data can’t be better than it was kept: the rehearsal finds the gaps, and you decide what to fix.", // OWNER
      "Hosting and the services it runs on bill for what they supply, on top of the build; the quote lists them.", // OWNER
      CAA_HANDOVER.after, // "Who makes changes after launch — your team, us, or both — is agreed when the build is quoted."
    ] },
  ],
  // The siblings' row, mirrored: the team's other four builds.
  after: "If it’s a whole platform, an automation, an app or a phone agent you need, the same team builds those too.", // OWNER
  links: [
    { label: "How a SaaS platform is built", href: SAAS_ITEM.href },
    { label: "How a custom automation is built", href: AUTO_ITEM.href },
    { label: "How a custom mobile app is built", href: MOB_ITEM.href },
    { label: "How a custom phone agent is built", href: CAA_ITEM.href },
  ],
});

/* ---------- #checks ---------- */

// Thirteen rows: six now in this browser, four on the call, three in your
// build (the test computes the filter counts, so a row added here only
// needs its kind). Two rows are the SaaS page's own, read by id. The
// accreditations and grants rows flip to "site" when a public link exists,
// and take that link with them.
export const ERP_CHECKS: ChecksData = keyed({
  eyebrow: "Check it yourself",
  title: "The claims that matter most, and where to check them",
  key: "where to check them",
  sub: "Some you can check now, in this browser. Some we show you on the call. The rest you get in your build.",
  filtersAria: "Show claims",
  // One name for each kind, in the filters, the rows and every other check line.
  filters: [
    { id: "all", label: "All" }, { id: "site", label: CHECK_KINDS.site },
    { id: "call", label: CHECK_KINDS.call }, { id: "handover", label: CHECK_KINDS.handover },
  ],
  kinds: CHECK_KINDS,
  showing: "Showing {n} of {total}",
  rows: [
    // Now, in this browser (6). A trial's calls are test calls, hidden until "Show test calls" is on.
    { id: "history", kind: "site", claim: "Every call is kept with what was done on it: its outcome, a summary, and any booking, message or action.",
      how: "On the free trial: make a test call, turn on ‘Show test calls’ under Calls, and open it.", link: TRIAL_LINK },
    // With "Show test calls" on and no other filter, "Calls in the current view" includes them; "Every call" leaves them out.
    { id: "export", kind: "site", claim: "Calls export as CSV or JSON, and a cell that would run as a formula is kept as text.",
      how: `On the trial: ${lowerFirst(EXPORT_HOW)}`, link: TRIAL_LINK },
    saasRow("cards"), // "Card numbers go to Stripe and never reach our servers." — read by id, never retyped
    { id: "delete", kind: "site", claim: "A deleted call goes with the copies its voice providers kept, or isn’t deleted at all.",
      how: "On the trial: turn on ‘Show test calls’ under Calls, open one, then ‘Delete this call’.", link: TRIAL_LINK },
    // Not "makes no claim about any": the ledger says what each kind gives and what to watch for.
    { id: "fair", kind: "site", claim: "The comparison with off-the-shelf products names none of them, and gives each kind what it’s good at as well as what to watch for.",
      how: "Read ‘Off the shelf, or built for you?’: the built route lists its own costs too.", link: { label: "The comparison", href: "#ledger" } },
    saasRow("company"), // "We’re an EU company, registered in Romania."
    // On the call (4). "About this platform": the accreditations' count is the owner's, not the code's.
    { id: "accreditations", kind: ACCREDITATIONS.verify ? "site" : "call", claim: `Our team holds ${ACC} Claude accreditations from Anthropic.`, how: "Ask to see them.", // OWNER
      ...(ACCREDITATIONS.verify ? { link: { label: "See the accreditations", href: ACCREDITATIONS.verify.href } } : {}) },
    { id: "grants", kind: grantLink ? "site" : "call", claim: grantsClaim, how: "Ask to see them.", // OWNER
      ...(grantLink ? { link: { label: "See the grants", href: grantLink.href } } : {}) },
    { id: "counts", kind: "call", claim: "Every figure about this platform is counted from its code.",
      how: "By a test that fails if a figure stops being true. Ask us to run it." },
    { id: "walls", kind: "call", claim: `Row-level security is on for every one of its ${FACTS_ERP.tables} database tables.`,
      how: "Ask us to open the migrations: each table switches it on." }, // OWNER: that we show them on request
    // In your build (3)
    { id: "prototype", kind: "handover", claim: "You click through your own process before it’s built.",
      how: "It’s what stage 01 delivers; the drawing above shows the idea.", link: { label: "The drawing", href: "#process" } },
    { id: "rehearsal", kind: "handover", claim: "The move is rehearsed on a copy of your data, and checked by you, before the switch-over.", // OWNER
      how: "It’s what stage 02 delivers: a rehearsal you sign off.", link: { label: "The move", href: "#move" } },
    { id: "code", kind: "handover", claim: "The code and the data are yours.", // OWNER
      how: "The code, with its tests and a guide to running it, at the end of the build; the data, whenever you ask." }, // OWNER
  ],
  // The card that closes the ledger looks forward, to the reader's own
  // build: #move's three stages, each checked as it lands.
  missing: {
    label: "How you check yours",
    body: "Yours starts with a call. Then come the three stages above, each one yours to check as it lands: a prototype of your process, a rehearsal on a copy of your own data, and one system in daily use, with the code and the data handed over.", // OWNER
    cta: CALL,
  },
});

/* ---------- #faq ---------- */

export const ERP_FAQ: FaqData = keyed({
  eyebrow: "Questions",
  title: "What people ask before a build",
  key: "before a build",
  keyTone: "quiet",
  talk: CALL,
  phone: COMPANY.phone,
  items: [
    // The doubt the name and the page's own proof raise, first (the name
    // is guarded above). Also served alone as FAQPage data.
    { id: "breadth", q: "Your name says ‘Voice’. Do you only build for phone calls?",
      a: `No. We build whatever system your business runs on — a CRM, an ERP or anything between: sales, stock, production, projects, field service, invoicing, HR, customer portals and reporting, for any business of any size. ${COMPANY.name} is also the name of our own product, a platform for AI phone agents; its records, bookings and invoicing are on this page because they’re ours to open up, not because voice is all we build.` }, // OWNER
    { id: "fit", q: "Will it fit how we work, or make us change?",
      a: "It’s drawn from how you work. We start with the people who do the work and every spreadsheet, inbox and tool they use, and the system’s steps, names and screens come from that. Where a step exists only because of an old tool, we’ll say so, and you decide whether to keep it.", // OWNER
      where: { label: "One process, drawn", href: "#process" } },
    { id: "offshelf", q: "Why not an off-the-shelf CRM?",
      a: "Often you should buy one: if your process is close to how a product already works, it can be running sooner, and we’ll say so on the call. A system built for you earns its place when the way you work is what sets you apart, when the work is spread across several tools and spreadsheets, or when you need to own the code and the data outright. If you already run one, we can build what it lacks and connect the two.", // OWNER
      where: { label: "Off the shelf, or built for you", href: "#ledger" } },
    { id: "complex", q: "How complex can it get?",
      a: "As complex as the business: many teams and approvals, stock in several warehouses, production from order to dispatch, prices that depend on the customer, more than one currency, and the accounts kept in step. The parts that already run on this platform are marked on this page; the rest are built for yours. Tell us on the call what makes yours hard, and we’ll say plainly how we’d build it.", // OWNER
      where: { label: `${cap(word(SAMPLES.length))} kinds of business`, href: "#shape" } },
    { id: "move", q: "How do we get off our spreadsheets without losing anything?",
      a: "Every source is listed and mapped first, duplicates are matched with you, and the whole move is rehearsed on a copy, as many times as it takes, until the counts, totals and histories match what you know. Only then comes the switch-over, on a day you choose, and the old files stay readable afterwards.", // OWNER
      where: { label: "The move, step by step", href: "#move" } },
    // "In beta" beside the Google steps (INT_GOOGLE.badge, guarded).
    { id: "connect", q: "Will it connect to what we already use?",
      a: "Yes: to your accounting software, e-invoicing, payments, email and calendars, your online shop, and anything else with a way in; where there’s none, the files it exports. This platform already books into Google Calendar and runs workflow steps in Gmail, Google Sheets, Google Docs and Google Drive, in beta, with each business’s own account; it sends signed webhooks to any system that listens, posts to Slack and sends texts. If you use a phone agent, ours or another, its calls can be logged against each customer.", // OWNER (the first sentence and the last)
      where: { label: "What stays connected", href: "#connect" } },
    { id: "own", q: "Who owns the system and the data?",
      a: "You do. At handover the code is yours, with its tests and a guide to running it, and the data is yours throughout: exported whenever you ask, in files a spreadsheet opens. Whose name the database and hosting accounts are in is agreed before the build starts.", // OWNER
      where: { label: "Whose it is", href: "#whose" } },
    // Repeats the caveat card's roles half only because it stands alone as structured data (the Mobile "push" precedent).
    { id: "users", q: "Can different people see different things?",
      a: "Yes. Roles and permissions are designed with your process, from the prototype on: who may see prices, give a discount, approve an order or change a closed invoice. This platform walls each business’s records off from every other’s in the database itself; each of its business accounts has a single owner, so roles are one of the parts built for yours.", // OWNER (the first two sentences)
      where: { label: "What’s built for yours", href: "#core-yours" } },
    { id: "cost", q: "What does it cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on how much of the business goes into the system, how many places the data comes from and what it connects to. We won’t put a number here that we’d have to walk back. A prototype of your process comes first, so you’ll have clicked through it before any code is written." },
    { id: "existing", q: "We already have a CRM or an ERP. Can you work with it?",
      a: "Yes. We can extend it, connect it to what it lacks, or move you off it, and if it has an export or a way in for software, nothing in it is lost." }, // OWNER
    // Each copy of a call where the SaaS page puts it, read from its FAQ (REGION above).
    { id: "data", q: "Where would our data live?",
      a: `Where your business needs it to, chosen with you before anything is built. ${REGION}`,
      where: { label: "Read the privacy policy", href: "/privacy" } },
  ],
});

/* ---------- #start, then the credits ---------- */

// The deep panel's colour zones were measured on SAAS_START's copy, so the
// title, key and body stay at or under its lengths (45, 25, 203; the test holds it).
export const ERP_START: StartData = keyed({
  eyebrow: "Start",
  title: "Bring how you work, and where it lives", // 38 ≤ 45
  key: "where it lives", // 14 ≤ 25
  body: "A build starts with a phone call, not a form. Tell us how the work flows today, where it lives and what it must connect to. We’ll tell you what we’d build first, what we’d move, and what it would take.", // 201 ≤ 203
  primary: CALL,
  secondary: { label: "Try the platform we built", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · Quoted after the call, never on the page`,
});

/** Every third-party mark the page prints, apart from Anthropic, Claude and Google's (their own lines). */
export const ERP_TRADEMARKS = ["Cartesia", "ElevenLabs", "Stripe", "SmartBill", "Twilio", "Slack", "QuickBooks", "Xero", "Shopify", "WooCommerce"] as const;

export const ERP_CREDITS: CreditsData = {
  title: "About this page",
  items: [
    { term: "The sample business", detail: "Made for this page: a business that quotes, sells from stock, delivers and invoices, for no business in particular. Its places, steps and screens are drawn, not taken from anyone’s system; its buttons only change the picture." },
    { term: "The platform on this page", detail: `${COMPANY.name}’s own, our product for AI phone agents, drawn from its code. It’s a drawing, not a live feed, shown because it’s ours to open up, not because voice is all we build.` }, // OWNER
    { term: "The figures", detail: "Counted from its repository by the site’s own tests. The one figure with a plus, the accreditations’, is our own count, and a floor: there are at least that many." },
    { term: "The samples", detail: "The businesses under ‘Your kind of business’, with their parts, pipelines and reports, were written for this page." },
    { term: "The rehearsal", detail: "Sample rows, drawn for this page: it shows what a rehearsal checks, not anyone’s data." },
    { term: "Off the shelf, or built for you", detail: "It compares kinds of product and names none; many can be set up or extended further than a summary can say." },
    { term: "Accreditations and grants", detail: `The accreditations are held by people on the team; the grants were awarded to the company by ${GRANTORS}. Both are shown on the call, on request.` }, // OWNER
    { term: "What isn’t here", detail: "No client names, logos, testimonials, prices or dates appear on this page." },
    { term: "Anthropic and Claude", detail: "Anthropic and Claude are trademarks of Anthropic, PBC. Naming them is not an endorsement by Anthropic of this page or of any build." },
    // Its own line, naming every Google mark the page prints.
    { term: "Google", detail: `Google, Google Calendar, Gmail, Google Sheets, Google Docs and Google Drive are trademarks of Google LLC. ${COMPANY.name} works with them and is not endorsed by Google.` },
    { term: "Other names on this page", detail: `${listJoin(ERP_TRADEMARKS)} are trademarks of their respective owners. We build on them, or name them as examples of tools a system can connect to; none of them endorses this page or any build we quote.` },
  ],
};
