/**
 * The merged film registry (docs/ig/PIPELINE.md §3.2): scripts/films.mjs (film 1 "main", film 2 "kb") plus the
 * Instagram reels of scripts/ig/films.mjs (ig1…ig4) and the fifth reel of scripts/ig5/films.mjs (ig5,
 * docs/ig/ig5/PIPELINE.md §0, §3.2 edit 1), with the same API. The shared tools (generate-voice, check-mix,
 * check-render, render-master, sfx, scripts/ig/{render-par,finish,check-zones,check-delivery}) import from here,
 * so `--film=ig<n>` resolves while scripts/films.mjs — an input to film 2's mix hash — and scripts/ig/films.mjs —
 * an input to ig1–ig4's igHash — stay byte-identical. `main`, `kb` and ig1–ig4 resolve to exactly the objects
 * they always did.
 *
 * This file is in no mix hash and in no frozen set.
 */
import { FILMS as BASE, ROOT, abs, need, voiceFile } from './films.mjs';
import { IG_FILMS } from './ig/films.mjs';
import { IG5_FILMS } from './ig5/films.mjs';

/* every film id in exactly one registry (a duplicate would silently shadow a delivered film's entry) */
{
  const REGS = [['scripts/films.mjs', BASE], ['scripts/ig/films.mjs', IG_FILMS], ['scripts/ig5/films.mjs', IG5_FILMS]];
  const seen = new Map();
  for (const [file, reg] of REGS)
    for (const id of Object.keys(reg)) {
      if (seen.has(id)) throw new Error(`[registry] film id "${id}" is in both ${seen.get(id)} and ${file}`);
      seen.set(id, file);
    }
}

export const FILMS = { ...BASE, ...IG_FILMS, ...IG5_FILMS };

/* every outName unique: finish writes <outDir>/deliver/<outName>-*, so a shared name would overwrite a delivered file */
{
  const by = new Map();
  for (const [id, f] of Object.entries(FILMS)) {
    if (f.outName === undefined) continue;
    if (by.has(f.outName)) throw new Error(`[registry] films "${by.get(f.outName)}" and "${id}" share the outName ${f.outName}`);
    by.set(f.outName, id);
  }
}
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
