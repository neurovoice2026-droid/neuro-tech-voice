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
 * With room for v2's full order (LINE_LOCAL.full) the page comes back on Knowledge (b08's list at rest) and the pointer
 * clicks Conversation first: the underline springs across, the content swaps through its mask (the kit's Swap).
 */
import React, { useMemo } from 'react';
import { subpixel } from '../../../lib/glide';
import { smooth } from '../../../lib/motion';
import { APP, Button, buttonSize, CURSOR, hoverAt, Panel, pressAt, Swap, TabBar, ui, useKitFaces, useTabBar, W as WT, wrapWords, type CursorKey, type PillState, type Rect, type TabBarGeometry, type TabChange } from '../../kit';
import { LINE_LOCAL as N } from '../../timing';
import { Row } from '../written/Row';
import { ROWS, rowHeight, writtenStage } from '../written/stage';
import { Field, fieldSpec, type FieldGeo } from './Field';
import { Pointer } from './Pointer';
import { panelPose, type LineStage } from './stage';

/** the picture's strings (typographic apostrophes; the timing counts the same 22 words) */
export const OWNER_TEXT = N.ownerLine.replace(/'/g, '’');
export const PLACEHOLDER_TEXT = 'I don’t have that information, but I can take a message so the team calls you back.';
const TITLE = 'When your agent can’t help';
const DESCRIPTION = 'The exact words your agent uses. Leave a line empty to use the default in English.';
const LABEL = 'When the answer isn’t in your documents';

/** b08's rows at rest (FULL order only: the Knowledge tab the page comes back on) */
const READY: readonly (readonly PillState[])[] = ROWS.map((r) => [{ at: -1e6, kind: 'ready', n: r.n }]);
const NEWEST_FIRST = [3, 2, 1, 0] as const;

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
  const titleY = P.y + bar.height + (S.vertical ? 40 : 42);
  const descY = titleY + T.title * 1.34;
  const descH = T.small * 1.32 * wrapWords(DESCRIPTION, { size: T.small, weight: WT.regular }, cw).length;
  const labelY = descY + descH + (S.vertical ? 30 : 32);
  const fieldY = labelY + T.label * 1.2 + 14;
  const padX = S.fieldPad.x;
  const padY = S.fieldPad.y;
  const spec = fieldSpec(T.field);
  const inner = cw - 2 * padX;
  // 16:9 sets the line a sentence per row when both fit; otherwise (and in 9:16) a greedy wrap
  const sentences = OWNER_TEXT.split(/(?<=\.)\s+/);
  const perSentence = sentences.map((s) => wrapWords(s, spec, inner));
  const lines = S.sentenceRows && perSentence.every((l) => l.length === 1) ? perSentence.map((l) => l[0]) : wrapWords(OWNER_TEXT, spec, inner);
  const placeholderLines = wrapWords(PLACEHOLDER_TEXT, spec, inner);
  const rows = Math.max(lines.length, placeholderLines.length);
  const lineH = T.field * S.lineH;
  const fieldH = rows * lineH + 2 * padY;
  const field: FieldGeo = { x, y: fieldY, w: cw, h: fieldH, size: T.field, lineH, padX, padY, radius: S.vertical ? 18 : 16, lines, placeholderLines };
  const ruleY = fieldY + fieldH + (S.vertical ? 34 : 36);
  const bh = buttonSize('Save changes', 'primary', T.button).h;
  const btnY = ruleY + (S.vertical ? 22 : 20);
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
  const h = btnY + bh + (S.vertical ? 26 : 24) - P.y;
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
    click: { x: field.x + field.w * S.click.fx, y: field.y + field.h * S.click.fy },
  };
}

/** the pointer's whole performance (frame px at the page's rest place; it rides the page's transform). Each move INTO a
 *  press ends on a dwell key (> CURSOR.pressLead before the press): kit/cursor.ts cursorPos() falls back to the previous
 *  key between a move's end and its key's `at`, so a press key alone would jump back for those frames. */
export function cursorKeys(G: PageGeo): CursorKey[] {
  const f = G.click;
  const s = { x: G.save.x + G.save.w * 0.5, y: G.save.y + G.save.h * 0.56 };
  const field = N.field;
  const save = N.saveClick;
  const keys: CursorKey[] = [];
  if (N.tab) {
    const tc = G.bar.rect('conversation', N.tab.down);
    const tab = { x: tc.cx + 6, y: tc.cy + 5 };
    keys.push({ at: 0, x: tab.x, y: tab.y });
    keys.push({ at: N.tab.down, x: tab.x, y: tab.y, action: 'press' });
    keys.push({ at: N.tab.up, x: tab.x, y: tab.y, action: 'release' });
    keys.push({ at: field.down - 6.5, x: f.x, y: f.y });
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
      <div style={{ position: 'absolute', left: G.desc.x, top: G.desc.y, width: G.desc.w, ...ui(T.small, WT.regular), whiteSpace: 'normal', lineHeight: 1.32, color: APP.mutedFg }}>{DESCRIPTION}</div>
      <div style={{ position: 'absolute', left: G.label.x, top: G.label.y, ...ui(T.label, WT.medium), color: APP.foreground }}>{LABEL}</div>
    </div>
  );
};

/** FULL order only: the Knowledge tab as b08 left it — "Your documents", the four rows Ready, newest first (single-line
 *  rows, the app's phone layout, so the list fits the page's height in both orientations) */
const Knowledge: React.FC<{ G: PageGeo; S: LineStage }> = ({ G, S }) => {
  const WS = writtenStage(S.vertical);
  const T = S.type;
  const top = G.title.y;
  const size = S.vertical ? WS.row.size : 30;
  const h = rowHeight('inline', size);
  const gap = S.vertical ? WS.row.gap : 12;
  const listY = top + T.title * 1.5;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: G.title.x, top, ...ui(T.title, WT.medium), color: APP.foreground }}>Your documents</div>
      {NEWEST_FIRST.map((i, k) => (
        <Row key={ROWS[i].name} t={0} x={G.title.x} y={listY + k * (h + gap)} w={G.desc.w} h={h} layout="inline" size={size} kind={ROWS[i].kind} name={ROWS[i].name} pill={READY[i]} />
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
      {/* the I-beam exactly while the hotspot is over the textarea (a browser's cursor: text), the arrow elsewhere */}
      <Pointer keys={keys} t={t} text={hoverAt(keys, t, G.field, CURSOR.kindDur)} />
    </div>
  );
};
