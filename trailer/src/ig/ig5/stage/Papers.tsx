/**
 * REEL 5 · THE QUOTES (docs/ig/ig5/SCRIPT.md b2–b5, HOOKS.md §1.6; the "BillPile"): white paper on the pearl, the
 * mesh-tinted elevation, a perforated top edge — every line on them a word she says, printed on her onset:
 *
 *   slip 1   rises blank at the agency line − 6 (an ink bar where the tag will write, an empty amount slot sized to
 *            the figure), resting LOW in b2 (y 520: the agency beat centred on the frame, crit-r2 P6); 2 f before
 *            "Agency" the tag AGENCY AI RECEPTIONIST rises into the bar AS A UNIT at 72 % and each word lifts to full
 *            ink on her onset (the series' card idiom: the keyword is on screen at 3.07 s, and the slips carry their
 *            words alone — the caption band is empty in b2–b3, crit-r1 P4); the figure's words "a month" over
 *            "commonly" (the full cast: "a common retainer") rise as a unit at 72 % 2 f before "commonly", each lifting
 *            on its word ("a month" on "a" as she says it), so "$300" is never on screen without its hedge and unit
 *            (crit-r2 TRUTH-R2-1 / SYNC-A); "$300" (140, rose) RISES out of its slot as $300 on "three hundred" (it
 *            never counts, crit-r1 P7) while its to-scale bar draws 600 px from the $0 point x 160 (2 px per dollar)
 *   stub     on "Setup," it drops a short way with weight onto slip 1's lower right edge (SPRING.land, +3°: from 30 px
 *            above, so it never crosses slip 1's figure row) and is stapled there, over slip 1's blank bottom margin
 *            only: SETUP, OFTEN over an empty amount slot (crit-r2 P7) that "$1,500" rises into on "fifteen hundred"
 *            — no bar (a one-time fee never sits on the monthly scale)
 *   lift     as her agency line ends, slip 1 and its stub glide up (0.4 s, EASE.inOut) into the b3 layout (y 340)
 *   slip 2   rises under them 2 f before "Live" with a 6 px graphite people stripe, its tag LIVE ANSWERING SERVICE
 *            rising with it (a unit at 72 %, each word up on its onset); "from", "a month," and "for 50 minutes"
 *            rise as a unit at 72 % 2 f before "from" and lift on their words, "$99" rises out of its mask on
 *            "ninety-nine" — so "$99" is never on screen without "for 50 minutes" (crit-r2 TRUTH-R2-1, RESEARCH-prices
 *            §7 row 3); its bar draws 198 px. No camera move (crit-r2 P2: the .97 ease-back never read at phone size,
 *            and its layer switches re-rastered every paper twice)
 *   pile     on "Ours?" they slide up and together (slip 2 first, under the stub; slip 1 with its stapled stub a 32nd
 *            later: SPRING.site) into
 *            a neat pile × .88 about x 160 (every $0 point stays on x 160), tilt 0, the FIGURES and bars stepping
 *            back to 60 % while every word (tags, hedges, "a month", "from", "for 50 minutes") keeps 88 % — $300,
 *            $1,500 and $99 still ≈ 123 px, every tag and hedge ≥ 4.5:1 on the paper (crit-r1 L1); nothing struck,
 *            no total
 *   exit     b5, a quarter beat before "You": the pile leaves AS ONE UNIT — it fades out LINEARLY over 3 f while it
 *            starts up (power3.in, through its mask at y 296: ≈ 35 px of travel when it is gone, nowhere near the
 *            mask), so a tag never goes before its figure (crit-r1 T3; crit-r2 B2: the default house ease made the
 *            "4 f fade" a near-instant vanish) — the comparison has done its job
 *
 * Each paper rides one sub-pixel layer while it moves (its words ride it); every printed word, figure and the paper
 * itself report their frame rects to the zone guard (price numerals as `price …`, the papers as `object …`).
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { UNIT_STAGGER } from '../../../lib/type';
import { meshElevation, meshShadowInk, measureText, spaceWidth, useKitFaces } from '../../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../../kb/palettes';
import { GRAPHITE } from '../../../kb/theme';
import { SET_INK } from '../../components/Captions';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { B2_DROP, baseline, bbox, mixPose, PILE, poseTransform, SCALE, SLIP1, SLIP1_REST, SLIP2, SLIP2_REST, STUB, STUB_REST, type Box, type Pose } from './layout';
import { springMoving } from './settle';
import { Figure, figWidth, labelSpec, money, objSpec, Print, rollEase, ScaleBar } from './type';

const M = T.M;
const RUSH = MOMENT_LIGHTS.rush;
const SHADOW = meshShadowInk(MUTED_MESH);
const TAG_INK = GRAPHITE.tag;
const SIX = 3.75;

/* ── the clocks ── */
/** b2 → b3: slip 1 and its stub rest B2_DROP lower through b2 and glide up into the b3 layout (0 → 1) */
export const liftAt = (t: number) => tween(t, M.lift, [0, 1], EASE.inOut);
/** the square-up from the pickup: slip 2 first (the lowest paper: it slides UNDER the stub, clear of ours rising
 *  beneath it), then slip 1 and its stapled stub together a 32nd later — a paper never passes over another's figure */
