/**
 * SCALE's colour, with restraint. The white act is paper and ink; colour
 * lives in the subject, never in the wallpaper:
 *
 *   accent   ONE accent ink for the whole scene (the knowledge heading's
 *            two-tone idiom): the closing light's emerald — the name the
 *            light is on in the industry index, "16", "14", the AI
 *            disclosure in the greetings, the speaker dot, the after-call
 *            rail, its "Booked" pill and its confirmation. No second accent:
 *            the four lights are heard (the wall's chimes), not painted on
 *            the index.
 */
import { C, LIGHTS } from '../../theme';
import { mixColor, rgba } from '../../lib/lights';

/** the scene's one accent ink (on paper) */
export const ACCENT = LIGHTS.closing.ink;
/** its pale tint (the "Booked" pill's ground on white stock) */
export const ACCENT_TINT = '#e7f5ef';
/** its lighter step (a glint inside the figure, a pulse along the rail) */
export const ACCENT_LIT = LIGHTS.closing.orb[2];
/** ink → `col` by k (OKLab) */
export const tintInk = (col: string, k: number, base: string = C.ink) => (k <= 0.001 ? base : mixColor(base, col, Math.min(1, k)));

/** quiet meta (labels) on white stock */
export const META = '#6b6678';

export { rgba };
