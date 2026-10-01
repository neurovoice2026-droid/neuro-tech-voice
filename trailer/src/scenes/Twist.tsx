/**
 * 4–8 s · TWIST — the type breaks and recomposes into the tagline; the door
 * shuts, the phone wakes, and the camera dives into it.
 *
 *   t −8…0  the hook's line inhales (scale → 0.975)
 *   t 0     SHATTER on the downbeat; the lit doorway is revealed behind
 *   t 8…    the letters fly back as "Closed is for the door," (word by word,
 *           each turning over like a card to change its glyph)
 *   t 30    the door slams as "door," lands; the light dies under it; the
 *           slam sets the CLOSED sign swinging on its cord
 *   t 45    "not the phone." rises, takes the night's lilac at 51
 *   t 53    the phone wakes: its light spreads from the avatar (a soft radial wake), Ava's
 *           orb pops, INCOMING CALL and the number type in; the screen is lit by the orb and
 *           falls off to the glass (handed to the frame's falloff in the dive); the ring's
 *           waves live on the glass (clipped to the screen until it overfills the frame)
 *   t 75    the focus beat: the setup steps back, the payoff steps forward (its ink lifts; no sheen)
 *   t 90…120 dive into the screen (pull-back, EASE.peel); the frozen ring resumes at 98
 *   t 104…  the screen takes the frame: the orb becomes the room's key light (its pool,
 *           the falloff away from it, a 1.5 % breath push); the pool gathers into the
 *           orb with the pickup squash, and the call's pickup flash releases it
 *   t 120…132 held: the screen fills the frame, the orb is CALL_ORB_START
 *
 * THE LOOK — a premium night: a near-black room (Atmosphere NightRoom) lit by
 * one motivated source at a time — the doorway's warm silver, then the
 * phone's screen. Type in TYPE.display (Instrument Sans 440, −0.03em), the
 * key phrase in the night's lilac. Nothing is blurred, smeared or ghosted;
 * there is no bokeh, no dust, no shake: the 120 fps master and continuous
 * curves carry every move. Text and the planes it sits on go on a compositor
 * layer only while they move (sub-pixel), and are plain crisp text at rest.
 *
 * Parallax (pinhole dolly, see twist/geometry.ts): door + phone 0.6, text 1.0.
 */

// Fine-cut timing: TWIST_LOCAL in src/timing.ts (read here via ./twist/geometry `TW`).
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { NightRoom, Vignette2 } from '../components/Atmosphere';
import { Orb, flowTime } from '../components/Orb';
import { subpixel } from '../components/Type';
import { HOOK_LINE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { ORB_RIM, pickupGlow, pickupRimSpread } from '../lib/pickup';
import { useSceneFrame } from '../lib/scene';
import { C, LIGHTS, ORB } from '../theme';
import { CALL_LOCAL, SCENES, TWIST } from '../timing';
import { AVA_GLOW, KeyLight, MidnightVignette } from './call/Light';
import { orbBase } from './call/shots';
import { Door, roomLight } from './twist/Door';
import { buzz, camAt, layerXf, project, twistGeo, TW, xfCss, type LayerXf } from './twist/geometry';
import { useDisplayFontReady, useTextLayout } from './twist/measure';
import { Phone, screenState } from './twist/Phone';
import { Burst, Rings } from './twist/Rings';
import { avatarAt, breath, callRimAt, orbFlowVolume, orbListen, orbShaderVolume, TP } from './twist/handover';
import { buildShards, Shards } from './twist/Shards';

const K = { mid: 0.6, text: 1 };
const G0 = SCENES.twist.from; // global = twist-local + G0

/** The canvas's device-pixel ratio (the 4K masters render at --scale 2): the orb is sharp at any scale. */
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

/** A camera plane. While the camera moves it rides a compositor layer (sub-pixel, no 1 px stairs). */
const LayerX: React.FC<{ x: LayerXf; moving: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  moving,
  children,
  style,
}) => (
  <AbsoluteFill style={{ transformOrigin: '50% 50%', ...subpixel(xfCss(x), moving), ...style }}>{children}</AbsoluteFill>
);

