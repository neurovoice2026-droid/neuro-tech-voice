/**
 * The Sunday light through the scene — ONE place that says what colour the
 * reader is at frame t, so the orb, its bloom and rim, the room and the
 * live accents all change together:
 *
 *   rest / reading   Sunday's orb (teal into aqua-white)
 *   caller speaks    Sunday's `listen` twin (leaning to caller blue), eased in
 *                    and out round kb-1 (it is heard from its first breath)
 *   miss             MUTED_MESH: the light drains out of the orb and the room
 *   Ava answers      the Sunday light floods back from her first sound
 *                    (EASE_LIGHT, the site orb's own exponential ease)
 */
import { EASE, tween } from '../../lib/motion';
import { EASE_LIGHT, mixColor, mixPalette, type Glow } from '../../lib/lights';
import { MUTED_MESH } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL, vFrames } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';
import { LISTEN_GLOW, MISS_GLOW, SUN, SUN_GLOW } from './geometry';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** first / last frame a line is heard (env > .15) — the same rule as timing.ts */
const onset = (id: VoiceId) => Math.max(0, VOICE.lines[id].env.findIndex((e) => e > 0.15));
const lastHeard = (id: VoiceId) => {
  const e = VOICE.lines[id].env;
  for (let i = e.length - 1; i >= 0; i--) if (e[i] > 0.15) return i;
  return e.length - 1;
};

/** 0 → 1 → 0: the orb takes its `listen` twin while the caller is heard */
export function listenAt(t: number): number {
  const a = Math.max(KL.orbIn + 6, K.ask + onset(K.askVoice) - 3);
  // back to her own light as soon as the caller has stopped (she reads in it, before the miss)
  const b = K.ask + Math.min(vFrames(K.askVoice), lastHeard(K.askVoice) + 2);
  if (t <= a || t >= b + 8) return 0;
  if (t < a + 8) return tween(t, [a, a + 8], [0, 1], EASE.inOut);
  if (t <= b) return 1;
  return tween(t, [b, b + 8], [1, 0], EASE.inOut);
}

/** 0 → 1 as the light drains on the miss (before any relight) */
export const missAt = (t: number) => tween(t, KL.toGrey, [0, 1], EASE.inOut);

/** 0 → 1 as Ava's light floods back (EASE_LIGHT: it moves on the frame of the change) */
export function relitAt(t: number): number {
  const [a, b] = KL.relight;
  if (t <= a) return 0;
  return EASE_LIGHT(Math.min(1, (t - a) / (b - a)));
}

/** how grey the reader is now (0 lit … 1 muted) */
export const greyAt = (t: number) => missAt(t) * (1 - relitAt(t));

/** the orb's palette at t */
export function orbPalette(t: number): string[] {
  const l = listenAt(t);
  const g = greyAt(t);
  let p: string[] = l > 0 ? mixPalette(SUN.orb, SUN.listen, l) : [...SUN.orb];
  if (g > 0) p = mixPalette(p, MUTED_MESH, g);
  return p;
}

/** the reader's glow (bloom body + rim core) at t */
export function glowAt(t: number): Glow {
  const l = listenAt(t);
  const g = greyAt(t);
  let body = mixColor(SUN_GLOW.body, LISTEN_GLOW.body, l);
  let core = mixColor(SUN_GLOW.core, LISTEN_GLOW.core, l);
  if (g > 0) {
    body = mixColor(body, MISS_GLOW.body, g);
    core = mixColor(core, MISS_GLOW.core, g);
  }
  return { body, core };
}

/** a live accent colour (dots, rings, heads) that follows the reader: sunday ink ↔ muted */
export const accentAt = (t: number) => mixColor(SUN.ink, '#6b6878', greyAt(t));
