/**
 * b15 · THE DESK'S REPLY — `● FRONT DESK` (label role, graphite) and the staff reply under the in-person card,
 * a sentence a line, each word rising out of its mask on Leo's real word onsets (caption role, graphite):
 * "That's completely normal. / We'll take it slow." Set on the card's text axis: her line and his answer read
 * as one conversation. It holds through the bar of room tone; in b16 it steps back with the desk under the thesis (its
 * referent: "That's the work"), dimmed, and goes by its opacity where the closing key's dark reaches it.
 *
 * Desk plane: every word rides its own small sub-pixel layer while the camera pushes.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { useLayout } from '../../../lib/layout';
import { SPRING } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { GRAPHITE, KB_INK } from '../../theme';
import { MATTERS_LOCAL as M } from '../../timing';
import { nearestLit } from './Card';
import { fadeMask, localClosing } from './Night';
import { deskStep, deskToScreen, REPLY_LINES, type Closing, type MattersLayout } from './stage';

/** words lead the voice by a frame (the captions' idiom) */
const LEAD = 1;
/** the reply's opacity once the desk has stepped back (it is the thesis' referent: dimmed, never gone) */
const STEPPED = 0.72;

export const DeskReply: React.FC<{ t: number; g: MattersLayout; cl: Closing | null }> = ({ t, g, cl }) => {
  const L = useLayout();
  const r = g.reply;
  if (t < M.deskWords[0] - 6) return null;
  // the closing key in the reply's px (its block's origin at the desk's top-left: the words are laid out in desk px)
  const o = deskToScreen(t, g.vertical, 0, 0);
  const lc = cl ? localClosing(cl, o, o.z) : null;
  if (cl && nearestLit(cl, deskToScreen(t, g.vertical, r.x, r.labelY), o.z, g.card.w, r.rowY + 2 * r.rowH - r.labelY) <= 0.001) return null;
  const fade = 1 - (1 - STEPPED) * Math.min(1, Math.max(0, deskStep(t, g.vertical).k));
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const cap = typeStyle('caption', L.vertical, { tone: 'paper' });
  const dot = Math.round(labelSize * 0.3);
  const tag = reveal(t, M.deskWords[0] - 4, { config: SPRING.caption, rise: 90 });
  let n = 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: g.W, height: g.H, opacity: fade < 0.999 ? fade : undefined, ...fadeMask(lc) }}>
      <div style={{ position: 'absolute', left: r.x, top: r.labelY, ...label, color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
        <span style={maskBox(0)}>
          <span style={{ ...revealStyle(tag, undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
            <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
            FRONT DESK
          </span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: r.x, top: r.rowY, ...cap, lineHeight: `${r.rowH}px`, color: KB_INK.desk.paper.text }}>
        {REPLY_LINES.map((ws, li) => (
          <div key={li} style={{ whiteSpace: 'nowrap', height: r.rowH }}>
            {ws.map((w, j) => {
              const k = n++;
              const rv = reveal(t, M.deskWords[k] - LEAD, { config: SPRING.caption, rise: 80 });
              return (
                <span key={j} style={maskBox(j === ws.length - 1 ? 0 : 0.24)}>
                  <span style={revealStyle(rv, undefined, true)}>{w}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
