import { AUTH } from "@/lib/site";

/* ------------------------------------------------------------------ *
 * /product/knowledge-base — every word on the page.
 *
 * What the product does is read off the app, not imagined: the dashboard's
 * Knowledge tab takes PDF, DOCX, TXT and MD files up to 10 MB each and web
 * pages by URL (components/agent/tabs/TabKnowledge.tsx), a page is read as
 * it stands when it is added (no re-sync), nothing from calls is written
 * back, and when the agent can't help it says the fallback message the
 * customer sets in the dashboard (lib/elevenlabs/prompt.ts) — so the page
 * presents that line as the customer's to write, not as something the
 * agent decides. The business in every example is a sample, and is
 * labelled as one.
 * ------------------------------------------------------------------ */

/** What the Knowledge tab accepts. Keep in step with TabKnowledge.tsx. */
export const KB_FILES = { types: ["PDF", "DOCX", "TXT", "MD"], maxMb: 10 } as const;

export const KB_META = {
  title: "Knowledge Base",
  description:
    "Give your AI phone agent your price lists, policies, FAQs and web pages. It answers callers from the part that fits — and when the answer isn't written down, it says what you've told it to.",
} as const;

export const KB_HERO = {
  title: "An agent that answers from your own documents",
  sub: "Add your price lists, policies, FAQs and web pages once. When a caller asks, your agent finds the part that answers them and says it in plain words — and when the answer isn't written down, it falls back on the words you've given it.",
  primary: { label: "Start free", href: AUTH.signup },
  secondary: { label: "Talk to sales", href: AUTH.contactSales },
  note: `${KB_FILES.types.join(", ")} up to ${KB_FILES.maxMb} MB · Web pages by address`,
} as const;

/* ─── Hero: the reading room ─────────────────────────────────────── */

export type KbDocKind = "PDF" | "DOCX" | "MD" | "TXT" | "URL";

export type KbDoc = {
  id: string;
  name: string;
  kind: KbDocKind;
  /** Three lines of the document, as the agent would find them. */
  lines: readonly [string, string, string];
};

export type KbQuestion = {
  id: string;
  ask: string;
  /** The document that answers it, or null when none does. */
  doc: string | null;
  /** Which of that document's lines answers it. */
  line: number;
  answer: string;
  /** How closely each document matches, in `ROOM.docs` order, 0–1. */
  match: readonly number[];
};

export const ROOM = {
  sample: "Sample knowledge base · Northside Studio",
  caller: "Caller",
  agent: "Agent",
  pick: "Ask it something",
  status: {
    listening: "Listening",
    reading: "Looking through 5 documents",
    found: "Found it",
    missing: "Not in the documents",
    answering: "Answering",
  },
  foundIn: "Answered from",
  missingOutcome: "Not in the documents · your fallback message",
  fallback: "Your fallback message",
  replay: "Replay",
  pause: "Pause",
  play: "Play",
  docs: [
    {
      id: "prices",
      name: "Price list",
      kind: "PDF",
      lines: ["Sports massage · 30 min · $50", "Sports massage · 60 min · $85", "Physio assessment · 45 min · $95"],
    },
    {
      id: "cancel",
      name: "Cancellation policy",
      kind: "DOCX",
      lines: [
        "Free to cancel or move up to 24 hours before",
        "Within 24 hours: half the session fee",
        "Missed without notice: the full fee",
      ],
    },
    {
      id: "aftercare",
      name: "Aftercare",
      kind: "MD",
      lines: [
        "Drink plenty of water today",
        "No heavy training for 24 hours — walking is fine",
        "Mild soreness for a day or two is normal",
      ],
    },
    {
      id: "hours",
      name: "Opening hours",
      kind: "TXT",
      lines: ["Monday to Friday · 8:00–20:00", "Saturday · 9:00–14:00", "Sunday · closed"],
    },
    {
      id: "faq",
      name: "FAQ page",
      kind: "URL",
      lines: [
        "Step-free entrance, lift to every floor",
        "No referral needed for physio",
        "Towels provided — bring comfortable clothes",
      ],
    },
  ] satisfies KbDoc[],
  questions: [
    {
      id: "cancel",
      ask: "If I cancel tomorrow, do I still pay?",
      doc: "cancel",
      line: 1,
      answer: "Within 24 hours it's half the session fee — but I can move you to another day for free. Would that help?",
      match: [0.16, 0.94, 0.1, 0.22, 0.08],
    },
    {
      id: "price",
      ask: "How much is an hour of sports massage?",
      doc: "prices",
      line: 1,
      answer: "An hour of sports massage is $85. Would you like me to look for a time this week?",
      match: [0.92, 0.2, 0.18, 0.12, 0.1],
    },
    {
      id: "gym",
      ask: "Can I go to the gym straight after my session?",
      doc: "aftercare",
      line: 1,
      answer: "Best to skip heavy training for a day — a walk is fine. And drink plenty of water today.",
      match: [0.1, 0.12, 0.9, 0.26, 0.2],
    },
    {
      id: "access",
      ask: "I use a wheelchair — is it easy to get in?",
      doc: "faq",
      line: 0,
      answer: "Yes — the entrance is step-free, and there's a lift to every floor.",
      match: [0.06, 0.08, 0.14, 0.2, 0.88],
    },
    {
      id: "home",
      ask: "Do you do home visits?",
      doc: null,
      line: 0,
      // Said word for word: this is the business's own fallback line.
      answer: "I don't have an answer for that, and I don't want to guess — I'll ask the team to call you back today.",
      match: [0.22, 0.14, 0.1, 0.3, 0.26],
    },
  ] satisfies KbQuestion[],
} as const;

