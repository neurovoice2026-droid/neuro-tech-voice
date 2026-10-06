/**
 * THE BIT-BUDGET PROBE (docs/ig/PIPELINE.md §8.1, build step 3): two 2 s strips at 120 fps that stand in for the
 * reels' two hardest pictures BEFORE any scene exists, so the grain and the dither are settled on the real encode
 * chain first (scripts/ig/qa/probe-encode.mjs: render → HEVC CRF 12 intermediate → x264 two-pass at the reel's bitrate).
 *
 *   IG-Probe-Night-9x16   ig2 f0–60 (SCRIPT.md ig2 b1): the night ground keyed rose on the colon, the "9:47 pm." lockup
 *                         (film 1 ClockLockup: tabular figures, the rose MeshOrb colon and its gradient halo), two
 *                         RingPulse hairlines, "You're closed." swapping to "Watch it book / this call.", a 28 px label.
 *   IG-Probe-Pearl-9x16   ig1 f255–315 (SCRIPT.md ig1 b3): the pearl ground with a sunday pool rising, the WeekGrid at
 *                         the camera's .94 with its 123 empty cells filling teal in a diagonal cascade, Geist Mono row
 *                         ticks and a label at 28 px, the parked teal orb, captions S5 → S6 with their words lighting.
 *
 * Stand-ins, not the scenes: the layout follows SCRIPT.md closely enough for the encoder to see the same amount of
 * ground, edge, small type and motion. 240 render frames each (timeline t = from + frame / 4).
 *
 * Props (the probe's variants, `--props`; default = the settled reels): reseed ('static' | 'timeline' | 'render') of
 * IgFinish's noise and
 * groundReseed of the ground's in-canvas dither (default: reseed), finish (FinishSpec overrides), dither (the ground's
 * in-canvas dither), quality (the ground canvas' backing resolution).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshOrb } from '../../components/MeshOrb';
import { subpixel } from '../../components/Type';
import { waitForFonts } from '../../lib/fonts';
import { EASE, SPRING, springUnit, tween } from '../../lib/motion';
import { ClockLockup, type Strip } from '../../scenes/hook/Clock';
import { RingPulse } from '../../scenes/hook/Rings';
import { C, FONT, TRACK, TYPE } from '../../theme';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { IgFinish, type FinishSpec, type Reseed } from '../components/Finish';
import { NightGround, PearlGround } from '../components/Ground';
import { useTimelineFrame } from '../scene';

export type ProbeProps = { reseed?: Reseed; groundReseed?: Reseed; finish?: Partial<FinishSpec>; dither?: number; quality?: number };
export const PROBE_FRAMES = 240;

const GRAPHITE = '#2b2a2e';
const ROSE = MOMENT_LIGHTS.rush;
const TEAL = MOMENT_LIGHTS.sunday;

/** A line rising out of its mask at `at` (SPRING.caption) and leaving up through it over 4 f at `out`. */
const MaskLine: React.FC<{ t: number; at: number; out?: number; top: number; left?: number; center?: boolean; h: number; children: React.ReactNode }> = ({ t, at, out = Infinity, top, left = 0, center, h, children }) => {
  if (t < at || t > out + 4) return null;
  const rise = 1 - springUnit(t - at, SPRING.caption);
  const leave = tween(t, [out, out + 4], [0, 1], EASE.in3);
  const y = rise * h - leave * h;
  const moving = Math.abs(y) > 0.01 && Math.abs(y) < h;
  return (
    <div style={{ position: 'absolute', top, left: center ? 0 : left, width: center ? 1080 : undefined, height: h, overflow: 'hidden', display: 'flex', justifyContent: center ? 'center' : 'flex-start' }}>
      <div style={{ whiteSpace: 'nowrap', ...subpixel(Math.abs(y) > 0.01 ? `translateY(${y.toFixed(3)}px)` : undefined, moving) }}>{children}</div>
    </div>
  );
};

/** words lighting from 72 % to 100 % ink on their onsets */
const Words: React.FC<{ t: number; words: readonly (readonly [string, number])[]; ink: string; accent?: Record<string, string> }> = ({ t, words, ink, accent = {} }) => (
  <>
    {words.map(([w, on], i) => (
      <span key={i} style={{ color: accent[w] ?? ink, opacity: 0.72 + 0.28 * tween(t, [on, on + 3], [0, 1], EASE.out3) }}>
        {i ? ' ' : ''}
        {w}
      </span>
    ))}
  </>
);

/* ── night: ig2 f0–60 ─────────────────────────────────────────────── */

