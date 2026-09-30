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
 *   A / C    shot / reverse-shot, hard cuts ON each line: Ava = the big orb
 *            driven by her real envelope; the caller = the orb small in the
 *            listen palette + the phone line; live captions, word-synced;
 *            AI-disclosure underline; slot chips pop on the spoken times,
 *            15:00 is picked on "o'clock"
 *   line 5   "You're booked for / Wednesday at 15:00." — 15:00 ignites ember
 *            ON the spoken "three"; the payoff press; then everything but the
 *            mark and its glow blows away towards the lens; the result picks
 *            the mark up at markHide.
 *
 * Parallax (camera planes): room + orb light 0.3 · big dim discs 0.5 ·
 * orb, waveform, establishing type 1.0 · dust 1.3 · lens bokeh 1.6.
 * Captions, tags, chips and the mark are in screen space.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Captions, type CaptionFont } from '../components/Captions';
import { Dust } from '../components/Dust';
import { Vignette } from '../components/Grain';
import { flowTime } from '../components/Orb';
import { MarkGlow } from '../components/Shared';
import { MARK, MARK_GLOW_HANDOFF, TRANSCRIPT } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, springAt, tween } from '../lib/motion';
import { pickupGlow, pickupScale } from '../lib/pickup';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, NIGHT_ROOM } from '../theme';
import { CALL, CALL_LOCAL, SCENES, vWord, type Caption } from '../timing';
import { Bokeh, type Disc } from './call/Bokeh';
import { Digits, OrbStage, type OrbState } from './call/Lockup';
import { camAt, framingAt, framings, orbBase, orbToScreen, planeCss, shotAt } from './call/shots';
import { ClosedSign, flightAt, PickupLine } from './call/Status';
import { Chips, MarkRow, SpeakerTag } from './call/Transcript';
import { lightAt, listenAt, ORB_FRAME0, orbVolumeByIndex, turnAt, volumeAt } from './call/voice';
import { Waveform } from './call/Waveform';

const LINES = CALL.lines;
const ROW_A: Caption = { text: "You're booked for", word: 1 };

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

/** the chips are on screen during lines 2 and 3 (no echo slot then: it is theirs) */
const chipsLine = (i: number) => i === 2 || i === 3;

