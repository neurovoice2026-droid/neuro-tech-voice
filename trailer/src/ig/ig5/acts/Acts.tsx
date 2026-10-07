/**
 * REEL 5 · "Three rings" — THE ACTS (docs/ig/ig5/SCRIPT.md §2, HOOKS.md §1):
 *
 *   hook · agency · answering · ours · setup · does
 *        ONE continuous stage (../stage/Stage.tsx Stage5: pure functions of the absolute frame), mounted by each act's
 *        <Sequence> at its own frames, so an act boundary is invisible:
 *          b1 the ringing desk (three rings in flight at f0) and "Three rings. / Gloves on. / You can't."
 *          b2 the agency quote slip (AI receptionist, "$300" commonly a month, the setup stub "often $1,500")
 *          b3 the live answering service slip ("from $99 a month, for 50 minutes"), the camera easing back
 *          b4 the pickup on "Ours?": the rose light opens into her orb, the quotes square up into a pile on one scale,
 *             ours rises under them — "Ours? From $49 a month● No setup fee." — bars to scale from one $0 point
 *          b5 the pile leaves, ours glides up, four set-up dots fill
 *          b6 ours parks as a chip; the sample call: the orb picks up the ringing dot, Answered → Booked
 *   end  b7–b9: the shared end card (components/End.tsx IgEnd) — the record pulled back and up over the CTA, the chip in
 *        the label band, her orb docked on the record; into the bar she steps aside to the chip's place and GROWS to
 *        the series' brand size (Ø 96, ig1's P2), arriving ON the impact so nothing travels while the wordmark
 *        surfaces (crit-r1 P5); the record goes out under the light; the wordmark and the URL. SEAM: as the brand
 *        leaves she glides down the right of the frame onto the desk (landing 8 f before the loop) and closes into the
 *        phone's rose light while frame 0 re-forms (../stage/Hook.tsx Frame0 at t − END: the desk hairline redrawing,
 *        the ring trio's launches already travelling — fading in as she lands, never round an empty point, crit-r1
 *        SEAM-1 / P10 — S1 rising into its masks), the ground crossing to frame 0's: the replay continues the picture
 */
import React from 'react';
import { EASE, mix, mixHex, tween } from '../../../lib/motion';
import { END, endGroundKey, IgEnd } from '../../components/End';
import { useActFrame } from '../../scene';
import { Frame0, RING_FLASHES } from '../stage/Hook';
import { PHONE } from '../stage/layout';
import { Chip } from '../stage/Ours';
import { dockAt, RecordCard } from '../stage/Record';
import { BandCaptions, Ground5, groundKeyAt, Orb5, orbPose, Stage5 } from '../stage/Stage';
import * as T from '../timing';

/** one of the stage's acts: the stage at the act's absolute frame */
export function stageAct(key: T.SceneKey): React.FC {
  const Act: React.FC = () => {
    const t = useActFrame(T.SCENES, key);
    return <Stage5 t={T.SCENES[key].from + t} />;
  };
  Act.displayName = `ig5-${key}`;
  return Act;
}

/** the card's light on the pearl (IgEnd pearlLook; ig1's and ig3's numbers, so the series' cards land alike): a
 *  near-white heart in a saturated teal corona, her burst on the bar wide enough to read on a light ground */
const PEARL_LOOK = { stops: ['#f0fdff', '#5ccde1', '#97e0ed', '#d2f2f7'], core: 0.3, burst: 3.2 } as const;
/** the light's last stretch (u 0 → 1 from the brand's exit to the last frame): out as frame 0's caption settles */
const LIGHT_TAIL = (u: number) => Math.pow(Math.max(0, 1 - u), 1.5);
/** the impact's flash on the ground (ig1's): her teal pool thrown wide on the bar, settling into the card's light */
const FLASH = { strength: 0.42, tau: 7, color: '#8fdfec', radius: 760 } as const;

