import { AGENT_LANGUAGES } from "@/lib/agent-languages";
import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";
import {
  AUTH,
  COMPANY,
  ENTERPRISE,
  INTEGRATIONS,
  PRICING_TRIAL,
  SETUP_LANGS,
  SETUP_VOICES,
  SOLUTION_ITEMS,
  TONES,
  type DemoTurn,
} from "@/lib/site";

/* ------------------------------------------------------------------ *
 * /product/ai-agents — every word on the page.
 *
 * Facts are read off lib/site.ts wherever the site already states them
 * (plans, trial, languages, voices, integrations), so this page cannot
 * quote a number the pricing section has since moved. Every call on the
 * page is a sample and is labelled as one.
 * ------------------------------------------------------------------ */

/** Bookings into Google Calendar start on this plan. Read off the entitlements, as the landing does. */
const CALENDAR_PLAN = PLANS[requiredPlanFor("googleIntegrations")].name;

/** Every language the agent can be set to speak, from the app's own list. */
export const LANG_COUNT = String(AGENT_LANGUAGES.length);

export const AGENTS_META = {
  title: "AI Agents",
  description:
    "AI voice agents that answer every call, qualify the caller and book the job — set up in minutes, with a transcript of every conversation.",
} as const;

export const AGENTS_HERO = {
  title: "AI voice agents that answer every call",
  sub: `Point your calls at an agent that picks up on the first ring. Ready in under ten minutes, fluent in ${LANG_COUNT} languages, booking into Google Calendar on ${CALENDAR_PLAN} and above — and every call written down.`,
  primary: { label: "Start free", href: AUTH.signup },
  secondary: { label: "Talk to sales", href: AUTH.contactSales },
  /** What starting free costs, said where the decision is made. */
  note: "5 free minutes for 14 days · No card needed",
} as const;

/* ─── Hero reel ──────────────────────────────────────────────────── */

export type ReelScene = {
  id: string;
  label: string;
  /** The action at the foot of the open card. */
  link: string;
  /** Local time the call comes in — the after-hours panel needs one. */
  time: string;
  turns: DemoTurn[];
  outcome: string;
  /** Three stops for the panel's light: shadow, body, highlight. */
  light: [string, string, string];
};

export const REEL = {
  kicker: "Sample call",
  pick: "Open this call",
  replay: "Replay",
  pause: "Pause",
  play: "Play",
  scenes: [
    {
      id: "booking",
      label: "Books the appointment",
      link: "Start from this call",
      time: "10:12",
      light: ["#2a1b10", "#9c6232", "#f0cfa6"],
      turns: [
        { sp: "agent", t: "Hello, you've reached the clinic's virtual assistant. How can I help?" },
        { sp: "client", t: "Could I come in on Wednesday afternoon?" },
        { sp: "agent", t: "Of course. I have 15:00 or 16:30 — which suits you better?" },
        { sp: "client", t: "Three o'clock is perfect." },
        { sp: "agent", t: "You're booked for Wednesday at 15:00. A confirmation text is on its way." },
      ],
      outcome: "Google Calendar · event created · SMS sent",
    },
    {
      id: "qualify",
      label: "Qualifies the lead",
      link: "Start from this call",
      time: "14:37",
      light: ["#16211b", "#4d7358", "#cbdcc2"],
      turns: [
        { sp: "client", t: "I'd like a quote for refitting our office kitchen." },
        { sp: "agent", t: "Happy to help. Roughly how big is the space, and when would you want to start?" },
        { sp: "client", t: "About forty square metres, ideally next month." },
        { sp: "agent", t: "Got it. I've sent your details to the estimator — expect a call back today." },
      ],
      outcome: "Qualified lead · logged to Google Sheets",
    },
    {
      id: "support",
      label: "Answers from policy",
      link: "Start from this call",
      time: "17:05",
      light: ["#141a26", "#4a6290", "#cdd8ee"],
      turns: [
        { sp: "client", t: "If I cancel the day before, do I still pay?" },
        { sp: "agent", t: "Cancellations inside 24 hours are charged at half — but I can move you to Thursday at no cost." },
        { sp: "client", t: "Thursday works, let's do that." },
        { sp: "agent", t: "Done. Same time on Thursday, and nothing to pay." },
      ],
      outcome: "Answered from your documents · rescheduled",
    },
    {
      id: "after-hours",
      label: "Covers the night shift",
      link: "Start from this call",
      time: "23:41",
      light: ["#0c0814", "#3b2360", "#a996cf"],
      turns: [
        { sp: "client", t: "Our heating has stopped and it's freezing in here." },
        { sp: "agent", t: "I'm sorry — that's urgent. Is anyone vulnerable in the house tonight?" },
        { sp: "client", t: "My mother is, yes." },
        { sp: "agent", t: "I've flagged it as priority and booked the on-call engineer for 7:30 tomorrow." },
      ],
      outcome: "Flagged urgent · on-call engineer booked",
    },
  ] satisfies ReelScene[],
} as const;

