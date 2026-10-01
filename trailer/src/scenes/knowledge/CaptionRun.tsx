/**
 * <Captions>, but two captions never share a frame.
 *
 * Inside a line, the shared <Captions> keeps a caption on screen at least a
 * beat after its last word; with no echo slot (this scene has none) it then
 * runs its 4 f exit from the frame the next caption starts — so when the next
 * caption comes sooner than that (kb-2: "…for that," → "and…", 14 f apart),
 * the incoming words rise over the outgoing ones ("I dand't have…").
 *
 * Here the beat-after rule gives way: such a caption is drawn on its own and
 * leaves with the captions' own replacement exit (−30 % of its height, 4 px
 * blur, fade, 4 f, power2.in) so that it is gone on the frame the next
 * caption's first word becomes visible. Every other caption is drawn by
 * <Captions> unchanged. (Mirrors Captions.tsx's plan: HOLD = 1 beat, OUT = 4,
 * words appear `lead` frames before they are spoken.)
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Captions, type CaptionsProps } from '../../components/Captions';
import { EASE, tween } from '../../lib/motion';
import { BEAT, vWord, type Caption } from '../../timing';
import { textWidth } from './measure';

const OUT = 4;
const HOLD = BEAT;

const words = (c: Caption) => c.text.split(' ');
const idx = (c: Caption, j: number) => c.map?.[j] ?? c.word + j;

export const CaptionRun: React.FC<CaptionsProps> = (props) => {
  const { t, lineAt, voice, captions, font, maxWidth } = props;
  const lead = props.lead ?? 2;
  const spoken = (c: Caption) => words(c).map((_, j) => lineAt + vWord(voice, idx(c, j)));
  const start = (c: Caption) => Math.min(...spoken(c)) - lead;

  // split the run wherever the beat-after rule would make two captions overlap
  const groups: { caps: Caption[]; cut: number | null }[] = [];
  let cur: Caption[] = [];
  captions.forEach((c, i) => {
    const next = captions[i + 1];
    const minEnd = Math.max(...spoken(c)) + HOLD;
    if (next && minEnd + OUT > start(next)) {
      if (cur.length) groups.push({ caps: cur, cut: null });
      groups.push({ caps: [c], cut: start(next) });
      cur = [];
    } else cur.push(c);
  });
  if (cur.length) groups.push({ caps: cur, cut: null });

  const rowH = font.size * font.lineHeight;
  const fontCss = `${font.italic ? 'italic ' : ''}${font.weight} ${font.size}px ${font.family}`;
  const trackEm = typeof font.tracking === 'number' ? font.tracking : parseFloat(font.tracking) || 0;

  return (
    <>
      {groups.map((g, k) => {
        if (g.cut === null) {
          // (a group's tint callback still receives the index into the FULL caption list)
          const off = captions.indexOf(g.caps[0]);
          return (
            <Captions
              key={k}
              {...props}
              captions={g.caps}
              tint={props.tint ? (c, j) => props.tint!(c + off, j) : undefined}
            />
          );
        }
        // gone (opacity 0) on the frame the next caption's first word shows
        const u = tween(t, [g.cut - OUT, g.cut], [0, 1], EASE.in2);
        if (u >= 1) return null;
        const c = g.caps[0];
        const rows = Math.max(1, Math.ceil(textWidth(c.text, fontCss, font.size, trackEm) / maxWidth - 0.02));
        const off = captions.indexOf(c);
        return (
          <AbsoluteFill
            key={k}
            style={{
              transform: u > 0 ? `translateY(${(-0.3 * rows * rowH * u).toFixed(2)}px)` : undefined,
              opacity: 1 - u,
              filter: u > 0.01 ? `blur(${(4 * u).toFixed(2)}px)` : undefined,
            }}
          >
            <Captions
              {...props}
              captions={[c]}
              holdUntil={g.cut}
              tint={props.tint ? (_c, j) => props.tint!(off, j) : undefined}
            />
          </AbsoluteFill>
        );
      })}
    </>
  );
};
