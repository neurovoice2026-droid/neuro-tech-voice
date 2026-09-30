/**
 * Dev board for THE FOUR LIGHTS foundation (src/lib/lights.ts, <OrbGroup>,
 * <LightGround>). Local frames (each composition starts at 0):
 *
 *   Lights4-16x9 / -9x16      the four lights on their #demo grounds, the orb as the clock's colon
 *   LightsCycle-16x9 / -9x16  one orb through rush → closing → sunday → night (lightAt), room + bloom + rim
 *   LightsMerge-16x9 / -9x16  four orbs in ONE context converge, overlap and merge into ALL_LIGHTS
 *   LightsSwatch-16x9         blend strips: sRGB vs OKLab vs mixColor, staggered palettes, merge candidates
 *
 *   NTV_SKIP_SFX=1 npx remotion still src/dev/lights.tsx LightsMerge-16x9 out/dev/lights/merge-60.png --frame=60
 */
import React, { useState } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame, useVideoConfig } from 'remotion';
import { Grain } from '../components/Grain';
import { LightGround } from '../components/LightGround';
import { flowTime } from '../components/Orb';
import { OrbGroup, type GroupOrb } from '../components/OrbGroup';
import { Label } from '../components/Type';
import { waitForFonts } from '../lib/fonts';
import {
  ALL_GLOW,
  ALL_LIGHTS,
  NIGHT_ROOMS,
  blendPalettes,
  bloom,
  fromOklab,
  lightAt,
  mixColor,
  mixPalette,
  rimGlow,
  ring,
  toOklab,
  type Glow,
} from '../lib/lights';
import { aos, EASE, SPRING, springAt, tween, velocity } from '../lib/motion';
import { C, FONT, LIGHTS, LIGHT_ORDER, R, type LightId, type Palette } from '../theme';
import { b, BEAT, FPS, LANDSCAPE, VERTICAL } from '../timing';

/* ── shared bits ───────────────────────────────────────────────── */

/** A deterministic stand-in voice (0..1): syllables inside phrases, per seed. */
const talk = (f: number, seed: number) => {
  const phrase = Math.max(0, Math.sin(f * 0.045 + seed * 1.7));
  const syl = 0.5 + 0.5 * Math.sin(f * 0.61 + seed * 2.3) * Math.sin(f * 0.23 + seed);
  return Math.min(1, phrase * syl * 0.9);
};

const MOMENT: Record<LightId, { key: string; day: string; time: [string, string] }> = {
  rush: { key: 'Mid-rush', day: 'Friday', time: ['17', '05'] },
  closing: { key: 'After closing', day: 'Thursday', time: ['20', '10'] },
  sunday: { key: 'Sunday', day: 'Sunday', time: ['10', '12'] },
  night: { key: '3 a.m.', day: 'Tuesday', time: ['03', '12'] },
};

/** Two clock figures in the light's `num` gradient (Instrument Sans 440, tabular, as #demo). */
const Figures: React.FC<{ text: string; size: number; num: string }> = ({ text, size, num }) => (
  <div style={{ display: 'flex' }}>
    {text.split('').map((ch, i) => (
      <span
        key={i}
        style={{
          display: 'block',
          width: `${0.6}em`,
          height: '1.1em',
          lineHeight: '1.1em',
          textAlign: 'center',
          fontFamily: FONT.ui,
          fontWeight: 440,
          fontSize: size,
          fontVariantNumeric: 'tabular-nums',
          background: `${num} 0 0 / 100% 1.1em repeat-y`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {ch}
      </span>
    ))}
  </div>
);

/** A pool of light at (x, y), `k` × the orb's diameter across. */
const Bloom: React.FC<{ x: number; y: number; d: number; light: LightId | Glow; s: number; k?: number; blend?: boolean }> = ({
  x,
  y,
  d,
  light,
  s,
  k = 2.8,
  blend = true,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - (d * k) / 2,
      top: y - (d * k) / 2,
      width: d * k,
      height: d * k,
      background: bloom(light, s),
      mixBlendMode: blend ? 'screen' : 'normal',
    }}
  />
);

const Rim: React.FC<{ x: number; y: number; d: number; light: LightId | Glow; a: number; spread?: number; shadow?: number }> = ({
  x,
  y,
  d,
  light,
  a,
  spread = 1,
  shadow = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - d / 2,
      top: y - d / 2,
      width: d,
      height: d,
      borderRadius: '50%',
      boxShadow: rimGlow(light, a, spread, { shadow }),
    }}
  />
);