/* ─── The idea ───────────────────────────────────────────────────── */

export const IDEA = {
  eyebrow: "The idea",
  title: "Instructions tell it how to speak. Documents tell it what's true.",
  body: [
    "Every agent starts with instructions: its name, its manner, what it may book and when to take a message. That's enough to sound right on the phone. It isn't enough to be right about your prices.",
    "A knowledge base is the other half — the documents your team already works from. The agent keeps them to hand on every call, and when a question comes in, it answers from the part that fits.",
  ],
  figure: {
    instructions: "Instructions",
    knowledge: "Your documents",
    agent: "Agent",
    answer: "Answer",
    left: ["Greeting", "Manner", "What to book"],
    right: ["Prices", "Policies", "Access"],
  },
  facts: [
    {
      id: "in",
      title: "What goes in",
      body: "Files you already have — PDF, Word, plain text or Markdown — and pages from your website.",
    },
    {
      id: "out",
      title: "What comes out",
      body: "Answers in plain speech, in the agent's own words and in the language it's set to speak.",
    },
    {
      id: "not",
      title: "What happens at the edges",
      body: "Where your documents don't say, the agent uses a fallback line you write — an offer to call back, say, rather than a guess.",
    },
  ],
} as const;

/* ─── How it finds the answer ────────────────────────────────────── */

export type MeaningSet = {
  id: string;
  /** The cluster the question lands in. */
  topic: string;
  phrasings: readonly string[];
  answer: string;
};

export const MEANING = {
  eyebrow: "How it finds the answer",
  title: "It follows what the caller means, not the words they happen to use",
  asked: "Asked as",
  landsOn: "Lands on",
  topics: [
    { id: "prices", label: "Prices" },
    { id: "cancel", label: "Cancelling" },
    { id: "aftercare", label: "Aftercare" },
    { id: "hours", label: "Hours" },
    { id: "access", label: "Getting in" },
  ],
  sets: [
    {
      id: "cancel",
      topic: "cancel",
      phrasings: [
        "Can I cancel tomorrow?",
        "Something's come up — can I call off Friday?",
        "What happens if I can't make it?",
      ],
      answer: "Your cancellation policy, line two: within 24 hours, half the fee.",
    },
    {
      id: "prices",
      topic: "prices",
      phrasings: [
        "How much is an hour?",
        "What would a full session set me back?",
        "Is the long massage pricey?",
      ],
      answer: "Your price list: 60 minutes, $85.",
    },
    {
      id: "access",
      topic: "access",
      phrasings: ["Do you have a lift?", "I can't manage stairs.", "Can I bring my wheelchair in?"],
      answer: "Your FAQ page: step-free entrance, lift to every floor.",
    },
  ] satisfies MeaningSet[],
  steps: [
    {
      id: "read",
      title: "Read",
      body: "Everything you add is read and kept with your agent, ready for its next call.",
    },
    {
      id: "find",
      title: "Find",
      body: "A question is matched on meaning: “call off Friday” finds your cancellation policy, though the policy never says “call off”.",
    },
    {
      id: "answer",
      title: "Answer",
      body: "The agent answers from the part that fits, in a sentence or two — it doesn't read the document out.",
    },
  ],
} as const;

/* ─── What to add ────────────────────────────────────────────────── */

