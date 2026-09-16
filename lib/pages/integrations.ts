import { AUTH } from "@/lib/site";

/* ------------------------------------------------------------------ *
 * /product/integrations — every word on the page.
 *
 * Read off the app as it runs today, not off the integrations screen's
 * own marketing:
 *
 *   · Workflows (app/(dashboard)/workflows, lib/workflows/executor.ts) run
 *     after a call, never during one — ElevenLabs only sends post-call
 *     webhooks. Four triggers: call ended, missed call (a call that failed
 *     to connect), negative sentiment, keyword in the transcript.
 *   · Live actions: send a webhook (POST, JSON), notify Slack through an
 *     incoming-webhook URL, tag the call (written into its summary as
 *     "[tag:name]"), wait. Actions run in the order
 *     chosen and stop at the first failure; a workflow shows its runs,
 *     success rate and last run.
 *   · The webhook body is the call's metadata and summary — no transcript,
 *     no signature, no automatic retry. The page says so.
 *   · Gmail, Sheets, Calendar and Docs are in beta (the owner's call,
 *     2026-09-16), and the page says "beta" and nothing more.
 *
 * Numbers use the fictional 555-01xx range and hosts use example.com.
 * ------------------------------------------------------------------ */

export const INT_META = {
  title: "Integrations",
  description:
    "Set a rule once and every call your AI agent takes is passed on when it ends: a Slack message, a tag, or a webhook to your CRM or automation tool. Google Workspace is in beta.",
} as const;

export const INT_HERO = {
  title: "When the call ends, the follow-up starts on its own",
  sub: "Set a rule once — a missed call, an unhappy caller, a word you listen for — and every call that matches is passed on when it ends: a message to your team in Slack, a tag on the call, or a webhook to your CRM or automation tool.",
  primary: { label: "Start free", href: AUTH.signup },
  secondary: { label: "Talk to sales", href: AUTH.contactSales },
  note: "Three steps in your dashboard, no code · Google Workspace in beta",
} as const;

/* ─── Hero: the relay ────────────────────────────────────────────── */

export type TriggerId = "ended" | "missed" | "negative" | "keyword";
export type ActionKind = "webhook" | "slack" | "tag" | "wait";

export type RelayAction = {
  kind: ActionKind;
  /** What the step shows while and after it runs. */
  detail: string;
  result: string;
};

export type RelayScene = {
  id: string;
  label: string;
  trigger: TriggerId;
  call: {
    number: string;
    status: string;
    duration: string;
    sentiment: "positive" | "neutral" | "negative" | null;
    summary: string;
    /** The transcript line the keyword was found in, if any. */
    heard?: { before: string; word: string; after: string };
  };
  actions: RelayAction[];
  /** What each output panel shows. */
  slack?: { channel: string; text: string };
  tag?: string;
  webhook?: { url: string };
};

export const TRIGGERS: { id: TriggerId; label: string; body: string }[] = [
  { id: "ended", label: "Call ended", body: "Any call the agent finishes." },
  { id: "missed", label: "Missed call", body: "A call that didn't connect." },
  { id: "negative", label: "Negative sentiment", body: "The caller sounded unhappy." },
  { id: "keyword", label: "Keyword heard", body: "A word you choose, anywhere in the transcript." },
];

