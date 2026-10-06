/**
 * REEL 4 · THE OWNER'S FALLBACK (docs/ig/SCRIPT.md ig4 b8): the Conversation tab's own field — the kit FieldCard's card,
 * label and field geometry (kit ui.tsx useFieldCard: a white card on the mesh, the app's Label in sentence case, the
 * bordered field) — labelled exactly as the dashboard labels it, "When the answer isn’t in your documents"
 * (components/agent/tabs/TabConversation.tsx:312; 28 px chrome), holding THE OWNER'S LINE as its text (title 56):
 * "I won’t guess. The team will call you back." — the very words she says.
 *
 * It slides up as time resumes (an opaque sheet from under the frame's foot, a stiff critically damped spring). The line is already there, at 40 % ink, and
 * LIGHTS TO FULL INK WORD BY WORD AS SHE SAYS IT (a 1-frame glint of her teal on each onset, nothing moves): the field
 * text IS the caption. ● AVA sits over it. On "back." her teal focus ring settles round the field (it closes in from
 * 10 px out). Once she has stopped, it steps back (× .96) and goes.
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, mixHex, smooth, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { APP, measureText, meshElevation, meshShadowInk, spaceWidth, ui, useFieldCard, useKitFaces, W } from '../../kb/kit';
import { KB_MESH, MOMENT_LIGHTS } from '../../kb/palettes';
import { TurnLabel } from '../components/Call';
import { captionScreens } from '../components/Captions';
import { ZoneRect } from '../components/ZoneGuard';
import { FIELD } from './layout';
import * as T from './timing';

const SUNDAY = MOMENT_LIGHTS.sunday;
const M = T.M;
export const FIELD_LABEL = 'When the answer isn’t in your documents';
/** the owner's line (the field's text) = her line's say, typographic apostrophes */
const ROW_BREAK = 3;
/** the rise: an opaque sheet sliding up from under the frame's foot over the stepped-back documents, on a stiff,
 *  critically damped spring (ig2's panel rise) — never a half-transparent card over sharp rows */
const UP = { stiffness: 820, damping: 2 * Math.sqrt(820), mass: 1 };
const RISE_FROM = 1500;
const LIT0 = 0.4;
/** the step back's length (frames): it holds a beat after "back." (timing.ts FIELD_OUT), then hands over to the thesis */
const OUT = 3;

