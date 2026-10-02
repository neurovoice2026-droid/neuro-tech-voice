/**
 * 0–4 s · HOOK — black. A point of light: the colon orb is born, alone; the
 * #demo clock's figures rise into their windows around it and the clock
 * flicks through the site's four moments 3 sixteenths apart — the rush, just
 * after closing, a Sunday — each a hard change of LIGHT (the orb, the light
 * it throws on the wall, the figures' flat ink, the moment's dot), and lands
 * on 03:12 in the night's violet. The phone rings: the orb pulses, one
 * hairline ring leaves it, the line goes live. Time freezes mid-ring — the
 * ring is caught and dissolves, the wave holds its shape and creeps — and
 * "Your business is closed." rises underneath, its key word in the night's
 * ink. The frozen world breathes on the beats; then the clock rolls out of its
 * windows, the light goes out, and the camera inhales into the break.
 *
 * The room is near-black (Atmosphere NightRoom) lit by ONE source: the orb.
 * No bokeh, no motes, no washes, no glows on type, no blur of any kind —
 * every move is a continuous function of fractional time (120 fps master).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { NightRoom } from '../components/Atmosphere';
import { Camera, Layer } from '../components/Camera';
import { HookLine } from '../components/Shared';
import { useLayout } from '../lib/layout';
import { GLOW, lightAt } from '../lib/lights';
import { aos, EASE, mixHex, smooth, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { typeStyle } from '../lib/type';
import { C, ROOM, TRACK } from '../theme';
import { FPS, HOOK, HOOK_LOCAL, SCENES } from '../timing';
import { chainPos, ClockLockup, type Cell, type Flick, flickDisp, type Strip } from './hook/Clock';
import { DayDrum, type DrumRow } from './hook/DayDrum';
import { mixColor } from '../lib/lights';
import { FIGURE_INK, MOMENTS } from './hook/moments';
import { RingPulse } from './hook/Rings';
import { StaggerText } from './hook/StaggerText';
import { Wave } from './hook/Wave';
import { warpTime } from './hook/warp';

/** A light hit: a one-frame attack (smooth, so it is continuous at 120 fps) peaking ON `at`, then a decay. */
const hit = (f: number, at: number, decay = 4) =>
  f < at - 1 ? 0 : f < at ? smooth(at - 1, at, f) : Math.exp(-(f - at) / decay);
/** Alpha-function bump peaking `peak` frames after `at` (camera kicks). */
const bump = (f: number, at: number, peak = 3) => {
  const x = (f - at) / peak;
  return x <= 0 ? 0 : x * Math.exp(1 - x);
};
/** A beat spike ON frame B: a 3-frame dip, a spring up that peaks on the beat, a spring back
 *  (with its small undershoot). ≈ 0 → −0.2 → 1 → −0.07 → 0. */
const spike = (f: number, B: number) =>
  aos(f, B - 3, { anticip: 3, depth: 0.2, config: SPRING.pop }) - aos(f, B + 2, { anticip: 0, depth: 0, config: SPRING.site });
/** An eased swell ON frame B: up over `rise` frames, down over `fall` (EASE.inOut). */
const swellOn = (f: number, B: number, rise: number, fall: number) =>
  tween(f, [B - rise, B], [0, 1], EASE.inOut) * (1 - tween(f, [B, B + fall], [0, 1], EASE.inOut));

