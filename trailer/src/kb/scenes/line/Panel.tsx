/**
 * THE AGENT PAGE on its Conversation tab — the app the owner filled in b08 (CLIENT DIRECTION v2 §2), as a white panel on
 * her mesh: the real tab bar (components/agent/AgentPageClient.tsx + components/ui/tabs.tsx line variant — the kit's
 * TabBar: General · Conversation · Voice · Knowledge · Skills, Knowledge's badge at 4, the amber unsaved-changes dot)
 * over TabConversation.tsx's card, verbatim strings:
 *
 *   CardTitle        "When your agent can't help"
 *   CardDescription  "The exact words your agent uses. Leave a line empty to use the default in English."
 *   Label + Textarea "When the answer isn't in your documents", placeholder = the product's default line
 *                    (lib/voice/prompt.ts:39); the helper text ("Your agent never guesses…") is deliberately not shown
 *                    (SCRIPT.md b12), nor the card's other field — the shot is this one line
 *   SaveBar          components/agent/SaveBar.tsx: border-t, Discard (outline) · Save changes (primary), both disabled
 *                    until there is something to save (16:9 right-aligned; 9:16 side by side, flex-1, as on a phone);
 *                    its status line is left out (one text moves at a time)
 *
 * THE POINTER rides on the page (it is part of the screen that rises in) and works it with two-part clicks: the I-beam
 * into the field, the arrow back off the keys to Save changes (kit/cursor.ts; the hover / press curves drive the button).
 * In v2's full order (LINE_LOCAL.full — on since b12's extra bar) the page comes back on Knowledge (b08's list at rest) and
 * the pointer settles onto Conversation and clicks it first: the underline springs across, the content swaps through its
 * mask (the kit's Swap).
 *
 * 9:16 (fix:line — the client: "in 9:16 the tab is not shown complete like in 16:9 while navigating"): the page is b08's
 * full-tab panel (line/stage.ts 9:16 PORTRAIT PAGE; written/stage.ts 9:16 FULL-TAB SPEC) and shows the WHOLE current tab
 * at every moment: it comes back on b08's whole Knowledge tab exactly as the written act left it (KnowledgePortrait — Add
 * knowledge, the drop zone, the web page field, Add page, Your documents, the four rows Ready at b08's slots: no list
 * scrolled under the tab bar, no row cut), and the Conversation tab fills the same fixed panel — title, description,
 * label, the field (a phrase per row) and the SaveBar pinned to the panel's foot. Nothing scrolls, nothing is cropped,
 * no camera pushes in.
 */
import React, { useMemo } from 'react';
import { subpixel } from '../../../lib/glide';
import { smooth } from '../../../lib/motion';
import { mixColor } from '../../../lib/lights';
import { APP, Button, buttonSize, hoverAt, Icon, measureText, Panel, pressAt, Swap, TabBar, ui, useKitFaces, useTabBar, W as WT, wrapWords, type CursorKey, type PillState, type Rect, type TabBarGeometry, type TabChange, type TextSpec } from '../../kit';
import { LINE_LOCAL as N, WRITTEN_LOCAL } from '../../timing';
import { Row } from '../written/Row';
import { ROWS, rowHeight, rowTop, writtenStage } from '../written/stage';
import { Field, fieldSpec, PLACEHOLDER_INK, type FieldGeo } from './Field';
import { Pointer } from './Pointer';
import { panelPose, type LineStage } from './stage';

