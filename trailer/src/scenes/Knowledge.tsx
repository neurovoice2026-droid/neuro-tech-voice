/**
 * KNOWLEDGE — the white act opens on the site's #knowledge reading room, a
 * paper room lit by ONE light: the reader's. This second call comes in on a
 * Sunday, so the orb wears #demo's SUNDAY light and the wall around it takes a
 * soft aqua pool of it — light with a source (it exists only once the orb
 * does), falling off like light (no blobs, no discs, no wash). Sunday ink is
 * the scene's one accent; the caller reads in a quiet slate, never a second
 * chromatic ink. One idea per frame: the documents, the reader, who is
 * speaking — no meters, no placeholder pages. A second caller asks what isn't written down; Ava
 * searches the owner's documents and, honestly, doesn't guess: the light
 * drains on the miss, and floods back when she answers. (knowledge-stage.tsx
 * at film scale; every moment is KNOWLEDGE / KNOWLEDGE_LOCAL in timing.ts,
 * the voiced ones derived from the real voice lengths.)
 *
 * ONE TYPE SYSTEM — every word on screen is set like the heading the client
 * chose ("Answers from your own documents.": Instrument Sans 460, −0.03em,
 * sentence case, the key phrase in sunday ink): the heading (TYPE.headline),
 * the closing (TYPE.display), both speakers' captions (TYPE.caption — the
 * caller told apart by slate ink and ● CALLER, never by an italic), the
 * labels (TYPE.label), the cards (the title family). Text appears by MOTION:
 * words rise out of their own masks on soft springs; nothing ever blurs in or
 * out, and nothing is smeared — the film renders at 120 fps.
 *
 *   t 0         the hit (hit-white): a hard, clean cut out of the result's
 *               white-out — the paper room comes up out of the white (1.035 →
 *               1), clean paper and no light yet: the light comes with its
 *               source
 *   heading     ON the hit "Answers from your own documents." rises word by
 *               word where the orb will be; the eyebrow's dot turns in and
 *               "KNOWLEDGE BASE" rises; the key phrase turns sunday ink with a
 *               glint of light running through it
 *   docPops     five documents land on 16ths (a rise and a settle on the site
 *               spring, their shadows settling)
 *   headingStep 16:9: the heading steps down to the answer row (9:16 — one
 *               column — it holds full size and leaves up through its masks
 *               just before the orb springs from its place)…
 *   orbIn       …and the orb springs out of a seed of light ON the beat (a fine
 *               ring off its rim; the Sunday chime) and its pool of light comes
 *               up on the wall with it; the pill opens "Listening" a 16th later
 *               (the scene's one status)
 *   callerIn    the caller's first sound: ● CALLER rises, "Quick question,"
 *               (kb-1's lead-in) writes in; the heading leaves; then "Do you do
 *               home visits?" word-synced; the orb listens (real envelope)
 *   scan        AFTER the question: "Looking through 5 documents": beams draw
 *               into the orb, the cards are read one after another (a fine
 *               sunday-ink ring each, its kind turning sunday ink)
 *   miss        "Not in the documents" (the pill shakes no): the orb and the
 *               room's light drain to a cool grey, the beams fall back, and the
 *               card is born: "0 matches" — 16:9 beside the reader; 9:16 the
 *               documents step back and it opens in front of them, in their place
 *   hum         the question and CALLER leave before Ava (kb-2) makes a sound;
 *               ● AVA rises over her row and "Hmm" writes in on her first sound,
 *               its dots rising through the hum, while the orb breathes in grey
 *   answer      "Hmm…" gives way to her first word; her Sunday light floods back
 *               on it; her caption word-synced, "guess." and "today." in sunday
 *               ink; the orb pushes in; two captions never share a frame
 *               (CaptionRun); 16:9: the documents step back
 *   ticketPop   "I'll ask the team": the page becomes the card for the team (the
 *               question and the caller's number rise in on her words); "call":
 *               the callback chip; "today.": its check (sunday ink — one accent)
 *   closing     the stage recedes (a fade and a touch smaller — never out of
 *               focus); "Where your documents stop, it says so." — "it says so."
 *               turns sunday ink with a glint
 *   out         a 3 f counter-move, then the whip: the stage leaves at speed
 *               (crisp at 120 fps, no smear); clean white from out[1] − 2
 *
 * Parallax (a slow push only — no hand-held drift, no kicks): room 0.3 ·
 * eyebrow, pill 0.7 · cards, beams, slot, orb, captions 1.0.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, camMoving, Layer } from '../components/Camera';
import { Captions } from '../components/Captions';
import { reveal, Reveal, revealStyle, useGlide } from '../components/Type';
import { useLayout } from '../lib/layout';
import { EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { captionFont, maskBox, typeStyle, type CaptionFont } from '../lib/type';
import { C, FONT } from '../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL, type Caption } from '../timing';
import { Beams } from './knowledge/Beams';
import { CaptionRun } from './knowledge/CaptionRun';
import { Closing, Heading } from './knowledge/Closing';
import { CALLER, geo, INK, type Geo } from './knowledge/geometry';
import { useFontsReady } from './knowledge/measure';
import { Reader } from './knowledge/Reader';
import { Slot } from './knowledge/Slot';
import { Eyebrow, Room } from './knowledge/Stage';
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
/** the spoken words that turn sunday ink as they are said ("guess." · "today.") */
const KEY_WORDS: Record<number, number> = { 12: KL.guessKey, 21: KL.check };
/** the caller's slate (geometry.ts CALLER): the speaker reads, without a second chromatic ink beside sunday teal */
const CALLER_INK = CALLER.text;
const CALLER_TAG = CALLER.tag;

