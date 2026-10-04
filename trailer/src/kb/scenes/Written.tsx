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
 *   born       the pile draws its edges into a document row: TXT · Opening hours, Reading…
 *   "prices"   PDF · Price list lands in the list (newest on top); the empty state leaves; the Knowledge
 *              badge opens at 1 — the tabs after it slide over; a beat later its pill rolls to Ready
 *   "hours"    the Opening hours row flies from the corner and slots in on top (badge 2)
 *   "policies" DOCX · Cancellation policy (badge 3); the cursor has clicked into the web page field (I-beam)
 *              and types https://your-site/faq, one character per 32nd (Add page wakes on the first)
 *   "website"  Add page: pressed, released → "Adding…", then URL · FAQ page lands (badge 4), the field clears
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
import { click, Cursor, meshElevation, meshShadowInk, useTabBar, type CursorKey, type PillState, type TabBarGeometry } from '../kit';
import { HOME, KB_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { BEAT, WRITTEN_LOCAL as W } from '../timing';
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
const S32 = BEAT / 8;

/** each row's pill over time (the counts are illustrative, SCRIPT.md b08) */
const PILLS: readonly (readonly PillState[])[] = [
  [{ at: W.rows[0], kind: 'reading' }, { at: W.ready[0], kind: 'ready', n: ROWS[0].n }],
  [{ at: W.born, kind: 'reading' }, { at: W.ready[1], kind: 'ready', n: ROWS[1].n }],
  [{ at: W.rows[2], kind: 'reading' }, { at: W.ready[2], kind: 'ready', n: ROWS[2].n }],
  [{ at: W.rows[3], kind: 'readingPage' }, { at: W.ready[3], kind: 'ready', n: ROWS[3].n }],
];

/** the pointer's whole performance (frame px; the panel is at rest from WRITTEN_LOCAL.panel[1]). Every click
 *  has a dwell longer than CURSOR.pressLead: kit/cursor.ts cursorPos() falls back to the PREVIOUS key between a
 *  move's end and its key's `at`, so a press without a dwell key would jump back for those 6 frames. */
function cursorKeys(S: WrittenStage, bar: TabBarGeometry): CursorKey[] {
  const tk = bar.rect('knowledge', W.tab.down);
  const tab = { x: tk.cx + 6, y: tk.cy + 5 };
  // after the tab: a small drift down onto the panel's quiet heading row (16:9 just right of "Your documents", clear of
  // the list where the Opening hours row will fly in; 9:16 right of "Add knowledge"), then hidden until the row has landed
  const rest1 = S.vertical ? { x: tab.x + 40, y: tab.y + 84 } : { x: S.docs.x + 280, y: S.docs.y - 6 };
  const field = { x: S.field.x + S.field.w * (S.vertical ? 0.62 : 0.58), y: S.field.y + S.field.h * 0.52 };
  const btn = { x: S.button.x + S.button.w * 0.5, y: S.button.y + S.button.h * 0.56 };
  const rest2 = S.vertical ? { x: btn.x - 40, y: btn.y + 150 } : { x: btn.x + 190, y: btn.y + 96 };
  const hold = W.tab.up - W.tab.down;
  const lastKey = W.keys[W.keys.length - 1];
  return [
    { at: 0, x: S.enter.x, y: S.enter.y },
    ...click(W.tab.down, tab.x, tab.y, { dwell: 8, hold }),
    { at: W.tab.up + 14, x: rest1.x, y: rest1.y },
    { at: W.tab.up + 18, x: rest1.x, y: rest1.y, action: 'hide' },
    { at: W.fly[1] + 1, x: rest1.x, y: rest1.y, action: 'show' },
    ...click(W.field.down, field.x, field.y, { dwell: 8, hold: W.field.up - W.field.down, kind: 'text' }),
    { at: W.field.up + 1.5, x: field.x, y: field.y, action: 'type' },
    { at: lastKey + S32, x: field.x, y: field.y },
    ...click(W.add.down, btn.x, btn.y, { dwell: 7, hold: W.add.up - W.add.down, kind: 'arrow' }),
    { at: W.add.up + 16, x: rest2.x, y: rest2.y },
    { at: W.add.up + 19, x: rest2.x, y: rest2.y, action: 'hide' },
  ];
}

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
  const dy = -(1 - s) * 0.32 * S.row.h;
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
      opacity={smooth(0, 0.3, s)}
      scale={mix(0.985, 1, Math.min(1, s))}
      moving={moving}
    />
  );
};

/** TXT · Opening hours: born from the pile, then flown into the list on "hours" */
const HoursRow: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  if (t < W.born) return null;
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
        morph={u}
        slip={{ k: H.k, text: SLIP_TEXT, color: SLIP_INK, out: W.born }}
        slipRadius={H.radius}
        contentAt={W.born + 3}
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
      </AppPanel>
      <HoursRow t={t} S={S} />
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
      <Cursor keys={keys} t={t} />
    </AbsoluteFill>
  );
};
