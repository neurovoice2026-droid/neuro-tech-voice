import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Mail,
  Table2,
  FileText,
  FolderOpen,
  Bot,
  Stethoscope,
  Scissors,
  Scale,
  Home,
  Wrench,
  Utensils,
  Car,
  Truck,
  Building2,
  BookOpenText,
  Blocks,
  LibraryBig,
  MicVocal,
  Speech,
  Captions,
  ShieldCheck,
  KeyRound,
  Hotel,
  Landmark,
  ShoppingBag,
  GraduationCap,
  Dumbbell,
  PawPrint,
  BrainCircuit,
  PanelsTopLeft,
  Workflow,
  Smartphone,
  Database,
} from "lucide-react";

/**
 * Single source of truth for every word and link on the site.
 * Edit copy here so tone stays consistent across components.
 */

/**
 * The imprint, and the four fields Romanian law adds to it.
 *
 * A Romanian commercial site owes its reader more than a name and a CUI:
 * a trade-register number, a working contact address, and links to the two
 * ANPC dispute channels — SAL (alternative resolution) and SOL (the EU's
 * online platform). ANPC checks for those two links specifically, and a
 * footer without them is a finding, not a style choice.
 *
 * They are empty strings rather than plausible-looking values on purpose.
 * A registration number is a fact about a company, not copy: invented, it
 * is worse than missing, because a missing field reads as unfinished and a
 * wrong one reads as fraud. The footer is expected to skip whatever is
 * still blank, so the site ships legibly either way — but it does not ship
 * *correctly* until the owner fills these in.
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
  /**
   * OWNER: still required — a monitored support address.
   *
   * The phone number is Romanian and answered in Romanian business hours.
   * On a platform sold internationally that is not a contact route, it is
   * a contact route for one time zone, so the address is the only way a
   * customer in another one can reach a person. The footer hides the line
   * entirely while this is empty rather than printing a dead label.
   */
  email: "",
} as const;

/*
 * No ANPC SAL/SOL links, and no trade-register number.
 *
 * Both were drafted on the assumption that this sells into Romania, where
 * a commercial site carries the two ANPC dispute-resolution links by law.
 * It sells internationally, so they are the wrong furniture: ANPC has no
 * jurisdiction over a customer in Berlin or Chicago, and "J11/…/2026"
 * identifies the company to a Romanian registrar and to nobody else.
 *
 * The legal identity that does travel stays, in the footer: the legal
 * name, the CUI, and the registered address. If the product is ever sold
 * into Romania as a consumer service, the ANPC pair comes back.
 */

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
 *
 * Copy is deliberately spare: one centred statement at the bottom,
 * everything else carried by the portrait. The utility row that used to
 * sit across the top is now the site header, which is a page-level
 * element rather than part of the cover — see SITE_HEADER below.
 * ------------------------------------------------------------------ */
