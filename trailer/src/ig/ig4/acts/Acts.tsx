/**
 * REEL 4 · "Can you trip it up?" — THE ACTS (docs/ig/SCRIPT.md ig4 §3–4):
 *
 *   hook · asked · edge · thesis   ONE continuous stage (../Stage.tsx Stage4: pure functions of the absolute frame),
 *                                  mounted by each act's <Sequence> at its own frames, so an act boundary is invisible
 *   end                            b10–b12: the shared end card (components/End.tsx IgEnd) over the five documents —
 *                                  pulled back and up into a compact stack over the CTA, out under the card's light;
 *                                  her orb waits at the top left. SEAM (the last 14 f): frame 0's composition re-forms
 *                                  (../Stage.tsx Frame0 at t − END: the price list slides back up into its place under
 *                                  her, S1 rises into its masks, a ring already in flight), her orb crossing into frame
 *                                  0's (the same pose; its swirl crossfades), the ground crossing to frame 0's
 */
import React from 'react';
import { mix, mixHex } from '../../../lib/motion';
import { endGroundKey, IgEnd } from '../../components/End';
import { useActFrame } from '../../scene';
import { Frame0, Ground4, Orb4, pullAt, stackPose, Stage4, WARM_KEY } from '../Stage';
import { KbRows } from '../KbRows';
import * as T from '../timing';

/** one of the stage's acts: the stage at the act's absolute frame */
export function stageAct(key: T.SceneKey): React.FC {
  const Act: React.FC = () => {
    const t = useActFrame(T.SCENES, key);
    return <Stage4 t={T.SCENES[key].from + t} />;
  };
  Act.displayName = `ig4-${key}`;
  return Act;
}

/** the card's ground: the warm key handing over to the backlight's own light; frame 0's (tm < 0) is the hook's */
function endGround(tm: number) {
  if (tm < 0) return <Ground4 t={tm} />;
  const key = endGroundKey(T, tm, false);
  const k = key.strength / 0.3;
  return (
    <Ground4
      t={tm}
      keyLight={k > 0.001 ? { x: mix(WARM_KEY.x, key.x, k), y: mix(WARM_KEY.y, key.y, k), strength: mix(WARM_KEY.strength, key.strength + 0.12, k), color: mixHex(WARM_KEY.color, key.color, k), radius: mix(WARM_KEY.radius, 900, k) } : WARM_KEY}
    />
  );
}

export const End4: React.FC = () => {
  const f = T.SCENES.end.from + useActFrame(T.SCENES, 'end');
  const E = T.END_CARD;
  // her orb hands over to frame 0's across the seam (same pose: frame 0's orb fades in OVER hers, so the disc stays
  // opaque while its swirl crossfades)
  const x = Math.min(1, Math.max(0, (f - E.seam) / (T.DURATION - E.seam)));
  const cross = x * x * (3 - 2 * x);
  return (
    <IgEnd
      T={T}
      t={f}
      tone="pearl"
      ground={(tm) => endGround(tm)}
      backdrop={() => <KbRows t={f} lands={T.M.rows} pose={stackPose(f, pullAt(f))} />}
      orb={() => (cross < 0.999 ? <Orb4 t={f} /> : null)}
      seam={(th) => <Frame0 t={th} orb orbOpacity={cross} />}
    />
  );
};

export const ACTS4: { readonly [key: string]: React.FC } = {
  hook: stageAct('hook'),
  asked: stageAct('asked'),
  edge: stageAct('edge'),
  thesis: stageAct('thesis'),
  end: End4,
};
