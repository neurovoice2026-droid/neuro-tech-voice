/**
 * TYPED TEXT, AS A REAL FIELD SHOWS IT (CLIENT DIRECTION v2 §3: "keystrokes are per word on 16ths with a caret") —
 * pure functions of the timeline time, no React.
 *
 * A text input does not animate a keystroke: the glyphs are simply THERE, in place, at their final pen position. So typed
 * text never travels (no rise, no mask, no settle); at 120 fps its appearance takes ONE timeline frame — an opacity ramp
 * centred on the keystroke (≈ 15 / 50 / 85 / 100 % on the four render frames), so the key sound lands on the half-way
 * frame and a 30 fps frame never shows a word half risen. The caret is always the pen position after the last glyph group
 * that is at least half visible (typedCount) — it never leads the text, it jumps with it, as a real caret does.
 * The masked rise stays what it is for: captions and headlines (components/Type reveal), never product fields.
 */
import { smooth } from '../../lib/motion.ts';

/** the appearance ramp, timeline frames (centred on the keystroke) */
export const TYPED_RAMP = 1;

/** a typed glyph group's opacity at t (its keystroke at `at`): 0 before at − ½ f, ½ at the key, 1 from at + ½ f */
export const typedOpacity = (t: number, at: number): number => smooth(at - TYPED_RAMP / 2, at + TYPED_RAMP / 2, t);

/** how many glyph groups are at least half visible at t (keys sorted): the caret sits after the last of them */
export function typedCount(t: number, keys: readonly number[]): number {
  let n = 0;
  for (const k of keys) if (k <= t + 1e-6) n++;
  return n;
}
