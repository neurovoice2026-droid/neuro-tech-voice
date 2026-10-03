#!/usr/bin/env node
/**
 * The soundtrack for one film (docs/kb/PIPELINE.md §4 decision 4, §9): spawns that film's own sound
 * driver from scripts/films.mjs (`sfxDriver`) with --experimental-strip-types, passing the other
 * arguments through (e.g. --force), and exits with its code.
 *
 *   node --experimental-strip-types --no-warnings scripts/sfx.mjs --film=kb [--force]    (npm run sfx:kb[:force])
 *
 * --film is required. Film 1 keeps its own scripts (`npm run sfx`, `sfx:force`, and the remotion.config
 * pre-step), which run scripts/generate-sfx.mjs directly. A frozen film (main) is refused --force here
 * unless --unfreeze is passed too: a forced rebuild rewrites its delivered public/sfx/ (PIPELINE.md H2, H3).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ROOT, abs, filmOf } from './films.mjs';

const argv = process.argv.slice(2);
let film;
try {
  film = filmOf(argv, { required: true });
} catch (e) {
  console.error(`[sfx] ${e.message.replace(/^\[films\] /, '')}`);
  process.exit(2);
}
const pass = argv.filter((a) => !a.startsWith('--film=') && a !== '--unfreeze');
if (film.frozen && pass.includes('--force') && !argv.includes('--unfreeze')) {
  console.error(`[sfx] film "${film.id}" is frozen: --force would rebuild its delivered soundtrack (${film.stamp.replace(/\/[^/]+$/, '/')}). Add --unfreeze if you really mean it.`);
  process.exit(2);
}
const driver = abs(film, 'sfxDriver');
if (!existsSync(driver)) {
  console.error(`[sfx] film "${film.id}": its sound driver ${film.sfxDriver} does not exist yet`);
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', driver, ...pass], { stdio: 'inherit', cwd: ROOT });
if (r.error) throw r.error;
process.exit(r.status ?? 1);