/** every face + weight the scene measures or sets (held until loaded) */
const FONTS = [`460 76px ${FONT.ui}`, `480 42px ${FONT.ui}`, `480 30px ${FONT.ui}`, `540 30px ${FONT.ui}`];

const OUT = 4;
/** word j of n leaves in a window of `dur` frames from `at`: a small left-to-right stagger inside it (as <Captions>) */
function exitOf(at: number, dur: number, j: number, n: number) {
  const st = n > 1 ? Math.min(0.4, (dur * 0.35) / (n - 1)) : 0;
  return { at: at + j * st, dur: dur - (n - 1) * st };
}

/** the camera: one slow push about (ox, oy) through the scene — no hand-held drift, no kicks */
function camera(t: number, G: Geo, cx: number, cy: number) {
  const zoom = 1 + G.cam.push * tween(t, [0, K.closing], [0, 1], EASE.inOut);
  // zoom about (ox, oy): for every plane the point stays put
  return { x: (G.cam.ox - cx) * (zoom - 1), y: (G.cam.oy - cy) * (zoom - 1), zoom };
}

/** the whip's travel along its axis */
function whipPos(f: number, G: Geo) {
  const a = tween(f, KL.whipAnticip, [0, G.whip.counter], EASE.inOut);
  const w = tween(f, KL.whip, [0, G.whip.dist], EASE.in4);
  return a + w;
}

/**
 * A speaker tag (the call's turn label): ● CALLER in caller slate / ● AVA in sunday ink (TYPE.label),
 * rising out of its mask on the caption spring and leaving up through it.
 */
const SpeakerTag: React.FC<{
  t: number;
  G: Geo;
  who: 'ava' | 'caller';
  at: number;
  out: readonly [number, number];
  y: number;
  /** right-aligned to this x (16:9 caller), else centred on the frame */
  right?: number;
}> = ({ t, G, who, at, out: [o0, o1], y, right }) => {
  if (t < at - 2 || t > o1 + 1) return null;
  const st = typeStyle('label', G.v, { tone: 'paper' });
  const ink = who === 'ava' ? INK : CALLER_TAG;
  const dot = Math.round((st.fontSize as number) * 0.3);
  const W = G.v ? 1080 : 1920;
  const pos: React.CSSProperties = right !== undefined ? { right: W - right, textAlign: 'right' } : { left: 0, width: W, textAlign: 'center' };
  return (
    <div style={{ position: 'absolute', top: y, ...pos, transform: 'translateY(-50%)', ...st, color: ink, whiteSpace: 'nowrap' }}>
      <Reveal t={t} start={at - 1} config={SPRING.caption} rise={90} exit={{ at: o0, dur: Math.max(3, o1 - o0) }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', marginRight: '-0.14em' }}>
          <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: ink, transform: 'translateY(-0.04em)' }} />
          {who === 'ava' ? 'Ava' : 'Caller'}
        </span>
      </Reveal>
    </div>
  );
};

