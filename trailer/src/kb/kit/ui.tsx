/**
 * THE APP'S UI PARTS, rebuilt in the house type system at trailer scale (CLIENT DIRECTION v2 §1–3).
 * Each is a pure function of `t` plus hover / press amounts (0..1) that the scene reads from the
 * cursor (kit/cursor.ts hoverAt / pressAt) — so a part never needs to know about the pointer.
 *
 *   APP                the dashboard's tokens (app/globals.css :78–127), with the house inks
 *   meshElevation()    theme.elevation's layered shadow, TINTED by the mesh (kit/mesh.ts meshShadowInk)
 *   <Panel>            a white card on the mesh: real elevation, the mesh's colour in its shadow
 *   <Button>           primary / secondary / outline / ghost (components/ui/button.tsx) and the site's
 *                      "Start free" (EndCard's header button): hover colour, press .97, release spring
 *   <Pill>             the knowledge status pill (TabKnowledge.tsx KnowledgeStatusPill): Reading… /
 *                      Reading page… → Ready · N passages, the change ROLLING through the pill's mask
 *   <DocRow>           a document row (TabKnowledge.tsx DocumentRow): kind token, name, pill, … menu
 *   <Menu> / useMenu() the row's DropdownMenu: opens from its trigger (scale / opacity spring), items
 *                      with hover / press
 *   <FieldCard> / useFieldCard()   the conversation tab's field (TabConversation.tsx): label,
 *                      placeholder, caret, the owner's words typed one per 16th, focus ring, Save
 *   <RecordRow>        the call detail's record (CallDetailSheet.tsx): TRANSCRIPT, the greeting,
 *                      "Answered from your documents" + the document chip, a check drawn in a disc
 *   <Swap>             a panel's content swapping: the old leaves up through the mask, the new rises
 */
import React from 'react';
import { reveal, revealStyle } from '../../components/Type';
import { hexToRgb, mixColor } from '../../lib/lights';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { subpixel } from '../../lib/glide';
import { maskBox, typeStyle } from '../../lib/type';
import { useLayout } from '../../lib/layout';
import { C, TYPE } from '../../theme';
import { HOME } from '../palettes';
import { CURSOR, fold, hoverAt, pressAt, type CursorKey, type Rect } from './cursor';
import { Icon, type IconName } from './icons';
import { layoutWords, measureText, ui, useKitFaces, W, wrapWords } from './type';

/* ── tokens ─────────────────────────────────────────────────────── */

/**
 * The dashboard's colours (app/globals.css :78–127, light theme), with the house inks where the house
 * has the same role (foreground = the site's ink, muted text = the site's muted, primary = electric,
 * the app's own --primary-rgb 124 58 237).
 */
export const APP = {
  background: '#ffffff', // --background
  card: '#ffffff', // --card
  foreground: HOME.ink, // --foreground hsl(263 15% 10%) → the house ink
  mutedFg: HOME.muted, // --muted-foreground hsl(263 15% 50%) → the house muted (darker: reads at trailer scale)
  muted: '#f4f2f7', // --muted hsl(263 20% 96%)
  border: '#e4e0eb', // --border hsl(263 20% 90%)
  ring: 'rgba(17, 10, 36, 0.10)', // the Card's ring-1 ring-foreground/10
  primary: HOME.electric, // --primary-rgb 124 58 237
  primaryStrong: '#6d34cf', // --primary-strong (hover)
  primarySoft: 'rgba(124, 58, 237, 0.15)', // bg-primary/15 (the count badge)
  primaryFg: '#ffffff',
  secondary: '#f4f2f8', // --secondary hsl(263 30% 96%)
  secondaryFg: '#452e6b', // --secondary-foreground hsl(263 40% 30%)
  accent: '#eeebf4', // --accent hsl(263 30% 94%) (menu item hover)
  accentFg: '#4f2d86', // --accent-foreground hsl(263 50% 35%)
  destructive: '#ef4444', // --destructive hsl(0 84% 60%)
  destructiveInk: '#c81e1e', // destructive text on white (a shade deeper, legible at trailer scale)
  amber: '#f59e0b', // amber-500 (the unsaved dot)
  settled: HOME.settled, // Ready (green-700 in the app → the house's "confirmed")
  settledTint: 'rgba(34, 197, 94, 0.10)', // bg-green-500/10
  settledLine: 'rgba(34, 197, 94, 0.30)', // border-green-500/30
  purple: '#9333ea', // purple-600 (the document chip's BookOpen)
} as const;

const rgb = (hex: string) =>
  hexToRgb(hex)
    .map((v) => Math.round(v * 255))
    .join(' ');

/**
 * theme.elevation's layered shadow (contact + key + ambient, never one grey blur), tinted with `ink` —
 * the mesh's own deep (kit/mesh.ts meshShadowInk), so a white card on the knowledge-base mesh casts an
 * indigo shadow. `lift` 0 resting … 6 held high; `k` scales the darkness.
 */
export function meshElevation(lift = 2, ink = '#1e1442', k = 1): string {
  const l = Math.max(0, lift);
  const c = rgb(ink);
  const a = (x: number) => (x * k).toFixed(3);
  return [
    `0 0 0 1px rgb(${c} / ${a(0.07)})`,
    `0 ${(0.5 + l * 0.5).toFixed(1)}px ${(1 + l).toFixed(1)}px rgb(${c} / ${a(0.08)})`,
    `0 ${(2 + l * 4).toFixed(1)}px ${(4 + l * 8).toFixed(1)}px -${(1 + l * 2).toFixed(1)}px rgb(${c} / ${a(0.09)})`,
    `0 ${(6 + l * 14).toFixed(1)}px ${(14 + l * 30).toFixed(1)}px -${(4 + l * 8).toFixed(1)}px rgb(${c} / ${a(0.12)})`,
    `0 ${(14 + l * 30).toFixed(1)}px ${(30 + l * 60).toFixed(1)}px -${(10 + l * 18).toFixed(1)}px rgb(${c} / ${a(0.12)})`,
  ].join(', ');
}

