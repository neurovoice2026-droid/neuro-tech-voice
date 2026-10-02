/**
 * THE FOUR LIGHTS in the hook: the site's four sample calls (lib/pages/
 * home.server.ts), in the order the #demo stage tours them — the rush, just
 * after closing, a Sunday, 3 a.m. The clock flicks through their times and
 * lands on the night's 03:12; the day drum above it reads the site's own
 * picker keys (call.ts picker.keys), and the last one says what 03:12 is.
 */
import { inkFor } from '../../lib/lights';
import { ROOM, type LightId } from '../../theme';

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

/** `ink` laid at `a` over `ground`, as one OPAQUE colour (sRGB "over", as the browser composites). */
const over = (ink: string, ground: string, a: number): string => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(ink), p(ground)];
  return `#${x.map((v, i) => Math.round(v * a + y[i]! * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * The figures' ink ON THE DARK: ONE flat colour per light — the light's own ink
 * on the night (lib/lights inkFor(id, 'dark'): the orb's light slot — rose,
 * mint, ice, lilac) at ≈ 90 % on the room. Flat, like the reference type: no
 * gradient fill, no gloss. The colon orb's light does the colour; the figures
 * are lit by it. Pre-composited to an opaque colour, so nothing behind the
 * figures (the ring, the bloom) ever shows through a glyph.
 */
const FIGURE_ALPHA = 0.9;
export const FIGURE_INK: Record<LightId, string> = {
  rush: over(inkFor('rush', 'dark'), ROOM.night, FIGURE_ALPHA),
  closing: over(inkFor('closing', 'dark'), ROOM.night, FIGURE_ALPHA),
  sunday: over(inkFor('sunday', 'dark'), ROOM.night, FIGURE_ALPHA),
  night: over(inkFor('night', 'dark'), ROOM.night, FIGURE_ALPHA),
};
