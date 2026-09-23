/* ------------------------------------------------------------------ *
 * The landing's colours, for the code that cannot read a CSS variable:
 * GSAP tweens, WebGL meshes and gradients set inline.
 *
 * HOME_COLORS is the JS copy of the `--home-*` tokens in home.css, value
 * for value (home.test.ts holds the two together). Everything a class
 * can say, it says with the token: `text-(--home-violet)`, never a hex.
 *
 * One accent family (violet, 255–275°), a caller blue, ember for booked
 * or urgent, green for confirmed. Colour follows state or speaker, never
 * a category.
 *
 * One exception, #demo's: there the light is the hour. Each of its four
 * moments lights the stage, the clock and the orb in a colour of its own
 * (MOMENT_LIGHTS) — rose for the rush, green for just after closing, teal
 * for Sunday, the brand's violet for 3 a.m. — and only the moment's ink
 * ever sets text in it.
 * Every other word on that stage keeps the state and speaker colours.
 *
 * A second, #pricing's: there a plan is its colour. Each listed plan wears
 * one light (PLAN_LIGHTS) on its card, its slider band, its preset chip,
 * the receipt's swatch, and the estimator's count, total and thumb while
 * it is the lowest bill. Only that plan's own inks set text in it.
 * ------------------------------------------------------------------ */

import type { HomeMomentId } from "@/lib/pages/home/call";
import type { PlanId } from "@/lib/pages/home/pricing-math";

export const HOME_COLORS = {
  /** Headings and primary text. */
  ink: "#140a24",
  /** Meta and labels. */
  muted: "#625b7a",
  /** Unselected chips (the body's --pp-card). */
  chip: "#f3f1f8",
  /** The fitting plan's slab, #how's band, the top of a stage. */
  wash: "#f6f3ff",
  /** Stages, the "Answered" pill, a chip's hover. */
  stage: "#efe9ff",
  /** The brand mark and pressed states only. */
  plum: "#551a89",
  /** Text on light: key phrases, eyebrows, indices, the number a card is about, links. */
  violet: "#6d28d9",
  /** Fills and marks: selected chips (white text), rings, live dots, rails. */
  electric: "#7c3aed",
  /** Text on night and on the deep panel's dark half. */
  lilac: "#b9a3ff",
  /** Orb meshes only. */
  indigo: "#4f46e5",
  /** The caller's spoken lines on light. */
  caller: "#3c50c8",
  /** The caller's lines and label on night. */
  callerLit: "#a9bcff",
  /** Marks only: the booked dot, the donut's arc. Never text, never a heading. */
  ember: "#ee5423",
  /** Ember text on light. */
  emberInk: "#b23c0e",
  /** Ember text on night. */
  emberLit: "#ffb877",
  /** The booked pill on white. */
  emberSoft: "#ffe9df",
  /** #demo's rush: its phrase in the sub and its key's fill (white on it 6.04:1). */
  rushInk: "#be185d",
  /** #demo's Sunday: its phrase in the sub and its key's fill (white on it 5.36:1). */
  sundayInk: "#0e7490",
  /** #demo's after-closing call: its phrase in the sub, its key's fill and its pill (white on it 5.48:1). */
  closingInk: "#047857",
  /** Confirmed, and nothing else. */
  settled: "#15784a",
  /** Confirmed, on night. */
  settledLit: "#7ee2a8",
  /** The confirmed pill. */
  settledSoft: "#e9f6ee",
  /** "Flagged for you" marks. */
  flagged: "#8c86a0",
  /** The hero's own black. */
  night: "#06040a",
  /** Type on night. */
  paper: "#edecf1",
  /** Meta and mono on night. */
  paperDim: "#a8a4b4",
  /** Small text anywhere on the deep panel. */
  onDeep: "#f1ecff",
  /** Secondary text, only where the deep panel is #5b21b6 or darker. */
  onDeepDim: "#d8cdf7",
} as const;

