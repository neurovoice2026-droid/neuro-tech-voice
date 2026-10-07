/**
 * REEL 5 · THE QUOTES (docs/ig/ig5/SCRIPT.md b2–b5, HOOKS.md §1.6; the "BillPile"): white paper on the pearl, the
 * mesh-tinted elevation, a perforated top edge — every line on them a word she says, printed on her onset:
 *
 *   slip 1   rises blank at the agency line − 6 (an ink bar where the tag will write, an empty amount slot); its bar
 *            sweeps into AGENCY AI RECEPTIONIST on "Agency" · "AI" · "receptionist:"; T1's "commonly" prints on its word
 *            (the full cast: "a common retainer"); "$300" (140, rose) ROLLS on "three hundred" while its to-scale
 *            hairline draws 600 px from the $0 point x 160 (2 px per dollar); "a month" prints on "a"
 *   stub     on "Setup," it drops with weight onto slip 1's lower right edge (SPRING.land, +3°) and is stapled there,
 *            over slip 1's blank bottom margin only: SETUP, OFTEN over "$1,500", which rolls on "fifteen hundred" — no
 *            hairline (a one-time fee never sits on the monthly scale)
 *   slip 2   rises 2 f before "Live" with a 6 px graphite people stripe; LIVE ANSWERING SERVICE writes on words 0–2;
 *            "from" · "$99" (rolls) · "a month," · "for 50 minutes" print on theirs; its hairline draws 198 px
 *   camera   b3: the papers ease back 1.00 → .97 about (540, 740) over 1 s, so the quotes read as one pile
 *   pile     on "Ours?" they slide up and together (slip 2 first, under the stub; slip 1 with its stapled stub a 32nd
 *            later: SPRING.site) into
 *            a neat pile × .88 about x 160 (every $0 point stays on x 160), tilt 0, their ink stepping back to 55 % —
 *            $300, $1,500 and $99 still ≈ 123 px, every tag and hedge legible; nothing struck, no total
 *   exit     b5, a quarter beat before "You": the pile leaves up through its mask (8 f, power3.in) — the comparison
 *            has done its job
 *
 * Each paper rides one sub-pixel layer while it moves (its words ride it); every printed word, figure and the paper
 * itself report their frame rects to the zone guard (price numerals as `price …`, the papers as `object …`).
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { meshElevation, meshShadowInk, measureText, spaceWidth, useKitFaces } from '../../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../../kb/palettes';
import { GRAPHITE } from '../../../kb/theme';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { baseline, bbox, CAMERA, camPose, mixPose, PILE, poseTransform, SCALE, SLIP1, SLIP1_REST, SLIP2, SLIP2_REST, STUB, STUB_REST, type Box, type Pose } from './layout';
import { Figure, figWidth, labelSpec, money, objSpec, Print, rollEase, ScaleBar } from './type';

const M = T.M;
const RUSH = MOMENT_LIGHTS.rush;
const SHADOW = meshShadowInk(MUTED_MESH);
const TAG_INK = GRAPHITE.tag;
const SIX = 3.75;

/* ── the clocks ── */
/** b3's camera on the papers */
export const camAt = (t: number) => 1 - (1 - CAMERA.to) * tween(t, M.camera, [0, 1], EASE.inOut);
/** the square-up from the pickup: slip 2 first (the lowest paper: it slides UNDER the stub, clear of ours rising
 *  beneath it), then slip 1 and its stapled stub together a 32nd later — a paper never passes over another's figure */
const SQ_ORDER = { slip2: 0, slip1: 1, stub: 1 } as const;
const squareAt = (t: number, k: keyof typeof SQ_ORDER) => springUnit(t - (M.pickup + SQ_ORDER[k] * (SIX / 2)), SPRING.site);
/** the papers' ink: 1 → .55 as they square up */
export const pileInk = (t: number) => mix(1, PILE.ink, tween(t, [M.pickup, M.pickup + 14], [0, 1], EASE.inOut));
/** b5: the pile's exit up through its mask — a quarter beat ahead of "You", so ours (gliding up after it) has cleared
 *  the caption band before "You set it up yourself." rises there (one moving text at a time, never text on text) */
export const PILE_EXIT = { at: M.you - 8, dur: 8, travel: 700, clipY: 296 } as const;
export const pileExitAt = (t: number) => tween(t, [PILE_EXIT.at, PILE_EXIT.at + PILE_EXIT.dur], [0, 1], EASE.in3);

type PaperState = { pose: Pose; opacity: number; moving: boolean; lift: number };
const EPS = 2e-4;

