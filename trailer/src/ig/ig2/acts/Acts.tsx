/**
 * REEL 2 · "Booked after hours" — THE ACTS (docs/ig/SCRIPT.md ig2 §3–4), each drawing the stage parts (../Stage.tsx,
 * pure functions of the absolute frame) that are visible in its window:
 *
 *   hook    [0, PICKUP)       b1: frame 0 — the night, the "9:47 pm." lockup ringing (its colon the rose line light),
 *                             "You're closed." → "Watch it book / this call.", the panel's edge peeking up from the foot
 *   call    [PICKUP, HANGUP)  b2–b9: the click; the figures leave, the colon light springs open into her teal orb and
 *                             glides to the label band; the panel rises; the call as it happens (her rows, the caller's
 *                             meter rows, the availability check, the slots, "Ten", "Maya", "booked")
 *   booked  [HANGUP, end)     b10: the header swaps to Booked; the panel folds to it and steps back; the EventCard and the
 *                             RecordCard land on 16ths; "Calendar booking comes with Pro." with the PRO + BETA chips
 *   end     [end, END)        b11–b13: the shared end card (components/End.tsx) over the gate's cards, which pull back and
 *                             dim; in the seam her orb glides back to the colon and closes into the rose light as the
 *                             lockup rises into place (frame 0's composition, mid-ring)
 */
import React from 'react';
import { EASE, mix, smooth, tween } from '../../../lib/motion';
import { mixColor } from '../../../lib/lights';
import { useKitFaces } from '../../../kb/kit';
import { CAP_OUT, CAPTION_BAND, Captions } from '../../components/Captions';
import { endGroundKey, IgEnd } from '../../components/End';
import { AvaOrb, orbTrack } from '../../components/Orb';
import { useActFrame } from '../../scene';
import { EVENT, EventCard, type CardPose, type Rect } from '../Cards';
import { lockColon } from '../Clock';
import { CallPanel, DOT, Ground2, groundKey, Ig2Frame0, orbPose, PANEL, PARK } from '../Stage';
import * as T from '../timing';

const M = T.M;
/** THE SEAM (fix round 2): she goes home BEFORE frame 0's figures rise — across to the colon while the brand leaves up
 *  (the figures are still under their masks; they rise from END − 13), on a shallow arc (SEAM_ARC px above the straight
 *  line, sin), closing into the rose line light on the way, so she is in the colon's slot (Ø ≤ 52 in its 107 px) as
 *  the "9" surfaces and the dot from 830: never a small rose dot beside a visible "9" (it read as an apostrophe, "9’47") */
const SEAM_ARC = 28;
const HOME = [T.END_CARD.seam - 10, T.END_CARD.seam + 2] as const;
const CLOSE = { at: T.END_CARD.seam - 6, dur: 10 } as const;
/** … and the end card's light goes out WITH the brand (over the 6 f after the wordmark starts leaving), so frame 0
 *  re-forms in the night, never through an empty lilac ellipse (fix round 2: it lingered ≈ ⅓ s) */
const LIGHT_OUT = 0.36;
const lightTail = (u: number) => 1 - smooth(0, LIGHT_OUT, u);
const BRAND_OUT = T.END_CARD.seam - CAP_OUT;
const lightLeft = (t: number) => (t <= BRAND_OUT ? 1 : lightTail(Math.min(1, (t - BRAND_OUT) / Math.max(1, T.DURATION - 1 - BRAND_OUT))));
const track = () => orbTrack(T, { listen: T.CALLERS.map(([a, b]) => [a, b] as const) });

/* ── the gate's camera and the end card's pull-back, per card (every card stays its own small layer) ── */
/** the stack's top centre: the camera pushes about it, the end card pulls the stack up and back about it */
const O = { x: PANEL.x + PANEL.w / 2, y: PANEL.y };
/** the end card: the stack pulls back to a compact receipt above the CTA (top at y ≈ 300, its left edge ≈ 60 px clear of
 *  her parked orb), dimmed */
const PULL = { scale: 0.66, dx: 76, dy: -300, shade: 0.58 } as const;

/** the pull-back: it starts as the gate line ends (a few frames before the end card's field rises, so the field never
 *  meets the EventCard), over 18 f. It CURVES round her parked orb: the step back and the drift right lead (power3.out),
 *  the rise follows (the house in-out) — a straight line would carry the record's corner under her orb */
const PULL_AT = T.END_CARD.field - 8;
const pullU = (t: number) => tween(t, [PULL_AT, PULL_AT + 18], [0, 1], (x) => x);