/** the picture's strings (typographic apostrophes; the timing counts the same 22 words) */
export const OWNER_TEXT = N.ownerLine.replace(/'/g, '’');
export const PLACEHOLDER_TEXT = 'I don’t have that information, but I can take a message so the team calls you back.';
const TITLE = 'When your agent can’t help';
const DESCRIPTION = 'The exact words your agent uses. Leave a line empty to use the default in English.';
const LABEL = 'When the answer isn’t in your documents';
/** b08's web page field (written/Panel.tsx) */
const URL_PLACEHOLDER = 'https://yourbusiness.com/faq';

/** b08's rows at rest (FULL order only: the Knowledge tab the page comes back on) */
const READY: readonly (readonly PillState[])[] = ROWS.map((r) => [{ at: -1e6, kind: 'ready', n: r.n }]);
const NEWEST_FIRST = [3, 2, 1, 0] as const;

/**
 * 9:16: a PHRASE PER ROW — the text's clauses (each ending on , or .) packed into rows while they fit; a clause too wide
 * for a row alone is split into the fewest rows, at the break with the most even widths (no one-word last row). The
 * owner's line: "I don't have an answer for that," / "and I don't want to guess." / "I'll ask the team to" / "call you
 * back today." — each word still at its measured pen position (Field.tsx), so nothing reflows as the line is typed.
 */
export function phraseRows(text: string, spec: TextSpec, maxW: number): string[][] {
  const words = text.split(' ').filter(Boolean);
  const space = measureText('n n', spec) - measureText('nn', spec);
  const width = (ws: readonly string[]) => ws.reduce((a, w, i) => a + measureText(w, spec) + (i ? space : 0), 0);
  const fits = (ws: readonly string[]) => width(ws) <= maxW + 0.01;
  const clauses: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[,.;:!?]$/.test(w)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);
  // the fewest rows for a clause (greedy), then the split into that many with the smallest widest row
  const split = (ws: string[]): string[][] => {
    const k = wrapWords(ws.join(' '), spec, maxW).length;
    let best: { rows: string[][]; widest: number } | null = null;
    const walk = (from: number, left: number, acc: string[][]) => {
      if (left === 1) {
        const last = ws.slice(from);
        if (!last.length || !fits(last)) return;
        const rows = [...acc, last];
        const widest = Math.max(...rows.map(width));
        if (!best || widest < best.widest - 0.01) best = { rows, widest };
        return;
      }
      for (let end = from + 1; end < ws.length; end++) {
        const row = ws.slice(from, end);
        if (!fits(row)) break;
        walk(end, left - 1, [...acc, row]);
      }
    };
    walk(0, k, []);
    const found = best as { rows: string[][] } | null;
    return found ? found.rows : wrapWords(ws.join(' '), spec, maxW);
  };
  const rows: string[][] = [];
  for (const c of clauses) {
    const last = rows[rows.length - 1];
    if (last && fits([...last, ...c])) last.push(...c);
    else if (fits(c)) rows.push([...c]);
    else rows.push(...split(c));
  }
  return rows;
}

export type PageGeo = {
  bar: TabBarGeometry;
  panel: { x: number; y: number; w: number; h: number; radius: number };
  title: { x: number; y: number };
  desc: { x: number; y: number; w: number };
  label: { x: number; y: number };
  field: FieldGeo;
  rule: { y: number };
  discard: Rect;
  save: Rect;
  /** the I-beam's click point in the field */
  click: { x: number; y: number };
};

