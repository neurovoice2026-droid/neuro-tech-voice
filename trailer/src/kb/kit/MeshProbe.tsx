/**
 * KB-KitMesh-* — a ground on its own, for looking at a palette / variant / key light at any time
 * (input props). `npx remotion still src/kb/index.ts KB-KitMesh-16x9 out.png --frame=120 --props='{"palette":"kb","lift":0}'`
 */
import React, { useState } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { waitForFonts } from '../../lib/fonts';
import { useLayout } from '../../lib/layout';
import { useSub } from '../scene';
import { HOME_KB_MESH, INK_MESH, MOMENT_LIGHTS, MUTED_MESH, PLAN_LIGHTS, type PlanId } from '../palettes';
import { MeshGround } from './MeshGround';

export type MeshProbeProps = {
  palette?: 'kb' | 'muted' | 'ink' | 'rush' | 'closing' | 'sunday' | 'night';
  lift?: number;
  recipe?: PlanId;
  keyOn?: boolean;
  grain?: number;
  dither?: number;
  blend?: string;
  quality?: number;
  shade?: number;
};

const PAL = {
  kb: HOME_KB_MESH,
  muted: MUTED_MESH,
  ink: INK_MESH,
  rush: MOMENT_LIGHTS.rush.orb,
  closing: MOMENT_LIGHTS.closing.orb,
  sunday: MOMENT_LIGHTS.sunday.orb,
  night: MOMENT_LIGHTS.night.orb,
} as const;

export const MeshProbe: React.FC<MeshProbeProps> = ({ palette = 'kb', lift = 1, recipe, keyOn = false, grain = 0, dither = 1, quality = 0.5, shade = 1 }) => {
  useState(() => waitForFonts());
  const L = useLayout();
  const t = useCurrentFrame() / useSub();
  return (
    <AbsoluteFill>
      <MeshGround
        t={t}
        palette={PAL[palette]}
        lift={lift}
        grain={grain}
        dither={dither}
        quality={quality}
        shade={shade}
        recipe={recipe ? PLAN_LIGHTS[recipe].ground : undefined}
        keyLight={keyOn ? { x: L.pick(1500, 760), y: L.pick(230, 330), strength: 0.35, color: MOMENT_LIGHTS.rush.orb[2] } : null}
      />
    </AbsoluteFill>
  );
};