const CLOCK = { font: 200, orb: 56, gap: 20, cy: 410 };
const FIG_INK = 'rgba(237, 236, 241, 0.9)';
const strip = (d: number | null): Strip => ({ cells: [{ digit: d, ink: FIG_INK }], pos: 0, speed: 0 });
/** the rings leave the colon at f −4 (already in flight at f0) and f56 (the second trill at f60) */
const RINGS = [-4, 56];

export const NightProbe: React.FC<ProbeProps> = ({ reseed = 'static', groundReseed = reseed, finish, dither, quality }) => {
  React.useState(() => waitForFonts());
  const t = useTimelineFrame();
  const flash = Math.max(...RINGS.map((s) => (t < s ? 0 : Math.exp(-(t - s) / 6))));
  const swap = 54;
  const head = { fontFamily: FONT.ui, fontSize: 92, fontWeight: TYPE.headline.weightOnDark, letterSpacing: TRACK.section, lineHeight: '98px', color: C.paper };
  const glint = (on: number) => (t >= on ? `rgb(${[34, 184, 207].map((c, i) => Math.round(c + ([237, 236, 241][i] - c) * tween(t, [on + 2, on + 14], [0, 1], EASE.inOut))).join(',')})` : C.paper);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <NightGround t={t} reseed={groundReseed} dither={dither} quality={quality} keyLight={{ x: 540, y: CLOCK.cy, strength: 0.42 + 0.1 * flash, color: ROSE.orb[2], radius: 620 }} />
      {RINGS.map((s) => (
        <RingPulse key={s} frame={t} t={t} start={s} cx={540} cy={CLOCK.cy} d0={CLOCK.orb} d1={780} freeze={1e6} dissolve={1} out={0} width0={1080} height0={1920} />
      ))}
      <div style={{ position: 'absolute', top: CLOCK.cy - 0.55 * CLOCK.font, left: 0, width: 1080, display: 'flex', justifyContent: 'center', alignItems: 'center', transform: `translateX(${-0.3 * CLOCK.font + 30}px)` }}>
        <ClockLockup
          strips={[strip(null), strip(9), strip(4), strip(7)]}
          lifts={[0, 0, 0, 0]}
          fontSize={CLOCK.font}
          orbSize={CLOCK.orb}
          gap={CLOCK.gap}
          orbScale={1 + 0.08 * flash}
          orbTime={t / 30}
          orbPalette={ROSE.orb}
          glowBody={ROSE.orb[2]}
          orbFlash={flash}
          orbDy={4}
          figuresOpacity={1}
          orbOpacity={1}
        />
        <span style={{ fontFamily: FONT.ui, fontSize: 84, fontWeight: 440, color: FIG_INK, marginLeft: 22, alignSelf: 'flex-end', marginBottom: 46 }}>pm.</span>
      </div>
      <MaskLine t={t} at={-20} out={swap} top={640} center h={108}>
        <span style={head}>You’re closed.</span>
      </MaskLine>
      <MaskLine t={t} at={swap + 2} top={640} center h={108}>
        <span style={head}>
          Watch it <span style={{ color: glint(62) }}>book</span>
        </span>
      </MaskLine>
      <MaskLine t={t} at={swap + 5} top={742} center h={108}>
        <span style={head}>this call.</span>
      </MaskLine>
      <div style={{ position: 'absolute', top: 1300, width: 1080, textAlign: 'center', fontFamily: FONT.ui, fontSize: 28, fontWeight: TYPE.label.weightOnDark, letterSpacing: TRACK.label, textTransform: 'uppercase', color: C.paperDim }}>
        ● Sample call
      </div>
      <div style={{ position: 'absolute', top: 1352, width: 1080, textAlign: 'center', fontFamily: FONT.mono, fontSize: 28, fontWeight: 440, color: C.paperDim }}>21:47 · after hours</div>
      <IgFinish white={0} spec={finish} reseed={reseed} />
    </AbsoluteFill>
  );
};

/* ── pearl: ig1 f255–315 ──────────────────────────────────────────── */

const GRID = { x0: 150, y0: 360, cw: 92, ch: 26, gx: 16, gy: 6, cols: 7, rows: 24 };
const CAM = { zoom: 0.94, ox: 540, oy: GRID.y0 + (24 * 26 + 23 * 6) / 2 };
const staffed = (c: number, r: number) => c < 5 && r >= 9 && r <= 17;
/** the cascade: from Friday 18:00 through the nights and the weekend, one diagonal per 16th from f262 */
const CASCADE = { at: 262, step: 2.6 };
const stepOf = (c: number, r: number) => ((c - 4 + 7) % 7) + Math.floor(((r - 18 + 24) % 24) / 3);

