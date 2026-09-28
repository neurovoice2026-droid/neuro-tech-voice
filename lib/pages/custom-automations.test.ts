import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ORPHAN_MIN_AGE_MS } from "@/app/api/cron/storage-cleanup";
import { DEEP_PANEL, HOME_COLORS } from "@/components/site/home/palettes";
import type { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { RESERVE_AT as SAAS_RESERVE_AT, RESERVE_TIERS } from "@/components/site/solutions/custom-saas-platforms/deferred";
import type { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import type { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { SAAS_INK, SAAS_LIGHTS, type SaasLightId } from "@/components/site/solutions/custom-saas-platforms/palette";
import type { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import type { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { RESERVE_AT, RESERVES, reserveStyle } from "@/components/site/solutions/custom-automations/deferred";
import { hardCount, metersOf, type Meters } from "@/components/site/solutions/custom-automations/meters";
import * as frameKit from "@/components/site/solutions/custom-automations/workbench-frame";
import * as geometry from "@/components/site/solutions/custom-automations/workbench-geometry";
import { ACTION_META, TRIGGER_META } from "@/components/workflows/meta";
import { entitlementsFor, requiredPlanFor } from "@/lib/billing/entitlements";
import { USAGE_THRESHOLDS } from "@/lib/billing/usage";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { sentences } from "@/lib/pages/home/source";
import { INT_BUILDER, INT_GOOGLE } from "@/lib/pages/integrations";
import { assertPublicHttpsUrl } from "@/lib/security/ssrf";
import { COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { contrast, flowReach, over, rgb, worstInZone, worstMoving, worstStatic } from "@/lib/testing/mesh-contrast";
import { MAX_ALERTS_PER_CALL } from "@/lib/voice/tools/notify";
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload";
import { SHEET_HEADER } from "@/lib/workflows/report";
import { DEFAULT_SLACK_MESSAGE } from "@/lib/workflows/templates";
import { ACTION_TYPES, GOOGLE_ACTION_INTEGRATION, MAX_WORKFLOW_ACTIONS, TRIGGER_TYPES } from "@/lib/workflows/types";
import {
  deliverJson,
  describeDelivery,
  isRetryableOutcome,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  WEBHOOK_TIMEOUT_MS,
  type WebhookFetcher,
} from "@/lib/workflows/webhook";
import { CALL_OUTCOMES, PLANS } from "@/types";
import {
  ACCREDITATIONS,
  CHECK_KINDS,
  FACTS,
  GRANTS,
  SAAS_FAQ,
  SAAS_START,
  SECTION_IDS as SAAS_SECTION_IDS,
  faqJsonLd,
  listJoin,
} from "./custom-saas-platforms";
import {
  ACTION_WORDS,
  AUTO_BREAKS,
  AUTO_BUILD,
  AUTO_CHECKS,
  AUTO_CREDITS,
  AUTO_FAQ,
  AUTO_HERO,
  AUTO_META,
  AUTO_RUNNING,
  AUTO_START,
  AUTO_TEAM,
  AUTO_TERMS,
  AUTO_TRADEMARKS,
  AUTO_WORK,
  FACTS_AUTO,
  KINDS,
  KINDS_NOTE,
  METER_COPY,
  MOVES,
  SECTION_IDS,
  TRIGGER_WORDS,
  type BlockKind,
  type BreakAnswer,
  type FieldId,
  type LevelId,
  type ManualId,
  type RunEdge,
  type RunLens,
  type RunLensId,
  type RunNode,
  type RunStep,
  type SectionId,
} from "./custom-automations";
import { ENDPOINT_LABEL, buildBreakTable, resultMeta } from "./custom-automations.server";

/* ------------------------------------------------------------------ *
 * /solutions/custom-automations — the claims the page makes, held to
 * the things they are about.
 *
 * The page argues that we automate any work, for any business, in any
 * field and at any difficulty, and that this platform — our own, for AI
 * phone agents — runs on automations we built: the proof, never the
 * limit. Its spine is those automations, taken from manual to automatic,
 * so its words are only as good as this file. It holds:
 *
 *   - every word read from a source (the menu item, the phone number,
 *     the trial, the dashboard's own names for triggers and steps, the
 *     self-serve builder, the SaaS page's credentials and region
 *     sentences) to that source;
 *   - every figure the page prints about the platform to the repository (the
 *     accreditation count is the owner's, held to its constant): the workflow
 *     engine's counts, the webhook's tries, waits and timeout, the run
 *     budget, the Stripe event's memory, the daily job's steps in the
 *     route's order and which of them run in a chain, the emails, the
 *     usage marks, the alerts a call, the sheet's columns, the outcomes,
 *     and each sentence the lenses paraphrase from a source comment;
 *   - "When it breaks" to the platform's own delivery code, re-run here
 *     with its own scripted receiver and held to the build's table row
 *     for row, and the run history's words to the dashboard's;
 *   - the workbench to itself: every lens's hops, rings, manual steps and
 *     tools; its meters, simplest first; its frame (workbench-frame.ts)
 *     and its xl drawing (workbench-geometry.ts): every block placed once,
 *     every edge ending on its own blocks and clear of every other;
 *   - #work's eighteen samples to the difficulty rules, and to being
 *     samples: no digit, no brand, no business;
 *   - the honesty rules: no price, date, client, badge or time-saved
 *     figure; certification words only ever negated; grants only from
 *     their grantors; every promise about the reader's own build marked
 *     OWNER in the data module's source and said of "yours"; every Google
 *     step in beta; every third-party mark credited, and every credited
 *     mark printed;
 *   - every link to a section, a block, a lens or a route that exists;
 *   - every colour on every reused light at this page's boxes, at rest
 *     and while the pools flow (lib/testing/mesh-contrast.ts), the night
 *     room's tokens, the fixed pairs, and the deep panel's zones;
 *   - the route's stylesheets to the motion contract: only
 *     compositor-friendly properties animate, scroll timelines only behind
 *     the reduced-motion and support gates, and every animation of ours
 *     with a lite, a still and a weak pin that wins;
 *   - the content-visibility reserves to the page's boxes;
 *   - the SaaS leaves this page reuses to the contract it reuses them on.
 * ------------------------------------------------------------------ */

const ROOT = process.cwd();
const DIR = "components/site/solutions/custom-automations";
const SAAS_DIR = "components/site/solutions/custom-saas-platforms";
const PAGE_FILE = "app/solutions/custom-automations/page.tsx";
const DATA_FILE = "lib/pages/custom-automations.ts";
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const has = (file: string) => existsSync(path.join(ROOT, file));
/** A source file's text with its `//` comment lines joined, so a phrase broken across two of them still matches. */
const said = (file: string) => read(file).replace(/\n\s*\/\/\s*/g, " ");

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations")!;
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms")!;
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents")!;
const CALL = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref };
const ACC = `${ACCREDITATIONS.count}+`;
const GRANTORS = GRANTS.map((g) => g.grantor);
const GOOGLE_KEYS = Object.keys(GOOGLE_ACTION_INTEGRATION);

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every string reachable from a value; functions are called with a sample argument (home.test.ts). */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") strings((value as (...a: number[]) => unknown)(1, 1), out);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

/** Each object's own strings read together, so a sentence is judged with the fields printed beside it. */
function records(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === "string") out.push(v);
      else records(v, out);
    }
  } else if (value && typeof value === "object") {
    const own = Object.values(value).filter((v): v is string => typeof v === "string");
    if (own.length) out.push(own.join(" · "));
    for (const v of Object.values(value)) if (v && typeof v === "object") records(v, out);
  }
  return out;
}

/** Every string with the record it sits in: its own object's strings, read together. */
function inRecords(value: unknown, out: { s: string; record: string }[] = []): { s: string; record: string }[] {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === "string") out.push({ s: v, record: v });
      else inRecords(v, out);
    }
  } else if (value && typeof value === "object") {
    const own = Object.values(value).filter((v): v is string => typeof v === "string");
    for (const s of own) out.push({ s, record: own.join(" · ") });
    for (const v of Object.values(value)) if (v && typeof v === "object") inRecords(v, out);
  }
  return out;
}

/** Every `href` reachable from a value. */
function hrefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) hrefs(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "href" && typeof v === "string") out.push(v);
      else hrefs(v, out);
    }
  }
  return out;
}

/** Every link reachable from a value (a Link, or a check or row that links): its label and where it goes. */
function linksIn(value: unknown, out: { label: string; href: string }[] = []): { label: string; href: string }[] {
  if (Array.isArray(value)) for (const v of value) linksIn(v, out);
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.label === "string" && typeof o.href === "string") out.push({ label: o.label, href: o.href });
    for (const v of Object.values(o)) linksIn(v, out);
  }
  return out;
}

/**
 * Every file under `dir` (repo-relative), never descending into
 * dependencies, builds or git — nor .claude, where an agent's worktree
 * would hold a second copy of every test file.
 */
function walk(dir: string, skip = ["node_modules", ".next", ".git", ".claude"]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file, skip));
    else if (entry.isFile()) out.push(file);
  }
  return out;
}

const split = (s: string) => s.split(/(?<=[.!?])\s+/);
/** A repo-relative file path, as "In the code, for your developers" prints one. */
const IS_PATH = /^[\w.-]+(?:\/[\w.[\]()-]+)+$/;

const SECTIONS = {
  top: AUTO_HERO,
  running: AUTO_RUNNING,
  work: AUTO_WORK,
  breaks: AUTO_BREAKS,
  team: AUTO_TEAM,
  build: AUTO_BUILD,
  terms: AUTO_TERMS,
  checks: AUTO_CHECKS,
  faq: AUTO_FAQ,
  start: AUTO_START,
} satisfies Record<SectionId, { title: string; key: string }>;

const PAGE = [AUTO_META, ...Object.values(SECTIONS), AUTO_CREDITS];
const ALL = strings(PAGE);
const CREDITS = strings(AUTO_CREDITS);
const OUTSIDE_CREDITS = strings([AUTO_META, ...Object.values(SECTIONS)]);
const FAQ_QS = new Set(AUTO_FAQ.items.map((i) => i.q));
const SOURCE = read(DATA_FILE);

const LENSES = AUTO_RUNNING.lenses;
const lens = (id: RunLensId) => LENSES.find((l) => l.id === id)!;
const SAMPLES = AUTO_WORK.samples;
const scenario = (id: string) => AUTO_BREAKS.scenarios.find((s) => s.id === id)!;
const table = await buildBreakTable();
const row = (id: string) => table.find((r) => r.id === id)!;

/** The block a run step arrives at: its last hop's end, or its first ring when that end is a group or there is no hop. */
function arrival(l: RunLens, s: RunStep): string | null {
  const nodes = new Set(l.nodes.map((n) => n.id));
  const hop = s.hops?.at(-1);
  const to = hop ? l.edges.find((e) => e.id === hop)?.to : undefined;
  if (to && nodes.has(to)) return to;
  return s.ring?.[0] ?? null;
}
/** The blocks a lens runs on: every node but a branch's end. */
const blocks = (l: RunLens): RunNode[] => l.nodes.filter((n) => !n.end);

describe("facts read from their sources", () => {
  it("reads the menu item: its label, description, promise, deliverables and layers", () => {
    // Guarded exactly: the page's plates, stages and terms are laid out for these.
    expect(ITEM).toMatchObject({
      label: "Custom Automations",
      href: "/solutions/custom-automations",
      description: "The manual work between your tools, done by software.",
      promise: "Every copy-paste between your tools, replaced by a workflow that runs itself.",
      deliverables: [
        "A map of the manual steps worth automating",
        "Workflows across inbox, sheets, CRM and APIs",
        "Alerts the moment something needs a person",
      ],
      stack: ["Inbox", "Spreadsheets", "CRM", "Webhooks"],
    });
    expect(AUTO_HERO.eyebrow).toBe(ITEM.label);
    expect(AUTO_META.title.startsWith(ITEM.label)).toBe(true);
    expect(AUTO_HERO.sub.startsWith(ITEM.description)).toBe(true);
    expect(AUTO_BUILD.title).toBe(ITEM.promise);
    expect(AUTO_BUILD.stages.map((s) => s.title)).toEqual(ITEM.deliverables);
    expect(AUTO_BUILD.stages.map((s) => s.n)).toEqual(["01", "02", "03"]);
    expect(AUTO_TERMS.columns.find((c) => c.id === "get")!.items.slice(0, 3)).toEqual(ITEM.deliverables);
    expect(AUTO_HERO.room.plates.map((p) => p.layer)).toEqual(ITEM.stack);
  });

  it("starts every build with the menu's own phone call", () => {
    expect(SOLUTIONS_MENU.cta.href(ITEM.id)).toBe(COMPANY.phoneHref);
    for (const link of [AUTO_HERO.primary, AUTO_FAQ.talk, AUTO_START.primary, AUTO_CHECKS.missing.cta]) {
      expect(link).toEqual(CALL);
    }
    expect(AUTO_FAQ.phone).toBe(COMPANY.phone);
    expect(AUTO_HERO.note.startsWith(COMPANY.phone)).toBe(true);
    expect(AUTO_START.note.startsWith(COMPANY.phone)).toBe(true);
    const tel = hrefs(PAGE).filter((h) => h.startsWith("tel:"));
    expect(tel.length).toBeGreaterThanOrEqual(4);
    for (const h of tel) expect(h).toBe(COMPANY.phoneHref);
  });

  it("sends every trial link to the free trial", () => {
    const trial = linksIn(PAGE).filter((l) => /free trial|Try the platform|^Start free$/i.test(l.label));
    expect(trial.length).toBeGreaterThan(3);
    for (const l of trial) expect(l.href, l.label).toBe(PRICING_TRIAL.href);
    expect(AUTO_BREAKS.check.href).toBe(PRICING_TRIAL.href);
    expect(AUTO_CHECKS.rows.filter((r) => r.link?.label === PRICING_TRIAL.cta)).toHaveLength(2);
  });

  it("links the team to the SaaS page's credentials, which it still has", () => {
    expect(SAAS_ITEM.href).toBe("/solutions/custom-saas-platforms");
    expect(AUTO_TEAM.grants.more.href).toBe(`${SAAS_ITEM.href}#credentials`);
    expect(SAAS_SECTION_IDS).toContain("credentials");
    expect(AUTO_TERMS.links.map((l) => l.href)).toEqual([SAAS_ITEM.href, CAA_ITEM.href]);
  });

  it("reuses the SaaS module's credentials and this module's shared copy, never a copy of either", () => {
    for (const kinds of [AUTO_RUNNING.checkKinds, AUTO_BREAKS.checkKinds, AUTO_TEAM.checkKinds, AUTO_BUILD.checkKinds, AUTO_CHECKS.kinds]) {
      expect(kinds).toBe(CHECK_KINDS);
    }
    expect(AUTO_TEAM.accreditations.figure).toBe(ACC);
    expect(AUTO_TEAM.grants.names).toEqual(GRANTORS);
    expect(AUTO_HERO.proof.find((p) => p.label === "Startup grants")!.term).toBe(listJoin(GRANTORS));
    expect(AUTO_RUNNING.kinds).toBe(KINDS);
    expect(AUTO_WORK.kinds).toBe(KINDS);
    expect(AUTO_RUNNING.meters).toBe(METER_COPY);
    expect(AUTO_WORK.meters).toBe(METER_COPY);
    expect(AUTO_WORK.moves).toBe(MOVES);
    expect(AUTO_WORK.kindsNote).toBe(KINDS_NOTE);
  });

  it("offers the accreditations and the grants on the call until there is a public link", () => {
    const acc = AUTO_CHECKS.rows.find((r) => r.id === "accreditations")!;
    if (ACCREDITATIONS.verify === null) {
      expect(AUTO_TEAM.accreditations.check.kind).toBe("call");
      expect(acc.kind).toBe("call");
      expect(acc.link).toBeUndefined();
    } else {
      expect(AUTO_TEAM.accreditations.check).toMatchObject({ kind: "site", href: ACCREDITATIONS.verify.href });
      expect(acc).toMatchObject({ kind: "site", link: { href: ACCREDITATIONS.verify.href } });
    }
    const grants = AUTO_CHECKS.rows.find((r) => r.id === "grants")!;
    const grantLink = GRANTS.find((g) => g.verify)?.verify;
    if (!grantLink) {
      expect(AUTO_TEAM.grants.check.kind).toBe("call");
      expect(grants.kind).toBe("call");
      expect(grants.link).toBeUndefined();
    } else {
      expect(AUTO_TEAM.grants.check).toMatchObject({ kind: "site", href: grantLink.href });
      expect(grants).toMatchObject({ kind: "site", link: { href: grantLink.href } });
    }
  });

  it("calls triggers and steps what the dashboard calls them", () => {
    expect(AUTO_BREAKS.workflow.trigger).toBe(TRIGGER_META.sentiment_negative.label);
    expect(AUTO_BREAKS.record.labels).toEqual({
      tag: ACTION_META.add_tag.label,
      crm: ACTION_META.send_webhook.label,
      slack: ACTION_META.notify_slack.label,
    });
    const names = [
      TRIGGER_META.sentiment_negative.label,
      TRIGGER_META.call_ended.label,
      TRIGGER_META.keyword_detected.label,
      TRIGGER_META.call_missed.label,
      ACTION_META.add_tag.label,
      ACTION_META.send_webhook.label,
      ACTION_META.notify_slack.label,
    ];
    expect(names).toEqual(["Unhappy caller", "Call ended", "Keyword heard", "Missed call", "Tag the call", "Send webhook", "Notify Slack"]);
    for (const name of names) expect(ALL.some((s) => s.includes(name)), name).toBe(true);
    // The copy's own word for it, never the engine's.
    expect(ALL.filter((s) => /negative sentiment/i.test(s))).toEqual([]);
  });

  it("words every trigger and every step kind the engine has, and names Google only in the Google steps", () => {
    expect(Object.keys(TRIGGER_WORDS).sort()).toEqual([...TRIGGER_TYPES].sort());
    expect(Object.keys(ACTION_WORDS).sort()).toEqual([...ACTION_TYPES].sort());
    const google = ACTION_TYPES.filter((a) => /\bGoogle\b|\bGmail\b/.test(ACTION_WORDS[a]));
    expect([...google].sort()).toEqual([...GOOGLE_KEYS].sort());
  });

  it("draws the line at the self-serve builder: its steps, its plans, its beta", () => {
    expect(INT_BUILDER.steps.length).toBe(3);
    expect(INT_GOOGLE.badge).toBe("Beta");
    const trial = entitlementsFor("trial");
    expect(trial.smsConfirmations).toBe(false);
    expect(trial.googleIntegrations).toBe(false);
    const sms = PLANS[requiredPlanFor("smsConfirmations")].name;
    const google = PLANS[requiredPlanFor("googleIntegrations")].name;
    const card = AUTO_BUILD.selfServe.body;
    expect(card).toContain(`in ${word(INT_BUILDER.steps.length)} steps, with no build`);
    expect(card).toContain(`Texts to callers start on the ${sms} plan`);
    expect(card).toContain(`the ${word(GOOGLE_KEYS.length)} Google steps, in beta, on ${google}.`);
    // The four steps it lists are the ones that aren't Google's, in the engine's order,
    // less the pause: it sits between steps, and isn't follow-up anyone needs.
    const selfServe = ACTION_TYPES.filter((a) => !GOOGLE_KEYS.includes(a) && a !== "wait");
    expect(selfServe).toHaveLength(4);
    expect(card).toContain(`— ${listJoin(selfServe.map((a) => ACTION_WORDS[a]))} —`);
    expect(AUTO_CHECKS.rows.find((r) => r.id === "self")!.how).toContain(`in ${word(INT_BUILDER.steps.length)} steps`);
    expect(AUTO_BUILD.selfServe.link.href).toBe("/product/integrations");
    // Plans by name, never "paid plans" (a trial is a plan too).
    expect(card).not.toMatch(/paid plans?/i);
    // Saving a workflow gates exactly those two entitlements, nothing else.
    const service = read("lib/workflows/service.ts");
    const at = service.indexOf("export async function assertActionsAllowed(");
    expect(at).toBeGreaterThan(0);
    const body = service.slice(at, service.indexOf("\n}\n", at));
    expect(body).toContain("!entitlements.googleIntegrations");
    expect(body).toContain("!entitlements.smsConfirmations");
    expect([...new Set([...body.matchAll(/entitlements\.(\w+)/g)].map((m) => m[1]))].sort()).toEqual(["googleIntegrations", "smsConfirmations"]);
  });

  it("reads where the data lives from the SaaS page's answer, and names no provider the platform no longer uses", () => {
    const saas = SAAS_FAQ.items.find((i) => i.id === "data")!.a;
    const ours = AUTO_FAQ.items.find((i) => i.id === "data")!;
    expect(ours.a.endsWith(sentences(saas, 1, 5))).toBe(true);
    for (const phrase of [
      "eu-west-1 (Ireland)",
      "Twilio and ElevenLabs keep theirs in the US",
      "haven’t confirmed Cartesia’s country",
      "privacy policy says how those transfers are safeguarded",
    ]) {
      expect(ours.a, phrase).toContain(phrase);
    }
    expect(ours.where).toEqual({ label: "Read the privacy policy", href: "/privacy" });
    // The Fish Audio and Telnyx pipeline was removed (82faf6f).
    expect(ALL.filter((s) => /\bFish\b|\bTelnyx\b/i.test(s))).toEqual([]);
  });

  it("borrows the handover line from the custom AI agents page", () => {
    expect(AUTO_TERMS.columns.find((c) => c.id === "upfront")!.items.at(-1)).toBe(CAA_HANDOVER.after);
  });
});

