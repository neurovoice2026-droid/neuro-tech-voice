/**
 * Per-scene dev entry points (src/dev/<scene>.tsx): each bundles ONE scene
 * plus the shared core, on the real timeline (frame numbers are global), so
 * a scene can be previewed / rendered as stills in isolation:
 *
 *   npx remotion still src/dev/call.tsx Call-16x9 out/dev/call-300.png --frame=300
 */
import React, { useState } from 'react';
import { AbsoluteFill, Composition, Sequence } from 'remotion';
import { useSub } from '../lib/scene';
import { FilmGrain } from '../components/Grain';
import { waitForFonts } from '../lib/fonts';
import { C } from '../theme';
import { DURATION, FPS, LANDSCAPE, SCENES, VERTICAL, type SceneKey } from '../timing';

export function devRoot(key: SceneKey, Scene: React.FC) {
  const s = SCENES[key];
  const Comp: React.FC = () => {
    useState(() => waitForFonts());
    const sub = useSub();
    return (
      <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
        <Sequence from={(s.from - s.pre) * sub} durationInFrames={(s.to + s.post - (s.from - s.pre)) * sub}>
          <Scene />
        </Sequence>
        <FilmGrain white={key === 'scale' || key === 'knowledge' ? 1 : 0} />
      </AbsoluteFill>
    );
  };
  const title = key[0].toUpperCase() + key.slice(1);
  const DevRoot: React.FC = () => (
    <>
      <Composition id={`${title}-16x9`} component={Comp} durationInFrames={DURATION} fps={FPS} {...LANDSCAPE} />
      <Composition id={`${title}-9x16`} component={Comp} durationInFrames={DURATION} fps={FPS} {...VERTICAL} />
    </>
  );
  return DevRoot;
}
