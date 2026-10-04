/**
 * PART II · b07 · TWO KINDS (SCRIPT.md b07; CLIENT DIRECTION v2) — from "Waiting." to "the first kind".
 *
 *   0 (beat 3)  a hairline seam draws over one beat (16:9 top → bottom at x 960; 9:16 left → right at y 900)
 *               and the desk sorts itself on it: b06's narration leaves up through its masks; the in-person
 *               card glides into the right half (9:16: out, under the seam); 16:9: the clock (Part I's lockup,
 *               its own size) rides in to the top of the left half; 9:16: its figures roll away and leave the
 *               rose line light alone
 *   left        "Some work repeats." on its words, "repeats." in a split-flap window that turns over on every
 *               beat and only ever to the same word (slate, a flap tick each); 16:9: under it the day's column
 *               of the same answer flows up and keeps scrolling — the work that repeats, still repeating
 *   right       "Some work matters.", still, in full ink, over the card (the person still mid-sentence)
 *   "Ava"       the rose colon lifts off the clock (on "I'm"), glides to its place above the left title and,
 *               ON "Ava" (snapped to the 16th), springs open into Ava's orb — one hairline ring off its rim,
 *               its palette crossing rush → sunday in 6 frames: the same light, now hers. Her ground
 *               (KB_MESH) spreads from her over her half; the matters half stays on Part I's neutral mesh
 *   caption     the narrator's line under the seam, no tag; the key "the first kind" in sunday ink
 *   firstKind   the flips have stopped for good; the left title leaves and (16:9) the column glides up into
 *               its place, toward her light, and comes to rest
 *   kind.       the matters side yields to the next act: its title leaves, the card glides out, and her ground
 *               follows it across the seam (a feathered front, to the cut: the half is never left empty grey);
 *               16:9 the emptied clock rides up and out. The cut hands b08 the orb, the seam, her ground over the
 *               whole frame and (16:9) the column at rest (scenes/turn/stage.ts TURN_END).
 *
 * Every time is TURN_LOCAL (src/kb/timing.ts, from kb2-vo-3's real word onsets); the layout and every pose
 * are scenes/turn/stage.ts.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { subpixel } from '../../lib/glide';
import { useLayout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { Captions } from '../components/Captions';
import { meshShadowInk } from '../kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { REPEAT_LOCAL, TURN_LOCAL as T } from '../timing';
import { deskLayout } from './repeat/desk';
import { InPersonCard } from './repeat/InPersonCard';
import { TurnClock } from './turn/Clock';
import { Column } from './turn/Column';
import { TurnGround } from './turn/Ground';
import { AvaOrb } from './turn/Orb';
import { Seam } from './turn/Seam';
import { cardPose, turnStage } from './turn/stage';
import { LeadOut, TwoKinds } from './turn/Type';

const SHADOW_INK = meshShadowInk(MUTED_MESH);
const SUNDAY_INK = MOMENT_LIGHTS.sunday.ink;

export const Turn: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('turn');
  const S = turnStage(v);
  const g = deskLayout(v);
  const card = cardPose(t, S);
  const cardMoving = t > T.sort && (Math.abs(card.dx - cardPose(t + 0.25, S).dx) + Math.abs(card.dy - cardPose(t + 0.25, S).dy) + 100 * Math.abs(card.scale - cardPose(t + 0.25, S).scale) > 1e-3);
  const keyK = tween(t, [T.firstKind, T.firstKind + 10], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      <TurnGround t={t} S={S} />
      <Seam t={t} start={T.seam[0]} dur={T.seam[1] - T.seam[0]} a={S.seam.a} b={S.seam.b} />
      <Column t={t} S={S} />
      {card.on ? (
        <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(`translate(${card.dx.toFixed(3)}px, ${card.dy.toFixed(3)}px)`, cardMoving) }}>
          <InPersonCard t={REPEAT_LOCAL.hardStop} g={g} scale={card.scale} shade={0} ink={SHADOW_INK} />
        </div>
      ) : null}
      <TurnClock t={t} S={S} />
      <AvaOrb t={t} S={S} />
      <TwoKinds t={t} S={S} />
      <LeadOut t={t} S={S} />
      <Captions
        t={t}
        lineAt={T.vo3}
        voice="kb2-vo-3"
        captions={T.captions}
        x={S.caption.x}
        y={S.caption.y}
        maxWidth={S.caption.maxWidth}
        tone="paper"
        holdUntil={T.holdUntil}
        echoY={null}
        tint={(c, j) => (c === 1 && j >= 3 ? { color: SUNDAY_INK, k: keyK } : null)}
      />
    </AbsoluteFill>
  );
};
