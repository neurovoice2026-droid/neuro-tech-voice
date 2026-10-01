/**
 * KNOWLEDGE — the white act opens on the site's #knowledge reading room,
 * lit as #demo's SUNDAY: this second call comes in on a Sunday (the moment
 * tag says so), so the room, the orb, its bloom and every live accent wear
 * the Sunday light — aqua ground, teal orb (its `listen` twin while the
 * caller asks), sunday ink where the site sets violet. A second caller asks
 * what isn't written down; Ava searches the owner's documents and,
 * honestly, doesn't guess: the light drains on the miss, and floods back
 * when she answers. (knowledge-stage.tsx at film scale; every moment is
 * KNOWLEDGE / KNOWLEDGE_LOCAL in timing.ts, the voiced ones derived from
 * the real voice lengths.)
 *
 *   t 0         pure white (hit.wav): the stage materialises out of the
 *               result's flash (1.035 → 1, the Sunday light blooms)
 *   heading     the eyebrow dot spins in, "KNOWLEDGE BASE" letters rise;
 *               "Answers from your own documents." pops up word by word
 *               where the orb will be; the key phrase turns sunday ink
 *   docPops     five documents pop on 16ths: inhale, overshoot, a glint +
 *               ring, a camera kick each
 *   headingStep the heading lifts, then steps down into the answer slot…
 *   orbIn       …and the orb springs out of a seed of light ON the beat
 *               (bloom flash, ring, kick); the pill pops "Listening" a 16th
 *               later, the moment tag "☀ SUNDAY · 10:24" an 8th later
 *   headingOut  the heading flicks out; CALLER pops; "Do you do home
 *               visits?" word-synced to kb-1; the orb listens (real envelope)
 *   scan        "Looking through 5 documents": beams draw into the orb
 *               (a spark where each lands), the tiles are read, the bars
 *               fill (none reaches the 60 % tick), the peek page shimmers
 *   miss        "Not in the documents" (the pill shakes no): the orb and the
 *               room drain to grey, the beams fall back, the page empties
 *   relight     Ava (kb-2): her Sunday light floods back from her first
 *               sound; the fallback, word-synced with an echo row
 *   closing     the stage recedes; "Where your documents stop, it says so."
 *               — "it says so." turns teal with a glint and a pool of light
 *   out         a 3 f counter-move, then the whip: the stage leaves with a
 *               directional blur ∝ speed; clean white from out[1] − 2
 *
 * Parallax: panel + room light 0.3 · eyebrow, pill, moment tag 0.7 · tiles,
 * beams, orb, captions 1.0 · Sunday light discs 1.4.
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
import { Closing, Heading } from './knowledge/Closing';
import { DirBlur, dirBlurRef, sigmaFor } from './knowledge/blur';
import { DOT, geo, LISTEN_GLOW, SUN_GLOW, type Geo } from './knowledge/geometry';
import { missAt } from './knowledge/light';
import { useFontsReady } from './knowledge/measure';
import { Moment } from './knowledge/Moment';
import { Peek } from './knowledge/Peek';
import { Reader } from './knowledge/Reader';
import { Discs, Eyebrow, Panel } from './knowledge/Stage';
import { Status } from './knowledge/Status';
import { Tiles } from './knowledge/Tiles';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** the caller's question — one caption, word-synced to kb-1 */
const QUESTION = [{ text: 'Do you do home visits?', word: 0 }] as const;
/** the spoken word's halo, on the light stock: the caller's light / Ava's Sunday light */
const GLOW_CALLER = rgba(LISTEN_GLOW.body, 0.2);
const GLOW_AVA = rgba(SUN_GLOW.body, 0.22);

