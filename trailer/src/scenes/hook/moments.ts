/**
 * THE FOUR LIGHTS in the hook: the site's four sample calls (lib/pages/
 * home.server.ts), in the order the #demo stage tours them — the rush, just
 * after closing, a Sunday, 3 a.m. The clock flicks through their times and
 * lands on the night's 03:12; the day drum above it reads the site's own
 * picker keys (call.ts picker.keys), and the last one says what 03:12 is.
 */
import { mixColor } from '../../lib/lights';
import { LIGHTS, type LightId } from '../../theme';

export type Moment = {
  id: LightId;
  /** the clock's four figures (the call's time on the site) */
  digits: readonly [number, number, number, number];
  /** the day drum's row */
  label: string;
};

export const MOMENTS: readonly Moment[] = [
  { id: 'rush', digits: [1, 7, 0, 5], label: 'Mid-rush' }, // Friday 17:05
  { id: 'closing', digits: [2, 0, 1, 0], label: 'After closing' }, // Thursday 20:10
  { id: 'sunday', digits: [1, 0, 1, 2], label: 'Sunday' }, // Sunday 10:12
  { id: 'night', digits: [0, 3, 1, 2], label: 'Tuesday night' }, // Tuesday 03:12
];

/** The hex colours of a CSS gradient, padded with the last one (or paper) to `n`. */
const hexes = (g: string, n: number): string[] => {
  const h = g.match(/#[0-9a-f]{6}/gi) ?? [];
  return Array.from({ length: n }, (_, i) => h[Math.min(i, h.length - 1)] ?? '#f7f3ff');
};

/**
 * The figures' fill ON THE DARK, as three stops (0 %, 55 %, 100 %).
 * The night's is its `num` verbatim (CLOCK_FILL). The three pale-room lights
 * set dark figures on a light room; on the hook's black the same light has
 * to glow instead, so their figures are built the way the night's are — a
 * paper-white top running into the light's highlight and down into the
 * light's own `num` colour.
 */
export function numStops(id: LightId): [string, string, string] {
  const L = LIGHTS[id];
  if (L.tone === 'night') {
    const [a, b, c] = hexes(L.num, 3);
    return [a!, b!, c!];
  }
  const [o3, o4] = [L.orb[3] ?? '#f7f3ff', L.orb[4] ?? '#ffffff'];
  const [ink] = hexes(L.num, 1);
  return [mixColor(o4, o3, 0.2), mixColor(o3, ink!, 0.12), mixColor(o3, ink!, 0.62)];
}

export const NUM_STOPS: Record<LightId, [string, string, string]> = {
  rush: numStops('rush'),
  closing: numStops('closing'),
  sunday: numStops('sunday'),
  night: numStops('night'),
};

/** Stops → the CSS gradient a figure is clipped to. */
export const numFill = (s: readonly string[]) =>
  `linear-gradient(180deg, ${s[0]} 0%, ${s[1]} 55%, ${s[2]} 100%)`;

/** Two stop sets mixed (t 0 → a, 1 → b), stop by stop (perceptual). */
export const mixStops = (a: readonly string[], b: readonly string[], t: number) =>
  a.map((c, i) => mixColor(c, b[i], t));
