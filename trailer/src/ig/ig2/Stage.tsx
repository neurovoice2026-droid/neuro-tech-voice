/**
 * REEL 2 · THE STAGE — the parts that live across acts, each a pure function of the ABSOLUTE timeline frame `t`, so every
 * act (and the end card's seam) draws the same picture at the same frame:
 *
 *   Ground2      the series' only dark ground (SCRIPT.md ig2 b1): the night INK_MESH, deep, its key light ON THE LIGHT IN
 *                FRAME — the phone's rose at the colon until the pickup, her teal following the orb after it
 *   orbPose      where her orb is: born at the colon, gliding to the label band (EASE.inOut, .6 s), parked there
 *   Ig2Frame0    FRAME 0's composition (also re-formed by the end card's seam at t − END ∈ [−14, 0)): the "9:47 pm." lockup
 *                set at 72 % with its colon the rose line light ringing (a RingPulse already in flight), "You're closed."
 *                set at 72 %; then S2 "Watch it book / this call." ("book" taking her teal glint)
 *   CallPanel    the call (b2–b9): the white panel LANDS on the pickup (the house settle, SPRING.site, from 120 px below —
 *                a short move under her newborn orb, never a whip across the frame; no peek in the bottom UI band), its
 *                header ● SAMPLE CALL (the site's REEL.kicker; no call timer); the LiveTranscript (her rows ARE the
 *                captions; the caller's turns a level meter) — the panel HUGS it: the greeting's height, then the
 *                caller's row, then the tool row and the slot strip on "Saturday"; the two tool rows; the slot strip. On
 *                the hang-up the header swaps to the Booked pill and the panel FOLDS to it — the call FILED: a record
 *                card (the pill over the transcript's first line, the dashboard's call row: words she said) that steps
 *                back (× .94, shade .05) behind the EventCard (Cards.tsx).
 */
import React from 'react';
import { GlideContext } from '../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { mixColor } from '../../lib/lights';
import { APP, measureText, Panel, Swap, typo, ui, W } from '../../kb/kit';
import { GRAPHITE } from '../../kb/theme';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { LiveTranscript, ToolRow, type Turn } from '../components/Call';
import { Captions, type CapPlace } from '../components/Captions';
import { GROUND, NightGround } from '../components/Ground';
import { OutcomePill, outcomePillSize } from '../components/OutcomePill';
import { LineLight, RING_INK } from '../components/Orb';
import { ZoneRect } from '../components/ZoneGuard';
import { ClockLockup, lockColon } from './Clock';
import { SlotStrip } from './SlotStrip';
import * as T from './timing';

const SUNDAY = MOMENT_LIGHTS.sunday;
const RUSH = MOMENT_LIGHTS.rush;
const M = T.M;

/* ── her orb ── */
/** her place on the call: top left, over the panel's left edge (SCRIPT: (160, 300), Ø 132 — set lower with the whole
 *  stage (fix round 1: the call act sat top-heavy, its lower 980 px empty), 90 px above the panel) */
export const PARK = { x: 162, y: 444, d: 132 } as const;
/** the colon's line light (Ø) */
export const DOT = 30;
export function orbPose(t: number): { x: number; y: number; d: number; moving: boolean } {
  const c = lockColon();
  const g = tween(t, M.glide, [0, 1], EASE.inOut);
  return { x: mix(c.x, PARK.x, g), y: mix(c.y, PARK.y, g), d: PARK.d, moving: g > 0 && g < 1 };
}

/* ── the ground ── */
/** each hairline flares the room: the rose light swells on its launch (× its strength: the trills full, the blinks
 *  between them about half) and dies away over ≈ ½ s — the room pulses with the phone until the pickup (frame 0 sits
 *  mid-flare; the seam's ground arrives at the same flare) */
export function ringFlare(t: number) {
  let f = 0;
  for (const p of M.pulses) if (t >= p.at && p.at < T.PICKUP - 2) f += p.k * Math.exp(-(t - p.at) / 10) * Math.min(1, (t - p.at) / 1.5);
  return Math.min(1, f) * (1 - tween(t, [T.PICKUP - 2, M.birth + 4], [0, 1], EASE.inOut));
}
/** her light on the night: her deep teal (SUNDAY.orb[1]), screened over the DEEP pool the key pulls to the light (never
 *  the mesh's lilac light pool: teal over that dimmed lilac mixed to a grey haze, fix round 1), in a room dimmed a touch
 *  after her birth (groundBrightness) — a teal light in the dark, not a fog */
