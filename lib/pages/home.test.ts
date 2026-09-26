import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_LANGUAGES } from "@/lib/agent-languages";
import { buildIndustrySystemPrompt } from "@/lib/agent-prompts";
import { entitlementsFor, requiredPlanFor } from "@/lib/billing/entitlements";
import { GET_STARTED, PLATFORM, REEL, USE_CASES } from "@/lib/pages/ai-agents";
import { CAA_FAQ } from "@/lib/pages/custom-ai-agents";
import { INT_ACTIONS, INT_BUILDER, INT_GOOGLE } from "@/lib/pages/integrations";
import { ROOM } from "@/lib/pages/knowledge-base";
import { INDUSTRY_PAGES } from "@/lib/pages/industries";
import {
  AVG_CALL_MIN,
  DAYS_PER_MONTH,
  ENTERPRISE,
  FAQ,
  INDUSTRIES_GATEWAY,
  NAV_INDUSTRIES,
  PRICING_PRESETS,
  TIERS,
  TRUST,
  costFor,
  feeFor,
} from "@/lib/site";
import { greetingFor, mentionsAiDisclosure } from "@/lib/voice/greetings";
import { PLANS } from "@/types";
import { THRESHOLD } from "@/components/site/product/knowledge-base/hero";
import {
  DEEP_PANEL,
  ENTERPRISE_LIGHT,
  HOME_COLORS,
  MOMENT_LIGHTS,
  PLAN_LIGHTS,
  PRICING_PANEL,
  SPECTRUM_KEY,
  homeToken,
  type HomeColor,
} from "@/components/site/home/palettes";
import { BEAT, POSTER, TOUR, frameAt, scriptFor } from "@/components/site/home/demo-script";
import { CLIP, meshBlobs } from "@/components/site/home/mesh-flow";
import {
  CALLS_DEFAULT,
  CALLS_MAX,
  CALLS_MIN,
  GOOGLE_PLAN,
  HOME,
  HOME_CREDITS,
  HOME_ENTERPRISE,
  HOME_PLANS,
  KB_THRESHOLD,
  SCALE_COVERS,
  SMS_PLAN,
  estimate,
  minutesFmt,
  money,
  perCallOf,
  perDay,
  perMinute,
  planBands,
  planFee,
  smallMoney,
  underCent,
  wholeMoney,
  yearlyOf,
} from "./home";
import {
  boundaryFor,
  buildGreetingTable,
  buildHomeCalls,
  buildHomeTrades,
  splitDisclosure,
  studioOpenAt,
} from "./home.server";
import { HOME_PRICING, SUPPORT_247, perkText } from "./home/pricing";

const { company, agent } = PLATFORM.design;

