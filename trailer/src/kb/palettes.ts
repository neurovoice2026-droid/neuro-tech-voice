/**
 * FILM 2's colours — copied VERBATIM from the site, never invented (CLIENT DIRECTION v2 §1:
 * "Palettes come only from components/site/home/palettes.ts"). Each constant cites its source line
 * (`palettes.ts:N` = /components/site/home/palettes.ts at the time of copying, 2026-10-03).
 *
 * A mesh palette is five colours, DARKEST FIRST — the mesh orb's slot order m0…m4 (the site's
 * `--m0 … --m4`, components/site/product/primitives.tsx Orb): the pp-mesh-flow recipe paints m4 in
 * the light upper-left pool, m0 in the deep lower-right one, m2 as the floor (app/globals.css
 * .pp-mesh-flow). kit/MeshGround reads them in that order.
 *
 * Node-safe (no React): explicit extensions, plain data.
 */
import type { Palette } from '../theme.ts';

export type { Palette };

/* ── the mesh palettes ───────────────────────────────────────────── */

/** "The reader's orb when the answer is not in the documents" — the site's "no answer" grey. Part I's grind. palettes.ts:183 */
export const MUTED_MESH: Palette = ['#4a4852', '#7a7884', '#a9a7b2', '#d4d2da', '#f3f2f6'];

/** "The reader's orb: indigo into violet into paper, the landing's own." Ava + the knowledge base (Parts II–III). palettes.ts:174 */
export const HOME_KB_MESH: Palette = ['#1e1b4b', '#4f46e5', '#8b5cf6', '#c9b8ff', '#f7f5ff'];
/** The old name of HOME_KB_MESH (`export const KB_MESH = HOME_KB_MESH`). palettes.ts:180 */
export const KB_MESH: Palette = HOME_KB_MESH;

/** "The agent's orb in #demo at 3 a.m.: electric opened out into paper." The night close. palettes.ts:102 */
export const INK_MESH: Palette = ['#14062b', '#4a1a9e', '#7c3aed', '#c4a8ff', '#f7f3ff'];

/* ── #demo's four moments (MOMENT_LIGHTS, palettes.ts:130–171) ───────── */

export type MomentId = 'rush' | 'closing' | 'sunday' | 'night';

/** A moment's orb (Ava speaking / at rest) and listen palettes, its light room, its ink. */
export type MomentLight = { orb: Palette; listen: Palette; ground: string; ink: string };

