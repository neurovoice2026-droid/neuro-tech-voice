/**
 * Film 2's speaker inks (docs/kb/PIPELINE.md §8 "New speaker kinds"). Film 1's theme.ts is NOT touched:
 * everything else (TYPE roles, LIGHTS, ROOM, C, elevation …) is imported from it as is.
 *
 * SCRIPT.md colour logic: one accent per part (rush rose in Part I, sunday teal from Ava on); callers
 * are slate, the front desk is GRAPHITE (desaturated, no chroma), and there is no second chromatic ink.
 *   · caller — film 1's knowledge-scene slate (src/scenes/knowledge/geometry.ts CALLER), not the
 *     call scene's caller blue
 *   · desk   — graphite, a new speaker kind: the person at the front desk, heard in the room
 *   · ava    — film 1's VOICE_INK.ava (the ● AVA tag only appears on her in-call lines)
 */
import { CALLER } from '../scenes/knowledge/geometry';
import { C, LIGHTS, VOICE_INK } from '../theme';

/** graphite: the front desk's ink on paper (neutral, a touch warm) and on night */
export const GRAPHITE = { text: '#2b2a2e', tag: '#55535a', lit: '#c9c7cc' } as const;

export const KB_INK = {
  ...VOICE_INK,
  caller: { label: 'CALLER', night: { text: '#b8c2d6', tag: '#9aa6bd' }, paper: { text: CALLER.text, tag: CALLER.tag } },
  desk: { label: 'FRONT DESK', night: { text: GRAPHITE.lit, tag: GRAPHITE.lit }, paper: { text: GRAPHITE.text, tag: GRAPHITE.tag } },
} as const;
export type KbSpeaker = keyof typeof KB_INK;

/** a voice role (scripts/voice-lines-kb.json `voice`) → who is speaking */
export const SPEAKER_OF: Record<string, KbSpeaker> = { ava: 'ava', desk: 'desk', caller: 'caller', caller2: 'caller', caller3: 'caller', caller4: 'caller' };

/** One accent per part: the rose line light until Ava arrives, then sunday teal (on paper). */
export const ACCENT = {
  rush: LIGHTS.rush.ink,
  sunday: LIGHTS.sunday.ink,
  ink: C.ink,
  muted: C.muted,
} as const;
