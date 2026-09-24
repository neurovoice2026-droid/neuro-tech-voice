import "server-only";
/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — every word on the page.
 *
 * The page's argument is that we build complete SaaS platforms, and that
 * the platform the reader is on is one of them. So the claims that matter
 * most carry the way to check them — now, in this browser; on the call; or
 * in your build — and every figure is either read from the code or held
 * to it.
 *
 * Read, never retyped, where the source is safe to read: SOLUTION_ITEMS,
 * COMPANY, AUTH, PRICING_TRIAL, SOLUTIONS_MENU, TRUST (by id), HOME_START,
 * CAA_HANDOVER.after, DYNAMIC_APP_ROUTES,
 * TOTAL_ONBOARDING_STEPS, VOICE_PIPELINE_MODES, VOICE_TOOL_NAMES,
 * INTERNAL_SIGNATURE_TOLERANCE_SECONDS, WEBHOOK_HEADERS. Retyped in FACTS
 * with a keep-in-step note, and held by
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
 * is a certification. The page says so once for each, beside the claim,
 * and never contradicts the homepage's TRUST line (guarded below).
 *
 * The throws below run when the module is first evaluated — at build time
 * for this static route — so a fact that drifts under the copy fails the
 * build instead of shipping a sentence that is no longer true. The module
 * evaluates top to bottom, so PARTS, LENSES, DOWN and SCOPE_PARTS are
 * declared before the section consts that hold them.
 * ------------------------------------------------------------------ */
import { TOTAL_ONBOARDING_STEPS } from "@/app/onboarding/_lib/onboarding-state"; // pure, browser-safe
import { AUTH, COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU, TRUST } from "@/lib/site";
import { sentences } from "@/lib/pages/home/source";
import { HOME_START } from "@/lib/pages/home/start";
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
/**
 * "There is no certification badge on this site, because we hold none."
 * Guarded, not quoted: the credentials card says in its own words that the
 * accreditations aren't a company certification, and this keeps the
 * homepage saying nothing that card would contradict.
 */
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
// "Onboarding in four screens": read from the steps the onboarding renders.
// HOME_START.body says it in the landing's own words, so the test holds
// that sentence to the same count.
const ONBOARDING = word(TOTAL_ONBOARDING_STEPS); // "four"
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
  routeHandlers: 80, // FLOOR. app/api/**/route.ts (83 after the Telnyx removal)
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
  id: string; title: string; text: string; hops?: readonly Hop[]; ring?: readonly PartId[];
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
  stepOf: string; stepsTitle: string; partTitle: string; hint: string; picked: string; onPaths: string; showIt: string;
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
/** `link.lens`: an in-page link to the explorer that also opens that lens (checks.tsx, part-bus.ts `requestLens`). */
export type CheckRow = { id: string; kind: CheckKind; claim: string; how: string; link?: Link & { lens?: LensId } };
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
  room: { tag: string; plates: readonly { layer: string; name: string; runs: string; datum: string }[]; foot: string; link: Link; flow: { pause: string; play: string } };
  proofLabel: string; proof: readonly { label: string; term: string; detail: string; href: string }[];
};
export type CredentialsData = {
  eyebrow: string; title: string; key: string; sub: string; checkKinds: Record<CheckKind, string>;
  accreditations: { label: string; figure: string; caption: string; body: string; isnt: string; check: Check };
  grants: { label: string; whereLabel: string; mapLink: string; isnt: string; check: Check;
    rows: readonly { id: GrantId; grantor: string; part: PartId; runs: string }[] };
};
export type StartData = { eyebrow: string; title: string; key: string; body: string; primary: Link; secondary: Link; note: string };
export type CreditsData = { title: string; items: readonly { term: string; detail: string }[] };

/* ---------- shared copy ---------- */

// Held to csp.ts by the test: its static branch really does carry
// 'unsafe-inline', so the page never calls a prerendered policy "strict".
// The exact caveat is printed once, in #checks, where the reader opens the
// header; the scope card calls the public pages' policy "a lighter one",
// and the proxy card gives the token to the signed-in screens only. The
// nonce is "a one-time token": the word itself is jargon, and a slur in
// British English.
const CSP_TOKEN = "a fresh one-time token on every request";
const CSP_HOW = "Developer tools → Network → this page → Response headers → Content-Security-Policy.";
// The public pages' policy in plain words: csp.ts's static script-src is
// 'self' 'unsafe-inline' (the test holds it), so no "allowlist".
const CSP_PUBLIC = "public pages like this one may load scripts only from this site, and inline scripts still run";
// There is no /contact page and no form: a build starts with a phone call.
const CALL: Link = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref }; // "Call us about a build"
/** The three ways a claim is checked, as the check lines print them. Passed as `checkKinds` / `kinds`. */
// The id "handover" stays; its label says whose build it is, not when in it.
export const CHECK_KINDS: Record<CheckKind, string> = { site: "Now, in this browser", call: "On the call", handover: "In your build" };

/* ---------- meta ---------- */

// The layout's template adds " — Neuro Tech Voice", so the title carries no
// dash of its own. The description leads with the owner's differentiators
// in the hero's words and stays near 155 characters, so a search result
// doesn't cut them. Both go to openGraph and twitter too: without a page's
// own, those keep the layout's voice-agent copy (metadata merges shallowly).
export const SAAS_META = {
  title: `${ITEM.label}, like the one you’re on`,
  description: `Complete SaaS platforms, whatever the complexity. Our team holds ${ACC} Claude accreditations from Anthropic; ${GRANTORS} gave us ${GRANTS.length === 1 ? "a startup grant" : "startup grants"}.`, // OWNER
} as const;