/** One line of words set like a caption, each rising on its own frame, all leaving through their masks at `out`. */
const SpokenRow: React.FC<{
  t: number;
  words: readonly string[];
  /** frame each word appears */
  at: readonly number[];
  out: number;
  outDur?: number;
  font: CaptionFont;
  color: string;
  x: number;
  y: number;
  align: 'center' | 'right';
  W: number;
  /** a trailing piece after the words (the hum's dots) */
  after?: (i: number) => React.ReactNode;
}> = ({ t, words, at, out, outDur = OUT, font, color, x, y, align, W, after }) => {
  const glide = useGlide(); // under the scene's slow push each word holds its own small layer
  if (t < Math.min(...at) - 2 || t > out + outDur) return null;
  const rowH = font.size * font.lineHeight;
  const n = words.length;
  return (
    <div
      style={{
        position: 'absolute',
        top: y - rowH / 2,
        ...(align === 'right' ? { right: W - x, textAlign: 'right' } : { left: 0, width: W, textAlign: 'center' }),
        whiteSpace: 'nowrap',
        fontFamily: font.family,
        fontWeight: font.weight,
        fontSize: font.size,
        lineHeight: font.lineHeight,
        letterSpacing: typeof font.tracking === 'number' ? `${font.tracking}em` : font.tracking,
        color,
      }}
    >
      {words.map((w, j) => {
        const r = reveal(t, at[j] - 1, { config: SPRING.caption, rise: 80, fade: 0.5, exit: exitOf(out, outDur, j, n) });
        return (
          <React.Fragment key={j}>
            {j > 0 ? ' ' : null}
            <span style={maskBox(0)}>
              <span style={revealStyle(r, undefined, glide)}>{w}</span>
            </span>
          </React.Fragment>
        );
      })}
      {after?.(n)}
    </div>
  );
};

/**
 * "Hmm…" — kb-2's thinking pre-roll (not in its word alignment, timed off its envelope: KL.hum).
 * Set as Ava's captions are (TYPE.caption, ink, on her row): "Hmm" rises on its sound and its three
 * dots rise one by one through the hum (¼ · ½ · ¾ of it); it leaves up through its masks on the
 * frame "I…" shows.
 */
const Hum: React.FC<{ t: number; G: Geo; font: CaptionFont }> = ({ t, G, font }) => {
  const Hm = KL.hum;
  if (!Hm) return null;
  const A = G.answer;
  const [o0, o1] = Hm.out;
  return (
    <SpokenRow
      t={t}
      words={[Hm.text]}
      at={[Hm.appear]}
      out={o0}
      outDur={o1 - o0}
      font={font}
      color={C.ink}
      x={0}
      y={A.rowY}
      align="center"
      W={G.v ? 1080 : 1920}
      after={() =>
        Hm.dots.map((d, j) => {
          const r = reveal(t, d - 1, { config: SPRING.caption, rise: 80, fade: 0.5, exit: { at: o0 + 0.4 * (j + 1), dur: o1 - o0 - 1.2 } });
          return (
            <span key={j} style={{ ...maskBox(0), marginLeft: j === 0 ? '-0.04em' : '-0.16em' }}>
              <span style={revealStyle(r)}>.</span>
            </span>
          );
        })
      }
    />
  );
};

/**
 * "Quick question," — kb-1's lead-in (not in its word alignment, timed off its envelope: KL.lead).
 * Set exactly like the question's caption (TYPE.caption in caller slate): each word rises on its
 * sound; it leaves up through its masks before "Do you do home visits?" writes in.
 */
const LeadIn: React.FC<{ t: number; G: Geo; font: CaptionFont }> = ({ t, G, font }) => {
  const Ld = KL.lead;
  if (!Ld) return null;
  const Cc = G.caller;
  const W = G.v ? 1080 : 1920;
  return (
    <SpokenRow
      t={t}
      words={Ld.text.split(' ')}
      at={Ld.words.map((w) => w - 2)}
      out={Ld.out}
      font={font}
      color={CALLER_INK}
      x={Cc.align === 'right' ? Cc.boxX + Cc.boxW : W / 2}
      y={Cc.rowY}
      align={Cc.align}
      W={W}
    />
  );
};

