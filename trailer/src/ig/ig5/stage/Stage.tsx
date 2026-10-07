/**
 * REEL 5 · THE STAGE — b1–b6 are ONE continuous picture (docs/ig/ig5/SCRIPT.md §2), so each act's <Sequence> mounts this
 * same stage at its own absolute frame (every part a pure function of it: an act boundary is invisible), bottom to top:
 *
 *   ground    the pearl (MUTED_MESH, light), its warm key low-left with the phone's rose pool round the light (swelling
 *             as each ring leaves it); on "Ours?" the phone's pool goes and her sunday pool rises behind ours (1 s), and
 *             follows ours up in b5
 *   desk      Hook.tsx: the hairline, the ring trio, the phone's single rings (R1 and ring 2), the rose line light
 *             (until the pickup)
 *   papers    Papers.tsx: the agency slip, the setup stub, the answering slip; the square-up; the pile's exit
 *   rings     the phone's last ring (ring 3, after slip 2 has risen) is drawn OVER the papers and kept small (Ø 150),
 *             so it reads as a whole ring round the light under slip 2, never a half-ring stuck under a card (crit-r2 P8)
 *   ours      Ours.tsx: the $49 card, its fold into the parked chip; the set-up track
 *   record    Record.tsx: the sample call
 *   orb       HER ORB, born once, on the pickup: the rose line light springs open into her (components/Orb AvaOrb born:
 *             a 3-frame seed, SPRING.pop, the palette crossing rush → sunday over 6 f) and, once ours has landed,
 *             glides (0.53 s on a LINEAR clock under the path's own eases, crit-r2 B1 — the house ease on top made it a
 *             2-frame dart) to ours' full stop after "a month", Ø 44, breathing on her voice; it rides ours up in b5; on "It" it stays
 *             where the full stop was as ours folds away, and ("It picks up") it hops over to the record's ringing rose
 *             dot — x out ahead of y, so she comes DOWN onto the dot from above and never crosses SAMPLE CALL (crit-r2
 *             P9), 11 f from "It" + 3 — landing on the vowel of "up" (M.dock: its stamp sits on the p closure, crit-r1 S1 / SYNC-1); on the
 *             click (M.up) she pulses once (× 1.08) as she takes the call (crit-r2 S-R2-1), and stays docked there as
 *             the agent, leaning into its listen palette
 *   S1        Hook.tsx HookCard (frame 0's card, leaving line by line)
 *   captions  the set-up and does lines in the caption band (x 86, y 1180, ≤ 814 → x 900), word-synced through the
 *             Captions fork (NUDGE where the aligner's stamp is off her energy; a row never ends on "the" / "a" / "an");
 *             the quotes' and the payoff's words print on their papers instead, so every word is on screen once (the
 *             band is empty in b2–b4, ig2 / ig4's idiom, crit-r1 P4); the CTA is the end card's
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, mix, mixHex, SPRING, springUnit, tween } from '../../../lib/motion';
import { useKitFaces } from '../../../kb/kit';
import { MOMENT_LIGHTS } from '../../../kb/palettes';
import { Captions, captionScreens, layoutScreen, type CapKey, type CapPlace } from '../../components/Captions';
import { PearlGround } from '../../components/Ground';
import { AvaOrb, orbTrack, type OrbTrack } from '../../components/Orb';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { DeskLine, HookCard, Phone, PhoneRings, RING_FLASHES, TrioRings } from './Hook';
import { CAP, OURS, PHONE, RECORD, TRIO } from './layout';
import { Chip, fullStopAt, Ours, OURS_UP, oursY, Track } from './Ours';
import { Papers } from './Papers';
import { dockAt, RecordCard } from './Record';

const M = T.M;
const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;

/* ── the ground's light ── */
/** the warm key low-left (ig1's hook key: the pearl warmed toward graphite) */
const HOOK_KEY = { x: 160, y: 1560, strength: 0.35, color: '#d9d4cf', radius: 760 } as const;
/** the phone's rose pool round the light, swelling as a ring leaves it */
const PHONE_KEY = { x: PHONE.x, y: PHONE.y - 40, strength: 0.24, color: '#f2b8c9', radius: 760 } as const;
/** her sunday pool behind ours (b4), following it up (b5–b6) */
const POOL_KEY = { x: 520, y: OURS.y4 + 150, strength: 0.32, color: '#bfeef5', radius: 980 } as const;
const ringSwell = (t: number) => RING_FLASHES.reduce((m, r) => (t < r ? m : Math.max(m, Math.min(1, (t - r) / 2) * Math.exp(-Math.max(0, t - r - 2) / 12))), 0);
export const phoneAt = (t: number) => 1 - tween(t, [M.pickup, M.pickup + 12], [0, 1], EASE.inOut);
export const poolAt = (t: number) => tween(t, [M.ours, M.ours + 30], [0, 1], EASE.inOut);
export function groundKeyAt(t: number) {
  const k = poolAt(t);
  const up = springUnit(t - OURS_UP, SPRING.site);
  const pool = { ...POOL_KEY, y: mix(POOL_KEY.y, OURS.y5 + 150, up) };
  const base = { x: mix(HOOK_KEY.x, pool.x, k), y: mix(HOOK_KEY.y, pool.y, k), strength: mix(HOOK_KEY.strength, pool.strength, k), color: mixHex(HOOK_KEY.color, pool.color, k), radius: mix(HOOK_KEY.radius, pool.radius, k) };
  const ph = phoneAt(t);
  if (ph <= 0) return base;
  const s = PHONE_KEY.strength * (0.8 + 0.4 * ringSwell(t));
  return { x: mix(base.x, PHONE_KEY.x, ph), y: mix(base.y, PHONE_KEY.y, ph), strength: mix(base.strength, s, ph), color: mixHex(base.color, PHONE_KEY.color, ph), radius: mix(base.radius, PHONE_KEY.radius, ph) };
}
export const Ground5: React.FC<{ t: number; keyLight?: React.ComponentProps<typeof PearlGround>['keyLight'] }> = ({ t, keyLight }) => <PearlGround t={t} keyLight={keyLight ?? groundKeyAt(t)} />;