/* ── Panel ──────────────────────────────────────────────────────── */

export type PanelProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** corner radius px (default: the app's rounded-xl at trailer scale, 40 / 34) */
  radius?: number;
  /** elevation lift (0..6) */
  lift?: number;
  /** the shadow's ink (meshShadowInk(palette)) */
  ink?: string;
  /** shadow darkness × */
  k?: number;
  /** extra transform on top of the position (a step back, a slide): applied about the panel's centre */
  dx?: number;
  dy?: number;
  scale?: number;
  /** a shade over the whole card (stepping back a depth), 0..1 */
  shade?: number;
  opacity?: number;
  /** clip the content to the rounded card (default true) */
  clip?: boolean;
  background?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/** A white card on the mesh, positioned by TRANSFORM (sub-pixel exact while it moves). */
export const Panel: React.FC<PanelProps> = ({ x, y, w, h, radius, lift = 2, ink, k = 1, dx = 0, dy = 0, scale = 1, shade = 0, opacity = 1, clip = true, background = APP.card, children, style }) => {
  const L = useLayout();
  const r = radius ?? L.pick(40, 34);
  const moving = Math.abs(scale - 1) > 1e-5 || Math.abs(dx % 1) > 1e-3 || Math.abs(dy % 1) > 1e-3;
  const tf = `translate(${(x + dx).toFixed(3)}px, ${(y + dy).toFixed(3)}px)${Math.abs(scale - 1) > 1e-5 ? ` scale(${scale.toFixed(5)})` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        borderRadius: r,
        background,
        boxShadow: meshElevation(lift, ink, k),
        overflow: clip ? 'hidden' : undefined,
        transformOrigin: '50% 50%',
        opacity: opacity >= 0.999 ? undefined : opacity,
        ...subpixel(tf, moving),
        ...style,
      }}
    >
      {children}
      {shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(20, 10, 36, ${shade.toFixed(4)})`, pointerEvents: 'none' }} /> : null}
    </div>
  );
};

/* ── Button ─────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'site';

/** the site header's "Start free" plate (scenes/cta/EndCard.tsx StartFree: --cover-paper, hover → plum) */
const SITE = { plate: C.coverPaper, ink: '#06040a', hover: C.plum, hoverInk: C.coverPaper } as const;

const lerpCss = (a: string, b: string, u: number) => (u <= 0 ? a : u >= 1 ? b : mixColor(a, b, u));

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  /** label size px (default 32 / 30); height, padding, radius follow the app's proportions */
  size?: number;
  icon?: IconName;
  /** 0..1 from hoverAt */
  hover?: number;
  /** 0..1 from pressAt */
  press?: number;
  /** a done state (Saved): the label is replaced by a check + `doneLabel`, rolling */
  done?: { at: number; t: number; label?: string };
  width?: number;
  style?: React.CSSProperties;
};

/** Button geometry for a label (to aim the cursor before rendering). */
export function buttonSize(label: string, variant: ButtonVariant = 'primary', size = 32, icon = false): { w: number; h: number } {
  const r = size / 14;
  if (variant === 'site') {
    const w = measureText(`${label} →`, { size, weight: 500 }) + 2 * 1.125 * size + 0.4 * size;
    return { w, h: 2.25 * size };
  }
  return { w: measureText(label, { size, weight: W.medium }) + 2 * 10 * r + (icon ? 16 * r + 6 * r : 0), h: 32 * r };
}

export const Button: React.FC<ButtonProps> = ({ label, variant = 'primary', size: sizeProp, icon, hover = 0, press = 0, done, width, style }) => {
  const L = useLayout();
  const size = sizeProp ?? L.pick(32, 30);
  const r = size / 14;
  const sc = 1 - (1 - CURSOR.targetScale) * press;
  const moving = Math.abs(sc - 1) > 1e-4;
  if (variant === 'site') {
    return (
      <div
        style={{
          ...ui(size, 500, { tracking: -0.01 }),
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4em',
          height: '2.25em',
          padding: '0 1.125em',
          borderRadius: '0.5em',
          background: lerpCss(SITE.plate, SITE.hover, hover),
          color: lerpCss(SITE.ink, SITE.hoverInk, hover),
          width,
          justifyContent: 'center',
          lineHeight: 1,
          ...subpixel(moving ? `scale(${sc.toFixed(5)})` : undefined, moving),
          ...style,
        }}
      >
        <span>{label}</span>
        <span style={{ display: 'inline-block', transform: hover > 1e-4 ? `translateX(${(0.2 * hover).toFixed(4)}em)` : undefined }}>→</span>
      </div>
    );
  }
  const look = {
    primary: { bg: lerpCss(APP.primary, APP.primaryStrong, hover), fg: APP.primaryFg, border: 'transparent' },
    secondary: { bg: lerpCss(APP.secondary, '#e9e5f2', hover), fg: APP.secondaryFg, border: 'transparent' },
    outline: { bg: lerpCss(APP.background, APP.muted, hover), fg: APP.foreground, border: APP.border },
    ghost: { bg: hover > 0.001 ? `rgba(244, 242, 247, ${hover.toFixed(3)})` : 'transparent', fg: APP.foreground, border: 'transparent' },
  }[variant];
  // the pressed shade (active): a touch deeper
  const pressedBg = press > 0.001 ? mixColor(look.bg.startsWith('#') ? look.bg : APP.muted, '#000000', 0.08 * press) : look.bg;
  const d = done && done.t >= done.at ? springUnit(done.t - done.at, SPRING.caption) : 0;
  return (
    <div
      style={{
        ...ui(size, W.medium),
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6 * r,
        height: 32 * r,
        padding: `0 ${10 * r}px`,
        borderRadius: 12 * r * 0.75,
        background: pressedBg,
        color: look.fg,
        boxShadow: look.border !== 'transparent' ? `inset 0 0 0 1.25px ${look.border}` : undefined,
        overflow: 'hidden',
        width,
        lineHeight: 1,
        ...subpixel(moving ? `scale(${sc.toFixed(5)})` : undefined, moving),
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 * r, transform: d > 0 ? `translateY(${(-d * 120).toFixed(2)}%)` : undefined, opacity: d > 0 ? 1 - smooth(0, 0.6, d) : undefined }}>
        {icon ? <Icon name={icon} size={16 * r} /> : null}
        <span>{label}</span>
      </span>
      {d > 0 ? (
        <span style={{ position: 'absolute', inset: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 * r, transform: `translateY(${((1 - d) * 120).toFixed(2)}%)` }}>
          <CheckMark size={16 * r} t={done!.t} at={done!.at + 1} color={look.fg} />
          {done!.label ? <span>{done!.label}</span> : null}
        </span>
      ) : null}
    </div>
  );
};

