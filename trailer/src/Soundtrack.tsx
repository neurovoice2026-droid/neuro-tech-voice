/**
 * Every sound, frame-locked. The cue sheet lives in timing.ts (CUES/BED),
 * computed from the same constants as the pictures. Files are synthesised
 * by scripts/generate-sfx.mjs into public/sfx (run automatically by
 * remotion.config.ts before studio/render).
 */
import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { BED, CUES } from './timing';

export const Soundtrack: React.FC = () => (
  <>
    <Html5Audio src={staticFile(`sfx/${BED.file}`)} volume={BED.vol} />
    {CUES.map((c, i) => (
      <Sequence key={`${c.file}-${c.at}-${i}`} from={c.at} name={`sfx ${c.file}`} layout="none">
        <Html5Audio src={staticFile(`sfx/${c.file}`)} volume={c.vol ?? 1} />
      </Sequence>
    ))}
  </>
);