const SQ_ORDER = { slip2: 0, slip1: 1, stub: 1 } as const;
/** the square-up's release of paper `k` (squareAt's clock) */
const squareFrom = (k: keyof typeof SQ_ORDER) => M.pickup + SQ_ORDER[k] * (SIX / 2);
const squareAt = (t: number, k: keyof typeof SQ_ORDER) => springUnit(t - squareFrom(k), SPRING.site);
const pileK = (t: number) => tween(t, [M.pickup, M.pickup + 14], [0, 1], EASE.inOut);
/** the FIGURES' and bars' ink: 1 → .6 as they square up (the comparison steps back) */
export const pileInk = (t: number) => mix(1, PILE.ink, pileK(t));
/** the WORDS' ink (tags, hedges, "a month", "from", "for 50 minutes"): 1 → .88, legible at phone size (crit-r1 L1) */
export const labelInk = (t: number) => mix(1, PILE.labelInk, pileK(t));
/** b5: the pile's exit up through its mask — a quarter beat ahead of "You", so ours (gliding up after it) has cleared
 *  the caption band before "You set it up yourself." rises there (one moving text at a time, never text on text) */
export const PILE_EXIT = { at: M.you - 8, dur: 8, travel: 700, clipY: 296, fade: 3 } as const;
export const pileExitAt = (t: number) => tween(t, [PILE_EXIT.at, PILE_EXIT.at + PILE_EXIT.dur], [0, 1], EASE.in3);
/** the pile fades as one unit, LINEARLY, over the exit's first PILE_EXIT.fade frames (crit-r2 B2: the default house
 *  ease had it at 18 % ink a frame in): it is visibly leaving up as it fades, and gone after ≈ 35 px of travel — slip
 *  1's tag (y 304 in the pile) is still 8 px under the mask line then — so no frame shows a figure whose tag the mask
 *  has already taken (crit-r1 T3) */
export const pileFadeAt = (t: number) => tween(t, [PILE_EXIT.at, PILE_EXIT.at + PILE_EXIT.fade], [0, 1], (v) => v);

type PaperState = { pose: Pose; opacity: number; moving: boolean; lift: number };

