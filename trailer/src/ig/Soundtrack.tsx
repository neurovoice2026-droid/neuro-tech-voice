/**
 * A reel's soundtrack: ONE master file, frame-locked from frame 0 — public/ig/sfx/<reel>/mix.wav (MIX.file), built by
 * scripts/ig/generate-sfx.mjs (npm run sfx:ig).
 */
import React from 'react';
import { Html5Audio, staticFile } from 'remotion';

export const Soundtrack: React.FC<{ file: string }> = ({ file }) => <Html5Audio src={staticFile(file)} volume={1} />;