/* ─── Outcomes ───────────────────────────────────────────────────── */

export const OUTCOMES = {
  eyebrow: "Outcomes",
  title: "What changes the week your agent starts picking up",
  items: [
    {
      id: "capture",
      title: "Capture every opportunity",
      body: "Every call is answered on the first ring — at 3 a.m., on a Sunday, in the middle of a rush. The caller who would have tried a competitor books with you instead.",
      labels: { from: "Ringing", to: "Answered", mark: "First ring" },
    },
    {
      id: "qualify",
      title: "Qualify before you call back",
      body: "The agent asks your questions, captures the answers and hands your team a lead that is ready to close — not a missed-call notification.",
      labels: { from: "Enquiries", to: "Qualified", gates: ["Need", "Budget", "Timing"] },
    },
    {
      id: "time",
      title: "Give your team its day back",
      body: "Bookings, reschedules and the same five questions are handled end to end, so the people on payroll do the work only people can do.",
      labels: { from: "Interruptions", to: "Day back", start: "9:00", end: "18:00" },
    },
  ],
} as const;

/* ─── Sample calls player ────────────────────────────────────────── */

export type SampleCall = {
  id: string;
  trade: string;
  headline: string;
  turns: DemoTurn[];
  outcome: string;
};

export const CALLS = {
  eyebrow: "Hear it work",
  title: "Every call ends with the job done",
  cta: { label: "See pricing", href: "/#pricing" },
  kicker: "Sample call",
  build: { label: "Build this agent", href: AUTH.signup },
  labels: {
    agent: "Agent",
    client: "Caller",
    outcome: "Outcome",
    prev: "Previous call",
    next: "Next call",
    play: "Play",
    pause: "Pause",
    replay: "Replay",
  },
  items: [
    {
      id: "trades",
      trade: "Home services",
      headline: "Emergency call-out, dispatched at 18:04",
      turns: [
        { sp: "agent", t: "You're through to the emergency line. I'm the virtual assistant — what's happened?" },
        { sp: "client", t: "My boiler's out and the house is freezing. How fast can you get someone here?" },
        { sp: "agent", t: "I can put a technician with you between seven and nine tonight — that's our emergency window." },
        { sp: "client", t: "Please, yes. It's 14 Mill Road." },
        { sp: "agent", t: "14 Mill Road, between seven and nine. You'll get a text when the technician is on the way." },
      ],
      outcome: "Emergency dispatch · 19:00–21:00",
    },
    {
      id: "restaurants",
      trade: "Restaurants",
      headline: "Friday table saved from a full book",
      turns: [
        { sp: "client", t: "Table for six on Friday, around eight?" },
        { sp: "agent", t: "Friday at eight is full, but I can seat six at 8:45 — or 7:15 if earlier works for you." },
        { sp: "client", t: "8:45 is fine." },
        { sp: "agent", t: "Six at 8:45 on Friday, under your name. We'll see you then." },
      ],
      outcome: "Six covers booked · Friday 20:45",
    },
    {
      id: "law",
      trade: "Law firms",
      headline: "Late-night intake, attorney briefed by morning",
      turns: [
        { sp: "client", t: "There was an accident tonight and I don't know what my options are." },
        { sp: "agent", t: "I understand. Let me take a few details now and have an attorney call you first thing in the morning." },
        { sp: "client", t: "Thank you. It happened on the ring road, around ten." },
        { sp: "agent", t: "I've noted that. An attorney will call you at nine with everything you've told me." },
      ],
      outcome: "Intake captured · attorney notified",
    },
  ] satisfies SampleCall[],
} as const;

/* ─── Platform bento ─────────────────────────────────────────────── */

