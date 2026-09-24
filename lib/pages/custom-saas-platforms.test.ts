import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_INTEGRATIONS } from "@/lib/pages/ai-agents";
import { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { sentences } from "@/lib/pages/home/source";
import { HOME_START } from "@/lib/pages/home/start";
import { buildCsp, classifyPath, DYNAMIC_APP_ROUTES } from "@/lib/security/csp";
import { AUTH, COMPANY, PRICING_TRIAL, SOLUTION_ITEMS, SOLUTIONS_MENU, TRUST } from "@/lib/site";
import { TRANSFER_TIME_LIMIT_SECONDS } from "@/lib/twilio/calls";
import { BREAKER_BASE_OPEN_MS, BREAKER_CONSECUTIVE_FAILURES, BREAKER_MAX_OPEN_MS } from "@/lib/voice/breaker";
import { INTERNAL_SIGNATURE_TOLERANCE_SECONDS, VOICE_PIPELINE_MODES } from "@/lib/voice/contracts";
import { decideMode, type ModeInputs } from "@/lib/voice/mode";
import { VOICE_TOOL_NAMES } from "@/lib/voice/tools/definitions";
import { WEBHOOK_HEADERS } from "@/lib/workflows/payload";
import { WEBHOOK_MAX_ATTEMPTS } from "@/lib/workflows/webhook";
import { CLIP, meshBlobs } from "@/components/site/home/mesh-flow";
import { DEEP_PANEL, HOME_COLORS } from "@/components/site/home/palettes";
import { frameOf, pathsFor } from "@/components/site/solutions/custom-saas-platforms/explorer-frame";
import { CARD, EDGES, LAYER_ORDER, PLACE, VIEW } from "@/components/site/solutions/custom-saas-platforms/map-geometry";
import {
  SAAS_INK,
  SAAS_LIGHTS,
  mirrorMesh,
  type SaasLightId,
} from "@/components/site/solutions/custom-saas-platforms/palette";
import {
  contrast,
  flowReach,
  keyframesBody,
  parseMesh,
  rgb,
  worstInZone,
  worstMoving,
  worstStatic,
} from "@/lib/testing/mesh-contrast";
import {
  ACCREDITATIONS,
  CHECK_KINDS,
  FACTS,
  GRANTS,
  SAAS_BUILD,
  SAAS_CHECKS,
  SAAS_CREDENTIALS,
  SAAS_CREDITS,
  SAAS_FAQ,
  SAAS_HERO,
  SAAS_META,
  SAAS_PLATFORM,
  SAAS_PROTOTYPE,
  SAAS_SCOPE,
  SAAS_START,
  SAAS_TERMS,
  SECTION_IDS,
  TRADEMARKS,
  TRUST_QUOTE,
  faqJsonLd,
  listJoin,
  type DownReason,
  type Hop,
  type PartId,
  type RouteMode,
  type ScopePartId,
  type SectionId,
  type TourLensId,
} from "./custom-saas-platforms";
import { buildDownTable } from "./custom-saas-platforms.server";

/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — every claim the page makes, held to
 * the thing it is about.
 *
 * The page argues that we build complete platforms and that the reader is
 * on one, so its words are only as good as this file. It holds:
 *
 *   - every word read from a source (the menu item, the phone number,
 *     TRUST, HOME_START, the platform's own constants) to that source;
 *   - every count to the repository: floors ("80+") at or under the real
 *     count and within a quarter of it, exact figures exactly;
 *   - the drawing (map-geometry.ts) to itself: every part placed once,
 *     every edge ending on its cards and clear of every other card;
 *   - "Take a part down" to the platform's own routing policy, re-run for
 *     all sixteen masks;
 *   - the scope, the prototype and the checks ledger to their own shape;
 *   - the honesty rules: no price, date, client or badge; certification
 *     words only ever negated; grants only from their grantors; every
 *     third-party mark credited, and every credited mark printed;
 *   - every link to a section, a part or a route that exists;
 *   - every colour on every new mesh to its contrast, at rest and while
 *     the pools flow (lib/testing/mesh-contrast.ts, home.test.ts's maths),
 *     and the deep panel's colours to the zones they are allowed in;
 *   - the route's stylesheets to the motion contract: only
 *     compositor-friendly properties animate, and scroll timelines only
 *     behind the reduced-motion and support gates.
 *
 * A floor means this file never needs editing when unrelated work adds a
 * route or a test. It does need editing when a migration, a Stripe event
 * or a cron step changes: those are exact on purpose, and the copy must
 * change with them.
 * ------------------------------------------------------------------ */

const ROOT = process.cwd();
const DIR = "components/site/solutions/custom-saas-platforms";
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const ITEM = SOLUTION_ITEMS.find((s) => s.id === "custom-saas-platforms")!;
const CALL = { label: SOLUTIONS_MENU.cta.label, href: COMPANY.phoneHref };

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

const SECTIONS = {
  top: SAAS_HERO,
  credentials: SAAS_CREDENTIALS,
  platform: SAAS_PLATFORM,
  scope: SAAS_SCOPE,
  prototype: SAAS_PROTOTYPE,
  build: SAAS_BUILD,
  terms: SAAS_TERMS,
  checks: SAAS_CHECKS,
  faq: SAAS_FAQ,
  start: SAAS_START,
} satisfies Record<SectionId, { title: string; key: string }>;

const PAGE = [SAAS_META, ...Object.values(SECTIONS), SAAS_CREDITS];
const ALL = strings(PAGE);
const CREDITS = strings(SAAS_CREDITS);
const OUTSIDE_CREDITS = strings([SAAS_META, ...Object.values(SECTIONS)]);
const FAQ_QS = new Set(SAAS_FAQ.items.map((i) => i.q));

const part = (id: PartId) => SAAS_PLATFORM.parts.find((p) => p.id === id)!;
const lens = (id: TourLensId) => SAAS_PLATFORM.lenses.find((l) => l.id === id)!;
const scopePart = (id: ScopePartId) => SAAS_SCOPE.parts.find((p) => p.id === id)!;
const edgeOf = (h: Hop) => (typeof h === "string" ? h : h.edge);
const down = buildDownTable();

describe("facts read from their sources", () => {
  it("reads the menu item: its label, description, promise, deliverables and layers", () => {
    expect(SAAS_HERO.eyebrow).toBe(ITEM.label);
    expect(SAAS_HERO.sub.startsWith(ITEM.description)).toBe(true);
    expect(SAAS_BUILD.title).toBe(ITEM.promise);
    expect(SAAS_BUILD.stages.map((s) => s.title)).toEqual(ITEM.deliverables);
    expect(SAAS_TERMS.columns.find((c) => c.id === "get")!.items.slice(0, 3)).toEqual(ITEM.deliverables);
    expect(SAAS_HERO.room.plates.map((p) => p.layer)).toEqual(ITEM.stack);
    expect(SAAS_SCOPE.layers.map((l) => l.name)).toEqual(ITEM.stack);
  });

  it("starts every build with the menu's own phone call", () => {
    expect(SOLUTIONS_MENU.cta.href(ITEM.id)).toBe(COMPANY.phoneHref);
    for (const link of [SAAS_HERO.primary, SAAS_FAQ.talk, SAAS_START.primary, SAAS_CHECKS.missing.cta]) {
      expect(link).toEqual(CALL);
    }
    expect(SAAS_FAQ.phone).toBe(COMPANY.phone);
    expect(SAAS_HERO.note.startsWith(COMPANY.phone)).toBe(true);
    expect(SAAS_START.note.startsWith(COMPANY.phone)).toBe(true);
  });

  it("sends every trial link to the free trial", () => {
    const trial = linksIn(PAGE).filter((l) => /free trial|Try the platform|^Start free$/i.test(l.label));
    expect(trial.length).toBeGreaterThan(3);
    for (const l of trial) expect(l.href, l.label).toBe(PRICING_TRIAL.href);
  });

  it("sends the sign-up step to sign-up and quotes onboarding as the landing does", () => {
    const signup = lens("signup");
    expect(signup.steps.find((s) => s.id === "open")!.check?.href).toBe(AUTH.signup);
    expect(signup.steps.find((s) => s.id === "onboard")!.text).toContain(HOME_START.body);
  });

  it("quotes the homepage's TRUST line, by id, and never contradicts it", () => {
    const company = TRUST.items.find((i) => i.id === "company")!;
    expect(TRUST_QUOTE).toBe(sentences(company.note, 2, 3));
    expect(TRUST_QUOTE).toContain("we hold none");
    expect(SAAS_CREDENTIALS.none.text).toContain(TRUST_QUOTE);
  });

  it("counts the dashboard's screens off the routes that serve them", () => {
    expect(DYNAMIC_APP_ROUTES).toContain("/onboarding");
    expect(part("dashboard").datum).toBe(`${DYNAMIC_APP_ROUTES.length - 1} screens`);
  });

  it("reads the router's modes, the model's tools and the signature window from the voice contracts", () => {
    expect(part("router").datum).toBe(`${VOICE_PIPELINE_MODES.length} modes`);
    expect(part("openai").datum).toBe(`${VOICE_TOOL_NAMES.length} tools`);
    expect(INTERNAL_SIGNATURE_TOLERANCE_SECONDS / 60).toBe(5);
    expect(part("gateway").does).toContain("five minutes");
  });

  it("names the webhook signature header the workflows really send", () => {
    expect(scopePart("connect").ours).toContain(WEBHOOK_HEADERS.signature);
  });

  it("places the data where TRUST places it", () => {
    expect(TRUST.items.find((i) => i.id === "eu")!.note).toContain("eu-west-1, Ireland");
    for (const text of [part("supabase").does, scopePart("region").ours, SAAS_FAQ.items.find((i) => i.id === "data")!.a]) {
      expect(text).toContain("eu-west-1 (Ireland)");
    }
  });

  it("borrows the Google trademark line and the handover line from their pages", () => {
    expect(SAAS_CREDITS.items.find((i) => i.term === "Google")!.detail).toBe(AGENT_INTEGRATIONS.trademarks);
    expect(SAAS_TERMS.columns.find((c) => c.id === "upfront")!.items.at(-1)).toBe(CAA_HANDOVER.after);
  });

  it("calls this page's policy what csp.ts builds for it: a host allowlist that permits inline scripts", () => {
    const scriptSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("script-src "))!;
    const options = { dev: false, supabaseUrl: null, gatewayUrl: null, vercelPreview: false };
    // This page is prerendered, so it gets the static policy...
    expect(classifyPath("/solutions/custom-saas-platforms")).toBe("static");
    const prerendered = scriptSrc(buildCsp({ nonce: null, ...options }));
    expect(prerendered).toContain("'unsafe-inline'");
    expect(prerendered).not.toContain("'nonce-");
    // ...and the signed-in screens a fresh nonce.
    for (const route of DYNAMIC_APP_ROUTES) expect(classifyPath(route), route).toBe("dynamic");
    expect(scriptSrc(buildCsp({ nonce: "A".repeat(24), ...options }))).toMatch(/'nonce-A{24}' 'strict-dynamic'/);
    expect(part("proxy").does).toContain("permits inline scripts");
    expect(ALL.filter((s) => /strict (?:allowlist|policy)/i.test(s))).toEqual([]);
  });
});

describe("counts held to the repository", () => {
  const floor = (fact: "routeHandlers" | "testFiles", count: number) => {
    expect(count, `${fact}: the floor went over the real count`).toBeGreaterThanOrEqual(FACTS[fact]);
    expect(FACTS[fact], `raise FACTS.${fact}: ${count} counted`).toBeGreaterThanOrEqual(0.75 * count);
  };

  it("keeps the route-handler floor at or under the handlers in app/api", () => {
    floor("routeHandlers", walk("app/api").filter((f) => f.endsWith("/route.ts")).length);
  });

  it("keeps the test-file floor at or under the test files in the repository", () => {
    floor("testFiles", walk(".").filter((f) => /\.test\.tsx?$/.test(f)).length);
  });

  it("prints a plus only on a floor", () => {
    const floors = [FACTS.routeHandlers, FACTS.testFiles, ACCREDITATIONS.count].map((n) => `${n}+`);
    const plus = ALL.flatMap((s) => s.match(/\d+\+/g) ?? []);
    expect(plus.length).toBeGreaterThan(0);
    for (const p of plus) expect(floors, p).toContain(p);
  });

  it("counts the migrations exactly", () => {
    const sql = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    expect(sql.length).toBe(FACTS.migrations);
  });

  it("counts the Stripe events the webhook handles exactly", () => {
    const cases = [...read("app/api/billing/webhook/route.ts").matchAll(/case '([^']+)':/g)].map((m) => m[1]);
    expect(new Set(cases).size).toBe(cases.length);
    expect(cases.length).toBe(FACTS.stripeEvents);
  });

  it("names the daily job's steps in the route's order, and the nightly tour follows them", () => {
    const steps = [...read("app/api/cron/daily/route.ts").matchAll(/runCronStep\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(steps).toEqual(FACTS.cronSteps);
    expect(lens("nightly").steps.flatMap((s) => (s.cron ? [s.cron] : []))).toEqual(FACTS.cronSteps);
  });

  it("times the daily job from vercel.json", () => {
    const crons = JSON.parse(read("vercel.json")).crons as { path: string; schedule: string }[];
    expect(crons[0]).toEqual({ path: "/api/cron/daily", schedule: "0 7 * * *" });
    // Vercel Cron runs on UTC.
    const [minute, hour] = crons[0].schedule.split(" ");
    expect(FACTS.cronAt).toBe(`${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`);
  });

  it("serves every screen it counts, and counts every screen it serves", () => {
    for (const route of DYNAMIC_APP_ROUTES) {
      const file = route === "/onboarding" ? "app/onboarding/page.tsx" : `app/(dashboard)${route}/page.tsx`;
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
    }
    const served = readdirSync(path.join(ROOT, "app/(dashboard)"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(ROOT, "app/(dashboard)", d.name, "page.tsx")))
      .map((d) => `/${d.name}`);
    expect(served.sort()).toEqual(DYNAMIC_APP_ROUTES.filter((r) => r !== "/onboarding").sort());
  });

  it("reads the resync batch, the replay buffer and the deploy drain from their files", () => {
    expect(Number(read("lib/voice/sync/index.ts").match(/RESYNC_BATCH = (\d+)/)![1])).toBe(FACTS.resyncBatch);
    const replay = read("services/voice-gateway/src/config.ts").match(/sttReplayBufferMs: ([\d_]+)/)![1];
    expect(Number(replay.replaceAll("_", ""))).toBe(FACTS.sttReplaySeconds * 1000);
    const drain = read("services/voice-gateway/fly.toml").match(/SHUTDOWN_DRAIN_SECONDS = "(\d+)"/)![1];
    expect(Number(drain)).toBe(FACTS.drainSeconds);
  });

  it("reads the versions it prints: Next.js from package.json, Node.js from the gateway's", () => {
    const gateway = JSON.parse(read("services/voice-gateway/package.json")) as { engines: { node: string } };
    expect(gateway.engines.node).toBe(`>=${FACTS.nodeMajor}`);
    expect(read("services/voice-gateway/Dockerfile")).toMatch(new RegExp(`^ARG NODE_VERSION=${FACTS.nodeMajor}$`, "m"));
    const app = JSON.parse(read("package.json")) as { dependencies: { next: string } };
    expect(Number(app.dependencies.next.match(/\d+/)![0])).toBe(FACTS.nextMajor);
  });

  it("matches the constants whose modules the copy may not import", () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(FACTS.webhookAttempts);
    expect(TRANSFER_TIME_LIMIT_SECONDS / 60).toBe(FACTS.transferCapMinutes);
    expect(BREAKER_CONSECUTIVE_FAILURES).toBe(FACTS.breakerFailures);
    expect(BREAKER_BASE_OPEN_MS / 1000).toBe(FACTS.breakerOpenSeconds);
    expect(BREAKER_MAX_OPEN_MS / 60000).toBe(FACTS.breakerMaxMinutes);
  });

  it("says of the failover only what the runbook says was tested", () => {
    const runbook = read("docs/voice-platform.md").replace(/\s+/g, " ");
    for (const phrase of [
      "Switches to ElevenLabs TTS for the rest of the call and re-speaks the unheard text",
      `replaying the last ${FACTS.sttReplaySeconds} s of caller audio`,
      "verified with mocks and documentation",
      "Cartesia TTS/STT/voices and agent creation were checked live",
    ]) {
      expect(runbook, phrase).toContain(phrase);
    }
    expect(existsSync(path.join(ROOT, "services/voice-gateway/test/failover.test.ts"))).toBe(true);
  });
});

describe("the map and the lenses", () => {
  const ids = SAAS_PLATFORM.parts.map((p) => p.id);
  const box = (id: PartId) => {
    const [x, y] = PLACE[id];
    return { l: x - CARD.w / 2, r: x + CARD.w / 2, t: y - CARD.h / 2, b: y + CARD.h / 2 };
  };
  type Box = ReturnType<typeof box>;
  /** How far a point is from a card (0 on or inside it). */
  const gap = ([x, y]: readonly [number, number], b: Box) =>
    Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b));
  const onBorder = (pt: readonly [number, number], b: Box) =>
    gap(pt, b) <= 1 &&
    Math.min(Math.abs(pt[0] - b.l), Math.abs(pt[0] - b.r), Math.abs(pt[1] - b.t), Math.abs(pt[1] - b.b)) <= 1;
  const ends = (edge: string) => edge.split("-") as [PartId, PartId];

  it("draws each of the seventeen parts once, in its own layer", () => {
    expect(ids).toHaveLength(17);
    expect(new Set(ids).size).toBe(17);
    expect(Object.keys(PLACE).sort()).toEqual([...ids].sort());
    expect(Object.keys(LAYER_ORDER).sort()).toEqual(Object.keys(SAAS_PLATFORM.layers).sort());
    const ordered: string[] = Object.values(LAYER_ORDER).flat();
    expect([...ordered].sort()).toEqual([...ids].sort());
    for (const p of SAAS_PLATFORM.parts) expect(LAYER_ORDER[p.layer], p.id).toContain(p.id);
  });

  it("fits every label and datum on its card", () => {
    for (const p of SAAS_PLATFORM.parts) {
      expect(p.label.length, p.label).toBeLessThanOrEqual(14);
      expect(p.datum.length, p.datum).toBeLessThanOrEqual(16);
    }
  });

  it("draws every edge a tour or a route travels", () => {
    const drawn = Object.keys(EDGES);
    const used = [
      ...SAAS_PLATFORM.lenses.flatMap((l) => l.steps.flatMap((s) => (s.hops ?? []).map(edgeOf))),
      ...Object.values(SAAS_PLATFORM.down.routes).flat(),
    ];
    for (const e of used) expect(drawn, e).toContain(e);
  });

  it("starts and ends every edge on its own cards, and keeps it clear of every other", () => {
    for (const [edge, points] of Object.entries(EDGES)) {
      const [from, to] = ends(edge);
      expect(ids, edge).toContain(from);
      expect(ids, edge).toContain(to);
      expect(onBorder(points[0], box(from)), `${edge} starts on ${from}`).toBe(true);
      expect(onBorder(points.at(-1)!, box(to)), `${edge} ends on ${to}`).toBe(true);
      // Every 1% of every segment.
      const samples = points.slice(1).flatMap(([x1, y1], k) => {
        const [x0, y0] = points[k];
        return Array.from({ length: 101 }, (_, f) => [x0 + ((x1 - x0) * f) / 100, y0 + ((y1 - y0) * f) / 100] as const);
      });
      expect(Math.max(...samples.map((pt) => pt[1])), `${edge} below the drawing`).toBeLessThanOrEqual(VIEW.h - 10);
      for (const id of ids) {
        if (id === from || id === to) continue;
        expect(Math.min(...samples.map((pt) => gap(pt, box(id)))), `${edge} runs into ${id}`).toBeGreaterThanOrEqual(4);
      }
    }
    for (const id of ids) {
      const b = box(id);
      expect(b.l >= 0 && b.t >= 0 && b.r <= VIEW.w && b.b <= VIEW.h - 10, `${id} inside the drawing`).toBe(true);
    }
  });

  it("tours at most ten steps a lens, starting on a tour", () => {
    expect(SAAS_PLATFORM.lenses.map((l) => l.id)).toEqual(["signup", "call", "failover", "nightly"]);
    expect(SAAS_PLATFORM.lenses.map((l) => l.id)).toContain(SAAS_PLATFORM.initial);
    for (const l of SAAS_PLATFORM.lenses) {
      expect(l.steps.length, l.id).toBeLessThanOrEqual(10);
      expect(new Set(l.steps.map((s) => s.id)).size, l.id).toBe(l.steps.length);
    }
  });

  it("faults, rings and arrives only on parts that exist", () => {
    const named = [
      ...SAAS_PLATFORM.lenses.flatMap((l) => l.steps.flatMap((s) => [...(s.ring ?? []), ...(s.fault ? [s.fault] : [])])),
      ...Object.values(SAAS_PLATFORM.down.arrives),
    ];
    for (const id of named) expect(ids).toContain(id);
  });

  it("finishes the opening tour on the frame the server draws", () => {
    const signup = lens(SAAS_PLATFORM.initial);
    const end = frameOf(SAAS_PLATFORM, { lens: signup.id, step: signup.steps.length - 1, mask: 0, down });
    expect(end.current).toBe("smartbill");
    for (const s of signup.steps) for (const h of s.hops ?? []) expect(end.traversed.has(edgeOf(h)), edgeOf(h)).toBe(true);
    expect([...end.passed].sort()).toEqual(["api", "customer", "dashboard", "proxy", "stripe", "supabase"]);
    expect(end.voice).toBeNull();
  });

  it("hands the voice to ElevenLabs from the switch on, and not before", () => {
    const failover = lens("failover");
    const at = failover.steps.findIndex((s) => s.id === "switch");
    expect(at).toBeGreaterThan(0);
    failover.steps.forEach((s, step) => {
      const frame = frameOf(SAAS_PLATFORM, { lens: "failover", step, mask: 0, down });
      expect(frame.voice, s.id).toBe(step >= at ? "elevenlabs" : "cartesia");
      expect(frame.faults, s.id).toEqual(s.fault ? [s.fault] : []);
    });
  });

  it("draws each of the sixteen masks as the table routes it", () => {
    for (const row of down) {
      const frame = frameOf(SAAS_PLATFORM, { lens: "down", step: 0, mask: row.mask, down });
      const route = SAAS_PLATFORM.down.routes[row.mode];
      expect(frame.current, `mask ${row.mask}`).toBe(SAAS_PLATFORM.down.arrives[row.mode]);
      expect([...frame.routeEdges].sort(), `mask ${row.mask}`).toEqual([...route].sort());
      expect([...frame.traversed].sort(), `mask ${row.mask}`).toEqual([...route].sort());
      expect(frame.faults, `mask ${row.mask}`).toEqual(row.mask & 1 ? ["gateway"] : []);
      expect(frame.voice, `mask ${row.mask}`).toBe(row.mode === "elevenlabs" ? "elevenlabs" : "cartesia");
    }
    const gatewayDown = frameOf(SAAS_PLATFORM, { lens: "down", step: 0, mask: 1, down });
    expect(gatewayDown.faults).toContain("gateway");
    expect(gatewayDown.current).toBe("elevenlabs");
  });

  it("finds the API on every path", () => {
    expect(pathsFor(SAAS_PLATFORM, "api")).toEqual(expect.arrayContaining(["signup", "call", "failover", "nightly"]));
  });
});

describe("take a part down", () => {
  const inputs = (mask: number): ModeInputs => ({
    channel: "twilio",
    override: null,
    gatewayConfigured: true,
    cartesiaConfigured: true,
    openaiConfigured: true,
    elevenLabsConfigured: true,
    hasCartesiaVoice: true,
    hasManagedAgent: true,
    hasElevenLabsAgent: true,
    agentBudgetExhausted: false,
    gatewayBreakerOpen: Boolean(mask & 1),
    creditsExhausted: Boolean(mask & 2),
    selfBreakerOpen: Boolean(mask & 4),
    managedBreakerOpen: Boolean(mask & 8),
  });
  const copy = SAAS_PLATFORM.down;

  it("asks the platform's own routing policy about all sixteen masks", () => {
    expect(down).toHaveLength(16);
    down.forEach((row, mask) => {
      const d = decideMode(inputs(mask));
      expect(row, `mask ${mask}`).toEqual({ mask, mode: d.mode, reason: d.reason });
    });
  });

  it.each<[number, RouteMode, DownReason | undefined]>([
    [0, "cartesia_self", "credits_available"],
    [1, "elevenlabs", "gateway_breaker_open"],
    [2, "cartesia_managed", "credits_exhausted"],
    [4, "cartesia_managed", "self_breaker_open"],
    [8, "cartesia_self", undefined],
    [10, "elevenlabs", "managed_breaker_open"],
  ])("routes mask %i to %s", (mask, mode, reason) => {
    expect(down[mask].mode).toBe(mode);
    if (reason) expect(down[mask].reason).toBe(reason);
  });

  it("labels each switch with the input its bit sets", () => {
    expect(Object.fromEntries(copy.switches.map((s) => [s.id, s.bit]))).toEqual({
      gateway: 1,
      credits: 2,
      self: 4,
      managed: 8,
    });
  });

  it("has a sentence for every reason and a name for every mode, and none that never happens", () => {
    expect([...new Set(down.map((r) => r.reason))].sort()).toEqual(Object.keys(copy.whys).sort());
    expect([...new Set(down.map((r) => r.mode))].sort()).toEqual(Object.keys(copy.modes).sort());
    for (const row of down) expect(copy.whys[row.reason].length, row.reason).toBeGreaterThan(0);
  });

  it("routes every call from the caller to the part it arrives at", () => {
    for (const [mode, route] of Object.entries(copy.routes) as [keyof typeof copy.routes, readonly string[]][]) {
      expect(route[0], mode).toBe("caller-twilio");
      const arrives = copy.arrives[mode];
      expect(route.some((e) => e.endsWith(`-${arrives}`)), mode).toBe(true);
    }
  });

  it("points at the code that decides", () => {
    expect(existsSync(path.join(ROOT, copy.sourcePath))).toBe(true);
    expect(read(copy.sourcePath)).toContain("export function decideMode(");
  });
});

describe("scope", () => {
  const S = SAAS_SCOPE;
  const built = (on: readonly string[]) => S.parts.filter((p) => p.needs.length === 0 || p.needs.some((n) => on.includes(n)));

  it("lays the seventeen parts across the menu's four layers, once each, in order", () => {
    expect(S.parts).toHaveLength(17);
    expect(new Set(S.parts.map((p) => p.id)).size).toBe(17);
    expect(S.layers.flatMap((l) => l.parts)).toEqual(S.parts.map((p) => p.id));
  });

  it("builds every part from needs that exist, and every need builds something", () => {
    const needs = S.needs.map((n) => n.id);
    const groups = S.groups.map((g) => g.id);
    for (const n of S.needs) expect(groups).toContain(n.group);
    for (const g of groups) expect(S.needs.some((n) => n.group === g), g).toBe(true);
    for (const p of S.parts) for (const n of p.needs) expect(needs, p.id).toContain(n);
    for (const n of needs) expect(S.parts.some((p) => p.needs.includes(n)), n).toBe(true);
    for (const n of S.initial) expect(needs).toContain(n);
    expect(S.parts.map((p) => p.id)).toContain(S.initialPart);
    for (const p of S.parts) if (p.map) expect(SAAS_PLATFORM.parts.map((q) => q.id), p.id).toContain(p.map);
  });

  it("always builds the bones, and adds what Subscriptions needs", () => {
    expect(built([]).map((p) => p.id)).toEqual(["auth", "screens", "policy", "data", "schema", "hosting", "jobs", "watch"]);
    const first = built(S.initial);
    expect(first).toHaveLength(10);
    expect(first.filter((p) => p.needs.length).map((p) => p.id)).toEqual(["plans", "fiscal"]);
    expect(built(S.needs.map((n) => n.id))).toHaveLength(17);
  });

  it("says where ours proves nothing, in so many words", () => {
    for (const p of S.parts) {
      if (p.kind === "none") expect(p.ours.startsWith("Not on ours"), p.id).toBe(true);
      else if (p.kind === "thin") expect(p.ours.startsWith("Thin on ours"), p.id).toBe(true);
      else expect(p.ours, p.id).not.toMatch(/^(?:Not|Thin) on ours/);
    }
    expect(Object.keys(S.kinds).sort()).toEqual(["does", "none", "thin"]);
  });
});

describe("prototype", () => {
  const screens = SAAS_PROTOTYPE.screens;
  const byId = new Map(screens.map((s) => [s.id, s]));

  it("links every screen, from sign-up, with at least one hotspot each", () => {
    for (const s of screens) {
      expect(s.hotspots.length, s.id).toBeGreaterThan(0);
      for (const h of s.hotspots) expect(byId.has(h.to), `${s.id} → ${h.to}`).toBe(true);
    }
    const seen = new Set(["signup"]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const s of screens) {
        if (!seen.has(s.id)) continue;
        for (const h of s.hotspots) {
          if (seen.has(h.to)) continue;
          seen.add(h.to);
          grew = true;
        }
      }
    }
    expect([...seen].sort()).toEqual(screens.map((s) => s.id).sort());
    expect(new Set(screens.map((s) => s.title)).size).toBe(screens.length);
    expect(screens.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("slides each hotspot the way it goes, and names it by its visible label and its destination", () => {
    for (const s of screens) {
      for (const h of s.hotspots) {
        const to = byId.get(h.to)!;
        expect(h.dir, `${s.id} → ${h.to}`).toBe(to.n > s.n ? "forward" : "back");
        expect(h.aria, h.aria).toContain(h.label);
        expect(h.aria, h.aria).toContain(to.step);
      }
    }
  });

  it("invents no figures and no prices", () => {
    for (const s of screens) expect(strings([s.title, s.blocks]).filter((t) => /\d/.test(t)), s.id).toEqual([]);
  });
});

describe("checks", () => {
  const rows = SAAS_CHECKS.rows;

  it("lists each claim once", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("filters by the three ways to check, every one of them used", () => {
    expect(SAAS_CHECKS.filters.map((f) => f.id)).toEqual(["all", ...Object.keys(CHECK_KINDS)]);
    expect(Object.keys(SAAS_CHECKS.kinds)).toEqual(Object.keys(CHECK_KINDS));
    const counts = Object.keys(CHECK_KINDS).map((k) => rows.filter((r) => r.kind === k).length);
    for (const n of counts) expect(n).toBeGreaterThan(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(rows.length);
  });
});

describe("credentials, honestly", () => {
  const COMPANIES = [
    "Anthropic",
    "Cartesia",
    "ElevenLabs",
    "OpenAI",
    "Stripe",
    "SmartBill",
    "Supabase",
    "Twilio",
    "Vercel",
    "Google",
    "Slack",
    "Fly.io",
  ];
  const grantors = GRANTS.map((g) => g.grantor);

  it("counts the accreditations as the owner states them, and prints them as a floor", () => {
    expect(ACCREDITATIONS.count).toBeGreaterThanOrEqual(20);
    expect(ACCREDITATIONS.holders).toBe("personal");
    expect(SAAS_CREDENTIALS.accreditations.figure).toBe(`${ACCREDITATIONS.count}+`);
    const counted = ALL.filter((s) => /accreditation/i.test(s) && /\d/.test(s));
    expect(counted.length).toBeGreaterThan(0);
    for (const s of counted) expect(s).toContain(`${ACCREDITATIONS.count}+`);
  });

  it("names only the grantors in a sentence about grants", () => {
    const about = ALL.flatMap(split).filter((s) => /\bgrants?\b/i.test(s));
    expect(about.length).toBeGreaterThan(0);
    for (const s of about) {
      for (const c of COMPANIES) {
        if (grantors.includes(c) || !s.includes(c)) continue;
        // One exception: the credentials sub names Anthropic's accreditations beside the grants.
        expect(c === "Anthropic" && /accreditation/i.test(s), s).toBe(true);
      }
    }
    expect(ALL.filter((s) => /grants?[^.]*\bfrom Anthropic|Anthropic[^.]*\bawarded/.test(s))).toEqual([]);
  });

  it("names Anthropic only beside the Claude accreditations", () => {
    const naming = records(PAGE).filter((r) => r.includes("Anthropic"));
    expect(naming.length).toBeGreaterThan(0);
    for (const r of naming) expect(r, r).toMatch(/Claude|accreditation/);
  });

  it("uses a certification word only to say there is none", () => {
    const risky = /certif|badge|\bseal\b|endorse|\bpartner|\bofficial\b|testimonial|\bclients?\b|trusted by/i;
    const negated = /\b(?:no|not|none|never)\b|n’t\b/i;
    const claims = ALL.filter((s) => !FAQ_QS.has(s))
      .flatMap(split)
      .filter((s) => risky.test(s));
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.filter((s) => !negated.test(s))).toEqual([]);
  });

  it("offers them on the call until there is a public link", () => {
    const row = SAAS_CHECKS.rows.find((r) => r.id === "accreditations")!;
    if (ACCREDITATIONS.verify === null) {
      expect(SAAS_CREDENTIALS.accreditations.check.kind).toBe("call");
      expect(row.kind).toBe("call");
    } else {
      expect(SAAS_CREDENTIALS.accreditations.check).toMatchObject({ kind: "site", href: ACCREDITATIONS.verify.href });
    }
    if (GRANTS.every((g) => g.verify === null)) expect(SAAS_CREDENTIALS.grants.check.kind).toBe("call");
  });

  it("marks on the map exactly the parts the grants run on", () => {
    expect(new Set(GRANTS.map((g) => g.id)).size).toBe(GRANTS.length);
    const marked = SAAS_PLATFORM.parts.filter((p) => p.grant).map((p) => p.id);
    expect([...marked].sort()).toEqual(GRANTS.map((g) => g.part).sort());
    expect(SAAS_CREDENTIALS.grants.rows).toEqual(
      GRANTS.map((g) => ({ id: g.id, grantor: g.grantor, part: g.part, runs: g.runs })),
    );
    expect(SAAS_HERO.proof.find((p) => p.label === "Startup grants")!.term).toBe(listJoin(grantors));
  });
});

describe("no price, date, client or badge", () => {
  it("prints no price, duration, standard or scale claim", () => {
    const banned =
      /[$€£]\s?\d|\b\d+\s*(?:days?|weeks?|months?|years?)\b|\bSOC ?2\b|\bISO ?27001\b|\bHIPAA\b|\bcertified\b|\bin production\b|at scale/i;
    expect(ALL.filter((s) => banned.test(s))).toEqual([]);
  });

  it("prints no date", () => {
    const month = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    expect(ALL.filter((s) => /\b(?:19|20)\d{2}\b/.test(s) || month.test(s))).toEqual([]);
  });
});

describe("links go somewhere", () => {
  const routes = walk("app")
    .filter((f) => /(?:^|\/)page\.tsx$/.test(f))
    .map((f) => {
      const segments = f.split("/").slice(1, -1).filter((s) => !/^\(.*\)$/.test(s));
      return new RegExp(`^/${segments.map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s)).join("/")}$`);
    });
  const landing = readdirSync(path.join(ROOT, "components/site/home"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => read(`components/site/home/${f}`))
    .join("\n");
  const links = hrefs(PAGE);

  it("finds a link to follow", () => {
    expect(links.length).toBeGreaterThan(10);
  });

  it.each(links.map((h) => [h]))("%s resolves", (href) => {
    if (href.startsWith("tel:")) expect(href).toBe(COMPANY.phoneHref);
    else if (href.startsWith("#")) {
      const id = href.slice(1);
      const partIds: string[] = SAAS_PLATFORM.parts.map((p) => `part-${p.id}`);
      expect([...SECTION_IDS, ...partIds]).toContain(id);
    } else if (href.startsWith("/#")) {
      expect(routes.some((r) => r.test("/"))).toBe(true);
      expect(landing).toContain(`<section id="${href.slice(2)}"`);
    } else if (href.startsWith("/")) {
      const route = href.replace(/[?#].*$/, "");
      expect(routes.some((r) => r.test(route)), route).toBe(true);
    } else {
      expect(href).toMatch(/^https:\/\//);
    }
  });

  it("never points to a contact page that does not exist", () => {
    expect(links.filter((h) => /\/contact\b/.test(h))).toEqual([]);
  });
});

describe("headings", () => {
  it("gives each of the ten sections a key phrase copied from its title", () => {
    expect(Object.keys(SECTIONS)).toEqual([...SECTION_IDS]);
    for (const [id, s] of Object.entries(SECTIONS)) {
      expect(typeof s.title, id).toBe("string");
      expect(typeof s.key, id).toBe("string");
      // The payoff, never the first word and never the whole heading.
      expect(s.title.lastIndexOf(s.key), id).toBeGreaterThan(0);
      expect(s.key.trim(), id).toBe(s.key);
    }
  });

  it("keeps the FAQ's phrase quiet, and only the FAQ's", () => {
    const toned = Object.entries(SECTIONS).flatMap(([id, s]) => ("keyTone" in s ? [[id, s.keyTone]] : []));
    expect(toned).toEqual([["faq", "quiet"]]);
  });

  it("builds the FAQ's structured data from the rows the page renders", () => {
    const ld = faqJsonLd(SAAS_FAQ.items);
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(SAAS_FAQ.items.map((i) => [i.q, i.a]));
  });
});

describe("templates", () => {
  const slots = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const TEMPLATES: [string, string, string[]][] = [
    ["the explorer's step", SAAS_PLATFORM.stepOf, ["n", "total"]],
    ["the explorer's announcement", SAAS_PLATFORM.live, ["n", "text", "total"]],
    ["the explorer's index", SAAS_PLATFORM.indexSummary, ["n"]],
    ["the switchboard's announcement", SAAS_PLATFORM.down.live, ["name", "why"]],
    ["the scope's summary", SAAS_SCOPE.summary.some, ["k", "n"]],
    ["the scope's bones", SAAS_SCOPE.summary.none, ["n"]],
    ["the scope's added", SAAS_SCOPE.live.added, ["label", "n"]],
    ["the scope's removed", SAAS_SCOPE.live.removed, ["label", "n"]],
    ["the prototype's announcement", SAAS_PROTOTYPE.live, ["n", "title", "total"]],
    ["the checks' count", SAAS_CHECKS.showing, ["n", "total"]],
  ];

  it.each(TEMPLATES)("%s fills exactly its slots", (_, template, want) => {
    expect(slots(template)).toEqual(want);
  });

  it("leaves no slot anywhere else in the copy", () => {
    const templates = new Set(TEMPLATES.map((t) => t[1]));
    expect(ALL.filter((s) => /[{}]/.test(s) && !templates.has(s))).toEqual([]);
  });
});

describe("credits", () => {
  // Third-party names a page like this could print. Each one printed must be
  // credited in a line that says whose trademark it is.
  const REGISTRY = [
    "Anthropic",
    "Claude",
    "Google",
    "Gmail",
    "Android",
    "Apple",
    "iOS",
    "Microsoft",
    "Amazon",
    "AWS",
    "GitHub",
    "Cartesia",
    "ElevenLabs",
    "OpenAI",
    "Stripe",
    "SmartBill",
    "Supabase",
    "Postgres",
    "PostgreSQL",
    "Twilio",
    "Telnyx",
    "Vercel",
    "Next.js",
    "Node.js",
    "React",
    "Fly.io",
    "Slack",
    "Upstash",
    "Redis",
    "WhatsApp",
    "Zapier",
    "HubSpot",
    "Salesforce",
  ];
  /** A printed name and the name its credit uses. */
  const CREDITED_AS: Record<string, string> = { Postgres: "PostgreSQL" };
  const named = (mark: string, s: string) => new RegExp(`\\b${mark.replace(/[.]/g, "\\.")}\\b`).test(s);
  const creditLines = CREDITS.flatMap(split).filter((s) => /trademarks? of/.test(s));
  const tmLine = SAAS_CREDITS.items.find((i) => i.detail.startsWith(listJoin(TRADEMARKS)))!;

  it("prints every mark it credits", () => {
    for (const mark of TRADEMARKS) {
      const printed = mark === "PostgreSQL" ? /\bPostgres(?:QL)?\b/ : new RegExp(`\\b${mark.replace(/[.]/g, "\\.")}\\b`);
      expect(OUTSIDE_CREDITS.some((s) => printed.test(s)), mark).toBe(true);
    }
  });

  it("credits every mark it prints", () => {
    const printed = REGISTRY.filter((mark) => ALL.some((s) => named(mark, s)));
    expect(printed.length).toBeGreaterThan(10);
    const uncredited = printed.filter((mark) => !creditLines.some((l) => named(CREDITED_AS[mark] ?? mark, l)));
    expect(uncredited).toEqual([]);
  });

  it("says it once, and says it is not an endorsement", () => {
    expect(tmLine).toBeDefined();
    expect(ALL.filter((s) => s.includes("trademarks of their respective owners"))).toHaveLength(1);
    expect(tmLine.detail).toContain("not an endorsement");
  });

  it("names Anthropic's owner exactly", () => {
    expect(SAAS_CREDITS.items.find((i) => i.term === "Anthropic and Claude")!.detail).toContain("Anthropic, PBC");
  });
});

describe("mesh colour", () => {
  const css = read(`${DIR}/saas.css`);
  const pricing = read("components/site/home/pricing.css");
  const CLASS: Record<SaasLightId, string> = {
    room: "room",
    roomMirror: "room-m",
    papers: "papers",
    stage: "stage",
    stageMirror: "stage-m",
  };
  const LIGHTS = Object.entries(SAAS_LIGHTS) as [SaasLightId, (typeof SAAS_LIGHTS)[SaasLightId]][];
  /** A rule's body, from its selector to its first closing brace. */
  const rule = (source: string, selector: string) => {
    const at = source.indexOf(`${selector} {`);
    return at < 0 ? "" : source.slice(at, source.indexOf("}", at));
  };
  const reach = flowReach(css, "saas-flow-x", "saas-flow-y");
  const STOP = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\) (\d+)%/g;

  it("declares each light in saas.css, value for value", () => {
    for (const [id, l] of LIGHTS) {
      const b = rule(css, `.pp .saas-light-${CLASS[id]}`);
      expect(b.length, id).toBeGreaterThan(0);
      expect(b, `${id} ground`).toContain(`--saas-ground: ${l.ground};`);
      expect(b, `${id} floor`).toContain(`--saas-floor: ${l.floor};`);
      expect(l.floor, id).toBe(l.ground.match(/, (#[0-9a-f]{6})$/)![1]);
    }
  });

  it("mirrors a repeated light, never copies it", () => {
    expect(SAAS_LIGHTS.roomMirror.ground).toBe(mirrorMesh(SAAS_LIGHTS.room.ground));
    expect(SAAS_LIGHTS.stageMirror.ground).toBe(mirrorMesh(SAAS_LIGHTS.stage.ground));
    expect(SAAS_LIGHTS.roomMirror.ground).not.toBe(SAAS_LIGHTS.room.ground);
    expect(SAAS_LIGHTS.stageMirror.ground).not.toBe(SAAS_LIGHTS.stage.ground);
    for (const [id, l] of LIGHTS) expect(mirrorMesh(mirrorMesh(l.ground)), id).toBe(l.ground);
  });

  it("sets the measured tokens on every lit surface, and points the landing's at them", () => {
    const lit = [...css.matchAll(/\.pp \.saas-lit \{([^}]*)\}/g)].map((m) => m[1]).join("\n");
    expect(lit).toContain(`--saas-text: ${SAAS_INK.text};`);
    expect(lit).toContain(`--saas-dim: ${SAAS_INK.dim};`);
    expect(lit).toContain(`--saas-accent: ${SAAS_INK.accent};`);
    expect(lit).toContain(`--saas-tick: ${SAAS_INK.tick};`);
    expect(lit).toContain("--pp-ink: var(--saas-text);");
    expect(lit).toContain("--pp-muted: var(--saas-dim);");
    expect(lit).toContain("--pp-accent: var(--saas-accent);");
    expect(rule(css, ".pp .saas-lit .home-link")).toContain("color: var(--saas-accent);");
  });

  it("flows exactly as #pricing's plan cards do", () => {
    for (const axis of ["x", "y"]) {
      expect(keyframesBody(css, `saas-flow-${axis}`), axis).toBe(keyframesBody(pricing, `home-plan-flow-${axis}`));
    }
    const clock = (source: string, selector: string) => {
      const b = rule(source, selector);
      return ["fx", "fy", "dx", "dy"].map((k) => b.match(new RegExp(`--${k}: ([^;]+);`))?.[1]);
    };
    for (let n = 1; n <= 7; n++) {
      const ours = clock(css, `.pp .saas-mesh > span:nth-child(${n})`);
      expect(ours.every(Boolean), `pool ${n}`).toBe(true);
      expect(ours, `pool ${n}`).toEqual(clock(pricing, `.pp .home-plan-mesh > span:nth-child(${n})`));
    }
    for (const [id, l] of LIGHTS) expect(parseMesh(l.ground).pools.length, id).toBeLessThanOrEqual(7);
    expect(css).toMatch(/\.pp \.saas-lit:not\(\[data-live\]\) > \.saas-mesh > span \{\s*animation-name: none;\s*\}/);
    expect(rule(css, ".pp .saas-lit[data-swap] > .saas-mesh > span")).toContain("animation-direction: var(--dy), var(--dx);");
  });

  it("shows the flow only where motion is welcome and the hardware can take it", () => {
    const gate =
      /@media \(prefers-reduced-motion: no-preference\) \{\s*:root:not\(\[data-weak\]\):not\(\[data-tier="still"\]\) \.pp \.saas-mesh \{\s*display: block;\s*\}\s*\}/g;
    expect(css.match(gate)).toHaveLength(1);
    const mesh = rule(css, ".pp .saas-mesh");
    expect(mesh).toContain("display: none;");
    expect(mesh).toContain(`inset: ${CLIP}px;`);
    // Outside the gate, nothing turns the flow on.
    const rest = css.replace(gate, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const shown = [...rest.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(
      (m) => m[1].includes("saas-mesh") && /display:(?!\s*none\b)/.test(m[2]),
    );
    expect(shown.map((m) => m[1].trim())).toEqual([]);
  });

  it("lays each light's pools out as their own elements, stacking back into its ground", () => {
    // A calc(P% +/- Qpx) inside the clip, as px from the clip's edge (home.test.ts).
    const inClip = (v: unknown, size: number) => {
      const m = String(v).match(/^calc\((-?[\d.]+)% ([+-]) ([\d.]+)px\)$|^(-?[\d.]+)px$/)!;
      return m[4] !== undefined
        ? Number(m[4])
        : (Number(m[1]) / 100) * (size - 2 * CLIP) + (m[2] === "-" ? -1 : 1) * Number(m[3]);
    };
    for (const [id, l] of LIGHTS) {
      const pools = parseMesh(l.ground).pools;
      const blobs = meshBlobs(l.ground);
      expect(blobs.length, id).toBe(pools.length);
      for (const [W, H] of [
        [300, 700],
        [1176, 720],
      ]) {
        // Bottom pool first, so the top one paints last.
        blobs.forEach((b, n) => {
          const p = pools[pools.length - 1 - n];
          const rw = p.rx[1] === "px" ? p.rx[0] : (p.rx[0] / 100) * W;
          const rh = p.ry[1] === "px" ? p.ry[0] : (p.ry[0] / 100) * H;
          expect(inClip(b.left, W) + CLIP, `${id} ${n} left`).toBeCloseTo((p.x / 100) * W - rw, 2);
          expect(inClip(b.top, H) + CLIP, `${id} ${n} top`).toBeCloseTo((p.y / 100) * H - rh, 2);
          expect(inClip(b.width, W), `${id} ${n} width`).toBeCloseTo(2 * rw, 2);
          expect(inClip(b.height, H), `${id} ${n} height`).toBeCloseTo(2 * rh, 2);
          expect(String(b.background)).toMatch(/^radial-gradient\(closest-side, /);
          expect([...String(b.background).matchAll(STOP)].map((st) => Number(st[4]))).toEqual(p.stops.map((st) => st.a));
        });
      }
    }
  });

  it("reads every pool off every recipe, each the landing's soft seven-stop falloff", () => {
    const GAUSS = [1, 0.835, 0.576, 0.325, 0.149, 0.056, 0];
    for (const [id, l] of LIGHTS) {
      const pools = parseMesh(l.ground).pools;
      expect(pools.length, id).toBeGreaterThanOrEqual(5);
      for (const p of pools) {
        expect(p.stops.map((s) => s.p), id).toEqual([0, 20, 35, 50, 65, 80, 100]);
        p.stops.forEach((s, k) => {
          expect(s.c, id).toEqual(p.stops[0].c);
          expect(Math.abs(s.a - p.stops[0].a * GAUSS[k]), `${id} stop ${k}`).toBeLessThanOrEqual(0.0015);
        });
        expect(p.stops.at(-1)!.a, id).toBe(0);
      }
      // Far enough to see: the biggest pool crosses a fifth of the surface each way, or 100px on a px recipe.
      const px = pools[0].rx[1] === "px";
      const most = Math.max(...pools.map((p) => 2 * p.rx[0] * reach.x));
      expect(most, id).toBeGreaterThanOrEqual(px ? 100 : 20);
    }
  });

  // Every size each light renders at (W × H px, §6.2 of the build spec),
  // with the figures measured there: [still, flowing], the worst over the set.
  const HERO_ROOM: [number, number][] = [
    [343, 560],
    [704, 480],
    [440, 580],
    [480, 560],
    [560, 520],
  ];
  const SCOPE_ROOM: [number, number][] = [
    [343, 1000],
    [704, 720],
    [808, 640],
    [856, 620],
  ];
  const PAPERS: [number, number][] = [
    [343, 1600],
    [704, 1150],
    [944, 780],
    [1176, 720],
  ];
  const BUILD_CARDS: [number, number][] = [
    [298, 640],
    [376, 540],
    [343, 600],
    [704, 400],
  ];
  type Measured = Record<keyof typeof SAAS_INK, [number, number]>;
  const SURFACES: [string, SaasLightId[], [number, number][], Measured][] = [
    [
      "the hero and scope rooms",
      ["room", "roomMirror"],
      [...HERO_ROOM, ...SCOPE_ROOM],
      { text: [12.47, 12.02], dim: [7.58, 7.31], accent: [5.86, 5.65], tick: [3.72, 3.58] },
    ],
    [
      "the credentials card",
      ["papers"],
      PAPERS,
      { text: [12.75, 12.48], dim: [7.75, 7.59], accent: [5.99, 5.87], tick: [3.8, 3.72] },
    ],
    [
      "the build cards",
      ["stage", "stageMirror"],
      BUILD_CARDS,
      { text: [13.53, 12.07], dim: [8.23, 7.34], accent: [6.36, 5.67], tick: [4.03, 3.6] },
    ],
  ];
  const MOVING_MARGIN = 0.2;

  it.each(SURFACES)(
    "%s: text clears 4.5:1 and marks 3:1, still and flowing, as measured",
    (_, lights, boxes, measured) => {
      for (const token of Object.keys(SAAS_INK) as (keyof typeof SAAS_INK)[]) {
        const fg = SAAS_INK[token];
        const still = Math.min(...lights.map((id) => worstStatic(SAAS_LIGHTS[id].ground, fg, boxes)));
        const flowing = Math.min(...lights.map((id) => worstMoving(SAAS_LIGHTS[id].ground, fg, boxes, reach)));
        const bar = token === "tick" ? 3 : 4.5;
        expect(still, `${token} still`).toBeGreaterThanOrEqual(bar);
        expect(flowing, `${token} flowing`).toBeGreaterThanOrEqual(bar + MOVING_MARGIN);
        expect(still, `${token} still`).toBeCloseTo(measured[token][0], 1);
        expect(flowing, `${token} flowing`).toBeCloseTo(measured[token][1], 1);
      }
    },
  );

  it("keeps the landing's violet and muted off a flowing light: why the guards exist", () => {
    for (const fg of [HOME_COLORS.violet, HOME_COLORS.muted]) {
      expect(worstMoving(SAAS_LIGHTS.room.ground, fg, [...HERO_ROOM, ...SCOPE_ROOM], reach), fg).toBeLessThan(
        4.5 + MOVING_MARGIN,
      );
    }
  });

  // #start's deep panel (DEEP_PANEL, static): wide and narrow panel sizes,
  // and the zones (fractions of the panel) each colour is allowed in.
  const WIDE: [number, number][] = [
    [944, 460],
    [1176, 420],
  ];
  const NARROW: [number, number][] = [
    [343, 760],
    [704, 600],
  ];
  const ANYWHERE = [0, 0, 1, 1] as const;

  it("reads on the deep panel: on-deep and paper anywhere", () => {
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.onDeep, [...WIDE, ...NARROW], ANYWHERE)).toBeCloseTo(4.93, 1);
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.paper, [...WIDE, ...NARROW], ANYWHERE)).toBeCloseTo(4.85, 1);
    for (const fg of [HOME_COLORS.onDeep, HOME_COLORS.paper]) {
      expect(worstInZone(DEEP_PANEL, fg, [...WIDE, ...NARROW], ANYWHERE), fg).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each<[string, string, [number, number][], [number, number, number, number], number]>([
    ["lilac, wide", HOME_COLORS.lilac, WIDE, [0, 0, 0.62, 0.62], 6.25],
    ["lilac, narrow", HOME_COLORS.lilac, NARROW, [0, 0, 1, 0.45], 5.76],
    ["on-deep-dim, wide", HOME_COLORS.onDeepDim, WIDE, [0, 0, 0.7, 0.8], 7.07],
    ["on-deep-dim, narrow", HOME_COLORS.onDeepDim, NARROW, [0, 0, 1, 0.6], 6.78],
  ])("reads on the deep panel: %s inside its zone", (_, fg, boxes, zone, measured) => {
    const worst = worstInZone(DEEP_PANEL, fg, boxes, zone);
    expect(worst).toBeGreaterThanOrEqual(4.5);
    expect(worst).toBeCloseTo(measured, 1);
  });

  it("keeps lilac out of the deep panel's electric corner", () => {
    expect(worstInZone(DEEP_PANEL, HOME_COLORS.lilac, [...WIDE, ...NARROW], ANYWHERE)).toBeLessThan(4.5);
    expect(contrast(rgb(HOME_COLORS.lilac), rgb("#5b21b6"))).toBeCloseTo(4.17, 1);
  });

  const WHITE = "#ffffff";
  it.each<[string, string, string, number, number]>([
    ["electric on stage: route edges, the current ring, the bead", HOME_COLORS.electric, HOME_COLORS.stage, 4.82, 3],
    ["electric on wash: #build's rail and stations", HOME_COLORS.electric, HOME_COLORS.wash, 5.21, 3],
    ["ember-lit on ink: a pressed switch's dot", HOME_COLORS.emberLit, HOME_COLORS.ink, 11.26, 3],
    ["ember on white: the fault slash", HOME_COLORS.ember, WHITE, 3.54, 3],
    ["white on electric: the Speaking pill", WHITE, HOME_COLORS.electric, 5.7, 4.5],
    ["muted on white: a card's datum", HOME_COLORS.muted, WHITE, 6.37, 4.5],
    ["violet on white: a plate's datum, a tile's tag", HOME_COLORS.violet, WHITE, 7.1, 4.5],
    ["muted on stage: labels on the stage", HOME_COLORS.muted, HOME_COLORS.stage, 5.39, 4.5],
    ["violet on wash: #build's key phrase", HOME_COLORS.violet, HOME_COLORS.wash, 6.49, 4.5],
  ])("%s clears its bar, as measured", (_, fg, bg, measured, bar) => {
    const ratio = contrast(rgb(fg), rgb(bg));
    expect(ratio).toBeGreaterThanOrEqual(bar);
    expect(ratio).toBeCloseTo(measured, 1);
  });
});

describe("the route's stylesheets", () => {
  // Every stylesheet the route ships: the shared saas.css and each
  // section's own file beside it (and any in the route's app folder).
  const sheets = [DIR, "app/solutions/custom-saas-platforms"]
    .filter((dir) => existsSync(path.join(ROOT, dir)))
    .flatMap((dir) => readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".css")).map((f) => `${dir}/${f}`));

  /** A stylesheet's blocks and declarations, each with the preludes it sits inside, outermost first. */
  const scan = (source: string) => {
    const src = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks: { prelude: string; within: string[] }[] = [];
    const decls: { prop: string; value: string; within: string[] }[] = [];
    const stack: string[] = [];
    let from = 0;
    const flush = (to: number) => {
      const text = src.slice(from, to).trim();
      const colon = text.indexOf(":");
      if (stack.length && colon > 0) {
        decls.push({ prop: text.slice(0, colon).trim(), value: text.slice(colon + 1).trim(), within: [...stack] });
      }
    };
    for (let i = 0; i < src.length; i++) {
      if (src[i] === "{") {
        const prelude = src.slice(from, i).trim();
        blocks.push({ prelude, within: [...stack] });
        stack.push(prelude);
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
    return { blocks, decls };
  };
  /** Selectors split at their top-level commas. */
  const selectors = (prelude: string) => {
    const out: string[] = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < prelude.length; i++) {
      if (prelude[i] === "(" || prelude[i] === "[") depth++;
      else if (prelude[i] === ")" || prelude[i] === "]") depth--;
      else if (prelude[i] === "," && depth === 0) {
        out.push(prelude.slice(from, i).trim());
        from = i + 1;
      }
    }
    return [...out, prelude.slice(from).trim()];
  };
  const isAt = (prelude: string) => prelude.startsWith("@");
  const inKeyframes = (within: string[]) => within.some((p) => p.startsWith("@keyframes"));
  // What may animate: colour, transform, translate, scale and opacity, and
  // the page's own registered numbers (`@property --saas-rail`).
  const ANIMATABLE =
    /^(?:opacity|transform|translate|scale|color|background-color|border-color|outline-color|fill|stroke|--saas-[\w-]+|animation-timing-function)$/;
  const TIMELINE = /^(?:view-timeline|view-timeline-name|scroll-timeline|scroll-timeline-name|animation-timeline|timeline-scope)$/;

  it("finds the shared stylesheet, and the page imports every sheet once", () => {
    expect(sheets).toContain(`${DIR}/saas.css`);
    const page = read("app/solutions/custom-saas-platforms/page.tsx");
    const escaped = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const sheet of sheets) {
      const from = new RegExp(`^import ["'](?:@/${escaped(sheet)}|\\./${escaped(path.basename(sheet))})["'];`, "gm");
      expect(page.match(from)?.length ?? 0, sheet).toBe(1);
    }
  });

  it.each(sheets.map((s) => [s]))("%s keeps every rule under .pp and every class and keyframe prefixed", (sheet) => {
    const { blocks } = scan(read(sheet));
    for (const b of blocks) {
      if (isAt(b.prelude) || inKeyframes(b.within)) continue;
      for (const sel of selectors(b.prelude)) {
        // A top-level rule starts at the page's <main> (.pp), or at <html> for the tier and view transitions.
        if (b.within.every(isAt)) expect(sel, sheet).toMatch(/^(?:\.pp(?![\w-])|html(?![\w-])|:root(?![\w-]))/);
        for (const [, cls] of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
          expect(cls, `${sheet}: ${sel}`).toMatch(/^(?:saas-|home-)|^pp$/);
        }
      }
    }
    for (const b of blocks) {
      const name = b.prelude.match(/^@keyframes\s+(\S+)/)?.[1];
      if (name) expect(name, sheet).toMatch(/^saas-/);
    }
  });

  it.each(sheets.map((s) => [s]))("%s animates only compositor-friendly properties", (sheet) => {
    const { decls } = scan(read(sheet));
    for (const d of decls) if (inKeyframes(d.within)) expect(d.prop, `${sheet}: ${d.within.at(-2)}`).toMatch(ANIMATABLE);
  });

  it.each(sheets.map((s) => [s]))("%s ties motion to scroll only behind the reduced-motion and support gates", (sheet) => {
    const { decls } = scan(read(sheet));
    for (const d of decls) {
      if (!TIMELINE.test(d.prop) || /^auto(?:\s*,\s*auto)*$/.test(d.value)) continue;
      const where = `${sheet}: ${d.within.at(-1)} { ${d.prop}: ${d.value} }`;
      expect(d.within.some((p) => /^@media\b.*prefers-reduced-motion:\s*no-preference/.test(p)), where).toBe(true);
      expect(d.within.some((p) => /^@supports\b.*animation-timeline:\s*view\(\)/.test(p)), where).toBe(true);
    }
  });
});