export const Hook: React.FC = () => {
  const f = useSceneFrame('hook');
  const global = f + SCENES.hook.from;
  const L = useLayout();
  const M = HOOK_LOCAL.moments;
  const OUT0 = HOOK_LOCAL.out[0]; // 112 — the twist mounts; the clock leaves, the light goes out

  /* ── world time: stops at the freeze, then crawls ────────────────── */
  const tau = (x: number) => warpTime(x, HOOK.freeze, HOOK_LOCAL.freezeEase, HOOK_LOCAL.frozenRate);
  const t = tau(f);

  /* ── geometry ────────────────────────────────────────────────────── */
  const F = L.pick(250, 210);
  const glyphH = 0.74 * F; // the figures' drawn height (Instrument Sans lining figures)
  const cellH = 1.1 * F;
  const orbD = L.pick(56, 48);
  const gap = 0.15 * F;
  const clockCy = L.pick(L.cy - 150, L.cy - 260);
  // the moment names (they plant the four lights) a size up from the status (TYPE.label)
  const momentFs = L.pick(36, 34);
  const statusFs = typeStyle('label', L.vertical).fontSize as number; // 30 / 28 — RINGING
  // label caps sit 42 / 46 px clear of the figures (an uppercase label's cap centre = its line centre)
  const labelCy = clockCy - glyphH / 2 - L.pick(42, 46) - 0.36 * momentFs;
  const phaseCy = clockCy + glyphH / 2 + L.pick(40, 44) + 0.36 * statusFs;
  const waveMaxH = L.pick(30, 44);
  const waveCy = phaseCy + 0.36 * statusFs + L.pick(30, 34) + waveMaxH;

  /* ── the line arrives: the clock steps back a little (light, not focus) ─ */
  const rack = tween(f, [HOOK.textIn + 6, HOOK.textIn + 30], [0, 1], EASE.inOut);

  /* ── the end ─────────────────────────────────────────────────────── */
  const out = global >= SCENES.hook.to ? 1 : tween(f, HOOK_LOCAL.out, [0, 1], EASE.inOut);
  const lightsOut = global >= SCENES.hook.to ? 1 : tween(f, [OUT0, SCENES.hook.to - 1], [0, 1], EASE.in2);

  /* ── the ring's attack frames (one ahead of the beat) ────────────── */
  const ringAt = HOOK.ring - HOOK_LOCAL.ringLead; // 55
  const ringBAt = HOOK_LOCAL.ringB - HOOK_LOCAL.ringLead; // 62

  /* ── the beat breaths of the frozen world (ON b6, b7) ────────────── */
  const breaths = HOOK_LOCAL.breathBeats;
  const pulseB = breaths.reduce((s, B) => s + spike(f, B), 0); // orb, wave
  const lightBreath = breaths.reduce((s, B) => s + swellOn(f, B, 4, 6), 0); // the room light

  /* ── camera: a slow push, small kicks on the hits, an inhale into the break ── */
  const flickKick = bump(f, M[1], 2) + bump(f, M[2], 2);
  const zoom =
    1 +
    0.042 * tween(f, [0, HOOK_LOCAL.pushTurn], [0, 1], EASE.inOut) +
    0.035 * tween(f, [HOOK_LOCAL.pushTurn, SCENES.hook.to - 1], [0, 1], EASE.in2) +
    0.004 * flickKick +
    0.012 * bump(f, HOOK.clockLand, 3) +
    0.01 * bump(f, ringAt, 2) +
    0.006 * bump(f, HOOK.textIn, 2) +
    0.003 * breaths.reduce((s, B) => s + bump(f, B - 1, 2), 0) +
    0.03 * out;
  const camX = 5 * noise2D('hook-cam-x', f * 0.009, 0.3);
  const camY = 3.5 * noise2D('hook-cam-y', 0.7, f * 0.009) - 2.5 * bump(f, HOOK.clockLand, 2) - 1.2 * flickKick;

  /* ── THE FOUR LIGHTS: the orb + its light change ON each landing ──── */
  const lightKeys = MOMENTS.map((m, i) => ({
    at: i === 0 ? 0 : M[i] - HOOK_LOCAL.lightLead,
    light: m.id,
    frames: i === MOMENTS.length - 1 ? 3 : 2, // hard changes: ≈ 86 % there one frame in
    stagger: m.id === 'closing' ? 0.12 : 0,
  }));
  const S = lightAt(f, lightKeys, 3);
  // a light change is a SWITCH: the source dips through the change (≈ −35 % mid-way) instead of
  // showing the in-between hue at full strength (pink → emerald would pass through lavender)
  const switchDip =
    1 -
    0.35 *
      [1, 2, 3].reduce((s, j) => s + Math.sin(Math.PI * tween(f, [M[j] - HOOK_LOCAL.lightLead, M[j] + 0.5], [0, 1])), 0);
  /** 0..1: how far moment j's light has come in (on the figures that stay) */
  const lightIn = (j: number) => (j === 0 ? 1 : tween(f, [M[j] - HOOK_LOCAL.lightLead, M[j] + 1], [0, 1], EASE.inOut));

  /* ── light hits ──────────────────────────────────────────────────── */
  const land = hit(f, HOOK.clockLand, 4);
  const flickHit = hit(f, M[1], 5) + hit(f, M[2], 5);
  const ringHit = hit(f, HOOK.ring, 5);
  const ringHitB = hit(f, HOOK_LOCAL.ringB, 5);
  const textHit = hit(f, HOOK.textIn, 6);

  /* ── the clock: four windows through the four moments ─────────────── */
  // in: the figures rise into their windows from the orb outwards (the inner pair first), as
  // the clock switches on; a moment's flick rolls only the figures that change (left → right,
  // all landing together on the hit); out: every window rolls up to blank, from the orb outwards
  const ROLL_IN = HOOK_LOCAL.figuresIn - 1; // 7 — moving on the pop (8)
  const inner = (c: number) => (c === 1 || c === 2 ? 0 : 1);
  const strips: Strip[] = [0, 1, 2, 3].map((c) => {
    const states: { digit: number | null; m: number }[] = [
      { digit: null, m: 0 },
      { digit: MOMENTS[0].digits[c], m: 0 },
    ];
    const flicks: Flick[] = [{ start: ROLL_IN + inner(c), land: ROLL_IN + inner(c) + HOOK_LOCAL.flickTravel, delta: 1, wind: 0 }];
    for (let k = 1; k < MOMENTS.length; k++) {
      if (MOMENTS[k].digits[c] === MOMENTS[k - 1].digits[c]) continue;
      states.push({ digit: MOMENTS[k].digits[c], m: k });
      flicks.push({ start: M[k] - HOOK_LOCAL.flickTravel - (3 - c) * HOOK_LOCAL.flickStagger, land: M[k], delta: 1 });
    }
    states.push({ digit: null, m: MOMENTS.length - 1 });
    const exitAt = OUT0 + 0.8 * inner(c);
    const posAt = (fr: number) => chainPos(fr, 0, flicks) + tween(fr, [exitAt, exitAt + 5], [0, 1], EASE.in3);
    // each state is lit by its own moment (one flat ink); one that outlives a moment (the figure
    // stays) re-lights
    const cells: Cell[] = states.map((s, k) => {
      const next = k + 1 < states.length - 1 ? states[k + 1].m : MOMENTS.length;
      let ink = FIGURE_INK[MOMENTS[s.m].id];
      for (let j = s.m + 1; j < next; j++) ink = mixColor(ink, FIGURE_INK[MOMENTS[j].id], lightIn(j));
      return { digit: s.digit, ink };
    });
    return { cells, pos: posAt(f), speed: 2 * (posAt(f + 0.25) - posAt(f - 0.25)) };
  });
  // just after they land the light passes over the figures left → right: each one's flat ink lifts
  // towards paper and settles back (a colour change, never a highlight band or a gradient)
  const lifts = [0, 1, 2, 3].map((i) => {
    const s0 = HOOK_LOCAL.sheen + i * 1.5 + (i >= 2 ? 1.5 : 0);
    return Math.sin(Math.PI * tween(f, [s0, s0 + 11], [0, 1], EASE.inOut));
  });
  // the figures take the light of the hits (brightness — never blur) and step back for the line
  const figuresLift = (1 + 0.12 * land + 0.08 * flickHit + 0.06 * ringHit) * (1 - 0.16 * rack);

  /* ── the colon orb: born in the black, a pop on every flick, pulses with each ring, breathes ── */
  const born = aos(f, HOOK_LOCAL.orbIn, { anticip: 0, depth: 0, config: SPRING.pop });
  // it draws in for a breath before the figures leave it
  const orbDraw = 1 + 0.9 * Math.min(0, aos(f, ROLL_IN, { anticip: 3, depth: 0.1, config: SPRING.site }));
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
  const flickPop = 0.12 * (bump(f, M[1] - 1, 1.5) + bump(f, M[2] - 1, 1.5)) + 0.2 * bump(f, HOOK.clockLand - 1, 1.5);
  const orbGone = tween(f, [OUT0 + 1, SCENES.hook.to - 1], [0, 1], EASE.in3);
  // 1 → 1.8 on the first ring (the site's phase-dot pulse), ≈1.65 on the second; +3 % on the beats of the hold
  const orbScale =
    Math.max(0, born) * orbDraw * (1 + flickPop + 0.85 * pulseSum + (0.012 + 0.03 * pulseB) * frozen) * (1 - orbGone);
  const orbFlash = Math.min(1, 0.5 * ringHit + 0.38 * ringHitB + 0.45 * land + 0.32 * flickHit + 0.2 * frozen + 0.18 * pulseB * frozen);
  const orbOpacity =
    Math.min(1, Math.max(0, born) * 1.2) * switchDip * (1 - tween(f, [SCENES.hook.to - 3, SCENES.hook.to - 0.5], [0, 1], EASE.inOut));
  // the ring has a body: the lockup lifts a hair on each pulse and settles (a thump, not a shake)
  const ringThump = 1.6 * (bump(t, ringAt, 1.5) + 0.7 * bump(t, ringBAt, 1.5)) * (1 - frozen);
  const clockKick =
    1 +
    0.026 * bump(f, HOOK.clockLand, 2.5) +
    0.008 * flickKick -
    0.01 * tween(f, [HOOK.clockLand - 3, HOOK.clockLand], [0, 1], EASE.in2) * (f < HOOK.clockLand ? 1 : 0);

  /* ── the room: near-black, lit by the orb ────────────────────────── */
  // where the orb is on screen (depth-1 layer: translate(−cam) scale(zoom) about the frame centre)
  const orbSx = L.cx - camX;
  const orbSy = L.cy - camY + zoom * (clockCy + L.pick(4, 3) - ringThump - L.cy);
  const roomK =
    (0.12 * tween(f, [HOOK_LOCAL.orbIn, HOOK_LOCAL.figuresIn + 6], [0, 1], EASE.out3) +
      0.03 * tween(f, [HOOK.clockLand, HOOK.clockLand + 12], [0, 1], EASE.inOut) +
      0.07 * flickHit +
      0.08 * land +
      0.07 * ringHit +
      0.04 * ringHitB +
      0.03 * textHit +
      0.035 * lightBreath +
      // the inhale gathers light into the clock before the break
      0.03 * tween(f, [HOOK_LOCAL.pushTurn, HOOK_LOCAL.anticipation - 1], [0, 1], EASE.in2)) *
    (1 - 0.6 * (1 - switchDip)) *
    (1 - lightsOut);

  /* ── the day drum (rolls with the strips) ────────────────────────── */
  // the first row rolls up at the figures' pace; the later rows hold until the figures are
  // already moving, then snap in ON the hit (the mechanism's last part to let go)
  const drumFlicks: Flick[] = M.map((H, i) => {
    const landAt = i === 0 ? HOOK_LOCAL.drumIn : H;
    return {
      start: landAt - (i === 0 ? HOOK_LOCAL.flickTravel : HOOK_LOCAL.drumTravel),
      land: landAt,
      delta: 1,
      wind: i === 0 ? 0 : undefined,
    };
  });
  const drumAt = (fr: number) =>
    drumFlicks.reduce((p, k) => p + flickDisp(fr, k), -1) + tween(fr, [OUT0 + 0.4, OUT0 + 5.4], [0, 1], EASE.in3);
  const drumPos = drumAt(f);
  const drumSpeed = 2 * (drumAt(f + 0.25) - drumAt(f - 0.25));
  const drumRows: DrumRow[] = MOMENTS.map((m) => ({
    text: m.label,
    // the name is lit by its light (a whisper of it); the dot IS the light
    color: mixHex(C.paper, GLOW[m.id].core, 0.16),
    dot: GLOW[m.id].core,
  }));

  /* ── RINGING ─────────────────────────────────────────────────────── */
  const statusStyle: React.CSSProperties = {
    ...typeStyle('label', L.vertical, { tone: 'night' }),
    marginRight: `-${TRACK.label}`,
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
  const phaseDim = 1 - 0.1 * tween(f, [HOOK.freeze, HOOK.freeze + 12], [0, 1], EASE.house);
  const phaseDot = L.pick(12, 11);
  const dotOut = tween(f, [OUT0 + 0.5, OUT0 + 5], [0, 1], EASE.in3);

  /* ── the ring: ONE pulse off the orb on the first ring's attack; it opens out past the figures
        and is gone (caught by the freeze, it dissolves — nothing hangs). Its lower arc dissolves
        before RINGING and the wave ──────────────────────────────── */
  const ringD0 = orbD * 1.25;
  const ringD1 = 2 * L.pick(520, 470); // its radius at full travel
  const ringMask = `linear-gradient(180deg, #000 0px, #000 ${(clockCy + cellH * 0.5).toFixed(1)}px, rgba(0,0,0,0.4) ${phaseCy.toFixed(1)}px, transparent ${(waveCy - 8).toFixed(1)}px)`;

  return (
    <AbsoluteFill style={{ background: ROOM.night, overflow: 'hidden' }}>
      {/* the wall, infinitely far: lit only by the orb (its colour, its position on screen) */}
      <NightRoom
        light={{
          x: orbSx,
          y: orbSy,
          color: S.orb[2],
          strength: roomK,
          radius: L.pick(330, 340),
          aspect: L.pick(1.4, 1),
          falloff: 1.1,
          chroma: 0.5,
        }}
        vignette={0.5}
      />

      <Camera x={camX} y={camY} zoom={zoom}>
        {/* the ring (behind the figures, as on the site) */}
        <Layer depth={1} style={{ maskImage: ringMask, WebkitMaskImage: ringMask }}>
          <RingPulse
            frame={f}
            t={t}
            start={ringAt}
            cx={L.cx}
            cy={clockCy}
            d0={ringD0}
            d1={ringD1}
            freeze={HOOK.freeze}
            dissolve={7}
            out={out}
            width0={L.width}
            height0={L.height}
          />
        </Layer>

        {/* the clock lockup + the day drum */}
        <Layer depth={1}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: clockCy - cellH / 2,
              height: cellH,
              display: 'flex',
              justifyContent: 'center',
              transform: `translateY(${(-ringThump).toFixed(3)}px) scale(${clockKick.toFixed(5)})`,
            }}
          >
            <ClockLockup
              strips={strips}
              lifts={lifts}
              fontSize={F}
              orbSize={orbD}
              gap={gap}
              orbScale={orbScale}
              orbTime={7.3 + f / FPS}
              orbPalette={S.orb}
              glowBody={S.glow.body}
              orbFlash={orbFlash}
              orbDy={L.pick(4, 3)}
              figuresOpacity={1}
              figuresLift={figuresLift}
              orbOpacity={orbOpacity}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: labelCy,
              transform: 'translateY(-50%)',
              opacity: 1 - 0.14 * rack,
            }}
          >
            <DayDrum rows={drumRows} pos={drumPos} speed={drumSpeed} fontSize={momentFs} width={L.width} dotSize={L.pick(20, 19)} />
          </div>
        </Layer>

        {/* the phase line + the wave */}
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
              gap: Math.round(statusFs * 0.46),
              opacity: phaseDim,
              color: mixHex(C.paperDim, C.paper, 0.4),
            }}
          >
            <div
              style={{
                width: phaseDot,
                height: phaseDot,
                borderRadius: '50%',
                background: C.callerLit,
                transform: `scale(${(Math.max(0, phaseDotIn) * dotPulse * (1 - dotOut)).toFixed(4)})`,
              }}
            />
            <StaggerText
              text="Ringing"
              t={f}
              start={HOOK.ring - 1}
              stagger={0.8}
              exit={{ at: OUT0 + 0.6, dur: 4, stagger: 0.25 }}
              style={statusStyle}
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
            tick={textHit}
            breath={pulseB}
            width0={L.width}
            height0={L.height}
          />
        </Layer>
      </Camera>

      {/* The line. Screen space, never transformed here — the twist takes it over at 112. */}
      {global < HOOK_LOCAL.textHandoff ? <HookLine start={HOOK.textIn} /> : null}
    </AbsoluteFill>
  );
};
