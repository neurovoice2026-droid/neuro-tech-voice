/**
 * Remotion CLI config — loaded by `npx remotion studio|render|still`.
 *
 * 1. Synthesises every sound effect + the ambient bed into public/sfx
 *    BEFORE anything renders (scripts/generate-sfx.mjs, pure Node, ~1 s,
 *    deterministic). So a bare `npx remotion render …` is always in sync.
 * 2. Output defaults: H.264, yuv420p, high quality.
 * 3. Uses a locally installed Chromium if REMOTION_BROWSER (or the
 *    Playwright headless shell) is present; otherwise Remotion downloads its own.
 */
import { Config } from '@remotion/cli/config';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
if (!process.env.NTV_SKIP_SFX) {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'generate-sfx.mjs')], {
    stdio: 'inherit',
    cwd: root,
  });
  // children (e.g. the renderer) inherit this — generate once per command
  process.env.NTV_SKIP_SFX = '1';
}

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);

const browser =
  process.env.REMOTION_BROWSER ??
  ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p));
if (browser) Config.setBrowserExecutable(browser);
