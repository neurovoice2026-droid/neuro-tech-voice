/**
 * SCALE — the white act montage, 19.5 s (scale-local frames; every value from
 * SCALE / SCALE_LOCAL in timing.ts). Every business, every language, every
 * system — each with room to be read. Paper and ink, ONE accent (the closing
 * light's emerald, scale/lights.ts).
 *
 *   THE INDEX (−4 … HERO)  out of the knowledge whip, "Home services" fills
 *              the frame, carrying the whip's momentum; the camera pulls back
 *              continuously, always FRAMING THE NAMES landed so far with lead
 *              room for the next (scale/camera.ts), as sixteen industries are
 *              set into a typographic index (scale/Index.tsx) — the top half
 *              on the 8th notes, the bottom half on 16ths into the slam. Each
 *              name rises out of its mask in ink, takes the accent for its
 *              beat (the light is on it), and settles to the index's 30 %
 *   THE HERO (HERO … langTitle, 2 s)  the index steps back to ≤ 5.5 % before
 *              the title shows, and "16 industries." lands in the index's
 *              spine on the downbeat — no name behind it — word by word out of
 *              its masks, the camera pushing in softly; "16" turns to the
 *              accent as light runs through it, and again mid-hold. Then the
 *              names leave up through their masks, the title lifts to the band
 *              and leaves as "14 languages." rises into it (landing ON
 *              langTitle), and the English card rises in
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
 * Planes: the paper room (screen space, behind the camera) · the index, the
 * cards and the titles (depth 1). No bokeh, no tinted grounds, no blur of any
 * kind — the master renders at 120 fps and every move is a continuous
 * function of the fractional time.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, camMoving, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { EASE, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { ROOM } from '../theme';
import { SCALE, SCALE_LOCAL } from '../timing';
import { Room } from './scale/Backdrop';
import { camAt, cameraProps } from './scale/camera';
import { Rail, StationCards, type FlowTiming } from './scale/Flow';
import { geo } from './scale/geometry';
import { Titles } from './scale/Heading';
import { Index } from './scale/Index';
import { LangCards } from './scale/Langs';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;

export const Scale: React.FC = () => {
  const t = useSceneFrame('scale');
  const L = useLayout();
  if (t < -K.preroll) return null;
  const v = L.vertical;
  const G = geo(L);

  /* ── camera ───────────────────────────────────────────────────── */
  const cam = camAt(t, G, L);
  const cp = cameraProps(cam, L);

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

  // the slow push of the flow about FLOW_END (1 → 1.03): the CRM node never moves
  const fzAt = (tt: number) => 1 + 0.03 * tween(tt, K.flowPush, [0, 1], EASE.inOut);
  const fz = fzAt(t);
  const pushing = Math.abs(fzAt(t + 0.25) - fzAt(t - 0.25)) > 1e-6;
  const stagePush = fz > 1.00001 ? `scale(${fz.toFixed(5)})` : undefined;
  // the slow moves (the hero push, the language push, the flow nudges and the stage push) glide: the
  // type on the planes rides its own small sub-pixel layers while they move (Camera.tsx useGlide — the
  // cards, the titles, the station names). The index's pull-back is fast and spans a 4× zoom: plain.
  const moving = t >= HERO - 2 && (pushing || camMoving((tt) => cameraProps(camAt(tt, G, L), L), t));
  // out of the knowledge whip's clean white: the room's shading comes up over the first frames
  const fromWhite = 1 - tween(t, [-K.preroll, 12], [0, 1], EASE.inOut);

  return (
    <AbsoluteFill style={{ background: ROOM.paper.wall, overflow: 'hidden' }}>
      {/* 0 · the paper room: screen space, behind the camera */}
      <Room t={t} L={L} />
      {fromWhite > 0.002 ? <AbsoluteFill style={{ background: '#ffffff', opacity: fromWhite }} /> : null}
      <Camera x={cp.x} y={cp.y} zoom={cp.zoom} moving={moving}>
        {/* 1.0 · the index → the languages → the flow (pushed about FLOW_END), then the titles */}
        <Layer depth={1}>
          <AbsoluteFill style={{ transform: stagePush, transformOrigin: `${G.end.x}px ${G.end.y}px`, zIndex: 0 }}>
            <Index t={t} G={G} vertical={v} />
            <Rail t={t} G={G} vertical={v} T={flowT} />
            <LangCards t={t} G={G} vertical={v} flowT={flowT} />
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