/* ── her orb ── */
/** her orb's canvas: ≥ the largest d she is shown at (the brand's Ø 96, Acts.tsx PARK) */
export const ORB_CANVAS = 96;
/** the lift of her glide onto the record (px at mid-glide) */
const ORB_ARC = 90;
/** she listens while docked on the record (the call), until the CTA */
const LISTEN: readonly (readonly [number, number])[] = [[M.up, T.END_CARD.cta - 6]];
export const track5 = (): OrbTrack => orbTrack(T, { listen: LISTEN });
/** her pose at t (b4–b7; the seam's glide back to the phone is the end act's) */
export function orbPose(t: number): { x: number; y: number; d: number; moving: boolean } {
  const D = OURS.orbD;
  if (t < M.glide[0]) return { x: PHONE.x, y: PHONE.y, d: D, moving: false };
  if (t < M.it) {
    const stop = fullStopAt(t);
    // a LINEAR clock (crit-r2 B1): the path's eases (x out3, y inOut) are the only easing on it
    const g = tween(t, M.glide, [0, 1], (v) => v);
    // the glide: right first, then down onto the baseline (it never crosses "month")
    const x = mix(PHONE.x, stop.x, EASE.out3(g));
    const y = mix(PHONE.y, stop.y, EASE.inOut(g));
    const o = oursY(t);
    return { x, y, d: D, moving: g < 1 || !!o?.moving };
  }
  // b6: on "It" ours folds away from her; then ("It picks up") she hops onto the record's rose dot, landing on the
  // vowel of "up": her x arrives over the dot first (power2.inOut over the hop's first 80 %), the arc and the descent
  // finish after it — so the last stretch is a soft drop onto the dot from above, never across the header's words
  // (crit-r2 P9); 11 f for ≈ 560 px (peak ≈ 115 px/f: in the 7 f between "picks" and "up" it was a dart)
  const from = fullStopAt(M.it);
  const u = tween(t, HOP, [0, 1], (v) => v);
  const dock = dockAt(t);
  const dd = RECORD.orbD * dock.s;
  const x = mix(from.x, dock.x, EASE.draw(Math.min(1, u / 0.8)));
  const y = mix(from.y, dock.y, u) - ORB_ARC * Math.sin(Math.PI * EASE.draw(Math.min(1, u / 0.95)));
  return { x, y, d: mix(D, dd, EASE.inOut(u)) * (1 + TAKE.k * takePulse(t)), moving: u > 0 };
}
/** her hop onto the record's dot: from 3 f after "It" (ours' words are gone by "It" + 4 and the folding card lifts above
 *  her path; she has moved 17 px by then) to the vowel of "up" */