export type HomeColor = keyof typeof HOME_COLORS;

/** The token a colour is declared as in home.css: `callerLit` → `--home-caller-lit`. */
export const homeToken = (name: HomeColor) => `--home-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/**
 * The pricing estimator's and #start's panel (`.home-deep`, `--home-deep`):
 * deepest at the top left, where the heading and labels sit, opening to
 * electric at the bottom right corner.
 */
export const DEEP_PANEL =
  "radial-gradient(110% 140% at 100% 100%, #7c3aed 0%, #5b21b6 22%, #3b1478 44%, #1e0a3c 74%, #14062b 100%)";

/** The agent's orb in #demo at 3 a.m.: electric opened out into paper. Darkest first, in the mesh orb's slot order. */
export const INK_MESH = ["#14062b", "#4a1a9e", "#7c3aed", "#c4a8ff", "#f7f3ff"] as const; // NEW

export type MomentLight = {
  /** The orb while Ava speaks, and at rest. Darkest first. */
  orb: readonly string[];
  /** The orb while the caller speaks: the same ends, leaning to caller blue. WebGL only. */
  listen: readonly string[];
  /** The stage's ground: lit from the clock outwards. */
  ground: string;
  /** The clock's figures, one gradient per figure cell. */
  num: string;
  /** The dial disc on the moment's key. */
  disc: string;
  /** The rings that leave the orb when the phone rings. */
  wave: string;
  /** The stage's text tokens (demo.css): dark text on a light room, paper on the night. */
  tone: "light" | "night";
  /** Text in the moment's colour: the sub's phrase, and the key's fill under white. */
  ink: string;
};

/**
 * #demo's four moments. Every array is a module constant, so the orb
 * (which eases whenever its colours change identity) only ever eases
 * when the moment does. The night is the poster: the brand's violet in
 * an indigo room, a step cooler than the hero's purple and #start's
 * deep panel.
 */
export const MOMENT_LIGHTS: Record<HomeMomentId, MomentLight> = {
  rush: {
    orb: ["#2e0620", "#9d174d", "#ec4899", "#f9b4d6", "#fff1f7"],
    listen: ["#2e0620", "#642374", "#8b4cb3", "#c9b9ef", "#fff1f7"],
    ground: "radial-gradient(120% 100% at 50% 40%, #ffd9ec 0%, #ffe8f3 38%, #fff4f9 72%, #fff8fb 100%)",
    num: "linear-gradient(180deg, #db2777 0%, #9d174d 100%)",
    disc: "linear-gradient(135deg, #f472b6 0%, #be185d 100%)",
    wave: "rgb(219 39 119 / 0.45)",
    tone: "light",
    ink: HOME_COLORS.rushInk,
  },
  closing: {
    orb: ["#03281a", "#065f46", "#10b981", "#a7f3d0", "#f0fdf8"],
    listen: ["#03281a", "#185a74", "#2f8fb0", "#a9dcf0", "#f0fdf8"],
    ground: "radial-gradient(120% 100% at 50% 40%, #cdf5e2 0%, #e2faef 38%, #f1fcf6 72%, #f6fefa 100%)",
    num: "linear-gradient(180deg, #059669 0%, #065f46 100%)",
    disc: "linear-gradient(135deg, #34d399 0%, #047857 100%)",
    wave: "rgb(5 150 105 / 0.45)",
    tone: "light",
    ink: HOME_COLORS.closingInk,
  },
  sunday: {
    orb: ["#052a33", "#0e7490", "#22b8cf", "#a5eaf5", "#f0fdff"],
    listen: ["#052a33", "#1c5295", "#307fcb", "#a7cefb", "#f0fdff"],
    ground: "radial-gradient(120% 100% at 50% 40%, #cdf1f6 0%, #e2f8fb 38%, #f1fbfd 72%, #f6fdfe 100%)",
    num: "linear-gradient(180deg, #0a8aa8 0%, #155e75 100%)",
    disc: "linear-gradient(135deg, #22b8cf 0%, #0e7490 100%)",
    wave: "rgb(10 138 168 / 0.45)",
    tone: "light",
    ink: HOME_COLORS.sundayInk,
  },
  night: {
    orb: INK_MESH,
    listen: ["#14062b", "#3a259c", "#5946d9", "#b4b4ff", "#f7f3ff"],
    ground: "radial-gradient(120% 100% at 50% 40%, #34288f 0%, #1f1860 36%, #110c38 68%, #08061c 100%)",
    num: "linear-gradient(180deg, #f1ecff 0%, #c4b5fd 55%, #a78bfa 100%)",
    disc: "linear-gradient(135deg, #8b5cf6 0%, #4a1a9e 100%)",
    wave: "rgb(185 163 255 / 0.45)",
    tone: "night",
    ink: HOME_COLORS.violet,
  },
};

/** The reader's orb: indigo into violet into paper, the landing's own (the product page keeps KB_MESH). */
export const HOME_KB_MESH = ["#1e1b4b", "#4f46e5", "#8b5cf6", "#c9b8ff", "#f7f5ff"] as const; // NEW

/**
 * The old name, now the landing's own mesh rather than the product page's.
 * @deprecated Import HOME_KB_MESH; delete this once knowledge-stage.tsx does.
 */
export const KB_MESH = HOME_KB_MESH;

/** The reader's orb when the answer is not in the documents. */
export const MUTED_MESH = ["#4a4852", "#7a7884", "#a9a7b2", "#d4d2da", "#f3f2f6"] as const; // src: components/site/product/knowledge-base/two-calls.tsx:24

export type PlanLight = {
  /** A static stack of radial pools over a floor, top layer first. Painted once, never animated. */
  ground: string;
  tone: "light" | "dark";
  /** Primary text on the card. */
  text: string;
  /** Small secondary text on the card. Never --home-muted: it measures 3.6–4.4 on the pools. */
  dim: string;
  /** Coloured text on the card (the per-day price, the band line). */
  accent: string;
  /** Check marks and the band dot on the card (marks). */
  tick: string;
  /** The plan's colour as text on white or the estimator panel: count, total, receipt name, selected chip. */
  ink: string;
  /** Marks on white or the panel: the slider band, the preset dot. */
  signal: string;
};

/**
 * #pricing's plan cards: pearl meshes. Each is a stack of soft pools with
 * a gaussian falloff (seven stops, so no pool shows an edge) under a white
 * sheen at the top, over a pale floor, climbing aqua → sky → (Pro, the
 * pick) magenta pearl → lilac pearl → champagne. One line per recipe:
 * pricing.css declares the same strings, and home.test.ts composites every
 * text colour over the real card sizes.
 */
export const PLAN_LIGHTS: Record<PlanId, PlanLight> = {
  starter: {
    ground:
      "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 42% at 0% 10%, rgb(158 232 242 / 0.9) 0%, rgb(158 232 242 / 0.752) 20%, rgb(158 232 242 / 0.519) 35%, rgb(158 232 242 / 0.292) 50%, rgb(158 232 242 / 0.134) 65%, rgb(158 232 242 / 0.051) 80%, rgb(158 232 242 / 0) 100%), radial-gradient(85% 38% at 100% 28%, rgb(198 212 255 / 0.72) 0%, rgb(198 212 255 / 0.601) 20%, rgb(198 212 255 / 0.415) 35%, rgb(198 212 255 / 0.234) 50%, rgb(198 212 255 / 0.108) 65%, rgb(198 212 255 / 0.04) 80%, rgb(198 212 255 / 0) 100%), radial-gradient(60% 28% at 72% 58%, rgb(230 214 255 / 0.42) 0%, rgb(230 214 255 / 0.351) 20%, rgb(230 214 255 / 0.242) 35%, rgb(230 214 255 / 0.136) 50%, rgb(230 214 255 / 0.063) 65%, rgb(230 214 255 / 0.024) 80%, rgb(230 214 255 / 0) 100%), radial-gradient(105% 44% at 18% 80%, rgb(182 241 218 / 0.85) 0%, rgb(182 241 218 / 0.71) 20%, rgb(182 241 218 / 0.49) 35%, rgb(182 241 218 / 0.276) 50%, rgb(182 241 218 / 0.127) 65%, rgb(182 241 218 / 0.048) 80%, rgb(182 241 218 / 0) 100%), radial-gradient(95% 40% at 100% 100%, rgb(166 226 244 / 0.8) 0%, rgb(166 226 244 / 0.668) 20%, rgb(166 226 244 / 0.461) 35%, rgb(166 226 244 / 0.26) 50%, rgb(166 226 244 / 0.12) 65%, rgb(166 226 244 / 0.045) 80%, rgb(166 226 244 / 0) 100%), #f1fbfc",
    tone: "light",
    text: "#140a24",
    dim: "#35475a",
    accent: "#0a5566",
    tick: "#0a5566",
    ink: "#0a5566",
    signal: "#0891a6",
  },
  growth: {
    ground:
      "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 42% at 0% 8%, rgb(166 214 255 / 0.9) 0%, rgb(166 214 255 / 0.752) 20%, rgb(166 214 255 / 0.519) 35%, rgb(166 214 255 / 0.292) 50%, rgb(166 214 255 / 0.134) 65%, rgb(166 214 255 / 0.051) 80%, rgb(166 214 255 / 0) 100%), radial-gradient(90% 42% at 100% 22%, rgb(169 183 255 / 0.85) 0%, rgb(169 183 255 / 0.71) 20%, rgb(169 183 255 / 0.49) 35%, rgb(169 183 255 / 0.276) 50%, rgb(169 183 255 / 0.127) 65%, rgb(169 183 255 / 0.048) 80%, rgb(169 183 255 / 0) 100%), radial-gradient(55% 26% at 66% 54%, rgb(199 236 255 / 0.45) 0%, rgb(199 236 255 / 0.376) 20%, rgb(199 236 255 / 0.259) 35%, rgb(199 236 255 / 0.146) 50%, rgb(199 236 255 / 0.067) 65%, rgb(199 236 255 / 0.025) 80%, rgb(199 236 255 / 0) 100%), radial-gradient(105% 44% at 26% 80%, rgb(180 198 255 / 0.78) 0%, rgb(180 198 255 / 0.652) 20%, rgb(180 198 255 / 0.449) 35%, rgb(180 198 255 / 0.253) 50%, rgb(180 198 255 / 0.117) 65%, rgb(180 198 255 / 0.044) 80%, rgb(180 198 255 / 0) 100%), radial-gradient(80% 36% at 100% 96%, rgb(157 220 243 / 0.7) 0%, rgb(157 220 243 / 0.585) 20%, rgb(157 220 243 / 0.403) 35%, rgb(157 220 243 / 0.227) 50%, rgb(157 220 243 / 0.105) 65%, rgb(157 220 243 / 0.039) 80%, rgb(157 220 243 / 0) 100%), #f1f6ff",
    tone: "light",
    text: "#140a24",
    dim: "#383a63",
    accent: "#3730a3",
    tick: "#3730a3",
    ink: "#3730a3",
    signal: "#5b6cf0",
  },
  pro: {
    ground:
      "radial-gradient(62% 26% at 24% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(100% 44% at 100% 0%, rgb(234 141 245 / 0.95) 0%, rgb(234 141 245 / 0.794) 20%, rgb(234 141 245 / 0.547) 35%, rgb(234 141 245 / 0.308) 50%, rgb(234 141 245 / 0.142) 65%, rgb(234 141 245 / 0.053) 80%, rgb(234 141 245 / 0) 100%), radial-gradient(95% 44% at 0% 30%, rgb(244 146 198 / 0.9) 0%, rgb(244 146 198 / 0.752) 20%, rgb(244 146 198 / 0.519) 35%, rgb(244 146 198 / 0.292) 50%, rgb(244 146 198 / 0.134) 65%, rgb(244 146 198 / 0.051) 80%, rgb(244 146 198 / 0) 100%), radial-gradient(62% 30% at 70% 42%, rgb(220 110 242 / 0.52) 0%, rgb(220 110 242 / 0.434) 20%, rgb(220 110 242 / 0.3) 35%, rgb(220 110 242 / 0.169) 50%, rgb(220 110 242 / 0.078) 65%, rgb(220 110 242 / 0.029) 80%, rgb(220 110 242 / 0) 100%), radial-gradient(100% 42% at 38% 72%, rgb(207 160 255 / 0.85) 0%, rgb(207 160 255 / 0.71) 20%, rgb(207 160 255 / 0.49) 35%, rgb(207 160 255 / 0.276) 50%, rgb(207 160 255 / 0.127) 65%, rgb(207 160 255 / 0.048) 80%, rgb(207 160 255 / 0) 100%), radial-gradient(90% 38% at 100% 92%, rgb(255 142 197 / 0.8) 0%, rgb(255 142 197 / 0.668) 20%, rgb(255 142 197 / 0.461) 35%, rgb(255 142 197 / 0.26) 50%, rgb(255 142 197 / 0.12) 65%, rgb(255 142 197 / 0.045) 80%, rgb(255 142 197 / 0) 100%), radial-gradient(70% 30% at 0% 100%, rgb(240 162 255 / 0.75) 0%, rgb(240 162 255 / 0.626) 20%, rgb(240 162 255 / 0.432) 35%, rgb(240 162 255 / 0.243) 50%, rgb(240 162 255 / 0.112) 65%, rgb(240 162 255 / 0.042) 80%, rgb(240 162 255 / 0) 100%), #fbe6fb",
    tone: "light",
    text: "#140a24",
    dim: "#4a1a4f",
    accent: "#641269",
    tick: "#641269",
    ink: "#a21caf",
    signal: "#c026d3",
  },
  business: {
    ground:
      "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 42% at 0% 6%, rgb(207 182 255 / 0.9) 0%, rgb(207 182 255 / 0.752) 20%, rgb(207 182 255 / 0.519) 35%, rgb(207 182 255 / 0.292) 50%, rgb(207 182 255 / 0.134) 65%, rgb(207 182 255 / 0.051) 80%, rgb(207 182 255 / 0) 100%), radial-gradient(85% 38% at 100% 18%, rgb(232 196 246 / 0.8) 0%, rgb(232 196 246 / 0.668) 20%, rgb(232 196 246 / 0.461) 35%, rgb(232 196 246 / 0.26) 50%, rgb(232 196 246 / 0.12) 65%, rgb(232 196 246 / 0.045) 80%, rgb(232 196 246 / 0) 100%), radial-gradient(55% 26% at 70% 52%, rgb(248 217 238 / 0.45) 0%, rgb(248 217 238 / 0.376) 20%, rgb(248 217 238 / 0.259) 35%, rgb(248 217 238 / 0.146) 50%, rgb(248 217 238 / 0.067) 65%, rgb(248 217 238 / 0.025) 80%, rgb(248 217 238 / 0) 100%), radial-gradient(105% 44% at 30% 76%, rgb(220 195 255 / 0.78) 0%, rgb(220 195 255 / 0.652) 20%, rgb(220 195 255 / 0.449) 35%, rgb(220 195 255 / 0.253) 50%, rgb(220 195 255 / 0.117) 65%, rgb(220 195 255 / 0.044) 80%, rgb(220 195 255 / 0) 100%), radial-gradient(85% 38% at 100% 100%, rgb(199 176 255 / 0.8) 0%, rgb(199 176 255 / 0.668) 20%, rgb(199 176 255 / 0.461) 35%, rgb(199 176 255 / 0.26) 50%, rgb(199 176 255 / 0.12) 65%, rgb(199 176 255 / 0.045) 80%, rgb(199 176 255 / 0) 100%), #f7f1ff",
    tone: "light",
    text: "#140a24",
    dim: "#40345f",
    accent: "#5b21b6",
    tick: "#5b21b6",
    ink: "#5b21b6",
    signal: "#8b5cf6",
  },
  scale: {
    ground:
      "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 42% at 0% 6%, rgb(255 207 174 / 0.9) 0%, rgb(255 207 174 / 0.752) 20%, rgb(255 207 174 / 0.519) 35%, rgb(255 207 174 / 0.292) 50%, rgb(255 207 174 / 0.134) 65%, rgb(255 207 174 / 0.051) 80%, rgb(255 207 174 / 0) 100%), radial-gradient(90% 42% at 100% 16%, rgb(255 224 164 / 0.85) 0%, rgb(255 224 164 / 0.71) 20%, rgb(255 224 164 / 0.49) 35%, rgb(255 224 164 / 0.276) 50%, rgb(255 224 164 / 0.127) 65%, rgb(255 224 164 / 0.048) 80%, rgb(255 224 164 / 0) 100%), radial-gradient(55% 26% at 68% 52%, rgb(241 225 255 / 0.36) 0%, rgb(241 225 255 / 0.301) 20%, rgb(241 225 255 / 0.207) 35%, rgb(241 225 255 / 0.117) 50%, rgb(241 225 255 / 0.054) 65%, rgb(241 225 255 / 0.02) 80%, rgb(241 225 255 / 0) 100%), radial-gradient(105% 44% at 30% 78%, rgb(255 198 212 / 0.72) 0%, rgb(255 198 212 / 0.601) 20%, rgb(255 198 212 / 0.415) 35%, rgb(255 198 212 / 0.234) 50%, rgb(255 198 212 / 0.108) 65%, rgb(255 198 212 / 0.04) 80%, rgb(255 198 212 / 0) 100%), radial-gradient(85% 38% at 100% 100%, rgb(255 215 180 / 0.8) 0%, rgb(255 215 180 / 0.668) 20%, rgb(255 215 180 / 0.461) 35%, rgb(255 215 180 / 0.26) 50%, rgb(255 215 180 / 0.12) 65%, rgb(255 215 180 / 0.045) 80%, rgb(255 215 180 / 0) 100%), #fff7ee",
    tone: "light",
    text: "#140a24",
    dim: "#573629",
    accent: "#842c0d",
    tick: "#842c0d",
    ink: "#842c0d",
    signal: "#d45a1a",
  },
};

/**
 * Enterprise: Scale's champagne, a shade more golden — the top of the
 * climb. Pixel radii, so the wide band and the rail card render alike.
 */
export const ENTERPRISE_LIGHT = {
  ground:
    "radial-gradient(520px 200px at 18% 0%, rgb(255 255 255 / 0.8) 0%, rgb(255 255 255 / 0.668) 20%, rgb(255 255 255 / 0.461) 35%, rgb(255 255 255 / 0.26) 50%, rgb(255 255 255 / 0.12) 65%, rgb(255 255 255 / 0.045) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(460px 280px at 0% 20%, rgb(255 217 138 / 0.9) 0%, rgb(255 217 138 / 0.752) 20%, rgb(255 217 138 / 0.519) 35%, rgb(255 217 138 / 0.292) 50%, rgb(255 217 138 / 0.134) 65%, rgb(255 217 138 / 0.051) 80%, rgb(255 217 138 / 0) 100%), radial-gradient(460px 260px at 34% 100%, rgb(255 231 166 / 0.85) 0%, rgb(255 231 166 / 0.71) 20%, rgb(255 231 166 / 0.49) 35%, rgb(255 231 166 / 0.276) 50%, rgb(255 231 166 / 0.127) 65%, rgb(255 231 166 / 0.048) 80%, rgb(255 231 166 / 0) 100%), radial-gradient(420px 260px at 62% 0%, rgb(255 207 143 / 0.82) 0%, rgb(255 207 143 / 0.685) 20%, rgb(255 207 143 / 0.473) 35%, rgb(255 207 143 / 0.266) 50%, rgb(255 207 143 / 0.122) 65%, rgb(255 207 143 / 0.046) 80%, rgb(255 207 143 / 0) 100%), radial-gradient(460px 280px at 100% 100%, rgb(247 210 122 / 0.85) 0%, rgb(247 210 122 / 0.71) 20%, rgb(247 210 122 / 0.49) 35%, rgb(247 210 122 / 0.276) 50%, rgb(247 210 122 / 0.127) 65%, rgb(247 210 122 / 0.048) 80%, rgb(247 210 122 / 0) 100%), radial-gradient(320px 200px at 86% 30%, rgb(255 240 194 / 0.6) 0%, rgb(255 240 194 / 0.501) 20%, rgb(255 240 194 / 0.346) 35%, rgb(255 240 194 / 0.195) 50%, rgb(255 240 194 / 0.09) 65%, rgb(255 240 194 / 0.034) 80%, rgb(255 240 194 / 0) 100%), #fff8e6",
  tone: "light",
  text: "#140a24",
  dim: "#55401a",
  accent: "#6e4508",
  tick: "#6e4508",
} as const;

/** The estimator panel: a pearl mesh. */
export const PRICING_PANEL =
  "radial-gradient(55% 110% at 0% 0%, rgb(241 230 255 / 0.95) 0%, rgb(241 230 255 / 0.794) 20%, rgb(241 230 255 / 0.547) 35%, rgb(241 230 255 / 0.308) 50%, rgb(241 230 255 / 0.142) 65%, rgb(241 230 255 / 0.053) 80%, rgb(241 230 255 / 0) 100%), radial-gradient(45% 100% at 100% 100%, rgb(255 229 243 / 0.95) 0%, rgb(255 229 243 / 0.794) 20%, rgb(255 229 243 / 0.547) 35%, rgb(255 229 243 / 0.308) 50%, rgb(255 229 243 / 0.142) 65%, rgb(255 229 243 / 0.053) 80%, rgb(255 229 243 / 0) 100%), radial-gradient(35% 80% at 62% 0%, rgb(227 242 255 / 0.6) 0%, rgb(227 242 255 / 0.501) 20%, rgb(227 242 255 / 0.346) 35%, rgb(227 242 255 / 0.195) 50%, rgb(227 242 255 / 0.09) 65%, rgb(227 242 255 / 0.034) 80%, rgb(227 242 255 / 0) 100%), #fcfaff";

/** #pricing's heading key: the five plan inks in plan order. */
export const SPECTRUM_KEY = "linear-gradient(90deg, #0a5566 0%, #3730a3 28%, #a21caf 52%, #5b21b6 76%, #842c0d 100%)";

/** Text and marks on night. */
export const LILAC = HOME_COLORS.lilac;
/** Confirmed, and nothing else. */
export const SETTLED = HOME_COLORS.settled;

/**
 * Violet on paper, the old closing panel.
 * @deprecated #start moves to `.home-deep` (DEEP_PANEL); delete this once start.tsx no longer imports it.
 */
export const STUDIO_PANEL = "radial-gradient(120% 90% at 20% 15%, #ffffff 0%, #f4f3f7 45%, #e4e0ee 75%, #cfc6e4 100%)"; // src: components/site/industry/shader-stage.tsx:102 (HOUSE_POSTER)
