/**
 * <TabBar> — the agent page's tab bar, rebuilt at trailer scale in the house type system
 * (CLIENT DIRECTION v2 §2). Source: components/agent/AgentPageClient.tsx:383–416 (the strip: border-b
 * bg-card; TabsList variant="line", h-11, gap-0, justify-start) + components/ui/tabs.tsx TabsTrigger
 * (text-sm, gap-1.5, px-4 from sm / px-2.5 on a phone, inactive text-foreground/60 → hover
 * text-foreground, data-active font-medium + full ink, the line variant's 2 px underline) with:
 *   · the five tabs General · Conversation · Voice · Knowledge · Skills and their lucide icons
 *     (Settings2, MessagesSquare, Volume2, BookOpen, Sparkles; icons hidden on a phone — max-sm:hidden —
 *     so the 9:16 bar shows labels only, as the app does);
 *   · Knowledge's count badge (ml-1 size-4 rounded-full bg-primary/15 text-[10px] font-semibold
 *     text-primary) — it APPEARS (its slot opening on a spring, so the tabs after it slide over) and
 *     TICKS (the old digit rolls up out of the disc, the new one rolls in, a small pop on each);
 *   · the amber unsaved-changes dot (size-1.5 rounded-full bg-amber-500) on a tab with unsaved edits.
 *
 * Every proportion is the app's, scaled by r = size / 14 (the app's text-sm): bar 44r tall, icon 16r,
 * padding 16r (10r on a phone), gaps 6r, badge 16r, dot 6r, underline 2r.
 *
 * MOTION (all pure functions of t):
 *   · hover (from the cursor, kit/cursor.ts hoverAt): the label 60 % → 100 % ink over 150 ms;
 *   · press (pressAt): the tab's content to .97 with a pressed shade behind it, then the release spring;
 *   · selection (`active` changes, set them at the click's RELEASE): the new tab takes full ink and the
 *     medium weight over 150 ms, and the underline SLIDES to it on a spring — its leading edge first,
 *     the trailing edge 1.5 frames behind, so it stretches a touch on the way and settles exactly
 *     (ζ ≈ .78, ≈ 2 % overshoot). Sub-pixel exact at 120 fps (it is a box, positioned by transform).
 *
 *   const bar = useTabBar({ x, y, size, badge, dirty });                 // geometry, for aiming the cursor
 *   const keys = [...enter, ...click(46, bar.rect('knowledge', 46).cx, bar.rect('knowledge', 46).cy)];
 *   <TabBar bar={bar} t={t} active={[{ at: 0, tab: 'general' }, { at: 49, tab: 'knowledge' }]} cursor={keys} />
 */
import React from 'react';
import { useLayout } from '../../lib/layout';
import { springUnit } from '../../lib/motion';
import { subpixel } from '../../lib/glide';
import { Icon, type IconName } from './icons';
import { CURSOR, fold, hoverAt, pressAt, type CursorKey, type Rect } from './cursor';
import { measureText, ui, useKitFaces, W } from './type';
import { APP } from './ui';

export type TabKey = 'general' | 'conversation' | 'voice' | 'knowledge' | 'skills';

/** AgentPageClient.tsx:60–66 (TAB_META) — order as AGENT_TABS */
export const TABS: readonly { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'general', label: 'General', icon: 'settings2' },
  { key: 'conversation', label: 'Conversation', icon: 'messagesSquare' },
  { key: 'voice', label: 'Voice', icon: 'volume2' },
  { key: 'knowledge', label: 'Knowledge', icon: 'bookOpen' },
  { key: 'skills', label: 'Skills', icon: 'sparkles' },
];

export type TabChange = { at: number; tab: TabKey };
export type BadgeChange = { at: number; n: number };
export type DirtyChange = { at: number; tab: TabKey; on: boolean };

/** label weights: inactive / active (the app's font-medium on the active tab, a lighter medium off it) */
const WEIGHT_OFF = 470;
const WEIGHT_ON = W.active;
/** the underline's spring (ζ ≈ .85: one soft settle, ≈ .6 % over) and its trailing edge's lag (frames) */
const SLIDE = { stiffness: 200, damping: 24, mass: 1 };
const TRAIL = 0.8;

