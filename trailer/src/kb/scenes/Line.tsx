/**
 * PART III · b12 · YOUR LINE (SCRIPT.md b12; CLIENT DIRECTION v2) — "If it isn't written down, I say so, in the words you
 * chose."
 *
 *   0 (bar)    b11's last picture: the call's record row and its page leave up; the agent page rises in under them (the
 *              app of b08, its real tab bar, Knowledge's badge at 4) on its Conversation tab — "When your agent can't
 *              help", the field "When the answer isn't in your documents" with the product's default line as grey
 *              placeholder, the SaveBar (Discard · Save changes, disabled). The pointer rides in on the page, an I-beam
 *              over the field. Ava's orb glides to her corner, small, and dims to rest: these are not her words
 *   caret      the I-beam presses (.9; focus ring, caret) and releases — the caret clicks in
 *   the words  the owner's line, ONE WORD PER 16th (22), each rising into its mask; the placeholder clears on the first;
 *              the amber unsaved-changes dot opens on the Conversation tab (the tabs after it slide over) and Discard /
 *              Save changes wake. Nothing else moves, nothing is narrated (one text moves at a time)
 *   Save       the pointer comes back off the keys as the last words land, hovers Save changes (it darkens), presses
 *              (.97 + shade, the save tick) and releases: the dot closes, the buttons go back to disabled, the field
 *              blurs; the pointer fades where it stands
 *   vo-6       Ava narrates — the orb relights on her first word; the caption (no tag): "If it isn't written down, I say
 *              so," / "in the words you chose." — and on "words" a sunday ring settles round the field (the key phrase
 *              keys sunday with it)
 *
 * With room for v2's full order (LINE_LOCAL.full — not this take set: see timing.ts) the page comes back on Knowledge
 * and the pointer clicks Conversation first. Every time is LINE_LOCAL (src/kb/timing.ts, from kb2-vo-6's real word
 * onsets); the layout and the poses are scenes/line/stage.ts; the cut from b11 takes callEnd(), the cut into b13 hands
 * over lineEnd().
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
import { lineStage, orbPose } from './line/stage';

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
  return (
    <AbsoluteFill>
      <LineGround t={t} S={S} orb={orb} />
      <Handoff t={t} S={S} ink={INK} />
      <LinePanel t={t} S={S} G={G} ink={INK} accent={SUNDAY} />
      <LineOrb t={t} S={S} pose={orb} />
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