const FONTS = [
  `500 32px ${FONT.body}`,
  `500 30px ${FONT.mono}`,
  `italic 500 88px ${FONT.cinema}`,
  `500 76px ${FONT.cinema}`,
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

const Meta: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const s = KL.meta;
  if (t < s - 2) return null;
  const A = G.answer;
  const p = aos(t, s, { anticip: 2, depth: 0.06, config: SPRING.site });
  // the dot: .6 inhale, then pops past 1.3 and settles; a ring leaves it ON the hit
  const dp = aos(t, s - 1, {
    anticip: 2,
    depth: 0.15,
    config: { stiffness: 420, damping: 13, mass: 0.8 },
  });
  const o = tween(t, [s, s + 7], [0, 1], EASE.out3);
  const blur = tween(t, [s, s + 9], [3, 0], EASE.out3);
  const dot = 14;
  const rq = tween(t, [s, s + 12], [0, 1], EASE.out3);
  const ro = t > s && rq < 1 ? 0.5 * (1 - rq) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: G.v ? 1080 : 1920,
        top: A.metaY,
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 14,
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: A.meta,
        lineHeight: 1.3,
        color: C.muted,
      }}
    >
      <span style={{ position: 'relative', width: dot, height: dot, flex: 'none' }}>
        {ro > 0 ? (
          <span
            style={{
              position: 'absolute',
              left: dot / 2 - (dot * (1 + 2.4 * rq)) / 2,
              top: dot / 2 - (dot * (1 + 2.4 * rq)) / 2,
              width: dot * (1 + 2.4 * rq),
              height: dot * (1 + 2.4 * rq),
              borderRadius: '50%',
              boxShadow: `inset 0 0 0 1.5px rgba(107,104,120,${ro.toFixed(3)})`,
            }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: DOT.missing,
            transform: `scale(${Math.max(0, dp).toFixed(4)})`,
          }}
        />
      </span>
      <span
        style={{
          display: 'inline-block',
          transform: `translateY(${(16 * (1 - p)).toFixed(2)}%)`,
          opacity: o,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        Your fallback message
      </span>
    </div>
  );
};

export const Knowledge: React.FC = () => {
  const t = useSceneFrame('knowledge');
  const L = useLayout();
  useFontsReady(FONTS);
  if (t < 0) return null;
  if (t >= KL.white) return <AbsoluteFill style={{ background: C.white }} />;

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

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      {whipF ? <DirBlur id="kb-whip" sx={wsx} sy={wsy} /> : null}
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        {/* ONE whip wrapper (one filtered layer, not two); the orb has gone with the recede before it moves */}
        <AbsoluteFill style={whipStyle}>
          <Layer depth={0.3}>
            <Panel t={t} G={G} />
          </Layer>
          {/* one recede wrapper for both content planes (one blur, not two) */}
          <AbsoluteFill style={recede}>
            <Layer depth={0.7}>
              <Eyebrow t={t} G={G} />
              <Status t={t} G={G} />
              <Moment t={t} G={G} />
            </Layer>
            <Layer depth={1}>
              <Beams t={t} G={G} uid="kb-beam" />
              <Tiles t={t} G={G} cool={cool} />
              <Peek t={t} G={G} />
              <Heading t={t} G={G} cx={L.cx} />
              <CallerTag t={t} G={G} />
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
                color={C.ink}
                glow={GLOW_CALLER}
                holdUntil={KL.questionOut[1] + 2}
                echoY={null}
              />
              <Captions
                t={t}
                lineAt={K.answer}
                voice={K.answerVoice}
                captions={K.answerCaptions}
                x={L.cx}
                y={answer.rowY}
                maxWidth={answer.boxW}
                font={{
                  family: FONT.cinema,
                  weight: 500,
                  size: answer.size,
                  lineHeight: answer.lh,
                  tracking: 0,
                }}
                color={C.ink}
                glow={GLOW_AVA}
                holdUntil={K.closing}
                echoY={answer.echoY}
              />
              <Meta t={t} G={G} />
            </Layer>
          </AbsoluteFill>
          {orbOut > 0.002 ? (
            <Layer depth={1}>
              <AbsoluteFill
                style={{
                  opacity: orbOut,
                  transform: orbScale !== 1 ? `scale(${orbScale.toFixed(5)})` : undefined,
                  transformOrigin: `${G.orb.x}px ${G.orb.y}px`,
                }}
              >
                <Reader t={t} G={G} />
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
