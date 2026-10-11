/**
 * REEL 6 · "One ring" — THE ACTS (docs/ig/ig6/SCRIPT.md §4: hook · wait · missed · pickup · day · words · ring · end).
 * The reel is ONE continuous stage (../stage/Stage.tsx Stage6: pure functions of the absolute frame), mounted by each
 * act's <Sequence> at its own frames, so an act boundary is invisible:
 *
 *   hook     b1 the giant cropped dial ticking, ring 1 at frame 0, "One ring, / six seconds." → "Your receptionist /
 *            can’t answer."; the T1 tick cut to the tip macro on f90
 *   wait     b2 the dial steps on; ring 2 lands six real seconds after ring 1 (the punch-in); "While it / rings," held
 *            through it, "Someone’s / still waiting."; the T1 cut back, the T2 fall through node 2's white centre
 *   missed   b3 out of the white, the whole dial: a minute of rings fills the rim; "Someone else’s / customer."; the whip
 *   pickup   b4 a fresh clock's hub rings and stamps teal on the bar line; the pull-back rebuilds the agent's clock;
 *            "Our AI / receptionist" underlined out of the hub; "Picks up, / day or night."
 *   day      b5 the agent's day: one turn, five teal domes; "It answers / from your words."
 *   words    b6 the hand-tip macro, a dome under the needle
 *   ring     b7 the calm reference frame; "Ring it / yourself."; the recede, the dome glides to the send disc
 *   end      b8–b10 End6 (stage/End6.tsx) and the seam back to frame 0
 */
import React from 'react';
import { useActFrame } from '../../scene';
import { Stage6 } from '../stage/Stage';
import * as T from '../timing';

/** one of the stage's acts: the stage at the act's absolute frame */
export function stageAct(key: T.SceneKey): React.FC {
  const Act: React.FC = () => {
    const t = useActFrame(T.SCENES, key);
    return <Stage6 t={T.SCENES[key].from + t} />;
  };
  Act.displayName = `ig6-${key}`;
  return Act;
}

export const ACTS6: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, stageAct(k)]));