export const Knowledge: React.FC = () => {
  const t = useSceneFrame('knowledge');
  const L = useLayout();
  useFontsReady(FONTS);
  if (t >= KL.white) return <AbsoluteFill style={{ background: C.white }} />;
  // (the pre-roll is the result's own: its white-out holds clean to the cut — no light before its source)
  if (t < 0) return null;

  const G = geo(L);
  const W = L.width;
  const cam = camera(t, G, L.cx, L.cy);

  // the whip: a counter-move, then away at speed — no smear (120 fps)
  const wp = whipPos(t, G);
  const whipStyle: React.CSSProperties =
    Math.abs(wp) > 0.001 ? { transform: G.whip.axis === 'x' ? `translateX(${wp.toFixed(3)}px)` : `translateY(${wp.toFixed(3)}px)`, willChange: 'transform' } : {};

  // the stage recedes under the closing title: it fades out and settles back a touch (never out of focus)
  const rc = tween(t, KL.recede, [0, 1], EASE.inOut);
  const recede: React.CSSProperties =
    rc > 0
      ? { opacity: 1 - rc, transform: `scale(${(1 - 0.03 * rc).toFixed(5)})`, transformOrigin: `${L.cx}px ${L.cy}px` }
      : {};
  // the orb goes out with the recede: a 3 f swell (anticipation), then it folds away (power2.in) and unmounts
  const [r0] = KL.recede;
  const orbSwell = t > r0 - 3 && t < r0 ? Math.sin(((t - (r0 - 3)) / 3) * (Math.PI / 2)) : t >= r0 ? 1 : 0;
  const orbQ = tween(t, [r0, r0 + 9], [0, 1], EASE.in2);
  const orbOut = 1 - orbQ;
  const orbScale = (1 + 0.03 * orbSwell) * (1 - 0.4 * orbQ);
  const orbWrap: React.CSSProperties = {
    opacity: orbOut,
    transform: orbScale !== 1 ? `scale(${orbScale.toFixed(5)})` : undefined,
    transformOrigin: `${G.orb.x}px ${G.orb.y}px`,
  };

  const answer = G.answer;
  const caller = G.caller;
  const callerFont = captionFont(L.vertical, 'paper', caller.size);
  const avaFont = captionFont(L.vertical, 'paper', answer.size);
  const answerSets: { captions: readonly Caption[]; y: number }[] =
    answer.rowB === null && contiguous
      ? [{ captions: [CAPS[0], CAPS[1], MERGED], y: answer.rowY }]
      : [
          { captions: [CAPS[0], CAPS[1], CAPS[2]], y: answer.rowY },
          { captions: [CAPS[3]], y: answer.rowB ?? answer.rowY + Math.round(answer.size * answer.lh) },
        ];

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      {/* the slow push glides: while it runs, the type on its planes rides small sub-pixel layers (Camera.tsx useGlide) */}
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom} moving={camMoving((tt) => camera(tt, G, L.cx, L.cy), t)}>
        {/* the room stays put under the whip (it goes to clean white): only what stands in it whips away */}
        <Layer depth={0.3}>
          <Room t={t} G={G} />
        </Layer>
        <AbsoluteFill style={whipStyle}>
          {/* one recede wrapper for both content planes */}
          <AbsoluteFill style={recede}>
            <Layer depth={0.7}>
              <Eyebrow t={t} G={G} />
              {/* one status: the pill (no moment tag, no sun) */}
              <Status t={t} G={G} />
            </Layer>
            <Layer depth={1}>
              <Beams t={t} G={G} uid="kb-beam" />
              <Tiles t={t} G={G} />
              <Slot t={t} G={G} />
              <Heading t={t} G={G} cx={L.cx} />
              <SpeakerTag
                t={t}
                G={G}
                who="caller"
                at={KL.callerIn}
                out={KL.questionOut}
                y={caller.labelY}
                right={caller.align === 'right' ? caller.boxX + caller.boxW : undefined}
              />
              <LeadIn t={t} G={G} font={callerFont} />
              <SpeakerTag t={t} G={G} who="ava" at={KL.avaIn} out={KL.avaOut} y={answer.labelY} />
              <Hum t={t} G={G} font={avaFont} />
              <Captions
                t={t}
                lineAt={K.ask}
                voice={K.askVoice}
                captions={QUESTION}
                x={caller.align === 'right' ? caller.boxX + caller.boxW : L.cx}
                y={caller.rowY}
                maxWidth={caller.boxW}
                align={caller.align}
                font={callerFont}
                tone="paper"
                color={CALLER_INK}
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
                  tone="paper"
                  color={C.ink}
                  holdUntil={K.closing}
                  echoY={null}
                  tint={(c, j) => {
                    const at = KEY_WORDS[set.captions[c].word + j];
                    return at === undefined ? null : { color: INK, k: tween(t, [at - 2, at + 6], [0, 1], EASE.out3) };
                  }}
                />
              ))}
              {orbOut > 0.002 ? (
                <AbsoluteFill style={orbWrap}>
                  <Reader t={t} G={G} />
                </AbsoluteFill>
              ) : null}
            </Layer>
          </AbsoluteFill>
          <Layer depth={1}>
            <Closing t={t} G={G} cx={W / 2} />
          </Layer>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
