/**
 * The screens of a reel on its timeline: every line's word spans (SCRIPT.md "Screens", timing.ts SCREENS) turned into
 * timed screens — when each rises, when it leaves, and its tokens with their onsets, the display map applied (numerals
 * over spoken word spans). Pure; the placeholder title cards read it now, the Captions fork will read the same windows.
 *
 * A screen rises 2 f ahead of its first word (or is already set at frame 0 for the reel's first screen), holds until
 * the next screen of its line rises, and the line's last screen holds one beat past the line's end (never over the next
 * line's first screen).
 */
import { BEAT } from '../../timing';
import { typo } from '../../kb/kit/type';
import { VOICE } from '../voice.generated';
import type { ScreenKind } from '../common/series';
import type { ReelTimeline } from '../types';

export type Token = { text: string; onset: number };
export type TimedScreen = { id: string; kind: ScreenKind; k: number; from: number; to: number; set0: boolean; tokens: Token[]; text: string };

const LEAD = 2;

export function timedScreens(T: ReelTimeline): TimedScreen[] {
  const out: TimedScreen[] = [];
  const lines = T.VOICES.filter((v) => T.SCREENS[v.id]);
  lines.forEach((v, li) => {
    const s = T.SCREENS[v.id];
    const line = (VOICE.lines as Record<string, { say: string }>)[v.id];
    const words = line.say.split(' ').filter(Boolean);
    const onset = (k: number) => v.at + T.vWord(v.id, k);
    const nextLine = lines[li + 1];
    const nextStart = nextLine && T.SCREENS[nextLine.id].spans.length ? nextLine.at + T.vWord(nextLine.id, T.SCREENS[nextLine.id].spans[0][0]) - LEAD : Infinity;
    s.spans.forEach(([a, e], k) => {
      const tokens: Token[] = [];
      for (let i = a; i <= e; i++) {
        const d = T.DISPLAY.find((m) => m.id === v.id && m.from === i);
        if (d) {
          tokens.push({ text: d.text, onset: onset(i) });
          i = d.to;
        } else tokens.push({ text: typo(words[i]), onset: onset(i) });
      }
      const set0 = !!s.set0 && k === 0;
      const from = set0 ? 0 : onset(a) - LEAD;
      const to = k + 1 < s.spans.length ? onset(s.spans[k + 1][0]) - LEAD : Math.min(v.at + T.vFrames(v.id) + BEAT, nextStart);
      out.push({ id: v.id, kind: s.kind, k, from, to, set0, tokens, text: tokens.map((x) => x.text).join(' ') });
    });
  });
  return out;
}
