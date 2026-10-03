/**
 * The film registry (docs/kb/PIPELINE.md §9). One trailer project, several films: each film has its own
 * entry point, timeline, voices, sound driver, QA folder, master bundle and output names. The scripts
 * that take `--film=<id>` (generate-voice, sfx, check-mix, check-render, render-master) read their
 * paths from here; with `--film=main` they behave exactly as they did before films existed.
 *
 * Every path is relative to trailer/ (POSIX separators). This file lives outside scripts/audio/, so
 * film 1's mix hash (scripts/audio/hash.mjs) never reads it.
 *
 *   main  trailer #1, delivered and FROZEN: generate-voice refuses to write its live set without
 *         --unfreeze (and never installs into it); sfx.mjs refuses --force for it without --unfreeze.
 *   kb    trailer #2, the knowledge-base film: entry point src/kb/index.ts, composition ids KB-*.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const FILMS = {
  main: {
    frozen: true,
    entry: 'src/index.ts',
    timing: 'src/timing.ts',
    voiceTs: 'src/voice.generated.ts',
    voiceLines: 'scripts/voice-lines.json',
    publicDir: 'public',
    voiceDir: 'public/voice',
    voiceSrc: 'voice-src',
    sfxDriver: 'scripts/generate-sfx.mjs',
    stamp: 'public/sfx/mix.json',
    hash: ['scripts/audio/hash.mjs', 'buildHash'],
    qa: 'out/audio',
    comp: 'Trailer-',
    bundle: 'out/master/bundle',
    outDir: 'out',
    outName: 'neurotechvoice-trailer',
    // beyond the plan's table: the master formats, the preview file and the commands the scripts name
    formats: ['16x9', '9x16'],
    preview: 'out/preview.wav',
    cmd: { voice: 'npm run voice', remaster: 'npm run voice:remaster', sfx: 'npm run sfx' },
  },
  kb: {
    frozen: false,
    entry: 'src/kb/index.ts',
    timing: 'src/kb/timing.ts',
    voiceTs: 'src/kb/voice.generated.ts',
    voiceLines: 'scripts/voice-lines-kb.json',
    publicDir: 'public/kb',
    voiceDir: 'public/kb/voice',
    voiceSrc: 'voice-src/kb',
    sfxDriver: 'scripts/kb/generate-sfx.mjs',
    stamp: 'public/kb/sfx/mix.json',
    hash: ['scripts/kb/hash.mjs', 'kbHash'],
    qa: 'out/audio/kb',
    comp: 'KB-Trailer-',
    bundle: 'out/master/bundle-kb',
    outDir: 'out/kb',
    outName: 'neurotechvoice-knowledge',
    formats: ['16x9', '9x16'],
    preview: 'out/kb/preview.wav',
    cmd: { voice: 'npm run voice:kb', remaster: 'npm run voice:kb -- --remaster', sfx: 'npm run sfx:kb' },
  },
};

export const FILM_IDS = Object.keys(FILMS);

/**
 * The film a command is for: `--film=<id>` → `{ id, ...FILMS[id] }` (frozen). An unknown id, an empty
 * value, a bare `--film` (no `=`) or two different ids throw. A missing flag means `main`, or throws
 * when `required`.
 */
export const filmOf = (argv = process.argv.slice(2), { required = false } = {}) => {
  if (argv.includes('--film')) throw new Error(`[films] write --film=<id> (one of ${FILM_IDS.join(', ')}), not "--film <id>"`);
  const ids = [...new Set(argv.filter((a) => a.startsWith('--film=')).map((a) => a.slice(7)))];
  if (ids.length > 1) throw new Error(`[films] --film given twice with different films: ${ids.join(', ')}`);
  if (!ids.length && required) throw new Error(`[films] --film=<id> is required (one of ${FILM_IDS.join(', ')})`);
  const id = ids[0] ?? 'main';
  if (!Object.hasOwn(FILMS, id)) throw new Error(`[films] unknown film "${id}" (known: ${FILM_IDS.join(', ')})`);
  return Object.freeze({ id, ...FILMS[id] });
};

/** Absolute path of one of a film's registry paths (`abs(film, 'timing')`). */
export const abs = (film, key) => path.join(ROOT, film[key]);

/** A line's `file` entry in the film's voice.generated.ts: relative to public/ (voice/<id>.wav, kb/voice/<id>.wav). */
export const voiceFile = (film, id) => `${path.posix.relative('public', film.voiceDir)}/${id}.wav`;
