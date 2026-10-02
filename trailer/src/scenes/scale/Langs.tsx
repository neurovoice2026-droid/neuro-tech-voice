/**
 * THE LANGUAGES — Ava greets in six languages, one card in focus at a time.
 *
 *   focus     the ACTIVE language: a large white card under the band title.
 *             Top-left, a small flat emerald dot (the scene's accent: she is
 *             speaking) breathing with her REAL envelope (VOICE.lines[id].env)
 *             beside the language's name as a tracked label; below, the
 *             greeting in Instrument Sans 460, −0.03em (the knowledge
 *             heading's face; Japanese in Noto Sans JP, its Latin "AI" /
 *             "Ava" in Instrument Sans), every word rising out of its own
 *             mask as she says it. The AI disclosure is the key phrase: it
 *             turns to the scene's accent as she says it (colour alone, as
 *             the knowledge heading's two-tone — no rule under it).
 *   cascade   English is heard whole (its card rises in as the index clears). Then
 *             Romanian / Spanish / French / German slide in from the right,
 *             each landing a frame before its voice cuts in (1 – 1.25 s
 *             each): she is cut right after her name, so the card shows only
 *             what is HEARD — "Sunt Ava," … "Sie sprechen mit Ava," — one
 *             glanceable line, settled by landAt + 3. Japanese is heard whole
 *             (per character, on her words).
 *   switch    no switch shows an empty card: every card's first word rises
 *             4 f before it lands, so its text is up as it covers the card it
 *             replaces; a leaving card hands its focus face over to its
 *             gallery face (one of them is always up).
 *   gallery   as the next card arrives, the last one recedes into the gallery
 *             (16:9 a row of five under the focus · 9:16 3 + 2): the name and
 *             what she said, small — so from Japanese on all six are visible.
 *   flow      the gallery drops away and Japanese flies to the first station:
 *             it becomes THE CALL (Flow.tsx).
 *
 * No blur anywhere (no shutter, no defocus): the master's 120 fps carries the
 * moves; the cards are paper (Cards.tsx), shadows real, no rims or glows.
 */
