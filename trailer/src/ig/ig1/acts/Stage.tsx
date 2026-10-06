/**
 * REEL 1 · THE STAGE — acts b1–b5 (docs/ig/SCRIPT.md ig1 §4): hook, hours, shift, does, desk are ONE continuous picture,
 * so each act's <Sequence> mounts this same stage at its own absolute frame (every part is a pure function of it, so an
 * act boundary is invisible):
 *
 *   ground   the pearl MUTED_MESH, its light low-left (graphite-warm) → the sunday pool behind the week from "other"
 *   plane    the camera plane (stage.ts zoomAt, about the grid's centre): frame 0's composition (Hook.tsx) and the week
 *            grid (WeekGrid.tsx); while it zooms the type on it rides its own small sub-pixel layers (lib/glide)
 *   cards    b4's call records over the receding week (Cards.tsx)
 *   orb      her one orb through the reel (Ig1Orb: stage.ts orbPose)
 *   captions every narrator line in the caption band (x 86, y 1200, ≤ 820), word-synced (components/Captions); "123?" and
 *            "agent's shift." take her teal on their onsets
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GlideContext } from '../../../lib/glide';
import { MOMENT_LIGHTS } from '../../../kb/palettes';
import { useKitFaces } from '../../../kb/kit';
import { Captions } from '../../components/Captions';
import { AvaOrb, orbTrack } from '../../components/Orb';
import { useActFrame } from '../../scene';
import { OutcomeCards } from '../Cards';
import { chromeAt, ctaDimAt, ORB_CANVAS, orbPose, planeTransform, recedeAt, zoomAt, zooming } from '../stage';
import * as T from '../timing';
import { DESK } from '../desk';
import { WeekGrid } from '../WeekGrid';
import { fullStop, Ig1Frame0, Ig1Ground } from './Hook';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** how far the week steps back behind the call records (b4): a quiet ground for the white cards, so its rows never
 *  read as stripes in the gaps between them */
const RECEDE_DIM = 0.74;
const TEAL_KEY = { ink: SUNDAY.ink, glint: SUNDAY.orb[2] } as const;

/** the camera plane at absolute frame t: its children are laid out at zoom 1 */
export const Plane: React.FC<{ t: number; z?: number; children: React.ReactNode }> = ({ t, z, children }) => {
  const zz = z ?? zoomAt(t);
  const moving = z === undefined ? zooming(t) : false;
  return (
    <GlideContext.Provider value={moving}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: Math.abs(zz - 1) > 1e-6 ? planeTransform(zz) : undefined }}>{children}</AbsoluteFill>
    </GlideContext.Provider>
  );
};

/** her orb, on her one path (needs the faces: her first pose is the full stop of the measured "ours") */
export const Ig1Orb: React.FC<{ t: number; seam?: { at: number; dur: number; to: { x: number; y: number }; dot: number; t0: number } }> = ({ t, seam }) => {
  const ready = useKitFaces();
  if (!ready) return null;
  const stop = fullStop();
  const p = orbPose(t, stop);
  let pose = { x: p.x, y: p.y, d: p.d, moving: p.moving };
  if (seam && t > seam.at) {
    // the seam: she glides down onto the desk and closes into the phone's light (frame 0's dot)
    const g = Math.min(1, (t - seam.at) / seam.dur);
    const e = g * g * (3 - 2 * g);
    pose = { x: p.x + (seam.to.x - p.x) * e, y: p.y + (seam.to.y - p.y) * e, d: p.d, moving: g < 1 };
  }
  return (
    <AvaOrb
      t={t}
      pose={pose}
      canvas={ORB_CANVAS}
      track={orbTrack(T)}
      pop={{ at: T.M.ours + 2 }}
      close={seam ? { at: seam.at + 2, dur: seam.dur - 2, dot: seam.dot, t0: seam.t0, rings: DESK.rings } : undefined}
      opacity={p.opacity}
      rim={0.8}
    />
  );
};

/** the narrator's captions on the stage (the hook's are frame 0's own; the CTA is the end card's) */
const LINES = ['ig1-02', 'ig1-03', 'ig1-04', 'ig1-05'] as const;
const KEYS: Record<string, { words: readonly number[]; ink: string; glint: string }[]> = {
  'ig1-03': [
    { words: [2, 3, 4], ...TEAL_KEY },
    { words: [7, 8], ...TEAL_KEY },
  ],
};

export const Ig1Stage: React.FC<{ t: number }> = ({ t }) => {
  const z = zoomAt(t);
  return (
    <AbsoluteFill>
      <Ig1Ground t={t} />
      <Plane t={t}>
        {t < T.HOURS + 8 ? <Ig1Frame0 t={t} /> : null}
        <WeekGrid t={t} zoom={z} fx={{ dim: Math.max(RECEDE_DIM * recedeAt(t), ctaDimAt(t)), chromeA: chromeAt(t) }} />
      </Plane>
      <OutcomeCards t={t} />
      <Ig1Orb t={t} />
      {LINES.map((id) => (
        <Captions key={id} T={T} id={id} t={t} keys={KEYS[id] ?? []} what="caption" />
      ))}
    </AbsoluteFill>
  );
};

/** one of the stage's acts: the stage at the act's absolute frame */
export function stageAct(key: T.SceneKey): React.FC {
  const Act: React.FC = () => {
    const t = useActFrame(T.SCENES, key);
    return <Ig1Stage t={T.SCENES[key].from + t} />;
  };
  Act.displayName = `ig1-${key}`;
  return Act;
}
