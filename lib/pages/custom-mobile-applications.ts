import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/custom-mobile-applications — every word on the page.
 *
 * The page's argument is that we design, build and publish iOS and
 * Android apps of any kind, for any business, and that the half of an
 * app a buyer never sees — sign-in, an API, a database, payments, files,
 * a live connection, jobs that run themselves, emails and texts — already
 * runs here, on this platform, our own, for AI phone agents: the proof,
 * never the limit. The repository holds no app of ours in a store, so the
 * page claims none (PUBLISHED_APPS, below). It shows a sample app to
 * hold, the server side counted from the code, and the path through both
 * stores with the stores' own rules beside it.
 *
 * Read, never retyped, where the source is safe to read: SOLUTION_ITEMS
 * (this item, and the SaaS, Automations and agent items for links),
 * COMPANY, AUTH, PRICING_TRIAL, SOLUTIONS_MENU; the SaaS module's FACTS,
 * ACCREDITATIONS, GRANTS, CHECK_KINDS, listJoin, its FAQ's region
 * sentences and two of its checks rows (by id); FACTS_AUTO.emails;
 * CAA_HANDOVER.after; DELETION_ORDER (the account deletion's steps);
 * SMS_LANGUAGES, and the booking reminder itself, rendered by the
 * platform's own pure builder when this module is evaluated.
 *
 * Retyped in FACTS_MOB, each held by lib/pages/custom-mobile-applications.test.ts
 * to its constant or to its source text: constants that live in route
 * files or aren't exported (the fresh sign-in window, the browser token's
 * life, the day-old upload cut-off), and a count read off source (the
 * booking texts).
 *
 * Four line marks, which the test reads this file's source for:
 * - `// OWNER`: rests on the owner's word — every promise about the
 *   reader's build, and every technology named;
 * - `// SAMPLE`: written for the page — no business, no brand, no digit;
 * - `// STORE <url>`: a store rule whose words were checked on the store's
 *   own page (the quoted ones verbatim);
 * - `// STORE-SUMMARY <url>`: a store rule summarised from a page this
 *   sandbox couldn't read. Never `quote: true`, and re-read before
 *   shipping.
 *
 * This module is server-only. Client islands receive their slice as plain
 * props from the server page and import TYPES only, so nothing here — nor
 * the SaaS module's csp.ts graph it reads through — reaches the browser.
 *
 * No price, date, client, logo, testimonial, rating, download count or
 * badge appears. The accreditations are personal and the grants are the
 * company's; neither is a certification, and #team says so once.
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true. The module
 * evaluates top to bottom, so PARTS, STEPS, GATES and SAMPLES are declared
 * before the section consts that hold them, and publishedCopy runs last.
 * ------------------------------------------------------------------ */
