/**
 * KNOWLEDGE — the white act opens on the site's #knowledge reading room.
 * A second caller asks what isn't written down; Ava searches the owner's
 * documents and, honestly, doesn't guess. (knowledge-stage.tsx at film
 * scale; every moment is KNOWLEDGE / KNOWLEDGE_LOCAL in timing.ts, and the
 * voiced ones are derived from the real voice lengths.)
 *
 *   t 0         pure white (hit.wav): the result's white flash — the stage
 *               materialises out of it (1.035 → 1, the reader's light blooms)
 *   heading     "KNOWLEDGE BASE" letters rise; "Answers from your own
 *               documents." word-mask rises where the orb will be; the key
 *               phrase goes violet
 *   docsIn…     five documents pop on 16ths (docTicks), each a camera kick
 *   ask − 4     the heading flicks out; the orb rises from its place; the
 *               pill pops "Listening"
 *   ask         CALLER + "Do you do home visits?" — word-synced to kb-1;
 *               the orb listens to the caller's real envelope
 *   scan        "Looking through 5 documents": beams draw into the orb and
 *               stream, the bars fill (none reaches the 60 % tick), the peek
 *               page shimmers; the ticks blink
 *   miss        "Not in the documents": the orb greys and goes quiet, the
 *               beams fall back, the peek's lines collapse — an empty page
 *   answer      Ava (kb-2): the fallback, word-synced with an echo row; the
 *               documents step back; "Your fallback message"
 *   closing     the stage recedes; "Where your documents stop, it says so."
 *   out         a 3 f counter-move, then the whip: the stage leaves with a
 *               directional blur ∝ speed; clean white from out[1] − 2
 *
 * Parallax: panel + light 0.3 · eyebrow + pill 0.7 · tiles, beams, orb,
 * captions 1.0 · lilac discs 1.4.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { Camera, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, TRACK } from '../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../timing';
import { Beams } from './knowledge/Beams';
import { Captions } from '../components/Captions';
import { Closing, Heading } from './knowledge/Closing';
import { DOT, geo, type Geo } from './knowledge/geometry';
import { useFontsReady } from './knowledge/measure';
import { Peek } from './knowledge/Peek';
import { greyAt, Reader } from './knowledge/Reader';
import { Discs, Eyebrow, Panel } from './knowledge/Stage';
import { Status } from './knowledge/Status';
import { popAt, Tiles } from './knowledge/Tiles';
import { DirBlur, dirBlurRef, sigmaFor } from './scale/MotionBlur';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** the caller's question — one caption, word-synced to kb-1 */
const QUESTION = [{ text: 'Do you do home visits?', word: 0 }] as const;
/** the spoken word's halo, on the light stock */
const GLOW = 'rgba(124,58,237,0.16)';

const FONTS = [
  `500 32px ${FONT.body}`,
  `italic 500 88px ${FONT.cinema}`,
  `500 76px ${FONT.cinema}`,
  `460 104px ${FONT.ui}`,
];

/** a camera kick: 1 f attack, then e^(−u/4) */
const kick = (u: number) => (u < 0 ? 0 : u < 1 ? u : Math.exp(-(u - 1) / 4));

function camera(t: number, G: Geo, cx: number, cy: number) {
  const push = G.cam.push * tween(t, [0, K.closing], [0, 1], EASE.inOut);
  let k = 0;
  for (let i = 0; i < 5; i++) k += G.cam.kickPop * kick(t - popAt(i));
  k += G.cam.kickMiss * kick(t - K.miss);
  const zoom = 1 + push + k;
  // hand-held drift (reveals the planes), calmed for the closing
  const calm = 1 - tween(t, [K.closing - 10, K.closing + 10], [0, 0.7], EASE.inOut);
  const dx = (G.v ? 5 : 9) * noise2D('kb-cam-x', t * 0.012, 0.4) * calm;
  const dy = (G.v ? 3 : 6) * noise2D('kb-cam-y', 0.9, t * 0.012) * calm;
  // zoom about (ox, oy): for every plane the point stays put
  return { x: (G.cam.ox - cx) * (zoom - 1) + dx, y: (G.cam.oy - cy) * (zoom - 1) + dy, zoom };
}

/** the whip's travel along its axis */
function whipPos(f: number, G: Geo) {
  const a = tween(f, KL.whipAnticip, [0, G.whip.counter], EASE.inOut);
  const w = tween(f, KL.whip, [0, G.whip.dist], EASE.in4);
  return a + w;
}

const CallerTag: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const s = K.ask - 3;
  if (t < s - 2) return null;
  const Cc = G.caller;
  const p = aos(t, s, { anticip: 2, depth: 0.08, config: SPRING.site });
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
          transform: `translateY(${((1 - p) * 110 - out * 60).toFixed(2)}%)`,
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
  const dp = aos(t, s - 1, { anticip: 2, depth: 0.15, config: SPRING.pop });
  const o = tween(t, [s, s + 7], [0, 1], EASE.out3);
  const blur = tween(t, [s, s + 9], [3, 0], EASE.out3);
  const dot = 14;
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
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: DOT.missing,
          transform: `scale(${Math.max(0, dp).toFixed(4)})`,
          flex: 'none',
        }}
      />
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
  const grey = greyAt(t);

  // the stage recedes under the closing title
  const rc = tween(t, KL.recede, [0, 1], EASE.inOut);
  const recede: React.CSSProperties =
    rc > 0
      ? {
          opacity: 1 - 0.88 * rc,
          filter: `blur(${(10 * rc).toFixed(2)}px)`,
          transform: `scale(${(1 - 0.03 * rc).toFixed(5)})`,
          transformOrigin: `${L.cx}px ${L.cy}px`,
        }
      : {};
  // the orb is gone before the whip (it never rides the blur wrapper)
  const orbOut = 1 - tween(t, [K.out[0] - 8, K.out[0]], [0, 1], EASE.inOut);

  // the whip: counter-move, then away with a directional blur ∝ speed
  const wp = whipPos(t, G);
  const wv = whipPos(t + 0.5, G) - whipPos(t - 0.5, G);
  const sig = Math.min(40, sigmaFor(wv));
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
        <AbsoluteFill style={whipStyle}>
          <Layer depth={0.3}>
            <Panel t={t} G={G} grey={grey} />
          </Layer>
          {/* one recede wrapper for both content planes (one blur, not two) */}
          <AbsoluteFill style={recede}>
            <Layer depth={0.7}>
              <Eyebrow t={t} G={G} />
              <Status t={t} G={G} />
            </Layer>
            <Layer depth={1}>
              <Beams t={t} G={G} uid="kb-beam" />
              <Tiles t={t} G={G} cool={grey} />
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
                font={{ family: FONT.cinema, weight: 500, size: caller.size, italic: true, lineHeight: caller.lh, tracking: 0 }}
                color={C.ink}
                glow={GLOW}
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
                font={{ family: FONT.cinema, weight: 500, size: answer.size, lineHeight: answer.lh, tracking: 0 }}
                color={C.ink}
                glow={GLOW}
                holdUntil={K.closing}
                echoY={answer.echoY}
              />
              <Meta t={t} G={G} />
            </Layer>
          </AbsoluteFill>
        </AbsoluteFill>
        {orbOut > 0 ? (
          <Layer depth={1}>
            <AbsoluteFill style={{ ...recede, opacity: (rc > 0 ? 1 - 0.88 * rc : 1) * orbOut }}>
              <Reader t={t} G={G} />
            </AbsoluteFill>
          </Layer>
        ) : null}
        <AbsoluteFill style={whipStyle}>
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