export const MOMENT_LIGHTS: Record<MomentId, MomentLight> = {
  /** rush rose — palettes.ts:131–140 (orb :132, listen :133, ground :134, ink = rushInk :63) */
  rush: {
    orb: ['#2e0620', '#9d174d', '#ec4899', '#f9b4d6', '#fff1f7'],
    listen: ['#2e0620', '#642374', '#8b4cb3', '#c9b9ef', '#fff1f7'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #ffd9ec 0%, #ffe8f3 38%, #fff4f9 72%, #fff8fb 100%)',
    ink: '#be185d',
  },
  /** just after closing, emerald — palettes.ts:141–150 (orb :142, listen :143, ground :144, ink = closingInk :67) */
  closing: {
    orb: ['#03281a', '#065f46', '#10b981', '#a7f3d0', '#f0fdf8'],
    listen: ['#03281a', '#185a74', '#2f8fb0', '#a9dcf0', '#f0fdf8'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #cdf5e2 0%, #e2faef 38%, #f1fcf6 72%, #f6fefa 100%)',
    ink: '#047857',
  },
  /** Sunday teal — palettes.ts:151–160 (orb :152, listen :153, ground :154, ink = sundayInk :65) */
  sunday: {
    orb: ['#052a33', '#0e7490', '#22b8cf', '#a5eaf5', '#f0fdff'],
    listen: ['#052a33', '#1c5295', '#307fcb', '#a7cefb', '#f0fdff'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #cdf1f6 0%, #e2f8fb 38%, #f1fbfd 72%, #f6fdfe 100%)',
    ink: '#0e7490',
  },
  /** 3 a.m., the brand violet in an indigo room — palettes.ts:161–170 (orb = INK_MESH :162, listen :163, ground :164, ink = violet :43) */
  night: {
    orb: INK_MESH,
    listen: ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#f7f3ff'],
    ground: 'radial-gradient(120% 100% at 50% 40%, #34288f 0%, #1f1860 36%, #110c38 68%, #08061c 100%)',
    ink: '#6d28d9',
  },
};

/* ── pearl meshes: stacks of gaussian pools over a floor (CSS recipes, kit/MeshGround `recipe`) ── */

export type PlanId = 'starter' | 'growth' | 'pro' | 'business' | 'scale';

/** #pricing's plan cards (PLAN_LIGHTS, palettes.ts:211–267): the pearl recipe + its inks on it. */
export type PlanLight = { ground: string; text: string; dim: string; accent: string; ink: string; signal: string };

const sheen = (x: number) =>
  `radial-gradient(62% 26% at ${x}% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%)`;
/** one of the recipe's pools, with the site's seven gaussian stops (a × 1, .835, .576, .325, .149, .056, 0) — same numbers as the source */
const pool = (rx: number, ry: number, x: number, y: number, rgb: string, a: number, s: readonly string[]) =>
  `radial-gradient(${rx}% ${ry}% at ${x}% ${y}%, rgb(${rgb} / ${a}) 0%, rgb(${rgb} / ${s[0]}) 20%, rgb(${rgb} / ${s[1]}) 35%, rgb(${rgb} / ${s[2]}) 50%, rgb(${rgb} / ${s[3]}) 65%, rgb(${rgb} / ${s[4]}) 80%, rgb(${rgb} / 0) 100%)`;
// the stop columns as the source writes them, per peak alpha
const S: Record<string, readonly string[]> = {
  '0.95': ['0.794', '0.547', '0.308', '0.142', '0.053'],
  '0.9': ['0.752', '0.519', '0.292', '0.134', '0.051'],
  '0.85': ['0.71', '0.49', '0.276', '0.127', '0.048'],
  '0.82': ['0.685', '0.473', '0.266', '0.122', '0.046'],
  '0.8': ['0.668', '0.461', '0.26', '0.12', '0.045'],
  '0.78': ['0.652', '0.449', '0.253', '0.117', '0.044'],
  '0.75': ['0.626', '0.432', '0.243', '0.112', '0.042'],
  '0.72': ['0.601', '0.415', '0.234', '0.108', '0.04'],
  '0.7': ['0.585', '0.403', '0.227', '0.105', '0.039'],
  '0.6': ['0.501', '0.346', '0.195', '0.09', '0.034'],
  '0.52': ['0.434', '0.3', '0.169', '0.078', '0.029'],
  '0.45': ['0.376', '0.259', '0.146', '0.067', '0.025'],
  '0.42': ['0.351', '0.242', '0.136', '0.063', '0.024'],
  '0.36': ['0.301', '0.207', '0.117', '0.054', '0.02'],
};
const P = (rx: number, ry: number, x: number, y: number, rgb: string, a: number) => pool(rx, ry, x, y, rgb, a, S[String(a)]);

export const PLAN_LIGHTS: Record<PlanId, PlanLight> = {
  /** aqua pearl — palettes.ts:212–222 (ground :214) */
  starter: {
    ground: [
      sheen(20),
      P(95, 42, 0, 10, '158 232 242', 0.9),
      P(85, 38, 100, 28, '198 212 255', 0.72),
      P(60, 28, 72, 58, '230 214 255', 0.42),
      P(105, 44, 18, 80, '182 241 218', 0.85),
      P(95, 40, 100, 100, '166 226 244', 0.8),
      '#f1fbfc',
    ].join(', '),
    text: '#140a24',
    dim: '#35475a',
    accent: '#0a5566',
    ink: '#0a5566',
    signal: '#0891a6',
  },
  /** sky pearl — palettes.ts:223–233 (ground :225) */
  growth: {
    ground: [
      sheen(20),
      P(95, 42, 0, 8, '166 214 255', 0.9),
      P(90, 42, 100, 22, '169 183 255', 0.85),
      P(55, 26, 66, 54, '199 236 255', 0.45),
      P(105, 44, 26, 80, '180 198 255', 0.78),
      P(80, 36, 100, 96, '157 220 243', 0.7),
      '#f1f6ff',
    ].join(', '),
    text: '#140a24',
    dim: '#383a63',
    accent: '#3730a3',
    ink: '#3730a3',
    signal: '#5b6cf0',
  },
  /** magenta pearl (Pro, the pick) — palettes.ts:234–244 (ground :236) */
  pro: {
    ground: [
      sheen(24),
      P(100, 44, 100, 0, '234 141 245', 0.95),
      P(95, 44, 0, 30, '244 146 198', 0.9),
      P(62, 30, 70, 42, '220 110 242', 0.52),
      P(100, 42, 38, 72, '207 160 255', 0.85),
      P(90, 38, 100, 92, '255 142 197', 0.8),
      P(70, 30, 0, 100, '240 162 255', 0.75),
      '#fbe6fb',
    ].join(', '),
    text: '#140a24',
    dim: '#4a1a4f',
    accent: '#641269',
    ink: '#a21caf',
    signal: '#c026d3',
  },
  /** lilac pearl — palettes.ts:245–255 (ground :247) */
  business: {
    ground: [
      sheen(20),
      P(95, 42, 0, 6, '207 182 255', 0.9),
      P(85, 38, 100, 18, '232 196 246', 0.8),
      P(55, 26, 70, 52, '248 217 238', 0.45),
      P(105, 44, 30, 76, '220 195 255', 0.78),
      P(85, 38, 100, 100, '199 176 255', 0.8),
      '#f7f1ff',
    ].join(', '),
    text: '#140a24',
    dim: '#40345f',
    accent: '#5b21b6',
    ink: '#5b21b6',
    signal: '#8b5cf6',
  },
  /** champagne pearl — palettes.ts:256–266 (ground :258) */
  scale: {
    ground: [
      sheen(20),
      P(95, 42, 0, 6, '255 207 174', 0.9),
      P(90, 42, 100, 16, '255 224 164', 0.85),
      P(55, 26, 68, 52, '241 225 255', 0.36),
      P(105, 44, 30, 78, '255 198 212', 0.72),
      P(85, 38, 100, 100, '255 215 180', 0.8),
      '#fff7ee',
    ].join(', '),
    text: '#140a24',
    dim: '#573629',
    accent: '#842c0d',
    ink: '#842c0d',
    signal: '#d45a1a',
  },
};

/** "Violet on paper, the old closing panel" — a studio sweep (one wide radial). palettes.ts:299 */
export const STUDIO_PANEL = 'radial-gradient(120% 90% at 20% 15%, #ffffff 0%, #f4f3f7 45%, #e4e0ee 75%, #cfc6e4 100%)';

/** The pricing estimator's / #start's deep panel. palettes.ts:98 */
export const DEEP_PANEL = 'radial-gradient(110% 140% at 100% 100%, #7c3aed 0%, #5b21b6 22%, #3b1478 44%, #1e0a3c 74%, #14062b 100%)';

/** The estimator panel: a pearl mesh. palettes.ts:284–285 */
export const PRICING_PANEL = [
  P(55, 110, 0, 0, '241 230 255', 0.95),
  P(45, 100, 100, 100, '255 229 243', 0.95),
  P(35, 80, 62, 0, '227 242 255', 0.6),
  '#fcfaff',
].join(', ');

/* ── the site's inks (HOME_COLORS, palettes.ts:29–86) ─────────────────── */

export const HOME = {
  ink: '#140a24', // :31 headings and primary text
  muted: '#625b7a', // :33 meta and labels
  chip: '#f3f1f8', // :35
  wash: '#f6f3ff', // :37
  stage: '#efe9ff', // :39
  plum: '#551a89', // :41 the brand mark and pressed states only
  violet: '#6d28d9', // :43 text on light: key phrases, eyebrows
  electric: '#7c3aed', // :45 fills and marks
  lilac: '#b9a3ff', // :47 text on night
  indigo: '#4f46e5', // :49 orb meshes only
  caller: '#3c50c8', // :51
  callerLit: '#a9bcff', // :53
  rushInk: '#be185d', // :63
  sundayInk: '#0e7490', // :65
  closingInk: '#047857', // :67
  settled: '#15784a', // :69
  night: '#06040a', // :77
  paper: '#edecf1', // :79
  paperDim: '#a8a4b4', // :81
  onDeep: '#f1ecff', // :83
} as const;
