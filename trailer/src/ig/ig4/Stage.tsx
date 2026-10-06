/**
 * REEL 4 · THE STAGE — the parts that live across the acts (docs/ig/SCRIPT.md ig4 §4), each a pure function of the
 * ABSOLUTE timeline frame, so every act (hook · asked · edge · thesis) mounts the same picture at its own frames and
 * the end card's seam re-forms frame 0 from the same code:
 *
 *   Ground4    the pearl KB_MESH (the knowledge base's own indigo-into-paper mesh) with a warm key at the top right;
 *              in the stop-time its clock HOLDS and it desaturates a touch (1 → .85): nothing moves
 *   Orb4       her teal orb, Ø 110 in the label band's left, the whole reel: listening (the listen palette) while
 *              things are asked, speaking her two lines at the in-call level; a rose ring leaves her on every ring
 *              (the call reaching her); in the stop-time her swirl holds too
 *   Frame0     FRAME 0: the price list centred under her (breathing 0.3 %), S1 "Can you trip up this / AI
 *              receptionist?" (headline 92, left at x 86, set at 72 % ink, "trip up" taking her teal on its onset), a
 *              ring in flight; in the seam (t < 0) the page slides back up into its place and S1 rises into its masks
 *   Stage4     everything after: the page's glide, the slot, the hairlines, the five documents, the threshold, the
 *              owner's field, the thesis caption
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, mix, smooth, tween } from '../../lib/motion';
import { meshElevation, meshShadowInk, useKitFaces } from '../../kb/kit';
import { subpixel } from '../../lib/glide';
import { KB_MESH, MOMENT_LIGHTS } from '../../kb/palettes';
import { CAPTION_BAND, Captions, type CapPlace } from '../components/Captions';
import { PearlGround } from '../components/Ground';
import { AvaOrb, orbTrack, RING_INK, Rings, VOL, type OrbTrack } from '../components/Orb';
import { blendPose, KbRows, REST, RowFace, type StackPose } from './KbRows';
import { ORB, PAGE, PAGE_0, PAGE_1, PAGE_H, rowY, ROWS, type PagePose } from './layout';
import { Links } from './Links';
import { OwnerField } from './OwnerField';
import { PriceList } from './PriceList';
import { AnswerRow, Eyebrow, Phrasings, SlotFrame } from './SingleSlot';
import { Threshold } from './Threshold';
import * as T from './timing';

const SUNDAY = MOMENT_LIGHTS.sunday;
const M = T.M;
const [STOP0, STOP1] = T.STOP;
const STOP_LEN = STOP1 - STOP0;

/* ── the stop-time's held clock: everything that drifts on its own clock holds through b7 ── */
/** the mesh's (and her swirl's) clock: t, held through the stop-time, then on again from where it stopped */
export const heldClock = (t: number) => (t < STOP0 ? t : t < STOP1 ? STOP0 : t - STOP_LEN);
/** the stop-time's grade: 0 → 1 as it falls, back as time resumes */
const stopGrade = (t: number) => tween(t, [STOP0, STOP0 + 3], [0, 1], EASE.out3) * (1 - tween(t, [STOP1, STOP1 + 10], [0, 1], EASE.inOut));

/* ── the ground ── */
/** the warm key at the top right (PLAN_LIGHTS.scale's peach pool, the pearl's own warm) */
export const WARM_KEY = { x: 960, y: 220, strength: 0.32, color: '#ffcfae', radius: 760 } as const;
export const Ground4: React.FC<{ t: number; keyLight?: React.ComponentProps<typeof PearlGround>['keyLight'] }> = ({ t, keyLight }) => (
  <PearlGround t={heldClock(t)} palette={KB_MESH} keyLight={keyLight ?? WARM_KEY} saturation={1 - 0.15 * stopGrade(t)} />
);

/* ── her orb ── */
/** where she listens: the hook and the three phrasings; the curveball until her fallback; the seam (frame 0's pose) */
const LISTEN: readonly (readonly [number, number])[] = [
  [-20, T.LINE.answer - 4],
  [T.RINGS[3], M.fieldUp],
  [T.END_CARD.seam - 2, T.DURATION + 30],
];
const baseTrack = () => orbTrack(T, { listen: LISTEN });
/** her track with the stop-time held: her swirl stops with the room */
export function track4(): OrbTrack {
  const b = baseTrack();
  const held = b.flow(STOP1) - b.flow(STOP0);
  return {
    volume: (t) => b.volume(t >= STOP0 && t < STOP1 ? STOP0 : t),
    listen: b.listen,
    flow: (t) => (t < STOP0 ? b.flow(t) : t < STOP1 ? b.flow(STOP0) : b.flow(t) - held),
  };
}
/** frame 0's orb for the seam (t < 0): at rest, listening, her swirl running on at rest speed into frame 0's */
export function frame0Track(): OrbTrack {
  const b = baseTrack();
  const f0 = b.flow(0);
  return { volume: () => VOL.rest, listen: () => 1, flow: (t) => (t < 0 ? f0 + (t / 30) * (0.55 + 1.6 * VOL.rest) : b.flow(t)) };
}
/** the rings she hears: frame 0's already in flight (2 f old at frame 0), then the four */
export const RING_FRAMES = [-2, ...T.RINGS] as const;
const RING = { d0: ORB.d * 0.92, d1: 380 } as const;

