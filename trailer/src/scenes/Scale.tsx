/**
 * SCALE — the white act montage, 19.5 s (scale-local frames; every value from
 * SCALE / SCALE_LOCAL in timing.ts). Every business, every language, every
 * system — each with room to be read. Paper and ink, one accent (the
 * closing light's emerald, scale/lights.ts); the four lights pass only as
 * the hour, on the card that has just landed.
 *
 *   THE WALL (−4 … HERO)  out of the knowledge whip, card 01 fills the frame
 *              mid-landing, carrying the whip's momentum; the camera pulls
 *              back continuously, always FRAMING THE CLUSTER landed so far
 *              with lead room for the next slot (scale/camera.ts), as sixteen
 *              industries land in the block order — eight on the 8th notes,
 *              eight on 16ths into the slam. Each card is placed on the wall:
 *              it rises a few px and settles from .92 on a soft spring while
 *              its shadow tightens; its monoline icon draws on in the hour's
 *              ink (rush → closing → sunday → night, four cards each) and
 *              settles to ink; its name rises out of its mask
 *   THE HERO (HERO … langTitle, 2 s)  the wall steps back under a paper veil
 *              (it stays legible as texture) and "16 industries." lands on
 *              the downbeat, word by word out of its masks, the camera
 *              pushing in softly; "16" turns to the accent as light runs
 *              through it, and again mid-hold. Then fifteen cards leave
 *              outwards, the keeper glides into the English card and turns
 *              to it; the title lifts to the band and leaves as "14
 *              languages." rises into it, landing ON langTitle
 *   THE LANGUAGES (langTitle … flow)  scale/Langs.tsx: English heard whole;
 *              the quick four slide in one per voice (1 – 1.25 s each),
 *              each showing only what is heard ("Sunt Ava," …); Japanese
 *              whole; the gallery fills under the focus until all six are
 *              visible together
 *   THE FLOW (flow … irisToDark)  "After the call." rises as "14
 *              languages." leaves; Japanese becomes THE CALL; then SLACK and
 *              CRM one per 2 beats, "Contact saved" confirming in the accent;
 *              the finished rail holds ≈ 1.8 s (light pulses run along it);
 *              the CRM node sits exactly at FLOW_END, where the CTA's iris
 *              opens (SCALE.irisToDark)
 *
 * Planes: the paper room (screen space, behind the camera) · the cards and
 * titles (depth 1). No bokeh, no tinted grounds, no blur of any kind — the
 * master renders at 120 fps and every move is a continuous function of the
 * fractional time.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { EASE, SPRING, springUnit, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { ROOM } from '../theme';
import { SCALE, SCALE_LOCAL } from '../timing';
import { Room } from './scale/Backdrop';
import { camAt, cameraProps } from './scale/camera';
import { Card, IND, IndustryFace, POP } from './scale/Cards';
import { INDUSTRIES } from './scale/data';
import { Rail, StationCards, type FlowTiming } from './scale/Flow';
import { centre, geo } from './scale/geometry';
import { Titles } from './scale/Heading';
import { LangCards } from './scale/Langs';
import { cardLight } from './scale/lights';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;
/** how far the wall steps back under the hero title (its opacity under the paper veil) */
const VEIL = 0.9;

/** paper-white gaussian stops (exactly 0 at the edge) for the hero's clearing */
const paperStops = (a: number) => {
  const k = 3.2;
  const e = Math.exp(-k);
  return Array.from({ length: 13 }, (_, i) => {
    const r = i / 12;
    return `rgba(255,255,255,${((a * (Math.exp(-k * r * r) - e)) / (1 - e)).toFixed(4)}) ${(r * 100).toFixed(1)}%`;
  }).join(', ');
};

/* ── the industry cards ──────────────────────────────────────────── */
/** card i starts to land 2 f before its tick (it is mid-flight ON the hit, settled ≈ 4 f after); card 01 pre-rolls,
 *  already half landed on the scene's first frame (−preroll), so the cut never shows an empty white frame */
const popStart = (i: number) => (i === 0 ? K.pops[0] - K.preroll - 1.5 : K.pops[i] - 2);

