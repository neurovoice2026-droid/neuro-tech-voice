/**
 * PART III · b13–b14 · CHANGE IT / THE NEXT CALL (SCRIPT.md b13–b14; CLIENT DIRECTION v2) — "Hours change? Change the
 * document. The next call gets the new answer." — and the next call does.
 *
 *   0          b12's last picture (its agent page, saved); the app sinks back and the OWNER'S OWN FILE comes forward:
 *              opening-hours.txt on plain paper, no app chrome (the edit happens outside the app). The pointer comes
 *              back from where b12 left it and turns into an I-beam over the page
 *   "change?"  the caret clicks into "14:00": the I-beam presses, drags across the digits (the sunday wash, a character at
 *              a time) and lets go; "16:00" is typed over it, one key per 16th — the last on "Change"
 *   "Change the document"   the file steps up into the corner; the agent page rises on its KNOWLEDGE tab (the badge at
 *              4): "Your documents", newest first. The cursor presses the Opening hours row's … (two-part click), the
 *              menu opens from its trigger (Read again · Replace with new file · Remove) and "Replace with new file" is
 *              clicked (.97): the edited file DROPS INTO THE LIST's top slot — the new version, Reading…; the old row
 *              stays Ready (it keeps answering until the new one is read); the badge counts both: 5
 *   "the new answer"   the fifth Ready mallet: the new row rolls to Ready · 1 passage; the old row leaves up through its
 *              mask, the list closes, the badge goes back to 4
 *   ring       a beat before it the app steps back and slides away; the new row lifts out of it and unfolds into its page
 *              (TXT · Opening hours — "Saturday · 9:00–16:00"); on beat 3 one slate hairline leaves Ava's orb as she
 *              glides to her call place; picked up an 8th later
 *   Dana       ● CALLER — b03's identical recording: "Quick one. / Can I pop in on Saturday?" over her line's waveform; on
 *              "Saturday?" SAME QUESTION pops beside the label
 *   Ava        ● AVA "You can! / We're open Saturday / from nine till four." ("nine till four." keys sunday on "nine")
 *              — and on "four." the sweep runs under the page's new line (and the bright pluck)
 *   L-cut      under her last word the frame crosses back to the desk: one camera push (change/Cross.tsx) carries the
 *              call out against the reading direction and b15's first picture in; it lands at rest on the act's last
 *              frame, which is b15's own first picture
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
import { CURSOR, hoverAt, meshShadowInk, useDocPage, useKitFaces, useMenu, useTabBar, type CursorKey } from '../kit';
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
 * The pointer's whole performance (frame px). Each move INTO a press ends on a dwell key CURSOR.pressLead (6) frames
 * before it (kit/cursor.ts cursorPos falls back to the previous key between a move's end and its key's `at`, so a press
 * key alone would jump back for those frames).
 */
function cursorKeys(start: XY, drag: { start: XY; end: XY }, dots: XY, rep: XY): CursorKey[] {
  const lead = CURSOR.pressLead;
  const lastKey = K.keys[K.keys.length - 1];
  return [
    // back from where b12 left it (on Save changes), a decisive move onto "14:00" as the file settles
    { at: 0, x: start.x, y: start.y, action: 'show' },
    {
      at: K.drag.down - lead,
      x: drag.start.x,
      y: drag.start.y,
      dur: K.drag.down - lead,
      bend: 0.1,
    },
    { at: K.drag.down, x: drag.start.x, y: drag.start.y, action: 'press' },
    // the drag across the digits, released over the end of "00"
    { at: K.drag.up, x: drag.end.x, y: drag.end.y, action: 'release', bend: 0 },
    // typing: the pointer hides (as macOS hides it on a keypress) and comes back on its next move
    { at: K.keys[0], x: drag.end.x, y: drag.end.y, action: 'type' },
    // down to the Opening hours row's … as the app settles under the file
    {
      at: K.menu.down - lead,
      x: dots.x,
      y: dots.y,
      dur: K.menu.down - lead - lastKey,
      bend: 0.1,
    },
    { at: K.menu.down, x: dots.x, y: dots.y, action: 'press' },
    { at: K.menu.up, x: dots.x, y: dots.y, action: 'release' },
    // a short hop into the open menu: "Replace with new file"
    {
      at: K.replace.down - lead,
      x: rep.x,
      y: rep.y,
      dur: K.replace.down - lead - K.menu.up,
      bend: 0.06,
    },
    { at: K.replace.down, x: rep.x, y: rep.y, action: 'press' },
    { at: K.replace.up, x: rep.x, y: rep.y, action: 'release' },
    // its work done, it fades where it stands
    { at: K.pointerOut, x: rep.x, y: rep.y, action: 'hide' },
  ];
}

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
    y: dots.y + dots.h,
    size: S.menu.size,
  });
  const start = useLinePointer(v);
  const drag = dragPoints(file);
  const item = menu.items[1];
  const keys = useMemo(
    () => cursorKeys(start, drag, { x: dots.cx + 3, y: dots.cy + 4 }, { x: item.x + item.w * 0.72, y: item.cy + 2 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, start.x, start.y, drag.start.x, drag.end.x, dots.cx, dots.cy, item.x, item.w, item.cy],
  );
  const orb = orbPose(t, S);
  // the I-beam exactly while the hotspot is over the file's paper, the arrow elsewhere
  const fp = filePose(t, S, file.card.h);
  // (only once the paper is there: the pointer starts over b12's Save changes as an arrow, and the file rises under it)
  const text = t < K.fly[0] ? hoverAt(keys, t, { x: fp.x, y: fp.y, w: fp.w, h: fp.h }, CURSOR.kindDur) * smooth(K.page[0] + 1, K.page[0] + 1 + CURSOR.kindDur, t) : 0;
  const keyK = tween(t, [K.key, K.key + 12], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      <PushOut t={t} S={S}>
        <ChangeGround t={t} S={S} orb={orb} />
        <Handoff t={t} S={S} ink={INK} accent={SUNDAY} />
        <AppPanel t={t} S={S} bar={bar} menu={menu} keys={keys} ink={INK} />
        <NewRow t={t} S={S} g={page} ink={INK} accent={SUNDAY} />
        <FilePage t={t} S={S} g={file} keys={keys} ink={INK} accent={SUNDAY} />
        <Flight t={t} S={S} g={file} keys={keys} row={newRowBox(S)} ink={INK} accent={SUNDAY} />
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
        <Pointer keys={keys} t={t} text={text} />
      </PushOut>
      <Cross t={t} S={S} />
    </AbsoluteFill>
  );
};
