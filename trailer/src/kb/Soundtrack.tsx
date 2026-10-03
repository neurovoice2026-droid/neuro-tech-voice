/**
 * Film 2's soundtrack: ONE master file, frame-locked from frame 0 — public/kb/sfx/mix.wav, built by
 * scripts/kb/generate-sfx.mjs (remotion.config.ts runs it before a studio / render whose entry point is
 * src/kb/index.ts, or for a prebuilt kb bundle with NTV_FILM=kb). The cue sheet lives in src/kb/timing.ts.
 */
import React from 'react';
import { Html5Audio, staticFile } from 'remotion';
import { MIX } from './timing';

export const Soundtrack: React.FC = () => <Html5Audio src={staticFile(MIX.file)} volume={1} />;
