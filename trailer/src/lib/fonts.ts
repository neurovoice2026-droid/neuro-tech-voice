/**
 * The faces, self-hosted from @fontsource (latin + latin-ext, so the
 * Romanian ă/ț render in the real face).
 *
 *   Instrument Sans (variable, + its true italic as a safety net — never
 *                    synthesised)        EVERY piece of on-screen type (theme.ts TYPE)
 *   Noto Sans JP (variable)              the Japanese greeting (a sans, to match)
 *   Geist Mono (variable)                technical tokens only (3:00 PM, #front-desk)
 *
 * Legacy faces still loaded so scenes that have not moved to TYPE yet do not
 * fall back to a system face; remove each once no scene sets it by name:
 *   Cormorant Garamond 500 (+ italic), Noto Serif JP 500 — scale/Langs.tsx sets them literally.
 *   (Inter / Inter Tight: no longer loaded — FONT.display / FONT.body are Instrument Sans now.)
 *
 * The CSS only declares the faces; the browser downloads a face the first
 * time something uses it. Remotion would screenshot before that happens, so
 * `waitForFonts` asks for every face (with the exact glyphs we need — Noto
 * Sans JP is split into ~120 unicode-range files) inside a delayRender before
 * the first frame.
 */
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/instrument-sans/wght-italic.css';
import '@fontsource-variable/noto-sans-jp/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/noto-serif-jp/500.css';
import { continueRender, delayRender } from 'remotion';

const SAMPLE =
  'AaBbÇçĂăÂâÎîȘșȚțÉéÈèÜüßÑñ¿¡0123456789:·—→%/#@ Sunt Ava asistentul inteligență artificială';

/** Every CJK glyph the film sets (the Japanese greeting, its card, the specimen). */
export const JP_GLYPHS = 'AIアシスタントのAvaと申します。お電話ありがとうございます日本語';

const FACES: Array<[string, string]> = [
  ['440 40px "Instrument Sans Variable"', SAMPLE],
  ['460 40px "Instrument Sans Variable"', SAMPLE],
  ['540 40px "Instrument Sans Variable"', SAMPLE],
  ['italic 460 40px "Instrument Sans Variable"', SAMPLE],
  ['430 40px "Noto Sans JP Variable"', JP_GLYPHS],
  ['500 40px "Geist Mono Variable"', SAMPLE],
  // legacy (see above)
  ['500 40px "Cormorant Garamond"', SAMPLE],
  ['italic 500 40px "Cormorant Garamond"', SAMPLE],
  ['500 40px "Noto Serif JP"', JP_GLYPHS],
];

let pending: Promise<void> | null = null;

export function waitForFonts(): void {
  if (typeof document === 'undefined') return;
  if (!pending) {
    pending = Promise.all(FACES.map(([font, text]) => document.fonts.load(font, text)))
      .then(() => document.fonts.ready)
      .then(() => undefined);
  }
  const handle = delayRender('Loading brand fonts');
  pending.then(
    () => continueRender(handle),
    () => continueRender(handle),
  );
}
