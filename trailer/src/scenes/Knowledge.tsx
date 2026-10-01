/**
 * KNOWLEDGE — the white act opens on the site's #knowledge reading room,
 * lit by #demo's SUNDAY: this second call comes in on a Sunday (the moment
 * tag says so), so the orb, its bloom and every live accent wear the Sunday
 * light — on the white stock, as LIGHT: a teal bloom round the hero orb and
 * a soft aqua tint pooled under it, never a wash; its `listen` twin while
 * the caller asks; sunday ink where the site sets violet. A second caller asks
 * what isn't written down; Ava searches the owner's documents and,
 * honestly, doesn't guess: the light drains on the miss, and floods back
 * when she answers. (knowledge-stage.tsx at film scale; every moment is
 * KNOWLEDGE / KNOWLEDGE_LOCAL in timing.ts, the voiced ones derived from
 * the real voice lengths.)
 *
 *   dawn        (pre-roll, over the result's last white frames) the white
 *               flash's ember centre gathers into a seed of Sunday light at
 *               the reader's place — the match cut on light
 *   t 0         the hit (hit-white + the Sunday chime): the seed blooms and
 *               the stage — the white room, bled to the frame edges —
 *               materialises out of it (1.035 → 1)
 *   heading     ON the hit "Answers from your own documents." pops up word
 *               by word where the orb will be; the eyebrow dot spins in,
 *               "KNOWLEDGE BASE" letters rise; the key phrase turns sunday ink
 *   docPops     five documents pop on 16ths: inhale, overshoot, a glint +
 *               ring, a camera kick each
 *   headingStep 16:9: the heading lifts, then steps down to the answer row
 *               (9:16 — one column — it holds full size and flicks up out of
 *               its masks just before the orb springs from its place)…
 *   orbIn       …and the orb springs out of a seed of light ON the beat
 *               (bloom flash, ring, kick); the pill pops "Listening" a 16th
 *               later, the moment tag "☀ SUNDAY · 10:24" an 8th later
 *   callerIn    the caller's first sound: CALLER pops, "Quick question,"
 *               (kb-1's lead-in) writes in; the heading flicks out; then
 *               "Do you do home visits?" word-synced; the orb listens (real
 *               envelope). Caller = Cormorant italic in caller blue.
 *   scan        AFTER the question: "Looking through 5 documents": beams
 *               draw into the orb (a spark where each lands), the tiles are
 *               read, the bars fill (none reaches the 60 % tick), the slot's
 *               page shimmers
 *   miss        "Not in the documents" (the pill shakes no): the orb and the
 *               room drain to a cool grey (the fluid, which churned through
 *               the search, settles), the beams fall back, the slot says
 *               "0 matches" — 9:16: the documents step back out of focus and
 *               the slot opens in front of them, in their place
 *   answer      Ava (kb-2) hums over it in grey; her Sunday light floods back
 *               on her first word; Ava = the call's Inter 500, word-synced,
 *               "guess." and "today." in sunday ink; the orb pushes in; two
 *               captions never share a frame (CaptionRun); 16:9: the
 *               documents step back
 *   ticketPop   "I'll ask the team": the slot pops into the team card (the
 *               question and the caller's number write in on her words);
 *               "call": the callback chip; "today.": its check
 *   closing     the stage recedes; "Where your documents stop, it says so."
 *               — "it says so." turns teal with a glint and a pool of light
 *   out         a 3 f counter-move, then the whip: the stage leaves with a
 *               directional blur ∝ speed; clean white from out[1] − 2
 *
 * Parallax: panel + room light 0.3 · eyebrow, pill, moment tag 0.7 · tiles,
 * beams, slot, orb, captions 1.0 · Sunday light discs 1.4.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { Camera, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { rgba } from '../lib/lights';
import { C, FONT, TRACK } from '../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../timing';
import { Beams } from './knowledge/Beams';
import { Captions } from '../components/Captions';
import { CaptionRun } from './knowledge/CaptionRun';
import type { Caption } from '../timing';
import { Closing, Heading } from './knowledge/Closing';
import { DirBlur, dirBlurRef, sigmaFor } from './knowledge/blur';
import { geo, INK, LISTEN_GLOW, SUN_GLOW, type Geo } from './knowledge/geometry';
import { missAt } from './knowledge/light';
import { useFontsReady } from './knowledge/measure';
import { Moment } from './knowledge/Moment';
import { Reader } from './knowledge/Reader';
import { Slot } from './knowledge/Slot';
import { Dawn, Discs, Eyebrow, Panel } from './knowledge/Stage';
import { Status } from './knowledge/Status';
import { Tiles } from './knowledge/Tiles';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** the caller's question — one caption, word-synced to kb-1 (its lead-in "Quick question," is KL.lead) */
const QUESTION = [{ text: 'Do you do home visits?', word: 0 }] as const;
/** Ava's answer: "I'll ask the team" + "to call you back today." read as ONE sentence — on one
 *  row (16:9) / stacked on two rows (9:16) — never an echo; both hold to the closing */