/** the page's layout at rest (frame px), measured in the house faces */
export function usePageGeometry(S: LineStage): PageGeo {
  useKitFaces();
  const P = S.panel;
  const T = S.type;
  const bar = useTabBar({
    x: P.x,
    y: P.y,
    width: P.w,
    size: S.tabs.size,
    icons: S.tabs.icons,
    pad: (S.tabs.padR * S.tabs.size) / 14,
    badge: [{ at: -1e6, n: 4 }],
    dirty: [
      { at: N.keys[0], tab: 'conversation', on: true },
      { at: N.saveClick.up, tab: 'conversation', on: false },
    ],
  });
  const x = P.x + S.pad;
  const cw = P.w - 2 * S.pad;
  // a fixed panel (9:16): its content starts where b08's Knowledge tab's does (written/stage.ts portraitPanel: bar + 24)
  const fixed = P.h > 0;
  const titleY = P.y + bar.height + (fixed ? 24 : S.vertical ? 40 : 42);
  const descY = titleY + T.title * 1.34;
  const descH = T.small * 1.32 * wrapWords(DESCRIPTION, { size: T.small, weight: WT.regular }, cw).length;
  const labelY = descY + descH + (S.vertical ? 30 : 32);
  const fieldY = labelY + T.label * 1.2 + 14;
  const padX = S.fieldPad.x;
  const padY = S.fieldPad.y;
  const spec = fieldSpec(T.field);
  const inner = cw - 2 * padX;
  // 16:9 sets the line a sentence per row when both fit, otherwise a greedy wrap; 9:16 a phrase per row (phraseRows)
  const sentences = OWNER_TEXT.split(/(?<=\.)\s+/);
  const perSentence = sentences.map((s) => wrapWords(s, spec, inner));
  const lines = S.phraseRows
    ? phraseRows(OWNER_TEXT, spec, inner)
    : S.sentenceRows && perSentence.every((l) => l.length === 1)
      ? perSentence.map((l) => l[0])
      : wrapWords(OWNER_TEXT, spec, inner);
  const placeholderLines = S.phraseRows ? phraseRows(PLACEHOLDER_TEXT, spec, inner) : wrapWords(PLACEHOLDER_TEXT, spec, inner);
  const rows = Math.max(lines.length, placeholderLines.length);
  const lineH = T.field * S.lineH;
  const bh = buttonSize('Save changes', 'primary', T.button).h;
  let fieldH = rows * lineH + 2 * padY;
  let ruleY: number;
  let btnY: number;
  if (fixed) {
    // 9:16: the SaveBar pinned to the panel's foot (its buttons end 34 px over the bottom edge, where b08's last row
    // does), the field filling down to 40 px over its hairline — never shorter than its rows
    btnY = P.y + P.h - 34 - bh;
    ruleY = btnY - 22;
    fieldH = Math.max(fieldH, ruleY - 40 - fieldY);
  } else {
    ruleY = fieldY + fieldH + (S.vertical ? 34 : 36);
    btnY = ruleY + (S.vertical ? 22 : 20);
  }
  const field: FieldGeo = { x, y: fieldY, w: cw, h: fieldH, size: T.field, lineH, padX, padY, radius: S.vertical ? 18 : 16, lines, placeholderLines };
  let discard: Rect;
  let save: Rect;
  const gap = (8 * T.button) / 14;
  if (S.saveBar === 'split') {
    const w = (cw - gap) / 2;
    discard = { x, y: btnY, w, h: bh };
    save = { x: x + w + gap, y: btnY, w, h: bh };
  } else {
    const sw = buttonSize('Save changes', 'primary', T.button).w;
    const dw = buttonSize('Discard', 'outline', T.button).w;
    save = { x: x + cw - sw, y: btnY, w: sw, h: bh };
    discard = { x: save.x - gap - dw, y: btnY, w: dw, h: bh };
  }
  const h = fixed ? P.h : btnY + bh + (S.vertical ? 26 : 24) - P.y;
  return {
    bar,
    panel: { x: P.x, y: P.y, w: P.w, h, radius: P.radius },
    title: { x, y: titleY },
    desc: { x, y: descY, w: cw },
    label: { x, y: labelY },
    field,
    rule: { y: ruleY },
    discard,
    save,
    click: { x: field.x + field.w * S.click.fx, y: S.click.row === undefined ? field.y + field.h * S.click.fy : field.y + padY + (S.click.row + 0.55) * lineH },
  };
}

/** the pointer's whole performance (frame px at the page's rest place; it rides the page's transform). Each move INTO a
 *  press ends on a dwell key (the read before the press): kit/cursor.ts cursorPos() falls back to the previous key between
 *  a move's end and its key's `at`, so a press key alone would jump back for those frames.
 *   enter    on the page: it comes up through the frame's bottom edge with it (the act's one scroll) and settles onto
 *            Conversation as the page lands, 4.5 f before the press (the brief's ≥ 4)
 *   tab      a crisp click (LINE_LOCAL.tab: 2.25 f down → up); the hand LEAVES a frame before the release, as a real hand
 *            does (the press names its own `up`, so the move may start under it)
 *   field    the crossing at its natural pace (≈ 22 f for ≈ 710 px: naturalMove ≈ 24), the field read 4.5 f, pressed and
 *            released (the caret, the first word); the I-beam exactly while the hotspot is inside the field's box
 *   Save     after the last word: a frame later it leaves the keys, reads Save changes 4.5 f, presses, releases, fades */
