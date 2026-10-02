/**
 * The door: a doorway at night, full of warm silver light — the business, at
 * closing time. The panel is a real slab in 3D with two faces: the inside
 * face (lit by the room) is what we see while it stands open toward us; the
 * outside face (painted near-black, recessed panels, a lever handle and the
 * shop's CLOSED sign on its cord) turns into view as it swings. It creaks a
 * little wider first, then EASE.in4 into the slam and a 3° bounce off the
 * stop; the light narrows to a hot slit, flashes on the slam and dies under
 * the door. The slam sets the sign swinging on its cord (a damped pendulum):
 * it knocks back past the vertical on TWIST.closedSign, and its plaque
 * catches the light as it tilts (TW.signGlint).
 *
 * Light, not glow: the opening is the source (an overexposed interior, a
 * tight halation), the floor takes its spill. Outside, ONE motivated light
 * stays on all night: the shop's downlight over the door (implied, off the
 * top of the frame). It washes the wall above the head in a soft scallop,
 * falls off down the painted face (top-down, so the recesses' lower lips
 * and the handle catch it and the sign casts down), puts a 1 px lit edge on
 * the frame's head and the tops of its jambs, and leaves a faint pool on the
 * floor in front of the threshold. The wall/floor junction runs across the
 * whole frame (a hairline that never ends in shot). No blur (the door is in
 * focus), no ghost panels, no dust — the 120 fps master carries the swing.
 */
import React from 'react';
import type { Layout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C } from '../../theme';
import { TWIST } from '../../timing';
import { TW, type Geo } from './geometry';

const P = 1400; // perspective, px
const SILVER = '196,192,186';
const WARM = '255,248,238';
const PAPER = '237,236,241';
const LILAC = '185,163,255';
/** the downlight over the door: a warm neutral (a lamp, not a gel) */
const LAMP = '232,226,216';

/** Gaussian stops, exactly 0 at the edge (no ring, no band): for the lamp's wash and pools. */
function gauss(rgb: string, a: number, n = 14, k = 3.2): string {
  const e = Math.exp(-k);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const r = i / n;
    out.push(`rgba(${rgb},${Math.max(0, (a * (Math.exp(-k * r * r) - e)) / (1 - e)).toFixed(4)}) ${(r * 100).toFixed(1)}%`);
  }
  return out.join(', ');
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
 *  surge at t ≈ 2 (the blast), dies after the slam. */
export function roomLight(t: number) {
  const reveal = tween(t, [-0.5, 5], [0, 1], EASE.out3) + (t > 0 ? 0.25 * (t / 2) * Math.exp(1 - t / 2) : 0);
  const dies = 1 - tween(t, [TWIST.doorSlam + 3, TWIST.doorSlam + 13], [0, 1], EASE.in2);
  return reveal * dies;
}

/* ── the sign on its cord ─────────────────────────────────────────── */

/** pendulum period (frames) and decay: it knocks back past the vertical one half-period after the slam */
const SWING_P = 2 * (TWIST.closedSign - TWIST.doorSlam);
const SWING_TAU = 15;
/** The sign's swing (deg) — kicked by the slam (a sine from rest: continuous), damped. */
export function signSwing(t: number): number {
  const u = t - TWIST.doorSlam;
  if (u <= 0) return 0;
  // the impulse arrives over a frame (the door stops; the sign keeps going)
  const kick = Math.min(1, u / 1.2);
  return 8.5 * kick * Math.exp(-u / SWING_TAU) * Math.sin((2 * Math.PI * u) / SWING_P);
}

