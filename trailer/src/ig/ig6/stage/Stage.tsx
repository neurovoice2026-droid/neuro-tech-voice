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
import { HAND_FULL, HAND_LEN, HUB_R } from './handPath';
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

/** the M3′ macro's overshoot / recoil scale: 1 / its zoom (shot B; the reference frame keeps 1) */
const macroOs = (shot: Extract<Shot, { kind: 'world' }>) => (shot.name === 'B' ? 1 / shot.cam.zoom : 1);

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
    // the M3′ macro keeps the kick's on-screen swing at the reference frame's (crit-r1 N4: ×2.34 made ring 2 overshoot
    // the needle by ≈ 100 px on f184)
    const rho = seam ? 0 : phoneRho(tt, macroOs(shot));
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
      // the push (STYLE §9.9): everything on the dial scales PHYSICALLY — the ticks thicken and fly out of the bottom
      // edge, the rim thickens through node 2 and leaves through the frame's sides as the ring outgrows them, node 2's
      // white centre swallows the frame (crit-r2 P3: thinning the rim and ticks away mid-push left node 2 alone and
      // almost still, a stall in the dive). Node 2's band thins from 6–12 to 9–12 node radii as it grows (a sweeping
      // ring, not a black flood; crit-r1 N6b). Nothing is culled: what leaves, leaves by the frame's edges or the hole.
      s.nodeThin = clamp01((shot.fall - 1.5) / 4.5);
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
  if (shot.mode === 'phone' && t < M.cut) return { angle: HAND.angle + recoil(t, macroOs(shot)), dome: { kind: 'graphite' } };
  // the fresh clock's hub (shot G on): it rings, then the pickup stamps it teal on the bar line
  const ringU = t - HUB_RING;
  const sh = ringU > 0 && ringU < 10 ? 1 + 0.04 * Math.max(0, Math.sin((2 * Math.PI * ringU) / 2.5)) * Math.exp(-ringU / 4) : 1;
  // the stamp 1 → 1.2 → 1 (crit-r1 N10: at 1.15 the wordless pickup read weakly at phone size)
  const scale = sh * pulse(t, PICKUP, 0.2);
  const dome: HandLook['dome'] = t >= DOME_T.leave ? { kind: 'none' } : t < PICKUP ? { kind: 'graphite', scale } : t < PICKUP + 4 ? { kind: 'wipe', u: (t - PICKUP) / 4, scale } : { kind: 'teal', scale };
  // M2′'s ping: 3.5 px at 80 % ink (crit-r1 N10: the M1 / M3′ hairline idiom read as a pale grey line at phone size)
  const g = ping(t, HUB_RING, HUB_R.dome, 90);
  return { angle: HAND.angle, dome, collar: collarFlash(t), ping: g ? { r: g.r, o: (g.o * 0.8) / 0.6, w: 3.5 } : null };
}

/* ── the object layers of a shot ── */
type Layers = { node: React.ReactNode; objects: { what: string; pts: Pt[] }[]; hub?: { p: Pt; d: number } };
function worldLayers(t: number, shot: Extract<Shot, { kind: 'world' }>): Layers {
  const dialPlane = planeOf(shot.cam, K.dial);
  const handPlane = planeOf(shot.handCam, K.hand);
  const st = worldState(t, shot);
  const prim: Prim | null = shot.dial ? worldPrims(dialPlane, st) : null;
  const look = worldLook(t, shot);
  // the T2 push: the hand has left by motion — its plane lifts up and out over the push's first 3 f (Camera.ts HAND_OUT;
  // crit-r2 B1: the one-frame opacity cull read as a grey dissolve, a glitch). It is never translucent; once every point
  // of it and its shadow is past the top edge it is simply not drawn.
  const hp = handPts(handPlane, HUB, look.angle, 1, look.reach);
  const m = 60 * handPlane.S;
  const showHand = shot.fall === undefined || hp.some((q) => q.y > -m && q.y < 1920 + m && q.x > -m && q.x < 1080 + m);
  const objects: Layers['objects'] = [];
  if (prim) objects.push({ what: 'object dial', pts: prim.pts });
  if (showHand) objects.push({ what: 'object hand', pts: hp });
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
/** the M5′ open starts centred on the frame (out of the white: the rim closes in from all four corners at once, then
 *  from the top and bottom — crit-r2 P5: centred low, its bottom arc came in first and the clock seemed to rise) */
const OPEN_FROM = { x: 540, y: 960 } as const;
/** the hand and hub appear once the rim is in frame (f237: ×1.4, the rim at the sides) and extend out of the hub (6 f
 *  expo, the seam's grammar), so the first frames out of the white are the rim closing in, not a giant hand */
const HAND_IN = M.fall[1] + 3;
/** M5′'s plane: the drawing's own scale (the drift, the open ×3 → ×1) and the whip's rotation. The drift grows the dial
 *  about its TOP point (FULL.top, crit-r2 P2), so it grows downward and its 12 o'clock never meets the frame's edge */
function fullPlane(t: number, mode: 'phone' | 'agent'): Plane {
  const t0 = mode === 'phone' ? M.fall[1] : M.day;
  const d = drift(t, t0);
  const home = { x: FULL.cx, y: FULL.top + d * FULL.R };
  let g = d;
  let rot = 0;
  let ax = home.x;
  let ay = home.y;
  if (mode === 'phone') {
    const e = EASE.expo(clamp01((t - M.fall[1]) / 12));
    g *= 1 + 2 * (1 - e);
    // the centre holds the frame's centre while the rim closes in (the scale on expo), then glides home (7 f inOut): home
    // before S3's tier sets (f241), so no stroke meets the lockup box
    const ec = EASE.inOut(clamp01((t - M.fall[1]) / 7));
    ax = OPEN_FROM.x + (home.x - OPEN_FROM.x) * ec;
    ay = OPEN_FROM.y + (home.y - OPEN_FROM.y) * ec;
    if (t >= M.whip) rot = 75 * EASE.peel(clamp01((t - M.whip) / 7));
  }
  return { ax, ay, fx: FULL.cx, fy: FULL.cy, S: g, rot };
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
  // the open (shot E): the hub pops and the hand extends out of it once the rim is in frame (crit-r2 P5)
  const ext = phone ? EASE.expo(clamp01((t - HAND_IN) / 6)) : 1;
  // the hub leads (3 f expo), the hand grows out of it (6 f expo) — the seam's build, quicker
  const hubIn = phone ? EASE.expo(clamp01((t - HAND_IN) / 3)) : 1;
  const look: HandLook =
    ext >= 1 ? { angle: theta, dome: { kind: phone ? 'graphite' : 'teal' } } : { angle: theta, dome: { kind: 'graphite', scale: hubIn }, hub: hubIn, reach: (HAND_LEN + 40) * ext, shadow: ext };
  const centre = { x: FULL.cx, y: FULL.cy };
  const showHand = ext > 0 || hubIn > 0;
  const hp = showHand ? handPts(p, centre, theta, FULL.hand, look.reach, HAND_FULL) : [];
  return {
    node: (
      <>
        <DialSvg prim={prim} id="ig6-full" />
        {showHand ? <FullHand id="ig6-fullhand" plane={p} centre={centre} scale={FULL.hand} look={look} /> : null}
      </>
    ),
    objects: [
      { what: 'object dial', pts: prim.pts },
      ...(hp.length ? [{ what: 'object hand', pts: hp }] : []),
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

