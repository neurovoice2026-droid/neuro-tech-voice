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

/** Light of the room behind the door (0..1+). */
function roomLight(t: number) {
  const reveal = tween(t, [0, 5], [0, 1], EASE.out3) + (t >= 0 ? 0.4 * Math.exp(-t / 2.2) : 0);
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
  const slam = TWIST.doorSlam;
  const u = t - slam;

  // the slit: gets hotter as it narrows, flashes on the slam, dies
  const narrow = t < slam ? tween(litFrac, [0.35, 0.02], [0, 1], EASE.in2) * (litFrac > 0.001 ? 1 : 0) : 0;
  const slamFlash = u >= 0 ? Math.exp(-u / 2.4) : 0;
  const leak = u >= 0 && u < 9 ? Math.abs(th) / 3.2 : 0;
  const slit = Math.min(1.4, narrow * 0.9 + slamFlash * 1.1 + leak * 0.5) * (u < 0 ? light : Math.max(light, 0.001) > 0 ? 1 : 0) *
    (1 - tween(t, [slam + 8, slam + 16], [0, 1], EASE.in2));
  const under = (u >= 0 ? 0.9 * Math.exp(-u / 6) : 0) * (1 - tween(t, [slam + 10, slam + 18], [0, 1], EASE.inOut));

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
              background: `linear-gradient(90deg, rgba(${SILVER},0.02), rgba(${SILVER},0.22))`,
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
      {Array.from({ length: 18 }, (_, i) => {
        const r = (k: string) => random(`tw-puff-${i}-${k}`);
        const fromBottom = i % 3 !== 0;
        const x0 = fromBottom ? w * (0.15 + r('x') * 0.95) : w + 2;
        const y0 = fromBottom ? h - 4 : h * (0.25 + r('y') * 0.7);
        const vx = fromBottom ? (r('vx') - 0.3) * 150 : 40 + r('vx') * 120;
        const vy = fromBottom ? -10 - r('vy') * 60 : (r('vy') - 0.5) * 50;
        const drag = 1 - Math.exp(-u / (5 + r('d') * 4));
        const x = x0 + vx * drag;
        const y = y0 + vy * drag - u * (0.4 + r('b') * 0.6);
        const d = 2 + r('s') * 4.5;
        const op = (0.25 + r('o') * 0.35) * tween(u, [0, 1.5], [0, 1]) * (1 - tween(u, [6 + r('l') * 10, 22 + r('l') * 16], [0, 1], EASE.inOut));
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
        const op = 0.16 * tween(u, [0, 2], [0, 1]) * (1 - tween(u, [4, 26], [0, 1], EASE.inOut));
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
      {/* wall wash around the doorway */}
      <div
        style={{
          position: 'absolute',
          left: -w * 1.7,
          top: -h * 0.45,
          width: w * 4.4,
          height: h * 1.9,
          background: `radial-gradient(closest-side, rgba(${SILVER},0.16), rgba(${SILVER},0.05) 50%, rgba(${SILVER},0) 100%)`,
          opacity: light * (0.35 + 0.65 * litFrac),
        }}
      />
      {/* threshold / floor line */}
      <div
        style={{
          position: 'absolute',
          left: -w * 1.3,
          width: w * 3.6,
          top: h,
          height: 1,
          background: `linear-gradient(90deg, rgba(${PAPER},0), rgba(${PAPER},0.14) 30%, rgba(${PAPER},0.14) 70%, rgba(${PAPER},0))`,
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
        }}
      />
      {/* the lit room */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: Math.min(1, light),
          background: `linear-gradient(180deg, ${C.silver} 0%, #b6b2ac 38%, ${C.silverMid} 66%, ${C.silverLow} 100%)`,
        }}
      >
        {/* floor inside the room + a hot core */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: h * 0.2,
            background: `linear-gradient(180deg, rgba(90,88,94,0.55), rgba(123,122,125,0.2))`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -w * 0.3,
            top: h * 0.05,
            width: w * 1.6,
            height: h * 0.7,
            background: `radial-gradient(closest-side, rgba(255,250,242,0.5), rgba(255,250,242,0))`,
          }}
        />
      </div>
      {/* bloom over the part of the doorway still open */}
      {lit > 0.5 && light > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: w - lit,
            top: 0,
            width: lit,
            height: h,
            boxShadow: `0 0 ${50 + 40 * light}px ${6 + 10 * light}px rgba(${SILVER},${(0.32 * Math.min(1, light)).toFixed(3)})`,
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
              width: 3 + Math.max(0, lit - 1) * 0.15,
              height: h + 8,
              background: `linear-gradient(180deg, rgba(${SILVER},0.5), rgba(255,250,242,1) 40%, rgba(${SILVER},0.6))`,
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
            background: `rgba(255,250,242,1)`,
            opacity: under,
            boxShadow: `0 0 16px 2px rgba(${SILVER},${(0.6 * under).toFixed(3)})`,
          }}
        />
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