function slipState(t: number, key: 'slip1' | 'slip2', rest: Pose, riseAt: number): PaperState | null {
  if (t < riseAt - 0.5) return null;
  const q = pileExitAt(t);
  if (q >= 1) return null;
  const e = springUnit(t - riseAt, SPRING.site);
  const l = key === 'slip1' ? liftAt(t) : 1;
  let pose: Pose = { ...rest, y: rest.y + (1 - e) * 72 + (1 - l) * B2_DROP };
  const u = squareAt(t, key);
  if (u > 0) pose = mixPose(pose, PILE[key], u);
  pose = { ...pose, y: pose.y - q * PILE_EXIT.travel };
  // crit-r3 LOOK3-B1: each spring's ENVELOPE, not |1 − u| (which dips under ε at every overshoot crossing and dropped
  // the paper off its glide layer for 1–5 render frames: its prices twinkled crisp ↔ soft on a pile at rest)
  const moving = springMoving(t - riseAt, SPRING.site) || (l > 0 && l < 1) || springMoving(t - squareFrom(key), SPRING.site) || q > 0;
  return { pose, opacity: smooth(0, 0.35, e) * (1 - pileFadeAt(t)), moving, lift: 2 + 1.4 * Math.max(0, 1 - e) };
}
export const slip1State = (t: number) => slipState(t, 'slip1', SLIP1_REST, M.slip1);
export const slip2State = (t: number) => slipState(t, 'slip2', SLIP2_REST, M.slip2);
export function stubState(t: number): PaperState | null {
  if (t < M.setup - 0.5) return null;
  const q = pileExitAt(t);
  if (q >= 1) return null;
  // the drop: from a short way above (30 px: it never crosses slip 1's figure row, crit-r1 P8), a little more crooked,
  // landing with weight (SPRING.land)
  const k = springUnit(t - M.setup, SPRING.land);
  const l = liftAt(t);
  let pose: Pose = { ...STUB_REST, y: STUB_REST.y - (1 - k) * 30 + (1 - l) * B2_DROP, r: STUB.tilt + (1 - k) * 2 };
  const u = squareAt(t, 'stub');
  if (u > 0) pose = mixPose(pose, PILE.stub, u);
  pose = { ...pose, y: pose.y - q * PILE_EXIT.travel };
  const moving = springMoving(t - M.setup, SPRING.land) || (l > 0 && l < 1) || springMoving(t - squareFrom('stub'), SPRING.site) || q > 0;
  return { pose, opacity: smooth(0, 0.25, k) * (1 - pileFadeAt(t)), moving, lift: 1.6 + 3 * Math.max(0, 1 - k) };
}

/* ── the paper ── */
const Paper: React.FC<{ s: PaperState; w: number; h: number; what: string; children: React.ReactNode; stripe?: number }> = ({ s, w, h, what, children, stripe = 0 }) => {
  const b = bbox(s.pose, { x: 0, y: 0, w, h });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: 12,
          background: '#ffffff',
          boxShadow: meshElevation(s.lift, SHADOW, 0.95),
          overflow: 'hidden',
          transformOrigin: '0 0',
          opacity: s.opacity >= 0.999 ? undefined : s.opacity,
          ...subpixel(poseTransform(s.pose), s.moving),
        }}
      >
        {stripe > 0 ? <div style={{ position: 'absolute', left: 0, top: 0, width: stripe, height: h, background: GRAPHITE.tag, opacity: 0.62 }} /> : null}
        <Perforation w={w} />
        {children}
      </div>
      {s.opacity > 0.5 ? <ZoneRect what={`object ${what}`} rect={b} /> : null}
    </>
  );
};

/** the tear-off line under a slip's top edge: small dots, 14 px apart */
const Perforation: React.FC<{ w: number }> = ({ w }) => (
  <svg width={w} height={24} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
    {Array.from({ length: Math.floor((w - 40) / 14) + 1 }, (_, i) => (
      <circle key={i} cx={20 + i * 14} cy={14} r={1.9} fill={GRAPHITE.text} fillOpacity={0.16} />
    ))}
  </svg>
);

