/**
 * THE APP — the agent page as a white panel on her mesh (CLIENT DIRECTION v2 §2): the real tab bar
 * (components/agent/AgentPageClient.tsx, components/ui/tabs.tsx line variant — the kit's TabBar) over the tab's
 * content, which SWAPS on the Knowledge click's release (the kit's Swap: the old content leaves up through the
 * box's mask, the new rises in):
 *
 *   General     (what the page opens on) components/agent/tabs/TabGeneral.tsx: "Name and language" (the agent's
 *               name, its language) and "Tone" (four of lib/voice/tone.ts's profiles, Professional chosen)
 *   Knowledge   components/agent/tabs/TabKnowledge.tsx, verbatim strings:
 *                 AddKnowledgeCard   "Add knowledge"; the FileDropZone ("Drop files here or choose them", the
 *                                    hint "PDF, Word, TXT or Markdown · up to 10 MB each"); "or add a web page";
 *                                    "Web page address" + the field (placeholder https://yourbusiness.com/faq) +
 *                                    "Add page" (Link2) — disabled (50 %) while the field is empty, the field
 *                                    cleared (and the button disabled again) when the page is in
 *                 Your documents     the EmptyState "Teach your agent about your business" while the list is
 *                                    empty (it leaves up as the first row lands); the rows are Written.tsx's
 *
 * 16:9 puts the two cards side by side (the panel is a wide desktop window); 9:16 stacks them in ONE column and shows
 * the WHOLE tab at every moment (fix:written — written/stage.ts's 9:16 FULL-TAB SPEC: General's fields side by side and
 * its four tone cards 2 × 2; Knowledge's drop zone compact, "Web page address" over the field and Add page in one row,
 * the rows one-line; nothing scrolls, nothing is cut by the panel's edge). Everything is laid out in FRAME px at the panel's resting place; the
 * whole panel rides one transform while it comes in (written/stage.ts panelPose).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { mixColor } from '../../../lib/lights';
import { EASE, smooth, tween } from '../../../lib/motion';
import { maskBox } from '../../../lib/type';
import { APP, CURSOR, hoverAt, Icon, measureText, Panel, pressAt, Swap, TabBar, ui, W as WT, type CursorKey, type TabBarGeometry } from '../../kit';
import { WRITTEN_LOCAL as W } from '../../timing';
import { panelPose, type Box, type WrittenStage } from './stage';

const PLACEHOLDER = 'https://yourbusiness.com/faq';
const PLACEHOLDER_INK = '#a29bb4';

/** lucide Upload (24-unit box) */
const UploadIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden>
    <path d="M12 3v12" />
    <path d="m17 8-5-5-5 5" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
);

const inBox = (b: Box) => ({ position: 'absolute' as const, left: b.x, top: b.y, width: b.w, height: b.h });

/* ── General (the tab the page opens on): TabGeneral.tsx's first two cards — "Name and language" (the agent's name
 *    and language) and "Tone" (TabGeneral.tsx:224–258: CardDescription verbatim; the radio grid in AGENT_TONES order
 *    with each profile's TONE_ICONS icon, label and blurb from lib/voice/tone.ts, Professional chosen). Both framings
 *    show all four — Formal · Professional / Empathetic · Casual (9:16 too since fix:written: GeneralPortrait); nothing
 *    is re-ordered or re-worded ── */
type ToneIcon = 'landmark' | 'briefcase' | 'heartHandshake' | 'coffee';
/** lucide 1.49 node data (landmark, briefcase, heart-handshake, coffee .mjs) */
const TONE_ICON: Record<ToneIcon, React.ReactNode> = {
  landmark: (
    <>
      <path d="M10 18v-7" />
      <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />
      <path d="M14 18v-7" />
      <path d="M18 18v-7" />
      <path d="M3 22h18" />
      <path d="M6 18v-7" />
    </>
  ),
  briefcase: (
    <>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </>
  ),
  heartHandshake: (
    <path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762" />
  ),
  coffee: (
    <>
      <path d="M10 2v2" />
      <path d="M14 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <path d="M6 2v2" />
    </>
  ),
};
const TONES: readonly { label: string; blurb: string; icon: ToneIcon; on?: true }[] = [
  { label: 'Formal', blurb: 'Structured, precise, authoritative', icon: 'landmark' },
  { label: 'Professional', blurb: 'Businesslike and unhurried, never stiff', icon: 'briefcase', on: true },
  { label: 'Empathetic', blurb: 'Patient and reassuring, takes its time', icon: 'heartHandshake' },
  { label: 'Casual', blurb: 'Relaxed and natural, like a good receptionist', icon: 'coffee' },
];
const NAME_DESC = 'How your agent introduces itself, and the language it speaks with callers.';
const TONE_DESC = 'Sets how your agent speaks: its wording, pace and warmth. The greeting on the Conversation tab follows it.';

