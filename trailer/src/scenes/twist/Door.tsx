/**
 * The door: a tall doorway at night, full of warm silver light. The panel
 * (#171520, thin rim light) swings SHUT in 3D — a creak wider first, then
 * EASE.in4 into the slam, a 3° bounce off the stop. The light collapses to a
 * slit and dies; a puff of dust leaves the gap. Then the site's door sign,
 * "CLOSED", swings in from its top edge (elastic.out(1, .45), 0.9 s).
 */
import React from 'react';
import { random } from 'remotion';
import type { Layout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { C, FONT } from '../../theme';
import { TWIST } from '../../timing';
import { TW, type Geo } from './geometry';

const P = 1400; // perspective, px
const SILVER = '196,192,186';
const PAPER = '237,236,241';

/** GSAP elastic.out(1, 0.45). */
function elasticOut(x: number, a = 1, p = 0.45) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const s = (p / (2 * Math.PI)) * Math.asin(1 / a);
  return a * Math.pow(2, -10 * x) * Math.sin(((x - s) * (2 * Math.PI)) / p) + 1;
}

/** Panel angle in degrees (negative = open toward the camera). */
export function doorAngle(t: number): number {
  const slam = TWIST.doorSlam;
  if (t < slam) {
    const open = -75 - 4 * tween(t, [TW.doorCreak, TW.doorSwing[0] + 1], [0, 1], EASE.inOut);
    const u = Math.min(1, Math.max(0, (t - TW.doorSwing[0]) / (TW.doorSwing[1] - TW.doorSwing[0])));
    return open * (1 - EASE.in4(u));
  }
  const u = t - slam;
  if (u < 5) return -3.2 * Math.sin((Math.PI * u) / 5);
  if (u < 9) return -0.8 * Math.sin((Math.PI * (u - 5)) / 4);
  return 0;
}

/** The door is found by its light: frame + panel come up with the room. */
const doorOn = (t: number) => tween(t, [-0.5, 6], [0, 1], EASE.out3);

/** Light of the room behind the door (0..1+): switched on by the break, a
 *  surge at t≈2 (the blast), dies after the slam. */
function roomLight(t: number) {
  const reveal = tween(t, [-0.5, 5], [0, 1], EASE.out3) + (t > 0 ? 0.35 * (t / 2) * Math.exp(1 - t / 2) : 0);
  const dies = 1 - tween(t, [TWIST.doorSlam + 3, TWIST.doorSlam + 13], [0, 1], EASE.in2);
  return reveal * dies;
}