export const Call: React.FC = () => {
  const t = useSceneFrame('call');
  const L = useLayout();
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

  /* ── blow-away: everything but the mark and its glow (the room stays) ── */
  const bw = tween(t, CALL_LOCAL.blowAway, [0, 1], EASE.in2);
  const blow: React.CSSProperties =
    bw > 0
      ? {
          transform: `scale(${(1 + 0.12 * bw).toFixed(5)})`,
          transformOrigin: `${M.x}px ${M.y}px`,
          opacity: 1 - bw,
          filter: `blur(${(12 * bw).toFixed(2)}px)`,
        }
      : {};

  /* the room alone after the hand-over (under the result, until its own room is in) */
  const roomLayer = (
    <AbsoluteFill style={{ ...planeCss(cam, 0.3), opacity: roomOp }}>
      <div
        style={{
          position: 'absolute',
          left: L.cx - room.w / 2,
          top: L.cy - room.h / 2,
          width: room.w,
          height: room.h,
          background: NIGHT_ROOM,
        }}
      />
    </AbsoluteFill>
  );
  if (t >= END) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {roomLayer}
        <Vignette strength={0.55 * open} color="8,6,28" />
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
  const orbAt = (tt: number): OrbState => {
    const s = orbToScreen(camAt(tt, L), framingAt(tt, L));
    return { ...s, d: s.d * pickupScale(tt + g0) * (1 + 0.05 * gulpKick(tt)) * talkSwell(tt) };
  };
  const orb = orbAt(t);
  const dress = tween(t, [0, 12], [0, 1], EASE.house);
  const rim = pickupGlow(t + g0) + (0.2 * lvl + 0.3 * light) * tween(t, [0, 12], [0, 1], EASE.house);
  const dof = shot.kind === 'C' ? 2 : 0;

  /* ── establishing: the lockup, CLOSED, the big line ─────────────── */
  const F = L.pick(170, 150);
  const [p0] = CALL_LOCAL.pushIn;
  const unfoldAt = (tt: number) => aos(tt, CALL_LOCAL.unfold, { anticip: 4, depth: 0.06, config: SPRING.site });
  const unfold = unfoldAt(t);
  const unfoldSpeed = unfoldAt(t + 0.5) - unfoldAt(t - 0.5);
  const peelAt = (tt: number, a: number) => tween(tt, [a, a + 10], [0, 1], EASE.in2);
  const digitPeel = peelAt(t, p0);
  const signPeel = peelAt(t, p0 - 2);
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

  /* ── the caller's phone line (reverse shots) ────────────────────── */
  const W = L.pick({ x0: 600, x1: 1840, cy: 360, bars: 64, maxH: 120 }, { x0: 60, x1: 1020, cy: 780, bars: 44, maxH: 130 });

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
  const holdOf = (i: number) =>
    i + 1 < LINES.length ? LINES[i + 1].at + vWord(LINES[i + 1].voice, 0) : END + 10;
  const turn = turnAt(t);

  // the AI disclosure: an electric underline drawn under "an AI assistant" as she says it
  const [d0, d1] = CALL_LOCAL.disclose;
  const dP = EASE.draw(tween(t, [d0, d1], [0, 1], (x) => x));
  const dGlow = tween(t, [d0, d0 + 3], [0, 1], EASE.out3) * (1 - tween(t, [d1, d1 + 10], [0, 1], EASE.inOut));
  const thick = Math.round(T.fontSize * 0.065);

  // "15:00" / "16:30" flash lilac as they are spoken (linking the words to their chips)
  const pops = [LINES[2].at + CALL.slotPops[0], LINES[2].at + CALL.slotPops[1]] as const;
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
          : MARK_GLOW_HANDOFF;
  // the payoff beat: press 1 → .975 (3 f, power2.in), spring back — exactly 1 before the hand-over
  const P = CALL_LOCAL.payoff;
  const pulse =
    t < P || t >= END - 1
      ? 1
      : t < P + 3
        ? 1 - 0.025 * tween(t, [P, P + 3], [0, 1], EASE.in2)
        : 0.975 + 0.025 * springAt(t, P + 3, SPRING.pop);
  const periodOut = tween(t, [END - 9, END - 1], [0, 1], EASE.in2);

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
  const discsNear: Disc[] = L.pick(
    [
      { x: 110, y: 190, r: 110, a: 0.1, soft: 30, seed: 'n1' },
      { x: 1840, y: 610, r: 150, a: 0.09, soft: 40, seed: 'n2' },
      { x: 1700, y: 1010, r: 90, a: 0.12, soft: 24, seed: 'n3' },
      { x: 220, y: 1020, r: 130, a: 0.08, soft: 34, seed: 'n4' },
      { x: 1270, y: 40, r: 70, a: 0.11, soft: 24, seed: 'n5' },
    ],
    [
      { x: 30, y: 250, r: 120, a: 0.1, soft: 30, seed: 'n1' },
      { x: 1070, y: 900, r: 150, a: 0.09, soft: 40, seed: 'n2' },
      { x: 50, y: 1710, r: 140, a: 0.08, soft: 34, seed: 'n3' },
      { x: 1010, y: 1850, r: 100, a: 0.12, soft: 24, seed: 'n4' },
      { x: 880, y: 90, r: 80, a: 0.11, soft: 24, seed: 'n5' },
    ],
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── 0.3 · the room + the orb's light on it ─────────────────── */}
      {roomLayer}
      {live ? (
        <AbsoluteFill style={{ ...planeCss(cam, 0.3), opacity: dress * (1 - bw) }}>
          <div
            style={{
              position: 'absolute',
              left: orb.x - L.pick(1000, 900),
              top: orb.y - L.pick(760, 900),
              width: L.pick(2000, 1800),
              height: L.pick(1520, 1800),
              background: `radial-gradient(closest-side, rgba(124,58,237,${(0.08 + 0.1 * lvl + 0.36 * light).toFixed(3)}), rgba(124,58,237,0) 100%)`,
            }}
          />
        </AbsoluteFill>
      ) : null}
      <Vignette strength={0.55 * open} color="8,6,28" />

      <AbsoluteFill style={blow}>
        {/* ── 0.5 · large dim discs, far behind ──────────────────────── */}
        {live ? (
          <AbsoluteFill style={{ ...planeCss(cam, 0.5), opacity: dress }}>
            <Bokeh t={t} discs={discsFar} drift={2.2} />
          </AbsoluteFill>
        ) : null}

        {/* ── 1.0 · the establishing type: the big line dives BEHIND the lockup, into the orb ── */}
        {live && t < p0 + 12 ? (
          <AbsoluteFill style={planeCss(cam, 1)}>
            {t <= CALL_LOCAL.swallow ? (
              <PickupLine t={t} text="Picked up on the first ring." fontSize={L.pick(96, 92)} boxW={L.pick(1500, 940)} flight={flight} />
            ) : null}
            <ClosedSign
              t={t}
              cx={L.cx}
              cy={L.pick(150, 330)}
              start={CALL_LOCAL.statusIn}
              fontSize={L.pick(32, 30)}
              peel={signPeel}
              peelSpeed={peelAt(t + 0.5, p0 - 2) - peelAt(t - 0.5, p0 - 2)}
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
              peelSpeed={peelAt(t + 0.5, p0) - peelAt(t - 0.5, p0)}
              sheens={[
                tween(t, [CALL_LOCAL.unfold + 6, CALL_LOCAL.unfold + 22], [0, 1], EASE.inOut),
                tween(t, [CALL_LOCAL.unfold + 10, CALL_LOCAL.unfold + 26], [0, 1], EASE.inOut),
              ]}
            />
          </AbsoluteFill>
        ) : null}

        {/* ── 1.0 · the caller's phone line (reverse shots) ─────────── */}
        {shot.kind === 'C' ? (
          <AbsoluteFill style={planeCss(cam, 1)}>
            <Waveform
              t={t}
              at={LINES[shot.line].at}
              voice={LINES[shot.line].voice}
              x0={W.x0}
              x1={W.x1}
              cy={W.cy}
              bars={W.bars}
              barW={8}
              maxH={W.maxH}
              opacity={1}
            />
          </AbsoluteFill>
        ) : null}

        {/* ── 1.0 · Ava's orb (screen coordinates from the camera) ──── */}
        <OrbStage
          t={t}
          base={B}
          orb={orb}
          orbAt={orbAt}
          volume={vol}
          flow={flow}
          listen={listenAt(t)}
          rim={rim}
          dress={dress}
          dof={dof}
          ringStarts={CALL_LOCAL.rings}
          phraseRings={PHRASE_RINGS}
          light={light}
          gulp={CALL_LOCAL.swallow}
          rimIn={roomOp}
        />

        {live ? (
          <>
            {/* ── 1.3 · motes ─────────────────────────────────────────── */}
            <AbsoluteFill style={{ ...planeCss(cam, 1.3), opacity: dress }}>
              <Dust count={22} seed="call-motes" color="185,163,255" opacity={0.45} size={[2, 7]} blur={[0.4, 3]} speed={0.45} frame={t + 600} />
            </AbsoluteFill>
            {/* ── 1.6 · lens bokeh ───────────────────────────────────── */}
            <AbsoluteFill style={{ ...planeCss(cam, 1.6), opacity: dress }}>
              <Bokeh t={t} discs={discsNear} />
            </AbsoluteFill>

            {/* ── screen · speaker tag, captions, chips ──────────────── */}
            {turn >= 0 ? (
              <SpeakerTag
                key={turn}
                t={t}
                who={LINES[turn].who}
                at={LINES[turn].at}
                x={L.cx}
                y={T.y - L.pick(78, 72)}
                fontSize={L.pick(32, 30)}
                dot={22}
              />
            ) : null}
            {LINES.map((line, i) => {
              if (t < line.at - 4 || t > holdOf(i) + 12) return null;
              const agent = line.who === 'agent';
              return (
                <Captions
                  key={i}
                  t={t}
                  lineAt={line.at}
                  voice={line.voice}
                  captions={i === 4 ? [line.captions[0], ROW_A] : line.captions}
                  x={L.cx}
                  y={T.y}
                  maxWidth={T.maxWidth}
                  font={agent ? avaFont : callerFont}
                  color={agent ? C.paper : C.callerLit}
                  glow={agent ? 'rgba(185,163,255,0.35)' : 'rgba(169,188,255,0.35)'}
                  holdUntil={holdOf(i)}
                  echoY={chipsLine(i) ? null : echoY}
                  underline={
                    i === 0
                      ? {
                          caption: 1,
                          words: [3, 5],
                          p: dP,
                          color: C.electric,
                          thickness: thick,
                          shadow: dGlow > 0.01 ? `0 0 10px rgba(124,58,237,${(0.6 * dGlow).toFixed(3)})` : undefined,
                        }
                      : undefined
                  }
                  tint={
                    i === 2
                      ? (c, j) => (c === 1 && (j === 2 || j === 4) ? { color: C.lilac, k: flash(pops[j === 2 ? 0 : 1]) } : null)
                      : undefined
                  }
                />
              );
            })}
            <Chips
              t={t}
              cx={L.cx}
              cy={T.y - L.pick(170, 160)}
              w={L.pick(260, 228)}
              h={L.pick(104, 92)}
              fontSize={L.pick(64, 56)}
              pops={pops}
              pick={CALL.slotPick}
              leave={last.at}
            />
          </>
        ) : null}
      </AbsoluteFill>

      {/* ── screen · the booked mark + its glow (handed to the result at markHide) ── */}
      {live ? (
        <>
          <MarkGlow x={M.x} y={M.y} fontSize={M.fontSize} k={glowK} />
          <MarkRow
            t={t}
            appear={markAppear}
            ember={ember}
            sheen={sheen}
            pulse={pulse}
            periodOut={periodOut}
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
