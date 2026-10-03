/**
 * What a Remotion bundle compiled to, without the noise of public/ (scripts/kb/verify-film1.mjs gate 8,
 * scripts/render-master.mjs chunk plans).
 *
 * `remotion bundle` writes the list of EVERY file in public/ into index.html — name, size and
 * Math.floor(mtimeMs) (node_modules/@remotion/bundler/dist/read-recursively.js) — as
 * `window.remotion_staticFiles = [...]`. Both films share public/, so film 1's bundle also lists film 2's
 * public/kb/ files, and that list changes whenever public/kb/sfx/ is rebuilt (new mtimes) even though
 * film 1's compiled code is the same. These helpers parse that list and hash a bundle with chosen entries
 * left out of it; everything else in index.html stays byte for byte.
 *
 * Plain Node, read-only.
 */
import { createHash } from 'node:crypto';
import { closeSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import path from 'node:path';

const MARK = 'window.remotion_staticFiles = ';

/** [start, end) of the JSON array that follows MARK in index.html (a JSON.stringify'd array of flat objects) */
const arraySpan = (html) => {
  const i = html.indexOf(MARK);
  if (i < 0 || html.indexOf(MARK, i + 1) >= 0) return null; // none, or ambiguous
  const s = i + MARK.length;
  if (html[s] !== '[') return null;
  let depth = 0;
  let str = false;
  let esc = false;
  for (let k = s; k < html.length; k++) {
    const c = html[k];
    if (str) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') str = false;
    } else if (c === '"') str = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return [s, k + 1];
    }
  }
  return null;
};

/**
 * index.html with the static-file entries `drop(entry)` selects taken out of its list; every other byte is
 * unchanged (Remotion writes the list with JSON.stringify, so parse → filter → stringify is exact).
 * Returns { html, entries (all), dropped }. Throws when index.html has no (or more than one) list.
 */
export const filterStaticFiles = (html, drop) => {
  const sp = arraySpan(html);
  if (!sp) throw new Error('index.html: no single window.remotion_staticFiles = [...] list (did Remotion change its bundle format?)');
  const entries = JSON.parse(html.slice(sp[0], sp[1]));
  if (!Array.isArray(entries)) throw new Error('index.html: window.remotion_staticFiles is not an array');
  const kept = entries.filter((e) => !drop(e));
  return { html: html.slice(0, sp[0]) + JSON.stringify(kept) + html.slice(sp[1]), entries, dropped: entries.filter((e) => drop(e)) };
};

/** the static-file entries of an index.html */
export const staticFilesOf = (html) => filterStaticFiles(html, () => false).entries;

/** film 2's own public files (public/kb/…): listed by every bundle of the shared public/, never read by film 1 */
export const isFilm2Static = (e) => typeof e?.name === 'string' && e.name.startsWith('kb/');

/** sound files and their stamps (film 1's sfx/ + voice/, film 2's kb/sfx/ + kb/voice/): a --muted picture never reads them */
export const isSoundStatic = (e) => typeof e?.name === 'string' && /^(kb\/)?(sfx|voice)\//.test(e.name);

const sha = (file) => {
  const h = createHash('sha256');
  const buf = Buffer.allocUnsafe(8 << 20);
  const fd = openSync(file, 'r');
  try {
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return h.digest('hex');
};

/**
 * Every file a bundle emitted outside its public/ copy, sorted: [{ rel, sha }]. index.html is hashed with
 * the static-file entries `drop` selects left out (`dropped` lists them).
 */
export const bundleFiles = (dir, { drop = () => false } = {}) => {
  const rels = [];
  const walk = (d) => {
    for (const e of readdirSync(path.join(dir, d), { withFileTypes: true })) {
      const r = d ? `${d}/${e.name}` : e.name;
      if (r === 'public') continue;
      if (e.isDirectory()) walk(r);
      else rels.push(r);
    }
  };
  walk('');
  rels.sort();
  let dropped = [];
  const files = rels.map((rel) => {
    if (rel !== 'index.html') return { rel, sha: sha(path.join(dir, rel)) };
    const f = filterStaticFiles(readFileSync(path.join(dir, rel), 'utf8'), drop);
    dropped = f.dropped;
    return { rel, sha: createHash('sha256').update(f.html).digest('hex') };
  });
  if (!rels.includes('index.html')) throw new Error(`${dir}: no index.html — not a Remotion bundle`);
  return { files, dropped };
};

/** one sha256 over bundleFiles(dir, { drop }) */
export const bundleDigest = (dir, opts) => {
  const h = createHash('sha256');
  for (const f of bundleFiles(dir, opts).files) h.update(`${f.sha}  ${f.rel}\n`);
  return h.digest('hex');
};
