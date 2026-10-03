/**
 * Film 2, "Two Kinds of Work" (the knowledge-base film): nine acts, each its own component
 * (src/kb/scenes), placed on the timeline from src/kb/timing.ts — the mirror of film 1's Trailer.tsx
 * (docs/kb/PIPELINE.md §3). Acts overlap by their pre/post frames (0 for the placeholder cards); later
 * acts sit on top. The finishing grain follows the rooms: paper until the close darkens into night.
 */
import React, { useState } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { FilmGrain as Finish } from '../components/Grain';
import { waitForFonts } from '../lib/fonts';
import { tween } from '../lib/motion';
import { C } from '../theme';
import { useSub, useTimelineFrame } from './scene';
import { Soundtrack } from './Soundtrack';
import { GRAIN, KB_ORDER, SCENES, type KbSceneKey } from './timing';
import { Repeat } from './scenes/Repeat';
import { Recording } from './scenes/Recording';
import { Turn } from './scenes/Turn';
import { Written } from './scenes/Written';
import { Call } from './scenes/Call';
import { Line } from './scenes/Line';
import { Change } from './scenes/Change';
import { Matters } from './scenes/Matters';
import { Cta } from './scenes/Cta';

export const KB_SCENES: Record<KbSceneKey, React.FC> = {
  repeat: Repeat,
  recording: Recording,
  turn: Turn,
  written: Written,
  call: Call,
  line: Line,
  change: Change,
  matters: Matters,
  cta: Cta,
};

/** The finishing grain (components/Grain FilmGrain): paper grain on the paper acts, crossfading to the night's into the close. */
const FilmGrain: React.FC = () => {
  const frame = useTimelineFrame();
  return <Finish white={1 - tween(frame, [GRAIN.white[0], GRAIN.white[1]], [0, 1])} />;
};

export const KbFilm: React.FC<{ only?: KbSceneKey; audio?: boolean }> = ({ only, audio = true }) => {
  useState(() => waitForFonts());
  const sub = useSub();
  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      {KB_ORDER.filter((k) => !only || k === only).map((key) => {
        const s = SCENES[key];
        const Scene = KB_SCENES[key];
        return (
          <Sequence key={key} name={key} from={(s.from - s.pre) * sub} durationInFrames={(s.to + s.post - (s.from - s.pre)) * sub}>
            <Scene />
          </Sequence>
        );
      })}
      <FilmGrain />
      {audio && !only ? <Soundtrack /> : null}
    </AbsoluteFill>
  );
};
