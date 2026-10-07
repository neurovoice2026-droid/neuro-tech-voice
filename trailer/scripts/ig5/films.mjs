/**
 * The fifth Instagram reel as a film (docs/ig/ig5/PIPELINE.md §0, §2.1): ig5 "Don't pay $300" (docs/ig/ig5/SCRIPT.md),
 * the same field set as scripts/ig/films.mjs. It lives here, NOT in scripts/ig/films.mjs: that file (and every other
 * top-level scripts/ig/*.mjs, scripts/voice-lines-ig.json, src/ig/voice.generated.ts, src/ig/common/*) is an input to
 * igHash, the stamp of the four delivered reels — one added entry there would restale ig1–ig4. scripts/registry.mjs
 * merges IG5_FILMS for the shared tools (generate-voice, check-mix, check-render, sfx, render-par, finish).
 *
 * ig5 has its OWN voice lines (scripts/ig5/voice-lines-ig5.json) and voice data (src/ig/ig5/voice.generated.ts), its
 * own sound driver (scripts/ig5/generate-sfx.mjs), hash (scripts/ig5/hash.mjs), stamp folder (public/ig/sfx/ig5/) and
 * bundle (out/master/bundle-ig5: out/master/bundle-ig is never rebuilt for it). It SHARES the IG entry point
 * (src/ig/index.ts) and the IG voice FOLDER public/ig/voice/ (master() reads <publicDir>/voice/<id>.wav), where it
 * writes only its own ig5-* ids — plus the series sign-off ig1-07, a borrow whose byte copy is onto itself.
 *
 * Paths are relative to trailer/ (POSIX). Plain data, no imports; the guards below throw on load, so a copy-paste slip
 * (an outName or a stamp of ig1–ig4) can never let finish / sfx write over a delivered file.
 */
const reel = {
  frozen: false,
  entry: 'src/ig/index.ts', // the shared IG entry (Root.tsx lists IG5-*)
  timing: 'src/ig/ig5/timing.ts',
  voiceTs: 'src/ig/ig5/voice.generated.ts', // ig5's OWN voice data (not the shared IG file)
  voiceLines: 'scripts/ig5/voice-lines-ig5.json',
  publicDir: 'public/ig', // master() reads <publicDir>/voice/<id>.wav
  voiceDir: 'public/ig/voice', // shared folder; ig5 writes only ig5-* ids (+ the borrow's self-copy, PIPELINE §4.2)
  voiceSrc: 'voice-src/ig5',
  sfxDriver: 'scripts/ig5/generate-sfx.mjs',
  stamp: 'public/ig/sfx/ig5/mix.json',
  hash: ['scripts/ig5/hash.mjs', 'ig5Hash'],
  qa: 'out/audio/ig/ig5',
  comp: 'IG5-Reel-',
  bundle: 'out/master/bundle-ig5',
  outDir: 'out/ig',
  outName: 'neurotechvoice-ig5-dont-pay-300', // SCRIPT.md "Slug" dont-pay-300
  formats: ['9x16'],
  preview: 'out/ig/ig5-preview.wav',
  cmd: { voice: 'npm run voice:ig5', remaster: 'npm run voice:ig5 -- --remaster', sfx: 'npm run sfx:ig5' },
};

export const IG5_FILMS = { ig5: reel };

/* ── the guards (PIPELINE.md §2.1): ig5 never names a path of ig1–ig4 ── */
{
  const bad = [];
  if (!reel.outName.startsWith('neurotechvoice-ig5-')) bad.push(`outName "${reel.outName}" must start with neurotechvoice-ig5- (finish writes out/ig/deliver/<outName>-*)`);
  if (reel.stamp !== 'public/ig/sfx/ig5/mix.json') bad.push(`stamp "${reel.stamp}" must be public/ig/sfx/ig5/mix.json`);
  if (reel.voiceTs !== 'src/ig/ig5/voice.generated.ts') bad.push(`voiceTs "${reel.voiceTs}" must be src/ig/ig5/voice.generated.ts (src/ig/voice.generated.ts is ig1–ig4's, an igHash input)`);
  if (!reel.voiceLines.startsWith('scripts/ig5/')) bad.push(`voiceLines "${reel.voiceLines}" must be under scripts/ig5/ (scripts/voice-lines-ig.json is an igHash input)`);
  if (!reel.sfxDriver.startsWith('scripts/ig5/') || !reel.hash[0].startsWith('scripts/ig5/')) bad.push('sfxDriver and hash must be under scripts/ig5/');
  if (reel.qa !== 'out/audio/ig/ig5') bad.push(`qa "${reel.qa}" must be out/audio/ig/ig5`);
  if (reel.bundle !== 'out/master/bundle-ig5') bad.push(`bundle "${reel.bundle}" must be out/master/bundle-ig5 (out/master/bundle-ig is ig1–ig4's)`);
  if (reel.comp !== 'IG5-Reel-') bad.push(`comp "${reel.comp}" must be IG5-Reel-`);
  if (bad.length) throw new Error(`[ig5 films] ${bad.join('; ')}`);
}
