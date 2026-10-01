/**
 * SCALE's lights (theme.ts LIGHTS, #demo's MOMENT_LIGHTS). The film's idea is
 * 24/7: every hour has its own light. ONE light leads at a time, and it lives
 * in light — the act's ground, one bloom, a card's disc / hit flash / ring /
 * small glow, the near discs — never a flat slab, never a rainbow:
 *
 *   wall       the hour turns every four cards: rush → closing → sunday →
 *              night (each pop hits in its light: the lit disc, its flash
 *              pool, ripple, sparks and a glow under the card); at rest every
 *              card is white stock with an ink icon on a pearl disc
 *   hero       "16 industries." slams in the light that is leading (the
 *              night, the last four cards) and locks the sixteen discs in it
 *   languages  the ACTIVE card leads: English in the rush; the quick four
 *              flick through the four lights (closing · sunday · night · rush,
 *              the hook's clock again); Japanese lands in the closing light.
 *              Each language's light lives ONLY in its card (orb, 2 px rim,
 *              the sheen as it lands, the glow under it, a soft spill behind
 *              it) and the band's "14": the ROOM (ground, near discs) holds
 *              the hero's night through the whole cascade — no rainbow.
 *              The gallery is pearl: a card's light goes out as it recedes
 *   flow       the closing light (emerald = confirmed); the CRM confirms in it
 *
 * Between two far hues the old light drains to white stock before the new one
 * floods in (rose and emerald would mix to grey at a 50/50 crossfade).
 */
import { LIGHTS, type LightId } from '../../theme';
import { mixColor, rgba } from '../../lib/lights';
import { SCALE, SCALE_LOCAL } from '../../timing';

const K = SCALE_LOCAL;

/** the light of industry card i (its group of four) */
export const cardLight = (i: number): LightId => K.wallLight[i];

/** the hero lock's light (the light leading at the slam) */
export const HERO_LIGHT: LightId = K.heroLight;

/** the light of language card k */
export const langLight = (k: number): LightId => K.langLights[k];

/** after the call */
export const FLOW_LIGHT: LightId = 'closing';

/** where the leading light pools (Backdrop maps it to a point per orientation) */
export type Where = 'g0' | 'g1' | 'g2' | 'g3' | 'hero' | 'lang';

/** The light leading the act, key by key. A key turns the light over `dur` frames (smoothstep). */
export const LEAD: readonly { at: number; light: LightId; dur: number; where: Where }[] = [
  ...K.groups.map((at, j) => ({ at: j === 0 ? -K.preroll : at - 2, light: K.wallLights[j] as LightId, dur: 8, where: `g${j}` as Where })),
  { at: SCALE.industriesTitle, light: HERO_LIGHT, dur: 6, where: 'hero' },
  // English: as the keeper turns
  { at: K.enFlip, light: langLight(0), dur: 10, where: 'lang' },
  // the others: as each slides in (the light is there when her voice is)
  ...SCALE.langAt.slice(1).map((a, j) => ({ at: a - 5, light: langLight(j + 1), dur: 6, where: 'lang' as Where })),
];

type Key = { at: number; light: LightId; dur: number };

/**
 * The ROOM's light (the ground and the near discs): the wall's hours, the hero's night — held through
 * the whole language cascade (one light; the languages light only their cards) — then the closing
 * light for the flow, turning as the gallery drops away.
 */
export const ROOM: readonly Key[] = [
  ...LEAD.filter((k) => k.at <= SCALE.industriesTitle),
  { at: K.collapse, light: FLOW_LIGHT, dur: 14 },
];

function keyAt(keys: readonly Key[], t: number): { i: number; prev: number; m: number } {
  let i = 0;
  for (let j = 0; j < keys.length; j++) if (t >= keys[j].at) i = j;
  const k = keys[i];
  const m = i === 0 ? 1 : Math.min(1, Math.max(0, (t - k.at) / k.dur));
  return { i, prev: Math.max(0, i - 1), m: m * m * (3 - 2 * m) };
}