const ClosedSign: React.FC<{ t: number; w: number; h: number; L: Layout }> = ({ t, w, h, L }) => {
  const lab = typeStyle('label', L.vertical, { tone: 'night' });
  const fs = lab.fontSize as number;
  const plate = { w: L.pick(184, 160), h: L.pick(64, 58) };
  const hook = { x: w / 2, y: h * 0.17 };
  const drop = L.pick(46, 40); // hook → top of the plate
  const th = signSwing(t);
  // the sign lifts a hair on the impact (it hangs from a cord, it is not nailed)
  const u = t - TWIST.doorSlam;
  const hop = u > 0 ? -3 * Math.exp(-u / 2.2) * Math.sin(Math.min(Math.PI, (Math.PI * u) / 3)) : 0;
  // the plaque catches the light as it tilts: a sheen crosses it (TW.signGlint)
  const gl = tween(t, TW.signGlint, [0, 1], EASE.inOut);
  const sheenOp = 0.22 * Math.sin(Math.PI * gl);
  return (
    <div
      style={{
        position: 'absolute',
        left: hook.x,
        top: hook.y,
        width: 0,
        height: 0,
        transform: `translateY(${hop.toFixed(3)}px) rotate(${th.toFixed(3)}deg)`,
        transformOrigin: '0 0',
      }}
    >
      {/* the cord: two hairlines from the hook to the plate's top corners */}
      <svg
        width={plate.w}
        height={drop + 2}
        viewBox={`0 0 ${plate.w} ${drop + 2}`}
        style={{ position: 'absolute', left: -plate.w / 2, top: 0, overflow: 'visible' }}
        aria-hidden
      >
        <path
          d={`M ${plate.w / 2} 0 L ${plate.w * 0.16} ${drop + 1} M ${plate.w / 2} 0 L ${plate.w * 0.84} ${drop + 1}`}
          stroke={`rgba(${PAPER},0.34)`}
          strokeWidth={1.2}
          fill="none"
        />
        <circle cx={plate.w / 2} cy={0} r={3.2} fill="#2a2732" stroke={`rgba(${PAPER},0.28)`} strokeWidth={1} />
      </svg>
      {/* the plaque: dark lacquer, a hairline edge, the label */}
      <div
        style={{
          position: 'absolute',
          left: -plate.w / 2,
          top: drop,
          width: plate.w,
          height: plate.h,
          borderRadius: plate.h / 2,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #24212c 0%, #1a1820 100%)',
          boxShadow: `inset 0 0 0 1.5px rgba(${PAPER},0.42), inset 0 1px 0 rgba(${LAMP},0.2), 0 14px 20px -11px rgba(0,0,0,0.95), 0 3px 5px rgba(0,0,0,0.55)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ ...lab, color: C.paper, whiteSpace: 'nowrap', paddingLeft: '0.14em', fontSize: fs }}>Closed</span>
        {sheenOp > 0.004 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(105deg, rgba(255,255,255,0) ${(gl * 150 - 45).toFixed(1)}%, rgba(255,255,255,1) ${(gl * 150 - 25).toFixed(1)}%, rgba(255,255,255,0) ${(gl * 150 - 5).toFixed(1)}%)`,
              mixBlendMode: 'screen',
              opacity: sheenOp,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/* ── the slab ─────────────────────────────────────────────────────── */

/**
 * Two recessed panels, shaded, never outlined: the rail above throws a shadow into each (its top
 * inner edge), the lower lip faces up and catches the light (`lit`, and `top` from above — the
 * downlight: the upper panel more than the lower).
 */
const Recesses: React.FC<{ w: number; h: number; lit?: number; top?: number }> = ({ w, h, lit = 0, top = 0 }) => (
  <>
    {[
      { t: 0.07, hh: 0.36, k: 1 },
      { t: 0.5, hh: 0.43, k: 0.45 },
    ].map((p, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: w * 0.13,
          width: w * 0.74,
          top: h * p.t,
          height: h * p.hh,
          borderRadius: 3,
          background: `linear-gradient(180deg, rgba(0,0,0,${(0.2 - 0.08 * lit + 0.1 * top * p.k).toFixed(3)}), rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.1))`,
          boxShadow:
            `inset 0 3px 4px -2px rgba(0,0,0,${(0.55 + 0.2 * top * p.k).toFixed(3)}), ` +
            `inset 0 -1px 0 rgba(${PAPER},${(0.05 + 0.08 * lit).toFixed(3)}), ` +
            `inset 0 -1px 0 rgba(${LAMP},${(0.2 * top * p.k).toFixed(3)})`,
        }}
      />
    ))}
  </>
);

export const Door: React.FC<{ t: number; g: Geo; L: Layout; opacity?: number }> = ({ t, g, L, opacity = 1 }) => {
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

  // the slit: hotter as it narrows, a flash on the slam, then gone
  const narrow = t < slam && litFrac > 0.001 ? tween(litFrac, [0.02, 0.4], [1, 0], EASE.out3) : 0;
  const slamFlash = u >= 0 ? Math.exp(-u / 2.4) : 0;
  const leak = u >= 0 && u < 9 ? Math.abs(th) / 3.2 : 0;
  const slit =
    (u < 0 ? narrow * 0.9 * Math.min(1, light) : Math.min(1.2, slamFlash + leak * 0.45)) *
    (1 - tween(t, [slam + 8, slam + 16], [0, 1], EASE.in2));
  const under = (u >= 0 ? 0.85 * Math.exp(-u / 6) : 0) * (1 - tween(t, [slam + 10, slam + 18], [0, 1], EASE.inOut));
  // the phone's light reaches the closed door's free edge (it faces the phone)
  const lilacRim = tween(t, [TWIST.phoneOn + 2, TWIST.phoneOn + 16], [0, 1], EASE.inOut);
  // the inside face catches the room's light, the more the more it faces the opening
  const faceLit = Math.min(1, Math.abs(th) / 75) * Math.min(1, light);

  // floor spill: a trapezoid of light from the lit part of the threshold
  const spillH = L.pick(300, 240);
  const sx0 = w - lit;
  const spill = Math.min(1, light) * Math.min(1, litFrac * 1.4 + narrow * 0.2);

  // the downlight over the door: on all night (found with the room), dims with the door when the phone wakes
  const lamp = on;
  // the wall/floor junction: a hairline across the WHOLE frame — it never ends in shot, at any camera
  // move of the scene (the push, the pull-back and the dive's aim slide this plane well over a frame
  // width), lit where the door's light and the lamp reach it, a faint ambient catch elsewhere
  const hair = (() => {
    const x0 = -left - 1.6 * L.width;
    const span = 4.2 * L.width;
    const dc = w / 2 - x0; // the door's centre along the line
    const stops: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * span;
      const near = Math.exp(-Math.pow((x - dc) / (1.25 * w), 2));
      const edge = Math.min(1, x / (0.25 * L.width), (span - x) / (0.25 * L.width));
      stops.push(`rgba(${PAPER},${((0.025 + 0.1 * near) * edge).toFixed(4)}) ${((x / span) * 100).toFixed(2)}%`);
    }
    return { x0, span, bg: `linear-gradient(90deg, ${stops.join(', ')})` };
  })();

  const face = (back: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transform: back ? 'rotateY(180deg)' : undefined,
  });

  return (
    <div style={{ position: 'absolute', left, top, width: w, height: h, opacity: opacity < 1 ? opacity : undefined }}>
      {/* the downlight's scallop on the wall: strongest just over the head, cut off above (the fixture's
          cone), falling away down the wall either side of the frame */}
      <div
        style={{
          position: 'absolute',
          left: -w * 0.8,
          width: w * 2.6,
          top: -h * 0.5,
          height: h * 1.5,
          background: `radial-gradient(${(w * 1.05).toFixed(1)}px ${(h * 0.66).toFixed(1)}px at ${(w * 1.3).toFixed(1)}px ${(h * 0.47).toFixed(1)}px, ${gauss(LAMP, 0.11)}, transparent)`,
          maskImage: `linear-gradient(to bottom, transparent 0, #000 ${(h * 0.26).toFixed(1)}px, #000 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0, #000 ${(h * 0.26).toFixed(1)}px, #000 100%)`,
          opacity: lamp,
        }}
      />
      {/* …and its faint pool on the floor in front of the threshold */}
      <div
        style={{
          position: 'absolute',
          left: -w * 0.7,
          width: w * 2.4,
          top: h,
          height: h * 0.32,
          background: `radial-gradient(${(w * 1.1).toFixed(1)}px ${(h * 0.26).toFixed(1)}px at ${(w * 1.2).toFixed(1)}px 0px, ${gauss(LAMP, 0.065)}, transparent)`,
          opacity: lamp,
        }}
      />
      {/* the wall/floor junction, across the whole frame */}
      <div
        style={{
          position: 'absolute',
          left: hair.x0,
          width: hair.span,
          top: h,
          height: 1,
          background: hair.bg,
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
            background: `linear-gradient(180deg, rgba(${SILVER},0.32), rgba(${SILVER},0.1) 38%, rgba(${SILVER},0.025) 75%, rgba(${SILVER},0) 100%)`,
            clipPath: `polygon(${w + sx0}px 0, ${2 * w}px 0, ${2 * w + w * 0.9}px 100%, ${w + sx0 - w * 0.25}px 100%)`,
            opacity: spill,
          }}
        />
      ) : null}
      {/* the doorway's frame: a reveal (the wall's depth), its inner edge catching the light */}
      <div
        style={{
          position: 'absolute',
          left: -7,
          right: -7,
          top: -7,
          bottom: 0,
          borderRadius: '2px 2px 0 0',
          boxShadow: `inset 0 0 0 1px rgba(${PAPER},0.1), inset 0 0 0 7px #0d0b12`,
          opacity: on,
        }}
      />
      {/* the downlight on the frame: a 1 px lit edge along the head (its top catches the light square-on)
          and down the jambs' outer edges, grazing, so it falls away within the top third */}
      <div
        style={{
          position: 'absolute',
          left: -7,
          width: w + 14,
          top: -7,
          height: 1,
          background: `linear-gradient(90deg, rgba(${LAMP},0.08), rgba(${LAMP},0.5) 22%, rgba(${LAMP},0.62) 50%, rgba(${LAMP},0.5) 78%, rgba(${LAMP},0.08))`,
          opacity: lamp,
        }}
      />
      {[-7, w + 6].map((x) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            left: x,
            width: 1,
            top: -7,
            height: h * 0.62,
            background: `linear-gradient(180deg, rgba(${LAMP},0.42), rgba(${LAMP},0.16) 30%, rgba(${LAMP},0.04) 70%, rgba(${LAMP},0))`,
            opacity: lamp,
          }}
        />
      ))}
      {/* the lit room */}
      {light > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: Math.min(1, light),
            background: `linear-gradient(180deg, ${C.coverPaper} 0%, ${C.silver} 44%, ${C.silverMid} 82%, ${C.silverLow} 100%)`,
            // a tight halation: an overexposed opening at night (no bloom across the frame)
            boxShadow: `0 0 22px 2px rgba(${WARM},${(0.16 * Math.min(1, light) * litFrac).toFixed(3)})`,
          }}
        >
          {/* the hot core: near white, brighter than the type in front of it */}
          <div
            style={{
              position: 'absolute',
              left: -w * 0.5,
              top: -h * 0.1,
              width: w * 2,
              height: h * 1.0,
              background: `radial-gradient(closest-side, rgba(255,253,249,1), rgba(255,252,246,0.78) 38%, rgba(255,250,242,0.2) 74%, rgba(255,250,242,0))`,
            }}
          />
          {/* the floor inside, a soft falloff */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: h * 0.22,
              background: 'linear-gradient(180deg, rgba(123,122,125,0), rgba(123,122,125,0.3))',
            }}
          />
          {/* the jambs' shade */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(123,122,125,0.24), rgba(123,122,125,0) 13%, rgba(123,122,125,0) 87%, rgba(123,122,125,0.2))',
            }}
          />
        </div>
      ) : null}
      {/* the panel, in 3D: two faces */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: P,
          perspectiveOrigin: `${po.x}px ${po.y}px`,
          opacity: on < 1 ? on : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: '0 50%',
            transform: `rotateY(${th.toFixed(3)}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* the outside face: satin near-black paint under the downlight — a soft top-down falloff (the
              lamp's cone, centred over the door, a touch brighter mid-face than at the stiles), the
              bottom in the floor's shade */}
          <div
            style={{
              ...face(false),
              background:
                `radial-gradient(${(w * 0.95).toFixed(1)}px ${(h * 0.78).toFixed(1)}px at 50% ${(-h * 0.1).toFixed(1)}px, ${gauss(LAMP, 0.21 * lamp, 16, 2.6)}, transparent), ` +
                `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28) 100%), ` +
                `linear-gradient(90deg, #121118 0%, #16141c 55%, #18161f 100%)`,
            }}
          >
            <Recesses w={w} h={h} top={lamp} />
            {/* the door's foot: a dark gap over the threshold (no light from the room any more) */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(0,0,0,0.55)' }} />
            {/* the free edge catches the room's light while there is any */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 1.5,
                height: h,
                background: `linear-gradient(180deg, rgba(${SILVER},0.12), rgba(${SILVER},0.7) 45%, rgba(${SILVER},0.2))`,
                opacity: 0.2 + 0.8 * Math.min(1, light),
              }}
            />
            {/* the lever handle: a rose and a lever, brushed metal */}
            <div
              style={{
                position: 'absolute',
                right: w * 0.075,
                top: h * 0.5 - 8,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: `radial-gradient(circle at 38% 32%, #8a8790, #3b3944 60%, #24222b)`,
                boxShadow: '0 3px 5px -2px rgba(0,0,0,0.8)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: w * 0.075 + 6,
                top: h * 0.5 - 3.5,
                width: L.pick(46, 40),
                height: 7,
                borderRadius: 4,
                background: `linear-gradient(180deg, #a19d98 0%, #5a5760 40%, #2c2a33 100%)`,
                boxShadow: `inset 0 1px 0 rgba(${LAMP},0.35), 0 6px 8px -3px rgba(0,0,0,0.9)`,
              }}
            />
            {/* the phone's lilac reaches the closed door's free edge */}
            {lilacRim > 0.01 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(90deg, rgba(${LILAC},0) 52%, rgba(${LILAC},0.06) 92%, rgba(${LILAC},0.16) 100%)`,
                  opacity: lilacRim,
                }}
              />
            ) : null}
            <ClosedSign t={t} w={w} h={h} L={L} />
          </div>
          {/* the inside face: lit by the room it opens onto */}
          <div
            style={{
              ...face(true),
              background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 100%), linear-gradient(90deg, #1b1923 0%, #15131c 100%)`,
            }}
          >
            <Recesses w={w} h={h} lit={faceLit} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(270deg, rgba(${SILVER},0.32), rgba(${SILVER},0.12) 55%, rgba(${SILVER},0.04))`,
                opacity: faceLit,
              }}
            />
            {/* (mirrored) its free edge, lit */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 1.5,
                height: h,
                background: `linear-gradient(180deg, rgba(${SILVER},0.15), rgba(${SILVER},0.8) 45%, rgba(${SILVER},0.25))`,
                opacity: Math.min(1, light),
              }}
            />
          </div>
        </div>
      </div>
      {/* the slit — hot as it narrows, a flash on the slam, then gone */}
      {slit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(w, Math.max(0, freeX)) - 1.5,
            top: -3,
            width: 3,
            height: h + 6,
            borderRadius: 1.5,
            background: `linear-gradient(180deg, rgba(${WARM},0.55), rgba(255,255,255,1) 40%, rgba(${WARM},0.65))`,
            opacity: Math.min(1, slit),
            boxShadow: `0 0 8px 1px rgba(${WARM},${(0.45 * Math.min(1, slit)).toFixed(3)})`,
          }}
        />
      ) : null}
      {/* …and the last of the light, under the door */}
      {under > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 4,
            width: w - 8,
            top: h - 2,
            height: 2,
            background: `rgba(${WARM},1)`,
            opacity: under,
            boxShadow: `0 2px 10px 0 rgba(${WARM},${(0.4 * under).toFixed(3)})`,
          }}
        />
      ) : null}
    </div>
  );
};
