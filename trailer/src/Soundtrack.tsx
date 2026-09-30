/**
 * Every sound, frame-locked. The cue sheet lives in timing.ts (CUES, VOICES,
 * SPEECH, BED), computed from the same constants as the pictures.
 * SFX + bed are synthesised by scripts/generate-sfx.mjs (run automatically
 * by remotion.config.ts); voices by scripts/generate-voice.mjs (committed).
 * The bed ducks under every spoken line so the dialogue always leads.
 */
import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { BED, CUES, DUCK, SPEECH, VOICES } from './timing';

/** Bed gain at a frame: DUCK.gain inside speech windows, ramped. */
export function bedGain(frame: number): number {
  let g = 1;
  for (const [a, e] of SPEECH) {
    const r = DUCK.ramp;
    let k = 0;
    if (frame >= a - r && frame <= e + r * 2) {
      if (frame < a) k = (frame - (a - r)) / r;
      else if (frame <= e) k = 1;
      else k = 1 - (frame - e) / (r * 2);
    }
    g = Math.min(g, 1 - (1 - DUCK.gain) * Math.max(0, Math.min(1, k)));
  }
  return g;
}

export const Soundtrack: React.FC = () => (
  <>
    <Html5Audio src={staticFile(BED.file)} volume={(f) => BED.vol * bedGain(f)} />
    {VOICES.map((v) => (
      <Sequence key={`voice-${v.id}`} from={v.at} name={`voice ${v.id}`} layout="none">
        <Html5Audio src={staticFile(`voice/${v.id}.wav`)} volume={1} />
      </Sequence>
    ))}
    {CUES.map((c, i) => (
      <Sequence key={`${c.file}-${c.at}-${i}`} from={c.at} name={c.file} layout="none">
        <Html5Audio src={staticFile(c.file)} volume={c.vol ?? 1} />
      </Sequence>
    ))}
  </>
);