const TEAL_KEY = '#0e7490';
/** the night's key light on the light in frame: the rose colon, then her light at the orb — the colour crossing over the
 *  birth in OKLab (the cool way round, through violet: lib/lights mixColor), with the strength and the radius. The key
 *  pulls the mesh's DEEP pool onto the light, so the light sits in the dark (the lockup reads off a darker ground) */
export function groundKey(t: number) {
  const p = orbPose(t);
  const k = tween(t, [M.birth, M.birth + 8], [0, 1], EASE.inOut);
  const hang = tween(t, [M.hangup, M.hangup + 20], [0, 1], EASE.inOut);
  const flare = ringFlare(t);
  return {
    x: p.x,
    y: p.y,
    strength: mix(0.36 + 0.2 * flare, mix(0.56, 0.46, hang), k),
    color: mixColor(RUSH.orb[1], TEAL_KEY, k),
    radius: mix(500 + 90 * flare, 420, k),
    pool: 'deep' as const,
  };
}
/** the night's brightness (GROUND.night 0.45 in the hook): her room is a touch darker, so her light reads as light */
const B_CALL = 0.38;
export const groundBrightness = (t: number) => mix(GROUND.night.brightness, B_CALL, tween(t, [M.birth + 2, M.birth + 32], [0, 1], EASE.inOut));
type Key = NonNullable<React.ComponentProps<typeof NightGround>['keyLight']>;
export const Ground2: React.FC<{ t: number; keyLight?: Key }> = ({ t, keyLight }) => <NightGround t={t} keyLight={keyLight ?? groundKey(t)} brightness={groundBrightness(t)} />;

/* ── frame 0 ── */
/** THE RING TRAIN (fix round 2: the frame-0 hairlines were 1–1.5 px, gone by f60): rose hairlines leaving the colon light
 *  — film 1 hook/Rings' power2.out travel, heavier and further: 3–4 px as they leave, thinning to ≈ 1.7 px, out to Ø 1100
 *  for a trill (across the lockup, the line and the dark below them), Ø 760 for a blink. SVG, never pixel-snapped;
 *  drawn under the type. Frame 0 holds two in flight. */
const RING_LIFE = 34;
const RingTrain: React.FC<{ t: number; x: number; y: number; d0: number }> = ({ t, x, y, d0 }) => {
  const live = M.pulses.filter((p) => t >= p.at && t < p.at + RING_LIFE && p.at < T.PICKUP);
  if (!live.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {live.map((p) => {
        const age = t - p.at;
        const e = 1 - (1 - age / RING_LIFE) ** 2;
        const born = tween(t, [p.at, p.at + 1.5], [0, 1], EASE.out3);
        const young = Math.max(0, 1 - age / 12);
        const w = (1.7 + 2.2 * young) * (0.8 + 0.2 * p.k);
        const a = Math.min(1, p.k * (0.66 + 0.34 * young)) * born * (1 - e) ** 0.6;
        const r = Math.max(0, (d0 + (p.d1 - d0) * e) / 2 - w / 2);
        return <circle key={p.at} cx={x} cy={y} r={r.toFixed(3)} fill="none" stroke={RING_INK.rush} strokeOpacity={a.toFixed(4)} strokeWidth={w.toFixed(3)} />;
      })}
    </svg>
  );
};
/** THE HOOK'S PUSH (SCRIPT b1 "a breathing push"): the hook's type leans in ABOUT THE RINGING LIGHT — 1.5 % over the
 *  hook, from frame 0 with its speed already on (frame 0 is mid-motion; the seam's re-formed frame 0 sits at 1), held
 *  from the pickup while the figures leave. The colon is the push's centre, so her orb is born exactly where it rang. */