/** a badge / dot slot opening or closing */
const SLOT = { stiffness: 300, damping: 26, mass: 1 };
/** the badge's digit roll */
const ROLL = { stiffness: 320, damping: 27, mass: 1 };

export type TabBarSpec = {
  /** the strip's left / top edge, frame px */
  x: number;
  y: number;
  /** the strip's width (default: the tabs' own width + its padding) */
  width?: number;
  /** label size px (default 34 / 30) — every other dimension follows it. With icons the bar is ≈ 42 × size wide (≈ 1420 px at 34); without (9:16) ≈ 30 × size */
  size?: number;
  /** icons (default: 16:9 yes, 9:16 no — the app hides them on a phone) */
  icons?: boolean;
  /** Knowledge's count over time (n = 0: no badge) */
  badge?: readonly BadgeChange[];
  /** unsaved-changes dots over time */
  dirty?: readonly DirtyChange[];
  /** the strip's own side padding (default 24r on 16:9, 8r on 9:16 — the app's sm:px-6 / px-2) */
  pad?: number;
};

export type TabBarGeometry = {
  spec: Required<Omit<TabBarSpec, 'badge' | 'dirty' | 'width'>> & { width: number; badge: readonly BadgeChange[]; dirty: readonly DirtyChange[] };
  r: number;
  height: number;
  /** a tab's trigger box at t (its width follows its badge / dot), with its centre */
  rect: (tab: TabKey, t: number) => Rect & { cx: number; cy: number };
  /** the content metrics a tab draws with */
  label: (tab: TabKey) => number;
  badgeN: (t: number) => { n: number; prev: number; at: number; open: number };
  dot: (tab: TabKey, t: number) => number;
};

const last = <T extends { at: number }>(xs: readonly T[], t: number): T | undefined => {
  let v: T | undefined;
  for (const x of xs) if (x.at <= t) v = x;
  return v;
};

/** 0..1 a slot is open at t: each change springs from wherever the previous one had got to */
function slotValue(changes: readonly { at: number; on: boolean }[], i: number, t: number): number {
  if (i < 0) return 0;
  const c = changes[i];
  const from = i > 0 ? slotValue(changes, i - 1, c.at) : 0;
  const to = c.on ? 1 : 0;
  return from + (to - from) * springUnit(t - c.at, SLOT);
}

/** The bar's geometry (measured once the faces are in). */
export function useTabBar(spec: TabBarSpec): TabBarGeometry {
  const L = useLayout();
  useKitFaces();
  const size = spec.size ?? L.pick(34, 30);
  const r = size / 14;
  const icons = spec.icons ?? !L.vertical;
  const pad = spec.pad ?? (L.vertical ? 8 * r : 24 * r);
  const padX = (L.vertical ? 10 : 16) * r;
  const gap = 6 * r;
  const badge = spec.badge ?? [];
  const dirty = spec.dirty ?? [];
  const labelW: Record<TabKey, number> = Object.fromEntries(TABS.map((tb) => [tb.key, measureText(tb.label, { size, weight: WEIGHT_ON })])) as Record<TabKey, number>;
  const badgeSlot = 4 * r + gap + 16 * r;
  const dotSlot = gap + 6 * r;
  const badgeOpen = (t: number) => slotValue(badge.map((b) => ({ at: b.at, on: b.n > 0 })), badge.filter((b) => b.at <= t).length - 1, t);
  const dot = (tab: TabKey, t: number) => {
    const ch = dirty.filter((d) => d.tab === tab).map((d) => ({ at: d.at, on: d.on }));
    return slotValue(ch, ch.filter((c) => c.at <= t).length - 1, t);
  };
  const height = 44 * r;
  const widthOf = (tab: TabKey, t: number) =>
    2 * padX + (icons ? 16 * r + gap : 0) + labelW[tab] + (tab === 'knowledge' ? badgeSlot * Math.max(0, badgeOpen(t)) : 0) + dotSlot * Math.max(0, dot(tab, t));
  const rect = (tab: TabKey, t: number) => {
    let x = spec.x + pad;
    for (const tb of TABS) {
      const w = widthOf(tb.key, t);
      if (tb.key === tab) return { x, y: spec.y, w, h: height, cx: x + w / 2, cy: spec.y + height / 2 };
      x += w;
    }
    throw new Error(`TabBar: unknown tab ${tab}`);
  };
  const natural = TABS.reduce((s, tb) => s + widthOf(tb.key, 0), 0) + 2 * pad;
  const badgeN = (t: number) => {
    const cur = last(badge, t);
    const idx = cur ? badge.indexOf(cur) : -1;
    const prev = idx > 0 ? badge[idx - 1].n : 0;
    return { n: cur?.n ?? 0, prev, at: cur?.at ?? -Infinity, open: badgeOpen(t) };
  };
  return {
    spec: { x: spec.x, y: spec.y, width: spec.width ?? natural, size, icons, pad, badge, dirty },
    r,
    height,
    rect,
    label: (tab) => labelW[tab],
    badgeN,
    dot,
  };
}

