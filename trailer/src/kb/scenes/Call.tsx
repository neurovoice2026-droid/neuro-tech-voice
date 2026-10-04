/**
 * PART III · b09–b11 · THE CALL (SCRIPT.md b09–b11; CLIENT DIRECTION v2) — a live call, the stop-time between question
 * and answer, and the answer.
 *
 *   0 (bar)    the line rings: one slate hairline leaves Ava's orb; b08's app panel steps back a depth (.9, shade .06)
 *              and slides away (16:9 right; 9:16 down, receded under the call); the eyebrow leaves; the orb comes
 *              forward to her call place
 *   pickup     picked up on the first ring (an 8th): she wakes to listen; ● CALLER and the mono call timer (00:04 —
 *              the greeting has been said) rise; the caller's line rises on his first word over the line's waveform
 *   filler     her own turn (● AVA, sunday) rises under his, the transcript scrolling up: "One moment, let me check."
 *              — the product's real filler — and the orb speaks
 *   FREEZE     the call stops: the timer holds at 00:07, the waveform keeps its shape, the mesh's own clock comes to
 *              a standstill and its colour eases down a touch; BETWEEN QUESTION AND ANSWER rises and the orb shrinks
 *              into its dot; the camera glides to the knowledge — the frozen question to the left column, stepping back
 *              a touch (9:16 the top), the Opening hours row back (from where the panel went: 16:9 the right edge,
 *              9:16 the bottom edge), unfolding into the full page cropped to its content (its name growing into the
 *              page's heading, its lines at the title role)
 *   vo-5       "the part that answers them": the sunday sweep under Saturday and Sunday; the weekday line to 40 %
 *              "even when they put it differently": "around this weekend" underlined, the hero hairline from
 *              "weekend" to the swept lines with MATCHED ON MEANING; the day's three earlier questions roll through one
 *              masked slot on 8ths, each sending its own hairline to the same lines
 *   RESUME     (bar) the hairlines retract into the page just before it; then time runs again: the label, the
 *              phrasing and the frozen question leave; the orb comes out of the dot; ● AVA + the timer. THE RE-SET, one
 *              move: the tokens she doesn't say leave the page up through their masks; on "We" the kept words fly from
 *              the page together into their slots in her sentence; on her onsets her own words rise in ("nine till
 *              two" keyed sunday); the page dims to 25 %
 *   record     the strip folds into the white record row over her finished sentence (held ≥ a beat): TRANSCRIPT · the
 *              greeting (its AI disclosure) · Answered from your documents + Opening hours · the check in the sunday
 *              disc; the dim page recedes out
 *
 * No cursor: nobody is at the dashboard — the call is answered by Ava alone (the cursor returns in b12).
 * Every time is CALL_LOCAL (src/kb/timing.ts, from the real voices' word onsets); the layout and the poses are
 * scenes/call/stage.ts; the cut from b08 takes writtenEnd(), the cut into b12 hands over callEnd().
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useLayout } from '../../lib/layout';
import { subpixel } from '../../lib/glide';
import { EASE, SPRING, springUnit, tween } from '../../lib/motion';
import { Captions } from '../components/Captions';
import { meshShadowInk } from '../kit';
import { HOME, KB_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { KB_INK } from '../theme';
import { CALL_LOCAL as C, type Caption } from '../timing';
import { AnswerTurn } from './call/Answer';
import { CallGround } from './call/Ground';
import { Links, Phrasings, StopLabel, stopLockup } from './call/Meaning';
import { CallOrb } from './call/Orb';
import { OpeningHoursPage, sweptBlock, usePage } from './call/Page';
import { HandoffEyebrow, HandoffPanel } from './call/Panel';
import { callerTurnPose, callStage, ease, orbPose, turnPoint } from './call/stage';
import { CallWave, Lines, Tag, wordBox } from './call/Strip';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
const CALLER = KB_INK.caller.paper;
const INK = meshShadowInk(KB_MESH);
/** the narrator's line over the stop-time (no tag); the key "the part that answers them" from "the" */
const VO5_CAPTIONS: readonly Caption[] = [
  { text: 'When someone calls,', word: 0 },
  { text: 'I find the part that answers them,', word: 3 },
  { text: 'even when they put it differently.', word: 10 },
];