const HOOK_PUSH = 0.015;
export const hookZoom = (t: number) => (t <= 0 ? 1 : 1 + HOOK_PUSH * Math.sin((Math.PI / 2) * Math.min(1, t / T.PICKUP)));
const HookPlane: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => {
  const z = hookZoom(t);
  const c = lockColon();
  const moving = t > 0 && t < T.PICKUP + 10;
  return (
    <GlideContext.Provider value={moving}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: Math.abs(z - 1) > 1e-6 ? `translate(${(c.x * (1 - z)).toFixed(4)}px, ${(c.y * (1 - z)).toFixed(4)}px) scale(${z.toFixed(6)})` : undefined }}>
        {children}
      </div>
    </GlideContext.Provider>
  );
};
const HOOK = (k: number): CapPlace => ({ x: 540, y: 710, align: 'center', maxWidth: 780, role: 'headline', size: 92, tone: 'night', lineHeight: 1.08, rows: k === 2 ? [3] : undefined });
/** "closed." in the phone's rose (set: the dilemma), "book" taking her teal on its onset (the promise) */
const HOOK_KEYS = [
  { words: [3], ink: '#f9a8d4', from: 'set' as const },
  { words: [6], ink: '#a5eaf5', glint: '#f0fdff' },
] as const;

/** Frame 0's composition at hook time t (the seam draws it at t ∈ [−14, 0) with `dot` off: her closing orb is the dot). */
export const Ig2Frame0: React.FC<{ t: number; dot?: boolean }> = ({ t, dot = true }) => {
  const c = lockColon();
  const v = T.VOICES[0];
  const on = (k: number) => v.at + T.vWord('ig2-01', k);
  // the light rings until the pickup (its click cuts the third ring): the ring train, the dot flashing with each hairline
  return (
    <>
      <RingTrain t={t} x={c.x} y={c.y} d0={DOT} />
      {dot && t < M.birth + 1 ? <LineLight t={t} x={c.x} y={c.y} d={DOT} rings={M.rings} /> : null}
      <HookPlane t={t}>
        <ClockLockup t={t} onsets={[on(0), on(1)]} exitAt={T.PICKUP - 1} />
        <Captions T={T} id="ig2-01" t={t} place={HOOK} skip={[0]} keys={HOOK_KEYS} glint={RUSH.orb[3]} timing={{ setScreens: 2, exits: { 2: M.s2Out } }} what="hook" />
      </HookPlane>
    </>
  );
};

/* ── the call panel ── */
/** the panel: x 86–906 from y 600 (SCRIPT 400–1180, set lower with the stage: its lower edge reaches y 1312 grown) —
 *  hGreet holds her greeting, hCall the caller's first row too, hFull the tool row and the slot strip, hFold the record */
export const PANEL = { x: 86, y: 600, w: 820, r: 44, pad: 48, hGreet: 318, hCall: 470, hFull: 712, hFold: 168 } as const;
const BOX = { x: 134, y: PANEL.y + 96, w: 724, h: 332 } as const;
const TOOL_Y = PANEL.y + 450;
/** the landing: from this far below, on the house settle (SPRING.site: one 7.5 % overshoot, in ≈ 5 f) */
const LAND = 120;
/** … UNFOLDING from its header strip as it lands (fix round 2: a white card fading in on the night passes through a grey,
 *  frosted state): opaque on its first render frame, then the panel opens down to the greeting's height — the fold of
 *  the hang-up played forward */
const UNFOLD = { from: 104, dur: 7 } as const;

/** the caller's level meter (fix round 2: 5 bars of 8 × 28 px read as five dots on a phone): 12 × 64 px bars swinging
 *  over their whole height (≈ 2.3 × the SCRIPT's), rising out of their mask WITH the ● CALLER tag — the caller is
 *  plainly talking */
