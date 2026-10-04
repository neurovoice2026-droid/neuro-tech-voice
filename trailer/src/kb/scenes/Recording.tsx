/**
 * b06 · A RECORDING (SCRIPT.md b06; CLIENT DIRECTION v2) — from the hard stop to "Waiting." on its bar.
 *
 *   0          the hard stop: Part I's last picture, the same parts on the same planes (scenes/repeat/*:
 *              the in-person card far back with its em dash hanging, 17:58 on the clock, the day's pile on
 *              the pad) on the site's "no answer" grey mesh — the rose tint drained, the last ring and the
 *              light's pulse cut; the camera holds a 16th
 *   glide      in the silence the camera glides on, the desk leaving the frame (recording/stage.ts); the
 *              pile is picked up, squared, carried, folded to strips of one line, and dealt down into one
 *              column that scrolls like a teleprompter (recording/Stack.tsx)
 *   title1     "You hired someone brilliant." (headline, left on the column's axis), each word on its spoken
 *              onset — "brilliant." lands on its own word
 *   title2     it leaves up on "The" as "The phone turned them / into a recording." rises a line per
 *              phrase; the key "a recording." eases into rush ink as the glint runs word by word
 *   pullBack   on "And the customer" the camera pulls back to the in-person card, the column left behind
 *              still scrolling; the card comes forward .90 → 1 (SPRING.site), its shade lifting
 *   question   "And the customer / in front of them?" (caption role, no tag: narration) — in 16:9 beside the
 *              card on its own baselines, in 9:16 under it
 *   waiting    "Waiting." locks in the display role ON the bar, and holds to the act's end
 *
 * Every time is RECORDING_LOCAL (src/kb/timing.ts, from the real word onsets). No orb yet: Ava is only a
 * voice, so her arrival in b07 is an event.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, Layer } from '../../components/Camera';
import { camMotion } from '../../lib/glide';
import { useLayout } from '../../lib/layout';
import { SPRING, springUnit } from '../../lib/motion';
import { meshShadowInk, MeshGround } from '../kit';
import { HOME, MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { RECORDING_LOCAL as RL, REPEAT_LOCAL, SCENES, vWord } from '../timing';
import { REPEAT_GROUND } from './Repeat';
import { DeskClock } from './repeat/Clock';
import { cardDepth as repeatCardDepth, deskLayout, PLANE, roomTint } from './repeat/desk';
import { InPersonCard } from './repeat/InPersonCard';
import { Stack } from './recording/Stack';
import { camPose, PULL, stageFor, toScreen, type Stage } from './recording/stage';
import { LeftTitle, SaidLines, Waiting, type TitleLine } from './recording/Type';

const SHADOW_INK = meshShadowInk(MUTED_MESH);
const RUSH = MOMENT_LIGHTS.rush;
const STOP = REPEAT_LOCAL.hardStop;
/** the clock past its last ring's life (Clock.tsx LIFE 28.5): the ring and the pulse cut, the breath going on */
const CLOCK_T0 = STOP + 30;

/** vo-1's word k, act-local */
const w1 = (k: number) => RL.vo1 + vWord('kb2-vo-1', k);

/** the card's depth and shade: as Part I left it (.90 far back) until it comes forward on the site spring */
export function cardDepth(t: number) {
  const d0 = repeatCardDepth(STOP);
  const p = springUnit(t - RL.cardForward, SPRING.site);
  return { scale: d0.scale + (1 - d0.scale) * p, shade: d0.shade * Math.max(0, 1 - Math.min(1, p)) };
}

/** the titles: each word on its spoken onset (left-set, so a line fills from its axis); 9:16 wraps into the frame */
function titleLines(vertical: boolean): { one: TitleLine[]; two: TitleLine[] } {
  if (!vertical) {
    return {
      one: [{ words: ['You', 'hired', 'someone', 'brilliant.'], at: [w1(0), w1(1), w1(2), w1(3)] }],
      two: [
        { words: ['The', 'phone', 'turned', 'them'], at: [w1(4), w1(5), w1(6), w1(7)] },
        { words: ['into', 'a', 'recording.'], at: [w1(8), w1(9), w1(10)] },
      ],
    };
  }
  return {
    one: [
      { words: ['You', 'hired', 'someone'], at: [w1(0), w1(1), w1(2)] },
      { words: ['brilliant.'], at: [w1(3)] },
    ],
    two: [
      { words: ['The', 'phone'], at: [w1(4), w1(5)] },
      { words: ['turned', 'them', 'into'], at: [w1(6), w1(7), w1(8)] },
      { words: ['a', 'recording.'], at: [w1(9), w1(10)] },
    ],
  };
}