export const PLATFORM = {
  eyebrow: "Platform",
  title: "Everything your agent runs on, in one workspace",
  design: {
    title: "Shape it in plain language",
    body: "Pick a tone and a language and hear the greeting change as you do. Add a voice, your documents and the calendar it books into — the preview keeps up with every choice.",
    company: "Northside Studio",
    agent: "Ava",
    nav: ["Overview", "Agent", "Voice", "Knowledge", "Calls", "Integrations"],
    active: "Agent",
    crumb: ["Front desk", "Agent"],
    greeting: "Greeting preview",
    tone: "Tone",
    language: "Language",
    tones: TONES,
    langs: SETUP_LANGS,
  },
  voice: {
    title: "A voice that fits the business",
    body: "Audition voices by accent, pitch and pace before a caller ever hears one — or clone your own from a single recording.",
    voices: SETUP_VOICES.slice(0, 4),
    pitch: "Pitch",
    pace: "Pace",
    wpm: (n: number) => `${n} wpm`,
  },
  knowledge: {
    title: "Answers pulled from your own paperwork",
    body: "Drop in price lists, policies and FAQs once. When a caller asks, the agent finds the line that answers it.",
    asks: "Caller asks",
    answers: "Agent answers",
    from: "From",
    docs: [
      {
        name: "Cancellation policy",
        clause: "§2 · Cancelled inside 24h: charged at 50%",
        question: "If I cancel the day before, do I still pay?",
        answer: "Inside 24 hours it's half the fee — but I can move you to Thursday for free.",
      },
      {
        name: "Price list",
        clause: "Deep clean, 3-bed home · from $240",
        question: "Roughly what does a deep clean cost for three bedrooms?",
        answer: "A three-bedroom deep clean starts at $240. Shall I find you a slot?",
      },
      {
        name: "Parking & access",
        clause: "Free parking behind the building, bay 4–9",
        question: "Is there anywhere to park when I come in?",
        answer: "Yes — there's free parking behind the building, bays four to nine.",
      },
    ],
  },
  measure: {
    title: "Every call, filed the moment it ends",
    body: "Each call lands in your log with its transcript and what came of it, and the week adds itself up as they arrive.",
    period: "This week",
    calls: "calls",
    outcomes: [
      { id: "booked", label: "Booked", share: 0.47 },
      { id: "answered", label: "Answered", share: 0.41 },
      { id: "handover", label: "Flagged for you", share: 0.12 },
    ],
    log: [
      { time: "09:12", intent: "New booking", outcome: "booked" },
      { time: "09:26", intent: "Opening hours", outcome: "answered" },
      { time: "09:41", intent: "Reschedule", outcome: "booked" },
      { time: "10:03", intent: "Complaint", outcome: "handover" },
      { time: "10:18", intent: "Price question", outcome: "answered" },
      { time: "10:34", intent: "New booking", outcome: "booked" },
      { time: "10:52", intent: "Directions", outcome: "answered" },
      { time: "11:07", intent: "Quote request", outcome: "booked" },
    ],
    sample: "Sample data",
    total: 286,
  },
} as const;

/* ─── Integrations ───────────────────────────────────────────────── */

const LOGOS: Record<string, string> = {
  "Google Calendar": "/integrari/google_calendar.svg",
  Gmail: "/integrari/google_mail.svg",
  "Google Sheets": "/integrari/google_sheets.svg",
  "Google Docs": "/integrari/google_docs.svg",
  "Google Drive": "/integrari/google_drive.svg",
};

export const AGENT_INTEGRATIONS = {
  eyebrow: "Integrations",
  title: "Bookings, notes and follow-ups go straight into Google",
  cta: { label: "See what each plan connects", href: "/#pricing" },
  items: INTEGRATIONS.map((i) => ({ label: i.label, logo: LOGOS[i.label] })),
  trademarks:
    "Google Calendar™, Gmail™, Google Sheets™, Google Docs™ and Google Drive™ are trademarks of Google LLC. Neuro Tech Voice works with them and is not endorsed by Google.",
} as const;

/* ─── Use cases ──────────────────────────────────────────────────── */

export type UseCaseAgent = {
  id: string;
  name: string;
  job: string;
  turns: DemoTurn[];
  /**
   * A recording of this conversation, served from /public (e.g.
   * "/audio/use-cases/quotes.mp3"). With it, the transcript follows the
   * audio's clock and the stage's sound button comes alive.
   */
  audio?: string;
  /**
   * Second at which each turn starts in `audio`, one per turn. Without it
   * the turns are paced from their word counts, which will not line up
   * with a real recording.
   */
  timings?: number[];
};