const Frame: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.night }) => {
  useState(() => waitForFonts());
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      {children}
      <Grain opacity={0.12} />
    </AbsoluteFill>
  );
};

/* ── 1. the four lights on their grounds ───────────────────────── */

const Four: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const gap = 14;
  const pw = (width - gap * 3) / 2;
  const ph = (height - gap * 3) / 2;
  const fig = vertical ? 100 : 150;
  const d = vertical ? 156 : 196;
  const orbs: GroupOrb[] = [];
  const panels = LIGHT_ORDER.map((id, i) => {
    const px = gap + (i % 2) * (pw + gap);
    const py = gap + Math.floor(i / 2) * (ph + gap);
    const cx = px + pw / 2;
    const cy = py + ph / 2 + (vertical ? 10 : 22);
    const L = LIGHTS[id];
    const night = L.tone === 'night';
    // the caller speaks on even bars, Ava on odd: the orb leans to `listen` while the caller does
    const bar = Math.floor((f + i * 17) / 60) % 2;
    const listen = tween((f + i * 17) % 60, [0, 10], bar ? [1, 0] : [0, 1], EASE.inOut);
    const vol = (u: number) => talk(u, i);
    const pop = aos(f, 4 + i * 4, { config: SPRING.land });
    orbs.push({ x: cx, y: cy, d: d * pop, palette: L.orb, paletteB: L.listen, mixB: listen, volume: vol(f), time: flowTime(f, vol), seed: i });
    const ringQ = ((f + i * 11) % 45) / 45;
    return (
      <div key={id}>
        <div
          style={{
            position: 'absolute',
            left: px,
            top: py,
            width: pw,
            height: ph,
            borderRadius: R.stage,
            overflow: 'hidden',
            background: L.ground,
            boxShadow: '0 0 0 1px rgb(24 16 40 / 0.06)',
          }}
        />
        {/* the room's light at the orb, then the ring leaving it */}
        <Bloom x={cx} y={cy} d={d} light={id} s={night ? 0.55 : 0.32} k={3.2} blend={night} />
        <div
          style={{
            position: 'absolute',
            left: cx - d * 0.925,
            top: cy - d * 0.925,
            width: d * 1.85,
            height: d * 1.85,
            borderRadius: '50%',
            border: `2px solid ${ring(id, 1)}`,
            opacity: 0.5 * (1 - EASE.out3(ringQ)),
            transform: `scale(${0.54 + 0.46 * EASE.out3(ringQ)})`,
          }}
        />
        <Rim x={cx} y={cy} d={d * pop} light={id} a={night ? 0.38 : 0.22} spread={d / 400} shadow={night ? 1 : 0.35} />
        <div
          style={{
            position: 'absolute',
            left: px,
            width: pw,
            top: cy - (fig * 1.1) / 2,
            display: 'flex',
            justifyContent: 'center',
            gap: d + (vertical ? 44 : 64),
          }}
        >
          <Figures text={MOMENT[id].time[0]} size={fig} num={L.num} />
          <Figures text={MOMENT[id].time[1]} size={fig} num={L.num} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: px,
            width: pw,
            top: py + (vertical ? 70 : 40),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 99, background: L.disc }} />
          <Label size={vertical ? 28 : 30} color={night ? C.paper : L.ink}>
            {MOMENT[id].key}
          </Label>
          {MOMENT[id].day !== MOMENT[id].key && !vertical ? (
            <Label size={vertical ? 28 : 30} color={night ? C.paperDim : C.muted}>
              · {MOMENT[id].day}
            </Label>
          ) : null}
        </div>
      </div>
    );
  });
  return (
    <Frame bg="#f4f3f7">
      {panels}
      <OrbGroup width={width} height={height} orbs={orbs} style={{ position: 'absolute', left: 0, top: 0 }} />
    </Frame>
  );
};