/** A check that draws itself (stroke-dashoffset, power3.out over 6 frames). */
export const CheckMark: React.FC<{ size: number; t: number; at: number; color?: string; stroke?: number }> = ({ size, t, at, color = 'currentColor', stroke = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
    <path
      d="M20 6 9 17l-5-5"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1 2"
      strokeDashoffset={1 - tween(t, [at, at + 6], [0, 1], EASE.out3)}
    />
  </svg>
);

/* ── Pill ───────────────────────────────────────────────────────── */

export type PillState = { at: number; kind: 'reading' | 'readingPage' | 'readingAgain' | 'ready'; n?: number };

const pillText = (s: PillState) =>
  s.kind === 'ready' ? `Ready · ${s.n ?? 1} ${(s.n ?? 1) === 1 ? 'passage' : 'passages'}` : s.kind === 'readingPage' ? 'Reading page…' : s.kind === 'readingAgain' ? 'Reading again…' : 'Reading…';

/** the pill's colours, composited on the white row (so a change crosses colour to colour, never through a translucent veil) */
const pillLook = (s: PillState) =>
  s.kind === 'ready'
    ? { bg: '#e9f9ef', line: '#bdeecf', fg: APP.settled, icon: 'circleCheck' as IconName } // green-500/10, green-500/30 on white
    : { bg: APP.secondary, line: APP.secondary, fg: APP.secondaryFg, icon: 'loader' as IconName };

/** the pill's own roll (quick, settled ≈ 7 frames) */
const PILL_ROLL = { stiffness: 340, damping: 30, mass: 1 };

/**
 * The status pill. `states` over time (sorted). Each change ROLLS: the old label and icon leave up
 * through the pill's mask as the new ones rise into it, the pill's width springs to the new label, the
 * tint / keyline / ink cross over. The spinner turns at the app's animate-spin (1 turn / s).
 */
export const Pill: React.FC<{ t: number; states: readonly PillState[]; size?: number; style?: React.CSSProperties }> = ({ t, states, size: sizeProp, style }) => {
  const L = useLayout();
  useKitFaces();
  const size = sizeProp ?? L.pick(28, 28);
  let i = 0;
  for (let k = 0; k < states.length; k++) if (states[k].at <= t) i = k;
  const cur = states[i];
  const prev = i > 0 ? states[i - 1] : null;
  const roll = prev ? springUnit(t - cur.at, PILL_ROLL) : 1;
  const em = size;
  const textW = (s: PillState) => measureText(pillText(s), { size, weight: W.medium });
  const inner = (s: PillState) => em * 1.0 + 0.33 * em + textW(s);
  const wNow = prev ? inner(prev) + (inner(cur) - inner(prev)) * Math.min(1, roll) : inner(cur);
  const A = pillLook(cur);
  const B = prev ? pillLook(prev) : A;
  const u = Math.min(1, roll);
  const bg = prev ? mixColor(B.bg, A.bg, u) : A.bg;
  const line = prev ? mixColor(B.line, A.line, u) : A.line;
  const fg = prev ? mixColor(B.fg, A.fg, u) : A.fg;
  const content = (s: PillState, y: number, o: number) => {
    const L2 = pillLook(s);
    return (
      <span
        style={{
          position: 'absolute',
          left: 0.67 * em,
          top: 0,
          height: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.33 * em,
          transform: Math.abs(y) > 0.01 ? `translateY(${y.toFixed(2)}%)` : undefined,
          opacity: o >= 0.999 ? undefined : o,
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name={L2.icon} size={em} stroke={2.2} rotate={L2.icon === 'loader' ? ((t / 30) * 360) % 360 : undefined} />
        <span>{pillText(s)}</span>
      </span>
    );
  };
  return (
    <span
      style={{
        ...ui(size, W.medium),
        position: 'relative',
        display: 'inline-block',
        verticalAlign: 'middle',
        height: 1.72 * em,
        width: wNow + 2 * 0.67 * em,
        borderRadius: 999,
        background: bg,
        boxShadow: `inset 0 0 0 1.25px ${line}`,
        color: fg,
        overflow: 'hidden',
        lineHeight: 1,
        ...style,
      }}
    >
      {prev && roll < 0.999 ? content(prev, -115 * u, 1 - smooth(0.15, 0.7, u)) : null}
      {content(cur, prev ? 115 * (1 - u) : 0, prev ? smooth(0.1, 0.6, u) : 1)}
    </span>
  );
};

/** mix two css colours that may be rgba(...) */
function mixRgba(a: string, b: string, u: number): string {
  const p = (c: string): [number, number, number, number] => {
    if (c.startsWith('#')) {
      const [r, g, bb] = hexToRgb(c);
      return [r * 255, g * 255, bb * 255, 1];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    const v = (m ? m[1] : '0,0,0,0').split(/[ ,/]+/).filter(Boolean).map(Number);
    return [v[0], v[1], v[2], v[3] ?? 1];
  };
  const A = p(a);
  const B = p(b);
  const q = A.map((x, k) => x + (B[k] - x) * u);
  return `rgba(${q[0].toFixed(1)}, ${q[1].toFixed(1)}, ${q[2].toFixed(1)}, ${q[3].toFixed(3)})`;
}

/* ── DocRow ─────────────────────────────────────────────────────── */

export type DocKind = 'pdf' | 'docx' | 'txt' | 'url';
const KIND_TOKEN: Record<DocKind, string> = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT', url: 'URL' };

export type DocRowProps = {
  t: number;
  /** the row's top-left (frame px or parent px) and width */
  x: number;
  y: number;
  w: number;
  kind: DocKind;
  name: string;
  pill?: readonly PillState[];
  /** name size px (default the house title role 64 / 56 × .8) — everything else follows it */
  size?: number;
  /** the … button's hover / press (0..1) */
  menuHover?: number;
  menuPress?: number;
  /** lands at (rises into place on SPRING.land, a sub-pixel glide) */
  landAt?: number;
  /** leaves up through its mask at */
  exitAt?: number;
  /** a row hover (hover:bg-muted/30) */
  hover?: number;
  style?: React.CSSProperties;
};

/** the pill's size in a row of name size `size` (never under 26 px) */
export const rowPillSize = (size: number) => Math.max(26, Math.round(size * 0.6));
/** A row's height for its name size (to stack rows): padding, the name, a gap, the pill, padding. */
export const docRowHeight = (size: number) => Math.round(size * 0.36 * 2 + size * 1.05 + size * 0.22 + rowPillSize(size) * 1.72);

/** The … button's rect inside a row at (x, y, w) — to aim the cursor. */
export function docRowMenuRect(x: number, y: number, w: number, size: number): Rect & { cx: number; cy: number } {
  const b = size * 1.05;
  const pad = size * 0.42;
  const rx = x + w - pad - b;
  const ry = y + (docRowHeight(size) - b) / 2;
  return { x: rx, y: ry, w: b, h: b, cx: rx + b / 2, cy: ry + b / 2 };
}

export const DocRow: React.FC<DocRowProps> = ({ t, x, y, w, kind, name, pill, size: sizeProp, menuHover = 0, menuPress = 0, landAt, exitAt, hover = 0, style }) => {
  const L = useLayout();
  const size = sizeProp ?? Math.round(typeStyle('title', L.vertical).fontSize as number * 0.8);
  const h = docRowHeight(size);
  const pad = size * 0.42;
  const tokenSize = Math.max(24, Math.round(size * 0.5));
  const tile = size * 1.5;
  // one tile width for every kind (the widest token, DOCX), so the names line up down the list
  const tileW = Math.max(tile, measureText('DOCX', { size: tokenSize, weight: TYPE.label.weight, tracking: 0.08 }) + size * 0.6);
  // the landing: down into place on the house landing spring, fading in over its first 30 %
  let dy = 0;
  let o = 1;
  let sc = 1;
  if (landAt !== undefined) {
    if (t < landAt - 0.5) return null;
    const s = springUnit(t - landAt, SPRING.land);
    dy = -(1 - s) * 0.32 * h;
    o = smooth(0, 0.3, s);
    sc = mix(0.985, 1, Math.min(1, s));
  }
  if (exitAt !== undefined && t > exitAt) {
    const q = tween(t, [exitAt, exitAt + 9], [0, 1], EASE.in3);
    dy -= q * 0.45 * h;
    o *= 1 - smooth(0.2, 1, q);
    if (o <= 0.001) return null;
  }
  const moving = Math.abs(dy) > 0.02 || Math.abs(sc - 1) > 1e-4;
  const mb = docRowMenuRect(0, 0, w, size);
  const msc = 1 - (1 - CURSOR.targetScale) * menuPress;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        borderRadius: size * 0.32,
        background: hover > 0.001 ? `rgba(244, 242, 247, ${(0.3 * hover + 0.0).toFixed(3)})` : APP.card,
        boxShadow: `inset 0 0 0 1.25px ${APP.border}`,
        opacity: o >= 0.999 ? undefined : o,
        transformOrigin: '50% 50%',
        ...subpixel(`translate(${x.toFixed(3)}px, ${(y + dy).toFixed(3)}px)${Math.abs(sc - 1) > 1e-5 ? ` scale(${sc.toFixed(5)})` : ''}`, moving),
        ...style,
      }}
    >
      {/* the kind tile: the app's muted square, carrying the kind token (label role) */}
      <div
        style={{
          position: 'absolute',
          left: pad,
          top: (h - tile) / 2,
          width: tileW,
          height: tile,
          borderRadius: size * 0.24,
          background: APP.muted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...typeStyle('label', L.vertical, { size: tokenSize }),
          letterSpacing: '0.08em',
          color: APP.mutedFg,
        }}
      >
        {KIND_TOKEN[kind]}
      </div>
      <div style={{ position: 'absolute', left: pad * 2 + tileW, top: 0, height: h, right: pad * 2 + mb.w, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: size * 0.22 }}>
        <div style={{ ...typeStyle('title', L.vertical, { size }), color: APP.foreground, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.05 }}>{name}</div>
        {pill ? (
          <div style={{ display: 'flex' }}>
            <Pill t={t} states={pill} size={rowPillSize(size)} />
          </div>
        ) : null}
      </div>
      {/* the … trigger: size-8 rounded-md, hover:bg-muted */}
      <div
        style={{
          position: 'absolute',
          left: mb.x,
          top: mb.y,
          width: mb.w,
          height: mb.h,
          borderRadius: size * 0.22,
          background: menuHover > 0.001 || menuPress > 0.001 ? mixRgba('rgba(244,242,247,0)', menuPress > 0.001 ? 'rgba(233,229,242,1)' : 'rgba(244,242,247,1)', Math.max(menuHover, menuPress)) : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: APP.foreground,
          transform: Math.abs(msc - 1) > 1e-4 ? `scale(${msc.toFixed(5)})` : undefined,
        }}
      >
        <Icon name="ellipsis" size={size * 0.56} stroke={2.4} />
      </div>
    </div>
  );
};

/* ── Menu ───────────────────────────────────────────────────────── */

export type MenuItem = { label: string; icon: IconName; destructive?: boolean; separatorBefore?: boolean };

/** TabKnowledge.tsx:600–618 — a file document's menu */
export const DOC_MENU: readonly MenuItem[] = [
  { label: 'Read again', icon: 'refresh' },
  { label: 'Replace with new file', icon: 'replace' },
  { label: 'Remove', icon: 'trash', destructive: true, separatorBefore: true },
];

export type MenuSpec = {
  /** the trigger's bottom-right corner (the menu opens below it, right-aligned: align="end") */
  x: number;
  y: number;
  items?: readonly MenuItem[];
  /** item label size px (default 32 / 30) */
  size?: number;
  /** width px (default the app's w-48 at scale) */
  width?: number;
};

export type MenuGeometry = { box: Rect; items: (Rect & { cx: number; cy: number })[]; spec: Required<MenuSpec> };

/** The menu's geometry (to aim the cursor at an item). */
export function useMenu(spec: MenuSpec): MenuGeometry {
  const L = useLayout();
  const size = spec.size ?? L.pick(32, 30);
  const r = size / 14;
  const items = spec.items ?? DOC_MENU;
  const width = spec.width ?? Math.max(192 * r, ...items.map((it) => measureText(it.label, { size, weight: W.regular + 20 }) + 16 * r + 6 * r + 2 * 6 * r + 2 * 4 * r + 8 * r));
  const itemH = 30 * r;
  const sepH = 9 * r;
  const padY = 4 * r;
  let y = spec.y + 6 * r + padY;
  const left = spec.x - width;
  const rects = items.map((it) => {
    if (it.separatorBefore) y += sepH;
    const rr = { x: left + 4 * r, y, w: width - 8 * r, h: itemH, cx: left + width / 2, cy: y + itemH / 2 };
    y += itemH;
    return rr;
  });
  const h = y + padY - (spec.y + 6 * r);
  return { box: { x: left, y: spec.y + 6 * r, w: width, h }, items: rects, spec: { x: spec.x, y: spec.y, items, size, width } };
}

/** the menu opening (zoom-in-95 + fade-in + slide-in-from-top-2, as a spring) */
const MENU_OPEN = { stiffness: 480, damping: 32, mass: 1 };

export const Menu: React.FC<{
  menu: MenuGeometry;
  t: number;
  openAt: number;
  closeAt?: number;
  cursor?: readonly CursorKey[];
  /** the shadow ink */
  ink?: string;
}> = ({ menu, t, openAt, closeAt, cursor = [], ink }) => {
  if (t < openAt) return null;
  const { box, items, spec } = menu;
  const r = spec.size / 14;
  const s = springUnit(t - openAt, MENU_OPEN);
  let o = smooth(0, 0.45, s);
  let sc = mix(0.95, 1, Math.min(1.02, s));
  let dy = (1 - Math.min(1, s)) * -8 * r;
  if (closeAt !== undefined && t > closeAt) {
    const q = tween(t, [closeAt, closeAt + 5], [0, 1], EASE.out3);
    o *= 1 - q;
    sc *= 1 - 0.05 * q;
    dy += -4 * r * q;
    if (o <= 0.001) return null;
  }
  const moving = Math.abs(sc - 1) > 1e-4 || Math.abs(dy) > 0.02;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: box.w,
        height: box.h,
        borderRadius: 12 * r * 0.85,
        background: APP.card,
        boxShadow: `${meshElevation(3.2, ink, 1.05)}, 0 0 0 1px ${APP.ring}`,
        opacity: o >= 0.999 ? undefined : o,
        transformOrigin: '100% 0%',
        ...subpixel(`translate(${box.x.toFixed(3)}px, ${(box.y + dy).toFixed(3)}px) scale(${sc.toFixed(5)})`, moving),
      }}
    >
      {spec.items.map((it, i) => {
        const R = items[i];
        const hv = cursor.length ? hoverAt(cursor, t, R) : 0;
        const pr = cursor.length ? pressAt(cursor, t, R) : 0;
        const lx = R.x - box.x;
        const ly = R.y - box.y;
        const fg = it.destructive ? APP.destructiveInk : mixColor(APP.foreground, APP.accentFg, hv);
        const bg = it.destructive ? `rgba(239, 68, 68, ${(0.1 * Math.max(hv, pr)).toFixed(3)})` : mixRgba('rgba(238,235,244,0)', 'rgba(238,235,244,1)', Math.max(hv, pr));
        const isc = 1 - 0.015 * pr;
        return (
          <React.Fragment key={it.label}>
            {it.separatorBefore ? <div style={{ position: 'absolute', left: 0, right: 0, top: ly - 4.5 * r - 0.5, height: 1.25, background: APP.border }} /> : null}
            <div
              style={{
                position: 'absolute',
                left: lx,
                top: ly,
                width: R.w,
                height: R.h,
                borderRadius: 8 * r * 0.75,
                background: pr > 0.001 ? mixColor('#eeebf4', '#e2ddec', pr) : bg,
                display: 'flex',
                alignItems: 'center',
                gap: 6 * r,
                padding: `0 ${6 * r}px`,
                boxSizing: 'border-box',
                color: fg,
                ...ui(spec.size, W.regular + 20),
                transform: Math.abs(isc - 1) > 1e-4 ? `scale(${isc.toFixed(5)})` : undefined,
              }}
            >
              <Icon name={it.icon} size={16 * r} color={it.destructive ? APP.destructiveInk : fg} />
              <span>{it.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ── FieldCard ──────────────────────────────────────────────────── */

export type FieldCardSpec = {
  x: number;
  y: number;
  w: number;
  /** the field's label (sentence case, the app's Label: medium weight) */
  label: string;
  placeholder: string;
  /** the owner's words */
  text: string;
  /** field text size px (default the house title role, 52 / 46 — two lines in 16:9) */
  size?: number;
  /** label size px (default 32 / 30) */
  labelSize?: number;
  /** show a Save button under the field */
  save?: boolean;
  /** visible rows of the field (default: as many as text or placeholder need) */
  rows?: number;
};

export type FieldCardGeometry = {
  spec: Required<FieldCardSpec>;
  card: Rect;
  field: Rect & { cx: number; cy: number };
  save: (Rect & { cx: number; cy: number }) | null;
  /** the text's lines (words), wrapped to the field */
  lines: string[][];
  placeholderLines: string[][];
  lineH: number;
  padX: number;
  padY: number;
};

export function useFieldCard(spec: FieldCardSpec): FieldCardGeometry {
  const L = useLayout();
  useKitFaces();
  const size = spec.size ?? L.pick(52, 46);
  const labelSize = spec.labelSize ?? L.pick(32, 30);
  const r = labelSize / 14;
  const pad = 24 * r * 0.9;
  const padX = 12 * r;
  const padY = 9 * r;
  const fieldW = spec.w - 2 * pad;
  const tSpec = { size, weight: TYPE.title.weight, tracking: -0.02 };
  const lines = wrapWords(spec.text, tSpec, fieldW - 2 * padX);
  const placeholderLines = wrapWords(spec.placeholder, tSpec, fieldW - 2 * padX);
  const lineH = size * 1.22;
  const rows = spec.rows ?? Math.max(lines.length, placeholderLines.length);
  const fieldH = rows * lineH + 2 * padY;
  const labelH = labelSize * 1.2;
  const fieldY = spec.y + pad + labelH + 10 * r;
  const field = { x: spec.x + pad, y: fieldY, w: fieldW, h: fieldH, cx: spec.x + pad + fieldW / 2, cy: fieldY + fieldH / 2 };
  const save = spec.save !== false ? (() => {
    // the button is as wide as its done state ("✓ Saved"), so the label never clips when it rolls
    const b0 = buttonSize('Save', 'primary', labelSize);
    const b = { w: Math.max(b0.w, buttonSize('Saved', 'primary', labelSize, true).w), h: b0.h };
    const bx = spec.x + spec.w - pad - b.w;
    const by = fieldY + fieldH + 14 * r;
    return { x: bx, y: by, w: b.w, h: b.h, cx: bx + b.w / 2, cy: by + b.h / 2 };
  })() : null;
  const cardH = (save ? save.y + save.h : fieldY + fieldH) + pad - spec.y;
  return {
    spec: { ...spec, size, labelSize, save: spec.save !== false, rows },
    card: { x: spec.x, y: spec.y, w: spec.w, h: cardH },
    field,
    save,
    lines,
    placeholderLines,
    lineH,
    padX,
    padY,
  };
}

/**
 * The field card. The owner's words type ONE PER 16th from `typeAt` (`step` frames apart, 3.75 = a
 * 16th at 120 BPM), each rising into its own mask; the caret glides to the end of each new word, solid
 * while typing and blinking on the beat (15 frames) when idle. The placeholder clears on the first word.
 * The field takes the app's focus ring on `focusAt` (border → ring, a 3 px ring at 50 %), and an accent
 * ring can settle round it (`accentRing`: it closes in from 10 px out on a soft spring).
 */
export const FieldCard: React.FC<{
  field: FieldCardGeometry;
  t: number;
  typeAt: number;
  step?: number;
  focusAt?: number;
  blurAt?: number;
  accentRing?: { at: number; color: string };
  cursor?: readonly CursorKey[];
  /** Save clicked: the button shows a drawn check + "Saved" from here */
  savedAt?: number;
  ink?: string;
  lift?: number;
  dx?: number;
  dy?: number;
  opacity?: number;
}> = ({ field: g, t, typeAt, step = 3.75, focusAt, blurAt, accentRing, cursor = [], savedAt, ink, lift = 2, dx = 0, dy = 0, opacity = 1 }) => {
  const L = useLayout();
  const { spec, card, field, save } = g;
  const r = spec.labelSize / 14;
  const tSpec = { size: spec.size, weight: TYPE.title.weight, tracking: -0.02 };
  const words = g.lines.flat();
  const typed = Math.max(0, Math.min(words.length, Math.floor((t - typeAt) / step) + 1));
  const lastAt = typeAt + (words.length - 1) * step;
  // focus: the app's ring (border → ring colour, ring-3 ring-ring/50)
  const focus = focusAt !== undefined ? fold([{ at: focusAt, to: 1, dur: CURSOR.hoverDur }, ...(blurAt !== undefined ? [{ at: blurAt, to: 0, dur: 6 }] : [])], 0, t) : 0;
  const accent = accentRing && t >= accentRing.at ? springUnit(t - accentRing.at, { stiffness: 140, damping: 18, mass: 1 }) : 0;
  const lx = field.x - card.x;
  const ly = field.y - card.y;
  // word positions (relative to the field's text origin)
  let wi = 0;
  const placed = g.lines.map((line, li) => {
    const lay = layoutWords(line.join(' '), tSpec);
    return lay.words.map((w) => ({ ...w, line: li, i: wi++ }));
  });
  const flat = placed.flat();
  // the caret: after the last typed word (glides there as the word rises), or at the start
  const caretPos = (n: number) => (n <= 0 ? { x: 0, line: 0 } : { x: flat[n - 1].x + flat[n - 1].w + 0.06 * spec.size, line: flat[n - 1].line });
  let caret = caretPos(typed);
  if (typed > 0 && t < lastAt + step) {
    const since = t - (typeAt + (typed - 1) * step);
    const pPrev = caretPos(typed - 1);
    const g2 = EASE.out3(Math.min(1, since / 2.2));
    if (pPrev.line === caret.line) caret = { x: pPrev.x + (caret.x - pPrev.x) * g2, line: caret.line };
  }
  const typing = t >= typeAt - 0.5 && t < lastAt + 8;
  const caretOn = focusAt !== undefined && t >= focusAt && (blurAt === undefined || t < blurAt);
  const idleFrom = typing ? Infinity : t < typeAt ? focusAt ?? 0 : lastAt + 8;
  const blink = typing ? 1 : (() => {
    const ph = ((t - idleFrom) % 30 + 30) % 30;
    // on for a beat, off for a beat, with 1.5-frame edges (a blink, not a flicker)
    return ph < 15 ? smooth(0, 1.5, ph) : 1 - smooth(15, 16.5, ph);
  })();
  const placeholderO = 1 - smooth(typeAt - 1, typeAt + 1, t);
  const hov = save && cursor.length ? hoverAt(cursor, t, save) : 0;
  const prs = save && cursor.length ? pressAt(cursor, t, save) : 0;
  return (
    <Panel x={card.x} y={card.y} w={card.w} h={card.h} lift={lift} ink={ink} dx={dx} dy={dy} opacity={opacity} clip={false}>
      <div style={{ position: 'absolute', left: lx, top: ly - spec.labelSize * 1.2 - 10 * r, ...ui(spec.labelSize, W.medium), color: APP.foreground }}>{spec.label}</div>
      {/* the field */}
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: ly,
          width: field.w,
          height: field.h,
          borderRadius: 12 * r * 0.75,
          boxShadow: [
            `inset 0 0 0 1.25px ${mixColor(APP.border, APP.primary, focus)}`,
            focus > 0.001 ? `0 0 0 ${(3 * r * 0.6).toFixed(2)}px rgba(124, 58, 237, ${(0.22 * focus).toFixed(3)})` : '',
            accent > 0.001 ? `0 0 0 ${(2.2 * r * 0.6 + (1 - Math.min(1, accent)) * 10).toFixed(2)}px ${rgbaOf(accentRing!.color, 0.9 * Math.min(1, accent * 1.4) * (1 - 0.4 * Math.max(0, 1 - accent)))}` : '',
          ]
            .filter(Boolean)
            .join(', '),
          background: APP.background,
        }}
      >
        {/* placeholder */}
        {placeholderO > 0.001 ? (
          <div style={{ position: 'absolute', left: g.padX, top: g.padY, opacity: placeholderO, ...typeStyle('title', L.vertical, { size: spec.size }), letterSpacing: '-0.02em', lineHeight: `${g.lineH}px`, color: '#a29bb4' }}>
            {g.placeholderLines.map((ln, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap' }}>
                {ln.join(' ')}
              </div>
            ))}
          </div>
        ) : null}
        {/* the owner's words, one per 16th, each rising into its mask */}
        {flat.map((w) => {
          const at = typeAt + w.i * step;
          if (t < at - 0.5) return null;
          const rv = reveal(t, at, { config: SPRING.caption, rise: 70, fade: 0.5 });
          return (
            <span key={w.i} style={{ position: 'absolute', left: g.padX + w.x, top: g.padY + w.line * g.lineH + (g.lineH - spec.size * 1.12) / 2, ...maskBox(0), ...typeStyle('title', L.vertical, { size: spec.size }), letterSpacing: '-0.02em', color: APP.foreground }}>
              <span style={revealStyle(rv, undefined, t - at < 12)}>{w.text}</span>
            </span>
          );
        })}
        {caretOn ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: Math.max(2, 0.06 * spec.size),
              height: spec.size * 1.08,
              background: APP.foreground,
              opacity: blink,
              ...subpixel(`translate(${(g.padX + caret.x).toFixed(3)}px, ${(g.padY + caret.line * g.lineH + (g.lineH - spec.size * 1.08) / 2).toFixed(3)}px)`, typing),
            }}
          />
        ) : null}
      </div>
      {save ? (
        <div style={{ position: 'absolute', left: save.x - card.x, top: save.y - card.y }}>
          <Button label="Save" variant="primary" size={spec.labelSize} hover={hov} press={prs} done={savedAt !== undefined ? { at: savedAt, t, label: 'Saved' } : undefined} width={save.w} />
        </div>
      ) : null}
    </Panel>
  );
};

