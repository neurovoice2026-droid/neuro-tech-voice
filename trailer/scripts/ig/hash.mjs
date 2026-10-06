/**
 * The Instagram reels' soundtrack build hash (docs/ig/PIPELINE.md §6.4): everything that shapes one reel's
 * public/ig/sfx/<reel>/mix.wav. scripts/ig/generate-sfx.mjs skips a reel when it matches the reel's stamp;
 * `check-mix --film=ig<n>` uses it to prove the master is current (scripts/ig/films.mjs `hash`).
 *
 * sha256 over
 *   · the bytes of src/ig/<reel>/timing.ts, src/ig/common/*.ts (with cues.ts, the reels' verbatim fork of src/lib/'s
 *     cue machinery — generate-sfx.mjs proves it identical), src/ig/voice.generated.ts, and film 1's src/timing.ts +
 *     src/voice.generated.ts (the reels' timelines import film 1's constants)
 *   · the sound code: scripts/ig/*.mjs (but the QA- and picture-only render-par, finish, check-delivery, check-zones and
 *     verify-film2), scripts/ig/films.mjs, scripts/audio/{dsp,mix,loudness}.mjs
 *   · the evaluated timeline: {CUES, VOICES, SCENES, DURATION, BED, MIX, DUCK} (+ MUSIC and VOICE_RIDES, which the bed
 *     and the mixer read)
 *   · the CONTENT (sha256) of every voice file public/ig/voice/<id>.wav the reel places, public/ig/sfx/lib.json, and the
 *     content of every library file its CUES reference (public/ig/sfx/lib/…)
 *
 * It never reads scripts/films.mjs, scripts/registry.mjs, scripts/kb/** or anything of film 2's: a reel's mix is
 * independent of the films' registry and of film 2's sound code. Read-only. Plain Node: the caller passes the evaluated
 * timing `T` (it must carry `REEL`).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** scripts/ig/ files that shape no sound (QA and picture delivery): editing them must not invalidate a mix */
const QA_ONLY = new Set(['render-par.mjs', 'finish.mjs', 'check-delivery.mjs', 'check-zones.mjs', 'verify-film2.mjs']);

const fileSha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

export function igHash(T, root) {
  if (!/^ig\d$/.test(T.REEL ?? '')) throw new Error(`igHash: the timeline has no REEL id (got ${JSON.stringify(T.REEL)})`);
  const h = createHash('sha256');
  const src = path.join(root, 'src');
  const ig = path.join(src, 'ig');
  const scriptsIg = path.join(root, 'scripts', 'ig');
  const ls = (dir, ext) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(ext))
      .map((e) => e.name)
      .sort()
      .map((f) => path.join(dir, f));
  const files = [
    path.join(ig, T.REEL, 'timing.ts'),
    ...ls(path.join(ig, 'common'), '.ts'),
    path.join(ig, 'voice.generated.ts'),
    path.join(src, 'timing.ts'),
    path.join(src, 'voice.generated.ts'),
    ...ls(scriptsIg, '.mjs').filter((f) => !QA_ONLY.has(path.basename(f))),
    ...['dsp.mjs', 'mix.mjs', 'loudness.mjs'].map((f) => path.join(root, 'scripts', 'audio', f)),
  ];
  for (const f of files) {
    h.update(path.relative(root, f));
    h.update(readFileSync(f));
  }
  h.update(JSON.stringify({ C: T.CUES, V: T.VOICES, S: T.SCENES, D: T.DURATION, B: T.BED, M: T.MIX, K: T.DUCK, U: T.MUSIC, R: T.VOICE_RIDES }));
  for (const id of [...new Set(T.VOICES.map((v) => v.id))].sort()) {
    const f = path.join(root, 'public', 'ig', 'voice', `${id}.wav`);
    h.update(`${id}:${existsSync(f) ? fileSha(f) : 'missing'}`);
  }
  const lib = path.join(root, 'public', 'ig', 'sfx', 'lib.json');
  h.update(`public/ig/sfx/lib.json:${existsSync(lib) ? fileSha(lib) : 'none'}`);
  for (const f of [...new Set(T.CUES.map((c) => c.file))].sort()) {
    const p = path.join(root, 'public', f);
    h.update(`${f}:${existsSync(p) ? fileSha(p) : 'missing'}`);
  }
  return h.digest('hex').slice(0, 16);
}