const HOP = [M.it + 3, M.dock] as const;
/** she takes the call: one pulse on the click of "up" (× 1.08 at + 2.5 f, back by ≈ + 12 f) — the picture's beat under
 *  the fx-pickup (crit-r2 S-R2-1) */
const TAKE = { k: 0.08, peak: 2.5 } as const;
const takePulse = (t: number) => {
  const x = (t - M.up) / TAKE.peak;
  return x <= 0 ? 0 : x * Math.exp(1 - x);
};
export const Orb5: React.FC<{ t: number; pose?: { x: number; y: number; d: number; moving: boolean }; close?: React.ComponentProps<typeof AvaOrb>['close'] }> = ({ t, pose, close }) => {
  const ready = useKitFaces();
  if (!ready || t < M.pickup) return null;
  const p = pose ?? orbPose(t);
  return (
    <>
      <AvaOrb t={t} pose={p} canvas={ORB_CANVAS} track={track5()} born={{ at: M.pickup, dot: PHONE.d }} close={close} rim={0.8} shadow={0.35} />
      {t >= M.pickup + 4 ? <ZoneRect what="object orb" rect={{ x: p.x - p.d / 2, y: p.y - p.d / 2, w: p.d, h: p.d }} /> : null}
    </>
  );
};

/* ── the captions ── */
export const CAP5: CapPlace = { x: CAP.x, y: CAP.y, maxWidth: CAP.maxWidth, align: 'left', role: 'caption' };
/** the narrator's lines in the band (the hook is S1; the quotes print on their slips and the payoff on ours — one place
 *  per word, crit-r1 P4; the CTA is the end card's) */
const BAND = [T.CAST.setup, T.CAST.does] as const;
/** a row never ends on an article: where the balanced wrap leaves "the" / "a" / "an" at a row's end ("and books the /
 *  appointment."), that row breaks before it (crit-r1 P9) */
const ARTICLE = /^(the|a|an)$/i;
function placeOf(id: T.VoiceId): (k: number) => CapPlace {
  // measured when Captions asks (its faces are loaded by then)
  return (k) => {
    const s = captionScreens(T, id, { nudge: T.NUDGE[id] })[k];
    if (!s) return CAP5;
    const starts = layoutScreen(s.tokens, CAP5).rows.map((r) => r.tokens[0]).slice(1);
    const fixed = starts.map((st) => (st > 1 && ARTICLE.test(s.tokens[st - 1].text) ? st - 1 : st));
    return fixed.some((f, i) => f !== starts[i]) ? { ...CAP5, rows: fixed } : CAP5;
  };
}
/** the anchors in the captions take the phone's rose on their onsets (the display map's "$300", "$1,500.", "$99") */
const keysOf = (id: string): CapKey[] =>
  T.DISPLAY.filter((d) => d.id === id && d.text.startsWith('$')).map((d) => ({ words: Array.from({ length: d.to - d.from + 1 }, (_, i) => d.from + i), ink: RUSH.ink, glint: RUSH.orb[2] }));
export const BandCaptions: React.FC<{ t: number }> = ({ t }) => (
  <>
    {BAND.map((id) => (
      <Captions key={id} T={T} id={id} t={t} place={placeOf(id)} keys={keysOf(id)} timing={{ nudge: T.NUDGE[id] }} what="caption" />
    ))}
  </>
);

/* ── the stage ── */
export const Stage5: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <Ground5 t={t} />
    <DeskLine t={t} />
    {t < TRIO.life + 1 ? <TrioRings t={t} /> : null}
    <PhoneRings t={t} under />
    {t < M.pickup ? <Phone t={t} /> : null}
    <Papers t={t} />
    <PhoneRings t={t} />
    <Ours t={t} />
    <Track t={t} />
    <RecordCard t={t} />
    <Chip t={t} />
    <Orb5 t={t} />
    <HookCard t={t} />
    <BandCaptions t={t} />
  </AbsoluteFill>
);

export { SUNDAY };