export function groupPose(t: number) {
  const u = pullU(t);
  const across = EASE.out3(u);
  const up = EASE.inOut(u);
  const push = 1 + 0.03 * tween(t, [M.cards[1], T.END_CARD.impact], [0, 1], EASE.inOut);
  const z = push * mix(1, PULL.scale, across);
  const dx = mix(0, PULL.dx, across);
  const dy = mix(0, PULL.dy, up);
  const fade = 1 - tween(t, [T.IMPACT - 6, T.IMPACT + 1], [0, 1], EASE.in3);
  const moving = (t > M.cards[1] && t < T.END_CARD.impact) || (u > 0 && u < 1);
  return { z, dx, dy, shade: PULL.shade * up, opacity: fade, moving };
}
const cardPose = (r: Rect, g: ReturnType<typeof groupPose>): CardPose => {
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  return { dx: O.x + g.z * (c.x - O.x) + g.dx - c.x, dy: O.y + g.z * (c.y - O.y) + g.dy - c.y, scale: g.z, shade: g.shade, opacity: g.opacity, moving: g.moving };
};

/** the gate's stack at t: the call's record (the folded panel) and the EventCard under the act's camera (and the end card's step) */
const Stack: React.FC<{ t: number }> = ({ t }) => {
  const g = groupPose(t);
  const header = cardPose({ x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.hFold }, g);
  return (
    <>
      <CallPanel t={t} pose={t >= M.fold ? header : undefined} />
      <EventCard t={t} at={M.cards[0]} pro={M.pro} beta={M.beta} pose={cardPose(EVENT, g)} />
    </>
  );
};

/** her orb: born out of the colon light on the pickup, gliding to the label band, parked */
const Orb2: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < M.birth - 1) return null;
  return <AvaOrb t={t} pose={orbPose(t)} canvas={PARK.d} track={track()} born={{ at: M.birth, dot: DOT }} shadow={0} />;
};

/* ── hook ── */
export const Hook2: React.FC = () => {
  const f = T.SCENES.hook.from + useActFrame(T.SCENES, 'hook');
  return (
    <>
      <Ground2 t={f} />
      <CallPanel t={f} />
      <Ig2Frame0 t={f} />
    </>
  );
};

/* ── call ── */
export const Call2: React.FC = () => {
  const f = T.SCENES.call.from + useActFrame(T.SCENES, 'call');
  return (
    <>
      <Ground2 t={f} />
      {f < T.PICKUP + 12 ? <Ig2Frame0 t={f} /> : null}
      <CallPanel t={f} />
      <Orb2 t={f} />
    </>
  );
};

/* ── booked: the gate ── */
const GATE_KEYS = [{ words: [4], ink: '#c4a8ff', glint: '#f7f3ff' }] as const;
const GateCaption: React.FC<{ t: number }> = ({ t }) => <Captions T={T} id="ig2-06" t={t} place={{ ...CAPTION_BAND, tone: 'night' }} keys={GATE_KEYS} what="gate caption" />;

export const Booked2: React.FC = () => {
  const f = T.SCENES.booked.from + useActFrame(T.SCENES, 'booked');
  return (
    <>
      <Ground2 t={f} />
      <Stack t={f} />
      <Orb2 t={f} />
      <GateCaption t={f} />
    </>
  );
};

/* ── end ── */
/** the card's ground: her teal key at the orb, handing to the backlight's light; frame 0's (tm < 0) is the hook's */
function endGround(tm: number) {
  if (tm < 0) return <Ground2 t={tm} keyLight={groundKey(tm)} />;
  const orb = groundKey(tm);
  const key0 = endGroundKey(T, tm, true);
  const key = { ...key0, strength: key0.strength * lightLeft(tm) };
  const k = Math.min(1, key.strength / 0.5);
  return <Ground2 t={tm} keyLight={k > 0.001 ? { x: mix(orb.x, key.x, k), y: mix(orb.y, key.y, k), strength: mix(orb.strength, key.strength, k), color: mixColor(orb.color, key.color, k), radius: mix(orb.radius, 900, k), pool: orb.pool } : orb} />;
}

export const End2: React.FC = () => {
  const f = T.SCENES.end.from + useActFrame(T.SCENES, 'end');
  const c = lockColon();
  return (
    <IgEnd
      T={T}
      t={f}
      tone="night"
      ground={(tm) => endGround(tm)}
      backdrop={() => (
        <>
          <Stack t={f} />
          <GateCaption t={f} />
        </>
      )}
      orb={() => {
        // the seam: as the brand leaves she goes home to the colon and closes into the phone's rose light, a ring already
        // in flight — frame 0's dot, exactly
        const u = tween(f, HOME, [0, 1], (x) => x);
        const g = EASE.inOut(u);
        const pose = { x: mix(PARK.x, c.x, g), y: mix(PARK.y, c.y, g) - SEAM_ARC * Math.sin(Math.PI * u), d: PARK.d, moving: u > 0 && u < 1 };
        return <AvaOrb t={f} pose={pose} canvas={PARK.d} track={track()} shadow={0} close={{ ...CLOSE, dot: DOT, t0: T.DURATION, rings: M.ringTrain }} />;
      }}
      seam={(th) => <Ig2Frame0 t={th} dot={false} />}
      lightTail={lightTail}
    />
  );
};
