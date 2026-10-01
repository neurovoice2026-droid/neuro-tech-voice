/**
 * The soundtrack: ONE master file, frame-locked from frame 0.
 *
 * scripts/generate-sfx.mjs (run by remotion.config.ts before every studio /
 * render) synthesises every effect and the music bed, then mixes them with the
 * voices offline — sample-accurate cue placement, panning and pan moves, the
 * rooms of each act, ducking and a speech-band dynamic EQ under every line,
 * loudness to MIX.lufs and a true-peak limiter — into public/sfx/mix.wav.
 * The cue sheet itself (CUES, VOICES, SPEECH, DUCK, BED, MIX) lives in timing.ts,
 * computed from the same constants as the pictures.
 */
import React from 'react';
import { Html5Audio, staticFile } from 'remotion';
import { MIX } from './timing';

export const Soundtrack: React.FC = () => <Html5Audio src={staticFile(MIX.file)} volume={1} />;
