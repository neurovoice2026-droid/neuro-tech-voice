/**
 * Brand tokens, lifted from the website's own source (app/globals.css,
 * components/site/home/home.css, components/site/home/palettes.ts).
 * Nothing here is invented: where the site has two values for a role, the
 * comment says which one the trailer uses.
 */

export const C = {
  /* ── Night: the editorial cover ─────────────────────────────── */
  night: '#06040a', // --cover-ink, the hero's black
  fieldLow: '#171520', // --cover-field-low
  fieldMid: '#3b2f4a', // --cover-field-mid
  fieldHigh: '#4b4451', // --cover-field-high
  panel: '#24212c', // --cover-panel, plates on the dark
  coverPaper: '#dedce0', // --cover-paper, type + CTA plate
  paper: '#edecf1', // --home-paper, type on night
  paperDim: '#a8a4b4', // --home-paper-dim, meta on night
  brandLit: '#c0ace0', // --cover-brand-lit

  /* ── The purple ramp ────────────────────────────────────────── */
  plum: '#551a89', // --cover-brand, pigment / pressed
  violet: '#6d28d9', // key phrases on light
  electric: '#7c3aed', // fills, rings, live dots, AI-disclosure underline
  lilac: '#b9a3ff', // Ava on night, key phrase on dark
  indigo: '#4f46e5',

  /* ── Voices ─────────────────────────────────────────────────── */
  caller: '#3c50c8', // caller on light
  callerLit: '#a9bcff', // caller on night

  /* ── Ember: spent ONLY on "Booked" ──────────────────────────── */
  ember: '#ee5423',
  emberLit: '#ffb877',
  emberInk: '#b23c0e',
  emberSoft: '#ffe9df',
  emberWash: 'rgba(238, 84, 35, 0.16)', // the booked pill on night

  /* ── Confirmed ──────────────────────────────────────────────── */
  settled: '#1f8a55',
  settledLit: '#7ee2a8',

  /* ── Light stock (the white act) ────────────────────────────── */
  white: '#ffffff',
  ink: '#140a24',
  muted: '#625b7a',
  chip: '#f3f1f8',
  wash: '#f6f3ff',
  stage: '#efe9ff',
  hair: 'rgba(24, 16, 40, 0.1)',
  rule: 'rgba(24, 16, 40, 0.07)',

  /* ── The hero portrait's backlight, sampled off hero-robot.webp ─ */
  silver: '#c4c0ba',
  silverMid: '#a19e97',
  silverLow: '#7b7a7d',
} as const;

/** The #demo night room (palettes.ts, "night" ground). */
export const NIGHT_ROOM =
  'radial-gradient(120% 100% at 50% 40%, #34288f 0%, #1f1860 36%, #110c38 68%, #08061c 100%)';

/** The night clock figures' fill (palettes.ts, night `num`). */
export const CLOCK_FILL = 'linear-gradient(180deg, #f1ecff 0%, #c4b5fd 55%, #a78bfa 100%)';

/** The key disc gradient (palettes.ts, night `disc`). */
export const KEY_DISC = 'linear-gradient(135deg, #8b5cf6 0%, #4a1a9e 100%)';

/** Hero cover layers (components/site/hero.tsx). */
export const HERO = {
  grade: 'brightness(0.82) contrast(1.18) saturate(0.88)',
  scrim:
    'linear-gradient(to bottom, rgba(6,4,10,0.72) 0%, rgba(6,4,10,0.10) 20%, rgba(6,4,10,0.26) 44%, rgba(6,4,10,0.66) 62%, rgba(6,4,10,0.90) 82%, #06040a 100%)',
  wash:
    'radial-gradient(62% 50% at 52% 32%, rgba(85,26,137,0.16), transparent 72%), radial-gradient(105% 88% at 50% 46%, transparent 34%, rgba(6,4,10,0.55) 76%, rgba(6,4,10,0.92) 100%)',
  focal: { x: 0.5024, y: 0.4063 }, // eyes line, lib/site.ts
} as const;

/* ── The four lights ─────────────────────────────────────────────
 * #demo's MOMENT_LIGHTS (components/site/home/palettes.ts:130-171), copied
 * verbatim. On the site the hour is the light: "Answered on the first ring —
 * at 3 a.m., on a Sunday, just after closing, in the middle of a rush." Each
 * moment lights the stage, the clock and the orb in a colour of its own; the
 * night is the poster (the brand violet in an indigo room). Lights are LIGHT
 * — orb meshes, blooms, rims, grounds — never flat slabs, and one light leads
 * a moment. Helpers (palette blends, sequences, blooms): src/lib/lights.ts. */

