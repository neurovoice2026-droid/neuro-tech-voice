/**
 * KB-Kit-16x9 / -9x16 (30 fps) and KB-Kit120-16x9 (120 fps): the shared kit's SPECIMEN — every part
 * animating, on its own clock (frame 0 = the specimen's start; the parts take any timeline time).
 *
 *   A   0–460   THE APP on the knowledge-base pearl: the pointer enters, hovers Knowledge, presses,
 *               releases → the underline slides, the panel swaps to the knowledge list; rows land,
 *               pills roll Reading… → Ready, the count badge ticks 1 → 4; the row's … menu opens,
 *               "Replace with new file" is clicked; Conversation is clicked, the field takes the
 *               I-beam, the owner's line types one word per 16th (the unsaved dot), Save is clicked
 *               (dot gone, "Saved"), the accent ring settles.
 *   B 460–620   PAPER on the muted mesh, keyed by the rose line light: six slips land, the flip window
 *               flips to the same word on the beat, the pile fans into one column, collapses into one.
 *   C 620–800   THE PAGE on the pearl: ink sweep, the hairline MATCHED ON MEANING link, the word re-set
 *               into the spoken sentence, the record row with its drawn check.
 *   D 800–900   BUTTONS on the deep night mesh (a designed lift + palette hand-off): primary,
 *               secondary, outline, the site's Start free — hover, press, release.
 */