export const RELAY = {
  sample: "Sample calls",
  callTitle: "The call",
  ruleTitle: "The rule",
  outTitle: "Where it lands",
  when: "When",
  then: "Then",
  queued: "Waiting",
  running: "Running",
  done: "Done",
  runDone: (n: number) => `Run completed · ${n} of ${n} ${n === 1 ? "action" : "actions"}`,
  pick: "Play a rule",
  pause: "Pause",
  play: "Play",
  sentiment: { positive: "Positive", neutral: "Neutral", negative: "Negative" },
  noSummary: "No conversation — the call didn't connect.",
  scenes: [
    {
      id: "missed",
      label: "Missed call → Slack",
      trigger: "missed",
      call: {
        number: "+1 555 0142",
        status: "Didn't connect",
        duration: "0:00",
        sentiment: null,
        summary: "",
      },
      actions: [{ kind: "slack", detail: "#front-desk", result: "Message posted" }],
      slack: { channel: "#front-desk", text: "📞 inbound call from +1 555 0142 (n/a)." },
    },
    {
      id: "negative",
      label: "Unhappy caller → tag + Slack",
      trigger: "negative",
      call: {
        number: "+1 555 0187",
        status: "Ended",
        duration: "4:12",
        sentiment: "negative",
        summary: "Third call about the same leak; asked for a manager to ring back today.",
      },
      actions: [
        { kind: "tag", detail: "follow-up", result: "Tag added" },
        { kind: "slack", detail: "#managers", result: "Message posted" },
      ],
      tag: "follow-up",
      slack: {
        channel: "#managers",
        text: "📞 inbound call from +1 555 0187 (negative). Third call about the same leak; asked for a manager to ring back today.",
      },
    },
    {
      id: "keyword",
      label: "“emergency” → webhook + Slack",
      trigger: "keyword",
      call: {
        number: "+1 555 0163",
        status: "Ended",
        duration: "2:47",
        sentiment: "neutral",
        summary: "Water coming through a ceiling; caller isolated the supply and gave the address.",
        heard: { before: "…it's coming through the ceiling, this is an ", word: "emergency", after: "…" },
      },
      actions: [
        { kind: "webhook", detail: "POST oncall.example.com", result: "200 OK" },
        { kind: "slack", detail: "#on-call", result: "Message posted" },
      ],
      webhook: { url: "https://oncall.example.com/hooks/calls" },
      slack: {
        channel: "#on-call",
        text: "📞 inbound call from +1 555 0163 (neutral). Water coming through a ceiling; caller isolated the supply and gave the address.",
      },
    },
    {
      id: "ended",
      label: "Every call → your CRM",
      trigger: "ended",
      call: {
        number: "+1 555 0129",
        status: "Ended",
        duration: "3:05",
        sentiment: "positive",
        summary: "New customer asked for a quote on a bathroom refit; prefers a call after 5pm.",
      },
      actions: [
        { kind: "webhook", detail: "POST crm.example.com", result: "200 OK" },
        { kind: "tag", detail: "sent-to-crm", result: "Tag added" },
      ],
      webhook: { url: "https://crm.example.com/inbound/calls" },
      tag: "sent-to-crm",
    },
  ] satisfies RelayScene[],
} as const;

/* ─── Setting one up ─────────────────────────────────────────────── */

/**
 * The dashboard's own builder (app/(dashboard)/workflows: New workflow →
 * Choose trigger → Add actions → Name & save), shown step by step.
 */
export const INT_BUILDER = {
  eyebrow: "Setting one up",
  title: "Three steps, no code",
  body: "If you can fill in a form, you can build a workflow. Pick when it runs, pick what happens, give it a name — and it's live. Open New workflow in your dashboard and see for yourself.",
  steps: [
    { id: "when", title: "Choose when it runs", body: "Tap one of four moments: a finished call, a missed one, an unhappy caller or a word you listen for." },
    { id: "what", title: "Choose what happens", body: "Tick one or more steps. Slack needs a link you copy from Slack once; a tag needs just a word." },
    { id: "name", title: "Name it and save", body: "Give it a name you'll recognise. It starts working on the next call, and a switch turns it off." },
  ],
  cta: { label: "Try it in your dashboard", href: AUTH.signup },
  mock: {
    title: "Create workflow",
    stepLabels: ["Trigger", "Actions", "Name"],
    whenPrompt: "What should start this workflow?",
    whatPrompt: "What should happen next?",
    namePrompt: "Name your workflow",
    triggers: ["Call ended", "Missed call", "Negative sentiment", "Keyword heard"],
    actions: ["Notify Slack", "Tag the call", "Send webhook", "Wait"],
    slackField: "Slack link",
    slackValue: "https://hooks.slack.com/services/T0…",
    nameValue: "Missed calls to the front desk",
    next: "Next",
    create: "Create workflow",
    live: "Live",
    created: "Workflow created",
  },
} as const;

