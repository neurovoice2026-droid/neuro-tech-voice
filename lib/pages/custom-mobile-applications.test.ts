import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ORPHAN_MIN_AGE_MS } from "@/app/api/cron/storage-cleanup";
import { DEEP_PANEL, HOME_COLORS } from "@/components/site/home/palettes";
import { holdFor } from "@/components/site/product/timing";
import type { Team } from "@/components/site/solutions/custom-automations/team";
import {
  RESERVE_AT,
  RESERVES,
  RESERVES_MEASURED_WITH,
  reserveStyle,
} from "@/components/site/solutions/custom-mobile-applications/deferred";
import type { Hold } from "@/components/site/solutions/custom-mobile-applications/phone-frame";
import type { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { RESERVE_AT as SAAS_RESERVE_AT, RESERVE_TIERS } from "@/components/site/solutions/custom-saas-platforms/deferred";
import type { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import type { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { SAAS_INK, SAAS_LIGHTS, type SaasLightId } from "@/components/site/solutions/custom-saas-platforms/palette";
import type { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import type { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { DELETION_ORDER } from "@/lib/account/deletion-plan";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { FACTS_AUTO } from "@/lib/pages/custom-automations";
import { sentences } from "@/lib/pages/home/source";
import { AUTH, COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU } from "@/lib/site";
import { SMS_LANGUAGES, bookingReminderSms, formatSmsDateTime } from "@/lib/sms/templates";
import { contrast, flowReach, over, rgb, worstInZone, worstMoving, worstStatic } from "@/lib/testing/mesh-contrast";
import {
  ACCREDITATIONS,
  CHECK_KINDS,
  FACTS,
  GRANTS,
  SAAS_CHECKS,
  SAAS_FAQ,
  SAAS_START,
  SECTION_IDS as SAAS_SECTION_IDS,
  faqJsonLd,
  listJoin,
} from "./custom-saas-platforms";
import {
  FACTS_MOB,
  FEATURES,
  GATES,
  MOB_BASE,
  MOB_CHECKS,
  MOB_CREDITS,
  MOB_FAQ,
  MOB_HERO,
  MOB_HOLD,
  MOB_KINDS,
  MOB_META,
  MOB_PATH,
  MOB_SERVER,
  MOB_START,
  MOB_TEAM,
  MOB_TERMS,
  MOB_TRADEMARKS,
  PARTS,
  PUBLISHED_APPS,
  REMINDER_TEXT,
  SAMPLES,
  SECTION_IDS,
  STEPS,
  publishedCopy,
  type Answer,
  type EdgeId,
  type GateId,
  type GoId,
  type KindId,
  type Move,
  type PartId,
  type PublishedApp,
  type ScreenId,
  type SectionId,
  type SideId,
  type StepId,
} from "./custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * /solutions/custom-mobile-applications — the claims the page makes,
 * held to the things they are about.
 *
 * The page argues that we design, build and publish iOS and Android apps
 * of any kind, for any business, and that the half of an app a buyer
 * never sees already runs here, on this platform, our own, for AI phone
 * agents: the proof, never the limit. The repository holds no app of
 * ours in a store, so the page claims none, and its spine is a sample
 * app to hold. Its words are only as good as this file. It holds:
 *
 *   - every word read from a source (the menu item, the phone number,
 *     the trial, the SaaS page's credentials, region sentences and two of
 *     its checks rows, the handover line, the account deletion's order,
 *     the text languages, and the booking reminder itself, cut around its
 *     time) to that source;
 *   - every figure the page prints about the platform to the repository
 *     (FACTS_MOB to the constants and source text it retypes), and every
 *     sentence about the platform's parts to the code it paraphrases:
 *     sign-in, the fresh sign-in window, deletion from settings, the
 *     signed payments webhook and the check before each fiscal invoice,
 *     the signature or secret every system calling in shows, signed
 *     uploads, the always-on service, the browser's token, the iPhone's
 *     audio, the reminder claimed once, and no push anywhere;
 *   - the phone to itself: five steps, their captions' lengths, every hop
 *     an edge of the drawing reached in order, its frame (phone-frame.ts)
 *     and its drawing (parts-geometry.ts): nine cards overlapping none,
 *     every edge ending on its own cards, clear of every other, crossing
 *     none;
 *   - #kinds' twelve samples to their fixed shape, and to being samples:
 *     no digit, no brand, no business;
 *   - #path to the stores: every quoted rule word for word, every store
 *     line marked in the data module with the page it came from, every
 *     Google Play policy line a labelled summary until it is re-read;
 *   - the honesty rules: no price, date, client, badge, rating, download
 *     count or past store launch while PUBLISHED_APPS is null;
 *     certification words only ever negated; grants only from their
 *     grantors; every owner-stated line marked OWNER; every third-party
 *     mark credited, and every credited mark printed;
 *   - the owner switch (publishedCopy) to the words it changes, and to
 *     none it doesn't;
 *   - every link to a section, a gate, a part or a route that exists;
 *   - every colour on every reused light at this page's boxes, at rest
 *     and while the pools flow (lib/testing/mesh-contrast.ts), the fixed
 *     pairs, the night room, the lock screen and the deep panel;
 *   - the route's stylesheets to the motion contract, and the
 *     content-visibility reserves to the page's boxes;
 *   - the sibling parts this page reuses to the contract it reuses them
 *     on, and the siblings' own files to HEAD.
 *
 * The page is built by several hands at once (spec §8.3). A group that
 * reads a file another hand writes (the frame, the drawing, the device,
 * #path's markup, the page, a section's sheet) skips, and says which
 * file it waits for, until that file lands; from then on it runs.
 * ------------------------------------------------------------------ */

const ROOT = process.cwd();
const DIR = "components/site/solutions/custom-mobile-applications";
const SAAS_DIR = "components/site/solutions/custom-saas-platforms";
const APP_DIR = "app/solutions/custom-mobile-applications";
const PAGE_FILE = `${APP_DIR}/page.tsx`;
const DATA_FILE = "lib/pages/custom-mobile-applications.ts";
const TEST_FILE = "lib/pages/custom-mobile-applications.test.ts";
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const has = (file: string) => existsSync(path.join(ROOT, file));
/** A source file's text with its `//` comment lines joined, so a phrase broken across two of them still matches. */
const said = (file: string) => read(file).replace(/\n\s*\/\/\s*/g, " ");
/** A describe's title while a file another group writes hasn't landed. */
const waiting = (...files: string[]) => {
  const missing = files.filter((f) => !has(f));
  return missing.length ? ` (waiting for ${missing.join(", ")})` : "";
};

/* The modules other groups write, read once each has landed. */
const FRAME_FILE = `${DIR}/phone-frame.ts`;
const GEOMETRY_FILE = `${DIR}/parts-geometry.ts`;
const frameKit = has(FRAME_FILE) ? await import("@/components/site/solutions/custom-mobile-applications/phone-frame") : null;
const geometryKit = has(GEOMETRY_FILE) ? await import("@/components/site/solutions/custom-mobile-applications/parts-geometry") : null;

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-mobile-applications")!;
const SAAS_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms")!;
const AUTO_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-automations")!;
const CAA_ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents")!;
const CALL = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref };
const ACC = `${ACCREDITATIONS.count}+`;
const GRANTORS = GRANTS.map((g) => g.grantor);

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => COUNT_WORD[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A string as it reads: the word joiners (U+2060) that hold an identifier whole ("D-U-N-S", "eu-west-1") left out. */
const plain = (s: string) => s.replaceAll("\u2060", "");

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
/** A repo-relative file path, as "In the code, for your developers" prints one. */
const IS_PATH = /^[\w.-]+(?:\/[\w.[\]()-]+)+$/;

const SECTIONS = {
  top: MOB_HERO,
  hold: MOB_HOLD,
  kinds: MOB_KINDS,
  path: MOB_PATH,
  server: MOB_SERVER,
  team: MOB_TEAM,
  terms: MOB_TERMS,
  checks: MOB_CHECKS,
  faq: MOB_FAQ,
  start: MOB_START,
} satisfies Record<SectionId, { title: string; key: string }>;

const PAGE = [MOB_META, ...Object.values(SECTIONS), MOB_CREDITS];
const ALL = strings(PAGE);
const CREDITS = strings(MOB_CREDITS);
const OUTSIDE_CREDITS = strings([MOB_META, ...Object.values(SECTIONS)]);
const FAQ_QS = new Set(MOB_FAQ.items.map((i) => i.q));
const SOURCE = read(DATA_FILE);
const LINES = SOURCE.split("\n");
/** The data module's source lines holding a string as written (a literal, not a template): each must be exactly one. */
const linesOf = (s: string) => LINES.filter((l) => l.includes(s));

/** The build spec's lists, typed so a renamed id fails to compile here too. */
const PART_IDS = ["signin", "api", "data", "payments", "files", "live", "jobs", "messages", "push"] as const satisfies readonly PartId[];
const EDGE_IDS = Object.keys({
  "phone-signin": 1, "phone-api": 1, "phone-payments": 1, "live-phone": 1, "push-phone": 1, "messages-phone": 1,
  "signin-data": 1, "api-data": 1, "payments-api": 1, "data-live": 1, "jobs-data": 1, "jobs-push": 1, "jobs-messages": 1, "data-files": 1,
} satisfies Record<EdgeId, 1>) as EdgeId[];
const GATE_IDS = ["delete", "payments", "review", "privacy", "website", "signin"] as const satisfies readonly GateId[];
const KIND_IDS = ["bookings", "shops", "delivery", "health", "learning", "money"] as const satisfies readonly KindId[];
const SIDE_IDS = ["customers", "staff"] as const satisfies readonly SideId[];

/** The parts a list of hops talks to, in hop order, the phone left out, then the ring (spec §4.2.6). */
const talkedTo = (hops: readonly EdgeId[], ring: readonly PartId[] = []): PartId[] =>
  [...new Set([...hops.flatMap((h) => h.split("-")), ...ring])].filter((p): p is PartId => p !== "phone");

describe("facts read from their sources", () => {
  it("reads the menu item: its label, description, promise, deliverables and stack", () => {
    // Guarded exactly: the page's stages, terms and plates are written for these.
    expect(ITEM).toMatchObject({
      label: "Custom Mobile Applications",
      href: "/solutions/custom-mobile-applications",
      description: "iOS and Android apps, designed, built and published.",
      promise: "An app your customers keep on their home screen.",
      deliverables: ["Designed for iOS and Android", "Sign-in, payments and push built in", "Published to both app stores"],
      stack: ["iOS", "Android", "Push", "Payments"],
    });
    expect(ITEM.stack.join("|")).toBe("iOS|Android|Push|Payments");
    expect(MOB_HERO.eyebrow).toBe(ITEM.label);
    expect(MOB_META.title.startsWith(ITEM.label)).toBe(true);
    expect(MOB_HERO.sub.startsWith(ITEM.description)).toBe(true);
    expect(MOB_PATH.title).toBe(ITEM.promise);
    expect(MOB_PATH.stages.map((s) => s.title)).toEqual(ITEM.deliverables);
    expect(MOB_PATH.stages.map((s) => s.n)).toEqual(["01", "02", "03"]);
    expect(MOB_TERMS.columns.find((c) => c.id === "get")!.items.slice(0, 3)).toEqual(ITEM.deliverables);
    // The plates are this page's own layers, not the stack's: a "Push" plate would say push runs here.
    expect(MOB_HERO.room.plates.map((p) => p.layer)).toEqual(["Sign-in", "API", "Payments", "Messages"]);
    for (const p of MOB_HERO.room.plates) expect(p.datum.length, p.datum).toBeLessThanOrEqual(20);
  });

  it("starts every build with the menu's own phone call", () => {
    expect(SOLUTIONS_MENU.cta.href(ITEM.id)).toBe(COMPANY.phoneHref);
    expect(CALL.label).toBe(SOLUTIONS_MENU.cta.label);
    for (const link of [MOB_HERO.primary, MOB_FAQ.talk, MOB_START.primary, MOB_CHECKS.missing.cta]) {
      expect(link).toEqual(CALL);
    }
    expect(MOB_FAQ.phone).toBe(COMPANY.phone);
    expect(MOB_HERO.note.startsWith(COMPANY.phone)).toBe(true);
    expect(MOB_START.note.startsWith(COMPANY.phone)).toBe(true);
    const tel = hrefs(PAGE).filter((h) => h.startsWith("tel:"));
    expect(tel.length).toBeGreaterThanOrEqual(4);
    for (const h of tel) expect(h).toBe(COMPANY.phoneHref);
  });

  it("sends every trial link to the free trial", () => {
    const trial = linksIn(PAGE).filter((l) => /free trial|Try the platform|^Start free$/i.test(l.label));
    expect(trial.length).toBeGreaterThan(5);
    for (const l of trial) expect([PRICING_TRIAL.href, AUTH.signup], l.label).toContain(l.href);
    expect(MOB_CHECKS.rows.filter((r) => r.link?.label === PRICING_TRIAL.cta)).toHaveLength(2);
    expect(PARTS.find((p) => p.id === "signin")!.check.href).toBe(AUTH.signup);
  });

  it("links the team to the SaaS page's credentials, which it still has, and the terms to the team's other builds", () => {
    expect(SAAS_ITEM.href).toBe("/solutions/custom-saas-platforms");
    expect(MOB_TEAM.grants.more.href).toBe("/solutions/custom-saas-platforms#credentials");
    expect(SAAS_SECTION_IDS).toContain("credentials");
    expect(MOB_TERMS.links.map((l) => l.href)).toEqual([SAAS_ITEM.href, AUTO_ITEM.href, CAA_ITEM.href]);
  });

  it("reuses the SaaS module's credentials and check kinds, never a copy of either", () => {
    for (const kinds of [MOB_TEAM.checkKinds, MOB_PATH.checkKinds, MOB_SERVER.checkKinds, MOB_CHECKS.kinds]) {
      expect(kinds).toBe(CHECK_KINDS);
    }
    expect(MOB_TEAM.accreditations.figure).toBe(ACC);
    expect(MOB_TEAM.grants.names).toEqual(GRANTORS);
    expect(MOB_HERO.proof.find((p) => p.label === "Startup grants")!.term).toBe(listJoin(GRANTORS));
    // The one list of parts behind #hold's drawing, #kinds' rows and #server's cards.
    expect(MOB_SERVER.parts).toBe(PARTS);
    const faces = PARTS.map(({ id, label, datum, kind }) => ({ id, label, datum, kind }));
    expect(MOB_HOLD.parts).toEqual(faces);
    expect(MOB_KINDS.parts).toEqual(faces);
    expect(MOB_HOLD.steps).toBe(STEPS);
    expect(MOB_KINDS.samples).toBe(SAMPLES);
    expect(MOB_KINDS.features).toBe(FEATURES);
    expect(MOB_PATH.gates.rows).toBe(GATES);
  });

  it("takes two checks rows from the SaaS page by id: the same objects, never retyped", () => {
    for (const id of ["cards", "company"]) {
      const theirs = SAAS_CHECKS.rows.find((r) => r.id === id);
      expect(theirs, id).toBeDefined();
      expect(MOB_CHECKS.rows.find((r) => r.id === id), id).toBe(theirs);
    }
  });

  it("offers the accreditations and the grants on the call until there is a public link", () => {
    const acc = MOB_CHECKS.rows.find((r) => r.id === "accreditations")!;
    if (ACCREDITATIONS.verify === null) {
      expect(MOB_TEAM.accreditations.check.kind).toBe("call");
      expect(acc.kind).toBe("call");
      expect(acc.link).toBeUndefined();
    } else {
      expect(MOB_TEAM.accreditations.check).toMatchObject({ kind: "site", href: ACCREDITATIONS.verify.href });
      expect(acc).toMatchObject({ kind: "site", link: { href: ACCREDITATIONS.verify.href } });
    }
    const grants = MOB_CHECKS.rows.find((r) => r.id === "grants")!;
    const grantLink = GRANTS.find((g) => g.verify)?.verify;
    if (!grantLink) {
      expect(MOB_TEAM.grants.check.kind).toBe("call");
      expect(grants.kind).toBe("call");
      expect(grants.link).toBeUndefined();
    } else {
      expect(MOB_TEAM.grants.check).toMatchObject({ kind: "site", href: grantLink.href });
      expect(grants).toMatchObject({ kind: "site", link: { href: grantLink.href } });
    }
  });

  it("reads where the data lives from the SaaS page's answer", () => {
    const saas = SAAS_FAQ.items.find((i) => i.id === "data")!.a;
    const ours = MOB_FAQ.items.find((i) => i.id === "data")!;
    expect(plain(ours.a).endsWith(sentences(saas, 1, 5))).toBe(true);
    expect(plain(ours.a)).toContain("eu-west-1 (Ireland)");
    // The database part names the same region.
    expect(plain(PARTS.find((p) => p.id === "data")!.ours)).toContain("eu-west-1 (Ireland)");
    expect(ours.where).toEqual({ label: "Read the privacy policy", href: "/privacy" });
  });

  it("borrows the handover line from the custom AI agents page", () => {
    expect(MOB_TERMS.columns.find((c) => c.id === "upfront")!.items.at(-1)).toBe(CAA_HANDOVER.after);
  });

  it("reads the account deletion's order: billing stopped first, the sign-in removed last, its length in words", () => {
    expect(DELETION_ORDER[0]).toBe("cancel_subscriptions");
    expect(DELETION_ORDER.at(-1)).toBe("delete_auth_user");
    const publish = MOB_BASE.path.stages.find((s) => s.id === "publish")!;
    // The steps are the server's, not the reader's: the sentence says who takes them.
    expect(publish.ours).toContain(`the server removes the account and its data in ${word(DELETION_ORDER.length)} steps with billing stopped first`);
    expect(GATES.find((g) => g.id === "delete")!.side.text).toContain("Billing stops first");
  });

  it("prints the text languages as the templates count them", () => {
    const printed = ALL.flatMap((s) => [...s.matchAll(/\b(\d+) languages\b/g)].map((m) => Number(m[1])));
    expect(printed.length).toBeGreaterThanOrEqual(3);
    for (const n of printed) expect(n).toBe(SMS_LANGUAGES.length);
  });

  it("prints the platform's own booking reminder, word for word, with only its time cut out", () => {
    // A second instant, in another month, on another weekday and at another
    // hour: the cut is the template's {when}, not the one date it was cut at.
    const at = new Date(Date.UTC(2033, 5, 17, 16, 45));
    const full = bookingReminderSms({ language: "en", businessName: MOB_HOLD.app.name, startsAt: at, timezone: "UTC", service: null });
    expect(REMINDER_TEXT.before + formatSmsDateTime(at, "UTC", "en") + REMINDER_TEXT.after).toBe(full);
    expect(MOB_HOLD.reminder).toBe(REMINDER_TEXT);
    for (const half of [REMINDER_TEXT.before, REMINDER_TEXT.after]) {
      expect(half).not.toMatch(/\d/);
      expect(half).not.toMatch(/\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/);
    }
    expect(REMINDER_TEXT.before.startsWith(`Reminder from ${MOB_HOLD.app.name}:`)).toBe(true);
    expect(REMINDER_TEXT.after).toContain("Reply STOP to opt out.");
  });
});

describe("counts and code held to the repository", () => {
  it("holds the fresh sign-in window to the account route, and prints it", () => {
    const route = read("app/api/account/route.ts");
    expect(route).toContain(`REAUTH_WINDOW_MS = ${FACTS_MOB.reauthMinutes} * 60 * 1000`);
    expect(route).toContain("reauth_required");
    expect(route).toContain("accountDeletedEmail");
    expect(GATES.find((g) => g.id === "delete")!.side.text).toContain(`in the last ${FACTS_MOB.reauthMinutes} minutes`);
    expect(MOB_CHECKS.rows.find((r) => r.id === "delete")!.how).toContain(`within the last ${FACTS_MOB.reauthMinutes} minutes`);
  });

  it("holds the browser's live token to the test-session route, and prints it", () => {
    const route = read("app/api/voice/test-session/route.ts");
    expect(route).toContain(`BROWSER_TOKEN_TTL_SECONDS = ${FACTS_MOB.liveTokenSeconds}`);
    expect(route).toContain("signSessionToken");
    expect(PARTS.find((p) => p.id === "live")!.ours).toContain(`expires in ${FACTS_MOB.liveTokenSeconds} seconds`);
  });

  it("counts the booking texts and the account emails from their templates", () => {
    const sms = read("lib/sms/templates.ts");
    expect(sms.match(/^export function \w+Sms\(input: BookingSmsInput\)/gm)).toHaveLength(FACTS_MOB.bookingTexts);
    expect(sms).toMatch(/^export function bookingReminderSms\(input: BookingSmsInput\)/m);
    expect(read("lib/email/templates.ts").match(/^export function \w+Email\(/gm)).toHaveLength(FACTS_AUTO.emails);
    const messages = PARTS.find((p) => p.id === "messages")!.ours;
    expect(messages).toContain(`${cap(word(FACTS_AUTO.emails))} account emails`);
    expect(messages).toContain(`${word(FACTS_MOB.bookingTexts)} kinds of booking text in ${SMS_LANGUAGES.length} languages`);
    // The hero's plate prints each figure beside what it counts: the platform sends other emails and texts too.
    const plate = MOB_HERO.room.plates.find((p) => p.layer === "Messages")!;
    expect(plate.datum).toBe(`${FACTS_AUTO.emails} account emails`);
    expect(plate.runs).toContain(`${word(FACTS_MOB.bookingTexts)} kinds of booking text in ${SMS_LANGUAGES.length} languages`);
    expect(strings(MOB_HERO.room).filter((s) => /\d+ (?:emails|texts)\b/.test(s))).toEqual([]);
  });

  it("holds the day-old uploads to the clean-up's own cut-off", () => {
    expect(FACTS_MOB.orphanHours * 3_600_000).toBe(ORPHAN_MIN_AGE_MS);
    expect(FACTS_MOB.orphanHours).toBe(24);
    expect(PARTS.find((p) => p.id === "files")!.ours).toContain("day-old uploads");
    expect(FACTS.cronSteps).toContain("purge_orphan_uploads");
  });

  it("prints the figures it takes from the SaaS module as they are", () => {
    const part = (id: PartId) => PARTS.find((p) => p.id === id)!;
    expect(part("api").datum).toBe(`${FACTS.routeHandlers}+ routes`);
    expect(part("data").datum).toBe(`${FACTS.migrations} migrations`);
    expect(part("data").ours).toContain(`one of ${FACTS.migrations} migrations`);
    expect(part("payments").datum).toBe(`${FACTS.stripeEvents} Stripe events`);
    expect(part("payments").ours).toContain(`on ${word(FACTS.stripeEvents)} kinds of event`);
    expect(part("live").ours).toContain(`Node.js ${FACTS.nodeMajor}`);
    expect(part("jobs").datum).toBe(FACTS.cronAt);
    expect(part("jobs").ours).toContain(`at ${FACTS.cronAt}, ${word(FACTS.cronSteps.length)} steps`);
    expect(MOB_HERO.room.plates[1].datum).toBe(`${FACTS.routeHandlers}+ API routes`);
    expect(MOB_HERO.room.plates[2].datum).toBe(`${FACTS.stripeEvents} Stripe event types`);
  });

  it("signs people in the ways the sign-in part says, and limits tries per network and per account", () => {
    const actions = read("lib/auth/actions.ts");
    for (const phrase of ["signInWithPassword", "signUp(", "signInWithOAuth", "provider: 'google'", "resetPasswordForEmail"]) {
      expect(actions, phrase).toContain(phrase);
    }
    expect(said("lib/auth/throttle.ts")).toContain("per client IP and per account identifier");
    expect(read("lib/security/rate-limit.ts")).toContain("authFailures");
    expect(PARTS.find((p) => p.id === "signin")!.ours).toContain("limited per network and per account");
  });

  it("deletes an account from the settings the page names", () => {
    const settings = read("components/settings/SettingsPageClient.tsx");
    expect(settings).toContain("Danger zone");
    expect(settings).toContain("Delete account");
    for (const s of [GATES.find((g) => g.id === "delete")!.side.text, MOB_CHECKS.rows.find((r) => r.id === "delete")!.how]) {
      expect(s).toContain("Settings → Danger zone → Delete account");
    }
  });

  it("finds checkout and the customer portal", () => {
    for (const f of ["app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts"]) expect(has(f), f).toBe(true);
  });

  it("takes payments through a signed webhook, and checks for a recorded fiscal invoice before issuing one", () => {
    const webhook = read("app/api/billing/webhook/route.ts");
    expect(webhook).toContain("req.headers.get('stripe-signature')");
    expect(webhook).toContain("webhooks.constructEvent(rawBody, signature, webhookSecret)");
    const emit = read("lib/smartbill/emit.ts");
    expect(said("lib/smartbill/emit.ts")).toContain("Idempotent on the Stripe invoice id");
    expect(emit).toContain("// Idempotency guard.");
    expect(emit).toContain(".eq('stripe_invoice_id', invoice.id)");
    // The check comes before SmartBill is asked.
    expect(emit.indexOf("if (existing) return")).toBeGreaterThan(-1);
    expect(emit.indexOf("if (existing) return")).toBeLessThan(emit.indexOf("sbInvoices.create("));
    const payments = PARTS.find((p) => p.id === "payments")!.ours;
    expect(payments).toContain("a signed webhook");
    expect(payments).toContain("SmartBill fiscal invoices, each issued only after a check for one on record.");
    const plate = MOB_HERO.room.plates.find((p) => p.layer === "Payments")!;
    expect(plate.runs).toContain("fiscal invoices, each issued only after a check for one on record");
    // The guard reads, then issues, and a read that errors counts as no row; an unconfigured SmartBill,
    // a zero amount or an unknown organisation issue nothing. So the page says what is checked, and
    // never promises one invoice per payment (the Automations page's rule, custom-automations.test.ts).
    expect(emit).toContain("const { data: existing }");
    for (const guard of ["if (!isConfigured()) return", "if ((invoice.amount_paid ?? 0) <= 0) return", "if (!orgId) {"]) expect(emit, guard).toContain(guard);
    for (const s of strings([PAGE, PARTS])) {
      expect(s).not.toMatch(/(?:one|a) (?:SmartBill )?fiscal invoice (?:per|for each|for every) payment|fiscal invoice each|exactly one fiscal invoice|however often|resends? an event/i);
      expect(s).not.toMatch(/never (?:\w+ )?(?:two|a second) fiscal invoices?|isn’t invoiced (?:twice|again)/i);
    }
  });

  it("has every system calling in prove who it is, as the API part and its plate say", () => {
    // The phone network: every telephony route reads its form through Twilio's signature check.
    const telephony = readdirSync(path.join(ROOT, "app/api/telephony"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `app/api/telephony/${e.name}/route.ts`).filter(has);
    expect(telephony.length).toBeGreaterThanOrEqual(5);
    for (const f of telephony) {
      const route = read(f);
      expect(route, f).toContain("from '@/lib/twilio/signature'");
      expect(route, f).toContain("readVerifiedTwilioForm(req");
    }
    const twilio = read("lib/twilio/signature.ts");
    expect(twilio).toContain("twilio.validateRequest(authToken, signature, url, signed)");
    expect(twilio).toContain("'Invalid Twilio signature.'");
    // The payment provider: Stripe's signature over the raw body.
    expect(read("app/api/billing/webhook/route.ts")).toContain("constructEvent(rawBody, signature");
    // The daily job: a bearer secret, checked before any step runs.
    const daily = read("app/api/cron/daily/route.ts");
    expect(daily).toContain("await requireCronRequest(req, 'cron')");
    expect(read("app/api/cron/auth.ts")).toContain("Authorization: Bearer <CRON_SECRET>");
    const claim = "systems calling in — the phone network, the payment provider, the daily job — prove who they are with a signature or a secret";
    expect(PARTS.find((p) => p.id === "api")!.ours).toContain(claim);
    expect(MOB_HERO.room.plates.find((p) => p.layer === "API")!.runs).toContain("systems calling in prove who they are with a signature or a secret");
  });

  it("sends uploads straight to storage through a one-time signed link, which storage itself checks", () => {
    for (const f of ["app/api/agent/knowledge/upload-url/route.ts", "app/api/voices/_lib/storage.ts"]) {
      expect(read(f), f).toContain("createSignedUploadUrl");
    }
    const upload = said("app/api/agent/knowledge/upload-url/route.ts");
    expect(upload).toContain("one-time signed upload URL");
    expect(upload).toContain("The bucket itself enforces");
    const files = PARTS.find((p) => p.id === "files")!.ours;
    expect(files).toContain("one-time signed link");
    expect(files).toContain("storage itself checks each file’s size and type");
    // The limit is the bucket's: the page prints no size.
    expect(files).not.toMatch(/\bMB\b/);
  });

  it("keeps the live connection always on, behind a token checked before the socket opens", () => {
    const fly = read("services/voice-gateway/fly.toml");
    expect(fly).toMatch(/^\s*auto_stop_machines = false$/m);
    expect(fly).toMatch(/^\s*min_machines_running = 1$/m);
    const server = said("services/voice-gateway/src/server.ts");
    expect(server).toContain("new WebSocketServer");
    expect(server).toContain("checked before upgrade");
    expect(PARTS.find((p) => p.id === "live")!.datum).toBe("always on");
  });

  it("pushes database changes to a screen through the live part, as #hold's step 2 draws it", () => {
    // Step 2: free times stay current, data → live → phone. On ours, that's the dashboard's realtime subscription.
    expect(STEPS[1].hops).toEqual(expect.arrayContaining(["data-live", "live-phone"]));
    const live = PARTS.find((p) => p.id === "live")!;
    expect(live.files).toContain("hooks/useCallsChanged.ts");
    const hook = read("hooks/useCallsChanged.ts");
    expect(hook).toContain("postgres_changes");
    for (const event of ["'INSERT'", "'UPDATE'"]) expect(hook, event).toContain(`event: ${event}, schema: 'public', table: 'calls'`);
    expect(read("hooks/useRecentCalls.ts")).toContain("useCallsChanged(");
    expect(live.ours).toContain("the dashboard updates as calls change");
  });

  it("picks an iPhone's sound back up where the audio code says it does", () => {
    const resume = said("lib/audio/resume.ts");
    for (const phrase of ["'interrupted'", "Siri", "screen locks", "Tap to resume"]) expect(resume, phrase).toContain(phrase);
    expect(has("lib/audio/resume.test.ts")).toBe(true);
    expect(PARTS.find((p) => p.id === "live")!.ours).toContain("picks its sound back up after a phone call, Siri or a locked screen interrupts it");
    // …and asks for a tap when iOS won't let it resume on its own.
    expect(PARTS.find((p) => p.id === "live")!.ours).toContain("or asks for a tap");
  });

  it("claims each reminder before its text goes out, and frees it if the text fails", () => {
    const reminders = read("lib/scheduling/reminders.ts");
    for (const phrase of [".update({ reminder_sent_at: claimedAt })", ".is('reminder_sent_at', null)", ".update({ reminder_sent_at: null })"]) {
      expect(reminders, phrase).toContain(phrase);
    }
    expect(FACTS.cronSteps).toContain("booking_reminders");
    expect(PARTS.find((p) => p.id === "jobs")!.ours).toContain("claims each booking before texting it");
    expect(read("lib/twilio/sms.ts")).toMatch(/^export (?:async )?function sendSms\(/m);
    // Twilio carries the texts; the emails go through Resend. The line ties Twilio to the texts alone.
    expect(read("lib/email/client.ts")).toContain("https://api.resend.com/emails");
    const messages = PARTS.find((p) => p.id === "messages")!.ours;
    expect(messages).toContain("languages, the texts sent through Twilio.");
    expect(messages).not.toMatch(/emails\b[^.]*, sent through Twilio/);
  });

  it("points at the platform's own text only where the sample shows it: with notifications off", () => {
    // The finished frame is the push drawn for the page; the real text arrives on step 5's "Don't allow" path.
    expect(MOB_HOLD.initial.answer).toBe("allow");
    expect(STEPS[4].hops).not.toContain("messages-phone");
    expect(STEPS[4].deny!.hops).toContain("messages-phone");
    expect(PARTS.find((p) => p.id === "messages")!.ours).toContain("Turn notifications off in the sample above, and the text it shows is this platform’s own reminder");
    // The FAQ's answer also stands alone as structured data: it points at no sample.
    expect(MOB_FAQ.items.find((i) => i.id === "push")!.a).not.toMatch(/\bsample\b/);
  });

  it("walls each business's rows off with row-level security in its migrations", () => {
    const migrations = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    expect(migrations).toHaveLength(FACTS.migrations);
    expect(migrations.some((f) => /enable row level security/i.test(read(`supabase/migrations/${f}`)))).toBe(true);
    expect(PARTS.find((p) => p.id === "data")!.ours).toContain("Row-level security");
  });

  it("finds no push anywhere on this platform", () => {
    // The page's own files describe push (the part it lacks); they are the page, not the platform.
    const skip = new Set([DATA_FILE, TEST_FILE]);
    const files = [...["app", "lib", "components", "services", "hooks", "store"].flatMap((d) => walk(d)), "package.json"].filter(
      (f) => /\.(?:[cm]?[jt]sx?|json|toml)$/.test(f) && !skip.has(f) && !f.startsWith(`${DIR}/`) && !f.startsWith(`${APP_DIR}/`),
    );
    expect(files.length).toBeGreaterThan(500);
    const push = /\bapns\b|firebase|\bfcm\b|web-push|PushManager|expo-notifications|expo-server-sdk|serviceWorker\.register/i;
    const found = files.filter((f) => push.test(read(f)));
    expect(found, "the push part says ‘Not on ours’: re-read it and the FAQ’s push row").toEqual([]);
  });

  it("points every part at files that exist", () => {
    const files = PARTS.flatMap((p) => p.files);
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) expect(has(f), f).toBe(true);
    expect(PARTS.find((p) => p.id === "push")!.files).toEqual([]);
  });
});

describe("the phone (#hold)", () => {
  const STEP_IDS: StepId[] = ["signin", "choose", "pay", "booked", "reminder"];
  const SCREENS: ScreenId[] = ["signin", "choose", "pay", "booked", "lock"];
  const captions = [...STEPS.map((s) => s.caption), ...STEPS.flatMap((s) => (s.deny ? [s.deny.caption] : []))];
  // The build spec's talks-to lists (§4.2.6), step by step, then step 5 with notifications off.
  const TALKS: PartId[][] = [
    ["signin", "data"],
    ["api", "data", "live"],
    ["payments", "api", "data"],
    ["api", "data", "push"],
    ["jobs", "data", "push"],
  ];
  const TALKS_DENIED: PartId[] = ["jobs", "data", "messages"];

  it("follows one customer through five steps, from signing in to a reminder on the lock screen", () => {
    expect(STEPS.map((s) => s.id)).toEqual(STEP_IDS);
    expect(STEPS.map((s) => s.n)).toEqual(["01", "02", "03", "04", "05"]);
    expect(STEPS.map((s) => s.screen)).toEqual(SCREENS);
    expect(STEPS.filter((s) => s.deny).map((s) => s.id)).toEqual(["reminder"]);
    for (const s of STEPS) expect(s.label.length, s.label).toBeLessThanOrEqual(9);
    // The finished frame: iOS, the reminder arrived, notifications allowed.
    expect(MOB_HOLD.initial).toEqual({ platform: "ios", step: "reminder", answer: "allow" });
    expect(MOB_HOLD.platforms.map((p) => p.id)).toEqual(["ios", "android"]);
  });

  it("keeps every caption short enough to read in one dwell, and none twice as long as another", () => {
    expect(captions).toHaveLength(6);
    for (const c of captions) {
      expect(c.length, c).toBeGreaterThanOrEqual(60);
      expect(c.length, c).toBeLessThanOrEqual(100);
      expect(holdFor(c), c).toBeLessThanOrEqual(5000);
    }
    const lengths = captions.map((c) => c.length);
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThanOrEqual(1.6);
  });

  it("travels only the drawing's edges, each from the phone, the daily job or a part the step already reached", () => {
    const journeys = STEPS.flatMap((s) => [{ id: s.id, hops: s.hops }, ...(s.deny ? [{ id: `${s.id} (denied)`, hops: s.deny.hops }] : [])]);
    for (const j of journeys) {
      const reached = new Set<string>(["phone", "jobs"]);
      for (const h of j.hops) {
        expect(EDGE_IDS, `${j.id}: ${h}`).toContain(h);
        const [from, to] = h.split("-");
        expect(reached.has(from), `${j.id}: ${h} before ${from}`).toBe(true);
        reached.add(to);
      }
    }
    for (const s of STEPS) for (const r of s.ring ?? []) expect(PART_IDS, `${s.id}: ${r}`).toContain(r);
  });

  it("talks to the parts the build spec lists, step by step", () => {
    expect(STEPS.map((s) => talkedTo(s.hops, s.ring))).toEqual(TALKS);
    expect(talkedTo(STEPS[4].deny!.hops)).toEqual(TALKS_DENIED);
  });

  it("names every hotspot by its label first, then where it goes", () => {
    const app = MOB_HOLD.app;
    const ctas = [app.signin.go, app.choose.go, app.pay.go, app.pay.back.ios, app.pay.back.android];
    for (const c of ctas) {
      expect(c.aria.startsWith(c.label), c.aria).toBe(true);
      expect(c.aria, c.aria).toContain(" — ");
    }
    expect(app.pay.back.ios.label).not.toBe(app.pay.back.android.label);
    expect(app.booked.allowAria.startsWith(app.booked.ask.ios.allow)).toBe(true);
    expect(app.booked.denyAria.startsWith(app.booked.ask.android.deny)).toBe(true);
    for (const aria of [app.booked.allowAria, app.booked.denyAria, app.lock.open]) expect(aria).toContain(" — ");
  });

  it("keeps the sample a sample: no digit, no brand, no business", () => {
    const text = strings([MOB_HOLD.app, STEPS.map((s) => [s.label, s.caption, s.deny?.caption])]);
    expect(text.length).toBeGreaterThan(40);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => s.includes(COMPANY.name) || /\bclients?\b/i.test(s))).toEqual([]);
    expect(MOB_HOLD.app.name).toBe("Your app");
    expect(MOB_HOLD.tag.startsWith("Sample")).toBe(true);
    // Said once, in the credits: the #hold sub and tag already call it a sample.
    expect(MOB_CREDITS.items.find((i) => i.term === "The sample app")!.detail).toContain("for no business in particular");
    expect(ALL.filter((s) => s.includes("for no business in particular")).length).toBeLessThanOrEqual(3);
  });

  it("names push as the one part beside the phone that isn't this platform's", () => {
    expect(MOB_HOLD.foot).toContain("except push");
    expect(PARTS.filter((p) => p.kind === "none").map((p) => p.id)).toEqual(["push"]);
  });

  it("never opens a caption with the label printed just before it", () => {
    for (const s of STEPS) {
      const first = s.label.split(" ")[0].toLowerCase();
      for (const c of [s.caption, s.deny?.caption ?? ""]) {
        expect(c.toLowerCase().startsWith(first), c).toBe(false);
        expect(c.toLowerCase().startsWith(s.id), c).toBe(false);
      }
    }
    // Step 5's captions open on "Later" or on notifications, never "Reminder".
    expect(STEPS[4].caption.startsWith("Reminder")).toBe(false);
  });

  it("marks the sample's declarations SAMPLE in the data module", () => {
    for (const name of ["SAMPLE_APP", "STEPS", "SAMPLES"]) {
      expect(SOURCE, name).toMatch(new RegExp(`^(?:export )?const ${name}\\b[^\\n]*= [[{] // SAMPLE\\b`, "m"));
    }
  });

  it("offers three routes to both platforms, naming each technology, every line OWNER", () => {
    const routes = MOB_HOLD.routes;
    expect(routes.items.map((r) => r.id)).toEqual(["native", "shared", "yours"]);
    const tools = routes.items.map((r) => r.tools).join(" · ");
    for (const t of ["Swift", "SwiftUI", "Kotlin", "Jetpack Compose", "React Native", "Expo", "Flutter"]) expect(named(t, tools), t).toBe(true);
    for (const s of [routes.lead, routes.foot, ...routes.items.flatMap((r) => [r.label, r.tools, r.body])]) {
      const at = linesOf(`"${s}"`);
      expect(at, s).toHaveLength(1);
      expect(at[0], s).toContain("// OWNER");
    }
  });

  describe(`its frame (phone-frame.ts)${waiting(FRAME_FILE)}`, () => {
    const at = (step: Hold["step"], answer: Answer | null = null): Hold => ({ platform: "android", step, answer, arrived: true });
    // The build spec's table (§4.2.6): each hotspot, where it goes from where, and the move it makes.
    const GO_TABLE: [GoId, Hold, Pick<Hold, "step" | "answer">, Move][] = [
      ["signin.go", at(0), { step: 1, answer: null }, "mob-forward"],
      ["choose.go", at(1), { step: 2, answer: null }, "mob-sheet-up"],
      ["pay.back", at(2), { step: 1, answer: null }, "mob-sheet-down"],
      ["pay.go", at(2), { step: 3, answer: null }, "mob-forward"],
      ["booked.allow", at(3), { step: 4, answer: "allow" }, "mob-lock"],
      ["booked.deny", at(3), { step: 4, answer: "deny" }, "mob-lock"],
      ["lock.open", at(4, "deny"), { step: 3, answer: "deny" }, "mob-unlock"],
    ];

    it.skipIf(!frameKit)("finishes on the lock screen, the reminder arrived, every step-5 edge on", () => {
      const { FINISHED, frameOf } = frameKit!;
      expect(FINISHED).toEqual({ platform: "ios", step: 4, answer: "allow", arrived: true });
      expect(STEP_IDS[FINISHED.step]).toBe(MOB_HOLD.initial.step);
      const frame = frameOf(STEPS, FINISHED);
      expect(frame).toMatchObject({ screen: "lock", answer: "allow", arrived: true, caption: 4 });
      expect(frame.hops).toEqual(STEPS[4].hops);
      for (const e of EDGE_IDS) expect(frame.edges[e], e).toBe(STEPS[4].hops.includes(e) ? "on" : "rest");
      for (const p of PART_IDS) expect(frame.parts[p], p).toBe(TALKS[4].includes(p) ? "lit" : "rest");
      expect(frame.talks).toEqual(TALKS[4]);
    });

    it.skipIf(!frameKit)("routes each step's parts on the way, lights them once it arrives, and talks to the listed parts", () => {
      const { frameOf, talksOf } = frameKit!;
      STEPS.forEach((step, k) => {
        const answers: (Answer | null)[] = k === 4 ? ["allow", "deny"] : [null];
        for (const answer of answers) {
          const denied = answer === "deny";
          const hops = denied ? step.deny!.hops : step.hops;
          const talks = denied ? TALKS_DENIED : TALKS[k];
          for (const arrived of [false, true]) {
            const where = `step ${k + 1}${denied ? " denied" : ""}${arrived ? " arrived" : ""}`;
            const frame = frameOf(STEPS, { platform: "ios", step: k as Hold["step"], answer, arrived });
            expect(frame.screen, where).toBe(step.screen);
            expect(frame.caption, where).toBe(denied ? 5 : k);
            expect(frame.hops, where).toEqual(hops);
            expect(frame.talks, where).toEqual(talks);
            expect(talksOf(STEPS, { step: k as Hold["step"], answer }), where).toEqual(talks);
            for (const e of EDGE_IDS) expect(frame.edges[e], `${where}: ${e}`).toBe(hops.includes(e) ? (arrived ? "on" : "route") : "rest");
            for (const p of PART_IDS) expect(frame.parts[p], `${where}: ${p}`).toBe(talks.includes(p) ? (arrived ? "lit" : "route") : "rest");
          }
        }
      });
      // Booked, not yet answered: the permission dialog is up.
      expect(frameOf(STEPS, { platform: "android", step: 3, answer: null, arrived: true })).toMatchObject({ screen: "booked", answer: null });
    });

    it.skipIf(!frameKit)("moves each hotspot as the table says, on the same platform", () => {
      const { GO } = frameKit!;
      expect(Object.keys(GO).sort()).toEqual(GO_TABLE.map((g) => g[0]).sort());
      for (const [id, from, want, move] of GO_TABLE) {
        const { next, move: made } = GO[id](from);
        expect(made, id).toBe(move);
        expect(next, id).toMatchObject({ platform: from.platform, ...want });
      }
    });

    it.skipIf(!frameKit)("gives a rail pick the hotspot's own move for its pair, and forward or back for any other", () => {
      const { moveBetween } = frameKit!;
      const pairs = new Map(GO_TABLE.map(([, from, want, move]) => [`${from.step}>${want.step}`, move]));
      for (let a = 0; a < 5; a++) {
        for (let b = 0; b < 5; b++) {
          if (a === b) continue;
          const from = at(a as Hold["step"], a === 4 ? "allow" : null);
          const to = at(b as Hold["step"], b === 4 ? "allow" : null);
          const want = pairs.get(`${a}>${b}`) ?? (b > a ? "mob-forward" : "mob-back");
          expect(moveBetween(from, to), `${a + 1} → ${b + 1}`).toBe(want);
        }
      }
    });
  });

  describe(`its drawing (parts-geometry.ts)${waiting(GEOMETRY_FILE)}`, () => {
    // The build spec's grid (§4.2.4): three columns of cards 148u wide, three rows 64u tall.
    const GRID: Record<PartId, readonly [number, number]> = {
      signin: [34, 24], live: [222, 24], jobs: [410, 24],
      api: [34, 168], data: [222, 168], push: [410, 168],
      payments: [34, 312], files: [222, 312], messages: [410, 312],
    };

    it.skipIf(!geometryKit)("lays nine cards, one per part, inside the drawing, overlapping none", () => {
      const d = drawing();
      expect(d.view).toEqual({ w: 600, h: 416 });
      expect(d.port).toEqual([0, 200]);
      expect(Object.keys(d.cards).sort()).toEqual([...PART_IDS].sort());
      for (const p of PART_IDS) {
        const b = d.cards[p];
        expect(sides(b), p).toEqual({ l: GRID[p][0], t: GRID[p][1], r: GRID[p][0] + 148, b: GRID[p][1] + 64 });
        expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= d.view.w && b.y + b.h <= d.view.h, `${p} inside the drawing`).toBe(true);
        for (const q of PART_IDS) if (q !== p) expect(overlap(sides(b), sides(d.cards[q])), `${p} over ${q}`).toBe(false);
      }
    });

    it.skipIf(!geometryKit)("draws every edge of the journey, and only those", () => {
      const d = drawing();
      expect(Object.keys(d.edges).sort()).toEqual([...EDGE_IDS].sort());
      const hops = new Set(STEPS.flatMap((s) => [...s.hops, ...(s.deny?.hops ?? [])]));
      for (const h of hops) expect(Object.keys(d.edges), h).toContain(h);
      // Every edge but the files' is travelled; that one is drawn so the part isn't left alone.
      expect(EDGE_IDS.filter((e) => !hops.has(e))).toEqual(["data-files"]);
    });

    it.skipIf(!geometryKit)("starts and ends every edge on its own cards, or the phone's port, level or upright all the way", () => {
      const d = drawing();
      const end = (id: string) => (id === "phone" ? null : sides(d.cards[id as PartId]));
      for (const e of EDGE_IDS) {
        const line = d.edges[e];
        const [from, to] = e.split("-");
        for (const [pt, id] of [[line[0], from], [line.at(-1)!, to]] as const) {
          const box = end(id);
          if (box) expect(onBorder(pt, box), `${e} on ${id}`).toBe(true);
          else expect(pt, `${e} at the port`).toEqual(d.port);
        }
        for (let k = 1; k < line.length; k++) expect(line[k][0] === line[k - 1][0] || line[k][1] === line[k - 1][1], e).toBe(true);
      }
    });

    it.skipIf(!geometryKit)("draws each edge as its polyline with the corners rounded, and keeps it 4u clear of every other card", () => {
      const d = drawing();
      for (const e of EDGE_IDS) {
        const line = d.edges[e];
        const pts = pointsOfD(d.pathOf(e));
        expect(pts[0], e).toEqual(line[0]);
        expect(pts.at(-1), e).toEqual(line.at(-1));
        const samples = along(pts);
        for (const s of samples) expect(s[0] >= 0 && s[0] <= d.view.w && s[1] >= 0 && s[1] <= d.view.h, `${e} inside`).toBe(true);
        const ends = new Set(e.split("-"));
        for (const p of PART_IDS) {
          if (ends.has(p)) continue;
          expect(Math.min(...samples.map((s) => gap(s, sides(d.cards[p])))), `${e} runs into ${p}`).toBeGreaterThanOrEqual(4);
        }
      }
    });

    it.skipIf(!geometryKit)("shares a run only on the phone's bus and its port, and crosses nothing", () => {
      const d = drawing();
      for (const a of EDGE_IDS) {
        for (const b of EDGE_IDS) {
          if (a >= b) continue;
          for (const sa of runs(d.edges[a])) {
            for (const sb of runs(d.edges[b])) {
              expect(crosses(sa, sb), `${a} crosses ${b}`).toBe(false);
              const both = shared(sa, sb);
              if (!both) continue;
              const onBus = both[0][0] === 10 && both[1][0] === 10;
              const onPort = both[0][1] === 200 && both[1][1] === 200 && Math.max(both[0][0], both[1][0]) <= 10;
              expect(onBus || onPort, `${a} and ${b} share ${JSON.stringify(both)}`).toBe(true);
            }
          }
        }
      }
    });
  });
});

/* ---------- the drawing's measures (the Automations test's, over any polyline) ---------- */

type Pt = readonly [number, number];
type Box = { l: number; t: number; r: number; b: number };
type Rect = { x: number; y: number; w: number; h: number };
type Run = readonly [Pt, Pt];

const sides = (b: Rect): Box => ({ l: b.x, t: b.y, r: b.x + b.w, b: b.y + b.h });

/**
 * parts-geometry.ts read into the shape these tests measure: the view,
 * each part's card, the phone's port, each edge's polyline ("phone" at
 * one end meaning the port), and each edge's drawn `d`. The one place
 * that knows the module's names.
 */
function drawing(): {
  view: { w: number; h: number };
  cards: Record<PartId, Rect>;
  port: Pt;
  edges: Record<EdgeId, readonly Pt[]>;
  pathOf: (e: EdgeId) => string;
} {
  const g = geometryKit!;
  return { view: g.VIEW, cards: g.BOXES, port: [g.PORT.x, g.PORT.y], edges: g.EDGES, pathOf: (e: EdgeId) => g.edgePath(e) };
}

/**
 * An SVG path's `d`, as parts-geometry.ts writes it (`M`, `L`, and a
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
/** A polyline's runs, each from one corner to the next. */
const runs = (pts: readonly Pt[]): Run[] => pts.slice(1).map((p, k) => [pts[k], p] as const);
/** Whether a level run and an upright one cross at a point inside both: a junction at either's end is not a crossing. */
function crosses([a0, a1]: Run, [b0, b1]: Run): boolean {
  const aLevel = a0[1] === a1[1];
  if (aLevel === (b0[1] === b1[1])) return false;
  const [h, v] = aLevel ? [[a0, a1], [b0, b1]] : [[b0, b1], [a0, a1]];
  const within = (t: number, p: number, q: number) => t > Math.min(p, q) && t < Math.max(p, q);
  return within(v[0][0], h[0][0], h[1][0]) && within(h[0][1], v[0][1], v[1][1]);
}
/** The stretch two runs share on one line, or null. */
function shared([a0, a1]: Run, [b0, b1]: Run): Run | null {
  for (const axis of [0, 1] as const) {
    const other = axis === 0 ? 1 : 0;
    if (a0[axis] !== a1[axis] || b0[axis] !== b1[axis] || a0[axis] !== b0[axis]) continue;
    const lo = Math.max(Math.min(a0[other], a1[other]), Math.min(b0[other], b1[other]));
    const hi = Math.min(Math.max(a0[other], a1[other]), Math.max(b0[other], b1[other]));
    if (hi <= lo) return null;
    return axis === 0 ? [[a0[0], lo], [a0[0], hi]] : [[lo, a0[1]], [hi, a0[1]]];
  }
  return null;
}

describe("the parts", () => {
  it("lists nine, in the one order every section uses, each within its caps", () => {
    expect(PARTS.map((p) => p.id)).toEqual(PART_IDS);
    for (const p of PARTS) {
      expect(p.label.length, p.id).toBeLessThanOrEqual(16);
      expect(p.datum.length, p.id).toBeLessThanOrEqual(16);
      expect(p.title.length, p.id).toBeLessThanOrEqual(28);
      expect(p.forApp.length, p.id).toBeLessThanOrEqual(140);
      expect(p.ours.length, p.id).toBeLessThanOrEqual(300);
      expect(Object.keys(CHECK_KINDS), p.id).toContain(p.check.kind);
      if (p.check.kind === "site") expect(p.check.href, p.id).toBeTruthy();
    }
  });

  it("says push is the one part this platform lacks, once, where the part is", () => {
    expect(PARTS.filter((p) => p.kind === "none").map((p) => p.id)).toEqual(["push"]);
    const push = PARTS.find((p) => p.id === "push")!;
    expect(push.ours.startsWith("Not on ours")).toBe(true);
    expect(push.check.kind).toBe("handover");
    const faq = new Set(strings(MOB_FAQ.items));
    expect([...new Set(ALL.filter((s) => !faq.has(s) && s.includes("Not on ours")))]).toEqual([push.ours]);
    // #server's sub counts them: "eight of these nine".
    const does = PARTS.filter((p) => p.kind === "does").length;
    expect(MOB_SERVER.sub).toContain(`runs ${word(does)} of these ${word(PARTS.length)} parts`);
    expect(`${word(does)} of ${word(PARTS.length)}`).toBe("eight of nine");
  });

  it("names each part's kind as #hold, #kinds and #server all do", () => {
    const kinds = { does: "Runs here", none: "Built for yours" };
    expect(MOB_HOLD.kinds).toEqual(kinds);
    expect(MOB_KINDS.ours).toEqual(kinds);
    expect(MOB_SERVER.kinds).toEqual(kinds);
  });
});

describe("#kinds", () => {
  const FEATURE_IDS = FEATURES.map((f) => f.id);
  const journey = new Set(STEPS.flatMap((s) => [...talkedTo(s.hops, s.ring), ...talkedTo(s.deny?.hops ?? [])]));

  it("has one sample for each of six kinds of app and both audiences, in the controls' order", () => {
    expect(MOB_KINDS.kinds.map((k) => k.id)).toEqual(KIND_IDS);
    expect(MOB_KINDS.sides.map((s) => s.id)).toEqual(SIDE_IDS);
    expect(SAMPLES).toHaveLength(12);
    expect(SAMPLES.map((s) => s.id)).toEqual(KIND_IDS.flatMap((k) => SIDE_IDS.map((s) => `${k}-${s}`)));
    for (const s of SAMPLES) expect(s.id).toBe(`${s.kind}-${s.side}`);
    expect(new Set(FEATURE_IDS).size).toBe(12);
  });

  it("gives every sample the fixed shape the room draws: five screens, four needs, the three parts every app has", () => {
    for (const s of SAMPLES) {
      expect(s.screens, s.id).toHaveLength(5);
      for (const x of s.screens) {
        expect(x.blocks.length >= 1 && x.blocks.length <= 2, `${s.id}: ${x.name}`).toBe(true);
        expect(x.name.length, `${s.id}: ${x.name}`).toBeLessThanOrEqual(18);
      }
      expect(s.phone, s.id).toHaveLength(4);
      expect(new Set(s.phone.map((p) => p.id)).size, s.id).toBe(4);
      expect(s.phone.some((p) => p.need === "core"), s.id).toBe(true);
      for (const p of s.phone) {
        expect(FEATURE_IDS, `${s.id}: ${p.id}`).toContain(p.id);
        expect(p.why.length, `${s.id}: ${p.why}`).toBeLessThanOrEqual(56);
      }
      for (const p of ["signin", "api", "data"] as const) expect(s.parts, s.id).toContain(p);
      // In PARTS order, each once: the rows are drawn in that order.
      expect(s.parts, s.id).toEqual(PART_IDS.filter((p) => s.parts.includes(p)));
      expect(GATE_IDS, s.id).toContain(s.rule);
      expect(s.title.length, s.id).toBeLessThanOrEqual(50);
      expect(s.who.length, s.id).toBeLessThanOrEqual(60);
      expect(s.ai.length, s.id).toBeLessThanOrEqual(80);
      expect(s.hard.length, s.id).toBeLessThanOrEqual(130);
    }
  });

  it("keeps the samples samples: no digit, no brand, no business, no client", () => {
    const text = strings(SAMPLES);
    expect(text.length).toBeGreaterThan(150);
    expect(text.filter((s) => /\d/.test(s))).toEqual([]);
    for (const mark of REGISTRY) expect(text.filter((s) => named(mark, s)), mark).toEqual([]);
    expect(text.filter((s) => /\bclients?\b/i.test(s) || s.includes(COMPANY.name))).toEqual([]);
    expect(MOB_KINDS.foot).toContain("written for this page");
    // The caveat's detail is the credits' ("for no business in particular"), not the foot's too.
    expect(MOB_KINDS.foot).not.toContain("for no business in particular");
    expect(MOB_CREDITS.items.find((i) => i.term === "The samples")!.detail).toContain("for no business in particular");
    expect(MOB_KINDS.tag.startsWith("Sample")).toBe(true);
    expect(SOURCE).toMatch(/^export const SAMPLES: readonly Sample\[\] = \[ \/\/ SAMPLE/m);
  });

  it("opens on the phone's own sample, which uses every part the phone's journey talks to", () => {
    expect(MOB_KINDS.initial).toEqual({ kind: "bookings", side: "customers" });
    const first = SAMPLES.find((s) => s.id === "bookings-customers")!;
    for (const p of ["payments", "jobs", "messages", "push"] as const) expect(first.parts).toContain(p);
    expect([...journey].filter((p) => !first.parts.includes(p))).toEqual([]);
  });

  it("links each sample's rule to a gate card, in the gate's own words", () => {
    expect(MOB_KINDS.gates).toEqual(GATES.map(({ id, title }) => ({ id, title })));
    for (const s of SAMPLES) expect(GATES.some((g) => g.id === s.rule), s.id).toBe(true);
  });
});

describe("#path", () => {
  const path_ = MOB_PATH.path;
  const lineOf = (text: string) => linesOf(`"${text}"`);
  /** A store line's mark in the data module: its kind and the page it names. */
  const markOf = (line: string) => line.match(/\/\/ (?:OWNER; )?(STORE|STORE-SUMMARY) (https:\/\/\S+)/);
  const onGoogle = (href: string) => /^https:\/\/(?:support|play)\.google\.com\//.test(href);
  // The words quoted from the stores' own pages (spec, "Store facts"), pinned: a quote must be verbatim.
  const VERBATIM: Record<string, string> = {
    "Apple App Review Guidelines 5.1.1(v)": "If your app supports account creation, you must also offer account deletion within the app.",
    "Apple App Review Guidelines 2.1(a)": "include demo account info (and turn on your back-end service!) if your app includes a login.",
    "Apple App Review Guidelines 4.2": "Your app should include features, content, and UI that elevate it beyond a repackaged website.",
    "Apple App Review Guidelines 5.1.1(i)":
      "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner.",
    "Google Play Google Play’s billing system": "Google Play’s billing system is only for digital items.",
  };
  const SELLER = "The legal entity name will appear as the seller for apps you distribute.";
  const storeLines = GATES.flatMap((g) => (g.google ? [g.apple, g.google] : [g.apple]));

  it("walks seven stations, forking at the beta and joining again for updates", () => {
    expect(path_.stations.map((s) => s.id)).toEqual(["prototype", "design", "build", "beta", "review", "live", "updates"]);
    expect(path_.stations.map((s) => s.n)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    for (const s of path_.stations) {
      expect(s.label.length, s.id).toBeLessThanOrEqual(10);
      expect(s.long.length, s.id).toBeLessThanOrEqual(34);
      expect(s.at, s.id).toBeGreaterThanOrEqual(0.02);
      expect(s.at, s.id).toBeLessThanOrEqual(0.99);
      for (const lane of Object.values(s.lanes ?? {})) expect(lane.length, `${s.id}: ${lane}`).toBeLessThanOrEqual(14);
    }
    expect(path_.stations.filter((s) => s.lanes).map((s) => s.id)).toEqual(["beta", "review", "live"]);
    path_.stations.slice(1).forEach((s, k) => expect(s.at, s.id).toBeGreaterThan(path_.stations[k].at));
    expect(path_.gates.map((g) => [g.id, g.after])).toEqual([["yes", "design"], ["testers", "beta"], ["review", "review"]]);
    expect(path_.beta.links.map((l) => l.href)).toEqual(["https://developer.apple.com/testflight/", expect.stringMatching(/^https:\/\/support\.google\.com\//)]);
  });

  it("keeps each stage card to the SaaS grammar and its caps", () => {
    expect(MOB_PATH.stages.map((s) => s.id)).toEqual(["design", "build", "publish"]);
    for (const s of MOB_PATH.stages) expect(s.body.length, s.id).toBeLessThanOrEqual(240);
  });

  it("lists the six gates the stores keep, each within its caps", () => {
    expect(GATES.map((g) => g.id)).toEqual(GATE_IDS);
    for (const g of GATES) {
      expect(g.title.length, g.id).toBeLessThanOrEqual(60);
      expect(g.side.text.length, g.id).toBeLessThanOrEqual(130);
      expect(g.apple.store, g.id).toBe("Apple");
      if (g.google) expect(g.google.store, g.id).toBe("Google Play");
      for (const l of g.google ? [g.apple, g.google] : [g.apple]) {
        expect(l.text.length, `${g.id}: ${l.ref}`).toBeLessThanOrEqual(170);
        // A quote's marks are the component's (<blockquote cite>), never the text's.
        expect(l.text, `${g.id}: ${l.ref}`).not.toMatch(/["“”‘']/);
      }
      expect(g.apple.href.startsWith("https://developer.apple.com/"), g.id).toBe(true);
    }
  });

  it("says “On ours” beside a store rule only where this file holds it to the code", () => {
    // The delete gate: held above, to the account route, the settings page and the deletion's order.
    expect(GATES.filter((g) => g.side.kind === "ours").map((g) => g.id)).toEqual(["delete"]);
    // The privacy policy is linked from the site's footer and the sign-up form, not from inside the signed-in
    // product, so the privacy gate promises it for yours, at the owner's word, and links nowhere of ours.
    const privacy = GATES.find((g) => g.id === "privacy")!;
    expect(privacy.side.kind).toBe("yours");
    expect(privacy.side.link).toBeUndefined();
    expect(linesOf(`"${privacy.side.text}"`)).toHaveLength(1);
    expect(linesOf(`"${privacy.side.text}"`)[0]).toContain("// OWNER");
  });

  it("quotes only pages it read, word for word, and summarises every Google Play policy page until it is re-read", () => {
    const quoted = storeLines.filter((l) => l.quote);
    expect(quoted.map((l) => `${l.store} ${l.ref}`).sort()).toEqual(Object.keys(VERBATIM).sort());
    for (const l of quoted) {
      expect(l.text, l.ref).toBe(VERBATIM[`${l.store} ${l.ref}`]);
      expect(onGoogle(l.href), l.ref).toBe(false);
    }
    expect(storeLines.filter((l) => onGoogle(l.href)).length).toBeGreaterThanOrEqual(3);
  });

  it("marks every store line in the data module with the page it came from", () => {
    for (const l of storeLines) {
      const at = lineOf(l.text);
      expect(at, l.ref).toHaveLength(1);
      const mark = markOf(at[0]);
      expect(mark, l.ref).not.toBeNull();
      expect(mark![2], l.ref).toBe(l.href);
      expect(mark![1], l.ref).toBe(onGoogle(l.href) ? "STORE-SUMMARY" : "STORE");
    }
    // Every store page the module links to is marked on its line, and a Google Play policy page as a summary.
    const literal = /(?:=|href:)\s*"(https:\/\/(?:developer\.apple\.com|developer\.android\.com|support\.google\.com|play\.google\.com|apps\.apple\.com)\/[^"]*)"/;
    const named_ = LINES.filter((l) => literal.test(l));
    expect(named_.length).toBeGreaterThanOrEqual(8);
    for (const line of named_) {
      const url = line.match(literal)![1];
      const mark = markOf(line);
      expect(mark, url).not.toBeNull();
      expect(mark![2], url).toBe(url);
      expect(mark![1], url).toBe(onGoogle(url) ? "STORE-SUMMARY" : "STORE");
    }
  });

  it("says whose name each thing is in, the seller in Apple's own words, every promise OWNER", () => {
    const own = MOB_PATH.own;
    expect(own.rows.map((r) => r.id)).toEqual(["apple", "google", "seller", "code", "signing", "hosting"]);
    expect(new Set(own.rows.map((r) => r.id)).size).toBe(own.rows.length);
    for (const r of own.rows) {
      expect(Object.keys(own.states), r.id).toContain(r.whose);
      expect(r.how.length, r.id).toBeLessThanOrEqual(130);
      expect(r.how, r.id).not.toMatch(/["“”]/);
    }
    const seller = own.rows.find((r) => r.id === "seller")!;
    expect(seller.quote).toBe(true);
    expect(seller.how).toBe(SELLER);
    expect(own.rows.filter((r) => r.quote).map((r) => r.id)).toEqual(["seller"]);
    for (const r of own.rows) {
      const at = linesOf(`id: "${r.id}", what: "${r.what}"`);
      expect(at, r.id).toHaveLength(1);
      if (["apple", "google", "code", "signing", "hosting"].includes(r.id)) expect(at[0], r.id).toContain("// OWNER");
      // A row that links to a store's page carries that page's mark, as a store line does.
      if (r.link && /^https:/.test(r.link.href)) {
        const mark = markOf(at[0]);
        expect(mark?.[2], r.id).toBe(r.link.href);
        expect(mark?.[1], r.id).toBe(onGoogle(r.link.href) ? "STORE-SUMMARY" : "STORE");
      }
    }
  });

  it("states no store or platform rule it doesn't source: each sentence links to the store's page or to a gate", () => {
    // A sentence naming a store or a platform with what it charges, allows, must or requires states a
    // rule. The credits say each is linked where it's used, so each sits in a record that links to the
    // store's own page (marked above) or to a gate card; a list of plain strings links nowhere.
    const WHO = /\b(?:Apple|Google(?: Play)?|iOS|Android|(?:the|both|each) (?:stores?|platforms?))\b/i;
    const RULE = /\b(?:charge[sd]?|allow(?:s|ed)?|must|requires?|required)\b/i;
    const rule = (s: string) => WHO.test(s) && RULE.test(s);
    // The two it once printed with no source: the regexes catch them.
    expect(rule("The stores charge their own developer fees and take a share of what’s sold through their checkout.")).toBe(true);
    expect(rule("Following a route with the phone locked, which each platform allows only when the app says why.")).toBe(true);
    const sourced = (h: string) => /^https:\/\/(?:developer\.apple\.com|developer\.android\.com|support\.google\.com|play\.google\.com|apps\.apple\.com)\//.test(h) || h === "#gates" || h.startsWith("#gate-");
    const found: { s: string; links: string[] }[] = [];
    const check = (text: string, links: string[]) => {
      for (const s of split(plain(text))) if (rule(s)) found.push({ s, links });
    };
    const visit = (v: unknown) => {
      if (Array.isArray(v)) {
        for (const x of v) if (typeof x === "string") check(x, []); else visit(x);
      } else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        // The record's own link, and those of the links and checks printed with it.
        const links = [o, ...Object.values(o).filter((x) => x && typeof x === "object" && !Array.isArray(x))]
          .map((x) => (x as Record<string, unknown>).href)
          .filter((h): h is string => typeof h === "string");
        for (const x of Object.values(o)) if (typeof x === "string") check(x, links); else visit(x);
      }
    };
    visit(PAGE);
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.filter((f) => !f.links.some(sourced)).map((f) => f.s)).toEqual([]);
  });

  it("says each stage's point once: the stores review releases, and the beta line has the testers", () => {
    const [design, build, publish] = MOB_PATH.stages;
    expect(design.id).toBe("design");
    expect(build.body).not.toMatch(/\btesters\b/);
    expect(MOB_PATH.path.beta.text).toContain("every build goes to your testers");
    expect(publish.body).toContain("review each release");
    expect(MOB_TERMS.columns.find((c) => c.id === "upfront")!.items).toContain("Apple and Google review every release against their own rules. We build to them; the decision is theirs.");
    // A website that would do: said in the terms and the FAQ (which stands alone as structured data), not on the gate too.
    expect(ALL.filter((s) => /say so on the call/.test(s))).toHaveLength(2);
    expect(GATES.find((g) => g.id === "website")!.side.text).not.toMatch(/on the call/);
  });

  describe(`its markup${waiting(`${DIR}/path.tsx`, `${DIR}/path-figure.tsx`)}`, () => {
    it.skipIf(!has(`${DIR}/path.tsx`))("gives the gates, each gate card, the own table and the published slot their anchors", () => {
      const src = read(`${DIR}/path.tsx`);
      expect(src).toContain('id="gates"');
      expect(src).toMatch(/id=\{`gate-\$\{[^}]+\}`\}/);
      expect(src).toContain('id="own"');
      expect(src).toContain('id="published"');
    });

    it.skipIf(!has(`${DIR}/path-figure.tsx`))("pops each station on its figure after its stroke reaches it, in the stations' order", () => {
      // The figure's strokes (spec §4.4): the stem to x 480, the fork and both lanes to x 900, the join and the end to 990.
      const slices = figureSlices(read(`${DIR}/path-figure.tsx`));
      const strokes: [number, number, number, number][] = [
        [20, 480, 0, 0.3],
        [480, 900, 0.3, 0.45],
        [900, 990, 0.75, 0.15],
      ];
      const offsets = path_.stations.map((s) => slices[s.id]);
      path_.stations.forEach((s, k) => {
        const o = offsets[k];
        expect(o, s.id).toBeTypeOf("number");
        const x = s.at * 1000;
        const [x0, x1, from, span] = strokes.find(([a, b]) => x >= a && x <= b)!;
        const reached = from + (span * (x - x0)) / (x1 - x0);
        // It pops as the line gets there: at most a slice's width either side of it.
        expect(Math.abs(o - reached), `${s.id}: --o ${o}, reached at ${reached.toFixed(3)}`).toBeLessThanOrEqual(0.05);
        if (k > 0) expect(o, s.id).toBeGreaterThan(offsets[k - 1]);
      });
    });
  });
});

/**
 * The station offsets `path-figure.tsx` sets inline (`--o`), read from its
 * `const SLICES` (up to the first line that closes it): each station id
 * with the first number after it on its line.
 */
function figureSlices(src: string): Record<string, number> {
  const at = src.indexOf("const SLICES");
  if (at < 0) throw new Error("path-figure.tsx has no const SLICES");
  const end = src.slice(at).search(/\n[}\]]/);
  const body = src.slice(at, end < 0 ? undefined : at + end + 2);
  const out: Record<string, number> = {};
  for (const m of body.matchAll(/\b(prototype|design|build|beta|review|live|updates)\b[^\d\n]*?([\d.]+)/g)) out[m[1]] ??= Number(m[2]);
  return out;
}

/*
 * Third-party names a page like this could print: the Automations test's
 * registry, with the stores' and the platforms' own names. Each one
 * printed must be credited in a line that says whose trademark it is,
 * and none may appear in a sample.
 */
const REGISTRY = [
  "Anthropic", "Claude", "Google", "Gmail", "Android", "Apple", "iOS", "Microsoft", "Amazon", "AWS", "GitHub",
  "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Supabase", "Postgres", "PostgreSQL", "Twilio", "Telnyx",
  "Vercel", "Next.js", "Node.js", "React", "Fly.io", "Slack", "Upstash", "Redis", "WhatsApp",
  "Zapier", "Make", "n8n", "HubSpot", "Salesforce", "Xero", "QuickBooks", "Shopify", "DocuSign",
  "iPhone", "App Store", "App Store Connect", "TestFlight", "Siri", "Swift", "SwiftUI", "Sign in with Apple", "Face ID", "Apple Pay",
  "Safari", "Google Play", "Google Pay", "Play Console", "Jetpack Compose", "Flutter", "Kotlin", "React Native", "Expo", "Firebase",
  "D-U-N-S", "Material Design", "Human Interface Guidelines", "Bluetooth",
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

  it("prints no percentage, and a plus only on the floors: the accreditations and the API routes", () => {
    expect(ALL.filter((s) => /%/.test(s))).toEqual([]);
    const plus = ALL.flatMap((s) => s.match(/\d+\+/g) ?? []);
    expect(plus).toContain(ACC);
    expect(plus).toContain(`${FACTS.routeHandlers}+`);
    for (const p of plus) expect([ACC, `${FACTS.routeHandlers}+`], p).toContain(p);
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
    expect(ALL.filter((s) => /certification/i.test(s))).toEqual([MOB_TEAM.accreditations.isnt]);
  });

  it("names only the grantors in a sentence about grants, and Anthropic only beside Claude or the accreditations", () => {
    const COMPANIES = ["Anthropic", "Cartesia", "ElevenLabs", "OpenAI", "Stripe", "SmartBill", "Twilio", "Supabase", "Vercel", "Google", "Apple"];
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
    for (const text of [MOB_HERO.sub, MOB_META.description]) {
      expect(text).toContain(`${ACC} `);
      expect(text).toContain(ACCREDITATIONS.issuer);
      for (const g of GRANTORS) expect(text).toContain(g);
    }
    expect(ACCREDITATIONS.holders).toBe("personal");
    const counted = ALL.filter((s) => /accreditation/i.test(s) && /\d/.test(s));
    expect(counted.length).toBeGreaterThan(0);
    for (const s of counted) expect(s).toContain(ACC);
  });

  it("implies no store launch of ours while no app is named", () => {
    expect(PUBLISHED_APPS).toBeNull();
    const past =
      /\bwe(?:’ve| have)? (?:published|launched|shipped|released)\b|\b(?:our|these) apps\b|\bapps? we(?:’ve| have)? (?:built|published|shipped)\b|\btrack record\b|\blive in the (?:App Store|Google Play)\b|\bratings?\b|\bdownloads?\b|\bstars?\b|\b(?:featured|top-rated|best-?selling)\b|\bin the stores already\b|work like yours/i;
    // The credits' "What isn’t here" says what the page leaves out, by name.
    const isnt = MOB_CREDITS.items.find((i) => i.term === "What isn’t here")!;
    expect(isnt.detail).toMatch(past);
    expect(ALL.filter((s) => s !== isnt.detail && past.test(s))).toEqual([]);
  });

  it("says every publish or launch of the reader's build, in a sentence about it", () => {
    const about = /\b(?:publish|launch)(?:ed|es|ing)?\b/i;
    const theirs = /\byour\b|\byours\b|\bboth (?:app )?stores\b|\beach store\b/i;
    const found = [...new Set(ALL.flatMap(split))].filter((s) => s.split(/\s+/).length >= 4 && about.test(s));
    expect(found.length).toBeGreaterThanOrEqual(4);
    // The menu's own words (lib/site.ts, read, never retyped): what we do, not something done.
    expect(found.filter((s) => !theirs.test(s))).toEqual([ITEM.description]);
  });

  it("keeps every owner-stated line marked in the data module", () => {
    // The build spec's sign-off list (§9.1, §7.1), each at its words.
    for (const words of [
      "Any app, for iOS and Android. We already run",
      "iOS and Android apps of any kind, for any business.",
      "whatever technology the product calls for",
      "Not just phone agents.",
      "chosen with you, never imposed",
      "Developer accounts with Apple and Google in your company’s name",
      "The code for the apps and the server, with tests",
      "Both apps are published from developer accounts in your company’s name.",
      "Yours sends push too, through Apple’s and Google’s own push services",
      "the crash reports both stores keep are watched",
      "Yours gets its own, built with your app.",
      "No. We build whatever app your business needs",
      "and builds apps of any kind, for any business.",
      "the same team builds those too",
      "not because voice is all we build",
    ]) {
      const at = linesOf(words);
      expect(at.length, words).toBeGreaterThan(0);
      for (const line of at) expect(line, words).toContain("// OWNER");
      expect(ALL.some((s) => s.includes(words)), words).toBe(true);
    }
  });

  it("marks OWNER every line that names a technology we'd build in", () => {
    const TECH = ["Swift", "SwiftUI", "Kotlin", "Jetpack Compose", "React Native", "Expo", "Flutter"];
    const naming = inRecords([MOB_META, ...Object.values(SECTIONS)]).filter(({ s }) => TECH.some((t) => named(t, s)));
    expect(naming.length).toBeGreaterThanOrEqual(3);
    for (const { s } of naming) {
      const at = linesOf(s.slice(0, 40));
      expect(at, s).toHaveLength(1);
      expect(at[0], s).toContain("// OWNER");
    }
  });
});

describe("the owner switch", () => {
  const FIXTURE: readonly PublishedApp[] = [
    {
      name: "Larch",
      what: "Bookings for a chain of studios.",
      appStore: { label: "Larch on the App Store", href: "https://apps.apple.com/app/larch/id100000001" },
      googlePlay: { label: "Larch on Google Play", href: "https://play.google.com/store/apps/details?id=example.larch" },
    },
    {
      name: "Juniper",
      what: "Routes and proof of delivery for drivers.",
      appStore: null,
      googlePlay: { label: "Juniper on Google Play", href: "https://play.google.com/store/apps/details?id=example.juniper" },
    },
  ];
  const named_ = publishedCopy(FIXTURE, MOB_BASE);
  const names = listJoin(FIXTURE.map((a) => a.name));

  it("changes nothing while no app is named", () => {
    expect(publishedCopy(null, MOB_BASE)).toBe(MOB_BASE);
    expect(MOB_HERO).toBe(MOB_BASE.hero);
    expect(MOB_PATH).toBe(MOB_BASE.path);
    expect(MOB_CHECKS).toBe(MOB_BASE.checks);
    expect(MOB_FAQ).toBe(MOB_BASE.faq);
    expect(MOB_CREDITS).toBe(MOB_BASE.credits);
    expect(MOB_PATH.published).toBeUndefined();
  });

  it("swaps the hero's third piece of evidence, and only that", () => {
    const { proof, ...rest } = named_.hero;
    const { proof: base, ...baseRest } = MOB_BASE.hero;
    expect(rest).toEqual(baseRest);
    expect(proof[0]).toBe(base[0]);
    expect(proof[1]).toBe(base[1]);
    expect(proof[2]).toMatchObject({ label: "Published", term: names, href: "#published" });
  });

  it("points stage 03 at the first listing, and lists every app with every link", () => {
    const stages = named_.path.stages;
    MOB_BASE.path.stages.forEach((s, k) => {
      if (s.id !== "publish") expect(stages[k], s.id).toBe(s);
    });
    const publish = stages.find((s) => s.id === "publish")!;
    const base = MOB_BASE.path.stages.find((s) => s.id === "publish")!;
    expect({ ...publish, published: undefined, check: base.check }).toEqual(base);
    expect(publish.ours).toBe(base.ours);
    expect(publish.published).toContain(names);
    for (const s of stages) for (const a of FIXTURE) expect(s.ours ?? "", s.id).not.toContain(a.name);
    expect(publish.check).toMatchObject({ kind: "site", href: FIXTURE[0].appStore!.href });
    expect(named_.path.published!.apps).toEqual(
      FIXTURE.map((a) => ({ name: a.name, what: a.what, links: [a.appStore, a.googlePlay].filter((l) => l !== null) })),
    );
    expect(named_.path.gates).toBe(MOB_BASE.path.gates);
    expect(named_.path.own).toBe(MOB_BASE.path.own);
  });

  it("puts a published row first in the checks, one sentence in front of the FAQ's proof, and a line in the credits", () => {
    const rows = named_.checks.rows;
    expect(rows[0]).toMatchObject({ id: "published", kind: "site", link: { href: "#published" } });
    expect(rows.slice(1)).toEqual(MOB_BASE.checks.rows);
    const count = (k: string) => rows.filter((r) => r.kind === k).length;
    expect([count("site"), count("call"), count("handover")]).toEqual([6, 4, 3]);
    const proof = named_.faq.items.find((i) => i.id === "proof")!.a;
    const base = MOB_BASE.faq.items.find((i) => i.id === "proof")!.a;
    expect(proof.endsWith(` ${base}`)).toBe(true);
    expect(split(proof)).toHaveLength(split(base).length + 1);
    expect(proof).toContain(names);
    named_.faq.items.forEach((i, k) => {
      if (i.id !== "proof") expect(i, i.id).toBe(MOB_BASE.faq.items[k]);
    });
    expect(named_.credits.items.map((i) => i.term)).toEqual([
      MOB_BASE.credits.items[0].term,
      "The apps named",
      ...MOB_BASE.credits.items.slice(1).map((i) => i.term),
    ]);
  });

  it("names only the stores the listings are in, one app or several", () => {
    // Every sentence the switch writes about where the apps are.
    const where = (c: ReturnType<typeof publishedCopy>) => [
      c.hero.proof[2].detail,
      c.path.stages.find((s) => s.id === "publish")!.published!,
      c.checks.rows[0].claim,
      split(c.faq.items.find((i) => i.id === "proof")!.a)[0],
    ];
    // Juniper is on Google Play alone: never said to be in the App Store.
    const playOnly = publishedCopy([FIXTURE[1]], MOB_BASE);
    expect(playOnly.hero.proof[2].detail).toBe("On Google Play, under its owner’s name.");
    for (const s of where(playOnly)) expect(s).not.toContain("App Store");
    expect(where(playOnly)).toEqual([
      "On Google Play, under its owner’s name.",
      "Already on Google Play under its owner’s name: Juniper.",
      "An app we built is on Google Play, under its owner’s name.",
      "One is already on Google Play: Juniper.",
    ]);
    const appleOnly = publishedCopy([{ ...FIXTURE[0], googlePlay: null }], MOB_BASE);
    for (const s of where(appleOnly)) expect(s).not.toContain("Google Play");
    expect(publishedCopy([FIXTURE[0]], MOB_BASE).hero.proof[2].detail).toBe("In the App Store and on Google Play, under its owner’s name.");
    // Larch is in both, Juniper in one: "or", never "and".
    expect(named_.hero.proof[2].detail).toBe("In the App Store or on Google Play, under their owners’ names.");
    for (const s of where(named_)) expect(s).not.toMatch(/App Store and/);
  });

  it("says the apps named are the one exception to “no client names”", () => {
    const isnt = (c: ReturnType<typeof publishedCopy>) => c.credits.items.find((i) => i.term === "What isn’t here")!.detail;
    const base = isnt(MOB_BASE);
    expect(base.startsWith("No client names")).toBe(true);
    expect(isnt(named_)).toBe(`Apart from the apps named, no client names${base.slice("No client names".length)}`);
    expect(isnt(publishedCopy([FIXTURE[1]], MOB_BASE)).startsWith("Apart from the app named, no client names")).toBe(true);
    for (const c of [named_, publishedCopy([FIXTURE[1]], MOB_BASE)]) {
      expect(strings(c.credits).filter((s) => /^No client names/.test(s))).toEqual([]);
    }
  });

  it("links every app named to its store listing, and to nothing else", () => {
    for (const h of hrefs(named_)) {
      if (h.startsWith("#")) expect([...ANCHORS, "published"], h).toContain(h.slice(1));
    }
    const off = (href: string) => [{ ...FIXTURE[0], appStore: { label: "Larch", href } }];
    expect(() => publishedCopy(off("https://example.com/larch"), MOB_BASE)).toThrow(/links off the stores/);
    expect(() => publishedCopy(off("http://apps.apple.com/app/larch/id100000001"), MOB_BASE)).toThrow(/links off the stores/);
    expect(() => publishedCopy([{ ...FIXTURE[0], appStore: null, googlePlay: null }], MOB_BASE)).toThrow(/no store listing/);
    expect(() => publishedCopy([], MOB_BASE)).toThrow(/empty/);
  });
});

/** Every anchor this page renders: its sections, the gates, each gate card, the own table and #server's cards. */
const ANCHORS: string[] = [...SECTION_IDS, "gates", ...GATE_IDS.map((g) => `gate-${g}`), "own", ...PART_IDS.map((p) => `server-${p}`)];

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
    const rows = MOB_CHECKS.rows;

    it("lists each claim once, five now, four on the call and three in your build", () => {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
      expect(rows).toHaveLength(12);
      const count = (k: string) => rows.filter((r) => r.kind === k).length;
      expect([count("site"), count("call"), count("handover")]).toEqual([5, 4, 3]);
    });

    it("gives each kind one name, the filter's and the tag's alike, and says the sub in the filters' order", () => {
      expect(MOB_CHECKS.filters.map((f) => f.id)).toEqual(["all", ...Object.keys(CHECK_KINDS)]);
      for (const f of MOB_CHECKS.filters) if (f.id !== "all") expect(f.label, f.id).toBe(CHECK_KINDS[f.id]);
      const said_ = MOB_CHECKS.sub.split(/(?<=\.)\s+/);
      const kinds = Object.values(CHECK_KINDS);
      expect(said_).toHaveLength(kinds.length);
      kinds.forEach((k, i) => expect(said_[i].toLowerCase(), k).toContain(k.toLowerCase()));
    });

    it("links every row that checks in this browser and names a place to go", () => {
      for (const r of rows) {
        if (r.kind === "site" && /https?:\/\/|\bwww\.|#\w|\/\w/.test(r.how)) expect(r.link, r.id).toBeDefined();
        if (r.link) expect(r.link.label.length, r.id).toBeGreaterThan(0);
      }
      const counts = rows.find((r) => r.id === "counts")!.claim;
      expect(counts).toMatch(/platform/);
      expect(counts).not.toMatch(/every figure on this page/i);
    });

    it("claims the store rules linked only where they are: on the gate cards, in the cards' own words", () => {
      const rules = rows.find((r) => r.id === "rules")!;
      const g = MOB_PATH.gates;
      expect(rules.claim).toBe(`Every store rule under ‘${g.title}’ links to the store’s own page.`);
      expect(rules.how).toContain(`a quote ‘${g.labels.quote}’`);
      expect(rules.how).toContain(`a summary ‘${g.labels.summary}’`);
      expect(rules.link).toEqual({ label: "The gates", href: "#gates" });
      for (const row of g.rows) {
        for (const l of row.google ? [row.apple, row.google] : [row.apple]) {
          expect(l.href, `${row.id}: ${l.ref}`).toMatch(/^https:\/\/(?:developer\.apple\.com|developer\.android\.com|support\.google\.com)\//);
          expect(l.ref.length, `${row.id}`).toBeGreaterThan(0);
        }
      }
    });

    it("never repeats a check's tag in its words, anywhere on the page", () => {
      // A check line prints its kind as a tag, then its words: "ON THE CALL  Ask to see the route list".
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
      visit([MOB_HOLD, PARTS, MOB_KINDS, MOB_PATH, MOB_SERVER, MOB_TEAM, MOB_CHECKS]);
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
    const ld = faqJsonLd(MOB_FAQ.items);
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(MOB_FAQ.items.map((i) => [i.q, i.a]));
    expect(MOB_FAQ.items.map((i) => i.id)).toEqual(["breadth", "proof", "web", "tech", "review", "own", "server", "push", "cost", "existing", "data"]);
    expect(new Set(MOB_FAQ.items.map((i) => i.id)).size).toBe(11);
  });

  const slots = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const TEMPLATES: [string, string, string[]][] = [
    ["the phone's step", MOB_HOLD.stepOf, ["n", "total"]],
    ["the phone's announcement", MOB_HOLD.live, ["caption", "label", "n", "platform", "total"]],
    ["the platform switch's announcement", MOB_HOLD.liveSwitch, ["note"]],
    ["a sample's tag", MOB_KINDS.tag, ["kind", "side"]],
    ["#kinds' announcement", MOB_KINDS.live, ["kind", "side", "title"]],
    ["the checks' count", MOB_CHECKS.showing, ["n", "total"]],
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
    for (const id of ["D-U-N-S", "eu-west-1"]) {
      expect(raw.filter((s) => s.includes(id)), id).toEqual([]);
      expect(raw.filter((s) => s.includes(id.replaceAll("-", "-\u2060"))).length, id).toBeGreaterThanOrEqual(2);
    }
    // A word joiner only ever follows a hyphen.
    expect(raw.filter((s) => /(?<!-)\u2060/.test(s))).toEqual([]);
  });

  it("ends its #start copy no lower in the deep panel than the SaaS page's, which the zones were measured on", () => {
    expect(MOB_START.title.length).toBeLessThanOrEqual(SAAS_START.title.length);
    expect(MOB_START.key.length).toBeLessThanOrEqual(SAAS_START.key.length);
    expect(MOB_START.body.length).toBeLessThanOrEqual(SAAS_START.body.length);
  });
});

describe("credits", () => {
  /** A printed name and the name its credit uses. */
  const CREDITED_AS: Record<string, string> = { Postgres: "PostgreSQL", iOS: "IOS" };
  const PRINTED_AS = Object.fromEntries(Object.entries(CREDITED_AS).map(([printed, credited]) => [credited, printed]));
  const creditLines = CREDITS.flatMap(split).filter((s) => /trademarks? of/.test(s));
  const credited = (mark: string) => creditLines.some((l) => named(CREDITED_AS[mark] ?? mark, l));
  const printed = (mark: string) => OUTSIDE_CREDITS.some((s) => named(mark, s));
  const item = (term: string) => MOB_CREDITS.items.find((i) => i.term === term)!.detail;
  const tmLine = MOB_CREDITS.items.find((i) => plain(i.detail).startsWith(listJoin(MOB_TRADEMARKS)))!;
  const NEVER = ["Face ID", "Apple Pay", "Google Pay", "Play Console", "Firebase", "Bluetooth", "Material Design", "Human Interface Guidelines", "Safari"];

  // Printed means printed outside the credits: a mark the credits alone name would count itself.
  it("credits every mark it prints", () => {
    const marks = REGISTRY.filter(printed);
    expect(marks.length).toBeGreaterThanOrEqual(25);
    expect(marks.filter((m) => !credited(m))).toEqual([]);
  });

  it("prints every mark it credits", () => {
    const marks = [...REGISTRY, "IOS"].filter((m) => creditLines.some((l) => named(m, l)));
    expect(marks.length).toBeGreaterThanOrEqual(25);
    expect(marks.filter((m) => !printed(PRINTED_AS[m] ?? m))).toEqual([]);
    for (const mark of MOB_TRADEMARKS) expect(printed(PRINTED_AS[mark] ?? mark), mark).toBe(true);
  });

  it("never prints the marks the page leaves out, not even in the credits", () => {
    for (const mark of NEVER) expect(ALL.filter((s) => named(mark, s)), mark).toEqual([]);
  });

  it("says it once, and says none of them endorses the page", () => {
    expect(tmLine).toBeDefined();
    expect(ALL.filter((s) => s.includes("trademarks of their respective owners"))).toHaveLength(1);
    expect(tmLine.detail).toContain("none of them endorses");
  });

  it("credits Apple in its own line: every Apple mark the page prints, and Apple's own sentence for iOS", () => {
    const apple = item("Apple");
    const APPLE = ["Apple", "iPhone", "App Store", "App Store Connect", "TestFlight", "Siri", "Swift", "SwiftUI", "Sign in with Apple", "iOS"];
    expect(apple.startsWith("Apple, ")).toBe(true);
    for (const mark of APPLE) expect(named(CREDITED_AS[mark] ?? mark, apple), mark).toBe(printed(mark));
    expect(apple).toContain("trademarks of Apple Inc.");
    expect(apple).toContain("IOS is a trademark or registered trademark of Cisco in the U.S. and other countries and is used under license.");
  });

  it("credits Google in its own line: the mark on its own, every Google product the page prints, and its technologies", () => {
    const google = item("Google");
    const product = /\bGoogle (?!LLC\b)[A-Z]\w+/g;
    const products = new Set(OUTSIDE_CREDITS.flatMap((s) => [...s.matchAll(product)].map((m) => m[0])));
    expect([...products]).toEqual(["Google Play"]);
    expect(OUTSIDE_CREDITS.some((s) => /\bGoogle\b(?! [A-Z])/.test(s))).toBe(true);
    expect(google.startsWith("Google, ")).toBe(true);
    expect(new Set([...google.matchAll(product)].map((m) => m[0]))).toEqual(products);
    for (const mark of ["Android", "Jetpack Compose", "Flutter"]) expect(named(mark, google), mark).toBe(true);
    expect(google).toContain("trademarks of Google LLC");
  });

  it("names Anthropic's owner exactly", () => {
    expect(item("Anthropic and Claude")).toContain("Anthropic, PBC");
  });
});

describe("colour", () => {
  const saasCss = read(`${SAAS_DIR}/saas.css`);
  const reach = flowReach(saasCss, "saas-flow-x", "saas-flow-y");
  const MOVING_MARGIN = 0.2;
  type Measured = Record<keyof typeof SAAS_INK, [number, number] | [number]>;
  // Every size each light renders at on this page (W × H px): the reused
  // components' boxes as the Automations test measured them, and this
  // page's own (#kinds' room, #path's three stage cards) as the measure
  // pass found them at every width from 320 to 1920, with the figures
  // worked out on them: [still, flowing], the worst over the set.
  const HERO_ROOM: [number, number][] = [
    [343, 560], [704, 480], [440, 580], [480, 560], [560, 520], [288, 656], [358, 620], [560, 527], [440, 592], [500, 574],
    [288, 804], [358, 674], [560, 584], [440, 628], [500, 584],
  ];
  const KINDS_ROOM: [number, number][] = [
    [288, 1846], [293, 1751], [298, 1734], [303, 1712], [308, 1712], [312, 1696], [318, 1696], [328, 1696], [343, 1657], [358, 1585],
    [380, 1585], [398, 1541], [448, 1541], [508, 1490], [568, 1490], [607, 1490], [592, 1490], [652, 1490], [719, 1490], [720, 1061],
    [786, 1061], [852, 1039], [952, 1039], [975, 1039], [944, 967], [1000, 967], [1070, 967], [1150, 967], [1176, 967], [1176, 1003],
  ];
  const PATH_CARDS: [number, number][] = [
    [288, 507], [288, 609], [288, 629], [293, 485], [293, 589], [293, 611], [298, 485], [298, 589], [298, 583], [303, 485],
    [303, 589], [303, 583], [308, 457], [308, 589], [308, 583], [312, 457], [312, 567], [312, 561], [318, 457], [318, 567],
    [318, 561], [328, 435], [328, 567], [328, 561], [343, 435], [343, 549], [343, 539], [358, 435], [358, 499], [358, 521],
    [380, 413], [380, 499], [398, 391], [398, 499], [398, 477], [448, 369], [448, 459], [448, 437], [508, 347], [508, 415],
    [508, 437], [568, 347], [568, 393], [568, 415], [607, 325], [607, 375], [607, 415], [592, 347], [592, 375], [592, 415],
    [652, 325], [652, 375], [652, 415], [719, 325], [719, 375], [719, 415], [720, 341], [720, 391], [720, 431], [786, 341],
    [786, 391], [786, 431], [852, 341], [852, 391], [852, 431], [952, 341], [952, 391], [952, 431], [975, 341], [975, 391],
    [975, 431], [299, 623], [317, 623], [341, 601], [367, 573], [376, 551],
  ];
  const TEAM_CARD: [number, number][] = [
    [343, 900], [358, 860], [288, 1000], [704, 640], [720, 600], [944, 540], [1176, 480], [1176, 520],
    [288, 1084], [358, 974], [720, 594], [944, 492], [1176, 408],
  ];
  // #checks' card under the ledger: the SaaS component, on the papers light, still (no LiveMesh).
  const CHECKS_CARD: [number, number][] = [[288, 344], [358, 294], [720, 233], [944, 199], [1176, 199]];
  const SURFACES: [string, SaasLightId[], [number, number][], Measured][] = [
    ["the hero's room", ["room"], HERO_ROOM, { text: [12.47, 12.02], dim: [7.58, 7.31], accent: [5.86, 5.65], tick: [3.72, 3.58] }],
    ["#kinds' room", ["roomMirror"], KINDS_ROOM, { text: [12.42, 12.05], dim: [7.55, 7.33], accent: [5.84, 5.66], tick: [3.7, 3.59] }],
    ["#path's cards", ["stage", "stageMirror"], PATH_CARDS, { text: [13.54, 12.06], dim: [8.23, 7.34], accent: [6.36, 5.67], tick: [4.04, 3.6] }],
    ["#team's card", ["papers"], TEAM_CARD, { text: [12.64, 11.41], dim: [7.69, 6.94], accent: [5.94, 5.36], tick: [3.77, 3.4] }],
    ["#checks' card, still", ["papers"], CHECKS_CARD, { text: [12.64], dim: [7.68], accent: [5.94], tick: [3.77] }],
  ];

  // The flowing check walks every combination of every pool's reach at every
  // sampled point of every box size (mesh-contrast.ts darkestLum). #path's
  // cards come at the most sizes, so their walk alone takes about 4.5s — on
  // the edge of vitest's 5s default, which a busy machine tips over. The work
  // is deterministic and already remembered per recipe, so it gets room to
  // finish rather than a thinner check.
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
  }, 30_000);

  const WHITE = "#ffffff";
  it.each<[string, string, string, number, number]>([
    ["white on electric: the sample's primary buttons, “Needs it”, the booked disc's tick", WHITE, HOME_COLORS.electric, 5.7, 4.5],
    ["ink on white: the device, the cards, the tables", HOME_COLORS.ink, WHITE, 19.1, 4.5],
    ["muted on white: labels, datums, mono", HOME_COLORS.muted, WHITE, 6.37, 4.5],
    ["violet on white: #server's datums, the tools line, “Built for yours”, “Often”", HOME_COLORS.violet, WHITE, 7.1, 4.5],
    ["settled on white: “Runs here”", HOME_COLORS.settled, WHITE, 5.5, 4.5],
    ["electric on white: hotspot rings, lit rings, traces, dots", HOME_COLORS.electric, WHITE, 5.7, 3],
    ["muted on stage: #hold's tag, the notes, the hint", HOME_COLORS.muted, HOME_COLORS.stage, 5.39, 4.5],
    ["ink on stage: the rail's labels", HOME_COLORS.ink, HOME_COLORS.stage, 16.17, 4.5],
    ["electric on stage: the rail's fill, the finger's ring", HOME_COLORS.electric, HOME_COLORS.stage, 4.82, 3],
    ["electric on wash: #path's rail and nodes", HOME_COLORS.electric, HOME_COLORS.wash, 5.21, 3],
    ["violet on wash: #path's key phrase, the figure's gate labels", HOME_COLORS.violet, HOME_COLORS.wash, 6.49, 4.5],
    ["muted on wash: the figure's labels", HOME_COLORS.muted, HOME_COLORS.wash, 5.82, 4.5],
    ["muted on chip: the Android dialog's body", HOME_COLORS.muted, HOME_COLORS.chip, 5.69, 4.5],
  ])("%s clears its bar, as measured", (_, fg, bg, measured, bar) => {
    const ratio = contrast(rgb(fg), rgb(bg));
    expect(ratio).toBeGreaterThanOrEqual(bar);
    expect(ratio).toBeCloseTo(measured, 1);
  });

  // #server's night room (`.mob-night`): a static gradient between these two, the Automations one.
  const NIGHT = ["#140a24", "#1e0a3c"] as const;
  it.each<[string, string, number, number]>([
    ["on-deep: text on the room", HOME_COLORS.onDeep, 16.55, 15.62],
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
    expect(contrast(rgb(HOME_COLORS.electric), rgb(NIGHT[0]))).toBeCloseTo(3.35, 1);
    expect(Math.min(...NIGHT.map((bg) => contrast(rgb(WHITE), rgb(bg))))).toBeCloseTo(18.04, 1);
  });

  it.skipIf(!has(`${DIR}/mob-server.css`))(`paints the night room with the gradient the tokens were measured on${waiting(`${DIR}/mob-server.css`)}`, () => {
    const css = read(`${DIR}/mob-server.css`).replace(/\/\*[\s\S]*?\*\//g, "");
    const body = css.match(/\.pp \.mob-night \{([^}]*)\}/)?.[1] ?? "";
    expect(body).toMatch(new RegExp(String.raw`background(?:-image)?:\s*linear-gradient\(180deg, ${NIGHT[0]} 0%, ${NIGHT[1]} 100%\);`));
  });

  // The lock screen: DEEP_PANEL in the glass, at every size the glass renders at (measured, 320 to 1920).
  const GLASS: [number, number][] = [
    [238, 507], [243, 517], [248, 527], [253, 538], [258, 548], [262, 556], [242, 515], [256, 544], [274, 580], [294, 621], [300, 634],
  ];
  const TOP = [0, 0, 1, 0.4] as const;
  const ANYWHERE = [0, 0, 1, 1] as const;
  it.each<[string, string, readonly [number, number, number, number], number, number]>([
    ["on-deep, anywhere", HOME_COLORS.onDeep, ANYWHERE, 4.93, 4.5],
    ["on-deep, in the top 40% where the heading sits", HOME_COLORS.onDeep, TOP, 11.45, 4.5],
    ["on-deep-dim, in the top 40%", HOME_COLORS.onDeepDim, TOP, 8.81, 4.5],
    ["white, anywhere: the ring and the time bar, marks", WHITE, ANYWHERE, 5.7, 3],
  ])("reads on the lock screen: %s", (_, fg, zone, measured, bar) => {
    const worst = worstInZone(DEEP_PANEL, fg, GLASS, zone);
    expect(worst).toBeGreaterThanOrEqual(bar);
    expect(worst).toBeCloseTo(measured, 1);
  });

  it("reads on the notification card, white at 92% over the lock screen's most saturated violet", () => {
    const card = over(rgb(WHITE), 0.92, rgb(HOME_COLORS.electric));
    expect(contrast(rgb(HOME_COLORS.ink), card)).toBeCloseTo(16.99, 1);
    expect(contrast(rgb(HOME_COLORS.muted), card)).toBeCloseTo(5.66, 1);
  });

  // #start's deep panel (DEEP_PANEL, static): the sizes and zones the Automations test holds.
  const WIDE: [number, number][] = [[1176, 441]];
  const NARROW: [number, number][] = [[343, 760], [704, 600], [944, 559], [1176, 559], [288, 605], [358, 562], [720, 495]];

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
 * The element a selector styles, as the tier check names it: the mob-
 * classes of the last compound that has one, and whatever the selector
 * goes on to name after it (`path[pathLength]` in a figure). Classes
 * inside `:not()` are not the element's.
 */
function subject(sel: string): { classes: string[]; trail: string } {
  const compounds = splitTop(sel.replace(/\s*([>+~])\s*/g, " $1 "), " ").filter((c) => !/^[>+~]$/.test(c));
  for (let k = compounds.length - 1; k >= 0; k--) {
    const own = compounds[k].replace(/:not\([^)]*\)/g, "");
    const classes = [...own.matchAll(/\.(mob-[\w-]+)/g)].map((m) => m[1]);
    if (classes.length) return { classes, trail: compounds.slice(k + 1).join(" ") };
  }
  return { classes: [], trail: compounds.join(" ") };
}

/** Whether a selector styles a view transition's own pseudo-elements (`::view-transition-old(saas-proto)`, …). */
const isTransitionPart = (sel: string) => /::view-transition-[\w-]+(?:\([^)]*\))?\s*$/.test(sel);

// What may animate: colour, transform, translate, scale and opacity, and
// no custom property: the compositor can't run one. A transition names
// only these, and box-shadow (a lit card's ring).
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
const ORDER = ["mob.css", "mob-device.css", "mob-hold.css", "mob-kinds.css", "mob-path.css", "mob-server.css"];

/**
 * Every rule of ours that runs an animation (`animation` or
 * `animation-name`, not `none`) and isn't stopped on each of the lite,
 * still and weak tiers by a rule that wins: one rooted at
 * `html[data-tier="lite"]`, `html[data-tier="still"]` or `html[data-weak]`
 * (written out of any `:is()`), setting `animation: none` on the same
 * element — a mob- class of the animated rule's subject, and whatever the
 * rule names after it — with a higher specificity, or an equal one later
 * in the cascade (the sheets in ORDER, then source order). Each entry
 * says which rule, and which tier's pin is missing or loses.
 *
 * A view transition's own pseudo-elements are exempt: the phone starts a
 * transition only through vt.ts's `withViewTransition`, whose `vtAllowed`
 * refuses it with reduced motion and on the lite and still tiers (weak
 * hardware is lite), so the change is instant there and nothing of it
 * ever animates.
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
          else if (runs_ && !tier && !isTransitionPart(alt)) animated.push({ where: `${sheet}: ${alt}`, classes, trail, spec, order });
        }
      }
    }
  }
  const out: string[] = [];
  for (const a of animated) {
    if (!a.classes.length) {
      out.push(`${a.where}: animates no mob- element`);
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
 * Every mob- class that is the subject of rules in two of the section
 * sheets (mob.css, which holds the shared marks and pins, is exempt): a
 * class two sections both style is one each restyles on the other's
 * elements. Each entry names the class and the sheets.
 */
function sharedSubjects(sheets: readonly { sheet: string; blocks: CssBlock[] }[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const { sheet, blocks } of sheets) {
    const name = path.basename(sheet);
    if (name === "mob.css") continue;
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

/** Whether a selector, with the rules it sits in, names one of ours: a mob- class, or a mob- view-transition type. */
const namesOurs = (s: string) => /\.mob-[\w-]/.test(s) || /:active-view-transition-type\([^)]*\bmob-/.test(s);

describe("the route's stylesheets", () => {
  const sheets = [DIR, APP_DIR]
    .filter(has)
    .flatMap((dir) => readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".css")).map((f) => `${dir}/${f}`));
  const parsed = sheets.map((sheet) => ({ sheet, blocks: parseCss(read(sheet)) }));
  const isAt = (prelude: string) => prelude.startsWith("@");
  const inKeyframes = (within: string[]) => within.some((p) => p.startsWith("@keyframes"));
  const missing = ORDER.filter((f) => !has(`${DIR}/${f}`));

  it(`finds the shared stylesheet, and every section's own${missing.length ? ` (waiting for ${missing.join(", ")})` : ""}`, () => {
    expect(sheets).toContain(`${DIR}/mob.css`);
    // No sheet of ours outside the list page.tsx imports in order.
    expect(sheets.map((s) => path.basename(s)).filter((f) => !ORDER.includes(f))).toEqual([]);
  });

  it.each(parsed.map((p) => [p.sheet, p.blocks] as const))("%s keeps every rule under .pp, every class and keyframe prefixed, and names one of ours", (sheet, blocks) => {
    for (const b of blocks) {
      if (isAt(b.prelude) || inKeyframes(b.within)) continue;
      const styleParents = b.within.filter((p) => !isAt(p));
      for (const sel of splitTop(b.prelude)) {
        // A top-level rule starts at the page's <main> (.pp), or at <html> for the tiers and the view transitions.
        if (styleParents.length === 0) expect(sel, sheet).toMatch(/^(?:\.pp(?![\w-])|html(?![\w-])|:root(?![\w-]))/);
        for (const [, cls] of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) expect(cls, `${sheet}: ${sel}`).toMatch(/^(?:mob-|saas-|home-)|^pp$/);
        expect([...styleParents, sel].some(namesOurs), `${sheet}: ${sel} names none of ours`).toBe(true);
      }
    }
    for (const b of blocks) {
      const name = b.prelude.match(/^@keyframes\s+(\S+)/)?.[1];
      if (name) expect(name, sheet).toMatch(/^mob-/);
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

  it("defines the shared keyframes once, in mob.css", () => {
    const where = (name: string) => parsed.filter((p) => p.blocks.some((b) => b.prelude === `@keyframes ${name}`)).map((p) => p.sheet);
    for (const name of ["mob-pop", "mob-fade-in", "mob-fade-out"]) expect(where(name), name).toEqual([`${DIR}/mob.css`]);
    const names = parsed.flatMap((p) => p.blocks.map((b) => b.prelude.match(/^@keyframes\s+(\S+)/)?.[1]).filter(Boolean));
    expect(new Set(names).size).toBe(names.length);
  });

  it("runs every view transition of ours under the phone's scope and a mob- type, so the SaaS page's are untouched", () => {
    for (const { sheet, blocks } of parsed) {
      for (const b of blocks) {
        if (isAt(b.prelude) || inKeyframes(b.within)) continue;
        const styleParents = b.within.filter((p) => !isAt(p));
        for (const sel of splitTop(b.prelude)) {
          const full = [...styleParents, sel].join(" ");
          if (!/::view-transition-/.test(full)) continue;
          expect(full, `${sheet}: ${sel}`).toMatch(/^html\[data-saas-vt="proto"\]/);
          expect(full, `${sheet}: ${sel}`).toMatch(/:active-view-transition-type\([^)]*\bmob-/);
        }
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
      ['.mob-card[data-state="lit"]', "mob-hold.css"],
      [".mob-dwell-fill", "mob-hold.css"],
      [".mob-hot", "mob-device.css"],
      [".mob-note", "mob-device.css"],
      [".mob-need", "mob-kinds.css"],
      [".mob-night", "mob-server.css"],
    ];
    const forced = parsed.flatMap((p) => p.blocks.filter((b) => b.within.some((w) => /^@media\s*\(forced-colors:\s*active\)/.test(w))).map((b) => b.prelude));

    for (const [state, sheet] of STATES) {
      it.skipIf(!has(`${DIR}/${sheet}`))(`keeps ${state} in system colours${waiting(`${DIR}/${sheet}`)}`, () => {
        expect(forced.some((s) => s.includes(state)), `${state}, in ${sheet}`).toBe(true);
      });
    }
  });

  describe(`the page's imports${waiting(PAGE_FILE)}`, () => {
    it.skipIf(!has(PAGE_FILE))("imports the six shared sheets once each, in order, then every sheet of ours once, in ORDER", () => {
      const page = read(PAGE_FILE);
      const imported = (file: string) => {
        const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return page.match(new RegExp(`^import ["']@/${escaped}["'];`, "gm"))?.length ?? 0;
      };
      const SHARED = [
        "components/site/home/home.css",
        "components/site/home/tier.css",
        `${SAAS_DIR}/saas.css`,
        `${SAAS_DIR}/saas-credentials.css`,
        `${SAAS_DIR}/saas-build.css`,
        `${SAAS_DIR}/saas-closing.css`,
      ];
      for (const shared of SHARED) expect(imported(shared), shared).toBe(1);
      const at = (f: string) => page.indexOf(`"@/${f}"`);
      expect(SHARED.map(at)).toEqual([...SHARED.map(at)].sort((a, b) => a - b));
      expect(imported(`${SAAS_DIR}/saas-explorer.css`)).toBe(0);
      expect(page).not.toMatch(/custom-automations\/auto[\w-]*\.css/);
      for (const f of ORDER) expect(imported(`${DIR}/${f}`), f).toBe(1);
      const ours = ORDER.map((f) => at(`${DIR}/${f}`));
      expect(ours).toEqual([...ours].sort((a, b) => a - b));
      expect(ours[0]).toBeGreaterThan(at(`${SAAS_DIR}/saas-closing.css`));
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
  const BOXES = ["hold", "kinds", "path", "server", "team", "terms", "checks", "faq", "start"];

  it("measures at the SaaS page's widths and its own, in order, and keeps a height for every box at each", () => {
    // Its own: where its phone rows bend between the SaaS widths; 344, where the phone stops scaling; and 343,
    // the pixel before #server's cards widen their padding (deferred.tsx).
    expect(RESERVE_AT).toEqual([...SAAS_RESERVE_AT, 325, 330, 335, 343, 344, 350, 365, 417, 607].sort((a, b) => a - b));
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

  it("was measured with the apps the owner switch names", () => {
    expect(RESERVES_MEASURED_WITH.publishedApps).toBe(PUBLISHED_APPS?.length ?? 0);
  });

  describe(`the page's boxes${waiting(PAGE_FILE)}`, () => {
    it.skipIf(!has(PAGE_FILE))("keeps a row for every box on the page, in its order, and no other kind of box", () => {
      const page = read(PAGE_FILE);
      expect([...page.matchAll(/<MobDeferred box="(\w+)">/g)].map((m) => m[1])).toEqual(Object.keys(RESERVES));
      expect(page).not.toMatch(/<HomeDeferred\b/);
      expect(page).not.toMatch(/<SaasDeferred\b/);
    });
  });
});

describe("the reuse contract", () => {
  /** Our own scripts, comments left out: what they do, not what they say. */
  const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const scripts = readdirSync(path.join(ROOT, DIR))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${DIR}/${f}`);

  it("still finds the SaaS shell, hero, lights and closing sheets it builds on", () => {
    expect(read(`${SAAS_DIR}/shell.tsx`)).toContain("pp home-body saas-page");
    expect(read(`${SAAS_DIR}/hero.tsx`)).toContain("saas-lit saas-light-room saas-room");
    const css = read(`${SAAS_DIR}/saas.css`);
    expect(css).toContain(".pp .saas-light-room-m {");
    expect(css).toContain(".pp .saas-light-stage-m {");
    expect(css).toContain("--saas-room");
    const closing = read(`${SAAS_DIR}/saas-closing.css`);
    // #checks' view transition names the boxes after it by the `data-box` a page's Deferred
    // renders (not by `:has(> #faq)`, which costs every insertion): this page's renders it too,
    // and wraps #faq and #start in boxes of those names.
    expect(closing).toContain('.home-deferred[data-box="faq"]');
    expect(closing).toContain('.home-deferred[data-box="start"]');
    expect(read(`${DIR}/deferred.tsx`)).toContain("data-box={box}");
    const page = read(PAGE_FILE);
    expect(page).toContain('<MobDeferred box="faq">');
    expect(page).toContain('<MobDeferred box="start">');
    expect(SECTION_IDS).toContain("faq");
    expect(SECTION_IDS).toContain("start");
  });

  it("still names the SaaS prototype's screen for the \"proto\" scope, which the phone's screen wears", () => {
    const build = read(`${SAAS_DIR}/saas-build.css`);
    expect(build).toMatch(/html\[data-saas-vt="proto"\] \.pp \.saas-proto-screen \{\s*view-transition-name: saas-proto;/);
    expect(read(`${SAAS_DIR}/vt.ts`)).toMatch(/\bproto: "\.pp \.saas-proto-screen"/);
  });

  it.skipIf(!has(`${DIR}/device.tsx`))(`puts saas-proto-screen on the phone's live screen only${waiting(`${DIR}/device.tsx`)}`, () => {
    // One element wears it, so the transition's name is unique on the page and never aborts one.
    const uses = scripts.flatMap((f) => (code(f).match(/\bsaas-proto-screen\b/g) ?? []).map(() => path.basename(f)));
    expect(uses).toHaveLength(1);
    expect(["device.tsx", "screens.tsx"]).toContain(uses[0]);
    for (const f of ORDER.filter((s) => has(`${DIR}/${s}`))) expect(read(`${DIR}/${f}`), f).not.toMatch(/\.saas-proto-screen\b/);
  });

  it("starts a view transition only in the \"proto\" scope", () => {
    const calls = scripts.flatMap((f) => [...code(f).matchAll(/\bwithViewTransition\(\s*([^,)]+)/g)].map((m) => `${path.basename(f)}: ${m[1].trim()}`));
    for (const c of calls) expect(c).toMatch(/: "proto"$/);
    if (has(`${DIR}/phone-stage.tsx`)) expect(calls.length).toBeGreaterThan(0);
  });

  it("hands the reused sections data they accept", () => {
    type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;
    const hero = MOB_HERO satisfies PropsOf<typeof Hero>["data"];
    const terms = MOB_TERMS satisfies PropsOf<typeof Terms>["data"];
    const checks = MOB_CHECKS satisfies PropsOf<typeof Checks>["data"];
    const faq = MOB_FAQ satisfies PropsOf<typeof Faq>["data"];
    const start = MOB_START satisfies PropsOf<typeof Start>["data"];
    const credits = MOB_CREDITS satisfies PropsOf<typeof Start>["credits"];
    const team = MOB_TEAM satisfies PropsOf<typeof Team>["data"];
    expect([hero, terms, checks, faq, start, credits, team]).toHaveLength(7);
    // No row asks the SaaS explorer for a lens: this page has none of its lenses.
    expect(MOB_CHECKS.rows.filter((r) => r.link && "lens" in r.link)).toEqual([]);
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
    const clients = scripts.filter((f) => /^\s*["']use client["']/.test(read(f)));
    for (const f of clients) {
      const values = [...read(f).matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@\/lib\/pages\/custom-mobile-applications"/g)]
        .filter((m) => !m[1])
        .flatMap((m) => m[2].split(",").map((n) => n.trim()).filter((n) => n && !n.startsWith("type ")));
      expect(values, f).toEqual([]);
      expect(read(f), f).not.toMatch(/import\s+(?!type\b)[\w*{][^;]*from\s+"@\/lib\/pages\/custom-mobile-applications"/);
    }
  });

  const SIBLINGS = [
    "app/solutions/custom-saas-platforms",
    "app/solutions/custom-automations",
    SAAS_DIR,
    "components/site/solutions/custom-automations",
    "lib/pages/custom-saas-platforms.ts",
    "lib/pages/custom-saas-platforms.test.ts",
    "lib/pages/custom-saas-platforms.server.ts",
    "lib/pages/custom-automations.ts",
    "lib/pages/custom-automations.test.ts",
    "lib/pages/custom-automations.server.ts",
  ];
  const git = (() => {
    try {
      execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: ROOT, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(git)("leaves every line of both sibling pages as it is at HEAD", () => {
    // Read-only: what differs from HEAD, untracked files included.
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", ...SIBLINGS], { cwd: ROOT, encoding: "utf8" });
    expect(status).toBe("");
  });
});

describe("the instruments this file measures with", () => {
  it("reads a rounded route back as it is drawn", () => {
    const pts = pointsOfD("M182 56 L194 56 Q202 56 202 64 L202 184");
    expect(pts[0]).toEqual([182, 56]);
    expect(pts.at(-1)).toEqual([202, 184]);
    expect(pts).toContainEqual([202, 64]);
    // The corner is cut: its middle stands off the polyline's bend.
    const [mx, my] = pts[11];
    expect(Math.hypot(202 - mx, 56 - my)).toBeGreaterThan(2);
    expect(() => pointsOfD("M0 0 C1 1 2 2 3 3")).toThrow(/can't read/);
  });

  it("finds a crossing, and a shared run, but not a junction at a run's end", () => {
    expect(crosses([[0, 200], [34, 200]], [[10, 56], [10, 300]])).toBe(true);
    expect(crosses([[0, 200], [34, 200]], [[10, 200], [10, 56]])).toBe(false);
    expect(crosses([[0, 200], [34, 200]], [[40, 56], [40, 300]])).toBe(false);
    expect(shared([[10, 200], [10, 56]], [[10, 8], [10, 200]])).toEqual([[10, 56], [10, 200]]);
    expect(shared([[0, 200], [10, 200]], [[0, 200], [34, 200]])).toEqual([[0, 200], [10, 200]]);
    expect(shared([[10, 200], [10, 56]], [[10, 200], [10, 390]])).toBeNull();
  });

  it("reads the stations' offsets from the figure's slices", () => {
    const src = `const SLICES = {\n  prototype: { o: 0.02, s: 0.05 },\n  "design": 0.13,\n  live: [0.72, 0.05],\n} as const;\nconst X = { build: 9 };`;
    expect(figureSlices(src)).toEqual({ prototype: 0.02, design: 0.13, live: 0.72 });
    const list = `const SLICES = [\n  { id: "beta", o: 0.42 },\n  { id: "review", o: 0.62 },\n] as const;\nfunction F() {\n  return { updates: 1 };\n}`;
    expect(figureSlices(list)).toEqual({ beta: 0.42, review: 0.62 });
    expect(() => figureSlices("const OTHER = {}")).toThrow(/no const SLICES/);
  });

  it("finds a keyframe, a transition or a scroll timeline that breaks the motion contract", () => {
    const css = `
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .pp .mob-path-fig { view-timeline: --mob-path block; }
        }
      }
      .pp .mob-x { view-timeline: --mob-x block; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s; }
      .pp .mob-row-in { transition: opacity 0.3s, translate 0.3s 60ms; @starting-style { opacity: 0; translate: 0 6px; } }
      .pp .mob-pip { transition-property: background-color, --k; }
      @keyframes mob-grow { from { height: 0; scale: 1 0; } to { --k: 1; } }
    `;
    const faults = motionFaults("fixture.css", parseCss(css));
    expect(faults).toEqual([
      expect.stringMatching(/\.mob-x \{ view-timeline: .*outside the reduced-motion and support gates$/),
      expect.stringMatching(/\.mob-x \{ transition: .*transitions height$/),
      expect.stringMatching(/\.mob-pip \{ transition-property: .*transitions --k$/),
      expect.stringMatching(/from \{ height: 0 \}: animates height$/),
      expect.stringMatching(/to \{ --k: 1 \}: animates --k$/),
    ]);
    expect(parseCss(css).find((b) => b.prelude === "@starting-style")?.within).toEqual([".pp .mob-row-in"]);
  });

  it("finds an animation no tier stops, and a pin too light to stop it, and lets a view transition's own parts be", () => {
    const sheet = (css: string) => [{ sheet: `${DIR}/mob-path.css`, blocks: parseCss(css) }];
    const deep = ".pp .mob-path-fig:not([data-done]) .mob-station[data-i] .mob-station-disc { animation-name: mob-pop; }";
    const pin = (tiers: string) =>
      tiers
        .split(",")
        .map((t) => `html${t === "weak" ? "[data-weak]" : `[data-tier="${t}"]`} .home-body .mob-station-disc { animation: none; }`)
        .join("\n");
    expect(unpinned(sheet(deep))).toHaveLength(3);
    // Held at two classes and <html>, a pin loses to the scroll rule's five.
    expect(unpinned(sheet(`${deep}\n${pin("lite,still,weak")}`))).toEqual([
      expect.stringContaining("the lite pin loses"),
      expect.stringContaining("the still pin loses"),
      expect.stringContaining("the weak pin loses"),
    ]);
    // One :is() list pins every tier at once.
    const list = `html:is([data-tier="lite"], [data-tier="still"], [data-weak]) .pp.home-body .mob-path-fig :is(.mob-station .mob-station-disc, .mob-rail) { animation: none; }`;
    expect(unpinned(sheet(`${deep}\n${list}`))).toEqual([]);
    const vt = `html[data-saas-vt="proto"]:active-view-transition-type(mob-ios)::view-transition-new(saas-proto) { animation: mob-ios-in 0.36s both; }`;
    expect(unpinned(sheet(vt))).toEqual([]);
    expect(specificity(".pp .mob-path-fig:not([data-done]) .mob-station[data-i] .mob-station-disc")).toEqual([0, 6, 0]);
    expect(specificity('html[data-tier="lite"] .home-body :is(.mob-pop, .mob-fig .mob-fade)')).toEqual([0, 4, 1]);
  });

  it("finds a class two section sheets both style, and lets mob.css share its marks", () => {
    const sheet = (name: string, css: string) => ({ sheet: `${DIR}/${name}`, blocks: parseCss(css) });
    const hold = sheet("mob-hold.css", ".pp .mob-dot { top: 12px; } .pp .mob-rail { width: 2px; }");
    const kinds = sheet("mob-kinds.css", ".pp .mob-need[data-core] .mob-dot { top: 19px; } html[data-weak] .pp :is(.mob-need .mob-pip) { animation: none; }");
    const shared_ = sheet("mob.css", ".pp .mob-pip { width: 6px; }");
    expect(sharedSubjects([hold, kinds, shared_])).toEqual(["mob-dot: mob-hold.css, mob-kinds.css"]);
    // A class only named on the way to the subject is not styled there.
    expect(sharedSubjects([sheet("mob-hold.css", ".pp .mob-need { gap: 0; }"), sheet("mob-kinds.css", ".pp .mob-need .mob-spine { top: 0; }")])).toEqual([]);
  });
});

describe("breadth: any app, for any business, and this platform as the proof", () => {
  const range = MOB_HERO.range;
  const items = range.groups.flatMap((g) => g.items);

  it("says it in the hero, the range, #kinds, the team, the FAQ, the terms and the credits, each in its own words", () => {
    expect(MOB_META.title).toBe(`${ITEM.label}, for any business`);
    expect(LINES.find((l) => /^\s*title: `\$\{ITEM\.label\}, for any business`/.test(l))).toContain("// OWNER");
    expect(MOB_HERO.sub).toContain("For your customers or your own team, in any field");
    expect(MOB_HERO.sub).toContain("our own product for AI phone agents");
    expect(range.lead.endsWith("Not just phone agents.")).toBe(true);
    expect(MOB_KINDS.foot).toContain("Bring yours to the call");
    // Said before the six chips, so they read as a sample of what we build, not the menu.
    expect(MOB_KINDS.sub.startsWith(`${cap(word(MOB_KINDS.kinds.length))} of the many kinds of app we build,`)).toBe(true);
    expect(MOB_TEAM.sub).toContain("for any business");
    const breadth = MOB_FAQ.items[0];
    expect(breadth.id).toBe("breadth");
    expect(breadth.q).toContain("‘Voice’");
    expect(COMPANY.name).toMatch(/\bVoice\b/);
    expect(breadth.a.startsWith("No. We build whatever app your business needs")).toBe(true);
    expect(breadth.a).toContain(`${COMPANY.name} is also the name of our own product`);
    expect(MOB_TERMS.after).toContain("the same team builds those too");
    expect(MOB_CREDITS.items.find((i) => i.term === "The parts behind it")!.detail).toContain("not because voice is all we build");
    // Each place in its own words: no sentence of it said twice.
    const said_ = [MOB_HERO.sub, range.lead, MOB_KINDS.sub, MOB_KINDS.foot, MOB_TEAM.sub, breadth.a, MOB_TERMS.after].flatMap(split);
    expect(new Set(said_).size).toBe(said_.length);
  });

  it("lists kinds of app and of business, never past work: three groups of four, voice one line of twelve", () => {
    expect(range.groups).toHaveLength(3);
    for (const g of range.groups) expect(g.items, g.head).toHaveLength(4);
    expect(items).toHaveLength(12);
    expect(new Set(items).size).toBe(12);
    for (const i of items) expect(i.length, i).toBeLessThanOrEqual(50);
    expect(items.filter((i) => /\bcalls?\b|\bphone|\bvoice/i.test(i))).toEqual(["Voice and calls, as on this platform"]);
    expect(range.fields.endsWith("this list doesn’t name.")).toBe(true);
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
