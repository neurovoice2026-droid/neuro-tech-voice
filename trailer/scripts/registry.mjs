/**
 * The merged film registry (docs/ig/PIPELINE.md §3.2): scripts/films.mjs (film 1 "main", film 2 "kb") plus the
 * Instagram reels of scripts/ig/films.mjs (ig1…ig4), with the same API. The shared tools (generate-voice,
 * check-mix, check-render, render-master, sfx) import from here, so `--film=ig<n>` resolves while
 * scripts/films.mjs — an input to film 2's mix hash — stays byte-identical. `main` and `kb` resolve to
 * exactly the objects they always did.
 *
 * This file is in no mix hash and in no frozen set.
 */
import { FILMS as BASE, ROOT, abs, need, voiceFile } from './films.mjs';
import { IG_FILMS } from './ig/films.mjs';

for (const id of Object.keys(IG_FILMS)) if (Object.hasOwn(BASE, id)) throw new Error(`[registry] film id "${id}" is in both scripts/films.mjs and scripts/ig/films.mjs`);

export const FILMS = { ...BASE, ...IG_FILMS };
export const FILM_IDS = Object.keys(FILMS);
export { ROOT, abs, need, voiceFile };

/**
 * The film a command is for: `--film=<id>` → `{ id, ...FILMS[id] }` (frozen). An unknown id, an empty
 * value, a bare `--film` (no `=`) or two different ids throw. A missing flag means `main`, or throws
 * when `required`. (scripts/films.mjs's filmOf, verbatim, over the merged FILMS.)
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
