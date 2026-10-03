/**
 * CLOSE · b17–b18 — the film-2 Cta, docs/kb/PIPELINE.md §7 FALLBACK route (SCRIPT.md b18 "Build route"):
 * the headline differs from film 1's, so this is NOT film 1's Cta mounted as is; it is built from the
 * timing-free end-card parts (scenes/cta/EndCard: Wordmark · StartFree · Note · Url, and Headline),
 * timed by CTA_LOCAL. PLACEHOLDER stage: the four lights and the backlight are plain CSS light (the
 * HeroGL / heroShader / orbPass pass comes in the build); the end-card geometry is film 1's.
 *
 *   Ava's heading "Your answers. / Written once, there for every call." rises on her words (key phrase in
 *   sunday on dark) · the four lights arrive on 8ths, sunday first, and drift in · the converge: the
 *   heading leaves through its masks, the lights close on the core · IMPACT on the bar: the backlight
 *   opens, NEUROVOICE surfaces from the centre out · the URL on her sign-off · Start free on "…Voice." ·
 *   the note · the press · the still hold, fading with the master (MIX.fadeOut).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import '../../scenes/cta/font/wordmark.css';
import { NightRoom } from '../../components/Atmosphere';
import { useFaceReady } from '../../lib/fonts';
import { useLayout } from '../../lib/layout';
import { GLOW, inkFor } from '../../lib/lights';
import { EASE, mix, SPRING, springUnit, tween } from '../../lib/motion';
import { Note, StartFree, Url, Wordmark, WORDMARK_FONT, WORDMARK_INK, WORDMARK_TEXT, type Rest } from '../../scenes/cta/EndCard';
import { Headline } from '../../scenes/cta/Headline';
import { LIGHTS, ROOM } from '../../theme';
import { useKbSceneFrame } from '../scene';
import { CTA_LOCAL as K, MIX, SCENES } from '../timing';

const ACCENT = inkFor('sunday', 'dark');
/** every residual pinned to its exact rest value by the final hold */
const rest: Rest = (t, v, target) => (t >= K.finalHold ? target : v);
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
};
/** the picture fades with the master: MIX.fadeOut's exponential curve (fadeK nepers, landing on zero) */
const endLight = (t: number) => {
  const [a, e] = MIX.fadeOut.map((f) => f - SCENES.cta.from);
  if (t <= a) return 1;
  const u = Math.min(1, (t - a) / (e - a));
  const z = Math.exp(-MIX.fadeK);
  return (Math.exp(-MIX.fadeK * u) - z) / (1 - z);
};

const Row: React.FC<{ y: number; children: React.ReactNode }> = ({ y, children }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>{children}</div>
);