export const Orb4: React.FC<{ t: number; opacity?: number; tr?: OrbTrack }> = ({ t, opacity = 1, tr }) => {
  const ready = useKitFaces();
  if (!ready) return null;
  return <AvaOrb t={t} pose={{ x: ORB.x, y: ORB.y, d: ORB.d }} canvas={ORB.d} track={tr ?? track4()} opacity={opacity} rim={0.8} shadow={0.35} />;
};
export const OrbRings: React.FC<{ t: number }> = ({ t }) => <Rings t={t} at={RING_FRAMES} x={ORB.x} y={ORB.y} d0={RING.d0} d1={RING.d1} color={RING_INK.rush} strength={0.5} />;

/* ── frame 0 ── */
/** S1: headline 92, left at x 86, from y 1080 */
export const S1: CapPlace = { x: 86, y: 1080, maxWidth: 820, align: 'left', role: 'headline', size: 92, lineHeight: 1.08 };
const S1_KEYS = [{ words: [2, 3], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] as const;
/** the page's pose before the glide: frame 0's (breathing); in the seam (t < 0) it slides back up into it */
const SEAM_IN = 14;
function pageIn(t: number): { pose: PagePose; opacity: number; moving: boolean } {
  if (t >= 0) return { pose: PAGE_0, opacity: 1, moving: false };
  const u = Math.min(1, Math.max(0, (t + SEAM_IN) / SEAM_IN));
  const e = EASE.out3(u);
  return { pose: { ...PAGE_0, y: PAGE_0.y + 70 * (1 - e) }, opacity: smooth(0, 0.55, u), moving: true };
}

export const Frame0: React.FC<{ t: number; orb?: boolean; orbOpacity?: number }> = ({ t, orb = false, orbOpacity = 1 }) => {
  const p = pageIn(t);
  return (
    <>
      <PriceList t={t} pose={p.pose} breathe={1} moving={p.moving} opacity={p.opacity} />
      <OrbRings t={t} />
      {orb ? <Orb4 t={t} tr={frame0Track()} opacity={orbOpacity} /> : null}
      <Captions T={T} id="ig4-01" t={t} place={S1} keys={S1_KEYS} glint={SUNDAY.orb[3]} timing={{ exitAt: M.s1Out }} what="hook" />
    </>
  );
};

/* ── the page after frame 0: the glide, the landings, the fold into its row ── */
/** b6: the page's lines go first (up and out of the paper), then the PAPER ITSELF folds into the first row's box
 *  (FoldCard: one card, its rect, corner and lift interpolated), and the row's own face comes up on it */
const LINES_OUT = [M.shrink[0], M.shrink[0] + 2.5] as const;
const MORPH = [M.shrink[0] + 2.5, M.shrink[1]] as const;
function pageState(t: number): { pose: PagePose; breathe: number; fade: number; moving: boolean } | null {
  if (t < M.glide[0]) return { pose: PAGE_0, breathe: 1, fade: 1, moving: false };
  if (t >= MORPH[0]) return null;
  const g = tween(t, M.glide, [0, 1], EASE.inOut);
  const pose = { x: mix(PAGE_0.x, PAGE_1.x, g), y: mix(PAGE_0.y, PAGE_1.y, g), s: mix(PAGE_0.s, PAGE_1.s, g) };
  return { pose, breathe: 1 - g, fade: 1 - tween(t, LINES_OUT, [0, 1], EASE.in3), moving: g > 0 && g < 1 };
}
/** the paper folding into the first row: one card (its rect, corner and lift interpolated, positioned by a sub-pixel
 *  transform), the row's face coming up on it as it narrows to the row — never a blank card */
export const FoldCard: React.FC<{ t: number }> = ({ t }) => {
  if (t < MORPH[0] || t > M.rows[0] + 6) return null;
  const u = tween(t, MORPH, [0, 1], EASE.house);
  const from = { x: PAGE_1.x, y: PAGE_1.y, w: PAGE.w * PAGE_1.s, h: PAGE_H * PAGE_1.s, r: 14 * PAGE_1.s };
  const to = { x: ROWS.x, y: rowY(0), w: ROWS.w, h: ROWS.h, r: 20 };
  const r = { x: mix(from.x, to.x, u), y: mix(from.y, to.y, u), w: mix(from.w, to.w, u), h: mix(from.h, to.h, u), rad: mix(from.r, to.r, u) };
  // the row's own card takes over as it lands on the folded paper
  const o = 1 - tween(t, [M.rows[0] + 1, M.rows[0] + 5], [0, 1], EASE.inOut);
  const face = smooth(0.06, 0.45, u);
  const ink = meshShadowInk(KB_MESH);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: r.w,
        height: r.h,
        borderRadius: r.rad,
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: `inset 0 0 0 1.25px rgba(228, 224, 235, ${u.toFixed(3)}), ${meshElevation(mix(3, 0.7, u), ink, mix(1, 0.8, u))}`,
        opacity: o < 0.999 ? o : undefined,
        ...subpixel(`translate(${r.x.toFixed(3)}px, ${r.y.toFixed(3)}px)`, u < 1),
      }}
    >
      {face > 0.002 ? (
        <div style={{ position: 'absolute', left: 0, top: (r.h - ROWS.h) / 2, width: ROWS.w, height: ROWS.h, opacity: face < 0.999 ? face : undefined }}>
          <RowFace k={0} />
        </div>
      ) : null}
    </div>
  );
};