/* ─── The idea ───────────────────────────────────────────────────── */

export const INT_IDEA = {
  eyebrow: "The idea",
  title: "A workflow is a rule for what happens after the call",
  body: [
    "Every call your agent finishes becomes a record: who rang, how long it lasted, how it went, and a summary of what was said. A workflow watches for the records you care about and does something with each one.",
    "You choose the moment — any call, a missed one, an unhappy caller, a word someone used — and the steps that follow, in order. From then on it runs by itself, call after call.",
  ],
  figure: {
    call: "Call ends",
    record: "Record",
    triggers: ["Ended", "Missed", "Unhappy", "Keyword"],
    steps: ["1", "2", "3"],
    stepsCaption: "Steps, in order",
    logged: "Run logged",
  },
  facts: [
    { id: "after", title: "After the call", body: "Workflows start once a call is over and its record has arrived — never mid-conversation." },
    { id: "order", title: "In the order you set", body: "Steps run one after another, exactly as you arranged them." },
    { id: "stop", title: "Stops at a failure", body: "If a step fails, the ones after it don't run, and the run counts as failed." },
  ],
} as const;

/* ─── Triggers ───────────────────────────────────────────────────── */

export const INT_TRIGGERS = {
  eyebrow: "Triggers",
  title: "Four moments worth acting on",
  figure: {
    ended: "Ended",
    caller: "Caller",
    agent: "Agent",
    positive: "Positive",
    neutral: "Neutral",
    negative: "Negative",
    word: "emergency",
  },
  items: [
    {
      id: "ended" as TriggerId,
      title: "Call ended",
      body: "Fires for every call the agent completes — the one to use for sending everything to your CRM.",
      example: "Every call → CRM",
    },
    {
      id: "missed" as TriggerId,
      title: "Missed call",
      body: "Fires when a call fails to connect, so a person can ring back before the caller tries someone else.",
      example: "Missed → #front-desk",
    },
    {
      id: "negative" as TriggerId,
      title: "Negative sentiment",
      body: "Fires when the call's analysis reads the caller as unhappy — a cue for a manager, not a script.",
      example: "Unhappy → tag + #managers",
    },
    {
      id: "keyword" as TriggerId,
      title: "Keyword heard",
      body: "Fires when a word you choose appears anywhere in the transcript, from either side of the call.",
      example: "“emergency” → on-call",
    },
  ],
} as const;

/* ─── Actions ────────────────────────────────────────────────────── */

export const INT_ACTIONS = {
  eyebrow: "Actions available today",
  title: "Pass it on, mark it, or hand it to any system that listens",
  items: [
    {
      id: "webhook" as ActionKind,
      title: "Send a webhook",
      body: "A POST with the call's details as JSON, to any address you give it — your CRM's inbound hook, Zapier, Make, n8n, or your own server.",
      needs: "Needs: a URL that accepts POST requests",
    },
    {
      id: "slack" as ActionKind,
      title: "Notify Slack",
      body: "A message in the channel of your choice with the caller's number, how the call went and its summary.",
      needs: "Needs: a Slack incoming-webhook URL",
    },
    {
      id: "tag" as ActionKind,
      title: "Tag the call",
      body: "A label written onto the call's summary — follow-up, escalated, vip — so the calls that need a person stand out as you read through them.",
      needs: "Needs: a tag name",
    },
    {
      id: "wait" as ActionKind,
      title: "Wait",
      body: "A short pause between two steps, for a system on the other end that needs a moment.",
      needs: "Up to 30 seconds",
    },
  ],
  trademarks:
    "Slack, Zapier, Make and n8n are trademarks of their respective owners. Neuro Tech Voice sends data to them through their standard webhook features and is not affiliated with or endorsed by them.",
} as const;