/* ── the tag: an ink bar where it will write, then the label rising into it as a unit ── */
type TagWord = { text: string; at: number };
const TAG_BAR = { h: 16, a: 0.35 } as const;
/** the tag's words laid out (label role) */
function tagLayout(words: readonly TagWord[], size: number) {
  const spec = labelSpec(size);
  const sp = spaceWidth(spec);
  let x = 0;
  const pos = words.map((w) => {
    const ww = measureText(w.text.toUpperCase(), spec);
    const p = { x, w: ww };
    x += ww + sp;
    return p;
  });
  return { pos, w: x - sp };
}
/** the slips' tag: the ink bar holds its place on the blank slip; from `unit` (2 f before her first tag word: the
 *  series' card lead) the words rise out of their masks into it AS A UNIT at 72 % ink (the bar going as they come up),
 *  and each lifts to full ink on her onset — so the whole scope ("AGENCY AI RECEPTIONIST") reads from her first word */
const Tag: React.FC<{ t: number; x: number; y: number; size: number; words: readonly TagWord[]; unit: number; ink: number; moving: boolean }> = ({ t, x, y, size, words, unit, ink, moving }) => {
  const L = tagLayout(words, size);
  const barA = 1 - tween(t, [unit - 1, unit + 3], [0, 1], EASE.inOut);
  const barY = y + size * 0.6 - TAG_BAR.h / 2 + 1;
  return (
    <>
      {barA > 0.002 ? <div style={{ position: 'absolute', left: x, top: barY, width: L.w, height: TAG_BAR.h, borderRadius: TAG_BAR.h / 2, background: GRAPHITE.text, opacity: TAG_BAR.a * ink * barA }} /> : null}
      {words.map((w, i) => {
        const lift = SET_INK + (1 - SET_INK) * tween(t, [w.at - 1, w.at + 1], [0, 1], EASE.out3);
        return <Print key={i} t={t} at={unit + i * UNIT_STAGGER} text={w.text} x={x + L.pos[i].x} y={y} size={size} color={TAG_INK} kind="label" ink={ink * lift} moving={moving} />;
      })}
    </>
  );
};

/** a word of a figure's row: it rises with its row AS A UNIT at 72 % (the card idiom, `unit`) and lifts to full ink
 *  on her onset — so a figure is never on screen without its hedge and its unit (crit-r2 TRUTH-R2-1) */
const liftOn = (t: number, on: number) => SET_INK + (1 - SET_INK) * tween(t, [on - 1, on + 1], [0, 1], EASE.out3);

/* ── slip 1: the agency quote ── */
/** the agency take's words on the slip (T1 or the full line) */
const T1 = T.CAST.agency === T.HOOK.agencyT1;
const COL1 = T1 ? { top: 'a month', hedge: 'commonly' } : { top: 'a month,', hedge: 'a common retainer' };