/* ---------- #top: hero ---------- */

export const SAAS_HERO: HeroData = keyed({
  eyebrow: ITEM.label, // "Custom SaaS Platforms"
  title: "We build complete SaaS platforms. You’re on one of them.",
  key: "You’re on one of them.",
  // The owner's three proofs in the first paragraph, before the plates.
  sub: `${ITEM.description} We design and build the whole platform, whatever the complexity: a prototype you click first, then accounts, billing, admin and hosting, with the code handed over. Our team holds ${ACC} personal Claude accreditations from Anthropic, our company holds startup grants from ${GRANTORS}, and the platform you’re on is our proof.`, // OWNER
  primary: CALL,
  secondary: { label: "Explore the platform", href: "#platform" },
  note: `${COMPANY.phone} · No form: a build starts with a phone call.`,
  room: {
    tag: "Under this site",
    // One plate per layer of the menu's `stack`, in its order (guarded above).
    // Datums in a founder's words, ≤ 20 characters so each sits on one
    // line beside its layer label from 360px. The plate's grid gives the
    // label its own width and the datum the rest (hero.tsx PLATE), so a
    // longer one balances over two lines, flush right, and never runs
    // into the label. The developer's terms stay on the drawing's cards.
    plates: [
      { layer: ITEM.stack[0], name: `Next.js ${FACTS.nextMajor} on Vercel`, runs: "This site, sign-up, onboarding, the dashboard and its API", datum: `${FACTS.routeHandlers}+ API routes` },
      { layer: ITEM.stack[1], name: "Supabase Postgres", runs: "Row-level security, sign-in and file storage, in the EU", datum: `${FACTS.migrations} schema changes` },
      { layer: ITEM.stack[2], name: "Stripe and SmartBill", runs: "Subscriptions, checkout, the customer portal and fiscal invoices", datum: `${FACTS.stripeEvents} Stripe event types` },
      { layer: ITEM.stack[3], name: "Vercel and Fly.io", runs: `An always-on voice gateway on Node.js ${FACTS.nodeMajor}, and a daily job at ${FACTS.cronAt}`, datum: `${FACTS.cronSteps.length} scheduled steps` },
    ],
    foot: "Counted from the repository by the site’s own tests. A plus means at least.",
    link: { label: "Explore it", href: "#platform" },
    flow: { pause: "Pause background motion", play: "Play background motion" },
  },
  proofLabel: "The evidence on this page",
  proof: [
    { label: "Accreditations", term: `${ACC} Claude accreditations`, detail: "From Anthropic, each earned by someone on our team.", href: "#credentials" },
    { label: "Startup grants", term: GRANTORS, detail: "Awarded to our company. Their technology runs inside this platform.", href: "#credentials" },
    // OWNER: "large projects delivered". The detail says there are others,
    // so the plural label isn't read as one; the FAQ says why they aren't shown.
    { label: "Large projects delivered", term: "This platform", detail: "Others belong to the companies they were built for. This one is ours, drawn from its code below.", href: "#platform" },
  ],
});

/* ---------- #credentials ---------- */

// While there is no public link, the accreditations are shown on the call.
const accCheck: Check = ACCREDITATIONS.verify
  ? { kind: "site", label: "See the accreditations", href: ACCREDITATIONS.verify.href }
  : { kind: "call", label: "Ask to see the accreditations" }; // OWNER: that we show them on request. The kind tag says "On the call".
// The first grant with a public link turns the grants' check into a site link.
const grantLink = GRANTS.find((g) => g.verify)?.verify;

export const SAAS_CREDENTIALS: CredentialsData = keyed({
  eyebrow: "Who builds it",
  title: `The people who build it hold ${ACC} Claude accreditations`,
  key: `${ACC} Claude accreditations`,
  // The grants' "so what", said once on the page (the FAQ answer stands alone as structured data).
  sub: `Personal accreditations from Anthropic, and startup grants from ${GRANTORS}, whose technology runs inside this platform: if your product needs to speak or listen, we already build on it. What each one is, and how to see it.`,
  checkKinds: CHECK_KINDS,
  accreditations: {
    label: "Personal accreditations",
    figure: ACC, // "20+"
    caption: "Claude accreditations, from Anthropic",
    // OWNER (confirmed): the accreditations cover building with Claude, and
    // this platform was built with it (the repository's history says so
    // too). The second sentence is why a buyer should care, as "Where it
    // runs here" is for a grant.
    body: "Each was earned by one of the people who’d design and build your platform, for building with Claude, Anthropic’s AI. We build with it too, this platform included, so where your product should use AI, the people building it already know how.",
    // Said once, here. The homepage's "we hold none" is about badges and
    // stays guarded above; quoting it under "20+" read as a denial.
    isnt: "They aren’t a security or compliance certification of our company, and we don’t claim one.",
    check: accCheck,
  },
  grants: {
    label: "Startup grants, awarded to our company",
    whereLabel: "Where it runs here",
    mapLink: "See it on the map",
    // The grants' one non-endorsement line, beside the claim. The FAQ
    // doesn't repeat it; the credits' trademark line is the legal notice.
    isnt: "A grant isn’t an endorsement of this page, or of any build we quote.",
    check: grantLink
      ? { kind: "site", label: "See the grants", href: grantLink.href }
      : { kind: "call", label: "Ask to see the grants" }, // OWNER
    rows: GRANTS.map((g) => ({ id: g.id, grantor: g.grantor, part: g.part, runs: g.runs })),
  },
});

/* ---------- #platform: the explorer ---------- */