import React from 'react';
import { C, FONT, TYPE_JP } from '../../theme';
import { aos, EASE, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { reveal, revealStyle } from '../../components/Type';
import { SCALE, SCALE_LOCAL, vWord } from '../../timing';
import { VOICE } from '../../voice.generated';
import { Card } from './Cards';
import { slide } from './curves';
import { LANGS, scriptRuns, underlined, wordsOf } from './data';
import { StationFace, type FlowTiming } from './Flow';
import { centre, mixRect, type Geo, type Rect } from './geometry';
import { ACCENT, META } from './lights';

const K = SCALE_LOCAL;
const LA = SCALE.langAt;
const N = LANGS.length;
const CARRIER = N - 1;

/* ── timing per card ─────────────────────────────────────────────── */
/** her voice: the line's start, and where the next voice cuts it (the quick four) */
const voiceAt = (k: number) => LA[k];
const cutAt = (k: number) => (k >= 1 && k <= 4 ? LA[k + 1] : undefined);
/** the card has landed in the focus */
const arriveAt = (k: number) => (k === 0 ? K.enFlip + 6 : LA[k] - 1);
/** frame spoken word j is up (a frame early: it is there as she says it) */
const wordAt = (k: number, j: number) => voiceAt(k) + vWord(LANGS[k].id, j) - 1;
/** the quick four: cut right after her name, so they show only what is heard, at once */
const isQuick = (k: number) => cutAt(k) !== undefined;
/** the quick four's focus line: the heard fragment's line breaks, and its word count */
const heardLines = (k: number, v: boolean) => LANGS[k].heard?.[v ? 1 : 0] ?? LANGS[k].main[v ? 1 : 0];
const heardN = (k: number) => heardLines(k, false).reduce((a, n) => a + n, 0);
/**
 * frame word j of card k starts to rise in the focus card:
 *  · the quick four: the whole fragment on a stagger as the card lands (K.greetIn … + K.greetSpread)
 *  · English / Japanese: ON her words; the first rises with the card (K.greetIn) so the card never
 *    lands empty — it has settled as she starts to speak
 */
function riseAt(k: number, j: number): number {
  if (isQuick(k)) return K.greetIn[k] + (K.greetSpread * j) / Math.max(1, heardN(k) - 1);
  return j === 0 ? Math.min(K.greetIn[k], wordAt(k, 0)) : wordAt(k, j);
}

/** her loudness at t for card k (0..1), smoothed with a short release; silent before her line and after the cut */
function envAt(k: number, t: number): number {
  const env = VOICE.lines[LANGS[k].id].env;
  const cut = cutAt(k);
  let e = 0;
  for (let j = 0; j < 5; j++) {
    const f = t - voiceAt(k) - j;
    const i = Math.floor(f);
    if (i < 0 || i >= env.length - 1) continue;
    if (cut !== undefined && voiceAt(k) + f >= cut) continue;
    const v = env[i] + (env[i + 1] - env[i]) * (f - i);
    e = Math.max(e, v * Math.pow(0.72, j));
  }
  return e;
}

/** the phrase's ink: it turns to the accent as she starts to say it (EASE.house over 12 f) */
const discloseInk = (k: number, t: number) =>
  k === 0 ? tween(t, [K.discloseEn[0] - 1, K.discloseEn[0] + 11], [0, 1], EASE.house) : k === CARRIER ? tween(t, [K.discloseJa[0] - 1, K.discloseJa[0] + 11], [0, 1], EASE.house) : 0;

/* ── type ────────────────────────────────────────────────────────── */
/** the Latin runs inside the Japanese line stand with the CJK (TYPE_JP: CJK reads ≈ 1 / .86 bigger) */
const LATIN_IN_CJK = 1 / TYPE_JP.scale;
const WORD = { config: SPRING.caption, rise: 100, fade: 0.5 } as const;

type LineOpts = {
  k: number;
  t: number;
  size: number;
  /** reveal frame of word j (undefined: shown, still) */
  at: (j: number) => number | undefined;
  /** 0..1 the AI phrase's accent */
  key: number;
  thin?: boolean;
  /** the words leave up through their masks from this frame (the carrier's take-off) */
  out?: number;
};

/** one masked unit (a word, or a Japanese character); `out`: it leaves up through its mask from then */
function Unit({ text, t, s0, out, style }: { text: string; t: number; s0: number | undefined; out?: number; style?: React.CSSProperties }) {
  if (s0 === undefined) return <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>{text}</span>;
  const r = reveal(t, s0, { ...WORD, exit: out === undefined ? undefined : { at: out, dur: 3.2 } });
  return (
    <span style={{ ...maskBox(0), ...style }}>
      <span style={{ ...revealStyle(r), whiteSpace: 'pre' }}>{text}</span>
    </span>
  );
}

/** one line of a greeting: its words (indices), the AI words grouped as the key phrase */
function GreetingLine({ js, o }: { js: number[]; o: LineOpts }) {
  const l = LANGS[o.k];
  const words = wordsOf(l);
  const cjk = !!l.cjk;
  const inAi = (j: number) => j >= l.ai[0] && j <= l.ai[1];
  const segs: { ai: boolean; js: number[] }[] = [];
  for (const j of js) {
    const last = segs[segs.length - 1];
    if (last && last.ai === inAi(j)) last.js.push(j);
    else segs.push({ ai: inAi(j), js: [j] });
  }
  const keyCol = mixHex(C.ink, ACCENT, o.key);
  /** a word's units: whole for Latin; per character for Japanese (its Latin runs in Instrument Sans, larger) */
  const unit = (j: number, text: string, color?: string) => {
    const s0 = o.at(j);
    if (!cjk) return <Unit key={`w${j}`} text={text} t={o.t} s0={s0} out={o.out} style={color ? { color } : undefined} />;
    const chars = Array.from(text);
    const next = j + 1 < words.length ? o.at(j + 1) : undefined;
    // the characters of word j spread over its spoken span (≤ 8 f); "AI" rises as one unit with the card
    const span = j === 0 ? 1 : s0 === undefined || next === undefined ? 4 : Math.min(8, Math.max(1, next - s0));
    let ci = 0;
    return (
      <React.Fragment key={`w${j}`}>
        {scriptRuns(text).map((run, ri) =>
          run.latin ? (
            // a Latin run rises as one unit (kerned), at the Latin size
            (() => {
              const c = ci;
              ci += run.s.length;
              const st = s0 === undefined ? undefined : s0 + (span * c) / chars.length;
              return (
                <Unit
                  key={`${ri}`}
                  text={run.s}
                  t={o.t}
                  s0={st}
                  out={o.out}
                  style={{ fontFamily: FONT.ui, fontSize: `${LATIN_IN_CJK}em`, letterSpacing: '-0.03em', marginRight: '0.04em', color }}
                />
              );
            })()
          ) : (
            Array.from(run.s).map((ch, i) => {
              const c = ci++;
              const st = s0 === undefined ? undefined : s0 + (span * c) / chars.length;
              return <Unit key={`${ri}-${i}`} text={ch} t={o.t} s0={st} out={o.out} style={{ fontFamily: FONT.jp, color }} />;
            })
          ),
        )}
      </React.Fragment>
    );
  };
  return (
    <div style={{ whiteSpace: 'nowrap' }}>
      {segs.map((seg, si) => {
        const lastJ = seg.js[seg.js.length - 1];
        const tail = seg.ai ? words[lastJ].slice(underlined(words[lastJ]).length) : '';
        const content = seg.js.map((j, n) => (
          <React.Fragment key={j}>
            {n > 0 && !cjk ? ' ' : null}
            {unit(j, seg.ai && j === lastJ ? underlined(words[j]) : words[j], seg.ai ? keyCol : undefined)}
          </React.Fragment>
        ));
        return (
          <React.Fragment key={si}>
            {si > 0 && !cjk ? ' ' : null}
            {seg.ai ? (
              <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
                {content}
              </span>
            ) : (
              content
            )}
            {tail ? <Unit text={tail} t={o.t} s0={o.at(lastJ)} out={o.out} style={seg.ai ? { color: C.ink } : undefined} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** split word indices [from, to) into lines of the given counts */
const linesOf = (from: number, counts: readonly number[]) => {
  let j = from;
  return counts.map((c) => Array.from({ length: c }, () => j++));
};

/** the greeting's setting: the knowledge heading's face (Japanese: TYPE_JP on top) */
const greetFace = (v: boolean, size: number, cjk: boolean): React.CSSProperties => ({
  ...typeStyle('display', v, { tone: 'paper', size, jp: cjk }),
  ...(cjk ? { lineHeight: 1.22 } : { lineHeight: 1.04 }),
  color: C.ink,
});

/* ── the faces ───────────────────────────────────────────────────── */
/** a flat dot + the language's name (a tracked label): the card's speaker line */
const SpeakerRow: React.FC<{ k: number; t: number; v: boolean; D: number; lit: number; out?: number }> = ({ k, t, v, D, lit, out }) => {
  const e = envAt(k, t) * lit;
  const a = arriveAt(k);
  // the dot comes up as the card lands (a soft pop), takes the accent while her line is live, and
  // breathes a touch with her voice (flat: no sphere, no highlight); on `out` it shrinks away
  const pop = aos(t, a - 2, { anticip: 0, depth: 0, config: { stiffness: 260, damping: 18, mass: 0.7 } });
  const gone = out === undefined ? 0 : smooth(out, out + 3.5, t);
  const ds = (0.6 + 0.4 * Math.min(1.05, Math.max(0, pop))) * (1 + 0.28 * e) * (1 - gone);
  const lr = out === undefined ? null : reveal(t, -1e6, { ...WORD, exit: { at: out, dur: 3.2 } });
  const label = typeStyle('label', v, { tone: 'paper' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(D * 1.3) }}>
      <div
        style={{
          width: D,
          height: D,
          borderRadius: '50%',
          background: mixHex(META, ACCENT, lit),
          transform: Math.abs(ds - 1) > 1e-4 ? `scale(${ds.toFixed(4)})` : undefined,
          flex: 'none',
        }}
      />
      <div style={{ ...label, color: META, whiteSpace: 'nowrap' }}>
        {lr ? (
          <span style={maskBox(0)}>
            <span style={revealStyle(lr)}>{LANGS[k].name}</span>
          </span>
        ) : (
          LANGS[k].name
        )}
      </div>
    </div>
  );
};

/** The focus face, laid out for the focus card (w × h); `lit` is the card's light (0..1). */
export const LangFocusFace: React.FC<{ k: number; t: number; w: number; h: number; vertical: boolean; lit: number; out?: number }> = ({
  k,
  t,
  vertical: v,
  lit,
  out,
}) => {
  const l = LANGS[k];
  const pad = v ? 48 : 60;
  /** the speaker dot (px) */
  const D = 10;
  const size = l.size[v ? 1 : 0];
  const quick = isQuick(k);
  const keyInk = discloseInk(k, t);
  const mainLines = linesOf(0, quick ? heardLines(k, v) : l.main[v ? 1 : 0]);
  return (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad }}>
        <SpeakerRow k={k} t={t} v={v} D={D} lit={lit} out={out} />
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad - size * 0.2, ...greetFace(v, size, !!l.cjk) }}>
        {mainLines.map((js, i) => (
          <GreetingLine key={i} js={js} o={{ k, t, size, key: keyInk, at: (j) => riseAt(k, j), out: out === undefined ? undefined : out + 0.6 * i }} />
        ))}
      </div>
    </>
  );
};

/**
 * The gallery face: the language's name and the words she said before the next one took over. It
 * rises in (label, then each line, out of their masks) from `at`, once the focus face has gone — never
 * two versions of the same words over each other.
 */
export const LangGalleryFace: React.FC<{ k: number; t: number; at: number; vertical: boolean }> = ({ k, t, at, vertical: v }) => {
  const l = LANGS[k];
  const pad = v ? 20 : 24;
  const size = v ? 38 : 40;
  const lines = linesOf(0, l.gallery[v ? 1 : 0]);
  const lr = reveal(t, at, WORD);
  return (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad - 2, ...typeStyle('label', v, { tone: 'paper' }), color: META }}>
        <span style={maskBox(0)}>
          <span style={revealStyle(lr)}>{l.name}</span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad - 6, bottom: pad - size * 0.2, ...greetFace(v, l.cjk ? Math.round(size * TYPE_JP.scale) : size, !!l.cjk), letterSpacing: l.cjk ? TYPE_JP.tracking : '-0.02em' }}>
        {lines.map((js, i) => (
          <GreetingLine key={i} js={js} o={{ k, t, size, key: 0, at: (j) => at + 0.8 + 0.9 * i + 0.4 * (j - js[0]), thin: true }} />
        ))}
      </div>
    </>
  );
};

