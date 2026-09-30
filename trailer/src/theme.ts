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

/** FluidOrb palettes, darkest first (palettes.ts). */
export const ORB = {
  ink: ['#14062b', '#4a1a9e', '#7c3aed', '#c4a8ff', '#f7f3ff'],
  listen: ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#f7f3ff'],
  found: ['#1e1b4b', '#4f46e5', '#8b5cf6', '#c9b8ff', '#f7f5ff'],
} as const;

/**
 * Faces, as the site sets them. Loaded from @fontsource in fonts.ts.
 * Variable builds, so the site's in-between weights (440, 460, 520) render
 * exactly rather than rounding to a static cut.
 */
export const FONT = {
  /** Inter Tight — the cover's display face (hero headline, CTA, wordmark). */
  display: '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif',
  /** Instrument Sans — section display + the clock figures. */
  ui: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
  /** Inter — body copy, labels, header chrome. */
  body: '"Inter Variable", Inter, system-ui, sans-serif',
  /** Cormorant Garamond 500 — spoken lines (the site's "cinema" face). */
  cinema: '"Cormorant Garamond", "Noto Serif JP", Georgia, serif',
  /** Geist Mono — measured values, times, ordinals, POST/200 OK. */
  mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
} as const;

/** Type roles from components/site/home/type.ts, scaled for video. */
export const TRACK = {
  display: '-0.04em', // cover headline (the tracking "the design depends on")
  wordmark: '-0.07em',
  section: '-0.03em',
  h3: '-0.01em',
  label: '0.14em',
  tag: '0.16em',
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