/**
 * The keystroke times of a FieldCard's typing (one per word, `step` apart from `typeAt`) — for the cue
 * sheet (one key sound per word) and for anything that must land on a word.
 */
export const typingTimes = (field: FieldCardGeometry, typeAt: number, step = 3.75): number[] => field.lines.flat().map((_, i) => typeAt + i * step);

const rgbaOf = (hex: string, a: number) => `rgb(${rgb(hex)} / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/* ── RecordRow ──────────────────────────────────────────────────── */

/**
 * The call's record, as the call detail shows it (CallDetailSheet.tsx:185–202): a white card with the
 * meta TRANSCRIPT, the greeting's first row dim (the AI disclosure: "Ava: This is Ava, an AI
 * assistant."), the section title "Answered from your documents" and the document chip (BookOpen in
 * purple-600, the name), and a white check drawn in the accent disc (the Flow check idiom). Lands on
 * the house landing spring at `at`; the check pops and draws at `checkAt`.
 */
export const RecordRow: React.FC<{
  t: number;
  x: number;
  y: number;
  w: number;
  at: number;
  checkAt: number;
  /** the check disc's colour (the act's accent) */
  accent: string;
  /** body size px (default 44 / 40) */
  size?: number;
  meta?: string;
  first?: { time: string; text: string };
  section?: string;
  chip?: string;
  ink?: string;
  exitAt?: number;
}> = ({ t, x, y, w, at, checkAt, accent, size: sizeProp, meta = 'TRANSCRIPT', first = { time: '00:00', text: 'Ava: This is Ava, an AI assistant.' }, section = 'Answered from your documents', chip = 'Opening hours', ink, exitAt }) => {
  const L = useLayout();
  if (t < at - 0.5) return null;
  const size = sizeProp ?? L.pick(44, 40);
  const pad = size * 0.78;
  const s = springUnit(t - at, SPRING.land);
  let dy = (1 - s) * size * 1.6;
  let o = smooth(0, 0.3, s);
  if (exitAt !== undefined && t > exitAt) {
    const q = tween(t, [exitAt, exitAt + 9], [0, 1], EASE.in3);
    dy -= q * size * 2;
    o *= 1 - smooth(0.2, 1, q);
    if (o <= 0.001) return null;
  }
  const labelSize = Math.round(typeStyle('label', L.vertical).fontSize as number);
  const disc = size * 1.45;
  const chipSize = Math.round(size * 0.72);
  const h = pad * 2 + labelSize * 1.2 + size * 0.5 + size * 1.25 + size * 0.55 + size * 1.2 + size * 0.3 + chipSize * 2.0;
  const pop = t >= checkAt - 1 ? springUnit(t - (checkAt - 1), { stiffness: 360, damping: 19, mass: 0.6 }) : 0;
  return (
    <Panel x={x} y={y} w={w} h={h} dy={dy} lift={2.4} ink={ink} opacity={o} clip={false}>
      <div style={{ position: 'absolute', left: pad, top: pad, ...typeStyle('label', L.vertical), color: APP.mutedFg }}>{meta}</div>
      <div style={{ position: 'absolute', left: pad, top: pad + labelSize * 1.2 + size * 0.5, display: 'flex', gap: size * 0.5, alignItems: 'baseline', ...ui(size, W.regular, { tracking: -0.015 }), color: APP.mutedFg, opacity: 0.85 }}>
        <span style={{ ...ui(size * 0.8, 460, { mono: true }), color: APP.mutedFg }}>{first.time}</span>
        <span>{first.text}</span>
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, top: pad + labelSize * 1.2 + size * 0.5 + size * 1.25 + size * 0.55, height: 1.25, background: APP.border }} />
      <div style={{ position: 'absolute', left: pad, top: pad + labelSize * 1.2 + size * 0.5 + size * 1.25 + size * 0.55 + size * 0.5, ...ui(size, W.medium, { tracking: -0.015 }), color: APP.foreground }}>{section}</div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          top: pad + labelSize * 1.2 + size * 0.5 + size * 1.25 + size * 0.55 + size * 0.5 + size * 1.2 + size * 0.3,
          display: 'inline-flex',
          alignItems: 'center',
          gap: chipSize * 0.35,
          height: chipSize * 1.9,
          padding: `0 ${chipSize * 0.6}px`,
          borderRadius: chipSize * 0.42,
          boxShadow: `inset 0 0 0 1.25px ${APP.border}`,
          background: APP.background,
          ...ui(chipSize, W.medium),
          color: APP.foreground,
        }}
      >
        <Icon name="bookOpen" size={chipSize * 1.05} color={APP.purple} />
        <span>{chip}</span>
      </div>
      {/* the check in the accent disc */}
      <div
        style={{
          position: 'absolute',
          right: pad,
          top: pad,
          width: disc,
          height: disc,
          borderRadius: '50%',
          background: accent,
          transform: `scale(${Math.max(0, pop).toFixed(4)})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {pop > 0 ? <CheckMark size={disc * 0.56} t={t} at={checkAt} color="#ffffff" stroke={3} /> : null}
      </div>
    </Panel>
  );
};

