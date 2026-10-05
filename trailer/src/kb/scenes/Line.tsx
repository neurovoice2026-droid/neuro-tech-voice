/**
 * PART III · b12 · YOUR LINE (SCRIPT.md b12; CLIENT DIRECTION v2) — "If it isn't written down, I say so, in the words you
 * chose."
 *
 *   0 (bar)    b11's last picture: the agent page comes up from below the frame's bottom edge, opaque, OVER the call's
 *              record row, which steps back (× .92) and goes — a card stack, no dissolve (stage.ts scrollAmount). The
 *              page is the app of b08 (its real tab bar, Knowledge's badge at 4) on its Conversation tab — "When your
 *              agent can't help", the field "When the answer isn't in your documents" with the product's default line as
 *              grey placeholder, the SaveBar (Discard · Save changes, disabled). The pointer is on the page: it enters
 *              through the bottom edge with it. Ava's orb glides to her corner, small, and dims to rest: these are not
 *              her words
 *   caret      the I-beam presses (.9; focus ring, caret) and releases — the caret clicks in
 *   the words  the owner's line, ONE WORD PER 16th (22), each appearing IN PLACE as a real field shows a keystroke (no
 *              rise; the caret jumps after the last half-visible word — kit/typed.ts); the placeholder clears on the first;
 *              the amber unsaved-changes dot opens on the Conversation tab (the tabs after it slide over) and Discard /
 *              Save changes wake. Nothing else moves, nothing is narrated (one text moves at a time)
 *   Save       the pointer comes back off the keys as the last words land, hovers Save changes (it darkens), presses
 *              (.97 + shade, the save tick) and releases: the dot closes, the buttons go back to disabled, the field
 *              blurs; the pointer fades where it stands
 *   vo-6       Ava narrates — the orb relights on her first word; the caption (no tag): "If it isn't written down, I say
 *              so," / "in the words you chose." — and on "words" a sunday ring settles round the field (the key phrase
 *              keys sunday with it)
 *
 * THE FULL ORDER (LINE_LOCAL.full — on: b12 has one bar more than the script's plan, timing.ts LINE_BAR): the page comes
 * back on Knowledge (b08's list at rest) and the pointer settles onto Conversation as it lands (the hover), presses it on
 * beat 2 and releases (the underline springs across, the content swaps through its mask), crosses to the field and clicks
 * it. THE PUSH (stage.ts PUSH): from the caret to the last word the camera pushes slowly in (16:9 ×1.30, the page filling
 * the frame, Ava carried out past the left edge), holds while the pointer hops to Save changes and clicks it, and pulls
 * back on the release — bringing Ava back in to relight on her first word. At rest long before the act ends. 9:16 has no
 * push (fix:line): its page is b08's full-tab panel, the WHOLE current tab in frame at every moment (Knowledge as b08 left
 * it, then Conversation with the line at its ad size at rest) — line/stage.ts 9:16 PORTRAIT PAGE.
 * Every time is LINE_LOCAL (src/kb/timing.ts, from kb2-vo-6's real word onsets); the layout and the poses are
 * scenes/line/stage.ts; the cut from b11 takes callEnd(), the cut into b13 hands over lineEnd().
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useLayout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { Captions } from '../components/Captions';
import { meshShadowInk } from '../kit';
import { KB_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { LINE_LOCAL as N } from '../timing';
import { LineGround } from './line/Ground';
import { Handoff } from './line/Handoff';
import { LineOrb } from './line/Orb';
import { LinePanel, usePageGeometry } from './line/Panel';
import { camToScreen, groundCam, lineCam, lineStage, orbPose, planeStyle } from './line/stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const INK = meshShadowInk(KB_MESH);

export const Line: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('line');
  const S = lineStage(v);
  const G = usePageGeometry(S);
  const orb = orbPose(t, S);
  const keyK = tween(t, [N.key, N.key + 10], [0, 1], EASE.inOut);
  // the push-in while the owner types (stage.ts PUSH; the full order only): the page, its pointer and the orb on the focal
  // plane, the ground a quarter of the way behind; her key light stays on her (her screen place, in the ground's own px)
  const cam = lineCam(t, S, G.panel, G.field);
  const gc = groundCam(cam, S);
  const orbOnScreen = camToScreen(cam, S, orb);
  const orbOnGround = { ...gc.fromScreen(orbOnScreen), d: (orb.d * cam.zoom) / gc.zoom };
  const plane = planeStyle(cam);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={gc.css ? { transform: gc.css, transformOrigin: '50% 50%' } : undefined}>
        <LineGround t={t} S={S} orb={orbOnGround} />
      </AbsoluteFill>
      <Handoff t={t} S={S} ink={INK} />
      <AbsoluteFill style={plane}>
        <LinePanel t={t} S={S} G={G} ink={INK} accent={SUNDAY} />
        <LineOrb t={t} S={S} pose={orb} />
      </AbsoluteFill>
      <Captions
        t={t}
        lineAt={N.vo6}
        voice="kb2-vo-6"
        captions={v ? N.captionsV : N.captions}
        x={S.caption.x}
        y={S.caption.y}
        maxWidth={S.caption.maxWidth}
        tone="paper"
        holdUntil={N.holdUntil}
        echoY={null}
        tint={(c) => (c === (v ? 2 : 1) ? { color: SUNDAY, k: keyK } : null)}
      />
    </AbsoluteFill>
  );
};
