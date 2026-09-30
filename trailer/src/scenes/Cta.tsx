import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT } from '../theme';

/** PLACEHOLDER — replaced by the real scene. */
export const Cta: React.FC = () => {
  const t = useSceneFrame('cta');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', color: C.paper, fontFamily: FONT.display, fontSize: 80 }}>
      Cta {t}
    </AbsoluteFill>
  );
};