const CAPS = K.answerCaptions;
const contiguous = CAPS[3].word === CAPS[2].word + CAPS[2].text.split(' ').length;
const MERGED: Caption = { text: `${CAPS[2].text} ${CAPS[3].text}`, word: CAPS[2].word };
/** the spoken words that turn sunday ink as they are said */
const KEY_WORDS: Record<number, number> = { 12: KL.guessKey, 21: KL.check };
/** the spoken word's halo, on the light stock: the caller's light / Ava's Sunday light */
const GLOW_CALLER = rgba(LISTEN_GLOW.body, 0.2);
const GLOW_AVA = rgba(SUN_GLOW.body, 0.22);

const FONTS = [
  `500 32px ${FONT.body}`,
  `500 76px ${FONT.body}`,
  `500 30px ${FONT.mono}`,
  `italic 500 92px ${FONT.cinema}`,
  `460 104px ${FONT.ui}`,
];

/** a camera kick: 1 f attack, then e^(−u/4) */
const kick = (u: number) => (u < 0 ? 0 : u < 1 ? u : Math.exp(-(u - 1) / 4));

function camera(t: number, G: Geo, cx: number, cy: number) {
  const push = G.cam.push * tween(t, [0, K.closing], [0, 1], EASE.inOut);
  let k = 0;
  // 1–3 px kicks on the hits: the doc pops, the orb's landing, the miss, the relight, the key line
  for (const f of KL.docPops) k += G.cam.kickPop * kick(t - f);
  k += G.cam.kickMiss * kick(t - (KL.orbIn + 2));
  k += G.cam.kickMiss * kick(t - K.miss);
  k += G.cam.kickPop * kick(t - (KL.relight[0] + 2));
  k += G.cam.kickPop * 0.9 * kick(t - KL.ticketPop); // the team card: a ~2 px kick
  k += G.cam.kickPop * 0.45 * kick(t - KL.callback);
  k += G.cam.kickPop * 1.4 * kick(t - KL.closingKey);
  const zoom = 1 + push + k;
  // hand-held drift (reveals the planes), calmed for the closing
  const calm = 1 - tween(t, [K.closing - 10, K.closing + 10], [0, 0.7], EASE.inOut);
  const dx = (G.v ? 5 : 9) * noise2D('kb-cam-x', t * 0.012, 0.4) * calm;
  const dy = (G.v ? 3 : 6) * noise2D('kb-cam-y', 0.9, t * 0.012) * calm;
  // zoom about (ox, oy): for every plane the point stays put
  return {
    x: (G.cam.ox - cx) * (zoom - 1) + dx,
    y: (G.cam.oy - cy) * (zoom - 1) + dy,
    zoom,
  };
}

