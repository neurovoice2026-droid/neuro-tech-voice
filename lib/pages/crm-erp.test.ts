import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { guardFormula } from "@/app/api/calls/_lib/csv";
import { CallFiltersSchema, EXPORT_COLUMNS, EXPORT_ROW_LIMIT, ExportQuerySchema, buildCallFilterOps } from "@/app/api/calls/_lib/query";
import { INBOX_TABS } from "@/components/inbox/inbox-tabs";
import { DEEP_PANEL, HOME_COLORS } from "@/components/site/home/palettes";
import { holdFor } from "@/components/site/product/timing";
import { RESERVE_AT, RESERVES, reserveStyle } from "@/components/site/solutions/crm-erp/deferred";
import type { Team } from "@/components/site/solutions/custom-automations/team";
import type { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { RESERVE_AT as SAAS_RESERVE_AT, RESERVE_TIERS } from "@/components/site/solutions/custom-saas-platforms/deferred";
import type { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import type { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { SAAS_INK, SAAS_LIGHTS, type SaasLightId } from "@/components/site/solutions/custom-saas-platforms/palette";
import type { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import type { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { sentences } from "@/lib/pages/home/source";
import { INT_GOOGLE } from "@/lib/pages/integrations";
import { COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { SMS_LANGUAGES } from "@/lib/sms/templates";
import { contrast, flowReach, rgb, worstInZone, worstMoving, worstStatic } from "@/lib/testing/mesh-contrast";
import { AGENT_LIMITS } from "@/lib/voice/sync/limits";
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload";
import { ACTION_TYPES, GOOGLE_ACTION_INTEGRATION } from "@/lib/workflows/types";
import { CALL_OUTCOMES } from "@/types";
import {
  ACCREDITATIONS,
  CHECK_KINDS,
  FACTS,
  GRANTS,
  SAAS_CHECKS,
  SAAS_FAQ,
  SAAS_SCOPE,
  SAAS_START,
  SECTION_IDS as SAAS_SECTION_IDS,
  faqJsonLd,
  listJoin,
} from "./custom-saas-platforms";
import {
  CORE_PARTS,
  ERP_CHECKS,
  ERP_CORE,
  ERP_CREDITS,
  ERP_FAQ,
  ERP_HERO,
  ERP_META,
  ERP_MOVE,
  ERP_PROCESS,
  ERP_SHAPE,
  ERP_START,
  ERP_TEAM,
  ERP_TERMS,
  ERP_TRADEMARKS,
  FACTS_ERP,
  HANDOFFS,
  ROUTES,
  SAMPLES,
  SECTION_IDS,
  STEPS,
  type BizId,
  type CoreId,
  type Kind,
  type LaneId,
  type RouteId,
  type RowId,
  type ScopeId,
  type SectionId,
  type ShapeCore,
  type StepId,
} from "./crm-erp";

/* ------------------------------------------------------------------ *
 * /solutions/crm-erp — the claims the page makes, held to the things
 * they are about.
 *
 * The page argues that we design and build CRMs, ERPs and anything
 * between, for any business, shaped around its own process, and that a
 * CRM's hard parts already run here, on this platform, our own, for AI
 * phone agents: the proof, never the limit. What it lacks (quotes,
 * orders, stock, purchasing, roles) is said once and built for yours; the
 * customer record is "Partly here", because on this platform a customer
 * is a phone number. Its words are only as good as this file. It holds:
 *
 *   - every word read from a source (the menu item, the phone number,
 *     the trial, the SaaS page's credentials, region sentences, two of
 *     its checks rows and three of its scope parts, the handover line,
 *     Google's beta badge, the platform's own constants) to that source;
 *   - every figure the page prints about the platform to the repository
 *     (FACTS_ERP to the SQL, route files and constants it retypes: the
 *     tables and their row-level security, the CHECK lists, the export's
 *     columns and rows, the chart's views), and every sentence about the
 *     platform's parts to the code it paraphrases: a call's record and
 *     what it led to, bookings under a lock, the waiting list, the inbox,
 *     texts and their opt-out, reminders claimed once, the check before
 *     each fiscal invoice, the columns kept from a signed-in session, the
 *     exports, deleting a call, and every trial path a check names;
 *   - #process's sample to itself: eight steps, their kinds agreeing
 *     with #core's cards, their lines short enough for one dwell, its
 *     frame (process-frame.ts) and its drawing (process-geometry.ts): no
 *     connector crossing a card, no hand-off crossing a paper;
 *   - #shape's six samples to their fixed shape, and the ledger to
 *     fairness: kinds of product, never a product, and the built route
 *     with its own costs;
 *   - #move's rehearsal to its counts, and its figure
 *     (rehearsal-geometry.ts) to its rows and cards;
 *   - the honesty rules: no price, date, client, badge or past work;
 *     certification words only ever negated; grants only from their
 *     grantors; nothing that says an invoice is issued "once"; every
 *     Google connection "in beta"; every owner-stated line marked OWNER;
 *     every third-party mark credited, and every credited mark printed;
 *   - every link to a section, a card or a block that exists;
 *   - every colour on every reused light at this page's boxes, at rest
 *     and while the pools flow (lib/testing/mesh-contrast.ts), the fixed
 *     pairs, the stage, the night room and the deep panel;
 *   - the route's stylesheets to the motion contract, and the
 *     content-visibility reserves to the page's boxes;
 *   - the sibling parts this page reuses to the contract it reuses them
 *     on, and the siblings' own files to HEAD.
 *
 * The page is built by several hands at once (spec §8.3). A group that
 * reads a file another hand writes (the frame, the drawing, the
 * rehearsal's figure, a section's markup, the page, a section's sheet)
 * skips, and says which file it waits for, until that file lands; from
 * then on it runs.
 * ------------------------------------------------------------------ */

const ROOT = process.cwd();
const DIR = "components/site/solutions/crm-erp";
const SAAS_DIR = "components/site/solutions/custom-saas-platforms";
const AUTO_DIR = "components/site/solutions/custom-automations";
const APP_DIR = "app/solutions/crm-erp";
const PAGE_FILE = `${APP_DIR}/page.tsx`;
const DATA_FILE = "lib/pages/crm-erp.ts";
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const has = (file: string) => existsSync(path.join(ROOT, file));
/** A source file's text with its `//` comment lines joined, so a phrase broken across two of them still matches. */
const said = (file: string) => read(file).replace(/\n\s*\/\/\s*/g, " ");
/** A describe's title while a file another group writes hasn't landed. */
const waiting = (...files: string[]) => {
  const missing = files.filter((f) => !has(f));
  return missing.length ? ` (waiting for ${missing.join(", ")})` : "";
};

/* The pure modules other groups write, read once each has landed. */
const FRAME_FILE = `${DIR}/process-frame.ts`;
const GEOMETRY_FILE = `${DIR}/process-geometry.ts`;
const REHEARSAL_FILE = `${DIR}/rehearsal-geometry.ts`;
const frameKit = has(FRAME_FILE) ? await import("@/components/site/solutions/crm-erp/process-frame") : null;
const geometryKit = has(GEOMETRY_FILE) ? await import("@/components/site/solutions/crm-erp/process-geometry") : null;
const rehearsalKit = has(REHEARSAL_FILE) ? await import("@/components/site/solutions/crm-erp/rehearsal-geometry") : null;

/** Every file the six groups write (spec §8.3): the page is whole once each has landed. */
const PAGE_FILES = [
  PAGE_FILE,
  ...["deferred.tsx", "glyphs.tsx", "erp.css"],
  ...["process-geometry.ts", "process-lanes.tsx", "process-list.tsx", "papers.tsx", "erp-drawing.css"],
  ...["process.tsx", "process-stage.tsx", "process-frame.ts", "process-timeline.ts", "process-panels.tsx", "record-screens.tsx", "erp-process.css"],
  ...["shape.tsx", "shape-instrument.tsx", "shape-card.tsx", "ledger.tsx", "ledger-figures.tsx", "erp-shape.css"],
  ...["move.tsx", "rehearsal-figure.tsx", "rehearsal-geometry.ts", "mini-lanes.tsx", "erp-move.css"],
  ...["core.tsx", "erp-core.css"],
].map((f) => (f.includes("/") ? f : `${DIR}/${f}`));

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "crm-erp")!;
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms")!;
const AUTO_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations")!;
const MOB_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-mobile-applications")!;
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents")!;
const CALL = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref };
const ACC = `${ACCREDITATIONS.count}+`;
const GRANTORS = GRANTS.map((g) => g.grantor);

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A string as it reads: the word joiners (U+2060) that hold an identifier whole ("eu-west-1") left out. */
const plain = (s: string) => s.replaceAll("⁠", "");

/** Every string reachable from a value, as it reads (`plain`); functions are called with a sample argument (home.test.ts). */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(plain(value));
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
/** A repo-relative file path, as #core's index and #process's index print one. */
const IS_PATH = /^[\w.-]+(?:\/[\w.[\]()-]+)+$/;

const SECTIONS = {
  top: ERP_HERO,
  process: ERP_PROCESS,
  shape: ERP_SHAPE,
  move: ERP_MOVE,
  core: ERP_CORE,
  team: ERP_TEAM,
  terms: ERP_TERMS,
  checks: ERP_CHECKS,
  faq: ERP_FAQ,
  start: ERP_START,
} satisfies Record<SectionId, { title: string; key: string }>;

const PAGE = [ERP_META, ...Object.values(SECTIONS), ERP_CREDITS];
const ALL = strings(PAGE);
const CREDITS = strings(ERP_CREDITS);
const OUTSIDE_CREDITS = strings([ERP_META, ...Object.values(SECTIONS)]);
const FAQ_QS = new Set(ERP_FAQ.items.map((i) => i.q));
const SOURCE = read(DATA_FILE);
const LINES = SOURCE.split("\n");
/** The data module's code lines holding a string as written (a literal, not a template); its comments left out. */
const linesOf = (s: string) => LINES.filter((l) => l.includes(s) && !/^\s*(?:\/\/|\/?\*)/.test(l));
/** A string's line in the data module must carry the owner's mark: it rests on the owner's word. */
const expectOwner = (s: string) => {
  const at = linesOf(s);
  expect(at.length, s).toBeGreaterThan(0);
  for (const line of at) expect(line, s).toContain("// OWNER");
};

/** The build spec's lists, typed so a renamed id fails to compile here too. */
const STEP_IDS = ["enquiry", "quote", "followup", "order", "stock", "delivery", "invoice", "report"] as const satisfies readonly StepId[];
const LANE_IDS = ["sales", "ops", "accounts", "auto"] as const satisfies readonly LaneId[];
const CORE_IDS = ["history", "fields", "bookings", "messages", "yours", "invoicing", "usage", "reports", "exports"] as const satisfies readonly CoreId[];
const BIZ_IDS = ["wholesale", "trades", "retail", "making", "appointments", "services"] as const satisfies readonly BizId[];
const SCOPE_IDS = ["sales", "ops", "all"] as const satisfies readonly ScopeId[];
const SHAPE_CORES = ["history", "messages", "bookings", "invoicing"] as const satisfies readonly ShapeCore[];
const ROUTE_IDS = ["shelf", "extended", "built"] as const satisfies readonly RouteId[];
const ROW_IDS = ["r1", "r2", "r3", "r4", "r5", "r6"] as const satisfies readonly RowId[];
/** The kinds' tags: a step's "On ours" follows its tag, so it never opens with one. */
const KIND_WORDS: Record<Kind, string> = { does: "Runs here", thin: "Partly here", none: "Built for yours" };
/** What a "Runs here" line on each card's parts must never promise: what that card doesn't run. */
const OVERREACH: Record<ShapeCore, RegExp> = { bookings: /online|desk|crew|room|signed|loaded/i, messages: /email|quiet|return/i, invoicing: /desk/i, history: /$^/ };
const coreOf = (id: CoreId) => CORE_PARTS.find((p) => p.id === id)!;
const stepAt = (id: StepId) => STEPS.findIndex((s) => s.id === id);

/*
 * Third-party names a page like this could print: the siblings'
 * registry, with the accounting, shop and CRM products a comparison
 * might reach for. Each one printed must be credited in a line that says
 * whose trademark it is, and none may appear in a sample.
 */
const REGISTRY = [
  "Anthropic", "Claude", "Google", "Gmail", "Google Calendar", "Google Sheets", "Google Docs", "Google Drive", "Google Workspace",
  "Microsoft", "Excel", "Outlook", "Amazon", "AWS", "Apple", "iOS", "Android", "GitHub",
  "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Supabase", "Postgres", "PostgreSQL", "Twilio", "Telnyx", "Resend",
  "Vercel", "Next.js", "Node.js", "React", "Fly.io", "Slack", "Upstash", "Redis", "WhatsApp",
  "Zapier", "Make", "n8n", "DocuSign", "PayPal", "QuickBooks", "Xero", "Sage", "Shopify", "WooCommerce", "Magento",
  "Salesforce", "HubSpot", "Pipedrive", "SAP", "Odoo", "Zoho", "Dynamics", "NetSuite", "monday.com", "Freshsales", "Oracle", "Zendesk",
];
/** Whether a mark is named: "Make" only as a name, never as the verb that starts a sentence. */
function named(mark: string, s: string): boolean {
  if (mark === "Make") return /(?<!^\s*|[.!?:]\s*|[“‘"(]\s*)\bMake\b/.test(s);
  return new RegExp(`\\b${mark.replace(/[.]/g, "\\.")}\\b`).test(s);
}
/** The products a fair comparison never names (spec §9.4), anywhere the page prints, credits included. */
const VENDORS = /Salesforce|HubSpot|Pipedrive|\bSAP\b|Odoo|Zoho|Dynamics|NetSuite|monday\.com|Freshsales|\bSage\b|Oracle|Zendesk|Microsoft|Excel/;
/** A word that tips a comparison: "the ledger, the FAQ's offshelf row and the credits' line" never use one. */
const LOADED = /cheap|expensive|costly|\bslow|faster|rigid|clunky|outdated|lock-?in|better than|\bbest\b/i;
const GOOGLE_STEP = /\bGmail\b|\bGoogle (?:Sheets|Docs|Drive)\b/;

/* ---------- SQL, read as the migrations write it ---------- */

const MIGRATIONS = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
/** Every migration, `--` comments left out (one of them says "CREATE TABLE" in prose). */
const SQL = MIGRATIONS.map((f) => read(`supabase/migrations/${f}`).replace(/--.*$/gm, "")).join("\n");
/** A CREATE TABLE's body, up to its closing `);` at the start of a line. */
function tableBody(sql: string, table: string): string {
  const at = sql.search(new RegExp(String.raw`CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?${table}\s*\(`));
  if (at < 0) throw new Error(`no CREATE TABLE ${table}`);
  return sql.slice(at, sql.indexOf("\n);", at));
}
/** The values `CHECK (<column> IN (…))` allows, in the first place `sql` says it. */
function checkIn(sql: string, column: string): string[] {
  const m = sql.match(new RegExp(String.raw`CHECK \(${column} IN \(([^)]*)\)\)`));
  if (!m) throw new Error(`no CHECK (${column} IN …)`);
  return m[1].split(",").map((v) => v.trim().replace(/^'|'$/g, ""));
}

describe("facts read from their sources", () => {
  it("reads the menu item: its label, description, promise, deliverables and stack", () => {
    // Guarded exactly: the page's stages, terms, core layers and shape title are written for these.
    expect(ITEM).toMatchObject({
      label: "Custom CRM & ERP",
      href: "/solutions/crm-erp",
      description: "One system for customers, orders and operations.",
      promise: "A CRM or ERP shaped around your process, not the other way round.",
      deliverables: ["Pipeline, stock and invoicing in one place", "Migrated off spreadsheets and legacy tools", "Every agent call logged against the customer"],
      stack: ["Sales", "Inventory", "Invoicing", "Reporting"],
    });
    expect(ERP_HERO.eyebrow).toBe(ITEM.label);
    expect(ERP_META.title.startsWith(ITEM.label)).toBe(true);
    expect(ERP_HERO.sub.startsWith(ITEM.description)).toBe(true);
    expect(ERP_SHAPE.title).toBe(ITEM.promise);
    expect(ERP_MOVE.stages.map((s) => s.title).slice(1)).toEqual(ITEM.deliverables.slice(0, 2));
    expect(ERP_MOVE.stages.map((s) => s.n)).toEqual(["01", "02", "03"]);
    expect(ERP_TERMS.columns.find((c) => c.id === "get")!.items.slice(0, 2)).toEqual(ITEM.deliverables.slice(0, 2));
    expect(ERP_CORE.layers).toEqual(ITEM.stack);
    // The plates are this page's own layers, not the stack's: an "Inventory" plate would say stock runs here.
    expect(ERP_HERO.room.plates.map((p) => p.layer)).toEqual(["Customers", "Bookings", "Invoicing", "Reporting"]);
    for (const p of ERP_HERO.room.plates) expect(p.datum.length, p.datum).toBeLessThanOrEqual(20);
  });

  it("prints the voice-centric deliverable once, qualified as one option", () => {
    const d = ITEM.deliverables[2];
    const printed = ALL.filter((s) => s.toLowerCase().includes(d.toLowerCase()));
    expect(printed).toEqual([`If you use a phone agent, ours or another: ${lowerFirst(d)}`]);
  });

  it("starts every build with the menu's own phone call", () => {
    expect(SOLUTIONS_MENU.cta.href(ITEM.id)).toBe(COMPANY.phoneHref);
    for (const link of [ERP_HERO.primary, ERP_FAQ.talk, ERP_START.primary, ERP_CHECKS.missing.cta]) expect(link).toEqual(CALL);
    expect(ERP_FAQ.phone).toBe(COMPANY.phone);
    expect(ERP_HERO.note.startsWith(COMPANY.phone)).toBe(true);
    expect(ERP_START.note.startsWith(COMPANY.phone)).toBe(true);
    const tel = hrefs(PAGE).filter((h) => h.startsWith("tel:"));
    expect(tel.length).toBeGreaterThanOrEqual(4);
    for (const h of tel) expect(h).toBe(COMPANY.phoneHref);
  });

  it("sends every trial link to the free trial", () => {
    const trial = linksIn(PAGE).filter((l) => /free trial|Try the platform|^Start free$/i.test(l.label));
    expect(trial.length).toBeGreaterThan(5);
    for (const l of trial) expect(l.href, l.label).toBe(PRICING_TRIAL.href);
    expect(ERP_CHECKS.rows.filter((r) => r.link?.label === PRICING_TRIAL.cta)).toHaveLength(3);
  });

  it("links the team to the SaaS page's credentials, which it still has, and the terms to the team's other builds", () => {
    expect(SAAS_ITEM.href).toBe("/solutions/custom-saas-platforms");
    expect(ERP_TEAM.grants.more.href).toBe(`${SAAS_ITEM.href}#credentials`);
    expect(SAAS_SECTION_IDS).toContain("credentials");
    expect(ERP_TERMS.links.map((l) => l.href)).toEqual([SAAS_ITEM.href, AUTO_ITEM.href, MOB_ITEM.href, CAA_ITEM.href]);
  });

  it("reuses the SaaS module's credentials and check kinds, never a copy of either", () => {
    for (const kinds of [ERP_TEAM.checkKinds, ERP_MOVE.checkKinds, ERP_CORE.checkKinds, ERP_CHECKS.kinds]) expect(kinds).toBe(CHECK_KINDS);
    expect(ERP_TEAM.accreditations.figure).toBe(ACC);
    expect(ERP_TEAM.grants.names).toEqual(GRANTORS);
    expect(ERP_HERO.proof.find((p) => p.label === "Startup grants")!.term).toBe(listJoin(GRANTORS));
    // The one list of parts behind #core's cards, the steps' tags and #shape's.
    expect(ERP_CORE.parts).toBe(CORE_PARTS);
    expect(ERP_PROCESS.steps).toBe(STEPS);
    expect(ERP_PROCESS.handoffs).toBe(HANDOFFS);
    expect(ERP_SHAPE.samples).toBe(SAMPLES);
    expect(ERP_SHAPE.ledger.routes).toBe(ROUTES);
  });

  it("takes two checks rows from the SaaS page by id: the same objects, never retyped", () => {
    for (const id of ["cards", "company"]) {
      const theirs = SAAS_CHECKS.rows.find((r) => r.id === id);
      expect(theirs, id).toBeDefined();
      expect(ERP_CHECKS.rows.find((r) => r.id === id), id).toBe(theirs);
    }
  });

  it("offers the accreditations and the grants on the call until there is a public link", () => {
    const acc = ERP_CHECKS.rows.find((r) => r.id === "accreditations")!;
    if (ACCREDITATIONS.verify === null) {
      expect(ERP_TEAM.accreditations.check.kind).toBe("call");
      expect(acc.kind).toBe("call");
      expect(acc.link).toBeUndefined();
    } else {
      expect(ERP_TEAM.accreditations.check).toMatchObject({ kind: "site", href: ACCREDITATIONS.verify.href });
      expect(acc).toMatchObject({ kind: "site", link: { href: ACCREDITATIONS.verify.href } });
    }
    const grants = ERP_CHECKS.rows.find((r) => r.id === "grants")!;
    const grantLink = GRANTS.find((g) => g.verify)?.verify;
    if (!grantLink) {
      expect(ERP_TEAM.grants.check.kind).toBe("call");
      expect(grants.kind).toBe("call");
      expect(grants.link).toBeUndefined();
    } else {
      expect(ERP_TEAM.grants.check).toMatchObject({ kind: "site", href: grantLink.href });
      expect(grants).toMatchObject({ kind: "site", link: { href: grantLink.href } });
    }
  });

  it("reads where the data lives from the SaaS page's answer, eu-west-1 held whole", () => {
    const saas = SAAS_FAQ.items.find((i) => i.id === "data")!.a;
    const ours = ERP_FAQ.items.find((i) => i.id === "data")!;
    expect(ours.a.endsWith(sentences(saas, 1, 5).replaceAll("eu-west-1", "eu-⁠west-⁠1"))).toBe(true);
    expect(plain(ours.a)).toContain("eu-west-1 (Ireland)");
    expect(ours.where).toEqual({ label: "Read the privacy policy", href: "/privacy" });
  });

  it("reads the usage card from the SaaS scope, and leans on its teams and import parts only while they say so", () => {
    const part = (id: string) => SAAS_SCOPE.parts.find((p) => p.id === id)!;
    expect(coreOf("usage").ours).toBe(part("usage").ours);
    expect(part("usage").kind).toBe("does");
    expect(part("teams").kind).toBe("none");
    expect(part("teams").ours).toMatch(/single owner/);
    expect(part("import").kind).toBe("none");
    expect(part("import").ours).toMatch(/started empty/);
    expect(coreOf("yours").ours).toContain("a single owner");
    expect(ERP_MOVE.stages.find((s) => s.id === "build")!.ours).toContain("This platform started empty");
  });

  it("borrows the handover line from the custom AI agents page", () => {
    expect(ERP_TERMS.columns.find((c) => c.id === "upfront")!.items.at(-1)).toBe(CAA_HANDOVER.after);
  });

  it("prints each count the platform's own constants hold, where the data module says", () => {
    const history = coreOf("history");
    expect(history.datum).toBe(`${CALL_OUTCOMES.length} call outcomes`);
    expect(history.ours).toContain(`one of ${word(CALL_OUTCOMES.length)} outcomes`);
    expect(ERP_HERO.room.plates[0].datum).toBe(`${CALL_OUTCOMES.length} call outcomes`);
    expect(word(CALL_OUTCOMES.length)).toBe("ten");
    const fields = coreOf("fields");
    expect(fields.datum).toBe(`up to ${AGENT_LIMITS.leadFields}`);
    expect(fields.ours).toContain(`up to ${word(AGENT_LIMITS.leadFields)} questions`);
    expect(word(AGENT_LIMITS.leadFields)).toBe("twelve");
    const messages = coreOf("messages");
    expect(messages.datum).toBe(`${SMS_LANGUAGES.length} languages`);
    expect(messages.ours).toContain(`${word(SMS_LANGUAGES.length)} languages`);
    expect(word(SMS_LANGUAGES.length)).toBe("fourteen");
    const printed = ALL.flatMap((s) => [...s.matchAll(/\b(\d+) languages\b/g)].map((m) => Number(m[1])));
    for (const n of printed) expect(n).toBe(SMS_LANGUAGES.length);
    expect(coreOf("invoicing").datum).toBe(`${FACTS.stripeEvents} event types`);
    expect(coreOf("invoicing").ours).toContain(`on ${word(FACTS.stripeEvents)} kinds of event`);
    expect(ERP_HERO.room.plates[2].datum).toBe(`${FACTS.stripeEvents} Stripe event types`);
    const under = (id: string) => ERP_CORE.under.find((u) => u.id === id)!;
    expect(under("schema").datum).toBe(`${FACTS.migrations} migrations`);
    expect(ERP_MOVE.stages.find((s) => s.id === "build")!.ours).toContain(`one of ${FACTS.migrations} migrations`);
    expect(under("jobs").datum).toBe(FACTS.cronAt);
    expect(under("jobs").text).toContain(`${word(FACTS.cronSteps.length)} steps`);
    // The follow-up step and the messages card name the booking reminders: the daily job still runs them.
    expect(FACTS.cronSteps).toContain("booking_reminders");
  });

  it("reads the inbox's tabs, the workflow steps and Google's badge the copy leans on", () => {
    expect(INBOX_TABS).toEqual(["messages", "bookings", "waitlist"]);
    for (const a of ["send_webhook", "notify_slack", "send_sms"] as const) expect(ACTION_TYPES).toContain(a);
    expect(Object.values(GOOGLE_ACTION_INTEGRATION)).toEqual(expect.arrayContaining(["gmail", "google_sheets", "google_docs", "google_drive", "google_calendar"]));
    // "Signed webhooks": every delivery carries a signature header.
    expect(WEBHOOK_HEADERS.signature).toMatch(/Signature/);
    expect(read("lib/workflows/payload.ts")).toContain("WEBHOOK_HEADERS");
    expect(INT_GOOGLE.badge).toBe("Beta");
    // The dashboard badges the whole Google section.
    const integrations = read("components/integrations/IntegrationsClient.tsx");
    const google = integrations.slice(integrations.indexOf('aria-labelledby="google-heading"'));
    expect(google.slice(0, 800)).toContain("<BetaBadge />");
    expect(has("lib/google/calendar.ts")).toBe(true);
  });
});

describe("counts and code held to the repository", () => {
  it("counts the tables the migrations create, and switches row-level security on for every one", () => {
    expect(MIGRATIONS).toHaveLength(FACTS.migrations);
    const created = new Set([...SQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]));
    const secured = new Set(
      [...SQL.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map((m) => m[1]),
    );
    expect([...created].sort()).toEqual([...secured].sort());
    expect(created.size).toBe(FACTS_ERP.tables);
    expect(SQL).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY|DROP\s+TABLE/i);
    expect(ERP_CORE.under.find((u) => u.id === "walls")!.datum).toBe(`${FACTS_ERP.tables} of ${FACTS_ERP.tables} tables`);
    expect(ERP_CHECKS.rows.find((r) => r.id === "walls")!.claim).toContain(`every one of its ${FACTS_ERP.tables} database tables`);
    expect(ERP_MOVE.stages.find((s) => s.id === "build")!.ours).toContain(`every one of its ${FACTS_ERP.tables} tables`);
  });

  it("reads each state list the page counts from its CHECK constraint", () => {
    const v010 = read("supabase/migrations/010_voice_platform.sql");
    expect(checkIn(tableBody(v010, "bookings"), "status")).toEqual(FACTS_ERP.bookingStates);
    expect(checkIn(tableBody(v010, "waitlist_entries"), "status")).toEqual(FACTS_ERP.waitlistStates);
    expect(checkIn(tableBody(v010, "agent_messages"), "status")).toEqual(FACTS_ERP.messageStates);
    expect(checkIn(tableBody(v010, "sms_messages"), "kind")).toEqual(FACTS_ERP.textKinds);
    expect(checkIn(tableBody(read("supabase/migrations/006_smartbill_invoices.sql"), "invoices"), "status")).toEqual(FACTS_ERP.invoiceStates);
    const outcomes = v010.slice(v010.indexOf("'calls_outcome_check'"));
    expect(checkIn(outcomes, "outcome")).toEqual([...CALL_OUTCOMES]);
    expect(coreOf("bookings").datum).toBe(`${FACTS_ERP.bookingStates.length} booking states`);
    expect(ERP_HERO.room.plates[1].datum).toBe(`${FACTS_ERP.bookingStates.length} booking states`);
  });

  it("links what a call led to back to it, and loads it with the call", () => {
    const v010 = read("supabase/migrations/010_voice_platform.sql");
    for (const t of ["bookings", "waitlist_entries", "agent_messages", "sms_messages", "tool_invocations"]) {
      expect(tableBody(v010, t), t).toMatch(/\bcall_id\b/);
    }
    // No customers table: a customer is the caller's number.
    expect(SQL).not.toMatch(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(?:customers|contacts)\b/i);
    const route = read("app/api/calls/[id]/route.ts");
    const get = route.slice(route.indexOf("export const GET"), route.indexOf("export const DELETE"));
    for (const t of ["bookings", "agent_messages", "tool_invocations"]) {
      expect(get, t).toMatch(new RegExp(String.raw`\.from\('${t}'\)[\s\S]{0,200}?\.eq\('call_id', id\)`));
    }
    expect(coreOf("history").ours).toContain("the bookings, messages and actions it led to link back to it");
    // Texts aren't named here: a waitlist offer is logged with no call (the messages card says which texts carry theirs).
    expect(coreOf("history").ours).not.toMatch(/\btexts\b/);
  });

  it("counts the outcomes that need the platform's own record, and falls back to answered without it", () => {
    const analysis = read("lib/openai/analysis.ts");
    const set = analysis.match(/const EVIDENCE_ONLY_OUTCOMES[^=]*= new Set\(\[([^\]]*)\]\)/)?.[1] ?? "";
    const outcomes = [...set.matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(outcomes).toHaveLength(FACTS_ERP.evidenceOutcomes);
    for (const o of outcomes) expect(CALL_OUTCOMES as readonly string[], o).toContain(o);
    expect(analysis).toContain("if (EVIDENCE_ONLY_OUTCOMES.has(analysis.outcome)) return 'answered'");
    // "such as booked or transferred": two of the set, by name.
    expect(outcomes).toEqual(expect.arrayContaining(["booked", "transferred"]));
    expect(coreOf("history").ours).toContain(`${cap(word(FACTS_ERP.evidenceOutcomes))} of those outcomes, such as booked or transferred, are set only when the platform itself did it, never on the AI’s word alone.`);
    // "The AI that reviews each call afterwards is told to add only what a caller clearly said, never a guess":
    // an instruction in the analysis prompt, said as one, of that AI alone. The agent's own
    // save_lead_details values win over it, so the card never promises that only what was clearly said is kept.
    expect(analysis).toContain("only values the caller clearly stated");
    expect(analysis).toContain("Never guess.");
    expect(analysis).toContain("Tool-captured values (save_lead_details) beat model extraction");
    expect(coreOf("fields").ours).toContain("the AI that reviews each call afterwards is told to add only what a caller clearly said, never a guess");
    expect(coreOf("fields").ours).not.toMatch(/clearly said is kept/);
  });

  it("holds the lead questions to the agent's limits, its schema and the screens that show them", () => {
    expect(AGENT_LIMITS.leadFields).toBe(12);
    expect(read("lib/voice/sync/limits.ts")).toContain("No zod here");
    const schemas = read("lib/voice/sync/schemas.ts");
    expect(schemas).toContain("required: z.boolean(),");
    expect(schemas).toContain(".max(AGENT_LIMITS.leadFields");
    expect(read("components/calls/CallDetailSheet.tsx")).toContain("Details collected");
    expect(read("components/skills/LeadQuestionsSkill.tsx")).toContain('title="Lead questions"');
    expect(read("components/agent/AgentPageClient.tsx")).toContain("skills: { label: 'Skills'");
    expect(coreOf("fields").ours).toContain("under ‘Details collected’");
    expect(coreOf("fields").check.how).toBe("Under Agent → Skills → Lead questions.");
  });

  it("exports calls as the export's own schema, columns and cap say", () => {
    expect(EXPORT_COLUMNS).toHaveLength(FACTS_ERP.exportColumns);
    expect(EXPORT_ROW_LIMIT).toBe(FACTS_ERP.exportRows);
    for (const format of ["csv", "json"]) expect(ExportQuerySchema.safeParse({ format }).success, format).toBe(true);
    expect(ExportQuerySchema.safeParse({ format: "xlsx" }).success).toBe(false);
    for (const scope of ["all", "filtered", "selected"]) expect(ExportQuerySchema.safeParse({ scope }).success, scope).toBe(true);
    expect(ExportQuerySchema.safeParse({ scope: "everything" }).success).toBe(false);
    const route = read("app/api/calls/export/route.ts");
    expect(route).toContain("'X-Export-Truncated'");
    expect(read("components/calls/ExportDialog.tsx")).toContain("res.headers.get('X-Export-Truncated') === 'true'");
    const exports = coreOf("exports");
    expect(exports.datum).toBe(`${FACTS_ERP.exportColumns} columns`);
    expect(exports.ours).toContain(`as CSV or JSON, from ${word(FACTS_ERP.exportColumns)} columns, up to ${FACTS_ERP.exportRows.toLocaleString("en-US")} a file`);
    expect(ERP_HERO.room.plates[3].datum).toBe(`${FACTS_ERP.exportColumns} export columns`);
  });

  it("keeps a cell that would run as a formula as text, and a plain phone number as it is", () => {
    expect(guardFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(guardFormula("@cmd")).toBe("'@cmd");
    expect(guardFormula("+40 774 566 367")).toBe("+40 774 566 367");
    expect(said("app/api/calls/_lib/csv.ts")).toContain("Excel and Sheets show them as text");
    expect(coreOf("exports").ours).toContain("A cell that would run as a formula in a spreadsheet is kept as text.");
  });

  it("offers the chart's three views, the longer ones by plan, and names them in words", () => {
    const chart = read("app/api/dashboard/calls-chart/route.ts");
    const days = chart.match(/days: z\.enum\(\[([^\]]*)\]\)/)?.[1] ?? "";
    expect([...days.matchAll(/'(\d+)'/g)].map((m) => Number(m[1]))).toEqual([...FACTS_ERP.chartDays]);
    expect(chart).toContain("entitlements.fullAnalytics");
    expect(chart).toContain("entitlements.advancedAnalytics");
    // DAYS_WORD (not exported) has exactly the chart's keys: its type is Record<7 | 30 | 90, string>.
    const daysWord = SOURCE.match(/const DAYS_WORD: Record<\(typeof FACTS_ERP\.chartDays\)\[number\], string> = \{([^}]*)\}/)?.[1] ?? "";
    expect([...daysWord.matchAll(/(\d+):/g)].map((m) => Number(m[1]))).toEqual([...FACTS_ERP.chartDays]);
    expect(coreOf("reports").ours).toContain(`over the last ${FACTS_ERP.chartDays.map((d) => ({ 7: "seven", 30: "thirty", 90: "ninety" })[d]).join(", ").replace(/, (\w+)$/, " or $1")} days, the longer views on higher plans`);
  });

  it("counts the headline figures in the database, test calls left out, in each business's own time zone", () => {
    const v010 = read("supabase/migrations/010_voice_platform.sql");
    const fn = v010.slice(v010.indexOf("CREATE OR REPLACE FUNCTION public.dashboard_metrics(p_org_id uuid, p_tz text)"));
    const body = fn.slice(0, fn.indexOf("$$;"));
    expect(body).toContain("public.resolve_time_zone(p_tz)");
    expect(body).toContain("AND NOT c.is_test");
    expect(body).toMatch(/extract\(hour FROM [^)]*\)::integer AS hour_of_day/);
    for (const k of ["calls_today", "calls_this_week", "calls_this_month", "sentiment_breakdown", "peak_hour", "outcome_breakdown"]) expect(body, k).toContain(`'${k}'`);
    expect(read("app/api/dashboard/metrics/route.ts")).toContain("rpc('dashboard_metrics'");
    expect(coreOf("reports").ours).toContain("counted in each business’s own time zone with test calls left out");
    // "This week" is today and the six days before, as the dashboard labels it: "in the last seven days".
    expect(body).toContain("v_week_start := (v_local_today - 6)");
    expect(read("components/dashboard/MetricsCards.tsx")).toContain("in the last 7 days");
    expect(coreOf("reports").ours).toContain("calls today, in the last seven days and this month");
    // The chart leaves test calls out too, so on the trial every figure reads nought, as the check says.
    const chartFn = v010.slice(v010.indexOf("CREATE OR REPLACE FUNCTION public.calls_chart("));
    expect(chartFn.slice(0, chartFn.indexOf("$$;"))).toContain("AND NOT c.is_test");
    // The check names the screen by its nav label.
    expect(read("components/dashboard/DashboardShell.tsx")).toContain("{ href: '/dashboard', label: 'Dashboard'");
    const check = coreOf("reports").check;
    expect(check.label).toBe("See the dashboard on the free trial");
    expect(check.how).toMatch(/^Under Dashboard\. Test calls stay out of its figures/);
  });

  it("deletes a call with its voice providers' copies, or not at all", () => {
    const route = read("app/api/calls/[id]/route.ts");
    const del = route.slice(route.indexOf("export const DELETE"));
    const copies = del.indexOf("await deleteProviderCopies(call)");
    expect(copies).toBeGreaterThan(-1);
    expect(copies).toBeLessThan(del.indexOf(".delete()"));
    expect(del).toMatch(/if \(failed\.length > 0\) \{\s*throw new ApiError\(/);
    expect(del).toContain("so nothing was deleted");
    expect(read("components/calls/CallDetailSheet.tsx")).toContain("Delete this call");
    expect(ERP_MOVE.stages.find((s) => s.id === "switch")!.ours).toContain("a call is deleted with the copies its voice providers kept, or not at all");
  });

  it("hides test calls until ‘Show test calls’ is on, and exports them only from the current view", () => {
    // Every call on the trial is a test call: the list leaves them out unless asked.
    expect(buildCallFilterOps(CallFiltersSchema.parse({}), "UTC")).toContainEqual({ op: "eq", column: "is_test", value: false });
    expect(buildCallFilterOps(CallFiltersSchema.parse({ include_test: "1" }), "UTC")).not.toContainEqual({ op: "eq", column: "is_test", value: false });
    expect(read("components/calls/CallsToolbar.tsx")).toContain("Show test calls");
    const dialog = read("components/calls/ExportDialog.tsx");
    expect(dialog).toContain("label: hasFilters ? 'Calls matching your filters' : 'Calls in the current view'");
    expect(dialog).toContain("{ id: 'all', label: 'Every call', hint: 'Test calls are left out' }");
    expect(dialog).toContain("const params = scope === 'filtered' ? filtersToApiParams(filters, includeTest) : new URLSearchParams()");
    // "Every call" asks for the list's defaults, which leave test calls out.
    expect(read("app/api/calls/export/route.ts")).toMatch(/params\.scope === 'all'\s*\?\s*buildCallFilterOps\(CallFiltersSchema\.parse\(\{\}\), timeZone\)/);
    // "Show test calls" alone is no filter, so the view keeps its "Calls in the current view" label.
    const hooks = read("hooks/useCalls.ts");
    const count = hooks.slice(hooks.indexOf("export function activeFilterCount"));
    expect(count.slice(0, count.indexOf("\n}\n"))).not.toMatch(/includeTest|include_test|\btest\b/);
  });

  it("books under a lock after a fresh check, never twice on a retry, and offers a freed time without booking it", () => {
    const bookings = said("lib/scheduling/bookings.ts");
    expect(bookings).toContain("a fresh busy check right before writing, under a short per-organisation lock, so two callers can't take the same slot");
    expect(bookings).toContain("retries of the same request (model or gateway) return the first booking");
    expect(bookings).toMatch(/async function withOrgLock</);
    expect(bookings).toMatch(/async function loadBusy\(/);
    const waitlist = said("lib/scheduling/waitlist.ts");
    expect(waitlist).toContain("the freed time is offered by text to the longest waiting caller whose service fits");
    expect(waitlist).toContain("(no link, no automatic booking)");
    const card = coreOf("bookings").ours;
    expect(card).toContain("under a short lock, so two callers can’t take the same time, and a retried request never books twice");
    expect(card).toContain("offered by text to whoever has waited longest for that service; they call back to take it");
  });

  it("saves every message to one inbox first, urgent first, and logs every text with its opt-out checked", () => {
    expect(read("app/api/messages/route.ts")).toContain(".order('urgency', { ascending: false })");
    expect(said("lib/voice/tools/messages.ts")).toContain("saves the message to the inbox first (so it exists even if every notification fails)");
    const sms = said("lib/twilio/sms.ts");
    expect(sms).toContain("STOP opt-out");
    expect(sms).toContain("Every attempt, sent or failed at Twilio, is logged in sms_messages");
    for (const col of ["call_id", "booking_id"]) expect(tableBody(read("supabase/migrations/010_voice_platform.sql"), "sms_messages"), col).toMatch(new RegExp(`\\b${col}\\b`));
    const card = coreOf("messages").ours;
    expect(card).toContain("saved to one inbox before anyone is alerted, urgent first, and move from new to done");
    // "sent or failed at Twilio", the source's own words: a text the guard stops is never sent, and never logged.
    expect(card).toContain("Every text sent or failed at Twilio is logged, a booking’s with its booking and a call’s with its call; nobody who replied STOP is texted again");
    // "new to done": the first and last of the inbox's states.
    expect([FACTS_ERP.messageStates[0], FACTS_ERP.messageStates.at(-1)]).toEqual(["new", "done"]);
  });

  it("logs a booking's texts with the booking and a call's with the call; only a waitlist offer carries neither", () => {
    /** Each `sendSms({ … })` call's argument, its braces balanced (a body built by a call nests its own). */
    const argsOf = (src: string) => {
      const out: string[] = [];
      for (let at = src.indexOf("sendSms({"); at >= 0; at = src.indexOf("sendSms({", at + 1)) {
        let depth = 0;
        let end = at + "sendSms(".length;
        for (; end < src.length; end++) {
          if (src[end] === "{") depth++;
          else if (src[end] === "}" && --depth === 0) break;
        }
        out.push(src.slice(at, end + 1));
      }
      return out;
    };
    const sites = [...walk("lib"), ...walk("app")]
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .flatMap((f) => argsOf(read(f)).map((args) => ({ f, args, kind: args.match(/\bkind: '(\w+)'/)?.[1] })));
    expect(sites.length).toBeGreaterThanOrEqual(6);
    for (const { f, args, kind } of sites) {
      expect(FACTS_ERP.textKinds as readonly string[], f).toContain(kind);
      if (kind === "waitlist_offer") expect(args, f).not.toMatch(/\b(?:callId|bookingId)\b/);
      else if (kind === "confirmation" || kind === "reminder") expect(args, `${f}: ${kind}`).toMatch(/\bbookingId: \S/);
      else expect(args, `${f}: ${kind}`).toMatch(/\bcallId: \S/);
    }
    // A team alert's text takes the call from its caller: every one passes it.
    const alerts = [...walk("lib"), ...walk("app")]
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .flatMap((f) => read(f).split("notifyContacts({").slice(1).map((rest) => ({ f, head: rest.slice(0, 1200) })));
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    for (const { f, head } of alerts) expect(head, f).toMatch(/\bcallId: (?:call\.id|ctx\.call\.id)\b/);
  });

  it("claims each reminder before its text goes out, and frees it if the text fails", () => {
    const reminders = read("lib/scheduling/reminders.ts");
    for (const phrase of [".update({ reminder_sent_at: claimedAt })", ".is('reminder_sent_at', null)", ".update({ reminder_sent_at: null })"]) {
      expect(reminders, phrase).toContain(phrase);
    }
    expect(said("lib/scheduling/reminders.ts")).toContain("Each booking is claimed (reminder_sent_at set) before its text goes out");
    expect(STEPS[stepAt("followup")].ours).toContain("each reminder claimed before it’s sent, so none goes out twice");
  });

  it("checks for a fiscal invoice on record before issuing one, and records a failure under the same id", () => {
    const emit = read("lib/smartbill/emit.ts");
    const guard = emit.indexOf("// Idempotency guard.");
    expect(guard).toBeGreaterThan(-1);
    expect(emit.slice(guard, guard + 300)).toContain(".eq('stripe_invoice_id', invoice.id)");
    expect(emit.indexOf("if (existing) return")).toBeGreaterThan(guard);
    expect(emit.indexOf("if (existing) return")).toBeLessThan(emit.indexOf("sbInvoices.create("));
    const failed = emit.slice(emit.lastIndexOf("await supabase.from('invoices').insert({"));
    expect(failed.slice(0, 300)).toContain("stripe_invoice_id: invoice.id");
    expect(failed.slice(0, 300)).toContain("status: 'failed'");
    const webhook = read("app/api/billing/webhook/route.ts");
    expect(webhook).toContain("webhooks.constructEvent(rawBody, signature, webhookSecret)");
    for (const f of ["app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts"]) expect(has(f), f).toBe(true);
    // What is checked, never a promise of one invoice per payment (the Mobile and Automations rule).
    expect(coreOf("invoicing").ours).toContain("SmartBill fiscal invoices, each issued only after a check for one on record, with a failure recorded too.");
    expect(ERP_HERO.room.plates[2].runs).toContain("fiscal invoices, each issued only after a check for one on record");
  });

  it("keeps plan, billing, usage and owner from a signed-in session, only the server changing them, and each business to one owner", () => {
    const hardening = read("supabase/migrations/011_security_hardening.sql");
    const fn = hardening.slice(hardening.indexOf("CREATE OR REPLACE FUNCTION public.protect_org_columns()"));
    for (const col of ["plan", "stripe_customer_id", "minutes_used", "user_id", "billing_interval", "usage_period_start"]) {
      expect(fn.slice(0, 2000), col).toContain(`NEW.${col} := OLD.${col};`);
    }
    // The service role passes: the webhook still changes a plan after Checkout or the portal, from the Billing screen.
    expect(fn.slice(0, 2000)).toMatch(/->> 'role'\) = 'service_role'\) THEN\s+RETURN NEW;/);
    expect(read("app/api/billing/webhook/handlers.ts")).toContain("plan: mapped.plan");
    expect(hardening).toMatch(/CREATE TRIGGER protect_org_columns\s+BEFORE UPDATE ON public\.organizations/);
    expect(hardening).toMatch(/CREATE POLICY invoices_select_own ON public\.invoices\s+FOR SELECT TO authenticated/);
    expect(tableBody(read("supabase/migrations/001_initial_schema.sql"), "organizations")).toMatch(/user_id\s+uuid[^,\n]*\bUNIQUE\b/);
    expect(ERP_CORE.under.find((u) => u.id === "kept")!.text).toContain("can’t be changed by a signed-in session, only by the server: a database trigger keeps them");
  });

  it("runs each morning job on its own, so one failing never stops the rest", () => {
    expect(said("app/api/cron/daily/route.ts")).toContain("Every job is isolated: one failing never stops the others");
    expect(read("app/api/cron/jobs.ts")).toMatch(/export async function runCronStep[\s\S]*?catch \(error\)/);
    expect(ERP_CORE.under.find((u) => u.id === "jobs")!.text).toContain("each on its own, so one failing never stops the rest");
  });

  it("books into Google Calendar with each business's own account", () => {
    expect(read("lib/google/calendar.ts")).toContain("getAuthorizedClient(orgId, 'google_calendar')");
    // The workflow steps in Gmail, Sheets, Docs and Drive take the business's own account too.
    expect(read("lib/workflows/google.ts")).toContain("getAuthorizedClient(env.org.id, GOOGLE_ACTION_INTEGRATION[type])");
    expect(ERP_MOVE.stays.here.items).toContain("Google Calendar for bookings, with each business’s own account");
    expect(ERP_FAQ.items.find((i) => i.id === "connect")!.a).toContain("in beta, with each business’s own account");
  });

  it("opens the card form on Stripe's own address: a hosted Checkout page, never one embedded here", () => {
    const co = read("app/api/billing/checkout/route.ts");
    expect(co).toContain("stripe.checkout.sessions.create(");
    expect(co).not.toMatch(/ui_mode/);
    expect(co).toContain("url: session.url");
    expect(coreOf("invoicing").check.how).toBe("The card form opens on Stripe’s own address.");
  });

  it("points every step and every part at files that exist, and a part built for yours at none", () => {
    for (const p of [...STEPS, ...CORE_PARTS]) {
      expect(p.files.length === 0, p.id).toBe(p.kind === "none");
      for (const f of p.files) expect(has(f), `${p.id}: ${f}`).toBe(true);
    }
    expect(CORE_PARTS.flatMap((p) => p.files).length).toBeGreaterThan(25);
  });
});

describe("#process", () => {
  const steps = STEPS;

  it("follows one customer through eight steps in rail order, each in one of four lanes", () => {
    expect(steps.map((s) => s.id)).toEqual(STEP_IDS);
    expect(steps.map((s) => s.n)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    expect(ERP_PROCESS.lanes.map((l) => l.id)).toEqual(LANE_IDS);
    for (const s of steps) {
      expect(s.label.length, s.id).toBeLessThanOrEqual(9);
      expect(LANE_IDS as readonly string[], s.id).toContain(s.lane);
    }
    expect(ERP_PROCESS.initial).toEqual({ view: "one", step: "report" });
    expect(ERP_PROCESS.views.map((v) => v.id)).toEqual(["today", "one"]);
  });

  it("tags each step with its part on this platform, as its #core card does", () => {
    const kinds = (k: Kind) => steps.filter((s) => s.kind === k).map((s) => s.id);
    expect(kinds("thin")).toEqual(["enquiry", "followup", "delivery"]);
    expect(kinds("does")).toEqual(["invoice", "report"]);
    expect(kinds("none")).toEqual(["quote", "order", "stock"]);
    for (const s of steps) {
      expect(CORE_IDS as readonly string[], s.id).toContain(s.core);
      if (s.kind === "none") expect(s.core === "yours" || (s.id === "stock" && s.core === "bookings"), s.id).toBe(true);
      // A step can only lower its card's tag, never raise it: thin on a card that runs, as a #shape part can.
      else expect(s.kind === coreOf(s.core).kind || (s.kind === "thin" && coreOf(s.core).kind === "does"), s.id).toBe(true);
      // The caption and the index print the tag, then `ours`: it never says the tag again.
      for (const w of Object.values(KIND_WORDS)) expect(s.ours.toLowerCase().startsWith(w.toLowerCase()), s.ours).toBe(false);
      expect(s.ours.length, s.id).toBeLessThanOrEqual(110);
      // A built step's "On ours" promises what yours gets, so it rests on the owner's word; stock's names the booking rule, a fact.
      if (s.kind === "none" && s.id !== "stock") expectOwner(`ours: "${s.ours}"`);
    }
    // A caption's link is worded by the card it opens: stock, built for yours, says "See it running" of the booking rule.
    expect(ERP_PROCESS.coreKinds).toEqual(Object.fromEntries(CORE_PARTS.map((p) => [p.id, p.kind])));
    const see = (id: StepId) => ERP_PROCESS.caption.see[ERP_PROCESS.coreKinds[steps[stepAt(id)].core]];
    expect(see("stock")).toBe("See it running");
    expect(see("quote")).toBe("What’s built for yours");
    expect(see("enquiry")).toBe("See what runs");
    expect(ERP_PROCESS.kinds).toEqual(KIND_WORDS);
  });

  it("keeps every line short enough to read in one dwell, and the tour under forty seconds", () => {
    const lines = steps.flatMap((s) => [s.today, s.system]);
    for (const s of steps) {
      for (const l of [s.today, s.system]) {
        expect(l.length, l).toBeGreaterThanOrEqual(45);
        expect(l.length, l).toBeLessThanOrEqual(62);
        // The card and the live line print the label just before it.
        expect(l.toLowerCase().startsWith(s.label.toLowerCase()), l).toBe(false);
      }
      expect(holdFor(s.system), s.system).toBeGreaterThanOrEqual(2800);
      expect(holdFor(s.system), s.system).toBeLessThanOrEqual(3400);
    }
    const lengths = lines.map((l) => l.length);
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThanOrEqual(1.4);
    // Spec §4.2.6: Today's hold, the consolidation, the first dot, seven hops, eight dwells and the end.
    const tour = holdFor(ERP_PROCESS.intro.text) / 1000 + 1.6 + 0.25 + 7 * 0.6 + steps.reduce((t, s) => t + holdFor(s.system) / 1000, 0) + 0.6;
    expect(tour).toBeLessThan(40);
    expect(tour).toBeGreaterThan(30);
  });

  it("keeps each paper, history line, status and hotspot within its caps, the hotspot naming where it goes", () => {
    steps.forEach((s, i) => {
      expect(s.paper.title.length, s.id).toBeLessThanOrEqual(12);
      expect(s.paper.where.length, s.id).toBeLessThanOrEqual(22);
      expect(s.paper.pain.length, s.id).toBeLessThanOrEqual(24);
      expect(s.history.length, s.id).toBeLessThanOrEqual(30);
      expect(s.status.length, s.id).toBeLessThanOrEqual(12);
      expect(s.go.label.length, s.id).toBeLessThanOrEqual(22);
      // 08's opens 01's: the hotspot goes back to the customer.
      expect(s.go.aria, s.id).toBe(`${s.go.label} — opens ${steps[(i + 1) % steps.length].screen.title}`);
    });
    expect(new Set(steps.map((s) => s.paper.face)).size).toBe(steps.length);
    expect(steps.at(-1)!.status).toBe("Paid");
  });

  it("draws every screen as labelled blocks, values left as grey bars: no digit", () => {
    for (const s of steps) {
      const { title, blocks } = s.screen;
      expect(blocks.length >= 2 && blocks.length <= 4, s.id).toBe(true);
      expect(title.length, s.id).toBeLessThanOrEqual(16);
      for (const t of strings(s.screen)) {
        expect(t.length, `${s.id}: ${t}`).toBeLessThanOrEqual(28);
        expect(t, s.id).not.toMatch(/\d/);
      }
      for (const b of blocks) if (b.kind === "stages") expect(b.current >= 0 && b.current < b.items.length, s.id).toBe(true);
    }
    expect(new Set(steps.map((s) => s.screen.title)).size).toBe(steps.length);
  });

  it("marks where the details are typed again today, between two different steps", () => {
    for (const h of HANDOFFS) {
      expect(STEP_IDS as readonly string[], h.from).toContain(h.from);
      expect(STEP_IDS as readonly string[], h.to).toContain(h.to);
      expect(h.from).not.toBe(h.to);
      expect(stepAt(h.from), `${h.from} → ${h.to}`).toBeLessThan(stepAt(h.to));
      expect(h.text.length, h.text).toBeLessThanOrEqual(60);
    }
    expect(Object.keys(ERP_PROCESS.marks).sort()).toEqual(["counted", "typed"]);
  });

  it("counts its tallies, its intro and its foot from the steps, the lanes, the hand-offs and the kinds", () => {
    const typed = HANDOFFS.filter((h) => h.mark === "typed").length;
    const counted = HANDOFFS.filter((h) => h.mark === "counted").length;
    const teams = ERP_PROCESS.lanes.filter((l) => l.id !== "auto").length;
    const auto = steps.filter((s) => s.lane === "auto").length;
    expect(ERP_PROCESS.tally.today).toBe(`${cap(word(steps.length))} steps in ${word(steps.length)} places: typed again at ${word(typed)} hand-offs, counted by hand at ${word(counted)}.`);
    expect(ERP_PROCESS.tally.one).toBe(`${cap(word(steps.length))} steps, one record: ${word(teams)} teams, and ${word(auto)} steps that run by themselves.`);
    expect(ERP_PROCESS.intro.text).toContain(`the same customer in ${word(steps.length)} places`);
    const does = steps.filter((s) => s.kind === "does").length;
    const thin = steps.filter((s) => s.kind === "thin").length;
    expect(ERP_PROCESS.foot).toBe(`${cap(word(does + thin))} of the ${word(steps.length)} steps already run on this platform, ${word(does)} in full and ${word(thin)} in part; quotes, orders and stock are built for yours.`);
    expect(ERP_PROCESS.foot).toContain("quotes, orders and stock are built for yours");
    // Today's record lists both marks, so its foot speaks of both.
    expect(new Set(HANDOFFS.map((h) => h.mark))).toEqual(new Set(["typed", "counted"]));
    expect(ERP_PROCESS.record.todayFoot).toBe("In one system, nothing here is typed or counted twice.");
    // An eyebrow never repeats its own title's key (#core's and #shape's rule).
    const keyWords = new Set(ERP_PROCESS.key.toLowerCase().split(/\W+/));
    expect(ERP_PROCESS.eyebrow.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && keyWords.has(w))).toEqual([]);
    // The sub and the tag say it's a sample, and the credits say the rest: the foot doesn't say it again.
    expect(ERP_PROCESS.sub.startsWith("A sample business")).toBe(true);
    expect(ERP_PROCESS.foot).not.toMatch(/for this page|no business in particular|\bsample\b/i);
  });

  it("keeps the sample a sample: no digit, no brand, no business, no client", () => {
    const text = strings([steps.map((s) => [s.label, s.paper, s.today, s.system, s.history, s.status, s.screen, s.go]), HANDOFFS, ERP_PROCESS.record]);
    expect(text.length).toBeGreaterThan(80);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => VENDORS.test(s) || s.includes(COMPANY.name) || /\bclients?\b/i.test(s))).toEqual([]);
    expect(ERP_PROCESS.tag.startsWith("Sample")).toBe(true);
    expect(ERP_PROCESS.record.chrome).toMatch(/sample$/);
  });

  it("marks the sample's declarations SAMPLE in the data module", () => {
    for (const name of ["STEPS", "HANDOFFS"]) {
      expect(SOURCE, name).toMatch(new RegExp(`^(?:export )?const ${name}\\b[^\\n]*= [[{] // SAMPLE\\b`, "m"));
    }
  });

  describe(`its frame (process-frame.ts)${waiting(FRAME_FILE)}`, () => {
    type Frame = NonNullable<typeof frameKit>;
    type State = ReturnType<Frame["pickStep"]>;
    type Index = State["step"] & number;
    const INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
    /** Every state the stage can hold: both views, every step (and none), on its way or arrived. */
    const everyState = (): State[] =>
      (["today", "one"] as const).flatMap((view) =>
        [null, ...INDICES].flatMap((step) => [true, false].map((arrived) => ({ view, step, arrived }) as State)),
      );

    it.skipIf(!frameKit)("finishes where the data module opens: One system, step 08 arrived, every card passed and the last lit", () => {
      const { FINISHED, START, frameOf } = frameKit!;
      expect(FINISHED).toEqual({ view: ERP_PROCESS.initial.view, step: stepAt(ERP_PROCESS.initial.step), arrived: true });
      expect(START).toEqual({ view: "today", step: null, arrived: true });
      const f = frameOf(STEPS, FINISHED);
      expect(f.view).toBe("one");
      expect(f.caption).toBe(8);
      expect(f.sheets).toEqual([...Array(7).fill("visited"), "lit"]);
      expect(f.edges).toEqual(Array(7).fill("on"));
      expect(f.rows).toEqual([...Array(7).fill("reached"), "current"]);
      expect(STEPS[f.status].status).toBe("Paid");
      expect(STEPS[f.screen].screen.title).toBe("This month");
      expect(f.rail).toEqual({ checked: 7, filled: Array(8).fill(true) });
    });

    it.skipIf(!frameKit)("lights at most one sheet, draws no connector in Today, and keeps One system's record behind it", () => {
      const { frameOf } = frameKit!;
      for (const s of everyState()) {
        const f = frameOf(STEPS, s);
        const where = JSON.stringify(s);
        expect(f.sheets, where).toHaveLength(8);
        expect(f.edges, where).toHaveLength(7);
        expect(f.rows, where).toHaveLength(8);
        expect(f.sheets.filter((x) => x === "lit").length, where).toBeLessThanOrEqual(1);
        if (s.view !== "today") continue;
        expect(f.edges.every((e) => e === "rest"), where).toBe(true);
        expect(f.sheets, where).toEqual(INDICES.map((i) => (i === s.step ? "lit" : "rest")));
        expect(f.caption, where).toBe(s.step === null ? 0 : s.step + 1);
        // Behind the Today panel: One system at the same step, or step 01 on its way before a pick.
        const behind = frameOf(STEPS, s.step === null ? { view: "one", step: 0, arrived: false } : { ...s, view: "one" });
        expect({ rows: f.rows, status: f.status, screen: f.screen }, where).toEqual({ rows: behind.rows, status: behind.status, screen: behind.screen });
        expect(f.rail, where).toEqual(s.step === null ? { checked: null, filled: Array(8).fill(false) } : behind.rail);
      }
    });

    it.skipIf(!frameKit)("in One system, passes the cards and rows before the step, and changes the status as it arrives", () => {
      const { frameOf } = frameKit!;
      for (const k of INDICES) {
        for (const arrived of [false, true]) {
          const f = frameOf(STEPS, { view: "one", step: k, arrived });
          const where = `step ${k + 1}${arrived ? " arrived" : " on its way"}`;
          expect(f.sheets, where).toEqual(INDICES.map((i) => (i < k ? "visited" : i === k ? (arrived ? "lit" : "route") : "rest")));
          expect(f.edges, where).toEqual(INDICES.slice(0, 7).map((i) => (i < k - 1 ? "on" : i === k - 1 ? (arrived ? "on" : "route") : "rest")));
          expect(f.rows, where).toEqual(INDICES.map((i) => (i < k ? "reached" : i === k && arrived ? "current" : "tocome")));
          expect(f.status, where).toBe(arrived ? k : Math.max(0, k - 1));
          if (arrived) expect(f.screen, where).toBe(k);
          else expect([k, Math.max(0, k - 1)], where).toContain(f.screen);
          expect(f.rail, where).toEqual({ checked: k, filled: INDICES.map((i) => i <= k) });
        }
      }
    });

    it.skipIf(!frameKit)("arrives at once on a rail pick, and moves the order on from the hotspot, back to 01 from 08 with no hop", () => {
      const { nextStep, pickStep, pad2 } = frameKit!;
      for (const s of everyState()) {
        for (const k of INDICES) expect(pickStep(s, k), JSON.stringify(s)).toEqual({ ...s, step: k, arrived: true });
      }
      for (const k of INDICES) {
        const { next, hop } = nextStep({ view: "one", step: k, arrived: true });
        if (k === 7) {
          expect(next).toEqual({ view: "one", step: 0, arrived: true });
          expect(hop).toBeNull();
        } else {
          expect(next).toEqual({ view: "one", step: (k + 1) as Index, arrived: false });
          expect(hop).toBe(k + 1);
        }
      }
      expect(STEPS.map((_, i) => pad2(i + 1))).toEqual(STEPS.map((s) => s.n));
    });
  });

  const STAGE_FILE = `${DIR}/process-stage.tsx`;
  describe(`its stage (process-stage.tsx)${waiting(STAGE_FILE)}`, () => {
    it.skipIf(!has(STAGE_FILE))("paints the finished frame first, on the server and before any tour", () => {
      expect(code(STAGE_FILE)).toMatch(/\b(?:FINISHED|stateOf\()/);
    });

    it.skipIf(!has(STAGE_FILE))("lays the rail from lg on the drawing's columns: the labels' 11.2%, then eight of 11.1%", () => {
      // One radio group at every width, re-laid by its class (spec §4.2.3); the geometry holds the numbers.
      const rail = [STAGE_FILE, `${DIR}/erp-process.css`].filter(has).map(read).join("\n");
      expect(rail).toMatch(/11\.2%[_ ]repeat\(8,\s*11\.1%\)/);
    });
  });

  describe(`its drawing (process-geometry.ts)${waiting(GEOMETRY_FILE)}`, () => {
    const lanes = STEPS.map((s) => LANE_IDS.indexOf(s.lane as (typeof LANE_IDS)[number]));

    it.skipIf(!geometryKit)("lays four lanes and eight columns in a fixed box, the rail's grid on the same columns", () => {
      const g = geometryKit!;
      expect(g.LANES_BOX).toEqual({ w: 1000, h: 272 });
      expect(g.LANE_H * LANE_IDS.length).toBe(g.LANES_BOX.h);
      expect(g.X0).toBe(g.LABEL_W);
      expect(g.X0 + g.COL * STEPS.length).toBeLessThanOrEqual(g.LANES_BOX.w);
      // The rail over the drawing: its first cell the labels' column, then eight columns (spec §4.2.3).
      expect(((g.LABEL_W / g.LANES_BOX.w) * 100).toFixed(1)).toBe("11.2");
      expect(((g.COL / g.LANES_BOX.w) * 100).toFixed(1)).toBe("11.1");
      // A card at the 1024 frame (the drawing 880px wide) holds "Follow-up" on one line.
      expect((g.CARD.w * 880) / g.LANES_BOX.w).toBeGreaterThanOrEqual(84);
      expect(g.pct(250, 1000)).toBe("25%");
    });

    it.skipIf(!geometryKit)("centres each card on its column and its lane, inside the box", () => {
      const g = geometryKit!;
      STEPS.forEach((s, i) => {
        const r = rectOf(g.cardRect(i, lanes[i]));
        expect(r.x + r.w / 2, s.id).toBeCloseTo(g.X0 + g.COL * (i + 0.5), 6);
        expect(r.y + r.h / 2, s.id).toBeCloseTo(lanes[i] * g.LANE_H + g.LANE_H / 2, 6);
        expect([r.w, r.h], s.id).toEqual([g.CARD.w, g.CARD.h]);
        expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= g.LANES_BOX.w && r.y + r.h <= g.LANES_BOX.h, s.id).toBe(true);
      });
    });

    it.skipIf(!geometryKit)("joins each step to the next in the gutter between them, entering no card", () => {
      const g = geometryKit!;
      const cards = STEPS.map((_, i) => rectOf(g.cardRect(i, lanes[i])));
      for (let i = 0; i < STEPS.length - 1; i++) {
        const pts = pointsOfD(g.connector(i, lanes));
        const [a, b] = [cards[i], cards[i + 1]];
        const where = `${STEPS[i].id} → ${STEPS[i + 1].id}`;
        expect(pts[0][0], where).toBeCloseTo(a.x + a.w, 1);
        expect(pts[0][1], where).toBeCloseTo(a.y + a.h / 2, 1);
        expect(pts.at(-1)![0], where).toBeCloseTo(b.x, 1);
        expect(pts.at(-1)![1], where).toBeCloseTo(b.y + b.h / 2, 1);
        for (const [x] of pts) expect(x >= a.x + a.w - 0.01 && x <= b.x + 0.01, `${where}: x ${x}`).toBe(true);
        for (const [k, c] of cards.entries()) expect(pts.filter((p) => within(p, c)), `${where} enters card ${k + 1}`).toEqual([]);
      }
      // The dip to "By itself" at 03 and the climb back to Sales at 04 are drawn.
      const dip = pointsOfD(g.connector(stepAt("quote"), lanes)).map((p) => p[1]);
      expect(Math.max(...dip)).toBeCloseTo(cards[stepAt("followup")].y + g.CARD.h / 2, 1);
    });

    it.skipIf(!geometryKit)("scatters Today's papers inside the box, turned at most 3°, overlapping at most 6%", () => {
      const g = geometryKit!;
      const papers = STEPS.map((_, i) => turnedOf(g.paperRect(i)));
      papers.forEach((p, i) => {
        expect([p.w, p.h], STEPS[i].id).toEqual([g.PAPER.w, g.PAPER.h]);
        expect(Math.abs(p.turn), STEPS[i].id).toBeLessThanOrEqual(3);
        for (const [x, y] of corners(p)) expect(x >= 0 && y >= 0 && x <= g.LANES_BOX.w && y <= g.LANES_BOX.h, `${STEPS[i].id} corner ${x}, ${y}`).toBe(true);
      });
      for (let i = 0; i < papers.length; i++) {
        for (let j = i + 1; j < papers.length; j++) {
          const shared_ = overlapArea(corners(papers[i]), corners(papers[j]));
          expect(shared_ / (g.PAPER.w * g.PAPER.h), `${STEPS[i].id} over ${STEPS[j].id}`).toBeLessThanOrEqual(0.06);
        }
      }
    });

    it.skipIf(!geometryKit)("curves each hand-off from paper to paper, over no third paper", () => {
      const g = geometryKit!;
      const papers = STEPS.map((_, i) => turnedOf(g.paperRect(i)));
      for (const h of HANDOFFS) {
        const [from, to] = [stepAt(h.from), stepAt(h.to)];
        const { d, mid } = g.handoff(from, to);
        const pts = pointsOfD(d);
        const where = `${h.from} → ${h.to}`;
        const centre = (p: Turned): Pt => [p.x + p.w / 2, p.y + p.h / 2];
        expect(Math.hypot(pts[0][0] - centre(papers[from])[0], pts[0][1] - centre(papers[from])[1]), where).toBeLessThanOrEqual(1);
        expect(Math.hypot(pts.at(-1)![0] - centre(papers[to])[0], pts.at(-1)![1] - centre(papers[to])[1]), where).toBeLessThanOrEqual(1);
        papers.forEach((p, k) => {
          if (k === from || k === to) return;
          expect(pts.filter((pt) => withinTurned(pt, p)).length, `${where} crosses ${STEPS[k].id}`).toBe(0);
        });
        // The mark sits on the curve.
        const m = ptOf(mid);
        expect(Math.min(...pts.map((p) => Math.hypot(p[0] - m[0], p[1] - m[1]))), where).toBeLessThanOrEqual(1);
      }
    });

    it.skipIf(!geometryKit)("lists and piles the same eight sheets in 512px below lg", () => {
      const g = geometryKit!;
      expect(g.LIST.rows * g.LIST.row).toBe(g.LIST.h);
      expect(g.PILE.rows * g.PILE.cell).toBe(g.LIST.h);
      expect(g.LIST.h).toBe(512);
      expect(g.PILE.cols * g.PILE.rows).toBe(STEPS.length);
      STEPS.forEach((s, i) => {
        expect(rectOf(g.listRow(i)).y, s.id).toBe(i * g.LIST.row);
        const p = turnedOf(g.pileRect(i));
        expect(Math.abs(p.turn), s.id).toBe(g.PILE.turn);
        expect(Math.floor(p.y / g.PILE.cell), s.id).toBe(Math.floor(i / g.PILE.cols));
      });
    });
  });
});

describe("#core", () => {
  const parts = CORE_PARTS;

  it("lists nine parts in the stack's order, each within its caps", () => {
    expect(parts.map((p) => p.id)).toEqual(CORE_IDS);
    parts.slice(1).forEach((p, k) => expect(p.layer, p.id).toBeGreaterThanOrEqual(parts[k].layer));
    expect(new Set(parts.map((p) => p.layer))).toEqual(new Set([0, 1, 2, 3]));
    for (const p of parts) {
      expect(p.title.length, p.id).toBeLessThanOrEqual(40);
      expect(p.datum.length, p.id).toBeLessThanOrEqual(16);
      expect(p.ours.length, p.id).toBeLessThanOrEqual(330);
      expect(p.yours.length, p.id).toBeLessThanOrEqual(140);
      expect(Object.keys(CHECK_KINDS), p.id).toContain(p.check.kind);
      if (p.check.kind === "site") expect(p.check.href, p.id).toBeTruthy();
      expectOwner(`"${p.yours}"`);
    }
  });

  it("interpolates every figure in a datum, never typing one", () => {
    const datums = LINES.flatMap((l) => [...l.matchAll(/\bdatum: ("[^"]*"|`[^`]*`)/g)].map((m) => m[1]));
    expect(datums.length).toBeGreaterThanOrEqual(parts.length + ERP_CORE.under.length);
    for (const d of datums) expect(d.replace(/\$\{[^}]*\}/g, ""), d).not.toMatch(/\d/);
  });

  it("runs seven, and part of one more; the one it lacks is said once, where it is", () => {
    const kinds = (k: Kind) => parts.filter((p) => p.kind === k);
    expect(kinds("does")).toHaveLength(7);
    expect(kinds("thin").map((p) => p.id)).toEqual(["history"]);
    expect(kinds("none").map((p) => p.id)).toEqual(["yours"]);
    // "Partly", the tag's own word ("Partly here"): the SaaS page's "Thin" is never this page's.
    expect(coreOf("history").ours.startsWith("Partly on ours:")).toBe(true);
    expect(coreOf("yours").ours.startsWith("Not on ours:")).toBe(true);
    for (const p of kinds("does")) expect(p.ours, p.id).not.toMatch(/^(?:Partly|Thin|Not) on ours/);
    expect(ALL.filter((s) => /\bThin\b/.test(s))).toEqual([]);
    expect(coreOf("yours").check.kind).toBe("handover");
    expect(ALL.filter((s) => s.includes("Not on ours"))).toEqual([coreOf("yours").ours]);
    expect(ERP_CORE.sub).toContain(`runs ${word(kinds("does").length)} of these ${word(parts.length)} parts, and part of ${word(kinds("thin").length)} more`);
    expect(`${word(kinds("does").length)} of these ${word(parts.length)}`).toBe("seven of these nine");
    expect(ERP_CORE.kinds).toEqual(ERP_PROCESS.kinds);
  });

  it("puts four cells under every record, each within its cap", () => {
    expect(ERP_CORE.under.map((u) => u.id)).toEqual(["walls", "kept", "schema", "jobs"]);
    for (const u of ERP_CORE.under) expect(u.text.length, u.id).toBeLessThanOrEqual(130);
  });

  it("gives every #core-<id> the page links to a card", () => {
    const linked = [...STEPS.map((s) => `core-${s.core}`), ...hrefs(PAGE).filter((h) => h.startsWith("#core-")).map((h) => h.slice(1))];
    expect(linked).toContain("core-yours");
    for (const id of linked) expect(CORE_IDS.map((c) => `core-${c}`), id).toContain(id);
  });

  describe(`its markup${waiting(`${DIR}/core.tsx`)}`, () => {
    it.skipIf(!has(`${DIR}/core.tsx`))("anchors each card at #core-<id>", () => {
      const src = read(`${DIR}/core.tsx`);
      expect(src).toContain('id="core"');
      expect(src).toMatch(/id=\{`core-\$\{[^}]+\}`\}/);
    });
  });
});

describe("#shape", () => {
  it("has one sample for each of six kinds of business, in the chips' order", () => {
    expect(ERP_SHAPE.businesses.map((b) => b.id)).toEqual(BIZ_IDS);
    expect(SAMPLES.map((s) => s.id)).toEqual(BIZ_IDS);
    expect(ERP_SHAPE.initial).toEqual({ biz: "wholesale", scope: "ops" });
  });

  it("gives every sample the fixed shape the card draws, within its caps", () => {
    for (const s of SAMPLES) {
      expect(s.parts, s.id).toHaveLength(11);
      expect(s.parts.map((p) => p.level), s.id).toEqual([...Array(4).fill("sales"), ...Array(4).fill("ops"), ...Array(3).fill("all")]);
      expect(new Set(s.parts.map((p) => p.label)).size, s.id).toBe(11);
      for (const p of s.parts) {
        expect(p.label.length, `${s.id}: ${p.label}`).toBeLessThanOrEqual(24);
        expect(p.why.length, `${s.id}: ${p.why}`).toBeLessThanOrEqual(60);
        if (p.core) expect(SHAPE_CORES as readonly string[], `${s.id}: ${p.label}`).toContain(p.core);
      }
      expect(s.title.length, s.id).toBeLessThanOrEqual(48);
      expect(s.who.length, s.id).toBeLessThanOrEqual(64);
      expect(s.pipeline.name.length, s.id).toBeLessThanOrEqual(44);
      expect(s.pipeline.stages, s.id).toHaveLength(6);
      for (const st of s.pipeline.stages) expect(st.length, `${s.id}: ${st}`).toBeLessThanOrEqual(14);
      expect(s.reports, s.id).toHaveLength(3);
      for (const r of s.reports) expect(r.length, `${s.id}: ${r}`).toBeLessThanOrEqual(48);
      expect(s.ai.length, s.id).toBeLessThanOrEqual(80);
      expect(s.hard.length, s.id).toBeLessThanOrEqual(120);
    }
  });

  it("tags a part with its #core card's kind, read, never typed", () => {
    expect(ERP_SHAPE.coreKinds).toEqual(Object.fromEntries(SHAPE_CORES.map((c) => [c, coreOf(c).kind])));
    expect(ERP_SHAPE.kinds).toEqual({ does: ERP_CORE.kinds.does, thin: ERP_CORE.kinds.thin });
    // A part's own kind can only lower its card's tag, never raise it; a "Runs here"
    // part's line never promises what its card doesn't run (online, desk, crew, email…).
    for (const s of ERP_SHAPE.samples) for (const p of s.parts) { if (p.kind) { expect(p.core, p.label).toBeDefined(); expect(p.kind).toBe("thin"); } const k = p.kind ?? (p.core && ERP_SHAPE.coreKinds[p.core]); if (k === "does") { expect(p.why, p.label).not.toMatch(OVERREACH[p.core!]); } }
    // The same rule over #process's "In one system" lines, so the two sections can't drift apart again.
    for (const st of STEPS) if (st.kind === "does" && st.core in OVERREACH) expect(st.system, st.id).not.toMatch(OVERREACH[st.core as ShapeCore]);
  });

  it("tags each part of the sample it opens on as #process tags the same step", () => {
    // ERP_SHAPE.initial is the business #process draws: the same part never gets two tags one section apart.
    const opens = SAMPLES.find((s) => s.id === ERP_SHAPE.initial.biz)!;
    const PART_OF: Partial<Record<StepId, string>> = {
      enquiry: "Customers and contacts", quote: "Quotes", followup: "Follow-ups", order: "Orders", stock: "Stock", delivery: "Deliveries", invoice: "Invoices",
    };
    const tagged = Object.entries(PART_OF).map(([id, label]) => {
      const p = opens.parts.find((x) => x.label === label);
      expect(p, label).toBeDefined();
      const shape: Kind = p!.kind ?? (p!.core ? ERP_SHAPE.coreKinds[p!.core] : "none");
      return [id, shape];
    });
    expect(tagged).toEqual(Object.keys(PART_OF).map((id) => [id, STEPS[stepAt(id as StepId)].kind]));
    // Every step but the report has its part there.
    expect(STEP_IDS.filter((id) => !(id in PART_OF))).toEqual(["report"]);
  });

  it("counts four, eight and eleven parts into the build as the scope grows", () => {
    expect(ERP_SHAPE.scopes.map((s) => s.id)).toEqual(SCOPE_IDS);
    for (const s of ERP_SHAPE.scopes) expect(s.label.length, s.id).toBeLessThanOrEqual(10);
    expect(new Set(ERP_SHAPE.scopes.map((s) => s.hint)).size).toBe(3);
    const level = (id: ScopeId) => SCOPE_IDS.indexOf(id);
    for (const s of SAMPLES) {
      expect(SCOPE_IDS.map((scope) => s.parts.filter((p) => level(p.level) <= level(scope)).length), s.id).toEqual([4, 8, 11]);
    }
    expect(Object.keys(ERP_SHAPE.levels)).toEqual(SCOPE_IDS);
  });

  it("keeps the samples samples: no digit, no brand, no business, no client", () => {
    const text = strings(SAMPLES);
    expect(text.length).toBeGreaterThan(150);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => VENDORS.test(s) || s.includes(COMPANY.name) || /\bclients?\b/i.test(s))).toEqual([]);
    expect(SOURCE).toMatch(/^export const SAMPLES: readonly ShapeSample\[\] = \[ \/\/ SAMPLE/m);
    expect(ERP_SHAPE.foot).toContain("written for this page");
    // The tag wraps only after a no-break space's dot.
    expect(ERP_SHAPE.tag).toBe("Sample · {business} · {scope}");
  });

  describe(`its markup${waiting(`${DIR}/shape-instrument.tsx`, `${DIR}/ledger.tsx`)}`, () => {
    it.skipIf(!has(`${DIR}/shape-instrument.tsx`))("starts a view transition only in the \"proto\" scope, and only on a business pick", () => {
      const calls = scripts().flatMap((f) => [...code(f).matchAll(/\bwithViewTransition\(\s*([^,)]+)/g)].map((m) => `${path.basename(f)}: ${m[1].trim()}`));
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(c).toBe('shape-instrument.tsx: "proto"');
    });

    it.skipIf(!has(`${DIR}/shape-instrument.tsx`))("puts saas-proto-screen on #shape's card and nowhere else", () => {
      // One element wears it, so the transition's name is unique on the page and never aborts one.
      const uses = scripts().flatMap((f) => (code(f).match(/\bsaas-proto-screen\b/g) ?? []).map(() => path.basename(f)));
      expect(uses).toHaveLength(1);
      expect(["shape-instrument.tsx", "shape-card.tsx"]).toContain(uses[0]);
      for (const f of ORDER.filter((s) => has(`${DIR}/${s}`))) expect(read(`${DIR}/${f}`), f).not.toMatch(/\.saas-proto-screen\b/);
    });

    it.skipIf(!has(`${DIR}/ledger.tsx`))("anchors the comparison at #ledger", () => {
      expect(read(`${DIR}/ledger.tsx`)).toContain('id="ledger"');
    });
  });
});

describe("fairness: off the shelf, or built for you", () => {
  const ledger = ERP_SHAPE.ledger;
  const ROWS = ["what", "suits", "gives", "watch", "whose"] as const;
  const route = (id: RouteId) => ROUTES.find((r) => r.id === id)!;
  const offshelf = ERP_FAQ.items.find((i) => i.id === "offshelf")!.a;
  const creditLine = ERP_CREDITS.items.find((i) => i.term === "Off the shelf, or built for you")!.detail;

  it("compares three kinds of product, never a product, each row filled and within its cap", () => {
    expect(ROUTES.map((r) => r.id)).toEqual(ROUTE_IDS);
    expect(Object.keys(ledger.rows)).toEqual(ROWS);
    for (const r of ROUTES) {
      for (const row of ROWS) {
        expect(r[row].length, `${r.id}: ${row}`).toBeGreaterThan(0);
        expect(r[row].length, `${r.id}: ${row}`).toBeLessThanOrEqual(150);
      }
    }
  });

  it("names the built route's own costs, and what off the shelf is good at", () => {
    const built = route("built").watch;
    for (const cost of [/longer/, /pay for the build/, /looking after/]) expect(built).toMatch(cost);
    expect(route("shelf").gives).toMatch(/proven/);
    // The page argues against itself where it should.
    expect(offshelf.startsWith("Often you should buy one")).toBe(true);
    expect(ERP_TERMS.columns.find((c) => c.id === "upfront")!.items).toContain("Sometimes an off-the-shelf product is the better answer; if it is, we’ll say so on the call.");
    expect(ledger.foot.startsWith("Often the answer is a mix")).toBe(true);
  });

  it("names no product anywhere on the page, credits included", () => {
    expect(ALL.filter((s) => VENDORS.test(s))).toEqual([]);
  });

  it("uses no loaded word in the ledger, the FAQ's answer or the credits' line", () => {
    const three = [...strings(ledger), offshelf, creditLine];
    expect(three.filter((s) => LOADED.test(s))).toEqual([]);
    expect(strings(ledger).filter((s) => /\d|%|[$€£]/.test(s))).toEqual([]);
  });

  it("marks every line of the ledger OWNER", () => {
    for (const s of [ledger.title, ledger.lead, ledger.foot, ...ROUTES.flatMap((r) => [r.label, ...ROWS.map((row) => r[row])])]) {
      const at = linesOf(`"${s}"`);
      expect(at, s).toHaveLength(1);
      expect(at[0], s).toContain("// OWNER");
    }
  });

  it("says once in the ledger what we'll say on the call, and answers “Can you work with it?” with its yes", () => {
    expect(strings(ledger).filter((s) => /\bon the call\b/i.test(s))).toEqual([ledger.foot]);
    expect(plain(ledger.lead)).toBe("A comparison of kinds, not of products. Plenty of businesses are well served by an off-the-shelf CRM.");
    // Held whole, so the lead never ends on "shelf CRM." alone.
    expect(ledger.lead).toContain("off-⁠the-⁠shelf");
    const existing = ERP_FAQ.items.find((i) => i.id === "existing")!;
    expect(existing.q).toMatch(/\?$/);
    expect(existing.a.startsWith("Yes. ")).toBe(true);
    // The credits never send the reader to other vendors.
    expect(creditLine).not.toMatch(/\bmakers?\b/);
  });

  it("says in the credits that it names none, and that products go further than a summary can say", () => {
    expect(creditLine).toContain("names none");
    expect(creditLine).toContain("can be set up or extended further than a summary can say");
    const fair = ERP_CHECKS.rows.find((r) => r.id === "fair")!;
    expect(fair.link).toEqual({ label: "The comparison", href: "#ledger" });
    expect(fair.how).toContain(`‘${ledger.title}’`);
  });
});

describe("#move", () => {
  const rehearsal = ERP_MOVE.rehearsal;
  const stages = ERP_MOVE.stages;

  it("walks three stages, the last two the menu's deliverables, checked on the site, on the call and on the site", () => {
    expect(stages.map((s) => s.id)).toEqual(["map", "build", "switch"]);
    expect(stages[1].title).toBe(ITEM.deliverables[0]);
    expect(stages[2].title).toBe(ITEM.deliverables[1]);
    expect(stages.map((s) => s.ours !== undefined)).toEqual([false, true, true]);
    expect(stages.map((s) => s.check.kind)).toEqual(["site", "call", "site"]);
    expect(stages[0].check.href).toBe("#process");
    const del = stages[2].check;
    expect(del.href).toBe(PRICING_TRIAL.href);
    expect(del.how).toContain("‘Show test calls’");
    expect(del.how).toContain("‘Delete this call’");
    for (const s of stages) {
      expectOwner(`"${s.body}"`);
      expectOwner(`"${s.hold}"`);
    }
    expectOwner('"Ask us to open the migrations"');
  });

  it("rehearses six rows into five customers: moved, merged with its twin, or asked about", () => {
    expect(rehearsal.rows.map((r) => r.id)).toEqual(ROW_IDS);
    const merged = rehearsal.rows.filter((r) => r.outcome === "merged");
    expect(merged).toHaveLength(2);
    for (const r of merged) expect(rehearsal.rows.find((t) => t.id === r.with)!.with, r.id).toBe(r.id);
    for (const r of rehearsal.rows) if (r.outcome !== "merged") expect(r.with, r.id).toBeUndefined();
    const records_ = rehearsal.rows.length - merged.length / 2;
    expect(records_).toBe(5);
    expect(rehearsal.tally).toBe(`${cap(word(rehearsal.rows.length))} rows, ${word(records_)} customers: every row moved, merged with its twin, or asked about.`);
    // The index says the same, row by row.
    rehearsal.rows.forEach((r, k) => {
      const line = rehearsal.index[r.id];
      expect(line.startsWith(`Row ${word(k + 1)}: `), r.id).toBe(true);
      expect(line, r.id).toContain(r.outcome === "asked" ? "asked about" : r.outcome === "merged" ? "merged" : "moved");
      if (r.with) expect(line, r.id).toContain(`row ${word(ROW_IDS.indexOf(r.with) + 1)}`);
    });
    expect(Object.keys(rehearsal.outcomes)).toEqual(["moved", "merged", "asked"]);
    expect(rehearsal.loop.nodes).toEqual(["Copy", "Import", "Check", "Fix"]);
  });

  it("keeps the rehearsal a sample: no digit, no brand", () => {
    const text = strings({ ...rehearsal, rows: [] });
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(SOURCE).toMatch(/^const REHEARSAL_ROWS: readonly RehearsalRow\[\] = \[ \/\/ SAMPLE/m);
    expect(rehearsal.tag.startsWith("Sample")).toBe(true);
  });

  it("says what stays connected, the Google connections in beta while the dashboard badges them", () => {
    const stays = ERP_MOVE.stays;
    expect(stays.here.items).toHaveLength(4);
    if (INT_GOOGLE.badge === "Beta") expect(stays.beta).toMatch(/\bin beta\b/);
    else expect(ALL.filter((s) => /\bin beta\b/.test(s))).toEqual([]);
    for (const s of stays.yours.items) expectOwner(`"${s}"`);
    expect(stays.yours.items.filter((s) => /phone agent/.test(s))).toEqual(["A phone agent, ours or another: its calls on each customer’s record"]);
  });

  it("says whose each thing is, every row OWNER", () => {
    const own = ERP_MOVE.own;
    expect(own.rows.map((r) => r.id)).toEqual(["data", "code", "accounts", "old"]);
    for (const r of own.rows) {
      expect(Object.keys(own.states), r.id).toContain(r.whose);
      expectOwner(`how: "${r.how}"`);
    }
  });

  describe(`its markup${waiting(`${DIR}/move.tsx`)}`, () => {
    it.skipIf(!has(`${DIR}/move.tsx`))("anchors the rehearsal, the connect lists and the table the FAQ points to", () => {
      const src = ["move.tsx", "rehearsal-figure.tsx"].filter((f) => has(`${DIR}/${f}`)).map((f) => read(`${DIR}/${f}`)).join("\n");
      for (const id of ["move", "rehearsal", "connect", "whose"]) expect(src, id).toContain(`id="${id}"`);
    });

    it.skipIf(!has(`${DIR}/move.tsx`))("stops at the SaaS stations, where saas-build.css's keyframes stop, as Automations' #build does", () => {
      const stations = (file: string) => read(file).match(/const STATIONS = \[([^\]]+)\]/)?.[1].split(",").map(Number) ?? [];
      const ours = stations(`${DIR}/move.tsx`);
      expect(ours).toHaveLength(3);
      expect(ours).toEqual(stations(`${AUTO_DIR}/build.tsx`));
      const css = read(`${SAAS_DIR}/saas-build.css`);
      ours.forEach((at, i) => {
        const body = css.match(new RegExp(String.raw`@keyframes saas-station-${i} \{([\s\S]*?)\n\}`))?.[1] ?? "";
        const stops = [...body.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
        expect(stops, `saas-station-${i}`).toEqual([0, at * 100, (at + 1 / 12) * 100, 100].map((n) => expect.closeTo(n, 2)));
      });
    });
  });

  describe(`its figure (rehearsal-geometry.ts)${waiting(REHEARSAL_FILE)}`, () => {
    it.skipIf(!rehearsalKit)("rests six rows' copies in five cards, the twins in one", () => {
      const { CARD_OF } = rehearsalKit!;
      expect(Object.keys(CARD_OF)).toEqual(ROW_IDS);
      const cards = ROW_IDS.map((id) => CARD_OF[id]);
      expect(new Set(cards).size).toBe(5);
      for (const r of rehearsal.rows) if (r.with) expect(CARD_OF[r.id], r.id).toBe(CARD_OF[r.with]);
      // Every other row has a card of its own.
      const alone = rehearsal.rows.filter((r) => !r.with).map((r) => CARD_OF[r.id]);
      expect(new Set(alone).size).toBe(alone.length);
    });

    // The build spec names CARD_OF alone (§4.4.2); the boxes, rows, cards and offsets are the ones
    // rehearsal-geometry.ts names, in both compositions (from md 960 × 400, below md 360 × 720).
    const FIGS = ["wide", "narrow"] as const;

    it.skipIf(!rehearsalKit)("rests each row's copy inside its card, in both compositions", () => {
      const { ROWS, barsOf, cardRect, copyRest } = rehearsalKit!;
      for (const fig of FIGS) {
        for (const id of ROWS) {
          const card = cardRect(fig, rehearsalKit!.CARD_OF[id]);
          const [x, y] = copyRest(fig, id);
          for (const b of barsOf(fig, id)) {
            const bar = { x: x + b.x, y: y + b.y, w: b.w, h: b.h };
            expect(bar.x >= card.x && bar.y >= card.y && bar.x + bar.w <= card.x + card.w && bar.y + bar.h <= card.y + card.h, `${fig} ${id}`).toBe(true);
          }
        }
      }
    });

    it.skipIf(!rehearsalKit)("returns each copy exactly to its row by its offset (--dx, --dy)", () => {
      const { ROWS, copyOffset, copyRest, rowOrigin } = rehearsalKit!;
      for (const fig of FIGS) {
        for (const id of ROWS) {
          const [x, y] = copyRest(fig, id);
          const { dx, dy } = copyOffset(fig, id);
          expect([x + dx, y + dy], `${fig} ${id}`).toEqual([...rowOrigin(fig, id)]);
        }
      }
    });

    it.skipIf(!rehearsalKit)("keeps both compositions, sheet, tags, cards and leaders, inside their boxes", () => {
      const { LAYOUTS, RECORDS, ROWS, cardRect, leader, tagAt } = rehearsalKit!;
      expect(LAYOUTS.wide.view).toEqual({ w: 960, h: 400 });
      expect(LAYOUTS.narrow.view).toEqual({ w: 360, h: 720 });
      for (const fig of FIGS) {
        const { w, h } = LAYOUTS[fig].view;
        const inBox = (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h;
        const { sheet } = LAYOUTS[fig];
        expect(inBox(sheet.x, sheet.y) && inBox(sheet.x + sheet.w, sheet.y + sheet.h), `${fig} sheet`).toBe(true);
        for (let i = 0; i < RECORDS; i++) {
          const c = cardRect(fig, i);
          expect(inBox(c.x, c.y) && inBox(c.x + c.w, c.y + c.h), `${fig} card ${i}`).toBe(true);
        }
        for (const id of ROWS) {
          expect(inBox(...tagAt(fig, id)), `${fig} ${id} tag`).toBe(true);
          for (const pt of pointsOfD(leader(fig, id))) expect(inBox(...pt), `${fig} ${id} leader at ${pt}`).toBe(true);
        }
      }
    });
  });
});

describe("honesty", () => {
  it("prints no price, duration, standard or scale claim, and no date", () => {
    const banned =
      /[$€£]\s?\d|\b\d+\s*(?:days?|weeks?|months?|years?)\b|\bSOC ?2\b|\bISO ?27001\b|\bHIPAA\b|\bcertified\b|\bin production\b|at scale/i;
    expect(ALL.filter((s) => banned.test(s))).toEqual([]);
    // The chart's views pass as words.
    expect(coreOf("reports").ours).toContain("seven, thirty or ninety days");
    const month = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    expect(ALL.filter((s) => /\b(?:19|20)\d{2}\b/.test(s) || month.test(s))).toEqual([]);
  });

  it("prints no percentage, and a plus only on the accreditations' floor", () => {
    expect(ALL.filter((s) => /%/.test(s))).toEqual([]);
    const plus = ALL.flatMap((s) => s.match(/\d+\+/g) ?? []);
    expect(plus).toContain(ACC);
    expect([...new Set(plus)]).toEqual([ACC]);
  });

  it("uses a certification word only to say there is none, and says it once", () => {
    const risky = /certif|badge|\bseal\b|endorse|\bpartner|\bofficial\b|testimonial|\bclients?\b|trusted by/i;
    const negated = /\b(?:no|not|none|never)\b|n’t\b/i;
    // A file path is the code's word, not the page's.
    const claims = ALL.filter((s) => !FAQ_QS.has(s) && !IS_PATH.test(s))
      .flatMap(split)
      .filter((s) => risky.test(s));
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.filter((s) => !negated.test(s))).toEqual([]);
    expect(ALL.filter((s) => /certification/i.test(s))).toEqual([ERP_TEAM.accreditations.isnt]);
  });

  it("names only the grantors in a sentence about grants, and Anthropic only beside Claude or the accreditations", () => {
    const COMPANIES = ["Anthropic", "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Twilio", "Slack", "Google", "QuickBooks", "Xero", "Shopify", "WooCommerce"];
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

  it("names both credentials up front, says once they're personal, and counts the accreditations as the owner states them", () => {
    for (const text of [ERP_HERO.sub, ERP_META.description]) {
      expect(text).toContain(`${ACC} `);
      expect(text).toContain(ACCREDITATIONS.issuer);
      for (const g of GRANTORS) expect(text).toContain(g);
    }
    expect(ACCREDITATIONS.holders).toBe("personal");
    const counted = ALL.filter((s) => /accreditation/i.test(s) && /\d/.test(s));
    expect(counted.length).toBeGreaterThan(0);
    for (const s of counted) expect(s).toContain(ACC);
  });

  it("claims no work of ours for anyone: no past build, no client, no case study", () => {
    const invented =
      /\bwe(?:’ve| have)? (?:built|delivered|migrated|implemented|shipped) (?:a|an|the|their|for)\b|\bour clients?\b|\bcase stud|\bcustomers of ours\b|\btrack record\b|\bmigrated (?:their|a customer’s)\b/i;
    const isnt = ERP_CREDITS.items.find((i) => i.term === "What isn’t here")!.detail;
    expect(ALL.filter((s) => s !== isnt && invented.test(s))).toEqual([]);
    expect(isnt.startsWith("No client names")).toBe(true);
    // The platform itself "started empty": nothing was ever migrated onto it.
    expect([...new Set(ALL.filter((s) => /\bmigrated\b/i.test(s)))]).toEqual([ITEM.deliverables[1]]);
  });

  it("never promises an invoice once, however often, or a call never cut off", () => {
    expect(ALL.filter((s) => /at most once|invoiced once|however often|issued again|re-?issued|never cuts? a call/i.test(s))).toEqual([]);
  });

  it("never calls this platform anyone's CRM", () => {
    expect(ALL.filter((s) => /\b(?:this|our) (?:platform|product) is a CRM\b/i.test(s))).toEqual([]);
  });

  it("says “in beta” wherever it names a Google workflow step, or says it next in the same block", () => {
    const found = inRecords([ERP_META, ...Object.values(SECTIONS)]).filter(({ s }) => GOOGLE_STEP.test(s));
    expect(found.length).toBeGreaterThanOrEqual(2);
    for (const { s } of found) {
      for (const sentence of split(s).filter((x) => GOOGLE_STEP.test(x))) {
        if (/\bin beta\b/.test(sentence)) continue;
        // The one list item: its block's next line is the beta line (ERP_MOVE.stays).
        expect(ERP_MOVE.stays.here.items, sentence).toContain(s);
        expect(ERP_MOVE.stays.beta).toMatch(/\bGoogle connections are in beta\b/);
      }
    }
  });

  it("keeps every owner-stated line marked in the data module", () => {
    // The build spec's sign-off list (§9.1, §7.1), each at its words.
    const faq = (id: string) => ERP_FAQ.items.find((i) => i.id === id)!.a.slice(0, 40);
    const check = (id: string) => ERP_CHECKS.rows.find((r) => r.id === id)!;
    for (const words of [
      "Any CRM or ERP, shaped around how you work.",
      "For any business, of any size and however complex",
      "CRMs and ERPs of any kind, shaped around your process.",
      "Off your spreadsheets and old tools, without losing a thing",
      "Every source is listed and mapped before anything moves.",
      ERP_TEAM.sub,
      ERP_TEAM.accreditations.body,
      "The code and the database, with tests and a guide to running them",
      "Old data can’t be better than it was kept",
      "Hosting and the services it runs on bill for what they supply",
      "the same team builds those too",
      ...["breadth", "fit", "offshelf", "complex", "move", "connect", "own", "users", "existing"].map((id) => (id === "breadth" ? "No. We build whatever system your business runs on" : faq(id))),
      check("rehearsal").claim,
      check("code").claim,
      check("code").how,
      check("walls").how,
      ERP_CHECKS.missing.body,
      "shown because it’s ours to open up, not because voice is all we build",
      "Both are shown on the call, on request.",
      "Ask to see a freed time offered",
      "Ask to see the inbox and its texts",
      "Ask to open the usage ledger",
    ]) {
      expectOwner(words);
      expect(ALL.some((s) => s.includes(plain(words))), words).toBe(true);
    }
    // The meta title, the accreditations' and grants' rows: templates, found by their lines.
    for (const line of [/^\s*title: `\$\{ITEM\.label\}, for any business`/, /^\s*\{ id: "accreditations", kind:/, /^\s*\{ id: "grants", kind:/]) {
      expect(LINES.find((l) => line.test(l)), String(line)).toContain("// OWNER");
    }
  });

  it("marks OWNER every line that names a tool the reader's system would connect to", () => {
    const TOOLS = ["QuickBooks", "Xero", "Shopify", "WooCommerce", "SmartBill"];
    const naming = ERP_MOVE.stays.yours.items.filter((s) => TOOLS.some((t) => named(t, s)));
    expect(naming.length).toBeGreaterThanOrEqual(2);
    for (const s of naming) expectOwner(`"${s}"`);
    // Outside "Yours connects to", SmartBill is this platform's own, and QuickBooks, Xero, Shopify and WooCommerce appear nowhere.
    const elsewhere = OUTSIDE_CREDITS.filter((s) => !ERP_MOVE.stays.yours.items.includes(s));
    for (const t of TOOLS.filter((t) => t !== "SmartBill")) expect(elsewhere.filter((s) => named(t, s)), t).toEqual([]);
  });
});

/** Every anchor this page renders: its sections, the blocks the FAQ and checks point into, and #core's cards. */
const ANCHORS: string[] = [...SECTION_IDS, "rehearsal", "connect", "whose", "ledger", ...CORE_IDS.map((c) => `core-${c}`)];

describe("links go somewhere", () => {
  const routes = walk("app")
    .filter((f) => /(?:^|\/)page\.tsx$/.test(f))
    .map((f) => {
      const segments = f.split("/").slice(1, -1).filter((s) => !/^\(.*\)$/.test(s));
      return new RegExp(`^/${segments.map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s)).join("/")}$`);
    });
  const links = hrefs(PAGE);

  it("finds more than twenty-five links to follow", () => {
    expect(links.length).toBeGreaterThan(25);
  });

  it.each(links.map((h) => [h]))("%s resolves", (href) => {
    if (href.startsWith("tel:")) expect(href).toBe(COMPANY.phoneHref);
    else if (href.startsWith("#")) expect(ANCHORS).toContain(href.slice(1));
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
    const rows = ERP_CHECKS.rows;

    it("lists each claim once, six now, four on the call and three in your build", () => {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
      expect(rows).toHaveLength(13);
      const count = (k: string) => rows.filter((r) => r.kind === k).length;
      expect([count("site"), count("call"), count("handover")]).toEqual([6, 4, 3]);
      // In the filters' order, so the list reads as the filters do.
      const order = Object.keys(CHECK_KINDS);
      rows.slice(1).forEach((r, k) => expect(order.indexOf(r.kind), r.id).toBeGreaterThanOrEqual(order.indexOf(rows[k].kind)));
    });

    it("gives each kind one name, the filter's and the tag's alike, and says the sub in the filters' order", () => {
      expect(ERP_CHECKS.filters.map((f) => f.id)).toEqual(["all", ...Object.keys(CHECK_KINDS)]);
      for (const f of ERP_CHECKS.filters) if (f.id !== "all") expect(f.label, f.id).toBe(CHECK_KINDS[f.id]);
      const said_ = ERP_CHECKS.sub.split(/(?<=\.)\s+/);
      const kinds = Object.values(CHECK_KINDS);
      expect(said_).toHaveLength(kinds.length);
      // "Now, in this browser" is said as "now, in this browser"; the others by their last words.
      kinds.forEach((k, i) => expect(said_[i].toLowerCase(), k).toContain(k.toLowerCase().replace(/^now, /, "")));
    });

    it("says where to look for every claim you can check now, and says the export's way once", () => {
      for (const r of rows.filter((x) => x.kind === "site")) {
        expect(r.link !== undefined || /\btrial\b|foot of this page/.test(r.how), r.id).toBe(true);
      }
      expect(rows.find((r) => r.id === "fair")!.link!.href).toBe("#ledger");
      const how = "Turn on ‘Show test calls’ under Calls, then Export: ‘Calls in the current view’. ‘Every call’ leaves test calls out.";
      expect(rows.find((r) => r.id === "export")!.how).toBe(`On the trial: ${lowerFirst(how)}`);
      expect(coreOf("exports").check.how).toBe(how);
      expect(rows.find((r) => r.id === "history")!.how).toContain("turn on ‘Show test calls’ under Calls");
      expect(rows.find((r) => r.id === "delete")!.how).toContain("‘Delete this call’");
      expect(coreOf("history").check.how).toContain("Turn on ‘Show test calls’ under Calls");
    });

    it("never repeats a check's tag in its words, anywhere on the page", () => {
      // A check line prints its kind as a tag, then its words: "ON THE CALL  Ask to see the inbox and its texts".
      const found: { kind: keyof typeof CHECK_KINDS; text: string }[] = [];
      const visit = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          if (typeof o.kind === "string" && o.kind in CHECK_KINDS && (typeof o.label === "string" || typeof o.how === "string")) {
            found.push({ kind: o.kind as keyof typeof CHECK_KINDS, text: [o.label, o.how, o.claim].filter(Boolean).join(" ") });
          }
          Object.values(o).forEach(visit);
        }
      };
      visit([CORE_PARTS, ERP_MOVE, ERP_TEAM, ERP_CHECKS]);
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

  // A character cap only: the lines it sets in are the browser's to measure, not this file's.
  it("caps the h1 at 76 characters, and ends it and its key on “run here.”", () => {
    expect(ERP_HERO.title.length).toBeLessThanOrEqual(76);
    expect(ERP_HERO.title.endsWith("run here.")).toBe(true);
    expect(ERP_HERO.key.endsWith("run here.")).toBe(true);
  });

  it("builds the FAQ's structured data from the rows the page renders", () => {
    const ld = faqJsonLd(ERP_FAQ.items);
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(ERP_FAQ.items.map((i) => [i.q, i.a]));
    expect(ERP_FAQ.items.map((i) => i.id)).toEqual(["breadth", "fit", "offshelf", "complex", "move", "connect", "own", "users", "cost", "existing", "data"]);
  });

  const slots = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const TEMPLATES: [string, string, string[]][] = [
    ["the journey's step", ERP_PROCESS.stepOf, ["n", "total"]],
    ["the journey's announcement", ERP_PROCESS.live, ["label", "line", "n", "total", "who"]],
    ["the view switch's announcement", ERP_PROCESS.liveView, ["tally", "view"]],
    ["a sample's tag", ERP_SHAPE.tag, ["business", "scope"]],
    ["#shape's announcement", ERP_SHAPE.live, ["business", "n", "scope", "total"]],
    ["the checks' count", ERP_CHECKS.showing, ["n", "total"]],
  ];

  it.each(TEMPLATES)("%s fills exactly its slots", (_, template, want) => {
    expect(slots(template)).toEqual(want);
  });

  it("leaves no slot anywhere else in the copy", () => {
    const templates = new Set(TEMPLATES.map((t) => t[1]));
    expect(ALL.filter((s) => /[{}]/.test(s) && !templates.has(s))).toEqual([]);
  });

  it("holds each identifier whole, so a line never breaks after one of its hyphens", () => {
    const raw: string[] = [];
    const visit = (v: unknown) => {
      if (typeof v === "string") raw.push(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") Object.values(v).forEach(visit);
    };
    visit(PAGE);
    expect(raw.filter((s) => s.includes("eu-west-1"))).toEqual([]);
    expect(raw.filter((s) => s.includes("eu-⁠west-⁠1")).length).toBeGreaterThanOrEqual(1);
    // A word joiner only ever follows a hyphen.
    expect(raw.filter((s) => /(?<!-)⁠/.test(s))).toEqual([]);
  });

  it("ends its #start copy no lower in the deep panel than the SaaS page's, which the zones were measured on", () => {
    expect(ERP_START.title.length).toBeLessThanOrEqual(SAAS_START.title.length);
    expect(ERP_START.key.length).toBeLessThanOrEqual(SAAS_START.key.length);
    expect(ERP_START.body.length).toBeLessThanOrEqual(SAAS_START.body.length);
  });
});

describe("credits", () => {
  const creditLines = CREDITS.flatMap(split).filter((s) => /trademarks? of/.test(s));
  const credited = (mark: string) => creditLines.some((l) => named(mark, l));
  const printed = (mark: string) => OUTSIDE_CREDITS.some((s) => named(mark, s));
  const item = (term: string) => ERP_CREDITS.items.find((i) => i.term === term)!.detail;
  const GOOGLE_MARKS = ["Google", "Google Calendar", "Gmail", "Google Sheets", "Google Docs", "Google Drive", "Google Workspace"];

  // Printed means printed outside the credits: a mark the credits alone name would count itself.
  it("credits every mark it prints", () => {
    const marks = REGISTRY.filter(printed);
    expect(marks.length).toBeGreaterThanOrEqual(15);
    expect(marks.filter((m) => !credited(m))).toEqual([]);
  });

  it("prints every mark it credits, and lists the others in ERP_TRADEMARKS", () => {
    const marks = REGISTRY.filter((m) => creditLines.some((l) => named(m, l)));
    expect(marks.length).toBeGreaterThanOrEqual(15);
    expect(marks.filter((m) => !printed(m))).toEqual([]);
    const others = REGISTRY.filter(printed).filter((m) => !["Anthropic", "Claude", ...GOOGLE_MARKS].includes(m));
    expect([...ERP_TRADEMARKS].sort()).toEqual(others.sort());
    expect(plain(item("Other names on this page")).startsWith(listJoin(ERP_TRADEMARKS))).toBe(true);
  });

  it("says it once, and says none of them endorses the page", () => {
    expect(ALL.filter((s) => s.includes("trademarks of their respective owners"))).toHaveLength(1);
    expect(item("Other names on this page")).toContain("none of them endorses");
  });

  it("credits Google in its own line: exactly the Google marks the page prints", () => {
    const google = item("Google");
    const product = /\bGoogle (?!LLC\b)[A-Z]\w+/g;
    const products = new Set(OUTSIDE_CREDITS.flatMap((s) => [...s.matchAll(product)].map((m) => m[0])));
    expect([...products].sort()).toEqual(["Google Calendar", "Google Docs", "Google Drive", "Google Sheets"]);
    expect(new Set([...google.matchAll(product)].map((m) => m[0]))).toEqual(products);
    expect(named("Gmail", google)).toBe(printed("Gmail"));
    expect(google.startsWith("Google, ")).toBe(true);
    expect(google).toContain("trademarks of Google LLC");
    expect(google).toContain("is not endorsed by Google");
  });

  it("names Anthropic's owner exactly", () => {
    expect(item("Anthropic and Claude")).toContain("Anthropic, PBC");
  });

  it("says what isn't here, and what each sample and drawing is", () => {
    expect(item("What isn’t here")).toBe("No client names, logos, testimonials, prices or dates appear on this page.");
    for (const term of ["The sample business", "The samples", "The rehearsal"]) expect(item(term), term).toMatch(/for this page/);
    expect(item("The figures")).toContain("The one figure with a plus, the accreditations’");
    // "Owner" on this page is only ever a business account's single owner, never the build brief's.
    expect(item("The figures")).toContain("is our own count, and a floor: there are at least that many.");
    expect(ALL.filter((s) => /\bowner’s\b/i.test(s))).toEqual([]);
  });
});

describe("breadth: any CRM or ERP, for any business, and this platform as the proof", () => {
  const range = ERP_HERO.range;
  const items = range.groups.flatMap((g) => g.items);

  it("says it in the hero, the range, #shape, the team, the FAQ, the terms and the credits, each in its own words", () => {
    expect(ERP_META.title).toBe(`${ITEM.label}, for any business`);
    expect(ERP_HERO.sub).toContain("For any business, of any size and however complex");
    expect(ERP_HERO.sub).toContain("our own product for AI phone agents");
    // What "here" is, once: never the h1's halves again, never the plates' list under it, and never
    // "Those", which would put the stock and production listed before it on this platform.
    expect(ERP_HERO.sub).toContain("A CRM’s hard parts run every day on this platform, our own product for AI phone agents.");
    expect(ERP_HERO.sub).not.toMatch(/already run|already work|\bThose\b|under a lock/);
    expect(range.lead.endsWith("Not just phone agents.")).toBe(true);
    // Said before the six chips, so they read as a sample of what we build, not the menu.
    expect(ERP_SHAPE.sub.startsWith(`${cap(word(SAMPLES.length))} of the many kinds of business we build for,`)).toBe(true);
    expect(ERP_SHAPE.foot).toContain("Yours isn’t here? Bring it to the call.");
    expect(ERP_TEAM.sub).toContain("for any business");
    const breadth = ERP_FAQ.items[0];
    expect(breadth.id).toBe("breadth");
    expect(breadth.q).toContain("‘Voice’");
    expect(COMPANY.name).toMatch(/\bVoice\b/);
    expect(breadth.a.startsWith("No. We build whatever system your business runs on")).toBe(true);
    expect(breadth.a).toContain(`${COMPANY.name} is also the name of our own product`);
    expect(ERP_TERMS.after).toContain("the same team builds those too");
    const platform = ERP_CREDITS.items.find((i) => i.term === "The platform on this page")!.detail;
    expect(platform).toContain("not because voice is all we build");
    // Each place in its own words: no sentence of it said twice.
    const said_ = [ERP_HERO.sub, range.lead, ERP_SHAPE.sub, ERP_SHAPE.foot, ERP_TEAM.sub, breadth.a, ERP_TERMS.after, platform].flatMap(split);
    expect(new Set(said_).size).toBe(said_.length);
  });

  it("lists kinds of system and of business, never past work: three groups of four, a phone agent one line of twelve", () => {
    expect(range.groups).toHaveLength(3);
    for (const g of range.groups) expect(g.items, g.head).toHaveLength(4);
    expect(items).toHaveLength(12);
    expect(new Set(items).size).toBe(12);
    for (const i of items) expect(i.length, i).toBeLessThanOrEqual(50);
    expect(items.filter((i) => /\bcalls?\b|\bphone|\bvoice/i.test(i))).toEqual(["Calls from a phone agent, on the customer’s record"]);
    expect(range.fields.endsWith("or a business this list doesn’t name.")).toBe(true);
  });

  it("names no brand and prints no figure in the range, and marks every line of it OWNER", () => {
    const text = strings(range);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const s of [range.lead, range.fields, ...items]) {
      const at = linesOf(`"${s}"`);
      expect(at, s).toHaveLength(1);
      expect(at[0], s).toContain("// OWNER");
    }
  });
});

describe("colour", () => {
  const saasCss = read(`${SAAS_DIR}/saas.css`);
  const reach = flowReach(saasCss, "saas-flow-x", "saas-flow-y");
  const MOVING_MARGIN = 0.2;
  type Measured = Record<keyof typeof SAAS_INK, [number, number] | [number]>;
  // Every size each light renders at on this page (W × H px): the reused
  // components' boxes as the siblings measured them, and #move's three
  // stage cards as the running page draws them (the measure pass, spec
  // §7.2: each card at 320, 344, 390, 768, 1024 and 1280, where they stop
  // growing), with the figures worked out on them: [still, flowing], the
  // worst over the set. #shape's room holds no text (its markup is held
  // below).
  const HERO_ROOM: [number, number][] = [
    [343, 560], [704, 480], [440, 580], [480, 560], [560, 520], [288, 656], [358, 620], [560, 527], [440, 592], [500, 574],
    [288, 804], [358, 674], [560, 584], [440, 628], [500, 584],
  ];
  const MOVE_CARDS: [number, number][] = [
    [288, 463], [288, 605], [288, 669], [312, 463], [312, 605], [312, 629], [358, 419], [358, 543], [358, 567],
    [720, 319], [720, 429], [720, 435], [299, 687], [376, 585],
  ];
  const TEAM_CARD: [number, number][] = [
    [343, 900], [358, 860], [288, 1000], [704, 640], [720, 600], [944, 540], [1176, 480], [1176, 520],
    [288, 1084], [358, 974], [720, 594], [944, 492], [1176, 408],
  ];
  // #checks' card under the ledger: the SaaS component, on the papers light, still (no LiveMesh).
  const CHECKS_CARD: [number, number][] = [[288, 344], [358, 294], [720, 233], [944, 199], [1176, 199]];
  const SURFACES: [string, SaasLightId[], [number, number][], Measured][] = [
    ["the hero's room", ["room"], HERO_ROOM, { text: [12.47, 12.02], dim: [7.58, 7.31], accent: [5.86, 5.65], tick: [3.72, 3.58] }],
    ["#move's stage cards", ["stage", "stageMirror"], MOVE_CARDS, { text: [13.54, 12.07], dim: [8.23, 7.34], accent: [6.36, 5.67], tick: [4.04, 3.6] }],
    ["#team's card", ["papers"], TEAM_CARD, { text: [12.64, 11.41], dim: [7.69, 6.94], accent: [5.94, 5.36], tick: [3.77, 3.4] }],
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

  const WHITE = "#ffffff";
  it.each<[string, string, string, number, number]>([
    ["ink on white: the cards, the panels, the window, the table", HOME_COLORS.ink, WHITE, 19.11, 4.5],
    ["muted on white: labels, meta, mono, “Later”", HOME_COLORS.muted, WHITE, 6.37, 4.5],
    ["violet on white: datums, “Built for yours”", HOME_COLORS.violet, WHITE, 7.1, 4.5],
    ["settled on white: “Runs here”, “In this build”, “Moved”", HOME_COLORS.settled, WHITE, 5.5, 4.5],
    ["ember ink on white: the paper's pain, “Typed again”, “Asked”", HOME_COLORS.emberInk, WHITE, 5.92, 4.5],
    ["settled on settled-soft: the done chip, the “Paid” status", HOME_COLORS.settled, HOME_COLORS.settledSoft, 4.95, 4.5],
    ["white on electric: the chosen chip, the current stage pill", WHITE, HOME_COLORS.electric, 5.7, 4.5],
    ["electric on white: traces, dots, nodes, rings, rails", HOME_COLORS.electric, WHITE, 5.7, 3],
    ["ink on wash: #move's heading", HOME_COLORS.ink, HOME_COLORS.wash, 17.46, 4.5],
    ["muted on wash: #move's sub", HOME_COLORS.muted, HOME_COLORS.wash, 5.82, 4.5],
    ["violet on wash: #move's key phrase", HOME_COLORS.violet, HOME_COLORS.wash, 6.49, 4.5],
    ["electric on wash: #move's rail and stations", HOME_COLORS.electric, HOME_COLORS.wash, 5.21, 3],
    ["muted on chip: the “Later” chip, unchosen segments", HOME_COLORS.muted, HOME_COLORS.chip, 5.69, 4.5],
  ])("%s clears its bar, as measured", (_, fg, bg, measured, bar) => {
    const ratio = contrast(rgb(fg), rgb(bg));
    expect(ratio).toBeGreaterThanOrEqual(bar);
    expect(ratio).toBeCloseTo(measured, 1);
  });

  // #process's stage (`.home-stage`): the wash at its top, the stage colour at its foot; the words sit anywhere between.
  it.each<[string, string, number, number, number]>([
    ["ink: the rail's labels, the legend, the tally", HOME_COLORS.ink, 17.46, 16.17, 4.5],
    ["muted: the tag, the lane labels, unchosen rail items", HOME_COLORS.muted, 5.82, 5.39, 4.5],
    ["violet: the rail's numbers, “Built for yours” in the legend", HOME_COLORS.violet, 6.49, 6.01, 4.5],
    ["settled: “Runs here” in the legend", HOME_COLORS.settled, 5.03, 4.65, 4.5],
    ["electric: the dwell fill, the lane fills' edge (marks)", HOME_COLORS.electric, 5.21, 4.82, 3],
  ])("reads on #process's stage, at both ends: %s", (_, fg, top, foot, bar) => {
    const [a, b] = [HOME_COLORS.wash, HOME_COLORS.stage].map((bg) => contrast(rgb(fg), rgb(bg)));
    expect(Math.min(a, b)).toBeGreaterThanOrEqual(bar);
    expect(a).toBeCloseTo(top, 1);
    expect(b).toBeCloseTo(foot, 1);
  });

  // #core's night room (`.erp-night`): a static gradient between these two, the Automations and Mobile one.
  const NIGHT = ["#140a24", "#1e0a3c"] as const;
  it.each<[string, string, number, number]>([
    ["on-deep: “Under every record”", HOME_COLORS.onDeep, 16.55, 15.62],
    ["on-deep-dim: the tag", HOME_COLORS.onDeepDim, 12.74, 12.02],
    ["lilac: the bus label, the wire, the ports", HOME_COLORS.lilac, 8.87, 8.37],
  ])("reads on the night room: %s", (_, fg, top, bottom) => {
    const [a, b] = NIGHT.map((bg) => contrast(rgb(fg), rgb(bg)));
    expect(a).toBeGreaterThanOrEqual(4.5);
    expect(b).toBeGreaterThanOrEqual(4.5);
    expect(a).toBeCloseTo(top, 1);
    expect(b).toBeCloseTo(bottom, 1);
  });

  it("keeps electric off the night room as text, and its white cards legible", () => {
    for (const bg of NIGHT) expect(contrast(rgb(HOME_COLORS.electric), rgb(bg))).toBeLessThan(4.5);
    expect(contrast(rgb(HOME_COLORS.electric), rgb(NIGHT[1]))).toBeCloseTo(3.17, 1);
    expect(Math.min(...NIGHT.map((bg) => contrast(rgb(WHITE), rgb(bg))))).toBeCloseTo(18.04, 1);
  });

  it.skipIf(!has(`${DIR}/erp-core.css`))(`paints the night room with the gradient the tokens were measured on${waiting(`${DIR}/erp-core.css`)}`, () => {
    const blocks = parseCss(read(`${DIR}/erp-core.css`)).filter((b) => /\.erp-night(?![\w-])/.test(b.prelude) && !b.within.some((w) => /forced-colors/.test(w)));
    const grounds = blocks.flatMap((b) => b.decls.filter((d) => /^background(?:-image)?$/.test(d.prop)).map((d) => d.value));
    expect(grounds).toContain(`linear-gradient(180deg, ${NIGHT[0]} 0%, ${NIGHT[1]} 100%)`);
  });

  // #start's deep panel (DEEP_PANEL, static): the sizes and zones the Automations and Mobile tests hold.
  const WIDE: [number, number][] = [[1176, 441]];
  const NARROW: [number, number][] = [[343, 760], [704, 600], [944, 559], [1176, 559], [288, 605], [358, 562], [720, 495]];
  const ANYWHERE = [0, 0, 1, 1] as const;

  it("reads on the deep panel anywhere its copy can end", () => {
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
    expect(ours.length).toBeGreaterThan(0);
    for (const f of ours) expect(read(`${DIR}/${f}`), f).not.toMatch(/--saas-ground\s*:/);
  });

  const ROOM_FILES = [`${DIR}/shape-instrument.tsx`, `${DIR}/shape.tsx`];
  it.skipIf(!has(ROOM_FILES[0]))(`puts nothing on #shape's flowing light but the pools, the grain and the white card${waiting(ROOM_FILES[0])}`, () => {
    const file = ROOM_FILES.filter(has).find((f) => /\berp-room\b/.test(read(f)));
    expect(file, "the element wearing erp-room").toBeDefined();
    const src = code(file!);
    const at = src.lastIndexOf("<", src.search(/\berp-room\b/));
    const children = jsxChildren(src, at);
    expect(children.length).toBeGreaterThanOrEqual(2);
    for (const c of children) {
      const ok = c.tag === "LiveMesh" || c.tag === "ShapeCard" || /\bhome-grain\b|\berp-shape-card\b|\bsaas-proto-screen\b/.test(c.attrs);
      expect(ok, `<${c.tag} ${c.attrs.slice(0, 80)}> on the room`).toBe(true);
    }
    expect(children.some((c) => c.tag === "LiveMesh")).toBe(true);
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
 * The element a selector styles, as the tier check names it: the erp-
 * classes of the last compound that has one, and whatever the selector
 * goes on to name after it (`path` in a figure). Classes inside `:not()`
 * are not the element's.
 */
function subject(sel: string): { classes: string[]; trail: string } {
  const compounds = splitTop(sel.replace(/\s*([>+~])\s*/g, " $1 "), " ").filter((c) => !/^[>+~]$/.test(c));
  for (let k = compounds.length - 1; k >= 0; k--) {
    const own = compounds[k].replace(/:not\([^)]*\)/g, "");
    const classes = [...own.matchAll(/\.(erp-[\w-]+)/g)].map((m) => m[1]);
    if (classes.length) return { classes, trail: compounds.slice(k + 1).join(" ") };
  }
  return { classes: [], trail: compounds.join(" ") };
}

// What may animate or transition (spec §6): transforms, opacity and
// colours (box-shadow a lit ring's), and no custom property: the
// compositor can't run one. The strokes' dash animates on home.css's own
// `home-draw` only, never in a keyframe of ours.
const ANIMATABLE =
  /^(?:opacity|transform|translate|scale|rotate|color|background-color|border-color|outline-color|box-shadow|fill|stroke|animation-timing-function)$/;
const TRANSITIONABLE = new Set([
  "opacity", "transform", "translate", "scale", "rotate", "color", "background-color", "border-color", "outline-color", "box-shadow", "fill", "stroke",
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
const ORDER = ["erp.css", "erp-drawing.css", "erp-process.css", "erp-shape.css", "erp-move.css", "erp-core.css"];

/**
 * Every rule of ours that runs an animation (`animation` or
 * `animation-name`, not `none`) and isn't stopped on each of the lite,
 * still and weak tiers by a rule that wins: one rooted at
 * `html[data-tier="lite"]`, `html[data-tier="still"]` or `html[data-weak]`
 * (written out of any `:is()`), setting `animation: none` on the same
 * element — an erp- class of the animated rule's subject, and whatever
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
      const runs_ = b.decls.some((d) => animates(d) && !/^none\b/.test(d.value));
      for (const sel of splitTop(b.prelude)) {
        const spec = specificity(sel);
        for (const alt of expandIs(sel)) {
          const tier = alt.match(/^html\[data-tier="(lite|still)"\]|^html\[data-(weak)\]/);
          const { classes, trail } = subject(alt);
          if (tier && stops) pins.push({ tier: tier[1] ?? tier[2], classes, trail, spec, order });
          else if (runs_ && !tier) animated.push({ where: `${sheet}: ${alt}`, classes, trail, spec, order });
        }
      }
    }
  }
  const out: string[] = [];
  for (const a of animated) {
    if (!a.classes.length) {
      out.push(`${a.where}: animates no erp- element`);
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
 * Every erp- class that is the subject of rules in two of the section
 * sheets (erp.css, which holds the shared marks and pins, is exempt): a
 * class two sections both style is one each restyles on the other's
 * elements. Each entry names the class and the sheets.
 */
function sharedSubjects(sheets: readonly { sheet: string; blocks: CssBlock[] }[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const { sheet, blocks } of sheets) {
    const name = path.basename(sheet);
    if (name === "erp.css") continue;
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

/** Whether a selector, with the rules it sits in, names one of ours: an erp- class, or an erp- data attribute. */
const namesOurs = (s: string) => /\.erp-[\w-]/.test(s) || /\[data-erp-[\w-]/.test(s);

/** A state selector as a pattern: `[attr]` also matches `[attr="value"]`. */
const stateRe = (state: string) =>
  new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\[([\w-]+)\\\]/g, String.raw`\[$1(?:[~|^$*]?=[^\]]*)?\]`));

describe("the route's stylesheets", () => {
  const sheets = [DIR, APP_DIR]
    .filter(has)
    .flatMap((dir) => readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".css")).map((f) => `${dir}/${f}`));
  const parsed = sheets.map((sheet) => ({ sheet, blocks: parseCss(read(sheet)) }));
  const isAt = (prelude: string) => prelude.startsWith("@");
  const inKeyframes = (within: string[]) => within.some((p) => p.startsWith("@keyframes"));
  const missing = ORDER.filter((f) => !has(`${DIR}/${f}`));

  it(`finds the shared stylesheet, and every section's own${missing.length ? ` (waiting for ${missing.join(", ")})` : ""}`, () => {
    expect(sheets).toContain(`${DIR}/erp.css`);
    // No sheet of ours outside the list page.tsx imports in order.
    expect(sheets.map((s) => path.basename(s)).filter((f) => !ORDER.includes(f))).toEqual([]);
  });

  it.each(parsed.map((p) => [p.sheet, p.blocks] as const))("%s opens with a header listing its sections", (sheet) => {
    const src = read(sheet).trimStart();
    expect(src.startsWith("/*"), sheet).toBe(true);
    expect(src.slice(0, src.indexOf("*/")), sheet).toMatch(/§1\b/);
  });

  it.each(parsed.map((p) => [p.sheet, p.blocks] as const))("%s keeps every rule under .pp, every class and keyframe prefixed, and names one of ours", (sheet, blocks) => {
    for (const b of blocks) {
      if (isAt(b.prelude) || inKeyframes(b.within)) continue;
      const styleParents = b.within.filter((p) => !isAt(p));
      for (const sel of splitTop(b.prelude)) {
        // A top-level rule starts at the page's <main> (.pp), or at <html> for the tiers.
        if (styleParents.length === 0) expect(sel, sheet).toMatch(/^(?:\.pp(?![\w-])|html(?![\w-]))/);
        for (const [, cls] of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) expect(cls, `${sheet}: ${sel}`).toMatch(/^(?:erp-|saas-|home-)|^pp$/);
        expect([...styleParents, sel].some(namesOurs), `${sheet}: ${sel} names none of ours`).toBe(true);
      }
    }
    for (const b of blocks) {
      const name = b.prelude.match(/^@keyframes\s+(\S+)/)?.[1];
      if (name) expect(name, sheet).toMatch(/^erp-/);
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

  // Chromium restyles an element on a change of <html data-tier> when a selector names it by a
  // class, but not by the camel-case `[pathLength]`, so a figure styled before the tier landed went on drawing.
  it("names every tier pin's subject by a class, never by [pathLength]", () => {
    for (const { sheet, blocks } of parsed)
      for (const b of blocks)
        for (const sel of splitTop(b.prelude))
          for (const alt of expandIs(sel)) if (/^html\[data-(?:tier|weak)/.test(alt)) expect(alt, sheet).not.toMatch(/\[pathLength\]/i);
  });

  it("gives each section's sheet classes of its own, so none restyles another's elements", () => {
    expect(sharedSubjects(parsed)).toEqual([]);
  });

  it("defines the shared keyframes once, in erp.css, and every keyframe name once", () => {
    const where = (name: string) => parsed.filter((p) => p.blocks.some((b) => b.prelude === `@keyframes ${name}`)).map((p) => p.sheet);
    for (const name of ["erp-pop", "erp-fade-in", "erp-fade-out"]) expect(where(name), name).toEqual([`${DIR}/erp.css`]);
    const names = parsed.flatMap((p) => p.blocks.map((b) => b.prelude.match(/^@keyframes\s+(\S+)/)?.[1]).filter(Boolean));
    expect(new Set(names).size).toBe(names.length);
  });

  it("writes no view transition of its own: #shape's slide is saas-build.css's", () => {
    for (const { sheet, blocks } of parsed) {
      for (const b of blocks) {
        expect(b.prelude, sheet).not.toMatch(/::view-transition|:active-view-transition|@view-transition/);
        for (const d of b.decls) expect(d.prop, `${sheet}: ${b.prelude}`).not.toBe("view-transition-name");
      }
    }
  });

  // saas.css keys rules on `html:has(main.saas-page)`: with it, one glyph-relative length
  // anywhere in the document makes every DOM insertion restyle the whole page (20–50ms).
  it("uses no glyph-relative length (ch, ex, ic, cap, lh) and no utility built on one", () => {
    const unit = /(?<![\w-])\d*\.?\d+r?(?:ch|ex|ic|cap|lh)(?![\w-])/;
    const utility = /(?<![\w-])(?:min-w|max-w|w|basis)-prose(?![\w-])/;
    const files = [...readdirSync(path.join(ROOT, DIR)).filter((f) => /\.(?:tsx?|css)$/.test(f)).map((f) => `${DIR}/${f}`), PAGE_FILE].filter(has);
    for (const f of files) {
      const src = read(f);
      expect(src.match(unit)?.[0], f).toBeUndefined();
      expect(src.match(utility)?.[0], f).toBeUndefined();
    }
  });

  describe("forced colours", () => {
    // Each state the build spec draws in system colours, and the sheet it belongs to (§4, §6).
    const STATES: [string, string][] = [
      ['.erp-sheet[data-state="lit"]', "erp-drawing.css"],
      ['.erp-sheet[data-kind="none"]', "erp-drawing.css"],
      [".erp-trace", "erp-drawing.css"],
      [".erp-dot", "erp-drawing.css"],
      ["[data-erp-dwell]", "erp-process.css"],
      [".erp-row[data-state]", "erp-process.css"],
      [".erp-hot", "erp-process.css"],
      ['.erp-part[data-state="later"]', "erp-shape.css"],
      [".erp-group-fill", "erp-shape.css"],
      [".erp-copy", "erp-move.css"],
      ['.erp-core-card[data-kind="none"]', "erp-core.css"],
      [".erp-switch", "erp.css"],
    ];
    const forced = parsed.flatMap((p) => p.blocks.filter((b) => b.within.some((w) => /^@media\s*\(forced-colors:\s*active\)/.test(w))).map((b) => b.prelude));

    for (const [state, sheet] of STATES) {
      it.skipIf(!has(`${DIR}/${sheet}`))(`keeps ${state} in system colours${waiting(`${DIR}/${sheet}`)}`, () => {
        expect(forced.some((s) => stateRe(state).test(s)), `${state}, in ${sheet}`).toBe(true);
      });
    }
  });

  describe(`the page's imports${waiting(PAGE_FILE)}`, () => {
    it.skipIf(!has(PAGE_FILE))("imports what §2.2 lists, once each, in its order: the shared sheets, then ours, then the sections", () => {
      const page = read(PAGE_FILE);
      const got = [...page.matchAll(/^import\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["'];/gm)].map((m) => m[1]);
      expect(got).toEqual([
        "next",
        "@/components/site/product/primitives",
        "@/components/site/home/mesh-flow",
        "@/components/site/home/home.css",
        "@/components/site/home/tier.css",
        ...["saas.css", "saas-credentials.css", "saas-build.css", "saas-closing.css"].map((f) => `@/${SAAS_DIR}/${f}`),
        ...ORDER.map((f) => `@/${DIR}/${f}`),
        "@/lib/pages/crm-erp",
        ...["palette", "shell", "hero", "terms", "checks", "faq", "start"].map((f) => `@/${SAAS_DIR}/${f}`),
        `@/${AUTO_DIR}/team`,
        ...["deferred", "process", "shape", "move", "core"].map((f) => `@/${DIR}/${f}`),
      ]);
      expect(page).not.toMatch(/saas-explorer\.css|custom-automations\/auto[\w-]*\.css|custom-mobile-applications\/mob[\w-]*\.css/);
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
  const BOXES = SECTION_IDS.filter((id) => id !== "top");
  const deferred = read(`${DIR}/deferred.tsx`);

  it("measures at the SaaS page's widths and its own, in order, and keeps a height for every box at each", () => {
    // Its own widths are the ones deferred.tsx says why it keeps (OWN_AT, not exported).
    const own = deferred.match(/const OWN_AT = \[([^\]]*)\]/)?.[1].split(",").map(Number) ?? [];
    expect(own.length).toBeGreaterThan(0);
    // The widths the measure pass kept, each for the step or bend deferred.tsx names (spec §7.2).
    expect(own).toEqual([331, 332, 346, 359, 520, 543, 544, 720]);
    expect(RESERVE_AT).toEqual([...SAAS_RESERVE_AT, ...own].sort((a, b) => a - b));
    expect(new Set(RESERVE_AT).size).toBe(RESERVE_AT.length);
    expect(Object.keys(RESERVES)).toEqual(BOXES);
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

  // An estimate is never merged: once every group's file has landed, the measure pass (spec §7.2,
  // erp-sections.mjs) replaces the rows and OWN_AT and takes the word out, or this fails.
  const pending = waiting(...PAGE_FILES);
  it.skipIf(pending !== "")(`was measured on the page it reserves, not estimated${pending}`, () => {
    expect(deferred, "deferred.tsx still says ESTIMATE: run the measure pass").not.toMatch(/ESTIMATE/);
  });

  describe(`the page's boxes${waiting(PAGE_FILE)}`, () => {
    it.skipIf(!has(PAGE_FILE))("keeps a row for every box on the page, in its order, the hero above them all", () => {
      const page = read(PAGE_FILE);
      expect([...page.matchAll(/<ErpDeferred box="(\w+)">/g)].map((m) => m[1])).toEqual(Object.keys(RESERVES));
      expect(page).not.toMatch(/<(?:HomeDeferred|SaasDeferred|AutoDeferred|MobDeferred)\b/);
      // The h1 is the LCP from md: the hero is never deferred.
      expect(page.indexOf("<Hero data={ERP_HERO}")).toBeGreaterThan(-1);
      expect(page.indexOf("<Hero data={ERP_HERO}")).toBeLessThan(page.indexOf("<ErpDeferred"));
    });
  });
});

/** Our own scripts, comments left out: what they do, not what they say. */
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const scripts = () =>
  readdirSync(path.join(ROOT, DIR))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${DIR}/${f}`);

describe("the reuse contract", () => {
  it("still finds the SaaS shell, hero, sections, lights and closing sheets it builds on, and the Automations team", () => {
    for (const f of ["shell.tsx", "hero.tsx", "terms.tsx", "checks.tsx", "faq.tsx", "start.tsx", "palette.ts", "live-mesh.tsx", "check-line.tsx", "ledger-list.tsx", "deferred.tsx", "vt.ts"]) {
      expect(has(`${SAAS_DIR}/${f}`), f).toBe(true);
    }
    expect(has(`${AUTO_DIR}/team.tsx`)).toBe(true);
    expect(read(`${SAAS_DIR}/shell.tsx`)).toContain("pp home-body saas-page");
    const css = read(`${SAAS_DIR}/saas.css`);
    expect(css).toContain(".pp .saas-light-room-m {");
    expect(css).toContain(".pp .saas-light-stage-m {");
    const closing = read(`${SAAS_DIR}/saas-closing.css`);
    // #checks' view transition names the boxes after it by the ids this page gives them too.
    expect(closing).toContain(".home-deferred:has(> #faq)");
    expect(closing).toContain(".home-deferred:has(> #start)");
    expect(SECTION_IDS).toContain("faq");
    expect(SECTION_IDS).toContain("start");
    // Team hard-codes its id.
    expect(read(`${AUTO_DIR}/team.tsx`)).toContain('id="team"');
  });

  it("still names the SaaS prototype's screen for the \"proto\" scope, which #shape's card wears", () => {
    const build = read(`${SAAS_DIR}/saas-build.css`);
    expect(build).toMatch(/html\[data-saas-vt="proto"\] \.pp \.saas-proto-screen \{\s*view-transition-name: saas-proto;/);
    expect(read(`${SAAS_DIR}/vt.ts`)).toMatch(/\bproto: "\.pp \.saas-proto-screen"/);
  });

  it("copies none of the parts it reuses into its own folder", () => {
    const REUSED = /^export (?:function|const) (?:SaasShell|Hero|Terms|Checks|Faq|Start|Team|LiveMesh|FlowToggle|LedgerList|CheckLine|CheckGlyph|Segmented|ChipRail|HomeHeading|Stack|withViewTransition|vtAllowed)\b/m;
    for (const f of scripts()) expect(read(f), f).not.toMatch(REUSED);
    // Mobile's KindTag is left where it is: ErpTag is this page's own, on the SaaS CheckGlyph.
    const glyphs = read(`${DIR}/glyphs.tsx`);
    expect(glyphs).toContain(`from "@/${SAAS_DIR}/check-line"`);
    expect(glyphs).not.toMatch(/custom-mobile-applications/);
  });

  it("hands the reused sections data they accept", () => {
    type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;
    const hero = ERP_HERO satisfies PropsOf<typeof Hero>["data"];
    const terms = ERP_TERMS satisfies PropsOf<typeof Terms>["data"];
    const checks = ERP_CHECKS satisfies PropsOf<typeof Checks>["data"];
    const faq = ERP_FAQ satisfies PropsOf<typeof Faq>["data"];
    const start = ERP_START satisfies PropsOf<typeof Start>["data"];
    const credits = ERP_CREDITS satisfies PropsOf<typeof Start>["credits"];
    const team = ERP_TEAM satisfies PropsOf<typeof Team>["data"];
    expect([hero, terms, checks, faq, start, credits, team]).toHaveLength(7);
    // No row asks the SaaS explorer for a lens: this page has none of its lenses.
    expect(ERP_CHECKS.rows.filter((r) => r.link && "lens" in r.link)).toEqual([]);
  });

  it.skipIf(!has(PAGE_FILE))(`renders statically: nothing awaited, nothing read from the request${waiting(PAGE_FILE)}`, () => {
    const page = code(PAGE_FILE);
    expect(page).toMatch(/^export default function CrmErpPage\(\)/m);
    expect(page).not.toMatch(/\basync\b|\bawait\b|\bcookies\(|\bheaders\(|\bsearchParams\b|\bconnection\(/);
    expect(page).toContain('canonical: "/solutions/crm-erp"');
    expect(page).toContain('url: "/solutions/crm-erp"');
  });

  it.skipIf(!has(PAGE_FILE))(`takes no value but a component from a client module into a server one${waiting(PAGE_FILE)}`, () => {
    // A server component that imports a string from a "use client" module
    // gets a client reference instead: the Automations page's #work index
    // once rendered with no focus ring because it took RING_LIGHT from
    // home/controls.tsx.
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
    const visit = (file: string) => {
      if (servers.has(file) || isClient(file)) return;
      servers.add(file);
      for (const { target } of imports(file)) if (target?.startsWith(`${DIR}/`)) visit(target);
    };
    visit(PAGE_FILE);
    expect([...servers].length).toBeGreaterThan(3);
    const found: string[] = [];
    for (const file of servers) {
      for (const { names, spec, target } of imports(file)) {
        if (!target || !isClient(target)) continue;
        for (const name of names) if (!/^[A-Z][a-z]/.test(name)) found.push(`${file}: ${name} from ${spec}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("imports only types from the data module into a client island", () => {
    const clients = scripts().filter((f) => /^\s*["']use client["']/.test(read(f)));
    for (const f of clients) {
      const values = [...read(f).matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@\/lib\/pages\/crm-erp"/g)]
        .filter((m) => !m[1])
        .flatMap((m) => m[2].split(",").map((n) => n.trim()).filter((n) => n && !n.startsWith("type ")));
      expect(values, f).toEqual([]);
      expect(read(f), f).not.toMatch(/import\s+(?!type\b)[\w*{][^;]*from\s+"@\/lib\/pages\/crm-erp"/);
    }
  });

  const SIBLINGS = [
    "app/solutions/custom-saas-platforms",
    "app/solutions/custom-automations",
    "app/solutions/custom-mobile-applications",
    SAAS_DIR,
    AUTO_DIR,
    "components/site/solutions/custom-mobile-applications",
    ...["custom-saas-platforms", "custom-automations", "custom-mobile-applications"].flatMap((p) => [".ts", ".test.ts", ".server.ts"].map((x) => `lib/pages/${p}${x}`)),
  ];
  const git = (() => {
    try {
      execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: ROOT, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(git)("leaves every line of the three sibling pages as it is at HEAD", () => {
    // Read-only, and without the index refresh a plain status may write.
    const status = execFileSync("git", ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all", "--", ...SIBLINGS], { cwd: ROOT, encoding: "utf8" });
    expect(status).toBe("");
  });

  it("lists the page in the footer's LIVE set, right after the mobile page", () => {
    const footer = read("components/site/footer.tsx");
    const live = footer.slice(footer.indexOf("const LIVE = new Set(["));
    expect(live.slice(0, live.indexOf("]);"))).toMatch(/"\/solutions\/custom-mobile-applications",\s*"\/solutions\/crm-erp",/);
  });
});

/* ---------- the drawing's measures ---------- */

type Pt = readonly [number, number];
type Rect = { x: number; y: number; w: number; h: number };
type Turned = Rect & { turn: number };

/** A point, from `[x, y]` or `{ x, y }`: the geometry's own shape, whichever it is. */
function ptOf(p: unknown): Pt {
  if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
  const o = p as { x: number; y: number };
  return [o.x, o.y];
}
/** A box, from `{ x, y, w, h }` or `{ x, y, width, height }`. */
function rectOf(r: unknown): Rect {
  const o = r as Record<string, number>;
  return { x: o.x, y: o.y, w: o.w ?? o.width, h: o.h ?? o.height };
}
const turnedOf = (r: unknown): Turned => ({ ...rectOf(r), turn: (r as { turn: number }).turn });

/** Whether a point is strictly inside a box, clear of its edges by `eps`. */
const within = ([x, y]: Pt, r: Rect, eps = 0.01) => x > r.x + eps && x < r.x + r.w - eps && y > r.y + eps && y < r.y + r.h - eps;
/** A turned box's corners: turned by `turn` degrees about its centre, as CSS `rotate` turns it. */
function corners(r: Turned): Pt[] {
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  const t = (r.turn * Math.PI) / 180;
  return ([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]] as const).map(
    ([x, y]) => [cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t), cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t)] as const,
  );
}
/** Whether a point is strictly inside a turned box. */
function withinTurned([x, y]: Pt, r: Turned, eps = 0.01): boolean {
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  const t = (-r.turn * Math.PI) / 180;
  const lx = cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t);
  const ly = cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t);
  return within([lx, ly], r, eps);
}
/** A polygon's area (shoelace). */
const area = (poly: readonly Pt[]) => Math.abs(poly.reduce((s, [x, y], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0)) / 2;
/** The area two convex polygons share: `a` clipped by each edge of `b` (Sutherland–Hodgman). */
function overlapArea(a: readonly Pt[], b: readonly Pt[]): number {
  const sign = Math.sign(b.reduce((s, [x, y], i) => s + x * b[(i + 1) % b.length][1] - b[(i + 1) % b.length][0] * y, 0));
  let out: Pt[] = [...a];
  for (let i = 0; i < b.length && out.length; i++) {
    const [p, q] = [b[i], b[(i + 1) % b.length]];
    const side = ([x, y]: Pt) => sign * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]));
    const cut = (s: Pt, e: Pt): Pt => {
      const t = side(s) / (side(s) - side(e));
      return [s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t];
    };
    const input = out;
    out = [];
    input.forEach((e, k) => {
      const s = input[(k + input.length - 1) % input.length];
      if (side(e) >= 0) {
        if (side(s) < 0) out.push(cut(s, e));
        out.push(e);
      } else if (side(s) >= 0) out.push(cut(s, e));
    });
  }
  return out.length < 3 ? 0 : area(out);
}

/** Points along a straight run, at most half a unit apart, its start left out. */
const run = ([x0, y0]: Pt, [x1, y1]: Pt): Pt[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5));
  return Array.from({ length: n }, (_, f) => [x0 + ((x1 - x0) * (f + 1)) / n, y0 + ((y1 - y0) * (f + 1)) / n] as const);
};
/** Points along a Bézier of any order, at most about half a unit apart, its start left out. */
function bezier(ctrl: readonly Pt[]): Pt[] {
  const hull = ctrl.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - ctrl[k][0], p[1] - ctrl[k][1]), 0);
  const n = Math.max(2, Math.ceil(hull / 0.5));
  return Array.from({ length: n }, (_, f) => {
    let pts = [...ctrl];
    const t = (f + 1) / n;
    while (pts.length > 1) pts = pts.slice(1).map((p, k) => [pts[k][0] + (p[0] - pts[k][0]) * t, pts[k][1] + (p[1] - pts[k][1]) * t] as const);
    return pts[0];
  });
}
/** Points along an SVG elliptical arc (the spec's endpoint-to-centre conversion, F.6.5), its start left out. */
function arc(p0: Pt, rx0: number, ry0: number, phiDeg: number, large: number, sweep: number, p1: Pt): Pt[] {
  if (rx0 === 0 || ry0 === 0) return run(p0, p1);
  const phi = (phiDeg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [dx, dy] = [(p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2];
  const [x1, y1] = [cos * dx + sin * dy, -sin * dx + cos * dy];
  let [rx, ry] = [Math.abs(rx0), Math.abs(ry0)];
  const grow = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (grow > 1) [rx, ry] = [rx * Math.sqrt(grow), ry * Math.sqrt(grow)];
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const [cx1, cy1] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
  const [cx, cy] = [cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2, sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2];
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / 0.5));
  return Array.from({ length: n }, (_, f) => {
    const t = t0 + (dt * (f + 1)) / n;
    const [x, y] = [rx * Math.cos(t), ry * Math.sin(t)];
    return [cos * x - sin * y + cx, sin * x + cos * y + cy] as const;
  });
}

/**
 * An SVG path's `d` read back into points at most about half a unit
 * apart: M, L, H, V, Q, C, A and Z, absolute or relative, as any
 * generator might write a rounded connector or a hand-off's curve.
 * Anything else throws: a path this can't read is one this can't check.
 */
function pointsOfD(d: string): Pt[] {
  const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 };
  const commands = [...d.trim().matchAll(/([A-Za-z])([^A-Za-z]*)/g)];
  if (commands.map((c) => c[0]).join("") !== d.trim()) throw new Error(`a path I can't read: ${d}`);
  const out: Pt[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  const go = (pts: Pt[]) => {
    out.push(...pts);
    cur = pts.at(-1) ?? cur;
  };
  for (const [, letter, args] of commands) {
    const cmd = letter.toUpperCase();
    const rel = letter !== cmd;
    const arity = ARITY[cmd];
    const n = (args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (arity === undefined || (arity === 0 ? n.length > 0 : n.length === 0 || n.length % arity !== 0)) throw new Error(`a path I can't read: ${d}`);
    if (cmd === "Z") {
      go(run(cur, start));
      continue;
    }
    for (let i = 0; i < n.length; i += arity) {
      const a = n.slice(i, i + arity);
      const at = (x: number, y: number): Pt => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
      if (cmd === "M" && i === 0) {
        cur = start = at(a[0], a[1]);
        out.push(cur);
      } else if (cmd === "M" || cmd === "L") go(run(cur, at(a[0], a[1])));
      else if (cmd === "H") go(run(cur, [rel ? cur[0] + a[0] : a[0], cur[1]]));
      else if (cmd === "V") go(run(cur, [cur[0], rel ? cur[1] + a[0] : a[0]]));
      else if (cmd === "Q") go(bezier([cur, at(a[0], a[1]), at(a[2], a[3])]));
      else if (cmd === "C") go(bezier([cur, at(a[0], a[1]), at(a[2], a[3]), at(a[4], a[5])]));
      else go(arc(cur, a[0], a[1], a[2], a[3], a[4], at(a[5], a[6])));
    }
  }
  return out;
}

/**
 * The direct children of the JSX element whose `<` is at `open`: each
 * child's tag and its opening tag's attributes, read by counting tags. A
 * tag's end is found with its braces and quotes skipped, so an arrow in
 * an attribute doesn't end it; a child inside `{cond && <X />}` counts.
 */
function jsxChildren(src: string, open: number): { tag: string; attrs: string }[] {
  const tagAt = (i: number) => {
    const name = src.slice(i + 1).match(/^[\w.]*/)![0];
    let depth = 0;
    for (let j = i + 1 + name.length; j < src.length; j++) {
      const ch = src[j];
      if (depth === 0 && (ch === '"' || ch === "'")) j = src.indexOf(ch, j + 1);
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (depth === 0 && ch === ">") return { name, attrs: src.slice(i + 1 + name.length, j), end: j + 1, self: src[j - 1] === "/" };
    }
    throw new Error(`an unclosed tag at ${i}`);
  };
  const root = tagAt(open);
  if (root.self) return [];
  const out: { tag: string; attrs: string }[] = [];
  let depth = 0;
  for (let i = root.end; i < src.length; i++) {
    if (src[i] !== "<" || !/[\w./>]/.test(src[i + 1] ?? "")) continue;
    if (src[i + 1] === "/") {
      if (depth === 0) return out;
      depth--;
      continue;
    }
    const t = tagAt(i);
    if (depth === 0) out.push({ tag: t.name, attrs: t.attrs });
    if (!t.self) depth++;
    i = t.end - 1;
  }
  throw new Error("an element that never closes");
}

describe("the instruments this file measures with", () => {
  it("reads a rounded route back as it is drawn, whatever its corners are written in", () => {
    const pts = pointsOfD("M182 56 L194 56 Q202 56 202 64 L202 184");
    expect(pts[0]).toEqual([182, 56]);
    expect(pts.at(-1)).toEqual([202, 184]);
    // The corner is cut: points near its middle stand off the polyline's bend.
    expect(Math.min(...pts.map(([x, y]) => Math.hypot(202 - x, 56 - y)))).toBeGreaterThan(2);
    // An arc corner of radius 6 keeps every point 6 from its centre.
    const corner = pointsOfD("M0 0 h10 a6 6 0 0 1 6 6 v10");
    const bend = corner.filter(([x, y]) => x > 10 && y < 6);
    expect(bend.length).toBeGreaterThan(3);
    for (const [x, y] of bend) expect(Math.hypot(x - 10, y - 6)).toBeCloseTo(6, 5);
    expect(corner.at(-1)).toEqual([16, 16]);
    // A cubic ends where it says, H and V are read relative or not.
    expect(pointsOfD("M0 0 C10 0 10 10 20 10 H30 V0").at(-1)).toEqual([30, 0]);
    expect(() => pointsOfD("M0 0 S1 1 2 2")).toThrow(/can't read/);
    expect(() => pointsOfD("M0 0 L1")).toThrow(/can't read/);
  });

  it("finds a point inside a card or a turned paper, and not on its edge", () => {
    const card: Rect = { x: 10, y: 10, w: 20, h: 10 };
    expect(within([15, 15], card)).toBe(true);
    expect(within([30, 15], card)).toBe(false);
    const paper: Turned = { x: 0, y: 0, w: 100, h: 20, turn: 90 };
    // Turned upright about its centre (50, 10): it now spans x 40–60 and y −40–60.
    expect(withinTurned([50, 50], paper)).toBe(true);
    expect(withinTurned([90, 10], paper)).toBe(false);
    expect(corners(paper).map(([x, y]) => [Math.round(x), Math.round(y)])).toEqual([[60, -40], [60, 60], [40, 60], [40, -40]]);
  });

  it("measures the area two turned papers share", () => {
    const a: Turned = { x: 0, y: 0, w: 10, h: 10, turn: 0 };
    expect(overlapArea(corners(a), corners({ ...a, x: 5 }))).toBeCloseTo(50, 6);
    expect(overlapArea(corners(a), corners({ ...a, x: 20 }))).toBe(0);
    expect(overlapArea(corners(a), corners({ ...a, turn: 45 }))).toBeCloseTo(100 * (2 * Math.SQRT2 - 2), 4);
  });

  it("lists a JSX element's direct children, through conditions and arrows", () => {
    const src = `<div className="erp-room" onClick={() => go(a > b)}>
      <LiveMesh blobs={blobs} drift={1.08} />
      <span aria-hidden className="home-grain" />
      {picked && <div className="erp-shape-card saas-proto-screen"><h3>{title}</h3><ShapeCard data={data} /></div>}
    </div>`;
    expect(jsxChildren(src, 0).map((c) => c.tag)).toEqual(["LiveMesh", "span", "div"]);
    expect(jsxChildren(src, 0)[2].attrs).toContain("erp-shape-card");
    expect(() => jsxChildren("<div><p></div>", 0)).toThrow(/never closes/);
  });

  it("finds a keyframe, a transition or a scroll timeline that breaks the motion contract", () => {
    const css = `
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .pp .erp-rehearsal-fig { view-timeline: --erp-rehearsal block; }
        }
      }
      .pp .erp-x { view-timeline: --erp-x block; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s; }
      .pp .erp-lane-fill { transition: scale 0.6s cubic-bezier(0.16,1,0.3,1) calc(var(--k) * 80ms); }
      .pp .erp-pip { transition-property: background-color, --k; }
      @keyframes erp-grow { from { height: 0; scale: 1 0; } to { --k: 1; } }
    `;
    expect(motionFaults("fixture.css", parseCss(css))).toEqual([
      expect.stringMatching(/\.erp-x \{ view-timeline: .*outside the reduced-motion and support gates$/),
      expect.stringMatching(/\.erp-x \{ transition: .*transitions height$/),
      expect.stringMatching(/\.erp-pip \{ transition-property: .*transitions --k$/),
      expect.stringMatching(/from \{ height: 0 \}: animates height$/),
      expect.stringMatching(/to \{ --k: 1 \}: animates --k$/),
    ]);
  });

  it("finds an animation no tier stops, and a pin too light to stop it", () => {
    const sheet = (css: string) => [{ sheet: `${DIR}/erp-core.css`, blocks: parseCss(css) }];
    const deep = ".pp .erp-night:not([data-done]) .erp-port[data-r] .erp-port-ring { animation-name: erp-pop; }";
    const pin = (tiers: string) =>
      tiers
        .split(",")
        .map((t) => `html${t === "weak" ? "[data-weak]" : `[data-tier="${t}"]`} .home-body .erp-port-ring { animation: none; }`)
        .join("\n");
    expect(unpinned(sheet(deep))).toHaveLength(3);
    // Held at two classes and <html>, a pin loses to the scroll rule's five.
    expect(unpinned(sheet(`${deep}\n${pin("lite,still,weak")}`))).toEqual([
      expect.stringContaining("the lite pin loses"),
      expect.stringContaining("the still pin loses"),
      expect.stringContaining("the weak pin loses"),
    ]);
    // One :is() list pins every tier at once.
    const list = `html:is([data-tier="lite"], [data-tier="still"], [data-weak]) .pp.home-body .erp-night :is(.erp-port .erp-port-ring, .erp-token) { animation: none; }`;
    expect(unpinned(sheet(`${deep}\n${list}`))).toEqual([]);
    expect(specificity(".pp .erp-night:not([data-done]) .erp-port[data-r] .erp-port-ring")).toEqual([0, 6, 0]);
    expect(specificity('html[data-tier="lite"] .home-body :is(.erp-pop, .erp-fig .erp-fade)')).toEqual([0, 4, 1]);
  });

  it("finds a class two section sheets both style, and lets erp.css share its marks", () => {
    const sheet = (name: string, css: string) => ({ sheet: `${DIR}/${name}`, blocks: parseCss(css) });
    const drawing = sheet("erp-drawing.css", ".pp .erp-dot { top: 12px; } .pp .erp-trace { stroke-width: 2px; }");
    const process_ = sheet("erp-process.css", ".pp .erp-row[data-state] .erp-dot { top: 19px; } html[data-weak] .pp :is(.erp-row .erp-node) { animation: none; }");
    const shared_ = sheet("erp.css", ".pp .erp-node { width: 6px; }");
    expect(sharedSubjects([drawing, process_, shared_])).toEqual(["erp-dot: erp-drawing.css, erp-process.css"]);
    // A class only named on the way to the subject is not styled there.
    expect(sharedSubjects([sheet("erp-drawing.css", ".pp .erp-row { gap: 0; }"), sheet("erp-process.css", ".pp .erp-row .erp-hot { top: 0; }")])).toEqual([]);
  });

  it("matches a state selector with or without its value", () => {
    expect(stateRe(".erp-row[data-state]").test('.pp .erp-row[data-state="reached"] .erp-node')).toBe(true);
    expect(stateRe(".erp-row[data-state]").test(".pp .erp-row[data-state]")).toBe(true);
    expect(stateRe('.erp-sheet[data-state="lit"]').test('.pp .erp-sheet[data-state="visited"]')).toBe(false);
  });
});
