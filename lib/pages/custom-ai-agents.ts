import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/custom-ai-agents — every word on the page.
 *
 * Facts are read, never retyped, wherever the source is safe to read:
 *   · menu label from SOLUTION_ITEMS (throws if the item goes missing);
 *   · the Enterprise plan from ENTERPRISE; the trial from PRICING_TRIAL;
 *   · the language count from LANG_COUNT; keyterm limits and which
 *     languages take a list from lib/voice/languages.ts;
 *   · the transfer line from TRANSFER_ANNOUNCE; the disclosure check from
 *     mentionsAiDisclosure (the sample greeting must pass or the build fails);
 *   · the test-call cap from TEST_CALL_MAX_SECONDS; the signature header
 *     from WEBHOOK_HEADERS; trademark lines from lib/pages/integrations.ts.
 * Retyped with a keep-in-step note: WEBHOOK_ATTEMPTS (lib/workflows/
 * webhook.ts is server-only and pulls node:crypto and the SSRF guard).
 *
 * This module is server-only. Client instruments receive their slice as
 * plain props from the server page and import TYPES only, so nothing here
 * — including call-protocol's supplier labels — reaches the browser.
 *
 * Quillmoor Heating is a made-up firm (checked: no firm of that name
 * turned up). Every call, number (+1 555 01xx) and host (example.com) is
 * a labelled sample. No price, date, statistic, client or logo appears.
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true.
 * ------------------------------------------------------------------ */
import { AUTH, COMPANY, ENTERPRISE, PRICING_TRIAL, SOLUTION_ITEMS } from "@/lib/site";
import { LANG_COUNT } from "@/lib/pages/ai-agents";
import { INT_ACTIONS, INT_GOOGLE } from "@/lib/pages/integrations";
import { AGENT_LANGUAGES } from "@/lib/agent-languages";
import { KEYTERM_MAX_COUNT, KEYTERM_MAX_TOTAL_CHARS, sttConfigFor } from "@/lib/voice/languages";
import { TRANSFER_ANNOUNCE, localized, mentionsAiDisclosure } from "@/lib/voice/greetings";
import { TEST_CALL_MAX_SECONDS } from "@/lib/audio/call-protocol";
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload";
import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";
import type { VoiceToolName } from "@/lib/voice/contracts";
import type { FaqData, StartData } from "@/components/site/product/closing";

// The plan Google Calendar bookings start on, read off the entitlements the
// routes enforce, so the self-serve card and the FAQ can never promise a
// calendar on a plan that can't connect one (the trial can't today).
const CALENDAR_PLAN = PLANS[requiredPlanFor("googleIntegrations")].name;

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
if (!ITEM) throw new Error("SOLUTION_ITEMS lost custom-ai-agents");

/** Keep in step with WEBHOOK_MAX_ATTEMPTS in lib/workflows/webhook.ts. */
const WEBHOOK_ATTEMPTS = 3;
const TEST_CALL_MINUTES = TEST_CALL_MAX_SECONDS / 60; // 3 today
const MINUTES_WORD: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
const testMinutes = MINUTES_WORD[TEST_CALL_MINUTES] ?? String(TEST_CALL_MINUTES);

// A language "takes a list" when the recogniser it routes to keeps a probe
// term; asking the pipeline itself means a language moved between models
// moves between the two halves of the Names footnote on its own.
const KEYTERM_LANGS = AGENT_LANGUAGES.filter((l) => sttConfigFor(l.value, ["x"]).keyterms.length > 0).map((l) => l.label);
const OTHER_LANGS = AGENT_LANGUAGES.length - KEYTERM_LANGS.length;
const listJoin = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];

export const SAMPLE = { firm: "Quillmoor Heating", tag: "Quillmoor Heating · a made-up firm" } as const;

// The hero promises the platform puts the AI sentence back if a greeting
// leaves it out; the sample greeting on the page must already carry it, by
// the platform's own test, with the firm's name taken out of the probe.
const GREETING = "Quillmoor Heating, good morning — you’re through to the office’s AI assistant. Who’s calling?";
if (!mentionsAiDisclosure(GREETING, SAMPLE.firm)) throw new Error("sample greeting must disclose");

// The landlord test call quotes the line the voice pipeline really speaks
// before a transfer. If the template stops taking a name, the row would read
// "{name}" or lose Dan, so fail here instead.
const TRANSFER_LINE = localized(TRANSFER_ANNOUNCE, "en", { name: "Dan" });
if (!TRANSFER_LINE.includes("Dan")) throw new Error("TRANSFER_ANNOUNCE no longer names the contact");

