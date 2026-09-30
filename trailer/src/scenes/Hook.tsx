/**
 * 0–4 s · HOOK — black. A point of light; the #demo clock unfolds from it
 * and rolls onto 03:12. The phone rings: the colon orb pulses, two rings
 * leave it, the line goes live. Time freezes mid-ring — the rings hang in
 * the air — and "Your business is closed." rises underneath.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { noise2D } from '@remotion/noise';
import { Camera, Layer } from '../components/Camera';
import { Dust } from '../components/Dust';
import { Vignette } from '../components/Grain';
import { HookLine } from '../components/Shared';
import { CornerDot } from '../components/Type';
import { HOOK_LINE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, breathe, EASE, mix, mixHex, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, TRACK } from '../theme';
import { b, FPS, HOOK, SCENES } from '../timing';
import { ClockLockup, type Roll } from './hook/Clock';
import { Rings } from './hook/Rings';
import { StaggerText } from './hook/StaggerText';
import { Wave } from './hook/Wave';
import { Bokeh } from './hook/Bokeh';
import { rgba } from './hook/color';
import { MOTES, Motes } from './hook/Motes';
import { warpTime } from './hook/warp';

// LOCAL TIMING - hoist into timing.ts
/** The twist mounts (and starts drawing the line) at 112 = SCENES.twist.from − pre.
 *  HOOK.anticipation = b(7.5) rounds to 113; it should be b(7.5) − 1 = 112 = this. */
const HANDOFF = SCENES.twist.from - SCENES.twist.pre; // 112 (global = hook-local: the hook starts at 0)
const HOOK_LOCAL = {
  dustIn: [0, 12] as const, // the faint motes come up out of the black
  fieldIn: 3, // the cover field starts to bloom
  orbIn: b(0.25), // 4  — the colon orb lights, alone in the black
  figuresIn: b(0.6), // 9  — "00 ◉ 00" unfolds dimly out of the orb
  digitStagger: 2, // frames between the four strips leaving
  /** Every ring attack leaves this many frames before its beat, so the beat frame is the peak. */
  ringLead: 1,
  ringB: b(3) + 7, // 52 — second ring of the burst
  waveIn: b(2.5), // 38 — the dotted wave row draws out from the centre
  freezeEase: 3, // frames for world time to stop
  frozenRate: 0.04, // world speed once frozen (the rings creep, never quite stop)
  anticipation: HANDOFF, // 112 — the inhale; the hanging rings/wave finish decaying
  /** 112 → 120: the world defocuses and is gone ON the shatter downbeat (1.5 % left at 119). */
  out: [HANDOFF, SCENES.hook.to] as const,
  /** Last frame the hook draws the line is textHandoff − 1. */
  textHandoff: HANDOFF, // 112 (global)
};

/** A 1-frame light hit that decays (peaks on `at`). */
const hit = (f: number, at: number, decay = 4) => (f < at - 1 ? 0 : f < at ? 0.35 : Math.exp(-(f - at) / decay));
/** Alpha-function bump peaking `peak` frames after `at` (camera kicks). */
const bump = (f: number, at: number, peak = 3) => {
  const x = (f - at) / peak;
  return x <= 0 ? 0 : x * Math.exp(1 - x);
};