/* ─── The payload ────────────────────────────────────────────────── */

export const INT_PAYLOAD = {
  eyebrow: "For developers",
  title: "What your endpoint receives",
  body: "Only needed if you're connecting a system of your own — Slack and tags don't need any of this. One POST per matching call, with a JSON body.",
  method: "POST · Content-Type: application/json",
  fields: [
    { key: "event", example: '"workflow_triggered"', meaning: "Always this value, for now." },
    { key: "call.id", example: '"9f1c…"', meaning: "The call's id in your dashboard." },
    { key: "call.conversation_id", example: '"conv_7a2…"', meaning: "The conversation's id, unique per call." },
    { key: "call.caller_number", example: '"+15550163"', meaning: "The caller's number, when it was shared." },
    { key: "call.direction", example: '"inbound"', meaning: "Which way the call went." },
    { key: "call.duration_seconds", example: "167", meaning: "Length of the call." },
    { key: "call.status", example: '"completed"', meaning: "How the call ended." },
    { key: "call.sentiment", example: '"neutral"', meaning: "Positive, neutral or negative, when known." },
    { key: "call.summary", example: '"Water coming…"', meaning: "A short summary of the conversation." },
    { key: "call.started_at", example: '"2026-09-16T09:41:07Z"', meaning: "When the call began." },
    { key: "timestamp", example: '"2026-09-16T09:44:02Z"', meaning: "When this request was sent." },
  ],
  notes: [
    { id: "transcript", title: "No transcript in the body", body: "The summary travels; the full transcript stays in your dashboard." },
    { id: "signature", title: "Not signed yet", body: "Requests carry no signature. Use a long, private URL, and check the conversation id against your records." },
    { id: "retry", title: "One attempt", body: "A request that fails isn't retried: the run is marked failed and later steps don't run." },
  ],
} as const;

/* ─── Runs ───────────────────────────────────────────────────────── */

export const INT_RUNS = {
  eyebrow: "Knowing it worked",
  title: "Every workflow keeps count of how it's doing",
  body: "Each workflow shows how many times it has run, how often it succeeded and when it last ran — so the rule that broke on Tuesday doesn't stay broken until someone notices.",
  card: {
    name: "Emergencies to on-call",
    trigger: "Keyword heard",
    actions: ["Send webhook", "Notify Slack"],
    runs: "runs",
    justNow: "just now",
    earlier: "2 min ago",
    success: "success",
  },
  steps: {
    ok: "200 OK",
    failed: "500 Server error",
    skipped: "Skipped",
    posted: "Message posted",
  },
} as const;

/* ─── Google Workspace ───────────────────────────────────────────── */

export const INT_GOOGLE = {
  eyebrow: "Beta",
  title: "Google Workspace, in beta",
  body: "Connect your Google account and the same rules can write into Gmail, Sheets, Calendar and Docs. It's in beta, so what each one does may still change as we refine it.",
  badge: "Beta",
  items: [
    { id: "gmail", label: "Gmail", logo: "/integrari/google_mail.svg", will: "Emails a call's summary to whoever needs it." },
    { id: "sheets", label: "Google Sheets", logo: "/integrari/google_sheets.svg", will: "Adds a row for every call: time, number, length, sentiment, summary." },
    { id: "calendar", label: "Google Calendar", logo: "/integrari/google_calendar.svg", will: "Puts a follow-up for a call in the calendar." },
    { id: "docs", label: "Google Docs", logo: "/integrari/google_docs.svg", will: "Writes a call report as a document." },
  ],
  trademarks:
    "Gmail™, Google Sheets™, Google Calendar™ and Google Docs™ are trademarks of Google LLC. Neuro Tech Voice is not endorsed by Google.",
} as const;

