import type { LucideIcon } from "lucide-react";
import {
  PhoneCall,
  AudioLines,
  CalendarCheck,
  BarChart3,
  Calendar,
  Mail,
  Table2,
  FileText,
  FolderOpen,
  Bot,
  Rocket,
  Stethoscope,
  Scissors,
  Scale,
  Home,
  Wrench,
  Utensils,
  Car,
  Truck,
  Building2,
} from "lucide-react";

/**
 * Single source of truth for every word and link on the site.
 * Edit copy here so tone stays consistent across components.
 */

export const COMPANY = {
  name: "Neuro Tech Voice",
  wordmark: "NEUROVOICE",
  legalName: "NEURO TECH VOICE S.R.L.",
  cui: "CUI: 53666540",
  address:
    "Bulevardul Revoluția Din Decembrie, Nr. 12, Ap. 2, Reșița, Județ Caraș-Severin, România",
  phone: "+40 774 566 367",
  phoneHref: "tel:+40774566367",
  logo: "/logo.png",
} as const;

export const AUTH = {
  signup: "/register",
  signin: "/login",
  contactSales: "tel:+40774566367",
} as const;

/**
 * The company's own timezone — what "now" and "today" mean on this site.
 *
 * Shared rather than repeated so the hero's clock and the calendar panel
 * cannot drift apart: a visitor in Los Angeles at 16:00 on the 26th is
 * already on the 27th in Reșița, and the two would otherwise disagree
 * about the date on the same screen.
 */
export const SITE_TIME_ZONE = "Europe/Bucharest";

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */
export const HERO = {
  badge: "Your AI agent is always on",
  titlePre: "Your AI agent turns missed calls into ",
  titleHighlight: "booked",
  titlePost: " meetings.",
  sub: "Neuro Tech Voice answers, qualifies, and books your customers automatically with a natural-sounding AI voice agent, live on your business number in minutes.",
  primary: "Start free",
  secondary: "Sign in",
  note: "No credit card required · 5 free minutes every month",
  splineScene: "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode",
} as const;

/* ------------------------------------------------------------------ *
 * Editorial hero — the full-bleed dark cover.
 * Copy is deliberately spare: a utility quick-nav on top, one centred
 * statement at the bottom, everything else carried by the portrait.
 * ------------------------------------------------------------------ */
export type CoverColumn = {
  glyph: "triangle" | "circle" | "square";
  label: string;
  links: { label: string; href: string }[];
};

/** Quick-nav columns, each flagged by a geometric glyph. */
export const COVER_COLUMNS: CoverColumn[] = [
  {
    glyph: "triangle",
    label: "Capabilities",
    links: [
      { label: "Features", href: "#features" },
      { label: "Live demo", href: "#demo" },
    ],
  },
  {
    glyph: "circle",
    label: "Narrative",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Who it's for", href: "#use-cases" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    glyph: "square",
    label: "Contact",
    links: [
      { label: "Talk to sales", href: AUTH.contactSales },
      { label: "Sign in", href: AUTH.signin },
      { label: "FAQ", href: "#faq" },
    ],
  },
];

export const HERO_COVER = {
  wordmark: "NEUROVOICE",
  /** Line breaks are authored, not wrapped — each line is a beat. */
  headline: [
    "Neuro Tech Voice.",
    "An AI that answers every call",
    "for those who refuse to miss one.",
  ],
  era: "2026—Future",
  cta: { label: "Start free", href: AUTH.signup },
  columns: COVER_COLUMNS,
  /** Clock is rendered in the company's own timezone. */
  timeZone: SITE_TIME_ZONE,
  place: "RES",
  scrollLabel: "Discover",
  portrait: "/hero-robot.webp",
  /** Greyscale depth map driving the parallax (white = near). */
  portraitDepth: "/hero-robot-depth.webp",
} as const;

/**
 * Art-directed cover artwork.
 *
 * Both crops place the eyes at the same fraction of the frame, so a single
 * `object-position` keeps them at one focal point at every aspect ratio —
 * the figure never drifts or leaves frame, and nothing is letterboxed.
 *
 * `axis` and `eye` are in image space and drive the dissolve: the effect is
 * folded about `axis`, so the two eyes always dissolve as mirror images.
 */
export type CoverArt = {
  src: string;
  depth: string;
  /** Vertical symmetry axis of the face, 0..1 across the image. */
  axis: number;
  /**
   * `[offset of one eye from the axis, eye height, guard radius]`.
   *
   * The eyes are the one thing the dissolve never touches — everything
   * else, crown included, tears. Because the guard is evaluated in space
   * folded about `axis`, a single ellipse covers both eyes and cannot
   * treat them differently.
   */
  eye: [number, number, number];
  /**
   * The unit the dissolve is scaled against, in image widths.
   *
   * Named for the head, and taken at the eye line, but be warned: it was
   * read off the depth map, and that map turned out to be a soft radial
   * blob rather than a silhouette — so this is the blob's half-width,
   * roughly twice the head's. It is kept because every constant in the
   * shader is calibrated against it and the two are self-consistent; the
   * effect is measured in these units, not in real head-widths. Re-derive
   * both together if you ever change it.
   */
  subject: number;
};

export const COVER_ART: { landscape: CoverArt; portrait: CoverArt } = {
  landscape: {
    src: "/hero-robot.webp",
    depth: "/hero-robot-depth.webp",
    // Found by minimising the artwork's own mirror error across the eye
    // band, not eyeballed: x = 1029 of 2048. The previous 0.5039 was 3px
    // off, which tilted the fold plane away from the face's real one.
    axis: 0.5024,
    eye: [0.0513, 0.4063, 0.055],
    subject: 0.2288, // 469px of 2048 — the reference the look was tuned on
  },
  portrait: {
    src: "/hero-robot-portrait.webp",
    depth: "/hero-robot-portrait-depth.webp",
    // Likewise measured: x = 446.5 of 900, not the assumed dead centre.
    axis: 0.4961,
    eye: [0.1085, 0.406, 0.108],
    // 197px of 900, measured off the artwork rather than the depth map —
    // this crop's depth map has a light background, so thresholding it
    // swallowed the vignette and read the head as twice its real width.
    subject: 0.2189,
  },
};

/** Where the eyes sit — used as the fixed object-position for both crops. */
export const COVER_FOCAL = "50% 40.6%";

/** Below this width the portrait crop is used, in CSS and in the shader. */
export const COVER_PORTRAIT_QUERY = "(max-width: 767px)";

/* ------------------------------------------------------------------ *
 * Features — four blocks, each paired with a live product mockup.
 * ------------------------------------------------------------------ */
/**
 * What each feature says. A kicker, a claim, a paragraph, three bullets.
 *
 * `id` is what pairs an entry with its panel in `mockups.tsx` — the copy
 * lives here, the picture of the product lives there, and the section only
 * ever joins them by this key.
 */
export type Feature = {
  id: "agent" | "voice" | "calendar" | "analytics";
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
};

export const FEATURES_INTRO = {
  eyebrow: "Features",
  title: "Everything your AI agent handles for you",
  sub: "From the first ring to the calendar invite, Neuro Tech Voice covers the whole conversation.",
} as const;

