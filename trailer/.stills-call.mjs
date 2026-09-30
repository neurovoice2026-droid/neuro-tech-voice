// usage: node stills.mjs <entry> <compPrefix> <outDir> <orient: 16x9|9x16|both> <frames comma list | a-b:step>
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
const [entry, prefix, outDir, orient, spec] = process.argv.slice(2);
const root = '/home/user/neuro-tech-voice/trailer';
let frames = [];
for (const part of spec.split(',')) {
  const m = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
  if (m) { for (let f = +m[1]; f <= +m[2]; f += +(m[3] ?? 1)) frames.push(f); } else frames.push(+part);
}
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, entry), rootDir: root, publicDir: path.join(root, 'public') });
const browser = await openBrowser('chrome', { browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', chromiumOptions: { gl: 'angle' } });
const orients = orient === 'both' ? ['16x9', '9x16'] : [orient];
for (const o of orients) {
  const id = `${prefix}-${o}`;
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions: { gl: 'angle' } });
  for (const f of frames) {
    const t0 = Date.now();
    await renderStill({ composition, serveUrl, output: path.join(outDir, `${String(f).padStart(4, '0')}-${o}.png`), frame: f, puppeteerInstance: browser, chromiumOptions: { gl: 'angle' }, overwrite: true });
    console.log(o, f, `${Date.now() - t0}ms`);
  }
}
await browser.close({ silent: true });
