import "server-only";
import { AGENT_LANGUAGES } from "@/lib/agent-languages";
import { buildIndustrySystemPrompt } from "@/lib/agent-prompts";
import { PLATFORM, REEL, USE_CASES } from "@/lib/pages/ai-agents";
import { CAA_HANDOVER, CAA_HERO } from "@/lib/pages/custom-ai-agents";
import { HOME_CALL, type HomeMomentId } from "@/lib/pages/home/call";
import { sentences } from "@/lib/pages/home/source";
import { HOME_TRADES } from "@/lib/pages/home/trades";
import { HOME_VOICE, type HomeRegister } from "@/lib/pages/home/voice";
import { INDUSTRY_PAGES } from "@/lib/pages/industries";
import { ROOM } from "@/lib/pages/knowledge-base";
import { NAV_INDUSTRY_DEFAULT, SOLUTION_ITEMS } from "@/lib/site";
import { greetingFor, mentionsAiDisclosure } from "@/lib/voice/greetings";
import { loadScene } from "@/components/site/industry/scenes";

/* ------------------------------------------------------------------ *
 * The homepage's server-built data: the lines that come out of the
 * app's own code rather than out of a copy file.
 *
 * Every sample call opens with what `greetingFor` writes, every greeting
 * in the voice section is its output, and every trade's boundary is a
 * line of the prompt a new agent starts with. None of that code ships to
 * the browser: `app/page.tsx` calls these builders and the sections get
 * plain strings as props. Each builder throws rather than render a page
 * that says something the code does not.
 * ------------------------------------------------------------------ */

export type { HomeRegister } from "@/lib/pages/home/voice";

/* ─── #demo: closed is for the door, not the phone ───────────────── */

export type { HomeMomentId } from "@/lib/pages/home/call";

export type HomeLine = {
  sp: "agent" | "caller";
  t: string;
  /** A phrase of `t`, exactly as it appears there, that the stage marks. */
  mark?: string;
  /**
   * "booked": ember once the call has ended (home.css `.home-booked`);
   * "answered": the agent's colour, always; "moved": the moment's green.
   */
  markTone?: "booked" | "answered" | "moved";
};

export type HomeCall = {
  id: HomeMomentId;
  /** "Friday" */
  day: string;
  /** "17:05" */
  time: string;
  /** The four figures of `time`, for the clock. */
  digits: readonly [number, number, number, number];
  /** Whether the studio's own opening hours have it open at that moment. */
  open: boolean;
  outcome: "handover" | "moved" | "answered" | "booked";
  outcomeLabel: string;
  /** The greeting first, then agent and caller in turn. */
  lines: HomeLine[];
};

/**
 * The one warm phrase in the night call: the slot the booking lands on,
 * set in ember once the call has ended (home.css `.home-booked`). NEW,
 * and it must appear verbatim in the reel's booking, or the build throws.
 */
const BOOKED_MARK = "Wednesday at 15:00";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type OpeningRule = { days: string[]; from: string; to: string } | { days: string[]; closed: true };

/**
 * Northside Studio's opening hours, read off the knowledge base's own
 * "Opening hours" document ("Monday to Friday · 8:00–20:00", "Sunday ·
 * closed"), so the door sign on the stage cannot disagree with the
 * document #knowledge answers from. Throws on a line it cannot read.
 */
