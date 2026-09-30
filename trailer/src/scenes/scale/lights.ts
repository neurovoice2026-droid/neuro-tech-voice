/**
 * SCALE's four lights (theme.ts LIGHTS, #demo's MOMENT_LIGHTS): the rush —
 * every business, all at once.
 *
 *   wall       the 4 × 4 wears the four lights by QUADRANT, four cards each:
 *              rush top-left (card 01, the opener — the rush leads), closing
 *              top-right, Sunday bottom-left, the night bottom-right. Each
 *              card's icon disc, its ripple and its hit flash are its
 *              quadrant's light; the label stays ink
 *   languages  each greeting's small orb cycles the four (Japanese is the
 *              closing light: it becomes the call)
 *   flow       the closing light (emerald = confirmed); the CRM confirms in
 *              settled green
 */
import { C, LIGHTS, type LightId } from '../../theme';
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
export const litFill = (id: LightId, k: number) => (k <= 0.001 ? '#ffffff' : mixColor('#ffffff', tintOf(id), Math.min(1, 0.3 * k)));

/**
 * The icon disc at rest: a pale, top-left-lit sphere of the light (its
 * lightest stops), a hairline of its ring colour and a soft tinted drop —
 * a lit key, not a flat chip.
 */
export function discRest(id: LightId) {
  const o = LIGHTS[id].orb;
  return {
    background: `radial-gradient(120% 120% at 30% 24%, ${o[4]} 0%, ${mixColor(o[4], o[3], 0.55)} 46%, ${mixColor(o[4], o[3], 0.95)} 100%)`,
    boxShadow: `inset 0 0 0 1.5px ${rgba(o[2], 0.2)}, inset 0 -6px 14px -6px ${rgba(o[2], 0.22)}, 0 8px 18px -10px ${rgba(o[1], 0.4)}`,
  };
}

/** The icon disc lit (the hit): the light's key-dot gradient with a hot highlight. */
export function discHot(id: LightId) {
  const o = LIGHTS[id].orb;
  return `radial-gradient(90% 90% at 30% 24%, ${rgba(o[4], 0.85)} 0%, ${rgba(o[4], 0)} 42%), ${LIGHTS[id].disc}`;
}

/** the light's body colour (glows, sparks, rail) */
export const bodyOf = (id: LightId) => LIGHTS[id].orb[2];

/**
 * The four inks in hue order round the cool side of the wheel (rose →
 * violet → teal → emerald): a continuous sweep with no muddy middle, all
 * dark enough to read on white.
 */
export const INK_SWEEP = [LIGHTS.rush.ink, LIGHTS.night.ink, LIGHTS.sunday.ink, LIGHTS.closing.ink] as const;

/** A CSS gradient of the four inks (for background-clip: text). */
export const inkSweep = (deg = 100) =>
  `linear-gradient(${deg}deg, ${INK_SWEEP[0]} 0%, ${mixColor(INK_SWEEP[0], INK_SWEEP[1], 0.5)} 17%, ${INK_SWEEP[1]} 34%, ${mixColor(INK_SWEEP[1], INK_SWEEP[2], 0.5)} 50%, ${INK_SWEEP[2]} 66%, ${INK_SWEEP[3]} 100%)`;

/** confirmed (the CRM) */
export const SETTLED = C.settled;

export { rgba };
