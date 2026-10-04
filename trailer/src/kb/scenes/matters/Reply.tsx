/**
 * b15 · THE DESK'S REPLY — `● FRONT DESK` (label role, graphite) and the staff reply under the in-person card,
 * a sentence a line, each word rising out of its mask on Leo's real word onsets (caption role, graphite):
 * "That's completely normal. / We'll take it slow." Set on the card's text axis: her line and his answer read
 * as one conversation. It holds through the bar of room tone and under b16's title, and fades with the light.
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
import { REPLY_LINES, typeFade, type MattersLayout } from './stage';

/** words lead the voice by a frame (the captions' idiom) */
const LEAD = 1;

export const DeskReply: React.FC<{ t: number; g: MattersLayout }> = ({ t, g }) => {
  const L = useLayout();
  const r = g.reply;
  if (t < M.deskWords[0] - 6) return null;
  const fade = typeFade(t);
  if (fade <= 0.001) return null;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const labelSize = label.fontSize as number;
  const cap = typeStyle('caption', L.vertical, { tone: 'paper' });
  const dot = Math.round(labelSize * 0.3);
  const tag = reveal(t, M.deskWords[0] - 4, { config: SPRING.caption, rise: 90 });
  let n = 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: fade < 0.999 ? fade : undefined }}>
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
