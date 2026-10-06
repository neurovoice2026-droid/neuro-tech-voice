/**
 * REEL 1 · b6–b8 END (docs/ig/SCRIPT.md ig1 §4 "b6–b8 End"): the shared end card (components/End.tsx IgEnd) on the
 * reel's pearl ground, its orb parked in the label band through the CTA and the brand, then — in the seam — gliding
 * down onto the desk and closing back into the rose line light while S1 re-forms (Hook.tsx Ig1Frame0 at t − END), so
 * the replay's frame 0 continues the picture.
 *
 * The backdrop (the two-colour week grid stepping back, its teal draining back into the orb in the seam) is the reel's
 * to add when the WeekGrid exists (build step 6): `backdrop={(s) => <WeekGrid … step={s.step} />}`.
 */
import React from 'react';
import { EASE, mix, tween } from '../../../lib/motion';
import { endGroundKey, IgEnd } from '../../components/End';
import { PearlGround } from '../../components/Ground';
import { AvaOrb, orbTrack } from '../../components/Orb';
import { useActFrame } from '../../scene';
import * as T from '../timing';
import { DESK, Ig1Frame0 } from './Hook';

/** where her orb waits through the card (the label band, top right; clear of the rail) */
const PARK = { x: 836, y: 318, d: 96 } as const;

export const Ig1End: React.FC = () => {
  const t = useActFrame(T.SCENES, 'end');
  const f = T.SCENES.end.from + t;
  const E = T.END_CARD;
  const track = orbTrack(T);
  return (
    <IgEnd
      T={T}
      t={f}
      tone="pearl"
      ground={(tm) => {
        // the card's ground takes the backlight's light; frame 0's (tm < 0) is the hook's own
        const key = tm < 0 ? null : endGroundKey(T, tm, false);
        const hook = { x: 160, y: 1560, strength: 0.35, color: '#d9d4cf', radius: 760 };
        const k = key ? key.strength / 0.3 : 0;
        return (
          <PearlGround
            t={tm}
            keyLight={key && k > 0.001 ? { x: mix(hook.x, key.x, k), y: mix(hook.y, key.y, k), strength: mix(hook.strength, key.strength + 0.12, k), color: key.color, radius: mix(hook.radius, 900, k) } : hook}
          />
        );
      }}
      orb={() => {
        // the seam: the wordmark has left (IgEnd: by E.seam); she glides down onto the desk and closes into the phone's
        // light (frame 0's dot), arriving a frame before the loop
        const g = tween(f, [E.seam, T.DURATION - 2], [0, 1], EASE.inOut);
        const pose = { x: mix(PARK.x, DESK.x1, g), y: mix(PARK.y, DESK.y, g), d: PARK.d, moving: g > 0 && g < 1 };
        return <AvaOrb t={f} pose={pose} canvas={PARK.d} track={track} close={{ at: E.seam + 2, dur: T.DURATION - 4 - E.seam, dot: DESK.dot, t0: T.DURATION }} />;
      }}
      seam={(th) => <Ig1Frame0 t={th} dot={false} />}
    />
  );
};
