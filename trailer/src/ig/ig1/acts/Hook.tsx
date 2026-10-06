/**
 * REEL 1 · b1 HOOK (docs/ig/SCRIPT.md ig1 §4 b1) — frame 0's composition, drawn in the stage's camera plane
 * (Stage.tsx: the slow push 1.00 → 1.02 over the hook) and, by the end card's seam, at hook time t − END ∈ [−14, 0)
 * (zoom 1), so the loop re-forms into exactly this still:
 *
 *   · S1 "Don't fire your / receptionist / for an AI." — headline 92, left at x 86, rows at y 420 · 524 · 628, SET at
 *     frame 0 at 72 % ink (each word lifting to full ink on her onset with a 1-frame rose glint); "fire" in rose ink
 *   · the desk (desk.ts): a 1.5 px graphite hairline at y 760 drawing x 86 → 906 (EASE.draw 0.6 s from f −6: moving at
 *     frame 0), the front desk's phone at its right end — the rose line light (Ø 18) — a pair of rings leaving it on each trill
 *     (f0, f30; DeskRings), travelling out across the empty frame, its rose light on the ground (stage.ts PHONE_KEY)
 *   · THE TURN: at "Not" − 2 S1 leaves up through its masks and "Not even ours" rises at y 520 (display 112, her teal);
 *     its full stop is HER ORB (Stage.tsx Ig1Orb: Ø 40, popping in as the last word lands, breathing on her voice)
 *   · THE WEEK: as "Not even ours." leaves, the desk line hands over to the week grid unfolding out of it (WeekGrid):
 *     the hairline thins away under the spreading rows, the phone's light goes out
 */
import React from 'react';
import { EASE, smooth, tween } from '../../../lib/motion';
import { GRAPHITE } from '../../../kb/theme';
import { MOMENT_LIGHTS } from '../../../kb/palettes';
import { Captions, captionScreens, layoutScreen, retextScreens, type CapPlace } from '../../components/Captions';
import { PearlGround } from '../../components/Ground';
import { LineLight } from '../../components/Orb';
import { DESK, RING_LIFE } from '../desk';
import { groundKeyAt } from '../stage';
import * as T from '../timing';

export { DESK };
const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;

/** S1 (SCRIPT: rows at y 420 · 524 · 628 → a 104 px pitch) and S2 (display 112 at y 520, her teal) */
export const S1: CapPlace = { x: 86, y: 420, maxWidth: 820, align: 'left', role: 'headline', size: 92, lineHeight: 104 / 92, rows: [3, 4] };
export const S2: CapPlace = { x: 86, y: 520, maxWidth: 820, align: 'left', role: 'display', size: 112, color: SUNDAY.ink };
/** "ours" without its full stop: the full stop is her orb */
const RETEXT = { 9: 'ours' } as const;
const KEYS = [{ words: [1], ink: RUSH.ink }] as const;

/** the reel's pearl ground: MUTED_MESH, warmed toward graphite from the low left, already drifting at f0; the sunday
 *  pool rising behind the week in b3 (stage.ts groundKeyAt) */
export const Ig1Ground: React.FC<{ t: number }> = ({ t }) => <PearlGround t={t} keyLight={groundKeyAt(t)} />;

/** Frame 0's composition at hook time t (frame 0 = t 0; the end card's seam draws it at t ∈ [−14, 0)). */
export const Ig1Frame0: React.FC<{ t: number; dot?: boolean }> = ({ t, dot = true }) => {
  const draw = tween(t, DESK.draw, [0, 1], EASE.draw);
  // the week takes the desk line over: the hairline thins away under the unfolding rows, the phone's light goes out
  const hand = tween(t, [T.M.unfold, T.M.unfold + 6], [0, 1], EASE.inOut);
  const lineA = 0.62 * (1 - hand);
  const out = tween(t, [T.M.unfold - 2, T.M.unfold + 5], [0, 1], EASE.in3);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        {draw > 0 && lineA > 0.002 ? (
          <line x1={DESK.x0} y1={DESK.y} x2={DESK.x0 + (DESK.x1 - DESK.x0) * draw} y2={DESK.y} stroke={GRAPHITE.tag} strokeOpacity={lineA.toFixed(4)} strokeWidth={1.5} strokeLinecap="round" />
        ) : null}
      </svg>
      <DeskRings t={t} out={out} />
      {dot && out < 1 ? <LineLight t={t} x={DESK.x1} y={DESK.y} d={DESK.dot * (1 - 0.6 * smooth(0, 1, out))} rings={DESK.rings} opacity={1 - out} /> : null}
      <Captions T={T} id="ig1-01" t={t} place={(k) => (k === 0 ? S1 : S2)} keys={KEYS} glint={RUSH.orb[2]} retext={RETEXT} skip={t < 0 ? [1] : []} what="hook" />
    </>
  );
};

/**
 * THE PHONE RINGING (film 1 hook/Rings' RingPulse, the desk's own): each ring a rose hairline leaving the phone's light
 * and travelling out across the desk and the empty frame below it (Ø 1400 over RING_LIFE frames, power2.out — fast off
 * the light, settling as it widens), thinning and fading as it goes; a pair per trill burst (desk.ts DESK.rings).
 * Pure function of t (frame 0's ring is already leaving; the seam re-forms it).
 */
const RING_D1 = 1400;
const DeskRings: React.FC<{ t: number; out: number }> = ({ t, out }) => {
  const live = DESK.rings.filter((s) => t >= s && t < s + RING_LIFE);
  if (!live.length || out >= 0.999) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {live.map((s, i) => {
        const age = t - s;
        const u = Math.min(1, age / RING_LIFE);
        const e = 1 - (1 - u) * (1 - u);
        const born = tween(t, [s, s + 1.5], [0, 1], EASE.out3);
        const young = Math.max(0, 1 - age / 12);
        const w = 1.6 + 1.2 * young;
        // the pair's second ring a touch fainter (the chirp's echo)
        const a = (0.5 + 0.3 * young) * (i % 2 ? 0.72 : 1) * born * Math.pow(1 - e, 1.05) * (1 - out);
        const r = Math.max(0, (DESK.dot + (RING_D1 - DESK.dot) * e) / 2 - w / 2);
        return <circle key={s} cx={DESK.x1} cy={DESK.y} r={r.toFixed(3)} fill="none" stroke={RUSH.orb[2]} strokeOpacity={a.toFixed(4)} strokeWidth={w.toFixed(3)} />;
      })}
    </svg>
  );
};

/** where her full stop sits (in the plane): just after "ours", on its baseline (needs the faces) */
export function fullStop(): { x: number; y: number } {
  const s = retextScreens(captionScreens(T, 'ig1-01'), RETEXT)[1];
  const lay = layoutScreen(s.tokens, S2);
  const last = lay.pos[lay.pos.length - 1];
  const size = 112;
  // a period's side bearing ≈ .1 em, then the orb's own radius; centred a little above the baseline (Instrument Sans:
  // baseline .97 em below the top of a 1.22 em box; a full stop's dot sits on it)
  return { x: last.x + last.w + 0.1 * size + 20, y: lay.top + (lay.font.lineHeight - 1.22) * size * 0.5 + 0.97 * size - 0.17 * size };
}