function slipState(t: number, key: 'slip1' | 'slip2', rest: Pose, riseAt: number): PaperState | null {
  if (t < riseAt - 0.5) return null;
  const q = pileExitAt(t);
  if (q >= 1) return null;
  const e = springUnit(t - riseAt, SPRING.site);
  let pose: Pose = { ...rest, y: rest.y + (1 - e) * 72 };
  const k = camAt(t);
  pose = camPose(pose, k, CAMERA.c);
  const u = squareAt(t, key);
  if (u > 0) pose = mixPose(pose, PILE[key], u);
  pose = { ...pose, y: pose.y - q * PILE_EXIT.travel };
  const moving = Math.abs(1 - e) > EPS || (k > CAMERA.to + EPS && k < 1 - EPS) || (u > 0 && Math.abs(1 - u) > EPS) || q > 0;
  return { pose, opacity: smooth(0, 0.35, e) * (1 - smooth(0.35, 1, q)), moving, lift: 2 + 1.4 * Math.max(0, 1 - e) };
}
export const slip1State = (t: number) => slipState(t, 'slip1', SLIP1_REST, M.slip1);
export const slip2State = (t: number) => slipState(t, 'slip2', SLIP2_REST, M.slip2);
export function stubState(t: number): PaperState | null {
  if (t < M.setup - 0.5) return null;
  const q = pileExitAt(t);
  if (q >= 1) return null;
  // the drop: from a hand's breadth above, a few degrees more crooked, landing with weight (SPRING.land)
  const k = springUnit(t - M.setup, SPRING.land);
  let pose: Pose = { ...STUB_REST, y: STUB_REST.y - (1 - k) * 90, r: STUB.tilt + (1 - k) * 4 };
  const c = camAt(t);
  pose = camPose(pose, c, CAMERA.c);
  const u = squareAt(t, 'stub');
  if (u > 0) pose = mixPose(pose, PILE.stub, u);
  pose = { ...pose, y: pose.y - q * PILE_EXIT.travel };
  const moving = Math.abs(1 - k) > EPS || (c > CAMERA.to + EPS && c < 1 - EPS) || (u > 0 && Math.abs(1 - u) > EPS) || q > 0;
  return { pose, opacity: smooth(0, 0.25, k) * (1 - smooth(0.35, 1, q)), moving, lift: 1.6 + 3 * Math.max(0, 1 - k) };
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

/* ── the tag: an ink bar that writes into the label word by word ── */
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
const Tag: React.FC<{ t: number; x: number; y: number; size: number; words: readonly TagWord[]; ink: number; moving: boolean }> = ({ t, x, y, size, words, ink, moving }) => {
  const L = tagLayout(words, size);
  // the bar's written edge: each word's end, reached over 4 f from its onset
  let written = 0;
  words.forEach((w, i) => {
    const k = tween(t, [w.at - 1, w.at + 3], [0, 1], EASE.out3);
    const end = L.pos[i].x + L.pos[i].w + (i < words.length - 1 ? spaceWidth(labelSpec(size)) : 0);
    const start = i ? L.pos[i - 1].x + L.pos[i - 1].w + spaceWidth(labelSpec(size)) : 0;
    if (k > 0) written = Math.max(written, mix(start, end, k));
  });
  const barY = y + size * 0.6 - TAG_BAR.h / 2 + 1;
  return (
    <>
      {written < L.w - 0.5 ? (
        <div style={{ position: 'absolute', left: x + written, top: barY, width: L.w - written, height: TAG_BAR.h, borderRadius: TAG_BAR.h / 2, background: GRAPHITE.text, opacity: TAG_BAR.a * ink }} />
      ) : null}
      {words.map((w, i) => (
        <Print key={i} t={t} at={w.at - 1} text={w.text} x={x + L.pos[i].x} y={y} size={size} color={TAG_INK} kind="label" ink={ink} moving={moving} />
      ))}
    </>
  );
};

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
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="slip 1 (agency)">
        <Tag t={t} x={S.tag.x} y={S.tag.y} size={S.tag.size} words={TAG1} ink={ink} moving={s.moving} />
        {slotA > 0.002 ? (
          <div style={{ position: 'absolute', left: S.slot.x, top: S.slot.y, width: S.slot.w, height: S.slot.h, borderRadius: S.slot.r, boxShadow: `inset 0 0 0 1.5px rgba(43, 42, 46, ${(0.3 * slotA).toFixed(3)})` }} />
        ) : null}
        <Figure t={t} value={300} roll={M.three} x={S.fig.x} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
        <Print t={t} at={M.month - 1} text={COL1.top} x={colX} y={monthTop} size={monthSize} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        <Print t={t} at={M.hedge - 1} text={COL1.hedge} x={colX} y={hedgeTop} size={S.col.hedge} color={TAG_INK} ink={ink} moving={s.moving} />
        {t >= M.three ? <ScaleBar x0={SCALE.x0} y={S.bar.y} len={barLen} color={RUSH.ink} ink={ink} stroke={SCALE.stroke} tick={tween(t, [M.three, M.three + 4], [0, 1])} /> : null}
      </Paper>
      {show && t >= M.tag[0] - 1 ? <ZoneRect what="slip 1 tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: tagW, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= M.three ? <ZoneRect what="price $300 (slip 1)" rect={bbox(s.pose, { x: S.fig.x, y: S.fig.y, w: figW, h: S.fig.size })} /> : null}
      {show && t >= Math.min(M.month, M.hedge) - 1 ? (
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
  const L = tagLayout(STUB_WORDS, S.tag.size);
  const staple = springUnit(t - (M.setup + 4), SPRING.pop);
  const show = s.opacity > 0.5;
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="setup stub">
        {STUB_WORDS.map((w, i) => (
          <Print key={i} t={t} at={w.at - 1} text={w.text} x={S.tag.x + L.pos[i].x} y={S.tag.y} size={S.tag.size} color={TAG_INK} kind="label" ink={ink} moving={s.moving} />
        ))}
        <Figure t={t} value={1500} roll={M.fifteen} x={S.fig.x} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
      </Paper>
      {staple > 0.01 ? <Staple pose={s.pose} k={staple} opacity={s.opacity} moving={s.moving} /> : null}
      {show ? <ZoneRect what="stub tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: L.w, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= M.fifteen ? <ZoneRect what="price $1,500 (stub)" rect={bbox(s.pose, { x: S.fig.x, y: S.fig.y, w: figWidth(money(1500), S.fig.size), h: S.fig.size * 1.12 })} /> : null}
    </>
  );
};
/** the staple across the stub's top edge into slip 1: a short graphite bar seen from above (a metal staple: darker body,
 *  a highlight along its top), half on the stub, half on the slip, pressed in as the stub settles */
const Staple: React.FC<{ pose: Pose; k: number; opacity: number; moving: boolean }> = ({ pose, k, opacity, moving }) => {
  const w = 30;
  const h = 6;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', opacity, ...subpixel(poseTransform(pose), moving) }}>
      <div
        style={{
          position: 'absolute',
          left: STUB.staple.x - w / 2,
          top: -h / 2 + 3,
          width: w,
          height: h,
          borderRadius: h / 2,
          background: 'linear-gradient(180deg, #b9b7bf 0%, #8c8a92 45%, #66646b 100%)',
          boxShadow: '0 1px 1.5px rgba(30, 20, 66, 0.28)',
          transformOrigin: '50% 50%',
          transform: `scale(${(0.6 + 0.4 * Math.min(1.1, Math.max(0, k))).toFixed(4)})`,
          opacity: Math.min(1, Math.max(0, k * 1.5)),
        }}
      />
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
  const show = s.opacity > 0.5;
  return (
    <>
      <Paper s={s} w={S.w} h={S.h} what="slip 2 (answering)" stripe={S.stripe}>
        <Tag t={t} x={S.tag.x} y={S.tag.y} size={S.tag.size} words={TAG2} ink={ink} moving={s.moving} />
        <Print t={t} at={M.from99 - 1} text="from" x={S.fig.x} y={lowTop} size={S.fig.from} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        <Figure t={t} value={99} roll={M.ninetyNine} x={figX} y={S.fig.y} size={S.fig.size} color={RUSH.ink} ink={ink} moving={s.moving} />
        <Print t={t} at={M.month99 - 1} text="a month," x={colX} y={upTop} size={small} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        <Print t={t} at={M.for50[0] - 1} text="for" x={colX} y={lowTop} size={small} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        <Print t={t} at={M.for50[1] - 1} text="50" x={colX + forW + sp} y={lowTop} size={small} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        <Print t={t} at={M.for50[2] - 1} text="minutes" x={colX + forW + sp + fiftyW + sp} y={lowTop} size={small} color={GRAPHITE.text} ink={ink} moving={s.moving} />
        {t >= M.ninetyNine ? <ScaleBar x0={SCALE.x0} y={S.bar.y} len={barLen} color={RUSH.ink} ink={ink} stroke={SCALE.stroke} tick={tween(t, [M.ninetyNine, M.ninetyNine + 4], [0, 1])} /> : null}
      </Paper>
      {show && t >= M.tag2[0] - 1 ? <ZoneRect what="slip 2 tag" rect={bbox(s.pose, { x: S.tag.x, y: S.tag.y, w: tagLayout(TAG2, S.tag.size).w, h: S.tag.size * 1.2 })} /> : null}
      {show && t >= M.from99 - 1 ? <ZoneRect what="slip 2 from" rect={bbox(s.pose, { x: S.fig.x, y: lowTop, w: fromW, h: S.fig.from * 1.2 })} /> : null}
      {show && t >= M.ninetyNine ? <ZoneRect what="price $99 (slip 2)" rect={bbox(s.pose, { x: figX, y: S.fig.y, w: figW, h: S.fig.size })} /> : null}
      {show && t >= M.month99 - 1 ? <ZoneRect what="slip 2 column" rect={bbox(s.pose, { x: colX, y: upTop, w: Math.max(measureText('a month,', spec), forW + sp + fiftyW + sp + minW), h: lowTop + small * 1.2 - upTop })} /> : null}
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
