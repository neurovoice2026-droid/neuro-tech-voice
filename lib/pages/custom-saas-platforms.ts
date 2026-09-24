import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — every word on the page.
 *
 * The page's argument is that we build complete SaaS platforms, and that
 * the platform the reader is on is one of them. So every claim carries
 * the way to check it — now, in this browser; on the call; or at
 * handover — and every figure is either read from the code or held to it.
 *
 * Read, never retyped, where the source is safe to read: SOLUTION_ITEMS,
 * COMPANY, AUTH, PRICING_TRIAL, SOLUTIONS_MENU, TRUST (by id), HOME_START,
 * AGENT_INTEGRATIONS, CAA_HANDOVER.after, DYNAMIC_APP_ROUTES,
 * VOICE_PIPELINE_MODES, VOICE_TOOL_NAMES, INTERNAL_SIGNATURE_TOLERANCE_SECONDS,
 * WEBHOOK_HEADERS. Retyped in FACTS with a keep-in-step note, and held by
 * lib/pages/custom-saas-platforms.test.ts: counts (floors or exact), cron
 * step names, and constants whose modules pull server graphs (the webhook
 * sender, the Twilio client, the breaker store, the gateway's own config).
 * OWNER-stated (not checkable in the repo): ACCREDITATIONS, GRANTS. Every
 * sentence resting on the owner's word is marked `// OWNER` below.
 *
 * "Take a part down" is worked out by the platform's own routing policy
 * (lib/voice/mode.ts), but not here: mode.ts pulls next/server, the
 * breaker, the budget, kv and the Supabase admin client, so the table is
 * built in custom-saas-platforms.server.ts and this module stays words.
 *
 * This module is server-only. Client islands receive their slice as plain
 * props from the server page and import TYPES only, so nothing here —
 * including the csp.ts graph it reads DYNAMIC_APP_ROUTES from — reaches
 * the browser.
 *
 * No price, date, client, logo, testimonial or badge appears. The
 * accreditations are personal and the grants are the company's; neither
 * is a certification, and the page says so in the homepage's own words.
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true. The module
 * evaluates top to bottom, so PARTS, LENSES, DOWN and SCOPE_PARTS are
 * declared before the section consts that hold them.
 * ------------------------------------------------------------------ */
import { AUTH, COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU, TRUST } from "@/lib/site";
import { sentences } from "@/lib/pages/home/source";
import { HOME_START } from "@/lib/pages/home/start";
import { AGENT_INTEGRATIONS } from "@/lib/pages/ai-agents";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { DYNAMIC_APP_ROUTES } from "@/lib/security/csp";
import { INTERNAL_SIGNATURE_TOLERANCE_SECONDS, VOICE_PIPELINE_MODES } from "@/lib/voice/contracts";
import { VOICE_TOOL_NAMES } from "@/lib/voice/tools/definitions"; // imports types only
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload";

/* ---------- guards ---------- */

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms");
if (!ITEM) throw new Error("SOLUTION_ITEMS lost custom-saas-platforms");
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
if (!CAA_ITEM) throw new Error("SOLUTION_ITEMS lost custom-ai-agents");
// The hero plates and the scope layers carry per-layer copy: re-map them if the menu's layers change.
if (ITEM.stack.join("|") !== "Web app|Database|Payments|Hosting") throw new Error("custom-saas-platforms: ITEM.stack changed");
// The build stages and "What you get" are the menu's three deliverables, one each, in order.
if (ITEM.deliverables.length !== 3) throw new Error("custom-saas-platforms: ITEM.deliverables changed shape");

// TRUST is read by id, never by position: a reordered band must not move
// a quote onto the wrong sentence.
const trustNote = (id: string) => {
  const t = TRUST.items.find((i) => i.id === id);
  if (!t) throw new Error(`custom-saas-platforms: TRUST lost "${id}"`);
  return t.note;
};
/** "There is no certification badge on this site, because we hold none." */
export const TRUST_QUOTE = sentences(trustNote("company"), 2, 3);
if (!TRUST_QUOTE.includes("we hold none")) throw new Error("custom-saas-platforms: TRUST no longer says we hold none");
if (!trustNote("eu").includes("eu-west-1, Ireland")) throw new Error("custom-saas-platforms: the EU region moved");

// "Ten screens and a four-screen onboarding": the signed-in screens are the
// per-request routes csp.ts keeps in step with app/(dashboard), less
// onboarding, which is counted apart. A screen added or removed there must
// be named here too, or the sentence would list the wrong ones.
if (!DYNAMIC_APP_ROUTES.includes("/onboarding")) throw new Error("custom-saas-platforms: onboarding left DYNAMIC_APP_ROUTES");
const SCREENS = DYNAMIC_APP_ROUTES.length - 1; // 10: the signed-in screens, onboarding apart
const SCREEN_NAMES = ["the overview", "calls", "inbox", "the agent", "phone numbers", "integrations",
  "workflows", "voice lab", "billing", "settings"] as const;
if (SCREEN_NAMES.length !== SCREENS) throw new Error("custom-saas-platforms: a dashboard screen was added or removed");

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "a, b and c": no Oxford comma, as on /solutions/custom-ai-agents. */
export const listJoin = (xs: readonly string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
// Every title's coloured phrase (HomeHeading `titleKey`) must be copied
// from the title itself, and never be its first word.
const keyed = <T extends { title: string; key: string }>(s: T): T => {
  if (s.title.lastIndexOf(s.key) <= 0) throw new Error(`custom-saas-platforms: "${s.key}" is not in "${s.title}"`);
  return s;
};

/* ---------- facts ---------- */

/**
 * Retyped, each held by the test. Floors print with "+", so adding a route
 * or a test file never breaks the page. The test holds floor ≤ count and
 * floor ≥ 0.75 × count. Migrations, Stripe events and cron steps are exact.
 */
export const FACTS = {
  routeHandlers: 80, // FLOOR. app/api/**/route.ts (85 at e9e5d5e)
  testFiles: 120, // FLOOR. *.test.ts(x) repo-wide (127 with this page's test)
  migrations: 12, // EXACT. supabase/migrations/*.sql
  stripeEvents: 7, // EXACT. `case '…':` in app/api/billing/webhook/route.ts
  cronSteps: ["reconcile_unbilled_calls", "roll_usage_periods", "report_overage", "booking_reminders",
    "resync_stale_agents", "purge_expired_kv", "purge_orphan_uploads", "warm_cartesia_budget"], // EXACT, route order
  cronAt: "07:00 UTC", // vercel.json "0 7 * * *"
  webhookAttempts: 3, // = WEBHOOK_MAX_ATTEMPTS (lib/workflows/webhook.ts, server-only)
  transferCapMinutes: 60, // = TRANSFER_TIME_LIMIT_SECONDS / 60 (lib/twilio/calls.ts, server-only)
  breakerFailures: 3, // = BREAKER_CONSECUTIVE_FAILURES
  breakerOpenSeconds: 30, // = BREAKER_BASE_OPEN_MS / 1000
  breakerMaxMinutes: 5, // = BREAKER_MAX_OPEN_MS / 60000
  resyncBatch: 25, // = RESYNC_BATCH (lib/voice/sync/index.ts)
  sttReplaySeconds: 2, // = sttReplayBufferMs / 1000 (services/voice-gateway/src/config.ts)
  drainSeconds: 30, // = SHUTDOWN_DRAIN_SECONDS (services/voice-gateway/fly.toml)
  nextMajor: 16, // = major of package.json dependencies.next
  nodeMajor: 22, // = gateway engines.node ">=22" and Dockerfile NODE_VERSION
} as const;

const MODES = VOICE_PIPELINE_MODES.length; // 3
const TOOLS = VOICE_TOOL_NAMES.length; // 14
const SIGNATURE_MINUTES = INTERNAL_SIGNATURE_TOLERANCE_SECONDS / 60; // 5

/* ---------- credentials (OWNER-stated) ---------- */

export type Link = { label: string; href: string };

/** OWNER: owner-stated; keep in step with the certificates on file. Personal, never the company's. */
export const ACCREDITATIONS = {
  issuer: "Anthropic",
  subject: "Claude",
  count: 20,
  orMore: true,
  holders: "personal",
  /** OWNER: a public link to the certificates, if one exists. While null, the check is "on the call". */
  verify: null as Link | null,
} as const;

export type GrantId = "cartesia" | "elevenlabs"; // extend the union to add a grantor; every sentence is generated
export type Grant = {
  id: GrantId;
  grantor: string;
  /** The map part where its technology runs on this platform. */
  part: "cartesia" | "elevenlabs";
  /** Short role, used in "Cartesia on the main path of a call". */
  role: string;
  /** "Where it runs here". */
  runs: string;
  /** OWNER: a public link, if one exists. */
  verify: Link | null;
};

/**
 * OWNER: startup grants awarded to the company. No amounts, no dates, no
 * other grantors. Every sentence that names them is built from this list
 * with listJoin, so the copy reads true for one, two or three grantors:
 * no "both", no "etc.".
 */
export const GRANTS: readonly Grant[] = [
  {
    id: "cartesia", grantor: "Cartesia", part: "cartesia", role: "on the main path of a call", verify: null,
    runs: "The main path of a call on this platform: its speech recognition hears the caller and its voice speaks the reply.",
  },
  {
    id: "elevenlabs", grantor: "ElevenLabs", part: "elevenlabs", role: "as its fallback", verify: null,
    runs: "The fallback on this platform: its voice, its speech recognition or a standby agent takes over when Cartesia can’t.",
  },
];
const GRANTORS = listJoin(GRANTS.map((g) => g.grantor)); // "Cartesia and ElevenLabs"
const ACC = `${ACCREDITATIONS.count}+`; // "20+"

/* ---------- shared types ---------- */

export const SECTION_IDS = ["top", "credentials", "platform", "scope", "prototype", "build", "terms", "checks", "faq", "start"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export type CheckKind = "site" | "call" | "handover";
/** A way to check a claim. `how` is a path to follow; `href` makes the label a link. */
export type Check = { kind: CheckKind; label: string; how?: string; href?: string };

/* Explorer */
export type LayerId = "people" | "edge" | "app" | "calls" | "services";
export type PartId = "caller" | "customer" | "twilio" | "proxy" | "router" | "dashboard" | "api" | "workflows"
  | "cron" | "gateway" | "cartesia" | "openai" | "elevenlabs" | "supabase" | "stripe" | "smartbill" | "google";
export type EdgeId = "caller-twilio" | "twilio-router" | "router-gateway" | "gateway-openai" | "gateway-cartesia"
  | "gateway-elevenlabs" | "customer-proxy" | "proxy-dashboard" | "proxy-api" | "dashboard-stripe" | "stripe-api"
  | "api-supabase" | "api-smartbill" | "api-google" | "api-workflows" | "workflows-google" | "twilio-api"
  | "router-elevenlabs" | "cron-api" | "gateway-api";
export type Part = { id: PartId; layer: LayerId; label: string; datum: string; does: string; facts?: string; grant?: true; check?: Check };
export type Hop = EdgeId | { edge: EdgeId; reverse: true };
export type Step = {
  id: string; text: string; hops?: readonly Hop[]; ring?: readonly PartId[];
  fault?: PartId; voice?: "cartesia" | "elevenlabs"; cron?: string; check?: Check;
};
export type TourLensId = "signup" | "call" | "failover" | "nightly";
export type LensId = TourLensId | "down";
export type Lens = { id: TourLensId; label: string; foot?: string; steps: readonly Step[] };
export type RouteMode = "cartesia_self" | "cartesia_managed" | "elevenlabs";
export type DownReason = "credits_available" | "gateway_breaker_open" | "credits_exhausted" | "self_breaker_open" | "managed_breaker_open";
export type DownSwitchId = "gateway" | "credits" | "self" | "managed";
export type DownRow = { mask: number; mode: RouteMode; reason: DownReason };
export type DownCopy = {
  label: string; groupLabel: string;
  switches: readonly { id: DownSwitchId; label: string; bit: 1 | 2 | 4 | 8 }[];
  reset: string; resultLabel: string; downTag: string;
  modes: Record<RouteMode, { name: string; via: string }>;
  whys: Record<DownReason, string>;
  routes: Record<RouteMode, readonly EdgeId[]>;
  arrives: Record<RouteMode, PartId>;
  source: string; sourcePath: string; foot: string; live: string;
};
export type ExplorerData = {
  eyebrow: string; title: string; key: string; sub: string; tag: string;
  lensesAria: string; stepsAria: string;
  transport: { play: string; pause: string; replay: string };
  stepOf: string; stepsTitle: string; partTitle: string; hint: string; onPaths: string; showIt: string;
  indexSummary: string; speaking: string; grant: string; grantLink: Link; failed: string; live: string;
  kinds: Record<CheckKind, string>;
  layers: Record<LayerId, string>;
  parts: readonly Part[];
  lenses: readonly Lens[];
  initial: TourLensId;
  down: DownCopy;
  foot: string;
};

/* Scope */
export type NeedId = "teams" | "staff" | "plans" | "usage" | "connect" | "import" | "live" | "region";
export type NeedGroupId = "who" | "charges" | "touches" | "holds";
export type ScopePartId = "auth" | "screens" | "policy" | "teams" | "admin" | "connect" | "data" | "schema"
  | "import" | "region" | "plans" | "fiscal" | "usage" | "hosting" | "jobs" | "watch" | "live";
export type OursKind = "does" | "thin" | "none";
export type ScopePart = {
  id: ScopePartId; label: string;
  /** Empty: always built (the bones). Otherwise built when ANY of these needs is on. */
  needs: readonly NeedId[];
  breaks: string; ours: string; kind: OursKind; check?: Check; map?: PartId;
};
export type ScopeData = {
  eyebrow: string; title: string; key: string; sub: string;
  needsTitle: string; partsAria: string; checkKinds: Record<CheckKind, string>;
  groups: readonly { id: NeedGroupId; label: string }[];
  needs: readonly { id: NeedId; group: NeedGroupId; label: string }[];
  initial: readonly NeedId[];
  initialPart: ScopePartId;
  layers: readonly { name: string; parts: readonly ScopePartId[] }[];
  parts: readonly ScopePart[];
  summary: { some: string; none: string };
  tags: { always: string; added: string; off: string };
  kinds: Record<OursKind, string>;
  inspector: { title: string; breaks: string; ours: string; map: string };
  live: { added: string; removed: string };
  foot: string;
};

/* Prototype */
export type ProtoScreenId = "signup" | "overview" | "plans";
export type ProtoBlock = { kind: "field" | "card" | "plan"; label: string } | { kind: "chart" };
export type ProtoHotspot = { label: string; to: ProtoScreenId; dir: "forward" | "back"; aria: string };
export type ProtoScreen = { id: ProtoScreenId; n: 1 | 2 | 3; step: string; title: string; blocks: readonly ProtoBlock[]; hotspots: readonly ProtoHotspot[] };
export type PrototypeData = {
  eyebrow: string; title: string; key: string; sub: string;
  tag: string; product: string; frameAria: string; toggle: string; hint: string; live: string; restart: string;
  settles: { title: string; items: readonly string[] };
  foot: string;
  screens: readonly ProtoScreen[];
};

/* Build, terms, checks, FAQ, start, credits */
export type BuildStage = { id: "prototype" | "platform" | "handover"; n: "01" | "02" | "03"; title: string; body: string; hold: string; ours?: string; check: Check };
export type BuildData = { eyebrow: string; title: string; key: string; sub: string; labels: { stage: string; hold: string; ours: string }; checkKinds: Record<CheckKind, string>; stages: readonly BuildStage[] };
export type TermsData = { eyebrow: string; title: string; key: string; sub: string; columns: readonly { id: "sets" | "need" | "get" | "upfront"; head: string; items: readonly string[] }[]; after: string; links: readonly Link[] };
export type CheckRow = { id: string; kind: CheckKind; claim: string; how: string; link?: Link };
export type ChecksData = {
  eyebrow: string; title: string; key: string; sub: string;
  filtersAria: string; filters: readonly { id: "all" | CheckKind; label: string }[];
  kinds: Record<CheckKind, string>; showing: string; rows: readonly CheckRow[];
  missing: { label: string; body: string; cta: Link };
};
export type FaqItem = { id: string; q: string; a: string; where?: Link };
export type FaqData = { eyebrow: string; title: string; key: string; keyTone: "quiet"; talk: Link; phone: string; items: readonly FaqItem[] };
export type HeroData = {
  eyebrow: string; title: string; key: string; sub: string; primary: Link; secondary: Link; note: string;
  room: { tag: string; plates: readonly { layer: string; name: string; runs: string; datum: string }[]; foot: string; link: Link };
  proofLabel: string; proof: readonly { label: string; term: string; detail: string; href: string }[];
};
export type CredentialsData = {
  eyebrow: string; title: string; key: string; sub: string; checkKinds: Record<CheckKind, string>;
  accreditations: { label: string; figure: string; caption: string; title: string; body: string; isnt: string; check: Check };
  grants: { label: string; kind: string; whereLabel: string; mapLink: string; isnt: string; check: Check;
    rows: readonly { id: GrantId; grantor: string; part: PartId; runs: string }[] };
  none: { label: string; text: string; link: Link };
};
export type StartData = { eyebrow: string; title: string; key: string; body: string; primary: Link; secondary: Link; note: string };
export type CreditsData = { title: string; items: readonly { term: string; detail: string }[] };

/* ---------- shared copy ---------- */

// Held to csp.ts by the test: its static branch really does carry
// 'unsafe-inline', so the page never calls a prerendered policy "strict".
const CSP_POLICIES =
  "signed-in screens get a fresh nonce on every request; prerendered pages like this one can’t carry a nonce, so they get a host allowlist that still permits inline scripts";
const CSP_HOW = "Developer tools → Network → this page → Response headers → Content-Security-Policy.";
// There is no /contact page and no form: a build starts with a phone call.
const CALL: Link = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref }; // "Call us about a build"
/** The three ways a claim is checked, as the check lines print them. Passed as `checkKinds` / `kinds`. */
export const CHECK_KINDS: Record<CheckKind, string> = { site: "Now, in this browser", call: "On the call", handover: "At handover" };

/* ---------- meta ---------- */

export const SAAS_META = {
  title: "Custom SaaS Platforms — built end to end, like the one you’re on",
  description:
    "Complete SaaS platforms — a prototype you click first, then accounts, billing, admin, hosting and the code handed over — built by the team behind this platform. Quoted after a phone call.",
} as const;

/* ---------- #top: hero ---------- */

export const SAAS_HERO: HeroData = keyed({
  eyebrow: ITEM.label, // "Custom SaaS Platforms"
  title: "We build complete SaaS platforms. You’re on one of them.",
  key: "You’re on one of them.",
  sub: `${ITEM.description} We design and build the whole platform, whatever the complexity: a prototype you can click first, then accounts, billing, admin, hosting and the hard parts in between — with the code handed over. The proof is the platform behind this site, built by the same team.`,
  primary: CALL,
  secondary: { label: "Explore the platform", href: "#platform" },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  room: {
    tag: "Under this site",
    // One plate per layer of the menu's `stack`, in its order (guarded above).
    plates: [
      { layer: ITEM.stack[0], name: `Next.js ${FACTS.nextMajor} on Vercel`, runs: "This site, sign-up, onboarding, the dashboard and its API", datum: `${FACTS.routeHandlers}+ route handlers` },
      { layer: ITEM.stack[1], name: "Supabase Postgres", runs: "Row-level security, sign-in and file storage, in the EU", datum: `${FACTS.migrations} migrations` },
      { layer: ITEM.stack[2], name: "Stripe and SmartBill", runs: "Subscriptions, checkout, the customer portal and fiscal invoices", datum: `${FACTS.stripeEvents} webhook events` },
      { layer: ITEM.stack[3], name: "Vercel and Fly.io", runs: `An always-on voice gateway on Node.js ${FACTS.nodeMajor}, and a daily job at ${FACTS.cronAt}`, datum: `${FACTS.cronSteps.length} nightly steps` },
    ],
    foot: "Counted from the repository by the site’s own tests. A plus means at least.",
    link: { label: "Explore it", href: "#platform" },
  },
  proofLabel: "The evidence on this page",
  proof: [
    { label: "Accreditations", term: `${ACC} Claude accreditations`, detail: "From Anthropic, held personally by the people who build.", href: "#credentials" },
    { label: "Startup grants", term: GRANTORS, detail: "Awarded to our company.", href: "#credentials" },
    { label: "The large project", term: "This platform", detail: "Built by us, and drawn from its code below.", href: "#platform" },
  ],
});

/* ---------- #credentials ---------- */

// While there is no public link, the accreditations are shown on the call.
const accCheck: Check = ACCREDITATIONS.verify
  ? { kind: "site", label: "See the accreditations", href: ACCREDITATIONS.verify.href }
  : { kind: "call", label: "Ask to see them on the call." }; // OWNER: that we show them on request
// The first grant with a public link turns the grants' check into a site link.
const grantLink = GRANTS.find((g) => g.verify)?.verify;

export const SAAS_CREDENTIALS: CredentialsData = keyed({
  eyebrow: "Who builds it",
  title: `The people who build it hold ${ACC} Claude accreditations`,
  key: `${ACC} Claude accreditations`,
  sub: `Personal accreditations from Anthropic, and startup grants from ${GRANTORS}. What each one is, what it isn’t, and how to see it.`,
  checkKinds: CHECK_KINDS,
  accreditations: {
    label: "Personal accreditations",
    figure: ACC, // "20+"
    caption: "Claude accreditations, from Anthropic",
    title: "Held by the people who build, not by the company",
    // OWNER: confirm what they cover ("about building with Claude").
    body: "Each one belongs to the person who earned it: the same people who would design and build your platform. They’re about building with Claude, Anthropic’s AI.",
    isnt: "They’re personal. They aren’t a security or compliance certification of our company.",
    check: accCheck,
  },
  grants: {
    label: "Startup grants",
    kind: "Startup grant · awarded to our company",
    whereLabel: "Where it runs here",
    mapLink: "See it on the map",
    isnt: "A grant is support from the company that awards it. It isn’t an endorsement of this page, or of any build we quote.",
    check: grantLink
      ? { kind: "site", label: "See the grants", href: grantLink.href }
      : { kind: "call", label: "Ask to see them on the call." }, // OWNER
    rows: GRANTS.map((g) => ({ id: g.id, grantor: g.grantor, part: g.part, runs: g.runs })),
  },
  none: {
    label: "What none of these is",
    text: `None of them is a certification of the company. The homepage says it plainly: “${TRUST_QUOTE}”`,
    link: { label: "What you can check about the company", href: "/#trust" },
  },
});

/* ---------- #platform: the explorer ---------- */

// The seventeen parts of the drawing. Labels stay ≤ 14 characters and
// datums ≤ 16 (the cards are 140×44u), and every number is interpolated
// from FACTS or a read source. Telnyx, KV and Drive are left off on
// purpose: the runbook's architecture is Twilio only, and 17 stays legible.
const PARTS: readonly Part[] = [
  { id: "caller", layer: "people", label: "A caller", datum: "any phone",
    does: "Rings a business’s number. Nothing to install, nothing to sign up for." },
  { id: "customer", layer: "people", label: "A business", datum: "a browser",
    does: "Signs up, sets up its agent and pays — all in the browser." },
  { id: "twilio", layer: "edge", label: "Twilio", datum: "numbers · texts",
    does: `Rents the phone numbers, asks the app what to do with every call, reports how each one went, and carries texts. Before it dials out, the app refuses premium-rate and shared-cost numbers, and it cuts a transferred call at ${FACTS.transferCapMinutes} minutes.` },
  { id: "proxy", layer: "edge", label: "Proxy", datum: "sessions · CSP",
    does: `Runs before every page and API request: refreshes the session, keeps signed-out visitors out of the dashboard, and gives every page its security policy — ${CSP_POLICIES}.`,
    check: { kind: "site", label: "Check this page’s policy", how: CSP_HOW } },
  { id: "router", layer: "app", label: "Call router", datum: `${MODES} modes`,
    does: "Answers Twilio within seconds and picks how to run each call: our own pipeline on Cartesia, Cartesia’s managed agent, or ElevenLabs’ standby agent — skipping any path whose breaker is open or whose budget is spent." },
  { id: "dashboard", layer: "app", label: "Dashboard", datum: `${SCREENS} screens`,
    does: `Onboarding in four screens, then ${word(SCREENS)} screens: ${listJoin(SCREEN_NAMES)}.`,
    check: { kind: "site", label: "Walk through it on the free trial", href: PRICING_TRIAL.href } },
  { id: "api", layer: "app", label: "API", datum: `${FACTS.routeHandlers}+ routes`,
    does: `${FACTS.routeHandlers}+ route handlers, from accounts and billing to telephony and the voice gateway’s calls back to the app. Machine callers — Twilio, Stripe, ElevenLabs, the gateway and the daily job — prove who they are with signatures or secrets, never cookies.` },
  { id: "workflows", layer: "app", label: "Workflows", datum: `signed · ${FACTS.webhookAttempts} tries`,
    does: `Rules that fire after a call on what happened: a signed webhook — tried up to ${word(FACTS.webhookAttempts)} times, https only, never to a private address — a Slack post, an email, a row in Google Sheets.` },
  { id: "cron", layer: "app", label: "Daily job", datum: `${FACTS.cronAt}`,
    does: `One job, called by Vercel Cron at ${FACTS.cronAt}. Its ${word(FACTS.cronSteps.length)} steps run on their own, so one failing never stops the others, and each is safe to run twice.` },
  { id: "gateway", layer: "calls", label: "Voice gateway", datum: `Node.js ${FACTS.nodeMajor}`,
    does: `An always-on service that holds each live call open — which a serverless function can’t — and runs speech in, the conversation and voice out. What it sends the app is signed, and a signature more than ${word(SIGNATURE_MINUTES)} minutes old is refused. On a deploy, calls get up to ${FACTS.drainSeconds} seconds to finish.`,
    facts: "Its own tests cover the failover, against simulated providers." },
  { id: "cartesia", layer: "calls", label: "Cartesia", datum: "hears and speaks", grant: true,
    does: "The main path: Cartesia’s speech recognition hears the caller and its voice speaks the reply. Its managed agents are a second way to run a call." },
  { id: "openai", layer: "calls", label: "OpenAI", datum: `${TOOLS} tools`,
    does: `Writes each reply and decides when to use a tool — ${word(TOOLS)} of them, from checking the diary to putting the call through — and summarises every call afterwards.` },
  { id: "elevenlabs", layer: "calls", label: "ElevenLabs", datum: "the fallback", grant: true,
    does: "The fallback at every level: its voice or its speech recognition can take over mid-call, and a standby agent can take the whole call." },
  { id: "supabase", layer: "services", label: "Supabase", datum: `${FACTS.migrations} migrations`,
    does: "The database, sign-in and file storage, in eu-west-1 (Ireland). Row-level security keeps each business’s rows to itself, and a database trigger keeps plan and billing columns out of a customer’s own reach." },
  { id: "stripe", layer: "services", label: "Stripe", datum: `${FACTS.stripeEvents} events`,
    does: `Checkout, the customer portal, and a signed webhook that keeps the plan in step on ${word(FACTS.stripeEvents)} kinds of event. Card numbers never reach our servers.` },
  { id: "smartbill", layer: "services", label: "SmartBill", datum: "fiscal invoices",
    does: "Turns each paid Stripe invoice into one Romanian fiscal invoice — however often the webhook retries." },
  { id: "google", layer: "services", label: "Google", datum: "Calendar, Sheets",
    does: "With the business’s own Google account: bookings go into Calendar during a call, and after it, workflows can add a row to Sheets." },
];

// The four tours. Each hop names an edge of the drawing (map-geometry.ts);
// `ring` pulses parts a step touches without travelling to them; `fault`
// marks the part that failed; `voice` is who speaks from that step on; the
// nightly lens's `cron` fields are the daily route's step names, in order.
const LENSES: readonly Lens[] = [
  { id: "signup", label: "A business signs up and pays", steps: [
    { id: "open", hops: ["customer-proxy"], text: "A business opens the sign-up page. The proxy runs first and gives the page its security policy.",
      check: { kind: "site", label: "Open the sign-up page", href: AUTH.signup } },
    { id: "account", hops: ["proxy-api", "api-supabase"], text: "The app creates the account in Supabase and signs them in." },
    { id: "onboard", hops: ["proxy-dashboard"], text: `Onboarding. ${HOME_START.body}`,
      check: { kind: "site", label: "Walk through it on the free trial", href: PRICING_TRIAL.href } },
    { id: "checkout", hops: ["dashboard-stripe"], text: "Picking a plan opens Stripe Checkout. The card number goes to Stripe and never reaches our servers." },
    { id: "webhook", hops: ["stripe-api"], text: `Stripe’s signed webhook comes back. ${cap(word(FACTS.stripeEvents))} kinds of event keep the plan and the invoices in step.` },
    { id: "plan", hops: ["api-supabase"], text: "The server writes the plan. A trigger in the database keeps a customer’s own session from changing it." },
    { id: "invoice", hops: ["api-smartbill"], text: "A paid invoice becomes one fiscal invoice in SmartBill, however often the webhook retries." },
  ] },
  { id: "call", label: "A phone call comes in", steps: [
    { id: "ring", hops: ["caller-twilio"], text: "Someone rings the business’s number." },
    { id: "route", hops: ["twilio-router"], text: `Twilio asks the app what to do. The router picks one of ${word(MODES)} ways to run this call.` },
    { id: "stream", hops: ["router-gateway"], voice: "cartesia", text: "The call streams to the voice gateway, with a session token the app has signed." },
    { id: "hear", hops: ["gateway-cartesia"], text: "Cartesia hears the caller and turns speech into text." },
    { id: "think", hops: ["gateway-openai"], text: `OpenAI writes the reply, and uses a tool when it needs one: ${word(TOOLS)} of them, from checking the diary to putting the call through.` },
    { id: "book", hops: ["gateway-api", "api-google"], text: "The tool runs in the app over a signed request. A booking goes into Google Calendar, checked again just before it’s written." },
    { id: "speak", hops: ["gateway-cartesia"], text: "Cartesia speaks the reply. If the caller talks over it, it stops, and the transcript keeps only what they heard." },
    { id: "end", hops: ["gateway-api", "api-supabase", "twilio-api"], text: "The call ends. The transcript and a summary are saved, and Twilio’s own record bills the minutes, once." },
    { id: "after", hops: ["api-workflows", "workflows-google"], text: "Workflows fire on what happened: a signed webhook, a Slack post, a row in Google Sheets." },
  ] },
  { id: "failover", label: "A voice provider fails", foot: "Covered by the gateway’s failover tests, against simulated providers.", steps: [
    { id: "fault", hops: ["gateway-cartesia"], fault: "cartesia", voice: "cartesia", text: "Mid-call, Cartesia’s voice returns an error." },
    { id: "switch", hops: ["gateway-elevenlabs"], fault: "cartesia", voice: "elevenlabs", text: "The gateway switches to ElevenLabs’ voice for the rest of the call, and says again what the caller didn’t hear." },
    { id: "ears", hops: ["gateway-elevenlabs"], text: `If it’s the speech recognition that fails instead, ElevenLabs’ own takes over, replaying the caller’s last ${word(FACTS.sttReplaySeconds)} seconds.` },
    { id: "model", hops: ["gateway-openai", "gateway-elevenlabs"], fault: "openai", text: "If OpenAI fails before anything was said, the whole call goes to a standby ElevenLabs agent, with the conversation so far." },
    { id: "breaker", ring: ["router"], text: `${cap(word(FACTS.breakerFailures))} hard failures in a row open a breaker: new calls skip that path for ${FACTS.breakerOpenSeconds} seconds, then longer each time, up to ${word(FACTS.breakerMaxMinutes)} minutes.` },
    { id: "gateway", hops: ["twilio-router", "router-elevenlabs"], fault: "gateway", text: "If the gateway can’t carry on, it lets go of the call without hanging up, and the app hands the caller to ElevenLabs." },
    { id: "router", hops: ["twilio-router", "router-elevenlabs"], fault: "router", text: "If the app fails to answer Twilio at all, the number’s fallback route goes straight to ElevenLabs." },
    { id: "billed", hops: ["twilio-api"], text: "However the call ended up being carried, it’s billed once, from Twilio’s own record." },
  ] },
  { id: "nightly", label: `Every morning at ${FACTS.cronAt}`, foot: "A step that fails shows in the logs and never stops the others.", steps: [
    { id: "wake", hops: ["cron-api"], text: `Vercel Cron calls the daily job at ${FACTS.cronAt}, with a secret. Its ${word(FACTS.cronSteps.length)} steps run on their own, and each is safe to run twice.` },
    { id: "reconcile", cron: "reconcile_unbilled_calls", hops: ["api-supabase"], text: "Bills any answered call whose billing didn’t finish — with the same key, so never twice." },
    { id: "roll", cron: "roll_usage_periods", hops: ["api-supabase"], text: "Starts the next usage period for paid plans." },
    { id: "overage", cron: "report_overage", hops: [{ edge: "stripe-api", reverse: true }], text: "Reports minutes past the allowance to Stripe." },
    { id: "reminders", cron: "booking_reminders", hops: [{ edge: "twilio-api", reverse: true }], text: "Texts appointment reminders." },
    { id: "resync", cron: "resync_stale_agents", ring: ["cartesia", "elevenlabs"], text: `Re-syncs up to ${FACTS.resyncBatch} agents whose copy at Cartesia or ElevenLabs is missing or out of date.` },
    { id: "purge", cron: "purge_expired_kv", hops: ["api-supabase"], text: "Deletes expired locks and flags." },
    { id: "uploads", cron: "purge_orphan_uploads", hops: ["api-supabase"], text: "Removes day-old uploads that nothing uses." },
    { id: "budget", cron: "warm_cartesia_budget", ring: ["cartesia"], text: "Refreshes the cached Cartesia budget." },
  ] },
];

// "Take a part down": the copy only. The sixteen answers come from
// buildDownTable() in custom-saas-platforms.server.ts, which runs the
// platform's own decideMode for every mask and throws if a reason it
// returns has no sentence in `whys`. Bits: gateway 1, credits 2, self 4,
// managed 8.
const DOWN: DownCopy = {
  label: "Take a part down",
  groupLabel: "Take parts down",
  switches: [
    { id: "gateway", label: "Voice gateway down", bit: 1 },
    { id: "credits", label: "Cartesia credits used up", bit: 2 },
    { id: "self", label: "Our own pipeline failing", bit: 4 },
    { id: "managed", label: "Cartesia’s managed agents failing", bit: 8 },
  ],
  reset: "Put everything back",
  resultLabel: "The next call goes to",
  downTag: "Down",
  modes: {
    cartesia_self: { name: "Our own pipeline", via: "Cartesia hears, OpenAI replies, Cartesia speaks — on our gateway" },
    cartesia_managed: { name: "Cartesia’s managed agent", via: "Bridged through our gateway" },
    elevenlabs: { name: "The ElevenLabs standby agent", via: "Straight from the app, with no gateway needed" },
  },
  whys: {
    credits_available: "Its first choice is up, so the call takes it.",
    gateway_breaker_open: "Both Cartesia routes run through the voice gateway, so with it down the call goes straight to the standby agent.",
    credits_exhausted: "This cycle’s Cartesia credits are used up, so the call skips our own pipeline for the managed agent.",
    self_breaker_open: "Our own pipeline has failed enough times in a row to be taken out of the path, so the call goes to the managed agent.",
    managed_breaker_open: "Both Cartesia routes are out, so the call goes to the standby agent.",
  },
  routes: {
    cartesia_self: ["caller-twilio", "twilio-router", "router-gateway", "gateway-cartesia", "gateway-openai"],
    cartesia_managed: ["caller-twilio", "twilio-router", "router-gateway", "gateway-cartesia"],
    elevenlabs: ["caller-twilio", "twilio-router", "router-elevenlabs"],
  },
  arrives: { cartesia_self: "cartesia", cartesia_managed: "cartesia", elevenlabs: "elevenlabs" },
  source: "Worked out by the platform’s own routing code, for every combination of switches.",
  sourcePath: "lib/voice/mode.ts",
  foot: "Nothing here is really down.",
  live: "The next call goes to {name}. {why}",
};

export const SAAS_PLATFORM: ExplorerData = keyed({
  eyebrow: "The large project",
  title: "The platform behind this site, drawn from its code",
  key: "drawn from its code",
  sub: "Pick something that happens — a business signing up, a phone call, a provider failing, the morning’s jobs — and follow it through the parts that handle it. It’s a drawing of the code, not a live feed, and every figure on it is counted from the repository.",
  tag: "Drawn from the code · not a live feed",
  lensesAria: "What happens",
  stepsAria: "Every step",
  transport: { play: "Play it", pause: "Pause", replay: "Play it again" },
  stepOf: "Step {n} of {total}",
  stepsTitle: "Every step",
  partTitle: "The part",
  hint: "Pick a part on the drawing to see what it does.",
  onPaths: "On these paths",
  showIt: "Show it on the drawing",
  indexSummary: "All {n} parts, in words",
  speaking: "Speaking",
  grant: "Grant",
  grantLink: { label: "About the grant", href: "#credentials" },
  failed: "Failed",
  live: "Step {n} of {total}: {text}",
  kinds: CHECK_KINDS,
  layers: { people: "People", edge: "Carriers and the edge", app: "The app · on Vercel", calls: "Live calls · on Fly.io", services: "Services it relies on" },
  parts: PARTS,
  lenses: LENSES,
  // The SaaS-relevant tour, not the phone call: this page sells platforms.
  initial: "signup",
  down: DOWN,
  foot: "Drawn by us from the platform’s code. The failover is covered by the gateway’s tests against simulated providers; the providers themselves were checked against their documentation, and Cartesia’s speech and voice were checked live.",
});

/* ---------- #scope ---------- */

// The seventeen parts a platform can take, across the menu's four layers.
// Eight are the bones (`needs: []`); the rest are built when any of their
// needs is on. Each leads with the plain "what usually breaks" before
// "what ours does", and where our platform proves nothing the `ours` line
// opens with "Thin on ours" or "Not on ours" — the test holds both.
const SCOPE_PARTS: readonly ScopePart[] = [
  { id: "auth", label: "Sign-up and sign-in", needs: [], kind: "does", map: "proxy",
    breaks: "A page that believes the browser about who’s asking.",
    ours: "A proxy refreshes the session on every request, and every page, route and action checks it again on the server." },
  { id: "screens", label: "Your product’s own screens", needs: [], kind: "does", map: "dashboard",
    breaks: "Nothing a template could save you from: this is the part only yours has.",
    ours: `${cap(word(SCREENS))} screens and a four-screen onboarding, served by the same app as this page.`,
    check: { kind: "site", label: "Walk through them on the free trial", href: PRICING_TRIAL.href } },
  { id: "policy", label: "A security policy on every page", needs: [], kind: "does", map: "proxy",
    breaks: "A script slipped into a page, running as if it were yours.",
    ours: `Two policies, chosen per route: ${CSP_POLICIES}.`,
    check: { kind: "site", label: "Check it now", how: CSP_HOW } },
  { id: "teams", label: "Teams and roles", needs: ["teams"], kind: "none",
    breaks: "A member who can see what only an owner should.",
    ours: "Not on ours: each business account on it has a single owner. Roles for yours are designed from the prototype on." },
  { id: "admin", label: "An admin for your staff", needs: ["staff"], kind: "thin",
    breaks: "Fixing a customer’s account by hand, in the database.",
    ours: "Thin on ours: owner settings, and a status check its operators use. Yours gets a real admin." },
  { id: "connect", label: "Integrations and webhooks", needs: ["connect"], kind: "does", map: "workflows",
    breaks: "A webhook anyone can forge, or one pointed back at your own network.",
    ours: `Google Calendar and Sheets with the customer’s own account, and outgoing webhooks that carry an ${WEBHOOK_HEADERS.signature} header, are tried up to ${word(FACTS.webhookAttempts)} times, go out over https only, and are refused if their address resolves to a private network.` },
  { id: "data", label: "Each customer’s data, walled off", needs: [], kind: "does", map: "supabase",
    breaks: "One customer seeing another’s rows.",
    ours: "Row-level security keeps each business’s rows to itself, and a database trigger keeps plan and billing columns out of a customer’s own reach." },
  { id: "schema", label: "The schema, kept as migrations", needs: [], kind: "does", map: "supabase",
    breaks: "A change made by hand on the live database that nobody can repeat.",
    ours: `${FACTS.migrations} migrations, each one kept in the repository.` },
  { id: "import", label: "Data brought over", needs: ["import"], kind: "none",
    breaks: "Duplicates, lost history, or a switch-over nobody rehearsed.",
    ours: "Not on ours: it started empty. For yours, the import is rehearsed on a copy before the real switch." }, // OWNER
  { id: "region", label: "Data kept in one region", needs: ["region"], kind: "does", map: "supabase",
    breaks: "Finding out after launch that a supplier keeps a copy somewhere else.",
    ours: "Its database and files are in eu-west-1 (Ireland). Some of the services it uses are outside the European Economic Area, and the privacy policy says how those transfers are safeguarded.",
    check: { kind: "site", label: "Read the privacy policy", href: "/privacy" } },
  { id: "plans", label: "Subscriptions and invoices", needs: ["plans"], kind: "does", map: "stripe",
    breaks: "A plan that changes in your app but not at the payment provider, or the other way round.",
    ours: `Stripe Checkout and the customer portal, and a signed webhook that keeps the plan in step on ${word(FACTS.stripeEvents)} kinds of event. Card numbers never reach its servers.` },
  { id: "fiscal", label: "Invoices issued once", needs: ["plans", "usage"], kind: "does", map: "smartbill",
    breaks: "A retried payment notice that issues the same invoice twice.",
    ours: "Each paid Stripe invoice becomes one SmartBill fiscal invoice, however often the webhook retries." },
  { id: "usage", label: "Metered usage", needs: ["usage"], kind: "does", map: "cron",
    breaks: "A minute billed twice after a retry, or not at all after a crash.",
    ours: "An answered call is billed once, from the carrier’s own record — even when it failed over mid-call — and the daily job bills any call whose billing didn’t finish, with the same key, so never twice." },
  { id: "hosting", label: "Hosting and deploys", needs: [], kind: "does", map: "gateway",
    breaks: "A deploy that cuts off what someone was in the middle of.",
    ours: `The app on Vercel, and an always-on gateway on Fly.io that gives live calls up to ${FACTS.drainSeconds} seconds to finish before a deploy stops it.` },
  { id: "jobs", label: "Scheduled jobs", needs: [], kind: "does", map: "cron",
    breaks: "A nightly job that fails halfway, then runs twice tomorrow.",
    ours: `One daily job at ${FACTS.cronAt} with ${word(FACTS.cronSteps.length)} steps: each runs on its own, so one failing never stops the rest, and each is safe to run twice.` },
  { id: "watch", label: "Monitoring", needs: [], kind: "does",
    breaks: "Hearing about an outage from a customer.",
    ours: "A status check across every provider and every circuit breaker, behind a secret; a failed job shows in the logs." },
  { id: "live", label: "Something that stays connected", needs: ["live"], kind: "does", map: "gateway",
    breaks: "A serverless function timing out in the middle of a call.",
    ours: "Calls stream to an always-on voice gateway, which switches provider mid-call if one fails — tested against simulated providers." },
];

export const SAAS_SCOPE: ScopeData = keyed({
  eyebrow: "Scope it",
  title: "What goes into a complete platform, and what makes yours harder",
  key: "what makes yours harder",
  sub: "Pick what your product needs. The parts it takes fill in across the four layers every platform has — each with what usually breaks there, and what ours does about it. There’s no price or date here: the parts you pick are what a quote is made of.",
  needsTitle: "What your product needs",
  checkKinds: CHECK_KINDS,
  partsAria: "The parts",
  groups: [
    { id: "who", label: "Who uses it" },
    { id: "charges", label: "How it charges" },
    { id: "touches", label: "What it touches" },
    { id: "holds", label: "What it has to hold" },
  ],
  needs: [
    { id: "teams", group: "who", label: "Teams, with roles" },
    { id: "staff", group: "who", label: "An admin for your own staff" },
    { id: "plans", group: "charges", label: "Subscriptions" },
    { id: "usage", group: "charges", label: "Usage or per-seat billing" },
    { id: "connect", group: "touches", label: "The tools customers already use" },
    { id: "import", group: "touches", label: "Data from what you use now" },
    { id: "live", group: "holds", label: "Something live: calls, chat, long jobs" },
    { id: "region", group: "holds", label: "Data that must stay in one region" },
  ],
  initial: ["plans"],
  initialPart: "data",
  // One layer per entry of the menu's `stack`, in its order (guarded above).
  layers: [
    { name: ITEM.stack[0], parts: ["auth", "screens", "policy", "teams", "admin", "connect"] },
    { name: ITEM.stack[1], parts: ["data", "schema", "import", "region"] },
    { name: ITEM.stack[2], parts: ["plans", "fiscal", "usage"] },
    { name: ITEM.stack[3], parts: ["hosting", "jobs", "watch", "live"] },
  ],
  parts: SCOPE_PARTS,
  summary: {
    some: "{n} parts in this build. {k} are there because of what you picked.",
    none: "{n} parts: the bones every platform has.",
  },
  tags: { always: "Always", added: "Added", off: "Not needed" },
  kinds: { does: "Done on ours", thin: "Thin on ours", none: "Not on ours" },
  inspector: { title: "The part", breaks: "What usually breaks", ours: "On ours", map: "See it on the map" },
  live: { added: "Added: {label}. {n} parts in this build.", removed: "Removed: {label}. {n} parts in this build." },
  foot: "The parts are what a quote is made of, not a quote. The ones marked thin or not on ours are where this platform proves nothing, and we say so.",
});

/* ---------- #prototype ---------- */

// A three-screen sample for no product in particular: neutral placeholder
// labels only, no invented business or person, and no figure anywhere —
// the cards and plans draw grey bars where numbers and prices would be.
export const SAAS_PROTOTYPE: PrototypeData = keyed({
  eyebrow: "Before any code",
  title: "Click through your product before a line of it is written",
  key: "before a line of it is written",
  sub: "The first thing a build makes is a prototype: every screen that matters, linked so you can use it. It’s where the product gets argued about — while a change is still a redraw, not a rewrite.",
  tag: "Sample prototype · no code behind it",
  product: "Your product",
  frameAria: "Sample prototype",
  toggle: "Show what’s clickable",
  hint: "The violet areas are clickable.",
  live: "Screen {n} of {total}: {title}",
  restart: "Start again",
  settles: {
    title: "What a prototype settles",
    items: [
      "Which screens there are, and what’s on each",
      "What a new customer does first, and what second",
      "Who sees what: owners, members and your own staff",
      "What’s free, and where someone is asked to pay",
    ],
  },
  foot: "A sample made for this page, for no product in particular. Yours is drawn from your idea — and it’s yours to put in front of the people you hope will pay for it.",
  screens: [
    { id: "signup", n: 1, step: "Sign up", title: "Create your account",
      blocks: [{ kind: "field", label: "Work email" }, { kind: "field", label: "Password" }],
      hotspots: [{ label: "Create account", to: "overview", dir: "forward", aria: "Create account — opens Overview" }] },
    { id: "overview", n: 2, step: "Overview", title: "Good morning",
      blocks: [{ kind: "card", label: "Active customers" }, { kind: "card", label: "This month" }, { kind: "chart" }],
      hotspots: [
        { label: "Upgrade", to: "plans", dir: "forward", aria: "Upgrade — opens Plans" },
        { label: "Sign out", to: "signup", dir: "back", aria: "Sign out — back to Sign up" },
      ] },
    { id: "plans", n: 3, step: "Plans", title: "Choose a plan",
      blocks: [{ kind: "plan", label: "Basic" }, { kind: "plan", label: "Team" }],
      hotspots: [
        { label: "Choose Team", to: "overview", dir: "back", aria: "Choose Team — back to Overview" },
        { label: "Back", to: "overview", dir: "back", aria: "Back to Overview" },
      ] },
  ],
});

/* ---------- #build ---------- */

// The title is the menu's promise and the stage titles its deliverables,
// read rather than retyped, so the menu and the page can't disagree.
export const SAAS_BUILD: BuildData = keyed({
  eyebrow: "How a build goes",
  title: ITEM.promise, // "A production platform, from first prototype to paying customers."
  key: "to paying customers.",
  sub: "Three stages, each ending in something you can hold and check before the next one starts.",
  labels: { stage: "Stage", hold: "You hold", ours: "On ours" },
  checkKinds: CHECK_KINDS,
  stages: [
    { id: "prototype", n: "01", title: ITEM.deliverables[0],
      body: "We design the screens with you and link them together, so you can click through the product before anything is built. A change here is a redraw; after code, it’s a rewrite.",
      hold: "A prototype you can click, and show to the people who’ll pay for it.",
      check: { kind: "site", label: "Click the sample above", href: "#prototype" } },
    { id: "platform", n: "02", title: ITEM.deliverables[1],
      body: "Sign-up and sign-in, onboarding, subscriptions, invoices, settings and the tools your staff need to run it — built in from the start, not bolted on after launch.",
      hold: "The platform, working, to try the way your customers will.",
      ours: "Supabase sign-in, a four-screen onboarding, Stripe subscriptions, SmartBill invoices and owner settings. Its staff side is thin — a status check and a server shell — and yours gets a real admin.",
      check: { kind: "site", label: "Walk through ours on the free trial", href: PRICING_TRIAL.href } },
    { id: "handover", n: "03", title: ITEM.deliverables[2],
      // OWNER: "a guide to running it" in every handover.
      body: "It goes live on managed hosting, with the checks and scheduled jobs that keep it honest, and the repository — code, tests and a guide to running it — is handed over.",
      hold: "The code, and a platform that’s already live.",
      ours: `Vercel for the app and Fly.io for live calls, a daily job of ${word(FACTS.cronSteps.length)} isolated steps, a status check across every provider, and ${FACTS.testFiles}+ test files.`,
      check: { kind: "call", label: "Ask how ours is hosted and watched, on the call." } },
  ],
});

/* ---------- #terms (still) ---------- */

export const SAAS_TERMS: TermsData = keyed({
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  key: "what we say up front",
  sub: "There’s no price or date on this page. Both depend on what the product needs, so both go in the quote — and here is what they depend on.",
  columns: [
    { id: "sets", head: "What sets the price and the date", items: [
      "How many kinds of user it has, and what each may see",
      "How customers pay: once, monthly, by usage or per seat",
      "The outside systems it has to connect to",
      "Anything live: calls, chat, or jobs that run for minutes",
      "Data it has to bring over from what you use now",
      "Where your customers are, and the rules that come with that",
    ] },
    { id: "need", head: "What we’ll need from you", items: [
      "A conversation about the product: who pays for it, what they do in it, and what they must never be able to do",
      "Whatever exists already: sketches, a spreadsheet, a process on paper, an old system",
      "One person who can say yes or no at each prototype review",
      "Access to the accounts it has to live in: your domain, your payment provider, your email sender",
      "Your yes before anything goes live",
    ] },
    { id: "get", head: "What you get", items: [
      ITEM.deliverables[0], ITEM.deliverables[1], ITEM.deliverables[2],
      "Tests for the parts that move money or data, handed over with the code", // OWNER
    ] },
    { id: "upfront", head: "Said up front", items: [
      "A prototype isn’t the product: it shows every screen, but stores nothing and charges no one.",
      "Hosting, payments and the other services it runs on bill for what they supply, on top of the build; the quote lists them.", // OWNER
      "Whose name the hosting, database and payment accounts are in is agreed before the build starts.",
      "We build for the web. A native iOS or Android app is a separate build.",
      "If a simpler tool would do the job, we’ll say so on the call.",
      CAA_HANDOVER.after, // "Who makes changes after launch — your team, us, or both — is agreed when the build is quoted."
    ] },
  ],
  after: "If it’s a phone agent you need rather than a platform, that’s a different build.",
  links: [
    { label: "How a custom phone agent is built", href: CAA_ITEM.href },
    { label: "Try the platform we built", href: PRICING_TRIAL.href },
  ],
});

/* ---------- #checks ---------- */

// Built from the list so it reads true for one grantor or several.
const grantsClaim = GRANTS.length === 1
  ? `${GRANTORS} awarded our company a startup grant.`
  : `${GRANTORS} each awarded our company a startup grant.`;

// Filter counts at e9e5d5e: every claim 12, now in this browser 6, on the
// call 4, at handover 2. The test computes them, so a row added here only
// needs its kind.
export const SAAS_CHECKS: ChecksData = keyed({
  eyebrow: "Check it yourself",
  title: "Every claim on this page, and where to check it",
  key: "where to check it",
  sub: "Some you can check now, in this browser. Some we show you on the call. The rest you hold at handover.",
  filtersAria: "Show claims",
  filters: [
    { id: "all", label: "Every claim" },
    { id: "site", label: "Now, in this browser" },
    { id: "call", label: "On the call" },
    { id: "handover", label: "At handover" },
  ],
  kinds: { site: "Now · here", call: "On the call", handover: "At handover" },
  showing: "Showing {n} of {total}",
  rows: [
    { id: "same-app", kind: "site", claim: "This site and the product are one platform, and we built it.", how: "Start the free trial: the dashboard you land in is served by the same app as this page.", link: { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href } },
    { id: "csp", kind: "site", claim: "Every page carries a security policy, chosen for its route.", how: `${CSP_HOW} This page’s is a host allowlist; signed-in screens get a nonce.` },
    { id: "onboarding", kind: "site", claim: "Onboarding is four screens, then a test call.", how: "Walk through it on the free trial.", link: { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href } },
    { id: "cards", kind: "site", claim: "Card numbers go to Stripe and never reach our servers.", how: "Choose a plan in the trial: the card form opens on Stripe’s own address." },
    { id: "routing", kind: "site", claim: "Where the next call goes when a part is down is decided by the platform’s own code.", how: "Take a part down on the drawing above: every answer there is worked out by that code.", link: { label: "Take a part down", href: "#platform" } },
    { id: "company", kind: "site", claim: "We’re an EU company, registered in Romania.", how: "The legal name, the CUI and the address are at the foot of every page." },
    { id: "accreditations", kind: ACCREDITATIONS.verify ? "site" : "call", claim: `The people who build hold ${ACC} personal Claude accreditations from Anthropic.`, how: "Ask to see them on the call." }, // OWNER
    { id: "grants", kind: "call", claim: grantsClaim, how: "Ask to see them on the call." }, // OWNER
    { id: "counts", kind: "call", claim: `${FACTS.routeHandlers}+ route handlers, ${FACTS.migrations} migrations, ${FACTS.testFiles}+ test files.`, how: "Counted from the repository by a test that fails if a figure stops being true. Ask us to run it." }, // OWNER
    { id: "failover", kind: "call", claim: "A call can lose a voice provider mid-sentence and carry on.", how: "Ask to see the gateway’s failover tests. They run against simulated providers, not a live outage." },
    { id: "prototype", kind: "handover", claim: "You click a prototype before any code is written.", how: "It’s the first thing a build delivers. You’ve clicked a sample of one above.", link: { label: "The sample", href: "#prototype" } },
    { id: "code", kind: "handover", claim: "The code is handed over.", how: "The repository, its tests and a guide to running it are yours at the end of the build." }, // OWNER
  ],
  missing: {
    label: "The one this page can’t show you",
    body: "That we’ll build yours well. Everything above is a platform we built for ourselves. The way to find out about yours is a call, then a prototype you can click before any code is written.",
    cta: CALL,
  },
});

/* ---------- #faq ---------- */

export const SAAS_FAQ: FaqData = keyed({
  eyebrow: "Questions",
  title: "What people ask before a build",
  key: "before a build",
  keyTone: "quiet",
  talk: CALL,
  phone: COMPANY.phone,
  items: [
    { id: "complete", q: "What do you mean by a complete SaaS platform?",
      a: "Everything a paying customer touches and everything you need to run it: sign-up and sign-in, the product’s own screens, subscriptions and invoices, the settings and admin behind them, hosting, monitoring and the scheduled jobs. Not just the screens, and not just a prototype — though a prototype comes first." },
    { id: "complex", q: "How complex can it be?",
      a: "Complex enough that it’s worth a call. The platform on this page takes phone calls in real time through an always-on service, switches voice provider mid-call when one fails — tested against simulated providers — bills by the minute through Stripe and issues fiscal invoices. If yours is harder in a different way, tell us how, and we’ll say plainly whether we’re the right people." },
    { id: "cost", q: "What does a build cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on what the product has to do: how many kinds of user it has, how customers pay, what it connects to and whether anything runs live. We won’t put a number here that we’d have to walk back. The prototype comes first, so you’ll have clicked through the product before any code is written." },
    { id: "ai", q: "Does my platform need AI in it?",
      a: "No. Most of a SaaS platform is accounts, data, payments and screens. Where AI would genuinely help — searching your documents, drafting, answering the phone — we’ll say where; where it wouldn’t, we won’t add it. If it’s a phone agent you want, that’s its own build.",
      where: { label: CAA_ITEM.label, href: CAA_ITEM.href } },
    { id: "own", q: "Who owns the code?", // OWNER
      a: "You do, once it’s handed over: the repository, its tests and a guide to running it. Whose name the hosting, database and payment accounts are in is agreed before the build starts." },
    { id: "existing", q: "We already have something built. Can you take it on?",
      a: "Show us on the call. We’ll read what’s there and tell you plainly whether we’d extend it or start again, and why." },
    { id: "personal", q: "Are the Claude accreditations a certification of your company?",
      a: "No. They’re personal: each belongs to the person who earned it, and they’re about building with Claude, Anthropic’s AI. They aren’t a security or compliance certification — the company holds none, and the homepage says so too." },
    { id: "grants", q: `What are the ${GRANTORS} grants?`,
      a: `Startup grants awarded to our company. Each grantor’s technology runs in this platform: ${listJoin(GRANTS.map((g) => `${g.grantor} ${g.role}`))}. A grant isn’t an endorsement of this page, or of any build we quote.` },
    { id: "other", q: "Is this the only thing you’ve built?", // OWNER
      a: "It’s the one we can show on a public page, because it’s ours. Work we’ve done for others belongs to them; ask on the call about work like yours, and we’ll tell you what we can." },
    { id: "data", q: "Where would our data live?",
      a: "Where your product needs it to, chosen with you before anything is built. This platform keeps its database and files in the EU, in eu-west-1 (Ireland); some of the services it uses are outside the European Economic Area, and the privacy policy says how those transfers are safeguarded. We’re an EU company, registered in Romania.",
      where: { label: "Read the privacy policy", href: "/privacy" } },
  ],
});

/** FAQPage structured data, built from the rows the page renders. */
export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  } as const;
}

