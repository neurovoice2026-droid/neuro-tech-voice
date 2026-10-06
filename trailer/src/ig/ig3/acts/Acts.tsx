/**
 * REEL 3 · "Twelve minutes" — THE ACTS (docs/ig/SCRIPT.md ig3 §3–4), each drawing the stage (../Stage.tsx: every part a
 * pure function of the absolute frame, null outside its window) over its own window of the reel's timeline:
 *
 *   hook    [0, PICKUP)       b1–b2: frame 0 — the colour timer at 12:00 ticking in real seconds, the phone's rose light
 *                             ringing across the room, "Twelve minutes on the colour." set; the tug on "up"; the over-time
 *                             zone darkening on "over-processes"; the phone's light dimming on "elsewhere"
 *   call    [PICKUP, HANGUP)  b3–b5: the click; the dimmed light springs open into her orb; the timer stays centred and
 *                             time-lapses over her rows (the call strip in the lower stage); in the caller's turn (the
 *                             meter) it steps aside to the top right and the service list rises in the middle stage with
 *                             the dashboard's tool step and the teal sweep under the Trim line
 *   payoff  [HANGUP, CTA)     b6: 00:00 on the hang-up — the timer springs back to centre, its ring closes, the check; the
 *                             Answered record; "Timer's done. Caller's sorted." · "You never looked up."
 *   end     [CTA, END)        b7–b9: the shared end card (components/End.tsx) over the done timer stepped up and back, the
 *                             salon's list rising again under the field on "price list."; in
 *                             the seam her orb closes back into the phone's light as frame 0 re-forms (12:00, rose, ringing)
 */
import React from 'react';
import { IgEnd } from '../../components/End';
import { useActFrame } from '../../scene';
import { endGround, Ig3Frame0, Orb3, PayoffCaptions, RecordCard, ServicesPage, Stage3, Timer3 } from '../Stage';
import * as T from '../timing';

const act = (key: 'hook' | 'call' | 'payoff') => {
  const Act: React.FC = () => {
    const f = T.SCENES[key].from + useActFrame(T.SCENES, key);
    return <Stage3 t={f} />;
  };
  Act.displayName = `ig3-${key}`;
  return Act;
};
export const Hook3 = act('hook');
export const Call3 = act('call');
export const Payoff3 = act('payoff');

/** the card's light on the pearl (IgEnd pearlLook; ig1's numbers, so the series' cards land alike): a near-white heart
 *  in a saturated teal corona, her burst on the bar wide enough to read on a light ground — the hit lands as light */
const PEARL_LOOK = { stops: ['#f0fdff', '#5ccde1', '#97e0ed', '#d2f2f7'], core: 0.3, burst: 3.2 } as const;
/** the light's last stretch (u 0 → 1 from the brand's exit to the last frame): out as frame 0's caption settles */
const LIGHT_TAIL = (u: number) => Math.pow(Math.max(0, 1 - u), 1.5);

export const End3: React.FC = () => {
  const f = T.SCENES.end.from + useActFrame(T.SCENES, 'end');
  return (
    <IgEnd
      T={T}
      t={f}
      tone="pearl"
      ground={(tm) => endGround(tm)}
      backdrop={() => (
        <>
          <Timer3 t={f} />
          <RecordCard t={f} />
          <PayoffCaptions t={f} />
          <ServicesPage t={f} end />
        </>
      )}
      orb={() => <Orb3 t={f} />}
      seam={(th) => <Ig3Frame0 t={th} dot={false} />}
      pearlLook={PEARL_LOOK}
      lightTail={LIGHT_TAIL}
    />
  );
};