/* ─── Recipes ────────────────────────────────────────────────────── */

export const INT_RECIPES = {
  eyebrow: "Rules to start with",
  title: "Five workflows worth setting up on day one",
  items: [
    { id: "crm", trigger: "Call ended", actions: ["Send webhook"], why: "Every call lands in your CRM without anyone copying it across." },
    { id: "missed", trigger: "Missed call", actions: ["Notify Slack"], why: "Someone rings back while the caller is still deciding." },
    { id: "unhappy", trigger: "Negative sentiment", actions: ["Tag: follow-up", "Notify Slack"], why: "A manager hears about it the same day, not in the monthly review." },
    { id: "emergency", trigger: "Keyword: emergency", actions: ["Send webhook", "Notify Slack"], why: "Urgent calls reach the person on call, wherever they are." },
    { id: "cancel", trigger: "Keyword: cancel", actions: ["Tag: retention"], why: "Customers thinking of leaving stand out the next time you read your calls." },
  ],
} as const;

/* ─── Questions ──────────────────────────────────────────────────── */

export const INT_FAQ = {
  eyebrow: "Questions",
  title: "About integrations",
  items: [
    {
      id: "code",
      q: "Do I need to know how to code?",
      a: "No. A workflow is three steps in your dashboard: choose when it runs, choose what happens, give it a name. The webhook step is there for people who have a system to connect; everyone else can use Slack and tags.",
    },
    {
      id: "during",
      q: "Can the agent use my tools during the call?",
      a: "Not today. Workflows run after a call has ended and its record has arrived, so they suit follow-up — notifying, logging, tagging — rather than looking something up mid-conversation.",
    },
    {
      id: "which",
      q: "Which tools can I connect?",
      a: "Anything that accepts a webhook, plus Slack through its incoming webhooks. That covers most CRMs and automation tools such as Zapier, Make and n8n. Gmail, Google Sheets, Google Calendar and Google Docs are in beta.",
    },
    {
      id: "zapier",
      q: "Is there a Zapier app?",
      a: "Not a dedicated one. Start a Zap with Zapier's own webhook trigger, paste its address into a Send webhook step, and the call's details arrive as fields.",
    },
    {
      id: "transcript",
      q: "Does the webhook include the transcript?",
      a: "No — it carries the call's summary and details. The full transcript stays in your dashboard.",
    },
    {
      id: "keyword",
      q: "How does the keyword trigger match?",
      a: "It looks for the word anywhere in the transcript, ignoring capitals — including in what the agent said. Pick words callers use but your agent wouldn't.",
    },
    {
      id: "fail",
      q: "What happens if my endpoint is down?",
      a: "The request isn't retried. The run is marked failed, the steps after it don't run, and the workflow's success rate shows it.",
    },
    {
      id: "security",
      q: "Is the data I send protected?",
      a: "Use an https address and keep it private: requests aren't signed yet. You decide where call data goes, so send it only to systems you're allowed to share it with.",
    },
    {
      id: "google",
      q: "Can I use Google Workspace already?",
      a: "Yes, in beta. Gmail, Google Sheets, Google Calendar and Google Docs connect through your Google account; while they're in beta, what they do may still change.",
    },
  ],
  privacy: { label: "Read the privacy policy", href: "/privacy" },
} as const;

/* ─── Get started ────────────────────────────────────────────────── */

export const INT_START = {
  eyebrow: "Get started",
  title: "Start with the call you'd hate to miss",
  body: "Make a workflow for missed calls, point it at the Slack channel your team reads, and the next one that slips past has someone ringing back.",
  primary: { label: "Start free", href: AUTH.signup },
  secondary: { label: "Talk to sales", href: AUTH.contactSales },
  note: "5 free minutes for 14 days · No card needed",
  more: { label: "See everything the agent does", href: "/product/ai-agents" },
} as const;
