/**
 * The soundtrack's build hash: everything that shapes public/sfx/mix.wav — the
 * timeline (timing.ts as evaluated), the voice data and audio, and the sound
 * code itself. generate-sfx.mjs skips work when it matches; check-mix.mjs uses
 * it to prove the master is current.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export function buildHash(T, root) {
  const h = createHash('sha256');
  const scripts = path.join(root, 'scripts');
  const files = [
    path.join(root, 'src', 'timing.ts'),
    path.join(root, 'src', 'voice.generated.ts'),
    path.join(scripts, 'generate-sfx.mjs'),
    ...readdirSync(path.join(scripts, 'audio')).sort().map((f) => path.join(scripts, 'audio', f)),
  ];
  for (const f of files) h.update(readFileSync(f));
  h.update(JSON.stringify({ C: T.CUES, V: T.VOICES, S: T.SCENES, D: T.DURATION }));
  for (const v of T.VOICES) {
    const s = statSync(path.join(root, 'public', 'voice', `${v.id}.wav`));
    h.update(`${v.id}:${s.size}:${s.mtimeMs}`);
  }
  return h.digest('hex').slice(0, 16);
}
