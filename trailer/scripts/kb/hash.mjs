/**
 * Film 2's soundtrack build hash (docs/kb/PIPELINE.md §5): everything that shapes public/kb/sfx/mix.wav.
 * scripts/kb/generate-sfx.mjs skips work when it matches; `check-mix --film=kb` uses it to prove the
 * master is current (scripts/films.mjs FILMS.kb.hash).
 *
 * sha256 over
 *   · the bytes of src/kb/timing.ts, src/kb/voice.generated.ts, src/lib/cuesheet.ts, and film 1's
 *     src/timing.ts + src/voice.generated.ts (film 2's timeline imports both)
 *   · the sound code: scripts/kb/*.mjs (but check-port.mjs, verify-film1.mjs, render-par.mjs and
 *     finish-master.mjs, which shape no sound), scripts/films.mjs, scripts/audio/{dsp,mix,loudness}.mjs
 *   · the evaluated timeline: {CUES, VOICES, SCENES, DURATION, BED, MIX, DUCK, MUSIC}
 *   · the CONTENT (sha256) of every voice file public/kb/voice/<id>.wav — not its mtime, so a fresh
 *     checkout does not force a rebuild
 *   · public/kb/sfx/lib.json (film 2's extras, when it has any), film 1's public/sfx/lib.json, and the
 *     content of every library file CUES references (film 1's sfx/… read-only, film 2's kb/sfx/…)
 *
 * Read-only: it never writes. Plain Node (no TypeScript): the caller passes the evaluated timing `T`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** scripts/kb/ files that shape no sound (QA and picture delivery): editing them must not invalidate the mix */
const QA_ONLY = new Set(['check-port.mjs', 'verify-film1.mjs', 'render-par.mjs', 'finish-master.mjs']);

const fileSha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

export function kbHash(T, root) {
  const h = createHash('sha256');
  const src = path.join(root, 'src');
  const scripts = path.join(root, 'scripts');
  const kb = path.join(scripts, 'kb');
  const files = [
    path.join(src, 'kb', 'timing.ts'),
    path.join(src, 'kb', 'voice.generated.ts'),
    path.join(src, 'lib', 'cuesheet.ts'),
    path.join(src, 'timing.ts'),
    path.join(src, 'voice.generated.ts'),
    ...readdirSync(kb, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs') && !QA_ONLY.has(e.name))
      .map((e) => e.name)
      .sort()
      .map((f) => path.join(kb, f)),
    path.join(scripts, 'films.mjs'),
    ...['dsp.mjs', 'mix.mjs', 'loudness.mjs'].map((f) => path.join(scripts, 'audio', f)),
  ];
  for (const f of files) {
    h.update(path.relative(root, f));
    h.update(readFileSync(f));
  }
  h.update(JSON.stringify({ C: T.CUES, V: T.VOICES, S: T.SCENES, D: T.DURATION, B: T.BED, M: T.MIX, K: T.DUCK, U: T.MUSIC }));
  for (const id of [...new Set(T.VOICES.map((v) => v.id))].sort()) {
    const f = path.join(root, 'public', 'kb', 'voice', `${id}.wav`);
    h.update(`${id}:${existsSync(f) ? fileSha(f) : 'missing'}`);
  }
  for (const f of [path.join(root, 'public', 'kb', 'sfx', 'lib.json'), path.join(root, 'public', 'sfx', 'lib.json')]) {
    h.update(`${path.relative(root, f)}:${existsSync(f) ? fileSha(f) : 'none'}`);
  }
  for (const f of [...new Set(T.CUES.map((c) => c.file))].sort()) {
    const p = path.join(root, 'public', f);
    h.update(`${f}:${existsSync(p) ? fileSha(p) : 'missing'}`);
  }
  return h.digest('hex').slice(0, 16);
}