// The seventeen parts of the drawing. Labels stay ≤ 14 characters and
// datums ≤ 16 (the cards are 140×44u), and every number is interpolated
// from FACTS or a read source. KV and Drive are left off on purpose, so
// 17 stays legible.
const PARTS: readonly Part[] = [
  { id: "caller", layer: "people", label: "A caller", datum: "any phone",
    does: "Rings a business’s number. Nothing to install, nothing to sign up for." },
  { id: "customer", layer: "people", label: "A business", datum: "a browser",
    does: "Signs up, sets up its agent and pays — all in the browser." },
  { id: "twilio", layer: "edge", label: "Twilio", datum: "numbers · texts",
    does: `Rents the phone numbers, asks the app what to do with every call, reports how each one went, and carries texts. Before it dials out, the app refuses premium-rate and shared-cost numbers, and it cuts a transferred call at ${FACTS.transferCapMinutes} minutes.` },
  { id: "proxy", layer: "edge", label: "Proxy", datum: "sessions · CSP",
    does: `Runs before every page and API request: keeps visitors signed in, keeps signed-out visitors out of the dashboard, and gives every page a security policy. On the signed-in screens, that policy carries ${CSP_TOKEN}.` },
  { id: "router", layer: "app", label: "Call router", datum: `${MODES} modes`,
    does: "Answers Twilio within seconds and picks how to run each call: our own pipeline on Cartesia, Cartesia’s managed agent, or ElevenLabs’ standby agent — skipping any path whose breaker is open or whose budget is spent." },
  { id: "dashboard", layer: "app", label: "Dashboard", datum: `${SCREENS} screens`,
    does: `Onboarding in ${ONBOARDING} screens, then ${word(SCREENS)} screens: ${listJoin(SCREEN_NAMES)}.`,
    check: { kind: "site", label: "Walk through it on the free trial", href: PRICING_TRIAL.href } },
  { id: "api", layer: "app", label: "API", datum: `${FACTS.routeHandlers}+ routes`,
    does: `${FACTS.routeHandlers}+ API routes, from accounts and billing to telephony and the voice gateway’s calls back to the app. Machine callers — Twilio, Stripe, ElevenLabs, the gateway and the daily job — prove who they are with signatures or secrets, never cookies.` },
  { id: "workflows", layer: "app", label: "Workflows", datum: `signed · ${FACTS.webhookAttempts} tries`,
    does: `Rules that fire after a call on what happened: a signed webhook — tried up to ${word(FACTS.webhookAttempts)} times, https only, never to a private address — a Slack post, an email, a row in Google Sheets.` },
  { id: "cron", layer: "app", label: "Daily job", datum: `${FACTS.cronAt}`,
    does: `One job, called by Vercel Cron at ${FACTS.cronAt}. Its ${word(FACTS.cronSteps.length)} steps run on their own, so one failing never stops the others, and each is safe to run twice.` },
  { id: "gateway", layer: "calls", label: "Voice gateway", datum: `Node.js ${FACTS.nodeMajor}`,
    does: `An always-on service that holds each live call open — which a serverless function can’t — and runs speech in, the conversation and voice out. What it sends the app is signed, and a signature more than ${word(SIGNATURE_MINUTES)} minutes old is refused. On a deploy, calls get up to ${FACTS.drainSeconds} seconds to finish.` },
  { id: "cartesia", layer: "calls", label: "Cartesia", datum: "hears and speaks", grant: true,
    does: "The main path: Cartesia’s speech recognition hears the caller and its voice speaks the reply. Its managed agents are a second way to run a call." },
  { id: "openai", layer: "calls", label: "OpenAI", datum: `${TOOLS} tools`,
    does: `Writes each reply and decides when to use a tool — ${word(TOOLS)} of them, from checking the diary to putting the call through — and summarises every call afterwards.` },
  { id: "elevenlabs", layer: "calls", label: "ElevenLabs", datum: "the fallback", grant: true,
    does: "The fallback at every level: its voice or its speech recognition can take over mid-call, and a standby agent can take the whole call." },
  { id: "supabase", layer: "services", label: "Supabase", datum: `${FACTS.migrations} migrations`,
    // The trigger is told in the sign-up tour, and the scope says both in full.
    does: "The database, sign-in and file storage, in eu-west-1 (Ireland). Row-level security walls off each business’s rows." },
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
// `title` is the step list's short name for a step; the caption alone carries `text`.
const LENSES: readonly Lens[] = [
  { id: "signup", label: "A business signs up and pays", steps: [
    { id: "open", title: "The sign-up page opens", hops: ["customer-proxy"], text: "A business opens the sign-up page. The proxy runs first and gives the page its security policy.",
      check: { kind: "site", label: "Open the sign-up page", href: AUTH.signup } },
    // Email sign-up waits for the confirmation link (lib/auth/actions.ts, "Confirm email" in the runbook).
    { id: "account", title: "The account is created", hops: ["proxy-api", "api-supabase"], text: "The app creates the account in Supabase; the link in the confirmation email signs them in (Google sign-in does it at once)." },
    { id: "onboard", title: "Onboarding", hops: ["proxy-dashboard"], text: `Onboarding. ${HOME_START.body}`,
      check: { kind: "site", label: "Walk through it on the free trial", href: PRICING_TRIAL.href } },
    { id: "checkout", title: "Stripe Checkout", hops: ["dashboard-stripe"], text: "Picking a plan opens Stripe Checkout. The card number goes to Stripe and never reaches our servers." },
    { id: "webhook", title: "Stripe’s signed webhook", hops: ["stripe-api"], text: `Stripe’s signed webhook comes back. ${cap(word(FACTS.stripeEvents))} kinds of event keep the plan and the invoices in step.` },
    { id: "plan", title: "The plan is written", hops: ["api-supabase"], text: "The server writes the plan. A trigger in the database keeps a customer’s own session from changing it." },
    { id: "invoice", title: "A fiscal invoice in SmartBill", hops: ["api-smartbill"], text: "A paid invoice becomes one fiscal invoice in SmartBill, however often the webhook retries." },
  ] },
  { id: "call", label: "A phone call comes in", steps: [
    { id: "ring", title: "Someone rings", hops: ["caller-twilio"], text: "Someone rings the business’s number." },
    { id: "route", title: "Twilio asks the app", hops: ["twilio-router"], text: `Twilio asks the app what to do. The router picks one of ${word(MODES)} ways to run this call.` },
    { id: "stream", title: "The call streams to the gateway", hops: ["router-gateway"], voice: "cartesia", text: "The call streams to the voice gateway, with a session token the app has signed." },
    { id: "hear", title: "Cartesia hears", hops: ["gateway-cartesia"], text: "Cartesia hears the caller and turns speech into text." },
    { id: "think", title: "OpenAI writes the reply", hops: ["gateway-openai"], text: `OpenAI writes the reply, and uses a tool when it needs one: ${word(TOOLS)} of them, from checking the diary to putting the call through.` },
    { id: "book", title: "A tool runs in the app", hops: ["gateway-api", "api-google"], text: "The tool runs in the app over a signed request. A booking goes into Google Calendar, checked again just before it’s written." },
    { id: "speak", title: "Cartesia speaks", hops: ["gateway-cartesia"], text: "Cartesia speaks the reply. If the caller talks over it, it stops, and the transcript keeps only what they heard." },
    { id: "end", title: "The call ends and is saved", hops: ["gateway-api", "api-supabase", "twilio-api"], text: "The call ends. The transcript and a summary are saved, and Twilio’s own record bills the minutes, once." },
    { id: "after", title: "Workflows fire", hops: ["api-workflows", "workflows-google"], text: "Workflows fire on what happened: a signed webhook, a Slack post, a row in Google Sheets." },
  ] },
  { id: "failover", label: "A voice provider fails", foot: "The switches, the breaker and the hand-offs are covered by the gateway’s and the app’s tests, against simulated providers.", steps: [
    { id: "fault", title: "Cartesia’s voice fails", hops: ["gateway-cartesia"], fault: "cartesia", voice: "cartesia", text: "Mid-call, Cartesia’s voice returns an error." },
    { id: "switch", title: "ElevenLabs’ voice takes over", hops: ["gateway-elevenlabs"], fault: "cartesia", voice: "elevenlabs", text: "The gateway switches to ElevenLabs’ voice for the rest of the call, and says again what the caller didn’t hear." },
    { id: "ears", title: "If speech recognition fails", hops: ["gateway-elevenlabs"], text: `If it’s the speech recognition that fails instead, ElevenLabs’ own takes over, replaying the caller’s last ${word(FACTS.sttReplaySeconds)} seconds.` },
    { id: "model", title: "If OpenAI fails", hops: ["gateway-openai", "gateway-elevenlabs"], fault: "openai", text: "If OpenAI fails before the reply has started, the whole call goes to a standby ElevenLabs agent, with the conversation so far." },
    { id: "breaker", title: "A breaker opens", ring: ["router"], text: `${cap(word(FACTS.breakerFailures))} hard failures in a row open a breaker: new calls skip that path for ${FACTS.breakerOpenSeconds} seconds, then longer each time, up to ${word(FACTS.breakerMaxMinutes)} minutes.` },
    { id: "gateway", title: "If the gateway can’t carry on", hops: ["twilio-router", "router-elevenlabs"], fault: "gateway", text: "If the gateway can’t carry on, it lets go of the call without hanging up, and the app hands the caller to ElevenLabs." },
    { id: "router", title: "If the app’s answer fails", hops: ["twilio-router", "router-elevenlabs"], fault: "router", text: "If the app’s answer to Twilio errors or times out, Twilio asks the number’s fallback route, which hands the caller straight to ElevenLabs." },
    { id: "billed", title: "Billed once, either way", hops: ["twilio-api"], text: "However the call ended up being carried, it’s billed once, from Twilio’s own record." },
  ] },
  { id: "nightly", label: `Every morning at ${FACTS.cronAt}`, foot: "A step that fails shows in the logs and never stops the others.", steps: [
    { id: "wake", title: "Vercel Cron calls the job", hops: ["cron-api"], text: `Vercel Cron calls the daily job at ${FACTS.cronAt}, with a secret. Its ${word(FACTS.cronSteps.length)} steps run on their own, and each is safe to run twice.` },
    { id: "reconcile", title: "Bills calls left unbilled", cron: "reconcile_unbilled_calls", hops: ["api-supabase"], text: "Bills any answered call whose billing didn’t finish, without ever billing it twice." },
    { id: "roll", title: "Starts the next usage period", cron: "roll_usage_periods", hops: ["api-supabase"], text: "Starts the next usage period for paid plans." },
    { id: "overage", title: "Reports overage to Stripe", cron: "report_overage", hops: [{ edge: "stripe-api", reverse: true }], text: "Reports minutes past the allowance to Stripe." },
    { id: "reminders", title: "Texts appointment reminders", cron: "booking_reminders", hops: [{ edge: "twilio-api", reverse: true }], text: "Texts appointment reminders." },
    { id: "resync", title: "Re-syncs stale agents", cron: "resync_stale_agents", ring: ["cartesia", "elevenlabs"], text: `Re-syncs up to ${FACTS.resyncBatch} agents whose copy at Cartesia or ElevenLabs is missing or out of date.` },
    { id: "purge", title: "Deletes expired locks and flags", cron: "purge_expired_kv", hops: ["api-supabase"], text: "Deletes expired locks and flags." },
    { id: "uploads", title: "Removes unused uploads", cron: "purge_orphan_uploads", hops: ["api-supabase"], text: "Removes day-old uploads that nothing uses." },
    { id: "budget", title: "Refreshes the Cartesia budget", cron: "warm_cartesia_budget", ring: ["cartesia"], text: "Refreshes the cached Cartesia budget." },
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
    // "Speech" credits: the managed agent is paid from a separate budget (lib/voice/budget.ts).
    { id: "credits", label: "Cartesia speech credits used up", bit: 2 },
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
    // Also mask 8: the managed agents' breaker is checked only after this answer.
    credits_available: "It’s the first choice, and it’s still up.",
    gateway_breaker_open: "Both Cartesia routes run through the voice gateway, so with it down the call goes straight to the standby agent.",
    credits_exhausted: "This cycle’s Cartesia speech credits, which our own pipeline spends, are used up. The managed agent is paid from a separate budget, so the call goes there.",
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
  live: "{name} takes the next call. {why}",
};

export const SAAS_PLATFORM: ExplorerData = keyed({
  eyebrow: "A large project, opened up",
  title: "The platform behind this site, drawn from its code",
  key: "drawn from its code",
  // "Not a live feed" is the tag's, right under the lenses.
  sub: "Pick something that happens — a business signing up, a phone call, a provider failing, the morning’s jobs — and follow it through the parts that handle it. Every figure on the drawing is counted from the repository.",
  tag: "Drawn from the code · not a live feed",
  lensesAria: "What happens",
  stepsAria: "Every step",
  transport: { play: "Play it", pause: "Pause", replay: "Play it again" },
  stepOf: "Step {n} of {total}",
  stepsTitle: "Every step",
  partTitle: "The part",
  hint: "Showing the highlighted part. Pick any part on the drawing to see what it does.",
  picked: "Your pick. Choose a step or a path to follow the drawing again.",
  onPaths: "On these paths",
  showIt: "Show it on the drawing",
  indexSummary: "All {n} parts, in words",
  speaking: "Speaking",
  grant: "Grant",
  grantLink: { label: "About the grant", href: "#credentials" },
  failed: "Failed",
  live: "Step {n} of {total}: {text}",
  kinds: CHECK_KINDS,
  layers: { people: "People", edge: "The way in · phone and web", app: "The app · on Vercel", calls: "Live calls · gateway on Fly.io", services: "Services it relies on" },
  parts: PARTS,
  lenses: LENSES,
  // The SaaS-relevant tour, not the phone call: this page sells platforms.
  initial: "signup",
  down: DOWN,
  // The failover's tests are the failover lens's foot and a row in #checks.
  // Only the providers a call runs on: the runbook's "Known limitations"
  // names those four, and the test holds the list to it.
  foot: "The providers a call runs on — Twilio, Cartesia, OpenAI and ElevenLabs — were checked against their documentation and simulated in tests; Cartesia’s speech and voice were also checked live.",
});

/* ---------- #scope ---------- */

// The seventeen parts a platform can take, across the menu's four layers.
// Eight are the bones (`needs: []`); the rest are built when any of their
// needs is on. Each leads with the plain "what usually breaks" before
// "what ours does", and where our platform has little or none of a part
// the `ours` line opens with "Thin on ours" or "Not on ours" — the test
// holds both, and the glyph beside the card says it without a sentence.
const SCOPE_PARTS: readonly ScopePart[] = [
  // The "On ours" lines are in a founder's words; the explorer's cards keep
  // the developer's (the proxy, the header, the trigger).
  { id: "auth", label: "Sign-up and sign-in", needs: [], kind: "does", map: "proxy",
    breaks: "A page that believes the browser about who’s asking.",
    ours: "Every screen and every request checks on the server who’s signed in, and never takes the browser’s word for it." },
  { id: "screens", label: "Your product’s own screens", needs: [], kind: "does", map: "dashboard",
    breaks: "Screens shaped by a template instead of by how your customers work.",
    ours: `${cap(word(SCREENS))} screens and a ${ONBOARDING}-screen onboarding, served by the same app as this page.`,
    check: { kind: "site", label: "Walk through them on the free trial", href: PRICING_TRIAL.href } },
  // "Done on ours" is about the signed-in screens, so the breaks line is
  // too; the public pages' lighter policy is admitted beside it, and its
  // exact wording is left to the #checks row the link opens.
  { id: "policy", label: "A security policy on every page", needs: [], kind: "does", map: "proxy",
    breaks: "A script slipped into a signed-in screen, running as if it were yours.",
    ours: `Two policies, chosen per route. The signed-in screens, where your customers’ data is, get ${CSP_TOKEN}, so only scripts the server sent can run. Public pages like this one, built before anyone visits, get a lighter one; ‘How to check it’ shows both.`,
    check: { kind: "site", label: "How to check it", href: "#checks" } },
  { id: "teams", label: "Teams and roles", needs: ["teams"], kind: "none",
    breaks: "A member who can see what only an owner should.",
    ours: "Not on ours: each business account on it has a single owner. Roles for yours are designed from the prototype on." },
  { id: "admin", label: "An admin for your staff", needs: ["staff"], kind: "thin",
    breaks: "Fixing a customer’s account by hand, in the database.",
    ours: "Thin on ours: owner settings, and a status check its operators use. Yours gets a full admin for your staff." },
  { id: "connect", label: "Integrations and webhooks", needs: ["connect"], kind: "does", map: "workflows",
    breaks: "A webhook anyone can forge, or one pointed back at your own network.",
    ours: `Google Calendar and Sheets, with the customer’s own account. Every webhook it sends is signed (an ${WEBHOOK_HEADERS.signature} header) so the receiver can tell it’s genuine, is tried up to ${word(FACTS.webhookAttempts)} times, travels encrypted, and is never sent to an address inside a private network.` },
  // The trigger resets plan, minutes and billing columns only when a
  // customer's own session writes them: Checkout and the portal still
  // change a plan, so "can't hand themselves", not "can't change".
  { id: "data", label: "Each customer’s data, walled off", needs: [], kind: "does", map: "supabase",
    breaks: "One customer seeing another’s rows.",
    ours: "Each business sees only its own records, enforced by the database itself, and no customer can hand themselves a better plan or more minutes." },
  { id: "schema", label: "The schema, kept as migrations", needs: [], kind: "does", map: "supabase",
    breaks: "A change made by hand on the live database that nobody can repeat.",
    ours: `${FACTS.migrations} migrations, each one kept in the repository.` },
  { id: "import", label: "Data brought over", needs: ["import"], kind: "none",
    breaks: "Duplicates, lost history, or a switch-over nobody rehearsed.",
    ours: "Not on ours: it started empty. For yours, the import is rehearsed on a copy before the real switch." }, // OWNER
  // Thin: recordings are never copied into Supabase. The proxy streams each
  // from the provider that captured it: Twilio's US1 API (lib/twilio/
  // calls.ts, held by the test), ElevenLabs' standard environment, which its
  // data-residency doc stores in the US (api.elevenlabs.io, held by the
  // test), or Cartesia, whose storage country no Cartesia source we could
  // read names, so none is printed. ElevenLabs keeps its own transcript of a
  // call its agent ran, and Cartesia's DPA lets it keep what it processed;
  // Cartesia's agent copy of an unrecorded call is deleted after copying,
  // so "can".
  { id: "region", label: "Data kept in one region", needs: ["region"], kind: "thin", map: "supabase",
    breaks: "Finding out after launch that a supplier keeps a copy somewhere else.",
    ours: "Thin on ours: its database and file storage are in eu-west-1 (Ireland), but call recordings stay with the provider that captured them, and ElevenLabs or Cartesia can keep their own copy of a call they handled. Twilio and ElevenLabs keep theirs in the US, and we haven’t confirmed Cartesia’s country; the privacy policy says how those transfers are safeguarded. For yours, suppliers are chosen with the region in mind.",
    check: { kind: "site", label: "Read the privacy policy", href: "/privacy" } },
  { id: "plans", label: "Subscriptions and invoices", needs: ["plans"], kind: "does", map: "stripe",
    breaks: "A plan that changes in your app but not at the payment provider, or the other way round.",
    ours: `Stripe Checkout and the customer portal, and a signed webhook that keeps the plan in step on ${word(FACTS.stripeEvents)} kinds of event.` },
  { id: "fiscal", label: "Invoices issued once", needs: ["plans", "usage"], kind: "does", map: "smartbill",
    breaks: "A retried payment notice that issues the same invoice twice.",
    ours: "Each paid Stripe invoice becomes one SmartBill fiscal invoice, however often the webhook retries." },
  { id: "usage", label: "Metered usage", needs: ["usage"], kind: "does", map: "cron",
    breaks: "A minute billed twice after a retry, or not at all after a crash.",
    ours: "An answered call is billed once, from the carrier’s own record — even when it failed over mid-call — and the daily job bills any call whose billing didn’t finish, without ever billing it twice." },
  { id: "hosting", label: "Hosting and deploys", needs: [], kind: "does", map: "gateway",
    breaks: "A deploy that cuts off what someone was in the middle of.",
    ours: `The app on Vercel, and an always-on gateway on Fly.io that gives live calls up to ${FACTS.drainSeconds} seconds to finish before a deploy stops it.` },
  { id: "jobs", label: "Scheduled jobs", needs: [], kind: "does", map: "cron",
    breaks: "A daily job that fails halfway, then runs twice the next day.",
    ours: `One daily job at ${FACTS.cronAt} with ${word(FACTS.cronSteps.length)} steps: each runs on its own, so one failing never stops the rest, and each is safe to run twice.` },
  // What app/api/ops/voice-status returns, and no more (the test holds it):
  // which of its voice, phone, database, payment and email providers are
  // set up (not SmartBill or Google), the Cartesia budget and every
  // breaker. It is run by hand and alerts no one, so "thin".
  { id: "watch", label: "Monitoring", needs: [], kind: "thin",
    breaks: "Hearing about an outage from a customer.",
    ours: "Thin on ours: a status check that its operators run, behind a secret, shows which of its voice, phone, database, payment and email providers are set up, the Cartesia budget and the state of every circuit breaker; a failed job shows in the logs. Yours gets alerts that reach a person before a customer does." }, // OWNER: the last sentence rests on the menu's "Hosted, monitored" deliverable.
  { id: "live", label: "Something that stays connected", needs: ["live"], kind: "does", map: "gateway",
    breaks: "A serverless function timing out in the middle of a call.",
    ours: "Calls stream to an always-on voice gateway, which switches provider mid-call if one fails." },
];

export const SAAS_SCOPE: ScopeData = keyed({
  eyebrow: "Scope it",
  title: "What goes into a complete platform, and what makes yours harder",
  key: "what makes yours harder",
  sub: "Pick what your product needs. The parts it takes fill in across the four layers every platform has — each with what usually breaks there, and what ours does about it.",
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
    some: "{n} parts in this build, {k} of them because of what you picked.",
    none: "{n} parts: the bones every platform has.",
  },
  tags: { always: "Always", added: "Added", off: "Not needed" },
  kinds: { does: "Done on ours", thin: "Thin on ours", none: "Not on ours" },
  inspector: { title: "The part", breaks: "What usually breaks", ours: "On ours", map: "See it on the map" },
  live: { added: "Added: {label}. {n} parts in this build.", removed: "Removed: {label}. {n} parts in this build." },
  foot: "The parts are what a quote is made of, not a quote.",
});

/* ---------- #prototype ---------- */

// A three-screen sample for no product in particular: neutral placeholder
// labels only, no invented business or person, and no figure anywhere —
// the cards and plans draw grey bars where numbers and prices would be.
export const SAAS_PROTOTYPE: PrototypeData = keyed({
  eyebrow: "The prototype",
  title: "Click through your product before a line of it is written",
  key: "before a line of it is written",
  sub: "The first thing a build makes is a prototype: every screen that matters, linked so you can use it. It’s where the product gets argued about — while a change is still a redraw, not a rewrite.",
  tag: "Sample prototype · no code behind it",
  product: "Your product",
  frameAria: "Sample prototype",
  toggle: "Show what’s clickable",
  hint: "Every button in the sample opens another screen.",
  live: "Screen {n} of {total}",
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
  // Who it's shown to is #build's stage 01 "You hold" line, said once there.
  foot: "A sample made for this page, for no product in particular. Yours is drawn from your idea.",
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
      // "Redraw, not a rewrite" is #prototype's, right above: not said twice.
      body: "We design the screens with you and link them together, then change them with you until they’re right.",
      hold: "A prototype you can click, and show to the people who’ll pay for it.",
      check: { kind: "site", label: "Click the sample above", href: "#prototype" } },
    { id: "platform", n: "02", title: ITEM.deliverables[1],
      body: "Sign-up and sign-in, onboarding, subscriptions, invoices, settings and the tools your staff need to run it — built in from the start, not bolted on after launch.",
      hold: "The platform, working, to try the way your customers will.",
      ours: `Supabase sign-in, a ${ONBOARDING}-screen onboarding, Stripe subscriptions, SmartBill invoices, owner settings and a status check for its operators. Yours adds a full admin for your staff.`,
      check: { kind: "site", label: "Walk through ours on the free trial", href: PRICING_TRIAL.href } },
    { id: "handover", n: "03", title: ITEM.deliverables[2],
      // OWNER: "a guide to running it" in every handover.
      body: "It goes live on managed hosting, with the checks and scheduled jobs that keep it honest, and the repository — code, tests and a guide to running it — is handed over.",
      hold: "The code, and a platform that’s already live.",
      ours: `Vercel for the app and Fly.io for live calls, a daily job of ${word(FACTS.cronSteps.length)} isolated steps, a status check its operators run on its setup and circuit breakers, and ${FACTS.testFiles}+ test files.`,
      check: { kind: "call", label: "Ask how ours is hosted and watched" } },
  ],
});