/** 0..1 the tab is the active one (a 150 ms transition on each change) */
const activeAmount = (active: readonly TabChange[], tab: TabKey, t: number) =>
  fold(
    active.map((c) => ({ at: c.at, to: c.tab === tab ? 1 : 0, dur: CURSOR.hoverDur })),
    0,
    t,
  );

export const TabBar: React.FC<{
  bar: TabBarGeometry;
  t: number;
  /** the selection over time (the first entry is the initial tab; set later ones at a click's release) */
  active: readonly TabChange[] | TabKey;
  /** the cursor working on it (hover / press come from it) */
  cursor?: readonly CursorKey[];
  /** draw the white strip (bg-card + its hairline) — false when a Panel already is the strip */
  strip?: boolean;
  /** the ink (foreground) */
  ink?: string;
  /** the strip's top corner radius (when it is the top of a Panel) */
  radius?: number;
}> = ({ bar, t, active: activeProp, cursor = [], strip = true, ink = APP.foreground, radius = 0 }) => {
  const { spec, r, height } = bar;
  const active: readonly TabChange[] = typeof activeProp === 'string' ? [{ at: -Infinity, tab: activeProp }] : activeProp;
  const size = spec.size;
  const gap = 6 * r;

  /* ── the underline ── */
  const cur = last(active, t) ?? active[0];
  const idx = active.indexOf(cur);
  const from = idx > 0 ? active[idx - 1] : null;
  const R1 = bar.rect(cur.tab, t);
  let left = R1.x;
  let right = R1.x + R1.w;
  if (from && from.tab !== cur.tab) {
    const R0 = bar.rect(from.tab, t);
    const toRight = R1.x > R0.x;
    const sL = springUnit(t - cur.at - (toRight ? TRAIL : 0), SLIDE);
    const sR = springUnit(t - cur.at - (toRight ? 0 : TRAIL), SLIDE);
    left = R0.x + (R1.x - R0.x) * sL;
    right = R0.x + R0.w + (R1.x + R1.w - (R0.x + R0.w)) * sR;
  }
  const lineH = Math.max(2, 2 * r);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0 }}>
      {strip ? (
        <div
          style={{
            position: 'absolute',
            left: spec.x,
            top: spec.y,
            width: spec.width,
            height,
            background: APP.card,
            boxShadow: `inset 0 -1.25px 0 ${APP.border}`,
            borderRadius: radius ? `${radius}px ${radius}px 0 0` : undefined,
          }}
        />
      ) : null}
      {TABS.map((tb) => {
        const R = bar.rect(tb.key, t);
        const hov = cursor.length ? hoverAt(cursor, t, R) : 0;
        const prs = cursor.length ? pressAt(cursor, t, R) : 0;
        const act = activeAmount(active, tb.key, t);
        const lit = Math.max(act, hov);
        const opacity = 0.6 + 0.4 * lit;
        const weight = WEIGHT_OFF + (WEIGHT_ON - WEIGHT_OFF) * act;
        const sc = 1 - (1 - CURSOR.targetScale) * prs;
        const badge = tb.key === 'knowledge' ? bar.badgeN(t) : null;
        const dotV = bar.dot(tb.key, t);
        const padX = (spec.icons ? 16 : 10) * r;
        const moving = Math.abs(sc - 1) > 1e-4;
        return (
          <div key={tb.key} style={{ position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h }}>
            {/* the pressed shade */}
            {prs > 0.002 ? (
              <div
                style={{
                  position: 'absolute',
                  left: padX * 0.45,
                  right: padX * 0.45,
                  top: 7 * r,
                  bottom: 7 * r,
                  borderRadius: 6 * r,
                  background: `rgba(20, 10, 36, ${(0.055 * prs).toFixed(4)})`,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: padX,
                top: 0,
                height: R.h,
                display: 'flex',
                alignItems: 'center',
                gap,
                color: ink,
                transformOrigin: `${(R.w / 2 - padX).toFixed(2)}px 50%`,
                ...subpixel(moving ? `scale(${sc.toFixed(5)})` : undefined, moving),
              }}
            >
              {spec.icons ? (
                <span style={{ opacity }}>
                  <Icon name={tb.icon} size={16 * r} stroke={2} />
                </span>
              ) : null}
              <span style={{ ...ui(size, weight), opacity, display: 'inline-block', width: bar.label(tb.key), textAlign: 'left' }}>{tb.label}</span>
              {badge && badge.open > 0.001 ? <Badge r={r} t={t} {...badge} /> : null}
              {dotV > 0.001 ? (
                // the slot opens with the dot (the flex gap before it grows in with it — no jump)
                <span style={{ display: 'inline-block', width: 6 * r * dotV, height: 6 * r, marginLeft: -gap * (1 - dotV), position: 'relative', flexShrink: 0 }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 6 * r,
                      height: 6 * r,
                      borderRadius: '50%',
                      background: APP.amber,
                      transform: `scale(${Math.max(0, Math.min(1.1, dotV)).toFixed(4)})`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {/* the line variant's 2 px underline, on the strip's hairline — an SVG rect: vector geometry is
          anti-aliased at its exact fractional edges in every render tab (a CSS box's width is painted
          pixel-snapped, and a scaled layer is re-rastered differently tab to tab: both stepped 1 px) */}
      <svg
        width={Math.max(1, right - left + 4)}
        height={lineH + 2}
        style={{ position: 'absolute', left: Math.floor(left) - 2, top: Math.floor(spec.y + height - lineH) - 1, overflow: 'visible' }}
        aria-hidden
      >
        <rect x={left - (Math.floor(left) - 2)} y={spec.y + height - lineH - (Math.floor(spec.y + height - lineH) - 1)} width={Math.max(0, right - left)} height={lineH} fill={ink} />
      </svg>
    </div>
  );
};

/** Knowledge's count badge: the disc opens with its slot; on each change the digit rolls and the disc pops. */
const Badge: React.FC<{ r: number; t: number; n: number; prev: number; at: number; open: number }> = ({ r, t, n, prev, at, open }) => {
  const d = 16 * r;
  const gap = 6 * r;
  // ml-1 + the disc; at open = 0 the negative margin cancels the flex gap before it (no jump)
  const slotW = d * open;
  const ml = (4 * r + gap) * open - gap;
  const roll = springUnit(t - at, ROLL);
  const pop = 1 + 0.14 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - at) / 9))) * (prev > 0 ? 1 : 0);
  const sc = Math.max(0, Math.min(1.2, open)) * pop;
  const font = ui(Math.round(0.75 * 14 * r), W.semibold, { tabular: true });
  const rolling = roll < 0.999 && prev > 0 && prev !== n;
  return (
    <span style={{ display: 'inline-block', position: 'relative', width: Math.max(0, slotW), marginLeft: ml, height: d, flexShrink: 0 }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: d,
          height: d,
          borderRadius: '50%',
          background: APP.primarySoft,
          overflow: 'hidden',
          transform: `scale(${sc.toFixed(4)})`,
          transformOrigin: '50% 50%',
        }}
      >
        {rolling ? (
          <span style={{ ...font, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.primary, transform: `translateY(${(-roll * 100).toFixed(2)}%)` }}>{prev}</span>
        ) : null}
        <span
          style={{
            ...font,
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: APP.primary,
            transform: rolling ? `translateY(${((1 - roll) * 100).toFixed(2)}%)` : undefined,
          }}
        >
          {n}
        </span>
      </span>
    </span>
  );
};