export const Cta: React.FC = () => {
  const L = useLayout();
  const t = useKbSceneFrame('cta');
  const ready = useFaceReady(`500 100px ${WORDMARK_FONT}`, WORDMARK_TEXT);
  /* film 1's end-card geometry (scenes/Cta.tsx geo) */
  const P = { x: L.cx, y: L.pick(L.cy - 170, 650) };
  const G = {
    wordmark: L.pick(160, 116),
    halo: L.pick(580, 400),
    button: { y: L.pick(700, 1030), fontSize: L.pick(64, 56) },
    note: { y: L.pick(850, 1180), size: L.pick(64, 56) },
    url: { y: L.pick(968, 1318), size: L.pick(64, 56), dot: L.pick(20, 18), rule: L.pick(1400, L.width - 2 * L.safe.x) },
    headline: { size: L.pick(100, 84), cy: L.pick(L.cy + 40, 760) },
  };
  const lines = L.vertical ? ['Your answers.', 'Written once,', 'there for every call.'] : [...K.headline];

  /* the four lights: from the corners on their 8ths, drifting to a ring about the core, closing on it in the converge */
  const corners = [
    [-0.1, -0.1],
    [1.1, -0.1],
    [-0.1, 1.1],
    [1.1, 1.1],
  ] as const;
  const ringR = L.pick(420, 330);
  const close = tween(t, [K.converge, K.impact], [0, 1], EASE.in3);
  const lights = K.lightOrder.map((id, i) => {
    const a = springUnit(t - K.lights[i], SPRING.site);
    const ang = Math.PI * (1.25 + 0.5 * i) + 0.35 * tween(t, [K.lights[i], K.impact], [0, 1]);
    const rx = P.x + Math.cos(ang) * ringR * (1 - close);
    // (the ring sits a little above the core, clear of the heading under it)
    const ry = P.y - L.pick(60, 80) * (1 - close) + Math.sin(ang) * ringR * 0.32 * (1 - close);
    const x = mix(corners[i][0] * L.width, rx, Math.min(1, a));
    const y = mix(corners[i][1] * L.height, ry, Math.min(1, a));
    return { id, x, y, on: t >= K.lights[i] - 1 && t < K.impact + 1 };
  });

  /* the impact: the backlight opens out of the core */
  const bloom = t < K.impact ? 0 : springUnit(t - K.impact, SPRING.site);
  const flash = t < K.impact ? 0 : Math.exp(-(t - K.impact) / 3);
  const arrive = (xEm: number) => 1 + xEm * 2.4;
  const end = endLight(t);

  return (
    <AbsoluteFill style={{ background: ROOM.night }}>
      <NightRoom light={{ x: P.x, y: P.y, color: LIGHTS.sunday.orb[2], strength: 0.18 + 0.12 * bloom, radius: L.pick(520, 640) }} vignette={0.6} />
      {lights.map((l) =>
        l.on ? (
          <div
            key={l.id}
            style={{
              position: 'absolute',
              left: l.x - 70,
              top: l.y - 70,
              width: 140,
              height: 140,
              borderRadius: '50%',
              mixBlendMode: 'screen',
              background: `radial-gradient(circle, ${rgba(GLOW[l.id].core, 0.95)} 0%, ${rgba(GLOW[l.id].body, 0.55)} 30%, ${rgba(GLOW[l.id].body, 0)} 70%)`,
            }}
          />
        ) : null,
      )}
      <Headline
        t={t}
        spec={{
          lines,
          cy: G.headline.cy,
          size: G.headline.size,
          wordAt: K.words.map((f) => f - 2),
          exit: { from: K.converge, step: 1.5, dur: 8 },
          keys: ['there', 'for', 'every', 'call.'],
          accent: ACCENT,
          vertical: L.vertical,
        }}
      />
      {bloom > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: P.x - G.halo * bloom,
            top: P.y - G.halo * 0.42 * bloom,
            width: 2 * G.halo * bloom,
            height: 2 * G.halo * 0.42 * bloom,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba('#f7f3ff', 0.96)} 0%, ${rgba('#d9ccff', 0.85)} 45%, ${rgba('#b9a3ff', 0.35)} 78%, ${rgba('#b9a3ff', 0)} 100%)`,
          }}
        />
      ) : null}
      <Wordmark t={t} at={K.impact} ready={ready} rest={rest} spec={{ x: P.x, y: P.y, size: G.wordmark, arrive, color: WORDMARK_INK }} />
      <Row y={G.button.y}>
        <StartFree t={t} at={K.button} press={K.press} fontSize={G.button.fontSize} vertical={L.vertical} spec={{ hover: K.press - 9, down: 3 }} rest={rest} />
      </Row>
      <Row y={G.note.y}>
        <Note t={t} at={K.note} step={1.5} size={G.note.size} vertical={L.vertical} />
      </Row>
      <Row y={G.url.y}>
        <Url
          t={t}
          text="neurotechvoice.com"
          chunks={[0, 5, 9].map((from, k) => ({ from, at: K.url[k] }))}
          size={G.url.size}
          dot={G.url.dot}
          ruleW={G.url.rule}
          vertical={L.vertical}
          rest={rest}
        />
      </Row>
      {flash > 0.002 ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(circle at ${P.x}px ${P.y}px, ${rgba('#ffffff', 0.7 * flash)} 0%, ${rgba('#d6c8ff', 0.12 * flash)} 22%, ${rgba('#c4a8ff', 0)} 50%)` }}
        />
      ) : null}
      {end < 0.999 ? <AbsoluteFill style={{ background: ROOM.night, opacity: 1 - end }} /> : null}
    </AbsoluteFill>
  );
};
