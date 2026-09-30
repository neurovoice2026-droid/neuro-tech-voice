/**
 * The site's faces, self-hosted from @fontsource (latin + latin-ext, so the
 * Romanian ă/ț render in the real face; Noto Serif JP for the Japanese line).
 *
 * The CSS only declares the faces; the browser downloads a face the first
 * time something uses it. Remotion would screenshot before that happens, so
 * `waitForFonts` asks for every face (with the exact glyphs we need) inside a
 * delayRender before the first frame.
 */
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/noto-serif-jp/500.css';
import { continueRender, delayRender } from 'remotion';

const SAMPLE =
  'AaBbÇçĂăÂâÎîȘșȚțÉéÈèÜüßÑñ¿¡0123456789:·—→%/ Sunt Ava asistentul inteligență artificială';

const FACES: Array<[string, string]> = [
  ['500 40px "Inter Tight Variable"', SAMPLE],
  ['400 40px "Inter Tight Variable"', SAMPLE],
  ['440 40px "Instrument Sans Variable"', SAMPLE],
  ['520 40px "Instrument Sans Variable"', SAMPLE],
  ['500 40px "Inter Variable"', SAMPLE],
  ['600 40px "Inter Variable"', SAMPLE],
  ['500 40px "Geist Mono Variable"', SAMPLE],
  ['500 40px "Cormorant Garamond"', SAMPLE],
  ['italic 500 40px "Cormorant Garamond"', SAMPLE],
  ['500 40px "Noto Serif JP"', 'Avaと申します。お電話ありがとうございますAIアシスタント'],
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
