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
 *   Frame0     FRAME 0: the price list centred under her (from frame 0 on, a slow push: it floats up and toward us,
 *              the camera never stopping until the glide takes it over), S1 "Can you trip up this / AI
 *              receptionist?" (headline 92, left at x 86, set at 72 % ink, "trip up" taking her teal on its onset), a
 *              ring in flight; in the seam (t < 0) the page slides back up into its place — arriving on frame 0 at
 *              the push's own speed, so the loop never stops — and S1 rises into its masks
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
/**
 * b1: THE HOOK'S PUSH — from frame 0 the page floats up and toward us at a steady, slow speed (0.3 px/f up, + 2.5 % about
 * its centre by the glide), so the main subject is never still while she asks; the glide takes it over mid-move (Stage4
 * mixes the moving pose into PAGE_1). In the seam (t < 0) the page slides back up into frame 0's place from 70 px
 * below, decelerating to exactly the push's speed on frame 0: the loop point is mid-motion, never a stop.
 */
const PUSH = { v: 0.3, s: 0.025, to: 77 } as const;
const SEAM_IN = 14;
const SEAM_DROP = 70;
/** the seam's curve: y offset a·t² − v·t, SEAM_DROP at −SEAM_IN, 0 at frame 0 with the push's speed */
const SEAM_A = (SEAM_DROP - SEAM_IN * PUSH.v) / (SEAM_IN * SEAM_IN);
export function hookPose(t: number): PagePose {
  const p = (PUSH.s * Math.max(0, t)) / PUSH.to;
  const dy = t < 0 ? SEAM_A * t * t - PUSH.v * t : -PUSH.v * t;
  return { x: PAGE_0.x - (PAGE.w * p) / 2, y: PAGE_0.y - (PAGE_H * p) / 2 + dy, s: 1 + p };
}
function pageIn(t: number): { pose: PagePose; opacity: number; moving: boolean } {
  if (t >= 0) return { pose: hookPose(t), opacity: 1, moving: t > 0 };
  const u = Math.min(1, Math.max(0, (t + SEAM_IN) / SEAM_IN));
  return { pose: hookPose(Math.max(-SEAM_IN, t)), opacity: smooth(0, 0.55, u), moving: true };
}

export const Frame0: React.FC<{ t: number; orb?: boolean; orbOpacity?: number }> = ({ t, orb = false, orbOpacity = 1 }) => {
  const p = pageIn(t);
  return (
    <>
      <PriceList t={t} pose={p.pose} moving={p.moving} opacity={p.opacity} />
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
function pageState(t: number): { pose: PagePose; fade: number; moving: boolean } | null {
  if (t < M.glide[0]) return { pose: hookPose(t), fade: 1, moving: t > 0 };
  if (t >= MORPH[0]) return null;
  // the glide takes the push over mid-move (the push runs on under the mix, so the speed never drops to zero)
  const g = tween(t, M.glide, [0, 1], EASE.inOut);
  const base = hookPose(Math.min(t, M.glide[1]));
  const pose = { x: mix(base.x, PAGE_1.x, g), y: mix(base.y, PAGE_1.y, g), s: mix(base.s, PAGE_1.s, g) };
  return { pose, fade: 1 - tween(t, LINES_OUT, [0, 1], EASE.in3), moving: g < 1 };
}
/** the row's face comes up on the paper AS its lines go (a crossfade that starts on the page itself), so the folding
 *  card is never blank */
const FACE_IN = [LINES_OUT[1] - 1, MORPH[0] + 2] as const;
/** the paper folding into the first row: one card (its rect, corner and lift interpolated, positioned by a sub-pixel
 *  transform), the row's face coming up on it as it narrows to the row — never a blank card. Before MORPH the paper is
 *  still the page (PriceList draws it): only the face rides on it. The face is laid out at the card's CURRENT width,
 *  so its right-set type word ("PDF") is never clipped by the narrowing card. */
export const FoldCard: React.FC<{ t: number }> = ({ t }) => {
  if (t < FACE_IN[0] || t > M.rows[0] + 6) return null;
  const paper = t >= MORPH[0];
  const u = paper ? tween(t, MORPH, [0, 1], EASE.house) : 0;
  const from = { x: PAGE_1.x, y: PAGE_1.y, w: PAGE.w * PAGE_1.s, h: PAGE_H * PAGE_1.s, r: 14 * PAGE_1.s };
  const to = { x: ROWS.x, y: rowY(0), w: ROWS.w, h: ROWS.h, r: 20 };
  const r = { x: mix(from.x, to.x, u), y: mix(from.y, to.y, u), w: mix(from.w, to.w, u), h: mix(from.h, to.h, u), rad: mix(from.r, to.r, u) };
  // the row's own card takes over as it lands on the folded paper
  const o = 1 - tween(t, [M.rows[0] + 1, M.rows[0] + 5], [0, 1], EASE.inOut);
  const face = tween(t, FACE_IN, [0, 1], EASE.inOut);
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
        background: paper ? '#ffffff' : undefined,
        overflow: 'hidden',
        boxShadow: paper ? `inset 0 0 0 1.25px rgba(228, 224, 235, ${u.toFixed(3)}), ${meshElevation(mix(3, 0.7, u), ink, mix(1, 0.8, u))}` : undefined,
        opacity: o < 0.999 ? o : undefined,
        ...subpixel(`translate(${r.x.toFixed(3)}px, ${r.y.toFixed(3)}px)`, u < 1),
      }}
    >
      {face > 0.002 ? (
        <div style={{ position: 'absolute', left: 0, top: (r.h - ROWS.h) / 2, width: r.w, height: ROWS.h, opacity: face < 0.999 ? face : undefined }}>
          <RowFace k={0} />
        </div>
      ) : null}
    </div>
  );
};