/** the card's ground: the stage's (her pool) taking the backlight's light; frame 0's (tm < 0) is the hook's */
function endGround(tm: number) {
  const E = T.END_CARD;
  const base = groundKeyAt(tm);
  if (tm < 0) return <Ground5 t={tm} keyLight={base} />;
  const key = endGroundKey(T, tm, false);
  const fl = tm < E.impact - 1 ? 0 : FLASH.strength * Math.min(1, tm - (E.impact - 1)) * Math.exp(-Math.max(0, tm - E.impact) / FLASH.tau);
  const k = Math.min(1, key.strength / 0.3 + fl / FLASH.strength);
  const kc = key.strength > 0.001 ? key.color : FLASH.color;
  return (
    <Ground5
      t={tm}
      keyLight={
        k > 0.001
          ? { x: mix(base.x, END.P.x, k), y: mix(base.y, END.P.y, k), strength: mix(base.strength, key.strength + 0.12, k) + fl, color: mixHex(base.color, mixHex(kc, FLASH.color, fl / FLASH.strength), k), radius: mix(base.radius, mix(900, FLASH.radius, fl / FLASH.strength), k) }
          : base
      }
    />
  );
}

/** where she waits through the brand: the parked chip's place at the top right (the chip leaves on the bar), at the
 *  series' brand size (ig1's P2: (840, 290), Ø 96), so her seam glide down to the phone runs down the right of the
 *  frame, clear of the re-forming hook card */
const PARK = { x: 836, y: 320, d: 96 } as const;
/** she steps aside and grows into the bar, done ON the impact (the wordmark surfaces with nothing else moving) */
const STEP_ASIDE = [T.IMPACT - 14, T.IMPACT] as const;
/** the seam glide: from as the brand starts leaving (End.tsx BRAND_OUT: seam − CAP_OUT) onto the desk 8 f before the
 *  loop, so the trio's rings (fading in from t −10) always have their light */
const SEAM_GLIDE = [T.END_CARD.seam - 6, T.END_CARD.seam + 6] as const;
/** her pose on the card: docked on the pulled-back record; as the record goes out on the bar she steps aside to the
 *  top right (where the chip was) */
/** the step-aside's path: she lifts off the record's header to a lane between it and the chip (y 420, clear of both:
 *  the record pulled back to y 458–618 since crit-r2 P4, the chip ends y 366), glides right along it, and rises into
 *  the corner only once the chip has gone up (its last 30 %) — never over a word */
const LANE_Y = 420;
function endOrbPose(t: number) {
  const p = orbPose(t);
  if (t < STEP_ASIDE[0]) return p;
  const a = orbPose(STEP_ASIDE[0]);
  const u = tween(t, STEP_ASIDE, [0, 1], (v) => v);
  const x = mix(a.x, PARK.x, EASE.inOut(u));
  const lift = EASE.out3(Math.min(1, u / 0.4));
  const rise = EASE.in3(Math.max(0, (u - 0.7) / 0.3));
  const y = mix(mix(a.y, LANE_Y, lift), PARK.y, rise);
  return { x, y, d: mix(a.d, PARK.d, EASE.inOut(u)), moving: u < 1 };
}
/** her orb on the card; in the seam she glides down onto the desk and closes into the phone's rose light — frame 0's
 *  dot, breathing on frame 0's clock */
const EndOrb: React.FC<{ t: number }> = ({ t }) => {
  const E = T.END_CARD;
  if (t < SEAM_GLIDE[0]) return <Orb5 t={t} pose={endOrbPose(t)} />;
  const from = endOrbPose(SEAM_GLIDE[0]);
  const g = tween(t, SEAM_GLIDE, [0, 1], EASE.inOut);
  const pose = { x: mix(from.x, PHONE.x, g), y: mix(from.y, PHONE.y, g), d: from.d, moving: g < 1 };
  return <Orb5 t={t} pose={pose} close={{ at: E.seam + 2, dur: T.DURATION - 4 - E.seam, dot: PHONE.d, t0: T.DURATION, rings: RING_FLASHES }} />;
};

export const End5: React.FC = () => {
  const f = T.SCENES.end.from + useActFrame(T.SCENES, 'end');
  return (
    <IgEnd
      T={T}
      t={f}
      tone="pearl"
      ground={(tm) => endGround(tm)}
      backdrop={() => (
        <>
          <RecordCard t={f} />
          <Chip t={f} />
          <BandCaptions t={f} />
        </>
      )}
      orb={() => <EndOrb t={f} />}
      seam={(th) => <Frame0 t={th} phone={false} />}
      pearlLook={PEARL_LOOK}
      lightTail={LIGHT_TAIL}
    />
  );
};

export const ACTS5: { readonly [key: string]: React.FC } = {
  hook: stageAct('hook'),
  agency: stageAct('agency'),
  answering: stageAct('answering'),
  ours: stageAct('ours'),
  setup: stageAct('setup'),
  does: stageAct('does'),
  end: End5,
};

export { dockAt };