export function cursorKeys(G: PageGeo): CursorKey[] {
  const f = G.click;
  const s = { x: G.save.x + G.save.w * 0.5, y: G.save.y + G.save.h * 0.56 };
  const field = N.field;
  const save = N.saveClick;
  const keys: CursorKey[] = [];
  if (N.tab) {
    const tc = G.bar.rect('conversation', N.tab.down);
    const tab = { x: tc.cx + 6, y: tc.cy + 5 };
    // the hand comes up with the page just below the tab bar (over b08's list: it enters through the frame's bottom edge
    // on the screen) and settles up onto Conversation through the page's landing (the tab is entered, not found hovered),
    // then rests 4.5 frames on it before the press (the brief's ≥ 4; the act's grid keeps the press on beat 2)
    const from = { x: tab.x + 0.25 * tc.h, y: tab.y + 0.8 * tc.h };
    const settle = N.tab.down - 4.5;
    keys.push({ at: 0, x: from.x, y: from.y });
    keys.push({ at: settle, x: tab.x, y: tab.y, dur: 7, bend: 0.1 });
    keys.push({ at: N.tab.down, x: tab.x, y: tab.y, action: 'press', up: N.tab.up });
    // the crossing leaves a frame before the tab's release and arrives 4.5 f before the field's press
    const arrive = field.down - 4.5;
    keys.push({ at: arrive, x: f.x, y: f.y, dur: arrive - (N.tab.up - 1) });
  } else {
    keys.push({ at: 0, x: f.x, y: f.y });
  }
  keys.push({ at: field.down, x: f.x, y: f.y, action: 'press' });
  keys.push({ at: field.up, x: f.x, y: f.y, action: 'release' });
  keys.push({ at: field.up + 0.5, x: f.x, y: f.y, action: 'type' });
  keys.push({ at: N.hop[0], x: f.x, y: f.y });
  keys.push({ at: N.hop[1], x: s.x, y: s.y, dur: N.hop[1] - N.hop[0], bend: 0.12 });
  keys.push({ at: save.down, x: s.x, y: s.y, action: 'press' });
  keys.push({ at: save.up, x: s.x, y: s.y, action: 'release' });
  keys.push({ at: N.pointerOut, x: s.x, y: s.y, action: 'hide' });
  return keys;
}

/** the Conversation tab's content: the card's title, description, the field's label (the field itself is drawn on top) */
const Conversation: React.FC<{ G: PageGeo; S: LineStage }> = ({ G, S }) => {
  const T = S.type;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: G.title.x, top: G.title.y, ...ui(T.title, WT.medium), color: APP.foreground }}>{TITLE}</div>
      {/* (9:16: balanced — two even lines, no one-word last line; the line count stays usePageGeometry's wrap) */}
      <div style={{ position: 'absolute', left: G.desc.x, top: G.desc.y, width: G.desc.w, ...ui(T.small, WT.regular), whiteSpace: 'normal', textWrap: S.vertical ? 'balance' : undefined, lineHeight: 1.32, color: APP.mutedFg }}>{DESCRIPTION}</div>
      <div style={{ position: 'absolute', left: G.label.x, top: G.label.y, ...ui(T.label, WT.medium), color: APP.foreground }}>{LABEL}</div>
    </div>
  );
};

/** lucide Upload (24-unit box) — written/Panel.tsx's */
const UploadIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden>
    <path d="M12 3v12" />
    <path d="m17 8-5-5-5 5" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
);

/**
 * 9:16 (fix:line): b08's WHOLE Knowledge tab, at rest exactly as the written act leaves it (written/Panel.tsx Knowledge
 * at WRITTEN_LOCAL.end — the empty state gone, the web page field cleared back to its placeholder, Add page disabled, no
 * hover — and its four rows Ready at written/stage.ts rowTop(…, end): the call act's hand-over picture, call/Panel.tsx).
 * Every box is writtenStage(true)'s (the 9:16 FULL-TAB SPEC); the styles are written/Panel.tsx's at rest, so the page
 * that comes back is the page b08 showed.
 */
