/**
 * REEL 6 · THE LOCKUP (docs/ig/ig6/SCRIPT.md §4 "Type grammar", §5.1; STYLE.md §9.8): the reference's three tiers,
 * screen-locked (parallax 0), word-synced on Tessa's onsets — every word on screen is a word she says:
 *
 *   lead     Instrument Sans 580, −0.03em, ink — per word, a MASK RISE from +105 % of its line box behind a clip line,
 *            7 f expo, starting 2 f before her onset; out: 4 f up through the mask (in3)
 *   accent   Cormorant Garamond Italic 600, −0.01em, THE TEAL — a slide (x −40 → 0) under a left-to-right wipe, 8 f
 *            expo from 3 f before its first word (the hit on her onset), teal from its first frame; out: 5 f, scale
 *            1 → 0.94 + opacity
 *   tier     Instrument Sans 450, 32 px, grey — the whole screen SET at 72 % ink (a 6 f rise of 16 px, house ease)
 *            2 f before her first word; each word LIFTS to full ink on its onset (2 f); out: 4 f up through the mask
 *   frame 0  lockup 1a is set at 72 % from frame 0 (lead, accent and tier); each word lifts on its onset, the accent
 *            as a unit with a ≤ 3 % pop; in the seam it rises back into that set state by the last frame
 *   T4       S4a's teal underline draws out of the hub disc's lower edge to the accent's right end on "receptionist"
 *            (10 f expo, skip-ink round the descender), and wipes off left to right with 4a's exit
 *
 * The screens and their windows are pure functions of ../timing.ts (LOCKUPS, SCREENS, DISPLAY, the placed takes, M), so
 * cast B ("You / can’t answer.") and any re-anchor follow by themselves. Text never rotates, skews, blurs or casts a
 * shadow. Every block reports its rect to the zone guard (`text …`).
 */
import React from 'react';
import { typo } from '../../../kb/kit';
import { EASE, mixHex } from '../../../lib/motion';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { VOICE } from '../voice.generated';
import { bump } from './clock';
import { measureSans, measureSerif, useIg6Faces } from './fonts';
import { FACE, INK, LAYOUT, TIER } from './style';

