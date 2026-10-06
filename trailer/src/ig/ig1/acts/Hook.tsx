/**
 * REEL 1 · b1 HOOK (docs/ig/SCRIPT.md ig1 §4 b1) — built on the shared parts (components/Captions, Orb) as the first
 * consumer of the Captions fork's frame-0 set mode, and as the composition the end card's seam re-forms.
 *
 *   FRAME 0 (Ig1Frame0, a pure function of the hook time t — also drawn by the end card at t − END ∈ [−14, 0), so the
 *   loop re-forms into exactly this still):
 *     · S1 "Don't fire your / receptionist / for an AI." — headline 92, left at x 86, rows at y 420 · 524 · 628, set at
 *       frame 0 at 72 % ink (each word lifting to full ink on her onset with a 1-frame rose glint); "fire" in rose ink
 *     · the desk: a 1.5 px graphite hairline at y 760 drawing x 86 → 906 (EASE.draw 0.6 s from f −6: moving at f0)
 *     · the front desk's phone at its right end: the rose line light (Ø 18), a rose ring leaving it at f0 and f30
 *   THE TURN: at "Not" − 2 S1 leaves up through its masks and "Not even ours" rises at y 520 (display 112, her teal);
 *   its full stop is HER ORB (Ø 40, popping in as the last word lands, breathing on her voice).
 *
 * The rest of b1 (the camera push, the sound hits) is the reel's to build (build step 6).
 */
import React from 'react';
import { EASE, tween } from '../../../lib/motion';
import { GRAPHITE } from '../../../kb/theme';
import { MOMENT_LIGHTS } from '../../../kb/palettes';
import { useKitFaces } from '../../../kb/kit';
import { Captions, captionScreens, layoutScreen, retextScreens, type CapPlace } from '../../components/Captions';
import { PearlGround } from '../../components/Ground';
import { AvaOrb, LineLight, orbTrack, Rings } from '../../components/Orb';
import { useActFrame } from '../../scene';
import * as T from '../timing';

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;

/** S1 (SCRIPT: rows at y 420 · 524 · 628 → a 104 px pitch) and S2 (display 112 at y 520, her teal) */
export const S1: CapPlace = { x: 86, y: 420, maxWidth: 820, align: 'left', role: 'headline', size: 92, lineHeight: 104 / 92, rows: [3, 4] };
export const S2: CapPlace = { x: 86, y: 520, maxWidth: 820, align: 'left', role: 'display', size: 112, color: SUNDAY.ink };
/** the desk: its hairline and the phone at its right end */
export const DESK = { y: 760, x0: 86, x1: 906, dot: 18, draw: [-6, 12] as const, rings: [0, 30] as const };
/** "ours" without its full stop: the full stop is her orb */
const RETEXT = { 9: 'ours' } as const;
const KEYS = [{ words: [1], ink: RUSH.ink }] as const;

/** the hook's ground: the pearl MUTED_MESH, warmed toward graphite from the low left, already drifting at f0 */
export const Ig1Ground: React.FC<{ t: number }> = ({ t }) => <PearlGround t={t} keyLight={{ x: 160, y: 1560, strength: 0.35, color: '#d9d4cf', radius: 760 }} />;

/** Frame 0's composition at hook time t (frame 0 = t 0; the end card's seam draws it at t ∈ [−14, 0)). */
export const Ig1Frame0: React.FC<{ t: number; dot?: boolean }> = ({ t, dot = true }) => {
  const draw = tween(t, DESK.draw, [0, 1], EASE.draw);
  // the desk leaves with S1 as the grid comes in (the reel's hours act takes over at HOURS)
  const out = tween(t, [T.HOURS - 6, T.HOURS], [0, 1], EASE.in3);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        {draw > 0 ? <line x1={DESK.x0} y1={DESK.y} x2={DESK.x0 + (DESK.x1 - DESK.x0) * draw} y2={DESK.y} stroke={GRAPHITE.tag} strokeOpacity={0.62 * (1 - out)} strokeWidth={1.5} strokeLinecap="round" /> : null}
      </svg>
      <Rings t={t} at={DESK.rings} x={DESK.x1} y={DESK.y} d0={DESK.dot} d1={190} color={RUSH.orb[2]} out={out} />
      {dot ? <LineLight t={t} x={DESK.x1} y={DESK.y} d={DESK.dot} rings={DESK.rings} opacity={1 - out} /> : null}
      <Captions T={T} id="ig1-01" t={t} place={(k) => (k === 0 ? S1 : S2)} keys={KEYS} glint={RUSH.orb[2]} retext={RETEXT} skip={t < 0 ? [1] : []} what="hook" />
    </>
  );
};

/** where her full stop sits: just after "ours", on its baseline */
function fullStop(): { x: number; y: number } {
  const s = retextScreens(captionScreens(T, 'ig1-01'), RETEXT)[1];
  const lay = layoutScreen(s.tokens, S2);
  const last = lay.pos[lay.pos.length - 1];
  const size = 112;
  // the period's place: a small gap after the word, centred a little above the baseline (Instrument Sans: baseline
  // .97 em below the top of a 1.22 em box; a full stop's dot sits on it)
  // (a period's side bearing ≈ .1 em, then the orb's own radius: it sits where the full stop would)
  return { x: last.x + last.w + 0.1 * size + 20, y: lay.top + (lay.font.lineHeight - 1.22) * size * 0.5 + 0.97 * size - 0.17 * size };
}

export const Ig1Hook: React.FC = () => {
  const ready = useKitFaces();
  const t = useActFrame(T.SCENES, 'hook');
  const f = T.SCENES.hook.from + t;
  const stop = ready ? fullStop() : { x: 0, y: 0 };
  const ours = T.VOICES[0].at + T.vWord('ig1-01', 9);
  const S2out = T.SCENES.hook.to;
  return (
    <>
      <Ig1Ground t={f} />
      <Ig1Frame0 t={f} />
      {ready ? (
        <AvaOrb t={f} pose={{ x: stop.x, y: stop.y, d: 40 }} canvas={120} track={orbTrack(T)} pop={{ at: ours + 2 }} opacity={1 - tween(f, [S2out - 4, S2out], [0, 1], EASE.in3)} rim={0.8} />
      ) : null}
    </>
  );
};