/** is the card (desk plane) in the frame at t */
function cardInFrame(t: number, G: Stage, scale: number) {
  const g = deskLayout(G.vertical);
  const p = camPose(t, G);
  const c = toScreen(p, G, PLANE.desk, g.card.x + g.card.w / 2, g.card.y + g.card.h / 2);
  const hw = (g.card.w / 2) * c.z * scale + 60;
  const hh = (g.card.h / 2) * c.z * scale + 60;
  return c.x + hw > 0 && c.x - hw < G.W && c.y + hh > 0 && c.y - hh < G.H;
}

export const Recording: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('recording');
  const G = stageFor(v);
  const g = deskLayout(v);
  const pose = camPose(t, G);
  const motion = camMotion((u) => camPose(u, G), t);
  const card = cardDepth(t);
  const lines = titleLines(v);
  // the ground: Repeat's own (MUTED_MESH, its clock = the timeline), held where Part I's slow push left its
  // plane; the line light's pull stays, its rose tint is drained on the stop
  const P0 = G.P0;
  const zg = 1 + (P0.zoom - 1) * PLANE.ground;
  const ground = `translate(${(-P0.x * PLANE.ground).toFixed(4)}px, ${(-P0.y * PLANE.ground).toFixed(4)}px) scale(${zg.toFixed(6)})`;
  // 16:9: once the camera pulls back the clock is left off the right of the frame (the turn brings it back);
  // 9:16: it stands over the card again (where b07's orb is born from its colon)
  const clockOn = v ? true : t < PULL[0];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: ground, transformOrigin: '50% 50%' }}>
        <MeshGround
          t={SCENES.recording.from + t}
          palette={REPEAT_GROUND.palette}
          lift={REPEAT_GROUND.lift}
          seed={REPEAT_GROUND.seed}
          keyLight={{ x: g.clock.dotX, y: g.clock.dotY, strength: roomTint(STOP) * 4 }}
        />
      </AbsoluteFill>

      <Camera x={pose.x} y={pose.y} zoom={pose.zoom} {...motion}>
        <Layer depth={PLANE.desk}>{cardInFrame(t, G, card.scale) ? <InPersonCard t={STOP} g={g} scale={card.scale} shade={card.shade} ink={SHADOW_INK} /> : null}</Layer>
        <Layer depth={PLANE.near}>{clockOn ? <DeskClock t={CLOCK_T0 + t} g={g} /> : null}</Layer>
      </Camera>

      {/* the day's paper → one column, a teleprompter of the same answer */}
      <Stack t={t} G={G} ink={SHADOW_INK} />

      {/* the type over it */}
      <LeftTitle t={t} lines={lines.one} x={G.title.x} y={G.title.y} vertical={v} color={HOME.ink} exit={{ at: RL.title2 - 2, stagger: 1, dur: 8 }} />
      <LeftTitle
        t={t}
        lines={lines.two}
        x={G.title.x}
        y={G.title.y}
        vertical={v}
        color={HOME.ink}
        keyPhrase={{ text: 'a recording.', at: RL.recordingKey, color: RUSH.ink, glint: RUSH.orb[2] }}
        exit={{ at: RL.title2Out, stagger: 1, dur: 9 }}
      />
      <SaidLines
        t={t}
        lines={[
          { words: ['And', 'the', 'customer'], at: RL.question[0] },
          { words: ['in', 'front', 'of', 'them?'], at: RL.question[1] },
        ]}
        x={G.question.x}
        y={G.question.y}
        vertical={v}
        color={HOME.ink}
      />
      <Waiting t={t} land={RL.waiting} x={G.waiting.x} baseline={G.waiting.baseline} vertical={v} color={HOME.ink} />
    </AbsoluteFill>
  );
};
