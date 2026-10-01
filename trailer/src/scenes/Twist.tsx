/**
 * 4–8 s · TWIST — the type shatters and recomposes into the tagline;
 * the door shuts, the phone lights up, and the camera dives into it.
 *
 *   t −8…0  the hook's line, gathering itself (scale → 0.975, tremble)
 *   t 0     SHATTER on the downbeat; the lit doorway is revealed behind
 *   t 8…    shards fly back as "Closed is for the door," (word by word)
 *   t 30    the door slams as "door," lands — slit, shake, dust
 *   t 38    CLOSED swings in on the door
 *   t 45    "not the phone." rises, turns lilac at 51
 *   t 53    the phone powers on: INCOMING CALL, Ava's orb, the number
 *   t 90…120 dive into the screen (pull-back, EASE.peel); the frozen ring resumes at 98
 *   t 104…    the screen takes the frame: the orb becomes the room's key light (its pool,
 *             the falloff away from it, a 1.5 % breath push); the pool gathers into the
 *             orb with the pickup squash, and the call's pickup flash releases it
 *   t 120…132 held: the screen fills the frame, the orb is CALL_ORB_START
 *
 * Parallax (pinhole dolly, see twist/geometry.ts): bg field 0.2,
 * door + phone 0.6, text 1.0, dust 1.4.
 */