/** the whip's travel along its axis */
function whipPos(f: number, G: Geo) {
  const a = tween(f, KL.whipAnticip, [0, G.whip.counter], EASE.inOut);
  const w = tween(f, KL.whip, [0, G.whip.dist], EASE.in4);
  return a + w;
}

const CallerTag: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const s = KL.callerIn;
  if (t < s - 2) return null;
  const Cc = G.caller;
  const p = aos(t, s, { anticip: 2, depth: 0.08, config: SPRING.site });
  // exit: a 2 f dip, then up out of the mask
  const [o0] = KL.questionOut;
  const dip = t > o0 - 2 && t < o0 ? 14 * Math.sin(((t - (o0 - 2)) / 2) * (Math.PI / 2)) : 0;
  const out = tween(t, KL.questionOut, [0, 1], EASE.in2);
  if (out >= 1) return null;
  const blur = tween(t, [s, s + 8], [3, 0], EASE.out3) + out * 4;
  const style: React.CSSProperties =
    Cc.align === 'right'
      ? { right: (G.v ? 1080 : 1920) - (Cc.boxX + Cc.boxW), textAlign: 'right' }
      : { left: 0, width: G.v ? 1080 : 1920, textAlign: 'center' };
  return (
    <div
      style={{
        position: 'absolute',
        top: Cc.labelY,
        ...style,
        transform: 'translateY(-50%)',
        overflow: 'hidden',
        paddingTop: '0.1em',
        paddingBottom: '0.06em',
      }}
    >
      <div
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: G.top.label,
          lineHeight: 1.12,
          letterSpacing: TRACK.label,
          textTransform: 'uppercase',
          color: C.caller,
          transform: `translateY(${((1 - p) * 110 - out * 60 + dip).toFixed(2)}%)`,
          opacity: 1 - out,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        Caller
      </div>
    </div>
  );
};

/**
 * "Quick question," — kb-1's lead-in (not in its word alignment, timed off its
 * envelope: KL.lead). Set exactly like the question's caption (the caller's
 * Cormorant italic, caller blue): each word writes in on its sound (.16em
 * rise, 3 px blur → 0, 6 f), the word being spoken glows; it gives way to
 * "Do you do home visits?" with the captions' own replacement exit.
 */