export const Slip1: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const s = slip1State(t);
  if (!ready || !s) return null;
  const S = SLIP1;
  const ink = pileInk(t);
  const words = labelInk(t);
  const figBase = baseline(S.fig.y, S.fig.size);
  const monthSize = 44;
  const monthTop = figBase - 46 - 0.96 * monthSize;
  const hedgeTop = figBase - 0.96 * S.col.hedge;
  const slotA = 1 - tween(t, [M.three - 1, M.three + 5], [0, 1], EASE.inOut);
  const barLen = SCALE.pxPerDollar * 300 * rollEase(t, M.three);
  const figW = figWidth(money(300), S.fig.size);
  const colX = S.fig.x + figW + S.col.gap;
  const tagW = tagLayout(TAG1, S.tag.size).w;
  const show = s.opacity > 0.5;
  // the figure's words ("a month" over the hedge) rise as a unit 2 f before the hedge, each lifting on its word
  const unit = M.hedge - 2;
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="slip 1 (agency)">
        <Tag t={t} x={S.tag.x} y={S.tag.y} size={S.tag.size} words={TAG1} unit={M.tag[0] - 2} ink={words} moving={s.moving} />
        {slotA > 0.002 ? (
          <div style={{ position: 'absolute', left: S.fig.x - S.slot.pad, top: S.slot.y, width: figW + 2 * S.slot.pad, height: S.slot.h, borderRadius: S.slot.r, boxShadow: `inset 0 0 0 1.5px rgba(43, 42, 46, ${(0.3 * slotA).toFixed(3)})` }} />
        ) : null}
        <Figure t={t} value={300} roll={M.three} x={S.fig.x} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
        <Print t={t} at={unit} text={COL1.hedge} x={colX} y={hedgeTop} size={S.col.hedge} color={TAG_INK} ink={words * liftOn(t, M.hedge)} moving={s.moving} />
        <Print t={t} at={unit + UNIT_STAGGER} text={COL1.top} x={colX} y={monthTop} size={monthSize} color={GRAPHITE.text} ink={words * liftOn(t, M.month)} moving={s.moving} />
        {t >= M.three ? <ScaleBar x0={SCALE.x0} y={S.bar.y} len={barLen} color={RUSH.ink} ink={ink} stroke={SCALE.stroke} /> : null}
      </Paper>
      {show && t >= M.tag[0] - 3 ? <ZoneRect what="slip 1 tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: tagW, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= M.three ? <ZoneRect what="price $300 (slip 1)" rect={bbox(s.pose, { x: S.fig.x, y: S.fig.y, w: figW, h: S.fig.size })} /> : null}
      {show && t >= unit - 1 ? (
        <ZoneRect what="slip 1 column" rect={bbox(s.pose, { x: colX, y: monthTop, w: Math.max(measureText(COL1.top, objSpec(monthSize)), measureText(COL1.hedge, objSpec(S.col.hedge))), h: hedgeTop + S.col.hedge * 1.2 - monthTop })} />
      ) : null}
    </>
  );
};
const TAG1: readonly TagWord[] = [
  { text: 'Agency', at: M.tag[0] },
  { text: 'AI', at: M.tag[1] },
  { text: 'receptionist', at: M.tag[2] },
];

/* ── the setup stub ── */
const STUB_WORDS: readonly TagWord[] = [
  { text: 'Setup,', at: M.setup },
  { text: 'often', at: M.often },
];
export const Stub: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const s = stubState(t);
  if (!ready || !s) return null;
  const S = STUB;
  const ink = pileInk(t);
  const words = labelInk(t);
  const L = tagLayout(STUB_WORDS, S.tag.size);
  const staple = springUnit(t - (M.setup + 4), SPRING.pop);
  const show = s.opacity > 0.5;
  // the empty amount slot (slip 1's idiom, crit-r2 P7): sized to "$1,500", going as the figure rises into it
  const figW = figWidth(money(1500), S.fig.size);
  const slotA = 1 - tween(t, [M.fifteen - 1, M.fifteen + 5], [0, 1], EASE.inOut);
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="setup stub">
        {STUB_WORDS.map((w, i) => (
          <Print key={i} t={t} at={w.at - 1} text={w.text} x={S.tag.x + L.pos[i].x} y={S.tag.y} size={S.tag.size} color={TAG_INK} kind="label" ink={words} moving={s.moving} />
        ))}
        {slotA > 0.002 ? (
          <div style={{ position: 'absolute', left: S.fig.x - SLIP1.slot.pad, top: S.slot.y, width: figW + 2 * SLIP1.slot.pad, height: S.slot.h, borderRadius: SLIP1.slot.r, boxShadow: `inset 0 0 0 1.5px rgba(43, 42, 46, ${(0.3 * slotA).toFixed(3)})` }} />
        ) : null}
        <Figure t={t} value={1500} roll={M.fifteen} x={S.fig.x} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
      </Paper>
      {staple > 0.01 ? <Staple pose={s.pose} k={staple} opacity={s.opacity} moving={s.moving} /> : null}
      {show ? <ZoneRect what="stub tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: L.w, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= M.fifteen ? <ZoneRect what="price $1,500 (stub)" rect={bbox(s.pose, { x: S.fig.x, y: S.fig.y, w: figW, h: S.fig.size * 1.12 })} /> : null}
    </>
  );
};
/** the staple across the stub's top edge into slip 1, seen from above (crit-r1 P8: a plain grey pill read as a minus
 *  sign at pile scale): a 40 px wire crown with its two legs bent down into the paper at each end, a steel gradient with
 *  a highlight along the crown and a hair of shadow under it — half on the stub, half on the slip, pressed in as the
 *  stub settles */
