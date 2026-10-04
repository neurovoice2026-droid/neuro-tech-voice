/**
 * PART III · b08 · WRITTEN ONCE (SCRIPT.md b08; CLIENT DIRECTION v2) — "Give me your answers once. Your prices,
 * your hours, your policies, pages from your website. That's your knowledge base."
 *
 *   0          b07's last picture: the seam draws back the way it came and her ground (KB_MESH) floods the
 *              other half; the orb glides to the corner; 16:9 the day's column glides in under it; the app
 *              comes in (16:9 from the right, where the matters side left; 9:16 up from under the seam): the
 *              agent page on General, its real tab bar
 *   tab        the cursor comes in from the edge, crosses to Knowledge (the tab lifts 60 → 100 % on hover),
 *              presses (.9 / .97 + shade, a 16th) and releases: the underline springs across, the content swaps
 *              to the Knowledge tab — "Add knowledge", the drop zone, the web page field, Add page (disabled:
 *              the field is empty), "Your documents" with its empty state
 *   "once"     the slips stack up into one (16:9 b07's column, 9:16 dropped in from above), one per 16th
 *   born       the pile draws its edges into a document row: Opening hours, Reading… · Text (the app's row:
 *              the FileText tile — Globe for a web page —, the name, the pill and its TYPE_LABELS word)
 *   "prices"   Price list (PDF) lands in the list (newest on top) — the empty state has left just before, so it
 *              lands into an empty list; the Knowledge badge opens at 1 — the tabs after it slide over; a beat
 *              later its pill rolls to Ready
 *   "hours"    the Opening hours row flies from the corner and slots in on top (badge 2)
 *   "policies" Cancellation policy (Word, badge 3); the cursor has clicked into the web page field (I-beam) and
 *              types your-site/faq bare (the app adds https://), one key per 16th (Add page wakes on the first)
 *   "website"  Add page: pressed, released (the pointer flicks off and fades), then FAQ page (Web page) lands
 *              (badge 4), the field clears
 *   "knowledge" the eyebrow ● KNOWLEDGE BASE rises above the panel; the caption keys "knowledge base." in sunday
 *
 * Every time is WRITTEN_LOCAL (src/kb/timing.ts, from kb2-vo-4's real word onsets); the layout and the poses are
 * scenes/written/stage.ts; the cut into b09 hands over writtenEnd() (stage.ts).
 */
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { reveal, revealStyle } from '../../components/Type';
import { useLayout } from '../../lib/layout';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { Captions } from '../components/Captions';
import { click, Cursor, EASE_HOVER, meshElevation, meshShadowInk, useTabBar, type CursorKey, type PillState, type TabBarGeometry } from '../kit';
import { HOME, KB_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { WRITTEN_LOCAL as W } from '../timing';
import { SEAM_ALPHA } from './turn/Seam';
import { turnStage } from './turn/stage';
import { WrittenGround } from './written/Ground';
import { WrittenOrb } from './written/Orb';
import { AppPanel } from './written/Panel';
import { Row } from './written/Row';
import { pileLift, SLIP_INK, SLIP_TEXT, slipHandoff, Slips } from './written/Slips';
import { BADGE, ease, orbPose, ROWS, rowTop, seamLeft, writtenStage, type WrittenStage } from './written/stage';

const SUNDAY_INK = MOMENT_LIGHTS.sunday.ink;
const INK = meshShadowInk(KB_MESH);

/** each row's pill over time (the counts are illustrative, SCRIPT.md b08) */
const PILLS: readonly (readonly PillState[])[] = [
  [{ at: W.rows[0], kind: 'reading' }, { at: W.ready[0], kind: 'ready', n: ROWS[0].n }],
  [{ at: W.born, kind: 'reading' }, { at: W.ready[1], kind: 'ready', n: ROWS[1].n }],
  [{ at: W.rows[2], kind: 'reading' }, { at: W.ready[2], kind: 'ready', n: ROWS[2].n }],
  [{ at: W.rows[3], kind: 'readingPage' }, { at: W.ready[3], kind: 'ready', n: ROWS[3].n }],
];

/** the pointer's whole performance (frame px; the panel is at rest from WRITTEN_LOCAL.panel[1]). Every click
 *  has a dwell longer than CURSOR.pressLead: kit/cursor.ts cursorPos() falls back to the PREVIOUS key between a
 *  move's end and its key's `at`, so a press without a dwell key would jump back for those 6 frames.
 *
 *  Its rests are chosen in SCREEN space, clear of every row, caption and label it could sit on:
 *    rest1  after the tab click the hand drifts down to the web page address (16:9 the white space right of "Web
 *           page address", 9:16 right of "Add knowledge", above the drop zone) and lifts off (hidden while the slips
 *           and the rows have the stage); it comes back THERE once the flying row is past it, holds still, then
 *           moves into the field at a calm, expert speed
 *    exit   after Add page it glides out to the right along the button (16:9 toward the gutter between the
 *           columns, 9:16 off the panel onto the mesh) and is gone (PointerExit) before it reaches any text and
 *           before the FAQ page lands under the field (9:16) */
const SHOW = 99;
function cursorKeys(S: WrittenStage, bar: TabBarGeometry): CursorKey[] {
  const tk = bar.rect('knowledge', W.tab.down);
  const tab = { x: tk.cx + 6, y: tk.cy + 5 };
  const rest1 = S.vertical ? { x: S.field.x + S.field.w + 60, y: S.add.y + 6 } : { x: S.field.x + S.field.w - 50, y: S.fieldLabel!.y - 22 };
  const field = { x: S.field.x + S.field.w * (S.vertical ? 0.93 : 0.58), y: S.field.y + S.field.h * 0.52 };
  const btn = { x: S.button.x + S.button.w * (S.vertical ? 0.42 : 0.5), y: S.button.y + S.button.h * 0.56 };
  const rest2 = S.vertical ? { x: S.panel.x + S.panel.w + 30, y: S.button.y + 10 } : { x: S.button.x + S.button.w + 24, y: S.button.y + 10 };
  const hold = W.tab.up - W.tab.down;
  const lastKey = W.keys[W.keys.length - 1];
  return [
    { at: 0, x: S.enter.x, y: S.enter.y },
    ...click(W.tab.down, tab.x, tab.y, { dwell: 8, hold }),
    { at: W.tab.up + 22, x: rest1.x, y: rest1.y },
    { at: W.tab.up + 25, x: rest1.x, y: rest1.y, action: 'hide' },
    { at: SHOW, x: rest1.x, y: rest1.y, action: 'show' },
    // still for a beat after it has faded in (≥ 5 f at rest), then into the field
    { at: SHOW + 6, x: rest1.x, y: rest1.y },
    ...click(W.field.down, field.x, field.y, { dwell: 7, hold: W.field.up - W.field.down, kind: 'text' }),
    { at: W.field.up + 1.5, x: field.x, y: field.y, action: 'type' },
    { at: lastKey + 0.5, x: field.x, y: field.y },
    ...click(W.add.down, btn.x, btn.y, { dwell: 7, hold: W.add.up - W.add.down, kind: 'arrow' }),
    // off the button the moment it comes up: a quick flick away (the hand leaves; 12 frames), faded on the way
    { at: W.add.up + 12, x: rest2.x, y: rest2.y, dur: 12 },
    { at: W.add.up + 13, x: rest2.x, y: rest2.y, action: 'hide' },
  ];
}

/** the pointer's exit after Add page: it fades WHILE it flicks away (kit/cursor.ts hides only at a key, i.e. at rest),
 *  from 5 frames after the release — once it is past the button's label — and is gone 11 frames after it, before
 *  any row, caption or label (9:16: before the FAQ page lands under the field, 3.75 f after the release) */
const exitFade = (t: number) => 1 - EASE_HOVER(Math.min(1, Math.max(0, (t - (W.add.up + 5)) / 6)));

/** b07's seam drawing back the way it came (turn/Seam.tsx's line: the feathers fixed to the full line) */
const SeamBack: React.FC<{ t: number; vertical: boolean; W: number; H: number }> = ({ t, vertical, W: FW, H: FH }) => {
  const q = seamLeft(t);
  if (q <= 0) return null;
  const { a, b } = turnStage(vertical).seam;
  const x = a.x + (b.x - a.x) * q;
  const y = a.y + (b.y - a.y) * q;
  const f = 0.07;
  const id = 'kb-written-seam';
  return (
    <svg width={FW} height={FH} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
          <stop offset={0} stopColor={HOME.ink} stopOpacity={0} />
          <stop offset={f} stopColor={HOME.ink} stopOpacity={SEAM_ALPHA} />
          <stop offset={1 - f} stopColor={HOME.ink} stopOpacity={SEAM_ALPHA} />
          <stop offset={1} stopColor={HOME.ink} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={a.x} y1={a.y} x2={x} y2={y} stroke={`url(#${id})`} strokeWidth={1.5} strokeLinecap="butt" />
    </svg>
  );
};

/** a row that lands in the list (Price list, Cancellation policy, the FAQ page) */
const ListRow: React.FC<{ t: number; S: WrittenStage; i: number }> = ({ t, S, i }) => {
  const at = W.rows[i];
  if (t < at - 0.5) return null;
  const s = springUnit(t - at, SPRING.land);
  const top = rowTop(i, t, S);
  // (9:16's tall ad-size rows drop in from just under the heading: never over it)
  const dy = -(1 - s) * (S.vertical ? 0.1 : 0.32) * S.row.h;
  const moving = top.moving || Math.abs(1 - s) > 1e-3;
  return (
    <Row
      t={t}
      x={S.list.x}
      y={top.y + dy}
      w={S.list.w}
      h={S.row.h}
      layout={S.row.layout}
      size={S.row.size}
      kind={ROWS[i].kind}
      name={ROWS[i].name}
      pill={PILLS[i]}
      pillSize={S.row.pill}
      opacity={smooth(0, 0.3, s)}
      scale={mix(0.985, 1, Math.min(1, s))}
      moving={moving}
    />
  );
};

/** TXT · Opening hours: born from the pile, then flown into the list on "hours". `part`: 'free' while it is its own
 *  paper (born, in flight; and always in 16:9), 'list' once it has landed in 9:16's scrolling list (drawn inside the
 *  panel's content box: it scrolls with the page and is cut by its edges as the rows below it are) */
const HoursRow: React.FC<{ t: number; S: WrittenStage; part: 'free' | 'list' }> = ({ t, S, part }) => {
  if (t < W.born) return null;
  const inList = !!S.scroll && t >= W.fly[1];
  if ((part === 'list') !== inList) return null;
  const H = slipHandoff(S);
  const u = ease(t, W.born, W.born + 9, EASE.inOut);
  const f = ease(t, W.fly[0], W.fly[1], EASE.inOut);
  const h = mix(H.h, S.row.h, u);
  const x0 = H.x;
  const y0 = H.y + (H.h - h) / 2;
  const top = rowTop(1, t, S);
  const bow = S.vertical ? 40 : 44;
  const x = mix(x0, S.list.x, f);
  const y = mix(y0, top.y, f) - bow * Math.sin(Math.PI * f);
  const w = mix(H.w, S.list.w, f);
  // the paper's lift: the pile's (thick, deepened) → a held row → raised in flight → set down flat in the list
  const pile = pileLift(W.born);
  const held = mix(pile.lift, 1.1, u);
  const lift = f <= 0 ? held : f < 1 ? mix(held, 0, f) + 2.6 * Math.sin(Math.PI * f) : 0;
  const shadowK = f < 1 ? 1 : 1 - smooth(W.fly[1], W.fly[1] + 6, t);
  const landed = t >= W.fly[1];
  const settle = landed ? springUnit(t - W.fly[1], SPRING.land) : 1;
  const moving = (f > 0 && f < 1) || top.moving || u < 1 || Math.abs(1 - settle) > 1e-3;
  return (
    <>
      {shadowK > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: w,
            height: h,
            borderRadius: mix(H.radius, S.row.size * 0.32, u),
            boxShadow: meshElevation(lift, INK, (f > 0 ? 1 : pile.k) * shadowK),
            transform: `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`,
          }}
        />
      ) : null}
      <Row
        t={t}
        x={x}
        y={y + (landed ? (1 - settle) * -4 : 0)}
        w={w}
        h={h}
        layout={S.row.layout}
        size={S.row.size}
        kind="txt"
        name={ROWS[1].name}
        pill={PILLS[1]}
        pillSize={S.row.pill}
        morph={u}
        // the slip's words leave as the row's own face arrives (a 16th's overlap): the paper is never blank
        slip={{ k: H.k, text: SLIP_TEXT, color: SLIP_INK, out: W.born + 1.5 }}
        slipRadius={H.radius}
        contentAt={W.born + 1}
        moving={moving}
      />
    </>
  );
};