/* ── 2. one orb through the four lights ────────────────────────── */

const CYCLE = [
  { at: 0, light: 'rush' as const },
  { at: b(4), light: 'closing' as const, stagger: 0.14 },
  { at: b(8), light: 'sunday' as const },
  { at: b(12), light: 'night' as const },
  { at: b(16), light: 'rush' as const },
];

const Cycle: React.FC<{ rooms: 'site' | 'night' }> = ({ rooms }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const S = lightAt(f, CYCLE, b(1.5));
  const G = lightAt(f, CYCLE, b(2), EASE.inOut); // the room eases slower, as on the site (0.8 s inOut)
  const d = vertical ? 520 : 460;
  const cx = width / 2;
  const cy = height / 2;
  // each light lands on its beat: the orb gathers, pops, settles
  const k = CYCLE.reduce((m, c, i) => (f >= c.at ? i : m), 0);
  const hit = k > 0 ? CYCLE[k].at : -99;
  const squash = f >= hit - 4 && f < hit ? 1 - 0.06 * EASE.in4((f - (hit - 4)) / 4) : 1;
  const pop = f >= hit ? 1 + 0.06 * (1 - springAt(f, hit, SPRING.site)) * Math.exp(-(f - hit) / 10) : 1;
  const sc = squash * pop;
  const vol = (u: number) => 0.25 * talk(u, 1);
  const flash = f >= hit ? Math.exp(-(f - hit) / 7) : 0;
  const night = S.weights.night;
  return (
    <Frame>
      <LightGround weights={G.weights} rooms={rooms} />
      <Bloom x={cx} y={cy} d={d} light={S.glow} s={0.5 + 0.35 * flash + 0.25 * night} k={3} blend={rooms === 'night' || night > 0.5} />
      <Rim x={cx} y={cy} d={d * sc} light={S.glow} a={0.3 + 0.25 * flash} spread={d / 400} shadow={0.35 + 0.65 * night} />
      <OrbGroup
        width={width}
        height={height}
        orbs={[{ x: cx, y: cy, d: d * sc, palette: S.orb, volume: vol(f), time: flowTime(f, vol) }]}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + d / 2 + 70, display: 'flex', justifyContent: 'center' }}>
        <Label size={vertical ? 28 : 30} color={mixColor(LIGHTS[G.lead].ink, C.paper, rooms === "night" ? 1 : G.weights.night)}>
          {MOMENT[S.lead].key} · {MOMENT[S.lead].time.join(':')}
        </Label>
      </div>
    </Frame>
  );
};

/* ── 3. four orbs, one context: converge, overlap, merge ───────── */

const M = {
  gather: 18, // anticipation starts
  go: 24, // the dive, on a beat-ish
  land: 24 + 16, // they meet
  settle: 24 + 16 + 20,
};