const KnowledgePortrait: React.FC = () => {
  const WS = writtenStage(true);
  const T = WS.type;
  const d = WS.drop;
  const f = WS.field;
  const b = WS.button;
  const end = WRITTEN_LOCAL.end;
  const r = Math.min(26, d.h * 0.16);
  const icon = Math.round(T.body * 1.05);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: WS.add.x, top: WS.add.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Add knowledge</div>
      {/* the drop zone (compact: the icon beside the words, the hint under them) */}
      <div style={{ position: 'absolute', left: d.x, top: d.y, width: d.w, height: d.h }}>
        <svg width={d.w + 2} height={d.h + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <rect x={1.25} y={1.25} width={d.w - 2.5} height={d.h - 2.5} rx={r} ry={r} fill="none" stroke={mixColor(APP.border, '#b9b2c8', 0)} strokeWidth={2.5} strokeDasharray="9 7" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <UploadIcon size={icon} color={APP.mutedFg} />
            <div style={{ ...ui(T.body, WT.medium), color: APP.foreground }}>Drop files here or choose them</div>
          </div>
          <div style={{ ...ui(T.small - 1, WT.regular), color: APP.mutedFg }}>PDF, Word, TXT or Markdown · up to 10 MB each</div>
        </div>
      </div>
      {WS.divider ? (
        <div style={{ position: 'absolute', left: WS.add.x, top: WS.divider.y, width: WS.add.w, display: 'flex', alignItems: 'center', gap: 16, ...ui(T.small, WT.regular), color: APP.mutedFg }}>
          <span style={{ flex: 1, height: 1.25, background: APP.border }} />
          or add a web page
          <span style={{ flex: 1, height: 1.25, background: APP.border }} />
        </div>
      ) : null}
      {/* the web page field, cleared (its placeholder back) */}
      <div style={{ position: 'absolute', left: f.x, top: f.y, width: f.w, height: f.h, borderRadius: f.h * 0.22, background: APP.background, boxShadow: `inset 0 0 0 1.25px ${mixColor(APP.border, APP.primary, 0)}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: f.h * 0.3, top: 0, height: f.h, display: 'flex', alignItems: 'center', ...ui(T.url, 440, { mono: true }), color: PLACEHOLDER_INK }}>{URL_PLACEHOLDER}</div>
      </div>
      {/* Add page, disabled again (50 %) */}
      <div
        style={{
          position: 'absolute',
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h,
          borderRadius: b.h * 0.22,
          background: mixColor(mixColor(APP.primary, APP.primaryStrong, 0), '#000000', 0),
          color: APP.primaryFg,
          ...ui(T.body, WT.medium),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: 0.5,
        }}
      >
        <Icon name="link2" size={T.body * 1.05} stroke={2.2} />
        <span>Add page</span>
      </div>
      <div style={{ position: 'absolute', left: WS.docs.x, top: WS.docs.y, ...ui(T.title, WT.medium), color: APP.foreground }}>Your documents</div>
      {ROWS.map((row, i) => (
        <Row key={row.name} t={end} x={WS.list.x} y={rowTop(i, end, WS).y} w={WS.list.w} h={WS.row.h} layout={WS.row.layout} size={WS.row.size} pillSize={WS.row.pill} kind={row.kind} name={row.name} pill={READY[i]} />
      ))}
    </div>
  );
};

/** FULL order only: the Knowledge tab as b08 left it — the four rows Ready, newest first (16:9: under "Your documents",
 *  single-line rows; 9:16: b08's WHOLE tab, KnowledgePortrait) */
const Knowledge: React.FC<{ G: PageGeo; S: LineStage }> = ({ G, S }) => {
  const T = S.type;
  const top = G.title.y;
  if (S.vertical) return <KnowledgePortrait />;
  // 16:9: single-line rows under "Your documents"
  const size = 30;
  const layout = 'inline';
  const pill = undefined;
  const h = rowHeight(layout, size, pill);
  const gap = 12;
  const listY = top + T.title * 1.5;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: G.title.x, top, ...ui(T.title, WT.medium), color: APP.foreground }}>Your documents</div>
      {NEWEST_FIRST.map((i, k) => (
        <Row key={ROWS[i].name} t={0} x={G.title.x} y={listY + k * (h + gap)} w={G.desc.w} h={h} layout={layout} size={size} pillSize={pill} kind={ROWS[i].kind} name={ROWS[i].name} pill={READY[i]} />
      ))}
    </div>
  );
};

/** the SaveBar: its hairline, Discard and Save changes (disabled → enabled on the first word → disabled again on Save) */
const SaveBar: React.FC<{ t: number; G: PageGeo; S: LineStage; keys: readonly CursorKey[] }> = ({ t, G, S, keys }) => {
  const P = G.panel;
  const on = t < N.keys[0] ? 0 : t < N.saveClick.up ? smooth(N.keys[0], N.keys[0] + 3, t) : 1 - smooth(N.saveClick.up, N.saveClick.up + 4, t);
  const enabled = t >= N.keys[0] && t < N.saveClick.up;
  const hov = enabled ? hoverAt(keys, t, G.save) : 0;
  const prs = pressAt(keys, t, G.save);
  const size = S.type.button;
  return (
    <>
      <div style={{ position: 'absolute', left: P.x, top: G.rule.y, width: P.w, height: 1.25, background: APP.border }} />
      <div style={{ position: 'absolute', left: G.discard.x, top: G.discard.y, opacity: 0.5 + 0.5 * on }}>
        <Button label="Discard" variant="outline" size={size} width={G.discard.w} />
      </div>
      <div style={{ position: 'absolute', left: G.save.x, top: G.save.y, opacity: 0.5 + 0.5 * on }}>
        <Button label="Save changes" variant="primary" size={size} hover={hov} press={prs} width={G.save.w} />
      </div>
    </>
  );
};

export const LinePanel: React.FC<{ t: number; S: LineStage; G: PageGeo; ink: string; accent: string }> = ({ t, S, G, ink, accent }) => {
  const pp = panelPose(t, S);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = useMemo(() => cursorKeys(G), [S.vertical, G.click.x, G.click.y, G.save.x, G.save.y, G.save.w, G.save.h]);
  if (!pp.on) return null;
  const P = G.panel;
  const barH = G.bar.height;
  const cy = P.y + barH;
  const active: readonly TabChange[] = N.tab
    ? [
        { at: -Infinity, tab: 'knowledge' },
        { at: N.tab.up, tab: 'conversation' },
      ]
    : [{ at: -Infinity, tab: 'conversation' }];
  const tf = `translate(0px, ${pp.dy.toFixed(3)}px)`;
  const content = <Conversation G={G} S={S} />;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, opacity: pp.opacity >= 0.999 ? undefined : pp.opacity, ...subpixel(Math.abs(pp.dy) > 0.01 ? tf : undefined, pp.moving) }}>
      <Panel x={P.x} y={P.y} w={P.w} h={P.h} radius={P.radius} lift={pp.lift} ink={ink}>
        {null}
      </Panel>
      <TabBar bar={G.bar} t={t} active={active} cursor={keys} radius={P.radius} />
      <div style={{ position: 'absolute', left: P.x, top: cy, width: P.w, height: P.h - barH, overflow: 'hidden', borderRadius: `0 0 ${P.radius}px ${P.radius}px` }}>
        <div style={{ position: 'absolute', left: -P.x, top: -cy, width: S.W, height: S.H }}>
          {N.tab ? (
            <Swap t={t} at={N.tab.up}>
              <Knowledge G={G} S={S} />
              <div style={{ position: 'absolute', inset: 0 }}>
                {content}
                <Field g={G.field} t={t} keys={N.keys} focusAt={N.field.down} blurAt={N.saveClick.down} accent={{ at: N.focus, color: accent }} vertical={S.vertical} />
                <SaveBar t={t} G={G} S={S} keys={keys} />
              </div>
            </Swap>
          ) : (
            <>
              {content}
              <SaveBar t={t} G={G} S={S} keys={keys} />
            </>
          )}
        </div>
      </div>
      {/* the field outside the content clip in the plain order (its accent ring draws past its edge) */}
      {N.tab ? null : <Field g={G.field} t={t} keys={N.keys} focusAt={N.field.down} blurAt={N.saveClick.down} accent={{ at: N.focus, color: accent }} vertical={S.vertical} />}
      {/* the I-beam exactly while the hotspot is over the textarea (a browser's cursor: text), the arrow elsewhere — the
          swap as the hotspot crosses the box's edge, in one frame (a browser swaps it at once) */}
      <Pointer keys={keys} t={t} text={hoverAt(keys, t, G.field, 1)} />
    </div>
  );
};
