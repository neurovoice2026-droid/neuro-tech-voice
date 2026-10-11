/**
 * The sixth Instagram reel as a film (docs/ig/ig6/PIPELINE.md §0, §2.1): ig6 "One ring" (docs/ig/ig6/SCRIPT.md), the
 * same field set as scripts/ig5/films.mjs. It lives here, NOT in scripts/ig/films.mjs (an input to igHash, the stamp of
 * ig1–ig4) nor in scripts/ig5/films.mjs (an input to ig5Hash, the stamp of ig5): one added entry in either would restale
 * a delivered reel. scripts/registry.mjs merges IG6_FILMS for the shared tools (generate-voice, check-mix,
 * check-render, sfx, render-par, finish, check-zones, check-delivery).
 *
 * ig6 has its OWN voice lines (scripts/ig6/voice-lines-ig6.json) and voice data (src/ig/ig6/voice.generated.ts), its
 * own sound driver (scripts/ig6/generate-sfx.mjs), hash (scripts/ig6/hash.mjs), stamp folder (public/ig/sfx/ig6/) and
 * bundle (out/master/bundle-ig6: bundle-ig and bundle-ig5 are never rebuilt for it). It SHARES the IG entry point
 * (src/ig/index.ts) and the IG voice FOLDER public/ig/voice/ (master() reads <publicDir>/voice/<id>.wav), where it
 * writes only its own ig6-* ids — plus the series sign-off ig1-07, a borrow whose byte copy is onto itself.
 *
 * Paths are relative to trailer/ (POSIX). Plain data, no imports; the guards below throw on load, so a copy-paste slip
 * (an outName or a stamp of ig1–ig5) can never let finish / sfx write over a delivered file.
 */
const reel = {
  frozen: false,
  entry: 'src/ig/index.ts', // the shared IG entry (Root.tsx lists IG6-*)
  timing: 'src/ig/ig6/timing.ts',
  voiceTs: 'src/ig/ig6/voice.generated.ts', // ig6's OWN voice data (not the shared IG file, not ig5's)
  voiceLines: 'scripts/ig6/voice-lines-ig6.json',
  publicDir: 'public/ig', // master() reads <publicDir>/voice/<id>.wav
  voiceDir: 'public/ig/voice', // shared folder; ig6 writes only ig6-* ids (+ the borrow's self-copy, PIPELINE §4.1)
  voiceSrc: 'voice-src/ig6',
  sfxDriver: 'scripts/ig6/generate-sfx.mjs',
  stamp: 'public/ig/sfx/ig6/mix.json',
  hash: ['scripts/ig6/hash.mjs', 'ig6Hash'],
  qa: 'out/audio/ig/ig6',
  comp: 'IG6-Reel-',
  bundle: 'out/master/bundle-ig6', // its own bundle: bundle-ig and bundle-ig5 are never rebuilt for it
  outDir: 'out/ig',
  outName: 'neurotechvoice-ig6-one-ring', // SCRIPT.md slug one-ring
  formats: ['9x16'],
  preview: 'out/ig/ig6-preview.wav',
  cmd: { voice: 'npm run voice:ig6', remaster: 'npm run voice:ig6 -- --remaster', sfx: 'npm run sfx:ig6' },
};

export const IG6_FILMS = { ig6: reel };

/* ── the guards (PIPELINE.md §2.1): ig6 never names a path of ig1–ig5 ── */
{
  const bad = [];
  if (!reel.outName.startsWith('neurotechvoice-ig6-')) bad.push(`outName "${reel.outName}" must start with neurotechvoice-ig6- (finish writes out/ig/deliver/<outName>-*)`);
  if (reel.stamp !== 'public/ig/sfx/ig6/mix.json') bad.push(`stamp "${reel.stamp}" must be public/ig/sfx/ig6/mix.json`);
  if (reel.voiceTs !== 'src/ig/ig6/voice.generated.ts') bad.push(`voiceTs "${reel.voiceTs}" must be src/ig/ig6/voice.generated.ts (src/ig/voice.generated.ts is ig1–ig4's, an igHash input; src/ig/ig5/'s is an ig5Hash input)`);
  if (!reel.voiceLines.startsWith('scripts/ig6/')) bad.push(`voiceLines "${reel.voiceLines}" must be under scripts/ig6/ (scripts/voice-lines-ig.json and scripts/ig5/ are delivered reels' hash inputs)`);
  if (!reel.sfxDriver.startsWith('scripts/ig6/') || !reel.hash[0].startsWith('scripts/ig6/')) bad.push('sfxDriver and hash must be under scripts/ig6/');
  if (reel.qa !== 'out/audio/ig/ig6') bad.push(`qa "${reel.qa}" must be out/audio/ig/ig6`);
  if (reel.bundle !== 'out/master/bundle-ig6') bad.push(`bundle "${reel.bundle}" must be out/master/bundle-ig6 (bundle-ig is ig1–ig4's, bundle-ig5 ig5's)`);
  if (reel.comp !== 'IG6-Reel-') bad.push(`comp "${reel.comp}" must be IG6-Reel-`);
  if (reel.voiceDir !== 'public/ig/voice' || reel.publicDir !== 'public/ig') bad.push('voiceDir / publicDir must be the shared public/ig/voice / public/ig (master() reads <publicDir>/voice/<id>.wav)');
  if (bad.length) throw new Error(`[ig6 films] ${bad.join('; ')}`);
}