/* ── the five documents' pose ── */
/** b8: the documents step BACK behind the owner's field — × .8 (x 212–868: clear of her ● AVA tag at x 92–178) and down
 *  under the card (from y 480; the card is y 470–783) — and go: nothing ghosts round the field (no stray row text by
 *  her tag or under the card's foot) */
const STEP_BACK: StackPose = { z: 0.8, ax: 540, ay: ROWS.y, dx: 0, dy: 480 - ROWS.y, opacity: 0, shade: 0, moving: false };
/** b9: they come FORWARD from just behind their rest (× .95, 28 px low), the moment the field has nearly gone — a quick
 *  ease-out to ink, so the handover into the thesis is one beat: field out → documents in → "Where" rising */
const FWD_FROM: StackPose = { z: 0.95, ax: 540, ay: ROWS.y, dx: 0, dy: 28, opacity: 0, shade: 0, moving: false };
const FWD = [M.fieldOut + 1.5, M.fieldOut + 15.5] as const;
/** the end card: pulled back and up into a compact stack over the CTA (y 356–666), dimmed */
export const PULLED: StackPose = { z: 0.6, ax: 540, ay: ROWS.y, dx: 0, dy: -20, opacity: 0.5, shade: 0, moving: false };
/** the end card's pull-back: during "so."'s hold, so the stack is up and back before the CTA rises */
export const pullAt = (t: number) => tween(t, [M.so + 1, M.so + 17], [0, 1], EASE.inOut);
export function stackPose(t: number, step = 0): StackPose {
  const back = tween(t, [M.fieldUp, M.fieldUp + 12], [0, 1], EASE.inOut);
  const fwd = tween(t, FWD, [0, 1], EASE.out3);
  let p = t < FWD[0] ? blendPose(REST, STEP_BACK, back) : blendPose(FWD_FROM, REST, fwd);
  if (step > 0) p = blendPose(p, PULLED, step);
  // out under the card's light
  const out = tween(t, [T.IMPACT - 6, T.IMPACT + 1], [0, 1], EASE.in3);
  return { ...p, opacity: p.opacity * (1 - out), moving: p.moving || (back > 0 && back < 1) || (fwd > 0 && fwd < 1) || (out > 0 && out < 1) };
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
      {ps ? <PriceList t={t} pose={ps.pose} moving={ps.moving} lands={M.lands} priceAt={M.eightyFive} fade={ps.fade} /> : null}
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
