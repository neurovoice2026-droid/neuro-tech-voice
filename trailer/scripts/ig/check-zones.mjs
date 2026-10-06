#!/usr/bin/env node
/**
 * The reels' safe-zone gate (docs/ig/PIPELINE.md §7, §9 gate 5).
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/check-zones.mjs --film=ig<n> | --all
 *        [--bundle=<dir>] [--keep] [--selftest]                                            (npm run check:zones:ig)
 *
 *   · renders IG<n>-Zones-9x16 stills (the zone overlay + the guard: components/ZoneGuard.tsx) at f0, at every screen
 *     onset + 8 f (timing.ts SCREENS: each span's first word), at every frame the reel lists in an optional
 *     ZONE_FRAMES export (card / chip landings + 8 f), at the shared end card's four moments (END_CARD: the comment
 *     field landed, AGENT typed, the wordmark, the URL typed), and the cover (IG<n>-Cover-9x16 with {"zones": true}, checked
 *     against the cover box x 86–930, y 260–1500)
 *   · FAILS on any `[ig-zones] VIOLATION` line the page logs (a text rect on the header / caption bands, the right
 *     rail, the side margins, or a cover word outside its box)
 *   · writes the stills and their 3:4 grid crops (y 240–1680) to out/ig/qa/<reel>/zones/
 *   · --selftest: also renders f0 with {"zoneProbe": true} (one rect deliberately on the rail) and fails unless that
 *     violation IS caught — proof the logger reaches this script
 *
 * The bundle: --bundle=<dir>, else a fresh `remotion bundle src/ig/index.ts` in out/ig/qa/.bundle-zones (deleted unless
 * --keep). Renders through @remotion/renderer's Node API in ONE browser (the browser's console reaches onBrowserLog),
 * with remotion.config.ts's browser and GL choices. Run `npm run sfx:ig` first (the bundle lists public/).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { IG_FILMS, IG_IDS } from './films.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ids = args.includes('--all') ? IG_IDS : [...new Set(args.filter((a) => a.startsWith('--film=')).map((a) => a.slice(7)))];
if (!ids.length) {
  console.error('usage: check-zones.mjs --film=ig<n> | --all [--bundle=<dir>] [--keep] [--selftest]');
  process.exit(2);
}
for (const id of ids) if (!IG_IDS.includes(id)) throw new Error(`unknown reel "${id}" (known: ${IG_IDS.join(', ')})`);
const keep = args.includes('--keep');
const selftest = args.includes('--selftest');
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
const ff = (a) => execFileSync(path.join(BIN, 'ffmpeg'), a, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, cwd: ROOT, maxBuffer: 1 << 26 });
const log = (m) => console.log(`[zones ${new Date().toISOString().slice(11, 19)}] ${m}`);

/* ── the bundle ── */
const ownBundle = !opt('bundle');
const bundle = opt('bundle') ? path.resolve(opt('bundle')) : path.join(ROOT, 'out', 'ig', 'qa', '.bundle-zones');
if (ownBundle) {
  rmSync(bundle, { recursive: true, force: true });
  log('bundling src/ig/index.ts');
  const r = spawnSync('npx', ['remotion', 'bundle', 'src/ig/index.ts', '--out-dir', bundle, '--log=error'], { cwd: ROOT, env: { ...process.env, NTV_SKIP_SFX: '1' }, stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('remotion bundle failed');
}
if (!existsSync(path.join(bundle, 'index.html'))) throw new Error(`${bundle}: not a Remotion bundle`);

/* ── the browser (remotion.config.ts: a local headless shell when present, ANGLE GL) ── */
const browserExecutable = process.env.REMOTION_BROWSER ?? ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p)) ?? null;
const chromiumOptions = { gl: 'angle' };
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });

