/**
 * 8 s → ≈ 27.5 s · CALL — the heart of the film: the booking, spoken.
 * Every voiced moment is read from timing.ts (CALL.lines[i].at, vWord, …)
 * and from the real voices, so a regenerated voice re-times the scene.
 *
 *   t −4…0   the night room fades in over the twist's phone screen (same
 *            room, same orb, same flow time: the cut is invisible)
 *   t 0      PICKUP on the downbeat: squash / pop / glow (lib/pickup.ts), a
 *            ring; the zoomed room pulls back to the stage; CLOSED swings in;
 *            "Picked up on the first ring." rises — the only thing to read
 *   E        the orb glides up into the lockup; the big line gathers, dives
 *            into the orb, which gulps it (pop); "03 | 12" spring out of the
 *            orb; Ava's first caption plays under the establishing lockup
 *   P        "This is Ava": the digits and CLOSED peel off sideways, the
 *            camera pulls back 1.5 % and pushes into Ava's close-up
 *   A / C    shot / reverse-shot, SWUNG on each turn (shots.ts, CALL_LOCAL.swing:
 *            anticipation → SPRING.pop travel → settle, the parallax planes
 *            swinging with it, ghosted / smeared on the fastest frames): Ava =
 *            the big orb driven by her real envelope; the caller = the orb
 *            small in the listen palette + the phone line, which draws out of
 *            the orb's trailing edge and is pulled back into it; live
 *            captions, word-synced; AI-disclosure underline; slot chips
 *            "3:00 PM" / "4:30 PM" pop on the spoken times, 3:00 PM is picked
 *            on "o'clock" and flies into the orb with the last swing
 *   line 5   "You're all booked for / Wednesday at 3 PM." — the time ignites
 *            ember ON the spoken "three"; the payoff press; then everything but
 *            the mark and its glow blows away towards the lens; the result
 *            picks the mark up at markHide.
 *
 * Parallax (camera planes): room + orb light 0.3 · big dim discs 0.5 ·
 * orb, waveform, establishing type 1.0 · dust 1.3 · lens bokeh 1.6; in 9:16
 * a floor under the orb (its key-light pool and a soft reflection).
 * Captions, tags, chips and the mark are in screen space (the tag and the
 * chips follow a swing a little, smeared along it).
 */
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { Dust } from '../components/Dust';
import { flowTime } from '../components/Orb';
import { BOOKING, MarkGlow } from '../components/Shared';
import { MARK, MARK_GLOW_HANDOFF, TRANSCRIPT } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, mixHex, SPRING, springAt, tween } from '../lib/motion';
import { pickupGlow, pickupScale } from '../lib/pickup';
import { useSceneFrame } from '../lib/scene';
import { C, FONT } from '../theme';
import { CALL, CALL_LOCAL, FPS, SCENES, TWIST_LOCAL, vWord, type Caption } from '../timing';
import { VOICE } from '../voice.generated';
import { bloom, mixColor } from '../lib/lights';
import { exitCurve, Flare, RingPulse, Sparks } from './call/Accents';
import { Bokeh, type Disc } from './call/Bokeh';
import { CallCaptions, exitLength, wordExit, type CallCaption, type CaptionFont } from './call/CallCaptions';
import { callGlow, CALLER_GLOW, Floor, KeyLight, MidnightVignette, RoomBox, triple } from './call/Light';
import { Digits, OrbStage, type OrbState } from './call/Lockup';
import { callerK, camAt, framingAt, framings, orbBase, orbToScreen, planeCss, shotAt, swingAt, type Cam } from './call/shots';
import { ClosedSign, flightAt, PickupLine } from './call/Status';
import { Chips, MarkRow, SpeakerTag } from './call/Transcript';
import { lightAt, listenAt, onsets, ORB_FRAME0, orbVolumeByIndex, turnAt, volumeAt } from './call/voice';
import { Waveform } from './call/Waveform';
import { measure, useFontsReady, type FontSpec } from './result/measure';

const LINES = CALL.lines;
/** row A of the last line, as spoken: "You're all booked for" — "all" is heard but (until the voice's
 *  `say` carries it) has no aligned word of its own, so it rides "You're" */
