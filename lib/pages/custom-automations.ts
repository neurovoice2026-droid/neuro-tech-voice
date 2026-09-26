import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/custom-automations — every word on the page.
 *
 * The page's argument is that we automate any work, for any business, in
 * any field and at any difficulty, and that this platform — our own, for
 * AI phone agents — runs on automations we built: the proof, never the
 * limit. So its spine is those automations, each taken from the steps a
 * person would do by hand to the flow that does them instead, and every
 * figure is either read from the code or held to it.
 *
 * Read, never retyped, where the source is safe to read: SOLUTION_ITEMS
 * (this item, and the SaaS and agent items for links), COMPANY,
 * PRICING_TRIAL, SOLUTIONS_MENU; the SaaS module's ACCREDITATIONS, GRANTS,
 * CHECK_KINDS, FACTS (the daily job's steps and time, webhook attempts,
 * the re-sync batch), listJoin and its FAQ's region sentences;
 * CAA_HANDOVER.after; INT_BUILDER and INT_GOOGLE (the self-serve product);
 * entitlementsFor, requiredPlanFor and PLANS (where texts and the Google
 * steps start); TRIGGER_TYPES, ACTION_TYPES, GOOGLE_ACTION_INTEGRATION and
 * MAX_WORKFLOW_ACTIONS (the workflow engine); TRIGGER_META and ACTION_META
 * (the dashboard's own names: "Unhappy caller", never "negative
 * sentiment"); WEBHOOK_HEADERS, SHEET_HEADER and CALL_OUTCOMES.
 *
 * Retyped in FACTS_AUTO, each held by lib/pages/custom-automations.test.ts
 * to its constant or to its source text: constants whose modules are
 * server graphs (webhook.ts, usage.ts, notify.ts) or don't export them
 * (executor.ts's run budget, the Stripe route's memory), and counts read
 * off source (the email builders, the billing chain in the daily route).
 *
 * OWNER-stated sentences (not checkable in the repo) are marked `// OWNER`
 * on the line that holds their words: the test reads this file's source
 * for the mark beside every promise about a reader's own build. Content
 * written for the page — the eighteen #work samples and #breaks' workflow —
 * is marked `// SAMPLE`: no business, no brand, no figure, no digit.
 *
 * "When it breaks" is worked out by the platform's own delivery code, but
 * not here: webhook.ts and ssrf.ts pull node:crypto and node:dns, so the
 * table is built once, at build time, in custom-automations.server.ts from
 * AUTO_BREAKS.scenarios, and this module stays words.
 *
 * This module is server-only. Client islands receive their slice as plain
 * props from the server page and import TYPES only, so nothing here — nor
 * the SaaS module's csp.ts graph it reads through — reaches the browser.
 *
 * No price, date, client, logo, testimonial, time-saved figure or badge
 * appears. The accreditations are personal and the grants are the
 * company's; neither is a certification, and #team says so once.
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true. The module
 * evaluates top to bottom, so the lenses, the ledger, the samples and the
 * scenarios are declared before the section consts that hold them, and
 * AUTO_BUILD and AUTO_CHECKS come after AUTO_RUNNING, whose lens count
 * they print.
 * ------------------------------------------------------------------ */
import { COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { sentences } from "@/lib/pages/home/source";
import {
  ACCREDITATIONS, CHECK_KINDS, FACTS, GRANTS, SAAS_FAQ, listJoin,
  type Check, type CheckKind, type CheckRow, type ChecksData, type CreditsData, type FaqData, type FaqItem,
  type HeroData, type Link, type StartData, type TermsData,
} from "@/lib/pages/custom-saas-platforms";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { INT_BUILDER, INT_GOOGLE } from "@/lib/pages/integrations";
import { entitlementsFor, requiredPlanFor } from "@/lib/billing/entitlements"; // imports types only
import {
  ACTION_TYPES, GOOGLE_ACTION_INTEGRATION, MAX_WORKFLOW_ACTIONS, TRIGGER_TYPES,
  type ActionType, type GoogleActionType, type TriggerType,
} from "@/lib/workflows/types"; // imports types only
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload"; // imports types only
import { SHEET_HEADER } from "@/lib/workflows/report"; // pure: templates and types
import { ACTION_META, TRIGGER_META } from "@/components/workflows/meta"; // pure: lucide icons, templates
import { CALL_OUTCOMES, PLANS } from "@/types";

/* ---------- guards ---------- */

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations");
if (!ITEM) throw new Error("SOLUTION_ITEMS lost custom-automations");
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms");
if (!SAAS_ITEM) throw new Error("custom-automations: SOLUTION_ITEMS lost custom-saas-platforms");
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
if (!CAA_ITEM) throw new Error("custom-automations: SOLUTION_ITEMS lost custom-ai-agents");
// The FAQ's second question quotes "Voice" from the company's name: a new name must be re-read there.
if (!/\bVoice\b/.test(COMPANY.name)) throw new Error("custom-automations: the company name lost “Voice”; re-read AUTO_FAQ’s “calls” row");
// The hero's plates carry per-layer copy: re-map them if the menu's layers change.
if (ITEM.stack.join("|") !== "Inbox|Spreadsheets|CRM|Webhooks") throw new Error("custom-automations: ITEM.stack changed");
// #build's stages and #terms' "What you get" are the three deliverables, in order.
if (ITEM.deliverables.length !== 3) throw new Error("custom-automations: ITEM.deliverables changed shape");

// The counts the copy spells out in words ("four moments", "ten kinds",
// "up to ten steps", "the five Google steps"): a trigger or a step kind
// added to the engine must be named here too, or the ledger would miscount.
if (TRIGGER_TYPES.length !== 4 || ACTION_TYPES.length !== 10 || MAX_WORKFLOW_ACTIONS !== 10)
  throw new Error("custom-automations: the workflow engine's triggers or steps changed");
// Read from the keys, so the Google set is the one the builder gates on.
const GOOGLE_STEPS = Object.keys(GOOGLE_ACTION_INTEGRATION) as GoogleActionType[];
if (GOOGLE_STEPS.length !== 5) throw new Error("custom-automations: the Google steps changed");
if (SHEET_HEADER.length !== 12) throw new Error("custom-automations: the sheet row changed");
if (CALL_OUTCOMES.length !== 10) throw new Error("custom-automations: the call outcomes changed");
// "In three steps, with no build": the self-serve builder's own steps.
if (INT_BUILDER.steps.length !== 3) throw new Error("custom-automations: the builder's steps changed");
// Every Google step on the page says "in beta". When the product drops the
// badge, the page must drop the words, so this fails the build until it does.
if (INT_GOOGLE.badge !== "Beta") throw new Error("custom-automations: Google left beta: say so, and drop every “in beta”");
const TRIAL = entitlementsFor("trial");
// Where texts and the Google steps start, by plan name, as custom-ai-agents
// reads CALENDAR_PLAN: "Starter" and "Pro" at HEAD. service.ts gates exactly
// these two entitlements when a workflow is saved (held by the test).
const SMS_PLAN = PLANS[requiredPlanFor("smsConfirmations")].name;
const GOOGLE_PLAN = PLANS[requiredPlanFor("googleIntegrations")].name;
if (TRIAL.smsConfirmations || TRIAL.googleIntegrations) throw new Error("custom-automations: the trial gained texts or Google");
// The morning lens has one block per step, and the copy counts them.
if (FACTS.cronSteps.length !== 8) throw new Error("custom-automations: the daily job's steps changed");

/* ---------- facts ---------- */

/**
 * Retyped, because their modules are server graphs (webhook.ts, usage.ts,
 * notify.ts) or don't export them (executor.ts, the Stripe route). Each is
 * held by lib/pages/custom-automations.test.ts, to the constant or to the
 * source text. All exact: none of them prints with a "+".
 */
export const FACTS_AUTO = {
  emails: 8, // the account emails: `export function …Email(` in lib/email/templates.ts, each called outside it
  alertsPerCall: 3, // = MAX_ALERTS_PER_CALL (lib/voice/tools/notify.ts)
  usageMarks: [80, 100], // = USAGE_THRESHOLDS (lib/billing/usage.ts)
  waitMaxSeconds: 30, // waitConfigSchema .max(30 (lib/workflows/schemas.ts)
  runBudgetMinutes: 4, // RUN_BUDGET_MS = 240_000 (lib/workflows/executor.ts) / 60 000
  stripeDoneHours: 48, // DONE_TTL_SECONDS = 48 * 60 * 60 (app/api/billing/webhook/route.ts)
  webhookWaitsSeconds: [1, 4], // = WEBHOOK_RETRY_DELAYS_MS / 1000 (lib/workflows/webhook.ts)
  webhookTimeoutSeconds: 10, // = WEBHOOK_TIMEOUT_MS / 1000 (lib/workflows/webhook.ts)
  billingChain: 3, // the first three of FACTS.cronSteps run inside `const billing = (async () => {`
} as const;

/* ---------- the dashboard's words ---------- */

// "Unhappy caller", "Send webhook": the dashboard's own names, read, so the
// page and the screen a customer sees can't call one thing two names.
const T = (id: TriggerType) => TRIGGER_META[id].label;
const A = (id: ActionType) => ACTION_META[id].label;

/** Each trigger in a sentence. A new trigger fails tsc here. */
export const TRIGGER_WORDS: Record<TriggerType, string> = {
  call_ended: "a call ending",
  call_missed: "a missed call",
  sentiment_negative: "an unhappy caller",
  keyword_detected: "a word you listen for",
};
/** Each step kind in a sentence. A new kind fails tsc here. The Google ones name their product. */
export const ACTION_WORDS: Record<ActionType, string> = {
  send_webhook: "a signed webhook to any system that listens",
  notify_slack: "a Slack message",
  send_sms: "a text to the caller",
  add_tag: "a tag on the call",
  wait: "a short pause",
  send_email: "an email from Gmail",
  add_to_sheet: "a row in Google Sheets",
  create_calendar_event: "a follow-up in Google Calendar",
  create_doc: "a call report in Google Docs",
  save_to_drive: "the transcript in Google Drive",
};
// The steps an owner sets up without Google, less the pause (it sits between
// steps, it isn't follow-up): the self-serve card's list.
const SELF_SERVE_STEPS = ACTION_TYPES.filter((a) => !(a in GOOGLE_ACTION_INTEGRATION) && a !== "wait"); // four

/* ---------- helpers ---------- */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Every title's coloured phrase (HomeHeading `titleKey`) must be copied
// from the title itself, and never be its first word.
const keyed = <T extends { title: string; key: string }>(s: T): T => {
  if (s.title.lastIndexOf(s.key) <= 0) throw new Error(`custom-automations: "${s.key}" is not in "${s.title}"`);
  return s;
};

/* ---------- shared copy ---------- */

// "20+": the plus only while the count is a floor, as #team's tally draws it (SaaS Tally, `orMore`).
const ACC = `${ACCREDITATIONS.count}${ACCREDITATIONS.orMore ? "+" : ""}`;
const GRANTORS = listJoin(GRANTS.map((g) => g.grantor)); // "Cartesia and ElevenLabs"
// There is no /contact page and no form: a build starts with a phone call.
const CALL: Link = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref }; // "Call us about a build"
const TRIAL_LINK: Link = { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href }; // "Start free"
const WAITS = FACTS_AUTO.webhookWaitsSeconds;
const TIMEOUT = FACTS_AUTO.webhookTimeoutSeconds;
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
// The region sentences, read from the SaaS FAQ (held there by its own
// test), so the two pages can't disagree about where a copy of a call is.
const SAAS_DATA = SAAS_FAQ.items.find((i) => i.id === "data");
if (!SAAS_DATA) throw new Error("custom-automations: SAAS_FAQ lost its data answer");
const REGION = sentences(SAAS_DATA.a, 1, 5); // throws if that answer is reshaped

/* ---------- section ids and shared types ---------- */

export const SECTION_IDS = ["top", "running", "work", "breaks", "team", "build", "terms", "checks", "faq", "start"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export type { Check, CheckKind, CheckRow, ChecksData, CreditsData, FaqData, FaqItem, HeroData, Link, StartData, TermsData };

/** The blocks every flow on the page is made of, the platform's and the samples' alike. */
export type BlockKind = "when" | "time" | "read" | "ai" | "rule" | "once" | "write" | "send" | "retry"
  | "wait" | "person" | "approve" | "log";
/** Whether this platform runs that kind of block today. */
export type Ours = "does" | "thin" | "none";
/** Where a kind can be watched running: a workbench lens, or an in-page anchor. */
export type KindShow = { lens: RunLensId } | { href: `#${string}` };
/**
 * A kind this platform runs carries its proof and where to watch it; a thin
 * or missing one carries neither, because KINDS_NOTE says it once. The
 * second member types `proof`/`show` as absent, so `info.proof` reads as
 * `string | undefined` anywhere and narrows to `string` on `ours === "does"`.
 */
export type KindInfo =
  | { tag: string; ours: "does"; proof: string; show: KindShow }
  | { tag: string; ours: "thin" | "none"; proof?: undefined; show?: undefined };
export type MeterCopy = {
  label: string; parts: string; rules: string; ai: string; person: string;
  schedule: string; once: string; yes: string; no: string;
};

/* #running: the workbench */
export type RunLensId = "pay" | "morning" | "document" | "call";
export type ManualId = "m1" | "m2" | "m3" | "m4" | "m5" | "m6";
export type RunGroupId = "order" | "side";
export type RunNode = {
  id: string; // unique in its lens
  kind: BlockKind;
  label: string; // ≤ 22 characters: two lines on a 118u card
  at: { c: 0 | 1 | 2 | 3 | 4 | 5 | 6; r: 0 | 1 | 2 }; // the xl map's 7 × 3 grid
  end?: true; // a branch that ends here: a short dashed card
  group?: RunGroupId; // the morning lens's frames
  cron?: string; // the morning lens: the step's name in the daily route
  datum?: string; // ≤ 16, mono under the label on the map
  was?: readonly ManualId[]; // the manual steps this block replaced
  fresh?: string; // a block with no manual counterpart: what by hand lacked
  detail: string; // the inspector's body
  files: readonly string[]; // repo-relative; "In the code, for your developers"
  check?: Check;
};
/** `id === \`${from}-${to}\``; `from`/`to` may be a group id (the morning lens). */
export type RunEdge = { id: string; from: string; to: string; label?: string };
export type RunStep = { id: string; title: string; caption: string; hops?: readonly string[]; ring?: readonly string[] };
export type RunLens = {
  id: RunLensId; label: string;
  hand: string; built: string; foot?: string;
  tools: readonly { id: string; label: string }[]; // ≤ 4 windows
  manual: readonly { id: ManualId; tool: string; text: string }[]; // ≤ 6
  copies: readonly { from: string; to: string; label: string }[]; // 1–2 chips, labels ≤ 18
  groups?: readonly { id: RunGroupId; label: string }[];
  nodes: readonly RunNode[]; edges: readonly RunEdge[]; steps: readonly RunStep[];
  check: Check;
};
export type LedgerId = "notify" | "bookings" | "waitlist" | "usage" | "minutes" | "workflows";
/** `files` and `more` print in the index only, never on a card face. */
export type LedgerCard = {
  id: LedgerId; kind: BlockKind; when: string; title: string; body: string;
  figure?: string; files: readonly string[]; link?: Link; more?: string;
};
export type RunningData = {
  eyebrow: string; title: string; key: string; sub: string; tag: string;
  lensesAria: string; transport: { play: string; pause: string; replay: string };
  lanes: { hand: string; flow: string }; phase: { hand: string; waiting: string; built: string };
  stepOf: string; logTitle: string; logAria: string; blockTitle: string; hint: string; hintTour: string; picked: string;
  was: string; code: string; onRun: string; offRun: string; nowStep: string; pill: { running: string; done: string };
  meters: MeterCopy; kinds: Record<BlockKind, KindInfo>; checkKinds: Record<CheckKind, string>;
  indexSummary: string; indexHand: string; indexFlow: string; live: string; liveLens: string;
  initial: RunLensId; lenses: readonly RunLens[];
  ledger: { title: string; cards: readonly LedgerCard[] };
  foot: string;
};

/* #work */
export type FieldId = "finance" | "sales" | "service" | "operations" | "people" | "shops";
export type LevelId = "copy" | "process" | "pipeline";
export type MoveId = "arrives" | "read" | "entered" | "passed" | "followed" | "decided";
export type Block = { kind: BlockKind; text: string };
export type Sample = {
  id: `${FieldId}-${LevelId}`; field: FieldId; level: LevelId; title: string; who: string;
  moves: Partial<Record<MoveId, { hand: string; flow: readonly Block[] }>>;
  person: string; hard?: string;
};
export type WorkData = {
  eyebrow: string; title: string; key: string; sub: string;
  fieldsLabel: string; levelLabel: string;
  fields: readonly { id: FieldId; label: string }[];
  levels: readonly { id: LevelId; label: string; gloss: string }[];
  initial: { field: FieldId; level: LevelId };
  moves: readonly { id: MoveId; label: string }[];
  movesCaption: string; tag: string; hand: string; flow: string; absent: string;
  person: string; hard: string; gloss: string;
  proofTitle: string; ours: Record<Ours, string>; kindsNote: string; watch: string; see: string;
  meters: MeterCopy; kinds: Record<BlockKind, KindInfo>;
  live: string; indexSummary: string; foot: string;
  samples: readonly Sample[];
};

/* #breaks */
export type BreakId = "ok" | "busy" | "down" | "slow" | "moved" | "private";
/** What the scripted receiver does on a try: an HTTP status, silence past the timeout, or a refused address. */
export type BreakAnswer = number | "timeout" | "unsafe";
export type BreakScenario = {
  id: BreakId; label: string; hint: string; url: string;
  answers: readonly BreakAnswer[]; expect: { ok: boolean; attempts: number };
};
/** One scenario as the platform's own delivery code worked it out (custom-automations.server.ts). */
export type BreakRow = {
  id: BreakId; ok: boolean; status: number | null;
  attempts: readonly { at: number; answer: BreakAnswer; retry: boolean }[];
  waits: readonly number[]; durationMs: number;
  message: string; // describeDelivery(result, { label: "Your endpoint", url })
  meta: string; // ActionResultList's line, "" when it prints none
};
export type BreakLane = "tag" | "crm" | "slack";
export type BreakGuardId = "once" | "budget" | "alone" | "twice";
export type BreaksData = {
  eyebrow: string; title: string; key: string; sub: string;
  workflow: {
    tag: string; name: string; whenLabel: string; trigger: string;
    steps: readonly { lane: BreakLane; kind: BlockKind; label: string }[];
  };
  optionsLabel: string;
  scenarios: readonly BreakScenario[];
  initial: BreakId;
  lanes: Record<BreakLane, string>;
  codes: string; wait: string; silent: string; refused: string; skippedMark: string; scale: string;
  tries: { one: string; many: string };
  record: {
    title: string; labels: Record<BreakLane, string>;
    status: { completed: string; failed: string };
    tag: string; slack: string; skipped: string;
    legend: { code: string; sample: string };
    privateNote: string;
  };
  sees: { label: string; ours: string; yours: string };
  source: { code: string; path: string };
  checkKinds: Record<CheckKind, string>;
  check: Check;
  live: string;
  guardsTitle: string;
  guards: readonly { id: BreakGuardId; title: string; body: string }[];
  indexSummary: string;
};

/* #team, #build */
export type TeamData = {
  eyebrow: string; title: string; key: string; sub: string; checkKinds: Record<CheckKind, string>;
  accreditations: { label: string; figure: string; caption: string; body: string; isnt: string; check: Check };
  grants: { label: string; names: readonly string[]; line: string; isnt: string; check: Check; more: Link };
};
export type AutoBuildStage = {
  id: "map" | "build" | "run"; n: "01" | "02" | "03"; title: string; body: string; hold: string; ours?: string; check: Check;
};
export type AutoBuildData = {
  eyebrow: string; title: string; key: string; sub: string;
  labels: { stage: string; hold: string; ours: string };
  checkKinds: Record<CheckKind, string>;
  stages: readonly AutoBuildStage[];
  selfServe: { label: string; body: string; link: Link };
};

/* ---------- meta ---------- */

// The layout's template adds " — Neuro Tech Voice", so the title carries no
// dash of its own. The description leads with the owner's claim and both
// credentials, near 150 characters so a search result doesn't cut them.
// Both go to openGraph and twitter too (metadata merges shallowly).
export const AUTO_META = {
  title: `${ITEM.label}, for any business`, // OWNER. "Custom Automations, for any business"
  description: `Any manual process, in any field, automated. Our team holds ${ACC} Claude accreditations from Anthropic; ${GRANTORS} gave us ${GRANTS.length === 1 ? "a startup grant" : "startup grants"}.`, // OWNER
} as const;

/* ---------- #top: hero ---------- */

export const AUTO_HERO: HeroData = keyed({
  eyebrow: ITEM.label, // "Custom Automations"
  // The no-break spaces keep "it." on its line and "This platform" whole, so the
  // violet phrase never starts with a lone "This" (measured 320–1920).
  title: "Whatever the work, we automate\u00a0it. This\u00a0platform runs on ours.",
  key: "This\u00a0platform runs on ours.",
  // The owner's claim, then why the proof is calls (the platform is ours,
  // so we can take its automations apart), then both credentials, all
  // before the plates.
  sub: `${ITEM.description} We automate it in any field, however hard, whatever the business: a copy-paste between two tools, or a pipeline across many systems with AI, schedules, retries and a person told the moment they’re needed. This platform is our own product, for AI phone agents, so its automations are the ones we can take apart. Our team holds ${ACC} personal Claude accreditations from Anthropic, and our company holds startup grants from ${GRANTORS}.`, // OWNER
  primary: CALL,
  secondary: { label: "Watch one run", href: "#running" },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  // What we automate, said as capability (kinds of work and of business,
  // never a list of past work), between the room and the evidence. The
  // benefit first, the owner's point last; calls are one line of twelve.
  range: {
    label: "What we automate",
    lead: "Any work your business still does by hand, whatever it sells and whichever tools it uses. Not just calls.", // OWNER
    groups: [
      { head: "Money and paperwork", items: ["Orders turned into invoices and receipts", "Payments matched against the accounts", "Scans, forms and contracts read into your systems", "Reports and summaries, put together for you"] }, // OWNER
      { head: "Customers and sales", items: ["Leads into the CRM, and followed up", "Bookings, reminders and waiting lists", "Emails and web forms sorted and answered", "Calls written up and acted on, as on this platform"] }, // OWNER
      { head: "Operations and people", items: ["Stock kept right across every channel", "Orders to the warehouse, shipments tracked", "New starters set up in every tool", "Approvals asked for and chased"] }, // OWNER
    ],
    fields: "For an online shop, a finance team, a warehouse, a delivery firm, a clinic, a school, an estate agency, a hotel, a factory — or a business this list doesn’t name.", // OWNER
  },
  room: {
    tag: "Running on this platform",
    // One plate per ITEM.stack layer, in its order (guarded above). Datums
    // ≤ 20 characters, so each sits on its label's line from 360px (the
    // SaaS plate rule), and every figure is read or held by the test.
    plates: [
      { layer: ITEM.stack[0], name: "Emails nobody writes by hand",
        runs: "Receipts, failed payments, usage warnings, refunds, a welcome and a goodbye, each sent when it happens",
        datum: `${FACTS_AUTO.emails} account emails` }, // "8 account emails"
      // valueInputOption 'RAW' (lib/workflows/google.ts): "nothing runs as a formula".
      // Plates 1 and 2 name the capability; the runs say what it is on this platform, as 0 and 3 do.
      { layer: ITEM.stack[1], name: "A spreadsheet that fills itself",
        runs: "A workflow step adds each call to Google Sheets as plain text, so nothing a caller says runs as a formula. In beta.",
        datum: `${SHEET_HEADER.length} columns a call` }, // "12 columns a call"
      { layer: ITEM.stack[2], name: "Conversations written up by AI",
        runs: "What the caller wanted, how they felt, what came of it and the details they gave, saved for a workflow to pass on",
        datum: `${CALL_OUTCOMES.length} outcomes` }, // "10 outcomes"
      { layer: ITEM.stack[3], name: "Signed, and tried again",
        runs: "Signed so the receiver knows it’s ours, tried again when the other end is busy, and never sent into a private network",
        datum: `signed · ${FACTS.webhookAttempts} tries` }, // "signed · 3 tries"
    ],
    foot: "Counted from the repository by the site’s own tests.",
    link: { label: "Watch them run", href: "#running" },
    flow: { pause: "Pause background motion", play: "Play background motion" },
  },
  proofLabel: "The evidence on this page",
  proof: [
    { label: "Running here", term: "This platform’s automations", detail: "Taken apart below, block by block.", href: "#running" },
    { label: "Accreditations", term: `${ACC} Claude accreditations`, detail: "From Anthropic, each earned by someone on our team.", href: "#team" },
    { label: "Startup grants", term: GRANTORS, detail: "Awarded to our company. Their technology runs inside this platform.", href: "#team" },
  ],
});

/* ---------- shared block copy ---------- */

/**
 * Every block kind: its tag, and whether this platform runs it today
 * (#work's legend, #running's inspector). A "does" kind names where it
 * runs and where to watch it; the two thin spots (a wait, an approval) are
 * said once, in KINDS_NOTE, never beside every kind.
 */
export const KINDS: Record<BlockKind, KindInfo> = {
  when: { tag: "When", ours: "does", proof: "A payment, the end of a call, a new document: each starts an automation.", show: { lens: "pay" } },
  time: { tag: "Schedule", ours: "does", proof: `${cap(word(FACTS.cronSteps.length))} steps run here every morning at ${FACTS.cronAt}.`, show: { lens: "morning" } },
  read: { tag: "Reads", ours: "does", proof: "Stripe’s invoices, uploaded files and web pages.", show: { lens: "document" } },
  ai: { tag: "AI", ours: "does", proof: "Documents are indexed with AI, and calls written up with it.", show: { lens: "document" } },
  rule: { tag: "Rule", ours: "does", proof: "A signature, an unhappy caller or a word you listen for decides what runs next.", show: { lens: "pay" } },
  once: { tag: "Once", ours: "does", proof: "Checked before every fiscal invoice: SmartBill is asked only when none is recorded for that payment.", show: { lens: "pay" } },
  write: { tag: "Writes", ours: "does", proof: "Fiscal invoices in SmartBill, a record on every call, and rows in Google Sheets, in beta.", show: { lens: "pay" } },
  send: { tag: "Sends", ours: "does", proof: "Emails, texts, Slack messages and signed webhooks.", show: { lens: "pay" } },
  retry: { tag: "Retries", ours: "does", proof: `Every webhook is tried up to ${word(FACTS.webhookAttempts)} times when the other end is busy.`, show: { href: "#breaks" } },
  wait: { tag: "Waits", ours: "thin" },
  person: { tag: "A person", ours: "does", proof: "The person on call is texted or emailed mid-call when a caller needs someone now.", show: { href: "#run-notify" } },
  approve: { tag: "Approval", ours: "none" },
  log: { tag: "Record", ours: "does", proof: "Every workflow run is recorded step by step, in plain words.", show: { href: "#breaks" } },
};
/** The page's one sentence on what this platform doesn't do: printed under a #work sample that uses a wait or an approval. */
export const KINDS_NOTE = `On this platform, a pause between two steps lasts at most ${FACTS_AUTO.waitMaxSeconds} seconds, and nothing waits for a person’s yes. On yours, a flow can wait days for a signature or an approval.`; // OWNER: that yours can

/** The six meters, computed from a flow's blocks (meters.ts `metersOf`), never typed. */
export const METER_COPY: MeterCopy = {
  label: "What makes it hard", parts: "Blocks", rules: "Rules", ai: "AI", person: "A person",
  schedule: "On a schedule", once: "Never twice", yes: "yes", no: "no",
};

/** The same six moves, in every #work sample, in this order. */
export const MOVES = [
  { id: "arrives", label: "It arrives" },
  { id: "read", label: "It’s read" },
  { id: "entered", label: "It’s entered" },
  { id: "passed", label: "It’s passed on" },
  { id: "followed", label: "It’s followed up" },
  { id: "decided", label: "A judgement call" },
] as const satisfies readonly { id: MoveId; label: string }[];

/* ---------- #running: the workbench lenses ---------- */

/**
 * Fills `{n}` and `{k}` in `hand` with the counts of manual steps and tool
 * windows, so the sentence can't drift from the drawing (capitalised: the
 * line opens on its count, under the caption's "By hand"), and throws unless
 * the lens holds together:
 * - node ids are unique, and every edge id is `${from}-${to}`;
 * - every edge's ends name a node or a group, and every node's group exists;
 * - every manual step's tool, and every copy chip's ends, are tool windows;
 * - every `was` names a manual step, and every manual step is replaced by
 *   at least one node;
 * - every node that isn't a branch's end, and has no `was`, has `fresh`;
 * - every step's hops name edges of this lens, and every ring names a node;
 * - every hop starts from a block the run has already reached, or from a
 *   group with a member already reached (the morning lens's `side-summary`
 *   at step 10). Hops are taken in order, then the step's rings.
 * Sizes (≤ 22-character labels, ≤ 10 steps …) are the test's to hold.
 */
function lens(l: RunLens): RunLens {
  const bad = (why: string) => new Error(`custom-automations: the "${l.id}" lens ${why}`);
  const nodes = new Set(l.nodes.map((n) => n.id));
  if (nodes.size !== l.nodes.length) throw bad("repeats a node id");
  const groups = new Set<string>((l.groups ?? []).map((g) => g.id));
  const tools = new Set(l.tools.map((t) => t.id));
  const manual = new Set<string>(l.manual.map((m) => m.id));
  const edges = new Map(l.edges.map((e) => [e.id, e]));
  for (const e of l.edges) {
    if (e.id !== `${e.from}-${e.to}`) throw bad(`names edge "${e.id}" wrongly`);
    for (const end of [e.from, e.to]) if (!nodes.has(end) && !groups.has(end)) throw bad(`has an edge to nothing: "${end}"`);
  }
  for (const m of l.manual) if (!tools.has(m.tool)) throw bad(`puts ${m.id} in no tool: "${m.tool}"`);
  for (const c of l.copies) if (!tools.has(c.from) || !tools.has(c.to)) throw bad(`copies "${c.label}" between tools it doesn't have`);
  for (const n of l.nodes) {
    if (n.group && !groups.has(n.group)) throw bad(`puts "${n.id}" in no group`);
    for (const m of n.was ?? []) if (!manual.has(m)) throw bad(`says "${n.id}" replaced ${m}, which isn't a manual step`);
    if (!n.end && !n.was?.length && !n.fresh) throw bad(`says neither what "${n.id}" replaced nor what by hand lacked`);
  }
  for (const m of l.manual) if (!l.nodes.some((n) => n.was?.includes(m.id))) throw bad(`never replaces ${m.id}`);
  const reached = new Set<string>();
  const entered = (g: string) => groups.has(g) && l.nodes.some((n) => n.group === g && reached.has(n.id));
  for (const s of l.steps) {
    for (const h of s.hops ?? []) {
      const e = edges.get(h);
      if (!e) throw bad(`hops "${h}" at "${s.id}", which isn't an edge`);
      if (!reached.has(e.from) && !entered(e.from)) throw bad(`hops "${h}" at "${s.id}" before the run reaches "${e.from}"`);
      reached.add(e.to);
    }
    for (const r of s.ring ?? []) {
      if (!nodes.has(r)) throw bad(`rings "${r}" at "${s.id}", which isn't a node`);
      reached.add(r);
    }
  }
  return { ...l, hand: cap(l.hand.replace("{n}", word(l.manual.length)).replace("{k}", word(l.tools.length))) };
}

// Four lenses, simplest first (their meters' hard counts are 2, 2, 2, 4,
// and the test holds the order). Positions are on the xl map's 7 × 3 grid
// (workbench-geometry.ts). Tool windows are named in plain words, never by
// brand: "Payment provider", not a product. The copy chips carry a label
// and a grey bar, never a value.

// "A customer pays": Stripe → SmartBill, the initial lens (8 steps). The
// renewal step comes first because handlers.ts runs it first, so an
// invoicing hiccup can't hold back the owner's minutes.
const PAY = lens({
  id: "pay",
  label: "A customer pays",
  hand: "{n} steps across {k} tools for every payment, and a check that’s easy to skip.",
  built: "Each step is a block in one flow, with the checks that make it safe to run twice.",
  tools: [
    { id: "provider", label: "Payment provider" }, { id: "invoicing", label: "Invoicing software" },
    { id: "email", label: "Email" }, { id: "admin", label: "Your admin screen" },
  ],
  manual: [
    { id: "m1", tool: "provider", text: "Check the payment provider for new payments" },
    { id: "m2", tool: "invoicing", text: "Make sure the payment isn’t invoiced already" },
    { id: "m3", tool: "invoicing", text: "Type the customer’s company details into the invoicing software" },
    { id: "m4", tool: "invoicing", text: "Issue the fiscal invoice" },
    { id: "m5", tool: "email", text: "Email the customer a receipt with the invoice number" },
    { id: "m6", tool: "admin", text: "If it renews a plan, start the customer’s next month of minutes" },
  ],
  copies: [
    { from: "provider", to: "invoicing", label: "Company details" },
    { from: "invoicing", to: "email", label: "Invoice number" },
  ],
  nodes: [
    { id: "event", kind: "when", label: "Stripe: invoice paid", at: { c: 0, r: 1 }, was: ["m1"],
      detail: "Stripe calls the app the moment an invoice is paid, so nobody has to look for new payments.",
      files: ["app/api/billing/webhook/route.ts"] },
    // constructEvent(rawBody, …): the signature over the body exactly as it arrived.
    { id: "sig", kind: "rule", label: "Signature checked", at: { c: 1, r: 1 },
      fresh: "Nobody checks a signature by hand: it’s what stops a forged payment.",
      detail: "The app checks Stripe’s signature over the message exactly as it arrived. A message that doesn’t match is refused, so nobody can fake a payment.",
      files: ["app/api/billing/webhook/route.ts"] },
    { id: "refused", kind: "rule", end: true, label: "Refused", at: { c: 1, r: 2 },
      detail: "A message without Stripe’s signature is turned away, and nothing happens.",
      files: ["app/api/billing/webhook/route.ts"] },
    // DONE_TTL_SECONDS and the `stripe-event:…:lock` key (LOCK_TTL_SECONDS).
    { id: "seen", kind: "once", label: "Seen this event?", at: { c: 2, r: 1 },
      fresh: "By hand, a repeat is a second notice someone has to spot.",
      detail: `Stripe sends an event again until it hears back. The app remembers every event it finished for ${FACTS_AUTO.stripeDoneHours} hours and answers a repeat without doing anything, and a lock keeps two copies of one event from running at once.`,
      files: ["app/api/billing/webhook/route.ts"] },
    { id: "ack", kind: "once", end: true, label: "Nothing repeated", at: { c: 2, r: 0 },
      detail: "A repeat is acknowledged, so Stripe stops sending it, and nothing runs twice.",
      files: ["app/api/billing/webhook/route.ts"] },
    { id: "renew", kind: "write", label: "Next period starts", at: { c: 3, r: 1 }, was: ["m6"],
      detail: "If the payment renews a plan, the customer’s next usage period starts first, so a problem with the invoice can never hold back their minutes.",
      files: ["app/api/billing/webhook/handlers.ts", "lib/billing/usage.ts"] },
    // emit.ts: "Idempotent on the Stripe invoice id", "Idempotency guard."
    { id: "issued", kind: "once", label: "Already invoiced?", at: { c: 4, r: 1 }, was: ["m2"],
      detail: "SmartBill is asked for an invoice only if none is recorded for this Stripe invoice yet.",
      files: ["lib/smartbill/emit.ts"] },
    { id: "skip", kind: "once", end: true, label: "One invoice already", at: { c: 4, r: 0 },
      detail: "An invoice issued on an earlier try is left as it is.",
      files: ["lib/smartbill/emit.ts"] },
    { id: "fiscal", kind: "write", label: "Fiscal invoice issued", at: { c: 5, r: 1 }, was: ["m3", "m4"],
      detail: "SmartBill issues the Romanian fiscal invoice with the customer’s company details, and the app records it against the Stripe invoice. One that fails is recorded too, so it shows in the dashboard.",
      files: ["lib/smartbill/emit.ts", "lib/smartbill/client.ts"] },
    // paymentSuccessEmail: subject "Payment received — …", the invoice number and a "View invoice" link.
    { id: "email", kind: "send", label: "Receipt emailed", at: { c: 6, r: 1 }, was: ["m5"],
      detail: "‘Payment received’, with the SmartBill invoice number and a link to view the invoice.",
      files: ["app/api/billing/webhook/handlers.ts", "lib/email/templates.ts"] },
    { id: "done", kind: "log", label: "Marked done", at: { c: 6, r: 2 },
      fresh: "By hand, the only record was someone’s memory.",
      detail: "The event is marked done, and Stripe is told it arrived, so it stops sending it. Had the renewal failed, the app would have told Stripe so instead, and Stripe would have sent the event again later; the checks before make that repeat safe. An invoice that fails is recorded for the dashboard instead, and a receipt that can’t be sent is let go.",
      files: ["app/api/billing/webhook/route.ts"] },
  ],
  edges: [
    { id: "event-sig", from: "event", to: "sig" },
    { id: "sig-refused", from: "sig", to: "refused", label: "no" },
    { id: "sig-seen", from: "sig", to: "seen", label: "yes" },
    { id: "seen-ack", from: "seen", to: "ack", label: "yes" },
    { id: "seen-renew", from: "seen", to: "renew", label: "no" },
    { id: "renew-issued", from: "renew", to: "issued" },
    { id: "issued-skip", from: "issued", to: "skip", label: "yes" },
    { id: "issued-fiscal", from: "issued", to: "fiscal", label: "no" },
    { id: "fiscal-email", from: "fiscal", to: "email" },
    { id: "email-done", from: "email", to: "done" },
  ],
  steps: [
    { id: "event", title: "Stripe calls the app", ring: ["event"], caption: "A customer’s invoice has just been paid." },
    { id: "sig", title: "The signature matches", hops: ["event-sig"], caption: "The signature matches, so it really is Stripe." },
    { id: "seen", title: "A first delivery", hops: ["sig-seen"], caption: "It’s the first time this event has arrived, so the app carries on, and holds a lock while it works." },
    { id: "renew", title: "The next period starts", hops: ["seen-renew"], caption: "This payment renews a plan, so next month’s minutes come first." },
    { id: "issued", title: "Not invoiced yet", hops: ["renew-issued"], caption: "No fiscal invoice is recorded for this payment yet." },
    { id: "fiscal", title: "SmartBill issues the invoice", hops: ["issued-fiscal"], caption: "The fiscal invoice is issued, with no company details typed by hand." },
    { id: "email", title: "The receipt goes out", hops: ["fiscal-email"], caption: "The customer’s receipt is on its way." },
    { id: "done", title: "Marked done", hops: ["email-done"], caption: `Done. If Stripe sends this event again within ${FACTS_AUTO.stripeDoneHours} hours, nothing is repeated.` },
  ],
  check: { kind: "call", label: "Ask us to open its code" },
});

// "Every morning at 07:00 UTC": the daily job (10 steps). One block per
// step of the route, `cron` holding its name (the test holds them, in step
// order, equal to FACTS.cronSteps). The billing chain runs in order inside
// `const billing = (async () => {`; the other five alongside it. Names are
// ours, never read from SAAS_PLATFORM, whose nightly lens adds a "wake".
const MORNING = lens({
  id: "morning",
  label: `Every morning at ${FACTS.cronAt}`,
  hand: `{n} chores across {k} tools every morning, ${word(FACTS_AUTO.billingChain)} of which must be done in order.`,
  built: `${cap(word(FACTS.cronSteps.length))} steps, ${word(FACTS_AUTO.billingChain)} in order and ${word(FACTS.cronSteps.length - FACTS_AUTO.billingChain)} side by side, and one failing never stops the others.`,
  foot: `The billing steps run in order, so calls left unbilled are billed before periods roll over and overage is reported. The other ${word(FACTS.cronSteps.length - FACTS_AUTO.billingChain)} run alongside them.`,
  tools: [
    { id: "billing", label: "Billing records" }, { id: "provider", label: "Payment provider" },
    { id: "calendar", label: "Calendar" }, { id: "admin", label: "Admin screens" },
  ],
  manual: [
    { id: "m1", tool: "billing", text: "Find calls whose billing didn’t finish, and bill them" },
    { id: "m2", tool: "billing", text: "Start next month’s minutes for every paid plan" },
    { id: "m3", tool: "provider", text: "Report minutes over each allowance to the payment provider" },
    { id: "m4", tool: "calendar", text: "Text upcoming appointments a reminder" },
    { id: "m5", tool: "admin", text: "Check every agent’s copy at the voice providers" },
    { id: "m6", tool: "admin", text: "Clear out expired locks and unused uploads" },
  ],
  copies: [{ from: "billing", to: "provider", label: "Minutes over plan" }],
  groups: [{ id: "order", label: "In order" }, { id: "side", label: "Side by side" }],
  nodes: [
    { id: "cron", kind: "time", label: `${FACTS.cronAt}, daily`, at: { c: 0, r: 1 },
      fresh: "By hand, it ran when someone remembered.",
      detail: `Vercel Cron calls the job every day at ${FACTS.cronAt}, with a secret. Without the secret, nothing runs.`,
      files: ["vercel.json", "app/api/cron/daily/route.ts", "app/api/cron/auth.ts"] },
    { id: "reconcile", kind: "write", label: "Bill what’s unbilled", at: { c: 1, r: 0 }, group: "order", cron: FACTS.cronSteps[0], was: ["m1"],
      detail: "Bills calls the phone line reported whose billing didn’t finish, without ever billing one twice.", files: ["lib/billing/usage.ts"] },
    { id: "roll", kind: "write", label: "Next usage periods", at: { c: 2, r: 0 }, group: "order", cron: FACTS.cronSteps[1], was: ["m2"],
      detail: "Starts the next usage period for paid plans whose period has ended.", files: ["lib/billing/usage.ts"] },
    { id: "overage", kind: "send", label: "Overage to Stripe", at: { c: 3, r: 0 }, group: "order", cron: FACTS.cronSteps[2], was: ["m3"],
      detail: "Reports minutes past each allowance to Stripe, once for each record.", files: ["lib/billing/usage.ts"] },
    // reminders.ts: "claimed (reminder_sent_at set) before its text goes out … releases the claim",
    // said as a mark an operations manager would recognise.
    { id: "remind", kind: "once", label: "Reminders, once each", at: { c: 1, r: 1 }, group: "side", cron: FACTS.cronSteps[3], was: ["m4"],
      detail: "Texts upcoming appointments a reminder. Each booking is marked as reminded before its text goes out, so two runs can’t text it twice, and the mark comes off if the text fails.",
      files: ["lib/scheduling/reminders.ts"] },
    { id: "resync", kind: "write", label: "Re-sync agents", at: { c: 2, r: 1 }, group: "side", cron: FACTS.cronSteps[4], was: ["m5"],
      detail: `Re-syncs up to ${FACTS.resyncBatch} agents whose copy at Cartesia or ElevenLabs is missing or out of date.`, files: ["lib/voice/sync/index.ts"] },
    { id: "locks", kind: "write", label: "Clear expired locks", at: { c: 3, r: 1 }, group: "side", cron: FACTS.cronSteps[5], was: ["m6"],
      detail: "Deletes the markers whose time has passed: the locks that stop two runs doing one job, and short-lived notes the app keeps.", files: ["app/api/cron/jobs.ts"] },
    // ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000: "day-old".
    { id: "uploads", kind: "write", label: "Remove unused uploads", at: { c: 1, r: 2 }, group: "side", cron: FACTS.cronSteps[6], was: ["m6"],
      detail: "Removes day-old uploads that nothing uses.", files: ["app/api/cron/storage-cleanup.ts"] },
    { id: "budget", kind: "read", label: "Refresh the budget", at: { c: 2, r: 2 }, group: "side", cron: FACTS.cronSteps[7],
      fresh: "A check nobody would make by hand every day.",
      detail: "Works out how much Cartesia credit is left: the same figure the app checks before each call to pick a voice provider.", files: ["lib/voice/budget.ts"] },
    // The route answers 500 when a step failed, "so it shows up in the Vercel logs".
    { id: "summary", kind: "log", label: "Summary of the run", at: { c: 6, r: 1 },
      fresh: "By hand, nobody wrote down what was done.",
      detail: "The job answers with what each step did. If one failed, it answers with an error so it shows in the logs; the rest have carried on, and running the whole job again is safe.",
      files: ["app/api/cron/daily/route.ts", "app/api/cron/jobs.ts"] },
  ],
  edges: [
    { id: "cron-reconcile", from: "cron", to: "reconcile" },
    { id: "reconcile-roll", from: "reconcile", to: "roll" },
    { id: "roll-overage", from: "roll", to: "overage" },
    { id: "overage-summary", from: "overage", to: "summary" },
    { id: "cron-side", from: "cron", to: "side" },
    { id: "side-summary", from: "side", to: "summary" },
  ],
  steps: [
    { id: "start", title: "The job starts", ring: ["cron"], caption: `It’s ${FACTS.cronAt}, and this morning’s run begins.` },
    { id: "reconcile", title: "Bills calls left unbilled", hops: ["cron-reconcile"], caption: "First in the chain: unbilled calls the phone line reported are caught up." },
    { id: "roll", title: "Starts the next periods", hops: ["reconcile-roll"], caption: "Next in the chain: any paid plan whose month is up gets fresh minutes." },
    { id: "overage", title: "Reports overage", hops: ["roll-overage"], caption: "Last in the chain: Stripe learns of any minutes over plan." },
    { id: "remind", title: "Texts reminders", hops: ["cron-side"], ring: ["remind"], caption: "Alongside the billing, reminder texts go out for upcoming bookings." },
    { id: "resync", title: "Re-syncs agents", ring: ["resync"], caption: "This morning’s batch of agents out of step at a voice provider is re-synced." },
    { id: "locks", title: "Clears expired locks", ring: ["locks"], caption: "Housekeeping: anything expired is cleared out." },
    { id: "uploads", title: "Removes unused uploads", ring: ["uploads"], caption: "More housekeeping, this time in file storage." },
    { id: "budget", title: "Refreshes the budget", ring: ["budget"], caption: "The day starts with a fresh count of the credit left." },
    { id: "summary", title: "Answers with a summary", hops: ["overage-summary", "side-summary"], caption: `All ${word(FACTS.cronSteps.length)} steps have run, and the job reports back.` },
  ],
  check: { kind: "call", label: "Ask to see a morning’s summary" }, // OWNER: that we show one on request
});

// "A document is added": the knowledge base (7 steps). Ready, then the
// copies, as ingest.ts's header orders them: "… → ready → provider copies".
const DOCUMENT = lens({
  id: "document",
  label: "A document is added",
  hand: "{n} steps across {k} places, and all of them again whenever the document changes.",
  built: "The document itself is the source: add or refresh it, and the rest runs by itself.",
  tools: [{ id: "doc", label: "The document" }, { id: "agent", label: "Agent’s instructions" }],
  manual: [
    { id: "m1", tool: "doc", text: "Read the new price list or policy" },
    { id: "m2", tool: "doc", text: "Pick out what callers will ask about" },
    { id: "m3", tool: "agent", text: "Paste it into the agent’s instructions" },
    { id: "m4", tool: "agent", text: "Take out what’s out of date" },
    { id: "m5", tool: "doc", text: "Do it all again when the document changes" },
  ],
  copies: [{ from: "doc", to: "agent", label: "Prices and hours" }],
  nodes: [
    // fetch-url.ts: safeFetch, "https only", every redirect hop re-checked.
    { id: "added", kind: "when", label: "A file or page added", at: { c: 0, r: 1 },
      fresh: "By hand, a new document waited until someone got round to it.",
      detail: "A file uploaded in the dashboard, or a web address the app fetches itself: https only, never a private address, and every redirect checked again.",
      files: ["app/api/agent/knowledge/upload-url/route.ts", "app/api/agent/knowledge/url/route.ts", "lib/knowledge/fetch-url.ts"] },
    { id: "read", kind: "read", label: "Read and cleaned", at: { c: 1, r: 1 }, was: ["m1"],
      detail: "The file is read and checked, and its text is taken out and cleaned up.", files: ["lib/knowledge/extract.ts", "lib/knowledge/ingest.ts"] },
    // ingest.ts: "hash (skip re-embedding when unchanged)"; an unchanged text still
    // ends ready and sends the copies (`if (!unchanged) {…}` skips only the indexing).
    { id: "changed", kind: "once", label: "Has the text changed?", at: { c: 2, r: 1 }, was: ["m5"],
      detail: "When a document is read again, or a web page refreshed, from the dashboard, text that hasn’t changed isn’t indexed again.", files: ["lib/knowledge/ingest.ts"] },
    { id: "same", kind: "once", end: true, label: "Nothing re-indexed", at: { c: 2, r: 0 },
      detail: "Unchanged: nothing is re-indexed, and it goes straight to ready and the copies.", files: ["lib/knowledge/ingest.ts"] },
    { id: "index", kind: "ai", label: "Indexed for search", at: { c: 3, r: 1 }, was: ["m2", "m3"],
      detail: "Cut into passages and indexed with OpenAI, so the agent can search them in the middle of a call.",
      files: ["lib/knowledge/chunk.ts", "lib/knowledge/ingest.ts"] },
    // ingest.ts: "insert the new chunks, then delete the old ones".
    { id: "swap", kind: "write", label: "New in, then old out", at: { c: 4, r: 1 }, was: ["m4"],
      detail: "The new passages go in before the old ones come out, so the agent is never left with half a document, and a refresh that fails keeps the version it already uses.",
      files: ["lib/knowledge/ingest.ts"] },
    // ingest.ts: "It never throws: every failure ends on the row as a plain error_message."
    { id: "ready", kind: "log", label: "Ready, or why not", at: { c: 5, r: 1 },
      fresh: "By hand, a half-done update looked the same as a finished one.",
      detail: "It never ends in silence: the document is ready, or it carries a plain reason a person can act on.", files: ["lib/knowledge/ingest.ts"] },
    // providers.ts: best effort, a failure stored on the document, never failing it.
    { id: "copies", kind: "send", label: "Copies to providers", at: { c: 6, r: 1 },
      fresh: "Not a step anyone did by hand.",
      detail: "Copies go to the voice providers’ own knowledge bases. If one can’t take it, that’s noted on the document, and the document stays ready.",
      files: ["lib/knowledge/providers.ts"] },
  ],
  edges: [
    { id: "added-read", from: "added", to: "read" },
    { id: "read-changed", from: "read", to: "changed" },
    { id: "changed-same", from: "changed", to: "same", label: "no" },
    { id: "changed-index", from: "changed", to: "index", label: "yes" },
    { id: "index-swap", from: "index", to: "swap" },
    { id: "swap-ready", from: "swap", to: "ready" },
    { id: "ready-copies", from: "ready", to: "copies" },
  ],
  steps: [
    { id: "added", title: "A document is added", ring: ["added"], caption: "A new price list is uploaded in the dashboard." },
    { id: "read", title: "Read and cleaned", hops: ["added-read"], caption: "The price list’s words are pulled out of the file." },
    { id: "changed", title: "It’s new", hops: ["read-changed"], caption: "The price list has changed since last time, so nothing is skipped." },
    { id: "index", title: "Indexed for search", hops: ["changed-index"], caption: "The new prices are indexed, ready to swap in." },
    { id: "swap", title: "New in, old out", hops: ["index-swap"], caption: "The old prices are gone, and the agent never saw a gap." },
    { id: "ready", title: "Ready", hops: ["swap-ready"], caption: "The price list shows as ready for calls in the dashboard." },
    { id: "copies", title: "Copies sent", hops: ["ready-copies"], caption: "Each voice provider the agent uses gets its own copy." },
  ],
  check: { kind: "site", label: "Add a document on the free trial", href: PRICING_TRIAL.href },
});

// "A call ends": the post-call pipeline into the workflows (9 steps), the
// hardest: AI, rules, a person, never twice. post-call.ts takes the
// `post-call:analyze:` lock, returns on `row.is_test` before the
// `post-call:workflows:` guard, then fires call_ended, sentiment_negative
// when negative and keyword_detected; the executor claims `wf:once:` per
// workflow and call. The run shown is an unhappy caller: two rules fire.
const CALL_LENS = lens({
  id: "call",
  label: "A call ends",
  hand: "{n} steps across {k} tools after every call, for whoever has the time.",
  built: "One flow from the transcript to your team, run once for each call.",
  tools: [
    { id: "recording", label: "Call recording" }, { id: "notes", label: "Notes" },
    { id: "records", label: "Your records" }, { id: "chat", label: "Team chat" },
  ],
  manual: [
    { id: "m1", tool: "recording", text: "Listen back to the call" },
    { id: "m2", tool: "notes", text: "Write down what the caller wanted" },
    { id: "m3", tool: "notes", text: "Decide how it went: booked, a message, a complaint" },
    { id: "m4", tool: "records", text: "Copy their name and details into your records" },
    { id: "m5", tool: "chat", text: "Tell the managers when a caller was unhappy" },
    { id: "m6", tool: "records", text: "Tag the calls that need a call back" },
  ],
  copies: [
    { from: "recording", to: "notes", label: "What they wanted" },
    { from: "notes", to: "records", label: "Caller’s details" },
  ],
  nodes: [
    { id: "ended", kind: "when", label: "The call ends", at: { c: 0, r: 1 },
      fresh: "By hand, someone first had to notice the call.",
      detail: "Whichever voice service handled the call, the app saves its transcript. Voice services retry and can report a call twice, so saving it is safe to repeat.",
      files: ["lib/voice/post-call.ts"] },
    { id: "fresh", kind: "once", label: "Not written up yet?", at: { c: 1, r: 1 },
      fresh: "By hand, two people could write up the same call.",
      detail: "A call that’s already written up is left alone, and two write-ups of one call can’t run at once.", files: ["lib/voice/post-call.ts"] },
    { id: "alone", kind: "once", end: true, label: "Left alone", at: { c: 1, r: 0 },
      detail: "Written up already: nothing more happens.", files: ["lib/voice/post-call.ts"] },
    // analysis.ts: "2 to 4 plain sentences", CALL_OUTCOMES, "only values the caller clearly stated … Never guess."
    { id: "ai", kind: "ai", label: "OpenAI writes it up", at: { c: 2, r: 1 }, was: ["m1", "m2", "m3"],
      detail: `${cap(word(2))} to ${word(4)} plain sentences on what the caller wanted and what happened, how they felt, one of ${word(CALL_OUTCOMES.length)} outcomes, the reason for calling and the details you asked it to collect — only what the caller clearly said, never a guess. It’s saved on the call.`,
      files: ["lib/openai/analysis.ts", "lib/voice/post-call.ts"] },
    { id: "test", kind: "rule", label: "A test call?", at: { c: 3, r: 1 },
      fresh: "By hand, nobody needed to tell a test from a real call.",
      detail: "Calls made from the dashboard to try the agent are written up too, but go no further: no workflow runs for them.",
      files: ["lib/voice/post-call.ts", "lib/workflows/executor.ts"] },
    { id: "stops", kind: "rule", end: true, label: "Stops here", at: { c: 3, r: 0 },
      detail: "A test call’s write-up stays in the dashboard.", files: ["lib/voice/post-call.ts"] },
    // keywords.ts: "Whole words or phrases only", "Case never matters"; router.ts runs call_missed.
    { id: "fire", kind: "rule", label: "Which rules fire?", at: { c: 4, r: 1 },
      fresh: "By hand, who needed to know was a judgement, call by call.",
      detail: `‘${T("call_ended")}’ always; ‘${T("sentiment_negative")}’ when the caller was unhappy; ‘${T("keyword_detected")}’ when a word you listen for was said, as a whole word, whatever the capitals. ‘${T("call_missed")}’ runs its own workflows the moment the phone line reports a missed call.`,
      files: ["lib/voice/post-call.ts", "lib/workflows/keywords.ts", "lib/voice/router.ts"] },
    { id: "once", kind: "once", label: "Once per call", at: { c: 5, r: 1 },
      fresh: "By hand, a repeat was a second message nobody meant to send.",
      detail: "Before running, each workflow marks the call as handled, so none can run twice for one call, even when the call’s end is reported twice.",
      files: ["lib/workflows/executor.ts"] },
    { id: "steps", kind: "send", label: "Your workflows run", at: { c: 6, r: 1 }, datum: `signed · ${FACTS.webhookAttempts} tries`, was: ["m4", "m6"],
      detail: "Their steps run in order — a tag, a signed webhook, a text to the caller — and stop at the first failure. A webhook is tried again when the other end is busy.",
      files: ["lib/workflows/executor.ts", "lib/workflows/webhook.ts"],
      check: { kind: "site", label: "Break it below", href: "#breaks" } },
    // DEFAULT_SLACK_MESSAGE: the direction, the caller's number, the sentiment and the summary.
    { id: "team", kind: "person", label: "Managers told in Slack", at: { c: 6, r: 0 }, was: ["m5"],
      detail: "A Slack message tells the managers who called, how they felt, and the summary, in the channel the workflow names.",
      files: ["lib/workflows/executor.ts", "lib/workflows/templates.ts"] },
    // workflow_runs, and increment_workflow_counters for the success rate.
    { id: "log", kind: "log", label: "Run recorded", at: { c: 6, r: 2 },
      fresh: "By hand, there was no record of what was done.",
      detail: "Each run is saved with every step’s outcome, in words the owner can act on, and the workflow’s success rate updates.",
      files: ["lib/workflows/executor.ts"] },
  ],
  edges: [
    { id: "ended-fresh", from: "ended", to: "fresh" },
    { id: "fresh-alone", from: "fresh", to: "alone", label: "no" },
    { id: "fresh-ai", from: "fresh", to: "ai", label: "yes" },
    { id: "ai-test", from: "ai", to: "test" },
    { id: "test-stops", from: "test", to: "stops", label: "yes" },
    { id: "test-fire", from: "test", to: "fire", label: "no" },
    { id: "fire-once", from: "fire", to: "once" },
    { id: "once-steps", from: "once", to: "steps" },
    { id: "steps-team", from: "steps", to: "team" },
    { id: "steps-log", from: "steps", to: "log" },
  ],
  steps: [
    { id: "ended", title: "The call ends", ring: ["ended"], caption: "The call ends, and its transcript is saved." },
    { id: "fresh", title: "Not written up yet", hops: ["ended-fresh"], caption: "Nobody has written it up yet, so the write-up starts, and holds a lock while it runs." },
    { id: "ai", title: "OpenAI writes it up", hops: ["fresh-ai"], caption: "OpenAI’s write-up is in, and the caller’s mood with it." },
    { id: "test", title: "A real call", hops: ["ai-test"], caption: "It’s a real call, not a test from the dashboard, so it carries on." },
    { id: "fire", title: "Two rules fire", hops: ["test-fire"], caption: `The caller was unhappy, so two rules fire: ‘${T("call_ended")}’ and ‘${T("sentiment_negative")}’.` },
    { id: "once", title: "Marked once", hops: ["fire-once"], caption: "Each workflow marks the call as handled; none has run for it before." },
    { id: "steps", title: "The workflows run", hops: ["once-steps"], caption: "Their steps run in order: a tag on the call, then a signed webhook to the CRM, tried again if the CRM is busy." },
    { id: "team", title: "The managers hear", hops: ["steps-team"], caption: "The managers hear about it in Slack." },
    { id: "log", title: "Each run recorded", hops: ["steps-log"], caption: "Every step succeeded, and it’s all on record." },
  ],
  check: { kind: "site", label: "Make a test call on the free trial, and read its write-up", href: PRICING_TRIAL.href },
});

// Simplest first: the order the workbench offers them in, and the sub counts.
const LENSES = [PAY, MORNING, DOCUMENT, CALL_LENS] as const;

/* ---------- #running: the ledger ---------- */

// "Six more that run by themselves here". Card ids are link targets
// (`id="run-<id>"`; KINDS.person shows `#run-notify`). Bodies are one or
// two sentences; `files` and `more` print in the index only.
const LEDGER: readonly LedgerCard[] = [
  // notify.ts: "only tells the caller "the team has been alerted" when a text or email really went out".
  { id: "notify", kind: "person", when: "A caller needs someone now", title: "The team alerted mid-call",
    body: `The agent texts or emails the person on call, and the alert is saved to the dashboard’s inbox. It tells the caller the team knows only once an alert has really gone out, and sends at most ${word(FACTS_AUTO.alertsPerCall)} a call.`,
    figure: `at most ${FACTS_AUTO.alertsPerCall} a call`, files: ["lib/voice/tools/notify.ts", "lib/notifications/index.ts"] },
  { id: "bookings", kind: "send", when: "A booking is made, and each morning", title: "Bookings confirmed and reminded",
    body: "On plans with texts, a caller who asks for one gets a confirmation text, and a reminder goes out before the appointment. Each reminder is marked before it goes out, so two runs can’t send it twice, and the mark comes off if the text fails.",
    files: ["lib/scheduling/bookings.ts", "lib/scheduling/reminders.ts"] },
  // waitlist.ts: "so two people can't be promised one slot by the system". Said as it says it.
  { id: "waitlist", kind: "rule", when: "A booking is cancelled or moved", title: "A freed slot offered to the waiting list",
    body: "The time is offered by text to the caller who has waited longest for that service. They call back to book it, so the system never promises one slot to two people.",
    files: ["lib/scheduling/waitlist.ts"] },
  // usage.ts: "an email that failed to send is retried by the next billed call" (kvDel on a failed send).
  { id: "usage", kind: "once", when: "Usage passes a mark",
    title: `Usage emails at ${FACTS_AUTO.usageMarks[0]}% and ${FACTS_AUTO.usageMarks[1]}%`,
    body: "The owner gets at most one email at each mark in a period. Each is marked before it goes out, so two calls ending together don’t both send it, and if one fails to send, the next call that adds minutes tries again.",
    figure: `${FACTS_AUTO.usageMarks[0]}% · ${FACTS_AUTO.usageMarks[1]}%`, files: ["lib/billing/usage.ts", "lib/email/templates.ts"] },
  { id: "minutes", kind: "once", when: "Usage is counted", title: "Every minute billed once",
    body: "Each call’s minutes are billed once, from the phone line’s count or the voice service’s, never both, and any minutes over the plan are counted call by call. If a call the phone line reported was never billed, the morning job bills it.",
    files: ["lib/billing/usage.ts", "lib/twilio/status.ts", "app/api/elevenlabs/webhook/handlers.ts"] },
  // The self-serve product, counted from the engine: the words come from its lengths.
  { id: "workflows", kind: "log", when: "After a call, on your rules", title: "Workflows you set up yourself",
    body: `${cap(word(TRIGGER_TYPES.length))} moments start one — ${listJoin(TRIGGER_TYPES.map((t) => TRIGGER_WORDS[t]))} — and each runs up to ${word(MAX_WORKFLOW_ACTIONS)} steps in order, picked from ${word(ACTION_TYPES.length)} kinds, with every run recorded.`,
    figure: `${TRIGGER_TYPES.length} triggers · ${ACTION_TYPES.length} kinds`,
    more: `The ${word(ACTION_TYPES.length)} kinds: ${listJoin(ACTION_TYPES.map((a) => ACTION_WORDS[a]))}. The ${word(GOOGLE_STEPS.length)} Google steps are in beta.`,
    link: { label: "See them", href: "/product/integrations" },
    files: ["lib/workflows/types.ts", "lib/workflows/executor.ts"] },
];

/* ---------- #running ---------- */

// The sub and the FAQ's "calls" row say only the last lens starts with a
// call, and what the other three start with: re-read both if the lenses change.
if (LENSES.map((l) => l.id).join() !== "pay,morning,document,call") throw new Error("custom-automations: the lenses changed; re-read AUTO_RUNNING.sub and AUTO_FAQ’s “calls” row");

export const AUTO_RUNNING: RunningData = keyed({
  eyebrow: "Already running",
  title: "The automations this platform runs on, from manual to automatic",
  key: "from manual to automatic",
  // "Drawn from the code" is the tag's job, as on the SaaS page: said there, not here too.
  sub: `${cap(word(LENSES.length))} of them, simplest first, and only the last starts with a phone call: the others start with a payment, the time of day and a new document, as work does in any business. Pick one to see the steps a person would do by hand, the flow that does them instead, and a run from start to finish.`,
  tag: "Drawn from the code · not a live feed",
  lensesAria: "Which automation, simplest first",
  transport: { play: "Play it", pause: "Pause", replay: "Play it again" },
  lanes: { hand: "By hand", flow: "By itself" },
  phase: { hand: "By hand", waiting: "Not built yet", built: "Built" },
  stepOf: "Step {n} of {total}",
  logTitle: "The run",
  logAria: "Every step of the run",
  blockTitle: "The block",
  hint: "The block the run is on. Choose a step or pick a block to see others.",
  hintTour: "The run’s last block. Choose a step or pick a block to see others.",
  picked: "Your pick. Choose a step to follow the run again.",
  was: "By hand, this was",
  code: "In the code, for your developers",
  onRun: "On this run: step {n} of {total}",
  offRun: "Not on this run",
  nowStep: "now step {n}",
  pill: { running: "Running", done: "Done" },
  meters: METER_COPY,
  kinds: KINDS,
  checkKinds: CHECK_KINDS,
  indexSummary: "Every automation above, in words",
  indexHand: "By hand",
  indexFlow: "By itself",
  live: "Step {n} of {total}: {text}",
  liveLens: "{label}: {total} steps, {blocks} blocks.",
  initial: "pay",
  lenses: LENSES,
  ledger: { title: "Six more that run by themselves here", cards: LEDGER },
  // The ledger's six start with a caller: the foot says what they are anywhere else.
  foot: "Drawn by the team that built them. Swap the caller for a customer, a patient or a guest, and they’re the alerts, reminders, waiting lists and billing most businesses need. Each block names the file it lives in, for your developers.", // OWNER
});

/* ---------- #work: the eighteen samples ---------- */

/**
 * One sample, with its id built from its field and level. Throws if it
 * doesn't arrive (every flow starts with "It arrives") or a move it makes
 * has no blocks: a move a sample doesn't make is left out, and prints as
 * "Not in this one". The difficulty rules (a copy-paste ≤ 4 blocks and no
 * AI or approval; more blocks at each level, and never fewer meters met;
 * a person or an approval in every pipeline; each level's gloss true of
 * all its samples; no digit, no brand) are the test's to hold.
 */
function sample(field: FieldId, level: LevelId, s: Omit<Sample, "id" | "field" | "level">): Sample {
  const id = `${field}-${level}` as const;
  if (!s.moves.arrives) throw new Error(`custom-automations: sample "${id}" never arrives`);
  for (const [move, m] of Object.entries(s.moves)) {
    if (!m || m.flow.length === 0) throw new Error(`custom-automations: sample "${id}" makes "${move}" with no blocks`);
  }
  return { id, field, level, ...s };
}

// Six fields × three levels, in the order the controls list them. The
// same six moves (MOVES) are the rows of every one; a copy-paste makes
// three of them, and each level up takes more blocks in all, and meets
// at least as many of the meters (the test holds both). The rows print
// top to bottom, so a block that must wait for a later one's outcome
// says so ("Once approved", "If so, when it’s back").
// Blocks: finance 4 · 7 · 9, sales 4 · 7 · 8, service 3 · 8 · 9,
// operations 3 · 7 · 8, people 3 · 6 · 8, shops 3 · 6 · 7.
const SAMPLES: readonly Sample[] = [ // SAMPLE: written for this page, for no business in particular
  /* ── Finance ── */
  sample("finance", "copy", {
    title: "Every payment, a row in the bookkeeping sheet", who: "Someone in finance, every day",
    moves: {
      arrives: { hand: "Check the payment provider for new payments", flow: [{ kind: "when", text: "A payment comes in" }] },
      entered: { hand: "Copy each one into the bookkeeping spreadsheet", flow: [
        { kind: "once", text: "Not in the sheet yet?" }, { kind: "write", text: "A row in the bookkeeping spreadsheet" }] },
      passed: { hand: "Email the customer a receipt", flow: [{ kind: "send", text: "A receipt to the customer" }] },
    },
    person: "Reads the sheet. Nobody copies anything.",
  }),
  sample("finance", "process", {
    title: "Supplier invoices from the inbox into the accounts", who: "Someone in finance, with a manager’s sign-off",
    moves: {
      arrives: { hand: "Open each invoice that arrives by email", flow: [{ kind: "when", text: "An invoice reaches the finance inbox" }] },
      read: { hand: "Find the supplier, number, date and total", flow: [{ kind: "ai", text: "AI reads the supplier, number, date and total" }] },
      entered: { hand: "Type them into the accounting software, if they aren’t there already", flow: [
        { kind: "once", text: "Not entered already?" }, { kind: "write", text: "A draft bill, with the PDF attached" }] },
      followed: { hand: "File the PDF and remember what was done", flow: [{ kind: "log", text: "Every invoice recorded, with what was read" }] },
      decided: { hand: "Ask the manager to approve the big ones", flow: [
        { kind: "rule", text: "Over the approval limit?" }, { kind: "approve", text: "If so, the manager approves it" }] },
    },
    person: "Approves the big ones, and checks any invoice the AI couldn’t read clearly.",
    hard: "Invoices come in every layout, the same one arrives twice, and some need a yes before they’re paid.",
  }),
  sample("finance", "pipeline", {
    title: "Month-end bank reconciliation", who: "An accountant, every month end",
    moves: {
      arrives: { hand: "Download the bank statement", flow: [
        { kind: "time", text: "On the first working day of the month" }, { kind: "read", text: "The statement, from the bank’s export" }] },
      read: { hand: "Match each line to an invoice or a bill", flow: [
        { kind: "ai", text: "Each line matched to an open invoice or bill, messy references included" }] },
      entered: { hand: "Post the matches in the accounting software", flow: [
        { kind: "rule", text: "Does it match exactly?" }, { kind: "once", text: "If so, posted once in the accounting software" },
        { kind: "retry", text: "A post that fails is tried again" }] },
      passed: { hand: "Write up the month-end summary", flow: [{ kind: "write", text: "The month-end report, ready to review" }] },
      followed: { hand: "Keep a note of what was matched, for next month", flow: [{ kind: "log", text: "Every match recorded, so next month starts clean" }] },
      decided: { hand: "Chase and decide the lines that don’t match", flow: [
        { kind: "person", text: "The accountant decides the rest, from a short list with suggestions" }] },
    },
    person: "Decides only the lines that don’t match. Nobody ticks off a statement by hand.",
    hard: "References are typed by hand, one payment can cover several invoices, and nothing may be posted twice.",
  }),
  /* ── Sales ── */
  sample("sales", "copy", {
    title: "Website enquiries into the CRM", who: "Someone in sales",
    moves: {
      arrives: { hand: "Check the enquiries inbox", flow: [{ kind: "when", text: "Someone fills in the website’s form" }] },
      entered: { hand: "Copy each enquiry into the CRM", flow: [{ kind: "write", text: "A new lead in the CRM" }] },
      passed: { hand: "Reply to say thanks, and tell the team", flow: [
        { kind: "send", text: "A thank-you email to them" }, { kind: "send", text: "A message in the sales channel" }] },
    },
    person: "Picks up the lead. Nobody retypes it.",
  }),
  sample("sales", "process", {
    title: "Leads routed and followed up", who: "A sales manager",
    moves: {
      arrives: { hand: "Collect enquiries from the form, the inbox and the phone", flow: [{ kind: "when", text: "A lead arrives by form, email or phone" }] },
      read: { hand: "Read each one: what they want, how soon, where they are", flow: [{ kind: "ai", text: "AI sorts it: what they want, how soon, where they are" }] },
      entered: { hand: "Check the CRM, so nobody is added twice", flow: [{ kind: "once", text: "Already in the CRM? Then it’s updated, not added again" }] },
      passed: { hand: "Decide who should take it, and forward it", flow: [
        { kind: "rule", text: "Routed by your rules" }, { kind: "send", text: "The right salesperson is told" }] },
      followed: { hand: "Check the next day that someone called", flow: [
        { kind: "time", text: "Next working day: has anyone replied?" }, { kind: "person", text: "If not, the lead’s owner and their manager are told" }] },
    },
    person: "Talks to the lead. The chasing is automatic.",
    hard: "Leads arrive three ways, some of them twice. Routing rules change. A lead nobody answered must not be lost.",
  }),
  // Read top to bottom: a step that has to wait for a signature says so
  // ("Once it’s signed"), so nothing reads as done before it can be.
  sample("sales", "pipeline", {
    title: "From won deal to first invoice", who: "Sales, finance and delivery, each by hand",
    moves: {
      arrives: { hand: "Notice a deal was won in the CRM", flow: [{ kind: "when", text: "A deal is marked won in the CRM" }] },
      read: { hand: "Find the agreed discounts and terms in the deal’s notes and emails", flow: [
        { kind: "ai", text: "AI reads the agreed discounts and terms from the deal’s notes and emails" }] },
      entered: { hand: "Build the quote, and once it’s signed, set up the customer and the first invoice", flow: [
        { kind: "write", text: "The quote, built from the price list" },
        { kind: "once", text: "Once it’s signed: the customer and the first invoice, created once" }] },
      passed: { hand: "Send it for signature, and tell delivery once it’s signed", flow: [
        { kind: "send", text: "Sent for e-signature, and to delivery once signed" }] },
      followed: { hand: "Chase the signature every morning", flow: [{ kind: "time", text: "Each morning until it’s signed: a reminder" }] },
      decided: { hand: "Decide what to do when nobody signs", flow: [
        { kind: "rule", text: "Still not signed after the reminders?" }, { kind: "person", text: "Then the salesperson is told" }] },
    },
    person: "Sells. The paperwork between systems happens on its own.",
    hard: "Four systems, a signature nobody can predict, and a customer who must be created exactly once.",
  }),
  /* ── Customer service ── */
  sample("service", "copy", {
    title: "Every support email acknowledged and logged", who: "Someone in support",
    moves: {
      arrives: { hand: "Watch the support inbox", flow: [{ kind: "when", text: "An email reaches the support inbox" }] },
      entered: { hand: "Copy it into the ticket spreadsheet", flow: [{ kind: "write", text: "A row in the ticket spreadsheet" }] },
      passed: { hand: "Reply to say it arrived", flow: [{ kind: "send", text: "A reply with a reference number" }] },
    },
    person: "Answers the question. The logging is done.",
  }),
  sample("service", "process", {
    title: "Messages sorted and sent to the right person", who: "A support lead",
    moves: {
      arrives: { hand: "Keep an eye on email, the form and chat", flow: [{ kind: "when", text: "A message arrives by email, form or chat" }] },
      read: { hand: "Read every message to see what it’s about", flow: [{ kind: "ai", text: "AI reads it: the topic, the customer and how urgent it is" }] },
      entered: { hand: "Open a ticket for it", flow: [{ kind: "write", text: "A ticket, with the message attached" }] },
      passed: { hand: "Forward it to the right person", flow: [
        { kind: "rule", text: "Urgent?" }, { kind: "person", text: "If so, the person on duty is texted now" },
        { kind: "send", text: "If not, it goes to the right team’s queue" }] },
      followed: { hand: "Check later that someone replied", flow: [
        { kind: "time", text: "No reply by the time you promised?" }, { kind: "person", text: "Then the support lead is told" }] },
    },
    person: "Answers people. Nobody reads every message just to sort it.",
    hard: "Customers write however they write. Urgent means now. A promised reply has to be kept.",
  }),
  sample("service", "pipeline", {
    title: "Returns and refunds, end to end", who: "Support, the warehouse and finance",
    moves: {
      arrives: { hand: "Read the return request", flow: [{ kind: "when", text: "A customer asks to return an order" }] },
      read: { hand: "Find the order and check the return policy", flow: [
        { kind: "ai", text: "AI reads the request and finds the order" }, { kind: "rule", text: "Inside your return policy?" }] },
      entered: { hand: "Once it’s back, refund the customer and update the stock", flow: [
        { kind: "once", text: "If so, when it’s back: the refund issued once, or a replacement ordered" }, { kind: "write", text: "Stock updated everywhere" }] },
      passed: { hand: "Tell the customer at every step", flow: [{ kind: "send", text: "The customer is told at every step" }] },
      followed: { hand: "Wait for the parcel to come back", flow: [
        { kind: "wait", text: "Waits for the courier’s scan that it’s back" }, { kind: "retry", text: "A courier that doesn’t answer is asked again" }] },
      decided: { hand: "Decide on the ones outside the policy", flow: [{ kind: "approve", text: "Outside the policy? A person decides" }] },
    },
    person: "Decides the exceptions. The rest moves on its own.",
    hard: "Three teams, a parcel in transit and money going back — and a refund that must never be issued twice.",
  }),
  /* ── Operations ── */
  sample("operations", "copy", {
    title: "New orders sent to the warehouse", who: "Someone in operations",
    moves: {
      arrives: { hand: "Check for new orders", flow: [{ kind: "when", text: "An order is placed" }] },
      entered: { hand: "Mark the order as being picked", flow: [{ kind: "write", text: "The order marked as being picked" }] },
      passed: { hand: "Email the pick list to the warehouse", flow: [{ kind: "send", text: "The pick list to the warehouse’s inbox" }] },
    },
    person: "Picks and packs. Nobody forwards orders.",
  }),
  sample("operations", "process", {
    title: "Reordering before stock runs out", who: "A buyer",
    moves: {
      arrives: { hand: "Check stock levels every morning", flow: [{ kind: "time", text: "Every morning" }] },
      read: { hand: "Compare them with what’s already on order", flow: [
        { kind: "read", text: "Stock levels and open orders" }, { kind: "rule", text: "Below the reorder level, with nothing on order?" }] },
      entered: { hand: "Draft a purchase order", flow: [{ kind: "write", text: "If so, a draft purchase order" }] },
      passed: { hand: "Email it to the supplier once it’s approved", flow: [{ kind: "send", text: "Once approved, sent to the supplier" }] },
      followed: { hand: "Note it in the stock sheet", flow: [{ kind: "log", text: "Noted, with what started it" }] },
      decided: { hand: "Decide what to buy", flow: [{ kind: "approve", text: "The buyer approves it before it goes" }] },
    },
    person: "Approves what gets bought.",
    hard: "Stock moves all day, and an order already placed must not be placed again.",
  }),
  sample("operations", "pipeline", {
    title: "Shipments tracked across couriers", who: "Someone in operations, parcel by parcel",
    moves: {
      arrives: { hand: "Go through the day’s parcels", flow: [{ kind: "time", text: "Through the day" }] },
      read: { hand: "Look up each parcel on each courier’s website", flow: [
        { kind: "ai", text: "AI reads each courier’s tracking, however that courier words it" },
        { kind: "retry", text: "A courier that doesn’t answer is tried again later" }] },
      entered: { hand: "Update each order when it moves", flow: [{ kind: "write", text: "Every order’s status kept in step" }] },
      passed: { hand: "Email customers about delays", flow: [
        { kind: "rule", text: "Late or stuck?" }, { kind: "send", text: "If late, the customer hears before they ask" }] },
      followed: { hand: "Keep a note of every claim", flow: [{ kind: "log", text: "Every claim and delay recorded" }] },
      decided: { hand: "Open a claim for a lost parcel", flow: [{ kind: "person", text: "If lost, a claim is prepared for a person to check" }] },
    },
    person: "Checks the claims. Nobody refreshes courier websites.",
    hard: "Every courier reports differently, some go quiet, and a delay has to reach the customer first.",
  }),
  /* ── People and HR ── */
  sample("people", "copy", {
    title: "A new starter’s first day, set up", who: "Someone in HR",
    moves: {
      arrives: { hand: "Notice a new name in the HR sheet", flow: [{ kind: "when", text: "A new starter is added to the HR sheet" }] },
      entered: { hand: "Put the first day in the calendar", flow: [{ kind: "write", text: "The first day in the team calendar" }] },
      passed: { hand: "Email the manager the starter checklist", flow: [{ kind: "send", text: "The checklist to their manager" }] },
    },
    person: "Welcomes them.",
  }),
  sample("people", "process", {
    title: "Holiday requests", who: "A manager and HR",
    moves: {
      arrives: { hand: "Read the request", flow: [{ kind: "when", text: "Someone asks for time off" }] },
      read: { hand: "Check the days left and the calendar", flow: [
        { kind: "read", text: "Their days left and the team calendar" }, { kind: "rule", text: "A clash, or not enough days?" }] },
      entered: { hand: "Once approved, update the balance and the calendar", flow: [{ kind: "write", text: "Once approved: balance and calendar updated" }] },
      passed: { hand: "Reply to the person who asked", flow: [{ kind: "send", text: "The manager’s answer goes back to them" }] },
      decided: { hand: "Ask the manager", flow: [{ kind: "approve", text: "The manager says yes or no in one click" }] },
    },
    person: "Says yes or no. Nothing else.",
    hard: "Clashes, balances and a manager who must decide, without a spreadsheet in between.",
  }),
  sample("people", "pipeline", {
    title: "Joiners and leavers, across every system", who: "HR and IT, system by system",
    moves: {
      arrives: { hand: "Hear that someone was hired, or is leaving", flow: [{ kind: "when", text: "A contract is signed, or someone hands in their notice" }] },
      read: { hand: "Work out the role, the team and the start or leaving date", flow: [
        { kind: "ai", text: "AI reads the contract or the notice for the role, the team and the date" }] },
      entered: { hand: "Open or close an account in every tool, and update payroll", flow: [
        { kind: "write", text: "Accounts opened or closed in each system" }, { kind: "write", text: "Payroll updated" }] },
      passed: { hand: "Order the equipment, or arrange its return", flow: [{ kind: "send", text: "Equipment ordered, or its return arranged" }] },
      followed: { hand: "Chase the signed documents", flow: [
        { kind: "wait", text: "Waits for each document to be signed, with reminders" },
        { kind: "log", text: "Every step recorded, so leaving undoes exactly what joining did" }] },
      decided: { hand: "Check the right-to-work documents", flow: [{ kind: "approve", text: "HR checks the documents only a person should check" }] },
    },
    person: "Checks the right-to-work documents. Nobody opens or closes an account by hand.",
    hard: "Many systems, legal documents, and a leaver whose access must be removed everywhere at once.",
  }),
  /* ── Online shops ── */
  sample("shops", "copy", {
    title: "Paid orders into the accounts", who: "Someone in finance",
    moves: {
      arrives: { hand: "Check the shop for paid orders", flow: [{ kind: "when", text: "An order is paid" }] },
      entered: { hand: "Copy each order’s total and tax into the accounting software", flow: [{ kind: "write", text: "A sales entry in the accounting software" }] },
      passed: { hand: "Send the customer an invoice", flow: [{ kind: "send", text: "The invoice to the customer" }] },
    },
    person: "Nothing, until the accounts need a look.",
  }),
  sample("shops", "process", {
    title: "Stock kept in step across every channel", who: "Someone in e-commerce",
    moves: {
      arrives: { hand: "Notice a sale on any channel", flow: [{ kind: "when", text: "Something sells on any channel" }] },
      read: { hand: "Check whether it sold out", flow: [{ kind: "rule", text: "Sold out?" }] },
      entered: { hand: "Lower the stock on every other channel", flow: [
        { kind: "once", text: "Counted once, even if the channel reports it twice" }, { kind: "write", text: "Stock lowered everywhere" }] },
      passed: { hand: "Hide it everywhere and tell the buyer", flow: [
        { kind: "write", text: "If so, hidden on every channel" }, { kind: "person", text: "The buyer is told" }] },
    },
    person: "Reorders. Nobody updates every admin panel by hand.",
    hard: "Channels report sales late and sometimes twice, and one oversold item is a refund.",
  }),
  sample("shops", "pipeline", {
    title: "Marketplace payouts reconciled", who: "An accountant, payout by payout",
    moves: {
      arrives: { hand: "Download each marketplace’s payout report", flow: [
        { kind: "when", text: "A marketplace pays out" }, { kind: "read", text: "Its payout report" }] },
      read: { hand: "Match orders, fees and refunds", flow: [{ kind: "ai", text: "Orders, fees and refunds matched line by line" }] },
      entered: { hand: "Post what matches in the accounting software", flow: [
        { kind: "once", text: "What matches, posted once in the accounting software" }, { kind: "retry", text: "A post that fails is tried again" }] },
      followed: { hand: "Keep the working for the auditor", flow: [{ kind: "log", text: "Every payout recorded with how it was matched" }] },
      decided: { hand: "Find what’s missing", flow: [{ kind: "person", text: "Anything that doesn’t add up goes to the accountant, listed" }] },
    },
    person: "Looks into what doesn’t add up: a short list, not the whole report.",
    hard: "Every marketplace formats its report its own way, and the totals must match to the cent.",
  }),
];

/* ---------- #work ---------- */

export const AUTO_WORK: WorkData = keyed({
  eyebrow: "Your kind of work",
  title: "Whatever your field, and however hard the work",
  key: "however hard the work",
  // Not every block runs here (KINDS: a long wait, an approval), so the sub
  // points at the legend, which says which, and never says they all do.
  sub: "Pick a field and how hard the job is. The work in every field is made of the same six moves; a simple job makes only a few of them. Under each sample, the legend shows which of its blocks already run on this platform.",
  fieldsLabel: "Your field",
  levelLabel: "How hard",
  fields: [
    { id: "finance", label: "Finance" }, { id: "sales", label: "Sales" }, { id: "service", label: "Customer service" },
    { id: "operations", label: "Logistics" }, { id: "people", label: "People and HR" }, { id: "shops", label: "Online shops" },
  ],
  levels: [
    { id: "copy", label: "A copy-paste", gloss: "Two or three tools, and nothing to decide" },
    { id: "process", label: "A process", gloss: "Several tools, rules, and a person now and then" },
    // Each gloss names only what every sample at its level has (held by the test).
    { id: "pipeline", label: "A pipeline", gloss: "Many systems, AI, and people deciding the exceptions" },
  ],
  initial: { field: "finance", level: "process" },
  moves: MOVES,
  movesCaption: "The six moves",
  // A no-break space before each "·": the tag wraps only after one
  // (work-instrument.tsx fills the names unbroken).
  tag: "Sample\u00a0· {field}\u00a0· {level}",
  hand: "By hand",
  flow: "As a flow",
  absent: "Not in this one",
  person: "Left for a person",
  hard: "What makes it hard",
  // The legend's plain gloss: its proofs say "signed webhooks" (KINDS.send,
  // KINDS.retry), and a jargon word never goes unexplained (graft 11).
  gloss: "An API or a webhook is how one system hands something to another without a person.",
  proofTitle: "Which of these blocks already run here",
  ours: { does: "Runs here", thin: "Short here", none: "Built for yours" },
  kindsNote: KINDS_NOTE,
  // "Watch it run" only on a link that opens a workbench lens (it plays);
  // a jump (#breaks, the ledger's #run-notify card) lands on a still.
  watch: "Watch it run",
  see: "See it on this page",
  meters: METER_COPY,
  kinds: KINDS,
  live: "{field}, {level}: {title}. {blocks} blocks.",
  indexSummary: "All {n} samples, in words",
  foot: "Samples written for this page, for no business in particular. Not your field? Bring yours to the call.",
  samples: SAMPLES,
});

/* ---------- #breaks ---------- */

// The two addresses custom-automations.server.ts runs the delivery code
// against. Neither receives anything: example.com is reserved for
// documentation, and an IP literal inside 10.0.0.0/8 is refused by
// assertPublicHttpsUrl before any lookup, so the build needs no network.
const CRM_URL = "https://crm.example.com/hooks/calls";
const PRIVATE_URL = "https://10.0.0.8/hooks/calls";

// The workflow is a sample, but its words are the platform's: the trigger
// and step names are the dashboard's (read), the CRM line is the delivery
// code's own answer (worked out at build time), and the tag, Slack and
// skipped lines are the executor's strings (held by the test).
export const AUTO_BREAKS: BreaksData = keyed({
  eyebrow: "When it breaks",
  title: "What happens when a step fails at 3 a.m.",
  key: "at 3 a.m.",
  // The trigger stays the dashboard's own; the sub says what else the same delivery code carries.
  sub: "Pick what the CRM does when this sample workflow sends it a call’s details; on yours, it could as well be an order, an invoice or a lead. Every result below is worked out by this platform’s own delivery code when the page is built; nothing is actually sent.", // OWNER
  workflow: { // SAMPLE: a workflow written for this page
    tag: "Sample workflow",
    name: "Unhappy callers to the CRM",
    whenLabel: "When",
    trigger: T("sentiment_negative"), // "Unhappy caller"
    steps: [
      { lane: "tag", kind: "write", label: `${A("add_tag")}: “follow-up”` }, // "Tag the call: “follow-up”"
      { lane: "crm", kind: "send", label: `${A("send_webhook")} to the CRM` }, // "Send webhook to the CRM"
      { lane: "slack", kind: "send", label: `${A("notify_slack")}: #managers` }, // "Notify Slack: #managers"
    ],
  },
  optionsLabel: "What the CRM does",
  // `url` and `answers` are what custom-automations.server.ts runs; `expect`
  // is its build-time guard, so a change in the delivery code's behaviour
  // fails the build by name instead of printing a wrong row.
  scenarios: [
    { id: "ok", label: "Takes it", hint: "answers 200", url: CRM_URL, answers: [200], expect: { ok: true, attempts: 1 } },
    { id: "busy", label: "Busy, then takes it", hint: "503, then 200", url: CRM_URL, answers: [503, 200], expect: { ok: true, attempts: 2 } },
    { id: "down", label: "Down all night", hint: "503, three times", url: CRM_URL, answers: [503, 503, 503], expect: { ok: false, attempts: 3 } },
    { id: "slow", label: "Doesn’t answer", hint: "silent, three times", url: CRM_URL, answers: ["timeout"], expect: { ok: false, attempts: 3 } },
    { id: "moved", label: "Has moved", hint: "answers 404", url: CRM_URL, answers: [404], expect: { ok: false, attempts: 1 } },
    { id: "private", label: "Points inside a private network", hint: "never sent", url: PRIVATE_URL, answers: ["unsafe"], expect: { ok: false, attempts: 1 } },
  ],
  initial: "down",
  lanes: { tag: "Tag", crm: "CRM", slack: "Slack" },
  // The plain gloss for the only codes printed.
  codes: "200 means it was taken; 503, busy or down; 404, the address no longer exists.",
  wait: "waits {s} s",
  silent: "no answer in {s} s",
  refused: "refused",
  skippedMark: "Skipped",
  scale: `Drawn to scale from the code: it waits ${WAITS[0]} second, then ${WAITS[1]}, and gives each try ${TIMEOUT} seconds to answer; answers are drawn as instant. When it plays, the waits run in real time and each ${TIMEOUT}-second silence plays four times faster.`,
  tries: { one: "Tried once, at the start.", many: "Tried at {times} seconds after the start." },
  record: {
    title: "Its run history",
    // "Tag the call", "Send webhook", "Notify Slack": the rows' "1. …" names, as the dashboard prints them.
    labels: { tag: A("add_tag"), crm: A("send_webhook"), slack: A("notify_slack") },
    status: { completed: "Succeeded", failed: "Failed" }, // RunHistorySheet's words (held)
    tag: "Tag “follow-up” added to the call.", // the executor's template, filled (held)
    slack: "Message posted to Slack.", // the executor's (held)
    skipped: "Didn’t run because an earlier step failed.", // the executor's (held)
    legend: { code: "Worked out by the platform’s code", sample: "The sample’s own step" },
    // service.ts: assertPublicHttpsUrl(action.config.url) inside assertActionsAllowed.
    privateNote: "In the dashboard, an address like this is refused when the workflow is saved, before any call.",
  },
  sees: {
    label: "Who finds out",
    ours: "On ours, a failed run is recorded with its reason, the workflow’s success rate drops, and nobody is paged.",
    yours: "On yours, an alert reaches a person — by email, text or Slack — the moment a run fails.", // OWNER: the menu's third deliverable
  },
  source: { code: "In the code, for your developers", path: "lib/workflows/webhook.ts" },
  checkKinds: CHECK_KINDS,
  check: { kind: "site", label: "Send a test from the free trial", href: PRICING_TRIAL.href,
    how: `Workflows → New workflow → ${A("send_webhook")}, save it, then Send test` },
  live: "{status}. {message}",
  guardsTitle: "And the other ways it stays safe",
  guards: [
    { id: "once", title: "Once per call", body: "A workflow runs at most once for a call, even when the call’s end is reported twice." },
    { id: "budget", title: "A time limit on every run", body: `Each run gets ${word(FACTS_AUTO.runBudgetMinutes)} minutes, so its record always ends as succeeded or failed, never left running.` },
    // Isolated, not independent: three of the steps run in a chain (the morning lens).
    { id: "alone", title: "Failures stay contained", body: `Of the morning job’s ${word(FACTS.cronSteps.length)} steps, one failing never stops the others, and the job is safe to run again.` },
    { id: "twice", title: "A Stripe event done once", body: `A Stripe event that arrives again within ${FACTS_AUTO.stripeDoneHours} hours is acknowledged, not repeated.` },
  ],
  indexSummary: "All six results, in words",
});

/* ---------- #team ---------- */

// The compact credentials card: said once, with a link to the SaaS page's
// #credentials for what each one is. The objects are the SaaS module's own.
export const AUTO_TEAM: TeamData = keyed({
  eyebrow: "Who builds it",
  title: `The people who automate it hold ${ACC} Claude accreditations`,
  key: `${ACC} Claude accreditations`,
  // The card's label and caption say "Personal … from Anthropic", and the
  // grants' line says their technology runs inside: each once, not here too.
  sub: "The team that built this platform and the automations it runs on, and builds both for any business.", // OWNER
  checkKinds: CHECK_KINDS,
  accreditations: {
    label: "Personal accreditations",
    figure: ACC, // "20+"
    caption: "Claude accreditations, from Anthropic",
    // OWNER (confirmed): the accreditations cover building with Claude, and we build with it, this platform included.
    body: "Each was earned by one of the people who’d map and build your automations, for building with Claude, Anthropic’s AI. We build with it too, this platform included: where a step should read, sort or draft — an email, a scanned invoice, a call — the people building it already know how.", // OWNER
    isnt: "They’re personal, not a certification of our company.", // the page's only word on it
    check: accCheck,
  },
  grants: {
    label: "Startup grants, awarded to our company",
    names: GRANTS.map((g) => g.grantor),
    line: "Their technology runs inside this platform: where a flow should speak or listen, we already build on it.",
    isnt: "A grant isn’t an endorsement of this page, or of any build we quote.",
    check: grantCheck,
    more: { label: "What each one is, and how to see it", href: `${SAAS_ITEM.href}#credentials` },
  },
});

/* ---------- #build ---------- */

// The title is the menu's promise and the stage titles its deliverables,
// read rather than retyped, so the menu and the page can't disagree.
// Declared after AUTO_RUNNING: stage 01's check counts its lenses.
export const AUTO_BUILD: AutoBuildData = keyed({
  eyebrow: "How a build goes",
  title: ITEM.promise, // "Every copy-paste between your tools, replaced by a workflow that runs itself."
  key: "a workflow that runs itself.",
  sub: "Three stages, each ending in something you can hold and check before the next one starts.",
  labels: { stage: "Stage", hold: "You hold", ours: "On ours" },
  checkKinds: CHECK_KINDS,
  stages: [
    { id: "map", n: "01", title: ITEM.deliverables[0],
      body: "We sit with the people who do the work and write down every step: who does it, in which tool, and where it goes wrong. Then we mark what software should do, and what should stay with a person.",
      hold: "The map: every step, what it becomes, and what stays with a person.",
      check: { kind: "site", label: `See ${word(AUTO_RUNNING.lenses.length)} of ours mapped above`, href: "#running" } },
    // The gloss for "APIs and webhooks" rides the sentence that uses them.
    { id: "build", n: "02", title: ITEM.deliverables[1],
      body: "Built as code that talks to your tools through their APIs and webhooks — the ways one system hands something to another without a person — and tried on copies of your real inputs: the odd email, the scanned PDF, the order that arrives twice.",
      hold: "The automations, working on your examples, before anything goes live.", // OWNER
      ours: `Signed webhooks tried up to ${word(FACTS.webhookAttempts)} times, a check before every fiscal invoice that the payment isn’t invoiced already, and a morning job where one failing step never stops the other ${word(FACTS.cronSteps.length - 1)}.`,
      check: { kind: "site", label: "Break one above", href: "#breaks" } },
    { id: "run", n: "03", title: ITEM.deliverables[2],
      body: "It goes live with alerts that reach a person — by email, text or Slack — when a run fails or a case needs a decision, and the code is handed over with its tests and a guide to running it.", // OWNER
      hold: "Automations that are live, watched, and yours.", // OWNER
      ours: `The team texted mid-call when a caller needs someone, usage emails at ${FACTS_AUTO.usageMarks[0]}% and ${FACTS_AUTO.usageMarks[1]}%, and every workflow run recorded with its outcome.`, // "nobody is paged" is said once, in #breaks' "Who finds out"
      check: { kind: "call", label: "Ask how ours are watched" } },
  ],
  // "When you don't need us": the self-serve product, and where the line is.
  // Plans by name, read (never "paid plans"); the Google steps say "in beta".
  selfServe: {
    label: "When you don’t need us",
    body: `If you use our AI phone agent and all you need is follow-up after its calls — ${listJoin(SELF_SERVE_STEPS.map((a) => ACTION_WORDS[a]))} — you can set it up yourself in the dashboard, in ${word(INT_BUILDER.steps.length)} steps, with no build. Texts to callers start on the ${SMS_PLAN} plan, and the ${word(GOOGLE_STEPS.length)} Google steps, in beta, on ${GOOGLE_PLAN}.`, // "…start on the Starter plan, and the five Google steps, in beta, on Pro."
    link: { label: "See what you can set up yourself", href: "/product/integrations" },
  },
});

/* ---------- #terms (still) ---------- */

export const AUTO_TERMS: TermsData = keyed({
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  key: "what we say up front",
  sub: "There’s no price or date on this page: both go in the quote, because both depend on the work. Here’s what moves them.",
  columns: [
    { id: "sets", head: "What sets the price and the date", items: [
      "How many steps and tools the work passes through",
      "How messy the inputs are: forms, emails, scans or handwriting",
      "How many cases need a person’s decision",
      "Whether it runs the moment something happens, on a schedule, or both",
      "Whether the tools it touches have a way in for software",
      "What has to be reconciled, or must never happen twice",
    ] },
    { id: "need", head: "What we’ll need from you", items: [
      "Time with the people who do the work today",
      "Real examples of the inputs — emails, files, exports — with anything private taken out",
      "Access to the tools it works in, or copies to build against",
      "One person who can say what counts as done",
      "Your yes before anything goes live",
    ] },
    { id: "get", head: "What you get", items: [
      ITEM.deliverables[0], ITEM.deliverables[1], ITEM.deliverables[2],
      "The code, with its tests and a guide to running it", // OWNER
    ] },
    { id: "upfront", head: "Said up front", items: [
      "Some work shouldn’t be automated. The map says which, and why.",
      "AI reads messy input well, not perfectly: where a mistake would cost you, a person checks it.",
      "The tools it connects to bill for what they supply, on top of the build; the quote lists them.", // OWNER
      "Which accounts it runs in, and whose name they’re in, are agreed before the build starts.",
      "If a ready-made automation tool would do the job, we’ll say so on the call.",
      CAA_HANDOVER.after, // "Who makes changes after launch — your team, us, or both — is agreed when the build is quoted."
    ] },
  ],
  after: "If it’s a whole platform or a phone agent you need, the same team builds those too.", // OWNER
  links: [
    { label: "How a SaaS platform is built", href: SAAS_ITEM.href },
    { label: "How a custom phone agent is built", href: CAA_ITEM.href },
  ],
});

/* ---------- #checks ---------- */

// Built from the list so it reads true for one grantor or several.
const grantsClaim = `${GRANTORS} ${GRANTS.length === 1 ? "awarded" : "each awarded"} our company a startup grant.`;

// Twelve rows: five now in this browser, four on the call, three in your
// build (the test computes the filter counts, so a row added here only
// needs its kind). The accreditations and grants rows flip to "site" when
// a public link exists, and take that link with them.
export const AUTO_CHECKS: ChecksData = keyed({
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
    { id: "same-app", kind: "site", claim: "The automations under ‘Already running’ run on the platform you can try.",
      how: "Start the free trial: make a test call and read its write-up, or add a document and watch it become ready.", link: TRIAL_LINK },
    // What Send test really shows (TestRunDialog, ActionResultList): each step's message, attempts and time.
    { id: "words", kind: "site", claim: "Every workflow step’s result is written in plain words.",
      how: `On the trial, add a workflow with a ‘${A("send_webhook")}’ step, save it, and press Send test: each step’s result, its attempts and how long it took.`, link: TRIAL_LINK },
    { id: "breaks", kind: "site", claim: "The results under ‘When it breaks’ are the platform’s own.",
      how: "Each was worked out by its delivery code when this page was built.", link: { label: "When it breaks", href: "#breaks" } },
    { id: "self", kind: "site", claim: "Follow-up after our phone agent’s calls needs no build.",
      how: `Set one up in ${word(INT_BUILDER.steps.length)} steps in the dashboard.`, link: { label: "See what you can set up yourself", href: "/product/integrations" } },
    // "This page", as TRUST says it: the imprint is in the site footer.
    { id: "company", kind: "site", claim: "We’re an EU company, registered in Romania.",
      how: "The legal name, the CUI and the address are at the foot of this page." },
    { id: "accreditations", kind: ACCREDITATIONS.verify ? "site" : "call", claim: `Our team holds ${ACC} Claude accreditations from Anthropic.`, how: "Ask to see them.", // OWNER
      ...(ACCREDITATIONS.verify ? { link: { label: "See the accreditations", href: ACCREDITATIONS.verify.href } } : {}) },
    { id: "grants", kind: grantLink ? "site" : "call", claim: grantsClaim, how: "Ask to see them.", // OWNER
      ...(grantLink ? { link: { label: "See the grants", href: grantLink.href } } : {}) },
    // Moved to the call: a signature header isn't checkable in a browser.
    { id: "signed", kind: "call", claim: `Every delivery from a ‘${A("send_webhook")}’ step is signed.`, how: `Ask us to show you a delivery’s ${WEBHOOK_HEADERS.signature} header.` },
    // "About this platform": the accreditations' count is the owner's, not the code's.
    { id: "counts", kind: "call", claim: "Every figure about this platform is counted from its code.", how: "By a test that fails if a figure stops being true. Ask us to run it." },
    { id: "map", kind: "handover", claim: "You get a map before anything is built.", how: `It’s what stage 01 delivers. ${cap(word(AUTO_RUNNING.lenses.length))} of ours are drawn above.`, link: { label: "How a build goes", href: "#build" } },
    { id: "alerts", kind: "handover", claim: "Failures reach a person.", how: "It’s what stage 03 delivers: alerts by email, text or Slack, tried on your build before it goes live." }, // OWNER
    { id: "code", kind: "handover", claim: "The code is handed over.", how: "The code, its tests and a guide to running it are yours at the end of the build." }, // OWNER
  ],
  // The card that closes the ledger looks forward, to the reader's own
  // build: #build's three stages, each checked as it lands.
  missing: {
    label: "How you check yours",
    body: "Yours starts with a call. Then come the three stages above, each one yours to check as it lands: the map of your manual steps, the automations working on your examples, and alerts that reach a person, with the code handed over.", // OWNER
    cta: CALL,
  },
});

/* ---------- #faq ---------- */

export const AUTO_FAQ: FaqData = keyed({
  eyebrow: "Questions",
  title: "What people ask before a build",
  key: "before a build",
  keyTone: "quiet",
  talk: CALL,
  phone: COMPANY.phone,
  items: [
    { id: "what", q: "What can you automate?", // OWNER
      a: "Any repeated work that moves information between people and tools: emails into systems, documents into data, orders into invoices, a CRM kept in step with everything around it, reports that build themselves, and the checks and reminders in between. If the steps can be described and the information is somewhere software can reach, we can automate it, and we’ll say on the call which parts should stay with a person." }, // OWNER
    // The doubt the page itself raises, and the name behind it, second
    // (the name is guarded above). Also served alone as FAQPage data.
    { id: "calls", q: "Your name says ‘Voice’. Do you only automate calls?",
      a: `No. We automate work for any business — a law firm, a dental practice, a courier firm, a restaurant group, a letting agency, a charity — in the tools it already uses. ${COMPANY.name} is also the name of our own product, a platform for AI phone agents, so some of the automations it runs are about calls; they’re on this page because they’re ours to take apart, not because they’re all we build. Even here, three of the four under ‘Already running’ start the way work does in any business: with a payment, the time of day or a new document.` }, // OWNER
    // Also served alone as FAQPage data, so it names what runs here in full.
    { id: "complex", q: "How complex can it get?",
      a: `As complex as the work is. The automations this platform runs on write up phone calls with AI, check before every fiscal invoice that the payment isn’t invoiced already, and run ${word(FACTS.cronSteps.length)} steps every morning, ${word(FACTS_AUTO.billingChain)} of them in a set order; one failing never stops the others. Pipelines across many systems, with schedules, retries, AI that reads documents and people who decide the exceptions, are the work we do.` },
    { id: "cost", q: "What does it cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on the work: how many steps and tools it passes through, how messy the inputs are, and how many cases need a person. We won’t put a number here that we’d have to walk back. The map comes first, so you’ll know what gets automated before anything is built." },
    { id: "breaks", q: "What happens when something breaks?",
      a: "We build it to fail safely. A step that fails is tried again where a retry can help; if it still fails, the steps after it don’t run, so nothing acts on a failed result. What must never happen twice is checked first — on this platform, whether a call’s workflows have already run, and whether a payment already has its fiscal invoice — and a webhook that’s tried again carries the same reference, so the system receiving it can ignore the repeat. Every run is recorded, and every failure with its reason. On yours, an alert also reaches a person. ‘When it breaks’ on this page shows the platform’s own delivery code at work." }, // OWNER (alerts on yours)
    { id: "tool", q: "Why not a ready-made automation tool?",
      a: "We build when the work outgrows one: when it has to read messy input, reconcile figures, run exactly once, handle a long chain of exceptions, or stay in your own accounts and code. When a ready-made tool would do the job, we’ll say so on the call, and where one is the right piece, we build on it." },
    { id: "ai", q: "Does it need AI in it?",
      a: "Only where it helps. Most automation is moving information reliably. Where a step has to make sense of messy input, like a scanned document, a free-text email or a phone call, AI does it, and where a mistake would cost you, a person checks it. The people who’d build it hold the Claude accreditations above." },
    { id: "own", q: "Who owns it?", // OWNER
      a: "You do. At handover the code is yours, with its tests and a guide to running it. Which accounts it runs in, and whose name they’re in, are agreed with you before the build starts." }, // OWNER
    { id: "tools", q: "Can you work with the tools we already use?",
      a: "Yes: most tools have a way in for software, an export, or an inbox it can read. Where one has none, we’ll tell you on the call what the options are." },
    { id: "existing", q: "We already have automations that keep breaking. Can you take them on?",
      a: "Yes. Tell us about them on the call, then show us how they’re built, and we’ll say plainly whether we’d fix them or rebuild them, and why." }, // OWNER
    // Each copy of a call where the SaaS page puts it, read from its FAQ (REGION above).
    { id: "data", q: "Where would our data live?",
      a: `Only where the work needs it to go, chosen with you before anything is built. ${REGION}`,
      where: { label: "Read the privacy policy", href: "/privacy" } },
  ],
});

/* ---------- #start, then the credits ---------- */

// The deep panel's colour zones were measured on SAAS_START's copy, so the
// title, key and body stay at or under its lengths (45, 25, 203; the test holds it).
export const AUTO_START: StartData = keyed({
  eyebrow: "Start",
  title: "Bring any work nobody should do by hand", // OWNER: "any work". 39 ≤ 45
  key: "nobody should do by hand", // 24 ≤ 25
  body: "A build starts with a phone call, not a form. Tell us the work, the tools it touches and where it goes wrong. We’ll tell you what we’d automate first, what stays with a person, and what it would take.", // 200 ≤ 203
  primary: CALL,
  secondary: { label: "Try the platform we built", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · Quoted after the call, never on the page`,
});

/** Every third-party mark the page prints, apart from Anthropic, Claude and Google (their own lines). */
export const AUTO_TRADEMARKS = ["Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Slack", "Twilio", "Vercel"] as const;

export const AUTO_CREDITS: CreditsData = {
  title: "About this page",
  items: [
    { term: "The automations on this page", detail: "Neuro Tech Voice’s own, built by the team this page describes. They’re shown because they’re ours to take apart, not because calls are all we automate. The drawings are made from its code; they’re drawings, not a live feed." }, // OWNER
    { term: "The figures", detail: "Every figure about the platform is counted from its repository by the site’s own tests." },
    { term: "When it breaks", detail: "Every result is worked out when the page is built, by the platform’s own delivery code, against two addresses that receive nothing: one at example.com and one inside a private network. Nothing is sent. The tag and Slack lines are the platform’s own words for those steps succeeding." },
    { term: "The samples", detail: "The fields, moves and flows under ‘Your kind of work’, and the workflow under ‘When it breaks’, were written for this page, for no business in particular." },
    { term: "Accreditations and grants", detail: `The accreditations are held by people on the team; the grants were awarded to the company by ${GRANTORS}. Both are shown on the call, on request.` }, // OWNER
    { term: "What isn’t here", detail: "No client names, logos, testimonials, prices, dates or time-saved figures appear on this page." },
    { term: "Anthropic and Claude", detail: "Anthropic and Claude are trademarks of Anthropic, PBC. Naming them is not an endorsement by Anthropic of this page or of any build." },
    { term: "Other names on this page", detail: `${listJoin(AUTO_TRADEMARKS)} are trademarks of their respective owners. We build on them; none of them endorses this page or any build we quote.` },
    // Its own line, naming the Google marks this page prints: Google on its
    // own ("the five Google steps"), Sheets on a plate, and Gmail, Calendar,
    // Docs and Drive in the ledger's index (the test collects them from the copy).
    { term: "Google", detail: "Google, Gmail, Google Sheets, Google Calendar, Google Docs and Google Drive are trademarks of Google LLC. Neuro Tech Voice works with them and is not endorsed by Google." },
  ],
};