/* ---------- shared types ---------- */

export type Link = { label: string; href: string };
export type Turn = { who: "caller" | "agent"; text: string };
export type Seg = { op: "keep" | "ins" | "del"; text: string };
export type Status = "held" | "rewritten" | "brief" | "document";
/** Keep in step with CaaClaim in components/site/solutions/custom-ai-agents/proved.ts
 *  (duplicated on purpose: this module is server-only, the store is client). */
export type CaaClaim = "sheet" | "redline" | "names" | "wiring" | "rehearsal";
export const STATUS_LABEL = { held: "Held", rewritten: "Rewritten", brief: "Changed the brief", document: "Changed a document" } as const;
export const SPEAKERS = { caller: "Caller", agent: "Agent" } as const;

/* ---------- meta ---------- */

export const CAA_META = {
  title: "Custom AI Agents — built on how your phone is answered",
  description:
    "We write your call flows with your team, connect the agent to your systems where they can take it, and test it on real phone calls before a customer hears it. Every build is quoted on a call.",
} as const;

/* ---------- hero ---------- */

export type SheetLine = {
  id: "greet" | "plan" | "book" | "price" | "dan" | "sort" | "night";
  n: number; // 1–7, the sheet's own order
  written: string; // the owner's shorthand
  node: string; // the node label in the flow
  kind: "step" | "fork" | "rule" | "handoff";
  tools: readonly VoiceToolName[];
  gate?: VoiceToolName; // tool whose <Gate> is shown in the caption
  became: string; // caption body
  quote?: string; // line 1: the sample greeting, shown in cinema italic
  under?: { label: string; body: string }; // line 4: the platform guardrail beneath
};

// H2: a sample caller traced through the sheet. Every route is one the
// page already states (hero lines 3, 5, 7; Redline Draft 3; Rehearsal
// "landlord" and "service"), so the trace follows the sheet as written and
// invents no behaviour. `rings` are the nodes that ring, in order — the
// bead may pass others on the spine without ringing them; `prong` is the
// index into CAA_HERO.prongs a booking ends on; `ends` becomes `sel`.
export type TraceCaller = {
  id: "plan" | "noplan" | "landlord" | "night";
  label: string;
  rings: readonly SheetLine["id"][];
  prong?: 0 | 1;
  ends: SheetLine["id"];
  outcome: string;
};