const C5 = VOICE.lines[LINES[4].voice].words.map((w) => w.w.toLowerCase().replace(/[^a-z']/g, ''));
const ALL = C5.indexOf('all');
const ROW_A: Caption =
  ALL > 0 ? { text: "You're all booked for", word: 1, map: [1, ALL, ALL + 1, ALL + 2] } : { text: "You're all booked for", word: 1, map: [1, 1, 2, 3] };
/**
 * HEARD = READ. The callers say more than the aligned script: "Oh, hi. Um, could I…" and "Oh, three
 * o'clock is perfect. Thank you!". Those words have no aligned word of their own, so they are captioned
 * on the voice's own syllable onsets (call/voice.ts `onsets`) — if a regenerated take drops them, the
 * caption falls back to the script's.
 */
const v2 = VOICE.lines['call-2'];
const C2_OH = onsets('call-2', 0, vWord('call-2', 0) - 3)[0];
const C2_UM = onsets('call-2', Math.ceil(v2.phrases[0].end * FPS), vWord('call-2', 1) - 2)[0];
const v4 = VOICE.lines['call-4'];
const C4_OH = onsets('call-4', 0, vWord('call-4', 0) - 3)[0];
const C4_THANKS = onsets('call-4', Math.ceil(v4.phrases[v4.phrases.length - 1].end * FPS) + 1, v4.frames);
const CAPTIONS: readonly (readonly CallCaption[])[] = LINES.map((l, i) => {
  if (i === 1 && C2_OH !== undefined && C2_UM !== undefined)
    return [{ text: 'Oh, hi! Um…', word: 0, map: [0, 0, 0], at: [C2_OH, null, C2_UM] }, ...l.captions.slice(1)];
  if (i === 3 && C4_OH !== undefined) {
    const thanks = C4_THANKS.length >= 2;
    return [
      {
        text: `Oh, three o'clock is perfect.${thanks ? ' Thank you!' : ''}`,
        word: 0,
        map: [0, 0, 1, 2, 3, 3, 3],
        at: [C4_OH, null, null, null, null, ...(thanks ? [C4_THANKS[0], C4_THANKS[1]] : [])],
      },
    ];
  }
  if (i === 4) return [l.captions[0], ROW_A];
  return l.captions;
});

/** the caller's lines: when their phone line opens / is pulled back into the orb */
const CALLER_LINES = LINES.flatMap((l, i) => (l.who === 'caller' ? [i] : []));

/** the gulp: a damped kick on the orb's scale (overshoot + settle) */
const gulpKick = (tt: number) => {
  const u = tt - CALL_LOCAL.swallow;
  if (u < 0) return 0;
  return Math.exp(-u / 5) * Math.sin((Math.PI * u) / 5);
};
/** …and a level blip, so the orb's shader stirs as it swallows */
const gulpLevel = (tt: number) => {
  const u = tt - CALL_LOCAL.swallow;
  if (u < 0) return 0;
  return 0.16 * (1 - Math.exp(-u / 1.2)) * Math.exp(-u / 6);
};
/** Ava's talk swell on the orb — her level plus her syllables (eases in after the pickup, so t 0 is exact) */
const talkSwell = (tt: number) =>
  1 +
  (0.022 * Math.max(0, (volumeAt(tt) - 0.12) / 0.7) * (0.7 + 0.3 * Math.sin((tt / 48) * Math.PI * 2)) + 0.045 * lightAt(tt)) *
    tween(tt, [0, 6], [0, 1], EASE.house);

/** Ava's phrases: each caption after the first is "emitted" by the orb with a soft ring */
const PHRASE_RINGS = CALL.lines.flatMap((l) =>
  l.who === 'agent' ? l.captions.slice(1).map((c) => l.at + vWord(l.voice, c.word) - 1) : [],
);

/* the twist's phone screen at the end of its dive (twist/geometry.ts:
 * phone 260×540, bezel 9 → screen 242×522, scaled S about the avatar) */
const TWIST_SCREEN = { w: 242, h: 522 };

/** the chips are on screen during lines 2 and 3 (the echo slot is theirs while they are up) */
const chipsLine = (i: number) => i === 2 || i === 3;

/** the hits' light: the pickup's flash and the gulp's (the orb flares, its light floods the room) */
const pickupFlash = (tt: number) => (tt < 0 ? 0 : 0.55 * Math.exp(-tt / 5));
const gulpFlash = (tt: number) =>
  (tt < CALL_LOCAL.swallow ? 0 : 0.5 * Math.exp(-(tt - CALL_LOCAL.swallow) / 4)) +
  (tt < CALL_LOCAL.chipAbsorb ? 0 : 0.35 * Math.exp(-(tt - CALL_LOCAL.chipAbsorb) / 4));
/** the orb takes the picked slot in: a small gulp */
const absorbKick = (tt: number) => {
  const u = tt - CALL_LOCAL.chipAbsorb;
  if (u < 0) return 0;
  return Math.exp(-u / 4) * Math.sin((Math.PI * u) / 4.5);
};

/** the caller's line opens on its cut: a spring from the centre out (≈ 10 % overshoot, settled ≈ 10 f) */
const LINE_OPEN = { stiffness: 380, damping: 20, mass: 0.7 };

/** the far discs lean to the midnight's low, desaturated navy (the colour lives in the orb, not the room) */
const NAVY = '#2a3352';
/** (9:16) where the floor under the orb meets the frame (screen y): below the transcript, so the lower
 *  third holds the orb's pool of light and its reflection */
const FLOOR_Y = 1440;
/** the phone line is pulled back into the orb over this many frames (from lineClose) */
const LINE_CLOSE = 6;
/** sub-frame ghosts for a DOM plane that moves > 25 px a frame: [frames back, opacity] */
const GHOSTS = [
  [0.33, 0.42],
  [0.66, 0.22],
] as const;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * "Wednesday at 3 PM" measured in the mark's own setting (Inter 500 / −0.01em, as <BookedMark>):
 * its width (for the ember burst's ellipse), and "3 PM" in it — its centre's offset from the
 * mark's centre and its width (where the sparks fly off) — all in em.
 */
function markEm(size: number) {
  const f: FontSpec = { family: FONT.body, weight: 500, size, track: -0.01, lh: 1.22 };
  const em = (s: string) => measure(s, f).w / size;
  const W = em(BOOKING.mark);
  const w = em(BOOKING.time);
  return { W, num: { dx: em(`${BOOKING.day} ${BOOKING.at} `) + w / 2 - W / 2, w } };
}

export const Call: React.FC = () => {
  const t = useSceneFrame('call');
  const L = useLayout();
  const markSize = MARK(L).fontSize;
  const fontsReady = useFontsReady([`500 ${markSize}px ${FONT.body}`]);
  const ME = useMemo(() => markEm(markSize), [markSize, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  if (t < CALL_LOCAL.roomIn[0]) return null;

  const T = TRANSCRIPT(L);
  const M = MARK(L);
  const Fr = framings(L);
  const B = orbBase(L);
  const g0 = SCENES.call.from;
  const END = CALL_LOCAL.markHide;
  const live = t >= 0 && t < END;
  const cam = camAt(t, L);
  const shot = shotAt(t);

  /* ── the room: the phone screen pulls back into the whole stage ─── */
  const S0 = L.pick((L.width / TWIST_SCREEN.w) * 1.1, (L.width / TWIST_SCREEN.w) * 1.12);
  const open = tween(t, CALL_LOCAL.roomOpen, [0, 1], EASE.inOut);
  const box0 = { w: TWIST_SCREEN.w * S0, h: TWIST_SCREEN.h * S0 };
  const box1 = { w: L.width * 1.2, h: L.height * 1.2 };
  const room = {
    w: box0.w * Math.pow(box1.w / box0.w, open),
    h: box0.h * Math.pow(box1.h / box0.h, open),
  };
  const roomOp = tween(t, CALL_LOCAL.roomIn, [0, 1], EASE.inOut);
  // the phone's indigo grades down into the midnight as the camera pulls back out of the screen
  const grade = tween(t, CALL_LOCAL.roomGrade, [0, 1], EASE.inOut);

  /* ── the end: the orb inhales and dives INTO the mark (orbAt); everything else but the mark and its
   *    glow blows away towards the lens (the room stays) ── */
  const bw = tween(t, CALL_LOCAL.blowAway, [0, 1], EASE.in2);
  // …after the inhale: everything eases back 1.5 % (the anticipation), then flies at the lens
  const inhale = tween(t, CALL_LOCAL.blowInhale, [0, 1], EASE.inOut);
  const blowS = 1 - 0.015 * inhale * (1 - bw) + 0.12 * bw;
  const blow: React.CSSProperties =
    inhale > 0
      ? {
          transform: `scale(${blowS.toFixed(5)})`,
          transformOrigin: `${M.x}px ${M.y}px`,
          opacity: 1 - bw,
          filter: bw > 0 ? `blur(${(12 * bw).toFixed(2)}px)` : undefined,
        }
      : {};

  /* the room alone after the hand-over (under the result, until its own room is in) */
  const roomLayer = (
    <AbsoluteFill style={planeCss(cam, 0.3)}>
      <RoomBox x={L.cx} y={L.cy} w={room.w} h={room.h} grade={grade} />
    </AbsoluteFill>
  );
  // the twist hands over with its room already under the MidnightVignette (TWIST_LOCAL.roomVignette):
  // the call holds that from its roomIn, and room + light + vignette fade in over roomIn AS ONE GROUP,
  // so the cross-fade over the twist's identical pixels is exact (no flat, unvignetted room at the cut)
  const vignetteK = Math.max(TWIST_LOCAL.roomVignette, grade);
  if (t >= END) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {roomLayer}
        <MidnightVignette k={grade} />
      </AbsoluteFill>
    );
  }

  /* ── the voice ───────────────────────────────────────────────────── */
  const vol = volumeAt(t) + gulpLevel(t);
  const lvl = Math.max(0, (vol - 0.12) / 0.7);
  const light = lightAt(t);
  // the fluid runs a little quicker once the call is live, and quicker still on her syllables
  // (flow input only — the shader's own volume stays the site's); 0 at the pickup, so the cut is exact
  const flowBoost = (tt: number) => tween(tt, [0, 30], [0, 1], EASE.inOut) * (0.3 + 0.7 * lightAt(tt));
  const flow = flowTime(Math.max(0, Math.round(t + ORB_FRAME0)), (fr) => {
    const tt = fr - ORB_FRAME0;
    return orbVolumeByIndex(fr) + gulpLevel(tt) + flowBoost(tt);
  });

  /* ── the orb, on screen ─────────────────────────────────────────── */
  const [i0, i1] = CALL_LOCAL.blowInhale;
  const [v0, v1] = CALL_LOCAL.orbDive;
  // where the mark takes the orb: just above the middle of "Wednesday at 3 PM", a little smaller than its x-height
  const take = { x: M.x, y: M.y - 0.06 * M.fontSize, d: 0.45 * M.fontSize };
  const orbAt = (tt: number): OrbState => {
    const s0 = orbToScreen(camAt(tt, L), framingAt(tt, L));
    const s = { ...s0, d: s0.d * pickupScale(tt + g0) * (1 + 0.05 * gulpKick(tt) + 0.025 * absorbKick(tt)) * talkSwell(tt) };
    if (tt < i0) return s;
    // the inhale: the orb swells 5 % and draws back 8 px (away from the mark) — the dive's anticipation
    const inh = EASE.inOut(clamp01((tt - i0) / (i1 - i0)));
    const s1 = { x: s.x, y: s.y - 8 * inh, d: s.d * (1 + 0.05 * inh) };
    if (tt <= v0) return s1;
    // the dive: power3.in on position and (log) size — it is pulled into the mark, fastest on contact
    const e = EASE.in3(clamp01((tt - v0) / (v1 - v0)));
    return { x: s1.x + (take.x - s1.x) * e, y: s1.y + (take.y - s1.y) * e, d: s1.d * Math.pow(take.d / s1.d, e) };
  };
  /** the orb is absorbed over the dive's last 2 frames (gone on contact) */
  const fadeAt = (tt: number) => 1 - EASE.in2(clamp01((tt - (v1 - 2)) / 2));
  const orb = orbAt(t);
  const orbFade = fadeAt(t);
  // the contact: the mark takes the orb (a hot flash that has all but died by the hand-over)
  const took = t >= CALL_LOCAL.markTake ? Math.exp(-(t - CALL_LOCAL.markTake) / 1.4) : 0;
  // 2-3 glow copies trail the dive (each as absorbed as the orb was then), swallowed with it
  const trail =
    t > v0 && t < END
      ? ([
          [1, 0.45],
          [2, 0.28],
          [3, 0.15],
        ] as const)
          .filter(([dt]) => t - dt > v0)
          .map(([dt, a]) => [dt, a * fadeAt(t - dt) * (1 - EASE.in2(clamp01((t - v1 + 1) / 3)))] as const)
      : [];
  const dress = tween(t, [0, 12], [0, 1], EASE.house);
  // THE KEY LIGHT's colour follows the orb's palette: violet while Ava speaks, caller blue while the caller does
  const listen = listenAt(t);
  const glow = callGlow(listen);
  const hitFlash = pickupFlash(t) + gulpFlash(t);
  // …and the caller's line opening floods the room with its blue for a moment
  const lineFlash = CALL_LOCAL.lineOpen.reduce((a, at) => a + (t >= at ? 0.22 * Math.exp(-(t - at) / 4) : 0), 0);
  // (the key light goes where the orb goes: into the mark)
  const keyK = (dress * (0.16 + 0.1 * lvl + 0.18 * light) + 0.6 * hitFlash + lineFlash) * orbFade;
  const rim = pickupGlow(t + g0) + (0.2 * lvl + 0.3 * light) * tween(t, [0, 12], [0, 1], EASE.house);
  // the caller's framing (0 Ava … 1 caller), carried across each swing: the orb's depth of field
  const dof = 2 * callerK(t);
  /* the swing: the orb's on-screen velocity (px / frame) drives the smears of what follows it */
  const oA = orbAt(t - 0.5);
  const oB = orbAt(t + 0.5);
  const ov = { x: oB.x - oA.x, y: oB.y - oA.y };
  const oSpeed = Math.hypot(ov.x, ov.y);
  const sw = swingAt(t);
  // the parallax planes are ghosted over a swing's fastest frames
  const planeGhosts = sw && sw.speed > 0.15 ? GHOSTS : [];
  // the screen-space tag + chips follow the whip a little (≤ ≈ 12 px), smeared along it
  const ui = { x: 0.06 * ov.x, y: 0.06 * ov.y };
  const uiSmear = oSpeed > 25 ? { x: Math.min(8, Math.abs(ov.x) * 0.035), y: Math.min(8, Math.abs(ov.y) * 0.035) } : null;
  const uiStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: Math.abs(ui.x) + Math.abs(ui.y) > 0.05 ? `translate(${ui.x.toFixed(2)}px, ${ui.y.toFixed(2)}px)` : undefined,
    filter: uiSmear ? 'url(#call-ui-smear)' : undefined,
  };

  /* ── establishing: the lockup, CLOSED, the big line ─────────────── */
  const F = L.pick(170, 150);
  const [p0] = CALL_LOCAL.pushIn;
  const unfoldAt = (tt: number) => aos(tt, CALL_LOCAL.unfold, { anticip: 4, depth: 0.06, config: SPRING.site });
  const unfold = unfoldAt(t);
  const unfoldSpeed = unfoldAt(t + 0.5) - unfoldAt(t - 0.5);
  // each peels off after a 3-f inward counter-move (−2.5 % of the 700 px run)
  const peelAt = (tt: number, a: number) => exitCurve(tt, a, 10, { anticip: 3, dip: 0.025 });
  const [signPeelAt, digitPeelAt] = CALL_LOCAL.peel;
  const digitPeel = peelAt(t, digitPeelAt);
  const signPeel = peelAt(t, signPeelAt);
  const lockY = shot.kind === 'E' ? framingAt(t, L).y : Fr.lock.y;
  const flight = (tt: number) =>
    flightAt(tt, {
      x0: L.cx,
      y0: T.y,
      y1: Fr.lock.y,
      band: 0.62 * F,
      s1: L.pick(0.1, 0.12),
      lift: CALL_LOCAL.lift,
      dive: CALL_LOCAL.dive,
    });

  /* ── the caller's phone line (reverse shots): it draws OUT of the orb's trailing edge as the
   *    orb lands (16:9: from the end next to it; 9:16: from straight under it) and is pulled
   *    back INTO it as the orb swings back to Ava ── */
  const W = L.pick({ x0: 600, x1: 1840, cy: 360, bars: 64, maxH: 120 }, { x0: 60, x1: 1020, cy: 850, bars: 44, maxH: 130 });
  const lineOrigin: 'start' | 'center' = L.pick('start', 'center');
  const lineAt = (tt: number) => {
    for (let j = 0; j < CALLER_LINES.length; j++) {
      const o = CALL_LOCAL.lineOpen[j];
      const c = CALL_LOCAL.lineClose[j] ?? Infinity;
      if (tt >= o - 1 && tt < c + LINE_CLOSE) {
        // the close: a 2-frame swell (the line inhales with the orb's anticipation), then it is pulled in (power2.in)
        const close = tt < c + 2 ? -0.04 * Math.sin(((tt - c) / 2) * (Math.PI / 2)) * (tt >= c ? 1 : 0) : EASE.in2(clamp01((tt - c - 2) / (LINE_CLOSE - 2)));
        return { i: CALLER_LINES[j], o, open: springAt(tt, o - 1, LINE_OPEN), close };
      }
    }
    return null;
  };
  const ln = lineAt(t);
  // how fast the line's drawn end travels (px / frame): ghosted above 25
  const reachOf = (tt: number) => {
    const s0 = lineAt(tt);
    return s0 ? Math.max(0, s0.open) * (1 - Math.max(0, s0.close)) : 0;
  };
  const lineSpeed = Math.abs(reachOf(t + 0.5) - reachOf(t - 0.5)) * (W.x1 - W.x0) * (lineOrigin === 'start' ? 1 : 0.5);
  const lineGhosts = ln && (lineSpeed > 25 || planeGhosts.length) ? GHOSTS : [];
  const wave = (tt: number, cm: Cam, op: number, key: string) => {
    const s0 = lineAt(tt);
    if (!s0) return null;
    return (
      <AbsoluteFill key={key} style={{ ...planeCss(cm, 1), opacity: op }}>
        <Waveform
          t={tt}
          at={LINES[s0.i].at}
          voice={LINES[s0.i].voice}
          x0={W.x0}
          x1={W.x1}
          cy={W.cy}
          bars={W.bars}
          barW={8}
          maxH={W.maxH}
          opacity={1}
          open={s0.open}
          close={s0.close}
          origin={lineOrigin}
          color={CALLER_GLOW.core}
        />
        {/* the line connects: a flare runs out along it from the orb's side */}
        <Flare
          t={tt}
          at={s0.o}
          x={lineOrigin === 'start' ? W.x0 - 20 : (W.x0 + W.x1) / 2}
          anchor={lineOrigin}
          y={W.cy}
          w={(W.x1 - W.x0) * 1.08}
          color={CALLER_GLOW.core}
        />
      </AbsoluteFill>
    );
  };

  /* ── captions ─────────────────────────────────────────────────────── */
  const avaFont: CaptionFont = { family: FONT.body, weight: 500, size: T.fontSize, lineHeight: 1.22, tracking: '-0.01em' };
  const callerFont: CaptionFont = {
    family: FONT.cinema,
    weight: 500,
    size: Math.round(T.fontSize * 1.12),
    italic: true,
    lineHeight: 1.1,
    tracking: 0,
  };
  const echoY = T.y - L.pick(170, 160);
  // a line's last caption holds until the next speaker — it has (all but) left by the time the next
  // line's first word rises (on its cut, at + 1), unless the beat-after rule needs it longer
  // (<CallCaptions> enforces that); the last line's row A leaves on CALL_LOCAL.rowOut
  const holdOf = (i: number) =>
    i + 1 < LINES.length ? LINES[i + 1].at + 2 : CALL_LOCAL.rowOut + exitLength(ROW_A.text.split(' ').length);
  const turn = turnAt(t);

  // the AI disclosure: an electric underline drawn under "an AI assistant" as she says it
  const [d0, d1] = CALL_LOCAL.disclose;
  const dP = EASE.draw(tween(t, [d0, d1], [0, 1], (x) => x));
  const dGlow = tween(t, [d0, d0 + 3], [0, 1], EASE.out3) * (1 - tween(t, [d1, d1 + 10], [0, 1], EASE.inOut));
  const thick = Math.round(T.fontSize * 0.065);
  // the line draws with a white-hot tip that cools to electric once it locks (with a flash)
  const lock = t >= CALL_LOCAL.discloseLock ? Math.exp(-(t - CALL_LOCAL.discloseLock) / 4) : 0;
  const tip = mixHex('#f7f3ff', C.electric, tween(t, [d1, d1 + 8], [0, 1], EASE.inOut));
  const ulColor = `linear-gradient(90deg, ${C.electric} 0%, ${C.electric} 72%, ${mixHex(C.lilac, C.electric, tween(t, [d1, d1 + 8], [0, 1], EASE.inOut))} 90%, ${tip} 100%)`;
  const ulShadow =
    dGlow + lock > 0.01
      ? `0 0 ${(10 + 14 * lock).toFixed(1)}px rgba(124,58,237,${Math.min(1, 0.6 * dGlow + 0.5 * lock).toFixed(3)})` +
        (lock > 0.02 ? `, 0 0 4px rgba(247,243,255,${(0.7 * lock).toFixed(3)})` : '')
      : undefined;

  // "3 PM" / "4:30" flash lilac as they are spoken (linking the words to their chips)
  const pops = [LINES[2].at + CALL.slotPops[0], LINES[2].at + CALL.slotPops[1]] as const;
  // the chips own the echo slot while they are on screen
  const chipWindow = [pops[0] - 1, LINES[4].at + 9] as const;
  const flash = (at: number) => tween(t, [at - 2, at], [0, 1], EASE.out3) * (1 - tween(t, [at + 4, at + 10], [0, 1], EASE.inOut));

  /* ── the payoff: row B, the booked mark ───────────────────────────── */
  const last = LINES[4];
  const bm = CALL.bookedMark;
  const markAppear = [
    last.at + vWord(last.voice, 4) - 2,
    last.at + vWord(last.voice, 5) - 2,
    bm - 2,
    last.at + vWord(last.voice, 7) - 2,
  ] as const;
  const ember = tween(t, [bm, bm + 13], [0, 1], EASE.soft);
  const sheen = t < bm ? -1 : tween(t, [bm, END - 1], [0, 1], EASE.inOut);
  // the glow flashes up ON the mark, then HOLDS exactly the hand-over strength (no fade)
  const glowK =
    t < bm
      ? 0
      : t < bm + 5
        ? EASE.out3((t - bm) / 5)
        : t < bm + 8
          ? 1 - (1 - MARK_GLOW_HANDOFF) * EASE.inOut((t - bm - 5) / 3)
          : MARK_GLOW_HANDOFF + 0.5 * took;
  // the payoff beat: press 1 → .975 (3 f, power2.in), spring back — exactly 1 before the hand-over
  const P = CALL_LOCAL.payoff;
  // (+ the take: a 2 % gulp ON contact — back to exactly 1 by markHide − 1)
  const pulse =
    t < P || t >= END - 1
      ? 1
      : (t < P + 3 ? 1 - 0.025 * tween(t, [P, P + 3], [0, 1], EASE.in2) : 0.975 + 0.025 * springAt(t, P + 3, SPRING.pop)) +
        0.02 * took;
  /* row A's exit (CallCaptions), cascading word by word: the AVA tag leads it, the period of
   * "3 PM." follows it as the cascade's last word — the mark itself stays for the hand-over */
  const rowWords = ROW_A.text.split(' ').length;
  const rowStep = Math.min(1, 3 / (rowWords - 1));
  const periodExit = wordExit(t, CALL_LOCAL.rowOut + rowWords * rowStep);
  const tagExit = turnAt(t) === LINES.length - 1 ? wordExit(t, CALL_LOCAL.rowOut - 1) : null;

  /* ── planes ──────────────────────────────────────────────────────── */
  const discsFar: Disc[] = L.pick(
    [
      { x: 300, y: 830, r: 440, a: 0.05, soft: 60, seed: 'f1' },
      { x: 1690, y: 230, r: 380, a: 0.05, soft: 60, seed: 'f2' },
      { x: 1480, y: 1040, r: 340, a: 0.04, soft: 60, seed: 'f3' },
    ],
    [
      { x: 110, y: 1480, r: 440, a: 0.05, soft: 60, seed: 'f1' },
      { x: 990, y: 360, r: 380, a: 0.05, soft: 60, seed: 'f2' },
      { x: 900, y: 1880, r: 340, a: 0.04, soft: 60, seed: 'f3' },
    ],
  );
  // three large out-of-focus highlights at the frame's edges (the twist's own near discs: the same
  // place, size and seed, so the room keeps its light across the cut) — drawn as light: a violet body,
  // a brighter lilac rim, screen-blended (never grey lens dirt)
  const discsNear: Disc[] = L.pick(
    [
      { x: 110, y: 190, r: 110, a: 0.085, soft: 30, seed: 'n1' },
      { x: 1840, y: 610, r: 150, a: 0.075, soft: 40, seed: 'n2' },
      { x: 220, y: 1020, r: 130, a: 0.07, soft: 34, seed: 'n4' },
    ],
    [
      { x: 30, y: 250, r: 120, a: 0.085, soft: 30, seed: 'n1' },
      { x: 1070, y: 900, r: 150, a: 0.075, soft: 40, seed: 'n2' },
      { x: 50, y: 1710, r: 140, a: 0.07, soft: 34, seed: 'n3' },
    ],
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── 0.3 · the room + the orb's light on it (+ the vignette: one group over roomIn) ── */}
      <AbsoluteFill style={{ opacity: roomOp < 1 ? roomOp : undefined }}>
        {roomLayer}
        {live ? (
          <AbsoluteFill style={planeCss(cam, 0.3)}>
            {/* (9:16: the orb nearly fills the frame's width, so its spill is kept tighter to stay off the edges) */}
            <KeyLight x={orb.x} y={orb.y} d={orb.d} glow={glow} strength={keyK} spread={L.pick(3.2, 2.6)} />
          </AbsoluteFill>
        ) : null}
        <MidnightVignette k={vignetteK} />
      </AbsoluteFill>

      <AbsoluteFill style={blow}>
        {/* ── 9:16 · the orb's reflection on the floor, directly under it ── */}
        {live && L.vertical ? (
          /* (it belongs to the midnight: it comes up as the phone's screen grades into the room) */
          <Floor x={orb.x} y={orb.y} d={orb.d} glow={glow} strength={keyK * grade} level={lvl + 0.6 * light} dof={dof} />
        ) : null}
        {/* ── 0.5 · large dim discs of the orb's light, far behind (screen: they only add light) ── */}
        {live ? (
          <AbsoluteFill style={{ ...planeCss(cam, 0.5), opacity: dress, mixBlendMode: 'screen' }}>
            <Bokeh t={t} discs={discsFar} drift={2.2} color={triple(mixColor(glow.body, NAVY, 0.25))} />
          </AbsoluteFill>
        ) : null}

        {/* ── 1.0 · the establishing type: the big line dives BEHIND the lockup, into the orb ── */}
        {live && t < p0 + 12 ? (
          <AbsoluteFill style={planeCss(cam, 1)}>
            {t <= CALL_LOCAL.swallow ? (
              <PickupLine
                t={t}
                text="Picked up on the first ring."
                fontSize={L.pick(96, 92)}
                boxW={L.pick(1500, 940)}
                flight={flight}
                keyAt={CALL_LOCAL.statusIn + 2}
                glintAt={CALL_LOCAL.lineGlint}
              />
            ) : null}
            <ClosedSign
              t={t}
              cx={L.cx}
              cy={L.pick(150, 390)}
              start={CALL_LOCAL.statusIn}
              fontSize={L.pick(32, 30)}
              peel={signPeel}
              peelSpeed={peelAt(t + 0.5, signPeelAt) - peelAt(t - 0.5, signPeelAt)}
            />
            <Digits
              t={t}
              x={L.cx}
              y={lockY}
              orbD={Fr.lock.d}
              F={F}
              gap={L.pick(34, 28)}
              unfold={unfold}
              unfoldSpeed={unfoldSpeed}
              unfoldStart={CALL_LOCAL.unfold}
              peel={digitPeel}
              peelSpeed={peelAt(t + 0.5, digitPeelAt) - peelAt(t - 0.5, digitPeelAt)}
              sheens={[
                tween(t, [CALL_LOCAL.unfold + 6, CALL_LOCAL.unfold + 22], [0, 1], EASE.inOut),
                tween(t, [CALL_LOCAL.unfold + 10, CALL_LOCAL.unfold + 26], [0, 1], EASE.inOut),
              ]}
            />
          </AbsoluteFill>
        ) : null}

        {/* ── 1.0 · the caller's phone line (sub-frame ghosts while it draws / retracts fast) ── */}
        {ln ? (
          <>
            {lineGhosts.map(([dt, a], gi) => wave(t - dt, camAt(t - dt, L), a, `wg${gi}`))}
            {wave(t, cam, 1, 'w')}
          </>
        ) : null}

      </AbsoluteFill>

      {/* ── 1.0 · Ava's orb (screen coordinates from the camera; it leaves INTO the mark, not with the blow) ── */}
      <AbsoluteFill>
        <OrbStage
          t={t}
          base={B}
          orb={orb}
          orbAt={orbAt}
          volume={vol}
          flow={flow}
          listen={listen}
          rim={rim}
          dress={dress}
          dof={dof}
          ringStarts={CALL_LOCAL.rings}
          phraseRings={PHRASE_RINGS}
          light={light}
          gulp={CALL_LOCAL.swallow}
          rimIn={roomOp}
          glow={glow}
          flash={hitFlash}
          grade={dress}
          fade={orbFade}
          trail={trail}
        />
      </AbsoluteFill>

      <AbsoluteFill style={blow}>
        {live ? (
          <>
            {/* ── 1.3 · motes ─────────────────────────────────────────── */}
            <AbsoluteFill style={{ ...planeCss(cam, 1.3), opacity: dress }}>
              <Dust count={22} seed="call-motes" color={triple(glow.core)} opacity={0.45} size={[2, 7]} blur={[0.4, 3]} speed={0.45} frame={t + 600} />
            </AbsoluteFill>
            {/* ── 1.6 · lens bokeh (sub-frame ghosts over a swing's fastest frames: the nearest plane moves most) ── */}
            {[...planeGhosts, [0, 1] as const].map(([dt, a], gi) => (
              <AbsoluteFill
                key={`b${gi}`}
                style={{ ...planeCss(dt ? camAt(t - dt, L) : cam, 1.6), opacity: dress * a, mixBlendMode: 'screen' }}
              >
                <Bokeh t={t} discs={discsNear} color={triple(mixColor(glow.body, glow.core, 0.2))} rim={triple(glow.core)} />
              </AbsoluteFill>
            ))}
          </>
        ) : null}
      </AbsoluteFill>

      {/* ── screen · the transcript (each piece leaves by its own designed exit) ── */}
      <AbsoluteFill>
        {live ? (
          <>

            {/* ── screen · speaker tag, captions, chips ──────────────── */}
            {uiSmear ? (
              <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
                <defs>
                  <filter id="call-ui-smear" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation={`${uiSmear.x.toFixed(2)} ${uiSmear.y.toFixed(2)}`} />
                  </filter>
                </defs>
              </svg>
            ) : null}
            {turn >= 0 && (!tagExit || tagExit.op > 0.002) ? (
              <div
                style={{
                  ...uiStyle,
                  opacity: tagExit ? tagExit.op : undefined,
                  transform: tagExit ? `translateY(${tagExit.dy.toFixed(2)}px) scale(${tagExit.scale.toFixed(4)})` : uiStyle.transform,
                  transformOrigin: `${L.cx}px ${T.y - L.pick(78, 72)}px`,
                }}
              >
              <SpeakerTag
                key={turn}
                t={t}
                who={LINES[turn].who}
                at={LINES[turn].at}
                hit={CALL_LOCAL.tagPops[turn]}
                next={turn + 1 < LINES.length ? LINES[turn + 1].at : Infinity}
                x={L.cx}
                y={T.y - L.pick(78, 72)}
                fontSize={L.pick(32, 30)}
                dot={22}
              />
              </div>
            ) : null}
            {LINES.map((line, i) => {
              if (t < line.at - 4 || t > holdOf(i) + 30) return null;
              const agent = line.who === 'agent';
              return (
                <CallCaptions
                  key={i}
                  id={`call-cap${i}`}
                  t={t}
                  lineAt={line.at}
                  voice={line.voice}
                  captions={CAPTIONS[i]}
                  notBefore={line.at + 1}
                  x={L.cx}
                  y={T.y}
                  maxWidth={T.maxWidth}
                  font={agent ? avaFont : callerFont}
                  color={agent ? C.paper : C.callerLit}
                  glow={agent ? 'rgba(185,163,255,0.35)' : 'rgba(169,188,255,0.35)'}
                  holdUntil={holdOf(i)}
                  echoY={echoY}
                  echoBlock={chipsLine(i) ? chipWindow : undefined}
                  underline={
                    i === 0
                      ? {
                          caption: 1,
                          words: [3, 5],
                          p: dP,
                          color: ulColor,
                          thickness: thick,
                          shadow: ulShadow,
                        }
                      : undefined
                  }
                  tint={
                    i === 2
                      ? // "3 PM" / "4:30." (caption 1, words 2–3 / 5) flash lilac as they are spoken, linking them to their chips
                        (c, j) => (c === 1 && (j === 2 || j === 3 || j === 5) ? { color: C.lilac, k: flash(pops[j === 5 ? 1 : 0]) } : null)
                      : undefined
                  }
                />
              );
            })}
            <div style={uiStyle}>
              <Chips
                t={t}
                cx={L.cx}
                cy={T.y - L.pick(170, 160)}
                w={L.pick(330, 296)}
                h={L.pick(104, 92)}
                fontSize={L.pick(64, 56)}
                pops={CALL_LOCAL.chipPops}
                pick={CALL_LOCAL.pick}
                drop={CALL_LOCAL.chipDrop}
                leave={CALL_LOCAL.chipsOut}
                leaveTo={orbAt(CALL_LOCAL.chipAbsorb - 1)}
              />
            </div>
          </>
        ) : null}
      </AbsoluteFill>

      {/* ── screen · the booked mark + its glow (handed to the result at markHide) ── */}
      {live ? (
        <>
          {/* "3 PM" ignites: a warm pool of ember light flares behind the mark (gone long before the hand-over) */}
          {t >= CALL_LOCAL.ember && t < CALL_LOCAL.ember + 26 ? (
            <div
              style={{
                position: 'absolute',
                left: M.x + M.fontSize * ME.num.dx - M.fontSize * 4.2,
                top: M.y - M.fontSize * 2.1,
                width: M.fontSize * 8.4,
                height: M.fontSize * 4.2,
                background: bloom(
                  { body: C.ember, core: C.emberLit },
                  0.55 * Math.exp(-(t - CALL_LOCAL.ember) / 5) * (1 - tween(t, [CALL_LOCAL.ember + 18, CALL_LOCAL.ember + 25], [0, 1], EASE.inOut)),
                  { core: 0.6, coreSize: 0.45 },
                ),
                mixBlendMode: 'screen',
              }}
            />
          ) : null}
          <MarkGlow x={M.x} y={M.y} fontSize={M.fontSize} k={glowK} />
          {/* "3 PM" ignites: a ring leaves the mark, ember sparks fly off its end (away from the type; all gone ≈ 20 f later) */}
          <RingPulse
            t={t}
            at={CALL_LOCAL.ember}
            x={M.x}
            y={M.y}
            w={M.fontSize * (ME.W + 0.8)}
            h={M.fontSize * 1.24}
            radius={M.fontSize * 0.62}
            color={C.emberLit}
            grow={1.25}
            life={14}
            width={2}
            alpha={0.8}
          />
          <Sparks
            t={t}
            at={CALL_LOCAL.ember}
            x={M.x + M.fontSize * ME.num.dx}
            y={M.y - M.fontSize * 0.08}
            color={C.ember}
            hot={C.emberSoft}
            n={13}
            rx={M.fontSize * (ME.num.w / 2 + 0.2)}
            ry={M.fontSize * 0.62}
            reach={L.pick(120, 100)}
            life={17}
            size={4.5}
            fall={18}
            arc={[-62, 70]}
            seed="ember"
          />
          <MarkRow
            t={t}
            appear={markAppear}
            ember={ember}
            sheen={sheen}
            pulse={pulse}
            periodExit={periodExit}
            flare={took}
            x={M.x}
            y={M.y}
            fontSize={M.fontSize}
            show={t < END}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