/* ── the five documents' pose ── */
const STEP_BACK: StackPose = { z: 0.92, ax: 540, ay: 624, dx: 0, dy: 0, opacity: 0.07, shade: 0, moving: false };
/** the end card: pulled back and up into a compact stack over the CTA (y 352–678), dimmed */
export const PULLED: StackPose = { z: 0.6, ax: 540, ay: ROWS.y, dx: 0, dy: 0, opacity: 0.5, shade: 0, moving: false };
/** the end card's pull-back: during "so."'s hold, so the stack is up and back before the CTA rises */
export const pullAt = (t: number) => tween(t, [M.so + 1, M.so + 17], [0, 1], EASE.inOut);
export function stackPose(t: number, step = 0): StackPose {
  const back = tween(t, [M.fieldUp, M.fieldUp + 12], [0, 1], EASE.inOut);
  const fwd = tween(t, [M.fieldOut + 5, M.fieldOut + 21], [0, 1], EASE.inOut);
  let p = blendPose(REST, STEP_BACK, back * (1 - fwd));
  if (step > 0) p = blendPose(p, PULLED, step);
  // out under the card's light
  const out = tween(t, [T.IMPACT - 6, T.IMPACT + 1], [0, 1], EASE.in3);
  return { ...p, opacity: p.opacity * (1 - out), moving: p.moving || (back > 0 && back < 1) || (fwd > 0 && fwd < 1) };
}

/* ── the thesis ── */
const THESIS_KEYS = [{ words: [5, 6], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] as const;
export const Thesis: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig4-08" t={t} place={CAPTION_BAND} keys={THESIS_KEYS} what="thesis caption" />;

export const Stage4: React.FC<{ t: number }> = ({ t }) => {
  const ps = pageState(t);
  return (
    <AbsoluteFill>
      <Ground4 t={t} />
      <OrbRings t={t} />
      {t < M.s1Out + 8 ? <Captions T={T} id="ig4-01" t={t} place={S1} keys={S1_KEYS} glint={SUNDAY.orb[3]} timing={{ exitAt: M.s1Out }} what="hook" /> : null}
      {ps ? <PriceList t={t} pose={ps.pose} breathe={ps.breathe} moving={ps.moving} lands={M.lands} priceAt={M.eightyFive} fade={ps.fade} /> : null}
      <FoldCard t={t} />
      <KbRows t={t} lands={M.rows} pose={stackPose(t, pullAt(t))} />
      <Threshold t={t} exitAt={M.edgeOut} dim={1 - 0.5 * tween(t, [M.fieldUp, M.fieldUp + 10], [0, 1], EASE.inOut)} />
      <SlotFrame t={t} />
      <Links t={t} />
      <Eyebrow t={t} />
      <Phrasings t={t} />
      <AnswerRow t={t} />
      <OwnerField t={t} />
      <Orb4 t={t} />
      <Thesis t={t} />
    </AbsoluteFill>
  );
};