const Cell: React.FC<{ c: number; r: number; t: number }> = ({ c, r, t }) => {
  const x = GRID.x0 + c * (GRID.cw + GRID.gx);
  const y = GRID.y0 + r * (GRID.ch + GRID.gy);
  if (staffed(c, r)) return <rect x={x} y={y} width={GRID.cw} height={GRID.ch} rx={6} fill={GRAPHITE} fillOpacity={0.86} />;
  const on = CASCADE.at + stepOf(c, r) * CASCADE.step;
  const u = t < on ? 0 : springUnit(t - on, SPRING.pop);
  const s = 0.82 + 0.18 * u;
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={GRID.cw - 1} height={GRID.ch - 1} rx={6} fill={GRAPHITE} fillOpacity={0.06} stroke={GRAPHITE} strokeOpacity={0.24} strokeWidth={1} />
      {u > 0.001 ? (
        <rect
          x={x + (GRID.cw * (1 - s)) / 2}
          y={y + (GRID.ch * (1 - s)) / 2}
          width={GRID.cw * s}
          height={GRID.ch * s}
          rx={6}
          fill={TEAL.ink}
          fillOpacity={0.7 * Math.min(1, u)}
        />
      ) : null}
    </g>
  );
};

const S5 = [['The', 255], ['other', 259], ['123?', 264]] as const;
const S6 = [['That’s', 292], ['the', 297], ['agent’s', 300], ['shift.', 308]] as const;

export const PearlProbe: React.FC<ProbeProps> = ({ reseed = 'static', groundReseed = reseed, finish, dither, quality }) => {
  React.useState(() => waitForFonts());
  const t = 255 + useTimelineFrame();
  const pool = tween(t, [262, 292], [0, 0.3], EASE.inOut);
  const cap = { fontFamily: FONT.ui, fontSize: 68, fontWeight: TYPE.caption.weight, letterSpacing: TRACK.caption, lineHeight: '80px' };
  const tick = { position: 'absolute' as const, fontFamily: FONT.mono, fontSize: 28, fontWeight: 460, color: GRAPHITE, opacity: 0.66 };
  const rowY = (r: number) => GRID.y0 + r * (GRID.ch + GRID.gy) - 2;
  return (
    <AbsoluteFill style={{ background: '#f3f2f6' }}>
      <PearlGround
        t={t}
        reseed={groundReseed}
        dither={dither}
        quality={quality}
        paletteB={TEAL.orb}
        mix={pool}
        keyLight={{ x: 180, y: 1560, strength: 0.35, color: '#4a4852' }}
      />
      <AbsoluteFill style={{ transform: `scale(${CAM.zoom})`, transformOrigin: `${CAM.ox}px ${CAM.oy}px` }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
          {Array.from({ length: GRID.cols * GRID.rows }, (_, i) => (
            <Cell key={i} c={i % GRID.cols} r={Math.floor(i / GRID.cols)} t={t} />
          ))}
        </svg>
        <div style={{ ...tick, left: 86, top: rowY(9) }}>09</div>
        <div style={{ ...tick, left: 86, top: rowY(18) }}>18</div>
        <div style={{ position: 'absolute', left: GRID.x0, width: 5 * GRID.cw + 4 * GRID.gx, top: 318, textAlign: 'center', fontFamily: FONT.ui, fontSize: 28, fontWeight: TYPE.label.weight, letterSpacing: TRACK.label, color: GRAPHITE, opacity: 0.7 }}>
          MON–FRI
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 840 - 20, top: 300 - 20 }}>
        <MeshOrb size={40} palette={TEAL.orb} time={t / 30} style={{ transform: `scale(${(1 + 0.04 * Math.sin((t / 30) * Math.PI * 1.2)).toFixed(4)})` }} />
      </div>
      <MaskLine t={t} at={252} out={289} top={1236} left={86} h={86}>
        <span style={cap}>
          <Words t={t} words={S5} ink={GRAPHITE} accent={{ '123?': TEAL.ink }} />
        </span>
      </MaskLine>
      <MaskLine t={t} at={291} top={1236} left={86} h={86}>
        <span style={cap}>
          <Words t={t} words={S6} ink={GRAPHITE} />
        </span>
      </MaskLine>
      <IgFinish white={1} spec={finish} reseed={reseed} />
    </AbsoluteFill>
  );
};