export type LightId = 'rush' | 'closing' | 'sunday' | 'night';

/** A FluidOrb / MeshOrb palette: five colours, darkest first (the mesh orb's slot order). */
export type Palette = readonly string[];

export type MomentLight = {
  /** The orb while Ava speaks, and at rest. Darkest first. */
  orb: Palette;
  /** The orb while the caller speaks: the same ends, leaning to caller blue. */
  listen: Palette;
  /** The stage's ground: lit from the clock outwards (a CSS background). */
  ground: string;
  /** The clock's figures (a CSS gradient, one per figure cell). */
  num: string;
  /** The dial disc on the moment's key (a CSS gradient). */
  disc: string;
  /** The rings that leave the orb when the phone rings (a CSS colour). */
  wave: string;
  /** The stage's text tone: dark text on a light room, paper on the night. */
  tone: 'light' | 'night';
  /** Text in the moment's colour (on the light rooms / white). */
  ink: string;
};

/** The agent's orb at 3 a.m. (palettes.ts INK_MESH): electric opened out into paper. */
const INK_MESH = ['#14062b', '#4a1a9e', '#7c3aed', '#c4a8ff', '#f7f3ff'] as const;

export const LIGHTS: Record<LightId, MomentLight> = {
  rush: {
    orb: ['#2e0620', '#9d174d', '#ec4899', '#f9b4d6', '#fff1f7'],
    listen: ['#2e0620', '#642374', '#8b4cb3', '#c9b9ef', '#fff1f7'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #ffd9ec 0%, #ffe8f3 38%, #fff4f9 72%, #fff8fb 100%)',
    num: 'linear-gradient(180deg, #db2777 0%, #9d174d 100%)',
    disc: 'linear-gradient(135deg, #f472b6 0%, #be185d 100%)',
    wave: 'rgb(219 39 119 / 0.45)',
    tone: 'light',
    ink: '#be185d', // HOME_COLORS.rushInk
  },
  closing: {
    orb: ['#03281a', '#065f46', '#10b981', '#a7f3d0', '#f0fdf8'],
    listen: ['#03281a', '#185a74', '#2f8fb0', '#a9dcf0', '#f0fdf8'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #cdf5e2 0%, #e2faef 38%, #f1fcf6 72%, #f6fefa 100%)',
    num: 'linear-gradient(180deg, #059669 0%, #065f46 100%)',
    disc: 'linear-gradient(135deg, #34d399 0%, #047857 100%)',
    wave: 'rgb(5 150 105 / 0.45)',
    tone: 'light',
    ink: '#047857', // HOME_COLORS.closingInk
  },
  sunday: {
    orb: ['#052a33', '#0e7490', '#22b8cf', '#a5eaf5', '#f0fdff'],
    listen: ['#052a33', '#1c5295', '#307fcb', '#a7cefb', '#f0fdff'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #cdf1f6 0%, #e2f8fb 38%, #f1fbfd 72%, #f6fdfe 100%)',
    num: 'linear-gradient(180deg, #0a8aa8 0%, #155e75 100%)',
    disc: 'linear-gradient(135deg, #22b8cf 0%, #0e7490 100%)',
    wave: 'rgb(10 138 168 / 0.45)',
    tone: 'light',
    ink: '#0e7490', // HOME_COLORS.sundayInk
  },
  night: {
    orb: INK_MESH,
    listen: ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#f7f3ff'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #34288f 0%, #1f1860 36%, #110c38 68%, #08061c 100%)',
    num: 'linear-gradient(180deg, #f1ecff 0%, #c4b5fd 55%, #a78bfa 100%)',
    disc: 'linear-gradient(135deg, #8b5cf6 0%, #4a1a9e 100%)',
    wave: 'rgb(185 163 255 / 0.45)',
    tone: 'night',
    ink: '#6d28d9', // HOME_COLORS.violet
  },
};

/** The site's reading order of the four moments: the rush, just after closing, Sunday, 3 a.m. */
export const LIGHT_ORDER: readonly LightId[] = ['rush', 'closing', 'sunday', 'night'];

/** The reader's orb when the answer is not in the documents (palettes.ts MUTED_MESH). */
export const MUTED_MESH: Palette = ['#4a4852', '#7a7884', '#a9a7b2', '#d4d2da', '#f3f2f6'];

/** FluidOrb palettes, darkest first (palettes.ts). `ink` IS the night light's orb. */
export const ORB = {
  ink: INK_MESH,
  listen: ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#f7f3ff'],
  found: ['#1e1b4b', '#4f46e5', '#8b5cf6', '#c9b8ff', '#f7f5ff'],
} as const;

/**
 * ONE FAMILY ON SCREEN — Instrument Sans (variable), set like the knowledge
 * heading the client chose as THE look ("Answers from your own documents.":
 * 460, −0.03em, sentence case, the key phrase in the scene's accent ink).
 * Japanese falls through to Noto Sans JP (a sans, to match). Geist Mono only
 * for genuinely technical tokens (a time code, #front-desk), sparingly.
 * Loaded from @fontsource in lib/fonts.ts. Use the TYPE roles below rather
 * than setting faces by hand.
 */
const SANS = '"Instrument Sans Variable", "Instrument Sans", "Noto Sans JP Variable", system-ui, sans-serif';

export const FONT = {
  /** Instrument Sans — EVERY piece of on-screen type (display, headlines, captions, labels). */
  ui: SANS,
  /** Japanese: Noto Sans JP first (CJK-only runs / measuring); mixed runs can simply use `ui`. */
  jp: '"Noto Sans JP Variable", "Instrument Sans Variable", sans-serif',
  /** Geist Mono — technical tokens only (a time code, #front-desk, 200 OK). */
  mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
  /** @deprecated was Inter Tight — now Instrument Sans (one family). Use TYPE.display / FONT.ui. */
  display: SANS,
  /** @deprecated was Inter — now Instrument Sans (one family). Use TYPE.* / FONT.ui. */
  body: SANS,
  /** @deprecated was Cormorant Garamond (serif italic) — now Instrument Sans. Captions: TYPE.caption, never italic. */
  cinema: SANS,
} as const;

/** Type roles from components/site/home/type.ts, scaled for video. */
export const TRACK = {
  display: '-0.03em', // was −0.04em (Inter Tight's cover headline); one family now: the section tracking
  wordmark: '-0.07em',
  section: '-0.03em', // the knowledge heading — THE look
  h3: '-0.01em',
  /** card / station / industry names (TYPE.title) */
  title: '-0.02em',
  /** spoken lines (TYPE.caption) */
  caption: '-0.02em',
  label: '0.14em',
  tag: '0.16em',
} as const;

/* ── TYPE: the roles ──────────────────────────────────────────────
 * Built on the knowledge heading (src/scenes/knowledge/Title.tsx: FONT.ui,
 * 460, TRACK.section, line-height 1.04). Sizes are [16:9, 9:16] px (both
 * renders have a 1080 px short side). Legibility floor on a phone: read
 * text ≥ 64 / 56 px, labels ≥ 30 / 28 px; 9:16 safe zone y 250–1500.
 *
 * Light type on a dark ground reads heavier (irradiation): `weightOnDark` is
 * the same optical weight there. Helpers: lib/type.ts (typeStyle, useType,
 * captionFont). Two-tone: the key phrase in the scene's accent ink
 * (LIGHTS[id].ink on paper, lights.ts inkFor(id, 'dark') on night).
 */
export type TypeRole = 'display' | 'headline' | 'title' | 'caption' | 'label' | 'meta';

export type TypeSpec = {
  family: string;
  /** px [16:9, 9:16] */
  size: readonly [number, number];
  weight: number;
  /** the same optical weight for light type on a dark ground */
  weightOnDark: number;
  /** letter-spacing (em) */
  tracking: string;
  lineHeight: number;
  /** UPPERCASE (labels) */
  upper?: boolean;
};

export const TYPE: Record<TypeRole, TypeSpec> = {
  /** The biggest statements: "Your business is closed.", "Asleep. / Booked.", the CTA line. */
  display: { family: SANS, size: [128, 112], weight: 460, weightOnDark: 440, tracking: TRACK.section, lineHeight: 1.04 },
  /** Section headings — exactly the knowledge heading: "Answers from your own documents.", "After the call." */
  headline: { family: SANS, size: [100, 92], weight: 460, weightOnDark: 440, tracking: TRACK.section, lineHeight: 1.06 },
  /** Names on cards / stations / industries ("Price list", "Dental clinic", "Slack"): the smallest read text. */
  title: { family: SANS, size: [64, 56], weight: 480, weightOnDark: 460, tracking: TRACK.title, lineHeight: 1.12 },
  /** Spoken lines — Ava AND the caller (colour + a label say who speaks, never a serif italic). */
  caption: { family: SANS, size: [76, 68], weight: 460, weightOnDark: 450, tracking: TRACK.caption, lineHeight: 1.18 },
  /** Small uppercase tracked meta: AVA / CALLER, KNOWLEDGE BASE, TUESDAY NIGHT. */
  label: { family: SANS, size: [30, 28], weight: 540, weightOnDark: 520, tracking: TRACK.label, lineHeight: 1.2, upper: true },
  /** Technical tokens in Geist Mono (3:00 PM on a calendar, #front-desk) — sparingly. */
  meta: { family: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace', size: [30, 28], weight: 460, weightOnDark: 440, tracking: '0em', lineHeight: 1.2 },
};

/**
 * Japanese in a role: CJK glyphs fill the em (they read ~15 % bigger than Latin
 * at one size) and are never negatively tracked. Apply on top of a role:
 * size × scale, tracking, weight (Noto Sans JP is darker than Instrument Sans).
 */
export const TYPE_JP = { scale: 0.86, tracking: '0.02em', weight: 460, weightOnDark: 440, lineHeight: 1.22 } as const;

/** Who is speaking: the caption ink and the tag (label) ink, on night and on paper. */
export const VOICE_INK = {
  ava: { label: 'AVA', night: { text: '#edecf1', tag: '#b9a3ff' }, paper: { text: '#140a24', tag: '#6d28d9' } },
  caller: { label: 'CALLER', night: { text: '#a9bcff', tag: '#a9bcff' }, paper: { text: '#3c50c8', tag: '#3c50c8' } },
} as const;
export type Speaker = keyof typeof VOICE_INK;
export type Tone = 'night' | 'paper';

/* ── ROOMS: the grounds (components/Atmosphere.tsx) ───────────────
 * Colour lives in the subject, not the wallpaper: the rooms are neutral and
 * take colour only from their one key light. */
export const ROOM = {
  /** near-black, the faintest cool bias (the cover's ink, a touch deeper) */
  night: '#050408',
  /** a warm near-black for the booked side */
  ember: '#0a0605',
  /** paper white: the lit centre, the wall in shade, the floor */
  paper: { lit: '#ffffff', wall: '#ecebe8', floor: '#f6f5f2' },
} as const;

/** Shadows, verbatim. */
export const SHADOW = {
  btn: '0 0 1px rgb(0 0 0 / 0.4), 0 1px 1px rgb(0 0 0 / 0.04), 0 2px 4px rgb(0 0 0 / 0.04)',
  card: '0 0 0 1px rgb(24 16 40 / 0.06), 0 14px 30px -20px rgb(24 16 40 / 0.35)',
  ring: '0 0 0 1px rgb(24 16 40 / 0.06)',
  menu:
    '0 10px 20px 1px rgb(0 0 0 / 0.04), 0 48px 48px -24px rgb(0 0 0 / 0.02), 0 24px 24px -12px rgb(0 0 0 / 0.04), 0 12px 12px -6px rgb(0 0 0 / 0.04), 0 6px 6px -3px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 0 0 1px rgb(0 0 0 / 0.06)',
  chip: '0 0.8em 2em -0.6em rgba(0,0,0,0.75)', // cursor chip on the cover
  deep: '0 40px 80px -30px rgba(0,0,0,0.8), 0 12px 24px -12px rgba(0,0,0,0.6)',
} as const;

/**
 * A real object's shadow on paper, at `lift` (0 = resting, 1 = a card, 2 = held up):
 * a tight contact shadow + a soft key shadow below + a wide ambient — layered like
 * light falls (SHADOW.menu's idiom), never one big grey blur. `k` scales the darkness.
 */
export function elevation(lift = 1, k = 1): string {
  const l = Math.max(0, lift);
  const a = (x: number) => (x * k).toFixed(3);
  return [
    `0 0 0 1px rgb(20 16 28 / ${a(0.05)})`,
    `0 ${(0.5 + l * 0.5).toFixed(1)}px ${(1 + l).toFixed(1)}px rgb(20 16 28 / ${a(0.06)})`,
    `0 ${(2 + l * 4).toFixed(1)}px ${(4 + l * 8).toFixed(1)}px -${(1 + l * 2).toFixed(1)}px rgb(20 16 28 / ${a(0.07)})`,
    `0 ${(6 + l * 14).toFixed(1)}px ${(14 + l * 30).toFixed(1)}px -${(4 + l * 8).toFixed(1)}px rgb(20 16 28 / ${a(0.09)})`,
    `0 ${(14 + l * 30).toFixed(1)}px ${(30 + l * 60).toFixed(1)}px -${(10 + l * 18).toFixed(1)}px rgb(20 16 28 / ${a(0.08)})`,
  ].join(', ');
}

/** Radii (the site's --radius 0.75rem scale). */
export const R = {
  sm: 7.2,
  md: 9.6,
  lg: 12,
  xl: 16.8,
  x2: 21.6,
  x3: 26.4,
  stage: 32,
  pill: 9999,
} as const;
