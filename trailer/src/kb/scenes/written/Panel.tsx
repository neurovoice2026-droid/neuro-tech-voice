/**
 * THE APP — the agent page as a white panel on her mesh (CLIENT DIRECTION v2 §2): the real tab bar
 * (components/agent/AgentPageClient.tsx, components/ui/tabs.tsx line variant — the kit's TabBar) over the tab's
 * content, which SWAPS on the Knowledge click's release (the kit's Swap: the old content leaves up through the
 * box's mask, the new rises in):
 *
 *   General     (what the page opens on) components/agent/tabs/TabGeneral.tsx: "Name and language", the agent
 *               name and the language
 *   Knowledge   components/agent/tabs/TabKnowledge.tsx, verbatim strings:
 *                 AddKnowledgeCard   "Add knowledge"; the FileDropZone ("Drop files here or choose them", the
 *                                    hint "PDF, Word, TXT or Markdown · up to 10 MB each"); "or add a web page";
 *                                    "Web page address" + the field (placeholder https://yourbusiness.com/faq) +
 *                                    "Add page" (Link2) — disabled (50 %) while the field is empty, "Adding…" with
 *                                    the spinner while it adds, the field cleared when the page is in
 *                 Your documents     the EmptyState "Teach your agent about your business" while the list is
 *                                    empty (it leaves up as the first row lands); the rows are Written.tsx's
 *
 * 16:9 puts the two cards side by side (the panel is a wide desktop window); 9:16 stacks them as the app does on a
 * phone (the field and Add page in one row, the drop zone compact). Everything is laid out in FRAME px at the
 * panel's resting place; the whole panel rides one transform while it comes in (written/stage.ts panelPose).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { mixColor } from '../../../lib/lights';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
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

/* ── General (the tab the page opens on) ── */
const General: React.FC<{ S: WrittenStage }> = ({ S }) => {
  const T = S.type;
  const x = S.add.x;
  const w = S.vertical ? S.add.w : S.add.w + 52 + S.docs.w;
  const fieldH = S.field.h;
  const f = [
    { label: 'Agent name', value: 'Ava' },
    { label: 'Language', value: 'English' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: x, top: S.add.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Name and language</div>
      <div style={{ position: 'absolute', left: x, top: S.add.y + T.title * 1.35, ...ui(T.small, WT.regular), color: APP.mutedFg }}>How your agent introduces itself, and the language it speaks with callers.</div>
      {f.map((it, i) => (
        <div key={it.label} style={{ position: 'absolute', left: x, top: S.add.y + T.title * 1.35 + T.small * 2.6 + i * (fieldH + T.label * 2.6), width: w }}>
          <div style={{ ...ui(T.label, WT.medium), color: APP.foreground }}>{it.label}</div>
          <div
            style={{
              marginTop: T.label * 0.5,
              height: fieldH,
              borderRadius: fieldH * 0.24,
              boxShadow: `inset 0 0 0 1.25px ${APP.border}`,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${fieldH * 0.32}px`,
              ...ui(T.body, WT.regular),
              color: APP.foreground,
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── the drop zone ── */
const DropZone: React.FC<{ S: WrittenStage; hover: number }> = ({ S, hover }) => {
  const d = S.drop;
  const T = S.type;
  const r = Math.min(26, d.h * 0.16);
  const stroke = mixColor(APP.border, '#b9b2c8', hover);
  const icon = d.compact ? 38 : 46;
  return (
    <div style={{ ...inBox(d) }}>
      <svg width={d.w + 2} height={d.h + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={1.25} y={1.25} width={d.w - 2.5} height={d.h - 2.5} rx={r} ry={r} fill={hover > 0.001 ? `rgba(244, 242, 247, ${(0.3 * hover).toFixed(3)})` : 'none'} stroke={stroke} strokeWidth={2.5} strokeDasharray="9 7" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: d.compact ? 10 : 14 }}>
        <UploadIcon size={icon} color={APP.mutedFg} />
        <div style={{ ...ui(T.body, WT.medium), color: APP.foreground }}>Drop files here or choose them</div>
        {!d.compact ? <div style={{ ...ui(T.small, WT.regular), color: APP.mutedFg, marginTop: -4 }}>PDF, Word, TXT or Markdown · up to 10 MB each</div> : null}
      </div>
    </div>
  );
};

/* ── the web page field: placeholder, focus ring, one character per 32nd, the caret; cleared once the page is in ── */
const UrlField: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const f = S.field;
  const size = S.vertical ? 27 : 26;
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

/* ── Add page: disabled while the field is empty, hover / press from the pointer, "Adding…" while it adds ── */
const AddPage: React.FC<{ t: number; S: WrittenStage; keys: readonly CursorKey[] }> = ({ t, S, keys }) => {
  const b = S.button;
  const size = S.type.body;
  const enabled = t >= W.keys[0] && t < W.add.up;
  const en = t < W.keys[0] ? 0 : t < W.add.up ? smooth(W.keys[0], W.keys[0] + 3, t) : 1 - smooth(W.add.up, W.add.up + 3, t);
  const hov = enabled ? hoverAt(keys, t, b) : 0;
  const prs = pressAt(keys, t, b);
  const sc = 1 - (1 - CURSOR.targetScale) * prs;
  const bg = mixColor(mixColor(APP.primary, APP.primaryStrong, hov), '#000000', 0.08 * prs);
  const adding = t >= W.add.up && t < W.rows[3];
  // the label rolls: Add page → Adding… on the release, back as the page lands
  const at = t >= W.rows[3] ? W.rows[3] : t >= W.add.up ? W.add.up : null;
  const roll = at === null ? 1 : springUnit(t - at, SPRING.caption);
  const content = (busy: boolean, y: number, o: number) => (
    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: o >= 0.999 ? undefined : o, ...subpixel(Math.abs(y) > 0.01 ? `translateY(${y.toFixed(2)}%)` : undefined, Math.abs(y) > 0.01) }}>
      <Icon name={busy ? 'loader' : 'link2'} size={size * 1.05} stroke={2.2} rotate={busy ? ((t / 30) * 360) % 360 : undefined} />
      <span>{busy ? 'Adding…' : 'Add page'}</span>
    </span>
  );
  const prevBusy = at === W.rows[3];
  return (
    <div
      style={{
        ...inBox(b),
        borderRadius: b.h * 0.22,
        background: bg,
        color: APP.primaryFg,
        ...ui(size, WT.medium),
        overflow: 'hidden',
        opacity: 0.5 + 0.5 * en,
        transformOrigin: '50% 50%',
        ...subpixel(Math.abs(sc - 1) > 1e-4 ? `scale(${sc.toFixed(5)})` : undefined, Math.abs(sc - 1) > 1e-4),
      }}
    >
      {at !== null && roll < 0.999 ? content(prevBusy, -110 * roll, 1 - smooth(0.1, 0.6, roll)) : null}
      {content(adding, at !== null ? 110 * (1 - roll) : 0, at !== null ? smooth(0.1, 0.6, roll) : 1)}
    </div>
  );
};

/* ── Knowledge ── */
const Knowledge: React.FC<{ t: number; S: WrittenStage; keys: readonly CursorKey[] }> = ({ t, S, keys }) => {
  const T = S.type;
  const dropHover = hoverAt(keys, t, S.drop);
  // the empty state: only while the list is empty — it leaves up through its mask as the first row lands
  const emptyOut = W.rows[0] - 1;
  const er = reveal(t, -100, { rise: 60, exit: { at: emptyOut, dur: 9 } });
  const listMid = (S.list.y + S.list.bottom) / 2;
  const emptyIcon = S.vertical ? 52 : 60;
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
            <span style={{ ...revealStyle(reveal(t, -100, { rise: 90, exit: { at: emptyOut + 1, dur: 9 } }), undefined, t > emptyOut - 1), display: 'block', ...ui(S.vertical ? 30 : 32, WT.medium), color: APP.foreground, opacity: 0.4 }}>
              Teach your agent about your business
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
};

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
            <General S={S} />
            <Knowledge t={t} S={S} keys={keys} />
          </Swap>
        </div>
      </div>
      {children}
    </div>
  );
};
