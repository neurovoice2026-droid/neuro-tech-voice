/**
 * The Instagram reels' entry point (docs/ig/PIPELINE.md §1). Always passed on the command line — it overrides
 * Config.setEntryPoint, so film 1's and film 2's bundles never compile IG code:
 *   NTV_SKIP_SFX=1 npx remotion studio src/ig/index.ts          (npm run studio:ig, after npm run sfx:ig)
 *   NTV_SKIP_SFX=1 npx remotion still src/ig/index.ts IG1-Preview-9x16 out/ig/… --frame=N
 * Every IG Remotion command runs with NTV_SKIP_SFX=1 after an explicit `npm run sfx:ig` (remotion.config.ts's sound
 * pre-step knows only films main and kb).
 */
import { registerRoot } from 'remotion';
import { IgRoot } from './Root';

registerRoot(IgRoot);