let violations = 0;
let failedRenders = 0;
const still = async ({ id, comp, frame, out, inputProps = {}, expectViolation = false }) => {
  const lines = [];
  const composition = await selectComposition({ serveUrl: bundle, id: comp, inputProps, puppeteerInstance: browser, browserExecutable, chromiumOptions });
  try {
    await renderStill({
      serveUrl: bundle,
      composition,
      output: out,
      frame,
      inputProps,
      imageFormat: 'png',
      scale: 1,
      puppeteerInstance: browser,
      browserExecutable,
      chromiumOptions,
      overwrite: true,
      onBrowserLog: (l) => {
        if (/\[ig-zones\] VIOLATION/.test(l.text)) lines.push(l.text);
      },
    });
  } catch (e) {
    failedRenders++;
    console.log(`FAIL  ${id} ${comp} f${frame}: render failed — ${String(e.message ?? e).split('\n')[0]}`);
    return lines;
  }
  const uniq = [...new Set(lines)];
  if (expectViolation) {
    if (!uniq.length) {
      failedRenders++;
      console.log(`FAIL  ${id} selftest: the probe's violation was NOT caught — the guard does not reach this script`);
    } else console.log(`ok    ${id} selftest: the probe's violation was caught (${uniq[0].replace(/^.*VIOLATION /, '')})`);
    return uniq;
  }
  for (const l of uniq) console.log(`FAIL  ${l.slice(l.indexOf('[ig-zones]'))}`);
  violations += uniq.length;
  return uniq;
};

try {
  for (const id of ids) {
    const film = { id, ...IG_FILMS[id] };
    const T = await import(path.join(ROOT, film.timing));
    const n = id.slice(2);
    const dir = path.join(ROOT, film.outDir, 'qa', id, 'zones');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const frames = new Set([0]);
    for (const v of T.VOICES) for (const [a] of T.SCREENS[v.id]?.spans ?? []) frames.add(Math.round(v.at + T.vWord(v.id, a)) + 8);
    for (const f of T.ZONE_FRAMES ?? []) frames.add(Math.round(f));
    // the shared end card (components/End.tsx endZoneFrames): the field landed, AGENT typed, the wordmark, the URL in
    if (T.END_CARD) for (const f of [T.END_CARD.field + 10, T.END_CARD.agent + 20, T.END_CARD.impact + 16, T.END_CARD.url[2] + 8]) frames.add(Math.round(f));
    const list = [...frames].filter((f) => f >= 0 && f < T.DURATION).sort((a, b) => a - b);
    log(`${id}: ${list.length} zone stills (${list.join(', ')}) + the cover`);
    const t0 = Date.now();
    for (const f of list) {
      const out = path.join(dir, `f${String(f).padStart(3, '0')}.png`);
      await still({ id, comp: `IG${n}-Zones-9x16`, frame: f, out });
      ff(['-hide_banner', '-v', 'error', '-y', '-i', out, '-vf', 'crop=1080:1440:0:240', out.replace(/\.png$/, '-34.png')]);
    }
    const cover = path.join(dir, 'cover.png');
    await still({ id, comp: `IG${n}-Cover-9x16`, frame: 0, out: cover, inputProps: { zones: true } });
    ff(['-hide_banner', '-v', 'error', '-y', '-i', cover, '-vf', 'crop=1080:1440:0:240', path.join(dir, 'cover-34.png')]);
    if (selftest) await still({ id, comp: `IG${n}-Zones-9x16`, frame: 0, out: path.join(dir, 'selftest.png'), inputProps: { zoneProbe: true }, expectViolation: true });
    log(`${id}: done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(ROOT, dir)}/`);
  }
} finally {
  await browser.close({ silent: true });
  if (ownBundle && !keep) rmSync(bundle, { recursive: true, force: true });
}
const bad = violations + failedRenders;
console.log(bad ? `FAIL: ${violations} violation(s), ${failedRenders} failed render(s)` : `PASS: no zone violation in ${ids.join(', ')}`);
process.exit(bad ? 1 : 0);