/* ── the choreography ────────────────────────────────────────────── */
/** English rises into the focus under the lifting title: ζ ≈ .85, settled in ≈ 10 f, no visible overshoot */
const RISE_IN = { stiffness: 200, damping: 24, mass: 1 };
/** how far below its place it starts (px) */
const RISE_PX = 84;
const SLIDE_IN = { w: 0.5, z: 0.7, over: 10 };
const TO_GALLERY = { w: 0.5, z: 0.72, over: 6, anticip: 2, back: 10 };
const CARRY = { w: 0.55, z: 0.7, over: 8, anticip: 3, back: 14 };

const focusOf = (G: Geo, k: number) => (k === 0 ? G.langEn : G.lang);
const dist = (a: Rect, b: Rect) => Math.hypot(centre(b).x - centre(a).x, centre(b).y - centre(a).y);

type Pose = { r: Rect; rot: number; leave: number; drop: number; carry: number; moving: boolean; enter: number };

/** where card k is at tt (null: not on stage) */
export function poseOf(G: Geo, k: number, tt: number): Pose | null {
  const F = focusOf(G, k);
  let r: Rect;
  let moving = false;
  let enter = 1;
  if (k === 0) {
    // English rises into the focus from a little below as the index clears and the title lifts
    if (tt < K.glide) return null;
    enter = springUnit(tt - K.glide, RISE_IN);
    r = { ...F, y: F.y + (1 - enter) * RISE_PX };
    moving = Math.abs(1 - enter) > 1e-4;
  } else {
    if (tt < K.switchIn[k]) return null;
    const from: Rect = { ...F, x: G.W + 40, y: F.y };
    const p = slide(tt - K.switchIn[k], dist(from, F), SLIDE_IN);
    r = mixRect(from, F, p);
    moving = Math.abs(1 - p) > 1e-4;
  }
  // recede into the gallery (Japanese: carried to the first station)
  let leave = 0;
  let carry = 0;
  if (k < CARRIER) {
    leave = slide(tt - K.switchOut[k], dist(F, G.gallery[k]), TO_GALLERY);
    r = mixRect(r, G.gallery[k], leave);
    if (leave > 0 && Math.abs(1 - leave) > 1e-4) moving = true;
  } else {
    carry = slide(tt - K.carrierFly, dist(F, G.stations[0]), CARRY);
    r = mixRect(r, G.stations[0], carry);
    if (carry !== 0 && Math.abs(1 - carry) > 1e-4) moving = true;
  }
  // the gallery drops away for the flow: a 3 f lift, then a fall (gravity) as it fades
  let drop = 0;
  let rot = 0;
  if (k < CARRIER) {
    const s = K.collapse + (G.W < G.H ? (k >= 3 ? 0 : 1 + k) : Math.abs(k - 2)) * K.collapseStagger;
    const A = 3;
    const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
    drop = tween(tt, [s, s + 12], [0, 1], EASE.in2);
    if (drop >= 1) return null;
    r = { ...r, y: r.y - 8 * pre + drop * 420 };
    rot = (k % 2 === 0 ? 1 : -1) * 2 * drop;
    if (pre > 0 || drop > 0) moving = true;
  }
  return { r, rot, leave, drop, carry, moving, enter };
}

