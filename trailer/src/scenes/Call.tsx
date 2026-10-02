/**
 * 8 s → ≈ 29.5 s · CALL — the heart of the film: the booking, spoken.
 * Every voiced moment is read from timing.ts (CALL.lines[i].at, vWord, …)
 * and from the real voices, so a regenerated voice re-times the scene.
 *
 *   t −4…0   the room fades in over the twist's phone screen (the same
 *            midnight, the same orb, the same flow time: the cut is invisible)
 *   t 0      PICKUP on the downbeat: squash / pop / ring (lib/pickup.ts); the
 *            orb takes the closing light's emerald and the room LIGHTS UP from
 *            it — the emerald gradient mesh opens out of the orb (call/Mesh)
 *            as the camera's room opens; CLOSED rises; "Picked up on the first
 *            ring." rises — the only thing to read
 *   E        the orb glides up into the lockup; the big line gathers, dives
 *            into the orb, which gulps it; "03 | 12" slide out of the orb;
 *            Ava's first caption plays under the lockup
 *   P        "This is Ava": the figures fold back into the orb as it grows into
 *            Ava's framing
 *   the call ONE CENTRED ORB above the speaker label and the caption — it
 *            breathes with her real voice and sways gently left ↔ right
 *            (call/shots.ts); on the caller's turns it calms in place, eases to
 *            the listen palette, and the caller's real envelope draws out under
 *            it as a fine line (call/Waveform). Live captions in TYPE.caption,
 *            word-synced, key words in the ONE accent ink (mint) — colour alone
 *            carries the emphasis (no underline, no slot chips: the two-tone
 *            caption carries the names, the disclosure, the day and the times)
 *   line 5   "You're all booked for / Wednesday at 3 PM." — the mark rises in
 *            the mint on the voice; the payoff press ON the spoken "three"; row A
 *            leaves; the orb inhales and dives INTO the mark, and on the contact
 *            the ember (the film's colour for Booked — the result's accent)
 *            ignites out of the point it went in, its glow with it: the only
 *            ember in the scene, in its last ~4 frames, which the result picks
 *            up at markHide.
 *
 * Nothing in the scene is blurred, smeared or ghosted; there is no bokeh, no
 * dust, no camera shake. Smoothness is the 120 fps render and the curves.
 */
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { flowTime } from '../components/Orb';
import { MarkGlow } from '../components/Shared';
import { MARK, MARK_GLOW_HANDOFF, MARK_TYPE, TRANSCRIPT } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { EASE, SPRING, springUnit, tween } from '../lib/motion';
import { pickupGlow, pickupScale } from '../lib/pickup';
import { useSceneFrame } from '../lib/scene';
import { captionFont, typeSize } from '../lib/type';
import { CALL, CALL_LOCAL, FPS, SCENES, TWIST_LOCAL, vWord, type Caption } from '../timing';
import { VOICE } from '../voice.generated';
import { CallCaptions, exitLength, type CallCaption } from './call/CallCaptions';
import { callGlow, KeyLight, MidnightVignette, RoomBox } from './call/Light';
import { Digits, OrbStage, relightGlow, type OrbState } from './call/Lockup';
import { ACCENT, AVA_INK, CALLER_INK, EMERALD_GLOW, EmeraldMesh } from './call/Mesh';
import { framingAt, framings, orbBase, swayAt } from './call/shots';
import { ClosedSign, flightAt, PickupLine } from './call/Status';
import { MarkRow, TurnLabel, type Turn } from './call/Transcript';
import { lightAt, listenAt, onsets, ORB_FRAME0, orbVolumeByIndex, volumeAt } from './call/voice';
import { Waveform } from './call/Waveform';

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
const C4_HAS_OH = C4_OH !== undefined;
const CAPTIONS: readonly (readonly CallCaption[])[] = LINES.map((l, i) => {
  if (i === 1 && C2_OH !== undefined && C2_UM !== undefined)
    return [{ text: 'Oh, hi! Um…', word: 0, map: [0, 0, 0], at: [C2_OH, null, C2_UM] }, ...l.captions.slice(1)];
  if (i === 3 && C4_HAS_OH) {
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

/**
 * KEY WORDS — the knowledge heading's two-tone: per line, per caption, the words set in the accent
 * ink (one accent in the scene). The names, the AI disclosure, the day and the times. The last line's
 * key phrase is the mark itself ("Wednesday at 3 PM", <MarkRow>), so its row A stays paper.
 */
const KEYS: readonly (readonly (readonly number[])[])[] = [
  [[4, 5], [4, 5], []], // Northside Studio. · AI assistant.
  [[], [5]], // Wednesday
  [[], [2, 3, 5], []], // 3 PM · 4:30.
  [C4_HAS_OH ? [1, 2] : [0, 1]], // three o'clock
  [[], []], // (row A paper: the key phrase is the mark)
];

/** Ava's talk swell on the orb — her level plus her syllables (eases in after the pickup, so t 0 is exact) */
const talkSwell = (tt: number) =>
  1 +
  (0.022 * Math.max(0, (volumeAt(tt) - 0.12) / 0.7) * (0.7 + 0.3 * Math.sin((tt / 48) * Math.PI * 2)) + 0.045 * lightAt(tt)) *
    tween(tt, [0, 6], [0, 1], EASE.house);

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
/** the hits' light: the pickup's flash and the gulp's (the orb flares, its light floods the room) */
const pickupFlash = (tt: number) => (tt < 0 ? 0 : 0.5 * Math.exp(-tt / 5));
const gulpFlash = (tt: number) => (tt < CALL_LOCAL.swallow ? 0 : 0.42 * Math.exp(-(tt - CALL_LOCAL.swallow) / 4));

/* the twist's phone screen at the end of its dive (twist/geometry.ts:
 * phone 260×540, bezel 9 → screen 242×522, scaled S about the avatar) */
const TWIST_SCREEN = { w: 242, h: 522 };

/** the caller's lines (their waveform draws out under the orb) */
const CALLER_LINES = LINES.flatMap((l, i) => (l.who === 'caller' ? [i] : []));
/** the waveform opens on a soft spring, and is drawn back in over this many frames */
const LINE_OPEN = { stiffness: 150, damping: 20, mass: 1 };
const LINE_CLOSE = 8;

/** the orb turns emerald just after the pickup, under its flash (the room follows it); the hue turns
 *  in the dark — call/Lockup.tsx relight: never through a third light */
const EMERALD: readonly [number, number] = [0, 8];
/** the room lights up out of the orb */
const MESH_OPEN: readonly [number, number] = [4, 50];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const Call: React.FC = () => {
  const t = useSceneFrame('call');
  const L = useLayout();
  const T = TRANSCRIPT(L);
  const M = MARK(L);
  const Fr = framings(L);
  const B = orbBase(L);
  const g0 = SCENES.call.from;
  const END = CALL_LOCAL.markHide;
  const capFont = useMemo(() => captionFont(L.vertical, 'night'), [L.vertical]);
  if (t < CALL_LOCAL.roomIn[0]) return null;

  /* ── the orb, on screen ─────────────────────────────────────────── */
  const [i0, i1] = CALL_LOCAL.blowInhale;
  const [v0, v1] = CALL_LOCAL.orbDive;
  // where the mark takes the orb: just above the middle of "Wednesday at 3 PM", a little smaller than its x-height
  const take = { x: M.x, y: M.y - 0.06 * M.fontSize, d: 0.45 * M.fontSize };
  const orbAt = (tt: number): OrbState => {
    const f = framingAt(tt, L);
    const s = { x: f.x, y: f.y, d: f.d * pickupScale(tt + g0) * (1 + 0.05 * gulpKick(tt)) * talkSwell(tt) };
    if (tt < i0) return s;
    // the inhale: the orb swells 5 % and draws back 8 px (away from the mark) — the dive's anticipation
    const inh = EASE.inOut(clamp01((tt - i0) / (i1 - i0)));
    const s1 = { x: s.x, y: s.y - 8 * inh, d: s.d * (1 + 0.05 * inh) };
    if (tt <= v0) return s1;
    // the dive: power2.in on its travel (fastest on contact); it keeps its size until it is well on its way,
    // then shrinks into the mark (log size on travel^1.5) — it is pulled IN, it does not recede
    const e = EASE.in2(clamp01((tt - v0) / (v1 - v0)));
    return { x: s1.x + (take.x - s1.x) * e, y: s1.y + (take.y - s1.y) * e, d: s1.d * Math.pow(take.d / s1.d, Math.pow(e, 1.5)) };
  };
  /** the orb is absorbed as it touches the mark: whole until the frame before contact, gone just after */
  const fadeAt = (tt: number) => 1 - EASE.in2(clamp01((tt - (v1 - 1)) / 1.5));

  /* ── the room: the phone screen pulls back into the whole stage, and lights up green from the orb ── */
  const S0 = L.pick((L.width / TWIST_SCREEN.w) * 1.1, (L.width / TWIST_SCREEN.w) * 1.12);
  const open = tween(t, CALL_LOCAL.roomOpen, [0, 1], EASE.inOut);
  const box0 = { w: TWIST_SCREEN.w * S0, h: TWIST_SCREEN.h * S0 };
  const box1 = { w: L.width * 1.2, h: L.height * 1.2 };
  const room = { w: box0.w * Math.pow(box1.w / box0.w, open), h: box0.h * Math.pow(box1.h / box0.h, open) };
  const roomOp = tween(t, CALL_LOCAL.roomIn, [0, 1], EASE.inOut);
  // the phone's indigo grades down into the midnight (the twist follows the same curve on its screen)
  const grade = tween(t, CALL_LOCAL.roomGrade, [0, 1], EASE.inOut);
  // the twist hands over with its room already under the MidnightVignette (TWIST_LOCAL.roomVignette)
  const vignetteK = Math.max(TWIST_LOCAL.roomVignette, grade);
  const meshOpen = tween(t, MESH_OPEN, [0, 1], EASE.out3);
  const emerald = tween(t, EMERALD, [0, 1], EASE.inOut);

  /* ── the voice ───────────────────────────────────────────────────── */
  const vol = volumeAt(t) + gulpLevel(t);
  const lvl = Math.max(0, (vol - 0.12) / 0.7);
  const light = lightAt(t);
  const listen = listenAt(t);
  const orb = orbAt(Math.min(t, END - 0.001));
  const orbFade = t >= END ? 0 : fadeAt(t);
  // the room's light goes with its source — but over the ignition (≈ 4 f), as it passes into the mark's
  // glow, not in the 1.5 f the orb takes to vanish
  const roomSource = t >= END ? 0 : 1 - EASE.inOut(clamp01((t - (v1 - 1.5)) / 4));
  const hitFlash = pickupFlash(t) + gulpFlash(t);

  const mesh = (reveal: number) => (
    <EmeraldMesh
      t={t}
      L={L}
      orb={orb}
      level={(lvl + 0.6 * light) * tween(t, [0, 12], [0, 1], EASE.house)}
      listen={listen}
      reveal={reveal}
      flash={0.5 * hitFlash}
      source={roomSource}
    />
  );
  if (t >= END) {
    // the room alone after the hand-over (under the result, until its own room is in)
    return <AbsoluteFill style={{ overflow: 'hidden' }}>{mesh(1)}</AbsoluteFill>;
  }

  // the fluid runs a little quicker once the call is live, and quicker still on her syllables
  // (flow input only — the shader's own volume stays the site's); 0 at the pickup, so the cut is exact
  const flowBoost = (tt: number) => tween(tt, [0, 30], [0, 1], EASE.inOut) * (0.3 + 0.7 * lightAt(tt));
  const flow = flowTime(Math.max(0, t + ORB_FRAME0), (fr) => {
    const tt = fr - ORB_FRAME0;
    return orbVolumeByIndex(fr) + gulpLevel(tt) + flowBoost(tt);
  });
  const dress = tween(t, [0, 12], [0, 1], EASE.house);
  const rim = pickupGlow(t + g0) + (0.2 * lvl + 0.3 * light) * dress;
  // the midnight's own key light (the twist's), until the emerald room has opened over it
  const keyK = (dress * (0.16 + 0.1 * lvl + 0.18 * light) + 0.6 * hitFlash) * (1 - meshOpen);

  /* ── establishing: CLOSED, the big line, the figures ───────────── */
  const F = L.pick(170, 150);
  const flight = (tt: number) =>
    flightAt(tt, { x0: L.cx, y0: T.y, y1: Fr.lock.y, band: 0.62 * F, s1: L.pick(0.1, 0.12), lift: CALL_LOCAL.lift, dive: CALL_LOCAL.dive });

  /* ── the speaker label: one per turn, centred over row A ─────── */
  const rowH = capFont.size * capFont.lineHeight;
  const labelY = T.y - rowH / 2 - Math.round(capFont.size * 0.34) - typeSize('label', L.vertical) * 0.6;
  // (the old name has all but left — up through its mask — as the new one starts to rise)
  const turns: Turn[] = LINES.map((l, i) => ({ who: l.who, at: l.at, out: i + 1 < LINES.length ? LINES[i + 1].at - 5 : CALL_LOCAL.rowOut - 1 }));

  /* ── captions ─────────────────────────────────────────────────────── */
  const holdOf = (i: number) => (i + 1 < LINES.length ? LINES[i + 1].at + 1 : CALL_LOCAL.rowOut + exitLength(ROW_A.text.split(' ').length));

  /* ── the caller's line (their real voice, under the calm orb) ──── */
  const wave = (() => {
    for (let j = 0; j < CALLER_LINES.length; j++) {
      const o = CALL_LOCAL.lineOpen[j];
      const c = CALL_LOCAL.lineClose[j] ?? Infinity;
      if (t >= o - 1 && t < c + LINE_CLOSE) {
        return {
          i: CALLER_LINES[j],
          open: springUnit(t - (o - 1), LINE_OPEN),
          close: EASE.in2(clamp01((t - c) / LINE_CLOSE)),
        };
      }
    }
    return null;
  })();
  const W = L.pick({ cy: 628, half: 300, maxH: 22 }, { cy: 1012, half: 270, maxH: 26 });

  /* ── the payoff: row B, the booked mark ───────────────────────────── */
  const last = LINES[4];
  const bm = CALL.bookedMark;
  const markAppear = [
    last.at + vWord(last.voice, 4) - 2,
    last.at + vWord(last.voice, 5) - 2,
    bm - 2,
    last.at + vWord(last.voice, 7) - 2,
  ] as const;
  // the mark holds the call's mint until the orb goes into it: on the contact the ember ignites out
  // of the point it went in (a quick front, all ember by markHide − .5) and its glow comes up with it
  // to exactly the hand-over strength (+ the take's flare) — the scene's only ember, its last ~4 frames
  const IGNITE: readonly [number, number] = [v1 - 1, END - 0.5];
  const ignite = tween(t, IGNITE, [0, 1], EASE.out3);
  // the take's flare (the mark kicks 1.5 %, its ember and glow run hot): a smooth bump from markTake that
  // is exactly 0 again by markHide − 1 — no jump on the take, none at the hand-over
  const took = (() => {
    const u = (t - CALL_LOCAL.markTake) / (END - 1 - CALL_LOCAL.markTake);
    return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2;
  })();
  const glowK = ignite * (MARK_GLOW_HANDOFF + 0.4 * took);
  // the payoff beat: a soft press 1 → .98 (3 f), released on a spring — exactly 1 before the hand-over
  const P = CALL_LOCAL.payoff;
  const pulse =
    t < P || t >= END - 1
      ? 1
      : (t < P + 3 ? 1 - 0.02 * tween(t, [P, P + 3], [0, 1], EASE.in2) : 0.98 + 0.02 * springUnit(t - (P + 3), SPRING.pop)) + 0.015 * took;
  // the period of "3 PM." leaves with row A, as its last word
  const periodOut = CALL_LOCAL.rowOut + 1.8;

  const orbNow = orb;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── the room: the twist's midnight (one group over roomIn), then the emerald mesh opening from the orb ── */}
      {meshOpen < 1 ? (
        <AbsoluteFill style={{ opacity: roomOp < 1 ? roomOp : undefined }}>
          <RoomBox x={L.cx} y={L.cy} w={room.w} h={room.h} grade={grade} />
          {t >= 0 ? (
            <KeyLight x={orbNow.x} y={orbNow.y} d={orbNow.d} glow={relightGlow(callGlow(0), EMERALD_GLOW, emerald)} strength={keyK} spread={L.pick(3.2, 2.6)} />
          ) : null}
          <MidnightVignette k={vignetteK} />
        </AbsoluteFill>
      ) : null}
      {mesh(meshOpen)}

      {/* ── behind the orb: the big line diving in, the figures, the caller's line ── */}
      {t <= CALL_LOCAL.swallow ? (
        <PickupLine t={t} text="Picked up on the first ring." vertical={L.vertical} boxW={L.pick(1500, 940)} flight={flight} keyAt={CALL_LOCAL.lineGlint} />
      ) : null}
      <Digits
        t={t}
        x={orbNow.x}
        y={orbNow.y}
        orbD={Math.min(orbNow.d, Fr.lock.d * 1.08)}
        F={F}
        gap={L.pick(34, 28)}
        unfoldStart={CALL_LOCAL.unfold}
        foldStart={CALL_LOCAL.peel[1]}
        sheens={[
          tween(t, [CALL_LOCAL.unfold + 6, CALL_LOCAL.unfold + 22], [0, 1], EASE.inOut),
          tween(t, [CALL_LOCAL.unfold + 10, CALL_LOCAL.unfold + 26], [0, 1], EASE.inOut),
        ]}
      />
      {wave ? (
        <Waveform
          t={t}
          at={LINES[wave.i].at}
          voice={LINES[wave.i].voice}
          cx={L.cx}
          cy={W.cy}
          half={W.half}
          barW={4}
          pitch={11}
          maxH={W.maxH}
          color={CALLER_INK}
          open={wave.open}
          close={wave.close}
        />
      ) : null}

      {/* ── Ava's orb: centred, swaying, the room's key light ── */}
      <OrbStage
        t={t}
        base={B}
        orb={orbNow}
        volume={vol}
        flow={flow}
        listen={listen}
        emerald={emerald}
        rim={rim}
        dress={dress}
        ringStarts={[CALL_LOCAL.rings[0]]}
        light={light}
        rimIn={roomOp}
        flash={hitFlash}
        grade={dress}
        fade={orbFade}
        tilt={swayAt(t)}
      />

      {/* ── the door sign ── */}
      <ClosedSign t={t} cx={L.cx} cy={L.pick(168, 476)} vertical={L.vertical} start={CALL_LOCAL.statusIn} exit={CALL_LOCAL.peel[0]} />

      {/* ── the transcript: who speaks, what they say ── */}
      <TurnLabel t={t} turns={turns} x={L.cx} y={labelY} vertical={L.vertical} />
      {LINES.map((line, i) => {
        if (t < line.at - 4 || t > holdOf(i) + 12) return null;
        const agent = line.who === 'agent';
        const keys = KEYS[i];
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
            font={capFont}
            color={agent ? AVA_INK : CALLER_INK}
            holdUntil={holdOf(i)}
            keys={(c, j) => (keys[c]?.includes(j) ? ACCENT : null)}
            hold
          />
        );
      })}

      {/* ── the booked mark + its glow (the glow only from the take; handed to the result at markHide) ── */}
      <MarkGlow x={M.x} y={M.y} fontSize={M.fontSize} k={glowK} />
      <MarkRow
        t={t}
        appear={markAppear}
        ink={ACCENT}
        ignite={ignite}
        igniteAt={[50, 50 - (100 * 0.06) / MARK_TYPE.lineHeight]}
        pulse={pulse}
        periodOut={periodOut}
        flare={took}
        x={M.x}
        y={M.y}
        fontSize={M.fontSize}
      />
    </AbsoluteFill>
  );
};
