/**
 * SCALE's lights (theme.ts LIGHTS, #demo's MOMENT_LIGHTS). The film's idea is
 * 24/7: every hour has its own light, and each act is owned by one — the
 * night (hook → result), Sunday (knowledge), then here THE RUSH and JUST
 * AFTER CLOSING, so the CTA gathers four lights the film has shown. One
 * light leads at a time, and it lives in light (grounds, blooms, discs).
 *
 *   wall       the rush: every pop hits in rose (the lit disc, its flash
 *              pool, ripple, sparks and a small glow); at rest every card is
 *              white stock with an ink icon on a neutral pearl disc, so the
 *              newest pop glows and the accumulated wall stays calm. On each
 *              quarter the cards already up pulse once in rose. The room is
 *              the rush ground (#demo's rose stage light) under one bloom
 *   hero       "16 industries." locks the whole wall in the rush light and
 *              its figure wears the rush ink: the rose act's payoff
 *   turn       the room turns to the closing light as the title lifts and
 *              the ten cards leave (SCALE_LOCAL.lightTurn)
 *   languages  the closing light: every greeting's orb, sheen, ring and
 *              underline, and the "14"
 *   flow       the closing light (emerald = confirmed); the CRM settles green
 */
import { C, LIGHTS, type LightId } from '../../theme';
import { mixColor, rgba } from '../../lib/lights';
import { SCALE, SCALE_LOCAL } from '../../timing';

/** the light of industry card i (the rush, every quarter) */
export const cardLight = (i: number): LightId => SCALE_LOCAL.wallLight[i];

/** the hero lock's light (the rush: the wall's own light) */
export const HERO_LIGHT: LightId = SCALE_LOCAL.heroLight;

/** the light of every language cell */
export const LANG_LIGHT: LightId = SCALE_LOCAL.langLight;

/** after the call */
export const FLOW_LIGHT: LightId = 'closing';

/**
 * The light leading the act, key by key: the wall's quarter notes (all the
 * rush), the hero's lock (the rush), then the turn to the closing light. A
 * key turns the light over `dur` frames (smoothstep) — one light at a time.
 * (The bloom also moves key by key: it follows the block being filled.)
 */
export const LEAD: readonly { at: number; light: LightId; dur: number }[] = [
  ...SCALE_LOCAL.kicks.map((at, i) => ({ at, light: SCALE_LOCAL.wallLights[i] as LightId, dur: 6 })),
  { at: SCALE.industriesTitle, light: HERO_LIGHT, dur: 6 },
  { at: SCALE_LOCAL.lightTurn[0], light: LANG_LIGHT, dur: SCALE_LOCAL.lightTurn[1] - SCALE_LOCAL.lightTurn[0] },
];

/** where the lead is at t: the key index, the one before it, and the turn's progress 0..1 */
export function leadAt(t: number): { i: number; prev: number; m: number } {
  let i = 0;
  for (let j = 0; j < LEAD.length; j++) if (t >= LEAD[j].at) i = j;
  const k = LEAD[i];
  const m = i === 0 ? 1 : Math.min(1, Math.max(0, (t - k.at) / k.dur));
  return { i, prev: Math.max(0, i - 1), m: m * m * (3 - 2 * m) };
}

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * The weights of the previous and the current lead key at t. Within one light
 * it is a plain crossfade (the bloom moving on); between two lights the old
 * one drains to white stock BEFORE the new one floods in — rose and emerald
 * (complements) would mix to grey at a 50/50 crossfade.
 */
export function leadWeights(t: number): { i: number; prev: number; m: number; wPrev: number; wCur: number } {
  const { i, prev, m } = leadAt(t);
  if (prev === i) return { i, prev, m, wPrev: 0, wCur: 1 };
  if (LEAD[prev].light === LEAD[i].light) return { i, prev, m, wPrev: 1 - m, wCur: m };
  return { i, prev, m, wPrev: 1 - smooth(0, 0.6, m), wCur: smooth(0.4, 1, m) };
}

/** the leading light(s) at t as weighted colours of an orb slot (2 body, 3 pale): a crossfade, never a hue sweep */
export const leadColors = (t: number, slot: number): { col: string; w: number }[] => {
  const { i, prev, m, wPrev, wCur } = leadWeights(t);
  const cur = { col: LIGHTS[LEAD[i].light].orb[slot], w: wCur };
  return prev !== i && m < 1 ? [{ col: LIGHTS[LEAD[prev].light].orb[slot], w: wPrev }, cur] : [cur];
};

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

/** confirmed (the CRM) */
export const SETTLED = C.settled;

export { rgba };
