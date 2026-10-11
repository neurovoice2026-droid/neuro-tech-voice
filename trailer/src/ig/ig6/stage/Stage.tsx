/**
 * REEL 6 · THE STAGE — the whole reel is ONE continuous picture (docs/ig/ig6/SCRIPT.md §3–§8), so every act's <Sequence>
 * mounts this same stage at its own absolute frame (each part a pure function of it: an act boundary is invisible).
 * Bottom to top:
 *
 *   the object   per shot (Camera.ts shotAt): the world dial (M1 / M3′ / the T2 push, Dial.tsx WorldDial) under the hand
 *                (Hand.tsx WorldHand, its long shadow on a non-rotating wrapper) — or M5′, the whole dial as its own
 *                upright drawing with its hand at the true centre — or the white of the fall-through — or nothing (the
 *                end card)
 *   the story    your phone (graphite hub, hollow nodes, ring stretches inking, the dial stepping) until the whip; a
 *                fresh clock's hub rings and STAMPS teal on the bar line (the radial wipe, the collar's flash); the
 *                agent's clock rebuilds in teal and glides; its day; its answered calls pop as teal domes
 *   the end      End6.tsx: the comment field, NEUROVOICE + URL; the dome that travels hub → send disc → full stop → hub
 *   the type     Lockup.tsx, screen-locked, word-synced
 *   the seam     f826–840: the hub disc grows under the returning dome, the hand extends out of it, the dial draws on
 *                from the reading point (rim both ways, ticks sweeping out from the needle, node 1 popping in with its
 *                pending stretch), lockup 1a rises to 72 % — frame 0's state at rotation 0, so f840 ≡ f0
 *
 * In zone mode (qa.ts) every object reports its rect below y 840 (TikTok's rail rule) and the lockup box (x 296–900,
 * y 1080–1400) is checked against the object's strokes whenever a lockup is up.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, mixHex } from '../../../lib/motion';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { FALL, shotAt, drift, type Shot } from './Camera';
import { agentRho, AGENT_DOMES, DAY_DOMES, dayTheta, HUB_RING, LAPSE_LANDS, lapseTheta, phoneInkTo, phoneRho, PICKUP, ping, popIn, pulse, recoil, RINGS, shiver } from './clock';
import { belowRect, DialSvg, fullPrims, worldPrims, type DialState, type Prim, type Ring } from './Dial';
import { CommentField6, domeAt, DomeFlyer, Brand6, DOME_T } from './End6';
import { useWordmarkFace } from './fonts';
import { HUB, K, NEEDLE_A, planeOf, project, type Plane, type Pt } from './geom';
import { FullHand, handPts, WorldHand, type HandLook } from './Hand';
import { HUB_R } from './handPath';
import { Lockups, lockupShowing } from './Lockup';
import { useIg6Qa } from './qa';
import { FULL, HAND, INK } from './style';

const M = T.M;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const SEAM = T.END_CARD.seam;
/** the seam's build, once the brand has left (SEAM + 4): hub + hand (8 f expo), the dial (10 f), node 1 pops */
const BUILD = SEAM + 4;
/** the agent's clock rebuilds from the pull-back's start (ticks out from the needle, the rim trimming on both ways) */
const REBUILD = M.rebuild[0];

/* ── the world dial's state ── */
function phoneRing(t: number, n: number): Ring {
  const r = RINGS.find((x) => x.n === n);
  let scale = 1;
  let sh = 0;
  if (r) {
    scale = pulse(t, r.at);
    sh = shiver(t, r.at);
  }
  if (t >= SEAM && n === 1) scale *= popIn(t, BUILD);
  return { n, scale, shiver: sh };
}
function worldState(t: number, shot: Extract<Shot, { kind: 'world' }>): DialState {
  if (shot.mode === 'phone') {
    const seam = t >= SEAM;
    // during the push the dial is frozen at the push's first frame (the f210 step's settle would otherwise drift node 2
    // off the camera's focus by hundreds of px at ×100)
    const tt = shot.fall !== undefined ? FALL.from : t;
    const rho = seam ? 0 : phoneRho(tt);
    const s: DialState = {
      mode: 'phone',
      rho,
      inkTo: seam ? -6.03 : phoneInkTo(tt),
      ring: (n) => phoneRing(t, n),
      pings: RINGS.flatMap((r) => {
        const g = ping(t, r.at, 12, 110);
        return g ? [{ phi: 36 * (r.n - 1), r: g.r, o: g.o }] : [];
      }),
    };
    if (shot.fall !== undefined) {
      // the push (STYLE §9.9): the rim and the ticks thin away ×3 → ×6 (no pop, no fade), then only node 2 is drawn —
      // the ring we fall through; the hand (nearer, so faster) leaves the frame by itself
      s.thin = clamp01((6 - shot.fall) / 3);
      if (shot.fall > 6) {
        s.only = 2;
        s.noTicks = true;
        s.noRim = true;
        s.pings = [];
      }
    }
    if (seam) {
      s.rimSpan = 26 * EASE.out3(clamp01((t - BUILD) / 10));
      s.tickOn = (a) => clamp01((t - (BUILD + (0.1 * Math.abs(a - NEEDLE_A)) / 1.2)) / 3);
    }
    return s;
  }
  // the agent: a clean teal rim, no nodes or stretches; answered calls are domes
  const s: DialState = {
    mode: 'agent',
    rho: agentRho(t),
    inkTo: 0,
    domes: AGENT_DOMES.map((d) => ({ phi: d.phi, scale: popIn(t, d.pop) })),
  };
  if (t < M.rebuild[1] + 4) {
    s.rimSpan = 200 * EASE.out3(clamp01((t - REBUILD) / 16));
    s.tickOn = (a) => clamp01((t - (REBUILD + (0.1 * Math.abs(a - NEEDLE_A)) / 1.2)) / 3);
  }
  return s;
}