export const Door: React.FC<{ t: number; g: Geo; L: Layout; dof: number; opacity?: number }> = ({
  t,
  g,
  L,
  dof,
  opacity = 1,
}) => {
  const { w, h, cx, top } = g.door;
  const left = cx - w / 2;
  const po = { x: L.cx - left, y: L.cy - top };

  const th = doorAngle(t);
  const rad = (th * Math.PI) / 180;
  const z = -w * Math.sin(rad);
  const freeX = po.x + (w * Math.cos(rad) - po.x) * (P / (P - z));
  const lit = Math.max(0, Math.min(w, w - freeX)); // px of doorway still showing light
  const litFrac = lit / w;
  const light = roomLight(t);
  const on = doorOn(t);
  const slam = TWIST.doorSlam;
  const u = t - slam;

  // the slit: gets hotter as it narrows, flashes on the slam, dies
  const narrow = t < slam && litFrac > 0.001 ? tween(litFrac, [0.02, 0.4], [1, 0], EASE.out3) : 0;
  const slamFlash = u >= 0 ? Math.exp(-u / 2.4) : 0;
  const leak = u >= 0 && u < 9 ? Math.abs(th) / 3.2 : 0;
  const slit =
    (u < 0 ? narrow * 0.9 * Math.min(1, light) : Math.min(1.3, slamFlash * 1.1 + leak * 0.5)) *
    (1 - tween(t, [slam + 8, slam + 16], [0, 1], EASE.in2));
  const under = (u >= 0 ? 0.9 * Math.exp(-u / 6) : 0) * (1 - tween(t, [slam + 10, slam + 18], [0, 1], EASE.inOut));
  // the phone's light reaches the closed door's edge
  const lilacRim = tween(t, [TWIST.phoneOn + 2, TWIST.phoneOn + 16], [0, 1], EASE.inOut);

  // panel ghosts on the fast part of the swing (simulated motion blur)
  const angVel = Math.abs(doorAngle(t) - doorAngle(t - 0.5)) * 2;
  const ghosts = angVel > 4 ? [0.3, 0.6, 0.9] : [];

  // the lit face of the open panel (it faces the room), fading as it shuts
  const faceLit = Math.min(1, Math.abs(th) / 75) * light;

  const panel = (angle: number, op: number, key: string, detail: boolean) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        transformOrigin: '0 50%',
        transform: `rotateY(${angle.toFixed(3)}deg)`,
        background: `linear-gradient(90deg, #120f19 0%, ${C.fieldLow} 55%, #1d1a27 100%)`,
        boxShadow: `inset 0 0 0 1px rgba(${PAPER},0.07)`,
        opacity: op,
      }}
    >
      {detail ? (
        <>
          {/* raised panels: hairlines, the site's idiom */}
          {[
            { t: 0.07, hh: 0.36 },
            { t: 0.5, hh: 0.43 },
          ].map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: w * 0.13,
                width: w * 0.74,
                top: h * p.t,
                height: h * p.hh,
                boxShadow: `inset 0 0 0 1px rgba(${PAPER},0.055), inset 0 1px 0 rgba(${PAPER},0.03)`,
                borderRadius: 3,
              }}
            />
          ))}
          {/* handle */}
          <div
            style={{
              position: 'absolute',
              right: w * 0.075,
              top: h * 0.47,
              width: 7,
              height: 58,
              borderRadius: 4,
              background: `linear-gradient(90deg, #2c2935, ${C.silverLow} 60%, #3a3844)`,
              boxShadow: `0 6px 10px -4px rgba(0,0,0,0.8)`,
            }}
          />
          {/* the face that looks into the room catches its light */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, rgba(${SILVER},0.30), rgba(${SILVER},0.10) 55%, rgba(${SILVER},0.03))`,
              opacity: faceLit,
            }}
          />
          {/* rim light on the free edge */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 2,
              height: h,
              background: `linear-gradient(180deg, rgba(${SILVER},0.15), rgba(${SILVER},0.75) 45%, rgba(${SILVER},0.25))`,
              opacity: 0.25 + 0.75 * light,
            }}
          />
        </>
      ) : null}
    </div>
  );

  // dust puff from the gap on the slam
  const puff = u >= 0 && u < 40 ? (
    <>
      {Array.from({ length: 28 }, (_, i) => {
        const r = (k: string) => random(`tw-puff-${i}-${k}`);
        const fromBottom = i % 3 !== 0;
        const x0 = fromBottom ? w * (0.15 + r('x') * 0.95) : w + 2;
        const y0 = fromBottom ? h - 4 : h * (0.25 + r('y') * 0.7);
        const vx = fromBottom ? (r('vx') - 0.3) * 150 : 40 + r('vx') * 120;
        const vy = fromBottom ? -10 - r('vy') * 60 : (r('vy') - 0.5) * 50;
        const drag = 1 - Math.exp(-u / (5 + r('d') * 4));
        const x = x0 + vx * drag;
        const y = y0 + vy * drag - u * (0.4 + r('b') * 0.6);
        const d = 2.5 + r('s') * 6;
        const op = (0.4 + r('o') * 0.45) * tween(u, [0, 1.5], [0, 1]) * (1 - tween(u, [6 + r('l') * 10, 22 + r('l') * 16], [0, 1], EASE.inOut));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(${PAPER},0.9), rgba(${PAPER},0))`,
              opacity: op,
            }}
          />
        );
      })}
      {[0, 1, 2].map((i) => {
        const d = (90 + i * 60) * (0.4 + 0.6 * (1 - Math.exp(-u / 6)));
        const x = w * (0.35 + i * 0.3);
        const op = 0.3 * tween(u, [0, 2], [0, 1]) * (1 - tween(u, [4, 30], [0, 1], EASE.inOut));
        return (
          <div
            key={`c${i}`}
            style={{
              position: 'absolute',
              left: x - d / 2,
              top: h - d * 0.35,
              width: d,
              height: d * 0.5,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(${SILVER},0.7), rgba(${SILVER},0))`,
              opacity: op,
            }}
          />
        );
      })}
    </>
  ) : null;

  // the door sign
  const sU = (t - TWIST.closedSign) / 27;
  const signRot = 8 * (1 - elasticOut(sU));
  const signOp = tween(t, [TWIST.closedSign, TWIST.closedSign + 3], [0, 1], EASE.out3);
  const signDrop = -10 * (1 - EASE.out3(Math.min(1, Math.max(0, sU * 2.2))));

  // floor spill: a trapezoid of light from the lit part of the threshold
  const spillH = L.pick(300, 240);
  const sx0 = w - lit;
  const spill = light * Math.min(1, litFrac * 1.4 + narrow * 0.2);

  return (
    <div style={{ position: 'absolute', left, top, width: w, height: h, opacity, filter: dof > 0.1 ? `blur(${dof.toFixed(2)}px)` : undefined }}>
      {/* wall wash around the doorway (not mounted once dark: keeps the
          blurred container — and its dive ghosts — small) */}
      {light > 0.005 ? (
      <div
        style={{
          position: 'absolute',
          left: -w * 1.7,
          top: -h * 0.45,
          width: w * 4.4,
          height: h * 1.9,
          background: `radial-gradient(closest-side, rgba(${SILVER},0.22), rgba(${SILVER},0.07) 50%, rgba(${SILVER},0) 100%)`,
          opacity: Math.min(1.2, light) * (0.35 + 0.65 * litFrac),
        }}
      />
      ) : null}
      {/* threshold / floor line */}
      <div
        style={{
          position: 'absolute',
          left: -w * 1.3,
          width: w * 3.6,
          top: h,
          height: 1,
          background: `linear-gradient(90deg, rgba(${PAPER},0), rgba(${PAPER},0.14) 30%, rgba(${PAPER},0.14) 70%, rgba(${PAPER},0))`,
          opacity: on,
        }}
      />
      {spill > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            left: -w,
            top: h,
            width: w * 3,
            height: spillH,
            background: `linear-gradient(180deg, rgba(${SILVER},0.34), rgba(${SILVER},0.1) 40%, rgba(${SILVER},0) 100%)`,
            clipPath: `polygon(${w + sx0}px 0, ${2 * w}px 0, ${2 * w + w * 0.9}px 100%, ${w + sx0 - w * 0.25}px 100%)`,
            opacity: spill,
          }}
        />
      ) : null}
      {/* frame: hairline architrave + jamb */}
      <div
        style={{
          position: 'absolute',
          inset: -16,
          bottom: 0,
          boxShadow: `inset 0 0 0 1px rgba(${PAPER},0.11)`,
          opacity: on,
        }}
      />
      {/* the lit room */}
      {light > 0.005 ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: Math.min(1, light),
          background: `linear-gradient(180deg, ${C.coverPaper} 0%, ${C.silver} 42%, ${C.silverMid} 80%, ${C.silverLow} 100%)`,
        }}
      >
        {/* the hot core: near white, brighter than the type in front of it */}
        <div
          style={{
            position: 'absolute',
            left: -w * 0.5,
            top: -h * 0.12,
            width: w * 2,
            height: h * 1.02,
            background: `radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,255,255,0.78) 38%, rgba(255,255,255,0.22) 72%, rgba(255,255,255,0))`,
          }}
        />
        {/* the floor inside, just a soft falloff (no band) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: h * 0.22,
            background: `linear-gradient(180deg, rgba(123,122,125,0), rgba(123,122,125,0.28))`,
          }}
        />
        {/* the room's far edge: a soft vertical falloff at the jambs */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, rgba(123,122,125,0.22), rgba(123,122,125,0) 14%, rgba(123,122,125,0) 86%, rgba(123,122,125,0.18))`,
          }}
        />
      </div>
      ) : null}
      {/* bloom over the part of the doorway still open */}
      {lit > 0.5 && light > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: w - lit,
            top: 0,
            width: lit,
            height: h,
            boxShadow: `0 0 ${50 + 40 * light}px ${14 + 14 * light}px rgba(255,255,255,${(0.34 * Math.min(1, light)).toFixed(3)}), 0 0 ${110 + 50 * light}px ${22 + 18 * light}px rgba(${SILVER},${(0.4 * Math.min(1, light)).toFixed(3)}), 0 0 ${260 + 80 * light}px ${30 + 30 * light}px rgba(${SILVER},${(0.2 * Math.min(1, light)).toFixed(3)})`,
          }}
        />
      ) : null}
      {/* the panel, in 3D */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: P,
          perspectiveOrigin: `${po.x}px ${po.y}px`,
          opacity: on,
        }}
      >
        {ghosts.map((k, i) => panel(doorAngle(t - k), 0.32 - i * 0.09, `g${i}`, false))}
        {panel(th, 1, 'main', true)}
      </div>
      {/* the slit — hot as it narrows, a flash on the slam, then gone */}
      {slit > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: Math.min(w, Math.max(0, freeX)) - 2,
              top: -4,
              width: 3,
              height: h + 8,
              background: `linear-gradient(180deg, rgba(${SILVER},0.5), rgba(255,255,255,1) 40%, rgba(${SILVER},0.6))`,
              opacity: Math.min(1, slit),
              boxShadow: `0 0 18px 3px rgba(${SILVER},${(0.55 * Math.min(1, slit)).toFixed(3)})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: w - 160,
              top: -h * 0.15,
              width: 320,
              height: h * 1.3,
              background: `radial-gradient(closest-side, rgba(${SILVER},0.3), rgba(${SILVER},0))`,
              opacity: Math.min(1, slit),
            }}
          />
        </>
      ) : null}
      {under > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 4,
            width: w - 8,
            top: h - 2,
            height: 2,
            background: `rgba(255,255,255,1)`,
            opacity: under,
            boxShadow: `0 0 16px 2px rgba(${SILVER},${(0.6 * under).toFixed(3)})`,
          }}
        />
      ) : null}
      {lilacRim > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              right: -1,
              top: 0,
              width: 2,
              height: h,
              background: `linear-gradient(180deg, rgba(185,163,255,0.1), rgba(185,163,255,0.55) 50%, rgba(185,163,255,0.15))`,
              opacity: lilacRim,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, rgba(185,163,255,0) 45%, rgba(185,163,255,0.07))`,
              opacity: lilacRim,
            }}
          />
        </>
      ) : null}
      {puff}
      {/* CLOSED */}
      {signOp > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2,
            top: h * 0.24,
            transform: `translate(-50%, ${signDrop.toFixed(2)}px) rotate(${signRot.toFixed(3)}deg)`,
            transformOrigin: '50% 0%',
            opacity: signOp,
            height: 52,
            padding: '0 22px',
            borderRadius: 9999,
            boxShadow: `inset 0 0 0 1px rgba(${PAPER},0.4), 0 10px 22px -12px rgba(0,0,0,0.9)`,
            display: 'flex',
            alignItems: 'center',
            fontFamily: FONT.body,
            fontWeight: 600,
            fontSize: 24,
            lineHeight: 1,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.paper,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ marginRight: '-0.16em' }}>Closed</span>
        </div>
      ) : null}
    </div>
  );
};
