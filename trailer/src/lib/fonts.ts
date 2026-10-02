/**
 * The faces, self-hosted from @fontsource (latin + latin-ext, so the
 * Romanian ă/ț render in the real face).
 *
 *   Instrument Sans (variable, + its true italic as a safety net — never
 *                    synthesised)        EVERY piece of on-screen type (theme.ts TYPE)
 *   Noto Sans JP (variable)              the Japanese greeting (a sans, to match)
 *   Geist Mono (variable)                technical tokens only (3:00 PM, #front-desk)
 *
 * No legacy faces: Cormorant Garamond and Noto Serif JP were dropped once no
 * scene set them (v7); Inter is not loaded (FONT.display / FONT.body are
 * Instrument Sans). The CTA wordmark loads its own Inter Tight
 * (scenes/cta/font) — the site header's wordmark face, not text type.
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
  ['440 40px "Noto Sans JP Variable"', JP_GLYPHS],
  ['500 40px "Geist Mono Variable"', SAMPLE],
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