/* ── the hand's look ── */
const collarFlash = (t: number) => {
  const u = t - PICKUP;
  const k = u < 0 ? 0 : u < 4 ? u / 4 : u < 8 ? 1 - (u - 4) / 4 : 0;
  return mixHex(INK.tealDeep, INK.teal, k);
};
function worldLook(t: number, shot: Extract<Shot, { kind: 'world' }>): HandLook {
  if (t >= SEAM) {
    const g = EASE.expo(clamp01((t - BUILD) / 8));
    return {
      angle: HAND.angle,
      dome: t >= DOME_T.home[1] ? { kind: 'graphite' } : { kind: 'none' },
      hub: g,
      reach: 1400 * g,
      shadow: clamp01((t - BUILD) / 8),
    };
  }
  if (shot.mode === 'phone' && t < M.cut) return { angle: HAND.angle + recoil(t), dome: { kind: 'graphite' } };
  // the fresh clock's hub (shot G on): it rings, then the pickup stamps it teal on the bar line
  const ringU = t - HUB_RING;
  const sh = ringU > 0 && ringU < 10 ? 1 + 0.04 * Math.max(0, Math.sin((2 * Math.PI * ringU) / 2.5)) * Math.exp(-ringU / 4) : 1;
  const scale = sh * pulse(t, PICKUP, 0.15);
  const dome: HandLook['dome'] = t >= DOME_T.leave ? { kind: 'none' } : t < PICKUP ? { kind: 'graphite', scale } : t < PICKUP + 4 ? { kind: 'wipe', u: (t - PICKUP) / 4, scale } : { kind: 'teal', scale };
  const g = ping(t, HUB_RING, HUB_R.dome, 90);
  return { angle: HAND.angle, dome, collar: collarFlash(t), ping: g };
}

/* ── the object layers of a shot ── */
type Layers = { node: React.ReactNode; objects: { what: string; pts: Pt[] }[]; hub?: { p: Pt; d: number } };
function worldLayers(t: number, shot: Extract<Shot, { kind: 'world' }>): Layers {
  const dialPlane = planeOf(shot.cam, K.dial);
  const handPlane = planeOf(shot.handCam, K.hand);
  const st = worldState(t, shot);
  const prim: Prim | null = shot.dial ? worldPrims(dialPlane, st) : null;
  const look = worldLook(t, shot);
  const showHand = shot.fall === undefined || shot.fall <= 12;
  const objects: Layers['objects'] = [];
  if (prim) objects.push({ what: 'object dial', pts: prim.pts });
  if (showHand) objects.push({ what: 'object hand', pts: handPts(handPlane, HUB, look.angle, 1, look.reach) });
  return {
    node: (
      <>
        {prim ? <DialSvg prim={prim} id="ig6-world" /> : null}
        {showHand ? <WorldHand id="ig6-hand" plane={handPlane} pivot={HUB} look={look} /> : null}
      </>
    ),
    objects,
    hub: { p: project(handPlane, HUB.x, HUB.y), d: 2 * HUB_R.dome * handPlane.S },
  };
}
/** M5′'s plane: the drawing's own scale (the drift, the open ×3 → ×1) and the whip's rotation */
function fullPlane(t: number, mode: 'phone' | 'agent'): Plane {
  const t0 = mode === 'phone' ? M.fall[1] : M.day;
  let g = drift(t, t0);
  let rot = 0;
  if (mode === 'phone') {
    g *= 1 + 2 * (1 - EASE.expo(clamp01((t - M.fall[1]) / 12)));
    if (t >= M.whip) rot = 75 * EASE.peel(clamp01((t - M.whip) / 7));
  }
  return { ax: FULL.cx, ay: FULL.cy, fx: FULL.cx, fy: FULL.cy, S: g, rot };
}
function fullLayers(t: number, mode: 'phone' | 'agent'): Layers {
  const p = fullPlane(t, mode);
  const phone = mode === 'phone';
  const theta = phone ? lapseTheta(t) : dayTheta(t);
  const prim = fullPrims(p, {
    mode,
    inkTo: phone ? lapseTheta(t, true) : 0,
    tickOn: phone ? (phi) => clamp01((t - (M.fall[1] + (phi / 360) * 10)) / 3) : undefined,
    ring: phone
      ? (n) => {
          const l = LAPSE_LANDS.find((x) => x.n === n && t >= x.at - 0.01 && t < x.at + 14);
          return { n, scale: l ? pulse(t, l.at) : 1, shiver: 0 };
        }
      : undefined,
    domes: phone ? undefined : DAY_DOMES.map((d) => ({ phi: d.phi, scale: Number.isFinite(d.pop) ? popIn(t, d.pop) : 1 })),
  });
  const look: HandLook = { angle: theta, dome: { kind: phone ? 'graphite' : 'teal' } };
  const centre = { x: FULL.cx, y: FULL.cy };
  const hp = handPts(p, centre, theta, FULL.hand);
  return {
    node: (
      <>
        <DialSvg prim={prim} id="ig6-full" />
        <FullHand id="ig6-fullhand" plane={p} centre={centre} scale={FULL.hand} look={look} />
      </>
    ),
    objects: [
      { what: 'object dial', pts: prim.pts },
      { what: 'object hand', pts: hp },
    ],
  };
}