const LeadIn: React.FC<{ t: number; G: Geo; cx: number }> = ({ t, G, cx }) => {
  const Ld = KL.lead;
  if (!Ld) return null;
  const [w0, w1] = Ld.words;
  if (t < w0 - 3) return null;
  const Cc = G.caller;
  const out = tween(t, [Ld.out, Ld.out + 4], [0, 1], EASE.in2);
  if (out >= 1) return null;
  const words = Ld.text.split(' ');
  const at = [w0, w1];
  const x = Cc.align === 'right' ? Cc.boxX + Cc.boxW : cx;
  return (
    <div
      style={{
        position: 'absolute',
        top: Cc.rowY,
        ...(Cc.align === 'right' ? { right: (G.v ? 1080 : 1920) - x } : { left: 0, width: G.v ? 1080 : 1920 }),
        textAlign: Cc.align === 'right' ? 'right' : 'center',
        whiteSpace: 'nowrap',
        transform: `translateY(calc(-50% + ${(-30 * out).toFixed(2)}%))`,
        opacity: 1 - out,
        filter: out > 0.02 ? `blur(${(4 * out).toFixed(2)}px)` : undefined,
        fontFamily: FONT.cinema,
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: Cc.size,
        lineHeight: Cc.lh,
        color: C.caller,
      }}
    >
      {words.map((w, j) => {
        const a = at[j] - 2;
        const u = Math.min(1, Math.max(0, (t - a + 1) / 6));
        const e = EASE.out3(u);
        const end = j + 1 < at.length ? at[j + 1] : Ld.out - 6;
        const speaking = t >= a && t < end;
        const dim = speaking ? 1 : 1 - 0.14 * EASE.inOut(Math.min(1, Math.max(0, t - Math.max(end, a + 6)) / 6));
        const g = speaking ? 1 : 1 - Math.min(1, Math.max(0, t - Math.max(end, a + 6)) / 6);
        return (
          <React.Fragment key={j}>
            {j > 0 ? ' ' : null}
            <span
              style={{
                display: 'inline-block',
                opacity: u <= 0 ? 0 : e * dim,
                transform: u < 1 ? `translateY(${(0.16 * (1 - e)).toFixed(4)}em)` : undefined,
                filter: u > 0 && u < 1 ? `blur(${(3 * (1 - e)).toFixed(2)}px)` : undefined,
                textShadow: u > 0 && g > 0.02 ? `0 0 0.35em ${rgba(LISTEN_GLOW.body, 0.2 * g)}` : undefined,
              }}
            >
              {w}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const Knowledge: React.FC = () => {
  const t = useSceneFrame('knowledge');
  const L = useLayout();
  useFontsReady(FONTS);
  if (t >= KL.white) return <AbsoluteFill style={{ background: C.white }} />;
  if (t < 0) {
    // the pre-roll: over the result's last white frames, its ember centre gathers into the Sunday seed
    if (t < KL.dawn[0] - 1) return null;
    const G0 = geo(L);
    const c0 = camera(t, G0, L.cx, L.cy);
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Camera x={c0.x} y={c0.y} zoom={c0.zoom}>
          <Layer depth={0.3}>
            <Dawn t={t} G={G0} />
          </Layer>
        </Camera>
      </AbsoluteFill>
    );
  }

  const G = geo(L);
  const W = L.width;
  const cam = camera(t, G, L.cx, L.cy);
  const cool = missAt(t); // the documents stay cooled: none of them answered

  // the whip: counter-move, then away with a directional blur ∝ speed
  const wp = whipPos(t, G);
  const wv = whipPos(t + 0.5, G) - whipPos(t - 0.5, G);
  const sig = Math.min(40, sigmaFor(wv));

  // the stage recedes under the closing title (out of focus); once the whip's own smear takes
  // over (σ 4 → 8) the focus blur hands over to it — invisible under the smear, and one filter
  // on the frame instead of two nested
  const rc = tween(t, KL.recede, [0, 1], EASE.inOut);
  const focus = 10 * rc * (1 - Math.min(1, Math.max(0, (sig - 4) / 4)));
  const recede: React.CSSProperties =
    rc > 0
      ? {
          opacity: 1 - 0.88 * rc,
          filter: focus > 0.3 ? `blur(${focus.toFixed(2)}px)` : undefined,
          transform: `scale(${(1 - 0.03 * rc).toFixed(5)})`,
          transformOrigin: `${L.cx}px ${L.cy}px`,
        }
      : {};
  // the orb goes out with the recede: a 3 f swell (anticipation), then it folds away (EASE.in2) and
  // its light hands over to the closing's key line. It is never inside a blur wrapper — a WebGL
  // canvas is not to be filtered — and unmounts once gone.
  const [r0] = KL.recede;
  const orbSwell = t > r0 - 3 && t < r0 ? Math.sin(((t - (r0 - 3)) / 3) * (Math.PI / 2)) : t >= r0 ? 1 : 0;
  const orbQ = tween(t, [r0, r0 + 9], [0, 1], EASE.in2);
  const orbOut = 1 - orbQ;
  const orbScale = (1 + 0.04 * orbSwell) * (1 - 0.45 * orbQ);

  const wsx = G.whip.axis === 'x' ? sig : 0;
  const wsy = G.whip.axis === 'y' ? sig : 0;
  const whipF = dirBlurRef('kb-whip', wsx, wsy);
  const whipStyle: React.CSSProperties = {
    transform: G.whip.axis === 'x' ? `translateX(${wp.toFixed(2)}px)` : `translateY(${wp.toFixed(2)}px)`,
    filter: whipF,
  };

  const answer = G.answer;
  const caller = G.caller;
  // Ava speaks in the call's voice: Inter 500, ink on the white stock
  const avaFont = { family: FONT.body, weight: 500, size: answer.size, lineHeight: answer.lh, tracking: '-0.01em' };
  const answerSets: { captions: readonly Caption[]; y: number }[] =
    answer.rowB === null && contiguous
      ? [{ captions: [CAPS[0], CAPS[1], MERGED], y: answer.rowY }]
      : [
          { captions: [CAPS[0], CAPS[1], CAPS[2]], y: answer.rowY },
          { captions: [CAPS[3]], y: answer.rowB ?? answer.rowY + Math.round(answer.size * answer.lh) },
        ];
  // the reader's light pool sits BEHIND the type (a bloom over the captions would wash them)
  const orbWrap: React.CSSProperties = {
    opacity: orbOut,
    transform: orbScale !== 1 ? `scale(${orbScale.toFixed(5)})` : undefined,
    transformOrigin: `${G.orb.x}px ${G.orb.y}px`,
  };

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      {whipF ? <DirBlur id="kb-whip" sx={wsx} sy={wsy} /> : null}
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        {/* ONE whip wrapper (one filtered layer, not two); the orb has gone with the recede before it moves */}
        <AbsoluteFill style={whipStyle}>
          <Layer depth={0.3}>
            <Panel t={t} G={G} />
            <Dawn t={t} G={G} />
          </Layer>
          {/* one recede wrapper for both content planes (one blur, not two) */}
          <AbsoluteFill style={recede}>
            <Layer depth={0.7}>
              <Eyebrow t={t} G={G} />
              <Status t={t} G={G} />
              <Moment t={t} G={G} />
            </Layer>
            <Layer depth={1}>
              {orbOut > 0.002 ? (
                <AbsoluteFill style={orbWrap}>
                  <Reader t={t} G={G} part="light" />
                </AbsoluteFill>
              ) : null}
              <Beams t={t} G={G} uid="kb-beam" />
              <Tiles t={t} G={G} cool={cool} />
              <Slot t={t} G={G} />
              <Heading t={t} G={G} cx={L.cx} />
              <CallerTag t={t} G={G} />
              <LeadIn t={t} G={G} cx={L.cx} />
              <Captions
                t={t}
                lineAt={K.ask}
                voice={K.askVoice}
                captions={QUESTION}
                x={caller.align === 'right' ? caller.boxX + caller.boxW : L.cx}
                y={caller.rowY}
                maxWidth={caller.boxW}
                align={caller.align}
                font={{
                  family: FONT.cinema,
                  weight: 500,
                  size: caller.size,
                  italic: true,
                  lineHeight: caller.lh,
                  tracking: 0,
                }}
                color={C.caller}
                glow={GLOW_CALLER}
                holdUntil={KL.questionOut[1] + 2}
                echoY={null}
              />
              {answerSets.map((set, i) => (
                <CaptionRun
                  key={i}
                  t={t}
                  lineAt={K.answer}
                  voice={K.answerVoice}
                  captions={set.captions}
                  x={L.cx}
                  y={set.y}
                  maxWidth={answer.boxW}
                  font={avaFont}
                  color={C.ink}
                  glow={GLOW_AVA}
                  holdUntil={K.closing}
                  echoY={null}
                  tint={(c, j) => {
                    const at = KEY_WORDS[set.captions[c].word + j];
                    return at === undefined ? null : { color: INK, k: tween(t, [at - 2, at + 6], [0, 1], EASE.out3) };
                  }}
                />
              ))}
            </Layer>
          </AbsoluteFill>
          {orbOut > 0.002 ? (
            <Layer depth={1}>
              <AbsoluteFill style={orbWrap}>
                <Reader t={t} G={G} part="orb" />
              </AbsoluteFill>
            </Layer>
          ) : null}
          <Layer depth={1.4}>
            <Discs t={t} G={G} />
          </Layer>
          <Layer depth={1}>
            <Closing t={t} G={G} cx={W / 2} />
          </Layer>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