/** ● KNOWLEDGE BASE — label role, a sunday dot, rising above the panel on "knowledge" */
const Eyebrow: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const L = useLayout();
  if (t < W.knowledge - 0.5) return null;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  const size = label.fontSize as number;
  const dot = Math.round(size * 0.34);
  const r = reveal(t, W.knowledge, { rise: 100, fade: 0.5 });
  return (
    <div style={{ position: 'absolute', left: S.eyebrow.x, top: S.eyebrow.y, transform: S.eyebrow.align === 'center' ? 'translateX(-50%)' : undefined }}>
      <span style={{ ...maskBox(0), display: 'block' }}>
        <span style={{ ...revealStyle(r, undefined, t - W.knowledge < 20), display: 'flex', alignItems: 'center', gap: '0.55em', ...label, color: HOME.ink, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: SUNDAY_INK, transform: 'translateY(-0.04em)' }} />
          KNOWLEDGE BASE
        </span>
      </span>
    </div>
  );
};

export const Written: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('written');
  const S = writtenStage(v);
  const orb = orbPose(t, S);
  const bar = useTabBar({ x: S.panel.x, y: S.panel.y, width: S.panel.w, size: S.tabs.size, icons: S.tabs.icons, badge: BADGE, pad: (S.tabs.padR * S.tabs.size) / 14 });
  const tk = bar.rect('knowledge', W.tab.down);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = useMemo(() => cursorKeys(S, bar), [v, tk.x, tk.y, tk.w, tk.h]);
  const keyK = tween(t, [W.knowledge, W.knowledge + 10], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      <WrittenGround t={t} S={S} orb={orb} />
      <SeamBack t={t} vertical={v} W={S.W} H={S.H} />
      <Slips t={t} S={S} />
      <AppPanel t={t} S={S} bar={bar} keys={keys} ink={INK}>
        {[0, 2, 3].map((i) => (
          <ListRow key={i} t={t} S={S} i={i} />
        ))}
        <HoursRow t={t} S={S} part="list" />
      </AppPanel>
      <HoursRow t={t} S={S} part="free" />
      <WrittenOrb t={t} S={S} />
      <Eyebrow t={t} S={S} />
      <Captions
        t={t}
        lineAt={W.vo4}
        voice="kb2-vo-4"
        captions={W.captions}
        x={S.caption.x}
        y={S.caption.y}
        maxWidth={S.caption.maxWidth}
        tone="paper"
        holdUntil={W.holdUntil}
        echoY={null}
        tint={(c, j) => (c === 3 && j >= 2 ? { color: SUNDAY_INK, k: keyK } : null)}
      />
      <div style={{ position: 'absolute', inset: 0, opacity: exitFade(t) < 0.999 ? exitFade(t) : undefined }}>
        <Cursor keys={keys} t={t} />
      </div>
    </AbsoluteFill>
  );
};
