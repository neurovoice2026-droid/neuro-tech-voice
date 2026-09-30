/**
 * The film. Six scenes, each its own component (src/scenes), placed on the
 * timeline from timing.ts. Scenes overlap by their pre/post frames so a
 * shape can carry across a cut (match cuts); later scenes sit on top.
 */
import React, { useState } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Grain } from './components/Grain';
import { waitForFonts } from './lib/fonts';
import { tween } from './lib/motion';
import { Soundtrack } from './Soundtrack';
import { SCENES, SCALE, type SceneKey } from './timing';
import { C } from './theme';
import { Hook } from './scenes/Hook';
import { Twist } from './scenes/Twist';
import { Call } from './scenes/Call';
import { Result } from './scenes/Result';
import { Scale } from './scenes/Scale';
import { Cta } from './scenes/Cta';

export const SCENE_COMPONENTS: Record<SceneKey, React.FC> = {
  hook: Hook,
  twist: Twist,
  call: Call,
  result: Result,
  scale: Scale,
  cta: Cta,
};

export const ORDER: SceneKey[] = ['hook', 'twist', 'call', 'result', 'scale', 'cta'];

/** Grain: the cover's overlay grain on the dark; lighter on the white act. */
const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const whiteIn = SCENES.scale.from;
  const whiteOut = SCENES.scale.from + SCALE.irisToDark[1];
  const onWhite =
    tween(frame, [whiteIn - 4, whiteIn + 2], [0, 1]) * (1 - tween(frame, [whiteOut - 10, whiteOut], [0, 1]));
  return (
    <>
      <Grain opacity={0.15 * (1 - onWhite)} blend="overlay" />
      <Grain opacity={0.07 * onWhite} blend="multiply" freq={0.9} />
    </>
  );
};

export const Trailer: React.FC<{ only?: SceneKey; audio?: boolean }> = ({ only, audio = true }) => {
  useState(() => waitForFonts());
  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      {ORDER.filter((k) => !only || k === only).map((key) => {
        const s = SCENES[key];
        const Scene = SCENE_COMPONENTS[key];
        return (
          <Sequence
            key={key}
            name={key}
            from={s.from - s.pre}
            durationInFrames={s.to + s.post - (s.from - s.pre)}
          >
            <Scene />
          </Sequence>
        );
      })}
      <FilmGrain />
      {audio && !only ? <Soundtrack /> : null}
    </AbsoluteFill>
  );
};