/** where the lead is at t: the key index, the one before it, and the turn's progress 0..1 */
export const leadAt = (t: number) => keyAt(LEAD, t);

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * The weights of the previous and the current lead key at t. Within one light
 * it is a plain crossfade (the bloom moving on); between two lights the old
 * one drains to white stock BEFORE the new one floods in.
 */
function weights(keys: readonly Key[], t: number): { i: number; prev: number; m: number; wPrev: number; wCur: number } {
  const { i, prev, m } = keyAt(keys, t);
  if (prev === i) return { i, prev, m, wPrev: 0, wCur: 1 };
  if (keys[prev].light === keys[i].light) return { i, prev, m, wPrev: 1 - m, wCur: m };
  return { i, prev, m, wPrev: 1 - smooth(0, 0.6, m), wCur: smooth(0.4, 1, m) };
}
export const leadWeights = (t: number) => weights(LEAD, t);
/** the room's light at t (see ROOM), as weights of its previous and current key */
export const roomWeights = (t: number) => weights(ROOM, t);

function colors(keys: readonly Key[], t: number, slot: number): { col: string; w: number }[] {
  const { i, prev, m, wPrev, wCur } = weights(keys, t);
  const col = LIGHTS[keys[i].light].orb[slot];
  if (prev === i || m >= 1 || keys[prev].light === keys[i].light) return [{ col, w: 1 }];
  return [{ col: LIGHTS[keys[prev].light].orb[slot], w: wPrev }, { col, w: wCur }];
}
/** the leading light(s) at t as weighted colours of an orb slot (2 body, 3 pale): a crossfade, never a hue sweep */
export const leadColors = (t: number, slot: number) => colors(LEAD, t, slot);
/** the room's light(s) at t (the near discs) */
export const roomColors = (t: number, slot: number) => colors(ROOM, t, slot);

/**
 * The act's ground for a light on white stock: #demo's stage light for the
 * light rooms; the night's own room is dark, so on the white act the night is
 * its pale lilac light (its orb's pale slots) in the same radial shape.
 */
export const groundOf = (id: LightId) =>
  id === 'night'
    ? `radial-gradient(120% 100% at 50% 40%, #e8dfff 0%, #f1ebff 38%, #f8f5ff 72%, #fbf9ff 100%)`
    : LIGHTS[id].ground;

/** the pale tint a light throws on white card stock (its light slot) */
export const tintOf = (id: LightId) => LIGHTS[id].orb[3];

/** a card's fill on its hit: `k` (0..1) of the light's pale tint over white */
export const litFill = (id: LightId, k: number) => (k <= 0.001 ? '#ffffff' : mixColor('#ffffff', tintOf(id), Math.min(1, 0.3 * k)));

/**
 * The icon disc at rest: NEUTRAL — a pearl sphere lit from the top left, an
 * ink hairline and a soft neutral drop. No light: the light is the hit.
 */
export function discRest() {
  return {
    background: 'radial-gradient(120% 120% at 30% 24%, #ffffff 0%, #f6f5f9 46%, #e9e7ef 100%)',
    boxShadow: `inset 0 0 0 1.5px rgba(24,16,40,0.08), inset 0 -6px 14px -6px rgba(24,16,40,0.10), 0 8px 18px -10px rgba(24,16,40,0.28)`,
  };
}

/** The icon disc lit (the hit): the light's key-dot gradient with a hot highlight. */
export function discHot(id: LightId) {
  const o = LIGHTS[id].orb;
  return `radial-gradient(90% 90% at 30% 24%, ${rgba(o[4], 0.85)} 0%, ${rgba(o[4], 0)} 42%), ${LIGHTS[id].disc}`;
}

/** the light's body colour (glows, sparks, rail) */
export const bodyOf = (id: LightId) => LIGHTS[id].orb[2];

/** A figure's ink on white, as a CSS gradient (for background-clip: text): the light's mid → deep. */
export const figureInk = (id: LightId) =>
  id === 'night' ? `linear-gradient(180deg, ${LIGHTS.night.orb[2]} 0%, ${LIGHTS.night.orb[1]} 100%)` : LIGHTS[id].num;

/** confirmed (the CRM): the closing light's own disc and ink */
export const SETTLED = LIGHTS.closing.ink;

export { rgba };