/* ---------- #start, then the credits ---------- */

export const SAAS_START: StartData = keyed({
  eyebrow: "Start",
  title: "Bring the idea, and whatever exists of it",
  key: "whatever exists of it",
  body: "A build starts with a phone call, not a form. Tell us who the product is for, how they’ll pay and what it has to connect to. We’ll tell you what we’d build first, what we wouldn’t, and what it would take.",
  primary: CALL,
  secondary: { label: "Try the platform we built", href: PRICING_TRIAL.href },
  note: `${COMPANY.phone} · Quoted after the call, never on the page`,
});

/** Every third-party mark the page prints, apart from Anthropic, Claude and Google (their own lines). */
export const TRADEMARKS = ["Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Supabase", "PostgreSQL",
  "Twilio", "Vercel", "Next.js", "Node.js", "Fly.io", "Slack"] as const;

export const SAAS_CREDITS: CreditsData = {
  title: "About this page",
  items: [
    { term: "The platform on this page", detail: "Neuro Tech Voice, built by the team this page describes. The drawing is ours, made from its code; it’s a drawing, not a live feed." },
    { term: "The figures", detail: "Counted from its repository by the site’s own tests. A figure with a plus is a floor: the real count is at least that." },
    { term: "Take a part down", detail: "Every answer is worked out when the page is built, by the platform’s own routing code. Nothing on this page is really down." },
    { term: "The prototype", detail: "A three-screen sample made for this page, for no product in particular. It stores nothing and charges no one." },
    { term: "The scope", detail: "The parts it lists are what a quote is made of, not a quote. It prints no price and no date." },
    { term: "Accreditations and grants", detail: `The accreditations are personal, held by people on the team; the grants were awarded to the company by ${listJoin(GRANTS.map((g) => g.grantor))}. Shown on the call, on request.` }, // OWNER
    { term: "What isn’t here", detail: "No client names, logos, testimonials, prices or dates appear on this page. The one project shown is our own." },
    { term: "Anthropic and Claude", detail: "Anthropic and Claude are trademarks of Anthropic, PBC. The accreditations are personal; naming them is not an endorsement by Anthropic of this page or of any build." },
    { term: "The companies named on the drawing", detail: `${listJoin(TRADEMARKS)} are trademarks of their respective owners. We build on them; naming them is not an endorsement, and none of them endorses this page or any build we quote.` },
    { term: "Google", detail: AGENT_INTEGRATIONS.trademarks },
  ],
};