export const CAA_HERO = {
  eyebrow: ITEM.label, // "Custom AI Agents"
  kicker: "Every business has a sheet by the phone.",
  title: "Your phone script, built into an agent that follows it",
  sub: "We sit down with the people who answer your phone and write down what they actually do: the questions they ask first, the rules they never break, the calls they pass to someone else. Then we set it up as a voice agent, connect it to what it needs to reach, and ring it until it holds — before a customer hears it.",
  primary: { label: "Call us about a build", href: COMPANY.phoneHref },
  secondary: { label: "Try the platform free", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  sheet: { title: "The sheet by the phone", firm: SAMPLE.tag },
  flowTitle: "What it became",
  legend: { step: "A step", rule: "A rule it keeps all call", handoff: "A hand-off" },
  became: "Line {n} became", // fill({n})
  noTools: "No tool: it’s in the brief",
  railLabel: "Throughout: never prices a repair",
  prongs: ["Saturday · plan", "Weekday · no plan"],
  pickHint: "Pick any line to see what it became.",
  groupLabel: "Lines on the sheet", // aria-label of the button group
  lines: [
    {
      id: "greet", n: 1, written: "Quillmoor Heating, good morning — who’s calling?", node: "Greets", kind: "step", tools: [],
      became: "Its first words, as yours are — plus the one sentence nobody can take out: that it’s an AI assistant. If a greeting leaves that out, the platform adds it back.",
      quote: GREETING,
    },
    {
      id: "plan", n: 2, written: "Ask: on a service plan? (plan no. on renewal letter)", node: "Asks for the plan number", kind: "step", tools: ["save_lead_details"],
      became: "A question it asks before it offers any time, written down with the call.",
    },
    {
      id: "book", n: 3, written: "Plan = Saturdays OK. No plan = weekdays only", node: "Books", kind: "fork", tools: ["check_availability", "book_appointment"], gate: "book_appointment",
      became: "A fork in the diary: Saturday for plan customers, the first weekday slot for everyone else.",
    },
    {
      id: "price", n: 4, written: "NEVER price a repair on the phone. Dan quotes after the visit", node: "Never prices a repair", kind: "rule", tools: [],
      became: "A rule it keeps for the whole call, however it’s asked: no repair prices — a visit, and Dan’s quote after it.",
      under: {
        label: "Underneath, on every agent · ours",
        body: "Every agent carries a standing rule: don’t invent a price, a policy or an opening hour. Yours sits on top; the platform’s rule outranks any brief.",
      },
    },
    {
      id: "dan", n: 5, written: "Landlords & letting agents → Dan, always", node: "Put through to Dan", kind: "handoff", tools: ["transfer_call"],
      became: "A hand-off. Landlords are put through to Dan, and his number comes from your saved contacts, never from the conversation.",
    },
    {
      id: "sort", n: 6, written: "Noisy boiler ≠ breakdown. Breakdown = no heat or no hot water", node: "Sorts breakdown from service", kind: "step", tools: [],
      became: "A definition it sorts by first: no heat or no hot water is a breakdown; a noisy boiler is a service visit.",
    },
    {
      // No-break space: "8" must never sit alone on the last line of the sheet
      // (it did at every desktop width), here or in the Portrait list.
      id: "night", n: 7, written: "After 6: take a message, we ring back from\u00a08", node: "Message for the morning", kind: "handoff", tools: ["take_message"],
      became: "Outside your hours, a message for the morning instead of a booking.",
    },
  ] satisfies readonly SheetLine[],
  portraitOrder: ["greet", "plan", "sort", "book", "dan", "night"] as const, // "price" is the rail
  settleOn: 2, // index of line 3
  // H2 copy, verbatim from the addendum §10.1. Flagged for owner sign-off.
  trace: {
    label: "Ring a sample caller through it",
    note: "Traced on the sample sheet · not a live call",
    groupAria: "Sample callers",
    callers: [
      { id: "plan", label: "Plan customer", rings: ["greet", "plan", "sort", "book"], prong: 0, ends: "book",
        outcome: "Plan number first, then the diary — Saturdays are open to them." },
      { id: "noplan", label: "No plan", rings: ["greet", "plan", "sort", "book"], prong: 1, ends: "book",
        outcome: "No plan number, so the first weekday slot." },
      { id: "landlord", label: "A landlord", rings: ["greet", "dan"], ends: "dan",
        outcome: `Straight to Dan: “${TRANSFER_LINE}”` },
      { id: "night", label: "Rings after 6", rings: ["greet", "night"], ends: "night",
        outcome: "After 6 it takes a message; the office rings back from 8." },
    ] satisfies readonly TraceCaller[],
  },
} as const;

/* ---------- band ---------- */

export const CAA_BAND = {
  id: "band-kicker",
  kicker: "Every pin is a decision somebody at your desk already makes. We set them with you, one at a time.",
} as const;

/* ---------- redline ---------- */

export type Draft = { n: string; sub: string; segs: readonly Seg[]; from: string; turns: readonly Turn[]; verdict: string; status: Status };
const OPENING: Turn = { who: "caller", text: "Have you got anything Saturday? The boiler’s making a right racket." };

export const CAA_REDLINE = {
  eyebrow: "Written with your team",
  title: "The rules nobody wrote down, written until they hold",
  body: "Your office knows plan customers get Saturdays and nobody else does. It’s never been written down, because it never had to be. An agent needs it written — and the first way a rule like that gets written often isn’t the way it holds. So we write it with you, ring it, and write it again.",
  railLabel: "Drafts of the rule",
  detentAria: "Draft {i} of {n}", // fill
  labels: { rule: "The rule, in the brief", test: "Test call · the same caller each time", verdict: "What the test call showed" },
  drafts: [
    {
      n: "Draft 1", sub: "As said",
      segs: [{ op: "keep", text: "Plan customers get Saturdays." }],
      from: "Said by the owner on the scoping call.",
      turns: [OPENING, { who: "agent", text: "I have — Saturday at 9:30 or 11:00. Which suits you?" }],
      verdict: "It offered a Saturday without asking about a plan.", status: "rewritten",
    },
    {
      n: "Draft 2", sub: "As written",
      segs: [
        { op: "del", text: "Plan customers get Saturdays." },
        { op: "ins", text: " Only offer Saturday appointments to callers on a service plan. Ask whether they’re on one before offering times." },
      ],
      from: "Written up by us from that.",
      turns: [
        OPENING,
        { who: "agent", text: "Are you on one of our service plans?" },
        { who: "caller", text: "I think so? My landlord sorted it." },
        { who: "agent", text: "Lovely — Saturday at 9:30, then." },
      ],
      verdict: "It asked, then took “I think so” for a yes.", status: "rewritten",
    },
    {
      n: "Draft 3", sub: "As rung",
      segs: [
        { op: "keep", text: "Only offer Saturday appointments to callers on a service plan." },
        { op: "del", text: " Ask whether they’re on one before offering times." },
        { op: "ins", text: " Ask for the plan number on their renewal letter before offering times. With a number, offer Saturday and write the number down so the office can check it. Without one, offer the first weekday slot, or take a message for the office to confirm the plan." },
      ],
      from: "Rewritten after draft 2’s test call.",
      turns: [
        OPENING,
        { who: "agent", text: "Saturdays are kept for service-plan customers. Have you got your renewal letter to hand? The plan number’s at the top." },
        { who: "caller", text: "Not on me, no." },
        { who: "agent", text: "No problem. The first weekday slot is Monday at 8:00 — or I can take a message, and the office will ring you once they’ve checked your plan." },
      ],
      verdict: "It kept Saturday for the plan, and didn’t leave the caller stuck.", status: "held",
    },
  ] satisfies readonly Draft[],
  foot: `A made-up rule for ${SAMPLE.firm}, a made-up firm. This one took three drafts; plenty take one. What doesn’t change is that each draft is rung, not argued about.`,
} as const;

/* ---------- names (keyterms) ---------- */

export type Term = { id: string; term: string; kind: "Firm" | "Street" | "Code" | "Word" | "Person" | "Place"; misheard?: string };
export type SaidPart = { text: string } | { term: string /* Term.id */ };

export const CAA_NAMES = {
  eyebrow: "Heard right",
  title: "It listens for your names, because they’re on its list",
  body: `Speech recognition is good at ordinary words and guesses at proper ones: your street names, your plan codes, your people. So a build includes a list of the words your callers say and a dictionary doesn’t. We put it together with your team — up to ${KEYTERM_MAX_COUNT} terms — and every one gets said out loud in testing.`,
  labels: {
    said: "What the caller said", without: "Written down without the list", with: "Written down with it",
    list: "The list · sample", clear: "Clear the list", restore: "Put the list back", groupAria: "Terms on the list",
  },
  meter: "{n} of {max} terms · {chars} of {maxChars} characters", // fill; max/maxChars from below
  limits: { max: KEYTERM_MAX_COUNT, maxChars: KEYTERM_MAX_TOTAL_CHARS },
  terms: [
    { id: "firm", term: "Quillmoor", kind: "Firm", misheard: "quill more" },
    { id: "combi", term: "combi", kind: "Word", misheard: "calm bee" },
    { id: "street", term: "Wrenfield Close", kind: "Street", misheard: "Renfield clothes" },
    { id: "code", term: "QM", kind: "Code", misheard: "cue em" },
    { id: "mira", term: "Mira", kind: "Person", misheard: "Myra" },
    { id: "lpg", term: "LPG", kind: "Word" },
    { id: "flush", term: "powerflush", kind: "Word" },
    { id: "village", term: "Harbrook", kind: "Place" },
  ] satisfies readonly Term[],
  // One sentence, split. Rendered three ways (said / without / with).
  said: [
    { text: "Hi, is that " }, { term: "firm" }, { text: "? It’s the " }, { term: "combi" }, { text: " at 9 " }, { term: "street" },
    { text: " — plan " }, { term: "code" }, { text: "-20417. " }, { term: "mira" }, { text: " said Dan could come out." },
  ] satisfies readonly SaidPart[],
  // Order the autoplay switches the five heard terms on:
  walk: ["firm", "combi", "street", "code", "mira"],
  foot: `Illustrative: the kind of mishearing a list prevents, not a recording. A term on the list is expected, not guaranteed. The list is used for agents speaking ${listJoin(KEYTERM_LANGS)}; in the other ${COUNT_WORD[OTHER_LANGS] ?? OTHER_LANGS} languages the recogniser doesn’t take one, so it reads names back and waits for a yes instead.`,
} as const;

/* ---------- wiring ---------- */

export type SystemId = "calendar" | "crm" | "helpdesk" | "team";
export type CallEvent = { id: string; at: string /* "0:31" */; tool: VoiceToolName; effect: string; systems: readonly SystemId[] };
export type AfterEnd = { id: string; kind: "platform" | "built"; mark?: "send_webhook" | "notify_slack"; to: string; effect: string; systems: readonly SystemId[] };
export type System = { id: SystemId; chip: string; when: string; how: string; gate?: VoiceToolName };
export type PayloadRow = { key: string; value?: string; depth: 0 | 1 | 2 };

export const CAA_WIRING = {
  eyebrow: "Wired to your systems",
  title: "What it reaches during the call, what only after, and what we’d build for you",
  body: "While the caller is on the line, the platform reaches your Google Calendar, texts the caller, warns your team and puts calls through. After the hang-up, a workflow takes it on: a Slack post, an email, a row in Google Sheets — or a signed delivery of the call to any other system. The end that receives that delivery is work we do on the build — a small receiver written for your system, or a Zapier, Make or n8n scenario set up for you.",
  legend: { solid: "Solid — on the platform today", dotted: "Dotted — built for you, as part of the build" },
  // The playback clause is motion-only: with reduced motion nothing plays,
  // so the still header (and the spoken list's name) must not claim it.
  header: "Sample call · 2:14",
  headerMotion: " · played back in 6 seconds",
  tag: SAMPLE.tag,
  lanes: { during: "During the call", after: "After the hang-up", hungUp: "Hung up · 2:14", trigger: "When the call ends" },
  events: [
    { id: "ctx", at: "0:02", tool: "get_call_context", effect: "Thursday, 10:12, and the number calling", systems: [] },
    { id: "plan", at: "0:31", tool: "save_lead_details", effect: "Plan number QM-20417, written down", systems: ["crm"] },
    { id: "free", at: "0:44", tool: "check_availability", effect: "Thursday 8:30 is free · Google Calendar", systems: ["calendar"] },
    { id: "book", at: "0:58", tool: "book_appointment", effect: "Booked · Thu 8:30 · texted", systems: ["calendar"] },
    { id: "text", at: "1:06", tool: "send_sms", effect: "What to have ready, texted to them", systems: [] },
    { id: "team", at: "1:12", tool: "notify_team", effect: "Mira texted: a plan to check before Thursday", systems: ["team"] },
  ] satisfies readonly CallEvent[],
  delivery: { mark: "send_webhook", label: "Signed delivery", sub: `https only · tried up to ${WEBHOOK_ATTEMPTS} times` },
  after: [
    { id: "crm", kind: "built", to: "crm.example.com", effect: "Your CRM · the receiving end", systems: ["crm"] },
    { id: "desk", kind: "built", to: "helpdesk.example.com", effect: "Your helpdesk · becomes a ticket once the receiving end is built", systems: ["helpdesk"] },
    { id: "slack", kind: "platform", mark: "notify_slack", to: "#office", effect: "Every call’s summary", systems: ["team"] },
  ] satisfies readonly AfterEnd[],
  written: {
    from: "plan", label: "Plan check in your system", badge: "Built for you · scoped on the call",
    sub: "Not on the platform today. Code we’d write if your system has an API — we’ll tell you on the call whether it can be done, and it’s quoted on its own.",
  },
  planCheck: {
    label: "When should the plan be checked?",
    options: [
      { id: "during", label: "While they’re on the line", note: "Dotted: a connection we’d build, if your system allows it. The caller hears the answer before they hang up." },
      { id: "after", label: "After the call", note: "Solid: the plan number arrives with the call’s details and the office checks it. Nothing extra to build — but the caller has hung up by then." },
    ],
    initial: "during",
  },
  systemsLabel: "Which of your systems",
  systems: [
    {
      id: "calendar", chip: "Your calendar", when: "During the call",
      how: "It checks your Google Calendar is free, then checks again the instant before it writes, so two callers can’t take the same slot. Google Calendar is the only calendar it books into today — if yours is another, say so on the call.",
      gate: "book_appointment",
    },
    {
      id: "crm", chip: "Your CRM", when: "After the call — or during it, if we build it",
      how: "When the call ends, a signed delivery carries its details: the number, the summary, the outcome and the answers to your questions. It doesn’t carry the transcript. We build the end that receives it for your CRM — directly, or through Zapier, Make or n8n.",
    },
    {
      id: "helpdesk", chip: "Your helpdesk", when: "After the call",
      how: "The same delivery can become a ticket once the end that receives it is built for your helpdesk. A workflow can also fire on a word you choose — “complaint”, say — so those are the calls that go.",
    },
    {
      id: "team", chip: "Your team", when: "During the call, and after",
      how: "During: a text or email to the right person while the caller is still on the line, or a transfer to them. After: every call’s summary in a Slack channel.",
    },
  ] satisfies readonly System[],
  settleOn: "crm" as SystemId,
  payload: {
    label: `Sample payload, trimmed · signed with ${WEBHOOK_HEADERS.signature}`,
    rows: [
      { key: "event", value: "workflow_triggered", depth: 0 },
      { key: "trigger", value: "call_ended", depth: 0 },
      { key: "call", depth: 0 },
      { key: "caller_number", value: "+15555550142", depth: 1 },
      { key: "duration_seconds", value: "134", depth: 1 },
      { key: "outcome", value: "booked", depth: 1 },
      { key: "summary", value: "Plan customer, noisy boiler, booked Thursday 8:30.", depth: 1 },
      { key: "extracted", depth: 1 },
      { key: "plan_number", value: "QM-20417", depth: 2 },
    ] satisfies readonly PayloadRow[],
    foot: `Sent after the call by a workflow: signed, tried up to ${WEBHOOK_ATTEMPTS} times, https only. It carries the call’s details and summary, not the transcript.`,
  },
  replay: "Play the call again",
  scrub: "Scrub the call", // W1 rail aria-label (never shown). Flagged for owner sign-off.
  foot: `A made-up call for ${SAMPLE.firm}, a made-up firm.`,
  trademarks: [INT_ACTIONS.trademarks, INT_GOOGLE.trademarks],
  live: "{at} · {tool} · {effect}", // sr-only announcer template (fill)
} as const;

/* ---------- rehearsal ---------- */

export type TestRow = {
  id: string;
  scenario: string;
  secs: number;
  status: Status;
  turns: readonly Turn[];
  tools?: readonly VoiceToolName[];
  change?: { segs: readonly Seg[]; note?: string };
  again?: { secs: number; turns: readonly Turn[] };
  link?: Link;
};

export const CAA_REHEARSAL = {
  eyebrow: "Tested before launch",
  title: "It takes real calls before it takes your customers’",
  body: "We write a test sheet with your team: the regulars, the awkward ones, the one you’re dreading. The agent rings one of you from its own number, down the same route live calls take, and you play the caller. Every test call is transcribed. We read them with you, change what needs changing, and ring again.",
  tag: SAMPLE.tag,
  summary: "On this sample sheet: {calls} test calls, and {changes} changes they caused — both rung again before launch.", // fill; calls=rows.length, changes=rows with again (as words: "six", "two")
  badge: "Test · not billed",
  cap: `of ${TEST_CALL_MINUTES}:00`,
  // The bar's ratio is secs / capSeconds: a number the client can divide
  // by without importing call-protocol (and its supplier labels) itself.
  capSeconds: TEST_CALL_MAX_SECONDS,
  rerung: "Rung again",
  excerpt: "Transcript excerpt · test call",
  changed: "What changed",
  firstCall: "First call",
  tools: "Tools it used",
  listAria: "Test calls on the sheet",
  rows: [
    {
      id: "service", scenario: "A plan customer wants a service", secs: 84, status: "held",
      turns: [
        { who: "caller", text: "It’s due its annual service — plan QM-20417." },
        { who: "agent", text: "Thanks. I’ve got Thursday at 8:30am or Friday at 1pm. Which suits you?" },
      ],
      tools: ["save_lead_details", "check_availability"],
    },
    {
      id: "fast", scenario: "Gives the plan number fast, on a bad line", secs: 48, status: "brief",
      turns: [
        { who: "caller", text: "Plan’s QM-20417." },
        { who: "agent", text: "Thanks — QM-20471. And what’s the problem today?" },
      ],
      change: { segs: [{ op: "ins", text: "Read the plan number back, a character at a time, before writing it down." }] },
      again: {
        secs: 55,
        turns: [
          { who: "agent", text: "That’s Q, M, 2, 0, 4, 1, 7 — have I got that right?" },
          { who: "caller", text: "Yes, that’s it." },
        ],
      },
    },
    {
      id: "price", scenario: "Asks what the repair will cost", secs: 57, status: "held",
      turns: [
        { who: "caller", text: "Roughly what’s a new pump going to set me back?" },
        { who: "agent", text: "I can’t price a repair over the phone — it depends on what Dan finds. I can book him in to look, and he’ll quote before doing any work." },
      ],
    },
    {
      id: "landlord", scenario: "A landlord ringing for a tenant", secs: 41, status: "held",
      turns: [
        { who: "caller", text: "I’m the landlord at 14 Mill Road — my tenant says there’s no heating." },
        { who: "agent", text: TRANSFER_LINE },
      ],
      tools: ["transfer_call"],
    },
    {
      id: "oil", scenario: "Asks if we work on oil boilers", secs: 69, status: "document",
      turns: [
        { who: "caller", text: "Do you do oil boilers? We’re out past Harbrook." },
        { who: "agent", text: "I’m not sure. I can take a message and someone will ring you back." },
      ],
      change: { segs: [], note: "The answer was on page 3 of an old price list. We added a one-page document: the boilers we work on, and the ones we don’t." },
      again: { secs: 52, turns: [{ who: "agent", text: "We work on gas and LPG boilers, but not oil, I’m afraid." }] },
      link: { label: "How it answers from documents", href: "/product/knowledge-base" },
    },
    {
      id: "night", scenario: "Rings at 10:40pm, no heating", secs: 36, status: "held",
      turns: [
        { who: "caller", text: "Is anyone there? The heating’s gone off." },
        { who: "agent", text: "The office is closed until 8 tomorrow. No heat counts as a breakdown, so I’ll take an urgent message and text the engineer on call now." },
      ],
      tools: ["take_message", "notify_team"],
    },
  ] satisfies readonly TestRow[],
  settleOn: 1, // row "fast"
  foot: `A sample test sheet from a made-up build. On a real one the scenarios come from your calls, and there are as many as they need. Test calls stop at ${testMinutes} minutes, are marked as tests in your call log, and aren’t billed.`,
} as const;

/* ---------- handover (still) ---------- */

export const CAA_HANDOVER = {
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  body: "There’s no price or date on this page. Both depend on what your calls need, so both go in the quote.",
  columns: [
    {
      head: "What we’ll need from you",
      items: [
        "A conversation with whoever answers your phone now: how the calls really go, and what they always say",
        "The sheet by your phone, or whatever you’d hand a new starter",
        "Three or four calls you remember — the awkward ones",
        "The systems a call should reach, and whether they have an API",
        "Your own test calls, and a yes before it answers a customer",
      ],
    },
    {
      head: "What you get",
      items: [
        "A brief written with your team, kept in the dashboard where it can be read and changed",
        "Your documents set up, so it answers from them",
        "A list of the names and codes it should expect",
        "Hours, booking rules, contacts and hand-offs",
        "Workflows to your systems, and the end that receives them",
        "The test sheet, with every test call’s transcript",
      ],
    },
    {
      head: "Said up front",
      items: [
        "It answers the phone. A chat version would be a separate build, scoped on its own.",
        "It gets its own local number, alongside your current line. Porting a number in isn’t supported yet.",
        "It books into Google Calendar. Another calendar is a question for the call.",
        "Documents are refreshed by hand. It doesn’t learn from calls by itself.",
        "It always says it’s an AI assistant, and that line can’t be removed.",
        "The build is quoted on its own. The plans still have no setup fee.",
      ],
    },
  ],
  after: "Who makes changes after launch — your team, us, or both — is agreed when the build is quoted.",
  links: [
    { label: "See the plans", href: "/#pricing" },
    { label: "See everything the agent does", href: "/product/ai-agents" },
  ],
} as const;

/* ---------- receipt ---------- */

export const CAA_RECEIPT = {
  eyebrow: "What you just watched",
  title: "Five claims. You operated the ones that are filled in.",
  rows: [
    { id: "sheet", href: "#top", said: "Your sheet became steps, rules and hand-offs you can point at" },
    { id: "redline", href: "#redline", said: "Rules are written with you, and rung until they hold" },
    { id: "names", href: "#names", said: "It’s given the names your callers say, and you can see why" },
    { id: "wiring", href: "#wiring", said: "You can see what reaches your systems during the call, what only after, and what we’d build" },
    { id: "rehearsal", href: "#rehearsal", said: "It takes real calls before it takes a customer’s" },
  ] satisfies readonly { id: CaaClaim; href: string; said: string }[],
  proved: "Proved",
  tryIt: "Try it",
  missing: {
    label: "The one we did not demonstrate",
    body: "That it fits your business. Everything above was a heating firm we made up, with a sheet we wrote. The only way to see yours is to bring the one by your phone to a call.",
    cta: { label: "Call us about a build", href: COMPANY.phoneHref },
  },
  selfServe: {
    label: "When you don’t need us",
    body: `If your calls are bookings into Google Calendar, answers from your documents and messages for your team, the self-serve setup does all of it. The trial is free; bookings into Google Calendar start on the ${CALENDAR_PLAN} plan.`,
    link: { label: "Set it up yourself", href: AUTH.signup },
  },
} as const;

/* ---------- FAQ ---------- */

// Read off the price list so the answer can never quote a plan that moved;
// lower-cased because they sit mid-sentence ("…: a written SLA, and a
// named contact").
const unlocks = ENTERPRISE.unlocks.map((u) => u.charAt(0).toLowerCase() + u.slice(1));

export const CAA_FAQ = {
  eyebrow: "Questions",
  title: "About custom builds",
  items: [
    {
      id: "same", q: "Is this a different product from the one I can sign up for?",
      a: "No. It’s the same agent on the same platform, set up by us instead of by you. What a build adds is the work: the writing, the setup, the testing, and — where your systems need it — the end that receives each call. Anything the finished agent does, the platform does.",
    },
    {
      id: "trained", q: "Is it trained on our data?",
      a: "No — no agent on our platform is. It’s briefed: written instructions, your own documents to answer from, and a list of words to expect. That’s why a change means editing a line, not retraining anything. It doesn’t learn from calls by itself.",
    },
    {
      id: "crm", q: "Which CRMs and helpdesks does it work with?",
      a: "None natively, and we’d rather say so. After every call, a workflow can send a signed delivery of the call’s details — the number, summary, outcome and the answers to your questions — and we build the end that receives it for your system, directly or through Zapier, Make or n8n. During the call it does what the platform does today: your Google Calendar, texts, messages, alerts and transfers. A lookup in your own system while the caller waits is separate engineering: if your system has an API, we’ll tell you on the call whether it can be done, and quote it on its own.",
    },
    {
      id: "chat", q: "Can you build a chat agent too?",
      a: "Not as part of this. The platform answers phone calls; there’s no chat widget in it. If you need chat, say so on the call and we’ll tell you honestly whether a separate build is worth it.",
    },
    {
      id: "cost", q: "What does a build cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on how much writing, testing and connection work your calls need. We won’t put a number here that we’d have to walk back. What’s quoted is our time: the plans still have no setup fee, and connecting the platform’s own integrations still costs nothing.",
    },
    {
      id: "custom-plan", q: "Is a build the same as the Enterprise plan?",
      a: `No. The Enterprise plan is a subscription for high volumes, priced with you on a call: ${unlocks.join(", and ")}. A build is the work of setting an agent up with you, and it’s quoted separately. It runs on whichever plan covers what your calls need — bookings into Google Calendar start on ${CALENDAR_PLAN}.`,
    },
    {
      id: "number", q: "Will it keep my number?",
      a: "It gets its own local business number, bought from the dashboard and billed monthly on its own, alongside your current line. Porting an existing number in isn’t supported yet, and mobile and toll-free numbers aren’t offered.",
    },
    {
      id: "calendar", q: "Does it work with a calendar other than Google?",
      a: "Not today. It books into Google Calendar during the call, with a fresh check before every booking. If your diary lives somewhere else, tell us on the call and we’ll say plainly whether a connection can be built for it.",
    },
    {
      id: "wrong", q: "What happens when it gets something wrong after launch?",
      a: "Every call is transcribed and summarised, and a workflow can flag the ones worth reading: an unhappy caller, or a word you choose. The fix is a change to the brief or a document, then a test call to check it. Those are settings in the dashboard; who makes them after launch is agreed when the build is quoted.",
    },
    {
      id: "ai", q: "Does it tell callers it’s an AI?",
      a: "Always. Its greeting says so, and if a custom greeting leaves that out, the platform adds it back. A build can change every other line, but not that one.",
    },
    {
      id: "data", q: "Where is our data kept?",
      a: "We’re an EU company, based in Romania. We keep transcripts and call summaries in eu-west-1 (Ireland). We don’t copy call recordings there: each stays with the provider that captured it, and ElevenLabs or Cartesia can keep their own copy of a call they handled. Twilio and ElevenLabs keep theirs in the United States; we haven’t confirmed Cartesia’s country. Some of our infrastructure and subprocessors are outside the European Economic Area, including in the United States; those transfers are covered by safeguards such as Standard Contractual Clauses, and the privacy policy says how. Calls are encrypted in transit, your records are kept apart from other customers’ with row-level security, card numbers are never stored, and a data processing agreement is available on request.",
    },
  ],
  privacy: { label: "Read the privacy policy", href: "/privacy" },
} as const satisfies FaqData;

/* ---------- start ---------- */

export const CAA_START = {
  eyebrow: "Start",
  title: "Bring the sheet by your phone",
  body: "A build starts with a phone call, not a form. Tell us how your phone is answered today and what it needs to reach. We’ll tell you what we’d build, what we wouldn’t, and what it would take.",
  primary: { label: "Call us about a build", href: COMPANY.phoneHref },
  secondary: { label: "Try the platform first", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · The agent answers phone calls, in ${LANG_COUNT} languages`,
  more: { label: "See everything the agent does", href: "/product/ai-agents" },
} as const satisfies StartData;