/* ── the fifteen leaving cards ───────────────────────────────────── */
function flyAt(i: number, order: number, tt: number, u: { x: number; y: number }) {
  const s = K.flyOut + order * K.flyStagger;
  const A = K.flyAnticip;
  // a soft 3 f gather (a few px inwards), then away, accelerating (power2.in)
  const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
  const q = tween(tt, [s, s + K.flyDur], [0, 1], EASE.in2);
  const d = -10 * pre + q * 2300;
  const spin = (random(`scale-fly-r-${i}`) > 0.5 ? 1 : -1) * (2 + 3 * random(`scale-fly-rr-${i}`));
  return { x: u.x * d, y: u.y * d, rot: spin * q, sc: 1 - 0.02 * pre + 0.06 * q, q, moving: pre > 0 || q > 0 };
}

/* ────────────────────────────────────────────────────────────────── */

export const Scale: React.FC = () => {
  const t = useSceneFrame('scale');
  const L = useLayout();
  if (t < -K.preroll) return null;
  const v = L.vertical;
  const G = geo(L);
  const m = IND(v);

  /* ── camera ───────────────────────────────────────────────────── */
  const cam = camAt(t, G, L);
  const cp = cameraProps(cam, L);

  /* ── the hero: the wall steps back under a paper veil (it starts 3 f before the downbeat) ── */
  const veil = VEIL * tween(t, [HERO - 3, HERO + 7], [0, 1], EASE.out3);

  /* ── the fifteen that leave: outermost first, each along its own ray from the wall's centre ── */
  const wc = centre(G.wall);
  const leaving = Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== G.keeper);
  const flyOrder = [...leaving].sort((a, b) => {
    const da = Math.hypot(centre(G.cards[a]).x - wc.x, centre(G.cards[a]).y - wc.y) + random(`scale-fo-${a}`) * 240;
    const db = Math.hypot(centre(G.cards[b]).x - wc.x, centre(G.cards[b]).y - wc.y) + random(`scale-fo-${b}`) * 240;
    return db - da;
  });
  const dirOf = (i: number) => {
    const c = centre(G.cards[i]);
    const a = Math.atan2(c.y - wc.y, c.x - wc.x) + (random(`scale-fly-a-${i}`) - 0.5) * 0.4;
    return { x: Math.cos(a), y: Math.sin(a) };
  };

  const flowT: FlowTiming = {
    trackIn: K.trackIn,
    stations: K.stations,
    fills: K.fills,
    cardsIn: K.cardsIn,
    rails: K.rails,
    ok: K.ok,
    ping: K.ping,
    stream: K.stream,
    moteDur: K.moteDur,
    callIn: K.callIn,
    pill: K.pill,
  };

  /** one wall card: it lands, holds, steps back under the veil, then (unless it is the keeper) leaves */
  const wallCard = (i: number, o: number) => {
    const s = popStart(i);
    if (t < s) return null;
    const r = G.cards[i];
    const keeper = i === G.keeper;
    if (keeper && t >= K.glide - 4) return null; // the English card (scale/Langs.tsx) takes it from here
    const f = keeper ? { x: 0, y: 0, rot: 0, sc: 1, q: 0, moving: false } : flyAt(i, o, t, dirOf(i));
    if (f.q >= 0.999) return null;
    if (f.q > 0) {
      // once a leaving card is wholly off the frame it costs nothing
      const c = centre(r);
      const rr = 0.75 * Math.hypot(r.w, r.h) * f.sc * cam.s + 20;
      const x = cam.ax + cam.s * (c.x + f.x);
      const y = cam.ay + cam.s * (c.y + f.y);
      if (x + rr < 0 || x - rr > L.width || y + rr < 0 || y - rr > L.height) return null;
    }
    // the landing: a soft spring from .92 and a few px low, its shadow tightening as it settles
    const p = springUnit(t - s, POP);
    // card 01 carries the knowledge whip's momentum (16:9 from the right, 9:16 from below)
    const mom = i === 0 ? 64 * (1 - springUnit(t - s, SPRING.pop)) : 0;
    const dx = (v ? 0 : mom) + f.x;
    const dy = (1 - p) * 0.08 * r.h + (v ? mom : 0) + f.y;
    const sc = (0.92 + 0.08 * p) * f.sc;
    const settling = Math.abs(1 - p) > 2e-4 || mom > 0.01;
    const moving = settling || f.moving;
    const transform = moving ? `translate(${dx.toFixed(3)}px, ${dy.toFixed(3)}px) rotate(${f.rot.toFixed(3)}deg) scale(${sc.toFixed(5)})` : undefined;
    return (
      <Card
        key={`wc-${i}`}
        r={r}
        transform={transform}
        opacity={Math.min(1, p / 0.3)}
        lift={1 + 1.2 * Math.max(0, 1 - p) + 0.6 * f.q}
        radius={m.radius}
        z={t < K.pops[i] + 6 ? 2 : 1}
      >
        {/* (card 01 is read from the cut: its face is up before the whip lets go of it) */}
        <IndustryFace d={INDUSTRIES[i]} t={t} at={i === 0 ? s - 12 : s} tick={K.pops[i]} light={cardLight(i)} vertical={v} still={t > K.pops[i] + 24} />
      </Card>
    );
  };

  // the hero's clearing (a wide gaussian of paper light behind the title), gone as the title flicks out
  const clearing = (veil / VEIL) * (1 - tween(t, [K.titleExit - 1, K.titleExit + 6], [0, 1], EASE.inOut));
  const clearW = G.title.hero.size * L.pick(9.4, 8.8);
  const clearH = G.title.hero.size * L.pick(4.0, 4.4);

  // the slow push of the flow about FLOW_END (1 → 1.03): the CRM node never moves
  const fz = 1 + 0.03 * tween(t, K.flowPush, [0, 1], EASE.inOut);
  const stagePush = fz > 1.00001 ? `scale(${fz.toFixed(5)})` : undefined;
  const wallOn = t < K.flyOut + K.flyDur + 16;
  // out of the knowledge whip's clean white: the room's shading comes up over the first frames
  const fromWhite = 1 - tween(t, [-K.preroll, 12], [0, 1], EASE.inOut);

  return (
    <AbsoluteFill style={{ background: ROOM.paper.wall, overflow: 'hidden' }}>
      {/* 0 · the paper room: screen space, behind the camera */}
      <Room t={t} L={L} />
      {fromWhite > 0.002 ? <AbsoluteFill style={{ background: '#ffffff', opacity: fromWhite }} /> : null}
      <Camera x={cp.x} y={cp.y} zoom={cp.zoom}>
        {/* 1.0 · the wall → the languages → the flow (pushed about FLOW_END), then the titles */}
        <Layer depth={1}>
          <AbsoluteFill style={{ transform: stagePush, transformOrigin: `${G.end.x}px ${G.end.y}px`, zIndex: 0 }}>
            {wallOn ? (
              <AbsoluteFill style={{ opacity: veil > 0.001 ? 1 - veil : undefined }}>
                {Array.from({ length: 16 }, (_, i) => wallCard(i, flyOrder.indexOf(i)))}
              </AbsoluteFill>
            ) : null}
            {/* the title's clearing: the softbox's paper light over the stepped-back wall, where the words sit */}
            {clearing > 0.002 ? (
              <div
                style={{
                  position: 'absolute',
                  left: G.title.hero.x - clearW / 2,
                  top: G.title.hero.y - clearH / 2,
                  width: clearW,
                  height: clearH,
                  background: `radial-gradient(closest-side, ${paperStops(0.95 * clearing)})`,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <Rail t={t} G={G} vertical={v} T={flowT} />
            <LangCards t={t} G={G} vertical={v} veil={veil} flowT={flowT} />
            <StationCards t={t} G={G} vertical={v} T={flowT} />
          </AbsoluteFill>
          <Titles
            t={t}
            T={{ hero: HERO, glint: K.heroGlint, swap: K.titleSwap, exit: K.titleExit, in: K.titleIn, out: K.titleOut, after: K.titleAfter }}
            hero={G.title.hero}
            band={G.title.band}
            after={G.title.after}
            vertical={v}
          />
        </Layer>
      </Camera>
    </AbsoluteFill>
  );
};