/** lines a string wraps to at `size` in `width` (word wrap, the ui face) */
function wrapCount(text: string, size: number, weight: number, width: number) {
  let lines = 1;
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (line && measureText(next, { size, weight }) > width) {
      lines++;
      line = w;
    } else line = next;
  }
  return lines;
}

const FIELDS = [
  { label: 'Agent name', value: 'Ava' },
  { label: 'Language', value: 'English' },
] as const;

/** 16:9 General: two columns — Name and language (the fields stacked) left, Tone and its 2 × 2 grid right */
const General: React.FC<{ S: WrittenStage }> = ({ S }) => {
  const T = S.type;
  const x = S.add.x;
  const w = S.add.w;
  const fieldH = S.inputH;
  const f = FIELDS;
  // the cards' descriptions wrap to two lines in 16:9's columns
  const desc = T.small * 1.3 * 2 + 26;
  const fieldsTop = S.add.y + T.title * 1.35 + desc;
  // a field's pitch: the field + its label block
  const pitch = fieldH + T.label * 2.6;
  // Tone: in the right column
  const tone = { x: S.docs.x, y: S.add.y, w: S.docs.w };
  // (a measure a touch narrower than the column, so the description's last line is never one word)
  const descW = tone.w - 44;
  const toneDesc = T.small * 1.3 * wrapCount(TONE_DESC, T.small, WT.regular, descW) + 26;
  const gap = 16;
  const cardW = (tone.w - gap) / 2;
  const padX = 20;
  const blurbSize = T.small - 2;
  const icon = Math.round(T.label * 1.3);
  const blurbLines = Math.max(...TONES.map((tn) => wrapCount(tn.blurb, blurbSize, WT.regular, cardW - 2 * padX)));
  // p-4 · the icon (size-5, mb-2) · the label · the blurb (mt-0.5)
  const cardH = Math.ceil(18 + icon + 10 + T.label * 1.2 + 4 + blurbSize * 1.28 * blurbLines + 18);
  const gridTop = tone.y + T.title * 1.35 + toneDesc;
  const shown = TONES;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: x, top: S.add.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Name and language</div>
      <div style={{ position: 'absolute', left: x, top: S.add.y + T.title * 1.35, width: w, ...ui(T.small, WT.regular), whiteSpace: 'normal', lineHeight: 1.3, color: APP.mutedFg }}>
        {NAME_DESC}
      </div>
      {f.map((it, i) => (
        <div key={it.label} style={{ position: 'absolute', left: x, top: fieldsTop + i * pitch, width: w }}>
          <div style={{ ...ui(T.label, WT.medium), color: APP.foreground }}>{it.label}</div>
          <div
            style={{
              marginTop: T.label * 0.5,
              height: fieldH,
              borderRadius: fieldH * 0.22,
              boxShadow: `inset 0 0 0 1.25px ${APP.border}`,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${fieldH * 0.3}px`,
              ...ui(T.body, WT.regular),
              color: APP.foreground,
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: tone.x, top: tone.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Tone</div>
      <div style={{ position: 'absolute', left: tone.x, top: tone.y + T.title * 1.35, width: descW, ...ui(T.small, WT.regular), whiteSpace: 'normal', lineHeight: 1.3, color: APP.mutedFg }}>
        {TONE_DESC}
      </div>
      {shown.map((tn, i) => {
        const cx = tone.x + (i % 2) * (cardW + gap);
        const cy = gridTop + Math.floor(i / 2) * (cardH + gap);
        const on = !!tn.on;
        return (
          <div
            key={tn.label}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: cardW,
              height: cardH,
              borderRadius: 18,
              boxShadow: `inset 0 0 0 2.5px ${on ? APP.primary : APP.border}`,
              background: on ? 'rgba(124, 58, 237, 0.05)' : APP.card,
              padding: `18px ${padX}px`,
              boxSizing: 'border-box',
            }}
          >
            <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={on ? APP.primary : APP.mutedFg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', marginBottom: 10 }} aria-hidden>
              {TONE_ICON[tn.icon]}
            </svg>
            <div style={{ ...ui(T.label, WT.medium), color: APP.foreground }}>{tn.label}</div>
            <div style={{ marginTop: 4, ...ui(blurbSize, WT.regular), whiteSpace: 'normal', lineHeight: 1.28, color: APP.mutedFg }}>{tn.blurb}</div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 9:16 General — THE WHOLE TAB in one column (written/stage.ts 9:16 FULL-TAB SPEC): "Name and language" and its
 * description; Agent name | Language side by side (two columns: the phone frame's width, not its height); "Tone" and its
 * description; the four tone cards in a 2 × 2 grid — each card's icon beside its name, the blurb under them (the app's
 * card, its icon moved up beside the name so all four fit). Every block is laid out from the measured wraps, so nothing
 * is ever cut by the panel's edge.
 */
const GeneralPortrait: React.FC<{ S: WrittenStage }> = ({ S }) => {
  const T = S.type;
  const x = S.add.x;
  const w = S.add.w;
  const fieldH = S.inputH;
  const descLH = T.small * 1.3;
  // (the gaps: the panel's spare height — ≈ 75 px with the description on one line — shared between the blocks; a
  // two-line description still ends the grid ≈ 20 px inside the written panel's bottom edge)
  const fieldsTop = S.add.y + T.title * 1.35 + descLH * wrapCount(NAME_DESC, T.small, WT.regular, w) + 28;
  const colGap = 24;
  const colW = (w - colGap) / 2;
  // a field block: its label (the ui line, 1.2) + the label's half gap (16:9's marginTop) + the field
  const fieldBlock = T.label * 1.2 + T.label * 0.5 + fieldH;
  const toneY = fieldsTop + fieldBlock + 44;
  const gridTop = toneY + T.title * 1.35 + descLH * wrapCount(TONE_DESC, T.small, WT.regular, w) + 28;
  const gap = 16;
  const cardW = (w - gap) / 2;
  const padX = 22;
  const padY = 20;
  const blurbSize = T.small - 2;
  const icon = Math.round(T.label * 1.3);
  const blurbLines = Math.max(...TONES.map((tn) => wrapCount(tn.blurb, blurbSize, WT.regular, cardW - 2 * padX)));
  const headH = Math.max(icon, T.label * 1.2);
  const cardH = Math.ceil(padY + headH + 8 + blurbSize * 1.28 * blurbLines + padY);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: x, top: S.add.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Name and language</div>
      <div style={{ position: 'absolute', left: x, top: S.add.y + T.title * 1.35, width: w, ...ui(T.small, WT.regular), whiteSpace: 'normal', lineHeight: 1.3, color: APP.mutedFg }}>
        {NAME_DESC}
      </div>
      {FIELDS.map((it, i) => (
        <div key={it.label} style={{ position: 'absolute', left: x + i * (colW + colGap), top: fieldsTop, width: colW }}>
          <div style={{ ...ui(T.label, WT.medium), color: APP.foreground }}>{it.label}</div>
          <div
            style={{
              marginTop: T.label * 0.5,
              height: fieldH,
              borderRadius: fieldH * 0.22,
              boxShadow: `inset 0 0 0 1.25px ${APP.border}`,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${fieldH * 0.3}px`,
              ...ui(T.body, WT.regular),
              color: APP.foreground,
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: x, top: toneY, ...ui(T.title, WT.medium), color: APP.foreground }}>Tone</div>
      {/* (pretty: the column's full measure, never a one-word last line — balance halved it; refix-1) */}
      <div style={{ position: 'absolute', left: x, top: toneY + T.title * 1.35, width: w, ...ui(T.small, WT.regular), whiteSpace: 'normal', textWrap: 'pretty', lineHeight: 1.3, color: APP.mutedFg }}>
        {TONE_DESC}
      </div>
      {TONES.map((tn, i) => {
        const cx = x + (i % 2) * (cardW + gap);
        const cy = gridTop + Math.floor(i / 2) * (cardH + gap);
        const on = !!tn.on;
        return (
          <div
            key={tn.label}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: cardW,
              height: cardH,
              borderRadius: 20,
              boxShadow: `inset 0 0 0 2.5px ${on ? APP.primary : APP.border}`,
              background: on ? 'rgba(124, 58, 237, 0.05)' : APP.card,
              padding: `${padY}px ${padX}px`,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: headH }}>
              <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={on ? APP.primary : APP.mutedFg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }} aria-hidden>
                {TONE_ICON[tn.icon]}
              </svg>
              <div style={{ ...ui(T.label, WT.medium), color: APP.foreground }}>{tn.label}</div>
            </div>
            {/* (balanced: two even lines, never a one-word last line — the line count stays wrapCount's) */}
            <div style={{ marginTop: 8, ...ui(blurbSize, WT.regular), whiteSpace: 'normal', textWrap: 'balance', lineHeight: 1.28, color: APP.mutedFg }}>{tn.blurb}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ── the drop zone (9:16 compact: the icon beside the words, the hint under them — the whole Knowledge tab fits) ── */
const DropZone: React.FC<{ S: WrittenStage; hover: number }> = ({ S, hover }) => {
  const d = S.drop;
  const T = S.type;
  const r = Math.min(26, d.h * 0.16);
  const stroke = mixColor(APP.border, '#b9b2c8', hover);
  const icon = d.compact ? Math.round(T.body * 1.05) : 46;
  return (
    <div style={{ ...inBox(d) }}>
      <svg width={d.w + 2} height={d.h + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={1.25} y={1.25} width={d.w - 2.5} height={d.h - 2.5} rx={r} ry={r} fill={hover > 0.001 ? `rgba(244, 242, 247, ${(0.3 * hover).toFixed(3)})` : 'none'} stroke={stroke} strokeWidth={2.5} strokeDasharray="9 7" />
      </svg>
      {d.compact ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <UploadIcon size={icon} color={APP.mutedFg} />
            <div style={{ ...ui(T.body, WT.medium), color: APP.foreground }}>Drop files here or choose them</div>
          </div>
          <div style={{ ...ui(T.small - 1, WT.regular), color: APP.mutedFg }}>PDF, Word, TXT or Markdown · up to 10 MB each</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <UploadIcon size={icon} color={APP.mutedFg} />
          <div style={{ ...ui(T.body, WT.medium), color: APP.foreground }}>Drop files here or choose them</div>
          <div style={{ ...ui(T.small - 1, WT.regular), color: APP.mutedFg, marginTop: -4 }}>PDF, Word, TXT or Markdown · up to 10 MB each</div>
        </div>
      )}
    </div>
  );
};

/* ── the web page field: placeholder, focus ring, one character per 16th, the caret; cleared once the page is in ── */
const UrlField: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const f = S.field;
  const size = S.type.url;
  const mono = { size, weight: 460, mono: true } as const;
  const padX = f.h * 0.3;
  let n = 0;
  for (const k of W.keys) if (k <= t) n++;
  const text = W.url.slice(0, n);
  const cleared = t >= W.rows[3];
  const clearQ = tween(t, [W.rows[3], W.rows[3] + 6], [0, 1], EASE.in3);
  // focus: on the press (mousedown); blur when the button is pressed (focus moves to it)
  const focus = t >= W.field.down ? (t < W.add.down ? smooth(W.field.down, W.field.down + CURSOR.hoverDur, t) : 1 - smooth(W.add.down, W.add.down + 6, t)) : 0;
  const caretOn = t >= W.field.down && t < W.add.down;
  const typing = t >= W.keys[0] - 0.5 && t < W.keys[W.keys.length - 1] + 6;
  const idleFrom = t < W.keys[0] ? W.field.down : W.keys[W.keys.length - 1] + 6;
  const blink = typing ? 1 : (() => {
    const ph = (((t - idleFrom) % 30) + 30) % 30;
    return ph < 15 ? smooth(0, 1.5, ph) : 1 - smooth(15, 16.5, ph);
  })();
  const caretX = padX + (n > 0 ? measureText(text, mono) : 0) + 1;
  const placeholderO = n === 0 ? 1 : cleared ? smooth(W.rows[3] + 4, W.rows[3] + 9, t) : 0;
  return (
    <div
      style={{
        ...inBox(f),
        borderRadius: f.h * 0.22,
        background: APP.background,
        boxShadow: [`inset 0 0 0 1.25px ${mixColor(APP.border, APP.primary, focus)}`, focus > 0.001 ? `0 0 0 3.5px rgba(124, 58, 237, ${(0.2 * focus).toFixed(3)})` : ''].filter(Boolean).join(', '),
        overflow: 'hidden',
      }}
    >
      {placeholderO > 0.001 ? (
        <div style={{ position: 'absolute', left: padX, top: 0, height: f.h, display: 'flex', alignItems: 'center', ...ui(size, 440, { mono: true }), color: PLACEHOLDER_INK, opacity: placeholderO >= 0.999 ? undefined : placeholderO }}>{PLACEHOLDER}</div>
      ) : null}
      {n > 0 && clearQ < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: padX,
            top: 0,
            height: f.h,
            display: 'flex',
            alignItems: 'center',
            ...ui(size, 460, { mono: true }),
            color: APP.foreground,
            opacity: clearQ > 0 ? 1 - smooth(0.2, 1, clearQ) : undefined,
            ...subpixel(clearQ > 0 ? `translateY(${(-clearQ * 0.5 * f.h).toFixed(3)}px)` : undefined, clearQ > 0),
          }}
        >
          {text}
        </div>
      ) : null}
      {caretOn ? <div style={{ position: 'absolute', left: caretX, top: (f.h - size * 1.2) / 2, width: 2.5, height: size * 1.2, background: APP.foreground, opacity: blink }} /> : null}
    </div>
  );
};

/* ── Add page: disabled (50 %) while the field is empty, hover / press from the pointer; once the page is in, the
 *    field clears and it is disabled again (the app's "Adding…" lasts a 16th here: not shown, it would only flash) ── */
const AddPage: React.FC<{ t: number; S: WrittenStage; keys: readonly CursorKey[] }> = ({ t, S, keys }) => {
  const b = S.button;
  const size = S.type.body;
  const done = W.rows[3];
  const enabled = t >= W.keys[0] && t < done;
  const en = t < W.keys[0] ? 0 : t < done ? smooth(W.keys[0], W.keys[0] + 3, t) : 1 - smooth(done, done + 4, t);
  const hov = enabled ? hoverAt(keys, t, b) : 0;
  const prs = pressAt(keys, t, b);
  const sc = 1 - (1 - CURSOR.targetScale) * prs;
  const bg = mixColor(mixColor(APP.primary, APP.primaryStrong, hov), '#000000', 0.08 * prs);
  return (
    <div
      style={{
        ...inBox(b),
        borderRadius: b.h * 0.22,
        background: bg,
        color: APP.primaryFg,
        ...ui(size, WT.medium),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: 0.5 + 0.5 * en,
        transformOrigin: '50% 50%',
        ...subpixel(Math.abs(sc - 1) > 1e-4 ? `scale(${sc.toFixed(5)})` : undefined, Math.abs(sc - 1) > 1e-4),
      }}
    >
      <Icon name="link2" size={size * 1.05} stroke={2.2} />
      <span>Add page</span>
    </div>
  );
};

/* ── Knowledge ── */
const Knowledge: React.FC<{ t: number; S: WrittenStage; keys: readonly CursorKey[] }> = ({ t, S, keys }) => {
  const T = S.type;
  const dropHover = hoverAt(keys, t, S.drop);
  // the empty state: only while the list is empty — it leaves up through its mask and is gone (9 f) BEFORE the first
  // row lands, so that row lands into an empty list (truth table #6: the title never shows beside a document)
  const emptyOut = W.rows[0] - 10;
  const er = reveal(t, -100, { rise: 60, exit: { at: emptyOut, dur: 9 } });
  const listMid = (S.list.y + S.list.bottom) / 2;
  const emptyIcon = 60;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: S.add.x, top: S.add.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Add knowledge</div>
      <DropZone S={S} hover={dropHover} />
      {S.divider ? (
        <div style={{ position: 'absolute', left: S.add.x, top: S.divider.y, width: S.add.w, display: 'flex', alignItems: 'center', gap: 16, ...ui(T.small, WT.regular), color: APP.mutedFg }}>
          <span style={{ flex: 1, height: 1.25, background: APP.border }} />
          or add a web page
          <span style={{ flex: 1, height: 1.25, background: APP.border }} />
        </div>
      ) : null}
      {S.fieldLabel ? <div style={{ position: 'absolute', left: S.add.x, top: S.fieldLabel.y, ...ui(T.label, WT.medium), color: APP.foreground }}>Web page address</div> : null}
      <UrlField t={t} S={S} />
      <AddPage t={t} S={S} keys={keys} />
      <div style={{ position: 'absolute', left: S.docs.x, top: S.docs.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Your documents</div>
      {er.opacity > 0.001 ? (
        <div style={{ position: 'absolute', left: S.list.x, top: listMid - emptyIcon * 1.2, width: S.list.w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <span style={{ ...maskBox(0), display: 'block' }}>
            <span style={{ ...revealStyle(er, undefined, t > emptyOut - 1), display: 'block' }}>
              <span style={{ display: 'flex', width: emptyIcon * 1.7, height: emptyIcon * 1.7, borderRadius: '50%', background: APP.muted, alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <Icon name="bookOpen" size={emptyIcon * 0.8} color={APP.mutedFg} />
              </span>
            </span>
          </span>
          <span style={{ ...maskBox(0), display: 'block' }}>
            <span style={{ ...revealStyle(reveal(t, -100, { rise: 90, exit: { at: emptyOut + 1, dur: 9 } }), undefined, t > emptyOut - 1), display: 'block', ...ui(S.vertical ? 40 : 32, WT.medium), color: APP.foreground, opacity: 0.4 }}>
              Teach your agent about your business
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The panel. `children` are the list's rows (frame px), drawn over the panel in both framings (fix:written: 9:16's
 * content no longer scrolls under the tab bar — the whole tab fits the panel). `cursor` keys are frame px at their own
 * times.
 */
export const AppPanel: React.FC<{ t: number; S: WrittenStage; bar: TabBarGeometry; keys: readonly CursorKey[]; ink: string; children?: React.ReactNode }> = ({ t, S, bar, keys, ink, children }) => {
  const pp = panelPose(t, S);
  if (!pp.on) return null;
  const P = S.panel;
  const barH = bar.height;
  const cx = P.x;
  const cy = P.y + barH;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, ...subpixel(Math.abs(pp.dx) + Math.abs(pp.dy) > 0.01 ? `translate(${pp.dx.toFixed(3)}px, ${pp.dy.toFixed(3)}px)` : undefined, pp.moving) }}>
      <Panel x={P.x} y={P.y} w={P.w} h={P.h} radius={P.radius} lift={pp.lift} ink={ink}>
        {null}
      </Panel>
      <TabBar bar={bar} t={t} active={[{ at: -Infinity, tab: 'general' }, { at: W.tab.up, tab: 'knowledge' }]} cursor={keys} radius={P.radius} />
      <div style={{ position: 'absolute', left: cx, top: cy, width: P.w, height: P.h - barH, overflow: 'hidden', borderRadius: `0 0 ${P.radius}px ${P.radius}px` }}>
        <div style={{ position: 'absolute', left: -cx, top: -cy, width: S.W, height: S.H }}>
          <Swap t={t} at={W.tab.up}>
            {S.vertical ? <GeneralPortrait S={S} /> : <General S={S} />}
            <Knowledge t={t} S={S} keys={keys} />
          </Swap>
        </div>
      </div>
      {children}
    </div>
  );
};