/* ── Swap ───────────────────────────────────────────────────────── */

/**
 * A panel's content swapping at `at`: the old content leaves UP through the box's mask (power3.in,
 * fading in its second half), the new one rises into it on the text spring — a short masked
 * transition, never a dissolve. `children` = [old, new].
 */
export const Swap: React.FC<{ t: number; at: number; rise?: number; children: [React.ReactNode, React.ReactNode]; style?: React.CSSProperties }> = ({ t, at, rise = 36, children, style }) => {
  // the old content is out of the way (up, faded) before the new one arrives — the two never sit on top of each other
  const outQ = tween(t, [at, at + 5], [0, 1], EASE.in2);
  const inS = springUnit(t - (at + 4), SPRING.text);
  const showOld = outQ < 0.999;
  const showNew = t >= at + 3.5;
  const moving = (showOld && outQ > 0) || (showNew && Math.abs(1 - inS) > 1e-3);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {showOld ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - smooth(0.05, 0.75, outQ), ...subpixel(outQ > 0 ? `translateY(${(-outQ * rise * 0.6).toFixed(3)}px)` : undefined, moving) }}>{children[0]}</div>
      ) : null}
      {showNew ? (
        <div style={{ position: 'absolute', inset: 0, opacity: smooth(0, 0.5, inS), ...subpixel(`translateY(${((1 - inS) * rise).toFixed(3)}px)`, moving) }}>{children[1]}</div>
      ) : null}
    </div>
  );
};
