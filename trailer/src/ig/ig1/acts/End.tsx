/**
 * REEL 1 · b6–b8 END (docs/ig/SCRIPT.md ig1 §4 "b6–b8 End"): the shared end card (components/End.tsx IgEnd) over the
 * two-colour week:
 *
 *   CTA     the week steps back (× .92) and dims well back behind the centred CTA and the comment field, her orb waiting
 *           in the grid's corner (stage.ts P2)
 *   IMPACT  the card's teal light over the faint week; NEUROVOICE, the URL on "Neuro | Tech | Voice"
 *   SEAM    (the last 14 f) the week folds back into the desk line — its teal draining first, its rows converging on
 *           y 760 — she glides down onto the desk and closes into the phone's rose light, and frame 0's composition
 *           re-forms (Hook.tsx Ig1Frame0 at t − END: S1 rising back into place, the hairline drawing again from x 86),
 *           the ground crossing to frame 0's: the replay continues the picture
 */
import React from 'react';
import { EASE, mix, mixHex, tween } from '../../../lib/motion';
import { endGroundKey, IgEnd } from '../../components/End';
import { PearlGround } from '../../components/Ground';
import { useActFrame } from '../../scene';
import { DESK } from '../desk';
import { CTA_DIM, ctaDimAt, groundKeyAt } from '../stage';
import * as T from '../timing';
import { WeekGrid } from '../WeekGrid';
import { Ig1Frame0 } from './Hook';
import { Ig1Orb, Plane } from './Stage';

/** how far the week steps back behind the CTA (opacity × (1 − dim)) and under the card's light */
const DIM = { brand: 0.93 } as const;

export const Ig1End: React.FC = () => {
  const t = useActFrame(T.SCENES, 'end');
  const f = T.SCENES.end.from + t;
  const E = T.END_CARD;
  return (
    <IgEnd
      T={T}
      t={f}
      tone="pearl"
      ground={(tm) => {
        // the card's ground: the stage's (the sunday pool) taking the backlight's light; frame 0's (tm < 0) is the hook's
        const base = groundKeyAt(tm);
        const key = tm < 0 ? null : endGroundKey(T, tm, false);
        const k = key ? key.strength / 0.3 : 0;
        return (
          <PearlGround
            t={tm}
            keyLight={key && k > 0.001 ? { x: mix(base.x, key.x, k), y: mix(base.y, key.y, k), strength: mix(base.strength, key.strength + 0.12, k), color: mixHex(base.color, key.color, k), radius: mix(base.radius, 900, k) } : base}
          />
        );
      }}
      backdrop={(s) => {
        // the week: stepped back and dimmed behind the CTA, fainter under the card's light; folding into the desk in the seam
        const dim = ctaDimAt(f) + (DIM.brand - CTA_DIM) * tween(f, [E.impact - 2, E.impact + 10], [0, 1], EASE.inOut);
        const collapse = tween(f, [E.seam - 2, T.DURATION - 6], [0, 1], (u) => u);
        const z = 1 - 0.08 * s.step;
        // in the seam the week comes forward again to fold away (its light back as it collapses)
        const seamUp = tween(f, [E.seam - 4, E.seam + 2], [0, 1], EASE.inOut);
        return (
          <Plane t={f} z={mix(z, 1, seamUp)}>
            <WeekGrid t={f} zoom={mix(z, 1, seamUp)} fx={{ dim: mix(dim, 0.8, seamUp), collapse }} />
          </Plane>
        );
      }}
      orb={() => <Ig1Orb t={f} seam={{ at: E.seam, dur: T.DURATION - 2 - E.seam, to: { x: DESK.x1, y: DESK.y }, dot: DESK.dot, t0: T.DURATION }} />}
      seam={(th) => (
        <Plane t={th} z={1}>
          <Ig1Frame0 t={th} dot={false} />
        </Plane>
      )}
    />
  );
};
