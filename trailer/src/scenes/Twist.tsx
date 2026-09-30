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
 *   t 90…120 dive into the screen (pull-back, EASE.peel); ring 2 at 98
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
import { HOOK_LINE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { ORB } from '../theme';
import { TWIST } from '../timing';
import { Door } from './twist/Door';
import { avatarOnPhone, buzz, camAt, layerXf, project, twistGeo, TW, xfCss, type LayerXf } from './twist/geometry';
import { useDisplayFontReady, useTextLayout } from './twist/measure';
import { Phone, screenState } from './twist/Phone';
import { Rings } from './twist/Rings';
import { buildShards, Shards } from './twist/Shards';

const K = { bg: 0.2, mid: 0.6, text: 1, dust: 1.4 };

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

  /* ── screen-space avatar (becomes the call's orb) ─────────────────── */
  const orbAt = (tt: number) => {
    const x = layerXf(camAt(tt, g), K.mid);
    const p = project(x, L, g.phone.cx, g.phone.cy);
    const bz = buzz(tt, x.f);
    const pop = Math.max(0, aos(tt, TWIST.phoneOn + 3, { anticip: 0, depth: 0, config: SPRING.pop }));
    return { x: p.x + bz.x, y: p.y + bz.y, d: avatarOnPhone(tt, g) * x.f * pop };
  };
  const orb = orbAt(t);
  const orbOpacity = tween(t, [TWIST.phoneOn + 3, TWIST.phoneOn + 7], [0, 1], EASE.out3);
  const volumeAt = (fr: number) => {
    const tt = fr - 8;
    const shiver = tween(tt, [TWIST.ring2, TWIST.ring2 + 4], [0, 1], EASE.out3) * tween(tt, [TWIST.ring2 + 8, TWIST.ring2 + 20], [1, 0], EASE.inOut);
    return 0.12 + 0.12 * shiver + 0.1 * tween(tt, TWIST.pushToPhone, [0, 1], EASE.inOut);
  };
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
          <Phone t={t} g={g} L={L} f={xMid.f} />
        </div>
      </LayerX>

      {/* screen space — the rings and Ava's orb */}
      <AbsoluteFill>
        <Rings
          t={t}
          starts={[TWIST.ring2, TWIST.ring2 + 9]}
          orbAt={orbAt}
          reach={(tt) => L.pick(640, 540) * layerXf(camAt(tt, g), K.mid).f}
          fade={1 - tween(t, [TWIST.pushToPhone[1] - 8, TWIST.pushToPhone[1]], [0, 1], EASE.inOut)}
        />
        {t >= TWIST.phoneOn + 3 && orb.d > 0.5 ? (
          <div
            style={{
              position: 'absolute',
              left: orb.x - orb.d / 2,
              top: orb.y - orb.d / 2,
              opacity: orbOpacity,
            }}
          >
            <Orb size={orb.d} palette={ORB.ink} volume={volumeAt(t + 8)} time={flowTime(Math.max(0, Math.round(t + 8)), volumeAt)} />
          </div>
        ) : null}
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

      <Vignette strength={bgIn * (1 - 0.6 * dive)} />
    </AbsoluteFill>
  );
};