export const FEATURES: Feature[] = [
  {
    id: "agent",
    icon: PhoneCall,
    kicker: "Always on",
    title: "Never let a call go to voicemail again",
    body: "Your AI agent picks up instantly, any hour, any day, so every customer gets a real conversation instead of an answering machine.",
    bullets: [
      "No missed calls, ever",
      "Handles nights, weekends, and holidays",
      "Instant pickup, zero hold time",
    ],
  },
  {
    id: "voice",
    icon: AudioLines,
    kicker: "Sounds human",
    title: "A voice callers actually enjoy talking to",
    body: "Built on state-of-the-art voice AI, your agent speaks naturally, understands context, and responds like a real team member would.",
    bullets: [
      "Lifelike, natural-sounding voice",
      "Understands context mid-conversation",
      "Multiple languages and accents",
    ],
  },
  {
    id: "calendar",
    icon: CalendarCheck,
    kicker: "Automatic booking",
    title: "Meetings booked before you even wake up",
    body: "The agent checks your real availability and books directly into Google Calendar during the call, no forms, no follow-up emails, no double-booking.",
    bullets: [
      "Syncs live with Google Calendar",
      "Confirms instantly, no back-and-forth",
      "Zero double-bookings",
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    kicker: "Full visibility",
    title: "Every call, transcribed and analyzed instantly",
    body: "Full transcripts, sentiment scoring, and call trends land in your dashboard the moment a call ends, so you always know how your business sounds.",
    bullets: [
      "Full transcripts for every call",
      "Sentiment analysis built in",
      "Live dashboard, updated in real time",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Voice demo — a pre-recorded call, played back word by word under the
 * "See it in action" spread.
 * ------------------------------------------------------------------ */
export const VOICE_DEMO = {
  chip: "Pre-recorded demo",
  kicker: "Real conversation · AI voice agent",
  title: "Hear what the future of your front desk sounds like",
  transcriptTitle: "Live transcript",
  agentName: "Neuro Tech Voice",
  callerName: "Caller",
  /** Speaker tag, under the orb. */
  tagIdle: "Press play",
  tagPaused: "Paused",
  tagAgent: "● Neuro Tech Voice is speaking",
  tagCaller: "● Caller is speaking",
  tagDone: "✓ Call completed · Appointment confirmed",
  /** Button caption, beside the play control. */
  labelIdle: "Play the conversation",
  labelPlaying: "Playing…",
  labelPaused: "Resume",
  labelDone: "Play again",
  captionDone: "Appointment created automatically. Confirmation text sent.",
} as const;

export type DemoTurn = { sp: "agent" | "client"; t: string };

export const VOICE_DEMO_SCRIPT: DemoTurn[] = [
  {
    sp: "agent",
    t: "Good afternoon! Thank you for calling. I'm Neuro Tech Voice, your virtual assistant. How can I help you today?",
  },
  { sp: "client", t: "Hi! I'd like to book an appointment, please." },
  { sp: "agent", t: "Of course, happy to help. May I have your name, please?" },
  { sp: "client", t: "Sure, it's Alex Morgan." },
  {
    sp: "agent",
    t: "Thank you, Alex. I have Tuesday at 9:00 AM or Wednesday at 3:00 PM available. Which one works best for you?",
  },
  { sp: "client", t: "Wednesday at 3:00 PM sounds good." },
  {
    sp: "agent",
    t: "Perfect! You're booked for Wednesday at 3:00 PM. You'll receive a confirmation text shortly. Is there anything else I can help you with?",
  },
  { sp: "client", t: "No, that's all. Thank you!" },
  { sp: "agent", t: "My pleasure! Have a wonderful day!" },
];

/* ------------------------------------------------------------------ *
 * Integrations — the tools the agent connects to (marquee).
 * ------------------------------------------------------------------ */
export const INTEGRATIONS_INTRO = {
  eyebrow: "Integrations",
  title: "Works with the tools you already use",
} as const;

export const INTEGRATIONS: { label: string; icon: LucideIcon }[] = [
  { label: "Google Calendar", icon: Calendar },
  { label: "Gmail", icon: Mail },
  { label: "Google Sheets", icon: Table2 },
  { label: "Google Docs", icon: FileText },
  { label: "Google Drive", icon: FolderOpen },
];

/* ------------------------------------------------------------------ *
 * How it works — the real setup, run at the reader's own hands.
 *
 * The claim this section has to carry is a duration: you do this yourself,
 * and it is over before a sales call would have been scheduled. Three tiles
 * saying "quick" cannot carry a duration — nothing about a tile is timed.
 * So the section hands over the actual four steps and starts a clock, and
 * every decision below is one the wizard really asks for.
 * ------------------------------------------------------------------ */
export const HOW_INTRO = {
  eyebrow: "How it works",
  title: "Set it up yourself. We'll time you.",
  sub: "The four steps you'd take after signing up — company, agent, voice, live. Take them here instead, with the clock running. No engineer, no script, no call booked with sales.",
} as const;

export type SetupStep = {
  id: "company" | "agent" | "voice" | "launch";
  n: string;
  label: string;
  /** What this step settles — the rail's second line. */
  decides: string;
  icon: LucideIcon;
};

export const SETUP_STEPS: SetupStep[] = [
  {
    id: "company",
    n: "01",
    label: "Company",
    decides: "Who the agent answers for",
    icon: Building2,
  },
  {
    id: "agent",
    n: "02",
    label: "Agent",
    decides: "Its register and its language",
    icon: Bot,
  },
  {
    id: "voice",
    n: "03",
    label: "Voice",
    decides: "What the caller actually hears",
    icon: AudioLines,
  },
  {
    id: "launch",
    n: "04",
    label: "Live",
    decides: "Number, calendar, first call",
    icon: Rocket,
  },
];

/**
 * The register pad's six named points.
 *
 * The wizard offers these as six cards, which is a fine control and a poor
 * argument: six cards say the agent has six settings. Plotted on two axes
 * they say something truer and more valuable — that register is continuous,
 * that "professional" and "friendly" differ along a measurable direction,
 * and that a business can sit between them. `at` is [relaxed, warm], both
 * 0–1, and the pad's puck is free to land anywhere in that square.
 */
export type Tone = {
  id: string;
  label: string;
  blurb: string;
  at: [number, number];
};

export const TONES: Tone[] = [
  {
    id: "formal",
    label: "Formal",
    blurb: "Structured, precise, authoritative",
    at: [0.1, 0.18],
  },
  {
    id: "professional",
    label: "Professional",
    blurb: "Businesslike and unhurried, never stiff",
    at: [0.32, 0.46],
  },
  {
    id: "empathetic",
    label: "Empathetic",
    blurb: "Patient and reassuring, takes its time",
    at: [0.42, 0.9],
  },
  {
    id: "casual",
    label: "Casual",
    blurb: "Relaxed and natural, like a good receptionist",
    at: [0.84, 0.36],
  },
  {
    id: "friendly",
    label: "Friendly",
    blurb: "Warm and conversational, quick to reassure",
    at: [0.74, 0.8],
  },
  {
    id: "energetic",
    label: "Energetic",
    blurb: "Upbeat and brisk, keeps the call moving",
    at: [0.95, 0.6],
  },
];

/**
 * The greeting, in nine languages the agent answers in.
 *
 * Two openings and two offers per language rather than one canned line, so
 * the register pad has something real to move: drag toward relaxed and the
 * opening formula changes, drag toward warm and the offer does.
 *
 * The polite register is held in every language regardless of where the
 * puck sits, which is a linguistic decision and not a shortcut. Romanian,
 * German, Spanish, French, Italian, Dutch, Polish and Portuguese all carry
 * a T–V distinction, and a business answering its own phone uses the
 * formal one at every point on this pad — an agent that slid into `tu`
 * because a slider moved would be a bug in eight of these nine, and in
 * exactly the languages where a caller would notice hardest.
 */
export type SetupLang = {
  code: string;
  name: string;
  /** Opening formula: [measured, relaxed]. */
  open: [string, string];
  /** The offer that follows it: [reserved, warm]. */
  offer: [string, string];
};

export const SETUP_LANGS: SetupLang[] = [
  {
    code: "EN",
    name: "English",
    open: [
      "Thank you for calling {company}. This is {agent}.",
      "Hi — you've reached {company}. {agent} speaking.",
    ],
    offer: [
      "How can I direct your call?",
      "What can I help you with today?",
    ],
  },
  {
    code: "RO",
    name: "Română",
    open: [
      "Vă mulțumim că ați sunat la {company}. Sunt {agent}.",
      "Bună ziua, ați sunat la {company} — sunt {agent}.",
    ],
    offer: [
      "Cu ce vă pot ajuta?",
      "Spuneți-mi, cu ce vă pot fi de folos astăzi?",
    ],
  },
  {
    code: "ES",
    name: "Español",
    open: [
      "Gracias por llamar a {company}. Le atiende {agent}.",
      "Hola, ha llamado a {company}. Soy {agent}.",
    ],
    offer: ["¿En qué puedo ayudarle?", "Cuénteme, ¿en qué puedo ayudarle hoy?"],
  },
  {
    code: "FR",
    name: "Français",
    open: [
      "Merci d'appeler {company}. {agent} à l'appareil.",
      "Bonjour, vous êtes bien chez {company} — c'est {agent}.",
    ],
    offer: [
      "Que puis-je faire pour vous ?",
      "Dites-moi, comment puis-je vous aider aujourd'hui ?",
    ],
  },
  {
    code: "DE",
    name: "Deutsch",
    open: [
      "{company}, guten Tag. Mein Name ist {agent}.",
      "Hallo, hier ist {company} — {agent} am Apparat.",
    ],
    offer: [
      "Wie kann ich Ihnen helfen?",
      "Sagen Sie mir gern, womit ich Ihnen heute helfen kann.",
    ],
  },
  {
    code: "IT",
    name: "Italiano",
    open: [
      "Grazie per aver chiamato {company}. Sono {agent}.",
      "Buongiorno, ha chiamato {company} — sono {agent}.",
    ],
    offer: ["Come posso aiutarla?", "Mi dica pure, come posso esserle utile oggi?"],
  },
  {
    code: "PT",
    name: "Português",
    open: [
      "Obrigado por ligar para {company}. Fala {agent}.",
      "Olá, ligou para {company} — {agent} ao aparelho.",
    ],
    offer: ["Em que posso ajudar?", "Diga-me, em que posso ser útil hoje?"],
  },
  {
    code: "NL",
    name: "Nederlands",
    open: [
      "Bedankt voor uw telefoontje naar {company}. U spreekt met {agent}.",
      "Hallo, u bent bij {company} — u spreekt met {agent}.",
    ],
    offer: [
      "Waarmee kan ik u helpen?",
      "Vertelt u het maar, waarmee kan ik u vandaag helpen?",
    ],
  },
  {
    code: "PL",
    name: "Polski",
    open: [
      "Dziękujemy za telefon do {company}. Z tej strony {agent}.",
      "Dzień dobry, dodzwonili się Państwo do {company} — mówi {agent}.",
    ],
    offer: ["W czym mogę pomóc?", "Proszę mi powiedzieć, w czym mogę dziś pomóc?"],
  },
];

/**
 * Voices, as the app really lists them.
 *
 * `pitch` and `wpm` are not decoration — they draw the signature beside
 * each name and they set the pace at which the greeting is read across it.
 * Which is also the honest limit of what a landing page can do here: there
 * is no audio on this page, so the control says *read*, not *preview*, and
 * shows the two measurements that actually differ between these voices
 * rather than miming a play button that produces silence.
 */
export type SetupVoice = {
  id: string;
  name: string;
  accent: string;
  register: string;
  note: string;
  /** Relative pitch, 0–1 — drives the signature's amplitude and frequency. */
  pitch: number;
  /** Words per minute — drives how fast the greeting reads across it. */
  wpm: number;
};

export const SETUP_VOICES: SetupVoice[] = [
  {
    id: "sarah",
    name: "Sarah",
    accent: "English · American",
    register: "Female · young",
    note: "Confident and warm, with a mature undertone.",
    pitch: 0.66,
    wpm: 158,
  },
  {
    id: "roger",
    name: "Roger",
    accent: "English · American",
    register: "Male · middle aged",
    note: "Easy going, and perfect for casual conversations.",
    pitch: 0.28,
    wpm: 142,
  },
  {
    id: "laura",
    name: "Laura",
    accent: "English · American",
    register: "Female · young",
    note: "Sunny enthusiasm, quick to put a caller at ease.",
    pitch: 0.78,
    wpm: 176,
  },
  {
    id: "george",
    name: "George",
    accent: "English · British",
    register: "Male · middle aged",
    note: "Warm resonance that instantly captivates.",
    pitch: 0.22,
    wpm: 134,
  },
  {
    id: "charlie",
    name: "Charlie",
    accent: "English · Australian",
    register: "Male · young",
    note: "Confident and energetic, never rushed.",
    pitch: 0.41,
    wpm: 168,
  },
  {
    id: "river",
    name: "River",
    accent: "English · American",
    register: "Neutral · middle aged",
    note: "Relaxed and even, ready for anything.",
    pitch: 0.5,
    wpm: 150,
  },
];

/**
 * The greeting the agent opens with, assembled from where the puck sits.
 *
 * Both axes threshold at the midpoint rather than blending: two strings
 * cannot be interpolated into a third that is grammatical in nine
 * languages, and a greeting that came out half-formed would undo the exact
 * impression this section exists to make.
 */
export function greetingFor(o: {
  lang: SetupLang;
  company: string;
  agent: string;
  /** Where the puck sits, both 0–1. */
  relaxed: number;
  warm: number;
}) {
  return `${o.lang.open[o.relaxed > 0.5 ? 1 : 0]} ${
    o.lang.offer[o.warm > 0.5 ? 1 : 0]
  }`
    .replaceAll("{company}", o.company)
    .replaceAll("{agent}", o.agent);
}

/* ------------------------------------------------------------------ *
 * Why it works — published research, not our own numbers.
 *
 * The section used to be four figures on a dark band: 24/7, <1s, 100%,
 * 10min. Every one of them was ours, none was sourced, and three restated
 * things the page had already claimed. A number a visitor cannot check is
 * worth less than no number, because it teaches them to discount the ones
 * that are checkable.
 *
 * So the whole section is now somebody else's data, cited, and the shape
 * of it happens to be the entire argument for answering a phone instantly.
 * ------------------------------------------------------------------ */
export const STATS_INTRO = {
  eyebrow: "Why it works",
  title: "The whole thing is decided in the first five minutes.",
  sub: "Not our claim — MIT's and Harvard Business Review's. Across 15,000 leads and 100,000 call attempts they found the same shape: the odds of qualifying a caller hold flat for five minutes, then fall off a cliff. Drag the marker and watch it happen.",
} as const;

/**
 * The measured decay of a lead, from the MIT / InsideSales.com Lead
 * Response Management study (Dr James B. Oldroyd, MIT Sloan) — three years
 * of data across six companies, 15,000+ leads and 100,000+ call attempts.
 *
 * `qualify` is the relative odds of a lead entering the sales process,
 * indexed to 1.00 for a response inside five minutes. The study's two
 * headline findings are the second and third rows: fourfold worse by ten
 * minutes, twenty-one-fold worse by thirty.
 *
 * The first row is the one that matters most here and it is the one people
 * leave out. The study's baseline is a *five-minute window*, not an
 * instant — it did not measure one second against five minutes, and this
 * page must not pretend it did. So the curve is flat across that whole
 * window, which is both what was measured and, as it turns out, the
 * argument: there is exactly one stretch of the graph where a second costs
 * nothing, it is five minutes long, and a staffed desk cannot promise it.
 *
 * Nothing is extrapolated past thirty minutes. The axis stops where the
 * measurements do.
 */
export const LEAD_DECAY: { at: number; qualify: number }[] = [
  { at: 300, qualify: 1 },
  { at: 600, qualify: 0.25 },
  { at: 1800, qualify: 1 / 21 },
];

/** Seconds at each end of the plot — the study's measured range. */
export const DECAY_FLOOR = 300;
export const DECAY_MAX = 1800;

/**
 * Relative odds of qualifying a caller answered `seconds` after they rang.
 *
 * Log–log interpolation between the measured points, because that is the
 * form the decay actually takes; linear interpolation between 10 and 30
 * minutes would overstate the middle of that stretch by nearly half.
 */
export function qualifyOddsAt(seconds: number) {
  const t = Math.max(1, seconds);
  if (t <= LEAD_DECAY[0].at) return 1;

  for (let i = 0; i < LEAD_DECAY.length - 1; i++) {
    const a = LEAD_DECAY[i];
    const b = LEAD_DECAY[i + 1];
    if (t <= b.at) {
      const f = (Math.log(t) - Math.log(a.at)) / (Math.log(b.at) - Math.log(a.at));
      return Math.exp(
        Math.log(a.qualify) + f * (Math.log(b.qualify) - Math.log(a.qualify)),
      );
    }
  }
  return LEAD_DECAY[LEAD_DECAY.length - 1].qualify;
}

/**
 * Where a call to a small business actually ends up — 411 Locals, 2016,
 * monitoring 85 businesses across 58 industries for thirty days.
 *
 * The point of pairing this with the curve: six calls in ten never reach
 * the graph at all. A business optimising its callback time is arguing
 * about where on the cliff it lands, having already dropped most of its
 * callers off the edge of it.
 */
export const CALL_FATE: { id: string; label: string; share: number }[] = [
  { id: "live", label: "Answered by a person", share: 0.378 },
  { id: "voicemail", label: "Sent to voicemail", share: 0.378 },
  { id: "none", label: "Rang out, nobody picked up", share: 0.243 },
];

/**
 * Cited in full, in the panel's own footer.
 *
 * Sample sizes included on purpose: the section's whole standing rests on
 * these not being marketing statistics, and "2,241 companies" is what
 * separates a finding from a claim.
 */
export const WHY_SOURCES: { work: string; detail: string }[] = [
  {
    work: "Oldroyd, J. B. — Lead Response Management study, MIT Sloan with InsideSales.com",
    detail: "3 years, 6 companies, 15,000+ leads, 100,000+ call attempts",
  },
  {
    work: "Oldroyd, McElheran & Elkington — “The Short Life of Online Sales Leads”, Harvard Business Review, March 2011",
    detail: "2,241 US companies audited; 23% never responded at all",
  },
  {
    work: "411 Locals — small-business call answering study, 2016",
    detail: "85 businesses across 58 industries, monitored 30 days",
  },
];

/* ------------------------------------------------------------------ *
 * Who it's for — the businesses that live and die by the phone.
 *
 * Not a grid of tiles. Each entry is enough to *model a day* on that
 * business's phone line, because the section's argument is not "we serve
 * dentists too" — it is "here is when your phone actually rings, and here
 * is the part of it a staffed front desk structurally cannot hear."
 *
 * `volume` is the load-bearing field: 24 numbers, one per hour, indexed
 * 0–23 in the business's own local time. They are a modelled shape, not
 * telemetry, and the section says so on the panel — but the shapes are the
 * ones each trade actually has, and they are what makes the point. A
 * restaurant's peak sits exactly where nobody can reach the phone; a
 * clinic's second peak is after the front desk goes home; dispatch never
 * drops to zero at all.
 *
 * `busyMiss` is the other half of the argument. Calls are lost outside
 * staffed hours, obviously — but they are also lost *during* them, because
 * the stylist has both hands in someone's hair and the technician is on a
 * roof. That rate is what separates a trade that merely closes at five
 * from one that is unreachable at its own busiest hour.
 * ------------------------------------------------------------------ */
export const USE_CASES_INTRO = {
  eyebrow: "Who it's for",
  title: "Pick your industry. Watch one day on the line.",
  sub: "Same agent, a different vocabulary. Choose a business below and watch a typical day on its phone line — when it actually rings, what those callers ask for, and how much of it a staffed front desk never hears.",
} as const;

export type Industry = {
  id: string;
  icon: LucideIcon;
  /** Short label for the selector chip. */
  label: string;
  /** The line the caller opens with — in this trade's own words. */
  caller: string;
  /** How the agent answers it. */
  agent: string;
  /** What the agent does here that a generic answering service does not. */
  jobs: [string, string, string];
  /** Where the call lands. Shown as the resolved outcome. */
  outcome: string;
  /** Hours the phone is staffed by a human: [open, close), 24h local. */
  staffed: [number, number];
  /** Calls per hour, indexed 0–23. */
  volume: number[];
  /**
   * How long a call runs here, `[min, max]` minutes.
   *
   * Load-bearing, not decoration: the day is costed by walking one phone
   * line through it, so duration is what decides whether the next caller
   * finds it free. A reservation is over in ninety seconds and a legal
   * intake takes a quarter of an hour, and those two businesses lose
   * completely different calls because of it.
   */
  talk: [number, number];
  /**
   * Probability that nobody is free to pick up during a rush hour, 0–1 —
   * applied per call, not as a bulk percentage off the total.
   *
   * This is the second way a call is lost and it is the one that has
   * nothing to do with the line being engaged: the chair is occupied, the
   * crew is on a roof, the floor is mid-service. Off-peak hours run at a
   * third of this rate, since the same team is not under the same pressure
   * at three in the afternoon.
   */
  busyMiss: number;
  /**
   * Why an in-hours call went unheard, in this trade's own terms —
   * completes the sentence "nobody picked up because …". The hour view
   * needs it: a missed call at 19:00 on a staffed line is only
   * believable if the page can say what the team was doing instead.
   */
  busyReason: string;
  /**
   * What callers in this trade are actually ringing about — a handful
   * of short intents, cycled across an hour's calls. Without these the
   * hour view is a row of anonymous bars; with them it is a switchboard,
   * and a bar stamped `voicemail` has something specific attached to it
   * that the business just lost.
   */
  snippets: string[];
  /**
   * Expected booked value of one recovered call, USD — already net of the
   * share that never converts.
   *
   * Deliberately conservative, because this is the number a visitor will
   * test against their own books and the whole panel loses if it reads as
   * inflated. Each one is a job value multiplied through a realistic
   * conversion, not a job value: a recovered dental call is roughly 45% ×
   * a $250 appointment, a recovered legal call is roughly 12% × a $2,000
   * matter, a recovered table is roughly 55% × $70 of covers. Most
   * recovered calls are a question, a reschedule or a browser, and the
   * figure has to carry that rather than pretend every one closes.
   *
   * Kept as one pre-discounted number instead of a value × rate pair
   * because the panel never shows the rate, and a factor nobody can see is
   * a factor that drifts.
   */
  value: number;
};

/**
 * The shape a business has when we do not know which business it is: one
 * morning peak, one late-afternoon peak, a quiet night. Used for whatever
 * a visitor types into the "not on the list" field, so the panel answers
 * an unlisted trade with an honest generic rather than a fabricated one.
 */
const GENERIC_VOLUME = [
  0, 0, 0, 0, 0, 0, 1, 2, 4, 5, 5, 4, 3, 3, 4, 4, 5, 4, 3, 2, 1, 1, 0, 0,
];

/** Built for a trade the visitor names that isn't one of the eight below. */
export function customIndustry(label: string): Industry {
  return {
    id: "custom",
    icon: Building2,
    label,
    caller: `Hi — I'm calling about ${label.toLowerCase()}. Can someone help me with that today?`,
    agent:
      "Of course. Let me take a few details and get you booked with the right person.",
    jobs: [
      "Answers on the first ring, day or night",
      "Qualifies the request in your own words",
      "Books it straight into your calendar",
    ],
    outcome: "Booked · confirmation sent",
    staffed: [9, 18],
    volume: GENERIC_VOLUME,
    talk: [3, 7],
    busyMiss: 0.34,
    busyReason: "the team was already mid-job",
    snippets: [
      "new enquiry",
      "checking availability",
      "question about pricing",
      "reschedule an appointment",
      "status update",
      "first-time customer",
      "changing my details",
      "a complaint to log",
      "what are your hours?",
      "requesting a callback",
      "renewing with you",
    ],
    value: 80,
  };
}

export const INDUSTRIES: Industry[] = [
  {
    id: "clinics",
    icon: Stethoscope,
    label: "Clinics & dental",
    caller:
      "Hi — my crown cracked over the weekend. Is there any chance someone can see me today?",
    agent:
      "That sounds painful, I'm sorry. I have an emergency slot at 4:30 this afternoon — shall I hold it for you?",
    jobs: [
      "Triages urgency before it books anything",
      "Confirms insurance and patient status",
      "Sends the intake form by SMS on the spot",
    ],
    outcome: "Emergency slot held · 16:30",
    staffed: [8, 17],
    volume: [
      0, 0, 0, 0, 0, 0, 1, 3,
      6, 5, 4, 3, 2, 3, 4, 4,
      5, 3, 2, 1, 1, 0, 0, 0,
    ],
    talk: [3, 7],
    busyMiss: 0.28,
    busyReason: "the desk was with a patient",
    snippets: [
      "cracked crown, in pain",
      "reschedule a cleaning",
      "is the dentist in today?",
      "new patient, first visit",
      "does my insurance cover it?",
      "wisdom tooth, swollen",
      "root canal, how much?",
      "results from my x-ray",
      "can I move to Friday?",
      "do you see children?",
      "prescription refill",
    ],
    value: 95,
  },
  {
    id: "salons",
    icon: Scissors,
    label: "Salons & spas",
    caller: "Do you have anything for a cut and colour before Saturday?",
    agent:
      "I do — Thursday at six, or Friday at eleven with your regular stylist. Which suits you better?",
    jobs: [
      "Books by service, duration and stylist",
      "Quotes the price before it commits the chair",
      "Fills the cancellation from your waitlist",
    ],
    outcome: "Booked with your stylist · Friday 11:00",
    staffed: [9, 19],
    volume: [
      0, 0, 0, 0, 0, 0, 0, 1,
      3, 5, 6, 4, 3, 2, 3, 4,
      5, 5, 3, 2, 1, 1, 0, 0,
    ],
    talk: [2, 5],
    busyMiss: 0.42,
    busyReason: "every chair was occupied",
    snippets: [
      "cut and colour, Saturday",
      "how much for balayage?",
      "move my Thursday slot",
      "bridal party, six of us",
      "is my stylist in this week?",
      "walk-in for a trim",
      "gel nails, tomorrow?",
      "do you do men's cuts?",
      "a gift voucher, please",
      "keratin treatment price",
      "running ten minutes late",
    ],
    value: 35,
  },
  {
    id: "law",
    icon: Scale,
    label: "Law firms",
    caller:
      "There was an accident tonight and I don't know what my options are.",
    agent:
      "I understand. Let me take a few details now and have an attorney call you first thing in the morning.",
    jobs: [
      "Runs your intake script, word for word",
      "Screens for conflicts and practice area",
      "Escalates to the on-call attorney when it's urgent",
    ],
    outcome: "Intake captured · attorney notified",
    staffed: [9, 18],
    volume: [
      1, 0, 0, 0, 0, 0, 0, 1,
      2, 4, 5, 4, 2, 3, 4, 4,
      3, 2, 2, 1, 1, 1, 1, 0,
    ],
    talk: [6, 14],
    busyMiss: 0.24,
    busyReason: "the whole firm was in session",
    snippets: [
      "accident last night",
      "reviewing a contract",
      "custody question",
      "status on my case",
      "employer withheld pay",
      "need a will drafted",
      "landlord kept my deposit",
      "setting up a company",
      "appealing a fine",
      "divorce, first steps",
      "I signed under pressure",
    ],
    value: 200,
  },
  {
    id: "realestate",
    icon: Home,
    label: "Real estate",
    caller: "I saw the two-bed you listed this morning — could I see it this week?",
    agent:
      "Absolutely. I have Wednesday at five or Saturday morning. And have you spoken to a lender yet?",
    jobs: [
      "Qualifies budget, timeline and financing",
      "Books showings against the agent's own calendar",
      "Routes the lead to whoever owns that listing",
    ],
    outcome: "Showing booked · Wednesday 17:00",
    staffed: [9, 18],
    volume: [
      0, 0, 0, 0, 0, 0, 0, 1,
      2, 4, 5, 5, 4, 3, 4, 4,
      5, 5, 4, 3, 2, 1, 1, 0,
    ],
    talk: [4, 9],
    busyMiss: 0.32,
    busyReason: "the agent was out at a showing",
    snippets: [
      "viewing the two-bed listing",
      "is it still available?",
      "what are the fees?",
      "selling, need a valuation",
      "pre-approved, ready to see",
      "second viewing, with family",
      "is there parking with it?",
      "when was it built?",
      "can I put in an offer?",
      "renting, not buying",
      "anything cheaper nearby?",
    ],
    value: 85,
  },
  {
    id: "trades",
    icon: Wrench,
    label: "Home services",
    caller: "My boiler's out and the house is freezing. How fast can you get someone here?",
    agent:
      "I can put a technician with you between seven and nine tonight — that's our emergency window. What's the address?",
    jobs: [
      "Separates a real emergency from a quote request",
      "Captures address, access and job details",
      "Dispatches to whoever is actually on call",
    ],
    outcome: "Emergency dispatch · 19:00–21:00",
    staffed: [8, 18],
    volume: [
      1, 1, 0, 0, 0, 1, 2, 4,
      6, 5, 4, 3, 2, 3, 4, 4,
      4, 4, 3, 2, 2, 1, 1, 1,
    ],
    talk: [3, 8],
    busyMiss: 0.4,
    busyReason: "the crew was up on a roof",
    snippets: [
      "boiler out, no heat",
      "quote for a rewire",
      "leak under the sink",
      "move tomorrow's visit",
      "AC not cooling",
      "burst pipe, urgent",
      "no hot water since Tuesday",
      "annual boiler service",
      "a socket is sparking",
      "gutter is blocked",
      "how soon can you quote?",
    ],
    value: 120,
  },
  {
    id: "restaurants",
    icon: Utensils,
    label: "Restaurants",
    caller: "Table for six on Friday, around eight?",
    agent:
      "Friday at eight is full, but I can seat six at 8:45 — or 7:15 if earlier works for you.",
    jobs: [
      "Takes reservations while the floor is slammed",
      "Answers hours, menu and allergen questions",
      "Works the waitlist when a table drops",
    ],
    outcome: "Six covers booked · Friday 20:45",
    staffed: [11, 23],
    volume: [
      0, 0, 0, 0, 0, 0, 0, 0,
      1, 2, 3, 4, 5, 3, 2, 3,
      5, 7, 8, 5, 3, 2, 1, 0,
    ],
    talk: [1, 3],
    busyMiss: 0.52,
    busyReason: "the floor was in the middle of service",
    snippets: [
      "table for six, Friday",
      "any gluten-free mains?",
      "cancel tonight's booking",
      "what time do you close?",
      "private room for twelve",
      "can we bring a cake?",
      "do you have a terrace?",
      "table for two, tonight",
      "is there parking nearby?",
      "changing ours to four",
      "do you do takeaway?",
    ],
    value: 40,
  },
  {
    id: "auto",
    icon: Car,
    label: "Auto sales & service",
    caller: "My check engine light came on — can I bring it in tomorrow?",
    agent:
      "Yes. I have eight in the morning or half past one tomorrow for a diagnostic. Which works?",
    jobs: [
      "Books service by vehicle, plate and job type",
      "Quotes the diagnostic and the lead time",
      "Hands hot sales leads straight to the floor",
    ],
    outcome: "Diagnostic booked · tomorrow 08:00",
    staffed: [8, 18],
    volume: [
      0, 0, 0, 0, 0, 0, 1, 3,
      6, 5, 4, 3, 2, 3, 4, 4,
      5, 4, 3, 1, 1, 0, 0, 0,
    ],
    talk: [3, 7],
    busyMiss: 0.33,
    busyReason: "the service desk had a queue at it",
    snippets: [
      "check engine light on",
      "quote for new tyres",
      "is my car ready?",
      "book an inspection",
      "trade-in valuation",
      "brakes grinding",
      "aircon isn't cold",
      "service history request",
      "finance options?",
      "clutch is slipping",
      "courtesy car available?",
    ],
    value: 120,
  },
  {
    id: "logistics",
    icon: Truck,
    label: "Logistics & dispatch",
    caller: "I need a pickup from the east depot tonight, two pallets.",
    agent:
      "Two pallets from the east depot — let me take the dimensions and I'll have dispatch confirm within the hour.",
    jobs: [
      "Takes load details at three in the morning",
      "Gives live status on any reference number",
      "Wakes dispatch only when it genuinely matters",
    ],
    outcome: "Load logged · dispatch confirming",
    staffed: [8, 18],
    volume: [
      2, 2, 1, 1, 2, 3, 4, 5,
      6, 5, 4, 4, 4, 4, 5, 5,
      5, 4, 3, 3, 2, 2, 2, 2,
    ],
    talk: [3, 9],
    busyMiss: 0.26,
    busyReason: "dispatch was already on another load",
    snippets: [
      "pickup tonight, two pallets",
      "where is my shipment?",
      "quote for a cross-country run",
      "reschedule the delivery",
      "need a temp-controlled van",
      "POD for reference 4471",
      "customs paperwork",
      "driver hasn't arrived",
      "add a second drop",
      "insurance for the load",
      "weekend collection?",
    ],
    value: 70,
  },
];

/* ------------------------------------------------------------------ *
 * Comparison — the agent vs the alternatives.
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * The difference — against the platforms, not against voicemail.
 *
 * The old table compared this product to voicemail and to a receptionist
 * and gave itself six ticks out of six. Nobody shopping for a voice agent
 * in 2026 is choosing between us and an answering machine; they have a tab
 * open on ElevenLabs and one on Vapi, and a table that pretends otherwise
 * tells them we have not met our own market.
 *
 * The honest comparison is not about quality and it is emphatically not
 * about who has the better voice — ElevenLabs *is* the voice layer for
 * much of this category. It is about what arrives when you buy. Those are
 * platforms, sold to people building something; the first line of their
 * own pricing pages is the word "build". What they hand you is a stack of
 * excellent parts. What a business with a ringing phone needs is the
 * assembled thing, and the assembly is the part nobody sells them.
 *
 * So the comparison is a bill of materials. Every layer a working phone
 * agent actually needs, and for each vendor, who supplies it.
 * ------------------------------------------------------------------ */
export const COMPARISON_INTRO = {
  eyebrow: "The difference",
  title: "They sell the parts. We hand over the answered phone.",
  sub: "Every platform below is good at what it is for, and what it is for is building. This is what arrives in the box from each of them — and which layers are still sitting on your desk, waiting for somebody on your side to build them.",
} as const;

/** Who supplies a given layer. */
export type PartState = "shipped" | "metered" | "byo" | "build";

export const PART_STATES: Record<
  PartState,
  { label: string; note: string }
> = {
  shipped: { label: "Shipped working", note: "In the box, in the price" },
  metered: { label: "Theirs, metered", note: "They run it, billed as its own line" },
  byo: { label: "Your account", note: "You sign up with the vendor and pay them" },
  build: { label: "You build it", note: "Your team's prompt, integration and testing" },
};

/**
 * The anatomy of a phone agent, in two halves.
 *
 * The split is the whole argument and it is not rhetorical: the first five
 * layers are a voice stack, which is a solved and competitive market, and
 * the second five are one specific business's operations, which is not a
 * market at all — it is work. Every platform in the table lights up across
 * the top half and goes dark across the bottom one, because the bottom
 * half was never what they were selling.
 */
export type StackLayer = {
  id: string;
  n: string;
  group: "stack" | "business";
  label: string;
  note: string;
};

export const STACK: StackLayer[] = [
  {
    id: "voice",
    n: "01",
    group: "stack",
    label: "A voice",
    note: "The synthesised speech the caller actually hears",
  },
  {
    id: "hearing",
    n: "02",
    group: "stack",
    label: "Hearing",
    note: "Live transcription, down a noisy phone line",
  },
  {
    id: "reasoning",
    n: "03",
    group: "stack",
    label: "Reasoning",
    note: "The model deciding what to say next",
  },
  {
    id: "turns",
    n: "04",
    group: "stack",
    label: "Turn-taking",
    note: "Barge-in, silence, the half-second before it answers",
  },
  {
    id: "number",
    n: "05",
    group: "stack",
    label: "A number that rings",
    note: "A carrier, a number, and the route into it",
  },
  {
    id: "script",
    n: "06",
    group: "business",
    label: "What it says",
    note: "Your greeting, your rules, your escalation path",
  },
  {
    id: "knows",
    n: "07",
    group: "business",
    label: "What it knows",
    note: "Your services, prices, hours and policies",
  },
  {
    id: "calendar",
    n: "08",
    group: "business",
    label: "Your calendar",
    note: "Availability read, the appointment written back",
  },
  {
    id: "followup",
    n: "09",
    group: "business",
    label: "The follow-up",
    note: "Confirmation by SMS and email, then the reminder",
  },
  {
    id: "watch",
    n: "10",
    group: "business",
    label: "Someone watching it",
    note: "Transcripts read, failures caught, prompts corrected",
  },
];

/**
 * Every row below describes how a product is *sold*, taken from its own
 * public pricing and positioning pages — never how well it works. Which is
 * the only comparison worth putting on a landing page: our opinion of a
 * competitor's quality is worth nothing to a reader, and their own
 * description of who they built it for is worth a great deal.
 */
export type Rival = {
  id: string;
  name: string;
  kind: string;
  who: string;
  billing: string;
  live: string;
  parts: Record<string, PartState>;
  ours?: boolean;
};

const ALL_BUILD = {
  script: "build",
  knows: "build",
  calendar: "build",
  followup: "build",
  watch: "build",
} as const;

export const RIVALS: Rival[] = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    kind: "Voice and agents platform",
    who: "Teams building conversational AI into their own product",
    billing: "Per minute for the agent — the model and the telephony billed on top",
    live: "Engineering days to weeks",
    parts: {
      voice: "shipped",
      hearing: "shipped",
      reasoning: "metered",
      turns: "shipped",
      number: "metered",
      ...ALL_BUILD,
    },
  },
  {
    id: "vapi",
    name: "Vapi",
    kind: "Voice agent orchestration",
    who: "Developers and enterprise engineering teams",
    billing:
      "A platform fee per minute; speech, model and voice at cost — or free if you bring your own keys",
    live: "Engineering days to weeks",
    parts: {
      voice: "byo",
      hearing: "byo",
      reasoning: "byo",
      turns: "shipped",
      number: "shipped",
      ...ALL_BUILD,
    },
  },
  {
    id: "retell",
    name: "Retell AI",
    kind: "Voice agent platform",
    who: "Support and sales teams automating calls at scale",
    billing:
      "Per minute, itemised — voice, model, speech and telephony each their own line",
    live: "Engineering days",
    parts: {
      voice: "metered",
      hearing: "metered",
      reasoning: "metered",
      turns: "shipped",
      number: "metered",
      ...ALL_BUILD,
    },
  },
  {
    id: "bland",
    name: "Bland AI",
    kind: "Voice agent platform",
    who: "Teams running high call volume",
    billing:
      "One per-minute rate covering model, speech and voice; telephony separate",
    live: "Engineering days",
    parts: {
      voice: "shipped",
      hearing: "shipped",
      reasoning: "shipped",
      turns: "shipped",
      number: "metered",
      ...ALL_BUILD,
    },
  },
  {
    id: "ntv",
    name: "Neuro Tech Voice",
    ours: true,
    kind: "A finished agent, for one business",
    who: "The business whose phone is ringing on Monday",
    billing: "A monthly plan with the minutes in it — one line on one invoice",
    live: "Minutes — the four steps above this section",
    parts: {
      voice: "shipped",
      hearing: "shipped",
      reasoning: "shipped",
      turns: "shipped",
      number: "shipped",
      script: "shipped",
      knows: "shipped",
      calendar: "shipped",
      followup: "shipped",
      watch: "shipped",
    },
  },
];

export const COMPARISON_NOTE =
  "None of this is a knock on the platforms. Being infrastructure is what they are for, and the first word on their own pricing pages is build. If you are shipping a product, buy the parts — they are very good parts. If your phone is ringing and there is nobody to pick it up, the assembly is the entire job.";

export const COMPARISON_SOURCE =
  "Compiled from each vendor's own public pricing and positioning pages, checked 29 July 2026. Every row describes how a product is sold, not how well it performs. Vendors change their packaging often — if something here has gone out of date, tell us and we will correct it.";

/* ------------------------------------------------------------------ *
 * Pricing — the arithmetic on the invoice, not a marketing rate.
 *
 * Every plan is a fee plus an allowance of minutes plus a rate for the
 * minutes past it, which means the only honest answer to "what does this
 * cost" is a function of call volume, not a number on a card. The section
 * draws that function for all four plans at once.
 *
 * Which is also how the price list gets audited. Run the arithmetic across
 * the range and the plans have to actually order themselves — if a rung's
 * overage rate undercuts its own effective per-minute rate, everyone below
 * it is cheaper at every volume and the rung is dead weight. Numbers here
 * are the business's to set; the section only refuses to hide them.
 * ------------------------------------------------------------------ */
export const PRICING_INTRO = {
  eyebrow: "Pricing",
  title: "Tell us how busy your phone is.",
  sub: "You buy minutes — no seats, no per-agent fee, nothing extra for an integration. Say roughly how many calls you get on a normal day and the whole bill is on screen before you sign anything.",
  annualNote: "2 months free",
} as const;

export type Tier = {
  id: string;
  name: string;
  /** Plan fee per month, USD, billed monthly. */
  monthly: number;
  /** Minutes included in that fee. */
  minutes: number;
  /** USD per minute once the allowance is gone. */
  overage: number;
  /** Shown as "from" — the rung is negotiated rather than listed. */
  from?: boolean;
  /** What this rung adds that the one below it did not have. */
  unlocks: string[];
  cta: string;
  href: string;
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 49,
    minutes: 150,
    overage: 0.25,
    unlocks: ["Basic analytics", "Email support"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 249,
    minutes: 850,
    overage: 0.25,
    unlocks: [
      "Advanced analytics",
      "Call recordings",
      "Google integrations",
      "Priority support",
    ],
    cta: "Start free",
    href: AUTH.signup,
    featured: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 499,
    minutes: 1750,
    overage: 0.22,
    unlocks: ["Full analytics suite", "Every integration, not only Google"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "custom",
    name: "Custom",
    monthly: 999,
    minutes: 3500,
    overage: 0.18,
    from: true,
    unlocks: ["Custom prompts and a written SLA", "A named contact"],
    cta: "Talk to us",
    href: AUTH.contactSales,
  },
];

/**
 * Minutes in an average answered call.
 *
 * Used for one readout — what a single answered call costs on each plan —
 * and stated in the footnote rather than buried, because it is an
 * assumption and every number derived from it moves when it does. Four
 * minutes is the middle of the `talk` ranges the trades carry in the
 * "who it's for" panel, which run from ninety seconds for a reservation to
 * a quarter of an hour for a legal intake.
 */
export const AVG_CALL_MIN = 4;

/**
 * The unit the reader actually thinks in.
 *
 * The first version of this section asked for minutes a month and drew
 * four cost curves against them. It was precise, it was honest, and no
 * customer could use it: a dentist has no idea how many minutes their
 * phone does in a month, and four overlapping lines on a chart is a tool
 * for the person who set the prices, not for the person paying them.
 *
 * Everyone knows roughly how many calls they get in a day. So that is the
 * question, and everything else — calls a month, minutes, plan, bill — is
 * arithmetic we do out loud in front of them.
 */
export const PRICING_MAX_CALLS_DAY = 80;

/** The agent works weekends. Thirty days, not twenty-two. */
export const DAYS_PER_MONTH = 30;

/** Volumes worth naming, so nobody has to guess where to start. */
export const PRICING_PRESETS: { label: string; callsDay: number }[] = [
  { label: "A quiet clinic", callsDay: 6 },
  { label: "A busy salon", callsDay: 15 },
  { label: "A dispatch room", callsDay: 45 },
];

export const PRICING_TRIAL = {
  headline: "Five minutes free, for fourteen days, without a card.",
  body: "Set the agent up, point a number at it, and listen to it work. The plan starts when you decide it should — not when the trial runs out.",
  cta: "Start free",
  href: AUTH.signup,
} as const;

export const PRICING_NOTE =
  "Prices are in US dollars and exclude VAT. Two assumptions sit on the receipt above so that you can argue with them: a call runs about four minutes, and the agent answers every day of the month, weekends included. Everything else is the plan fee plus that plan's own rate for the minutes past its allowance — the arithmetic that lands on the invoice, not a headline rate. Annual billing takes two months off the plan fee; the per-minute rate is unchanged.";

/* ------------------------------------------------------------------ *
 * FAQ
 * ------------------------------------------------------------------ */
export const FAQ_INTRO = {
  eyebrow: "FAQ",
  title: "The things people ask before they say yes.",
  sub: "Grouped by when the question actually turns up, and answered in the open — nothing here is worth making you click for.",
} as const;

/**
 * Doubts arrive in an order, and it is not the order a list puts them in.
 *
 * "Can I cancel" is a question you have before you hand over an email
 * address. "Do I need a new number" only becomes urgent once you are
 * halfway through setting it up. "What if I go over" is a question you
 * have never had until the agent has been answering for three weeks. A
 * flat accordion of seven items makes every reader scan all seven to find
 * the two that are theirs; grouped by moment, they find their own.
 */
export type FaqStage = "before" | "setup" | "live";

export const FAQ_STAGES: {
  id: FaqStage;
  n: string;
  label: string;
  note: string;
}[] = [
  {
    id: "before",
    n: "01",
    label: "Before you start",
    note: "What it costs to find out",
  },
  {
    id: "setup",
    n: "02",
    label: "Setting it up",
    note: "The ten minutes",
  },
  {
    id: "live",
    n: "03",
    label: "Once it is answering",
    note: "Living with it",
  },
];

export const FAQ: { stage: FaqStage; q: string; a: string }[] = [
  {
    stage: "before",
    q: "Do I need a credit card to start?",
    a: "No. The trial runs 14 days with 5 minutes included, and it does not ask for a card. Nothing bills until you choose a plan.",
  },
  {
    stage: "before",
    q: "Can I cancel or change my plan anytime?",
    a: "Yes — upgrade, downgrade or cancel from your billing settings, whenever you like. There is no contract and no notice period.",
  },
  {
    stage: "before",
    q: "Is there a setup fee, or anything else on the invoice?",
    a: "No. The plan fee, plus that plan's per-minute rate for anything past its allowance, is the whole bill. No setup fee, no charge per seat or per agent, nothing extra to connect an integration — the receipt in the pricing section shows both lines.",
  },
  {
    stage: "setup",
    q: "How long does it really take to go live?",
    a: "The four screens above are the real ones, and most businesses are through them in under ten minutes: the company, the agent's register and language, a voice, and live. Your agent cannot take calls until a number is connected to it.",
  },
  {
    stage: "setup",
    q: "Do I need a new phone number, or can I use my existing one?",
    a: "A dedicated business number, bought from your dashboard in seconds. It is not bundled into a plan, and porting an existing number in is not supported yet — so today this sits alongside your current line rather than replacing it.",
  },
  {
    stage: "setup",
    q: "Which languages can it answer in?",
    a: "The agent speaks and understands multiple languages and accents. Nine are set up on the panel above with the greeting written natively in each — the app carries more, and the agent's whole instruction sheet follows whichever you pick.",
  },
  {
    stage: "live",
    q: "What happens if I go over my included minutes?",
    a: "Nothing stops. Extra minutes bill at your plan's own rate — from $0.25 down to $0.18 on the higher tiers — and appear as their own line. You can move plan at any point, and the pricing section will tell you when that is actually cheaper.",
  },
  {
    stage: "live",
    q: "What does it plug into?",
    a: "Google Calendar, Gmail, Sheets, Docs and Drive, natively. The agent reads your availability, writes the appointment back, sends the confirmation and logs the call without anybody moving it by hand.",
  },
];

/* ------------------------------------------------------------------ *
 * The close.
 *
 * Every figure below was earned somewhere higher up the page and is
 * labelled with where — the section is a collection, not a fresh set of
 * claims, and a number that appears for the first time in a call to action
 * is a number the reader has no reason to believe.
 * ------------------------------------------------------------------ */
export const CTA_CLOSE = {
  title: "Your phone is ringing right now.",
  sub: "Whoever is on the other end has already decided how long they will wait. Everything below is on this page above — this is only the part where you do something about it.",
  receipts: [
    {
      value: "62%",
      label: "of calls to a small business are never answered",
      where: "Why it works",
    },
    {
      value: "5 min",
      label: "is how long the odds hold flat before they collapse",
      where: "Why it works",
    },
    {
      value: "10 min",
      label: "is what the setup took, on its own clock",
      where: "How it works",
    },
    {
      value: "$10",
      label: "a day, at ten calls a day, everything included",
      where: "Pricing",
    },
  ],
  primary: "Start free",
  secondary: "Talk to a person",
  note: "5 minutes free · 14 days · no card · cancel whenever",
} as const;

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */
export const FOOTER = {
  tagline: "AI voice agents that answer, qualify, and book your customers, 24/7.",
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Refund & Cancellation Policy", href: "/refund-policy" },
  ],
} as const;
