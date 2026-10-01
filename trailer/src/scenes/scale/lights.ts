/**
 * SCALE's colour, with restraint. The white act is paper and ink; colour
 * lives in the subject, never in the wallpaper:
 *
 *   accent   ONE accent ink for the whole scene (the knowledge heading's
 *            two-tone idiom): the closing light's emerald — "16", "14", the
 *            AI disclosure in the greetings, the after-call rail and its
 *            confirmation. It is also Ava's light here (the call's emerald
 *            room): her small orb in the language cards is the closing orb.
 *   hours    the four lights stay LIGHT, one at a time: on the wall, the
 *            card that has just landed draws its icon in the hour's ink
 *            (rush → closing → sunday → night, four cards each) and settles
 *            back to ink — the hour passing through the wall, nothing more.
 */
import { C, LIGHTS, type LightId } from '../../theme';
import { mixColor, rgba } from '../../lib/lights';
import { SCALE_LOCAL } from '../../timing';

const K = SCALE_LOCAL;

/** the scene's one accent ink (on paper) */
export const ACCENT = LIGHTS.closing.ink;
/** its lighter step (a glint inside the figure, a pulse along the rail) */
export const ACCENT_LIT = LIGHTS.closing.orb[2];
/** Ava's orb in the language cards (one light: the call's) */
export const ORB_PALETTE = LIGHTS.closing.orb;

/** the light of industry card i (its group of four: the hour) */
export const cardLight = (i: number): LightId => K.wallLight[i];

/** a light's ink on paper */
export const inkOf = (id: LightId) => LIGHTS[id].ink;

/** ink → `col` by k (OKLab) */
export const tintInk = (col: string, k: number, base: string = C.ink) => (k <= 0.001 ? base : mixColor(base, col, Math.min(1, k)));

/** quiet meta (labels) on white stock */
export const META = '#6b6678';

export { rgba };