const Merge: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const cx = width / 2;
  const cy = height / 2;
  const d0 = vertical ? 240 : 250;
  const d1 = vertical ? 520 : 470;
  const spread = vertical ? 0 : 1;

  // start: a row (16:9) / a 2×2 (9:16), each orb in its own light
  const home = (i: number) =>
    spread
      ? { x: cx + (i - 1.5) * (d0 + 110), y: cy }
      : { x: cx + (i % 2 ? 1 : -1) * 250, y: cy + (i < 2 ? -330 : 330) };

  // p: 0 at home → 1 at the centre; a little pull back first, one overshoot through the middle
  const p = (u: number) => aos(u, M.go, { anticip: M.go - M.gather, depth: 0.1, config: { stiffness: 120, damping: 14, mass: 1 } });
  const pos = (i: number, u: number) => {
    const h = home(i);
    const k = p(u);
    // a slight swirl on the way in, so they meet like liquid, not like billiard balls
    const ang = Math.sin(Math.PI * Math.min(1, Math.max(0, k))) * 0.45 * (i % 2 ? 1 : -1);
    const dx = h.x - cx;
    const dy = h.y - cy;
    const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
    const ry = dx * Math.sin(ang) + dy * Math.cos(ang);
    return { x: cx + rx * (1 - k), y: cy + ry * (1 - k) };
  };
  const toAll = tween(f, [M.go + 2, M.land + 6], [0, 1], EASE.inOut);
  const grow = f < M.land ? d0 : d0 + (d1 - d0) * springAt(f, M.land, SPRING.land);
  const vol = (u: number) => (u < M.land ? 0.18 * talk(u, 2) : 0.2 + 0.6 * talk(u, 3));
  const flow = flowTime(f, vol);
  const orbs: GroupOrb[] = LIGHT_ORDER.map((id, i) => {
    const P = pos(i, f);
    const vx = velocity((u) => pos(i, u).x, f);
    const vy = velocity((u) => pos(i, u).y, f);
    const fade = i < 3 ? tween(f, [M.land + 4, M.land + 12], [1, 0], EASE.inOut) : 1;
    return {
      x: P.x,
      y: P.y,
      d: grow,
      palette: mixPalette(LIGHTS[id].orb, ALL_LIGHTS, toAll, { stagger: id === 'closing' || id === 'sunday' ? 0.12 : 0 }),
      volume: vol(f),
      time: flow,
      seed: i,
      opacity: fade,
      blur: [vx * 0.5, vy * 0.5] as const,
    };
  });
  const impact = f >= M.land ? Math.exp(-(f - M.land) / 9) : 0;
  const merged: Glow = ALL_GLOW;
  return (
    <Frame>
      <LightGround weights={{ night: 1 }} rooms="night" style={{ opacity: 0.55 }} />
      {orbs.map((o, i) => (
        <Bloom key={i} x={o.x} y={o.y} d={o.d} light={LIGHT_ORDER[i]} s={0.5 * (1 - toAll) * (o.opacity ?? 1)} k={2.6} />
      ))}
      <Bloom x={cx} y={cy} d={grow} light={merged} s={toAll * (0.55 + 0.6 * impact)} k={3.2} />
      {f >= M.land ? (
        <div
          style={{
            position: 'absolute',
            left: cx - grow * (0.5 + 0.5 * EASE.out3(Math.min(1, (f - M.land) / 18))),
            top: cy - grow * (0.5 + 0.5 * EASE.out3(Math.min(1, (f - M.land) / 18))),
            width: grow * (1 + EASE.out3(Math.min(1, (f - M.land) / 18))),
            height: grow * (1 + EASE.out3(Math.min(1, (f - M.land) / 18))),
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 2px ${ring('night', 0.7 * impact)}`,
          }}
        />
      ) : null}
      <Rim x={cx} y={cy} d={grow} light={merged} a={0.34 * toAll + 0.3 * impact} spread={grow / 400} shadow={toAll} />
      <OrbGroup width={width} height={height} orbs={orbs} style={{ position: 'absolute', left: 0, top: 0 }} />
    </Frame>
  );
};

/* ── 4. swatches: how the blends behave ────────────────────────── */

const lerpLab = (a: string, b2: string, t: number) => {
  const A = toOklab(a);
  const B = toOklab(b2);
  return fromOklab([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};
const lerpRgb = (a: string, b2: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b2.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
};

const Swatch: React.FC = () => {
  const f = useCurrentFrame();
  const pairs: [LightId, LightId][] = [
    ['rush', 'closing'],
    ['closing', 'sunday'],
    ['sunday', 'night'],
    ['night', 'rush'],
  ];
  const steps = 9;
  const cell = 34;
  const strip = (fn: (t: number) => string) => (
    <div style={{ display: 'flex' }}>
      {Array.from({ length: steps }, (_, s) => (
        <div key={s} style={{ width: cell, height: cell, background: fn(s / (steps - 1)) }} />
      ))}
    </div>
  );
  const palCol = (p: Palette) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[...p].reverse().map((c, k) => (
        <div key={k} style={{ width: cell * 0.7, height: cell * 0.7, background: c }} />
      ))}
    </div>
  );
  const candidates: { name: string; p: Palette }[] = [
    { name: 'ALL_LIGHTS', p: ALL_LIGHTS },
    { name: 'blend (equal)', p: blendPalettes(LIGHT_ORDER.map((id) => ({ palette: LIGHTS[id].orb, weight: 1 }))) },
    { name: 'A teal', p: ['#14062b', '#0e7490', '#7c3aed', '#f9b4d6', '#f0fdf8'] },
    { name: 'C rose-mid', p: ['#14062b', '#4a1a9e', '#ec4899', '#a5eaf5', '#f0fdf8'] },
  ];
  const vol = (u: number) => 0.3 * talk(u, 5);
  const orbD = 250;
  return (
    <Frame bg="#0b0912">
      <div style={{ position: 'absolute', left: 60, top: 50, display: 'flex', flexDirection: 'column', gap: 22, color: C.paperDim, fontFamily: FONT.mono, fontSize: 18 }}>
        {pairs.map(([a, c]) => (
          <div key={a + c} style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ width: 150 }}>
              {a} → {c}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {strip((t) => lerpRgb(LIGHTS[a].orb[2], LIGHTS[c].orb[2], t))}
              {strip((t) => lerpLab(LIGHTS[a].orb[2], LIGHTS[c].orb[2], t))}
              {strip((t) => mixColor(LIGHTS[a].orb[2], LIGHTS[c].orb[2], t))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 7 }, (_, s) => palCol(mixPalette(LIGHTS[a].orb, LIGHTS[c].orb, s / 6)))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 7 }, (_, s) => palCol(mixPalette(LIGHTS[a].orb, LIGHTS[c].orb, s / 6, { stagger: 0.14 })))}
            </div>
          </div>
        ))}
        <div>rows: sRGB · OKLab · mixColor | mixPalette 0→1 | stagger .14</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {LIGHT_ORDER.map((id) => (
            <div key={id} style={{ width: 150, height: 110, borderRadius: 16, background: NIGHT_ROOMS[id], display: 'flex', alignItems: 'flex-end', padding: 10 }}>
              {id}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 60, top: 60, width: 2 * orbD + 60, display: 'flex', flexWrap: 'wrap', gap: 60, color: C.paperDim, fontFamily: FONT.mono, fontSize: 18 }}>
        {candidates.map((c) => (
          <div key={c.name} style={{ width: orbD, height: orbD + 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {c.name}
          </div>
        ))}
      </div>
      <OrbGroup
        width={1920}
        height={1080}
        style={{ position: 'absolute', left: 0, top: 0 }}
        orbs={candidates.map((c, i) => ({
          x: 1920 - 60 - (2 * orbD + 60) + (i % 2) * (orbD + 60) + orbD / 2,
          y: 60 + Math.floor(i / 2) * (orbD + 100) + orbD / 2,
          d: orbD,
          palette: c.p,
          volume: vol(f),
          time: flowTime(f, vol),
          seed: i,
        }))}
      />
    </Frame>
  );
};

/* ── compositions ──────────────────────────────────────────────── */

const LEN = b(20);
const CycleSite: React.FC = () => <Cycle rooms="site" />;
const CycleNight: React.FC = () => <Cycle rooms="night" />;

const Board: React.FC = () => (
  <>
    {(
      [
        ['Lights4', Four, b(8)],
        ['LightsCycle', CycleSite, LEN],
        ['LightsCycleNight', CycleNight, LEN],
        ['LightsMerge', Merge, b(12)],
      ] as const
    ).map(([id, comp, len]) => (
      <React.Fragment key={id}>
        <Composition id={`${id}-16x9`} component={comp} durationInFrames={len} fps={FPS} {...LANDSCAPE} />
        <Composition id={`${id}-9x16`} component={comp} durationInFrames={len} fps={FPS} {...VERTICAL} />
      </React.Fragment>
    ))}
    <Composition id="LightsSwatch-16x9" component={Swatch} durationInFrames={BEAT * 4} fps={FPS} {...LANDSCAPE} />
  </>
);

registerRoot(Board);
