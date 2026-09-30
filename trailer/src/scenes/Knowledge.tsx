import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT } from '../theme';

/** PLACEHOLDER — replaced by the real scene. */
export const Knowledge: React.FC = () => {
  const t = useSceneFrame('knowledge');
  if (t < 0) return null;
  return (
    <AbsoluteFill style={{ background: C.white, alignItems: 'center', justifyContent: 'center', color: C.ink, fontFamily: FONT.display, fontSize: 80 }}>
      Knowledge {t}
    </AbsoluteFill>
  );
};