type Tok = { text: string; onset: number };
export type LockSpec = {
  key: string;
  layout: T.LockupLayout;
  lead: Tok[];
  accent: Tok[];
  rows: Tok[][];
  /** frame 0's idiom: set at 72 % before its words (1a); `rise`: the frame it rises into that state (the seam) */
  set0?: { rise: number | null };
  /** the tier's set (rise) frame; null: it continues the previous screen's tier (S2b) */
  tierFrom: number | null;
  out: { lead: number; accent: number; tier: number | null };
  /** the tier's centre under another lockup's accent (default: under its own; S2a/S2b share 2b's) */
  tierUnder?: { text: string; layout: T.LockupLayout };
  underline?: boolean;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const SAY = (id: T.VoiceId) => typo(VOICE.lines[id].say).split(' ');
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const shown = (id: T.VoiceId, k: number) => T.DISPLAY.find((d) => d.id === id && d.from === k)?.text ?? SAY(id)[k];
const toks = (id: T.VoiceId, at: number, [a, b]: readonly [number, number], display: boolean): Tok[] =>
  range(a, b).map((k) => ({ text: display ? shown(id, k) : SAY(id)[k], onset: at + T.vWord(id, k) }));

/** every lockup of the reel, in order (pure, from the timeline); `shift` re-times them by a loop (the seam's 1a) */
export function lockSpecs(): LockSpec[] {
  const out: LockSpec[] = [];
  const hook = T.TAKES.hook!;
  const hAt = T.LINE.hook;
  const [L1a, L1b] = T.LOCKUPS[hook];
  const [s1a, s1b] = T.SCREENS[hook].spans;
  const lastOf = (id: T.VoiceId, at: number, span: readonly [number, number]) => at + T.vWord(id, span[1]);
  // 1a, set at frame 0
  const e1 = lastOf(hook, hAt, s1a) + 15;
  out.push({ key: '1a', layout: L1a.layout, lead: toks(hook, hAt, L1a.lead, true), accent: toks(hook, hAt, L1a.accent, true), rows: [toks(hook, hAt, s1a, false)], set0: { rise: null }, tierFrom: null, out: { lead: e1, accent: e1 + 1, tier: e1 + 2 } });
  // 1b, once 1a has cleared
  const e2 = lastOf(hook, hAt, s1b) + T.HOOK.hold;
  const b0 = hAt + T.vWord(hook, s1b[0]);
  out.push({ key: '1b', layout: L1b.layout, lead: toks(hook, hAt, L1b.lead, true), accent: toks(hook, hAt, L1b.accent, true), rows: [toks(hook, hAt, s1b, false)], tierFrom: Math.max(b0 - 2, e1 + 2 + 4), out: { lead: e2, accent: e2 + 1, tier: e2 + 2 } });
  // 2a + 2b: one tier screen across the two takes ("While it rings," / "someone's still waiting.")
  const ra = T.TAKES.rings!;
  const rAt = T.LINE.rings;
  const wa = T.TAKES.waiting!;
  const wAt = T.LINE.waiting;
  const [L2a] = T.LOCKUPS[ra];
  const [L2b] = T.LOCKUPS[wa];
  const rowsS2 = [toks(ra, rAt, T.SCREENS[ra].spans[0], false), toks(wa, wAt, T.SCREENS[wa].spans[0], false)];
  const w0 = wAt + T.vWord(wa, 0);
  const s2x = { text: L2b.accent.map((k) => shown(wa, k)).join(' '), layout: L2b.layout };
  out.push({ key: '2a', layout: L2a.layout, lead: toks(ra, rAt, L2a.lead, true), accent: toks(ra, rAt, L2a.accent, true), rows: rowsS2, tierFrom: rAt + T.vWord(ra, 0) - 2, out: { lead: w0 - 7, accent: w0 - 7, tier: null }, tierUnder: s2x });
  const eF = T.M.fall[0] + 2;
  out.push({ key: '2b', layout: L2b.layout, lead: toks(wa, wAt, L2b.lead, true), accent: toks(wa, wAt, L2b.accent, true), rows: rowsS2, tierFrom: null, out: { lead: eF, accent: eF + 1, tier: eF + 2 }, tierUnder: s2x });
  // S3: the tier from "A", the big words later; out as the whip starts
  const mi = T.TAKES.missed!;
  const mAt = T.LINE.missed;
  const [L3] = T.LOCKUPS[mi];
  const sp3 = T.SCREENS[mi].spans[0];
  const all3 = toks(mi, mAt, sp3, false);
  const split = Math.max(1, L3.lead[0] - sp3[0]);
  const e3 = T.M.whip - 4;
  out.push({ key: '3', layout: L3.layout, lead: toks(mi, mAt, L3.lead, true), accent: toks(mi, mAt, L3.accent, true), rows: [all3.slice(0, split), all3.slice(split)], tierFrom: mAt + T.vWord(mi, sp3[0]) - 2, out: { lead: e3, accent: e3 + 1, tier: e3 + 2 } });
  // S4a (+ the underline) and S4b
  const ag = T.TAKES.agent!;
  const aAt = T.LINE.agent!;
  const [L4a, L4b] = T.LOCKUPS[ag];
  const [s4a, s4b] = T.SCREENS[ag].spans;
  const picks = aAt + T.vWord(ag, s4b[0]);
  out.push({ key: '4a', layout: L4a.layout, lead: toks(ag, aAt, L4a.lead, true), accent: toks(ag, aAt, L4a.accent, true), rows: [toks(ag, aAt, s4a, false)], tierFrom: aAt + T.vWord(ag, s4a[0]) - 2, out: { lead: picks - 6, accent: picks - 6, tier: picks - 6 }, underline: true });
  const e4 = lastOf(ag, aAt, s4b) + 15;
  out.push({ key: '4b', layout: L4b.layout, lead: toks(ag, aAt, L4b.lead, true), accent: toks(ag, aAt, L4b.accent, true), rows: [toks(ag, aAt, s4b, false)], tierFrom: picks - 2, out: { lead: e4, accent: e4, tier: e4 + 1 } });
  // S5 (wide), held to the ring cut
  const wo = T.TAKES.words!;
  const woAt = T.LINE.words!;
  const [L5] = T.LOCKUPS[wo];
  const e5 = T.M.ringShot - 4;
  out.push({ key: '5', layout: L5.layout, lead: toks(wo, woAt, L5.lead, true), accent: toks(wo, woAt, L5.accent, true), rows: [toks(wo, woAt, T.SCREENS[wo].spans[0], false)], tierFrom: woAt + T.vWord(wo, 0) - 2, out: { lead: e5, accent: e5, tier: e5 + 1 } });
  // S6, held to the exit (dropped with ig6-06 by trim T1)
  const ri = T.TAKES.ring;
  const riAt = T.LINE.ring;
  if (ri && riAt !== null) {
    const [L6] = T.LOCKUPS[ri];
    const e6 = T.M.exit[0];
    out.push({ key: '6', layout: L6.layout, lead: toks(ri, riAt, L6.lead, true), accent: toks(ri, riAt, L6.accent, true), rows: [toks(ri, riAt, T.SCREENS[ri].spans[0], false)], tierFrom: riAt + T.vWord(ri, 0) - 2, out: { lead: e6, accent: e6, tier: e6 + 1 } });
  }
  // S7, the end card's CTA (centred): out a frame before the stage clears for the bar
  const ct = T.TAKES.cta!;
  const cAt = T.LINE.cta;
  const [L7] = T.LOCKUPS[ct];
  const e7 = T.IMPACT - 6;
  out.push({ key: '7', layout: L7.layout, lead: toks(ct, cAt, L7.lead, true), accent: toks(ct, cAt, L7.accent, true), rows: [toks(ct, cAt, T.SCREENS[ct].spans[0], false)], tierFrom: cAt + T.vWord(ct, 0) - 2, out: { lead: e7, accent: e7, tier: e7 + 1 } });
  // the seam: 1a again, re-timed one loop later (its words 72 %), rising into its set state by the last frame
  const a = out[0];
  const sh = (x: Tok[]) => x.map((w) => ({ ...w, onset: w.onset + T.DURATION }));
  out.push({ ...a, key: '1a-seam', lead: sh(a.lead), accent: sh(a.accent), rows: a.rows.map(sh), set0: { rise: SEAM_RISE }, out: { lead: Infinity, accent: Infinity, tier: Infinity } });
  return out;
}
/** the seam's 1a rises into its set state from here (lead mask rise 7 f → at rest on the last frame) */
export const SEAM_RISE = T.DURATION - 8;

/* ── the pieces' motion ── */
const RISE = 7;
/** a lead word's vertical offset (px, + = down) at t */
const leadDy = (t: number, size: number, inAt: number, outAt: number) => {
  const rise = 1.05 * size * (1 - EASE.expo(clamp01((t - inAt) / RISE)));
  const exit = 1.3 * size * EASE.in3(clamp01((t - outAt) / 4));
  return rise - exit;
};
/** ink of a word: set (72 %) until her onset, full from it (2 f) */
const lift = (t: number, onset: number) => clamp01((t - onset + 1) / 2);
const setInk = (full: string) => mixHex(INK.ground, full, INK.setInk);

const sansStyle = (size: number, weight: number, tracking: number): React.CSSProperties => ({ fontFamily: FACE.sans, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, fontSynthesis: 'none', fontKerning: 'normal', whiteSpace: 'pre' });
const serifStyle = (size: number): React.CSSProperties => ({ fontFamily: FACE.serif, fontStyle: 'italic', fontSize: size, fontWeight: TIER.accent.weight, letterSpacing: `${TIER.accent.tracking}em`, fontSynthesis: 'none', fontKerning: 'normal', whiteSpace: 'pre' });

export type LockGeom = { leadX: number; leadW: number; accX: number; accW: number; tierX: number; rowW: number[] };
export function lockGeom(s: LockSpec): LockGeom {
  const P = LAYOUT[s.layout];
  const leadText = s.lead.map((w) => w.text).join(' ');
  const accText = s.accent.map((w) => w.text).join(' ');
  const leadW = measureSans(leadText, P.lead.size, TIER.lead.weight, TIER.lead.tracking);
  const accW = measureSerif(accText, P.accent.size);
  const leadX = P.centred ? P.lead.x - leadW / 2 : P.lead.x;
  const accX = P.centred ? P.accent.x - accW / 2 : P.accent.x;
  const under = s.tierUnder ? LAYOUT[s.tierUnder.layout].accent.x + measureSerif(s.tierUnder.text, LAYOUT[s.tierUnder.layout].accent.size) / 2 : null;
  const tierX = under ?? P.tier.x ?? accX + accW / 2;
  const rowW = s.rows.map((r) => measureSans(r.map((w) => w.text).join(' '), TIER.tier.size, TIER.tier.weight, TIER.tier.tracking));
  return { leadX, leadW, accX, accW, tierX, rowW };
}

/** the accent's slide + wipe: from 3 f before its first word, 8 f expo — the expo puts its hit (most of the travel and
 *  the wipe) on her onset, so the word reads on or ≤ 2 f before she says it (the series' sync rule); STYLE §9.8's
 *  "10 f landing on the onset" showed it ≈ 9 f early */
const ACC = { lead: 3, dur: 8 } as const;
/** the first frame a lockup shows anything */
const startOf = (s: LockSpec) => (s.set0 ? (s.set0.rise ?? -Infinity) : Math.min(s.lead[0].onset - 2, s.accent[0].onset - ACC.lead, s.tierFrom ?? Infinity));
/** a screen whose tier continues into the next (S2a → S2b) hands it over at the next one's start */
const handover = (s: LockSpec, all: readonly LockSpec[]) => {
  const next = all[all.indexOf(s) + 1];
  return next ? startOf(next) : Infinity;
};
/** the frame its tier is gone (its exit's end, or the handover) */
const tierEnd = (s: LockSpec, all: readonly LockSpec[]) => (s.out.tier === null ? handover(s, all) : s.out.tier + 4);
/** is this lockup on screen at t (any part)? */
export const lockOn = (s: LockSpec, t: number, all: readonly LockSpec[]) => t >= startOf(s) && t < Math.max(s.out.lead + 4, s.out.accent + 5, tierEnd(s, all));

/** one lockup at t */
const One: React.FC<{ s: LockSpec; t: number; all: readonly LockSpec[]; id: string }> = ({ s, t, all, id }) => {
  const P = LAYOUT[s.layout];
  const g = lockGeom(s);
  const set0 = s.set0;
  const seamRise = set0?.rise ?? null;
  const nodes: React.ReactNode[] = [];
  const rects: React.ReactNode[] = [];

  /* lead: per word */
  const lz = P.lead.size;
  const leadClip = `${id}-lead`;
  const leadVisible = t < s.out.lead + 4 && (set0 ? seamRise === null || t >= seamRise : t >= s.lead[0].onset - 2);
  if (leadVisible) {
    let x = g.leadX;
    const words = s.lead.map((w, i) => {
      const wx = x;
      x += measureSans(w.text + ' ', lz, TIER.lead.weight, TIER.lead.tracking);
      const inAt = set0 ? (seamRise === null ? -1e9 : seamRise + i) : w.onset - 2;
      const dy = leadDy(t, lz, inAt, s.out.lead);
      const fill = set0 ? mixHex(setInk(INK.ink), INK.ink, lift(t, w.onset)) : INK.ink;
      return (
        <text key={i} x={wx} y={P.lead.base} transform={dy !== 0 ? `translate(0 ${dy.toFixed(3)})` : undefined} fill={fill} style={sansStyle(lz, TIER.lead.weight, TIER.lead.tracking)}>
          {w.text}
        </text>
      );
    });
    nodes.push(
      <g key="lead">
        <clipPath id={leadClip}>
          <rect x={g.leadX - 20} y={P.lead.base - 1.0 * lz} width={g.leadW + 60} height={1.28 * lz} />
        </clipPath>
        <g clipPath={`url(#${leadClip})`}>{words}</g>
      </g>,
    );
    if (t < s.out.lead + 2) rects.push(<ZoneRect key="zl" what={`text lockup lead ${s.key}`} rect={{ x: g.leadX, y: P.lead.base - lz * 0.76, w: g.leadW, h: lz }} />);
  }

  /* accent: as a unit */
  const az = P.accent.size;
  const a0 = s.accent[0].onset;
  const accVisible = t < s.out.accent + 5 && (set0 ? seamRise === null || t >= seamRise : t >= a0 - ACC.lead);
  if (accVisible) {
    const accText = s.accent.map((w) => w.text).join(' ');
    let p = 1;
    let dx = 0;
    let scale = 1;
    let fill: string = INK.teal;
    if (set0) {
      // frame 0's idiom: set at 72 %, lifting on its first word with a ≤ 3 % pop; the seam wipes it back in
      fill = mixHex(setInk(INK.teal), INK.teal, lift(t, a0));
      scale = 1 + 0.03 * bump(t - a0, 2.5);
      if (seamRise !== null) {
        p = EASE.expo(clamp01((t - seamRise - 1) / 7));
        dx = -40 * (1 - p);
      }
    } else {
      p = EASE.expo(clamp01((t - (a0 - ACC.lead)) / ACC.dur));
      dx = -40 * (1 - p);
    }
    const q = EASE.in3(clamp01((t - s.out.accent) / 5));
    scale *= 1 - 0.06 * q;
    const opacity = 1 - q;
    const padL = 24;
    const padR = 40;
    const cx = g.accX + g.accW / 2;
    const cy = P.accent.base - az * 0.25;
    const wipe = `${id}-acc`;
    nodes.push(
      <g key="acc" opacity={opacity < 0.999 ? opacity : undefined}>
        <clipPath id={wipe}>
          <rect x={g.accX - padL} y={P.accent.base - az} width={(g.accW + padL + padR) * p} height={az * 1.35} />
        </clipPath>
        <g clipPath={`url(#${wipe})`}>
          <text
            x={g.accX}
            y={P.accent.base}
            fill={fill}
            transform={`translate(${dx.toFixed(3)} 0)${scale !== 1 ? ` translate(${cx} ${cy}) scale(${scale.toFixed(5)}) translate(${-cx} ${-cy})` : ''}`}
            style={serifStyle(az)}
          >
            {accText}
          </text>
        </g>
      </g>,
    );
    if (q < 0.5) rects.push(<ZoneRect key="za" what={`text lockup accent ${s.key}`} rect={{ x: g.accX, y: P.accent.base - az * 0.72, w: g.accW, h: az * 0.98 }} />);
  }

  /* tier rows */
  const tierOut = s.out.tier ?? Infinity;
  const owner = !set0 && s.tierFrom === null ? all[all.indexOf(s) - 1] : s;
  const tFrom = owner.tierFrom;
  const tierVisible = t < tierEnd(s, all) && (set0 ? seamRise === null || t >= seamRise + 1 : tFrom !== null && t >= tFrom);
  if (tierVisible) {
    const rise = set0 ? (seamRise === null ? 0 : 16 * (1 - EASE.house(clamp01((t - seamRise - 1) / 6)))) : 16 * (1 - EASE.house(clamp01((t - (tFrom as number)) / 6)));
    const o = set0 ? (seamRise === null ? 1 : clamp01((t - seamRise - 1) / 2)) : clamp01((t - (tFrom as number)) / 2);
    const exit = Number.isFinite(tierOut) ? 44 * EASE.in3(clamp01((t - tierOut) / 4)) : 0;
    s.rows.forEach((row, ri) => {
      const base = P.tier.base[Math.min(ri, P.tier.base.length - 1)];
      const clip = `${id}-tier${ri}`;
      nodes.push(
        <g key={`tier${ri}`}>
          <clipPath id={clip}>
            <rect x={g.tierX - g.rowW[ri] / 2 - 20} y={base - 34} width={g.rowW[ri] + 40} height={45} />
          </clipPath>
          <g clipPath={`url(#${clip})`} opacity={o < 0.999 ? o : undefined}>
            <text x={g.tierX} y={base} textAnchor="middle" transform={rise - exit !== 0 ? `translate(0 ${(rise - exit).toFixed(3)})` : undefined} style={sansStyle(TIER.tier.size, TIER.tier.weight, TIER.tier.tracking)}>
              {row.map((w, i) => (
                <tspan key={i} fill={mixHex(setInk(INK.tier), INK.tier, lift(t, w.onset))}>
                  {i ? ' ' : ''}
                  {w.text}
                </tspan>
              ))}
            </text>
          </g>
        </g>,
      );
      if (t < Math.min(tierOut + 2, tierEnd(s, all))) rects.push(<ZoneRect key={`zt${ri}`} what={`text lockup tier ${s.key}.${ri}`} rect={{ x: g.tierX - g.rowW[ri] / 2, y: base - TIER.tier.size * 0.78, w: g.rowW[ri], h: TIER.tier.size }} />);
    });
  }

  /* T4: the underline out of the hub (S4a) */
  if (s.underline) {
    const at = a0;
    const y = P.accent.base + 7;
    const x0 = UNDERLINE.from.x;
    const x1 = g.accX + g.accW;
    const grow = EASE.expo(clamp01((t - at) / 10));
    const wipe = EASE.in3(clamp01((t - s.out.accent) / 4));
    const xa = x0 + (x1 - x0) * wipe;
    const xb = x0 + (x1 - x0) * grow;
    if (grow > 0 && xb > xa + 0.5) {
      // skip-ink: a 6 px gap either side of the accent's descenders
      const gaps = descenderGaps(s.accent.map((w) => w.text).join(' '), g.accX, az);
      const segs: [number, number][] = [];
      let from = xa;
      for (const [ga, gb] of gaps) {
        if (gb <= from || ga >= xb) continue;
        if (ga > from) segs.push([from, Math.min(ga, xb)]);
        from = Math.max(from, gb);
      }
      if (xb > from) segs.push([from, xb]);
      segs.forEach(([a, b], i) => nodes.push(<line key={`ul${i}`} x1={a} y1={y} x2={b} y2={y} stroke={INK.teal} strokeWidth={UNDERLINE.w} strokeLinecap="butt" />));
    }
  }
  return (
    <>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden' }} aria-hidden>
        {nodes}
      </svg>
      {rects}
    </>
  );
};

/** the T4 underline: out of the hub disc's lower edge (x 97, y 1232), 3 px teal */
export const UNDERLINE = { from: { x: 97, y: 1232 }, w: 3 } as const;
/** the x spans (screen px) of the descenders in an accent run (Cormorant italic: p g y f j q), padded 6 px */
function descenderGaps(text: string, x0: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < text.length; i++) {
    if (!/[pgyfjq]/.test(text[i])) continue;
    const a = x0 + measureSerif(text.slice(0, i), size);
    const b = x0 + measureSerif(text.slice(0, i + 1), size);
    // the italic's descender leans left of the advance box by ≈ tan(10°) × its depth at the underline (≈ 7 px down)
    out.push([a - 0.1 * size - 6, b - 0.05 * size + 6]);
  }
  return out;
}

const SPECS = (() => {
  let cache: LockSpec[] | null = null;
  return () => (cache ??= lockSpecs());
})();

/** every lockup showing at absolute frame t (one at a time, but exits and entrances may touch) */
export const Lockups: React.FC<{ t: number; only?: (s: LockSpec) => boolean }> = ({ t, only }) => {
  const ready = useIg6Faces();
  if (!ready) return null;
  const all = SPECS();
  const on = all.filter((s) => (!only || only(s)) && lockOn(s, t, all));
  return (
    <>
      {on.map((s) => (
        <One key={s.key} s={s} t={t} all={all} id={`ig6-lock-${s.key}`} />
      ))}
    </>
  );
};
/** the lockup box is in use at t (the overlap check's window) */
export const lockupShowing = (t: number) => {
  const all = SPECS();
  return all.some((s) => s.key !== '7' && lockOn(s, t, all));
};
export { SPECS as lockups };