export const Hook: React.FC = () => {
  const f = useSceneFrame('hook');
  const global = f + SCENES.hook.from;
  const L = useLayout();

  /* ── world time: stops at the freeze ─────────────────────────────── */
  const tau = (x: number) => warpTime(x, HOOK.freeze, HOOK_LOCAL.freezeEase, HOOK_LOCAL.frozenRate);
  const t = tau(f);

  /* ── geometry ────────────────────────────────────────────────────── */
  const F = L.pick(250, 210);
  const cellH = 1.1 * F;
  const orbD = L.pick(56, 48);
  const gap = 0.15 * F;
  const clockCy = L.pick(L.cy - 150, L.cy - 260);
  const labelCy = clockCy - cellH / 2 - L.pick(30, 34);
  const phaseCy = clockCy + cellH / 2 + L.pick(38, 58);
  const waveCy = phaseCy + L.pick(64, 92);

  /* ── focus pull: once the line is up, the clock falls slightly out of focus ─ */
  const rack = tween(f, [HOOK.textIn + 6, HOOK.textIn + 30], [0, 1], EASE.inOut);

  /* ── the end: the world defocuses behind the line ────────────────── */
  const out = global >= SCENES.hook.to ? 1 : tween(f, HOOK_LOCAL.out, [0, 1], EASE.inOut);
  const inhale = tween(f, [HOOK_LOCAL.anticipation, HOOK_LOCAL.anticipation + 9], [0, 1], EASE.in4);

  /* ── the ring's attack frames (one ahead of the beat) ────────────── */
  const ringAt = HOOK.ring - HOOK_LOCAL.ringLead; // 44
  const ringBAt = HOOK_LOCAL.ringB - HOOK_LOCAL.ringLead; // 51

  /* ── camera: slow push, kicks on the beats ───────────────────────── */
  const zoom =
    1 +
    0.06 * tween(f, HOOK.cameraPush, [0, 1], EASE.inOut) +
    0.014 * bump(f, HOOK.clockLand, 3) +
    0.012 * bump(f, ringAt, 2) + // peaks on 46, already 82 % on the beat
    0.008 * bump(f, HOOK.textIn, 2) +
    0.03 * out;
  const camX = 7 * noise2D('hook-cam-x', f * 0.011, 0.3);
  const camY = 5 * noise2D('hook-cam-y', 0.7, f * 0.011) - 3 * bump(f, HOOK.clockLand, 2);

  /* ── light ───────────────────────────────────────────────────────── */
  const land = hit(f, HOOK.clockLand, 4);
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
    0.05 * textHit;

  /* ── the clock ───────────────────────────────────────────────────── */
  const target = [0, 3, 1, 2];
  const rolls: Roll[] = target.map((d, i) => ({
    from: 0,
    to: 10 + d, // a full turn plus the difference
    start: HOOK.clockIn + i * HOOK_LOCAL.digitStagger,
    land: HOOK.clockLand,
  }));
  // the pairs unfold from under the orb: the orb draws in (the anticipation,
  // while the figures are still dark), then they spring out, overshoot, settle
  const unfold = aos(f, HOOK_LOCAL.figuresIn, { anticip: 3, depth: 0.1, config: SPRING.site });
  const orbDraw = 1 + 1.1 * Math.min(0, unfold); // ≈0.89 on figuresIn
  // a light sweep crosses the figures just after they land (left → right, staggered)
  const sheens = target.map((_, i) => {
    const s0 = HOOK.clockLand + 1 + i * 1.5 + (i >= 2 ? 1.5 : 0);
    return f < s0 ? -1 : f > s0 + 11 ? 2 : tween(f, [s0, s0 + 11], [0, 1], EASE.inOut);
  });
  // the orb's birth glint: a short horizontal catch-light, no wider than the
  // lockup, that retracts into the figures as they unfold (none on the land —
  // it would strike through the time)
  const lockupW = 2.4 * F + 2 * gap + orbD;
  const streakBirth =
    f < HOOK_LOCAL.orbIn
      ? 0
      : Math.exp(-(f - HOOK_LOCAL.orbIn - 1) / 5) * tween(f, [HOOK_LOCAL.orbIn, HOOK_LOCAL.orbIn + 1], [0, 1]);
  const streakW = mix(120, 0.9 * lockupW, EASE.expo(Math.min(1, Math.max(0, f - HOOK_LOCAL.orbIn) / 10)));
  const figuresOpacity =
    (tween(f, [HOOK_LOCAL.figuresIn, HOOK.clockIn], [0, 0.4], EASE.house) +
      tween(f, [HOOK.clockIn + 2, HOOK.clockLand], [0, 0.6], EASE.inOut)) *
    (1 - out);
  // gone by the time the figures are up, so it never strikes through them
  const streakO = 0.6 * streakBirth * (1 - Math.min(1, figuresOpacity / 0.3));
  // colon orb: born in the black, pulses with each ring (1 → 1.8), then breathes
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
  // 1 → 1.8 on the first ring (the site's phase-dot pulse), ≈1.65 on the second
  const orbScale = Math.max(0, born) * orbDraw * (1 + 0.85 * pulseSum + breathe(f, 48, 0.035) * frozen);
  const orbFlash = Math.min(1, 0.6 * ringHit + 0.45 * ringHitB + 0.5 * land + 0.25 * frozen);
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
  const clockKick = 1 + 0.03 * bump(f, HOOK.clockLand, 2.5) - 0.012 * tween(f, [HOOK.clockLand - 3, HOOK.clockLand], [0, 1], EASE.in2) * (f < HOOK.clockLand ? 1 : 0);

  /* ── labels ──────────────────────────────────────────────────────── */
  const labelStyle: React.CSSProperties = {
    fontFamily: FONT.body,
    fontWeight: 500,
    fontSize: 26,
    lineHeight: 1.2,
    letterSpacing: TRACK.label,
    textTransform: 'uppercase',
  };
  const dayDot = aos(f, HOOK.clockLand - 1, { anticip: 2, depth: 0.2, config: SPRING.pop });
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
  const phaseDim = Math.min(1, 1 - 0.35 * tween(f, [HOOK.freeze, HOOK.freeze + 12], [0, 1], EASE.house) + 0.3 * beatTick);

  /* ── motes: born faint, frozen with the world ────────────────────── */
  const dustIn = tween(f, HOOK_LOCAL.dustIn, [0.35, 1], EASE.house);
  const lensIn = tween(f, [HOOK.clockIn, HOOK.clockLand + 10], [0, 1], EASE.inOut) * (1 - out);
  const motes = L.pick(MOTES.landscape, MOTES.vertical);

  /* ── the rings are a halo ABOVE the phase line: their lower arcs dissolve
        before the RINGING label, the wave and the headline ───────────── */
  const ringMask = `linear-gradient(180deg, #000 0px, #000 ${(clockCy + cellH * 0.5).toFixed(0)}px, rgba(0,0,0,0.4) ${phaseCy.toFixed(0)}px, transparent ${(waveCy - 8).toFixed(0)}px)`;

  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      <Camera x={camX} y={camY} zoom={zoom}>
        {/* 0.2 — the cover field + pigment wash */}
        <Layer depth={0.2}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(${L.pick('62% 50% at 52% 32%', '92% 38% at 52% 35%')}, ${C.fieldHigh}, ${C.fieldMid} 46%, transparent 72%)`,
              opacity: Math.min(0.62, field),
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(${L.pick('40% 36% at 50% 36%', '64% 26% at 50% 36%')}, ${rgba(C.plum, 0.26)}, transparent 72%)`,
              opacity: tween(f, [HOOK_LOCAL.orbIn, HOOK.clockLand], [0, 1], EASE.inOut) * (0.7 + 0.3 * frozen),
            }}
          />
        </Layer>

        {/* 0.55 — bloom behind the clock: flashes on the land and the rings */}
        <Layer depth={0.55}>
          <div
            style={{
              position: 'absolute',
              left: L.cx - L.pick(520, 420),
              top: clockCy - L.pick(300, 300),
              width: L.pick(1040, 840),
              height: L.pick(600, 600),
              background: `radial-gradient(closest-side, ${rgba(C.electric, 0.22 * land + 0.2 * ringHit + 0.12 * ringHitB)}, ${rgba(C.electric, 0)} 100%)`,
            }}
          />
          {/* the text beat: a lilac-white breath of light where the line is about to rise */}
          <div
            style={{
              position: 'absolute',
              left: L.cx - textGlowW / 2,
              top: HOOK_LINE(L).cy - textGlowH / 2,
              width: textGlowW,
              height: textGlowH,
              background: `radial-gradient(closest-side, ${rgba(textGlowCol, 0.15 * textHit)}, ${rgba(textGlowCol, 0.05 * textHit)} 55%, ${rgba(textGlowCol, 0)} 100%)`,
            }}
          />
        </Layer>

        {/* 0.92 — the rings (behind the figures, as on the site) */}
        <Layer depth={0.92} style={{ maskImage: ringMask, WebkitMaskImage: ringMask }}>
          <Rings
            frame={f}
            tau={tau}
            rings={[
              { start: ringAt, hang: 0.74 },
              { start: ringBAt, hang: 0.95 },
            ]}
            cx={L.cx}
            cy={clockCy}
            d0={orbD * 1.25}
            d1={L.pick(900, 800)}
            freeze={HOOK.freeze}
            decayEnd={HOOK_LOCAL.anticipation}
            out={out}
            inhale={inhale}
            shockD={L.pick(420, 380)}
          />
        </Layer>

        {/* 1.0 — the clock lockup + day label */}
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
                  background: `radial-gradient(50% 50% at 50% 50%, ${rgba(C.lilac, 0.28 * streakO)}, ${rgba(C.lilac, 0)})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: L.cx - streakW / 2,
                  top: clockCy + L.pick(4, 3) - 1,
                  width: streakW,
                  height: 2,
                  background: `linear-gradient(90deg, ${rgba(C.lilac, 0)}, ${rgba(C.paper, 0.85 * streakO)} 50%, ${rgba(C.lilac, 0)})`,
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
                `drop-shadow(0 0 26px ${rgba(C.lilac, 0.28)})`,
                rack + out > 0.01 ? `blur(${(1.3 * rack + 18 * out).toFixed(2)}px)` : '',
                rack > 0.01 ? `brightness(${(1 - 0.16 * rack).toFixed(3)})` : '',
                land > 0.02 ? `brightness(${(1 + 0.45 * land).toFixed(3)})` : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            }}
          >
            <ClockLockup
              frame={f}
              rolls={rolls}
              sheens={sheens}
              fontSize={F}
              orbSize={orbD}
              gap={gap}
              unfold={unfold}
              orbScale={orbScale}
              orbTime={7.3 + t / FPS}
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
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 14,
              opacity: 1 - out,
              color: C.paper,
            }}
          >
            <CornerDot
              size={16}
              color={C.lilac}
              style={{ transform: `scale(${Math.max(0, dayDot).toFixed(3)})`, marginTop: -1 }}
            />
            <StaggerText
              text="Tuesday"
              frame={f}
              start={HOOK.clockLand}
              stagger={1}
              style={{ ...labelStyle, marginRight: `-${TRACK.label}` }}
            />
          </div>
        </Layer>

        {/* 1.08 — phase line + the wave */}
        <Layer depth={1.08}>
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
              gap: 14,
              opacity: (1 - out) * phaseDim,
              color: C.paperDim,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
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
            maxH={L.pick(38, 52)}
            drawIn={HOOK_LOCAL.waveIn}
            ring={ringAt}
            burst={HOOK.ringBurst}
            freeze={HOOK.freeze}
            decayEnd={HOOK_LOCAL.anticipation}
            out={out}
            tick={beatTick}
          />
        </Layer>

        {/* 1.65 — big near motes in the empty zones: they hang at the freeze
            while the push carries on through them */}
        <Layer depth={1.65}>
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Motes motes={motes} plane="near" t={t} opacity={1} />
          </AbsoluteFill>
        </Layer>

        {/* 1.6 — foreground motes, frozen with the world */}
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

        {/* 1.9 — out-of-focus light in front of the lens */}
        <Layer depth={1.9}>
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Bokeh
              t={t}
              width={L.width}
              count={L.pick(4, 5)}
              seed={L.pick('hook-bokeh-l', 'hook-bokeh-v')}
              opacity={0.15}
              band={[L.pick(60, 260), L.pick(620, 1080)]}
            />
          </AbsoluteFill>
        </Layer>

        {/* 2.3 — the nearest plane: a few big defocused motes right at the lens */}
        <Layer depth={2.3}>
          <AbsoluteFill style={{ opacity: lensIn }}>
            <Motes motes={motes} plane="lens" t={t} opacity={1} />
          </AbsoluteFill>
        </Layer>
      </Camera>

      <Vignette strength={1} />

      {/* The line. Never transformed here — the twist takes it over at 112. */}
      {global < HOOK_LOCAL.textHandoff ? <HookLine start={HOOK.textIn} /> : null}
    </AbsoluteFill>
  );
};