export const Call: React.FC = () => {
  const L = useLayout();
  const v = L.vertical;
  const t = useKbSceneFrame('call');
  const S = callStage(v);
  const g = usePage(S);
  const lk = stopLockup(S, v);
  const orb = orbPose(t, S, lk.dot);
  const turn = callerTurnPose(t, S);
  const size = S.strip.caption;
  // the stop-time's hold (0 → 1 → 0): the frozen strip's colour veil
  const held = ease(t, C.freeze, C.freeze + 12) * (1 - ease(t, C.resume, C.resume + 8));
  // the hairlines: the hero from the end of the underline under "weekend" (the frozen turn at B, stepped back); all
  // land on the swept lines' edge
  // (16:9 from the end of "weekend"; 9:16 from the start of "this weekend", whose link runs down the left margin)
  const B = S.strip.b;
  const wk = wordBox(S.strip.callerLines, size, B.x, B.lines, S.strip.align, v ? 4 : 5, '?');
  const hero = turnPoint({ x: B.x, tag: B.tag, scale: S.strip.bScale }, v ? { x: wk.x - 2, y: wk.y + size * 1.1 } : { x: wk.x + wk.w + 2, y: wk.y + size * 1.1 });
  const sb = sweptBlock(g);
  const target = { x: sb.left - 14, y: sb.cy };
  const keyK = tween(t, [C.sweep, C.sweep + 12], [0, 1], EASE.inOut);
  const waveOpen = springUnit(t - (C.c4 - 2), SPRING.site);
  const waveClose = tween(t, [C.resume, C.resume + 9], [0, 1], EASE.in3);
  const wave = S.strip.wave;
  const waveCx = S.strip.align === 'center' ? turn.x : turn.x + wave.half - wave.pitch * 0.5;
  const veilInk = '#86849a';
  // the caller's turn steps back (B: × bScale about its tag's top-left) as the camera glides to the knowledge
  const turnTf = turn.scale !== 1 ? `scale(${turn.scale.toFixed(5)})` : undefined;
  return (
    <AbsoluteFill>
      <CallGround t={t} S={S} orb={orb} />
      <HandoffPanel t={t} S={S} ink={INK} hideHours={t >= C.rowIn[0]} />
      <HandoffEyebrow t={t} S={S} />
      <OpeningHoursPage t={t} S={S} g={g} ink={INK} />
      <Links t={t} S={S} hero={hero} target={target} page={{ x: g.card.x, y: g.card.y }} />
      <Phrasings t={t} S={S} />
      {/* the caller's turn: ● CALLER + the timer, his line, the line's waveform (frozen in the stop-time) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, transformOrigin: `${turn.x.toFixed(3)}px ${turn.tag.toFixed(3)}px`, ...subpixel(turnTf, turn.moving) }}>
      <Tag t={t} x={turn.x} y={turn.tag} align={S.strip.align} name="CALLER" ink={CALLER.tag} at={C.strip} exitAt={C.resume} timer timerHold={C.resume - 1} veil={0.5 * held} veilInk={veilInk} moving={turn.moving} />
      <Lines
        t={t}
        lines={S.strip.callerLines}
        size={size}
        x={turn.x}
        tops={turn.lines}
        align={S.strip.align}
        color={CALLER.text}
        at={C.c4Words[0] - 1}
        exitAt={C.resume}
        veil={0.35 * held}
        veilInk={veilInk}
        moving={turn.moving}
        underline={{ from: 3, to: 5, at: C.underline, dur: 9, color: CALLER.tag, trimEnd: '?' }}
      />
      <CallWave
        t={t}
        at={C.c4}
        voice="kb2-c4"
        cx={waveCx}
        cy={turn.wave ?? 0}
        half={wave.half}
        barW={wave.bar}
        pitch={wave.pitch}
        maxH={wave.maxH}
        color={held > 0.001 ? veilInk : CALLER.tag}
        open={waveOpen}
        close={waveClose}
        freezeAt={C.freeze}
        resumeAt={C.resume}
        quiet={C.c4Words[0] - C.c4 - 2}
      />
      </div>
      {/* her filler, as her own turn under his */}
      <Tag t={t} x={S.strip.filler.x} y={S.strip.filler.tag} align={S.strip.align} name="AVA" ink={SUNDAY} at={C.call1 - 2} exitAt={C.freeze - 4} />
      <Lines t={t} lines={S.strip.fillerLines} size={size} x={S.strip.filler.x} tops={S.strip.filler.lines} align={S.strip.align} color={HOME.ink} at={C.call1Words[0] - 1} exitAt={C.freeze - 3} />
      <AnswerTurn t={t} S={S} g={g} ink={INK} />
      <CallOrb t={t} S={S} pose={orb} />
      <StopLabel t={t} S={S} />
      <Captions
        t={t}
        lineAt={C.vo5}
        voice="kb2-vo-5"
        captions={VO5_CAPTIONS}
        x={S.caption.x}
        y={S.caption.y}
        maxWidth={S.caption.maxWidth}
        tone="paper"
        holdUntil={C.resume - 3}
        echoY={null}
        tint={(c, j) => (c === 1 && j >= 2 && j <= 5 ? { color: SUNDAY, k: keyK } : null)}
      />
    </AbsoluteFill>
  );
};