export const SHELF = {
  eyebrow: "What to add",
  title: "The questions your team answers ten times a day are already written down somewhere",
  kinds: [
    {
      id: "prices",
      title: "Prices and packages",
      body: "Put conditions beside the price, not three pages later.",
      ask: "How much is a first visit?",
    },
    {
      id: "policies",
      title: "Policies",
      body: "Cancellations, deposits, refunds, late arrivals.",
      ask: "Do I get my deposit back?",
    },
    {
      id: "services",
      title: "Services, explained",
      body: "What each one involves, how long it takes, who it's for.",
      ask: "What's the difference between the two?",
    },
    {
      id: "visits",
      title: "Before and after a visit",
      body: "What to bring, how to prepare, what to expect afterwards.",
      ask: "Do I need to bring anything?",
    },
    {
      id: "access",
      title: "Hours, location and access",
      body: "Opening times, parking, entrances, public transport.",
      ask: "Are you open on Saturdays?",
    },
    {
      id: "web",
      title: "Pages from your website",
      body: "Add the page's address and it's read as it stands.",
      ask: "Do you sell gift vouchers?",
    },
  ],
  formats: {
    title: "Accepted",
    items: [...KB_FILES.types, "Web page"],
    limit: `Files up to ${KB_FILES.maxMb} MB each`,
    tip: "Text works; scans don't. A photo of a price list has no words in it to read.",
  },
} as const;

/* ─── Two calls ──────────────────────────────────────────────────── */

export type TwoCallsTurn = { sp: "client" | "agent"; t: string };

export const TWO_CALLS = {
  eyebrow: "The difference",
  title: "Same caller, same question — only one of these calls ends with an answer",
  sample: "Sample calls",
  replay: "Replay both",
  labels: { client: "Caller", agent: "Agent" },
  calls: [
    {
      id: "without",
      label: "Instructions only",
      turns: [
        { sp: "client", t: "How much is a first physio assessment — and do I need a referral?" },
        { sp: "agent", t: "I'm sorry, I don't have prices to hand. I can take your details and ask the team to call you back." },
        { sp: "client", t: "Oh. Okay, I'll wait, I suppose." },
      ],
      outcome: "Call back needed · caller still waiting",
      good: false,
    },
    {
      id: "with",
      label: "With your documents",
      turns: [
        { sp: "client", t: "How much is a first physio assessment — and do I need a referral?" },
        { sp: "agent", t: "It's 45 minutes for $95, and you don't need a referral. Shall I find you a time this week?" },
        { sp: "client", t: "Yes please, Wednesday if you can." },
      ],
      outcome: "Answered on the call · booking in progress",
      good: true,
    },
  ],
  note: "Every “someone will call you back” is a caller deciding whether to wait.",
} as const;

/* ─── Where the documents stop ───────────────────────────────────── */

export const LIMITS = {
  eyebrow: "When it isn't written down",
  title: "Where your documents stop, it says so",
  figure: {
    question: "“Do you do home visits?”",
    threshold: "Close enough to answer",
    answer: "Answer",
    message: "Your fallback line",
    docs: ["Prices", "Policy", "Aftercare", "Hours", "FAQ"],
  },
  points: [
    {
      id: "fallback",
      title: "A fallback you write",
      body: "Set what it says when it can't help — “I'll ask the team to call you back today” leaves the caller with a next step.",
    },
    {
      id: "limits",
      title: "Boundaries from the start",
      body: "Each industry's starting instructions list what the agent mustn't promise, from a diagnosis to a guaranteed slot.",
    },
    {
      id: "record",
      title: "Leaves a record",
      body: "Calls are transcribed, so you can read what was said — and write down the answer it was missing.",
    },
    {
      id: "private",
      title: "Only what callers may hear",
      body: "Anything in your documents can be said to any caller. Keep staff notes, personal data and margins out.",
    },
  ],
  honest:
    "Like any AI, it can occasionally get something wrong. Short, clear documents and a few test calls keep that rare.",
} as const;

/* ─── Keeping it current ─────────────────────────────────────────── */

export const CURRENT = {
  eyebrow: "Keeping it current",
  title: "Change the document, and the next call gives the new answer",
  figure: {
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    old: { name: "Price list", version: "March", price: "$80" },
    next: { name: "Price list", version: "April", price: "$85" },
    swap: "New price list added",
    asked: "An hour of massage?",
  },
  points: [
    "To change a document, remove the old file and add the new one.",
    "A web page is read as it stands when you add it. When the page changes, add it again.",
    "Take out what's out of date — an old price list left in is an old price on the phone.",
  ],
} as const;