/* ---------- #terms (still) ---------- */

export const SAAS_TERMS: TermsData = keyed({
  eyebrow: "Before it starts",
  title: "What we’ll ask, what you’ll get, and what we say up front",
  key: "what we say up front",
  sub: "There’s no price or date on this page: both go in the quote, because both depend on what the product needs. Here’s what moves them.",
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
      "We build for the web. A native mobile app is a separate build.",
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

// Filter counts at e9e5d5e: all 12, now in this browser 6, on the call 4,
// in your build 2. The test computes them, so a row added here only needs
// its kind. Not every claim on the page has a row: the ones that matter
// most do, so the title says so, never "every claim". (This wording's
// lines split for the reveal exactly as they wrap at rest, 320–1440px;
// "…where to check each one" re-wrapped at 360–412.)
export const SAAS_CHECKS: ChecksData = keyed({
  eyebrow: "Check it yourself",
  title: "The claims that matter most, and where to check them",
  key: "where to check them",
  sub: "Some you can check now, in this browser. Some we show you on the call. The rest you get in your build.",
  filtersAria: "Show claims",
  // One name for each kind, in the filters, the rows and every other check line.
  filters: [
    { id: "all", label: "All" },
    { id: "site", label: CHECK_KINDS.site },
    { id: "call", label: CHECK_KINDS.call },
    { id: "handover", label: CHECK_KINDS.handover },
  ],
  kinds: CHECK_KINDS,
  showing: "Showing {n} of {total}",
  rows: [
    // A new account lands in onboarding first (proxy.ts, the auth callback), then the dashboard.
    { id: "same-app", kind: "site", claim: "This site and the product are one platform, and we built it.", how: "Start the free trial: the onboarding and dashboard you land in are served by the same app as this page.", link: { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href } },
    { id: "csp", kind: "site", claim: "Every page carries a security policy, chosen for its route.", how: `${CSP_HOW} Signed-in screens get ${CSP_TOKEN}; ${CSP_PUBLIC}.` },
    { id: "onboarding", kind: "site", claim: `Onboarding is ${ONBOARDING} screens, then a test call.`, how: "Walk through it on the free trial.", link: { label: PRICING_TRIAL.cta, href: PRICING_TRIAL.href } },
    { id: "cards", kind: "site", claim: "Card numbers go to Stripe and never reach our servers.", how: "Choose a plan in the trial: the card form opens on Stripe’s own address." },
    { id: "routing", kind: "site", claim: "Where the next call goes when a part is down is decided by the platform’s own code.", how: "Take a part down on the drawing above: every answer there is worked out by that code.", link: { label: "Take a part down", href: "#platform", lens: "down" } },
    // "This page", as TRUST says it: the sign-in, sign-up and app screens carry no site footer.
    { id: "company", kind: "site", claim: "We’re an EU company, registered in Romania.", how: "The legal name, the CUI and the address are at the foot of this page." },
    { id: "accreditations", kind: ACCREDITATIONS.verify ? "site" : "call", claim: `Our team holds ${ACC} Claude accreditations from Anthropic.`, how: "Ask to see them." }, // OWNER
    { id: "grants", kind: "call", claim: grantsClaim, how: "Ask to see them." }, // OWNER
    { id: "counts", kind: "call", claim: `${FACTS.routeHandlers}+ API routes, ${FACTS.migrations} schema changes, ${FACTS.testFiles}+ test files.`, how: "Counted from the repository by a test that fails if a figure stops being true. Ask us to run it." }, // OWNER
    { id: "failover", kind: "call", claim: "A call can lose a voice provider mid-sentence and carry on.", how: "Ask to see the gateway’s failover tests. They run against simulated providers, not a live outage." },
    { id: "prototype", kind: "handover", claim: "You click through a prototype first.", how: "It’s what stage 01 delivers. You’ve clicked a sample of one above.", link: { label: "The sample", href: "#prototype" } },
    { id: "code", kind: "handover", claim: "The code is handed over.", how: "The repository, its tests and a guide to running it are yours at the end of the build." }, // OWNER
  ],
  // The card that closes the ledger looks forward, to the reader's own
  // build: #build's three stages, each checked as it lands.
  missing: {
    label: "How you check yours",
    body: "Yours starts with a call. Then come the three stages above, each one yours to check as it lands: a prototype you can click, the platform working, and the code, handed over with the platform live.",
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
      // Also served alone as FAQPage data, so the failover keeps its qualifier here.
      a: "As complex as your product needs. The platform on this page takes phone calls in real time through an always-on service, switches voice provider mid-call when one fails (tested with simulated outages), bills by the minute through Stripe and issues Romanian fiscal invoices. If yours is complex in a different way, tell us how on the call, and we’ll say plainly how we’d build it." },
    { id: "cost", q: "What does a build cost, and how long does it take?",
      a: "It’s quoted after the call, because both depend on what the product has to do: how many kinds of user it has, how customers pay, what it connects to and whether anything runs live. We won’t put a number here that we’d have to walk back. The prototype comes first, so you’ll have clicked through the product before any code is written." },
    { id: "ai", q: "Does my platform need AI in it?",
      a: "No. Most of a SaaS platform is accounts, data, payments and screens. Where AI would genuinely help (searching your documents, drafting, answering the phone) we’ll say where, and the people who’d build it hold the Claude accreditations above; where it wouldn’t, we won’t add it. If it’s a phone agent you want, that’s its own build.",
      where: { label: CAA_ITEM.label, href: CAA_ITEM.href } },
    { id: "own", q: "Who owns the code?", // OWNER
      a: "You do. At handover the repository is yours, with its tests and a guide to running it. Before the build starts, we settle with you whose name the hosting, database and payment accounts are opened in." },
    { id: "existing", q: "We already have something built. Can you take it on?",
      a: "Tell us about it on the call, then give us read access to the code. We’ll tell you plainly whether we’d extend it or start again, and why." },
    // Built with listJoin, so it reads true for any number of grantors.
    { id: "grants", q: `What are the ${GRANTORS} grants?`,
      a: `Startup grants awarded to our company. Each grantor’s technology runs in this platform — ${listJoin(GRANTS.map((g) => `${g.grantor} ${g.role}`))} — so if your product needs to speak or listen, it’s technology we already build on.` },
    // The one place that says why the other projects aren't shown.
    { id: "other", q: "What else have you delivered?", // OWNER: "large projects delivered"
      a: "Other large projects, for other companies. That work belongs to them, so it isn’t on a public page; this platform is ours, so this page opens it up. Ask on the call about work like yours, and we’ll tell you what we can." },
    // Each copy of a call where the scope's region card puts it (held by the test).
    { id: "data", q: "Where would our data live?",
      a: "Where your product needs it to, chosen with you before anything is built. This platform keeps its database and file storage in the EU, in eu-west-1 (Ireland), while its call recordings stay with the provider that captured them, and ElevenLabs or Cartesia can keep their own copy of a call they handled. Twilio and ElevenLabs keep theirs in the US, and we haven’t confirmed Cartesia’s country. Some of the other services it uses are outside the European Economic Area too, and the privacy policy says how those transfers are safeguarded. The company that builds it is in the EU as well, registered in Romania.",
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
  title: "Bring the idea, and whatever you already have",
  key: "whatever you already have",
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
    { term: "Accreditations and grants", detail: `The accreditations are held by people on the team; the grants were awarded to the company by ${listJoin(GRANTS.map((g) => g.grantor))}. Both are shown on the call, on request.` }, // OWNER
    { term: "What isn’t here", detail: "No client names, logos, testimonials, prices or dates appear on this page." },
    { term: "Anthropic and Claude", detail: "Anthropic and Claude are trademarks of Anthropic, PBC. Naming them is not an endorsement by Anthropic of this page or of any build." },
    { term: "Other names on this page", detail: `${listJoin(TRADEMARKS)} are trademarks of their respective owners. We build on them; none of them endorses this page or any build we quote.` },
    // Its own line, naming the marks this page prints: Google on its own,
    // Calendar and Sheets (the test collects them from the copy).
    { term: "Google", detail: "Google, Google Calendar and Google Sheets are trademarks of Google LLC. Neuro Tech Voice works with them and is not endorsed by Google." },
  ],
};
