/**
 * <Captions>, but two captions never share a frame.
 *
 * Inside a line, the shared <Captions> keeps a caption on screen at least a
 * beat after its last word; with no echo slot (this scene has none) it then
 * runs its 4 f exit from the frame the next caption starts — so when the next
 * caption comes sooner than that (kb-2: "…for that," → "and…", 14 f apart),
 * the incoming words would rise over the outgoing ones.
 *
 * Here the beat-after rule gives way: such a caption is drawn on its own (the
 * same layout, the same word reveal as <Captions>) and its words leave up
 * through their masks — power3.in, a ≤ 1.4 f left-to-right stagger, fading in
 * the second half — so that it is gone on the frame the next caption's first
 * word becomes visible. No blur. Every other caption is drawn by <Captions>
 * unchanged. (Mirrors Captions.tsx's plan: HOLD = 1 beat, OUT = 4, words
 * appear `lead` frames before they are spoken, each released a frame early on
 * SPRING.caption from 80 % of its height.)
 */
import React from 'react';
import { Captions, type CaptionsProps } from '../../components/Captions';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { mixHex, SPRING } from '../../lib/motion';
import { maskBox, UNIT_STAGGER } from '../../lib/type';
import { BEAT, vWord, type Caption } from '../../timing';

const OUT = 4;
const HOLD = BEAT;
const RISE = 80;

const words = (c: Caption) => c.text.split(' ');
const idx = (c: Caption, j: number) => c.map?.[j] ?? c.word + j;

/** word j of n leaves in a window of `dur` frames from `at`: a small left-to-right stagger inside it */
function exitOf(at: number, dur: number, j: number, n: number) {
  const st = n > 1 ? Math.min(0.4, (dur * 0.35) / (n - 1)) : 0;
  return { at: at + j * st, dur: dur - (n - 1) * st };
}

/** one caption on its own: in word by word with the voice, out through its masks over [cut − OUT, cut] */
const CutCaption: React.FC<CaptionsProps & { caption: Caption; cut: number; index: number }> = (props) => {
  const { t, lineAt, voice, caption: c, cut, index, font, x, y, maxWidth, align = 'center', tint } = props;
  const glide = useGlide(); // under the scene's slow push each word holds its own sub-pixel layer
  const lead = props.lead ?? 2;
  const ws = words(c);
  const appear = ws.map((_, j) => lineAt + vWord(voice, idx(c, j)) - lead);
  if (t < Math.min(...appear) - 1 || t > cut) return null;
  const rowH = font.size * font.lineHeight;
  const left = align === 'center' ? x - maxWidth / 2 : align === 'left' ? x : x - maxWidth;
  const color = props.color ?? '#140a24';
  const n = ws.length;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: y - rowH / 2,
        width: maxWidth,
        textAlign: align,
        textWrap: 'balance',
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle: 'normal',
        fontSize: font.size,
        lineHeight: font.lineHeight,
        letterSpacing: typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking,
        color,
        whiteSpace: 'normal',
      }}
    >
      {ws.map((w, j) => {
        // as <Captions>: the caption rises as a unit on its first spoken word (a ½ f ripple)
        const r = reveal(t, Math.min(...appear) - 1 + j * UNIT_STAGGER, { config: SPRING.caption, rise: RISE, fade: 0.5, exit: exitOf(cut - OUT, OUT, j, n) });
        const tn = tint?.(index, j);
        const col = tn && tn.k > 0.001 ? mixHex(color, tn.color, tn.k) : color;
        return (
          <React.Fragment key={j}>
            {j > 0 ? ' ' : null}
            <span style={maskBox(0)}>
              <span style={{ ...revealStyle(r, undefined, glide), color: col }}>{w}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const CaptionRun: React.FC<CaptionsProps> = (props) => {
  const { lineAt, voice, captions } = props;
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

  return (
    <>
      {groups.map((g, k) => {
        // (a group's tint callback still receives the index into the FULL caption list)
        const off = captions.indexOf(g.caps[0]);
        if (g.cut === null) {
          return <Captions key={k} {...props} captions={g.caps} tint={props.tint ? (c, j) => props.tint!(c + off, j) : undefined} />;
        }
        return <CutCaption key={k} {...props} caption={g.caps[0]} cut={g.cut} index={off} />;
      })}
    </>
  );
};