const METER = { bars: 5, barW: 12, maxH: 64, gap: 12, gain: 2.2, rise: true } as const;
const TURNS: Turn[] = [
  { who: 'ava', id: 'ig2-02', keys: [{ words: [5, 6, 7], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
  { who: 'caller', from: T.CALLERS[0][0], to: T.CALLERS[0][1] },
  { who: 'ava', id: 'ig2-03' },
  { who: 'caller', from: T.CALLERS[1][0], to: T.CALLERS[1][1] },
  { who: 'ava', id: 'ig2-04' },
  { who: 'caller', from: T.CALLERS[2][0], to: T.CALLERS[2][1] },
  { who: 'ava', id: 'ig2-05', keys: [{ words: [3], ink: SUNDAY.ink, glint: SUNDAY.orb[2] }] },
];

/** the panel's state at t: its vertical offset (the landing), its height (greeting → call → grown → folded), its step back */
export function panelState(t: number) {
  const up = springUnit(t - M.panelUp, SPRING.site);
  const dy = (1 - up) * LAND;
  const o = tween(t, [M.panelUp - 0.25, M.panelUp], [0, 1], (x) => x);
  const open = tween(t, [M.panelUp, M.panelUp + UNFOLD.dur], [0, 1], EASE.out3);
  const room = tween(t, [M.room, M.room + 10], [0, 1], EASE.house);
  const grow = tween(t, [M.grow, M.grow + 11], [0, 1], EASE.house);
  const fold = tween(t, [M.fold, M.fold + 10], [0, 1], EASE.inOut);
  const h = mix(mix(mix(mix(UNFOLD.from, PANEL.hGreet, open), PANEL.hCall, room), PANEL.hFull, grow), PANEL.hFold, fold);
  const back = tween(t, [M.fold + 8, M.fold + 20], [0, 1], EASE.inOut);
  const between = (u: number) => u > 0 && u < 1;
  return { dy, o, h, fold, back, moving: Math.abs(dy) > 0.02 || between(open) || between(room) || between(grow) || between(fold) || between(back) };
}

/** the folded record's pose in the gate and the end card (camera, step-back) — supplied by the acts */
export type HeaderPose = { dx: number; dy: number; scale: number; shade: number; opacity: number; moving: boolean };

/** the record's line: the transcript's first words — hers, as the dashboard lists a call (film 2's RecordRow) */
const RECORD_LINE = typo('Northside Studio, this is Ava, an AI assistant.');
const RECORD = { size: 28, top: 98 } as const;

export const CallPanel: React.FC<{ t: number; pose?: HeaderPose }> = ({ t, pose }) => {
  if (t < M.panelUp - 1) return null;
  const S = panelState(t);
  const ink = '#1e0b38';
  const label = typeStyle('label', true, { tone: 'paper', size: 28 });
  const scale = (pose?.scale ?? 1) * mix(1, 0.94, S.back);
  const shade = (pose?.shade ?? 0) + 0.05 * S.back;
  // the call FILED: as the panel folds to its record, its first line rises in under the Booked pill as the call's
  // content clears (never a blank card between them)
  const rec = t < M.record - 1 ? null : springUnit(t - M.record, SPRING.site);
  // the call's content goes as the panel folds: clipped by the rising edge, and faded out over the first half of the
  // fold so nothing of the transcript is left inside the folded record
  const contentFade = 1 - smooth(0, 0.45, S.fold);
  const contentOn = contentFade > 0.002;
  const clipBottom = 1920 - (PANEL.y + S.h);
  const pill = outcomePillSize('booked', 28);
  const opacity = (pose?.opacity ?? 1) * S.o;
  const recW = PANEL.w - 2 * PANEL.pad;
  return (
    <>
      <Panel
        x={PANEL.x}
        y={PANEL.y}
        w={PANEL.w}
        h={S.h}
        radius={PANEL.r}
        lift={3}
        ink={ink}
        k={1.4}
        dx={pose?.dx ?? 0}
        dy={S.dy + (pose?.dy ?? 0)}
        scale={scale}
        shade={shade}
        opacity={opacity}
        clip
      >
        {/* the header: ● SAMPLE CALL (the site's REEL.kicker), swapping to the Booked pill on the hang-up */}
        <div style={{ position: 'absolute', left: PANEL.pad, top: 26, height: 48, width: 420 }}>
          <Swap t={t} at={T.HANGUP} rise={30}>
            <div style={{ ...label, color: GRAPHITE.tag, display: 'flex', alignItems: 'center', gap: 14, height: 48 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: GRAPHITE.tag }} />
              Sample call
            </div>
            <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
              <OutcomePill kind="booked" size={28} />
            </div>
          </Swap>
        </div>
        {rec !== null ? (
          <div style={{ position: 'absolute', left: PANEL.pad, top: RECORD.top - 6, width: recW, height: RECORD.size * 1.3 + 12, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                ...ui(RECORD.size, W.regular, { tracking: -0.01 }),
                lineHeight: 1.3,
                color: APP.mutedFg,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: recW,
                opacity: smooth(0, 0.5, rec),
                transform: rec < 0.999 ? `translateY(${((1 - rec) * 100).toFixed(3)}%)` : undefined,
              }}
            >
              <span style={{ fontWeight: W.medium, color: SUNDAY.ink }}>Ava</span>
              <span style={{ color: APP.mutedFg }}>{'  ·  '}</span>
              {RECORD_LINE}
            </div>
          </div>
        ) : null}
      </Panel>
      {t >= M.panelUp + 4 && (pose?.opacity ?? 1) > 0.5 ? (
        <ZoneRect
          what={t < T.HANGUP ? 'call header SAMPLE CALL' : 'call header Booked'}
          rect={foldedRect({ x: PANEL.x + PANEL.pad, y: PANEL.y + 26, w: t < T.HANGUP ? 23 + measureText('SAMPLE CALL', { size: 28, weight: 540, tracking: 0.14 }) : pill.w, h: 48 }, S.dy, pose, scale)}
        />
      ) : null}
      {rec !== null && rec > 0.5 && (pose?.opacity ?? 1) > 0.5 ? (
        <ZoneRect what="call record line" rect={foldedRect({ x: PANEL.x + PANEL.pad, y: PANEL.y + RECORD.top, w: recW, h: RECORD.size * 1.3 }, S.dy, pose, scale)} />
      ) : null}
      {/* the call's content, in frame coordinates, clipped to the panel (it folds away with it) */}
      {contentOn && t >= T.PICKUP ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1080,
            height: 1920,
            clipPath: `inset(${PANEL.y + 70}px ${1080 - PANEL.x - PANEL.w}px ${clipBottom.toFixed(2)}px ${PANEL.x}px round 0px 0px ${PANEL.r}px ${PANEL.r}px)`,
            transform: Math.abs(S.dy) > 0.01 ? `translateY(${S.dy.toFixed(3)}px)` : undefined,
            opacity: contentFade * S.o >= 0.999 ? undefined : contentFade * S.o,
          }}
        >
          <GlideContext.Provider value={S.moving}>
            <LiveTranscript T={T} t={t} turns={TURNS} spec={{ x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h, size: 52, meter: METER, scrollLead: M.scrollLead }} moving={S.moving} />
            <ToolRow t={t} label="Checked your availability" x={BOX.x} y={TOOL_Y} at={M.tool1} done={M.tool1Done} exitAt={M.tool2 - 5} />
            <ToolRow t={t} label="Booked an appointment" x={BOX.x} y={TOOL_Y} at={M.tool2} done={M.tool2Done} />
            <SlotStrip t={t} m={{ sat: M.sat, chips: M.chips, check: M.chipsLit, pulse: M.pulse, fill: M.fill, name: M.name, booked: M.booked }} moving={S.moving} />
          </GlideContext.Provider>
        </div>
      ) : null}
    </>
  );
};

/** a rect of the panel's on screen (the zone guard): unposed, the landing's offset; posed (the gate and the end card),
 *  the panel's own transform — the pose's offset and its full scale (with the step back) about the folded panel's
 *  centre (fix round 2: the header's rect stayed where the panel had been) */
function foldedRect(r: { x: number; y: number; w: number; h: number }, dy: number, pose: HeaderPose | undefined, sc: number) {
  if (!pose) return { ...r, y: r.y + dy };
  const cx = PANEL.x + PANEL.w / 2 + pose.dx;
  const cy = PANEL.y + PANEL.hFold / 2 + pose.dy + dy;
  return { x: cx + (r.x - (PANEL.x + PANEL.w / 2)) * sc, y: cy + (r.y - (PANEL.y + PANEL.hFold / 2)) * sc, w: r.w * sc, h: r.h * sc };
}