export type UseCaseTab = {
  id: string;
  label: string;
  summary: string;
  agents: UseCaseAgent[];
};

export const USE_CASES = {
  eyebrow: "Use cases",
  title: "One agent for every kind of call your business takes",
  cta: { label: "Start with this agent", href: AUTH.signup },
  sound: { unmute: "Unmute", mute: "Mute", unavailable: "Recording coming soon" },
  player: { play: "Play", pause: "Pause", transcript: "Live transcript", agent: "Agent", client: "Caller" },
  tabs: [
    {
      id: "front-desk",
      label: "Front desk",
      summary: "Answer, route and take messages",
      agents: [
        {
          id: "reception",
          name: "Reception",
          job: "Greets and routes",
          turns: [
            { sp: "agent", t: "Thanks for calling. I'm the virtual assistant — how can I help?" },
            { sp: "client", t: "Hi, is this the right number for billing?" },
            { sp: "agent", t: "It is. Tell me what's happened and I'll pass it straight to accounts." },
            { sp: "client", t: "I was charged twice this month." },
            { sp: "agent", t: "I've logged it for the accounts team, with your details. They'll email you about it today." },
          ],
        },
        {
          id: "messages",
          name: "Messages",
          job: "Takes a clear message",
          turns: [
            { sp: "client", t: "Can you tell Daniel I called about the contract?" },
            { sp: "agent", t: "Of course. What's the best number for him to reach you on?" },
            { sp: "client", t: "This one's fine, after two." },
            { sp: "agent", t: "Noted — Daniel gets your message now, with a call-back after 14:00." },
          ],
        },
        {
          id: "faq",
          name: "Questions",
          job: "Hours, prices, directions",
          turns: [
            { sp: "client", t: "Are you open on Saturday?" },
            { sp: "agent", t: "Yes, from nine until one. Would you like me to book you in?" },
            { sp: "client", t: "Not yet, just checking." },
            { sp: "agent", t: "No problem — I'll text you the address and hours now." },
          ],
        },
      ],
    },
    {
      id: "scheduling",
      label: "Scheduling",
      summary: "Book, move and confirm",
      agents: [
        {
          id: "book",
          name: "Bookings",
          job: "Books into your calendar",
          turns: [
            { sp: "client", t: "I need an appointment next week." },
            { sp: "agent", t: "Tuesday at 9:00 or Wednesday at 15:00 are free. Which works?" },
            { sp: "client", t: "Wednesday, please." },
            { sp: "agent", t: "Booked for Wednesday at 15:00 — a confirmation text is on its way." },
          ],
        },
        {
          id: "reschedule",
          name: "Reschedules",
          job: "Moves without the back-and-forth",
          turns: [
            { sp: "client", t: "Something's come up, can I move tomorrow's slot?" },
            { sp: "agent", t: "Sure. The same time on Friday is open, or Monday morning." },
            { sp: "client", t: "Friday's great." },
            { sp: "agent", t: "Moved to Friday. Your old slot is free again for someone else." },
          ],
        },
        {
          id: "cancel",
          name: "Cancellations",
          job: "Frees the slot",
          turns: [
            { sp: "client", t: "I need to cancel Thursday's appointment, sorry." },
            { sp: "agent", t: "That's fine. Would you like to pick a new time while I have you?" },
            { sp: "client", t: "Not yet, I'll call back next week." },
            { sp: "agent", t: "Cancelled. Thursday is open again in the diary — speak soon." },
          ],
        },
      ],
    },
    {
      id: "sales",
      label: "Sales",
      summary: "Qualify and hand over",
      agents: [
        {
          id: "inbound",
          name: "Inbound leads",
          job: "Asks your questions",
          turns: [
            { sp: "client", t: "I saw your ad — how much for a full install?" },
            { sp: "agent", t: "It depends on the size. Is it a home or a business, and roughly how big?" },
            { sp: "client", t: "A shop, about eighty square metres." },
            { sp: "agent", t: "Thanks — I've passed that to our estimator, who'll call you with a price today." },
          ],
        },
        {
          id: "quotes",
          name: "Quote follow-up",
          job: "Answers questions on a quote",
          turns: [
            { sp: "client", t: "I got your quote, but I have a question about the deposit." },
            { sp: "agent", t: "Of course — the deposit is 20%, and the rest is due on completion." },
            { sp: "client", t: "OK, that works for us." },
            { sp: "agent", t: "Great. I'll let the team know you're ready to go ahead." },
          ],
        },
        {
          id: "demo",
          name: "Consultations",
          job: "Books the first meeting",
          turns: [
            { sp: "client", t: "We'd like to talk to someone about a bigger project." },
            { sp: "agent", t: "I can book a consultation. Is Thursday at 11:00 good?" },
            { sp: "client", t: "Thursday is good." },
            { sp: "agent", t: "Booked, with a calendar invite on its way to you now." },
          ],
        },
      ],
    },
    {
      id: "support",
      label: "Support",
      summary: "Resolve and escalate",
      agents: [
        {
          id: "fix",
          name: "Troubleshooting",
          job: "Walks through the fix",
          turns: [
            { sp: "client", t: "The thermostat says offline and I can't change the temperature." },
            { sp: "agent", t: "Let's try the quick fix first: hold the button on the hub for ten seconds." },
            { sp: "client", t: "OK… it's back online." },
            { sp: "agent", t: "Good. I've noted the call, in case it happens again." },
          ],
        },
        {
          id: "policy",
          name: "Policies",
          job: "Answers from your documents",
          turns: [
            { sp: "client", t: "Can I return something I've already opened?" },
            { sp: "agent", t: "Yes, within 30 days, as long as it's unused and in its box." },
            { sp: "client", t: "It is. How do I send it?" },
            { sp: "agent", t: "Post it back with your order number inside, to the address on your receipt." },
          ],
        },
        {
          id: "escalate",
          name: "Escalation",
          job: "Knows when to hand over",
          turns: [
            { sp: "client", t: "This is the third time it's broken. I want to speak to someone." },
            { sp: "agent", t: "I'm sorry — you shouldn't have to call again. I'm flagging this for the manager now." },
            { sp: "client", t: "Thank you." },
            { sp: "agent", t: "It's marked urgent, with everything you've told me. The manager will call you back today." },
          ],
        },
      ],
    },
  ] satisfies UseCaseTab[],
} as const;