import React, { useState } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FilmGrain } from '../../components/Grain';
import { reveal, revealStyle } from '../../components/Type';
import { waitForFonts } from '../../lib/fonts';
import { useLayout } from '../../lib/layout';
import { EASE, smooth, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { useSub } from '../scene';
import { HOME_KB_MESH, INK_MESH, MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { Cursor } from './Cursor';
import { click, clicksOf, hoverAt, pressAt, type CursorKey } from './cursor';
import { meshShadowInk } from './mesh';
import { MeshGround } from './MeshGround';
import { DocPage, FlipWord, MeaningLink, SlipStack, useDocPage, WordReset } from './paper';
import { TabBar, useTabBar, type TabChange } from './TabBar';
import { APP, Button, buttonSize, DocRow, docRowHeight, docRowMenuRect, FieldCard, Menu, Panel, RecordRow, Swap, useFieldCard, useMenu, type PillState } from './ui';
import { layoutWords, ui, W } from './type';

export const KIT_DURATION = 900;

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const RUSH = MOMENT_LIGHTS.rush;
const SLATE = '#4a5468';

const FALLBACK_PLACEHOLDER = 'I don’t have that information, but I can take a message so the team calls you back.';
const OWNER_LINE = 'I don’t have an answer for that, and I don’t want to guess. I’ll ask the team to call you back today.';

/** a block that rises in at `at` and leaves at `out` (chapter furniture) */
const Block: React.FC<{ t: number; at: number; out?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t, at, out, children, style }) => {
  const r = reveal(t, at, { rise: 40, exit: out !== undefined ? { at: out, dur: 8 } : undefined });
  if (r.opacity <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', ...style }}>
      <span style={{ ...maskBox(0), display: 'block' }}>
        <span style={{ ...revealStyle(r, undefined, true), display: 'block' }}>{children}</span>
      </span>
    </div>
  );
};

/** a measurement probe: the pointer alone on white (a long arc, a click, a return), for tracking its motion */
const CursorProbe: React.FC<{ t: number }> = ({ t }) => {
  const keys: CursorKey[] = [{ at: 0, x: 260, y: 300 }, { at: 40, x: 1500, y: 760 }, ...click(56, 1500, 760), { at: 100, x: 420, y: 880 }];
  return (
    <AbsoluteFill style={{ background: '#ffffff' }}>
      <Cursor keys={keys} t={t} />
    </AbsoluteFill>
  );
};

export const KitSpecimen: React.FC<{ probe?: 'cursor' }> = ({ probe }) => {
  useState(() => waitForFonts());
  const L = useLayout();
  const t = useCurrentFrame() / useSub();
  if (probe === 'cursor') return <CursorProbe t={t} />;
  const v = L.vertical;

  /* ── the ground: chapters hand the mesh on (palette mix + lift) ── */
  const toB = tween(t, [452, 476], [0, 1], EASE.inOut);
  const toC = tween(t, [612, 636], [0, 1], EASE.inOut);
  const toD = tween(t, [792, 822], [0, 1], EASE.inOut);
  const ground =
    t < 540
      ? { palette: HOME_KB_MESH, paletteB: MUTED_MESH, mix: toB, lift: 1 }
      : t < 720
        ? { palette: MUTED_MESH, paletteB: HOME_KB_MESH, mix: toC, lift: 1 }
        : { palette: HOME_KB_MESH, paletteB: INK_MESH, mix: toD, lift: 1 - toD };
  const ink = meshShadowInk(t < 540 ? HOME_KB_MESH : t < 720 ? MUTED_MESH : HOME_KB_MESH);
  const lineLight = { x: L.pick(1600, 880), y: L.pick(170, 260) };
  const roseKey = t >= 452 && t < 640 ? smooth(452, 480, t) * (1 - smooth(612, 636, t)) : 0;

  /* ── A: the app ── */
  const P = v ? { x: 64, y: 250, w: 952, h: 1120 } : { x: 230, y: 104, w: 1460, h: 872 };
  const bar = useTabBar({
    x: P.x,
    y: P.y,
    width: P.w,
    badge: [
      { at: 120, n: 1 },
      { at: 127.5, n: 2 },
      { at: 135, n: 3 },
      { at: 142.5, n: 4 },
    ],
    dirty: [
      { at: 306, tab: 'conversation', on: true },
      { at: 419, tab: 'conversation', on: false },
    ],
  });
  const tabK = bar.rect('knowledge', 48);
  const tabC = bar.rect('conversation', 268);
  const contentX = P.x + (v ? 40 : 64);
  const contentW = P.w - 2 * (v ? 40 : 64);
  const contentY = P.y + bar.height + (v ? 44 : 52);
  const rowSize = v ? 40 : 42;
  const rowH = docRowHeight(rowSize);
  const rowGap = v ? 16 : 14;
  const rowsY = contentY + (v ? 168 : 118);
  const ROWS: { kind: 'txt' | 'pdf' | 'docx' | 'url'; name: string; land: number; pill: PillState[] }[] = [
    { kind: 'txt', name: 'Opening hours', land: 120, pill: [{ at: 0, kind: 'reading' }, { at: 150, kind: 'ready', n: 1 }, { at: 214, kind: 'readingAgain' }, { at: 246, kind: 'ready', n: 1 }] },
    { kind: 'pdf', name: 'Price list', land: 127.5, pill: [{ at: 0, kind: 'reading' }, { at: 157.5, kind: 'ready', n: 2 }] },
    { kind: 'docx', name: 'Cancellation policy', land: 135, pill: [{ at: 0, kind: 'reading' }, { at: 165, kind: 'ready', n: 2 }] },
    { kind: 'url', name: 'FAQ page', land: 142.5, pill: [{ at: 0, kind: 'readingPage' }, { at: 172.5, kind: 'ready', n: 3 }] },
  ];
  const menuBtn = docRowMenuRect(contentX, rowsY, contentW, rowSize);
  const menu = useMenu({ x: menuBtn.x + menuBtn.w, y: menuBtn.y + menuBtn.h });
  const replace = menu.items[1];
  const field = useFieldCard({
    x: contentX,
    y: contentY + (v ? 20 : 10),
    w: contentW,
    label: 'When the answer isn’t in your documents',
    placeholder: FALLBACK_PLACEHOLDER,
    text: OWNER_LINE,
    size: v ? 44 : 46,
  });

  /* ── the pointer (its whole performance, as keys) ── */
  const off = v ? { x: 1180, y: 2050 } : { x: 2050, y: 1160 };
  const keysA: CursorKey[] = [
    { at: 14, x: off.x, y: off.y },
    ...click(48, tabK.cx + 6, tabK.cy + 4, { dwell: 10 }),
    { at: 92, x: tabK.cx + (v ? 60 : 180), y: tabK.cy + (v ? 260 : 300) },
    ...click(184, menuBtn.cx, menuBtn.cy + 2, { dwell: 12 }),
    ...click(214, replace.x + replace.w * 0.42, replace.cy + 2, { dwell: 10 }),
    { at: 240, x: replace.x + replace.w * 0.3, y: replace.cy + 90 },
    ...click(268, tabC.cx + 4, tabC.cy + 4, { dwell: 10 }),
    { at: 296, x: field.field.x + field.field.w * 0.62, y: field.field.cy + 6, kind: 'text' },
    { at: 302, x: field.field.x + field.field.w * 0.62, y: field.field.cy + 6, action: 'press' },
    { at: 305, x: field.field.x + field.field.w * 0.62, y: field.field.cy + 6, action: 'release' },
    { at: 306, x: field.field.x + field.field.w * 0.62, y: field.field.cy + 6, action: 'type' },
    { at: 392, x: field.field.x + field.field.w * 0.66, y: field.field.cy + 20 },
    ...click(416, field.save!.cx, field.save!.cy + 2, { dwell: 10, kind: 'arrow' }),
    { at: 446, x: off.x, y: off.y - 200 },
  ];
  const active: TabChange[] = [
    { at: -1, tab: 'general' },
    { at: 51, tab: 'knowledge' },
    { at: 271, tab: 'conversation' },
  ];
  const showA = t < 470;

  /* ── C: the page ── */
  const page = useDocPage(
    v
      ? { x: 64, y: 330, w: 952, title: 'Opening hours', kind: 'TXT', lines: ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'], size: 50 }
      : { x: 940, y: 150, w: 860, title: 'Opening hours', kind: 'TXT', lines: ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'], size: 50 },
  );
  const caller = v ? { x: 120, y: 1240, size: 60, maxW: 840 } : { x: 150, y: 330, size: 64, maxW: 700 };
  const cSpec = { size: caller.size, weight: 460, tracking: -0.02 };
  const cLay = layoutWords('Are you guys around', cSpec, caller.x);
  const cLay2 = layoutWords('this weekend?', cSpec, caller.x);
  const weekend = cLay2.words[1];
  const callerLine2Y = caller.y + caller.size * 1.18;
  const linkFrom = v ? { x: weekend.x + weekend.w * 0.5, y: caller.y - 90 } : { x: weekend.x + weekend.w * 0.55, y: callerLine2Y + caller.size * 1.1 + 22 };
  const sat = page.lineRects[1];
  const linkTo = v ? { x: sat.x + sat.w * 0.4, y: page.card.y + page.card.h + 14 } : { x: sat.x - 30, y: sat.cy + 4 };
  const resetTarget = v ? { x: 540, y: 1040, size: 60, maxWidth: 900 } : { x: 960, y: 680, size: 66, maxWidth: 1500 };
  const wSize = page.spec.size;

  /* ── D: buttons ── */
  const btnSize = v ? 34 : 36;
  const btns = [
    { label: 'Save', variant: 'primary' as const },
    { label: 'Read again', variant: 'secondary' as const },
    { label: 'Add page', variant: 'outline' as const },
    { label: 'Start free', variant: 'site' as const },
  ];
  const sizes = btns.map((b) => buttonSize(b.label, b.variant, btnSize));
  const gapB = v ? 0 : 48;
  const totalW = sizes.reduce((s, z) => s + z.w, 0) + gapB * (btns.length - 1);
  const btnRects = btns.map((_, i) => {
    if (v) {
      const z = sizes[i];
      return { x: 540 - z.w / 2, y: 760 + i * 170, w: z.w, h: z.h };
    }
    const x = 960 - totalW / 2 + sizes.slice(0, i).reduce((s, z) => s + z.w + gapB, 0);
    return { x, y: 600 - sizes[i].h / 2, w: sizes[i].w, h: sizes[i].h };
  });
  const keysD: CursorKey[] = [
    { at: 818, x: off.x, y: off.y },
    { at: 840, x: btnRects[0].x + btnRects[0].w * 0.5, y: btnRects[0].y + btnRects[0].h * 0.55 },
    { at: 850, x: btnRects[0].x + btnRects[0].w * 0.5, y: btnRects[0].y + btnRects[0].h * 0.55 },
    ...click(872, btnRects[3].x + btnRects[3].w * 0.4, btnRects[3].y + btnRects[3].h * 0.55, { dwell: 12 }),
  ];
  const keys = t < 600 ? keysA : keysD;

  // (listed for the cue sheet in the act builders: every click as down / up)
  void clicksOf;

  return (
    <AbsoluteFill style={{ background: APP.background }}>
      <MeshGround
        t={t}
        {...ground}
        keyLight={roseKey > 0 ? { ...lineLight, strength: 0.2 * roseKey, color: RUSH.orb[2], radius: L.pick(560, 520) } : { x: L.pick(560, 420), y: L.pick(240, 360), strength: 0.25 }}
      />

      {/* ═══ A — the app ═══ */}
      {showA ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - smooth(452, 466, t) }}>
          <Panel x={P.x} y={P.y} w={P.w} h={P.h} lift={3} ink={ink} dy={(1 - smooth(0, 14, t)) * 30} opacity={smooth(0, 8, t)}>
            {null}
          </Panel>
          <TabBar bar={bar} t={t} active={active} cursor={keysA} radius={L.pick(40, 34)} />
          {/* the tab content, swapped through its mask */}
          <div style={{ position: 'absolute', left: P.x, top: P.y + bar.height, width: P.w, height: P.h - bar.height, overflow: 'hidden', borderRadius: `0 0 ${L.pick(40, 34)}px ${L.pick(40, 34)}px` }}>
            <div style={{ position: 'absolute', left: -P.x, top: -(P.y + bar.height), width: L.width, height: L.height }}>
              <Swap t={t} at={52}>
                {/* General */}
                <div style={{ position: 'absolute', inset: 0 }}>
                  <div style={{ position: 'absolute', left: contentX, top: contentY, ...ui(v ? 40 : 42, W.medium), color: APP.foreground }}>Name and language</div>
                  {[
                    { label: 'Agent name', value: 'Ava' },
                    { label: 'Language', value: 'English' },
                  ].map((f, i) => (
                    <div key={f.label} style={{ position: 'absolute', left: contentX, top: contentY + 110 + i * 200, width: contentW }}>
                      <div style={{ ...ui(32, W.medium), color: APP.foreground }}>{f.label}</div>
                      <div style={{ marginTop: 18, height: 92, borderRadius: 18, boxShadow: `inset 0 0 0 1.25px ${APP.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', ...ui(40, W.regular), color: APP.foreground }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                {/* Knowledge + Conversation */}
                <Swap t={t} at={272}>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <div style={{ position: 'absolute', left: contentX, top: contentY, ...ui(v ? 40 : 42, W.medium), color: APP.foreground }}>Add knowledge</div>
                    <div style={{ position: 'absolute', left: contentX, top: contentY + (v ? 58 : 62), width: contentW, ...ui(v ? 30 : 31, W.regular), whiteSpace: 'normal', lineHeight: 1.3, color: APP.mutedFg }}>
                      Anything a caller might ask about: prices, services, hours, policies, directions.
                    </div>
                    {ROWS.map((r, i) => (
                      <DocRow
                        key={r.name}
                        t={t}
                        x={contentX}
                        y={rowsY + i * (rowH + rowGap)}
                        w={contentW}
                        kind={r.kind}
                        name={r.name}
                        pill={r.pill}
                        size={rowSize}
                        landAt={r.land}
                        menuHover={i === 0 ? hoverAt(keysA, t, menuBtn) : 0}
                        menuPress={i === 0 ? pressAt(keysA, t, menuBtn) : 0}
                      />
                    ))}
                  </div>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <FieldCard field={field} t={t} typeAt={306} focusAt={305} cursor={keysA} savedAt={419} accentRing={{ at: 432, color: SUNDAY }} ink={ink} lift={0.7} />
                  </div>
                </Swap>
              </Swap>
            </div>
          </div>
          <Menu menu={menu} t={t} openAt={187} closeAt={217} cursor={keysA} ink={ink} />
        </div>
      ) : null}

      {/* ═══ B — paper ═══ */}
      {t >= 466 && t < 640 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: smooth(466, 474, t) * (1 - smooth(612, 626, t)) }}>
          <Block t={t} at={478} out={604} style={{ left: v ? 86 : 150, top: v ? 300 : 150 }}>
            <div style={{ ...typeStyle('headline', v), color: APP.foreground }}>
              Some work <FlipWord t={t} word="repeats." flips={[495, 510, 525, 540, 555, 570, 585]} color={SLATE} />
            </div>
          </Block>
          <SlipStack
            t={t}
            x={v ? 160 : 1080}
            y={v ? 1420 : 820}
            w={v ? 760 : 760}
            text="Yes, Saturdays, nine till two."
            size={v ? 40 : 42}
            lands={[480, 487.5, 495, 502.5, 510, 517.5]}
            fanAt={540}
            column={v ? { x: 160, y: 560 } : { x: 1080, y: 250 }}
            collapseAt={582}
            ink={meshShadowInk(MUTED_MESH)}
            color={SLATE}
          />
        </div>
      ) : null}

      {/* ═══ C — the page ═══ */}
      {t >= 628 && t < 812 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: smooth(628, 636, t) * (1 - smooth(792, 806, t)) }}>
          <DocPage
            page={page}
            t={t}
            sweep={{ lines: [1, 2], at: 652, color: SUNDAY }}
            dim={{ lines: [0], at: 652 }}
            fade={1 - 0.75 * smooth(716, 730, t)}
            hide={t >= 716 ? [1, 2] : []}
            ink={ink}
            dy={(1 - smooth(628, 644, t)) * 40}
            lift={3}
          />
          {/* the caller's words (slate), "around this weekend" underlined */}
          {t < 724 ? (
            <div style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - smooth(714, 724, t) }}>
              <div style={{ position: 'absolute', left: caller.x, top: caller.y - 70, ...typeStyle('label', v), color: SLATE, whiteSpace: 'nowrap' }}>● CALLER</div>
              {[cLay.words, cLay2.words].map((line, li) =>
                line.map((w, wi) => (
                  <Block key={`${li}-${wi}`} t={t} at={636 + (li * 4 + wi) * 1.5} style={{ left: w.x, top: caller.y + li * caller.size * 1.18 }}>
                    <span style={{ ...typeStyle('caption', v, { size: caller.size }), letterSpacing: '-0.02em', color: SLATE, whiteSpace: 'nowrap' }}>{w.text}</span>
                  </Block>
                )),
              )}
              {/* the underline under "around this weekend": draws on "even when they put it differently" */}
              {[
                { x: cLay.words[3].x, w: cLay.words[3].w, y: caller.y + caller.size * 1.1 },
                { x: cLay2.words[0].x, w: cLay2.words[1].x + cLay2.words[1].w * 0.86 - cLay2.words[0].x, y: callerLine2Y + caller.size * 1.1 },
              ].map((u, i) => {
                const p = tween(t, [668 + i * 4, 676 + i * 4], [0, 1], EASE.draw);
                return <div key={i} style={{ position: 'absolute', left: u.x, top: u.y, width: u.w * p, height: 3, borderRadius: 2, background: SLATE, opacity: 0.8 }} />;
              })}
              <MeaningLink t={t} from={linkFrom} to={linkTo} at={682} dur={16} bend={v ? 0.16 : 0.3} side={v ? 'above' : 'below'} color={SLATE} width={2.2} tag="MATCHED ON MEANING" tagColor={APP.foreground} tagPos={v ? 0.5 : 0.42} tagOffset={v ? 0 : 34} exitAt={712} />
            </div>
          ) : null}
          {t >= 714 ? (
            <WordReset
              t={t}
              source={{ x: page.lineRects[1].x, y: page.lineRects[1].y, lines: ['Saturday · 9:00–14:00', 'Sunday · closed'], size: wSize, lineH: page.lineH }}
              target={{ text: 'We are! Saturday from nine till two. Sundays, we’re closed.', ...resetTarget, keys: [{ text: 'nine till two.', color: SUNDAY, at: 742 }] }}
              words={[{ at: 722 }, { at: 726 }, { at: 731, from: [0, 0] }, { at: 736 }, { at: 739 }, { at: 742 }, { at: 745 }, { at: 752, from: [1, 0] }, { at: 757 }, { at: 760, from: [1, 2] }]}
              leaveAt={720}
            />
          ) : null}
          <RecordRow
            t={t}
            x={v ? 64 : 580}
            y={v ? 1380 : 780}
            w={v ? 952 : 760}
            size={v ? 40 : 36}
            at={772}
            checkAt={780}
            accent={SUNDAY}
            ink={ink}
          />
        </div>
      ) : null}

      {/* ═══ D — buttons on the deep mesh ═══ */}
      {t >= 806 ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          {btns.map((b, i) => {
            const R = btnRects[i];
            const rv = reveal(t, 812 + i * 2, { rise: 30 });
            return (
              <div key={b.label} style={{ position: 'absolute', left: R.x, top: R.y, opacity: rv.opacity, transform: `translateY(${((1 - rv.p) * 30).toFixed(3)}px)` }}>
                <Button label={b.label} variant={b.variant} size={btnSize} hover={hoverAt(keysD, t, R)} press={pressAt(keysD, t, R)} />
              </div>
            );
          })}
        </div>
      ) : null}

      <Cursor keys={keys} t={t} />
      <FilmGrain white={t < 800 ? 1 : 1 - smooth(800, 822, t)} />
    </AbsoluteFill>
  );
};
