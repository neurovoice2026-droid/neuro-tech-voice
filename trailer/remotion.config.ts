/**
 * Remotion CLI config — loaded by `npx remotion studio|render|still`.
 *
 * 1. Builds the soundtrack BEFORE anything renders (scripts/generate-sfx.mjs:
 *    pure Node, deterministic; it reads the timeline from src/timing.ts, so
 *    Node ≥ 22.6 for --experimental-strip-types): every effect, the music bed,
 *    and the master public/sfx/mix.wav (voices + bed + cues, ducked, roomed,
 *    loudness-normalised, true-peak limited) that src/Soundtrack.tsx plays.
 *    Skipped in ~0.2 s when nothing it reads has changed; ~10–25 s otherwise.
 *    So a bare `npx remotion render …` is always in sync. (Voices are
 *    pre-generated and committed: public/voice, via `npm run voice`.)
 *    FILMS (scripts/films.mjs): the pre-step runs the driver of the film the
 *    command is for — film 2 ("kb") when the entry point argument is
 *    src/kb/index.ts; film 1 ("main", the call above, unchanged) when it is
 *    src/index.ts or when there is none (Remotion then uses setEntryPoint
 *    below); NTV_FILM=<id> only decides for a prebuilt bundle / serve URL.
 *    A film 1 command never runs film 2's code, and NTV_FILM is not read at
 *    all once NTV_SKIP_SFX is set (child renders, render-master's chunks).
 * 2. Output defaults: H.264 High, BT.709 limited range (tagged bt709
 *    primaries / transfer / matrix, tv range) — what every platform and player
 *    assumes, so the 9–21-level midnight room and the four lights' hues survive
 *    upload — x264 "slow" at CRF 14; AAC 320k.
 * 2b. Picture/sound lock: the AAC track starts on frame 0 to the sample (see
 *    fdkPrimingFix below).
 * 3. Uses a locally installed Chromium if REMOTION_BROWSER (or the
 *    Playwright headless shell) is present; otherwise Remotion downloads its own.
 */
import { Config } from '@remotion/cli/config';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SFX_DRIVER: Record<string, string> = { main: 'generate-sfx.mjs', kb: path.join('kb', 'generate-sfx.mjs') };
if (!process.env.NTV_SKIP_SFX) {
  // which film's soundtrack (resolved only here: with NTV_SKIP_SFX set — every child render, every
  // render-master chunk — NTV_FILM is never read, so a stray value cannot break a film 1 command).
  // The entry point on the command line decides; NTV_FILM only where it cannot: a prebuilt bundle / serve URL.
  // With no entry point Remotion uses Config.setEntryPoint below (src/index.ts): film 1, whatever NTV_FILM says.
  const pos = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const entryArg = pos[1]; // `remotion <command> [entry-or-bundle] …` (entry-point.js: the first argument, if it exists)
  const isFile = (a?: string) => !!a && existsSync(path.resolve(root, a));
  const argFilm = process.argv.some((a) => /(^|[\\/])src[\\/]kb[\\/]index\.tsx?$/.test(a))
    ? 'kb'
    : process.argv.some((a) => /(^|[\\/])src[\\/]index\.tsx?$/.test(a)) || !(isFile(entryArg) || /^https?:\/\//.test(entryArg ?? ''))
      ? 'main'
      : undefined;
  const envFilm = process.env.NTV_FILM?.trim() || undefined;
  if (envFilm && argFilm && envFilm !== argFilm)
    console.warn(`[remotion.config] NTV_FILM=${envFilm} ignored: this command is film "${argFilm}" (its entry point)`);
  const film = argFilm ?? envFilm ?? 'main';
  if (!Object.hasOwn(SFX_DRIVER, film)) throw new Error(`[remotion.config] unknown NTV_FILM=${film} (known: ${Object.keys(SFX_DRIVER).join(', ')})`);
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(root, 'scripts', SFX_DRIVER[film])], {
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
// Remotion's v4 default ('default' = BT.601 matrix) leaves the JPEG frames'
// full-range BT.601 through untouched: the MP4 came out yuvj420p, pc range,
// bt470bg, unknown primaries/transfer. 'bt709' runs zscale to BT.709 limited
// range in the encoder and tags all four colour properties.
Config.setColorSpace('bt709');
// The HEVC masters (scripts/render-master.mjs sets NTV_HEVC): Remotion refuses an x264 preset with h265.
if (!process.env.NTV_HEVC) Config.setX264Preset('slow');
Config.setCrf(14);
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');

/**
 * AAC priming. Remotion encodes the audio with libfdk_aac to a raw ADTS file,
 * then stream-copies it into the MP4. ADTS cannot carry the encoder delay, so
 * the MP4 got no edit list and every player played fdk's 2048 priming samples
 * (42.7 ms at 48 kHz, ~1.3 frames) before the mix: every hit trailed its frame.
 * Shifting that input back by exactly its priming makes FFmpeg's MP4 muxer
 * write the edit list (media_time = 2048) that tells players to skip it, so
 * the decoded track starts on frame 0 to the sample. Lossless (still a copy);
 * applies to every render, full film or frame range. AAC-LC only.
 */
const FDK_LC_PRIMING = 2048;
const ADTS_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const adtsLcRate = (file: string): number | null => {
  try {
    const fd = openSync(file, 'r');
    const h = Buffer.alloc(7);
    readSync(fd, h, 0, 7, 0);
    closeSync(fd);
    if (h[0] !== 0xff || (h[1] & 0xf0) !== 0xf0) return null; // not ADTS
    if (h[2] >> 6 !== 1) return null; // profile field 1 = AAC-LC
    return ADTS_RATES[(h[2] >> 2) & 0x0f] ?? null;
  } catch {
    return null;
  }
};
const fdkPrimingFix = (args: string[]): string[] => {
  const i = args.findIndex(
    (a, k) => a === '-i' && /\.aac$/i.test(args[k + 1] ?? '') && args[k + 2] === '-c:a' && args[k + 3] === 'copy',
  );
  if (i < 0) return args;
  const rate = adtsLcRate(args[i + 1]);
  if (!rate) {
    console.warn('[remotion.config] audio is not AAC-LC ADTS; priming not compensated');
    return args;
  }
  return [...args.slice(0, i), '-itsoffset', (-FDK_LC_PRIMING / rate).toFixed(7), ...args.slice(i)];
};
/**
 * HEVC masters: x265's auto-variance AQ biased to dark blocks (aq-mode=3), so the 9–21-level
 * midnight room and the halo's long falloffs get the bits that keep them free of banding.
 */
const x265Tune = (args: string[]): string[] => {
  const i = args.indexOf('libx265');
  return i < 0 || args.includes('-x265-params') ? args : [...args.slice(0, i + 1), '-x265-params', 'aq-mode=3:log-level=error', ...args.slice(i + 1)];
};
Config.overrideFfmpegCommand(({ type, args }) => x265Tune(type === 'stitcher' ? fdkPrimingFix(args) : args));
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);

const browser =
  process.env.REMOTION_BROWSER ??
  ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p));
if (browser) Config.setBrowserExecutable(browser);