/* ─── Data & trust ───────────────────────────────────────────────── */

/**
 * Only what the privacy policy already commits to, in its own terms —
 * no certification the company does not hold.
 */
export const TRUST = {
  eyebrow: "Data & privacy",
  title: "Your callers' data, handled like it matters",
  cta: { label: "Read the privacy policy", href: "/privacy" },
  items: [
    { id: "eu", label: "Based in the EU" },
    { id: "gdpr", label: "GDPR data-subject rights" },
    { id: "dpa", label: "DPA available on request" },
    { id: "transit", label: "Encryption in transit" },
    { id: "rls", label: "Row-level security" },
    { id: "cards", label: "No card numbers stored" },
    { id: "google", label: "Google API Limited Use" },
    { id: "delete", label: "Deleted after account closure" },
  ],
} as const;

/* ─── Get started ────────────────────────────────────────────────── */

export const GET_STARTED = {
  eyebrow: "Get started",
  title: "Pick the way in that fits your phone",
  columns: [
    {
      id: "self-serve",
      title: "Set it up yourself",
      body: "Company, tone, voice, number: four screens, and the agent takes its first call.",
      cta: { label: "Start free", href: PRICING_TRIAL.href, variant: "primary" as const },
      points: [
        "5 free minutes, 14 days, no card",
        `Books into Google Calendar on ${CALENDAR_PLAN} and above, in beta`,
        `Natural voices in ${LANG_COUNT} languages`,
        "Transcript and sentiment on every call",
      ],
    },
    {
      id: "business",
      title: "For busier phones",
      body: "Higher volumes, a written SLA and a named person on our side.",
      cta: { label: "Talk to sales", href: ENTERPRISE.href, variant: "secondary" as const },
      // Enterprise publishes no minutes and no price (lib/site.ts ENTERPRISE).
      points: ["Minutes and a rate priced with you", ...ENTERPRISE.unlocks, "The largest voice-lab allowance"],
    },
    {
      id: "custom",
      title: "Custom builds",
      body: "For when the agent is one part of a bigger system.",
      cta: { label: "Call about a build", href: COMPANY.phoneHref, variant: "secondary" as const },
      points: SOLUTION_ITEMS.slice(0, 4).map((s) => s.label),
    },
  ],
} as const;