function openingRules(): OpeningRule[] {
  const doc = ROOM.docs.find((d) => d.id === "hours");
  if (!doc) throw new Error("home.server.ts: the knowledge base has no opening hours");
  return doc.lines.map((line): OpeningRule => {
    const [when, hours] = line.split(" · ");
    const range = when.match(/^(\w+) to (\w+)$/);
    const days = range
      ? DAYS.slice(DAYS.indexOf(range[1] as (typeof DAYS)[number]), DAYS.indexOf(range[2] as (typeof DAYS)[number]) + 1)
      : [when];
    if (!days.length || days.some((d) => !DAYS.includes(d as (typeof DAYS)[number]))) {
      throw new Error(`home.server.ts: cannot read the days in the opening hours line "${line}"`);
    }
    if (hours === "closed") return { days: [...days], closed: true };
    const span = hours?.match(/^(\d{1,2}:\d{2})–(\d{1,2}:\d{2})$/);
    if (!span) throw new Error(`home.server.ts: cannot read the hours in the opening hours line "${line}"`);
    return { days: [...days], from: span[1], to: span[2] };
  });
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes from `day` at `time` to the studio's next opening on `later` (in the same week). */
function minutesUntilOpening(day: string, time: string, later: string): number {
  const rule = openingRules().find((r) => r.days.includes(later));
  if (!rule || "closed" in rule) throw new Error(`home.server.ts: the studio has no opening hours on ${later}`);
  const at = (d: string, t: string) => DAYS.indexOf(d as (typeof DAYS)[number]) * 24 * 60 + minutes(t);
  return at(later, rule.from) - at(day, time);
}

/** Is the studio open on `day` at `time` ("17:05"), by its own opening hours? A day with no line is closed. */
export function studioOpenAt(day: string, time: string): boolean {
  const rule = openingRules().find((r) => r.days.includes(day));
  if (!rule || "closed" in rule) return false;
  const t = minutes(time);
  return t >= minutes(rule.from) && t < minutes(rule.to);
}

/** The hours on `day`, as the Sunday call says them: "8:00 to 20:00". */
function hoursOn(day: string): string {
  const rule = openingRules().find((r) => r.days.includes(day));
  if (!rule || "closed" in rule) throw new Error(`home.server.ts: the studio has no opening hours on ${day}`);
  return `${rule.from} to ${rule.to}`;
}

const asLine = (turn: { sp: string; t: string }): HomeLine => ({
  sp: turn.sp === "client" ? "caller" : "agent",
  t: turn.t,
});

/**
 * Four sample calls for Northside Studio, at the four worst moments the
 * sub names, in tour order (busy, just gone, day off, asleep). Each opens
 * with the app's own greeting, which says it is an AI:
 *
 *   rush     Friday 17:05, open, a billing problem: flagged for the owner
 *   closing  Thursday 20:10, closed, Saturday's session moved: free, by the cancellation policy
 *   sunday   Sunday 10:12, closed, a question the opening hours answer
 *   night    Tuesday 03:12, closed, the reel's booking, without its SMS
 */
export function buildHomeCalls(): HomeCall[] {
  const { company, agent } = PLATFORM.design;
  const greeting = greetingFor({
    language: "en",
    tone: "professional",
    company,
    agentName: agent,
  });
  if (!mentionsAiDisclosure(greeting, company)) {
    throw new Error(`home.server.ts: the sample greeting does not say it is an AI: "${greeting}"`);
  }

  const agents = USE_CASES.tabs.flatMap((tab) => tab.agents);
  const reception = agents.find((a) => a.id === "reception");
  const faq = agents.find((a) => a.id === "faq");
  const booking = REEL.scenes.find((s) => s.id === "booking");
  const support = REEL.scenes.find((s) => s.id === "support");
  if (!reception || !faq || !booking || !support) {
    throw new Error("home.server.ts: a sample call the demo is built from is gone");
  }
  const outcome = (id: HomeCall["outcome"]) => {
    const hit = PLATFORM.measure.outcomes.find((o) => o.id === id);
    if (!hit) throw new Error(`home.server.ts: no "${id}" outcome in the product page's log`);
    return hit.label;
  };
  const hi: HomeLine = { sp: "agent", t: greeting };
  const monday = hoursOn("Monday");

  // The move is free only because the policy says so, and only because Saturday is more than a day away.
  const policy = ROOM.docs.find((d) => d.id === "cancel");
  if (!policy?.lines.includes("Free to cancel or move up to 24 hours before")) {
    throw new Error("home.server.ts: the cancellation policy no longer makes a move a day ahead free");
  }
  const late = { day: "Thursday", time: "20:10" }; // NEW
  if (minutesUntilOpening(late.day, late.time, "Saturday") <= 24 * 60) {
    throw new Error("home.server.ts: Saturday's session is no longer more than a day after the closing call");
  }
  const slots = [
    { day: "Tuesday", time: "10:00" },
    { day: "Wednesday", time: "17:30" },
  ]; // NEW
  if (slots.some((s) => !studioOpenAt(s.day, s.time))) {
    throw new Error("home.server.ts: the closing call offers a slot outside the studio's opening hours");
  }
  const moved = `${slots[0].day} at ${slots[0].time}`; // "Tuesday at 10:00"
  if (!HOME_CALL.moved.endsWith(`${slots[0].day} ${slots[0].time}`)) {
    throw new Error(`home.server.ts: the rescheduled pill does not say ${slots[0].day} ${slots[0].time}`);
  }

  const calls: Omit<HomeCall, "digits" | "open">[] = [
    {
      id: "rush",
      day: "Friday", // NEW
      time: support.time, // "17:05"
      outcome: "handover",
      outcomeLabel: outcome("handover"),
      lines: [
        hi,
        asLine(reception.turns[3]), // "I was charged twice this month."
        // NEW, from the reception and escalation agents' own replies, with
        // no promise of when anyone will call back.
        {
          sp: "agent",
          t: "I'm sorry about that. I've flagged it for the owner, with your details.",
        },
      ],
    },
    {
      id: "closing",
      ...late,
      outcome: "moved",
      outcomeLabel: HOME_CALL.moved,
      lines: [
        hi,
        { sp: "caller", t: "Can I move Saturday's session to next week?" }, // NEW
        {
          sp: "agent",
          // NEW. "More than a day away, so it's free" is the cancellation policy's first line, said aloud.
          t: `Of course — it's more than a day away, so moving it is free. I have ${slots[0].day} at ${slots[0].time} or ${slots[1].day} at ${slots[1].time}.`,
        },
        { sp: "caller", t: `${slots[0].day} at ten, please.` }, // NEW
        { sp: "agent", t: `Done — you're moved to ${moved}.`, mark: moved, markTone: "moved" }, // NEW
      ],
    },
    {
      id: "sunday",
      day: "Sunday", // NEW
      time: booking.time, // "10:12"
      outcome: "answered",
      outcomeLabel: outcome("answered"),
      lines: [
        hi,
        { sp: "caller", t: "Are you open tomorrow?" }, // NEW, after the questions agent's "Are you open on Saturday?"
        {
          sp: "agent",
          // The hours are the document's; the offer is the questions agent's own.
          t: `Yes — tomorrow we're open from ${monday}. ${sentences(faq.turns[1].t, 1)}`,
          mark: monday,
          markTone: "answered",
        },
      ],
    },
    {
      id: "night",
      day: "Tuesday", // NEW
      time: "03:12", // NEW
      outcome: "booked",
      outcomeLabel: HOME_CALL.outcome,
      lines: [
        hi,
        // The reel's own greeting is dropped; the one above replaces it.
        ...booking.turns.slice(1, 4).map(asLine),
        // Its first sentence only: the confirmation text needs a plan of its own.
        {
          sp: "agent",
          t: sentences(booking.turns[4].t, 0),
          mark: BOOKED_MARK,
          markTone: "booked",
        },
      ],
    },
  ];

  const built = calls.map((call): HomeCall => {
    const digits = call.time.replace(":", "").split("").map(Number);
    if (digits.length !== 4 || digits.some((d) => !Number.isInteger(d))) {
      throw new Error(`home.server.ts: "${call.time}" is not a clock time`);
    }
    return {
      ...call,
      digits: digits as unknown as HomeCall["digits"],
      open: studioOpenAt(call.day, call.time),
    };
  });

  for (const call of built) {
    if (call.lines.some((line, i) => line.sp !== (i % 2 ? "caller" : "agent"))) {
      throw new Error(`home.server.ts: the ${call.id} call no longer alternates agent and caller from the greeting`);
    }
    for (const line of call.lines) {
      if (line.mark && !line.t.includes(line.mark)) {
        throw new Error(`home.server.ts: "${line.mark}" is not in "${line.t}"`);
      }
      if (line.sp === "agent" && /confirmation text|\bSMS\b|\btext\b/i.test(line.t)) {
        throw new Error(`home.server.ts: the ${call.id} call promises a text message: "${line.t}"`);
      }
    }
  }
  const [rush, closing, sunday, night] = built;
  if (rush.lines.length !== 3 || closing.lines.length !== 5 || sunday.lines.length !== 3 || night.lines.length !== 5) {
    throw new Error("home.server.ts: the sample calls are no longer three, five, three and five lines long");
  }
  if (!night.lines.at(-1)!.t.includes(BOOKED_MARK)) {
    throw new Error(`home.server.ts: the night call's last line does not say "${BOOKED_MARK}"`);
  }
  // The stage's door sign is the whole point of the four moments.
  if (!rush.open || closing.open || sunday.open || night.open) {
    throw new Error(
      "home.server.ts: the opening hours no longer have the studio open mid-rush and closed after hours, on Sunday and at 3 a.m.",
    );
  }
  return built;
}

/* ─── #use-cases: your trade ─────────────────────────────────────── */

export type HomeTrade = {
  key: string;
  ordinal: string;
  label: string;
  kicker: string;
  callerLabel: string;
  caller: string;
  callerIsSample: boolean;
  does: string;
  boundary: string;
  boundaryNote: string;
  href: string;
  linkLabel: string;
};

export type HomeTrades = {
  trades: HomeTrade[];
  initial: { key: string; poster: string; alt: string };
};

/**
 * The first thing a trade's starting prompt says the agent must never do:
 * the first `- Never…` or `- Don't…` line under `Boundaries:`, cut to its
 * first sentence. Home services gives "Never quote a price for a job
 * before a technician has assessed it."
 */
export function boundaryFor(slug: string): string {
  const prompt = buildIndustrySystemPrompt({
    name: "your business",
    industry: slug,
  });
  const lines = prompt.split("\n");
  const start = lines.findIndex((line) => line.trim() === "Boundaries:");
  let found = "";
  if (start >= 0) {
    for (const raw of lines.slice(start + 1)) {
      const line = raw.trim();
      if (!line.startsWith("- ")) break; // the list ends at the blank line before Tone:
      if (/^- (Never|Don't)\b/.test(line)) {
        found = line.slice(2).split(/(?<=[.!?])\s+/)[0];
        break;
      }
    }
  }
  if (!found) throw new Error(`home.server.ts: no "Never…" or "Don't…" boundary in the ${slug} prompt`);
  return found;
}

/** Sixteen trades in menu order, then the custom build, and the scene the section opens on. */
export async function buildHomeTrades(): Promise<HomeTrades> {
  const t = HOME_TRADES;

  const rows: HomeTrade[] = [...INDUSTRY_PAGES.values()].map((trade, i) => ({
    key: trade.slug,
    ordinal: String(i + 1).padStart(2, "0"),
    label: trade.label,
    kicker: trade.kicker,
    callerLabel: t.cells.caller,
    caller: trade.prongs[0].caller,
    callerIsSample: true,
    does: trade.prongs[0].asks,
    boundary: boundaryFor(trade.slug),
    // NEW
    boundaryNote: `Quoted from the template a new ${trade.label.toLowerCase()} agent starts with. You can edit it.`,
    href: `/industries/${trade.slug}`,
    linkLabel: t.pageLink(trade.label),
  }));

  const item = SOLUTION_ITEMS.find((s) => s.id === "custom-ai-agents");
  // src: custom-ai-agents.ts:517 — "It always says it's an AI assistant, and that line can't be removed."
  const saidUpFront = CAA_HANDOVER.columns[2].items[4];
  if (!item || !mentionsAiDisclosure(saidUpFront)) {
    throw new Error("home.server.ts: the custom build's menu item or its AI line has moved");
  }
  rows.push({
    key: item.id,
    ordinal: "—",
    label: "Something else", // NEW
    kicker: CAA_HERO.kicker,
    callerLabel: "Built with you", // NEW
    caller: CAA_HERO.title,
    callerIsSample: false,
    does: item.promise,
    boundary: saidUpFront,
    boundaryNote: "Said up front on every custom build.", // NEW
    href: item.href,
    linkLabel: "Read about custom builds", // NEW
  });

  // Server-side, so the SSR HTML already paints the opening trade's poster.
  const scene = await loadScene(NAV_INDUSTRY_DEFAULT);
  if (!scene) throw new Error(`home.server.ts: no scene for ${NAV_INDUSTRY_DEFAULT}`);

  return {
    trades: rows,
    initial: {
      key: NAV_INDUSTRY_DEFAULT,
      poster: scene.poster,
      alt: scene.alt,
    },
  };
}

/* ─── #how: what the caller hears ────────────────────────────────── */

export type GreetingRow = {
  lang: string;
  label: string;
  dir: "ltr" | "rtl";
  split: "words" | "chars";
  register: HomeRegister;
  before: string;
  disclosure: string;
  after: string;
};

export type GreetingTable = { rows: GreetingRow[]; tour: string[] };

/** The order the untouched section walks the languages in. */
const TOUR = ["en", "es", "de", "ja", "ar", "ro", "hi", "fr", "ko", "it", "zh", "pt", "pl", "nl"];

/** A sentence ends at . ! ? ؟ । before whitespace, or at a CJK full stop, question or exclamation mark. */
const SENTENCE_END = /[.!?؟।](?=\s)|[。！？]/g;

/**
 * Cuts a greeting around the one sentence that tells the caller it is an
 * AI, by the voice library's own test. `before + disclosure + after` is
 * the input exactly; the whitespace between sentences stays outside the
 * disclosure, so an underline on it never runs into a space. Throws
 * unless exactly one sentence discloses.
 */
export function splitDisclosure(text: string, company: string): { before: string; disclosure: string; after: string } {
  const skipSpace = (i: number) => {
    while (i < text.length && /\s/.test(text[i])) i++;
    return i;
  };
  const spans: [number, number][] = [];
  let from = skipSpace(0);
  for (const m of text.matchAll(SENTENCE_END)) {
    const end = m.index + m[0].length;
    if (end <= from) continue;
    spans.push([from, end]);
    from = skipSpace(end);
  }
  if (from < text.length) spans.push([from, text.trimEnd().length]);

  const hits = spans.filter(([s, e]) => mentionsAiDisclosure(text.slice(s, e), company));
  if (hits.length !== 1) {
    throw new Error(`home.server.ts: ${hits.length} sentences disclose the AI in "${text}", expected one`);
  }
  const [s, e] = hits[0];
  return {
    before: text.slice(0, s),
    disclosure: text.slice(s, e),
    after: text.slice(e),
  };
}

const REGISTER_ORDER: readonly HomeRegister[] = HOME_VOICE.registers.map((r) => r.id);

/** All 14 languages × 3 registers of the greeting the app writes for Northside Studio. */
export function buildGreetingTable(): GreetingTable {
  const { company, agent } = PLATFORM.design;
  const rows: GreetingRow[] = [];

  for (const language of AGENT_LANGUAGES) {
    const lang = language.value;
    for (const register of REGISTER_ORDER) {
      const text = greetingFor({
        language: lang,
        tone: register,
        company,
        agentName: agent,
      });
      const parts = splitDisclosure(text, company);
      if (mentionsAiDisclosure(parts.before + parts.after, company)) {
        throw new Error(`home.server.ts: the ${lang} ${register} greeting discloses outside its one sentence`);
      }
      rows.push({
        lang,
        label: language.label,
        dir: lang === "ar" ? "rtl" : "ltr",
        split: lang === "ja" || lang === "zh" ? "chars" : "words",
        register,
        ...parts,
      });
    }
  }

  const codes = new Set<string>(AGENT_LANGUAGES.map((l) => l.value));
  if (TOUR.length !== codes.size || TOUR.some((code) => !codes.has(code))) {
    throw new Error("home.server.ts: the greeting tour and AGENT_LANGUAGES have drifted apart");
  }

  return { rows, tour: [...TOUR] };
}
