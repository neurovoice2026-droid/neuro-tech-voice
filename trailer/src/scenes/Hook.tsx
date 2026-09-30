import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT } from '../theme';

/** PLACEHOLDER — replaced by the real scene. */
export const Hook: React.FC = () => {
  const t = useSceneFrame('hook');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', color: C.paper, fontFamily: FONT.display, fontSize: 80 }}>
      Hook {t}
    </AbsoluteFill>
  );
};