export const OwnerField: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const s = ready ? captionScreens(T, 'ig4-07')[0] : null;
  const text = s ? s.tokens.map((x) => x.text).join(' ') : '';
  const g = useFieldCard({ x: FIELD.x, y: FIELD.y, w: FIELD.w, label: FIELD_LABEL, placeholder: '', text, size: FIELD.size, labelSize: FIELD.labelSize, save: false, rows: 2 });
  if (!ready || !s || t < M.fieldUp - 1 || t > M.fieldOut + OUT + 1) return null;
  const { card, field } = g;
  const r = g.spec.labelSize / 14;
  // the rise (the site's spring from 120 px below) and the step back
  const e = springUnit(t - M.fieldUp, UP);
  // the step back: down a little, × .96, gone in 3 f (fast out: the card has nearly gone before the documents come
  // forward in its place — Stage.tsx FWD — so the two never double-expose)
  const out = tween(t, [M.fieldOut, M.fieldOut + OUT], [0, 1], EASE.out3);
  const dy = (1 - e) * RISE_FROM + out * 30;
  const sc = 1 - 0.04 * out;
  const o = 1 - smooth(0, 0.85, out);
  const moving = Math.abs(dy) > 0.02 || (out > 0 && out < 1);
  // the words: explicit rows (the two sentences), measured
  const tSpec = { size: g.spec.size, weight: 480, tracking: -0.02 };
  const space = spaceWidth(tSpec);
  const lineH = g.lineH;
  let x = 0;
  let row = 0;
  const pos = s.tokens.map((tk, i) => {
    if (i === ROW_BREAK) {
      row = 1;
      x = 0;
    }
    const w = measureText(tk.text, tSpec);
    const p = { x, row, w };
    x += w + space;
    return p;
  });
  const focus = t >= M.back ? springUnit(t - M.back, { stiffness: 140, damping: 18, mass: 1 }) : 0;
  const ink = meshShadowInk(KB_MESH);
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const tf = `translate(${(card.x + (1 - sc) * (cx - card.x)).toFixed(3)}px, ${(card.y + dy + (1 - sc) * (cy - card.y)).toFixed(3)}px)${sc !== 1 ? ` scale(${sc.toFixed(5)})` : ''}`;
  const textW = Math.max(...pos.map((p) => p.x + p.w));
  return (
    <>
      {/* (her tag leaves just ahead of the card — its 6 f exit is over before the documents reach its place) */}
      <TurnLabel t={t} who="ava" x={FIELD.x + 6} y={FIELD.tagY} at={M.avaTag} exitAt={M.fieldOut - 3} size={28} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: card.w,
          height: card.h,
          borderRadius: 40,
          background: APP.card,
          boxShadow: meshElevation(3, ink),
          transformOrigin: '0 0',
          opacity: o >= 0.999 ? undefined : o,
          ...subpixel(tf, moving),
        }}
      >
        <div style={{ position: 'absolute', left: field.x - card.x, top: field.y - card.y - g.spec.labelSize * 1.2 - 10 * r, ...ui(g.spec.labelSize, W.medium), color: APP.foreground }}>{FIELD_LABEL}</div>
        <div
          style={{
            position: 'absolute',
            left: field.x - card.x,
            top: field.y - card.y,
            width: field.w,
            height: field.h,
            borderRadius: 12 * r * 0.75,
            background: APP.background,
            boxShadow: [
              `inset 0 0 0 1.25px ${mixHex(APP.border, SUNDAY.orb[2], Math.min(1, focus))}`,
              focus > 0.001 ? `0 0 0 ${(2.6 + (1 - Math.min(1, focus)) * 10).toFixed(2)}px rgba(34, 184, 207, ${(0.5 * Math.min(1, focus * 1.4)).toFixed(3)})` : '',
            ]
              .filter(Boolean)
              .join(', '),
          }}
        >
          {s.tokens.map((tk, i) => {
            const p = pos[i];
            const lit = LIT0 + (1 - LIT0) * tween(t, [tk.onset - 1, tk.onset + 1], [0, 1], EASE.out3);
            const gl = t < tk.onset - 1 ? 0 : t < tk.onset ? EASE.out3(t - (tk.onset - 1)) : Math.exp(-(t - tk.onset) / 1.2);
            const col = gl > 0.004 ? mixHex(APP.foreground, SUNDAY.orb[2], 0.6 * gl) : APP.foreground;
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: g.padX + p.x,
                  top: g.padY + p.row * lineH + (lineH - g.spec.size * 1.12) / 2,
                  ...typeStyle('title', true, { size: g.spec.size }),
                  letterSpacing: '-0.02em',
                  color: col,
                  opacity: lit >= 0.999 ? undefined : lit,
                  whiteSpace: 'nowrap',
                }}
              >
                {tk.text}
              </span>
            );
          })}
        </div>
      </div>
      {o > 0.5 && dy < 40 ? (
        <>
          <ZoneRect what="owner field label" rect={{ x: field.x, y: field.y + dy - g.spec.labelSize * 1.2 - 10 * r, w: measureText(FIELD_LABEL, { size: g.spec.labelSize, weight: W.medium }), h: g.spec.labelSize * 1.2 }} />
          <ZoneRect what="owner field text ig4-07" rect={{ x: field.x + g.padX, y: field.y + dy + g.padY, w: textW, h: 2 * lineH }} />
        </>
      ) : null}
    </>
  );
};
