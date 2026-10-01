/**
 * 0–4 s · HOOK — black. A point of light; the #demo clock unfolds from it
 * and flicks through the site's four moments 3 sixteenths apart — the rush, just
 * after closing, a Sunday — each a hard change of light (the colon orb, the
 * figures, a bloom in the black, the day drum), and LANDS on 03:12 in the
 * night's violet. The phone rings: the colon orb pulses, two rings leave it,
 * the line goes live. Time freezes mid-ring — the rings hang in the air and
 * creep — and "Your business is closed." rises underneath. The frozen world
 * breathes on the beats while the camera inhales into the break.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { noise2D } from '@remotion/noise';
import { Camera, Layer } from '../components/Camera';
import { Dust } from '../components/Dust';
import { HookLine } from '../components/Shared';
import { HOOK_LINE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { bloom, GLOW, lightAt } from '../lib/lights';
import { aos, EASE, mix, mixHex, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, TRACK } from '../theme';
import { FPS, HOOK, HOOK_LOCAL, SCENES } from '../timing';
import { chainPos, ClockLockup, flickDisp, type Flick } from './hook/Clock';
import { DayDrum, type DrumRow } from './hook/DayDrum';
import { MOMENTS, NUM_STOPS, numFill } from './hook/moments';
import { Rings, ringTravel } from './hook/Rings';
import { StaggerText } from './hook/StaggerText';
import { Wave } from './hook/Wave';
import { Bokeh } from './hook/Bokeh';
import { rgba } from './hook/color';
import { MOTES, Motes } from './hook/Motes';
import { warpTime } from './hook/warp';
import { DitheredVignette } from './hook/Dither';

/** A 1-frame light hit that decays (peaks on `at`). */
const hit = (f: number, at: number, decay = 4) => (f < at - 1 ? 0 : f < at ? 0.35 : Math.exp(-(f - at) / decay));
/** Alpha-function bump peaking `peak` frames after `at` (camera kicks). */
const bump = (f: number, at: number, peak = 3) => {
  const x = (f - at) / peak;
  return x <= 0 ? 0 : x * Math.exp(1 - x);
};
/** A beat spike ON frame B: a 3-frame dip, a spring up that peaks on the beat, a spring back
 *  (with its small undershoot). ≈ 0 → −0.2 → 1 → −0.07 → 0. */
const spike = (f: number, B: number) =>
  aos(f, B - 3, { anticip: 3, depth: 0.2, config: SPRING.pop }) -
  aos(f, B + 2, { anticip: 0, depth: 0, config: SPRING.site });
/** An eased swell ON frame B: up over `rise` frames, down over `fall` (EASE.inOut). */
const swellOn = (f: number, B: number, rise: number, fall: number) =>
  tween(f, [B - rise, B], [0, 1], EASE.inOut) * (1 - tween(f, [B, B + fall], [0, 1], EASE.inOut));

