/**
 * REEL 1 · b6–b8 END (docs/ig/SCRIPT.md ig1 §4 "b6–b8 End"): the shared end card (components/End.tsx IgEnd) over the
 * two-colour week:
 *
 *   CTA     the week steps back (× .92) and dims well back behind the centred CTA and the comment field, her orb waiting
 *           in the grid's corner (stage.ts P2)
 *   IMPACT  the week gone as the CTA leaves; her light thrown wide on the bar, opening into the card's luminous teal
 *           backlight (PEARL_LOOK); NEUROVOICE, the URL on "Neuro | Tech | Voice"
 *   SEAM    (the last 14 f) the week folds back into the desk line — its teal draining first, its rows converging on
 *           y 760 — she glides down onto the desk and closes into the phone's rose light, and frame 0's composition
 *           re-forms (Hook.tsx Ig1Frame0 at t − END: S1 rising back into place, the hairline drawing again from x 86),
 *           the ground crossing to frame 0's: the replay continues the picture
 */
import React from 'react';
import { EASE, mix, mixHex, tween } from '../../../lib/motion';
import { END, endGroundKey, IgEnd } from '../../components/End';
import { PearlGround } from '../../components/Ground';
import { useActFrame } from '../../scene';
import { DESK } from '../desk';
import { CTA_DIM, ctaDimAt, groundKeyAt } from '../stage';
import * as T from '../timing';
import { WeekGrid } from '../WeekGrid';
import { Ig1Frame0 } from './Hook';
import { Ig1Orb, Plane } from './Stage';

/**
 * THE CARD's LIGHT on the pearl (IgEnd pearlLook): her sunday teal as a luminous backlight — a near-white heart behind
 * the wordmark in a saturated teal corona (the sunday orb's own stops), so the reel's loudest moment lands as light,
 * as film 2's card does on its night; and her light's burst on the bar wide enough to read on a light ground.
 */
export const PEARL_LOOK = { stops: ['#f0fdff', '#5ccde1', '#97e0ed', '#d2f2f7'], core: 0.3, burst: 3.2 } as const;
/** the impact's flash on the ground (its mesh key): her teal pool thrown wide on the bar, settling into the card's light */
const FLASH = { strength: 0.42, tau: 7, color: '#8fdfec', radius: 760 } as const;

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
        // the bar's flash: her light thrown wide on the ground on the impact's own frame, settling as the backlight opens
        const fl = tm < 0 || tm < E.impact - 1 ? 0 : FLASH.strength * Math.min(1, tm - (E.impact - 1)) * Math.exp(-Math.max(0, tm - E.impact) / FLASH.tau);
        const k = Math.min(1, (key ? key.strength / 0.3 : 0) + fl / FLASH.strength);
        const kc = key && key.strength > 0.001 ? key.color : FLASH.color;
        return (
          <PearlGround
            t={tm}
            keyLight={
              k > 0.001
                ? { x: mix(base.x, END.P.x, k), y: mix(base.y, END.P.y, k), strength: mix(base.strength, (key?.strength ?? 0) + 0.12, k) + fl, color: mixHex(base.color, mixHex(kc, FLASH.color, fl / FLASH.strength), k), radius: mix(base.radius, mix(900, FLASH.radius, fl / FLASH.strength), k) }
                : base
            }
          />
        );
      }}
      backdrop={(s) => {
        // the week: stepped back and dimmed behind the CTA, gone as the CTA leaves (the card's light opens on a clear pearl,
        // no ghost of the grid or its labels behind the name); back, faint, only to fold into the desk in the seam
        const dim = ctaDimAt(f) + (1 - CTA_DIM) * tween(f, [E.impact - 6, E.impact - 1], [0, 1], EASE.inOut);
        const collapse = tween(f, [E.seam - 2, T.DURATION - 6], [0, 1], (u) => u);
        const z = 1 - 0.08 * s.step;
        // in the seam the week comes forward again to fold away (its light back as it collapses)
        const seamUp = tween(f, [E.seam - 4, E.seam + 2], [0, 1], EASE.inOut);
        return (
          <Plane t={f} z={mix(z, 1, seamUp)}>
            <WeekGrid t={f} zoom={mix(z, 1, seamUp)} fx={{ dim: mix(dim, 0.8, seamUp), collapse, chromeA: 1 - ctaDimAt(f) / CTA_DIM }} />
          </Plane>
        );
      }}
      orb={() => <Ig1Orb t={f} seam={{ at: E.seam, dur: T.DURATION - 2 - E.seam, to: { x: DESK.x1, y: DESK.y }, dot: DESK.dot, t0: T.DURATION }} />}
      pearlLook={PEARL_LOOK}
      seam={(th) => (
        <Plane t={th} z={1}>
          <Ig1Frame0 t={th} dot={false} />
        </Plane>
      )}
    />
  );
};