export const Twist: React.FC = () => {
  const t = useSceneFrame('twist');
  const L = useLayout();
  const ready = useDisplayFontReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(() => twistGeo(L), [L.width, L.height]);
  const H = HOOK_LINE(L);
  const hook = useTextLayout({ text: H.text, fontSize: H.fontSize, left: H.left, boxWidth: H.width, cy: H.cy }, ready);
  const tag = useTextLayout(
    {
      text: 'Closed is for the door, not the phone.',
      fontSize: g.text.fontSize,
      left: g.text.cx - g.text.boxWidth / 2,
      boxWidth: g.text.boxWidth,
      cy: g.text.cy,
      rows: [
        [0, 1, 2],
        [3, 4],
        [5, 6, 7],
      ],
      trimRowEnd: true,
    },
    ready,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shards = useMemo(() => buildShards(hook, tag, L), [hook, tag]);

  /* ── before the break: only the hook's line, untouched by any camera ── */
  if (t < 0) {
    return (
      <AbsoluteFill>
        <Shards t={t} L={L} hook={hook} tag={tag} shards={shards} />
      </AbsoluteFill>
    );
  }

  const cam = camAt(t, g);
  const xMid = layerXf(cam, K.mid);
  const xText = layerXf(cam, K.text);
  // the planes are on a compositor layer only while the camera moves them
  const prev = camAt(t - 0.25, g);
  const camMoving = Math.abs(prev.dz - cam.dz) > 1e-7 || Math.abs(prev.cx - cam.cx) > 1e-4 || Math.abs(prev.cy - cam.cy) > 1e-4;
  const bgIn = tween(t, [0, 4], [0, 1], EASE.out3);
  const dive = tween(t, TWIST.pushToPhone, [0, 1], EASE.peel);
  const scr = screenState(t);

  /* ── screen-space avatar (becomes the call's orb) ─────────────────── *
   * On the phone it rides the phone plane; over orbLock it settles onto
   * CALL_ORB_START; from the call's roomIn it IS the call's orb (handover.ts). */
  const orbAt = (tt: number) => avatarAt(tt, g, L);
  const orb = orbAt(t);
  const orbOpacity = tween(t, [TW.avatarPop, TW.avatarPop + 4], [0, 1], EASE.out3);
  const orbVol = orbShaderVolume(t);
  const orbFlow = flowTime(Math.max(0, t + 8), orbFlowVolume);
  // the call's canvas (orbBase at 1.25 × dpr, framed by transform) once the orb is big —
  // from the call's roomIn the two scenes' orbs are then the same pixels
  const B = orbBase(L);
  const baseMode = orb.d >= 0.3 * B;
  const kOrb = orb.d / B;
  // the rim light (lib/pickup), from orbDress on
  const dress = tween(t, TW.orbDress, [0, 1], EASE.out3);
  const rimA = t >= TP ? callRimAt(t - TP) : pickupGlow(t + G0);
  // the dive's zoom relative to its end (the field's breath push rides on it)
  const fieldPush = 1 + 0.015 * tween(t, TW.fieldPush, [0, 1], EASE.inOut);
  const bz = buzz(t, xMid.f);
  // the phone is found in the dark once "closed" has slid off it
  const phoneIn = tween(t, TW.phoneReveal, [0, 1], EASE.inOut);
  const doorDim = 1 - 0.12 * tween(t, [TWIST.phoneOn, TWIST.phoneOn + 16], [0, 1], EASE.inOut);

  /* ── the focus beat of the hold: the 3-word payoff takes the read ── */
  // (no sheen across the type: the payoff takes the light by its own ink, which lifts on the beat)
  const fk = tween(t, TW.keyFocus, [0, 1], EASE.inOut);
  const focus = {
    dim: 1 - 0.48 * fk,
    key: fk,
    swell: 1 + 0.02 * aos(t, TW.keyFocus[0], { anticip: 3, depth: 0.12, config: SPRING.site }),
  };

  /* ── the room's light: one motivated source at a time ────────────────
   * The doorway (warm silver) while it is open — its light on the wall around it and,
   * through the threshold, the floor; then the phone's screen (the night's violet). Both
   * are NightRoom keys placed ON their source (projected through the camera). */
  const doorL = project(xMid, L, g.door.cx, g.door.top + g.door.h * 0.55);
  const phoneL = project(xMid, L, g.phone.cx + bz.x / xMid.f, g.phone.cy);
  const floorY = project(xMid, L, 0, g.floor).y;
  const dl = Math.min(1, roomLight(t));
  const doorKey = {
    x: doorL.x,
    y: doorL.y,
    color: C.silver,
    strength: 0.16 * dl,
    radius: g.door.h * 0.62 * xMid.f,
    aspect: 0.9,
    chroma: 0.3,
  };
  const phoneKey = {
    x: phoneL.x,
    y: phoneL.y,
    color: LIGHTS.night.orb[2],
    strength: 0.2 * scr.on * phoneIn,
    radius: L.pick(330, 360) * Math.pow(xMid.f, 0.8),
    aspect: L.pick(1, 1.15),
    chroma: 0.5,
  };

  /* ── the room's falloff at the hand-over ─────────────────────────────
   * As the screen overfills the frame, the phone's dark surroundings leave and the call's
   * MidnightVignette takes the frame (roomVignette), which the call holds from its roomIn.
   * The call's grade (CALL_LOCAL.roomGrade) is followed on the screen too — the screen and
   * the room are the same pixels at the hand-over. */
  const fall = tween(t, TW.roomFalloff, [0, 1], EASE.inOut);
  const callGrade = tween(t - TP, CALL_LOCAL.roomGrade, [0, 1], EASE.inOut);
  const roomK = Math.max(TW.roomVignette * fall, callGrade);
  /* ── the orb as the room's KEY LIGHT (TW.keyLight) ───────────────────
   * The room falls off away from the orb (relaxed as the call's grade takes it down to the
   * midnight) and the orb's light pools on it (the call's KeyLight, Ava's glow). A 1.5 %
   * breath push carries the lit field into the pickup; the pool breathes with the orb, then
   * gathers into it with the pickup squash — the call's pickup flash is its release. */
  const keyIn = tween(t, TW.keyLight, [0, 1], EASE.out3);
  const gather = tween(t, [TP - 6, TP], [0, 1], EASE.in2);
  const keyK = keyIn * 0.2 * (1 + 4 * breath(t)) * (1 - 0.5 * gather);
  const keySpread = L.pick(3.2, 2.6) * fieldPush * (1 - 0.2 * gather);
  const falloffK = keyIn * (1 - callGrade);
  const orbR = orb.d / 2;
  const falloffCss =
    falloffK > 0.003
      ? `radial-gradient(circle at ${orb.x.toFixed(1)}px ${orb.y.toFixed(1)}px, rgba(2,2,7,0) ${(orbR * 1.3 * fieldPush).toFixed(1)}px, ` +
        `rgba(2,2,7,${(0.42 * falloffK).toFixed(3)}) ${(orbR * 3.6 * fieldPush).toFixed(1)}px, ` +
        `rgba(1,1,4,${(0.72 * falloffK).toFixed(3)}) ${(Math.max(L.width, L.height) * 0.75 * fieldPush).toFixed(1)}px)`
      : null;
  const textFade = 1 - tween(xText.f, [1.5, 3.2], [0, 1], EASE.in2);
  // the ringing lives ON the phone's screen: its waves are clipped to the glass (a no-op once the
  // screen overfills the frame) — never a UI ring drawn across the phone's body or the room
  const scrTL = project(xMid, L, g.phone.cx - g.screen.w / 2, g.phone.cy - g.screen.h / 2);
  const scrClip = (() => {
    const x0 = scrTL.x + bz.x;
    const y0 = scrTL.y + bz.y;
    const w = g.screen.w * xMid.f;
    const h = g.screen.h * xMid.f;
    const r = g.screen.r * xMid.f;
    if (x0 <= 0 && y0 <= 0 && x0 + w >= L.width && y0 + h >= L.height) return undefined;
    return `inset(${y0.toFixed(2)}px ${(L.width - x0 - w).toFixed(2)}px ${(L.height - y0 - h).toFixed(2)}px ${x0.toFixed(2)}px round ${r.toFixed(2)}px)`;
  })();

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* the room (comes up over the hook's black, under the shards) */}
      <AbsoluteFill style={{ opacity: bgIn < 1 ? bgIn : undefined }}>
        <NightRoom
          light={doorKey}
          lights={[phoneKey]}
          floor={L.vertical ? null : { y: floorY, strength: 0.55, sheen: 0.5, bounce: 0.4, feather: 40 }}
          vignette={0.5}
        />
      </AbsoluteFill>

      {/* 0.6 — the door */}
      {xMid.f < 3.2 ? (
        <LayerX x={xMid} moving={camMoving}>
          <Door t={t} g={g} L={L} opacity={doorDim} />
        </LayerX>
      ) : null}

      {/* 0.6 — the phone */}
      <LayerX x={xMid} moving={camMoving}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: phoneIn < 1 ? phoneIn : undefined,
            transform:
              bz.x !== 0 || bz.rot !== 0
                ? `translate(${(bz.x / xMid.f).toFixed(3)}px, ${(bz.y / xMid.f).toFixed(3)}px) rotate(${bz.rot.toFixed(3)}deg)`
                : undefined,
            transformOrigin: `${g.phone.cx}px ${g.phone.cy}px`,
          }}
        >
          <Phone t={t} g={g} L={L} f={xMid.f} grade={callGrade} inner={1 - fall} glow={1 - keyIn} />
        </div>
      </LayerX>

      {/* screen space — the orb's light on the room, the rings, the rim, Ava's orb */}
      <AbsoluteFill>
        {/* the room falls off away from the orb, and the orb's light pools on it (see keyIn) */}
        {falloffCss ? <AbsoluteFill style={{ background: falloffCss }} /> : null}
        {keyK > 0.003 ? <KeyLight x={orb.x} y={orb.y} d={orb.d} glow={AVA_GLOW} strength={keyK} spread={keySpread} /> : null}
        {/* the hook's frozen ring resumes: ONE wave (its second pulse) — the call's line is "Picked up on the first ring." */}
        <AbsoluteFill style={{ clipPath: scrClip }}>
          <Rings
            t={t}
            starts={[TWIST.ring2]}
            orbAt={orbAt}
            reach={(tt) => L.pick(640, 540) * layerXf(camAt(tt, g), K.mid).f}
            fade={1 - tween(t, [TWIST.pushToPhone[1] - 8, TWIST.pushToPhone[1]], [0, 1], EASE.inOut)}
          />
          <Burst t={t} span={[TW.avatarPop, TW.avatarPop + 10]} orbAt={orbAt} to={2.2} op={0.5} />
          <Burst t={t} span={TW.ring3} orbAt={orbAt} to={2.6} op={0.35} />
        </AbsoluteFill>
        {t >= TW.avatarPop && orb.d > 0.5 ? (
          <>
            {/* the rim light — exactly the call's (lib/pickup ORB_RIM), so its cross-fade at roomIn is exact */}
            {dress > 0.005 ? (
              <div
                style={{
                  position: 'absolute',
                  left: orb.x - orb.d / 2,
                  top: orb.y - orb.d / 2,
                  width: orb.d,
                  height: orb.d,
                  borderRadius: '50%',
                  boxShadow: ORB_RIM(rimA, pickupRimSpread(orbVol)),
                  opacity: dress,
                }}
              />
            ) : null}
            {/* the orb: one canvas; the call's framing (orbBase, transform) once it is big */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: baseMode ? B : orb.d,
                height: baseMode ? B : orb.d,
                transformOrigin: '50% 50%',
                transform: baseMode
                  ? `translate(${(orb.x - B / 2).toFixed(3)}px, ${(orb.y - B / 2).toFixed(3)}px) scale(${kOrb.toFixed(5)})`
                  : `translate(${(orb.x - orb.d / 2).toFixed(3)}px, ${(orb.y - orb.d / 2).toFixed(3)}px)`,
                opacity: orbOpacity < 1 ? orbOpacity : undefined,
              }}
            >
              <Orb
                size={baseMode ? B : orb.d}
                palette={ORB.ink}
                paletteB={ORB.listen}
                mixB={orbListen(t)}
                volume={orbVol}
                time={orbFlow}
                resolution={(baseMode ? 1.25 : 1.5) * dpr()}
              />
            </div>
          </>
        ) : null}
      </AbsoluteFill>

      {/* 1.0 — the words (the camera flies through them in the dive; crisp, faded as they pass the lens) */}
      {xText.alive && textFade > 0.01 ? (
        <LayerX x={xText} moving={camMoving} style={{ opacity: textFade < 1 ? textFade : undefined }}>
          <Shards t={t} L={L} hook={hook} tag={tag} shards={shards} focus={focus} />
        </LayerX>
      ) : null}

      {/* the frame's falloff while the phone sits in the night, then the call's midnight falloff */}
      <Vignette2 strength={0.42 * bgIn * (1 - 0.6 * dive) * (1 - fall)} />
      <MidnightVignette k={roomK} />
    </AbsoluteFill>
  );
};