export const HERO_COVER = {
  /** Line breaks are authored, not wrapped — each line is a beat. */
  headline: [
    "Neuro Tech Voice.",
    "An AI that answers every call",
    "for those who refuse to miss one.",
  ],
  era: "2026—Future",
  cta: { label: "Start free", href: AUTH.signup },
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
 * Voice demo — a call reconstructed and replayed in text, under the
 * "watch a call become an appointment" spread.
 *
 * Every word in this block used to promise audio. "Pre-recorded demo",
 * "Press play", "Playing…", "Play again": four labels selling a recording
 * that does not exist in this repository and is not going to this pass.
 * ./voice-demo noticed, wrote honest labels of its own inside the
 * component, and left a comment saying it had done so because this file
 * was frozen. It is not frozen now, so the honest words come home and the
 * component's local copies can go whenever somebody is in there.
 *
 * `agentName`, `callerName` and `captionDone` are the three the section
 * actually renders today. The rest are kept to the letter — same keys,
 * same order — because a section agent may wire them back up at any time,
 * and a dormant string that lies is still a string that lies.
 * ------------------------------------------------------------------ */
export const VOICE_DEMO = {
  chip: "No audio · a reconstruction",
  kicker: "One call · replayed at the pace it ran",
  title: "Watch a call become an appointment",
  transcriptTitle: "What was said",
  agentName: "Neuro Tech Voice",
  callerName: "Caller",
  /** Speaker tag, under the orb. */
  tagIdle: "Not running yet",
  tagPaused: "Paused",
  tagAgent: "● Neuro Tech Voice is speaking",
  tagCaller: "● Caller is speaking",
  tagDone: "✓ Call ended · appointment in the diary",
  /** Button caption, beside the transport. */
  labelIdle: "Run the call",
  labelPlaying: "Running…",
  labelPaused: "Resume",
  labelDone: "Run it again",
  captionDone:
    "Booked for the Wednesday while she was still on the line. The confirmation text leaves from the number she rang — on a paid plan, not on the trial.",
} as const;

export type DemoTurn = { sp: "agent" | "client"; t: string };

/**
 * Nine turns, and four of them are load-bearing in another file.
 *
 * ./voice-demo cuts this script to `[1, 4, 5, 6]` by index and stamps its
 * call log against those four — "two free slots, offered by name" fires on
 * turn 4, "Wednesday, 3:00 PM" on turn 6. So the shape here is a contract:
 * nine turns, agent first, strictly alternating, the ask at 1, two named
 * times at 4, the pick at 5, the booking read back at 6. Move a line and
 * the log beside it starts describing a call nobody had.
 *
 * What changed is everything else. The old script was a stock demo — "I'd
 * like to book an appointment, please", a caller called Alex Morgan with
 * no problem and no gender, three exclamation marks and a "Perfect!".
 * Nobody rings a business to book an appointment; they ring because
 * something is wrong. So the caller has a fault, an address and a name,
 * and the agent behaves the way the code actually makes it behave:
 *
 *  · The opening line discloses the AI. Not a flourish — `applyDisclosure`
 *    in lib/voice/greetings.ts adds it to any greeting that omits it, and
 *    the demo should show what a caller genuinely hears.
 *  · It takes the name before it offers a time, because `book_appointment`
 *    will not write a booking without one.
 *  · It offers two times, not a list. The tool's own instruction is to
 *    offer two or three aloud and never read the whole day out.
 *  · It does not diagnose the boiler and it does not quote a price. That
 *    refusal is the product, and it is also every industry page's rule.
 *
 * The confirmation text is the one future-tense promise on the page, and
 * it names its mechanism, which is the only kind this voice makes.
 */
export const VOICE_DEMO_SCRIPT: DemoTurn[] = [
  {
    sp: "agent",
    t: "Good afternoon, you're through to the office. You're speaking to an AI assistant — how can I help?",
  },
  {
    sp: "client",
    t: "The boiler's making a noise like a kettle and the pressure keeps dropping. Can somebody come and look at it?",
  },
  {
    sp: "agent",
    t: "That's one for an engineer rather than for me over the phone. Can I take your name first?",
  },
  { sp: "client", t: "Yvonne Parr — fourteen Cotham Road." },
  {
    sp: "agent",
    t: "Thank you, Mrs Parr. The diary has Tuesday at 9:00 AM, or Wednesday at 3:00 PM. Which of those suits you?",
  },
  { sp: "client", t: "Wednesday at three, please." },
  {
    sp: "agent",
    t: "Wednesday at 3:00 PM, and it's in the diary now. A confirmation text is on its way to this number. Anything else while I have you?",
  },
  { sp: "client", t: "No, that's everything. Thank you." },
  {
    sp: "agent",
    t: "Thank you for ringing. An engineer will see you Wednesday afternoon.",
  },
];

/* ------------------------------------------------------------------ *
 * Integrations — the tools the agent connects to.
 *
 * "Works with the tools you already use" was a claim about a feature list.
 * What actually earns the strip is a claim about a call: the integration is
 * not a logo, it is the reason the appointment exists before the caller has
 * put the phone down. So the words say that, and the logos stop being the
 * argument and go back to being evidence for it.
 *
 * The line now splits the five logos into the two things they actually are,
 * because the old one did not and the difference is the whole honesty of
 * the strip. Only Calendar is reached *during* the call — free times read,
 * the appointment written back, while the caller is still talking. Gmail,
 * Sheets, Docs and Drive are post-call workflow steps; they cannot touch a
 * live conversation and drawing them in one row implied they could.
 *
 * Two concessions ride in the sentence rather than in a footnote. Google
 * Calendar is the only calendar there is — no other provider exists in the
 * product — and all five of these are badged beta inside the app. A reader
 * who finds the beta label after signing up has caught us; a reader who
 * reads it here has been told.
 * ------------------------------------------------------------------ */
export const COLOPHON = {
  kicker: "Wired in",
  line: "It reads your calendar while she is still talking and writes the appointment back before she hangs up — Google Calendar, which is the only calendar it books into. The other four run once the call has ended: the email, the row on the sheet, the call report, the transcript filed on your Drive. All five are in beta, and the app says so too.",
} as const;

/**
 * Each tool twice over: its real mark, and a lucide glyph.
 *
 * The `mark` is the vendor's own SVG, which is what belongs on the cover —
 * a monoline phone icon standing in for Google Calendar is a drawing of a
 * category, and the reader is checking for a *specific* logo. The `icon`
 * stays because /product/ai-agents renders this same list at a size and in
 * a tone where a flat brand mark would be the wrong object; it maps the
 * label to its own logo set and uses the glyph as the fallback.
 *
 * Both fields therefore have an owner. Neither is decoration for the other.
 */
export const INTEGRATIONS: { label: string; icon: LucideIcon; mark: string }[] = [
  { label: "Google Calendar", icon: Calendar, mark: "/integrari/google_calendar.svg" },
  { label: "Gmail", icon: Mail, mark: "/integrari/google_mail.svg" },
  { label: "Google Sheets", icon: Table2, mark: "/integrari/google_sheets.svg" },
  { label: "Google Docs", icon: FileText, mark: "/integrari/google_docs.svg" },
  { label: "Google Drive", icon: FolderOpen, mark: "/integrari/google_drive.svg" },
];

/* ------------------------------------------------------------------ *
 * The agent's own settings — register, language, voice.
 *
 * What is left here after the setup-wizard section came out is the part
 * that was never about setup: these are the three decisions that change
 * what a caller hears, and they are real app settings, not a stepper's
 * illustration of one. The header's Product menu reads SETUP_VOICES on
 * every route of the site, so this block outlives any one section that
 * happens to draw it.
 * ------------------------------------------------------------------ */

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
/**
 * The eyebrow carries the argument, so it says whose number it is.
 *
 * "Why it works" was a heading about us. The one thing this section has
 * that no other section on the page has is that none of it is ours, and
 * that is what the eyebrow should spend itself on.
 *
 * The sub states the three measured points outright — 1.00, a quarter of
 * that at ten minutes, a twenty-first of it at thirty, exactly
 * `LEAD_DECAY` — rather than telling the reader to drag a marker for
 * them. A reader who does not drag was being told nothing, and on a phone
 * the drag was competing with the page's own scroll.
 *
 * What the sub now also does is name the conflict of interest in its own
 * source, before the reader finds it in the citations underneath. The
 * lead-response study was run with InsideSales.com, a company selling
 * software that shortens response time: it is measuring the thing it is
 * paid to sell. That does not make the finding wrong and it is the best
 * measurement of its kind anybody has published — but the reader is going
 * to see the name in `WHY_SOURCES` either way, and there are only two
 * ways for them to meet it. This is the cheaper one.
 */
export const STATS_INTRO = {
  eyebrow: "None of it is ours",
  title: "It is decided before the fifth minute is up.",
  sub: "Three measured points from two published studies, and one of those was run with a company that sells lead-response software — it measured the thing it is paid to shorten, and you should read it knowing that. The odds of qualifying a caller hold flat for five minutes, then fall four times over, then twenty-one.",
} as const;

/**
 * The one mark on the plot that is ours, and it is a claim, not a datum.
 *
 * Kept as its own export so it can never be mistaken for a fourth study
 * point: everything else in this section is cited in `WHY_SOURCES`, and
 * this sentence is the product standing at the left-hand edge of somebody
 * else's graph. Phrased in the present tense because that is the whole of
 * the assertion — not faster, not sooner. Here.
 *
 * `it`, not "your agent", to match every other sentence on the page about
 * behaviour. And no figure attached: the mark sits at the flat end of the
 * curve because that is where answering on the first ring puts it, and
 * the moment this line carries a number it becomes a latency claim the
 * product has never measured. It renders into 8.5rem, so it has to be
 * short anyway — which is the right constraint for this sentence.
 */
export const SHELF_CLAIM = "It answers here, on the first ring.";

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

/**
 * The far end of the plot — where the study's measurements stop.
 *
 * There is no matching floor constant. The near end is `LEAD_DECAY[0].at`
 * and has to be read from the data rather than restated beside it: a
 * second copy of the number is a second thing to forget when the baseline
 * window moves, and the one it would silently contradict is the study's.
 */
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
/**
 * The intro concedes the model before the panel draws it.
 *
 * `volume`, `staffed` and `busyMiss` are a stated model of a day, not
 * telemetry, and the panel says so on its own footer. The sub says it too,
 * in the sentence a reader meets first, because a modelled shape presented
 * as a measurement is the one thing that would cost this section its
 * standing — and the shapes hold up perfectly well when you admit what
 * they are. The second half of the concession is the house's own move:
 * point the reader at the evidence they already own. Their handset has the
 * real version of this chart in it.
 */
export const USE_CASES_INTRO = {
  eyebrow: "One day on the line",
  title: "Pick a trade and watch its phone for a day.",
  sub: "Same agent, your trade's vocabulary. Choose a business below and the panel walks one phone line through a day — when it actually rings, what those callers want, and the share nobody hears because both hands are busy. The day is modelled and we say which numbers are ours; the real version is in the missed-call list on the phone in your pocket.",
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
   * There is deliberately no money field here.
   *
   * This type used to carry an expected booked value per recovered call,
   * and the panel multiplied it by the day's missed calls into a dollar
   * figure. Every input to that figure was ours: the conversion rate, the
   * job value, the share that never closes. Stacked next to two counts a
   * reader can sanity-check against their own phone, one invented number
   * is not a bonus — it is the number they will test first, and the two
   * honest ones lose their standing when it fails.
   *
   * The counts stay because they are defensible: `volume`, `staffed` and
   * `busyMiss` are a stated model of a day, and the panel says so. What a
   * recovered call is worth is the reader's own arithmetic, done on their
   * own books, and the page is stronger for leaving the last step to them.
   */
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
  eyebrow: "What arrives in the box",
  title: "They sell the parts. The assembly is the job.",
  sub: "Every platform below is good at what it is for, and what it is for is building. This is what arrives in the box from each of them — and which of the ten layers are still sitting on your desk, waiting for somebody on your side to write them.",
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
/**
 * The words that put the ten layers in front of a reader.
 *
 * It opens on the count rather than on us, because the count is the only
 * surprising thing in the section: nobody who has not built one of these
 * thinks a phone agent has ten parts, and the moment they accept that it
 * does, the split does the rest of the argument on its own. The second
 * sentence names the market honestly — four companies really will sell you
 * those first five layers, and saying so is what buys the right to claim
 * the other five.
 *
 * `title` counts to ten and `sub` splits five and five. Both are checked
 * against `STACK` by eye today; if a layer is ever added or the `group`
 * boundary moves, these two sentences move with it. "The four companies
 * in the table below" is checked the same way, against `RIVALS` minus our
 * own row — four today.
 *
 * The sub ends short on purpose. Long, long, then two words: the second
 * five are not a product anybody withheld from you, they are work, and
 * the sentence that says so should cost nothing to read.
 */
export const ANATOMY_INTRO = {
  kicker: "Ten parts, in order",
  title: "Ten things happen before the caller hears a word.",
  sub: "Five of them are a market: you can buy them from anyone, and the four companies in the table below will sell you exactly those five. The other five are your rules, your prices, your diary and somebody reading the transcripts — and nobody sells those, because they are not a product. They are work.",
} as const;

export type StackLayer = {
  id: string;
  n: string;
  group: "stack" | "business";
  label: string;
  note: string;
};

/**
 * The notes are the layer in one line, and one of them was a figure.
 *
 * Layer 04 read "barge-in, silence, the half-second before it answers".
 * Half a second is a latency claim, and there is no measured latency
 * figure anywhere in this product — not a p50, not a p95, not a
 * time-to-first-audio. The nearest millisecond constant in the codebase is
 * a *degradation threshold*: first audio slower than 1.2s counts as a soft
 * failure against the speech provider's circuit breaker. A prospect who
 * found that would read 1.2 seconds and hold us to half of it.
 *
 * So 04 now describes the mechanism instead, which is the better claim
 * anyway and is genuinely unusual: the turn detector is tuned for phone
 * callers rather than for speed, because people on a phone pause in the
 * middle of a sentence and a system optimised to be quick talks over them.
 *
 * The other rewrites are the same discipline at lower stakes — each note
 * names the concrete thing rather than the category, 08 concedes that the
 * calendar is Google's and no one else's, and 09 drops the email that only
 * exists as a workflow step on a plan most readers will not be on.
 */
export const STACK: StackLayer[] = [
  {
    id: "voice",
    n: "01",
    group: "stack",
    label: "A voice",
    note: "The synthesised speech at the other end of the line",
  },
  {
    id: "hearing",
    n: "02",
    group: "stack",
    label: "Hearing",
    note: "Transcribing a caller live, down a line with a van on it",
  },
  {
    id: "reasoning",
    n: "03",
    group: "stack",
    label: "Reasoning",
    note: "The model choosing the next sentence, and the tool under it",
  },
  {
    id: "turns",
    n: "04",
    group: "stack",
    label: "Turn-taking",
    note: "Knowing she has finished, and stopping when she hasn't",
  },
  {
    id: "number",
    n: "05",
    group: "stack",
    label: "A number that rings",
    note: "A carrier, a number, and the route from the network into it",
  },
  {
    id: "script",
    n: "06",
    group: "business",
    label: "What it says",
    note: "Your greeting, your rules, and who it puts a caller through to",
  },
  {
    id: "knows",
    n: "07",
    group: "business",
    label: "What it knows",
    note: "Your services, your prices, your hours, out of your own documents",
  },
  {
    id: "calendar",
    n: "08",
    group: "business",
    label: "Your calendar",
    note: "Free times read mid-call, the appointment written back into Google Calendar",
  },
  {
    id: "followup",
    n: "09",
    group: "business",
    label: "The follow-up",
    note: "The confirmation text, then the reminder the day before",
  },
  {
    id: "watch",
    n: "10",
    group: "business",
    label: "Someone watching it",
    note: "Transcripts read, the wrong answer found, the instruction rewritten",
  },
];

/**
 * Every row below describes how a product is *sold*, taken from its own
 * public pricing and positioning pages — never how well it works. Which is
 * the only comparison worth putting on a landing page: our opinion of a
 * competitor's quality is worth nothing to a reader, and their own
 * description of who they built it for is worth a great deal.
 *
 * There is no time-to-first-call field any more. The row used to say
 * "engineering days to weeks" against four vendors and "minutes" against
 * us, and not one of those four publishes such a figure anywhere — we had
 * inferred it. Sitting directly above a footer that stakes the table on
 * public sources, one estimated row is enough to make the reader wonder
 * which of the others we also guessed. The bill of materials survives it
 * intact: if five layers are marked "you build it", the reader works out
 * the timeline themselves, and their own arithmetic is not arguable.
 */
export type Rival = {
  id: string;
  name: string;
  kind: string;
  who: string;
  billing: string;
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

/**
 * Ours first, and not out of vanity.
 *
 * The table scrolls sideways on a phone — six columns will never fit 390px
 * — so the last column is the one nobody reaches. Putting the payoff there
 * meant a reader on a phone saw four vendors going dark down the business
 * half and then stopped scrolling, having been shown the problem and none
 * of the answer. First column, and the rest of the row is read against it.
 */
export const RIVALS: Rival[] = [
  {
    id: "ntv",
    name: "Neuro Tech Voice",
    ours: true,
    kind: "A finished agent, for one business",
    who: "The business whose phone is ringing on Monday",
    billing: "A monthly plan with the minutes in it — one line on one invoice",
    parts: {
      voice: "shipped",
      hearing: "shipped",
      reasoning: "shipped",
      turns: "shipped",
      // The one cell we concede. Ten ticks out of ten is a table nobody
      // believes, including the nine that were earned, and this row has to
      // survive a reader looking for the catch.
      //
      // `metered` rather than `build`, because `build` would be a lie in
      // our own favour's opposite direction: its label reads "you build
      // it — your team's prompt, integration and testing", and we do
      // supply the number. What is true is exactly what `metered` says —
      // we run it, and it is billed as its own line rather than bundled
      // into the plan — and the FAQ two sections down says the same thing
      // in words, along with the part that actually stings: porting an
      // existing number in is not supported yet.
      number: "metered",
      script: "shipped",
      knows: "shipped",
      calendar: "shipped",
      followup: "shipped",
      watch: "shipped",
    },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    kind: "Voice and agents platform",
    who: "Teams building conversational AI into their own product",
    billing: "Per minute for the agent — the model and the telephony billed on top",
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
    parts: {
      voice: "shipped",
      hearing: "shipped",
      reasoning: "shipped",
      turns: "shipped",
      number: "metered",
      ...ALL_BUILD,
    },
  },
];

/**
 * The concession in the last-but-one sentence is not a courtesy.
 *
 * One of the four platforms in this table is inside our own product:
 * ElevenLabs is the fallback the call moves to when the primary speech
 * provider fails, and on that path the agent has no tools at all. Printing
 * that in the section whose whole argument is "they sell parts, we ship
 * the assembly" costs something, which is exactly why it earns the rest of
 * the paragraph. A reader who works it out for themselves has caught us
 * comparing ourselves against a supplier without saying so.
 */
export const COMPARISON_NOTE =
  "None of this is a knock on the platforms. Being infrastructure is what they are for, and the first word on their own pricing pages is build. If you are shipping a product, buy the parts — they are very good parts, and one of the four in this table is inside ours, standing by for the day the primary voice fails. If your phone is ringing and there is nobody to pick it up, the assembly is the whole job.";

/**
 * The date here and `PRICING_RIVAL.checked` disagree on purpose. Do not
 * "fix" one to match the other.
 *
 * This line covers four vendors' packaging, all read on the same day — 29
 * July 2026 — and none of them has been re-read since. `PRICING_RIVAL`
 * covers one number, ElevenLabs' per-minute rate, and that one was
 * independently re-verified in September because the pricing section
 * computes live percentages off it and a stale rate there is a false
 * claim about money rather than a stale description.
 *
 * Retyping either date to match the other would be the actual error: the
 * later date would vouch for four vendors nobody has checked since July,
 * and the earlier one would age a figure that is current. A checked-on
 * date is a claim about what somebody did, so it moves only when somebody
 * does it again.
 */
export const COMPARISON_SOURCE =
  "Compiled from each vendor's own public pricing and positioning pages, checked 29 July 2026. Every row describes how a product is sold, not how well it performs. Vendors change their packaging often — if something here has gone out of date, tell us and we will correct it.";

/* ------------------------------------------------------------------ *
 * Pricing — the arithmetic on the invoice, not a marketing rate.
 *
 * Every plan is a fee plus an allowance of minutes plus a rate for the
 * minutes past it, which means the only honest answer to "what does this
 * cost" is a function of call volume, not a number on a card. The section
 * draws that function for every plan at once.
 *
 * Which is also how the price list gets audited. Run the arithmetic across
 * the range and the plans have to actually order themselves — if a rung's
 * overage rate undercuts its own effective per-minute rate, everyone below
 * it is cheaper at every volume and the rung is dead weight. Numbers here
 * are the business's to set; the section only refuses to hide them.
 * ------------------------------------------------------------------ */
/**
 * "One agent" is in the sub because it is a limit, not a feature.
 *
 * A business gets exactly one voice agent on every plan — there is no
 * mechanism anywhere in the product to create a second, so "an agent per
 * location" and "one for sales, one for support" are sentences nobody
 * here can honour. Stated as a limit it also does the work the old "no
 * seats" clause was doing, and it does it without sounding like a
 * concession we were pleased to make.
 */
export const PRICING_INTRO = {
  eyebrow: "What it costs you",
  title: "Say how busy your phone is and the bill does itself.",
  sub: "You buy minutes. There is no seat to add, no per-agent fee and nothing extra for an integration — and no second agent to buy either, because a business gets one and it is the same one on every plan. Say roughly how many calls come in on a normal day; the whole bill is on the screen before you sign anything.",
  annualNote: "Two months free",
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

/**
 * The rungs, ascending by minutes.
 *
 * Two invariants hold this list together, and both are checked by the
 * sections that render it rather than by a comment:
 *
 *  · **A rung's overage rate sits above its own effective rate.** Fee over
 *    allowance is what a minute costs inside the plan; the overage has to
 *    cost more, or the rung below is cheaper at every volume and this one
 *    is dead weight. The receipt in `pricing.tsx` surfaces the gap the
 *    moment it opens.
 *  · **Every rung owns a band of volumes where it is genuinely cheapest.**
 *    The handovers land at roughly 1,464 · 3,958 · 8,667 · 18,927 minutes
 *    a month — each one inside the next rung's allowance, so the plan a
 *    customer is pushed onto is always one that actually covers them.
 *
 * The effective rate falls as the rungs climb: 6.5¢ · 6.0¢ · 5.5¢ · 5.0¢ ·
 * 4.5¢. That slope is the offer. A flat rate — which is what the voice
 * platforms charge, `PRICING_RIVAL` — gives a high-volume customer no
 * reason to grow on your invoice instead of someone else's.
 */
export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 49,
    minutes: 750,
    overage: 0.07,
    unlocks: ["Basic analytics", "Email support"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 99,
    minutes: 1650,
    overage: 0.065,
    unlocks: ["Call recordings", "Google integrations"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 249,
    minutes: 4500,
    overage: 0.06,
    unlocks: ["Advanced analytics", "Priority support"],
    cta: "Start free",
    href: AUTH.signup,
    featured: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 499,
    minutes: 10000,
    overage: 0.055,
    unlocks: ["Full analytics suite", "Every integration, not only Google"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "scale",
    name: "Scale",
    monthly: 990,
    minutes: 22000,
    overage: 0.05,
    unlocks: ["Concurrency for a full call room", "Priority onboarding"],
    cta: "Start free",
    href: AUTH.signup,
  },
  {
    id: "custom",
    name: "Custom",
    monthly: 1990,
    minutes: 50000,
    overage: 0.04,
    from: true,
    unlocks: ["Custom prompts and a written SLA", "A named contact"],
    cta: "Talk to us",
    href: AUTH.contactSales,
  },
];

/**
 * The invoice, as one function, so two sections cannot disagree about it.
 *
 * This lived inside `pricing.tsx` while the bill was the only thing that
 * quoted a price. The close now quotes one too — "a day, at ten calls a
 * day, everything included" — and a second implementation of the same
 * arithmetic a thousand lines away is a guarantee that one day the two
 * numbers differ on the same screen, with no way for a reader to tell
 * which is the real one. One function, both call sites, moved verbatim.
 *
 * It is deliberately a function and not a table of prices: a plan is a fee
 * plus an allowance plus a rate past it, so what a customer pays is a
 * function of their call volume and there is no honest single number to
 * put on a card.
 */

/** Two months off the plan fee, per `PRICING_INTRO.annualNote`. */
const ANNUAL = 10 / 12;

export const feeFor = (t: Tier, annual: boolean) =>
  annual ? t.monthly * ANNUAL : t.monthly;

/** The invoice: the fee, plus this plan's own rate past its allowance. */
export const costFor = (t: Tier, minutes: number, annual: boolean) =>
  feeFor(t, annual) + Math.max(0, minutes - t.minutes) * t.overage;

/**
 * The rate the comparison is made against.
 *
 * Only two claims get made from this, and both are checkable. The first is
 * a rate: the voice platforms bill one flat figure per minute at every
 * rung, so "this plan is N% under it" is arithmetic, not positioning. The
 * second is `matched` — the rungs where their sticker price is identical
 * to one of ours, where the comparison can be minutes against minutes with
 * nothing interpolated.
 *
 * What is deliberately NOT here is a minute count for our other rungs.
 * They publish no $49 and no $249 plan; dividing their rate into our fee
 * would invent a plan they do not sell and put words in a competitor's
 * mouth. The rate comparison already carries that rung, honestly.
 */
export const PRICING_RIVAL = {
  name: "ElevenLabs",
  /** Their Agents platform, every rung from Free to Business. */
  perMinute: 0.08,
  href: "https://elevenlabs.io/pricing/agents",
  checked: "September 2026",
  /** Their published plans that cost exactly what one of ours costs. */
  matched: [
    { monthly: 99, theirs: 1238, theirPlan: "Pro" },
    { monthly: 990, theirs: 12375, theirPlan: "Business" },
  ],
} as const;

export const PRICING_PLANS_INTRO = {
  eyebrow: "The rungs",
  title: "The rate falls as the plan climbs.",
  sub: "Every plan is a fee, an allowance of minutes, and a published rate for the minutes past it. The rate a minute actually costs falls at every rung — which is the one thing a single flat per-minute price cannot do for a business that grows.",
} as const;

/**
 * The note ends by inviting the correction, and it means it.
 *
 * Every figure on the other side of this comparison is a competitor's
 * own published one, read on a stated day, and competitors reprice
 * without telling us. A comparison that does not say when it was read is
 * a comparison the reader is asked to take on trust; one that does, and
 * asks to be told when it goes stale, is the same claim with the risk
 * moved onto us where it belongs.
 */
export const PRICING_PLANS_NOTE =
  `Prices are in US dollars and exclude VAT. Annual billing takes two months off the plan fee; the rate for the minutes past the allowance does not move. The ${PRICING_RIVAL.name} figures are their own published ${PRICING_RIVAL.name} Agents plans, read ${PRICING_RIVAL.checked} — they bill one flat rate at every rung, which is why the per-minute comparison holds all the way down this list while the minute-for-minute one is made only at the two prices where a plan of theirs costs exactly what a plan of ours costs. On yearly, the two months come off both sides before the comparison, so the gap is the one the monthly prices already show; the two cards above compare monthly list prices. They reprice often. If something here has gone out of date, tell us and we will correct it.`;

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

/**
 * OWNER: the hero and this block describe the same trial differently, and
 * only one of them matches the backend. Somebody has to choose.
 *
 * `HERO.note` and the old `CTA_CLOSE.note` both said "5 free minutes every
 * month" — a recurring monthly allowance. What the code grants is five
 * minutes once, inside a fourteen-day window, never renewed: the plan is
 * literally excluded from the renewal job that rolls everyone else's
 * minutes over. When those five are gone the agent stops answering, because
 * the trial is the one plan that cannot run into overage.
 *
 * Every other page on this site already says the correct thing — the
 * product pages, the industry pages, the register page. The hero is frozen
 * copy this pass, so the fix is not available here; what is available is
 * refusing to repeat the wrong version. This block and the close now say
 * "five minutes, fourteen days", which is true, and neither says "every
 * month" or "once and never again", so neither stands on the same screen
 * calling the hero a liar. That is a truce, not a resolution. The hero
 * still needs changing, and it is the owner's line to change.
 *
 * The body carries the concession the old one buried. "Point a number at
 * it" was not true without a card: a number is its own Stripe purchase, so
 * a card-free trial cannot receive a single outside call. What it *can* do
 * is answer you — test calls are real calls on the real agent and they are
 * never billed against the five minutes, which is a better sentence anyway
 * because it is the thing a cautious buyer actually wants to do first.
 *
 * `cta` stays "Start free" deliberately. It is the same button as the
 * hero's, the close's and every rung in `TIERS`, and a page that calls one
 * button four things has a copy problem, not a variety of them.
 */
export const PRICING_TRIAL = {
  headline: "Five free minutes, fourteen days, and no card.",
  body: "Set it up, give it your documents and ring it yourself — test calls run on the real agent and never touch the five minutes. What the free fortnight cannot give you is a line: a number is bought separately, so until you buy one it answers you and nobody else.",
  cta: "Start free",
  href: AUTH.signup,
} as const;

/**
 * The rounding sentence is new and it is against us.
 *
 * Usage is recorded as `ceil(seconds / 60)`, per call — a ninety-second
 * call is billed as two minutes and a call that rings off after twenty
 * seconds is billed as one. The receipt above assumes a four-minute call,
 * so the rounding does not move its arithmetic; it moves a real invoice,
 * for a business whose calls are short. A reader who finds that on their
 * first bill instead of on this page has been handled rather than told.
 */
export const PRICING_NOTE =
  "Prices are in US dollars and exclude VAT. Two assumptions sit on the receipt above so you can argue with them: a call runs about four minutes, and the agent answers every day of the month, weekends included. A third is not an assumption — minutes are rounded up on each call, so ninety seconds costs two. Everything else is the plan fee plus that plan's own rate for the minutes past its allowance, which is the arithmetic that lands on the invoice rather than a headline rate. Annual billing takes two months off the fee; the per-minute rate does not move.";

/* ------------------------------------------------------------------ *
 * FAQ — five doubts, flat, in the order they arrive.
 *
 * The previous version sorted seven questions into three named stages and
 * asked the reader to find their own. That was a good model of how doubt
 * actually arrives and a poor piece of furniture: three headings, three
 * sub-notes and seven rows is twelve things to read before the first
 * answer, at the point on the page where the reader is closest to leaving.
 *
 * Five, flat, and every one of them a reason somebody has actually walked
 * away — it fails and nobody notices; it says something wrong; the
 * recordings; the number; the bill. Two of the old seven were removed
 * rather than shortened, because "can I cancel" and "is there a setup fee"
 * are answered in the pricing note a screen above and an FAQ that repeats
 * the page is an FAQ nobody reads.
 *
 * The house rule here is that a concession is the answer, not a caveat at
 * the end of one. Every item below leads with what the product does *not*
 * do, where it does not do it.
 * ------------------------------------------------------------------ */
export const FAQ_INTRO = {
  eyebrow: "What stops people",
  // No sub. The old one explained the grouping, and there is no grouping
  // left to explain; a sentence here would only delay five answers that
  // are already short.
  title: "Five doubts, in the order they arrive.",
} as const;

/**
 * `where` is optional and rare on purpose.
 *
 * Two of the five answers end somewhere the reader can actually do the
 * thing — set the register, work out the bill — and a link there is worth
 * more than another sentence. The other three have nowhere honest to send
 * anybody, so they do not pretend to.
 */
export const FAQ: { q: string; a: string; where?: { label: string; href: string } }[] = [
  {
    // First, because it is the fear under all the others: not that the
    // agent is bad, but that it fails silently and the business finds out
    // from a customer who never came back.
    //
    // The sentence that came out of this answer claimed the person picking
    // up "is not starting from the beginning". They are. It is a blind
    // transfer: a `<Dial>` to a saved number, no whisper, no briefing,
    // nothing handed to the colleague but a ringing phone. The transcript
    // exists, in the dashboard, afterwards — which is not the same thing
    // and is the exact gap a reader would discover on their first live
    // hand-over. Twenty-five seconds is the real ring timeout.
    q: "What happens when it can't handle the call?",
    a: "It puts the caller through to a person, and only to a person you listed. You name who can take a live transfer and write the conditions in your own words — a complaint, anything about an invoice, a caller who simply asks for somebody — and when one is met it says who it is connecting them to before it dials. What it does not do is brief them. This is a straight transfer, so your colleague picks up cold and reads the transcript afterwards rather than hearing it first. If nobody answers inside twenty-five seconds the caller is told so, and the message goes to the team rather than the line going quiet.",
  },
  {
    // Two mechanisms, both real, both unusual, and both chosen because
    // they answer the question with something checkable instead of a
    // promise to try hard. The last sentence is the concession: an agent
    // that does not learn from its calls is the thing a reader assumes it
    // does, and finding out later feels like a discovery.
    q: "What if it gets something wrong?",
    a: "You find out the same day, not at the end of the month. Every call is transcribed, and the summary is not allowed to flatter itself: it may only say an appointment was booked, moved or cancelled, or that a call was transferred, if the tool that does it actually succeeded — the model's account of the call is overruled by what happened. If a caller talks over it, the transcript and the agent's own memory are cut back to the words she actually heard, which is where most phone agents start remembering sentences nobody was read. Corrections go into its instructions and take effect on the next call. It does not learn from calls on its own, and we would rather tell you that than let you find out.",
    where: { label: "Set its register yourself", href: "#how" },
  },
  {
    q: "Where do the recordings and transcripts live?",
    // Scoped hard to storage. The speech and telephony vendors this runs
    // on are not necessarily EU-hosted and this page must not imply the
    // whole pipeline is — "your data stays in Europe" is the single
    // easiest sentence to write here and the one we cannot stand behind.
    //
    // The deletion sentence is the strongest fact in this answer and it
    // was missing: a delete removes the voice provider's copies first and
    // aborts the whole operation if it cannot, so nothing is ever marked
    // deleted here while a transcript is still sitting at a vendor.
    a: "Transcripts and recordings sit in the EU — the database and the file storage are both in Ireland, eu-west-1. That covers where the call is kept and not every hop it takes: the speech and telephony providers it passes through are their own companies in their own regions, and we are not going to tell you otherwise. A deletion goes to those providers first and stops if it cannot remove their copy, so nothing is marked deleted here while a transcript is still sitting at a vendor. Recordings are a plan entitlement rather than a switch — off on the trial and on Starter, on from Pro upward — while transcripts are kept on every plan.",
  },
  {
    q: "Do I need a new phone number?",
    // The first sentence of the old answer was already the honest one and
    // is kept in substance. What is added are the two facts a reader finds
    // out at checkout otherwise: what a number costs, and that the list of
    // countries it can be bought in does not include the one this company
    // is registered in. Romanian numbers need a regulatory bundle nobody
    // has filed, and a Romanian reader will hit that wall in the dashboard
    // if they do not hit it here.
    a: "A new one. You buy a local number inside your dashboard in seconds, on its own monthly subscription at $1.15 — the carrier's own cost, passed through with nothing on top — and you release it whenever you like to stop the charge. Two things go with that and neither is in our favour: porting your existing number in is not supported yet, so today this sits alongside your current line rather than replacing it, and the twenty-one countries you can buy a number in do not include Romania, because Romanian numbers need a regulatory bundle we have not done.",
  },
  {
    // The rate is interpolated from TIERS rather than typed, because the
    // sentence it replaced quoted "$0.25 down to $0.18" long after the
    // price list had moved to 7¢ and 4¢. A number written by hand in an
    // answer is a number that will be wrong by the next price change.
    //
    // "Nothing stops answering" was true of every plan and false of the
    // free trial, which is the one plan the person reading this is on. The
    // trial cannot run into overage at all: the five minutes go, and the
    // agent stops taking calls. That belonged in the answer, not in a
    // support ticket.
    q: "What happens if I go over my included minutes?",
    a: `On a paid plan, nothing stops answering. The extra minutes bill at your own plan's published rate — ${Math.round(
      TIERS[0].overage * 100,
    )}¢ a minute on the entry plan, falling to ${Math.round(
      TIERS[TIERS.length - 1].overage * 100,
    )}¢ on the largest — and you can change plan at any point; the calculator above says when that is actually cheaper rather than leaving you to work it out off an invoice. The free trial is the other way round, and this is the part worth reading twice: there is no overage on it, so when the five minutes are gone the agent stops answering and your callers hear that the call can't be taken.`,
    where: { label: "Work out the bill", href: "#your-bill" },
  },
];

/* ------------------------------------------------------------------ *
 * The close.
 *
 * Every figure here was earned somewhere higher up the page, and this
 * block deliberately contains none of them. The labels are here; the
 * numbers are computed in the component from the same constants the
 * sections above drew — CALL_FATE, LEAD_DECAY, SETUP_LANGS, costFor — so
 * the close cannot quote a page that has since changed under it. It had
 * already happened once: the old receipts carried a hand-typed "$10 a
 * day" from a price list that no longer existed, in the one section whose
 * entire job is to be checkable.
 *
 * `where` is an anchor rather than a section name, because a receipt the
 * reader cannot get back to is not a receipt.
 * ------------------------------------------------------------------ */
export const CTA_CLOSE = {
  // Three words, and the page's own. "Nobody to pick it up" is the
  // sentence the comparison note ends on eight sections above; the close
  // is that sentence with the reader as the subject. Everything before
  // this point has been the argument, and a close that restates it is a
  // close that reopens it.
  title: "Pick it up.",
  // No sub. The line that was here — "everything below is on this page
  // above" — was the page talking about its own construction, which is a
  // thing the writer finds interesting and the reader does not.
  receipts: [
    /*
     * "Never reach a person", not "ring out".
     *
     * The figure this carries is voicemail plus rang-out — everything
     * except the 37.8% a human picks up. It read "ring out unanswered",
     * which names only the smaller bucket and put 62% under a label the
     * shelf section had already priced at 24.3% eight sections earlier.
     * A page that contradicts itself on its own headline number loses
     * more than the difference between the two.
     */
    { label: "of calls to a small business never reach a person", where: "#why" },
    { label: "is how long the odds hold flat before they fall", where: "#why" },
    {
      label: "languages the greeting is written in by people who speak them",
      where: "#how",
    },
    { label: "a day, at ten calls a day, with everything in it", where: "#your-bill" },
  ],
  primary: "Start free",
  secondary: "Talk to a person",
  // This used to be the hero's offer word for word, on the reasoning that
  // two descriptions of one trial eleven sections apart is how a reader
  // decides neither is reliable. The reasoning was right and the offer it
  // copied was wrong: the backend grants five minutes inside a fourteen-day
  // window, not five a month, and every other page on this site already
  // says so. Copying a mistake for the sake of consistency makes it a
  // policy. This line now matches the product pages, the industry pages
  // and PRICING_TRIAL — which leaves exactly one sentence on the site still
  // saying "every month", and it is in the frozen hero. See the note above
  // PRICING_TRIAL: that one is the owner's to settle.
  note: "5 free minutes for 14 days · no card · cancel whenever",
} as const;

/* ------------------------------------------------------------------ *
 * Site header — the bar, its two mega menus, and the sheet below lg.
 *
 * Last in the file on purpose: NAV_INDUSTRIES reads INDUSTRIES and the
 * Product menu's footer reads TIERS, both at module load, and a const
 * referenced before its initialiser is a crash at import time rather
 * than a bug at render time.
 * ------------------------------------------------------------------ */

export type HeaderNavEntry =
  | { kind: "menu"; id: "product" | "solutions"; label: string }
  | { kind: "link"; id: string; label: string; href: string };

export const HEADER_NAV: HeaderNavEntry[] = [
  { kind: "menu", id: "product", label: "Product" },
  { kind: "menu", id: "solutions", label: "Solutions" },
  { kind: "link", id: "pricing", label: "Pricing", href: "/#pricing" },
  { kind: "link", id: "case-studies", label: "Case Studies", href: "/case-studies" },
  { kind: "link", id: "contact", label: "Contact", href: "/contact" },
];

export const SITE_HEADER = {
  navLabel: "Main",
  skip: "Skip to content",
  menu: { open: "Menu", close: "Close" },
  signin: { label: "Sign in", href: AUTH.signin },
  signup: { label: "Start free", href: AUTH.signup },
  headings: {
    agents: "Agents",
    voice: "Voice",
    industries: "Industries",
    solutions: "Custom builds",
  },
  preview: { callerTag: "Caller", agentTag: "Agent" },
} as const;

/** A card in a mega-menu column. */
export type NavItem = {
  id: string;
  label: string;
  /**
   * One line. It must never wrap, and the column truncates rather than
   * rewraps, so this is a hard budget: ≤ 40 chars in Product, ≤ 58 in
   * Solutions — measured against the narrower Product column, not against
   * the popup.
   */
  description: string;
  icon: LucideIcon;
  href: string;
};

/** How the Product preview reads the call while a row is under the pointer. */
export type NavLens = "industry" | "call" | "voices" | "transcribe";

/** A moment on a call, in the live demo's own turn format. */
export type CallMoment = {
  /** Kicker text; upper-cased at render. */
  context: string;
  turns: DemoTurn[];
  outcome: string;
  /** When set, the kicker is composed from this SETUP_VOICES entry instead. */
  voiceId?: string;
};

export type ProductItem = NavItem & { lens: NavLens; moment?: CallMoment };

export type NavGroup = { id: "agents" | "voice"; label: string; items: ProductItem[] };

export const PRODUCT_GROUPS: NavGroup[] = [
  {
    id: "agents",
    label: SITE_HEADER.headings.agents,
    items: [
      {
        id: "ai-agents",
        label: "AI Agents",
        description: "Answers, qualifies, books the job.",
        icon: Bot,
        href: "/product/ai-agents",
        lens: "industry",
      },
      {
        id: "knowledge-base",
        label: "Knowledge Base",
        description: "Answers from your prices and policies.",
        icon: BookOpenText,
        href: "/product/knowledge-base",
        lens: "call",
        moment: {
          context: "Answered from your documents",
          turns: [
            { sp: "client", t: "If I cancel the day before, do I still pay?" },
            {
              sp: "agent",
              t: "Cancellations inside 24 hours are charged at half — but I can move you to Thursday at no cost.",
            },
          ],
          outcome: "Source · Cancellation policy, §2",
        },
      },
      {
        id: "integrations",
        label: "Integrations",
        // Workflows run once a call has ended (post-call webhooks only), and
        // today they reach webhooks and Slack; Google Workspace is still in
        // development. The preview says only that.
        description: "Passes every call on to your tools.",
        icon: Blocks,
        href: "/product/integrations",
        lens: "call",
        moment: {
          context: "Passed on when the call ends",
          turns: [
            { sp: "client", t: "Water's coming through the ceiling — is this the emergency line?" },
            {
              sp: "agent",
              t: "It is. I have your address, and I'm marking this as an emergency for the on-call team.",
            },
          ],
          outcome: "Keyword “emergency” · #on-call · message posted",
        },
      },
    ],
  },
  {
    id: "voice",
    label: SITE_HEADER.headings.voice,
    items: [
      {
        id: "voice-library",
        label: "Voice Library",
        description: "Pick a voice by accent and pace.",
        icon: LibraryBig,
        href: "/product/voice-library",
        lens: "voices",
        moment: { context: "Voice library", turns: [], outcome: "" },
      },
      {
        id: "voice-cloning",
        label: "Voice Cloning",
        description: "Your own voice, from one recording.",
        icon: MicVocal,
        href: "/product/voice-cloning",
        lens: "call",
        moment: {
          context: "Your cloned voice · outbound reminder",
          turns: [
            {
              sp: "agent",
              // Discloses itself on purpose: an agent that calls a person
              // says what it is, here and in the product.
              t: "Hi, this is the virtual assistant at Northside Dental, confirming your cleaning tomorrow at nine.",
            },
            { sp: "client", t: "Yes, that still works." },
          ],
          outcome: "Reminder delivered · appointment confirmed",
        },
      },
      {
        id: "text-to-speech",
        label: "Text to Speech",
        description: "Turn any script into lifelike speech.",
        icon: Speech,
        href: "/product/text-to-speech",
        lens: "call",
        moment: {
          context: "Text to speech",
          voiceId: "sarah",
          turns: [
            { sp: "agent", t: "Your table for six is confirmed for Friday at 8:45." },
          ],
          // No synthesis-latency number: the product has never published
          // one, and a figure a prospect can quote back is not worth the
          // half-second it buys in a menu.
          outcome: "Streamed to the call as it is written",
        },
      },
      {
        id: "speech-to-text",
        label: "Speech to Text",
        description: "Live transcripts, even on a noisy line.",
        icon: Captions,
        href: "/product/speech-to-text",
        lens: "transcribe",
        // The turns are read from a real trade's own words; these are the
        // two lines around them.
        moment: {
          context: "Transcribed as the caller speaks",
          turns: [],
          outcome: "Live transcript · every call, searchable",
        },
      },
    ],
  },
];

/** One row of the industries picker. `caller`/`agent`/`outcome` drive the preview. */
export type NavIndustry = {
  slug: string;
  label: string;
  icon: LucideIcon;
  /** ≤ 90 chars: it clamps to three lines and the pane never resizes. */
  caller: string;
  /** ≤ 120 chars, same reason. */
  agent: string;
  outcome: string;
};

/**
 * Reuses a trade's own words from INDUSTRIES so the header and the
 * "Who it's for" panel cannot drift apart. Throws at import time if an id
 * is renamed — a loud failure beats a silently empty preview.
 */
function fromUseCase(id: string, slug: string): NavIndustry {
  const i = INDUSTRIES.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown industry id: ${id}`);
  return {
    slug,
    label: i.label,
    icon: i.icon,
    caller: i.caller,
    agent: i.agent,
    outcome: i.outcome,
  };
}

/**
 * Sixteen trades, fifteen of them outside healthcare, and healthcare last
 * in reading order — the product is industry-agnostic and the list has to
 * say so before the any-industry field underneath it does.
 */
export const NAV_INDUSTRIES: NavIndustry[] = [
  fromUseCase("trades", "home-services"),
  fromUseCase("realestate", "real-estate"),
  fromUseCase("restaurants", "restaurants"),
  fromUseCase("law", "law-firms"),
  fromUseCase("auto", "automotive"),
  fromUseCase("logistics", "logistics"),
  fromUseCase("salons", "salons-spas"),
  {
    slug: "veterinary",
    label: "Veterinary",
    icon: PawPrint,
    caller: "My dog ate something off the counter and he's being sick.",
    agent:
      "Please bring him straight in — I've told the vet you're on your way. Do you know what he ate?",
    outcome: "Urgent visit flagged · vet notified",
  },
  {
    slug: "insurance",
    label: "Insurance",
    icon: ShieldCheck,
    caller: "Someone reversed into my car this morning. How do I start a claim?",
    agent:
      "Is everyone okay? I'll take your policy number and the other driver's details, and get them to a handler now.",
    outcome: "Details taken · claims handler told",
  },
  {
    slug: "property-management",
    label: "Property management",
    icon: KeyRound,
    caller: "There's water coming through my ceiling from the flat upstairs.",
    agent:
      "Can you reach the stopcock? I'm taking this down as urgent and telling the on-call team while we speak.",
    outcome: "Details taken · on-call maintenance told",
  },
  {
    slug: "hospitality",
    label: "Hotels & hospitality",
    icon: Hotel,
    caller: "Do you have a double free this Saturday night?",
    agent:
      "I do — a double with breakfast, or a courtyard room for twenty more. Shall I hold one for you?",
    outcome: "Room held · Sat, 1 night",
  },
  {
    slug: "financial-services",
    label: "Financial services",
    icon: Landmark,
    caller: "I'd like to talk to someone about refinancing before rates move again.",
    agent:
      "Of course. I can book you with an advisor Thursday at ten or Friday at two — which suits you?",
    outcome: "Advisor call booked · Thursday 10:00",
  },
  {
    slug: "retail",
    label: "Retail & e-commerce",
    icon: ShoppingBag,
    caller: "My order says delivered, but it isn't here.",
    agent:
      "I'll take the order number and text you the returns link — then someone here picks it up, rather than you queueing again.",
    outcome: "Order found · returns link texted",
  },
  {
    slug: "education",
    label: "Schools & tutoring",
    icon: GraduationCap,
    caller: "Do you still have places on the autumn maths course?",
    agent:
      "We do — three left in the Tuesday evening group. Can I take your child's name and school year?",
    outcome: "Place held · enrolment link texted",
  },
  {
    slug: "fitness",
    label: "Gyms & studios",
    icon: Dumbbell,
    caller: "Is there space in the six o'clock spin class tomorrow?",
    agent:
      "Two spots left. I've put you in one and texted the confirmation — shall I add Thursday as well?",
    outcome: "Class booked · confirmation sent",
  },
  fromUseCase("clinics", "clinics-dental"),
];

export const NAV_INDUSTRY_DEFAULT = "home-services";

export const NAV_ANY_INDUSTRY = {
  note: "Same agent, your vocabulary",
  fieldLabel: "Your industry",
  formLabel: "See the agent for your industry",
  placeholder: "Not listed? Type your industry",
  submit: "See it",
  submitLabel: (label: string) => `See it for ${label}`,
  action: "/industries",
  param: "trade",
  minLength: 2,
  maxLength: 40,
} as const;

export const PRODUCT_MENU = {
  autoplayMs: 3200,
  hoverIntentMs: 70,
  // "Sample", not "Live": the same call shapes are disclosed as modelled
  // in the "Who it's for" section, and a pulsing dot over the word "live"
  // in the nav would undercut the one section that was careful about it.
  liveKicker: (label: string) => `Sample call · ${label}`,
  seeItFor: (label: string) => `See it for ${label}`,
  demo: { label: "Hear the agent take a real call", href: "/#demo" },
  // Read off the price list, so the menu can never quote a plan that moved.
  price: { label: (monthly: number) => `Plans from $${monthly} a month`, href: "/#pricing" },
} as const;

export type SolutionItem = NavItem & {
  promise: string;
  deliverables: [string, string, string];
  stack: [string, string, string, string];
};

export const SOLUTION_ITEMS: SolutionItem[] = [
  {
    id: "custom-ai-agents",
    label: "Custom AI Agents",
    description: "Agents built on your scripts, data and systems.",
    icon: BrainCircuit,
    href: "/solutions/custom-ai-agents",
    promise: "A voice agent built on how your business actually answers the phone.",
    deliverables: [
      "Call flows written with your team",
      "Joined to your systems, with the receiving end built for you",
      "Tested on real phone calls before launch",
    ],
    stack: ["Voice", "Model", "Telephony", "Your systems"],
  },
  {
    id: "custom-saas-platforms",
    label: "Custom SaaS Platforms",
    description: "Your product idea, built into software customers pay for.",
    icon: PanelsTopLeft,
    href: "/solutions/custom-saas-platforms",
    promise: "A production platform, from first prototype to paying customers.",
    deliverables: [
      "A clickable prototype before any code",
      "Accounts, billing and admin built in",
      "Hosted, monitored, code handed over",
    ],
    stack: ["Web app", "Database", "Payments", "Hosting"],
  },
  {
    id: "custom-automations",
    label: "Custom Automations",
    description: "The manual work between your tools, done by software.",
    icon: Workflow,
    href: "/solutions/custom-automations",
    promise:
      "Every copy-paste between your tools, replaced by a workflow that runs itself.",
    deliverables: [
      "A map of the manual steps worth automating",
      "Workflows across inbox, sheets, CRM and APIs",
      "Alerts the moment something needs a person",
    ],
    stack: ["Inbox", "Spreadsheets", "CRM", "Webhooks"],
  },
  {
    id: "custom-mobile-applications",
    label: "Custom Mobile Applications",
    description: "iOS and Android apps, designed, built and published.",
    icon: Smartphone,
    href: "/solutions/custom-mobile-applications",
    promise: "An app your customers keep on their home screen.",
    deliverables: [
      "Designed for iOS and Android",
      "Sign-in, payments and push built in",
      "Published to both app stores",
    ],
    stack: ["iOS", "Android", "Push", "Payments"],
  },
  {
    id: "crm-erp",
    label: "Custom CRM & ERP",
    description: "One system for customers, orders and operations.",
    icon: Database,
    href: "/solutions/crm-erp",
    promise: "A CRM or ERP shaped around your process, not the other way round.",
    deliverables: [
      "Pipeline, stock and invoicing in one place",
      "Migrated off spreadsheets and legacy tools",
      "Every agent call logged against the customer",
    ],
    stack: ["Sales", "Inventory", "Invoicing", "Reporting"],
  },
];

export const SOLUTIONS_MENU = {
  sheetKicker: (label: string) => `What you get · ${label}`,
  // A build starts with a phone call, and /contact does not exist: the
  // action rings us. The id argument is kept so the panel's call site
  // (href(active.id)) compiles unchanged.
  cta: {
    label: "Call us about a build",
    href: (_id: string) => COMPANY.phoneHref,
  },
  footer: {
    text: "Not sure what you need?",
    link: { label: "Call us", href: COMPANY.phoneHref },
  },
} as const;


/* ------------------------------------------------------------------ *
 * Footer — the site's map, not its tagline.
 *
 * Last in the file, and for the same reason the header block is: this
 * reads PRODUCT_GROUPS, NAV_INDUSTRIES and SOLUTION_ITEMS at module load,
 * and a const referenced before its initialiser is a crash at import time
 * rather than a bug at render.
 *
 * It had to change shape. One imprint closes twenty-one marketing routes —
 * every /product/*, /solutions/* and /industries/* page reaches it through
 * ProductShell — and it linked onward to exactly none of them. A reader
 * who landed on /industries/veterinary from a search result could see the
 * header's menus, and below the fold the site simply ended. Every one of
 * those pages was a leaf.
 *
 * So the columns are generated from the same three constants the header's
 * menus are built from, rather than hand-listed. Hand-listing them would
 * mean a sixteenth industry page shipping with fifteen links under it, and
 * the one thing worse than a footer that goes nowhere is a footer that
 * goes to some places.
 *
 * `tagline` is gone. It said the product answers, qualifies and books
 * round the clock — which is the hero's sentence, restated in grey at 50%
 * opacity after the reader has already decided. A footer's job here is
 * navigation and the imprint.
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Solutions — the second business, which the homepage never mentioned.
 *
 * The agent is a product you buy. The five entries in `SOLUTION_ITEMS`
 * are work you commission, and until now a visitor met them only by
 * opening the mega menu. That is the wrong way round: a company that can
 * build you a CRM is more credible selling you a phone agent, not less,
 * and the agent is the cheapest possible proof that the building is real.
 *
 * The band states that relationship rather than listing services — each
 * item already carries its own `promise`, `deliverables` and `stack`, and
 * the section reads them.
 *
 * One live destination on purpose. Four of the five solution pages do not
 * exist yet; linking a reader into a 404 from a section whose entire job
 * is to look like we know what we are doing would cost more than the
 * section earns. The rest are named, not linked, until they are written.
 * ------------------------------------------------------------------ */
export const SOLUTIONS_INTRO = {
  kicker: "The other half",
  title: "The phone agent is the small end of it.",
  // No price and no timeline, matching the page this links to, which says
  // in its own words that both depend on what your calls need and both go
  // in the quote. A figure invented here would be the first thing the
  // custom page has to walk back.
  sub: "Same team, same stack, and the same people who pick up the phone when it breaks. If what you need is a system rather than an agent, it is the same conversation — and there is no price on this band, because what one costs depends on what your calls turn out to need.",
  cta: "How a custom one gets built",
  href: "/solutions/custom-ai-agents",
} as const;

/* ------------------------------------------------------------------ *
 * Industries — the index, not the instrument.
 *
 * The day panel already models one trade hour by hour, and that is the
 * argument. This is the door list. It exists because the instrument can
 * only hold eight trades, and a reader who does not find their own in it
 * concludes the product was not built for them — which is the one
 * objection no amount of craft further down the page can answer.
 *
 * Every entry here resolves: `/industries/[slug]` is generated for all
 * sixteen, and `/industries` lists them.
 * ------------------------------------------------------------------ */
/**
 * The title counts, and the count is `NAV_INDUSTRIES.length` — sixteen
 * today, every one of them resolving to a written page. Checked by eye
 * here rather than interpolated, because the sentence reads better with
 * the word than the numeral and a hard-coded count in a title is the kind
 * of thing that survives a seventeenth trade being added. If one is, this
 * line moves with it.
 *
 * `all` deliberately carries no number, so the link cannot drift even if
 * this sentence does.
 */
export const INDUSTRIES_GATEWAY = {
  kicker: "Yours, written out",
  title: "Sixteen trades, and the script is different in every one.",
  sub: "What it asks first, how it asks it and what it does with the answer are not the same for a law firm as for a dental clinic — one stops asking the moment it has the names and the date, the other stops booking the moment anyone says pain. Pick yours and read the one written for it.",
  all: "Every one of them",
  href: "/industries",
} as const;

/* ------------------------------------------------------------------ *
 * Trust — the four facts a buyer checks before they put their phone
 * number into something.
 *
 * Every one of these is verifiable in this repository, and the section
 * that renders them derives its counts rather than restating them, so a
 * language added to `SETUP_LANGS` or a trade added to `NAV_INDUSTRIES`
 * moves the number here too. What is deliberately absent is a badge wall:
 * we hold no certification, and drawing a shield that stands for nothing
 * is the exact opposite of the thing this band is for.
 * ------------------------------------------------------------------ */
/**
 * Four ids, and two of them are read by the section beside the copy.
 *
 * `trust.tsx` prints a datum next to each row: `handover` shows "3
 * triggers" and counts on this note naming exactly three, and `languages`
 * shows `SETUP_LANGS.length` rather than any number written here. So the
 * handover note stays a strict triple, and no note in this block quotes a
 * language count — the one on screen is whatever the greeting library
 * actually ships, and a figure typed here could only disagree with it.
 *
 * `handover` also lost a claim. It said the transcript so far is "already
 * in your inbox" at the moment of the transfer; it is not. The transfer is
 * blind and the transcript is written up when the call ends. What replaces
 * it is what genuinely happens when the transfer fails, which is the part
 * a buyer is actually worried about.
 *
 * `languages` now leads on the AI disclosure. It is the single strongest
 * compliance fact in this product and it was nowhere on the homepage: the
 * disclosure is applied in code to every greeting, including a custom one
 * written without it, and there is no setting that removes it.
 *
 * `company` ends by saying we hold no certification. The band's whole job
 * is to be checkable, and a trust section that quietly omits the absence
 * of a badge is doing the same work as a badge that stands for nothing.
 */
export const TRUST = {
  kicker: "Before you hand it your phone",
  items: [
    {
      id: "eu",
      label: "Your calls are stored in the EU",
      note: "Database and files in eu-west-1, Ireland, deletable by you at any time — and a deletion that cannot remove the voice provider's copy fails instead of reporting success. The speech and telephony hops are named in the FAQ rather than papered over.",
    },
    {
      id: "handover",
      label: "It hands the call to a person",
      note: "Three ways in: a caller asks for somebody, a rule you wrote in your own words is met, or your instructions send that kind of question to a person. It dials only the people you listed, names them before it dials, and if nobody picks up it tells the caller and leaves the team the message.",
    },
    {
      id: "languages",
      label: "It tells every caller it is an AI",
      note: "In the language it is answering in, in the opening line, with no setting that turns it off — a custom greeting written without it has it added. Every line it speaks of its own accord is written in each language rather than machine-translated, polite form of address included where the language has one.",
    },
    {
      id: "company",
      label: "An EU company, under EU law",
      note: "The GDPR is the law we operate under rather than a page we publish at you. Registered in Romania; the legal name, the CUI and the address are at the foot of this page. There is no certification badge on this site, because we hold none.",
    },
  ],
} as const;

export type FooterColumn = {
  title: string;
  links: readonly { label: string; href: string }[];
};

export const FOOTER = {
  columns: [
    {
      title: "Product",
      // Flattened across both menu groups, in menu order: the footer has
      // no room for the Agents/Voice split and no pointer to explain it.
      links: PRODUCT_GROUPS.flatMap((g) =>
        g.items.map((i) => ({ label: i.label, href: i.href })),
      ),
    },
    {
      title: "Industries",
      links: NAV_INDUSTRIES.map((i) => ({
        label: i.label,
        href: `/industries/${i.slug}`,
      })),
    },
    {
      title: "Solutions",
      links: SOLUTION_ITEMS.map((i) => ({ label: i.label, href: i.href })),
    },
    {
      title: "Company",
      links: [
        // Rooted, so they still land on the homepage's sections from a
        // subpage — which is now the common case, not the exception.
        { label: "Pricing", href: "/#pricing" },
        { label: "Case Studies", href: "/case-studies" },
        { label: "Contact", href: "/contact" },
        { label: "Sign in", href: AUTH.signin },
      ],
    },
  ] as FooterColumn[],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Refund & Cancellation Policy", href: "/refund-policy" },
  ],
} as const;
