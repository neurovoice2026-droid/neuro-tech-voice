/**
 * ig5's soundtrack build hash (docs/ig/ig5/PIPELINE.md §5.2): everything that shapes public/ig/sfx/ig5/mix.wav.
 * scripts/ig5/generate-sfx.mjs skips the build when it matches public/ig/sfx/ig5/mix.json; `check-mix --film=ig5` uses
 * it to prove the master is current (scripts/ig5/films.mjs `hash`).
 *
 * sha256 over 'ig5:' +
 *   · igHash(T, root) (scripts/ig/hash.mjs, imported unchanged: its REEL check /^ig\d$/ accepts 'ig5') — src/ig/ig5/timing.ts,
 *     src/ig/common/*.ts, film 1's constants, the IG sound code scripts/ig/*.mjs (bed.mjs included, the stub ig5 plays),
 *     scripts/audio/{dsp,mix,loudness}.mjs, the evaluated timeline, the CONTENT of every public/ig/voice/<id>.wav ig5
 *     places, the shared public/ig/sfx/lib.json and the content of every cue file (its own lib copies and
 *     ig/sfx/fx-impact-end.wav included)
 *   · the bytes of every top-level .ts of src/ig/ig5/ (its voice data src/ig/ig5/voice.generated.ts, and any module
 *     timing.ts may import: a superset of PIPELINE §5.2, so a picture-only .ts there only costs a rebuild), every
 *     scripts/ig5/*.mjs but the QA-only guard.mjs (films, hash, generate-sfx, and bed.mjs / sounds.mjs once they exist),
 *     and public/ig/sfx/ig5/lib.json (when ig5 has its own library copies)
 *
 * It reads, never writes. Nothing ig5 owns is read by igHash for ig1–ig4 (their file list is fixed by their own REEL,
 * common/, the shared voice TS and scripts/ig/*.mjs), so ig5's files can never restale a delivered reel. Plain Node;
 * the caller passes the evaluated timing `T` (REEL 'ig5').
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { igHash } from '../ig/hash.mjs';

/** scripts/ig5/ files that shape no sound */
const QA_ONLY = new Set(['guard.mjs']);

export function ig5Hash(T, root) {
  if (T.REEL !== 'ig5') throw new Error(`ig5Hash: the timeline is REEL ${JSON.stringify(T.REEL)}, not 'ig5'`);
  const h = createHash('sha256');
  h.update('ig5:');
  h.update(igHash(T, root));
  const ls = (dir, ext) =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith(ext))
          .map((e) => e.name)
          .sort()
          .map((f) => path.join(dir, f))
      : [];
  const files = [
    ...ls(path.join(root, 'src', 'ig', 'ig5'), '.ts'),
    ...ls(path.join(root, 'scripts', 'ig5'), '.mjs').filter((f) => !QA_ONLY.has(path.basename(f))),
  ];
  for (const f of files) {
    h.update(path.relative(root, f).split(path.sep).join('/'));
    h.update(readFileSync(f));
  }
  const lib = path.join(root, 'public', 'ig', 'sfx', 'ig5', 'lib.json');
  h.update(`public/ig/sfx/ig5/lib.json:${existsSync(lib) ? createHash('sha256').update(readFileSync(lib)).digest('hex') : 'none'}`);
  return h.digest('hex').slice(0, 16);
}
