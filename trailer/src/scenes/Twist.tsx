import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT } from '../theme';

/** PLACEHOLDER — replaced by the real scene. */
export const Twist: React.FC = () => {
  const t = useSceneFrame('twist');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', color: C.paper, fontFamily: FONT.display, fontSize: 80 }}>
      Twist {t}
    </AbsoluteFill>
  );
};