/** Every string reachable from a value; functions are called with a sample argument. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") strings((value as (...a: number[]) => unknown)(1, 1), out);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe("greetings", () => {
  const table = buildGreetingTable();

  it("has every language in every register, and a tour through all of them", () => {
    expect(table.rows).toHaveLength(AGENT_LANGUAGES.length * 3);
    expect([...table.tour].sort()).toEqual(AGENT_LANGUAGES.map((l) => l.value).sort());
    expect(table).not.toHaveProperty("sizer");
  });

  it("splits each greeting back into exactly what greetingFor wrote", () => {
    for (const row of table.rows) {
      const text = greetingFor({ language: row.lang, tone: row.register, company, agentName: agent });
      expect(row.before + row.disclosure + row.after, `${row.lang} ${row.register}`).toBe(text);
      expect(splitDisclosure(text, company)).toEqual({
        before: row.before,
        disclosure: row.disclosure,
        after: row.after,
      });
    }
  });

  it("keeps the AI disclosure in its one sentence and nowhere else", () => {
    for (const row of table.rows) {
      expect(mentionsAiDisclosure(row.disclosure, company), `${row.lang} ${row.register}`).toBe(true);
      expect(mentionsAiDisclosure(row.before + row.after, company), `${row.lang} ${row.register}`).toBe(false);
      expect(row.disclosure).toBe(row.disclosure.trim());
    }
  });

  it("marks right-to-left and character-split scripts", () => {
    for (const row of table.rows) {
      expect(row.dir).toBe(row.lang === "ar" ? "rtl" : "ltr");
      expect(row.split).toBe(row.lang === "ja" || row.lang === "zh" ? "chars" : "words");
    }
  });

  it("throws when no sentence, or more than one, discloses", () => {
    expect(() => splitDisclosure("Thank you for calling. How can I help?", company)).toThrow();
    expect(() => splitDisclosure("I'm an AI assistant. Still an AI assistant.", company)).toThrow();
  });
});

describe("the sample calls", () => {
  const calls = buildHomeCalls();
  const byId = Object.fromEntries(calls.map((c) => [c.id, c]));
  const greeting = greetingFor({ language: "en", tone: "professional", company, agentName: agent });
  const agents = USE_CASES.tabs.flatMap((t) => t.agents);
  const booking = REEL.scenes.find((s) => s.id === "booking")!;

  it("are the sub's four moments, in tour order, ending on the poster", () => {
    expect(calls.map((c) => c.id)).toEqual([...TOUR]);
    expect(TOUR.at(-1)).toBe(POSTER);
  });

  it("each open with the app's own greeting, which says it is an AI", () => {
    for (const call of calls) {
      expect(call.lines[0]).toEqual({ sp: "agent", t: greeting });
      expect(mentionsAiDisclosure(call.lines[0].t, company)).toBe(true);
    }
    expect(greeting).toContain("an AI assistant");
  });

  it("alternate agent and caller from the greeting, three, five, three and five lines long", () => {
    for (const call of calls) call.lines.forEach((line, i) => expect(line.sp).toBe(i % 2 ? "caller" : "agent"));
    expect(calls.map((c) => c.lines.length)).toEqual([3, 5, 3, 5]);
  });

  it("quote their sources", () => {
    expect(byId.rush.lines[1].t).toBe(agents.find((a) => a.id === "reception")!.turns[3].t);
    expect(byId.night.lines.slice(1, 4).map((l) => l.t)).toEqual(booking.turns.slice(1, 4).map((t) => t.t));
    expect(byId.night.lines[4].t).toBe("You're booked for Wednesday at 15:00.");
    expect(byId.sunday.lines[2].t).toContain("Would you like me to book you in?");
  });

  it("promise no call-back time and no text message", () => {
    expect(byId.rush.lines[2].t).not.toMatch(/\btoday\b|\btomorrow\b/i);
    for (const call of calls) for (const line of call.lines) expect(line.t).not.toMatch(/confirmation text|\bSMS\b/i);
  });

  it("move the session only as the cancellation policy allows, into opening hours", () => {
    const policy = ROOM.docs.find((d) => d.id === "cancel")!;
    expect(policy.lines).toContain("Free to cancel or move up to 24 hours before");
    // Thursday 20:10 to Saturday's opening at 9:00 is well over a day.
    expect(ROOM.docs.find((d) => d.id === "hours")!.lines).toContain("Saturday · 9:00–14:00");
    expect(byId.closing.lines[1].t).toBe("Can I move Saturday's session to next week?");
    expect(byId.closing.lines[2].t).toContain("more than a day away, so moving it is free");
    expect(studioOpenAt("Tuesday", "10:00")).toBe(true);
    expect(studioOpenAt("Wednesday", "17:30")).toBe(true);
    expect(byId.closing.lines[4]).toMatchObject({
      t: "Done — you're moved to Tuesday at 10:00.",
      mark: "Tuesday at 10:00",
    });
    expect(HOME.call.moved).toBe("Rescheduled · Tuesday 10:00");
  });

  it("mark the booked slot, the hours and the move verbatim", () => {
    expect(byId.night.lines[4]).toMatchObject({ mark: "Wednesday at 15:00", markTone: "booked" });
    expect(byId.closing.lines[4]).toMatchObject({ markTone: "moved" });
    expect(byId.sunday.lines[2]).toMatchObject({ mark: "8:00 to 20:00", markTone: "answered" });
    for (const call of calls) for (const line of call.lines) if (line.mark) expect(line.t).toContain(line.mark);
  });

  it("take the Sunday answer from the studio's own opening hours", () => {
    expect(ROOM.docs.find((d) => d.id === "hours")!.lines[0]).toBe("Monday to Friday · 8:00–20:00");
    expect(byId.sunday.lines[2].t).toContain("open from 8:00 to 20:00");
  });

  it("hang the door sign on those opening hours", () => {
    expect(studioOpenAt("Friday", "17:05")).toBe(true);
    expect(studioOpenAt("Thursday", "20:10")).toBe(false);
    expect(studioOpenAt("Sunday", "10:12")).toBe(false);
    expect(studioOpenAt("Tuesday", "03:12")).toBe(false);
    expect(studioOpenAt("Monday", "20:00")).toBe(false);
    expect(studioOpenAt("Saturday", "10:00")).toBe(true);
    expect(calls.map((c) => [c.id, c.open])).toEqual([
      ["rush", true],
      ["closing", false],
      ["sunday", false],
      ["night", false],
    ]);
  });

  it("carry their times as the clock's four figures", () => {
    expect(calls.map((c) => [c.day, c.time])).toEqual([
      ["Friday", "17:05"],
      ["Thursday", "20:10"],
      ["Sunday", "10:12"],
      ["Tuesday", "03:12"],
    ]);
    for (const call of calls) expect(call.digits.join("")).toBe(call.time.replace(":", ""));
  });

  it("end on the product page's outcomes", () => {
    const label = (id: string) => PLATFORM.measure.outcomes.find((o) => o.id === id)!.label;
    expect(byId.rush).toMatchObject({ outcome: "handover", outcomeLabel: label("handover") });
    expect(byId.closing).toMatchObject({ outcome: "moved", outcomeLabel: HOME.call.moved });
    expect(byId.sunday).toMatchObject({ outcome: "answered", outcomeLabel: label("answered") });
    expect(byId.night).toMatchObject({ outcome: "booked", outcomeLabel: HOME.call.outcome });
  });
});

describe("the demo's schedule", () => {
  const calls = buildHomeCalls();
  const tour = scriptFor(calls, { kind: "tour", ids: TOUR, from: POSTER });

  it("tours the four moments in about forty seconds and ends on the poster, finished", () => {
    expect(tour.total).toBeLessThanOrEqual(43);
    expect(tour.segs.at(-1)!.settled).toBe(tour.total);
    expect(tour.segs.map((s) => s.id)).toEqual([...TOUR]);
    expect(frameAt(tour, tour.total)).toMatchObject({ target: POSTER, moment: POSTER, ended: true, done: true });
  });

  it("starts each call from the moment on screen and relights the room only at the switch", () => {
    expect(tour.segs.map((s) => s.from)).toEqual([POSTER, "rush", "closing", "sunday"]);
    for (const seg of tour.segs) {
      expect(frameAt(tour, seg.switchAt - 0.01).moment).toBe(seg.from);
      expect(frameAt(tour, seg.switchAt).moment).toBe(seg.id);
      expect(frameAt(tour, seg.T).target).toBe(seg.id);
    }
  });

  it("says every line after the pickup, each after the one before", () => {
    for (const seg of tour.segs) {
      expect(seg.lines[0].at).toBeCloseTo(seg.T + BEAT.line1, 3);
      seg.lines.slice(1).forEach((line, i) => expect(line.at).toBeGreaterThan(seg.lines[i].at));
      expect(seg.end).toBeGreaterThan(seg.lines.at(-1)!.at);
      expect(seg.settled).toBeGreaterThan(seg.end);
    }
  });

  it("listens only while the caller has the floor", () => {
    for (const seg of tour.segs) {
      seg.lines.forEach((line) => expect(frameAt(tour, line.at + 0.01).listening).toBe(line.sp === "caller"));
      expect(frameAt(tour, seg.end).listening).toBe(false);
    }
  });

  it("gives every line that is replaced time to be read", () => {
    for (const seg of tour.segs) {
      // Not the greeting (read once already) and not the last line (it stays on screen).
      seg.lines.slice(1, -1).forEach((line) => expect(line.hold / line.words).toBeGreaterThanOrEqual(0.18));
    }
  });

  it("plays any one moment in under fifteen seconds", () => {
    for (const id of TOUR) {
      const one = scriptFor(calls, { kind: "single", ids: [id], from: POSTER });
      expect(one.total).toBeLessThanOrEqual(14.5);
      expect(frameAt(one, one.total)).toMatchObject({ target: id, moment: id, done: true });
    }
  });
});

describe("trades", () => {
  it("quotes a real boundary from every trade's starting prompt", () => {
    expect(INDUSTRY_PAGES.size).toBe(16);
    for (const slug of INDUSTRY_PAGES.keys()) {
      const boundary = boundaryFor(slug);
      expect(boundary, slug).toMatch(/^(Never|Don't) /);
      expect(buildIndustrySystemPrompt({ name: "your business", industry: slug }), slug).toContain(boundary);
    }
    expect(boundaryFor("home-services")).toBe("Never quote a price for a job before a technician has assessed it.");
  });

  it("lists the sixteen trades in menu order, then the custom build", async () => {
    const data = await buildHomeTrades();
    expect(data.trades).toHaveLength(17);
    expect(data.trades.slice(0, 16).map((t) => t.key)).toEqual(NAV_INDUSTRIES.map((i) => i.slug));
    expect(data.trades[0].ordinal).toBe("01");
    const custom = data.trades[16];
    expect(custom).toMatchObject({
      key: "custom-ai-agents",
      ordinal: "—",
      callerIsSample: false,
      href: "/solutions/custom-ai-agents",
    });
    expect(mentionsAiDisclosure(custom.boundary)).toBe(true);
    expect(data.initial.key).toBe("home-services");
    expect(data.initial.poster).not.toBe("");
    expect(data.initial.alt).not.toBe("");
    expect(data).not.toHaveProperty("sizers");
  });
});

describe("pricing", () => {
  it("defaults to the quiet clinic, on Starter at $49", () => {
    expect(CALLS_DEFAULT).toBe(PRICING_PRESETS[0].callsDay);
    const e = estimate(CALLS_DEFAULT, false);
    expect(e).toMatchObject({ callsDay: 3, minutes: 360, overMinutes: 0, overCost: 0, fee: 49, total: 49 });
    expect(e.plan.id).toBe("starter");
    expect(money(e.total)).toBe("$49.00");
  });

  it("puts twelve calls a day on Growth, with the overage on the receipt", () => {
    const e = estimate(12, false);
    expect(e.plan.id).toBe("growth");
    expect(e).toMatchObject({ minutes: 1440, overMinutes: 440, overCost: 88, fee: 99, total: 187 });
    expect(minutesFmt(e.minutes)).toBe("1,440");
    expect(money(e.overCost)).toBe("$88.00");
    expect(money(e.total)).toBe("$187.00");
    // Fifteen a day is Pro's, whole.
    expect(estimate(15, false)).toMatchObject({ plan: { id: "pro" }, overMinutes: 0, total: 249 });
  });

  it("lands every preset exactly on a plan fee, with nothing over, on both billings", () => {
    expect(PRICING_PRESETS.map((p) => p.callsDay)).toEqual([3, 8, 25]);
    const expected = [
      ["starter", 49, 40.83],
      ["growth", 99, 82.5],
      ["pro", 249, 207.5],
    ] as const;
    PRICING_PRESETS.forEach((p, i) => {
      const [id, monthly, yearly] = expected[i];
      for (const annual of [false, true]) {
        const e = estimate(p.callsDay, annual);
        expect(e.plan.id).toBe(id);
        expect(e.overMinutes).toBe(0);
        expect(e.total).toBe(annual ? yearly : monthly);
      }
    });
  });

  it("adds up on yearly billing too, and never estimates onto Enterprise", () => {
    for (let c = CALLS_MIN; c <= CALLS_MAX; c++) {
      for (const annual of [false, true]) {
        const e = estimate(c, annual);
        expect(e.total).toBeCloseTo(e.fee + e.overCost, 9);
        expect(e.plan.id).not.toBe(ENTERPRISE.id);
      }
    }
  });

  it("covers every volume with contiguous bands, one per listed plan", () => {
    const flat = (annual: boolean) => planBands(annual).map((b) => [b.id, b.from, b.to]);
    expect(flat(false)).toEqual([
      ["starter", 1, 5],
      ["growth", 6, 14],
      ["pro", 15, 35],
      ["business", 36, 62],
      ["scale", 63, 80],
    ]);
    expect(flat(true)).toEqual([
      ["starter", 1, 5],
      ["growth", 6, 13],
      ["pro", 14, 33],
      ["business", 34, 58],
      ["scale", 59, 80],
    ]);
    for (const annual of [false, true]) {
      const bands = planBands(annual);
      expect(bands.map((b) => b.id)).toEqual(HOME_PLANS.map((p) => p.id));
      expect(bands[0].from).toBe(CALLS_MIN);
      expect(bands.at(-1)!.to).toBe(CALLS_MAX);
      bands.slice(1).forEach((b, i) => expect(b.from).toBe(bands[i].to + 1));
    }
  });

  it("keeps every rung's overage above its own effective rate", () => {
    for (const annual of [false, true]) {
      for (const t of TIERS) expect(t.overage, t.id).toBeGreaterThan(feeFor(t, annual) / t.minutes);
    }
  });

  it("hands each rung over inside the next one's allowance", () => {
    for (const annual of [false, true]) {
      TIERS.slice(0, -1).forEach((t, i) => {
        const next = TIERS[i + 1];
        const at = t.minutes + (feeFor(next, annual) - feeFor(t, annual)) / t.overage;
        expect(at, t.id).toBeGreaterThan(t.minutes);
        expect(at, t.id).toBeLessThan(next.minutes);
        expect(costFor(next, next.minutes, annual)).toBeLessThan(costFor(t, next.minutes, annual));
      });
    }
  });

  it("prices each plan by its own tier, to the cent, as the receipt does", () => {
    for (const plan of HOME_PLANS) {
      const tier = TIERS.find((t) => t.id === plan.id)!;
      for (const annual of [false, true]) {
        expect(planFee(plan, annual)).toBeCloseTo(feeFor(tier, annual), 2);
        expect(Math.round(planFee(plan, annual) * 100)).toBe(planFee(plan, annual) * 100);
      }
    }
    for (const annual of [false, true]) {
      const e = estimate(40, annual);
      expect(planFee(e.plan, annual)).toBe(e.fee);
    }
    expect(
      money(
        planFee(
          HOME_PLANS.find((p) => p.id === "growth")!,
          true,
        ),
      ),
    ).toBe("$82.50");
  });

  it("lists the five plans, Pro as the pick, and Enterprise with no numbers", () => {
    // Rates in dollars, as the owner writes them.
    expect(perMinute(0.2)).toBe("$0.20");
    expect(underCent(990 / 15000)).toBe("$0.07");
    expect(underCent(99 / 1000)).toBe("$0.10");
    expect(underCent(0.08)).toBe("$0.09");
    expect(HOME_PLANS.map((p) => p.id)).toEqual(["starter", "growth", "pro", "business", "scale"]);
    expect(HOME_PLANS.map((p) => [p.monthly, p.minutes, p.overage])).toEqual([
      [49, 400, 0.2],
      [99, 1000, 0.2],
      [249, 3000, 0.2],
      [499, 5000, 0.2],
      [990, 15000, 0.2],
    ]);
    expect(HOME_PLANS.filter((p) => p.featured).map((p) => p.id)).toEqual(["pro"]);
    for (const plan of HOME_PLANS) {
      expect(plan).not.toHaveProperty("unlocks");
      expect(plan).not.toHaveProperty("from");
    }
    expect(ENTERPRISE).toMatchObject({ id: "custom", name: "Enterprise", cta: "Talk to us" });
    for (const k of ["monthly", "minutes", "overage", "from"]) expect(ENTERPRISE).not.toHaveProperty(k);
    expect(HOME_ENTERPRISE).toMatchObject({ id: "custom", name: "Enterprise" });
  });

  it("prints no price for Enterprise anywhere", () => {
    const noPrice = /[$¢]|\d[\d,]*\s*(?:min|minutes)\b/;
    const custom = HOME_PRICING.perks.custom;
    const texts = [
      custom.head,
      ...custom.items.flatMap((p) => [perkText(p, false), perkText(p, true)]),
      ...strings(HOME_PRICING.enterprise),
      ...strings(ENTERPRISE),
      CAA_FAQ.items.find((i) => i.id === "custom-plan")!.a,
      ...strings(GET_STARTED.columns.find((c) => c.id === "business")),
    ];
    expect(texts.filter((t) => noPrice.test(t))).toEqual([]);
    expect(CAA_FAQ.items.find((i) => i.id === "custom-plan")!.a).toContain("Enterprise");
  });

  it("ties every entitlement perk to the plan the backend turns it on at", () => {
    // The backend has no growth or scale plan: they are sold as starter and business.
    const BACKEND = {
      starter: "starter",
      growth: "starter",
      pro: "pro",
      business: "business",
      scale: "business",
      custom: "custom",
    } as const;
    const ORDER = ["starter", "growth", "pro", "business", "scale", "custom"] as const;
    ORDER.forEach((id, i) => {
      const here = entitlementsFor(BACKEND[id]);
      const before = entitlementsFor(i === 0 ? "trial" : BACKEND[ORDER[i - 1]]);
      for (const perk of HOME_PRICING.perks[id].items) {
        if (perk.source.kind !== "entitlement") continue;
        const key = perk.source.key;
        if (typeof here[key] === "boolean") {
          expect(here[key], `${id} ${key}`).toBe(true);
          expect(before[key], `${id} ${key} before`).toBe(false);
        } else {
          expect(here[key] as number, `${id} ${key}`).toBeGreaterThan(before[key] as number);
        }
      }
    });
  });

  it("keeps the owner's promises deliberate", () => {
    const owner = Object.entries(HOME_PRICING.perks).flatMap(([id, { items }]) =>
      items.filter((p) => p.source.kind === "owner").map((p) => [id, perkText(p, false)]),
    );
    expect(owner).toEqual([
      ["pro", "Custom integrations, set up by our team"],
      ["pro", SUPPORT_247 ? "24/7 priority support from a real person" : "Priority support from a real person"],
      ["business", "A setup call with our team to get your agent live"],
      ["business", "A monthly review of your calls with our team"],
      ["scale", "Priority onboarding"],
      ["custom", "A written SLA"],
      ["custom", "A named contact"],
    ]);
  });

  it("never calls Business better value than Pro, or anything the most popular", () => {
    const decoy = /\bsaves?\b|better value|best value|better rate|vs\.? Pro|most popular/i;
    const rendered = [
      ...strings(HOME_PRICING.plan),
      ...strings(HOME_PRICING.enterprise),
      ...Object.values(HOME_PRICING.perks).flatMap(({ head, items }) => [
        head,
        ...items.flatMap((p) => [perkText(p, false), perkText(p, true)]),
      ]),
    ];
    expect(rendered.filter((s) => decoy.test(s))).toEqual([]);
  });

  it("names the plans in the FAQ's overage and recording answers", () => {
    const overage = FAQ.find((f) => /go over my included minutes/.test(f.q))!.a;
    expect(overage).toContain("$0.20 a minute, the same on every plan");
    expect(overage).not.toMatch(/NaN|¢/);
    const storage = FAQ.find((f) => /recordings and transcripts live/.test(f.q))!.a;
    expect(storage).toContain("off on the trial, Starter and Growth");
  });

  it("restates the bill a day and a call", () => {
    expect(perCallOf(estimate(8, false))).toMatchObject({ day: 3.3 });
    expect(smallMoney(perCallOf(estimate(8, false)).call)).toBe("$0.41");
    expect(money(perCallOf(estimate(12, false)).day)).toBe("$6.23");
    expect(smallMoney(perCallOf(estimate(12, false)).call)).toBe("$0.52");
    expect(smallMoney(perCallOf(estimate(1, false)).call)).toBe("$1.63");
    const pro = HOME_PLANS.find((p) => p.id === "pro")!;
    expect(perDay(pro, false)).toBe(8.3);
    expect(perDay(pro, true)).toBe(6.92);
    expect(yearlyOf(pro)).toEqual({ total: 2490, off: 498 });
    expect(yearlyOf(HOME_PLANS[0])).toEqual({ total: 490, off: 98 });
    expect(wholeMoney(2490)).toBe("$2,490");
    expect(SCALE_COVERS).toBe(125);
  });

  it("states the assumptions the arithmetic actually uses", () => {
    expect(AVG_CALL_MIN).toBe(4);
    expect(DAYS_PER_MONTH).toBe(30);
    expect(HOME.pricing.estimator.assumptions).toContain("four minutes");
  });
});

describe("pricing colour", () => {
  const css = readFileSync(path.join(process.cwd(), "components/site/home/pricing.css"), "utf8");
  const homeCss = readFileSync(path.join(process.cwd(), "components/site/home/home.css"), "utf8");
  const block = (id: string) => {
    const at = css.indexOf(`.pp .home-plan-light[data-plan="${id}"] {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };

  it("declares every plan light in pricing.css, value for value", () => {
    for (const [id, light] of Object.entries(PLAN_LIGHTS)) {
      const b = block(id);
      expect(b.length, id).toBeGreaterThan(0);
      for (const key of ["ground", "text", "dim", "accent", "tick", "ink", "signal"] as const) {
        expect(b, `${id} ${key}`).toContain(`--plan-${key}: ${light[key]};`);
      }
    }
    const e = block("custom");
    for (const key of ["ground", "text", "dim", "accent", "tick"] as const) {
      expect(e, `custom ${key}`).toContain(`--plan-${key}: ${ENTERPRISE_LIGHT[key]};`);
    }
    expect(css).toContain(`--home-pricing-panel: ${PRICING_PANEL};`);
    expect(homeCss).toContain(`background-image: ${SPECTRUM_KEY};`);
  });

  /* Each mesh composited over its real card boxes, as CSS paints it: the
     floor, then each pool from the last listed (bottom) to the first
     (top), its alpha interpolated between its stops along the ray (a
     pool's stops are rgb(R G B / A) P%). Every text colour is sampled
     against the worst point of the card's content box (24px in), at every
     size the card renders at. */
  type Rgb = [number, number, number];
  const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const over = (fg: Rgb, a: number, bg: Rgb): Rgb => fg.map((c, i) => c * a + bg[i] * (1 - a)) as Rgb;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: Rgb, b: Rgb) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const POOL =
    /radial-gradient\(([\d.]+)(%|px) ([\d.]+)(%|px) at ([\d.]+)% ([\d.]+)%, ((?:rgb\(\d+ \d+ \d+ \/ [\d.]+\) \d+%(?:, )?)+)\)/g;
  const STOP = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\) (\d+)%/g;
  const poolsOf = (g: string) =>
    [...g.matchAll(POOL)].map((m) => ({
      rx: [Number(m[1]), m[2]] as const,
      ry: [Number(m[3]), m[4]] as const,
      x: Number(m[5]),
      y: Number(m[6]),
      stops: [...m[7].matchAll(STOP)].map((st) => ({
        c: [Number(st[1]), Number(st[2]), Number(st[3])] as Rgb,
        a: Number(st[4]),
        p: Number(st[5]),
      })),
    }));
  const parse = (g: string) => ({
    pools: poolsOf(g),
    floor: rgb(g.match(/, (#[0-9a-f]{6})$/)![1]),
  });
  const alphaAt = (stops: { a: number; p: number }[], t: number) => {
    if (t <= stops[0].p) return stops[0].a;
    for (let k = 0; k < stops.length - 1; k++) {
      const [s0, s1] = [stops[k], stops[k + 1]];
      if (t <= s1.p) return s0.a + ((s1.a - s0.a) * (t - s0.p)) / (s1.p - s0.p);
    }
    return stops[stops.length - 1].a;
  };
  type Pool = ReturnType<typeof poolsOf>[number];
  const paint = (pools: Pool[], px: number, py: number, W: number, H: number, under: Rgb) => {
    let out = under;
    for (let k = pools.length - 1; k >= 0; k--) {
      const p = pools[k];
      const rx = p.rx[1] === "px" ? p.rx[0] : (p.rx[0] / 100) * W;
      const ry = p.ry[1] === "px" ? p.ry[0] : (p.ry[0] / 100) * H;
      const t = Math.hypot((px - (p.x / 100) * W) / rx, (py - (p.y / 100) * H) / ry) * 100;
      const a = alphaAt(p.stops, t);
      if (a > 0) out = over(p.stops[0].c, a, out);
    }
    return out;
  };
  const colourAt = (mesh: ReturnType<typeof parse>, px: number, py: number, W: number, H: number) =>
    paint(mesh.pools, px, py, W, H, mesh.floor);
  const worst = (ground: string, fg: string, boxes: [number, number][]) => {
    const mesh = parse(ground);
    let min = Infinity;
    for (const [W, H] of boxes) {
      for (let i = 0; i <= 40; i++) {
        for (let j = 0; j <= 80; j++) {
          const px = 24 + ((W - 48) * i) / 40;
          const py = 24 + ((H - 48) * j) / 80;
          min = Math.min(min, contrast(rgb(fg), colourAt(mesh, px, py, W, H)));
        }
      }
    }
    return min;
  };

  /* The mesh in motion (pricing.css `.home-plan-mesh`, mesh-flow.ts): the
     ground's pools, each its own element over the floor, each drifting on
     two clocks, a wave either side of rest: sideways by FLOW_X of its own
     width and up and down by FLOW_Y of its own height. The clocks never
     line up, so any pool can be anywhere in its reach while the others are
     anywhere in theirs. The text is held to its contrast, plus
     MOVING_MARGIN, against the darkest its card can get: at every sampled
     point, each pool at rest and at the least and the most it can put
     there anywhere in its reach, in every combination. */
  const MOVING_MARGIN = 0.2;
  const keyframes = (name: string) => {
    const at = css.indexOf(`@keyframes ${name} {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("\n}", at));
  };
  const valuesOf = (k: string, re: RegExp) => [...k.matchAll(re)].map((m) => Number(m[1]) / 100);
  const FLOW_X_VALUES = valuesOf(keyframes("home-plan-flow-x"), /translate: (-?[\d.]+)%? 0;/g);
  const FLOW_Y_VALUES = valuesOf(keyframes("home-plan-flow-y"), /transform: translate3d\(0, (-?[\d.]+)%, 0\);/g);
  const FLOW_X = Math.max(...FLOW_X_VALUES.map(Math.abs));
  const FLOW_Y = Math.max(...FLOW_Y_VALUES.map(Math.abs));
  /** A pool's radii on a W x H card, in px. */
  const radiiOf = (p: Pool, W: number, H: number) => [
    p.rx[1] === "px" ? p.rx[0] : (p.rx[0] / 100) * W,
    p.ry[1] === "px" ? p.ry[0] : (p.ry[0] / 100) * H,
  ];
  // Up to the ";" that ends the declaration, whatever the file's line endings.
  const declared = (id: string, key: string) => block(id).match(new RegExp(`--plan-${key}: (.*?);\\r?\\n`))?.[1] ?? "";
  const darkest = new Map<string, number>();
  /** The lowest luminance anywhere in a card's content box, wherever its pools can be. */
  const darkestLum = (id: string, ground: string, boxes: [number, number][]) => {
    const key = `${id} ${boxes.join(" ")}`;
    const known = darkest.get(key);
    if (known !== undefined) return known;
    const mesh = parse(ground);
    const bottomUp = [...mesh.pools].reverse();
    let min = Infinity;
    for (const [W, H] of boxes) {
      for (let i = 0; i <= 12; i++) {
        for (let j = 0; j <= 24; j++) {
          const px = 24 + ((W - 48) * i) / 12;
          const py = 24 + ((H - 48) * j) / 24;
          // What each pool can put here: at rest, and the least and the most over its reach.
          const options = bottomUp.map((p) => {
            const [rw, rh] = radiiOf(p, W, H);
            const [cx, cy] = [(p.x / 100) * W, (p.y / 100) * H];
            const alphas: number[] = [];
            for (const fx of [-1, -0.5, 0, 0.5, 1]) {
              for (const fy of [-1, -0.5, 0, 0.5, 1]) {
                const [ox, oy] = [fx * FLOW_X * 2 * rw, fy * FLOW_Y * 2 * rh];
                alphas.push(alphaAt(p.stops, Math.hypot((px - cx - ox) / rw, (py - cy - oy) / rh) * 100));
              }
            }
            return [...new Set([alphas[12], Math.min(...alphas), Math.max(...alphas)])];
          });
          const walk = (n: number, below: Rgb) => {
            if (n === bottomUp.length) {
              min = Math.min(min, lum(below));
              return;
            }
            for (const a of options[n]) walk(n + 1, a > 0 ? over(bottomUp[n].stops[0].c, a, below) : below);
          };
          walk(0, mesh.floor);
        }
      }
    }
    darkest.set(key, min);
    return min;
  };
  const worstMoving = (id: string, ground: string, fg: string, boxes: [number, number][]) => {
    const f = lum(rgb(fg));
    const bg = darkestLum(id, ground, boxes);
    expect(f, `${id}: ${fg} is darker than its card`).toBeLessThan(bg);
    return (bg + 0.05) / (f + 0.05);
  };
  // Every size a card renders at: xl (the widened row), a 320px phone's rail, the lg bento, a wide rail.
  const LIGHT_BOXES: [number, number][] = [
    [236, 760],
    [248, 800],
    [283, 660],
    [336, 780],
  ];
  const PRO_BOXES: [number, number][] = [
    [295, 780],
    [354, 1300],
    [336, 780],
    [248, 800],
  ];
  const ENTERPRISE_BOXES: [number, number][] = [
    [1288, 180],
    [944, 200],
    [720, 240],
    [336, 560],
  ];
  const PANEL_BOXES: [number, number][] = [
    [1176, 420],
    [944, 460],
    [720, 760],
    [343, 900],
  ];

  it("lays each card's pools out as their own elements, stacking back into its ground", () => {
    const cards = [...Object.entries(PLAN_LIGHTS), ["custom", ENTERPRISE_LIGHT] as const];
    // A calc(P% +/- Qpx) inside the clip, as px from the clip's edge.
    const inClip = (v: unknown, size: number) => {
      const m = String(v).match(/^calc\((-?[\d.]+)% ([+-]) ([\d.]+)px\)$|^(-?[\d.]+)px$/)!;
      return m[4] !== undefined
        ? Number(m[4])
        : (Number(m[1]) / 100) * (size - 2 * CLIP) + (m[2] === "-" ? -1 : 1) * Number(m[3]);
    };
    for (const [id, l] of cards) {
      const pools = parse(l.ground).pools;
      const blobs = meshBlobs(l.ground);
      expect(blobs.length, id).toBe(pools.length);
      expect(declared(id, "floor"), id).toBe(l.ground.match(/, (#[0-9a-f]{6})$/)![1]);
      for (const [W, H] of [
        [300, 700],
        [1288, 180],
      ]) {
        // Bottom pool first, so the top one paints last.
        blobs.forEach((b, n) => {
          const p = pools[pools.length - 1 - n];
          const [rw, rh] = radiiOf(p, W, H);
          expect(inClip(b.left, W) + CLIP, `${id} ${n} left`).toBeCloseTo((p.x / 100) * W - rw, 2);
          expect(inClip(b.top, H) + CLIP, `${id} ${n} top`).toBeCloseTo((p.y / 100) * H - rh, 2);
          expect(inClip(b.width, W), `${id} ${n} width`).toBeCloseTo(2 * rw, 2);
          expect(inClip(b.height, H), `${id} ${n} height`).toBeCloseTo(2 * rh, 2);
          expect(String(b.background)).toMatch(/^radial-gradient\(closest-side, /);
          expect([...String(b.background).matchAll(STOP)].map((st) => Number(st[4]))).toEqual(
            p.stops.map((st) => st.a),
          );
        });
      }
    }
    // The clip in the stylesheet is the one the layout is worked out from.
    const meshRule = css.slice(css.indexOf(".pp .home-plan-mesh {"));
    expect(meshRule.slice(0, meshRule.indexOf("}"))).toContain(`inset: ${CLIP}px;`);
  });

  it("flows every pool far enough to see, from rest, and no pool alike", () => {
    for (const [name, values] of [
      ["home-plan-flow-x", FLOW_X_VALUES],
      ["home-plan-flow-y", FLOW_Y_VALUES],
    ] as const) {
      const k = keyframes(name);
      expect(values.length, name).toBeGreaterThanOrEqual(3);
      // A wave either side of rest, that starts and ends at rest.
      expect(Math.max(...values), name).toBeGreaterThan(0);
      expect(Math.min(...values), name).toBeLessThan(0);
      expect(k).not.toMatch(/rotate|skew|scale/);
      const rest = name.endsWith("x") ? "translate: 0 0" : "transform: translate3d(0, 0%, 0)";
      expect(k.match(/\n\s*0%,[^{]*\{\s*([^;]+);/)?.[1], `${name} starts`).toBe(rest);
      expect(k.match(/\n\s*100% \{\s*([^;]+);/)?.[1], `${name} ends`).toBe(rest);
      // It leaves rest at full speed (eased out of it) and eases into each turn.
      expect(k).toMatch(/0%,\s*50% \{[^}]*animation-timing-function: cubic-bezier\(0\.61, 1, 0\.88, 1\)/);
      for (const peak of ["25%", "75%"]) {
        expect(k, `${name} ${peak}`).toMatch(
          new RegExp(`\\n\\s*${peak} \\{[^}]*animation-timing-function: cubic-bezier\\(0\\.12, 0, 0\\.39, 0\\)`),
        );
      }
    }
    // Far enough to see: a plan card's biggest pool crosses a fifth of the card or more each way,
    // Enterprise's (drawn in px) 100px or more.
    for (const [id, l] of Object.entries(PLAN_LIGHTS)) {
      const reach = Math.max(...parse(l.ground).pools.map((p) => 2 * p.rx[0] * FLOW_X));
      expect(reach, id).toBeGreaterThanOrEqual(20);
    }
    expect(Math.max(...parse(ENTERPRISE_LIGHT.ground).pools.map((p) => 2 * p.rx[0] * FLOW_X))).toBeGreaterThanOrEqual(
      100,
    );
    // Every pool of the busiest recipe has its own clocks, none slower than 10s, no two alike.
    const most = Math.max(
      ...[...Object.values(PLAN_LIGHTS), ENTERPRISE_LIGHT].map((l) => parse(l.ground).pools.length),
    );
    const clocks = Array.from({ length: most }, (_, n) => {
      const at = css.indexOf(`.pp .home-plan-mesh > span:nth-child(${n + 1}) {`);
      expect(at, `pool ${n + 1}`).toBeGreaterThan(0);
      const rule = css.slice(at, css.indexOf("}", at));
      return [rule.match(/--fx: ([\d.]+)s;/)?.[1], rule.match(/--fy: ([\d.]+)s;/)?.[1]].map(Number);
    });
    for (const t of clocks.flat()) expect(t).toBeLessThanOrEqual(10);
    expect(new Set(clocks.map((c) => c.join())).size).toBe(clocks.length);
    // Off screen a card has no animation at all (its layers drop), and it rests.
    expect(css).toMatch(/\.pp \.home-plan:not\(\[data-live\]\) > \.home-plan-mesh > span \{\s*animation-name: none;/);
  });

  it("reads every pool off every recipe, each with a soft, edgeless falloff", () => {
    const all = [...Object.values(PLAN_LIGHTS).map((l) => l.ground), ENTERPRISE_LIGHT.ground, PRICING_PANEL];
    for (const g of all) {
      const pools = parse(g).pools;
      expect(pools.length).toBeGreaterThanOrEqual(3);
      expect(g.match(/radial-gradient\(/g)!.length).toBe(pools.length);
      for (const p of pools) {
        expect(p.stops.length).toBeGreaterThanOrEqual(5);
        expect(p.stops.at(-1)!.a).toBe(0);
      }
    }
  });

  it.each(["starter", "growth", "business", "scale"] as const)(
    "%s's text clears 4.5:1 and its marks 3:1 everywhere on its card",
    (id) => {
      const l = PLAN_LIGHTS[id];
      for (const c of [l.text, l.dim, l.accent]) {
        expect(worst(l.ground, c, LIGHT_BOXES), `${id} ${c}`).toBeGreaterThanOrEqual(4.5);
        expect(worstMoving(id, l.ground, c, LIGHT_BOXES), `${id} ${c} moving`).toBeGreaterThanOrEqual(
          4.5 + MOVING_MARGIN,
        );
      }
      expect(worst(l.ground, l.tick, LIGHT_BOXES)).toBeGreaterThanOrEqual(3);
      expect(worstMoving(id, l.ground, l.tick, LIGHT_BOXES)).toBeGreaterThanOrEqual(3 + MOVING_MARGIN);
    },
  );

  it("Pro's text clears 4.5:1 everywhere on its magenta pearl", () => {
    const l = PLAN_LIGHTS.pro;
    for (const c of [l.text, l.dim, l.accent]) {
      expect(worst(l.ground, c, PRO_BOXES), c).toBeGreaterThanOrEqual(4.5);
      expect(worstMoving("pro", l.ground, c, PRO_BOXES), `${c} moving`).toBeGreaterThanOrEqual(4.5 + MOVING_MARGIN);
    }
    expect(worst(l.ground, l.tick, PRO_BOXES)).toBeGreaterThanOrEqual(3);
    expect(worstMoving("pro", l.ground, l.tick, PRO_BOXES)).toBeGreaterThanOrEqual(3 + MOVING_MARGIN);
    // Its button: white on the magenta gradient's lighter end.
    expect(contrast([255, 255, 255], rgb("#a21caf"))).toBeGreaterThanOrEqual(4.5);
  });

  it("Enterprise's text clears 4.5:1 and its marks 3:1", () => {
    const l = ENTERPRISE_LIGHT;
    for (const c of [l.text, l.dim, l.accent]) {
      expect(worst(l.ground, c, ENTERPRISE_BOXES), c).toBeGreaterThanOrEqual(4.5);
      expect(worstMoving("custom", l.ground, c, ENTERPRISE_BOXES), `${c} moving`).toBeGreaterThanOrEqual(
        4.5 + MOVING_MARGIN,
      );
    }
    expect(worst(l.ground, l.tick, ENTERPRISE_BOXES)).toBeGreaterThanOrEqual(3);
    expect(worstMoving("custom", l.ground, l.tick, ENTERPRISE_BOXES)).toBeGreaterThanOrEqual(3 + MOVING_MARGIN);
  });

  it("every plan ink reads on the estimator panel and on white, and white reads on it", () => {
    for (const [id, l] of Object.entries(PLAN_LIGHTS)) {
      expect(worst(PRICING_PANEL, l.ink, PANEL_BOXES), id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(l.ink), [255, 255, 255]), id).toBeGreaterThanOrEqual(4.5);
      expect(worst(PRICING_PANEL, l.signal, PANEL_BOXES), `${id} signal`).toBeGreaterThanOrEqual(3);
    }
    for (const c of [HOME_COLORS.ink, HOME_COLORS.muted, HOME_COLORS.violet]) {
      expect(worst(PRICING_PANEL, c, PANEL_BOXES), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the spectrum key readable on white at every point", () => {
    const stops = [...SPECTRUM_KEY.matchAll(/(#[0-9a-f]{6}) (\d+)%/g)].map((m) => [rgb(m[1]), Number(m[2])] as const);
    let min = Infinity;
    for (let t = 0; t <= 100; t += 0.5) {
      const k = stops.findIndex(([, p]) => p >= t);
      const [c1, p1] = stops[Math.max(k, 1)];
      const [c0, p0] = stops[Math.max(k, 1) - 1];
      const f = (t - p0) / (p1 - p0);
      const c = c0.map((v, i) => v + (c1[i] - v) * f) as Rgb;
      min = Math.min(min, contrast(c, [255, 255, 255]));
    }
    expect(min).toBeGreaterThanOrEqual(4.5);
  });
});

describe("headings", () => {
  const sections = Object.entries(HOME).map(([name, s]) => ({
    name,
    ...(s as { title: unknown; key: unknown; keyTone?: unknown }),
  }));

  it("gives each of the nine sections one key phrase, copied from its title", () => {
    expect(sections).toHaveLength(9);
    for (const s of sections) {
      expect(typeof s.title, s.name).toBe("string");
      expect(typeof s.key, s.name).toBe("string");
      const title = s.title as string;
      const key = s.key as string;
      expect(title, s.name).toContain(key);
      // The payoff, never the first word and never the whole heading.
      expect(title.lastIndexOf(key), s.name).toBeGreaterThan(0);
      expect(key.trim(), s.name).toBe(key);
    }
  });

  it("keys the headings as the art direction lists them", () => {
    expect(Object.fromEntries(sections.map((s) => [s.name, s.key]))).toEqual({
      call: "not the phone.",
      trades: "different in every one.",
      voice: "plain language",
      kb: "your own documents",
      after: "starts on its own",
      pricing: "the bill does itself.",
      trust: "check yourself.",
      faq: "in the order they arrive.",
      start: "you'd hate to miss",
    });
  });

  it("keeps the FAQ's phrase quiet, and only the FAQ's", () => {
    expect(sections.filter((s) => s.keyTone !== undefined).map((s) => [s.name, s.keyTone])).toEqual([["faq", "quiet"]]);
  });
});

describe("colour", () => {
  const css = readFileSync(path.join(process.cwd(), "components/site/home/home.css"), "utf8");
  const block = css.slice(css.indexOf(".pp.home-body {"), css.indexOf("}", css.indexOf(".pp.home-body {")));

  it("declares every HOME_COLORS entry as its --home-* token in home.css, value for value", () => {
    expect(block.length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(HOME_COLORS)) {
      expect(block, name).toContain(`${homeToken(name as HomeColor)}: ${value};`);
    }
    expect(homeToken("callerLit")).toBe("--home-caller-lit");
    expect(block).toContain(`--home-deep: ${DEEP_PANEL};`);
  });

  it("retunes the pp tokens to the landing's palette", () => {
    expect(block).toContain(`--pp-ink: ${HOME_COLORS.ink};`);
    expect(block).toContain(`--pp-muted: ${HOME_COLORS.muted};`);
    expect(block).toContain(`--pp-card: ${HOME_COLORS.chip};`);
    expect(block).toContain(`--pp-accent: ${HOME_COLORS.violet};`);
  });

  /* WCAG 2 relative luminance and contrast, with alpha fills composited
     over their ground. The expected ratios are the art direction's
     measured table (review-out/judge-art.md §7); each must also clear AA
     for its use: 4.5 for text, 3 for marks. */
  type Rgb = [number, number, number];
  const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const over = (fg: Rgb, alpha: number, bg: Rgb): Rgb => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: Rgb, b: Rgb) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const c = (name: HomeColor) => rgb(HOME_COLORS[name]);
  const WHITE: Rgb = [255, 255, 255];
  // The deep panel's stops, electric corner first, read off the gradient itself.
  const [DEEP_CORNER, DEEP_2, DEEP_3, DEEP_4] = (DEEP_PANEL.match(/#[0-9a-f]{6}/g) ?? []).map(rgb);
  // #demo's rooms, each read off its own gradient: the first stop, the centre, is the most saturated.
  const room = (ground: string) => rgb(ground.match(/#[0-9a-f]{6}/)![0]);
  const RUSH_ROOM = room(MOMENT_LIGHTS.rush.ground);
  const SUNDAY_ROOM = room(MOMENT_LIGHTS.sunday.ground);
  const CLOSING_ROOM = room(MOMENT_LIGHTS.closing.ground);
  const NIGHT_ROOM = room(MOMENT_LIGHTS.night.ground);

  const TEXT: [string, Rgb, Rgb, number][] = [
    ["ink on white", c("ink"), WHITE, 19.11],
    ["ink on wash", c("ink"), c("wash"), 17.46],
    ["ink on stage", c("ink"), c("stage"), 16.17],
    ["muted on white", c("muted"), WHITE, 6.37],
    ["muted on wash", c("muted"), c("wash"), 5.82],
    ["muted on stage", c("muted"), c("stage"), 5.39],
    ["muted on chip", c("muted"), c("chip"), 5.69],
    ["violet on white", c("violet"), WHITE, 7.1],
    ["violet on wash", c("violet"), c("wash"), 6.49],
    ["violet on stage", c("violet"), c("stage"), 6.01],
    ["violet on chip", c("violet"), c("chip"), 6.34],
    ["violet on electric/12", c("violet"), over(c("electric"), 0.12, WHITE), 5.93],
    ["white on electric", WHITE, c("electric"), 5.7],
    ["caller on white", c("caller"), WHITE, 6.62],
    ["caller on stage", c("caller"), c("stage"), 5.6],
    ["ember-ink on white", c("emberInk"), WHITE, 5.92],
    ["ember-ink on ember-soft", c("emberInk"), c("emberSoft"), 5.07],
    ["ember-ink on stage", c("emberInk"), c("stage"), 5.01],
    ["settled on white", c("settled"), WHITE, 5.5],
    ["settled on settled-soft", c("settled"), c("settledSoft"), 4.95],
    ["settled on stage", c("settled"), c("stage"), 4.65],
    ["paper on night", c("paper"), c("night"), 17.36],
    ["paper-dim on night", c("paperDim"), c("night"), 8.39],
    ["lilac on night", c("lilac"), c("night"), 9.47],
    ["caller-lit on night", c("callerLit"), c("night"), 11.0],
    ["ember-lit on night", c("emberLit"), c("night"), 12.02],
    ["settled-lit on night", c("settledLit"), c("night"), 12.95],
    ["ember-lit on its band pill", c("emberLit"), over(c("ember"), 0.16, c("night")), 10.41],
    ["lilac on the deep panel's #1e0a3c", c("lilac"), DEEP_4, 8.37],
    ["lilac on the deep panel's #3b1478", c("lilac"), DEEP_3, 6.26],
    ["on-deep on the deep panel's #5b21b6", c("onDeep"), DEEP_2, 7.78],
    ["on-deep on the deep panel's corner", c("onDeep"), DEEP_CORNER, 4.93],
    ["on-deep-dim on the deep panel's #5b21b6", c("onDeepDim"), DEEP_2, 5.99],
    ["white on the deep panel's corner", WHITE, DEEP_CORNER, 5.7],
    ["lilac on a white/8 chip over #3b1478", c("lilac"), over(WHITE, 0.08, DEEP_3), 5.08],
    // #demo: each moment's ink on white (the sub's phrases), and white on it (the lit key).
    ["rush-ink on white", c("rushInk"), WHITE, 6.04],
    ["sunday-ink on white", c("sundayInk"), WHITE, 5.36],
    ["white on rush-ink", WHITE, c("rushInk"), 6.04],
    ["white on sunday-ink", WHITE, c("sundayInk"), 5.36],
    ["closing-ink on white (its phrase and its pill)", c("closingInk"), WHITE, 5.48],
    ["white on closing-ink", WHITE, c("closingInk"), 5.48],
    // #demo's stage text, at each room's most saturated stop.
    ["ink on the rush room", c("ink"), RUSH_ROOM, 14.92],
    ["muted on the rush room", c("muted"), RUSH_ROOM, 4.97],
    ["violet on the rush room", c("violet"), RUSH_ROOM, 5.54],
    ["caller on the rush room", c("caller"), RUSH_ROOM, 5.16],
    ["ink on the Sunday room", c("ink"), SUNDAY_ROOM, 15.94],
    ["muted on the Sunday room", c("muted"), SUNDAY_ROOM, 5.31],
    ["violet on the Sunday room", c("violet"), SUNDAY_ROOM, 5.92],
    ["caller on the Sunday room", c("caller"), SUNDAY_ROOM, 5.52],
    ["ink on the closing room", c("ink"), CLOSING_ROOM, 16.16],
    ["muted on the closing room", c("muted"), CLOSING_ROOM, 5.39],
    ["violet on the closing room", c("violet"), CLOSING_ROOM, 6.01],
    ["caller on the closing room", c("caller"), CLOSING_ROOM, 5.59],
    ["the moved slot on the closing room", rgb("#065f46"), CLOSING_ROOM, 6.5],
    ["paper on the night room", c("paper"), NIGHT_ROOM, 9.68],
    ["paper-dim on the night room", c("paperDim"), NIGHT_ROOM, 4.68],
    ["lilac on the night room", c("lilac"), NIGHT_ROOM, 5.28],
    ["caller-lit on the night room", c("callerLit"), NIGHT_ROOM, 6.13],
    ["ember-lit on the night room", c("emberLit"), NIGHT_ROOM, 6.7],
    ["ember-lit on its pill in the night room", c("emberLit"), over(c("ember"), 0.16, NIGHT_ROOM), 6.0],
  ];

  const MARKS: [string, Rgb, Rgb, number][] = [
    ["ember mark on white", c("ember"), WHITE, 3.54],
    ["flagged mark on white", c("flagged"), WHITE, 3.48],
    ["electric mark on white", c("electric"), WHITE, 5.7],
    // #demo's clock figures are display type: each gradient's ends on its own room's centre.
    ["rush figure top", rgb("#db2777"), RUSH_ROOM, 3.59],
    ["rush figure foot", rgb("#9d174d"), RUSH_ROOM, 6.15],
    ["Sunday figure top", rgb("#0a8aa8"), SUNDAY_ROOM, 3.36],
    ["Sunday figure foot", rgb("#155e75"), SUNDAY_ROOM, 6.06],
    ["closing figure top", rgb("#059669"), CLOSING_ROOM, 3.19],
    ["closing figure foot", rgb("#065f46"), CLOSING_ROOM, 6.5],
    ["the moved pill's dot on white", rgb("#059669"), WHITE, 3.77],
    ["night figure top", rgb("#f1ecff"), NIGHT_ROOM, 9.85],
    ["night figure foot", rgb("#a78bfa"), NIGHT_ROOM, 4.18],
  ];

  it("draws each clock figure in the gradient the table measures", () => {
    expect(MOMENT_LIGHTS.rush.num).toMatch(/#db2777.*#9d174d/);
    expect(MOMENT_LIGHTS.sunday.num).toMatch(/#0a8aa8.*#155e75/);
    expect(MOMENT_LIGHTS.closing.num).toMatch(/#059669.*#065f46/);
    expect(MOMENT_LIGHTS.night.num).toMatch(/#f1ecff.*#a78bfa/);
  });

  it("reads the deep panel's stops off DEEP_PANEL", () => {
    expect([DEEP_CORNER, DEEP_2, DEEP_3, DEEP_4].every(Boolean)).toBe(true);
  });

  it.each(TEXT)("%s clears 4.5:1 for text, as measured", (_, fg, bg, measured) => {
    const ratio = contrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(measured, 1);
  });

  it.each(MARKS)("%s clears 3:1 for a mark, as measured", (_, fg, bg, measured) => {
    const ratio = contrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeCloseTo(measured, 1);
  });
});

describe("copy", () => {
  it("shares the knowledge base's threshold", () => {
    expect(KB_THRESHOLD).toBe(THRESHOLD);
  });

  it("shows only excerpts of the trust notes, the EU note with its hedge", () => {
    for (const item of HOME.trust.items) {
      const source = TRUST.items.find((s) => s.id === item.id)!;
      expect(source.note, item.id).toContain(item.note);
      expect(item.note).not.toContain("machine-translated");
    }
    expect(HOME.trust.items.find((i) => i.id === "eu")!.note).toContain("named in the FAQ");
    expect(HOME.trust.datums).toHaveLength(HOME.trust.items.length);
    expect(HOME.trust.checklist).toHaveLength(8);
  });

  it("cuts excerpts at whole sentences", () => {
    expect(HOME.pricing.vat).toBe("Prices are in US dollars and exclude VAT.");
    expect(HOME.voice.customNote).toBe(HOME.trust.items.find((i) => i.id === "languages")!.note);
    expect(HOME.trust.items.find((i) => i.id === "company")!.note).toMatch(
      /^Registered in Romania;.*because we hold none\.$/,
    );
  });

  it("trims its subs from their sources", () => {
    expect(INDUSTRIES_GATEWAY.sub.startsWith(HOME.trades.sub.slice(0, -1))).toBe(true);
  });

  it("promises the first ring without promising every call", () => {
    expect(HOME.call.sub).toBe(
      "Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush.",
    );
    expect(HOME.call.sub).not.toMatch(/\bevery call\b/i);
    expect(HOME.call.title).not.toMatch(/\bevery call\b/i);
  });

  it("finds each of the demo's moments in the sub exactly once", () => {
    expect(Object.keys(HOME.call.phrases).sort()).toEqual([...TOUR].sort());
    for (const phrase of Object.values(HOME.call.phrases)) expect(HOME.call.sub.split(phrase)).toHaveLength(2);
  });

  it("says one agent comes with every plan rather than implying free extra agents", () => {
    expect(HOME.pricing.sub).toContain("one agent");
    expect(HOME.pricing.sub).not.toContain("per-agent");
  });

  it("does not count the phone number as an onboarding screen", () => {
    expect(HOME.start.body).toContain("four screens");
    expect(HOME.start.body).not.toMatch(/number/i);
  });

  it("names each relay step as the dashboard's builder does", () => {
    for (const title of Object.values(HOME.after.stepTitle)) expect(INT_BUILDER.mock.actions).toContain(title);
  });

  it("leaves the unsupported cancellation question out", () => {
    expect(HOME.kb.questions.map((q) => q.id)).toEqual(["access", "price", "gym", "home"]);
    for (const id of HOME.kb.sequence) expect(HOME.kb.questions.map((q) => q.id)).toContain(id);
  });

  it("never names a rival or makes a claim the page cannot stand behind", async () => {
    // The brackets keep this file out of the repo-wide grep for the same words.
    const banned =
      /Eleven[L]abs|Vap[i]|Retel[l]|Blan[d]|real[ ]call|9[ ]languages|every[ ]month|straight into[ ]Google|Driv[e]|most phone[ ]agents/;
    // One exception, for one word in two strings: the FAQ's storage answer
    // and its trademark credit name the provider that keeps a call's
    // transcript and audio, because the owner asked where each provider
    // keeps them. That says who holds a call and compares nothing, so every
    // other word in the ban still applies to both.
    const storage = FAQ.find((f) => /recordings and transcripts live/.test(f.q))!.a;
    const credit = HOME_CREDITS.find((c) => c.term.startsWith("Twilio"))!.term;
    const unnamed = (s: string) => s.replace(/Eleven[L]abs/g, "");
    const all = strings([HOME, HOME_CREDITS, buildHomeCalls(), await buildHomeTrades(), buildGreetingTable()]).map((s) =>
      s === storage || s === credit ? unnamed(s) : s,
    );
    expect(all.length).toBeGreaterThan(100);
    expect(all).toEqual(expect.arrayContaining([unnamed(storage), unnamed(credit)]));
    expect(all.filter((s) => banned.test(s))).toEqual([]);
  });

  it("says where each copy of a call is kept, and names no country for Cartesia", () => {
    const storage = FAQ.find((f) => /recordings and transcripts live/.test(f.q))!.a;
    // Ours holds the transcripts and summaries; a recording is never copied in.
    expect(storage).toContain(
      "We keep transcripts and call summaries in the EU, in our database in Ireland, eu-west-1; recordings are never copied into it",
    );
    expect(storage).not.toMatch(/recordings sit in the EU|file storage|plan entitlement rather than a switch/);
    // Twilio's default US1 Region and the agent provider's standard
    // environment: custom-saas-platforms.test.ts holds both endpoints.
    expect(storage).toContain("records a call, it keeps the recording in the United States");
    expect(storage).toMatch(/with Eleven[L]abs, which keeps them in the United States too/);
    // No Cartesia source we could read names a storage country, so no
    // sentence that names Cartesia names a place.
    const cartesia = storage.split(/(?<=\.) /).filter((s) => s.includes("Cartesia"));
    expect(cartesia.length).toBeGreaterThan(0);
    for (const s of cartesia) expect(s).not.toMatch(/United States|\bUS\b|\bEU\b|Ireland|Europe/);
    expect(cartesia.join(" ")).toContain("in a country we have not confirmed");
    // The deletion promise is only what DELETE /api/calls/[id] does.
    expect(storage).not.toContain("still sitting at a vendor");
    // The trust card claims only the copy we keep.
    const eu = TRUST.items.find((i) => i.id === "eu")!;
    expect(eu.label).toBe("We keep your transcripts in the EU");
    expect(eu.note).toContain("we never copy recordings there");
    expect(eu.note).not.toContain("at any time");
  });

  it("scopes the FAQ's deletion promise to deleting a call", () => {
    const storage = FAQ.find((f) => /recordings and transcripts live/.test(f.q))!;
    expect(storage.a).toContain("Deleting a call goes to those providers first");
    expect(storage.a).not.toContain("A deletion goes");
  });
});

describe("plans the samples need", () => {
  it("reads the booking and texting plans off the entitlements", () => {
    expect(GOOGLE_PLAN).toBe(PLANS[requiredPlanFor("googleIntegrations")].name);
    expect(SMS_PLAN).toBe(PLANS[requiredPlanFor("smsConfirmations")].name);
    // The plan names the landing's own price list uses too.
    expect(TIERS.map((t) => t.name)).toContain(GOOGLE_PLAN);
  });

  it("hedges every booking and Google step with its plan", () => {
    expect(HOME.call.foot).toContain(`on ${GOOGLE_PLAN} and above`);
    expect(HOME.after.google.body.startsWith(INT_GOOGLE.body)).toBe(true);
    expect(HOME.after.google.body).toContain(`on ${GOOGLE_PLAN} and above`);
    const google = HOME_CREDITS.find((c) => c.term.includes("Google"))!;
    expect(google.detail).toContain(`on ${GOOGLE_PLAN} and above`);
    expect(google.detail).toContain(`on ${SMS_PLAN} and above`);
  });
});

describe("credits", () => {
  const all = HOME_CREDITS.map((c) => `${c.term} ${c.detail}`).join("\n");

  it("carries each trademark line once", () => {
    for (const line of [INT_GOOGLE.trademarks, INT_ACTIONS.trademarks]) {
      expect(all.split(line).length - 1, line).toBe(1);
    }
  });

  it("does not repeat the VAT line the plan grid already prints", () => {
    expect(all).not.toContain(HOME.pricing.vat);
  });

  it("credits the trade callers and the follow-up samples", () => {
    expect(HOME_CREDITS.map((c) => c.term)).toEqual(
      expect.arrayContaining(["The trade callers", "The follow-up runs"]),
    );
  });

  it("names every third-party mark a trade caller says", async () => {
    const callers = (await buildHomeTrades()).trades.map((t) => t.caller).join("\n");
    expect(/Rightmove/.test(callers)).toBe(/Rightmove/.test(all));
  });

  it("names every provider the FAQ names", () => {
    const faq = FAQ.map((f) => f.a).join("\n");
    for (const mark of [/Twilio/, /Eleven[L]abs/, /Cartesia/]) expect(mark.test(all), String(mark)).toBe(mark.test(faq));
  });
});
