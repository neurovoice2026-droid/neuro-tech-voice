/**
 * PART III · b13–b14 · CHANGE IT / THE NEXT CALL (SCRIPT.md b13–b14; CLIENT DIRECTION v2) — "Hours change? Change the
 * document. The next call gets the new answer." — and the next call does.
 *
 *   0          b12's last picture (its agent page, saved); the page recedes and eases out left as the OWNER'S OWN FILE
 *              eases in over it (one continuous hand-off): Opening hours.txt on plain paper, no app chrome (the edit
 *              happens outside the app), its words rising inside it. The pointer (hidden since Save) comes back as an I-beam once the page has settled
 *   "change?"  the caret clicks into "14:00": the I-beam presses, drags across the digits (the sunday wash, a character at
 *              a time) and lets go; "16:00" is typed over it in place, one key per 16th — the last on "Change"; the agent
 *              page rises on its KNOWLEDGE tab behind the file while the keys go in (the badge at 4)
 *   "Change the document"   the file steps up into the corner, revealing the app: "Your documents", newest first. The cursor presses the Opening hours row's … (two-part click), the
 *              menu opens from its trigger (Read again · Replace with new file · Remove) and "Replace with new file" is
 *              clicked (.97): the edited file DROPS INTO THE LIST's top slot — the new version, Reading…; the old row
 *              stays Ready (it keeps answering until the new one is read); the badge counts both: 5
 *   "the new answer"   the fifth Ready mallet: the new row rolls to Ready · 1 passage; the old row leaves up through its
 *              mask, the list closes, the badge goes back to 4
 *   ring       a beat before it the app steps back and slides away; the new row lifts out of it and unfolds into its page
 *              in one move (TXT · Opening hours — "Saturday · 9:00–16:00"); on beat 3 one slate hairline leaves Ava's orb as she
 *              glides to her call place; picked up an 8th later
 *   Dana       ● CALLER — b03's identical recording: "Quick one. / Can I pop in on Saturday?" over her line's waveform; on
 *              "Saturday?" SAME QUESTION pops beside the label
 *   Ava        ● AVA "You can! / We're open Saturday / from nine till four." ("nine till four." keys sunday on "nine")
 *              — on her "Saturday" the sweep runs under the page's new line (b10's band), lit through "nine till four.";
 *              "four." takes the bright pluck
 *   L-cut      under her last words the frame crosses back to the desk: one 24-frame move (change/Cross.tsx) carries the
 *              call 40 % out against the reading direction and b15's first picture 40 % in behind a soft edge; it lands
 *              at rest on the act's last frame, which is b15's own first picture
 *
 * Every time is CHANGE_LOCAL (src/kb/timing.ts, from kb2-vo-7 / kb2-c2 / kb2-call-3's real word onsets); the layout and
 * the poses are scenes/change/stage.ts; the cut from b12 takes LinePanel at LINE_LOCAL.end (change/Handoff.tsx), the cut
 * into b15 is MattersDesk's own first picture (change/Cross.tsx).
 */
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { useLayout } from '../../lib/layout';
import { EASE, smooth, tween } from '../../lib/motion';
import { Captions } from '../components/Captions';
import { EASE_HOVER, hoverAt, measureText, meshShadowInk, useDocPage, useKitFaces, useMenu, useTabBar, W as WT, type CursorKey } from '../kit';
import { KB_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { CHANGE_LOCAL as K } from '../timing';
import { AppPanel, oldRowBox, rowMenuRect } from './change/App';
import { CallTurns } from './change/CallTurns';
import { Cross, PushOut } from './change/Cross';
import { dragPoints, FILE_LINES, FILE_NAME, FilePage, Flight } from './change/FilePage';
import { ChangeGround } from './change/Ground';
import { Handoff, useLinePointer } from './change/Handoff';
import { NEW_LINES, NewRow, newRowBox } from './change/NewRow';
import { ChangeOrb } from './change/Orb';
import { changeStage, filePose, orbPose } from './change/stage';
import { Pointer } from './line/Pointer';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const INK = meshShadowInk(KB_MESH);

type XY = { x: number; y: number };

/**
 * The pointer's whole performance (frame px; critic fix round, build B). b12 hid it on Save's release: it stays hidden
 * while b12's page leaves and the owner's file lands, and comes back — fading in where it will press, an I-beam over
 * the settled page with "14:00" in view (it moved there while hidden: no visible jump). The drag across the digits takes
 * two 16ths at the move's pace. Typing hides it (as macOS does); it comes back as an ARROW once the file starts stepping
 * up into its corner, on its way to the row's … (a 4-frame dwell), and — once the menu is fully drawn — hops at its
 * natural pace into the right-hand padding of "Replace with new file" (the label stays readable through the press).
 * One cursor shape at a time: the I-beam only while the file is the thing being edited.
 */
function cursorKeys(start: XY, drag: { start: XY; end: XY }, dots: XY, rep: XY): CursorKey[] {
  return [
    // hidden, where b12 left it (on Save changes)
    { at: 0, x: start.x, y: start.y, action: 'hide' },
    { at: K.pointerIn, x: drag.start.x, y: drag.start.y, action: 'show', dur: K.pointerIn - 1, bend: 0.06 },
    { at: K.drag.down, x: drag.start.x, y: drag.start.y, action: 'press' },
    // the drag across the digits, released over the end of "00"
    { at: K.drag.up, x: drag.end.x, y: drag.end.y, action: 'release', bend: 0 },
    // typing: the pointer hides (as macOS hides it on a keypress) and comes back on its next move
    { at: K.keys[0], x: drag.end.x, y: drag.end.y, action: 'type' },
    // to the Opening hours row's … (the app at rest behind the file since before it leaves)
    { at: K.toMenu[1], x: dots.x, y: dots.y, dur: K.toMenu[1] - K.toMenu[0], bend: 0.1 },
    { at: K.menu.down, x: dots.x, y: dots.y, action: 'press' },
    { at: K.menu.up, x: dots.x, y: dots.y, action: 'release' },
    // the hop into the open menu, once it is fully drawn: "Replace with new file"
    { at: K.hop[1], x: rep.x, y: rep.y, dur: K.hop[1] - K.hop[0], bend: 0.06 },
    { at: K.replace.down, x: rep.x, y: rep.y, action: 'press' },
    { at: K.replace.up, x: rep.x, y: rep.y, action: 'release' },
    // its work done, it flicks off to the right (past the panel's edge), clear of the rows that shift down under it as
    // the new one flies in; it fades on the way (pointerFade below) and is gone before it can rest on any of them
    { at: K.replace.up + 12, x: rep.x + 240, y: rep.y - 24, dur: 12 },
    { at: K.replace.up + 13, x: rep.x + 240, y: rep.y - 24, action: 'hide' },
  ];
}

/** the pointer's exit after Replace with new file: faded WHILE it flicks away (from 4 frames after the release, gone 6
 *  frames later), never at rest over the list that moves under it */
const pointerFade = (t: number) => 1 - EASE_HOVER(Math.min(1, Math.max(0, (t - (K.replace.up + 4)) / 6)));
/** after typing it comes back only as the file starts to step away (an arrow, over the app) — not as an I-beam over a
 *  page that is leaving */
const pointerBack = (t: number) => (t < K.toMenu[0] || t >= K.park[0] + 2 ? 1 : smooth(K.park[0], K.park[0] + 2, t));

export const Change: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('change');
  const S = changeStage(v);
  useKitFaces();
  const file = useDocPage({
    x: S.file.x,
    y: S.file.y,
    w: S.file.w,
    title: 'Opening hours',
    lines: FILE_LINES,
    fileName: FILE_NAME,
    size: S.file.size,
  });
  const page = useDocPage({
    x: S.page.x,
    y: S.page.y,
    w: S.page.w,
    title: 'Opening hours',
    lines: NEW_LINES,
    kind: 'TXT',
    size: S.page.size,
  });
  const bar = useTabBar({
    x: S.panel.x,
    y: S.panel.y,
    width: S.panel.w,
    size: S.tabs.size,
    icons: S.tabs.icons,
    pad: (S.tabs.padR * S.tabs.size) / 14,
    badge: [
      { at: -1e6, n: 4 },
      { at: K.land, n: 5 },
      { at: K.badgeBack, n: 4 },
    ],
  });
  const old = oldRowBox(S);
  const dots = rowMenuRect(old.x, old.y, old.w, old.h, S.row.size);
  const menu = useMenu({
    x: dots.x + dots.w,
    y: S.menu.side === 'top' ? dots.y : dots.y + dots.h,
    size: S.menu.size,
    side: S.menu.side,
  });
  const start = useLinePointer(v);
  const drag = dragPoints(file, v);
  const item = menu.items[1];
  // "Replace with new file": the hotspot in the item's right-hand padding, past the label (kit/ui.tsx Menu: padding 6r,
  // icon 16r, gap 6r, then the label) — the arrow's body falls on empty padding, never on a letter
  const mr = S.menu.size / 14;
  const labelEnd = item.x + 28 * mr + measureText('Replace with new file', { size: S.menu.size, weight: WT.regular + 20 });
  const repX = Math.min(item.x + item.w - 4 * mr, labelEnd + 10 * mr);
  const keys = useMemo(
    () => cursorKeys(start, drag, { x: dots.cx + 3, y: dots.cy + 4 }, { x: repX, y: item.cy + 2 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, start.x, start.y, drag.start.x, drag.start.y, drag.end.x, dots.cx, dots.cy, repX, item.cy],
  );
  const orb = orbPose(t, S);
  // the I-beam exactly while the hotspot is over the file's paper AND the file is being edited (until it steps away);
  // the arrow elsewhere. One shape at a time: the switch takes half a frame (≤ 2 render frames at 120 fps)
  const fp = filePose(t, S, file.card.h);
  const text = t < K.park[0] ? hoverAt(keys, t, { x: fp.x, y: fp.y, w: fp.w, h: fp.h }, 0.5) : 0;
  const keyK = tween(t, [K.key, K.key + 12], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      <PushOut t={t} S={S}>
        <ChangeGround t={t} S={S} orb={orb} />
        <Handoff t={t} S={S} ink={INK} accent={SUNDAY} />
        {/* 9:16: the file steps back UNDER the app's sheet as it comes in (stage.ts appPose / filePose) */}
        {S.file.park ? null : <FilePage t={t} S={S} g={file} keys={keys} ink={INK} accent={SUNDAY} />}
        <AppPanel t={t} S={S} bar={bar} menu={menu} keys={keys} ink={INK} />
        <NewRow t={t} S={S} g={page} ink={INK} accent={SUNDAY} />
        {S.file.park ? <FilePage t={t} S={S} g={file} keys={keys} ink={INK} accent={SUNDAY} /> : null}
        {S.file.park ? <Flight t={t} S={S} g={file} keys={keys} row={newRowBox(S)} size={S.row.size} ink={INK} accent={SUNDAY} /> : null}
        <CallTurns t={t} S={S} />
        <ChangeOrb t={t} S={S} pose={orb} />
        <Captions
          t={t}
          lineAt={K.vo7}
          voice="kb2-vo-7"
          captions={K.captions}
          x={S.caption.x}
          y={S.caption.y}
          maxWidth={S.caption.maxWidth}
          tone="paper"
          holdUntil={K.holdUntil}
          echoY={null}
          tint={(c, j) => (c === 2 && j >= 4 ? { color: SUNDAY, k: keyK } : null)}
        />
        <div style={{ position: 'absolute', inset: 0, opacity: pointerFade(t) * pointerBack(t) < 0.999 ? pointerFade(t) * pointerBack(t) : undefined }}>
          <Pointer keys={keys} t={t} text={text} />
        </div>
      </PushOut>
      <Cross t={t} S={S} />
    </AbsoluteFill>
  );
};