/* ── the lockup box (STYLE §9.12): no object stroke inside it while a lockup is up ── */
const BOX = { x0: 296, x1: 900, y0: 1080, y1: 1400 } as const;
const OverlapCheck: React.FC<{ t: number; objects: Layers['objects'] }> = ({ t, objects }) => {
  const qa = useIg6Qa();
  if (!qa.zones || !lockupShowing(t)) return null;
  const hits: React.ReactNode[] = [];
  objects.forEach((o, i) => {
    const inside = o.pts.filter((q) => q.x > BOX.x0 && q.x < BOX.x1 && q.y > BOX.y0 && q.y < BOX.y1);
    if (!inside.length) return;
    const xs = inside.map((q) => q.x);
    const ys = inside.map((q) => q.y);
    const r = { x: Math.round(Math.min(...xs)), y: Math.round(Math.min(...ys)), w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)) };
    console.error(`[ig-zones] VIOLATION ig6 f${Number(t.toFixed(2))} ${o.what} inside the lockup box ${JSON.stringify(r)} the object's strokes must keep clear of x ${BOX.x0}–${BOX.x1}, y ${BOX.y0}–${BOX.y1} while a lockup is up`);
    hits.push(<div key={i} style={{ position: 'absolute', left: r.x - 4, top: r.y - 4, width: r.w + 8, height: r.h + 8, outline: '3px solid #ff1f3d', background: 'rgba(255,31,61,0.16)' }} />);
  });
  return <>{hits}</>;
};

/** the objects' rects below y 840 (the zone guard's `object` rule: x ≤ 880 there) */
const ObjectRects: React.FC<{ objects: Layers['objects'] }> = ({ objects }) => (
  <>
    {objects.map((o, i) => {
      const r = belowRect(o.pts, 840);
      return r ? <ZoneRect key={i} what={`${o.what} (below y 840)`} rect={r} /> : null;
    })}
  </>
);

/** frame 0's hub spot and its dome's screen diameter (where the travelling dome goes home in the seam) */
const hubAt = (t: number): { p: Pt; d: number } => {
  const s = shotAt(t);
  if (s.kind !== 'world') return { p: HUB, d: 2 * HUB_R.dome };
  const hp = planeOf(s.handCam, K.hand);
  return { p: project(hp, HUB.x, HUB.y), d: 2 * HUB_R.dome * hp.S };
};

export const Stage6: React.FC<{ t: number }> = ({ t }) => {
  const wm = useWordmarkFace();
  const shot = shotAt(t);
  let layers: Layers = { node: null, objects: [] };
  if (shot.kind === 'world') layers = worldLayers(t, shot);
  else if (shot.kind === 'full') layers = fullLayers(t, shot.mode);
  const dome = domeAt(t, hubAt(DOME_T.leave), hubAt(DOME_T.home[1]), wm);
  return (
    <AbsoluteFill style={{ background: INK.ground }}>
      {layers.node}
      {t >= T.END_CARD.field - 1 && t < T.IMPACT + 1 ? <CommentField6 t={t} /> : null}
      <Brand6 t={t} />
      <DomeFlyer s={dome} />
      <Lockups t={t} />
      <ObjectRects objects={layers.objects} />
      {dome ? <ZoneRect what={t >= DOME_T.fly[0] && t < DOME_T.home[0] + 0.5 ? 'wordmark full stop (the dome)' : 'object dome'} rect={{ x: dome.p.x - dome.d / 2, y: dome.p.y - dome.d / 2, w: dome.d, h: dome.d }} /> : null}
      <OverlapCheck t={t} objects={dome ? [...layers.objects, { what: 'object dome', pts: [-1, 0, 1].flatMap((i) => [{ x: dome.p.x + (i * dome.d) / 2, y: dome.p.y }, { x: dome.p.x, y: dome.p.y + (i * dome.d) / 2 }]) }] : layers.objects} />
    </AbsoluteFill>
  );
};