export const Hook: React.FC = () => {
  const f = useSceneFrame('hook');
  const global = f + SCENES.hook.from;
  const L = useLayout();
  const M = HOOK_LOCAL.moments;

  /* ── world time: stops at the freeze, then crawls ────────────────── */
  const tau = (x: number) => warpTime(x, HOOK.freeze, HOOK_LOCAL.freezeEase, HOOK_LOCAL.frozenRate);
  const t = tau(f);

  /* ── geometry ────────────────────────────────────────────────────── */
  const F = L.pick(250, 210);
  const cellH = 1.1 * F;
  const glyphH = 0.74 * F; // the figures' drawn height (Instrument Sans lining figures)
  const orbD = L.pick(56, 48);
  const gap = 0.15 * F;
  const clockCy = L.pick(L.cy - 150, L.cy - 260);
  const labelFs = L.pick(36, 34); // RINGING (a status)
  const labelHalf = 0.6 * labelFs; // half the label's line box
  // the moment names are what plants the four lights: a size up from the status, read on a phone
  const momentFs = L.pick(48, 44);
  // the labels sit ≥ 34 px (16:9) / 40 px (9:16) clear of the figures, the wave ≥ 26 / 30 px under RINGING
  const labelCy = clockCy - glyphH / 2 - L.pick(34, 40) - 0.6 * momentFs;
  const phaseCy = clockCy + glyphH / 2 + L.pick(34, 40) + labelHalf;
  const waveMaxH = L.pick(30, 44);
  const waveCy = phaseCy + labelHalf + L.pick(26, 30) + waveMaxH;

  /* ── focus pull: once the line is up, the clock falls slightly out of focus ─ */
  const rack = tween(f, [HOOK.textIn + 6, HOOK.textIn + 30], [0, 1], EASE.inOut);

  /* ── the end: the world defocuses behind the line ────────────────── */
  const out = global >= SCENES.hook.to ? 1 : tween(f, HOOK_LOCAL.out, [0, 1], EASE.inOut);
  const inhale = tween(f, [HOOK_LOCAL.anticipation, HOOK_LOCAL.anticipation + 9], [0, 1], EASE.in4);

  /* ── the ring's attack frames (one ahead of the beat) ────────────── */
  const ringAt = HOOK.ring - HOOK_LOCAL.ringLead; // 55
  const ringBAt = HOOK_LOCAL.ringB - HOOK_LOCAL.ringLead; // 62

  /* ── the beat breaths of the frozen world (ON b6, b7) ────────────── */
  const breaths = HOOK_LOCAL.breathBeats;
  const pulseB = breaths.reduce((s, B) => s + spike(f, B), 0); // orb, wave
  const ringBreath = breaths.reduce((s, B) => s + swellOn(f, B, 3, 5), 0); // rings: 8 f
  // the line's lilac light (out by 110, so the light in the line box is steady across the 111 | 112 handoff)
  const glowBreath = breaths.reduce((s, B) => s + swellOn(f, B, 4, 5), 0);

  /* ── camera: the push, kicks on the hits, an inhale into the break ── */
  const flickKick = bump(f, M[1], 2) + bump(f, M[2], 2);
  const zoom =
    1 +
    0.042 * tween(f, [0, HOOK_LOCAL.pushTurn], [0, 1], EASE.inOut) +
    0.035 * tween(f, [HOOK_LOCAL.pushTurn, SCENES.hook.to - 1], [0, 1], EASE.in2) +
    0.005 * flickKick +
    0.014 * bump(f, HOOK.clockLand, 3) +
    0.012 * bump(f, ringAt, 2) + // peaks 2 f after the attack, already 82 % on the ring frame
    0.008 * bump(f, HOOK.textIn, 2) +
    0.003 * breaths.reduce((s, B) => s + bump(f, B - 1, 2), 0) +
    0.03 * out;
  const camX = 7 * noise2D('hook-cam-x', f * 0.011, 0.3);
  const camY = 5 * noise2D('hook-cam-y', 0.7, f * 0.011) - 3 * bump(f, HOOK.clockLand, 2) - 1.5 * flickKick;

  /* ── THE FOUR LIGHTS: the orb + bloom change ON each landing ──────── */
  const lightKeys = MOMENTS.map((m, i) => ({
    at: i === 0 ? 0 : M[i] - HOOK_LOCAL.lightLead,
    light: m.id,
    frames: i === MOMENTS.length - 1 ? 3 : 2, // hard changes: ≈ 86 % there one frame in
    stagger: m.id === 'closing' ? 0.12 : 0,
  }));
  const S = lightAt(f, lightKeys, 3);
  // the moment on screen (the last one whose light has started)
  const mi = lightKeys.reduce((k, key, i) => (f >= key.at ? i : k), 0);

  /* ── light ───────────────────────────────────────────────────────── */
  const land = hit(f, HOOK.clockLand, 4);
  const flickHit = hit(f, M[0], 5) + hit(f, M[1], 5) + hit(f, M[2], 5);
  const ringHit = hit(f, HOOK.ring, 5);
  const ringHitB = hit(f, HOOK_LOCAL.ringB, 5);
  const textHit = hit(f, HOOK.textIn, 6);
  // one-frame hiccup on the text beat: the frozen wave + phase dot catch the same light
  const beatTick = hit(f, HOOK.textIn, 1.5);
  const textGlowW = L.pick(1500, 1040);
  const textGlowH = L.pick(340, 520);
  const textGlowCol = mixHex(C.paper, C.lilac, 0.45);
  const field =
    tween(f, [HOOK_LOCAL.fieldIn, HOOK.clockLand], [0, 0.15], EASE.inOut) +
    tween(f, [HOOK.clockLand, HOOK.cameraPush[1]], [0, 0.25], EASE.inOut) +
    0.14 * land +
    0.1 * ringHit +
    0.05 * textHit +
    0.09 * glowBreath;
  // the moment's pool of light behind the clock: born with the orb, a pulse on every flick,
  // the biggest on the land, flashes on the rings, and a breath on the beats of the hold
  const pool =
    tween(f, [HOOK_LOCAL.orbIn, M[0]], [0, 0.2], EASE.out3) * (1 - 0.35 * tween(f, [HOOK.clockLand, HOOK.textIn], [0, 1], EASE.inOut)) +
    0.42 * flickHit +
    0.62 * land +
    0.4 * ringHit +
    0.26 * ringHitB +
    0.3 * glowBreath +
    // the inhale gathers light into the clock before the break
    0.2 * tween(f, [HOOK_LOCAL.pushTurn, HOOK_LOCAL.anticipation - 1], [0, 1], EASE.in2);

  /* ── the clock: four flicks through the four moments ─────────────── */
  const flicks: Flick[][] = [0, 1, 2, 3].map((c) =>
    MOMENTS.slice(1).map((m, k) => {
      const from = MOMENTS[k].digits[c];
      const H = M[k + 1];
      return {
        // a full turn plus the difference, as the site spins its figures
        delta: 10 + ((((m.digits[c] - from) % 10) + 10) % 10),
        start: H - HOOK_LOCAL.flickTravel - (3 - c) * HOOK_LOCAL.flickStagger,
        land: H,
      };
    }),
  );
  const posAt = (c: number, fr: number) => chainPos(fr, MOMENTS[0].digits[c], flicks[c]);
  // each figure takes the new light — a hard cut — as its strip passes the middle of its
  // travel (fully smeared there), so no in-between hue ever shows on the figures
  const fills = [0, 1, 2, 3].map((c) => {
    const j = flicks[c].reduce((n, k, i) => (f >= (k.start + k.land) / 2 ? i + 1 : n), 0);
    return numFill(NUM_STOPS[MOMENTS[j].id]);
  });
  // the pairs unfold from under the orb: the orb draws in (the anticipation),
  // then they spring out, overshoot, settle — already in the rush light
  const unfold = aos(f, HOOK_LOCAL.figuresIn, { anticip: 3, depth: 0.1, config: SPRING.site });
  const orbDraw = 1 + 1.1 * Math.min(0, unfold); // ≈0.89 on figuresIn
  // a light sweep crosses the figures just after they land (left → right, staggered)
  const sheens = [0, 1, 2, 3].map((i) => {
    const s0 = HOOK_LOCAL.sheen + i * 1.5 + (i >= 2 ? 1.5 : 0);
    return f < s0 ? -1 : f > s0 + 11 ? 2 : tween(f, [s0, s0 + 11], [0, 1], EASE.inOut);
  });
  // the orb's birth glint: a short horizontal catch-light, no wider than the
  // lockup, that retracts into the figures as they unfold
  const lockupW = 2.4 * F + 2 * gap + orbD;
  const streakBirth =
    f < HOOK_LOCAL.orbIn
      ? 0
      : Math.exp(-(f - HOOK_LOCAL.orbIn - 1) / 5) * tween(f, [HOOK_LOCAL.orbIn, HOOK_LOCAL.orbIn + 1], [0, 1]);
  const streakW = mix(120, 0.9 * lockupW, EASE.expo(Math.min(1, Math.max(0, f - HOOK_LOCAL.orbIn) / 10)));
  const figuresOpacity =
    (tween(f, [HOOK_LOCAL.figuresIn - 1, HOOK_LOCAL.figuresIn + 3], [0, 0.86], EASE.out3) +
      tween(f, [HOOK.clockLand - 2, HOOK.clockLand], [0, 0.14], EASE.inOut)) *
    (1 - out);
  // gone by the time the figures are up, so it never strikes through them
  const streakO = 0.6 * streakBirth * (1 - Math.min(1, figuresOpacity / 0.3));
  // colon orb: born in the black, a pop on every flick, pulses with each ring (1 → 1.8), then breathes
  const born = aos(f, HOOK_LOCAL.orbIn, { anticip: 0, depth: 0, config: SPRING.pop });
  // pulse(at): a dip that bottoms out on the attack frame `at`, then an
  // alpha-function thump peaking 1–2 frames later (≈1.0 on at+1 and at+2)
  const pulse = (at: number) => {
    const x = t - at;
    if (x < -2) return 0;
    if (x <= 0) return -0.1 * Math.sin(((x + 2) / 2) * (Math.PI / 2)); // anticipation dip
    const k = x / 1.5;
    return k * Math.exp(1 - k) - 0.1 * Math.max(0, 1 - x);
  };
  const frozen = tween(f, [HOOK.freeze, HOOK.freeze + 16], [0, 1], EASE.inOut);
  const pulseSum = (pulse(ringAt) + 0.8 * pulse(ringBAt)) * (1 - frozen);
  const flickPop = 0.14 * (bump(f, M[1] - 1, 1.5) + bump(f, M[2] - 1, 1.5)) + 0.22 * bump(f, HOOK.clockLand - 1, 1.5);
  // 1 → 1.8 on the first ring (the site's phase-dot pulse), ≈1.65 on the second; +3 % on the beats of the hold
  const orbScale =
    Math.max(0, born) * orbDraw * (1 + flickPop + 0.85 * pulseSum + (0.012 + 0.03 * pulseB) * frozen);
  const orbFlash = Math.min(1, 0.6 * ringHit + 0.45 * ringHitB + 0.5 * land + 0.4 * flickHit + 0.25 * frozen + 0.2 * pulseB * frozen);
  // the lockup buzzes like a handset while the burst lasts (world time):
  // an alternating per-frame jitter, as a 25 Hz motor looks at 30 fps
  const burstEnv =
    t >= ringAt && t < HOOK.ring + HOOK.ringBurst + 4
      ? tween(t, [ringAt, ringAt + 2], [0, 1], EASE.out3) *
        tween(t, [HOOK.ring + HOOK.ringBurst, HOOK.ring + HOOK.ringBurst + 4], [1, 0], EASE.out3)
      : 0;
  const buzzK = Math.floor(t);
  const buzzX = 2.2 * burstEnv * ((buzzK % 2) * 2 - 1) * (0.6 + 0.4 * random(`hook-buzz-x-${buzzK}`));
  const buzzY = 1.1 * burstEnv * (random(`hook-buzz-y-${buzzK}`) * 2 - 1);
  const clockKick =
    1 +
    0.03 * bump(f, HOOK.clockLand, 2.5) +
    0.01 * flickKick -
    0.012 * tween(f, [HOOK.clockLand - 3, HOOK.clockLand], [0, 1], EASE.in2) * (f < HOOK.clockLand ? 1 : 0);

  /* ── the day drum (rolls with the strips) ────────────────────────── */
  // the first row rolls up at the figures' pace; the later rows hold until the figures are
  // already smeared, then snap in ON the hit (the mechanism's last part to let go)
  const drumFlicks: Flick[] = M.map((H, i) => {
    const land = i === 0 ? HOOK_LOCAL.drumIn : H;
    return { start: land - (i === 0 ? HOOK_LOCAL.flickTravel : HOOK_LOCAL.drumTravel), land, delta: 1 };
  });
  const drumAt = (fr: number) => drumFlicks.reduce((p, k) => p + flickDisp(fr, k), -1);
  const drumPos = drumAt(f);
  const drumSpeed = 2 * (drumAt(f + 0.25) - drumAt(f - 0.25));
  const drumRows: DrumRow[] = MOMENTS.map((m) => ({
    text: m.label,
    color: m.id === 'night' ? C.paper : GLOW[m.id].core,
    dot: GLOW[m.id].core,
    glow: GLOW[m.id].body,
  }));

  /* ── labels ──────────────────────────────────────────────────────── */
  const labelStyle: React.CSSProperties = {
    fontFamily: FONT.body,
    fontWeight: 500,
    fontSize: labelFs,
    lineHeight: 1.2,
    letterSpacing: TRACK.label,
    textTransform: 'uppercase',
  };
  const phaseDotIn = aos(f, HOOK.ring - 2, { anticip: 2, depth: 0.2, config: SPRING.pop });
  // the site's ringing dot: 1 → 1.8, four yoyo halves of 0.25 s, power2.out
  const dotPulse = (() => {
    const x = (t - HOOK.ring) / 7.5;
    if (x < 0 || x >= 4) return 1;
    const k = Math.floor(x);
    const fr = x - k;
    const e = (u: number) => 1 - (1 - u) * (1 - u);
    return 1 + 0.8 * (k % 2 === 0 ? e(fr) : e(1 - fr));
  })();
  const phaseDim = Math.min(1, 1 - 0.08 * tween(f, [HOOK.freeze, HOOK.freeze + 12], [0, 1], EASE.house) + 0.3 * beatTick);
  const phaseDot = L.pick(13, 12);

  /* ── motes: born faint, frozen with the world ────────────────────── */
  const dustIn = tween(f, HOOK_LOCAL.dustIn, [0.35, 1], EASE.house);
  const lensIn = tween(f, [HOOK.clockIn, HOOK.clockLand + 10], [0, 1], EASE.inOut) * (1 - out);
  const motes = L.pick(MOTES.landscape, MOTES.vertical);

  /* ── the rings: their outer one hangs at a set radius by the end of the hold (its top stays
        inside the frame through the push); their lower arcs dissolve before RINGING, the wave
        and the headline ───────────────────────────────────────────── */
  const ringD0 = orbD * 1.25;
  const ringR = L.pick(330, 370); // ring A's radius at the last frame of the hold
  const ringD1 = ringD0 + (2 * ringR - ringD0) / ringTravel(tau(HOOK_LOCAL.textHandoff - 1) - ringAt);
  const ringMask = `linear-gradient(180deg, #000 0px, #000 ${(clockCy + cellH * 0.5).toFixed(0)}px, rgba(0,0,0,0.4) ${phaseCy.toFixed(0)}px, transparent ${(waveCy - 8).toFixed(0)}px)`;

  /* ── bloom box behind the clock (an ellipse ≈ 2× the lockup) ──────── */
  const poolW = L.pick(1500, 1060);
  const poolH = L.pick(760, 820);

  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      <Camera x={camX} y={camY} zoom={zoom}>
        {/* 0.6 — the far plane: the cover field + pigment wash, and the far bokeh */}
        <Layer depth={0.6}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(${L.pick('62% 50% at 52% 32%', '92% 38% at 52% 35%')}, ${C.fieldHigh}, ${C.fieldMid} 46%, transparent 72%)`,
              opacity: Math.min(0.66, field),
            }}
          />
          <AbsoluteFill
            style={{
              // the pigment takes the moment's deep colour (the night's is the cover's plum)
              background: `radial-gradient(${L.pick('40% 36% at 50% 36%', '64% 26% at 50% 36%')}, ${rgba(mi === 3 ? mixHex(S.orb[1], C.plum, 0.5) : S.orb[1], 0.26)}, transparent 72%)`,
              opacity: tween(f, [HOOK_LOCAL.orbIn, HOOK.clockLand], [0, 1], EASE.inOut) * (0.7 + 0.3 * frozen),
            }}
          />
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Bokeh
              t={t}
              frame={f}
              width={L.width}
              count={L.pick(4, 5)}
              seed={L.pick('hook-bokeh-l', 'hook-bokeh-v')}
              opacity={0.15}
              band={[L.pick(60, 260), L.pick(620, 1080)]}
            />
          </AbsoluteFill>
        </Layer>

        {/* 0.9 — the moment's light, pooled behind the clock (screen) + the line's breath of light */}
        <Layer depth={0.9}>
          <div
            style={{
              position: 'absolute',
              left: L.cx - poolW / 2,
              top: clockCy - poolH / 2,
              width: poolW,
              height: poolH,
              background: bloom(S.glow, pool * (1 - out), { core: 0.35, coreSize: 0.36 }),
              mixBlendMode: 'screen',
            }}
          />
          {/* the text beat (and the breaths of the hold): a lilac-white light where the line sits */}
          <div
            style={{
              position: 'absolute',
              left: L.cx - textGlowW / 2,
              top: HOOK_LINE(L).cy - textGlowH / 2,
              width: textGlowW,
              height: textGlowH,
              background: `radial-gradient(closest-side, ${rgba(textGlowCol, 0.15 * textHit + 0.22 * glowBreath)}, ${rgba(textGlowCol, 0.05 * textHit + 0.07 * glowBreath)} 55%, ${rgba(textGlowCol, 0)} 100%)`,
            }}
          />
        </Layer>

        {/* 1.0 — the rings (behind the figures, as on the site) */}
        <Layer depth={1} style={{ maskImage: ringMask, WebkitMaskImage: ringMask }}>
          <Rings
            frame={f}
            tau={tau}
            rings={[
              { start: ringAt, hang: 0.74 },
              { start: ringBAt, hang: 0.95 },
            ]}
            cx={L.cx}
            cy={clockCy}
            d0={ringD0}
            d1={ringD1}
            freeze={HOOK.freeze}
            decayEnd={HOOK_LOCAL.anticipation}
            out={out}
            inhale={inhale}
            shockD={L.pick(420, 380)}
            breath={ringBreath}
          />
        </Layer>

        {/* 1.0 — the clock lockup + the day drum */}
        <Layer depth={1}>
          {streakO > 0.01 ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: L.cx - streakW / 2,
                  top: clockCy + L.pick(4, 3) - 14,
                  width: streakW,
                  height: 28,
                  background: `radial-gradient(50% 50% at 50% 50%, ${rgba(S.glow.core, 0.32 * streakO)}, ${rgba(S.glow.core, 0)})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: L.cx - streakW / 2,
                  top: clockCy + L.pick(4, 3) - 1,
                  width: streakW,
                  height: 2,
                  background: `linear-gradient(90deg, ${rgba(S.glow.core, 0)}, ${rgba(C.paper, 0.85 * streakO)} 50%, ${rgba(S.glow.core, 0)})`,
                }}
              />
            </>
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: clockCy - cellH / 2,
              height: cellH,
              display: 'flex',
              justifyContent: 'center',
              transform: `translate(${buzzX.toFixed(2)}px, ${buzzY.toFixed(2)}px) scale(${(clockKick * (1 + 0.05 * out)).toFixed(4)})`,
              filter: [
                `drop-shadow(0 0 26px ${rgba(S.glow.core, 0.28)})`,
                rack + out > 0.01 ? `blur(${(1.3 * rack + 18 * out).toFixed(2)}px)` : '',
                rack > 0.01 ? `brightness(${(1 - 0.16 * rack).toFixed(3)})` : '',
                land + flickHit > 0.02 ? `brightness(${(1 + 0.45 * land + 0.3 * flickHit).toFixed(3)})` : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            }}
          >
            <ClockLockup
              frame={f}
              posAt={posAt}
              fills={fills}
              sheens={sheens}
              fontSize={F}
              orbSize={orbD}
              gap={gap}
              unfold={unfold}
              orbScale={orbScale}
              orbTime={7.3 + f / FPS}
              orbPalette={S.orb}
              glowBody={S.glow.body}
              glowCore={S.glow.core}
              orbFlash={orbFlash}
              orbDy={L.pick(4, 3)}
              figuresOpacity={figuresOpacity}
              orbOpacity={Math.min(1, Math.max(0, born) * 1.2) * (1 - out)}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: labelCy,
              transform: 'translateY(-50%)',
              opacity: 1 - out,
            }}
          >
            <DayDrum
              rows={drumRows}
              pos={drumPos}
              speed={drumSpeed}
              fontSize={momentFs}
              width={L.width}
              dotSize={L.pick(24, 22)}
            />
          </div>
        </Layer>

        {/* 1.0 — phase line + the wave */}
        <Layer depth={1}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: phaseCy,
              transform: 'translateY(-50%)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: Math.round(labelFs * 0.42),
              opacity: (1 - out) * phaseDim,
              color: mixHex(C.paperDim, C.paper, 0.4),
            }}
          >
            <div
              style={{
                width: phaseDot,
                height: phaseDot,
                borderRadius: '50%',
                background: C.callerLit,
                transform: `scale(${(Math.max(0, phaseDotIn) * dotPulse).toFixed(3)})`,
                boxShadow: `0 0 ${(6 + 10 * (dotPulse - 1) + 10 * beatTick).toFixed(1)}px ${rgba(C.callerLit, 0.35 + 0.4 * (dotPulse - 1) + 0.4 * beatTick)}`,
              }}
            />
            <StaggerText
              text="Ringing"
              frame={f}
              start={HOOK.ring - 1}
              stagger={1}
              style={{ ...labelStyle, marginRight: `-${TRACK.label}` }}
            />
          </div>
          <Wave
            frame={f}
            t={t}
            cx={L.cx}
            cy={waveCy}
            pitch={13}
            barW={4}
            maxH={waveMaxH}
            drawIn={HOOK_LOCAL.waveIn}
            ring={ringAt}
            burst={HOOK.ringBurst}
            freeze={HOOK.freeze}
            decayEnd={HOOK_LOCAL.anticipation}
            out={out}
            tick={beatTick}
            breath={pulseB}
          />
        </Layer>

        {/* 1.6 — foreground motes, frozen with the world (they creep) */}
        <Layer depth={1.6}>
          <AbsoluteFill style={{ opacity: dustIn * (1 - out) }}>
            <Dust
              count={16}
              seed="hook-motes"
              opacity={0.32}
              size={[2, 6]}
              blur={[0, 2.5]}
              speed={0.3}
              frame={t + 200}
            />
          </AbsoluteFill>
        </Layer>

        {/* 1.65 — big near motes in the empty zones: they hang at the freeze
            while the push carries on through them */}
        <Layer depth={1.65}>
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Motes motes={motes} plane="near" t={t} frame={f} opacity={1} />
          </AbsoluteFill>
        </Layer>

        {/* 2.3 — the nearest plane: a few big defocused motes right at the lens */}
        <Layer depth={2.3}>
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Motes motes={motes} plane="lens" t={t} frame={f} opacity={1} />
          </AbsoluteFill>
        </Layer>
      </Camera>

      {/* the shared vignette, dithered inside its own blend: no 8-bit rings on the near-black */}
      <DitheredVignette frame={f} />

      {/* The line. Screen space, never transformed here — the twist takes it over at 112. */}
      {global < HOOK_LOCAL.textHandoff ? <HookLine start={HOOK.textIn} /> : null}
    </AbsoluteFill>
  );
};
