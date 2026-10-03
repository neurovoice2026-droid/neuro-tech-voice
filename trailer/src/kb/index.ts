/**
 * Film 2's entry point (docs/kb/PIPELINE.md decision 2). Pass it on the command line — it overrides
 * Config.setEntryPoint, so film 1's bundle (src/index.ts) never compiles film 2's code:
 *   npx remotion studio src/kb/index.ts            (npm run studio:kb)
 *   npx remotion render src/kb/index.ts KB-Trailer-16x9 out/kb/…
 */
import { registerRoot } from 'remotion';
import { KbRoot } from './Root';

registerRoot(KbRoot);