const STAPLE = { w: 40, leg: 5, wire: 3.2 } as const;
const Staple: React.FC<{ pose: Pose; k: number; opacity: number; moving: boolean }> = ({ pose, k, opacity, moving }) => {
  const { w, leg, wire } = STAPLE;
  const pad = 4;
  const W = w + 2 * pad;
  const H = leg + wire + 2 * pad;
  const x0 = pad + wire / 2;
  const x1 = pad + w - wire / 2;
  const top = pad + wire / 2;
  const d = `M ${x0} ${top + leg} L ${x0} ${top + 1.2} Q ${x0} ${top} ${x0 + 1.2} ${top} L ${x1 - 1.2} ${top} Q ${x1} ${top} ${x1} ${top + 1.2} L ${x1} ${top + leg}`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', opacity, ...subpixel(poseTransform(pose), moving) }}>
      <svg
        width={W}
        height={H}
        style={{
          position: 'absolute',
          left: STUB.staple.x - W / 2,
          top: -top - 1,
          overflow: 'visible',
          transformOrigin: '50% 30%',
          transform: `scale(${(0.6 + 0.4 * Math.min(1.1, Math.max(0, k))).toFixed(4)})`,
          opacity: Math.min(1, Math.max(0, k * 1.5)),
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id="ig5-staple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d3d1d8" />
            <stop offset="0.45" stopColor="#8f8d96" />
            <stop offset="1" stopColor="#5f5d65" />
          </linearGradient>
        </defs>
        <path d={d} transform="translate(0.6, 1.1)" fill="none" stroke="rgba(30, 20, 66, 0.22)" strokeWidth={wire} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="url(#ig5-staple)" strokeWidth={wire} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${x0 + 2} ${top - 0.6} L ${x1 - 2} ${top - 0.6}`} fill="none" stroke="rgba(255, 255, 255, 0.75)" strokeWidth={0.9} strokeLinecap="round" />
      </svg>
    </div>
  );
};

/* ── slip 2: the live answering service ── */
const TAG2: readonly TagWord[] = [
  { text: 'Live', at: M.tag2[0] },
  { text: 'answering', at: M.tag2[1] },
  { text: 'service', at: M.tag2[2] },
];
export const Slip2: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const s = slip2State(t);
  if (!ready || !s) return null;
  const S = SLIP2;
  const ink = pileInk(t);
  const words = labelInk(t);
  const figBase = baseline(S.fig.y, S.fig.size);
  const small = S.col.size;
  const lowTop = figBase - 0.96 * small;
  const upTop = lowTop - S.col.pitch;
  const fromW = measureText('from', objSpec(S.fig.from));
  const figX = S.fig.x + fromW + 16;
  const figW = figWidth(money(99), S.fig.size);
  const colX = figX + figW + 28;
  const spec = objSpec(small);
  const sp = spaceWidth(spec);
  const forW = measureText('for', spec);
  const fiftyW = measureText('50', spec);
  const minW = measureText('minutes', spec);
  const barLen = SCALE.pxPerDollar * 99 * rollEase(t, M.ninetyNine);
  // the empty amount slot (crit-r3 LOOK3-P2: slip 1's and the stub's idiom), going as "$99" rises into it
  const slotA = 1 - tween(t, [M.ninetyNine - 1, M.ninetyNine + 5], [0, 1], EASE.inOut);
  const show = s.opacity > 0.5;
  // the figure's words ("from", "a month,", "for 50 minutes") rise as a unit 2 f before "from", each lifting on its word
  const unit = M.from99 - 2;
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="slip 2 (answering)" stripe={S.stripe}>
        <Tag t={t} x={S.tag.x} y={S.tag.y} size={S.tag.size} words={TAG2} unit={M.tag2[0] - 2} ink={words} moving={s.moving} />
        {slotA > 0.002 ? (
          <div style={{ position: 'absolute', left: figX - S.slot.padL, top: S.slot.y, width: figW + S.slot.padL + S.slot.pad, height: S.slot.h, borderRadius: S.slot.r, boxShadow: `inset 0 0 0 1.5px rgba(43, 42, 46, ${(0.3 * slotA).toFixed(3)})` }} />
        ) : null}
        <Print t={t} at={unit} text="from" x={S.fig.x} y={lowTop} size={S.fig.from} color={GRAPHITE.text} ink={words * liftOn(t, M.from99)} moving={s.moving} />
        <Figure t={t} value={99} roll={M.ninetyNine} x={figX} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
        <Print t={t} at={unit + UNIT_STAGGER} text="a month," x={colX} y={upTop} size={small} color={GRAPHITE.text} ink={words * liftOn(t, M.month99)} moving={s.moving} />
        <Print t={t} at={unit + 2 * UNIT_STAGGER} text="for" x={colX} y={lowTop} size={small} color={GRAPHITE.text} ink={words * liftOn(t, M.for50[0])} moving={s.moving} />
        <Print t={t} at={unit + 2 * UNIT_STAGGER} text="50" x={colX + forW + sp} y={lowTop} size={small} color={GRAPHITE.text} ink={words * liftOn(t, M.for50[1])} moving={s.moving} />
        <Print t={t} at={unit + 2 * UNIT_STAGGER} text="minutes" x={colX + forW + sp + fiftyW + sp} y={lowTop} size={small} color={GRAPHITE.text} ink={words * liftOn(t, M.for50[2])} moving={s.moving} />
        {t >= M.ninetyNine ? <ScaleBar x0={SCALE.x0} y={S.bar.y} len={barLen} color={RUSH.ink} ink={ink} stroke={SCALE.stroke} /> : null}
      </Paper>
      {show && t >= M.tag2[0] - 3 ? <ZoneRect what="slip 2 tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: tagLayout(TAG2, S.tag.size).w, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= unit - 1 ? <ZoneRect what="slip 2 from" rect={bbox(s.pose, { x: S.fig.x, y: lowTop, w: fromW, h: S.fig.from * 1.2 })} /> : null}
      {show && t >= M.ninetyNine ? <ZoneRect what="price $99 (slip 2)" rect={bbox(s.pose, { x: figX, y: S.fig.y, w: figW, h: S.fig.size })} /> : null}
      {show && t >= unit - 1 ? <ZoneRect what="slip 2 column" rect={bbox(s.pose, { x: colX, y: upTop, w: Math.max(measureText('a month,', spec), forW + sp + fiftyW + sp + minW), h: lowTop + small * 1.2 - upTop })} /> : null}
    </>
  );
};

/** the three papers, in their stacking order (slip 2, slip 1, the stub over its bottom margin), clipped at the pile's
 *  mask line while it leaves (b5) */
export const Papers: React.FC<{ t: number }> = ({ t }) => {
  if (t < M.slip1 - 1 || pileExitAt(t) >= 1) return null;
  const q = pileExitAt(t);
  // slip 2 lowest: on the square-up it slides UNDER the stub (the SlipStack collapse idiom), never over a figure
  const body = (
    <>
      <Slip2 t={t} />
      <Slip1 t={t} />
      <Stub t={t} />
    </>
  );
  return q > 0 ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${PILE_EXIT.clipY}px 0px 0px 0px)` }}>{body}</div> : body;
};

/** the pile's figures' frame boxes at the payoff (for the cover's thumbnail and the critic's checks) */
export const pileBox = (): Box => {
  const a = bbox(PILE.slip1, { x: 0, y: 0, w: SLIP1.w, h: SLIP1.h });
  const b = bbox(PILE.slip2, { x: 0, y: 0, w: SLIP2.w, h: SLIP2.h });
  return { x: a.x, y: a.y, w: a.w, h: b.y + b.h - a.y };
};
