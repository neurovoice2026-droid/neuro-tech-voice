/**
 * SCALE's four lights (theme.ts LIGHTS, #demo's MOMENT_LIGHTS): the rush —
 * every business, all at once.
 *
 *   wall       the 4 × 4 wears the four lights by QUADRANT, four cards each:
 *              rush top-left (card 01, the opener — the rush leads), closing
 *              top-right, Sunday bottom-left, the night bottom-right. Each
 *              card's icon disc, its corner light and its hit flash are its
 *              quadrant's light; the label stays ink
 *   languages  each greeting's small orb cycles the four (Japanese is the
 *              closing light: it becomes the call)
 *   flow       the closing light (emerald = confirmed); the CRM confirms in
 *              settled green
 */
import { LIGHTS, type LightId } from '../../theme';
import { mixColor, rgba } from '../../lib/lights';
import { POP_CELL } from './geometry';

/** the wall's quadrants: [top-left, top-right, bottom-left, bottom-right] */
export const QUAD_LIGHT: readonly LightId[] = ['rush', 'closing', 'sunday', 'night'];

/** the light of industry card i (by the quadrant of its cell) */
export const cardLight = (i: number): LightId => {
  const [r, c] = POP_CELL[i];
  return QUAD_LIGHT[(r >= 2 ? 2 : 0) + (c >= 2 ? 1 : 0)];
};

/** each language's orb, in language order (EN RO ES FR DE JA) */
export const LANG_LIGHT: readonly LightId[] = ['rush', 'closing', 'sunday', 'night', 'rush', 'closing'];

/** after the call */
export const FLOW_LIGHT: LightId = 'closing';

/** the pale tint a light throws on white card stock (its light slot) */
export const tintOf = (id: LightId) => LIGHTS[id].orb[3];

/** a card's fill on its hit: `k` (0..1) of the light's pale tint over white */
export const litFill = (id: LightId, k: number) => (k <= 0.001 ? '#ffffff' : mixColor('#ffffff', tintOf(id), Math.min(1, 0.26 * k)));

/**
 * The four inks in hue order round the cool side of the wheel (rose →
 * violet → teal → emerald): a continuous sweep with no muddy middle, all
 * dark enough to read on white.
 */
export const INK_SWEEP = [LIGHTS.rush.ink, LIGHTS.night.ink, LIGHTS.sunday.ink, LIGHTS.closing.ink] as const;

/** A CSS gradient of the four inks (for background-clip: text). */
export const inkSweep = (deg = 100) =>
  `linear-gradient(${deg}deg, ${INK_SWEEP[0]} 0%, ${mixColor(INK_SWEEP[0], INK_SWEEP[1], 0.5)} 17%, ${INK_SWEEP[1]} 34%, ${mixColor(INK_SWEEP[1], INK_SWEEP[2], 0.5)} 50%, ${INK_SWEEP[2]} 66%, ${INK_SWEEP[3]} 100%)`;

export { rgba };