// Fine-cut timing: TWIST_LOCAL in src/timing.ts (read here via ./twist/geometry `TW`).
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { Dust } from '../components/Dust';
import { Vignette } from '../components/Grain';
import { Orb, flowTime } from '../components/Orb';
import { CALL_ORB_START, HOOK_LINE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { ORB_RIM, PICKUP_GLOW, pickupGlow, pickupRimSpread } from '../lib/pickup';
import { useSceneFrame } from '../lib/scene';
import { ORB } from '../theme';
import { CALL_LOCAL, SCENES, TWIST } from '../timing';
import { AVA_GLOW, KeyLight, MidnightVignette } from './call/Light';
import { orbBase } from './call/shots';
import { BokehPlane, bokehPlanes } from './twist/Bokeh';
import { Door } from './twist/Door';
import { buzz, camAt, layerXf, project, twistGeo, TW, xfCss, type LayerXf } from './twist/geometry';
import { useDisplayFontReady, useTextLayout } from './twist/measure';
import { Phone, screenState } from './twist/Phone';
import { Burst, Rings } from './twist/Rings';
import { avatarAt, breath, callRimAt, orbFlowVolume, orbListen, orbShaderVolume, TP } from './twist/handover';
import { buildShards, Shards } from './twist/Shards';

const K = { bg: 0.2, mid: 0.6, text: 1, dust: 1.4 };
const G0 = SCENES.twist.from; // global = twist-local + G0


const LayerX: React.FC<{ x: LayerXf; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  children,
  style,
}) => (
  <AbsoluteFill style={{ transform: xfCss(x), transformOrigin: '50% 50%', ...style }}>{children}</AbsoluteFill>
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
  const xBg = layerXf(cam, K.bg);
  const xMid = layerXf(cam, K.mid);
  const xText = layerXf(cam, K.text);
  const xDust = layerXf(cam, K.dust);
  const bgIn = tween(t, [0, 4], [0, 1], EASE.out3);
  const dive = tween(t, TWIST.pushToPhone, [0, 1], EASE.peel);
  const scr = screenState(t);

  /* ── screen-space avatar (becomes the call's orb) ─────────────────── *
   * On the phone it rides the phone plane; over orbLock it settles onto
   * CALL_ORB_START; from the call's roomIn it IS the call's orb (handover.ts). */
  const O = CALL_ORB_START(L);
  const orbAt = (tt: number) => avatarAt(tt, g, L);
  const orb = orbAt(t);
  const orbOpacity = tween(t, [TW.avatarPop, TW.avatarPop + 4], [0, 1], EASE.out3);
  const orbVol = orbShaderVolume(t);
  const orbFlow = flowTime(Math.max(0, t + 8), orbFlowVolume);
  // the call's canvas (orbBase at 1.25, framed by transform) once the orb is big —
  // the switch happens inside the dive's fastest frames; from the call's roomIn the
  // two scenes' orbs are then the same pixels
  const B = orbBase(L);
  const baseMode = orb.d >= 0.3 * B;
  const kOrb = orb.d / B;
  // simulated motion blur: the dive throws the avatar sideways and grows it
  const o0 = orbAt(t - 0.5);
  const o1 = orbAt(t + 0.5);
  // gaussian σ ≈ 0.29 × the trail of a 180° shutter (½ the frame's travel); only on fast frames
  const vX = Math.abs(o1.x - o0.x);
  const vD = Math.abs(o1.d - o0.d);
  const smearX = vX > 6 ? Math.min(18, vX * 0.14) : 0;
  const smearR = vD > 10 ? Math.min(4, vD * 0.03) : 0;
  // (none once the call draws the same orb: from its roomIn the pixels must match)
  const smear = smearX + smearR > 0.3 && t < TP + CALL_LOCAL.roomIn[0] ? { x: smearX + smearR, y: smearR } : null;
  // the rim light + the outer glow (lib/pickup), from orbDress on
  const dress = tween(t, TW.orbDress, [0, 1], EASE.out3);
  const rimA = t >= TP ? callRimAt(t - TP) : pickupGlow(t + G0);
  // the dive's zoom relative to its end (bokeh parallax; the field's breath push rides on it)
  const fieldPush = 1 + 0.015 * tween(t, TW.fieldPush, [0, 1], EASE.inOut);
  const Z = Math.min(1, xMid.f / g.S) * fieldPush;
  const bokehOp = tween(t, [TW.bokeh[0], TW.bokeh[0] + 8], [0, 1], EASE.inOut);
  const planes = bokehPlanes(L);
  const scrTL = project(xMid, L, g.phone.cx - g.screen.w / 2, g.phone.cy - g.screen.h / 2);
  const scrBox = { left: scrTL.x, top: scrTL.y, w: g.screen.w * xMid.f, h: g.screen.h * xMid.f, r: g.screen.r * xMid.f };
  const screenClip = (children: React.ReactNode) => (
    <div
      style={{
        position: 'absolute',
        left: scrBox.left,
        top: scrBox.top,
        width: scrBox.w,
        height: scrBox.h,
        borderRadius: scrBox.r,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: -scrBox.left, top: -scrBox.top, width: L.width, height: L.height }}>{children}</div>
    </div>
  );
  const bz = buzz(t, xMid.f);
  // the phone is found in the dark once "closed" has slid off it
  const phoneIn = tween(t, TW.phoneReveal, [0, 1], EASE.inOut);

  /* ── focus: door soft, sharpens as it slams, softens as the phone wakes ── */
  const doorDof =
    1.3 -
    0.9 * tween(t, [TWIST.doorSlam - 2, TWIST.doorSlam + 6], [0, 1], EASE.inOut) +
    0.2 * tween(t, [TWIST.phoneOn - 4, TWIST.phoneOn + 10], [0, 1], EASE.inOut);
  const doorDim = 1 - 0.12 * tween(t, [TWIST.phoneOn, TWIST.phoneOn + 16], [0, 1], EASE.inOut);

  /* ── motion-blur ghosts for the layers that rush out in the dive ── */
  const layerSpeed = (k: number) => {
    const a = layerXf(camAt(t, g), k);
    const b = layerXf(camAt(t - 0.5, g), k);
    const pa = project(a, L, g.text.cx, g.text.cy);
    const pb = project(b, L, g.text.cx, g.text.cy);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) * 2 + Math.abs(a.f - b.f) * 600;
  };
  // sub-frame copies, faded in with the layer's speed (no pop), each one
  // softer and fainter down the shutter: a smear, not a comb
  const ghosts = (k: number, n: number) => {
    const w = tween(layerSpeed(k), [14, 40], [0, 1], EASE.inOut);
    if (w < 0.02) return [];
    return Array.from({ length: n }, (_, i) => {
      const u = (i + 1) / (n + 1);
      return { k: 0.85 * u, op: (w * 0.34 * (1 - u)) / Math.sqrt(n), blur: 2 + 7 * u };
    });
  };
  /* ── the focus beat of the hold: the 3-word payoff takes the read ── */
  const fk = tween(t, TW.keyFocus, [0, 1], EASE.inOut);
  const gl = (t - TW.keyGlint[0]) / (TW.keyGlint[1] - TW.keyGlint[0]);
  const focus = {
    dim: 1 - 0.55 * fk,
    key: fk,
    swell: 1 + 0.03 * aos(t, TW.keyFocus[0], { anticip: 3, depth: 0.12, config: SPRING.site }),
    glint: gl >= 0 && gl <= 1 ? EASE.inOut(gl) : -1,
  };
  /* ── the room's falloff: never a flat indigo field ──────────────────
   * Until the screen overfills the frame, the phone's dark surroundings are
   * the falloff; as they leave, the cover vignette hands over to the call's
   * MidnightVignette (roomVignette), which the call holds from its roomIn.
   * The call's grade (CALL_LOCAL.roomGrade, its own curve) is followed here
   * too — the screen and the room are the same pixels at the hand-over. */
  const fall = tween(t, TW.roomFalloff, [0, 1], EASE.inOut);
  const callGrade = tween(t - TP, CALL_LOCAL.roomGrade, [0, 1], EASE.inOut);
  const roomK = Math.max(TW.roomVignette * fall, callGrade);
  /* ── the orb as the room's KEY LIGHT (TW.keyLight) ───────────────────
   * As the screen takes the frame the indigo stops being a flat field: the room
   * falls off away from the orb (a darkening centred on it, relaxed as the call's
   * grade takes the room down to the midnight) and the orb's light pools on it
   * (the call's KeyLight, Ava's glow). A 1.5 % breath push carries the lit field
   * into the pickup; the pool breathes with the orb, then gathers into it with the
   * pickup squash (PICKUP − 6 … PICKUP) — the call's pickup flash is its release. */
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
  const textBlur = Math.max(0, (xText.f - 1) * 3);
  const dustFade = 1 - tween(xDust.f, [1.3, 2.6], [0, 1], EASE.in2);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* night (fades in over the hook, under the shards) */}
      <AbsoluteFill style={{ background: '#06040a', opacity: bgIn }} />

      {/* 0.2 — the field: pigment wash, the phone's lilac on the far wall */}
      <LayerX x={xBg} style={{ opacity: bgIn }}>
        <AbsoluteFill
          style={{
            background: L.pick(
              'radial-gradient(60% 55% at 50% 30%, rgba(85,26,137,0.20), rgba(85,26,137,0) 72%)',
              'radial-gradient(90% 40% at 50% 38%, rgba(85,26,137,0.20), rgba(85,26,137,0) 72%)',
            ),
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(${L.pick('38% 60%', '70% 34%')} at ${((g.phone.cx / L.width) * 100).toFixed(1)}% ${(
              (g.phone.cy / L.height) *
              100
            ).toFixed(1)}%, rgba(124,58,237,0.20), rgba(124,58,237,0) 70%)`,
            opacity: scr.on,
          }}
        />
      </LayerX>

      {/* 0.6 — the door (with ghosts when it rushes out) */}
      {xMid.f < 3.2
        ? [...ghosts(K.mid, 4), { k: 0, op: 1, blur: 0 }].map(({ k, op, blur }) => (
            <LayerX key={`door${k}`} x={layerXf(camAt(t - k, g), K.mid)} style={{ opacity: op }}>
              <Door t={t - k} g={g} L={L} dof={doorDof + blur} opacity={doorDim} />
            </LayerX>
          ))
        : null}

      {/* 0.6 — the phone, its floor glow */}
      <LayerX x={xMid}>
        {xMid.f < 2.6 ? (
          <div
            style={{
              position: 'absolute',
              left: g.phone.cx - g.phone.w * 1.3,
              top: g.phone.cy + g.phone.h / 2 + L.pick(26, 22),
              width: g.phone.w * 2.6,
              height: 70,
              background: 'radial-gradient(closest-side, rgba(185,163,255,0.22), rgba(185,163,255,0))',
              opacity: scr.on * (1 - dive),
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: phoneIn,
            transform: `translate(${(bz.x / xMid.f).toFixed(3)}px, ${(bz.y / xMid.f).toFixed(3)}px) rotate(${bz.rot.toFixed(3)}deg)`,
            transformOrigin: `${g.phone.cx}px ${g.phone.cy}px`,
          }}
        >
          <Phone t={t} g={g} L={L} f={xMid.f} grade={callGrade} />
        </div>
      </LayerX>

      {/* screen space — the far bokeh (0.5×), the rings, the glow + rim, Ava's orb, the near bokeh (1.5×) */}
      <AbsoluteFill>
        {bokehOp > 0.005
          ? screenClip(
              <BokehPlane t={t - TP} discs={planes.far} Z={Z} k={0.5} c={orb} O={O} opacity={bokehOp} drift={2.2} />,
            )
          : null}
        {/* the room falls off away from the orb, and the orb's light pools on it (see keyIn) */}
        {falloffCss ? <AbsoluteFill style={{ background: falloffCss }} /> : null}
        {keyK > 0.003 ? <KeyLight x={orb.x} y={orb.y} d={orb.d} glow={AVA_GLOW} strength={keyK} spread={keySpread} /> : null}
        {/* the hook's frozen ring resumes: ONE wave (its second pulse) — the call's line is "Picked up on the first ring." */}
        <Rings
          t={t}
          starts={[TWIST.ring2]}
          orbAt={orbAt}
          reach={(tt) => L.pick(640, 540) * layerXf(camAt(tt, g), K.mid).f}
          fade={1 - tween(t, [TWIST.pushToPhone[1] - 8, TWIST.pushToPhone[1]], [0, 1], EASE.inOut)}
        />
        <Burst t={t} span={[TW.avatarPop, TW.avatarPop + 10]} orbAt={orbAt} to={2.2} op={0.55} />
        <Burst t={t} span={TW.ring3} orbAt={orbAt} to={2.6} op={0.4} />
        {t >= TW.avatarPop && orb.d > 0.5 ? (
          <>
            {dress > 0.005 ? (
              <>
                {/* the outer glow: a disc behind the canvas (lib/pickup PICKUP_GLOW) */}
                <div
                  style={{
                    position: 'absolute',
                    left: orb.x - orb.d / 2,
                    top: orb.y - orb.d / 2,
                    width: orb.d,
                    height: orb.d,
                    borderRadius: '50%',
                    boxShadow: PICKUP_GLOW(t + G0, orb.d / 300),
                    opacity: dress,
                  }}
                />
                {/* the rim light — exactly the call's (lib/pickup ORB_RIM) */}
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
              </>
            ) : null}
            {smear ? (
              <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
                <defs>
                  <filter id="twist-orb-smear" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur
                      stdDeviation={`${(smear.x / (baseMode ? kOrb : 1)).toFixed(2)} ${(smear.y / (baseMode ? kOrb : 1)).toFixed(2)}`}
                    />
                  </filter>
                </defs>
              </svg>
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
                  ? `translate(${(orb.x - B / 2).toFixed(2)}px, ${(orb.y - B / 2).toFixed(2)}px) scale(${kOrb.toFixed(5)})`
                  : `translate(${(orb.x - orb.d / 2).toFixed(2)}px, ${(orb.y - orb.d / 2).toFixed(2)}px)`,
                opacity: orbOpacity < 1 ? orbOpacity : undefined,
                filter: smear ? 'url(#twist-orb-smear)' : undefined,
              }}
            >
              <Orb
                size={baseMode ? B : orb.d}
                palette={ORB.ink}
                paletteB={ORB.listen}
                mixB={orbListen(t)}
                volume={orbVol}
                time={orbFlow}
                resolution={baseMode ? 1.25 : 1.5}
              />
            </div>
          </>
        ) : null}
        {bokehOp > 0.005
          ? screenClip(<BokehPlane t={t - TP} discs={planes.near} Z={Z} k={1.5} c={orb} O={O} opacity={bokehOp} />)
          : null}
      </AbsoluteFill>

      {/* 1.0 — the words (ghosted + blurred as the camera flies through them) */}
      {xText.alive && textFade > 0.01
        ? [...ghosts(K.text, 6), { k: 0, op: 1, blur: 0 }].map(({ k, op, blur }) => (
            <LayerX key={`text${k}`} x={layerXf(camAt(t - k, g), K.text)} style={{ opacity: op * textFade }}>
              <Shards
                t={t - k}
                L={L}
                hook={hook}
                tag={tag}
                shards={shards}
                ghost={k > 0}
                extraBlur={k > 0 ? 0 : textBlur}
                layerBlur={k > 0 ? textBlur + blur : 0}
                focus={focus}
              />
            </LayerX>
          ))
        : null}

      {/* 1.4 — motes, nearest the lens */}
      {xDust.alive && dustFade > 0.01 ? (
        <LayerX x={xDust} style={{ opacity: bgIn * dustFade }}>
          <Dust count={22} seed="twist-motes" opacity={0.3} size={[2, 7]} blur={[0.5, 3.5]} speed={0.35} frame={t + 400} />
        </LayerX>
      ) : null}

      {/* the cover's falloff while the phone sits in the night, then the call's midnight falloff */}
      <Vignette strength={bgIn * (1 - 0.6 * dive) * (1 - fall)} />
      <MidnightVignette k={roomK} />
    </AbsoluteFill>
  );
};