import { AUTH, COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { sentences } from "@/lib/pages/home/source";
import {
  ACCREDITATIONS, CHECK_KINDS, FACTS, GRANTS, SAAS_CHECKS, SAAS_FAQ, listJoin,
  type Check, type CheckKind, type CheckRow, type ChecksData, type CreditsData, type FaqData, type FaqItem,
  type HeroData, type Link, type StartData, type TermsData,
} from "@/lib/pages/custom-saas-platforms";
import { FACTS_AUTO, type TeamData } from "@/lib/pages/custom-automations";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { DELETION_ORDER } from "@/lib/account/deletion-plan"; // pure: the order and failure policy only
import { SMS_LANGUAGES, bookingReminderSms, formatSmsDateTime } from "@/lib/sms/templates"; // pure, client-safe

/* ---------- guards ---------- */

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-mobile-applications");
if (!ITEM) throw new Error("SOLUTION_ITEMS lost custom-mobile-applications");
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms");
if (!SAAS_ITEM) throw new Error("custom-mobile-applications: SOLUTION_ITEMS lost custom-saas-platforms");
const AUTO_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations");
if (!AUTO_ITEM) throw new Error("custom-mobile-applications: SOLUTION_ITEMS lost custom-automations");
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
if (!CAA_ITEM) throw new Error("custom-mobile-applications: SOLUTION_ITEMS lost custom-ai-agents");
// The FAQ's first question quotes "Voice" from the company's name: a new name must be re-read there.
if (!/\bVoice\b/.test(COMPANY.name)) throw new Error("custom-mobile-applications: the company name lost “Voice”; re-read MOB_FAQ’s “breadth” row");
// The hero's plates are this page's own layers, not the stack's (a "Push"
// plate would say push runs here), and the copy names iOS, Android, push
// and payments in its own words: re-read it if the menu's stack changes.
if (ITEM.stack.join("|") !== "iOS|Android|Push|Payments") throw new Error("custom-mobile-applications: ITEM.stack changed; the page names iOS, Android, push and payments in its own words");
// The three stages and "What you get" are the menu's three deliverables, one each, in order.
if (ITEM.deliverables.length !== 3) throw new Error("custom-mobile-applications: ITEM.deliverables changed shape; re-read the three stages and “What you get”");
// "Billing stopped first", in stage 03 and the delete gate: the plan's own order.
if (DELETION_ORDER[0] !== "cancel_subscriptions" || DELETION_ORDER.at(-1) !== "delete_auth_user")
  throw new Error("custom-mobile-applications: the account deletion’s order changed; re-read “billing stops first” in stage 03 and the delete gate");
// The jobs and files parts name the reminder step and the day-old uploads.
for (const step of ["booking_reminders", "purge_orphan_uploads"] as const) {
  if (!FACTS.cronSteps.includes(step)) throw new Error(`custom-mobile-applications: the daily job lost "${step}"; re-read the jobs and files parts`);
}

/* ---------- facts ---------- */

/**
 * Retyped, because their modules are route files or don't export them.
 * Each is held by lib/pages/custom-mobile-applications.test.ts, to the
 * constant or to its source text. All exact: none prints with a "+".
 */
export const FACTS_MOB = {
  reauthMinutes: 30, // = REAUTH_WINDOW_MS / 60 000 (app/api/account/route.ts)
  liveTokenSeconds: 60, // = BROWSER_TOKEN_TTL_SECONDS (app/api/voice/test-session/route.ts)
  bookingTexts: 5, // `export function …Sms(input: BookingSmsInput)` in lib/sms/templates.ts
  orphanHours: 24, // = ORPHAN_MIN_AGE_MS / 3 600 000 (app/api/cron/storage-cleanup.ts): "day-old"
} as const;

/* ---------- helpers ---------- */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/**
 * An identifier held whole: a word joiner (U+2060) after each hyphen, so
 * the browser never breaks "D-U-N-S" or "eu-west-1" after one ("eu- /
 * west-1"). It draws nothing and is not read aloud; the glyphs stay the
 * ASCII hyphen, so the words read as the stores and the host print them.
 */
const whole = (id: string) => id.replaceAll("-", "-\u2060");
const DUNS = whole("D-U-N-S");
const EU_WEST = whole("eu-west-1");
// Every title's coloured phrase (HomeHeading `titleKey`) must be copied
// from the title itself, and never be its first word.
const keyed = <T extends { title: string; key: string }>(s: T): T => {
  if (s.title.lastIndexOf(s.key) <= 0) throw new Error(`custom-mobile-applications: "${s.key}" is not in "${s.title}"`);
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
// The region sentences, read from the SaaS FAQ as Automations reads them,
// so the three pages can't disagree about where a copy of a call is.
const SAAS_DATA = SAAS_FAQ.items.find((i) => i.id === "data");
if (!SAAS_DATA) throw new Error("custom-mobile-applications: SAAS_FAQ lost its data answer");
const REGION_SAID = sentences(SAAS_DATA.a, 1, 5); // throws if that answer is reshaped
// The database part names the region too: the two must agree.
if (!REGION_SAID.includes("eu-west-1 (Ireland)")) throw new Error("custom-mobile-applications: the SaaS FAQ no longer puts the database in eu-west-1 (Ireland); re-read PARTS.data");
// This page's copy only, held whole; the SaaS module is untouched.
const REGION = REGION_SAID.replaceAll("eu-west-1", EU_WEST);
/** A SaaS checks row, by id, never by position: the same object, never retyped. */
const saasRow = (id: string): CheckRow => {
  const row = SAAS_CHECKS.rows.find((r) => r.id === id);
  if (!row) throw new Error(`custom-mobile-applications: SAAS_CHECKS lost "${id}"`);
  return row;
};

/** The sample app's name everywhere it is printed: in the device, the permission dialog, the notifications, the text. */
const SAMPLE_NAME = "Your app"; // SAMPLE

/* The reminder, word for word: the platform's own booking reminder,
   rendered by its own pure builder, with the time cut out. The instant is
   fixed and never printed; only the text around it is, so a change to the
   template's words reaches the page at the next build, and a change to
   its shape fails it. */
const AT = new Date(Date.UTC(2031, 0, 6, 9, 30));
const WHEN = formatSmsDateTime(AT, "UTC", "en");
const FULL = bookingReminderSms({ language: "en", businessName: SAMPLE_NAME, startsAt: AT, timezone: "UTC", service: null });
const CUT = WHEN ? FULL.split(WHEN) : [];
if (CUT.length !== 2 || CUT.some((half) => /\d/.test(half)))
  throw new Error("custom-mobile-applications: the booking reminder no longer cuts around its time; re-read MOB_HOLD.reminder");
export const REMINDER_TEXT = { before: CUT[0], after: CUT[1] } as const;
// before: "Reminder from Your app: your appointment is on "
// after:  ". Need to change it? Just call us. Reply STOP to opt out."

/* The stores' own pages. The Apple ones and developer.android.com were
   read on the day the copy was written; support.google.com could not be
   reached, so every line resting on it is a labelled summary. */
const APPLE_REVIEW = "https://developer.apple.com/app-store/review/guidelines/"; // STORE https://developer.apple.com/app-store/review/guidelines/
const APPLE_ENROL = "https://developer.apple.com/help/account/membership/program-enrollment/"; // STORE https://developer.apple.com/help/account/membership/program-enrollment/
const TESTFLIGHT: Link = { label: "TestFlight on iOS", href: "https://developer.apple.com/testflight/" }; // STORE https://developer.apple.com/testflight/
const PLAY_BILLING = "https://developer.android.com/google/play/billing"; // STORE https://developer.android.com/google/play/billing
const PLAY_TESTING: Link = { label: "Google Play’s testing tracks on Android", href: "https://support.google.com/googleplay/android-developer/answer/9845334" }; // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/9845334
const PLAY_DELETE = "https://support.google.com/googleplay/android-developer/answer/13327111"; // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/13327111
const PLAY_DATA_SAFETY = "https://support.google.com/googleplay/android-developer/answer/10787469"; // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/10787469
const PLAY_ACCESS = "https://support.google.com/googleplay/android-developer/answer/15748846"; // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/15748846 — confirm it is the “App access” page before shipping
const PLAY_DUNS = "https://support.google.com/googleplay/android-developer/answer/13628312"; // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/13628312

/* ---------- section ids and shared types ---------- */

export const SECTION_IDS = ["top", "hold", "kinds", "path", "server", "team", "terms", "checks", "faq", "start"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export type { Check, CheckKind, CheckRow, ChecksData, CreditsData, FaqData, FaqItem, HeroData, Link, StartData, TeamData, TermsData };

/* The parts an app talks to: #hold's drawing, #kinds' list, #server's cards */
export type PartId = "signin" | "api" | "data" | "payments" | "files" | "live" | "jobs" | "messages" | "push";
/** Whether this platform runs that part today: "Runs here" | "Built for yours". */
export type PartKind = "does" | "none";
export type Part = {
  id: PartId;
  label: string; // ≤ 16: the drawing's card, the md lane, the sm chip, #kinds' row
  datum: string; // ≤ 16, mono
  kind: PartKind;
  title: string; // ≤ 28: #server's card heading
  forApp: string; // ≤ 140: what any app needs of it
  ours: string; // ≤ 300: what this platform's does (push: "Not on ours: …")
  files: readonly string[]; // repo paths, in #server's index only; every one exists
  check: Check;
};
/** What the drawing, the lane, the chips and #kinds' rows print of a part. */
export type PartFace = Pick<Part, "id" | "label" | "datum" | "kind">;

/* #hold */
export type Platform = "ios" | "android";
export type StepId = "signin" | "choose" | "pay" | "booked" | "reminder";
export type ScreenId = "signin" | "choose" | "pay" | "booked" | "lock";
export type Answer = "allow" | "deny";
/** An edge of the drawing (parts-geometry.ts EDGES): `${from}-${to}`, "phone" being the app itself. */
export type EdgeId =
  | "phone-signin" | "phone-api" | "phone-payments" | "live-phone" | "push-phone" | "messages-phone"
  | "signin-data" | "api-data" | "payments-api" | "data-live" | "jobs-data" | "jobs-push" | "jobs-messages" | "data-files";
export type Step = {
  id: StepId; n: "01" | "02" | "03" | "04" | "05";
  label: string; // ≤ 9: the step rail, the live region
  screen: ScreenId;
  caption: string; // 60–100 characters
  hops: readonly EdgeId[]; // in travel order
  ring?: readonly PartId[]; // pinged, not travelled to
  deny?: { caption: string; hops: readonly EdgeId[] }; // step 5 only: the reader said Don't allow
};
/** A hotspot's visible label, and its accessible name: the label, then " — " and where it goes. */
export type Cta = { label: string; aria: string };
export type SampleApp = {
  name: string;
  tabs: readonly [string, string, string]; active: 0 | 1 | 2; // drawn, aria-hidden
  signin: { title: string; email: string; password: string; forgot: string; go: Cta };
  choose: { title: string; parts: readonly [string, string, string]; free: string; go: Cta };
  pay: { title: string; booking: string; deposit: string; card: string; go: Cta; back: Record<Platform, Cta> };
  booked: {
    title: string; body: string; calendar: string;
    ask: { ios: { title: string; allow: string; deny: string }; android: { title: string; allow: string; deny: string } };
    allowAria: string; denyAria: string;
  };
  lock: { title: string; push: { app: string; when: string; text: string }; sms: { app: string; when: string }; open: string };
};
export type RouteId = "native" | "shared" | "yours";
export type RoutesCopy = { title: string; lead: string; items: readonly { id: RouteId; label: string; tools: string; body: string }[]; foot: string };
export type HoldData = {
  eyebrow: string; title: string; key: string; sub: string;
  tag: string; partsTag: string; phone: string;
  platformLabel: string; platforms: readonly { id: Platform; label: string }[];
  notes: Record<Platform, string>;
  transport: { play: string; pause: string; replay: string };
  hint: string; restart: string; stepsLabel: string; stepOf: string; talks: string; full: Link;
  kinds: Record<PartKind, string>;
  live: string; liveSwitch: string;
  indexSummary: string; indexReminder: string; foot: string;
  app: SampleApp; reminder: { before: string; after: string };
  steps: readonly Step[]; parts: readonly PartFace[];
  routes: RoutesCopy;
  initial: { platform: Platform; step: StepId; answer: Answer };
};

/* #kinds */
export type KindId = "bookings" | "shops" | "delivery" | "health" | "learning" | "money";
export type SideId = "customers" | "staff";
export type FeatureId = "camera" | "scan" | "location" | "background" | "push" | "offline" | "biometric"
  | "wallet" | "purchase" | "calendar" | "files" | "live";
/** "Needs it" | "Often". */
export type Need = "core" | "often";
/** The mini phones' drawing vocabulary (sketch.tsx). */
export type SketchBlock = "search" | "list" | "grid" | "card" | "map" | "calendar" | "field" | "button" | "pay"
  | "chat" | "chart" | "camera" | "code" | "sign" | "media" | "notice" | "ring" | "check";
export type MiniScreen = { name: string; blocks: readonly [SketchBlock] | readonly [SketchBlock, SketchBlock] }; // name ≤ 18
export type PhoneNeed = { id: FeatureId; need: Need; why: string }; // why ≤ 56
export type Sample = {
  id: `${KindId}-${SideId}`; kind: KindId; side: SideId;
  title: string; // ≤ 50
  who: string; // ≤ 60
  screens: readonly [MiniScreen, MiniScreen, MiniScreen, MiniScreen, MiniScreen];
  phone: readonly [PhoneNeed, PhoneNeed, PhoneNeed, PhoneNeed];
  parts: readonly PartId[]; // always includes signin, api, data
  ai: string; // ≤ 80
  hard: string; // ≤ 130
  rule: GateId;
};
export type KindsData = {
  eyebrow: string; title: string; key: string; sub: string;
  kindsLabel: string; sideLabel: string;
  kinds: readonly { id: KindId; label: string }[]; sides: readonly { id: SideId; label: string }[];
  initial: { kind: KindId; side: SideId };
  tag: string; screensLabel: string; phoneTitle: string; serverTitle: string;
  needs: Record<Need, string>; ours: Record<PartKind, string>; absent: string;
  aiLabel: string; hardLabel: string; ruleLabel: string;
  full: Link; live: string; indexSummary: string; foot: string;
  features: readonly { id: FeatureId; label: string }[];
  parts: readonly PartFace[];
  gates: readonly { id: GateId; title: string }[];
  samples: readonly Sample[];
};

/* #path */
export type StationId = "prototype" | "design" | "build" | "beta" | "review" | "live" | "updates";
export type Station = {
  id: StationId; n: "01" | "02" | "03" | "04" | "05" | "06" | "07";
  label: string; // ≤ 10: the figure (lg+)
  long: string; // ≤ 34: the list (below lg; the screen reader's at every width)
  lanes?: Record<Platform, string>; // ≤ 14 each: the stations that fork
  at: number; // 0–1: the station's x on the figure
};
export type GateMark = { id: "yes" | "testers" | "review"; label: string; after: StationId; at: number };
export type PathStage = { id: "design" | "build" | "publish"; n: "01" | "02" | "03"; title: string; body: string; hold: string; ours?: string; published?: string; check: Check };
export type GateId = "delete" | "payments" | "review" | "website" | "privacy" | "signin";
/** `text` never carries quotation marks: a quote's are the component's (a <blockquote cite>), a summary is a <p> tagged "Summarised". */
export type StoreLine = { store: "Apple" | "Google Play"; quote: boolean; text: string; ref: string; href: string };
export type GateRow = { id: GateId; title: string; apple: StoreLine; google: StoreLine | null; side: { kind: "ours" | "yours"; text: string; link?: Link } };
export type Whose = "yours" | "handed" | "agreed";
export type OwnRow = { id: string; what: string; whose: Whose; how: string; quote?: true; link?: Link };
export type PublishedBlock = { title: string; apps: readonly { name: string; what: string; links: readonly Link[] }[] };
export type PathData = {
  eyebrow: string; title: string; key: string; sub: string;
  labels: { stage: string; hold: string; ours: string; published: string };
  checkKinds: Record<CheckKind, string>;
  path: { title: string; lanes: Record<Platform, string>; gateWord: string; stations: readonly Station[]; gates: readonly GateMark[]; beta: { text: string; links: readonly Link[] } };
  stages: readonly PathStage[];
  gates: { title: string; sub: string; labels: { quote: string; summary: string; ours: string; yours: string }; rows: readonly GateRow[] };
  own: { title: string; sub: string; head: { what: string; whose: string; how: string }; states: Record<Whose, string>; rows: readonly OwnRow[] };
  published?: PublishedBlock; // only when PUBLISHED_APPS is set
};

/* #server */
export type ServerData = {
  eyebrow: string; title: string; key: string; sub: string;
  tag: string; bus: string;
  labels: { forApp: string; ours: string; code: string };
  kinds: Record<PartKind, string>;
  checkKinds: Record<CheckKind, string>;
  parts: readonly Part[];
  indexSummary: string; foot: string;
};

/* The owner switch */
export type PublishedApp = { name: string; what: string; appStore: Link | null; googlePlay: Link | null };
/** The sections whose words change when PUBLISHED_APPS is set (publishedCopy). */
export type MobBase = { hero: HeroData; path: PathData; checks: ChecksData; faq: FaqData; credits: CreditsData };

/* Fixed up front for the device (G2) and the stage (G3): a hotspot pressed, and the view-transition move it makes */
export type GoId = "signin.go" | "choose.go" | "pay.go" | "pay.back" | "booked.allow" | "booked.deny" | "lock.open";
export type Move = "mob-forward" | "mob-back" | "mob-sheet-up" | "mob-sheet-down" | "mob-lock" | "mob-unlock" | "mob-platform";

/* ---------- meta ---------- */

// The layout's template adds " — Neuro Tech Voice", so the title carries no
// dash of its own. The description leads with the owner's claim and both
// credentials, near 155 characters so a search result doesn't cut them.
// Both go to openGraph and twitter too (metadata merges shallowly).
export const MOB_META = {
  title: `${ITEM.label}, for any business`, // OWNER. "Custom Mobile Applications, for any business"
  description: `iOS and Android apps of any kind, for any business. Our team holds ${ACC} Claude accreditations from Anthropic; ${GRANTORS} gave us ${GRANTS.length === 1 ? "a startup grant" : "startup grants"}.`, // OWNER
} as const;

/* ---------- #top: hero ---------- */

const HERO: HeroData = keyed({
  eyebrow: ITEM.label, // "Custom Mobile Applications"
  // "the" is held to "half" (a no-break space), so the violet phrase never
  // leaves it alone at the end of a line on a phone.
  title: "Any app, for iOS and Android. We already run the\u00a0half you don’t see.", // OWNER
  key: "the\u00a0half you don’t see.",
  // The menu's description first (read), then breadth, the process, why the
  // proof is a phone-agent platform (it's ours to open up), and both
  // credentials, all before the plates.
  sub: `${ITEM.description} For your customers or your own team, in any field and however complex, we build yours: first a prototype you tap through on your own phone, then the app for both platforms, in whatever technology the product calls for, published to both stores under your name. The half you don’t see — sign-in, payments, messages and live connections — already runs every day on this platform, our own product for AI phone agents. Our team holds ${ACC} personal Claude accreditations from Anthropic, and our company holds startup grants from ${GRANTORS}.`, // OWNER
  primary: CALL,
  secondary: { label: "Tap through the sample", href: "#hold" },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  // What we build, said as capability (kinds of app and of business, never
  // a list of past work), between the room and the evidence. Voice is one
  // line of twelve; every line ≤ 50 characters (three columns at 768).
  range: {
    label: "What we build",
    lead: "Any app your business needs, for your customers or your own team. Not just phone agents.", // OWNER
    groups: [
      { head: "For your customers", items: ["Booking, loyalty and membership apps", "Shops, marketplaces and delivery", "Apps for patients, students and members", "Money apps: payments, points, wallets"] }, // OWNER
      { head: "For your own team", items: ["Field-service and inspection apps", "Delivery-driver and warehouse apps", "Staff schedules, time sheets and shifts", "Internal tools, in everyone’s pocket"] }, // OWNER
      { head: "With AI or live features", items: ["Assistants that answer inside the app", "Photos and documents read by AI", "Live chat, maps and tracking", "Voice and calls, as on this platform"] }, // OWNER
    ],
    fields: "In any field: retail, hospitality, healthcare, education, finance, logistics, construction, fitness, real estate — or one this list doesn’t name.", // OWNER
  },
  room: {
    tag: "What an app talks to, running here",
    // Four plates (saas.css §4 staggers --i 0–3). These are this page's own
    // layers, not ITEM.stack's: a "Push" plate would say push runs here, and
    // it doesn't. Datums ≤ 20 characters, so each sits on its label's line
    // from 360px (the SaaS plate rule), and every figure is read or held.
    plates: [
      { layer: "Sign-in", name: "Accounts, checked on the server", runs: "Email and password or Google, a reset link by email, and an account deleted from settings", datum: "email · Google" },
      { layer: "API", name: "The requests an app sends", runs: "From accounts and payments to live calls; systems calling in prove who they are with a signature or a secret", datum: `${FACTS.routeHandlers}+ API routes` }, // "80+ API routes"
      { layer: "Payments", name: "Stripe and SmartBill", runs: "Checkout, a customer portal, and fiscal invoices, each issued only after a check for one on record", datum: `${FACTS.stripeEvents} Stripe event types` }, // "7 Stripe event types"
      // Each figure beside what it counts, as the Automations page's plate prints it: the platform sends
      // more emails and texts than these (team alerts, callers' messages), so neither stands as a total.
      { layer: "Messages", name: "Emails and texts nobody sends by hand", runs: `Emails as things happen, and ${word(FACTS_MOB.bookingTexts)} kinds of booking text in ${SMS_LANGUAGES.length} languages, each reminder sent once`, datum: `${FACTS_AUTO.emails} account emails` }, // "8 account emails"
    ],
    foot: "Counted from the repository by the site’s own tests. A plus means at least.",
    link: { label: "See what it talks to", href: "#hold" },
    flow: { pause: "Pause background motion", play: "Play background motion" },
  },
  proofLabel: "The evidence on this page",
  proof: [
    { label: "Running here", term: "The half you don’t see", detail: "The server side an app needs, running today; every figure counted from the code.", href: "#server" },
    { label: "Accreditations", term: `${ACC} Claude accreditations`, detail: "From Anthropic, each earned by someone on our team.", href: "#team" },
    { label: "Startup grants", term: GRANTORS, detail: "Awarded to our company. Their technology runs inside this platform.", href: "#team" }, // publishedCopy() swaps this one
  ],
});

/* ---------- the nine parts: #hold's drawing, #kinds' list, #server's cards ---------- */

// One list for all three sections, so a part can't be called two names.
// Labels and datums ≤ 16 characters (the drawing's 148 × 64u cards), and
// every figure is interpolated from FACTS, FACTS_AUTO, FACTS_MOB or a read
// source. Each `files` path exists (the test holds it); they print in
// #server's index only. Push is the one part this platform lacks: its
// `ours` says so, and it is the page's one caveat about it.
export const PARTS: readonly Part[] = [
  { id: "signin", label: "Sign-in", datum: "email · Google", kind: "does", title: "Sign-in and accounts",
    forApp: "Who someone is, checked on the server whenever the app asks for anything: signing up, signing in, a forgotten password, a deleted account.",
    // lib/auth/actions.ts; throttle.ts "per client IP and per account identifier"; REAUTH_WINDOW_MS.
    ours: "Email and password with a confirmation email, or a Google account; a reset link by email; sign-in attempts limited per network and per account; and an account deleted from settings after a fresh sign-in.",
    files: ["lib/auth/actions.ts", "lib/auth/throttle.ts", "app/auth/callback/route.ts", "app/api/account/route.ts"],
    check: { kind: "site", label: "Sign up on the free trial", href: AUTH.signup } },
  // Callers proving who they are: Twilio's signature (lib/twilio/signature.ts, read by every
  // telephony route), Stripe's (webhook/route.ts) and the daily job's bearer secret (requireCronRequest).
  { id: "api", label: "API", datum: `${FACTS.routeHandlers}+ routes`, kind: "does", title: "The API",
    forApp: "Everything the app reads or changes goes through it, and it answers only what that person may see.",
    ours: `${FACTS.routeHandlers}+ API routes, from accounts and payments to live calls. Each request is checked on the server for who is asking, and systems calling in — the phone network, the payment provider, the daily job — prove who they are with a signature or a secret.`,
    files: ["app/api", "proxy.ts", "lib/api/auth.ts"],
    check: { kind: "call", label: "Ask to see the route list" } }, // OWNER: that we show it on request
  { id: "data", label: "Database", datum: `${FACTS.migrations} migrations`, kind: "does", title: "The database",
    forApp: "What the app keeps — accounts, bookings, orders — with each customer’s records walled off from everyone else’s.",
    // `enable row level security` in the migrations (the test greps for it).
    ours: `Postgres on Supabase in ${EU_WEST} (Ireland). Row-level security walls off each business’s rows, and every change to its shape is one of ${FACTS.migrations} migrations kept in the repository.`,
    files: ["supabase/migrations"],
    check: { kind: "call", label: "Ask us to open the migrations" } }, // OWNER: that we show them on request
  // webhook/route.ts: constructEvent over the raw body. emit.ts's "Idempotency guard" reads, then
  // issues, and a read that errors counts as no row (and an unconfigured SmartBill, a zero amount or
  // an unknown organisation issue nothing), so the copy says what is checked, never one per payment.
  { id: "payments", label: "Payments", datum: `${FACTS.stripeEvents} Stripe events`, kind: "does", title: "Payments",
    forApp: "Takes the money and tells the server it arrived, so nothing is confirmed on the phone’s word.",
    ours: `Stripe Checkout and a customer portal, a signed webhook that keeps plans in step on ${word(FACTS.stripeEvents)} kinds of event, and SmartBill fiscal invoices, each issued only after a check for one on record. Card numbers never reach our servers.`,
    files: ["app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts", "app/api/billing/webhook/route.ts", "lib/smartbill/emit.ts"],
    check: { kind: "site", label: "Choose a plan on the free trial", how: "The card form opens on Stripe’s own address.", href: PRICING_TRIAL.href } },
  // upload-url/route.ts: "a one-time signed upload URL", "The bucket itself
  // enforces the 10 MB limit and the allowed types" (no MB figure printed);
  // ORPHAN_MIN_AGE_MS: "day-old".
  { id: "files", label: "Files", datum: "signed uploads", kind: "does", title: "Photos and files",
    forApp: "Photos, scans and documents people add, sent straight to storage and kept only while something uses them.",
    ours: "Uploads go straight to storage through a one-time signed link, never through the app’s server; storage itself checks each file’s size and type, and the daily job removes day-old uploads that nothing uses.",
    files: ["app/api/agent/knowledge/upload-url/route.ts", "app/api/voices/_lib/storage.ts", "app/api/cron/storage-cleanup.ts"],
    check: { kind: "site", label: "Add a document on the free trial", href: PRICING_TRIAL.href } },
  // fly.toml: auto_stop_machines = false, min_machines_running = 1; the
  // browser socket's "signed token, checked before upgrade"; resume.ts
  // handles 'interrupted' (a phone call, Siri, a locked screen) and asks
  // for a tap when it can't resume; useCallsChanged.ts subscribes the
  // dashboard to `postgres_changes` on calls (#hold's step 2, data → live).
  { id: "live", label: "Live connection", datum: "always on", kind: "does", title: "A live connection",
    forApp: "For whatever changes while you watch: a chat, a driver on a map, times filling up, a call.",
    ours: `An always-on service on Node.js ${FACTS.nodeMajor} holds each live call open; a browser joins with a signed token that expires in ${FACTS_MOB.liveTokenSeconds} seconds, and the dashboard updates as calls change. On an iPhone, the test call picks its sound back up after a phone call, Siri or a locked screen interrupts it, or asks for a tap.`,
    files: ["services/voice-gateway/src/server.ts", "services/voice-gateway/fly.toml", "app/api/voice/test-session/route.ts", "lib/audio/resume.ts", "hooks/useCallsChanged.ts"],
    check: { kind: "site", label: "Make a test call on the free trial", href: PRICING_TRIAL.href } },
  // reminders.ts: claimed (reminder_sent_at set) before its text goes out, and released if the text fails.
  { id: "jobs", label: "Daily jobs", datum: FACTS.cronAt, kind: "does", title: "Jobs that run themselves",
    forApp: "The work nobody taps for: reminders, renewals, clean-ups and reports.",
    ours: `One job every morning at ${FACTS.cronAt}, ${word(FACTS.cronSteps.length)} steps that each run on their own. Its reminder step claims each booking before texting it, so two runs can’t send one twice, and a text that fails frees it to try again.`,
    files: ["vercel.json", "app/api/cron/daily/route.ts", "lib/scheduling/reminders.ts"],
    check: { kind: "call", label: "Ask to see a morning’s run" } }, // OWNER: that we show one on request
  { id: "messages", label: "Emails and texts", datum: "email · text", kind: "does", title: "Emails and texts",
    forApp: "What the app sends when it isn’t open: receipts, confirmations, reminders and warnings.",
    // The sample's finished frame shows the push drawn for the page; the real text shows once notifications are off.
    // Twilio carries the texts only (lib/twilio/sms.ts); the emails go through Resend (lib/email/client.ts), unnamed here.
    ours: `${cap(word(FACTS_AUTO.emails))} account emails, from a welcome to a receipt, and ${word(FACTS_MOB.bookingTexts)} kinds of booking text in ${SMS_LANGUAGES.length} languages, the texts sent through Twilio. Turn notifications off in the sample above, and the text it shows is this platform’s own reminder, word for word.`,
    files: ["lib/email/templates.ts", "lib/sms/templates.ts", "lib/twilio/sms.ts", "lib/notifications/index.ts"],
    check: { kind: "call", label: "Ask to see a reminder go out" } }, // OWNER: that we show one on request. The trial sends no texts.
  { id: "push", label: "Push", datum: "built for yours", kind: "none", title: "Push notifications",
    forApp: "A message on the lock screen, even with the app closed, once the person has said yes.",
    // The page's one caveat, said here; the FAQ's "push" row repeats it only because it stands alone as structured data.
    ours: "Not on ours: this platform sends emails and texts, not push notifications. Yours sends push too, through Apple’s and Google’s own push services.", // OWNER (the second sentence)
    files: [],
    check: { kind: "handover", label: "Built with your app" } },
];
// "Eight of these nine", in #server's sub: exactly one part isn't on ours, and it's push.
const MISSING = PARTS.filter((p) => p.kind === "none");
if (MISSING.length !== 1 || MISSING[0].id !== "push") throw new Error("custom-mobile-applications: push is no longer the one part this platform lacks; re-read “eight of the nine” in MOB_SERVER.sub and the FAQ’s push row");
const DOES = PARTS.filter((p) => p.kind === "does").length; // 8
const face = ({ id, label, datum, kind }: Part): PartFace => ({ id, label, datum, kind });

/* ---------- #hold: the sample, the journey, the routes ---------- */

// A booking app for no business in particular: generic words, generic
// system phrasing, and no digit anywhere — the device draws grey bars
// wherever a name, a time, a figure or a price would be.
const SAMPLE_APP: SampleApp = { // SAMPLE: every word; no digit anywhere (figures, times and prices are grey bars)
  name: SAMPLE_NAME,
  tabs: ["Explore", "Bookings", "Account"], active: 1,
  signin: { title: "Welcome back", email: "Email", password: "Password", forgot: "Forgot your password?",
    go: { label: "Sign in", aria: "Sign in — opens Book a time" } },
  choose: { title: "Book a time", parts: ["Morning", "Afternoon", "Evening"], free: "Free times",
    go: { label: "Continue", aria: "Continue — opens Confirm and pay" } },
  pay: { title: "Confirm and pay", booking: "Your booking", deposit: "Deposit", card: "Card",
    go: { label: "Pay", aria: "Pay — opens You’re booked" },
    back: { ios: { label: "Cancel", aria: "Cancel — back to Book a time" }, android: { label: "Back", aria: "Back — to Book a time" } } },
  booked: { title: "You’re booked", body: "We’ll remind you before it starts.", calendar: "Add to calendar",
    ask: {
      ios: { title: `“${SAMPLE_NAME}” Would Like to Send You Notifications`, allow: "Allow", deny: "Don’t Allow" },
      android: { title: `Allow ${SAMPLE_NAME} to send you notifications?`, allow: "Allow", deny: "Don’t allow" },
    },
    allowAria: "Allow — opens the lock screen, later", denyAria: "Don’t allow — opens the lock screen, later" },
  lock: { title: "Later, on the lock screen",
    push: { app: SAMPLE_NAME, when: "now", text: "Reminder: your booking is tomorrow. Tap to see it." },
    sms: { app: "Text message", when: "now" },
    open: "Open the reminder — back to You’re booked" },
};

// Five steps, one customer. Each hop names an edge of the drawing
// (parts-geometry.ts EDGES, held by the test) and starts at the phone, at
// the daily job, or at a part an earlier hop of the same step reached;
// `ring` pings a part without travelling to it. Captions stay 60–100
// characters and the longest ≤ 1.6× the shortest, so no dwell (holdFor)
// passes five seconds and the tour runs about 23s.
export const STEPS: readonly Step[] = [ // SAMPLE: the captions describe the sample app, not ours
  // A caption never opens with its step's label: the card and the live line print the label just before it.
  { id: "signin", n: "01", label: "Sign in", screen: "signin",
    caption: "The phone sends only what was typed; the server decides who is signing in.",
    hops: ["phone-signin", "signin-data"] },
  { id: "choose", n: "02", label: "Choose", screen: "choose",
    caption: "Free times come from the server, and stay current while the customer looks.",
    hops: ["phone-api", "api-data", "data-live", "live-phone"] },
  { id: "pay", n: "03", label: "Pay", screen: "pay",
    caption: "The card goes to the payment provider; the booking is confirmed once the money arrives.",
    hops: ["phone-payments", "payments-api", "api-data"] },
  { id: "booked", n: "04", label: "Booked", screen: "booked",
    caption: "Once it’s booked, the app asks about notifications, each platform in its own way.",
    hops: ["phone-api", "api-data"], ring: ["push"] },
  { id: "reminder", n: "05", label: "Reminder", screen: "lock",
    caption: "Later, a daily job finds the bookings coming up and sends each reminder once.",
    hops: ["jobs-data", "jobs-push", "push-phone"],
    // Notifications off: the text this platform really sends (REMINDER_TEXT), the way it sends its own.
    deny: { caption: "With notifications off, the reminder comes by text, the way this platform sends its own.",
      hops: ["jobs-data", "jobs-messages", "messages-phone"] } },
];
// Captions: 74, 75, 87, 81, 77 and 88 characters; holdFor 3.9–4.4s; the longest is 1.19× the shortest.

// "Two apps or one?": the owner's answer on technology — whatever the
// product or the client calls for, chosen with them. Every line OWNER.
const ROUTES: RoutesCopy = {
  title: "Two apps or one?",
  lead: "One design, fitted to each platform, and built in whichever technology the product needs or you prefer: chosen with you, never imposed.", // OWNER
  items: [
    { id: "native", label: "Native, for each", tools: "Swift and SwiftUI · Kotlin and Jetpack Compose", // OWNER
      body: "An app for iPhone and an app for Android, each in its platform’s own language: the most direct way to everything the phone can do." }, // OWNER
    { id: "shared", label: "One codebase for both", tools: "React Native with Expo · Flutter", // OWNER
      body: "One set of code for both phones, so a change reaches both stores in the same release, with each platform’s own code where a screen needs it." }, // OWNER
    { id: "yours", label: "The code you already have", tools: "Whatever it’s written in", // OWNER
      body: "We read it first, then say plainly whether to carry on from it or start again, and why." }, // OWNER
  ],
  foot: "Whichever it is, the prototype, the server and the path through both stores stay the same.", // OWNER
};

export const MOB_HOLD: HoldData = keyed({
  eyebrow: "Tap through the sample",
  title: "One app on iOS and Android, and what it talks to",
  key: "what it talks to",
  sub: "A sample booking app, drawn for this page. Switch it between iOS and Android and follow one customer through five steps, from signing in to a reminder on the lock screen. Each step lights up the parts of this platform it talks to.",
  tag: "Sample app · no code behind it",
  partsTag: "What it talks to · drawn from this platform’s code",
  phone: "The phone",
  platformLabel: "Platform",
  platforms: [{ id: "ios", label: "iOS" }, { id: "android", label: "Android" }],
  // The platform line under the device, and what a switch announces: the
  // phone shows the differences, so there's no conventions table.
  notes: {
    ios: "iOS: a large title, a tab bar, and sheets that slide up from the bottom.",
    android: "Android: a top app bar, a navigation bar, and the system’s back gesture.",
  },
  transport: { play: "Play the sample", pause: "Pause the sample", replay: "Play it again" },
  // True of every ring: most go forward, but the sheet's Cancel (Back) and the reminder go back.
  // No longer than the line it replaced, so it wraps where that did and #hold's reserves hold.
  hint: "Ringed buttons move you through the app.",
  restart: "Start again",
  stepsLabel: "The journey",
  stepOf: "Step {n} of {total}",
  talks: "Talks to",
  full: { label: "Every part, in full", href: "#server" },
  kinds: { does: "Runs here", none: "Built for yours" },
  live: "{platform}. Step {n} of {total}: {label}. {caption}",
  liveSwitch: "{note}",
  indexSummary: "The journey, in words",
  indexReminder: "The reminder text, word for word",
  // The sub and the tag already say the phone is a sample; the credits say the rest of it, once.
  foot: "Every part the phone talks to runs on this platform except push, which is built for yours.", // OWNER
  app: SAMPLE_APP,
  reminder: REMINDER_TEXT,
  steps: STEPS,
  parts: PARTS.map(face),
  routes: ROUTES,
  // The finished frame: the server's HTML, and what reduced motion, the
  // still and lite tiers, weak hardware and no JavaScript all get.
  initial: { platform: "ios", step: "reminder", answer: "allow" },
});

/* ---------- the stores' rules: #path's gates, and #kinds' rule links ---------- */

// Declared before #kinds, whose samples each name the rule they meet. Each
// store line sits on one source line with its mark and URL (the test reads
// them): `// STORE` where the words were checked on the store's own page
// (a quote is verbatim, its quotation marks the component's), and
// `// STORE-SUMMARY` where they couldn't be — never a quote. Caps: a title
// ≤ 60, a store line ≤ 170, a side line ≤ 130.
export const GATES: readonly GateRow[] = [
  { id: "delete", title: "An account made in the app can be deleted in the app",
    apple: { store: "Apple", quote: true, text: "If your app supports account creation, you must also offer account deletion within the app.", ref: "App Review Guidelines 5.1.1(v)", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    google: { store: "Google Play", quote: false, text: "Google Play asks the same, and a web page where people can ask for it too.", ref: "Google Play: account deletion", href: PLAY_DELETE }, // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/13327111
    // "Danger zone" and "Delete account" (SettingsPageClient.tsx), REAUTH_WINDOW_MS, DELETION_ORDER[0], accountDeletedEmail.
    side: { kind: "ours", text: `From Settings → Danger zone → Delete account, after a sign-in in the last ${FACTS_MOB.reauthMinutes} minutes. Billing stops first; an email confirms it.`, link: TRIAL_LINK } },
  { id: "payments", title: "What the app sells decides who takes the payment",
    apple: { store: "Apple", quote: false, text: "Features and content unlocked inside the app use Apple’s in-app purchase; physical goods and services used outside the app are paid another way, such as by card.", ref: "App Review Guidelines 3.1.1 and 3.1.3(e)", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    // Cut before "Google Pay SDK", so no extra mark is printed; the apostrophe typographic.
    google: { store: "Google Play", quote: true, text: "Google Play’s billing system is only for digital items.", ref: "Google Play’s billing system", href: PLAY_BILLING }, // STORE https://developer.android.com/google/play/billing
    side: { kind: "yours", text: "Settled at the prototype for each thing the app sells, before a screen is built the wrong way." } }, // OWNER
  { id: "review", title: "The reviewer gets a way in",
    apple: { store: "Apple", quote: true, text: "include demo account info (and turn on your back-end service!) if your app includes a login.", ref: "App Review Guidelines 2.1(a)", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    google: { store: "Google Play", quote: false, text: "Google Play asks for the details a reviewer needs to reach any part of the app behind a sign-in.", ref: "Google Play: app access", href: PLAY_ACCESS }, // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/15748846
    side: { kind: "yours", text: "A review account with sample data, and the server kept on, for every update." } }, // OWNER
  { id: "privacy", title: "A privacy policy, in the store and in the app",
    apple: { store: "Apple", quote: true, text: "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner.", ref: "App Review Guidelines 5.1.1(i)", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    google: { store: "Google Play", quote: false, text: "Google Play asks for a privacy policy, and a form saying what the app collects and shares.", ref: "Google Play: Data safety", href: PLAY_DATA_SAFETY }, // STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/10787469
    // For yours: this platform links its policy from the site's footer and the sign-up form, but not from
    // inside the signed-in product, so it can't stand as "On ours" beside a rule about "within the app".
    side: { kind: "yours", text: "Linked in both store listings and from the app’s own settings." } }, // OWNER
  { id: "website", title: "An app has to do more than a website",
    apple: { store: "Apple", quote: true, text: "Your app should include features, content, and UI that elevate it beyond a repackaged website.", ref: "App Review Guidelines 4.2", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    google: null,
    side: { kind: "yours", text: "Built around what only a phone can do, from notifications to the camera, so it’s more than a repackaged website." } }, // OWNER
  { id: "signin", title: "Sign in with Google on an iPhone? Then a private option too",
    apple: { store: "Apple", quote: false, text: "An app that signs people in with a third-party or social account, such as Google’s, must also offer an equivalent option with the privacy features Apple lists.", ref: "App Review Guidelines 4.8", href: APPLE_REVIEW }, // STORE https://developer.apple.com/app-store/review/guidelines/
    google: null,
    side: { kind: "yours", text: "Sign in with Apple beside Google’s, wherever the iOS app offers Google’s." } }, // OWNER
];

// "Whose name it’s in": the table closing #path, so the question has one
// answer in one place. One row per source line, each with its mark.
const OWN: readonly OwnRow[] = [
  { id: "apple", what: "The Apple developer account", whose: "yours", how: `Opened by your company, with us working in it as members of your team. Apple asks a company for its ${DUNS} Number.`, link: { label: "Apple’s enrolment page", href: APPLE_ENROL } }, // OWNER; STORE https://developer.apple.com/help/account/membership/program-enrollment/
  { id: "google", what: "The Google Play developer account", whose: "yours", how: `Opened by your company, with us invited to it. Google Play asks an organisation for a ${DUNS} number too.`, link: { label: "Google Play’s page", href: PLAY_DUNS } }, // OWNER; STORE-SUMMARY https://support.google.com/googleplay/android-developer/answer/13628312
  { id: "seller", what: "The name the stores show", whose: "yours", quote: true, how: "The legal entity name will appear as the seller for apps you distribute.", link: { label: "Apple, on enrolment", href: APPLE_ENROL } }, // STORE https://developer.apple.com/help/account/membership/program-enrollment/
  { id: "code", what: "The code for both apps and the server", whose: "handed", how: "With its tests and a guide to running it, at the end of the build." }, // OWNER
  { id: "signing", what: "What signs each new version", whose: "yours", how: "Set up in your Apple and Google accounts, so another team could release the next one." }, // OWNER
  { id: "hosting", what: "Hosting, database and messaging accounts", whose: "agreed", how: "Whose name they’re in is agreed before the build starts." }, // OWNER
];

// Apple's lines are all read from developer.apple.com; a Google Play policy
// page stays a labelled summary until its words are copied from it.
for (const g of GATES) {
  if (!g.apple.href.startsWith("https://developer.apple.com/")) throw new Error(`custom-mobile-applications: the "${g.id}" gate’s Apple line isn’t on developer.apple.com`);
}
for (const l of [...GATES.flatMap((g) => (g.google ? [g.apple, g.google] : [g.apple])), ...OWN.filter((o) => o.quote).map((o) => ({ quote: true, href: o.link?.href ?? "" }))]) {
  if (l.quote && /^https:\/\/(?:support|play)\.google\.com\//.test(l.href))
    throw new Error(`custom-mobile-applications: ${l.href} is quoted; a Google Play policy page is summarised until re-read`);
}

/* ---------- #kinds: features, the twelve samples ---------- */

/** What an app can ask of the phone, in the order #kinds' index lists them. */
export const FEATURES = [
  { id: "camera", label: "Camera" }, { id: "scan", label: "Scanning codes" }, { id: "location", label: "Location" },
  { id: "background", label: "Location, phone locked" }, { id: "push", label: "Notifications" }, { id: "offline", label: "Works offline" },
  { id: "biometric", label: "Face or fingerprint" }, { id: "wallet", label: "The phone’s wallet" }, { id: "purchase", label: "In-app purchases" },
  { id: "calendar", label: "Calendar" }, { id: "files", label: "Files" }, { id: "live", label: "Live updates" },
] as const satisfies readonly { id: FeatureId; label: string }[];

const screen = (name: string, ...blocks: [SketchBlock] | [SketchBlock, SketchBlock]): MiniScreen => ({ name, blocks });
const core = (id: FeatureId, why: string): PhoneNeed => ({ id, need: "core", why });
const often = (id: FeatureId, why: string): PhoneNeed => ({ id, need: "often", why });

/**
 * One sample, with its id built from its kind and side. Throws unless it
 * has the fixed shape #kinds draws — five screens of one or two blocks,
 * four distinct phone needs with at least one it can't do without, and
 * the three parts every app has — so the room never changes height on a
 * pick except where a sentence wraps. Lengths, and no digit, brand or
 * "client", are the test's to hold.
 */
function sample(kind: KindId, side: SideId, s: Omit<Sample, "id" | "kind" | "side">): Sample {
  const id = `${kind}-${side}` as const;
  const bad = (why: string) => new Error(`custom-mobile-applications: sample "${id}" ${why}`);
  if (s.screens.length !== 5 || s.screens.some((x) => x.blocks.length < 1 || x.blocks.length > 2)) throw bad("isn’t five screens of one or two blocks");
  if (s.phone.length !== 4 || new Set(s.phone.map((p) => p.id)).size !== 4) throw bad("doesn’t ask four different things of the phone");
  if (!s.phone.some((p) => p.need === "core")) throw bad("needs nothing of the phone");
  if (new Set(s.parts).size !== s.parts.length) throw bad("repeats a part");
  for (const p of ["signin", "api", "data"] as const) if (!s.parts.includes(p)) throw bad(`leaves out "${p}"`);
  return { id, kind, side, ...s };
}

// Six kinds × two sides, in the order the controls list them. Parts in
// PARTS order. `rule` is the gate the sample meets, linked as #gate-<id>.
export const SAMPLES: readonly Sample[] = [ // SAMPLE: written for this page, for no business in particular
  /* ── Bookings ── */
  sample("bookings", "customers", {
    title: "Book a time, pay a deposit, get reminded", who: "People booking a salon, a clinic, a class or a court",
    screens: [screen("Services", "search", "list"), screen("Choose a time", "calendar", "list"), screen("Pay a deposit", "card", "pay"), screen("My bookings", "list", "button"), screen("Reminder", "notice")],
    phone: [core("push", "Reminders, so fewer people miss their slot"), core("calendar", "The booking added to their own calendar"),
      often("wallet", "A card saved on the phone, for the deposit"), often("biometric", "Quick sign-in for regulars")],
    parts: ["signin", "api", "data", "payments", "live", "jobs", "messages", "push"],
    ai: "AI suggests the next free time that suits them",
    hard: "Two people tapping the last free time at once, and a reminder that must go out exactly once.",
    rule: "payments",
  }),
  sample("bookings", "staff", {
    title: "The day’s bookings, at a glance", who: "The people who take the bookings",
    screens: [screen("Today", "list"), screen("A booking", "card", "button"), screen("Check someone in", "code", "check"), screen("Block time off", "calendar", "button"), screen("Messages", "chat")],
    phone: [core("push", "A new or moved booking, the moment it changes"), core("offline", "Notes kept when the signal drops"),
      often("scan", "Checking someone in from a code"), often("biometric", "A quick sign-in between appointments")],
    parts: ["signin", "api", "data", "live", "messages", "push"],
    ai: "AI drafts a reply to a message, for a person to send",
    hard: "A change at the front desk showing on every phone at once, and notes written with no signal kept safe.",
    rule: "review",
  }),
  /* ── Shops ── */
  sample("shops", "customers", {
    title: "Browse, buy and follow the order", who: "Shoppers, on a shop or a marketplace",
    screens: [screen("Browse", "search", "grid"), screen("A product", "media", "button"), screen("Basket", "list", "button"), screen("Pay", "card", "pay"), screen("On its way", "map", "card")],
    phone: [core("push", "Every change to the order, as it happens"), core("wallet", "Paying with a card saved on the phone"),
      often("scan", "Vouchers and codes, in the shop"), often("location", "The delivery address, from where they are")],
    parts: ["signin", "api", "data", "payments", "files", "jobs", "messages", "push"],
    ai: "AI search that understands what they meant",
    hard: "Stock that stays right when two people buy the last one, and refunds that reach the right card.",
    rule: "payments",
  }),
  sample("shops", "staff", {
    title: "Sell, pack and ship from the phone", who: "Sellers and the people who pack the orders",
    screens: [screen("New orders", "list"), screen("Add a product", "camera", "field"), screen("Pack an order", "list", "code"), screen("Ship it", "card", "button"), screen("Payouts", "chart", "list")],
    phone: [core("camera", "Product photos, taken where the product is"), core("scan", "Each item scanned as it’s packed"),
      core("push", "A new order, the moment it’s paid"), often("offline", "Packing lists that work in the stockroom")],
    parts: ["signin", "api", "data", "payments", "files", "messages", "push"],
    ai: "AI writes a first description from the product’s photo",
    hard: "Paying many sellers correctly from one checkout, and never shipping an order twice.",
    rule: "review",
  }),
  /* ── Delivery and field work ── */
  sample("delivery", "customers", {
    title: "Order it, and watch it arrive", who: "Customers of a delivery or collection service",
    screens: [screen("Order", "list", "button"), screen("Pay", "card", "pay"), screen("On its way", "map", "card"), screen("Driver chat", "chat"), screen("Delivered", "check", "button")],
    phone: [core("location", "The drop-off point, set from where they are"), core("live", "The map moving while they watch"),
      core("push", "A note when it’s nearly there"), often("wallet", "Paying with a card saved on the phone")],
    parts: ["signin", "api", "data", "payments", "live", "messages", "push"],
    ai: "AI answers ‘where is my order?’ from the tracking itself",
    hard: "A map that moves smoothly while the phone’s signal comes and goes.",
    rule: "payments",
  }),
  sample("delivery", "staff", {
    title: "The route, the job and the proof", who: "Drivers and technicians out on the road",
    screens: [screen("Today’s jobs", "list", "map"), screen("Route", "map"), screen("Checklist", "list", "check"), screen("Photo, signature", "camera", "sign"), screen("Done", "check")],
    phone: [core("location", "The route to each job"), core("background", "Following the route with the phone locked"),
      core("camera", "Photos of the work, before and after"), core("offline", "Working in a basement, then catching up")],
    parts: ["signin", "api", "data", "files", "live", "jobs"],
    ai: "AI reads a meter, a label or a delivery note from a photo",
    hard: "A route that keeps going with the phone locked, and a battery that lasts the shift.",
    rule: "privacy",
  }),
  /* ── Health and care ── */
  sample("health", "customers", {
    title: "Appointments, messages and results in one place", who: "Patients of a clinic or a care service",
    screens: [screen("Sign in", "field", "button"), screen("Appointments", "calendar", "list"), screen("Messages", "chat"), screen("Documents", "list", "card"), screen("Reminder", "notice")],
    phone: [core("biometric", "Records opened only by the person they’re for"), core("push", "Reminders for appointments and medicine"),
      often("calendar", "Appointments in their own calendar"), often("files", "Letters and results to keep")],
    parts: ["signin", "api", "data", "files", "jobs", "messages", "push"],
    ai: "AI answers questions from the clinic’s own information",
    hard: "Data that must stay in one region, and a sign-in strong enough for what it protects.",
    rule: "privacy",
  }),
  sample("health", "staff", {
    title: "Visits, notes and forms on the go", who: "Carers and clinicians between visits",
    screens: [screen("Today’s visits", "list", "map"), screen("A visit", "card", "button"), screen("Notes", "field", "list"), screen("Forms", "list", "check"), screen("Hand-over", "list", "button")],
    phone: [core("offline", "Notes that are never lost with no signal"), core("biometric", "A quick, strong sign-in between visits"),
      often("location", "The way to the next visit"), often("camera", "A photo for the record, when it’s needed")],
    parts: ["signin", "api", "data", "files", "jobs"],
    ai: "AI drafts the visit note from what was said, for the carer to check",
    hard: "Notes written with no signal that must never be lost, or saved twice.",
    rule: "review",
  }),
  /* ── Learning ── */
  sample("learning", "customers", {
    title: "Courses, classes and progress", who: "Students and members",
    screens: [screen("Courses", "grid"), screen("A lesson", "media", "list"), screen("Quiz", "field", "button"), screen("Progress", "ring", "chart"), screen("Membership", "card", "pay")],
    phone: [core("offline", "Lessons saved for the train or the plane"), core("purchase", "Courses bought through the store’s own checkout"),
      often("push", "A nudge to keep going, when they choose"), often("calendar", "Live classes in their own calendar")],
    parts: ["signin", "api", "data", "payments", "files", "jobs", "push"],
    ai: "AI explains a lesson again, another way",
    hard: "Knowing which purchases go through the stores’ own checkout, and which don’t.",
    rule: "payments",
  }),
  sample("learning", "staff", {
    title: "Attendance and updates, from the room", who: "Teachers, coaches and instructors",
    screens: [screen("Today’s classes", "list"), screen("Attendance", "list", "check"), screen("Scan in", "code", "check"), screen("Post an update", "field", "media"), screen("Messages", "chat")],
    phone: [core("scan", "A whole room checked in from their codes"), core("push", "An update to every student at once"),
      often("camera", "A photo of the board, posted to the class"), often("offline", "Attendance kept when the signal is weak")],
    parts: ["signin", "api", "data", "files", "messages", "push"],
    ai: "AI turns a photo of the board into notes for the class",
    hard: "Two teachers marking the same class without clashing, and each update reaching only the students it’s meant for.",
    rule: "review",
  }),
  /* ── Money and loyalty ── */
  sample("money", "customers", {
    title: "Points, payments and receipts", who: "Customers of a loyalty scheme, a club or a payment service",
    screens: [screen("Wallet", "card", "list"), screen("Pay", "code", "button"), screen("Rewards", "grid"), screen("Receipts", "list"), screen("Help", "chat")],
    phone: [core("biometric", "Nothing opens or pays without it"), core("wallet", "A card in the phone’s own wallet"),
      core("scan", "Paying or earning points with a code"), often("push", "Every payment in or out, as it happens")],
    parts: ["signin", "api", "data", "payments", "jobs", "messages", "push"],
    ai: "AI answers questions about a payment",
    hard: "Every movement of money recorded once, and a sign-in a stolen phone can’t get past.",
    rule: "signin",
  }),
  sample("money", "staff", {
    title: "Expenses and approvals on the go", who: "Teams who spend, and the people who approve it",
    screens: [screen("To approve", "list"), screen("A request", "card", "button"), screen("Scan a receipt", "camera", "check"), screen("Expenses", "list", "chart"), screen("Reports", "chart")],
    phone: [core("camera", "A receipt photographed where it was paid"), core("biometric", "An approval only the right person can give"),
      core("push", "A request waiting for a yes"), often("offline", "Receipts captured with no signal")],
    parts: ["signin", "api", "data", "files", "jobs", "push"],
    ai: "AI reads a crumpled receipt, and flags the ones a person should check",
    hard: "The same receipt never claimed twice, and a record of every approval that nobody can quietly change.",
    rule: "review",
  }),
];
// Each sample's rule link opens a gate card on this page (#gate-<id>).
for (const s of SAMPLES) {
  if (!GATES.some((g) => g.id === s.rule)) throw new Error(`custom-mobile-applications: sample "${s.id}" meets a rule with no gate: "${s.rule}"`);
}

/* ---------- #kinds ---------- */

/** The kinds of app #kinds samples: a few of many, and its sub says how many. */
const KINDS: KindsData["kinds"] = [
  { id: "bookings", label: "Bookings" }, { id: "shops", label: "Shops" }, { id: "delivery", label: "Delivery and field work" },
  { id: "health", label: "Health and care" }, { id: "learning", label: "Learning" }, { id: "money", label: "Money and loyalty" },
];

export const MOB_KINDS: KindsData = keyed({
  eyebrow: "Your kind of app",
  title: "Whatever the app does, and whoever it’s for",
  key: "whoever it’s for",
  // Breadth first, so the chips read as a sample of what we build, not the menu.
  sub: `${cap(word(KINDS.length))} of the many kinds of app we build, to show the pattern. Pick one and who uses it: each sample shows its first screens, what it asks of the phone, and which of the parts behind it already run on this platform.`,
  kindsLabel: "Kind of app",
  sideLabel: "Who uses it",
  kinds: KINDS,
  sides: [{ id: "customers", label: "Your customers" }, { id: "staff", label: "Your staff" }],
  initial: { kind: "bookings", side: "customers" }, // the phone's own sample, so the two sections agree
  // A no-break space before each "·": the tag wraps only after one, as #work's does.
  tag: "Sample · {kind} · {side}",
  screensLabel: "Its first screens",
  phoneTitle: "What it asks of the phone",
  serverTitle: "What runs behind it",
  needs: { core: "Needs it", often: "Often" },
  ours: { does: "Runs here", none: "Built for yours" },
  absent: "Not used",
  aiLabel: "With AI",
  hardLabel: "What makes it hard",
  ruleLabel: "The store rule it meets",
  full: { label: "Every part, and where it runs here", href: "#server" },
  live: "{kind}, {side}: {title}.",
  indexSummary: "All twelve samples, in words",
  foot: "Samples written for this page. Something else entirely? Bring yours to the call.",
  features: FEATURES,
  parts: PARTS.map(face),
  gates: GATES.map(({ id, title }) => ({ id, title })), // the rule link's words: "What the app sells decides who takes the payment →" #gate-payments
  samples: SAMPLES,
});

/* ---------- #path: from prototype to both stores ---------- */

// The title is the menu's promise and the stage titles its deliverables,
// read rather than retyped, so the menu and the page can't disagree.
const BASE_PATH: PathData = keyed({
  eyebrow: "From prototype to both stores",
  title: ITEM.promise, // "An app your customers keep on their home screen."
  // Split for the reveal, these lines wrap exactly as they do at rest, 320–1440px (a 1px sweep);
  // the key "on their home screen." gained a line while split at 384–388.
  key: "their home screen.",
  sub: "Three stages, each ending in something you can hold and check before the next starts, and three gates on the way: your yes, your testers’ and the stores’.",
  labels: { stage: "Stage", hold: "You hold", ours: "On ours", published: "In the stores" },
  checkKinds: CHECK_KINDS,
  path: {
    title: "The path, step by step",
    lanes: { ios: "iOS", android: "Android" },
    gateWord: "Gate",
    // `at`: each station's x on the figure (path-figure.tsx), strictly
    // increasing; the forked stations carry each lane's own word.
    stations: [
      { id: "prototype", n: "01", label: "Prototype", long: "A prototype on your phone", at: 0.04 },
      { id: "design", n: "02", label: "Design", long: "Designed for both platforms", at: 0.21 },
      { id: "build", n: "03", label: "Build", long: "Built, with its server", at: 0.42 },
      { id: "beta", n: "04", label: "Beta", long: "A beta, with your testers", lanes: { ios: "TestFlight", android: "Testing track" }, at: 0.59 },
      { id: "review", n: "05", label: "Review", long: "Each store’s review", lanes: { ios: "App Review", android: "Play review" }, at: 0.77 },
      { id: "live", n: "06", label: "Published", long: "Published under your name", lanes: { ios: "App Store", android: "Google Play" }, at: 0.88 },
      { id: "updates", n: "07", label: "Updates", long: "Updates, the same way", at: 0.985 },
    ],
    gates: [
      { id: "yes", label: "Your yes", after: "design", at: 0.315 },
      { id: "testers", label: "Your testers", after: "beta", at: 0.68 },
      { id: "review", label: "The stores’ review", after: "review", at: 0.77 }, // drawn as station 05 itself
    ],
    beta: { text: "Before review, every build goes to your testers:", links: [TESTFLIGHT, PLAY_TESTING] },
  },
  stages: [
    { id: "design", n: "01", title: ITEM.deliverables[0], // "Designed for iOS and Android"
      body: "We draw every screen that matters and link them into a prototype you tap through on your own phone. Then each screen is designed for both platforms: the same app, with each one’s own navigation, dialogs and gestures.",
      hold: "A prototype you’ve tapped through on your own phone, and the designs for both platforms.",
      check: { kind: "site", label: "Tap through the sample above", href: "#hold" } },
    { id: "build", n: "02", title: ITEM.deliverables[1], // "Sign-in, payments and push built in"
      body: "The apps and the server behind them are built together, in the technology chosen at the prototype, and tried on real iPhones and Android phones as each part lands.", // OWNER
      hold: "The app on your testers’ phones, working against its own server.", // OWNER
      ours: `Sign-in with email or Google, Stripe payments and fiscal invoices, ${FACTS_AUTO.emails} account emails, booking texts in ${SMS_LANGUAGES.length} languages, and an always-on service for live connections.`,
      check: { kind: "site", label: "Walk through ours on the free trial", href: PRICING_TRIAL.href } },
    { id: "publish", n: "03", title: ITEM.deliverables[2], // "Published to both app stores"
      body: "Apple and Google review each release against their rules, and it’s published from developer accounts in your company’s name. Every update goes the same way, and the crash reports both stores keep are watched.", // OWNER
      hold: "Both apps in the stores under your name, and the code for the apps and the server.", // OWNER
      // The rule both stores make of an app with accounts, met by ours: DELETION_ORDER, read (guarded above).
      // Printed under "On ours", so it never opens with "Ours"; the delete gate below gives the path and the email.
      ours: `Deleting an account from inside the product, which both stores require, already works here: after a fresh sign-in, the server removes the account and its data in ${word(DELETION_ORDER.length)} steps with billing stopped first.`, // publishedCopy() adds its own "In the stores" line under it
      check: { kind: "site", label: "The stores’ rules, below", href: "#gates" } },
  ],
  gates: {
    title: "The gates the stores keep",
    sub: "What Apple and Google ask of an app before it goes into their stores, quoted or summarised from their own pages, and what we do about each.",
    labels: { quote: "In their words", summary: "Summarised", ours: "On ours", yours: "For yours" },
    rows: GATES,
  },
  own: {
    title: "Whose name it’s in",
    sub: "What keeps the apps in the stores, and what another team would need to carry them on, is yours or agreed before the build starts.", // OWNER
    head: { what: "What", whose: "Whose", how: "How" },
    states: { yours: "In your name", handed: "Handed to you", agreed: "Agreed first" },
    rows: OWN,
  },
});

/* ---------- #server: the half you don't see ---------- */

export const MOB_SERVER: ServerData = keyed({
  eyebrow: "Behind the app",
  title: "The half you don’t see, already running here",
  key: "already running here",
  // "…runs eight of these nine parts…": counted from PARTS (guarded above).
  sub: `Almost every app talks to a server: to know who’s signing in, take payments, send messages and do the work nobody taps for. This platform, our own product for AI phone agents, runs ${word(DOES)} of these ${word(PARTS.length)} parts, and every figure here is counted from its code. Yours gets its own, built with your app.`, // OWNER (the last sentence)
  tag: "This platform’s own parts · drawn from its code",
  bus: "The app",
  labels: { forApp: "For an app", ours: "On ours", code: "In the code, for your developers" },
  kinds: { does: "Runs here", none: "Built for yours" },
  checkKinds: CHECK_KINDS,
  parts: PARTS,
  indexSummary: "Where each part lives in the code",
  foot: "Drawn by the team that built it, from its code. It’s a drawing, not a live feed.",
});

/* ---------- #team ---------- */

// The Automations page's compact credentials card, as it is: said once,
// with a link to the SaaS page's #credentials for what each one is.
export const MOB_TEAM: TeamData = keyed({
  eyebrow: "Who builds it",
  title: `The people who build it hold ${ACC} Claude accreditations`,
  key: `${ACC} Claude accreditations`,
  // The card's label and caption say "Personal … from Anthropic", and the
  // grants' line says their technology runs inside: each once, not here too.
  sub: "The team that built this platform, from its sign-in to its live calls, and builds apps of any kind, for any business.", // OWNER
  checkKinds: CHECK_KINDS,
  accreditations: {
    label: "Personal accreditations",
    figure: ACC, // "20+"
    caption: "Claude accreditations, from Anthropic",
    // OWNER (confirmed): the accreditations cover building with Claude, and we build with it, this platform included.
    body: "Each was earned by one of the people who’d design and build your app, for building with Claude, Anthropic’s AI. We build with it too, this platform included: where your app should read a photo, answer a question or sort what people send in, the people building it already know how.", // OWNER
    isnt: "They’re personal, not a certification of our company.", // the page's only word on it
    check: accCheck,
  },
  grants: {
    label: "Startup grants, awarded to our company",
    names: GRANTS.map((g) => g.grantor),
    line: "Their technology runs inside this platform: where your app should speak or listen, we already build on it.",
    isnt: "A grant isn’t an endorsement of this page, or of any build we quote.",
    check: grantCheck,
    more: { label: "What each one is, and how to see it", href: `${SAAS_ITEM.href}#credentials` },
  },
});

/* ---------- #terms (still) ---------- */

// Whose name the hosting accounts are in is said once, in #path's own
// table, so the SaaS "agreed before the build starts" line isn't repeated.
export const MOB_TERMS: TermsData = keyed({
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  // Split for the reveal, these lines wrap exactly as they do at rest, 320–1440px (a 1px sweep);
  // the key "what we say up front" gained a line while split at 410–414, most Android phones' width.
  key: "say up front",
  sub: "There’s no price or date on this page: both go in the quote, because both depend on what the app has to do. Here’s what moves them.",
  columns: [
    { id: "sets", head: "What sets the price and the date", items: [
      "Which kinds of people use it, and what each may see or do",
      "Native for each platform, one codebase for both, or code you already have",
      "What it asks of the phone: camera, location, working offline, payments",
      "Anything live: chat, tracking, calls",
      "The systems it connects to, and whether its server exists yet",
      "Where your users are, and the rules that come with that",
    ] },
    { id: "need", head: "What we’ll need from you", items: [
      "A conversation about who uses it, what they do in it, and what they must never be able to do",
      "Whatever exists already: sketches, a website, a spreadsheet, an old app",
      "One person who can say yes or no at each prototype review",
      "Developer accounts with Apple and Google in your company’s name — we’ll walk you through opening them", // OWNER
      "Testers from your side for each beta, and your yes before anything goes to the stores",
    ] },
    { id: "get", head: "What you get", items: [
      ITEM.deliverables[0], ITEM.deliverables[1], ITEM.deliverables[2],
      "The code for the apps and the server, with tests and a guide to running it", // OWNER
    ] },
    { id: "upfront", head: "Said up front", items: [
      "A prototype isn’t the app: you tap through it on your phone, but it stores nothing and charges no one.",
      "Apple and Google review every release against their own rules. We build to them; the decision is theirs.",
      "The stores have fees of their own; the quote says which apply to yours.",
      "Hosting, messages and the other services it runs on bill for what they supply, on top of the build; the quote lists them.", // OWNER
      "If a website that works well on phones would do the job, we’ll say so on the call.",
      CAA_HANDOVER.after, // "Who makes changes after launch — your team, us, or both — is agreed when the build is quoted."
    ] },
  ],
  // The siblings' row, mirrored: the team's other three builds.
  after: "If it’s a whole platform, an automation or a phone agent you need, the same team builds those too.", // OWNER
  links: [
    { label: "How a SaaS platform is built", href: SAAS_ITEM.href },
    { label: "How a custom automation is built", href: AUTO_ITEM.href },
    { label: "How a custom phone agent is built", href: CAA_ITEM.href },
  ],
});

/* ---------- #checks ---------- */

// Built from the list so it reads true for one grantor or several.
const grantsClaim = `${GRANTORS} ${GRANTS.length === 1 ? "awarded" : "each awarded"} our company a startup grant.`;

// Twelve rows: five now in this browser, four on the call, three in your
// build (the test computes the filter counts, so a row added here only
// needs its kind). Two rows are the SaaS page's own, read by id. The
// accreditations and grants rows flip to "site" when a public link exists,
// and take that link with them.
const BASE_CHECKS: ChecksData = keyed({
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
    { id: "same-app", kind: "site", claim: "The sign-in, payments and account emails drawn with the sample run on the platform you can try.",
      how: "Start the free trial: sign up, confirm your email and choose a plan.", link: TRIAL_LINK },
    saasRow("cards"), // "Card numbers go to Stripe and never reach our servers." — read by id, never retyped
    { id: "delete", kind: "site", claim: "An account can be deleted from inside the product, as both stores ask of an app.",
      how: `On the trial: Settings → Danger zone → Delete account. It asks for a sign-in within the last ${FACTS_MOB.reauthMinutes} minutes first.`, link: TRIAL_LINK },
    // Read from #path's gates, never retyped: its title and the two labels each card prints.
    { id: "rules", kind: "site", claim: `Every store rule under ‘${BASE_PATH.gates.title}’ links to the store’s own page.`,
      how: `Each card names its source and marks a quote ‘${BASE_PATH.gates.labels.quote}’ and a summary ‘${BASE_PATH.gates.labels.summary}’.`, link: { label: "The gates", href: "#gates" } },
    saasRow("company"), // "We’re an EU company, registered in Romania."
    { id: "accreditations", kind: ACCREDITATIONS.verify ? "site" : "call", claim: `Our team holds ${ACC} Claude accreditations from Anthropic.`, how: "Ask to see them.", // OWNER
      ...(ACCREDITATIONS.verify ? { link: { label: "See the accreditations", href: ACCREDITATIONS.verify.href } } : {}) },
    { id: "grants", kind: grantLink ? "site" : "call", claim: grantsClaim, how: "Ask to see them.", // OWNER
      ...(grantLink ? { link: { label: "See the grants", href: grantLink.href } } : {}) },
    // "About this platform": the accreditations' count is the owner's, not the code's.
    { id: "counts", kind: "call", claim: "Every figure about this platform is counted from its code.",
      how: "By a test that fails if a figure stops being true. Ask us to run it." },
    // reminders.ts: claimed before the text goes out, released if it fails.
    { id: "reminder", kind: "call", claim: "A reminder goes out once, even if the job runs twice.",
      how: "Ask us to open the reminder step: each booking is claimed before its text goes out, and freed again if the text fails." },
    { id: "prototype", kind: "handover", claim: "You tap through the prototype on your own phone first.",
      how: "It’s what stage 01 delivers; the sample above shows the idea.", link: { label: "The sample", href: "#hold" } },
    { id: "accounts", kind: "handover", claim: "Both apps are published from developer accounts in your company’s name.", // OWNER
      how: "Opened in your name before the first beta; we work in them as your team." }, // OWNER
    { id: "code", kind: "handover", claim: "The code is handed over.", // OWNER
      how: "Both apps and the server, with their tests and a guide to running them, are yours at the end of the build." }, // OWNER
  ],
  // The card that closes the ledger looks forward, to the reader's own
  // build: #path's three stages, each checked as it lands.
  missing: {
    label: "How you check yours",
    body: "Yours starts with a call. Then come the three stages above, each one yours to check as it lands: a prototype on your phone, the app working in your testers’ hands, and both store listings under your name, with the code handed over.", // OWNER
    cta: CALL,
  },
});

/* ---------- #faq ---------- */

const BASE_FAQ: FaqData = keyed({
  eyebrow: "Questions",
  title: "What people ask before a build",
  key: "before a build",
  keyTone: "quiet",
  talk: CALL,
  phone: COMPANY.phone,
  items: [
    // The doubt the name and the page's own proof raise, first (the name
    // is guarded above). Also served alone as FAQPage data.
    { id: "breadth", q: "Your name says ‘Voice’. Do you only build voice apps?",
      a: `No. We build whatever app your business needs — for bookings, shopping, delivery, learning, health, money or your own team’s work — with AI in it where it helps, or none at all. ${COMPANY.name} is also the name of our own product, a platform for AI phone agents; its server side is on this page because it’s ours to open up, not because voice is all we build.` }, // OWNER
    { id: "proof", q: "How do we know you can build our app?",
      a: "Check what this page shows. The server side an app needs already runs on this platform, which you can try for free, and the people who’d build yours hold the accreditations above. Then check yours as it lands: before any code is written, you’ll have tapped through a prototype of your own app on your phone, and every build reaches your testers before either store’s review." }, // OWNER. publishedCopy() puts one sentence in front
    { id: "web", q: "Should it be an app at all?",
      a: "Not always. If people use it once in a while, a website that works well on phones may do, and cost less; we’ll say so on the call. An app earns its place when people come back to it, or when it needs the phone itself: notifications, the camera, location, or working with no signal. Apple’s own rules ask the same of an app.",
      where: { label: "Apple’s rule on it", href: "#gate-website" } },
    { id: "tech", q: "Which technology do you build in?",
      a: "Whichever the product needs, or you prefer. Many apps are written once, in React Native with Expo or in Flutter, and built for both stores; apps that lean hard on the phone — the camera all day, audio, devices they connect to, widgets — are written natively, in Swift and SwiftUI for iOS and in Kotlin and Jetpack Compose for Android. We choose it with you at the prototype, and say why." }, // OWNER. Code you already have: the "existing" row
    { id: "review", q: "Will Apple and Google approve it?",
      a: "We build to both stores’ published rules from the first screen — deleting an account in the app, a privacy policy, a way in for the reviewer, the right checkout for what it sells — and every build goes to your testers before review. The decision is the stores’: if a reviewer asks for a change, we make it and send it back." }, // OWNER
    { id: "own", q: "Who owns the app, the code and the store accounts?",
      a: "You do. The Apple and Google developer accounts are opened in your company’s name, so it’s the name the stores show, and we work in them as members of your team. At handover the code for the apps and the server is yours, with its tests and a guide to running it. Whose name the hosting accounts are in is agreed before the build starts." }, // OWNER
    { id: "server", q: "Do we need a server, and who runs it?",
      a: "Almost every app does, for accounts, payments, messages and anything people share. We build it with the app and hand over its code with the app’s; if you already run one, the app can talk to yours. Who runs it after launch — your team, us, or both — is agreed when the build is quoted. The parts on this page are what this platform runs for itself: yours gets its own." }, // OWNER
    // Repeats #server's push caveat only because it stands alone as structured data, and so points at no sample.
    { id: "push", q: "Can it send push notifications?",
      a: "Yes, through Apple’s and Google’s own push services, once each person has said yes. This platform doesn’t send push: it sends emails and texts, such as its booking reminders. So push is built for yours, with a text or an email for people who turn notifications off." }, // OWNER
    { id: "cost", q: "What does it cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on what the app must do: how many kinds of user, which technology, what it asks of the phone, and what it connects to. We won’t put a number here that we’d have to walk back." },
    { id: "existing", q: "We already have an app, or a website. Can you take it on?",
      a: "Tell us about it on the call, then give us read access to the code. We’ll tell you plainly whether we’d carry on from it or start again, and why." },
    // Each copy of a call where the SaaS page puts it, read from its FAQ (REGION above).
    { id: "data", q: "Where would our data live?",
      a: `Where your app needs it to, chosen with you before anything is built. ${REGION}`,
      where: { label: "Read the privacy policy", href: "/privacy" } },
  ],
});

/* ---------- #start, then the credits ---------- */

// The deep panel's colour zones were measured on SAAS_START's copy, so the
// title, key and body stay at or under its lengths (45, 25, 203; the test holds it).
export const MOB_START: StartData = keyed({
  eyebrow: "Start",
  title: "Bring the app idea, and who it’s for", // 36 ≤ 45
  key: "who it’s for", // 12 ≤ 25
  body: "A build starts with a phone call, not a form. Tell us who’ll use the app, what they do in it and what it connects to. We’ll tell you what we’d build first, in which technology, and what it would take.", // 200 ≤ 203
  primary: CALL,
  secondary: { label: "Try the platform we built", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · Quoted after the call, never on the page`,
});

/** Every third-party mark the page prints, apart from Anthropic, Claude, Apple's and Google's (their own lines). */
export const MOB_TRADEMARKS = ["Cartesia", "ElevenLabs", "Stripe", "SmartBill", "Supabase", "PostgreSQL", "Twilio", "Node.js",
  "React Native", "Expo", "Kotlin", "D-U-N-S"] as const;

const ISNT = "What isn’t here";
const BASE_CREDITS: CreditsData = {
  title: "About this page",
  items: [
    { term: "The sample app", detail: "Made for this page: a booking app for no business in particular. It stores nothing, charges no one and sends nothing; its buttons only change the picture. Its two looks follow each platform’s own conventions; they aren’t Apple’s or Google’s screens." },
    { term: "The parts behind it", detail: `${COMPANY.name}’s own, our product for AI phone agents, drawn from its code. It’s a drawing, not a live feed, shown because it’s ours to open up, not because voice is all we build.` }, // OWNER
    { term: "The reminder text", detail: "Word for word the reminder this platform texts for its customers’ bookings, taken from its code when the page is built; the time is left out." },
    { term: "The figures", detail: "Counted from its repository by the site’s own tests. A figure with a plus is a floor: the real count is at least that." },
    { term: "The samples", detail: "The kinds of app under ‘Your kind of app’, with their screens and what they ask of the phone, were written for this page, for no business in particular." },
    { term: "The store rules", detail: "Quoted or summarised from Apple’s and Google’s own pages, each linked where it’s used. The stores change them; their pages are the word that counts." },
    { term: "Accreditations and grants", detail: `The accreditations are held by people on the team; the grants were awarded to the company by ${GRANTORS}. Both are shown on the call, on request.` }, // OWNER
    { term: ISNT, detail: "No client names, logos, testimonials, prices, dates, download counts or store ratings appear on this page." }, // publishedCopy() names its exception
    { term: "Anthropic and Claude", detail: "Anthropic and Claude are trademarks of Anthropic, PBC. Naming them is not an endorsement by Anthropic of this page or of any build." },
    // Its own line, naming every Apple mark the page prints, with Apple's own sentence for iOS.
    { term: "Apple", detail: `Apple, iPhone, App Store, App Store Connect, TestFlight, Siri, Swift, SwiftUI and Sign in with Apple are trademarks of Apple Inc., registered in the U.S. and other countries and regions. IOS is a trademark or registered trademark of Cisco in the U.S. and other countries and is used under license. ${COMPANY.name} is not endorsed by Apple.` },
    // Its own line: Google on its own, Google Play, and the Google technologies named.
    { term: "Google", detail: `Google, Android, Google Play, Jetpack Compose and Flutter are trademarks of Google LLC. ${COMPANY.name} works with them and is not endorsed by Google.` },
    // "Or name them where the stores do": D-U-N-S is named, not built on.
    { term: "Other names on this page", detail: `${listJoin(MOB_TRADEMARKS.map(whole))} are trademarks of their respective owners. We build on them, or name them where the stores do; none of them endorses this page or any build we quote.` },
  ],
};

/* ---------- the owner switch ---------- */

/**
 * OWNER: apps this team built and published, each named with its owner's
 * consent and linked to its public store listing. null: none claimed, and
 * no sentence on the page says or implies a past store launch (the test
 * holds it). Setting it changes words only (publishedCopy), never a
 * layout, and fails the reserves test until the page is re-measured
 * (deferred.tsx RESERVES_MEASURED_WITH).
 */
export const PUBLISHED_APPS: readonly PublishedApp[] | null = null; // OWNER

/** A published app's listings, App Store first. */
const listings = (a: PublishedApp) => [a.appStore, a.googlePlay].filter((l): l is Link => l !== null);

/**
 * Pure: today's copy when `apps` is null; the track-record copy when it
 * isn't. Exported for the test. Throws unless every app named links to at
 * least one public listing, and every listing is on apps.apple.com or
 * play.google.com over https: a name the reader can't open isn't proof.
 */
export function publishedCopy(apps: readonly PublishedApp[] | null, base: MobBase): MobBase {
  if (!apps) return base;
  if (apps.length === 0) throw new Error("custom-mobile-applications: PUBLISHED_APPS is empty; set it to null instead");
  for (const a of apps) {
    const ls = listings(a);
    if (ls.length === 0) throw new Error(`custom-mobile-applications: "${a.name}" links to no store listing`);
    for (const l of ls) {
      if (!/^https:\/\/(?:apps\.apple\.com|play\.google\.com)\//.test(l.href)) throw new Error(`custom-mobile-applications: "${a.name}" links off the stores: ${l.href}`);
    }
  }
  const names = listJoin(apps.map((a) => a.name));
  const one = apps.length === 1;
  // Only the stores the listings name: an app on Google Play alone is never said to be in the App Store.
  const inApple = apps.filter((a) => a.appStore).length;
  const inPlay = apps.filter((a) => a.googlePlay).length;
  const where = inPlay === 0 ? "in the App Store" : inApple === 0 ? "on Google Play"
    : inApple === apps.length && inPlay === apps.length ? "in the App Store and on Google Play" : "in the App Store or on Google Play";
  const owners = one ? "its owner’s name" : "their owners’ names";
  return {
    hero: { ...base.hero, proof: [base.hero.proof[0], base.hero.proof[1],
      { label: "Published", term: names, detail: `${cap(where)}, under ${owners}.`, href: "#published" }] },
    path: { ...base.path,
      stages: base.path.stages.map((s) => s.id !== "publish" ? s : { ...s,
        published: `Already ${where} under ${owners}: ${names}.`,
        check: { kind: "site", label: `Open the listing for ${apps[0].name}`, href: listings(apps[0])[0].href } }),
      published: { title: "In the stores already", apps: apps.map((a) => ({ name: a.name, what: a.what, links: listings(a) })) } },
    checks: { ...base.checks, rows: [
      { id: "published", kind: "site", claim: `${one ? "An app we built is" : "Apps we built are"} ${where}, under ${owners}.`,
        how: "Open a listing: the seller shown is the company it was built for.", link: { label: "The listings", href: "#published" } },
      ...base.checks.rows] },
    faq: { ...base.faq, items: base.faq.items.map((i) => i.id !== "proof" ? i : { ...i, a: `${one ? "One is" : "Some are"} already ${where}: ${names}. ${i.a}` }) },
    // "No client names" no longer holds once apps are named: the apps are the one exception, said so.
    credits: { ...base.credits, items: [base.credits.items[0],
      { term: "The apps named", detail: "Named with their owners’ permission; each links to its own store listing." },
      ...base.credits.items.slice(1).map((i) => i.term !== ISNT ? i : { ...i, detail: `Apart from the ${one ? "app" : "apps"} named, ${i.detail.charAt(0).toLowerCase()}${i.detail.slice(1)}` })] },
  };
}

export const MOB_BASE: MobBase = { hero: HERO, path: BASE_PATH, checks: BASE_CHECKS, faq: BASE_FAQ, credits: BASE_CREDITS };
const LIVE_COPY = publishedCopy(PUBLISHED_APPS, MOB_BASE);
export const MOB_HERO = LIVE_COPY.hero;
export const MOB_PATH = LIVE_COPY.path;
export const MOB_CHECKS = LIVE_COPY.checks;
export const MOB_FAQ = LIVE_COPY.faq;
export const MOB_CREDITS = LIVE_COPY.credits;
