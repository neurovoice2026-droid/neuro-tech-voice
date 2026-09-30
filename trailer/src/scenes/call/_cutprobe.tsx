// TEMP verification entry (deleted after use): the call + what the RESULT must draw at its t 0.
import React, { useState } from 'react';
import { AbsoluteFill, Composition, registerRoot, Sequence, useCurrentFrame } from 'remotion';
import { Grain } from '../../components/Grain';
import { BookedMark, MarkGlow } from '../../components/Shared';
import { waitForFonts } from '../../lib/fonts';
import { MARK_GLOW_HANDOFF } from '../../lib/handoff';
import { C } from '../../theme';
import { DURATION, FPS, LANDSCAPE, SCENES, VERTICAL } from '../../timing';
import { Call } from '../Call';

const ResultT0: React.FC = () => {
  const f = useCurrentFrame();
  if (f < SCENES.result.from) return null;
  return (
    <AbsoluteFill>
      <MarkGlow k={MARK_GLOW_HANDOFF} />
      <BookedMark color={C.emberLit} />
    </AbsoluteFill>
  );
};
const Comp: React.FC<{ grain: boolean }> = ({ grain }) => {
  useState(() => waitForFonts());
  const s = SCENES.call;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      <Sequence from={s.from - s.pre} durationInFrames={s.to + s.post - (s.from - s.pre)}>
        <Call />
      </Sequence>
      <ResultT0 />
      {grain ? <Grain opacity={0.15} blend="overlay" /> : null}
    </AbsoluteFill>
  );
};
const Root: React.FC = () => (
  <>
    <Composition id="Probe-16x9" component={Comp} defaultProps={{ grain: false }} durationInFrames={DURATION} fps={FPS} {...LANDSCAPE} />
    <Composition id="Probe-9x16" component={Comp} defaultProps={{ grain: false }} durationInFrames={DURATION} fps={FPS} {...VERTICAL} />
  </>
);
registerRoot(Root);
