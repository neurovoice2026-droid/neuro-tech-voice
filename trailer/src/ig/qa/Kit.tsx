/**
 * THE REELS' SHARED PARTS ON ONE PAGE (QA specimen IG-Kit-9x16, folder IG-QA; not a reel): the parts of
 * docs/ig/SCRIPT.md §5 on ig2's real timeline (src/ig/ig2/timing.ts), on the night ground, so they can be judged in
 * motion on real word timings before any reel uses them —
 *   the rose line light ringing (Orb LineLight + Rings) → her birth on the pickup (AvaOrb born) → her glide to the label
 *   band; a white call panel (kit Panel) with ● SAMPLE CALL, the LiveTranscript (her rows word-synced, the caller's
 *   meter rows, the scroll), two ToolRows (the spinner → the drawn check), the header swapping to the Booked pill on
 *   the hang-up; and the four OutcomePills.
 * The real ig2 call act (build step 6) is the reel's; this page only proves the parts.
 */
import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';
import { waitForFonts } from '../../lib/fonts';
import { EASE, mix, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { Panel, Swap, meshShadowInk, useKitFaces } from '../../kb/kit';
import { GRAPHITE } from '../../kb/theme';
import { INK_MESH, MOMENT_LIGHTS } from '../../kb/palettes';
import { LiveTranscript, ToolRow, type Turn } from '../components/Call';
import { IgFinish } from '../components/Finish';
import { NightGround } from '../components/Ground';
import { OutcomePill } from '../components/OutcomePill';
import { AvaOrb, orbTrack, Rings } from '../components/Orb';
import { ZoneProvider } from '../components/ZoneGuard';
import { useTimelineFrame } from '../scene';
import * as T2 from '../ig2/timing';

export const KIT_FRAMES = T2.DURATION;

const SUNDAY = MOMENT_LIGHTS.sunday;
const RUSH = MOMENT_LIGHTS.rush;
const at = (id: string) => T2.VOICES.find((v) => v.id === id)!.at;
const TURNS: Turn[] = [
  { who: 'ava', id: 'ig2-02', keys: [{ words: [5, 6, 7], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
  { who: 'caller', from: T2.CALLERS[0][0], to: T2.CALLERS[0][1] },
  { who: 'ava', id: 'ig2-03' },
  { who: 'caller', from: T2.CALLERS[1][0], to: T2.CALLERS[1][1] },
  { who: 'ava', id: 'ig2-04' },
  { who: 'caller', from: T2.CALLERS[2][0], to: T2.CALLERS[2][1] },
  { who: 'ava', id: 'ig2-05', keys: [{ words: [3], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
];

export const KitSpecimen: React.FC = () => {
  useState(() => waitForFonts());
  const ready = useKitFaces();
  const t = useTimelineFrame();
  const P = T2.PICKUP;
  const colon = { x: 540, y: 420 };
  const park = { x: 160, y: 296, d: 132 };
  const g = tween(t, [P + 8, P + 26], [0, 1], EASE.inOut);
  const pose = { x: mix(colon.x, park.x, g), y: mix(colon.y, park.y, g), d: 132, moving: g > 0 && g < 1 };
  const listen = T2.CALLERS.map(([a, b]) => [a, b] as const);
  const track = orbTrack(T2, { listen });
  const panelIn = tween(t, [P - 25, P + 6], [0, 1], EASE.out3);
  const ink = meshShadowInk(INK_MESH);
  const label = typeStyle('label', true, { tone: 'paper', size: 28 });
  const tool1 = at('ig2-03') + T2.vWord('ig2-03', 0);
  const tool2 = at('ig2-05') + T2.vWord('ig2-05', 3);
  return (
    <ZoneProvider value={{ on: false, reel: 'kit', frame: t, cover: false }}>
      <AbsoluteFill style={{ background: '#06040a' }}>
        <NightGround t={t} keyLight={{ x: pose.x, y: pose.y, strength: 0.45, color: t < P ? RUSH.orb[1] : SUNDAY.orb[1], radius: 520 }} />
        {/* the phone ringing until the pickup, then her birth and her glide to the label band */}
        <Rings t={t} at={T2.RINGS} x={colon.x} y={colon.y} d0={22} d1={220} color={RUSH.orb[2]} />
        {ready ? <AvaOrb t={t} pose={t < P + 3 ? { x: colon.x, y: colon.y, d: 132 } : pose} canvas={132} track={track} born={{ at: P + 3, dot: 22 }} shadow={0} /> : null}
        {/* the call panel */}
        {panelIn > 0 ? (
          <Panel x={86} y={400} w={820} h={780} radius={44} lift={3} ink={ink} k={1.4} dy={(1 - panelIn) * 700} clip={false}>
            <div style={{ position: 'absolute', left: 48, top: 40, height: 48, width: 400 }}>
              <Swap t={t} at={T2.HANGUP} rise={30}>
                <div style={{ ...label, color: GRAPHITE.tag, display: 'flex', alignItems: 'center', gap: 14, height: 48 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: GRAPHITE.tag }} />
                  SAMPLE CALL
                </div>
                <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
                  <OutcomePill kind="booked" size={28} />
                </div>
              </Swap>
            </div>
          </Panel>
        ) : null}
        {panelIn > 0.98 ? (
          <>
            <LiveTranscript T={T2} t={t} turns={TURNS} spec={{ x: 134, y: 520, w: 724, h: 400, size: 52 }} />
            <ToolRow t={t} label="Checked your availability" x={134} y={950} at={tool1} done={tool1 + 24} exitAt={tool2 - 8} />
            <ToolRow t={t} label="Booked an appointment" x={134} y={950} at={tool2} done={tool2 + 10} />
            <div style={{ position: 'absolute', left: 134, top: 1030, width: 724, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {(['booked', 'answered', 'messageTaken', 'transferred'] as const).map((k, i) => (
                <OutcomePill key={k} kind={k} size={26} t={t} at={P + 40 + i * 4} />
              ))}
            </div>
          </>
        ) : null}
        <IgFinish white={0} />
      </AbsoluteFill>
    </ZoneProvider>
  );
};