describe("counts held to the repository", () => {
  it("counts the workflow engine, and spells its counts out from them", () => {
    expect(TRIGGER_TYPES).toHaveLength(4);
    expect(ACTION_TYPES).toHaveLength(10);
    expect(MAX_WORKFLOW_ACTIONS).toBe(10);
    expect(GOOGLE_KEYS).toHaveLength(5);
    const card = AUTO_RUNNING.ledger.cards.find((c) => c.id === "workflows")!;
    expect(card.body.startsWith(`${cap(word(TRIGGER_TYPES.length))} moments start one — ${listJoin(TRIGGER_TYPES.map((t) => TRIGGER_WORDS[t]))} —`)).toBe(true);
    expect(card.body).toContain(`up to ${word(MAX_WORKFLOW_ACTIONS)} steps in order, picked from ${word(ACTION_TYPES.length)} kinds`);
    expect(card.figure).toBe(`${TRIGGER_TYPES.length} triggers · ${ACTION_TYPES.length} kinds`);
    expect(card.more).toBe(
      `The ${word(ACTION_TYPES.length)} kinds: ${listJoin(ACTION_TYPES.map((a) => ACTION_WORDS[a]))}. The ${word(GOOGLE_KEYS.length)} Google steps are in beta.`,
    );
    expect(AUTO_BUILD.selfServe.body).toContain(`the ${word(GOOGLE_KEYS.length)} Google steps`);
  });

  it("holds the webhook's tries, waits and timeout to the delivery code", () => {
    expect([...FACTS_AUTO.webhookWaitsSeconds]).toEqual(WEBHOOK_RETRY_DELAYS_MS.map((ms) => ms / 1000));
    expect(FACTS_AUTO.webhookTimeoutSeconds).toBe(WEBHOOK_TIMEOUT_MS / 1000);
    expect(FACTS.webhookAttempts).toBe(WEBHOOK_MAX_ATTEMPTS);
    expect(isRetryableOutcome({ kind: "response", status: 503 })).toBe(true);
    expect(isRetryableOutcome({ kind: "response", status: 404 })).toBe(false);
    const [first, second] = FACTS_AUTO.webhookWaitsSeconds;
    expect(AUTO_BREAKS.scale).toContain(`it waits ${first} second, then ${second}, and gives each try ${FACTS_AUTO.webhookTimeoutSeconds} seconds to answer`);
    expect(AUTO_HERO.room.plates[3].datum).toBe(`signed · ${WEBHOOK_MAX_ATTEMPTS} tries`);
    expect(KINDS.retry.proof).toContain(`up to ${word(WEBHOOK_MAX_ATTEMPTS)} times`);
  });

  it("reads the run budget, the Stripe event's memory and the longest wait from their source", () => {
    const executor = read("lib/workflows/executor.ts");
    expect(executor).toContain("const RUN_BUDGET_MS = 240_000");
    expect(240_000 / 60_000).toBe(FACTS_AUTO.runBudgetMinutes);
    expect(AUTO_BREAKS.guards.find((g) => g.id === "budget")!.body).toContain(`${word(FACTS_AUTO.runBudgetMinutes)} minutes`);
    const stripe = read("app/api/billing/webhook/route.ts");
    for (const phrase of ["DONE_TTL_SECONDS = 48 * 60 * 60", "LOCK_TTL_SECONDS = 5 * 60", "constructEvent(rawBody", "stripe-event:${event.id}:done", "kvIncr(lockKey"]) {
      expect(stripe, phrase).toContain(phrase);
    }
    expect(Number(stripe.match(/DONE_TTL_SECONDS = (\d+) \* 60 \* 60/)![1])).toBe(FACTS_AUTO.stripeDoneHours);
    expect(AUTO_BREAKS.guards.find((g) => g.id === "twice")!.body).toContain(`${FACTS_AUTO.stripeDoneHours} hours`);
    const schemas = read("lib/workflows/schemas.ts");
    expect(schemas).toContain(".max(30, 'Wait at most 30 seconds')");
    expect(FACTS_AUTO.waitMaxSeconds).toBe(30);
  });

  it("matches the constants whose modules the copy may not import", () => {
    expect([...USAGE_THRESHOLDS]).toEqual([...FACTS_AUTO.usageMarks]);
    expect(MAX_ALERTS_PER_CALL).toBe(FACTS_AUTO.alertsPerCall);
    expect(SHEET_HEADER).toHaveLength(12);
    expect(AUTO_HERO.room.plates[1].datum).toBe(`${SHEET_HEADER.length} columns a call`);
    expect(read("lib/workflows/google.ts")).toContain("valueInputOption: 'RAW'");
    expect(CALL_OUTCOMES).toHaveLength(10);
    expect(AUTO_HERO.room.plates[2].datum).toBe(`${CALL_OUTCOMES.length} outcomes`);
    expect(Number(read("lib/voice/sync/index.ts").match(/const RESYNC_BATCH = (\d+)/)![1])).toBe(FACTS.resyncBatch);
    expect(ORPHAN_MIN_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(lens("morning").nodes.find((n) => n.id === "uploads")!.detail).toContain("day-old");
    const [low, high] = FACTS_AUTO.usageMarks;
    expect(AUTO_RUNNING.ledger.cards.find((c) => c.id === "usage")!.figure).toBe(`${low}% · ${high}%`);
    expect(AUTO_RUNNING.ledger.cards.find((c) => c.id === "notify")!.figure).toBe(`at most ${MAX_ALERTS_PER_CALL} a call`);
  });

  it("counts the account emails, and finds each one sent from somewhere", () => {
    const templates = read("lib/email/templates.ts");
    const names = [...templates.matchAll(/^export function (\w+Email)\(/gm)].map((m) => m[1]);
    expect(names).toHaveLength(FACTS_AUTO.emails);
    expect(AUTO_HERO.room.plates[0].datum).toBe(`${FACTS_AUTO.emails} account emails`);
    const callers = [...walk("app"), ...walk("lib")]
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== "lib/email/templates.ts")
      .map((f) => read(f));
    for (const name of names) expect(callers.some((src) => src.includes(`${name}(`)), name).toBe(true);
  });

  it("names the daily job's steps in the route's order, and which of them run in a chain", () => {
    const route = read("app/api/cron/daily/route.ts");
    const steps = [...route.matchAll(/runCronStep\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(steps).toEqual(FACTS.cronSteps);
    const open = route.indexOf("const billing = (async () => {");
    expect(open).toBeGreaterThan(0);
    const chain = [...route.slice(open, route.indexOf("})()", open)).matchAll(/runCronStep\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(chain).toEqual(FACTS.cronSteps.slice(0, FACTS_AUTO.billingChain));
    expect(said("app/api/cron/daily/route.ts")).toContain("one failing never stops the others");
    expect(read("vercel.json")).toContain('"schedule": "0 7 * * *"');
    const node = (id: string) => lens("morning").nodes.find((n) => n.id === id)!.detail;
    // "Without the secret, nothing runs": the route asks for it before any step.
    expect(route).toContain("requireCronRequest(req, 'cron')");
    expect(route.indexOf("requireCronRequest(req, 'cron')")).toBeLessThan(route.indexOf("runCronStep("));
    expect(said("app/api/cron/auth.ts")).toContain("503 without a usable CRON_SECRET, 401 for a wrong token");
    expect(node("cron")).toContain("Without the secret, nothing runs");
    // "Markers whose time has passed", and "the same figure the app checks before each call".
    expect(said("app/api/cron/jobs.ts")).toContain("Deletes kv_store rows whose TTL passed");
    expect(node("locks")).toContain("whose time has passed");
    expect(said("lib/voice/budget.ts")).toContain("the router reads the budget");
    expect(node("budget")).toContain("before each call");
    expect(KINDS.time.proof).toBe(`${cap(word(FACTS.cronSteps.length))} steps run here every morning at ${FACTS.cronAt}.`);
    expect(AUTO_BREAKS.guards.find((g) => g.id === "alone")!.body).toContain(`${word(FACTS.cronSteps.length)} steps`);
  });

  it("orders the document lens as the knowledge pipeline does: ready, then the copies", () => {
    const ingest = said("lib/knowledge/ingest.ts");
    for (const phrase of ["skip re-embedding when unchanged", "insert the new", "delete the old ones", "→ ready → provider copies"]) {
      expect(ingest, phrase).toContain(phrase);
    }
    expect(said("lib/knowledge/providers.ts")).toContain("best effort");
    // "Unchanged: … straight to ready and the copies": `unchanged` skips only the indexing.
    expect(read("lib/knowledge/ingest.ts")).toMatch(/if \(!unchanged\) \{[\s\S]*?\n  \}\n\n  const exists = await updateRow\(admin, doc, \{[\s\S]*?status: 'ready'/);
    const same = lens("document").nodes.find((n) => n.id === "same")!.detail;
    expect(same).toContain("ready");
    expect(same).toContain("the copies");
    expect(said("lib/knowledge/fetch-url.ts")).toContain("https only");
    // "It never ends in silence": the pipeline's own promise.
    expect(ingest).toContain("It never throws: every failure ends on the row as a plain error_message");
    expect(lens("document").nodes.find((n) => n.id === "ready")!.detail).toContain("It never ends in silence");
    const doc = lens("document");
    const at = (id: string) => doc.steps.findIndex((s) => s.id === id);
    expect(at("ready")).toBeGreaterThan(0);
    expect(at("copies")).toBe(at("ready") + 1);
    expect(at("swap")).toBeLessThan(at("ready"));
    // Nothing re-reads a document on its own; a replacement is a new row, always indexed in full.
    expect(read("app/api/cron/daily/route.ts")).not.toMatch(/knowledge/i);
    expect(said("app/api/agent/knowledge/[docId]/resync/route.ts")).toContain("reads the document again");
    expect(read("lib/knowledge/ingest.ts")).toContain("const unchanged = doc.content_sha256 === hash");
    expect(doc.built).not.toMatch(/kept in step/);
    expect(doc.nodes.find((n) => n.id === "changed")!.detail).toContain("from the dashboard");
  });

  it("takes the call lens from the post-call pipeline as it runs", () => {
    const post = read("lib/voice/post-call.ts");
    expect(post).toContain("post-call:analyze:");
    expect(post).toContain("post-call:workflows:");
    const test = post.indexOf("if (row.is_test) return");
    expect(test).toBeGreaterThan(0);
    // A test call stops before the workflows' guard, and before they run.
    expect(test).toBeLessThan(post.indexOf("post-call:workflows:"));
    expect(test).toBeLessThan(post.indexOf("runCallWorkflows("));
    const analysis = said("lib/openai/analysis.ts");
    expect(analysis).toContain("2 to 4 plain sentences");
    expect(analysis).toContain("Never guess");
    expect(read("lib/workflows/executor.ts")).toContain("claimOncePerCall");
    const keywords = said("lib/workflows/keywords.ts");
    expect(keywords).toContain("Whole words or phrases only");
    expect(keywords).toContain("Case never matters");
    expect(lens("call").nodes.find((n) => n.id === "ai")!.detail).toContain(`one of ${word(CALL_OUTCOMES.length)} outcomes`);
    const call = (id: string) => lens("call").nodes.find((n) => n.id === id)!.detail;
    // "Who called, how they felt, and the summary": the Slack step's default message.
    for (const v of ["{{caller_number}}", "{{sentiment}}", "{{summary}}"]) expect(DEFAULT_SLACK_MESSAGE, v).toContain(v);
    const executor = read("lib/workflows/executor.ts");
    expect(executor).toContain("config.message?.trim() ? config.message : DEFAULT_SLACK_MESSAGE");
    expect(call("team")).toContain("who called, how they felt, and the summary");
    // "The workflow's success rate updates": the run's counters.
    expect(executor).toContain("rpc('increment_workflow_counters'");
    expect(call("log")).toContain("success rate updates");
  });

  it("takes the pay lens from the Stripe webhook and SmartBill as they run", () => {
    const handlers = said("app/api/billing/webhook/handlers.ts");
    expect(handlers).toContain("an invoicing hiccup can't hold back");
    expect(handlers).toContain("paymentSuccessEmail(");
    const emit = said("lib/smartbill/emit.ts");
    expect(emit).toContain("Idempotent on the Stripe invoice id");
    expect(emit).toContain("Idempotency guard");
    expect(read("lib/email/templates.ts")).toContain("Payment received");
    const pay = lens("pay");
    const detail = (id: string) => pay.nodes.find((n) => n.id === id)!.detail;
    // "One that fails is recorded too, so it shows in the dashboard."
    expect(emit).toContain("Record the failure so it surfaces in the dashboard");
    expect(read("lib/smartbill/emit.ts")).toContain("status: 'failed'");
    // "Checked before every fiscal invoice": the guard returns on any row, failed ones too. It
    // reads, then issues, and a read that errors counts as no row, so the page says what it
    // checks and never promises the outcome outright.
    expect(read("lib/smartbill/emit.ts")).toContain("if (existing) return");
    expect(read("lib/smartbill/emit.ts")).toContain("const { data: existing }");
    for (const s of strings([AUTO_FAQ, KINDS, AUTO_BUILD, pay])) expect(s).not.toMatch(/exactly one fiscal invoice|there’s one fiscal invoice|One fiscal invoice per payment/i);
    for (const s of ALL) expect(s).not.toMatch(/never (?:\w+ )?(?:two|a second) fiscal invoices?|isn’t invoiced (?:twice|again)/i);
    expect(detail("fiscal")).toContain("One that fails is recorded too");
    // Only a throw from dispatch makes the route answer 500 and Stripe resend; SmartBill's errors are caught and recorded, and a receipt that can't be sent is logged, never thrown.
    expect(read("app/api/billing/webhook/route.ts")).toContain("Stripe will retry it.");
    expect(read("lib/smartbill/emit.ts")).toMatch(/try \{[\s\S]*sbInvoices\.create[\s\S]*\} catch \(err\)/);
    expect(said("lib/email/client.ts")).toContain("Never throws");
    expect(detail("done")).not.toMatch(/Had a step failed/);
    expect(detail("done")).toContain("Had the renewal failed");
    expect(detail("done")).toContain("An invoice that fails is recorded");
    // "A link to view the invoice": SmartBill's PDF, or Stripe's own invoice page when there's none.
    expect(handlers).toContain("invoiceUrl = data.pdf_url");
    expect(handlers).toContain("invoiceUrl ?? invoice.hosted_invoice_url");
    expect(read("lib/email/templates.ts")).toContain("'View invoice'");
    expect(detail("email")).toContain("a link to view the invoice");
    // A repeat is caught while the done marker lives (DONE_TTL_SECONDS), and the caption says for how long.
    expect(pay.steps.find((s) => s.id === "done")!.caption).toContain(`${FACTS_AUTO.stripeDoneHours} hours`);
    // The renewal first, then the invoice: handlers.ts's order.
    expect(pay.steps.findIndex((s) => s.id === "renew")).toBeLessThan(pay.steps.findIndex((s) => s.id === "fiscal"));
  });

  it("bills a call's minutes once, from whichever of its two reports lands first", () => {
    expect(said("lib/billing/usage.ts")).toContain("bill it once");
    expect(AUTO_RUNNING.ledger.cards.find((c) => c.id === "minutes")!.files).toContain("app/api/elevenlabs/webhook/handlers.ts");
    // The morning job bills only what the phone line reported and nobody billed, and says so in both places.
    expect(read("lib/billing/usage.ts")).toContain(".not('twilio_call_sid', 'is', null)");
    expect(lens("morning").nodes.find((n) => n.id === "reconcile")!.detail).toContain("phone line");
    expect(lens("morning").steps.find((s) => s.id === "reconcile")!.caption).toContain("phone line");
    expect(AUTO_RUNNING.ledger.cards.find((c) => c.id === "minutes")!.body).toContain("phone line reported");
  });

  it("says what the FAQ promises about doing a thing twice, and no more", () => {
    expect(AUTO_FAQ.items.find((i) => i.id === "breaks")!.a).not.toContain("nothing is done twice");
    expect(AUTO_FAQ.items.find((i) => i.id === "complex")!.a).not.toContain("independent");
    // Three of the morning steps run in a chain: isolated, never "on their own".
    for (const s of strings([AUTO_BREAKS.guards, AUTO_BUILD])) expect(s).not.toMatch(/stand alone|on their own|independent/i);
    expect(AUTO_BREAKS.guards.map((g) => g.title).join(" ")).not.toMatch(/nothing (is )?done twice/i);
    expect(read("app/api/elevenlabs/webhook/handlers.ts")).toContain("kvIncr(`post-call:workflows:${callId}`");
    expect(read("lib/workflows/executor.ts")).toContain("customerWebhookHeaders({ body, secret, deliveryId,");
    const breaksAnswer = AUTO_FAQ.items.find((i) => i.id === "breaks")!.a;
    expect(breaksAnswer).toContain("a webhook that’s tried again carries the same reference");
    expect(breaksAnswer).not.toContain("a message that’s retried");
  });

  it("says of bookings, the waiting list and the team's alerts what their code says", () => {
    const reminders = said("lib/scheduling/reminders.ts");
    expect(reminders).toContain("is claimed (reminder_sent_at set) before its text goes out");
    expect(reminders).toContain("releases the claim");
    expect(said("lib/scheduling/waitlist.ts")).toContain("can't be promised one slot by the system");
    // A confirmation text goes out only when the caller agreed to one.
    expect(read("lib/voice/tools/definitions.ts")).toContain("true only if the caller agreed to receive a text confirmation");
    const bookings = AUTO_RUNNING.ledger.cards.find((c) => c.id === "bookings")!.body;
    expect(bookings).toContain("who asks for one");
    expect(bookings).not.toMatch(/every booking|each booking/i);
    // A mark that comes off when the send fails, said on both cards that mark before sending.
    expect(bookings).toContain("the mark comes off if the text fails");
    expect(said("lib/billing/usage.ts")).toContain("retried by the next billed call");
    expect(read("lib/billing/usage.ts")).toContain("await kvDel(key)");
    expect(AUTO_RUNNING.ledger.cards.find((c) => c.id === "usage")!.body).toContain("the next call that adds minutes tries again");
    expect(said("lib/voice/tools/notify.ts")).toContain(
      'only tells the caller "the team has been alerted" when a text or email really went out',
    );
  });

  it("refuses a private address where the record says it does: when the workflow is saved", () => {
    expect(read("lib/workflows/service.ts")).toContain("assertPublicHttpsUrl(action.config.url)");
    expect(AUTO_BREAKS.record.privateNote).toContain("when the workflow is saved");
  });

  it("points every block and ledger card at files that exist", () => {
    const files = [...LENSES.flatMap((l) => l.nodes.flatMap((n) => n.files)), ...AUTO_RUNNING.ledger.cards.flatMap((c) => c.files), AUTO_BREAKS.source.path];
    expect(files.length).toBeGreaterThan(40);
    for (const f of files) expect(has(f), f).toBe(true);
  });
});

describe("the break table", () => {
  /** One scenario re-run here, with this file's own scripted receiver and clock. */
  async function rerun(id: string) {
    const s = scenario(id);
    let clock = 0;
    let i = 0;
    const fetcher: WebhookFetcher = async (url) => {
      const answer: BreakAnswer = s.answers[Math.min(i++, s.answers.length - 1)];
      if (answer === "unsafe") {
        await assertPublicHttpsUrl(url);
        throw new Error("not refused");
      }
      if (answer === "timeout") {
        clock += WEBHOOK_TIMEOUT_MS;
        throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
      }
      return { status: answer, finalUrl: url };
    };
    const result = await deliverJson({
      url: s.url,
      body: "{}",
      headers: () => ({}),
      deadline: 240_000,
      fetcher,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    return { result, message: describeDelivery(result, { label: "Your endpoint", url: s.url }) };
  }

  it("is the same every time it is built, one row per scenario, in order", async () => {
    expect(await buildBreakTable()).toEqual(table);
    expect(table.map((r) => r.id)).toEqual(AUTO_BREAKS.scenarios.map((s) => s.id));
    expect(AUTO_BREAKS.scenarios.map((s) => s.id)).toContain(AUTO_BREAKS.initial);
  });

  it("words each row as the executor does for a customer webhook", async () => {
    expect(read("lib/workflows/executor.ts")).toContain("label: 'Your endpoint'");
    expect(ENDPOINT_LABEL).toBe("Your endpoint");
    for (const s of AUTO_BREAKS.scenarios) {
      const { result, message } = await rerun(s.id);
      const r = row(s.id);
      expect(r.message, s.id).toBe(message);
      expect(r.ok, s.id).toBe(result.ok);
      expect(r.attempts.length, s.id).toBe(result.attempts);
      expect(r.durationMs, s.id).toBe(result.duration_ms);
      expect(r.status, s.id).toBe(result.outcome.kind === "response" ? result.outcome.status : null);
      expect(r, s.id).toMatchObject({ ok: s.expect.ok });
      expect(r.attempts, s.id).toHaveLength(s.expect.attempts);
    }
  });

  it("gives the rows the build spec drew", () => {
    const at = (id: string) => row(id).attempts.map((a) => a.at);
    expect(at("ok")).toEqual([0]);
    expect(row("ok")).toMatchObject({ ok: true, status: 200, waits: [], durationMs: 0, message: "Your endpoint accepted it (200).", meta: "HTTP 200" });
    expect(at("busy")).toEqual([0, 1000]);
    expect(row("busy")).toMatchObject({ ok: true, status: 200, waits: [1000], durationMs: 1000, message: "Your endpoint accepted it (200) on attempt 2." });
    expect(at("down")).toEqual([0, 1000, 5000]);
    expect(row("down")).toMatchObject({ ok: false, status: 503, waits: [1000, 4000], durationMs: 5000, message: "crm.example.com answered 503 after 3 attempts.", meta: "3 attempts · 5.0 s · HTTP 503" });
    expect(at("slow")).toEqual([0, 11000, 25000]);
    expect(row("slow")).toMatchObject({ ok: false, status: null, waits: [1000, 4000], durationMs: 35000, meta: "3 attempts · 35 s" });
    expect(row("slow").message).toBe("crm.example.com didn’t answer within 10 seconds after 3 attempts.");
    expect(at("moved")).toEqual([0]);
    expect(row("moved")).toMatchObject({ ok: false, status: 404, meta: "HTTP 404" });
    expect(row("moved").message).toContain("the address no longer exists");
    expect(at("private")).toEqual([0]);
    expect(row("private")).toMatchObject({ ok: false, status: null, meta: "" });
    expect(row("private").message).toContain("private or internal network");
    // ↻ on every try the code followed with another; the last one carries ✓ or ✕.
    for (const r of table) r.attempts.forEach((a, k) => expect(a.retry, `${r.id} ${k}`).toBe(k < r.attempts.length - 1));
  });

  it("runs against two addresses that receive nothing", async () => {
    const hosts = AUTO_BREAKS.scenarios.map((s) => new URL(s.url).hostname);
    const privateHost = new URL(scenario("private").url).hostname;
    expect(isIP(privateHost)).toBe(4);
    expect(privateHost.startsWith("10.")).toBe(true);
    // Refused on the literal, before any lookup: the build stays offline.
    await expect(assertPublicHttpsUrl(scenario("private").url)).rejects.toThrow(/private or reserved/);
    for (const h of hosts.filter((h) => h !== privateHost)) expect(h.endsWith(".example.com"), h).toBe(true);
    expect(AUTO_CREDITS.items.find((i) => i.term === "When it breaks")!.detail).toContain("example.com");
  });

  it("prints each row's meta line as the dashboard builds it", () => {
    const list = read("components/workflows/ActionResultList.tsx");
    for (const phrase of ["`${result.attempts} attempts`", "toFixed(ms < 10_000 ? 1 : 0)", "`HTTP ${result.status_code}`", "meta.join(' · ')", "'Skipped'"]) {
      expect(list, phrase).toContain(phrase);
    }
    for (const r of table) expect(r.meta, r.id).toBe(resultMeta(r.attempts.length, r.durationMs, r.status));
    expect(resultMeta(1, 420, 200)).toBe("420 ms · HTTP 200");
    expect(resultMeta(2, 12_345, null)).toBe("2 attempts · 12 s");
  });

  it("uses the run history's own words", () => {
    const sheet = read("components/workflows/RunHistorySheet.tsx");
    expect(sheet).toContain("'Succeeded'");
    expect(sheet).toContain("'Failed'");
    expect(AUTO_BREAKS.record.status).toEqual({ completed: "Succeeded", failed: "Failed" });
    const executor = read("lib/workflows/executor.ts");
    expect(executor).toContain("Didn’t run because an earlier step failed.");
    expect(executor).toContain("Message posted to Slack.");
    expect(executor).toContain("Tag “${tag}” added to the call.");
    expect(AUTO_BREAKS.record.skipped).toBe("Didn’t run because an earlier step failed.");
    expect(AUTO_BREAKS.record.slack).toBe("Message posted to Slack.");
    expect(AUTO_BREAKS.record.tag).toBe("Tag “follow-up” added to the call.");
    expect(AUTO_BREAKS.workflow.steps[0].label).toContain("“follow-up”");
    expect(AUTO_BREAKS.record.labels.tag).toBe(ACTION_META.add_tag.label);
    expect(read("components/workflows/ActionResultList.tsx")).toContain("'Skipped'");
  });

  it("fits every try on the trace's axis", () => {
    // trace.tsx lays each mark at `at / axisMs` (spec §5.4.3).
    const axisMs = (durationMs: number) => Math.max(2000, Math.ceil(durationMs / 1000) * 1000 + 1000);
    for (const r of table) {
      const axis = axisMs(r.durationMs);
      expect(axis, r.id).toBeGreaterThanOrEqual(r.durationMs + 1000);
      const ticks = r.attempts.map((a) => a.at);
      expect(new Set(ticks).size, r.id).toBe(ticks.length);
      for (const t of ticks) expect(t, r.id).toBeLessThan(axis);
      expect(r.waits.reduce((a, b) => a + b, 0), r.id).toBeLessThanOrEqual(r.durationMs);
    }
  });
});

describe("the workbench", () => {
  const NOW_STEPS: Record<RunLensId, Partial<Record<ManualId, number>>> = {
    pay: { m1: 1, m6: 4, m2: 5, m3: 6, m4: 6, m5: 7 },
    morning: { m1: 2, m2: 3, m3: 4, m4: 5, m5: 6, m6: 7 },
    document: { m1: 2, m5: 3, m2: 4, m3: 4, m4: 5 },
    call: { m1: 3, m2: 3, m3: 3, m4: 7, m6: 7, m5: 8 },
  };
  const METERS: Record<RunLensId, Meters> = {
    pay: { blocks: 8, rules: true, ai: false, person: false, schedule: false, once: true },
    morning: { blocks: 10, rules: false, ai: false, person: false, schedule: true, once: true },
    document: { blocks: 7, rules: false, ai: true, person: false, schedule: false, once: true },
    call: { blocks: 9, rules: true, ai: true, person: true, schedule: false, once: true },
  };
  /** Where each manual step lands, worked out from the data: the first step whose block replaced it. */
  const landsAt = (l: RunLens) => {
    const out: Partial<Record<ManualId, number>> = {};
    l.steps.forEach((s, k) => {
      const node = l.nodes.find((n) => n.id === arrival(l, s));
      for (const m of node?.was ?? []) out[m] ??= k + 1;
    });
    return out;
  };

  it("runs four lenses, simplest first, starting on a customer paying", () => {
    expect(LENSES.map((l) => l.id)).toEqual(["pay", "morning", "document", "call"]);
    expect(AUTO_RUNNING.initial).toBe("pay");
  });

  it("keeps each lens to a size the workbench can draw", () => {
    for (const l of LENSES) {
      expect(l.steps.length, l.id).toBeLessThanOrEqual(10);
      expect(l.manual.length, l.id).toBeLessThanOrEqual(6);
      expect(l.tools.length, l.id).toBeLessThanOrEqual(4);
      expect(l.copies.length, l.id).toBeGreaterThanOrEqual(1);
      expect(l.copies.length, l.id).toBeLessThanOrEqual(2);
      const tools = l.tools.map((t) => t.id);
      for (const c of l.copies) {
        expect(c.label.length, c.label).toBeLessThanOrEqual(18);
        expect(tools, c.label).toContain(c.from);
        expect(tools, c.label).toContain(c.to);
      }
      for (const m of l.manual) expect(tools, `${l.id}/${m.id}`).toContain(m.tool);
      for (const t of tools) expect(l.manual.some((m) => m.tool === t), `${l.id}/${t}`).toBe(true);
      expect(l.manual.map((m) => m.id), l.id).toEqual(l.manual.map((_, k) => `m${k + 1}`));
      expect(new Set(l.steps.map((s) => s.id)).size, l.id).toBe(l.steps.length);
      expect(l.hand, l.id).not.toMatch(/\{[nk]\}/);
      // The line opens on its count ("Six steps across four tools…"), capitalised:
      // the caption's mark above it already says "By hand", and "Built" above `built`.
      expect(l.hand.toLowerCase(), l.id).toMatch(new RegExp(`^${word(l.manual.length)} `));
      expect(l.hand, l.id).toContain(` ${word(l.tools.length)} `);
      for (const line of [l.hand, l.built]) {
        expect(line, l.id).toMatch(/^[A-Z]/);
        expect(line, l.id).not.toMatch(/^(By hand|Built)\b/);
      }
      // A block that replaced no manual step prints its `fresh` line in the
      // inspector with no "By hand, this was" over it: the line says it.
      for (const n of l.nodes) if (n.fresh) expect(n.fresh.toLowerCase(), `${l.id}/${n.id}`).toContain("by hand");
    }
  });

  it("holds every lens together: hops, rings, ends, manual steps", () => {
    for (const l of LENSES) {
      const nodes = new Set(l.nodes.map((n) => n.id));
      const groups = new Set<string>((l.groups ?? []).map((g) => g.id));
      const edges = new Map(l.edges.map((e) => [e.id, e]));
      const manual = new Set<string>(l.manual.map((m) => m.id));
      expect(nodes.size, l.id).toBe(l.nodes.length);
      for (const e of l.edges) {
        expect(e.id, l.id).toBe(`${e.from}-${e.to}`);
        for (const end of [e.from, e.to]) expect(nodes.has(end) || groups.has(end), `${l.id}/${e.id}: ${end}`).toBe(true);
        if (e.label !== undefined) expect(["yes", "no"], `${l.id}/${e.id}`).toContain(e.label);
      }
      for (const n of l.nodes) {
        expect(n.label.length, n.label).toBeLessThanOrEqual(22);
        if (n.datum) expect(n.datum.length, n.datum).toBeLessThanOrEqual(16);
        for (const m of n.was ?? []) expect(manual.has(m), `${l.id}/${n.id}: ${m}`).toBe(true);
        if (!n.end && !n.was?.length) expect(n.fresh, `${l.id}/${n.id}`).toBeTruthy();
        if (n.group) expect(groups.has(n.group), `${l.id}/${n.id}`).toBe(true);
        expect(n.files.length, `${l.id}/${n.id}`).toBeGreaterThan(0);
      }
      for (const m of manual) expect(l.nodes.some((n) => n.was?.includes(m as ManualId)), `${l.id}: ${m}`).toBe(true);
      // Every hop leaves a block the run has already reached, or a group with one inside.
      const reached = new Set<string>();
      for (const s of l.steps) {
        expect((s.hops?.length ?? 0) + (s.ring?.length ?? 0), `${l.id}/${s.id}`).toBeGreaterThan(0);
        for (const h of s.hops ?? []) {
          const e = edges.get(h);
          expect(e, `${l.id}/${s.id}: ${h}`).toBeDefined();
          const entered = groups.has(e!.from) && l.nodes.some((n) => n.group === e!.from && reached.has(n.id));
          expect(reached.has(e!.from) || entered, `${l.id}/${s.id}: ${h} before ${e!.from}`).toBe(true);
          reached.add(e!.to);
        }
        for (const r of s.ring ?? []) {
          expect(nodes.has(r), `${l.id}/${s.id}: ${r}`).toBe(true);
          reached.add(r);
        }
        expect(arrival(l, s), `${l.id}/${s.id}`).not.toBeNull();
      }
    }
  });

  it("lands each manual step where the build spec's table says", () => {
    for (const l of LENSES) expect(landsAt(l), l.id).toEqual(NOW_STEPS[l.id]);
  });

  it("follows the daily route in the morning lens: its steps in order, three in a chain", () => {
    const m = lens("morning");
    const crons = m.steps.flatMap((s) => {
      const node = m.nodes.find((n) => n.id === arrival(m, s));
      return node?.cron ? [node.cron] : [];
    });
    expect(crons).toEqual(FACTS.cronSteps);
    const inGroup = (g: string) => m.nodes.filter((n) => n.group === g).map((n) => n.cron);
    expect(inGroup("order")).toEqual(FACTS.cronSteps.slice(0, FACTS_AUTO.billingChain));
    expect([...inGroup("side")].sort()).toEqual(FACTS.cronSteps.slice(FACTS_AUTO.billingChain).sort());
    expect(m.label).toBe(`Every morning at ${FACTS.cronAt}`);
  });

  it("works each lens's meters out from its blocks, and climbs from the simplest", () => {
    const counts = LENSES.map((l) => {
      const m = metersOf(blocks(l).map((n) => n.kind));
      expect(m, l.id).toEqual(METERS[l.id]);
      return hardCount(m);
    });
    expect(counts).toEqual([2, 2, 2, 4]);
    counts.slice(1).forEach((n, k) => expect(n, LENSES[k + 1].id).toBeGreaterThanOrEqual(counts[k]));
    expect(counts.at(-1)).toBe(Math.max(...counts));
    expect(counts.at(-1)).toBeGreaterThan(counts[0]);
  });

  it("links every lens and block check somewhere real", () => {
    const checks = [...LENSES.map((l) => l.check), ...LENSES.flatMap((l) => l.nodes.flatMap((n) => (n.check ? [n.check] : [])))];
    expect(checks.length).toBeGreaterThan(LENSES.length);
    for (const c of checks) {
      expect(Object.keys(CHECK_KINDS), c.label).toContain(c.kind);
      if (c.kind === "site") expect(c.href, c.label).toBeTruthy();
    }
  });

  it("gives every ledger card a when, a body of one or two sentences, and no file on its face", () => {
    const cards = AUTO_RUNNING.ledger.cards;
    expect(cards.map((c) => c.id)).toEqual(["notify", "bookings", "waitlist", "usage", "minutes", "workflows"]);
    for (const c of cards) {
      expect(split(c.body).length, c.id).toBeLessThanOrEqual(2);
      expect(c.body, c.id).not.toMatch(/\b[\w-]+\/[\w./-]+\.tsx?\b/);
      expect(c.files.length, c.id).toBeGreaterThan(0);
    }
  });

  describe("its frame (workbench-frame.ts)", () => {
    const { blocksOf, buildOrder, currentsOf, fill, frameOf, inspected, lensOf, nodeState, nowSteps } = frameKit;

    it("stops each step on the block the data says it arrives at", () => {
      for (const l of LENSES) expect(currentsOf(l), l.id).toEqual(l.steps.map((s) => arrival(l, s)));
    });

    it("ends every lens on its last step's block, with every manual step handed over", () => {
      for (const l of LENSES) {
        const last = l.steps.length - 1;
        const frame = frameOf(l, { phase: "built", step: last });
        expect(frame.current, l.id).toBe(arrival(l, l.steps[last]));
        expect([...frame.handed].sort(), l.id).toEqual(l.manual.map((m) => m.id).sort());
        for (const s of l.steps) for (const h of s.hops ?? []) expect(frame.traversed.has(h), `${l.id}: ${h}`).toBe(true);
        // Before the flow is built: nothing handed over, every block a ghost.
        const hand = frameOf(l, { phase: "hand", step: -1 });
        expect([...hand.handed], l.id).toEqual([]);
        for (const n of l.nodes) expect(nodeState(hand, n), `${l.id}/${n.id}`).toBe("ghost");
      }
    });

    it("draws the server's frame: a customer paid, and the event is marked done", () => {
      const pay = lensOf(AUTO_RUNNING, AUTO_RUNNING.initial);
      expect(pay.id).toBe("pay");
      const frame = frameOf(pay, { phase: "built", step: 7 });
      expect(frame.step).toBe(pay.steps.length - 1);
      expect(frame.current).toBe("done");
      const state = (id: string) => nodeState(frame, pay.nodes.find((n) => n.id === id)!);
      expect(state("done")).toBe("current");
      for (const id of ["event", "sig", "seen", "renew", "issued", "fiscal", "email"]) expect(state(id), id).toBe("passed");
      // The branches this payment didn't take: dashed, muted.
      for (const id of ["refused", "ack", "skip"]) expect(state(id), id).toBe("off");
    });

    it("lands each manual step where the table says", () => {
      for (const l of LENSES) {
        expect(nowSteps(l), l.id).toEqual(NOW_STEPS[l.id]);
        expect(frameOf(l, { phase: "built", step: 0 }).nowStep, l.id).toEqual(NOW_STEPS[l.id]);
      }
    });

    it("lays every block once, meters the blocks it runs, and fills its templates", () => {
      for (const l of LENSES) {
        expect(buildOrder(l).map((n) => n.id).sort(), l.id).toEqual(l.nodes.map((n) => n.id).sort());
        expect(metersOf(blocksOf(l)), l.id).toEqual(METERS[l.id]);
      }
      expect(fill(AUTO_RUNNING.stepOf, { n: 3, total: 8 })).toBe("Step 3 of 8");
      expect(fill(AUTO_RUNNING.liveLens, { label: "A customer pays", total: 8, blocks: 8 })).toBe("A customer pays: 8 steps, 8 blocks.");
    });

    it("shows a step picked below md, and holds the last block below md while a tour plays", () => {
      for (const l of LENSES) {
        const last = l.steps.length - 1;
        const end = frameOf(l, { phase: "built", step: last }).current;
        for (let i = 0; i <= last; i++) {
          const frame = frameOf(l, { phase: "built", step: i });
          for (const md of [false, true]) expect(inspected(l, { pick: null, frame, md, touring: false }), `${l.id} step ${i} md=${md}`).toBe(frame.current);
          // Below md the inspector sits under the list: a tour moving it would move the page.
          expect(inspected(l, { pick: null, frame, md: false, touring: true }), `${l.id} step ${i} touring`).toBe(end);
          expect(inspected(l, { pick: null, frame, md: true, touring: true }), `${l.id} step ${i} md touring`).toBe(frame.current);
        }
        // Before the first tour, below md: the last block already, so nothing jumps when it starts.
        const hand = frameOf(l, { phase: "hand", step: -1 });
        expect(inspected(l, { pick: null, frame: hand, md: false, touring: false }), l.id).toBe(end);
        expect(inspected(l, { pick: null, frame: hand, md: false, touring: true }), l.id).toBe(end);
        expect(inspected(l, { pick: null, frame: hand, md: true, touring: false }), l.id).toBe(frameOf(l, { phase: "built", step: 0 }).current);
        // A pick always wins.
        const other = l.nodes[0].id;
        for (const md of [false, true]) for (const touring of [false, true]) expect(inspected(l, { pick: other, frame: hand, md, touring }), l.id).toBe(other);
      }
    });
  });

  describe("its xl drawing (workbench-geometry.ts)", () => {
    const { CARD, END, GROUP_PAD, VIEW, boxOf, edgePath, edgePoints, endBox, groupBox, labelAt, viewH, x, y } = geometry;
    const sides = (b: { x: number; y: number; w: number; h: number }): Box => ({ l: b.x, t: b.y, r: b.x + b.w, b: b.y + b.h });
    /** The line as it is drawn: its `d`, rounded corners and all, read back into points. */
    const drawn = (l: RunLens, e: RunEdge) => pointsOfD(edgePath(l, e));

    it("keeps the build spec's grid: a 1000 × 344 drawing, cards 147u and 124u apart", () => {
      expect(VIEW).toEqual({ w: 1000, h: 344 });
      expect(CARD).toEqual({ w: 118, h: 66 });
      expect(END).toEqual({ w: 118, h: 44 });
      expect(GROUP_PAD).toBe(8);
      expect([0, 1, 2, 3, 4, 5, 6].map(x)).toEqual([0, 147, 294, 441, 588, 735, 882]);
      expect([0, 1, 2].map(y)).toEqual([14, 138, 262]);
      for (const l of LENSES) {
        for (const n of l.nodes) {
          // An end card is centred on its row.
          const t = y(n.at.r) + (n.end ? 11 : 0);
          expect(sides(boxOf(n)), `${l.id}/${n.id}`).toEqual({ l: x(n.at.c), t, r: x(n.at.c) + 118, b: t + (n.end ? 44 : 66) });
        }
      }
      const m = lens("morning");
      expect(sides(groupBox(m, "order"))).toEqual({ l: 139, t: 6, r: 567, b: 88 });
      expect(sides(groupBox(m, "side"))).toEqual({ l: 139, t: 130, r: 567, b: 336 });
    });

    it("is as tall as each lens's rows: 344u for three, 220u for two, never above VIEW.h", () => {
      const want: Record<RunLensId, number> = { pay: 344, morning: 344, document: 220, call: 344 };
      for (const l of LENSES) {
        const h = viewH(l);
        expect(h, l.id).toBe(want[l.id]);
        expect(h, l.id).toBeLessThanOrEqual(VIEW.h);
        const lowest = Math.max(
          ...l.nodes.map((n) => boxOf(n).y + boxOf(n).h),
          ...(l.groups ?? []).map((g) => groupBox(l, g.id).y + groupBox(l, g.id).h),
        );
        expect(h - lowest, `${l.id}: room under the lowest card or frame`).toBeGreaterThanOrEqual(8);
      }
    });

    it("places every block once, inside the drawing, overlapping none", () => {
      for (const l of LENSES) {
        const cells = l.nodes.map((n) => `${n.at.c},${n.at.r}`);
        expect(new Set(cells).size, l.id).toBe(cells.length);
        const boxes = l.nodes.map((n) => [n.id, sides(boxOf(n))] as const);
        for (const [id, b] of boxes) {
          expect(b.l >= 0 && b.t >= 0 && b.r <= VIEW.w && b.b <= viewH(l), `${l.id}/${id} inside the drawing`).toBe(true);
          for (const [other, ob] of boxes) if (other !== id) expect(overlap(b, ob), `${l.id}: ${id} over ${other}`).toBe(false);
        }
      }
    });

    it("starts and ends every edge on its own blocks, and keeps it clear of every other", () => {
      for (const l of LENSES) {
        for (const e of l.edges) {
          const where = `${l.id}/${e.id}`;
          const line = edgePoints(l, e);
          const pts = drawn(l, e);
          // The drawn path is the polyline, its corners rounded: the same two ends.
          expect(pts[0], where).toEqual(line[0]);
          expect(pts.at(-1), where).toEqual(line.at(-1));
          expect(onBorder(pts[0], sides(endBox(l, e.from))), `${where} starts on ${e.from}`).toBe(true);
          expect(onBorder(pts.at(-1)!, sides(endBox(l, e.to))), `${where} ends on ${e.to}`).toBe(true);
          // Orthogonal: every run of the polyline is level or upright.
          for (let k = 1; k < line.length; k++) expect(line[k][0] === line[k - 1][0] || line[k][1] === line[k - 1][1], where).toBe(true);
          const samples = along(pts);
          for (const s of samples) expect(s[0] >= 0 && s[0] <= VIEW.w && s[1] >= 0 && s[1] <= viewH(l), `${where} inside`).toBe(true);
          for (const n of l.nodes) {
            if (n.id === e.from || n.id === e.to) continue;
            // A block inside a frame the edge starts or ends on is still a block it must miss.
            const b = sides(boxOf(n));
            expect(Math.min(...samples.map((s) => gap(s, b))), `${where} runs into ${n.id}`).toBeGreaterThanOrEqual(4);
          }
          for (const g of l.groups ?? []) {
            const holds = [e.from, e.to].some((end) => end === g.id || l.nodes.some((n) => n.id === end && n.group === g.id));
            if (holds) continue;
            const b = sides(groupBox(l, g.id));
            expect(Math.min(...samples.map((s) => gap(s, b))), `${where} runs into the ${g.id} frame`).toBeGreaterThanOrEqual(4);
          }
        }
      }
    });

    it("lets two edges share a stretch only where they share a block", () => {
      const together = (l: RunLens, a: RunEdge, b: RunEdge) => {
        const pb = drawn(l, b);
        return along(drawn(l, a)).filter((s) => off(s, pb) < 0.5).length * 0.5;
      };
      for (const l of LENSES) {
        for (const a of l.edges) {
          for (const b of l.edges) {
            if (a.id >= b.id || [a.from, a.to].some((end) => end === b.from || end === b.to)) continue;
            expect(together(l, a, b), `${l.id}: ${a.id} and ${b.id} run together`).toBeLessThan(3);
          }
        }
      }
      // The morning's summary is reached two ways that join before it: allowed, both are lit on one step.
      const m = lens("morning");
      const edge = (id: string) => m.edges.find((e) => e.id === id)!;
      expect(together(m, edge("overage-summary"), edge("side-summary"))).toBeGreaterThan(3);
      expect(m.steps.find((s) => s.hops?.includes("overage-summary"))?.hops).toContain("side-summary");
    });

    it("sets every branch's word beside its own edge, on no block, and no word where there is no branch", () => {
      for (const l of LENSES) {
        for (const e of l.edges) {
          const at = labelAt(l, e);
          if (!e.label) {
            expect(at, `${l.id}/${e.id}`).toBeNull();
            continue;
          }
          expect(at, `${l.id}/${e.id}`).not.toBeNull();
          const pt = [at!.x, at!.y] as const;
          expect(pt[0] >= 0 && pt[0] <= VIEW.w && pt[1] >= 0 && pt[1] <= viewH(l), `${l.id}/${e.id}`).toBe(true);
          // 6u off the middle of its longest run.
          expect(off(pt, edgePoints(l, e)), `${l.id}/${e.id} beside its edge`).toBeCloseTo(6, 5);
          for (const n of l.nodes) expect(gap(pt, sides(boxOf(n))), `${l.id}/${e.id} on ${n.id}`).toBeGreaterThan(0);
        }
      }
    });
  });
});

/* ---------- the drawing's measures (the SaaS map test's, over any polyline) ---------- */

type Pt = readonly [number, number];
type Box = { l: number; t: number; r: number; b: number };

/**
 * An SVG path's `d`, as workbench-geometry.ts writes it (`M`, `L`, and a
 * `Q` at every rounded corner), read back into points: each command's
 * end, and each corner sampled along its curve. Anything else throws: a
 * change to the generator must be read here too.
 */
function pointsOfD(d: string): Pt[] {
  const out: Pt[] = [];
  const commands = [...d.matchAll(/([MLQ])([^MLQ]*)/g)];
  if (commands.map((c) => c[0]).join("") !== d.trim()) throw new Error(`a path I can't read: ${d}`);
  for (const [, cmd, args] of commands) {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (n.some((v) => !Number.isFinite(v)) || n.length !== (cmd === "Q" ? 4 : 2)) throw new Error(`a path I can't read: ${d}`);
    if (cmd === "Q") {
      const [p0x, p0y] = out.at(-1)!;
      for (let f = 1; f <= 20; f++) {
        const t = f / 20;
        const u = 1 - t;
        out.push([u * u * p0x + 2 * u * t * n[0] + t * t * n[2], u * u * p0y + 2 * u * t * n[1] + t * t * n[3]]);
      }
    } else out.push([n[0], n[1]]);
  }
  return out;
}
/** Every half unit along a route. */
const along = (pts: readonly Pt[]): Pt[] =>
  pts.slice(1).flatMap(([x1, y1], k) => {
    const [x0, y0] = pts[k];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5));
    return Array.from({ length: n + 1 }, (_, f) => [x0 + ((x1 - x0) * f) / n, y0 + ((y1 - y0) * f) / n] as const);
  });
/** How far a point is from a box (0 on or inside it). */
const gap = ([px, py]: Pt, b: Box) => Math.hypot(Math.max(b.l - px, 0, px - b.r), Math.max(b.t - py, 0, py - b.b));
const onBorder = (pt: Pt, b: Box) =>
  gap(pt, b) <= 1 && Math.min(Math.abs(pt[0] - b.l), Math.abs(pt[0] - b.r), Math.abs(pt[1] - b.t), Math.abs(pt[1] - b.b)) <= 1;
const overlap = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
/** How far a point is from a route. */
const off = ([px, py]: Pt, pts: readonly Pt[]) =>
  Math.min(
    ...pts.slice(1).map(([x1, y1], k) => {
      const [x0, y0] = pts[k];
      const len = (x1 - x0) ** 2 + (y1 - y0) ** 2;
      const t = len ? Math.max(0, Math.min(1, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / len)) : 0;
      return Math.hypot(px - (x0 + t * (x1 - x0)), py - (y0 + t * (y1 - y0)));
    }),
  );

describe("#work", () => {
  const FIELDS: FieldId[] = ["finance", "sales", "service", "operations", "people", "shops"];
  const LEVELS: LevelId[] = ["copy", "process", "pipeline"];
  const flow = (s: (typeof SAMPLES)[number]) => MOVES.flatMap((m) => s.moves[m.id]?.flow ?? []);
  // The build spec's table (§3.5.1): blocks at each level, field by field.
  const BLOCKS: Record<FieldId, [number, number, number]> = {
    finance: [4, 7, 9],
    sales: [4, 7, 8],
    service: [3, 8, 9],
    operations: [3, 7, 8],
    people: [3, 6, 8],
    shops: [3, 6, 7],
  };
  const KIND_IDS = Object.keys(KINDS) as BlockKind[];

  it("has one sample for each of six fields at each of three levels", () => {
    expect(AUTO_WORK.fields.map((f) => f.id)).toEqual(FIELDS);
    expect(AUTO_WORK.levels.map((l) => l.id)).toEqual(LEVELS);
    expect(SAMPLES).toHaveLength(18);
    expect(SAMPLES.map((s) => s.id)).toEqual(FIELDS.flatMap((f) => LEVELS.map((l) => `${f}-${l}`)));
    for (const s of SAMPLES) expect(s.id).toBe(`${s.field}-${s.level}`);
    expect(SAMPLES.map((s) => s.id)).toContain(`${AUTO_WORK.initial.field}-${AUTO_WORK.initial.level}`);
    expect(AUTO_WORK.moves.map((m) => m.id)).toEqual(["arrives", "read", "entered", "passed", "followed", "decided"]);
  });

  it("makes each sample of the six moves and the page's blocks, arriving first", () => {
    const moves = MOVES.map((m) => m.id as string);
    for (const s of SAMPLES) {
      for (const [m, move] of Object.entries(s.moves)) {
        expect(moves, `${s.id}: ${m}`).toContain(m);
        expect(move!.flow.length, `${s.id}: ${m}`).toBeGreaterThan(0);
        expect(move!.hand.length, `${s.id}: ${m}`).toBeGreaterThan(0);
        for (const b of move!.flow) expect(KIND_IDS, `${s.id}: ${b.text}`).toContain(b.kind);
      }
      expect(s.moves.arrives, s.id).toBeDefined();
      expect(["when", "time"], s.id).toContain(flow(s)[0].kind);
    }
  });

  it("grows with the difficulty: more blocks at each level, a person in every pipeline", () => {
    for (const f of FIELDS) {
      const counts = LEVELS.map((l) => flow(SAMPLES.find((s) => s.id === `${f}-${l}`)!).length);
      expect(counts, f).toEqual(BLOCKS[f]);
      expect(counts[0], f).toBeLessThan(counts[1]);
      expect(counts[1], f).toBeLessThan(counts[2]);
    }
    for (const s of SAMPLES) {
      const kinds = flow(s).map((b) => b.kind);
      if (s.level === "copy") {
        expect(kinds.length, s.id).toBeLessThanOrEqual(4);
        expect(kinds, s.id).not.toContain("ai");
        expect(kinds, s.id).not.toContain("approve");
        expect(s.hard, s.id).toBeUndefined();
      } else {
        expect(s.hard, s.id).toBeTruthy();
      }
      if (s.level === "pipeline") expect(metersOf(kinds).person, s.id).toBe(true);
    }
  });

  it("never looks easier a level up, and glosses each level only with what all its samples have", () => {
    // "What makes it hard": the meters a level up meet at least as many
    // yes marks as the level below, field by field, as the lenses climb.
    const hard = (f: FieldId, l: LevelId) => hardCount(metersOf(flow(SAMPLES.find((s) => s.id === `${f}-${l}`)!).map((b) => b.kind)));
    for (const f of FIELDS) {
      const [copy, process, pipeline] = LEVELS.map((l) => hard(f, l));
      expect(process, f).toBeGreaterThanOrEqual(copy);
      expect(pipeline, f).toBeGreaterThanOrEqual(process);
    }
    // The gloss is printed over every sample at its level, so it names only what each of them has.
    const NEEDS: [RegExp, BlockKind[]][] = [
      [/\bAI\b/, ["ai"]], [/\bwaits?\b/i, ["wait"]], [/\brules?\b/i, ["rule"]], [/\bschedules?\b/i, ["time"]],
      [/\bpeople\b|\bperson\b/i, ["person", "approve"]], [/\bretr(?:y|ies)\b/i, ["retry"]],
    ];
    let glossed = 0;
    for (const l of AUTO_WORK.levels) {
      const at = SAMPLES.filter((s) => s.level === l.id);
      for (const [says, kinds] of NEEDS) {
        if (!says.test(l.gloss)) continue;
        glossed++;
        for (const s of at) expect(flow(s).some((b) => kinds.includes(b.kind)), `${l.id} gloss, ${s.id}: ${says}`).toBe(true);
      }
      if (/nothing to decide/i.test(l.gloss)) {
        for (const s of at) expect(flow(s).some((b) => b.kind === "rule" || b.kind === "approve"), s.id).toBe(false);
      }
    }
    expect(glossed).toBeGreaterThanOrEqual(3);
  });

  it("keeps the samples samples: no digit, no brand, no business", () => {
    const text = strings(SAMPLES);
    expect(text.length).toBeGreaterThan(150);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    const NAMES = [...REGISTRY, "Pipedrive", "Zoho", "Airtable", "Notion", "Mailchimp", "PayPal", "Outlook", "Excel", "Sage", "Monday.com", "Asana", "Trello", "Jira"];
    for (const mark of NAMES) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(AUTO_WORK.foot).toContain("written for this page");
    expect(AUTO_WORK.tag.startsWith("Sample")).toBe(true);
    expect(SOURCE).toMatch(/const SAMPLES: readonly Sample\[\] = \[ \/\/ SAMPLE/);
  });

  it("says where each kind of block already runs, and says the two thin spots once", () => {
    expect(KINDS.wait.ours).toBe("thin");
    expect(KINDS.approve.ours).toBe("none");
    const lenses = LENSES.map((l) => l.id as string);
    const anchors = [...SECTION_IDS, ...AUTO_RUNNING.ledger.cards.map((c) => `run-${c.id}`), ...lenses.map((l) => `run-${l}`)];
    for (const k of KIND_IDS) {
      const info = KINDS[k];
      if (info.ours !== "does") {
        expect(info.proof, k).toBeUndefined();
        continue;
      }
      expect(info.proof.length, k).toBeGreaterThan(0);
      if ("lens" in info.show) expect(lenses, k).toContain(info.show.lens);
      else expect(anchors, k).toContain(info.show.href.slice(1));
    }
    // A "does" kind runs in the lens it points at.
    for (const k of KIND_IDS) {
      const show = KINDS[k].show;
      if (show && "lens" in show) expect(lens(show.lens).nodes.some((n) => n.kind === k), `${k} in ${show.lens}`).toBe(true);
    }
    expect(KINDS_NOTE).toContain(String(FACTS_AUTO.waitMaxSeconds));
    expect([...new Set(ALL.filter((s) => /at most[^.]*seconds?/i.test(s)))]).toEqual([KINDS_NOTE]);
    expect(AUTO_WORK.ours).toEqual({ does: "Runs here", thin: "Short here", none: "Built for yours" });
    // Some samples use a kind this platform doesn't run, so no line of #work
    // may say every block does: each that says they run here says which.
    const unrun = SAMPLES.filter((s) => flow(s).some((b) => KINDS[b.kind].ours !== "does"));
    expect(unrun.length).toBeGreaterThan(0);
    const runs = [AUTO_WORK.sub, AUTO_WORK.proofTitle].flatMap(split).filter((s) => /\bruns? (?:here|on this platform)\b/i.test(s));
    expect(runs.length).toBeGreaterThan(0);
    for (const s of runs) expect(s, s).toMatch(/\bwhich\b|\bmost\b/i);
  });

  it("says 'Watch it run' only on a link that opens a workbench lens, and 'See it on this page' on a jump", () => {
    expect(AUTO_WORK.watch).toBe("Watch it run");
    expect(AUTO_WORK.see).toBe("See it on this page");
    const src = read(`${DIR}/work-instrument.tsx`);
    expect(src).toContain('label={"lens" in info.show ? data.watch : data.see}');
    expect(src.match(/data\.watch\b/g)).toHaveLength(1);
  });
});

/*
 * Third-party names a page like this could print (the SaaS test's
 * registry, with the automation tools and the brands a sample might
 * reach for). Each one printed must be credited in a line that says
 * whose trademark it is, and none may appear in a sample.
 */
const REGISTRY = [
  "Anthropic", "Claude", "Google", "Gmail", "Android", "Apple", "iOS", "Microsoft", "Amazon", "AWS", "GitHub",
  "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Supabase", "Postgres", "PostgreSQL", "Twilio", "Telnyx",
  "Vercel", "Next.js", "Node.js", "React", "Fly.io", "Slack", "Upstash", "Redis", "WhatsApp",
  "Zapier", "Make", "n8n", "HubSpot", "Salesforce", "Xero", "QuickBooks", "Shopify", "DocuSign",
];
/** Whether a mark is named: "Make" only as a name, never as the verb that starts a sentence. */
function named(mark: string, s: string): boolean {
  if (mark === "Make") return /(?<!^\s*|[.!?:]\s*|[“‘"(]\s*)\bMake\b/.test(s);
  return new RegExp(`\\b${mark.replace(/[.]/g, "\\.")}\\b`).test(s);
}

describe("honesty", () => {
  it("prints no price, duration, standard or scale claim, and no date", () => {
    const banned =
      /[$€£]\s?\d|\b\d+\s*(?:days?|weeks?|months?|years?)\b|\bSOC ?2\b|\bISO ?27001\b|\bHIPAA\b|\bcertified\b|\bin production\b|at scale/i;
    expect(ALL.filter((s) => banned.test(s))).toEqual([]);
    const month = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    expect(ALL.filter((s) => /\b(?:19|20)\d{2}\b/.test(s) || month.test(s))).toEqual([]);
  });

  it("prints no time saved and no return on it", () => {
    const saved = /\b\d+\s*(?:%|x|×|hours?|minutes?)\s+(?:saved|faster|less|fewer)|\bsav(?:e|es|ed|ing)\s+\d|\bROI\b/i;
    expect(ALL.filter((s) => saved.test(s))).toEqual([]);
  });

  it("prints a percentage only for the usage marks, and a plus only on the accreditations", () => {
    const pct = ALL.flatMap((s) => [...s.matchAll(/(\d*)%/g)].map((m) => m[0]));
    expect(pct.length).toBeGreaterThan(0);
    for (const p of pct) expect(["80%", "100%"], p).toContain(p);
    const plus = ALL.flatMap((s) => s.match(/\d+\+/g) ?? []);
    expect(plus.length).toBeGreaterThan(0);
    for (const p of plus) expect(p).toBe(ACC);
  });

  it("uses a certification word only to say there is none, and says it once", () => {
    const risky = /certif|badge|\bseal\b|endorse|\bpartner|\bofficial\b|testimonial|\bclients?\b|trusted by/i;
    const negated = /\b(?:no|not|none|never)\b|n’t\b/i;
    // A file path ("lib/smartbill/client.ts") is the code's word, not the page's.
    const claims = ALL.filter((s) => !FAQ_QS.has(s) && !IS_PATH.test(s))
      .flatMap(split)
      .filter((s) => risky.test(s));
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.filter((s) => !negated.test(s))).toEqual([]);
    expect(ALL.filter((s) => /certification/i.test(s))).toEqual([AUTO_TEAM.accreditations.isnt]);
  });

  it("names only the grantors in a sentence about grants, and Anthropic only beside the Claude accreditations", () => {
    const COMPANIES = ["Anthropic", "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Twilio", "Vercel", "Google", "Slack"];
    const about = ALL.flatMap(split).filter((s) => /\bgrants?\b/i.test(s));
    expect(about.length).toBeGreaterThan(0);
    for (const s of about) {
      for (const c of COMPANIES) {
        if (GRANTORS.includes(c) || !s.includes(c)) continue;
        expect(c === "Anthropic" && /accreditation/i.test(s), s).toBe(true);
      }
    }
    expect(ALL.filter((s) => /grants?[^.]*\bfrom Anthropic|Anthropic[^.]*\bawarded/.test(s))).toEqual([]);
    const naming = records(PAGE).filter((r) => r.includes("Anthropic"));
    expect(naming.length).toBeGreaterThan(0);
    for (const r of naming) expect(r, r).toMatch(/Claude|accreditation/);
  });

  it("names both credentials up front, and counts the accreditations as the owner states them", () => {
    for (const text of [AUTO_HERO.sub, AUTO_META.description]) {
      expect(text).toContain(`${ACC} `);
      expect(text).toContain(ACCREDITATIONS.issuer);
      for (const g of GRANTORS) expect(text).toContain(g);
    }
    expect(ACCREDITATIONS.holders).toBe("personal");
    const counted = ALL.filter((s) => /accreditation/i.test(s) && /\d/.test(s));
    expect(counted.length).toBeGreaterThan(0);
    for (const s of counted) expect(s).toContain(ACC);
  });

  it("promises alerts that reach a person only of the reader's own build, and marks each promise OWNER", () => {
    const promise = /\balerts?\b[^.]*\breach(?:es)?\b[^.]*\bperson\b|\bfailures reach a person\b|\balerts? by email, text or Slack\b/i;
    const stage3 = new Set(strings(AUTO_BUILD.stages[2]));
    const terms = new Set(strings(AUTO_TERMS));
    const lines = SOURCE.split("\n");
    const found = inRecords([AUTO_META, ...Object.values(SECTIONS)]).filter(({ s }) => promise.test(s));
    expect(found.length).toBeGreaterThanOrEqual(5);
    for (const { s, record } of found) {
      expect(/\bon yours\b|\byours\b|\byour build\b/i.test(record) || stage3.has(s) || terms.has(s), s).toBe(true);
      const line = lines.find((l) => l.includes(s.slice(0, 40)));
      expect(line, `${s} is in ${DATA_FILE} as written`).toBeDefined();
      expect(line, s).toContain("// OWNER");
    }
    // Ours pages nobody, and says so once: where it says a run of ours fails.
    const failing = OUTSIDE_CREDITS.flatMap(split).filter((s) => /\bfailed run\b/i.test(s));
    expect(failing).toHaveLength(1);
    for (const s of failing) expect(s, s).toMatch(/nobody is paged|not paged/);
  });

  it("keeps every owner-stated line marked in the data module", () => {
    // The build spec's sign-off list (§11.1), each at its words.
    for (const words of [
      "We automate it in any field, however hard",
      "Any manual process, in any field, automated.",
      "Any repeated work that moves information between people and tools",
      "The automations, working on your examples, before anything goes live.",
      "The tools it connects to bill for what they supply, on top of the build",
      "Ask to see a morning’s summary",
      "The code, with its tests and a guide to running it",
      "The code, its tests and a guide to running it are yours at the end of the build.",
      "You do. At handover the code is yours",
      "Automations that are live, watched, and yours.",
      // The owner's "not only for voice" (the breadth pass).
      "whatever the business",
      "No. We automate work for any business",
      "and builds both for any business",
      "the same team builds those too",
      "not because calls are all we automate",
      "Swap the caller for a customer, a patient or a guest",
      "on yours, it could as well be an order, an invoice or a lead",
      "Bring any work nobody should do by hand",
    ]) {
      const line = SOURCE.split("\n").find((l) => l.includes(words));
      expect(line, words).toBeDefined();
      expect(line, words).toContain("// OWNER");
      expect(ALL.some((s) => s.includes(words)), words).toBe(true);
    }
  });

  it("says “in beta” beside every Google step the product runs", () => {
    const google = /\bGmail\b|\bGoogle (?:Sheets|Calendar|Docs|Drive)\b|\bGoogle steps?\b/;
    const naming = records([AUTO_META, ...Object.values(SECTIONS)]).filter((r) => google.test(r));
    expect(naming.length).toBeGreaterThanOrEqual(4);
    for (const r of naming) expect(r, r).toMatch(/\bbeta\b/i);
  });

  it("says what the waiting list says, and no more", () => {
    expect(ALL.some((s) => s.includes("the system never promises one slot to two people"))).toBe(true);
    expect(ALL.filter((s) => /never promised the same slot|two people are never promised/i.test(s))).toEqual([]);
  });
});

describe("links go somewhere", () => {
  const routes = walk("app")
    .filter((f) => /(?:^|\/)page\.tsx$/.test(f))
    .map((f) => {
      const segments = f.split("/").slice(1, -1).filter((s) => !/^\(.*\)$/.test(s));
      return new RegExp(`^/${segments.map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s)).join("/")}$`);
    });
  const anchors: string[] = [
    ...SECTION_IDS,
    ...AUTO_RUNNING.ledger.cards.map((c) => `run-${c.id}`),
    ...LENSES.map((l) => `run-${l.id}`),
  ];
  const links = hrefs(PAGE);

  it("finds a link to follow, the kinds' own among them", () => {
    expect(links.length).toBeGreaterThan(15);
    for (const k of Object.values(KINDS)) if (k.show && "href" in k.show) expect(links).toContain(k.show.href);
  });

  it.each(links.map((h) => [h]))("%s resolves", (href) => {
    if (href.startsWith("tel:")) expect(href).toBe(COMPANY.phoneHref);
    else if (href.startsWith("#")) expect(anchors).toContain(href.slice(1));
    else if (href.startsWith("/")) {
      const route = href.replace(/[?#].*$/, "");
      expect(routes.some((r) => r.test(route)), route).toBe(true);
      const hash = href.match(/#(.+)$/)?.[1];
      if (hash) {
        expect(route, href).toBe(SAAS_ITEM.href);
        expect(SAAS_SECTION_IDS as readonly string[]).toContain(hash);
      }
    } else {
      expect(href).toMatch(/^https:\/\//);
    }
  });

  it("never points to a contact page that does not exist", () => {
    expect(links.filter((h) => /\/contact\b/.test(h))).toEqual([]);
  });

  describe("the checks ledger", () => {
    const rows = AUTO_CHECKS.rows;

    it("lists each claim once, five now, four on the call and three in your build", () => {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
      expect(rows).toHaveLength(12);
      const count = (k: string) => rows.filter((r) => r.kind === k).length;
      expect([count("site"), count("call"), count("handover")]).toEqual([5, 4, 3]);
    });

    it("gives each kind one name, the filter's and the tag's alike, and says the sub in the filters' order", () => {
      expect(AUTO_CHECKS.filters.map((f) => f.id)).toEqual(["all", ...Object.keys(CHECK_KINDS)]);
      for (const f of AUTO_CHECKS.filters) if (f.id !== "all") expect(f.label, f.id).toBe(CHECK_KINDS[f.id]);
      const said = AUTO_CHECKS.sub.split(/(?<=\.)\s+/);
      const kinds = Object.values(CHECK_KINDS);
      expect(said).toHaveLength(kinds.length);
      kinds.forEach((k, i) => expect(said[i].toLowerCase(), k).toContain(k.toLowerCase()));
    });

    it("links every row that checks in this browser and names a place to go", () => {
      for (const r of rows) {
        if (r.kind === "site" && /https?:\/\/|\bwww\.|#\w|\/\w/.test(r.how)) expect(r.link, r.id).toBeDefined();
        if (r.link) expect(r.link.label.length, r.id).toBeGreaterThan(0);
      }
      expect(AUTO_CHECKS.rows.find((r) => r.id === "signed")!.how).toContain(WEBHOOK_HEADERS.signature);
      expect(AUTO_CHECKS.rows.find((r) => r.id === "signed")!.claim).toContain(ACTION_META.send_webhook.label);
      const counts = AUTO_CHECKS.rows.find((r) => r.id === "counts")!.claim;
      expect(counts).toMatch(/platform/);
      expect(counts).not.toMatch(/every figure on this page/i);
      expect(AUTO_CHECKS.rows.find((r) => r.id === "map")!.how).toContain(`${cap(word(LENSES.length))} of ours are drawn above.`);
      expect(AUTO_BUILD.stages[0].check.label).toBe(`See ${word(LENSES.length)} of ours mapped above`);
    });

    it("never repeats a check's tag in its words, anywhere on the page", () => {
      // A check line prints its kind as a tag, then its words: "ON THE CALL  Ask us to open its code".
      const found: { kind: keyof typeof CHECK_KINDS; text: string }[] = [];
      const visit = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          if (typeof o.kind === "string" && o.kind in CHECK_KINDS && (typeof o.label === "string" || typeof o.how === "string")) {
            found.push({ kind: o.kind as keyof typeof CHECK_KINDS, text: [o.label, o.how].filter(Boolean).join(" ") });
          }
          Object.values(o).forEach(visit);
        }
      };
      visit([AUTO_RUNNING, AUTO_WORK, AUTO_BREAKS, AUTO_TEAM, AUTO_BUILD, AUTO_CHECKS]);
      expect(found.length).toBeGreaterThan(rows.length);
      for (const c of found) expect(c.text.toLowerCase(), c.text).not.toContain(CHECK_KINDS[c.kind].toLowerCase());
    });
  });
});

describe("headings and templates", () => {
  it("gives each of the ten sections a key phrase copied from its title", () => {
    expect(Object.keys(SECTIONS)).toEqual([...SECTION_IDS]);
    for (const [id, s] of Object.entries(SECTIONS)) {
      expect(s.title.lastIndexOf(s.key), id).toBeGreaterThan(0);
      expect(s.key.trim(), id).toBe(s.key);
      expect(s.title.startsWith(s.key), id).toBe(false);
    }
    const toned = Object.entries(SECTIONS).flatMap(([id, s]) => ("keyTone" in s ? [[id, s.keyTone]] : []));
    expect(toned).toEqual([["faq", "quiet"]]);
  });

  it("builds the FAQ's structured data from the rows the page renders", () => {
    const ld = faqJsonLd(AUTO_FAQ.items);
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(AUTO_FAQ.items.map((i) => [i.q, i.a]));
    expect(AUTO_FAQ.items).toHaveLength(11);
    expect(new Set(AUTO_FAQ.items.map((i) => i.id)).size).toBe(11);
  });

  const slots = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const TEMPLATES: [string, string, string[]][] = [
    ["the workbench's step", AUTO_RUNNING.stepOf, ["n", "total"]],
    ["the workbench's announcement", AUTO_RUNNING.live, ["n", "text", "total"]],
    ["the workbench's lens announcement", AUTO_RUNNING.liveLens, ["blocks", "label", "total"]],
    ["the inspector's place on the run", AUTO_RUNNING.onRun, ["n", "total"]],
    ["a manual step's new place", AUTO_RUNNING.nowStep, ["n"]],
    ["a sample's tag", AUTO_WORK.tag, ["field", "level"]],
    ["#work's announcement", AUTO_WORK.live, ["blocks", "field", "level", "title"]],
    ["the samples' index", AUTO_WORK.indexSummary, ["n"]],
    ["a wait on the trace", AUTO_BREAKS.wait, ["s"]],
    ["a silence on the trace", AUTO_BREAKS.silent, ["s"]],
    ["the tries in words", AUTO_BREAKS.tries.many, ["times"]],
    ["#breaks' announcement", AUTO_BREAKS.live, ["message", "status"]],
    ["the checks' count", AUTO_CHECKS.showing, ["n", "total"]],
  ];

  it.each(TEMPLATES)("%s fills exactly its slots", (_, template, want) => {
    expect(slots(template)).toEqual(want);
  });

  it("leaves no slot anywhere else in the copy", () => {
    const templates = new Set(TEMPLATES.map((t) => t[1]));
    expect(ALL.filter((s) => /[{}]/.test(s) && !templates.has(s))).toEqual([]);
    for (const l of LENSES) expect(l.hand, l.id).not.toMatch(/[{}]/);
  });
});

describe("credits", () => {
  /** A printed name and the name its credit uses. */
  const CREDITED_AS: Record<string, string> = { Postgres: "PostgreSQL" };
  const creditLines = CREDITS.flatMap(split).filter((s) => /trademarks? of/.test(s));
  const tmLine = AUTO_CREDITS.items.find((i) => i.detail.startsWith(listJoin(AUTO_TRADEMARKS)))!;

  it("prints every mark it credits", () => {
    for (const mark of AUTO_TRADEMARKS) expect(OUTSIDE_CREDITS.some((s) => named(mark, s)), mark).toBe(true);
  });

  // Printed means printed outside the credits: a mark the credits alone name would count itself.
  it("credits every mark it prints", () => {
    const printed = REGISTRY.filter((mark) => OUTSIDE_CREDITS.some((s) => named(mark, s)));
    expect(printed.length).toBeGreaterThanOrEqual(10);
    const uncredited = printed.filter((mark) => !creditLines.some((l) => named(CREDITED_AS[mark] ?? mark, l)));
    expect(uncredited).toEqual([]);
    // No automation tool by name: "a ready-made automation tool".
    for (const tool of ["Zapier", "Make", "n8n"]) expect(printed, tool).not.toContain(tool);
  });

  it("says it once, and says none of them endorses the page", () => {
    expect(tmLine).toBeDefined();
    expect(ALL.filter((s) => s.includes("trademarks of their respective owners"))).toHaveLength(1);
    expect(tmLine.detail).toContain("none of them endorses");
  });

  it("credits Google in its own line: the mark on its own, and every Google product the page prints", () => {
    const google = AUTO_CREDITS.items.find((i) => i.term === "Google")!.detail;
    const product = /\bGoogle (?!LLC\b)[A-Z]\w+/g;
    const products = new Set(OUTSIDE_CREDITS.flatMap((s) => [...s.matchAll(product)].map((m) => m[0])));
    expect([...products].sort()).toEqual(["Google Calendar", "Google Docs", "Google Drive", "Google Sheets"]);
    // "The five Google steps": the mark on its own, named first.
    expect(OUTSIDE_CREDITS.some((s) => /\bGoogle\b(?! [A-Z])/.test(s))).toBe(true);
    expect(google.startsWith("Google, ")).toBe(true);
    expect(new Set([...google.matchAll(product)].map((m) => m[0]))).toEqual(products);
    expect(named("Gmail", google)).toBe(OUTSIDE_CREDITS.some((s) => named("Gmail", s)));
    expect(google).toContain("trademarks of Google LLC");
  });

  it("names Anthropic's owner exactly", () => {
    expect(AUTO_CREDITS.items.find((i) => i.term === "Anthropic and Claude")!.detail).toContain("Anthropic, PBC");
  });
});

describe("colour", () => {
  const saasCss = read(`${SAAS_DIR}/saas.css`);
  const reach = flowReach(saasCss, "saas-flow-x", "saas-flow-y");
  const MOVING_MARGIN = 0.2;
  type Measured = Record<keyof typeof SAAS_INK, [number, number] | [number]>;
  // Every size each light renders at on this page (W × H px): the build
  // spec's provisional boxes (§6.2), then the ones measured on the running
  // page at 320, 390, 768, 1024, 1280 and 1440 (#work's room at its first
  // paint and at its shortest and tallest of the 18 samples), with the
  // figures measured there: [still, flowing], the worst over the set.
  const HERO_ROOM: [number, number][] = [
    [343, 560], [704, 480], [440, 580], [480, 560], [560, 520], [288, 656], [358, 620], [560, 527], [440, 592], [500, 574],
    [288, 804], [358, 674], [560, 584], [440, 628], [500, 584],
  ];
  const WORK_ROOM: [number, number][] = [
    [343, 1900], [358, 1700], [288, 2100], [704, 1200], [704, 1000], [944, 1000], [944, 880], [1176, 900], [1176, 1000], [1176, 780],
    [288, 2483], [358, 2277], [720, 1376], [944, 1290], [1176, 1170],
    [288, 1557], [288, 2981], [358, 1365], [358, 2681], [720, 1038], [720, 1652], [944, 974], [944, 1473], [1176, 974], [1176, 1392],
  ];
  const TEAM_CARD: [number, number][] = [
    [343, 900], [358, 860], [288, 1000], [704, 640], [720, 600], [944, 540], [1176, 480], [1176, 520],
    [288, 1084], [358, 974], [720, 594], [944, 492], [1176, 408],
  ];
  const SELF_SERVE: [number, number][] = [
    [343, 330], [358, 310], [288, 380], [704, 210], [720, 200], [944, 180], [1176, 170], [1176, 190],
    [288, 368], [358, 302], [720, 246], [944, 202], [1176, 180],
  ];
  const BUILD_CARDS: [number, number][] = [
    [298, 700], [343, 650], [704, 440], [288, 620], [358, 560], [376, 540],
    [288, 485], [288, 565], [288, 637], [358, 419], [358, 503], [358, 531], [720, 319], [720, 389], [720, 413], [299, 633], [376, 549],
  ];
  // #checks' card under the ledger: the SaaS component with this page's words, on the papers light, still (no LiveMesh).
  const CHECKS_CARD: [number, number][] = [
    [288, 344], [358, 294], [720, 233], [944, 199], [1176, 199],
  ];
  const SURFACES: [string, SaasLightId[], [number, number][], Measured][] = [
    ["the hero's room", ["room"], HERO_ROOM, { text: [12.47, 12.02], dim: [7.58, 7.31], accent: [5.86, 5.65], tick: [3.72, 3.58] }],
    ["#work's room", ["roomMirror"], WORK_ROOM, { text: [12.42, 12.05], dim: [7.55, 7.33], accent: [5.84, 5.67], tick: [3.7, 3.59] }],
    ["#team's card", ["papers"], TEAM_CARD, { text: [12.64, 11.41], dim: [7.69, 6.94], accent: [5.94, 5.36], tick: [3.77, 3.4] }],
    ["#build's cards", ["stage", "stageMirror"], BUILD_CARDS, { text: [13.53, 12.06], dim: [8.23, 7.34], accent: [6.36, 5.67], tick: [4.03, 3.6] }],
    // Still: the self-serve card has no LiveMesh.
    ["#build's self-serve card, still", ["room"], SELF_SERVE, { text: [12.42], dim: [7.55], accent: [5.84], tick: [3.7] }],
    ["#checks' card, still", ["papers"], CHECKS_CARD, { text: [12.64], dim: [7.68], accent: [5.94], tick: [3.77] }],
  ];

  it.each(SURFACES)("%s: text clears 4.5:1 and marks 3:1, as measured", (_, lights, boxes, measured) => {
    for (const token of Object.keys(SAAS_INK) as (keyof typeof SAAS_INK)[]) {
      const fg = SAAS_INK[token];
      const bar = token === "tick" ? 3 : 4.5;
      const still = Math.min(...lights.map((id) => worstStatic(SAAS_LIGHTS[id].ground, fg, boxes)));
      expect(still, `${token} still`).toBeGreaterThanOrEqual(bar);
      expect(still, `${token} still`).toBeCloseTo(measured[token][0], 1);
      const flows = measured[token][1];
      if (flows === undefined) continue;
      const flowing = Math.min(...lights.map((id) => worstMoving(SAAS_LIGHTS[id].ground, fg, boxes, reach)));
      expect(flowing, `${token} flowing`).toBeGreaterThanOrEqual(bar + MOVING_MARGIN);
      expect(flowing, `${token} flowing`).toBeCloseTo(flows, 1);
    }
  });

  // #breaks' night room (`.auto-night`): a static gradient between these two.
  const NIGHT = ["#140a24", "#1e0a3c"] as const;
  it.each<[string, string, number, number]>([
    ["on-deep: text", HOME_COLORS.onDeep, 16.55, 15.62],
    ["on-deep-dim: secondary text, lane words, ticks", HOME_COLORS.onDeepDim, 12.74, 12.02],
    ["lilac: labels, waits, the bead, rings", HOME_COLORS.lilac, 8.87, 8.37],
    ["ember-lit: a failure's mark", HOME_COLORS.emberLit, 11.26, 10.63],
    ["settled-lit: a success's mark", HOME_COLORS.settledLit, 12.13, 11.45],
    ["paper-dim: not used", HOME_COLORS.paperDim, 7.86, 7.42],
  ])("reads on the night room: %s", (_, fg, top, bottom) => {
    const [a, b] = NIGHT.map((bg) => contrast(rgb(fg), rgb(bg)));
    expect(a).toBeGreaterThanOrEqual(4.5);
    expect(b).toBeGreaterThanOrEqual(4.5);
    expect(a).toBeCloseTo(top, 1);
    expect(b).toBeCloseTo(bottom, 1);
  });

  it("keeps electric off the night room as text, and its rows legible", () => {
    for (const bg of NIGHT) expect(contrast(rgb(HOME_COLORS.electric), rgb(bg))).toBeLessThan(4.5);
    expect(contrast(rgb(HOME_COLORS.electric), rgb(NIGHT[0]))).toBeCloseTo(3.35, 1);
    // A chosen scenario is white with ink; a hovered one is white at 8% over the night, under on-deep.
    expect(contrast(rgb(HOME_COLORS.ink), rgb("#ffffff"))).toBeCloseTo(19.1, 1);
    const hover = NIGHT.map((bg) => contrast(rgb(HOME_COLORS.onDeep), over(rgb("#ffffff"), 0.08, rgb(bg))));
    for (const ratio of hover) expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(hover[0]).toBeCloseTo(13.78, 1);
    expect(hover[1]).toBeCloseTo(12.89, 1);
  });

  const WHITE = "#ffffff";
  it.each<[string, string, string, number, number]>([
    ["muted on stage: the workbench's lane labels, tag, group tabs", HOME_COLORS.muted, HOME_COLORS.stage, 5.39, 4.5],
    ["electric on stage: traces, the bead, rings, branch labels", HOME_COLORS.electric, HOME_COLORS.stage, 4.82, 3],
    ["white on electric: the Running pill, a handed disc", WHITE, HOME_COLORS.electric, 5.7, 4.5],
    ["muted on white: tags, meta, datums", HOME_COLORS.muted, WHITE, 6.37, 4.5],
    ["violet on white: “now step 03”, ledger figures, “Built for yours”", HOME_COLORS.violet, WHITE, 7.1, 4.5],
    ["settled on white: passed ticks, “Runs here”, the Succeeded glyph", HOME_COLORS.settled, WHITE, 5.5, 4.5],
    ["ember-ink on white: the Failed glyph and message", HOME_COLORS.emberInk, WHITE, 5.92, 4.5],
    ["settled on settled-soft: the Succeeded pill", HOME_COLORS.settled, HOME_COLORS.settledSoft, 4.95, 4.5],
    ["ember-ink on ember-soft: the Failed pill", HOME_COLORS.emberInk, HOME_COLORS.emberSoft, 5.07, 4.5],
    ["electric on white: a block's glyph", HOME_COLORS.electric, WHITE, 5.7, 3],
    ["electric on wash: #build's rail and stations, the run log's checked row", HOME_COLORS.electric, HOME_COLORS.wash, 5.21, 3],
    ["violet on wash: #build's key phrase", HOME_COLORS.violet, HOME_COLORS.wash, 6.49, 4.5],
  ])("%s clears its bar, as measured", (_, fg, bg, measured, bar) => {
    const ratio = contrast(rgb(fg), rgb(bg));
    expect(ratio).toBeGreaterThanOrEqual(bar);
    expect(ratio).toBeCloseTo(measured, 1);
  });

  it("marks the run log's checked step with an electric edge, not the wash alone", () => {
    const src = read(`${DIR}/workbench.tsx`);
    const on = src.match(/const STEP_ON = "([^"]+)"/)?.[1] ?? "";
    expect(on).toContain("bg-(--home-wash)");
    expect(on).toMatch(/shadow-\[inset_0_0_0_1px_var\(--home-electric\)\]/);
    expect(src).toMatch(/on \? STEP_ON : "hover:bg-\(--home-wash\)\/60"/);
    expect(contrast(rgb(HOME_COLORS.wash), rgb("#ffffff"))).toBeLessThan(3);
  });

  // #start's deep panel (DEEP_PANEL, static): the SaaS test's sizes and zones, then this
  // page's own sizes, measured at 320, 390, 768 and 1024 (xl's is WIDE's). Its lilac ends
  // at most 39% down a narrow panel, its on-deep-dim at most 66%, inside the zones below.
  const WIDE: [number, number][] = [[1176, 441]];
  const NARROW: [number, number][] = [
    [343, 760],
    [704, 600],
    [944, 559],
    [1176, 559],
    [288, 605],
    [358, 562],
    [720, 495],
  ];
  const ANYWHERE = [0, 0, 1, 1] as const;

  it("ends its #start copy no lower in the deep panel than the SaaS page's, which the zones were measured on", () => {
    expect(AUTO_START.title.length).toBeLessThanOrEqual(SAAS_START.title.length);
    expect(AUTO_START.key.length).toBeLessThanOrEqual(SAAS_START.key.length);
    expect(AUTO_START.body.length).toBeLessThanOrEqual(SAAS_START.body.length);
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.onDeep, [...WIDE, ...NARROW], ANYWHERE)).toBeCloseTo(4.93, 1);
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.paper, [...WIDE, ...NARROW], ANYWHERE)).toBeCloseTo(4.85, 1);
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.lilac, [...WIDE, ...NARROW], ANYWHERE)).toBeLessThan(4.5);
  });

  it.each<[string, string, [number, number][], [number, number, number, number], number]>([
    ["lilac, wide", HOME_COLORS.lilac, WIDE, [0, 0, 0.62, 0.62], 6.25],
    ["lilac, narrow", HOME_COLORS.lilac, NARROW, [0, 0, 1, 0.45], 5.76],
    ["on-deep-dim, wide", HOME_COLORS.onDeepDim, WIDE, [0, 0, 0.7, 0.85], 6.88],
    ["on-deep-dim, narrow", HOME_COLORS.onDeepDim, NARROW, [0, 0, 1, 0.7], 5.92],
  ])("reads on the deep panel: %s inside its zone", (_, fg, boxes, zone, measured) => {
    const worst = worstInZone(DEEP_PANEL, fg, boxes, zone);
    expect(worst).toBeGreaterThanOrEqual(4.5);
    expect(worst).toBeCloseTo(measured, 1);
  });

  it("adds no light: the hero is the room its pools were worked out for", () => {
    expect(read(`${SAAS_DIR}/hero.tsx`)).toContain("saas-lit saas-light-room saas-room");
    const ours = readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith(".css"));
    for (const f of ours) expect(read(`${DIR}/${f}`), f).not.toMatch(/--saas-ground\s*:/);
  });

  describe("the night room's ground", () => {
    it("is the static gradient the tokens were measured on", () => {
      const css = read(`${DIR}/auto-breaks.css`).replace(/\/\*[\s\S]*?\*\//g, "");
      const body = css.match(/\.pp \.auto-night \{([^}]*)\}/)?.[1] ?? "";
      expect(body).toMatch(new RegExp(String.raw`background(?:-image)?:\s*linear-gradient\(180deg, ${NIGHT[0]} 0%, ${NIGHT[1]} 100%\);`));
    });
  });
});

/* ---------- the route's stylesheets ---------- */

type Decl = { prop: string; value: string };
type CssBlock = { prelude: string; within: string[]; decls: Decl[]; at: number };

/** A stylesheet's blocks, each with the preludes it sits inside (outermost first) and its own declarations. */
function parseCss(source: string): CssBlock[] {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: CssBlock[] = [];
  const stack: CssBlock[] = [];
  let from = 0;
  const flush = (to: number) => {
    const text = src.slice(from, to).trim();
    const colon = text.indexOf(":");
    const top = stack.at(-1);
    if (top && colon > 0) top.decls.push({ prop: text.slice(0, colon).trim(), value: text.slice(colon + 1).trim() });
  };
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "{") {
      const b: CssBlock = { prelude: src.slice(from, i).trim(), within: stack.map((s) => s.prelude), decls: [], at: blocks.length };
      blocks.push(b);
      stack.push(b);
      from = i + 1;
    } else if (src[i] === "}") {
      flush(i);
      stack.pop();
      from = i + 1;
    } else if (src[i] === ";") {
      flush(i);
      from = i + 1;
    }
  }
  return blocks;
}

/** Splits at top-level commas (or at any other top-level separator), never inside brackets. */
function splitTop(text: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" || text[i] === "[") depth++;
    else if (text[i] === ")" || text[i] === "]") depth--;
    else if (depth === 0 && (sep === " " ? /\s/.test(text[i]) : text[i] === sep)) {
      out.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  return [...out, text.slice(from).trim()].filter(Boolean);
}

/** A selector with every `:is()`/`:where()` written out as the alternatives it stands for. */
function expandIs(sel: string): string[] {
  const m = sel.match(/:(?:is|where)\(/);
  if (!m || m.index === undefined) return [sel];
  const open = m.index + m[0].length;
  let depth = 1;
  let close = open;
  for (; close < sel.length && depth > 0; close++) {
    if (sel[close] === "(") depth++;
    else if (sel[close] === ")") depth--;
  }
  const head = sel.slice(0, m.index);
  const tail = sel.slice(close);
  return splitTop(sel.slice(open, close - 1)).flatMap((alt) => expandIs(`${head}${alt}${tail}`));
}

/** A selector's specificity, [ids, classes, types]: `:is()`/`:not()`/`:has()` count their weightiest argument, `:where()` none. */
function specificity(sel: string): [number, number, number] {
  let a = 0;
  let b = 0;
  let c = 0;
  const more = (x: [number, number, number], y: [number, number, number]) => (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) > 0;
  for (let i = 0; i < sel.length; ) {
    const ch = sel[i];
    const fn = sel.slice(i).match(/^:(is|not|has|where|matches)\(/);
    if (fn) {
      let depth = 1;
      let j = i + fn[0].length;
      for (; j < sel.length && depth > 0; j++) {
        if (sel[j] === "(") depth++;
        else if (sel[j] === ")") depth--;
      }
      if (fn[1] !== "where") {
        let best: [number, number, number] = [0, 0, 0];
        for (const arg of splitTop(sel.slice(i + fn[0].length, j - 1))) {
          const s = specificity(arg);
          if (more(s, best)) best = s;
        }
        a += best[0];
        b += best[1];
        c += best[2];
      }
      i = j;
    } else if (ch === "[") {
      b++;
      i = sel.indexOf("]", i) + 1;
    } else if (ch === "#") {
      a++;
      i = i + 1 + (sel.slice(i + 1).match(/^[\w-]+/)?.[0].length ?? 0);
    } else if (ch === ".") {
      b++;
      i = i + 1 + (sel.slice(i + 1).match(/^[\w-]+/)?.[0].length ?? 0);
    } else if (sel.startsWith("::", i)) {
      c++;
      i = i + 2 + (sel.slice(i + 2).match(/^[\w-]+(?:\([^)]*\))?/)?.[0].length ?? 0);
    } else if (ch === ":") {
      b++;
      i = i + 1 + (sel.slice(i + 1).match(/^[\w-]+(?:\([^)]*\))?/)?.[0].length ?? 0);
    } else if (/[a-zA-Z]/.test(ch)) {
      c++;
      i += sel.slice(i).match(/^[\w-]+/)![0].length;
    } else i++;
  }
  return [a, b, c];
}

/**
 * The element a selector styles, as the tier check names it: the auto-
 * classes of the last compound that has one, and whatever the selector
 * goes on to name after it (`path[pathLength]` in a figure). Classes
 * inside `:not()` are not the element's.
 */
function subject(sel: string): { classes: string[]; trail: string } {
  const compounds = splitTop(sel.replace(/\s*([>+~])\s*/g, " $1 "), " ").filter((c) => !/^[>+~]$/.test(c));
  for (let k = compounds.length - 1; k >= 0; k--) {
    const own = compounds[k].replace(/:not\([^)]*\)/g, "");
    const classes = [...own.matchAll(/\.(auto-[\w-]+)/g)].map((m) => m[1]);
    if (classes.length) return { classes, trail: compounds.slice(k + 1).join(" ") };
  }
  return { classes: [], trail: compounds.join(" ") };
}

// What may animate: colour, transform, translate, scale and opacity, and
// no custom property: the compositor can't run one. A transition names
// only these, and box-shadow (the workbench's current ring).
const ANIMATABLE =
  /^(?:opacity|transform|translate|scale|color|background-color|border-color|outline-color|fill|stroke|animation-timing-function)$/;
const TRANSITIONABLE = new Set([
  "opacity", "transform", "translate", "scale", "color", "background-color", "border-color", "outline-color", "box-shadow", "fill", "stroke",
]);
const TIMELINE = /^(?:view-timeline|view-timeline-name|scroll-timeline|scroll-timeline-name|animation-timeline|timeline-scope)$/;
const EASING = /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|normal|allow-discrete)$|^(?:cubic-bezier|steps|linear)\(/;
const TIME = /^-?[\d.]+m?s$|^calc\(/;

/**
 * Every declaration of a sheet that breaks the motion contract: a
 * keyframe that animates anything but ANIMATABLE, a transition of
 * anything but TRANSITIONABLE, and a scroll timeline outside the
 * reduced-motion and support gates.
 */
function motionFaults(sheet: string, blocks: readonly CssBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const within = [...b.within, b.prelude];
    for (const d of b.decls) {
      const where = `${sheet}: ${b.prelude} { ${d.prop}: ${d.value} }`;
      if (within.some((p) => p.startsWith("@keyframes")) && !ANIMATABLE.test(d.prop)) out.push(`${where}: animates ${d.prop}`);
      if (d.prop === "transition-property") {
        for (const prop of splitTop(d.value)) if (!TRANSITIONABLE.has(prop)) out.push(`${where}: transitions ${prop}`);
      }
      if (d.prop === "transition" && d.value !== "none") {
        for (const item of splitTop(d.value)) {
          const prop = splitTop(item, " ").find((t) => !TIME.test(t) && !EASING.test(t));
          if (!prop || !TRANSITIONABLE.has(prop)) out.push(`${where}: transitions ${prop ?? "nothing named"}`);
        }
      }
      if (TIMELINE.test(d.prop) && !/^auto(?:\s*,\s*auto)*$/.test(d.value)) {
        const gated =
          within.some((p) => /^@media\b.*prefers-reduced-motion:\s*no-preference/.test(p)) &&
          within.some((p) => /^@supports\b.*animation-timeline:\s*view\(\)/.test(p));
        if (!gated) out.push(`${where}: outside the reduced-motion and support gates`);
      }
    }
  }
  return out;
}

/** The order page.tsx imports this page's sheets in (spec §2.2): a later sheet wins a tie. */
const ORDER = ["auto.css", "auto-running.css", "auto-work.css", "auto-breaks.css", "auto-closing.css"];

/**
 * Every rule of ours that runs an animation (`animation` or
 * `animation-name`, not `none`) and isn't stopped on each of the lite,
 * still and weak tiers by a rule that wins: one rooted at
 * `html[data-tier="lite"]`, `html[data-tier="still"]` or `html[data-weak]`
 * (written out of any `:is()`), setting `animation: none` on the same
 * element — an auto- class of the animated rule's subject, and whatever
 * the rule names after it — with a higher specificity, or an equal one
 * later in the cascade (the sheets in ORDER, then source order). Each
 * entry says which rule, and which tier's pin is missing or loses.
 */
function unpinned(sheets: readonly { sheet: string; blocks: CssBlock[] }[]): string[] {
  type Spec = [number, number, number];
  const pins: { tier: string; classes: string[]; trail: string; spec: Spec; order: number }[] = [];
  const animated: { where: string; classes: string[]; trail: string; spec: Spec; order: number }[] = [];
  const rank = (sheet: string) => {
    const k = ORDER.indexOf(path.basename(sheet));
    return k < 0 ? ORDER.length : k;
  };
  const animates = (d: Decl) => d.prop === "animation" || d.prop === "animation-name";
  for (const { sheet, blocks } of sheets) {
    for (const b of blocks) {
      if (b.prelude.startsWith("@") || b.within.some((p) => p.startsWith("@keyframes"))) continue;
      const order = rank(sheet) * 1e6 + b.at;
      const stops = b.decls.some((d) => animates(d) && /^none\b/.test(d.value));
      const runs = b.decls.some((d) => animates(d) && !/^none\b/.test(d.value));
      for (const sel of splitTop(b.prelude)) {
        const spec = specificity(sel);
        for (const alt of expandIs(sel)) {
          const tier = alt.match(/^html\[data-tier="(lite|still)"\]|^html\[data-(weak)\]/);
          const { classes, trail } = subject(alt);
          if (tier && stops) pins.push({ tier: tier[1] ?? tier[2], classes, trail, spec, order });
          else if (runs && !tier) animated.push({ where: `${sheet}: ${alt}`, classes, trail, spec, order });
        }
      }
    }
  }
  const out: string[] = [];
  for (const a of animated) {
    if (!a.classes.length) {
      out.push(`${a.where}: animates no auto- element`);
      continue;
    }
    for (const tier of ["lite", "still", "weak"]) {
      const same = pins.filter((p) => p.tier === tier && p.trail === a.trail && p.classes.some((c) => a.classes.includes(c)));
      const wins = same.some((p) => {
        const d = p.spec[0] - a.spec[0] || p.spec[1] - a.spec[1] || p.spec[2] - a.spec[2];
        return d > 0 || (d === 0 && p.order > a.order);
      });
      if (!same.length) out.push(`${a.where}: no ${tier} pin`);
      else if (!wins) out.push(`${a.where}: the ${tier} pin loses to it`);
    }
  }
  return out;
}

/**
 * Every auto- class that is the subject of rules in two of the section
 * sheets (auto.css, which holds the shared marks, is exempt): a class
 * two sections both style is one each restyles on the other's elements.
 * Each entry names the class and the sheets.
 */
function sharedSubjects(sheets: readonly { sheet: string; blocks: CssBlock[] }[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const { sheet, blocks } of sheets) {
    const name = path.basename(sheet);
    if (name === "auto.css") continue;
    for (const b of blocks) {
      if (b.prelude.startsWith("@") || b.within.some((p) => p.startsWith("@keyframes"))) continue;
      for (const sel of splitTop(b.prelude)) {
        for (const alt of expandIs(sel)) {
          for (const cls of subject(alt).classes) owners.set(cls, (owners.get(cls) ?? new Set()).add(name));
        }
      }
    }
  }
  return [...owners].filter(([, s]) => s.size > 1).map(([cls, s]) => `${cls}: ${[...s].join(", ")}`);
}

describe("the route's stylesheets", () => {
  const sheets = [DIR, "app/solutions/custom-automations"]
    .flatMap((dir) => readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".css")).map((f) => `${dir}/${f}`));
  const parsed = sheets.map((sheet) => ({ sheet, blocks: parseCss(read(sheet)) }));
  const isAt = (prelude: string) => prelude.startsWith("@");
  const inKeyframes = (within: string[]) => within.some((p) => p.startsWith("@keyframes"));

  it("finds the shared stylesheet", () => {
    expect(sheets).toContain(`${DIR}/auto.css`);
  });

  it.each(parsed.map((p) => [p.sheet, p.blocks] as const))("%s keeps every rule under .pp, every class and keyframe prefixed, and names one of ours", (sheet, blocks) => {
    for (const b of blocks) {
      if (isAt(b.prelude) || inKeyframes(b.within)) continue;
      const styleParents = b.within.filter((p) => !isAt(p));
      for (const sel of splitTop(b.prelude)) {
        // A top-level rule starts at the page's <main> (.pp), or at <html> for the tiers.
        if (styleParents.length === 0) expect(sel, sheet).toMatch(/^(?:\.pp(?![\w-])|html(?![\w-])|:root(?![\w-]))/);
        for (const [, cls] of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) expect(cls, `${sheet}: ${sel}`).toMatch(/^(?:auto-|saas-|home-)|^pp$/);
        expect([...styleParents, sel].some((s) => /\.auto-[\w-]/.test(s)), `${sheet}: ${sel} names none of ours`).toBe(true);
      }
    }
    for (const b of blocks) {
      const name = b.prelude.match(/^@keyframes\s+(\S+)/)?.[1];
      if (name) expect(name, sheet).toMatch(/^auto-/);
      expect(b.prelude, sheet).not.toMatch(/^@property\b/);
    }
  });

  it.each(parsed.map((p) => [p.sheet, p.blocks] as const))(
    "%s animates only compositor-friendly properties, and ties motion to scroll only behind the gates",
    (sheet, blocks) => {
      expect(motionFaults(sheet, blocks)).toEqual([]);
    },
  );

  it("stops every animation of ours on the lite, still and weak tiers, with a pin that wins", () => {
    expect(unpinned(parsed)).toEqual([]);
  });

  it("gives each section's sheet classes of its own, so none restyles another's elements", () => {
    // #work's skeleton dot and the workbench list's rail ring were once
    // both `.auto-dot`, and #work's rules moved the list's rings off
    // their rail.
    expect(sharedSubjects(parsed)).toEqual([]);
  });

  // saas.css keys rules on `html:has(main.saas-page)`: with it, one glyph-relative length
  // anywhere in the document makes every DOM insertion restyle the whole page (20–50ms).
  it("uses no glyph-relative length (ch, ex, ic, cap, lh) and no utility built on one", () => {
    const unit = /(?<![\w-])\d*\.?\d+r?(?:ch|ex|ic|cap|lh)(?![\w-])/;
    const utility = /(?<![\w-])(?:min-w|max-w|w|basis)-prose(?![\w-])/;
    const files = [...readdirSync(path.join(ROOT, DIR)).filter((f) => /\.(?:tsx?|css)$/.test(f)).map((f) => `${DIR}/${f}`), PAGE_FILE];
    for (const f of files) {
      const src = read(f);
      expect(src.match(unit)?.[0], f).toBeUndefined();
      expect(src.match(utility)?.[0], f).toBeUndefined();
    }
  });

  it("draws the workbench's states and a run's status in system colours", () => {
    const shared = parsed.find((p) => p.sheet === `${DIR}/auto.css`)!.blocks;
    const forced = shared.filter((b) => b.within.some((p) => /^@media\s*\(forced-colors:\s*active\)/.test(p))).map((b) => b.prelude);
    expect(forced.some((s) => s.includes('.auto-node[data-state="current"]'))).toBe(true);
    expect(forced.some((s) => s.includes(".auto-status"))).toBe(true);
  });

  describe("the page's imports", () => {
    const page = read(PAGE_FILE);
    const imported = (file: string) => {
      const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return page.match(new RegExp(`^import ["']@/${escaped}["'];`, "gm"))?.length ?? 0;
    };

    it("imports every sheet of ours once, the shared one first, and the SaaS sheets it reuses once", () => {
      for (const sheet of sheets) expect(imported(sheet), sheet).toBe(1);
      for (const shared of [
        "components/site/home/home.css",
        "components/site/home/tier.css",
        `${SAAS_DIR}/saas.css`,
        `${SAAS_DIR}/saas-credentials.css`,
        `${SAAS_DIR}/saas-build.css`,
        `${SAAS_DIR}/saas-closing.css`,
      ]) {
        expect(imported(shared), shared).toBe(1);
      }
      expect(imported(`${SAAS_DIR}/saas-explorer.css`)).toBe(0);
      const at = (f: string) => page.indexOf(`@/${DIR}/${f}`);
      const ours = ORDER.filter((f) => at(f) >= 0);
      expect(ours.map(at)).toEqual([...ours.map(at)].sort((a, b) => a - b));
      expect(at("auto.css")).toBeGreaterThan(page.indexOf(`@/${SAAS_DIR}/saas-closing.css`));
    });
  });
});

describe("the content-visibility reserves", () => {
  /** A tier's reserve at a window `vw` px wide, worked out as the browser works out its calc(). */
  const lengthAt = (css: string, vw: number) => {
    let sum = Number(css.match(/^(?:calc\()?(\d+)px/)?.[1]);
    for (const [, sign, slope, from, span] of css.matchAll(/([+-]) ([\d.]+) \* clamp\(0px, 100vw - (\d+)px, (\d+)px\)/g)) {
      sum += (sign === "-" ? -1 : 1) * Number(slope) * Math.min(Math.max(vw - Number(from), 0), Number(span));
    }
    return sum;
  };

  it("measures at the SaaS page's widths and three of its own, in order, and keeps a height for every box at each", () => {
    expect(RESERVE_AT).toEqual([...SAAS_RESERVE_AT, 325, 330, 335].sort((a, b) => a - b));
    expect(new Set(RESERVE_AT).size).toBe(RESERVE_AT.length);
    expect(Object.keys(RESERVES)).toEqual(["running", "work", "breaks", "team", "build", "terms", "checks", "faq", "start"]);
    for (const [box, heights] of Object.entries(RESERVES)) {
      expect(heights, box).toHaveLength(RESERVE_AT.length);
      for (const h of heights) expect(Number.isInteger(h) && h > 0, `${box}: ${h}`).toBe(true);
    }
  });

  it("runs each tier's reserve through every height measured in it, flat past its ends", () => {
    for (const [box, heights] of Object.entries(RESERVES)) {
      const style = reserveStyle(heights) as Record<string, string>;
      for (const [name, lo, hi] of RESERVE_TIERS) {
        const points = RESERVE_AT.map((w, i) => [w, heights[i]] as const).filter(([w]) => w >= lo && w <= hi);
        for (const [w, h] of points) expect(lengthAt(style[name], w), `${box} at ${w}`).toBeCloseTo(h, 0);
        expect(lengthAt(style[name], points[0][0] - 40), `${box} under ${name}`).toBeCloseTo(points[0][1], 0);
        expect(lengthAt(style[name], points.at(-1)![0] + 40), `${box} over ${name}`).toBeCloseTo(points.at(-1)![1], 0);
      }
    }
  });

  describe("the page's boxes", () => {
    it("keeps a row for every box on the page, in its order, and no other kind of box", () => {
      const page = read(PAGE_FILE);
      expect([...page.matchAll(/<AutoDeferred box="(\w+)">/g)].map((m) => m[1])).toEqual(Object.keys(RESERVES));
      expect(page).not.toMatch(/<HomeDeferred\b/);
      expect(page).not.toMatch(/<SaasDeferred\b/);
    });
  });
});

describe("the reuse contract", () => {
  it("still finds the SaaS shell, lights and closing sheets it builds on", () => {
    expect(read(`${SAAS_DIR}/shell.tsx`)).toContain("pp home-body saas-page");
    const css = read(`${SAAS_DIR}/saas.css`);
    for (const light of ["room", "room-m", "papers", "stage", "stage-m"]) expect(css, light).toContain(`.pp .saas-light-${light} {`);
    expect(read(`${SAAS_DIR}/saas-credentials.css`)).toContain(".saas-pop");
    const closing = read(`${SAAS_DIR}/saas-closing.css`);
    // #checks' view transition names the boxes after it by the ids this page gives them too.
    expect(closing).toContain(".home-deferred:has(> #faq)");
    expect(closing).toContain(".home-deferred:has(> #start)");
    expect(SECTION_IDS).toContain("faq");
    expect(SECTION_IDS).toContain("start");
  });

  it("hands the SaaS sections data they accept", () => {
    type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;
    const hero = AUTO_HERO satisfies PropsOf<typeof Hero>["data"];
    const terms = AUTO_TERMS satisfies PropsOf<typeof Terms>["data"];
    const checks = AUTO_CHECKS satisfies PropsOf<typeof Checks>["data"];
    const faq = AUTO_FAQ satisfies PropsOf<typeof Faq>["data"];
    const start = AUTO_START satisfies PropsOf<typeof Start>["data"];
    const credits = AUTO_CREDITS satisfies PropsOf<typeof Start>["credits"];
    expect([hero, terms, checks, faq, start, credits]).toHaveLength(6);
    // No row asks the SaaS explorer for a lens: this page has none of its lenses.
    expect(AUTO_CHECKS.rows.filter((r) => r.link && "lens" in r.link)).toEqual([]);
  });

  it("takes no value but a component from a client module into a server one", () => {
    // A server component that imports a string from a "use client" module
    // gets a client reference instead: #work's index once rendered with no
    // focus ring because it took RING_LIGHT from home/controls.tsx.
    const isClient = (file: string) => /^\s*["']use client["']/.test(read(file));
    const resolve = (spec: string, from: string) => {
      const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
      return base && [".tsx", ".ts"].map((ext) => base + ext).find((f) => existsSync(path.join(ROOT, f)));
    };
    const imports = (file: string) =>
      [...read(file).matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g)]
        .filter((m) => !m[1])
        .map((m) => ({ names: m[2].split(",").map((n) => n.trim()).filter((n) => n && !n.startsWith("type ")), spec: m[3], target: resolve(m[3], file) }));
    // The server graph: from the page, through this page's own files, up to each client boundary.
    const servers = new Set<string>();
    const walk = (file: string) => {
      if (servers.has(file) || isClient(file)) return;
      servers.add(file);
      for (const { target } of imports(file)) if (target?.startsWith(`${DIR}/`)) walk(target);
    };
    walk("app/solutions/custom-automations/page.tsx");
    expect([...servers]).toContain(`${DIR}/work.tsx`);
    const found: string[] = [];
    for (const file of servers) {
      for (const { names, spec, target } of imports(file)) {
        if (!target || !isClient(target)) continue;
        for (const name of names) if (!/^[A-Z][a-z]/.test(name)) found.push(`${file}: ${name} from ${spec}`);
      }
    }
    expect(found).toEqual([]);
  });

  describe("#build's rail", () => {
    it("stops at the SaaS stations, where saas-build.css's keyframes stop", () => {
      const stations = (file: string) => read(file).match(/const STATIONS = \[([^\]]+)\]/)?.[1].split(",").map(Number) ?? [];
      const ours = stations(`${DIR}/build.tsx`);
      expect(ours).toHaveLength(3);
      expect(ours).toEqual(stations(`${SAAS_DIR}/build.tsx`));
      const css = read(`${SAAS_DIR}/saas-build.css`);
      ours.forEach((at, i) => {
        const body = css.match(new RegExp(String.raw`@keyframes saas-station-${i} \{([\s\S]*?)\n\}`))?.[1] ?? "";
        const stops = [...body.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
        expect(stops, `saas-station-${i}`).toEqual([0, at * 100, (at + 1 / 12) * 100, 100].map((n) => expect.closeTo(n, 2)));
      });
    });
  });
});

describe("the instruments this file measures with", () => {
  it("reads a rounded route back as it is drawn", () => {
    const pts = pointsOfD("M118 171 L124.5 171 Q132.5 171 132.5 163 L132.5 47");
    expect(pts[0]).toEqual([118, 171]);
    expect(pts.at(-1)).toEqual([132.5, 47]);
    expect(pts).toContainEqual([132.5, 163]);
    // The corner is cut: its middle stands off the polyline's bend.
    const [mx, my] = pts[11];
    expect(Math.hypot(132.5 - mx, 171 - my)).toBeGreaterThan(2);
    expect(() => pointsOfD("M0 0 C1 1 2 2 3 3")).toThrow(/can't read/);
  });

  it("finds a keyframe, a transition or a scroll timeline that breaks the motion contract", () => {
    const css = `
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .pp .auto-moves { view-timeline: --auto-work block; }
        }
      }
      .pp .auto-x { view-timeline: --auto-x block; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s; }
      .pp .auto-row-in { transition: opacity 0.3s, translate 0.3s 60ms; @starting-style { opacity: 0; translate: 0 6px; } }
      .pp .auto-pip { transition-property: background-color, --k; }
      @keyframes auto-grow { from { height: 0; scale: 1 0; } to { --k: 1; } }
    `;
    const faults = motionFaults("fixture.css", parseCss(css));
    expect(faults).toEqual([
      expect.stringMatching(/\.auto-x \{ view-timeline: .*outside the reduced-motion and support gates$/),
      expect.stringMatching(/\.auto-x \{ transition: .*transitions height$/),
      expect.stringMatching(/\.auto-pip \{ transition-property: .*transitions --k$/),
      expect.stringMatching(/from \{ height: 0 \}: animates height$/),
      expect.stringMatching(/to \{ --k: 1 \}: animates --k$/),
    ]);
    expect(parseCss(css).find((b) => b.prelude === "@starting-style")?.within).toEqual([".pp .auto-row-in"]);
  });

  it("finds an animation no tier stops, and a pin too light to stop it", () => {
    const sheet = (css: string) => [{ sheet: `${DIR}/auto-work.css`, blocks: parseCss(css) }];
    const deep = ".pp .auto-work:not([data-picked]) .auto-move[data-made] .auto-move-dot { animation-name: auto-pop; }";
    const pin = (tiers: string) =>
      tiers
        .split(",")
        .map((t) => `html${t === "weak" ? "[data-weak]" : `[data-tier="${t}"]`} .home-body .auto-move-dot { animation: none; }`)
        .join("\n");
    expect(unpinned(sheet(deep))).toHaveLength(3);
    // Held at two classes and <html>, a pin loses to the scroll rule's five.
    expect(unpinned(sheet(`${deep}\n${pin("lite,still,weak")}`))).toEqual([
      expect.stringContaining("the lite pin loses"),
      expect.stringContaining("the still pin loses"),
      expect.stringContaining("the weak pin loses"),
    ]);
    const heavy = (t: string) => `html${t} .pp.home-body .auto-work .auto-move .auto-move-dot { animation: none; }`;
    expect(unpinned(sheet(`${deep}\n${heavy('[data-tier="lite"]')}\n${heavy('[data-tier="still"]')}\n${heavy("[data-weak]")}`))).toEqual([]);
    // One :is() list pins every tier at once, as auto.css §3 does.
    const list = `html:is([data-tier="lite"], [data-tier="still"], [data-weak]) .pp.home-body .auto-work :is(.auto-move .auto-move-dot, .auto-spine) { animation: none; }`;
    expect(unpinned(sheet(`${deep}\n${list}`))).toEqual([]);
    expect(specificity(".pp .auto-work:not([data-picked]) .auto-move[data-made] .auto-move-dot")).toEqual([0, 6, 0]);
    expect(specificity('html[data-tier="lite"] .home-body :is(.auto-pop, .auto-map-fig .auto-map-fade)')).toEqual([0, 4, 1]);
  });

  it("finds a class two section sheets both style, and lets auto.css share its marks", () => {
    const sheet = (name: string, css: string) => ({ sheet: `${DIR}/${name}`, blocks: parseCss(css) });
    const running = sheet("auto-running.css", ".pp .auto-dot { top: 12px; } .pp .auto-rail { width: 2px; }");
    const work = sheet("auto-work.css", ".pp .auto-move[data-made] .auto-dot { top: 19px; } html[data-weak] .pp :is(.auto-move .auto-pip) { animation: none; }");
    const shared = sheet("auto.css", ".pp .auto-pip { width: 6px; }");
    expect(sharedSubjects([running, work, shared])).toEqual(["auto-dot: auto-running.css, auto-work.css"]);
    // A class only named on the way to the subject is not styled there.
    expect(sharedSubjects([sheet("auto-running.css", ".pp .auto-move { gap: 0; }"), sheet("auto-work.css", ".pp .auto-move .auto-spine { top: 0; }")])).toEqual([]);
  });
});

describe("breadth: any work, for any business, and this platform as the proof", () => {
  const range = AUTO_HERO.range;
  const items = range.groups.flatMap((g) => g.items);
  const lines = SOURCE.split("\n");

  it("says it in the hero, the range, #running, the team, the FAQ, the terms and the credits, each in its own words", () => {
    expect(AUTO_META.title).toBe(`${ITEM.label}, for any business`);
    expect(lines.find((l) => /^\s*title: `\$\{ITEM\.label\}, for any business`/.test(l))).toContain("// OWNER");
    expect(AUTO_HERO.sub).toContain("whatever the business");
    expect(AUTO_HERO.sub).toContain("our own product, for AI phone agents");
    expect(range.lead.startsWith("Any work your business")).toBe(true);
    expect(range.lead.endsWith("Not just calls.")).toBe(true);
    expect(AUTO_RUNNING.sub).toContain("only the last starts with a phone call");
    expect(AUTO_RUNNING.lenses.map((l) => l.id)).toEqual(["pay", "morning", "document", "call"]);
    expect(AUTO_TEAM.sub).toContain("for any business");
    const calls = AUTO_FAQ.items[1];
    expect(calls.id).toBe("calls");
    expect(calls.q).toContain("‘Voice’");
    expect(COMPANY.name).toMatch(/\bVoice\b/);
    expect(calls.a.startsWith("No. We automate work for any business")).toBe(true);
    expect(calls.a).toContain(`${COMPANY.name} is also the name of our own product`);
    // Its businesses are its own, never the range's fields again; its count is the lenses'.
    const faqBusinesses = calls.a.split(" — ")[1].split(", ");
    const heroBusinesses = range.fields.replace(/^For /, "").split(" — ")[0].split(", ");
    expect(faqBusinesses.length).toBeGreaterThanOrEqual(5);
    expect(faqBusinesses.filter((b) => heroBusinesses.includes(b))).toEqual([]);
    expect(calls.a).toContain("three of the four under ‘Already running’ start the way work does in any business");
    expect(AUTO_RUNNING.lenses.filter((l) => l.id !== "call")).toHaveLength(3);
    expect(AUTO_RUNNING.foot).toContain("Swap the caller for a customer");
    expect(AUTO_BREAKS.sub).toContain("on yours, it could as well be an order");
    expect(AUTO_TERMS.after).toContain("the same team builds those too");
    expect(AUTO_CREDITS.items.find((i) => i.term === "The automations on this page")!.detail).toContain("not because calls are all we automate");
  });

  it("lists kinds of work and of business, never past work: three groups of four, calls one line of twelve", () => {
    expect(range.groups).toHaveLength(3);
    expect(items).toHaveLength(12);
    expect(new Set(items).size).toBe(12);
    expect(items.filter((i) => /\bcalls?\b|\bphone|\bvoice/i.test(i))).toEqual(["Calls written up and acted on, as on this platform"]);
    expect(range.fields.endsWith("this list doesn’t name.")).toBe(true);
  });

  it("names no brand and prints no figure in the range, and marks every line of it OWNER", () => {
    const text = strings(range);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const s of [range.lead, range.fields, ...items]) {
      const line = lines.find((l) => l.includes(`"${s}"`));
      expect(line, s).toBeDefined();
      expect(line, s).toContain("// OWNER");
    }
  });

  it("points #work's legend at the lenses that don't start with a call", () => {
    // Each "Watch it run" opens the lens whose blocks the proof names first.
    const KIND_IDS = Object.keys(KINDS) as BlockKind[];
    expect(KINDS.ai.show).toEqual({ lens: "document" });
    expect(KINDS.rule.show).toEqual({ lens: "pay" });
    expect(KINDS.send.show).toEqual({ lens: "pay" });
    const shown = KIND_IDS.flatMap((k) => { const s = KINDS[k].show; return s && "lens" in s ? [s.lens] : []; });
    expect(shown.filter((l) => l === "call")).toEqual([]);
  });
});