export const LangCards: React.FC<{
  t: number;
  G: Geo;
  vertical: boolean;
  flowT: FlowTiming;
}> = ({ t, G, vertical: v, flowT }) => {
  const order = Array.from({ length: N }, (_, k) => k);
  const cards = order.map((k) => {
    const P = poseOf(G, k, t);
    if (!P) return null;
    const F = focusOf(G, k);
    const { r } = P;
    // the card's light (her speaker dot): up as it lands, out as it recedes
    const a = arriveAt(k);
    const lit =
      tween(t, [a - 3, a + 2], [0, 1], EASE.out3) *
      (1 - (k === CARRIER ? tween(t, [K.carrierFly + 2, K.carrierFly + 10], [0, 1], EASE.inOut) : tween(t, [K.switchOut[k] + 1, K.switchOut[k] + 9], [0, 1], EASE.inOut)));
    let transform: string | undefined = Math.abs(P.rot) > 0.01 ? `rotate(${P.rot.toFixed(3)}deg)` : undefined;
    let face: React.ReactNode = null;
    let opacity = 1 - tween(P.drop, [0.3, 1], [0, 1], EASE.inOut);
    let z = P.leave > 0.02 ? 2 : 3;
    // English: it comes up with its rise (the card, then its words out of their masks)
    if (k === 0 && P.enter < 0.9999) {
      opacity *= smooth(0, 0.6, P.enter);
      const sc = 0.97 + 0.03 * Math.min(1, P.enter);
      transform = `scale(${sc.toFixed(5)})`;
      z = 4;
    }
    {
      // the focus face, scaled with the card as it recedes, goes in the first third of the move; then the
      // gallery face rises in (its own masks) — a hand-over, never a cross-dissolve of the same words
      const sc = Math.min(r.w / F.w, r.h / F.h);
      const galAt = k < CARRIER ? K.switchOut[k] + 2.2 : Infinity;
      const fo = k < CARRIER ? 1 - smooth(0, 0.28, P.leave) : 1;
      // Japanese leaves up through its masks as the carrier takes off; THE CALL's face then rises in its own
      // masks (StationFace, from callIn − .5): one face after the other, never a dissolve
      const jaOut = k === CARRIER ? (t > K.carrierFly + 4.5 ? 1 : 0) : 0;
      const callIn = k === CARRIER && t >= K.callIn - 1.5 ? 1 : 0;
      face = (
        <>
          {fo > 0.004 && jaOut < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: F.w,
                height: F.h,
                transform: sc < 0.9999 ? `scale(${sc.toFixed(5)})` : undefined,
                transformOrigin: '0 0',
                opacity: fo < 0.999 ? fo : undefined,
              }}
            >
              <LangFocusFace k={k} t={t} w={F.w} h={F.h} vertical={v} lit={lit} out={k === CARRIER ? K.carrierFly - 1 : undefined} />
            </div>
          ) : null}
          {t > galAt - 1 ? <LangGalleryFace k={k} t={t} at={galAt} vertical={v} /> : null}
          {callIn > 0 ? <StationFace i={0} t={t} T={flowT} vertical={v} /> : null}
        </>
      );
    }
    if (k === CARRIER && t >= K.stations[0] - 3) z = 4;
    // the shadow: a card in flight floats higher; a gallery card rests closer to the wall
    const lift = P.moving ? 1.6 : P.leave > 0.5 ? 0.7 : 1;
    const radius = P.leave > 0.5 ? 22 : v ? 28 : 32;
    return (
      <Card key={`lang-${k}`} r={r} transform={transform} opacity={opacity} lift={lift} radius={radius} z={z} moving={P.moving}>
        {face}
      </Card>
    );
  });
  return <>{cards}</>;
};