/* ─── Writing for the phone ──────────────────────────────────────── */

export const WRITING = {
  eyebrow: "Writing for the phone",
  title: "The documents that answer best already read like answers",
  before: {
    label: "Written for a contract",
    text: "Unless otherwise agreed in writing, any appointment cancelled with less notice than the period set out in clause 4.2 may, at the Studio's discretion, incur a charge calculated with reference to the prevailing tariff.",
  },
  after: {
    label: "Written for a caller",
    heading: "Cancelling or moving a booking",
    lines: [
      "Free up to 24 hours before.",
      "Within 24 hours: half the session fee.",
      "Missed without notice: the full fee.",
    ],
  },
  tips: [
    { id: "topic", title: "One topic per heading", body: "“Parking” under its own heading is easier to find than a line in “About us”." },
    { id: "conditions", title: "Conditions next to the fact", body: "“$85, or $75 before noon” — not the price here and the discount on page six." },
    { id: "not", title: "Say what you don't do", body: "“We don't do home visits” is an answer. Silence is a call back." },
    { id: "dates", title: "Date anything that changes", body: "Label seasonal hours and prices so an old one is easy to spot and remove." },
    { id: "plain", title: "The words callers use", body: "Write “cancel” where a contract would say “terminate”." },
    { id: "private", title: "Nothing private", body: "If it shouldn't be said on the phone, it shouldn't be in the file." },
  ],
} as const;

/* ─── Questions ──────────────────────────────────────────────────── */

export const KB_FAQ = {
  eyebrow: "Questions",
  title: "About the knowledge base",
  items: [
    {
      id: "what",
      q: "What is a knowledge base, in one sentence?",
      a: "The documents your agent answers from: the facts about your business, kept apart from the instructions that tell it how to behave.",
    },
    {
      id: "files",
      q: "Which files can I add?",
      a: `PDF, Word (.docx), plain text and Markdown files up to ${KB_FILES.maxMb} MB each, and web pages by their address. Files with real text in them work best — a scanned image has no words to read.`,
    },
    {
      id: "sync",
      q: "Does it notice when my website changes?",
      a: "Not on its own. A page is read as it stands when you add it; when the page changes, remove it and add it again.",
    },
    {
      id: "learn",
      q: "Does it learn from calls?",
      a: "No. It answers from your documents and its instructions, and nothing a caller says is added to your knowledge base. To teach it something new, write it into a document.",
    },
    {
      id: "language",
      q: "Can my documents be in a different language from my agent?",
      a: "Yes — the agent answers in the language it's set to speak. Make a test call to hear how names and prices come through.",
    },
    {
      id: "fallback",
      q: "What does it say when the answer isn't in my documents?",
      a: "The fallback message you set in the dashboard — for example, an offer to have the team call back. Left blank, it uses a short default phrase, so writing your own is worth the minute it takes.",
    },
    {
      id: "verbatim",
      q: "Will it read my documents out word for word?",
      a: "No. It answers the question in a sentence or two, using the part that applies. Wording that must be said exactly belongs in the agent's instructions.",
    },
    {
      id: "privacy",
      q: "Who can see what I upload?",
      a: "Your documents are stored with your account and used to run your agent, as the privacy policy sets out. Anything in them may be said to a caller, so leave out what callers shouldn't hear.",
    },
    {
      id: "check",
      q: "How do I check it answers correctly?",
      a: "Use the test call in your dashboard to ring your agent and ask what your callers ask. Every call is transcribed too, so you can read each answer it gave.",
    },
    {
      id: "plan",
      q: "Is it included in my plan?",
      a: "Yes. Adding documents is part of setting up any agent, including during the free trial.",
    },
  ],
  privacy: { label: "Read the privacy policy", href: "/privacy" },
} as const;

/* ─── Get started ────────────────────────────────────────────────── */

export const KB_START = {
  eyebrow: "Get started",
  title: "Start with the three questions you're asked most",
  body: "Write the answers down, add the file, and call your agent to ask it. It takes about as long as reading this page did.",
  primary: { label: "Start free", href: AUTH.signup },
  secondary: { label: "Talk to sales", href: AUTH.contactSales },
  note: "5 free minutes for 14 days · No card needed",
  more: { label: "See everything the agent does", href: "/product/ai-agents" },
} as const;
