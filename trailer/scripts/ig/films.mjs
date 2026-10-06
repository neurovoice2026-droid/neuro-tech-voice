/**
 * The four Instagram reels as films (docs/ig/PIPELINE.md §1, §3.1): the additive registry entries, with the
 * same field set as scripts/films.mjs. They live here, not in scripts/films.mjs, because that file is an input
 * to film 2's mix hash (scripts/kb/hash.mjs): one added entry would make `check-mix --film=kb` read "stale".
 * scripts/registry.mjs merges the two registries for the shared tools (generate-voice, check-mix,
 * check-render, render-master, sfx).
 *
 * One reel = one film = one timeline (DURATION, MIX.file, VOICES). The four share one entry point
 * (src/ig/index.ts), one voice set (scripts/voice-lines-ig.json → public/ig/voice + src/ig/voice.generated.ts:
 * voice work always runs with --film=ig1, which writes every line) and one sound driver
 * (scripts/ig/generate-sfx.mjs, which builds every reel, each skipped by its own hash).
 *
 * Paths are relative to trailer/ (POSIX). Plain data: no imports.
 */
const reel = (n, slug) => ({
  frozen: false,
  entry: 'src/ig/index.ts',
  timing: `src/ig/ig${n}/timing.ts`,
  voiceTs: 'src/ig/voice.generated.ts', // shared by the four
  voiceLines: 'scripts/voice-lines-ig.json', // shared by the four
  publicDir: 'public/ig',
  voiceDir: 'public/ig/voice', // master() reads <publicDir>/voice/<id>.wav (H4)
  voiceSrc: 'voice-src/ig',
  sfxDriver: 'scripts/ig/generate-sfx.mjs',
  stamp: `public/ig/sfx/ig${n}/mix.json`,
  hash: ['scripts/ig/hash.mjs', 'igHash'],
  qa: `out/audio/ig/ig${n}`,
  comp: `IG${n}-Reel-`,
  bundle: 'out/master/bundle-ig',
  outDir: 'out/ig',
  outName: `neurotechvoice-ig${n}-${slug}`,
  formats: ['9x16'],
  preview: `out/ig/ig${n}-preview.wav`,
  cmd: { voice: 'npm run voice:ig', remaster: 'npm run voice:ig -- --remaster', sfx: 'npm run sfx:ig' },
});

export const IG_FILMS = {
  ig1: reel(1, 'not-even-ours'),
  ig2: reel(2, 'booked-after-hours'),
  ig3: reel(3, 'twelve-minutes'),
  ig4: reel(4, 'trip-it-up'),
};

export const IG_IDS = Object.keys(IG_FILMS);
